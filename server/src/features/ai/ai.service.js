// Camada única de acesso aos provedores de IA.
//
// Antes cada rota montava seu próprio cliente; com a tela de Estatísticas
// passaram a existir dois consumidores (correção de código e relatórios
// pedagógicos), então a escolha do provedor vive aqui e as rotas só descrevem o
// prompt que querem.

const fs = require('fs');
const { Ollama } = require('ollama');
const { OpenAI } = require('openai');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const Anthropic = require('@anthropic-ai/sdk');
const { SETTINGS_FILE, DEFAULT_SETTINGS } = require('../../config/env');

const DEFAULT_MODELS = {
  openai: 'gpt-4o',
  gemini: 'gemini-1.5-pro',
  claude: 'claude-3-5-sonnet-20240620'
};

function readSettings() {
  if (!fs.existsSync(SETTINGS_FILE)) return { ...DEFAULT_SETTINGS };
  return JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf8'));
}

/**
 * Executa um prompt no provedor configurado.
 *
 * @param {object} options
 * @param {string} options.systemPrompt instruções de sistema
 * @param {string} options.userPrompt conteúdo a ser analisado
 * @param {boolean} [options.json] pede resposta em JSON estruturado
 * @param {number} [options.maxTokens] limite de saída (provedores de nuvem)
 * @param {object} [options.settings] configurações já carregadas
 * @returns {Promise<string>} texto bruto devolvido pelo modelo
 */
async function runPrompt({ systemPrompt, userPrompt, json = false, maxTokens = 2000, settings }) {
  const config = settings || readSettings();

  if (config.provider !== 'ollama' && !config.cloudKey) {
    throw new Error('Chave de API não configurada para o provedor selecionado.');
  }

  if (config.provider === 'ollama') {
    const response = await new Ollama().chat({
      model: config.ollamaModel,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      ...(json ? { format: 'json' } : {})
    });
    return response.message.content;
  }

  if (config.provider === 'openai') {
    const response = await new OpenAI({ apiKey: config.cloudKey }).chat.completions.create({
      model: config.cloudModel || DEFAULT_MODELS.openai,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      ...(json ? { response_format: { type: 'json_object' } } : {})
    });
    return response.choices[0].message.content;
  }

  if (config.provider === 'gemini') {
    const model = new GoogleGenerativeAI(config.cloudKey)
      .getGenerativeModel({ model: config.cloudModel || DEFAULT_MODELS.gemini });
    const response = await model.generateContent(`${systemPrompt}\n\n${userPrompt}`);
    return response.response.text();
  }

  if (config.provider === 'claude') {
    const response = await new Anthropic({ apiKey: config.cloudKey }).messages.create({
      model: config.cloudModel || DEFAULT_MODELS.claude,
      max_tokens: maxTokens,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }]
    });
    return response.content[0].text;
  }

  throw new Error(`Provedor de IA desconhecido: ${config.provider}`);
}

/** Extrai o primeiro objeto JSON de uma resposta que pode vir com texto ao redor. */
function extractJson(text) {
  const match = String(text || '').match(/\{[\s\S]*\}/);
  if (!match) throw new Error('AI failed to return valid JSON');
  return JSON.parse(match[0]);
}

module.exports = { runPrompt, readSettings, extractJson };
