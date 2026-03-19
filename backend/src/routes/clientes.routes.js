const express = require("express");
const { getDB } = require("../db/init");
const { auth } = require("../middleware/auth");

const router = express.Router();

// POST /api/clientes
router.post("/", auth, (req, res) => {
  const {
    nombre,
    correo,
    telefono = "",
    empresa = "",
    estado = "activo",
    etapa_crm = "Prospecto"
  } = req.body || {};

  if (!nombre || !correo) {
    return res.status(400).json({ error: "Nombre y correo son obligatorios" });
  }

  const db = getDB();
  const fecha_registro = new Date().toISOString();

  try {
    const result = db.prepare(`
      INSERT INTO clientes
      (nombre, correo, telefono, empresa, fecha_registro, estado, etapa_crm)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      nombre.trim(),
      correo.trim(),
      telefono.trim(),
      empresa.trim(),
      fecha_registro,
      estado,
      etapa_crm
    );

    const cliente = db.prepare("SELECT * FROM clientes WHERE id = ?").get(result.lastInsertRowid);
    res.status(201).json(cliente);
  } catch (e) {
    res.status(500).json({ error: "Error al crear cliente", detail: e.message });
  }
});

// GET /api/clientes?q=&estado=&etapa=
router.get("/", auth, (req, res) => {
  const { q = "", estado = "", etapa = "" } = req.query;
  const db = getDB();

  let sql = `SELECT * FROM clientes WHERE 1=1`;
  const params = [];

  if (q) {
    sql += ` AND (nombre LIKE ? OR correo LIKE ? OR empresa LIKE ?)`;
    params.push(`%${q}%`, `%${q}%`, `%${q}%`);
  }

  if (estado) {
    sql += ` AND estado = ?`;
    params.push(estado);
  }

  if (etapa) {
    sql += ` AND etapa_crm = ?`;
    params.push(etapa);
  }

  sql += ` ORDER BY id DESC`;

  const rows = db.prepare(sql).all(...params);
  res.json(rows);
});

// GET /api/clientes/:id
router.get("/:id", auth, (req, res) => {
  const db = getDB();
  const cliente = db.prepare("SELECT * FROM clientes WHERE id = ?").get(req.params.id);

  if (!cliente) return res.status(404).json({ error: "Cliente no encontrado" });

  res.json(cliente);
});

// PUT /api/clientes/:id
router.put("/:id", auth, (req, res) => {
  const {
    nombre,
    correo,
    telefono = "",
    empresa = "",
    estado = "activo",
    etapa_crm = "Prospecto"
  } = req.body || {};

  const db = getDB();
  const cliente = db.prepare("SELECT * FROM clientes WHERE id = ?").get(req.params.id);

  if (!cliente) return res.status(404).json({ error: "Cliente no encontrado" });

  try {
    db.prepare(`
      UPDATE clientes
      SET nombre = ?, correo = ?, telefono = ?, empresa = ?, estado = ?, etapa_crm = ?
      WHERE id = ?
    `).run(
      nombre?.trim() || cliente.nombre,
      correo?.trim() || cliente.correo,
      telefono.trim(),
      empresa.trim(),
      estado,
      etapa_crm,
      req.params.id
    );

    const updated = db.prepare("SELECT * FROM clientes WHERE id = ?").get(req.params.id);
    res.json(updated);
  } catch (e) {
    res.status(500).json({ error: "Error al actualizar cliente", detail: e.message });
  }
});

// DELETE /api/clientes/:id
router.delete("/:id", auth, (req, res) => {
  const db = getDB();
  const cliente = db.prepare("SELECT * FROM clientes WHERE id = ?").get(req.params.id);

  if (!cliente) return res.status(404).json({ error: "Cliente no encontrado" });

  db.prepare("DELETE FROM clientes WHERE id = ?").run(req.params.id);
  res.json({ ok: true });
});

// PUT /api/clientes/:id/etapa
router.put("/:id/etapa", auth, (req, res) => {
  const { etapa_crm } = req.body || {};
  const etapasValidas = ["Prospecto", "Activo", "Frecuente", "Inactivo"];

  if (!etapasValidas.includes(etapa_crm)) {
    return res.status(400).json({ error: "Etapa CRM inválida" });
  }

  const db = getDB();
  const cliente = db.prepare("SELECT * FROM clientes WHERE id = ?").get(req.params.id);

  if (!cliente) return res.status(404).json({ error: "Cliente no encontrado" });

  db.prepare(`
    UPDATE clientes
    SET etapa_crm = ?
    WHERE id = ?
  `).run(etapa_crm, req.params.id);

  const updated = db.prepare("SELECT * FROM clientes WHERE id = ?").get(req.params.id);
  res.json(updated);
});

// GET /api/clientes/:id/interacciones
router.get("/:id/interacciones", auth, (req, res) => {
  const db = getDB();

  const rows = db.prepare(`
    SELECT i.*, u.nombre AS usuario_nombre
    FROM interacciones i
    JOIN usuarios u ON u.id = i.usuario_id
    WHERE i.cliente_id = ?
    ORDER BY i.fecha DESC
  `).all(req.params.id);

  res.json(rows);
});

module.exports = router;