const express = require("express");
const { getDB } = require("../db/init");
const { auth } = require("../middleware/auth");
const { requireAdmin } = require("../middleware/role");

const router = express.Router();

// GET /api/usuarios
router.get("/", auth, requireAdmin, (req, res) => {
  const db = getDB();
  const rows = db.prepare(`
    SELECT id, nombre, email, rol
    FROM usuarios
    ORDER BY id DESC
  `).all();

  res.json(rows);
});

// PUT /api/usuarios/:id/rol
router.put("/:id/rol", auth, requireAdmin, (req, res) => {
  const { rol } = req.body || {};
  const rolesValidos = ["admin", "ventas", "logistica"];

  if (!rolesValidos.includes(rol)) {
    return res.status(400).json({ error: "Rol inválido" });
  }

  const db = getDB();
  const user = db.prepare("SELECT id, nombre, email, rol FROM usuarios WHERE id = ?").get(req.params.id);

  if (!user) {
    return res.status(404).json({ error: "Usuario no encontrado" });
  }

  db.prepare(`
    UPDATE usuarios
    SET rol = ?
    WHERE id = ?
  `).run(rol, req.params.id);

  const updated = db.prepare(`
    SELECT id, nombre, email, rol
    FROM usuarios
    WHERE id = ?
  `).get(req.params.id);

  res.json(updated);
});

module.exports = router;