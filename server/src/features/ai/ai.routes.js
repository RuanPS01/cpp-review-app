const express = require('express');
const router = express.Router();
const aiController = require('./ai.controller');

router.post('/analyze', aiController.analyzeCode);

module.exports = router;
