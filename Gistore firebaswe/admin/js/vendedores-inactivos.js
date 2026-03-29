// ============================================================
//  vendedores-inactivos.js — Vendedores desactivados
//  Permite ver y reactivar vendedores con estado="desactivado"
// ============================================================
import { cerrarSesion, protegerPagina } from "./auth.js";
import { obtenerVendedoresDesactivados, reactivarVendedor } from "./db.js";
import { fechaHoy, btnCargando, abrirModal, cerrarModal } from "./ui.js";

protegerPagina("../index.html");

document.getElementById("fechaHoy").textContent = fechaHoy();
document.getElementById("btnSalir").addEventListener("click", async () => {
  await cerrarSesion(); window.location.href = "../index.html";
});

// ── Estado global ─────────────────────────────────────────
let desactivados = [];
let idReactivar  = "";

// ── Cargar tabla ──────────────────────────────────────────
async function cargar() {
  try {
    desactivados = await obtenerVendedoresDesactivados();
    document.getElementById("totalDesactivados").textContent =
      desactivados.length + " desactivado" + (desactivados.length !== 1 ? "s" : "");
    aplicarFiltro(); // renderiza con el filtro activo (si lo hay)
  } catch (e) {
    console.error("Error cargando vendedores desactivados:", e);
  }
}

// ── Filtro por número de celular ──────────────────────────
function aplicarFiltro() {
  const q      = (document.getElementById("filtroCelular")?.value || "").trim().replace(/\s/g, "");
  const lista  = q
    ? desactivados.filter(v => (v.whatsapp || "").replace(/\s/g, "").includes(q))
    : desactivados;

  // Mostrar/ocultar botón limpiar
  const btnClear = document.getElementById("filtroClear");
  if (btnClear) btnClear.style.display = q ? "inline" : "none";

  renderTabla(lista);
}

function renderTabla(lista) {
  // Si no se pasa lista, usar todos
  if (!lista) lista = desactivados;

  const wrap = document.getElementById("tablaWrap");
  const q    = (document.getElementById("filtroCelular")?.value || "").trim();

  if (!desactivados.length) {
    wrap.innerHTML = '<p class="vacio-txt">No hay vendedores desactivados. ✅</p>';
    return;
  }

  if (!lista.length) {
    wrap.innerHTML = `<p class="filtro-sin-resultados">
      📵 Sin resultados para <strong>${q}</strong>.
      <br/><span style="font-size:.8rem">Verifica el número e intenta de nuevo.</span>
    </p>`;
    return;
  }

  wrap.innerHTML = `
    <table>
      <thead>
        <tr>
          <th>Color</th>
          <th>Nombre</th>
          <th>Ciudad</th>
          <th>WhatsApp</th>
          <th>Correo</th>
          <th>Acceso</th>
          <th>Acción</th>
        </tr>
      </thead>
      <tbody>
        ${lista.map(v => `
          <tr style="opacity:.85">
            <td>
              <div style="width:22px;height:22px;border-radius:50%;
                          background:${v.color || "#94a3b8"};
                          border:2px solid #ddd;filter:grayscale(40%)"></div>
            </td>
            <td><strong>${v.nombre}</strong></td>
            <td>${v.ciudad || "—"}</td>
            <td>${v.whatsapp
              ? `<a href="https://wa.me/${v.whatsapp}" target="_blank"
                    style="color:var(--verde);text-decoration:none">📱 ${v.whatsapp}</a>`
              : "—"}</td>
            <td>${v.correo || "—"}</td>
            <td>${v.uid_auth
              ? `<span class="badge badge-activo" title="UID: ${v.uid_auth}">✓ Con acceso</span>`
              : `<span class="badge badge-inactivo">Sin acceso</span>`}</td>
            <td>
              <button class="btn-reactivar" data-id="${v.id}" data-nombre="${v.nombre}">
                ✅ Reactivar
              </button>
            </td>
          </tr>`).join("")}
      </tbody>
    </table>`;

  wrap.querySelectorAll(".btn-reactivar").forEach(btn =>
    btn.addEventListener("click", () => abrirReactivar(btn.dataset.id, btn.dataset.nombre))
  );
}

// ── Eventos del buscador ──────────────────────────────────
document.addEventListener("DOMContentLoaded", () => {
  const input    = document.getElementById("filtroCelular");
  const btnClear = document.getElementById("filtroClear");

  input?.addEventListener("input", aplicarFiltro);

  // Limpiar con el botón ✕
  btnClear?.addEventListener("click", () => {
    input.value = "";
    btnClear.style.display = "none";
    input.focus();
    aplicarFiltro();
  });

  // Limpiar con Escape
  input?.addEventListener("keydown", e => {
    if (e.key === "Escape" && input.value) {
      input.value = "";
      btnClear.style.display = "none";
      aplicarFiltro();
    }
  });
});

// ── Modal reactivar ───────────────────────────────────────
function abrirReactivar(id, nombre) {
  idReactivar = id;
  document.getElementById("nombreReactivar").textContent = nombre;
  abrirModal("modalReactivar");
}

document.getElementById("btnConfirmarReactivar").addEventListener("click", async () => {
  const btn = document.getElementById("btnConfirmarReactivar");
  btnCargando(btn, true);
  try {
    const { vigente } = await reactivarVendedor(idReactivar);
    cerrarModal("modalReactivar");
    await cargar();

    // Mostrar aviso según si tenía membresía o no
    if (!vigente) {
      alert(
        "El vendedor fue reactivado pero no tiene membresía vigente.\n" +
        "Sus productos permanecen ocultos hasta asignarle una membresía activa."
      );
    }
  } catch (e) {
    console.error("Error al reactivar vendedor:", e);
    alert("Hubo un problema al reactivar. Intenta de nuevo.");
  } finally {
    btnCargando(btn, false);
  }
});

// ── Cerrar modal ──────────────────────────────────────────
document.getElementById("btnCancelarReactivar").addEventListener("click",
  () => cerrarModal("modalReactivar")
);
document.getElementById("modalReactivar").addEventListener("click", e => {
  if (e.target === document.getElementById("modalReactivar")) cerrarModal("modalReactivar");
});

cargar();