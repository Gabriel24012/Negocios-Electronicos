// backend/src/routes/alertasStock.routes.js
const express = require("express");
const { getDB } = require("../db/init");
const { auth } = require("../middleware/auth");
const { requireAdmin } = require("../middleware/role");

const router = express.Router();

/**
 * GET /api/alertas-stock
 * Lista alertas (por defecto pendientes)
 */
router.get("/", auth, (req, res) => {
  const { status = "pendiente" } = req.query;
  const db = getDB();

  const rows = db.prepare(`
    SELECT
      a.*,
      p.nombre AS producto_nombre,
      pr.nombre AS proveedor_nombre
    FROM alertas_stock a
    JOIN productos p ON p.id = a.producto_id
    JOIN proveedores pr ON pr.id = a.proveedor_id
    WHERE a.status = ?
    ORDER BY a.id DESC
  `).all(status);

  res.json(rows);
});

/**
 * PUT /api/alertas-stock/:id/status
 * Cambia status: pendiente/resuelta/ignorada
 */
router.put("/:id/status", auth, requireAdmin, (req, res) => {
  const { status } = req.body || {};
  const valid = ["pendiente", "resuelta", "ignorada"];
  if (!valid.includes(status)) return res.status(400).json({ error: "status inválido" });

  const db = getDB();
  const a = db.prepare("SELECT * FROM alertas_stock WHERE id = ?").get(req.params.id);
  if (!a) return res.status(404).json({ error: "Alerta no encontrada" });

  db.prepare("UPDATE alertas_stock SET status = ? WHERE id = ?").run(status, req.params.id);
  res.json({ ok: true });
});

/**
 * POST /api/alertas-stock/:productoId/crear-pedido
 * Crea pedido al proveedor con cantidad "a mano" o sugerida.
 * Body opcional:
 *  { "cantidad_a_encargar": 15, "nota": "Urgente" }
 */
router.post("/:productoId/crear-pedido", auth, requireAdmin, (req, res) => {
  const { cantidad_a_encargar, nota = "" } = req.body || {};
  const productoId = Number(req.params.productoId);

  const db = getDB();
  const producto = db.prepare("SELECT * FROM productos WHERE id = ?").get(productoId);
  if (!producto) return res.status(404).json({ error: "Producto no encontrado" });

  const stockActual = Number(producto.stock_actual ?? 0);
  const stockMin = Number(producto.stock_minimo ?? 0);
  const sugerido = Math.max(0, stockMin - stockActual);

  const cantidad = cantidad_a_encargar != null ? Number(cantidad_a_encargar) : sugerido;
  if (!Number.isFinite(cantidad) || cantidad <= 0) {
    return res.status(400).json({ error: "cantidad_a_encargar debe ser > 0 (o deja vacío para sugerido)" });
  }

  if (!producto.proveedor_id) return res.status(400).json({ error: "Producto sin proveedor asignado" });

  const now = new Date().toISOString();

  const tx = db.transaction(() => {
    // Crear pedido
    const result = db.prepare(`
      INSERT INTO pedidos_proveedor
      (proveedor_id, producto_id, cantidad_solicitada, cantidad_recibida, estado, nota, fecha_creacion, fecha_actualizacion, creado_por)
      VALUES (?, ?, ?, 0, 'creado', ?, ?, ?, ?)
    `).run(
      producto.proveedor_id,
      productoId,
      cantidad,
      nota,
      now,
      now,
      req.user.id
    );

    // Evento inicial
    db.prepare(`
      INSERT INTO pedidos_proveedor_eventos
      (pedido_id, estado, comentario, fecha, usuario_id)
      VALUES (?, 'creado', ?, ?, ?)
    `).run(result.lastInsertRowid, "Pedido creado desde alerta de stock bajo", now, req.user.id);

    // Marcar alerta pendiente como resuelta (si existía)
    db.prepare(`
      UPDATE alertas_stock
      SET status = 'resuelta'
      WHERE producto_id = ? AND status = 'pendiente'
    `).run(productoId);
  });

  try {
    tx();
  } catch (e) {
    return res.status(500).json({ error: "Error creando pedido", detail: String(e?.message || e) });
  }

  res.status(201).json({ ok: true });
});

module.exports = router;