const express = require("express");
const { getDB } = require("../db/init");
const { auth } = require("../middleware/auth");

const router = express.Router();

// POST /api/interacciones
router.post("/", auth, (req, res) => {
  const { cliente_id, tipo, descripcion } = req.body || {};
  const tiposValidos = ["llamada", "correo", "reunion", "seguimiento", "soporte"];

  if (!cliente_id || !tipo || !descripcion) {
    return res.status(400).json({ error: "Faltan datos" });
  }

  if (!tiposValidos.includes(tipo)) {
    return res.status(400).json({ error: "Tipo inválido" });
  }

  const db = getDB();
  const cliente = db.prepare("SELECT * FROM clientes WHERE id = ?").get(cliente_id);

  if (!cliente) {
    return res.status(404).json({ error: "Cliente no encontrado" });
  }

  const fecha = new Date().toISOString();

  try {
    const result = db.prepare(`
      INSERT INTO interacciones
      (cliente_id, tipo, descripcion, fecha, usuario_id)
      VALUES (?, ?, ?, ?, ?)
    `).run(
      cliente_id,
      tipo,
      descripcion.trim(),
      fecha,
      req.user.id
    );

    const interaccion = db.prepare(`
      SELECT i.*, u.nombre AS usuario_nombre
      FROM interacciones i
      JOIN usuarios u ON u.id = i.usuario_id
      WHERE i.id = ?
    `).get(result.lastInsertRowid);

    res.status(201).json(interaccion);
  } catch (e) {
    res.status(500).json({ error: "Error al registrar interacción", detail: e.message });
  }
});

// GET /api/interacciones/mias
router.get("/mias", auth, (req, res) => {
  const db = getDB();

  const rows = db.prepare(`
    SELECT
      i.*,
      c.nombre AS cliente_nombre,
      c.correo AS cliente_correo
    FROM interacciones i
    JOIN clientes c ON c.id = i.cliente_id
    WHERE i.usuario_id = ?
    ORDER BY i.fecha DESC
  `).all(req.user.id);

  res.json(rows);
});

module.exports = router;