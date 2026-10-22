const poService = require('../services/po.service');
const { broadcast } = require('../utils/sseEmitter');

const serializeJson = (data) => {
  if (!data) return data;
  return JSON.parse(JSON.stringify(data, (k, v) => typeof v === 'bigint' ? v.toString() : v));
};

const getPOs = async (req, res) => {
  try {
    const data = await poService.getPOs(req.query);
    res.json(serializeJson(data));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const getPOById = async (req, res) => {
  try {
    const data = await poService.getPOById(req.params.id);
    if (!data) return res.status(404).json({ error: 'Purchase Order not found' });
    res.json(serializeJson(data));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const createPOFromQuotation = async (req, res) => {
  try {
    const quotationId = req.params.quotationId;
    const userId = req.user ? req.user.id : null;
    const userRoles = req.user?.roles || (req.user?.role ? [req.user.role] : []);

    // === Per-module role gating ===
    const prisma = require('../config/prisma');
    const quotation = await prisma.quotation.findUnique({
      where: { id: BigInt(quotationId) },
      include: { inquiry: true }
    });

    if (quotation && quotation.inquiry?.requestType) {
      const requestType = quotation.inquiry.requestType;
      const isAdmin = userRoles.includes('ADMIN');
      const isProcurement = userRoles.includes('PROCUREMENT');

      // Admin and Procurement always have full access
      if (!isAdmin && !isProcurement) {
        if (requestType.startsWith('SPARE_PART') && !userRoles.includes('SPARE_PART')) {
          return res.status(403).json({ error: 'You do not have permission to create a PO for Spare Part module.' });
        }
        if (requestType.startsWith('SERVICE') && !userRoles.includes('SERVICE')) {
          return res.status(403).json({ error: 'You do not have permission to create a PO for Service module.' });
        }
        if (requestType.startsWith('PROJECT') && !userRoles.includes('PROJECT')) {
          return res.status(403).json({ error: 'You do not have permission to create a PO for Project module.' });
        }
      }
    }

    // Get file path if uploaded
    let customerPoFile = null;
    if (req.file) {
      const poType = req.body.poType ? req.body.poType.toLowerCase().replace('_', '') : 'misc';
      customerPoFile = `/uploads/po/${poType}/${req.file.filename}`;
    }

    const data = await poService.createPOFromQuotation(quotationId, userId, { customerPoFile });
    broadcast({ type: 'REFRESH_BADGE' });
    res.status(201).json(serializeJson(data));
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};


const createPOFromTFS = async (req, res) => {
  try {
    const tfsId = req.params.tfsId;
    const userId = req.user ? req.user.id : null;
    const data = await poService.createPOFromTFS(tfsId, userId);
    broadcast({ type: 'REFRESH_BADGE' });
    res.status(201).json(serializeJson(data));
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

const updatePO = async (req, res) => {
  try {
    const userId = req.user ? req.user.id : null;
    const userRoles = req.user?.roles || (req.user?.role ? [req.user.role] : []);

    // === PROCUREMENT type gating: hanya boleh edit PO Spare Part ===
    const existing = await poService.getPOById(req.params.id);
    if (existing) {
      const poType = existing.poType ||
        (existing.quotation?.inquiry?.requestType?.startsWith('SERVICE_') ? 'SERVICE' :
         existing.quotation?.inquiry?.requestType?.startsWith('PROJECT_') ? 'PROJECT' : 'SPARE_PART');
      if (poType !== 'SPARE_PART') {
        if (!userRoles.some(r => ['ADMIN', 'SERVICE', 'PROJECT', 'TFS'].includes(r)) && userRoles.includes('PROCUREMENT')) {
          return res.status(403).json({ error: 'Anda tidak memiliki izin mengedit PO selain Spare Part.' });
        }
      }
    }

    const data = await poService.updatePO(req.params.id, req.body, userId);
    broadcast({ type: 'REFRESH_BADGE' });
    res.json(serializeJson(data));
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

const sendReminder = async (req, res) => {
  try {
    const userRoles = req.user?.roles || (req.user?.role ? [req.user.role] : []);

    // === PROCUREMENT type gating ===
    const existing = await poService.getPOById(req.params.id);
    if (existing) {
      const poType = existing.poType ||
        (existing.quotation?.inquiry?.requestType?.startsWith('SERVICE_') ? 'SERVICE' :
         existing.quotation?.inquiry?.requestType?.startsWith('PROJECT_') ? 'PROJECT' : 'SPARE_PART');
      if (poType !== 'SPARE_PART') {
        if (!userRoles.some(r => ['ADMIN', 'SERVICE', 'PROJECT', 'TFS'].includes(r)) && userRoles.includes('PROCUREMENT')) {
          return res.status(403).json({ error: 'Anda tidak memiliki izin mengirim reminder untuk PO selain Spare Part.' });
        }
      }
    }

    const info = await poService.sendReminderTest(req.params.id);
    res.json({ success: true, message: "Reminder email sent successfully", infoId: info.messageId });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

const revertPOToQuotation = async (req, res) => {
  try {
    const userId = req.user ? req.user.id : null;
    const userRoles = req.user?.roles || (req.user?.role ? [req.user.role] : []);
    const { reason } = req.body;

    // === PROCUREMENT type gating ===
    const existing = await poService.getPOById(req.params.id);
    if (existing) {
      const poType = existing.poType ||
        (existing.quotation?.inquiry?.requestType?.startsWith('SERVICE_') ? 'SERVICE' :
         existing.quotation?.inquiry?.requestType?.startsWith('PROJECT_') ? 'PROJECT' : 'SPARE_PART');
      if (poType !== 'SPARE_PART') {
        if (!userRoles.some(r => ['ADMIN', 'SERVICE', 'PROJECT', 'TFS'].includes(r)) && userRoles.includes('PROCUREMENT')) {
          return res.status(403).json({ error: 'Anda tidak memiliki izin merevert PO selain Spare Part.' });
        }
      }
    }

    const quotationId = await poService.revertPOToQuotation(req.params.id, userId, reason);
    broadcast({ type: 'REFRESH_BADGE' });
    res.json({ success: true, quotationId: quotationId.toString() });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

const uploadDocument = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const { poType, documentType } = req.body;
    if (!poType || !documentType) {
      return res.status(400).json({ error: 'poType and documentType are required' });
    }

    // === PROCUREMENT type gating ===
    const userRoles = req.user?.roles || (req.user?.role ? [req.user.role] : []);
    if (poType !== 'SPARE_PART') {
      if (!userRoles.some(r => ['ADMIN', 'SERVICE', 'PROJECT', 'TFS'].includes(r)) && userRoles.includes('PROCUREMENT')) {
        return res.status(403).json({ error: 'Anda tidak memiliki izin mengupload dokumen PO selain Spare Part.' });
      }
    }

    const userId = req.user ? req.user.id : null;
    const fileUrl = `/uploads/po/${poType.toLowerCase().replace('_', '')}/${req.file.filename}`;
    
    const result = await poService.uploadDocumentPath(req.params.id, poType, documentType, fileUrl, userId);
    broadcast({ type: 'REFRESH_BADGE' });
    res.json({ success: true, fileUrl, updated: serializeJson(result) });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

const renameDocument = async (req, res) => {
  try {
    const { poType, documentType, oldFileUrl, newFileName } = req.body;
    if (!poType || !documentType || !oldFileUrl || !newFileName) {
      return res.status(400).json({ error: 'poType, documentType, oldFileUrl, and newFileName are required' });
    }

    const userId = req.user ? req.user.id : null;
    const result = await poService.renameDocumentFile(req.params.id, poType, documentType, oldFileUrl, newFileName, userId);
    broadcast({ type: 'REFRESH_BADGE' });
    res.json({ success: true, ...result });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

const deletePO = async (req, res) => {
  try {
    const userRoles = req.user?.roles || (req.user?.role ? [req.user.role] : []);

    // === PROCUREMENT type gating ===
    const existing = await poService.getPOById(req.params.id);
    if (existing) {
      const poType = existing.poType ||
        (existing.quotation?.inquiry?.requestType?.startsWith('SERVICE_') ? 'SERVICE' :
         existing.quotation?.inquiry?.requestType?.startsWith('PROJECT_') ? 'PROJECT' : 'SPARE_PART');
      if (poType !== 'SPARE_PART') {
        if (!userRoles.some(r => ['ADMIN', 'SERVICE', 'PROJECT', 'TFS'].includes(r)) && userRoles.includes('PROCUREMENT')) {
          return res.status(403).json({ error: 'Anda tidak memiliki izin menghapus PO selain Spare Part.' });
        }
      }
    }

    await poService.deletePO(req.params.id);
    broadcast({ type: 'REFRESH_BADGE' });
    res.status(204).send();
  } catch (error) {
    if (error.code === 'P2003') {
      return res.status(400).json({ 
        error: "Cannot delete Purchase Order because it has associated Deliveries or Invoices. Please delete the linked data first." 
      });
    }
    res.status(400).json({ error: error.message });
  }
};

const splitPO = async (req, res) => {
  try {
    const userId = req.user ? req.user.id : null;
    const userRoles = req.user?.roles || (req.user?.role ? [req.user.role] : []);
    const { detailIds, newPoNumber, remarks } = req.body;

    const existing = await poService.getPOById(req.params.id);
    if (!existing) {
      return res.status(404).json({ error: 'Purchase Order not found' });
    }

    const poType = existing.poType ||
      (existing.quotation?.inquiry?.requestType?.startsWith('SERVICE_') ? 'SERVICE' :
       existing.quotation?.inquiry?.requestType?.startsWith('PROJECT_') ? 'PROJECT' : 'SPARE_PART');
    if (poType !== 'SPARE_PART') {
      if (!userRoles.some(r => ['ADMIN', 'SERVICE', 'PROJECT', 'TFS'].includes(r)) && userRoles.includes('PROCUREMENT')) {
        return res.status(403).json({ error: 'Anda tidak memiliki izin memecah PO selain Spare Part.' });
      }
    }

    const result = await poService.splitPO(req.params.id, { detailIds, newPoNumber, remarks }, userId);
    broadcast({ type: 'REFRESH_BADGE' });
    res.json(result);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

module.exports = {
  getPOs,
  getPOById,
  createPOFromQuotation,
  createPOFromTFS,
  updatePO,
  splitPO,
  sendReminder,
  revertPOToQuotation,
  uploadDocument,
  renameDocument,
  deletePO
};
