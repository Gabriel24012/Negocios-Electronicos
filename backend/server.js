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
const inventarioRoutes = require("./src/routes/inventario.routes");
const pedidosProveedorRoutes = require("./src/routes/pedidosProveedor.routes");
const alertasStockRoutes = require("./src/routes/alertasStock.routes");
const ordenesRoutes = require("./src/routes/ordenes.routes");
const erpRoutes = require("./src/routes/erp.routes");
const usuariosRoutes = require("./src/routes/usuarios.routes");
const mensajesClienteRoutes = require("./src/routes/mensajesCliente.routes");


// ✅ FALTABAN ESTAS DOS
const procesosErpRoutes = require("./src/routes/procesosErp.routes");
const recursosErpRoutes = require("./src/routes/recursosErp.routes");

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
app.use("/api/pedidos-proveedor", pedidosProveedorRoutes);
app.use("/api/alertas-stock", alertasStockRoutes);

app.use("/api/ordenes", ordenesRoutes);
app.use("/api/erp", erpRoutes);
app.use("/api/procesos-erp", procesosErpRoutes);
app.use("/api/recursos-erp", recursosErpRoutes);
app.use("/api/usuarios", usuariosRoutes);
app.use("/api/mensajes-cliente", mensajesClienteRoutes);

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
