// ============================================================
//  spotlight.js — Módulo Spotlight de Producto con IA
//  Modelos OpenRouter (con fallback automático):
//    1. google/gemini-2.5-pro-exp-03-25:free
//    2. google/gemma-3-27b-it:free
//    3. meta-llama/llama-4-scout:free
//  Exporta la tarjeta como PNG con html2canvas
// ============================================================

import { cerrarSesion, protegerPagina } from "./auth.js";
import {
  obtenerVendedorPorUid,
  obtenerMisProductos,
  obtenerCategorias,
} from "./db.js";
import { fechaHoy } from "./ui.js";
import { auth } from "./firebase.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.10.0/firebase-auth.js";

// ── Resolver URL de imagen según entorno ─────────────────────
function resolverUrlImagen(url) {
  if (!url) return "";
  url = url.trim();
  if (/^https?:\/\//i.test(url)) return url;
  const ruta = url.replace(/^\//, "");
  const { hostname, port, protocol } = window.location;
  const esLocal = hostname === "127.0.0.1" || hostname === "localhost";
  if (esLocal) {
    const base = `${protocol}//${hostname}${port ? ":" + port : ""}`;
    return `${base}/${ruta}`;
  }
  const segmentos = window.location.pathname.split("/").filter(Boolean);
  const repo = segmentos.length > 0 ? "/" + segmentos[0] : "";
  return `${window.location.origin}${repo}/${ruta}`;
}



// ── Protección de ruta ──────────────────────────────────────
protegerPagina("../../index.html");

// ── OpenRouter — cadena de fallback ────────────────────────
const OR_KEY  = "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";
const OR_URL  = "https://openrouter.ai/api/v1/chat/completions";
const OR_MODELS = [
  "google/gemini-2.5-pro-exp-03-25:free",
  "google/gemma-3-27b-it:free",
  "meta-llama/llama-4-scout:free",
];

// ── Estado global ───────────────────────────────────────────
let productos       = [];
let categorias      = [];
let vendedor        = null;
let productoActual  = null;
let filtroTexto     = "";
let filtroCategoria = "";
let filtroEstado    = "todos";

// ── Referencias DOM ─────────────────────────────────────────
const inputBusqueda   = document.getElementById("spBusqueda");
const selectCategFilt = document.getElementById("spFiltroCategoria");
const selectEstado    = document.getElementById("spFiltroEstado");
const listaProductos  = document.getElementById("spListaProductos");
const btnGenerar      = document.getElementById("btnGenerar");
const btnRegenerar    = document.getElementById("btnRegenerar");
const btnExportar     = document.getElementById("btnExportar");
const btnDiseñar      = document.getElementById("btnDiseñar");
const btnSalir        = document.getElementById("btnSalir");
const resultArea      = document.getElementById("spResultArea");
const iaStatus        = document.getElementById("spIaStatus");
const loading         = document.getElementById("spLoading");
const loadingMsg      = document.getElementById("spLoadingMsg");
const fechaEl         = document.getElementById("fechaHoy");

const elImgEl       = document.getElementById("spImgEl");
const elCategoria   = document.getElementById("spCategoria");
const elNombre      = document.getElementById("spNombre");
const elMarca       = document.getElementById("spMarca");
const elPrecio      = document.getElementById("spPrecio");
const elDescripcion = document.getElementById("spDescripcion");
const elBeneficios  = document.getElementById("spBeneficios");
const elReco        = document.getElementById("spReco");
const elIaTexto     = document.getElementById("spIaTexto");

// ── Utilidades ──────────────────────────────────────────────
function setLoading(visible, msg = "Generando diseño con IA…") {
  loadingMsg.textContent = msg;
  loading.classList.toggle("visible", visible);
}
function formatoPrecio(v) {
  return Number(v || 0).toLocaleString("es-CO");
}
function setStatus(msg, color = "var(--texto-suave)") {
  iaStatus.textContent = msg;
  iaStatus.style.color = color;
}

// ── Init ────────────────────────────────────────────────────
if (fechaEl) fechaEl.textContent = fechaHoy();

btnSalir?.addEventListener("click", async () => {
  await cerrarSesion();
  window.location.href = "../../index.html";
});

onAuthStateChanged(auth, async (user) => {
  if (!user) return;
  try {
    vendedor = await obtenerVendedorPorUid(user.uid);
    if (!vendedor) return;
    const elNom = document.getElementById("vendedorNombre");
    if (elNom) elNom.textContent = vendedor.nombre;

    [productos, categorias] = await Promise.all([
      obtenerMisProductos(vendedor.id),
      obtenerCategorias(),
    ]);

    poblarFiltroCategoria();
    renderizarLista();
  } catch (e) {
    console.error("Error al cargar datos:", e);
    setStatus("Error al cargar productos.", "var(--error)");
  }
});

// ── Filtros ─────────────────────────────────────────────────
function poblarFiltroCategoria() {
  if (!selectCategFilt) return;
  selectCategFilt.innerHTML = '<option value="">Todas las categorías</option>';
  categorias.forEach((c) => {
    const opt = document.createElement("option");
    opt.value = c.id;
    opt.textContent = c.nombre;
    selectCategFilt.appendChild(opt);
  });
}

inputBusqueda?.addEventListener("input", () => {
  filtroTexto = inputBusqueda.value.trim().toLowerCase();
  renderizarLista();
});
selectCategFilt?.addEventListener("change", () => {
  filtroCategoria = selectCategFilt.value;
  renderizarLista();
});
selectEstado?.addEventListener("change", () => {
  filtroEstado = selectEstado.value;
  renderizarLista();
});

function productosFiltrados() {
  return productos.filter((p) => {
    const mt = !filtroTexto ||
      (p.nombre || "").toLowerCase().includes(filtroTexto) ||
      (p.descripcion || "").toLowerCase().includes(filtroTexto);
    const mc = !filtroCategoria || p.categoria_id === filtroCategoria;
    const me =
      filtroEstado === "todos" ||
      (filtroEstado === "activos" && p.activo) ||
      (filtroEstado === "inactivos" && !p.activo);
    return mt && mc && me;
  });
}

// ── Lista de tarjetas de selección ──────────────────────────
function renderizarLista() {
  if (!listaProductos) return;
  const lista = productosFiltrados();

  if (!lista.length) {
    listaProductos.innerHTML = `
      <div style="grid-column:1/-1;text-align:center;padding:2.5rem 1rem;color:var(--texto-suave);font-size:.9rem">
        😕 No hay productos que coincidan con los filtros.
      </div>`;
    btnGenerar.disabled = true;
    return;
  }

  listaProductos.innerHTML = "";
  lista.forEach((p) => {
    const cat    = categorias.find((c) => c.id === p.categoria_id);
    const catNom = cat?.nombre || "";
    const card   = document.createElement("div");
    card.className = "sp-prod-card" + (productoActual?.id === p.id ? " seleccionado" : "");
    card.dataset.id = p.id;

    card.innerHTML = `
      <div class="sp-prod-img">
        ${p.imagen
          ? `<img src="${resolverUrlImagen(p.imagen)}" alt="${p.nombre}" loading="lazy"
               onerror="this.parentElement.innerHTML='<div class=sp-prod-noimg>📦</div>'">`
          : `<div class="sp-prod-noimg">📦</div>`}
        <span class="sp-prod-estado ${p.activo ? "activo" : "inactivo"}">
          ${p.activo ? "✓ Activo" : "⏸ Inactivo"}
        </span>
      </div>
      <div class="sp-prod-body">
        ${catNom ? `<span class="sp-prod-cat">${catNom}</span>` : ""}
        <div class="sp-prod-nombre">${p.nombre}</div>
        <div class="sp-prod-precio">$ ${formatoPrecio(p.valor)} <span>COP</span></div>
        ${p.descripcion
          ? `<div class="sp-prod-desc">${p.descripcion.slice(0, 80)}${p.descripcion.length > 80 ? "…" : ""}</div>`
          : ""}
      </div>
      <div class="sp-prod-check"><span class="material-symbols-outlined">check_circle</span></div>
    `;

    card.addEventListener("click", () => seleccionarProducto(p, card));
    listaProductos.appendChild(card);
  });
}

function seleccionarProducto(p, cardEl) {
  document.querySelectorAll(".sp-prod-card.seleccionado")
    .forEach((el) => el.classList.remove("seleccionado"));
  cardEl.classList.add("seleccionado");
  productoActual = p;
  btnGenerar.disabled  = false;
  btnDiseñar.disabled  = false;
  resultArea.classList.remove("visible");
  setStatus(`"${p.nombre}" seleccionado — genera con IA o edita el diseño directamente.`);
}

// ── Generar ─────────────────────────────────────────────────
btnGenerar?.addEventListener("click", () => generarSpotlight());
btnRegenerar?.addEventListener("click", () => generarSpotlight());

async function generarSpotlight() {
  if (!productoActual) return;

  const cat      = categorias.find((c) => c.id === productoActual.categoria_id);
  const catNombre = cat?.nombre || "Producto";

  setLoading(true, "Analizando producto…");
  btnGenerar.disabled   = true;
  btnRegenerar.disabled = true;

  try {
    poblarTarjeta(productoActual, catNombre);
    aplicarEstiloIA(productoActual, catNombre);

    setLoading(true, "IA generando descripción editorial…");
    const iaParrafo = await generarTextoIA(productoActual, catNombre);

    if (iaParrafo) {
      elIaTexto.textContent   = iaParrafo;
      elIaTexto.style.display = "block";
    } else {
      elIaTexto.style.display = "none";
    }

    guardarParaEditor(productoActual, catNombre, iaParrafo);

    resultArea.classList.add("visible");
    resultArea.scrollIntoView({ behavior: "smooth", block: "start" });
    setStatus("✅ Tarjeta generada. Exportar como PNG o abrirla en el Editor.", "var(--ok)");

  } catch (e) {
    console.error("Error al generar spotlight:", e);
    guardarParaEditor(productoActual, catNombre, "");
    resultArea.classList.add("visible");
    elIaTexto.style.display = "none";
    setStatus("⚠️ Tarjeta generada sin texto IA (verifica conexión).", "var(--advertencia)");
  } finally {
    setLoading(false);
    btnGenerar.disabled   = false;
    btnRegenerar.disabled = false;
  }
}

// ── Poblar tarjeta ───────────────────────────────────────────
function poblarTarjeta(p, catNombre) {
  const imgCol = document.getElementById("spImgCol");
  elImgEl.style.display   = "";
  imgCol.style.background = "";

  if (p.imagen) {
    elImgEl.src = resolverUrlImagen(p.imagen);
    elImgEl.alt = p.nombre;
    elImgEl.onerror = () => {
      imgCol.style.background = "linear-gradient(135deg,#1a6b3c 0%,#22c55e 100%)";
      elImgEl.style.display   = "none";
    };
  } else {
    imgCol.style.background = "linear-gradient(135deg,#1a6b3c 0%,#22c55e 100%)";
    elImgEl.style.display   = "none";
  }

  elCategoria.textContent   = catNombre;
  elNombre.textContent      = p.nombre || "Producto";
  elMarca.textContent       = vendedor?.nombre || "GI Store";
  elPrecio.textContent      = formatoPrecio(p.valor);
  elDescripcion.textContent = p.descripcion || "";

  elBeneficios.innerHTML = '<div class="ben-titulo">Beneficios</div>';
  const bens = Array.isArray(p.beneficios) ? p.beneficios.filter(Boolean) : [];
  if (bens.length) {
    bens.forEach((b) => {
      const div = document.createElement("div");
      div.className   = "ben-item";
      div.textContent = b;
      elBeneficios.appendChild(div);
    });
    elBeneficios.style.display = "flex";
  } else {
    elBeneficios.style.display = "none";
  }

  if (p.recomendacion) {
    elReco.textContent   = "💡 " + p.recomendacion;
    elReco.style.display = "block";
  } else {
    elReco.style.display = "none";
  }

  elIaTexto.style.display = "none";
  elIaTexto.textContent   = "";
}

// ── OpenRouter con fallback automático ──────────────────────
async function generarTextoIA(p, catNombre) {
  const bens = Array.isArray(p.beneficios) ? p.beneficios.filter(Boolean) : [];

  const prompt = `Eres un copywriter experto en publicidad de revista de lujo latinoamericana.
Escribe UN párrafo publicitario corto (máximo 55 palabras) para este producto:

Nombre: ${p.nombre}
Categoría: ${catNombre}
Descripción: ${p.descripcion || "Sin descripción"}
Beneficios: ${bens.join(", ") || "No especificados"}
Recomendación de uso: ${p.recomendacion || ""}

Reglas estrictas:
- Tono aspiracional, elegante y cálido.
- Resalta el beneficio más diferenciador.
- NO menciones el precio.
- Cierra con un llamado a la acción sutil y elegante.
- Devuelve SOLO el párrafo. Sin comillas, sin títulos, sin asteriscos.`;

  let ultimoError = null;

  for (const modelo of OR_MODELS) {
    try {
      const res = await fetch(OR_URL, {
        method: "POST",
        headers: {
          "Content-Type":  "application/json",
          "Authorization": `Bearer ${OR_KEY}`,
          "HTTP-Referer":  "https://gistore.com.co",
          "X-Title":       "GI Store Spotlight",
        },
        body: JSON.stringify({
          model:      modelo,
          max_tokens: 200,
          messages:   [{ role: "user", content: prompt }],
        }),
      });

      if (res.status === 404 || res.status === 503) {
        const txt = await res.text();
        console.warn(`Modelo ${modelo} no disponible (${res.status}). Intentando siguiente…`);
        ultimoError = txt;
        continue;
      }

      if (!res.ok) {
        const txt = await res.text();
        throw new Error(`OpenRouter ${res.status}: ${txt}`);
      }

      const data  = await res.json();
      const texto = data?.choices?.[0]?.message?.content?.trim() || "";
      if (texto) {
        console.info(`IA respondió con: ${modelo}`);
        return texto;
      }
    } catch (e) {
      console.warn(`Error con ${modelo}:`, e.message);
      ultimoError = e.message;
    }
  }

  console.error("Todos los modelos fallaron. Último error:", ultimoError);
  return "";
}

// ── Paletas por categoría ────────────────────────────────────
const PALETAS = {
  default:    { top: "#1a6b3c, #22c55e, #4f46e5", precio: "#1a6b3c" },
  tecnologia: { top: "#0ea5e9, #6366f1, #a855f7", precio: "#0ea5e9" },
  ropa:       { top: "#f43f5e, #fb923c, #fbbf24", precio: "#e11d48" },
  alimentos:  { top: "#16a34a, #84cc16, #eab308", precio: "#15803d" },
  salud:      { top: "#06b6d4, #3b82f6, #8b5cf6", precio: "#0891b2" },
  hogar:      { top: "#d97706, #f59e0b, #84cc16", precio: "#b45309" },
  belleza:    { top: "#ec4899, #a855f7, #8b5cf6", precio: "#db2777" },
  deporte:    { top: "#f97316, #ef4444, #1a6b3c", precio: "#ea580c" },
};

function aplicarEstiloIA(p, catNombre) {
  const lcat   = (catNombre || "").toLowerCase();
  let paleta   = PALETAS.default;
  for (const k of Object.keys(PALETAS)) {
    if (lcat.includes(k)) { paleta = PALETAS[k]; break; }
  }
  const topbar = document.querySelector("#spCard .card-topbar");
  if (topbar) topbar.style.background = `linear-gradient(90deg, ${paleta.top})`;
  const monto  = document.querySelector("#spCard .card-precio .monto");
  if (monto)   monto.style.color = paleta.precio;
}

// ── Exportar PNG ─────────────────────────────────────────────
btnExportar?.addEventListener("click", async () => {
  const card = document.getElementById("spCard");
  if (!card) return;

  btnExportar.disabled = true;
  setLoading(true, "Generando imagen PNG…");

  try {
    const canvas = await html2canvas(card, {
      scale:           2,
      useCORS:         true,
      allowTaint:      true,
      backgroundColor: "#ffffff",
      logging:         false,
    });

    const nombre  = (productoActual?.nombre || "producto")
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .replace(/\s+/g, "-").toLowerCase();
    const link    = document.createElement("a");
    link.download = `spotlight-${nombre}.png`;
    link.href     = canvas.toDataURL("image/png");
    link.click();

    setStatus("✅ PNG exportado correctamente.", "var(--ok)");
  } catch (e) {
    console.error("Error al exportar:", e);
    setStatus("⚠️ Error al exportar. Intenta de nuevo.", "var(--error)");
  } finally {
    setLoading(false);
    btnExportar.disabled = false;
  }
});

// ── Guardar datos para el Editor tipo Canva ─────────────────
function guardarParaEditor(p, catNombre, iaParrafo) {
  if (!p) return;
  const bens = Array.isArray(p.beneficios) ? p.beneficios.filter(Boolean) : [];
  const topbar = document.querySelector("#spCard .card-topbar");
  const monto  = document.querySelector("#spCard .card-precio .monto");
  const datos = {
    nombre:         p.nombre        || "",
    precio:         String(p.valor  || "0"),
    categoria:      catNombre,
    marca:          vendedor?.nombre || "GI Store",
    descripcion:    p.descripcion   || "",
    iaTexto:        iaParrafo       || "",
    recomendacion:  p.recomendacion || "",
    beneficios:     bens,
    imagen:         p.imagen        || "",
    footerMarca:    "🌿 " + (vendedor?.nombre || "GI Store"),
    topbarGrad:     topbar ? topbar.style.background : "",
    primaryClr:     monto  ? monto.style.color       : "#1a6b3c",
  };
  try { localStorage.setItem("spotlight_data", JSON.stringify(datos)); } catch(e) {}
}

// ── Botón abrir editor (desde resultado, con datos IA ya guardados) ────
document.getElementById("btnEditor")?.addEventListener("click", () => {
  window.open("editor.html", "_blank");
});

// ── Botón Editar diseño (desde selector, sin IA) ─────────────────────
btnDiseñar?.addEventListener("click", () => {
  if (!productoActual) return;
  const cat = categorias.find((c) => c.id === productoActual.categoria_id);
  const catNombre = cat?.nombre || "Producto";
  // Guardar datos sin texto IA para que el editor los cargue
  guardarParaEditor(productoActual, catNombre, "");
  window.open("editor.html", "_blank");
});