(function () {
  const token = localStorage.getItem("token");
  const rol = localStorage.getItem("rol");

  const warn = document.getElementById("adminWarn");
  const msgBox = document.getElementById("msgBox");

  if (!token) {
    window.location.href = "../login.html";
    return;
  }

  if (rol !== "admin") {
    warn.style.display = "block";
    warn.textContent = "Acceso restringido: esta sección es solo para administradores.";
    setTimeout(() => (window.location.href = "usuarios.html"), 1200);
    return;
  }

  const modalEditCliente = new bootstrap.Modal("#modalEditCliente");
  const modalDelCliente = new bootstrap.Modal("#modalDelCliente");

  const clientesBody = document.getElementById("clientesBody");
  const actividadBody = document.getElementById("actividadBody");
  const historialBody = document.getElementById("historialBody");
  const riesgoBody = document.getElementById("riesgoBody");

  const formCliente = document.getElementById("formCliente");
  const formEditCliente = document.getElementById("formEditCliente");
  const formDelCliente = document.getElementById("formDelCliente");
  const formInteraccion = document.getElementById("formInteraccion");
  const formMensajeCliente = document.getElementById("formMensajeCliente");

  const btnBuscarClientes = document.getElementById("btnBuscarClientes");
  const btnVerHistorial = document.getElementById("btnVerHistorial");
  const btnReloadMensajesCRM = document.getElementById("btnReloadMensajesCRM");

  const in_cliente = document.getElementById("in_cliente");
  const hist_cliente = document.getElementById("hist_cliente");
  const msg_cliente = document.getElementById("msg_cliente");
  const mensajesCRMBody = document.getElementById("mensajesCRMBody");

  let CLIENTES = [];
  let chartCRMEtapas;

  function showMsg(text, type = "success") {
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
      return iso || "";
    }
  }

  function badgeEtapa(etapa) {
    const e = String(etapa || "");
    if (e === "Prospecto") return `<span class="badge badge-prospecto">Prospecto</span>`;
    if (e === "Activo") return `<span class="badge badge-activo">Activo</span>`;
    if (e === "Frecuente") return `<span class="badge badge-frecuente">Frecuente</span>`;
    if (e === "Inactivo") return `<span class="badge badge-inactivo">Inactivo</span>`;
    return `<span class="badge bg-secondary">${escapeHtml(e)}</span>`;
  }

  function badgePrioridad(prioridad) {
    const value = String(prioridad || "normal");
    if (value === "alta") return `<span class="badge bg-danger">alta</span>`;
    if (value === "baja") return `<span class="badge bg-secondary">baja</span>`;
    return `<span class="badge bg-primary">normal</span>`;
  }

  async function loadClientes() {
    const q = document.getElementById("f_q").value.trim();
    const estado = document.getElementById("f_estado").value;
    const etapa = document.getElementById("f_etapa").value;

    const qs = new URLSearchParams();
    if (q) qs.set("q", q);
    if (estado) qs.set("estado", estado);
    if (etapa) qs.set("etapa", etapa);

    CLIENTES = await apiFetch(`/clientes?${qs.toString()}`, { method: "GET" });

    if (!CLIENTES.length) {
      clientesBody.innerHTML = `<tr><td colspan="7" class="text-center text-muted">Sin clientes</td></tr>`;
    } else {
      clientesBody.innerHTML = CLIENTES.map(c => `
        <tr>
          <td>${c.id}</td>
          <td>${escapeHtml(c.nombre)}</td>
          <td>${escapeHtml(c.correo)}</td>
          <td>${escapeHtml(c.empresa || "")}</td>
          <td>${escapeHtml(c.estado)}</td>
          <td>${badgeEtapa(c.etapa_crm)}</td>
          <td class="d-flex gap-1 flex-wrap">
            <button class="btn btn-sm btn-outline-primary" data-action="edit" data-id="${c.id}">
              <i class="bi bi-pencil-square"></i>
            </button>
            <button class="btn btn-sm btn-outline-danger" data-action="delete" data-id="${c.id}">
              <i class="bi bi-trash"></i>
            </button>
          </td>
        </tr>
      `).join("");
    }

    const opts = CLIENTES.length
      ? `<option value="">Selecciona cliente...</option>` + CLIENTES.map(c => `<option value="${c.id}">${escapeHtml(c.nombre)} (#${c.id})</option>`).join("")
      : `<option value="">No hay clientes</option>`;

    in_cliente.innerHTML = opts;
    hist_cliente.innerHTML = opts;
    if (msg_cliente) msg_cliente.innerHTML = opts;
  }

  async function loadHistorial(clienteId) {
    if (!clienteId) {
      historialBody.innerHTML = `<p class="text-muted mb-0">Selecciona un cliente para ver sus interacciones.</p>`;
      return;
    }

    const rows = await apiFetch(`/clientes/${clienteId}/interacciones`, { method: "GET" });

    if (!rows.length) {
      historialBody.innerHTML = `<p class="text-muted mb-0">Sin interacciones aún.</p>`;
      return;
    }

    historialBody.innerHTML = rows.map(i => `
      <div class="border rounded p-3 mb-3 bg-white">
        <div class="d-flex justify-content-between">
          <strong>${escapeHtml(i.tipo)}</strong>
          <small class="text-muted">${fmtDate(i.fecha)}</small>
        </div>
        <div class="mt-2">${escapeHtml(i.descripcion)}</div>
        <small class="text-muted">Usuario: ${escapeHtml(i.usuario_nombre || "")}</small>
      </div>
    `).join("");
  }

  async function loadMiActividad() {
    const rows = await apiFetch("/interacciones/mias", { method: "GET" });

    if (!rows.length) {
      actividadBody.innerHTML = `<tr><td colspan="5" class="text-center text-muted">Sin actividad aún.</td></tr>`;
      return;
    }

    actividadBody.innerHTML = rows.map(r => `
      <tr>
        <td>${fmtDate(r.fecha)}</td>
        <td>${escapeHtml(r.cliente_nombre)}</td>
        <td>${escapeHtml(r.cliente_correo)}</td>
        <td>${escapeHtml(r.tipo)}</td>
        <td>${escapeHtml(r.descripcion)}</td>
      </tr>
    `).join("");
  }

  async function loadMensajesCliente() {
    if (!mensajesCRMBody) return;

    const rows = await apiFetch("/mensajes-cliente", { method: "GET" });

    if (!rows.length) {
      mensajesCRMBody.innerHTML = `<tr><td colspan="6" class="text-center text-muted">Sin mensajes enviados</td></tr>`;
      return;
    }

    mensajesCRMBody.innerHTML = rows.map(m => `
      <tr>
        <td>${m.id}</td>
        <td>
          <div class="fw-semibold">${escapeHtml(m.cliente_nombre)}</div>
          <small class="text-muted">${escapeHtml(m.cliente_correo)}</small>
        </td>
        <td>
          <div class="fw-semibold">${escapeHtml(m.asunto)}</div>
          <small class="text-muted">${escapeHtml(m.mensaje)}</small>
        </td>
        <td>${badgePrioridad(m.prioridad)}</td>
        <td>${fmtDate(m.fecha_envio)}</td>
        <td>
          ${Number(m.leido)
            ? `<span class="badge bg-success">Leído</span><div class="small text-muted mt-1">${fmtDate(m.fecha_lectura)}</div>`
            : `<span class="badge bg-warning text-dark">Pendiente</span>`}
        </td>
      </tr>
    `).join("");
  }

  function renderChartCRMEtapas(data) {
    const ctx = document.getElementById("chartCRMEtapas");
    if (!ctx) return;

    if (chartCRMEtapas) chartCRMEtapas.destroy();

    chartCRMEtapas = new Chart(ctx, {
      type: "doughnut",
      data: {
        labels: ["Prospecto", "Activo", "Frecuente", "Inactivo"],
        datasets: [{
          data: [
            data?.Prospecto || 0,
            data?.Activo || 0,
            data?.Frecuente || 0,
            data?.Inactivo || 0
          ]
        }]
      },
      options: {
        responsive: true,
        plugins: {
          legend: { position: "bottom" }
        }
      }
    });
  }

  async function loadMetricasCRM() {
    const resumen = await apiFetch("/metricas/crm/resumen", { method: "GET" });
    const riesgo = await apiFetch("/metricas/crm/clientes-riesgo", { method: "GET" });

    document.getElementById("kpiTotalClientes").textContent = resumen.total_clientes ?? 0;
    document.getElementById("kpiActivosCRM").textContent = resumen.activos ?? 0;
    document.getElementById("kpiInactivosCRM").textContent = resumen.inactivos ?? 0;
    document.getElementById("kpiRiesgoCRM").textContent = riesgo.length ?? 0;

    renderChartCRMEtapas(resumen.por_etapa || {});

    if (!riesgo.length) {
      riesgoBody.innerHTML = `<tr><td colspan="4" class="text-center text-muted">Sin clientes en riesgo</td></tr>`;
      return;
    }

    riesgoBody.innerHTML = riesgo.map(c => `
      <tr>
        <td>${escapeHtml(c.nombre)}</td>
        <td>${escapeHtml(c.correo)}</td>
        <td>${escapeHtml(c.estado)}</td>
        <td>${c.ultima_interaccion ? fmtDate(c.ultima_interaccion) : "Sin interacción"}</td>
      </tr>
    `).join("");
  }

  formCliente?.addEventListener("submit", async (e) => {
    e.preventDefault();

    const payload = {
      nombre: document.getElementById("cl_nombre").value.trim(),
      correo: document.getElementById("cl_correo").value.trim(),
      telefono: document.getElementById("cl_telefono").value.trim(),
      empresa: document.getElementById("cl_empresa").value.trim(),
      estado: document.getElementById("cl_estado").value,
      etapa_crm: document.getElementById("cl_etapa").value
    };

    try {
      await apiFetch("/clientes", {
        method: "POST",
        body: JSON.stringify(payload)
      });

      formCliente.reset();
      showMsg("✅ Cliente creado");
      await loadClientes();
      await loadMetricasCRM();
    } catch (e) {
      showMsg("❌ " + e.message, "danger");
    }
  });

  formEditCliente?.addEventListener("submit", async (e) => {
    e.preventDefault();

    const id = Number(document.getElementById("ecl_id").value);

    const payload = {
      nombre: document.getElementById("ecl_nombre").value.trim(),
      correo: document.getElementById("ecl_correo").value.trim(),
      telefono: document.getElementById("ecl_telefono").value.trim(),
      empresa: document.getElementById("ecl_empresa").value.trim(),
      estado: document.getElementById("ecl_estado").value,
      etapa_crm: document.getElementById("ecl_etapa").value
    };

    try {
      await apiFetch(`/clientes/${id}`, {
        method: "PUT",
        body: JSON.stringify(payload)
      });

      modalEditCliente.hide();
      showMsg("✅ Cliente actualizado");
      await loadClientes();
      await loadMetricasCRM();
    } catch (e) {
      showMsg("❌ " + e.message, "danger");
    }
  });

  formDelCliente?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const id = Number(document.getElementById("dcl_id").value);

    try {
      await apiFetch(`/clientes/${id}`, { method: "DELETE" });
      modalDelCliente.hide();
      showMsg("🗑️ Cliente eliminado");
      await loadClientes();
      await loadMetricasCRM();
    } catch (e) {
      showMsg("❌ " + e.message, "danger");
    }
  });

  formInteraccion?.addEventListener("submit", async (e) => {
    e.preventDefault();

    const payload = {
      cliente_id: Number(document.getElementById("in_cliente").value),
      tipo: document.getElementById("in_tipo").value,
      descripcion: document.getElementById("in_descripcion").value.trim()
    };

    try {
      await apiFetch("/interacciones", {
        method: "POST",
        body: JSON.stringify(payload)
      });

      formInteraccion.reset();
      showMsg("✅ Interacción registrada");
      if (hist_cliente.value) await loadHistorial(hist_cliente.value);
      await loadMiActividad();
      await loadMetricasCRM();
    } catch (e) {
      showMsg("❌ " + e.message, "danger");
    }
  });

  formMensajeCliente?.addEventListener("submit", async (e) => {
    e.preventDefault();

    try {
      await apiFetch("/mensajes-cliente", {
        method: "POST",
        body: JSON.stringify({
          cliente_id: Number(msg_cliente.value),
          asunto: document.getElementById("msg_asunto").value.trim(),
          mensaje: document.getElementById("msg_texto").value.trim(),
          prioridad: document.getElementById("msg_prioridad").value
        })
      });

      formMensajeCliente.reset();
      if (msg_cliente) {
        msg_cliente.innerHTML = CLIENTES.length
          ? `<option value="">Selecciona cliente...</option>` + CLIENTES.map(c => `<option value="${c.id}">${escapeHtml(c.nombre)} (#${c.id})</option>`).join("")
          : `<option value="">No hay clientes</option>`;
      }
      showMsg("✅ Mensaje enviado al usuario");
      await loadMensajesCliente();
    } catch (e) {
      showMsg("❌ " + e.message, "danger");
    }
  });

  btnBuscarClientes?.addEventListener("click", async () => {
    try {
      await loadClientes();
    } catch (e) {
      showMsg("❌ " + e.message, "danger");
    }
  });

  btnVerHistorial?.addEventListener("click", async () => {
    try {
      await loadHistorial(hist_cliente.value);
    } catch (e) {
      showMsg("❌ " + e.message, "danger");
    }
  });

  btnReloadMensajesCRM?.addEventListener("click", async () => {
    try {
      await loadMensajesCliente();
    } catch (e) {
      showMsg("❌ " + e.message, "danger");
    }
  });

  document.addEventListener("click", (e) => {
    const btn = e.target.closest("button[data-action]");
    if (!btn) return;

    const id = Number(btn.dataset.id);
    const action = btn.dataset.action;
    const cliente = CLIENTES.find(c => c.id === id);
    if (!cliente) return;

    if (action === "edit") {
      document.getElementById("ecl_id").value = cliente.id;
      document.getElementById("ecl_nombre").value = cliente.nombre || "";
      document.getElementById("ecl_correo").value = cliente.correo || "";
      document.getElementById("ecl_telefono").value = cliente.telefono || "";
      document.getElementById("ecl_empresa").value = cliente.empresa || "";
      document.getElementById("ecl_estado").value = cliente.estado || "activo";
      document.getElementById("ecl_etapa").value = cliente.etapa_crm || "Prospecto";
      modalEditCliente.show();
    }

    if (action === "delete") {
      document.getElementById("dcl_id").value = cliente.id;
      document.getElementById("dcl_name").textContent = cliente.nombre;
      modalDelCliente.show();
    }
  });

  (async () => {
    try {
      await loadClientes();
      await loadMiActividad();
      await loadMensajesCliente();
      await loadMetricasCRM();
    } catch (e) {
      showMsg("❌ " + e.message, "danger");
    }
  })();
})();
