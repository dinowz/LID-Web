const prisma = require('../config/prisma');

// --- SERVICE CATEGORIES ---
const getServiceCategories = async (queryFilters) => {
  return await prisma.masterServiceCategory.findMany({ 
    where: queryFilters, 
    orderBy: { createdAt: 'desc' } 
  });
};

const getServiceCategoryById = async (id) => {
  return await prisma.masterServiceCategory.findUnique({ where: { id: BigInt(id) } });
};

const createServiceCategory = async (data) => {
  return await prisma.masterServiceCategory.create({ data });
};

const updateServiceCategory = async (id, data) => {
  return await prisma.masterServiceCategory.update({
    where: { id: BigInt(id) },
    data
  });
};

const deleteServiceCategory = async (id) => {
  return await prisma.masterServiceCategory.delete({ where: { id: BigInt(id) } });
};


// --- SERVICE ITEMS ---
const getServiceItems = async (queryFilters) => {
  return await prisma.masterServiceItem.findMany({ 
    where: queryFilters, 
    include: { category: true },
    orderBy: { createdAt: 'desc' } 
  });
};

const getServiceItemById = async (id) => {
  return await prisma.masterServiceItem.findUnique({ 
    where: { id: BigInt(id) },
    include: { category: true }
  });
};

const createServiceItem = async (data) => {
  return await prisma.masterServiceItem.create({ data });
};

const updateServiceItem = async (id, data) => {
  return await prisma.masterServiceItem.update({
    where: { id: BigInt(id) },
    data
  });
};

const deleteServiceItem = async (id) => {
  return await prisma.masterServiceItem.delete({ where: { id: BigInt(id) } });
};


// --- SPARE PART CATEGORIES ---
const getSparePartCategories = async (queryFilters) => {
  return await prisma.masterSparePartCategory.findMany({ 
    where: queryFilters, 
    orderBy: { createdAt: 'desc' } 
  });
};

const getSparePartCategoryById = async (id) => {
  return await prisma.masterSparePartCategory.findUnique({ where: { id: BigInt(id) } });
};

const createSparePartCategory = async (data) => {
  return await prisma.masterSparePartCategory.create({ data });
};

const updateSparePartCategory = async (id, data) => {
  return await prisma.masterSparePartCategory.update({
    where: { id: BigInt(id) },
    data
  });
};

const deleteSparePartCategory = async (id) => {
  return await prisma.masterSparePartCategory.delete({ where: { id: BigInt(id) } });
};


// --- SPARE PARTS ---
const getSpareParts = async (queryFilters) => {
  return await prisma.masterSparePart.findMany({ 
    where: queryFilters, 
    include: { category: true },
    orderBy: { createdAt: 'desc' } 
  });
};

const getSparePartById = async (id) => {
  return await prisma.masterSparePart.findUnique({ 
    where: { id: BigInt(id) },
    include: { category: true }
  });
};

const createSparePart = async (data) => {
  return await prisma.masterSparePart.create({ data });
};

const updateSparePart = async (id, data) => {
  return await prisma.masterSparePart.update({
    where: { id: BigInt(id) },
    data
  });
};

const deleteSparePart = async (id) => {
  return await prisma.masterSparePart.delete({ where: { id: BigInt(id) } });
};

// --- MASTER DIVISIONS ---
const getMasterDivisions = async (queryFilters) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const data = await prisma.masterDivision.findMany({ 
    where: queryFilters, 
    include: {
      // Ambil tugas yang aktif hari ini
      tfsAssignments: {
        where: {
          startDate: { lte: today },
          endDate: { gte: today },
          status: { notIn: ['CANCELLED', 'DONE'] }
        },
        include: {
          serviceExecution: {
            select: { serviceNumber: true }
          }
        }
      }
    },
    orderBy: { createdAt: 'desc' } 
  });

  // Petakan data untuk meng-override field isIdle database dengan hasil hitung riil
  return data.map(item => ({
    ...item,
    isIdle: item.tfsAssignments.length === 0,
    currentAssignment: item.tfsAssignments.length > 0 ? item.tfsAssignments[0] : null
  }));
};

const getMasterDivisionById = async (id) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const item = await prisma.masterDivision.findUnique({ 
    where: { id: BigInt(id) },
    include: {
      tfsAssignments: {
        where: {
          startDate: { lte: today },
          endDate: { gte: today },
          status: { notIn: ['CANCELLED', 'DONE'] }
        },
        include: {
          serviceExecution: {
            select: { serviceNumber: true }
          }
        }
      }
    }
  });

  if (!item) return null;

  return {
    ...item,
    isIdle: item.tfsAssignments.length === 0,
    currentAssignment: item.tfsAssignments.length > 0 ? item.tfsAssignments[0] : null
  };
};

const createMasterDivision = async (data) => {
  return await prisma.masterDivision.create({ data });
};

const updateMasterDivision = async (id, data) => {
  return await prisma.masterDivision.update({
    where: { id: BigInt(id) },
    data
  });
};

const deleteMasterDivision = async (id) => {
  return await prisma.masterDivision.delete({ where: { id: BigInt(id) } });
};

// --- VENDORS ---
const getVendors = async (queryFilters) => {
  return await prisma.vendor.findMany({
    where: queryFilters,
    orderBy: { createdAt: 'desc' }
  });
};

const getVendorById = async (id) => {
  return await prisma.vendor.findUnique({ where: { id: Number(id) } });
};

const createVendor = async (data) => {
  return await prisma.vendor.create({ data });
};

const updateVendor = async (id, data) => {
  return await prisma.vendor.update({
    where: { id: Number(id) },
    data
  });
};

const deleteVendor = async (id) => {
  return await prisma.vendor.delete({ where: { id: Number(id) } });
};

module.exports = {
  getServiceCategories, getServiceCategoryById, createServiceCategory, updateServiceCategory, deleteServiceCategory,
  getServiceItems, getServiceItemById, createServiceItem, updateServiceItem, deleteServiceItem,
  getSparePartCategories, getSparePartCategoryById, createSparePartCategory, updateSparePartCategory, deleteSparePartCategory,
  getSpareParts, getSparePartById, createSparePart, updateSparePart, deleteSparePart,
  getMasterDivisions, getMasterDivisionById, createMasterDivision, updateMasterDivision, deleteMasterDivision,
  getVendors, getVendorById, createVendor, updateVendor, deleteVendor,
};
