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
const interventions = require('./interventions.service');
const { buildSocraticPackagePrompt, SOCRATIC_RULES } = require('./learning.prompts');
const { parseTurmas } = require('../statistics/statistics.selection');
const scopeService = require('./scope');

/**
 * Resolve a seleção da requisição, já respondendo o erro quando não há nada.
 * Devolve `null` nesse caso, para o handler só precisar de um `if`.
 */
function resolveScope(req, res, source) {
  const turmas = parseTurmas(source);
  if (!turmas.length) {
    res.status(400).json({ error: 'Informe ao menos uma importação de estatísticas.' });
    return null;
  }
  const scope = scopeService.loadScope(turmas);
  if (!scope) {
    res.status(404).json({ error: `Importação não encontrada: ${turmas.join(', ')}` });
    return null;
  }
  return scope;
}

/** Identificador estável do recorte, usado como semente do bootstrap. */
const scopeId = (turmas) => [...turmas].sort().join(' + ');

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
  const scope = resolveScope(req, res, req.query);
  if (!scope) return;

  // O mapeamento é por turma mesmo com várias selecionadas: uma questão de
  // 2025/2 e outra de 2026/1 podem ter enunciados diferentes sob o mesmo nome.
  res.json({
    turmas: scope.turmas,
    combined: scope.combined,
    perTurma: scope.contexts.map(context => ({
      turma: context.turma,
      taxonomyId: context.taxonomyId,
      mapping: context.mapping,
      questions: (context.dataset.questions || []).map(question => ({
        key: question.key, name: question.name, section: question.section || null, cmid: question.cmid
      }))
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
  const { taxonomyId } = req.body;
  const scope = resolveScope(req, res, req.body);
  if (!scope) return;

  const taxonomy = taxonomyService.getTaxonomy(taxonomyId);
  if (!taxonomy) return res.status(400).json({ error: 'Taxonomia não encontrada.' });

  try {
    // Vincular a seleção inteira de uma vez é o que resolve, pela tela, o caso
    // em que turmas diferentes apontam para taxonomias diferentes — e o
    // reaproveitamento por `cmid` faz a mesma prova de dois semestres chegar já
    // mapeada.
    const records = scope.contexts.map(context => {
      const previous = taxonomyService.readMapping(context.turma);
      const inherited = previous.taxonomyId === taxonomyId
        ? { mapping: previous.mapping, reusedFrom: [] }
        : taxonomyService.inheritMappingByCmid(context.dataset, taxonomyId);

      const record = taxonomyService.writeMapping(context.turma, {
        ...previous,
        taxonomyId,
        mapping: taxonomyService.normalizeMapping(inherited.mapping, taxonomy)
      });
      return { turma: context.turma, ...record, reusedFrom: inherited.reusedFrom };
    });

    res.json({ turmas: scope.turmas, perTurma: records });
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
  const scope = resolveScope(req, res, req.query);
  if (!scope) return;

  try {
    // Domínio conceitual é o único cálculo do módulo que não divide por tempo,
    // então juntar turmas aqui só aumenta a evidência por conceito.
    res.json({ turmas: scope.turmas, combined: scope.combined, ...scopeService.scopeMastery(scope) });
  } catch (err) {
    console.error('[learning] Mastery failed:', err);
    res.status(500).json({ error: `Falha ao calcular o domínio conceitual: ${err.message}` });
  }
};

// ---------------------------------------------------------------------------
// Atividade (logs do Moodle)
// ---------------------------------------------------------------------------

/**
 * Recorta uma turma até uma data e recalcula tudo sobre o recorte.
 *
 * A janela "início do período" é o que impede a evasão de ser tautológica — e é
 * também a pergunta útil: o que dava para saber cedo.
 */
function windowedContext(context, window) {
  if (window !== 'early') return { indicators: context.indicators, cutoff: null };

  const cutoff = association.earlyCutoff(context.indicators.period);
  if (!cutoff) return { indicators: context.indicators, cutoff: null };

  const dataset = association.truncateDataset(context.dataset, cutoff);
  const activity = association.truncateActivity(context.activity, cutoff);
  const mastery = context.taxonomy
    ? { bound: true, ...computeMastery(dataset, context.taxonomy, context.mapping) }
    : { bound: false, topics: [], students: [] };

  return { indicators: computeIndicators(dataset, activity, mastery), cutoff };
}

exports.getActivity = (req, res) => {
  const scope = resolveScope(req, res, req.query);
  if (!scope) return;

  res.json({
    turmas: scope.turmas,
    perTurma: scope.contexts.map(context => {
      const activity = context.activity;
      const origin = {
        turma: context.turma,
        baseUrl: context.dataset.baseUrl || null,
        courseId: context.dataset.courseId ?? null
      };
      if (!activity) return { ...origin, collected: false };
      return {
        ...origin,
        collected: true,
        collectedAt: activity.collectedAt,
        sources: activity.sources,
        logRows: activity.logRows,
        warnings: activity.warnings || [],
        studentsWithActivity: Object.keys(activity.byStudent || {}).length
      };
    })
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
  const scope = resolveScope(req, res, req.query);
  if (!scope) return;

  try {
    // Calculado por turma de propósito: engajamento e regularidade dividem por
    // semanas do período, e somar semestres faria um aluno de um semestre só
    // parecer meses em silêncio.
    res.json({
      turmas: scope.turmas,
      combined: scope.combined,
      ...scopeService.scopeSources(scope),
      byTurma: scope.contexts.map(context => ({
        turma: context.turma,
        ...context.indicators
      }))
    });
  } catch (err) {
    console.error('[learning] Indicators failed:', err);
    res.status(500).json({ error: `Falha ao calcular os indicadores: ${err.message}` });
  }
};

exports.getPatterns = (req, res) => {
  const scope = resolveScope(req, res, req.query);
  if (!scope) return;

  try {
    res.json({
      turmas: scope.turmas,
      combined: scope.combined,
      byTurma: scope.contexts.map(context => ({
        turma: context.turma,
        // Os limiares saem da distribuição da própria turma — misturar
        // semestres para calcular a mediana do ganho mudaria o critério de
        // cada aluno conforme quem mais está selecionado na tela.
        ...detectPatterns(context.dataset, context.indicators, context.mastery, context.activity)
      }))
    });
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
  const scope = resolveScope(req, res, req.query);
  if (!scope) return;

  const consolidated = scopeService.scopeOutcome(scope);
  res.json({
    turmas: scope.turmas,
    combined: scope.combined,
    available: consolidated.available,
    mismatch: consolidated.mismatch || null,
    kind: consolidated.kind ?? null,
    source: consolidated.source ?? null,
    independence: consolidated.independence ?? null,
    defined: consolidated.defined ?? 0,
    total: consolidated.total ?? 0,
    warnings: consolidated.warnings,
    perTurma: scope.contexts.map(context => {
      const resolved = outcomeService.resolveOutcome(context.dataset, context.outcomeConfig, context.academic);
      return {
        turma: context.turma,
        config: outcomeService.normalizeConfig(context.outcomeConfig),
        defined: resolved.defined,
        total: resolved.total,
        available: resolved.available,
        independence: resolved.independence,
        hasAcademic: Boolean(context.academic),
        warnings: resolved.warnings
      };
    })
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
  const scope = resolveScope(req, res, req.query);
  if (!scope) return;
  const window = req.query.window === 'early' ? 'early' : 'full';

  try {
    const consolidated = scopeService.scopeOutcome(scope);
    if (!consolidated.available) {
      return res.json({
        available: false,
        turmas: scope.turmas,
        mismatch: consolidated.mismatch || null,
        warnings: consolidated.warnings,
        blocks: []
      });
    }

    // Uma fonte por turma: os indicadores vêm do período da própria turma, e só
    // os **pares** é que são empilhados.
    const withOutcome = new Set(consolidated.perTurma.map(entry => entry.turma));
    const sources = scope.contexts
      .filter(context => withOutcome.has(context.turma))
      .map(context => {
        const { indicators, cutoff } = windowedContext(context, window);
        const outcome = consolidated.perTurma.find(entry => entry.turma === context.turma).outcome;
        return { turma: context.turma, indicators, values: outcome.values, cutoff };
      });

    const result = association.computeAssociation(sources, consolidated, {
      scopeId: scopeId(scope.turmas), window
    });

    res.json({
      available: true,
      cutoff: sources[0]?.cutoff ?? null,
      ...scopeService.scopeSources(scope),
      ...result
    });
  } catch (err) {
    console.error('[learning] Association failed:', err);
    res.status(500).json({ error: `Falha ao calcular a associação: ${err.message}` });
  }
};

// ---------------------------------------------------------------------------
// Intervenções
// ---------------------------------------------------------------------------

const readRegistry = (turma) =>
  readJsonFile(statisticsPaths(turma).interventions, interventions.emptyRegistry());

exports.getInterventions = (req, res) => {
  const scope = resolveScope(req, res, req.query);
  if (!scope) return;

  try {
    // O registro é por turma, porque o retrato de baseline aponta para a
    // importação daquela turma. A tela empilha com a coluna de turma.
    const perTurma = scope.contexts.map(context => {
      const registry = readRegistry(context.turma);
      return {
        turma: context.turma,
        importedAt: context.dataset.importedAt,
        entries: (registry.entries || []).map(entry => ({ ...entry, turma: context.turma })),
        followup: interventions.computeFollowup(context.dataset, registry)
      };
    });

    res.json({
      turmas: scope.turmas,
      combined: scope.combined,
      perTurma,
      entries: perTurma.flatMap(item => item.entries),
      actions: interventions.ACTIONS,
      statuses: interventions.STATUSES
    });
  } catch (err) {
    console.error('[learning] Interventions failed:', err);
    res.status(500).json({ error: `Falha ao ler as intervenções: ${err.message}` });
  }
};

exports.addIntervention = (req, res) => {
  const { turma, ...entry } = req.body;
  const context = scopeService.loadTurmaContext(turma);
  if (!context) return res.status(404).json({ error: 'Importação não encontrada.' });
  if (entry.userId === undefined || entry.userId === null) {
    return res.status(400).json({ error: 'A intervenção precisa de um aluno.' });
  }

  try {
    const next = interventions.addEntry(readRegistry(turma), {
      dataset: context.dataset, indicators: context.indicators, mastery: context.mastery, entry
    });
    writeJsonFile(statisticsPaths(turma).interventions, next);
    res.json({ success: true, entries: next.entries });
  } catch (err) {
    console.error('[learning] Add intervention failed:', err);
    res.status(500).json({ error: `Falha ao registrar a intervenção: ${err.message}` });
  }
};

exports.updateIntervention = (req, res) => {
  const { turma, ...patch } = req.body;
  if (!readDataset(turma)) return res.status(404).json({ error: 'Importação não encontrada.' });

  try {
    const next = interventions.updateEntry(readRegistry(turma), req.params.id, patch);
    writeJsonFile(statisticsPaths(turma).interventions, next);
    res.json({ success: true, entries: next.entries });
  } catch (err) {
    res.status(500).json({ error: `Falha ao atualizar a intervenção: ${err.message}` });
  }
};

exports.deleteIntervention = (req, res) => {
  const { turma } = req.query;
  if (!readDataset(turma)) return res.status(404).json({ error: 'Importação não encontrada.' });

  try {
    const next = interventions.removeEntry(readRegistry(turma), req.params.id);
    writeJsonFile(statisticsPaths(turma).interventions, next);
    res.json({ success: true, entries: next.entries });
  } catch (err) {
    res.status(500).json({ error: `Falha ao remover a intervenção: ${err.message}` });
  }
};

// ---------------------------------------------------------------------------
// Pacote socrático
// ---------------------------------------------------------------------------

exports.buildSocratic = async (req, res) => {
  const { turma, userId, questionKey, topicCode, lang } = req.body;
  const context = scopeService.loadTurmaContext(turma);
  if (!context) return res.status(404).json({ error: 'Importação não encontrada.' });

  const dataset = context.dataset;
  const question = (dataset.questions || []).find(q => q.key === questionKey) || null;
  const student = userId === undefined || userId === null
    ? null
    : (dataset.students || []).find(s => String(s.userId) === String(userId)) || null;
  const submission = student && questionKey ? student.questions?.[questionKey] : null;
  const topic = topicCode
    ? (context.taxonomy?.topics || []).find(item => item.code === topicCode) || null
    : null;

  if (!student && !topic) {
    return res.status(400).json({ error: 'Escolha um aluno ou um conceito.' });
  }

  try {
    const { systemPrompt, userPrompt } = buildSocraticPackagePrompt({
      scope: student ? 'student' : 'topic',
      topic, question, student, submission, lang
    });
    const settings = readSettings();
    const raw = await runPrompt({ settings, systemPrompt, userPrompt, json: true, maxTokens: 2500 });

    let parsed;
    try {
      parsed = extractJson(raw);
    } catch (err) {
      return res.status(502).json({
        error: 'O modelo não devolveu JSON válido. Tente novamente.',
        raw: String(raw || '').slice(0, 500)
      });
    }

    res.json({
      scope: student ? 'student' : 'topic',
      student: student ? { userId: student.userId, name: student.name } : null,
      topic: topic ? { code: topic.code, name: topic.name } : null,
      question: question ? { key: question.key, name: question.name } : null,
      // As regras não passam pelo modelo: se ele pudesse reescrevê-las, o pacote
      // deixaria de ser socrático no primeiro prompt em que achasse mais gentil
      // entregar a resposta.
      rules: SOCRATIC_RULES,
      generated: parsed,
      provider: settings.provider,
      model: settings.provider === 'ollama' ? settings.ollamaModel : settings.cloudModel,
      generatedAt: Date.now()
    });
  } catch (err) {
    console.error('[learning] Socratic package failed:', err);
    res.status(500).json({ error: err.message });
  }
};

