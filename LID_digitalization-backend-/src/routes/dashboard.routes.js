const express = require('express');
const router = express.Router();
const dashboardController = require('../controllers/dashboard.controller');
const { verifyToken } = require('../middlewares/auth.middleware');

router.get('/resource-utilization', verifyToken, dashboardController.getResourceUtilization);
router.get('/resource-overview', verifyToken, dashboardController.getResourceOverview);
router.get('/pipeline-stats', verifyToken, dashboardController.getPipelineStats);
router.get('/export-csv', verifyToken, dashboardController.exportCSV);
router.get('/invoice-achievement', verifyToken, dashboardController.getInvoiceAchievement);

module.exports = router;
