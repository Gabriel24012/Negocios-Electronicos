(function () {
  const token = localStorage.getItem("token");
  const rol = localStorage.getItem("rol");

  if (!token || rol !== "usuario") return;

  const perfilMsgBox = document.getElementById("perfilMsgBox");
  const profileAvatar = document.getElementById("profileAvatar");
  const profileNombre = document.getElementById("profileNombre");
  const profileResumen = document.getElementById("profileResumen");
  const profileCorreo = document.getElementById("profileCorreo");
  const profileTelefono = document.getElementById("profileTelefono");
  const profileEmpresa = document.getElementById("profileEmpresa");
  const profileEstado = document.getElementById("profileEstado");
  const mensajesResumen = document.getElementById("mensajesResumen");
  const mensajesClienteList = document.getElementById("mensajesClienteList");
  const btnReloadMensajesCliente = document.getElementById("btnReloadMensajesCliente");
  const btnEditarPerfil = document.getElementById("btnEditarPerfil");
  const btnEliminarCuenta = document.getElementById("btnEliminarCuenta");
  const btnCerrarSesionCuenta = document.getElementById("btnCerrarSesionCuenta");
  const btnLogoutPerfil = document.getElementById("btnLogoutPerfil");

  function showMsg(text, type = "success") {
    if (!perfilMsgBox) return;
    perfilMsgBox.innerHTML = `<div class="alert alert-${type}">${text}</div>`;
    setTimeout(() => {
      if (perfilMsgBox) perfilMsgBox.innerHTML = "";
    }, 3000);
  }

  function escapeHtml(str) {
    return String(str ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function formatMultiline(str) {
    return escapeHtml(str).replaceAll("\n", "<br>");
  }

  function fmtDate(iso) {
    if (!iso) return "Sin fecha";

    try {
      return new Date(iso).toLocaleString("es-MX");
    } catch {
      return iso;
    }
  }

  function getInitials(name) {
    return String(name || "U")
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map(part => part.charAt(0).toUpperCase())
      .join("") || "U";
  }

  function badgePrioridad(prioridad) {
    const value = String(prioridad || "normal");
    if (value === "alta") return `<span class="badge bg-danger">Alta</span>`;
    if (value === "baja") return `<span class="badge bg-secondary">Baja</span>`;
    return `<span class="badge bg-primary">Normal</span>`;
  }

  function setInputValue(input, value, fallback = "No registrado") {
    if (!input) return;
    input.value = value && String(value).trim() ? value : fallback;
  }

  function renderProfile(cliente) {
    const nombreSesion = localStorage.getItem("user_nombre") || "Usuario";
    const correoSesion = localStorage.getItem("user_email") || "";
    const nombre = cliente?.nombre || nombreSesion;
    const anio = cliente?.fecha_registro ? new Date(cliente.fecha_registro).getFullYear() : "";

    if (profileAvatar) profileAvatar.textContent = getInitials(nombre);
    if (profileNombre) profileNombre.textContent = nombre;

    if (profileResumen) {
      if (cliente) {
        const resumen = [
          anio ? `Cliente desde ${anio}` : "Cliente registrado",
          cliente.etapa_crm ? `Etapa ${cliente.etapa_crm}` : "",
          cliente.estado ? `Estado ${cliente.estado}` : ""
        ].filter(Boolean).join(" · ");
        profileResumen.textContent = resumen || "Perfil activo";
      } else {
        profileResumen.textContent = "Perfil pendiente de sincronización con CRM";
      }
    }

    setInputValue(profileCorreo, cliente?.correo || correoSesion, "Sin correo");
    setInputValue(profileTelefono, cliente?.telefono);
    setInputValue(profileEmpresa, cliente?.empresa);
    setInputValue(profileEstado, cliente ? `${cliente.estado || "activo"} / ${cliente.etapa_crm || "Prospecto"}` : "Pendiente");
  }

  function renderResumen(mensajes) {
    if (!mensajesResumen) return;

    const unread = mensajes.filter(m => !Number(m.leido)).length;

    if (!mensajes.length) {
      mensajesResumen.className = "alert alert-light mt-3";
      mensajesResumen.textContent = "Aún no tienes mensajes del administrador.";
      return;
    }

    mensajesResumen.className = unread
      ? "alert alert-warning mt-3"
      : "alert alert-success mt-3";
    mensajesResumen.textContent = unread
      ? `Tienes ${unread} mensaje(s) nuevo(s) del administrador.`
      : "No tienes mensajes pendientes por leer.";
  }

  function renderMensajes(mensajes) {
    if (!mensajesClienteList) return;

    renderResumen(mensajes);

    if (!mensajes.length) {
      mensajesClienteList.innerHTML = `
        <div class="message-card">
          <div class="text-muted">Cuando administración te envíe un aviso, aparecerá aquí.</div>
        </div>
      `;
      return;
    }

    mensajesClienteList.innerHTML = mensajes.map(m => `
      <div class="message-card ${Number(m.leido) ? "" : "unread"}">
        <div class="d-flex justify-content-between align-items-start flex-wrap gap-2">
          <div>
            <div class="d-flex align-items-center gap-2 flex-wrap">
              <h6 class="mb-0 fw-bold">${escapeHtml(m.asunto)}</h6>
              ${badgePrioridad(m.prioridad)}
              ${Number(m.leido)
                ? `<span class="badge text-bg-light">Leído</span>`
                : `<span class="badge text-bg-warning">Nuevo</span>`}
            </div>
            <small class="text-muted">
              Enviado por ${escapeHtml(m.admin_nombre || "Administración")} el ${fmtDate(m.fecha_envio)}
            </small>
          </div>
          ${Number(m.leido)
            ? `<small class="text-muted">Leído: ${fmtDate(m.fecha_lectura)}</small>`
            : `<button class="btn btn-sm btn-outline-secondary" data-marcar-leido="${m.id}">Marcar como leído</button>`}
        </div>
        <div class="mt-3">${formatMultiline(m.mensaje)}</div>
      </div>
    `).join("");
  }

  async function loadPerfilMensajes() {
    const data = await apiFetch("/mensajes-cliente/mios", { method: "GET" });
    renderProfile(data?.cliente || null);
    renderMensajes(Array.isArray(data?.mensajes) ? data.mensajes : []);
  }

  function cerrarSesion() {
    clearSession();
    window.location.href = "../login.html";
  }

  btnReloadMensajesCliente?.addEventListener("click", async () => {
    try {
      await loadPerfilMensajes();
      showMsg("Mensajes actualizados.");
    } catch (e) {
      showMsg("❌ " + e.message, "danger");
    }
  });

  btnEditarPerfil?.addEventListener("click", () => {
    showMsg("La edición de perfil sigue simulada en esta versión.", "info");
  });

  btnEliminarCuenta?.addEventListener("click", () => {
    showMsg("La eliminación de cuenta sigue simulada en esta versión.", "info");
  });

  btnCerrarSesionCuenta?.addEventListener("click", cerrarSesion);
  btnLogoutPerfil?.addEventListener("click", cerrarSesion);

  document.addEventListener("click", async (e) => {
    const btn = e.target.closest("button[data-marcar-leido]");
    if (!btn) return;

    const id = Number(btn.dataset.marcarLeido);

    try {
      btn.disabled = true;
      await apiFetch(`/mensajes-cliente/${id}/leido`, { method: "PUT" });
      await loadPerfilMensajes();
      showMsg("Mensaje marcado como leído.");
    } catch (e) {
      btn.disabled = false;
      showMsg("❌ " + e.message, "danger");
    }
  });

  (async () => {
    try {
      await loadPerfilMensajes();
    } catch (e) {
      console.error(e);
      showMsg("❌ " + e.message, "danger");
    }
  })();
})();
