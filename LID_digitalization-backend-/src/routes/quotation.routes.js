const express = require('express');
const router = express.Router();
const quotationController = require('../controllers/quotation.controller');
const { verifyToken, verifyRole } = require('../middlewares/auth.middleware');
const { uploadPOFile } = require('../middlewares/upload.middleware');
const requireAdmin = require('../middlewares/requireAdmin');

router.get('/', verifyToken, verifyRole(['ADMIN', 'SPARE_PART', 'SERVICE', 'PROJECT', 'MANAGEMENT', 'TFS', 'PROCUREMENT', 'FINANCE', 'LOGISTIC']), quotationController.getQuotations);

// Specific sub-resource routes MUST be declared BEFORE generic /:id routes
router.get('/from-inquiry/:inquiryId/prepare', verifyToken, verifyRole(['ADMIN', 'SPARE_PART', 'SERVICE', 'PROJECT', 'MANAGEMENT', 'TFS', 'PROCUREMENT', 'FINANCE', 'LOGISTIC']), quotationController.prepareQuotationFromInquiry);
router.post('/from-inquiry/:inquiryId', verifyToken, verifyRole(['ADMIN', 'SPARE_PART', 'SERVICE', 'PROJECT']), quotationController.createQuotationFromInquiry);

// Accept External TFS with PO
router.post('/:id/accept-with-po', verifyToken, verifyRole(['ADMIN', 'SERVICE']), uploadPOFile.single('file'), quotationController.acceptTfsQuotationWithPo);

// Generic /:id routes
router.get('/:id/pdf', verifyToken, verifyRole(['ADMIN', 'SPARE_PART', 'SERVICE', 'PROJECT', 'MANAGEMENT', 'TFS', 'PROCUREMENT', 'FINANCE', 'LOGISTIC']), quotationController.downloadQuotationPdf);
router.get('/:id', verifyToken, verifyRole(['ADMIN', 'SPARE_PART', 'SERVICE', 'PROJECT', 'MANAGEMENT', 'TFS', 'PROCUREMENT', 'FINANCE', 'LOGISTIC']), quotationController.getQuotationById);
router.put('/:id', verifyToken, verifyRole(['ADMIN', 'SPARE_PART', 'SERVICE', 'PROJECT']), quotationController.updateQuotation);
router.patch('/:id', verifyToken, verifyRole(['ADMIN', 'SPARE_PART', 'SERVICE', 'PROJECT']), quotationController.updateQuotation);
router.post('/:id/revert', verifyToken, verifyRole(['ADMIN', 'SPARE_PART', 'SERVICE', 'PROJECT']), quotationController.revertQuotationToInquiry);
router.delete('/:id', verifyToken, requireAdmin, quotationController.deleteQuotation);

module.exports = router;
