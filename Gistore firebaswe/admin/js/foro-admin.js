// ============================================================
//  admin/js/foro-admin.js — Moderación del foro
// ============================================================
import { cerrarSesion, protegerPagina } from "./auth.js";
import {
  obtenerTodosHilosForo, obtenerRespuestasPorHilo,
  eliminarHiloForo, eliminarRespuestaForoAdmin,
} from "./db.js";
import { fechaHoy } from "./ui.js";

protegerPagina("../index.html");

const el = id => document.getElementById(id);
let hilos = [];

el("fechaHoy").textContent = fechaHoy();
el("btnSalir").addEventListener("click", async () => {
  await cerrarSesion(); window.location.href = "../index.html";
});

// ── Modal de confirmación ─────────────────────────────────
// Devuelve una Promise<boolean> — true si el usuario confirmó
function confirmar({ icono = "🗑", titulo = "¿Confirmar?", msg = "", btnOk = "Eliminar" } = {}) {
  return new Promise(resolve => {
    el("modalConfirmIcono").textContent  = icono;
    el("modalConfirmTitulo").textContent = titulo;
    el("modalConfirmMsg").textContent    = msg;
    el("btnModalOk").textContent         = btnOk;
    el("modalConfirm").classList.add("visible");

    const cerrar = ok => {
      el("modalConfirm").classList.remove("visible");
      resolve(ok);
    };

    el("btnModalOk").addEventListener("click",      () => cerrar(true),  { once: true });
    el("btnModalCancelar").addEventListener("click", () => cerrar(false), { once: true });

    el("modalConfirm").addEventListener("click", e => {
      if (e.target === el("modalConfirm")) cerrar(false);
    }, { once: true });
  });
}

// ── Formato de fecha ──────────────────────────────────────
function fmtFecha(iso) {
  if (!iso) return "—";
  const d = iso?.toMillis ? new Date(iso.toMillis()) : new Date(iso);
  return d.toLocaleString("es-CO", { day:"numeric", month:"short", year:"numeric", hour:"2-digit", minute:"2-digit" });
}

// ── Cargar ────────────────────────────────────────────────
async function cargar() {
  el("foroAdminLista").innerHTML = '<p class="cargando-txt">Cargando…</p>';
  try {
    hilos = await obtenerTodosHilosForo();
    renderHilos();
  } catch (e) {
    console.error(e);
    el("foroAdminLista").innerHTML = '<p class="vacio-txt">Error al cargar el foro.</p>';
  }
}

function renderHilos() {
  if (!hilos.length) {
    el("foroAdminLista").innerHTML = '<p class="vacio-txt">No hay hilos en el foro aún.</p>';
    return;
  }
  el("foroAdminLista").innerHTML = hilos.map(h => `
    <div class="hilo-admin" id="hilo-${h.id}">
      <div class="hilo-admin-header" onclick="toggleHilo('${h.id}')">
        <div class="hilo-avatar-sm" style="background:${h.autor_color||'#1a6b3c'}">
          ${h.autor_foto
            ? `<img src="${h.autor_foto}" onerror="this.style.display='none'">`
            : (h.autor_nombre||"?")[0].toUpperCase()}
        </div>
        <div class="hilo-admin-meta">
          <div class="hilo-admin-titulo">${h.titulo||"(sin título)"}</div>
          <div class="hilo-admin-info">
            <span>👤 ${h.autor_nombre||"—"}</span>
            <span>🕐 ${fmtFecha(h.creado_en)}</span>
            <span>💬 ${h.respuestas||0} respuesta${(h.respuestas||0)!==1?"s":""}</span>
          </div>
        </div>
        <button class="btn-elim-foro" onclick="event.stopPropagation();eliminarHilo('${h.id}')">🗑 Eliminar hilo</button>
      </div>
      <div class="hilo-admin-body" id="body-${h.id}">
        ${h.cuerpo ? `<p style="font-size:.85rem;color:var(--gris-700);margin-bottom:1rem;line-height:1.5;white-space:pre-wrap">${h.cuerpo}</p>` : ""}
        <div id="resps-${h.id}"><p style="font-size:.8rem;color:var(--texto-suave)">Haz clic para cargar respuestas…</p></div>
      </div>
    </div>`).join("");
}

// ── Toggle hilo ───────────────────────────────────────────
const _cargados = {};
window.toggleHilo = async hiloId => {
  const body = el(`body-${hiloId}`);
  if (!body) return;
  const abierto = body.classList.toggle("open");
  if (abierto && !_cargados[hiloId]) {
    _cargados[hiloId] = true;
    await cargarRespuestas(hiloId);
  }
};

async function cargarRespuestas(hiloId) {
  const cont = el(`resps-${hiloId}`);
  if (!cont) return;
  cont.innerHTML = '<p style="font-size:.8rem;color:var(--texto-suave)">Cargando respuestas…</p>';
  try {
    const resps = await obtenerRespuestasPorHilo(hiloId);
    if (!resps.length) {
      cont.innerHTML = '<p style="font-size:.8rem;color:var(--texto-suave);padding:.5rem 0">Sin respuestas.</p>';
      return;
    }
    cont.innerHTML = resps.map(r => `
      <div class="resp-admin" id="resp-${r.id}">
        <div class="hilo-avatar-sm" style="background:${r.autor_color||'#1a6b3c'};width:28px;height:28px;font-size:.75rem">
          ${r.autor_foto
            ? `<img src="${r.autor_foto}" onerror="this.style.display='none'">`
            : (r.autor_nombre||"?")[0].toUpperCase()}
        </div>
        <div class="resp-admin-body">
          <div style="display:flex;align-items:center;gap:.5rem;flex-wrap:wrap">
            <span class="resp-admin-autor">${r.autor_nombre||"—"}</span>
            <span style="font-size:.7rem;color:var(--texto-suave)">${fmtFecha(r.creado_en)}</span>
          </div>
          <div class="resp-admin-texto" style="white-space:pre-wrap">${r.texto||""}</div>
        </div>
        <button class="btn-elim-foro" onclick="eliminarResp('${r.id}','${hiloId}')">🗑</button>
      </div>`).join("");
  } catch (e) {
    console.error(e);
    cont.innerHTML = '<p style="font-size:.8rem;color:var(--error)">Error al cargar respuestas.</p>';
  }
}

// ── Eliminar hilo (y sus respuestas) ──────────────────────
window.eliminarHilo = async hiloId => {
  const hilo = hilos.find(h => h.id === hiloId);
  const ok = await confirmar({
    icono:  "⚠️",
    titulo: "¿Eliminar hilo?",
    msg:    `Se eliminará "${hilo?.titulo || "este hilo"}" y TODAS sus respuestas. Esta acción no se puede deshacer.`,
    btnOk:  "Sí, eliminar",
  });
  if (!ok) return;
  try {
    await eliminarHiloForo(hiloId);
    el(`hilo-${hiloId}`)?.remove();
    hilos = hilos.filter(h => h.id !== hiloId);
    mostrarOk("✓ Hilo eliminado.");
  } catch (e) { console.error(e); mostrarError("Error al eliminar el hilo."); }
};

// ── Eliminar respuesta ────────────────────────────────────
window.eliminarResp = async (respId, hiloId) => {
  const ok = await confirmar({
    icono:  "🗑",
    titulo: "¿Eliminar respuesta?",
    msg:    "Esta respuesta será eliminada permanentemente.",
    btnOk:  "Sí, eliminar",
  });
  if (!ok) return;
  try {
    await eliminarRespuestaForoAdmin(respId, hiloId);
    el(`resp-${respId}`)?.remove();
    const h = hilos.find(x => x.id === hiloId);
    if (h) h.respuestas = Math.max(0, (h.respuestas||0) - 1);
    const infoEl = document.querySelector(`#hilo-${hiloId} .hilo-admin-info span:nth-child(3)`);
    if (infoEl && h) infoEl.textContent = `💬 ${h.respuestas} respuesta${h.respuestas!==1?"s":""}`;
    mostrarOk("✓ Respuesta eliminada.");
  } catch (e) { console.error(e); mostrarError("Error al eliminar respuesta."); }
};

// ── Mensajes ──────────────────────────────────────────────
function mostrarOk(m) {
  el("textoOk").textContent = m; el("msgOk").classList.add("visible");
  el("msgError").classList.remove("visible");
  setTimeout(() => el("msgOk").classList.remove("visible"), 4000);
}
function mostrarError(m) { el("textoError").textContent = m; el("msgError").classList.add("visible"); }

cargar();