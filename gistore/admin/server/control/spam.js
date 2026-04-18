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
let spamCache = [];
let seleccionados = new Set();
let modalId = null;

// ── Render #tbody — spam ──────────────────────────────────
// Campos: id, de_nombre, de_email, asunto, fecha
function render(lista) {
  document.getElementById('statSpam').textContent = spamCache.length;

  const tb = document.getElementById('tbody');
  tb.innerHTML = lista.length
    ? lista.map(s => `
      <tr onclick="verSpam(${s.id})" style="cursor:pointer">
        <td onclick="event.stopPropagation()">
          <input type="checkbox" class="chk" data-id="${s.id}" onchange="toggleSel(${s.id}, this.checked)"/>
        </td>
        <td><strong style="color:var(--error)">${s.de_nombre ? s.de_nombre + ' — ' : ''}${s.de_email}</strong></td>
        <td>${s.asunto}</td>
        <td style="font-size:.78rem;color:var(--texto-suave)">${s.fecha}</td>
        <td onclick="event.stopPropagation()">
          <div class="flex-center">
            <button class="btn btn-secundario btn-sm" onclick="restaurarUno(${s.id})">Restaurar</button>
            <button class="btn btn-peligro btn-sm" onclick="eliminarUno(${s.id})">Eliminar</button>
          </div>
        </td>
      </tr>`).join('')
    : '<tr><td colspan="5" style="text-align:center;padding:2rem;color:var(--texto-suave)">No hay mensajes en spam 🎉</td></tr>';
}

// ── Cargar spam desde correo_recibidos.php?spam=1 ─────────
async function cargarSpam() {
  const q = document.getElementById('buscar').value.trim();
  let url = 'correo_recibidos.php?accion=listar&spam=1';
  if (q) url += `&q=${encodeURIComponent(q)}`;
  try {
    const datos = await apiGet(url);
    spamCache = datos.correos || [];
    render(spamCache);
  } catch (err) { console.error('Error al cargar spam:', err); }
}

function filtrar() { cargarSpam(); }

// ── Ver detalle en #modal ─────────────────────────────────
// Campos de accion=ver: id, de_nombre, de_email, asunto, cuerpo, fecha
async function verSpam(id) {
  try {
    const s = await apiGet(`correo_recibidos.php?accion=ver&id=${id}`);
    modalId = id;
    // IDs del modal en spam.html
    document.getElementById('mAsunto').textContent = s.asunto;
    document.getElementById('mDe').textContent     = `${s.de_nombre || ''} <${s.de_email}>`.trim();
    document.getElementById('mCuerpo').textContent = s.cuerpo;
    document.getElementById('modal').style.display = 'block';
  } catch (err) { console.error('Error al ver spam:', err); }
}

function cerrar() {
  document.getElementById('modal').style.display = 'none';
}

// ── Acciones individuales ─────────────────────────────────
async function restaurarUno(id) {
  try {
    await apiPost('correo_recibidos.php?accion=restaurar', { id });
    spamCache = spamCache.filter(x => x.id != id);
    cerrar();
    render(spamCache);
    mostrarOk('Mensaje movido a la bandeja de entrada.');
  } catch (err) { console.error('Error al restaurar:', err); }
}

async function eliminarUno(id) {
  if (!confirm('¿Eliminar definitivamente este mensaje?')) return;
  try {
    await apiPost('correo_recibidos.php?accion=eliminar', { id });
    spamCache = spamCache.filter(x => x.id != id);
    cerrar();
    render(spamCache);
  } catch (err) { console.error('Error al eliminar:', err); }
}

// ── Selección masiva ──────────────────────────────────────
function toggleAll(cb) {
  document.querySelectorAll('.chk').forEach(c => {
    c.checked = cb.checked;
    toggleSel(+c.dataset.id, cb.checked);
  });
}

function toggleSel(id, v) {
  v ? seleccionados.add(id) : seleccionados.delete(id);
  const bar = document.getElementById('barMasiva');
  bar.style.display = seleccionados.size ? 'flex' : 'none';
  document.getElementById('lblSel').textContent =
    `${seleccionados.size} seleccionado${seleccionados.size > 1 ? 's' : ''}`;
}

async function restaurarSeleccion() {
  const ids = [...seleccionados];
  try {
    await Promise.all(ids.map(id => apiPost('correo_recibidos.php?accion=restaurar', { id })));
    spamCache = spamCache.filter(x => !seleccionados.has(x.id));
    seleccionados.clear();
    render(spamCache);
    document.getElementById('barMasiva').style.display = 'none';
    mostrarOk('Mensajes restaurados a la bandeja.');
  } catch (err) { console.error(err); }
}

async function eliminarSeleccion() {
  if (!confirm(`¿Eliminar definitivamente ${seleccionados.size} mensajes?`)) return;
  const ids = [...seleccionados];
  try {
    await Promise.all(ids.map(id => apiPost('correo_recibidos.php?accion=eliminar', { id })));
    spamCache = spamCache.filter(x => !seleccionados.has(x.id));
    seleccionados.clear();
    render(spamCache);
    document.getElementById('barMasiva').style.display = 'none';
  } catch (err) { console.error(err); }
}

async function vaciarSpam() {
  if (!spamCache.length) return;
  if (!confirm('¿Vaciar todos los mensajes de spam definitivamente?')) return;
  try {
    await apiPost('correo_recibidos.php?accion=vaciar_spam', {});
    spamCache = [];
    render([]);
    mostrarOk('Carpeta de spam vaciada.');
  } catch (err) { console.error(err); }
}

// ── Dominios bloqueados — #listaDominios ──────────────────
// Campos spam_dominios.php accion=listar: id, dominio, fecha
let dominios = [];

async function cargarDominios() {
  try {
    dominios = await apiGet('spam_dominios.php?accion=listar');
    renderDominios();
  } catch (err) { console.error('Error al cargar dominios:', err); }
}

function renderDominios() {
  document.getElementById('statBloqueados').textContent = dominios.length;

  const lista = document.getElementById('listaDominios');
  lista.innerHTML = dominios.length
    ? dominios.map(d => `
        <div style="display:flex;align-items:center;gap:.75rem;padding:.5rem 0;border-bottom:1px solid var(--fondo)">
          <span class="material-symbols-outlined" style="color:var(--error);font-size:1rem">block</span>
          <span style="flex:1;font-size:.87rem;color:var(--texto)">@${d.dominio}</span>
          <span style="font-size:.75rem;color:var(--texto-suave)">${d.fecha}</span>
          <button class="btn btn-peligro btn-sm" onclick="eliminarDominio(${d.id})">Desbloquear</button>
        </div>`).join('')
    : '<p style="font-size:.85rem;color:var(--texto-suave);padding:.5rem 0">No hay dominios bloqueados</p>';
}

async function eliminarDominio(id) {
  try {
    await apiPost('spam_dominios.php?accion=eliminar', { id });
    dominios = dominios.filter(d => d.id != id);
    renderDominios();
  } catch (err) { console.error('Error al desbloquear:', err); }
}

async function abrirNuevoDominio() {
  const d = prompt('Ingresa el dominio a bloquear (ej: spam.com)');
  if (!d?.trim()) return;
  try {
    const res = await apiPost('spam_dominios.php?accion=agregar', { dominio: d.trim() });
    dominios.push({ id: res.id, dominio: res.dominio, fecha: 'Hoy' });
    renderDominios();
    mostrarOk(`Dominio @${res.dominio} bloqueado.`);
  } catch (err) { alert('Error: ' + err.message); }
}

// ── Toast ─────────────────────────────────────────────────
function mostrarOk(txt) {
  const d = document.createElement('div');
  d.style.cssText = 'position:fixed;top:1.5rem;right:1.5rem;background:var(--ok-bg);border:1.5px solid var(--ok-borde);border-radius:var(--radio-sm);padding:.7rem 1rem;font-size:.83rem;color:var(--ok);z-index:600;display:flex;align-items:center;gap:.5rem;box-shadow:var(--sombra-md)';
  d.innerHTML = `<span class="material-symbols-outlined" style="font-size:1rem">check_circle</span>${txt}`;
  document.body.appendChild(d);
  setTimeout(() => d.remove(), 3000);
}

// ── Init ──────────────────────────────────────────────────
cargarSpam();
cargarDominios();

document.addEventListener('keydown', e => { if (e.key === 'Escape') cerrar(); });

document.addEventListener('DOMContentLoaded', () => {
  const b = document.getElementById('btnHamburguesa');
  const s = document.querySelector('.sidebar');
  const o = document.getElementById('sidebarOverlay');
  if (b && s && o) {
    b.addEventListener('click', () => { s.classList.toggle('abierto'); o.classList.toggle('visible'); });
    o.addEventListener('click', () => { s.classList.remove('abierto'); o.classList.remove('visible'); });
  }
});