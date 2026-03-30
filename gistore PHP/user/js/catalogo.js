// ============================================================
//  catalogo.js — Portal Vendedor · v9  ✦ PHP+MySQL backend
//  ✦ Sin Firebase — autenticación por sesión PHP + CSRF token
//  ✦ Llama a productos.php?accion=obtener igual que productos.js
//  ✦ Toda la lógica de PDF/tarjetas conservada intacta
// ============================================================

// ── Rutas backend ──────────────────────────────────────────
const API_PRODUCTOS = "../backend/productos.php";
const API_TOKEN     = "../../backend/tokens.php";
const API_VENDEDOR  = "../backend/vendedor.php";       // endpoint de perfil del vendedor
const API_MEMBRESIA = "../backend/membresias.php";

// ── Estado global ──────────────────────────────────────────
let productos  = [];
let categorias = [];
let vendedor   = null;

const el = id => document.getElementById(id);

// ── Fecha ──────────────────────────────────────────────────
if (el("fechaHoy")) {
  el("fechaHoy").textContent = new Date().toLocaleDateString("es-ES", {
    year: "numeric", month: "long", day: "numeric"
  });
}

// ══════════════════════════════════════════════════════════
//  CSRF token (mismo patrón que productos.js)
// ══════════════════════════════════════════════════════════
let _token = null;

async function getToken() {
  if (_token) return _token;
  try {
    const res  = await fetch(API_TOKEN, { credentials: "include" });
    const data = await res.json();
    _token = data.token || "";
  } catch { _token = ""; }
  return _token;
}

// ══════════════════════════════════════════════════════════
//  API helpers
// ══════════════════════════════════════════════════════════
async function apiGet(endpoint, accion) {
  const token = await getToken();
  const res   = await fetch(
    `${endpoint}?accion=${accion}&token=${encodeURIComponent(token)}`,
    { credentials: "include" }
  );
  if (res.status === 401) {
    window.location.href = "../index.html";
    return null;
  }
  const data = await res.json();
  if (!data.ok) throw new Error(data.error || "Error desconocido");
  return data.datos;
}

// ── Helper ruta imagen ─────────────────────────────────────
function urlImagen(ruta) {
  if (!ruta) return null;
  if (ruta.startsWith("http://") || ruta.startsWith("https://")) return ruta;
  const limpia = ruta.replace(/^(\.\.\/)+/, "").replace(/^\/+/, "");
  return "/" + limpia;
}

// ── Helpers precio / botones ───────────────────────────────
function formatoPrecio(n) {
  return "$" + Number(n).toLocaleString("es-CO");
}

function btnCargando(btn, estado) {
  btn.disabled = estado;
  btn.dataset.textoOriginal = btn.dataset.textoOriginal || btn.textContent;
  btn.textContent = estado ? "Generando PDF…" : btn.dataset.textoOriginal;
}

// ══════════════════════════════════════════════════════════
//  CARGA INICIAL
// ══════════════════════════════════════════════════════════
async function cargar() {
  try {
    const token = await getToken();
    if (!token) { window.location.href = "../index.html"; return; }

    // Cargar productos, categorías y perfil del vendedor en paralelo
    const [prods, cats, vend] = await Promise.all([
      apiGet(API_PRODUCTOS, "obtener"),
      apiGet(API_PRODUCTOS, "categorias"),
      apiGet(API_VENDEDOR,  "perfil").catch(() => null),
    ]);

    if (!prods) return; // redirigido a login
    productos  = prods;
    categorias = cats  || [];
    vendedor   = vend  || {};

    if (el("vendedorNombre") && vendedor.nombre)
      el("vendedorNombre").textContent = vendedor.nombre;

    renderPrevia();
  } catch (e) {
    console.error("Error al cargar catálogo:", e);
  }
}

// ══════════════════════════════════════════════════════════
//  MEMBRESÍA
// ══════════════════════════════════════════════════════════
async function verificarMembresia() {
  try {
    const token = await getToken();
    const res   = await fetch(
      `${API_MEMBRESIA}?token=${encodeURIComponent(token)}`,
      { credentials: "include" }
    );
    const json = await res.json();
    if (!json.ok) return null;
    return json.datos?.membresia || null;
  } catch { return null; }
}

function membresiaVigente(mem) {
  if (!mem) return false;
  const hoy = new Date().toISOString().split("T")[0];
  return mem.estado === "activa" && mem.fecha_fin >= hoy;
}

// ══════════════════════════════════════════════════════════
//  FILTRADO Y ORDEN
// ══════════════════════════════════════════════════════════
function nombreCategoria(id) {
  const c = categorias.find(x => String(x.id) === String(id));
  return c ? c.nombre : "Sin categoría";
}

function filtrarOrdenar() {
  const filtro = el("filtroEstado") ? el("filtroEstado").value : "todos";
  const orden  = el("ordenPDF")     ? el("ordenPDF").value     : "nombre";
  let lista = [...productos];
  if (filtro === "activos")   lista = lista.filter(p => p.activo == 1);
  if (filtro === "inactivos") lista = lista.filter(p => p.activo != 1);
  if (orden === "nombre")    lista.sort((a,b) => a.nombre.localeCompare(b.nombre));
  if (orden === "valor")     lista.sort((a,b) => a.valor - b.valor);
  if (orden === "categoria") lista.sort((a,b) =>
    nombreCategoria(a.categoria_id).localeCompare(nombreCategoria(b.categoria_id)));
  return lista;
}

// ══════════════════════════════════════════════════════════
//  PAGINACIÓN VISTA PREVIA — 25 por página
// ══════════════════════════════════════════════════════════
const POR_PAG = 25;
let pagActual = 1;

function renderPrevia() { pagActual = 1; renderPag(); }

function renderPag() {
  const lista     = filtrarOrdenar();
  const total     = lista.length;
  const totalPags = Math.max(1, Math.ceil(total / POR_PAG));
  if (pagActual > totalPags) pagActual = totalPags;

  const desde  = (pagActual - 1) * POR_PAG;
  const pagina = lista.slice(desde, desde + POR_PAG);

  if (el("totalPrevia"))
    el("totalPrevia").textContent = total + " producto" + (total !== 1 ? "s" : "") +
      (totalPags > 1 ? "  ·  pág. " + pagActual + " / " + totalPags : "");

  const wrap = el("previaCatalogo");
  if (!wrap) return;

  if (!lista.length) {
    wrap.innerHTML = '<p class="vacio-txt">Sin productos para mostrar.</p>';
    return;
  }

  const filas = pagina.map(p => {
    const src = urlImagen(p.imagen);
    return `<tr>
      <td style="padding:7px 8px">
        ${src
          ? `<img src="${src}" style="width:42px;height:42px;object-fit:cover;border-radius:7px;display:block;border:1.5px solid var(--borde)"
               onerror="this.outerHTML='<div style=\\'width:42px;height:42px;border-radius:7px;background:var(--verde-claro);display:flex;align-items:center;justify-content:center;font-size:1.3rem\\'>📦</div>'">`
          : `<div style="width:42px;height:42px;border-radius:7px;background:var(--verde-claro);display:flex;align-items:center;justify-content:center;font-size:1.3rem">📦</div>`}
      </td>
      <td style="padding:7px 8px"><strong style="font-size:.875rem">${escHtml(p.nombre)}</strong></td>
      <td style="padding:7px 8px;white-space:nowrap;font-size:.875rem">${formatoPrecio(p.valor)}</td>
      <td style="padding:7px 8px;font-size:.82rem">${escHtml(nombreCategoria(p.categoria_id))}</td>
      <td style="padding:7px 8px">
        <span class="badge badge-${p.activo == 1 ? "activo" : "inactivo"}" style="font-size:.75rem">
          ${p.activo == 1 ? "Activo" : "Inactivo"}
        </span>
      </td>
    </tr>`;
  }).join("");

  const paginador = totalPags > 1 ? buildPaginador(pagActual, totalPags) : "";

  wrap.innerHTML = `
    <div style="overflow-x:auto;-webkit-overflow-scrolling:touch">
      <table style="min-width:460px;width:100%">
        <thead><tr>
          <th style="padding:8px;width:54px">Img</th>
          <th style="padding:8px">Nombre</th>
          <th style="padding:8px">Valor</th>
          <th style="padding:8px">Categoría</th>
          <th style="padding:8px">Estado</th>
        </tr></thead>
        <tbody>${filas}</tbody>
      </table>
    </div>
    ${paginador}`;

  wrap.querySelectorAll("[data-pag]").forEach(btn =>
    btn.addEventListener("click", () => {
      pagActual = parseInt(btn.dataset.pag);
      renderPag();
      wrap.scrollIntoView({ behavior: "smooth", block: "start" });
    }));
}

function buildPaginador(actual, total) {
  const MAX = window.innerWidth < 500 ? 3 : 5;
  let ini = Math.max(1, actual - Math.floor(MAX / 2));
  let fin = Math.min(total, ini + MAX - 1);
  if (fin - ini < MAX - 1) ini = Math.max(1, fin - MAX + 1);
  const TAM = window.innerWidth < 500 ? "44px" : "36px";
  const FS  = window.innerWidth < 500 ? ".9rem" : ".82rem";
  const s = on =>
    `min-width:${TAM};height:${TAM};padding:0 8px;border-radius:8px;` +
    `font-size:${FS};font-weight:600;cursor:pointer;` +
    `background:${on ? "var(--verde)" : "var(--fondo-2)"};` +
    `color:${on ? "#fff" : "var(--texto)"};` +
    `border:1.5px solid ${on ? "var(--verde)" : "var(--borde)"};` +
    `display:inline-flex;align-items:center;justify-content:center;transition:background .15s;`;
  let btns = "";
  if (actual > 1)   btns += `<button data-pag="${actual-1}" style="${s(false)}">&#8592;</button>`;
  for (let i = ini; i <= fin; i++)
    btns += `<button data-pag="${i}" style="${s(i===actual)}">${i}</button>`;
  if (actual < total) btns += `<button data-pag="${actual+1}" style="${s(false)}">&#8594;</button>`;
  const info = `<span style="font-size:.8rem;color:var(--texto-suave);white-space:nowrap">Pag. ${actual} / ${total}</span>`;
  return `<div style="display:flex;align-items:center;justify-content:center;gap:6px;margin-top:1.25rem;padding:.75rem 0;flex-wrap:wrap">${btns}${info}</div>`;
}

if (el("filtroEstado")) el("filtroEstado").addEventListener("change", renderPrevia);
if (el("ordenPDF"))     el("ordenPDF").addEventListener("change",    renderPrevia);

// ══════════════════════════════════════════════════════════
//  HELPERS PDF (sin cambios respecto a v8)
// ══════════════════════════════════════════════════════════
function resolverImg(url) {
  if (!url) return "";
  if (url.startsWith("http") || url.startsWith("data:")) return url;
  return urlImagen(url);
}

async function imgABase64(url) {
  if (!url) return "";
  try {
    const r = await fetch(resolverImg(url));
    if (!r.ok) return "";
    const b = await r.blob();
    return await new Promise(res => {
      const fr = new FileReader();
      fr.onload  = () => res(fr.result);
      fr.onerror = () => res("");
      fr.readAsDataURL(b);
    });
  } catch { return ""; }
}

function logoSVG(color) {
  const s = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 44"><rect width="160" height="44" rx="10" fill="${color}"/><text x="80" y="29" font-family="Georgia,serif" font-size="18" font-weight="bold" fill="white" text-anchor="middle" letter-spacing="4">GI Store</text></svg>`;
  return "data:image/svg+xml;base64," + btoa(s);
}

function shiftColor(hex, amt) {
  try {
    const n = parseInt(hex.replace("#",""),16), c = v => Math.max(0,Math.min(255,v));
    return "#"+((1<<24)+(c((n>>16)+amt)<<16)+(c(((n>>8)&0xFF)+amt)<<8)+c((n&0xFF)+amt)).toString(16).slice(1);
  } catch { return hex; }
}

function hexRgba(hex, a) {
  try {
    const n=parseInt(hex.replace("#",""),16);
    return `rgba(${n>>16},${(n>>8)&0xFF},${n&0xFF},${a})`;
  } catch { return hex; }
}

function etiquetaPromo(idx) {
  const et = [
    { txt:"MAS VENDIDO", bg:"#ff6b35", icon:"★" },
    { txt:"NUEVO",       bg:"#7c3aed", icon:"+" },
    { txt:"FAVORITO",    bg:"#db2777", icon:"♥" },
    { txt:"ESPECIAL",    bg:"#059669", icon:"●" },
    { txt:"PREMIUM",     bg:"#b45309", icon:"◆" },
    { txt:"RECOMENDADO", bg:"#0284c7", icon:"✓" },
  ];
  return et[idx % et.length];
}

function estrellas(color) {
  return `<span style="color:${color};font-size:9.5px;letter-spacing:1px">&#9733;&#9733;&#9733;&#9733;</span><span style="color:${color}66;font-size:9.5px">&#9733;</span>`;
}

// ══════════════════════════════════════════════════════════
//  PALETAS POR CATEGORÍA
// ══════════════════════════════════════════════════════════
const PALETAS = {
  salud:   { bg:"#f0faf4", bg2:"#e2f5e9", accent:"#1a6b3c", dark:"#0d3d22", mid:"#2d9a5a",
             tag:"#d4edde", tagTxt:"#1a6b3c", icon:"leaf", bannerIcon:"&#127807;",
             grad:"linear-gradient(135deg,#1a6b3c 0%,#2d9a5a 55%,#0d3d22 100%)" },
  vigori:  { bg:"#fff8f0", bg2:"#fff0dd", accent:"#e05a00", dark:"#8a3600", mid:"#f07020",
             tag:"#fde8d0", tagTxt:"#e05a00", icon:"bolt", bannerIcon:"&#9889;",
             grad:"linear-gradient(135deg,#e05a00 0%,#f07020 55%,#8a3600 100%)" },
  belleza: { bg:"#fff5f8", bg2:"#ffe5f0", accent:"#c2185b", dark:"#880e4f", mid:"#e91e8c",
             tag:"#fce4ec", tagTxt:"#c2185b", icon:"flower", bannerIcon:"&#127800;",
             grad:"linear-gradient(135deg,#c2185b 0%,#e91e8c 55%,#880e4f 100%)" },
  hogar:   { bg:"#fdf6f0", bg2:"#f5e5d0", accent:"#9c4a1a", dark:"#5c2a0a", mid:"#c06030",
             tag:"#fde8d8", tagTxt:"#9c4a1a", icon:"home", bannerIcon:"&#127968;",
             grad:"linear-gradient(135deg,#9c4a1a 0%,#c06030 55%,#5c2a0a 100%)" },
  moda:    { bg:"#f9f5ff", bg2:"#ede5ff", accent:"#6a1b9a", dark:"#3a0066", mid:"#8e24aa",
             tag:"#ede7f6", tagTxt:"#6a1b9a", icon:"shirt", bannerIcon:"&#128141;",
             grad:"linear-gradient(135deg,#6a1b9a 0%,#8e24aa 55%,#3a0066 100%)" },
  tecnol:  { bg:"#f0f4ff", bg2:"#dde8ff", accent:"#1565c0", dark:"#003080", mid:"#1976d2",
             tag:"#e3f2fd", tagTxt:"#1565c0", icon:"cpu", bannerIcon:"&#128187;",
             grad:"linear-gradient(135deg,#1565c0 0%,#1976d2 55%,#003080 100%)" },
  default: { bg:"#f5f3ef", bg2:"#e8e4da", accent:"#1a6b3c", dark:"#0d3d22", mid:"#2d9a5a",
             tag:"#d4edde", tagTxt:"#1a6b3c", icon:"box", bannerIcon:"&#128722;",
             grad:"linear-gradient(135deg,#1a6b3c 0%,#2d9a5a 55%,#0d3d22 100%)" },
};

function getPaleta(cat) {
  const n = (cat||"").toLowerCase();
  if (n.includes("salud")||n.includes("bienestar"))                        return PALETAS.salud;
  if (n.includes("vigor")||n.includes("energia")||n.includes("natural"))   return PALETAS.vigori;
  if (n.includes("belleza")||n.includes("cuidado")||n.includes("personal"))return PALETAS.belleza;
  if (n.includes("hogar")||n.includes("casa"))                             return PALETAS.hogar;
  if (n.includes("moda")||n.includes("ropa")||n.includes("accesorio"))     return PALETAS.moda;
  if (n.includes("tecno")||n.includes("electr"))                           return PALETAS.tecnol;
  return PALETAS.default;
}

// ══════════════════════════════════════════════════════════
//  BANNER DE CATEGORÍA
// ══════════════════════════════════════════════════════════
function bannerCategoria(cat, pal, secNum, totalSec) {
  return `
  <div style="display:flex;align-items:stretch;margin:14px 0 10px;border-radius:14px;
              overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,.18);height:62px;">
    <div style="width:60px;min-width:60px;background:rgba(0,0,0,.28);
                display:flex;align-items:center;justify-content:center;
                font-size:24px;flex-shrink:0">${pal.bannerIcon}</div>
    <div style="flex:1;padding:0 18px;background:${pal.grad};
                display:flex;flex-direction:column;justify-content:center;
                position:relative;overflow:hidden;">
      <div style="position:absolute;right:-28px;top:-28px;width:110px;height:110px;
                  border-radius:50%;background:rgba(255,255,255,.06)"></div>
      <div style="font-size:6.5px;letter-spacing:.26em;text-transform:uppercase;
                  color:rgba(255,255,255,.55);margin-bottom:3px;font-family:Arial">Coleccion</div>
      <div style="font-family:Georgia,serif;font-size:17px;font-weight:bold;
                  color:#fff;line-height:1;text-shadow:0 2px 8px rgba(0,0,0,.2)">${cat}</div>
    </div>
    <div style="width:68px;min-width:68px;background:rgba(0,0,0,.30);
                display:flex;flex-direction:column;align-items:center;
                justify-content:center;flex-shrink:0">
      <div style="font-size:6px;color:rgba(255,255,255,.45);font-family:Arial;
                  text-transform:uppercase;letter-spacing:.18em;margin-bottom:1px">Secc.</div>
      <div style="font-family:Georgia,serif;font-size:16px;font-weight:bold;
                  color:rgba(255,255,255,.9);line-height:1">${secNum}</div>
      <div style="font-size:7px;color:rgba(255,255,255,.4);font-family:Arial">de ${totalSec}</div>
    </div>
  </div>`;
}

// ══════════════════════════════════════════════════════════
//  TARJETA HERO PREMIUM — 250px
// ══════════════════════════════════════════════════════════
function tarjetaHero(p, imgSrc, pal, color, num) {
  const precio = formatoPrecio(p.valor);
  const cat    = nombreCategoria(p.categoria_id);
  const desc   = (p.descripcion   || "").substring(0, 200);
  const uso    = (p.recomendacion || "").substring(0, 125);
  const numStr = String(num).padStart(2, "0");
  const promo  = etiquetaPromo(num - 1);

  return `
  <div style="display:flex;height:250px;margin-bottom:12px;border-radius:18px;overflow:hidden;
              box-shadow:0 6px 28px rgba(0,0,0,.16);">
    <div style="flex:1;display:flex;flex-direction:column;background:${pal.bg};
                min-width:0;position:relative;overflow:hidden">
      <div style="height:4px;background:${pal.grad};flex-shrink:0"></div>
      <div style="padding:13px 17px;flex:1;display:flex;flex-direction:column;justify-content:space-between">
        <div style="display:flex;align-items:flex-start;justify-content:space-between">
          <div>
            <div style="background:${pal.tag};border:1.5px solid ${pal.accent}28;
                        padding:3px 10px;border-radius:20px;display:inline-flex;
                        align-items:center;gap:4px;margin-bottom:5px">
              <span style="font-size:7px;font-weight:800;letter-spacing:.15em;
                           color:${pal.tagTxt};text-transform:uppercase">${cat}</span>
            </div>
            <div style="display:flex;align-items:center;gap:4px">
              ${estrellas(pal.accent)}
              <span style="font-size:7px;color:${pal.accent};font-family:Arial;font-weight:700">4.8</span>
            </div>
          </div>
          <span style="font-family:Georgia,serif;font-size:44px;font-weight:bold;
                       color:${pal.accent}0d;line-height:1;margin-top:-4px">${numStr}</span>
        </div>
        <div>
          <h2 style="font-family:Georgia,serif;font-size:17px;font-weight:bold;
                     color:#111827;margin:0 0 6px;line-height:1.25">${p.nombre}</h2>
          <div style="display:flex;gap:3px;margin-bottom:7px">
            <div style="height:3px;width:38px;background:${pal.accent};border-radius:2px"></div>
            <div style="height:3px;flex:1;background:${pal.accent}1a;border-radius:2px"></div>
          </div>
          ${desc ? `<p style="font-size:9.5px;color:#374151;line-height:1.7;margin:0;font-family:Arial">${desc}</p>` : ""}
        </div>
        <div style="display:flex;justify-content:space-between;align-items:flex-end;gap:10px">
          ${uso ? `
          <div style="background:${hexRgba(pal.accent,.06)};border-left:3px solid ${pal.accent};
                      padding:6px 9px;border-radius:0 8px 8px 0;flex:1;min-width:0">
            <div style="font-size:6.5px;font-weight:800;color:${pal.accent};
                        text-transform:uppercase;letter-spacing:.13em;margin-bottom:2px">Para quien</div>
            <p style="font-size:8.5px;color:#374151;margin:0;line-height:1.55;font-family:Arial">${uso}</p>
          </div>` : "<div></div>"}
          <div style="flex-shrink:0">
            <div style="background:${pal.grad};color:#fff;padding:10px 15px;border-radius:14px;
                        text-align:center;box-shadow:0 5px 18px ${hexRgba(pal.accent,.42)};
                        position:relative;overflow:hidden">
              <div style="position:absolute;top:-12px;right:-12px;width:44px;height:44px;
                          border-radius:50%;background:rgba(255,255,255,.14)"></div>
              <div style="font-size:6.5px;opacity:.8;letter-spacing:.1em;font-family:Arial;
                          margin-bottom:1px;position:relative">PRECIO ESPECIAL</div>
              <div style="font-size:20px;font-weight:900;font-family:Georgia,serif;
                          line-height:1;position:relative">${precio}</div>
            </div>
            <div style="margin-top:4px;background:${pal.accent}14;border:1px solid ${pal.accent}38;
                        padding:3px 10px;border-radius:8px;text-align:center">
              <span style="font-size:6.5px;font-weight:800;color:${pal.accent};
                           letter-spacing:.12em;text-transform:uppercase">PEDIR AHORA</span>
            </div>
          </div>
        </div>
      </div>
    </div>
    <div style="width:232px;min-width:232px;position:relative;overflow:hidden;flex-shrink:0;
                background:${imgSrc ? "#0a0a0a" : pal.grad}">
      ${imgSrc
        ? `<img src="${imgSrc}" style="position:absolute;top:0;left:0;width:100%;height:100%;object-fit:cover;display:block"/>`
        : `<div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-size:70px;opacity:.5">${pal.bannerIcon}</div>`}
      <div style="position:absolute;top:0;left:0;width:52px;height:100%;
                  background:linear-gradient(to right,${pal.bg},transparent)"></div>
      <div style="position:absolute;bottom:0;left:0;right:0;height:80px;
                  background:linear-gradient(to top,rgba(0,0,0,.55),transparent)"></div>
      <div style="position:absolute;top:14px;left:0;background:${promo.bg};
                  padding:4px 12px 4px 8px;border-radius:0 20px 20px 0;
                  box-shadow:0 3px 10px rgba(0,0,0,.35)">
        <span style="font-size:7px;font-weight:900;color:#fff;
                     letter-spacing:.1em;text-transform:uppercase">${promo.icon} ${promo.txt}</span>
      </div>
      <div style="position:absolute;bottom:10px;right:12px;font-family:Georgia,serif;
                  font-size:50px;font-weight:bold;color:rgba(255,255,255,.11);line-height:1">${numStr}</div>
    </div>
  </div>`;
}

// ══════════════════════════════════════════════════════════
//  TARJETA COMPACTA — 195px
// ══════════════════════════════════════════════════════════
function tarjetaCompacta(p, imgSrc, pal, color, num) {
  const precio = formatoPrecio(p.valor);
  const cat    = nombreCategoria(p.categoria_id);
  const desc   = (p.descripcion   || "").substring(0, 140);
  const uso    = (p.recomendacion || "").substring(0, 90);
  const numStr = String(num).padStart(2, "0");
  const promo  = etiquetaPromo(num);

  return `
  <div style="display:flex;height:195px;margin-bottom:10px;border-radius:16px;overflow:hidden;
              box-shadow:0 4px 20px rgba(0,0,0,.13);">
    <div style="width:190px;min-width:190px;position:relative;overflow:hidden;flex-shrink:0;
                background:${imgSrc ? "#0a0a0a" : pal.grad}">
      ${imgSrc
        ? `<img src="${imgSrc}" style="position:absolute;top:0;left:0;width:100%;height:100%;object-fit:cover;display:block"/>`
        : `<div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-size:52px;opacity:.55">${pal.bannerIcon}</div>`}
      <div style="position:absolute;top:0;right:0;width:42px;height:100%;
                  background:linear-gradient(to left,${pal.bg},transparent)"></div>
      <div style="position:absolute;bottom:0;left:0;right:0;height:60px;
                  background:linear-gradient(to top,rgba(0,0,0,.58),transparent)"></div>
      <div style="position:absolute;bottom:9px;left:9px">
        <span style="font-size:6.5px;font-weight:900;letter-spacing:.14em;
                     color:rgba(255,255,255,.92);text-transform:uppercase">${cat.toUpperCase()}</span>
      </div>
      <div style="position:absolute;top:9px;left:0;background:${promo.bg};
                  padding:3px 9px 3px 6px;border-radius:0 13px 13px 0;
                  box-shadow:0 2px 8px rgba(0,0,0,.3)">
        <span style="font-size:6.5px;font-weight:900;color:#fff;text-transform:uppercase;
                     letter-spacing:.09em">${promo.icon} ${promo.txt}</span>
      </div>
      <div style="position:absolute;top:8px;right:14px;font-family:Georgia,serif;
                  font-size:26px;font-weight:bold;color:rgba(255,255,255,.13)">${numStr}</div>
    </div>
    <div style="flex:1;display:flex;flex-direction:column;background:${pal.bg};min-width:0">
      <div style="height:3px;background:${pal.grad};flex-shrink:0"></div>
      <div style="padding:11px 14px;flex:1;display:flex;flex-direction:column;justify-content:space-between">
        <div>
          <div style="display:flex;align-items:center;gap:3px;margin-bottom:4px">${estrellas(pal.accent)}</div>
          <h3 style="font-family:Georgia,serif;font-size:14px;font-weight:bold;
                     color:#111827;margin:0 0 5px;line-height:1.3">${p.nombre}</h3>
          <div style="display:flex;gap:2px;margin-bottom:5px">
            <div style="height:2.5px;width:28px;background:${pal.accent};border-radius:2px"></div>
            <div style="height:2.5px;flex:1;background:${pal.accent}1a;border-radius:2px"></div>
          </div>
          ${desc ? `<p style="font-size:9px;color:#374151;line-height:1.65;margin:0;font-family:Arial">${desc}</p>` : ""}
        </div>
        <div style="display:flex;justify-content:space-between;align-items:flex-end;gap:8px">
          ${uso ? `
          <div style="background:${hexRgba(pal.accent,.06)};border-left:3px solid ${pal.accent};
                      padding:4px 8px;border-radius:0 7px 7px 0;flex:1;min-width:0;overflow:hidden">
            <div style="font-size:6.5px;font-weight:800;color:${pal.accent};text-transform:uppercase;
                        letter-spacing:.1em;margin-bottom:1px">Para quien</div>
            <p style="font-size:8px;color:#374151;margin:0;line-height:1.5;font-family:Arial">${uso}</p>
          </div>` : "<div></div>"}
          <div style="flex-shrink:0">
            <div style="background:${pal.grad};color:#fff;padding:7px 13px;border-radius:11px;
                        text-align:center;box-shadow:0 4px 14px ${hexRgba(pal.accent,.38)};
                        position:relative;overflow:hidden">
              <div style="position:absolute;top:-8px;right:-8px;width:28px;height:28px;
                          border-radius:50%;background:rgba(255,255,255,.16)"></div>
              <div style="font-size:6.5px;opacity:.8;letter-spacing:.08em;font-family:Arial;
                          margin-bottom:1px;position:relative">PRECIO</div>
              <div style="font-size:15px;font-weight:900;font-family:Georgia,serif;
                          line-height:1;position:relative">${precio}</div>
            </div>
            <div style="margin-top:3px;background:${pal.accent}12;border:1px solid ${pal.accent}32;
                        padding:2px 8px;border-radius:7px;text-align:center">
              <span style="font-size:6px;font-weight:800;color:${pal.accent};
                           letter-spacing:.1em;text-transform:uppercase">PEDIR AHORA</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>`;
}

// ══════════════════════════════════════════════════════════
//  TARJETA MINI — grid 3 o 2 col
// ══════════════════════════════════════════════════════════
function tarjetaMini(p, imgSrc, pal, color, num) {
  const precio = formatoPrecio(p.valor);
  const cat    = nombreCategoria(p.categoria_id);
  const desc   = (p.descripcion || "").substring(0, 68);
  const promo  = etiquetaPromo(num + 2);

  return `
  <div style="border-radius:16px;overflow:hidden;box-shadow:0 4px 18px rgba(0,0,0,.14);
              background:#fff;display:flex;flex-direction:column;">
    <div style="position:relative;height:158px;overflow:hidden;flex-shrink:0;
                background:${imgSrc ? "#0a0a0a" : pal.grad}">
      ${imgSrc
        ? `<img src="${imgSrc}" style="position:absolute;top:0;left:0;width:100%;height:100%;object-fit:cover;display:block"/>`
        : `<div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-size:50px;opacity:.52">${pal.bannerIcon}</div>`}
      <div style="position:absolute;inset:0;background:linear-gradient(to bottom,rgba(0,0,0,.02) 38%,rgba(0,0,0,.62))"></div>
      <div style="position:absolute;bottom:9px;right:9px;background:${pal.grad};color:#fff;
                  padding:4px 11px;border-radius:16px;font-size:13px;font-weight:900;
                  font-family:Georgia,serif;box-shadow:0 3px 10px ${hexRgba(pal.accent,.55)}">${precio}</div>
      <div style="position:absolute;top:8px;left:9px;font-family:Georgia,serif;
                  font-size:24px;font-weight:bold;color:rgba(255,255,255,.13)">${String(num).padStart(2,"0")}</div>
      <div style="position:absolute;top:8px;right:8px;background:${promo.bg};
                  padding:2px 7px;border-radius:10px;box-shadow:0 2px 6px rgba(0,0,0,.3)">
        <span style="font-size:6.5px;font-weight:900;color:#fff;text-transform:uppercase;
                     letter-spacing:.07em">${promo.icon} ${promo.txt}</span>
      </div>
    </div>
    <div style="padding:9px 10px 10px;background:${pal.bg};flex:1;
                display:flex;flex-direction:column;justify-content:space-between">
      <div>
        <div style="display:flex;align-items:center;gap:4px;margin-bottom:3px">
          <div style="width:3px;height:11px;background:${pal.accent};border-radius:2px;flex-shrink:0"></div>
          <span style="font-size:6.5px;font-weight:800;letter-spacing:.13em;
                       color:${pal.tagTxt};text-transform:uppercase">${cat}</span>
        </div>
        <div style="font-family:Georgia,serif;font-size:12.5px;font-weight:bold;
                    color:#111827;line-height:1.3;margin-bottom:3px">${p.nombre}</div>
        ${desc ? `<p style="font-size:8px;color:#6b7280;line-height:1.55;margin:0;font-family:Arial">${desc}</p>` : ""}
      </div>
      <div style="display:flex;align-items:center;justify-content:space-between;margin-top:5px">
        ${estrellas(pal.accent)}
        <div style="background:${pal.accent};color:#fff;padding:2px 9px;border-radius:8px;
                    box-shadow:0 2px 8px ${hexRgba(pal.accent,.38)}">
          <span style="font-size:6.5px;font-weight:900;letter-spacing:.1em;text-transform:uppercase">PEDIR</span>
        </div>
      </div>
    </div>
  </div>`;
}

// ══════════════════════════════════════════════════════════
//  MOTOR DE PÁGINAS
// ══════════════════════════════════════════════════════════
const A_BANNER = 72, A_HERO = 262, A_COMP = 205, A_MINI = 250, FOOTER_H = 52;
const A4_UTIL_PG1 = 1123 - 220 - FOOTER_H - 28;
const A4_UTIL     = 1123 - FOOTER_H - 28;
const PATRON_CAT  = ["H", "CC", "MMM", "H", "CC", "MM", "H", "MMM", "CC"];

function generarCuerpo(lista, imagenes, color) {
  if (!lista.length) return "";

  const grupos = [], catMap = {};
  for (const p of lista) {
    const cat = nombreCategoria(p.categoria_id);
    if (!catMap[cat]) { catMap[cat] = []; grupos.push(cat); }
    catMap[cat].push(p);
  }

  const totalGrupos = grupos.length;
  const bloques = [];

  grupos.forEach((cat, gi) => {
    const prods      = catMap[cat];
    const pal        = getPaleta(cat);
    const bannerHtml = bannerCategoria(cat, pal, gi + 1, totalGrupos);
    let pi = 0, patronIdx = 0;

    while (pi < prods.length) {
      const tipo = PATRON_CAT[patronIdx % PATRON_CAT.length];
      patronIdx++;
      const p   = o => prods[pi + o];
      const img = o => imagenes[p(o)?.id] || "";
      const ok  = o => pi + o < prods.length;
      const glb = o => lista.indexOf(p(o)) + 1;
      const esPrimero = (pi === 0);
      const banExtra  = esPrimero ? A_BANNER : 0;
      const prefijo   = esPrimero ? bannerHtml : "";

      if (tipo === "H" && ok(0)) {
        bloques.push({ alto: A_HERO + banExtra,
          html: prefijo + tarjetaHero(p(0), img(0), pal, color, glb(0)) });
        pi++;
      } else if (tipo === "CC") {
        if (ok(1)) {
          bloques.push({ alto: A_COMP * 2 + banExtra,
            html: prefijo + tarjetaCompacta(p(0), img(0), pal, color, glb(0)) +
                            tarjetaCompacta(p(1), img(1), pal, color, glb(1)) });
          pi += 2;
        } else {
          bloques.push({ alto: A_COMP + banExtra,
            html: prefijo + tarjetaCompacta(p(0), img(0), pal, color, glb(0)) });
          pi++;
        }
      } else if (tipo === "MMM") {
        if (ok(2)) {
          bloques.push({ alto: A_MINI + banExtra,
            html: prefijo + `<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:11px;margin-bottom:10px;">
              ${tarjetaMini(p(0),img(0),pal,color,glb(0))}
              ${tarjetaMini(p(1),img(1),pal,color,glb(1))}
              ${tarjetaMini(p(2),img(2),pal,color,glb(2))}</div>` });
          pi += 3;
        } else if (ok(1)) {
          bloques.push({ alto: A_MINI + banExtra,
            html: prefijo + `<div style="display:grid;grid-template-columns:1fr 1fr;gap:11px;margin-bottom:10px;">
              ${tarjetaMini(p(0),img(0),pal,color,glb(0))}
              ${tarjetaMini(p(1),img(1),pal,color,glb(1))}</div>` });
          pi += 2;
        } else {
          bloques.push({ alto: A_COMP + banExtra,
            html: prefijo + tarjetaCompacta(p(0), img(0), pal, color, glb(0)) });
          pi++;
        }
      } else if (tipo === "MM") {
        if (ok(1)) {
          bloques.push({ alto: A_MINI + banExtra,
            html: prefijo + `<div style="display:grid;grid-template-columns:1fr 1fr;gap:11px;margin-bottom:10px;">
              ${tarjetaMini(p(0),img(0),pal,color,glb(0))}
              ${tarjetaMini(p(1),img(1),pal,color,glb(1))}</div>` });
          pi += 2;
        } else {
          bloques.push({ alto: A_COMP + banExtra,
            html: prefijo + tarjetaCompacta(p(0), img(0), pal, color, glb(0)) });
          pi++;
        }
      }
    }
  });

  let html = "", acum = 0, primeraPag = true, ultimoFueBreak = false;
  for (const b of bloques) {
    const limite = primeraPag ? A4_UTIL_PG1 : A4_UTIL;
    if (acum > 0 && acum + b.alto > limite) {
      if (!ultimoFueBreak) {
        html += `<div style="page-break-before:always;break-before:page;height:0;font-size:0;line-height:0"> </div>`;
        ultimoFueBreak = true;
      }
      acum = 0; primeraPag = false;
    } else {
      ultimoFueBreak = false;
    }
    html += b.html;
    acum += b.alto;
  }
  return html;
}

// ══════════════════════════════════════════════════════════
//  PORTADA PREMIUM
// ══════════════════════════════════════════════════════════
function buildPortada(vend, lista, logo, color, colorDark, colorMid, hoy, dominio) {
  const totalCats = [...new Set(lista.map(p => nombreCategoria(p.categoria_id)))].length;
  return `
  <div style="background:linear-gradient(145deg,${color} 0%,${colorMid} 45%,${colorDark} 100%);
              padding:38px 40px 30px;position:relative;overflow:hidden">
    <div style="position:absolute;right:-100px;top:-100px;width:380px;height:380px;
                border-radius:50%;background:rgba(255,255,255,.06)"></div>
    <div style="position:absolute;right:70px;bottom:-140px;width:250px;height:250px;
                border-radius:50%;background:rgba(255,255,255,.04)"></div>
    <div style="position:absolute;left:-50px;bottom:0;width:180px;height:180px;
                border-radius:50%;background:rgba(255,255,255,.03)"></div>
    <div style="position:relative;display:flex;justify-content:space-between;
                align-items:flex-start;gap:16px">
      <div style="flex:1;min-width:0">
        <img src="${logo}" style="height:42px;margin-bottom:16px;display:block"/>
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:9px">
          <div style="width:22px;height:1.5px;background:rgba(255,255,255,.5)"></div>
          <div style="font-size:8px;letter-spacing:.3em;text-transform:uppercase;
                      color:rgba(255,255,255,.55);font-family:Arial">Catalogo Oficial de Productos</div>
        </div>
        <h1 style="font-family:Georgia,serif;font-size:31px;color:#fff;
                   margin:0 0 8px;font-weight:bold;line-height:1.15;
                   text-shadow:0 3px 20px rgba(0,0,0,.22)">${vend.nombre || "GI Store"}</h1>
        ${vend.ciudad
          ? `<div style="display:inline-flex;align-items:center;gap:5px;background:rgba(255,255,255,.14);
                          border-radius:20px;padding:3px 12px;margin-bottom:8px">
               <span style="font-size:10.5px;color:rgba(255,255,255,.85);font-family:Arial">Ubicacion: ${vend.ciudad}</span>
             </div>` : ""}
        <div style="display:flex;gap:12px;margin-top:10px;flex-wrap:wrap">
          ${[[lista.length,"Productos"],[totalCats,"Categorias"],["4.8 ★","Valoracion"]].map(([v,l]) => `
            <div style="background:rgba(255,255,255,.14);border-radius:10px;padding:7px 14px;text-align:center">
              <div style="font-family:Georgia,serif;font-size:18px;font-weight:bold;color:#fff">${v}</div>
              <div style="font-size:7.5px;color:rgba(255,255,255,.6);font-family:Arial;
                          text-transform:uppercase;letter-spacing:.1em">${l}</div>
            </div>`).join("")}
        </div>
        <p style="font-size:9px;color:rgba(255,255,255,.42);margin:10px 0 0;font-family:Arial">${hoy}</p>
      </div>
      <div style="background:rgba(255,255,255,.16);border:1.5px solid rgba(255,255,255,.28);
                  border-radius:16px;padding:18px 22px;text-align:right;min-width:165px;
                  flex-shrink:0;box-shadow:0 8px 32px rgba(0,0,0,.15)">
        <div style="font-size:7.5px;letter-spacing:.18em;text-transform:uppercase;
                    color:rgba(255,255,255,.48);margin-bottom:10px;font-family:Arial">Contacto</div>
        ${vend.whatsapp
          ? `<div style="font-size:12px;color:#fff;font-weight:700;margin-bottom:7px;
                          font-family:Arial">Tel: ${vend.whatsapp}</div>` : ""}
        <div style="font-size:10.5px;color:rgba(255,255,255,.78);font-family:Arial">Web: ${dominio}</div>
        <div style="margin-top:12px;background:rgba(255,255,255,.22);border-radius:10px;
                    padding:6px 12px;text-align:center">
          <div style="font-size:7px;font-weight:800;color:#fff;letter-spacing:.14em;
                      text-transform:uppercase">Escribenos hoy</div>
        </div>
      </div>
    </div>
    <div style="height:1px;background:rgba(255,255,255,.2);margin-top:22px;position:relative">
      <div style="position:absolute;left:0;top:-4px;width:88px;height:8px;
                  border-radius:5px;background:rgba(255,255,255,.55)"></div>
    </div>
  </div>`;
}

// ══════════════════════════════════════════════════════════
//  FOOTER PDF
// ══════════════════════════════════════════════════════════
function footerHtml(color, colorDark, logo, nombre, ciudad, whatsapp, dominio, cantidad, hoy) {
  return `
  <div id="footerCaptura" style="background:linear-gradient(135deg,${color} 0%,${colorDark} 100%);
       padding:13px 34px;box-sizing:border-box;width:794px;position:relative;overflow:hidden">
    <div style="position:absolute;right:-28px;top:-28px;width:85px;height:85px;
                border-radius:50%;background:rgba(255,255,255,.07)"></div>
    <div style="display:flex;justify-content:space-between;align-items:center;
                flex-wrap:wrap;gap:6px;position:relative">
      <div style="display:flex;align-items:center;gap:10px">
        <img src="${logo}" style="height:20px;flex-shrink:0"/>
        <div>
          <div style="font-size:10.5px;font-weight:700;color:#fff;font-family:Arial">${nombre}</div>
          <div style="font-size:8px;color:rgba(255,255,255,.6);font-family:Arial">
            ${ciudad ? ciudad + "  ·  " : ""}${cantidad} producto${cantidad!==1?"s":""}  ·  ${hoy}
          </div>
        </div>
      </div>
      <div style="text-align:right">
        ${whatsapp ? `<div style="font-size:8.5px;color:rgba(255,255,255,.85);margin-bottom:2px;font-family:Arial">Tel: ${whatsapp}</div>` : ""}
        <div style="font-size:8.5px;color:rgba(255,255,255,.75);font-family:Arial">Web: ${dominio}</div>
        <div style="font-size:7.5px;color:rgba(255,255,255,.4);margin-top:1px;font-family:Arial">
          © ${new Date().getFullYear()} · Todos los derechos reservados
        </div>
      </div>
    </div>
  </div>`;
}

// ══════════════════════════════════════════════════════════
//  EXPORTAR PDF
// ══════════════════════════════════════════════════════════
if (el("btnExportar")) {
  el("btnExportar").addEventListener("click", async () => {
    const btn   = el("btnExportar");
    const lista = filtrarOrdenar();
    if (!lista.length) { mostrarAlerta("No hay productos para exportar."); return; }

    // Verificar membresía antes de generar
    const mem = await verificarMembresia();
    if (!membresiaVigente(mem)) { mostrarAlertaMembresia(mem); return; }

    btnCargando(btn, true);

    try {
      const dominio   = window.location.hostname;
      const hoy       = new Date().toLocaleDateString("es-CO",
        { year:"numeric", month:"long", day:"numeric" });
      const color     = vendedor.color || "#1a6b3c";
      const colorDark = shiftColor(color, -40);
      const colorMid  = shiftColor(color, 18);
      const logo      = logoSVG(color);

      // Convertir imágenes a base64 en lotes de 6
      const imagenes = {};
      for (let i = 0; i < lista.length; i += 6) {
        await Promise.all(lista.slice(i, i+6).map(async p => {
          imagenes[p.id] = p.imagen ? await imgABase64(urlImagen(p.imagen)) : "";
        }));
      }

      const portada = buildPortada(vendedor, lista, logo, color, colorDark, colorMid, hoy, dominio);
      const cuerpo  = generarCuerpo(lista, imagenes, color);

      const html = `
      <div style="font-family:Arial,Helvetica,sans-serif;margin:0;padding:0;background:#f3f1ec">
        ${portada}
        <div style="padding:18px 24px 70px">${cuerpo}</div>
      </div>`;

      const contenedor = el("contenidoPDF");
      contenedor.innerHTML = html;
      contenedor.style.display = "block";

      const pie = footerHtml(color, colorDark, logo, vendedor.nombre || "GI Store",
        vendedor.ciudad, vendedor.whatsapp, dominio, lista.length, hoy);
      const footerWrap = document.createElement("div");
      footerWrap.style.cssText = "position:absolute;left:-9999px;top:0;visibility:hidden";
      footerWrap.innerHTML = pie;
      document.body.appendChild(footerWrap);

      const nombre = (vendedor.nombre || "catalogo").replace(/\s+/g,"-").toLowerCase();

      const worker = html2pdf().set({
        margin:      [0,0,0,0],
        filename:    `catalogo-${nombre}.pdf`,
        image:       { type:"jpeg", quality:.97 },
        html2canvas: { scale:2, useCORS:true, allowTaint:true,
                       backgroundColor:"#f3f1ec", logging:false },
        jsPDF:       { unit:"mm", format:"a4", orientation:"portrait" },
        pagebreak:   { mode:["css"] },
      }).from(contenedor);

      const pdf       = await worker.toPdf().get("pdf");
      const totalPags = pdf.internal.getNumberOfPages();

      const footerEl = footerWrap.querySelector("#footerCaptura");
      let fImg = null, fH_MM = 0;
      const h2cFn = typeof html2canvas !== "undefined" ? html2canvas : null;
      if (h2cFn && footerEl) {
        try {
          const fc = await h2cFn(footerEl, {
            scale:2, useCORS:true, allowTaint:true, backgroundColor:null, logging:false });
          fImg  = fc.toDataURL("image/jpeg",.97);
          fH_MM = (fc.height / fc.width) * 210;
        } catch(e) { console.warn("footer canvas:", e); }
      }

      if (fImg && fH_MM > 0) {
        const yPos = 297 - fH_MM;
        for (let pg = 1; pg <= totalPags; pg++) {
          pdf.setPage(pg); pdf.addImage(fImg, "JPEG", 0, yPos, 210, fH_MM);
        }
      } else {
        const rgb = { r:parseInt(color.slice(1,3),16), g:parseInt(color.slice(3,5),16), b:parseInt(color.slice(5,7),16) };
        for (let pg = 1; pg <= totalPags; pg++) {
          pdf.setPage(pg);
          pdf.setFillColor(rgb.r, rgb.g, rgb.b);
          pdf.rect(0, 287, 210, 10, "F");
          pdf.setTextColor(255,255,255); pdf.setFontSize(7.5);
          pdf.text(`${vendedor.nombre||""}  ·  ${lista.length} productos  ·  ${hoy}`, 10, 293.5);
          pdf.text(`© ${new Date().getFullYear()} · Todos los derechos reservados`, 200, 293.5, { align:"right" });
        }
      }

      pdf.save(`catalogo-${nombre}.pdf`);
      document.body.removeChild(footerWrap);

    } catch(err) {
      console.error("Error PDF:", err);
      mostrarAlerta("No se pudo generar el PDF.\n\nDetalle: " + (err?.message || String(err)));
    } finally {
      const c = el("contenidoPDF");
      if (c) c.style.display = "none";
      btnCargando(btn, false);
    }
  });
}

// ══════════════════════════════════════════════════════════
//  Helpers UI
// ══════════════════════════════════════════════════════════
function escHtml(str) {
  return String(str ?? "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;")
    .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function mostrarAlerta(msg) {
  let modal = el("_modalAlertaCat");
  if (!modal) {
    modal = document.createElement("div");
    modal.id = "_modalAlertaCat";
    modal.innerHTML = `
      <div style="position:fixed;inset:0;background:rgba(0,0,0,.5);display:flex;
                  align-items:center;justify-content:center;z-index:9999;padding:1rem">
        <div style="background:#fff;border-radius:16px;padding:2rem;max-width:420px;
                    width:100%;box-shadow:0 20px 60px rgba(0,0,0,.2);
                    border-top:4px solid var(--error,#e53e3e)">
          <p id="_alertaMsg" style="font-size:.9rem;color:#333;margin:0 0 1.25rem"></p>
          <button id="_alertaBtn" style="background:var(--verde,#1a6b3c);color:#fff;border:none;
            padding:.65rem 1.5rem;border-radius:8px;cursor:pointer;font-weight:600;width:100%">Cerrar</button>
        </div>
      </div>`;
    document.body.appendChild(modal);
    document.getElementById("_alertaBtn").addEventListener("click", () => modal.style.display="none");
  }
  document.getElementById("_alertaMsg").textContent = msg;
  modal.style.display = "block";
}

function mostrarAlertaMembresia(mem) {
  const msg = mem
    ? "Tu membresía venció el " + mem.fecha_fin + ". Renueva para descargar el catálogo."
    : "No tienes membresía activa. Contacta al administrador.";
  let alerta = el("alertaMembresiaCatalogo");
  if (!alerta) {
    alerta = document.createElement("div");
    alerta.id = "alertaMembresiaCatalogo";
    const main = document.querySelector(".main");
    if (main && main.children[1]) main.insertBefore(alerta, main.children[1]);
    else if (main) main.appendChild(alerta);
  }
  alerta.innerHTML = `
    <div style="background:#fff3cd;border:1.5px solid #f59e0b;border-radius:10px;
                padding:1rem 1.25rem;margin-bottom:1.5rem;
                display:flex;align-items:center;gap:.75rem;flex-wrap:wrap">
      <span style="font-size:1.3rem">⚠️</span>
      <div style="flex:1">
        <strong style="color:#92400e;font-size:.9rem">Membresía inactiva</strong>
        <p style="color:#78350f;font-size:.82rem;margin:.2rem 0 0">${msg}</p>
      </div>
      <a href="membresia.html"
         style="background:#f59e0b;color:#fff;border-radius:8px;padding:.5rem 1rem;
                font-size:.82rem;font-weight:600;text-decoration:none;white-space:nowrap">
        Ir a membresía
      </a>
    </div>`;
}



// ══════════════════════════════════════════════════════════
//  INIT
// ══════════════════════════════════════════════════════════
cargar();