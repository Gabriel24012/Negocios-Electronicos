// backend/src/routes/inventario.routes.js
const express = require("express");
const { getDB } = require("../db/init");
const { auth } = require("../middleware/auth");
const { requireAdmin } = require("../middleware/role");

const { enviarAlertaStockBajo } = require("../services/email.service");


const router = express.Router();


function cerrarAlertasSiYaNoAplica(db, productoId) {
  const prod = db.prepare("SELECT * FROM productos WHERE id = ?").get(productoId);
  if (!prod) return;

  const stockActual = Number(prod.stock_actual ?? prod.stock ?? 0);
  const stockMin = Number(prod.stock_minimo ?? 0);

  // Si ya está por arriba del mínimo, cerramos alertas pendientes
  if (Number.isFinite(stockMin) && stockMin > 0 && stockActual > stockMin) {
    db.prepare(`
      UPDATE alertas_stock
      SET status = 'resuelto'
      WHERE producto_id = ? AND status = 'pendiente'
    `).run(productoId);

    // opcional: log
    console.log(`[ALERTAS] Cerradas alertas pendientes de producto ${productoId} (stock=${stockActual}, min=${stockMin})`);
  }
}
function getStock(producto) {
  // Tu BD usa stock_actual
  if (producto.stock_actual != null) return Number(producto.stock_actual);
  // fallback si en algún momento existiera "stock"
  if (producto.stock != null) return Number(producto.stock);
  return 0;
}

function setStock(db, productoId, nuevoStock) {
  // set stock_actual (principal)
  try {
    db.prepare("UPDATE productos SET stock_actual = ? WHERE id = ?").run(nuevoStock, productoId);
  } catch (e) {
    // fallback a "stock" si existiera
    db.prepare("UPDATE productos SET stock = ? WHERE id = ?").run(nuevoStock, productoId);
  }
}

async function crearAlertaStockBajoSiAplica({ db, producto, usuarioId }) {
  const stockActual = Number(producto.stock_actual ?? producto.stock ?? 0);
  const stockMin = Number(producto.stock_minimo ?? 0);
  const estrategia = String(producto.estrategia_logistica ?? "").trim().toUpperCase(); // "PULL" | "PUSH"

  if (!Number.isFinite(stockMin) || stockMin <= 0) return;
  if (stockActual > stockMin) return;

  // -------- 1) ALERTA (solo si no existe pendiente) --------
  const yaAlerta = db.prepare(`
    SELECT id FROM alertas_stock
    WHERE producto_id = ? AND status = 'pendiente'
    ORDER BY id DESC LIMIT 1
  `).get(producto.id);

  const faltan = Math.max(0, stockMin - stockActual);

  if (!yaAlerta) {
    db.prepare(`
      INSERT INTO alertas_stock
        (producto_id, proveedor_id, stock_actual, stock_minimo, faltan, status, fecha)
      VALUES
        (?, ?, ?, ?, ?, 'pendiente', datetime('now'))
    `).run(producto.id, producto.proveedor_id, stockActual, stockMin, faltan);

    // correo de alerta (solo cuando se crea alerta nueva)
    const proveedor = db.prepare(`SELECT * FROM proveedores WHERE id = ?`).get(producto.proveedor_id);
    if (proveedor?.correo) {
      try {
        await enviarAlertaStockBajo({
          to: proveedor.correo,
          proveedorNombre: proveedor.nombre,
          productoNombre: producto.nombre,
          stockActual,
          stockMinimo: stockMin,
          faltan
        });
      } catch (e) {
        console.error("[EMAIL] fallo al enviar:", e);
      }
    }
  }

  // -------- 2) PUSH: pedido automático --------
  if (estrategia !== "PUSH") return;

  // Evitar duplicado: si ya hay un pedido abierto, no crear otro
  const pedidoAbierto = db.prepare(`
    SELECT id, estado FROM pedidos_proveedor
    WHERE producto_id = ?
      AND estado IN ('creado','enviado','confirmado','en_transito')
    ORDER BY id DESC LIMIT 1
  `).get(producto.id);

  if (pedidoAbierto) return;

  // Cantidad automática: reponer a un objetivo
  const objetivo = Math.max(stockMin * 2, stockMin + 2);
  const cantidadSolicitada = Math.max(1, objetivo - stockActual);
  const now = new Date().toISOString();

  const ins = db.prepare(`
    INSERT INTO pedidos_proveedor
      (proveedor_id, producto_id, cantidad_solicitada, cantidad_recibida,
       estado, nota, fecha_creacion, fecha_actualizacion, creado_por)
    VALUES
      (?, ?, ?, 0,
       'creado', ?, ?, ?, ?)
  `).run(
    producto.proveedor_id,
    producto.id,
    cantidadSolicitada,
    `Pedido automático (PUSH). Objetivo: ${objetivo}`,
    now,
    now,
    usuarioId || null
  );

  const pedidoId = ins.lastInsertRowid;

  db.prepare(`
    INSERT INTO pedidos_proveedor_eventos
      (pedido_id, estado, comentario, fecha, usuario_id)
    VALUES
      (?, 'creado', ?, ?, ?)
  `).run(
    pedidoId,
    "Pedido creado automáticamente por estrategia PUSH",
    now,
    usuarioId || null
  );

  console.log(`[PUSH] Pedido automático creado: #${pedidoId} (cant=${cantidadSolicitada})`);
}

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


  const cant = Number(cantidad);
  const stockActual = getStock(producto);
  const nuevoStock = tipo === "entrada" ? stockActual + cant : stockActual - cant;

  if (nuevoStock < 0) {
    return res.status(409).json({ error: "Stock insuficiente para salida" });
  }

  const fecha = new Date().toISOString();


  const tx = db.transaction(() => {
    // Insert de movimientos (con columnas completas)
    db.prepare(`
      INSERT INTO movimientos_inventario
      (producto_id, tipo, cantidad, motivo, referencia, fecha, usuario_id)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(producto_id, tipo, cant, motivo, referencia, fecha, req.user.id);

    // Update stock
    setStock(db, producto_id, nuevoStock);
  });

  try {
    tx();
  } catch (e) {
    return res.status(500).json({ error: "Error al registrar movimiento", detail: String(e?.message || e) });
  }
  cerrarAlertasSiYaNoAplica(db, producto_id);
  const updated = db.prepare("SELECT * FROM productos WHERE id = ?").get(producto_id);

  // ✅ genera alerta si stock bajo
  crearAlertaStockBajoSiAplica({ db, producto: updated, usuarioId: req.user?.id });

  res.status(201).json({ ok: true, producto: updated });
});

// GET /api/inventario/producto/:id (historial por producto)
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
