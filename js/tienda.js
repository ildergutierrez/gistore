// ============================================================
//  tienda.html — JS módulo inline
//  Lee ?v=BASE64_VENDEDOR_ID, carga datos del vendedor y sus
//  productos con la misma lógica paginada que app.js
// ============================================================
import { initializeApp }
  from "https://www.gstatic.com/firebasejs/12.10.0/firebase-app.js";
import {
  getFirestore, collection, getDocs, getDoc, doc,
  getCountFromServer, query, where, orderBy, limit, startAfter
} from "https://www.gstatic.com/firebasejs/12.10.0/firebase-firestore.js";

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
function fmt(v)      { return "$ " + Number(v).toLocaleString("es-CO"); }
function nor(t)      { return (t||"").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,""); }
function waUrl(n, t) { return "https://wa.me/" + n + "?text=" + encodeURIComponent(t); }
function encId(id)   { return btoa(String(id)).replace(/=/g,""); }
function decId(s)    { const p = s.length%4 ? "=".repeat(4-s.length%4) : ""; try { return atob(s+p); } catch { return null; } }
function resolveImg(url) {
  if (!url) return "";
  if (url.startsWith("http") || url.startsWith("data:")) return url;
  url = url.replace(/\\/g, "/").replace(/^[A-Za-z]:\/.*?\/gistore\//, "").replace(/^\//, "");
  return window.location.origin + "/" + url;
}

// ── Estado ─────────────────────────────────────────────────
let VENDEDOR       = null;
let VENDEDOR_ID    = "";
let CATEGORIAS_MAP = {};
let categoriaActiva = "";
let busquedaActiva  = "";
let paginaActual    = 1;
let totalProductos  = 0;
let cursores        = [null];
let cachePaginas    = {};
let seleccionados   = new Map();
let productoModal   = null;
let carritoAbierto  = false;

// ── Leer ?v= ──────────────────────────────────────────────
const params    = new URLSearchParams(window.location.search);
const vEncoded  = params.get("v");
VENDEDOR_ID     = vEncoded ? decId(vEncoded) : null;

// ── Helpers locales ────────────────────────────────────────
function color()  { return VENDEDOR?.color || "#1a6b3c"; }
function waNum()  { return VENDEDOR?.whatsapp || ""; }
function nomCat(id) { return CATEGORIAS_MAP[id] || ""; }

function resetCursores() { cursores = [null]; cachePaginas = {}; }

// ── Contar productos de este vendedor ──────────────────────
async function contarTotal() {
  try {
    let q = query(collection(_db,"productos"),
      where("activo","==",true),
      where("vendedor_id","==",VENDEDOR_ID));
    if (categoriaActiva)
      q = query(collection(_db,"productos"),
        where("activo","==",true),
        where("vendedor_id","==",VENDEDOR_ID),
        where("categoria_id","==",categoriaActiva));
    const snap = await getCountFromServer(q);
    return snap.data().count;
  } catch { return 0; }
}

// ── Fetch paginado ─────────────────────────────────────────
async function fetchPagina(pag) {
  const clave = `${pag}|${categoriaActiva}|${nor(busquedaActiva)}`;
  if (cachePaginas[clave]) return cachePaginas[clave];

  try {
    const filtros = [
      where("activo","==",true),
      where("vendedor_id","==",VENDEDOR_ID)
    ];
    if (categoriaActiva) filtros.push(where("categoria_id","==",categoriaActiva));
    filtros.push(orderBy("nombre"));
    filtros.push(limit(POR_PAGINA));
    const cursor = cursores[pag-1] || null;
    if (cursor) filtros.push(startAfter(cursor));

    const snap = await getDocs(query(collection(_db,"productos"), ...filtros));
    const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));

    if (snap.docs.length === POR_PAGINA)
      cursores[pag] = snap.docs[snap.docs.length - 1];

    const res = busquedaActiva.trim()
      ? docs.filter(p =>
          nor(p.nombre).includes(nor(busquedaActiva)) ||
          nor(p.descripcion||"").includes(nor(busquedaActiva)))
      : docs;

    cachePaginas[clave] = res;
    return res;
  } catch(e) { console.error(e); return []; }
}

// ── Spinner ────────────────────────────────────────────────
function setCargando(si) {
  let el = document.getElementById("cargando-productos");
  if (!el) {
    el = document.createElement("p");
    el.id = "cargando-productos"; el.className = "resultados-info";
    document.getElementById("grilla").before(el);
  }
  el.textContent = "⏳ Cargando productos…";
  el.style.display = si ? "block" : "none";
}

// ── Render hero de la tienda ───────────────────────────────
function renderHero(totalProds) {
  const v    = VENDEDOR;
  const foto = v.perfil || v.foto || "";
  const clr  = v.color || "#1a6b3c";
  const descr = v.descripcion ? ` ✅ ${v.descripcion}` : "";

  document.title = (v.nombre || "Tienda") + " · GI Store";

  document.getElementById("tienda-hero-wrap").innerHTML = `
    <section class="tienda-hero">
      <div class="tienda-hero-inner">
        ${foto
          ? `<img class="tienda-avatar" src="${resolveImg(foto)}" alt="${v.nombre}"
               onerror="this.style.display='none'">`
          : `<div class="tienda-avatar-inicial" style="background:${clr}">${(v.nombre||"T")[0].toUpperCase()}</div>`
        }
        <div class="tienda-info">
          <div class="tienda-nombre">${v.nombre || "Tienda"}</div>
          ${descr ? `<div class="tienda-descripcion" style="padding: 0.5rem;">${descr}</div>` : ""}
          ${v.ciudad ? `<div class="tienda-ciudad">📍 ${v.ciudad}</div>` : ""}
          <div class="tienda-stats">
            <span class="tienda-stat">🛍️ ${totalProds.toLocaleString("es-CO")} producto${totalProds !== 1 ? "s" : ""} disponibles</span>
          </div>
          ${v.whatsapp ? `
          <a href="https://wa.me/${v.whatsapp}?text=${encodeURIComponent("👋 Hola! Vi tu tienda en GI Store y me gustaría consultar sobre tus productos.")}"
             class="btn-wa-tienda" target="_blank" rel="noopener">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
              <path d="M12 0C5.373 0 0 5.373 0 12c0 2.117.549 4.107 1.51 5.833L.057 23.571a.75.75 0 00.92.92l5.738-1.453A11.944 11.944 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22a10 10 0 01-5.17-1.445l-.37-.22-3.828.97.985-3.735-.241-.386A10 10 0 1112 22z"/>
            </svg>
            Contactar por WhatsApp
          </a>` : ""}
        </div>
      </div>
    </section>`;

  document.getElementById("breadcrumb").innerHTML =
    `<a href="../index.html">← Volver al catálogo general</a>`;
}

// ── Filtros ────────────────────────────────────────────────
function renderFiltros(cats) {
  const cont = document.getElementById("filtros");
  cont.innerHTML = "";
  if (!cats.length) return;

  const mk = (texto, id) => {
    const b = document.createElement("button");
    b.className   = "filtro-btn" + (categoriaActiva === id ? " activo" : "");
    b.textContent = texto;
    b.addEventListener("click", async () => {
      if (categoriaActiva === id) return;
      categoriaActiva = id; paginaActual = 1; resetCursores();
      totalProductos = await contarTotal();
      renderFiltros(cats); await renderCatalogo();
    });
    cont.appendChild(b);
  };
  mk("Todos","");
  cats.forEach(([id, nom]) => mk(nom, id));
}

// ── Catálogo ───────────────────────────────────────────────
async function renderCatalogo() {
  const grilla = document.getElementById("grilla");
  const infoEl = document.getElementById("resultados-info");
  grilla.innerHTML = ""; setCargando(true);

  const pagina    = await fetchPagina(paginaActual);
  const totalPags = Math.max(1, Math.ceil(totalProductos / POR_PAGINA));
  const desde     = (paginaActual - 1) * POR_PAGINA + 1;
  const hasta     = Math.min(paginaActual * POR_PAGINA, totalProductos);

  setCargando(false);

  infoEl.textContent = totalProductos > 0
    ? `${totalProductos.toLocaleString("es-CO")} productos · mostrando ${desde}–${hasta} · página ${paginaActual} de ${totalPags}`
    : (pagina.length ? `Página ${paginaActual}` : "Sin resultados");

  if (!pagina.length) {
    grilla.innerHTML = `<div class="sin-resultados"><div class="icono">🔍</div>
      <p>No hay productos${categoriaActiva ? " en esta categoría" : ""}.</p></div>`;
  } else {
    pagina.forEach(p => grilla.appendChild(crearTarjeta(p)));
  }
  renderPaginado(totalProductos || pagina.length * totalPags);
}

// ── Tarjeta ────────────────────────────────────────────────
function crearTarjeta(prod) {
  const sel = seleccionados.has(prod.id);
  const clr = color();
  const div = document.createElement("div");
  div.className  = "tarjeta" + (sel ? " seleccionada" : "");
  div.dataset.id = prod.id;
  div.innerHTML  = `
    <div class="tarjeta-check">${sel ? "✓" : ""}</div>
    <div class="tarjeta-img-wrap">
      <img src="${resolveImg(prod.imagen)}" alt="${prod.nombre}" loading="lazy"
           onerror="this.src='https://placehold.co/400x300/e8f5ee/1a6b3c?text=Imagen'">
      <span class="tarjeta-categoria-badge">${nomCat(prod.categoria_id)}</span>
    </div>
    <div class="tarjeta-body">
      <div class="tarjeta-nombre">${prod.nombre}</div>
      <div class="tarjeta-beneficio-top">${(prod.beneficios||[])[0] || ""}</div>
      <div class="tarjeta-footer">
        <span class="tarjeta-precio" style="color:${clr}">${fmt(prod.valor)}</span>
        <button class="btn-ver">Ver más</button>
      </div>
    </div>`;
  div.querySelector(".tarjeta-img-wrap")
     .addEventListener("click", e => { e.stopPropagation(); abrirModal(prod); });
  div.querySelector(".btn-ver")
     .addEventListener("click", e => { e.stopPropagation(); abrirModal(prod); });
  div.addEventListener("click", e => {
    if (!e.target.closest(".tarjeta-img-wrap") && !e.target.classList.contains("btn-ver"))
      toggleSel(prod.id);
  });
  return div;
}

// ── Paginador ──────────────────────────────────────────────
function renderPaginado(totalItems) {
  const cont      = document.getElementById("paginado");
  cont.innerHTML  = "";
  const totalPags = Math.max(1, Math.ceil(totalItems / POR_PAGINA));
  if (totalPags <= 1) return;
  const DELTA = window.innerWidth < 500 ? 1 : 2;
  async function irA(p) { paginaActual = p; await renderCatalogo(); window.scrollTo({top:0,behavior:"smooth"}); }
  const mk = (txt, p, dis=false, act=false, eli=false) => {
    const b = document.createElement("button");
    b.className   = "pag-btn"+(act?" activo":"")+(eli?" pag-elipsis":"");
    b.textContent = txt; b.disabled = dis||eli;
    if (!dis&&!act&&!eli) b.addEventListener("click", () => irA(p));
    return b;
  };
  const ini = Math.max(2, paginaActual - DELTA);
  const fin = Math.min(totalPags - 1, paginaActual + DELTA);
  cont.appendChild(mk("←", paginaActual-1, paginaActual===1));
  cont.appendChild(mk(1, 1, false, paginaActual===1));
  if (ini > 2) cont.appendChild(mk("…",0,false,false,true));
  for (let i=ini; i<=fin; i++) cont.appendChild(mk(i,i,false,i===paginaActual));
  if (fin < totalPags-1) cont.appendChild(mk("…",0,false,false,true));
  if (totalPags > 1) cont.appendChild(mk(totalPags,totalPags,false,paginaActual===totalPags));
  cont.appendChild(mk("→", paginaActual+1, paginaActual===totalPags));
}

// ── Modal ──────────────────────────────────────────────────
function abrirModal(prod) {
  productoModal = prod;
  const clr = color();
  document.getElementById("modal-img").src               = resolveImg(prod.imagen);
  document.getElementById("modal-img").alt               = prod.nombre;
  document.getElementById("modal-categoria").textContent = nomCat(prod.categoria_id);
  document.getElementById("modal-nombre").textContent    = prod.nombre;
  document.getElementById("modal-precio").textContent    = fmt(prod.valor);
  document.getElementById("modal-precio").style.color    = clr;
  document.getElementById("modal-desc").textContent      = prod.descripcion || "";
  document.getElementById("modal-beneficios").innerHTML  =
    (prod.beneficios||[]).map(b => `<li>${b}</li>`).join("");
  const sc = document.getElementById("modal-consumo-seccion");
  const ct = document.getElementById("modal-consumo-texto");
  if (prod.recomendacion) { ct.textContent = prod.recomendacion; sc.style.display = "block"; }
  else { ct.textContent = ""; sc.style.display = "none"; }
  actualizarBtnSel();
  document.getElementById("btn-whatsapp-modal").onclick  = () => enviarWaProducto(prod);
  document.getElementById("btn-compartir-modal").onclick = () => compartir(prod);
  document.getElementById("overlay").classList.add("activo");
  document.body.style.overflow = "hidden";
  const u = new URL(window.location.href);
  u.searchParams.set("p", encId(prod.id));
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
function actualizarBtnSel() {
  if (!productoModal) return;
  const btn = document.getElementById("btn-seleccionar-modal");
  const sel = seleccionados.has(productoModal.id);
  btn.textContent = sel ? "✓ Seleccionado" : "🛒 Añadir";
  btn.className   = "btn-seleccionar-modal" + (sel ? " activo" : "");
}

// ── Selección / carrito ────────────────────────────────────
function toggleSel(id) {
  const clave = `${paginaActual}|${categoriaActiva}|${nor(busquedaActiva)}`;
  const pag   = cachePaginas[clave] || [];
  if (seleccionados.has(id)) seleccionados.delete(id);
  else { const p = pag.find(x => x.id === id); if (p) seleccionados.set(id, {prod:p, cantidad:1}); }
  actualizarTarjetaSel(id); actualizarPanel(); actualizarCartBtn();
  if (carritoAbierto) renderCarrito();
  if (productoModal?.id === id) actualizarBtnSel();
}
function cambiarCantidad(id, delta) {
  if (!seleccionados.has(id)) return;
  const item = seleccionados.get(id);
  const nv   = item.cantidad + delta;
  if (nv <= 0) { eliminar(id); return; }
  item.cantidad = nv;
  actualizarPanel(); actualizarCartBtn(); renderCarrito();
}
function eliminar(id) {
  seleccionados.delete(id);
  actualizarTarjetaSel(id); actualizarPanel(); actualizarCartBtn();
  if (productoModal?.id === id) actualizarBtnSel();
  if (!seleccionados.size) { cerrarCarrito(); return; }
  renderCarrito();
}
function actualizarTarjetaSel(id) {
  const t = document.querySelector(`.tarjeta[data-id='${id}']`);
  if (!t) return;
  const ch = t.querySelector(".tarjeta-check");
  if (seleccionados.has(id)) { t.classList.add("seleccionada"); ch.textContent = "✓"; }
  else { t.classList.remove("seleccionada"); ch.textContent = ""; }
}
function actualizarCartBtn() {
  const btn   = document.getElementById("cart-btn");
  const count = document.getElementById("cart-count");
  const total = [...seleccionados.values()].reduce((a,{cantidad}) => a+cantidad, 0);
  count.textContent = total;
  btn.style.display = seleccionados.size > 0 ? "flex" : "none";
}
function actualizarPanel() {
  const panel = document.getElementById("panel-seleccion");
  const info  = document.getElementById("panel-info-texto");
  const total = [...seleccionados.values()].reduce((a,{cantidad}) => a+cantidad, 0);
  if (!seleccionados.size) { panel.classList.remove("visible"); return; }
  panel.classList.add("visible");
  info.innerHTML = `<strong>${total}</strong> unidad${total>1?"es":""} seleccionada${total>1?"s":""}`;
}
function limpiarSel() {
  const ids = [...seleccionados.keys()];
  seleccionados.clear();
  ids.forEach(actualizarTarjetaSel);
  actualizarPanel(); actualizarCartBtn();
  if (productoModal) actualizarBtnSel();
  cerrarCarrito();
}
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
  const total = items.reduce((a,{prod,cantidad}) => a + prod.valor*cantidad, 0);
  const lista = document.getElementById("carrito-lista");
  lista.innerHTML = items.map(({prod, cantidad}) => `
    <div class="carrito-item" style="border-bottom:3px solid ${color()}">
      <img class="carrito-item-img" src="${resolveImg(prod.imagen)}" alt="${prod.nombre}"
           onerror="this.src='https://placehold.co/80x80/e8f5ee/1a6b3c?text=Img'">
      <div class="carrito-item-info">
        <span class="carrito-item-nombre">${prod.nombre}</span>
        <span class="carrito-item-cat">${nomCat(prod.categoria_id)}</span>
        <span class="carrito-item-precio">${fmt(prod.valor * cantidad)}</span>
      </div>
      <div class="carrito-item-cantidad">
        <button class="qty-btn" data-id="${prod.id}" data-delta="-1">−</button>
        <span class="qty-num">${cantidad}</span>
        <button class="qty-btn" data-id="${prod.id}" data-delta="1">+</button>
      </div>
      <button class="carrito-item-eliminar" data-id="${prod.id}" title="Eliminar">✕</button>
    </div>`).join("");
  lista.querySelectorAll(".carrito-item-eliminar")
       .forEach(b => b.addEventListener("click", () => eliminar(b.dataset.id)));
  lista.querySelectorAll(".qty-btn")
       .forEach(b => b.addEventListener("click", () => cambiarCantidad(b.dataset.id, Number(b.dataset.delta))));
  document.getElementById("carrito-total").textContent = fmt(total);
}

// ── WhatsApp ───────────────────────────────────────────────
function enviarWaProducto(prod) {
  const num = waNum();
  if (!num) { alert("Este vendedor no tiene WhatsApp registrado."); return; }
  window.open(waUrl(num,
    `😊 ¡Hola! Me interesa este producto:\n\n✨ *${prod.nombre}*\n💵 Precio: *${fmt(prod.valor)}*\n` +
    (resolveImg(prod.imagen) ? `🖼️ ${resolveImg(prod.imagen)}\n\n` : "\n") +
    "¿Está disponible? ¿Hacen envíos? 🙏"), "_blank");
}
function enviarWaCarrito() {
  if (!seleccionados.size) return;
  const items = [...seleccionados.values()];
  const lista = items.map((l,j) =>
    `${j+1}. *${l.prod.nombre}* x${l.cantidad} — ${fmt(l.prod.valor * l.cantidad)}`
  ).join("\n");
  const total = items.reduce((a,l) => a + l.prod.valor * l.cantidad, 0);
  const num   = waNum();
  if (!num) { alert("Este vendedor no tiene WhatsApp registrado."); return; }
  window.open(waUrl(num,
    `👋 ¡Hola! Quisiera hacer un pedido:\n\n${lista}\n\n✅ *Total: ${fmt(total)}*\n\n¿Confirman disponibilidad? 🙏`
  ), "_blank");
}

// ── Compartir ──────────────────────────────────────────────
function compartir(prod) {
  const url    = new URL(window.location.href);
  url.searchParams.set("p", encId(prod.id));
  const enlace = url.toString();
  const texto  = `🌿 ¡Mira esto!\n*${prod.nombre}*\n💵 ${fmt(prod.valor)}\n👇 ${enlace}`;
  if (navigator.share) {
    navigator.share({ title: prod.nombre, text: texto, url: enlace }).catch(() => {});
  } else {
    navigator.clipboard.writeText(texto).then(() => {
      const btn = document.getElementById("btn-compartir-modal");
      const orig = btn.innerHTML;
      btn.innerHTML = "✓ ¡Copiado!"; btn.style.background = "#1a6b3c"; btn.style.color = "#fff";
      setTimeout(() => { btn.innerHTML = orig; btn.style.background = ""; btn.style.color = ""; }, 2000);
    });
  }
}

// ── Inicio ─────────────────────────────────────────────────
async function iniciar() {
  if (!VENDEDOR_ID) {
    document.getElementById("tienda-hero-wrap").innerHTML =
      `<div class="tienda-error">Tienda no encontrada. <a href="../index.html">Volver al catálogo</a></div>`;
    return;
  }
  setCargando(true);
  try {
    // Cargar datos del vendedor
    const vSnap = await getDoc(doc(_db, "vendedores", VENDEDOR_ID));
    if (!vSnap.exists() || vSnap.data().estado !== "activo") {
      document.getElementById("tienda-hero-wrap").innerHTML =
        `<div class="tienda-error">Esta tienda no está disponible. <a href="../index.html">Volver al catálogo</a></div>`;
      setCargando(false); return;
    }
    VENDEDOR = { id: vSnap.id, ...vSnap.data() };

    // Cargar categorías
    try {
      const cSnap = await getDocs(query(collection(_db,"categorias"), orderBy("orden")));
      cSnap.docs.forEach(d => { CATEGORIAS_MAP[d.id] = d.data().nombre; });
    } catch {
      const cSnap = await getDocs(collection(_db,"categorias"));
      cSnap.docs.forEach(d => { CATEGORIAS_MAP[d.id] = d.data().nombre; });
    }

    // Contar productos de esta tienda
    totalProductos = await contarTotal();

    // Hero
    renderHero(totalProductos);

    // Obtener categorías que sí tiene esta tienda
    const firstPage = await fetchPagina(1);
    const catsEnTienda = [...new Set(firstPage.map(p => p.categoria_id))]
      .filter(id => id && CATEGORIAS_MAP[id])
      .map(id => [id, CATEGORIAS_MAP[id]]);
    renderFiltros(catsEnTienda);

    await renderCatalogo();

    // Abrir por ?p=
    const enc = new URLSearchParams(window.location.search).get("p");
    if (enc) {
      const id   = decId(enc);
      const prod = firstPage.find(p => p.id === id);
      if (prod) setTimeout(() => abrirModal(prod), 350);
    }
  } catch (e) {
    console.error(e);
    document.getElementById("grilla").innerHTML =
      '<div class="sin-resultados"><p>Error al cargar la tienda. Recarga la página.</p></div>';
  } finally { setCargando(false); }
}

// ── Eventos ────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", () => {
  const inp = document.getElementById("busqueda-input");
  const lim = document.getElementById("busqueda-limpiar");
  if (inp) {
    let t;
    inp.addEventListener("input", () => {
      clearTimeout(t);
      t = setTimeout(async () => {
        busquedaActiva = inp.value; lim.style.display = busquedaActiva ? "flex" : "none";
        paginaActual = 1; resetCursores(); await renderCatalogo();
      }, 350);
    });
    lim.addEventListener("click", async () => {
      busquedaActiva = ""; inp.value = ""; lim.style.display = "none";
      paginaActual = 1; resetCursores(); await renderCatalogo(); inp.focus();
    });
  }
  document.getElementById("overlay")
          .addEventListener("click", e => { if (e.target.id === "overlay") cerrarModal(); });
  document.getElementById("btn-cerrar-modal").addEventListener("click", cerrarModal);
  document.getElementById("btn-seleccionar-modal")
          .addEventListener("click", () => { if (productoModal) toggleSel(productoModal.id); });
  document.getElementById("btn-limpiar").addEventListener("click", limpiarSel);
  document.getElementById("btn-whatsapp-panel").addEventListener("click", abrirCarrito);
  document.getElementById("cart-btn").addEventListener("click", abrirCarrito);
  document.getElementById("carrito-overlay").addEventListener("click", cerrarCarrito);
  document.getElementById("btn-cerrar-carrito").addEventListener("click", cerrarCarrito);
  document.getElementById("btn-carrito-limpiar").addEventListener("click", limpiarSel);
  document.getElementById("btn-carrito-whatsapp").addEventListener("click", enviarWaCarrito);
  document.addEventListener("keydown", e => {
    if (e.key === "Escape") carritoAbierto ? cerrarCarrito() : cerrarModal();
  });
  actualizarCartBtn();
  iniciar();
});
