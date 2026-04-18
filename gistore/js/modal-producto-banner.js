// ============================================================
//  js/modal-producto-banner.js
//
//  Modal de producto IDÉNTICO al del index para páginas /page/
//  · Inyecta HTML + CSS solo si no existe ya en la página
//  · Expone: window._abrirModalProducto(producto)
//  · Precio: prod.precio || prod.valor  (nunca queda en 0)
//  · Bloque vendedor igual al de app.js (mvb-wrap)
// ============================================================

// ── Helpers ───────────────────────────────────────────────
function _fmt(v) {
  return "$ " + Number(v || 0).toLocaleString("es-CO");
}
function _resolverImg(url) {
  if (!url) return "";
  if (url.startsWith("https://") || url.startsWith("http://") || url.startsWith("data:")) return url;
  url = url.replace(/\\/g, "/").replace(/^[A-Za-z]:\/.*?\/gistore\//, "").replace(/^\//, "");
  const isGH     = window.location.hostname.includes("github.io");
  const base     = isGH ? "/gistore" : "";
  const isInPage = window.location.pathname.includes("/page/");
  const prefix   = isInPage ? "../" : "";
  return `${window.location.origin}${base}/${prefix}${url}`;
}
function _getVendedor(prod) {
  if (!prod.vendedor_id) return null;
  // Los campos del vendedor vienen aplanados desde el JOIN en PHP
  const nombre = prod.vendedor_nombre || '';
  if (!nombre) return null;
  return {
    nombre,
    whatsapp: prod.vendedor_whatsapp || '',
    ciudad:   prod.vendedor_ciudad   || '',
    perfil:   prod.vendedor_perfil   || '',
    color:    prod.vendedor_color    || '#1a6b3c',
  };
}
function _getCat(prod) {
  return (window._categoriasMap || {})[prod.categoria_id] || prod.categoria || "";
}
function _colorVend(prod) {
  const v = _getVendedor(prod);
  return (v && v.color) || "#1a6b3c";
}
function _encodeId(id) {
  try { return btoa(String(id)).replace(/=/g, ""); } catch { return ""; }
}
function _urlTienda(prod) {
  if (!prod.vendedor_id) return "#";
  const isInPage = window.location.pathname.includes("/page/");
  return `${isInPage ? "" : "page/"}tienda.html?v=${_encodeId(prod.vendedor_id)}`;
}
function _getWA(prod) {
  const v = _getVendedor(prod);
  return (v && v.whatsapp) || '';
}

// ── Inyectar CSS (replica exacta de style.css del index) ─
function _inyectarCSS() {
  if (document.getElementById("mbanner-style")) return;
  const s = document.createElement("style");
  s.id = "mbanner-style";
  s.textContent = `
    /* ── Overlay ──────────────────────────────────────── */
    #mbanner-overlay {
      display: none; position: fixed; inset: 0;
      background: rgba(0,0,0,.55); backdrop-filter: blur(4px);
      z-index: 2000; align-items: center; justify-content: center;
      padding: 1rem;
    }
    #mbanner-overlay.activo { display: flex; animation: mbFadeIn .2s ease; }
    @keyframes mbFadeIn { from{opacity:0} to{opacity:1} }

    /* ── Modal ────────────────────────────────────────── */
    #mbanner-overlay .modal {
      background: #fff; border-radius: 20px;
      max-width: 760px; width: 100%; max-height: 90vh;
      overflow-y: auto; box-shadow: 0 16px 48px rgba(0,0,0,.18);
      animation: mbSlideUp .3s cubic-bezier(.4,0,.2,1);
    }
    @keyframes mbSlideUp {
      from { transform: translateY(30px); opacity: 0; }
      to   { transform: translateY(0);    opacity: 1; }
    }

    /* ── Imagen ───────────────────────────────────────── */
    #mbanner-overlay .modal-img-wrap { position: relative; }
    #mbanner-overlay .modal-img {
      width: 100%; height: 320px; object-fit: cover;
      border-radius: 20px 20px 0 0; display: block;
    }
    #mbanner-overlay .modal-cerrar {
      position: absolute; top: 1rem; right: 1rem;
      background: rgba(0,0,0,.4); color: #fff; border: none;
      border-radius: 50%; width: 38px; height: 38px; font-size: 1.2rem;
      cursor: pointer; display: flex; align-items: center; justify-content: center;
      transition: background .2s; z-index: 10;
    }
    #mbanner-overlay .modal-cerrar:hover { background: rgba(0,0,0,.7); }

    /* ── Body ─────────────────────────────────────────── */
    #mbanner-overlay .modal-body { padding: 2rem; }

    #mbanner-overlay .modal-categoria {
      display: inline-block; background: #e8f5ee; color: #1a6b3c;
      font-size: .78rem; font-weight: 600; padding: .3rem .8rem;
      border-radius: 50px; text-transform: uppercase;
      letter-spacing: .4px; margin-bottom: .9rem;
    }
    #mbanner-overlay .modal-nombre {
      font-family: 'Playfair Display', Georgia, serif;
      font-size: 1.8rem; font-weight: 700;
      margin-bottom: .5rem; line-height: 1.2; color: #1a1a1a;
    }
    #mbanner-overlay .modal-precio {
      font-size: 1.9rem; font-weight: 700;
      color: #1a6b3c; margin-bottom: 1.2rem;
    }
    #mbanner-overlay .modal-desc {
      font-size: .97rem; line-height: 1.7;
      color: #444444; margin-bottom: 1.4rem;
    }
    #mbanner-overlay .modal-beneficios-titulo {
      font-size: .85rem; font-weight: 700; text-transform: uppercase;
      letter-spacing: .5px; color: #888888; margin-bottom: .7rem;
    }
    #mbanner-overlay .modal-beneficios {
      list-style: none; padding: 0;
      display: flex; flex-direction: column; gap: .4rem; margin-bottom: 1.8rem;
    }
    #mbanner-overlay .modal-beneficios li {
      display: flex; align-items: center; gap: .6rem;
      font-size: .93rem; color: #444444;
    }
    #mbanner-overlay .modal-beneficios li::before {
      content: '✓'; background: #1a6b3c; color: #fff;
      width: 20px; height: 20px; border-radius: 50%;
      display: inline-flex; align-items: center; justify-content: center;
      font-size: .7rem; font-weight: 700; flex-shrink: 0;
    }
    #mbanner-overlay .modal-consumo-texto {
      font-size: .95rem; line-height: 1.75; color: #444444;
      background: #e8f5ee; border-left: 3px solid #2d9458;
      padding: .75rem 1rem; border-radius: 0 8px 8px 0;
    }

    /* ── Bloque vendedor ──────────────────────────────── */
    #mbanner-overlay .mvb-wrap {
      display: flex; align-items: center; justify-content: space-between;
      gap: .75rem; padding: .85rem 1rem; border-radius: 14px;
      background: linear-gradient(135deg, #e8f5ee 0%, #f0faf4 100%);
      border-left: 4px solid var(--vcolor, #1a6b3c);
      box-shadow: 0 2px 10px rgba(0,0,0,.06);
      margin: .6rem 0 1rem; text-decoration: none;
    }
    #mbanner-overlay .mvb-left {
      display: flex; align-items: center; gap: .7rem; min-width: 0; flex: 1;
    }
    #mbanner-overlay .mvb-avatar {
      width: 46px; height: 46px; border-radius: 50%; object-fit: cover;
      flex-shrink: 0; border: 2.5px solid #fff;
      box-shadow: 0 2px 8px rgba(0,0,0,.15);
    }
    #mbanner-overlay .mvb-inicial {
      width: 46px; height: 46px; border-radius: 50%; flex-shrink: 0;
      display: flex; align-items: center; justify-content: center;
      font-family: 'Playfair Display', Georgia, serif;
      font-size: 1.2rem; font-weight: 700; color: #fff;
      border: 2.5px solid #fff; box-shadow: 0 2px 8px rgba(0,0,0,.15);
    }
    #mbanner-overlay .mvb-info {
      display: flex; flex-direction: column; gap: 1px; min-width: 0;
    }
    #mbanner-overlay .mvb-tienda-label {
      font-size: .65rem; font-weight: 700; text-transform: uppercase;
      letter-spacing: .6px; color: #2d9458;
    }
    #mbanner-overlay .mvb-nombre {
      font-size: .97rem; font-weight: 700; color: #1a1a1a;
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    }
    #mbanner-overlay .mvb-ciudad { font-size: .75rem; color: #888888; margin-top: 1px; }
    #mbanner-overlay .mvb-btn {
      display: inline-flex; align-items: center; gap: .35rem; flex-shrink: 0;
      background: var(--vcolor, #1a6b3c); color: #fff;
      border-radius: 50px; padding: .45rem 1rem;
      font-size: .8rem; font-weight: 600;
      transition: opacity .15s, transform .15s; white-space: nowrap;
    }
    #mbanner-overlay .mvb-btn:hover { opacity: .88; transform: translateY(-1px); }

    /* ── Acciones ─────────────────────────────────────── */
    #mbanner-overlay .modal-acciones {
      display: flex; flex-direction: column; gap: .6rem; margin-top: 1.2rem;
    }
    #mbanner-overlay .modal-acciones-fila { display: flex; gap: .6rem; }
    #mbanner-overlay .modal-acciones-fila > * { flex: 1; }

    #mbanner-overlay .btn-compartir-modal,
    #mbanner-overlay .btn-seleccionar-modal {
      display: flex; align-items: center; justify-content: center; gap: .4rem;
      padding: .65rem 1rem; background: transparent; color: #1a6b3c;
      font-family: inherit; font-size: .9rem; font-weight: 600; cursor: pointer;
      border: 2px solid #2d9458; border-radius: 10px; transition: background .15s;
    }
    #mbanner-overlay .btn-compartir-modal:hover,
    #mbanner-overlay .btn-seleccionar-modal:hover { background: #e8f5ee; }

    #mbanner-overlay .btn-whatsapp-modal {
      width: 100%; background: #25D366; color: #fff; border: none;
      border-radius: 12px; padding: .9rem 1.5rem;
      font-family: inherit; font-size: 1rem; font-weight: 600;
      cursor: pointer; display: flex; align-items: center;
      justify-content: center; gap: .6rem;
      transition: background .2s, transform .15s, box-shadow .15s;
    }
    #mbanner-overlay .btn-whatsapp-modal:hover {
      background: #1ebe5a; transform: translateY(-2px);
      box-shadow: 0 8px 24px rgba(37,211,102,.35);
    }

    /* ── Responsive ───────────────────────────────────── */
    @media (max-width: 768px) {
      #mbanner-overlay .modal-nombre { font-size: 1.4rem; }
    }
    @media (max-width: 480px) {
      #mbanner-overlay .modal { border-radius: 16px; max-height: 95vh; }
      #mbanner-overlay .modal-img { height: 220px; border-radius: 16px 16px 0 0; }
      #mbanner-overlay .modal-body { padding: 1.25rem; }
      #mbanner-overlay .modal-nombre { font-size: 1.25rem; }
      #mbanner-overlay .modal-precio { font-size: 1.5rem; }
    }
  `;
  document.head.appendChild(s);
}

// ── Inyectar HTML ─────────────────────────────────────────
function _inyectarHTML() {
  if (document.getElementById("mbanner-overlay")) return;
  const tpl = document.createElement("div");
  tpl.innerHTML = `
    <div id="mbanner-overlay" role="dialog" aria-modal="true">
      <div class="modal">
        <div class="modal-img-wrap">
          <img class="modal-img" id="mbanner-img" src="" alt=""/>
          <button class="modal-cerrar" id="mbanner-cerrar">✕</button>
        </div>
        <div class="modal-body">
          <span class="modal-categoria"  id="mbanner-categoria"></span>
          <h2  class="modal-nombre"      id="mbanner-nombre"></h2>
          <div class="modal-precio"      id="mbanner-precio"></div>
          <div id="mbanner-vendedor-bloque"></div>
          <p   class="modal-desc"        id="mbanner-desc"></p>
          <p   class="modal-beneficios-titulo" id="mbanner-ben-titulo">✦</p>
          <ul  class="modal-beneficios"  id="mbanner-beneficios"></ul>
          <div id="mbanner-consumo-seccion" style="display:none;margin-bottom:1.6rem">
            <p class="modal-beneficios-titulo">🌿 Recomendación</p>
            <p id="mbanner-consumo-texto" class="modal-consumo-texto"></p>
          </div>
          <div class="modal-acciones">
            <div class="modal-acciones-fila">
              <button class="btn-compartir-modal" id="mbanner-compartir">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
                     stroke="currentColor" stroke-width="2.5">
                  <circle cx="18" cy="5" r="3"/>
                  <circle cx="6"  cy="12" r="3"/>
                  <circle cx="18" cy="19" r="3"/>
                  <line x1="8.59"  y1="13.51" x2="15.42" y2="17.49"/>
                  <line x1="15.41" y1="6.51"  x2="8.59"  y2="10.49"/>
                </svg>
                Compartir
              </button>
              <button class="btn-seleccionar-modal" id="mbanner-anadir">🛒 Añadir</button>
            </div>
            <button class="btn-whatsapp-modal" id="mbanner-whatsapp">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
                <path d="M12 0C5.373 0 0 5.373 0 12c0 2.117.549 4.107 1.51 5.833L.057 23.571a.75.75 0 00.92.92l5.738-1.453A11.944 11.944 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22a10 10 0 01-5.17-1.445l-.37-.22-3.828.97.985-3.735-.241-.386A10 10 0 1112 22z"/>
              </svg>
              Comprar por WhatsApp
            </button>
          </div>
        </div>
      </div>
    </div>`;
  document.body.appendChild(tpl.firstElementChild);

  document.getElementById("mbanner-overlay")
    .addEventListener("click", e => { if (e.target.id === "mbanner-overlay") _cerrar(); });
  document.getElementById("mbanner-cerrar")
    .addEventListener("click", _cerrar);
  document.addEventListener("keydown", e => { if (e.key === "Escape") _cerrar(); });
}

function _cerrar() {
  const ov = document.getElementById("mbanner-overlay");
  if (ov) ov.classList.remove("activo");
  document.body.style.overflow = "";
}

// ── API pública ───────────────────────────────────────────
function abrirModalProducto(prod) {
  _inyectarCSS();
  _inyectarHTML();

  const color     = _colorVend(prod);
  // ── Precio: prod.precio (tienda.js) o prod.valor (app.js) ───
  const precioVal = prod.precio || prod.valor || 0;

  // Imagen
  const imgSrc = _resolverImg(prod.imagen || prod.foto || "");
  const imgEl  = document.getElementById("mbanner-img");
  imgEl.src    = imgSrc || "";
  imgEl.alt    = prod.nombre || "";
  imgEl.style.display = imgSrc ? "block" : "none";

  // Textos
  document.getElementById("mbanner-categoria").textContent = _getCat(prod);
  document.getElementById("mbanner-nombre").textContent    = prod.nombre || "";

  const precioEl      = document.getElementById("mbanner-precio");
  precioEl.textContent = _fmt(precioVal);
  precioEl.style.color = color;

  document.getElementById("mbanner-desc").textContent =
    prod.descripcion || prod.desc || "";

  // Beneficios
  const bens = Array.isArray(prod.beneficios) ? prod.beneficios : [];
  document.getElementById("mbanner-beneficios").innerHTML =
    bens.map(b => `<li>${b}</li>`).join("");
  document.getElementById("mbanner-ben-titulo").style.display =
    bens.length ? "" : "none";

  // Recomendación / modo de consumo
  const recom   = prod.recomendacion || prod.modo_consumo || prod.consumo || "";
  const consSec = document.getElementById("mbanner-consumo-seccion");
  const consTxt = document.getElementById("mbanner-consumo-texto");
  consTxt.textContent   = recom;
  consSec.style.display = recom ? "" : "none";

  // Bloque vendedor
  const bloque = document.getElementById("mbanner-vendedor-bloque");
  const v      = _getVendedor(prod);
  if (v && v.nombre) {
    const fotoV  = v.perfil || v.foto || "";
    const imgVnd = fotoV
      ? `<img class="mvb-avatar" src="${_resolverImg(fotoV)}" alt="${v.nombre}"
             onerror="this.style.display='none'">`
      : `<div class="mvb-avatar mvb-inicial" style="background:${color}">${v.nombre[0].toUpperCase()}</div>`;
    bloque.style.display = "block";
    bloque.innerHTML     = `
      <a href="${_urlTienda(prod)}" class="mvb-wrap"
         style="--vcolor:${color}; text-decoration:none;"
         title="Ver todos los productos de ${v.nombre}">
        <div class="mvb-left">
          ${imgVnd}
          <div class="mvb-info">
            <span class="mvb-tienda-label">Vendedor</span>
            <span class="mvb-nombre">${v.nombre}</span>
            ${v.ciudad ? `<div class="mvb-ciudad">📍 ${v.ciudad}</div>` : ""}
          </div>
        </div>
        <span class="mvb-btn">Ver tienda →</span>
      </a>`;
  } else {
    bloque.innerHTML     = "";
    bloque.style.display = "none";
  }

  // WhatsApp
  document.getElementById("mbanner-whatsapp").onclick = () => {
    const wa = _getWA(prod);
    if (!wa) { alert("Este vendedor no tiene WhatsApp registrado."); return; }
    const img = _resolverImg(prod.imagen || prod.foto || "");
    const msg =
      "😊 ¡Hola! Me interesa este producto:\n\n" +
      "✨ *" + (prod.nombre || "") + "*\n" +
      "💵 Precio: *" + _fmt(precioVal) + "*\n" +
      (img ? "🖼️ " + img + "\n\n" : "\n") +
      "¿Está disponible? ¿Hacen envíos? 🙏";
    window.open("https://wa.me/" + wa + "?text=" + encodeURIComponent(msg), "_blank", "noopener");
  };

  // Compartir
  document.getElementById("mbanner-compartir").onclick = () => {
    const url  = window.location.href;
    const text = `🌿 ¡Mira este producto!\n*${prod.nombre}*\n💵 ${_fmt(precioVal)}`;
    if (navigator.share) {
      navigator.share({ title: prod.nombre, text, url }).catch(() => {});
    } else {
      navigator.clipboard?.writeText(`${text}\n👇 ${url}`)
        .then(() => alert("¡Enlace copiado!"))
        .catch(() => {});
    }
  };

  // Añadir / ver en catálogo
  const btnAnadir = document.getElementById("mbanner-anadir");
  if (typeof window._agregarAlCarrito === "function") {
    btnAnadir.textContent = "🛒 Añadir";
    btnAnadir.onclick = () => { window._agregarAlCarrito(prod); _cerrar(); };
  } else {
    btnAnadir.textContent = "🔍 Ver en catálogo";
    btnAnadir.onclick = () => {
      const ghBase = window.location.hostname.includes("github.io") ? "/gistore" : "";
      window.location.href =
        `${window.location.origin}${ghBase}/index.html?q=${encodeURIComponent(prod.nombre || "")}`;
    };
  }

  // Abrir
  document.getElementById("mbanner-overlay").classList.add("activo");
  document.body.style.overflow = "hidden";
}

window._abrirModalProducto = abrirModalProducto;
export { abrirModalProducto };