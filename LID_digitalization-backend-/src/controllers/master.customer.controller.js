const customerService = require('../services/master.customer');

// ==========================================
// MASTER - CUSTOMER
// ==========================================

const getCustomers = async (req, res) => {
  try {
    const { search } = req.query;
    let where = {};
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search, mode: 'insensitive' } },
      ];
    }
    const data = await customerService.getCustomers(where);
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const getCustomerById = async (req, res) => {
  try {
    const data = await customerService.getCustomerById(req.params.id);
    if (!data) return res.status(404).json({ error: 'Not found' });
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const createCustomer = async (req, res) => {
  try {
    const data = await customerService.createCustomer(req.body);
    res.status(201).json(data);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

const updateCustomer = async (req, res) => {
  try {
    const data = await customerService.updateCustomer(req.params.id, req.body);
    res.json(data);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

const deleteCustomer = async (req, res) => {
  try {
    await customerService.deleteCustomer(req.params.id);
    res.status(204).send();
  } catch (error) {
    if (error.code === 'P2003') {
      return res.status(400).json({ error: 'Data tidak bisa dihapus karena telah digunakan dalam transaksi terkait. Silakan gunakan status Inactive.' });
    }
    res.status(400).json({ error: error.message });
  }
};

module.exports = {
  getCustomers,
  getCustomerById,
  createCustomer,
  updateCustomer,
  deleteCustomer,
};
