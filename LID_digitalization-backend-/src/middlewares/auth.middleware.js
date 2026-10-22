const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'dev_super_secret_key';

const verifyToken = (req, res, next) => {
  const token = req.headers['authorization'];
  
  if (!token) {
    return res.status(403).json({ error: 'A token is required for authentication' });
  }

  try {
    const bearer = token.split(' ')[1];
    const decoded = jwt.verify(bearer, JWT_SECRET);
    req.user = decoded;
  } catch (err) {
    return res.status(401).json({ error: 'Invalid Token' });
  }
  
  return next();
};

const verifyRole = (roles = []) => {
  return (req, res, next) => {
    // Support both old single-role token and new multi-role token
    const userRoles = req.user?.roles || (req.user?.role ? [req.user.role] : []);
    const hasRole = userRoles.some(r => roles.includes(r));
    if (!req.user || !hasRole) {
      return res.status(403).json({ error: 'Unauthorized: insufficient role permissions' });
    }
    next();
  };
};

module.exports = {
  verifyToken,
  verifyRole,
  JWT_SECRET
};
