const multer = require('multer');
const fs = require('fs');
const path = require('path');

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    // Determine the path based on poType which should be in req.body or we can default to 'misc'
    const poType = req.body.poType ? req.body.poType.toLowerCase().replace('_', '') : 'misc';
    const uploadPath = path.join(__dirname, `../../uploads/po/${poType}`);

    // Create directory if it doesn't exist
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    const poNumber = req.body.poNumber || 'PO';
    const documentType = req.body.documentType || 'document';
    const customFileName = req.body.customFileName ? String(req.body.customFileName).trim() : null;
    const timestamp = Date.now();
    // Replace spaces and special chars to avoid issues
    const safePoNumber = poNumber.replace(/[^a-zA-Z0-9-]/g, '_');
    const safeDocType = documentType.replace(/[^a-zA-Z0-9-]/g, '_');

    if (customFileName) {
      // Jika diisi: namafile_timestamp.pdf
      const cleanCustomName = customFileName.replace(/\.pdf$/i, '').replace(/[^a-zA-Z0-9-_]/g, '_');
      cb(null, `${cleanCustomName}_${timestamp}.pdf`);
    } else {
      // Jika dikosongkan: PO_documentType_timestamp.pdf
      cb(null, `${safePoNumber}_${safeDocType}_${timestamp}.pdf`);
    }
  }
});

const fileFilter = (req, file, cb) => {
  if (file.mimetype === 'application/pdf') {
    cb(null, true);
  } else {
    cb(new Error('Only PDF files are allowed!'), false);
  }
};

const uploadPOFile = multer({
  storage: storage,
  limits: {
    fileSize: 15 * 1024 * 1024 // 15MB
  },
  fileFilter: fileFilter
});

const invoiceStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = path.join(__dirname, `../../uploads/invoices`);
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    const timestamp = Date.now();
    cb(null, `INV_${timestamp}.pdf`);
  }
});

const uploadInvoiceFile = multer({
  storage: invoiceStorage,
  limits: {
    fileSize: 15 * 1024 * 1024 // 15MB
  },
  fileFilter: fileFilter
});

const paymentProofStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = path.join(__dirname, `../../uploads/payments`);
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    const timestamp = Date.now();
    cb(null, `PAY_${timestamp}_${file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_')}`);
  }
});

const paymentFileFilter = (req, file, cb) => {
  if (file.mimetype === 'application/pdf' || file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    cb(new Error('Only PDF and Image files are allowed!'), false);
  }
};

const uploadPaymentProof = multer({
  storage: paymentProofStorage,
  limits: {
    fileSize: 15 * 1024 * 1024 // 15MB
  },
  fileFilter: paymentFileFilter
});

module.exports = { uploadPOFile, uploadInvoiceFile, uploadPaymentProof };

