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
  const resp = await fetch(`../backend/${endpoint}&token=${token}`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: form
  });
  const data = await resp.json();
  if (!data.ok) throw new Error(data.error || 'Error');
  return data.datos;
}

// ── Presets de proveedores ────────────────────────────────
const presets = {
  gmail:    { host: 'smtp.gmail.com',        puerto: 587, ssl: false },
  outlook:  { host: 'smtp-mail.outlook.com', puerto: 587, ssl: false },
  yahoo:    { host: 'smtp.mail.yahoo.com',   puerto: 587, ssl: false },
  zoho:     { host: 'smtp.zoho.com',         puerto: 465, ssl: true  },
  sendgrid: { host: 'smtp.sendgrid.net',     puerto: 587, ssl: false },
  custom:   { host: '',                      puerto: '',  ssl: false  },
};

let cuentas = [];
let editandoId = null;

// ── Render #listaCuentas ──────────────────────────────────
// Campos que devuelve cuentas.php accion=listar:
// id, nombre, email, remitente, host, puerto, ssl, principal, estado, creado_en
function renderCuentas() {
  const el = document.getElementById('listaCuentas');
  if (!cuentas.length) {
    el.innerHTML = '<p class="cargando-txt">No hay cuentas configuradas</p>';
    return;
  }
  el.innerHTML = cuentas.map(c => `
    <div class="cuenta-card ${+c.principal ? 'principal' : ''}">
      ${+c.principal ? '<span class="tag-principal">✓ Principal</span>' : ''}
      <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:.75rem">
        <div style="display:flex;align-items:center;gap:1rem">
          <div style="width:44px;height:44px;border-radius:12px;background:var(--verde-claro);border:1.5px solid var(--verde-borde);display:flex;align-items:center;justify-content:center;font-size:1.2rem">📧</div>
          <div>
            <p style="font-weight:600;font-size:.95rem;color:var(--texto)">${c.nombre}</p>
            <p style="font-size:.82rem;color:var(--texto-suave)">${c.email} · ${c.host}:${c.puerto}</p>
          </div>
        </div>
        <div style="display:flex;align-items:center;gap:.75rem;flex-wrap:wrap">
          <span style="display:inline-flex;align-items:center;gap:.35rem;background:${c.estado === 'ok' ? 'var(--ok-bg)' : 'var(--error-bg)'};border:1.5px solid ${c.estado === 'ok' ? 'var(--ok-borde)' : 'var(--error-borde)'};border-radius:20px;padding:.25rem .75rem;font-size:.78rem;font-weight:600;color:${c.estado === 'ok' ? 'var(--ok)' : 'var(--error)'}">
            <span style="width:6px;height:6px;border-radius:50%;background:${c.estado === 'ok' ? 'var(--ok)' : 'var(--error)'}"></span>
            ${c.estado === 'ok' ? 'Conexión activa' : c.estado === 'error' ? 'Error de conexión' : 'Sin probar'}
          </span>
          <button class="btn btn-secundario btn-sm" onclick="editarCuenta(${c.id})">Editar</button>
          ${!+c.principal ? `<button class="btn btn-secundario btn-sm" onclick="hacerPrincipal(${c.id})">Hacer principal</button>` : ''}
          <button class="btn btn-peligro btn-sm" onclick="eliminarCuenta(${c.id})">Eliminar</button>
        </div>
      </div>
    </div>`).join('');
}

// ── Cargar desde cuentas.php?accion=listar ────────────────
async function cargarCuentas() {
  try {
    cuentas = await apiGet('cuentas.php?accion=listar');
    renderCuentas();
  } catch (err) { console.error('Error al cargar cuentas:', err); }
}

// ── Abrir formulario nueva cuenta (#formPanel) ────────────
function abrirNueva() {
  editandoId = null;
  document.getElementById('formTitulo').textContent = '➕ Nueva cuenta SMTP';
  // Limpiar todos los campos del form definidos en config-correo.html
  ['fNombre', 'fEmail', 'fRemitente', 'fHost', 'fPuerto', 'fUsuario', 'fPassword'].forEach(id => {
    document.getElementById(id).value = '';
  });
  document.getElementById('fProveedor').value   = '';
  document.getElementById('fSSL').checked       = false;
  document.getElementById('fPrincipal').checked = false;
  document.getElementById('formOk').classList.remove('visible');
  document.getElementById('formErr').classList.remove('visible');
  document.getElementById('formPanel').style.display = 'block';
  document.getElementById('formPanel').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function editarCuenta(id) {
  const c = cuentas.find(x => x.id == id);
  if (!c) return;
  editandoId = id;
  document.getElementById('formTitulo').textContent   = '✏️ Editar cuenta';
  document.getElementById('fNombre').value            = c.nombre;
  document.getElementById('fEmail').value             = c.email;
  document.getElementById('fRemitente').value         = c.remitente;
  document.getElementById('fHost').value              = c.host;
  document.getElementById('fPuerto').value            = c.puerto;
  document.getElementById('fUsuario').value           = c.usuario || '';
  document.getElementById('fPassword').value          = '';   // nunca se precarga por seguridad
  document.getElementById('fSSL').checked             = !!+c.ssl;
  document.getElementById('fPrincipal').checked       = !!+c.principal;
  document.getElementById('formOk').classList.remove('visible');
  document.getElementById('formErr').classList.remove('visible');
  document.getElementById('formPanel').style.display = 'block';
  document.getElementById('formPanel').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// ── Guardar cuenta ────────────────────────────────────────
async function guardarCuenta() {
  const nombre    = document.getElementById('fNombre').value.trim();
  const email     = document.getElementById('fEmail').value.trim();
  const remitente = document.getElementById('fRemitente').value.trim();
  const host      = document.getElementById('fHost').value.trim();
  const puerto    = document.getElementById('fPuerto').value;
  const usuario   = document.getElementById('fUsuario').value.trim();
  const password  = document.getElementById('fPassword').value;
  const ssl       = document.getElementById('fSSL').checked ? 1 : 0;
  const principal = document.getElementById('fPrincipal').checked ? 1 : 0;

  document.getElementById('formErr').classList.remove('visible');

  if (!nombre || !email || !host || !puerto) {
    document.getElementById('formErrTxt').textContent = 'Completa los campos obligatorios.';
    document.getElementById('formErr').classList.add('visible');
    return;
  }

  const body = { id: editandoId || 0, nombre, email, remitente, host, puerto, usuario, ssl, principal };
  if (password) body.password = password;

  try {
    await apiPost('cuentas.php?accion=guardar', body);
    document.getElementById('formOk').classList.add('visible');
    await cargarCuentas();
    setTimeout(cerrarForm, 1200);
  } catch (err) {
    document.getElementById('formErrTxt').textContent = err.message || 'Error al guardar';
    document.getElementById('formErr').classList.add('visible');
  }
}

// ── Hacer principal ───────────────────────────────────────
async function hacerPrincipal(id) {
  try {
    await apiPost('cuentas.php?accion=hacer_principal', { id });
    await cargarCuentas();
  } catch (err) { console.error('Error al hacer principal:', err); }
}

// ── Eliminar ──────────────────────────────────────────────
async function eliminarCuenta(id) {
  if (!confirm('¿Eliminar esta cuenta?')) return;
  try {
    await apiPost('cuentas.php?accion=eliminar', { id });
    await cargarCuentas();
  } catch (err) { console.error('Error al eliminar:', err); }
}

// ── Probar conexión SMTP ──────────────────────────────────
async function probarConexion() {
  if (!editandoId) { alert('Guarda la cuenta primero para poder probar la conexión.'); return; }
  const btn = document.getElementById('btnProbar');
  btn.disabled = true;
  btn.innerHTML = '<span class="material-symbols-outlined" style="font-size:1rem">hourglass_top</span>Probando…';
  try {
    const res = await apiPost('cuentas.php?accion=probar', { id: editandoId });
    mostrarToast(res?.mensaje || 'Conexión SMTP exitosa');
    await cargarCuentas();
  } catch (err) {
    mostrarToast('Error: ' + err.message, true);
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<span class="material-symbols-outlined" style="font-size:1rem">bolt</span>Probar conexión';
  }
}

function cerrarForm() {
  document.getElementById('formPanel').style.display = 'none';
}

// ── Preset de proveedor ───────────────────────────────────
function cargarPreset() {
  const p = presets[document.getElementById('fProveedor').value];
  if (!p) return;
  document.getElementById('fHost').value   = p.host;
  document.getElementById('fPuerto').value = p.puerto;
  document.getElementById('fSSL').checked  = p.ssl;
}

// ── Ver/ocultar contraseña ────────────────────────────────
function togglePass() {
  const inp = document.getElementById('fPassword');
  const ico = document.getElementById('passIcon');
  inp.type = inp.type === 'password' ? 'text' : 'password';
  ico.textContent = inp.type === 'password' ? 'visibility' : 'visibility_off';
}

// ── Toast ─────────────────────────────────────────────────
function mostrarToast(txt, error = false) {
  const d = document.createElement('div');
  d.style.cssText = `position:fixed;top:1.5rem;right:1.5rem;background:${error ? 'var(--error-bg)' : 'var(--ok-bg)'};border:1.5px solid ${error ? 'var(--error-borde)' : 'var(--ok-borde)'};border-radius:var(--radio-sm);padding:.7rem 1rem;font-size:.83rem;color:${error ? 'var(--error)' : 'var(--ok)'};z-index:600;display:flex;align-items:center;gap:.5rem;box-shadow:var(--sombra-md);max-width:340px`;
  d.innerHTML = `<span class="material-symbols-outlined" style="font-size:1rem">${error ? 'error' : 'check_circle'}</span>${txt}`;
  document.body.appendChild(d);
  setTimeout(() => d.remove(), 4000);
}

// ── Init ──────────────────────────────────────────────────
cargarCuentas();

document.addEventListener('DOMContentLoaded', () => {
  const b = document.getElementById('btnHamburguesa');
  const s = document.querySelector('.sidebar');
  const o = document.getElementById('sidebarOverlay');
  if (b && s && o) {
    b.addEventListener('click', () => { s.classList.toggle('abierto'); o.classList.toggle('visible'); });
    o.addEventListener('click', () => { s.classList.remove('abierto'); o.classList.remove('visible'); });
  }
});