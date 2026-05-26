const fs = require('fs');
const path = require('path');
const { DATA_DIR } = require('../../config/env');
const { getStatementsPath, getTestCasesPath, getWeightsPath } = require('../../utils/fileHelpers');

exports.deleteTurma = (req, res) => {
  const name = req.params.name;
  const gp = path.join(DATA_DIR, `grades_turma_${name}.json`), sp = getStatementsPath(name), td = path.join(DATA_DIR, `turma_${name}`);
  try {
    if (fs.existsSync(gp)) fs.unlinkSync(gp);
    if (fs.existsSync(sp)) fs.unlinkSync(sp);
    if (fs.existsSync(td)) fs.rmSync(td, { recursive: true, force: true });
    res.json({ success: true, message: `Turma ${name} deleted.` });
  } catch (err) { res.status(500).json({ error: 'Failed to delete data' }); }
};

exports.getWeights = (req, res) => {
  const { turma } = req.query;
  const p = getWeightsPath(turma);
  if (fs.existsSync(p)) {
    res.json(JSON.parse(fs.readFileSync(p, 'utf8')));
  } else {
    res.json({});
  }
};

exports.updateWeights = (req, res) => {
  const { turma, weights } = req.body;
  fs.writeFileSync(getWeightsPath(turma), JSON.stringify(weights, null, 2));
  res.json({ success: true });
};

exports.getStatements = (req, res) => {
  const fp = getStatementsPath(req.query.turma);
  if (fs.existsSync(fp)) res.json(JSON.parse(fs.readFileSync(fp, 'utf8')));
  else res.json({});
};

exports.updateStatements = (req, res) => {
  const fp = getStatementsPath(req.body.turma);
  fs.writeFileSync(fp, JSON.stringify(req.body.statements, null, 2));
  res.json({ success: true });
};

exports.getTestCases = (req, res) => {
  const fp = getTestCasesPath(req.query.turma);
  if (fs.existsSync(fp)) res.json(JSON.parse(fs.readFileSync(fp, 'utf8')));
  else res.json({});
};
