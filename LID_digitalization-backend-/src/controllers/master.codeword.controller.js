const codeWordService = require('../services/master.codeword');

// ==========================================
// MASTER - CODEWORD
// ==========================================

const getCodeWords = async (req, res) => {
  try {
    const { active, search } = req.query;
    let where = {};
    if (active !== undefined) where.active = active === 'true';
    if (search) {
      where.OR = [
        { code: { contains: search, mode: 'insensitive' } },
        { projectNo: { contains: search, mode: 'insensitive' } },
        { millType: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }
    const data = await codeWordService.getCodeWords(where);
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const getCodeWordById = async (req, res) => {
  try {
    const data = await codeWordService.getCodeWordById(req.params.id);
    if (!data) return res.status(404).json({ error: 'Not found' });
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const createCodeWord = async (req, res) => {
  try {
    const data = await codeWordService.createCodeWord(req.body);
    res.status(201).json(data);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

const updateCodeWord = async (req, res) => {
  try {
    const data = await codeWordService.updateCodeWord(req.params.id, req.body);
    res.json(data);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

const deleteCodeWord = async (req, res) => {
  try {
    await codeWordService.deleteCodeWord(req.params.id);
    res.status(204).send();
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

module.exports = {
  getCodeWords,
  getCodeWordById,
  createCodeWord,
  updateCodeWord,
  deleteCodeWord,
};
