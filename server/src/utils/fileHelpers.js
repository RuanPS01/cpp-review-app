const fs = require('fs');
const path = require('path');
const { DATA_DIR } = require('../config/env');

function getStatementsPath(turma) {
  const turmaDir = path.join(DATA_DIR, `turma_${turma}`);
  if (!fs.existsSync(turmaDir)) fs.mkdirSync(turmaDir, { recursive: true });
  return path.join(turmaDir, 'statements.json');
}

function getTestCasesPath(turma) {
  const turmaDir = path.join(DATA_DIR, `turma_${turma}`);
  if (!fs.existsSync(turmaDir)) fs.mkdirSync(turmaDir, { recursive: true });
  return path.join(turmaDir, 'testcases.json');
}

function getWeightsPath(turma) {
  const turmaDir = path.join(DATA_DIR, `turma_${turma}`);
  if (!fs.existsSync(turmaDir)) fs.mkdirSync(turmaDir, { recursive: true });
  return path.join(turmaDir, 'weights.json');
}

function findCppInDir(dirPath) {
  if (!fs.existsSync(dirPath)) return null;
  const items = fs.readdirSync(dirPath);
  const cppFile = items.find(f => f.toLowerCase().endsWith('.cpp'));
  if (cppFile) return path.join(dirPath, cppFile);
  for (const item of items) {
    const itemPath = path.join(dirPath, item);
    if (fs.statSync(itemPath).isDirectory() && !item.endsWith('.ceg')) {
      const found = findCppInDir(itemPath);
      if (found) return found;
    }
  }
  return null;
}

// Utility to convert template tags to Regex
function parseFolderWithTemplate(folderName, template) {
  if (!template) return { name: folderName, id: null, email: null };

  try {
    const trimmedFolder = folderName.trim();
    let regexStr = template.trim();

    // Escape regex special characters except [] which we use for tags
    regexStr = regexStr.replace(/[-/\\^$*+?.()|{}]/g, '\\$&');

    // Replace all literal spaces in the template with a regex that matches 1 or more whitespace characters
    regexStr = regexStr.replace(/\s+/g, '\\s+');

    // Define replacements with unique group names for capturing tags
    // We only capture the first occurrence of each tag type to avoid duplicates
    let hasName = false, hasId = false, hasEmail = false;

    const parts = regexStr.split(/(\[[A-Z]+\])/);
    regexStr = parts.map(part => {
        if (part === '[NAME]') {
            if (!hasName) { hasName = true; return '(?<name>.+?)'; }
            return '.+?';
        }
        if (part === '[ID]') {
            if (!hasId) { hasId = true; return '(?<id>\\d+)'; }
            return '\\d+';
        }
        if (part === '[EMAIL]') {
            if (!hasEmail) { hasEmail = true; return '(?<email>\\S+)'; }
            return '\\S+';
        }
        if (part === '[IGNORE]') return '(?:\\S+)';
        return part;
    }).join('');

    const regex = new RegExp(`^${regexStr}$`, 'i');
    const match = trimmedFolder.match(regex);

    console.log(`[DEBUG] Parsing: "${trimmedFolder}"`);
    console.log(`[DEBUG] Using Regex: ${regex.source}`);

    if (match && match.groups) {
      const name = match.groups.name ? match.groups.name.trim() : trimmedFolder;
      const id = match.groups.id || null;
      const email = match.groups.email || null;
      console.log(`[DEBUG] SUCCESS: Name="${name}", ID="${id}", Email="${email}"`);
      return { name, id, email };
    } else {
      console.warn(`[DEBUG] MATCH FAILED! Falls back to raw folder name.`);
    }
  } catch (err) {
    console.error('[DEBUG] Regex Error:', err.message);
  }
  return { name: folderName, id: null, email: null };
}

module.exports = {
  getStatementsPath,
  getTestCasesPath,
  getWeightsPath,
  findCppInDir,
  parseFolderWithTemplate
};
