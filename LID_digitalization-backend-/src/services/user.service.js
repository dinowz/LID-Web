const prisma = require('../config/prisma');
const bcrypt = require('bcrypt');

const getAllUsers = async (queryFilters) => {
  return await prisma.user.findMany({
    where: queryFilters,
    select: {
      id: true,
      name: true,
      email: true,
      roles: true,
      status: true,
      createdAt: true,
      updatedAt: true
    },
    orderBy: { createdAt: 'desc' }
  });
};

const getUserById = async (id) => {
  return await prisma.user.findFirst({
    where: { id: Number(id), deletedAt: null },
    select: { id: true, name: true, email: true, roles: true, status: true, createdAt: true }
  });
};

const getUserByEmail = async (email) => {
  return await prisma.user.findUnique({
    where: { email }
  });
};

const VALID_ROLES = ['ADMIN', 'PROCUREMENT', 'LOGISTIC', 'FINANCE', 'PROJECT', 'TFS', 'SPARE_PART', 'SERVICE', 'MANAGEMENT'];

const sanitizeRolesInput = (roles, role) => {
  let inputRoles = [];
  if (Array.isArray(roles)) {
    inputRoles = roles;
  } else if (Array.isArray(role)) {
    inputRoles = role;
  } else if (role) {
    inputRoles = [role];
  } else if (roles) {
    inputRoles = [roles];
  }

  const sanitized = inputRoles
    .flatMap(r => Array.isArray(r) ? r : [r])
    .map(r => typeof r === 'string' ? r.toUpperCase().trim() : '')
    .filter(r => VALID_ROLES.includes(r));

  return sanitized;
};

const createUser = async (data) => {
  const { name, email, password, roles, role, status } = data;
  
  const saltRounds = 10;
  const hashedPassword = await bcrypt.hash(password, saltRounds);
  const sanitizedRoles = sanitizeRolesInput(roles, role);
  const finalRoles = sanitizedRoles.length > 0 ? sanitizedRoles : ['SPARE_PART'];

  return await prisma.user.create({
    data: {
      name,
      email,
      password: hashedPassword,
      roles: finalRoles,
      status: status || 'PENDING'
    },
    select: { id: true, name: true, email: true, roles: true, status: true, createdAt: true }
  });
};

const updateUser = async (id, data) => {
  const { name, email, password, roles, role, status } = data;

  const updateData = {};
  if (name) updateData.name = name;
  if (email) updateData.email = email;
  if (roles || role) {
    const sanitizedRoles = sanitizeRolesInput(roles, role);
    if (sanitizedRoles.length > 0) {
      updateData.roles = sanitizedRoles;
    }
  }
  if (status) updateData.status = status;
  if (password) {
    const saltRounds = 10;
    updateData.password = await bcrypt.hash(password, saltRounds);
  }

  return await prisma.user.update({
    where: { id: Number(id) },
    data: updateData,
    select: { id: true, name: true, email: true, roles: true, status: true, updatedAt: true }
  });
};

const softDeleteUser = async (id) => {
  const user = await prisma.user.findUnique({ where: { id: Number(id) } });
  if (!user) throw new Error("User not found");

  const deletedEmail = `${user.email}_deleted_${Date.now()}`;

  return await prisma.user.update({
    where: { id: Number(id) },
    data: { 
      deletedAt: new Date(),
      email: deletedEmail
    }
  });
};

module.exports = {
  getAllUsers,
  getUserById,
  getUserByEmail,
  createUser,
  updateUser,
  softDeleteUser
};
