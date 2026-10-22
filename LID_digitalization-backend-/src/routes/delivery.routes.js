const express = require('express');
const router = express.Router();
const deliveryController = require('../controllers/delivery.controller');
const { verifyToken, verifyRole } = require('../middlewares/auth.middleware');
const requireAdmin = require('../middlewares/requireAdmin');

// All routes require authentication
router.use(verifyToken);

// View routes
router.get('/', verifyRole(['ADMIN', 'SPARE_PART', 'LOGISTIC', 'MANAGEMENT', 'PROCUREMENT', 'FINANCE']), deliveryController.getDeliveries);
router.get('/:id', verifyRole(['ADMIN', 'SPARE_PART', 'LOGISTIC', 'MANAGEMENT', 'PROCUREMENT', 'FINANCE']), deliveryController.getDeliveryById);

// Mutate routes — LOGISTIC and ADMIN only
router.post('/', verifyRole(['LOGISTIC', 'ADMIN']), deliveryController.createDelivery);
router.put('/:id', verifyRole(['LOGISTIC', 'ADMIN']), deliveryController.updateDeliveryTracking);
router.patch('/:id/status', verifyRole(['LOGISTIC', 'ADMIN']), deliveryController.updateDeliveryStatus);
router.post('/:id/generate-note', verifyRole(['LOGISTIC', 'ADMIN']), deliveryController.generateDeliveryNote);
router.post('/:id/split', verifyRole(['LOGISTIC', 'ADMIN']), deliveryController.splitDelivery);
router.delete('/:id/items/:itemId', verifyRole(['LOGISTIC', 'ADMIN']), deliveryController.deleteDeliveryItem);
router.delete('/:id', requireAdmin, deliveryController.deleteDelivery);

// Admin-only: manual trigger overdue check (normally handled by cron)
router.post('/admin/check-overdue', verifyRole(['ADMIN']), deliveryController.triggerOverdueCheck);

module.exports = router;
