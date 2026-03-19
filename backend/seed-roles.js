const bcrypt = require("bcryptjs");
const { initDB, getDB } = require("./src/db/init");

initDB();
const db = getDB();

function crearUsuario({ nombre, email, password, rol }) {
  const existente = db.prepare("SELECT id FROM usuarios WHERE email = ?").get(email);
  if (existente) {
    console.log(`⚠️ Ya existe: ${email}`);
    return;
  }

  const passwordHash = bcrypt.hashSync(password, 10);

  db.prepare(`
    INSERT INTO usuarios (nombre, email, passwordHash, rol)
    VALUES (?, ?, ?, ?)
  `).run(nombre, email, passwordHash, rol);

  console.log(`✅ Usuario creado: ${email} (${rol})`);
}

crearUsuario({
  nombre: "Administrador General",
  email: "admin@thrift.com",
  password: "Admin123*",
  rol: "admin"
});

crearUsuario({
  nombre: "Usuario Ventas",
  email: "ventas@thrift.com",
  password: "Ventas123*",
  rol: "ventas"
});

crearUsuario({
  nombre: "Usuario Logistica",
  email: "logistica@thrift.com",
  password: "Logistica123*",
  rol: "logistica"
});

console.log("🎉 Seed terminado");
process.exit(0);