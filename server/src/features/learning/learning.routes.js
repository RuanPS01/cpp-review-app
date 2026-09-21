const express = require('express');
const router = express.Router();
const learningController = require('./learning.controller');

router.get('/learning/taxonomies', learningController.listTaxonomies);
router.post('/learning/taxonomies', learningController.saveTaxonomy);
router.delete('/learning/taxonomies/:id', learningController.deleteTaxonomy);

router.get('/learning/taxonomy', learningController.getMapping);
router.post('/learning/taxonomy', learningController.saveMapping);
router.post('/learning/taxonomy/bind', learningController.bindTaxonomy);
router.post('/learning/taxonomy/suggest', learningController.suggestMapping);

router.get('/learning/mastery', learningController.getMastery);

module.exports = router;
