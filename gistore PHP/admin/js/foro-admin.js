// ============================================================
//  admin/js/foro-admin.js — Moderación del foro
// ============================================================

// ── Token CSRF ────────────────────────────────────────────
let _token = null;

async function getToken() {
  if (_token) return _token;
  try {
    const resp = await fetch('/../backend/tokens.php?accion=obtener', { credentials: 'include' });
    const data = await resp.json();
    _token = data.token || '';
  } catch { _token = ''; }
  return _token;
}

// ── Fetch GET ─────────────────────────────────────────────
async function foroGet(accion, params = {}) {
  const token = await getToken();
  const query = new URLSearchParams({ accion, token, ...params });
  const resp  = await fetch(`../backend/foro.php?${query}`, { credentials: 'include' });
  const data  = await resp.json();
  if (!data.ok) throw new Error(data.error || 'Error');
  return data.datos;
}

// ── Fetch POST ────────────────────────────────────────────
async function foroPost(accion, params = {}) {
  const token = await getToken();
  const body  = new URLSearchParams({ accion, token, ...params });
  const resp  = await fetch('../backend/foro.php', {
    method: 'POST', credentials: 'include',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });
  const data = await resp.json();
  if (!data.ok) throw new Error(data.error || 'Error');
  return data.datos;
}

// ── Funciones del foro ────────────────────────────────────
const obtenerTodosHilosForo    = ()                 => foroGet('obtener_hilos');
const obtenerRespuestasPorHilo = (hilo_id)          => foroGet('obtener_respuestas', { hilo_id });
const eliminarHiloForo         = (hilo_id)          => foroPost('eliminar_hilo',      { hilo_id });   // ✅ POST
const eliminarRespuestaForo    = (resp_id, hilo_id) => foroPost('eliminar_respuesta', { resp_id, hilo_id }); // ✅ POST

// ── Helpers UI ────────────────────────────────────────────
const el = id => document.getElementById(id);

function fechaHoy() {
  return new Date().toLocaleDateString('es-CO', { weekday:'long', day:'numeric', month:'long', year:'numeric' });
}
function fmtFecha(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('es-CO', { day:'numeric', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' });
}

el('fechaHoy').textContent = fechaHoy();

el('btnSalir').addEventListener('click', () => {
  window.location.href = '../index.html';
});

// ── Modal confirmación ────────────────────────────────────
function confirmar({ icono='🗑', titulo='¿Confirmar?', msg='', btnOk='Eliminar' } = {}) {
  return new Promise(resolve => {
    el('modalConfirmIcono').textContent  = icono;
    el('modalConfirmTitulo').textContent = titulo;
    el('modalConfirmMsg').textContent    = msg;
    el('btnModalOk').textContent         = btnOk;
    el('modalConfirm').classList.add('visible');
    const cerrar = ok => { el('modalConfirm').classList.remove('visible'); resolve(ok); };
    el('btnModalOk').addEventListener('click',       () => cerrar(true),  { once: true });
    el('btnModalCancelar').addEventListener('click',  () => cerrar(false), { once: true });
    el('modalConfirm').addEventListener('click', e => {
      if (e.target === el('modalConfirm')) cerrar(false);
    }, { once: true });
  });
}

// ── Cargar hilos ──────────────────────────────────────────
let hilos = [];

async function cargar() {
  el('foroAdminLista').innerHTML = '<p class="cargando-txt">Cargando…</p>';
  try {
    const raw = await obtenerTodosHilosForo();
    hilos = (raw || []).map(h => ({
      ...h,
      cuerpo:       h.cuerpo       || h.contenido      || '',
      autor_nombre: h.autor_nombre || h.vendedor_nombre || 'Vendedor',
      autor_foto:   h.autor_foto   || h.vendedor_perfil || '',
      autor_color:  h.autor_color  || '#1a6b3c',
    }));
    renderHilos();
  } catch (e) {
    console.error(e);
    el('foroAdminLista').innerHTML = '<p class="vacio-txt">Error al cargar el foro.</p>';
  }
}

function renderHilos() {
  if (!hilos.length) { el('foroAdminLista').innerHTML = '<p class="vacio-txt">No hay hilos aún.</p>'; return; }
  el('foroAdminLista').innerHTML = hilos.map(h => `
    <div class="hilo-admin" id="hilo-${h.id}">
      <div class="hilo-admin-header" onclick="toggleHilo('${h.id}')">
        <div class="hilo-avatar-sm" style="background:${h.autor_color}">
          ${h.autor_foto ? `<img src="${h.autor_foto}" onerror="this.style.display='none'">` : (h.autor_nombre||'?')[0].toUpperCase()}
        </div>
        <div class="hilo-admin-meta">
          <div class="hilo-admin-titulo">${h.titulo||'(sin título)'}</div>
          <div class="hilo-admin-info">
            <span>👤 ${h.autor_nombre}</span>
            <span>🕐 ${fmtFecha(h.creado_en)}</span>
            <span>💬 ${h.respuestas||0} respuesta${(h.respuestas||0)!==1?'s':''}</span>
          </div>
        </div>
        <button class="btn-elim-foro" onclick="event.stopPropagation();eliminarHilo('${h.id}')">🗑 Eliminar hilo</button>
      </div>
      <div class="hilo-admin-body" id="body-${h.id}">
        ${h.cuerpo ? `<p style="font-size:.85rem;color:var(--gris-700);margin-bottom:1rem;line-height:1.5;white-space:pre-wrap">${h.cuerpo}</p>` : ''}
        <div id="resps-${h.id}"><p style="font-size:.8rem;color:var(--texto-suave)">Haz clic para cargar respuestas…</p></div>
      </div>
    </div>`).join('');
}

// ── Toggle ────────────────────────────────────────────────
const _cargados = {};
window.toggleHilo = async hiloId => {
  const body = el(`body-${hiloId}`);
  if (!body) return;
  const abierto = body.classList.toggle('open');
  if (abierto && !_cargados[hiloId]) { _cargados[hiloId] = true; await cargarRespuestas(hiloId); }
};

async function cargarRespuestas(hiloId) {
  const cont = el(`resps-${hiloId}`);
  if (!cont) return;
  cont.innerHTML = '<p style="font-size:.8rem;color:var(--texto-suave)">Cargando…</p>';
  try {
    const resps = await obtenerRespuestasPorHilo(hiloId);
    if (!resps.length) { cont.innerHTML = '<p style="font-size:.8rem;color:var(--texto-suave);padding:.5rem 0">Sin respuestas.</p>'; return; }
    cont.innerHTML = resps.map(r => {
      const nombre = r.autor_nombre || r.vendedor_nombre || 'Vendedor';
      const foto   = r.autor_foto   || r.vendedor_perfil  || '';
      const color  = r.autor_color  || '#1a6b3c';
      const texto  = r.texto        || r.contenido        || '';
      return `
      <div class="resp-admin" id="resp-${r.id}">
        <div class="hilo-avatar-sm" style="background:${color};width:28px;height:28px;font-size:.75rem">
          ${foto ? `<img src="${foto}" onerror="this.style.display='none'">` : nombre[0].toUpperCase()}
        </div>
        <div class="resp-admin-body">
          <div style="display:flex;align-items:center;gap:.5rem;flex-wrap:wrap">
            <span class="resp-admin-autor">${nombre}</span>
            <span style="font-size:.7rem;color:var(--texto-suave)">${fmtFecha(r.creado_en)}</span>
          </div>
          <div class="resp-admin-texto" style="white-space:pre-wrap">${texto}</div>
        </div>
        <button class="btn-elim-foro" onclick="eliminarResp('${r.id}','${hiloId}')">🗑</button>
      </div>`;
    }).join('');
  } catch (e) { console.error(e); cont.innerHTML = '<p style="font-size:.8rem;color:var(--error)">Error al cargar respuestas.</p>'; }
}

// ── Eliminar hilo ─────────────────────────────────────────
window.eliminarHilo = async hiloId => {
  // ✅ Variable renombrada a 'hilo' (antes era 'h' pero se usaba 'hilo' en el mensaje)
  const hilo = hilos.find(x => String(x.id) === String(hiloId));
  if (!await confirmar({
    icono:'⚠️', titulo:'¿Eliminar hilo?',
    msg:`Se eliminará "${hilo?.titulo || 'este hilo'}" y TODAS sus respuestas.`,
    btnOk:'Sí, eliminar'
  })) return;
  try {
    await eliminarHiloForo(hiloId);
    el(`hilo-${hiloId}`)?.remove();
    // ✅ String() en ambos lados para comparar correctamente
    hilos = hilos.filter(x => String(x.id) !== String(hiloId));
    mostrarOk('✓ Hilo eliminado.');
  } catch (e) { console.error(e); mostrarError('Error al eliminar el hilo.'); }
};

// ── Eliminar respuesta ────────────────────────────────────
window.eliminarResp = async (respId, hiloId) => {
  if (!await confirmar({
    icono:'🗑', titulo:'¿Eliminar respuesta?',
    msg:'Esta respuesta será eliminada permanentemente.',
    btnOk:'Sí, eliminar'
  })) return;
  try {
    await eliminarRespuestaForo(respId, hiloId);
    el(`resp-${respId}`)?.remove();
    // ✅ String() en ambos lados para comparar correctamente
    const h = hilos.find(x => String(x.id) === String(hiloId));
    if (h) h.respuestas = Math.max(0, (h.respuestas || 0) - 1);
    const infoEl = document.querySelector(`#hilo-${hiloId} .hilo-admin-info span:nth-child(3)`);
    if (infoEl && h) infoEl.textContent = `💬 ${h.respuestas} respuesta${h.respuestas !== 1 ? 's' : ''}`;
    mostrarOk('✓ Respuesta eliminada.');
  } catch (e) { console.error(e); mostrarError('Error al eliminar respuesta.'); }
};

// ── Mensajes ──────────────────────────────────────────────
function mostrarOk(m) {
  el('textoOk').textContent = m; el('msgOk').classList.add('visible');
  el('msgError').classList.remove('visible');
  setTimeout(() => el('msgOk').classList.remove('visible'), 4000);
}
function mostrarError(m) { el('textoError').textContent = m; el('msgError').classList.add('visible'); }

cargar();