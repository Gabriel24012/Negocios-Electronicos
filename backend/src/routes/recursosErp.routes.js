const express = require("express");
const { getDB } = require("../db/init");
const { auth } = require("../middleware/auth");
const { requireRole } = require("../middleware/role");

const router = express.Router();

/**
 * GET /api/recursos-erp
 * Roles: admin, logistica
 */
router.get("/", auth, requireRole("admin", "logistica"), (req, res) => {
  const db = getDB();
  const rows = db.prepare(`
    SELECT * FROM recursos_erp
    ORDER BY id DESC
  `).all();

  res.json(rows);
});

/**
 * POST /api/recursos-erp
 * Roles: admin, logistica
 */
router.post("/", auth, requireRole("admin", "logistica"), (req, res) => {
  const {
    codigo,
    nombre,
    tipo,
    departamento,
    estado = "disponible"
  } = req.body || {};

  const tiposValidos = ["humano", "material", "tecnologico"];
  const estadosValidos = ["disponible", "asignado", "mantenimiento"];

  if (!codigo || !nombre || !tipo || !departamento) {
    return res.status(400).json({ error: "Faltan datos del recurso" });
  }

  if (!tiposValidos.includes(tipo)) {
    return res.status(400).json({ error: "Tipo de recurso inválido" });
  }

  if (!estadosValidos.includes(estado)) {
    return res.status(400).json({ error: "Estado de recurso inválido" });
  }

  const db = getDB();

  try {
    const result = db.prepare(`
      INSERT INTO recursos_erp
      (codigo, nombre, tipo, departamento, estado)
      VALUES (?, ?, ?, ?, ?)
    `).run(
      codigo.trim(),
      nombre.trim(),
      tipo.trim(),
      departamento.trim(),
      estado
    );

    const row = db.prepare(`
      SELECT * FROM recursos_erp WHERE id = ?
    `).get(result.lastInsertRowid);

    res.status(201).json(row);
  } catch (e) {
    res.status(500).json({ error: "Error creando recurso", detail: e.message });
  }
});

module.exports = router;