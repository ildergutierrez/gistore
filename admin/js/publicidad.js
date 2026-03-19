// ============================================================
//  admin/js/publicidad.js — Gestión de publicidades
//  Depende de: db.js (funciones CRUD), auth.js, ui.js
// ============================================================
import { cerrarSesion, protegerPagina } from "./auth.js";
import {
  obtenerPublicidades,
  crearPublicidad, actualizarPublicidad, eliminarPublicidad,
  leerImpresionesHoy,
} from "./db.js";
import { fechaHoy, btnCargando } from "./ui.js";

protegerPagina("../index.html");

const CLOUD_NAME    = "dqmrgerue";
const UPLOAD_PRESET = "gi-store-publicidad";
const PUB_FOLDER    = "publicidad";

const el = id => document.getElementById(id);

let publicidades = [];
let archivoImg   = null;
let eliminarId   = null;

el("fechaHoy").textContent = fechaHoy();
el("btnSalir").addEventListener("click", async () => {
  await cerrarSesion(); window.location.href = "../index.html";
});

// ── Cargar lista ──────────────────────────────────────────
async function cargarPublicidades() {
  el("pubLista").innerHTML = '<p class="cargando-txt">Cargando...</p>';
  try {
    publicidades = await obtenerPublicidades();
    const conteos = await Promise.all(
      publicidades.map(p => leerImpresionesHoy(p.id).catch(() => 0))
    );
    publicidades.forEach((p, i) => { p._hoy_count = conteos[i]; });
    renderLista();
  } catch (e) {
    console.error(e);
    el("pubLista").innerHTML = '<p class="vacio-txt">Error al cargar publicidades.</p>';
  }
}

function renderLista() {
  if (!publicidades.length) {
    el("pubLista").innerHTML = '<p class="vacio-txt">No hay publicidades aún. Crea la primera con el botón de arriba.</p>';
    return;
  }
  const hoy = new Date().toISOString().split("T")[0];
  el("pubLista").innerHTML = `<div class="pub-grid">${publicidades.map(p => {
    const vigente = p.fecha_inicio <= hoy && p.fecha_fin >= hoy;
    const badge   = p.estado === "pausada"
      ? `<span class="badge badge-pausada">⏸ Pausada</span>`
      : vigente
        ? `<span class="badge badge-activa">✅ Activa</span>`
        : `<span class="badge badge-vencida">⏰ Vencida</span>`;
    const imgHtml = p.imagen_url
      ? `<img class="pub-card-img" src="${p.imagen_url}" alt="${p.titulo||''}" loading="lazy"
             onerror="this.parentElement.innerHTML='<div class=pub-card-img-placeholder>🖼</div>'">`
      : `<div class="pub-card-img-placeholder">🖼</div>`;
    const cupo  = p.limite_diario ?? 0;
    const usado = p._hoy_count   ?? 0;
    const pct   = cupo > 0 ? Math.min(100, Math.round((usado / cupo) * 100)) : 0;
    const urlCorta = p.url_destino ? p.url_destino.replace(/^https?:\/\//, "") : "";
    return `<div class="pub-card">
      ${imgHtml}
      <div class="pub-card-body">
        <div class="pub-card-titulo" title="${p.titulo||''}">${p.titulo || '(sin título)'}</div>
        <div class="pub-card-meta">
          ${badge}
          <span>📅 ${p.fecha_inicio} → ${p.fecha_fin}</span>
          <span>🔁 Máx <strong>${cupo}</strong>/día</span>
          ${urlCorta ? `<span>🔗 <a href="${p.url_destino}" target="_blank" rel="noopener"
            style="color:var(--verde);text-decoration:none;display:inline-block;max-width:170px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;vertical-align:bottom"
            title="${p.url_destino}">${urlCorta}</a></span>` : ""}
        </div>
        <div style="margin-bottom:.75rem">
          <div class="vistas-label">
            <span>Hoy: <strong>${usado}</strong> / ${cupo}</span>
            <span>${pct}%</span>
          </div>
          <div class="vistas-bar"><div class="vistas-bar-fill" style="width:${pct}%"></div></div>
        </div>
        <div class="pub-card-acciones">
          <button class="btn-tabla btn-editar" onclick="editarPub('${p.id}')">✏️ Editar</button>
          <button class="btn-tabla" onclick="pausarToggle('${p.id}')"
            style="background:${p.estado==='pausada'?'var(--verde-claro,#f0faf4)':'var(--fondo,#f9fafb)'}">
            ${p.estado==='pausada'?'▶️ Activar':'⏸ Pausar'}
          </button>
          <button class="btn-tabla btn-eliminar" onclick="pedirEliminar('${p.id}')">🗑</button>
        </div>
      </div>
    </div>`;
  }).join("")}</div>`;
}

// ── Modal ─────────────────────────────────────────────────
el("btnNueva").addEventListener("click", () => abrirModal());

function abrirModal(pub = null) {
  const esEd = !!pub;
  el("modalTitulo").textContent  = esEd ? "✏️ Editar publicidad" : "📢 Nueva publicidad";
  el("pubId").value              = pub?.id           || "";
  el("fTitulo").value            = pub?.titulo       || "";
  el("fUrl").value               = pub?.url_destino  || "";
  el("fFechaInicio").value       = pub?.fecha_inicio || new Date().toISOString().split("T")[0];
  el("fFechaFin").value          = pub?.fecha_fin    || "";
  el("fLimiteDiario").value      = pub?.limite_diario ?? 50;
  el("fEstado").value            = pub?.estado       || "activa";
  if (pub?.imagen_url) {
    el("campoUrlActual").style.display = "block";
    el("imgActual").src = pub.imagen_url;
  } else {
    el("campoUrlActual").style.display = "none";
    el("imgActual").src = "";
  }
  archivoImg = null;
  el("fImgFile").value = "";
  el("imgNombre").textContent = esEd ? "Deja vacío para mantener imagen actual" : "Sin imagen seleccionada";
  el("imgPreviewWrap").style.display = "none";
  el("msgErrorModal").classList.remove("visible");
  el("modalOverlay").classList.add("visible");
}

el("btnCancelar").addEventListener("click", () => el("modalOverlay").classList.remove("visible"));
el("modalOverlay").addEventListener("click", e => { if (e.target === el("modalOverlay")) el("modalOverlay").classList.remove("visible"); });

el("btnElegirImg").addEventListener("click", () => el("fImgFile").click());
el("fImgFile").addEventListener("change", () => {
  const file = el("fImgFile").files[0];
  if (!file) return;
  if (file.size > 3*1024*1024) { setErrorModal("La imagen no puede superar 3 MB."); el("fImgFile").value=""; return; }
  archivoImg = file;
  el("imgNombre").textContent = `${file.name} · ${(file.size/1024).toFixed(0)} KB`;
  const r = new FileReader();
  r.onload = ev => { el("imgPreview").src = ev.target.result; el("imgPreviewWrap").style.display = "block"; };
  r.readAsDataURL(file);
});

el("btnGuardar").addEventListener("click", async () => {
  const id      = el("pubId").value.trim();
  const titulo  = el("fTitulo").value.trim();
  const urlDest = el("fUrl").value.trim();
  const inicio  = el("fFechaInicio").value;
  const fin     = el("fFechaFin").value;
  const limite  = Math.max(1, parseInt(el("fLimiteDiario").value, 10) || 50);
  const estado  = el("fEstado").value;

  if (!inicio || !fin)      { setErrorModal("Las fechas son obligatorias."); return; }
  if (fin < inicio)          { setErrorModal("La fecha de fin debe ser posterior al inicio."); return; }
  if (!id && !archivoImg)    { setErrorModal("Debes seleccionar una imagen."); return; }
  if (urlDest) {
    try { const u = new URL(urlDest); if (!["http:","https:"].includes(u.protocol)) throw 0; }
    catch { setErrorModal("URL de destino no válida. Debe empezar con https://"); return; }
  }

  const btn = el("btnGuardar");
  btnCargando(btn, true);
  el("msgErrorModal").classList.remove("visible");
  try {
    let imagen_url = el("imgActual").src || "";
    if (archivoImg) imagen_url = await subirCloudinary(archivoImg);
    const datos = { titulo, imagen_url, url_destino: urlDest, fecha_inicio: inicio, fecha_fin: fin, limite_diario: limite, estado };
    id ? await actualizarPublicidad(id, datos) : await crearPublicidad(datos);
    el("modalOverlay").classList.remove("visible");
    mostrarOk(id ? "✓ Publicidad actualizada." : "✓ Publicidad creada.");
    await cargarPublicidades();
  } catch(e) {
    console.error(e); setErrorModal("Error al guardar: " + (e.message || "intenta de nuevo."));
  } finally { btnCargando(btn, false); }
});

window.editarPub = id => { const p = publicidades.find(x => x.id === id); if (p) abrirModal(p); };

window.pausarToggle = async id => {
  const p = publicidades.find(x => x.id === id);
  if (!p) return;
  const nuevo = p.estado === "pausada" ? "activa" : "pausada";
  try { await actualizarPublicidad(id, { estado: nuevo }); mostrarOk(`✓ Publicidad ${nuevo}.`); await cargarPublicidades(); }
  catch(e) { console.error(e); mostrarError("Error al cambiar estado."); }
};

window.pedirEliminar = id => { eliminarId = id; el("modalEliminarOverlay").classList.add("visible"); };
el("btnCancelarEliminar").addEventListener("click", () => { eliminarId = null; el("modalEliminarOverlay").classList.remove("visible"); });
el("btnConfirmarEliminar").addEventListener("click", async () => {
  if (!eliminarId) return;
  const btn = el("btnConfirmarEliminar");
  btnCargando(btn, true);
  try {
    await eliminarPublicidad(eliminarId);
    el("modalEliminarOverlay").classList.remove("visible");
    eliminarId = null;
    mostrarOk("✓ Publicidad eliminada.");
    await cargarPublicidades();
  } catch(e) { console.error(e); mostrarError("Error al eliminar."); }
  finally { btnCargando(btn, false); }
});

async function subirCloudinary(file) {
  const fd = new FormData();
  fd.append("file", file); fd.append("upload_preset", UPLOAD_PRESET); fd.append("folder", PUB_FOLDER);
  const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`, { method:"POST", body:fd });
  const d   = await res.json();
  if (!res.ok) throw new Error(d.error?.message || "Error Cloudinary");
  return d.secure_url;
}

function setErrorModal(m) { el("textoErrorModal").textContent=m; el("msgErrorModal").classList.add("visible"); }
function mostrarOk(m)  { el("textoOk").textContent=m; el("msgOk").classList.add("visible"); el("msgError").classList.remove("visible"); setTimeout(()=>el("msgOk").classList.remove("visible"),4500); }
function mostrarError(m){ el("textoError").textContent=m; el("msgError").classList.add("visible"); el("msgOk").classList.remove("visible"); }

cargarPublicidades();