(function () {
  const token = localStorage.getItem("token");
  const rol = localStorage.getItem("rol");

  if (!token) {
    window.location.href = "../login.html";
    return;
  }

  const rolesPermitidosERP = ["admin", "ventas", "logistica"];
  if (!rolesPermitidosERP.includes(rol)) {
    window.location.href = "../login.html";
    return;
  }

  const msgBox = document.getElementById("msgBox");

  const ordCliente = document.getElementById("ord_cliente");
  const ordProducto = document.getElementById("ord_producto");
  const ordCantidad = document.getElementById("ord_cantidad");
  const ordenItemsBody = document.getElementById("ordenItemsBody");
  const ordenTotal = document.getElementById("ordenTotal");
  const ordenesBody = document.getElementById("ordenesBody");
  const btnAgregarItem = document.getElementById("btnAgregarItem");
  const formOrden = document.getElementById("formOrden");
  const btnReloadOrdenes = document.getElementById("btnReloadOrdenes");

  const erpNivel = document.getElementById("erp_nivel");
  const erpProgress = document.getElementById("erpProgress");
  const btnGuardarNivelERP = document.getElementById("btnGuardarNivelERP");

  const clientesERPBody = document.getElementById("clientesERPBody");
  const inventarioERPBody = document.getElementById("inventarioERPBody");
  const procesosERPGrid = document.getElementById("procesosERPGrid");
  const recursosERPBody = document.getElementById("recursosERPBody");

  const btnReloadClientesERP = document.getElementById("btnReloadClientesERP");
  const btnReloadInventarioERP = document.getElementById("btnReloadInventarioERP");
  const btnReloadProcesosERP = document.getElementById("btnReloadProcesosERP");
  const btnReloadRecursosERP = document.getElementById("btnReloadRecursosERP");

  const formProcesoERP = document.getElementById("formProcesoERP");
  const formRecursoERP = document.getElementById("formRecursoERP");

  let CLIENTES = [];
  let PRODUCTOS = [];
  let ORDEN_ITEMS = [];

  let chartERP = null;
  let chartVentasMensualesERP = null;
  let chartOrdenesEstadoERP = null;

  function showMsg(text, type = "success") {
    if (!msgBox) return;
    msgBox.innerHTML = `<div class="alert alert-${type}">${text}</div>`;
    setTimeout(() => (msgBox.innerHTML = ""), 2500);
  }

  function escapeHtml(str) {
    return String(str ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function fmtDate(iso) {
    try {
      return new Date(iso).toLocaleString("es-MX");
    } catch {
      return iso;
    }
  }

  function money(n) {
    return `$${Number(n || 0).toFixed(2)}`;
  }

  function hasRole(...roles) {
    return roles.includes(rol);
  }

  function applyRoleUI() {
    const tabButtons = document.querySelectorAll('[data-bs-toggle="tab"]');

    const allowed = {
      admin: ["#tabOrdenes", "#tabClientesERP", "#tabInventarioERP", "#tabProcesosERP", "#tabRecursosERP", "#tabEstadoERP", "#tabMetricasERP"],
      ventas: ["#tabOrdenes", "#tabClientesERP", "#tabMetricasERP"],
      logistica: ["#tabInventarioERP", "#tabProcesosERP", "#tabRecursosERP", "#tabMetricasERP"]
    };

    tabButtons.forEach(btn => {
      const target = btn.getAttribute("data-bs-target");
      if (!allowed[rol].includes(target)) {
        btn.parentElement.style.display = "none";
      }
    });

    if (!hasRole("admin", "ventas")) {
      const ordenCol = formOrden?.closest(".col-lg-5");
      if (ordenCol) ordenCol.style.display = "none";
    }

    if (!hasRole("admin")) {
      if (btnGuardarNivelERP) btnGuardarNivelERP.style.display = "none";
      if (erpNivel) erpNivel.disabled = true;
    }

    if (!hasRole("admin", "logistica")) {
      const procesoCol = formProcesoERP?.closest(".col-lg-4");
      const recursoCol = formRecursoERP?.closest(".col-lg-4");
      if (procesoCol) procesoCol.style.display = "none";
      if (recursoCol) recursoCol.style.display = "none";
    }

    const firstVisible = Array.from(document.querySelectorAll(".nav-link"))
      .find(btn => btn.parentElement.style.display !== "none");

    if (firstVisible) {
      bootstrap.Tab.getOrCreateInstance(firstVisible).show();
    }
  }

  function renderItems() {
    if (!ordenItemsBody || !ordenTotal) return;

    if (!ORDEN_ITEMS.length) {
      ordenItemsBody.innerHTML = `<tr><td colspan="5" class="text-center text-muted">Sin productos agregados</td></tr>`;
      ordenTotal.textContent = "$0.00";
      return;
    }

    let total = 0;

    ordenItemsBody.innerHTML = ORDEN_ITEMS.map((it, idx) => {
      const subtotal = Number(it.precio) * Number(it.cantidad);
      total += subtotal;

      return `
        <tr>
          <td>${escapeHtml(it.nombre)}</td>
          <td>${it.cantidad}</td>
          <td>${money(it.precio)}</td>
          <td>${money(subtotal)}</td>
          <td>
            <button class="btn btn-sm btn-outline-danger" data-remove-item="${idx}">
              <i class="bi bi-x"></i>
            </button>
          </td>
        </tr>
      `;
    }).join("");

    ordenTotal.textContent = money(total);
  }

  async function loadClientes() {
    if (!hasRole("admin", "ventas")) return;

    CLIENTES = await apiFetch("/clientes", { method: "GET" });

    const clientesOptions =
      `<option value="">Selecciona cliente...</option>` +
      CLIENTES.map(c => `<option value="${c.id}">${escapeHtml(c.nombre)} (#${c.id})</option>`).join("");

    if (ordCliente) {
      ordCliente.innerHTML = clientesOptions;
    }

    if (clientesERPBody) {
      if (!CLIENTES.length) {
        clientesERPBody.innerHTML = `<tr><td colspan="6" class="text-center text-muted">Sin clientes</td></tr>`;
      } else {
        clientesERPBody.innerHTML = CLIENTES.map(c => `
          <tr>
            <td>${c.id}</td>
            <td>${escapeHtml(c.nombre)}</td>
            <td>${escapeHtml(c.correo)}</td>
            <td>${escapeHtml(c.empresa || "")}</td>
            <td><span class="badge ${c.estado === "activo" ? "bg-success" : "bg-danger"}">${escapeHtml(c.estado)}</span></td>
            <td>${escapeHtml(c.etapa_crm || "")}</td>
          </tr>
        `).join("");
      }
    }
  }

  async function loadProductos() {
    if (!hasRole("admin", "ventas", "logistica")) return;

    PRODUCTOS = await apiFetch("/productos", { method: "GET" });

    if (ordProducto && hasRole("admin", "ventas")) {
      ordProducto.innerHTML =
        `<option value="">Selecciona producto...</option>` +
        PRODUCTOS.map(p => `<option value="${p.id}">${escapeHtml(p.nombre)} (#${p.id})</option>`).join("");
    }

    if (inventarioERPBody && hasRole("admin", "logistica")) {
      if (!PRODUCTOS.length) {
        inventarioERPBody.innerHTML = `<tr><td colspan="6" class="text-center text-muted">Sin productos</td></tr>`;
      } else {
        inventarioERPBody.innerHTML = PRODUCTOS.map(p => {
          const stock = Number(p.stock_actual ?? p.stock ?? 0);
          const min = Number(p.stock_minimo ?? 0);
          const estado = stock <= min ? "Stock bajo" : "Normal";

          return `
            <tr>
              <td>${p.id}</td>
              <td>${escapeHtml(p.nombre)}</td>
              <td>${stock}</td>
              <td>${min}</td>
              <td>${escapeHtml(p.estrategia_logistica || "")}</td>
              <td><span class="badge ${stock <= min ? "bg-danger" : "bg-success"}">${estado}</span></td>
            </tr>
          `;
        }).join("");
      }
    }
  }

  async function loadOrdenes() {
    if (!hasRole("admin", "ventas") || !ordenesBody) return;

    const rows = await apiFetch("/ordenes", { method: "GET" });

    if (!rows.length) {
      ordenesBody.innerHTML = `<tr><td colspan="6" class="text-center text-muted">Sin órdenes aún</td></tr>`;
      return;
    }

    ordenesBody.innerHTML = rows.map(o => `
      <tr>
        <td>${o.id}</td>
        <td>${escapeHtml(o.cliente_nombre)}</td>
        <td>${fmtDate(o.fecha)}</td>
        <td>
          <span class="badge ${
            o.estado === "completada" ? "bg-success" :
            o.estado === "procesando" ? "bg-primary" :
            o.estado === "cancelada" ? "bg-danger" : "bg-secondary"
          }">
            ${escapeHtml(o.estado)}
          </span>
        </td>
        <td>${money(o.total)}</td>
        <td class="d-flex gap-1 flex-wrap">
          <button class="btn btn-sm btn-outline-primary" data-procesar="${o.id}" ${o.estado !== "pendiente" ? "disabled" : ""}>
            Procesar
          </button>
          <button class="btn btn-sm btn-outline-warning" data-estado="${o.id}" data-value="procesando" ${o.estado !== "pendiente" ? "disabled" : ""}>
            Procesando
          </button>
          <button class="btn btn-sm btn-outline-success" data-estado="${o.id}" data-value="completada" ${o.estado === "cancelada" ? "disabled" : ""}>
            Completar
          </button>
          <button class="btn btn-sm btn-outline-danger" data-estado="${o.id}" data-value="cancelada" ${o.estado === "completada" ? "disabled" : ""}>
            Cancelar
          </button>
        </td>
      </tr>
    `).join("");
  }

  async function loadProcesosERP() {
    if (!hasRole("admin", "logistica") || !procesosERPGrid) return;

    const rows = await apiFetch("/procesos-erp", { method: "GET" });

    if (!rows.length) {
      procesosERPGrid.innerHTML = `<div class="col-12"><div class="text-center text-muted">Sin procesos aún</div></div>`;
      return;
    }

    procesosERPGrid.innerHTML = rows.map(p => `
      <div class="col-md-6">
        <div class="border rounded p-3 h-100">
          <div class="d-flex justify-content-between align-items-center mb-2">
            <span class="badge ${
              p.estado === "activo" ? "bg-success" :
              p.estado === "pausado" ? "bg-warning text-dark" : "bg-primary"
            }">${escapeHtml(p.estado)}</span>
            <strong>${escapeHtml(p.codigo)}</strong>
          </div>
          <h6 class="fw-bold mb-1">${escapeHtml(p.nombre)}</h6>
          <p class="text-muted small mb-2">${escapeHtml(p.descripcion || "")}</p>
          <div class="small mb-1">Progreso: ${Number(p.progreso || 0)}%</div>
          <div class="progress mb-2" style="height: 10px;">
            <div class="progress-bar" style="width:${Number(p.progreso || 0)}%"></div>
          </div>
          <div class="small text-muted">
            Inicio: ${fmtDate(p.fecha_inicio)} ${p.referencia ? `· Ref: ${escapeHtml(p.referencia)}` : ""}
          </div>
        </div>
      </div>
    `).join("");
  }

  async function loadRecursosERP() {
    if (!hasRole("admin", "logistica") || !recursosERPBody) return;

    const rows = await apiFetch("/recursos-erp", { method: "GET" });

    if (!rows.length) {
      recursosERPBody.innerHTML = `<tr><td colspan="6" class="text-center text-muted">Sin recursos aún</td></tr>`;
      return;
    }

    recursosERPBody.innerHTML = rows.map(r => `
      <tr>
        <td>${r.id}</td>
        <td>${escapeHtml(r.codigo)}</td>
        <td>${escapeHtml(r.nombre)}</td>
        <td>${escapeHtml(r.tipo)}</td>
        <td>${escapeHtml(r.departamento)}</td>
        <td><span class="badge ${
          r.estado === "disponible" ? "bg-success" :
          r.estado === "asignado" ? "bg-primary" : "bg-warning text-dark"
        }">${escapeHtml(r.estado)}</span></td>
      </tr>
    `).join("");
  }

  function setERPProgress(nivel) {
    if (!erpProgress) return;

    const map = {
      "Básico": 25,
      "Integrado": 50,
      "Automatizado": 75,
      "Optimizado": 100
    };

    const val = map[nivel] || 25;
    erpProgress.style.width = `${val}%`;
    erpProgress.textContent = nivel;
  }

  function renderChartResumenERP(metricas) {
    const ctx = document.getElementById("chartERPMetricas");
    if (!ctx) return;

    if (chartERP) chartERP.destroy();

    chartERP = new Chart(ctx, {
      type: "bar",
      data: {
        labels: ["Ventas", "Órdenes", "Vendidos", "Clientes activos", "Inventario"],
        datasets: [{
          label: "ERP",
          data: [
            Number(metricas.ventas_totales || 0),
            Number(metricas.ordenes_total || metricas.ordenes_procesadas || 0),
            Number(metricas.productos_vendidos || 0),
            Number(metricas.clientes_activos || 0),
            Number(metricas.inventario_disponible || 0)
          ]
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { position: "bottom" } },
        scales: { y: { beginAtZero: true } }
      }
    });
  }

  function renderChartVentasMensuales(metricas) {
    const ctx = document.getElementById("chartVentasMensualesERP");
    if (!ctx) return;

    if (chartVentasMensualesERP) chartVentasMensualesERP.destroy();

    const rows = Array.isArray(metricas.ventas_mensuales) ? metricas.ventas_mensuales : [];
    const labels = rows.map(r => r.mes);
    const data = rows.map(r => Number(r.total || 0));

    chartVentasMensualesERP = new Chart(ctx, {
      type: "bar",
      data: {
        labels,
        datasets: [{
          label: "Ventas por mes",
          data
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { position: "bottom" } },
        scales: { y: { beginAtZero: true } }
      }
    });
  }

  function renderChartOrdenesEstado(metricas) {
    const ctx = document.getElementById("chartOrdenesEstadoERP");
    if (!ctx) return;

    if (chartOrdenesEstadoERP) chartOrdenesEstadoERP.destroy();

    const estados = metricas.ordenes_por_estado || {};

    chartOrdenesEstadoERP = new Chart(ctx, {
      type: "doughnut",
      data: {
        labels: ["Pendiente", "Procesando", "Procesada", "Completada", "Cancelada"],
        datasets: [{
          data: [
            Number(estados.pendiente || 0),
            Number(estados.procesando || 0),
            Number(estados.procesada || 0),
            Number(estados.completada || 0),
            Number(estados.cancelada || 0)
          ]
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { position: "bottom" } }
      }
    });
  }

  async function loadEstadoERP() {
    const estado = await apiFetch("/erp/estado", { method: "GET" });
    if (erpNivel) erpNivel.value = estado.nivel || "Básico";
    setERPProgress(estado.nivel || "Básico");
  }

  async function loadMetricasERP() {
    const m = await apiFetch("/erp/metricas", { method: "GET" });

    const kpiVentas = document.getElementById("kpiVentasERP");
    const kpiOrdenes = document.getElementById("kpiOrdenesERP");
    const kpiProductos = document.getElementById("kpiProductosERP");
    const kpiInventario = document.getElementById("kpiInventarioERP");

    if (kpiVentas) kpiVentas.textContent = money(m.ventas_totales);
    if (kpiOrdenes) kpiOrdenes.textContent = m.ordenes_total ?? m.ordenes_procesadas ?? 0;
    if (kpiProductos) kpiProductos.textContent = m.productos_vendidos ?? 0;
    if (kpiInventario) kpiInventario.textContent = m.inventario_disponible ?? 0;

    renderChartResumenERP(m);
    renderChartVentasMensuales(m);
    renderChartOrdenesEstado(m);
  }

  btnAgregarItem?.addEventListener("click", () => {
    const productoId = Number(ordProducto.value);
    const cantidad = Number(ordCantidad.value || 0);

    if (!productoId || cantidad <= 0) {
      showMsg("❌ Selecciona producto y cantidad válida", "danger");
      return;
    }

    const producto = PRODUCTOS.find(p => Number(p.id) === productoId);
    if (!producto) {
      showMsg("❌ Producto inválido", "danger");
      return;
    }

    ORDEN_ITEMS.push({
      producto_id: producto.id,
      nombre: producto.nombre,
      cantidad,
      precio: Number(producto.costo_unitario ?? producto.precio ?? 0)
    });

    renderItems();
  });

  formOrden?.addEventListener("submit", async (e) => {
    e.preventDefault();

    if (!ordCliente.value) {
      showMsg("❌ Selecciona cliente", "danger");
      return;
    }

    if (!ORDEN_ITEMS.length) {
      showMsg("❌ Agrega al menos un producto", "danger");
      return;
    }

    try {
      await apiFetch("/ordenes", {
        method: "POST",
        body: JSON.stringify({
          cliente_id: Number(ordCliente.value),
          items: ORDEN_ITEMS.map(i => ({
            producto_id: i.producto_id,
            cantidad: i.cantidad
          }))
        })
      });

      showMsg("✅ Orden creada");
      formOrden.reset();
      ORDEN_ITEMS = [];
      renderItems();
      await loadOrdenes();
      await loadMetricasERP();
    } catch (e) {
      showMsg("❌ " + e.message, "danger");
    }
  });

  formProcesoERP?.addEventListener("submit", async (e) => {
    e.preventDefault();

    try {
      await apiFetch("/procesos-erp", {
        method: "POST",
        body: JSON.stringify({
          codigo: document.getElementById("pro_codigo").value.trim(),
          nombre: document.getElementById("pro_nombre").value.trim(),
          descripcion: document.getElementById("pro_descripcion").value.trim(),
          estado: document.getElementById("pro_estado").value,
          progreso: Number(document.getElementById("pro_progreso").value || 0),
          referencia: document.getElementById("pro_referencia").value.trim()
        })
      });

      formProcesoERP.reset();
      showMsg("✅ Proceso registrado");
      await loadProcesosERP();
    } catch (e) {
      showMsg("❌ " + e.message, "danger");
    }
  });

  formRecursoERP?.addEventListener("submit", async (e) => {
    e.preventDefault();

    try {
      await apiFetch("/recursos-erp", {
        method: "POST",
        body: JSON.stringify({
          codigo: document.getElementById("rec_codigo").value.trim(),
          nombre: document.getElementById("rec_nombre").value.trim(),
          tipo: document.getElementById("rec_tipo").value,
          departamento: document.getElementById("rec_departamento").value.trim(),
          estado: document.getElementById("rec_estado").value
        })
      });

      formRecursoERP.reset();
      showMsg("✅ Recurso registrado");
      await loadRecursosERP();
    } catch (e) {
      showMsg("❌ " + e.message, "danger");
    }
  });

  btnReloadOrdenes?.addEventListener("click", async () => {
    try { await loadOrdenes(); } catch (e) { showMsg("❌ " + e.message, "danger"); }
  });

  btnReloadClientesERP?.addEventListener("click", async () => {
    try { await loadClientes(); } catch (e) { showMsg("❌ " + e.message, "danger"); }
  });

  btnReloadInventarioERP?.addEventListener("click", async () => {
    try { await loadProductos(); } catch (e) { showMsg("❌ " + e.message, "danger"); }
  });

  btnReloadProcesosERP?.addEventListener("click", async () => {
    try { await loadProcesosERP(); } catch (e) { showMsg("❌ " + e.message, "danger"); }
  });

  btnReloadRecursosERP?.addEventListener("click", async () => {
    try { await loadRecursosERP(); } catch (e) { showMsg("❌ " + e.message, "danger"); }
  });

  btnGuardarNivelERP?.addEventListener("click", async () => {
    try {
      await apiFetch("/erp/estado", {
        method: "PUT",
        body: JSON.stringify({ nivel: erpNivel.value })
      });

      setERPProgress(erpNivel.value);
      showMsg("✅ Estado ERP actualizado");
    } catch (e) {
      showMsg("❌ " + e.message, "danger");
    }
  });

  document.addEventListener("click", async (e) => {
    const btnRemove = e.target.closest("button[data-remove-item]");
    if (btnRemove) {
      const idx = Number(btnRemove.dataset.removeItem);
      ORDEN_ITEMS.splice(idx, 1);
      renderItems();
      return;
    }

    const btnProcesar = e.target.closest("button[data-procesar]");
    if (btnProcesar) {
      const id = Number(btnProcesar.dataset.procesar);

      try {
        await apiFetch(`/ordenes/procesar/${id}`, { method: "POST" });
        showMsg("✅ Orden procesada");
        await loadOrdenes();
        await loadProductos();
        await loadMetricasERP();
      } catch (e) {
        showMsg("❌ " + e.message, "danger");
      }
      return;
    }

    const btnEstado = e.target.closest("button[data-estado]");
    if (btnEstado) {
      const id = Number(btnEstado.dataset.estado);
      const estado = btnEstado.dataset.value;

      try {
        await apiFetch(`/ordenes/${id}/estado`, {
          method: "PUT",
          body: JSON.stringify({ estado })
        });

        showMsg("✅ Estado actualizado");
        await loadOrdenes();
        await loadMetricasERP();
      } catch (e) {
        showMsg("❌ " + e.message, "danger");
      }
    }
  });

  (async () => {
    try {
      applyRoleUI();
      renderItems();
      await loadClientes();
      await loadProductos();
      await loadOrdenes();
      await loadEstadoERP();
      await loadMetricasERP();
      await loadProcesosERP();
      await loadRecursosERP();
    } catch (e) {
      console.error(e);
      showMsg("❌ " + e.message, "danger");
    }
  })();
})();
