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

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
