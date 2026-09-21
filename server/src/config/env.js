const path = require('path');
const fs = require('fs');

let DATA_DIR;
if (process.versions.electron) {
  const { app: electronApp } = require('electron');
  DATA_DIR = path.join(electronApp.getPath('userData'), 'data');
} else {
  DATA_DIR = path.join(__dirname, '..', '..', 'data');
}

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const SETTINGS_FILE = path.join(DATA_DIR, 'settings.json');
const DEFAULT_SETTINGS = {
  provider: 'ollama',
  ollamaModel: 'llama3',
  cloudModel: 'gemini-1.5-flash-lite',
  cloudKey: '',
  evaluationCriteria: `Sistema de correção: (critérios omitidos para brevidade)`
};

if (!fs.existsSync(SETTINGS_FILE)) {
  fs.writeFileSync(SETTINGS_FILE, JSON.stringify(DEFAULT_SETTINGS, null, 2));
}

const UPLOADS_DIR = path.join(DATA_DIR, 'uploads');
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

const STATS_DIR = path.join(DATA_DIR, 'statistics');
if (!fs.existsSync(STATS_DIR)) {
  fs.mkdirSync(STATS_DIR, { recursive: true });
}

// Taxonomia de conceitos: global e reutilizável entre turmas. Mapear questão a
// conceito é trabalho manual do professor, então recadastrar os conceitos a
// cada importação seria o gargalo que o projeto de analytics prevê. Só o
// mapeamento questão→conceito é por turma.
const TAXONOMY_FILE = path.join(DATA_DIR, 'taxonomy.json');

// `codeSignals` liga cada conceito curricular às chaves do detector estático em
// features/statistics/codeMetrics.js. Conceito sem sinal confiável fica com a
// lista vazia — inventar um vínculo produziria evidência falsa. Busca e
// Ordenação não têm detector; Matrizes fica de fora porque o detector não
// distingue vetor de matriz.
const DEFAULT_TAXONOMY = {
  version: 1,
  taxonomies: [
    {
      id: 'algoritmos-1',
      name: 'Algoritmos I',
      topics: [
        { code: 'AL01', name: 'Variáveis', description: '', codeSignals: [] },
        { code: 'AL02', name: 'Entrada e saída', description: '', codeSignals: [] },
        { code: 'AL03', name: 'Estruturas condicionais', description: '', codeSignals: ['conditionals'] },
        { code: 'AL04', name: 'Estruturas de repetição', description: '', codeSignals: ['loops'] },
        { code: 'AL05', name: 'Vetores', description: '', codeSignals: ['arrays', 'stdVector'] },
        { code: 'AL06', name: 'Matrizes', description: '', codeSignals: [] },
        { code: 'AL07', name: 'Funções', description: '', codeSignals: ['functions', 'recursion'] },
        { code: 'AL08', name: 'Busca', description: '', codeSignals: [] },
        { code: 'AL09', name: 'Ordenação', description: '', codeSignals: [] }
      ],
      updatedAt: 0
    }
  ]
};

if (!fs.existsSync(TAXONOMY_FILE)) {
  fs.writeFileSync(TAXONOMY_FILE, JSON.stringify(DEFAULT_TAXONOMY, null, 2));
}

module.exports = {
  DATA_DIR,
  SETTINGS_FILE,
  DEFAULT_SETTINGS,
  UPLOADS_DIR,
  STATS_DIR,
  TAXONOMY_FILE,
  DEFAULT_TAXONOMY
};
