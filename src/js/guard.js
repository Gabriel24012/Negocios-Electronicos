// src/js/guard.js
(function () {
  /*
    Uso:
    <script src="../src/js/guard.js" data-roles="admin"></script>
    <script src="../src/js/guard.js" data-roles="admin,ventas"></script>
    <script src="../src/js/guard.js" data-roles="admin,ventas,logistica"></script>
  */

  const scriptTag = document.currentScript;
  const rolesAllowed = (scriptTag?.dataset?.roles || "")
    .split(",")
    .map(s => s.trim())
    .filter(Boolean);

  const token = localStorage.getItem("token");
  const rol = localStorage.getItem("rol");

  // Detectar si estamos dentro de /views/
  const inViews = window.location.pathname.includes("/views/");
  const base = inViews ? "../" : "";

  // Sin sesión -> login
  if (!token || !rol) {
    window.location.href = `${base}login.html`;
    return;
  }

  // Si la página exige ciertos roles y el actual no está permitido
  if (rolesAllowed.length && !rolesAllowed.includes(rol)) {
    // Redirección según rol
    if (rol === "admin") {
      window.location.href = `${base}views/admin.html`;
      return;
    }

    if (rol === "ventas" || rol === "logistica") {
      window.location.href = `${base}views/admin-erp.html`;
      return;
    }

    // usuario normal
    window.location.href = `${base}views/usuarios.html`;
  }
})();
