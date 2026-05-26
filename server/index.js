const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');
const http = require('http');
const { Server } = require('socket.io');
const pty = require('node-pty');
const { spawn } = require('child_process');
const multer = require('multer');
const AdmZip = require('adm-zip');
const iconv = require('iconv-lite');
const { Ollama } = require('ollama');
const { OpenAI } = require('openai');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const Anthropic = require('@anthropic-ai/sdk');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});
const port = 3001;

app.use(cors());
app.use(bodyParser.json({ limit: '50mb' }));

let DATA_DIR;
if (process.versions.electron) {
  const { app: electronApp } = require('electron');
  DATA_DIR = path.join(electronApp.getPath('userData'), 'data');
} else {
  DATA_DIR = path.join(__dirname, 'data');
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

const UPLOADS_DIR = path.join(DATA_DIR, 'uploads');
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

const upload = multer({ dest: UPLOADS_DIR });

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

app.post('/api/import', upload.single('file'), (req, res) => {
  const { turma, folderTemplate } = req.body;
  const zipPath = req.file.path;
  try {
    const zip = new AdmZip(zipPath);
    const extractPath = path.join(DATA_DIR, `turma_${turma}`);
    if (!fs.existsSync(extractPath)) fs.mkdirSync(extractPath, { recursive: true });
    zip.getEntries().forEach(entry => {
      let entryName = entry.entryName;
      try {
        const rawName = entry.rawEntryName;
        if (/[^\x00-\x7F]/.test(rawName.toString('utf8'))) entryName = iconv.decode(rawName, 'cp850');
      } catch (err) {}
      const fullPath = path.join(extractPath, entryName);
      if (entry.isDirectory) { if (!fs.existsSync(fullPath)) fs.mkdirSync(fullPath, { recursive: true }); }
      else {
        const dir = path.dirname(fullPath);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(fullPath, entry.getData());
      }
    });
    fs.unlinkSync(zipPath);
    const items = fs.readdirSync(extractPath);
    const questionFolders = items.filter(i => { const fp = path.join(extractPath, i); return fs.statSync(fp).isDirectory() && !i.startsWith('.') && i !== '__MACOSX'; });
    questionFolders.sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));
    const gradesFilePath = path.join(DATA_DIR, `grades_turma_${turma}.json`);
    const studentsMap = new Map();
    questionFolders.forEach((qFolder, idx) => {
      const qNum = idx + 1, qPath = path.join(extractPath, qFolder);
      const studentFolders = fs.readdirSync(qPath).filter(i => fs.statSync(path.join(qPath, i)).isDirectory() && !i.startsWith('.'));
      studentFolders.forEach(folder => {
        if (!studentsMap.has(folder)) {
          const { name, id, email } = parseFolderWithTemplate(folder, folderTemplate);
          studentsMap.set(folder, { folder_name: folder, name, id: id || '?', email, questions: {} });
        }
        const student = studentsMap.get(folder), hasPath = findCppInDir(path.join(qPath, folder));
        student.questions[`q${qNum}`] = { score: 0, comment: '', path: hasPath, label: qFolder, reviewed: !hasPath };
      });
    });
    const gradesData = Array.from(studentsMap.values());
    gradesData.forEach(s => { const qs = Object.values(s.questions).filter(q => q.path); s.reviewed = qs.length === 0 ? true : qs.every(q => q.reviewed); });
    fs.writeFileSync(gradesFilePath, JSON.stringify(gradesData, null, 2));
    res.json({ success: true, message: `Turma ${turma} imported.`, turma });
  } catch (err) { res.status(500).json({ error: 'Failed ZIP import' }); }
});

app.post('/api/import-moodle', (req, res) => {
  const { courseName, sectionName, questions, studentSubmissions } = req.body;
  const turma = `${courseName} - ${sectionName}`.replace(/[\\/:*?"<>|]/g, '_');
  const extractPath = path.join(DATA_DIR, `turma_${turma}`);
  try {
    if (!fs.existsSync(extractPath)) fs.mkdirSync(extractPath, { recursive: true });
    const studentsMap = new Map(), statements = {};
    questions.forEach((q, idx) => {
      const qNum = idx + 1, qFolderName = `Q${qNum} - ${q.name}`.replace(/[\\/:*?"<>|]/g, '_');
      const qPath = path.join(extractPath, qFolderName);
      if (!fs.existsSync(qPath)) fs.mkdirSync(qPath, { recursive: true });
      statements[`q${qNum}`] = q.description;
    });
    fs.writeFileSync(getStatementsPath(turma), JSON.stringify(statements, null, 2));
    studentSubmissions.forEach(sub => {
      const studentFolder = `${sub.email} ${sub.fullName} ${sub.userId}`.replace(/[\\/:*?"<>|]/g, '_');
      if (!studentsMap.has(studentFolder)) studentsMap.set(studentFolder, { folder_name: studentFolder, name: sub.fullName, id: sub.userId.toString(), email: sub.email, questions: {} });
      const student = studentsMap.get(studentFolder);
      const qIdx = questions.findIndex(q => q.cmid === sub.questionCmid);
      if (qIdx !== -1) {
        const qNum = qIdx + 1, qFolderName = `Q${qNum} - ${questions[qIdx].name}`.replace(/[\\/:*?"<>|]/g, '_');
        const studentPath = path.join(extractPath, qFolderName, studentFolder);
        if (!fs.existsSync(studentPath)) fs.mkdirSync(studentPath, { recursive: true });
        let mainCppPath = null;
        if (sub.files) sub.files.forEach(file => {
          const filePath = path.join(studentPath, file.name);
          fs.writeFileSync(filePath, file.encoding === 1 ? Buffer.from(file.data, 'base64') : file.data);
          if (file.name.toLowerCase().endsWith('.cpp')) mainCppPath = filePath;
        });
        student.questions[`q${qNum}`] = { score: sub.lastResult ? parseFloat(sub.lastResult.grade) || 0 : 0, comment: sub.lastResult ? sub.lastResult.evaluation : '', path: mainCppPath, label: qFolderName, reviewed: !mainCppPath };
      }
    });
    const gradesData = Array.from(studentsMap.values());
    gradesData.forEach(s => { const qs = Object.values(s.questions).filter(q => q.path); s.reviewed = qs.length === 0 ? true : qs.every(q => q.reviewed); });
    fs.writeFileSync(path.join(DATA_DIR, `grades_turma_${turma}.json`), JSON.stringify(gradesData, null, 2));
    res.json({ success: true, message: `Moodle import successful.`, turma });
  } catch (err) { res.status(500).json({ error: 'Failed Moodle import' }); }
});

app.post('/api/import-moodle-cookies', async (req, res) => {
  const { courseName, sectionName, questions, cookie, baseUrl, userAgent, folderTemplate } = req.body;
  const turma = `${courseName} - ${sectionName}`.replace(/[\\/:*?"<>|]/g, '_');
  const extractPath = path.join(DATA_DIR, `turma_${turma}`);
  
  let currentCookie = String(cookie || '');
  const UA = userAgent || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

  const updateCookies = (setCookieHeaders) => {
    if (!setCookieHeaders || !currentCookie) return;
    try {
      const cookiesMap = currentCookie.split('; ').reduce((acc, c) => {
        const parts = c.split('=');
        if (parts.length >= 2) acc[parts[0].trim()] = parts.slice(1).join('=').trim();
        return acc;
      }, {});
      setCookieHeaders.forEach(header => {
        const parts = header.split(';')[0].split('=');
        if (parts.length >= 2) cookiesMap[parts[0].trim()] = parts.slice(1).join('=').trim();
      });
      currentCookie = Object.entries(cookiesMap).map(([k, v]) => `${k}=${v}`).join('; ');
    } catch (e) {}
  };

  const smartFetch = async (url, referer = baseUrl) => {
    const headers = {
      'Cookie': currentCookie,
      'User-Agent': UA,
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
      'Accept-Language': 'pt-BR,pt;q=0.9,en;q=0.8,en-GB;q=0.7,en-US;q=0.6',
      'Referer': referer,
      'Connection': 'keep-alive',
      'Upgrade-Insecure-Requests': '1',
      'Sec-Fetch-Dest': 'document',
      'Sec-Fetch-Mode': 'navigate',
      'Sec-Fetch-Site': 'same-origin',
      'Sec-Fetch-User': '?1'
    };
    const response = await fetch(url, { headers, redirect: 'manual' });
    const setCookies = response.headers.getSetCookie ? response.headers.getSetCookie() : response.headers.get('set-cookie')?.split(',');
    updateCookies(setCookies);
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get('location');
      if (location) {
        const nextUrl = new URL(location, url).href;
        if (nextUrl.includes('login/index.php')) throw new Error('Session invalid. Redirected to login.');
        return await smartFetch(nextUrl, url);
      }
    }
    return response;
  };

  try {
    if (!fs.existsSync(extractPath)) fs.mkdirSync(extractPath, { recursive: true });
    const studentsMap = new Map(), statements = {}, testCases = {};
    await smartFetch(baseUrl);
    for (let i = 0; i < questions.length; i++) {
      const q = questions[i], qNum = i + 1;
      const qFolderName = `Q${qNum} - ${q.name}`.replace(/[\\/:*?"<>|]/g, '_');
      const qPath = path.join(extractPath, qFolderName);
      if (!fs.existsSync(qPath)) fs.mkdirSync(qPath, { recursive: true });
      const viewUrl = `${baseUrl}/mod/vpl/view.php?id=${q.id}`;
      const listUrl = `${baseUrl}/mod/vpl/views/submissionslist.php?id=${q.id}&showgrades=0&group=-1&tilast&tifirst&tperpage=5000&thiddenfields`;
      const downloadUrl = `${baseUrl}/mod/vpl/views/downloadallsubmissions.php?id=${q.id}`;
      
      const viewRes = await smartFetch(viewUrl);
      const viewHtml = await viewRes.text();
      
      // Capturar o enunciado HTML do Moodle VPL
      let introContent = null;
      const vplIntroMatch = viewHtml.match(/<div id="vpl_intro"[^>]*>([\s\S]*?)<\/div>(?:\s*<div class="clearer"><\/div>|$)/);
      if (vplIntroMatch) {
        introContent = vplIntroMatch[1].trim();
      } else {
        const generalBoxMatch = viewHtml.match(/<div class="box py-3 generalbox">[\s\S]*?<div class="no-overflow">([\s\S]*?)<\/div>\s*<\/div>/);
        if (generalBoxMatch) introContent = generalBoxMatch[1].trim();
      }
      if (introContent) statements[`q${qNum}`] = introContent;

      // Capturar casos de teste automáticos do VPL (pre#codefileid1)
      const casesMatch = viewHtml.match(/<pre[^>]*id=['"]codefileid1['"][^>]*>([\s\S]*?)<\/pre>/i);
      if (casesMatch) {
        console.log(`[DEBUG] Found test cases tag for Q${qNum}`);
        const rawCases = casesMatch[1].trim();
        const parsed = [];
        // Split por "Case =" considerando que pode ou não haver quebra de linha antes
        const blocks = rawCases.split(/(?=Case\s*=)/i).filter(b => b.trim());
        
        console.log(`[DEBUG] Found ${blocks.length} test case blocks`);

        for (const block of blocks) {
          const tc = { name: '', input: '', output: '', gradeReduction: '' };
          const lines = block.split('\n');
          let currentField = null;
          let buffer = [];

          const flush = () => {
            if (currentField && buffer.length > 0) {
              let val = buffer.join('\n').trim();
              if (currentField === 'output' && val.startsWith('"') && val.endsWith('"')) {
                val = val.slice(1, -1);
              }
              tc[currentField] = val;
              buffer = [];
            }
          };

          for (const line of lines) {
            const trimmedLine = line.trim();
            const lowerLine = trimmedLine.toLowerCase();

            if (lowerLine.startsWith('case')) {
              flush();
              tc.name = trimmedLine.split('=')[1]?.trim() || '';
              currentField = null;
            } else if (lowerLine.startsWith('input')) {
              flush();
              currentField = 'input';
              const val = trimmedLine.split('=')[1]?.trim();
              if (val !== undefined && val !== '') buffer.push(val);
            } else if (lowerLine.startsWith('output')) {
              flush();
              currentField = 'output';
              const val = trimmedLine.split('=')[1]?.trim();
              if (val !== undefined && val !== '') buffer.push(val);
            } else if (lowerLine.startsWith('grade reduction')) {
              flush();
              tc.gradeReduction = trimmedLine.split('=')[1]?.trim() || '';
              currentField = null;
            } else if (currentField) {
              buffer.push(line);
            }
          }
          flush();
          if (tc.input || tc.output) parsed.push(tc);
        }
        testCases[`q${qNum}`] = parsed;
        console.log(`[DEBUG] Successfully parsed ${parsed.length} test cases for Q${qNum}`);
      } else {
        console.warn(`[DEBUG] No test cases tag (codefileid1) found for Q${qNum}`);
      }

      await smartFetch(listUrl, viewUrl);
      const response = await smartFetch(downloadUrl, listUrl);
      if (!response.ok) throw new Error(`Download failed: ${response.statusText}`);
      const buffer = Buffer.from(await response.arrayBuffer());
      if (buffer.length < 4 || buffer[0] !== 0x50 || buffer[1] !== 0x4B) throw new Error(`Moodle delivered HTML instead of ZIP.`);
      const zip = new AdmZip(buffer);
      zip.getEntries().forEach(entry => {
        if (!entry.isDirectory) {
          const parts = entry.entryName.split('/');
          if (parts.length < 2) return;
          const vplStudentFolder = parts[0], fileName = parts[parts.length - 1];
          const studentFolder = vplStudentFolder.replace(/[\\/:*?"<>|]/g, '_');
          const studentPath = path.join(qPath, studentFolder);
          if (!fs.existsSync(studentPath)) fs.mkdirSync(studentPath, { recursive: true });
          fs.writeFileSync(path.join(studentPath, fileName), entry.getData());
          if (!studentsMap.has(studentFolder)) {
            const { name, id, email } = parseFolderWithTemplate(studentFolder, folderTemplate);
            studentsMap.set(studentFolder, { folder_name: studentFolder, name, id: id || '?', email, questions: {} });
          }
          const student = studentsMap.get(studentFolder);
          if (fileName.toLowerCase().endsWith('.cpp')) student.questions[`q${qNum}`] = { score: 0, comment: '', path: path.join(studentPath, fileName), label: qFolderName, reviewed: false };
        }
      });
    }
    fs.writeFileSync(getStatementsPath(turma), JSON.stringify(statements, null, 2));
    fs.writeFileSync(getTestCasesPath(turma), JSON.stringify(testCases, null, 2));
    const gradesData = Array.from(studentsMap.values());
    gradesData.forEach(s => { const qs = Object.values(s.questions).filter(q => q.path); s.reviewed = qs.length === 0 ? true : qs.every(q => q.reviewed); });
    fs.writeFileSync(path.join(DATA_DIR, `grades_turma_${turma}.json`), JSON.stringify(gradesData, null, 2));
    res.json({ success: true, message: `Imported via mirroring.`, turma });
  } catch (err) { res.status(500).json({ error: 'Failed import: ' + err.message }); }
});

app.post('/api/process-vpl-zip', async (req, res) => {
  const { courseName, sectionName, questionId, questionName, zipData, statement, folderTemplate } = req.body;
  const turma = `${courseName} - ${sectionName}`.replace(/[\\/:*?"<>|]/g, '_');
  const extractPath = path.join(DATA_DIR, `turma_${turma}`);
  const qFolderName = `Q - ${questionName}`.replace(/[\\/:*?"<>|]/g, '_');
  const qPath = path.join(extractPath, qFolderName);
  try {
    if (!fs.existsSync(qPath)) fs.mkdirSync(qPath, { recursive: true });
    const buffer = Buffer.from(zipData, 'base64');
    const zip = new AdmZip(buffer);
    const gradesFilePath = path.join(DATA_DIR, `grades_turma_${turma}.json`);
    let gradesData = fs.existsSync(gradesFilePath) ? JSON.parse(fs.readFileSync(gradesFilePath, 'utf8')) : [];
    const studentsMap = new Map(gradesData.map(s => [s.folder_name, s]));
    zip.getEntries().forEach(entry => {
      if (!entry.isDirectory) {
        const parts = entry.entryName.split('/');
        if (parts.length < 2) return;
        const vplStudentFolder = parts[0], fileName = parts[parts.length - 1];
        const studentFolder = vplStudentFolder.replace(/[\\/:*?"<>|]/g, '_');
        const studentPath = path.join(qPath, studentFolder);
        if (!fs.existsSync(studentPath)) fs.mkdirSync(studentPath, { recursive: true });
        fs.writeFileSync(path.join(studentPath, fileName), entry.getData());
        if (!studentsMap.has(studentFolder)) {
          const { name, id, email } = parseFolderWithTemplate(studentFolder, folderTemplate);
          studentsMap.set(studentFolder, { folder_name: studentFolder, name, id: id || '?', email, questions: {} });
        }
        const student = studentsMap.get(studentFolder);
        if (fileName.toLowerCase().endsWith('.cpp')) {
           const qKey = `q_${questionId}`; 
           student.questions[qKey] = { score: 0, comment: '', path: path.join(studentPath, fileName), label: qFolderName, reviewed: false };
        }
      }
    });
    const sp = getStatementsPath(turma);
    const statements = fs.existsSync(sp) ? JSON.parse(fs.readFileSync(sp, 'utf8')) : {};
    statements[`q_${questionId}`] = statement || "";
    fs.writeFileSync(sp, JSON.stringify(statements, null, 2));
    const finalGrades = Array.from(studentsMap.values());
    finalGrades.forEach(s => { const qs = Object.values(s.questions).filter(q => q.path); s.reviewed = qs.length === 0 ? true : qs.every(q => q.reviewed); });
    fs.writeFileSync(gradesFilePath, JSON.stringify(finalGrades, null, 2));
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/students', (req, res) => {
  const allStudents = [];
  const files = fs.readdirSync(DATA_DIR).filter(f => f.startsWith('grades_turma_') && f.endsWith('.json'));
  files.forEach(file => {
    const turma = file.replace('grades_turma_', '').replace('.json', '');
    const data = JSON.parse(fs.readFileSync(path.join(DATA_DIR, file), 'utf8'));
    data.forEach(s => allStudents.push({ ...s, turma }));
  });
  res.json(allStudents);
});

app.get('/api/code', (req, res) => {
  const filePath = req.query.path;
  if (!filePath || !filePath.includes(DATA_DIR)) return res.status(400).send('Invalid path');
  if (fs.existsSync(filePath)) res.send(fs.readFileSync(filePath, 'utf8'));
  else res.status(404).send('File not found');
});

app.post('/api/update-student', (req, res) => {
  const { turma, studentId, name, id, reviewed } = req.body;
  const filePath = path.join(DATA_DIR, `grades_turma_${turma}.json`);
  if (!fs.existsSync(filePath)) return res.status(404).send('Grades not found');
  let data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  const idx = data.findIndex(item => item.folder_name === studentId);
  if (idx !== -1) {
    if (name !== undefined) data[idx].name = name;
    if (id !== undefined) data[idx].id = id;
    if (reviewed !== undefined) data[idx].reviewed = reviewed;
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
    res.json({ success: true });
  } else res.status(404).send('Student not found');
});

app.post('/api/update-grade', (req, res) => {
  const { turma, studentId, questionNum, score, comment, reviewed } = req.body;
  const filePath = path.join(DATA_DIR, `grades_turma_${turma}.json`);
  if (!fs.existsSync(filePath)) return res.status(404).send('Grades not found');
  let data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  const idx = data.findIndex(item => item.folder_name === studentId);
  if (idx !== -1) {
    const qKey = questionNum.toString().startsWith('q') ? questionNum : `q${questionNum}`;
    data[idx].questions[qKey] = { ...data[idx].questions[qKey], score, comment, reviewed: reviewed !== undefined ? reviewed : true };
    const qsWithPath = Object.values(data[idx].questions).filter(q => q.path);
    data[idx].reviewed = qsWithPath.length > 0 && qsWithPath.every(q => q.reviewed);
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
    res.json({ success: true, studentReviewed: data[idx].reviewed });
  } else res.status(404).send('Student not found');
});

app.get('/api/export-grades/:turma', (req, res) => {
  const filePath = path.join(DATA_DIR, `grades_turma_${req.params.turma}.json`);
  if (fs.existsSync(filePath)) res.json(JSON.parse(fs.readFileSync(filePath, 'utf8')));
  else res.status(404).send('Class not found');
});

app.post('/api/import-grades', (req, res) => {
  const { turma, grades } = req.body;
  const filePath = path.join(DATA_DIR, `grades_turma_${turma}.json`);
  if (!fs.existsSync(filePath)) return res.status(404).send('Class not found');
  try {
    let existingData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    const gradesMap = new Map();
    grades.forEach(g => { if (g.folder_name) gradesMap.set(`folder:${g.folder_name}`, g); if (g.id) gradesMap.set(`id:${g.id}`, g); });
    const updated = existingData.map(s => {
      const imp = gradesMap.get(`folder:${s.folder_name}`) || gradesMap.get(`id:${s.id}`);
      if (imp && imp.questions) {
        const merged = { ...s.questions };
        Object.keys(imp.questions).forEach(k => { if (merged[k]) merged[k] = { ...merged[k], score: imp.questions[k].score ?? merged[k].score, comment: imp.questions[k].comment ?? merged[k].comment }; });
        return { ...s, questions: merged };
      }
      return s;
    });
    fs.writeFileSync(filePath, JSON.stringify(updated, null, 2));
    res.json({ success: true, message: `Updated ${grades.length} records.` });
  } catch (err) { res.status(500).json({ error: 'Failed to process grades' }); }
});

app.delete('/api/turma/:name', (req, res) => {
  const name = req.params.name;
  const gp = path.join(DATA_DIR, `grades_turma_${name}.json`), sp = getStatementsPath(name), td = path.join(DATA_DIR, `turma_${name}`);
  try {
    if (fs.existsSync(gp)) fs.unlinkSync(gp);
    if (fs.existsSync(sp)) fs.unlinkSync(sp);
    if (fs.existsSync(td)) fs.rmSync(td, { recursive: true, force: true });
    res.json({ success: true, message: `Turma ${name} deleted.` });
  } catch (err) { res.status(500).json({ error: 'Failed to delete data' }); }
});

app.get('/api/settings', (req, res) => {
  if (fs.existsSync(SETTINGS_FILE)) res.json(JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf8')));
  else res.json(DEFAULT_SETTINGS);
});

app.post('/api/settings', (req, res) => {
  fs.writeFileSync(SETTINGS_FILE, JSON.stringify(req.body, null, 2));
  res.json({ success: true });
});

function getWeightsPath(turma) {
  const turmaDir = path.join(DATA_DIR, `turma_${turma}`);
  if (!fs.existsSync(turmaDir)) fs.mkdirSync(turmaDir, { recursive: true });
  return path.join(turmaDir, 'weights.json');
}

app.get('/api/weights', (req, res) => {
  const { turma } = req.query;
  const p = getWeightsPath(turma);
  if (fs.existsSync(p)) {
    res.json(JSON.parse(fs.readFileSync(p, 'utf8')));
  } else {
    res.json({});
  }
});

app.post('/api/weights', (req, res) => {
  const { turma, weights } = req.body;
  fs.writeFileSync(getWeightsPath(turma), JSON.stringify(weights, null, 2));
  res.json({ success: true });
});

app.get('/api/statements', (req, res) => {
  const fp = getStatementsPath(req.query.turma);
  if (fs.existsSync(fp)) res.json(JSON.parse(fs.readFileSync(fp, 'utf8')));
  else res.json({});
});

app.post('/api/statements', (req, res) => {
  const fp = getStatementsPath(req.body.turma);
  fs.writeFileSync(fp, JSON.stringify(req.body.statements, null, 2));
  res.json({ success: true });
});

app.get('/api/testcases', (req, res) => {
  const fp = getTestCasesPath(req.query.turma);
  if (fs.existsSync(fp)) res.json(JSON.parse(fs.readFileSync(fp, 'utf8')));
  else res.json({});
});

app.post('/api/run-tests', async (req, res) => {
  const { turma, studentId, questionNum, filePath, code } = req.body;
  if (!filePath || (!code && !fs.existsSync(filePath))) return res.status(400).json({ error: 'File not found' });

  const tp = getTestCasesPath(turma);
  const allCases = fs.existsSync(tp) ? JSON.parse(fs.readFileSync(tp, 'utf8')) : {};
  const cases = allCases[questionNum.toString().startsWith('q') ? questionNum : `q${questionNum}`];
  if (!cases || !cases.length) return res.status(400).json({ error: 'No test cases found' });

  const dir = path.dirname(filePath), originalFileName = path.basename(filePath);
  let fileNameToCompile = originalFileName, isTemporary = false;
  
  if (code) {
    fileNameToCompile = `${path.basename(originalFileName, path.extname(originalFileName))}_test_suite${path.extname(originalFileName)}`;
    fs.writeFileSync(path.join(dir, fileNameToCompile), code, 'utf8');
    isTemporary = true;
  }

  const exeName = `${path.basename(fileNameToCompile, '.cpp')}_run.exe`, exePath = path.join(dir, exeName);

  try {
    // Compile
    await new Promise((resolve, reject) => {
      const compile = spawn('g++', [fileNameToCompile, '-o', exeName], { cwd: dir, shell: true });
      let err = '';
      compile.stderr.on('data', d => err += d.toString());
      compile.on('close', c => {
        if (isTemporary) {
          try { fs.unlinkSync(path.join(dir, fileNameToCompile)); } catch(e) {}
        }
        c === 0 ? resolve() : reject(new Error(err));
      });
    });

    const results = [];
    for (const tc of cases) {
      const start = Date.now();
      const output = await new Promise((resolve) => {
        const child = spawn(process.platform === 'win32' ? exeName : `./${exeName}`, { cwd: dir, shell: true });
        let out = '', err = '';
        const timer = setTimeout(() => { child.kill(); resolve({ error: 'Timeout (2s)' }); }, 2000);
        
        child.stdin.write(tc.input + '\n');
        child.stdin.end();

        child.stdout.on('data', d => out += d.toString());
        child.stderr.on('data', d => err += d.toString());
        child.on('close', () => {
          clearTimeout(timer);
          resolve({ out: out.trim(), err: err.trim() });
        });
      });

      const duration = Date.now() - start;
      const passed = output.out === tc.output.trim();
      results.push({
        name: tc.name,
        input: tc.input,
        expected: tc.output,
        actual: output.out || output.error || output.err,
        passed,
        duration
      });
    }

    try { fs.unlinkSync(exePath); } catch(e) {}
    res.json({ success: true, results });
  } catch (err) {
    res.status(500).json({ error: 'Compilation failed', details: err.message });
  }
});

app.post('/api/analyze', async (req, res) => {
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
});

io.on('connection', (socket) => {
  let ptyProcess = null;
  socket.on('run-code', ({ filePath, codeOverride }) => {
    if (!filePath || (!codeOverride && !fs.existsSync(filePath))) return;
    const dir = path.dirname(filePath), originalFileName = path.basename(filePath);
    let fileNameToCompile = originalFileName, isTemporary = false;
    if (codeOverride) {
      fileNameToCompile = `${path.basename(originalFileName, path.extname(originalFileName))}_test${path.extname(originalFileName)}`;
      fs.writeFileSync(path.join(dir, fileNameToCompile), codeOverride, 'utf8');
      isTemporary = true;
    }
    const exeName = fileNameToCompile.replace('.cpp', '.exe'), exePath = path.join(dir, exeName);
    socket.emit('terminal-data', `\r\nCompiling ${fileNameToCompile}...\r\n`);
    const compile = spawn('g++', [fileNameToCompile, '-o', exeName], { cwd: dir, shell: true });
    let ce = '';
    compile.stderr.on('data', d => ce += d.toString());
    compile.on('close', c => {
      if (c !== 0) {
        socket.emit('terminal-data', `\r\nFailed:\r\n${ce.replace(/\n/g, '\r\n')}`);
        if (isTemporary) try { fs.unlinkSync(path.join(dir, fileNameToCompile)); } catch(e) {}
        return;
      }
      socket.emit('terminal-data', `\x1b[32mSuccess. Running...\x1b[0m\r\n\r\n`);
      try {
        ptyProcess = pty.spawn(process.platform === 'win32' ? 'cmd.exe' : 'bash', [], { name: 'xterm-color', cols: 80, rows: 24, cwd: dir, env: process.env });
        ptyProcess.onData(d => socket.emit('terminal-data', d));
        setTimeout(() => { if (ptyProcess) ptyProcess.write(process.platform === 'win32' ? `${exeName}\r\n` : `./${exeName}\n`); }, 500);
        ptyProcess.onExit(({ exitCode }) => {
          socket.emit('terminal-data', `\r\nExited with code ${exitCode}\r\n`);
          ptyProcess = null;
          if (isTemporary) setTimeout(() => { try { fs.unlinkSync(path.join(dir, fileNameToCompile)); } catch(e) {} try { fs.unlinkSync(exePath); } catch(e) {} }, 1000);
        });
      } catch (err) {}
    });
  });
  socket.on('terminal-input', d => { if (ptyProcess) ptyProcess.write(d); });
  socket.on('terminal-resize', ({ cols, rows }) => { if (ptyProcess && cols && rows) try { ptyProcess.resize(cols, rows); } catch (e) {} });
  socket.on('disconnect', () => { if (ptyProcess) try { ptyProcess.kill(); } catch (e) {} });
});

server.listen(port, () => console.log(`Server running at http://localhost:${port}`));
