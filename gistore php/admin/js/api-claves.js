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

// ── Init ──────────────────────────────────────────────────
el('fechaHoy').textContent = fechaHoy();
el('btnSalir').addEventListener('click', async () => {
  const resp = await fetch('../../backend/cerrar.php', { credentials: 'include' });
  const data = await resp.json();
  if (data.ok) window.location.href = '../../index.html';
});

// ── Estado global ─────────────────────────────────────────
let claves     = [];
let eliminarId = null;

// ── Toggle ver/ocultar clave ──────────────────────────────
el('btnVerClave').addEventListener('click', () => {
  const inp = el('fClave');
  if (inp.type === 'password') { inp.type = 'text';     el('btnVerClave').textContent = '🙈'; }
  else                          { inp.type = 'password'; el('btnVerClave').textContent = '👁'; }
});

// ── Cargar claves ─────────────────────────────────────────
async function cargarClaves() {
  el('clavesLista').innerHTML = '<p class="cargando-txt">Cargando…</p>';
  try {
    claves = await apiGet('api-claves.php?accion=obtener');
    // Parsear modelos: vienen como JSON string desde MySQL
    claves = claves.map(c => ({
      ...c,
      activo: !!Number(c.activo),
      modelos: (() => {
        if (!c.modelos) return [];
        try { return JSON.parse(c.modelos); } catch { return c.modelos.split('\n').filter(Boolean); }
      })(),
    }));
    renderClaves();
  } catch (e) {
    console.error(e);
    el('clavesLista').innerHTML = '<p class="vacio-txt">Error al cargar.</p>';
  }
}

function renderClaves() {
  if (!claves.length) {
    el('clavesLista').innerHTML =
      '<p class="vacio-txt">Sin claves registradas. Crea la primera con el botón de arriba.</p>';
    return;
  }

  el('clavesLista').innerHTML = `
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
              <td><code style="font-size:.78rem">${c.servicio || ''}</code></td>
              <td style="font-weight:600;font-size:.85rem">${c.nombre || ''}</td>
              <td style="font-size:.78rem;color:var(--texto-suave);max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${c.origen_url||''}">${c.origen_url||'—'}</td>
              <td>
                <div class="clave-wrap">
                  <span class="clave-texto" id="ctexto-${c.id}">••••••••••••</span>
                  <button class="btn-eye" title="Revelar" onclick="toggleClave('${c.id}','${(c.clave||'').replace(/'/g,"\\'")}')">👁</button>
                </div>
              </td>
              <td>
                <div class="modelos-list">
                  ${modelos.length
                    ? modelos.map(m => `<span class="modelo-chip">${m}</span>`).join('')
                    : `<span style="font-size:.75rem;color:var(--texto-suave)">—</span>`}
                </div>
              </td>
              <td>
                <span class="badge ${c.activo ? 'badge-on' : 'badge-off'}">
                  ${c.activo ? '✅ Activa' : '⏸ Inactiva'}
                </span>
              </td>
              <td>
                <div style="display:flex;gap:.4rem;flex-wrap:wrap">
                  <button class="btn-tabla btn-editar"   onclick="editarClave('${c.id}')">✏️</button>
                  <button class="btn-tabla btn-eliminar" onclick="pedirEliminar('${c.id}')">🗑</button>
                </div>
              </td>
            </tr>`;
          }).join('')}
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
  span.textContent = _reveladoState[id] ? clave : '••••••••••••';
};

// ── Abrir modal ───────────────────────────────────────────
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
  // Modelos como JSON array
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

    if (id) {
      await apiPost('api-claves.php?accion=actualizar', { id, ...params });
    } else {
      await apiPost('api-claves.php?accion=crear', params);
    }
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