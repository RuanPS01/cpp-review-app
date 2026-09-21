// As cinco dimensões da proposta de analytics, por aluno.
//
// Função pura sobre o dataset de estatísticas, a atividade coletada (opcional)
// e o domínio conceitual da Fase 1.
//
// Regra que atravessa o arquivo, herdada da Fase 1: **ausência de medida nunca
// vira zero**. Cada indicador carrega `value`, `n` e, quando indisponível, o
// motivo. Um aluno que não entregou não tem antecedência nem ganho — isso é
// `null`. Imputar zero transformaria ausência em desempenho ruim e
// contaminaria qualquer comparação feita depois.

const { mean, median, round, rate, PASS_THRESHOLD } = require('../statistics/statistics.service');

const DAY_MS = 86400000;
const HOUR_MS = 3600000;

/** Motivos de indisponibilidade, para a tela explicar em vez de mostrar zero. */
const UNAVAILABLE = {
  NO_LOGS: 'noLogs',
  NO_HISTORY: 'noHistory',
  NO_SUBMISSION: 'noSubmission',
  NO_TAXONOMY: 'noTaxonomy',
  NO_DEADLINE: 'noDeadline'
};

/**
 * `reason` sobrevive ao valor presente de propósito. Quando o indicador foi
 * medido por uma fonte mais pobre — dias com atividade tirados das datas de
 * entrega porque não há logs —, o número existe, mas não é o número que o
 * rótulo promete. A tela mostra o valor e a ressalva junto; engolir a ressalva
 * seria apresentar proxy como medida.
 */
const indicator = (value, n, reason = null) => (
  value === null || value === undefined || Number.isNaN(value)
    ? { value: null, n: n ?? 0, available: false, reason }
    : { value: round(value, 2), n: n ?? 0, available: true, reason }
);

const DIMENSIONS = ['engagement', 'regularity', 'persistence', 'learning', 'selfRegulation'];

// ---------------------------------------------------------------------------
// Auxiliares temporais
// ---------------------------------------------------------------------------

const dayKey = (timestamp) => new Date(timestamp).toISOString().slice(0, 10);

/** Intervalos, em dias, entre dias ativos consecutivos. */
function gapsBetween(days) {
  const sorted = [...days].sort();
  const gaps = [];
  for (let i = 1; i < sorted.length; i++) {
    gaps.push((Date.parse(sorted[i]) - Date.parse(sorted[i - 1])) / DAY_MS);
  }
  return gaps;
}

/** Janela do período letivo coberto pela turma, para normalizar semanas. */
function coursePeriod(dataset) {
  const dates = (dataset.questions || [])
    .flatMap(q => [q.startDate, q.dueDate])
    .filter(Boolean);
  if (!dates.length) return null;
  return { start: Math.min(...dates), end: Math.max(...dates) };
}

// ---------------------------------------------------------------------------
// Trajetória de tentativas
// ---------------------------------------------------------------------------

/**
 * Lê a trajetória de uma questão a partir de `history[]`.
 *
 * Deliberadamente **sem regressão linear**: com 2 a 8 pontos, uma reta
 * ajustada sugere um rigor que os dados não têm. Primeira nota, última nota,
 * ganho e "chegou a passar" são interpretáveis e bastam para separar força
 * bruta de persistência produtiva.
 */
function readTrajectory(submission, maxGrade) {
  const history = (submission?.history || []).filter(entry => typeof entry.grade === 'number');
  if (history.length < 2) return null;

  const toPercent = (grade) => Math.max(0, Math.min(100, (grade / (maxGrade || 10)) * 100));
  const percents = history.map(entry => toPercent(entry.grade));
  const first = percents[0];
  const last = percents[percents.length - 1];
  const best = Math.max(...percents);
  const passedAt = percents.findIndex(value => value >= PASS_THRESHOLD);

  return {
    attempts: history.length,
    first: round(first),
    last: round(last),
    best: round(best),
    gain: round(last - first),
    passed: passedAt !== -1,
    attemptsToPass: passedAt === -1 ? null : passedAt + 1,
    // Parou de tentar sem passar, e a última tentativa não foi a melhor:
    // sinal de desistência, não de teto atingido.
    stalled: passedAt === -1 && last < best,
    percents
  };
}

function trajectories(student, dataset) {
  const questionByKey = new Map((dataset.questions || []).map(q => [q.key, q]));
  return Object.entries(student.questions || {})
    .map(([key, submission]) => {
      const trajectory = readTrajectory(submission, questionByKey.get(key)?.maxGrade);
      return trajectory ? { key, name: questionByKey.get(key)?.name || key, ...trajectory } : null;
    })
    .filter(Boolean);
}

// ---------------------------------------------------------------------------
// Dimensões
// ---------------------------------------------------------------------------

function buildEngagement(student, activity, dataset, period) {
  const access = activity?.byStudent?.[String(student.userId)] || null;
  const submissionDays = Object.values(student.questions || {})
    .filter(s => s?.submittedAt)
    .map(s => dayKey(s.submittedAt));

  // Sem logs, "dias com atividade" cai para os dias em que houve entrega —
  // que é um proxy mais pobre, e a tela precisa dizer isso.
  const activeDays = access ? Object.keys(access.days) : [...new Set(submissionDays)];
  const weeks = period ? Math.max(1, (period.end - period.start) / (7 * DAY_MS)) : null;

  return {
    activeDays: indicator(activeDays.length, activeDays.length, access ? null : UNAVAILABLE.NO_LOGS),
    eventsPerWeek: access && weeks
      ? indicator(access.events / weeks, access.events)
      : indicator(null, 0, UNAVAILABLE.NO_LOGS),
    activitiesViewed: access
      ? indicator(access.viewedActivities.length, access.viewedActivities.length)
      : indicator(null, 0, UNAVAILABLE.NO_LOGS),
    submissionRate: indicator(
      rate(Object.values(student.questions || {}).filter(s => s?.submitted).length, (dataset.questions || []).length),
      (dataset.questions || []).length
    ),
    _activeDays: activeDays,
    _fromLogs: Boolean(access)
  };
}

function buildRegularity(engagement, period) {
  const days = engagement._activeDays;
  const gaps = gapsBetween(days);
  const reason = engagement._fromLogs ? null : UNAVAILABLE.NO_LOGS;

  // Numerador e denominador têm de usar o mesmo balde de semana, e só as
  // semanas DO PERÍODO contam: atividade fora da janela do curso rendia mais
  // semanas ativas do que o curso tem, e a razão passava de 100%.
  const weekOf = (ms) => Math.floor(ms / (7 * DAY_MS));
  const firstWeek = period ? weekOf(period.start) : null;
  const lastWeek = period ? weekOf(period.end) : null;
  const totalWeeks = period ? lastWeek - firstWeek + 1 : null;
  const activeWeeks = period
    ? new Set(days
      .map(day => weekOf(Date.parse(day)))
      .filter(week => week >= firstWeek && week <= lastWeek)).size
    : 0;

  return {
    // Mediana, não média: um aluno que sumiu 40 dias destrói a média e não
    // move a mediana.
    medianGapDays: gaps.length
      ? indicator(median(gaps), gaps.length, reason)
      : indicator(null, 0, reason || UNAVAILABLE.NO_SUBMISSION),
    longestSilenceDays: gaps.length
      ? indicator(Math.max(...gaps), gaps.length, reason)
      : indicator(null, 0, reason || UNAVAILABLE.NO_SUBMISSION),
    activeWeeksRatio: totalWeeks
      ? indicator(rate(activeWeeks, totalWeeks), activeWeeks, reason)
      : indicator(null, 0, UNAVAILABLE.NO_DEADLINE)
  };
}

function buildPersistence(student, dataset) {
  const paths = trajectories(student, dataset);
  if (!paths.length) {
    const empty = indicator(null, 0, UNAVAILABLE.NO_HISTORY);
    return {
      attemptsToFirstPass: empty,
      gainFirstToLast: empty,
      recoveryRate: empty,
      stalledCount: empty,
      _trajectories: []
    };
  }

  const toPass = paths.map(p => p.attemptsToPass).filter(v => v !== null);
  const startedLow = paths.filter(p => p.first < PASS_THRESHOLD).length;
  const recovered = paths.filter(p => p.first < PASS_THRESHOLD && p.last >= PASS_THRESHOLD).length;

  return {
    attemptsToFirstPass: toPass.length
      ? indicator(mean(toPass), toPass.length)
      : indicator(null, 0, UNAVAILABLE.NO_SUBMISSION),
    gainFirstToLast: indicator(mean(paths.map(p => p.gain)), paths.length),
    recoveryRate: startedLow
      ? indicator(rate(recovered, startedLow), startedLow)
      : indicator(null, 0, UNAVAILABLE.NO_SUBMISSION),
    stalledCount: indicator(paths.filter(p => p.stalled).length, paths.length),
    _trajectories: paths
  };
}

function buildLearning(student, dataset, masteryStudent, masteryTopics) {
  const paths = trajectories(student, dataset);
  const firstAttemptPassRate = paths.length
    ? indicator(rate(paths.filter(p => p.first >= PASS_THRESHOLD).length, paths.length), paths.length)
    : indicator(null, 0, UNAVAILABLE.NO_HISTORY);

  if (!masteryStudent) {
    const noTaxonomy = indicator(null, 0, UNAVAILABLE.NO_TAXONOMY);
    return { avgMastery: noTaxonomy, gapTopics: noTaxonomy, firstAttemptPassRate };
  }

  const measured = (masteryTopics || [])
    .map(topic => masteryStudent.topics[topic.code])
    .filter(result => result && result.mastery !== null);

  return {
    avgMastery: measured.length
      ? indicator(mean(measured.map(r => r.mastery)), measured.length)
      : indicator(null, 0, UNAVAILABLE.NO_SUBMISSION),
    gapTopics: measured.length
      ? indicator(measured.filter(r => r.status === 'gap').length, measured.length)
      : indicator(null, 0, UNAVAILABLE.NO_SUBMISSION),
    firstAttemptPassRate
  };
}

function buildSelfRegulation(student, dataset, engagement) {
  const questionByKey = new Map((dataset.questions || []).map(q => [q.key, q]));
  const leads = [];
  let lastMinute = 0;
  let withDeadline = 0;

  Object.entries(student.questions || {}).forEach(([key, submission]) => {
    if (!submission?.submitted || !submission.submittedAt) return;
    const dueDate = questionByKey.get(key)?.dueDate;
    if (!dueDate) return;
    withDeadline += 1;
    const hours = (dueDate - submission.submittedAt) / HOUR_MS;
    leads.push(hours);
    if (hours < 1) lastMinute += 1;
  });

  // Dias ativos que não são véspera de prazo: prática distribuída em vez de
  // concentrada na última hora.
  const deadlineDays = new Set((dataset.questions || [])
    .filter(q => q.dueDate)
    .map(q => dayKey(q.dueDate)));
  const spread = engagement._activeDays.filter(day => !deadlineDays.has(day)).length;

  return {
    medianLeadHours: leads.length
      ? indicator(median(leads), leads.length)
      : indicator(null, 0, UNAVAILABLE.NO_SUBMISSION),
    lastMinuteRate: withDeadline
      ? indicator(rate(lastMinute, withDeadline), withDeadline)
      : indicator(null, 0, UNAVAILABLE.NO_DEADLINE),
    distributedPractice: engagement._activeDays.length
      ? indicator(rate(spread, engagement._activeDays.length), engagement._activeDays.length,
        engagement._fromLogs ? null : UNAVAILABLE.NO_LOGS)
      : indicator(null, 0, UNAVAILABLE.NO_SUBMISSION)
  };
}

// ---------------------------------------------------------------------------
// Posição relativa na turma
// ---------------------------------------------------------------------------

/**
 * Percentil de um valor dentro da turma. É **posição relativa**, não nota
 * absoluta: um 80 numa turma fraca não significa o mesmo que numa turma forte,
 * e a interface precisa dizer isso.
 */
function percentileOf(value, population) {
  const values = population.filter(v => typeof v === 'number' && Number.isFinite(v));
  if (!values.length || typeof value !== 'number') return null;
  const below = values.filter(v => v < value).length;
  const equal = values.filter(v => v === value).length;
  return round(((below + equal / 2) / values.length) * 100);
}

/** Indicadores em que "menos é melhor" entram invertidos no score. */
const INVERTED = new Set([
  'medianGapDays', 'longestSilenceDays', 'stalledCount', 'gapTopics',
  'lastMinuteRate', 'attemptsToFirstPass'
]);

function computeIndicators(dataset, activity, mastery) {
  const period = coursePeriod(dataset);
  const masteryByUser = new Map((mastery?.students || []).map(s => [String(s.userId), s]));

  const rows = (dataset.students || []).map(student => {
    const engagement = buildEngagement(student, activity, dataset, period);
    const regularity = buildRegularity(engagement, period);
    const persistence = buildPersistence(student, dataset);
    const learning = buildLearning(student, dataset, masteryByUser.get(String(student.userId)), mastery?.topics);
    const selfRegulation = buildSelfRegulation(student, dataset, engagement);

    return {
      userId: student.userId,
      folderName: student.folderName,
      name: student.name,
      email: student.email || null,
      dimensions: { engagement, regularity, persistence, learning, selfRegulation },
      trajectories: persistence._trajectories
    };
  });

  // Score por dimensão = média dos percentis dos indicadores disponíveis.
  const populations = {};
  DIMENSIONS.forEach(dimension => {
    populations[dimension] = {};
    Object.keys(rows[0]?.dimensions?.[dimension] || {})
      .filter(key => !key.startsWith('_'))
      .forEach(key => {
        populations[dimension][key] = rows
          .map(row => row.dimensions[dimension][key])
          .filter(entry => entry?.available)
          .map(entry => entry.value);
      });
  });

  rows.forEach(row => {
    row.scores = {};
    DIMENSIONS.forEach(dimension => {
      const percentiles = Object.entries(row.dimensions[dimension])
        .filter(([key, entry]) => !key.startsWith('_') && entry?.available)
        .map(([key, entry]) => {
          const raw = percentileOf(entry.value, populations[dimension][key]);
          return raw === null ? null : (INVERTED.has(key) ? 100 - raw : raw);
        })
        .filter(value => value !== null);

      row.scores[dimension] = percentiles.length
        ? { value: round(mean(percentiles)), n: percentiles.length, available: true }
        : { value: null, n: 0, available: false };
    });

    // Campos internos não saem no payload.
    DIMENSIONS.forEach(dimension => {
      Object.keys(row.dimensions[dimension])
        .filter(key => key.startsWith('_'))
        .forEach(key => { delete row.dimensions[dimension][key]; });
    });
  });

  return {
    dimensions: DIMENSIONS,
    thresholds: { pass: PASS_THRESHOLD },
    sources: {
      logs: Boolean(activity?.sources?.logs),
      participation: Boolean(activity?.sources?.participation),
      history: Boolean(dataset.deepHistory),
      taxonomy: Boolean(mastery?.bound)
    },
    period,
    students: rows
  };
}

module.exports = { computeIndicators, readTrajectory, trajectories, UNAVAILABLE, DIMENSIONS };
