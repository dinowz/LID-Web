const express = require('express');
const router = express.Router();
const targetController = require('../controllers/target.controller');
const { verifyToken } = require('../middlewares/auth.middleware');
const requireAdmin = require('../middlewares/requireAdmin');

router.get('/', verifyToken, targetController.getAll);
router.get('/:year', verifyToken, targetController.getByYear);
router.post('/', verifyToken, requireAdmin, targetController.upsert);
router.delete('/:id', verifyToken, requireAdmin, targetController.remove);

module.exports = router;
