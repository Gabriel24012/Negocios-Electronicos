// src/js/analytics.js
let chart;
let chartEstrategias;

function showAlert(type, text) {
  const box = document.getElementById("alertBox");
  if (!box) return;
  box.innerHTML = `<div class="alert alert-${type}">${text}</div>`;
  setTimeout(() => { box.innerHTML = ""; }, 2500);
}

function fmtDate(iso) {
  try {
    const d = new Date(iso);
    return d.toLocaleString("es-MX");
  } catch {
    return iso;
  }
}

function setKPIs(last) {
  document.getElementById("kpiClientes").textContent = last?.total_clientes ?? 0;
  document.getElementById("kpiActivos").textContent = last?.clientes_activos ?? 0;
  document.getElementById("kpiInactivos").textContent = last?.clientes_inactivos ?? 0;
  document.getElementById("kpiInteracciones").textContent = last?.total_interacciones ?? 0;
}

function renderTable(rows) {
  const tbody = document.getElementById("tbodyMetricas");
  tbody.innerHTML = "";

  rows.forEach(r => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${r.id}</td>
      <td>${fmtDate(r.fecha)}</td>
      <td>${r.total_clientes}</td>
      <td>${r.clientes_activos}</td>
      <td>${r.clientes_inactivos}</td>
      <td>${r.total_interacciones}</td>
      <td>${r.generado_por ?? "-"}</td>
    `;
    tbody.appendChild(tr);
  });
}

function renderChart(rows) {
  const last10 = rows.slice(0, 10).reverse(); // orden cronológico
  const labels = last10.map(r => new Date(r.fecha).toLocaleTimeString("es-MX"));
  const clientes = last10.map(r => r.total_clientes);
  const interacciones = last10.map(r => r.total_interacciones);

  const ctx = document.getElementById("chartMetricas");
  if (!ctx) return;

  if (chart) chart.destroy();

  chart = new Chart(ctx, {
    type: "line",
    data: {
      labels,
      datasets: [
        { label: "Total clientes", data: clientes, tension: 0.3 },
        { label: "Total interacciones", data: interacciones, tension: 0.3 }
      ]
    },
    options: {
      responsive: true,
      plugins: { legend: { position: "bottom" } },
      scales: { y: { beginAtZero: true } }
    }
  });
}
function contarEstrategias(productos) {
  let pull = 0;
  let push = 0;
  let otras = 0;

  for (const p of productos) {
    const est = String(p.estrategia_logistica || "").trim().toUpperCase();
    if (est === "PULL") pull++;
    else if (est === "PUSH") push++;
    else otras++;
  }

  return { pull, push, otras };
}

function renderChartEstrategias({ pull, push, otras }) {
  const ctx = document.getElementById("chartEstrategias");
  if (!ctx) return;

  if (chartEstrategias) chartEstrategias.destroy();

  const labels = ["PULL", "PUSH"];
  const data = [pull, push];

  // Si hay estrategias vacías/raras, las mostramos como "OTRAS"
  if (otras > 0) {
    labels.push("OTRAS");
    data.push(otras);
  }

  chartEstrategias = new Chart(ctx, {
    type: "doughnut",
    data: {
      labels,
      datasets: [{ data }]
    },
    options: {
      responsive: true,
      plugins: {
        legend: { position: "bottom" }
      }
    }
  });
}

async function loadEstrategiasProductos() {
  // OJO: si /productos requiere token admin, esto debe estar protegido como admin (como ya tienes en analytics)
  const productos = await apiFetch("/productos", { method: "GET" });
  const conteo = contarEstrategias(productos);
  renderChartEstrategias(conteo);
}

async function loadHistorico() {
  const rows = await apiFetch("/metricas/historico"); // requiere token
  if (rows.length) setKPIs(rows[0]);
  renderTable(rows);
  renderChart(rows);
}

async function generarSnapshot() {
  await apiFetch("/metricas", { method: "GET" }); // guarda snapshot
  showAlert("success", "✅ Snapshot generado y guardado en la tabla metricas.");
  await loadHistorico();
}

document.addEventListener("DOMContentLoaded", async () => {
  try {
    await loadEstrategiasProductos();
    await loadInventarioMetrics();
    await loadHistorico();
    document.getElementById("btnSnapshot").addEventListener("click", generarSnapshot);
    document.getElementById("btnRefresh").addEventListener("click", loadHistorico);
  } catch (e) {
    console.error(e);
    showAlert("danger", "❌ No se pudieron cargar métricas: " + e.message);
  }

  async function loadInventarioMetrics() {
  // Top / bottom vendidos
  const top = await apiFetch("/metricas/productos/top?limit=10");
  const bottom = await apiFetch("/metricas/productos/bottom?limit=10");
  const bajo = await apiFetch("/metricas/inventario/bajo");

  const topEl = document.getElementById("topProductos");
  const bottomEl = document.getElementById("bottomProductos");
  const bajoEl = document.getElementById("invBajo");

  if (topEl) {
    topEl.innerHTML = "";
    top.forEach(p => {
      const li = document.createElement("li");
      li.textContent = `${p.nombre} — ${p.unidades_vendidas} vendidos`;
      topEl.appendChild(li);
    });
  }

  if (bottomEl) {
    bottomEl.innerHTML = "";
    bottom.forEach(p => {
      const li = document.createElement("li");
      li.textContent = `${p.nombre} — ${p.unidades_vendidas} vendidos`;
      bottomEl.appendChild(li);
    });
  }

  if (bajoEl) {
    bajoEl.innerHTML = "";
    bajo.slice(0, 10).forEach(p => {
      const li = document.createElement("li");
      li.textContent = `${p.nombre} (stock ${p.stock_actual}/${p.stock_minimo})`;
      bajoEl.appendChild(li);
    });

    if (!bajo.length) {
      bajoEl.innerHTML = `<li class="text-muted">✅ No hay productos bajo mínimo</li>`;
    }
  }
}
});
