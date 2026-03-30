// ============================================================
//  admin/js/api-claves.js — Gestión de claves API (PHP + MySQL)
// ============================================================

// ── Token CSRF ────────────────────────────────────────────
let _token = null;

async function getToken() {
  if (_token) return _token;
  try {
    const resp = await fetch('/../../backend/tokens.php?accion=obtener', { credentials: 'include' });
    const data = await resp.json();
    _token = data.token || '';
  } catch { _token = ''; }
  return _token;
}

async function apiGet(endpoint) {
  const token = await getToken();
  const resp  = await fetch(`../backend/${endpoint}&token=${token}`, { credentials: 'include' });
  const data  = await resp.json();
  if (!data.ok) throw new Error(data.error || 'Error');
  return data.datos;
}

async function apiPost(endpoint, params = {}) {
  const token = await getToken();
  const body  = new URLSearchParams({ ...params, token });
  const resp  = await fetch(`../backend/${endpoint}`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });
  const data = await resp.json();
  if (!data.ok) throw new Error(data.error || 'Error');
  return data.datos;
}

// ── Helpers UI ────────────────────────────────────────────
function fechaHoy() {
  return new Date().toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric' });
}
function btnCargando(btn, cargando) {
  btn.disabled = cargando;
  btn.classList.toggle('cargando', cargando);
}
const el = id => document.getElementById(id);

// ── Icono por servicio ────────────────────────────────────
function iconoServicio(servicio = '') {
  const s = servicio.toLowerCase();
  if (s.includes('openai') || s.includes('gpt'))     return '🤖';
  if (s.includes('openrouter'))                       return '🔀';
  if (s.includes('google') || s.includes('gemini'))  return '✨';
  if (s.includes('anthropic') || s.includes('claude'))return '🧠';
  if (s.includes('stripe'))                          return '💳';
  if (s.includes('meta') || s.includes('llama'))     return '🦙';
  if (s.includes('mistral'))                         return '🌊';
  if (s.includes('cohere'))                          return '🔗';
  if (s.includes('wp') || s.includes('wordpress'))   return '📝';
  return '🔑';
}

// ── Init ──────────────────────────────────────────────────
el('fechaHoy').textContent = fechaHoy();
el('btnSalir').addEventListener('click', async () => {
  const resp = await fetch('../../backend/cerrar.php', { credentials: 'include' });
  const data = await resp.json();
  if (data.ok) window.location.href = '../../index.html';
});

// ── Estado global ─────────────────────────────────────────
let claves        = [];
let eliminarId    = null;
let _claveRevelada = false;

// ── Toggle ver/ocultar clave (modal editar) ───────────────
el('btnVerClave').addEventListener('click', () => {
  const inp = el('fClave');
  if (inp.type === 'password') { inp.type = 'text';     el('btnVerClave').textContent = '🙈'; }
  else                          { inp.type = 'password'; el('btnVerClave').textContent = '👁'; }
});

// ── Cargar claves ─────────────────────────────────────────
async function cargarClaves() {
  const lista = el('clavesLista');
  lista.innerHTML = '<p class="cargando-txt" style="grid-column:1/-1">Cargando…</p>';
  try {
    claves = await apiGet('api-claves.php?accion=obtener');
    claves = claves.map(c => ({
      ...c,
      activo: !!Number(c.activo),
      modelos: (() => {
        if (!c.modelos) return [];
        try { return JSON.parse(c.modelos); } catch { return c.modelos.split('\n').filter(Boolean); }
      })(),
    }));
    renderCards();
  } catch (e) {
    console.error(e);
    lista.innerHTML = '<p class="vacio-txt" style="grid-column:1/-1">Error al cargar.</p>';
  }
}

// ── Render grid de cards ──────────────────────────────────
function renderCards() {
  const lista = el('clavesLista');

  const cardsHTML = claves.map(c => `
    <div class="api-card" onclick="abrirDetalle('${c.id}')" role="button" tabindex="0"
         onkeydown="if(event.key==='Enter')abrirDetalle('${c.id}')">
      <div class="api-card-icon">${iconoServicio(c.servicio)}</div>
      <div class="api-card-nombre" title="${c.nombre || ''}">${c.nombre || c.servicio}</div>
      <div class="api-card-servicio">${c.servicio || ''}</div>
      <div class="api-card-footer">
        <span class="badge ${c.activo ? 'badge-on' : 'badge-off'}" style="font-size:.72rem;padding:.15rem .5rem;border-radius:20px">
          ${c.activo ? '● Activa' : '● Inactiva'}
        </span>
        <button class="api-card-btn-editar"
                onclick="event.stopPropagation(); editarClave('${c.id}')"
                title="Editar esta clave">
          <span class="material-symbols-outlined" style="font-size:.85rem">edit</span> Editar
        </button>
      </div>
    </div>
  `).join('');


  lista.innerHTML = cardsHTML;
}

// ── Modal detalle ─────────────────────────────────────────
window.abrirDetalle = (id) => {
  const c = claves.find(x => String(x.id) === String(id));
  if (!c) return;

  el('detalleTituloTxt').textContent = c.nombre || c.servicio;
  el('detalleIcono').textContent     = iconoServicio(c.servicio);
  el('dServicio').textContent        = c.servicio || '';
  el('dUrl').textContent             = c.origen_url || '—';

  // Clave enmascarada
  const claveReal = c.clave || '';
  const spanClave = el('dClave');
  spanClave.textContent = '••••••••••••';
  spanClave.dataset.val = claveReal;
  _claveRevelada = false;
  el('dBtnVerClave').textContent = '👁';

  // Estado badge
  el('dEstado').className = `badge ${c.activo ? 'badge-on' : 'badge-off'}`;
  el('dEstado').style.cssText = 'font-size:.75rem;padding:.2rem .6rem;border-radius:20px';
  el('dEstado').textContent = c.activo ? '● Activa' : '● Inactiva';

  // Modelos
  const modelos = Array.isArray(c.modelos) ? c.modelos : [];
  el('dModelos').innerHTML = modelos.length
    ? modelos.map(m => `<span class="modelo-chip">${m}</span>`).join('')
    : '<span style="font-size:.75rem;color:var(--texto-suave)">Sin modelos definidos</span>';

  // Nota
  el('dNota').textContent = c.nota || '—';

  // Botón editar desde detalle
  el('dBtnEditar').onclick = () => {
    el('modalDetalleOverlay').classList.remove('visible');
    editarClave(id);
  };

  el('modalDetalleOverlay').classList.add('visible');
};

// Toggle revelar clave en modal detalle
el('dBtnVerClave').addEventListener('click', () => {
  const span = el('dClave');
  _claveRevelada = !_claveRevelada;
  span.textContent = _claveRevelada ? (span.dataset.val || '') : '••••••••••••';
  el('dBtnVerClave').textContent = _claveRevelada ? '🙈' : '👁';
});

el('dBtnCerrar').addEventListener('click', () => el('modalDetalleOverlay').classList.remove('visible'));
el('modalDetalleOverlay').addEventListener('click', e => {
  if (e.target === el('modalDetalleOverlay')) el('modalDetalleOverlay').classList.remove('visible');
});

// ── Abrir modal editar/crear ───────────────────────────────
el('btnNuevaClave').addEventListener('click', () => abrirModal());

function abrirModal(clave = null) {
  const esEd = !!clave;
  el('modalTitulo').textContent  = esEd ? '✏️ Editar clave API' : '🔑 Nueva clave API';
  el('claveId').value            = clave?.id         || '';
  el('fServicio').value          = clave?.servicio   || '';
  el('fNombre').value            = clave?.nombre     || '';
  el('fOrigenUrl').value         = clave?.origen_url || '';
  el('fClave').value             = '';
  el('fClave').type              = 'password';
  el('btnVerClave').textContent  = '👁';
  const modelos = Array.isArray(clave?.modelos) ? clave.modelos : [];
  el('fModelos').value           = modelos.join('\n');
  el('fNota').value              = clave?.nota       || '';
  el('fActivo').value            = clave?.activo !== false ? 'true' : 'false';
  el('fServicio').readOnly       = esEd;
  el('msgErrorModal').classList.remove('visible');
  el('modalOverlay').classList.add('visible');
}

el('btnCancelar').addEventListener('click', () => el('modalOverlay').classList.remove('visible'));
el('modalOverlay').addEventListener('click', e => {
  if (e.target === el('modalOverlay')) el('modalOverlay').classList.remove('visible');
});

// ── Guardar ───────────────────────────────────────────────
el('btnGuardar').addEventListener('click', async () => {
  const id         = el('claveId').value.trim();
  const servicio   = el('fServicio').value.trim().toLowerCase().replace(/\s+/g, '_');
  const nombre     = el('fNombre').value.trim();
  const origenUrl  = el('fOrigenUrl').value.trim();
  const nuevaClave = el('fClave').value.trim();
  const modelosTxt = el('fModelos').value.trim();
  const nota       = el('fNota').value.trim();
  const activo     = el('fActivo').value === 'true' ? 1 : 0;
  const modelosArr = modelosTxt ? modelosTxt.split('\n').map(m => m.trim()).filter(Boolean) : [];
  const modelos    = JSON.stringify(modelosArr);

  if (!servicio)  { setErr('El identificador del servicio es obligatorio.'); return; }
  if (!nombre)    { setErr('El nombre es obligatorio.'); return; }
  if (!origenUrl) { setErr('La URL de origen es obligatoria.'); return; }
  if (!id && !nuevaClave) { setErr('La clave API es obligatoria para un nuevo servicio.'); return; }
  try { new URL(origenUrl); } catch { setErr('La URL de origen no es válida.'); return; }

  const btn = el('btnGuardar');
  btnCargando(btn, true);
  el('msgErrorModal').classList.remove('visible');

  try {
    const params = { servicio, nombre, origen_url: origenUrl, modelos, nota, activo };
    if (nuevaClave) params.clave = nuevaClave;
    if (id) { await apiPost('api-claves.php?accion=actualizar', { id, ...params }); }
    else    { await apiPost('api-claves.php?accion=crear', params); }
    el('modalOverlay').classList.remove('visible');
    mostrarOk(id ? '✓ Clave actualizada.' : '✓ Clave creada.');
    await cargarClaves();
  } catch (e) {
    console.error(e);
    setErr('Error al guardar: ' + (e.message || 'intenta de nuevo.'));
  } finally { btnCargando(btn, false); }
});

// ── Editar ────────────────────────────────────────────────
window.editarClave = id => {
  const c = claves.find(x => String(x.id) === String(id));
  if (c) abrirModal(c);
};

// ── Eliminar ──────────────────────────────────────────────
window.pedirEliminar = id => {
  eliminarId = id;
  el('modalEliminarOverlay').classList.add('visible');
};
el('btnCancelarEliminar').addEventListener('click', () => {
  eliminarId = null;
  el('modalEliminarOverlay').classList.remove('visible');
});
el('btnConfirmarEliminar').addEventListener('click', async () => {
  if (!eliminarId) return;
  const btn = el('btnConfirmarEliminar');
  btnCargando(btn, true);
  try {
    await apiPost('api-claves.php?accion=eliminar', { id: eliminarId });
    el('modalEliminarOverlay').classList.remove('visible');
    eliminarId = null;
    mostrarOk('✓ Clave eliminada.');
    await cargarClaves();
  } catch (e) {
    console.error(e);
    mostrarError('Error al eliminar.');
  } finally { btnCargando(btn, false); }
});

// ── Mensajes ──────────────────────────────────────────────
function setErr(m) {
  el('textoErrorModal').textContent = m;
  el('msgErrorModal').classList.add('visible');
}
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

cargarClaves();
