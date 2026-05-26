const multer = require('multer');
const { UPLOADS_DIR } = require('../config/env');

const upload = multer({ dest: UPLOADS_DIR });

module.exports = upload;
