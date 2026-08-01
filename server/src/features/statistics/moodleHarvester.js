// Coleta de dados brutos do Moodle/VPL usando a sessão (cookie) capturada no login.
//
// O Web Service do Moodle nem sempre expõe as funções `mod_vpl_*` (ver
// docs/moodle-vpl-integration-guide.md), então o que não vier pelo token é
// espelhado a partir das próprias páginas HTML do VPL. Todo parser aqui é
// tolerante: quando o Moodle muda de layout ou de idioma, o campo vira `null`
// em vez de derrubar a importação inteira.

const DEFAULT_USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

/**
 * Cria uma sessão HTTP autenticada que mantém os cookies atualizados entre as
 * requisições e segue redirecionamentos manualmente (o Moodle redireciona para
 * o login quando a sessão expira, e queremos detectar isso explicitamente).
 */
function createSession({ baseUrl, cookie, userAgent }) {
  let currentCookie = String(cookie || '');
  const UA = userAgent || DEFAULT_USER_AGENT;

  const updateCookies = (setCookieHeaders) => {
    if (!setCookieHeaders || !currentCookie) return;
    try {
      const cookiesMap = currentCookie.split('; ').reduce((acc, c) => {
        const parts = c.split('=');
        if (parts.length >= 2) acc[parts[0].trim()] = parts.slice(1).join('=').trim();
        return acc;
      }, {});
      setCookieHeaders.forEach(header => {
        const parts = header.split(';')[0].split('=');
        if (parts.length >= 2) cookiesMap[parts[0].trim()] = parts.slice(1).join('=').trim();
      });
      currentCookie = Object.entries(cookiesMap).map(([k, v]) => `${k}=${v}`).join('; ');
    } catch (err) {
      // Mantém o cookie anterior se o cabeçalho vier malformado.
    }
  };

  const fetchPage = async (url, referer = baseUrl) => {
    const headers = {
      'Cookie': currentCookie,
      'User-Agent': UA,
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
      'Accept-Language': 'pt-BR,pt;q=0.9,en;q=0.8',
      'Referer': referer,
      'Connection': 'keep-alive',
      'Upgrade-Insecure-Requests': '1',
      'Sec-Fetch-Dest': 'document',
      'Sec-Fetch-Mode': 'navigate',
      'Sec-Fetch-Site': 'same-origin',
      'Sec-Fetch-User': '?1'
    };
    const response = await fetch(url, { headers, redirect: 'manual' });
    const setCookies = response.headers.getSetCookie
      ? response.headers.getSetCookie()
      : response.headers.get('set-cookie')?.split(',');
    updateCookies(setCookies);

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get('location');
      if (location) {
        const nextUrl = new URL(location, url).href;
        if (nextUrl.includes('login/index.php')) throw new Error('Sessão inválida. Redirecionado para o login.');
        return fetchPage(nextUrl, url);
      }
    }
    return response;
  };

  return { fetchPage };
}

// ---------------------------------------------------------------------------
// Helpers de HTML
// ---------------------------------------------------------------------------

const ENTITIES = {
  '&nbsp;': ' ', '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"',
  '&#039;': "'", '&#39;': "'", '&apos;': "'", '&ndash;': '-', '&mdash;': '-'
};

function decodeEntities(text) {
  return String(text || '')
    .replace(/&nbsp;|&amp;|&lt;|&gt;|&quot;|&#0?39;|&apos;|&ndash;|&mdash;/g, m => ENTITIES[m] ?? m)
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)));
}

function stripHtml(html) {
  return decodeEntities(
    String(html || '')
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<br\s*\/?>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
  ).replace(/\s+/g, ' ').trim();
}

function normalizeLabel(text) {
  return stripHtml(text)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim();
}

function parseNumber(text) {
  if (text === null || text === undefined) return null;
  // "8,50 / 10,00" -> 8.5 ; "-" -> null
  const match = String(text).replace(/\s/g, '').match(/-?\d+(?:[.,]\d+)?/);
  if (!match) return null;
  const value = parseFloat(match[0].replace(',', '.'));
  return Number.isFinite(value) ? value : null;
}

/**
 * Datas do Moodle chegam em formatos muito variados por idioma
 * ("28/04/26, 18:28", "28 April 2026, 6:28 PM"). Só convertemos os formatos
 * numéricos, que são inequívocos; o restante fica como texto e a linha do tempo
 * usa os carimbos exatos vindos do ZIP de submissões.
 */
function parseMoodleDate(text) {
  const clean = stripHtml(text);
  if (!clean) return null;

  const dmy = clean.match(/(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})(?:[,\s]+(\d{1,2}):(\d{2}))?/);
  if (dmy) {
    let [, day, month, year, hour, minute] = dmy;
    let fullYear = Number(year);
    if (fullYear < 100) fullYear += 2000;
    const date = new Date(fullYear, Number(month) - 1, Number(day), Number(hour || 0), Number(minute || 0));
    if (!Number.isNaN(date.getTime())) return date.getTime();
  }

  const iso = clean.match(/(\d{4})-(\d{2})-(\d{2})[T\s-](\d{2})[-:](\d{2})(?:[-:](\d{2}))?/);
  if (iso) {
    const [, year, month, day, hour, minute, second] = iso;
    const date = new Date(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute), Number(second || 0));
    if (!Number.isNaN(date.getTime())) return date.getTime();
  }

  return null;
}

/** Nomes de pasta do VPL no ZIP: `2026-04-28-18-28-17`. */
function parseFolderTimestamp(folderName) {
  const match = String(folderName || '').match(/(\d{4})-(\d{2})-(\d{2})-(\d{2})-(\d{2})-(\d{2})/);
  if (!match) return null;
  const [, year, month, day, hour, minute, second] = match;
  const date = new Date(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute), Number(second));
  return Number.isNaN(date.getTime()) ? null : date.getTime();
}

// ---------------------------------------------------------------------------
// Parsers das páginas do VPL
// ---------------------------------------------------------------------------

/** Enunciado da atividade, exibido em `mod/vpl/view.php`. */
function parseStatement(html) {
  const introMatch = html.match(/<div id="vpl_intro"[^>]*>([\s\S]*?)<\/div>(?:\s*<div class="clearer"><\/div>|$)/);
  if (introMatch) return introMatch[1].trim();

  const generalBox = html.match(/<div class="box py-3 generalbox">[\s\S]*?<div class="no-overflow">([\s\S]*?)<\/div>\s*<\/div>/);
  return generalBox ? generalBox[1].trim() : null;
}

/** Casos de teste (`vpl_evaluate.cases`) renderizados na página da atividade. */
function parseTestCases(html) {
  const casesMatch = html.match(/<pre[^>]*id=['"]codefileid1['"][^>]*>([\s\S]*?)<\/pre>/i);
  if (!casesMatch) return [];

  const raw = decodeEntities(casesMatch[1]).trim();
  const parsed = [];
  const blocks = raw.split(/(?=Case\s*=)/i).filter(b => b.trim());

  for (const block of blocks) {
    const testCase = { name: '', input: '', output: '', gradeReduction: '' };
    let currentField = null;
    let buffer = [];

    const flush = () => {
      if (currentField && buffer.length > 0) {
        let value = buffer.join('\n').trim();
        if (currentField === 'output' && value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
        testCase[currentField] = value;
        buffer = [];
      }
    };

    for (const line of block.split('\n')) {
      const trimmed = line.trim();
      const lower = trimmed.toLowerCase();
      if (lower.startsWith('case')) { flush(); testCase.name = trimmed.split('=')[1]?.trim() || ''; currentField = null; }
      else if (lower.startsWith('input')) { flush(); currentField = 'input'; const v = trimmed.split('=')[1]?.trim(); if (v) buffer.push(v); }
      else if (lower.startsWith('output')) { flush(); currentField = 'output'; const v = trimmed.split('=')[1]?.trim(); if (v) buffer.push(v); }
      else if (lower.startsWith('grade reduction')) { flush(); testCase.gradeReduction = trimmed.split('=')[1]?.trim() || ''; currentField = null; }
      else if (currentField) buffer.push(line);
    }
    flush();
    if (testCase.input || testCase.output) parsed.push(testCase);
  }
  return parsed;
}

/**
 * Datas de abertura/entrega mostradas na página da atividade. Serve de fallback
 * quando `core_course_get_contents` não trouxe o array `dates`.
 */
function parseActivityDates(html) {
  const dates = { startDate: null, dueDate: null };
  const rows = html.match(/<tr[^>]*>[\s\S]*?<\/tr>/gi) || [];

  for (const row of rows) {
    const label = normalizeLabel(row);
    const timestamp = parseMoodleDate(row);
    if (!timestamp) continue;
    if (/entrega|due|prazo|encerra/.test(label)) dates.dueDate = dates.dueDate ?? timestamp;
    else if (/inicio|abertura|opened|available|disponivel/.test(label)) dates.startDate = dates.startDate ?? timestamp;
  }
  return dates;
}

/** Nota máxima configurada na atividade (`Nota máxima: 10`). */
function parseMaxGrade(html) {
  const label = normalizeLabel(html);
  const match = label.match(/(?:nota maxima|maximum grade|qualificacao maxima)\D{0,10}(\d+(?:[.,]\d+)?)/);
  return match ? parseNumber(match[1]) : null;
}

function extractRows(html) {
  return (html.match(/<tr[^>]*>[\s\S]*?<\/tr>/gi) || []).map(row => ({
    html: row,
    cells: (row.match(/<t[dh][^>]*>[\s\S]*?<\/t[dh]>/gi) || []).map(cell => ({
      html: cell,
      text: stripHtml(cell)
    }))
  }));
}

/** Mapeia cada coluna da tabela para um papel, a partir do cabeçalho. */
function mapColumns(headerCells) {
  const roles = {};
  headerCells.forEach((cell, index) => {
    const label = normalizeLabel(cell.text);
    if (!label) return;
    if (roles.name === undefined && /nome|name|aluno|student|usuario|participante/.test(label)) roles.name = index;
    else if (roles.submissions === undefined && /submissoes|submissions|tentativas|attempts|envios|nsub/.test(label)) roles.submissions = index;
    else if (roles.date === undefined && /submissao|submission|data|date|enviado|modificado|modified/.test(label)) roles.date = index;
    else if (roles.grade === undefined && /nota|grade|qualificacao|pontuacao|score/.test(label)) roles.grade = index;
    else if (roles.evaluation === undefined && /avaliacao|evaluation|status|situacao|resultado|feedback/.test(label)) roles.evaluation = index;
  });
  return roles;
}

/**
 * Lista de submissões (`mod/vpl/views/submissionslist.php`). Devolve uma linha
 * por aluno com o que a tabela expõe: data do último envio, número de
 * tentativas, nota automática e o texto de avaliação.
 */
function parseSubmissionsList(html) {
  const tables = html.match(/<table[^>]*>[\s\S]*?<\/table>/gi) || [];
  const table = tables.find(t => /userid=\d+/.test(t));
  if (!table) return [];

  const rows = extractRows(table);
  const headerRow = rows.find(r => /<th[\s>]/i.test(r.html) && !/userid=\d+/.test(r.html));
  const roles = headerRow ? mapColumns(headerRow.cells) : {};

  const entries = [];
  const seen = new Set();

  for (const row of rows) {
    const userIdMatch = row.html.match(/userid=(\d+)/);
    if (!userIdMatch) continue;
    const userId = Number(userIdMatch[1]);
    if (seen.has(userId)) continue;
    seen.add(userId);

    const cellText = (index) => (index !== undefined && row.cells[index] ? row.cells[index].text : null);

    // Sem cabeçalho reconhecível caímos em heurísticas: a célula com link de
    // aluno vira o nome, a primeira data vira a submissão e o maior número
    // isolado vira a nota.
    let name = cellText(roles.name);
    if (!name) {
      const linkCell = row.cells.find(c => /submissionview\.php|user\/view\.php/.test(c.html));
      name = linkCell ? linkCell.text : null;
    }

    let submittedAt = roles.date !== undefined ? parseMoodleDate(cellText(roles.date)) : null;
    if (!submittedAt) {
      for (const cell of row.cells) {
        const parsed = parseMoodleDate(cell.text);
        if (parsed) { submittedAt = parsed; break; }
      }
    }

    const grade = roles.grade !== undefined ? parseNumber(cellText(roles.grade)) : null;
    const attempts = roles.submissions !== undefined ? parseNumber(cellText(roles.submissions)) : null;
    const evaluation = roles.evaluation !== undefined ? cellText(roles.evaluation) : null;

    entries.push({
      userId,
      name: name || null,
      submittedAt,
      submittedAtText: roles.date !== undefined ? cellText(roles.date) : null,
      grade,
      attempts: attempts !== null ? Math.round(attempts) : null,
      evaluation: evaluation || null
    });
  }

  return entries;
}

/**
 * Histórico completo de tentativas de um aluno
 * (`mod/vpl/views/previoussubmissionslist.php`) — usado para medir persistência.
 */
function parsePreviousSubmissions(html) {
  const rows = extractRows(html);
  const attempts = [];

  for (const row of rows) {
    if (/<th[\s>]/i.test(row.html) && !/submissionview\.php/.test(row.html)) continue;
    let timestamp = null;
    for (const cell of row.cells) {
      timestamp = parseMoodleDate(cell.text);
      if (timestamp) break;
    }
    if (!timestamp) continue;
    const grade = row.cells.map(c => parseNumber(c.text)).find(v => v !== null && v >= 0) ?? null;
    attempts.push({ submittedAt: timestamp, grade });
  }

  return attempts.sort((a, b) => a.submittedAt - b.submittedAt);
}

// ---------------------------------------------------------------------------
// Interpretação do resultado da avaliação automática do VPL
// ---------------------------------------------------------------------------

/**
 * Extrai nota, casos reprovados e erros de compilação do texto devolvido pelo
 * avaliador do VPL (`mod_vpl_get_result`).
 */
function parseEvaluation(evaluationText, compilationText) {
  const evaluation = String(evaluationText || '');
  const compilation = String(compilationText || '');

  const gradeMatch = evaluation.match(/Grade\s*:=>>\s*([\d.,]+)/i);
  const grade = gradeMatch ? parseNumber(gradeMatch[1]) : null;

  const failedCases = [];
  // Formato clássico: "Case = Nome (FAILED)".
  for (const match of evaluation.matchAll(/Case\s*=\s*(.+?)\s*\(\s*(?:FAILED|FALHOU|ERROR)\s*\)/gi)) {
    failedCases.push(match[1].trim());
  }
  // Formato do avaliador padrão: comentários iniciados por "-" descrevem falhas.
  if (failedCases.length === 0) {
    for (const match of evaluation.matchAll(/^-+\s*(.+)$/gm)) {
      const text = match[1].trim();
      if (!text || /^comments?\b/i.test(text)) continue;
      if (/^(input|output|expected|program|saida|entrada|esperad)/i.test(text)) continue;
      failedCases.push(text);
    }
  }

  const compileErrors = [];
  for (const match of compilation.matchAll(/(?:^|\n)[^\n:]*:\d+:\d+:\s*(?:fatal\s+)?error:\s*([^\n]+)/gi)) {
    compileErrors.push(match[1].trim());
  }
  if (compileErrors.length === 0 && /error/i.test(compilation)) {
    for (const match of compilation.matchAll(/(?:^|\n)\s*(?:fatal\s+)?error:\s*([^\n]+)/gi)) {
      compileErrors.push(match[1].trim());
    }
  }

  return {
    grade,
    failedCases: [...new Set(failedCases)].slice(0, 20),
    compileErrors: [...new Set(compileErrors)].slice(0, 10),
    hasCompileError: compileErrors.length > 0 || /\berror\b/i.test(compilation)
  };
}

module.exports = {
  createSession,
  stripHtml,
  decodeEntities,
  parseNumber,
  parseMoodleDate,
  parseFolderTimestamp,
  parseStatement,
  parseTestCases,
  parseActivityDates,
  parseMaxGrade,
  parseSubmissionsList,
  parsePreviousSubmissions,
  parseEvaluation
};
