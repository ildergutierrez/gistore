// ============================================================
//  admin/js/publicidad.js — Gestión de publicidades (PHP + MySQL)
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

const CLOUD_NAME    = 'dqmrgerue';
const UPLOAD_PRESET = 'gi-store-publicidad';
const PUB_FOLDER    = 'publicidad';

let publicidades = [];
let archivoImg   = null;
let eliminarId   = null;

// ── Init ──────────────────────────────────────────────────
el('fechaHoy').textContent = fechaHoy();
el('btnSalir').addEventListener('click', async () => {
  const resp = await fetch('../../backend/cerrar.php', { credentials: 'include' });
  const data = await resp.json();
  if (data.ok) window.location.href = '../../index.html';
});

// ── Cargar lista ──────────────────────────────────────────
async function cargarPublicidades() {
  el('pubLista').innerHTML = '<p class="cargando-txt">Cargando...</p>';
  try {
    publicidades = await apiGet('publicidad.php?accion=obtener');
    // _hoy_count ya viene del JOIN en el PHP
    publicidades = publicidades.map(p => ({
      ...p,
      _hoy_count: Number(p._hoy_count || 0),
      limite_diario: Number(p.limite_diario || 50),
    }));

    await verificarAutoPausa();
    renderLista();
  } catch (e) {
    console.error(e);
    el('pubLista').innerHTML = '<p class="vacio-txt">Error al cargar publicidades.</p>';
  }
}

// ── Auto-pausa / auto-reactivación ────────────────────────
async function verificarAutoPausa() {
  const hoy = new Date().toISOString().split('T')[0];
  const promesas = [];

  for (const p of publicidades) {
    const count  = p._hoy_count;
    const limite = p.limite_diario;

    // Activa pero agotó cupo hoy → pausar automáticamente
    if (p.estado === 'activa' && count >= limite) {
      promesas.push(
        apiPost('publicidad.php?accion=actualizar', { id: p.id, estado: 'pausada_auto' })
          .then(() => { p.estado = 'pausada_auto'; })
          .catch(e => console.warn('auto-pausa fallo:', e))
      );
    }

    // Pausada automáticamente → verificar si se puede reactivar
    if (p.estado === 'pausada_auto') {
      if (p.fecha_fin < hoy) {
        promesas.push(
          apiPost('publicidad.php?accion=actualizar', { id: p.id, estado: 'inactiva' })
            .then(() => { p.estado = 'inactiva'; })
            .catch(e => console.warn('inactivar fallo:', e))
        );
      } else if (count < limite) {
        // Nuevo día, aún tiene vigencia → reactivar
        promesas.push(
          apiPost('publicidad.php?accion=actualizar', { id: p.id, estado: 'activa' })
            .then(() => { p.estado = 'activa'; })
            .catch(e => console.warn('reactivar fallo:', e))
        );
      }
    }
  }

  if (promesas.length) await Promise.allSettled(promesas);
}

// ── Render ────────────────────────────────────────────────
function renderLista() {
  if (!publicidades.length) {
    el('pubLista').innerHTML = '<p class="vacio-txt">No hay publicidades aún. Crea la primera con el botón de arriba.</p>';
    return;
  }
  const hoy = new Date().toISOString().split('T')[0];
  el('pubLista').innerHTML = `<div class="pub-grid">${publicidades.map(p => {
    const vigente = p.fecha_inicio <= hoy && p.fecha_fin >= hoy;
    const cupo    = p.limite_diario;
    const usado   = p._hoy_count;
    const agotada = cupo > 0 && usado >= cupo;

    let badge;
    if (p.estado === 'pausada_auto' || agotada) {
      badge = `<span class="badge badge-agotada">⏰ Cupo agotado hoy</span>`;
    } else if (p.estado === 'pausada') {
      badge = `<span class="badge badge-pausada">⏸ Pausada</span>`;
    } else if (p.estado === 'inactiva') {
      badge = `<span class="badge badge-vencida">🚫 Inactiva</span>`;
    } else if (!vigente) {
      badge = `<span class="badge badge-vencida">⏰ Vencida</span>`;
    } else {
      badge = `<span class="badge badge-activa">✅ Activa</span>`;
    }

    const imgHtml = p.imagen_url
      ? `<img class="pub-card-img" src="${p.imagen_url}" alt="${p.titulo||''}" loading="lazy"
             onerror="this.parentElement.innerHTML='<div class=pub-card-img-placeholder>🖼</div>';">`
      : `<div class="pub-card-img-placeholder">🖼</div>`;

    const pct      = cupo > 0 ? Math.min(100, Math.round((usado / cupo) * 100)) : 0;
    const urlCorta = p.url_destino ? p.url_destino.replace(/^https?:\/\//, '') : '';

    const esGestionable = vigente && p.estado !== 'inactiva';
    const btnPausar = esGestionable ? `
      <button class="btn-tabla" onclick="pausarToggle('${p.id}')"
        style="background:${p.estado==='pausada'?'var(--verde-claro,#f0faf4)':'var(--fondo,#f9fafb)'}">
        ${p.estado === 'pausada' ? '▶️ Activar' : '⏸ Pausar'}
      </button>` : '';

    return `<div class="pub-card">
      ${imgHtml}
      <div class="pub-card-body">
        <div class="pub-card-titulo" title="${p.titulo||''}">${p.titulo || '(sin título)'}</div>
        <div class="pub-card-meta">
          ${badge}
          <span>📅 ${p.fecha_inicio} → ${p.fecha_fin}</span>
          <span>🔁 Máx <strong>${cupo}</strong>/día</span>
          ${urlCorta ? `<span>🔗 <a href="${p.url_destino}" target="_blank" rel="noopener"
            style="color:var(--verde);text-decoration:none;display:inline-block;max-width:170px;
                   overflow:hidden;text-overflow:ellipsis;white-space:nowrap;vertical-align:bottom"
            title="${p.url_destino}">${urlCorta}</a></span>` : ''}
        </div>
        <div style="margin-bottom:.75rem">
          <div class="vistas-label">
            <span>Hoy: <strong>${usado}</strong> / ${cupo}</span>
            <span>${pct}%${agotada ? " — <em style='color:#9a3412'>se reanuda mañana</em>" : ''}</span>
          </div>
          <div class="vistas-bar">
            <div class="vistas-bar-fill"
                 style="width:${pct}%;background:${agotada?'#f97316':'var(--verde,#1a6b3c)'}"></div>
          </div>
        </div>
        <div class="pub-card-acciones">
          <button class="btn-tabla btn-editar" onclick="editarPub('${p.id}')">✏️ Editar</button>
          ${btnPausar}
          <button class="btn-tabla btn-eliminar" onclick="pedirEliminar('${p.id}')">🗑</button>
        </div>
      </div>
    </div>`;
  }).join('')}</div>`;
}

// ── Modal ─────────────────────────────────────────────────
el('btnNueva').addEventListener('click', () => abrirModal());

function abrirModal(pub = null) {
  const esEd = !!pub;
  el('modalTitulo').textContent  = esEd ? '✏️ Editar publicidad' : '📢 Nueva publicidad';
  el('pubId').value              = pub?.id            || '';
  el('fTitulo').value            = pub?.titulo        || '';
  el('fUrl').value               = pub?.url_destino   || '';
  el('fFechaInicio').value       = pub?.fecha_inicio  || new Date().toISOString().split('T')[0];
  el('fFechaFin').value          = pub?.fecha_fin     || '';
  el('fLimiteDiario').value      = pub?.limite_diario ?? 50;
  // En edición mostrar solo activa/pausada en el select
  el('fEstado').value            = ['activa','pausada'].includes(pub?.estado) ? pub.estado : 'activa';

  const fPlan = el('fPlan');
  if (fPlan) fPlan.value = '';
  const resumen = el('planResumen');
  if (resumen) resumen.style.display = 'none';

  if (pub?.imagen_url) {
    el('campoUrlActual').style.display = 'block';
    el('imgActual').src = pub.imagen_url;
  } else {
    el('campoUrlActual').style.display = 'none';
    el('imgActual').src = '';
  }
  archivoImg = null;
  el('fImgFile').value = '';
  el('imgNombre').textContent = esEd ? 'Deja vacío para mantener imagen actual' : 'Sin imagen seleccionada';
  el('imgPreviewWrap').style.display = 'none';
  el('msgErrorModal').classList.remove('visible');
  el('modalOverlay').classList.add('visible');
}

el('btnCancelar').addEventListener('click', () => el('modalOverlay').classList.remove('visible'));
el('modalOverlay').addEventListener('click', e => {
  if (e.target === el('modalOverlay')) el('modalOverlay').classList.remove('visible');
});

// ── Imagen ────────────────────────────────────────────────
el('btnElegirImg').addEventListener('click', () => el('fImgFile').click());
el('fImgFile').addEventListener('change', () => {
  const file = el('fImgFile').files[0];
  if (!file) return;
  if (file.size > 3*1024*1024) { setErrorModal('La imagen no puede superar 3 MB.'); el('fImgFile').value = ''; return; }
  archivoImg = file;
  el('imgNombre').textContent = `${file.name} · ${(file.size/1024).toFixed(0)} KB`;
  const r = new FileReader();
  r.onload = ev => { el('imgPreview').src = ev.target.result; el('imgPreviewWrap').style.display = 'block'; };
  r.readAsDataURL(file);
});

// ── Guardar ───────────────────────────────────────────────
el('btnGuardar').addEventListener('click', async () => {
  const id      = el('pubId').value.trim();
  const titulo  = el('fTitulo').value.trim();
  const urlDest = el('fUrl').value.trim();
  const inicio  = el('fFechaInicio').value;
  const fin     = el('fFechaFin').value;
  const limite  = Math.max(1, parseInt(el('fLimiteDiario').value, 10) || 50);
  const estado  = el('fEstado').value;

  if (!inicio || !fin)   { setErrorModal('Las fechas son obligatorias.'); return; }
  if (fin < inicio)       { setErrorModal('La fecha de fin debe ser posterior al inicio.'); return; }
  if (!id && !archivoImg) { setErrorModal('Debes seleccionar una imagen.'); return; }
  if (urlDest) {
    try { const u = new URL(urlDest); if (!['http:','https:'].includes(u.protocol)) throw 0; }
    catch { setErrorModal('URL de destino no válida. Debe empezar con https://'); return; }
  }

  const btn = el('btnGuardar');
  btnCargando(btn, true);
  el('msgErrorModal').classList.remove('visible');

  try {
    let imagen_url = el('imgActual').src || '';
    if (archivoImg) imagen_url = await subirCloudinary(archivoImg);

    const params = {
      titulo, imagen_url, url_destino: urlDest,
      fecha_inicio: inicio, fecha_fin: fin,
      limite_diario: limite, estado,
    };

    if (id) {
      await apiPost('publicidad.php?accion=actualizar', { id, ...params });
    } else {
      await apiPost('publicidad.php?accion=crear', params);
    }
    el('modalOverlay').classList.remove('visible');
    mostrarOk(id ? '✓ Publicidad actualizada.' : '✓ Publicidad creada.');
    await cargarPublicidades();
  } catch(e) {
    console.error(e);
    setErrorModal('Error al guardar: ' + (e.message || 'intenta de nuevo.'));
  } finally { btnCargando(btn, false); }
});

// ── Editar ────────────────────────────────────────────────
window.editarPub = id => {
  const p = publicidades.find(x => String(x.id) === String(id));
  if (p) abrirModal(p);
};

// ── Pausar / activar ──────────────────────────────────────
window.pausarToggle = async id => {
  const p = publicidades.find(x => String(x.id) === String(id));
  if (!p) return;

  if (p.estado === 'pausada_auto') {
    mostrarError('Esta campaña se pausó automáticamente por alcanzar el cupo diario. Se reactivará sola mañana si aún está en vigencia.');
    return;
  }

  const nuevo = p.estado === 'pausada' ? 'activa' : 'pausada';
  try {
    await apiPost('publicidad.php?accion=actualizar', { id, estado: nuevo });
    mostrarOk(`✓ Publicidad ${nuevo === 'activa' ? 'activada' : 'pausada'}.`);
    await cargarPublicidades();
  } catch(e) { console.error(e); mostrarError('Error al cambiar estado.'); }
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
    await apiPost('publicidad.php?accion=eliminar', { id: eliminarId });
    el('modalEliminarOverlay').classList.remove('visible');
    eliminarId = null;
    mostrarOk('✓ Publicidad eliminada.');
    await cargarPublicidades();
  } catch(e) { console.error(e); mostrarError('Error al eliminar.'); }
  finally { btnCargando(btn, false); }
});

// ── Cloudinary ────────────────────────────────────────────
async function subirCloudinary(file) {
  const fd = new FormData();
  fd.append('file', file);
  fd.append('upload_preset', UPLOAD_PRESET);
  fd.append('folder', PUB_FOLDER);
  const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`, { method: 'POST', body: fd });
  const d   = await res.json();
  if (!res.ok) throw new Error(d.error?.message || 'Error Cloudinary');
  return d.secure_url;
}

// ── Mensajes ──────────────────────────────────────────────
function setErrorModal(m) {
  el('textoErrorModal').textContent = m;
  el('msgErrorModal').classList.add('visible');
}
function mostrarOk(m) {
  el('textoOk').textContent = m;
  el('msgOk').classList.add('visible');
  el('msgError').classList.remove('visible');
  setTimeout(() => el('msgOk').classList.remove('visible'), 4500);
}
function mostrarError(m) {
  el('textoError').textContent = m;
  el('msgError').classList.add('visible');
  el('msgOk').classList.remove('visible');
}

cargarPublicidades();