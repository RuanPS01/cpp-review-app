const fs = require('fs');
const path = require('path');
const AdmZip = require('adm-zip');
const { STATS_DIR } = require('../../config/env');
const { parseFolderWithTemplate } = require('../../utils/fileHelpers');
const { emitProgress } = require('../../core/progress');
const harvester = require('./moodleHarvester');
const { analyzeCode } = require('./codeMetrics');
const { computeMetrics, mergeDatasets, hasAnyRecord, studentKey } = require('./statistics.service');
const statisticsExport = require('./statistics.export');
const { buildPrompt, REPORT_KINDS } = require('./statistics.prompts');
const { runPrompt, readSettings } = require('../ai/ai.service');

const DATASET_VERSION = 1;
const MAX_STORED_CODE_CHARS = 20000;
const PROGRESS_EVENT = 'statistics-import-progress';

// ---------------------------------------------------------------------------
// Persistência
// ---------------------------------------------------------------------------

/** Impede que o nome da turma escape do diretório de estatísticas. */
function sanitizeTurma(turma) {
  return String(turma || '').replace(/[\\/:*?"<>|]/g, '_').replace(/\.\./g, '_').trim();
}

const datasetPath = (turma) => path.join(STATS_DIR, `stats_${sanitizeTurma(turma)}.json`);
const reportsPath = (turma) => path.join(STATS_DIR, `stats_${sanitizeTurma(turma)}.reports.json`);

function readDataset(turma) {
  const filePath = datasetPath(turma);
  if (!fs.existsSync(filePath)) return null;
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function readReports(turma) {
  const filePath = reportsPath(turma);
  if (!fs.existsSync(filePath)) return {};
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (err) {
    return {};
  }
}

// ---------------------------------------------------------------------------
// Importação
// ---------------------------------------------------------------------------

const normalizeKey = (text) => String(text || '')
  .toLowerCase()
  .normalize('NFD')
  .replace(/[̀-ͯ]/g, '')
  .replace(/\s+/g, ' ')
  .trim();

/**
 * Índice de busca dos alunos matriculados. O ZIP do VPL nomeia as pastas com um
 * template livre (e-mail, nome, matrícula), então tentamos casar por e-mail,
 * depois nome e por fim matrícula.
 */
function buildStudentIndex(enrolledStudents) {
  const byEmail = new Map();
  const byName = new Map();
  const byIdNumber = new Map();

  (enrolledStudents || []).forEach(user => {
    const record = {
      userId: user.id,
      name: user.fullname || [user.firstname, user.lastname].filter(Boolean).join(' ') || String(user.id),
      email: user.email || null,
      username: user.username || null,
      idNumber: user.idnumber || null,
      lastAccess: user.lastaccess ? user.lastaccess * 1000 : null,
      lastCourseAccess: user.lastcourseaccess ? user.lastcourseaccess * 1000 : null,
      groups: (user.groups || []).map(g => g.name).filter(Boolean)
    };
    if (record.email) byEmail.set(normalizeKey(record.email), record);
    if (record.name) byName.set(normalizeKey(record.name), record);
    if (record.idNumber) byIdNumber.set(normalizeKey(record.idNumber), record);
  });

  return { byEmail, byName, byIdNumber };
}

function matchStudent(index, { email, name, id }) {
  return (email && index.byEmail.get(normalizeKey(email)))
    || (name && index.byName.get(normalizeKey(name)))
    || (id && index.byIdNumber.get(normalizeKey(id)))
    || null;
}

function emptySubmission() {
  return {
    submitted: false,
    submittedAt: null,
    attempts: null,
    grade: null,
    evaluation: null,
    compilation: null,
    failedCases: [],
    compileErrors: [],
    hasCompileError: false,
    late: false,
    files: [],
    code: null,
    codeMetrics: null,
    history: []
  };
}

/**
 * Lê o ZIP `downloadallsubmissions` do VPL. Cada pasta raiz é um aluno; dentro
 * dela o VPL cria uma subpasta com o carimbo de data/hora da submissão — é daí
 * que vem o horário exato usado nas métricas de engajamento.
 */
function readSubmissionsZip(buffer) {
  const zip = new AdmZip(buffer);
  const byFolder = new Map();

  zip.getEntries().forEach(entry => {
    if (entry.isDirectory) return;
    const parts = entry.entryName.split('/').filter(Boolean);
    if (parts.length < 2) return;

    const studentFolder = parts[0];
    const fileName = parts[parts.length - 1];
    if (!byFolder.has(studentFolder)) {
      byFolder.set(studentFolder, { folder: studentFolder, files: [], submittedAt: null, code: null });
    }
    const record = byFolder.get(studentFolder);

    parts.slice(1, -1).forEach(segment => {
      const timestamp = harvester.parseFolderTimestamp(segment);
      // O VPL guarda várias submissões; a mais recente é a que vale.
      if (timestamp && (!record.submittedAt || timestamp > record.submittedAt)) record.submittedAt = timestamp;
    });

    const data = entry.getData();
    record.files.push({ name: fileName, size: data.length });

    if (/\.(cpp|cc|cxx|c|h|hpp)$/i.test(fileName)) {
      const content = data.toString('utf8');
      // Mantém o maior arquivo de código como principal (normalmente main.cpp).
      if (!record.code || content.length > record.code.length) record.code = content;
    }
  });

  return byFolder;
}

exports.importMoodle = async (req, res) => {
  const {
    courseId, courseName, sectionName, sections, turmaName, baseUrl, cookie, userAgent,
    folderTemplate, questions = [], enrolledStudents = [],
    vplResults = {}, gradebook = {}, deepHistory = false, sources = {}
  } = req.body;

  // Formato multi-seção, com o formato antigo de seção única como fallback.
  const sectionList = Array.isArray(sections) && sections.length
    ? sections
    : [{ name: sectionName, questions }];

  // Numeração contínua entre seções: as chaves `q{n}` identificam a questão no
  // dataset inteiro, então não podem reiniciar a cada seção.
  const allQuestions = sectionList.flatMap(section =>
    (section.questions || []).map(question => ({ ...question, sectionName: section.name }))
  );

  const sectionLabel = sectionList.map(s => s.name).join(' + ');
  const turma = sanitizeTurma(turmaName || `${courseName} - ${sectionLabel}`);
  const warnings = [];
  const { fetchPage } = harvester.createSession({ baseUrl, cookie, userAgent });

  const progress = (message, current, total) => emitProgress(PROGRESS_EVENT, { turma, message, current, total });

  try {
    if (!allQuestions.length) throw new Error('Nenhuma atividade VPL informada para importação.');

    const index = buildStudentIndex(enrolledStudents);
    const students = new Map();

    /** Recupera (ou cria) o registro consolidado de um aluno. */
    const ensureStudent = ({ userId, name, email, username, idNumber, folderName }) => {
      const key = userId ? `id:${userId}` : `folder:${normalizeKey(folderName || name)}`;
      if (!students.has(key)) {
        students.set(key, {
          userId: userId ?? null,
          folderName: folderName || null,
          name: name || folderName || 'Aluno sem identificação',
          email: email || null,
          username: username || null,
          idNumber: idNumber || null,
          lastAccess: null,
          lastCourseAccess: null,
          groups: [],
          enrolled: false,
          questions: {}
        });
      }
      const record = students.get(key);
      if (!record.userId && userId) record.userId = userId;
      if (!record.folderName && folderName) record.folderName = folderName;
      if (!record.email && email) record.email = email;
      if (!record.username && username) record.username = username;
      if (name && (!record.name || record.name === record.folderName)) record.name = name;
      return record;
    };

    // Todos os matriculados entram na base, inclusive quem nunca enviou nada —
    // a ausência de entrega é justamente um dos sinais que queremos medir.
    (enrolledStudents || []).forEach(user => {
      const record = ensureStudent({
        userId: user.id,
        name: user.fullname || [user.firstname, user.lastname].filter(Boolean).join(' '),
        email: user.email,
        username: user.username,
        idNumber: user.idnumber
      });
      record.enrolled = true;
      record.lastAccess = user.lastaccess ? user.lastaccess * 1000 : null;
      record.lastCourseAccess = user.lastcourseaccess ? user.lastcourseaccess * 1000 : null;
      record.groups = (user.groups || []).map(g => g.name).filter(Boolean);
    });

    if (!enrolledStudents.length) {
      warnings.push('Lista de matriculados indisponível: alunos sem nenhuma submissão não aparecem nas estatísticas.');
    }

    const totalSteps = allQuestions.length;
    const normalizedQuestions = [];

    await fetchPage(baseUrl);

    for (let i = 0; i < allQuestions.length; i++) {
      const question = allQuestions[i];
      const key = `q${i + 1}`;
      const viewUrl = `${baseUrl}/mod/vpl/view.php?id=${question.cmid}`;
      const listUrl = `${baseUrl}/mod/vpl/views/submissionslist.php?id=${question.cmid}&showgrades=1&group=-1&tilast&tifirst&tperpage=5000&thiddenfields`;
      const downloadUrl = `${baseUrl}/mod/vpl/views/downloadallsubmissions.php?id=${question.cmid}`;

      progress(`Lendo atividade "${question.name}"`, i, totalSteps);

      let statement = question.statement || null;
      let testCases = question.testCases || [];
      let startDate = question.startDate ?? null;
      let dueDate = question.dueDate ?? null;
      let maxGrade = question.maxGrade ?? null;

      try {
        const viewHtml = await (await fetchPage(viewUrl)).text();
        statement = statement || harvester.parseStatement(viewHtml);
        if (!testCases.length) testCases = harvester.parseTestCases(viewHtml);
        const dates = harvester.parseActivityDates(viewHtml);
        startDate = startDate ?? dates.startDate;
        dueDate = dueDate ?? dates.dueDate;
        maxGrade = maxGrade ?? harvester.parseMaxGrade(viewHtml);
      } catch (err) {
        warnings.push(`Não foi possível ler a página da atividade "${question.name}": ${err.message}`);
      }

      const normalizedQuestion = {
        key,
        cmid: question.cmid,
        instanceId: question.instanceId ?? null,
        name: question.name,
        section: question.sectionName ?? null,
        statement,
        testCases,
        startDate,
        dueDate,
        maxGrade
      };
      normalizedQuestions.push(normalizedQuestion);

      // --- Lista de submissões: notas, tentativas e datas -------------------
      progress(`Coletando entregas de "${question.name}"`, i, totalSteps);
      let listRows = [];
      try {
        const listHtml = await (await fetchPage(listUrl, viewUrl)).text();
        listRows = harvester.parseSubmissionsList(listHtml);
      } catch (err) {
        warnings.push(`Lista de submissões de "${question.name}" indisponível: ${err.message}`);
      }

      listRows.forEach(row => {
        const enrolled = row.userId ? (enrolledStudents || []).find(u => u.id === row.userId) : null;
        const record = ensureStudent({
          userId: row.userId,
          name: enrolled?.fullname || row.name,
          email: enrolled?.email
        });
        const submission = record.questions[key] || emptySubmission();
        if (row.submittedAt) { submission.submitted = true; submission.submittedAt = row.submittedAt; }
        if (row.attempts !== null) submission.attempts = row.attempts;
        if (row.grade !== null) { submission.grade = row.grade; submission.submitted = true; }
        if (row.evaluation) submission.evaluation = row.evaluation;
        record.questions[key] = submission;
      });

      // --- ZIP de submissões: código-fonte e carimbo de data ----------------
      progress(`Baixando códigos de "${question.name}"`, i, totalSteps);
      try {
        const response = await fetchPage(downloadUrl, listUrl);
        if (!response.ok) throw new Error(response.statusText || `HTTP ${response.status}`);
        const buffer = Buffer.from(await response.arrayBuffer());
        if (buffer.length < 4 || buffer[0] !== 0x50 || buffer[1] !== 0x4B) {
          throw new Error('o Moodle devolveu HTML em vez do ZIP (sessão ou permissão)');
        }

        readSubmissionsZip(buffer).forEach(entry => {
          const parsed = parseFolderWithTemplate(entry.folder, folderTemplate);
          const matched = matchStudent(index, { email: parsed.email, name: parsed.name, id: parsed.id });
          const record = ensureStudent({
            userId: matched?.userId,
            name: matched?.name || parsed.name,
            email: matched?.email || parsed.email,
            idNumber: parsed.id,
            folderName: entry.folder
          });

          const submission = record.questions[key] || emptySubmission();
          submission.submitted = true;
          submission.files = entry.files;
          if (entry.submittedAt && (!submission.submittedAt || entry.submittedAt > submission.submittedAt)) {
            submission.submittedAt = entry.submittedAt;
          }
          if (entry.code) {
            submission.code = entry.code.slice(0, MAX_STORED_CODE_CHARS);
            submission.codeMetrics = analyzeCode(entry.code);
          }
          record.questions[key] = submission;
        });
      } catch (err) {
        warnings.push(`Códigos de "${question.name}" não puderam ser baixados: ${err.message}`);
      }

      // --- Resultado da avaliação automática (via Web Service, se liberado) --
      const results = vplResults[String(question.cmid)] || vplResults[question.cmid] || {};
      Object.entries(results).forEach(([userId, result]) => {
        const record = [...students.values()].find(s => String(s.userId) === String(userId));
        if (!record) return;
        const submission = record.questions[key] || emptySubmission();
        const parsedResult = harvester.parseEvaluation(result.evaluation, result.compilation);
        submission.evaluation = result.evaluation || submission.evaluation;
        submission.compilation = result.compilation || submission.compilation;
        submission.failedCases = parsedResult.failedCases;
        submission.compileErrors = parsedResult.compileErrors;
        submission.hasCompileError = parsedResult.hasCompileError;
        const grade = harvester.parseNumber(result.grade) ?? parsedResult.grade;
        if (grade !== null) { submission.grade = grade; submission.submitted = true; }
        record.questions[key] = submission;
      });

      // --- Notas do livro de notas do Moodle (fallback de nota) -------------
      Object.entries(gradebook).forEach(([userId, items]) => {
        const item = items?.[String(question.cmid)] ?? items?.[question.cmid];
        if (!item) return;
        const record = [...students.values()].find(s => String(s.userId) === String(userId));
        if (!record) return;
        const submission = record.questions[key] || emptySubmission();
        if (submission.grade === null && item.grade !== null && item.grade !== undefined) {
          submission.grade = harvester.parseNumber(item.grade);
          if (submission.grade !== null) submission.submitted = true;
        }
        if (!normalizedQuestion.maxGrade && item.gradeMax) {
          normalizedQuestion.maxGrade = harvester.parseNumber(item.gradeMax);
        }
        record.questions[key] = submission;
      });

      // --- Histórico completo de tentativas (opcional, custo alto) ----------
      if (deepHistory) {
        const withSubmission = [...students.values()].filter(s => s.userId && s.questions[key]?.submitted);
        for (let s = 0; s < withSubmission.length; s++) {
          const record = withSubmission[s];
          progress(`Histórico de tentativas — ${record.name} (${s + 1}/${withSubmission.length})`, i, totalSteps);
          try {
            const historyUrl = `${baseUrl}/mod/vpl/views/previoussubmissionslist.php?id=${question.cmid}&userid=${record.userId}`;
            const historyHtml = await (await fetchPage(historyUrl, listUrl)).text();
            const attempts = harvester.parsePreviousSubmissions(historyHtml);
            if (attempts.length) {
              record.questions[key].history = attempts;
              record.questions[key].attempts = attempts.length;
            }
          } catch (err) {
            // Um histórico ausente não invalida a importação.
          }
        }
      }
    }

    // Marca atrasos comparando o envio com o prazo da atividade.
    const questionByKey = new Map(normalizedQuestions.map(q => [q.key, q]));
    students.forEach(student => {
      normalizedQuestions.forEach(question => {
        const submission = student.questions[question.key];
        if (!submission) { student.questions[question.key] = emptySubmission(); return; }
        const dueDate = questionByKey.get(question.key)?.dueDate;
        submission.late = Boolean(dueDate && submission.submittedAt && submission.submittedAt > dueDate);
        if (submission.submitted && !submission.attempts) submission.attempts = 1;
      });
    });

    const dataset = {
      version: DATASET_VERSION,
      turma,
      courseId: courseId ?? null,
      courseName,
      sectionName: sectionLabel,
      sections: sectionList.map(s => s.name),
      baseUrl,
      importedAt: Date.now(),
      deepHistory: Boolean(deepHistory),
      sources: {
        enrolledUsers: Boolean(enrolledStudents.length),
        vplResults: Object.keys(vplResults).length > 0,
        gradebook: Object.keys(gradebook).length > 0,
        submissionHistory: Boolean(deepHistory),
        ...sources
      },
      warnings,
      questions: normalizedQuestions,
      students: [...students.values()]
    };

    fs.writeFileSync(datasetPath(turma), JSON.stringify(dataset, null, 2));
    progress('Importação concluída', totalSteps, totalSteps);

    const metrics = computeMetrics(dataset);
    res.json({
      success: true,
      turma,
      warnings,
      summary: {
        students: metrics.overview.totalStudents,
        questions: metrics.overview.totalQuestions,
        submissions: metrics.overview.actualSubmissions,
        submissionRate: metrics.overview.submissionRate
      }
    });
  } catch (err) {
    console.error('[statistics] Import failed:', err);
    emitProgress(PROGRESS_EVENT, { turma, message: `Falha: ${err.message}`, error: true });
    res.status(500).json({ error: `Falha na importação de estatísticas: ${err.message}` });
  }
};

// ---------------------------------------------------------------------------
// Seleção de importações
// ---------------------------------------------------------------------------

/**
 * Lê a seleção de turmas de uma query ou de um corpo de requisição. Aceita um
 * array (corpo JSON), um JSON serializado (`["A","B"]`, usado nos GETs) ou um
 * nome único. Nomes de turma podem conter vírgula, então não há separador
 * implícito — a lista sempre chega explícita.
 */
function parseTurmas(source) {
  const raw = source?.turmas ?? source?.turma;
  if (raw === undefined || raw === null || raw === '') return [];

  let list;
  if (Array.isArray(raw)) {
    list = raw;
  } else {
    const text = String(raw).trim();
    if (text.startsWith('[')) {
      try { list = JSON.parse(text); } catch (err) { list = [text]; }
    } else {
      list = [text];
    }
  }

  return [...new Set((Array.isArray(list) ? list : [list]).map(value => String(value).trim()).filter(Boolean))];
}

const parseFlag = (value) => value === true || value === 'true' || value === '1';

/** Ids de tabela são slugs, então aqui a vírgula é um separador seguro. */
const parseIdList = (value) => String(value || '')
  .split(',')
  .map(item => item.trim())
  .filter(Boolean);

function loadDatasets(turmas) {
  const datasets = [];
  const missing = [];
  turmas.forEach(turma => {
    const dataset = readDataset(turma);
    if (dataset) datasets.push(dataset);
    else missing.push(turma);
  });
  return { datasets, missing };
}

/**
 * Resolve a seleção de uma requisição em datasets carregados. Devolve `null`
 * (já tendo respondido o erro) quando não há nada para calcular.
 */
function resolveSelection(req, res, source) {
  const turmas = parseTurmas(source);
  if (!turmas.length) {
    res.status(400).json({ error: 'Informe ao menos uma importação de estatísticas.' });
    return null;
  }

  const { datasets, missing } = loadDatasets(turmas);
  if (!datasets.length) {
    res.status(404).json({ error: `Importação não encontrada: ${missing.join(', ')}` });
    return null;
  }

  return {
    turmas: datasets.map(dataset => dataset.turma),
    datasets,
    missing,
    options: { ignoreEmptyStudents: parseFlag(source.ignoreEmpty) }
  };
}

// ---------------------------------------------------------------------------
// Consulta
// ---------------------------------------------------------------------------

exports.listDatasets = (req, res) => {
  try {
    const files = fs.readdirSync(STATS_DIR)
      .filter(f => f.startsWith('stats_') && f.endsWith('.json') && !f.endsWith('.reports.json'));

    const datasets = files.map(file => {
      try {
        const data = JSON.parse(fs.readFileSync(path.join(STATS_DIR, file), 'utf8'));
        // Contamos aqui os cadastros sem histórico para que o seletor de turmas
        // possa avisar quantos alunos o filtro descartaria.
        const merged = mergeDatasets([data]);
        return {
          turma: data.turma,
          courseName: data.courseName,
          sectionName: data.sectionName,
          sections: data.sections || (data.sectionName ? [data.sectionName] : []),
          importedAt: data.importedAt,
          studentCount: merged.students.length,
          questionCount: (data.questions || []).length,
          emptyStudentCount: merged.students.filter(student => !hasAnyRecord(merged, student)).length
        };
      } catch (err) {
        return null;
      }
    }).filter(Boolean).sort((a, b) => (b.importedAt || 0) - (a.importedAt || 0));

    res.json(datasets);
  } catch (err) {
    res.status(500).json({ error: 'Falha ao listar importações de estatísticas.' });
  }
};

exports.getDataset = (req, res) => {
  const selection = resolveSelection(req, res, req.query);
  if (!selection) return;

  try {
    const metrics = computeMetrics(selection.datasets, selection.options);
    selection.missing.forEach(turma => {
      metrics.warnings.push(`Importação "${turma}" não foi encontrada e ficou fora deste cálculo.`);
    });
    res.json(metrics);
  } catch (err) {
    console.error('[statistics] Metrics failed:', err);
    res.status(500).json({ error: `Falha ao calcular métricas: ${err.message}` });
  }
};

exports.getSubmissionCode = (req, res) => {
  const selection = resolveSelection(req, res, req.query);
  if (!selection) return;

  const { userId, question } = req.query;
  const merged = mergeDatasets(selection.datasets);
  const student = merged.students.find(candidate =>
    String(candidate.userId) === String(userId)
    || candidate.folderName === userId
    || studentKey(candidate) === String(userId));

  const submission = student?.questions?.[question];
  if (!submission) return res.status(404).json({ error: 'Submissão não encontrada.' });

  res.json({
    code: submission.code || '',
    files: submission.files || [],
    grade: submission.grade,
    evaluation: submission.evaluation,
    compilation: submission.compilation,
    failedCases: submission.failedCases || [],
    codeMetrics: submission.codeMetrics || null
  });
};

exports.deleteDataset = (req, res) => {
  const turma = req.params.turma;
  try {
    [datasetPath(turma), reportsPath(turma)].forEach(filePath => {
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Falha ao remover a importação.' });
  }
};

// ---------------------------------------------------------------------------
// Exportação em CSV
// ---------------------------------------------------------------------------

exports.exportManifest = (req, res) => {
  const selection = resolveSelection(req, res, req.query);
  if (!selection) return;

  try {
    const context = statisticsExport.buildContext(selection.datasets, selection.options);
    res.json({
      turmas: selection.turmas,
      ignoreEmptyStudents: selection.options.ignoreEmptyStudents,
      studentCount: context.metrics.overview.totalStudents,
      excludedStudentCount: context.metrics.overview.excludedStudents,
      questionCount: context.metrics.overview.totalQuestions,
      eventCount: context.events.length,
      groups: statisticsExport.GROUP_LABELS,
      tables: statisticsExport.buildManifest(context)
    });
  } catch (err) {
    console.error('[statistics] Export manifest failed:', err);
    res.status(500).json({ error: `Falha ao montar o catálogo de exportação: ${err.message}` });
  }
};

exports.exportData = (req, res) => {
  const selection = resolveSelection(req, res, req.query);
  if (!selection) return;

  const tables = parseIdList(req.query.tables);
  const bundle = req.query.bundle === 'csv' ? 'csv' : 'zip';
  const includeDocs = !['0', 'false'].includes(String(req.query.docs));

  try {
    const context = statisticsExport.buildContext(selection.datasets, selection.options);

    // O nome do arquivo é útil no cliente (que não conhece o recorte exportado)
    // e, numa resposta de outra origem, só chega se for explicitamente exposto.
    res.setHeader('Access-Control-Expose-Headers', 'Content-Disposition');

    if (bundle === 'csv') {
      if (tables.length !== 1) {
        return res.status(400).json({ error: 'A exportação de um único CSV exige exatamente uma tabela.' });
      }
      const { fileName, content } = statisticsExport.buildSingleCsv(context, tables[0]);
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
      return res.send(content);
    }

    const { fileName, buffer } = statisticsExport.buildZipBundle(context, tables, { includeDocs });
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.setHeader('Content-Length', buffer.length);
    return res.send(buffer);
  } catch (err) {
    console.error('[statistics] Export failed:', err);
    return res.status(500).json({ error: `Falha ao gerar a exportação: ${err.message}` });
  }
};

// ---------------------------------------------------------------------------
// Relatórios de IA
// ---------------------------------------------------------------------------

/**
 * Identificador do recorte analisado. Um relatório gerado sobre duas turmas não
 * é o mesmo relatório de cada uma delas, então o escopo entra na chave do cache.
 * Cliente e servidor derivam a chave pela mesma regra.
 */
const scopeId = (turmas) => [...turmas].sort().join(' + ');

const reportCacheKey = (turmas, kind, targetId) =>
  `${scopeId(turmas)}##${kind}${targetId ? `:${targetId}` : ''}`;

/**
 * Junta os relatórios de todas as turmas selecionadas em um mapa único. Chaves
 * antigas (sem escopo) pertencem à turma do próprio arquivo — é o que mantém
 * visíveis os relatórios gerados antes desta versão.
 */
function readAllReports(turmas) {
  const reports = {};
  turmas.forEach(turma => {
    Object.entries(readReports(turma)).forEach(([key, report]) => {
      reports[key.includes('##') ? key : `${turma}##${key}`] = report;
    });
  });
  return reports;
}

exports.getReports = (req, res) => {
  const turmas = parseTurmas(req.query);
  if (!turmas.length) return res.json({});
  res.json(readAllReports(turmas));
};

exports.generateReport = async (req, res) => {
  const { kind, targetId, lang = 'pt-BR' } = req.body;

  if (!REPORT_KINDS.includes(kind)) {
    return res.status(400).json({ error: `Tipo de relatório inválido: ${kind}` });
  }

  const selection = resolveSelection(req, res, req.body);
  if (!selection) return;

  try {
    const metrics = computeMetrics(selection.datasets, selection.options);
    const merged = mergeDatasets(selection.datasets);
    const { systemPrompt, userPrompt } = buildPrompt(kind, {
      metrics,
      dataset: merged,
      lang,
      questionKey: targetId,
      userId: targetId
    });

    const settings = readSettings();
    const markdown = await runPrompt({ settings, systemPrompt, userPrompt, maxTokens: 3000 });

    const cacheKey = reportCacheKey(selection.turmas, kind, targetId);
    const report = {
      kind,
      targetId: targetId ?? null,
      turmas: selection.turmas,
      scope: scopeId(selection.turmas),
      cacheKey,
      markdown: String(markdown || '').trim(),
      generatedAt: Date.now(),
      provider: settings.provider,
      model: settings.provider === 'ollama' ? settings.ollamaModel : settings.cloudModel
    };

    // O relatório de um recorte combinado fica guardado no arquivo da primeira
    // turma em ordem alfabética; a chave é que carrega o escopo inteiro.
    const ownerTurma = [...selection.turmas].sort()[0];
    const reports = readReports(ownerTurma);
    reports[cacheKey] = report;
    fs.writeFileSync(reportsPath(ownerTurma), JSON.stringify(reports, null, 2));

    res.json(report);
  } catch (err) {
    console.error('[statistics] AI report failed:', err);
    res.status(500).json({ error: err.message });
  }
};
