const fs = require('fs');
const { SETTINGS_FILE, DEFAULT_SETTINGS } = require('../../config/env');

exports.getSettings = (req, res) => {
  if (fs.existsSync(SETTINGS_FILE)) res.json(JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf8')));
  else res.json(DEFAULT_SETTINGS);
};

exports.updateSettings = (req, res) => {
  fs.writeFileSync(SETTINGS_FILE, JSON.stringify(req.body, null, 2));
  res.json({ success: true });
};
