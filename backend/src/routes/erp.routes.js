const express = require("express");
const { getDB } = require("../db/init");
const { auth } = require("../middleware/auth");
const { requireRole } = require("../middleware/role");

const router = express.Router();

/**
 * GET /api/erp/estado
 * Roles: admin, ventas, logistica
 */
router.get("/estado", auth, requireRole("admin", "ventas", "logistica"), (req, res) => {
  const db = getDB();
  const estado = db.prepare(`
    SELECT * FROM erp_estado WHERE id = 1
  `).get();

  res.json(estado || { id: 1, nivel: "Básico" });
});

/**
 * PUT /api/erp/estado
 * Body: { nivel }
 * Roles: admin
 */
router.put("/estado", auth, requireRole("admin"), (req, res) => {
  const { nivel } = req.body || {};
  const niveles = ["Básico", "Integrado", "Automatizado", "Optimizado"];

  if (!niveles.includes(nivel)) {
    return res.status(400).json({ error: "Nivel ERP inválido" });
  }

  const db = getDB();

  const existe = db.prepare(`SELECT * FROM erp_estado WHERE id = 1`).get();

  if (!existe) {
    db.prepare(`
      INSERT INTO erp_estado (id, nivel)
      VALUES (1, ?)
    `).run(nivel);
  } else {
    db.prepare(`
      UPDATE erp_estado
      SET nivel = ?
      WHERE id = 1
    `).run(nivel);
  }

  const updated = db.prepare(`SELECT * FROM erp_estado WHERE id = 1`).get();
  res.json(updated);
});

/**
 * GET /api/erp/metricas
 * Roles: admin, ventas, logistica
 */
router.get("/metricas", auth, requireRole("admin", "ventas", "logistica"), (req, res) => {
  const db = getDB();

  const ventas = db.prepare(`
    SELECT COALESCE(SUM(total), 0) AS total
    FROM ordenes
    WHERE estado IN ('procesada', 'completada')
  `).get();

  const ordenesProcesadas = db.prepare(`
    SELECT COUNT(*) AS total
    FROM ordenes
    WHERE estado IN ('procesada', 'completada')
  `).get();

  const ordenesTotal = db.prepare(`
    SELECT COUNT(*) AS total
    FROM ordenes
  `).get();

  const productosVendidos = db.prepare(`
    SELECT COALESCE(SUM(oi.cantidad), 0) AS total
    FROM ordenes_items oi
    JOIN ordenes o ON o.id = oi.orden_id
    WHERE o.estado IN ('procesada', 'completada')
  `).get();

  const clientesActivos = db.prepare(`
    SELECT COUNT(*) AS total
    FROM clientes
    WHERE estado = 'activo'
  `).get();

  const inventarioDisponible = db.prepare(`
    SELECT COALESCE(SUM(stock_actual), 0) AS total
    FROM productos
  `).get();

  const stockBajo = db.prepare(`
    SELECT COUNT(*) AS total
    FROM productos
    WHERE stock_actual <= stock_minimo
  `).get();

  // Órdenes por estado
  const ordenesPorEstadoRows = db.prepare(`
    SELECT estado, COUNT(*) AS total
    FROM ordenes
    GROUP BY estado
  `).all();

  const ordenesPorEstado = {
    pendiente: 0,
    procesando: 0,
    procesada: 0,
    completada: 0,
    cancelada: 0
  };

  for (const row of ordenesPorEstadoRows) {
    ordenesPorEstado[row.estado] = Number(row.total || 0);
  }

  // Ventas mensuales (últimos 6 meses según fecha de orden)
  const ventasMensualesRows = db.prepare(`
    SELECT
      substr(fecha, 1, 7) AS mes,
      COALESCE(SUM(total), 0) AS total
    FROM ordenes
    WHERE estado IN ('procesada', 'completada')
    GROUP BY substr(fecha, 1, 7)
    ORDER BY mes ASC
    LIMIT 6
  `).all();

  res.json({
    ventas_totales: Number(ventas.total || 0),
    ordenes_procesadas: Number(ordenesProcesadas.total || 0),
    ordenes_total: Number(ordenesTotal.total || 0),
    productos_vendidos: Number(productosVendidos.total || 0),
    clientes_activos: Number(clientesActivos.total || 0),
    inventario_disponible: Number(inventarioDisponible.total || 0),
    productos_stock_bajo: Number(stockBajo.total || 0),
    ordenes_por_estado: ordenesPorEstado,
    ventas_mensuales: ventasMensualesRows
  });
});

module.exports = router;