const invoiceService = require('../services/invoice.service');

const serializeBigInt = (data) => {
  if (data === null || data === undefined) return data;
  return JSON.parse(JSON.stringify(data, (k, v) => typeof v === 'bigint' ? v.toString() : v));
};

const getReadyToInvoiceList = async (req, res) => {
  try {
    const { year } = req.query;
    const list = await invoiceService.getReadyToInvoiceList(year);
    res.json(serializeBigInt(list));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const createInvoiceFromDelivery = async (req, res) => {
  try {
    const { deliveryId } = req.body;
    const userId = req.user?.id;
    if (!deliveryId) return res.status(400).json({ error: 'deliveryId is required' });
    
    const invoice = await invoiceService.createInvoiceFromDelivery(deliveryId, userId);
    res.status(201).json(serializeBigInt(invoice));
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

const createInvoiceFromPoDp = async (req, res) => {
  try {
    const { poId } = req.body;
    const userId = req.user?.id;
    if (!poId) return res.status(400).json({ error: 'poId is required' });
    
    const invoice = await invoiceService.createInvoiceFromPoDp(poId, userId);
    res.status(201).json(serializeBigInt(invoice));
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

const createInvoiceFromService = async (req, res) => {
  try {
    const { serviceId } = req.body;
    const userId = req.user?.id;
    if (!serviceId) return res.status(400).json({ error: 'serviceId is required' });
    
    const invoice = await invoiceService.createInvoiceFromService(serviceId, userId);
    res.status(201).json(serializeBigInt(invoice));
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

const createInvoiceFromProject = async (req, res) => {
  try {
    const { projectId, data } = req.body;
    const userId = req.user?.id;
    if (!projectId) return res.status(400).json({ error: 'projectId is required' });
    if (!data || !data.amount) return res.status(400).json({ error: 'amount is required in data' });
    
    const invoice = await invoiceService.createInvoiceFromProject(projectId, data, userId);
    res.status(201).json(serializeBigInt(invoice));
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

const updateInvoiceStatus = async (req, res) => {
  try {
    const { status, changeNote } = req.body;
    const userId = req.user?.id;
    
    if (!status) return res.status(400).json({ error: 'status is required' });
    
    const invoice = await invoiceService.updateInvoiceStatus(req.params.id, status, userId, changeNote);
    res.json(serializeBigInt(invoice));
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

const updateInvoiceData = async (req, res) => {
  try {
    const userId = req.user?.id;
    const updatePayload = { ...req.body };
    if (req.file) {
      updatePayload.attachmentUrl = `/uploads/invoices/${req.file.filename}`;
    }
    const invoice = await invoiceService.updateInvoiceData(req.params.id, updatePayload, userId);
    res.json(serializeBigInt(invoice));
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

const uploadExternalInvoice = async (req, res) => {
  try {
    const userId = req.user?.id;
    const fileUrl = req.file ? `/uploads/invoices/${req.file.filename}` : null;
    
    if (!fileUrl) {
      return res.status(400).json({ error: 'Invoice file is required' });
    }

    const invoice = await invoiceService.uploadExternalInvoice(req.params.id, req.body, fileUrl, userId);
    res.json(serializeBigInt(invoice));
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

const markAsPaid = async (req, res) => {
  try {
    const { changeNote } = req.body;
    const userId = req.user?.id;
    const paymentProofUrl = req.file ? `/uploads/payments/${req.file.filename}` : null;
    
    const invoice = await invoiceService.updateInvoiceStatus(req.params.id, 'PAID', userId, changeNote, paymentProofUrl);
    res.json(serializeBigInt(invoice));
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

const getInvoices = async (req, res) => {
  try {
    const { year } = req.query;
    const invoices = await invoiceService.getAllInvoices({ year });
    res.json(serializeBigInt(invoices));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const getInvoiceById = async (req, res) => {
  try {
    const invoice = await invoiceService.getInvoiceById(req.params.id);
    if (!invoice) return res.status(404).json({ error: 'Invoice not found' });
    res.json(serializeBigInt(invoice));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Legacy manual create - keep for IC/Project if they use it, or refactor later
const createInvoice = async (req, res) => {
  res.status(400).json({ error: 'Please use specific create endpoints like /from-delivery' });
};

const deleteInvoice = async (req, res) => {
  res.status(400).json({ error: 'Delete not supported in this phase' });
};

const deleteDraftInvoice = async (req, res) => {
  try {
    await invoiceService.deleteDraftInvoice(req.params.id);
    res.json({ success: true, message: 'Draft invoice berhasil dihapus (rollback).' });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

module.exports = {
  getReadyToInvoiceList,
  createInvoiceFromDelivery,
  createInvoiceFromPoDp,
  createInvoiceFromService,
  createInvoiceFromProject,
  updateInvoiceStatus,
  updateInvoiceData,
  uploadExternalInvoice,
  markAsPaid,
  getInvoices,
  getInvoiceById,
  createInvoice,
  deleteInvoice,
  deleteDraftInvoice
};
