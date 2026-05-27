const express = require('express');
const router = express.Router();
const importController = require('./import.controller');
const upload = require('../../middleware/upload');

router.post('/import', upload.single('file'), importController.importZip);
router.post('/import-moodle', importController.importMoodle);
router.post('/import-moodle-cookies', importController.importMoodleCookies);
router.post('/process-vpl-zip', importController.processVplZip);

module.exports = router;
