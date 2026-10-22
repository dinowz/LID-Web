const express = require('express');
const router = express.Router();
const {
  getAllTfs,
  searchServices,
  getTfsByServiceExecutionId,
  createTfsAssignment,
  createStandaloneTfs,
  linkTfsToServiceExecution,
  updateTfsAssignment,
  deleteTfsAssignment,
} = require('../controllers/tfs.controller');
const { verifyToken, verifyRole } = require('../middlewares/auth.middleware');
const requireAdmin = require('../middlewares/requireAdmin');

router.use(verifyToken);

// ── Global list & service search ─────────────────────────────────────────────
router.get('/', getAllTfs);
router.get('/search-services', searchServices);

// ── Standalone TFS (Free Assignment / Day Off / Paid without service) ─────────
router.post('/standalone', verifyRole(['ADMIN', 'TFS', 'SERVICE']), createStandaloneTfs);

// ── Per-service TFS ───────────────────────────────────────────────────────────
router.get('/service-execution/:serviceExecutionId', getTfsByServiceExecutionId);
router.post('/service-execution/:serviceExecutionId', verifyRole(['ADMIN', 'TFS', 'SERVICE']), createTfsAssignment);

// ── Link TFS to Service Execution ─────────────────────────────────────────────
router.patch('/:id/link', verifyRole(['ADMIN', 'TFS', 'SERVICE']), linkTfsToServiceExecution);

// ── Single TFS CRUD ───────────────────────────────────────────────────────────
router.put('/:id', verifyRole(['ADMIN', 'TFS', 'SERVICE']), updateTfsAssignment);
router.delete('/:id', requireAdmin, deleteTfsAssignment);

module.exports = router;
