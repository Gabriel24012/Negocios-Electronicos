const express = require("express");
const { getDB } = require("../db/init");
const { auth } = require("../middleware/auth");
const { requireRole } = require("../middleware/role");

const router = express.Router();

/**
 * GET /api/procesos-erp
 * Roles: admin, logistica
 */
router.get("/", auth, requireRole("admin", "logistica"), (req, res) => {
  const db = getDB();
  const rows = db.prepare(`
    SELECT * FROM procesos_erp
    ORDER BY id DESC
  `).all();

  res.json(rows);
});

/**
 * POST /api/procesos-erp
 * Roles: admin, logistica
 */
router.post("/", auth, requireRole("admin", "logistica"), (req, res) => {
  const {
    codigo,
    nombre,
    descripcion = "",
    estado = "activo",
    progreso = 0,
    referencia = ""
  } = req.body || {};

  const estadosValidos = ["activo", "pausado", "completado"];

  if (!codigo || !nombre) {
    return res.status(400).json({ error: "Código y nombre son obligatorios" });
  }

  if (!estadosValidos.includes(estado)) {
    return res.status(400).json({ error: "Estado de proceso inválido" });
  }

  const progresoNum = Number(progreso);
  if (!Number.isFinite(progresoNum) || progresoNum < 0 || progresoNum > 100) {
    return res.status(400).json({ error: "Progreso inválido" });
  }

  const db = getDB();

  try {
    const result = db.prepare(`
      INSERT INTO procesos_erp
      (codigo, nombre, descripcion, estado, progreso, fecha_inicio, referencia)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      codigo.trim(),
      nombre.trim(),
      descripcion.trim(),
      estado,
      progresoNum,
      new Date().toISOString(),
      referencia.trim()
    );

    const row = db.prepare(`
      SELECT * FROM procesos_erp WHERE id = ?
    `).get(result.lastInsertRowid);

    res.status(201).json(row);
  } catch (e) {
    res.status(500).json({ error: "Error creando proceso", detail: e.message });
  }
});

module.exports = router;