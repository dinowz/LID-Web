const express = require('express');
const router = express.Router();
const masterController = require('../controllers/master.controller');
const customerController = require('../controllers/master.customer.controller');
const codeWordController = require('../controllers/master.codeword.controller');
const forwarderController = require('../controllers/master.forwarder.controller');
const { verifyToken, verifyRole } = require('../middlewares/auth.middleware');
const requireAdmin = require('../middlewares/requireAdmin');

// In a real application, you might also have verifyAdmin middleware here
router.use(verifyToken);

// Service Categories
router.get('/service-categories', masterController.getServiceCategories);
router.get('/service-categories/:id', masterController.getServiceCategoryById);
router.post('/service-categories', requireAdmin, masterController.createServiceCategory);
router.put('/service-categories/:id', requireAdmin, masterController.updateServiceCategory);
router.delete('/service-categories/:id', requireAdmin, masterController.deleteServiceCategory);

// Service Items
router.get('/services', masterController.getServiceItems);
router.get('/services/:id', masterController.getServiceItemById);
router.post('/services', requireAdmin, masterController.createServiceItem);
router.put('/services/:id', requireAdmin, masterController.updateServiceItem);
router.delete('/services/:id', requireAdmin, masterController.deleteServiceItem);

// Spare Part Categories
router.get('/spare-part-categories', masterController.getSparePartCategories);
router.get('/spare-part-categories/:id', masterController.getSparePartCategoryById);
router.post('/spare-part-categories', requireAdmin, masterController.createSparePartCategory);
router.put('/spare-part-categories/:id', requireAdmin, masterController.updateSparePartCategory);
router.delete('/spare-part-categories/:id', requireAdmin, masterController.deleteSparePartCategory);

// Spare Parts
router.get('/spare-parts', masterController.getSpareParts);
router.get('/spare-parts/:id', masterController.getSparePartById);
router.post('/spare-parts', verifyRole(['ADMIN', 'SPARE_PART', 'PROCUREMENT']), masterController.createSparePart);
router.put('/spare-parts/:id', requireAdmin, masterController.updateSparePart);
router.delete('/spare-parts/:id', requireAdmin, masterController.deleteSparePart);

// Customers
router.get('/customers', customerController.getCustomers);
router.get('/customers/:id', customerController.getCustomerById);
router.post('/customers', requireAdmin, customerController.createCustomer);
router.put('/customers/:id', requireAdmin, customerController.updateCustomer);
router.delete('/customers/:id', requireAdmin, customerController.deleteCustomer);

// CodeWords
router.get('/codewords', codeWordController.getCodeWords);
router.get('/codewords/:id', codeWordController.getCodeWordById);
router.post('/codewords', requireAdmin, codeWordController.createCodeWord);
router.put('/codewords/:id', requireAdmin, codeWordController.updateCodeWord);
router.delete('/codewords/:id', requireAdmin, codeWordController.deleteCodeWord);

// Divisions
router.get('/divisions', masterController.getMasterDivisions);
router.get('/divisions/:id', masterController.getMasterDivisionById);
router.post('/divisions', requireAdmin, masterController.createMasterDivision);
router.put('/divisions/:id', requireAdmin, masterController.updateMasterDivision);
router.delete('/divisions/:id', requireAdmin, masterController.deleteMasterDivision);

// Vendors
router.get('/vendors', masterController.getVendors);
router.get('/vendors/:id', masterController.getVendorById);
router.post('/vendors', requireAdmin, masterController.createVendor);
router.put('/vendors/:id', requireAdmin, masterController.updateVendor);
router.delete('/vendors/:id', requireAdmin, masterController.deleteVendor);

// Forwarders
router.get('/forwarders', forwarderController.getForwarders);
router.get('/forwarders/:id', forwarderController.getForwarderById);
router.post('/forwarders', requireAdmin, forwarderController.createForwarder);
router.put('/forwarders/:id', requireAdmin, forwarderController.updateForwarder);
router.delete('/forwarders/:id', requireAdmin, forwarderController.deleteForwarder);

module.exports = router;

