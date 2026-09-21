// Exportação das estatísticas em CSV para análise posterior (pandas, R, Excel).
//
// Cada tabela é declarada em `TABLES` com id, grupo, colunas (nome + descrição)
// e um construtor de linhas. Dessa declaração saem três coisas ao mesmo tempo:
// o CSV, o manifesto que a tela mostra e o dicionário de dados em Markdown que
// vai no ZIP. Assim documentação e dado não têm como divergir.
//
// Convenções dos arquivos gerados (documentadas também no LEIA-ME do ZIP):
//   · UTF-8 sem BOM, separador vírgula, ponto como decimal;
//   · vazio = dado ausente (NaN no pandas), `True`/`False` para booleanos;
//   · listas em uma célula são separadas por " | ";
//   · datas em ISO 8601 no fuso local da máquina que exportou, com a coluna
//     `*_epoch` em milissegundos para quem preferir converter por conta;
//   · uma linha por observação — nenhuma linha de total no meio dos dados
//     (a única exceção é `overview.csv`, que é uma tabela de agregados).

const AdmZip = require('adm-zip');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { DATA_DIR } = require('../../config/env');
const {
  computeMetrics, mergeDatasets, selectStudents, scopedQuestions, submissionPercent,
  studentKey, leadTimeBucket, LEAD_TIME_BUCKETS, PASS_THRESHOLD, HOUR_MS, round
} = require('./statistics.service');
const { CONCEPT_LABELS, SMELL_LABELS } = require('./codeMetrics');
const { loadScope, scopeMastery, scopeOutcome } = require('../learning/scope');
const { DIMENSIONS } = require('../learning/indicators.service');
const { studentAverage } = require('../learning/interventions.service');
const { statisticsPaths, readJsonFile } = require('./statistics.paths');

const LEARNING_INDICATOR_KEYS = {
  engagement: ['activeDays', 'eventsPerWeek', 'activitiesViewed', 'submissionRate'],
  regularity: ['medianGapDays', 'longestSilenceDays', 'activeWeeksRatio'],
  persistence: ['attemptsToFirstPass', 'gainFirstToLast', 'recoveryRate', 'stalledCount'],
  learning: ['avgMastery', 'gapTopics', 'firstAttemptPassRate'],
  selfRegulation: ['medianLeadHours', 'lastMinuteRate', 'distributedPractice']
};

const LEARNING_UNITS = {
  activeDays: 'dias', eventsPerWeek: 'eventos/semana', activitiesViewed: 'atividades',
  submissionRate: '%', medianGapDays: 'dias', longestSilenceDays: 'dias',
  activeWeeksRatio: '%', attemptsToFirstPass: 'tentativas', gainFirstToLast: 'p.p.',
  recoveryRate: '%', stalledCount: 'questões', avgMastery: '%', gapTopics: 'conceitos',
  firstAttemptPassRate: '%', medianLeadHours: 'horas', lastMinuteRate: '%',
  distributedPractice: '%'
};

/**
 * A família de cada indicador em relação ao desfecho — é o que impede alguém de
 * treinar um modelo com a resposta dentro das features e comemorar a acurácia.
 */
const LEARNING_FAMILY = {
  activeDays: 'comportamento', eventsPerWeek: 'comportamento', activitiesViewed: 'comportamento',
  medianGapDays: 'comportamento', longestSilenceDays: 'comportamento', activeWeeksRatio: 'comportamento',
  medianLeadHours: 'comportamento', lastMinuteRate: 'comportamento', distributedPractice: 'comportamento',
  submissionRate: 'desempenho', attemptsToFirstPass: 'desempenho', gainFirstToLast: 'desempenho',
  recoveryRate: 'desempenho', stalledCount: 'desempenho', avgMastery: 'desempenho',
  gapTopics: 'desempenho', firstAttemptPassRate: 'desempenho'
};

const LEARNING_INDICATOR_LABELS = {
  activeDays: 'Dias com atividade', eventsPerWeek: 'Eventos por semana',
  activitiesViewed: 'Atividades acessadas', submissionRate: 'Taxa de entrega',
  medianGapDays: 'Intervalo mediano entre dias ativos', longestSilenceDays: 'Maior período de silêncio',
  activeWeeksRatio: 'Semanas com atividade', attemptsToFirstPass: 'Tentativas até passar',
  gainFirstToLast: 'Ganho da primeira à última tentativa',
  recoveryRate: 'Recuperação após começar abaixo do corte',
  stalledCount: 'Questões abandonadas sem passar', avgMastery: 'Domínio médio nos conceitos',
  gapTopics: 'Conceitos em lacuna', firstAttemptPassRate: 'Acerto já na primeira tentativa',
  medianLeadHours: 'Antecedência mediana ao prazo',
  lastMinuteRate: 'Entregas na última hora ou atrasadas',
  distributedPractice: 'Prática fora da véspera do prazo'
};

const WEEKDAY_LABELS = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];

const RISK_REASON_LABELS = {
  noSubmission: 'Nenhuma entrega',
  missingSubmissions: 'Questões sem entrega',
  lowGrades: 'Média abaixo da aprovação',
  lateSubmissions: 'Entregas atrasadas',
  strugglingEffort: 'Muitas tentativas sem atingir a média'
};

// ---------------------------------------------------------------------------
// Serialização
// ---------------------------------------------------------------------------

const pad = (value) => String(value).padStart(2, '0');

/** ISO 8601 no fuso local — o mesmo fuso usado pelos histogramas de hora. */
function isoLocal(timestamp) {
  if (!timestamp) return null;
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return null;
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
    + `T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

function dateKey(timestamp) {
  const iso = isoLocal(timestamp);
  return iso ? iso.slice(0, 10) : null;
}

function monthKey(timestamp) {
  const iso = isoLocal(timestamp);
  return iso ? iso.slice(0, 7) : null;
}

function csvCell(value) {
  if (value === null || value === undefined) return '';
  if (typeof value === 'boolean') return value ? 'True' : 'False';
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : '';
  const raw = Array.isArray(value) ? value.filter(v => v !== null && v !== undefined).join(' | ') : String(value);
  // Mensagens de erro de compilação trazem quebras de linha; achatar mantém uma
  // observação por linha do CSV, que é o que qualquer leitor espera.
  const text = raw.replace(/\s+/g, ' ').trim();
  return /[",]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/**
 * Colunas que carregam identidade, e o que a pseudonimização faz com cada uma.
 *
 * A lista vive num lugar só e vale para **todas** as tabelas: um pacote que se
 * diz anônimo mas traz o nome do aluno em `students.csv` é pior que um pacote
 * identificado, porque promete o que não cumpre.
 */
const IDENTITY_COLUMNS = {
  // Viram um hash com sal: o mesmo aluno mantém o mesmo id entre exportações,
  // então a ligação ao longo do tempo sobrevive sem que o id volte a ser pessoa.
  hash: new Set(['student_key', 'student_id', 'aluno_id']),
  // Simplesmente saem.
  drop: new Set(['name', 'student_name', 'email', 'username', 'id_number', 'folder_name'])
};

const SALT_FILE = path.join(DATA_DIR, 'export-salt.txt');

/** O sal é gerado uma vez por instalação e **nunca** entra no pacote. */
function readSalt() {
  if (!fs.existsSync(SALT_FILE)) {
    fs.writeFileSync(SALT_FILE, crypto.randomBytes(32).toString('hex'), { mode: 0o600 });
  }
  return fs.readFileSync(SALT_FILE, 'utf8').trim();
}

function pseudonym(value, salt) {
  if (value === null || value === undefined || value === '') return '';
  return crypto.createHash('sha256').update(`${salt}:${value}`).digest('hex').slice(0, 16);
}

function toCsv(columns, rows, options = {}) {
  const salt = options.pseudonymize ? readSalt() : null;
  const value = (row, name) => {
    if (!salt) return row[name];
    if (IDENTITY_COLUMNS.hash.has(name)) return pseudonym(row[name], salt);
    if (IDENTITY_COLUMNS.drop.has(name)) return null;
    return row[name];
  };

  const header = columns.map(column => column.name).join(',');
  const body = rows.map(row => columns.map(column => csvCell(value(row, column.name))).join(','));
  return [header, ...body].join('\r\n') + '\r\n';
}

const columnList = (pairs) => pairs.map(([name, description]) => ({ name, description }));

// ---------------------------------------------------------------------------
// Contexto de exportação
// ---------------------------------------------------------------------------

/**
 * Prepara tudo que as tabelas consomem: dataset consolidado, métricas, alunos
 * considerados (respeitando o filtro de "sem histórico"), pares aluno×questão e
 * a lista de eventos de submissão que serve de espinha para as séries temporais.
 */
function buildContext(datasets, options = {}) {
  const merged = mergeDatasets(datasets);
  const metrics = computeMetrics(datasets, options);
  const { included, excluded } = selectStudents(merged, options);

  const studentMetricsByKey = new Map(metrics.students.map(student => [studentKey(student), student]));
  const questionMetricsByKey = new Map(metrics.questions.map(question => [question.key, question]));
  const questionByKey = new Map(merged.questions.map(question => [question.key, question]));

  const ctx = {
    merged, metrics, options, excluded,
    students: included,
    studentMetricsByKey, questionMetricsByKey, questionByKey,
    datasetsWithHistory: datasets.filter(dataset => dataset.deepHistory).map(dataset => dataset.turma)
  };

  ctx.pairs = buildPairs(ctx);
  ctx.events = buildEvents(ctx);
  ctx.eventsByStudent = groupBy(ctx.events, event => event.studentKey);
  // O submódulo de aprendizado é opcional: turma sem taxonomia, sem logs e sem
  // intervenções simplesmente devolve tabelas vazias — com cabeçalho, para que
  // quem lê o pacote saiba que a coluna existe e o dado é que não.
  ctx.learning = buildLearningContext(datasets);
  return ctx;
}

/**
 * Os indicadores e o domínio conceitual, **por turma**.
 *
 * Por turma porque engajamento e regularidade dividem por semanas do período:
 * somar semestres faria um aluno de um semestre só parecer meses em silêncio.
 */
function buildLearningContext(datasets) {
  const scope = loadScope(datasets.map(dataset => dataset.turma));
  if (!scope) return { turmas: [], perTurma: [], mastery: null };
  return {
    turmas: scope.turmas,
    perTurma: scope.contexts,
    mastery: scopeMastery(scope),
    outcome: scopeOutcome(scope),
    scope
  };
}

function groupBy(items, keyFn) {
  const map = new Map();
  items.forEach(item => {
    const key = keyFn(item);
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(item);
  });
  return map;
}

/** Um registro por aluno × questão que aquele aluno deveria entregar. */
function buildPairs(ctx) {
  const pairs = [];
  ctx.students.forEach(student => {
    const key = studentKey(student);
    const studentMetrics = ctx.studentMetricsByKey.get(key);
    scopedQuestions(ctx.merged, student).forEach(question => {
      const submission = student.questions?.[question.key] || null;
      const percent = submissionPercent(submission, question);
      pairs.push({
        studentKey: key,
        student,
        studentMetrics,
        question,
        questionMetrics: ctx.questionMetricsByKey.get(question.key),
        submission,
        percent: round(percent, 2),
        hoursBeforeDue: question.dueDate && submission?.submittedAt
          ? round((question.dueDate - submission.submittedAt) / HOUR_MS, 2)
          : null
      });
    });
  });
  return pairs;
}

/**
 * Eventos de envio. Quando a importação trouxe o histórico completo cada
 * tentativa é um evento; sem histórico sobra o envio final, que ainda assim
 * posiciona o aluno no tempo.
 */
function buildEvents(ctx) {
  const events = [];

  ctx.pairs.forEach(pair => {
    const { submission, question } = pair;
    if (!submission?.submitted) return;

    const stamps = (submission.history || [])
      .filter(entry => entry.submittedAt)
      .map(entry => ({ at: entry.submittedAt, grade: entry.grade ?? null, source: 'history' }));

    if (submission.submittedAt && !stamps.some(stamp => stamp.at === submission.submittedAt)) {
      stamps.push({ at: submission.submittedAt, grade: submission.grade ?? null, source: 'final' });
    }

    stamps.sort((a, b) => a.at - b.at).forEach((stamp, index) => {
      const date = new Date(stamp.at);
      const gradePercent = stamp.grade !== null && stamp.grade !== undefined
        ? round(submissionPercent({ grade: stamp.grade }, question), 2)
        : null;

      events.push({
        studentKey: pair.studentKey,
        student: pair.student,
        studentMetrics: pair.studentMetrics,
        question,
        questionMetrics: pair.questionMetrics,
        submission,
        at: stamp.at,
        source: stamp.source,
        grade: stamp.grade,
        percent: gradePercent,
        attemptIndex: index + 1,
        attemptCount: stamps.length,
        isFinal: index === stamps.length - 1,
        hour: date.getHours(),
        weekday: date.getDay(),
        hoursBeforeDue: question.dueDate ? round((question.dueDate - stamp.at) / HOUR_MS, 2) : null
      });
    });
  });

  return events.sort((a, b) => a.at - b.at);
}

// Colunas repetidas em várias tabelas, para que o mesmo conceito tenha sempre o
// mesmo nome e a mesma descrição.
const STUDENT_ID_COLUMNS = [
  ['student_key', 'Identificador estável do aluno (userId do Moodle ou pasta do ZIP). Use como chave de junção.'],
  ['student_id', 'ID numérico do usuário no Moodle. Vazio quando o aluno só foi identificado pelo ZIP.'],
  ['student_name', 'Nome do aluno.']
];

const QUESTION_ID_COLUMNS = [
  ['turma', 'Importação (turma) de origem.'],
  ['question_key', 'Chave da questão nesta exportação. Com várias turmas vem prefixada por "turma::".'],
  ['question_name', 'Nome da atividade VPL no Moodle.']
];

const studentIdValues = (student) => ({
  student_key: studentKey(student),
  student_id: student.userId ?? null,
  student_name: student.name
});

const conceptColumns = (prefix = 'concept_') => Object.entries(CONCEPT_LABELS)
  .map(([key, label]) => [`${prefix}${key}`, `${label} — detectado por heurística textual no código.`]);

const smellColumns = () => Object.entries(SMELL_LABELS)
  .map(([key, label]) => [`smell_${key}`, `${label} — detectado por heurística textual no código.`]);

function conceptValues(source, prefix = 'concept_') {
  const values = {};
  // Sem código não houve detecção: vazio (NaN) é mais honesto que False, que
  // leria como "o aluno não usou o conceito".
  Object.keys(CONCEPT_LABELS).forEach(key => {
    values[`${prefix}${key}`] = source ? Boolean(source[key]) : null;
  });
  return values;
}

function smellValues(source) {
  const values = {};
  Object.keys(SMELL_LABELS).forEach(key => { values[`smell_${key}`] = Boolean(source?.[key]); });
  return values;
}

/** Nome de coluna seguro para as tabelas em formato largo. */
function safeColumn(text) {
  return String(text || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Za-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .toLowerCase() || 'col';
}

/**
 * Prefixo de coluna por questão nas tabelas largas, garantidamente único: dois
 * nomes de turma diferentes podem gerar o mesmo slug ("Prova 1 - A" e
 * "Prova 1 – A"), e a colisão sobrescreveria uma questão com a outra em
 * silêncio. O mapa é calculado uma vez por exportação.
 */
function widePrefixes(ctx) {
  if (!ctx.widePrefixCache) {
    const used = new Set();
    const prefixes = new Map();
    ctx.metrics.questions.forEach(question => {
      const base = ctx.merged.combined
        ? `${safeColumn(question.turma)}_${safeColumn(question.sourceKey)}`
        : safeColumn(question.sourceKey);
      let name = base;
      let suffix = 2;
      while (used.has(name)) name = `${base}_${suffix++}`;
      used.add(name);
      prefixes.set(question.key, name);
    });
    ctx.widePrefixCache = prefixes;
  }
  return ctx.widePrefixCache;
}

const wideQuestionPrefix = (ctx, question) => widePrefixes(ctx).get(question.key);

// ---------------------------------------------------------------------------
// Tabelas
// ---------------------------------------------------------------------------

const OVERVIEW_COLUMNS = [
  ['scope', 'Recorte da linha: o nome da turma, ou "__combinado__" na linha que soma a seleção inteira.'],
  ['turma_count', 'Quantas importações a linha agrega.'],
  ['course_name', 'Curso no Moodle.'],
  ['sections', 'Seções incluídas na importação.'],
  ['imported_at', 'Data/hora da importação (ISO local).'],
  ['students', 'Alunos considerados nas métricas.'],
  ['students_ignored', 'Alunos descartados pelo filtro "sem histórico" (0 se o filtro estava desligado).'],
  ['questions', 'Quantidade de questões.'],
  ['expected_submissions', 'Entregas possíveis = soma das questões esperadas de cada aluno.'],
  ['actual_submissions', 'Entregas efetivamente registradas.'],
  ['submission_rate', 'actual_submissions / expected_submissions em %.'],
  ['avg_percent', 'Média das notas percentuais de todas as entregas avaliadas.'],
  ['median_percent', 'Mediana das notas percentuais.'],
  ['stddev_percent', 'Desvio padrão amostral das notas percentuais.'],
  ['avg_student_percent', 'Média das médias por aluno (cada aluno pesa igual, independente de quantas entregas fez).'],
  ['pass_rate', '% de entregas avaliadas com nota >= pass_threshold.'],
  ['pass_threshold', 'Limite de aprovação usado pelo app, em % da nota máxima.'],
  ['zero_count', 'Entregas com nota zero.'],
  ['perfect_count', 'Entregas com nota máxima.'],
  ['compile_error_rate', '% das entregas cujo código não compilou na avaliação automática.'],
  ['late_count', 'Entregas após o prazo.'],
  ['late_rate', '% das entregas que foram após o prazo.'],
  ['active_students', 'Alunos com pelo menos uma entrega.'],
  ['inactive_students', 'Alunos considerados que não entregaram nada.'],
  ['risk_critical', 'Alunos com score de risco >= 60.'],
  ['risk_high', 'Alunos com score de risco entre 40 e 59.'],
  ['risk_medium', 'Alunos com score de risco entre 20 e 39.'],
  ['risk_low', 'Alunos com score de risco abaixo de 20.'],
  ['at_risk_count', 'risk_critical + risk_high.'],
  ['hardest_question', 'Questão com maior índice de dificuldade.'],
  ['easiest_question', 'Questão com menor índice de dificuldade.']
];

function overviewRow(scope, turmaCount, info, overview) {
  return {
    scope,
    turma_count: turmaCount,
    course_name: info.courseName ?? null,
    sections: info.sections ?? null,
    imported_at: isoLocal(info.importedAt),
    students: overview.totalStudents,
    students_ignored: overview.excludedStudents ?? 0,
    questions: overview.totalQuestions,
    expected_submissions: overview.expectedSubmissions,
    actual_submissions: overview.actualSubmissions,
    submission_rate: overview.submissionRate,
    avg_percent: overview.avgPercent,
    median_percent: overview.medianPercent,
    stddev_percent: overview.stdDevPercent,
    avg_student_percent: overview.avgStudentPercent,
    pass_rate: overview.passRate,
    pass_threshold: overview.passThreshold,
    zero_count: overview.zeroCount,
    perfect_count: overview.perfectCount,
    compile_error_rate: overview.compileErrorRate,
    late_count: overview.lateCount,
    late_rate: overview.lateRate,
    active_students: overview.activeStudents,
    inactive_students: overview.inactiveStudents,
    risk_critical: overview.riskBuckets.critical,
    risk_high: overview.riskBuckets.high,
    risk_medium: overview.riskBuckets.medium,
    risk_low: overview.riskBuckets.low,
    at_risk_count: overview.atRiskCount,
    hardest_question: overview.hardestQuestion?.name ?? null,
    easiest_question: overview.easiestQuestion?.name ?? null
  };
}

const TABLES = [
  // -------------------------------------------------------------- transversais
  {
    id: 'overview',
    group: 'cross',
    file: 'overview.csv',
    title: 'Visão geral',
    description: 'Uma linha por turma da seleção (e uma linha combinada quando há mais de uma) com os indicadores agregados.',
    tip: 'Serve para comparar turmas lado a lado. Como é a única tabela com linha de total, filtre `scope != "__combinado__"` antes de agregar.',
    columns: () => columnList(OVERVIEW_COLUMNS),
    rows: (ctx) => {
      const rows = ctx.metrics.byTurma.map(entry => {
        const dataset = ctx.merged.datasets.find(item => item.turma === entry.turma) || {};
        return overviewRow(entry.turma, 1, {
          courseName: dataset.courseName,
          sections: dataset.sectionName,
          importedAt: dataset.importedAt ?? entry.importedAt
        }, entry.overview);
      });

      if (ctx.merged.combined) {
        rows.push(overviewRow('__combinado__', ctx.merged.turmas.length, {
          courseName: ctx.merged.courseName,
          sections: ctx.merged.sections.join(' | '),
          importedAt: ctx.merged.importedAt
        }, ctx.metrics.overview));
      }
      return rows;
    }
  },
  {
    id: 'questions',
    group: 'cross',
    file: 'questions.csv',
    title: 'Questões',
    description: 'Uma linha por questão com dificuldade, dispersão das notas, tentativas, atrasos e erros de compilação.',
    tip: 'É a tabela de análise de itens: ordene por `difficulty_index` e cruze `stddev_percent` com `pass_rate` para achar questões que separam bem a turma.',
    columns: () => columnList([
      ...QUESTION_ID_COLUMNS,
      ['source_key', 'Chave original da questão dentro da importação (q1, q2...).'],
      ['section', 'Seção do Moodle de onde a questão veio.'],
      ['cmid', 'Course module id da atividade no Moodle.'],
      ['max_grade', 'Nota máxima da atividade. As colunas *_percent normalizam por ela.'],
      ['start_date', 'Abertura da atividade (ISO local).'],
      ['due_date', 'Prazo da atividade (ISO local).'],
      ['test_case_count', 'Casos de teste declarados no VPL.'],
      ['has_statement', 'Se o enunciado foi capturado na importação.'],
      ['expected', 'Alunos de quem a questão é esperada (só os da turma dela).'],
      ['submitted_count', 'Alunos que entregaram.'],
      ['submission_rate', 'submitted_count / expected em %.'],
      ['graded_count', 'Entregas com nota registrada (base das estatísticas de nota).'],
      ['avg_percent', 'Média das notas percentuais das entregas avaliadas.'],
      ['median_percent', 'Mediana das notas percentuais.'],
      ['stddev_percent', 'Desvio padrão amostral das notas percentuais.'],
      ['min_percent', 'Menor nota percentual.'],
      ['max_percent', 'Maior nota percentual.'],
      ['pass_rate', '% das entregas avaliadas com nota >= 60% da nota máxima.'],
      ['zero_count', 'Entregas com nota zero.'],
      ['perfect_count', 'Entregas com nota máxima.'],
      ['difficulty_index', 'Índice de dificuldade 0–100 = 100 − (média × entregues / esperados). Quem não entregou conta como dificuldade.'],
      ['avg_attempts', 'Média de tentativas por aluno que entregou.'],
      ['max_attempts', 'Maior número de tentativas observado.'],
      ['avg_code_lines', 'Média de linhas de código (sem linhas vazias e comentários).'],
      ['compile_error_count', 'Entregas cujo código não compilou.'],
      ['compile_error_rate', '% das entregas que não compilaram.'],
      ['late_count', 'Entregas após o prazo.'],
      ['late_rate', '% das entregas que foram após o prazo.']
    ]),
    rows: (ctx) => ctx.metrics.questions.map(question => ({
      turma: question.turma,
      question_key: question.key,
      question_name: question.name,
      source_key: question.sourceKey,
      section: question.section,
      cmid: question.cmid,
      max_grade: question.maxGrade,
      start_date: isoLocal(question.startDate),
      due_date: isoLocal(question.dueDate),
      test_case_count: question.testCaseCount,
      has_statement: question.hasStatement,
      expected: question.expected,
      submitted_count: question.submittedCount,
      submission_rate: question.submissionRate,
      graded_count: question.gradedCount,
      avg_percent: question.avgPercent,
      median_percent: question.medianPercent,
      stddev_percent: question.stdDevPercent,
      min_percent: question.minPercent,
      max_percent: question.maxPercent,
      pass_rate: question.passRate,
      zero_count: question.zeroCount,
      perfect_count: question.perfectCount,
      difficulty_index: question.difficultyIndex,
      avg_attempts: question.avgAttempts,
      max_attempts: question.maxAttempts,
      avg_code_lines: question.avgCodeLines,
      compile_error_count: question.compileErrorCount,
      compile_error_rate: question.compileErrorRate,
      late_count: question.lateCount,
      late_rate: question.lateRate
    }))
  },
  {
    id: 'students',
    group: 'cross',
    file: 'students.csv',
    title: 'Alunos',
    description: 'Uma linha por aluno com entregas, notas, esforço, atrasos e o score de risco.',
    tip: 'Base para segmentação: `risk_level` já classifica, mas `submission_rate` × `avg_percent` costuma revelar grupos mais úteis (entrega e erra ≠ não entrega).',
    columns: () => columnList([
      ...STUDENT_ID_COLUMNS,
      ['email', 'E-mail institucional, quando disponível.'],
      ['username', 'Login no Moodle.'],
      ['id_number', 'Matrícula (campo idnumber do Moodle ou extraída da pasta do ZIP).'],
      ['turmas', 'Turmas em que o aluno aparece, separadas por " | ".'],
      ['turma_count', 'Em quantas turmas da seleção o aluno aparece.'],
      ['groups', 'Grupos do Moodle.'],
      ['enrolled', 'Se o aluno veio da lista de matriculados do Web Service.'],
      ['has_records', 'Se existe algum vestígio de atividade (entrega, nota, tentativa ou código).'],
      ['question_count', 'Questões esperadas dele — só as das turmas em que aparece.'],
      ['submitted_count', 'Questões entregues.'],
      ['missing_count', 'Questões sem entrega.'],
      ['submission_rate', 'submitted_count / question_count em %.'],
      ['avg_percent', 'Média das notas percentuais das entregas avaliadas.'],
      ['median_percent', 'Mediana das notas percentuais.'],
      ['best_percent', 'Melhor nota percentual.'],
      ['worst_percent', 'Pior nota percentual.'],
      ['total_attempts', 'Soma das tentativas em todas as questões.'],
      ['attempts_per_submission', 'total_attempts / submitted_count.'],
      ['late_count', 'Entregas após o prazo.'],
      ['compile_error_count', 'Entregas que não compilaram.'],
      ['total_code_lines', 'Soma das linhas de código das entregas.'],
      ['first_submission_at', 'Primeira entrega (ISO local).'],
      ['last_submission_at', 'Última entrega (ISO local).'],
      ['active_days', 'Dias distintos com pelo menos um envio.'],
      ['last_course_access', 'Último acesso ao curso registrado pelo Moodle.'],
      ['risk_score', 'Score de risco 0–100 calculado pelo app.'],
      ['risk_level', 'Faixa do score: critical (>=60), high (>=40), medium (>=20) ou low.'],
      ['risk_reasons', 'Códigos dos motivos que compuseram o score, separados por " | ".']
    ]),
    rows: (ctx) => ctx.metrics.students.map(student => {
      const events = ctx.eventsByStudent.get(studentKey(student)) || [];
      return {
        ...studentIdValues(student),
        email: student.email,
        username: student.username,
        id_number: student.idNumber,
        turmas: student.turmas,
        turma_count: student.turmas.length,
        groups: student.groups,
        enrolled: student.enrolled,
        has_records: student.hasRecords,
        question_count: student.questionCount,
        submitted_count: student.submittedCount,
        missing_count: student.missingCount,
        submission_rate: student.submissionRate,
        avg_percent: student.avgPercent,
        median_percent: student.medianPercent,
        best_percent: student.bestPercent,
        worst_percent: student.worstPercent,
        total_attempts: student.totalAttempts,
        attempts_per_submission: student.submittedCount
          ? round(student.totalAttempts / student.submittedCount, 2)
          : null,
        late_count: student.lateCount,
        compile_error_count: student.compileErrorCount,
        total_code_lines: student.totalCodeLines,
        first_submission_at: isoLocal(student.firstSubmissionAt),
        last_submission_at: isoLocal(student.lastSubmissionAt),
        active_days: new Set(events.map(event => dateKey(event.at))).size,
        last_course_access: isoLocal(student.lastCourseAccess),
        risk_score: student.risk.score,
        risk_level: student.risk.level,
        risk_reasons: student.risk.reasons.map(reason => reason.code)
      };
    })
  },
  {
    id: 'submissions',
    group: 'cross',
    file: 'submissions.csv',
    title: 'Entregas (aluno × questão)',
    description: 'A tabela-fato: uma linha por par aluno × questão esperada, inclusive quando não houve entrega.',
    tip: 'É a tabela mais versátil. `df.pivot_table(index="student_key", columns="question_key", values="percent")` reconstrói a planilha de notas; filtrar `submitted == False` lista as ausências.',
    columns: () => columnList([
      ...QUESTION_ID_COLUMNS,
      ['section', 'Seção do Moodle da questão.'],
      ...STUDENT_ID_COLUMNS,
      ['submitted', 'Se houve entrega.'],
      ['submitted_at', 'Data/hora da entrega final (ISO local).'],
      ['submitted_at_epoch', 'Mesma data em milissegundos desde 1970 (UTC).'],
      ['due_date', 'Prazo da atividade (ISO local).'],
      ['hours_before_due', 'Horas entre a entrega e o prazo. Negativo = entregou depois do prazo.'],
      ['late', 'Se a entrega passou do prazo.'],
      ['attempts', 'Tentativas registradas nesta questão.'],
      ['grade', 'Nota automática do VPL na escala da atividade.'],
      ['max_grade', 'Nota máxima da atividade.'],
      ['percent', 'grade / max_grade em %.'],
      ['passed', 'Se percent >= 60.'],
      ['has_compile_error', 'Se a avaliação automática registrou erro de compilação.'],
      ['failed_case_count', 'Quantos casos de teste falharam.'],
      ['failed_cases', 'Nomes dos casos reprovados, separados por " | ".'],
      ['code_lines', 'Linhas de código da entrega (sem vazias e comentários).'],
      ['has_code', 'Se o código-fonte foi capturado na importação.']
    ]),
    rows: (ctx) => ctx.pairs.map(pair => ({
      turma: pair.question.turma,
      question_key: pair.question.key,
      question_name: pair.question.name,
      section: pair.question.section ?? null,
      ...studentIdValues(pair.student),
      submitted: Boolean(pair.submission?.submitted),
      submitted_at: isoLocal(pair.submission?.submittedAt),
      submitted_at_epoch: pair.submission?.submittedAt ?? null,
      due_date: isoLocal(pair.question.dueDate),
      hours_before_due: pair.hoursBeforeDue,
      late: Boolean(pair.submission?.late),
      attempts: pair.submission?.attempts ?? null,
      grade: pair.submission?.grade ?? null,
      max_grade: pair.questionMetrics?.maxGrade ?? null,
      percent: pair.percent,
      passed: pair.percent === null ? null : pair.percent >= PASS_THRESHOLD,
      has_compile_error: Boolean(pair.submission?.hasCompileError),
      failed_case_count: (pair.submission?.failedCases || []).length,
      failed_cases: pair.submission?.failedCases || [],
      code_lines: pair.submission?.codeMetrics?.codeLines ?? null,
      has_code: Boolean(pair.submission?.code || pair.submission?.codeMetrics)
    }))
  },
  {
    id: 'risk_reasons',
    group: 'cross',
    file: 'risk_reasons.csv',
    title: 'Composição do risco',
    description: 'Formato longo: uma linha por motivo que somou pontos no score de risco de cada aluno.',
    tip: 'Permite auditar o score: `groupby("reason_code").weight.describe()` mostra quanto cada sinal está pesando na turma.',
    columns: () => columnList([
      ...STUDENT_ID_COLUMNS,
      ['turmas', 'Turmas do aluno.'],
      ['risk_score', 'Score total do aluno.'],
      ['risk_level', 'Faixa do score.'],
      ['reason_code', 'Código do motivo (noSubmission, missingSubmissions, lowGrades, lateSubmissions, strugglingEffort).'],
      ['reason_label', 'Descrição do motivo em português.'],
      ['reason_weight', 'Pontos que este motivo somou ao score.'],
      ['reason_value', 'Valor observado que gerou o motivo (questões faltantes, média, % de atrasos ou tentativas).']
    ]),
    rows: (ctx) => ctx.metrics.students.flatMap(student => student.risk.reasons.map(reason => ({
      ...studentIdValues(student),
      turmas: student.turmas,
      risk_score: student.risk.score,
      risk_level: student.risk.level,
      reason_code: reason.code,
      reason_label: RISK_REASON_LABELS[reason.code] || reason.code,
      reason_weight: reason.weight,
      reason_value: reason.value ?? null
    })))
  },
  {
    id: 'question_failed_cases',
    group: 'cross',
    file: 'question_failed_cases.csv',
    title: 'Casos de teste reprovados',
    description: 'Contagem de reprovações por caso de teste em cada questão. Sem limite de linhas (a tela mostra só os 8 primeiros).',
    tip: 'Aponta o erro conceitual concreto: um caso que reprova metade da turma normalmente indica uma regra do enunciado que não foi entendida.',
    columns: () => columnList([
      ...QUESTION_ID_COLUMNS,
      ['test_case', 'Nome do caso de teste como o VPL reportou.'],
      ['students_failed', 'Quantas entregas falharam neste caso.'],
      ['submitted_count', 'Entregas da questão (base do percentual).'],
      ['fail_rate', 'students_failed / submitted_count em %.']
    ]),
    rows: (ctx) => {
      const rows = [];
      ctx.metrics.questions.forEach(question => {
        const counter = new Map();
        ctx.pairs
          .filter(pair => pair.question.key === question.key && pair.submission?.submitted)
          .forEach(pair => (pair.submission.failedCases || []).forEach(name => {
            const label = String(name).trim();
            if (label) counter.set(label, (counter.get(label) || 0) + 1);
          }));

        [...counter.entries()]
          .sort((a, b) => b[1] - a[1])
          .forEach(([label, count]) => rows.push({
            turma: question.turma,
            question_key: question.key,
            question_name: question.name,
            test_case: label,
            students_failed: count,
            submitted_count: question.submittedCount,
            fail_rate: question.submittedCount ? round((count / question.submittedCount) * 100, 1) : null
          }));
      });
      return rows;
    }
  },
  {
    id: 'question_compile_errors',
    group: 'cross',
    file: 'question_compile_errors.csv',
    title: 'Erros de compilação',
    description: 'Mensagens de erro de compilação agrupadas por questão, com a contagem de ocorrências.',
    tip: 'Erros repetidos quase sempre são um único conceito de sintaxe/tipo faltando; vale material específico em vez de atendimento individual.',
    columns: () => columnList([
      ...QUESTION_ID_COLUMNS,
      ['compile_error', 'Mensagem do compilador, normalizada em uma linha.'],
      ['occurrences', 'Quantas entregas apresentaram esta mensagem.'],
      ['submitted_count', 'Entregas da questão (base do percentual).'],
      ['rate', 'occurrences / submitted_count em %.']
    ]),
    rows: (ctx) => {
      const rows = [];
      ctx.metrics.questions.forEach(question => {
        const counter = new Map();
        ctx.pairs
          .filter(pair => pair.question.key === question.key && pair.submission?.submitted)
          .forEach(pair => (pair.submission.compileErrors || []).forEach(message => {
            const label = String(message).trim();
            if (label) counter.set(label, (counter.get(label) || 0) + 1);
          }));

        [...counter.entries()]
          .sort((a, b) => b[1] - a[1])
          .forEach(([label, count]) => rows.push({
            turma: question.turma,
            question_key: question.key,
            question_name: question.name,
            compile_error: label,
            occurrences: count,
            submitted_count: question.submittedCount,
            rate: question.submittedCount ? round((count / question.submittedCount) * 100, 1) : null
          }));
      });
      return rows;
    }
  },
  {
    id: 'code_metrics',
    group: 'cross',
    file: 'code_metrics.csv',
    title: 'Métricas do código',
    description: 'Métricas estáticas de cada entrega com código capturado, incluindo conceitos de C++ e práticas detectadas.',
    tip: 'Cruze `code_lines` e `max_nesting_depth` com `percent`: costuma haver correlação fraca com a nota e forte com o número de tentativas.',
    columns: () => columnList([
      ...QUESTION_ID_COLUMNS,
      ...STUDENT_ID_COLUMNS,
      ['grade', 'Nota automática da entrega.'],
      ['percent', 'Nota percentual da entrega.'],
      ['total_lines', 'Linhas do arquivo, incluindo vazias e comentários.'],
      ['code_lines', 'Linhas de código efetivas.'],
      ['blank_lines', 'Linhas vazias.'],
      ['comment_lines', 'Linhas de comentário.'],
      ['comment_ratio', 'comment_lines / total_lines (0–1).'],
      ['characters', 'Tamanho do arquivo em caracteres.'],
      ['function_count', 'Funções distintas detectadas (aproximado).'],
      ['max_nesting_depth', 'Profundidade máxima de blocos { } — proxy de complexidade.'],
      ['magic_numbers', 'Ocorrências de números literais com 2+ dígitos.'],
      ['include_count', 'Quantidade de #include distintos.'],
      ['includes', 'Cabeçalhos incluídos, separados por " | ".'],
      ...conceptColumns(),
      ...smellColumns()
    ]),
    rows: (ctx) => ctx.pairs
      .filter(pair => pair.submission?.codeMetrics)
      .map(pair => {
        const code = pair.submission.codeMetrics;
        return {
          turma: pair.question.turma,
          question_key: pair.question.key,
          question_name: pair.question.name,
          ...studentIdValues(pair.student),
          grade: pair.submission.grade ?? null,
          percent: pair.percent,
          total_lines: code.totalLines ?? null,
          code_lines: code.codeLines ?? null,
          blank_lines: code.blankLines ?? null,
          comment_lines: code.commentLines ?? null,
          comment_ratio: code.commentRatio ?? null,
          characters: code.characters ?? null,
          function_count: code.functionCount ?? null,
          max_nesting_depth: code.maxNestingDepth ?? null,
          magic_numbers: code.magicNumbers ?? null,
          include_count: (code.includes || []).length,
          includes: code.includes || [],
          ...conceptValues(code.concepts),
          ...smellValues(code.smells)
        };
      })
  },
  {
    id: 'concept_coverage',
    group: 'cross',
    file: 'concept_coverage.csv',
    title: 'Conceitos por aluno',
    description: 'Percentual de alunos que usou cada construção de C++ em pelo menos uma entrega.',
    columns: () => columnList([
      ['scope', 'Recorte da seleção exportada.'],
      ['concept_key', 'Identificador do conceito.'],
      ['concept_label', 'Nome do conceito em português.'],
      ['students_using', 'Alunos que usaram o conceito em alguma questão.'],
      ['students_with_code', 'Alunos com pelo menos um código capturado (base do percentual).'],
      ['rate', 'students_using / students_with_code em %.']
    ]),
    rows: (ctx) => ctx.metrics.conceptCoverage.map(concept => ({
      scope: ctx.merged.turma,
      concept_key: concept.key,
      concept_label: concept.label,
      students_using: concept.count,
      students_with_code: concept.total,
      rate: concept.rate
    }))
  },
  {
    id: 'question_concepts',
    group: 'cross',
    file: 'question_concepts.csv',
    title: 'Conceitos por questão',
    description: 'Formato longo: uso de cada conceito de C++ dentro de cada questão.',
    tip: 'Mostra se a turma resolveu a questão do jeito esperado — uma questão de vetores resolvida sem `arrays` sugere solução alternativa (ou cópia).',
    columns: () => columnList([
      ...QUESTION_ID_COLUMNS,
      ['concept_key', 'Identificador do conceito.'],
      ['concept_label', 'Nome do conceito em português.'],
      ['submissions_using', 'Entregas que usaram o conceito.'],
      ['submissions_with_code', 'Entregas com código capturado (base do percentual).'],
      ['rate', 'submissions_using / submissions_with_code em %.']
    ]),
    rows: (ctx) => ctx.metrics.questions.flatMap(question =>
      Object.entries(question.conceptUsage).map(([key, usage]) => ({
        turma: question.turma,
        question_key: question.key,
        question_name: question.name,
        concept_key: key,
        concept_label: usage.label,
        submissions_using: usage.count,
        submissions_with_code: usage.total,
        rate: usage.total ? round((usage.count / usage.total) * 100, 1) : null
      }))
    )
  },
  {
    id: 'code_smells',
    group: 'cross',
    file: 'code_smells.csv',
    title: 'Práticas detectadas',
    description: 'Frequência das práticas sinalizadas no código (using namespace std, goto, variáveis globais, system("pause")).',
    columns: () => columnList([
      ['scope', 'Recorte da seleção exportada.'],
      ['smell_key', 'Identificador da prática.'],
      ['smell_label', 'Nome da prática em português.'],
      ['submissions', 'Entregas em que a prática apareceu.'],
      ['submissions_total', 'Entregas com código capturado (base do percentual).'],
      ['rate', 'submissions / submissions_total em %.']
    ]),
    rows: (ctx) => ctx.metrics.smellCounts.map(smell => ({
      scope: ctx.merged.turma,
      smell_key: smell.key,
      smell_label: smell.label,
      submissions: smell.count,
      submissions_total: smell.total,
      rate: smell.rate
    }))
  },
  {
    id: 'grade_histogram',
    group: 'cross',
    file: 'grade_histogram.csv',
    title: 'Histogramas de nota',
    description: 'Faixas de 10% já contadas, tanto das médias por aluno quanto das notas de cada questão.',
    tip: 'Útil para reproduzir os gráficos da tela; para histogramas com outro número de faixas, use `submissions.csv` diretamente.',
    columns: () => columnList([
      ['level', 'student_avg (média por aluno) ou question (notas de uma questão).'],
      ['scope', 'Turma, "__combinado__" ou a chave da questão, conforme o level.'],
      ['scope_name', 'Nome legível do recorte.'],
      ['bin_label', 'Faixa de nota.'],
      ['bin_from', 'Início da faixa em %.'],
      ['bin_to', 'Fim da faixa em %.'],
      ['count', 'Quantidade observada na faixa.']
    ]),
    rows: (ctx) => {
      const rows = [];
      const push = (level, scope, scopeName, histogram) => histogram.forEach(bin => rows.push({
        level, scope, scope_name: scopeName,
        bin_label: bin.label, bin_from: bin.from, bin_to: bin.to, count: bin.count
      }));

      ctx.metrics.byTurma.forEach(entry => push('student_avg', entry.turma, entry.turma, entry.overview.histogram));
      if (ctx.merged.combined) push('student_avg', '__combinado__', ctx.merged.turma, ctx.metrics.overview.histogram);
      ctx.metrics.questions.forEach(question => push('question', question.key, question.name, question.histogram));
      return rows;
    }
  },
  {
    id: 'professor_comparison',
    group: 'cross',
    file: 'professor_comparison.csv',
    title: 'Nota automática × nota do professor',
    description: 'Comparação entre a nota do VPL e a nota lançada na aba de Revisão, quando existe uma turma de correção com o mesmo nome.',
    tip: 'Um `delta` sistematicamente positivo indica que a correção humana é mais generosa que os casos de teste — vale revisar os testes.',
    columns: () => columnList([
      ['turma', 'Turma de correção de onde veio a nota do professor.'],
      ['student_id', 'ID do usuário no Moodle.'],
      ['student_name', 'Nome do aluno.'],
      ['vpl_avg_percent', 'Média percentual das notas automáticas.'],
      ['professor_avg_score', 'Média das notas lançadas pelo professor (0–100).'],
      ['delta', 'professor_avg_score − vpl_avg_percent.']
    ]),
    rows: (ctx) => (ctx.metrics.professorComparison?.rows || []).map(row => ({
      turma: row.turma ?? null,
      student_id: row.userId ?? null,
      student_name: row.name,
      vpl_avg_percent: row.automaticAvg,
      professor_avg_score: row.professorAvg,
      delta: row.delta
    }))
  },

  // ---------------------------------------------------------- séries temporais
  {
    id: 'submission_events',
    group: 'timeseries',
    file: 'submission_events.csv',
    title: 'Eventos de envio',
    description: 'Espinha temporal: uma linha por envio (cada tentativa, quando o histórico completo foi importado).',
    tip: 'Base de qualquer série temporal: `pd.to_datetime(df.submitted_at)` e depois `resample("D")`, `dt.hour`, `dt.dayofweek`.',
    columns: () => columnList([
      ...QUESTION_ID_COLUMNS,
      ...STUDENT_ID_COLUMNS,
      ['submitted_at', 'Data/hora do envio (ISO local).'],
      ['submitted_at_epoch', 'Mesma data em milissegundos desde 1970 (UTC).'],
      ['date', 'Dia do envio (YYYY-MM-DD, fuso local).'],
      ['month', 'Mês do envio (YYYY-MM).'],
      ['hour', 'Hora do dia (0–23, fuso local).'],
      ['weekday', 'Dia da semana (0 = domingo).'],
      ['weekday_label', 'Nome do dia da semana.'],
      ['attempt_index', 'Ordem desta tentativa dentro da questão (1 = primeira).'],
      ['attempt_count', 'Total de tentativas registradas para o par aluno × questão.'],
      ['is_final', 'Se é o último envio conhecido (o que vale a nota).'],
      ['source', 'history = veio do histórico de tentativas; final = veio do envio final.'],
      ['grade', 'Nota registrada neste envio, quando o histórico traz nota.'],
      ['percent', 'Nota percentual deste envio.'],
      ['hours_before_due', 'Horas entre o envio e o prazo. Negativo = após o prazo.'],
      ['lead_time_bucket', 'Faixa de antecedência (a mesma do gráfico da tela).'],
      ['after_due', 'Se o envio ocorreu após o prazo.']
    ]),
    rows: (ctx) => ctx.events.map(event => ({
      turma: event.question.turma,
      question_key: event.question.key,
      question_name: event.question.name,
      ...studentIdValues(event.student),
      submitted_at: isoLocal(event.at),
      submitted_at_epoch: event.at,
      date: dateKey(event.at),
      month: monthKey(event.at),
      hour: event.hour,
      weekday: event.weekday,
      weekday_label: WEEKDAY_LABELS[event.weekday],
      attempt_index: event.attemptIndex,
      attempt_count: event.attemptCount,
      is_final: event.isFinal,
      source: event.source,
      grade: event.grade,
      percent: event.percent,
      hours_before_due: event.hoursBeforeDue,
      lead_time_bucket: event.hoursBeforeDue === null ? null : leadTimeBucket(event.hoursBeforeDue).key,
      after_due: event.hoursBeforeDue === null ? null : event.hoursBeforeDue < 0
    }))
  },
  {
    id: 'timeline_daily',
    group: 'timeseries',
    file: 'timeline_daily.csv',
    title: 'Série diária por turma',
    description: 'Envios por dia em cada turma, com alunos ativos no dia e acumulado.',
    tip: 'Série pronta para `plot()`. Reindexe com `asfreq("D", fill_value=0)` antes de médias móveis — dias sem envio não aparecem no arquivo.',
    columns: () => columnList([
      ['turma', 'Importação (turma) de origem.'],
      ['date', 'Dia (YYYY-MM-DD, fuso local).'],
      ['submissions', 'Envios no dia.'],
      ['active_students', 'Alunos distintos que enviaram algo no dia.'],
      ['questions_touched', 'Questões distintas que receberam envio no dia.'],
      ['cumulative_submissions', 'Acumulado de envios da turma até o dia.']
    ]),
    rows: (ctx) => {
      const rows = [];
      ctx.merged.turmas.forEach(turma => {
        const byDate = groupBy(
          ctx.events.filter(event => event.question.turma === turma),
          event => dateKey(event.at)
        );
        let cumulative = 0;
        [...byDate.keys()].sort().forEach(date => {
          const events = byDate.get(date);
          cumulative += events.length;
          rows.push({
            turma,
            date,
            submissions: events.length,
            active_students: new Set(events.map(event => event.studentKey)).size,
            questions_touched: new Set(events.map(event => event.question.key)).size,
            cumulative_submissions: cumulative
          });
        });
      });
      return rows;
    }
  },
  {
    id: 'student_daily_activity',
    group: 'timeseries',
    file: 'student_daily_activity.csv',
    title: 'Atividade diária por aluno',
    description: 'Dados em painel (aluno × dia): quantos envios cada aluno fez em cada dia.',
    tip: 'Formato ideal para medir regularidade e detectar abandono: conte dias ativos por semana e veja onde a série de um aluno para.',
    columns: () => columnList([
      ['turma', 'Importação (turma) de origem.'],
      ...STUDENT_ID_COLUMNS,
      ['date', 'Dia (YYYY-MM-DD, fuso local).'],
      ['submissions', 'Envios do aluno no dia.'],
      ['questions_touched', 'Questões distintas trabalhadas no dia.'],
      ['best_percent', 'Melhor nota percentual registrada no dia, quando houver nota.']
    ]),
    rows: (ctx) => {
      const buckets = new Map();
      ctx.events.forEach(event => {
        const date = dateKey(event.at);
        // A chave junta turma + aluno + dia; o conteudo do bucket guarda os
        // campos originais porque nome de turma pode conter espaco.
        const key = [event.question.turma, event.studentKey, date].join(String.fromCharCode(31));
        if (!buckets.has(key)) {
          buckets.set(key, { turma: event.question.turma, student: event.student, date, events: [] });
        }
        buckets.get(key).events.push(event);
      });

      return [...buckets.values()].map(bucket => {
        const percentages = bucket.events
          .map(event => event.percent)
          .filter(value => value !== null && value !== undefined);
        return {
          turma: bucket.turma,
          ...studentIdValues(bucket.student),
          date: bucket.date,
          submissions: bucket.events.length,
          questions_touched: new Set(bucket.events.map(event => event.question.key)).size,
          best_percent: percentages.length ? Math.max(...percentages) : null
        };
      }).sort((a, b) => a.date.localeCompare(b.date) || String(a.student_name).localeCompare(String(b.student_name)));
    }
  },
  {
    id: 'question_timeline',
    group: 'timeseries',
    file: 'question_timeline.csv',
    title: 'Série diária por questão',
    description: 'Envios por dia em cada questão, com a distância do dia até o prazo.',
    tip: 'Alinhe as questões por `days_to_due` para comparar o padrão de procrastinação entre atividades com prazos diferentes.',
    columns: () => columnList([
      ...QUESTION_ID_COLUMNS,
      ['date', 'Dia (YYYY-MM-DD, fuso local).'],
      ['submissions', 'Envios da questão no dia.'],
      ['active_students', 'Alunos distintos que enviaram no dia.'],
      ['days_to_due', 'Dias entre o dia e o prazo. Negativo = depois do prazo.']
    ]),
    rows: (ctx) => {
      const buckets = new Map();
      ctx.events.forEach(event => {
        const key = `${event.question.key} ${dateKey(event.at)}`;
        if (!buckets.has(key)) buckets.set(key, { question: event.question, date: dateKey(event.at), events: [] });
        buckets.get(key).events.push(event);
      });

      return [...buckets.values()].map(bucket => {
        const dueDay = bucket.question.dueDate ? dateKey(bucket.question.dueDate) : null;
        const daysToDue = dueDay
          ? Math.round((Date.parse(`${dueDay}T00:00:00`) - Date.parse(`${bucket.date}T00:00:00`)) / 86400000)
          : null;
        return {
          turma: bucket.question.turma,
          question_key: bucket.question.key,
          question_name: bucket.question.name,
          date: bucket.date,
          submissions: bucket.events.length,
          active_students: new Set(bucket.events.map(event => event.studentKey)).size,
          days_to_due: daysToDue
        };
      }).sort((a, b) => String(a.question_key).localeCompare(String(b.question_key)) || a.date.localeCompare(b.date));
    }
  },
  {
    id: 'activity_by_hour',
    group: 'timeseries',
    file: 'activity_by_hour.csv',
    title: 'Envios por hora do dia',
    description: 'Distribuição dos envios pelas 24 horas, por turma (todas as horas presentes, inclusive com zero).',
    columns: () => columnList([
      ['turma', 'Importação (turma) de origem.'],
      ['hour', 'Hora do dia (0–23, fuso local da máquina que exportou).'],
      ['submissions', 'Envios naquela hora.'],
      ['share', '% dos envios da turma que caem naquela hora.']
    ]),
    rows: (ctx) => {
      const rows = [];
      ctx.merged.turmas.forEach(turma => {
        const events = ctx.events.filter(event => event.question.turma === turma);
        Array.from({ length: 24 }, (_, hour) => hour).forEach(hour => {
          const count = events.filter(event => event.hour === hour).length;
          rows.push({
            turma, hour, submissions: count,
            share: events.length ? round((count / events.length) * 100, 2) : 0
          });
        });
      });
      return rows;
    }
  },
  {
    id: 'activity_by_weekday',
    group: 'timeseries',
    file: 'activity_by_weekday.csv',
    title: 'Envios por dia da semana',
    description: 'Distribuição dos envios pelos sete dias da semana, por turma.',
    columns: () => columnList([
      ['turma', 'Importação (turma) de origem.'],
      ['weekday', 'Dia da semana (0 = domingo).'],
      ['weekday_label', 'Nome do dia da semana.'],
      ['submissions', 'Envios naquele dia da semana.'],
      ['share', '% dos envios da turma naquele dia da semana.']
    ]),
    rows: (ctx) => {
      const rows = [];
      ctx.merged.turmas.forEach(turma => {
        const events = ctx.events.filter(event => event.question.turma === turma);
        WEEKDAY_LABELS.forEach((label, weekday) => {
          const count = events.filter(event => event.weekday === weekday).length;
          rows.push({
            turma, weekday, weekday_label: label, submissions: count,
            share: events.length ? round((count / events.length) * 100, 2) : 0
          });
        });
      });
      return rows;
    }
  },
  {
    id: 'activity_heatmap',
    group: 'timeseries',
    file: 'activity_heatmap.csv',
    title: 'Matriz dia × hora',
    description: 'Formato longo da matriz de engajamento: 168 linhas por turma (7 dias × 24 horas).',
    tip: 'Reconstrua o mapa de calor com `df.pivot(index="weekday", columns="hour", values="submissions")`.',
    columns: () => columnList([
      ['turma', 'Importação (turma) de origem.'],
      ['weekday', 'Dia da semana (0 = domingo).'],
      ['weekday_label', 'Nome do dia da semana.'],
      ['hour', 'Hora do dia (0–23, fuso local).'],
      ['submissions', 'Envios naquela célula.']
    ]),
    rows: (ctx) => {
      const rows = [];
      ctx.merged.turmas.forEach(turma => {
        const events = ctx.events.filter(event => event.question.turma === turma);
        WEEKDAY_LABELS.forEach((label, weekday) => {
          Array.from({ length: 24 }, (_, hour) => hour).forEach(hour => {
            rows.push({
              turma, weekday, weekday_label: label, hour,
              submissions: events.filter(event => event.weekday === weekday && event.hour === hour).length
            });
          });
        });
      });
      return rows;
    }
  },
  {
    id: 'lead_time',
    group: 'timeseries',
    file: 'lead_time.csv',
    title: 'Antecedência das entregas',
    description: 'Distribuição das entregas finais por faixa de antecedência em relação ao prazo, questão por questão.',
    tip: 'Concentração em "lastHour" e "late" é o sinal clássico de procrastinação; compare entre questões para ver se o prazo foi o problema.',
    columns: () => columnList([
      ...QUESTION_ID_COLUMNS,
      ['bucket_key', 'Identificador da faixa (moreThan48h, from24to48h, from6to24h, from1to6h, lastHour, late).'],
      ['bucket_label', 'Descrição da faixa em português.'],
      ['submissions', 'Entregas na faixa.'],
      ['share', '% das entregas com prazo conhecido que caem na faixa.']
    ]),
    rows: (ctx) => {
      const rows = [];
      ctx.metrics.questions.forEach(question => {
        const withDue = ctx.pairs.filter(pair =>
          pair.question.key === question.key && pair.submission?.submitted && pair.hoursBeforeDue !== null);
        if (!withDue.length) return;

        LEAD_TIME_BUCKETS.forEach(bucket => {
          const count = withDue.filter(pair => leadTimeBucket(pair.hoursBeforeDue).key === bucket.key).length;
          rows.push({
            turma: question.turma,
            question_key: question.key,
            question_name: question.name,
            bucket_key: bucket.key,
            bucket_label: bucket.label,
            submissions: count,
            share: round((count / withDue.length) * 100, 2)
          });
        });
      });
      return rows;
    }
  },

  // ----------------------------------------------------------------- unificado
  {
    id: 'unified_submissions',
    group: 'unified',
    file: 'unified_submissions.csv',
    title: 'Unificado — entregas',
    description: 'Tabela larga e desnormalizada: cada entrega esperada com os atributos do aluno, da questão, do tempo e do código na mesma linha.',
    tip: 'É o arquivo para abrir primeiro em um notebook: um único read_csv já permite regressões e cruzamentos sem nenhum merge.',
    columns: (ctx) => columnList([
      ...QUESTION_ID_COLUMNS,
      ['section', 'Seção do Moodle da questão.'],
      ['question_max_grade', 'Nota máxima da questão.'],
      ['question_due_date', 'Prazo da questão (ISO local).'],
      ['question_avg_percent', 'Média da questão na turma — contexto para comparar a nota do aluno.'],
      ['question_difficulty_index', 'Índice de dificuldade da questão (0–100).'],
      ['question_submission_rate', 'Taxa de entrega da questão em %.'],
      ...STUDENT_ID_COLUMNS,
      ['email', 'E-mail do aluno.'],
      ['groups', 'Grupos do Moodle.'],
      ['student_turmas', 'Turmas em que o aluno aparece.'],
      ['student_avg_percent', 'Média geral do aluno.'],
      ['student_submission_rate', 'Taxa de entrega do aluno.'],
      ['student_total_attempts', 'Tentativas totais do aluno.'],
      ['risk_score', 'Score de risco do aluno.'],
      ['risk_level', 'Faixa de risco do aluno.'],
      ['submitted', 'Se houve entrega.'],
      ['submitted_at', 'Data/hora da entrega final (ISO local).'],
      ['date', 'Dia da entrega (YYYY-MM-DD).'],
      ['hour', 'Hora da entrega (0–23).'],
      ['weekday_label', 'Dia da semana da entrega.'],
      ['hours_before_due', 'Horas entre a entrega e o prazo. Negativo = após o prazo.'],
      ['lead_time_bucket', 'Faixa de antecedência da entrega.'],
      ['late', 'Se a entrega passou do prazo.'],
      ['attempts', 'Tentativas nesta questão.'],
      ['grade', 'Nota automática.'],
      ['percent', 'Nota percentual.'],
      ['passed', 'Se percent >= 60.'],
      ['has_compile_error', 'Se houve erro de compilação.'],
      ['failed_case_count', 'Casos de teste reprovados.'],
      ['code_lines', 'Linhas de código.'],
      ['comment_ratio', 'Proporção de linhas de comentário.'],
      ['function_count', 'Funções detectadas.'],
      ['max_nesting_depth', 'Profundidade máxima de blocos.'],
      ...conceptColumns()
    ]),
    rows: (ctx) => ctx.pairs.map(pair => {
      const submission = pair.submission;
      const code = submission?.codeMetrics || null;
      const submittedAt = submission?.submittedAt ?? null;
      const date = submittedAt ? new Date(submittedAt) : null;
      return {
        turma: pair.question.turma,
        question_key: pair.question.key,
        question_name: pair.question.name,
        section: pair.question.section ?? null,
        question_max_grade: pair.questionMetrics?.maxGrade ?? null,
        question_due_date: isoLocal(pair.question.dueDate),
        question_avg_percent: pair.questionMetrics?.avgPercent ?? null,
        question_difficulty_index: pair.questionMetrics?.difficultyIndex ?? null,
        question_submission_rate: pair.questionMetrics?.submissionRate ?? null,
        ...studentIdValues(pair.student),
        email: pair.student.email ?? null,
        groups: pair.student.groups || [],
        student_turmas: pair.studentMetrics?.turmas || [],
        student_avg_percent: pair.studentMetrics?.avgPercent ?? null,
        student_submission_rate: pair.studentMetrics?.submissionRate ?? null,
        student_total_attempts: pair.studentMetrics?.totalAttempts ?? null,
        risk_score: pair.studentMetrics?.risk.score ?? null,
        risk_level: pair.studentMetrics?.risk.level ?? null,
        submitted: Boolean(submission?.submitted),
        submitted_at: isoLocal(submittedAt),
        date: dateKey(submittedAt),
        hour: date ? date.getHours() : null,
        weekday_label: date ? WEEKDAY_LABELS[date.getDay()] : null,
        hours_before_due: pair.hoursBeforeDue,
        lead_time_bucket: pair.hoursBeforeDue === null ? null : leadTimeBucket(pair.hoursBeforeDue).key,
        late: Boolean(submission?.late),
        attempts: submission?.attempts ?? null,
        grade: submission?.grade ?? null,
        percent: pair.percent,
        passed: pair.percent === null ? null : pair.percent >= PASS_THRESHOLD,
        has_compile_error: Boolean(submission?.hasCompileError),
        failed_case_count: (submission?.failedCases || []).length,
        code_lines: code?.codeLines ?? null,
        comment_ratio: code?.commentRatio ?? null,
        function_count: code?.functionCount ?? null,
        max_nesting_depth: code?.maxNestingDepth ?? null,
        ...conceptValues(code?.concepts)
      };
    })
  },
  {
    id: 'unified_students',
    group: 'unified',
    file: 'unified_students.csv',
    title: 'Unificado — alunos',
    description: 'Um aluno por linha reunindo desempenho, risco, hábitos de horário e conceitos dominados.',
    tip: 'Boa entrada para clusterização (k-means em nota, regularidade e antecedência) e para modelos de evasão.',
    columns: () => columnList([
      ...STUDENT_ID_COLUMNS,
      ['email', 'E-mail do aluno.'],
      ['turmas', 'Turmas em que aparece.'],
      ['groups', 'Grupos do Moodle.'],
      ['question_count', 'Questões esperadas dele.'],
      ['submitted_count', 'Questões entregues.'],
      ['submission_rate', 'Taxa de entrega em %.'],
      ['avg_percent', 'Média das notas percentuais.'],
      ['median_percent', 'Mediana das notas percentuais.'],
      ['best_percent', 'Melhor nota percentual.'],
      ['worst_percent', 'Pior nota percentual.'],
      ['total_attempts', 'Tentativas somadas.'],
      ['attempts_per_submission', 'Tentativas por entrega.'],
      ['late_count', 'Entregas após o prazo.'],
      ['compile_error_count', 'Entregas que não compilaram.'],
      ['total_code_lines', 'Linhas de código somadas.'],
      ['risk_score', 'Score de risco 0–100.'],
      ['risk_level', 'Faixa do score.'],
      ['first_submission_at', 'Primeiro envio (ISO local).'],
      ['last_submission_at', 'Último envio (ISO local).'],
      ['active_days', 'Dias distintos com envio.'],
      ['span_days', 'Dias entre o primeiro e o último envio.'],
      ['submissions_per_active_day', 'Envios por dia ativo — mede se o trabalho foi concentrado.'],
      ['median_hour', 'Hora mediana dos envios (0–23).'],
      ['night_share', '% dos envios entre 22h e 6h.'],
      ['weekend_share', '% dos envios em sábado ou domingo.'],
      ['avg_hours_before_due', 'Antecedência média das entregas, em horas.'],
      ['last_minute_share', '% das entregas feitas na última hora antes do prazo.'],
      ['after_due_share', '% das entregas feitas depois do prazo.'],
      ['last_course_access', 'Último acesso ao curso (ISO local).'],
      ...conceptColumns()
    ]),
    rows: (ctx) => ctx.metrics.students.map(student => {
      const key = studentKey(student);
      const events = ctx.eventsByStudent.get(key) || [];
      const hours = events.map(event => event.hour);
      const days = new Set(events.map(event => dateKey(event.at)));
      const finals = ctx.pairs.filter(pair =>
        pair.studentKey === key && pair.submission?.submitted && pair.hoursBeforeDue !== null);
      const sortedHours = [...hours].sort((a, b) => a - b);

      return {
        ...studentIdValues(student),
        email: student.email,
        turmas: student.turmas,
        groups: student.groups,
        question_count: student.questionCount,
        submitted_count: student.submittedCount,
        submission_rate: student.submissionRate,
        avg_percent: student.avgPercent,
        median_percent: student.medianPercent,
        best_percent: student.bestPercent,
        worst_percent: student.worstPercent,
        total_attempts: student.totalAttempts,
        attempts_per_submission: student.submittedCount
          ? round(student.totalAttempts / student.submittedCount, 2)
          : null,
        late_count: student.lateCount,
        compile_error_count: student.compileErrorCount,
        total_code_lines: student.totalCodeLines,
        risk_score: student.risk.score,
        risk_level: student.risk.level,
        first_submission_at: isoLocal(student.firstSubmissionAt),
        last_submission_at: isoLocal(student.lastSubmissionAt),
        active_days: days.size,
        span_days: student.firstSubmissionAt && student.lastSubmissionAt
          ? round((student.lastSubmissionAt - student.firstSubmissionAt) / 86400000, 2)
          : null,
        submissions_per_active_day: days.size ? round(events.length / days.size, 2) : null,
        median_hour: sortedHours.length ? sortedHours[Math.floor(sortedHours.length / 2)] : null,
        night_share: events.length
          ? round((events.filter(event => event.hour >= 22 || event.hour < 6).length / events.length) * 100, 1)
          : null,
        weekend_share: events.length
          ? round((events.filter(event => event.weekday === 0 || event.weekday === 6).length / events.length) * 100, 1)
          : null,
        avg_hours_before_due: finals.length
          ? round(finals.reduce((acc, pair) => acc + pair.hoursBeforeDue, 0) / finals.length, 2)
          : null,
        last_minute_share: finals.length
          ? round((finals.filter(pair => pair.hoursBeforeDue >= 0 && pair.hoursBeforeDue < 1).length / finals.length) * 100, 1)
          : null,
        after_due_share: finals.length
          ? round((finals.filter(pair => pair.hoursBeforeDue < 0).length / finals.length) * 100, 1)
          : null,
        last_course_access: isoLocal(student.lastCourseAccess),
        ...conceptValues(student.concepts)
      };
    })
  },
  {
    id: 'unified_events',
    group: 'unified',
    file: 'unified_events.csv',
    title: 'Unificado — eventos no tempo',
    description: 'Cada envio no tempo já enriquecido com o perfil do aluno e as características da questão.',
    tip: 'Junta o eixo temporal com o transversal: permite perguntar se quem entrega de madrugada tira notas menores sem nenhum merge.',
    columns: () => columnList([
      ...QUESTION_ID_COLUMNS,
      ['question_difficulty_index', 'Índice de dificuldade da questão.'],
      ['question_avg_percent', 'Média da questão na turma.'],
      ['question_due_date', 'Prazo da questão (ISO local).'],
      ...STUDENT_ID_COLUMNS,
      ['student_avg_percent', 'Média geral do aluno.'],
      ['student_submission_rate', 'Taxa de entrega do aluno.'],
      ['risk_score', 'Score de risco do aluno.'],
      ['risk_level', 'Faixa de risco do aluno.'],
      ['submitted_at', 'Data/hora do envio (ISO local).'],
      ['submitted_at_epoch', 'Data/hora do envio em milissegundos (UTC).'],
      ['date', 'Dia do envio.'],
      ['month', 'Mês do envio (YYYY-MM).'],
      ['hour', 'Hora do envio.'],
      ['weekday_label', 'Dia da semana do envio.'],
      ['attempt_index', 'Ordem da tentativa.'],
      ['attempt_count', 'Total de tentativas do par aluno × questão.'],
      ['is_final', 'Se é o envio que vale a nota.'],
      ['grade', 'Nota registrada no envio, quando houver.'],
      ['percent', 'Nota percentual do envio.'],
      ['hours_before_due', 'Horas entre o envio e o prazo.'],
      ['lead_time_bucket', 'Faixa de antecedência.']
    ]),
    rows: (ctx) => ctx.events.map(event => ({
      turma: event.question.turma,
      question_key: event.question.key,
      question_name: event.question.name,
      question_difficulty_index: event.questionMetrics?.difficultyIndex ?? null,
      question_avg_percent: event.questionMetrics?.avgPercent ?? null,
      question_due_date: isoLocal(event.question.dueDate),
      ...studentIdValues(event.student),
      student_avg_percent: event.studentMetrics?.avgPercent ?? null,
      student_submission_rate: event.studentMetrics?.submissionRate ?? null,
      risk_score: event.studentMetrics?.risk.score ?? null,
      risk_level: event.studentMetrics?.risk.level ?? null,
      submitted_at: isoLocal(event.at),
      submitted_at_epoch: event.at,
      date: dateKey(event.at),
      month: monthKey(event.at),
      hour: event.hour,
      weekday_label: WEEKDAY_LABELS[event.weekday],
      attempt_index: event.attemptIndex,
      attempt_count: event.attemptCount,
      is_final: event.isFinal,
      grade: event.grade,
      percent: event.percent,
      hours_before_due: event.hoursBeforeDue,
      lead_time_bucket: event.hoursBeforeDue === null ? null : leadTimeBucket(event.hoursBeforeDue).key
    }))
  },
  {
    id: 'students_wide',
    group: 'unified',
    file: 'students_wide.csv',
    title: 'Unificado — planilha de notas',
    description: 'Formato largo (alunos × questões), como uma planilha: quatro colunas por questão (nota, entrega, tentativas, atraso).',
    tip: 'Formato direto para matriz de correlação entre questões (`df.filter(like="_percent").corr()`) e para conferir com o diário de classe.',
    columns: (ctx) => columnList([
      ...STUDENT_ID_COLUMNS,
      ['turmas', 'Turmas em que o aluno aparece.'],
      ['avg_percent', 'Média das notas percentuais.'],
      ['submission_rate', 'Taxa de entrega em %.'],
      ['risk_level', 'Faixa de risco.'],
      ...ctx.metrics.questions.flatMap(question => {
        const prefix = wideQuestionPrefix(ctx, question);
        return [
          [`${prefix}_percent`, `Nota percentual em "${question.name}" (${question.turma}).`],
          [`${prefix}_submitted`, `Se entregou "${question.name}".`],
          [`${prefix}_attempts`, `Tentativas em "${question.name}".`],
          [`${prefix}_late`, `Se entregou "${question.name}" após o prazo.`]
        ];
      })
    ]),
    rows: (ctx) => ctx.metrics.students.map(student => {
      const row = {
        ...studentIdValues(student),
        turmas: student.turmas,
        avg_percent: student.avgPercent,
        submission_rate: student.submissionRate,
        risk_level: student.risk.level
      };
      const byKey = new Map(student.questions.map(question => [question.key, question]));
      ctx.metrics.questions.forEach(question => {
        const prefix = wideQuestionPrefix(ctx, question);
        const entry = byKey.get(question.key);
        // Questão de outra turma: fica vazio, e não zero — o aluno não deixou de
        // entregar, a questão simplesmente não era dele.
        row[`${prefix}_percent`] = entry ? entry.percent : null;
        row[`${prefix}_submitted`] = entry ? entry.submitted : null;
        row[`${prefix}_attempts`] = entry ? entry.attempts : null;
        row[`${prefix}_late`] = entry ? entry.late : null;
      });
      return row;
    })
  }
,
  // ------------------------------------------------------------- aprendizado
  {
    id: 'learning_indicators',
    group: 'learning',
    file: 'learning_indicators.csv',
    title: 'Indicadores de aprendizado',
    description: 'Uma linha por aluno **por turma**, com os dezessete indicadores das cinco dimensões, os escores relativos e o desfecho.',
    tip: 'Para uma pergunta de alerta precoce use só as colunas de família `comportamento` (veja no dicionário): as de desempenho saem das mesmas notas que compõem o desfecho, e um modelo que as use acerta por construção.',
    columns: () => columnList([
      ['turma', 'Importação (turma) de origem. Os indicadores são calculados dentro dela, com o período dela.'],
      ['student_key', 'Identificador do aluno.'],
      ['student_name', 'Nome do aluno.'],
      ['email', 'E-mail do aluno.'],
      ['id_number', 'Matrícula — a chave que liga esta base ao portal acadêmico.'],
      ['from_logs', 'Se os logs de acesso do Moodle foram coletados nesta turma. Quando False, dias ativos, intervalo e silêncio saem das **datas de entrega**: outro dado com o mesmo nome.'],
      ['from_history', 'Se a turma foi importada com o histórico de tentativas.'],
      ['from_taxonomy', 'Se a turma tem taxonomia de conceitos vinculada.'],
      ...DIMENSIONS.flatMap(dimension => [
        ...LEARNING_INDICATOR_KEYS[dimension].map(key => [
          `${dimension}__${key}`,
          `${LEARNING_INDICATOR_LABELS[key]} (${LEARNING_UNITS[key] || '—'}) · família ${LEARNING_FAMILY[key]}. Vazio = não medido nesta turma.`
        ]),
        [`score__${dimension}`, 'Posição relativa do aluno na dimensão, em percentil de 0 a 100 **dentro da própria turma**. Não é nota.']
      ]),
      ['outcome_kind', 'Tipo de desfecho configurado na turma.'],
      ['outcome_source', 'De onde o desfecho veio.'],
      ['outcome_value', 'Valor do desfecho: nota percentual, ou 0/1 quando binário.'],
      ['portal_grade_percent', 'Nota final do portal, em %.'],
      ['portal_absences', 'Faltas registradas no portal.']
    ]),
    rows: (ctx) => ctx.learning.perTurma.flatMap(context => {
      const outcome = (ctx.learning.outcome?.perTurma || [])
        .find(entry => entry.turma === context.turma)?.outcome;
      const studentByKey = new Map((context.dataset.students || []).map(item => [studentKey(item), item]));

      return (context.indicators.students || []).map(row => {
        const key = studentKey(row);
        const student = studentByKey.get(key) || {};
        const academicRow = context.academic?.students?.[key];

        const record = {
          turma: context.turma,
          student_key: key,
          student_name: row.name,
          email: row.email,
          id_number: student.idNumber ?? null,
          from_logs: Boolean(context.indicators.sources.logs),
          from_history: Boolean(context.indicators.sources.history),
          from_taxonomy: Boolean(context.indicators.sources.taxonomy),
          outcome_kind: outcome?.available ? outcome.kind : null,
          outcome_source: outcome?.available ? outcome.source : null,
          outcome_value: outcome?.values?.get(key) ?? null,
          portal_grade_percent: academicRow?.gradePercent ?? null,
          portal_absences: academicRow?.absences ?? null
        };

        DIMENSIONS.forEach(dimension => {
          LEARNING_INDICATOR_KEYS[dimension].forEach(indicatorKey => {
            const entry = row.dimensions?.[dimension]?.[indicatorKey];
            // Ausente vira célula vazia, nunca zero: um zero imputado vira ponto
            // de corte real numa árvore, e o modelo passa a tratar "não mediu" e
            // "mediu zero" como a mesma coisa.
            record[`${dimension}__${indicatorKey}`] = entry?.available ? entry.value : null;
          });
          const score = row.scores?.[dimension];
          record[`score__${dimension}`] = score?.available ? score.value : null;
        });

        return record;
      });
    })
  },
  {
    id: 'learning_concepts',
    group: 'learning',
    file: 'learning_concepts.csv',
    title: 'Domínio conceitual',
    description: 'Uma linha por aluno × conceito. Formato longo porque o conjunto de conceitos muda de turma para turma.',
    tip: 'Domínio vazio quer dizer **evidência insuficiente** (menos de duas questões avaliando o conceito), não domínio zero. Filtre `status != "insufficient"` antes de agregar.',
    columns: () => columnList([
      ['student_key', 'Identificador do aluno.'],
      ['student_name', 'Nome do aluno.'],
      ['id_number', 'Matrícula.'],
      ['turmas', 'Turmas do aluno dentro da seleção.'],
      ['concept_code', 'Código do conceito na taxonomia.'],
      ['concept_name', 'Nome do conceito.'],
      ['mastery_percent', 'Domínio no conceito, em %. Vazio = evidência insuficiente.'],
      ['status', 'mastered, partial, gap ou insufficient.'],
      ['questions_evaluated', 'Quantas questões com nota alimentaram o cálculo.'],
      ['not_attempted', 'Nota baixa e a construção sequer aparece no código. Vazio quando o conceito não tem sinal estático confiável.']
    ]),
    rows: (ctx) => {
      const mastery = ctx.learning.mastery;
      if (!mastery?.bound) return [];
      const byCode = new Map((mastery.topics || []).map(topic => [topic.code, topic]));
      const studentByKey = new Map((ctx.merged.students || []).map(item => [studentKey(item), item]));

      return (mastery.students || []).flatMap(row => {
        const key = studentKey(row);
        const student = studentByKey.get(key) || {};
        return Object.entries(row.topics || {}).map(([code, result]) => ({
          student_key: key,
          student_name: row.name,
          id_number: student.idNumber ?? null,
          turmas: student.turmas || [],
          concept_code: code,
          concept_name: byCode.get(code)?.name ?? null,
          mastery_percent: result.mastery,
          status: result.status,
          questions_evaluated: result.itemCount,
          not_attempted: byCode.get(code)?.codeSignals?.length ? result.untried : null
        }));
      });
    }
  },
  {
    id: 'learning_access',
    group: 'learning',
    file: 'learning_access.csv',
    title: 'Acesso ao Moodle por dia',
    description: 'Uma linha por aluno × dia com eventos nos logs do Moodle. Diferente de `student_daily_activity.csv`, que conta **envios**: aqui é presença, não entrega.',
    tip: 'Só existe para turmas em que os logs foram coletados. O Moodle registra eventos com carimbo de hora, não duração de sessão — não há como derivar "tempo de estudo" daqui.',
    columns: () => columnList([
      ['turma', 'Importação (turma) de origem.'],
      ['student_key', 'Identificador do aluno.'],
      ['id_number', 'Matrícula.'],
      ['date', 'Dia (YYYY-MM-DD).'],
      ['events', 'Eventos registrados no dia.']
    ]),
    rows: (ctx) => ctx.learning.perTurma.flatMap(context => {
      const byStudent = context.activity?.byStudent || {};
      const studentByKey = new Map((context.dataset.students || []).map(item => [studentKey(item), item]));
      return Object.entries(byStudent).flatMap(([key, record]) =>
        Object.entries(record.days || {}).map(([day, events]) => ({
          turma: context.turma,
          student_key: key,
          id_number: studentByKey.get(key)?.idNumber ?? null,
          date: day,
          events
        })));
    })
  },
  {
    id: 'learning_interventions',
    group: 'learning',
    file: 'learning_interventions.csv',
    title: 'Intervenções registradas',
    description: 'Uma linha por intervenção, com o retrato do aluno no momento do registro e onde ele está na importação atual.',
    tip: 'O aluno foi escolhido por estar pior, então regressão à média basta para produzir melhora sem que a intervenção tenha feito nada. Estas colunas servem para acompanhar, não para atribuir efeito.',
    columns: () => columnList([
      ['turma', 'Importação (turma) de origem.'],
      ['student_key', 'Identificador do aluno.'],
      ['student_name', 'Nome do aluno.'],
      ['registered_at', 'Quando a intervenção foi registrada (ISO local).'],
      ['pattern', 'Padrão de comportamento que a motivou, quando houve um.'],
      ['concept', 'Conceito a que ela se refere, quando houve um.'],
      ['action', 'Tipo de ação.'],
      ['status', 'planned, done ou abandoned.'],
      ['avg_percent_before', 'Média percentual do aluno no momento do registro.'],
      ['avg_percent_after', 'Média na importação atual. Vazio enquanto a turma não for reimportada.']
    ]),
    rows: (ctx) => ctx.learning.perTurma.flatMap(context => {
      const registry = readJsonFile(statisticsPaths(context.turma).interventions, null);
      return (registry?.entries || []).map(entry => {
        const snapshot = registry.snapshots?.[entry.snapshotId];
        const moved = snapshot && snapshot.importedAt !== context.dataset.importedAt;
        return {
          turma: context.turma,
          student_key: String(entry.userId),
          student_name: entry.name,
          registered_at: isoLocal(entry.createdAt),
          pattern: entry.pattern,
          concept: entry.topic,
          action: entry.action,
          status: entry.status,
          avg_percent_before: entry.baseline?.avgPercent ?? null,
          avg_percent_after: moved ? studentAverage(context.dataset, String(entry.userId)) : null
        };
      });
    })
  }
];

const TABLE_BY_ID = new Map(TABLES.map(table => [table.id, table]));

const GROUP_LABELS = {
  cross: 'Transversais (um retrato do momento)',
  timeseries: 'Séries temporais',
  unified: 'Unificados (tabelas largas prontas para análise)',
  learning: 'Aprendizado (indicadores, conceitos e intervenções)'
};

// ---------------------------------------------------------------------------
// API do módulo
// ---------------------------------------------------------------------------

function resolveTables(ids) {
  const list = (ids && ids.length ? ids : TABLES.map(table => table.id))
    .map(id => TABLE_BY_ID.get(id))
    .filter(Boolean);
  if (!list.length) throw new Error('Nenhuma tabela válida selecionada para exportação.');
  return list;
}

function buildTable(table, ctx) {
  const columns = typeof table.columns === 'function' ? table.columns(ctx) : table.columns;
  return { columns, rows: table.rows(ctx) };
}

function tableCsv(table, ctx) {
  const { columns, rows } = buildTable(table, ctx);
  return toCsv(columns, rows, ctx.options);
}

/** Manifesto para a tela de exportação: o que existe e quantas linhas tem. */
function buildManifest(ctx) {
  return TABLES.map(table => {
    const { columns, rows } = buildTable(table, ctx);
    return {
      id: table.id,
      group: table.group,
      groupLabel: GROUP_LABELS[table.group],
      file: table.file,
      title: table.title,
      description: table.description,
      tip: table.tip || null,
      rowCount: rows.length,
      columnCount: columns.length
    };
  });
}

// ---------------------------------------------------------------------------
// Documentação que acompanha o ZIP
// ---------------------------------------------------------------------------

function scopeSummary(ctx) {
  const { metrics, merged } = ctx;

  // O histórico completo é opção por importação: numa seleção mista, dizer
  // simplesmente "sim" ou "não" enganaria quem for analisar o eixo temporal.
  const withHistory = merged.datasets
    .filter(dataset => ctx.datasetsWithHistory.includes(dataset.turma))
    .map(dataset => dataset.turma);
  const historyNote = withHistory.length === merged.turmas.length
    ? ' (cada tentativa é um evento — histórico completo importado)'
    : withHistory.length === 0
      ? ' (só o envio final de cada questão — o histórico completo não foi importado)'
      : ` (histórico completo apenas em: ${withHistory.map(turma => `\`${turma}\``).join(' · ')})`;

  return [
    `- **Turmas:** ${merged.turmas.map(turma => `\`${turma}\``).join(' · ')}`,
    `- **Curso:** ${merged.courseName || '—'}`,
    `- **Seções:** ${(merged.sections || []).join(' · ') || '—'}`,
    `- **Importado em:** ${isoLocal(merged.importedAt) || '—'}`,
    `- **Alunos considerados:** ${metrics.overview.totalStudents}`,
    `- **Alunos ignorados por não ter histórico:** ${metrics.overview.excludedStudents}`
      + `${metrics.ignoreEmptyStudents ? '' : ' (filtro desligado nesta exportação)'}`,
    `- **Questões:** ${metrics.overview.totalQuestions}`,
    `- **Entregas registradas:** ${metrics.overview.actualSubmissions} de ${metrics.overview.expectedSubmissions} possíveis`,
    `- **Envios no eixo temporal:** ${ctx.events.length}${historyNote}`
  ].join('\n');
}

function buildGuide(ctx, tables) {
  const byGroup = (group) => tables.filter(table => table.group === group);
  const fileList = (group) => byGroup(group)
    .map(table => `| \`csv/${table.file}\` | ${table.title} | ${table.description} |`)
    .join('\n');

  const groupSection = (group) => {
    if (!byGroup(group).length) return '';
    return [
      `### ${GROUP_LABELS[group]}`,
      '',
      '| Arquivo | Tabela | Conteúdo |',
      '|---------|--------|----------|',
      fileList(group),
      '',
      ''
    ].join('\n');
  };

  return `# Exportação de estatísticas — guia de análise

Este pacote saiu da aba **Estatísticas** do CPP Review App. São dados reais de
turma (entregas, notas automáticas do VPL/Moodle, tentativas, horários e métricas
estáticas do código) organizados para análise em Python, R ou planilha.

## Recorte exportado

${scopeSummary(ctx)}

> Os dados são de alunos identificados. Trate o pacote como material sigiloso:
> mantenha fora de repositórios públicos e anonimize antes de compartilhar
> resultados (\`student_key\`, \`student_name\` e \`email\` são identificadores diretos).

## Como os arquivos estão organizados

${groupSection('cross')}${groupSection('timeseries')}${groupSection('unified')}
O significado de **cada coluna** está em \`DICIONARIO-DE-DADOS.md\`.

## Convenções dos arquivos

- **Codificação:** UTF-8 sem BOM · **separador:** vírgula · **decimal:** ponto.
- **Vazio = ausente** (\`NaN\` no pandas). Cuidado: vazio em \`percent\` significa
  "sem nota", que é diferente de nota 0.
- **Booleanos:** \`True\`/\`False\` (o pandas já converte para \`bool\`).
- **Listas em uma célula:** separadas por \` | \` (ex.: \`failed_cases\`).
- **Datas:** ISO 8601 no fuso local da máquina que exportou, sem indicador de
  fuso. As colunas \`*_epoch\` trazem o mesmo instante em milissegundos (UTC).
  Todas as colunas de hora, dia da semana e dia do mês seguem o fuso local.
- **Chaves de junção:** \`student_key\` (aluno), \`question_key\` (questão) e
  \`turma\`. Com mais de uma turma exportada, \`question_key\` vem prefixada
  (\`turma::q1\`) e \`source_key\` guarda a chave original.
- **Uma linha por observação.** A única tabela com linha de total é
  \`overview.csv\`, onde \`scope = "__combinado__"\` soma a seleção inteira.

## Primeiros comandos

\`\`\`python
import pandas as pd

sub = pd.read_csv("csv/submissions.csv", parse_dates=["submitted_at", "due_date"])
alunos = pd.read_csv("csv/students.csv")
questoes = pd.read_csv("csv/questions.csv")
eventos = pd.read_csv("csv/submission_events.csv", parse_dates=["submitted_at"])

# Se preferir um único arquivo com tudo junto:
tudo = pd.read_csv("csv/unified_submissions.csv", parse_dates=["submitted_at"])
\`\`\`

## Análises que estes dados sustentam

### 1. Análise de itens (quais questões avaliam bem)

\`\`\`python
questoes.sort_values("difficulty_index", ascending=False)[
    ["question_name", "difficulty_index", "avg_percent", "pass_rate", "submission_rate"]
]
\`\`\`

Dificuldade alta com desvio padrão baixo = questão difícil para todo mundo
(provavelmente enunciado ou pré-requisito). Dificuldade média com desvio alto =
questão que **discrimina**: separa quem aprendeu de quem não aprendeu.

Índice de discriminação clássico (terço superior menos terço inferior):

\`\`\`python
notas = sub.pivot_table(index="student_key", columns="question_key", values="percent")
total = notas.mean(axis=1)
alto, baixo = total.quantile(0.73), total.quantile(0.27)
disc = notas[total >= alto].mean() - notas[total <= baixo].mean()
disc.sort_values()          # < 0,2 = questão que quase não discrimina
\`\`\`

### 2. Correlação entre questões e consistência interna

\`\`\`python
notas.corr()                                  # questões que medem a mesma coisa
notas.notna().sum()                           # base de cada correlação
\`\`\`

### 3. Esforço × resultado

\`\`\`python
sub.query("submitted").plot.scatter("attempts", "percent")
sub.query("submitted")[["attempts", "percent", "code_lines"]].corr()
\`\`\`

Muitas tentativas com nota baixa é um perfil pedagógico diferente de poucas
tentativas com nota baixa: o primeiro tentou e travou, o segundo desistiu (ou
não começou).

### 4. Procrastinação e uso do prazo

\`\`\`python
sub.query("submitted")["hours_before_due"].describe()
lead = pd.read_csv("csv/lead_time.csv")
lead.pivot_table(index="question_name", columns="bucket_key", values="share")
\`\`\`

Cruze com a nota para testar se entregar na última hora custa pontos:

\`\`\`python
sub.query("submitted").assign(
    ultima_hora=lambda d: d.hours_before_due.between(0, 1)
).groupby("ultima_hora")["percent"].agg(["mean", "count"])
\`\`\`

### 5. Ritmo da turma no tempo

\`\`\`python
serie = (eventos.set_index("submitted_at")
                .groupby("turma")
                .resample("D").size()
                .rename("envios").reset_index())

# dias sem envio não existem no arquivo: complete antes de média móvel
diaria = pd.read_csv("csv/timeline_daily.csv", parse_dates=["date"])
diaria = (diaria.set_index("date").groupby("turma")["submissions"]
                .apply(lambda s: s.asfreq("D", fill_value=0)))
\`\`\`

### 6. Hábitos de horário

\`\`\`python
mapa = pd.read_csv("csv/activity_heatmap.csv")
mapa.pivot_table(index="weekday_label", columns="hour", values="submissions", aggfunc="sum")

perfil = pd.read_csv("csv/unified_students.csv")
perfil[["night_share", "weekend_share", "avg_hours_before_due", "avg_percent"]].corr()
\`\`\`

### 7. Regularidade e abandono

\`\`\`python
painel = pd.read_csv("csv/student_daily_activity.csv", parse_dates=["date"])
ativos = painel.groupby(["student_key", pd.Grouper(key="date", freq="W")])["submissions"].sum()
ultimo = painel.groupby("student_key")["date"].max()      # quando cada um parou
\`\`\`

### 8. Validar o score de risco

\`\`\`python
motivos = pd.read_csv("csv/risk_reasons.csv")
motivos.groupby("reason_code")["reason_weight"].describe()
alunos.groupby("risk_level")[["submission_rate", "avg_percent", "total_attempts"]].mean()
\`\`\`

O score é uma regra fixa do app (ver \`DICIONARIO-DE-DADOS.md\`), não um modelo
ajustado. Se você tem o resultado final da disciplina, é possível medir a
sensibilidade e a precisão dessa regra e recalibrar os pesos.

### 9. Comparar turmas

\`\`\`python
visao = pd.read_csv("csv/overview.csv").query('scope != "__combinado__"')
visao[["scope", "students", "submission_rate", "avg_percent", "pass_rate", "at_risk_count"]]
\`\`\`

Para comparar médias entre duas turmas, prefira o teste sobre as observações
individuais (Mann-Whitney costuma ser mais seguro que teste t, porque a
distribuição de notas é truncada em 0 e 100):

\`\`\`python
from scipy.stats import mannwhitneyu
a, b = visao.scope.iloc[0], visao.scope.iloc[1]
x = alunos.query("turmas == @a").avg_percent.dropna()
y = alunos.query("turmas == @b").avg_percent.dropna()
mannwhitneyu(x, y)
\`\`\`

Atenção: turmas diferentes têm questões diferentes. Compare taxa de entrega e
distribuição de risco com tranquilidade; comparar médias de nota só faz sentido
se as atividades forem equivalentes.

### 10. Conceitos de C++ e prática de código

\`\`\`python
codigo = pd.read_csv("csv/code_metrics.csv")
codigo.filter(like="concept_").mean().sort_values(ascending=False)
codigo.groupby("smell_usingNamespaceStd")["percent"].mean()
\`\`\`

### 11. Agrupar perfis de aluno

\`\`\`python
from sklearn.cluster import KMeans
from sklearn.preprocessing import StandardScaler

X = perfil[["submission_rate", "avg_percent", "attempts_per_submission",
            "avg_hours_before_due", "active_days"]].dropna()
perfil.loc[X.index, "cluster"] = KMeans(4, n_init=10).fit_predict(StandardScaler().fit_transform(X))
perfil.groupby("cluster")[["avg_percent", "submission_rate", "risk_score"]].mean()
\`\`\`

## Cuidados de interpretação

1. **Vazio não é zero.** \`percent\` vazio é "não avaliado"; \`submitted = False\`
   com \`percent\` vazio é ausência de entrega. Somar tratando vazio como zero
   distorce médias — use \`mean()\` (que ignora \`NaN\`) e decida explicitamente
   quando quiser \`fillna(0)\`.
2. **Nem toda fonte esteve disponível.** Se o Web Service do VPL estava
   bloqueado, faltam casos reprovados e erros de compilação; se o histórico
   completo não foi importado, \`attempts\` vem do que a lista de submissões
   informou e cada questão tem um único evento no tempo. Confira o recorte no
   topo deste arquivo.
3. **Tentativas ausentes valem 1.** O app assume uma tentativa quando existe
   entrega mas o número não foi informado; isso comprime a distribuição de
   \`attempts\` para baixo.
4. **As métricas de código são heurísticas textuais**, não análise sintática de
   C++. \`concept_*\` e \`smell_*\` erram em código incomum (macros, comentários
   grandes com código dentro). Servem para ver tendências da turma, não para
   avaliar um aluno específico.
5. **Fuso horário.** Hora, dia da semana e mapa de calor usam o fuso da máquina
   que exportou. Se comparar exportações feitas em fusos diferentes, use
   \`submitted_at_epoch\`.
6. **Índice de dificuldade não é só nota.** Ele já embute quem não entregou:
   \`100 − (média × entregues / esperados)\`. Para dificuldade apenas entre quem
   tentou, use \`100 − avg_percent\`.
7. **Alunos sem histórico.** Quando o filtro está ligado, cadastros sem nenhum
   vestígio de atividade saem de todas as tabelas — inclusive dos denominadores.
   Isso muda taxa de entrega e distribuição de risco; registre nas suas
   conclusões qual recorte foi usado.
8. **Correlação não é causa.** Entregar de madrugada não causa nota baixa; as
   duas coisas podem ser efeito de sobrecarga ou de começar tarde.
`;
}

function buildDictionary(ctx, tables) {
  const sections = tables.map(table => {
    const { columns, rows } = buildTable(table, ctx);
    return [
      `## \`csv/${table.file}\` — ${table.title}`,
      '',
      table.description,
      '',
      ...(table.tip ? [`> **Como usar:** ${table.tip}`, ''] : []),
      `**Grão:** ${rows.length} linha(s) · ${columns.length} coluna(s) · grupo: ${GROUP_LABELS[table.group]}`,
      '',
      '| Coluna | Significado |',
      '|--------|-------------|',
      columns.map(column => `| \`${column.name}\` | ${column.description} |`).join('\n'),
      ''
    ].join('\n');
  });

  return `# Dicionário de dados

Significado de cada coluna dos arquivos deste pacote. As convenções gerais
(codificação, vazios, datas, chaves de junção) estão em \`LEIA-ME.md\`.

## Conceitos usados em várias tabelas

| Conceito | Definição |
|----------|-----------|
| \`turma\` | Uma importação da aba Estatísticas — um curso do Moodle com uma ou mais seções. Não é necessariamente uma turma administrativa. |
| \`student_key\` | Identificador estável do aluno: o \`userId\` do Moodle quando existe, senão o nome da pasta do ZIP do VPL. |
| \`question_key\` | Chave da questão nesta exportação. Com mais de uma turma vem prefixada por \`turma::\`; \`source_key\` guarda a chave original (\`q1\`, \`q2\`...). |
| Nota percentual | \`grade / max_grade × 100\`, limitada a 0–100. Torna comparáveis atividades com notas máximas diferentes. |
| Aprovação | Nota percentual ≥ ${PASS_THRESHOLD}%. É a régua fixa do app, usada em \`pass_rate\` e \`passed\`. |
| Índice de dificuldade | \`100 − (média percentual × entregues / esperados)\`. 0 = todos acertaram; 100 = ninguém entregou ou ninguém acertou. Quem não entregou conta como dificuldade. |
| Score de risco | Soma de sinais, limitada a 0–100: nenhuma entrega = 60; questões sem entrega = até 45 (proporcional); média abaixo de ${PASS_THRESHOLD}% = até 40 (proporcional); entregas atrasadas = até 10; 8+ tentativas sem atingir a média = 8. Faixas: crítico ≥ 60, alto ≥ 40, médio ≥ 20, baixo abaixo disso. |
| Aluno sem histórico | Cadastro sem nenhuma entrega, nota, tentativa ou código nas questões da própria turma. Normalmente matrícula cancelada, trancamento ou cadastro sem inscrição na disciplina. |
| Tentativa | Um envio ao VPL. Sem o histórico completo importado, o app assume 1 tentativa quando há entrega e o número não foi informado. |

${sections.join('\n')}`;
}

// ---------------------------------------------------------------------------
// Pacotes para download
// ---------------------------------------------------------------------------

function safeFileName(text) {
  return String(text || 'estatisticas')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Za-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'estatisticas';
}

function timestampSuffix(timestamp = Date.now()) {
  const iso = isoLocal(timestamp) || '';
  // AAAAMMDD-HHMM: identifica a exportação sem depender do fuso no nome.
  return `${iso.slice(0, 10).replace(/-/g, '')}-${iso.slice(11, 16).replace(':', '')}`;
}

/** Um único CSV, para a exportação de uma tabela específica. */
function buildSingleCsv(ctx, tableId) {
  const table = resolveTables([tableId])[0];
  return {
    fileName: `${safeFileName(ctx.merged.turma)}_${table.id}_${timestampSuffix()}.csv`,
    content: tableCsv(table, ctx)
  };
}

/** ZIP com os CSVs escolhidos e, por padrão, os dois markdowns de apoio. */
function buildZipBundle(ctx, tableIds, { includeDocs = true } = {}) {
  const tables = resolveTables(tableIds);
  const zip = new AdmZip();

  tables.forEach(table => {
    zip.addFile(`csv/${table.file}`, Buffer.from(tableCsv(table, ctx), 'utf8'));
  });

  if (includeDocs) {
    zip.addFile('LEIA-ME.md', Buffer.from(buildGuide(ctx, tables), 'utf8'));
    zip.addFile('DICIONARIO-DE-DADOS.md', Buffer.from(buildDictionary(ctx, tables), 'utf8'));
  }

  return {
    fileName: `estatisticas_${safeFileName(ctx.merged.turma)}_${timestampSuffix()}.zip`,
    buffer: zip.toBuffer()
  };
}

module.exports = {
  buildContext,
  buildManifest,
  buildSingleCsv,
  buildZipBundle,
  buildGuide,
  buildDictionary,
  TABLES,
  GROUP_LABELS
};
