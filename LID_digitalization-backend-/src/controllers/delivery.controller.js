const deliveryService = require('../services/delivery.service');
const { broadcast } = require('../utils/sseEmitter');

const serializeJson = (data) => {
  if (!data) return data;
  return JSON.parse(JSON.stringify(data, (k, v) => typeof v === 'bigint' ? v.toString() : v));
};

const getDeliveries = async (req, res) => {
  try {
    const data = await deliveryService.getDeliveries(req.query);
    res.json(serializeJson(data));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const getDeliveryById = async (req, res) => {
  try {
    const data = await deliveryService.getDeliveryById(req.params.id);
    if (!data) return res.status(404).json({ error: 'Delivery not found' });
    res.json(serializeJson(data));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const createDelivery = async (req, res) => {
  try {
    const userId = req.user ? req.user.id : null;
    const { poId, items } = req.body;
    if (!poId) return res.status(400).json({ error: 'poId is required' });
    const data = await deliveryService.createDelivery(poId, items || [], userId);
    broadcast({ type: 'REFRESH_BADGE' });
    res.status(201).json(serializeJson(data));
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

const updateDeliveryTracking = async (req, res) => {
  try {
    const userId = req.user ? req.user.id : null;
    const data = await deliveryService.updateDeliveryTracking(req.params.id, req.body, userId);
    broadcast({ type: 'REFRESH_BADGE' });
    res.json(serializeJson(data));
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

const updateDeliveryStatus = async (req, res) => {
  try {
    const userId = req.user ? req.user.id : null;
    const data = await deliveryService.updateDeliveryStatus(req.params.id, req.body, userId);
    broadcast({ type: 'REFRESH_BADGE' });
    res.json(serializeJson(data));
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

const triggerOverdueCheck = async (req, res) => {
  try {
    const results = await deliveryService.checkOverdueDeliveries();
    res.json({ success: true, processed: results.length, results });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const deleteDeliveryItem = async (req, res) => {
  try {
    const { id, itemId } = req.params;
    await deliveryService.deleteDeliveryItem(id, itemId);
    broadcast({ type: 'REFRESH_BADGE' });
    res.status(204).send();
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

const deleteDelivery = async (req, res) => {
  try {
    const { id } = req.params;
    await deliveryService.deleteDelivery(id);
    broadcast({ type: 'REFRESH_BADGE' });
    res.status(204).send();
  } catch (error) {
    if (error.code === 'P2003') {
      return res.status(400).json({ 
        error: "Cannot delete Delivery because it has been Invoiced. Please delete the linked Invoice first." 
      });
    }
    res.status(400).json({ error: error.message });
  }
};

const generateDeliveryNote = async (req, res) => {
  try {
    const { id } = req.params;
    const { deliveryMethod, shippingAddress, pic, clientPoNumber, packingList } = req.body;
    const pdfBuffer = await deliveryService.generateDeliveryNotePdf(id, { deliveryMethod, shippingAddress, pic, clientPoNumber, packingList });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="delivery-note-${id}.pdf"`);
    res.send(pdfBuffer);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const splitDelivery = async (req, res) => {
  try {
    const userId = req.user ? req.user.id : null;
    const { id } = req.params;
    const { deliveryItemIds, remarks } = req.body;
    const data = await deliveryService.splitDelivery(id, { deliveryItemIds, remarks }, userId);
    broadcast({ type: 'REFRESH_BADGE' });
    res.status(201).json(serializeJson(data));
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

module.exports = {
  getDeliveries,
  getDeliveryById,
  createDelivery,
  splitDelivery,
  updateDeliveryTracking,
  updateDeliveryStatus,
  triggerOverdueCheck,
  deleteDeliveryItem,
  deleteDelivery,
  generateDeliveryNote
};
