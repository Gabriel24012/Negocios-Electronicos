require("dotenv").config();
const express = require("express");
const cors = require("cors");

const { initDB } = require("./src/db/init");

const authRoutes = require("./src/routes/auth.routes");
const clientesRoutes = require("./src/routes/clientes.routes");
const interaccionesRoutes = require("./src/routes/interacciones.routes");
const metricasRoutes = require("./src/routes/metricas.routes");
const proveedoresRoutes = require("./src/routes/proveedores.routes");
const productosRoutes = require("./src/routes/productos.routes");
const inventarioRoutes = require("./src/routes/inventario.routes"); // ✅ IMPORTANTE

const app = express();
app.use(cors());
app.use(express.json());

const path = require("path");
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

app.get("/", (req, res) => {
  res.json({ ok: true, message: "✅ Backend CRM Thrift Cálido activo" });
});

app.use("/api/auth", authRoutes);
app.use("/api/clientes", clientesRoutes);
app.use("/api/interacciones", interaccionesRoutes);
app.use("/api/metricas", metricasRoutes);

app.use("/api/proveedores", proveedoresRoutes);
app.use("/api/productos", productosRoutes);
app.use("/api/inventario", inventarioRoutes);

const PORT = process.env.PORT || 3001;

try {
  initDB();
  console.log("✅ Base de datos inicializada correctamente");
} catch (e) {
  console.error("❌ Error inicializando la BD:", e);
  process.exit(1);
}

app.listen(PORT, () => {
  console.log(`✅ API corriendo en http://localhost:${PORT}`);
});
