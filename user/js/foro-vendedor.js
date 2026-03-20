// ============================================================
//  user/js/foro-vendedor.js — Foro desde el portal del vendedor
//  · Protege la ruta (solo vendedores autenticados)
//  · Puede crear hilos y responder
//  · Puede eliminar sus propias respuestas (cualquier momento)
//  · Puede editar sus respuestas solo si han pasado < 30 min
// ============================================================
import { cerrarSesion, protegerPagina } from "./auth.js";
import {
  obtenerVendedorPorUid,
  obtenerHilosForo, crearHiloForo,
  obtenerRespuestasForo, crearRespuestaForo,
  editarRespuestaForo, eliminarRespuestaForo,
} from "./db.js";
import { fechaHoy, btnCargando } from "./ui.js";
import { auth } from "./firebase.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.10.0/firebase-auth.js";

protegerPagina("../index.html");

// ── Estado ────────────────────────────────────────────────
let vendedor      = null;
let hilos         = [];
let hilosFiltrados = [];
let paginaActual  = 1;
const POR_PAGINA  = 10;

const el = id => document.getElementById(id);

function fmtFecha(iso) {
  if (!iso) return "";
  const d = new Date(iso), ahora = new Date(), diff = (ahora - d) / 1000;
  if (diff < 60)    return "hace un momento";
  if (diff < 3600)  return `hace ${Math.floor(diff/60)} min`;
  if (diff < 86400) return `hace ${Math.floor(diff/3600)} h`;
  return d.toLocaleDateString("es-CO", { day:"numeric", month:"short", year:"numeric" });
}

// ── Auth ──────────────────────────────────────────────────
onAuthStateChanged(auth, async user => {
  if (!user) return;
  document.body.style.visibility = "visible";
  if (el("fechaHoy")) el("fechaHoy").textContent = fechaHoy();
  el("btnSalir").addEventListener("click", async () => {
    await cerrarSesion(); window.location.href = "../index.html";
  });

  try {
    vendedor = await obtenerVendedorPorUid(user.uid);
    if (el("vendedorNombre")) el("vendedorNombre").textContent = vendedor?.nombre || "";
  } catch { /* sin datos extra */ }

  await cargarHilos();
});

document.body.style.visibility = "hidden";

// ── Cargar hilos ──────────────────────────────────────────
async function cargarHilos() {
  try {
    hilos = await obtenerHilosForo();
    aplicarFiltro();
  } catch (e) {
    console.error(e);
    el("listaHilos").innerHTML = '<p class="vacio-txt">Error al cargar el foro.</p>';
  }
}

function aplicarFiltro() {
  const txt = (el("busqForo").value || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"");
  hilosFiltrados = txt
    ? hilos.filter(h =>
        (h.titulo||"").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").includes(txt) ||
        (h.cuerpo||"").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").includes(txt))
    : [...hilos];
  paginaActual = 1;
  renderHilos();
}

el("busqForo").addEventListener("input", aplicarFiltro);

function renderHilos() {
  const inicio  = (paginaActual - 1) * POR_PAGINA;
  const pagina  = hilosFiltrados.slice(inicio, inicio + POR_PAGINA);
  const totalP  = Math.ceil(hilosFiltrados.length / POR_PAGINA);

  if (!hilosFiltrados.length) {
    el("listaHilos").innerHTML = '<div class="foro-vacio-p"><span style="font-size:2rem">🔍</span><p>No hay hilos aún.</p></div>';
    el("foroPaginado").innerHTML = "";
    return;
  }

  el("listaHilos").innerHTML = pagina.map(h => `
    <div class="hilo-card-p">
      <div class="hilo-header-p">
        <div class="hilo-avatar-p" style="background:${h.autor_color||'#1a6b3c'}">
          ${h.autor_foto?`<img src="${h.autor_foto}" onerror="this.style.display='none'">`:(h.autor_nombre||"?")[0].toUpperCase()}
        </div>
        <div class="hilo-meta-p">
          <div class="hilo-autor-p">${h.autor_nombre||"Vendedor"}</div>
          <div class="hilo-fecha-p">${fmtFecha(h.creado_en)}</div>
        </div>
      </div>
      <div class="hilo-titulo-p">${h.titulo||""}</div>
      ${h.cuerpo?`<div class="hilo-cuerpo-p">${h.cuerpo}</div>`:""}
      <div class="hilo-footer-p">
        <span class="hilo-stats-p">💬 ${h.respuestas||0} respuesta${(h.respuestas||0)!==1?"s":""}</span>
        <button class="btn-ver-p" onclick="abrirHilo('${h.id}')">Ver hilo →</button>
      </div>
    </div>`).join("");

  let pagHtml = "";
  for (let i = 1; i <= totalP; i++) {
    pagHtml += `<button class="pag-btn-p${i===paginaActual?" activo":""}" onclick="irPagina(${i})">${i}</button>`;
  }
  el("foroPaginado").innerHTML = pagHtml;
}

window.irPagina = p => { paginaActual = p; renderHilos(); window.scrollTo({top:0,behavior:"smooth"}); };

// ── Abrir hilo ────────────────────────────────────────────
window.abrirHilo = async hiloId => {
  const hilo = hilos.find(h => h.id === hiloId);
  if (!hilo) return;

  el("modalHiloTitulo").textContent = hilo.titulo || "";

  el("modalHiloCuerpo").innerHTML = `
    <div style="margin-bottom:1.1rem;padding-bottom:1.1rem;border-bottom:2px solid var(--borde,#e5e7eb)">
      <div style="display:flex;gap:.7rem;align-items:flex-start">
        <div class="hilo-avatar-p" style="background:${hilo.autor_color||'#1a6b3c'}">
          ${hilo.autor_foto?`<img src="${hilo.autor_foto}" onerror="this.style.display='none'">`:(hilo.autor_nombre||"?")[0].toUpperCase()}
        </div>
        <div>
          <div class="hilo-autor-p">${hilo.autor_nombre||"Vendedor"}</div>
          <div class="hilo-fecha-p">${fmtFecha(hilo.creado_en)}</div>
        </div>
      </div>
      ${hilo.cuerpo?`<p style="margin-top:.75rem;font-size:.88rem;color:var(--gris-700,#374151);line-height:1.55">${hilo.cuerpo}</p>`:""}
    </div>
    <div id="listaRespuestas"><p style="color:var(--texto-suave);font-size:.83rem">Cargando…</p></div>`;

  el("modalHiloFooter").innerHTML = `
    <div class="caja-resp">
      <textarea id="txtRespuesta" placeholder="Escribe tu respuesta…" maxlength="1200"></textarea>
      <div class="caja-resp-footer">
        <button class="btn btn-primary btn-sm" onclick="publicarRespuesta('${hiloId}')">Responder</button>
      </div>
    </div>`;

  el("modalHilo").classList.add("visible");
  await cargarRespuestas(hiloId);
};

async function cargarRespuestas(hiloId) {
  try {
    const resps = await obtenerRespuestasForo(hiloId);
    renderRespuestas(resps, hiloId);
  } catch (e) {
    console.error(e);
    el("listaRespuestas").innerHTML = '<p style="color:var(--texto-suave);font-size:.83rem">Error al cargar.</p>';
  }
}

function renderRespuestas(resps, hiloId) {
  const cont = el("listaRespuestas");
  if (!resps.length) {
    cont.innerHTML = '<p style="color:var(--texto-suave);font-size:.83rem;text-align:center;padding:.75rem 0">Sin respuestas aún.</p>';
    return;
  }
  const ahora = new Date();
  const miUid = auth.currentUser?.uid;

  cont.innerHTML = resps.map(r => {
    const esMio       = miUid && r.autor_id === miUid;
    const puedoEditar = esMio && ((ahora - new Date(r.creado_en)) < 30 * 60 * 1000);

    return `<div class="resp-item" id="resp-${r.id}">
      <div class="resp-av" style="background:${r.autor_color||'#1a6b3c'}">
        ${r.autor_foto?`<img src="${r.autor_foto}" onerror="this.style.display='none'">`:(r.autor_nombre||"?")[0].toUpperCase()}
      </div>
      <div class="resp-body">
        <div style="display:flex;align-items:center;gap:.5rem;flex-wrap:wrap">
          <span class="resp-autor-p">${r.autor_nombre||"Vendedor"}</span>
          <span class="resp-fecha-p">${fmtFecha(r.creado_en)}</span>
        </div>
        <div class="resp-texto-p" id="rtexto-${r.id}">${r.texto||""}</div>
        ${esMio?`<div class="resp-acciones-p">
          ${puedoEditar?`<button class="btn-accion-p" onclick="editarResp('${r.id}','${hiloId}')">✏️ Editar</button>`:""}
          <button class="btn-accion-p del" onclick="eliminarResp('${r.id}','${hiloId}')">🗑 Eliminar</button>
        </div>`:""}
      </div>
    </div>`;
  }).join("");
}

// ── Publicar respuesta ────────────────────────────────────
window.publicarRespuesta = async hiloId => {
  const txt = (el("txtRespuesta")?.value || "").trim();
  if (!txt) { alert("Escribe tu respuesta primero."); return; }
  if (!vendedor && !auth.currentUser) return;

  try {
    const datos = {
      hilo_id:      hiloId,
      autor_id:     auth.currentUser.uid,
      autor_nombre: vendedor?.nombre || auth.currentUser.email.split("@")[0],
      autor_foto:   vendedor?.perfil || "",
      autor_color:  vendedor?.color  || "#1a6b3c",
      texto:        txt,
    };
    await crearRespuestaForo(datos);
    el("txtRespuesta").value = "";
    // Actualizar contador local
    const h = hilos.find(x => x.id === hiloId);
    if (h) h.respuestas = (h.respuestas||0) + 1;
    await cargarRespuestas(hiloId);
  } catch (e) { console.error(e); alert("Error al publicar."); }
};

// ── Editar ────────────────────────────────────────────────
window.editarResp = (respId, hiloId) => {
  const textoEl = el(`rtexto-${respId}`);
  if (!textoEl) return;
  const textoActual = textoEl.textContent;
  textoEl.innerHTML = `
    <textarea style="width:100%;min-height:65px;border:1.5px solid var(--verde,#1a6b3c);border-radius:8px;padding:.45rem;font-size:.85rem;font-family:inherit;box-sizing:border-box"
      id="edit-${respId}">${textoActual}</textarea>
    <div style="display:flex;gap:.4rem;margin-top:.35rem;justify-content:flex-end">
      <button onclick="cancelarEdicion('${respId}','${textoActual}')" class="btn btn-secundario btn-sm">Cancelar</button>
      <button onclick="guardarEdicion('${respId}','${hiloId}')" class="btn btn-primary btn-sm">Guardar</button>
    </div>`;
};

window.cancelarEdicion = (respId, original) => {
  const e = el(`rtexto-${respId}`); if (e) e.innerHTML = original;
};

window.guardarEdicion = async (respId, hiloId) => {
  const nuevo = (el(`edit-${respId}`)?.value || "").trim();
  if (!nuevo) { alert("El texto no puede estar vacío."); return; }
  try {
    await editarRespuestaForo(respId, nuevo);
    await cargarRespuestas(hiloId);
    mostrarOk("✓ Respuesta editada.");
  } catch (e) { alert(e.message || "Error al editar."); }
};

// ── Eliminar ──────────────────────────────────────────────
window.eliminarResp = async (respId, hiloId) => {
  if (!confirm("¿Eliminar esta respuesta?")) return;
  try {
    await eliminarRespuestaForo(respId, hiloId);
    el(`resp-${respId}`)?.remove();
    const h = hilos.find(x => x.id === hiloId);
    if (h) h.respuestas = Math.max(0, (h.respuestas||0) - 1);
    mostrarOk("✓ Respuesta eliminada.");
  } catch (e) { console.error(e); mostrarError("Error al eliminar."); }
};

// ── Modal nueva pregunta ──────────────────────────────────
el("btnNuevaPregunta").addEventListener("click", () => {
  el("fForoTitulo").value = ""; el("fForoCuerpo").value = "";
  el("modalPregunta").classList.add("visible");
});
el("btnCancelarPregunta").addEventListener("click", () => el("modalPregunta").classList.remove("visible"));
el("modalPregunta").addEventListener("click", e => {
  if (e.target === el("modalPregunta")) el("modalPregunta").classList.remove("visible");
});

el("btnPublicarPregunta").addEventListener("click", async () => {
  const titulo = (el("fForoTitulo").value || "").trim();
  const cuerpo = (el("fForoCuerpo").value || "").trim();
  if (!titulo) { alert("El título es obligatorio."); return; }
  const btn = el("btnPublicarPregunta");
  btnCargando(btn, true);
  try {
    await crearHiloForo({
      titulo, cuerpo,
      autor_id:     auth.currentUser?.uid || "",
      autor_nombre: vendedor?.nombre || "",
      autor_foto:   vendedor?.perfil || "",
      autor_color:  vendedor?.color  || "#1a6b3c",
    });
    el("modalPregunta").classList.remove("visible");
    mostrarOk("✓ Pregunta publicada.");
    await cargarHilos();
  } catch (e) { console.error(e); mostrarError("Error al publicar."); }
  finally { btnCargando(btn, false); }
});

// ── Cerrar modal hilo ─────────────────────────────────────
el("btnCerrarHilo").addEventListener("click", () => el("modalHilo").classList.remove("visible"));
el("modalHilo").addEventListener("click", e => { if (e.target === el("modalHilo")) el("modalHilo").classList.remove("visible"); });

// ── Mensajes ──────────────────────────────────────────────
function mostrarOk(m) {
  el("textoOk").textContent=m; el("msgOk").classList.add("visible");
  el("msgError").classList.remove("visible");
  setTimeout(()=>el("msgOk").classList.remove("visible"),4000);
}
function mostrarError(m) { el("textoError").textContent=m; el("msgError").classList.add("visible"); }