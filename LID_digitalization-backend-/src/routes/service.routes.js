const express = require('express');
const router = express.Router();
const { getServices, getServiceById, createService, updateService, deleteService, createServiceFromQuotation, createServiceFromInquiry } = require('../controllers/service.controller');
const { verifyToken, verifyRole } = require('../middlewares/auth.middleware');
const requireAdmin = require('../middlewares/requireAdmin');

router.use(verifyToken);

router.get('/', getServices);
router.get('/:id', getServiceById);
router.post('/', verifyRole(['ADMIN', 'TFS', 'SERVICE']), createService);
router.post('/from-quotation/:quotationId', verifyRole(['ADMIN', 'TFS', 'SERVICE']), createServiceFromQuotation);
router.post('/from-inquiry/:inquiryId', verifyRole(['ADMIN', 'TFS', 'SERVICE']), createServiceFromInquiry);
router.put('/:id', verifyRole(['ADMIN', 'TFS', 'SERVICE']), updateService);
router.delete('/:id', requireAdmin, deleteService);

module.exports = router;
