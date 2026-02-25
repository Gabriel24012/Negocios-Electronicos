// backend/src/routes/inventario.routes.js
const express = require("express");
const { getDB } = require("../db/init");
const { auth } = require("../middleware/auth");
const { requireAdmin } = require("../middleware/role"); // si solo admin puede mover inventario

const router = express.Router();

// POST /api/inventario/movimiento
router.post("/movimiento", auth, requireAdmin, (req, res) => {
  const { producto_id, tipo, cantidad, motivo, referencia = "" } = req.body || {};

  const tipos = ["entrada", "salida"];
  const motivos = ["venta", "ajuste", "reposicion", "devolucion"];

  if (!producto_id || !tipo || !cantidad || !motivo) {
    return res.status(400).json({ error: "Faltan datos" });
  }
  if (!tipos.includes(tipo)) return res.status(400).json({ error: "tipo inválido" });
  if (!motivos.includes(motivo)) return res.status(400).json({ error: "motivo inválido" });
  if (Number(cantidad) <= 0) return res.status(400).json({ error: "cantidad debe ser > 0" });

  const db = getDB();
  const producto = db.prepare("SELECT * FROM productos WHERE id = ?").get(producto_id);
  if (!producto) return res.status(404).json({ error: "Producto no existe" });

  // calcular nuevo stock
  const cant = Number(cantidad);
  const nuevoStock = tipo === "entrada" ? (producto.stock + cant) : (producto.stock - cant);

  if (nuevoStock < 0) {
    return res.status(409).json({ error: "Stock insuficiente para salida" });
  }

  const fecha = new Date().toISOString();

  // transacción
  const tx = db.transaction(() => {
    db.prepare(
      `INSERT INTO movimientos_inventario (producto_id, tipo, cantidad, motivo, referencia, fecha, usuario_id)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).run(producto_id, tipo, cant, motivo, referencia, fecha, req.user.id);

    db.prepare("UPDATE productos SET stock = ? WHERE id = ?").run(nuevoStock, producto_id);
  });

  tx();

  const updated = db.prepare("SELECT * FROM productos WHERE id = ?").get(producto_id);
  res.status(201).json({ ok: true, producto: updated });
});

// GET /api/productos/:id/movimientos  (historial por producto)
router.get("/producto/:id", auth, (req, res) => {
  const db = getDB();
  const rows = db.prepare(`
    SELECT mi.*, p.nombre AS producto_nombre
    FROM movimientos_inventario mi
    JOIN productos p ON p.id = mi.producto_id
    WHERE mi.producto_id = ?
    ORDER BY mi.id DESC
  `).all(req.params.id);

  res.json(rows);
});

module.exports = router;
