// Associação entre os indicadores e o desfecho.
//
// Esta é a parte do módulo mais fácil de errar sem que o erro apareça: com
// n≈40 e 17 indicadores, qualquer implementação descuidada produz um número de
// aparência respeitável. As quatro travas que este arquivo impõe:
//
// 1. **Circularidade.** Metade dos indicadores sai das mesmas notas do VPL que
//    compõem o desfecho. Eles entram em blocos separados, e nunca numa lista
//    única ordenada por |r| — em que o domínio conceitual sempre ficaria no topo
//    e seria lido como a descoberta do semestre, quando é aritmética.
// 2. **`n` efetivo por indicador.** Persistência é nula para a turma inteira sem
//    histórico profundo; engajamento é nulo sem logs. Nunca imputar.
// 3. **Evasão contra comportamento é tautologia.** Quem saiu na terceira semana
//    tem poucos dias ativos *porque* saiu. Só vale medido numa janela anterior.
// 4. **Nada de p-valor, e nada de "o intervalo não cruza zero"** — que é um
//    p-valor pela porta dos fundos. A incerteza se lê pela largura.

const { DIMENSIONS } = require('./indicators.service');
const { studentKey } = require('../statistics/statistics.service');
const { associate, intervalWidth, MIN_PAIRS, SMALL_SAMPLE } = require('./correlation');

/** Fração do período letivo que a janela "início" cobre. */
const studentKeyOf = (row) => studentKey(row);

const EARLY_WINDOW_SHARE = 1 / 3;
/** Abaixo desta cobertura, o número descreve um subgrupo pequeno demais. */
const MIN_COVERAGE = 0.34;
/** Entre isto e 1, o número sai marcado como amostra parcial. */
const PARTIAL_COVERAGE = 0.60;

/**
 * De onde cada indicador tira o valor, em relação à nota que costuma virar
 * desfecho.
 *
 * - `independent`: não deriva de nota nenhuma.
 * - `partial`: usa o corte de aprovação sobre as notas do VPL, mas não o nível.
 * - `shared`: é aritmeticamente derivado das mesmas notas.
 */
const FAMILY = {
  activeDays: 'independent',
  eventsPerWeek: 'independent',
  activitiesViewed: 'independent',
  medianGapDays: 'independent',
  longestSilenceDays: 'independent',
  activeWeeksRatio: 'independent',
  medianLeadHours: 'independent',
  lastMinuteRate: 'independent',
  distributedPractice: 'independent',

  submissionRate: 'partial',
  attemptsToFirstPass: 'partial',
  gainFirstToLast: 'partial',
  recoveryRate: 'partial',
  stalledCount: 'partial',

  avgMastery: 'shared',
  gapTopics: 'shared',
  firstAttemptPassRate: 'shared'
};

const FAMILY_ORDER = ['independent', 'partial', 'shared'];

/**
 * A família de um indicador depende da fonte do desfecho.
 *
 * Com a nota do portal, não entregar vira zero na média: `submissionRate` deixa
 * de ser comportamento e passa a ser aritmética. E se o professor não souber o
 * peso do VPL na nota final, a contaminação é desconhecida — o que se trata
 * como contaminação, não como ausência dela.
 */
function familyOf(key, outcome) {
  const base = FAMILY[key] || 'partial';
  if (outcome.source === 'manual') return base;
  if (base !== 'partial') return base;
  if (outcome.vplWeight === null) return 'shared';
  return key === 'submissionRate' ? 'shared' : 'partial';
}

// ---------------------------------------------------------------------------
// Janela de observação
// ---------------------------------------------------------------------------

/**
 * Recorta o dataset até uma data.
 *
 * Submissão posterior ao corte deixa de existir; o histórico é truncado e a
 * nota volta a ser a da última tentativa que sobrou. É o que permite perguntar
 * "o que dava para saber no primeiro terço?" — a única forma de a evasão não
 * ser tautológica, e a pergunta que realmente interessa para alerta precoce.
 */
function truncateDataset(dataset, cutoff) {
  return {
    ...dataset,
    students: (dataset.students || []).map(student => {
      const questions = {};
      Object.entries(student.questions || {}).forEach(([key, submission]) => {
        const history = (submission?.history || []).filter(entry => entry.submittedAt <= cutoff);
        const submittedInWindow = submission?.submitted && submission.submittedAt <= cutoff;

        if (!submittedInWindow && !history.length) {
          questions[key] = {
            ...submission,
            submitted: false, submittedAt: null, attempts: null, grade: null,
            evaluation: null, failedCases: [], compileErrors: [], hasCompileError: false,
            late: false, code: null, codeMetrics: null, history: []
          };
          return;
        }

        const last = history[history.length - 1];
        questions[key] = {
          ...submission,
          submitted: true,
          submittedAt: submittedInWindow ? submission.submittedAt : last.submittedAt,
          attempts: history.length || submission.attempts,
          grade: last ? last.grade : submission.grade,
          history
        };
      });
      return { ...student, questions };
    })
  };
}

/** Recorta a atividade diária até a data, recontando eventos e acessos. */
function truncateActivity(activity, cutoff) {
  if (!activity) return null;
  const byStudent = {};
  Object.entries(activity.byStudent || {}).forEach(([key, record]) => {
    const days = {};
    let events = 0;
    Object.entries(record.days || {}).forEach(([day, count]) => {
      if (Date.parse(day) <= cutoff) { days[day] = count; events += count; }
    });
    const stamps = Object.keys(days).map(day => Date.parse(day));
    byStudent[key] = {
      ...record,
      days,
      events,
      firstAccess: stamps.length ? Math.min(...stamps) : null,
      lastAccess: stamps.length ? Math.max(...stamps) : null
    };
  });
  return { ...activity, byStudent };
}

/** Data de corte da janela "início", ou `null` se a turma não tem período. */
function earlyCutoff(period) {
  if (!period) return null;
  return period.start + (period.end - period.start) * EARLY_WINDOW_SHARE;
}

// ---------------------------------------------------------------------------
// Associação
// ---------------------------------------------------------------------------

/**
 * @param {object[]} sources  uma entrada por turma: { turma, indicators, values }
 *                            — `indicators` é a saída de `computeIndicators` da
 *                            própria turma, `values` o desfecho por aluno dela
 * @param {object} outcome    o desfecho consolidado (tipo, fonte, corte)
 * @param {object} options    { scopeId, window }
 *
 * Os pares de todas as turmas entram **na mesma conta**: com 40 alunos por
 * turma, quase todo indicador cairia no "inconclusivo", e empilhar semestres é o
 * que tira a análise desse território. O que fica visível é o `n` de cada turma,
 * porque um coeficiente sustentado por uma turma só não é um achado da
 * disciplina — é um achado daquela turma.
 */
function computeAssociation(sources, outcome, { scopeId, window = 'full' } = {}) {
  const warnings = [...(outcome.warnings || [])];

  // A tautologia da evasão: recusar é mais honesto do que exibir com ressalva.
  const tautological = outcome.kind === 'dropout' && window === 'full';
  if (tautological) {
    warnings.push(
      'Evasão medida sobre o período inteiro é tautológica: quem saiu na terceira semana '
      + 'tem poucos dias ativos porque saiu. Escolha a janela "início do período".'
    );
  }

  // Uma linha por aluno **por turma**: o mesmo aluno em dois semestres são duas
  // observações de dois períodos, não uma medida repetida a ser mediada.
  const rows = sources.flatMap(source => (source.indicators.students || [])
    .map(row => ({ ...row, turma: source.turma, outcome: source.values.get(studentKeyOf(row)) })));

  const studentsWithOutcome = rows.filter(row => row.outcome !== null && row.outcome !== undefined).length;

  const repeated = new Map();
  rows.forEach(row => {
    const identity = row.email || row.folderName || row.name;
    if (identity) repeated.set(identity, (repeated.get(identity) || 0) + 1);
  });
  const repeatedCount = [...repeated.values()].filter(count => count > 1).length;
  if (repeatedCount) {
    warnings.push(
      `${repeatedCount} aluno(s) aparecem em mais de uma turma da seleção. `
      + 'As duas passagens entram como observações separadas, que é o que elas são — '
      + 'mas não são independentes entre si.'
    );
  }

  const results = [];

  DIMENSIONS.forEach(dimension => {
    const keys = Object.keys(rows[0]?.dimensions?.[dimension] || {});
    keys.forEach(key => {
      const pairs = [];
      const byTurma = {};
      let droppedIndicator = 0;
      let droppedOutcome = 0;

      rows.forEach(row => {
        const indicator = row.dimensions[dimension][key];
        const target = row.outcome;
        const hasOutcome = target !== null && target !== undefined;
        const hasIndicator = indicator?.available && indicator.value !== null;

        if (!hasOutcome) { droppedOutcome += 1; return; }
        if (!hasIndicator) { droppedIndicator += 1; return; }
        byTurma[row.turma] = (byTurma[row.turma] || 0) + 1;
        // O nome viaja junto para a dispersão: ver que três pontos carregam o
        // coeficiente inteiro é o antídoto mais barato contra ler r como lei.
        pairs.push({ x: indicator.value, y: target, label: row.name });
      });

      const coverage = studentsWithOutcome ? pairs.length / studentsWithOutcome : 0;
      const family = familyOf(key, outcome);
      const shell = {
        key,
        dimension,
        family,
        coverage: Math.round(coverage * 1000) / 10,
        byTurma,
        partialCoverage: coverage < PARTIAL_COVERAGE,
        droppedIndicator,
        droppedOutcome,
        tautological
      };

      if (tautological) {
        results.push({ ...shell, status: 'tautology', n: pairs.length, value: null, ci: null, width: null });
        return;
      }
      // Indicador que não existe para ninguém não é "medido em poucos alunos":
      // é medida ausente, e o motivo é outro (sem logs, sem histórico, sem
      // taxonomia). Confundir os dois manda o professor procurar mais alunos
      // quando o que falta é a fonte.
      if (pairs.length === 0 && droppedIndicator > 0) {
        results.push({ ...shell, status: 'indicatorUnavailable', n: 0, value: null, ci: null, width: null });
        return;
      }
      if (coverage < MIN_COVERAGE) {
        results.push({ ...shell, status: 'lowCoverage', n: pairs.length, value: null, ci: null, width: null });
        return;
      }

      const stats = associate({
        x: pairs.map(pair => pair.x),
        y: pairs.map(pair => pair.y),
        binary: outcome.binary,
        // Semente estável: o mesmo indicador da mesma turma devolve o mesmo
        // intervalo em toda recarga. Intervalo que dança a cada F5 destrói a
        // confiança mais rápido do que intervalo largo.
        seed: `${scopeId}|${key}|${outcome.kind}|${outcome.source}|${window}|${pairs.length}`
      });

      results.push({
        ...shell,
        ...stats,
        width: intervalWidth(stats.ci),
        direction: stats.value === null ? null : (stats.value >= 0 ? 'positive' : 'negative'),
        points: stats.status === 'ok' ? pairs : []
      });
    });
  });

  // Blocos por família — nunca uma lista única ordenada. Dentro do bloco, a
  // ordem é por |valor|, com o aviso de que ela vale só para esta turma.
  const blocks = FAMILY_ORDER.map(family => ({
    family,
    indicators: results
      .filter(result => result.family === family)
      .sort((a, b) => Math.abs(b.value ?? -1) - Math.abs(a.value ?? -1))
  })).filter(block => block.indicators.length > 0);

  return {
    window,
    measure: outcome.binary ? 'cliffsDelta' : 'spearman',
    outcome: {
      kind: outcome.kind,
      source: outcome.source,
      cut: outcome.cut,
      vplWeight: outcome.vplWeight,
      independence: outcome.independence,
      defined: outcome.defined,
      total: outcome.total,
      binary: outcome.binary
    },
    studentsWithOutcome,
    blocks,
    thresholds: {
      minPairs: MIN_PAIRS,
      smallSample: SMALL_SAMPLE,
      minCoverage: Math.round(MIN_COVERAGE * 100),
      partialCoverage: Math.round(PARTIAL_COVERAGE * 100)
    },
    turmas: sources.map(source => source.turma),
    warnings
  };
}

module.exports = {
  computeAssociation,
  truncateDataset,
  truncateActivity,
  earlyCutoff,
  familyOf,
  FAMILY,
  FAMILY_ORDER,
  EARLY_WINDOW_SHARE
};
