// Taxonomia de conceitos: leitura e escrita.
//
// A taxonomia (lista de conceitos de uma disciplina) é global e reutilizável;
// o mapeamento questão→conceito é por turma, porque as questões mudam a cada
// prova. Ver server/src/config/env.js para a semente padrão.

const fs = require('fs');
const path = require('path');
const { TAXONOMY_FILE, DEFAULT_TAXONOMY, STATS_DIR } = require('../../config/env');
const {
  statisticsPaths, isDatasetFile, readJsonFile, writeJsonFile
} = require('../statistics/statistics.paths');

const MAPPING_VERSION = 1;

/** Peso do conceito na questão: principal ou secundário. Sem valor livre. */
const WEIGHTS = { primary: 1, secondary: 0.5 };

function normalizeWeight(weight) {
  const value = Number(weight);
  return value === WEIGHTS.secondary ? WEIGHTS.secondary : WEIGHTS.primary;
}

// ---------------------------------------------------------------------------
// Taxonomias globais
// ---------------------------------------------------------------------------

function readTaxonomies() {
  const data = readJsonFile(TAXONOMY_FILE, null);
  if (!data || !Array.isArray(data.taxonomies)) return { ...DEFAULT_TAXONOMY };
  return data;
}

function writeTaxonomies(data) {
  writeJsonFile(TAXONOMY_FILE, data);
}

function getTaxonomy(taxonomyId) {
  return readTaxonomies().taxonomies.find(t => t.id === taxonomyId) || null;
}

const slugify = (text) => String(text || '')
  .toLowerCase()
  .normalize('NFD')
  .replace(/[̀-ͯ]/g, '')
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-|-$/g, '')
  .slice(0, 60);

/** Cria ou substitui uma taxonomia, preservando a identidade quando já existe. */
function saveTaxonomy(taxonomy) {
  if (!taxonomy?.name) throw new Error('A taxonomia precisa de um nome.');

  const data = readTaxonomies();
  const id = taxonomy.id || slugify(taxonomy.name) || `taxonomia-${Date.now()}`;

  const topics = (taxonomy.topics || [])
    .filter(topic => topic?.code && topic?.name)
    .map(topic => ({
      code: String(topic.code).trim(),
      name: String(topic.name).trim(),
      description: String(topic.description || '').trim(),
      codeSignals: Array.isArray(topic.codeSignals) ? topic.codeSignals.filter(Boolean) : []
    }));

  const duplicated = topics.map(t => t.code).filter((code, i, list) => list.indexOf(code) !== i);
  if (duplicated.length) throw new Error(`Códigos de conceito repetidos: ${[...new Set(duplicated)].join(', ')}`);

  const record = { id, name: String(taxonomy.name).trim(), topics, updatedAt: Date.now() };
  const index = data.taxonomies.findIndex(t => t.id === id);
  if (index === -1) data.taxonomies.push(record);
  else data.taxonomies[index] = record;

  writeTaxonomies(data);
  return record;
}

function deleteTaxonomy(taxonomyId) {
  const data = readTaxonomies();
  data.taxonomies = data.taxonomies.filter(t => t.id !== taxonomyId);
  writeTaxonomies(data);
}

// ---------------------------------------------------------------------------
// Mapeamento por turma
// ---------------------------------------------------------------------------

function emptyMapping() {
  return { version: MAPPING_VERSION, taxonomyId: null, mapping: {}, suggestedAt: null, reviewedAt: null, updatedAt: null };
}

function readMapping(turma) {
  return readJsonFile(statisticsPaths(turma).taxonomy, emptyMapping());
}

function writeMapping(turma, mapping) {
  const record = {
    ...emptyMapping(),
    ...mapping,
    version: MAPPING_VERSION,
    updatedAt: Date.now()
  };
  writeJsonFile(statisticsPaths(turma).taxonomy, record);
  return record;
}

/** Normaliza `{ q1: [{code, weight}] }`, descartando conceitos fora da taxonomia. */
function normalizeMapping(rawMapping, taxonomy) {
  const validCodes = new Set((taxonomy?.topics || []).map(t => t.code));
  const result = {};

  Object.entries(rawMapping || {}).forEach(([questionKey, entries]) => {
    const list = (Array.isArray(entries) ? entries : [])
      .map(entry => ({ code: String(entry?.code || '').trim(), weight: normalizeWeight(entry?.weight) }))
      .filter(entry => entry.code && validCodes.has(entry.code))
      .filter((entry, i, all) => all.findIndex(e => e.code === entry.code) === i);
    if (list.length) result[questionKey] = list;
  });

  return result;
}

/**
 * Pré-preenche o mapeamento a partir de outras turmas que já mapearam a mesma
 * atividade VPL (`cmid`). A mesma prova reaparece a cada semestre; sem isso o
 * professor remapearia tudo em cada importação.
 *
 * @returns {{ mapping: object, reusedFrom: string[] }}
 */
function inheritMappingByCmid(dataset, taxonomyId) {
  const mapping = {};
  const reusedFrom = new Set();
  if (!dataset || !taxonomyId) return { mapping, reusedFrom: [] };

  // cmid → conceitos, colhido de todas as outras turmas com a mesma taxonomia.
  const byCmid = new Map();

  let files = [];
  try {
    files = fs.readdirSync(STATS_DIR).filter(isDatasetFile);
  } catch (err) {
    return { mapping, reusedFrom: [] };
  }

  files.forEach(file => {
    const otherDataset = readJsonFile(path.join(STATS_DIR, file), null);
    if (!otherDataset?.turma || otherDataset.turma === dataset.turma) return;

    const otherMapping = readMapping(otherDataset.turma);
    if (otherMapping.taxonomyId !== taxonomyId) return;

    (otherDataset.questions || []).forEach(question => {
      const entries = otherMapping.mapping?.[question.key];
      if (question.cmid && entries?.length && !byCmid.has(question.cmid)) {
        byCmid.set(question.cmid, { entries, turma: otherDataset.turma });
      }
    });
  });

  (dataset.questions || []).forEach(question => {
    const inherited = byCmid.get(question.cmid);
    if (inherited) {
      mapping[question.key] = inherited.entries;
      reusedFrom.add(inherited.turma);
    }
  });

  return { mapping, reusedFrom: [...reusedFrom] };
}

module.exports = {
  WEIGHTS,
  readTaxonomies,
  getTaxonomy,
  saveTaxonomy,
  deleteTaxonomy,
  readMapping,
  writeMapping,
  normalizeMapping,
  inheritMappingByCmid
};
