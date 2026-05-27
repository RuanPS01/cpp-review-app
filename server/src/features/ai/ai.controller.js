const fs = require('fs');
const { Ollama } = require('ollama');
const { OpenAI } = require('openai');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const Anthropic = require('@anthropic-ai/sdk');
const { SETTINGS_FILE } = require('../../config/env');
const { getStatementsPath } = require('../../utils/fileHelpers');

exports.analyzeCode = async (req, res) => {
  const { turma, questionNum, code } = req.body;
  const settings = JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf8')), sp = getStatementsPath(turma), statements = fs.existsSync(sp) ? JSON.parse(fs.readFileSync(sp, 'utf8')) : {};
  const statement = statements[questionNum.toString().startsWith('q') ? questionNum : `q${questionNum}`];
  if (!statement) return res.status(400).json({ error: 'Statement missing.' });
  const systemPrompt = `Evaluate C++ code: ${settings.evaluationCriteria}\nQuestion: ${statement}\nReturn JSON: {score, comment}`;
  try {
    let resultText = '';
    if (settings.provider === 'ollama') resultText = (await (new Ollama()).chat({ model: settings.ollamaModel, messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: `Code:\n\n${code}` }], format: 'json' })).message.content;
    else if (settings.provider === 'openai') resultText = (await (new OpenAI({ apiKey: settings.cloudKey })).chat.completions.create({ model: settings.cloudModel || 'gpt-4o', messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: `Code:\n\n${code}` }], response_format: { type: 'json_object' } })).choices[0].message.content;
    else if (settings.provider === 'gemini') resultText = (await (new GoogleGenerativeAI(settings.cloudKey)).getGenerativeModel({ model: settings.cloudModel || "gemini-1.5-pro" }).generateContent(`${systemPrompt}\n\nCode:\n\n${code}`)).response.text();
    else if (settings.provider === 'claude') resultText = (await (new Anthropic({ apiKey: settings.cloudKey })).messages.create({ model: settings.cloudModel || "claude-3-5-sonnet-20240620", max_tokens: 1000, system: systemPrompt, messages: [{ role: "user", content: `Code:\n\n${code}` }] })).content[0].text;
    const jsonMatch = resultText.match(/\{[\s\S]*\}/);
    if (jsonMatch) res.json(JSON.parse(jsonMatch[0]));
    else throw new Error('AI failed to return valid JSON');
  } catch (err) { res.status(500).json({ error: err.message }); }
};
