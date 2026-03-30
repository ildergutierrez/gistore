// ============================================================
//  user/js/perfil.js — Perfil del vendedor GI Store
//  Consume: ../backend/perfil.php
//  Foto:    Cloudinary → guarda URL en vendedores.perfil
// ============================================================

document.body.style.visibility = 'hidden';

// ── Helpers ───────────────────────────────────────────────
function el(id) { return document.getElementById(id); }

function mostrarError(msg) {
  if (el('textoError')) el('textoError').textContent = msg;
  el('msgError')?.classList.add('visible');
  el('msgOk')?.classList.remove('visible');
}
function mostrarOk(msg) {
  if (el('textoOk')) el('textoOk').textContent = msg;
  el('msgOk')?.classList.add('visible');
  el('msgError')?.classList.remove('visible');
}
function ocultarMensajes() {
  el('msgError')?.classList.remove('visible');
  el('msgOk')?.classList.remove('visible');
}
function setErrorPass(msg) {
  if (el('textoErrorPass')) el('textoErrorPass').textContent = msg;
  el('msgErrorPass')?.classList.add('visible');
  el('msgOkPass')?.classList.remove('visible');
}
function btnCargando(btn, estado) {
  if (!btn) return;
  btn.disabled = estado;
  const txt  = btn.querySelector('.btn-texto');
  const spin = btn.querySelector('.spinner');
  if (txt)  txt.style.display  = estado ? 'none'         : '';
  if (spin) spin.style.display = estado ? 'inline-block' : 'none';
}

// ── Cloudinary ────────────────────────────────────────────
const CLOUD_NAME    = 'dqmrgerue';
const UPLOAD_PRESET = 'gi-store-user';
const FOTO_FOLDER   = 'user';

async function subirCloudinary(file) {
  const fd = new FormData();
  fd.append('file',          file);
  fd.append('upload_preset', UPLOAD_PRESET);
  fd.append('folder',        FOTO_FOLDER);
  const res  = await fetch(
    `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`,
    { method: 'POST', body: fd }
  );
  const data = await res.json();
  if (!res.ok) throw new Error(data.error?.message || 'Error Cloudinary');
  return data.secure_url;
}

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

// ── GET helper ────────────────────────────────────────────
async function apiGet(accion) {
  const token = await getToken();
  const resp  = await fetch(`../backend/perfil.php?accion=${accion}&token=${token}`, {
    credentials: 'include'
  });
  return resp.json();
}

// ── POST helper ───────────────────────────────────────────
async function apiPost(accion, campos) {
  const token = await getToken();
  const body  = new URLSearchParams({ accion, token, ...campos });
  const resp  = await fetch('../backend/perfil.php', {
    method: 'POST',
    credentials: 'include',
    body
  });
  return resp.json();
}

// ── Estado local ──────────────────────────────────────────
let vendedor    = null;
let archivoFoto = null;

// ── Ver/ocultar contraseñas ───────────────────────────────
[['btnVerPassActual', 'fPassActual'],
 ['btnVerPassNueva',  'fNewPass'],
 ['btnVerPassConf',   'fConfPass']].forEach(([b, i]) => {
  const btn = el(b); const inp = el(i);
  if (!btn || !inp) return;
  btn.addEventListener('click', () => {
    inp.type        = inp.type === 'password' ? 'text' : 'password';
    btn.textContent = inp.type === 'password' ? '👁'   : '🙈';
  });
});

// ── Render avatar ─────────────────────────────────────────
function renderAvatar(fotoUrl, nombre, color) {
  const wrap = el('avatarWrap');
  if (!wrap) return;
  if (fotoUrl) {
    wrap.innerHTML  = '';
    wrap.className  = 'avatar-foto';
    wrap.style.background = '';
    const img = document.createElement('img');
    img.src   = fotoUrl;
    img.alt   = nombre || 'Foto';
    img.style.cssText = 'width:100%;height:100%;object-fit:cover;display:block;border-radius:50%';
    img.onerror = () => renderAvatar('', nombre, color);
    wrap.appendChild(img);
    const btnElim = el('btnEliminarFoto');
    if (btnElim) btnElim.style.display = 'inline-flex';
  } else {
    wrap.className   = 'avatar-inicial';
    wrap.innerHTML   = '';
    wrap.textContent = (nombre || 'V')[0].toUpperCase();
    wrap.style.background = color || 'var(--verde)';
    const btnElim = el('btnEliminarFoto');
    if (btnElim) btnElim.style.display = 'none';
  }
}

// ── Contador caracteres descripción ──────────────────────
function actualizarContador() {
  const txt      = el('fDescripcion');
  const contador = el('descContador');
  if (!txt || !contador) return;
  const restantes = 300 - txt.value.length;
  contador.textContent = restantes + ' caracteres restantes';
  contador.style.color = restantes < 30 ? 'var(--error)' : 'var(--texto-suave)';
}
el('fDescripcion')?.addEventListener('input', actualizarContador);

// ── Membresía ─────────────────────────────────────────────
function renderMembresia(datos) {
  const elMem = el('infoMembresia');
  if (!elMem) return;
  if (!datos.mem_estado) {
    elMem.textContent = 'Sin membresía';
    elMem.style.color = 'var(--error)';
  } else {
    const dias = Math.ceil((new Date(datos.mem_fecha_fin) - new Date()) / 864e5);
    elMem.textContent = `Activa · ${dias} días restantes`;
    elMem.style.color = 'var(--verde)';
  }
}

// ════════════════════════════════════════════════════════════
//  INIT — carga datos del perfil
// ════════════════════════════════════════════════════════════
async function init() {
  // Fecha
  if (el('fechaHoy')) el('fechaHoy').textContent = new Date().toLocaleDateString('es-CO', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
  });

  const json = await apiGet('obtener');
  document.body.style.visibility = 'visible';

  if (!json.ok) {
    mostrarError(json.error || 'No se pudo cargar el perfil.');
    return;
  }

  vendedor = json.datos;

  // Sidebar nombre
  if (el('vendedorNombre')) el('vendedorNombre').textContent = vendedor.nombre || '';

  // Campos del formulario
  if (el('fNombre'))      el('fNombre').value      = vendedor.nombre      || '';
  if (el('fCiudad'))      el('fCiudad').value      = vendedor.ciudad      || '';
  if (el('fWhatsapp'))    el('fWhatsapp').value     = vendedor.whatsapp    || '';
  if (el('fCorreo'))      el('fCorreo').value       = vendedor.correo      || '';
  if (el('fUrlWeb'))      el('fUrlWeb').value       = vendedor.url_web     || '';
  if (el('fDescripcion')) el('fDescripcion').value  = vendedor.descripcion || '';
  actualizarContador();

  // Redes sociales
  const redes = vendedor.redes || {};
  if (el('fRedFacebook'))  el('fRedFacebook').value  = redes.facebook  || '';
  if (el('fRedTiktok'))    el('fRedTiktok').value    = redes.tiktok    || '';
  if (el('fRedInstagram')) el('fRedInstagram').value = redes.instagram || '';
  if (el('fRedYoutube'))   el('fRedYoutube').value   = redes.youtube   || '';

  // Avatar
  renderAvatar(vendedor.perfil || '', vendedor.nombre, vendedor.color);

  // Estado
  const elEstado = el('infoEstado');
  if (elEstado) {
    elEstado.textContent = vendedor.estado === 'activo' ? 'Activo' : 'Inactivo';
    elEstado.className   = 'badge badge-' + (vendedor.estado === 'activo' ? 'activo' : 'inactivo');
  }

  // Fecha creación
  if (el('infoCreadoEn')) el('infoCreadoEn').textContent = vendedor.creado_en
    ? new Date(vendedor.creado_en).toLocaleDateString('es-CO') : '—';

  // Membresía
  renderMembresia(vendedor);
}

init();

// ════════════════════════════════════════════════════════════
//  FOTO — seleccionar, previsualizar, subir, eliminar
// ════════════════════════════════════════════════════════════
el('btnCambiarFoto')?.addEventListener('click', () => el('fFotoFile')?.click());

el('fFotoFile')?.addEventListener('change', () => {
  const file = el('fFotoFile').files[0];
  if (!file) return;
  if (file.size > 2 * 1024 * 1024) {
    alert('La imagen no puede superar 2 MB.');
    el('fFotoFile').value = '';
    return;
  }
  archivoFoto = file;
  const reader = new FileReader();
  reader.onload = e => {
    const prev = el('fotoPreviewImg');
    const wrap = el('fotoPreviewWrap');
    const est  = el('fotoEstado');
    if (prev) prev.src           = e.target.result;
    if (wrap) wrap.style.display = 'flex';
    if (est)  est.textContent    = `Lista para subir · ${(file.size / 1024).toFixed(0)} KB`;
    const btnS = el('btnSubirFoto');
    if (btnS) btnS.style.display = 'inline-flex';
  };
  reader.readAsDataURL(file);
});

el('btnQuitarPreview')?.addEventListener('click', () => {
  archivoFoto = null;
  if (el('fFotoFile'))       el('fFotoFile').value         = '';
  if (el('fotoPreviewWrap')) el('fotoPreviewWrap').style.display = 'none';
  if (el('btnSubirFoto'))    el('btnSubirFoto').style.display    = 'none';
});

el('btnSubirFoto')?.addEventListener('click', async () => {
  if (!archivoFoto || !vendedor) return;
  const btn = el('btnSubirFoto');
  const est = el('fotoEstado');
  btnCargando(btn, true);
  if (est) { est.textContent = 'Subiendo...'; est.style.color = 'var(--advertencia)'; }
  try {
    const url  = await subirCloudinary(archivoFoto);
    const json = await apiPost('actualizar_foto', { perfil: url });
    if (!json.ok) throw new Error(json.error);
    vendedor.perfil = url;
    renderAvatar(url, vendedor.nombre, vendedor.color);
    if (el('fotoPreviewWrap')) el('fotoPreviewWrap').style.display = 'none';
    if (el('btnSubirFoto'))    el('btnSubirFoto').style.display    = 'none';
    if (est) { est.textContent = '✓ Foto guardada'; est.style.color = 'var(--ok,green)'; }
    archivoFoto = null;
    if (el('fFotoFile')) el('fFotoFile').value = '';
  } catch (e) {
    if (est) { est.textContent = '✗ ' + e.message; est.style.color = 'var(--error)'; }
    console.error(e);
  } finally { btnCargando(btn, false); }
});

el('btnEliminarFoto')?.addEventListener('click', async () => {
  if (!vendedor) return;
  if (!confirm('¿Eliminar foto de perfil? Se usará tu inicial como avatar.')) return;
  const btn = el('btnEliminarFoto');
  btnCargando(btn, true);
  try {
    const json = await apiPost('actualizar_foto', { perfil: '' });
    if (!json.ok) throw new Error(json.error);
    vendedor.perfil = '';
    renderAvatar('', vendedor.nombre, vendedor.color);
    const est = el('fotoEstado');
    if (est) { est.textContent = 'Foto eliminada'; est.style.color = 'var(--texto-suave)'; }
  } catch (e) { console.error(e); alert('Error al eliminar foto.'); }
  finally { btnCargando(btn, false); }
});

// ════════════════════════════════════════════════════════════
//  GUARDAR PERFIL
// ════════════════════════════════════════════════════════════
el('btnGuardarPerfil')?.addEventListener('click', async () => {
  if (!vendedor) { mostrarError('Perfil no cargado. Recarga la página.'); return; }

  const nombre      = el('fNombre')?.value.trim()      || '';
  const ciudad      = el('fCiudad')?.value.trim()      || '';
  const whatsapp    = el('fWhatsapp')?.value.trim()    || '';
  const url_web     = el('fUrlWeb')?.value.trim()      || '';
  const descripcion = el('fDescripcion')?.value.trim() || '';

  const redFacebook  = el('fRedFacebook')?.value.trim()  || '';
  const redTiktok    = el('fRedTiktok')?.value.trim()    || '';
  const redInstagram = el('fRedInstagram')?.value.trim() || '';
  const redYoutube   = el('fRedYoutube')?.value.trim()   || '';

  if (!nombre) { mostrarError('El nombre es obligatorio.'); return; }
  if (descripcion.length > 300) { mostrarError('La descripción no puede superar 300 caracteres.'); return; }

  if (url_web) {
    try {
      const u = new URL(url_web);
      if (!['http:', 'https:'].includes(u.protocol)) throw new Error();
    } catch { mostrarError('La URL de la página web no es válida. Debe iniciar con https://'); return; }
  }

  const redesParaValidar = [
    { val: redFacebook,  nombre: 'Facebook' },
    { val: redTiktok,    nombre: 'TikTok' },
    { val: redInstagram, nombre: 'Instagram' },
    { val: redYoutube,   nombre: 'YouTube' },
  ];
  for (const r of redesParaValidar) {
    if (r.val) {
      try {
        const u = new URL(r.val);
        if (!['http:', 'https:'].includes(u.protocol)) throw new Error();
      } catch { mostrarError(`La URL de ${r.nombre} no es válida. Debe iniciar con https://`); return; }
    }
  }

  const redes = {};
  if (redFacebook)  redes.facebook  = redFacebook;
  if (redTiktok)    redes.tiktok    = redTiktok;
  if (redInstagram) redes.instagram = redInstagram;
  if (redYoutube)   redes.youtube   = redYoutube;

  const btn = el('btnGuardarPerfil');
  btnCargando(btn, true);
  ocultarMensajes();

  try {
    const json = await apiPost('actualizar', {
      nombre, ciudad, whatsapp, url_web, descripcion,
      redes: JSON.stringify(redes),
    });
    if (!json.ok) throw new Error(json.error);

    vendedor.nombre      = nombre;
    vendedor.ciudad      = ciudad;
    vendedor.whatsapp    = whatsapp;
    vendedor.url_web     = url_web;
    vendedor.descripcion = descripcion;
    vendedor.redes       = redes;

    if (el('vendedorNombre')) el('vendedorNombre').textContent = nombre;
    if (!vendedor.perfil) renderAvatar('', nombre, vendedor.color);
    mostrarOk('✓ Datos actualizados correctamente.');
  } catch (e) {
    mostrarError(e.message || 'Error al guardar. Intenta de nuevo.');
    console.error(e);
  } finally { btnCargando(btn, false); }
});

// ════════════════════════════════════════════════════════════
//  CAMBIAR CONTRASEÑA
// ════════════════════════════════════════════════════════════
el('btnCambiarPass')?.addEventListener('click', async () => {
  const passActual = el('fPassActual')?.value || '';
  const newPass    = el('fNewPass')?.value    || '';
  const confPass   = el('fConfPass')?.value   || '';

  el('msgErrorPass')?.classList.remove('visible');
  el('msgOkPass')?.classList.remove('visible');

  if (!passActual)            { setErrorPass('Ingresa tu contraseña actual.'); return; }
  if (newPass.length < 6)     { setErrorPass('La nueva contraseña debe tener al menos 6 caracteres.'); return; }
  if (newPass !== confPass)   { setErrorPass('Las contraseñas nuevas no coinciden.'); return; }
  if (passActual === newPass) { setErrorPass('La nueva contraseña debe ser diferente a la actual.'); return; }

  const btn = el('btnCambiarPass');
  btnCargando(btn, true);

  try {
    const json = await apiPost('cambiar_password', {
      pass_actual: passActual,
      pass_nueva:  newPass,
      pass_conf:   confPass,
    });
    if (!json.ok) throw new Error(json.error);

    if (el('textoOkPass')) el('textoOkPass').textContent = '✓ Contraseña actualizada correctamente.';
    el('msgOkPass')?.classList.add('visible');

    ['fPassActual', 'fNewPass', 'fConfPass'].forEach(id => {
      if (el(id)) { el(id).value = ''; el(id).type = 'password'; }
    });
    ['btnVerPassActual', 'btnVerPassNueva', 'btnVerPassConf'].forEach(id => {
      if (el(id)) el(id).textContent = '👁';
    });
  } catch (e) {
    setErrorPass(e.message || 'Error al cambiar contraseña.');
    console.error(e);
  } finally { btnCargando(btn, false); }
});