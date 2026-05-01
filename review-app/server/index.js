const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');

const app = express();
const port = 3001;

app.use(cors());
app.use(bodyParser.json());

const ROOT_DIR = path.join(__dirname, '..', '..');
const GRADES_FILES = {
  'A': path.join(ROOT_DIR, 'grades_turma_a.json'),
  'G': path.join(ROOT_DIR, 'grades_turma_g.json'),
  'I': path.join(ROOT_DIR, 'grades_turma_i.json')
};

function findCppFile(turma, questionNum, studentFolder) {
  const qFolder = path.join(ROOT_DIR, 'Provas_Alunos', `Prova2_Turma_${turma}`, `QUESTÃO ${questionNum}`, studentFolder);
  if (!fs.existsSync(qFolder)) return null;

  const subfolders = fs.readdirSync(qFolder).filter(f => fs.statSync(path.join(qFolder, f)).isDirectory());
  if (subfolders.length === 0) return null;

  // Assume the first timestamp folder contains main.cpp
  const cppPath = path.join(qFolder, subfolders[0], 'main.cpp');
  if (fs.existsSync(cppPath)) {
    return cppPath;
  }
  return null;
}

app.get('/api/students', (req, res) => {
  const allStudents = [];
  
  Object.entries(GRADES_FILES).forEach(([turma, filePath]) => {
    if (fs.existsSync(filePath)) {
      const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      Object.entries(data).forEach(([folderName, studentData]) => {
        const student = {
          id: folderName,
          name: studentData.name,
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

  const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  if (data[studentId]) {
    data[studentId][`q${questionNum}`] = { score, comment };
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
    res.json({ success: true });
  } else {
    res.status(404).send('Student not found');
  }
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
