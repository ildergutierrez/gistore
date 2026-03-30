// ============================================================
//  catalogo.js — Exportar catálogo PDF (Admin)
//  v5 — paginación responsive + footer por página via jsPDF
// ============================================================

// ── Token CSRF ────────────────────────────────────────────
let _token = null;

async function getToken() {
  if (_token) return _token;
  try {
    const resp = await fetch('/../../backend/tokens.php?accion=obtener', { credentials: 'include' });
    const data = await resp.json();
    _token = data.token || '';
  } catch { _token = ''; }
  return _token;
}

async function apiGet(endpoint) {
  const token = await getToken();
  const resp  = await fetch(`../backend/${endpoint}&token=${token}`, { credentials: 'include' });
  const data  = await resp.json();
  if (!data.ok) throw new Error(data.error || 'Error');
  return data.datos;
}

// ── Helpers UI ────────────────────────────────────────────
function fechaHoy() {
  return new Date().toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric' });
}
function formatoPrecio(n) {
  return '$' + Number(n || 0).toLocaleString('es-CO');
}
function btnCargando(btn, cargando) {
  btn.disabled = cargando;
  btn.classList.toggle('cargando', cargando);
}

// ── Init ──────────────────────────────────────────────────
document.getElementById('fechaHoy').textContent = fechaHoy();
document.getElementById('btnSalir').addEventListener('click', async () => {
  const resp = await fetch('../../backend/cerrar.php', { credentials: 'include' });
  const data = await resp.json();
  if (data.ok) window.location.href = '../../index.html';
});

let productos = [], categorias = [], vendedores = [];

// ── Modal de error ─────────────────────────────────────────
function mostrarError(msg) {
  let modal = document.getElementById('_modalErrorCatalogo');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = '_modalErrorCatalogo';
    modal.innerHTML = `
      <div style="position:fixed;inset:0;background:rgba(0,0,0,.55);
        display:flex;align-items:center;justify-content:center;z-index:9999;padding:1rem;">
        <div style="background:#fff;border-radius:16px;padding:2rem 2rem 1.5rem;
          max-width:420px;width:100%;box-shadow:0 20px 60px rgba(0,0,0,.25);
          border-top:4px solid var(--error,#e53e3e);">
          <div style="display:flex;align-items:center;gap:.75rem;margin-bottom:1rem;">
            <span style="font-size:1.5rem;">❌</span>
            <strong style="font-size:1rem;color:var(--texto,#1a2e22);">Error al generar el catálogo</strong>
          </div>
          <p id="_modalErrorMsg" style="font-size:.875rem;color:#555;line-height:1.6;margin:0 0 1.25rem;"></p>
          <button id="_modalErrorBtn" style="background:var(--verde,#1a6b3c);color:#fff;border:none;
            padding:.6rem 1.5rem;border-radius:8px;cursor:pointer;font-size:.875rem;font-weight:600;width:100%;">
            Cerrar
          </button>
        </div>
      </div>`;
    document.body.appendChild(modal);
    document.getElementById('_modalErrorBtn').addEventListener('click', () => {
      modal.style.display = 'none';
    });
  }
  document.getElementById('_modalErrorMsg').textContent = msg;
  modal.style.display = 'block';
}

// ── Cargar datos ───────────────────────────────────────────
async function cargar() {
  try {
    [productos, categorias, vendedores] = await Promise.all([
      apiGet('catalogo.php?accion=obtener'),
      apiGet('categorias.php?accion=obtener'),
      apiGet('vendedores.php?accion=obtener'),
    ]);

    // Parsear beneficios y normalizar activo
    productos = productos.map(p => ({
      ...p,
      activo: !!Number(p.activo),
      beneficios: (() => {
        if (!p.beneficios) return [];
        try { return JSON.parse(p.beneficios); } catch { return p.beneficios.split('\n').filter(Boolean); }
      })(),
    }));

    const sel = document.getElementById('filtroVendedor');
    sel.innerHTML = '<option value="todos">Todos los vendedores</option>' +
      vendedores.map(v => `<option value="${v.id}">${v.nombre}${v.ciudad ? ' · ' + v.ciudad : ''}</option>`).join('');
    renderPrevia();
  } catch(e) {
    console.error(e);
    mostrarError('No se pudieron cargar los productos: ' + e.message);
  }
}

function nombreCategoria(id) {
  const c = categorias.find(x => String(x.id) === String(id));
  return c ? c.nombre : 'Sin categoría';
}

function filtrarOrdenar() {
  const fV = document.getElementById('filtroVendedor').value;
  const fE = document.getElementById('filtroEstado').value;
  const or = document.getElementById('ordenPDF').value;
  let lista = [...productos];
  if (fV !== 'todos')     lista = lista.filter(p => String(p.vendedor_id) === String(fV));
  if (fE === 'activos')   lista = lista.filter(p => p.activo);
  if (fE === 'inactivos') lista = lista.filter(p => !p.activo);
  if (or === 'nombre')    lista.sort((a,b) => a.nombre.localeCompare(b.nombre));
  if (or === 'valor')     lista.sort((a,b) => a.valor - b.valor);
  if (or === 'categoria') lista.sort((a,b) => nombreCategoria(a.categoria_id).localeCompare(nombreCategoria(b.categoria_id)));
  return lista;
}

// ══════════════════════════════════════════════════════════
//  PAGINACIÓN VISTA PREVIA — 30 por página, responsive
// ══════════════════════════════════════════════════════════
const POR_PAG_PREV = 30;
let paginaPrevia   = 1;

function renderPrevia() {
  paginaPrevia = 1;
  renderPreviaPag();
}

function renderPreviaPag() {
  const lista     = filtrarOrdenar();
  const total     = lista.length;
  const totalPags = Math.max(1, Math.ceil(total / POR_PAG_PREV));
  if (paginaPrevia > totalPags) paginaPrevia = totalPags;

  const desde  = (paginaPrevia - 1) * POR_PAG_PREV;
  const pagina = lista.slice(desde, desde + POR_PAG_PREV);

  document.getElementById('totalPrevia').textContent =
    total + ' producto' + (total !== 1 ? 's' : '') +
    (totalPags > 1 ? '  ·  pág. ' + paginaPrevia + ' / ' + totalPags : '');

  const wrap = document.getElementById('previaCatalogo');
  if (!lista.length) {
    wrap.innerHTML = '<p class="vacio-txt">Sin productos.</p>';
    return;
  }

  const vMap = Object.fromEntries(vendedores.map(v => [String(v.id), v]));

  const filas = pagina.map(p => {
    const imgSrc = p.imagen
      ? (p.imagen.startsWith('http') ? p.imagen : resolverImg(p.imagen))
      : null;
    return `<tr>
      <td style="padding:6px 8px"><div style="display:flex;align-items:center;justify-content:center">
        ${imgSrc
          ? `<img src="${imgSrc}" style="width:42px;height:42px;object-fit:cover;border-radius:7px;display:block">`
          : `<span style="font-size:1.4rem;line-height:1">📦</span>`}
      </div></td>
      <td style="padding:6px 8px"><strong style="font-size:.875rem">${p.nombre}</strong></td>
      <td style="padding:6px 8px;color:var(--texto-suave);font-size:.8rem;white-space:nowrap">${vMap[String(p.vendedor_id)]?.nombre || '—'}</td>
      <td style="padding:6px 8px;white-space:nowrap;font-size:.875rem">${formatoPrecio(p.valor)}</td>
      <td style="padding:6px 8px;font-size:.8rem">${nombreCategoria(p.categoria_id)}</td>
      <td style="padding:6px 8px"><span class="badge badge-${p.activo ? 'activo' : 'inactivo'}" style="font-size:.75rem">${p.activo ? 'Activo' : 'Inactivo'}</span></td>
    </tr>`;
  }).join('');

  const paginador = totalPags > 1 ? buildPaginador(paginaPrevia, totalPags, 'previa') : '';

  wrap.innerHTML = `
    <div style="overflow-x:auto;-webkit-overflow-scrolling:touch;">
      <table style="min-width:500px;width:100%">
        <thead><tr>
          <th style="padding:8px;width:54px">Img</th>
          <th style="padding:8px">Nombre</th>
          <th style="padding:8px">Vendedor</th>
          <th style="padding:8px">Valor</th>
          <th style="padding:8px">Categoría</th>
          <th style="padding:8px">Estado</th>
        </tr></thead>
        <tbody>${filas}</tbody>
      </table>
    </div>
    ${paginador}`;

  wrap.querySelectorAll('[data-pag-previa]').forEach(btn => {
    btn.addEventListener('click', () => {
      paginaPrevia = parseInt(btn.dataset.pagPrevia);
      renderPreviaPag();
      wrap.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  });
}

['filtroVendedor', 'filtroEstado', 'ordenPDF'].forEach(id =>
  document.getElementById(id).addEventListener('change', renderPrevia));

// ── Paginador responsive ───────────────────────────────────
function buildPaginador(actual, total, prefijo) {
  if (total <= 1) return '';
  const MAX = window.innerWidth < 500 ? 3 : 5;
  let ini = Math.max(1, actual - Math.floor(MAX / 2));
  let fin = Math.min(total, ini + MAX - 1);
  if (fin - ini < MAX - 1) ini = Math.max(1, fin - MAX + 1);
  const TAM = window.innerWidth < 500 ? '44px' : '36px';
  const FS  = window.innerWidth < 500 ? '.9rem' : '.82rem';
  const s = (on) =>
    `display:inline-flex;align-items:center;justify-content:center;` +
    `min-width:${TAM};height:${TAM};padding:0 8px;border-radius:8px;` +
    `font-size:${FS};font-weight:600;cursor:pointer;` +
    `background:${on ? 'var(--verde)' : 'var(--fondo-2)'};` +
    `color:${on ? '#fff' : 'var(--texto)'};` +
    `border:1.5px solid ${on ? 'var(--verde)' : 'var(--borde)'};` +
    `transition:background .15s;`;
  let btns = '';
  if (actual > 1)
    btns += `<button data-pag-${prefijo}="${actual - 1}" style="${s(false)}">←</button>`;
  for (let i = ini; i <= fin; i++)
    btns += `<button data-pag-${prefijo}="${i}" style="${s(i === actual)}">${i}</button>`;
  if (actual < total)
    btns += `<button data-pag-${prefijo}="${actual + 1}" style="${s(false)}">→</button>`;
  const info = `<span style="font-size:.8rem;color:var(--texto-suave);white-space:nowrap;">Pág. ${actual} / ${total}</span>`;
  return `<div style="display:flex;align-items:center;justify-content:center;gap:6px;margin-top:1.25rem;padding:.75rem 0;flex-wrap:wrap;">${btns}${info}</div>`;
}

// ── Helpers imagen ─────────────────────────────────────────
function resolverImg(url) {
  if (!url) return '';
  if (url.startsWith('http') || url.startsWith('data:')) return url;
  url = url.replace(/\\/g, '/').replace(/^[A-Za-z]:\/.*?\/gistore\//, '');
  if (url.startsWith('img/')) url = '../../' + url;
  return new URL(url, window.location.href).href;
}
async function imgABase64(url) {
  if (!url) return '';
  try {
    const r = await fetch(resolverImg(url));
    if (!r.ok) return '';
    const b = await r.blob();
    return await new Promise(res => {
      const fr = new FileReader();
      fr.onload  = () => res(fr.result);
      fr.onerror = () => res('');
      fr.readAsDataURL(b);
    });
  } catch { return ''; }
}
function shiftColor(hex, amt) {
  try {
    const n = parseInt(hex.replace('#', ''), 16), c = v => Math.max(0, Math.min(255, v));
    return '#' + ((1 << 24) + (c((n >> 16) + amt) << 16) + (c(((n >> 8) & 0xFF) + amt) << 8) + c((n & 0xFF) + amt)).toString(16).slice(1);
  } catch { return hex; }
}
function hexRgba(hex, a) {
  try { const n = parseInt(hex.replace('#', ''), 16); return `rgba(${n >> 16},${(n >> 8) & 0xFF},${n & 0xFF},${a})`; } catch { return hex; }
}
function logoSVG(color) {
  const s = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 140 40"><rect width="140" height="40" rx="8" fill="${color}"/><text x="70" y="26" font-family="Georgia,serif" font-size="17" font-weight="bold" fill="white" text-anchor="middle" letter-spacing="3">GI Store</text></svg>`;
  return 'data:image/svg+xml;base64,' + btoa(s);
}

// ══════════════════════════════════════════════════════════
//  PALETAS POR CATEGORÍA
// ══════════════════════════════════════════════════════════
const PALETAS = {
  salud:   { bg:'#f0faf4', accent:'#1a6b3c', dark:'#0d3d22', card:'#ffffff', texto:'#1a2e22', suave:'#4a7a5a', tag:'#d4edde', tagTxt:'#1a6b3c', grad:'linear-gradient(135deg,#1a6b3c 0%,#0d3d22 100%)', icon:'🌿' },
  vigori:  { bg:'#fff8f0', accent:'#e05a00', dark:'#8a3600', card:'#ffffff', texto:'#2a1a00', suave:'#7a4a20', tag:'#fde8d0', tagTxt:'#e05a00', grad:'linear-gradient(135deg,#e05a00 0%,#8a3600 100%)', icon:'⚡' },
  belleza: { bg:'#fff5f8', accent:'#c2185b', dark:'#880e4f', card:'#ffffff', texto:'#2a0a18', suave:'#7a3050', tag:'#fce4ec', tagTxt:'#c2185b', grad:'linear-gradient(135deg,#c2185b 0%,#880e4f 100%)', icon:'💄' },
  hogar:   { bg:'#fdf6f0', accent:'#9c4a1a', dark:'#5c2a0a', card:'#ffffff', texto:'#2a1a0a', suave:'#7a4a2a', tag:'#fde8d8', tagTxt:'#9c4a1a', grad:'linear-gradient(135deg,#9c4a1a 0%,#5c2a0a 100%)', icon:'🏡' },
  moda:    { bg:'#f9f5ff', accent:'#6a1b9a', dark:'#3a0066', card:'#ffffff', texto:'#1a0a2a', suave:'#5a3a7a', tag:'#ede7f6', tagTxt:'#6a1b9a', grad:'linear-gradient(135deg,#6a1b9a 0%,#3a0066 100%)', icon:'👗' },
  tecnol:  { bg:'#f0f4ff', accent:'#1565c0', dark:'#003080', card:'#ffffff', texto:'#0a1a3a', suave:'#3a5a8a', tag:'#e3f2fd', tagTxt:'#1565c0', grad:'linear-gradient(135deg,#1565c0 0%,#003080 100%)', icon:'💻' },
  librer:  { bg:'#fdf9f0', accent:'#5d4037', dark:'#2e1b0e', card:'#fffef8', texto:'#2a1a0a', suave:'#7a5a3a', tag:'#efebe9', tagTxt:'#5d4037', grad:'linear-gradient(135deg,#5d4037 0%,#2e1b0e 100%)', icon:'📚' },
  default: { bg:'#f5f3ef', accent:'#1a6b3c', dark:'#0d3d22', card:'#ffffff', texto:'#1a2e22', suave:'#4a7a5a', tag:'#d4edde', tagTxt:'#1a6b3c', grad:'linear-gradient(135deg,#1a6b3c 0%,#0d3d22 100%)', icon:'📦' },
};
function getPaleta(catNombre) {
  const n = (catNombre || '').toLowerCase();
  if (n.includes('salud')   || n.includes('bienestar'))                           return PALETAS.salud;
  if (n.includes('vigor')   || n.includes('energia')   || n.includes('natural'))  return PALETAS.vigori;
  if (n.includes('belleza') || n.includes('cuidado')   || n.includes('personal')) return PALETAS.belleza;
  if (n.includes('hogar')   || n.includes('casa'))                                return PALETAS.hogar;
  if (n.includes('moda')    || n.includes('ropa')      || n.includes('accesorio'))return PALETAS.moda;
  if (n.includes('tecno')   || n.includes('electr'))                              return PALETAS.tecnol;
  if (n.includes('libro')   || n.includes('librer')    || n.includes('educ'))     return PALETAS.librer;
  return PALETAS.default;
}

// ══════════════════════════════════════════════════════════
//  TARJETAS PDF
// ══════════════════════════════════════════════════════════
function tarjetaGrande(p, imgSrc, pal, num) {
  const precio = formatoPrecio(p.valor);
  const cat    = nombreCategoria(p.categoria_id);
  const desc   = (p.descripcion || '').substring(0, 210);
  const imgBg  = imgSrc ? 'background:#111' : `background:${pal.grad}`;
  return `
  <div style="width:100%;margin-bottom:18px;border-radius:16px;overflow:hidden;box-shadow:0 8px 32px rgba(0,0,0,.14);background:${pal.card};page-break-inside:avoid;break-inside:avoid;">
    <div style="position:relative;height:290px;${imgBg};overflow:hidden;">
      ${imgSrc ? `<img src="${imgSrc}" style="position:absolute;top:0;left:0;width:100%;height:290px;object-fit:cover;object-position:center top;display:block;"/>` : `<div style="position:absolute;top:0;left:0;width:100%;height:290px;display:flex;align-items:center;justify-content:center;font-size:80px;">${pal.icon}</div>`}
      <div style="position:absolute;bottom:0;left:0;right:0;height:70%;background:linear-gradient(transparent,rgba(0,0,0,.75));"></div>
      <div style="position:absolute;top:14px;left:14px;background:${pal.accent};padding:5px 14px;border-radius:20px;box-shadow:0 2px 8px rgba(0,0,0,.3);">
        <span style="font-size:9px;font-weight:800;letter-spacing:.16em;color:#fff;text-transform:uppercase;">${pal.icon} ${cat}</span>
      </div>
      <div style="position:absolute;top:10px;right:14px;font-family:Georgia,serif;font-size:42px;font-weight:bold;color:rgba(255,255,255,.1);">${String(num).padStart(2,'0')}</div>
      <div style="position:absolute;bottom:56px;left:18px;right:20px;">
        <div style="font-family:Georgia,serif;font-size:20px;font-weight:bold;color:#fff;line-height:1.25;text-shadow:0 2px 10px rgba(0,0,0,.9);">${p.nombre}</div>
      </div>
      <div style="position:absolute;bottom:14px;left:18px;right:18px;display:flex;justify-content:space-between;align-items:center;">
        <div style="font-size:10px;color:rgba(255,255,255,.7);font-family:Arial;">${(p.recomendacion||'').substring(0,60)}</div>
        <div style="background:${pal.accent};color:#fff;padding:8px 20px;border-radius:28px;font-size:22px;font-weight:900;font-family:Georgia,serif;box-shadow:0 4px 16px rgba(0,0,0,.4);flex-shrink:0;margin-left:12px;">${precio}</div>
      </div>
    </div>
    ${desc ? `<div style="padding:14px 20px 16px;border-top:3px solid ${pal.accent};background:${pal.bg};"><p style="font-size:11px;color:${pal.texto};line-height:1.75;margin:0;font-family:Arial,sans-serif;">${desc}</p></div>` : ''}
  </div>`;
}

function tarjetaCompacta(p, imgSrc, pal, num) {
  const precio = formatoPrecio(p.valor);
  const cat    = nombreCategoria(p.categoria_id);
  const desc   = (p.descripcion || '').substring(0, 140);
  const uso    = (p.recomendacion || '').substring(0, 100);
  const imgBg  = imgSrc ? 'background:#111' : `background:${pal.grad}`;
  return `
  <div style="display:flex;height:204px;margin-bottom:14px;border-radius:14px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,.10);background:${pal.card};page-break-inside:avoid;break-inside:avoid;">
    <div style="width:204px;min-width:204px;position:relative;overflow:hidden;${imgBg};flex-shrink:0;">
      ${imgSrc ? `<img src="${imgSrc}" style="position:absolute;top:0;left:0;width:204px;height:204px;object-fit:cover;object-position:center;display:block;"/>` : `<div style="position:absolute;top:0;left:0;width:204px;height:204px;display:flex;align-items:center;justify-content:center;font-size:60px;">${pal.icon}</div>`}
      <div style="position:absolute;top:0;left:0;right:0;bottom:0;background:linear-gradient(to bottom,transparent 45%,rgba(0,0,0,.62));"></div>
      <div style="position:absolute;bottom:0;left:0;right:0;padding:6px 10px;background:${pal.accent};">
        <span style="font-size:8px;font-weight:800;letter-spacing:.14em;color:#fff;text-transform:uppercase;">${cat}</span>
      </div>
      <div style="position:absolute;top:8px;left:9px;font-family:Georgia,serif;font-size:28px;font-weight:bold;color:rgba(255,255,255,.14);">${String(num).padStart(2,'0')}</div>
    </div>
    <div style="flex:1;padding:14px 16px;display:flex;flex-direction:column;justify-content:space-between;overflow:hidden;min-width:0;background:${pal.bg};">
      <div>
        <div style="font-family:Georgia,serif;font-size:15px;font-weight:bold;color:${pal.texto};line-height:1.3;margin-bottom:6px;">${p.nombre}</div>
        <div style="height:2px;background:linear-gradient(to right,${pal.accent},transparent);margin-bottom:8px;border-radius:2px;"></div>
        ${desc ? `<p style="font-size:10.5px;color:${pal.suave};line-height:1.62;margin:0;font-family:Arial,sans-serif;">${desc}</p>` : ''}
      </div>
      <div style="display:flex;justify-content:space-between;align-items:flex-end;gap:10px;">
        ${uso ? `<div style="background:${pal.tag};border-left:3px solid ${pal.accent};padding:5px 8px;border-radius:0 6px 6px 0;flex:1;min-width:0;overflow:hidden;"><div style="font-size:7.5px;font-weight:800;color:${pal.tagTxt};text-transform:uppercase;letter-spacing:.1em;margin-bottom:2px;">Para quién</div><p style="font-size:9.5px;color:${pal.texto};margin:0;line-height:1.45;font-family:Arial,sans-serif;">${uso}</p></div>` : '<div></div>'}
        <div style="background:${pal.accent};color:#fff;padding:9px 14px;border-radius:10px;text-align:center;flex-shrink:0;box-shadow:0 3px 12px ${hexRgba(pal.accent,.4)};">
          <div style="font-size:8px;opacity:.8;letter-spacing:.08em;font-family:Arial;margin-bottom:1px;">PRECIO</div>
          <div style="font-size:18px;font-weight:900;font-family:Georgia,serif;line-height:1.1;">${precio}</div>
        </div>
      </div>
    </div>
  </div>`;
}

function tarjetaVertical(p, imgSrc, pal, num) {
  const precio = formatoPrecio(p.valor);
  const cat    = nombreCategoria(p.categoria_id);
  const desc   = (p.descripcion || '').substring(0, 90);
  const imgBg  = imgSrc ? 'background:#111' : `background:${pal.grad}`;
  return `
  <div style="border-radius:13px;overflow:hidden;box-shadow:0 4px 16px rgba(0,0,0,.10);background:${pal.card};page-break-inside:avoid;break-inside:avoid;">
    <div style="position:relative;height:195px;${imgBg};overflow:hidden;">
      ${imgSrc ? `<img src="${imgSrc}" style="position:absolute;top:0;left:0;width:100%;height:195px;object-fit:cover;object-position:center top;display:block;"/>` : `<div style="position:absolute;top:0;left:0;width:100%;height:195px;display:flex;align-items:center;justify-content:center;font-size:50px;">${pal.icon}</div>`}
      <div style="position:absolute;top:0;left:0;right:0;bottom:0;background:linear-gradient(to bottom,transparent 35%,rgba(0,0,0,.58));"></div>
      <div style="position:absolute;bottom:10px;right:10px;background:${pal.accent};color:#fff;padding:5px 13px;border-radius:20px;font-size:15px;font-weight:900;font-family:Georgia,serif;box-shadow:0 2px 10px ${hexRgba(pal.accent,.55)};">${precio}</div>
      <div style="position:absolute;top:8px;left:9px;font-family:Georgia,serif;font-size:24px;font-weight:bold;color:rgba(255,255,255,.12);">${String(num).padStart(2,'0')}</div>
    </div>
    <div style="padding:10px 12px 13px;background:${pal.bg};">
      <div style="font-size:7.5px;font-weight:800;letter-spacing:.14em;color:${pal.tagTxt};text-transform:uppercase;margin-bottom:3px;">${pal.icon} ${cat}</div>
      <div style="font-family:Georgia,serif;font-size:13px;font-weight:bold;color:${pal.texto};line-height:1.3;margin-bottom:4px;">${p.nombre}</div>
      ${desc ? `<p style="font-size:9.5px;color:${pal.suave};line-height:1.55;margin:0;font-family:Arial,sans-serif;">${desc}</p>` : ''}
    </div>
  </div>`;
}

// ══════════════════════════════════════════════════════════
//  GENERADOR CUERPO PDF
// ══════════════════════════════════════════════════════════
const A_GRANDE   = 355;
const A_COMPACTA = 218;
const A_GRID3    = 275;
const A_GRID2    = 275;
const FOOTER_H     = 54;
const ESPACIO_PAG1 = 1123 - 220 - FOOTER_H - 30;
const ESPACIO_PAG  = 1123 - FOOTER_H - 30;

function generarCuerpo(lista, imagenes) {
  const PATRON = ['G', 'CC', 'VVV', 'CC', 'VV'];
  let pi = 0, li = 0;
  const bloques = [];
  while (li < lista.length) {
    const tipo = PATRON[pi % PATRON.length]; pi++;
    const prd = o => lista[li + o];
    const pal = o => getPaleta(nombreCategoria(prd(o)?.categoria_id));
    const img = o => imagenes[prd(o)?.id] || '';
    const ok  = o => li + o < lista.length;
    if (tipo === 'G' && ok(0)) {
      bloques.push({ alto: A_GRANDE, html: tarjetaGrande(prd(0), img(0), pal(0), li + 1) }); li++;
    } else if (tipo === 'CC') {
      if (ok(1)) { bloques.push({ alto: A_COMPACTA * 2, html: tarjetaCompacta(prd(0),img(0),pal(0),li+1)+tarjetaCompacta(prd(1),img(1),pal(1),li+2) }); li += 2; }
      else       { bloques.push({ alto: A_COMPACTA, html: tarjetaCompacta(prd(0),img(0),pal(0),li+1) }); li++; }
    } else if (tipo === 'VVV') {
      if (ok(2))      { bloques.push({ alto: A_GRID3, html: `<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:14px;margin-bottom:14px;page-break-inside:avoid;break-inside:avoid;">${tarjetaVertical(prd(0),img(0),pal(0),li+1)}${tarjetaVertical(prd(1),img(1),pal(1),li+2)}${tarjetaVertical(prd(2),img(2),pal(2),li+3)}</div>` }); li += 3; }
      else if (ok(1)) { bloques.push({ alto: A_GRID2, html: `<div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:14px;page-break-inside:avoid;break-inside:avoid;">${tarjetaVertical(prd(0),img(0),pal(0),li+1)}${tarjetaVertical(prd(1),img(1),pal(1),li+2)}</div>` }); li += 2; }
      else            { bloques.push({ alto: A_COMPACTA, html: tarjetaCompacta(prd(0),img(0),pal(0),li+1) }); li++; }
    } else if (tipo === 'VV') {
      if (ok(1)) { bloques.push({ alto: A_GRID2, html: `<div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:14px;page-break-inside:avoid;break-inside:avoid;">${tarjetaVertical(prd(0),img(0),pal(0),li+1)}${tarjetaVertical(prd(1),img(1),pal(1),li+2)}</div>` }); li += 2; }
      else       { bloques.push({ alto: A_COMPACTA, html: tarjetaCompacta(prd(0),img(0),pal(0),li+1) }); li++; }
    }
  }
  let html = '', acum = 0, primeraPag = true;
  for (const b of bloques) {
    const limite = primeraPag ? ESPACIO_PAG1 : ESPACIO_PAG;
    if (acum > 0 && acum + b.alto > limite) {
      html += `<div style="page-break-before:always;break-before:page;"></div>`;
      acum = 0; primeraPag = false;
    }
    html += b.html; acum += b.alto;
  }
  return html;
}

// ── Exportar PDF ──────────────────────────────────────────
document.getElementById('btnExportar').addEventListener('click', async () => {
  const btn   = document.getElementById('btnExportar');
  const lista = filtrarOrdenar();
  if (!lista.length) { mostrarError('No hay productos para exportar con los filtros seleccionados.'); return; }
  btnCargando(btn, true);

  try {
    const dominio   = window.location.hostname || 'gistore';
    const hoy       = new Date().toLocaleDateString('es-CO', { year: 'numeric', month: 'long', day: 'numeric' });
    const filtroV   = document.getElementById('filtroVendedor').value;
    const vendSel   = filtroV !== 'todos' ? vendedores.find(v => String(v.id) === String(filtroV)) : null;
    const color     = vendSel?.color || '#1a6b3c';
    const colorDark = shiftColor(color, -38);
    const logo      = logoSVG(color);
    const tituloCat = vendSel ? vendSel.nombre : 'GI Store';
    const subtitulo = vendSel ? (vendSel.ciudad || '') : `${lista.length} productos`;

    const imagenes = {};
    for (let i = 0; i < lista.length; i += 6) {
      await Promise.all(lista.slice(i, i + 6).map(async p => {
        imagenes[p.id] = p.imagen ? await imgABase64(p.imagen) : '';
      }));
    }

    const cuerpo = generarCuerpo(lista, imagenes);

    const footerHtmlStr = `
      <div id="footerCaptura" style="background:linear-gradient(135deg,${color} 0%,${colorDark} 100%);
           padding:13px 36px;box-sizing:border-box;width:794px;">
        <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;">
          <div style="display:flex;align-items:center;gap:12px;">
            <img src="${logo}" style="height:22px;flex-shrink:0;"/>
            <div>
              <div style="font-size:10px;font-weight:700;color:#fff;">${tituloCat}</div>
              <div style="font-size:8.5px;color:rgba(255,255,255,.65);">${lista.length} productos · ${hoy}</div>
            </div>
          </div>
          <div style="text-align:right;">
            <div style="font-size:9.5px;color:rgba(255,255,255,.85);">🌐 ${dominio}</div>
            <div style="font-size:8px;color:rgba(255,255,255,.45);margin-top:1px;">
              © ${new Date().getFullYear()} · Todos los derechos reservados
            </div>
          </div>
        </div>
      </div>`;

    const html = `
    <div style="font-family:Arial,Helvetica,sans-serif;margin:0;padding:0;background:#f5f3ef;">
      <div style="background:linear-gradient(140deg,${color} 0%,${colorDark} 100%);padding:36px 36px 28px;position:relative;overflow:hidden;">
        <div style="position:absolute;right:-60px;top:-60px;width:260px;height:260px;border-radius:50%;background:rgba(255,255,255,.06);"></div>
        <div style="position:relative;display:flex;justify-content:space-between;align-items:flex-start;gap:16px;">
          <div>
            <img src="${logo}" style="height:38px;margin-bottom:14px;display:block;"/>
            <div style="font-size:9px;letter-spacing:.28em;text-transform:uppercase;color:rgba(255,255,255,.58);margin-bottom:7px;">Catálogo oficial de productos</div>
            <h1 style="font-family:Georgia,serif;font-size:26px;color:#fff;margin:0 0 5px;font-weight:bold;line-height:1.15;">${tituloCat}</h1>
            ${subtitulo ? `<p style="font-size:11px;color:rgba(255,255,255,.75);margin:0 0 3px;">${subtitulo}</p>` : ''}
            <p style="font-size:10px;color:rgba(255,255,255,.5);margin:5px 0 0;">${lista.length} producto${lista.length !== 1 ? 's' : ''} &nbsp;·&nbsp; ${hoy}</p>
          </div>
          <div style="background:rgba(255,255,255,.13);border:1px solid rgba(255,255,255,.22);border-radius:12px;padding:13px 17px;text-align:right;min-width:150px;flex-shrink:0;">
            ${vendSel?.whatsapp ? `<div style="font-size:11px;color:#fff;font-weight:700;margin-bottom:5px;">📱 ${vendSel.whatsapp}</div>` : ''}
            <div style="font-size:10px;color:rgba(255,255,255,.8);">🌐 ${dominio}</div>
            ${vendSel?.ciudad ? `<div style="font-size:10px;color:rgba(255,255,255,.6);margin-top:3px;">📍 ${vendSel.ciudad}</div>` : ''}
          </div>
        </div>
        <div style="height:2px;background:linear-gradient(to right,rgba(255,255,255,.38),rgba(255,255,255,.04));margin-top:22px;border-radius:2px;"></div>
      </div>
      <div style="padding:20px 28px 70px;">${cuerpo}</div>
    </div>`;

    const contenedor = document.getElementById('contenidoPDF');
    contenedor.innerHTML = html;
    contenedor.style.display = 'block';

    const footerWrap = document.createElement('div');
    footerWrap.style.cssText = 'position:absolute;left:-9999px;top:0;';
    footerWrap.innerHTML = footerHtmlStr;
    document.body.appendChild(footerWrap);

    const nombre = vendSel ? vendSel.nombre.replace(/\s+/g, '-').toLowerCase() : 'todos';
    const A4_W_MM = 210;
    const A4_H_MM = 297;

    const worker = html2pdf().set({
      margin:      [0, 0, 0, 0],
      filename:    `catalogo-${nombre}.pdf`,
      image:       { type: 'jpeg', quality: .97 },
      html2canvas: { scale: 2, useCORS: true, allowTaint: true, backgroundColor: '#f5f3ef', logging: false },
      jsPDF:       { unit: 'mm', format: 'a4', orientation: 'portrait' },
      pagebreak:   { mode: ['css', 'legacy'] },
    }).from(contenedor);

    const pdf = await worker.toPdf().get('pdf');
    const totalPages = pdf.internal.getNumberOfPages();

    const footerEl = footerWrap.querySelector('#footerCaptura');
    let footerImgData = null;
    let footerH_MM    = 0;
    const h2cFn = typeof html2canvas !== 'undefined' ? html2canvas : null;

    if (h2cFn && footerEl) {
      try {
        const fc = await h2cFn(footerEl, { scale: 2, useCORS: true, allowTaint: true, backgroundColor: null, logging: false });
        footerImgData = fc.toDataURL('image/jpeg', 0.97);
        footerH_MM    = (fc.height / fc.width) * A4_W_MM;
      } catch(e) { console.warn('canvas footer:', e); }
    }

    if (footerImgData && footerH_MM > 0) {
      const yPos = A4_H_MM - footerH_MM;
      for (let pg = 1; pg <= totalPages; pg++) {
        pdf.setPage(pg);
        pdf.addImage(footerImgData, 'JPEG', 0, yPos, A4_W_MM, footerH_MM);
      }
    } else {
      const hexToRgb = h => ({ r: parseInt(h.slice(1,3),16), g: parseInt(h.slice(3,5),16), b: parseInt(h.slice(5,7),16) });
      const rgb = hexToRgb(color.length === 7 ? color : '#1a6b3c');
      for (let pg = 1; pg <= totalPages; pg++) {
        pdf.setPage(pg);
        pdf.setFillColor(rgb.r, rgb.g, rgb.b);
        pdf.rect(0, A4_H_MM - 11, A4_W_MM, 11, 'F');
        pdf.setTextColor(255, 255, 255);
        pdf.setFontSize(7.5);
        pdf.text(`${tituloCat}  ·  ${lista.length} productos  ·  ${hoy}`, 10, A4_H_MM - 4);
        pdf.text(`© ${new Date().getFullYear()} · Todos los derechos reservados`, A4_W_MM - 10, A4_H_MM - 4, { align: 'right' });
      }
    }

    pdf.save(`catalogo-${nombre}.pdf`);
    document.body.removeChild(footerWrap);

  } catch(err) {
    console.error('Error exportar:', err);
    mostrarError('No se pudo generar el PDF.\n\nDetalle técnico: ' + (err?.message || String(err)));
  } finally {
    const c = document.getElementById('contenidoPDF');
    if (c) c.style.display = 'none';
    btnCargando(btn, false);
  }
});

cargar();