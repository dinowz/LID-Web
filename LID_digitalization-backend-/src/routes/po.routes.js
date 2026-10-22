const express = require('express');
const router = express.Router();
const poController = require('../controllers/po.controller');
const { uploadPOFile } = require('../middlewares/upload.middleware');
const { verifyToken, verifyRole } = require('../middlewares/auth.middleware');
const requireAdmin = require('../middlewares/requireAdmin');

router.use(verifyToken);

router.get('/', verifyRole(['ADMIN', 'SPARE_PART', 'SERVICE', 'PROJECT', 'PROCUREMENT', 'MANAGEMENT', 'FINANCE', 'LOGISTIC', 'TFS']), poController.getPOs);
router.get('/:id', verifyRole(['ADMIN', 'SPARE_PART', 'SERVICE', 'PROJECT', 'PROCUREMENT', 'MANAGEMENT', 'FINANCE', 'LOGISTIC', 'TFS']), poController.getPOById);
router.post('/from-quotation/:quotationId', verifyRole(['ADMIN', 'PROCUREMENT', 'SPARE_PART', 'SERVICE', 'PROJECT']), uploadPOFile.single('file'), poController.createPOFromQuotation);

router.post('/from-tfs/:tfsId', verifyRole(['ADMIN', 'SERVICE']), poController.createPOFromTFS);
router.put('/:id', verifyRole(['ADMIN', 'PROCUREMENT']), poController.updatePO);
router.post('/:id/send-reminder', verifyRole(['ADMIN', 'PROCUREMENT']), poController.sendReminder);
router.post('/:id/revert', verifyRole(['ADMIN', 'PROCUREMENT']), poController.revertPOToQuotation);
router.post('/:id/split', verifyRole(['ADMIN', 'PROCUREMENT', 'SPARE_PART', 'SERVICE', 'PROJECT']), poController.splitPO);

// Upload & Rename endpoint
router.post('/:id/upload', verifyRole(['ADMIN', 'PROCUREMENT', 'LOGISTIC', 'SPARE_PART', 'SERVICE', 'PROJECT']), uploadPOFile.single('file'), poController.uploadDocument);
router.patch('/:id/rename-document', verifyRole(['ADMIN', 'PROCUREMENT', 'LOGISTIC', 'SPARE_PART', 'SERVICE', 'PROJECT']), poController.renameDocument);
router.delete('/:id', requireAdmin, poController.deletePO);

module.exports = router;
