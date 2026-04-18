// ============================================================
//  js/banner-pub-pages.js — Panel flotante (páginas internas)
//  Sin Firebase. Usa api.js (PHP + MySQL).
// ============================================================
import { obtenerPublicidadesActivas, obtenerProductosActivos, incrementarImpresion } from './api.js';
import { abrirModalProducto } from './modal-producto-banner.js';

// ── Timings ───────────────────────────────────────────────
const DELAY_INICIAL   = 15_000;
const DURACION_VIS    = 20_000;
const CICLO           = 1 * 60_000;
const UMBRAL_PUBS         = 15;
const FRECUENCIA_PRODUCTO = 5;

// ── Helpers ───────────────────────────────────────────────
const fmt = v => '$ ' + Number(v).toLocaleString('es-CO');

function resolverImgProducto(url) {
  if (!url) return '';
  if (url.startsWith('https://') || url.startsWith('http://') || url.startsWith('data:')) return url;
  url = url.replace(/\\/g, '/').replace(/^[A-Za-z]:\/.*?\/gistore\//, '').replace(/^\//, '');
  const isGH     = window.location.hostname.includes('github.io');
  const base     = isGH ? '/gistore' : '';
  const isInPage = window.location.pathname.includes('/page/');
  const prefix   = isInPage ? '../' : '';
  return `${window.location.origin}${base}/${prefix}${url}`;
}

async function cargarPublicidadesActivas() {
  try {
    return await obtenerPublicidadesActivas();
  } catch { return []; }
}

// ── Rotación de productos sin repetir ────────────────────
let _colaProductos = [];
let _cacheFallback = null;

async function _cargarFallbackProductos() {
  if (_cacheFallback !== null) return _cacheFallback;
  try {
    _cacheFallback = await obtenerProductosActivos();
  } catch {
    _cacheFallback = [];
  }
  return _cacheFallback;
}

function _siguienteProducto(productosExtra) { 
  const localCache = window._cacheTodos || [];
  const activos    = localCache.filter(p => p.activo !== false);
  const fuente     = activos.length >= 3 ? activos : (productosExtra || activos);
  if (!fuente.length) return null;

  if (!_colaProductos.length) {
    _colaProductos = fuente.map((_, i) => i);
    for (let i = _colaProductos.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [_colaProductos[i], _colaProductos[j]] = [_colaProductos[j], _colaProductos[i]];
    }
  }

  const idx = _colaProductos.shift();
  return fuente[idx] ?? null;
}

// ── Estado interno ────────────────────────────────────────
let _timerOcultar  = null;
let _cerradoManual = false;
let _contadorCiclo = 0;

// ── Crear panel DOM ───────────────────────────────────────
function crearPanel() {
  if (document.getElementById('pub-float')) return;

  const style = document.createElement('style');
  style.textContent = `
    #pub-float {
      position: fixed; left: 1rem; bottom: 1.5rem; z-index: 1200;
      width: 200px; background: #fff; border-radius: 14px;
      box-shadow: 0 8px 32px rgba(0,0,0,.18), 0 2px 8px rgba(0,0,0,.08);
      border: 1.5px solid var(--borde, #e5e7eb); overflow: hidden;
      transform: translateX(calc(-100% - 1.5rem)); opacity: 0;
      transition: transform .45s cubic-bezier(.34,1.20,.64,1), opacity .35s ease;
      pointer-events: none; will-change: transform, opacity;
    }
    #pub-float.visible { transform: translateX(0); opacity: 1; pointer-events: auto; }
    #pub-float-head { display: flex; align-items: center; justify-content: space-between; padding: .38rem .6rem .38rem .75rem; background: var(--verde, #1a6b3c); }
    #pub-float-etiqueta { font-size: .62rem; font-weight: 700; letter-spacing: .06em; text-transform: uppercase; color: rgba(255,255,255,.88); }
    #pub-float-cerrar { background: rgba(255,255,255,.15); border: none; border-radius: 50%; width: 20px; height: 20px; display: flex; align-items: center; justify-content: center; color: #fff; font-size: .75rem; cursor: pointer; flex-shrink: 0; transition: background .18s; line-height: 1; }
    #pub-float-cerrar:hover { background: rgba(255,255,255,.3); }
    #pub-float-img { width: 200px; height: 150px; object-fit: cover; display: block; }
    #pub-float-placeholder { width: 200px; height: 120px; display: flex; align-items: center; justify-content: center; font-size: 2.5rem; background: var(--fondo, #f9fafb); }
    #pub-float-info { padding: .6rem .75rem .7rem; display: flex; flex-direction: column; gap: .2rem; }
    #pub-float-cat  { font-size: .62rem; font-weight: 700; color: var(--verde, #1a6b3c); text-transform: uppercase; letter-spacing: .04em; }
    #pub-float-nombre { font-size: .84rem; font-weight: 700; color: var(--texto, #111); line-height: 1.25; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
    #pub-float-precio { font-size: .92rem; font-weight: 800; color: var(--verde, #1a6b3c); }
    #pub-float-cta { font-size: .7rem; color: var(--verde, #1a6b3c); font-weight: 600; margin-top: .1rem; }
    #pub-float-barra-wrap { height: 3px; background: var(--borde, #e5e7eb); }
    #pub-float-barra { height: 100%; background: var(--verde, #1a6b3c); width: 100%; }
    #pub-float-pub-info { padding: .5rem .75rem .6rem; background: var(--fondo-2, #fff); border-top: 1px solid var(--borde, #e5e7eb); }
    #pub-float-pub-nombre { font-size: .82rem; font-weight: 700; color: var(--texto, #111); line-height: 1.3; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
    @media (max-width: 420px) { #pub-float { width: 170px; left: .6rem; bottom: 1rem; } #pub-float-img { width: 170px; height: 120px; } }
  `;
  document.head.appendChild(style);

  const panel = document.createElement('div');
  panel.id = 'pub-float';
  panel.setAttribute('role', 'complementary');
  panel.setAttribute('aria-label', 'Publicidad o producto destacado');
  panel.innerHTML = `
    <div id="pub-float-head">
      <span id="pub-float-etiqueta">Publicidad</span>
      <button id="pub-float-cerrar" aria-label="Cerrar">✕</button>
    </div>
    <div id="pub-float-body"></div>
    <div id="pub-float-barra-wrap"><div id="pub-float-barra"></div></div>
  `;
  document.body.appendChild(panel);

  document.getElementById('pub-float-cerrar').addEventListener('click', () => {
    _cerradoManual = true;
    ocultarPanel();
    setTimeout(() => { _cerradoManual = false; }, CICLO);
  });
}

function mostrarPanel() {
  const p = document.getElementById('pub-float');
  if (!p) return;
  p.classList.add('visible');
  const barra = document.getElementById('pub-float-barra');
  barra.style.transition = 'none';
  barra.style.width = '100%';
  requestAnimationFrame(() => requestAnimationFrame(() => {
    barra.style.transition = `width ${DURACION_VIS}ms linear`;
    barra.style.width = '0%';
  }));
  clearTimeout(_timerOcultar);
  _timerOcultar = setTimeout(ocultarPanel, DURACION_VIS);
}

function ocultarPanel() {
  const p = document.getElementById('pub-float');
  if (p) p.classList.remove('visible');
  clearTimeout(_timerOcultar);
  const barra = document.getElementById('pub-float-barra');
  if (barra) { barra.style.transition = 'none'; barra.style.width = '0%'; }
}

function renderPub(pub) {
  const body  = document.getElementById('pub-float-body');
  const etiq  = document.getElementById('pub-float-etiqueta');
  const panel = document.getElementById('pub-float');
  if (!body) return;

  etiq.textContent = 'Publicidad';
  body.innerHTML = (pub.imagen_url
    ? `<img id="pub-float-img" src="${pub.imagen_url}" alt="${pub.titulo || 'Publicidad'}"
           loading="lazy" onerror="this.style.display='none'">`
    : `<div id="pub-float-placeholder">📢</div>`)
    + (pub.titulo
    ? `<div id="pub-float-pub-info"><div id="pub-float-pub-nombre">${pub.titulo}</div></div>`
    : '');

  if (pub.url_destino) {
    panel.style.cursor = 'pointer';
    body.onclick = () => window.open(pub.url_destino, '_blank', 'noopener,noreferrer');
  } else {
    panel.style.cursor = 'default';
    body.onclick = null;
  }
}

function renderProducto(productosExtra) {
  const prod = _siguienteProducto(productosExtra);
  if (!prod) return false;

  const cats   = window._categoriasMap || {};
  const cat    = cats[prod.categoria_id] || '';
  const img    = resolverImgProducto(prod.imagen || '');
  const precio = fmt(prod.valor || 0);

  const body  = document.getElementById('pub-float-body');
  const etiq  = document.getElementById('pub-float-etiqueta');
  const panel = document.getElementById('pub-float');
  if (!body) return false;

  etiq.textContent = 'Destacado';
  body.innerHTML = `
    ${img
      ? `<img id="pub-float-img" src="${img}" alt="${prod.nombre || ''}"
             loading="lazy" onerror="this.style.display='none'">`
      : `<div id="pub-float-placeholder">🛍️</div>`}
    <div id="pub-float-info">
      ${cat ? `<div id="pub-float-cat">${cat}</div>` : ''}
      <div id="pub-float-nombre">${prod.nombre || ''}</div>
      <div id="pub-float-precio">${precio}</div>
      <div id="pub-float-cta">Ver producto →</div>
    </div>`;

  panel.style.cursor = 'pointer';
  body.onclick = () => {
    ocultarPanel();
    abrirModalProducto(prod);
  };
  return true;
}

async function ejecutarCiclo() {
  if (_cerradoManual) return;
  crearPanel();
  _contadorCiclo++;

  try {
    const pubs        = await cargarPublicidadesActivas();
    const pubsConCupo = pubs.filter(p => p.impresiones_hoy < (p.limite_diario ?? Infinity));

    const localActivos = (window._cacheTodos || []).filter(p => p.activo !== false);
    const fallback = localActivos.length >= 3
      ? localActivos
      : await _cargarFallbackProductos();

    if (!pubsConCupo.length) {
      const ok = renderProducto(fallback);
      if (ok) mostrarPanel();
      return;
    }

    const pocasPubs = pubsConCupo.length < UMBRAL_PUBS;

    if (pocasPubs) {
      if (Math.random() < 0.5) {
        const ok = renderProducto(fallback);
        if (ok) { mostrarPanel(); return; }
      }
      renderPub(pubsConCupo[0]);
      await incrementarImpresion(pubsConCupo[0].id);
      mostrarPanel();
      return;
    }

    if ((_contadorCiclo % FRECUENCIA_PRODUCTO) === 0) {
      const ok = renderProducto(fallback);
      if (ok) { mostrarPanel(); return; }
    }

    renderPub(pubsConCupo[0]);
    await incrementarImpresion(pubsConCupo[0].id);
    mostrarPanel();

  } catch (e) {
    console.warn('banner-pub-pages:', e);
    const fb = await _cargarFallbackProductos().catch(() => []);
    const ok = renderProducto(fb);
    if (ok) mostrarPanel();
  }
}

export async function iniciarBannerPublicidad() {
  setTimeout(ejecutarCiclo, DELAY_INICIAL);
  setInterval(ejecutarCiclo, CICLO);
}

window._iniciarBannerPublicidad = iniciarBannerPublicidad;