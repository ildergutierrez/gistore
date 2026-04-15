// ═══════════════════════════════════════════════════
//  EDITOR.JS — lógica completa del editor tipo Canva
//  · Imagen sin recorte: object-fit + object-position (compatible html2canvas)
//  · Zoom con slider/rueda mueve object-position, no scale/transform
//  · Subida de imagen local (file input)
//  · Controles de color/fuente/tamaño para textos de BD
//  · Sin Firebase — datos vienen de localStorage (spotlight.js)
// ═══════════════════════════════════════════════════

/* ── Estado ── */
let zoomLevel  = 200;
let imgObjX    = 50;   // % horizontal (0=izq, 100=der)
let imgObjY    = 50;   // % vertical   (0=arriba, 100=abajo)
let imgScale   = 100;  // % de zoom
let bullet     = "✦";
let textAlign  = "left";
let topbarGrad = "linear-gradient(90deg,#1a6b3c,#22c55e,#4f46e5)";
let primaryClr = "#1a6b3c";

// ── Color de items de beneficios (persiste al refrescar la lista) ──
let _bensTxtColor = "#111827";

// ── Cargar datos desde localStorage (pasados por spotlight.js) ──
window.addEventListener("DOMContentLoaded", () => {
  const raw = localStorage.getItem("spotlight_data");
  if (raw) {
    try { cargarDatos(JSON.parse(raw)); } catch(e) { console.warn("No se pudo cargar datos:", e); }
  } else {
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
  set("inp-bens",    Array.isArray(d.beneficios) ? d.beneficios.join("\n") : (d.beneficios || ""));
  set("inp-footer",  d.footerMarca   || "🌿 GI Store");
  set("inp-img-url", d.imagen        || "");

  actualizarTarjeta();
  if (d.imagen) aplicarImagen(d.imagen);
  if (d.topbarGrad) { topbarGrad = d.topbarGrad; document.getElementById("ed-topbar").style.background = topbarGrad; }
  if (d.primaryClr) { primaryClr = d.primaryClr; aplicarColorPrimario(primaryClr); }

  const subEl = document.querySelector(".sb-header .sub");
  if (subEl) {
    if (d.modoLibre)  subEl.innerHTML = '<span style="color:#0d9488;font-weight:700">✏️ Edición libre</span>';
    else if (d.iaTexto) subEl.innerHTML = '<span style="color:#6366f1;font-weight:700">✨ Con texto IA</span>';
    else              subEl.innerHTML = '<span style="color:#22c55e;font-weight:700">📦 Producto cargado</span>';
  }

  const togIa = document.getElementById("tog-ia");
  if (togIa) togIa.checked = !!d.iaTexto;

  const bgActual = document.getElementById("clr-bg")?.value || "#ffffff";
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
      document.getElementById("tab-" + tab.dataset.tab)?.classList.add("activo");
    });
  });
}

// ── Controles de sidebar ───────────────────────────
function initControls() {
  ["inp-nombre","inp-precio","inp-cat","inp-marca","inp-desc","inp-ia","inp-reco","inp-bens","inp-footer"]
    .forEach(id => document.getElementById(id)?.addEventListener("input", actualizarTarjeta));

  document.getElementById("tog-reco")?.addEventListener("change", actualizarTarjeta);
  document.getElementById("tog-bens")?.addEventListener("change", actualizarTarjeta);
  document.getElementById("tog-ia"  )?.addEventListener("change", actualizarTarjeta);

  // Imagen: zoom con object-fit/object-position
  document.getElementById("rng-zoom")?.addEventListener("input", e => {
    imgScale = +e.target.value;
    document.getElementById("val-zoom").textContent = imgScale + "%";
    aplicarTransformImagen();
  });
  document.getElementById("rng-imgx")?.addEventListener("input", e => {
    imgObjX = +e.target.value;
    document.getElementById("val-imgx").textContent = imgObjX;
    aplicarTransformImagen();
  });
  document.getElementById("rng-imgy")?.addEventListener("input", e => {
    imgObjY = +e.target.value;
    document.getElementById("val-imgy").textContent = imgObjY;
    aplicarTransformImagen();
  });

  document.getElementById("sel-filter")?.addEventListener("change", e => {
    document.getElementById("ed-img-el").style.filter = e.target.value === "none" ? "" : e.target.value;
  });
  document.getElementById("clr-overlay")?.addEventListener("input", actualizarOverlay);
  document.getElementById("rng-overlay")?.addEventListener("input", e => {
    document.getElementById("val-overlay").textContent = e.target.value + "%";
    actualizarOverlay();
  });
  document.getElementById("rng-imgH")?.addEventListener("input", e => {
    const v = e.target.value;
    document.getElementById("val-imgH").textContent = v + "px";
    document.getElementById("ed-inner").style.minHeight = v + "px";
  });

  // Diseño
  document.getElementById("clr-primary")?.addEventListener("input", e => { primaryClr = e.target.value; aplicarColorPrimario(primaryClr); });
  document.getElementById("clr-bg")?.addEventListener("input", e => {
    document.getElementById("ed-card").style.background = e.target.value;
    recalcularContraste(e.target.value);
  });
  document.getElementById("clr-imgbg")?.addEventListener("input", e => { document.getElementById("ed-img-col").style.background = e.target.value; });
  document.getElementById("rng-radius")?.addEventListener("input", e => {
    const v = e.target.value;
    document.getElementById("val-radius").textContent = v + "px";
    document.getElementById("ed-card").style.borderRadius = v + "px";
  });
  document.getElementById("clr-badge-bg" )?.addEventListener("input", actualizarBadge);
  document.getElementById("clr-badge-txt")?.addEventListener("input", actualizarBadge);

  // Layout — tipografía base
  document.getElementById("sel-font-titulo")?.addEventListener("change", e => {
    document.getElementById("ed-nombre").style.fontFamily = e.target.value + ", sans-serif";
  });
  document.getElementById("rng-titulo-sz")?.addEventListener("input", e => {
    const v = e.target.value;
    document.getElementById("val-titulo-sz").textContent = v + "px";
    document.getElementById("ed-nombre").style.fontSize = v + "px";
  });
  document.getElementById("rng-precio-sz")?.addEventListener("input", e => {
    const v = e.target.value;
    document.getElementById("val-precio-sz").textContent = v + "px";
    document.getElementById("ed-precio").style.fontSize = v + "px";
  });
  document.getElementById("rng-desc-sz")?.addEventListener("input", e => {
    const v = e.target.value;
    document.getElementById("val-desc-sz").textContent = v + "px";
    document.getElementById("ed-desc").style.fontSize = v + "px";
  });
  document.getElementById("rng-img-col")?.addEventListener("input", e => {
    const v = e.target.value;
    document.getElementById("val-img-col").textContent = v + "px";
    document.getElementById("ed-inner").style.gridTemplateColumns = v + "px 1fr";
  });
  document.getElementById("rng-card-w")?.addEventListener("input", e => {
    const v = e.target.value;
    document.getElementById("val-card-w").textContent = v + "px";
    document.getElementById("ed-card").style.width = v + "px";
  });
  document.getElementById("sel-bullet")?.addEventListener("change", e => {
    bullet = e.target.value; actualizarTarjeta();
  });

  // ── Controles de estilo para textos de BD ─────────────────────

  // Descripción — color
  document.getElementById("clr-desc-txt")?.addEventListener("input", e => {
    document.getElementById("ed-desc").style.color = e.target.value;
  });
  // Descripción — fuente
  document.getElementById("sel-font-desc")?.addEventListener("change", e => {
    document.getElementById("ed-desc").style.fontFamily = e.target.value + ", sans-serif";
  });

  // Beneficios — color items
  document.getElementById("clr-bens-txt")?.addEventListener("input", e => {
    _bensTxtColor = e.target.value;
    document.querySelectorAll(".ed-ben-item").forEach(el => el.style.color = _bensTxtColor);
  });
  // Beneficios — tamaño
  document.getElementById("rng-bens-sz")?.addEventListener("input", e => {
    const v = e.target.value;
    document.getElementById("val-bens-sz").textContent = v + "px";
    document.getElementById("ed-bens").style.fontSize = v + "px";
  });

  // Recomendación — color
  document.getElementById("clr-reco-txt")?.addEventListener("input", e => {
    document.getElementById("ed-reco").style.color = e.target.value;
  });
  // Recomendación — tamaño
  document.getElementById("rng-reco-sz")?.addEventListener("input", e => {
    const v = e.target.value;
    document.getElementById("val-reco-sz").textContent = v + "px";
    document.getElementById("ed-reco").style.fontSize = v + "px";
  });

  // Texto IA — color
  document.getElementById("clr-ia-txt")?.addEventListener("input", e => {
    document.getElementById("ed-ia-txt").style.color = e.target.value;
  });
  // Texto IA — tamaño
  document.getElementById("rng-ia-sz")?.addEventListener("input", e => {
    const v = e.target.value;
    document.getElementById("val-ia-sz").textContent = v + "px";
    document.getElementById("ed-ia-txt").style.fontSize = v + "px";
  });

  // ── Subida de imagen local ─────────────────────────────────
  const fileInput = document.getElementById("inp-img-file");
  if (fileInput) {
    fileInput.addEventListener("change", e => {
      const file = e.target.files?.[0];
      if (!file) return;
      if (!file.type.startsWith("image/")) {
        toast("⚠️ Selecciona un archivo de imagen válido");
        return;
      }
      const reader = new FileReader();
      reader.onload = ev => {
        const dataUrl = ev.target.result;
        const urlInput = document.getElementById("inp-img-url");
        if (urlInput) urlInput.value = "(imagen local cargada)";
        aplicarImagen(dataUrl);
        imgObjX = 50; imgObjY = 50; imgScale = 100;
        sincronizarSlidersImagen();
        aplicarTransformImagen();
        toast("✅ Imagen cargada");
      };
      reader.readAsDataURL(file);
    });
  }
}

// ── Actualizar tarjeta ────────────────────────────
function actualizarTarjeta() {
  setText("ed-nombre",       v("inp-nombre")  || "Nombre del producto");
  setText("ed-precio",       v("inp-precio")  || "0");
  setText("ed-cat-badge",    v("inp-cat")     || "Categoría");
  setText("ed-marca",        v("inp-marca")   || "Mi Tienda");
  setText("ed-desc",         v("inp-desc")    || "");
  setText("ed-footer-marca", v("inp-footer")  || "🌿 GI Store");

  const ia    = v("inp-ia");
  const elIa  = document.getElementById("ed-ia-txt");
  const togIa = document.getElementById("tog-ia")?.checked;
  if (ia && togIa) { elIa.textContent = ia; elIa.style.display = ""; }
  else             { elIa.style.display = "none"; }

  const reco    = v("inp-reco");
  const elReco  = document.getElementById("ed-reco");
  const togReco = document.getElementById("tog-reco")?.checked;
  if (reco && togReco) { elReco.textContent = "💡 " + reco; elReco.style.display = ""; }
  else                 { elReco.style.display = "none"; }

  const elBens  = document.getElementById("ed-bens");
  const togBens = document.getElementById("tog-bens")?.checked;
  const bens    = v("inp-bens").split("\n").map(b => b.trim()).filter(Boolean);
  if (bens.length && togBens) {
    elBens.style.display = "";
    elBens.innerHTML = '<div class="ed-ben-titulo">Beneficios</div>';
    bens.forEach(b => {
      const div = document.createElement("div");
      div.className = "ed-ben-item";
      div.style.color = _bensTxtColor; // usa el color guardado en lugar de hardcodear
      div.innerHTML = `<span class="ed-ben-bullet" style="color:${primaryClr}">${bullet}</span>${b}`;
      elBens.appendChild(div);
    });
  } else { elBens.style.display = "none"; }

  document.getElementById("ed-info-col").style.textAlign = textAlign;
}

function setText(id, txt) {
  const el = document.getElementById(id);
  if (el && !el.matches(":focus")) el.textContent = txt;
}
function v(id) { const el = document.getElementById(id); return el ? el.value : ""; }

// ── Imagen ────────────────────────────────────────────────────
function resolverUrlImagen(url) {
  if (!url) return "";
  url = url.trim();
  if (/^https?:\/\//i.test(url) || url.startsWith("data:")) return url;
  const ruta = url.replace(/^\//, "");
  const { hostname, port, protocol } = window.location;
  return `${protocol}//${hostname}${port ? ":" + port : ""}/${ruta}`;
}

function aplicarUrlImagen() {
  const raw = v("inp-img-url").trim();
  if (!raw || raw === "(imagen local cargada)") return;
  const url = resolverUrlImagen(raw);
  aplicarImagen(url);
  imgObjX = 50; imgObjY = 50; imgScale = 100;
  sincronizarSlidersImagen();
  aplicarTransformImagen();
}

function aplicarImagen(url) {
  const img = document.getElementById("ed-img-el");
  const col = document.getElementById("ed-img-col");
  if (!img || !col) return;
  url = resolverUrlImagen(url);
  if (url) {
    img.src                  = url;
    img.style.display        = "";
    // Resetear todos los estilos de posición/zoom al cargar imagen nueva
    img.style.transform      = "none";
    img.style.objectFit      = "contain";
    img.style.objectPosition = "50% 50%";
    img.style.width          = "100%";
    img.style.height         = "100%";
    img.style.position       = "static";
    img.style.left           = "";
    img.style.top            = "";
    img.onerror = () => {
      img.style.display = "none";
      col.style.background = "linear-gradient(135deg,#1a6b3c,#22c55e)";
    };
  } else {
    img.style.display = "none";
    col.style.background = "linear-gradient(135deg,#1a6b3c,#22c55e)";
  }
}

// ── Aplicar zoom/posición — compatible con html2canvas ────────
//
//  imgScale  100  → object-fit: contain  (imagen completa, sin recorte)
//  imgScale >100  → agranda el <img> físicamente + object-fit: cover
//                   El contenedor tiene overflow:hidden → simula crop
//                   html2canvas captura tamaños reales, no CSS transform
//
function aplicarTransformImagen() {
  const img = document.getElementById("ed-img-el");
  if (!img || img.style.display === "none") return;

  // Sin transform en ningún caso — html2canvas no lo respeta bien en <img>
  img.style.transform = "none";

  if (imgScale <= 100) {
    img.style.objectFit      = "contain";
    img.style.objectPosition = "50% 50%";
    img.style.width          = "100%";
    img.style.height         = "100%";
    img.style.position       = "static";
    img.style.left           = "";
    img.style.top            = "";
  } else {
    const scale              = imgScale / 100;
    img.style.objectFit      = "cover";
    img.style.objectPosition = `${imgObjX}% ${imgObjY}%`;
    img.style.width          = (scale * 100) + "%";
    img.style.height         = (scale * 100) + "%";
    img.style.position       = "absolute";
    img.style.left           = `${(1 - scale) / 2 * 100}%`;
    img.style.top            = `${(1 - scale) / 2 * 100}%`;
  }
}

// Sincronizar sliders visuales con el estado interno
function sincronizarSlidersImagen() {
  const sZoom = document.getElementById("rng-zoom");
  const sX    = document.getElementById("rng-imgx");
  const sY    = document.getElementById("rng-imgy");
  if (sZoom) { sZoom.value = imgScale;  document.getElementById("val-zoom").textContent = imgScale + "%"; }
  if (sX)    { sX.value   = imgObjX;   document.getElementById("val-imgx").textContent = imgObjX; }
  if (sY)    { sY.value   = imgObjY;   document.getElementById("val-imgy").textContent = imgObjY; }
}

function actualizarOverlay() {
  const clr = document.getElementById("clr-overlay")?.value || "#000000";
  const op  = document.getElementById("rng-overlay")?.value || "0";
  const hex = clr.replace("#","");
  const r   = parseInt(hex.slice(0,2),16);
  const g   = parseInt(hex.slice(2,4),16);
  const b   = parseInt(hex.slice(4,6),16);
  const ov  = document.getElementById("ed-img-overlay");
  if (ov) ov.style.background = `rgba(${r},${g},${b},${op/100})`;
}

// ── Drag imagen: mueve imgObjX/Y ──────────────────────────────
function initImageDrag() {
  const col = document.getElementById("ed-img-col");
  if (!col) return;
  let drag = false, startX = 0, startY = 0, startObjX = 50, startObjY = 50;

  col.addEventListener("mousedown", e => {
    if (e.target.id === "ed-cat-badge") return;
    if (imgScale <= 100) return;
    drag = true;
    startX    = e.clientX;
    startY    = e.clientY;
    startObjX = imgObjX;
    startObjY = imgObjY;
    col.style.cursor = "grabbing";
  });

  window.addEventListener("mousemove", e => {
    if (!drag) return;
    const sens = 0.15;
    imgObjX = Math.max(0, Math.min(100, startObjX - (e.clientX - startX) * sens));
    imgObjY = Math.max(0, Math.min(100, startObjY - (e.clientY - startY) * sens));
    sincronizarSlidersImagen();
    aplicarTransformImagen();
  });

  window.addEventListener("mouseup", () => {
    drag = false;
    col.style.cursor = "grab";
  });

  // Rueda del mouse = zoom
  col.addEventListener("wheel", e => {
    e.preventDefault();
    imgScale = Math.max(100, Math.min(300, imgScale - e.deltaY * 0.15));
    sincronizarSlidersImagen();
    aplicarTransformImagen();
  }, { passive: false });
}

// ── Color primario ────────────────────────────────
function aplicarColorPrimario(c) {
  document.getElementById("ed-precio").style.color        = c;
  document.getElementById("ed-divider").style.background  = `linear-gradient(90deg,${c},${c}66)`;
  document.getElementById("ed-marca").style.color         = c;
  document.getElementById("ed-footer-marca").style.color  = c;
  const badge = document.getElementById("ed-cat-badge");
  if (badge) badge.style.color = c;
  document.querySelectorAll(".ed-ben-bullet").forEach(el => el.style.color = c);
  const reco = document.getElementById("ed-reco");
  if (reco) reco.style.borderLeftColor = c;
  const inp = document.getElementById("clr-primary");
  if (inp) inp.value = c;
}

// ── Badge ─────────────────────────────────────────
function actualizarBadge() {
  const bgInput  = document.getElementById("clr-badge-bg");
  const txtInput = document.getElementById("clr-badge-txt");
  if (txtInput && (txtInput.value === "#1a6b3c" || txtInput.value === primaryClr.toLowerCase())) {
    txtInput.value = primaryClr;
  }
  const el = document.getElementById("ed-cat-badge");
  if (el && bgInput && txtInput) {
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
  if (!cont) return;
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

function luminancia(hex) {
  let h = hex.replace("#","");
  if (h.length === 3) h = h.split("").map(c=>c+c).join("");
  const [r,g,b] = [0,2,4].map(i => {
    const val = parseInt(h.slice(i,i+2),16)/255;
    return val <= 0.04045 ? val/12.92 : Math.pow((val+0.055)/1.055, 2.4);
  });
  return 0.2126*r + 0.7152*g + 0.0722*b;
}
function esFondoOscuro(hex) {
  try { return luminancia(hex) < 0.35; } catch { return false; }
}

function recalcularContraste(bgHex) {
  const oscuro = esFondoOscuro(bgHex);
  const colorTitulo    = oscuro ? "#f9fafb" : "#111827";
  const colorDesc      = oscuro ? "#d1d5db" : "#1f2937";
  const colorBens      = oscuro ? "#e5e7eb" : "#111827";
  const colorBenTit    = oscuro ? "#94a3b8" : "#374151";
  const colorIaTxt     = oscuro ? "#cbd5e1" : "#1f2937";
  const colorMoneda    = oscuro ? "#94a3b8" : "#4b5563";
  const colorFooterBg  = oscuro ? "rgba(255,255,255,.06)" : "#f3f4f6";
  const colorFooterBrd = oscuro ? "rgba(255,255,255,.10)" : "#d1d5db";
  const colorFtrTxt    = oscuro ? "#94a3b8" : "#4b5563";
  const colorRecoBg    = oscuro ? "rgba(34,197,94,.14)"  : "#f0fdf4";
  const colorRecoTx    = oscuro ? "#86efac" : "#14532d";
  const colorRecoBrd   = oscuro ? "#22c55e" : "#22c55e";
  const colorIaBrd     = oscuro ? "rgba(255,255,255,.12)" : "#d1d5db";

  const ids = {
    "ed-nombre":      { color: colorTitulo },
    "ed-desc":        { color: colorDesc },
    "ed-ia-txt":      { color: colorIaTxt, borderTopColor: colorIaBrd },
    "ed-moneda":      { color: colorMoneda },
    "ed-footer":      { background: colorFooterBg, borderTopColor: colorFooterBrd },
    "ed-footer-ia":   { color: colorFtrTxt },
    "ed-reco":        { background: colorRecoBg, color: colorRecoTx, borderLeftColor: colorRecoBrd },
  };
  for (const [id, styles] of Object.entries(ids)) {
    const el = document.getElementById(id);
    if (el) Object.assign(el.style, styles);
  }
  // Actualizar _bensTxtColor solo si el usuario no lo ha cambiado manualmente
  const clrBensInput = document.getElementById("clr-bens-txt");
  if (!clrBensInput || clrBensInput.value === "#111827" || clrBensInput.value === "#e5e7eb") {
    _bensTxtColor = colorBens;
  }
  document.querySelectorAll(".ed-ben-item").forEach(el   => el.style.color = _bensTxtColor);
  document.querySelectorAll(".ed-ben-titulo").forEach(el => el.style.color = colorBenTit);
}

function aplicarPaletaPreset(key) {
  const p = PALETAS[key]; if (!p) return;
  primaryClr = p.primary;
  set("clr-primary",   p.primary);
  set("clr-bg",        p.bg);
  set("clr-imgbg",     p.imgbg);
  set("clr-badge-bg",  p.badge_bg);
  set("clr-badge-txt", p.badge_txt);
  document.getElementById("ed-card").style.background    = p.bg;
  document.getElementById("ed-img-col").style.background = p.imgbg;
  topbarGrad = p.grad;
  document.getElementById("ed-topbar").style.background  = topbarGrad;
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
  if (!area || !card) return;
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
  document.querySelectorAll(".ed-sel-ring").forEach(el => el.classList.remove("ed-sel-ring"));

  const loadEl = document.getElementById("edLoading");
  document.getElementById("edLoadingMsg").textContent = "Generando PNG de alta resolución…";
  loadEl?.classList.add("vis");

  try {
    const canvas = await html2canvas(card, {
      scale: 2.5, useCORS: true, allowTaint: true,
      backgroundColor: null, logging: false,
    });
    const nombre = (document.getElementById("ed-nombre")?.textContent || "producto")
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
    loadEl?.classList.remove("vis");
  }
}

// ── Resetear ──────────────────────────────────────
function resetear() {
  if (!confirm("¿Restablecer todos los cambios?")) return;
  const raw = localStorage.getItem("spotlight_data");
  if (raw) { try { cargarDatos(JSON.parse(raw)); } catch(e){} }
  imgObjX = 50; imgObjY = 50; imgScale = 100;
  _bensTxtColor = "#111827";
  sincronizarSlidersImagen();
  aplicarTransformImagen();
  toast("Restablecido ✓");
}

// ── Toast ─────────────────────────────────────────
let toastTimer;
function toast(msg) {
  const el = document.getElementById("toast");
  if (!el) return;
  el.textContent = msg;
  el.classList.add("vis");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove("vis"), 2500);
}

// ── Sidebar móvil ─────────────────────────────────
function toggleSidebar() {
  document.getElementById("sidebar")?.classList.toggle("mob-open");
}

window.addEventListener("resize", autoZoom);

// ── Edición libre ─────────────────────────────────
function abrirEdicionLibre() {
  const datos_libre = {
    nombre: "Mi Producto", precio: "0", categoria: "Categoría",
    marca: "Mi Tienda", descripcion: "Escribe aquí la descripción de tu producto.",
    iaTexto: "Agrega aquí tu copy publicitario…", recomendacion: "",
    beneficios: ["Beneficio 1", "Beneficio 2"], imagen: "",
    footerMarca: "🌿 Mi Tienda",
    topbarGrad: "linear-gradient(90deg,#1a6b3c,#22c55e,#4f46e5)",
    primaryClr: "#1a6b3c", modoLibre: true,
  };
  localStorage.setItem("spotlight_data", JSON.stringify(datos_libre));
  window.open("editor.html", "_blank");
}

// ════════════════════════════════════════════════════════════════
//  TEXTOS LIBRES ARRASTRABLES
// ════════════════════════════════════════════════════════════════

let txtLibreCounter = 0;
let txtSeleccionado = null;

function getOverlay() {
  let ov = document.getElementById("txt-overlay");
  if (!ov) {
    ov = document.createElement("div");
    ov.id = "txt-overlay";
    ov.style.cssText = `position:absolute;inset:0;pointer-events:none;z-index:10;overflow:hidden;border-radius:inherit;`;
    document.getElementById("ed-card").style.position = "relative";
    document.getElementById("ed-card").appendChild(ov);
  }
  return ov;
}

function crearPanelTextoLibre() {
  if (document.getElementById("panel-txt-libre")) return;
  const panel = document.createElement("div");
  panel.id = "panel-txt-libre";
  panel.style.cssText = `display:none;flex-direction:column;gap:.6rem;padding:.85rem;border-top:1px solid var(--panel-borde);background:rgba(255,255,255,.03);`;
  panel.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:space-between">
      <span style="font-size:.72rem;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:#6366f1">✏️ Texto seleccionado</span>
      <button onclick="eliminarTextoSeleccionado()" style="background:#ef4444;border:none;color:#fff;border-radius:5px;padding:.2rem .55rem;cursor:pointer;font-size:.75rem;font-weight:700">🗑 Borrar</button>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:.5rem">
      <div>
        <div class="sb-label" style="margin-bottom:.25rem">Tamaño</div>
        <div style="display:flex;align-items:center;gap:.4rem">
          <input type="range" min="8" max="96" value="20" id="tl-size" class="sb-range" oninput="aplicarEstiloTxt('size',this.value)"/>
          <span id="tl-size-val" style="font-size:.75rem;color:var(--acento);min-width:28px">20px</span>
        </div>
      </div>
      <div>
        <div class="sb-label" style="margin-bottom:.25rem">Opacidad</div>
        <div style="display:flex;align-items:center;gap:.4rem">
          <input type="range" min="10" max="100" value="100" id="tl-opacity" class="sb-range" oninput="aplicarEstiloTxt('opacity',this.value)"/>
          <span id="tl-opacity-val" style="font-size:.75rem;color:var(--acento);min-width:28px">100%</span>
        </div>
      </div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:.5rem">
      <div>
        <div class="sb-label" style="margin-bottom:.25rem">Color</div>
        <input type="color" id="tl-color" value="#111827" class="sb-color" style="width:100%;height:32px" oninput="aplicarEstiloTxt('color',this.value)"/>
      </div>
      <div>
        <div class="sb-label" style="margin-bottom:.25rem">Fondo</div>
        <div style="display:flex;gap:.3rem;align-items:center">
          <input type="color" id="tl-bg" value="#ffffff" class="sb-color" style="flex:1;height:32px" oninput="aplicarEstiloTxt('bg',this.value)"/>
          <button onclick="aplicarEstiloTxt('bg','transparent')" style="background:none;border:1px solid var(--panel-borde);color:var(--texto-suave);border-radius:5px;padding:.25rem .4rem;cursor:pointer;font-size:.7rem">Ninguno</button>
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
        <input type="range" min="0" max="40" value="6" id="tl-radius" class="sb-range" oninput="aplicarEstiloTxt('radius',this.value)"/>
        <span id="tl-radius-val" style="font-size:.75rem;color:var(--acento);min-width:28px">6px</span>
      </div>
    </div>
    <div style="display:flex;gap:.4rem">
      <button onclick="duplicarTextoSeleccionado()" class="btn-sb btn-sb-outline" style="flex:1;font-size:.78rem;padding:.4rem">
        <span class="material-symbols-outlined" style="font-size:.9rem">content_copy</span> Duplicar
      </button>
      <button onclick="subirCapaTexto()"  class="btn-sb btn-sb-outline" style="flex:1;font-size:.78rem;padding:.4rem">↑ Subir</button>
      <button onclick="bajarCapaTexto()"  class="btn-sb btn-sb-outline" style="flex:1;font-size:.78rem;padding:.4rem">↓ Bajar</button>
    </div>
  `;
  document.querySelector(".sb-body")?.appendChild(panel);
}

function añadirTextoLibre(opts = {}) {
  const overlay = getOverlay();
  txtLibreCounter++;
  const bloque = document.createElement("div");
  bloque.id = "tl-" + txtLibreCounter;
  bloque.contentEditable = "true";
  bloque.spellcheck = false;
  bloque.dataset.tipo = "texto-libre";
  bloque.textContent = opts.texto || "Texto libre";

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
  bloque.style.cssText += `position:absolute;left:${bloque._posX}px;top:${bloque._posY}px;min-width:60px;min-height:28px;padding:4px 8px;cursor:move;user-select:none;pointer-events:all;outline:none;white-space:pre-wrap;word-break:break-word;max-width:90%;box-sizing:border-box;`;

  bloque.addEventListener("mousedown", e => {
    if (e.detail === 2) return;
    seleccionarBloque(bloque);
    if (document.activeElement !== bloque) iniciarDragBloque(bloque, e);
  });
  bloque.addEventListener("dblclick", () => {
    bloque.focus();
    const range = document.createRange();
    range.selectNodeContents(bloque);
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
  });
  bloque.addEventListener("focus", () => seleccionarBloque(bloque));
  bloque.addEventListener("blur",  () => { bloque.style.outline = "none"; });

  overlay.appendChild(bloque);
  seleccionarBloque(bloque);
  return bloque;
}

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

function seleccionarBloque(bloque) {
  if (txtSeleccionado && txtSeleccionado !== bloque) {
    txtSeleccionado.style.outline = "none";
    txtSeleccionado.style.boxShadow = "none";
  }
  txtSeleccionado = bloque;
  bloque.style.outline = "2px dashed #6366f1";
  bloque.style.outlineOffset = "3px";

  const panel = document.getElementById("panel-txt-libre");
  if (panel) {
    panel.style.display = "flex";
    document.getElementById("tl-size").value    = bloque._fontSize;
    document.getElementById("tl-size-val").textContent = bloque._fontSize + "px";
    document.getElementById("tl-color").value   = bloque._color.startsWith("#") ? bloque._color : "#111827";
    document.getElementById("tl-bg").value      = bloque._bg.startsWith("#") ? bloque._bg : "#ffffff";
    document.getElementById("tl-font").value    = bloque._font;
    document.getElementById("tl-opacity").value = bloque._opacity;
    document.getElementById("tl-opacity-val").textContent = bloque._opacity + "%";
    document.getElementById("tl-radius").value  = bloque._radius;
    document.getElementById("tl-radius-val").textContent  = bloque._radius + "px";
  }
}

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
  b.style.outline = "2px dashed #6366f1";
  b.style.outlineOffset = "3px";
}

function iniciarDragBloque(bloque, e) {
  e.preventDefault();
  const card   = document.getElementById("ed-card");
  const rect   = card.getBoundingClientRect();
  const scale  = zoomLevel / 100;
  const startX = (e.clientX - rect.left) / scale - bloque._posX;
  const startY = (e.clientY - rect.top)  / scale - bloque._posY;

  const onMove = ev => {
    bloque._posX = Math.max(0, (ev.clientX - rect.left) / scale - startX);
    bloque._posY = Math.max(0, (ev.clientY - rect.top)  / scale - startY);
    bloque.style.left = bloque._posX + "px";
    bloque.style.top  = bloque._posY + "px";
  };
  const onUp = () => {
    window.removeEventListener("mousemove", onMove);
    window.removeEventListener("mouseup",   onUp);
  };
  window.addEventListener("mousemove", onMove);
  window.addEventListener("mouseup",   onUp);
}

document.getElementById("ed-card")?.addEventListener("click", e => {
  if (!e.target.dataset.tipo && txtSeleccionado) {
    txtSeleccionado.style.outline = "none";
    txtSeleccionado = null;
    const panel = document.getElementById("panel-txt-libre");
    if (panel) panel.style.display = "none";
  }
});

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
    texto: b.textContent, x: b._posX+15, y: b._posY+15,
    size: b._fontSize, color: b._color, bg: b._bg, font: b._font,
    opacity: b._opacity, radius: b._radius, bold: b._bold,
    italic: b._italic, underline: b._underline, upper: b._upper, align: b._align,
  });
}

function subirCapaTexto() {
  if (!txtSeleccionado) return;
  txtSeleccionado.style.zIndex = (parseInt(txtSeleccionado.style.zIndex || "10")) + 1;
}
function bajarCapaTexto() {
  if (!txtSeleccionado) return;
  txtSeleccionado.style.zIndex = Math.max(10, (parseInt(txtSeleccionado.style.zIndex || "10")) - 1);
}

document.addEventListener("keydown", e => {
  if ((e.key === "Delete" || e.key === "Backspace") && txtSeleccionado && document.activeElement !== txtSeleccionado) {
    eliminarTextoSeleccionado();
  }
  if (e.key === "Escape" && txtSeleccionado) {
    txtSeleccionado.style.outline = "none";
    txtSeleccionado = null;
    const panel = document.getElementById("panel-txt-libre");
    if (panel) panel.style.display = "none";
  }
});

// ── Parche exportarPNG: limpiar outlines antes de capturar ───
(function() {
  const _orig = exportarPNG;
  exportarPNG = async function() {
    document.querySelectorAll("[data-tipo='texto-libre']").forEach(b => b.style.outline = "none");
    txtSeleccionado = null;
    const panel = document.getElementById("panel-txt-libre");
    if (panel) panel.style.display = "none";
    await _orig();
  };
})();

window.addEventListener("DOMContentLoaded", () => {
  crearPanelTextoLibre();
}, { once: false });