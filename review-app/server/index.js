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
app.use(bodyParser.json());

const DATA_DIR = path.join(__dirname, 'data');
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR);
}

const upload = multer({ dest: 'uploads/' });

// Utility to convert template tags to Regex
function parseFolderWithTemplate(folderName, template) {
  let nameCaptured = false;
  let idCaptured = false;
  let emailCaptured = false;

  // Escaping special regex characters in the template except for our tags
  let regexStr = template.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  
  // Replace tags one by one to handle duplicates
  regexStr = regexStr.replace(/\\\[EMAIL\\\]/g, () => {
    if (!emailCaptured) { emailCaptured = true; return '(?<email>\\S+@\\S+)'; }
    return '(?:\\S+@\\S+)';
  });
  
  regexStr = regexStr.replace(/\\\[NAME\\\]/g, () => {
    if (!nameCaptured) { nameCaptured = true; return '(?<name>.+?)'; }
    return '(?:.+?)';
  });
  
  regexStr = regexStr.replace(/\\\[ID\\\]/g, () => {
    if (!idCaptured) { idCaptured = true; return '(?<id>\\d+)'; }
    return '(?:\\d+)';
  });
  
  regexStr = regexStr.replace(/\\\[IGNORE\\\]/g, '(?:\\S+)');

  // Replace multiple spaces in template with space matcher in regex
  regexStr = regexStr.replace(/\s+/g, '\\s+');

  regexStr = `^${regexStr}$`;

  try {
    const regex = new RegExp(regexStr);
    const match = folderName.match(regex);
    
    if (match && match.groups) {
      let name = match.groups.name ? match.groups.name.trim() : folderName;
      let id = match.groups.id || null;
      return { name, id };
    }
  } catch (err) {
    console.error('Regex error:', err);
  }

  // Fallback to basic cleanup if template fails
  return { name: folderName, id: null };
}

function findCppInDir(dirPath) {
  if (!fs.existsSync(dirPath)) return null;
  const items = fs.readdirSync(dirPath);
  const cppFile = items.find(f => f.toLowerCase().endsWith('.cpp'));
  if (cppFile) return path.join(dirPath, cppFile);

  for (const item of items) {
    const itemPath = path.join(dirPath, item);
    if (fs.statSync(itemPath).isDirectory()) {
      if (item.endsWith('.ceg')) continue;
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
    
    if (!fs.existsSync(extractPath)) {
      fs.mkdirSync(extractPath, { recursive: true });
    }

    // Manual extraction to fix encoding issues
    zip.getEntries().forEach(entry => {
      let entryName = entry.entryName;
      
      try {
        const rawName = entry.rawEntryName;
        // ZIP filenames on Windows often use CP850. 
        // We attempt to decode with CP850 if it doesn't look like valid UTF-8
        // or contains known replacement characters.
        const utf8Name = rawName.toString('utf8');
        if (utf8Name.includes('\ufffd') || /[^\x00-\x7F]/.test(utf8Name)) {
           // If it has special chars, CP850 is a safer bet for Windows ZIPs
           entryName = iconv.decode(rawName, 'cp850');
        } else {
           entryName = utf8Name;
        }
      } catch (err) {
        console.warn('Encoding fix failed for entry:', entry.entryName);
      }

      const fullPath = path.join(extractPath, entryName);
      if (entry.isDirectory) {
        if (!fs.existsSync(fullPath)) fs.mkdirSync(fullPath, { recursive: true });
      } else {
        const dir = path.dirname(fullPath);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(fullPath, entry.getData());
      }
    });

    fs.unlinkSync(zipPath); // Delete temp file

    // Analyze questions - Any folder at root is a question
    const items = fs.readdirSync(extractPath);
    const questionFolders = items.filter(i => {
        const fullPath = path.join(extractPath, i);
        return fs.statSync(fullPath).isDirectory() && !i.startsWith('.') && i !== '__MACOSX';
    });
    
    // Sort question folders naturally/alphabetically to define order (Q1, Q2, etc)
    questionFolders.sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));

    const gradesFilePath = path.join(DATA_DIR, `grades_turma_${turma}.json`);
    const studentsMap = new Map();

    // Mapping of folder name to dynamic question label (optional, but good for UI)
    const questionLabels = questionFolders.reduce((acc, folder, idx) => {
        acc[`q${idx + 1}`] = folder;
        return acc;
    }, {});

    questionFolders.forEach((qFolder, idx) => {
      const qNum = idx + 1;
      const qPath = path.join(extractPath, qFolder);
      const studentFolders = fs.readdirSync(qPath).filter(i => {
          const fullPath = path.join(qPath, i);
          return fs.statSync(fullPath).isDirectory() && !i.startsWith('.');
      });

      studentFolders.forEach(folder => {
        if (!studentsMap.has(folder)) {
          const { name, id } = parseFolderWithTemplate(folder, folderTemplate || '[EMAIL] [NAME] [ID] [EMAIL]');
          studentsMap.set(folder, {
            folder_name: folder,
            name: name,
            id: id,
            questions: {}
          });
        }
        
        const student = studentsMap.get(folder);
        student.questions[`q${qNum}`] = {
          score: 0,
          comment: '',
          path: findCppInDir(path.join(qPath, folder)),
          label: qFolder // Store the original folder name as a label
        };
      });
    });

    const gradesData = Array.from(studentsMap.values());
    fs.writeFileSync(gradesFilePath, JSON.stringify(gradesData, null, 2));

    res.json({ success: true, message: `Turma ${turma} imported with ${questionFolders.length} questions detected alphabetically.` });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to extract ZIP' });
  }
});

app.get('/api/students', (req, res) => {
  const allStudents = [];
  const files = fs.readdirSync(DATA_DIR);
  const gradeFiles = files.filter(f => f.startsWith('grades_turma_') && f.endsWith('.json'));

  gradeFiles.forEach(file => {
    const turma = file.replace('grades_turma_', '').replace('.json', '');
    const filePath = path.join(DATA_DIR, file);
    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));

    data.forEach(studentData => {
      // The paths in questions might need to be verified or adjusted if we moved files
      // But they are absolute from the findCppInDir during import, or relative to DATA_DIR?
      // Let's keep them absolute for now as determined during import.
      
      const student = {
        id: studentData.folder_name,
        name: studentData.name,
        turma: turma,
        questions: studentData.questions
      };
      allStudents.push(student);
    });
  });

  res.json(allStudents);
});

app.get('/api/code', (req, res) => {
  const filePath = req.query.path;
  if (!filePath || !filePath.includes(DATA_DIR)) {
    return res.status(400).send('Invalid path');
  }

  if (fs.existsSync(filePath)) {
    const code = fs.readFileSync(filePath, 'utf8');
    res.send(code);
  } else {
    res.status(404).send('File not found');
  }
});

app.post('/api/update-grade', (req, res) => {
  const { turma, studentId, questionNum, score, comment } = req.body;
  const filePath = path.join(DATA_DIR, `grades_turma_${turma}.json`);

  if (!fs.existsSync(filePath)) {
    return res.status(404).send('Grades file not found');
  }

  let data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  const index = data.findIndex(item => item.folder_name === studentId);
  
  if (index !== -1) {
    data[index].questions[`q${questionNum}`] = { 
      ...data[index].questions[`q${questionNum}`], 
      score, 
      comment 
    };
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
    res.json({ success: true });
  } else {
    res.status(404).send('Student not found');
  }
});

app.delete('/api/turma/:name', (req, res) => {
  const turma = req.params.name;
  const gradesFile = path.join(DATA_DIR, `grades_turma_${turma}.json`);
  const turmaDir = path.join(DATA_DIR, `turma_${turma}`);

  try {
    if (fs.existsSync(gradesFile)) {
      fs.unlinkSync(gradesFile);
    }
    if (fs.existsSync(turmaDir)) {
      fs.rmSync(turmaDir, { recursive: true, force: true });
    }
    res.json({ success: true, message: `Turma ${turma} cleared successfully.` });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to clear turma data' });
  }
});

io.on('connection', (socket) => {
  console.log('Client connected to terminal');
  let ptyProcess = null;

  socket.on('run-code', ({ filePath }) => {
    if (!filePath || !fs.existsSync(filePath)) {
      socket.emit('terminal-data', '\r\n\x1b[31mError: Invalid file path\x1b[0m\r\n');
      return;
    }

    const dir = path.dirname(filePath);
    const fileName = path.basename(filePath);
    const exeName = fileName.replace('.cpp', '.exe');
    const exePath = path.join(dir, exeName);

    socket.emit('terminal-data', `\r\n\x1b[33mCompiling ${fileName}...\x1b[0m\r\n`);

    const compile = spawn('g++', [fileName, '-o', exeName], { cwd: dir, shell: true });

    let compileError = '';
    compile.stderr.on('data', (data) => {
      compileError += data.toString();
    });

    compile.on('close', (code) => {
      if (code !== 0) {
        socket.emit('terminal-data', `\r\n\x1b[31mCompilation failed:\x1b[0m\r\n${compileError.replace(/\n/g, '\r\n')}`);
        return;
      }

      socket.emit('terminal-data', `\x1b[32mCompilation successful. Running...\x1b[0m\r\n\r\n`);

      const shell = process.platform === 'win32' ? 'cmd.exe' : 'bash';
      
      try {
        ptyProcess = pty.spawn(shell, [], {
          name: 'xterm-color',
          cols: 80,
          rows: 24,
          cwd: dir,
          env: process.env
        });

        ptyProcess.onData((data) => {
          socket.emit('terminal-data', data);
        });

        const runCmd = process.platform === 'win32' ? `${exeName}\r\n` : `./${exeName}\n`;
        setTimeout(() => {
            if (ptyProcess) {
                ptyProcess.write(runCmd);
            }
        }, 500);

        ptyProcess.onExit(({ exitCode }) => {
          socket.emit('terminal-data', `\r\n\r\n\x1b[33mProcess exited with code ${exitCode}\x1b[0m\r\n`);
          ptyProcess = null;
        });
      } catch (err) {
        socket.emit('terminal-data', `\r\n\x1b[31mError spawning terminal: ${err.message}\x1b[0m\r\n`);
      }
    });
  });

  socket.on('terminal-input', (data) => {
    if (ptyProcess) {
      ptyProcess.write(data);
    }
  });

  socket.on('disconnect', () => {
    if (ptyProcess) {
      try {
        ptyProcess.kill();
      } catch (e) {}
    }
  });
});

server.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
