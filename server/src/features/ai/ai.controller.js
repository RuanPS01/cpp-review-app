const fs = require('fs');
const { getStatementsPath } = require('../../utils/fileHelpers');
const { runPrompt, readSettings, extractJson } = require('./ai.service');

exports.analyzeCode = async (req, res) => {
  const { turma, questionNum, code } = req.body;
  const settings = readSettings();
  const statementsPath = getStatementsPath(turma);
  const statements = fs.existsSync(statementsPath) ? JSON.parse(fs.readFileSync(statementsPath, 'utf8')) : {};
  const statement = statements[questionNum.toString().startsWith('q') ? questionNum : `q${questionNum}`];
  if (!statement) return res.status(400).json({ error: 'Statement missing.' });

  const systemPrompt = `Evaluate C++ code: ${settings.evaluationCriteria}\nQuestion: ${statement}\nReturn JSON: {score, comment}`;

  try {
    const resultText = await runPrompt({
      settings,
      systemPrompt,
      userPrompt: `Code:\n\n${code}`,
      json: true,
      maxTokens: 1000
    });
    res.json(extractJson(resultText));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
