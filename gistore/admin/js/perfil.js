// ============================================================
//  admin/js/perfil.js — Perfil del administrador (PHP + MySQL)
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

// ── Init ──────────────────────────────────────────────────
document.getElementById('fechaHoy').textContent = fechaHoy();
document.getElementById('btnSalir').addEventListener('click', async () => {
  const resp = await fetch('../../backend/cerrar.php', { credentials: 'include' });
  const data = await resp.json();
  if (data.ok) window.location.href = '../../index.html';
});

// ── Ver/ocultar contraseñas ───────────────────────────────
[['btnVerPass1','fPassActual'],['btnVerPass2','fNewPass'],['btnVerPass3','fConfPass']].forEach(([b, i]) => {
  document.getElementById(b).addEventListener('click', () => {
    const inp = document.getElementById(i);
    const btn = document.getElementById(b);
    if (inp.type === 'password') { inp.type = 'text';     btn.textContent = '🙈'; }
    else                         { inp.type = 'password'; btn.textContent = '👁'; }
  });
});

// ── Cargar datos del perfil ───────────────────────────────
async function cargarPerfil() {
  try {
    const perfil = await apiGet('perfil.php?accion=obtener');

    document.getElementById('fCorreo').value          = perfil.correo   || '';
    document.getElementById('infoCorreo').textContent = perfil.correo   || '—';
    document.getElementById('infoSesion').textContent = perfil.actualizado_en
      ? new Date(perfil.actualizado_en).toLocaleString('es-CO') : '—';

    // Nombre guardado en sesión PHP (o fallback local)
    const nombre = perfil.nombre || sessionStorage.getItem('admin_nombre') || 'Administrador';
    document.getElementById('fNombre').value = nombre;

  } catch (e) {
    console.error(e);
    mostrarError('Error al cargar el perfil.');
  }
}

// ── Guardar nombre ────────────────────────────────────────
document.getElementById('btnGuardarPerfil').addEventListener('click', async () => {
  const nombre = document.getElementById('fNombre').value.trim();
  if (!nombre) { mostrarError('El nombre es obligatorio.'); return; }

  const btn = document.getElementById('btnGuardarPerfil');
  btnCargando(btn, true);
  ocultarMensajes();
  try {
    await apiPost('perfil.php?accion=actualizar_nombre', { nombre });
    sessionStorage.setItem('admin_nombre', nombre); // respaldo local
    mostrarOk('✓ Nombre actualizado correctamente.');
  } catch (e) {
    mostrarError('Error al guardar: ' + e.message);
    console.error(e);
  } finally { btnCargando(btn, false); }
});

// ── Cambiar contraseña ────────────────────────────────────
document.getElementById('btnCambiarPass').addEventListener('click', async () => {
  const passActual = document.getElementById('fPassActual').value;
  const newPass    = document.getElementById('fNewPass').value;
  const confPass   = document.getElementById('fConfPass').value;

  document.getElementById('msgErrorPass').classList.remove('visible');
  document.getElementById('msgOkPass').classList.remove('visible');

  if (!passActual)         { setErrPass('Ingresa tu contraseña actual.'); return; }
  if (newPass.length < 6)  { setErrPass('La nueva contraseña debe tener al menos 6 caracteres.'); return; }
  if (newPass !== confPass) { setErrPass('Las contraseñas no coinciden.'); return; }
  if (passActual === newPass){ setErrPass('La nueva contraseña debe ser diferente a la actual.'); return; }

  const btn = document.getElementById('btnCambiarPass');
  btnCargando(btn, true);
  try {
    await apiPost('perfil.php?accion=cambiar_password', {
      pass_actual: passActual,
      pass_nueva:  newPass,
      pass_conf:   confPass,
    });
    document.getElementById('textoOkPass').textContent = '✓ Contraseña actualizada.';
    document.getElementById('msgOkPass').classList.add('visible');
    // Limpiar campos
    ['fPassActual','fNewPass','fConfPass'].forEach(id => {
      document.getElementById(id).value = '';
      document.getElementById(id).type  = 'password';
    });
    ['btnVerPass1','btnVerPass2','btnVerPass3'].forEach(id => {
      document.getElementById(id).textContent = '👁';
    });
  } catch (e) {
    setErrPass(e.message || 'Error al cambiar contraseña.');
    console.error(e);
  } finally { btnCargando(btn, false); }
});

// ── Mensajes ──────────────────────────────────────────────
function setErrPass(msg) {
  document.getElementById('textoErrorPass').textContent = msg;
  document.getElementById('msgErrorPass').classList.add('visible');
}
function ocultarMensajes() {
  document.getElementById('msgError').classList.remove('visible');
  document.getElementById('msgOk').classList.remove('visible');
}
function mostrarError(msg) {
  document.getElementById('textoError').textContent = msg;
  document.getElementById('msgError').classList.add('visible');
  document.getElementById('msgOk').classList.remove('visible');
}
function mostrarOk(msg) {
  document.getElementById('textoOk').textContent = msg;
  document.getElementById('msgOk').classList.add('visible');
  document.getElementById('msgError').classList.remove('visible');
}

// ── Arrancar ──────────────────────────────────────────────
cargarPerfil();