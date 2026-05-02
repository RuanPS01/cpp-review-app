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
app.use(bodyParser.json());

const DATA_DIR = path.join(__dirname, 'data');
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR);
}

const SETTINGS_FILE = path.join(DATA_DIR, 'settings.json');
const DEFAULT_SETTINGS = {
  provider: 'ollama',
  ollamaModel: 'llama3',
  cloudModel: 'gemini-1.5-flash',
  cloudKey: '',
  evaluationCriteria: `Sistema de correção:

Pontuações e exceções:
- Cada questão deve ser pontuada de 0 a 100;
- O resultado final é a média simples entre as notas das questões sem diferença de pesos;
- Um código implementado pelo aluno não necessariamente deve rodar para receber pontuações, a proximidade com a resposta correta deve ser considerada;
- Estruturas base obrigatórias para a criação de um código, rendem apenas 1 ponto na questão (1 de 100).
- Uma questão terá pontuação 0 se:
	* Se for uma implementação para tentativa de burlar o teste automatizado, simulando saídas específicas para entradas específicas, ou seja colocando apenas ifs e couts sem lógica de implementação;
	* Se foi implementada utilizando estruturas de código que não fazem parte do conteúdo de prova;

Regras de correção para desconto de pontuação. Considerando que cada questão vale de 0 a 100, uma questão não terá 100 quando os descontos dos erros abaixo acontecerem:
- (-5 pontos) - Se uma estrutura de repetição está com a quantidade de repetições incorretas (apenas erro de quantidade), ou apenas com condição inversa;
- (-10 pontos) - Se há pequenos erros de identação de código;
- (-20 pontos) - Se todo o código está sem identação;
- (-10 pontos) - Se foi utilizada tipagem de variável errada para o problema proposto;
- (-10 pontos) - Se o código está praticamente correto perânte ao que a questão pede, porém com erro de sintaxe (Exemplos: acesso a uma variável que não existe por erro de digitação; "ponto-e-vírgula" faltante; chave ou parêntezes de abertura ou fechamento faltante; caractere de operador relacional faltante)
- (-30 pontos) - Se a lógica do que foi implementado está inversa com o que foi pedido na questão (Exemplo: a questão pediu valor maior, e retornar o menor e vice versa)
- (-30 pontos) - Se uma operação matemática que foi solicitada pela questão possui erros de lógica matemática implementada;
- (-10 pontos) - Se a saída de resultado do código está diferente (visualmente) ou faltante para o resultado esperado (Ex: é esperado "X = " e o terminal mostrou "valor-> ")
- (-80 pontos) - Se o código possui lógica inconsistente ou que não condiz com o que foi pedido mas possui demais implementações realizadas corretamente como a entrada e saída de informações e demais estruturas;

Situações conhecidas:
- Caso uma implementação de código não faça sentido diante da programação, a questão deverá ser pontuada até no máximo 20 pontos de acordo com as estruturas que foram implementadas corretamente diante ao que foi pedido pela questão.
	Exemplo de erros: int 2.0; ou int (A < 2); {} ou 2 = X; ou cin >> 1.0;

- Caso a implementação esteja incompleta, exemplo: somente os cin de entrada, ou somente as saídas, não contendo a lógica central do que foi pedido, a pontuação máxima diante do que foi feito deve ser até 10 pontos somente.

- Caso hava mais erros de código que não foram citados aqui mas podem ser avaliados, pondere e desconte de 5 a 10 pontos da questão conforme a criticidade do erro de implementação.

- Não há notas negativas.

- Se uma questão teve bastantes erros mas teve alguma implementação que faça sentido, mesmo que minimamente, ou seja, ela não é completamente 0, mesmo que a subtração dos pontos citados acima chegue em 0. Ou seja, pondere o grau de assertividade geral caso as subtrações dos critérios não se aplique corretamente.`
};

if (!fs.existsSync(SETTINGS_FILE)) {
  fs.writeFileSync(SETTINGS_FILE, JSON.stringify(DEFAULT_SETTINGS, null, 2));
}

function getStatementsPath(turma) {
  const turmaDir = path.join(DATA_DIR, `turma_${turma}`);
  if (!fs.existsSync(turmaDir)) fs.mkdirSync(turmaDir, { recursive: true });
  return path.join(turmaDir, 'statements.json');
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

app.get('/api/export-grades/:turma', (req, res) => {
  const { turma } = req.params;
  const filePath = path.join(DATA_DIR, `grades_turma_${turma}.json`);

  if (fs.existsSync(filePath)) {
    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    res.json(data);
  } else {
    res.status(404).send('Class data not found');
  }
});

app.post('/api/import-grades', (req, res) => {
  const { turma, grades } = req.body;
  const filePath = path.join(DATA_DIR, `grades_turma_${turma}.json`);

  if (!fs.existsSync(filePath)) {
    return res.status(404).send('Class not found. Please import submissions ZIP first.');
  }

  try {
    let existingData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    
    // Create a map for quick lookup by folder_name (studentId in frontend)
    const gradesMap = new Map();
    grades.forEach(g => gradesMap.set(g.folder_name || g.id, g));

    const updatedData = existingData.map(student => {
      const importStudent = gradesMap.get(student.folder_name);
      if (importStudent && importStudent.questions) {
        // Merge only scores and comments, preserve existing paths
        const mergedQuestions = { ...student.questions };
        Object.keys(importStudent.questions).forEach(qKey => {
          if (mergedQuestions[qKey]) {
            mergedQuestions[qKey] = {
              ...mergedQuestions[qKey],
              score: importStudent.questions[qKey].score ?? mergedQuestions[qKey].score,
              comment: importStudent.questions[qKey].comment ?? mergedQuestions[qKey].comment
            };
          }
        });
        return { ...student, questions: mergedQuestions };
      }
      return student;
    });

    fs.writeFileSync(filePath, JSON.stringify(updatedData, null, 2), 'utf8');
    res.json({ success: true, message: `Successfully updated ${grades.length} student records.` });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to process grades JSON' });
  }
});

app.delete('/api/turma/:name', (req, res) => {
// ... existing delete logic
});

// AI Settings Endpoints
app.get('/api/settings', (req, res) => {
  if (fs.existsSync(SETTINGS_FILE)) {
    res.json(JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf8')));
  } else {
    res.json(DEFAULT_SETTINGS);
  }
});

app.post('/api/settings', (req, res) => {
  fs.writeFileSync(SETTINGS_FILE, JSON.stringify(req.body, null, 2));
  res.json({ success: true });
});

// Question Statements Endpoints
app.get('/api/statements', (req, res) => {
  const { turma } = req.query;
  const filePath = getStatementsPath(turma);
  if (fs.existsSync(filePath)) {
    res.json(JSON.parse(fs.readFileSync(filePath, 'utf8')));
  } else {
    res.json({});
  }
});

app.post('/api/statements', (req, res) => {
  const { turma, statements } = req.body;
  const filePath = getStatementsPath(turma);
  fs.writeFileSync(filePath, JSON.stringify(statements, null, 2));
  res.json({ success: true });
});

// AI Analysis Endpoint
app.post('/api/analyze', async (req, res) => {
  const { turma, questionNum, code } = req.body;
  const settings = JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf8'));
  const statementsPath = getStatementsPath(turma);
  const statements = fs.existsSync(statementsPath) ? JSON.parse(fs.readFileSync(statementsPath, 'utf8')) : {};
  const statement = statements[`q${questionNum}`];

  if (!statement) {
    return res.status(400).json({ error: 'Question statement is missing for this class.' });
  }

  const systemPrompt = `
    You are an expert code reviewer. 
    Evaluate the following student C++ code based on these criteria:
    ${settings.evaluationCriteria}

    The specific question statement is:
    ${statement}

    STRICT INSTRUCTION: Return ONLY a valid JSON object with this structure:
    {
      "score": <number between 0 and 10>,
      "comment": "<constructive feedback string>"
    }
  `;

  const userPrompt = `Student Code:\n\n${code}`;

  try {
    let resultText = '';

    if (settings.provider === 'ollama') {
      const ollama = new Ollama();
      const response = await ollama.chat({
        model: settings.ollamaModel,
        messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
        ],
        format: 'json'
      });
      resultText = response.message.content;
    } 
    else if (settings.provider === 'openai') {
      const openai = new OpenAI({ apiKey: settings.cloudKey });
      const response = await openai.chat.completions.create({
        model: settings.cloudModel || 'gpt-4o',
        messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
        ],
        response_format: { type: 'json_object' }
      });
      resultText = response.choices[0].message.content;
    }
    else if (settings.provider === 'gemini') {
      const genAI = new GoogleGenerativeAI(settings.cloudKey);
      const model = genAI.getGenerativeModel({ model: settings.cloudModel || "gemini-1.5-pro" });
      const result = await model.generateContent(`${systemPrompt}\n\n${userPrompt}`);
      resultText = result.response.text();
    }
    else if (settings.provider === 'claude') {
      const anthropic = new Anthropic({ apiKey: settings.cloudKey });
      const msg = await anthropic.messages.create({
        model: settings.cloudModel || "claude-3-5-sonnet-20240620",
        max_tokens: 1000,
        system: systemPrompt,
        messages: [{ role: "user", content: userPrompt }],
      });
      resultText = msg.content[0].text;
    }

    // Clean resultText (some models might still include markdown blocks)
    const jsonMatch = resultText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const json = JSON.parse(jsonMatch[0]);
      res.json(json);
    } else {
      throw new Error('AI failed to return valid JSON');
    }

  } catch (err) {
    console.error('AI Analysis Error:', err);
    res.status(500).json({ error: 'AI analysis failed: ' + err.message });
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
