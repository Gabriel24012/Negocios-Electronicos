// backend/src/routes/pedidosProveedor.routes.js
const express = require("express");
const { getDB } = require("../db/init");
const { auth } = require("../middleware/auth");
const { requireAdmin } = require("../middleware/role");

const router = express.Router();

const ESTADOS = ["creado", "enviado", "confirmado", "en_transito", "recibido", "cancelado"];

/**
 * POST /api/pedidos-proveedor
 * Body: { producto_id, cantidad_a_encargar, nota }
 */
router.post("/", auth, requireAdmin, (req, res) => {
  const { producto_id, cantidad_a_encargar, nota = "" } = req.body || {};
  if (!producto_id || !cantidad_a_encargar) return res.status(400).json({ error: "Faltan datos" });

  const cantidad = Number(cantidad_a_encargar);
  if (!Number.isFinite(cantidad) || cantidad <= 0) return res.status(400).json({ error: "cantidad_a_encargar inválida" });

  const db = getDB();
  const producto = db.prepare("SELECT * FROM productos WHERE id = ?").get(producto_id);
  if (!producto) return res.status(404).json({ error: "Producto no encontrado" });
  if (!producto.proveedor_id) return res.status(400).json({ error: "El producto no tiene proveedor asignado" });

  const now = new Date().toISOString();

  const tx = db.transaction(() => {
    const result = db.prepare(`
      INSERT INTO pedidos_proveedor
      (proveedor_id, producto_id, cantidad_solicitada, cantidad_recibida, estado, nota, fecha_creacion, fecha_actualizacion, creado_por)
      VALUES (?, ?, ?, 0, 'creado', ?, ?, ?, ?)
    `).run(producto.proveedor_id, producto_id, cantidad, nota, now, now, req.user.id);

    db.prepare(`
      INSERT INTO pedidos_proveedor_eventos
      (pedido_id, estado, comentario, fecha, usuario_id)
      VALUES (?, 'creado', ?, ?, ?)
    `).run(result.lastInsertRowid, "Pedido creado", now, req.user.id);

    res.status(201).json({ ok: true, pedido_id: result.lastInsertRowid });
  });

  try { tx(); } catch (e) {
    return res.status(500).json({ error: "Error creando pedido", detail: String(e?.message || e) });
  }
});

/**
 * GET /api/pedidos-proveedor
 */
router.get("/", auth, (req, res) => {
  const db = getDB();
  const rows = db.prepare(`
    SELECT
      pp.*,
      p.nombre AS producto_nombre,
      pr.nombre AS proveedor_nombre
    FROM pedidos_proveedor pp
    JOIN productos p ON p.id = pp.producto_id
    JOIN proveedores pr ON pr.id = pp.proveedor_id
    ORDER BY pp.id DESC
  `).all();

  res.json(rows);
});

/**
 * GET /api/pedidos-proveedor/:id
 * Detalle + eventos
 */
router.get("/:id", auth, (req, res) => {
  const db = getDB();
  const pedido = db.prepare(`
    SELECT
      pp.*,
      p.nombre AS producto_nombre,
      pr.nombre AS proveedor_nombre
    FROM pedidos_proveedor pp
    JOIN productos p ON p.id = pp.producto_id
    JOIN proveedores pr ON pr.id = pp.proveedor_id
    WHERE pp.id = ?
  `).get(req.params.id);

  if (!pedido) return res.status(404).json({ error: "Pedido no encontrado" });

  const eventos = db.prepare(`
    SELECT * FROM pedidos_proveedor_eventos
    WHERE pedido_id = ?
    ORDER BY id ASC
  `).all(req.params.id);

  res.json({ pedido, eventos });
});

/**
 * PUT /api/pedidos-proveedor/:id/estado
 * Body: { estado, comentario }
 */
router.put("/:id/estado", auth, requireAdmin, (req, res) => {
  const { estado, comentario = "" } = req.body || {};
  if (!ESTADOS.includes(estado)) return res.status(400).json({ error: "Estado inválido" });

  const db = getDB();
  const pedido = db.prepare("SELECT * FROM pedidos_proveedor WHERE id = ?").get(req.params.id);
  if (!pedido) return res.status(404).json({ error: "Pedido no encontrado" });

  const now = new Date().toISOString();

  const tx = db.transaction(() => {
    db.prepare(`
      UPDATE pedidos_proveedor
      SET estado = ?, fecha_actualizacion = ?
      WHERE id = ?
    `).run(estado, now, req.params.id);

    db.prepare(`
      INSERT INTO pedidos_proveedor_eventos
      (pedido_id, estado, comentario, fecha, usuario_id)
      VALUES (?, ?, ?, ?, ?)
    `).run(req.params.id, estado, comentario, now, req.user.id);
  });

  try { tx(); } catch (e) {
    return res.status(500).json({ error: "Error al actualizar estado", detail: String(e?.message || e) });
  }

  res.json({ ok: true });
});

/**
 * PUT /api/pedidos-proveedor/:id/recibir
 * Body: { cantidad_recibida, comentario }
 * - Suma stock_actual
 * - Registra movimiento inventario tipo=entrada motivo=reposicion
 * - Cambia estado a recibido si ya se completó
 */
router.put("/:id/recibir", auth, requireAdmin, (req, res) => {
  const { cantidad_recibida, comentario = "" } = req.body || {};
  const add = Number(cantidad_recibida);

  if (!Number.isFinite(add) || add <= 0) {
    return res.status(400).json({ error: "cantidad_recibida inválida" });
  }

  const db = getDB();
  const pedido = db.prepare("SELECT * FROM pedidos_proveedor WHERE id = ?").get(req.params.id);
  if (!pedido) return res.status(404).json({ error: "Pedido no encontrado" });

  const now = new Date().toISOString();

  const tx = db.transaction(() => {
    // actualizar recibido acumulado
    const nuevaRecibida = Number(pedido.cantidad_recibida ?? 0) + add;
    const completo = nuevaRecibida >= Number(pedido.cantidad_solicitada);

    db.prepare(`
      UPDATE pedidos_proveedor
      SET cantidad_recibida = ?, estado = ?, fecha_actualizacion = ?
      WHERE id = ?
    `).run(nuevaRecibida, completo ? "recibido" : pedido.estado, now, req.params.id);

    // sumar stock
    const prod = db.prepare("SELECT * FROM productos WHERE id = ?").get(pedido.producto_id);
    const nuevoStock = Number(prod.stock_actual ?? 0) + add;

    db.prepare(`UPDATE productos SET stock_actual = ? WHERE id = ?`).run(nuevoStock, pedido.producto_id);

    // movimiento inventario
    db.prepare(`
      INSERT INTO movimientos_inventario
      (producto_id, tipo, cantidad, motivo, referencia, fecha, usuario_id)
      VALUES (?, 'entrada', ?, 'reposicion', ?, ?, ?)
    `).run(pedido.producto_id, add, `pedido_proveedor:${pedido.id}`, now, req.user.id);

    // evento
    db.prepare(`
      INSERT INTO pedidos_proveedor_eventos
      (pedido_id, estado, comentario, fecha, usuario_id)
      VALUES (?, ?, ?, ?, ?)
    `).run(
      req.params.id,
      completo ? "recibido" : pedido.estado,
      comentario || `Recepción parcial: +${add}`,
      now,
      req.user.id
    );
  });

  try { tx(); } catch (e) {
    return res.status(500).json({ error: "Error al recibir pedido", detail: String(e?.message || e) });
  }

  res.json({ ok: true });
});

module.exports = router;