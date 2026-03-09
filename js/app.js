// ============================================================
//  BASE URL — se detecta automáticamente sin configuración
// ============================================================
const BASE_URL = (() => {
  const src = document.currentScript?.src
           || document.querySelector('script[src*="app.js"]')?.src;
  if (src) return src.replace(/\/js\/app\.js.*$/, "");
  return window.location.origin + window.location.pathname.replace(/\/[^\/]*$/, "");
})();

// ============================================================
//  ENCODE / DECODE ID en URL (Base64)
// ============================================================
function encodeId(id) {
  return btoa(String(id)).replace(/=/g, "");
}
function decodeId(str) {
  const pad = str.length % 4 ? "=".repeat(4 - str.length % 4) : "";
  try { return Number(atob(str + pad)); } catch { return null; }
}

// ============================================================
//  URL WHATSAPP — construye correctamente para que emojis
//  se vean bien en el receptor
// ============================================================
function buildWaUrl(numero, texto) {
  return "https://wa.me/" + numero + "?text=" + encodeURIComponent(texto);
}

// ============================================================
//  NORMALIZAR texto para búsqueda tolerante a tildes/errores
// ============================================================
function normalizar(txt) {
  return (txt || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

// ============================================================
//  ESTADO GLOBAL
// ============================================================
let categoriaActiva = 0;
let paginaActual    = 1;
let busquedaActiva  = "";
const POR_PAGINA    = 20;
let seleccionados   = new Map();   // Map<id, { prod, cantidad }>
let productoModal   = null;
let carritoAbierto  = false;

// ============================================================
//  UTILIDADES
// ============================================================
function formatoPrecio(valor) {
  return "$ " + valor.toLocaleString("es-CO");
}

function getImagenURL(imagen) {
  if (!imagen) return "";
  if (imagen.startsWith("http://") || imagen.startsWith("https://")) return imagen;
  return BASE_URL.replace(/\/$/, "") + "/" + imagen.replace(/^\//, "");
}

function getWhatsapp(prod) {
  const entry = WHATSAPP_NUMEROS[prod.whatsapp];
  if (entry) return entry.numero;
  const fallback = Object.values(WHATSAPP_NUMEROS)[0];
  return fallback ? fallback.numero : "";
}

function getWhatsappColor(prod) {
  const entry = WHATSAPP_NUMEROS[prod.whatsapp];
  if (entry) return entry.color;
  const fallback = Object.values(WHATSAPP_NUMEROS)[0];
  return fallback ? fallback.color : "#1a6b3c";
}

function productosFiltrados() {
  // Oculta productos cuyo vendedor tenga membrecia: 0 o sin campo membrecia
  let lista = PRODUCTOS.filter((p) => {
    const entry = WHATSAPP_NUMEROS[p.whatsapp];
    return entry && entry.membrecia === 1;
  });

  if (categoriaActiva !== 0) {
    lista = lista.filter((p) => p.categoria === categoriaActiva);
  }

  if (busquedaActiva.trim()) {
    const q = normalizar(busquedaActiva.trim());
    lista = lista.filter((p) =>
      normalizar(p.nombre).includes(q) ||
      normalizar(p.descripcion).includes(q)
    );
  }
  return lista;
}

function paginaDeProductos(lista) {
  const inicio = (paginaActual - 1) * POR_PAGINA;
  return lista.slice(inicio, inicio + POR_PAGINA);
}

function totalPaginas(lista) {
  return Math.max(1, Math.ceil(lista.length / POR_PAGINA));
}

function calcularTotales() {
  const items    = [...seleccionados.values()];
  const total    = items.reduce((acc, { prod, cantidad }) => acc + prod.valor * cantidad, 0);
  const totalUnd = items.reduce((acc, { cantidad }) => acc + cantidad, 0);
  return { items, total, totalUnd };
}

// ============================================================
//  RENDER — FILTROS
// ============================================================
function renderFiltros() {
  const contenedor = document.getElementById("filtros");
  contenedor.innerHTML = "";

  const btnTodos = document.createElement("button");
  btnTodos.className = "filtro-btn" + (categoriaActiva === 0 ? " activo" : "");
  btnTodos.textContent = "Todos";
  btnTodos.addEventListener("click", () => {
    categoriaActiva = 0; paginaActual = 1; renderCatalogo(); renderFiltros();
  });
  contenedor.appendChild(btnTodos);

  Object.entries(CATEGORIAS).forEach(([id, nombre]) => {
    const btn = document.createElement("button");
    btn.className = "filtro-btn" + (categoriaActiva === Number(id) ? " activo" : "");
    btn.textContent = nombre;
    btn.addEventListener("click", () => {
      categoriaActiva = Number(id); paginaActual = 1; renderCatalogo(); renderFiltros();
    });
    contenedor.appendChild(btn);
  });
}

// ============================================================
//  RENDER — GRILLA
// ============================================================
function renderCatalogo() {
  const grilla = document.getElementById("grilla");
  const infoEl = document.getElementById("resultados-info");
  const lista  = productosFiltrados();
  const pagina = paginaDeProductos(lista);

  grilla.innerHTML = "";
  infoEl.textContent = lista.length === 0
    ? "Sin resultados"
    : `Mostrando ${(paginaActual - 1) * POR_PAGINA + 1}–${Math.min(paginaActual * POR_PAGINA, lista.length)} de ${lista.length} productos`;

  if (pagina.length === 0) {
    grilla.innerHTML = `<div class="sin-resultados"><div class="icono">🔍</div><p>No hay productos en esta categoría.</p></div>`;
  } else {
    pagina.forEach((prod) => grilla.appendChild(crearTarjeta(prod)));
  }
  renderPaginado(lista);
}

// ============================================================
//  TARJETA
// ============================================================
function crearTarjeta(prod) {
  const sel = seleccionados.has(prod.id);
  const div = document.createElement("div");
  div.className = "tarjeta" + (sel ? " seleccionada" : "");
  div.dataset.id = prod.id;
  div.innerHTML = `
    <div class="tarjeta-check">${sel ? "✓" : ""}</div>
    <div class="tarjeta-img-wrap">
      <img src="${getImagenURL(prod.imagen)}" alt="${prod.nombre}" loading="lazy"
           onerror="this.src='https://placehold.co/400x300/e8f5ee/1a6b3c?text=Imagen'">
      <span class="tarjeta-categoria-badge">${CATEGORIAS[prod.categoria]}</span>
    </div>
    <div class="tarjeta-body">
      <div class="tarjeta-nombre">${prod.nombre}</div>
      <div class="tarjeta-beneficio-top">${prod.beneficios[0]}</div>
      <div class="tarjeta-footer">
        <span class="tarjeta-precio">${formatoPrecio(prod.valor)}</span>
        <button class="btn-ver">Ver más</button>
      </div>
    </div>`;

  // Imagen → abre modal
  div.querySelector(".tarjeta-img-wrap").addEventListener("click", (e) => {
    e.stopPropagation();
    abrirModal(prod);
  });
  // "Ver más" → abre modal
  div.querySelector(".btn-ver").addEventListener("click", (e) => {
    e.stopPropagation();
    abrirModal(prod);
  });
  // Resto de la tarjeta → selecciona para carrito
  div.addEventListener("click", (e) => {
    const enImagen = e.target.closest(".tarjeta-img-wrap");
    const enBtnVer = e.target.classList.contains("btn-ver");
    if (!enImagen && !enBtnVer) toggleSeleccion(prod.id);
  });

  return div;
}

// ============================================================
//  SELECCIÓN (con cantidad)
// ============================================================
function toggleSeleccion(id) {
  if (seleccionados.has(id)) {
    seleccionados.delete(id);
  } else {
    const prod = PRODUCTOS.find((p) => p.id === id);
    seleccionados.set(id, { prod, cantidad: 1 });
  }
  actualizarTarjetaSeleccion(id);
  actualizarPanelInferior();
  actualizarCartBtn();
  if (carritoAbierto) renderCarrito();
  if (productoModal && productoModal.id === id) actualizarBtnSeleccionModal();
}

function cambiarCantidad(id, delta) {
  if (!seleccionados.has(id)) return;
  const item = seleccionados.get(id);
  const nueva = item.cantidad + delta;
  if (nueva <= 0) { eliminarDelCarrito(id); return; }
  item.cantidad = nueva;
  actualizarPanelInferior();
  actualizarCartBtn();
  renderCarrito();
}

function eliminarDelCarrito(id) {
  seleccionados.delete(id);
  actualizarTarjetaSeleccion(id);
  actualizarPanelInferior();
  actualizarCartBtn();
  if (productoModal && productoModal.id === id) actualizarBtnSeleccionModal();
  if (seleccionados.size === 0) { cerrarCarrito(); return; }
  renderCarrito();
}

function actualizarTarjetaSeleccion(id) {
  const tarjeta = document.querySelector(`.tarjeta[data-id='${id}']`);
  if (!tarjeta) return;
  const check = tarjeta.querySelector(".tarjeta-check");
  if (seleccionados.has(id)) { tarjeta.classList.add("seleccionada"); check.textContent = "✓"; }
  else { tarjeta.classList.remove("seleccionada"); check.textContent = ""; }
}

function actualizarCartBtn() {
  const btn   = document.getElementById("cart-btn");
  const count = document.getElementById("cart-count");
  const { totalUnd } = calcularTotales();
  count.textContent = totalUnd;
  btn.style.display = seleccionados.size > 0 ? "flex" : "none";
}

function actualizarPanelInferior() {
  const panel = document.getElementById("panel-seleccion");
  const info  = document.getElementById("panel-info-texto");
  const { totalUnd } = calcularTotales();
  if (seleccionados.size === 0) { panel.classList.remove("visible"); return; }
  panel.classList.add("visible");
  info.innerHTML = `<strong>${totalUnd}</strong> unidad${totalUnd > 1 ? "es" : ""} seleccionada${totalUnd > 1 ? "s" : ""}`;
}

function limpiarSeleccion() {
  const ids = [...seleccionados.keys()];
  seleccionados.clear();
  ids.forEach(actualizarTarjetaSeleccion);
  actualizarPanelInferior();
  actualizarCartBtn();
  if (productoModal) actualizarBtnSeleccionModal();
  cerrarCarrito();
}

// ============================================================
//  CARRITO
// ============================================================
function abrirCarrito() {
  carritoAbierto = true;
  renderCarrito();
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
  const { items, total } = calcularTotales();
  const lista = document.getElementById("carrito-lista");

  lista.innerHTML = items.map(({ prod, cantidad }) => `
    <div class="carrito-item" style="border-bottom: 3px solid ${getWhatsappColor(prod)}">
      <img class="carrito-item-img" src="${getImagenURL(prod.imagen)}" alt="${prod.nombre}"
           onerror="this.src='https://placehold.co/80x80/e8f5ee/1a6b3c?text=Img'">
      <div class="carrito-item-info">
        <span class="carrito-item-nombre">${prod.nombre}</span>
        <span class="carrito-item-cat">${CATEGORIAS[prod.categoria]}</span>
        <span class="carrito-item-precio">${formatoPrecio(prod.valor * cantidad)}</span>
      </div>
      <div class="carrito-item-cantidad">
        <button class="qty-btn" data-id="${prod.id}" data-delta="-1">−</button>
        <span class="qty-num">${cantidad}</span>
        <button class="qty-btn" data-id="${prod.id}" data-delta="1">+</button>
      </div>
      <button class="carrito-item-eliminar" data-id="${prod.id}" title="Eliminar">✕</button>
    </div>
  `).join("");

  lista.querySelectorAll(".carrito-item-eliminar").forEach((btn) => {
    btn.addEventListener("click", () => eliminarDelCarrito(Number(btn.dataset.id)));
  });
  lista.querySelectorAll(".qty-btn").forEach((btn) => {
    btn.addEventListener("click", () => cambiarCantidad(Number(btn.dataset.id), Number(btn.dataset.delta)));
  });

  document.getElementById("carrito-total").textContent = formatoPrecio(total);
}

// ============================================================
//  WHATSAPP
// ============================================================
function enviarWhatsappProducto(prod) {
  const numero    = getWhatsapp(prod);
  const imagenURL = getImagenURL(prod.imagen);
  const texto =
    "😊 ¡Hola! Me interesa este producto y quisiera saber más:\n\n" +
    "✨ *" + prod.nombre + "*\n" +
    "💵 Precio: *" + formatoPrecio(prod.valor) + "*\n" +
    "🖼️ " + imagenURL + "\n\n" +
    "¿Está disponible? ¿Hacen envíos? 🙏";
  window.open(buildWaUrl(numero, texto), "_blank");
}

function construirMensajeGrupo(lineas) {
  const lista = lineas.map((l, j) =>
    (j + 1) + ". *" + l.prod.nombre + "* x" + l.cantidad + " — " + formatoPrecio(l.prod.valor * l.cantidad) + "\n" +
    "   🖼️ " + getImagenURL(l.prod.imagen)
  ).join("\n");

  const total = lineas.reduce((a, l) => a + l.prod.valor * l.cantidad, 0);

  return "👋 ¡Hola! Quisiera hacer un pedido:\n\n" + lista + "\n\n" +
         "✅ *Total: " + formatoPrecio(total) + "*\n\n" +
         "¿Pueden confirmar disponibilidad y opciones de envío? 🙏";
}

function enviarWhatsappCarrito() {
  if (seleccionados.size === 0) return;
  const { items } = calcularTotales();

  const grupos = {};
  items.forEach(({ prod, cantidad }) => {
    const num = getWhatsapp(prod);
    if (!grupos[num]) grupos[num] = [];
    grupos[num].push({ prod, cantidad });
  });

  const entradas = Object.entries(grupos);

  if (entradas.length > 1) {
    const ok = confirm(
      "Este pedido incluye productos de " + entradas.length + " vendedores diferentes.\n" +
      "Se abrirán " + entradas.length + " chats de WhatsApp, uno por vendedor.\n\n¿Continuar?"
    );
    if (!ok) return;
  }

  const urls = entradas.map(([numero, lineas]) =>
    buildWaUrl(numero, construirMensajeGrupo(lineas))
  );
  urls.forEach((url) => window.open(url, "_blank"));
}

// ============================================================
//  COMPARTIR PRODUCTO
// ============================================================
function compartirProducto(prod) {
  const url = new URL(window.location.href);
  url.searchParams.set("p", encodeId(prod.id));
  const enlace = url.toString();

  const beneficioTop = prod.beneficios[0] || "";

  const textoShare =
    "🌿 ¡Esto te va a interesar!\n\n" +
    "*" + prod.nombre + "*\n" +
    "✅ " + beneficioTop + "\n" +
    "💵 Solo *" + formatoPrecio(prod.valor) + "*\n\n" +
    "👇 Míralo aquí:";

  const textoCompleto = textoShare + "\n" + enlace;

  if (navigator.share) {
    navigator.share({
      title: prod.nombre,
      text: textoShare,
      url: enlace,
    }).catch(() => {});
  } else {
    navigator.clipboard.writeText(textoCompleto).then(() => {
      const btn = document.getElementById("btn-compartir-modal");
      const original = btn.innerHTML;
      btn.innerHTML = "✓ ¡Copiado!";
      btn.style.background = "#1a6b3c";
      btn.style.color = "#fff";
      setTimeout(() => {
        btn.innerHTML = original;
        btn.style.background = "";
        btn.style.color = "";
      }, 2000);
    });
  }
}

// ============================================================
//  MODAL
// ============================================================
function abrirModal(prod) {
  productoModal = prod;
  document.getElementById("modal-img").src               = getImagenURL(prod.imagen);
  document.getElementById("modal-img").alt               = prod.nombre;
  document.getElementById("modal-categoria").textContent = CATEGORIAS[prod.categoria];
  document.getElementById("modal-nombre").textContent    = prod.nombre;
  document.getElementById("modal-precio").textContent    = formatoPrecio(prod.valor);
  document.getElementById("modal-desc").textContent      = prod.descripcion;
  document.getElementById("modal-beneficios").innerHTML  = prod.beneficios.map((b) => "<li>" + b + "</li>").join("");

  //  sobre el producto
  const seccion = document.getElementById("modal-consumo-seccion");
  const texto   = document.getElementById("modal-consumo-texto");
  if (prod.recomendacion) {
    texto.textContent     = prod.recomendacion;
    seccion.style.display = "block";
  } else {
    texto.textContent     = "";
    seccion.style.display = "none";
  }

  actualizarBtnSeleccionModal();
  document.getElementById("btn-whatsapp-modal").onclick  = () => enviarWhatsappProducto(prod);
  document.getElementById("btn-compartir-modal").onclick = () => compartirProducto(prod);
  document.getElementById("overlay").classList.add("activo");
  document.body.style.overflow = "hidden";

  // URL compartible con ID en Base64
  const urlActual = new URL(window.location.href);
  urlActual.searchParams.set("p", encodeId(prod.id));
  history.replaceState(null, "", urlActual);
}

function cerrarModal() {
  document.getElementById("overlay").classList.remove("activo");
  document.body.style.overflow = "";
  productoModal = null;
  const url = new URL(window.location.href);
  url.searchParams.delete("p");
  history.replaceState(null, "", url);
}

function actualizarBtnSeleccionModal() {
  if (!productoModal) return;
  const btn = document.getElementById("btn-seleccionar-modal");
  const sel = seleccionados.has(productoModal.id);
  btn.textContent = sel ? "✓ Seleccionado" : "🛒 Añadir";
  btn.className   = "btn-seleccionar-modal" + (sel ? " activo" : "");
}

// ============================================================
//  PAGINADO
// ============================================================
function renderPaginado(lista) {
  const contenedor = document.getElementById("paginado");
  contenedor.innerHTML = "";
  const total = totalPaginas(lista);
  if (total <= 1) return;

  const crearBtn = (texto, pag, disabled = false, activo = false) => {
    const btn = document.createElement("button");
    btn.className = "pag-btn" + (activo ? " activo" : "");
    btn.textContent = texto;
    btn.disabled = disabled;
    if (!disabled && !activo) btn.addEventListener("click", () => {
      paginaActual = pag; renderCatalogo(); window.scrollTo({ top: 0, behavior: "smooth" });
    });
    return btn;
  };

  contenedor.appendChild(crearBtn("←", paginaActual - 1, paginaActual === 1));
  for (let i = 1; i <= total; i++) contenedor.appendChild(crearBtn(i, i, false, i === paginaActual));
  contenedor.appendChild(crearBtn("→", paginaActual + 1, paginaActual === total));
}

// ============================================================
//  INICIALIZACIÓN
// ============================================================
document.addEventListener("DOMContentLoaded", () => {
  renderFiltros();
  renderCatalogo();

  // Buscador en header
  const inputBusqueda = document.getElementById("busqueda-input");
  const btnLimpiar    = document.getElementById("busqueda-limpiar");

  if (inputBusqueda) {
    inputBusqueda.addEventListener("input", () => {
      busquedaActiva = inputBusqueda.value;
      btnLimpiar.style.display = busquedaActiva ? "flex" : "none";
      paginaActual = 1;
      renderCatalogo();
    });
    btnLimpiar.addEventListener("click", () => {
      busquedaActiva = "";
      inputBusqueda.value = "";
      btnLimpiar.style.display = "none";
      paginaActual = 1;
      renderCatalogo();
      inputBusqueda.focus();
    });
  }

  // Modal
  document.getElementById("overlay").addEventListener("click", (e) => {
    if (e.target.id === "overlay") cerrarModal();
  });
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

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") { carritoAbierto ? cerrarCarrito() : cerrarModal(); }
  });

  actualizarCartBtn();

  // Abre modal si la URL tiene ?p=BASE64
  const params  = new URLSearchParams(window.location.search);
  const encoded = params.get("p");
  if (encoded) {
    const prodIdURL = decodeId(encoded);
    const prod = PRODUCTOS.find((p) => p.id === prodIdURL);
    if (prod) setTimeout(() => abrirModal(prod), 300);
  }
});