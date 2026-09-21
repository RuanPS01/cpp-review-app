// Coleta dos relatórios de atividade do Moodle (logs e participação).
//
// O VPL diz o que o aluno entregou; os logs dizem se ele apareceu. Sem eles as
// dimensões de engajamento e regularidade viram proxy de entrega, que é uma
// coisa diferente.
//
// Duas decisões que valem para o arquivo inteiro:
//
// 1. **Agregamos na coleta.** O relatório de logs de uma turma tem dezenas de
//    milhares de linhas. Guardamos `aluno × dia → contagem`, nunca o evento
//    bruto — cabe no JSON e atende à minimização de dados que o projeto exige.
// 2. **Não existe "tempo de estudo".** O Moodle registra eventos com carimbo de
//    hora, não duração de sessão. Nada aqui estima tempo logado; falamos em
//    dias com atividade e número de eventos, que é o que o dado sustenta.

const { emitProgress } = require('../../core/progress');
const harvester = require('../statistics/moodleHarvester');

const PROGRESS_EVENT = 'learning-activity-progress';

// ---------------------------------------------------------------------------
// CSV
// ---------------------------------------------------------------------------

/**
 * Parser de CSV mínimo e tolerante. O projeto não tem nenhum utilitário de CSV
 * e trazer uma dependência para ler um relatório não se justifica — mas o
 * relatório do Moodle tem vírgula e aspas dentro de campo (descrições de
 * evento), então dividir por vírgula quebraria.
 */
function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;

  const content = String(text || '').replace(/^﻿/, '');

  for (let i = 0; i < content.length; i++) {
    const char = content[i];

    if (inQuotes) {
      if (char === '"') {
        if (content[i + 1] === '"') { field += '"'; i += 1; }
        else inQuotes = false;
      } else field += char;
      continue;
    }

    if (char === '"') inQuotes = true;
    else if (char === ',' || char === ';') { row.push(field); field = ''; }
    else if (char === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
    else if (char !== '\r') field += char;
  }

  if (field || row.length) { row.push(field); rows.push(row); }
  return rows.filter(r => r.some(cell => cell.trim()));
}

const normalizeHeader = (text) => String(text || '')
  .toLowerCase()
  .normalize('NFD')
  .replace(/[̀-ͯ]/g, '')
  .replace(/\s+/g, ' ')
  .trim();

/**
 * Localiza as colunas por nome, em português ou inglês. Um relatório com
 * cabeçalho inesperado devolve `null` e vira aviso, não exceção.
 */
function mapLogColumns(headerRow) {
  const roles = {};
  headerRow.forEach((cell, index) => {
    const label = normalizeHeader(cell);
    if (!label) return;
    if (roles.time === undefined && /^(hora|time|data|date)$/.test(label)) roles.time = index;
    else if (roles.user === undefined && /nome completo|full name|usuario afetado|user full name|nome do usuario/.test(label)) roles.user = index;
    else if (roles.context === undefined && /contexto|context|componente|component|nome do evento|event name/.test(label)) roles.context = index;
  });
  return roles.time !== undefined && roles.user !== undefined ? roles : null;
}

// ---------------------------------------------------------------------------
// Coleta
// ---------------------------------------------------------------------------

const dayKey = (timestamp) => new Date(timestamp).toISOString().slice(0, 10);

const normalizeName = (text) => String(text || '')
  .toLowerCase()
  .normalize('NFD')
  .replace(/[̀-ͯ]/g, '')
  .replace(/\s+/g, ' ')
  .trim();

/**
 * Baixa e agrega o relatório de logs do curso.
 *
 * @returns {{ byStudent: object, warnings: string[], rows: number }}
 */
async function collectCourseLogs({ fetchPage, baseUrl, courseId, students }) {
  const warnings = [];
  const byStudent = {};

  // Índice nome → userId. O relatório de logs identifica o aluno pelo nome
  // completo, não pelo id, então esse é o único casamento possível.
  const byName = new Map();
  (students || []).forEach(student => {
    if (student.name) byName.set(normalizeName(student.name), student.userId ?? student.folderName);
  });

  const url = `${baseUrl}/report/log/index.php?chooselog=1&id=${courseId}`
    + '&modid=&modaction=&user=&date=&logreader=logstore_standard&download=csv';

  let text;
  try {
    const response = await fetchPage(url, `${baseUrl}/report/log/index.php?id=${courseId}`);
    if (!response.ok) throw new Error(response.statusText || `HTTP ${response.status}`);
    text = await response.text();
  } catch (err) {
    warnings.push(`Relatório de logs indisponível: ${err.message}`);
    return { byStudent, warnings, rows: 0 };
  }

  if (/<html/i.test(text.slice(0, 500))) {
    warnings.push('O Moodle devolveu HTML em vez do CSV de logs (permissão ou sessão).');
    return { byStudent, warnings, rows: 0 };
  }

  const rows = parseCsv(text);
  if (rows.length < 2) {
    warnings.push('O relatório de logs veio vazio.');
    return { byStudent, warnings, rows: 0 };
  }

  const columns = mapLogColumns(rows[0]);
  if (!columns) {
    warnings.push('Não foi possível reconhecer as colunas do relatório de logs.');
    return { byStudent, warnings, rows: 0 };
  }

  let matched = 0;
  rows.slice(1).forEach(row => {
    const timestamp = harvester.parseMoodleDate(row[columns.time]);
    const studentId = byName.get(normalizeName(row[columns.user]));
    if (!timestamp || studentId === undefined) return;

    matched += 1;
    const key = String(studentId);
    if (!byStudent[key]) byStudent[key] = { days: {}, firstAccess: null, lastAccess: null, events: 0 };
    const record = byStudent[key];

    const day = dayKey(timestamp);
    record.days[day] = (record.days[day] || 0) + 1;
    record.events += 1;
    if (!record.firstAccess || timestamp < record.firstAccess) record.firstAccess = timestamp;
    if (!record.lastAccess || timestamp > record.lastAccess) record.lastAccess = timestamp;
  });

  if (matched === 0) {
    warnings.push('Nenhuma linha do relatório de logs casou com os alunos da turma (nomes divergentes?).');
  }

  return { byStudent, warnings, rows: rows.length - 1 };
}

/**
 * Relatório de participação por atividade: quantos alunos visualizaram cada
 * VPL. Complementa os logs quando eles não estão liberados.
 */
async function collectParticipation({ fetchPage, baseUrl, courseId, questions, students }) {
  const warnings = [];
  const byStudent = {};
  const byName = new Map();
  (students || []).forEach(student => {
    if (student.name) byName.set(normalizeName(student.name), student.userId ?? student.folderName);
  });

  // Uma atividade recusada é ruído; todas recusadas é a fonte inteira fora do
  // ar, e isso o professor precisa saber — senão a tela só mostra
  // "participação: não" sem dizer por quê.
  let refused = 0;

  for (const question of questions || []) {
    const url = `${baseUrl}/report/participation/index.php?id=${courseId}`
      + `&instanceid=${question.cmid}&roleid=5&timefrom=0&action=viewed&perpage=5000`;
    try {
      const response = await fetchPage(url, `${baseUrl}/report/participation/index.php?id=${courseId}`);
      if (!response.ok) { refused += 1; continue; }
      const html = await response.text();

      // A tabela marca "Sim/Yes" na coluna de visualização por aluno.
      const rows = html.match(/<tr[^>]*>[\s\S]*?<\/tr>/gi) || [];
      rows.forEach(rowHtml => {
        const cells = (rowHtml.match(/<t[dh][^>]*>[\s\S]*?<\/t[dh]>/gi) || [])
          .map(cell => harvester.stripHtml(cell));
        if (cells.length < 2) return;
        const studentId = byName.get(normalizeName(cells.find(c => byName.has(normalizeName(c))) || ''));
        if (studentId === undefined) return;
        const viewed = cells.some(cell => /^(sim|yes)$/i.test(cell.trim()));
        if (!viewed) return;

        const key = String(studentId);
        if (!byStudent[key]) byStudent[key] = { viewedActivities: [] };
        if (!byStudent[key].viewedActivities.includes(question.cmid)) {
          byStudent[key].viewedActivities.push(question.cmid);
        }
      });
    } catch (err) {
      warnings.push(`Participação de "${question.name}" indisponível: ${err.message}`);
    }
  }

  if (refused) {
    warnings.push(`O relatório de participação foi recusado em ${refused} de ${(questions || []).length} atividades.`);
  }

  return { byStudent, warnings };
}

/**
 * Orquestra a coleta e devolve o registro pronto para persistir.
 */
async function collectActivity({ turma, baseUrl, cookie, userAgent, courseId, dataset }) {
  const { fetchPage } = harvester.createSession({ baseUrl, cookie, userAgent });
  const progress = (message) => emitProgress(PROGRESS_EVENT, { turma, message });

  const students = (dataset.students || []).map(s => ({
    userId: s.userId, folderName: s.folderName, name: s.name
  }));

  progress('Abrindo sessão no Moodle');
  await fetchPage(baseUrl);

  progress('Baixando o relatório de logs');
  const logs = await collectCourseLogs({ fetchPage, baseUrl, courseId, students });

  progress('Lendo o relatório de participação');
  const participation = await collectParticipation({
    fetchPage, baseUrl, courseId, questions: dataset.questions || [], students
  });

  // Une as duas fontes numa entrada por aluno.
  const byStudent = {};
  new Set([...Object.keys(logs.byStudent), ...Object.keys(participation.byStudent)]).forEach(key => {
    byStudent[key] = {
      days: logs.byStudent[key]?.days || {},
      events: logs.byStudent[key]?.events || 0,
      firstAccess: logs.byStudent[key]?.firstAccess || null,
      lastAccess: logs.byStudent[key]?.lastAccess || null,
      viewedActivities: participation.byStudent[key]?.viewedActivities || []
    };
  });

  progress('Coleta concluída');

  return {
    version: 1,
    turma,
    courseId,
    collectedAt: Date.now(),
    sources: {
      logs: Object.keys(logs.byStudent).length > 0,
      participation: Object.keys(participation.byStudent).length > 0
    },
    logRows: logs.rows,
    warnings: [...logs.warnings, ...participation.warnings],
    byStudent
  };
}

module.exports = { collectActivity, parseCsv, mapLogColumns, PROGRESS_EVENT };
