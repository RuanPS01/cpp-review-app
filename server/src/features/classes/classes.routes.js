const express = require('express');
const router = express.Router();
const classesController = require('./classes.controller');

router.delete('/turma/:name', classesController.deleteTurma);
router.get('/weights', classesController.getWeights);
router.post('/weights', classesController.updateWeights);
router.get('/statements', classesController.getStatements);
router.post('/statements', classesController.updateStatements);
router.get('/testcases', classesController.getTestCases);

module.exports = router;
