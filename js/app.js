// ============================================================
//  ESTADO GLOBAL
// ============================================================
let categoriaActiva  = 0;          // 0 = todas
let paginaActual     = 1;
const POR_PAGINA     = 20;
let seleccionados    = new Set();   // IDs de productos seleccionados
let productoModal    = null;        // Producto abierto en modal

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

// ============================================================
//  RENDER — FILTROS DE CATEGORÍAS
// ============================================================
function renderFiltros() {
  const contenedor = document.getElementById("filtros");
  contenedor.innerHTML = "";

  // Botón "Todos"
  const btnTodos = document.createElement("button");
  btnTodos.className = "filtro-btn" + (categoriaActiva === 0 ? " activo" : "");
  btnTodos.textContent = "Todos";
  btnTodos.addEventListener("click", () => {
    categoriaActiva = 0;
    paginaActual    = 1;
    renderCatalogo();
    renderFiltros();
  });
  contenedor.appendChild(btnTodos);

  // Botones por categoría
  Object.entries(CATEGORIAS).forEach(([id, nombre]) => {
    const btn = document.createElement("button");
    btn.className = "filtro-btn" + (categoriaActiva === Number(id) ? " activo" : "");
    btn.textContent = nombre;
    btn.addEventListener("click", () => {
      categoriaActiva = Number(id);
      paginaActual    = 1;
      renderCatalogo();
      renderFiltros();
    });
    contenedor.appendChild(btn);
  });
}

// ============================================================
//  RENDER — GRILLA DE PRODUCTOS
// ============================================================
function renderCatalogo() {
  const grilla    = document.getElementById("grilla");
  const infoEl    = document.getElementById("resultados-info");
  const lista     = productosFiltrados();
  const pagina    = paginaDeProductos(lista);
  const totalPag  = totalPaginas(lista);

  grilla.innerHTML = "";
  infoEl.textContent =
    lista.length === 0
      ? "Sin resultados"
      : `Mostrando ${(paginaActual - 1) * POR_PAGINA + 1}–${Math.min(paginaActual * POR_PAGINA, lista.length)} de ${lista.length} productos`;

  if (pagina.length === 0) {
    grilla.innerHTML = `
      <div class="sin-resultados">
        <div class="icono">🔍</div>
        <p>No hay productos en esta categoría.</p>
      </div>`;
  } else {
    pagina.forEach((prod) => grilla.appendChild(crearTarjeta(prod)));
  }

  renderPaginado(lista);
}

// ============================================================
//  CREAR TARJETA
// ============================================================
function crearTarjeta(prod) {
  const estaSeleccionado = seleccionados.has(prod.id);
  const div = document.createElement("div");
  div.className = "tarjeta" + (estaSeleccionado ? " seleccionada" : "");
  div.dataset.id = prod.id;

  div.innerHTML = `
    <div class="tarjeta-check">${estaSeleccionado ? "✓" : ""}</div>
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

  // Click en la tarjeta → toggle selección
  div.addEventListener("click", (e) => {
    if (e.target.classList.contains("btn-ver")) return;
    toggleSeleccion(prod.id);
  });

  // Click en "Ver más" → abrir modal
  div.querySelector(".btn-ver").addEventListener("click", (e) => {
    e.stopPropagation();
    abrirModal(prod);
  });

  return div;
}

// ============================================================
//  SELECCIÓN MÚLTIPLE
// ============================================================
function toggleSeleccion(id) {
  if (seleccionados.has(id)) {
    seleccionados.delete(id);
  } else {
    seleccionados.add(id);
  }
  actualizarTarjetaSeleccion(id);
  actualizarPanelSeleccion();
  actualizarCartBtn();
  // Si el modal está abierto con ese producto, actualiza el botón
  if (productoModal && productoModal.id === id) {
    actualizarBtnSeleccionModal();
  }
}

function actualizarTarjetaSeleccion(id) {
  const tarjeta = document.querySelector(`.tarjeta[data-id='${id}']`);
  if (!tarjeta) return;
  const check = tarjeta.querySelector(".tarjeta-check");
  if (seleccionados.has(id)) {
    tarjeta.classList.add("seleccionada");
    check.textContent = "✓";
  } else {
    tarjeta.classList.remove("seleccionada");
    check.textContent = "";
  }
}

function actualizarCartBtn() {
  const btn   = document.getElementById("cart-btn");
  const count = document.getElementById("cart-count");
  count.textContent = seleccionados.size;
  btn.style.display = seleccionados.size > 0 ? "flex" : "none";
}

function actualizarPanelSeleccion() {
  const panel = document.getElementById("panel-seleccion");
  const info  = document.getElementById("panel-info-texto");

  if (seleccionados.size === 0) {
    panel.classList.remove("visible");
    return;
  }

  panel.classList.add("visible");
  const nombres = [...seleccionados]
    .map((id) => PRODUCTOS.find((p) => p.id === id)?.nombre)
    .filter(Boolean);
  info.innerHTML = `<strong>${seleccionados.size}</strong> producto${seleccionados.size > 1 ? "s" : ""} seleccionado${seleccionados.size > 1 ? "s" : ""}`;
}

function limpiarSeleccion() {
  const ids = [...seleccionados];
  seleccionados.clear();
  ids.forEach(actualizarTarjetaSeleccion);
  actualizarPanelSeleccion();
  actualizarCartBtn();
  if (productoModal) actualizarBtnSeleccionModal();
}

// ============================================================
//  WHATSAPP — UN PRODUCTO
// ============================================================
function enviarWhatsappProducto(prod) {
  const msg = encodeURIComponent(
    `¡Hola! 👋 Me interesa el producto:\n\n` +
    `📦 *${prod.nombre}*\n` +
    `💰 Precio: ${formatoPrecio(prod.valor)}\n\n` +
    `¿Pueden darme más información?`
  );
  window.open(`https://wa.me/${WHATSAPP_NUMERO}?text=${msg}`, "_blank");
}

// ============================================================
//  WHATSAPP — MÚLTIPLES PRODUCTOS
// ============================================================
function enviarWhatsappSeleccion() {
  if (seleccionados.size === 0) return;
  const productos = [...seleccionados].map((id) => PRODUCTOS.find((p) => p.id === id)).filter(Boolean);
  const lista = productos.map((p, i) => `${i + 1}. *${p.nombre}* — ${formatoPrecio(p.valor)}`).join("\n");
  const msg = encodeURIComponent(
    `¡Hola! 👋 Estoy interesado/a en los siguientes productos:\n\n` +
    `${lista}\n\n` +
    `¿Podrían brindarme más información sobre disponibilidad y envíos? 🙏`
  );
  window.open(`https://wa.me/${WHATSAPP_NUMERO}?text=${msg}`, "_blank");
}

// ============================================================
//  MODAL
// ============================================================
function abrirModal(prod) {
  productoModal = prod;
  const overlay   = document.getElementById("overlay");
  const esSel     = seleccionados.has(prod.id);

  document.getElementById("modal-img").src      = prod.imagen;
  document.getElementById("modal-img").alt      = prod.nombre;
  document.getElementById("modal-categoria").textContent = CATEGORIAS[prod.categoria];
  document.getElementById("modal-nombre").textContent    = prod.nombre;
  document.getElementById("modal-precio").textContent    = formatoPrecio(prod.valor);
  document.getElementById("modal-desc").textContent      = prod.descripcion;

  const ulBeneficios = document.getElementById("modal-beneficios");
  ulBeneficios.innerHTML = prod.beneficios.map((b) => `<li>${b}</li>`).join("");

  actualizarBtnSeleccionModal();

  // Botón WhatsApp producto individual
  const btnWa = document.getElementById("btn-whatsapp-modal");
  btnWa.onclick = () => enviarWhatsappProducto(prod);

  overlay.classList.add("activo");
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

  const crearBtn = (texto, pagina, disabled = false, activo = false) => {
    const btn = document.createElement("button");
    btn.className = "pag-btn" + (activo ? " activo" : "");
    btn.textContent = texto;
    btn.disabled    = disabled;
    if (!disabled && !activo) {
      btn.addEventListener("click", () => {
        paginaActual = pagina;
        renderCatalogo();
        window.scrollTo({ top: 0, behavior: "smooth" });
      });
    }
    return btn;
  };

  contenedor.appendChild(crearBtn("←", paginaActual - 1, paginaActual === 1));

  for (let i = 1; i <= total; i++) {
    contenedor.appendChild(crearBtn(i, i, false, i === paginaActual));
  }

  contenedor.appendChild(crearBtn("→", paginaActual + 1, paginaActual === total));
}

// ============================================================
//  INICIALIZACIÓN
// ============================================================
document.addEventListener("DOMContentLoaded", () => {
  // Render inicial
  renderFiltros();
  renderCatalogo();

  // Cerrar modal
  document.getElementById("overlay").addEventListener("click", (e) => {
    if (e.target === document.getElementById("overlay")) cerrarModal();
  });
  document.getElementById("btn-cerrar-modal").addEventListener("click", cerrarModal);

  // Botón seleccionar desde modal
  document.getElementById("btn-seleccionar-modal").addEventListener("click", () => {
    if (!productoModal) return;
    toggleSeleccion(productoModal.id);
  });

  // Panel de selección
  document.getElementById("btn-limpiar").addEventListener("click", limpiarSeleccion);
  document.getElementById("btn-whatsapp-panel").addEventListener("click", enviarWhatsappSeleccion);

  // Cart button en header
  document.getElementById("cart-btn").addEventListener("click", enviarWhatsappSeleccion);

  // Ocultar cart btn al inicio
  actualizarCartBtn();

  // Tecla ESC
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") cerrarModal();
  });
});
