const targetService = require('../services/target.service');

const getAll = async (req, res) => {
  try {
    const targets = await targetService.getTargets();
    res.json(targets);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const getByYear = async (req, res) => {
  try {
    const year = parseInt(req.params.year);
    const target = await targetService.getTargetByYear(year);
    if (!target) return res.status(404).json({ error: 'Target not found for this year' });
    res.json(target);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const upsert = async (req, res) => {
  try {
    const { year, target, targetSparepart, targetService: targetServiceVal, targetProject, exchangeRateUsd, exchangeRateEur, roleTargets } = req.body;
    if (!year) return res.status(400).json({ error: 'Year is required' });
    const result = await targetService.upsertTarget({
      year: parseInt(year),
      target: parseFloat(target) || 0,
      targetSparepart: targetSparepart !== undefined ? parseFloat(targetSparepart) : 0,
      targetService: targetServiceVal !== undefined ? parseFloat(targetServiceVal) : 0,
      targetProject: targetProject !== undefined ? parseFloat(targetProject) : 0,
      exchangeRateUsd: parseFloat(exchangeRateUsd) || 15000,
      exchangeRateEur: parseFloat(exchangeRateEur) || 16500,
      roleTargets: roleTargets || null
    });
    res.json(result);
  } catch (error) {
    console.error('Error in target.controller upsert:', error);
    res.status(500).json({ error: error.message });
  }
};

const remove = async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    await targetService.deleteTarget(id);
    res.json({ message: 'Target deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

module.exports = {
  getAll,
  getByYear,
  upsert,
  remove
};
