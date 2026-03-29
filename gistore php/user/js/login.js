// ============================================================
//  user/js/login.js — Login Admin (MySQL + PHP)
// ============================================================
function btnCargando(btn, cargando) {
  btn.disabled = cargando;
  btn.classList.toggle('cargando', cargando);
}

function redirigirSiSesion(url) {
  const direccion = '/../backend/sesion.php?accion=verificar&ac=user';
  fetch(direccion, { credentials: 'include' })
    .then(r => r.json())
    .then(d => { if (d.ok && d.datos.rol !==1)window.location.href = url;  })
    .catch(() => {});
  
}
redirigirSiSesion('pages/dashboard.html');

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

// ── Elementos ─────────────────────────────────────────────
const btnLogin    = document.getElementById('btnLogin');
const inputCorreo = document.getElementById('correo');
const inputPass   = document.getElementById('contrasena');
const msgError    = document.getElementById('msgError');
const textoError  = document.getElementById('textoError');



// ── Mensajes ──────────────────────────────────────────────
function mostrarError(msg) {
  textoError.textContent = msg;
  msgError.classList.add('visible');
  inputCorreo.classList.add('error-input');
  inputPass.classList.add('error-input');
}
function limpiarError() {
  msgError.classList.remove('visible');
  inputCorreo.classList.remove('error-input');
  inputPass.classList.remove('error-input');
}

// ── Login ─────────────────────────────────────────────────
async function login() {
  limpiarError();
  const correo = inputCorreo.value.trim();
  const pass   = inputPass.value;
  if (!correo || !pass) { mostrarError('Completa todos los campos.'); return; }

  btnCargando(btnLogin, true);
  try {
    const token = await getToken();
    const body  = new URLSearchParams({ accion: 'login', token, correo, password: pass });
    const resp  = await fetch('backend/login.php', {
      method: 'POST', credentials: 'include',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });
    const data = await resp.json();
    if (!data.ok) {
      mostrarError(data.error || 'Correo o contraseña incorrectos.');
      btnCargando(btnLogin, false);
      return;
    }

    window.location.href = 'pages/dashboard.html';

  } catch (err) {
    console.error(err);
    mostrarError('Error de conexión. Intenta de nuevo.');
    btnCargando(btnLogin, false);
  }
}

btnLogin.addEventListener('click', login);
inputPass.addEventListener('keydown',   e => { if (e.key === 'Enter') login(); });
inputCorreo.addEventListener('keydown', e => { if (e.key === 'Enter') inputPass.focus(); });

// ── Recuperar contraseña ──────────────────────────────────
document.getElementById('btnOlvide').addEventListener('click', () => {
  document.getElementById('correoRecup').value = inputCorreo.value.trim();
  document.getElementById('panelRecuperar').style.display = 'block';
  document.getElementById('msgErrorRecup').classList.remove('visible');
  document.getElementById('msgOkRecup').classList.remove('visible');
  document.getElementById('btnOlvide').style.display = 'none';
  document.getElementById('correoRecup').focus();
});

document.getElementById('btnCancelarRecup').addEventListener('click', () => {
  document.getElementById('panelRecuperar').style.display = 'none';
  document.getElementById('btnOlvide').style.display = 'inline';
});

document.getElementById('btnEnviarRecup').addEventListener('click', async () => {
  const correo = document.getElementById('correoRecup').value.trim();
  document.getElementById('msgErrorRecup').classList.remove('visible');
  document.getElementById('msgOkRecup').classList.remove('visible');

  if (!correo) {
    document.getElementById('textoErrorRecup').textContent = 'Ingresa tu correo.';
    document.getElementById('msgErrorRecup').classList.add('visible');
    return;
  }

  const btn = document.getElementById('btnEnviarRecup');
  btnCargando(btn, true);
  try {
    document.getElementById('textoOkRecup').textContent =
      '✓ Contacta al administrador del sistema para restablecer tu contraseña.';
    document.getElementById('msgOkRecup').classList.add('visible');
    document.getElementById('correoRecup').value = '';
    document.getElementById('btnEnviarRecup').style.display = 'none';
    setTimeout(() => {
      document.getElementById('panelRecuperar').style.display = 'none';
      document.getElementById('btnOlvide').style.display = 'inline';
      document.getElementById('btnEnviarRecup').style.display = '';
    }, 4000);
  } finally {
    btnCargando(btn, false);
  }
});
// En login.js reemplaza todo el bloque de btnOlvide por esto:
document.getElementById('btnOlvide').addEventListener('click', () => {
  window.location.href = 'recuperar/index.html';
});

//registyro
document.getElementById('Sregistro').addEventListener('click', () => {
  window.location.href = '../page/info.html#registro';
});