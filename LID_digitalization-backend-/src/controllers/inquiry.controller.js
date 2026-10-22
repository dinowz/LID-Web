const inquiryService = require('../services/inquiry.service');
const { generateInquiryExcel } = require('../services/excel.service');
const prisma = require('../config/prisma');
const { broadcast } = require('../utils/sseEmitter');

const getInquiryStatuses = async (req, res) => {
  try {
    const data = await inquiryService.getInquiryStatuses();
    const serialized = data.map(item => ({ ...item, id: item.id.toString() }));
    res.json(serialized);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const getInquirySources = async (req, res) => {
  try {
    const data = await inquiryService.getInquirySources();
    const serialized = data.map(item => ({ ...item, id: item.id.toString() }));
    res.json(serialized);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const getCustomers = async (req, res) => {
  try {
    const { search } = req.query;
    const where = search
      ? {
        OR: [
          { name: { contains: search, mode: 'insensitive' } },
          { email: { contains: search, mode: 'insensitive' } },
        ]
      }
      : {};
    const data = await prisma.customer.findMany({ where, orderBy: { name: 'asc' } });
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const getCodeWords = async (req, res) => {
  try {
    const data = await prisma.codeWord.findMany({
      where: { active: true },
      orderBy: { code: 'asc' }
    });
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const getInquiries = async (req, res) => {
  try {
    const { statusCode, requestType, customerId, search, requestModule, year } = req.query;
    let filters = {};

    if (statusCode) filters.statusCode = statusCode;
    if (requestType) filters.requestType = requestType;
    if (requestModule) {
      filters.requestType = { startsWith: requestModule };
    }
    if (customerId) filters.customerId = Number(customerId);
    if (year) filters.year = Number(year);
    if (search) {
      filters.OR = [
        { subject: { contains: search, mode: 'insensitive' } },
        { inquiryNumber: { contains: search, mode: 'insensitive' } },
        { customer: { name: { contains: search, mode: 'insensitive' } } },
      ];
    }

    const data = await inquiryService.getInquiries(filters);

    // BigInt serialization for id only
    const serialized = data.map(item => ({
      ...item,
      id: item.id.toString(),
      creator: item.creator ? { ...item.creator } : null,
      updater: item.updater ? { ...item.updater } : null,
    }));

    res.json(serialized);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const getInquiryById = async (req, res) => {
  try {
    const data = await inquiryService.getInquiryById(req.params.id);
    if (!data) return res.status(404).json({ error: 'Inquiry not found' });

    res.json(serializeInquiryWithDetails(data));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const createInquiry = async (req, res) => {
  try {
    const userId = req.user ? req.user.id : null;
    const userRoles = req.user?.roles || (req.user?.role ? [req.user.role] : []);
    const { requestType } = req.body;

    // === Role-based type gating ===
    if (requestType) {
      if (requestType.startsWith('SPARE_PART') && !userRoles.some(r => ['ADMIN', 'SPARE_PART', 'TFS', 'SERVICE', 'PROJECT'].includes(r))) {
        return res.status(403).json({ error: 'Anda tidak memiliki izin membuat Spare Part Inquiry.' });
      }
      if (requestType.startsWith('SERVICE_') && !userRoles.some(r => ['ADMIN', 'SERVICE', 'TFS', 'SPARE_PART', 'PROJECT'].includes(r))) {
        return res.status(403).json({ error: 'Anda tidak memiliki izin membuat Service Inquiry.' });
      }
      if (requestType.startsWith('PROJECT_') && !userRoles.some(r => ['ADMIN', 'PROJECT', 'TFS', 'SPARE_PART', 'SERVICE'].includes(r))) {
        return res.status(403).json({ error: 'Anda tidak memiliki izin membuat Project Inquiry.' });
      }
    }

    const data = await inquiryService.createInquiry(req.body, userId);
    broadcast({ type: 'REFRESH_BADGE' });
    res.status(201).json(serializeInquiryWithDetails(data));
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

const updateInquiry = async (req, res) => {
  try {
    const userId = req.user ? req.user.id : null;
    const userRoles = req.user?.roles || (req.user?.role ? [req.user.role] : []);

    // === Role-based type gating ===
    const existing = await inquiryService.getInquiryById(req.params.id);
    if (existing) {
      if (existing.requestType.startsWith('SPARE_PART') && !userRoles.some(r => ['ADMIN', 'SPARE_PART', 'TFS', 'SERVICE', 'PROJECT'].includes(r))) {
        return res.status(403).json({ error: 'Anda tidak memiliki izin mengedit Spare Part Inquiry.' });
      }
      if (existing.requestType.startsWith('SERVICE_') && !userRoles.some(r => ['ADMIN', 'SERVICE', 'TFS', 'SPARE_PART', 'PROJECT'].includes(r))) {
        return res.status(403).json({ error: 'Anda tidak memiliki izin mengedit Service Inquiry.' });
      }
    }

    const data = await inquiryService.updateInquiry(req.params.id, req.body, userId);
    broadcast({ type: 'REFRESH_BADGE' });
    res.json(serializeInquiryWithDetails(data));
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

const deleteInquiry = async (req, res) => {
  try {
    const userRoles = req.user?.roles || (req.user?.role ? [req.user.role] : []);

    // === Role-based type gating ===
    const existing = await inquiryService.getInquiryById(req.params.id);
    if (existing) {
      if (existing.requestType.startsWith('SPARE_PART') && !userRoles.some(r => ['ADMIN', 'SPARE_PART'].includes(r))) {
        return res.status(403).json({ error: 'Anda tidak memiliki izin menghapus Spare Part Inquiry.' });
      }
      if (existing.requestType.startsWith('SERVICE_') && !userRoles.some(r => ['ADMIN', 'SERVICE'].includes(r))) {
        return res.status(403).json({ error: 'Anda tidak memiliki izin menghapus Service Inquiry.' });
      }
    }

    await inquiryService.deleteInquiry(req.params.id);
    broadcast({ type: 'REFRESH_BADGE' });
    res.status(204).send();
  } catch (error) {
    if (error.code === 'P2003') {
      return res.status(400).json({
        error: "Cannot delete Inquiry because it is already linked to a Quotation. Please delete the Quotation first."
      });
    }
    res.status(400).json({ error: error.message });
  }
};

const updateInquiryStatus = async (req, res) => {
  try {
    const { newStatusCode, changeNote } = req.body;
    const userId = req.user ? req.user.id : null;
    const userRoles = req.user?.roles || (req.user?.role ? [req.user.role] : []);

    if (!newStatusCode) return res.status(400).json({ error: 'newStatusCode is required' });

    // === Role-based type gating ===
    const existing = await inquiryService.getInquiryById(req.params.id);
    if (existing) {
      if (existing.requestType.startsWith('SPARE_PART') && !userRoles.some(r => ['ADMIN', 'SPARE_PART'].includes(r))) {
        return res.status(403).json({ error: 'Anda tidak memiliki izin mengubah status Spare Part Inquiry.' });
      }
      if (existing.requestType.startsWith('SERVICE_') && !userRoles.some(r => ['ADMIN', 'SERVICE'].includes(r))) {
        return res.status(403).json({ error: 'Anda tidak memiliki izin mengubah status Service Inquiry.' });
      }
    }

    const data = await inquiryService.updateInquiryStatus(req.params.id, newStatusCode, changeNote, userId);
    broadcast({ type: 'REFRESH_BADGE' });
    res.json(serializeInquiryWithDetails(data));
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};


const exportInquiryExcel = async (req, res) => {
  try {
    const { buffer, filename } = await generateInquiryExcel(req.params.id);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buffer);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Helper to sanitize BigInts for JSON
const serializeInquiryWithDetails = (item) => {
  if (!item) return item;

  const serialized = {
    ...item,
    id: item.id.toString(),
  };

  // customer & codeWord use Int id — no BigInt conversion needed
  if (item.customer) serialized.customer = { ...item.customer };
  if (item.codeWord) serialized.codeWord = { ...item.codeWord };
  if (item.creator) serialized.creator = { ...item.creator };
  if (item.updater) serialized.updater = { ...item.updater };

  if (item.details) {
    serialized.details = item.details.map(d => ({
      ...d,
      id: d.id.toString(),
      inquiryId: d.inquiryId.toString(),
    }));
  }

  if (item.histories) {
    serialized.histories = item.histories.map(h => ({
      ...h,
      id: h.id.toString(),
      inquiryId: h.inquiryId.toString(),
    }));
  }

  return serialized;
};

module.exports = {
  getInquiryStatuses,
  getInquirySources,
  getCustomers,
  getCodeWords,
  getInquiries,
  getInquiryById,
  createInquiry,
  updateInquiry,
  deleteInquiry,
  updateInquiryStatus,
  exportInquiryExcel
};
