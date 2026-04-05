// ============================================================
//  user/js/audios-banco.js
//  Banco de música royalty-free — Powered by Jamendo
//  Se integra con el generador de videos (videos.js)
//  Instrucciones:
//    1. Agrega <script src="../js/audios-banco.js"></script> en videos.html
//       ANTES del script de videos.js
//    2. Agrega el contenedor #vidAudioBanco en el HTML (ver snippet)
// ============================================================

'use strict';

// ── Config ────────────────────────────────────────────────
const API_AUDIOS = '../backend/audios.php';

// ── Estado interno del banco ──────────────────────────────
const _banco = {
  visible      : false,
  pagina       : 1,
  totalPags    : 1,
  cargando     : false,
  query        : 'background instrumental',
  genero       : '',
  resultados   : [],
  audioActivo  : null,   // { id, titulo, url } seleccionado
  previewAudio : null,   // HTMLAudioElement para preview
};

// ── Exponer la pista activa al módulo de videos.js ────────
//    videos.js lee window._audiosBancoActivo.url al grabar
window._audiosBancoActivo = null;

// ══════════════════════════════════════════════════════════
//  INSERTAR UI DEL BANCO EN EL DOM
//  Llama a initBancoAudios() desde init() en videos.js
// ══════════════════════════════════════════════════════════
function initBancoAudios(getTokenFn) {
  _banco.getToken = getTokenFn;   // referencia al getToken() de videos.js

  const contenedor = document.getElementById('vidAudioBanco');
  if (!contenedor) return;

  contenedor.innerHTML = _renderBancoHTML();
  _bindEventos();
  _buscar();   // cargar populares al abrir
}

// ── HTML estático del panel ───────────────────────────────
function _renderBancoHTML() {
  return `
  <!-- Botón para abrir/cerrar el banco -->
  <button class="vab-toggle" id="vabToggle" type="button">
    <span class="material-symbols-outlined">library_music</span>
    <span class="vab-toggle-txt">Explorar banco de música</span>
    <span class="material-symbols-outlined vab-chevron" id="vabChevron">expand_more</span>
  </button>

  <!-- Panel expandible -->
  <div class="vab-panel" id="vabPanel" style="display:none">

    <!-- Buscador -->
    <div class="vab-busqueda">
      <div class="vab-search-wrap">
        <span class="material-symbols-outlined vab-search-ico">search</span>
        <input class="vab-input" id="vabQuery" type="text"
               placeholder="Buscar música… ej: tropical, jazz, corporate"
               value="background instrumental">
        <button class="vab-btn-buscar" id="vabBtnBuscar" type="button">
          <span class="material-symbols-outlined">arrow_forward</span>
        </button>
      </div>

      <!-- Filtros género -->
      <div class="vab-filtros" id="vabGeneros">
        <button class="vab-chip activo" data-genero="">🎵 Todos</button>
        <button class="vab-chip" data-genero="corporate">💼 Corporativo</button>
        <button class="vab-chip" data-genero="pop">🎤 Pop</button>
        <button class="vab-chip" data-genero="electronic">⚡ Electrónico</button>
        <button class="vab-chip" data-genero="jazz">🎷 Jazz</button>
        <button class="vab-chip" data-genero="ambient">🌊 Ambient</button>
        <button class="vab-chip" data-genero="latin">💃 Latino</button>
        <button class="vab-chip" data-genero="motivational">🚀 Motivacional</button>
        <button class="vab-chip" data-genero="classical">🎻 Clásico</button>
        <button class="vab-chip" data-genero="rock">🎸 Rock</button>
      </div>
    </div>

    <!-- Lista de resultados -->
    <div class="vab-lista" id="vabLista">
      <!-- JS llena aquí -->
    </div>

    <!-- Paginación -->
    <div class="vab-paginacion" id="vabPaginacion" style="display:none">
      <button class="vab-btn-pag" id="vabBtnAnterior" type="button">
        <span class="material-symbols-outlined">chevron_left</span> Anterior
      </button>
      <span class="vab-pag-info" id="vabPagInfo">Pág 1</span>
      <button class="vab-btn-pag" id="vabBtnSiguiente" type="button">
        Siguiente <span class="material-symbols-outlined">chevron_right</span>
      </button>
    </div>

    <!-- Créditos Jamendo (requerido por sus TOS) -->
    <p class="vab-creditos">
      🎵 Música royalty-free sin copyright · Powered by
      <a href="https://jamendo.com/" target="_blank" rel="noopener">Jamendo</a>
    </p>
  </div>

  <!-- Pista activa seleccionada -->
  <div class="vab-activa" id="vabActiva" style="display:none">
    <span class="material-symbols-outlined" style="color:var(--primario,#34d399)">music_note</span>
    <span class="vab-activa-titulo" id="vabActivaTitulo">—</span>
    <button class="vab-btn-quitar" id="vabBtnQuitar" type="button" title="Quitar música">
      <span class="material-symbols-outlined">close</span>
    </button>
  </div>
  `;
}

// ── Eventos ───────────────────────────────────────────────
function _bindEventos() {
  // Toggle panel
  document.getElementById('vabToggle').addEventListener('click', () => {
    _banco.visible = !_banco.visible;
    document.getElementById('vabPanel').style.display = _banco.visible ? 'block' : 'none';
    document.getElementById('vabChevron').textContent  = _banco.visible ? 'expand_less' : 'expand_more';
    document.getElementById('vabToggle').classList.toggle('abierto', _banco.visible);
  });

  // Buscar al presionar Enter o botón
  const qInput = document.getElementById('vabQuery');
  const buscar = () => { _banco.pagina = 1; _banco.query = qInput.value.trim() || 'background'; _buscar(); };
  qInput.addEventListener('keydown', e => { if (e.key === 'Enter') buscar(); });
  document.getElementById('vabBtnBuscar').addEventListener('click', buscar);

  // Chips de género
  document.getElementById('vabGeneros').addEventListener('click', e => {
    const chip = e.target.closest('.vab-chip');
    if (!chip) return;
    document.querySelectorAll('.vab-chip').forEach(c => c.classList.remove('activo'));
    chip.classList.add('activo');
    _banco.genero = chip.dataset.genero;
    _banco.pagina = 1;
    _buscar();
  });

  // Paginación
  document.getElementById('vabBtnAnterior').addEventListener('click', () => {
    if (_banco.pagina > 1) { _banco.pagina--; _buscar(); }
  });
  document.getElementById('vabBtnSiguiente').addEventListener('click', () => {
    if (_banco.pagina < _banco.totalPags) { _banco.pagina++; _buscar(); }
  });

  // Quitar pista activa
  document.getElementById('vabBtnQuitar').addEventListener('click', () => {
    _banco.audioActivo      = null;
    window._audiosBancoActivo = null;
    _detenerPreview();
    _actualizarActivaUI();
    document.querySelectorAll('.vab-pista.seleccionada').forEach(el => el.classList.remove('seleccionada'));
    // Notificar a videos.js que no hay audio del banco
    if (typeof window._onAudioBancoChange === 'function') window._onAudioBancoChange(null);
  });
}

// ── Búsqueda a la API ─────────────────────────────────────
// Contador para cancelar búsquedas anteriores si el usuario
// cambia de género/query antes de que termine la anterior.
let _buscarSeq = 0;

async function _buscar() {
  // Cancelar cualquier búsqueda en curso y empezar una nueva
  _buscarSeq++;
  const miSeq = _buscarSeq;
  _banco.cargando = true;

  const lista = document.getElementById('vabLista');
  lista.innerHTML = `
    <div class="vab-loading">
      <span class="vab-spinner"></span>
      <span>Buscando música…</span>
    </div>`;

  try {
    const token = await _banco.getToken();
    const params = new URLSearchParams({
      accion  : 'buscar',
      token,
      q       : _banco.query,
      genero  : _banco.genero,
      pagina  : _banco.pagina,
      por_pagina: 12,
    });

    const r = await fetch(`${API_AUDIOS}?${params}`, { credentials: 'include' });
    const d = await r.json();

    if (!d.ok) throw new Error(d.error || 'Error en la API');

    // Si el usuario lanzó otra búsqueda mientras esta llegaba, descartar
    if (miSeq !== _buscarSeq) return;

    _banco.resultados = d.datos;
    _banco.totalPags  = Math.ceil(d.total / 12) || 1;

    _renderResultados(d.datos, d.total);
    _actualizarPaginacion();

  } catch(err) {
    lista.innerHTML = `
      <div class="vab-error">
        <span class="material-symbols-outlined">error</span>
        <span>Error: ${err.message}</span>
      </div>`;
  } finally {
    _banco.cargando = false;
  }
}

// ── Render de pistas ──────────────────────────────────────
function _renderResultados(pistas, total) {
  const lista = document.getElementById('vabLista');

  if (!pistas.length) {
    lista.innerHTML = `
      <div class="vab-vacio">
        <span class="material-symbols-outlined">music_off</span>
        <span>No se encontraron pistas. Prueba otra búsqueda.</span>
      </div>`;
    return;
  }

  lista.innerHTML = `<p class="vab-total">${total.toLocaleString()} pistas disponibles · mostrando ${pistas.length}</p>`;

  pistas.forEach(p => {
    const el = document.createElement('div');
    el.className = 'vab-pista';
    el.dataset.id = p.id;

    const dur = _formatDur(p.duracion);
    const seleccionada = _banco.audioActivo?.id === p.id;
    if (seleccionada) el.classList.add('seleccionada');

    el.innerHTML = `
      <button class="vab-pista-play" data-url="${_esc(p.url)}" data-id="${p.id}" title="Vista previa">
        <span class="material-symbols-outlined vab-play-ico">${seleccionada ? 'pause' : 'play_arrow'}</span>
      </button>
      <div class="vab-pista-info">
        <div class="vab-pista-titulo">${_esc(p.titulo)}</div>
        <div class="vab-pista-meta">
          ${p.genero ? `<span class="vab-tag">${_esc(p.genero)}</span>` : ''}
          ${p.mood   ? `<span class="vab-tag">${_esc(p.mood)}</span>`   : ''}
          <span class="vab-dur">${dur}</span>
        </div>
      </div>
      <button class="vab-pista-sel ${seleccionada ? 'activa' : ''}"
              data-id="${p.id}" data-titulo="${_esc(p.titulo)}" data-url="${_esc(p.url)}"
              title="${seleccionada ? 'Quitar selección' : 'Usar esta pista'}">
        <span class="material-symbols-outlined">${seleccionada ? 'check_circle' : 'add_circle'}</span>
      </button>
    `;

    // Play/pause preview
    el.querySelector('.vab-pista-play').addEventListener('click', e => {
      _togglePreview(p, el.querySelector('.vab-play-ico'));
    });

    // Seleccionar pista
    el.querySelector('.vab-pista-sel').addEventListener('click', () => {
      _seleccionarPista(p);
    });

    lista.appendChild(el);
  });
}

// ── Preview de audio ──────────────────────────────────────
let _previewId    = null;
let _previewIco   = null;

function _togglePreview(pista, icoEl) {
  if (_previewId === pista.id) {
    _detenerPreview();
    return;
  }
  _detenerPreview();

  _previewId  = pista.id;
  _previewIco = icoEl;
  icoEl.textContent = 'pause';

  // Crear un Audio() NUEVO cada vez — reutilizar el mismo elemento
  // causa que pistas posteriores no carguen si la anterior
  // estaba en estado de buffering o error.
  const audio = new Audio();
  audio.volume = 0.7;
  audio.preload = 'auto';
  audio.src = pista.url;

  audio.addEventListener('ended', _detenerPreview, { once: true });
  audio.addEventListener('error', () => {
    if (_previewId === pista.id) {
      if (icoEl) icoEl.textContent = 'play_arrow';
      _previewId = null;
      _previewIco = null;
    }
  }, { once: true });

  _banco.previewAudio = audio;
  audio.play().catch(() => {
    if (icoEl) icoEl.textContent = 'play_arrow';
    _previewId = null;
    _previewIco = null;
  });
}

function _detenerPreview() {
  if (_banco.previewAudio) {
    try {
      _banco.previewAudio.pause();
      _banco.previewAudio.src = '';  // liberar recursos del browser
      _banco.previewAudio.load();    // resetear estado interno
    } catch(_) {}
    _banco.previewAudio = null;
  }
  if (_previewIco) _previewIco.textContent = 'play_arrow';
  _previewId  = null;
  _previewIco = null;
}

// ── Seleccionar pista para el video ──────────────────────
function _seleccionarPista(pista) {
  // Toggle: si ya está seleccionada, deseleccionar
  if (_banco.audioActivo?.id === pista.id) {
    _banco.audioActivo      = null;
    window._audiosBancoActivo = null;
    _detenerPreview();
    _actualizarActivaUI();
    // actualizar todos los botones
    document.querySelectorAll('.vab-pista').forEach(el => {
      el.classList.remove('seleccionada');
      el.querySelector('.vab-pista-sel')?.classList.remove('activa');
      const ico = el.querySelector('.vab-pista-sel .material-symbols-outlined');
      if (ico) ico.textContent = 'add_circle';
    });
    if (typeof window._onAudioBancoChange === 'function') window._onAudioBancoChange(null);
    return;
  }

  _banco.audioActivo      = pista;
  window._audiosBancoActivo = pista;

  // Actualizar UI de lista
  document.querySelectorAll('.vab-pista').forEach(el => {
    const esSel = el.dataset.id == pista.id;
    el.classList.toggle('seleccionada', esSel);
    const btn = el.querySelector('.vab-pista-sel');
    if (btn) btn.classList.toggle('activa', esSel);
    const ico = btn?.querySelector('.material-symbols-outlined');
    if (ico) ico.textContent = esSel ? 'check_circle' : 'add_circle';
    const playIco = el.querySelector('.vab-play-ico');
    if (playIco && !esSel) playIco.textContent = 'play_arrow';
  });

  _actualizarActivaUI();
  if (typeof window._onAudioBancoChange === 'function') window._onAudioBancoChange(pista);
}

function _actualizarActivaUI() {
  const div    = document.getElementById('vabActiva');
  const titulo = document.getElementById('vabActivaTitulo');
  if (!div || !titulo) return;

  if (_banco.audioActivo) {
    div.style.display    = 'flex';
    titulo.textContent   = _banco.audioActivo.titulo;
  } else {
    div.style.display    = 'none';
    titulo.textContent   = '—';
  }
}

function _actualizarPaginacion() {
  const pag  = document.getElementById('vabPaginacion');
  const info = document.getElementById('vabPagInfo');
  const ant  = document.getElementById('vabBtnAnterior');
  const sig  = document.getElementById('vabBtnSiguiente');
  if (!pag) return;

  if (_banco.totalPags > 1) {
    pag.style.display = 'flex';
    info.textContent  = `Pág ${_banco.pagina} / ${_banco.totalPags}`;
    ant.disabled      = _banco.pagina <= 1;
    sig.disabled      = _banco.pagina >= _banco.totalPags;
  } else {
    pag.style.display = 'none';
  }
}

// ── Helpers ───────────────────────────────────────────────
function _formatDur(seg) {
  if (!seg) return '';
  const m = Math.floor(seg / 60), s = seg % 60;
  return `${m}:${s.toString().padStart(2,'0')}`;
}
function _esc(str) {
  return String(str ?? '').replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

// ── Exponer función de init ───────────────────────────────
window.initBancoAudios = initBancoAudios;