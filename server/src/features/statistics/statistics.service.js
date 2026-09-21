// Motor de métricas: transforma os datasets brutos importados do Moodle em
// números prontos para a tela de Estatísticas. Nenhuma chamada de rede acontece
// aqui — é uma função pura sobre os JSON salvos em disco, o que torna o
// recálculo barato e permite reprocessar importações antigas quando as regras
// mudam.
//
// A entrada pode ser uma importação só ou várias: `mergeDatasets` consolida
// turmas diferentes em um dataset único, mantendo a origem de cada questão e de
// cada aluno para que nenhuma métrica cobre de um aluno a questão de uma turma
// em que ele nunca esteve.

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

/** Identificador estável de um aluno nas métricas e nas exportações. */
function studentKey(student) {
  return String(student.userId ?? student.folderName ?? student.name ?? '');
}

// ---------------------------------------------------------------------------
// Consolidação de várias importações
// ---------------------------------------------------------------------------

/**
 * Chaves candidatas de identidade, da mais forte para a mais fraca. Turmas
 * diferentes podem trazer o mesmo aluno com metadados diferentes (uma com
 * `userId` do Web Service, outra só com a pasta do ZIP), então registramos
 * todos os apelidos para que o segundo encontro reconheça o primeiro.
 */
function identityAliases(student) {
  const aliases = [];
  if (student.userId) aliases.push(`id:${student.userId}`);
  if (student.email) aliases.push(`email:${normalizeKey(student.email)}`);
  if (student.username) aliases.push(`user:${normalizeKey(student.username)}`);
  if (student.idNumber) aliases.push(`idnum:${normalizeKey(student.idNumber)}`);
  if (student.folderName) aliases.push(`folder:${normalizeKey(student.folderName)}`);
  if (student.name) aliases.push(`name:${normalizeKey(student.name)}`);
  return aliases;
}

const maxOrNull = (a, b) => (a && b ? Math.max(a, b) : (a ?? b ?? null));

/**
 * Dois registros que trazem identificadores fortes *diferentes* são pessoas
 * diferentes, mesmo que casem por um apelido fraco. Sem esta guarda, dois
 * homônimos de turmas diferentes ("Maria Silva" em P1 e em P2) virariam um
 * aluno só com as questões das duas turmas somadas.
 */
function conflictingIdentity(a, b) {
  const differs = (left, right, compare = (x, y) => x !== y) =>
    left !== null && left !== undefined && left !== ''
    && right !== null && right !== undefined && right !== ''
    && compare(left, right);

  return differs(a.userId, b.userId, (x, y) => String(x) !== String(y))
    || differs(a.email, b.email, (x, y) => normalizeKey(x) !== normalizeKey(y))
    || differs(a.username, b.username, (x, y) => normalizeKey(x) !== normalizeKey(y));
}

/**
 * Junta dois registros de submissão da mesma questão. Acontece quando uma
 * importação descreve o mesmo aluno em dois registros — um vindo da lista de
 * submissões (nota, tentativas) e outro do ZIP (código, arquivos). Sobrescrever
 * um com o outro perderia metade dos dados.
 */
function mergeSubmissions(existing, incoming) {
  if (!existing) return incoming;
  if (!incoming) return existing;

  const firstValue = (a, b) => (a === null || a === undefined ? b : a);
  const union = (a, b) => [...new Set([...(a || []), ...(b || [])])];

  return {
    ...existing,
    ...incoming,
    submitted: Boolean(existing.submitted || incoming.submitted),
    submittedAt: maxOrNull(existing.submittedAt, incoming.submittedAt),
    attempts: Math.max(existing.attempts || 0, incoming.attempts || 0) || null,
    grade: firstValue(incoming.grade, existing.grade),
    evaluation: firstValue(incoming.evaluation, existing.evaluation),
    compilation: firstValue(incoming.compilation, existing.compilation),
    code: firstValue(incoming.code, existing.code),
    codeMetrics: firstValue(incoming.codeMetrics, existing.codeMetrics),
    failedCases: union(existing.failedCases, incoming.failedCases),
    compileErrors: union(existing.compileErrors, incoming.compileErrors),
    hasCompileError: Boolean(existing.hasCompileError || incoming.hasCompileError),
    late: Boolean(existing.late || incoming.late),
    files: (incoming.files || []).length ? incoming.files : (existing.files || []),
    history: (incoming.history || []).length ? incoming.history : (existing.history || [])
  };
}

/**
 * Consolida uma ou mais importações em um dataset único.
 *
 * Com mais de uma turma as chaves de questão passam a ser prefixadas
 * (`{turma}::q1`) — sem isso o `q1` de uma turma sobrescreveria o da outra. Cada
 * questão guarda `turma`/`sourceKey` e cada aluno guarda `turmas`, o que permite
 * cobrar do aluno apenas as questões das turmas em que ele aparece.
 */
function mergeDatasets(input) {
  const datasets = (Array.isArray(input) ? input : [input]).filter(Boolean);
  if (!datasets.length) throw new Error('Nenhuma importação informada para o cálculo de métricas.');

  const combined = datasets.length > 1;
  const questions = [];
  const students = [];
  const aliasIndex = new Map();
  const warnings = [];
  const sourceKeys = new Set();

  datasets.forEach(dataset => {
    const turma = dataset.turma;
    const keyMap = new Map();

    (dataset.questions || []).forEach(question => {
      const key = combined ? `${turma}::${question.key}` : question.key;
      keyMap.set(question.key, key);
      questions.push({ ...question, key, sourceKey: question.key, turma });
    });

    (dataset.students || []).forEach(student => {
      let record = identityAliases(student)
        .map(alias => aliasIndex.get(alias))
        .find(candidate => candidate && !conflictingIdentity(candidate, student));

      if (!record) {
        record = { ...student, turmas: [], questions: {} };
        students.push(record);
      } else {
        record.userId = record.userId ?? student.userId ?? null;
        record.folderName = record.folderName || student.folderName || null;
        record.email = record.email || student.email || null;
        record.username = record.username || student.username || null;
        record.idNumber = record.idNumber || student.idNumber || null;
        record.name = record.name || student.name;
        record.enrolled = record.enrolled || Boolean(student.enrolled);
        record.lastAccess = maxOrNull(record.lastAccess, student.lastAccess);
        record.lastCourseAccess = maxOrNull(record.lastCourseAccess, student.lastCourseAccess);
        record.groups = [...new Set([...(record.groups || []), ...(student.groups || [])])];
      }

      identityAliases(record).forEach(alias => aliasIndex.set(alias, record));
      if (!record.turmas.includes(turma)) record.turmas.push(turma);

      Object.entries(student.questions || {}).forEach(([sourceKey, submission]) => {
        const mapped = keyMap.get(sourceKey);
        if (mapped) record.questions[mapped] = mergeSubmissions(record.questions[mapped], submission);
      });
    });

    (dataset.warnings || []).forEach(warning => {
      warnings.push(combined ? `[${turma}] ${warning}` : warning);
    });
    Object.keys(dataset.sources || {}).forEach(key => sourceKeys.add(key));
  });

  // Uma fonte só é "disponível" se estiver disponível em todas as turmas
  // selecionadas; disponibilidade parcial é sinalizada à parte para que a tela
  // não afirme que existe um dado que só metade da seleção tem.
  const sources = {};
  const sourcesPartial = {};
  sourceKeys.forEach(key => {
    const available = datasets.filter(dataset => Boolean(dataset.sources?.[key])).length;
    sources[key] = available === datasets.length;
    sourcesPartial[key] = available > 0 && available < datasets.length;
  });

  const unique = (values) => [...new Set(values.filter(Boolean))];

  return {
    combined,
    turma: datasets.map(dataset => dataset.turma).join(' + '),
    turmas: datasets.map(dataset => dataset.turma),
    courseName: unique(datasets.map(dataset => dataset.courseName)).join(' + '),
    sectionName: unique(datasets.map(dataset => dataset.sectionName)).join(' + '),
    sections: unique(datasets.flatMap(dataset => dataset.sections || [dataset.sectionName])),
    baseUrl: datasets[0].baseUrl || null,
    importedAt: datasets.reduce((latest, dataset) => Math.max(latest, dataset.importedAt || 0), 0) || null,
    deepHistory: datasets.every(dataset => Boolean(dataset.deepHistory)),
    datasets: datasets.map(dataset => ({
      turma: dataset.turma,
      courseName: dataset.courseName ?? null,
      sectionName: dataset.sectionName ?? null,
      importedAt: dataset.importedAt ?? null,
      studentCount: (dataset.students || []).length,
      questionCount: (dataset.questions || []).length
    })),
    sources,
    sourcesPartial,
    warnings,
    questions,
    students
  };
}

/** Questões que valem para um aluno — só as das turmas em que ele aparece. */
function scopedQuestions(merged, student) {
  if (!merged.combined || !student.turmas?.length) return merged.questions;
  const turmas = new Set(student.turmas);
  return merged.questions.filter(question => turmas.has(question.turma));
}

/**
 * Um aluno "sem histórico" é o cadastro que não tem nenhum vestígio de
 * atividade nas questões da própria turma: nem entrega, nem nota, nem
 * tentativa, nem código. Em geral é matrícula cancelada, trancamento ou
 * cadastro do Moodle sem inscrição na disciplina — mantê-lo distorce taxa de
 * entrega, índice de dificuldade e distribuição de risco.
 */
function hasAnyRecord(merged, student) {
  return scopedQuestions(merged, student).some(question => {
    const submission = student.questions?.[question.key];
    if (!submission) return false;
    return Boolean(submission.submitted)
      || (submission.grade !== null && submission.grade !== undefined)
      || (submission.attempts || 0) > 0
      || Boolean(submission.code)
      || Boolean(submission.evaluation)
      || (submission.history || []).length > 0
      || (submission.files || []).length > 0;
  });
}

/**
 * Separa os alunos considerados nas métricas dos ignorados por falta de
 * histórico. Exportado porque as exportações em CSV precisam do mesmo recorte
 * que a tela.
 */
function selectStudents(merged, options = {}) {
  const students = merged.students || [];
  if (!options.ignoreEmptyStudents) return { included: students, excluded: [] };

  const included = [];
  const excluded = [];
  students.forEach(student => {
    (hasAnyRecord(merged, student) ? included : excluded).push(student);
  });
  return { included, excluded };
}

// ---------------------------------------------------------------------------
// Métricas por questão
// ---------------------------------------------------------------------------

function buildQuestionMetrics(merged, students) {
  // Uma questão só é "esperada" de quem está na turma dela: em uma visão com
  // várias turmas, cobrar a questão da turma A de um aluno da turma B faria
  // toda questão parecer impossível.
  const studentsByTurma = new Map();
  students.forEach(student => {
    (student.turmas?.length ? student.turmas : merged.turmas).forEach(turma => {
      if (!studentsByTurma.has(turma)) studentsByTurma.set(turma, []);
      studentsByTurma.get(turma).push(student);
    });
  });

  return (merged.questions || []).map(question => {
    const audience = studentsByTurma.get(question.turma) || students;
    const submissions = audience
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
      sourceKey: question.sourceKey ?? question.key,
      turma: question.turma ?? merged.turma,
      cmid: question.cmid,
      name: question.name,
      section: question.section ?? null,
      maxGrade: questionMaxGrade(question),
      startDate: question.startDate ?? null,
      dueDate: question.dueDate ?? null,
      testCaseCount: (question.testCases || []).length,
      hasStatement: Boolean(question.statement),
      expected: audience.length,
      submittedCount: submitted.length,
      submissionRate: rate(submitted.length, audience.length),
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
      difficultyIndex: audience.length
        ? round(100 - ((avgPercent ?? 0) * submitted.length) / audience.length, 1)
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
 * Ganho, em pontos percentuais, a partir do qual a insistência conta como
 * progresso.
 *
 * Sem um piso, qualquer ganho positivo vira "está melhorando": um aluno que
 * submeteu cinco vezes e foi de 20% a 30% sem nunca passar seria lido como
 * persistente produtivo, que é o contrário do que aconteceu. O corte é
 * arbitrário como todo corte, mas fica declarado e aparece na tela.
 */
const RELEVANT_GAIN = 20;

/**
 * O aluno melhora ao longo das tentativas?
 *
 * Exige pelo menos 3 tentativas numa questão: com dois pontos não há
 * tendência. Devolve `null` quando a turma foi importada sem o histórico de
 * tentativas — a ausência do dado não é um "não melhora".
 */
function computeImproving(student, questionByKey) {
  const paths = Object.entries(student.questions || {})
    .map(([key, submission]) => {
      const history = (submission?.history || []).filter(entry => typeof entry.grade === 'number');
      if (history.length < 3) return null;
      const max = questionMaxGrade(questionByKey.get(key) || {});
      const toPercent = (grade) => Math.max(0, Math.min(100, (grade / max) * 100));
      return toPercent(history[history.length - 1].grade) - toPercent(history[0].grade);
    })
    .filter(value => value !== null);

  if (!paths.length) return null;
  return mean(paths) >= RELEVANT_GAIN;
}

/**
 * Combina entrega, desempenho, atraso e esforço em um único score 0–100.
 * Cada parcela devolve também o motivo em texto, para que o alerta na tela
 * explique *por que* o aluno foi sinalizado em vez de mostrar só um número.
 */
function computeRisk({ missingRatio, avgPercent, submittedCount, lateRatio, attempts, questionCount, improving }) {
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

  // Muitas tentativas com nota baixa só é risco quando NÃO há progresso.
  // Insistir e melhorar é persistência produtiva e não deve acionar alerta —
  // é o comportamento que queremos reconhecer, não penalizar.
  // `improving === null` significa turma sem histórico de tentativas: aí não
  // há como distinguir, e a regra antiga continua valendo.
  if (attempts >= 8 && avgPercent !== null && avgPercent < PASS_THRESHOLD && improving !== true) {
    score += 8;
    reasons.push({ code: 'strugglingEffort', weight: 8, value: attempts });
  }

  score = Math.max(0, Math.min(100, score));
  const level = score >= 60 ? 'critical' : score >= 40 ? 'high' : score >= 20 ? 'medium' : 'low';
  return { score, level, reasons: reasons.sort((a, b) => b.weight - a.weight) };
}

function buildStudentMetrics(merged, students) {
  // As chaves de questão já vêm prefixadas com a turma quando a seleção tem
  // mais de uma, e é por elas que `student.questions` é indexado — então um
  // índice único sobre `merged.questions` serve para todos os alunos.
  const questionByKey = new Map((merged.questions || []).map(q => [q.key, q]));

  return students.map(student => {
    const questions = scopedQuestions(merged, student);

    const perQuestion = questions.map(question => {
      const submission = student.questions?.[question.key];
      const percent = submissionPercent(submission, question);
      return {
        key: question.key,
        sourceKey: question.sourceKey ?? question.key,
        turma: question.turma ?? merged.turma,
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

    // Melhora entre a primeira e a última tentativa, quando há histórico.
    // `null` = turma importada sem o histórico; o risco mantém a regra antiga.
    const improving = computeImproving(student, questionByKey);

    const risk = computeRisk({
      missingRatio,
      avgPercent: avgPercent ?? null,
      submittedCount: submitted.length,
      lateRatio: submitted.length ? lateCount / submitted.length : 0,
      attempts: attemptsTotal,
      questionCount: questions.length,
      improving
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
      idNumber: student.idNumber || null,
      groups: student.groups || [],
      turmas: student.turmas?.length ? student.turmas : merged.turmas,
      enrolled: Boolean(student.enrolled),
      lastAccess: student.lastAccess ?? null,
      lastCourseAccess: student.lastCourseAccess ?? null,
      hasRecords: hasAnyRecord(merged, student),
      submittedCount: submitted.length,
      missingCount: questions.length - submitted.length,
      submissionRate: rate(submitted.length, questions.length),
      avgPercent: round(avgPercent),
      medianPercent: round(median(percentages)),
      bestPercent: percentages.length ? round(Math.max(...percentages)) : null,
      worstPercent: percentages.length ? round(Math.min(...percentages)) : null,
      totalAttempts: attemptsTotal,
      lateCount,
      compileErrorCount: submitted.filter(q => q.hasCompileError).length,
      firstSubmissionAt: submissionTimes.length ? Math.min(...submissionTimes) : null,
      lastSubmissionAt: submissionTimes.length ? Math.max(...submissionTimes) : null,
      totalCodeLines: submitted.reduce((acc, q) => acc + (q.codeLines || 0), 0),
      // Reconhecimento, não risco: fica fora de `risk.reasons` de propósito.
      productivePersistence: improving === true && attemptsTotal >= 8,
      risk,
      questions: perQuestion,
      concepts: conceptsUsed,
      questionCount: questions.length
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

/** Faixa de antecedência de um envio em relação ao prazo da atividade. */
function leadTimeBucket(hoursBefore) {
  return LEAD_TIME_BUCKETS.find(bucket => hoursBefore >= bucket.min && hoursBefore < bucket.max)
    || LEAD_TIME_BUCKETS[LEAD_TIME_BUCKETS.length - 1];
}

function buildEngagement(merged, students, studentMetrics) {
  const questionByKey = new Map((merged.questions || []).map(q => [q.key, q]));

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

  students.forEach(student => {
    scopedQuestions(merged, student).forEach(question => {
      const submission = student.questions?.[question.key];
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

      const dueDate = questionByKey.get(question.key)?.dueDate;
      if (dueDate && submission.submittedAt) {
        const bucketKey = leadTimeBucket((dueDate - submission.submittedAt) / HOUR_MS).key;
        const target = leadTimes.find(b => b.key === bucketKey);
        if (target) target.count += 1;
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
      mean(studentMetrics.flatMap(s => s.questions.filter(q => q.submitted).map(q => q.attempts || 1))),
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

function buildProfessorComparison(merged, studentMetrics) {
  const byEmail = new Map();
  const byName = new Map();

  merged.turmas.forEach(turma => {
    (loadProfessorGrades(turma) || []).forEach(entry => {
      if (entry.email) byEmail.set(normalizeKey(entry.email), { ...entry, turma });
      if (entry.name) byName.set(normalizeKey(entry.name), { ...entry, turma });
    });
  });

  if (!byEmail.size && !byName.size) return null;

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
      turma: match.turma,
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

function computeMergedMetrics(merged, options = {}) {
  const { included, excluded } = selectStudents(merged, options);

  const questionMetrics = buildQuestionMetrics(merged, included);
  const studentMetrics = buildStudentMetrics(merged, included);
  const engagement = buildEngagement(merged, included, studentMetrics);

  const allPercentages = studentMetrics.flatMap(s => s.questions.map(q => q.percent)).filter(v => v !== null);
  const studentAverages = studentMetrics.map(s => s.avgPercent).filter(v => v !== null);
  // Com várias turmas cada aluno responde por um número diferente de questões,
  // então o total esperado é a soma das questões de cada um.
  const expectedSubmissions = studentMetrics.reduce((acc, s) => acc + s.questionCount, 0);
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

  const codedSubmissions = included.flatMap(student =>
    scopedQuestions(merged, student)
      .map(question => student.questions?.[question.key])
      .filter(submission => submission?.codeMetrics)
  );

  const smellCounts = Object.keys(SMELL_LABELS).map(key => {
    const count = codedSubmissions.filter(q => q.codeMetrics.smells?.[key]).length;
    return { key, label: SMELL_LABELS[key], count, total: codedSubmissions.length, rate: rate(count, codedSubmissions.length) };
  }).sort((a, b) => b.rate - a.rate);

  const alerts = studentMetrics
    .filter(s => s.risk.level !== 'low')
    .sort((a, b) => b.risk.score - a.risk.score);

  const overview = {
    totalStudents: studentMetrics.length,
    totalQuestions: (merged.questions || []).length,
    totalTurmas: merged.turmas.length,
    activeStudents: engagement.activeStudents,
    inactiveStudents: engagement.inactiveStudents,
    excludedStudents: excluded.length,
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
    turma: merged.turma,
    turmas: merged.turmas,
    combined: Boolean(merged.combined),
    courseName: merged.courseName,
    sectionName: merged.sectionName,
    sections: merged.sections || [],
    datasets: merged.datasets || [],
    importedAt: merged.importedAt,
    sources: merged.sources || {},
    sourcesPartial: merged.sourcesPartial || {},
    warnings: merged.warnings || [],
    ignoreEmptyStudents: Boolean(options.ignoreEmptyStudents),
    excludedStudents: excluded.map(student => ({
      name: student.name,
      email: student.email || null,
      turmas: student.turmas || [],
      lastCourseAccess: student.lastCourseAccess ?? null
    })),
    overview,
    questions: questionMetrics,
    students: studentMetrics,
    engagement,
    alerts,
    conceptCoverage,
    smellCounts,
    professorComparison: buildProfessorComparison(merged, studentMetrics)
  };
}

/**
 * Métricas de uma ou várias importações. Com mais de uma turma, `byTurma`
 * carrega a visão geral de cada uma calculada isoladamente — é o que permite
 * comparar turmas lado a lado sem duplicar a regra de agregação.
 */
function computeMetrics(input, options = {}) {
  const datasets = (Array.isArray(input) ? input : [input]).filter(Boolean);
  const merged = mergeDatasets(datasets);
  const metrics = computeMergedMetrics(merged, options);

  metrics.byTurma = datasets.length > 1
    ? datasets.map(dataset => {
        const single = computeMergedMetrics(mergeDatasets([dataset]), options);
        return {
          turma: dataset.turma,
          importedAt: dataset.importedAt ?? null,
          questionCount: single.questions.length,
          overview: single.overview
        };
      })
    : [{
        turma: merged.turma,
        importedAt: merged.importedAt,
        questionCount: metrics.questions.length,
        overview: metrics.overview
      }];

  return metrics;
}

module.exports = {
  computeMetrics,
  mergeDatasets,
  selectStudents,
  scopedQuestions,
  hasAnyRecord,
  submissionPercent,
  questionMaxGrade,
  studentKey,
  leadTimeBucket,
  LEAD_TIME_BUCKETS,
  PASS_THRESHOLD,
  HOUR_MS,
  mean,
  median,
  stdDev,
  round,
  rate,
  RELEVANT_GAIN,
  normalizeKey,
  loadProfessorGrades
};
