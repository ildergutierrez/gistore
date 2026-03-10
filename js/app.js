// ============================================================
//  app.js — Catálogo público — Lee de Firebase (gi-store-5a5eb)
// ============================================================
import { initializeApp }
  from "https://www.gstatic.com/firebasejs/12.10.0/firebase-app.js";
import {
  getFirestore, collection, getDocs, query, where, orderBy
} from "https://www.gstatic.com/firebasejs/12.10.0/firebase-firestore.js";

// ── Firebase config ────────────────────────────────────────
const _app = initializeApp({
  apiKey:            "AIzaSyBviMH3re9aHjiLb5p-5hSjXd4gAchTvgI",
  authDomain:        "gi-store-5a5eb.firebaseapp.com",
  projectId:         "gi-store-5a5eb",
  storageBucket:     "gi-store-5a5eb.firebasestorage.app",
  messagingSenderId: "157652441199",
  appId:             "1:157652441199:web:c42285a80f117f79cc159a"
});
const _db = getFirestore(_app);

async function obtenerProductosActivos() {
  try {
    const snap = await getDocs(query(collection(_db, "productos"), where("activo", "==", true)));
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch {
    const snap = await getDocs(collection(_db, "productos"));
    return snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(p => p.activo === true);
  }
}
async function obtenerCategorias() {
  try {
    const snap = await getDocs(query(collection(_db, "categorias"), orderBy("orden")));
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch {
    const snap = await getDocs(collection(_db, "categorias"));
    return snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a,b) => (a.orden||0)-(b.orden||0));
  }
}
async function obtenerVendedores() {
  const snap = await getDocs(collection(_db, "vendedores"));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

// ── Utilidades ─────────────────────────────────────────────
function formatoPrecio(v) {
  return "$ " + Number(v).toLocaleString("es-CO");
}
function normalizar(txt) {
  return (txt || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}
function buildWaUrl(numero, texto) {
  return "https://wa.me/" + numero + "?text=" + encodeURIComponent(texto);
}
function encodeId(id) { return btoa(String(id)).replace(/=/g, ""); }
function decodeId(str) {
  const pad = str.length % 4 ? "=".repeat(4 - str.length % 4) : "";
  try { return atob(str + pad); } catch { return null; }
}
function resolverImg(url) {
  if (!url) return "";
  if (url.startsWith("http://") || url.startsWith("https://") || url.startsWith("data:")) return url;
  url = url.replace(/\\/g, "/").replace(/^[A-Za-z]:\/.*?\/gistore\//, "");
  const base = window.location.href.replace(/\/[^/]*$/, "");
  return base + "/" + url.replace(/^\//, "");
}

// ── Estado global ──────────────────────────────────────────
let PRODUCTOS   = [];
let CATEGORIAS  = {};   // { id: nombre }
let VENDEDORES  = {};   // { id: { whatsapp, color } }
let categoriaActiva = "";
let paginaActual    = 1;
let busquedaActiva  = "";
const POR_PAGINA    = 20;
let seleccionados   = new Map();
let productoModal   = null;
let carritoAbierto  = false;

// ── Carga Firebase ─────────────────────────────────────────
async function iniciar() {
  mostrarCargando(true);
  try {
    const [prods, cats, vends] = await Promise.all([
      obtenerProductosActivos(),
      obtenerCategorias(),
      obtenerVendedores(),
    ]);

    // Construir mapas
    cats.forEach(c => { CATEGORIAS[c.id] = c.nombre; });
    vends.forEach(v => { VENDEDORES[v.id] = v; });

    // Solo productos de vendedores activos con membresía
    PRODUCTOS = prods.filter(p => {
      const v = VENDEDORES[p.vendedor_id];
      return v && v.estado === "activo";
    });

    renderFiltros();
    renderCatalogo();

    // Abrir por URL param
    const encoded = new URLSearchParams(window.location.search).get("p");
    if (encoded) {
      const id = decodeId(encoded);
      const prod = PRODUCTOS.find(p => p.id === id);
      if (prod) setTimeout(() => abrirModal(prod), 300);
    }
  } catch (e) {
    console.error(e);
    document.getElementById("grilla").innerHTML =
      '<div class="sin-resultados"><p>Error al cargar productos. Intenta de nuevo.</p></div>';
  } finally {
    mostrarCargando(false);
  }
}

function mostrarCargando(si) {
  let el = document.getElementById("cargando-productos");
  if (!el) {
    el = document.createElement("p");
    el.id = "cargando-productos";
    el.className = "resultados-info";
    el.textContent = "⏳ Cargando productos...";
    document.getElementById("grilla").before(el);
  }
  el.style.display = si ? "block" : "none";
}

// ── Color vendedor ─────────────────────────────────────────
function colorVendedor(vendedor_id) {
  return VENDEDORES[vendedor_id]?.color || "#1a6b3c";
}
function waVendedor(vendedor_id) {
  return VENDEDORES[vendedor_id]?.whatsapp || "";
}
function nombreCategoria(cat_id) {
  return CATEGORIAS[cat_id] || "";
}

// ── Filtrar / paginar ──────────────────────────────────────
function productosFiltrados() {
  let lista = [...PRODUCTOS];
  if (categoriaActiva) lista = lista.filter(p => p.categoria_id === categoriaActiva);
  if (busquedaActiva.trim()) {
    const q = normalizar(busquedaActiva.trim());
    lista = lista.filter(p =>
      normalizar(p.nombre).includes(q) || normalizar(p.descripcion).includes(q)
    );
  }
  return lista;
}
function paginaDeProductos(lista) {
  return lista.slice((paginaActual - 1) * POR_PAGINA, paginaActual * POR_PAGINA);
}

// ── Render filtros ─────────────────────────────────────────
function renderFiltros() {
  const cont = document.getElementById("filtros");
  cont.innerHTML = "";

  const btnTodos = document.createElement("button");
  btnTodos.className = "filtro-btn" + (!categoriaActiva ? " activo" : "");
  btnTodos.textContent = "Todos";
  btnTodos.addEventListener("click", () => { categoriaActiva = ""; paginaActual = 1; renderCatalogo(); renderFiltros(); });
  cont.appendChild(btnTodos);

  Object.entries(CATEGORIAS).forEach(([id, nombre]) => {
    const btn = document.createElement("button");
    btn.className = "filtro-btn" + (categoriaActiva === id ? " activo" : "");
    btn.textContent = nombre;
    btn.addEventListener("click", () => { categoriaActiva = id; paginaActual = 1; renderCatalogo(); renderFiltros(); });
    cont.appendChild(btn);
  });
}

// ── Render catálogo ────────────────────────────────────────
function renderCatalogo() {
  const grilla = document.getElementById("grilla");
  const infoEl = document.getElementById("resultados-info");
  const lista  = productosFiltrados();
  const pagina = paginaDeProductos(lista);

  grilla.innerHTML = "";
  infoEl.textContent = lista.length === 0
    ? "Sin resultados"
    : `Mostrando ${(paginaActual - 1) * POR_PAGINA + 1}–${Math.min(paginaActual * POR_PAGINA, lista.length)} de ${lista.length} productos`;

  if (!pagina.length) {
    grilla.innerHTML = `<div class="sin-resultados"><div class="icono">🔍</div><p>No hay productos en esta categoría.</p></div>`;
  } else {
    pagina.forEach(prod => grilla.appendChild(crearTarjeta(prod)));
  }
  renderPaginado(lista);
}

// ── Tarjeta ────────────────────────────────────────────────
function crearTarjeta(prod) {
  const sel   = seleccionados.has(prod.id);
  const color = colorVendedor(prod.vendedor_id);
  const div   = document.createElement("div");
  div.className = "tarjeta" + (sel ? " seleccionada" : "");
  div.dataset.id = prod.id;
  div.innerHTML = `
    <div class="tarjeta-check">${sel ? "✓" : ""}</div>
    <div class="tarjeta-img-wrap">
      <img src="${resolverImg(prod.imagen)}" alt="${prod.nombre}" loading="lazy"
           onerror="this.src='https://placehold.co/400x300/e8f5ee/1a6b3c?text=Imagen'">
      <span class="tarjeta-categoria-badge">${nombreCategoria(prod.categoria_id)}</span>
    </div>
    <div class="tarjeta-body">
      <div class="tarjeta-nombre">${prod.nombre}</div>
      <div class="tarjeta-beneficio-top">${(prod.beneficios || [])[0] || ""}</div>
      <div class="tarjeta-footer">
        <span class="tarjeta-precio" style="color:${color}">${formatoPrecio(prod.valor)}</span>
        <button class="btn-ver">Ver más</button>
      </div>
    </div>`;

  div.querySelector(".tarjeta-img-wrap").addEventListener("click", e => { e.stopPropagation(); abrirModal(prod); });
  div.querySelector(".btn-ver").addEventListener("click", e => { e.stopPropagation(); abrirModal(prod); });
  div.addEventListener("click", e => {
    if (!e.target.closest(".tarjeta-img-wrap") && !e.target.classList.contains("btn-ver"))
      toggleSeleccion(prod.id);
  });
  return div;
}

// ── Selección / carrito ────────────────────────────────────
function toggleSeleccion(id) {
  if (seleccionados.has(id)) seleccionados.delete(id);
  else { const p = PRODUCTOS.find(x => x.id === id); if (p) seleccionados.set(id, { prod: p, cantidad: 1 }); }
  actualizarTarjetaSeleccion(id);
  actualizarPanelInferior();
  actualizarCartBtn();
  if (carritoAbierto) renderCarrito();
  if (productoModal?.id === id) actualizarBtnSeleccionModal();
}
function cambiarCantidad(id, delta) {
  if (!seleccionados.has(id)) return;
  const item = seleccionados.get(id);
  const nueva = item.cantidad + delta;
  if (nueva <= 0) { eliminarDelCarrito(id); return; }
  item.cantidad = nueva;
  actualizarPanelInferior(); actualizarCartBtn(); renderCarrito();
}
function eliminarDelCarrito(id) {
  seleccionados.delete(id);
  actualizarTarjetaSeleccion(id); actualizarPanelInferior(); actualizarCartBtn();
  if (productoModal?.id === id) actualizarBtnSeleccionModal();
  if (!seleccionados.size) { cerrarCarrito(); return; }
  renderCarrito();
}
function actualizarTarjetaSeleccion(id) {
  const t = document.querySelector(`.tarjeta[data-id='${id}']`);
  if (!t) return;
  const check = t.querySelector(".tarjeta-check");
  if (seleccionados.has(id)) { t.classList.add("seleccionada"); check.textContent = "✓"; }
  else { t.classList.remove("seleccionada"); check.textContent = ""; }
}
function actualizarCartBtn() {
  const btn   = document.getElementById("cart-btn");
  const count = document.getElementById("cart-count");
  const totalUnd = [...seleccionados.values()].reduce((a, {cantidad}) => a + cantidad, 0);
  count.textContent = totalUnd;
  btn.style.display = seleccionados.size > 0 ? "flex" : "none";
}
function actualizarPanelInferior() {
  const panel = document.getElementById("panel-seleccion");
  const info  = document.getElementById("panel-info-texto");
  const totalUnd = [...seleccionados.values()].reduce((a, {cantidad}) => a + cantidad, 0);
  if (!seleccionados.size) { panel.classList.remove("visible"); return; }
  panel.classList.add("visible");
  info.innerHTML = `<strong>${totalUnd}</strong> unidad${totalUnd > 1 ? "es" : ""} seleccionada${totalUnd > 1 ? "s" : ""}`;
}
function limpiarSeleccion() {
  const ids = [...seleccionados.keys()];
  seleccionados.clear();
  ids.forEach(actualizarTarjetaSeleccion);
  actualizarPanelInferior(); actualizarCartBtn();
  if (productoModal) actualizarBtnSeleccionModal();
  cerrarCarrito();
}

// ── Render carrito ─────────────────────────────────────────
function abrirCarrito() {
  carritoAbierto = true; renderCarrito();
  document.getElementById("carrito-overlay").classList.add("activo");
  document.getElementById("carrito-panel").classList.add("activo");
  document.body.style.overflow = "hidden";
}
function cerrarCarrito() {
  carritoAbierto = false;
  document.getElementById("carrito-overlay").classList.remove("activo");
  document.getElementById("carrito-panel").classList.remove("activo");
  document.body.style.overflow = "";
}
function renderCarrito() {
  const items = [...seleccionados.values()];
  const total = items.reduce((a, {prod, cantidad}) => a + prod.valor * cantidad, 0);
  const lista = document.getElementById("carrito-lista");

  lista.innerHTML = items.map(({prod, cantidad}) => `
    <div class="carrito-item" style="border-bottom:3px solid ${colorVendedor(prod.vendedor_id)}">
      <img class="carrito-item-img" src="${resolverImg(prod.imagen)}" alt="${prod.nombre}"
           onerror="this.src='https://placehold.co/80x80/e8f5ee/1a6b3c?text=Img'">
      <div class="carrito-item-info">
        <span class="carrito-item-nombre">${prod.nombre}</span>
        <span class="carrito-item-cat">${nombreCategoria(prod.categoria_id)}</span>
        <span class="carrito-item-precio">${formatoPrecio(prod.valor * cantidad)}</span>
      </div>
      <div class="carrito-item-cantidad">
        <button class="qty-btn" data-id="${prod.id}" data-delta="-1">−</button>
        <span class="qty-num">${cantidad}</span>
        <button class="qty-btn" data-id="${prod.id}" data-delta="1">+</button>
      </div>
      <button class="carrito-item-eliminar" data-id="${prod.id}" title="Eliminar">✕</button>
    </div>`).join("");

  lista.querySelectorAll(".carrito-item-eliminar").forEach(b =>
    b.addEventListener("click", () => eliminarDelCarrito(b.dataset.id)));
  lista.querySelectorAll(".qty-btn").forEach(b =>
    b.addEventListener("click", () => cambiarCantidad(b.dataset.id, Number(b.dataset.delta))));
  document.getElementById("carrito-total").textContent = formatoPrecio(total);
}

// ── WhatsApp ───────────────────────────────────────────────
function enviarWhatsappProducto(prod) {
  const numero = waVendedor(prod.vendedor_id);
  const img    = resolverImg(prod.imagen);
  const texto  =
    "😊 ¡Hola! Me interesa este producto:\n\n" +
    "✨ *" + prod.nombre + "*\n" +
    "💵 Precio: *" + formatoPrecio(prod.valor) + "*\n" +
    (img ? "🖼️ " + img + "\n\n" : "\n") +
    "¿Está disponible? ¿Hacen envíos? 🙏";
  window.open(buildWaUrl(numero, texto), "_blank");
}
function enviarWhatsappCarrito() {
  if (!seleccionados.size) return;
  const items = [...seleccionados.values()];
  const grupos = {};
  items.forEach(({prod, cantidad}) => {
    const num = waVendedor(prod.vendedor_id);
    if (!grupos[num]) grupos[num] = [];
    grupos[num].push({prod, cantidad});
  });
  const entradas = Object.entries(grupos);
  if (entradas.length > 1) {
    const ok = confirm(`Este pedido incluye ${entradas.length} vendedores. Se abrirán ${entradas.length} chats. ¿Continuar?`);
    if (!ok) return;
  }
  entradas.forEach(([numero, lineas]) => {
    const lista = lineas.map((l, j) =>
      (j+1) + ". *" + l.prod.nombre + "* x" + l.cantidad + " — " + formatoPrecio(l.prod.valor * l.cantidad)
    ).join("\n");
    const total = lineas.reduce((a, l) => a + l.prod.valor * l.cantidad, 0);
    const texto = "👋 ¡Hola! Quisiera hacer un pedido:\n\n" + lista +
                  "\n\n✅ *Total: " + formatoPrecio(total) + "*\n\n¿Confirman disponibilidad? 🙏";
    window.open(buildWaUrl(numero, texto), "_blank");
  });
}

// ── Compartir ──────────────────────────────────────────────
function compartirProducto(prod) {
  const url = new URL(window.location.href);
  url.searchParams.set("p", encodeId(prod.id));
  const enlace = url.toString();
  const texto = "🌿 ¡Mira esto!\n*" + prod.nombre + "*\n💵 " + formatoPrecio(prod.valor) + "\n👇 " + enlace;
  if (navigator.share) {
    navigator.share({ title: prod.nombre, text: texto, url: enlace }).catch(() => {});
  } else {
    navigator.clipboard.writeText(texto).then(() => {
      const btn = document.getElementById("btn-compartir-modal");
      const orig = btn.innerHTML;
      btn.innerHTML = "✓ ¡Copiado!";
      btn.style.background = "#1a6b3c"; btn.style.color = "#fff";
      setTimeout(() => { btn.innerHTML = orig; btn.style.background = ""; btn.style.color = ""; }, 2000);
    });
  }
}

// ── Modal ──────────────────────────────────────────────────
function abrirModal(prod) {
  productoModal = prod;
  document.getElementById("modal-img").src               = resolverImg(prod.imagen);
  document.getElementById("modal-img").alt               = prod.nombre;
  document.getElementById("modal-categoria").textContent = nombreCategoria(prod.categoria_id);
  document.getElementById("modal-nombre").textContent    = prod.nombre;
  document.getElementById("modal-precio").textContent    = formatoPrecio(prod.valor);
  document.getElementById("modal-precio").style.color    = colorVendedor(prod.vendedor_id);
  document.getElementById("modal-desc").textContent      = prod.descripcion || "";
  document.getElementById("modal-beneficios").innerHTML  = (prod.beneficios||[]).map(b => "<li>" + b + "</li>").join("");
  const seccion = document.getElementById("modal-consumo-seccion");
  const texto   = document.getElementById("modal-consumo-texto");
  if (prod.recomendacion) { texto.textContent = prod.recomendacion; seccion.style.display = "block"; }
  else { texto.textContent = ""; seccion.style.display = "none"; }
  actualizarBtnSeleccionModal();
  document.getElementById("btn-whatsapp-modal").onclick  = () => enviarWhatsappProducto(prod);
  document.getElementById("btn-compartir-modal").onclick = () => compartirProducto(prod);
  document.getElementById("overlay").classList.add("activo");
  document.body.style.overflow = "hidden";
  const u = new URL(window.location.href);
  u.searchParams.set("p", encodeId(prod.id));
  history.replaceState(null, "", u);
}
function cerrarModal() {
  document.getElementById("overlay").classList.remove("activo");
  document.body.style.overflow = "";
  productoModal = null;
  const u = new URL(window.location.href);
  u.searchParams.delete("p");
  history.replaceState(null, "", u);
}
function actualizarBtnSeleccionModal() {
  if (!productoModal) return;
  const btn = document.getElementById("btn-seleccionar-modal");
  const sel = seleccionados.has(productoModal.id);
  btn.textContent = sel ? "✓ Seleccionado" : "🛒 Añadir";
  btn.className   = "btn-seleccionar-modal" + (sel ? " activo" : "");
}

// ── Paginado ───────────────────────────────────────────────
function renderPaginado(lista) {
  const cont  = document.getElementById("paginado");
  cont.innerHTML = "";
  const total = Math.max(1, Math.ceil(lista.length / POR_PAGINA));
  if (total <= 1) return;
  const crearBtn = (txt, pag, disabled, activo) => {
    const btn = document.createElement("button");
    btn.className = "pag-btn" + (activo ? " activo" : "");
    btn.textContent = txt; btn.disabled = disabled;
    if (!disabled && !activo) btn.addEventListener("click", () => {
      paginaActual = pag; renderCatalogo(); window.scrollTo({top:0,behavior:"smooth"});
    });
    return btn;
  };
  cont.appendChild(crearBtn("←", paginaActual - 1, paginaActual === 1));
  for (let i = 1; i <= total; i++) cont.appendChild(crearBtn(i, i, false, i === paginaActual));
  cont.appendChild(crearBtn("→", paginaActual + 1, paginaActual === total));
}

// ── DOMContentLoaded ───────────────────────────────────────
document.addEventListener("DOMContentLoaded", () => {
  // Buscador
  const inputBusqueda = document.getElementById("busqueda-input");
  const btnLimpiar    = document.getElementById("busqueda-limpiar");
  if (inputBusqueda) {
    inputBusqueda.addEventListener("input", () => {
      busquedaActiva = inputBusqueda.value;
      btnLimpiar.style.display = busquedaActiva ? "flex" : "none";
      paginaActual = 1; renderCatalogo();
    });
    btnLimpiar.addEventListener("click", () => {
      busquedaActiva = ""; inputBusqueda.value = ""; btnLimpiar.style.display = "none";
      paginaActual = 1; renderCatalogo(); inputBusqueda.focus();
    });
  }
  // Modal
  document.getElementById("overlay").addEventListener("click", e => { if (e.target.id === "overlay") cerrarModal(); });
  document.getElementById("btn-cerrar-modal").addEventListener("click", cerrarModal);
  document.getElementById("btn-seleccionar-modal").addEventListener("click", () => {
    if (productoModal) toggleSeleccion(productoModal.id);
  });
  document.getElementById("btn-limpiar").addEventListener("click", limpiarSeleccion);
  document.getElementById("btn-whatsapp-panel").addEventListener("click", abrirCarrito);
  document.getElementById("cart-btn").addEventListener("click", abrirCarrito);
  document.getElementById("carrito-overlay").addEventListener("click", cerrarCarrito);
  document.getElementById("btn-cerrar-carrito").addEventListener("click", cerrarCarrito);
  document.getElementById("btn-carrito-limpiar").addEventListener("click", limpiarSeleccion);
  document.getElementById("btn-carrito-whatsapp").addEventListener("click", enviarWhatsappCarrito);
  document.addEventListener("keydown", e => {
    if (e.key === "Escape") carritoAbierto ? cerrarCarrito() : cerrarModal();
  });
  actualizarCartBtn();
  iniciar();
});