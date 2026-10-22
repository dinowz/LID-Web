const express = require('express');
const router = express.Router();
const { addClient } = require('../utils/sseEmitter');

// Route untuk menerima koneksi EventSource dari frontend
router.get('/', (req, res) => {
  addClient(req, res);
});

module.exports = router;
