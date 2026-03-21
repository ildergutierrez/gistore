// ============================================================
//  js/banner-pub-pages.js — Panel flotante de publicidad / producto
//
//  Comportamiento:
//  · Aparece 15 s después de cargar la página
//  · Visible 20 s, luego se oculta con animación
//  · Se repite cada 1 min
//  · Posición: fijo, lateral IZQUIERDO, ~200 px de ancho
//
//  Lógica de contenido (UMBRAL = 15 publicidades con cupo):
//  · < 15 pubs activas con cupo:
//      → Alterna entre publicidad y productos del catálogo.
//        50 % de probabilidad de mostrar producto por ciclo.
//  · ≥ 15 pubs activas con cupo:
//      → Publicidades dominantes, 1 cada 5 ciclos muestra producto.
//  · Todas agotaron límite diario → solo productos ese día.
//  · Al día siguiente el conteo se reinicia automáticamente (sub-clave YYYY-MM-DD).
//  · Sin publicidad ni productos → no muestra nada.
//
//  Al hacer clic en un PRODUCTO abre el modal unificado de
//  js/modal-producto-banner.js (se inyecta automáticamente en
//  cualquier página sin necesidad de agregar HTML manual).
// ============================================================
import { initializeApp, getApps }
  from "https://www.gstatic.com/firebasejs/12.10.0/firebase-app.js";
import {
  getFirestore, collection, getDocs, doc,
  query, where, increment, setDoc, getDoc
} from "https://www.gstatic.com/firebasejs/12.10.0/firebase-firestore.js";

// ── Importar modal de producto (se auto-inyecta en la página) ─────
import { abrirModalProducto } from "./modal-producto-banner.js";

// ── Firebase ──────────────────────────────────────────────
const _fbConfig = {
  apiKey:            "AIzaSyBviMH3re9aHjiLb5p-5hSjXd4gAchTvgI",
  authDomain:        "gi-store-5a5eb.firebaseapp.com",
  projectId:         "gi-store-5a5eb",
  storageBucket:     "gi-store-5a5eb.firebasestorage.app",
  messagingSenderId: "157652441199",
  appId:             "1:157652441199:web:c42285a80f117f79cc159a",
};
const _app = getApps().length ? getApps()[0] : initializeApp(_fbConfig);
const _db  = getFirestore(_app);

// ── Timings ───────────────────────────────────────────────
const DELAY_INICIAL   = 15_000;
const DURACION_VIS    = 20_000;
const CICLO           = 1 * 60_000;

const UMBRAL_PUBS         = 15;
const FRECUENCIA_PRODUCTO = 5;

// ── Helpers ───────────────────────────────────────────────
const fmt = v => "$ " + Number(v).toLocaleString("es-CO");
const HOY = () => new Date().toISOString().split("T")[0];

function resolverImgProducto(url) {
  if (!url) return "";
  if (url.startsWith("https://") || url.startsWith("http://") || url.startsWith("data:")) return url;
  url = url.replace(/\\/g, "/").replace(/^[A-Za-z]:\/.*?\/gistore\//, "").replace(/^\//, "");
  const isGH     = window.location.hostname.includes("github.io");
  const base     = isGH ? "/gistore" : "";
  const isInPage = window.location.pathname.includes("/page/");
  const prefix   = isInPage ? "../" : "";
  return `${window.location.origin}${base}/${prefix}${url}`;
}

// ── Firebase helpers ──────────────────────────────────────
async function cargarPublicidadesActivas() {
  try {
    const hoy  = HOY();
    const snap = await getDocs(query(collection(_db, "publicidad"), where("estado", "==", "activa")));
    return snap.docs.map(d => ({ id: d.id, ...d.data() }))
      .filter(p => p.fecha_inicio <= hoy && p.fecha_fin >= hoy);
  } catch { return []; }
}

async function leerContadorHoy(pubId) {
  try {
    const snap = await getDoc(doc(_db, "publicidad", pubId, "impresiones", HOY()));
    return snap.exists() ? (snap.data().count || 0) : 0;
  } catch { return 0; }
}

async function incrementarContador(pubId) {
  try {
    await setDoc(doc(_db, "publicidad", pubId, "impresiones", HOY()),
      { count: increment(1) }, { merge: true });
  } catch (e) { console.warn("banner-pub-pages: contador", e); }
}

// Recibe array de {p, count} ya filtrado con cupo; elige el de menor impresiones
function elegirPublicidad(pubsConCupo) {
  if (!pubsConCupo.length) return null;
  return pubsConCupo[0]; // ya vienen ordenados por count asc
}

// ── Rotación de productos sin repetir ────────────────────
let _colaProductos = [];
let _cacheFallback = null;

async function _cargarFallbackProductos() {
  if (_cacheFallback !== null) return _cacheFallback;
  try {
    const snap = await getDocs(query(
      collection(_db, "productos"),
      where("activo", "==", true)
    ));
    _cacheFallback = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch (e) {
    console.warn("banner-pub-pages: fallback productos", e);
    _cacheFallback = [];
  }
  return _cacheFallback;
}

function _siguienteProducto(productosExtra) {
  const localCache = window._cacheTodos || [];
  const activos    = localCache.filter(p => p.activo !== false);
  const fuente     = activos.length >= 3 ? activos : (productosExtra || activos);
  if (!fuente.length) return null;

  if (!_colaProductos.length || _colaProductos._fuente !== fuente) {
    _colaProductos = fuente.map((_, i) => i);
    _colaProductos._fuente = fuente;
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

// ── Crear panel DOM (una sola vez) ────────────────────────
function crearPanel() {
  if (document.getElementById("pub-float")) return;

  const style = document.createElement("style");
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
    #pub-float-head {
      display: flex; align-items: center; justify-content: space-between;
      padding: .38rem .6rem .38rem .75rem; background: var(--verde, #1a6b3c);
    }
    #pub-float-etiqueta {
      font-size: .62rem; font-weight: 700; letter-spacing: .06em;
      text-transform: uppercase; color: rgba(255,255,255,.88);
    }
    #pub-float-cerrar {
      background: rgba(255,255,255,.15); border: none; border-radius: 50%;
      width: 20px; height: 20px; display: flex; align-items: center;
      justify-content: center; color: #fff; font-size: .75rem;
      cursor: pointer; flex-shrink: 0; transition: background .18s; line-height: 1;
    }
    #pub-float-cerrar:hover { background: rgba(255,255,255,.3); }
    #pub-float-img { width: 200px; height: 150px; object-fit: cover; display: block; }
    #pub-float-placeholder {
      width: 200px; height: 120px; display: flex; align-items: center;
      justify-content: center; font-size: 2.5rem; background: var(--fondo, #f9fafb);
    }
    #pub-float-info {
      padding: .6rem .75rem .7rem; display: flex; flex-direction: column; gap: .2rem;
    }
    #pub-float-cat  { font-size: .62rem; font-weight: 700; color: var(--verde, #1a6b3c); text-transform: uppercase; letter-spacing: .04em; }
    #pub-float-nombre { font-size: .84rem; font-weight: 700; color: var(--texto, #111); line-height: 1.25; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
    #pub-float-precio { font-size: .92rem; font-weight: 800; color: var(--verde, #1a6b3c); }
    #pub-float-cta { font-size: .7rem; color: var(--verde, #1a6b3c); font-weight: 600; margin-top: .1rem; }
    #pub-float-barra-wrap { height: 3px; background: var(--borde, #e5e7eb); }
    #pub-float-barra { height: 100%; background: var(--verde, #1a6b3c); width: 100%; }
    #pub-float-pub-info {
      padding: .5rem .75rem .6rem; background: var(--fondo-2, #fff);
      border-top: 1px solid var(--borde, #e5e7eb);
    }
    #pub-float-pub-nombre {
      font-size: .82rem; font-weight: 700; color: var(--texto, #111); line-height: 1.3;
      display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;
    }
    @media (max-width: 420px) {
      #pub-float { width: 170px; left: .6rem; bottom: 1rem; }
      #pub-float-img { width: 170px; height: 120px; }
    }
  `;
  document.head.appendChild(style);

  const panel = document.createElement("div");
  panel.id = "pub-float";
  panel.setAttribute("role", "complementary");
  panel.setAttribute("aria-label", "Publicidad o producto destacado");
  panel.innerHTML = `
    <div id="pub-float-head">
      <span id="pub-float-etiqueta">Publicidad</span>
      <button id="pub-float-cerrar" aria-label="Cerrar">✕</button>
    </div>
    <div id="pub-float-body"></div>
    <div id="pub-float-barra-wrap"><div id="pub-float-barra"></div></div>
  `;
  document.body.appendChild(panel);

  document.getElementById("pub-float-cerrar").addEventListener("click", () => {
    _cerradoManual = true;
    ocultarPanel();
    setTimeout(() => { _cerradoManual = false; }, CICLO);
  });
}

// ── Mostrar / ocultar ─────────────────────────────────────
function mostrarPanel() {
  const p = document.getElementById("pub-float");
  if (!p) return;
  p.classList.add("visible");

  const barra = document.getElementById("pub-float-barra");
  barra.style.transition = "none";
  barra.style.width = "100%";
  requestAnimationFrame(() => requestAnimationFrame(() => {
    barra.style.transition = `width ${DURACION_VIS}ms linear`;
    barra.style.width = "0%";
  }));

  clearTimeout(_timerOcultar);
  _timerOcultar = setTimeout(ocultarPanel, DURACION_VIS);
}

function ocultarPanel() {
  const p = document.getElementById("pub-float");
  if (p) p.classList.remove("visible");
  clearTimeout(_timerOcultar);
  const barra = document.getElementById("pub-float-barra");
  if (barra) { barra.style.transition = "none"; barra.style.width = "0%"; }
}

// ── Renderizar publicidad ─────────────────────────────────
function renderPub(pub) {
  const body  = document.getElementById("pub-float-body");
  const etiq  = document.getElementById("pub-float-etiqueta");
  const panel = document.getElementById("pub-float");
  if (!body) return;

  etiq.textContent = "Publicidad";

  const tituloHtml = pub.titulo
    ? `<div id="pub-float-pub-nombre">${pub.titulo}</div>`
    : "";
  pub.imagen_url = pub.imagen_url
    ? pub.imagen_url.replace(/\\/g, "/").replace(/^[A-Za-z]:\/.*?\/gistore\//, "").replace(/^\//, "")
    : "";

  body.innerHTML = (pub.imagen_url
    ? `<img id="pub-float-img" src="${pub.imagen_url}" alt="${pub.titulo || 'Publicidad'}"
           loading="lazy" onerror="this.style.display='none'">`
    : `<div id="pub-float-placeholder">📢</div>`)
    + (tituloHtml ? `<div id="pub-float-pub-info">${tituloHtml}</div>` : "");

  if (pub.url_destino) {
    panel.style.cursor = "pointer";
    panel.title = pub.url_destino;
    body.onclick = () => window.open(pub.url_destino, "_blank", "noopener,noreferrer");
  } else {
    panel.style.cursor = "default";
    body.onclick = null;
  }
}

// ── Renderizar producto ───────────────────────────────────
// Al hacer clic → abre el modal del módulo modal-producto-banner.js
function renderProducto(productosExtra) {
  const prod = _siguienteProducto(productosExtra);
  if (!prod) return false;

  const cats   = window._categoriasMap || {};
  const cat    = cats[prod.categoria_id] || "";
  const img    = resolverImgProducto(prod.imagen || prod.foto || "");
  const precio = fmt(prod.precio || 0);

  const body  = document.getElementById("pub-float-body");
  const etiq  = document.getElementById("pub-float-etiqueta");
  const panel = document.getElementById("pub-float");
  if (!body) return false;

  etiq.textContent = "Destacado";
  body.innerHTML = `
    ${img
      ? `<img id="pub-float-img" src="${img}" alt="${prod.nombre || ''}"
             loading="lazy" onerror="this.style.display='none'">`
      : `<div id="pub-float-placeholder">🛍️</div>`}
    <div id="pub-float-info">
      ${cat ? `<div id="pub-float-cat">${cat}</div>` : ""}
      <div id="pub-float-nombre">${prod.nombre || ""}</div>
      <div id="pub-float-precio">${precio}</div>
      <div id="pub-float-cta">Ver producto →</div>
    </div>`;

  panel.style.cursor = "pointer";

  // ── CLIC EN PRODUCTO: abre el modal ──────────────────────────────
  body.onclick = () => {
    ocultarPanel();
    // modal-producto-banner.js ya registró window._abrirModalProducto
    // via el import al inicio del módulo, pero llamamos directamente
    // a la función importada para mayor seguridad:
    abrirModalProducto(prod);
  };

  return true;
}

// ── Ciclo principal ───────────────────────────────────────
async function ejecutarCiclo() {
  if (_cerradoManual) return;

  crearPanel();
  _contadorCiclo++;

  try {
    const pubs       = await cargarPublicidadesActivas();
    const contadores = await Promise.all(pubs.map(p => leerContadorHoy(p.id)));

    const pubsConCupo = pubs
      .map((p, i) => ({ p, count: contadores[i] }))
      .filter(({ p, count }) => count < (p.limite_diario ?? Infinity))
      .sort((a, b) => a.count - b.count);

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
      const mostrarProductoAhora = Math.random() < 0.5;
      if (mostrarProductoAhora) {
        const ok = renderProducto(fallback);
        if (ok) { mostrarPanel(); return; }
      }
      const elegida = elegirPublicidad(pubsConCupo);
      if (elegida) {
        renderPub(elegida.p);
        await incrementarContador(elegida.p.id);
        mostrarPanel();
        return;
      }
      const ok = renderProducto(fallback);
      if (ok) mostrarPanel();
      return;
    }

    const esCicloProducto = (_contadorCiclo % FRECUENCIA_PRODUCTO) === 0;
    if (esCicloProducto) {
      const ok = renderProducto(fallback);
      if (ok) { mostrarPanel(); return; }
    }

    const elegida = elegirPublicidad(pubsConCupo);
    if (elegida) {
      renderPub(elegida.p);
      await incrementarContador(elegida.p.id);
      mostrarPanel();
      return;
    }

    const ok = renderProducto(fallback);
    if (ok) mostrarPanel();

  } catch (e) {
    console.warn("banner-pub-pages:", e);
    const fb = await _cargarFallbackProductos().catch(() => []);
    const ok = renderProducto(fb);
    if (ok) mostrarPanel();
  }
}

// ── API pública ───────────────────────────────────────────
export async function iniciarBannerPublicidad() {
  setTimeout(ejecutarCiclo, DELAY_INICIAL);
  setInterval(ejecutarCiclo, CICLO);
}

window._iniciarBannerPublicidad = iniciarBannerPublicidad;