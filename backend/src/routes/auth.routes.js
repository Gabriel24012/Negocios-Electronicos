const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { getDB } = require("../db/init");

const router = express.Router();

/**
 * POST /api/auth/seed
 * Crea un admin de prueba (solo desarrollo)
 */
router.post("/seed", (req, res) => {
  const db = getDB();

  const email = "admin@thriftcalido.com";
  const password = "admin123";

  const exists = db.prepare("SELECT id FROM usuarios WHERE email = ?").get(email);
  if (exists) {
    return res.json({ ok: true, message: "⚠️ Usuario admin ya existe" });
  }

  const hash = bcrypt.hashSync(password, 10);

  db.prepare(
    `INSERT INTO usuarios (nombre, email, passwordHash, rol)
     VALUES (?, ?, ?, ?)`
  ).run("Administrador", email, hash, "admin");

  res.json({
    ok: true,
    message: "✅ Usuario admin creado",
    credentials: { email, password }
  });
});

/**
 * POST /api/auth/register
 * Registra usuario (rol usuario) + crea cliente prospecto + interacción registro
 */
router.post("/register", (req, res) => {
  const { nombre, email, password } = req.body || {};
  if (!nombre || !email || !password) {
    return res.status(400).json({ error: "Faltan datos" });
  }

  const db = getDB();

  // 1) validar email único en usuarios
  const existsUser = db.prepare("SELECT id FROM usuarios WHERE email = ?").get(email.trim());
  if (existsUser) return res.status(409).json({ error: "El correo ya está registrado" });

  // 2) crear usuario
  const passwordHash = bcrypt.hashSync(password, 10);
  const rUser = db.prepare(
    `INSERT INTO usuarios (nombre, email, passwordHash, rol)
     VALUES (?, ?, ?, ?)`
  ).run(nombre.trim(), email.trim(), passwordHash, "usuario");

  const userId = rUser.lastInsertRowid;

  // 3) crear/obtener cliente (prospecto)
  let cliente = db.prepare("SELECT * FROM clientes WHERE correo = ?").get(email.trim());

  if (!cliente) {
    const fecha_registro = new Date().toISOString();
    const estado = "activo";
    const etapa_crm = "Prospecto";

    const rCliente = db.prepare(
      `INSERT INTO clientes (nombre, correo, telefono, empresa, fecha_registro, estado, etapa_crm)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).run(nombre.trim(), email.trim(), "", "", fecha_registro, estado, etapa_crm);

    cliente = db.prepare("SELECT * FROM clientes WHERE id = ?").get(rCliente.lastInsertRowid);
  }

  // 4) interacción automática de registro
  const fecha = new Date().toISOString();
  db.prepare(
    `INSERT INTO interacciones (cliente_id, tipo, descripcion, fecha, usuario_id)
     VALUES (?, ?, ?, ?, ?)`
  ).run(cliente.id, "registro", "Cliente se registró en el sitio", fecha, userId);

  // 5) token
  const token = jwt.sign(
    { id: userId, rol: "usuario", email: email.trim() },
    process.env.JWT_SECRET,
    { expiresIn: "2h" }
  );

  return res.status(201).json({
    ok: true,
    token,
    user: { id: userId, nombre: nombre.trim(), email: email.trim(), rol: "usuario" },
    cliente: { id: cliente.id, etapa_crm: cliente.etapa_crm }
  });
});

/**
 * POST /api/auth/login
 */
router.post("/login", (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: "Faltan datos" });

  const db = getDB();
  const user = db.prepare("SELECT * FROM usuarios WHERE email = ?").get(email.trim());
  if (!user) return res.status(401).json({ error: "Credenciales inválidas" });

  const ok = bcrypt.compareSync(password, user.passwordHash);
  if (!ok) return res.status(401).json({ error: "Credenciales inválidas" });

  const token = jwt.sign(
    { id: user.id, rol: user.rol, email: user.email },
    process.env.JWT_SECRET,
    { expiresIn: "2h" }
  );

  res.json({
    token,
    user: { id: user.id, nombre: user.nombre, email: user.email, rol: user.rol }
  });
});

module.exports = router;