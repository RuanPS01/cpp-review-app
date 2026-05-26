const fs = require('fs');
const path = require('path');
const AdmZip = require('adm-zip');
const iconv = require('iconv-lite');
const { DATA_DIR } = require('../../config/env');
const { parseFolderWithTemplate, findCppInDir, getStatementsPath, getTestCasesPath } = require('../../utils/fileHelpers');

exports.importZip = (req, res) => {
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
};

exports.importMoodle = (req, res) => {
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
};

exports.importMoodleCookies = async (req, res) => {
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
      
      let introContent = null;
      const vplIntroMatch = viewHtml.match(/<div id="vpl_intro"[^>]*>([\s\S]*?)<\/div>(?:\s*<div class="clearer"><\/div>|$)/);
      if (vplIntroMatch) {
        introContent = vplIntroMatch[1].trim();
      } else {
        const generalBoxMatch = viewHtml.match(/<div class="box py-3 generalbox">[\s\S]*?<div class="no-overflow">([\s\S]*?)<\/div>\s*<\/div>/);
        if (generalBoxMatch) introContent = generalBoxMatch[1].trim();
      }
      if (introContent) statements[`q${qNum}`] = introContent;

      const casesMatch = viewHtml.match(/<pre[^>]*id=['"]codefileid1['"][^>]*>([\s\S]*?)<\/pre>/i);
      if (casesMatch) {
        const rawCases = casesMatch[1].trim();
        const parsed = [];
        const blocks = rawCases.split(/(?=Case\s*=)/i).filter(b => b.trim());
        for (const block of blocks) {
          const tc = { name: '', input: '', output: '', gradeReduction: '' };
          const lines = block.split('\n');
          let currentField = null;
          let buffer = [];
          const flush = () => {
            if (currentField && buffer.length > 0) {
              let val = buffer.join('\n').trim();
              if (currentField === 'output' && val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
              tc[currentField] = val;
              buffer = [];
            }
          };
          for (const line of lines) {
            const trimmedLine = line.trim(), lowerLine = trimmedLine.toLowerCase();
            if (lowerLine.startsWith('case')) { flush(); tc.name = trimmedLine.split('=')[1]?.trim() || ''; currentField = null; }
            else if (lowerLine.startsWith('input')) { flush(); currentField = 'input'; const val = trimmedLine.split('=')[1]?.trim(); if (val !== undefined && val !== '') buffer.push(val); }
            else if (lowerLine.startsWith('output')) { flush(); currentField = 'output'; const val = trimmedLine.split('=')[1]?.trim(); if (val !== undefined && val !== '') buffer.push(val); }
            else if (lowerLine.startsWith('grade reduction')) { flush(); tc.gradeReduction = trimmedLine.split('=')[1]?.trim() || ''; currentField = null; }
            else if (currentField) { buffer.push(line); }
          }
          flush();
          if (tc.input || tc.output) parsed.push(tc);
        }
        testCases[`q${qNum}`] = parsed;
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
};

exports.processVplZip = async (req, res) => {
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
};
