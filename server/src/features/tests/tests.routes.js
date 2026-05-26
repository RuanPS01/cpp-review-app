const express = require('express');
const router = express.Router();
const testsController = require('./tests.controller');

router.post('/run-tests', testsController.runTests);

module.exports = router;
