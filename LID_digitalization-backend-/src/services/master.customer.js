const prisma = require('../config/prisma');

// --- CUSTOMERS ---

const getCustomers = async (queryFilters) => {
  return await prisma.customer.findMany({
    where: queryFilters,
    orderBy: { createdAt: 'desc' },
  });
};

const getCustomerById = async (id) => {
  return await prisma.customer.findUnique({ where: { id: Number(id) } });
};

const createCustomer = async (data) => {
  return await prisma.customer.create({ data });
};

const updateCustomer = async (id, data) => {
  return await prisma.customer.update({
    where: { id: Number(id) },
    data,
  });
};

const deleteCustomer = async (id) => {
  return await prisma.customer.delete({ where: { id: Number(id) } });
};

module.exports = {
  getCustomers,
  getCustomerById,
  createCustomer,
  updateCustomer,
  deleteCustomer,
};
