// backend/src/middleware/role.js
function requireRole(...rolesPermitidos) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: "No autenticado" });

    const rol = req.user.rol;
    if (!rolesPermitidos.includes(rol)) {
      return res.status(403).json({ error: "Acceso denegado (rol insuficiente)" });
    }

    next();
  };
}

// Alias directo para admin (lo que tú estás intentando usar)
const requireAdmin = requireRole("admin");

module.exports = { requireRole, requireAdmin };
