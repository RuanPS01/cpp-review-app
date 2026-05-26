const fs = require('fs');
const path = require('path');
const { DATA_DIR } = require('../../config/env');

exports.getStudents = (req, res) => {
  const allStudents = [];
  const files = fs.readdirSync(DATA_DIR).filter(f => f.startsWith('grades_turma_') && f.endsWith('.json'));
  files.forEach(file => {
    const turma = file.replace('grades_turma_', '').replace('.json', '');
    const data = JSON.parse(fs.readFileSync(path.join(DATA_DIR, file), 'utf8'));
    data.forEach(s => allStudents.push({ ...s, turma }));
  });
  res.json(allStudents);
};

exports.getCode = (req, res) => {
  const filePath = req.query.path;
  if (!filePath || !filePath.includes(DATA_DIR)) return res.status(400).send('Invalid path');
  if (fs.existsSync(filePath)) res.send(fs.readFileSync(filePath, 'utf8'));
  else res.status(404).send('File not found');
};

exports.updateStudent = (req, res) => {
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
};
