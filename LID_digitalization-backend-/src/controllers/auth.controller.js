const authService = require('../services/auth.service');

const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const data = await authService.login(email, password);
    res.status(200).json({
      message: 'Login successful',
      token: data.token,
      user: data.user
    });

  } catch (error) {
    console.error('Login error:', error);
    if (error.message === 'Invalid credentials') {
      return res.status(401).json({ error: error.message });
    }
    if (error.message.includes('Your account is')) {
      return res.status(403).json({ error: error.message });
    }
    res.status(500).json({ error: 'Internal server error' });
  }
};

const register = async (req, res) => {
  try {
    const { name, email, password, role, roles } = req.body;
    const requestedRole = role || roles;
    
    if (!name || !email || !password || !requestedRole) {
      return res.status(400).json({ error: 'Name, email, password, and role are required' });
    }

    const newUser = await authService.register({ name, email, password, role: requestedRole, roles });
    res.status(201).json({
      message: 'Registration successful. Account pending approval.',
      user: newUser
    });
  } catch (error) {
    console.error('Registration error:', error);
    if (error.message === 'Email already exists') {
      return res.status(400).json({ error: error.message });
    }
    res.status(500).json({ error: 'Internal server error' });
  }
};

const getMe = async (req, res) => {
  try {
    const user = await authService.getMe(req.user.id);
    res.status(200).json({ user });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
};

const updateProfile = async (req, res) => {
  try {
    const userId = req.user.id;
    const { email, name, password } = req.body;
    
    const updatedUser = await authService.updateProfile(userId, { email, name, password });
    res.status(200).json({
      message: 'Profile updated successfully',
      user: updatedUser
    });
  } catch (error) {
    console.error('Update profile error:', error);
    if (error.message === 'Email already exists') {
      return res.status(400).json({ error: error.message });
    }
    res.status(500).json({ error: 'Internal server error' });
  }
};

module.exports = {
  login,
  register,
  getMe,
  updateProfile
};
