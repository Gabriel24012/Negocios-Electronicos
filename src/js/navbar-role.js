
(function () {

  const token = localStorage.getItem("token");
  const rol = localStorage.getItem("rol");
  const nombre = localStorage.getItem("user_nombre") || "Usuario";

  const btnAdmin = document.getElementById("btnAdmin");
  const btnPerfil = document.getElementById("btnPerfil");
  const btnLogin = document.getElementById("btnLogin");
  const btnLogout = document.getElementById("btnLogout");
  const navUserName = document.getElementById("navUserName");

  const btnAdminCRM = document.getElementById("btnAdminCRM");
  const btnAdminSCM = document.getElementById("btnAdminSCM");
  const btnAdminERP = document.getElementById("btnAdminERP");

  if (!token) {
    if (btnAdmin) btnAdmin.style.display = "none";
    if (btnPerfil) btnPerfil.style.display = "none";
    if (btnLogout) btnLogout.style.display = "none";
    if (btnLogin) btnLogin.style.display = "inline-block";
    if (navUserName) navUserName.textContent = "";
    return;
  }


  if (btnLogin) btnLogin.style.display = "none";
  if (btnLogout) btnLogout.style.display = "inline-block";
  if (btnPerfil) btnPerfil.style.display = "inline-block";


  if (navUserName) {
    navUserName.textContent = `Hola, ${nombre} (${rol})`;
  }

  if (btnAdmin && rol !== "admin") btnAdmin.style.display = "none";
  if (btnAdminCRM && !["admin", "ventas"].includes(rol)) btnAdminCRM.style.display = "none";
  if (btnAdminSCM && !["admin", "logistica"].includes(rol)) btnAdminSCM.style.display = "none";
  if (btnAdminERP && !["admin", "ventas", "logistica"].includes(rol)) btnAdminERP.style.display = "none";
})();
