const prisma = require('../config/prisma');

// --- CODEWORDS ---

const getCodeWords = async (queryFilters) => {
  return await prisma.codeWord.findMany({
    where: queryFilters,
    orderBy: { createdAt: 'desc' },
  });
};

const getCodeWordById = async (id) => {
  return await prisma.codeWord.findUnique({ where: { id: Number(id) } });
};

const createCodeWord = async (data) => {
  return await prisma.codeWord.create({ data });
};

const updateCodeWord = async (id, data) => {
  return await prisma.codeWord.update({
    where: { id: Number(id) },
    data,
  });
};

const deleteCodeWord = async (id) => {
  return await prisma.codeWord.delete({ where: { id: Number(id) } });
};

module.exports = {
  getCodeWords,
  getCodeWordById,
  createCodeWord,
  updateCodeWord,
  deleteCodeWord,
};
