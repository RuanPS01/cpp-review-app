const express = require('express');
const router = express.Router();
const studentsController = require('./students.controller');

router.get('/students', studentsController.getStudents);
router.get('/code', studentsController.getCode);
router.post('/update-student', studentsController.updateStudent);

module.exports = router;
