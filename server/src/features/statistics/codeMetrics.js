// Métricas estáticas leves sobre o código C++ submetido.
//
// Não é um parser de C++: são heurísticas textuais suficientes para responder
// "quais construções a turma está usando?" e para dar contexto quantitativo à
// análise de IA. Tudo que é aproximado está marcado como tal.

const CONCEPT_PATTERNS = [
  { key: 'loops', label: 'Laços de repetição', pattern: /\b(for|while|do)\s*[({]/ },
  { key: 'conditionals', label: 'Condicionais', pattern: /\b(if|switch)\s*\(/ },
  { key: 'functions', label: 'Funções próprias', pattern: /^[ \t]*(?:[A-Za-z_][\w:<>,\s*&]*?)\s+([A-Za-z_]\w*)\s*\([^;]*\)\s*\{/m },
  { key: 'arrays', label: 'Vetores/matrizes', pattern: /\w+\s+\w+\s*\[\s*\w*\s*\]/ },
  { key: 'pointers', label: 'Ponteiros', pattern: /\*\s*\w+\s*=|\w+\s*\*\s*\w+\s*[;,)=]|->/ },
  { key: 'structs', label: 'Structs/classes', pattern: /\b(struct|class)\s+\w+/ },
  { key: 'stdVector', label: 'std::vector', pattern: /\bvector\s*</ },
  { key: 'stdString', label: 'std::string', pattern: /\bstring\b/ },
  { key: 'fileIo', label: 'Arquivos', pattern: /\b(ifstream|ofstream|fstream|fopen)\b/ },
  { key: 'dynamicMemory', label: 'Memória dinâmica', pattern: /\b(new|malloc|calloc)\b/ },
  { key: 'exceptions', label: 'Tratamento de exceções', pattern: /\b(try|catch|throw)\b/ },
  { key: 'stdAlgorithm', label: 'Biblioteca algorithm', pattern: /#include\s*<algorithm>/ }
];

const SMELL_PATTERNS = [
  { key: 'usingNamespaceStd', label: 'using namespace std', pattern: /using\s+namespace\s+std\s*;/ },
  { key: 'gotoUsage', label: 'Uso de goto', pattern: /\bgoto\b/ },
  { key: 'systemPause', label: 'system("pause")', pattern: /system\s*\(\s*["'](pause|PAUSE|cls)["']\s*\)/ }
];

const TYPE_KEYWORDS = 'int|float|double|char|bool|long|short|unsigned|string|vector|auto';

/**
 * Declarações fora de qualquer bloco. Percorre o código controlando a
 * profundidade de chaves porque um regex simples confunde variáveis locais
 * indentadas com globais.
 */
function hasGlobalVariables(code) {
  let depth = 0;
  for (const rawLine of code.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (depth === 0 && line && !line.startsWith('#')) {
      const isDeclaration = new RegExp(`^(?:static\\s+|const\\s+)*(?:${TYPE_KEYWORDS})[\\w<>,:\\s*&]*\\s+\\w+\\s*(?:\\[[^\\]]*\\])?\\s*(?:=[^;]*)?;`).test(line);
      if (isDeclaration) return true;
    }
    for (const char of rawLine) {
      if (char === '{') depth += 1;
      else if (char === '}') depth = Math.max(0, depth - 1);
    }
  }
  return false;
}

function stripStringsAndComments(source) {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/\/\/[^\n]*/g, ' ')
    .replace(/"(?:\\.|[^"\\])*"/g, '""')
    .replace(/'(?:\\.|[^'\\])*'/g, "''");
}

function countMaxNesting(code) {
  let depth = 0;
  let max = 0;
  for (const char of code) {
    if (char === '{') { depth += 1; max = Math.max(max, depth); }
    else if (char === '}') depth = Math.max(0, depth - 1);
  }
  return max;
}

function countFunctions(code) {
  const matches = code.matchAll(/(?:^|\n)[ \t]*(?:[A-Za-z_][\w:<>,\s*&]*?)\s+([A-Za-z_]\w*)\s*\([^;{)]*\)\s*(?:const\s*)?\{/g);
  const names = new Set();
  for (const match of matches) {
    const name = match[1];
    if (['if', 'for', 'while', 'switch', 'catch', 'do', 'return'].includes(name)) continue;
    names.add(name);
  }
  return names;
}

function detectRecursion(code, functionNames) {
  for (const name of functionNames) {
    if (name === 'main') continue;
    const bodyStart = code.indexOf(`${name}(`);
    if (bodyStart === -1) continue;
    const occurrences = (code.match(new RegExp(`\\b${name}\\s*\\(`, 'g')) || []).length;
    // Definição + pelo menos duas chamadas sugere chamada dentro do próprio corpo.
    if (occurrences >= 3) return true;
  }
  return false;
}

/**
 * @param {string} source código-fonte bruto
 * @returns {object|null} métricas, ou null se não houver código
 */
function analyzeCode(source) {
  if (!source || !source.trim()) return null;

  const lines = source.split(/\r?\n/);
  const blankLines = lines.filter(l => !l.trim()).length;
  const commentLines = lines.filter(l => /^\s*(\/\/|\/\*|\*)/.test(l)).length;
  const clean = stripStringsAndComments(source);
  const functionNames = countFunctions(clean);

  const concepts = {};
  CONCEPT_PATTERNS.forEach(({ key, pattern }) => { concepts[key] = pattern.test(clean); });
  concepts.functions = functionNames.size > 1; // além de main
  concepts.recursion = detectRecursion(clean, functionNames);

  const smells = {};
  SMELL_PATTERNS.forEach(({ key, pattern }) => { smells[key] = pattern.test(clean); });
  smells.globalVariables = hasGlobalVariables(clean);

  const includes = [...clean.matchAll(/#include\s*[<"]([^>"]+)[>"]/g)].map(m => m[1]);
  const magicNumbers = (clean.match(/(?<![\w.])\d{2,}(?![\w.])/g) || []).length;

  return {
    totalLines: lines.length,
    codeLines: lines.length - blankLines - commentLines,
    blankLines,
    commentLines,
    commentRatio: lines.length ? Number((commentLines / lines.length).toFixed(3)) : 0,
    characters: source.length,
    functionCount: functionNames.size,
    maxNestingDepth: countMaxNesting(clean),
    magicNumbers,
    includes: [...new Set(includes)],
    concepts,
    smells
  };
}

const CONCEPT_LABELS = Object.fromEntries([
  ...CONCEPT_PATTERNS.map(({ key, label }) => [key, label]),
  ['recursion', 'Recursão']
]);

const SMELL_LABELS = Object.fromEntries([
  ...SMELL_PATTERNS.map(({ key, label }) => [key, label]),
  ['globalVariables', 'Variáveis globais']
]);

module.exports = { analyzeCode, CONCEPT_LABELS, SMELL_LABELS };
