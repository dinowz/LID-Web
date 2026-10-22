const masterService = require('../services/master.service');

// ==========================================
// MASTER - SERVICE CATEGORY
// ==========================================

const getServiceCategories = async (req, res) => {
  try {
    const { active, search } = req.query;
    let where = {};
    if (active !== undefined) where.active = active === 'true';
    if (search) {
      where.OR = [
        { categoryCode: { contains: search, mode: 'insensitive' } },
        { categoryName: { contains: search, mode: 'insensitive' } }
      ];
    }
    const data = await masterService.getServiceCategories(where);
    
    // Serialize BigInts
    const serialized = data.map(item => ({ ...item, id: item.id.toString() }));
    res.json(serialized);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const getServiceCategoryById = async (req, res) => {
  try {
    const data = await masterService.getServiceCategoryById(req.params.id);
    if (!data) return res.status(404).json({ error: 'Not found' });
    res.json({ ...data, id: data.id.toString() });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const createServiceCategory = async (req, res) => {
  try {
    const data = await masterService.createServiceCategory(req.body);
    res.status(201).json({ ...data, id: data.id.toString() });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

const updateServiceCategory = async (req, res) => {
  try {
    const data = await masterService.updateServiceCategory(req.params.id, req.body);
    res.json({ ...data, id: data.id.toString() });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

const deleteServiceCategory = async (req, res) => {
  try {
    await masterService.deleteServiceCategory(req.params.id);
    res.status(204).send();
  } catch (error) {
    if (error.code === 'P2003') {
      return res.status(400).json({ error: 'Data tidak bisa dihapus karena telah digunakan dalam transaksi terkait. Silakan gunakan status Inactive.' });
    }
    res.status(400).json({ error: error.message });
  }
};

// ==========================================
// MASTER - SERVICE ITEM
// ==========================================

const getServiceItems = async (req, res) => {
  try {
    const { active, search, categoryId } = req.query;
    let where = {};
    if (active !== undefined) where.active = active === 'true';
    if (categoryId) where.categoryId = BigInt(categoryId);
    if (search) {
      where.OR = [
        { serviceCode: { contains: search, mode: 'insensitive' } },
        { serviceName: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } }
      ];
    }
    const data = await masterService.getServiceItems(where);
    
    const serialized = data.map(item => ({
      ...item, 
      id: item.id.toString(), 
      categoryId: item.categoryId.toString(),
      standardPrice: item.standardPrice ? item.standardPrice.toString() : 0,
      estimatedPrice: item.estimatedPrice ? item.estimatedPrice.toString() : 0,
      category: item.category ? { ...item.category, id: item.category.id.toString() } : null
    }));
    res.json(serialized);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const getServiceItemById = async (req, res) => {
  try {
    const data = await masterService.getServiceItemById(req.params.id);
    if (!data) return res.status(404).json({ error: 'Not found' });
    res.json({ 
      ...data, 
      id: data.id.toString(), 
      categoryId: data.categoryId.toString(),
      standardPrice: data.standardPrice ? data.standardPrice.toString() : 0,
      estimatedPrice: data.estimatedPrice ? data.estimatedPrice.toString() : 0,
      category: data.category ? { ...data.category, id: data.category.id.toString() } : null
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const createServiceItem = async (req, res) => {
  try {
    const payload = { ...req.body };
    if (payload.categoryId) payload.categoryId = BigInt(payload.categoryId);
    
    const data = await masterService.createServiceItem(payload);
    res.status(201).json({ ...data, id: data.id.toString(), categoryId: data.categoryId.toString() });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

const updateServiceItem = async (req, res) => {
  try {
    const payload = { ...req.body };
    if (payload.categoryId) payload.categoryId = BigInt(payload.categoryId);

    const data = await masterService.updateServiceItem(req.params.id, payload);
    res.json({ ...data, id: data.id.toString(), categoryId: data.categoryId.toString() });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

const deleteServiceItem = async (req, res) => {
  try {
    await masterService.deleteServiceItem(req.params.id);
    res.status(204).send();
  } catch (error) {
    if (error.code === 'P2003') {
      return res.status(400).json({ error: 'Data tidak bisa dihapus karena telah digunakan dalam transaksi terkait. Silakan gunakan status Inactive.' });
    }
    res.status(400).json({ error: error.message });
  }
};

// ==========================================
// MASTER - SPARE PART CATEGORY
// ==========================================

const getSparePartCategories = async (req, res) => {
  try {
    const { active, search } = req.query;
    let where = {};
    if (active !== undefined) where.active = active === 'true';
    if (search) {
      where.OR = [
        { categoryCode: { contains: search, mode: 'insensitive' } },
        { categoryName: { contains: search, mode: 'insensitive' } }
      ];
    }
    const data = await masterService.getSparePartCategories(where);
    
    const serialized = data.map(item => ({ ...item, id: item.id.toString() }));
    res.json(serialized);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const getSparePartCategoryById = async (req, res) => {
  try {
    const data = await masterService.getSparePartCategoryById(req.params.id);
    if (!data) return res.status(404).json({ error: 'Not found' });
    res.json({ ...data, id: data.id.toString() });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const createSparePartCategory = async (req, res) => {
  try {
    const data = await masterService.createSparePartCategory(req.body);
    res.status(201).json({ ...data, id: data.id.toString() });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

const updateSparePartCategory = async (req, res) => {
  try {
    const data = await masterService.updateSparePartCategory(req.params.id, req.body);
    res.json({ ...data, id: data.id.toString() });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

const deleteSparePartCategory = async (req, res) => {
  try {
    await masterService.deleteSparePartCategory(req.params.id);
    res.status(204).send();
  } catch (error) {
    if (error.code === 'P2003') {
      return res.status(400).json({ error: 'Data tidak bisa dihapus karena telah digunakan dalam transaksi terkait. Silakan gunakan status Inactive.' });
    }
    res.status(400).json({ error: error.message });
  }
};

// ==========================================
// MASTER - SPARE PART ITEM
// ==========================================

const getSpareParts = async (req, res) => {
  try {
    const { active, search, categoryId } = req.query;
    let where = {};
    if (active !== undefined) where.active = active === 'true';
    if (categoryId) where.categoryId = BigInt(categoryId);
    if (search) {
      where.OR = [
        { partCode: { contains: search, mode: 'insensitive' } },
        { partName: { contains: search, mode: 'insensitive' } },
        { brand: { contains: search, mode: 'insensitive' } }
      ];
    }
    const data = await masterService.getSpareParts(where);
    
    const serialized = data.map(item => ({
      ...item, 
      id: item.id.toString(), 
      categoryId: item.categoryId.toString(),
      standardPrice: item.standardPrice ? item.standardPrice.toString() : 0,
      stockQty: item.stockQty ? item.stockQty.toString() : 0,
      minStock: item.minStock ? item.minStock.toString() : 0,
      weightKg: item.weightKg ? item.weightKg.toString() : null,
      category: item.category ? { ...item.category, id: item.category.id.toString() } : null
    }));
    res.json(serialized);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const getSparePartById = async (req, res) => {
  try {
    const data = await masterService.getSparePartById(req.params.id);
    if (!data) return res.status(404).json({ error: 'Not found' });
    res.json({
      ...data, 
      id: data.id.toString(), 
      categoryId: data.categoryId.toString(),
      standardPrice: data.standardPrice ? data.standardPrice.toString() : 0,
      stockQty: data.stockQty ? data.stockQty.toString() : 0,
      minStock: data.minStock ? data.minStock.toString() : 0,
      weightKg: data.weightKg ? data.weightKg.toString() : null,
      category: data.category ? { ...data.category, id: data.category.id.toString() } : null
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const createSparePart = async (req, res) => {
  try {
    const payload = { ...req.body };
    if (payload.partCode) payload.partCode = payload.partCode.trim();
    if (payload.partName) payload.partName = payload.partName.trim();
    if (payload.categoryId) payload.categoryId = BigInt(payload.categoryId);

    const data = await masterService.createSparePart(payload);
    res.status(201).json({ ...data, id: data.id.toString(), categoryId: data.categoryId.toString() });
  } catch (error) {
    if (error.code === 'P2002') {
      return res.status(400).json({ 
        error: `Part Number (MatNr) "${req.body.partCode}" sudah terdaftar di Master Data Sparepart.` 
      });
    }
    res.status(400).json({ error: error.message });
  }
};

const updateSparePart = async (req, res) => {
  try {
    const payload = { ...req.body };
    if (payload.categoryId) payload.categoryId = BigInt(payload.categoryId);

    const data = await masterService.updateSparePart(req.params.id, payload);
    res.json({ ...data, id: data.id.toString(), categoryId: data.categoryId.toString() });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

const deleteSparePart = async (req, res) => {
  try {
    await masterService.deleteSparePart(req.params.id);
    res.status(204).send();
  } catch (error) {
    if (error.code === 'P2003') {
      return res.status(400).json({ error: 'Data tidak bisa dihapus karena telah digunakan dalam transaksi terkait. Silakan gunakan status Inactive.' });
    }
    res.status(400).json({ error: error.message });
  }
};

// ==========================================
// MASTER - DIVISION (PERSONNEL)
// ==========================================

const getMasterDivisions = async (req, res) => {
  try {
    const { active, search } = req.query;
    let where = {};
    if (active !== undefined) where.active = active === 'true';
    if (search) {
      where.OR = [
        { personnel_code: { contains: search, mode: 'insensitive' } },
        { name: { contains: search, mode: 'insensitive' } },
        { title: { contains: search, mode: 'insensitive' } },
        { division: { contains: search, mode: 'insensitive' } }
      ];
    }
    const data = await masterService.getMasterDivisions(where);
    
    const serialized = data.map(item => ({
      ...item, 
      id: item.id.toString(),
      currentAssignment: item.currentAssignment ? {
        ...item.currentAssignment,
        id: item.currentAssignment.id.toString(),
        serviceExecutionId: item.currentAssignment.serviceExecutionId ? item.currentAssignment.serviceExecutionId.toString() : null,
        personnelId: item.currentAssignment.personnelId ? item.currentAssignment.personnelId.toString() : null
      } : null
    }));
    res.json(serialized);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const getMasterDivisionById = async (req, res) => {
  try {
    const data = await masterService.getMasterDivisionById(req.params.id);
    if (!data) return res.status(404).json({ error: 'Not found' });
    res.json({
      ...data, 
      id: data.id.toString(),
      currentAssignment: data.currentAssignment ? {
        ...data.currentAssignment,
        id: data.currentAssignment.id.toString(),
        serviceExecutionId: data.currentAssignment.serviceExecutionId ? data.currentAssignment.serviceExecutionId.toString() : null,
        personnelId: data.currentAssignment.personnelId ? data.currentAssignment.personnelId.toString() : null
      } : null
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const createMasterDivision = async (req, res) => {
  try {
    const data = await masterService.createMasterDivision(req.body);
    res.status(201).json({ 
      ...data, 
      id: data.id.toString()
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

const updateMasterDivision = async (req, res) => {
  try {
    const data = await masterService.updateMasterDivision(req.params.id, req.body);
    res.json({ 
      ...data, 
      id: data.id.toString()
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

const deleteMasterDivision = async (req, res) => {
  try {
    await masterService.deleteMasterDivision(req.params.id);
    res.status(204).send();
  } catch (error) {
    if (error.code === 'P2003') {
      return res.status(400).json({ error: 'Data tidak bisa dihapus karena telah digunakan dalam transaksi terkait. Silakan gunakan status Inactive.' });
    }
    res.status(400).json({ error: error.message });
  }
};

// ==========================================
// MASTER - VENDOR
// ==========================================

const getVendors = async (req, res) => {
  try {
    const { active, search } = req.query;
    let where = {};
    if (active !== undefined) where.active = active === 'true';
    if (search) {
      where.OR = [
        { vendorCode: { contains: search, mode: 'insensitive' } },
        { vendorName: { contains: search, mode: 'insensitive' } },
        { contactPerson: { contains: search, mode: 'insensitive' } },
        { country: { contains: search, mode: 'insensitive' } },
      ];
    }
    const data = await masterService.getVendors(where);
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const getVendorById = async (req, res) => {
  try {
    const data = await masterService.getVendorById(req.params.id);
    if (!data) return res.status(404).json({ error: 'Not found' });
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const createVendor = async (req, res) => {
  try {
    const data = await masterService.createVendor(req.body);
    res.status(201).json(data);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

const updateVendor = async (req, res) => {
  try {
    const data = await masterService.updateVendor(req.params.id, req.body);
    res.json(data);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

const deleteVendor = async (req, res) => {
  try {
    await masterService.deleteVendor(req.params.id);
    res.status(204).send();
  } catch (error) {
    if (error.code === 'P2003') {
      return res.status(400).json({ error: 'Data tidak bisa dihapus karena telah digunakan dalam transaksi terkait. Silakan gunakan status Inactive.' });
    }
    res.status(400).json({ error: error.message });
  }
};

module.exports = {
  getServiceCategories, getServiceCategoryById, createServiceCategory, updateServiceCategory, deleteServiceCategory,
  getServiceItems, getServiceItemById, createServiceItem, updateServiceItem, deleteServiceItem,
  getSparePartCategories, getSparePartCategoryById, createSparePartCategory, updateSparePartCategory, deleteSparePartCategory,
  getSpareParts, getSparePartById, createSparePart, updateSparePart, deleteSparePart,
  getMasterDivisions, getMasterDivisionById, createMasterDivision, updateMasterDivision, deleteMasterDivision,
  getVendors, getVendorById, createVendor, updateVendor, deleteVendor,
};
