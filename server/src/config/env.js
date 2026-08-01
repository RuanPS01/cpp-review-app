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

module.exports = {
  DATA_DIR,
  SETTINGS_FILE,
  DEFAULT_SETTINGS,
  UPLOADS_DIR,
  STATS_DIR
};
