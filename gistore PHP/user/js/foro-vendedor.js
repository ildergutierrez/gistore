// ============================================================
//  user/js/foro-vendedor.js — Foro desde el portal del vendedor
//  · Protege la ruta (solo vendedores autenticados)
//  · Puede crear hilos y responder
//  · Puede eliminar sus propias respuestas (cualquier momento)
//  · Puede editar sus respuestas solo si han pasado < 30 min
//  · Sin Firebase — usa MySQL vía backend/foro.php + tokens CSRF
// ============================================================

// ── Token CSRF ────────────────────────────────────────────
let _token = null;

async function getToken() {
  if (_token) return _token;
  try {
    const resp = await fetch('../../backend/tokens.php?accion=obtener', { credentials: 'include' });
    const data = await resp.json();
    _token = data.token || '';
  } catch { _token = ''; }
  return _token;
}

// ── Estado ────────────────────────────────────────────────
let vendedor       = null;   // datos del vendedor en sesión
let hilos          = [];
let hilosFiltrados = [];
let paginaActual   = 1;
const POR_PAGINA   = 10;

const el = id => document.getElementById(id);

// ── Fecha ─────────────────────────────────────────────────
if (el('fechaHoy')) {
  el('fechaHoy').textContent = new Date().toLocaleDateString('es-CO', {
    year: 'numeric', month: 'long', day: 'numeric'
  });
}

function fmtFecha(iso) {
  if (!iso) return '';
  const d = new Date(iso), ahora = new Date(), diff = (ahora - d) / 1000;
  if (diff < 60)    return 'hace un momento';
  if (diff < 3600)  return `hace ${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `hace ${Math.floor(diff / 3600)} h`;
  return d.toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' });
}

// ── Helpers fetch ─────────────────────────────────────────
async function apiForo(accion, params = {}) {
  const token = await getToken();
  return `../backend/foro.php?accion=${accion}&token=${token}&${new URLSearchParams(params)}`;
}

async function apiForoPost(accion, body = {}) {
  const token = await getToken();
  const fd = new FormData();
  fd.append('accion', accion);
  fd.append('token', token);
  Object.entries(body).forEach(([k, v]) => fd.append(k, v));
  const resp = await fetch('../backend/foro.php', { method: 'POST', body: fd, credentials: 'include' });
  return resp.json();
}

// ── Cargar datos del vendedor en sesión ───────────────────
async function cargarVendedor() {
  try {
    const token = await getToken();
    const resp  = await fetch(`../backend/vendedor.php?accion=stats&token=${token}`, { credentials: 'include' });
    const json  = await resp.json();
    if (json && json.nombre) {
      vendedor = json;
      if (el('vendedorNombre')) el('vendedorNombre').textContent = vendedor.nombre;
    }
  } catch { /* sin datos extra */ }
}

// ── Cargar hilos ──────────────────────────────────────────
async function cargarHilos() {
  try {
    const url  = await apiForo('obtener_hilos');
    const resp = await fetch(url, { credentials: 'include' });
    const json = await resp.json();
    if (!json.ok) throw new Error(json.error || 'Error al cargar hilos');
    hilos = json.datos || [];
    aplicarFiltro();
  } catch (e) {
    console.error(e);
    el('listaHilos').innerHTML = '<p class="vacio-txt">Error al cargar el foro.</p>';
  }
}

// ── Filtro y paginación ───────────────────────────────────
function norm(s) {
  return (s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function aplicarFiltro() {
  const txt = norm(el('busqForo')?.value || '');
  hilosFiltrados = txt
    ? hilos.filter(h => norm(h.titulo).includes(txt) || norm(h.contenido).includes(txt))
    : [...hilos];
  paginaActual = 1;
  renderHilos();
}

el('busqForo')?.addEventListener('input', aplicarFiltro);

function renderHilos() {
  const inicio = (paginaActual - 1) * POR_PAGINA;
  const pagina = hilosFiltrados.slice(inicio, inicio + POR_PAGINA);
  const totalP = Math.ceil(hilosFiltrados.length / POR_PAGINA);

  if (!hilosFiltrados.length) {
    el('listaHilos').innerHTML  = '<div class="foro-vacio-p"><span style="font-size:2rem">🔍</span><p>No hay hilos aún.</p></div>';
    el('foroPaginado').innerHTML = '';
    return;
  }

  el('listaHilos').innerHTML = pagina.map(h => `
    <div class="hilo-card-p">
      <div class="hilo-header-p">
        <div class="hilo-avatar-p" style="background:${h.autor_color || '#1a6b3c'}">
          ${h.vendedor_perfil
            ? `<img src="${h.vendedor_perfil}" onerror="this.style.display='none'">`
            : (h.vendedor_nombre || '?')[0].toUpperCase()}
        </div>
        <div class="hilo-meta-p">
          <div class="hilo-autor-p">${h.vendedor_nombre || 'Vendedor'}</div>
          <div class="hilo-fecha-p">${fmtFecha(h.creado_en)}</div>
        </div>
      </div>
      <div class="hilo-titulo-p">${h.titulo || ''}</div>
      ${h.cuerpo ? `<div class="hilo-cuerpo-p" style="white-space:pre-wrap">${h.contenido}</div>` : ''}
      <div class="hilo-footer-p">
        <span class="hilo-stats-p">💬 ${h.respuestas || 0} respuesta${(h.respuestas || 0) !== 1 ? 's' : ''}</span>
        <button class="btn-ver-p" onclick="abrirHilo(${h.id})">Ver hilo →</button>
      </div>
    </div>`).join('');

  let pagHtml = '';
  for (let i = 1; i <= totalP; i++) {
    pagHtml += `<button class="pag-btn-p${i === paginaActual ? ' activo' : ''}" onclick="irPagina(${i})">${i}</button>`;
  }
  el('foroPaginado').innerHTML = pagHtml;
}

window.irPagina = p => {
  paginaActual = p;
  renderHilos();
  window.scrollTo({ top: 0, behavior: 'smooth' });
};

// ── Abrir hilo ────────────────────────────────────────────
window.abrirHilo = async hiloId => {
  const hilo = hilos.find(h => h.id == hiloId);
  if (!hilo) return;

  el('modalHiloTitulo').textContent = hilo.titulo || '';

  el('modalHiloCuerpo').innerHTML = `
    <div style="margin-bottom:1.1rem;padding-bottom:1.1rem;border-bottom:2px solid var(--borde,#e5e7eb)">
      <div style="display:flex;gap:.7rem;align-items:flex-start">
        <div class="hilo-avatar-p" style="background:${hilo.autor_color || '#1a6b3c'}">
          ${hilo.vendedor_perfil
            ? `<img src="${hilo.vendedor_perfil}" onerror="this.style.display='none'">`
            : (hilo.vendedor_nombre || '?')[0].toUpperCase()}
        </div>
        <div>
          <div class="hilo-autor-p">${hilo.vendedor_nombre || 'Vendedor'}</div>
          <div class="hilo-fecha-p">${fmtFecha(hilo.creado_en)}</div>
        </div>
      </div>
      ${hilo.contenido ? `<p style="margin-top:.75rem;font-size:.88rem;color:var(--gris-700,#374151);line-height:1.55;white-space:pre-wrap">${hilo.contenido}</p>` : ''}
    </div>
    <div id="listaRespuestas"><p style="color:var(--texto-suave);font-size:.83rem">Cargando…</p></div>`;

  el('modalHiloFooter').innerHTML = `
    <div class="caja-resp">
      <textarea id="txtRespuesta" placeholder="Escribe tu respuesta…" maxlength="1200"></textarea>
      <div class="caja-resp-footer">
        <button class="btn btn-primary btn-sm" onclick="publicarRespuesta(${hiloId})">Responder</button>
      </div>
    </div>`;

  el('modalHilo').classList.add('visible');
  await cargarRespuestas(hiloId);
};

// ── Cargar respuestas ─────────────────────────────────────
async function cargarRespuestas(hiloId) {
  try {
    const url  = await apiForo('obtener_respuestas', { hilo_id: hiloId });
    const resp = await fetch(url, { credentials: 'include' });
    const json = await resp.json();
    if (!json.ok) throw new Error(json.error);
    renderRespuestas(json.datos || [], hiloId);
  } catch (e) {
    console.error(e);
    el('listaRespuestas').innerHTML = '<p style="color:var(--texto-suave);font-size:.83rem">Error al cargar.</p>';
  }
}

function renderRespuestas(resps, hiloId) {
  const cont = el('listaRespuestas');
  if (!resps.length) {
    cont.innerHTML = '<p style="color:var(--texto-suave);font-size:.83rem;text-align:center;padding:.75rem 0">Sin respuestas aún.</p>';
    return;
  }

  const ahora      = new Date();
  const miUsuario  = vendedor?.usuario_id || null;   // ID numérico de la sesión

  cont.innerHTML = resps.map(r => {
    const esMio       = miUsuario && r.usuario_id == miUsuario;
    const puedoEditar = esMio && ((ahora - new Date(r.creado_en)) < 30 * 60 * 1000);

    return `<div class="resp-item" id="resp-${r.id}">
      <div class="resp-av" style="background:${r.autor_color || '#1a6b3c'}">
        ${r.vendedor_perfil
          ? `<img src="${r.vendedor_perfil}" onerror="this.style.display='none'">`
          : (r.vendedor_nombre || '?')[0].toUpperCase()}
      </div>
      <div class="resp-body">
        <div style="display:flex;align-items:center;gap:.5rem;flex-wrap:wrap">
          <span class="resp-autor-p">${r.vendedor_nombre || 'Vendedor'}</span>
          <span class="resp-fecha-p">${fmtFecha(r.creado_en)}</span>
        </div>
        <div class="resp-texto-p" id="rtexto-${r.id}" style="white-space:pre-wrap">${r.contenido || ''}</div>
        ${esMio ? `<div class="resp-acciones-p">
          ${puedoEditar ? `<button class="btn-accion-p" onclick="editarResp(${r.id},${hiloId})">✏️ Editar</button>` : ''}
          <button class="btn-accion-p del" onclick="eliminarResp(${r.id},${hiloId})">🗑 Eliminar</button>
        </div>` : ''}
      </div>
    </div>`;
  }).join('');
}

// ── Publicar respuesta ────────────────────────────────────
window.publicarRespuesta = async hiloId => {
  const txt = (el('txtRespuesta')?.value || '').trim();
  if (!txt) { alert('Escribe tu respuesta primero.'); return; }

  try {
    const json = await apiForoPost('crear_respuesta', { hilo_id: hiloId, texto: txt });
    if (!json.ok) throw new Error(json.error);
    el('txtRespuesta').value = '';
    const h = hilos.find(x => x.id == hiloId);
    if (h) h.respuestas = (h.respuestas || 0) + 1;
    await cargarRespuestas(hiloId);
  } catch (e) { console.error(e); alert('Error al publicar.'); }
};

// ── Editar respuesta ──────────────────────────────────────
window.editarResp = (respId, hiloId) => {
  const textoEl = el(`rtexto-${respId}`);
  if (!textoEl) return;
  const textoActual = textoEl.textContent;
  textoEl.innerHTML = `
    <textarea style="width:100%;min-height:65px;border:1.5px solid var(--verde,#1a6b3c);border-radius:8px;padding:.45rem;font-size:.85rem;font-family:inherit;box-sizing:border-box"
      id="edit-${respId}">${textoActual}</textarea>
    <div style="display:flex;gap:.4rem;margin-top:.35rem;justify-content:flex-end">
      <button onclick="cancelarEdicion(${respId},'${textoActual.replace(/'/g, "\\'")}')" class="btn btn-secundario btn-sm">Cancelar</button>
      <button onclick="guardarEdicion(${respId},${hiloId})" class="btn btn-primary btn-sm">Guardar</button>
    </div>`;
};

window.cancelarEdicion = (respId, original) => {
  const e = el(`rtexto-${respId}`);
  if (e) { e.style.whiteSpace = 'pre-wrap'; e.textContent = original; }
};

window.guardarEdicion = async (respId, hiloId) => {
  const nuevo = (el(`edit-${respId}`)?.value || '').trim();
  if (!nuevo) { alert('El texto no puede estar vacío.'); return; }
  try {
    const json = await apiForoPost('editar_respuesta', { resp_id: respId, texto: nuevo });
    if (!json.ok) throw new Error(json.error);
    await cargarRespuestas(hiloId);
    mostrarOk('✓ Respuesta editada.');
  } catch (e) { alert(e.message || 'Error al editar.'); }
};

// ── Eliminar respuesta ────────────────────────────────────
window.eliminarResp = async (respId, hiloId) => {
  if (!confirm('¿Eliminar esta respuesta?')) return;
  try {
    const json = await apiForoPost('eliminar_respuesta', { resp_id: respId, hilo_id: hiloId });
    if (!json.ok) throw new Error(json.error);
    el(`resp-${respId}`)?.remove();
    const h = hilos.find(x => x.id == hiloId);
    if (h) h.respuestas = Math.max(0, (h.respuestas || 0) - 1);
    mostrarOk('✓ Respuesta eliminada.');
  } catch (e) { console.error(e); mostrarError('Error al eliminar.'); }
};

// ── Modal nueva pregunta ──────────────────────────────────
el('btnNuevaPregunta')?.addEventListener('click', () => {
  el('fForoTitulo').value = '';
  el('fForoCuerpo').value = '';
  el('modalPregunta').classList.add('visible');
});
el('btnCancelarPregunta')?.addEventListener('click', () => el('modalPregunta').classList.remove('visible'));
el('modalPregunta')?.addEventListener('click', e => {
  if (e.target === el('modalPregunta')) el('modalPregunta').classList.remove('visible');
});

el('btnPublicarPregunta')?.addEventListener('click', async () => {
  const titulo = (el('fForoTitulo').value || '').trim();
  const cuerpo = (el('fForoCuerpo').value || '').trim();
  if (!titulo) { alert('El título es obligatorio.'); return; }

  const btn = el('btnPublicarPregunta');
  btn.disabled = true;
  const textoOriginal = btn.textContent;
  btn.textContent = 'Publicando…';

  try {
    const json = await apiForoPost('crear_hilo', { titulo, cuerpo });
    if (!json.ok) throw new Error(json.error);
    el('modalPregunta').classList.remove('visible');
    mostrarOk('✓ Pregunta publicada.');
    await cargarHilos();
  } catch (e) {
    console.error(e);
    mostrarError('Error al publicar.');
  } finally {
    btn.disabled = false;
    btn.textContent = textoOriginal;
  }
});

// ── Cerrar modal hilo ─────────────────────────────────────
el('btnCerrarHilo')?.addEventListener('click', () => el('modalHilo').classList.remove('visible'));
el('modalHilo')?.addEventListener('click', e => {
  if (e.target === el('modalHilo')) el('modalHilo').classList.remove('visible');
});

// ── Mensajes ──────────────────────────────────────────────
function mostrarOk(m) {
  el('textoOk').textContent = m;
  el('msgOk').classList.add('visible');
  el('msgError').classList.remove('visible');
  setTimeout(() => el('msgOk').classList.remove('visible'), 4000);
}
function mostrarError(m) {
  el('textoError').textContent = m;
  el('msgError').classList.add('visible');
}

// ── Arrancar ──────────────────────────────────────────────
async function init() {
  const token = await getToken();
  if (!token) { mostrarError('Error de autenticación.'); return; }
  await cargarVendedor();
  await cargarHilos();
}

init();