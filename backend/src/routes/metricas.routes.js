const express = require("express");
const { getDB } = require("../db/init");
const { auth } = require("../middleware/auth");

const router = express.Router();

// GET /api/metricas  -> calcula + guarda snapshot
router.get("/", auth, (req, res) => {
  const db = getDB();

  const totalClientes = db.prepare("SELECT COUNT(*) as total FROM clientes").get();
  const activos = db.prepare("SELECT COUNT(*) as total FROM clientes WHERE estado='activo'").get();
  const inactivos = db.prepare("SELECT COUNT(*) as total FROM clientes WHERE estado='inactivo'").get();
  const totalInteracciones = db.prepare("SELECT COUNT(*) as total FROM interacciones").get();

  const fecha = new Date().toISOString();

  db.prepare(
    `INSERT INTO metricas 
      (fecha, total_clientes, clientes_activos, clientes_inactivos, total_interacciones, generado_por)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(
    fecha,
    totalClientes.total,
    activos.total,
    inactivos.total,
    totalInteracciones.total,
    req.user.id
  );

  res.json({
    fecha,
    total_clientes: totalClientes.total,
    clientes_activos: activos.total,
    clientes_inactivos: inactivos.total,
    total_interacciones: totalInteracciones.total
  });
});

// GET /api/metricas/historico  -> muestra la tabla "metricas"
router.get("/historico", auth, (req, res) => {
  const db = getDB();
  const rows = db
    .prepare("SELECT * FROM metricas ORDER BY id DESC LIMIT 50")
    .all();
  res.json(rows);
});

// ✅ GET /api/metricas/productos/top?limit=10
router.get("/productos/top", auth, (req, res) => {
  const db = getDB();
  const limit = Math.min(50, Math.max(1, Number(req.query.limit ?? 10)));

  const rows = db.prepare(`
    SELECT
      p.id,
      p.nombre,
      SUM(mi.cantidad) AS unidades_vendidas
    FROM movimientos_inventario mi
    JOIN productos p ON p.id = mi.producto_id
    WHERE mi.tipo = 'salida' AND mi.motivo = 'venta'
    GROUP BY p.id
    ORDER BY unidades_vendidas DESC
    LIMIT ?
  `).all(limit);

  res.json(rows);
});

// ✅ GET /api/metricas/productos/bottom?limit=10
router.get("/productos/bottom", auth, (req, res) => {
  const db = getDB();
  const limit = Math.min(50, Math.max(1, Number(req.query.limit ?? 10)));

  const rows = db.prepare(`
    SELECT
      p.id,
      p.nombre,
      COALESCE(SUM(mi.cantidad), 0) AS unidades_vendidas
    FROM productos p
    LEFT JOIN movimientos_inventario mi
      ON p.id = mi.producto_id AND mi.tipo = 'salida' AND mi.motivo = 'venta'
    GROUP BY p.id
    ORDER BY unidades_vendidas ASC
    LIMIT ?
  `).all(limit);

  res.json(rows);
});

// ✅ GET /api/metricas/inventario/bajo
router.get("/inventario/bajo", auth, (req, res) => {
  const db = getDB();

  const rows = db.prepare(`
    SELECT
      p.*,
      (p.stock_minimo - p.stock_actual) AS faltan
    FROM productos p
    WHERE p.stock_actual <= p.stock_minimo
    ORDER BY faltan DESC
  `).all();

  res.json(rows);
});

module.exports = router;
