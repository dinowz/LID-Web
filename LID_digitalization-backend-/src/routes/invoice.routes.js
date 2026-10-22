const express = require('express');
const router = express.Router();
const { 
  getReadyToInvoiceList,
  createInvoiceFromDelivery,
  createInvoiceFromPoDp,
  createInvoiceFromService,
  createInvoiceFromProject,
  updateInvoiceStatus,
  updateInvoiceData,
  getInvoices, 
  getInvoiceById,
  uploadExternalInvoice,
  markAsPaid,
  deleteDraftInvoice
} = require('../controllers/invoice.controller');
const { verifyToken, verifyRole } = require('../middlewares/auth.middleware');
const { uploadInvoiceFile, uploadPaymentProof } = require('../middlewares/upload.middleware');

router.use(verifyToken);

router.get('/ready-to-invoice', verifyRole(['ADMIN', 'FINANCE', 'SPARE_PART', 'MANAGEMENT', 'SERVICE', 'PROJECT']), getReadyToInvoiceList);
router.post('/from-delivery', verifyRole(['ADMIN', 'FINANCE']), createInvoiceFromDelivery);
router.post('/from-po-dp', verifyRole(['ADMIN', 'FINANCE']), createInvoiceFromPoDp);
router.post('/from-service', verifyRole(['ADMIN', 'FINANCE']), createInvoiceFromService);
router.post('/from-project', verifyRole(['ADMIN', 'FINANCE']), createInvoiceFromProject);
router.get('/', verifyRole(['ADMIN', 'FINANCE', 'SPARE_PART', 'MANAGEMENT', 'SERVICE', 'PROJECT']), getInvoices);
router.get('/:id', verifyRole(['ADMIN', 'FINANCE', 'SPARE_PART', 'MANAGEMENT', 'SERVICE', 'PROJECT']), getInvoiceById);
router.patch('/:id/status', verifyRole(['ADMIN', 'FINANCE']), updateInvoiceStatus);
router.put('/:id', verifyRole(['ADMIN', 'FINANCE']), uploadInvoiceFile.single('file'), updateInvoiceData);
router.post('/:id/upload-external', verifyRole(['ADMIN', 'FINANCE']), uploadInvoiceFile.single('file'), uploadExternalInvoice);
router.post('/:id/pay', verifyRole(['ADMIN', 'FINANCE']), uploadPaymentProof.single('file'), markAsPaid);
router.delete('/:id/draft', verifyRole(['ADMIN', 'FINANCE']), deleteDraftInvoice);

module.exports = router;
