// backend/src/db/init.js
const Database = require("better-sqlite3");

let db;

function ensureColumn(table, column, definition) {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all();
  const exists = cols.some((c) => c.name === column);
  if (!exists) {
    db.prepare(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`).run();
  }
}

function initDB() {
  if (db) return db;

  db = new Database("thriftcalido.db");
  db.pragma("foreign_keys = ON");

  db.prepare(`
    CREATE TABLE IF NOT EXISTS usuarios (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nombre TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      passwordHash TEXT NOT NULL,
      rol TEXT NOT NULL DEFAULT 'usuario',
      telefono TEXT DEFAULT '',
      direccion TEXT DEFAULT '',
      codigo_postal TEXT DEFAULT ''
    )
  `).run();

  // Migration for existing databases that do not include profile fields yet.
  ensureColumn("usuarios", "telefono", "TEXT DEFAULT ''");
  ensureColumn("usuarios", "direccion", "TEXT DEFAULT ''");
  ensureColumn("usuarios", "codigo_postal", "TEXT DEFAULT ''");

  db.prepare(`
    CREATE TABLE IF NOT EXISTS clientes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nombre TEXT NOT NULL,
      correo TEXT NOT NULL UNIQUE,
      telefono TEXT DEFAULT '',
      empresa TEXT DEFAULT '',
      fecha_registro TEXT NOT NULL,
      estado TEXT NOT NULL DEFAULT 'activo',
      etapa_crm TEXT NOT NULL DEFAULT 'Prospecto'
    )
  `).run();

  db.prepare(`
    CREATE TABLE IF NOT EXISTS interacciones (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      cliente_id INTEGER NOT NULL,
      tipo TEXT NOT NULL,
      descripcion TEXT NOT NULL,
      fecha TEXT NOT NULL,
      usuario_id INTEGER NOT NULL,
      FOREIGN KEY (cliente_id) REFERENCES clientes(id) ON DELETE CASCADE,
      FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE
    )
  `).run();

  db.prepare(`
    CREATE TABLE IF NOT EXISTS metricas (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      fecha TEXT NOT NULL,
      total_clientes INTEGER NOT NULL,
      clientes_activos INTEGER NOT NULL,
      clientes_inactivos INTEGER NOT NULL,
      total_interacciones INTEGER NOT NULL,
      generado_por INTEGER,
      FOREIGN KEY (generado_por) REFERENCES usuarios(id) ON DELETE SET NULL
    )
  `).run();

  db.prepare(`
    CREATE TABLE IF NOT EXISTS proveedores (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nombre TEXT NOT NULL,
      contacto TEXT NOT NULL,
      correo TEXT NOT NULL,
      telefono TEXT NOT NULL
    )
  `).run();

  // Productos (tu BD ya usa stock_actual/stock_minimo)
  db.prepare(`
    CREATE TABLE IF NOT EXISTS productos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nombre TEXT NOT NULL,
      descripcion TEXT NOT NULL,
      categoria TEXT NOT NULL,
      stock_actual INTEGER NOT NULL DEFAULT 0,
      stock_minimo INTEGER NOT NULL DEFAULT 0,
      proveedor_id INTEGER NOT NULL,
      costo_unitario REAL NOT NULL DEFAULT 0,
      estrategia_logistica TEXT NOT NULL DEFAULT 'PULL',
      FOREIGN KEY (proveedor_id) REFERENCES proveedores(id) ON DELETE RESTRICT
    )
  `).run();

  // ✅ Movimientos inventario (agregamos referencia y usuario_id porque tu inventario lo usa)
  db.prepare(`
    CREATE TABLE IF NOT EXISTS movimientos_inventario (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      producto_id INTEGER NOT NULL,
      tipo TEXT NOT NULL,                 -- entrada/salida
      cantidad INTEGER NOT NULL,
      motivo TEXT NOT NULL,               -- venta/ajuste/reposicion/devolucion
      referencia TEXT NOT NULL DEFAULT '',
      fecha TEXT NOT NULL,
      usuario_id INTEGER,
      FOREIGN KEY (producto_id) REFERENCES productos(id) ON DELETE CASCADE,
      FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE SET NULL
    )
  `).run();

  // (Opcional) pedidos viejos que ya tenías
  db.prepare(`
    CREATE TABLE IF NOT EXISTS pedidos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      producto_id INTEGER NOT NULL,
      cantidad INTEGER NOT NULL,
      tipo TEXT NOT NULL,                 -- reposicion/venta
      estado TEXT NOT NULL DEFAULT 'pendiente', -- pendiente/surtido
      fecha TEXT NOT NULL,
      FOREIGN KEY (producto_id) REFERENCES productos(id) ON DELETE CASCADE
    )
  `).run();

  // ✅ Alertas de stock bajo
  db.prepare(`
    CREATE TABLE IF NOT EXISTS alertas_stock (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      producto_id INTEGER NOT NULL,
      proveedor_id INTEGER NOT NULL,
      stock_actual INTEGER NOT NULL,
      stock_minimo INTEGER NOT NULL,
      faltan INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'pendiente', -- pendiente/resuelta/ignorada
      fecha TEXT NOT NULL,
      generado_por INTEGER,
      FOREIGN KEY (producto_id) REFERENCES productos(id) ON DELETE CASCADE,
      FOREIGN KEY (proveedor_id) REFERENCES proveedores(id) ON DELETE RESTRICT,
      FOREIGN KEY (generado_por) REFERENCES usuarios(id) ON DELETE SET NULL
    )
  `).run();

  // ✅ Pedidos a proveedor + seguimiento
  db.prepare(`
    CREATE TABLE IF NOT EXISTS pedidos_proveedor (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      proveedor_id INTEGER NOT NULL,
      producto_id INTEGER NOT NULL,
      cantidad_solicitada INTEGER NOT NULL,
      cantidad_recibida INTEGER NOT NULL DEFAULT 0,
      estado TEXT NOT NULL DEFAULT 'creado', -- creado/enviado/confirmado/en_transito/recibido/cancelado
      nota TEXT DEFAULT '',
      fecha_creacion TEXT NOT NULL,
      fecha_actualizacion TEXT NOT NULL,
      creado_por INTEGER,
      FOREIGN KEY (proveedor_id) REFERENCES proveedores(id) ON DELETE RESTRICT,
      FOREIGN KEY (producto_id) REFERENCES productos(id) ON DELETE RESTRICT,
      FOREIGN KEY (creado_por) REFERENCES usuarios(id) ON DELETE SET NULL
    )
  `).run();

  db.prepare(`
    CREATE TABLE IF NOT EXISTS pedidos_proveedor_eventos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      pedido_id INTEGER NOT NULL,
      estado TEXT NOT NULL,
      comentario TEXT DEFAULT '',
      fecha TEXT NOT NULL,
      usuario_id INTEGER,
      FOREIGN KEY (pedido_id) REFERENCES pedidos_proveedor(id) ON DELETE CASCADE,
      FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE SET NULL
    )
  `).run();

  return db;
}

function getDB() {
  if (!db) initDB();
  return db;
}

module.exports = { initDB, getDB };
