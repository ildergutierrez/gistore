// ============================================================
//  gistore/js/app.js  —  GI Store · Catálogo público
//  Sin Firebase. Todo viene de PHP por GET.
//  Carrito persistido en localStorage.
// ============================================================
import {
  obtenerCategorias,
  obtenerVendedores,
  obtenerProductosActivos,
  obtenerProductoPorId,
} from './api.js';

// ── Utilidades ─────────────────────────────────────────────
const POR_PAGINA  = 20;
const CARRITO_KEY = 'gistore_carrito';

function formatoPrecio(v) {
  return '$ ' + Number(v).toLocaleString('es-CO');
}
function normalizar(t) {
  return (t || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}
function buildWaUrl(n, t) {
  return 'https://wa.me/' + n + '?text=' + encodeURIComponent(t);
}
function encodeId(id)  { return btoa(String(id)).replace(/=/g, ''); }
function decodeId(str) {
  const pad = str.length % 4 ? '='.repeat(4 - str.length % 4) : '';
  try { return atob(str + pad); } catch { return null; }
}

// ── Resolver imagen ────────────────────────────────────────
// · URL completa (https://…)  → tal cual
// · Ruta local (img/…)        → dominio del servidor + ruta
const _BASE_DOMINIO = (() => {
  const isGH = window.location.hostname.includes('github.io');
  return isGH ? window.location.origin + '/gistore' : window.location.origin;
})();

function resolverImg(url) {
  if (!url) return '';
  if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('data:')) return url;
  // Limpiar separadores de Windows y rutas absolutas de sistema
  url = url.replace(/\\/g, '/').replace(/^[A-Za-z]:\/.*?\/gistore\//, '').replace(/^\//, '');
  return _BASE_DOMINIO + '/' + url;
}

// ── Estado global ──────────────────────────────────────────
let CATEGORIAS      = {};
let VENDEDORES      = {};

let categoriaActiva = '';
let busquedaActiva  = '';
let paginaActual    = 1;
let totalProductos  = 0;

let cachePaginas    = {};
let _cacheTodos     = null;

let productoModal   = null;
let carritoAbierto  = false;

// ── Carrito en localStorage ────────────────────────────────
// Persiste entre sesiones hasta que el usuario lo limpie
// o haga el pedido por WhatsApp.
function cargarCarrito() {
  try {
    const raw = localStorage.getItem(CARRITO_KEY);
    if (!raw) return new Map();
    return new Map(JSON.parse(raw));
  } catch { return new Map(); }
}
function guardarCarrito() {
  try {
    localStorage.setItem(CARRITO_KEY, JSON.stringify([...seleccionados.entries()]));
  } catch { /* cuota llena: ignorar */ }
}
function limpiarCarritoStorage() {
  localStorage.removeItem(CARRITO_KEY);
}

let seleccionados = cargarCarrito();

// ── Helpers de vendedor ────────────────────────────────────
function colorVend(id)  { return VENDEDORES[id]?.color    || '#1a6b3c'; }
function waVend(id)     { return VENDEDORES[id]?.whatsapp || ''; }
function nomVend(id)    { return VENDEDORES[id]?.nombre   || ''; }
function ciudadVend(id) { return VENDEDORES[id]?.ciudad   || ''; }
function fotoVend(id)   { return VENDEDORES[id]?.perfil   || ''; }
function urlTienda(id)  { return id ? 'page/tienda.html?v=' + encodeId(id) : '#'; }
function nomCat(id)     { return CATEGORIAS[id] || ''; }

// ── Caché maestro ──────────────────────────────────────────
async function _getTodosActivos() {
  if (_cacheTodos) return _cacheTodos;

  let docs = await obtenerProductosActivos();

  // Solo productos de vendedores activos (el PHP ya lo filtra, doble seguro)
  const idsActivos = Object.keys(VENDEDORES);
  if (idsActivos.length)
    docs = docs.filter(p => idsActivos.includes(String(p.vendedor_id)));

  docs.sort((a, b) => normalizar(a.nombre).localeCompare(normalizar(b.nombre)));

  _cacheTodos           = docs;
  window._cacheTodos    = docs;
  window._categoriasMap = CATEGORIAS;
  return docs;
}

// ── Fetch de una página ────────────────────────────────────
async function fetchPagina(pag) {
  const clave = `${pag}|${categoriaActiva}|${normalizar(busquedaActiva)}`;
  if (cachePaginas[clave]) return cachePaginas[clave];

  try {
    let todos = await _getTodosActivos();

    if (categoriaActiva)
      todos = todos.filter(p => String(p.categoria_id) === String(categoriaActiva));

    if (busquedaActiva.trim()) {
      const termN = normalizar(busquedaActiva);
      todos = todos.filter(p =>
        normalizar(p.nombre).includes(termN) ||
        normalizar(p.descripcion || '').includes(termN)
      );
    }

    totalProductos = todos.length;
    const inicio   = (pag - 1) * POR_PAGINA;
    const resultado = todos.slice(inicio, inicio + POR_PAGINA);
    cachePaginas[clave] = resultado;
    return resultado;
  } catch (e) {
    console.error('fetchPagina:', e);
    return [];
  }
}

function resetCache() {
  cachePaginas = {};
}

// ── Spinner ────────────────────────────────────────────────
function mostrarCargando(si) {
  let el = document.getElementById('cargando-productos');
  if (!el) {
    el = document.createElement('p');
    el.id        = 'cargando-productos';
    el.className = 'resultados-info';
    document.getElementById('grilla').before(el);
  }
  el.textContent   = '⏳ Cargando productos…';
  el.style.display = si ? 'block' : 'none';
}

// ── Sincronizar carrito ────────────────────────────────────
// Elimina del carrito productos que ya no existen en el catálogo
function sincronizarCarrito() {
  if (!_cacheTodos) return;
  const idsValidos = new Set(_cacheTodos.map(p => String(p.id)));
  let cambio = false;
  for (const [id] of seleccionados) {
    if (!idsValidos.has(String(id))) { seleccionados.delete(id); cambio = true; }
  }
  if (cambio) { guardarCarrito(); actualizarCartBtn(); actualizarPanelInferior(); }
}

// ── Inicio ─────────────────────────────────────────────────
async function iniciar() {
  mostrarCargando(true);
  try {
    const [cats, vends] = await Promise.all([obtenerCategorias(), obtenerVendedores()]);

    cats.forEach(c  => { CATEGORIAS[String(c.id)] = c.nombre; });
    vends.forEach(v => { VENDEDORES[String(v.id)] = v; });

    renderFiltros();
    await renderCatalogo();

    sincronizarCarrito();
    actualizarCartBtn();
    actualizarPanelInferior();

    // Abrir producto por URL ?p=…
    const enc = new URLSearchParams(window.location.search).get('p');
    if (enc) abrirProductoPorUrl(enc);
  } catch (e) {
    console.error(e);
    document.getElementById('grilla').innerHTML =
      '<div class="sin-resultados"><p>Error al cargar. Recarga la página.</p></div>';
  } finally {
    mostrarCargando(false);
  }
}

// ── Filtros de categoría ───────────────────────────────────
function renderFiltros() {
  const cont = document.getElementById('filtros');
  cont.innerHTML = '';

  const mk = (texto, id) => {
    const b = document.createElement('button');
    b.className   = 'filtro-btn' + (categoriaActiva === id ? ' activo' : '');
    b.textContent = texto;
    b.addEventListener('click', async () => {
      if (categoriaActiva === id) return;
      categoriaActiva = id;
      paginaActual    = 1;
      resetCache();
      renderFiltros();
      await renderCatalogo();
    });
    cont.appendChild(b);
  };
  mk('Todos', '');
  Object.entries(CATEGORIAS).forEach(([id, nombre]) => mk(nombre, id));
}

// ── Catálogo ───────────────────────────────────────────────
async function renderCatalogo() {
  const grilla = document.getElementById('grilla');
  const infoEl = document.getElementById('resultados-info');
  grilla.innerHTML = '';
  mostrarCargando(true);

  const pagina    = await fetchPagina(paginaActual);
  mostrarCargando(false);

  const total     = totalProductos;
  const totalPags = Math.max(1, Math.ceil(total / POR_PAGINA));
  const desde     = pagina.length ? (paginaActual - 1) * POR_PAGINA + 1 : 0;
  const hasta     = Math.min(paginaActual * POR_PAGINA, total);

  if (busquedaActiva.trim()) {
    infoEl.textContent = total > 0
      ? `${total} resultado${total !== 1 ? 's' : ''} para "${busquedaActiva}"`
      : `Sin resultados para "${busquedaActiva}"`;
  } else if (total > 0) {
    infoEl.textContent =
      `${total.toLocaleString('es-CO')} productos · ` +
      `mostrando ${desde}–${hasta} · página ${paginaActual} de ${totalPags}`;
  } else {
    infoEl.textContent = 'Sin resultados';
  }

  if (!pagina.length) {
    grilla.innerHTML =
      `<div class="sin-resultados"><div class="icono">🔍</div>
       <p>${busquedaActiva.trim()
         ? 'No encontramos ese producto. Intenta con otro término.'
         : 'No hay productos' + (categoriaActiva ? ' en esta categoría' : '') + '.'
       }</p></div>`;
  } else {
    pagina.forEach(p => grilla.appendChild(crearTarjeta(p)));
  }

  renderPaginado(total);
}

// ── Tarjeta ────────────────────────────────────────────────
function crearTarjeta(prod) {
  const id     = String(prod.id);
  const sel    = seleccionados.has(id);
  const color  = colorVend(prod.vendedor_id);
  const nombre = nomVend(prod.vendedor_id);
  const ciudad = ciudadVend(prod.vendedor_id);
  const foto   = fotoVend(prod.vendedor_id);
  const link   = urlTienda(prod.vendedor_id);

  const chipVendedor = nombre ? `
    <a href="${link}" class="tarjeta-vendedor-chip"
       title="Ver tienda de ${nombre}" onclick="event.stopPropagation()">
      ${foto
        ? `<img class="chip-foto" src="${resolverImg(foto)}" alt="${nombre}"
               onerror="this.style.display='none'">`
        : `<span class="chip-iniciales" style="background:${color}">${nombre[0].toUpperCase()}</span>`
      }
      <span class="chip-info">
        <span class="chip-nombre">${nombre}</span>
        ${ciudad ? `<span class="chip-ciudad">📍 ${ciudad}</span>` : ''}
      </span>
    </a>` : '';

  const div = document.createElement('div');
  div.className  = 'tarjeta' + (sel ? ' seleccionada' : '');
  div.dataset.id = id;
  div.innerHTML  = `
    <div class="tarjeta-check">${sel ? '✓' : ''}</div>
    <div class="tarjeta-img-wrap">
      <img src="${resolverImg(prod.imagen)}" alt="${prod.nombre}" loading="lazy"
           onerror="this.src='https://placehold.co/400x300/e8f5ee/1a6b3c?text=Imagen'">
      <span class="tarjeta-categoria-badge">${nomCat(prod.categoria_id)}</span>
    </div>
    <div class="tarjeta-body">
      <div class="tarjeta-nombre">${prod.nombre}</div>
      <div class="tarjeta-beneficio-top">${(prod.beneficios || [])[0] || ''}</div>
      <div class="tarjeta-footer">
        <span class="tarjeta-precio" style="color:${color}">${formatoPrecio(prod.valor)}</span>
        <button class="btn-ver">Ver más</button>
      </div>
      ${chipVendedor}
    </div>`;

  div.querySelector('.tarjeta-img-wrap')
     .addEventListener('click', e => { e.stopPropagation(); abrirModal(prod); });
  div.querySelector('.btn-ver')
     .addEventListener('click', e => { e.stopPropagation(); abrirModal(prod); });
  div.addEventListener('click', e => {
    if (!e.target.closest('.tarjeta-img-wrap') &&
        !e.target.classList.contains('btn-ver') &&
        !e.target.closest('.tarjeta-vendedor-chip'))
      toggleSeleccion(id, prod);
  });
  return div;
}

// ── Paginador inteligente ──────────────────────────────────
function renderPaginado(totalItems) {
  const cont     = document.getElementById('paginado');
  cont.innerHTML = '';
  const totalPags = Math.max(1, Math.ceil(totalItems / POR_PAGINA));
  if (totalPags <= 1) return;

  const DELTA = window.innerWidth < 500 ? 1 : 2;

  async function irA(pag) {
    paginaActual = pag;
    await renderCatalogo();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  const mk = (txt, pag, disabled = false, activo = false, elipsis = false) => {
    const b     = document.createElement('button');
    b.className = 'pag-btn' + (activo ? ' activo' : '') + (elipsis ? ' pag-elipsis' : '');
    b.textContent = txt;
    b.disabled  = disabled || elipsis;
    if (!disabled && !activo && !elipsis) b.addEventListener('click', () => irA(pag));
    return b;
  };

  const ini = Math.max(2, paginaActual - DELTA);
  const fin = Math.min(totalPags - 1, paginaActual + DELTA);

  cont.appendChild(mk('←', paginaActual - 1, paginaActual === 1));
  cont.appendChild(mk(1, 1, false, paginaActual === 1));
  if (ini > 2)             cont.appendChild(mk('…', 0, false, false, true));
  for (let i = ini; i <= fin; i++) cont.appendChild(mk(i, i, false, i === paginaActual));
  if (fin < totalPags - 1) cont.appendChild(mk('…', 0, false, false, true));
  if (totalPags > 1)       cont.appendChild(mk(totalPags, totalPags, false, paginaActual === totalPags));
  cont.appendChild(mk('→', paginaActual + 1, paginaActual === totalPags));
}

// ── Modal ──────────────────────────────────────────────────
function abrirModal(prod) {
  productoModal = prod;
  const v       = VENDEDORES[String(prod.vendedor_id)] || {};
  const color   = colorVend(prod.vendedor_id);
  const fotoV   = v.perfil || '';

  document.getElementById('modal-img').src               = resolverImg(prod.imagen);
  document.getElementById('modal-img').alt               = prod.nombre;
  document.getElementById('modal-categoria').textContent = nomCat(prod.categoria_id);
  document.getElementById('modal-nombre').textContent    = prod.nombre;
  document.getElementById('modal-precio').textContent    = formatoPrecio(prod.valor);
  document.getElementById('modal-precio').style.color    = color;
  document.getElementById('modal-desc').textContent      = prod.descripcion || '';
  document.getElementById('modal-beneficios').innerHTML  =
    (prod.beneficios || []).map(b => `<li>${b}</li>`).join('');

  const seccionConsumo = document.getElementById('modal-consumo-seccion');
  const textoConsumo   = document.getElementById('modal-consumo-texto');
  if (prod.recomendacion) {
    textoConsumo.textContent     = prod.recomendacion;
    seccionConsumo.style.display = 'block';
  } else {
    textoConsumo.textContent     = '';
    seccionConsumo.style.display = 'none';
  }

  // Bloque vendedor
  let bloque = document.getElementById('modal-vendedor-bloque');
  if (!bloque) {
    bloque    = document.createElement('div');
    bloque.id = 'modal-vendedor-bloque';
    document.getElementById('modal-precio').insertAdjacentElement('afterend', bloque);
  }
  if (v.nombre) {
    bloque.innerHTML = `
  <a href="${urlTienda(prod.vendedor_id)}" class="mvb-wrap"
     style="--vcolor:${color}; text-decoration:none;"
     title="Ver todos los productos de ${v.nombre}">
    <div class="mvb-left">
      ${fotoV
        ? `<img class="mvb-avatar" src="${resolverImg(fotoV)}" alt="${v.nombre}"
               onerror="this.style.display='none'">`
        : `<div class="mvb-avatar mvb-inicial" style="background:${color}">${v.nombre[0].toUpperCase()}</div>`
      }
      <div class="mvb-info">
        <span class="mvb-tienda-label">Vendedor</span>
        <span class="mvb-nombre">${v.nombre}</span>
        ${v.ciudad ? `<div class="mvb-ciudad">📍 ${v.ciudad}</div>` : ''}
      </div>
    </div>
    <span class="mvb-btn">Ver tienda →</span>
  </a>`;
    bloque.style.display = 'block';
  } else {
    bloque.style.display = 'none';
  }

  actualizarBtnSeleccionModal();
  document.getElementById('btn-whatsapp-modal').onclick  = () => enviarWhatsappProducto(prod);
  document.getElementById('btn-compartir-modal').onclick = () => compartirProducto(prod);
  document.getElementById('overlay').classList.add('activo');
  document.body.style.overflow = 'hidden';

  const u = new URL(window.location.href);
  u.searchParams.set('p', encodeId(prod.id));
  history.replaceState(null, '', u);
}

function cerrarModal() {
  document.getElementById('overlay').classList.remove('activo');
  document.body.style.overflow = '';
  productoModal = null;
  const u = new URL(window.location.href);
  u.searchParams.delete('p');
  history.replaceState(null, '', u);
}

// ── Abrir producto por URL ?p=ID ──────────────────────────
async function abrirProductoPorUrl(enc) {
  try {
    const id = decodeId(enc);
    if (!id) return;

    // 1. Buscar en caché local
    let prod = null;
    for (const pag of Object.values(cachePaginas)) {
      prod = pag.find(p => String(p.id) === String(id));
      if (prod) break;
    }
    if (!prod && _cacheTodos)
      prod = _cacheTodos.find(p => String(p.id) === String(id));

    // 2. Si no está en caché → pedir al servidor
    if (!prod) {
      prod = await obtenerProductoPorId(id);
    }

    if (prod) setTimeout(() => abrirModal(prod), 350);
    else console.warn('Producto no encontrado:', id);
  } catch (e) {
    console.error('Error al abrir producto por URL:', e);
  }
}

function actualizarBtnSeleccionModal() {
  if (!productoModal) return;
  const btn = document.getElementById('btn-seleccionar-modal');
  const sel = seleccionados.has(String(productoModal.id));
  btn.textContent = sel ? '✓ Seleccionado' : '🛒 Añadir';
  btn.className   = 'btn-seleccionar-modal' + (sel ? ' activo' : '');
}

// ── Selección ──────────────────────────────────────────────
function toggleSeleccion(id, prod) {
  id = String(id);
  if (seleccionados.has(id)) {
    seleccionados.delete(id);
  } else {
    // Buscar producto en caché si no viene como argumento
    const p = prod
      || (cachePaginas[`${paginaActual}|${categoriaActiva}|${normalizar(busquedaActiva)}`] || []).find(x => String(x.id) === id)
      || (_cacheTodos || []).find(x => String(x.id) === id);
    if (p) seleccionados.set(id, { prod: p, cantidad: 1 });
  }
  guardarCarrito();
  actualizarTarjetaSeleccion(id);
  actualizarPanelInferior();
  actualizarCartBtn();
  if (carritoAbierto) renderCarrito();
  if (productoModal && String(productoModal.id) === id) actualizarBtnSeleccionModal();
}

function cambiarCantidad(id, delta) {
  id = String(id);
  if (!seleccionados.has(id)) return;
  const item  = seleccionados.get(id);
  const nueva = item.cantidad + delta;
  if (nueva <= 0) { eliminarDelCarrito(id); return; }
  item.cantidad = nueva;
  guardarCarrito();
  actualizarPanelInferior();
  actualizarCartBtn();
  renderCarrito();
}

function eliminarDelCarrito(id) {
  id = String(id);
  seleccionados.delete(id);
  guardarCarrito();
  actualizarTarjetaSeleccion(id);
  actualizarPanelInferior();
  actualizarCartBtn();
  if (productoModal && String(productoModal.id) === id) actualizarBtnSeleccionModal();
  if (!seleccionados.size) { cerrarCarrito(); return; }
  renderCarrito();
}

function actualizarTarjetaSeleccion(id) {
  id = String(id);
  const t = document.querySelector(`.tarjeta[data-id='${id}']`);
  if (!t) return;
  const check = t.querySelector('.tarjeta-check');
  if (seleccionados.has(id)) {
    t.classList.add('seleccionada'); check.textContent = '✓';
  } else {
    t.classList.remove('seleccionada'); check.textContent = '';
  }
}

function actualizarCartBtn() {
  const btn   = document.getElementById('cart-btn');
  const count = document.getElementById('cart-count');
  const total = [...seleccionados.values()].reduce((a, { cantidad }) => a + cantidad, 0);
  count.textContent = total;
  btn.style.display = seleccionados.size > 0 ? 'flex' : 'none';
}

function actualizarPanelInferior() {
  const panel = document.getElementById('panel-seleccion');
  const info  = document.getElementById('panel-info-texto');
  const total = [...seleccionados.values()].reduce((a, { cantidad }) => a + cantidad, 0);
  if (!seleccionados.size) { panel.classList.remove('visible'); return; }
  panel.classList.add('visible');
  info.innerHTML =
    `<strong>${total}</strong> unidad${total > 1 ? 'es' : ''} seleccionada${total > 1 ? 's' : ''}`;
}

// Limpiar selección Y borrar del localStorage
function limpiarSeleccion() {
  const ids = [...seleccionados.keys()];
  seleccionados.clear();
  limpiarCarritoStorage();
  ids.forEach(actualizarTarjetaSeleccion);
  actualizarPanelInferior();
  actualizarCartBtn();
  if (productoModal) actualizarBtnSeleccionModal();
  cerrarCarrito();
}

// ── Carrito ────────────────────────────────────────────────
function abrirCarrito() {
  carritoAbierto = true;
  renderCarrito();
  document.getElementById('carrito-overlay').classList.add('activo');
  document.getElementById('carrito-panel').classList.add('activo');
  document.body.style.overflow = 'hidden';
}
function cerrarCarrito() {
  carritoAbierto = false;
  document.getElementById('carrito-overlay').classList.remove('activo');
  document.getElementById('carrito-panel').classList.remove('activo');
  document.body.style.overflow = '';
}
function renderCarrito() {
  const items = [...seleccionados.values()];
  const total = items.reduce((a, { prod, cantidad }) => a + prod.valor * cantidad, 0);
  const lista = document.getElementById('carrito-lista');

  lista.innerHTML = items.map(({ prod, cantidad }) => `
    <div class="carrito-item" style="border-bottom:3px solid ${colorVend(prod.vendedor_id)}">
      <img class="carrito-item-img" src="${resolverImg(prod.imagen)}" alt="${prod.nombre}"
           onerror="this.src='https://placehold.co/80x80/e8f5ee/1a6b3c?text=Img'">
      <div class="carrito-item-info">
        <span class="carrito-item-nombre">${prod.nombre}</span>
        <span class="carrito-item-cat">${nomCat(prod.categoria_id)}</span>
        <span class="carrito-item-precio">${formatoPrecio(prod.valor * cantidad)}</span>
      </div>
      <div class="carrito-item-cantidad">
        <button class="qty-btn" data-id="${prod.id}" data-delta="-1">−</button>
        <span class="qty-num">${cantidad}</span>
        <button class="qty-btn" data-id="${prod.id}" data-delta="1">+</button>
      </div>
      <button class="carrito-item-eliminar" data-id="${prod.id}" title="Eliminar">✕</button>
    </div>`).join('');

  lista.querySelectorAll('.carrito-item-eliminar')
       .forEach(b => b.addEventListener('click', () => eliminarDelCarrito(b.dataset.id)));
  lista.querySelectorAll('.qty-btn')
       .forEach(b => b.addEventListener('click', () => cambiarCantidad(b.dataset.id, Number(b.dataset.delta))));
  document.getElementById('carrito-total').textContent = formatoPrecio(total);
}

// ── WhatsApp ───────────────────────────────────────────────
function enviarWhatsappProducto(prod) {
  const numero = waVend(prod.vendedor_id);
  if (!numero) { alert('Este vendedor no tiene WhatsApp registrado.'); return; }
  const img   = resolverImg(prod.imagen);
  const texto =
    '😊 ¡Hola! Me interesa este producto:\n\n' +
    '✨ *' + prod.nombre + '*\n' +
    '💵 Precio: *' + formatoPrecio(prod.valor) + '*\n' +
    (img ? '🖼️ ' + img + '\n\n' : '\n') +
    '¿Está disponible? ¿Hacen envíos? 🙏';
  window.open(buildWaUrl(numero, texto), '_blank');
}

function enviarWhatsappCarrito() {
  if (!seleccionados.size) return;
  const grupos = {};
  [...seleccionados.values()].forEach(({ prod, cantidad }) => {
    const num = waVend(prod.vendedor_id);
    if (!grupos[num]) grupos[num] = [];
    grupos[num].push({ prod, cantidad });
  });
  const entradas = Object.entries(grupos);
  if (entradas.length > 1) {
    const ok = confirm(
      `Este pedido incluye ${entradas.length} vendedores. Se abrirán ${entradas.length} chats. ¿Continuar?`
    );
    if (!ok) return;
  }
  entradas.forEach(([numero, lineas]) => {
    const lista = lineas.map((l, j) =>
      `${j + 1}. *${l.prod.nombre}* x${l.cantidad} — ${formatoPrecio(l.prod.valor * l.cantidad)}`
    ).join('\n');
    const total = lineas.reduce((a, l) => a + l.prod.valor * l.cantidad, 0);
    window.open(buildWaUrl(numero,
      `👋 ¡Hola! Quisiera hacer un pedido:\n\n${lista}\n\n✅ *Total: ${formatoPrecio(total)}*\n\n¿Confirman disponibilidad? 🙏`
    ), '_blank');
  });
  // Limpiar carrito después de enviar el pedido
  setTimeout(() => {
    limpiarSeleccion();
  }, 500);
}

// ── Compartir ──────────────────────────────────────────────
function compartirProducto(prod) {
  const u = new URL(window.location.href);
  u.searchParams.set('p', encodeId(prod.id));
  const enlace = u.toString();
  const texto  = `🌿 ¡Mira este producto!\n*${prod.nombre}*\n💵 ${formatoPrecio(prod.valor)}`;

  if (navigator.share) {
    navigator.share({ title: prod.nombre, text: texto, url: enlace }).catch(() => {});
    return;
  }
  _mostrarMenuCompartir(enlace, texto);
}

function _mostrarMenuCompartir(enlace, texto) {
  document.getElementById('gi-share-menu')?.remove();

  const waTexto = encodeURIComponent(`${texto}\n👇 ${enlace}`);
  const tgUrl   = encodeURIComponent(enlace);
  const tgTxt   = encodeURIComponent(texto);

  const menu = document.createElement('div');
  menu.id    = 'gi-share-menu';
  menu.innerHTML = `
    <div class="gsm-backdrop"></div>
    <div class="gsm-box">
      <p class="gsm-titulo">Compartir producto</p>
      <a class="gsm-opcion gsm-wa"
         href="https://web.whatsapp.com/send?text=${waTexto}"
         target="_blank" rel="noopener">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
          <path d="M12 0C5.373 0 0 5.373 0 12c0 2.117.549 4.107 1.51 5.833L.057 23.571a.75.75 0 00.92.92l5.738-1.453A11.944 11.944 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22a10 10 0 01-5.17-1.445l-.37-.22-3.828.97.985-3.735-.241-.386A10 10 0 1112 22z"/>
        </svg>
        WhatsApp Web
      </a>
      <a class="gsm-opcion gsm-tg"
         href="https://t.me/share/url?url=${tgUrl}&text=${tgTxt}"
         target="_blank" rel="noopener">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.562 8.248-1.97 9.289c-.145.658-.537.818-1.084.508l-3-2.21-1.447 1.394c-.16.16-.295.295-.605.295l.213-3.053 5.56-5.023c.242-.213-.054-.333-.373-.12L7.26 14.4l-2.95-.924c-.64-.203-.654-.64.136-.948l11.527-4.443c.537-.194 1.006.131.59.163z"/>
        </svg>
        Telegram
      </a>
      <button class="gsm-opcion gsm-copy" id="gsm-copy-btn">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <rect x="9" y="9" width="13" height="13" rx="2"/>
          <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/>
        </svg>
        Copiar enlace
      </button>
    </div>`;

  document.body.appendChild(menu);
  menu.querySelector('.gsm-backdrop').addEventListener('click', () => menu.remove());
  menu.querySelector('#gsm-copy-btn').addEventListener('click', () => {
    navigator.clipboard.writeText(enlace).then(() => {
      const btn = menu.querySelector('#gsm-copy-btn');
      btn.innerHTML        = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg> ¡Enlace copiado!`;
      btn.style.background = '#1a6b3c';
      btn.style.color      = '#fff';
      setTimeout(() => menu.remove(), 1500);
    }).catch(() => { prompt('Copia este enlace:', enlace); });
  });
  const onKey = e => {
    if (e.key === 'Escape') { menu.remove(); document.removeEventListener('keydown', onKey); }
  };
  document.addEventListener('keydown', onKey);
}

// ── DOMContentLoaded ───────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  const inputBusqueda = document.getElementById('busqueda-input');
  const btnLimpiar    = document.getElementById('busqueda-limpiar');

  if (inputBusqueda) {
    let timer;
    inputBusqueda.addEventListener('input', () => {
      clearTimeout(timer);
      timer = setTimeout(async () => {
        busquedaActiva = inputBusqueda.value;
        btnLimpiar.style.display = busquedaActiva ? 'flex' : 'none';
        paginaActual = 1;
        resetCache();
        await renderCatalogo();
      }, 350);
    });
    btnLimpiar.addEventListener('click', async () => {
      busquedaActiva          = '';
      inputBusqueda.value     = '';
      btnLimpiar.style.display = 'none';
      paginaActual = 1;
      resetCache();
      await renderCatalogo();
      inputBusqueda.focus();
    });
  }

  document.getElementById('overlay')
          .addEventListener('click', e => { if (e.target.id === 'overlay') cerrarModal(); });
  document.getElementById('btn-cerrar-modal')?.addEventListener('click', cerrarModal);

  // Exponer para banner-pub.js
  window._abrirModalProducto = abrirModal;

  document.getElementById('btn-seleccionar-modal')
          .addEventListener('click', () => { if (productoModal) toggleSeleccion(String(productoModal.id), productoModal); });
  document.getElementById('btn-limpiar')?.addEventListener('click', limpiarSeleccion);
  document.getElementById('btn-whatsapp-panel')?.addEventListener('click', abrirCarrito);
  document.getElementById('cart-btn')?.addEventListener('click', abrirCarrito);
  document.getElementById('carrito-overlay')?.addEventListener('click', cerrarCarrito);
  document.getElementById('btn-cerrar-carrito')?.addEventListener('click', cerrarCarrito);
  document.getElementById('btn-carrito-limpiar')?.addEventListener('click', limpiarSeleccion);
  document.getElementById('btn-carrito-whatsapp')?.addEventListener('click', enviarWhatsappCarrito);

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') carritoAbierto ? cerrarCarrito() : cerrarModal();
  });

  actualizarCartBtn();
  actualizarPanelInferior();
  iniciar();
});