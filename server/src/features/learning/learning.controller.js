const { readDataset, statisticsPaths, readJsonFile, writeJsonFile } = require('../statistics/statistics.paths');
const { computeMetrics } = require('../statistics/statistics.service');
const { runPrompt, readSettings, extractJson } = require('../ai/ai.service');
const taxonomyService = require('./taxonomy.service');
const { computeMastery } = require('./topics.service');
const { buildTaxonomySuggestionPrompt } = require('./learning.prompts');
const { collectActivity } = require('./moodleActivity');
const { computeIndicators } = require('./indicators.service');
const { detectPatterns } = require('./patterns.service');
const { buildAcademicRecord } = require('./academic.service');
const outcomeService = require('./outcome.service');
const association = require('./association.service');

// ---------------------------------------------------------------------------
// Taxonomias globais
// ---------------------------------------------------------------------------

exports.listTaxonomies = (req, res) => {
  try {
    res.json(taxonomyService.readTaxonomies());
  } catch (err) {
    res.status(500).json({ error: `Falha ao ler as taxonomias: ${err.message}` });
  }
};

exports.saveTaxonomy = (req, res) => {
  try {
    res.json(taxonomyService.saveTaxonomy(req.body));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

exports.deleteTaxonomy = (req, res) => {
  try {
    taxonomyService.deleteTaxonomy(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: `Falha ao remover a taxonomia: ${err.message}` });
  }
};

// ---------------------------------------------------------------------------
// Vínculo e mapeamento por turma
// ---------------------------------------------------------------------------

exports.getMapping = (req, res) => {
  const { turma } = req.query;
  const dataset = readDataset(turma);
  if (!dataset) return res.status(404).json({ error: 'Importação não encontrada.' });

  const stored = taxonomyService.readMapping(turma);
  res.json({
    ...stored,
    questions: (dataset.questions || []).map(q => ({
      key: q.key, name: q.name, section: q.section || null, cmid: q.cmid
    }))
  });
};

exports.saveMapping = (req, res) => {
  const { turma, taxonomyId, mapping, reviewed } = req.body;
  const dataset = readDataset(turma);
  if (!dataset) return res.status(404).json({ error: 'Importação não encontrada.' });

  const taxonomy = taxonomyId ? taxonomyService.getTaxonomy(taxonomyId) : null;
  if (taxonomyId && !taxonomy) return res.status(400).json({ error: 'Taxonomia não encontrada.' });

  try {
    const previous = taxonomyService.readMapping(turma);
    const record = taxonomyService.writeMapping(turma, {
      ...previous,
      taxonomyId: taxonomyId || null,
      mapping: taxonomyService.normalizeMapping(mapping, taxonomy),
      reviewedAt: reviewed ? Date.now() : previous.reviewedAt
    });
    res.json(record);
  } catch (err) {
    res.status(500).json({ error: `Falha ao salvar o mapeamento: ${err.message}` });
  }
};

/**
 * Vincula uma taxonomia à turma aproveitando o que outras turmas já mapearam
 * para as mesmas atividades VPL.
 */
exports.bindTaxonomy = (req, res) => {
  const { turma, taxonomyId } = req.body;
  const dataset = readDataset(turma);
  if (!dataset) return res.status(404).json({ error: 'Importação não encontrada.' });

  const taxonomy = taxonomyService.getTaxonomy(taxonomyId);
  if (!taxonomy) return res.status(400).json({ error: 'Taxonomia não encontrada.' });

  try {
    const previous = taxonomyService.readMapping(turma);
    const inherited = previous.taxonomyId === taxonomyId
      ? { mapping: previous.mapping, reusedFrom: [] }
      : taxonomyService.inheritMappingByCmid(dataset, taxonomyId);

    const record = taxonomyService.writeMapping(turma, {
      ...previous,
      taxonomyId,
      mapping: taxonomyService.normalizeMapping(inherited.mapping, taxonomy)
    });

    res.json({ ...record, reusedFrom: inherited.reusedFrom });
  } catch (err) {
    res.status(500).json({ error: `Falha ao vincular a taxonomia: ${err.message}` });
  }
};

// ---------------------------------------------------------------------------
// Sugestão por IA
// ---------------------------------------------------------------------------

exports.suggestMapping = async (req, res) => {
  const { turma, taxonomyId } = req.body;
  const dataset = readDataset(turma);
  if (!dataset) return res.status(404).json({ error: 'Importação não encontrada.' });

  const taxonomy = taxonomyService.getTaxonomy(taxonomyId);
  if (!taxonomy) return res.status(400).json({ error: 'Taxonomia não encontrada.' });

  try {
    const metrics = computeMetrics(dataset);
    const { systemPrompt, userPrompt } = buildTaxonomySuggestionPrompt({ taxonomy, metrics, dataset });
    const settings = readSettings();
    const raw = await runPrompt({ settings, systemPrompt, userPrompt, json: true, maxTokens: 3000 });

    let parsed;
    try {
      parsed = extractJson(raw);
    } catch (err) {
      // Sem fallback silencioso: o professor precisa saber que a sugestão
      // falhou para decidir entre tentar de novo e mapear à mão.
      return res.status(502).json({
        error: 'O modelo não devolveu JSON válido. Tente novamente ou faça o mapeamento manualmente.',
        raw: String(raw || '').slice(0, 500)
      });
    }

    const validCodes = new Set(taxonomy.topics.map(t => t.code));
    const newTopics = (parsed.novosTopicos || [])
      .filter(topic => topic?.code && topic?.name && !validCodes.has(String(topic.code).trim()))
      .map(topic => ({
        code: String(topic.code).trim(),
        name: String(topic.name).trim(),
        rationale: String(topic.rationale || '').trim()
      }));

    // A sugestão não é persistida: ela volta para a tela de revisão.
    const questionKeys = new Set((dataset.questions || []).map(q => q.key));
    const suggestedCodes = new Set([...validCodes, ...newTopics.map(t => t.code)]);
    const suggestion = {};

    Object.entries(parsed.mapeamento || {}).forEach(([questionKey, entries]) => {
      if (!questionKeys.has(questionKey)) return;
      const list = (Array.isArray(entries) ? entries : [])
        .map(entry => ({
          code: String(entry?.code || '').trim(),
          weight: Number(entry?.weight) === 0.5 ? 0.5 : 1,
          rationale: String(entry?.rationale || '').trim()
        }))
        .filter(entry => entry.code && suggestedCodes.has(entry.code))
        .filter((entry, i, all) => all.findIndex(e => e.code === entry.code) === i);
      if (list.length) suggestion[questionKey] = list;
    });

    res.json({
      mapping: suggestion,
      newTopics,
      unmapped: (dataset.questions || []).filter(q => !suggestion[q.key]).map(q => q.key),
      provider: settings.provider,
      model: settings.provider === 'ollama' ? settings.ollamaModel : settings.cloudModel,
      generatedAt: Date.now()
    });
  } catch (err) {
    console.error('[learning] Suggestion failed:', err);
    res.status(500).json({ error: err.message });
  }
};

// ---------------------------------------------------------------------------
// Domínio conceitual
// ---------------------------------------------------------------------------

exports.getMastery = (req, res) => {
  const { turma } = req.query;
  const dataset = readDataset(turma);
  if (!dataset) return res.status(404).json({ error: 'Importação não encontrada.' });

  const stored = taxonomyService.readMapping(turma);
  if (!stored.taxonomyId) {
    return res.json({ bound: false, taxonomyId: null, topics: [], students: [], coverage: null });
  }

  const taxonomy = taxonomyService.getTaxonomy(stored.taxonomyId);
  if (!taxonomy) {
    return res.json({
      bound: false,
      taxonomyId: stored.taxonomyId,
      error: 'A taxonomia vinculada a esta turma não existe mais.',
      topics: [], students: [], coverage: null
    });
  }

  try {
    res.json({ bound: true, ...computeMastery(dataset, taxonomy, stored.mapping) });
  } catch (err) {
    console.error('[learning] Mastery failed:', err);
    res.status(500).json({ error: `Falha ao calcular o domínio conceitual: ${err.message}` });
  }
};

// ---------------------------------------------------------------------------
// Atividade (logs do Moodle)
// ---------------------------------------------------------------------------

/** Carrega o que as três camadas precisam: dataset, domínio e atividade. */
function loadContext(turma) {
  const dataset = readDataset(turma);
  if (!dataset) return null;

  const stored = taxonomyService.readMapping(turma);
  const taxonomy = stored.taxonomyId ? taxonomyService.getTaxonomy(stored.taxonomyId) : null;
  const mastery = taxonomy
    ? { bound: true, ...computeMastery(dataset, taxonomy, stored.mapping) }
    : { bound: false, topics: [], students: [] };

  const activity = readJsonFile(statisticsPaths(turma).activity, null);
  return { dataset, mastery, activity, taxonomy, mapping: stored.mapping };
}

/**
 * Contexto de uma janela de observação.
 *
 * A janela "início" recorta tudo — submissões, histórico e atividade — até o
 * primeiro terço do período e **recalcula** indicadores e domínio sobre o
 * recorte. Recalcular é o ponto: usar o domínio do fim do semestre com a
 * atividade do começo misturaria dois tempos.
 */
function windowedContext(context, window) {
  if (window !== 'early') {
    return {
      indicators: computeIndicators(context.dataset, context.activity, context.mastery),
      cutoff: null
    };
  }

  const full = computeIndicators(context.dataset, context.activity, context.mastery);
  const cutoff = association.earlyCutoff(full.period);
  if (!cutoff) return { indicators: full, cutoff: null };

  const dataset = association.truncateDataset(context.dataset, cutoff);
  const activity = association.truncateActivity(context.activity, cutoff);
  const mastery = context.taxonomy
    ? { bound: true, ...computeMastery(dataset, context.taxonomy, context.mapping) }
    : { bound: false, topics: [], students: [] };

  return { indicators: computeIndicators(dataset, activity, mastery), cutoff };
}

exports.getActivity = (req, res) => {
  const { turma } = req.query;
  const dataset = readDataset(turma);
  if (!dataset) return res.status(404).json({ error: 'Importação não encontrada.' });

  // A tela precisa do endereço e do id do curso para abrir o login do Moodle
  // sem pedir de novo o que a importação já guardou.
  const origin = { baseUrl: dataset.baseUrl || null, courseId: dataset.courseId ?? null };

  const activity = readJsonFile(statisticsPaths(turma).activity, null);
  if (!activity) return res.json({ collected: false, ...origin });
  res.json({
    collected: true,
    ...origin,
    collectedAt: activity.collectedAt,
    sources: activity.sources,
    logRows: activity.logRows,
    warnings: activity.warnings || [],
    studentsWithActivity: Object.keys(activity.byStudent || {}).length
  });
};

exports.collectActivity = async (req, res) => {
  const { turma, cookie, userAgent, baseUrl, courseId } = req.body;
  const dataset = readDataset(turma);
  if (!dataset) return res.status(404).json({ error: 'Importação não encontrada.' });
  if (!cookie) return res.status(400).json({ error: 'Sessão do Moodle não capturada.' });

  const resolvedCourseId = courseId ?? dataset.courseId;
  if (!resolvedCourseId) {
    return res.status(400).json({ error: 'Esta importação não guardou o id do curso; reimporte para coletar logs.' });
  }

  try {
    const activity = await collectActivity({
      turma,
      baseUrl: baseUrl || dataset.baseUrl,
      cookie,
      userAgent,
      courseId: resolvedCourseId,
      dataset
    });
    writeJsonFile(statisticsPaths(turma).activity, activity);
    res.json({
      success: true,
      collectedAt: activity.collectedAt,
      sources: activity.sources,
      logRows: activity.logRows,
      warnings: activity.warnings,
      studentsWithActivity: Object.keys(activity.byStudent).length
    });
  } catch (err) {
    console.error('[learning] Activity collection failed:', err);
    res.status(500).json({ error: `Falha ao coletar a atividade: ${err.message}` });
  }
};

// ---------------------------------------------------------------------------
// Indicadores e padrões
// ---------------------------------------------------------------------------

exports.getIndicators = (req, res) => {
  const context = loadContext(req.query.turma);
  if (!context) return res.status(404).json({ error: 'Importação não encontrada.' });

  try {
    res.json(computeIndicators(context.dataset, context.activity, context.mastery));
  } catch (err) {
    console.error('[learning] Indicators failed:', err);
    res.status(500).json({ error: `Falha ao calcular os indicadores: ${err.message}` });
  }
};

exports.getPatterns = (req, res) => {
  const context = loadContext(req.query.turma);
  if (!context) return res.status(404).json({ error: 'Importação não encontrada.' });

  try {
    const indicators = computeIndicators(context.dataset, context.activity, context.mastery);
    res.json(detectPatterns(context.dataset, indicators, context.mastery, context.activity));
  } catch (err) {
    console.error('[learning] Patterns failed:', err);
    res.status(500).json({ error: `Falha ao detectar os padrões: ${err.message}` });
  }
};

// ---------------------------------------------------------------------------
// Notas e frequência do portal
// ---------------------------------------------------------------------------

exports.getAcademic = (req, res) => {
  const { turma } = req.query;
  const dataset = readDataset(turma);
  if (!dataset) return res.status(404).json({ error: 'Importação não encontrada.' });

  const record = readJsonFile(statisticsPaths(turma).academic, null);
  if (!record) return res.json({ imported: false });
  res.json({
    imported: true,
    importedAt: record.importedAt,
    sourceLabel: record.sourceLabel,
    columns: record.columns,
    match: record.match
  });
};

exports.saveAcademic = (req, res) => {
  const { turma, rows, columns, sourceLabel } = req.body;
  const dataset = readDataset(turma);
  if (!dataset) return res.status(404).json({ error: 'Importação não encontrada.' });
  if (!Array.isArray(rows) || !rows.length) {
    return res.status(400).json({ error: 'A planilha não trouxe nenhuma linha.' });
  }

  try {
    const record = buildAcademicRecord({ dataset, rows, columns, sourceLabel });
    writeJsonFile(statisticsPaths(turma).academic, record);
    res.json({ success: true, importedAt: record.importedAt, match: record.match });
  } catch (err) {
    console.error('[learning] Academic import failed:', err);
    res.status(500).json({ error: `Falha ao importar a planilha: ${err.message}` });
  }
};

/** Prévia do casamento, sem gravar nada — o professor confere antes de aceitar. */
exports.previewAcademic = (req, res) => {
  const { turma, rows } = req.body;
  const dataset = readDataset(turma);
  if (!dataset) return res.status(404).json({ error: 'Importação não encontrada.' });

  try {
    const { match } = require('./academic.service').matchAcademicRows(dataset, rows || []);
    res.json(match);
  } catch (err) {
    res.status(500).json({ error: `Falha ao conferir a planilha: ${err.message}` });
  }
};

// ---------------------------------------------------------------------------
// Desfecho e associação
// ---------------------------------------------------------------------------

exports.getOutcome = (req, res) => {
  const { turma } = req.query;
  const dataset = readDataset(turma);
  if (!dataset) return res.status(404).json({ error: 'Importação não encontrada.' });

  const stored = readJsonFile(statisticsPaths(turma).outcome, null);
  const academic = readJsonFile(statisticsPaths(turma).academic, null);
  const resolved = outcomeService.resolveOutcome(dataset, stored, academic);

  res.json({
    config: outcomeService.normalizeConfig(stored),
    defined: resolved.defined,
    total: resolved.total,
    available: resolved.available,
    independence: resolved.independence,
    warnings: resolved.warnings,
    hasAcademic: Boolean(academic),
    students: (dataset.students || []).map(student => ({
      userId: student.userId,
      name: student.name,
      value: resolved.values.get(String(student.userId ?? student.folderName)) ?? null,
      marked: resolved.manual[String(student.userId ?? student.folderName)] === true
    }))
  });
};

exports.saveOutcome = (req, res) => {
  const { turma, ...config } = req.body;
  const dataset = readDataset(turma);
  if (!dataset) return res.status(404).json({ error: 'Importação não encontrada.' });

  try {
    const record = { ...outcomeService.normalizeConfig(config), updatedAt: Date.now() };
    writeJsonFile(statisticsPaths(turma).outcome, record);
    res.json(record);
  } catch (err) {
    res.status(500).json({ error: `Falha ao salvar o desfecho: ${err.message}` });
  }
};

exports.getAssociation = (req, res) => {
  const { turma, window } = req.query;
  const context = loadContext(turma);
  if (!context) return res.status(404).json({ error: 'Importação não encontrada.' });

  try {
    const stored = readJsonFile(statisticsPaths(turma).outcome, null);
    const academic = readJsonFile(statisticsPaths(turma).academic, null);
    const outcome = outcomeService.resolveOutcome(context.dataset, stored, academic);

    if (!outcome.available) {
      return res.json({
        available: false,
        outcome: { kind: outcome.kind, source: outcome.source, defined: 0, total: outcome.total },
        warnings: outcome.warnings,
        blocks: []
      });
    }

    const { indicators, cutoff } = windowedContext(context, window === 'early' ? 'early' : 'full');
    const result = association.computeAssociation(indicators, outcome, {
      turma, window: window === 'early' ? 'early' : 'full'
    });
    res.json({ available: true, cutoff, ...result });
  } catch (err) {
    console.error('[learning] Association failed:', err);
    res.status(500).json({ error: `Falha ao calcular a associação: ${err.message}` });
  }
};
