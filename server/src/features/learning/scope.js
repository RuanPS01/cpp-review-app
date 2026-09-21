// Como uma seleção de turmas vira contexto de aprendizado.
//
// A aba Estatísticas passou a trabalhar com várias importações ao mesmo tempo, e
// nem toda análise deste módulo pode ser simplesmente somada entre elas. A regra
// que organiza o arquivo:
//
// **O que depende do período letivo é calculado por turma.**
//
// Engajamento e regularidade dividem por semanas do período, e o período sai do
// `min(startDate)`/`max(dueDate)` das questões. Jogar 2025/2, 2026/1 e 2026/2
// num cálculo só faria o período virar um ano e meio: um aluno que cursou apenas
// 2025/2 apareceria com um terço das semanas ativas e **seis meses de silêncio**
// — artefato da agregação, não fato sobre o aluno.
//
// Domínio conceitual é a exceção: é proporção de acerto ponderada, não divide
// por tempo nenhum. Ali juntar turmas só aumenta a evidência por conceito, que é
// justamente o que falta com duas a quatro questões por conceito.

const { mergeDatasets } = require('../statistics/statistics.service');
const { statisticsPaths, readDataset, readJsonFile } = require('../statistics/statistics.paths');
const { computeIndicators } = require('./indicators.service');
const { computeMastery } = require('./topics.service');
const taxonomyService = require('./taxonomy.service');
const outcomeService = require('./outcome.service');

/** Tudo que uma turma sozinha oferece ao módulo. */
function loadTurmaContext(turma) {
  const dataset = readDataset(turma);
  if (!dataset) return null;

  const paths = statisticsPaths(turma);
  const stored = taxonomyService.readMapping(turma);
  const taxonomy = stored.taxonomyId ? taxonomyService.getTaxonomy(stored.taxonomyId) : null;
  const activity = readJsonFile(paths.activity, null);
  const academic = readJsonFile(paths.academic, null);

  const mastery = taxonomy
    ? { bound: true, ...computeMastery(dataset, taxonomy, stored.mapping) }
    : { bound: false, topics: [], students: [] };

  return {
    turma,
    dataset,
    activity,
    academic,
    outcomeConfig: readJsonFile(paths.outcome, null),
    registry: readJsonFile(paths.interventions, null),
    taxonomyId: stored.taxonomyId || null,
    taxonomy,
    mapping: stored.mapping || {},
    mastery,
    // Por turma, com o período da própria turma — é o ponto do arquivo.
    indicators: computeIndicators(dataset, activity, mastery)
  };
}

/**
 * Resolve a seleção inteira.
 *
 * @param {string[]} turmas
 * @returns {null|object} `null` quando nenhuma turma da seleção existe
 */
function loadScope(turmas) {
  const contexts = [];
  const missing = [];

  (turmas || []).forEach(turma => {
    const context = loadTurmaContext(turma);
    if (context) contexts.push(context);
    else missing.push(turma);
  });

  if (!contexts.length) return null;

  const combined = contexts.length > 1;
  const merged = mergeDatasets(contexts.map(context => context.dataset));

  return {
    turmas: contexts.map(context => context.turma),
    missing,
    contexts,
    combined,
    merged,
    warnings: missing.map(turma => `Importação "${turma}" não encontrada; ficou de fora.`)
  };
}

// ---------------------------------------------------------------------------
// Conceitos — a única análise que pode juntar turmas
// ---------------------------------------------------------------------------

/**
 * A chave da questão no dataset consolidado.
 *
 * `mergeDatasets` prefixa com a turma **só** quando há mais de uma importação
 * na seleção; com uma turma a chave continua sendo a original, e os mapeamentos
 * já gravados seguem valendo sem migração.
 */
const scopedKey = (scope, turma, sourceKey) =>
  (scope.combined ? `${turma}::${sourceKey}` : sourceKey);

/**
 * Junta os mapeamentos questão→conceito das turmas, re-chaveando para as chaves
 * do dataset consolidado.
 */
function combinedMapping(scope) {
  const mapping = {};
  scope.contexts.forEach(context => {
    Object.entries(context.mapping || {}).forEach(([sourceKey, entries]) => {
      mapping[scopedKey(scope, context.turma, sourceKey)] = entries;
    });
  });
  return mapping;
}

/**
 * Domínio conceitual da seleção inteira.
 *
 * Turmas vinculadas a **taxonomias diferentes** não são comparáveis: dois
 * conceitos com o mesmo código podem ter sido definidos de formas distintas, e
 * somá-los produziria um número que não significa nada. Aqui isso é recusado
 * com a lista de quem usa o quê — inventar equivalência seria pior que não
 * responder.
 */
function scopeMastery(scope) {
  const bound = scope.contexts.filter(context => context.taxonomyId);
  if (!bound.length) {
    return { bound: false, taxonomyId: null, topics: [], students: [], coverage: null };
  }

  const ids = [...new Set(bound.map(context => context.taxonomyId))];
  if (ids.length > 1) {
    return {
      bound: false,
      conflict: bound.map(context => ({ turma: context.turma, taxonomyId: context.taxonomyId })),
      taxonomyId: null,
      topics: [],
      students: [],
      coverage: null
    };
  }

  const taxonomy = bound[0].taxonomy;
  if (!taxonomy) {
    return {
      bound: false,
      taxonomyId: ids[0],
      error: 'A taxonomia vinculada a esta seleção não existe mais.',
      topics: [], students: [], coverage: null
    };
  }

  const unbound = scope.contexts.filter(context => !context.taxonomyId).map(context => context.turma);
  return {
    bound: true,
    ...computeMastery(scope.merged, taxonomy, combinedMapping(scope)),
    /** Turmas da seleção que ainda não vincularam taxonomia nenhuma. */
    unboundTurmas: unbound
  };
}

// ---------------------------------------------------------------------------
// Indicadores e padrões — por turma, sempre
// ---------------------------------------------------------------------------

/** As fontes disponíveis em toda a seleção, e as que só parte dela tem. */
function scopeSources(scope) {
  const keys = ['logs', 'participation', 'history', 'taxonomy'];
  const sources = {};
  const partial = {};
  keys.forEach(key => {
    const available = scope.contexts.filter(context => context.indicators.sources[key]).length;
    sources[key] = available === scope.contexts.length;
    partial[key] = available > 0 && available < scope.contexts.length;
  });
  return { sources, sourcesPartial: partial };
}

// ---------------------------------------------------------------------------
// Desfecho — empilhado, porque é onde o `n` importa
// ---------------------------------------------------------------------------

/**
 * Resolve o desfecho de cada turma e diz se a seleção pode ser empilhada.
 *
 * Só faz sentido juntar pares de turmas que medem **a mesma coisa**: nota final
 * de um lado e reprovação do outro não são a mesma variável, e a fonte muda o
 * quanto o desfecho é independente dos indicadores.
 */
function scopeOutcome(scope) {
  const perTurma = scope.contexts.map(context => ({
    turma: context.turma,
    outcome: outcomeService.resolveOutcome(context.dataset, context.outcomeConfig, context.academic)
  }));

  const withData = perTurma.filter(entry => entry.outcome.available);
  if (!withData.length) {
    return {
      available: false,
      perTurma,
      warnings: [...new Set(perTurma.flatMap(entry => entry.outcome.warnings))]
    };
  }

  const kinds = [...new Set(withData.map(entry => entry.outcome.kind))];
  const sources = [...new Set(withData.map(entry => entry.outcome.source))];
  const warnings = [...new Set(withData.flatMap(entry => entry.outcome.warnings))];

  if (kinds.length > 1 || sources.length > 1) {
    return {
      available: false,
      mismatch: perTurma
        .filter(entry => entry.outcome.available)
        .map(entry => ({ turma: entry.turma, kind: entry.outcome.kind, source: entry.outcome.source })),
      perTurma,
      warnings
    };
  }

  const skipped = perTurma.filter(entry => !entry.outcome.available).map(entry => entry.turma);
  if (skipped.length) {
    warnings.push(`Sem desfecho configurado em: ${skipped.join(', ')}. Essas turmas ficaram de fora.`);
  }

  const reference = withData[0].outcome;
  return {
    available: true,
    kind: reference.kind,
    source: reference.source,
    cut: reference.cut,
    vplWeight: reference.vplWeight,
    independence: reference.independence,
    binary: reference.binary,
    perTurma: withData,
    defined: withData.reduce((acc, entry) => acc + entry.outcome.defined, 0),
    total: withData.reduce((acc, entry) => acc + entry.outcome.total, 0),
    warnings
  };
}

module.exports = {
  loadTurmaContext,
  loadScope,
  scopeMastery,
  scopeSources,
  scopeOutcome,
  combinedMapping,
  scopedKey
};
