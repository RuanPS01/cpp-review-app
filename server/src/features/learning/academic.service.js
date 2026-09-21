// Notas e frequência vindas do portal acadêmico.
//
// O PortalHelper ainda não automatiza o portal — o repositório dele entrega
// dados simulados e deixa a automação por Playwright para a fase de descoberta.
// Então o caminho que funciona hoje é o professor baixar a planilha e importar
// aqui. A planilha é lida no renderer (o `xlsx` é dependência do cliente) e
// chega neste módulo já como linhas normalizadas.
//
// A chave de junção é a **matrícula**: é o único identificador que o portal e o
// Moodle compartilham (`user.idnumber`, guardado em `student.idNumber`).

const { normalizeKey } = require('../statistics/statistics.service');

/** Abaixo disso, o casamento cobre um subgrupo autosselecionado e a tela avisa. */
const LOW_MATCH_RATE = 0.8;

/**
 * Matrícula comparável.
 *
 * Planilha aberta no Excel transforma matrícula em número e come o zero à
 * esquerda; o Moodle guarda a string original. Comparar os dois sem normalizar
 * casaria zero aluno — e ninguém perceberia, porque o resultado seria uma
 * tabela vazia em vez de um erro.
 */
function normalizeRegistration(value) {
  const digits = String(value ?? '').replace(/\D/g, '').replace(/^0+/, '');
  return digits || null;
}

const numberOrNull = (value) => {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(String(value).replace(',', '.').replace(/[^\d.-]/g, ''));
  return Number.isFinite(parsed) ? parsed : null;
};

/**
 * Casa as linhas da planilha com os alunos da turma.
 *
 * Prioridade matrícula → e-mail → nome. Quem não casou sai na lista, nominalmente:
 * um casamento parcial silencioso é pior que um erro, porque produz um número de
 * aparência normal calculado sobre quem sobrou.
 *
 * @param {object} dataset  stats_{turma}.json
 * @param {object[]} rows   linhas já mapeadas pelo cliente
 */
function matchAcademicRows(dataset, rows) {
  const students = dataset.students || [];

  const byRegistration = new Map();
  const byEmail = new Map();
  const byName = new Map();
  students.forEach(student => {
    const registration = normalizeRegistration(student.idNumber);
    if (registration) byRegistration.set(registration, student);
    if (student.email) byEmail.set(normalizeKey(student.email), student);
    if (student.name) byName.set(normalizeKey(student.name), student);
  });

  const matched = {};
  const counts = { byIdNumber: 0, byEmail: 0, byName: 0 };
  const unmatched = [];

  (rows || []).forEach(row => {
    const registration = normalizeRegistration(row.idNumber);
    let student = registration ? byRegistration.get(registration) : null;
    let how = student ? 'byIdNumber' : null;

    if (!student && row.email) {
      student = byEmail.get(normalizeKey(row.email));
      how = student ? 'byEmail' : null;
    }
    if (!student && row.name) {
      student = byName.get(normalizeKey(row.name));
      how = student ? 'byName' : null;
    }

    if (!student) {
      unmatched.push({ idNumber: row.idNumber ?? null, name: row.name ?? null });
      return;
    }

    counts[how] += 1;
    const finalGrade = numberOrNull(row.finalGrade);
    const gradeMax = numberOrNull(row.gradeMax) || 100;
    const absences = numberOrNull(row.absences);
    const attendanceRate = numberOrNull(row.attendanceRate);

    matched[String(student.userId ?? student.folderName)] = {
      idNumber: student.idNumber || null,
      matchedBy: how,
      finalGrade,
      gradeMax,
      // Percentual só quando a escala é conhecida — não inventamos base.
      gradePercent: finalGrade === null ? null : Math.round((finalGrade / gradeMax) * 1000) / 10,
      absences,
      attendanceRate,
      status: row.status ? String(row.status).trim() : null
    };
  });

  const withoutRow = students
    .filter(student => !matched[String(student.userId ?? student.folderName)])
    .map(student => ({ userId: student.userId ?? null, name: student.name }));

  const matchedCount = Object.keys(matched).length;
  return {
    students: matched,
    match: {
      rows: (rows || []).length,
      matched: matchedCount,
      totalStudents: students.length,
      matchRate: students.length ? Math.round((matchedCount / students.length) * 1000) / 10 : 0,
      lowMatch: students.length ? matchedCount / students.length < LOW_MATCH_RATE : true,
      ...counts,
      unmatched,
      withoutRow
    }
  };
}

function buildAcademicRecord({ dataset, rows, columns, sourceLabel }) {
  const { students, match } = matchAcademicRows(dataset, rows);
  return {
    version: 1,
    importedAt: Date.now(),
    sourceLabel: sourceLabel || null,
    columns: columns || {},
    match,
    students
  };
}

module.exports = {
  buildAcademicRecord,
  matchAcademicRows,
  normalizeRegistration,
  LOW_MATCH_RATE
};
