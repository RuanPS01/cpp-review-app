// Caminhos dos arquivos de estatísticas de uma turma.
//
// Vive num módulo próprio porque o dataset ganhou "arquivos-irmão" (relatórios
// de IA, taxonomia, e o que as próximas fases trouxerem) e mais de uma feature
// precisa resolvê-los. Manter a lista num só lugar evita os dois erros que já
// aconteceram aqui: um arquivo-irmão aparecer na listagem como se fosse uma
// importação, e sobrar órfão quando a turma é apagada.

const fs = require('fs');
const path = require('path');
const { STATS_DIR } = require('../../config/env');

/** Impede que o nome da turma escape do diretório de estatísticas. */
function sanitizeTurma(turma) {
  return String(turma || '').replace(/[\\/:*?"<>|]/g, '_').replace(/\.\./g, '_').trim();
}

/**
 * Sufixos dos arquivos-irmão. Quem adicionar um arquivo novo por turma
 * **precisa** registrá-lo aqui — é o que mantém `listDatasets` e
 * `deleteDataset` corretos sem que eles conheçam cada feature.
 */
const SIDECAR_SUFFIXES = [
  '.reports.json', '.taxonomy.json', '.activity.json',
  '.academic.json', '.outcome.json', '.interventions.json'
];

/** Todos os caminhos de uma turma, incluindo o dataset principal. */
function statisticsPaths(turma) {
  const base = path.join(STATS_DIR, `stats_${sanitizeTurma(turma)}`);
  return {
    dataset: `${base}.json`,
    reports: `${base}.reports.json`,
    taxonomy: `${base}.taxonomy.json`,
    activity: `${base}.activity.json`,
    academic: `${base}.academic.json`,
    outcome: `${base}.outcome.json`,
    interventions: `${base}.interventions.json`
  };
}

/** `true` quando o arquivo é um dataset, e não um arquivo-irmão. */
function isDatasetFile(fileName) {
  return fileName.startsWith('stats_')
    && fileName.endsWith('.json')
    && !SIDECAR_SUFFIXES.some(suffix => fileName.endsWith(suffix));
}

function readDataset(turma) {
  const filePath = statisticsPaths(turma).dataset;
  if (!fs.existsSync(filePath)) return null;
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

/** Leitura tolerante: um arquivo-irmão corrompido não derruba a rota. */
function readJsonFile(filePath, fallback) {
  if (!fs.existsSync(filePath)) return fallback;
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (err) {
    console.error(`[statistics] JSON inválido em ${path.basename(filePath)}:`, err.message);
    return fallback;
  }
}

function writeJsonFile(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

module.exports = {
  sanitizeTurma,
  SIDECAR_SUFFIXES,
  statisticsPaths,
  isDatasetFile,
  readDataset,
  readJsonFile,
  writeJsonFile
};
