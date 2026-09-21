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

router.get('/learning/activity', learningController.getActivity);
router.post('/learning/activity/collect', learningController.collectActivity);
router.get('/learning/indicators', learningController.getIndicators);
router.get('/learning/patterns', learningController.getPatterns);

router.get('/learning/academic', learningController.getAcademic);
router.post('/learning/academic', learningController.saveAcademic);
router.post('/learning/academic/preview', learningController.previewAcademic);

router.get('/learning/outcome', learningController.getOutcome);
router.post('/learning/outcome', learningController.saveOutcome);
router.get('/learning/association', learningController.getAssociation);

module.exports = router;
