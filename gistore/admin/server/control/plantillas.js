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

const catBadge = { promo: 'badge-promo', transaccional: 'badge-activo', informativo: 'badge-borrador' };
const catLabel = { promo: 'Promocional', transaccional: 'Transaccional', informativo: 'Informativo' };
const canalBadge = { correo: 'badge-enviado', whatsapp: 'badge-wa' };

// ── Render #grid ──────────────────────────────────────────
// Campos que devuelve plantillas.php accion=listar:
// id, nombre, canal, categoria, asunto, cuerpo, usos, fecha
function render(lista) {
  // Stats: #statTotal, #statCorreo, #statWA
  document.getElementById('statTotal').textContent  = plantillas.length;
  document.getElementById('statCorreo').textContent = plantillas.filter(p => p.canal === 'correo').length;
  document.getElementById('statWA').textContent     = plantillas.filter(p => p.canal === 'whatsapp').length;

  const g = document.getElementById('grid');
  if (!lista.length) {
    g.innerHTML = '<p class="cargando-txt" style="grid-column:1/-1">No se encontraron plantillas</p>';
    return;
  }
  g.innerHTML = lista.map(p => `
    <div class="card">
      <div class="card-preview">${p.cuerpo.substring(0, 200)}${p.cuerpo.length > 200 ? '…' : ''}</div>
      <div class="card-footer">
        <div>
          <div class="card-nombre">${p.nombre}</div>
          <div class="card-meta">
            <span class="badge ${canalBadge[p.canal] || ''}">${p.canal}</span>
            <span class="badge ${catBadge[p.categoria] || ''}">${catLabel[p.categoria] || p.categoria}</span>
            · ${p.usos} usos · ${p.fecha}
          </div>
        </div>
        <div style="display:flex;gap:.4rem;flex-wrap:wrap;margin-top:.4rem">
          <button class="btn btn-secundario btn-sm" onclick="editar(${p.id})">Editar</button>
          <button class="btn btn-primary btn-sm" onclick="usar(${p.id})">Usar</button>
          <button class="btn btn-peligro btn-sm" onclick="eliminar(${p.id})">✕</button>
        </div>
      </div>
    </div>`).join('');
}

// ── Cargar desde plantillas.php?accion=listar ─────────────
async function cargarPlantillas() {
  const canal = document.getElementById('filtroCanal').value;
  const cat   = document.getElementById('filtroCat').value;

  let url = 'plantillas.php?accion=listar';
  if (canal) url += `&canal=${encodeURIComponent(canal)}`;
  if (cat)   url += `&categoria=${encodeURIComponent(cat)}`;

  try {
    plantillas = await apiGet(url);
    filtrar(); // aplica búsqueda local sobre los datos recibidos
  } catch (err) { console.error('Error al cargar plantillas:', err); }
}

// filtrar() — búsqueda local sin re-consultar al servidor
function filtrar() {
  const q     = document.getElementById('buscar').value.toLowerCase();
  const canal = document.getElementById('filtroCanal').value;
  const cat   = document.getElementById('filtroCat').value;

  // Si canal o cat cambian, hay que ir al backend (tienen filtros en el PHP)
  // Si solo cambia el texto de búsqueda, filtramos en local
  render(plantillas.filter(p =>
    (!q    || p.nombre.toLowerCase().includes(q) || p.cuerpo.toLowerCase().includes(q)) &&
    (!canal || p.canal === canal) &&
    (!cat   || p.categoria === cat)
  ));
}

// ── Abrir modal nueva ─────────────────────────────────────
function abrirNueva() {
  editandoId = null;
  document.getElementById('modalTitulo').textContent = 'Nueva plantilla';
  document.getElementById('edNombre').value = '';
  document.getElementById('edAsunto').value = '';
  document.getElementById('edCuerpo').value = '';
  document.getElementById('edCanal').value  = 'correo';
  document.getElementById('edCat').value    = 'transaccional';
  document.getElementById('modalOk').classList.remove('visible');
  document.getElementById('modalEd').style.display = 'block';
}

// ── Abrir modal editar ────────────────────────────────────
function editar(id) {
  const p = plantillas.find(x => x.id == id);
  if (!p) return;
  editandoId = id;
  document.getElementById('modalTitulo').textContent = 'Editar plantilla';
  document.getElementById('edNombre').value = p.nombre;
  document.getElementById('edAsunto').value = p.asunto || '';
  document.getElementById('edCuerpo').value = p.cuerpo;
  document.getElementById('edCanal').value  = p.canal;
  document.getElementById('edCat').value    = p.categoria;
  document.getElementById('modalOk').classList.remove('visible');
  document.getElementById('modalEd').style.display = 'block';
}

// ── Guardar (crear o actualizar) ──────────────────────────
async function guardar() {
  const nombre    = document.getElementById('edNombre').value.trim();
  const cuerpo    = document.getElementById('edCuerpo').value.trim();
  const asunto    = document.getElementById('edAsunto').value.trim();
  const canal     = document.getElementById('edCanal').value;
  const categoria = document.getElementById('edCat').value;   // PHP lo recibe como 'categoria'

  if (!nombre || !cuerpo) { alert('Completa nombre y cuerpo'); return; }

  try {
    await apiPost('plantillas.php?accion=guardar', {
      id: editandoId || 0, nombre, canal, categoria, asunto, cuerpo
    });
    document.getElementById('modalOk').classList.add('visible');
    await cargarPlantillas();
    setTimeout(cerrarModal, 1000);
  } catch (err) { alert('Error: ' + err.message); }
}

// ── Eliminar (soft: activo = 0 en el PHP) ─────────────────
async function eliminar(id) {
  if (!confirm('¿Eliminar esta plantilla?')) return;
  try {
    await apiPost('plantillas.php?accion=eliminar', { id });
    await cargarPlantillas();
  } catch (err) { console.error('Error al eliminar:', err); }
}

// ── Usar → redirigir a redactar.html o whatsapp-masivo.html
function usar(id) {
  const p = plantillas.find(x => x.id == id);
  if (!p) return;
  sessionStorage.setItem('plantillaActiva', JSON.stringify(p));
  window.location.href = p.canal === 'whatsapp' ? 'whatsapp-masivo.html' : 'redactar.html';
}

function cerrarModal() {
  document.getElementById('modalEd').style.display = 'none';
}

// Insertar variable en #edCuerpo (textarea)
function insertarVar(v) {
  const ta = document.getElementById('edCuerpo');
  const s  = ta.selectionStart;
  ta.value = ta.value.substring(0, s) + v + ta.value.substring(ta.selectionEnd);
  ta.selectionStart = ta.selectionEnd = s + v.length;
  ta.focus();
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