const { readDataset, statisticsPaths, readJsonFile, writeJsonFile } = require('../statistics/statistics.paths');
const { computeMetrics } = require('../statistics/statistics.service');
const { runPrompt, readSettings, extractJson } = require('../ai/ai.service');
const taxonomyService = require('./taxonomy.service');
const { computeMastery } = require('./topics.service');
const { buildTaxonomySuggestionPrompt } = require('./learning.prompts');
const { collectActivity } = require('./moodleActivity');
const { computeIndicators } = require('./indicators.service');
const { detectPatterns } = require('./patterns.service');

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
  return { dataset, mastery, activity };
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
