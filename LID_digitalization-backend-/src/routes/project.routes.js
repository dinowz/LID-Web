const express = require('express');
const router = express.Router();
const { getProjects, getProjectById, createProject, updateProject, deleteProject } = require('../controllers/project.controller');
const { verifyToken, verifyRole } = require('../middlewares/auth.middleware');
const requireAdmin = require('../middlewares/requireAdmin');

router.use(verifyToken);

router.get('/', getProjects);
router.get('/:id', getProjectById);
router.post('/', verifyRole(['ADMIN', 'PROJECT', 'TFS']), createProject);
router.put('/:id', verifyRole(['ADMIN', 'PROJECT', 'TFS']), updateProject);
router.delete('/:id', requireAdmin, deleteProject);

module.exports = router;
