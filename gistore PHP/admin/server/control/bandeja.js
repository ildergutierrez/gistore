// ============================================================
//  gistore/admin/server/control/bandeja.js
//  Lee correos EN TIEMPO REAL via IMAP (correo_imap.php).
//  NO guarda ni lee correos de la BBDD.
//  Comportamiento: igual a Evolution / Thunderbird.
// ============================================================

// ── Token CSRF ────────────────────────────────────────────
let _token = null;

async function getToken() {
  if (_token) return _token;
  try {
    const r = await fetch('../backend/tokens.php', { credentials: 'include' });
    _token = (await r.json()).token || '';
  } catch { _token = ''; }
  return _token;
}

async function apiGet(endpoint) {
  const token = await getToken();
  const sep   = endpoint.includes('?') ? '&' : '?';
  const r     = await fetch(`../backend/${endpoint}${sep}token=${token}`, { credentials: 'include' });
  const data  = await r.json();
  if (!data.ok) throw new Error(data.error || 'Error del servidor');
  return data.datos;
}

async function apiPost(endpoint, body = {}) {
  const token = await getToken();
  const form  = new URLSearchParams({ ...body, token });
  const r     = await fetch(`../backend/${endpoint}`, {
    method: 'POST', credentials: 'include',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: form,
  });
  const data = await r.json();
  if (!data.ok) throw new Error(data.error || 'Error del servidor');
  return data.datos;
}

// ── Estado global ─────────────────────────────────────────
let cuentaActiva  = null;   // objeto cuenta completo
let carpetaActual = 'INBOX';
let pagActual     = 1;
let correosCache  = [];     // encabezados de la página actual
let seleccionados = new Set();
let pollingTimer  = null;

// ── Init ──────────────────────────────────────────────────
(async function init() {
  try {
    await cargarCuentas();
  } catch (e) {
    mostrarError('Error de inicio: ' + e.message);
  }
})();

// ── Cargar cuentas en el selector ────────────────────────
async function cargarCuentas() {
  const cuentas = await apiGet('cuentas.php?accion=listar');
  const sel     = document.getElementById('selectorCuenta');

  if (!cuentas?.length) {
    sel.innerHTML = '<option value="">— Sin cuentas configuradas —</option>';
    mostrarAviso('Ve a Configuración → Cuentas de correo para agregar una cuenta IMAP.');
    return;
  }

  cuentaActiva = cuentas.find(c => +c.principal) || cuentas[0];

  sel.innerHTML = cuentas.map(c =>
    `<option value="${c.id}" ${c.id == cuentaActiva.id ? 'selected' : ''}>
      ${esc(c.nombre)} — ${esc(c.email)}${+c.principal ? ' ★' : ''}
     </option>`
  ).join('');

  actualizarInfoCuenta();
  await cargarCarpetas();
  await cargarBandeja();
  iniciarPolling();
}

async function cambiarCuenta() {
  const id      = +document.getElementById('selectorCuenta').value;
  const cuentas = await apiGet('cuentas.php?accion=listar').catch(() => []);
  cuentaActiva  = cuentas.find(c => c.id == id) || cuentaActiva;
  carpetaActual = 'INBOX';
  pagActual     = 1;
  actualizarInfoCuenta();
  await cargarCarpetas();
  await cargarBandeja();
}

function actualizarInfoCuenta() {
  const el = document.getElementById('infoCuenta');
  if (!el || !cuentaActiva) return;
  el.innerHTML = `
    <span style="display:inline-flex;align-items:center;gap:.4rem;font-size:.82rem;color:var(--texto-suave)">
      <span class="material-symbols-outlined" style="font-size:.9rem">inbox</span>
      <strong style="color:var(--texto)">${esc(cuentaActiva.email)}</strong>
      · <span id="lblCarpeta" style="color:var(--verde);font-weight:600">${esc(carpetaActual)}</span>
    </span>`;
}

// ── Carpetas del servidor ─────────────────────────────────
async function cargarCarpetas() {
  if (!cuentaActiva?.id) return;
  try {
    const carpetas = await apiGet(`correo_imap.php?accion=carpetas&cuenta_id=${cuentaActiva.id}`);
    const sel      = document.getElementById('selectorCarpeta');
    if (!sel) return;

    const comunes = ['INBOX','Sent','Spam','Junk','Drafts','Trash'];
    const orden   = [...comunes, ...carpetas.filter(c => !comunes.includes(c))];
    const labels  = { INBOX:'Bandeja de entrada', Sent:'Enviados', Spam:'Spam',
                      Junk:'Correo no deseado', Drafts:'Borradores', Trash:'Papelera' };

    sel.innerHTML = orden
      .filter(c => carpetas.includes(c))
      .map(c => `<option value="${esc(c)}" ${c === carpetaActual ? 'selected' : ''}>${esc(labels[c] || c)}</option>`)
      .join('');
  } catch { /* sin carpetas disponibles */ }
}

async function cambiarCarpeta() {
  const sel = document.getElementById('selectorCarpeta');
  if (!sel) return;
  carpetaActual = sel.value;
  pagActual     = 1;
  const lbl     = document.getElementById('lblCarpeta');
  if (lbl) lbl.textContent = carpetaActual;
  await cargarBandeja();
}

// ── Cargar lista de correos (solo encabezados) ─────────────
async function cargarBandeja() {
  if (!cuentaActiva?.id) return;

  const tbody = document.getElementById('tbodyCorreos');
  tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:2rem;color:var(--texto-suave)">
    <span class="material-symbols-outlined" style="font-size:1.4rem;animation:girar .8s linear infinite;display:inline-block">refresh</span>
    Conectando al servidor de correo…
  </td></tr>`;

  const q   = document.getElementById('buscarCorreo')?.value.trim() || '';

  let url = `correo_imap.php?accion=listar&cuenta_id=${cuentaActiva.id}&carpeta=${encodeURIComponent(carpetaActual)}&pagina=${pagActual}`;
  if (q) url += `&q=${encodeURIComponent(q)}`;

  try {
    const datos   = await apiGet(url);
    correosCache  = datos.correos || [];
    renderCorreos(correosCache);
    renderPaginacion(datos);
    actualizarBadge(datos.sin_leer ?? null);
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:2rem;color:var(--error)">
      <span class="material-symbols-outlined">error</span>
      ${esc(err.message)}
    </td></tr>`;
  }
}

function filtrarCorreos() { pagActual = 1; cargarBandeja(); }
function irPagina(p)      { pagActual = Math.max(1, p); cargarBandeja(); }

// ── Render tabla ──────────────────────────────────────────
function renderCorreos(lista) {
  const tb = document.getElementById('tbodyCorreos');
  if (!lista.length) {
    tb.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:2.5rem;color:var(--texto-suave)">
      <span class="material-symbols-outlined" style="font-size:2.5rem;display:block;margin-bottom:.5rem;opacity:.3">inbox</span>
      No hay mensajes en ${carpetaActual}
    </td></tr>`;
    return;
  }
  tb.innerHTML = lista.map(c => `
    <tr class="${!c.leido ? 'correo-nuevo' : ''}" style="cursor:pointer" onclick="verCorreo(${c.uid})">
      <td onclick="event.stopPropagation()">
        <input type="checkbox" class="chk-correo" data-uid="${c.uid}"
               onchange="toggleSeleccion(${c.uid}, this.checked)"/>
      </td>
      <td>
        <strong>${esc(c.de_nombre || c.de_email)}</strong>
        ${c.de_nombre ? `<br/><span style="font-size:.75rem;color:var(--texto-suave)">${esc(c.de_email)}</span>` : ''}
      </td>
      <td>${!c.leido ? '<strong>' : ''}${esc(c.asunto)}${!c.leido ? '</strong>' : ''}</td>
      <td><!-- tipo no aplica con IMAP real --></td>
      <td style="font-size:.82rem;color:var(--texto-suave);white-space:nowrap">${esc(c.fecha)}</td>
      <td onclick="event.stopPropagation()">
        <div class="flex-center">
          <button class="btn btn-secundario btn-sm" onclick="verCorreo(${c.uid})">Ver</button>
          <button class="btn btn-peligro btn-sm"    onclick="eliminarCorreo(${c.uid})">✕</button>
        </div>
      </td>
    </tr>`).join('');
}

// ── Ver correo — fetch del cuerpo completo al seleccionar ─
async function verCorreo(uid) {
  // Mostrar modal con spinner mientras carga
  const modal = document.getElementById('modalCorreo');
  document.getElementById('modalAsunto').textContent = 'Cargando…';
  document.getElementById('modalDe').textContent     = '';
  document.getElementById('modalFecha').textContent  = '';
  document.getElementById('modalCuerpo').textContent = '';
  const adjBox = document.getElementById('modalAdjuntos');
  if (adjBox) adjBox.style.display = 'none';
  modal.style.display = 'block';

  try {
    const c = await apiGet(
      `correo_imap.php?accion=ver&cuenta_id=${cuentaActiva.id}&uid=${uid}&carpeta=${encodeURIComponent(carpetaActual)}`
    );

    document.getElementById('modalAsunto').textContent =
      c.asunto || '(sin asunto)';
    document.getElementById('modalDe').textContent =
      c.de_nombre ? `${c.de_nombre} <${c.de_email}>` : c.de_email;
    document.getElementById('modalFecha').textContent = c.fecha;

    // Cuerpo: preferir texto plano; si solo hay HTML, mostrarlo limpio
    document.getElementById('modalCuerpo').textContent = c.cuerpo || '';

    // Adjuntos
    if (adjBox && c.adjuntos?.length) {
      const token = await getToken();
      adjBox.style.display = 'block';
      adjBox.innerHTML = `
        <p style="font-size:.75rem;color:var(--texto-suave);font-weight:600;
                  text-transform:uppercase;letter-spacing:.04em;margin-bottom:.5rem">
          Adjuntos (${c.adjuntos.length})
        </p>
        <div style="display:flex;flex-wrap:wrap;gap:.5rem">
          ${c.adjuntos.map((a, i) => `
            <a href="../backend/correo_imap.php?accion=adjunto&cuenta_id=${cuentaActiva.id}&uid=${uid}&parte=${i}&carpeta=${encodeURIComponent(carpetaActual)}&token=${token}"
               target="_blank"
               style="display:inline-flex;align-items:center;gap:.4rem;background:var(--verde-claro);
                      border:1px solid var(--verde-borde);border-radius:6px;padding:.3rem .7rem;
                      font-size:.78rem;color:var(--verde);text-decoration:none;font-weight:600">
              <span class="material-symbols-outlined" style="font-size:.9rem">attach_file</span>
              ${esc(a.nombre)}
              <span style="opacity:.65">${tam(a.tam_bytes)}</span>
            </a>`).join('')}
        </div>`;
    } else if (adjBox) {
      adjBox.style.display = 'none';
    }

    // Marcar como leído en cache local
    const local = correosCache.find(x => x.uid == uid);
    if (local && !local.leido) {
      local.leido = true;
      renderCorreos(correosCache);
    }

  } catch (err) {
    document.getElementById('modalAsunto').textContent = 'Error al cargar el correo';
    document.getElementById('modalCuerpo').textContent = err.message;
  }
}

function cerrarModal() {
  document.getElementById('modalCorreo').style.display = 'none';
}

// ── Eliminar en el servidor ───────────────────────────────
async function eliminarCorreo(uid) {
  if (!confirm('¿Eliminar este mensaje del servidor de correo?')) return;
  try {
    await apiPost(`correo_imap.php?accion=eliminar`, {
      cuenta_id: cuentaActiva.id, uid, carpeta: carpetaActual
    });
    correosCache = correosCache.filter(x => x.uid != uid);
    cerrarModal();
    renderCorreos(correosCache);
  } catch (err) { mostrarError('Error al eliminar: ' + err.message); }
}

// ── Actualizar ────────────────────────────────────────────
async function actualizarBandeja(event) {
  const btn = event?.currentTarget || event?.target;
  if (btn) { btn.disabled = true; }
  await cargarBandeja();
  if (btn) {
    btn.disabled = false;
    btn.innerHTML = '<span class="material-symbols-outlined" style="font-size:1rem">refresh</span> Actualizar';
  }
}

// ── Paginación ────────────────────────────────────────────
function renderPaginacion(datos) {
  let el = document.getElementById('paginacion');
  if (!el) {
    el = document.createElement('div');
    el.id = 'paginacion';
    el.style.cssText = 'padding:.75rem 1.2rem;display:flex;align-items:center;gap:.5rem;justify-content:flex-end;border-top:1.5px solid var(--borde);font-size:.82rem;color:var(--texto-suave)';
    document.querySelector('.panel')?.appendChild(el);
  }
  const total   = datos.total   || 0;
  const pp      = datos.por_pag || 25;
  const paginas = Math.ceil(total / pp);

  el.innerHTML = paginas <= 1
    ? `<span>${total} mensaje${total !== 1 ? 's' : ''}</span>`
    : `<span>${total} mensajes</span>
       <button class="btn btn-secundario btn-sm" onclick="irPagina(${pagActual-1})" ${pagActual<=1?'disabled':''}>‹</button>
       <span>Pág ${pagActual} / ${paginas}</span>
       <button class="btn btn-secundario btn-sm" onclick="irPagina(${pagActual+1})" ${pagActual>=paginas?'disabled':''}>›</button>`;
}

// ── Polling — notificaciones reales cada 60 s ─────────────
function iniciarPolling() {
  if (pollingTimer) clearInterval(pollingTimer);
  pollingTimer = setInterval(verificarCorreosNuevos, 60_000);
}

async function verificarCorreosNuevos() {
  if (!cuentaActiva?.id) return;
  try {
    const d = await apiGet(`notificaciones.php?accion=sin_leer&cuenta_id=${cuentaActiva.id}`);
    actualizarBadge(d.sin_leer);
  } catch { /* silencioso */ }
}

function actualizarBadge(n) {
  if (n === null || n === undefined) return;
  // Badge en el sidebar de ESTE html
  document.querySelectorAll('.badge-nav, #badgeSinLeer').forEach(el => {
    el.textContent = n > 0 ? n : '';
    el.style.display = n > 0 ? '' : 'none';
  });
}

// ── Selección masiva ──────────────────────────────────────
function toggleAll(cb) {
  document.querySelectorAll('.chk-correo').forEach(c => {
    c.checked = cb.checked;
    toggleSeleccion(+c.dataset.uid, cb.checked);
  });
}
function toggleSeleccion(uid, checked) {
  checked ? seleccionados.add(uid) : seleccionados.delete(uid);
  const bar = document.getElementById('accionesMasivas');
  const lbl = document.getElementById('seleccionados');
  if (bar) bar.style.display = seleccionados.size ? 'flex' : 'none';
  if (lbl) lbl.textContent = `${seleccionados.size} seleccionado${seleccionados.size > 1 ? 's' : ''}`;
}

// ── Notificaciones visuales ───────────────────────────────
function mostrarToast(txt, tipo = 'ok') {
  const c = { ok: ['var(--ok-bg)','var(--ok-borde)','var(--ok)'],
              error: ['var(--error-bg)','var(--error-borde)','var(--error)'],
              info:  ['var(--adv-bg)','var(--adv-borde)','var(--advertencia)'] }[tipo] || [];
  const d = document.createElement('div');
  d.style.cssText = `position:fixed;top:1.5rem;right:1.5rem;background:${c[0]};border:1.5px solid ${c[1]};border-radius:var(--radio-sm);padding:.75rem 1rem;font-size:.83rem;color:${c[2]};z-index:600;display:flex;align-items:center;gap:.5rem;box-shadow:var(--sombra-md);max-width:380px`;
  d.innerHTML = `<span class="material-symbols-outlined" style="font-size:1rem;flex-shrink:0">info</span>${txt}`;
  document.body.appendChild(d);
  setTimeout(() => d.remove(), 4500);
}
function mostrarError(t) { mostrarToast(t, 'error'); }
function mostrarAviso(t) { mostrarToast(t, 'info'); }

// ── Utilidades ────────────────────────────────────────────
function esc(s) {
  return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function tam(bytes) {
  if (!bytes) return '';
  if (bytes < 1024)       return bytes + ' B';
  if (bytes < 1048576)    return Math.round(bytes / 1024) + ' KB';
  return (bytes / 1048576).toFixed(1) + ' MB';
}

// ── Fecha ─────────────────────────────────────────────────
const elFecha = document.getElementById('fechaHoy');
if (elFecha) elFecha.textContent = new Date().toLocaleDateString('es-CO', {
  weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
});

// ── Hamburguesa ───────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  const b = document.getElementById('btnHamburguesa');
  const s = document.querySelector('.sidebar');
  const o = document.getElementById('sidebarOverlay');
  if (b && s && o) {
    b.addEventListener('click', () => { s.classList.toggle('abierto'); o.classList.toggle('visible'); });
    o.addEventListener('click', () => { s.classList.remove('abierto'); o.classList.remove('visible'); });
  }
});
document.addEventListener('keydown', e => { if (e.key === 'Escape') cerrarModal(); });