import React, { useState, useEffect } from 'react';
import { Settings, CheckCircle2, Terminal, Info } from 'lucide-react';
import type { AISettings } from '../types';
import { api } from '../services/api';
import toast from 'react-hot-toast';
import pkg from '../../package.json';

const RECOMMENDED_MODELS: Record<string, string[]> = {
  openai: ['gpt-5.4-mini', 'gpt-5.4', 'gpt-5.5', 'gpt-4o', 'gpt-4-turbo'],
  gemini: ['gemini-flash-latest', 'gemini-2.5-flash', 'gemini-3-flash-preview', 'gemini-3.1-pro-preview', 'gemini-1.5-pro', 'gemini-1.5-flash-lite'],
  claude: ['claude-3-5-sonnet-20240620', 'claude-haiku-4-5-20251001', 'claude-sonnet-4-6', 'claude-opus-4-7'],
  ollama: ['llama3.3', 'qwen3.6', 'deepseek-v4-flash', 'qwen3-coder-next', 'mistral-medium-3.5', 'gemma4', 'kimi-k2.6'],
};

interface SettingsPageProps {
  aiSettings: AISettings;
  setAiSettings: (settings: AISettings) => void;
  setShowOllamaHelp: (show: boolean) => void;
  t: any;
}

const SettingsPage: React.FC<SettingsPageProps> = ({ aiSettings, setAiSettings, setShowOllamaHelp, t }) => {
  const [isCustomModel, setIsCustomModel] = useState(false);
  const [isCustomOllama, setIsCustomOllama] = useState(false);

  useEffect(() => {
    if (aiSettings.provider !== 'ollama') {
      const recommendations = RECOMMENDED_MODELS[aiSettings.provider] || [];
      const isPredefined = recommendations.includes(aiSettings.cloudModel);
      setIsCustomModel(!isPredefined && aiSettings.cloudModel !== '');
    }
    if (aiSettings.provider === 'ollama') {
      const recommendations = RECOMMENDED_MODELS.ollama;
      const isPredefined = recommendations.includes(aiSettings.ollamaModel);
      setIsCustomOllama(!isPredefined && aiSettings.ollamaModel !== '');
    }
  }, [aiSettings.provider, aiSettings.cloudModel, aiSettings.ollamaModel]);

  const saveAISettings = async (settings: AISettings) => {
    try {
      await api.saveSettings(settings);
      setAiSettings(settings);
      toast.success(t.settingsSaved);
    } catch {
      toast.error('Failed to save settings');
    }
  };

  return (
    <div className="max-w-3xl mx-auto mt-10 bg-panel p-8 rounded-xl shadow-2xl border border-border-main">
      <h2 className="text-2xl font-bold mb-8 flex items-center gap-3 text-text-bright">
          <Settings className="text-accent drop-shadow-[0_0_5px_var(--accent-glow)]" /> {t.aiConfig}
      </h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="space-y-6">
              <div>
                  <label className="block text-xs font-bold uppercase tracking-widest text-text-dim mb-3">{t.aiProvider}</label>
                  <div className="grid grid-cols-2 gap-2">
                      {['ollama', 'openai', 'gemini', 'claude'].map(p => (
                          <button
                              key={p}
                              onClick={() => {
                                  const newProvider = p as any;
                                  const defaultModel = newProvider === 'ollama' ? 'llama3.3' : RECOMMENDED_MODELS[newProvider][0];
                                  setAiSettings({ 
                                      ...aiSettings, 
                                      provider: newProvider,
                                      cloudModel: newProvider === 'ollama' ? aiSettings.ollamaModel : defaultModel
                                  });
                                  setIsCustomModel(false);
                                  setIsCustomOllama(false);
                              }}
                              className={`py-2 rounded-lg border text-xs font-bold uppercase tracking-wider transition-all ${aiSettings.provider === p ? 'bg-accent text-black border-accent shadow-[0_0_10px_var(--accent-glow)]' : 'bg-input text-text-dim border-border-main hover:border-accent/50'}`}
                          >
                              {p}
                          </button>
                      ))}
                  </div>
              </div>

              {aiSettings.provider === 'ollama' ? (
                  <div className="space-y-4">
                      <div>
                          <div className="flex justify-between items-end mb-2">
                              <label className="block text-xs font-bold uppercase tracking-widest text-text-dim">{t.ollamaModel}</label>
                              <button 
                                  onClick={() => setShowOllamaHelp(true)}
                                  className="text-[10px] font-bold text-accent hover:text-accent/80 underline flex items-center gap-1"
                              >
                                  <Terminal size={10} /> {t.howToConfigure}
                              </button>
                          </div>
                          <select 
                              value={isCustomOllama ? 'custom' : aiSettings.ollamaModel}
                              onChange={(e) => {
                                  const val = e.target.value;
                                  if (val === 'custom') {
                                      setIsCustomOllama(true);
                                  } else {
                                      setIsCustomOllama(false);
                                      setAiSettings({ ...aiSettings, ollamaModel: val });
                                  }
                              }}
                              className="w-full bg-input border border-border-main rounded-lg p-3 text-accent font-mono text-sm focus:outline-none focus:border-accent mb-2 transition-colors"
                          >
                              <option value="" disabled>Select a local model...</option>
                              {RECOMMENDED_MODELS.ollama.map(m => (
                                  <option key={m} value={m}>{m}</option>
                              ))}
                              <option value="custom">{t.customModelName}</option>
                          </select>
                          
                          {isCustomOllama && (
                              <input 
                                  type="text"
                                  value={aiSettings.ollamaModel}
                                  onChange={(e) => setAiSettings({ ...aiSettings, ollamaModel: e.target.value })}
                                  className="w-full bg-input border border-accent/50 rounded-lg p-3 text-accent font-mono text-sm focus:outline-none focus:border-accent animate-in slide-in-from-top-1 duration-200 transition-colors"
                                  placeholder="Enter model name (e.g. mistral:latest)"
                                  autoFocus
                              />
                          )}
                      </div>
                  </div>
              ) : (
                  <>
                      <div>
                          <label className="block text-xs font-bold uppercase tracking-widest text-text-dim mb-2">{t.cloudModel}</label>
                          <select 
                              value={isCustomModel ? 'custom' : aiSettings.cloudModel}
                              onChange={(e) => {
                                  const val = e.target.value;
                                  if (val === 'custom') {
                                      setIsCustomModel(true);
                                  } else {
                                      setIsCustomModel(false);
                                      setAiSettings({ ...aiSettings, cloudModel: val });
                                  }
                              }}
                              className="w-full bg-input border border-border-main rounded-lg p-3 text-accent font-mono text-sm focus:outline-none focus:border-accent mb-2 transition-colors"
                          >
                              <option value="" disabled>Select a model...</option>
                              {(RECOMMENDED_MODELS[aiSettings.provider] || []).map(m => (
                                  <option key={m} value={m}>{m}</option>
                              ))}
                              <option value="custom">{t.customModelName}</option>
                          </select>
                          
                          {isCustomModel && (
                              <input 
                                  type="text"
                                  value={aiSettings.cloudModel}
                                  onChange={(e) => setAiSettings({ ...aiSettings, cloudModel: e.target.value })}
                                  className="w-full bg-input border border-accent/50 rounded-lg p-3 text-accent font-mono text-sm focus:outline-none focus:border-accent animate-in slide-in-from-top-1 duration-200 transition-colors"
                                  placeholder="Enter custom model ID..."
                                  autoFocus
                              />
                          )}
                      </div>
                      <div>
                          <label className="block text-xs font-bold uppercase tracking-widest text-text-dim mb-2">{t.apiKey}</label>
                          <input 
                              type="password"
                              value={aiSettings.cloudKey}
                              onChange={(e) => setAiSettings({ ...aiSettings, cloudKey: e.target.value })}
                              className="w-full bg-input border border-border-main rounded-lg p-3 text-text-main text-sm focus:outline-none focus:border-accent transition-colors"
                              placeholder="••••••••••••••••"
                          />
                      </div>
                  </>
              )}
          </div>

          <div className="flex flex-col h-full">
              <label className="block text-xs font-bold uppercase tracking-widest text-text-dim mb-3">{t.globalCriteria}</label>
              <textarea 
                  value={aiSettings.evaluationCriteria}
                  onChange={(e) => setAiSettings({ ...aiSettings, evaluationCriteria: e.target.value })}
                  className="flex-1 w-full bg-input border border-border-main rounded-lg p-4 text-text-main text-sm focus:outline-none focus:border-accent resize-none min-h-[250px] transition-colors"
                  placeholder="Define how the AI should grade the code..."
              />
          </div>
      </div>
      <button 
          onClick={() => saveAISettings(aiSettings)}
          className="mt-8 w-full bg-accent hover:bg-accent/80 text-black py-4 rounded-lg font-bold flex items-center justify-center gap-3 transition-all active:scale-[0.98] shadow-lg shadow-accent/10"
      >
          <CheckCircle2 size={20} /> {t.saveSettings}
      </button>

      <div className="mt-8 pt-6 border-t border-border-main flex items-center justify-between opacity-50">
          <div className="flex items-center gap-2 text-text-dim">
              <Info size={14} />
              <span className="text-[10px] font-bold uppercase tracking-widest">{t.appVersion || 'Project Version'}</span>
          </div>
          <span className="text-xs font-mono text-accent">v{pkg.version}</span>
      </div>
    </div>
  );
};

export default SettingsPage;
