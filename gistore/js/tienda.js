// ============================================================
//  gistore/js/tienda.js — Tienda individual (page/tienda.html)
//  Sin Firebase. Usa api.js (GET + token HMAC).
// ============================================================
import {
  obtenerVendedor,
  obtenerProductosDeVendedor,
  obtenerCategorias,
} from './api.js';

//complementos
let _token = null;
async function getToken() {
  if (_token) return _token;
  try {
    const resp = await fetch('../backend/tokens.php?accion=obtener', { credentials: 'include' });
    const data = await resp.json();
    _token = data.token || '';
  } catch { _token = ''; }
  return _token;
}
async function apiPost(accion, campos) {
  const token = await getToken();
  const body  = new URLSearchParams({ accion, token, ...campos });
  const resp  = await fetch('../php/count.php', {
    method: 'POST',
    credentials: 'include',
    body
  });
  return resp.json();
}

//cuentas las veces que se abre un modal para ver la descripción del producto
async function contadorAprtura(prod, store){
try {
    const json = await apiPost('actualizar', {
      prod, store
    });

     if (!json.ok) throw new Error(json.error);
}catch (e){
console.error(e);
}
}

//cuenta la veces que se comparte un producto
async function contadorCompartidas(prod, store){
try {
    const json = await apiPost('compartir', {
      prod, store
    });

     if (!json.ok) throw new Error(json.error);
}catch (e){
console.error(e);
}
}
//=====================

// ── Utilidades ─────────────────────────────────────────────
const POR_PAGINA = 20;

function fmt(v)      { return '$ ' + Number(v).toLocaleString('es-CO'); }
function nor(t)      { return (t || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, ''); }
function waUrl(n, t) { return 'https://wa.me/' + n + '?text=' + encodeURIComponent(t); }
function encId(id)   { return btoa(String(id)).replace(/=/g, ''); }
function decId(s) {
  const p = s.length % 4 ? '='.repeat(4 - s.length % 4) : '';
  try { return atob(s + p); } catch { return null; }
}
function resolveImg(url) {
  if (!url) return '';
  if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('data:')) return url;
  url = url.replace(/\\/g, '/').replace(/^[A-Za-z]:\/.*?\/gistore\//, '').replace(/^\//, '');
  const isGH   = window.location.hostname.includes('github.io');
  const base   = isGH ? '/gistore' : '';
  return window.location.origin + base + '/' + url;
}

// ── Leer ?v= de la URL ─────────────────────────────────────
const params    = new URLSearchParams(window.location.search);
const vEncoded  = params.get('v');
const VENDEDOR_ID = vEncoded ? decId(vEncoded) : null;

// ── Carrito compartido con app.js (misma clave localStorage) ─
const CARRITO_KEY = 'gistore_carrito';

function cargarCarrito() {
  try {
    const raw = localStorage.getItem(CARRITO_KEY);
    if (!raw) return new Map();
    // Normalizar todas las claves a string para consistencia con app.js
    const parsed = JSON.parse(raw);
    return new Map(parsed.map(([k, v]) => [String(k), v]));
  } catch { return new Map(); }
}
function guardarCarrito() {
  try {
    localStorage.setItem(CARRITO_KEY, JSON.stringify([...seleccionados.entries()]));
  } catch { /* cuota llena */ }
}
function limpiarCarritoStorage() {
  localStorage.removeItem(CARRITO_KEY);
}

// ── Estado ─────────────────────────────────────────────────
let VENDEDOR        = null;
let CATEGORIAS_MAP  = {};   // { id → nombre }
let categoriaActiva = '';
let busquedaActiva  = '';
let paginaActual    = 1;
let totalProductos  = 0;
let cachePaginas    = {};
let _cacheTodos     = null; // productos del vendedor (cache maestro)

let seleccionados   = cargarCarrito();  // ← persiste entre páginas
let productoModal   = null;
let carritoAbierto  = false;

// ── Helpers de vendedor ────────────────────────────────────
function colorV()   { return VENDEDOR?.color    || '#1a6b3c'; }
function waNum()    { return VENDEDOR?.whatsapp  || ''; }
function nomCat(id) { return CATEGORIAS_MAP[String(id)] || ''; }

function resetCache() {
  cachePaginas = {};
  // _cacheTodos se conserva: es el universo del vendedor
}

// ── Cache maestro de productos del vendedor ────────────────
async function _getTodosActivos() {
  if (_cacheTodos) return _cacheTodos;

  const datos = await obtenerProductosDeVendedor(VENDEDOR_ID);
  const docs  = (datos || []).sort((a, b) => nor(a.nombre).localeCompare(nor(b.nombre)));
  _cacheTodos           = docs;
  window._cacheTodos    = docs;
  window._categoriasMap = CATEGORIAS_MAP;
  return docs;
}

// ── Fetch paginado ─────────────────────────────────────────
async function fetchPagina(pag) {
  const clave = `${pag}|${categoriaActiva}|${nor(busquedaActiva)}`;
  if (cachePaginas[clave]) return cachePaginas[clave];

  try {
    let todos = await _getTodosActivos();

    if (categoriaActiva)
      todos = todos.filter(p => String(p.categoria_id) === String(categoriaActiva));

    if (busquedaActiva.trim()) {
      const termN = nor(busquedaActiva);
      todos = todos.filter(p =>
        nor(p.nombre).includes(termN) ||
        nor(p.descripcion || '').includes(termN)
      );
    }

    totalProductos = todos.length;
    const inicio   = (pag - 1) * POR_PAGINA;
    const resultado = todos.slice(inicio, inicio + POR_PAGINA);
    cachePaginas[clave] = resultado;
    return resultado;
  } catch (e) {
    console.error('fetchPagina tienda:', e);
    return [];
  }
}

// ── Spinner ────────────────────────────────────────────────
function setCargando(si) {
  let el = document.getElementById('cargando-productos');
  if (!el) {
    el           = document.createElement('p');
    el.id        = 'cargando-productos';
    el.className = 'resultados-info';
    document.getElementById('grilla').before(el);
  }
  el.textContent   = '⏳ Cargando productos…';
  el.style.display = si ? 'block' : 'none';
}

// ── Hero de la tienda ──────────────────────────────────────
function renderHero(totalProds) {
  const v    = VENDEDOR;
  const foto = v.perfil || v.foto || '';
  const clr  = v.color  || '#1a6b3c';
  const desc = v.descripcion || '';

  // Redes sociales
  const _redes = v.redes ? (typeof v.redes === 'string' ? JSON.parse(v.redes) : v.redes) : {};
  const _redLinks = [
    { url: _redes.facebook,  color: '#1877F2', label: 'Facebook',
      svg: `<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M24 12.073C24 5.404 18.627 0 12 0S0 5.404 0 12.073C0 18.1 4.388 23.094 10.125 24v-8.437H7.078v-3.49h3.047V9.41c0-3.025 1.792-4.697 4.533-4.697 1.312 0 2.686.235 2.686.235v2.97h-1.514c-1.491 0-1.956.93-1.956 1.884v2.25h3.328l-.532 3.49h-2.796V24C19.612 23.094 24 18.1 24 12.073z"/></svg>` },
    { url: _redes.tiktok,    color: '#010101', label: 'TikTok',
      svg: `<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1V9.01a6.3 6.3 0 00-.79-.05 6.34 6.34 0 00-6.34 6.34 6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.33-6.34V8.75a8.16 8.16 0 004.77 1.52V6.82a4.85 4.85 0 01-1-.13z"/></svg>` },
    { url: _redes.instagram, color: '#E1306C', label: 'Instagram',
      svg: `<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/></svg>` },
    { url: _redes.youtube,   color: '#FF0000', label: 'YouTube',
      svg: `<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M23.495 6.205a3.007 3.007 0 00-2.088-2.088c-1.87-.501-9.396-.501-9.396-.501s-7.507-.01-9.396.501A3.007 3.007 0 00.527 6.205a31.247 31.247 0 00-.522 5.805 31.247 31.247 0 00.522 5.783 3.007 3.007 0 002.088 2.088c1.868.502 9.396.502 9.396.502s7.506 0 9.396-.502a3.007 3.007 0 002.088-2.088 31.247 31.247 0 00.5-5.783 31.247 31.247 0 00-.5-5.805zM9.609 15.601V8.408l6.264 3.602z"/></svg>` },
  ].filter(r => r.url);

  const redesHtml = _redLinks.length
    ? `<div class="tienda-redes" role="list" aria-label="Redes sociales">
        ${_redLinks.map(r =>
          `<a href="${r.url}" class="tienda-red-btn" target="_blank" rel="noopener noreferrer"
              aria-label="${r.label}" title="${r.label}" style="--red-color:${r.color}">${r.svg}</a>`
        ).join('')}
       </div>`
    : '';

  document.title = (v.nombre || 'Tienda') + ' · GI Store';

  document.getElementById('tienda-hero-wrap').innerHTML = `
    <section class="tienda-hero">
      <div class="tienda-hero-inner">
        ${foto
          ? `<img class="tienda-avatar" src="${resolveImg(foto)}" alt="${v.nombre}"
               onerror="this.style.display='none'">`
          : `<div class="tienda-avatar-inicial" style="background:${clr}">${(v.nombre || 'T')[0].toUpperCase()}</div>`
        }
        <div class="tienda-info">
          <div class="tienda-nombre">${v.nombre || 'Tienda'}</div>
          ${desc ? `<div class="tienda-descripcion" style="padding:.5rem">${desc}</div>` : ''}
          ${v.ciudad ? `<div class="tienda-ciudad">📍 ${v.ciudad}</div>` : ''}
          <div class="tienda-stats">
            <span class="tienda-stat">🛍️ ${totalProds.toLocaleString('es-CO')} producto${totalProds !== 1 ? 's' : ''} disponibles</span>
          </div>
          ${redesHtml}
          <div class="tienda-botones">
            ${v.whatsapp ? `
            <a href="https://wa.me/${v.whatsapp}?text=${encodeURIComponent('👋 Hola! Vi tu tienda en GI Store y me gustaría consultar sobre tus productos.')}"
               class="btn-wa-tienda" target="_blank" rel="noopener">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
                <path d="M12 0C5.373 0 0 5.373 0 12c0 2.117.549 4.107 1.51 5.833L.057 23.571a.75.75 0 00.92.92l5.738-1.453A11.944 11.944 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22a10 10 0 01-5.17-1.445l-.37-.22-3.828.97.985-3.735-.241-.386A10 10 0 1112 22z"/>
              </svg>
              Contactar por WhatsApp
            </a>` : ''}
            ${v.url_web ? `
            <a href="${v.url_web}" class="btn-web-tienda" target="_blank" rel="noopener noreferrer">
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="12" cy="12" r="10"/>
                <line x1="2" y1="12" x2="22" y2="12"/>
                <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
              </svg>
              Visitar página web
            </a>` : ''}
          </div>
        </div>
      </div>
    </section>`;

  document.getElementById('breadcrumb').innerHTML =
    `<a href="../index.html">← Volver al catálogo general</a>`;
}

// ── Filtros de categoría ───────────────────────────────────
function renderFiltros(cats) {
  const cont = document.getElementById('filtros');
  cont.innerHTML = '';
  if (!cats.length) return;

  const mk = (texto, id) => {
    const b       = document.createElement('button');
    b.className   = 'filtro-btn' + (categoriaActiva === id ? ' activo' : '');
    b.textContent = texto;
    b.addEventListener('click', async () => {
      if (categoriaActiva === id) return;
      categoriaActiva = id;
      paginaActual    = 1;
      resetCache();
      renderFiltros(cats);
      await renderCatalogo();
    });
    cont.appendChild(b);
  };
  mk('Todos', '');
  cats.forEach(([id, nom]) => mk(nom, id));
}

// ── Catálogo ───────────────────────────────────────────────
async function renderCatalogo() {
  const grilla = document.getElementById('grilla');
  const infoEl = document.getElementById('resultados-info');
  grilla.innerHTML = '';
  setCargando(true);

  const pagina    = await fetchPagina(paginaActual);
  setCargando(false);

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
      `${total.toLocaleString('es-CO')} productos · mostrando ${desde}–${hasta} · página ${paginaActual} de ${totalPags}`;
  } else {
    infoEl.textContent = 'Sin resultados';
  }

  if (!pagina.length) {
    grilla.innerHTML = `
      <div class="sin-resultados"><div class="icono">🔍</div>
        <p>${busquedaActiva.trim()
          ? 'No encontramos ese producto. Intenta con otro término.'
          : 'No hay productos' + (categoriaActiva ? ' en esta categoría' : '') + '.'
        }</p>
      </div>`;
  } else {
    pagina.forEach(p => grilla.appendChild(crearTarjeta(p)));
  }
  renderPaginado(total);
}

// ── Tarjeta ────────────────────────────────────────────────
function crearTarjeta(prod) {
  const sid = String(prod.id);
  const sel = seleccionados.has(sid);
  // Usar color del vendedor propio del producto (puede venir de otra tienda en carrito compartido)
  const clr = (String(prod.vendedor_id) === String(VENDEDOR?.id))
    ? colorV()
    : (prod.vendedor_color || colorV());
  const div = document.createElement('div');
  div.className  = 'tarjeta' + (sel ? ' seleccionada' : '');
  div.dataset.id = sid;
  div.innerHTML  = `
    <div class="tarjeta-check">${sel ? '✓' : ''}</div>
    <div class="tarjeta-img-wrap">
      <img src="${resolveImg(prod.imagen)}" alt="${prod.nombre}" loading="lazy"
           onerror="this.src='https://placehold.co/400x300/e8f5ee/1a6b3c?text=Imagen'">
      <span class="tarjeta-categoria-badge">${nomCat(prod.categoria_id)}</span>
    </div>
    <div class="tarjeta-body">
      <div class="tarjeta-nombre">${prod.nombre}</div>
      <div class="tarjeta-beneficio-top">${(prod.beneficios || [])[0] || ''}</div>
      <div class="tarjeta-footer">
        <span class="tarjeta-precio" style="color:${clr}">${fmt(prod.valor)}</span>
        <button class="btn-ver">Ver más</button>
      </div>
    </div>`;

  div.querySelector('.tarjeta-img-wrap')
     .addEventListener('click', e => { e.stopPropagation(); abrirModal(prod); });
  div.querySelector('.btn-ver')
     .addEventListener('click', e => { e.stopPropagation(); abrirModal(prod); });
  div.addEventListener('click', e => {
    if (!e.target.closest('.tarjeta-img-wrap') && !e.target.classList.contains('btn-ver'))
      toggleSel(sid);
  });
  return div;
}

// ── Paginador ──────────────────────────────────────────────
function renderPaginado(totalItems) {
  const cont      = document.getElementById('paginado');
  cont.innerHTML  = '';
  const totalPags = Math.max(1, Math.ceil(totalItems / POR_PAGINA));
  if (totalPags <= 1) return;

  const DELTA = window.innerWidth < 500 ? 1 : 2;
  async function irA(p) {
    paginaActual = p;
    await renderCatalogo();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
  const mk = (txt, p, dis = false, act = false, eli = false) => {
    const b       = document.createElement('button');
    b.className   = 'pag-btn' + (act ? ' activo' : '') + (eli ? ' pag-elipsis' : '');
    b.textContent = txt;
    b.disabled    = dis || eli;
    if (!dis && !act && !eli) b.addEventListener('click', () => irA(p));
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

  contadorAprtura(prod.id, prod.vendedor_id);
  // Usar color del vendedor dueño del producto
  const clr = (String(prod.vendedor_id) === String(VENDEDOR?.id))
    ? colorV()
    : (prod.vendedor_color || colorV());

  document.getElementById('modal-img').src               = resolveImg(prod.imagen);
  document.getElementById('modal-img').alt               = prod.nombre;
  document.getElementById('modal-categoria').textContent = nomCat(prod.categoria_id);
  document.getElementById('modal-nombre').textContent    = prod.nombre;
  document.getElementById('modal-precio').textContent    = fmt(prod.valor);
  document.getElementById('modal-precio').style.color    = clr;
  document.getElementById('modal-desc').textContent      = prod.descripcion || '';
  document.getElementById('modal-beneficios').innerHTML  =
    (prod.beneficios || []).map(b => `<li>${b}</li>`).join('');

  const sc = document.getElementById('modal-consumo-seccion');
  const ct = document.getElementById('modal-consumo-texto');
  if (prod.recomendacion) {
    ct.textContent     = prod.recomendacion;
    sc.style.display   = 'block';
  } else {
    ct.textContent     = '';
    sc.style.display   = 'none';
  }

  actualizarBtnSel();
  document.getElementById('btn-whatsapp-modal').onclick  = () => enviarWaProducto(prod);
  document.getElementById('btn-compartir-modal').onclick = () => compartir(prod);
  document.getElementById('overlay').classList.add('activo');
  document.body.style.overflow = 'hidden';

  const u = new URL(window.location.href);
  u.searchParams.set('p', encId(prod.id));
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

function actualizarBtnSel() {
  if (!productoModal) return;
  const btn = document.getElementById('btn-seleccionar-modal');
  const sel = seleccionados.has(String(productoModal.id));
  btn.textContent = sel ? '✓ Seleccionado' : '🛒 Añadir';
  btn.className   = 'btn-seleccionar-modal' + (sel ? ' activo' : '');
}

// ── Selección / carrito ────────────────────────────────────
function toggleSel(id) {
  const sid = String(id);
  const clave = `${paginaActual}|${categoriaActiva}|${nor(busquedaActiva)}`;
  const pag   = cachePaginas[clave] || [];
  if (seleccionados.has(sid)) {
    seleccionados.delete(sid);
  } else {
    const p = pag.find(x => String(x.id) === sid)
           || (_cacheTodos || []).find(x => String(x.id) === sid);
    if (p) seleccionados.set(sid, { prod: p, cantidad: 1 });
  }
  guardarCarrito();
  actualizarTarjetaSel(sid);
  actualizarPanel();
  actualizarCartBtn();
  if (carritoAbierto) renderCarrito();
  if (productoModal && String(productoModal.id) === sid) actualizarBtnSel();
}

function cambiarCantidad(id, delta) {
  const sid = String(id);
  if (!seleccionados.has(sid)) return;
  const item = seleccionados.get(sid);
  const nv   = item.cantidad + delta;
  if (nv <= 0) { eliminar(sid); return; }
  item.cantidad = nv;
  guardarCarrito();
  actualizarPanel();
  actualizarCartBtn();
  renderCarrito();
}

function eliminar(id) {
  const sid = String(id);
  seleccionados.delete(sid);
  guardarCarrito();
  actualizarTarjetaSel(sid);
  actualizarPanel();
  actualizarCartBtn();
  if (productoModal && String(productoModal.id) === sid) actualizarBtnSel();
  if (!seleccionados.size) { cerrarCarrito(); return; }
  renderCarrito();
}

function actualizarTarjetaSel(id) {
  const sid = String(id);
  const t = document.querySelector(`.tarjeta[data-id='${sid}']`);
  if (!t) return;
  const ch = t.querySelector('.tarjeta-check');
  if (seleccionados.has(sid)) {
    t.classList.add('seleccionada');    ch.textContent = '✓';
  } else {
    t.classList.remove('seleccionada'); ch.textContent = '';
  }
}

function actualizarCartBtn() {
  const btn   = document.getElementById('cart-btn');
  const count = document.getElementById('cart-count');
  const total = [...seleccionados.values()].reduce((a, { cantidad }) => a + cantidad, 0);
  count.textContent = total;
  btn.style.display = seleccionados.size > 0 ? 'flex' : 'none';
}

function actualizarPanel() {
  const panel = document.getElementById('panel-seleccion');
  const info  = document.getElementById('panel-info-texto');
  const total = [...seleccionados.values()].reduce((a, { cantidad }) => a + cantidad, 0);
  if (!seleccionados.size) { panel.classList.remove('visible'); return; }
  panel.classList.add('visible');
  info.innerHTML =
    `<strong>${total}</strong> unidad${total > 1 ? 'es' : ''} seleccionada${total > 1 ? 's' : ''}`;
}

function limpiarSel() {
  const ids = [...seleccionados.keys()];
  seleccionados.clear();
  limpiarCarritoStorage();
  ids.forEach(actualizarTarjetaSel);
  actualizarPanel();
  actualizarCartBtn();
  if (productoModal) actualizarBtnSel();
  cerrarCarrito();
}

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

  lista.innerHTML = items.map(({ prod, cantidad }) => {
    // Usar color del vendedor propio del producto, no el de la tienda actual
    const clr = prod.vendedor_color || colorV();
    const vendNombre = prod.vendedor_nombre || VENDEDOR?.nombre || '';
    return `
    <div class="carrito-item" style="border-bottom:3px solid ${clr}">
      <img class="carrito-item-img" src="${resolveImg(prod.imagen)}" alt="${prod.nombre}"
           onerror="this.src='https://placehold.co/80x80/e8f5ee/1a6b3c?text=Img'">
      <div class="carrito-item-info">
        <span class="carrito-item-nombre">${prod.nombre}</span>
        <span class="carrito-item-cat">${nomCat(prod.categoria_id)}${vendNombre ? ' · ' + vendNombre : ''}</span>
        <span class="carrito-item-precio">${fmt(prod.valor * cantidad)}</span>
      </div>
      <div class="carrito-item-cantidad">
        <button class="qty-btn" data-id="${prod.id}" data-delta="-1">−</button>
        <span class="qty-num">${cantidad}</span>
        <button class="qty-btn" data-id="${prod.id}" data-delta="1">+</button>
      </div>
      <button class="carrito-item-eliminar" data-id="${prod.id}" title="Eliminar">✕</button>
    </div>`;
  }).join('');

  lista.querySelectorAll('.carrito-item-eliminar')
       .forEach(b => b.addEventListener('click', () => eliminar(b.dataset.id)));
  lista.querySelectorAll('.qty-btn')
       .forEach(b => b.addEventListener('click', () => cambiarCantidad(b.dataset.id, Number(b.dataset.delta))));
  document.getElementById('carrito-total').textContent = fmt(total);
}

// ── Detección de popups bloqueados ─────────────────────────
function _popupsHabilitados() {
  let popup = null;

  try {
    popup = window.open('', '_blank', 'width=100,height=100,left=-1000,top=-1000');
  } catch (e) {
    return false;
  }

  // Si no se pudo abrir → bloqueado
  if (!popup || typeof popup.closed === 'undefined' || popup.closed) {
    return false;
  }

  // Intentar interactuar con la ventana (evita falsos positivos)
  try {
    popup.document.write('<html><body>test</body></html>');
    popup.document.close();
  } catch (e) {
    return false;
  }

  // Validar que tenga funciones reales
  if (typeof popup.focus !== 'function') {
    return false;
  }

  // Limpieza
  popup.close();

  return true;
}
function _mostrarAlertaPopups() {
  document.getElementById('gi-popup-alert')?.remove();
  const div = document.createElement('div');
  div.id = 'gi-popup-alert';
  div.innerHTML = `
    <div style="
      position:fixed;inset:0;background:rgba(0,0,0,.6);z-index:9999;
      display:flex;align-items:center;justify-content:center;padding:1rem;">
      <div style="
        background:#fff;border-radius:16px;padding:2rem;max-width:400px;width:100%;
        box-shadow:0 16px 48px rgba(0,0,0,.25);text-align:center;">
        <div style="font-size:2.5rem;margin-bottom:.75rem">🔒</div>
        <h3 style="margin:0 0 .5rem;font-size:1.1rem;color:#111">Ventanas emergentes bloqueadas</h3>
        <p style="margin:0 0 1.25rem;font-size:.92rem;color:#555;line-height:1.6">
          Tu pedido tiene productos de <strong>varios vendedores</strong>. Para enviar
          cada pedido por separado, el navegador necesita abrir varias pestañas.<br><br>
          Busca el ícono 🔒 o ⚠️ en la barra de dirección y selecciona
          <strong>"Permitir ventanas emergentes"</strong>, luego intenta de nuevo.
        </p>
        <button id="gi-popup-alert-cerrar" style="
          background:#1a6b3c;color:#fff;border:none;border-radius:10px;
          padding:.7rem 1.5rem;font-size:.95rem;font-weight:600;cursor:pointer;width:100%">
          Entendido, lo habilitaré
        </button>
      </div>
    </div>`;
  document.body.appendChild(div);
  div.querySelector('#gi-popup-alert-cerrar').addEventListener('click', () => div.remove());
}

function _mostrarConfirmacionVendedores(conWa, onConfirmar) {
  document.getElementById('gi-confirm-pedido')?.remove();
  const div = document.createElement('div');
  div.id = 'gi-confirm-pedido';
  const resumen = conWa.map(([, { nombre, lineas }]) => {
    const total = lineas.reduce((a, l) => a + l.prod.valor * l.cantidad, 0);
    return `<div style="display:flex;justify-content:space-between;padding:.4rem 0;
              border-bottom:1px solid #e5e7eb;font-size:.9rem">
              <span>🏪 ${nombre || 'Vendedor'}</span>
              <span style="font-weight:700;color:#1a6b3c">${fmt(total)}</span>
            </div>`;
  }).join('');
  div.innerHTML = `
    <div style="
      position:fixed;inset:0;background:rgba(0,0,0,.6);z-index:9999;
      display:flex;align-items:center;justify-content:center;padding:1rem;">
      <div style="
        background:#fff;border-radius:16px;padding:2rem;max-width:420px;width:100%;
        box-shadow:0 16px 48px rgba(0,0,0,.25);">
        <div style="font-size:2rem;text-align:center;margin-bottom:.5rem">🛒</div>
        <h3 style="margin:0 0 .25rem;font-size:1.05rem;color:#111;text-align:center">
          Pedido a ${conWa.length} vendedores
        </h3>
        <p style="margin:0 0 1rem;font-size:.85rem;color:#777;text-align:center">
          Se abrirá un chat de WhatsApp por cada vendedor
        </p>
        <div style="margin-bottom:1.25rem">${resumen}</div>
        <div style="display:flex;gap:.6rem">
          <button id="gi-confirm-cancelar" style="
            flex:1;background:#f3f4f6;color:#555;border:none;border-radius:10px;
            padding:.7rem;font-size:.9rem;font-weight:600;cursor:pointer">
            Cancelar
          </button>
          <button id="gi-confirm-ok" style="
            flex:2;background:#25D366;color:#fff;border:none;border-radius:10px;
            padding:.7rem;font-size:.9rem;font-weight:600;cursor:pointer">
            ✓ Enviar pedidos
          </button>
        </div>
      </div>
    </div>`;
  document.body.appendChild(div);
  div.querySelector('#gi-confirm-cancelar').addEventListener('click', () => div.remove());
  div.querySelector('#gi-confirm-ok').addEventListener('click', () => {
    div.remove();
    onConfirmar();
  });
}

function _abrirVentanasWa(conWa, fmtFn, urlFn, onExito) {
  let bloqueados = 0;

  conWa.forEach(([numero, { nombre, lineas }], i) => {
    setTimeout(() => {
      const lista = lineas.map((l, j) =>
        `${j + 1}. *${l.prod.nombre}* x${l.cantidad} — ${fmtFn(l.prod.valor * l.cantidad)}`
      ).join('\n');

      const total = lineas.reduce((a, l) => a + l.prod.valor * l.cantidad, 0);

      const encabezado = nombre
        ? `👋 ¡Hola, ${nombre}! Quisiera hacer un pedido:`
        : '👋 ¡Hola! Quisiera hacer un pedido:';

      const win = window.open(
        urlFn(numero,
          `${encabezado}\n\n${lista}\n\n✅ *Total: ${fmtFn(total)}*\n\n¿Confirman disponibilidad? 🙏`
        ),
        '_blank'
      );

      // 🔴 DETECCIÓN REAL
      if (!win) {
        bloqueados++;
      }

      // Cuando termina el último intento
      if (i === conWa.length - 1) {
        setTimeout(() => {
          if (bloqueados > 0) {
            _mostrarAlertaPopups();
          } else {
            onExito();
          }
        }, 300);
      }

    }, i * 300); // ⬅️ más corto = menos bloqueos
  });
}

// ── WhatsApp ───────────────────────────────────────────────
function enviarWaProducto(prod) {
  const num = (String(prod.vendedor_id) === String(VENDEDOR?.id))
    ? waNum()
    : (prod.vendedor_whatsapp || waNum());
  if (!num) { alert('Este vendedor no tiene WhatsApp registrado.'); return; }
  const img = resolveImg(prod.imagen);
  window.open(waUrl(num,
    `😊 ¡Hola! Me interesa este producto:\n\n✨ *${prod.nombre}*\n💵 Precio: *${fmt(prod.valor)}*\n` +
    (img ? `🖼️ ${img}\n\n` : '\n') +
    '¿Está disponible? ¿Hacen envíos? 🙏'
  ), '_blank');
}

function enviarWaCarrito() {
  if (!seleccionados.size) return;

  const grupos = {};
  [...seleccionados.values()].forEach(({ prod, cantidad }) => {
    const num    = prod.vendedor_whatsapp || waNum();
    const nombre = prod.vendedor_nombre   || VENDEDOR?.nombre || '';
    if (!grupos[num]) grupos[num] = { nombre, lineas: [] };
    grupos[num].lineas.push({ prod, cantidad });
  });

  const entradas = Object.entries(grupos);
  const sinWa = entradas.filter(([num]) => !num);
  if (sinWa.length) {
    const nombres = sinWa.flatMap(([, g]) => g.lineas.map(l => l.prod.nombre)).join(', ');
    alert(`⚠️ Algunos productos no tienen WhatsApp registrado y no se enviarán:\n${nombres}`);
  }

  const conWa = entradas.filter(([num]) => !!num);
  if (!conWa.length) return;

  // Un solo vendedor → abrir directamente
  if (conWa.length === 1) {
    _abrirVentanasWa(conWa, limpiarSel);
    return;
  }

  // Múltiples vendedores:
  // PASO 1 — verificar popups con about:blank
  if (!_popupsHabilitados()) {
    _mostrarAlertaPopups();
    return; // carrito intacto
  }

  // PASO 2 — modal de confirmación con resumen por vendedor
  _mostrarConfirmacionVendedores(conWa, () => {
    // PASO 3 — abrir ventanas y limpiar carrito al final
    _abrirVentanasWa(conWa, limpiarSel);
  });
}

// ── Compartir ──────────────────────────────────────────────
function compartir(prod) {
  const u = new URL(window.location.href);
  u.searchParams.set('p', encId(prod.id));
  const enlace = u.toString();
  const texto  = `🌿 ¡Mira este producto!\n*${prod.nombre}*\n💵 ${fmt(prod.valor)}`;

  if (navigator.share) {
    navigator.share({ title: prod.nombre, text: texto, url: enlace }).catch(() => {});
    return;
  }
  contadorCompartidas(prod.id,prod.vendedor_id);
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
      <a class="gsm-opcion gsm-wa" href="https://web.whatsapp.com/send?text=${waTexto}" target="_blank" rel="noopener">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
          <path d="M12 0C5.373 0 0 5.373 0 12c0 2.117.549 4.107 1.51 5.833L.057 23.571a.75.75 0 00.92.92l5.738-1.453A11.944 11.944 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22a10 10 0 01-5.17-1.445l-.37-.22-3.828.97.985-3.735-.241-.386A10 10 0 1112 22z"/>
        </svg>
        WhatsApp Web
      </a>
      <a class="gsm-opcion gsm-tg" href="https://t.me/share/url?url=${tgUrl}&text=${tgTxt}" target="_blank" rel="noopener">
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
      const btn        = menu.querySelector('#gsm-copy-btn');
      btn.innerHTML    = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg> ¡Enlace copiado!`;
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

// ── Inicio ─────────────────────────────────────────────────
async function iniciar() {
  if (!VENDEDOR_ID) {
    document.getElementById('tienda-hero-wrap').innerHTML =
      `<div class="tienda-error">Tienda no encontrada. <a href="../index.html">Volver al catálogo</a></div>`;
    return;
  }
  setCargando(true);
  try {
    // 1. Cargar vendedor + categorías en paralelo
    const [vendedor, categorias] = await Promise.all([
      obtenerVendedor(VENDEDOR_ID),
      obtenerCategorias(),
    ]);

    if (!vendedor || vendedor.estado !== 'activo') {
      document.getElementById('tienda-hero-wrap').innerHTML =
        `<div class="tienda-error">Esta tienda no está disponible. <a href="../index.html">Volver al catálogo</a></div>`;
      setCargando(false);
      return;
    }

    VENDEDOR = vendedor;
    categorias.forEach(c => { CATEGORIAS_MAP[String(c.id)] = c.nombre; });
    window._categoriasMap = CATEGORIAS_MAP;

    // 2. Cargar productos del vendedor (puebla _cacheTodos)
    await _getTodosActivos();

    // 3. Hero con total real
    renderHero(totalProductos || _cacheTodos.length);

    // 4. Filtros con solo las categorías presentes en esta tienda
    const catsEnTienda = [...new Set(_cacheTodos.map(p => String(p.categoria_id)))]
      .filter(id => id && CATEGORIAS_MAP[id])
      .map(id => [id, CATEGORIAS_MAP[id]]);
    renderFiltros(catsEnTienda);

    // 5. Catálogo
    await renderCatalogo();

    // 6. Exponer función global para el banner de productos
    window._agregarAlCarrito = (prod) => {
      const sid = String(prod.id);
      if (!seleccionados.has(sid)) {
        seleccionados.set(sid, { prod, cantidad: 1 });
        guardarCarrito();
        actualizarPanel();
        actualizarCartBtn();
      }
    };

    // 7. Abrir producto por ?p=
    const enc = new URLSearchParams(window.location.search).get('p');
    if (enc) {
      const id   = decId(enc);
      const prod = _cacheTodos.find(p => String(p.id) === String(id));
      if (prod) setTimeout(() => abrirModal(prod), 350);
    }
  } catch (e) {
    console.error('tienda iniciar:', e);
    document.getElementById('grilla').innerHTML =
      '<div class="sin-resultados"><p>Error al cargar la tienda. Recarga la página.</p></div>';
  } finally {
    setCargando(false);
  }
}

// ── Eventos DOM ────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  const inp = document.getElementById('busqueda-input');
  const lim = document.getElementById('busqueda-limpiar');

  if (inp) {
    let t;
    inp.addEventListener('input', () => {
      clearTimeout(t);
      t = setTimeout(async () => {
        busquedaActiva           = inp.value;
        lim.style.display        = busquedaActiva ? 'flex' : 'none';
        paginaActual             = 1;
        resetCache();
        await renderCatalogo();
      }, 350);
    });
    lim.addEventListener('click', async () => {
      busquedaActiva    = '';
      inp.value         = '';
      lim.style.display = 'none';
      paginaActual      = 1;
      resetCache();
      await renderCatalogo();
      inp.focus();
    });
  }

  document.getElementById('overlay')
          .addEventListener('click', e => { if (e.target.id === 'overlay') cerrarModal(); });
  document.getElementById('btn-cerrar-modal')?.addEventListener('click', cerrarModal);
  document.getElementById('btn-seleccionar-modal')
          .addEventListener('click', () => { if (productoModal) toggleSel(productoModal.id); });
  document.getElementById('btn-limpiar')?.addEventListener('click', limpiarSel);
  document.getElementById('btn-whatsapp-panel')?.addEventListener('click', abrirCarrito);
  document.getElementById('cart-btn')?.addEventListener('click', abrirCarrito);
  document.getElementById('carrito-overlay')?.addEventListener('click', cerrarCarrito);
  document.getElementById('btn-cerrar-carrito')?.addEventListener('click', cerrarCarrito);
  document.getElementById('btn-carrito-limpiar')?.addEventListener('click', limpiarSel);
  document.getElementById('btn-carrito-whatsapp')?.addEventListener('click', enviarWaCarrito);
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') carritoAbierto ? cerrarCarrito() : cerrarModal();
  });

  actualizarCartBtn();
  iniciar();
});