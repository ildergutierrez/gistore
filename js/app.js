// ============================================================
//  ESTADO GLOBAL
// ============================================================
let categoriaActiva = 0;
let paginaActual    = 1;
const POR_PAGINA    = 20;
const DESCUENTO_MIN = 5;
const DESCUENTO_PCT = 0.05;
let seleccionados   = new Set();
let productoModal   = null;
let carritoAbierto  = false;

// ============================================================
//  UTILIDADES
// ============================================================
function formatoPrecio(valor) {
  return "$ " + valor.toLocaleString("es-CO");
}

function productosFiltrados() {
  if (categoriaActiva === 0) return PRODUCTOS;
  return PRODUCTOS.filter((p) => p.categoria === categoriaActiva);
}

function paginaDeProductos(lista) {
  const inicio = (paginaActual - 1) * POR_PAGINA;
  return lista.slice(inicio, inicio + POR_PAGINA);
}

function totalPaginas(lista) {
  return Math.max(1, Math.ceil(lista.length / POR_PAGINA));
}

function calcularTotales() {
  const prods     = [...seleccionados].map((id) => PRODUCTOS.find((p) => p.id === id)).filter(Boolean);
  const subtotal  = prods.reduce((acc, p) => acc + p.valor, 0);
  const aplica    = prods.length >= DESCUENTO_MIN;
  const descuento = aplica ? Math.round(subtotal * DESCUENTO_PCT) : 0;
  const total     = subtotal - descuento;
  return { prods, subtotal, descuento, total, aplica };
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
      <img src="${prod.imagen}" alt="${prod.nombre}" loading="lazy"
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
  div.addEventListener("click", (e) => { if (!e.target.classList.contains("btn-ver")) toggleSeleccion(prod.id); });
  div.querySelector(".btn-ver").addEventListener("click", (e) => { e.stopPropagation(); abrirModal(prod); });
  return div;
}

// ============================================================
//  SELECCIÓN
// ============================================================
function toggleSeleccion(id) {
  seleccionados.has(id) ? seleccionados.delete(id) : seleccionados.add(id);
  actualizarTarjetaSeleccion(id);
  actualizarPanelInferior();
  actualizarCartBtn();
  if (carritoAbierto) renderCarrito();
  if (productoModal && productoModal.id === id) actualizarBtnSeleccionModal();
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
  count.textContent = seleccionados.size;
  btn.style.display = seleccionados.size > 0 ? "flex" : "none";
}

function actualizarPanelInferior() {
  const panel = document.getElementById("panel-seleccion");
  const info  = document.getElementById("panel-info-texto");
  if (seleccionados.size === 0) { panel.classList.remove("visible"); return; }
  panel.classList.add("visible");
  info.innerHTML = `<strong>${seleccionados.size}</strong> producto${seleccionados.size > 1 ? "s" : ""} seleccionado${seleccionados.size > 1 ? "s" : ""}`;
}

function limpiarSeleccion() {
  const ids = [...seleccionados];
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
  const { prods, subtotal, descuento, total, aplica } = calcularTotales();
  const lista  = document.getElementById("carrito-lista");
  const faltan = DESCUENTO_MIN - prods.length;

  // Items
  lista.innerHTML = prods.map((p) => `
    <div class="carrito-item">
      <img class="carrito-item-img" src="${p.imagen}" alt="${p.nombre}"
           onerror="this.src='https://placehold.co/80x80/e8f5ee/1a6b3c?text=Img'">
      <div class="carrito-item-info">
        <span class="carrito-item-nombre">${p.nombre}</span>
        <span class="carrito-item-cat">${CATEGORIAS[p.categoria]}</span>
        <span class="carrito-item-precio">${formatoPrecio(p.valor)}</span>
      </div>
      <button class="carrito-item-eliminar" data-id="${p.id}" title="Eliminar">✕</button>
    </div>
  `).join("");

  lista.querySelectorAll(".carrito-item-eliminar").forEach((btn) => {
    btn.addEventListener("click", () => eliminarDelCarrito(Number(btn.dataset.id)));
  });

  // Banner
  const banner = document.getElementById("carrito-banner");
  if (aplica) {
    banner.innerHTML = `🎉 ¡Descuento del 5% aplicado por llevar ${prods.length} productos!`;
    banner.className = "descuento-activo";
  } else if (faltan > 0) {
    banner.innerHTML = `🛍️ Agrega <strong>${faltan}</strong> producto${faltan > 1 ? "s" : ""} más y obtén un <strong>5% de descuento</strong>`;
    banner.className = "descuento-promo";
  } else {
    banner.innerHTML = "";
    banner.className = "";
  }

  // Totales
  document.getElementById("carrito-subtotal").textContent = formatoPrecio(subtotal);
  const descRow = document.getElementById("carrito-descuento-row");
  descRow.style.display = aplica ? "flex" : "none";
  document.getElementById("carrito-descuento-val").textContent = "- " + formatoPrecio(descuento);
  document.getElementById("carrito-total").textContent = formatoPrecio(total);
}

// ============================================================
//  WHATSAPP
// ============================================================
function enviarWhatsappProducto(prod) {
  const msg = encodeURIComponent(
    `¡Hola! 👋 Me interesa el producto:\n\n📦 *${prod.nombre}*\n💰 Precio: ${formatoPrecio(prod.valor)}\n\n¿Pueden darme más información?`
  );
  window.open(`https://wa.me/${WHATSAPP_NUMERO}?text=${msg}`, "_blank");
}

function enviarWhatsappCarrito() {
  if (seleccionados.size === 0) return;
  const { prods, subtotal, descuento, total, aplica } = calcularTotales();
  const lista = prods.map((p, i) => `${i + 1}. *${p.nombre}* — ${formatoPrecio(p.valor)}`).join("\n");
  let txt = `¡Hola! 👋 Quisiera hacer un pedido:\n\n${lista}\n\n`;
  txt += `💵 Subtotal: ${formatoPrecio(subtotal)}\n`;
  if (aplica) {
    txt += `🏷️ Descuento 5%: - ${formatoPrecio(descuento)}\n`;
    txt += `✅ *Total con descuento: ${formatoPrecio(total)}*\n\n`;
  } else {
    txt += `✅ *Total: ${formatoPrecio(total)}*\n\n`;
  }
  txt += `¿Pueden confirmar disponibilidad y opciones de envío? 🙏`;
  window.open(`https://wa.me/${WHATSAPP_NUMERO}?text=${encodeURIComponent(txt)}`, "_blank");
}

// ============================================================
//  MODAL
// ============================================================
function abrirModal(prod) {
  productoModal = prod;
  document.getElementById("modal-img").src = prod.imagen;
  document.getElementById("modal-img").alt = prod.nombre;
  document.getElementById("modal-categoria").textContent = CATEGORIAS[prod.categoria];
  document.getElementById("modal-nombre").textContent    = prod.nombre;
  document.getElementById("modal-precio").textContent    = formatoPrecio(prod.valor);
  document.getElementById("modal-desc").textContent      = prod.descripcion;
  document.getElementById("modal-beneficios").innerHTML  = prod.beneficios.map((b) => `<li>${b}</li>`).join("");
  actualizarBtnSeleccionModal();
  document.getElementById("btn-whatsapp-modal").onclick = () => enviarWhatsappProducto(prod);
  document.getElementById("overlay").classList.add("activo");
  document.body.style.overflow = "hidden";
}

function cerrarModal() {
  document.getElementById("overlay").classList.remove("activo");
  document.body.style.overflow = "";
  productoModal = null;
}

function actualizarBtnSeleccionModal() {
  if (!productoModal) return;
  const btn = document.getElementById("btn-seleccionar-modal");
  const sel = seleccionados.has(productoModal.id);
  btn.textContent = sel ? "✓ Seleccionado" : "+ Añadir a selección";
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

  // Modal producto
  document.getElementById("overlay").addEventListener("click", (e) => {
    if (e.target.id === "overlay") cerrarModal();
  });
  document.getElementById("btn-cerrar-modal").addEventListener("click", cerrarModal);
  document.getElementById("btn-seleccionar-modal").addEventListener("click", () => {
    if (productoModal) toggleSeleccion(productoModal.id);
  });

  // Panel inferior
  document.getElementById("btn-limpiar").addEventListener("click", limpiarSeleccion);
  document.getElementById("btn-whatsapp-panel").addEventListener("click", abrirCarrito);

  // Carrito
  document.getElementById("cart-btn").addEventListener("click", abrirCarrito);
  document.getElementById("carrito-overlay").addEventListener("click", cerrarCarrito);
  document.getElementById("btn-cerrar-carrito").addEventListener("click", cerrarCarrito);
  document.getElementById("btn-carrito-limpiar").addEventListener("click", limpiarSeleccion);
  document.getElementById("btn-carrito-whatsapp").addEventListener("click", enviarWhatsappCarrito);

  // ESC
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") { carritoAbierto ? cerrarCarrito() : cerrarModal(); }
  });

  actualizarCartBtn();
});