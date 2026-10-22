const express = require('express');
const router = express.Router();
const inquiryController = require('../controllers/inquiry.controller');
const { verifyToken, verifyRole } = require('../middlewares/auth.middleware');
const requireAdmin = require('../middlewares/requireAdmin');

// Note: /api/admin/master is for pure master data. 
// We will register inquiry at /api/inquiries
// We assume it requires authentication.
router.use(verifyToken);

// Reference data
router.get('/customers', inquiryController.getCustomers);
router.get('/codewords', inquiryController.getCodeWords);
router.get('/statuses', inquiryController.getInquiryStatuses);
router.get('/sources', inquiryController.getInquirySources);


// Core CRUD
router.get('/', inquiryController.getInquiries);
router.post('/', verifyRole(['ADMIN', 'SPARE_PART', 'SERVICE', 'TFS', 'PROJECT']), inquiryController.createInquiry);
router.get('/:id', inquiryController.getInquiryById);
router.put('/:id', verifyRole(['ADMIN', 'SPARE_PART', 'SERVICE', 'TFS', 'PROJECT']), inquiryController.updateInquiry);
router.delete('/:id', requireAdmin, inquiryController.deleteInquiry);

// Specific Action Endpoints
router.patch('/:id/status', verifyRole(['ADMIN', 'SPARE_PART', 'SERVICE', 'PROJECT']), inquiryController.updateInquiryStatus);
router.get('/:id/export-excel', inquiryController.exportInquiryExcel);

module.exports = router;
