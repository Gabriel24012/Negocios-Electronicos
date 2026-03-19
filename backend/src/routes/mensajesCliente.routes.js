const express = require("express");
const { getDB } = require("../db/init");
const { auth } = require("../middleware/auth");
const { requireRole } = require("../middleware/role");

const router = express.Router();

const PRIORIDADES_VALIDAS = ["baja", "normal", "alta"];

function getClienteByUserEmail(db, email) {
  return db.prepare(`
    SELECT id, nombre, correo, telefono, empresa, fecha_registro, estado, etapa_crm
    FROM clientes
    WHERE lower(correo) = lower(?)
  `).get(email);
}

function getMensajeById(db, id) {
  return db.prepare(`
    SELECT
      m.*,
      c.nombre AS cliente_nombre,
      c.correo AS cliente_correo,
      u.nombre AS admin_nombre
    FROM mensajes_cliente m
    JOIN clientes c ON c.id = m.cliente_id
    LEFT JOIN usuarios u ON u.id = m.admin_id
    WHERE m.id = ?
  `).get(id);
}

// POST /api/mensajes-cliente
router.post("/", auth, requireRole("admin"), (req, res) => {
  const {
    cliente_id,
    asunto = "",
    mensaje = "",
    prioridad = "normal"
  } = req.body || {};

  if (!cliente_id) {
    return res.status(400).json({ error: "cliente_id es obligatorio" });
  }

  if (!asunto.trim() || !mensaje.trim()) {
    return res.status(400).json({ error: "Asunto y mensaje son obligatorios" });
  }

  if (!PRIORIDADES_VALIDAS.includes(prioridad)) {
    return res.status(400).json({ error: "Prioridad inválida" });
  }

  const db = getDB();
  const cliente = db.prepare("SELECT id FROM clientes WHERE id = ?").get(cliente_id);

  if (!cliente) {
    return res.status(404).json({ error: "Cliente no encontrado" });
  }

  try {
    const result = db.prepare(`
      INSERT INTO mensajes_cliente
        (cliente_id, admin_id, asunto, mensaje, prioridad, fecha_envio)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      Number(cliente_id),
      req.user.id,
      asunto.trim(),
      mensaje.trim(),
      prioridad,
      new Date().toISOString()
    );

    res.status(201).json(getMensajeById(db, result.lastInsertRowid));
  } catch (e) {
    res.status(500).json({ error: "Error al enviar mensaje", detail: e.message });
  }
});

// GET /api/mensajes-cliente
router.get("/", auth, requireRole("admin"), (req, res) => {
  const db = getDB();

  const rows = db.prepare(`
    SELECT
      m.*,
      c.nombre AS cliente_nombre,
      c.correo AS cliente_correo,
      u.nombre AS admin_nombre
    FROM mensajes_cliente m
    JOIN clientes c ON c.id = m.cliente_id
    LEFT JOIN usuarios u ON u.id = m.admin_id
    ORDER BY m.fecha_envio DESC
    LIMIT 100
  `).all();

  res.json(rows);
});

// GET /api/mensajes-cliente/mios
router.get("/mios", auth, requireRole("usuario"), (req, res) => {
  const db = getDB();
  const cliente = getClienteByUserEmail(db, req.user.email);

  if (!cliente) {
    return res.json({ cliente: null, mensajes: [] });
  }

  const mensajes = db.prepare(`
    SELECT
      m.*,
      c.nombre AS cliente_nombre,
      c.correo AS cliente_correo,
      u.nombre AS admin_nombre
    FROM mensajes_cliente m
    JOIN clientes c ON c.id = m.cliente_id
    LEFT JOIN usuarios u ON u.id = m.admin_id
    WHERE m.cliente_id = ?
    ORDER BY m.fecha_envio DESC
  `).all(cliente.id);

  res.json({ cliente, mensajes });
});

// PUT /api/mensajes-cliente/:id/leido
router.put("/:id/leido", auth, requireRole("usuario"), (req, res) => {
  const db = getDB();
  const cliente = getClienteByUserEmail(db, req.user.email);

  if (!cliente) {
    return res.status(404).json({ error: "Cliente no encontrado para este usuario" });
  }

  const mensaje = db.prepare(`
    SELECT *
    FROM mensajes_cliente
    WHERE id = ? AND cliente_id = ?
  `).get(req.params.id, cliente.id);

  if (!mensaje) {
    return res.status(404).json({ error: "Mensaje no encontrado" });
  }

  if (!Number(mensaje.leido)) {
    db.prepare(`
      UPDATE mensajes_cliente
      SET leido = 1, fecha_lectura = ?
      WHERE id = ?
    `).run(new Date().toISOString(), req.params.id);
  }

  res.json(getMensajeById(db, req.params.id));
});

module.exports = router;
