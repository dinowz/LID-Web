module.exports = (req, res, next) => {
  const userRoles = req.user?.roles || (req.user?.role ? [req.user.role] : []);
  if (!req.user || !userRoles.includes('ADMIN')) {
    return res.status(403).json({
      error: 'Akses ditolak. Hanya Administrator yang diizinkan melakukan operasi hapus data.'
    });
  }
  next();
};
