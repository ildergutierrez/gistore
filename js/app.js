// ============================================================
//  app.js  —  GI Store · Catálogo público
//  ─────────────────────────────────────────────────────────
//  NOVEDADES v3
//  1. Carga paginada desde Firestore (no descarga todo de golpe).
//     Se traen solo los 20 productos de la página actual usando
//     limit() + startAfter(cursor).  Para construir el paginador
//     sin descargar nada extra se usa getCountFromServer().
//  2. Paginador inteligente:  ← 1 2 3 … 8 … 15 →
//  3. Tarjeta: nombre del vendedor + ubicación debajo del precio.
//  4. Modal:   bloque vendedor (foto/iniciales, nombre, ciudad)
//              con enlace directo a page/tienda.html
//  5. Al hacer clic en el nombre/chip del vendedor → tienda.html
// ============================================================
import { initializeApp }
  from "https://www.gstatic.com/firebasejs/12.10.0/firebase-app.js";
import {
  getFirestore, collection, getDocs, getCountFromServer,
  query, where, orderBy, limit, startAfter
} from "https://www.gstatic.com/firebasejs/12.10.0/firebase-firestore.js";

// ── Firebase ───────────────────────────────────────────────
const _app = initializeApp({
  apiKey:            "AIzaSyBviMH3re9aHjiLb5p-5hSjXd4gAchTvgI",
  authDomain:        "gi-store-5a5eb.firebaseapp.com",
  projectId:         "gi-store-5a5eb",
  storageBucket:     "gi-store-5a5eb.firebasestorage.app",
  messagingSenderId: "157652441199",
  appId:             "1:157652441199:web:c42285a80f117f79cc159a"
});
const _db = getFirestore(_app);

// ── Utilidades ─────────────────────────────────────────────
const POR_PAGINA = 20;

function formatoPrecio(v) {
  return "$ " + Number(v).toLocaleString("es-CO");
}
function normalizar(t) {
  return (t || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}
function buildWaUrl(n, t) {
  return "https://wa.me/" + n + "?text=" + encodeURIComponent(t);
}
function encodeId(id)  { return btoa(String(id)).replace(/=/g, ""); }
function decodeId(str) {
  const pad = str.length % 4 ? "=".repeat(4 - str.length % 4) : "";
  try { return atob(str + pad); } catch { return null; }
}
function resolverImg(url) {
  if (!url) return "";
  if (url.startsWith("http://") || url.startsWith("https://") || url.startsWith("data:")) return url;

  // Limpiar la ruta
  url = url.replace(/\\/g, "/").replace(/^[A-Za-z]:\/.*?\/gistore\//, "").replace(/^\//, "");

  // Siempre desde la raíz del sitio, sin importar en qué página estés
  return window.location.origin + "/" + url;
}

// ── Estado global ──────────────────────────────────────────
let CATEGORIAS       = {};   // { id → nombre }
let VENDEDORES       = {};   // { id → doc completo }
let idsActivos       = [];   // ids vendedores con estado=activo

let categoriaActiva  = "";
let busquedaActiva   = "";
let paginaActual     = 1;
let totalProductos   = 0;    // conteo total en Firestore

// cursores[i] = último snapshot-doc antes de la página i+1
// cursores[0] = null  →  la página 1 arranca desde el principio
let cursores         = [null];
let cachePaginas     = {};   // { "pag|cat|bus" → [prod, …] }

let seleccionados    = new Map();
let productoModal    = null;
let carritoAbierto   = false;

// ── Helpers de vendedor ────────────────────────────────────
function colorVend(id)  { return VENDEDORES[id]?.color       || "#1a6b3c"; }
function waVend(id)     { return VENDEDORES[id]?.whatsapp    || ""; }
function nomVend(id)    { return VENDEDORES[id]?.nombre      || ""; }
function ciudadVend(id) { return VENDEDORES[id]?.ciudad      || ""; }
function fotoVend(id)   { return VENDEDORES[id]?.perfil || VENDEDORES[id]?.foto || ""; }
function urlTienda(id)  { return id ? "page/tienda.html?v=" + encodeId(id) : "#"; }
function nomCat(id)     { return CATEGORIAS[id] || ""; }

// ── Carga de metadatos ─────────────────────────────────────
async function obtenerCategorias() {
  try {
    const s = await getDocs(query(collection(_db, "categorias"), orderBy("orden")));
    return s.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch {
    const s = await getDocs(collection(_db, "categorias"));
    return s.docs.map(d => ({ id: d.id, ...d.data() }))
               .sort((a, b) => (a.orden||0) - (b.orden||0));
  }
}
async function obtenerVendedores() {
  const s = await getDocs(collection(_db, "vendedores"));
  return s.docs.map(d => ({ id: d.id, ...d.data() }));
}

// ── Conteo total (sin descargar productos) ─────────────────
async function contarTotal() {
  try {
    // Solo contamos productos de vendedores activos
    // Firestore "in" acepta hasta 30 valores en la versión actual
    if (!idsActivos.length) return 0;
    const chunks = [];
    for (let i = 0; i < idsActivos.length; i += 30)
      chunks.push(idsActivos.slice(i, i + 30));

    let total = 0;
    for (const chunk of chunks) {
      const q = query(
        collection(_db, "productos"),
        where("activo",      "==", true),
        where("vendedor_id", "in", chunk)
      );
      const snap = await getCountFromServer(q);
      total += snap.data().count;
    }
    if (categoriaActiva) {
      // Re-contar con filtro de categoría
      let t2 = 0;
      for (const chunk of chunks) {
        const q = query(
          collection(_db, "productos"),
          where("activo",       "==", true),
          where("vendedor_id",  "in", chunk),
          where("categoria_id", "==", categoriaActiva)
        );
        const snap = await getCountFromServer(q);
        t2 += snap.data().count;
      }
      return t2;
    }
    return total;
  } catch (e) {
    console.warn("getCountFromServer no disponible, estimando…", e);
    return 0;
  }
}

// ── Fetch de UNA página desde Firestore ───────────────────
//   Solo descarga los POR_PAGINA productos necesarios.
//   La búsqueda de texto se aplica en cliente (Firestore no
//   tiene full-text) sobre el lote recibido.
async function fetchPagina(pag) {
  const claveCache = `${pag}|${categoriaActiva}|${normalizar(busquedaActiva)}`;
  if (cachePaginas[claveCache]) return cachePaginas[claveCache];

  try {
    const filtros = [where("activo", "==", true)];

    if (idsActivos.length) {
      // Firestore permite máx 30 en "in", usamos los primeros 30.
      // En producción con > 30 vendedores conviene un índice + campo extra.
      filtros.push(where("vendedor_id", "in", idsActivos.slice(0, 30)));
    }
    if (categoriaActiva) {
      filtros.push(where("categoria_id", "==", categoriaActiva));
    }

    filtros.push(orderBy("nombre"));
    filtros.push(limit(POR_PAGINA));

    const cursor = cursores[pag - 1] || null;
    if (cursor) filtros.push(startAfter(cursor));

    const snap = await getDocs(query(collection(_db, "productos"), ...filtros));
    const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));

    // Guardamos cursor para la página siguiente
    if (snap.docs.length === POR_PAGINA) {
      cursores[pag] = snap.docs[snap.docs.length - 1];
    }

    // Filtro de texto en cliente
    const resultado = busquedaActiva.trim()
      ? docs.filter(p =>
          normalizar(p.nombre).includes(normalizar(busquedaActiva)) ||
          normalizar(p.descripcion || "").includes(normalizar(busquedaActiva)))
      : docs;

    cachePaginas[claveCache] = resultado;
    return resultado;
  } catch (e) {
    console.error("fetchPagina:", e);
    return [];
  }
}

function resetCursores() {
  cursores     = [null];
  cachePaginas = {};
}

// ── Spinner de carga ───────────────────────────────────────
function mostrarCargando(si) {
  let el = document.getElementById("cargando-productos");
  if (!el) {
    el = document.createElement("p");
    el.id        = "cargando-productos";
    el.className = "resultados-info";
    document.getElementById("grilla").before(el);
  }
  el.textContent = "⏳ Cargando productos…";
  el.style.display = si ? "block" : "none";
}

// ── Inicio ─────────────────────────────────────────────────
async function iniciar() {
  mostrarCargando(true);
  try {
    const [cats, vends] = await Promise.all([obtenerCategorias(), obtenerVendedores()]);
    cats.forEach(c  => { CATEGORIAS[c.id] = c.nombre; });
    vends.forEach(v => { VENDEDORES[v.id] = v; });
    idsActivos = vends.filter(v => v.estado === "activo").map(v => v.id);

    totalProductos = await contarTotal();

    renderFiltros();
    await renderCatalogo();

    // Abrir producto por URL ?p=…
    const enc = new URLSearchParams(window.location.search).get("p");
    if (enc) {
      const id = decodeId(enc);
      const pag = cachePaginas[`1||`] || [];
      const prod = pag.find(p => p.id === id);
      if (prod) setTimeout(() => abrirModal(prod), 350);
    }
  } catch (e) {
    console.error(e);
    document.getElementById("grilla").innerHTML =
      '<div class="sin-resultados"><p>Error al cargar. Recarga la página.</p></div>';
  } finally {
    mostrarCargando(false);
  }
}

// ── Filtros de categoría ───────────────────────────────────
function renderFiltros() {
  const cont = document.getElementById("filtros");
  cont.innerHTML = "";

  const mk = (texto, id) => {
    const b = document.createElement("button");
    b.className  = "filtro-btn" + (categoriaActiva === id ? " activo" : "");
    b.textContent = texto;
    b.addEventListener("click", async () => {
      if (categoriaActiva === id) return;
      categoriaActiva = id;
      paginaActual    = 1;
      resetCursores();
      totalProductos  = await contarTotal();
      renderFiltros();
      await renderCatalogo();
    });
    cont.appendChild(b);
  };
  mk("Todos", "");
  Object.entries(CATEGORIAS).forEach(([id, nombre]) => mk(nombre, id));
}

// ── Catálogo ───────────────────────────────────────────────
async function renderCatalogo() {
  const grilla = document.getElementById("grilla");
  const infoEl = document.getElementById("resultados-info");
  grilla.innerHTML = "";
  mostrarCargando(true);

  const pagina    = await fetchPagina(paginaActual);
  const totalPags = Math.max(1, Math.ceil(totalProductos / POR_PAGINA));
  const desde     = (paginaActual - 1) * POR_PAGINA + 1;
  const hasta     = Math.min(paginaActual * POR_PAGINA, totalProductos);

  mostrarCargando(false);

  if (totalProductos > 0) {
    infoEl.textContent =
      `${totalProductos.toLocaleString("es-CO")} productos · ` +
      `mostrando ${desde}–${hasta} · página ${paginaActual} de ${totalPags}`;
  } else {
    infoEl.textContent = pagina.length ? `Página ${paginaActual}` : "Sin resultados";
  }

  if (!pagina.length) {
    grilla.innerHTML =
      `<div class="sin-resultados"><div class="icono">🔍</div>
       <p>No hay productos${categoriaActiva ? " en esta categoría" : ""}.</p></div>`;
  } else {
    pagina.forEach(p => grilla.appendChild(crearTarjeta(p)));
  }

  renderPaginado(totalProductos || pagina.length * totalPags);
}

// ── Tarjeta ────────────────────────────────────────────────
function crearTarjeta(prod) {
  const sel    = seleccionados.has(prod.id);
  const color  = colorVend(prod.vendedor_id);
  const nombre = nomVend(prod.vendedor_id);
  const ciudad = ciudadVend(prod.vendedor_id);
  const foto   = fotoVend(prod.vendedor_id);
  const link   = urlTienda(prod.vendedor_id);

  // Bloque vendedor (solo si tiene nombre registrado)
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
        ${ciudad ? `<span class="chip-ciudad">📍 ${ciudad}</span>` : ""}
      </span>
    </a>` : "";

  const div = document.createElement("div");
  div.className  = "tarjeta" + (sel ? " seleccionada" : "");
  div.dataset.id = prod.id;
  div.innerHTML  = `
    <div class="tarjeta-check">${sel ? "✓" : ""}</div>
    <div class="tarjeta-img-wrap">
      <img src="${resolverImg(prod.imagen)}" alt="${prod.nombre}" loading="lazy"
           onerror="this.src='https://placehold.co/400x300/e8f5ee/1a6b3c?text=Imagen'">
      <span class="tarjeta-categoria-badge">${nomCat(prod.categoria_id)}</span>
    </div>
    <div class="tarjeta-body">
      <div class="tarjeta-nombre">${prod.nombre}</div>
      <div class="tarjeta-beneficio-top">${(prod.beneficios || [])[0] || ""}</div>
      <div class="tarjeta-footer">
        <span class="tarjeta-precio" style="color:${color}">${formatoPrecio(prod.valor)}</span>
        <button class="btn-ver">Ver más</button>
      </div>
      ${chipVendedor}
    </div>`;

  div.querySelector(".tarjeta-img-wrap")
     .addEventListener("click", e => { e.stopPropagation(); abrirModal(prod); });
  div.querySelector(".btn-ver")
     .addEventListener("click", e => { e.stopPropagation(); abrirModal(prod); });
  div.addEventListener("click", e => {
    if (!e.target.closest(".tarjeta-img-wrap") &&
        !e.target.classList.contains("btn-ver") &&
        !e.target.closest(".tarjeta-vendedor-chip"))
      toggleSeleccion(prod.id);
  });
  return div;
}

// ── Paginador inteligente ──────────────────────────────────
//  ← 1  2  3  …  8  …  14  15  →
function renderPaginado(totalItems) {
  const cont      = document.getElementById("paginado");
  cont.innerHTML  = "";
  const totalPags = Math.max(1, Math.ceil(totalItems / POR_PAGINA));
  if (totalPags <= 1) return;

  const DELTA = window.innerWidth < 500 ? 1 : 2;

  async function irA(pag) {
    paginaActual = pag;
    await renderCatalogo();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  const mk = (txt, pag, disabled = false, activo = false, elipsis = false) => {
    const b       = document.createElement("button");
    b.className   = "pag-btn" + (activo ? " activo" : "") + (elipsis ? " pag-elipsis" : "");
    b.textContent = txt;
    b.disabled    = disabled || elipsis;
    if (!disabled && !activo && !elipsis) b.addEventListener("click", () => irA(pag));
    return b;
  };

  const ini = Math.max(2, paginaActual - DELTA);
  const fin = Math.min(totalPags - 1, paginaActual + DELTA);

  cont.appendChild(mk("←", paginaActual - 1, paginaActual === 1));
  cont.appendChild(mk(1,   1, false, paginaActual === 1));
  if (ini > 2)             cont.appendChild(mk("…", 0, false, false, true));
  for (let i = ini; i <= fin; i++) cont.appendChild(mk(i, i, false, i === paginaActual));
  if (fin < totalPags - 1) cont.appendChild(mk("…", 0, false, false, true));
  if (totalPags > 1)       cont.appendChild(mk(totalPags, totalPags, false, paginaActual === totalPags));
  cont.appendChild(mk("→", paginaActual + 1, paginaActual === totalPags));
}

// ── Modal ──────────────────────────────────────────────────
function abrirModal(prod) {
  productoModal       = prod;
  const v             = VENDEDORES[prod.vendedor_id] || {};
  const color         = colorVend(prod.vendedor_id);
  const fotoV         = v.perfil || v.foto || "";

  document.getElementById("modal-img").src               = resolverImg(prod.imagen);
  document.getElementById("modal-img").alt               = prod.nombre;
  document.getElementById("modal-categoria").textContent = nomCat(prod.categoria_id);
  document.getElementById("modal-nombre").textContent    = prod.nombre;
  document.getElementById("modal-precio").textContent    = formatoPrecio(prod.valor);
  document.getElementById("modal-precio").style.color    = color;
  document.getElementById("modal-desc").textContent      = prod.descripcion || "";
  document.getElementById("modal-beneficios").innerHTML  =
    (prod.beneficios || []).map(b => `<li>${b}</li>`).join("");

  const seccionConsumo = document.getElementById("modal-consumo-seccion");
  const textoConsumo   = document.getElementById("modal-consumo-texto");
  if (prod.recomendacion) {
    textoConsumo.textContent = prod.recomendacion;
    seccionConsumo.style.display = "block";
  } else {
    textoConsumo.textContent = "";
    seccionConsumo.style.display = "none";
  }

  // ── Bloque vendedor en modal ──────────────────────────────
  // Se inserta una sola vez y se reutiliza en aperturas siguientes
  let bloque = document.getElementById("modal-vendedor-bloque");
  if (!bloque) {
    bloque    = document.createElement("div");
    bloque.id = "modal-vendedor-bloque";
    document.getElementById("modal-precio").insertAdjacentElement("afterend", bloque);
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
        ${v.ciudad ? `<div class="mvb-ciudad">📍 ${v.ciudad}</div>` : ""}
      </div>
    </div>
    <span class="mvb-btn">Ver tienda →</span>
  </a>`;
    bloque.style.display = "block";
  } else {
    bloque.style.display = "none";
  }

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

// ── Selección ──────────────────────────────────────────────
function toggleSeleccion(id) {
  const clave = `${paginaActual}|${categoriaActiva}|${normalizar(busquedaActiva)}`;
  const pag   = cachePaginas[clave] || [];
  if (seleccionados.has(id)) {
    seleccionados.delete(id);
  } else {
    const p = pag.find(x => x.id === id);
    if (p) seleccionados.set(id, { prod: p, cantidad: 1 });
  }
  actualizarTarjetaSeleccion(id);
  actualizarPanelInferior();
  actualizarCartBtn();
  if (carritoAbierto) renderCarrito();
  if (productoModal?.id === id) actualizarBtnSeleccionModal();
}

function cambiarCantidad(id, delta) {
  if (!seleccionados.has(id)) return;
  const item  = seleccionados.get(id);
  const nueva = item.cantidad + delta;
  if (nueva <= 0) { eliminarDelCarrito(id); return; }
  item.cantidad = nueva;
  actualizarPanelInferior(); actualizarCartBtn(); renderCarrito();
}

function eliminarDelCarrito(id) {
  seleccionados.delete(id);
  actualizarTarjetaSeleccion(id);
  actualizarPanelInferior();
  actualizarCartBtn();
  if (productoModal?.id === id) actualizarBtnSeleccionModal();
  if (!seleccionados.size) { cerrarCarrito(); return; }
  renderCarrito();
}

function actualizarTarjetaSeleccion(id) {
  const t = document.querySelector(`.tarjeta[data-id='${id}']`);
  if (!t) return;
  const check = t.querySelector(".tarjeta-check");
  if (seleccionados.has(id)) {
    t.classList.add("seleccionada"); check.textContent = "✓";
  } else {
    t.classList.remove("seleccionada"); check.textContent = "";
  }
}

function actualizarCartBtn() {
  const btn   = document.getElementById("cart-btn");
  const count = document.getElementById("cart-count");
  const total = [...seleccionados.values()].reduce((a, {cantidad}) => a + cantidad, 0);
  count.textContent = total;
  btn.style.display = seleccionados.size > 0 ? "flex" : "none";
}

function actualizarPanelInferior() {
  const panel = document.getElementById("panel-seleccion");
  const info  = document.getElementById("panel-info-texto");
  const total = [...seleccionados.values()].reduce((a, {cantidad}) => a + cantidad, 0);
  if (!seleccionados.size) { panel.classList.remove("visible"); return; }
  panel.classList.add("visible");
  info.innerHTML = `<strong>${total}</strong> unidad${total > 1 ? "es" : ""} seleccionada${total > 1 ? "s" : ""}`;
}

function limpiarSeleccion() {
  const ids = [...seleccionados.keys()];
  seleccionados.clear();
  ids.forEach(actualizarTarjetaSeleccion);
  actualizarPanelInferior(); actualizarCartBtn();
  if (productoModal) actualizarBtnSeleccionModal();
  cerrarCarrito();
}

// ── Carrito ────────────────────────────────────────────────
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
  const items  = [...seleccionados.values()];
  const total  = items.reduce((a, {prod, cantidad}) => a + prod.valor * cantidad, 0);
  const lista  = document.getElementById("carrito-lista");

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
    </div>`).join("");

  lista.querySelectorAll(".carrito-item-eliminar")
       .forEach(b => b.addEventListener("click", () => eliminarDelCarrito(b.dataset.id)));
  lista.querySelectorAll(".qty-btn")
       .forEach(b => b.addEventListener("click", () => cambiarCantidad(b.dataset.id, Number(b.dataset.delta))));
  document.getElementById("carrito-total").textContent = formatoPrecio(total);
}

// ── WhatsApp ───────────────────────────────────────────────
function enviarWhatsappProducto(prod) {
  const numero = waVend(prod.vendedor_id);
  if (!numero) { alert("Este vendedor no tiene WhatsApp registrado."); return; }
  const img   = resolverImg(prod.imagen);
  const texto =
    "😊 ¡Hola! Me interesa este producto:\n\n" +
    "✨ *" + prod.nombre + "*\n" +
    "💵 Precio: *" + formatoPrecio(prod.valor) + "*\n" +
    (img ? "🖼️ " + img + "\n\n" : "\n") +
    "¿Está disponible? ¿Hacen envíos? 🙏";
  window.open(buildWaUrl(numero, texto), "_blank");
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
    const ok = confirm(`Este pedido incluye ${entradas.length} vendedores. Se abrirán ${entradas.length} chats. ¿Continuar?`);
    if (!ok) return;
  }
  entradas.forEach(([numero, lineas]) => {
    const lista = lineas.map((l, j) =>
      `${j + 1}. *${l.prod.nombre}* x${l.cantidad} — ${formatoPrecio(l.prod.valor * l.cantidad)}`
    ).join("\n");
    const total = lineas.reduce((a, l) => a + l.prod.valor * l.cantidad, 0);
    window.open(buildWaUrl(numero,
      `👋 ¡Hola! Quisiera hacer un pedido:\n\n${lista}\n\n✅ *Total: ${formatoPrecio(total)}*\n\n¿Confirman disponibilidad? 🙏`
    ), "_blank");
  });
}

// ── Compartir ──────────────────────────────────────────────
function compartirProducto(prod) {
  const url    = new URL(window.location.href);
  url.searchParams.set("p", encodeId(prod.id));
  const enlace = url.toString();
  const texto  = `🌿 ¡Mira esto!\n*${prod.nombre}*\n💵 ${formatoPrecio(prod.valor)}\n👇 ${enlace}`;
  if (navigator.share) {
    navigator.share({ title: prod.nombre, text: texto, url: enlace }).catch(() => {});
  } else {
    navigator.clipboard.writeText(texto).then(() => {
      const btn  = document.getElementById("btn-compartir-modal");
      const orig = btn.innerHTML;
      btn.innerHTML        = "✓ ¡Copiado!";
      btn.style.background = "#1a6b3c";
      btn.style.color      = "#fff";
      setTimeout(() => { btn.innerHTML = orig; btn.style.background = ""; btn.style.color = ""; }, 2000);
    });
  }
}

// ── DOMContentLoaded ───────────────────────────────────────
document.addEventListener("DOMContentLoaded", () => {
  const inputBusqueda = document.getElementById("busqueda-input");
  const btnLimpiar    = document.getElementById("busqueda-limpiar");

  if (inputBusqueda) {
    let timer;
    inputBusqueda.addEventListener("input", () => {
      clearTimeout(timer);
      timer = setTimeout(async () => {
        busquedaActiva = inputBusqueda.value;
        btnLimpiar.style.display = busquedaActiva ? "flex" : "none";
        paginaActual = 1;
        resetCursores();
        await renderCatalogo();
      }, 350);
    });
    btnLimpiar.addEventListener("click", async () => {
      busquedaActiva = "";
      inputBusqueda.value = "";
      btnLimpiar.style.display = "none";
      paginaActual = 1;
      resetCursores();
      await renderCatalogo();
      inputBusqueda.focus();
    });
  }

  document.getElementById("overlay")
          .addEventListener("click", e => { if (e.target.id === "overlay") cerrarModal(); });
  document.getElementById("btn-cerrar-modal").addEventListener("click", cerrarModal);
  document.getElementById("btn-seleccionar-modal")
          .addEventListener("click", () => { if (productoModal) toggleSeleccion(productoModal.id); });
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