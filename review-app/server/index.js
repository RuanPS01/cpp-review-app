const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');
const http = require('http');
const { Server } = require('socket.io');
const pty = require('node-pty');
const { spawn } = require('child_process');

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

const ROOT_DIR = path.join(__dirname, '..', '..');
const GRADES_FILES = {
  'A': path.join(ROOT_DIR, 'grades_turma_a.json'),
  'G': path.join(ROOT_DIR, 'grades_turma_g.json'),
  'I': path.join(ROOT_DIR, 'grades_turma_i.json')
};

function findStudentFolder(questaoPath, studentFolder) {
  if (fs.existsSync(path.join(questaoPath, studentFolder))) {
    return studentFolder;
  }

  // If exact match fails, try fuzzy matching due to encoding issues
  if (!fs.existsSync(questaoPath)) return null;
  const folders = fs.readdirSync(questaoPath);
  
  // Try matching by email/login if present in the folder name
  const emailMatch = studentFolder.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
  if (emailMatch) {
    const email = emailMatch[0];
    const match = folders.find(f => f.includes(email));
    if (match) return match;
  }

  // Fallback: match by the first word that doesn't look like an email
  const parts = studentFolder.split(' ').filter(p => !p.includes('@') && p.length > 3);
  if (parts.length > 0) {
    const match = folders.find(f => parts.every(p => {
        // Remove special characters from both to compare
        const cleanP = p.replace(/[^a-zA-Z0-9]/g, '');
        return f.replace(/[^a-zA-Z0-9]/g, '').includes(cleanP);
    }));
    if (match) return match;
  }

  return null;
}

function findCppInDir(dirPath) {
  if (!fs.existsSync(dirPath)) return null;
  const items = fs.readdirSync(dirPath);
  
  // First look for any .cpp file in the current directory
  const cppFile = items.find(f => f.toLowerCase().endsWith('.cpp'));
  if (cppFile) return path.join(dirPath, cppFile);

  // Then look in subdirectories
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

function findCppFile(turma, questionNum, studentFolder) {
  const questaoPath = path.join(ROOT_DIR, 'Provas_Alunos', `Prova2_Turma_${turma}`, `QUESTÃO ${questionNum}`);
  const actualFolder = findStudentFolder(questaoPath, studentFolder);
  
  if (!actualFolder) return null;
  
  const qFolder = path.join(questaoPath, actualFolder);
  return findCppInDir(qFolder);
}

app.get('/api/students', (req, res) => {
  const allStudents = [];
  
  Object.entries(GRADES_FILES).forEach(([turma, filePath]) => {
    if (fs.existsSync(filePath)) {
      const rawData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      
      // Normalize data to an array of [id, studentData]
      let studentEntries = [];
      if (Array.isArray(rawData)) {
        studentEntries = rawData.map(item => [item.folder_name, item]);
      } else {
        studentEntries = Object.entries(rawData);
      }

      studentEntries.forEach(([folderName, studentData]) => {
        // Try to extract name if not present
        let name = studentData.name;
        if (!name && folderName) {
          // Attempt to extract name from folderName: "login Name Code login" or "Name Code login"
          // Pattern: usually name is between email/login and code (number)
          const parts = folderName.split(' ');
          const numberIndex = parts.findIndex(p => /^\d{2,5}$/.test(p));
          if (numberIndex !== -1) {
            // If the first part looks like an email/login, start from second
            const start = parts[0].includes('@') ? 1 : 0;
            name = parts.slice(start, numberIndex).join(' ');
          } else {
            name = folderName;
          }
        }

        const student = {
          id: folderName,
          name: name || folderName,
          turma: turma,
          questions: {}
        };

        for (let i = 1; i <= 4; i++) {
          const qKey = `q${i}`;
          student.questions[qKey] = {
            score: studentData[qKey]?.score || 0,
            comment: studentData[qKey]?.comment || '',
            path: findCppFile(turma, i, folderName)
          };
        }
        allStudents.push(student);
      });
    }
  });

  res.json(allStudents);
});

app.get('/api/code', (req, res) => {
  const filePath = req.query.path;
  if (!filePath || !filePath.startsWith(ROOT_DIR)) {
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
  const filePath = GRADES_FILES[turma];

  if (!filePath || !fs.existsSync(filePath)) {
    return res.status(404).send('Grades file not found');
  }

  let data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  
  if (Array.isArray(data)) {
    const index = data.findIndex(item => item.folder_name === studentId);
    if (index !== -1) {
      data[index][`q${questionNum}`] = { score, comment };
      fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
      res.json({ success: true });
    } else {
      res.status(404).send('Student not found');
    }
  } else {
    if (data[studentId]) {
      data[studentId][`q${questionNum}`] = { score, comment };
      fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
      res.json({ success: true });
    } else {
      res.status(404).send('Student not found');
    }
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
        console.error(`Compilation failed with code ${code}`);
        socket.emit('terminal-data', `\r\n\x1b[31mCompilation failed:\x1b[0m\r\n${compileError.replace(/\n/g, '\r\n')}`);
        return;
      }

      console.log(`Compilation successful: ${exePath}`);
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

        console.log('PTY Process spawned');

        ptyProcess.onData((data) => {
          socket.emit('terminal-data', data);
        });

        // Send the command to run the EXE
        const runCmd = process.platform === 'win32' ? `${exeName}\r\n` : `./${exeName}\n`;
        setTimeout(() => {
            if (ptyProcess) {
                console.log(`Sending run command: ${runCmd}`);
                ptyProcess.write(runCmd);
            }
        }, 500);

        ptyProcess.onExit(({ exitCode }) => {
          console.log(`PTY Process exited with code ${exitCode}`);
          socket.emit('terminal-data', `\r\n\r\n\x1b[33mProcess exited with code ${exitCode}\x1b[0m\r\n`);
          ptyProcess = null;
        });
      } catch (err) {
        console.error('Failed to spawn PTY:', err);
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
