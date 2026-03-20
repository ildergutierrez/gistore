// ============================================================
//  js/banner-pub.js — Panel flotante de publicidad / producto
//
//  Comportamiento:
//  · Aparece 15 s después de cargar la página
//  · Visible 20 s, luego se oculta con animación
//  · Se repite cada 3 min
//  · Posición: fijo, lateral IZQUIERDO, ~200 px de ancho
//
//  Lógica de contenido (UMBRAL = 15 publicidades con cupo):
//  · < 15 pubs activas con cupo:
//      → Alterna entre publicidad y productos del catálogo.
//        Cada ciclo 50 % de probabilidad de mostrar un producto
//        diferente (sin repetir hasta agotar el catálogo).
//  · ≥ 15 pubs activas con cupo:
//      → Muestra publicidades, pero 1 de cada 5 ciclos fuerza
//        un producto del catálogo (rotando sin repetir).
//  · Sin publicidad ni productos → no muestra nada.
//  · Botón ✕ para cerrar manualmente (pausa hasta el próximo ciclo)
// ============================================================
import { initializeApp, getApps }
  from "https://www.gstatic.com/firebasejs/12.10.0/firebase-app.js";
import {
  getFirestore, collection, getDocs, doc,
  query, where, increment, setDoc, getDoc
} from "https://www.gstatic.com/firebasejs/12.10.0/firebase-firestore.js";

// ── Firebase (reutiliza instancia si ya existe) ───────────
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
const DELAY_INICIAL   = 15_000;      // 15 s tras carga
const DURACION_VIS    = 20_000;      // visible 20 s
const CICLO           = 1 * 60_000;  // cada 1 min

// ── Umbral y frecuencia de productos ──────────────────────
const UMBRAL_PUBS          = 15;  // si hay < 15 pubs → modo mixto
const FRECUENCIA_PRODUCTO  = 5;   // con ≥ 15 pubs → 1 cada N ciclos muestra producto

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
  } catch (e) { console.warn("banner-pub: contador", e); }
}

async function elegirPublicidad(pubs) {
  const contadores = await Promise.all(pubs.map(p => leerContadorHoy(p.id)));
  const cands = pubs
    .map((p, i) => ({ p, count: contadores[i] }))
    .filter(({ p, count }) => count < (p.limite_diario ?? Infinity));
  if (!cands.length) return null;
  cands.sort((a, b) => a.count - b.count);
  return cands[0].p;
}

// ── Rotación de productos sin repetir ────────────────────
// Mantiene una cola aleatoria; cuando se agota, la recarga.
let _colaProductos = [];   // índices pendientes de mostrar

function _siguienteProducto() {
  const cache   = window._cacheTodos || [];
  const activos = cache.filter(p => p.activo !== false);
  if (!activos.length) return null;

  // Si la cola está vacía o tiene items inválidos, reconstruirla
  if (!_colaProductos.length) {
    _colaProductos = activos.map((_, i) => i);
    // Fisher-Yates shuffle
    for (let i = _colaProductos.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [_colaProductos[i], _colaProductos[j]] = [_colaProductos[j], _colaProductos[i]];
    }
  }

  const idx = _colaProductos.shift();
  return activos[idx] ?? null;
}

// ── Estado interno ────────────────────────────────────────
let _timerOcultar  = null;
let _cerradoManual = false;
let _contadorCiclo = 0;   // cuenta ciclos para la frecuencia de productos

// ── Crear el panel DOM (una sola vez) ─────────────────────
function crearPanel() {
  if (document.getElementById("pub-float")) return;

  const style = document.createElement("style");
  style.textContent = `
    #pub-float {
      position: fixed;
      left: 1rem;
      bottom: 1.5rem;
      z-index: 1200;
      width: 200px;
      background: #fff;
      border-radius: 14px;
      box-shadow: 0 8px 32px rgba(0,0,0,.18), 0 2px 8px rgba(0,0,0,.08);
      border: 1.5px solid var(--borde, #e5e7eb);
      overflow: hidden;
      transform: translateX(calc(-100% - 1.5rem));
      opacity: 0;
      transition: transform .45s cubic-bezier(.34,1.20,.64,1),
                  opacity   .35s ease;
      pointer-events: none;
      will-change: transform, opacity;
    }
    #pub-float.visible {
      transform: translateX(0);
      opacity: 1;
      pointer-events: auto;
    }
    #pub-float-head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: .38rem .6rem .38rem .75rem;
      background: var(--verde, #1a6b3c);
    }
    #pub-float-etiqueta {
      font-size: .62rem;
      font-weight: 700;
      letter-spacing: .06em;
      text-transform: uppercase;
      color: rgba(255,255,255,.88);
    }
    #pub-float-cerrar {
      background: rgba(255,255,255,.15);
      border: none;
      border-radius: 50%;
      width: 20px; height: 20px;
      display: flex; align-items: center; justify-content: center;
      color: #fff;
      font-size: .75rem;
      cursor: pointer;
      flex-shrink: 0;
      transition: background .18s;
      line-height: 1;
    }
    #pub-float-cerrar:hover { background: rgba(255,255,255,.3); }
    #pub-float-img {
      width: 200px;
      height: 150px;
      object-fit: cover;
      display: block;
    }
    #pub-float-placeholder {
      width: 200px; height: 120px;
      display: flex; align-items: center; justify-content: center;
      font-size: 2.5rem;
      background: var(--fondo, #f9fafb);
    }
    #pub-float-info {
      padding: .6rem .75rem .7rem;
      display: flex;
      flex-direction: column;
      gap: .2rem;
    }
    #pub-float-cat  {
      font-size: .62rem; font-weight: 700;
      color: var(--verde, #1a6b3c);
      text-transform: uppercase; letter-spacing: .04em;
    }
    #pub-float-nombre {
      font-size: .84rem; font-weight: 700;
      color: var(--texto, #111); line-height: 1.25;
      display: -webkit-box; -webkit-line-clamp: 2;
      -webkit-box-orient: vertical; overflow: hidden;
    }
    #pub-float-precio {
      font-size: .92rem; font-weight: 800;
      color: var(--verde, #1a6b3c);
    }
    #pub-float-cta {
      font-size: .7rem; color: var(--verde, #1a6b3c);
      font-weight: 600; margin-top: .1rem;
    }
    #pub-float-barra-wrap {
      height: 3px;
      background: var(--borde, #e5e7eb);
    }
    #pub-float-barra {
      height: 100%;
      background: var(--verde, #1a6b3c);
      width: 100%;
    }
    #pub-float-pub-info {
      padding: .5rem .75rem .6rem;
      background: var(--fondo-2, #fff);
      border-top: 1px solid var(--borde, #e5e7eb);
    }
    #pub-float-pub-nombre {
      font-size: .82rem;
      font-weight: 700;
      color: var(--texto, #111);
      line-height: 1.3;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
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
    <div id="pub-float-barra-wrap">
      <div id="pub-float-barra"></div>
    </div>
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
pub.imagen_url= pub.imagen_url?.replace(/\\/g, "/").replace(/^[A-Za-z]:\/.*?\/gistore\//, "").replace(/^\//, "");
  body.innerHTML = (pub.imagen_url
    ? `<img id="pub-float-img" src="${pub.imagen_url}" alt="${pub.titulo || 'Publicidad'}"
           loading="lazy" onerror="this.style.display='none'">`
    : `<div id="pub-float-placeholder">📢</div>`)
    + (tituloHtml
    ? `<div id="pub-float-pub-info">${tituloHtml}</div>`
    : "");

  if (pub.url_destino) {
    panel.style.cursor = "pointer";
    panel.title = pub.url_destino;
    body.onclick = () => window.open(pub.url_destino, "_blank", "noopener,noreferrer");
  } else {
    panel.style.cursor = "default";
    body.onclick = null;
  }
}

// ── Renderizar producto (con rotación sin repetir) ────────
function renderProducto() {
  const prod = _siguienteProducto();
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
  body.onclick = () => {
    ocultarPanel();
    if (typeof window._abrirModalProducto === "function") {
      window._abrirModalProducto(prod); return;
    }
    const inp = document.getElementById("busqueda-input");
    if (inp) { inp.value = prod.nombre; inp.dispatchEvent(new Event("input")); }
    document.getElementById("grilla")?.scrollIntoView({ behavior: "smooth" });
  };
  return true;
}

// ── Ciclo principal ───────────────────────────────────────
async function ejecutarCiclo() {
  if (_cerradoManual) return;

  crearPanel();
  _contadorCiclo++;

  try {
    const pubs = await cargarPublicidadesActivas();

    // Filtrar solo las que tienen cupo disponible
    const contadores = await Promise.all(pubs.map(p => leerContadorHoy(p.id)));
    const pubsConCupo = pubs.filter((p, i) =>
      contadores[i] < (p.limite_diario ?? Infinity)
    );

    const pocasPubs = pubsConCupo.length < UMBRAL_PUBS;

    // ── Modo mixto (< 15 pubs con cupo) ──────────────────
    if (pocasPubs) {
      // 50 % de probabilidad de mostrar producto en este ciclo,
      // siempre que haya publicidades disponibles.
      // Si no hay pubs, siempre muestra producto.
      const mostrarProductoAhora = !pubsConCupo.length || Math.random() < 0.5;

      if (mostrarProductoAhora) {
        const ok = renderProducto();
        if (ok) { mostrarPanel(); return; }
        // Si no hay productos, cae a publicidad
      }

      // Mostrar publicidad
      if (pubsConCupo.length) {
        const elegida = await elegirPublicidad(pubsConCupo);
        if (elegida) {
          renderPub(elegida);
          await incrementarContador(elegida.id);
          mostrarPanel();
          return;
        }
      }

      // Último recurso: producto si aún no se mostró nada
      const ok = renderProducto();
      if (ok) mostrarPanel();
      return;
    }

    // ── Modo publicidad dominante (≥ 15 pubs con cupo) ───
    // Cada FRECUENCIA_PRODUCTO ciclos muestra un producto del catálogo
    const esCicloProducto = (_contadorCiclo % FRECUENCIA_PRODUCTO) === 0;

    if (esCicloProducto) {
      const ok = renderProducto();
      if (ok) { mostrarPanel(); return; }
      // Si no hay productos, sigue con publicidad
    }

    // Mostrar publicidad normalmente
    const elegida = await elegirPublicidad(pubsConCupo);
    if (elegida) {
      renderPub(elegida);
      await incrementarContador(elegida.id);
      mostrarPanel();
      return;
    }

    // Sin publicidad elegible → fallback a producto
    const ok = renderProducto();
    if (ok) mostrarPanel();

  } catch (e) {
    console.warn("banner-pub:", e);
    // Fallback silencioso — intenta con producto
    const ok = renderProducto();
    if (ok) mostrarPanel();
  }
}

// ── API pública ───────────────────────────────────────────
export async function iniciarBannerPublicidad() {
  setTimeout(ejecutarCiclo, DELAY_INICIAL);
  setInterval(ejecutarCiclo, CICLO);
}

window._iniciarBannerPublicidad = iniciarBannerPublicidad;