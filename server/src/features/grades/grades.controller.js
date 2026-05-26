const fs = require('fs');
const path = require('path');
const { DATA_DIR } = require('../../config/env');

exports.updateGrade = (req, res) => {
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
};

exports.exportGrades = (req, res) => {
  const filePath = path.join(DATA_DIR, `grades_turma_${req.params.turma}.json`);
  if (fs.existsSync(filePath)) res.json(JSON.parse(fs.readFileSync(filePath, 'utf8')));
  else res.status(404).send('Class not found');
};

exports.importGrades = (req, res) => {
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
};
