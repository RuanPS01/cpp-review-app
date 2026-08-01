// Motor de métricas: transforma o dataset bruto importado do Moodle em números
// prontos para a tela de Estatísticas. Nenhuma chamada de rede acontece aqui —
// é uma função pura sobre o JSON salvo em disco, o que torna o recálculo barato
// e permite reprocessar importações antigas quando as regras mudam.

const fs = require('fs');
const path = require('path');
const { DATA_DIR } = require('../../config/env');
const { CONCEPT_LABELS, SMELL_LABELS } = require('./codeMetrics');

const PASS_THRESHOLD = 60;       // % da nota máxima considerada aprovação
const HOUR_MS = 60 * 60 * 1000;

// ---------------------------------------------------------------------------
// Estatística básica
// ---------------------------------------------------------------------------

const numeric = (values) => values.filter(v => typeof v === 'number' && Number.isFinite(v));

function mean(values) {
  const list = numeric(values);
  if (!list.length) return null;
  return list.reduce((acc, v) => acc + v, 0) / list.length;
}

function median(values) {
  const list = numeric(values).sort((a, b) => a - b);
  if (!list.length) return null;
  const middle = Math.floor(list.length / 2);
  return list.length % 2 ? list[middle] : (list[middle - 1] + list[middle]) / 2;
}

function stdDev(values) {
  const list = numeric(values);
  if (list.length < 2) return null;
  const avg = mean(list);
  const variance = list.reduce((acc, v) => acc + (v - avg) ** 2, 0) / (list.length - 1);
  return Math.sqrt(variance);
}

function round(value, decimals = 1) {
  if (value === null || value === undefined || !Number.isFinite(value)) return null;
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function rate(part, total) {
  if (!total) return 0;
  return round((part / total) * 100, 1);
}

/** Histograma em faixas de 10% sobre a nota percentual. */
function gradeHistogram(percentages) {
  const bins = Array.from({ length: 10 }, (_, i) => ({
    label: `${i * 10}–${(i + 1) * 10}%`,
    from: i * 10,
    to: (i + 1) * 10,
    count: 0
  }));
  numeric(percentages).forEach(value => {
    const index = Math.min(9, Math.max(0, Math.floor(value / 10)));
    bins[index].count += 1;
  });
  return bins;
}

function topCounts(items, limit = 8) {
  const counter = new Map();
  items.forEach(item => {
    const key = String(item).trim();
    if (!key) return;
    counter.set(key, (counter.get(key) || 0) + 1);
  });
  return [...counter.entries()]
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}

// ---------------------------------------------------------------------------
// Acesso ao dataset
// ---------------------------------------------------------------------------

const normalizeKey = (text) => String(text || '')
  .toLowerCase()
  .normalize('NFD')
  .replace(/[̀-ͯ]/g, '')
  .replace(/\s+/g, ' ')
  .trim();

function questionMaxGrade(question) {
  return question.maxGrade && question.maxGrade > 0 ? question.maxGrade : 10;
}

function submissionPercent(submission, question) {
  if (!submission || submission.grade === null || submission.grade === undefined) return null;
  const max = questionMaxGrade(question);
  return Math.max(0, Math.min(100, (submission.grade / max) * 100));
}

// ---------------------------------------------------------------------------
// Métricas por questão
// ---------------------------------------------------------------------------

function buildQuestionMetrics(dataset) {
  const students = dataset.students || [];

  return (dataset.questions || []).map(question => {
    const submissions = students
      .map(student => student.questions?.[question.key])
      .filter(Boolean);

    const submitted = submissions.filter(s => s.submitted);
    const percentages = submitted.map(s => submissionPercent(s, question)).filter(v => v !== null);
    const attempts = submitted.map(s => s.attempts).filter(v => typeof v === 'number' && v > 0);
    const codeLines = submitted.map(s => s.codeMetrics?.codeLines).filter(v => typeof v === 'number');

    const avgPercent = mean(percentages);
    const passCount = percentages.filter(v => v >= PASS_THRESHOLD).length;
    const zeroCount = percentages.filter(v => v === 0).length;
    const perfectCount = percentages.filter(v => v >= 99.99).length;
    const compileErrors = submitted.filter(s => s.hasCompileError).length;
    const lateCount = submitted.filter(s => s.late).length;

    const conceptUsage = {};
    Object.keys(CONCEPT_LABELS).forEach(key => {
      const withMetrics = submitted.filter(s => s.codeMetrics);
      conceptUsage[key] = {
        label: CONCEPT_LABELS[key],
        count: withMetrics.filter(s => s.codeMetrics.concepts?.[key]).length,
        total: withMetrics.length
      };
    });

    return {
      key: question.key,
      cmid: question.cmid,
      name: question.name,
      maxGrade: questionMaxGrade(question),
      startDate: question.startDate ?? null,
      dueDate: question.dueDate ?? null,
      testCaseCount: (question.testCases || []).length,
      hasStatement: Boolean(question.statement),
      expected: students.length,
      submittedCount: submitted.length,
      submissionRate: rate(submitted.length, students.length),
      gradedCount: percentages.length,
      avgPercent: round(avgPercent),
      medianPercent: round(median(percentages)),
      stdDevPercent: round(stdDev(percentages)),
      minPercent: percentages.length ? round(Math.min(...percentages)) : null,
      maxPercent: percentages.length ? round(Math.max(...percentages)) : null,
      passRate: rate(passCount, percentages.length),
      zeroCount,
      perfectCount,
      // Índice de dificuldade: 0 = todos acertaram, 100 = ninguém acertou.
      // Quem não entregou conta como dificuldade, senão a questão que ninguém
      // tentou pareceria fácil.
      difficultyIndex: students.length
        ? round(100 - ((avgPercent ?? 0) * submitted.length) / students.length, 1)
        : null,
      avgAttempts: round(mean(attempts), 2),
      maxAttempts: attempts.length ? Math.max(...attempts) : null,
      avgCodeLines: round(mean(codeLines), 1),
      compileErrorCount: compileErrors,
      compileErrorRate: rate(compileErrors, submitted.length),
      lateCount,
      lateRate: rate(lateCount, submitted.length),
      histogram: gradeHistogram(percentages),
      topFailedCases: topCounts(submitted.flatMap(s => s.failedCases || [])),
      topCompileErrors: topCounts(submitted.flatMap(s => s.compileErrors || [])),
      conceptUsage
    };
  });
}

// ---------------------------------------------------------------------------
// Risco por aluno
// ---------------------------------------------------------------------------

/**
 * Combina entrega, desempenho, atraso e esforço em um único score 0–100.
 * Cada parcela devolve também o motivo em texto, para que o alerta na tela
 * explique *por que* o aluno foi sinalizado em vez de mostrar só um número.
 */
function computeRisk({ missingRatio, avgPercent, submittedCount, lateRatio, attempts, questionCount }) {
  const reasons = [];
  let score = 0;

  if (submittedCount === 0) {
    // Nenhuma entrega é o pior cenário possível: entra direto como crítico.
    score += 60;
    reasons.push({ code: 'noSubmission', weight: 60 });
  } else if (missingRatio > 0) {
    const points = Math.round(missingRatio * 45);
    score += points;
    reasons.push({ code: 'missingSubmissions', weight: points, value: Math.round(missingRatio * questionCount) });
  }

  if (avgPercent !== null && submittedCount > 0 && avgPercent < PASS_THRESHOLD) {
    const points = Math.round(((PASS_THRESHOLD - avgPercent) / PASS_THRESHOLD) * 40);
    score += points;
    reasons.push({ code: 'lowGrades', weight: points, value: round(avgPercent) });
  }

  if (lateRatio > 0) {
    const points = Math.round(lateRatio * 10);
    score += points;
    reasons.push({ code: 'lateSubmissions', weight: points, value: round(lateRatio * 100, 0) });
  }

  // Muitas tentativas com nota baixa indica esforço sem progresso — sinal
  // pedagógico diferente de simplesmente não entregar.
  if (attempts >= 8 && avgPercent !== null && avgPercent < PASS_THRESHOLD) {
    score += 8;
    reasons.push({ code: 'strugglingEffort', weight: 8, value: attempts });
  }

  score = Math.max(0, Math.min(100, score));
  const level = score >= 60 ? 'critical' : score >= 40 ? 'high' : score >= 20 ? 'medium' : 'low';
  return { score, level, reasons: reasons.sort((a, b) => b.weight - a.weight) };
}

function buildStudentMetrics(dataset) {
  const questions = dataset.questions || [];
  const questionByKey = new Map(questions.map(q => [q.key, q]));

  return (dataset.students || []).map(student => {
    const perQuestion = questions.map(question => {
      const submission = student.questions?.[question.key];
      const percent = submissionPercent(submission, question);
      return {
        key: question.key,
        name: question.name,
        submitted: Boolean(submission?.submitted),
        submittedAt: submission?.submittedAt ?? null,
        attempts: submission?.attempts ?? null,
        grade: submission?.grade ?? null,
        percent: round(percent),
        late: Boolean(submission?.late),
        hasCompileError: Boolean(submission?.hasCompileError),
        failedCases: submission?.failedCases || [],
        codeLines: submission?.codeMetrics?.codeLines ?? null,
        hasCode: Boolean(submission?.code || submission?.codeMetrics)
      };
    });

    const submitted = perQuestion.filter(q => q.submitted);
    const percentages = perQuestion.map(q => q.percent).filter(v => v !== null);
    const attemptsTotal = submitted.reduce((acc, q) => acc + (q.attempts || 1), 0);
    const lateCount = submitted.filter(q => q.late).length;
    const submissionTimes = submitted.map(q => q.submittedAt).filter(Boolean);

    const missingRatio = questions.length ? (questions.length - submitted.length) / questions.length : 0;
    const avgPercent = mean(percentages);

    const risk = computeRisk({
      missingRatio,
      avgPercent: avgPercent ?? null,
      submittedCount: submitted.length,
      lateRatio: submitted.length ? lateCount / submitted.length : 0,
      attempts: attemptsTotal,
      questionCount: questions.length
    });

    const conceptsUsed = {};
    Object.keys(CONCEPT_LABELS).forEach(key => {
      conceptsUsed[key] = questions.some(q => student.questions?.[q.key]?.codeMetrics?.concepts?.[key]);
    });

    return {
      userId: student.userId,
      folderName: student.folderName,
      name: student.name,
      email: student.email || null,
      username: student.username || null,
      groups: student.groups || [],
      lastAccess: student.lastAccess ?? null,
      lastCourseAccess: student.lastCourseAccess ?? null,
      submittedCount: submitted.length,
      missingCount: questions.length - submitted.length,
      submissionRate: rate(submitted.length, questions.length),
      avgPercent: round(avgPercent),
      bestPercent: percentages.length ? round(Math.max(...percentages)) : null,
      worstPercent: percentages.length ? round(Math.min(...percentages)) : null,
      totalAttempts: attemptsTotal,
      lateCount,
      compileErrorCount: submitted.filter(q => q.hasCompileError).length,
      firstSubmissionAt: submissionTimes.length ? Math.min(...submissionTimes) : null,
      lastSubmissionAt: submissionTimes.length ? Math.max(...submissionTimes) : null,
      totalCodeLines: submitted.reduce((acc, q) => acc + (q.codeLines || 0), 0),
      risk,
      questions: perQuestion,
      concepts: conceptsUsed,
      questionCount: questionByKey.size
    };
  });
}

// ---------------------------------------------------------------------------
// Engajamento
// ---------------------------------------------------------------------------

const LEAD_TIME_BUCKETS = [
  { key: 'moreThan48h', label: '> 48h antes', min: 48, max: Infinity },
  { key: 'from24to48h', label: '24–48h antes', min: 24, max: 48 },
  { key: 'from6to24h', label: '6–24h antes', min: 6, max: 24 },
  { key: 'from1to6h', label: '1–6h antes', min: 1, max: 6 },
  { key: 'lastHour', label: 'última hora', min: 0, max: 1 },
  { key: 'late', label: 'após o prazo', min: -Infinity, max: 0 }
];

function buildEngagement(dataset, studentMetrics) {
  const questions = dataset.questions || [];
  const questionByKey = new Map(questions.map(q => [q.key, q]));

  const byHour = Array.from({ length: 24 }, (_, hour) => ({ hour, count: 0 }));
  const byWeekday = Array.from({ length: 7 }, (_, day) => ({ day, count: 0 }));
  // Matriz dia-da-semana × hora: mostra *quando* a turma programa, algo que os
  // dois histogramas separados escondem (ex.: "domingo à noite").
  const heatmap = Array.from({ length: 7 }, () => Array.from({ length: 24 }, () => 0));
  const byDay = new Map();
  const leadTimes = LEAD_TIME_BUCKETS.map(bucket => ({ ...bucket, count: 0 }));
  const attemptsBuckets = [
    { key: '1', label: '1', count: 0 },
    { key: '2', label: '2', count: 0 },
    { key: '3', label: '3', count: 0 },
    { key: '4-5', label: '4–5', count: 0 },
    { key: '6-10', label: '6–10', count: 0 },
    { key: '10+', label: '> 10', count: 0 }
  ];

  let totalSubmissions = 0;
  let datedSubmissions = 0;

  (dataset.students || []).forEach(student => {
    Object.entries(student.questions || {}).forEach(([key, submission]) => {
      if (!submission?.submitted) return;
      totalSubmissions += 1;

      const attempts = submission.attempts || 1;
      const bucket = attempts <= 1 ? attemptsBuckets[0]
        : attempts === 2 ? attemptsBuckets[1]
        : attempts === 3 ? attemptsBuckets[2]
        : attempts <= 5 ? attemptsBuckets[3]
        : attempts <= 10 ? attemptsBuckets[4]
        : attemptsBuckets[5];
      bucket.count += 1;

      const timestamps = (submission.history || []).map(h => h.submittedAt).filter(Boolean);
      if (submission.submittedAt) timestamps.push(submission.submittedAt);

      [...new Set(timestamps)].forEach(timestamp => {
        const date = new Date(timestamp);
        if (Number.isNaN(date.getTime())) return;
        datedSubmissions += 1;
        byHour[date.getHours()].count += 1;
        byWeekday[date.getDay()].count += 1;
        heatmap[date.getDay()][date.getHours()] += 1;
        const dayKey = date.toISOString().slice(0, 10);
        byDay.set(dayKey, (byDay.get(dayKey) || 0) + 1);
      });

      const dueDate = questionByKey.get(key)?.dueDate;
      if (dueDate && submission.submittedAt) {
        const hoursBefore = (dueDate - submission.submittedAt) / HOUR_MS;
        const target = leadTimes.find(b => hoursBefore >= b.min && hoursBefore < b.max) || leadTimes[leadTimes.length - 1];
        target.count += 1;
      }
    });
  });

  const timeline = [...byDay.entries()]
    .map(([date, count]) => ({ date, count }))
    .sort((a, b) => a.date.localeCompare(b.date));

  const activeStudents = studentMetrics.filter(s => s.submittedCount > 0).length;
  const peakHour = byHour.reduce((best, current) => (current.count > best.count ? current : best), byHour[0]);

  return {
    totalSubmissions,
    datedSubmissions,
    activeStudents,
    inactiveStudents: studentMetrics.length - activeStudents,
    avgAttemptsPerSubmission: round(
      mean(
        (dataset.students || []).flatMap(s =>
          Object.values(s.questions || {}).filter(q => q?.submitted).map(q => q.attempts || 1)
        )
      ),
      2
    ),
    byHour,
    byWeekday,
    heatmap,
    timeline,
    leadTimes,
    attemptsBuckets,
    peakHour: peakHour.count > 0 ? peakHour.hour : null,
    lastActivityAt: studentMetrics.reduce(
      (latest, s) => (s.lastSubmissionAt && s.lastSubmissionAt > (latest || 0) ? s.lastSubmissionAt : latest),
      null
    )
  };
}

// ---------------------------------------------------------------------------
// Cruzamento com as notas dadas pelo professor (turma de correção homônima)
// ---------------------------------------------------------------------------

function loadProfessorGrades(turma) {
  const filePath = path.join(DATA_DIR, `grades_turma_${turma}.json`);
  if (!fs.existsSync(filePath)) return null;
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (err) {
    console.error('[statistics] Failed to read professor grades:', err.message);
    return null;
  }
}

function buildProfessorComparison(dataset, studentMetrics) {
  const grades = loadProfessorGrades(dataset.turma);
  if (!grades || !grades.length) return null;

  const byEmail = new Map();
  const byName = new Map();
  grades.forEach(entry => {
    if (entry.email) byEmail.set(normalizeKey(entry.email), entry);
    if (entry.name) byName.set(normalizeKey(entry.name), entry);
  });

  const rows = [];
  studentMetrics.forEach(student => {
    const match = (student.email && byEmail.get(normalizeKey(student.email)))
      || (student.name && byName.get(normalizeKey(student.name)));
    if (!match) return;

    const scores = Object.values(match.questions || {})
      .map(q => q?.score)
      .filter(v => typeof v === 'number' && v > 0);
    if (!scores.length) return;

    const professorAvg = mean(scores);
    if (professorAvg === null || student.avgPercent === null) return;

    rows.push({
      userId: student.userId,
      name: student.name,
      professorAvg: round(professorAvg),
      automaticAvg: student.avgPercent,
      delta: round(professorAvg - student.avgPercent)
    });
  });

  if (!rows.length) return null;

  const deltas = rows.map(r => r.delta);
  return {
    matchedStudents: rows.length,
    avgDelta: round(mean(deltas)),
    biggestDivergences: [...rows].sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta)).slice(0, 10),
    rows
  };
}

// ---------------------------------------------------------------------------
// Agregado principal
// ---------------------------------------------------------------------------

function computeMetrics(dataset) {
  const questionMetrics = buildQuestionMetrics(dataset);
  const studentMetrics = buildStudentMetrics(dataset);
  const engagement = buildEngagement(dataset, studentMetrics);

  const allPercentages = studentMetrics.flatMap(s => s.questions.map(q => q.percent)).filter(v => v !== null);
  const studentAverages = studentMetrics.map(s => s.avgPercent).filter(v => v !== null);
  const expectedSubmissions = studentMetrics.length * (dataset.questions || []).length;
  const actualSubmissions = studentMetrics.reduce((acc, s) => acc + s.submittedCount, 0);

  const sortedByDifficulty = [...questionMetrics]
    .filter(q => q.difficultyIndex !== null)
    .sort((a, b) => b.difficultyIndex - a.difficultyIndex);

  const riskBuckets = { critical: 0, high: 0, medium: 0, low: 0 };
  studentMetrics.forEach(s => { riskBuckets[s.risk.level] += 1; });

  const conceptCoverage = Object.keys(CONCEPT_LABELS).map(key => {
    const withCode = studentMetrics.filter(s => s.questions.some(q => q.hasCode));
    return {
      key,
      label: CONCEPT_LABELS[key],
      count: withCode.filter(s => s.concepts[key]).length,
      total: withCode.length,
      rate: rate(withCode.filter(s => s.concepts[key]).length, withCode.length)
    };
  }).sort((a, b) => b.rate - a.rate);

  const smellCounts = Object.keys(SMELL_LABELS).map(key => {
    const submissions = (dataset.students || []).flatMap(s =>
      Object.values(s.questions || {}).filter(q => q?.codeMetrics)
    );
    const count = submissions.filter(q => q.codeMetrics.smells?.[key]).length;
    return { key, label: SMELL_LABELS[key], count, total: submissions.length, rate: rate(count, submissions.length) };
  }).sort((a, b) => b.rate - a.rate);

  const alerts = studentMetrics
    .filter(s => s.risk.level !== 'low')
    .sort((a, b) => b.risk.score - a.risk.score);

  const overview = {
    totalStudents: studentMetrics.length,
    totalQuestions: (dataset.questions || []).length,
    activeStudents: engagement.activeStudents,
    inactiveStudents: engagement.inactiveStudents,
    expectedSubmissions,
    actualSubmissions,
    submissionRate: rate(actualSubmissions, expectedSubmissions),
    avgPercent: round(mean(allPercentages)),
    medianPercent: round(median(allPercentages)),
    stdDevPercent: round(stdDev(allPercentages)),
    avgStudentPercent: round(mean(studentAverages)),
    passRate: rate(allPercentages.filter(v => v >= PASS_THRESHOLD).length, allPercentages.length),
    zeroCount: allPercentages.filter(v => v === 0).length,
    perfectCount: allPercentages.filter(v => v >= 99.99).length,
    compileErrorRate: rate(
      questionMetrics.reduce((acc, q) => acc + q.compileErrorCount, 0),
      actualSubmissions
    ),
    lateCount: questionMetrics.reduce((acc, q) => acc + q.lateCount, 0),
    lateRate: rate(questionMetrics.reduce((acc, q) => acc + q.lateCount, 0), actualSubmissions),
    hardestQuestion: sortedByDifficulty[0]
      ? { key: sortedByDifficulty[0].key, name: sortedByDifficulty[0].name, difficultyIndex: sortedByDifficulty[0].difficultyIndex }
      : null,
    easiestQuestion: sortedByDifficulty.length
      ? {
          key: sortedByDifficulty[sortedByDifficulty.length - 1].key,
          name: sortedByDifficulty[sortedByDifficulty.length - 1].name,
          difficultyIndex: sortedByDifficulty[sortedByDifficulty.length - 1].difficultyIndex
        }
      : null,
    riskBuckets,
    atRiskCount: riskBuckets.critical + riskBuckets.high,
    histogram: gradeHistogram(studentAverages),
    passThreshold: PASS_THRESHOLD
  };

  return {
    turma: dataset.turma,
    courseName: dataset.courseName,
    sectionName: dataset.sectionName,
    importedAt: dataset.importedAt,
    sources: dataset.sources || {},
    warnings: dataset.warnings || [],
    overview,
    questions: questionMetrics,
    students: studentMetrics,
    engagement,
    alerts,
    conceptCoverage,
    smellCounts,
    professorComparison: buildProfessorComparison(dataset, studentMetrics)
  };
}

module.exports = {
  computeMetrics,
  submissionPercent,
  questionMaxGrade,
  PASS_THRESHOLD,
  mean,
  median,
  round
};
