// ============================================================
//  user/recuperar/recuperar.js
// ============================================================

const API = '../backend/recuperar.php';

const el = id => document.getElementById(id);

function mostrarError(msg) {
  el('textoError').textContent = msg;
  el('msgError').classList.add('visible');
  el('msgError').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}
function ocultarError() {
  el('msgError').classList.remove('visible');
}
function cargando(btn, estado) {
  btn.disabled = estado;
  btn.classList.toggle('cargando', estado);
}

// ── Ver/ocultar contraseña ────────────────────────────────
[['btnVerNueva', 'fPassNueva'],
 ['btnVerConf',  'fPassConf']].forEach(([b, i]) => {
  el(b)?.addEventListener('click', () => {
    const inp = el(i);
    inp.type       = inp.type === 'password' ? 'text' : 'password';
    el(b).textContent = inp.type === 'password' ? '👁' : '🙈';
  });
});

// ── Dots de progreso ──────────────────────────────────────
function setPaso(n) {
  [1, 2, 3].forEach(i => {
    const dot = el('dot' + i);
    dot.className = 'paso-dot' + (i < n ? ' hecho' : i === n ? ' activo' : '');
  });
  ['paso1', 'paso2', 'paso3', 'panelExito'].forEach(id => {
    el(id).style.display = 'none';
  });
  if (n <= 3) el('paso' + n).style.display = '';
  else        el('panelExito').style.display = '';
}

// ── POST helper — CORREGIDO: solo se lee el body una vez ──
async function post(campos) {
  const resp = await fetch(API, {
    method:      'POST',
    credentials: 'include',
    headers:     { 'Content-Type': 'application/x-www-form-urlencoded' },
    body:        new URLSearchParams(campos).toString(),
  });
  const data = await resp.json(); // ← una sola lectura
  //console.log('[recuperar]', data);
  return data;
}

// ── Estado compartido entre pasos ────────────────────────
let correoActual = '';

// ════════════════════════════════════════════════════════════
//  PASO 1 — Solicitar código
// ════════════════════════════════════════════════════════════
el('btnSolicitar').addEventListener('click', async () => {
  ocultarError();
  const correo = el('fCorreo').value.trim();

  if (!correo) { mostrarError('Ingresa tu correo electrónico.'); return; }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo)) {
    mostrarError('Ingresa un correo válido.'); return;
  }

  const btn = el('btnSolicitar');
  cargando(btn, true);

  try {
    const data = await post({ accion: 'solicitar', correo });

    if (!data.ok) {
      mostrarError(data.error || 'Ocurrió un error. Intenta de nuevo.');
      return;
    }

    correoActual = correo;
    el('correoMaskDisplay').textContent = data.datos?.correo_mask || correo;
    setPaso(2);
    el('fCodigo').focus();

  } catch (e) {
    console.error(e);
    mostrarError('Error de conexión. Intenta de nuevo.');
  } finally {
    cargando(btn, false);
  }
});

el('fCorreo').addEventListener('keydown', e => {
  if (e.key === 'Enter') el('btnSolicitar').click();
});

// ════════════════════════════════════════════════════════════
//  PASO 2 — Verificar código
// ════════════════════════════════════════════════════════════
el('btnVerificar').addEventListener('click', async () => {
  ocultarError();
  const codigo = el('fCodigo').value.trim().replace(/\D/g, '');

  if (codigo.length !== 6) {
    mostrarError('El código debe tener 6 dígitos.'); return;
  }

  const btn = el('btnVerificar');
  cargando(btn, true);

  try {
    const data = await post({ accion: 'verificar', correo: correoActual, codigo });

    if (!data.ok) {
      mostrarError(data.error || 'Código inválido. Intenta de nuevo.');
      return;
    }

    setPaso(3);
    el('fPassNueva').focus();

  } catch (e) {
    console.error(e);
    mostrarError('Error de conexión. Intenta de nuevo.');
  } finally {
    cargando(btn, false);
  }
});

el('fCodigo').addEventListener('input', () => {
  el('fCodigo').value = el('fCodigo').value.replace(/\D/g, '').slice(0, 6);
});
el('fCodigo').addEventListener('keydown', e => {
  if (e.key === 'Enter') el('btnVerificar').click();
});

// Reenviar código
el('btnReenviar').addEventListener('click', async () => {
  ocultarError();
  if (!correoActual) { setPaso(1); return; }

  el('btnReenviar').disabled = true;
  el('btnReenviar').textContent = 'Enviando…';

  try {
    const data = await post({ accion: 'solicitar', correo: correoActual });
    if (data.ok) {
      el('fCodigo').value = '';
      el('fCodigo').focus();
      el('btnReenviar').textContent = '✓ Código reenviado';
      setTimeout(() => {
        el('btnReenviar').textContent = 'Reenviar código';
        el('btnReenviar').disabled = false;
      }, 4000);
    } else {
      mostrarError(data.error || 'No se pudo reenviar. Intenta de nuevo.');
      el('btnReenviar').textContent = 'Reenviar código';
      el('btnReenviar').disabled = false;
    }
  } catch (e) {
    mostrarError('Error de conexión.');
    el('btnReenviar').textContent = 'Reenviar código';
    el('btnReenviar').disabled = false;
  }
});

// ════════════════════════════════════════════════════════════
//  PASO 3 — Nueva contraseña
// ════════════════════════════════════════════════════════════
el('btnCambiar').addEventListener('click', async () => {
  ocultarError();
  const passNueva = el('fPassNueva').value;
  const passConf  = el('fPassConf').value;

  if (passNueva.length < 6) {
    mostrarError('La contraseña debe tener al menos 6 caracteres.'); return;
  }
  if (passNueva !== passConf) {
    mostrarError('Las contraseñas no coinciden.'); return;
  }

  const btn = el('btnCambiar');
  cargando(btn, true);

  try {
    const data = await post({
      accion:     'cambiar',
      pass_nueva: passNueva,
      pass_conf:  passConf,
    });

    if (!data.ok) {
      mostrarError(data.error || 'No se pudo cambiar la contraseña.');
      return;
    }

    [1, 2, 3].forEach(i => el('dot' + i).className = 'paso-dot hecho');
    el('paso3').style.display      = 'none';
    el('panelExito').style.display = 'flex';
    el('volverLogin').style.display = 'none';

    setTimeout(() => {
      window.location.href = '../index.html';
    }, 2500);

  } catch (e) {
    console.error(e);
    mostrarError('Error de conexión. Intenta de nuevo.');
  } finally {
    cargando(btn, false);
  }
});