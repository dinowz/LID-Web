const prisma = require('../config/prisma');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('../middlewares/auth.middleware');

const login = async (email, password) => {
  const user = await prisma.user.findUnique({
    where: { email }
  });

  if (!user) {
    throw new Error('Invalid credentials');
  }

  if (user.status !== 'ACTIVE') {
    throw new Error(`Your account is ${user.status.toLowerCase()}. Please contact administrator.`);
  }

  const isMatch = await bcrypt.compare(password, user.password);
  if (!isMatch) {
    throw new Error('Invalid credentials');
  }

  // Support both singular role (DB) and normalize to array in token
  const userRoles = user.roles || (user.role ? [user.role] : []);

  const token = jwt.sign(
    { id: user.id, roles: userRoles, name: user.name },
    JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '1d' }
  );

  return {
    token,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      roles: userRoles
    }
  };
};

const register = async (data) => {
  const { name, email, password, role, roles } = data;
  
  const existingUser = await prisma.user.findUnique({
    where: { email }
  });

  if (existingUser) {
    throw new Error('Email already exists');
  }

  const saltRounds = 10;
  const hashedPassword = await bcrypt.hash(password, saltRounds);

  const VALID_ROLES = ['ADMIN', 'PROCUREMENT', 'LOGISTIC', 'FINANCE', 'PROJECT', 'TFS', 'SPARE_PART', 'SERVICE', 'MANAGEMENT'];

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

  const sanitizedRoles = inputRoles
    .flatMap(r => Array.isArray(r) ? r : [r])
    .map(r => typeof r === 'string' ? r.toUpperCase().trim() : '')
    .filter(r => VALID_ROLES.includes(r));

  const finalRoles = sanitizedRoles.length > 0 ? sanitizedRoles : ['SPARE_PART'];

  const newUser = await prisma.user.create({
    data: {
      name,
      email,
      password: hashedPassword,
      roles: finalRoles,
      status: 'PENDING'
    },
    select: { id: true, name: true, email: true, roles: true, status: true, createdAt: true }
  });

  return newUser;
};

const getMe = async (id) => {
  return await prisma.user.findUnique({
    where: { id },
    select: { id: true, name: true, email: true, roles: true }
  });
};

const updateProfile = async (userId, data) => {
  const { email, name, password } = data;

  if (email) {
    const existingUser = await prisma.user.findUnique({
      where: { email }
    });

    if (existingUser && existingUser.id !== userId) {
      throw new Error('Email already exists');
    }
  }

  const updateData = {};
  if (email) updateData.email = email;
  if (name) updateData.name = name;
  if (password) {
    const saltRounds = 10;
    updateData.password = await bcrypt.hash(password, saltRounds);
  }

  const updatedUser = await prisma.user.update({
    where: { id: userId },
    data: updateData,
    select: { id: true, name: true, email: true, roles: true }
  });

  return updatedUser;
};

module.exports = {
  login,
  register,
  getMe,
  updateProfile
};
