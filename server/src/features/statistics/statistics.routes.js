const express = require('express');
const router = express.Router();
const statisticsController = require('./statistics.controller');

router.post('/statistics/import-moodle', statisticsController.importMoodle);
router.get('/statistics/datasets', statisticsController.listDatasets);
router.get('/statistics/dataset', statisticsController.getDataset);
router.get('/statistics/submission-code', statisticsController.getSubmissionCode);
router.delete('/statistics/dataset/:turma', statisticsController.deleteDataset);
router.get('/statistics/ai-reports', statisticsController.getReports);
router.post('/statistics/ai-report', statisticsController.generateReport);

module.exports = router;
