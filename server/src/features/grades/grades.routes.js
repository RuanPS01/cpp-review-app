const express = require('express');
const router = express.Router();
const gradesController = require('./grades.controller');

router.post('/update-grade', gradesController.updateGrade);
router.get('/export-grades/:turma', gradesController.exportGrades);
router.post('/import-grades', gradesController.importGrades);

module.exports = router;
