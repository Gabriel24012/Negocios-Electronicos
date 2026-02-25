// backend/src/routes/proveedores.routes.js
const express = require("express");
const { getDB } = require("../db/init");
const { auth } = require("../middleware/auth");
const { requireAdmin } = require("../middleware/role");

const router = express.Router();

// POST /proveedores (admin)
router.post("/", auth, requireAdmin, (req, res) => {
  const { nombre, contacto, correo, telefono } = req.body || {};
  if (!nombre || !contacto || !correo || !telefono) {
    return res.status(400).json({ error: "Faltan datos" });
  }

  const db = getDB();
  const r = db.prepare(`
    INSERT INTO proveedores (nombre, contacto, correo, telefono)
    VALUES (?, ?, ?, ?)
  `).run(nombre.trim(), contacto.trim(), correo.trim(), telefono.trim());

  const nuevo = db.prepare("SELECT * FROM proveedores WHERE id = ?").get(r.lastInsertRowid);
  res.status(201).json(nuevo);
});

// GET /proveedores
router.get("/", auth, (req, res) => {
  const db = getDB();
  const rows = db.prepare("SELECT * FROM proveedores ORDER BY id DESC").all();
  res.json(rows);
});

// PUT /proveedores/:id (admin)
router.put("/:id", auth, requireAdmin, (req, res) => {
  const { nombre, contacto, correo, telefono } = req.body || {};
  const db = getDB();

  const current = db.prepare("SELECT * FROM proveedores WHERE id = ?").get(req.params.id);
  if (!current) return res.status(404).json({ error: "Proveedor no encontrado" });

  db.prepare(`
    UPDATE proveedores
    SET nombre=?, contacto=?, correo=?, telefono=?
    WHERE id=?
  `).run(
    (nombre ?? current.nombre).trim(),
    (contacto ?? current.contacto).trim(),
    (correo ?? current.correo).trim(),
    (telefono ?? current.telefono).trim(),
    req.params.id
  );

  const updated = db.prepare("SELECT * FROM proveedores WHERE id = ?").get(req.params.id);
  res.json(updated);
});

// DELETE /proveedores/:id (admin)
router.delete("/:id", auth, requireAdmin, (req, res) => {
  const db = getDB();

  const current = db.prepare("SELECT * FROM proveedores WHERE id = ?").get(req.params.id);
  if (!current) return res.status(404).json({ error: "Proveedor no encontrado" });

  db.prepare("DELETE FROM proveedores WHERE id = ?").run(req.params.id);
  res.json({ ok: true });
});



module.exports = router;
