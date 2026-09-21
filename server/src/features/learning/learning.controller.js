const { readDataset } = require('../statistics/statistics.paths');
const { computeMetrics } = require('../statistics/statistics.service');
const { runPrompt, readSettings, extractJson } = require('../ai/ai.service');
const taxonomyService = require('./taxonomy.service');
const { computeMastery } = require('./topics.service');
const { buildTaxonomySuggestionPrompt } = require('./learning.prompts');

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
