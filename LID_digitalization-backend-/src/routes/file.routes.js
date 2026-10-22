const express = require('express');
const router = express.Router();
const fileController = require('../controllers/file.controller');

// GET /api/files/download
router.get('/download', fileController.downloadFile);

module.exports = router;
