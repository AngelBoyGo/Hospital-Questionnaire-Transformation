const express = require('express');
const path = require('path');
const fs = require('fs');

const filesRouter = express.Router();
const baseDir = path.join(__dirname, '..', '..', 'generated_documents');

function safeJoin(base, target) {
  const targetPath = path.join(base, target);
  if (!targetPath.startsWith(base)) {
    throw new Error('Invalid path');
  }
  return targetPath;
}

filesRouter.get('/pdf/:filename', (req, res) => {
  try {
    const filePath = safeJoin(baseDir, req.params.filename);
    if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'File not found' });
    res.type('application/pdf');
    res.sendFile(filePath);
  } catch (e) {
    res.status(400).json({ error: 'Invalid filename' });
  }
});

filesRouter.get('/word/:filename', (req, res) => {
  try {
    const filePath = safeJoin(baseDir, req.params.filename);
    if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'File not found' });
    res.type('application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.sendFile(filePath);
  } catch (e) {
    res.status(400).json({ error: 'Invalid filename' });
  }
});

module.exports = { filesRouter };