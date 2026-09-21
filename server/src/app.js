const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');

const importRoutes = require('./features/import/import.routes');
const settingsRoutes = require('./features/settings/settings.routes');
const classesRoutes = require('./features/classes/classes.routes');
const studentsRoutes = require('./features/students/students.routes');
const gradesRoutes = require('./features/grades/grades.routes');
const testsRoutes = require('./features/tests/tests.routes');
const aiRoutes = require('./features/ai/ai.routes');
const statisticsRoutes = require('./features/statistics/statistics.routes');
const learningRoutes = require('./features/learning/learning.routes');

const app = express();

app.use(cors());
app.use(bodyParser.json({ limit: '50mb' }));

// Mount routes
app.use('/api', importRoutes);
app.use('/api', settingsRoutes);
app.use('/api', classesRoutes);
app.use('/api', studentsRoutes);
app.use('/api', gradesRoutes);
app.use('/api', testsRoutes);
app.use('/api', aiRoutes);
app.use('/api', statisticsRoutes);
app.use('/api', learningRoutes);

module.exports = app;
