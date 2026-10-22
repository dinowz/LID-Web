const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const getForwarders = async (req, res) => {
  try {
    const forwarders = await prisma.forwarder.findMany({
      orderBy: { name: 'asc' },
      include: {
        creator: { select: { name: true } },
        updater: { select: { name: true } }
      }
    });
    res.json(forwarders);
  } catch (error) {
    console.error('Error fetching forwarders:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

const getForwarderById = async (req, res) => {
  try {
    const { id } = req.params;
    const forwarder = await prisma.forwarder.findUnique({
      where: { id: parseInt(id) },
      include: {
        creator: { select: { name: true } },
        updater: { select: { name: true } }
      }
    });
    if (!forwarder) return res.status(404).json({ message: 'Forwarder not found' });
    res.json(forwarder);
  } catch (error) {
    console.error('Error fetching forwarder:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

const createForwarder = async (req, res) => {
  try {
    const { name, supplierNumber, country, email, phone, active } = req.body;
    const userId = req.user.id;

    const forwarder = await prisma.forwarder.create({
      data: {
        name,
        supplierNumber,
        country,
        email,
        phone,
        active: active !== undefined ? active : true,
        createdBy: userId,
        updatedBy: userId
      }
    });
    res.status(201).json(forwarder);
  } catch (error) {
    console.error('Error creating forwarder:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

const updateForwarder = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, supplierNumber, country, email, phone, active } = req.body;
    const userId = req.user.id;

    const forwarder = await prisma.forwarder.update({
      where: { id: parseInt(id) },
      data: {
        name,
        supplierNumber,
        country,
        email,
        phone,
        active,
        updatedBy: userId,
        updatedAt: new Date()
      }
    });
    res.json(forwarder);
  } catch (error) {
    console.error('Error updating forwarder:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

const deleteForwarder = async (req, res) => {
  try {
    const { id } = req.params;
    await prisma.forwarder.delete({
      where: { id: parseInt(id) }
    });
    res.json({ message: 'Forwarder deleted successfully' });
  } catch (error) {
    console.error('Error deleting forwarder:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

module.exports = {
  getForwarders,
  getForwarderById,
  createForwarder,
  updateForwarder,
  deleteForwarder
};
