// ── Token CSRF ────────────────────────────────────────────
let _token = null;

async function getToken() {
  if (_token) return _token;
  try {
    const resp = await fetch('../backend/tokens.php?accion=obtener', { credentials: 'include' });
    const data = await resp.json();
    _token = data.token || '';
  } catch { _token = ''; }
  return _token;
}

async function apiGet(endpoint) {
  const token = await getToken();
  const resp = await fetch(`../backend/${endpoint}&token=${token}`, { credentials: 'include' });
  const data = await resp.json();
  if (!data.ok) throw new Error(data.error || 'Error');
  return data.datos;
}

async function apiPost(endpoint, body) {
  const token = await getToken();
  const form = new URLSearchParams({ ...body, token });
  const resp = await fetch(`../backend/${endpoint}`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: form
  });
  const data = await resp.json();
  if (!data.ok) throw new Error(data.error || 'Error');
  return data.datos;
}

// ── Estado ────────────────────────────────────────────────
let plantillas = [];
let editandoId = null;

const catLabel = { promo: 'Promocional', transaccional: 'Transaccional', informativo: 'Informativo' };
const catBadge = { promo: 'badge-promo', transaccional: 'badge-activo', informativo: 'badge-borrador' };

// ── Render #gridPlantillas ────────────────────────────────
// Campos que devuelve plantillas.php accion=listar:
// id, nombre, canal, categoria, asunto, cuerpo, usos, fecha
function renderGrid(lista) {
  document.getElementById('statTotal').textContent = plantillas.length;

  const grid = document.getElementById('gridPlantillas');
  if (!lista.length) {
    grid.innerHTML = '<p class="cargando-txt" style="grid-column:1/-1">No se encontraron plantillas</p>';
    return;
  }
  grid.innerHTML = lista.map(p => `
    <div class="plantilla-card">
      <div class="plantilla-preview">${p.cuerpo.substring(0, 220)}${p.cuerpo.length > 220 ? '…' : ''}</div>
      <div class="plantilla-footer">
        <div>
          <div class="plantilla-nombre">${p.nombre}</div>
          <div class="plantilla-meta">
            <span class="badge ${catBadge[p.categoria] || ''}">${catLabel[p.categoria] || p.categoria}</span>
            &nbsp;· Usado ${p.usos}x · ${p.fecha}
          </div>
        </div>
        <div style="display:flex;gap:.4rem;flex-wrap:wrap">
          <button class="btn btn-secundario btn-sm" onclick="editarPlantilla(${p.id})">Editar</button>
          <button class="btn btn-primary btn-sm" onclick="usarPlantilla(${p.id})">Usar</button>
          <button class="btn btn-peligro btn-sm" onclick="eliminarPlantilla(${p.id})">✕</button>
        </div>
      </div>
    </div>
  `).join('');
}

// ── Cargar desde plantillas.php (solo canal=correo) ────────
async function cargarPlantillas() {
  const cat = document.getElementById('filtroCategoria').value;
  let url = 'plantillas.php?accion=listar&canal=correo';
  if (cat) url += `&categoria=${encodeURIComponent(cat)}`;
  try {
    plantillas = await apiGet(url);
    filtrarPlantillas();
  } catch (err) { console.error('Error al cargar plantillas:', err); }
}

function filtrarPlantillas() {
  const q   = document.getElementById('buscarPlantilla').value.toLowerCase();
  const cat = document.getElementById('filtroCategoria').value;
  renderGrid(plantillas.filter(p =>
    (!q   || p.nombre.toLowerCase().includes(q) || p.cuerpo.toLowerCase().includes(q)) &&
    (!cat || p.categoria === cat)
  ));
}

// ── Modal editor: #modalEditor ────────────────────────────
// IDs internos: modalTitulo, edNombre, edAsunto, edCuerpo (contenteditable), edCategoria, modalMsgOk
function abrirEditorNueva() {
  editandoId = null;
  document.getElementById('modalTitulo').textContent  = 'Nueva plantilla';
  document.getElementById('edNombre').value           = '';
  document.getElementById('edAsunto').value           = '';
  document.getElementById('edCuerpo').innerText       = '';
  document.getElementById('edCategoria').value        = 'promo';
  document.getElementById('modalMsgOk').classList.remove('visible');
  document.getElementById('modalEditor').style.display = 'block';
}

function editarPlantilla(id) {
  const p = plantillas.find(x => x.id == id);
  if (!p) return;
  editandoId = id;
  document.getElementById('modalTitulo').textContent  = 'Editar plantilla';
  document.getElementById('edNombre').value           = p.nombre;
  document.getElementById('edAsunto').value           = p.asunto || '';
  document.getElementById('edCuerpo').innerText       = p.cuerpo;
  document.getElementById('edCategoria').value        = p.categoria;
  document.getElementById('modalMsgOk').classList.remove('visible');
  document.getElementById('modalEditor').style.display = 'block';
}

async function guardarPlantilla() {
  const nombre    = document.getElementById('edNombre').value.trim();
  const asunto    = document.getElementById('edAsunto').value.trim();
  const cuerpo    = document.getElementById('edCuerpo').innerText.trim();
  const categoria = document.getElementById('edCategoria').value;

  if (!nombre || !asunto || !cuerpo) { alert('Completa todos los campos'); return; }

  try {
    await apiPost('plantillas.php?accion=guardar', {
      id: editandoId || 0, nombre, canal: 'correo', categoria, asunto, cuerpo
    });
    document.getElementById('modalMsgOk').classList.add('visible');
    await cargarPlantillas();
    setTimeout(cerrarModal, 1200);
  } catch (err) { alert('Error: ' + err.message); }
}

async function eliminarPlantilla(id) {
  if (!confirm('¿Eliminar esta plantilla?')) return;
  try {
    await apiPost('plantillas.php?accion=eliminar', { id });
    await cargarPlantillas();
  } catch (err) { console.error('Error al eliminar:', err); }
}

function usarPlantilla(id) {
  const p = plantillas.find(x => x.id == id);
  if (!p) return;
  sessionStorage.setItem('plantillaActiva', JSON.stringify(p));
  window.location.href = 'redactar.html';
}

// "Usar y enviar" desde el modal (antes de guardar)
function usarPlantillaYRedirigir() {
  const nombre  = document.getElementById('edNombre').value.trim();
  const asunto  = document.getElementById('edAsunto').value.trim();
  const cuerpo  = document.getElementById('edCuerpo').innerText.trim();
  if (!asunto || !cuerpo) { alert('Completa asunto y mensaje'); return; }
  sessionStorage.setItem('plantillaActiva', JSON.stringify({ nombre, asunto, cuerpo }));
  window.location.href = 'redactar.html';
}

function cerrarModal() {
  document.getElementById('modalEditor').style.display = 'none';
}

// Insertar variable en #edCuerpo (contenteditable)
function insertarVarEd(v) {
  document.getElementById('edCuerpo').focus();
  document.execCommand('insertText', false, v);
}

// ── Init ──────────────────────────────────────────────────
cargarPlantillas();

document.addEventListener('keydown', e => { if (e.key === 'Escape') cerrarModal(); });

document.addEventListener('DOMContentLoaded', () => {
  const b = document.getElementById('btnHamburguesa');
  const s = document.querySelector('.sidebar');
  const o = document.getElementById('sidebarOverlay');
  if (b && s && o) {
    b.addEventListener('click', () => { s.classList.toggle('abierto'); o.classList.toggle('visible'); });
    o.addEventListener('click', () => { s.classList.remove('abierto'); o.classList.remove('visible'); });
  }
});