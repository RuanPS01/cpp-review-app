const express = require('express');
const router = express.Router();
const settingsController = require('./settings.controller');

router.get('/settings', settingsController.getSettings);
router.post('/settings', settingsController.updateSettings);

module.exports = router;
