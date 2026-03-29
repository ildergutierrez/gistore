// ═══════════════════════════════════════════════════
//  EDITOR.JS — lógica completa del editor tipo Canva
// ═══════════════════════════════════════════════════

/* ── Estado ── */
let zoomLevel  = 100;
let imgZoom    = 100;
let imgX       = 0;
let imgY       = 0;
let bullet     = "✦";
let textAlign  = "left";
let topbarGrad = "linear-gradient(90deg,#1a6b3c,#22c55e,#4f46e5)";
let primaryClr = "#1a6b3c";

// ── Cargar datos desde localStorage (pasados por spotlight.js) ──
window.addEventListener("DOMContentLoaded", () => {
  const raw = localStorage.getItem("spotlight_data");
  if (raw) {
    try { cargarDatos(JSON.parse(raw)); } catch(e) { console.warn("No se pudo cargar datos:", e); }
  } else {
    // Sin datos: aplicar contraste sobre fondo blanco por defecto
    recalcularContraste("#ffffff");
  }
  initControls();
  initImageDrag();
  initTabs();
  initDirectEdit();
  poblarGradientes();
  autoZoom();
});

function cargarDatos(d) {
  set("inp-nombre",  d.nombre        || "");
  set("inp-precio",  d.precio        || "0");
  set("inp-cat",     d.categoria     || "");
  set("inp-marca",   d.marca         || "");
  set("inp-desc",    d.descripcion   || "");
  set("inp-ia",      d.iaTexto       || "");
  set("inp-reco",    d.recomendacion || "");
  set("inp-bens",    (d.beneficios   || []).join("\n"));
  set("inp-footer",  d.footerMarca   || "🌿 GI Store");
  set("inp-img-url", d.imagen        || "");

  actualizarTarjeta();
  if (d.imagen) aplicarImagen(d.imagen);
  if (d.topbarGrad) { topbarGrad = d.topbarGrad; document.getElementById("ed-topbar").style.background = topbarGrad; }
  if (d.primaryClr) { primaryClr = d.primaryClr; aplicarColorPrimario(primaryClr); }

  // Indicar modo en el header
  const subEl = document.querySelector(".sb-header .sub");
  if (subEl) {
    if (d.modoLibre) {
      subEl.innerHTML = '<span style="color:#0d9488;font-weight:700">✏️ Edición libre</span>';
    } else if (d.iaTexto) {
      subEl.innerHTML = '<span style="color:#6366f1;font-weight:700">✨ Con texto IA</span>';
    } else {
      subEl.innerHTML = '<span style="color:#22c55e;font-weight:700">📦 Producto cargado</span>';
    }
  }
  // Si hay texto IA, asegurarse de que el toggle esté activado
  const togIa = document.getElementById("tog-ia");
  if (togIa) togIa.checked = !!d.iaTexto;

  // Recalcular contraste según el fondo actual de la tarjeta
  const bgActual = document.getElementById("clr-bg").value || "#ffffff";
  recalcularContraste(bgActual);
}

function set(id, val) {
  const el = document.getElementById(id);
  if (el) el.value = val;
}

// ── Tabs ───────────────────────────────────────────
function initTabs() {
  document.querySelectorAll(".sb-tab").forEach(tab => {
    tab.addEventListener("click", () => {
      document.querySelectorAll(".sb-tab").forEach(t => t.classList.remove("activo"));
      document.querySelectorAll(".sb-section").forEach(s => s.classList.remove("activo"));
      tab.classList.add("activo");
      document.getElementById("tab-" + tab.dataset.tab).classList.add("activo");
    });
  });
}

// ── Controles de sidebar ───────────────────────────
function initControls() {
  // Inputs de texto → actualizan tarjeta en tiempo real
  ["inp-nombre","inp-precio","inp-cat","inp-marca","inp-desc","inp-ia","inp-reco","inp-bens","inp-footer"]
    .forEach(id => {
      const el = document.getElementById(id);
      if (el) el.addEventListener("input", actualizarTarjeta);
    });

  // Toggles
  document.getElementById("tog-reco").addEventListener("change", actualizarTarjeta);
  document.getElementById("tog-bens").addEventListener("change", actualizarTarjeta);
  document.getElementById("tog-ia"  ).addEventListener("change", actualizarTarjeta);

  // Imagen
  document.getElementById("rng-zoom"   ).addEventListener("input", e => { imgZoom = +e.target.value; document.getElementById("val-zoom").textContent = imgZoom + "%"; aplicarTransformImagen(); });
  document.getElementById("rng-imgx"   ).addEventListener("input", e => { imgX = +e.target.value; document.getElementById("val-imgx").textContent = imgX; aplicarTransformImagen(); });
  document.getElementById("rng-imgy"   ).addEventListener("input", e => { imgY = +e.target.value; document.getElementById("val-imgy").textContent = imgY; aplicarTransformImagen(); });
  document.getElementById("sel-filter" ).addEventListener("change", e => { document.getElementById("ed-img-el").style.filter = e.target.value === "none" ? "" : e.target.value; });
  document.getElementById("clr-overlay").addEventListener("input", actualizarOverlay);
  document.getElementById("rng-overlay").addEventListener("input", e => { document.getElementById("val-overlay").textContent = e.target.value + "%"; actualizarOverlay(); });
  document.getElementById("rng-imgH"   ).addEventListener("input", e => { const v = e.target.value; document.getElementById("val-imgH").textContent = v + "px"; document.getElementById("ed-inner").style.minHeight = v + "px"; });

  // Diseño
  document.getElementById("clr-primary").addEventListener("input", e => { primaryClr = e.target.value; aplicarColorPrimario(primaryClr); });
  document.getElementById("clr-bg"     ).addEventListener("input", e => {
    const bg = e.target.value;
    document.getElementById("ed-card").style.background = bg;
    recalcularContraste(bg);
  });
  document.getElementById("clr-imgbg"  ).addEventListener("input", e => { document.getElementById("ed-img-col").style.background = e.target.value; });
  document.getElementById("rng-radius" ).addEventListener("input", e => { const v = e.target.value; document.getElementById("val-radius").textContent = v + "px"; document.getElementById("ed-card").style.borderRadius = v + "px"; });
  document.getElementById("clr-badge-bg" ).addEventListener("input", actualizarBadge);
  document.getElementById("clr-badge-txt").addEventListener("input", actualizarBadge);

  // Layout
  document.getElementById("sel-font-titulo").addEventListener("change", e => {
    document.getElementById("ed-nombre").style.fontFamily = e.target.value + ", sans-serif";
  });
  document.getElementById("rng-titulo-sz").addEventListener("input", e => {
    const v = e.target.value; document.getElementById("val-titulo-sz").textContent = v + "px";
    document.getElementById("ed-nombre").style.fontSize = v + "px";
  });
  document.getElementById("rng-precio-sz").addEventListener("input", e => {
    const v = e.target.value; document.getElementById("val-precio-sz").textContent = v + "px";
    document.getElementById("ed-precio").style.fontSize = v + "px";
  });
  document.getElementById("rng-desc-sz").addEventListener("input", e => {
    const v = e.target.value; document.getElementById("val-desc-sz").textContent = v + "px";
    document.getElementById("ed-desc").style.fontSize = v + "px";
  });
  document.getElementById("rng-img-col").addEventListener("input", e => {
    const v = e.target.value; document.getElementById("val-img-col").textContent = v + "px";
    document.getElementById("ed-inner").style.gridTemplateColumns = v + "px 1fr";
  });
  document.getElementById("rng-card-w").addEventListener("input", e => {
    const v = e.target.value; document.getElementById("val-card-w").textContent = v + "px";
    document.getElementById("ed-card").style.width = v + "px";
  });
  document.getElementById("sel-bullet").addEventListener("change", e => {
    bullet = e.target.value; actualizarTarjeta();
  });
}

// ── Actualizar tarjeta ────────────────────────────
function actualizarTarjeta() {
  const nombre  = v("inp-nombre");
  const precio  = v("inp-precio");
  const cat     = v("inp-cat");
  const marca   = v("inp-marca");
  const desc    = v("inp-desc");
  const ia      = v("inp-ia");
  const reco    = v("inp-reco");
  const bensRaw = v("inp-bens");
  const footer  = v("inp-footer");

  setText("ed-nombre",       nombre  || "Nombre del producto");
  setText("ed-precio",       precio  || "0");
  setText("ed-cat-badge",    cat     || "Categoría");
  setText("ed-marca",        marca   || "Mi Tienda");
  setText("ed-desc",         desc    || "");
  setText("ed-footer-marca", footer  || "🌿 GI Store");

  // IA text
  const elIa = document.getElementById("ed-ia-txt");
  const togIa = document.getElementById("tog-ia").checked;
  if (ia && togIa) { elIa.textContent = ia; elIa.style.display = ""; }
  else { elIa.style.display = "none"; }

  // reco
  const elReco = document.getElementById("ed-reco");
  const togReco = document.getElementById("tog-reco").checked;
  if (reco && togReco) { elReco.textContent = "💡 " + reco; elReco.style.display = ""; }
  else { elReco.style.display = "none"; }

  // beneficios
  const elBens = document.getElementById("ed-bens");
  const togBens = document.getElementById("tog-bens").checked;
  const bens = bensRaw.split("\n").map(b => b.trim()).filter(Boolean);
  if (bens.length && togBens) {
    elBens.style.display = "";
    elBens.innerHTML = '<div class="ed-ben-titulo">Beneficios</div>';
    bens.forEach(b => {
      const div = document.createElement("div");
      div.className = "ed-ben-item";
      div.style.color = "#1f2937";  // contraste sobre blanco por defecto
      div.innerHTML = `<span class="ed-ben-bullet" style="color:${primaryClr}">${bullet}</span>${b}`;
      elBens.appendChild(div);
    });
  } else { elBens.style.display = "none"; }

  // alinear
  document.getElementById("ed-info-col").style.textAlign = textAlign;
}

function setText(id, txt) {
  const el = document.getElementById(id);
  if (el && !el.matches(":focus")) el.textContent = txt;
}
function v(id) { const el = document.getElementById(id); return el ? el.value : ""; }

// ── Imagen ────────────────────────────────────────
// ── Resolver URL de imagen según entorno ─────────────────────
// · Si ya tiene http:// o https:// → se usa tal cual
// · Si es ruta relativa → se construye la base según el host
function resolverUrlImagen(url) {
  if (!url) return "";
  url = url.trim();
  
  // Si ya tiene http/https, usarla tal cual (imagen en servidor externo)
  if (/^https?:\/\//i.test(url)) return url;
  
  // Si no tiene http, es local
  const ruta = url.replace(/^\//, "");
  const { hostname, port, protocol } = window.location;
  const base = `${protocol}//${hostname}${port ? ":" + port : ""}`;
  return `${base}/${ruta}`;
}

function aplicarUrlImagen() {
  const url = resolverUrlImagen(v("inp-img-url").trim());
  // Actualizar el input con la URL resuelta para que el usuario la vea
  const inp = document.getElementById("inp-img-url");
  if (inp && url) inp.value = url;
  aplicarImagen(url);
}
function aplicarImagen(url) {
  const img = document.getElementById("ed-img-el");
  const col = document.getElementById("ed-img-col");
  url = resolverUrlImagen(url);
  if (url) {
    img.src = url;
    img.style.display = "";
    img.onerror = () => {
      img.style.display = "none";
      col.style.background = "linear-gradient(135deg,#1a6b3c,#22c55e)";
    };
  } else {
    img.style.display = "none";
    col.style.background = "linear-gradient(135deg,#1a6b3c,#22c55e)";
  }
}
function aplicarTransformImagen() {
  const img = document.getElementById("ed-img-el");
  img.style.transform = `scale(${imgZoom/100}) translate(${imgX}px,${imgY}px)`;
}
function actualizarOverlay() {
  const clr = document.getElementById("clr-overlay").value;
  const op  = document.getElementById("rng-overlay").value;
  const hex = clr.replace("#","");
  const r   = parseInt(hex.slice(0,2),16);
  const g   = parseInt(hex.slice(2,4),16);
  const b   = parseInt(hex.slice(4,6),16);
  document.getElementById("ed-img-overlay").style.background =
    `rgba(${r},${g},${b},${op/100})`;
}

// drag imagen
function initImageDrag() {
  const col = document.getElementById("ed-img-col");
  let drag  = false, sx = 0, sy = 0, ox = 0, oy = 0;

  col.addEventListener("mousedown", e => {
    if (e.target.id === "ed-cat-badge") return;
    drag = true; sx = e.clientX; sy = e.clientY; ox = imgX; oy = imgY;
    col.classList.add("dragging");
  });
  window.addEventListener("mousemove", e => {
    if (!drag) return;
    imgX = ox + (e.clientX - sx) * .5;
    imgY = oy + (e.clientY - sy) * .5;
    document.getElementById("rng-imgx").value = Math.max(-100, Math.min(100, imgX));
    document.getElementById("rng-imgy").value = Math.max(-100, Math.min(100, imgY));
    document.getElementById("val-imgx").textContent = Math.round(imgX);
    document.getElementById("val-imgy").textContent = Math.round(imgY);
    aplicarTransformImagen();
  });
  window.addEventListener("mouseup", () => { drag = false; col.classList.remove("dragging"); });

  // rueda del mouse = zoom imagen
  col.addEventListener("wheel", e => {
    e.preventDefault();
    imgZoom = Math.max(80, Math.min(200, imgZoom - e.deltaY * .1));
    document.getElementById("rng-zoom").value = Math.round(imgZoom);
    document.getElementById("val-zoom").textContent = Math.round(imgZoom) + "%";
    aplicarTransformImagen();
  }, { passive: false });
}

// ── Color primario ────────────────────────────────
function aplicarColorPrimario(c) {
  document.getElementById("ed-precio").style.color       = c;
  document.getElementById("ed-divider").style.background = `linear-gradient(90deg,${c},${c}66)`;
  document.getElementById("ed-marca").style.color        = c;
  document.getElementById("ed-footer-marca").style.color = c;
  // badge categoría — solo el texto
  const badge = document.getElementById("ed-cat-badge");
  if (badge) badge.style.color = c;
  // bullets de beneficios
  document.querySelectorAll(".ed-ben-bullet").forEach(el => el.style.color = c);
  // reco: borde izquierdo
  const reco = document.getElementById("ed-reco");
  if (reco) reco.style.borderLeftColor = c;
  // actualizar el input de color si aún no lo hizo el usuario
  const inp = document.getElementById("clr-primary");
  if (inp) inp.value = c;
}

// ── Badge ─────────────────────────────────────────
function actualizarBadge() {
  const bgInput  = document.getElementById("clr-badge-bg");
  const txtInput = document.getElementById("clr-badge-txt");
  // Si el input de color de texto del badge aún está en su valor inicial (#1a6b3c),
  // sincronizarlo con el color primario actual para coherencia
  if (txtInput.value === "#1a6b3c" || txtInput.value === primaryClr.toLowerCase()) {
    txtInput.value = primaryClr;
  }
  const el = document.getElementById("ed-cat-badge");
  if (el) {
    el.style.background = bgInput.value;
    el.style.color      = txtInput.value;
  }
}

// ── Gradientes preset ─────────────────────────────
const GRADS = [
  "linear-gradient(90deg,#1a6b3c,#22c55e,#4f46e5)",
  "linear-gradient(90deg,#6366f1,#a855f7,#ec4899)",
  "linear-gradient(90deg,#f43f5e,#fb923c,#fbbf24)",
  "linear-gradient(90deg,#0ea5e9,#3b82f6,#6366f1)",
  "linear-gradient(90deg,#10b981,#06b6d4,#3b82f6)",
  "linear-gradient(90deg,#f59e0b,#ef4444,#ec4899)",
  "linear-gradient(90deg,#111827,#374151,#6b7280)",
  "linear-gradient(90deg,#7c3aed,#4f46e5,#2563eb)",
  "linear-gradient(90deg,#d97706,#f59e0b,#fbbf24)",
];
function poblarGradientes() {
  const cont = document.getElementById("grad-presets");
  GRADS.forEach((g, i) => {
    const div = document.createElement("div");
    div.className = "grad-swatch" + (i === 0 ? " activo" : "");
    div.style.background = g;
    div.title = "Aplicar gradiente";
    div.addEventListener("click", () => {
      topbarGrad = g;
      document.getElementById("ed-topbar").style.background = g;
      document.querySelectorAll(".grad-swatch").forEach(s => s.classList.remove("activo"));
      div.classList.add("activo");
    });
    cont.appendChild(div);
  });
}

// ── Paletas preset ────────────────────────────────
const PALETAS = {
  verde:  { primary:"#1a6b3c", bg:"#ffffff", imgbg:"#e8f5ee", badge_bg:"rgba(255,255,255,.92)", badge_txt:"#1a6b3c", grad:GRADS[0] },
  indigo: { primary:"#4f46e5", bg:"#ffffff", imgbg:"#eef2ff", badge_bg:"rgba(255,255,255,.92)", badge_txt:"#4f46e5", grad:GRADS[7] },
  rojo:   { primary:"#e11d48", bg:"#ffffff", imgbg:"#fff1f2", badge_bg:"rgba(255,255,255,.92)", badge_txt:"#e11d48", grad:GRADS[2] },
  dorado: { primary:"#b45309", bg:"#fffbeb", imgbg:"#fef3c7", badge_bg:"rgba(255,255,255,.9)",  badge_txt:"#92400e", grad:GRADS[8] },
  oscuro: { primary:"#22c55e", bg:"#111827", imgbg:"#1f2937", badge_bg:"rgba(0,0,0,.6)",        badge_txt:"#22c55e", grad:GRADS[6] },
  rosa:   { primary:"#db2777", bg:"#ffffff", imgbg:"#fdf2f8", badge_bg:"rgba(255,255,255,.92)", badge_txt:"#db2777", grad:GRADS[1] },
};
// ── Luminancia relativa para calcular contraste WCAG ────────
function luminancia(hex) {
  // Acepta hex 3 o 6 chars, con o sin #
  let h = hex.replace("#","");
  if (h.length === 3) h = h.split("").map(c=>c+c).join("");
  const [r,g,b] = [0,2,4].map(i => {
    const v = parseInt(h.slice(i,i+2),16)/255;
    return v <= 0.04045 ? v/12.92 : Math.pow((v+0.055)/1.055, 2.4);
  });
  return 0.2126*r + 0.7152*g + 0.0722*b;
}
function esFondoOscuro(hex) {
  try { return luminancia(hex) < 0.35; } catch { return false; }
}

// ── Recalcular todos los colores de texto según el fondo ────
function recalcularContraste(bgHex) {
  const oscuro = esFondoOscuro(bgHex);

  // Textos principales
  const colorTitulo = oscuro ? "#f9fafb"           : "#111827";
  const colorDesc   = oscuro ? "#d1d5db"           : "#1f2937";
  const colorBens   = oscuro ? "#e5e7eb"           : "#111827";
  const colorBenTit = oscuro ? "#94a3b8"           : "#374151";
  const colorIaTxt  = oscuro ? "#cbd5e1"           : "#1f2937";
  const colorMoneda = oscuro ? "#94a3b8"           : "#4b5563";
  // Pie de tarjeta
  const colorFooterBg  = oscuro ? "rgba(255,255,255,.06)" : "#f3f4f6";
  const colorFooterBrd = oscuro ? "rgba(255,255,255,.10)" : "#d1d5db";
  const colorFtrTxt    = oscuro ? "#94a3b8"              : "#4b5563";
  // Recomendación
  const colorRecoBg = oscuro ? "rgba(34,197,94,.14)"  : "#f0fdf4";
  const colorRecoTx = oscuro ? "#86efac"              : "#14532d";
  const colorRecoBrd= oscuro ? "#22c55e"              : "#22c55e";
  // Separador IA texto
  const colorIaBrd  = oscuro ? "rgba(255,255,255,.12)": "#d1d5db";

  // Aplicar
  document.getElementById("ed-nombre").style.color        = colorTitulo;
  document.getElementById("ed-desc").style.color          = colorDesc;
  document.getElementById("ed-ia-txt").style.color        = colorIaTxt;
  document.getElementById("ed-ia-txt").style.borderTopColor = colorIaBrd;
  document.getElementById("ed-moneda").style.color        = colorMoneda;
  document.getElementById("ed-footer").style.background   = colorFooterBg;
  document.getElementById("ed-footer").style.borderTopColor = colorFooterBrd;
  document.getElementById("ed-footer-ia").style.color     = colorFtrTxt;
  document.getElementById("ed-reco").style.background     = colorRecoBg;
  document.getElementById("ed-reco").style.color          = colorRecoTx;
  document.getElementById("ed-reco").style.borderLeftColor= colorRecoBrd;
  document.querySelectorAll(".ed-ben-item").forEach(el   => el.style.color = colorBens);
  document.querySelectorAll(".ed-ben-titulo").forEach(el => el.style.color = colorBenTit);
}

function aplicarPaletaPreset(key) {
  const p = PALETAS[key]; if (!p) return;
  primaryClr = p.primary;

  document.getElementById("clr-primary"  ).value = p.primary;
  document.getElementById("clr-bg"       ).value = p.bg;
  document.getElementById("clr-imgbg"    ).value = p.imgbg;
  document.getElementById("clr-badge-bg" ).value = p.badge_bg;
  document.getElementById("clr-badge-txt").value = p.badge_txt;

  document.getElementById("ed-card").style.background     = p.bg;
  document.getElementById("ed-img-col").style.background  = p.imgbg;
  topbarGrad = p.grad;
  document.getElementById("ed-topbar").style.background   = topbarGrad;

  recalcularContraste(p.bg);
  aplicarColorPrimario(primaryClr);
  actualizarBadge();
  actualizarTarjeta();
  toast("Paleta aplicada ✓");
}

// ── Alineación ────────────────────────────────────
function setAlign(a) {
  textAlign = a;
  document.getElementById("ed-info-col").style.textAlign = a;
}

// ── Edición directa por clic ──────────────────────
function initDirectEdit() {
  document.querySelectorAll("[contenteditable='true']").forEach(el => {
    el.addEventListener("focus", () => el.classList.add("ed-sel-ring"));
    el.addEventListener("blur",  () => el.classList.remove("ed-sel-ring"));
  });
}

// ── Zoom del canvas ───────────────────────────────
function zoom(delta) {
  if (delta === 0) { autoZoom(); return; }
  zoomLevel = Math.max(30, Math.min(200, zoomLevel + delta));
  aplicarZoom();
}
function autoZoom() {
  const area  = document.getElementById("canvas-scroll");
  const card  = document.getElementById("ed-card");
  const avail = area.clientWidth - 80;
  const cw    = card.offsetWidth || 780;
  zoomLevel   = Math.min(100, Math.floor((avail / cw) * 100));
  aplicarZoom();
}
function aplicarZoom() {
  document.getElementById("card-wrapper").style.transform = `scale(${zoomLevel/100})`;
  document.getElementById("zoom-val").textContent = zoomLevel + "%";
}

// ── Exportar PNG ──────────────────────────────────
async function exportarPNG() {
  const card = document.getElementById("ed-card");
  // quitar anillo de selección temporal
  document.querySelectorAll(".ed-sel-ring").forEach(el => el.classList.remove("ed-sel-ring"));

  const loadEl = document.getElementById("edLoading");
  document.getElementById("edLoadingMsg").textContent = "Generando PNG de alta resolución…";
  loadEl.classList.add("vis");

  try {
    const scale = 2.5;
    const canvas = await html2canvas(card, {
      scale, useCORS: true, allowTaint: true,
      backgroundColor: null, logging: false,
    });

    const nombre = (document.getElementById("ed-nombre").textContent || "producto")
      .normalize("NFD").replace(/[\u0300-\u036f]/g,"")
      .replace(/\s+/g,"-").toLowerCase().slice(0,40);

    const link = document.createElement("a");
    link.download = `spotlight-${nombre}.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
    toast("✅ PNG exportado");
  } catch(e) {
    console.error(e);
    toast("⚠️ Error al exportar");
  } finally {
    loadEl.classList.remove("vis");
  }
}

// ── Resetear ──────────────────────────────────────
function resetear() {
  if (!confirm("¿Restablecer todos los cambios?")) return;
  const raw = localStorage.getItem("spotlight_data");
  if (raw) { try { cargarDatos(JSON.parse(raw)); } catch(e){} }
  toast("Restablecido ✓");
}

// ── Toast ─────────────────────────────────────────
let toastTimer;
function toast(msg) {
  const el = document.getElementById("toast");
  el.textContent = msg;
  el.classList.add("vis");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove("vis"), 2500);
}

// ── Sidebar móvil ─────────────────────────────────
function toggleSidebar() {
  document.getElementById("sidebar").classList.toggle("mob-open");
}

window.addEventListener("resize", autoZoom);

// ── Edición libre — abre editor en blanco en nueva ventana ──
function abrirEdicionLibre() {
  // Guarda en localStorage con clave distinta para no pisar el producto actual
  const datos_libre = {
    nombre:        "Mi Producto",
    precio:        "0",
    categoria:     "Categoría",
    marca:         "Mi Tienda",
    descripcion:   "Escribe aquí la descripción de tu producto.",
    iaTexto:       "Agrega aquí tu copy publicitario…",
    recomendacion: "",
    beneficios:    ["Beneficio 1", "Beneficio 2"],
    imagen:        "",
    footerMarca:   "🌿 Mi Tienda",
    topbarGrad:    "linear-gradient(90deg,#1a6b3c,#22c55e,#4f46e5)",
    primaryClr:    "#1a6b3c",
    modoLibre:     true,
  };
  localStorage.setItem("spotlight_data", JSON.stringify(datos_libre));
  window.open("editor.html", "_blank");
}

// ════════════════════════════════════════════════════════════════
//  TEXTOS LIBRES ARRASTRABLES
//  Permite añadir bloques de texto encima de la tarjeta,
//  moverlos libremente con drag, editar inline, cambiar estilo
//  y eliminarlos. Se exportan junto con el PNG.
// ════════════════════════════════════════════════════════════════

let txtLibreCounter = 0;
let txtSeleccionado = null; // el bloque actualmente seleccionado

/* ── Contenedor sobre la tarjeta ─────────────────────────────── */
function getOverlay() {
  let ov = document.getElementById("txt-overlay");
  if (!ov) {
    ov = document.createElement("div");
    ov.id = "txt-overlay";
    ov.style.cssText = `
      position:absolute;inset:0;pointer-events:none;z-index:10;
      overflow:hidden;border-radius:inherit;
    `;
    document.getElementById("ed-card").style.position = "relative";
    document.getElementById("ed-card").appendChild(ov);
  }
  return ov;
}

/* ── Panel de propiedades del texto seleccionado ─────────────── */
function crearPanelTextoLibre() {
  if (document.getElementById("panel-txt-libre")) return;
  const panel = document.createElement("div");
  panel.id = "panel-txt-libre";
  panel.style.cssText = `
    display:none;flex-direction:column;gap:.6rem;
    padding:.85rem;border-top:1px solid var(--panel-borde);
    background:rgba(255,255,255,.03);
  `;
  panel.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:space-between">
      <span style="font-size:.72rem;font-weight:700;text-transform:uppercase;
                   letter-spacing:.06em;color:#6366f1">✏️ Texto seleccionado</span>
      <button onclick="eliminarTextoSeleccionado()"
        style="background:#ef4444;border:none;color:#fff;border-radius:5px;
               padding:.2rem .55rem;cursor:pointer;font-size:.75rem;font-weight:700">
        🗑 Borrar
      </button>
    </div>

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:.5rem">
      <div>
        <div class="sb-label" style="margin-bottom:.25rem">Tamaño</div>
        <div style="display:flex;align-items:center;gap:.4rem">
          <input type="range" min="8" max="96" value="20" id="tl-size"
            class="sb-range" oninput="aplicarEstiloTxt('size',this.value)"/>
          <span id="tl-size-val" style="font-size:.75rem;color:var(--acento);min-width:28px">20px</span>
        </div>
      </div>
      <div>
        <div class="sb-label" style="margin-bottom:.25rem">Opacidad</div>
        <div style="display:flex;align-items:center;gap:.4rem">
          <input type="range" min="10" max="100" value="100" id="tl-opacity"
            class="sb-range" oninput="aplicarEstiloTxt('opacity',this.value)"/>
          <span id="tl-opacity-val" style="font-size:.75rem;color:var(--acento);min-width:28px">100%</span>
        </div>
      </div>
    </div>

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:.5rem">
      <div>
        <div class="sb-label" style="margin-bottom:.25rem">Color</div>
        <input type="color" id="tl-color" value="#111827"
          class="sb-color" style="width:100%;height:32px"
          oninput="aplicarEstiloTxt('color',this.value)"/>
      </div>
      <div>
        <div class="sb-label" style="margin-bottom:.25rem">Fondo</div>
        <div style="display:flex;gap:.3rem;align-items:center">
          <input type="color" id="tl-bg" value="#ffffff"
            class="sb-color" style="flex:1;height:32px"
            oninput="aplicarEstiloTxt('bg',this.value)"/>
          <button onclick="aplicarEstiloTxt('bg','transparent')"
            style="background:none;border:1px solid var(--panel-borde);color:var(--texto-suave);
                   border-radius:5px;padding:.25rem .4rem;cursor:pointer;font-size:.7rem">
            Ninguno
          </button>
        </div>
      </div>
    </div>

    <div>
      <div class="sb-label" style="margin-bottom:.25rem">Fuente</div>
      <select id="tl-font" class="sb-select" onchange="aplicarEstiloTxt('font',this.value)">
        <option value="Inter">Inter</option>
        <option value="Nunito">Nunito</option>
        <option value="Playfair Display">Playfair Display</option>
        <option value="Oswald">Oswald</option>
        <option value="Montserrat">Montserrat</option>
      </select>
    </div>

    <div style="display:flex;gap:.4rem;flex-wrap:wrap">
      <button onclick="aplicarEstiloTxt('bold')"      class="btn-sb btn-sb-outline" style="flex:1;min-width:50px;padding:.35rem;font-size:.8rem;font-weight:800">B</button>
      <button onclick="aplicarEstiloTxt('italic')"    class="btn-sb btn-sb-outline" style="flex:1;min-width:50px;padding:.35rem;font-size:.8rem;font-style:italic">I</button>
      <button onclick="aplicarEstiloTxt('underline')" class="btn-sb btn-sb-outline" style="flex:1;min-width:50px;padding:.35rem;font-size:.8rem;text-decoration:underline">U</button>
      <button onclick="aplicarEstiloTxt('upper')"     class="btn-sb btn-sb-outline" style="flex:1;min-width:50px;padding:.35rem;font-size:.75rem">AA</button>
    </div>

    <div style="display:flex;gap:.4rem">
      <button onclick="aplicarEstiloTxt('align','left')"   class="btn-sb btn-sb-outline" style="flex:1;padding:.35rem;font-size:.9rem">◀</button>
      <button onclick="aplicarEstiloTxt('align','center')" class="btn-sb btn-sb-outline" style="flex:1;padding:.35rem;font-size:.9rem">◉</button>
      <button onclick="aplicarEstiloTxt('align','right')"  class="btn-sb btn-sb-outline" style="flex:1;padding:.35rem;font-size:.9rem">▶</button>
    </div>

    <div>
      <div class="sb-label" style="margin-bottom:.25rem">Radio de borde</div>
      <div style="display:flex;align-items:center;gap:.4rem">
        <input type="range" min="0" max="40" value="6" id="tl-radius"
          class="sb-range" oninput="aplicarEstiloTxt('radius',this.value)"/>
        <span id="tl-radius-val" style="font-size:.75rem;color:var(--acento);min-width:28px">6px</span>
      </div>
    </div>

    <div style="display:flex;gap:.4rem">
      <button onclick="duplicarTextoSeleccionado()"
        class="btn-sb btn-sb-outline" style="flex:1;font-size:.78rem;padding:.4rem">
        <span class="material-symbols-outlined" style="font-size:.9rem">content_copy</span> Duplicar
      </button>
      <button onclick="subirCapaTexto()"   class="btn-sb btn-sb-outline" style="flex:1;font-size:.78rem;padding:.4rem">↑ Subir</button>
      <button onclick="bajarCapaTexto()"   class="btn-sb btn-sb-outline" style="flex:1;font-size:.78rem;padding:.4rem">↓ Bajar</button>
    </div>
  `;
  // insertar en el sidebar body, antes del primer section activo
  const sbBody = document.querySelector(".sb-body");
  sbBody.appendChild(panel);
}

/* ── Añadir bloque de texto ──────────────────────────────────── */
function añadirTextoLibre(opts = {}) {
  const overlay = getOverlay();
  txtLibreCounter++;
  const id = "tl-" + txtLibreCounter;

  const bloque = document.createElement("div");
  bloque.id = id;
  bloque.contentEditable = "true";
  bloque.spellcheck = false;
  bloque.dataset.tipo = "texto-libre";
  bloque.textContent = opts.texto || "Texto libre";

  // Estado interno del bloque
  bloque._posX      = opts.x       ?? 20;
  bloque._posY      = opts.y       ?? 20;
  bloque._fontSize  = opts.size    ?? 20;
  bloque._color     = opts.color   ?? "#111827";
  bloque._bg        = opts.bg      ?? "transparent";
  bloque._font      = opts.font    ?? "Inter";
  bloque._opacity   = opts.opacity ?? 100;
  bloque._radius    = opts.radius  ?? 6;
  bloque._bold      = opts.bold    ?? false;
  bloque._italic    = opts.italic  ?? false;
  bloque._underline = opts.underline ?? false;
  bloque._upper     = opts.upper   ?? false;
  bloque._align     = opts.align   ?? "left";

  aplicarEstilosBloque(bloque);

  bloque.style.cssText += `
    position:absolute;
    left:${bloque._posX}px;
    top:${bloque._posY}px;
    min-width:60px;min-height:28px;
    padding:4px 8px;
    cursor:move;
    user-select:none;
    pointer-events:all;
    outline:none;
    white-space:pre-wrap;
    word-break:break-word;
    max-width:90%;
    box-sizing:border-box;
  `;

  // Seleccionar al hacer clic
  bloque.addEventListener("mousedown", e => {
    if (e.detail === 2) return; // doble clic = editar
    seleccionarBloque(bloque);
    if (!bloque.isContentEditable || document.activeElement !== bloque) {
      iniciarDragBloque(bloque, e);
    }
  });

  bloque.addEventListener("dblclick", () => {
    bloque.focus();
    const range = document.createRange();
    range.selectNodeContents(bloque);
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
  });

  bloque.addEventListener("focus",  () => seleccionarBloque(bloque));
  bloque.addEventListener("blur",   () => {
    bloque.style.outline = "none";
  });

  overlay.appendChild(bloque);
  seleccionarBloque(bloque);
  return bloque;
}

/* ── Aplicar estilos CSS al bloque ───────────────────────────── */
function aplicarEstilosBloque(b) {
  b.style.fontSize       = b._fontSize + "px";
  b.style.color          = b._color;
  b.style.background     = b._bg;
  b.style.fontFamily     = b._font + ", sans-serif";
  b.style.opacity        = b._opacity / 100;
  b.style.borderRadius   = b._radius + "px";
  b.style.fontWeight     = b._bold      ? "800" : "400";
  b.style.fontStyle      = b._italic    ? "italic" : "normal";
  b.style.textDecoration = b._underline ? "underline" : "none";
  b.style.textTransform  = b._upper     ? "uppercase" : "none";
  b.style.textAlign      = b._align;
  b.style.padding        = b._bg !== "transparent" ? "6px 12px" : "4px 8px";
}

/* ── Seleccionar bloque ──────────────────────────────────────── */
function seleccionarBloque(bloque) {
  // Quitar selección anterior
  if (txtSeleccionado && txtSeleccionado !== bloque) {
    txtSeleccionado.style.outline = "none";
    txtSeleccionado.style.boxShadow = "none";
  }
  txtSeleccionado = bloque;
  bloque.style.outline = "2px dashed #6366f1";
  bloque.style.outlineOffset = "3px";

  // Mostrar panel y sincronizar controles
  const panel = document.getElementById("panel-txt-libre");
  if (panel) {
    panel.style.display = "flex";
    document.getElementById("tl-size").value       = bloque._fontSize;
    document.getElementById("tl-size-val").textContent = bloque._fontSize + "px";
    document.getElementById("tl-color").value      = bloque._color.startsWith("#") ? bloque._color : "#111827";
    document.getElementById("tl-bg").value         = bloque._bg.startsWith("#") ? bloque._bg : "#ffffff";
    document.getElementById("tl-font").value       = bloque._font;
    document.getElementById("tl-opacity").value    = bloque._opacity;
    document.getElementById("tl-opacity-val").textContent = bloque._opacity + "%";
    document.getElementById("tl-radius").value     = bloque._radius;
    document.getElementById("tl-radius-val").textContent = bloque._radius + "px";
  }
}

/* ── Aplicar estilo desde el panel ──────────────────────────── */
function aplicarEstiloTxt(prop, val) {
  const b = txtSeleccionado; if (!b) return;
  switch(prop) {
    case "size":      b._fontSize  = +val;  document.getElementById("tl-size-val").textContent = val + "px"; break;
    case "color":     b._color     = val;   break;
    case "bg":        b._bg        = val;   break;
    case "font":      b._font      = val;   break;
    case "opacity":   b._opacity   = +val;  document.getElementById("tl-opacity-val").textContent = val + "%"; break;
    case "radius":    b._radius    = +val;  document.getElementById("tl-radius-val").textContent = val + "px"; break;
    case "bold":      b._bold      = !b._bold;      break;
    case "italic":    b._italic    = !b._italic;    break;
    case "underline": b._underline = !b._underline; break;
    case "upper":     b._upper     = !b._upper;     break;
    case "align":     b._align     = val;           break;
  }
  aplicarEstilosBloque(b);
  // Mantener el outline de selección
  b.style.outline = "2px dashed #6366f1";
  b.style.outlineOffset = "3px";
}

/* ── Drag del bloque ─────────────────────────────────────────── */
function iniciarDragBloque(bloque, e) {
  e.preventDefault();
  const card    = document.getElementById("ed-card");
  const rect    = card.getBoundingClientRect();
  const scale   = zoomLevel / 100;
  const startX  = (e.clientX - rect.left) / scale - bloque._posX;
  const startY  = (e.clientY - rect.top)  / scale - bloque._posY;

  function onMove(ev) {
    bloque._posX = Math.max(0, (ev.clientX - rect.left) / scale - startX);
    bloque._posY = Math.max(0, (ev.clientY - rect.top)  / scale - startY);
    bloque.style.left = bloque._posX + "px";
    bloque.style.top  = bloque._posY + "px";
  }
  function onUp() {
    window.removeEventListener("mousemove", onMove);
    window.removeEventListener("mouseup",   onUp);
  }
  window.addEventListener("mousemove", onMove);
  window.addEventListener("mouseup",   onUp);
}

/* ── Deseleccionar al clicar fuera ───────────────────────────── */
document.getElementById("ed-card").addEventListener("click", e => {
  if (!e.target.dataset.tipo && txtSeleccionado) {
    txtSeleccionado.style.outline = "none";
    txtSeleccionado = null;
    const panel = document.getElementById("panel-txt-libre");
    if (panel) panel.style.display = "none";
  }
});

/* ── Acciones del panel ──────────────────────────────────────── */
function eliminarTextoSeleccionado() {
  if (!txtSeleccionado) return;
  if (!confirm("¿Eliminar este texto?")) return;
  txtSeleccionado.remove();
  txtSeleccionado = null;
  const panel = document.getElementById("panel-txt-libre");
  if (panel) panel.style.display = "none";
}

function duplicarTextoSeleccionado() {
  const b = txtSeleccionado; if (!b) return;
  añadirTextoLibre({
    texto:     b.textContent,
    x:         b._posX + 15, y: b._posY + 15,
    size:      b._fontSize,  color: b._color,
    bg:        b._bg,        font:  b._font,
    opacity:   b._opacity,   radius: b._radius,
    bold:      b._bold,      italic: b._italic,
    underline: b._underline, upper: b._upper,
    align:     b._align,
  });
}

function subirCapaTexto() {
  if (!txtSeleccionado) return;
  const z = parseInt(txtSeleccionado.style.zIndex || "10");
  txtSeleccionado.style.zIndex = z + 1;
}
function bajarCapaTexto() {
  if (!txtSeleccionado) return;
  const z = parseInt(txtSeleccionado.style.zIndex || "10");
  txtSeleccionado.style.zIndex = Math.max(10, z - 1);
}

/* ── Tecla Delete/Backspace cuando no está editando ─────────── */
document.addEventListener("keydown", e => {
  if ((e.key === "Delete" || e.key === "Backspace") &&
      txtSeleccionado &&
      document.activeElement !== txtSeleccionado) {
    eliminarTextoSeleccionado();
  }
  // Escape = deseleccionar
  if (e.key === "Escape" && txtSeleccionado) {
    txtSeleccionado.style.outline = "none";
    txtSeleccionado = null;
    const panel = document.getElementById("panel-txt-libre");
    if (panel) panel.style.display = "none";
  }
});

/* ── Parche exportarPNG: ocultar outlines de textos libres ──── */
// Se sobrescribe la función definida arriba añadiendo la limpieza de outlines
(function() {
  const _orig = exportarPNG;
  exportarPNG = async function() {
    // Ocultar outlines y panel de propiedades
    document.querySelectorAll("[data-tipo='texto-libre']").forEach(b => {
      b.style.outline = "none";
    });
    txtSeleccionado = null;
    const panel = document.getElementById("panel-txt-libre");
    if (panel) panel.style.display = "none";
    await _orig();
  };
})();

/* ── Inicializar botón y panel al cargar ─────────────────────── */
window.addEventListener("DOMContentLoaded", () => {
  crearPanelTextoLibre();
}, { once: false }); // se llama después del DOMContentLoaded original