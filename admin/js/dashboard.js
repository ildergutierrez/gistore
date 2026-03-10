// ============================================================
//  dashboard.js — Controlador del dashboard
// ============================================================
import { cerrarSesion, protegerPagina } from "../js/auth.js";
import { obtenerVendedores, obtenerMembresias,
         obtenerProductos, obtenerCategorias } from "../js/db.js";
import { fechaHoy, badgeEstado } from "../js/ui.js";

protegerPagina("../index.html");

// Fecha
document.getElementById("fechaHoy").textContent = fechaHoy();

// Cerrar sesión
document.getElementById("btnSalir").addEventListener("click", async () => {
  await cerrarSesion();
  window.location.href = "../index.html";
});

// ── Cargar datos ───────────────────────────────────────────
async function cargarDatos() {
  try {
    const [vendedores, membresias, productos, categorias] = await Promise.all([
      obtenerVendedores(),
      obtenerMembresias(),
      obtenerProductos(),
      obtenerCategorias(),
    ]);

    const hoyStr = new Date().toISOString().split("T")[0];

    // Stats
    document.getElementById("statVendedores").textContent =
      vendedores.filter(v => v.estado === "activo").length;
    document.getElementById("statMembresias").textContent =
      membresias.filter(m => m.estado === "activa" && m.fecha_fin >= hoyStr).length;
    document.getElementById("statProductos").textContent =
      productos.filter(p => p.activo).length;
    document.getElementById("statCategorias").textContent =
      categorias.length;

    // Tabla vendedores
    const tvEl = document.getElementById("tablaVendedores");
    tvEl.innerHTML = vendedores.length
      ? `<table>
          <thead><tr><th>Nombre</th><th>Ciudad</th><th>Estado</th></tr></thead>
          <tbody>
            ${vendedores.slice(0, 6).map(v => `
              <tr>
                <td>${v.nombre}</td>
                <td>${v.ciudad || "—"}</td>
                <td>${badgeEstado(v.estado)}</td>
              </tr>`).join("")}
          </tbody>
        </table>`
      : '<p class="vacio-txt">Sin vendedores registrados.</p>';

    // Tabla membresías
    const vendMap = {};
    vendedores.forEach(v => vendMap[v.id] = v.nombre);

    const tmEl = document.getElementById("tablaMembresias");
    tmEl.innerHTML = membresias.length
      ? `<table>
          <thead><tr><th>Vendedor</th><th>Vence</th><th>Estado</th></tr></thead>
          <tbody>
            ${membresias.slice(0, 6).map(m => {
              const est = m.estado === "activa" && m.fecha_fin >= hoyStr
                        ? "activa" : m.estado === "activa" ? "vencida" : m.estado;
              return `<tr>
                <td>${vendMap[m.vendedor_id] || "—"}</td>
                <td>${m.fecha_fin || "—"}</td>
                <td>${badgeEstado(est)}</td>
              </tr>`;
            }).join("")}
          </tbody>
        </table>`
      : '<p class="vacio-txt">Sin membresías registradas.</p>';

  } catch (err) {
    console.error("Error cargando dashboard:", err);
  }
}

cargarDatos();