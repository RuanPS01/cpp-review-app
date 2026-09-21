// Os sete padrões de comportamento da tabela §10 da proposta de analytics.
//
// Cada padrão liga uma evidência observável a uma leitura pedagógica e a uma
// intervenção. O que o detector devolve é o aluno e a evidência; o texto da
// interpretação e da intervenção vive nas traduções, porque é conteúdo de
// interface, não de cálculo.
//
// Dois cuidados que mudam o resultado:
//
// 1. **Mínimo de 3 tentativas para classificar trajetória.** Com dois pontos
//    não há tendência, há um segmento de reta.
// 2. **O limiar de "ganho relevante" sai da própria turma** — a mediana do
//    ganho entre quem tem 3+ tentativas — e não de um número inventado. Ele é
//    devolvido no payload para aparecer na tela.

const { median, round, rate, PASS_THRESHOLD, RELEVANT_GAIN } = require('../statistics/statistics.service');
const { trajectories } = require('./indicators.service');

const MIN_ATTEMPTS_FOR_TREND = 3;
const EARLY_WEEKS = 2;
const DAY_MS = 86400000;
const PROCRASTINATION_HOURS = 6;
/**
 * Piso para o limiar de ganho, o mesmo que o score de risco usa para decidir se
 * a insistência está rendendo — os dois têm de concordar, senão a tela marca
 * "persistência produtiva" num aluno que a lista de alertas ainda penaliza.
 *
 * O limiar sai da mediana da turma, mas uma turma majoritariamente estagnada
 * rebaixa essa mediana a ponto de chamar ruído de progresso. A turma só pode
 * levantar o piso, nunca baixá-lo.
 */
const MIN_GAIN_THRESHOLD = RELEVANT_GAIN;

const PATTERN_CODES = [
  'lowEngagementEarly',
  'irregularPlusConceptGap',
  'procrastination',
  'bruteForce',
  'recurringConceptError',
  'productivePersistence',
  'earlyAbandonment'
];

/** Padrão que reconhece um comportamento desejável, e não um risco. */
const POSITIVE_PATTERNS = new Set(['productivePersistence']);

const quartile = (values, fraction) => {
  const sorted = values.filter(v => typeof v === 'number').sort((a, b) => a - b);
  if (!sorted.length) return null;
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * fraction))];
};

/**
 * @param {object} dataset  stats_{turma}.json
 * @param {object} indicators saída de computeIndicators
 * @param {object} mastery  saída de computeMastery (pode não estar vinculada)
 * @param {object} activity logs coletados (opcional)
 */
function detectPatterns(dataset, indicators, mastery, activity) {
  const students = dataset.students || [];
  const indicatorsByUser = new Map((indicators?.students || []).map(s => [String(s.userId), s]));
  const masteryByUser = new Map((mastery?.students || []).map(s => [String(s.userId), s]));

  // --- Limiar de ganho derivado da turma ---------------------------------
  const allTrajectories = students.flatMap(student => trajectories(student, dataset));
  const trending = allTrajectories.filter(path => path.attempts >= MIN_ATTEMPTS_FOR_TREND);
  const classGain = median(trending.map(path => path.gain));
  const gainThreshold = trending.length
    ? Math.max(MIN_GAIN_THRESHOLD, round(classGain ?? MIN_GAIN_THRESHOLD))
    : null;

  // --- Corte de regularidade (quartil inferior da turma) ------------------
  const silences = (indicators?.students || [])
    .map(s => s.dimensions.regularity.longestSilenceDays)
    .filter(entry => entry?.available)
    .map(entry => entry.value);
  const silenceCut = quartile(silences, 0.75);

  const period = indicators?.period || null;
  const earlyEnd = period ? period.start + EARLY_WEEKS * 7 * DAY_MS : null;

  const matches = Object.fromEntries(PATTERN_CODES.map(code => [code, []]));

  students.forEach(student => {
    const key = String(student.userId);
    const row = indicatorsByUser.get(key);
    const masteryRow = masteryByUser.get(key);
    if (!row) return;

    const paths = trajectories(student, dataset);
    const trendable = paths.filter(path => path.attempts >= MIN_ATTEMPTS_FOR_TREND);

    // 1. Baixo engajamento inicial ----------------------------------------
    if (earlyEnd) {
      const earlyActivity = activity?.byStudent?.[key]
        ? Object.keys(activity.byStudent[key].days).filter(day => Date.parse(day) <= earlyEnd).length
        : Object.values(student.questions || {})
          .filter(s => s?.submittedAt && s.submittedAt <= earlyEnd).length;

      if (earlyActivity === 0) {
        matches.lowEngagementEarly.push({
          userId: student.userId,
          name: student.name,
          evidence: { activeDaysInFirstWeeks: 0, weeks: EARLY_WEEKS, fromLogs: Boolean(activity?.byStudent?.[key]) }
        });
      }
    }

    // 2. Irregularidade somada a lacuna conceitual --------------------------
    const silence = row.dimensions.regularity.longestSilenceDays;
    const gapTopics = masteryRow
      ? Object.entries(masteryRow.topics).filter(([, result]) => result.status === 'gap')
      : [];
    if (silenceCut !== null && silence?.available && silence.value >= silenceCut && gapTopics.length > 0) {
      matches.irregularPlusConceptGap.push({
        userId: student.userId,
        name: student.name,
        evidence: { longestSilenceDays: silence.value, gapTopics: gapTopics.map(([code]) => code) }
      });
    }

    // 3. Procrastinação sistemática ----------------------------------------
    const lead = row.dimensions.selfRegulation.medianLeadHours;
    const lastMinute = row.dimensions.selfRegulation.lastMinuteRate;
    if (lead?.available && lead.value < PROCRASTINATION_HOURS && lead.n >= 2) {
      matches.procrastination.push({
        userId: student.userId,
        name: student.name,
        evidence: { medianLeadHours: lead.value, lastMinuteRate: lastMinute?.value ?? null, n: lead.n }
      });
    }

    // 4 e 6. Força bruta × persistência produtiva --------------------------
    // Mesma evidência (muitas tentativas), leituras opostas conforme o ganho.
    if (gainThreshold !== null && trendable.length) {
      const bruteForce = trendable.filter(path => path.gain < gainThreshold && !path.passed);
      const productive = trendable.filter(path => path.gain >= gainThreshold);

      if (bruteForce.length) {
        matches.bruteForce.push({
          userId: student.userId,
          name: student.name,
          evidence: {
            questions: bruteForce.map(path => ({ key: path.key, name: path.name, attempts: path.attempts, gain: path.gain })),
            gainThreshold
          }
        });
      }
      if (productive.length) {
        matches.productivePersistence.push({
          userId: student.userId,
          name: student.name,
          evidence: {
            questions: productive.map(path => ({ key: path.key, name: path.name, attempts: path.attempts, gain: path.gain })),
            gainThreshold
          }
        });
      }
    }

    // 5. Erro recorrente no mesmo conceito ---------------------------------
    if (masteryRow) {
      const recurring = Object.entries(masteryRow.topics)
        .filter(([, result]) => result.status === 'gap' && result.itemCount >= 2);
      if (recurring.length) {
        matches.recurringConceptError.push({
          userId: student.userId,
          name: student.name,
          evidence: { topics: recurring.map(([code, result]) => ({ code, mastery: result.mastery, items: result.itemCount })) }
        });
      }
    }
    // Sem taxonomia, o caso de teste repetido é a evidência disponível.
    const failedCounts = new Map();
    Object.values(student.questions || {}).forEach(submission => {
      (submission?.failedCases || []).forEach(name => failedCounts.set(name, (failedCounts.get(name) || 0) + 1));
    });
    const repeatedCases = [...failedCounts.entries()].filter(([, count]) => count >= 2);
    if (!masteryRow && repeatedCases.length) {
      matches.recurringConceptError.push({
        userId: student.userId,
        name: student.name,
        evidence: { repeatedCases: repeatedCases.map(([name, count]) => ({ name, count })) }
      });
    }

    // 7. Abandono precoce ---------------------------------------------------
    const abandoned = paths.filter(path => path.attempts <= 2 && !path.passed && path.stalled);
    if (abandoned.length >= 2) {
      matches.earlyAbandonment.push({
        userId: student.userId,
        name: student.name,
        evidence: { questions: abandoned.map(path => ({ key: path.key, name: path.name, attempts: path.attempts })) }
      });
    }
  });

  const patterns = PATTERN_CODES.map(code => ({
    code,
    positive: POSITIVE_PATTERNS.has(code),
    students: matches[code],
    count: matches[code].length,
    rate: rate(matches[code].length, students.length)
  }));

  return {
    patterns,
    thresholds: {
      gainThreshold,
      minAttemptsForTrend: MIN_ATTEMPTS_FOR_TREND,
      procrastinationHours: PROCRASTINATION_HOURS,
      silenceCutDays: silenceCut,
      passThreshold: PASS_THRESHOLD,
      earlyWeeks: EARLY_WEEKS
    },
    availability: {
      history: Boolean(dataset.deepHistory) && allTrajectories.length > 0,
      taxonomy: Boolean(mastery?.bound),
      logs: Boolean(activity?.sources?.logs),
      period: Boolean(period)
    },
    totalStudents: students.length
  };
}

module.exports = { detectPatterns, PATTERN_CODES, POSITIVE_PATTERNS };
