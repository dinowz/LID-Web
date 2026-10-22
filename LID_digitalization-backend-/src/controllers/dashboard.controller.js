const dashboardService = require('../services/dashboard.service');

const getResourceUtilization = async (req, res) => {
  try {
    const month = req.query.month;
    const year = req.query.year;
    const data = await dashboardService.getResourceUtilization(month, year);
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const getResourceOverview = async (req, res) => {
  try {
    const year = req.query.year ? parseInt(req.query.year) : new Date().getFullYear();
    const data = await dashboardService.getResourceOverview(year);
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const getPipelineStats = async (req, res) => {
  try {
    const year = req.query.year ? parseInt(req.query.year) : new Date().getFullYear();
    const data = await dashboardService.getPipelineStats(year);
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const exportCSV = async (req, res) => {
  try {
    const year = req.query.year ? parseInt(req.query.year) : new Date().getFullYear();
    const csvContent = await dashboardService.generateCSVReport(year);
    
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=LIND_Dashboard_Report_${year}.csv`);
    res.send(csvContent);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const getInvoiceAchievement = async (req, res) => {
  try {
    const year = req.query.year ? parseInt(req.query.year) : new Date().getFullYear();
    const data = await dashboardService.getInvoiceAchievement(year);
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

module.exports = {
  getResourceUtilization,
  getResourceOverview,
  getPipelineStats,
  exportCSV,
  getInvoiceAchievement
};
