// Como uma seleção de turmas é lida de uma requisição.
//
// Isto vivia dentro do controller de estatísticas, mas o módulo de aprendizado
// precisa exatamente da mesma regra — e ela tem uma sutileza que não sobrevive a
// ser reescrita de memória: **nome de turma pode conter vírgula**, então não há
// separador implícito. A lista sempre chega explícita, como array (corpo JSON)
// ou como JSON serializado (`["A","B"]`, nos GETs).
//
// Duplicar isso significaria dois lugares para manter em sincronia numa regra
// cujo erro é silencioso: `"Algoritmos I, turma B"` viraria duas turmas
// inexistentes e a resposta seria um 404 confuso.

const { readDataset } = require('./statistics.paths');

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

  return [...new Set((Array.isArray(list) ? list : [list])
    .map(value => String(value).trim())
    .filter(Boolean))];
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

module.exports = { parseTurmas, parseFlag, parseIdList, loadDatasets };
