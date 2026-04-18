// ============================================================
//  gistore/js/foro.js — Foro público de GI Store
// ============================================================

// ── Rutas ─────────────────────────────────────────────────
const isGH      = window.location.hostname.includes('github.io');
const BASE      = isGH ? '/gistore' : '';
const FORO_PHP  = `${BASE}/php/foro.php`;
const TOKEN_PHP = `${BASE}/backend/tokens.php`;
const SESION_PHP= `${BASE}/backend/sesion.php`;

// ── Token CSRF ─────────────────────────────────────────────
let _token = null;
async function getToken() {
  if (_token) return _token;
  try {
    const r = await fetch(TOKEN_PHP, { credentials: 'include' });
    const d = await r.json();
    if (d.ok && d.token) {
      _token = d.token;
      return _token;
    }
    throw new Error('No se pudo obtener token');
  } catch (e) {
    console.error('Error obteniendo token:', e);
    return null;
  }
}

// ── Fetch helpers ──────────────────────────────────────────
async function apiGet(accion, params = {}) {
  const token = await getToken();
  const qs = new URLSearchParams({ accion, ...params }).toString();
  try {
    const r = await fetch(`${FORO_PHP}?${qs}`, { credentials: 'include' });
    if (!r.ok) {
      const errorText = await r.text();
      console.error(`Error ${r.status}:`, errorText);
      throw new Error(`HTTP ${r.status}`);
    }
    return r.json();
  } catch (e) {
    console.error('apiGet error:', e);
    throw e;
  }
}

async function apiPost(accion, datos = {}) {
  const token = await getToken();
  if (!token) throw new Error('No se pudo obtener token CSRF');

  const body = new URLSearchParams({ token, accion, ...datos });

  try {
    const r = await fetch(FORO_PHP, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });

    // Token expirado → renovar y reintentar
    if (r.status === 403) {
      _token = null;
      const t2 = await getToken();
      if (!t2) throw new Error('Token inválido o expirado');
      body.set('token', t2);
      const r2 = await fetch(FORO_PHP, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body.toString(),
      });
      return r2.json();
    }

    if (!r.ok) {
      const txt = await r.text();
      console.error(`apiPost ${r.status}:`, txt);
      throw new Error(`HTTP ${r.status}`);
    }

    return r.json();
  } catch (e) {
    console.error('apiPost error:', e);
    throw e;
  }
}

// ── Estado global ──────────────────────────────────────────
let usuario        = null;
let hilos          = [];
let hilosFiltrados = [];
let paginaActual   = 1;
const POR_PAGINA   = 10;
let hiloAbierto    = null;

// ── DOM helper ─────────────────────────────────────────────
const el = id => document.getElementById(id);

// ── Formato de fecha ───────────────────────────────────────
function fmtFecha(iso) {
  if (!iso) return '';
  const d    = new Date(iso);
  const diff = (Date.now() - d) / 1000;
  if (diff < 60)    return 'hace un momento';
  if (diff < 3600)  return `hace ${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `hace ${Math.floor(diff / 3600)} h`;
  return d.toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' });
}

// ── Escape HTML ────────────────────────────────────────────
function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// ── Toasts ─────────────────────────────────────────────────
function toast(tipo, msg) {
  const t = el(tipo === 'ok' ? 'foroMsgOk' : 'foroMsgError');
  if (!t) return;
  t.textContent = (tipo === 'ok' ? '✓ ' : '⚠ ') + msg;
  t.classList.add('visible');
  clearTimeout(t._t);
  t._t = setTimeout(() => t.classList.remove('visible'), tipo === 'ok' ? 4000 : 5000);
}
const toastOk  = m => toast('ok',    m);
const toastErr = m => toast('error', m);

// ── Modal de confirmación ──────────────────────────────────
function confirmar({ icono = '🗑', titulo = '¿Confirmar?', msg = '', btnOk = 'Eliminar' } = {}) {
  return new Promise(resolve => {
    const modalIcono  = el('modalConfirmIcono');
    const modalTitulo = el('modalConfirmTitulo');
    const modalMsg    = el('modalConfirmMsg');
    const btnOkEl     = el('btnModalConfirmOk');
    const btnCancel   = el('btnModalConfirmCancel');
    const modal       = el('modalConfirmForo');

    if (modalIcono)  modalIcono.textContent  = icono;
    if (modalTitulo) modalTitulo.textContent  = titulo;
    if (modalMsg)    modalMsg.textContent     = msg;
    if (btnOkEl)     btnOkEl.textContent      = btnOk;
    if (modal)       modal.classList.add('visible');

    const cerrar = ok => {
      if (modal) modal.classList.remove('visible');
      resolve(ok);
    };

    if (btnOkEl)   btnOkEl.addEventListener('click',   () => cerrar(true),  { once: true });
    if (btnCancel) btnCancel.addEventListener('click',  () => cerrar(false), { once: true });
    if (modal) {
      modal.addEventListener('click', e => {
        if (e.target === modal) cerrar(false);
      }, { once: true });
    }
  });
}

// ── Verificar sesión ───────────────────────────────────────
async function verificarSesion() {
  try {
    // 'user' cubre tanto vendedores (rol=2) como admin (rol=1)
    const qs = new URLSearchParams({ accion: 'verificar', ac: 'foro' }).toString();
    const r  = await fetch(`${SESION_PHP}?${qs}`, { credentials: 'include' });

    const btnNueva    = el('btnNuevaPregunta');
    const avisoLogin  = el('avisoLogin');
    const nombreSesion= el('nombreSesion');

    // Sin sesión → modo lectura
    if (r.status === 401 || r.status === 403) {
      usuario = null;
      if (btnNueva)   btnNueva.style.display   = 'none';
      if (avisoLogin) avisoLogin.style.display  = 'none';
      return;
    }

    if (!r.ok) { usuario = null; return; }

    const d = await r.json();
    if (!d.ok) { usuario = null; return; }

    const rol     = parseInt(d.datos.rol) || 0;
    const esAdmin = rol === 1;

    // Nombre a mostrar
    let nombre = 'Usuario';
    if (esAdmin) {
      nombre = 'Administrador';
    } else if (d.datos.correo) {
      nombre = d.datos.correo.split('@')[0];
    }

    usuario = {
      id:      String(d.datos.usuario_id),
      nombre,
      rol,
      esAdmin,
    };

    // Mostrar bienvenida y botón
    if (btnNueva)    btnNueva.style.display    = 'inline-flex';
    if (avisoLogin)  avisoLogin.style.display  = 'block';
    if (nombreSesion) nombreSesion.textContent = nombre;

  } catch (e) {
    console.warn('foro: verificarSesion error', e);
    usuario = null;
  }
}

// ── Cargar hilos ───────────────────────────────────────────
async function cargarHilos() {
  try {
    const res = await apiGet('obtener_hilos');
    if (!res.ok) throw new Error(res.error || 'Error al cargar hilos');
    hilos = res.datos || [];
    aplicarFiltro();
  } catch (e) {
    console.error('foro: cargarHilos', e);
    const listaHilos = el('listaHilos');
    if (listaHilos) {
      listaHilos.innerHTML =
        `<div class="foro-vacio"><span style="font-size:2rem">⚠️</span><p>Error al cargar el foro: ${e.message}</p></div>`;
    }
  }
}

// ── Filtro ─────────────────────────────────────────────────
function nor(t) { return (t || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, ''); }

function aplicarFiltro() {
  const busqForo = el('busqForo');
  const txt = nor(busqForo ? busqForo.value : '');
  hilosFiltrados = txt
    ? hilos.filter(h => nor(h.titulo).includes(txt) || nor(h.contenido || '').includes(txt))
    : [...hilos];
  paginaActual = 1;
  renderHilos();
}

// ── Render lista de hilos ──────────────────────────────────
function renderHilos() {
  const inicio     = (paginaActual - 1) * POR_PAGINA;
  const pagina     = hilosFiltrados.slice(inicio, inicio + POR_PAGINA);
  const totalPags  = Math.ceil(hilosFiltrados.length / POR_PAGINA) || 1;
  const listaHilos = el('listaHilos');
  const foroPaginado = el('foroPaginado');

  if (!listaHilos) return;

  if (!hilosFiltrados.length) {
    listaHilos.innerHTML =
      `<div class="foro-vacio"><span style="font-size:2.5rem">🔍</span><p>No hay hilos aún. ¡Sé el primero en preguntar!</p></div>`;
    if (foroPaginado) foroPaginado.innerHTML = '';
    return;
  }

  listaHilos.innerHTML = pagina.map(h => `
    <div class="hilo-card">
      <div class="hilo-header">
        <div class="hilo-avatar" style="background:${h.autor_color || '#1a6b3c'}">
          ${h.autor_foto
            ? `<img src="${h.autor_foto}" alt="${escapeHtml(h.autor_nombre)}" onerror="this.style.display='none'">`
            : (h.autor_nombre || '?')[0].toUpperCase()}
        </div>
        <div class="hilo-meta">
          <div class="hilo-autor">${escapeHtml(h.autor_nombre || 'Vendedor')}</div>
          <div class="hilo-fecha">${fmtFecha(h.creado_en)}</div>
        </div>
        ${usuario?.esAdmin ? `
          <button class="btn-resp-accion eliminar" style="margin-left:auto"
            onclick="eliminarHilo('${h.id}')">🗑</button>` : ''}
      </div>
      <div class="hilo-titulo">${escapeHtml(h.titulo || '')}</div>
      ${h.contenido ? `<div class="hilo-cuerpo" style="white-space:pre-wrap">${escapeHtml(h.contenido)}</div>` : ''}
      <div class="hilo-footer">
        <div class="hilo-stats">
          <span>💬 ${h.respuestas || 0} respuesta${(h.respuestas || 0) !== 1 ? 's' : ''}</span>
        </div>
        <button class="btn-ver-hilo" onclick="abrirHilo('${h.id}')">Ver hilo →</button>
      </div>
    </div>`).join('');

  if (foroPaginado) {
    let pagHtml = '';
    for (let i = 1; i <= totalPags; i++) {
      pagHtml += `<button class="pag-btn${i === paginaActual ? ' activo' : ''}"
        onclick="irPagina(${i})">${i}</button>`;
    }
    foroPaginado.innerHTML = pagHtml;
  }
}

window.irPagina = p => {
  paginaActual = p;
  renderHilos();
  window.scrollTo({ top: 0, behavior: 'smooth' });
};

// ── Abrir hilo ─────────────────────────────────────────────
window.abrirHilo = async hiloId => {
  hiloAbierto = hilos.find(h => h.id === hiloId) || null;
  if (!hiloAbierto) return;

  const modalHiloTitulo = el('modalHiloTitulo');
  const modalHiloCuerpo = el('modalHiloCuerpo');
  const modalHiloFooter = el('modalHiloFooter');
  const modalHilo       = el('modalHilo');

  if (modalHiloTitulo) modalHiloTitulo.textContent = hiloAbierto.titulo || '';

  if (modalHiloCuerpo) {
    modalHiloCuerpo.innerHTML = `
      <div style="margin-bottom:1.25rem;padding-bottom:1.25rem;border-bottom:2px solid var(--borde,#e5e7eb)">
        <div style="display:flex;gap:.75rem;align-items:flex-start">
          <div class="hilo-avatar" style="background:${hiloAbierto.autor_color || '#1a6b3c'}">
            ${hiloAbierto.autor_foto
              ? `<img src="${hiloAbierto.autor_foto}" onerror="this.style.display='none'">`
              : (hiloAbierto.autor_nombre || '?')[0].toUpperCase()}
          </div>
          <div>
            <div class="hilo-autor">${escapeHtml(hiloAbierto.autor_nombre || 'Vendedor')}</div>
            <div class="hilo-fecha">${fmtFecha(hiloAbierto.creado_en)}</div>
          </div>
        </div>
        ${hiloAbierto.contenido
          ? `<p style="margin-top:.85rem;font-size:.9rem;color:var(--gris-700,#374151);line-height:1.6;white-space:pre-wrap">${escapeHtml(hiloAbierto.contenido)}</p>`
          : ''}
      </div>
      <div id="listaRespuestas">
        <p style="color:var(--gris-500);font-size:.85rem">Cargando respuestas…</p>
      </div>`;
  }

  if (modalHiloFooter) {
    modalHiloFooter.innerHTML = usuario
      ? `<div class="caja-respuesta">
          <textarea id="txtRespuesta" placeholder="Escribe tu respuesta…" maxlength="1200"></textarea>
          <div class="caja-respuesta-footer">
            <button class="btn-verde" id="btnResponder">Responder</button>
          </div>
         </div>`
      : `<div class="login-aviso">
          <a href="../user/index.html">Inicia sesión</a> como vendedor para responder.
         </div>`;
  }

  if (usuario) {
    const btnResponder = el('btnResponder');
    if (btnResponder) {
      const newBtn = btnResponder.cloneNode(true);
      btnResponder.parentNode.replaceChild(newBtn, btnResponder);
      newBtn.addEventListener('click', () => publicarRespuesta(hiloId));
    }
  }

  if (modalHilo) modalHilo.classList.add('visible');
  await cargarRespuestas(hiloId);
};

// ── Cargar respuestas ──────────────────────────────────────
async function cargarRespuestas(hiloId) {
  try {
    const res = await apiGet('obtener_respuestas', { hilo_id: hiloId });
    if (!res.ok) throw new Error(res.error);
    renderRespuestas(res.datos || [], hiloId);
  } catch (e) {
    console.error('foro: cargarRespuestas', e);
    const listaRespuestas = el('listaRespuestas');
    if (listaRespuestas) {
      listaRespuestas.innerHTML =
        `<p style="color:var(--gris-500);font-size:.85rem">Error al cargar respuestas: ${e.message}</p>`;
    }
  }
}

function renderRespuestas(resps, hiloId) {
  const cont = el('listaRespuestas');
  if (!cont) return;

  if (!resps.length) {
    cont.innerHTML =
      `<p style="color:var(--gris-500);font-size:.85rem;text-align:center;padding:1rem 0">Sin respuestas aún. ¡Sé el primero!</p>`;
    return;
  }

  const ahora = Date.now();
  cont.innerHTML = resps.map(r => {
    const esMio       = usuario && String(r.usuario_id) === usuario.id;
    const esAdmin     = usuario?.esAdmin;
    const creadoMs    = new Date(r.creado_en).getTime();
    const puedoEditar = esMio && (ahora - creadoMs) < 30 * 60 * 1000;
    const puedoElim   = esMio || esAdmin;

    return `
    <div class="respuesta-item" id="resp-${r.id}">
      <div class="resp-avatar" style="background:${r.autor_color || '#1a6b3c'}">
        ${r.autor_foto
          ? `<img src="${r.autor_foto}" onerror="this.style.display='none'">`
          : (r.autor_nombre || '?')[0].toUpperCase()}
      </div>
      <div class="resp-body">
        <div style="display:flex;align-items:center;gap:.5rem;flex-wrap:wrap">
          <span class="resp-autor">${escapeHtml(r.autor_nombre || 'Vendedor')}</span>
          <span class="resp-fecha">${fmtFecha(r.creado_en)}</span>
        </div>
        <div class="resp-texto" id="rtexto-${r.id}" style="white-space:pre-wrap">${escapeHtml(r.contenido || '')}</div>
        ${(puedoEditar || puedoElim) ? `
        <div class="resp-acciones">
          ${puedoEditar ? `<button class="btn-resp-accion" onclick="editarResp('${r.id}','${hiloId}')">✏️ Editar</button>` : ''}
          ${puedoElim   ? `<button class="btn-resp-accion eliminar" onclick="eliminarResp('${r.id}','${hiloId}')">🗑 Eliminar</button>` : ''}
        </div>` : ''}
      </div>
    </div>`;
  }).join('');
}

// ── Publicar respuesta ─────────────────────────────────────
async function publicarRespuesta(hiloId) {
  if (!usuario) return;
  const txtRespuesta = el('txtRespuesta');
  const txt = (txtRespuesta?.value || '').trim();
  if (!txt) { toastErr('Escribe tu respuesta primero.'); return; }

  const btn = el('btnResponder');
  if (btn) btn.disabled = true;

  try {
    const res = await apiPost('crear_respuesta', { hilo_id: hiloId, texto: txt });
    if (!res.ok) { toastErr(res.error || 'Error al publicar.'); return; }

    if (txtRespuesta) txtRespuesta.value = '';
    const h = hilos.find(x => x.id === hiloId);
    if (h) h.respuestas = (h.respuestas || 0) + 1;
    renderHilos();
    await cargarRespuestas(hiloId);
    toastOk('Respuesta publicada.');
  } catch (e) {
    console.error(e);
    toastErr('Error de conexión.');
  } finally {
    if (btn) btn.disabled = false;
  }
}

// ── Editar respuesta ───────────────────────────────────────
window.editarResp = (respId, hiloId) => {
  const textoEl = el(`rtexto-${respId}`);
  if (!textoEl) return;
  const actual = textoEl.textContent.trim();
  textoEl.innerHTML = `
    <textarea style="width:100%;min-height:70px;border:1.5px solid var(--verde,#1a6b3c);
      border-radius:8px;padding:.5rem;font-size:.88rem;font-family:inherit;box-sizing:border-box"
      id="edit-${respId}">${escapeHtml(actual)}</textarea>
    <div style="display:flex;gap:.5rem;margin-top:.4rem;justify-content:flex-end">
      <button onclick="cancelarEdicion('${respId}','${hiloId}')" class="btn-gris"
        style="font-size:.78rem;padding:.3rem .7rem">Cancelar</button>
      <button onclick="guardarEdicion('${respId}','${hiloId}')" class="btn-verde"
        style="font-size:.78rem;padding:.3rem .7rem">Guardar</button>
    </div>`;
};

window.cancelarEdicion = (respId, hiloId) => {
  if (hiloAbierto) cargarRespuestas(hiloAbierto.id);
};

window.guardarEdicion = async (respId, hiloId) => {
  const editEl     = el(`edit-${respId}`);
  const nuevoTexto = (editEl?.value || '').trim();
  if (!nuevoTexto) { toastErr('El texto no puede estar vacío.'); return; }

  try {
    const res = await apiPost('editar_respuesta', { resp_id: respId, texto: nuevoTexto });
    if (!res.ok) { toastErr(res.error || 'Error al guardar.'); return; }
    await cargarRespuestas(hiloId);
    toastOk('Respuesta actualizada.');
  } catch (e) {
    console.error(e);
    toastErr('Error de conexión.');
  }
};

// ── Eliminar respuesta ─────────────────────────────────────
window.eliminarResp = async (respId, hiloId) => {
  const ok = await confirmar({
    icono: '🗑', titulo: '¿Eliminar respuesta?',
    msg: 'Esta respuesta será eliminada permanentemente.', btnOk: 'Sí, eliminar',
  });
  if (!ok) return;

  try {
    const res = await apiPost('eliminar_respuesta', { resp_id: respId, hilo_id: hiloId });
    if (!res.ok) { toastErr(res.error || 'Error al eliminar.'); return; }
    const respEl = el(`resp-${respId}`);
    if (respEl) respEl.remove();
    const h = hilos.find(x => x.id === hiloId);
    if (h) { h.respuestas = Math.max(0, (h.respuestas || 0) - 1); renderHilos(); }
    toastOk('Respuesta eliminada.');
  } catch (e) {
    console.error(e);
    toastErr('Error de conexión.');
  }
};

// ── Eliminar hilo ──────────────────────────────────────────
window.eliminarHilo = async hiloId => {
  const ok = await confirmar({
    icono: '🗑', titulo: '¿Eliminar hilo completo?',
    msg: 'Se eliminarán el hilo y todas sus respuestas.', btnOk: 'Sí, eliminar',
  });
  if (!ok) return;

  try {
    const res = await apiPost('eliminar_hilo', { hilo_id: hiloId });
    if (!res.ok) { toastErr(res.error || 'Error al eliminar.'); return; }
    hilos = hilos.filter(h => h.id !== hiloId);
    aplicarFiltro();
    toastOk('Hilo eliminado.');
  } catch (e) {
    console.error(e);
    toastErr('Error de conexión.');
  }
};

// ── Modal nueva pregunta ───────────────────────────────────
const btnNuevaPregunta = el('btnNuevaPregunta');
if (btnNuevaPregunta) {
  btnNuevaPregunta.addEventListener('click', () => {
    if (!usuario) {
      toastErr('Debes iniciar sesión para publicar una pregunta.');
      return;
    }
    // Limpiar campos antes de abrir
    const fForoTitulo   = el('fForoTitulo');
    const fForoCuerpo   = el('fForoCuerpo');
    const modalPregunta = el('modalPregunta');
    if (fForoTitulo)   fForoTitulo.value   = '';
    if (fForoCuerpo)   fForoCuerpo.value   = '';
    if (modalPregunta) modalPregunta.classList.add('visible');
  });
}

const btnCancelarPregunta = el('btnCancelarPregunta');
if (btnCancelarPregunta) {
  btnCancelarPregunta.addEventListener('click', () => {
    el('modalPregunta')?.classList.remove('visible');
  });
}

const modalPreguntaOverlay = el('modalPregunta');
if (modalPreguntaOverlay) {
  modalPreguntaOverlay.addEventListener('click', e => {
    if (e.target === modalPreguntaOverlay) modalPreguntaOverlay.classList.remove('visible');
  });
}

// ── Publicar nueva pregunta ────────────────────────────────
const btnPublicarPregunta = el('btnPublicarPregunta');
if (btnPublicarPregunta) {
  btnPublicarPregunta.addEventListener('click', async () => {
    if (!usuario) { toastErr('Debes iniciar sesión.'); return; }

    // Leer los valores EN EL MOMENTO del click (no antes)
    const fForoTitulo = el('fForoTitulo');
    const fForoCuerpo = el('fForoCuerpo');

    const titulo  = (fForoTitulo?.value  || '').trim();
    const cuerpo  = (fForoCuerpo?.value  || '').trim();


    if (!titulo) { toastErr('El título es obligatorio.'); return; }
    if (titulo.length > 140) { toastErr('El título es demasiado largo (máx. 140 caracteres).'); return; }

    btnPublicarPregunta.disabled = true;

    try {
      // Enviar titulo y cuerpo (cuerpo puede estar vacío, el PHP acepta string vacío)
      const res = await apiPost('crear_hilo', { titulo, cuerpo });

      if (!res.ok) {
        toastErr(res.error || 'Error al publicar.');
        return;
      }

      el('modalPregunta')?.classList.remove('visible');
      await cargarHilos();
      toastOk('Pregunta publicada correctamente.');

    } catch (e) {
      console.error('Error publicando pregunta:', e);
      toastErr('Error de conexión: ' + e.message);
    } finally {
      btnPublicarPregunta.disabled = false;
    }
  });
}

// ── Cerrar modal hilo ──────────────────────────────────────
const btnCerrarHilo = el('btnCerrarHilo');
if (btnCerrarHilo) {
  btnCerrarHilo.addEventListener('click', () => {
    el('modalHilo')?.classList.remove('visible');
    hiloAbierto = null;
  });
}

const modalHiloOverlay = el('modalHilo');
if (modalHiloOverlay) {
  modalHiloOverlay.addEventListener('click', e => {
    if (e.target === modalHiloOverlay) {
      modalHiloOverlay.classList.remove('visible');
      hiloAbierto = null;
    }
  });
}

// ── Búsqueda ───────────────────────────────────────────────
const busqForoInput = el('busqForo');
if (busqForoInput) busqForoInput.addEventListener('input', aplicarFiltro);

// ── Init ───────────────────────────────────────────────────
(async () => {
  try {
    await getToken();
    await Promise.all([verificarSesion(), cargarHilos()]);
  } catch (e) {
    console.error('foro: init', e);
  }
})();