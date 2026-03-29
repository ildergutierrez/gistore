// ============================================================
//  admin/js/api-claves.js — Gestión de claves API
//  Las claves se almacenan en Firestore (colección api_claves)
//  y NUNCA en el código fuente.
// ============================================================
import { cerrarSesion, protegerPagina } from "./auth.js";
import {
  obtenerClavesApi, crearClaveApi,
  actualizarClaveApi, eliminarClaveApi,
} from "./db.js";
import { fechaHoy, btnCargando } from "./ui.js";

protegerPagina("../index.html");

const el = id => document.getElementById(id);

let claves      = [];
let eliminarId  = null;

el("fechaHoy").textContent = fechaHoy();
el("btnSalir").addEventListener("click", async () => {
  await cerrarSesion(); window.location.href = "../index.html";
});

// ── Toggle ver/ocultar clave ──────────────────────────────
el("btnVerClave").addEventListener("click", () => {
  const inp = el("fClave");
  if (inp.type === "password") { inp.type = "text";     el("btnVerClave").textContent = "🙈"; }
  else                          { inp.type = "password"; el("btnVerClave").textContent = "👁"; }
});

// ── Cargar claves ─────────────────────────────────────────
async function cargarClaves() {
  el("clavesLista").innerHTML = '<p class="cargando-txt">Cargando…</p>';
  try {
    claves = await obtenerClavesApi();
    renderClaves();
  } catch (e) {
    console.error(e);
    el("clavesLista").innerHTML = '<p class="vacio-txt">Error al cargar.</p>';
  }
}

function renderClaves() {
  if (!claves.length) {
    el("clavesLista").innerHTML =
      '<p class="vacio-txt">Sin claves registradas. Crea la primera con el botón de arriba.</p>';
    return;
  }

  el("clavesLista").innerHTML = `
    <div class="tabla-responsive">
      <table>
        <thead>
          <tr>
            <th>Servicio</th>
            <th>Nombre</th>
            <th>URL origen</th>
            <th>Clave</th>
            <th>Modelos</th>
            <th>Estado</th>
            <th>Acciones</th>
          </tr>
        </thead>
        <tbody>
          ${claves.map(c => {
            const modelos = Array.isArray(c.modelos) ? c.modelos : [];
            return `<tr>
              <td><code style="font-size:.78rem">${c.servicio || ""}</code></td>
              <td style="font-weight:600;font-size:.85rem">${c.nombre || ""}</td>
              <td style="font-size:.78rem;color:var(--texto-suave);max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${c.origen_url||""}">${c.origen_url||"—"}</td>
              <td>
                <div class="clave-wrap">
                  <span class="clave-texto" id="ctexto-${c.id}">••••••••••••</span>
                  <button class="btn-eye" title="Revelar" onclick="toggleClave('${c.id}','${(c.clave||"").replace(/'/g,"\\'")}')">👁</button>
                </div>
              </td>
              <td>
                <div class="modelos-list">
                  ${modelos.length
                    ? modelos.map(m => `<span class="modelo-chip">${m}</span>`).join("")
                    : `<span style="font-size:.75rem;color:var(--texto-suave)">—</span>`}
                </div>
              </td>
              <td>
                <span class="badge ${c.activo ? 'badge-on' : 'badge-off'}">
                  ${c.activo ? "✅ Activa" : "⏸ Inactiva"}
                </span>
              </td>
              <td>
                <div style="display:flex;gap:.4rem;flex-wrap:wrap">
                  <button class="btn-tabla btn-editar" onclick="editarClave('${c.id}')">✏️</button>
                  <button class="btn-tabla btn-eliminar" onclick="pedirEliminar('${c.id}')">🗑</button>
                </div>
              </td>
            </tr>`;
          }).join("")}
        </tbody>
      </table>
    </div>`;
}

// ── Toggle revelar clave en tabla ─────────────────────────
const _reveladoState = {};
window.toggleClave = (id, clave) => {
  const span = el(`ctexto-${id}`);
  if (!span) return;
  _reveladoState[id] = !_reveladoState[id];
  span.textContent = _reveladoState[id] ? clave : "••••••••••••";
};

// ── Abrir modal ───────────────────────────────────────────
el("btnNuevaClave").addEventListener("click", () => abrirModal());

function abrirModal(clave = null) {
  const esEd = !!clave;
  el("modalTitulo").textContent = esEd ? "✏️ Editar clave API" : "🔑 Nueva clave API";
  el("claveId").value    = clave?.id         || "";
  el("fServicio").value  = clave?.servicio   || "";
  el("fNombre").value    = clave?.nombre     || "";
  el("fOrigenUrl").value = clave?.origen_url || "";
  el("fClave").value     = "";   // siempre vacía al abrir; el usuario ingresa nueva si quiere
  el("fClave").type      = "password";
  el("btnVerClave").textContent = "👁";
  const modelos = Array.isArray(clave?.modelos) ? clave.modelos : [];
  el("fModelos").value   = modelos.join("\n");
  el("fNota").value      = clave?.nota       || "";
  el("fActivo").value    = clave?.activo !== false ? "true" : "false";
  el("fServicio").readOnly = esEd;   // no cambiar el identificador al editar
  el("msgErrorModal").classList.remove("visible");
  el("modalOverlay").classList.add("visible");
}

el("btnCancelar").addEventListener("click", () => el("modalOverlay").classList.remove("visible"));
el("modalOverlay").addEventListener("click", e => {
  if (e.target === el("modalOverlay")) el("modalOverlay").classList.remove("visible");
});

// ── Guardar ───────────────────────────────────────────────
el("btnGuardar").addEventListener("click", async () => {
  const id         = el("claveId").value.trim();
  const servicio   = el("fServicio").value.trim().toLowerCase().replace(/\s+/g, "_");
  const nombre     = el("fNombre").value.trim();
  const origenUrl  = el("fOrigenUrl").value.trim();
  const nuevaClave = el("fClave").value.trim();
  const modelosTxt = el("fModelos").value.trim();
  const nota       = el("fNota").value.trim();
  const activo     = el("fActivo").value === "true";
  const modelos    = modelosTxt ? modelosTxt.split("\n").map(m => m.trim()).filter(Boolean) : [];

  if (!servicio) { setErr("El identificador del servicio es obligatorio."); return; }
  if (!nombre)   { setErr("El nombre es obligatorio."); return; }
  if (!origenUrl){ setErr("La URL de origen es obligatoria."); return; }
  if (!id && !nuevaClave) { setErr("La clave API es obligatoria para un nuevo servicio."); return; }
  if (origenUrl) {
    try { new URL(origenUrl); } catch { setErr("La URL de origen no es válida."); return; }
  }

  const btn = el("btnGuardar");
  btnCargando(btn, true);
  el("msgErrorModal").classList.remove("visible");

  try {
    const datos = { servicio, nombre, origen_url: origenUrl, modelos, nota, activo };
    if (nuevaClave) datos.clave = nuevaClave;

    if (id) {
      await actualizarClaveApi(id, datos);
    } else {
      datos.clave = nuevaClave;
      await crearClaveApi(datos);
    }
    el("modalOverlay").classList.remove("visible");
    mostrarOk(id ? "✓ Clave actualizada." : "✓ Clave creada.");
    await cargarClaves();
  } catch (e) {
    console.error(e); setErr("Error al guardar: " + (e.message || "intenta de nuevo."));
  } finally { btnCargando(btn, false); }
});

// ── Editar ────────────────────────────────────────────────
window.editarClave = id => {
  const c = claves.find(x => x.id === id);
  if (c) abrirModal(c);
};

// ── Eliminar ──────────────────────────────────────────────
window.pedirEliminar = id => { eliminarId = id; el("modalEliminarOverlay").classList.add("visible"); };
el("btnCancelarEliminar").addEventListener("click", () => { eliminarId = null; el("modalEliminarOverlay").classList.remove("visible"); });
el("btnConfirmarEliminar").addEventListener("click", async () => {
  if (!eliminarId) return;
  const btn = el("btnConfirmarEliminar");
  btnCargando(btn, true);
  try {
    await eliminarClaveApi(eliminarId);
    el("modalEliminarOverlay").classList.remove("visible");
    eliminarId = null;
    mostrarOk("✓ Clave eliminada.");
    await cargarClaves();
  } catch (e) { console.error(e); mostrarError("Error al eliminar."); }
  finally { btnCargando(btn, false); }
});

// ── Mensajes ──────────────────────────────────────────────
function setErr(m) { el("textoErrorModal").textContent = m; el("msgErrorModal").classList.add("visible"); }
function mostrarOk(m) {
  el("textoOk").textContent = m; el("msgOk").classList.add("visible");
  el("msgError").classList.remove("visible");
  setTimeout(() => el("msgOk").classList.remove("visible"), 4000);
}
function mostrarError(m) { el("textoError").textContent = m; el("msgError").classList.add("visible"); }

cargarClaves();