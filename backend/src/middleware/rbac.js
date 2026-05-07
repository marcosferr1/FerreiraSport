function requireRole(allowedRoles) {
  return (req, res, next) => {
    const role = req.user?.role;
    if (!role) return res.status(401).json({ error: 'No autorizado' });
    if (!allowedRoles.includes(role)) {
      return res.status(403).json({ error: 'Acceso denegado' });
    }
    return next();
  };
}

module.exports = { requireRole };

