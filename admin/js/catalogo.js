// ============================================================
//  catalogo.js — Exportar catálogo PDF (Admin)
//  Puede exportar todos los vendedores o uno específico
// ============================================================
import { cerrarSesion, protegerPagina } from "./auth.js";
import { obtenerProductos, obtenerCategorias, obtenerVendedores } from "./db.js";
import { fechaHoy, formatoPrecio, btnCargando } from "./ui.js";

protegerPagina("../index.html");

document.getElementById("fechaHoy").textContent = fechaHoy();
document.getElementById("btnSalir").addEventListener("click", async () => {
  await cerrarSesion(); window.location.href = "../index.html";
});

let productos  = [];
let categorias = [];
let vendedores = [];

async function cargar() {
  try {
    [productos, categorias, vendedores] = await Promise.all([
      obtenerProductos(),
      obtenerCategorias(),
      obtenerVendedores(),
    ]);
    // Llenar selector de vendedores
    const sel = document.getElementById("filtroVendedor");
    sel.innerHTML = '<option value="todos">Todos los vendedores</option>' +
      vendedores.map(v => `<option value="${v.id}">${v.nombre}${v.ciudad ? " · " + v.ciudad : ""}</option>`).join("");
    renderPrevia();
  } catch (e) { console.error(e); }
}

function nombreCategoria(id) {
  const c = categorias.find(x => x.id === id);
  return c ? c.nombre : "Sin categoría";
}
function nombreVendedor(id) {
  const v = vendedores.find(x => x.id === id);
  return v ? v.nombre : "—";
}

function filtrarOrdenar() {
  const filtroV = document.getElementById("filtroVendedor").value;
  const filtroE = document.getElementById("filtroEstado").value;
  const orden   = document.getElementById("ordenPDF").value;

  let lista = [...productos];
  if (filtroV !== "todos")     lista = lista.filter(p => p.vendedor_id === filtroV);
  if (filtroE === "activos")   lista = lista.filter(p => p.activo);
  if (filtroE === "inactivos") lista = lista.filter(p => !p.activo);
  if (orden === "nombre")    lista.sort((a,b) => a.nombre.localeCompare(b.nombre));
  if (orden === "valor")     lista.sort((a,b) => a.valor - b.valor);
  if (orden === "categoria") lista.sort((a,b) => nombreCategoria(a.categoria_id).localeCompare(nombreCategoria(b.categoria_id)));
  return lista;
}

function renderPrevia() {
  const lista = filtrarOrdenar();
  document.getElementById("totalPrevia").textContent = lista.length + " productos";
  const wrap = document.getElementById("previaCatalogo");
  if (!lista.length) { wrap.innerHTML = '<p class="vacio-txt">Sin productos.</p>'; return; }
  wrap.innerHTML = `
    <table>
      <thead><tr><th>Img</th><th>Nombre</th><th>Vendedor</th><th>Valor</th><th>Categoría</th><th>Estado</th></tr></thead>
      <tbody>
        ${lista.map(p => `<tr>
          <td>${p.imagen ? `<img src="${resolverImg(p.imagen)}" style="width:40px;height:40px;object-fit:cover;border-radius:6px">` : "📦"}</td>
          <td><strong>${p.nombre}</strong></td>
          <td style="font-size:.8rem;color:var(--texto-suave)">${nombreVendedor(p.vendedor_id)}</td>
          <td>${formatoPrecio(p.valor)}</td>
          <td>${nombreCategoria(p.categoria_id)}</td>
          <td><span class="badge badge-${p.activo?'activo':'inactivo'}">${p.activo?'Activo':'Inactivo'}</span></td>
        </tr>`).join("")}
      </tbody>
    </table>`;
}

["filtroVendedor","filtroEstado","ordenPDF"].forEach(id =>
  document.getElementById(id).addEventListener("change", renderPrevia));

// ── Normalizar ruta imagen (local o Cloudinary) ────────────
function resolverImg(url) {
  if (!url) return "";
  if (url.startsWith("http://") || url.startsWith("https://") || url.startsWith("data:")) return url;
  url = url.replace(/\\/g, "/");                          // barras Windows
  url = url.replace(/^[A-Za-z]:\/.*?\/gistore\//, ""); // ruta absoluta Windows
  if (url.startsWith("img/")) url = "../../" + url;        // relativa desde admin/pages/
  return new URL(url, window.location.href).href;
}

// ── Helpers PDF ────────────────────────────────────────────
async function imgABase64(url) {
  if (!url) return "";
  try {
    const urlFinal = resolverImg(url);
    if (!urlFinal) return "";
    const r = await fetch(urlFinal);
    if (!r.ok) return "";
    const b = await r.blob();
    return await new Promise(res => {
      const fr = new FileReader();
      fr.onload = () => res(fr.result); fr.onerror = () => res("");
      fr.readAsDataURL(b);
    });
  } catch { return ""; }
}
function logoSVG(color) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 38">
    <rect width="120" height="38" rx="8" fill="${color}"/>
    <text x="60" y="24" font-family="Georgia,serif" font-size="16" font-weight="bold"
          fill="white" text-anchor="middle" letter-spacing="3">GI Store</text></svg>`;
  return "data:image/svg+xml;base64," + btoa(svg);
}
function shiftColor(hex, amt) {
  try {
    const n = parseInt(hex.replace("#",""),16);
    const c = v => Math.max(0,Math.min(255,v));
    return "#"+((1<<24)+(c((n>>16)+amt)<<16)+(c(((n>>8)&0xFF)+amt)<<8)+c((n&0xFF)+amt)).toString(16).slice(1);
  } catch { return hex; }
}
function hexRgba(hex, a) {
  try { const n=parseInt(hex.replace("#",""),16); return `rgba(${n>>16},${(n>>8)&0xFF},${n&0xFF},${a})`; }
  catch { return hex; }
}

function tarjetaPar(p, imgSrc, color, num, vendNombre) {
  const precio=formatoPrecio(p.valor), cat=nombreCategoria(p.categoria_id).toUpperCase();
  const desc=(p.descripcion||"").substring(0,200), uso=(p.recomendacion||"").substring(0,160);
  return `<div style="display:flex;height:220px;margin-bottom:20px;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,.13);page-break-inside:avoid;background:#fff;">
    <div style="width:220px;min-width:220px;position:relative;overflow:hidden;background:${imgSrc?'#111':shiftColor(color,60)};">
      ${imgSrc?`<img src="${imgSrc}" style="width:100%;height:100%;object-fit:cover;display:block;opacity:.92"/>`:`<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;font-size:56px">📦</div>`}
      <div style="position:absolute;top:12px;left:12px;font-family:Georgia,serif;font-size:28px;font-weight:bold;color:rgba(255,255,255,.35)">${String(num).padStart(2,"0")}</div>
      <div style="position:absolute;bottom:0;left:0;right:0;padding:28px 12px 10px;background:linear-gradient(transparent,rgba(0,0,0,.6));">
        <span style="font-size:9px;font-weight:800;letter-spacing:.15em;color:rgba(255,255,255,.9);text-transform:uppercase;">${cat}</span>
      </div>
    </div>
    <div style="flex:1;padding:18px 20px;display:flex;flex-direction:column;justify-content:space-between;">
      <div>
        <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px;gap:10px;">
          <div>
            <div style="font-family:Georgia,serif;font-size:16px;font-weight:bold;color:#1a1a1a;line-height:1.25">${p.nombre}</div>
            <div style="font-size:9.5px;color:#7a9e86;margin-top:2px">${vendNombre}</div>
          </div>
          <div style="background:${color};color:#fff;padding:5px 12px;border-radius:24px;font-size:13px;font-weight:700;white-space:nowrap;flex-shrink:0;box-shadow:0 2px 8px ${hexRgba(color,.35)}">${precio}</div>
        </div>
        <div style="height:2px;background:linear-gradient(to right,${color},transparent);margin-bottom:10px;border-radius:2px;"></div>
        ${desc?`<p style="font-size:11px;color:#444;line-height:1.65;margin:0 0 8px;font-family:Arial,sans-serif;">${desc}</p>`:""}
      </div>
      ${uso?`<div style="background:${hexRgba(color,.07)};border-left:3px solid ${color};border-radius:0 8px 8px 0;padding:7px 10px;">
        <div style="font-size:8px;font-weight:800;color:${color};text-transform:uppercase;letter-spacing:.1em;margin-bottom:3px;">✦ Modo de uso</div>
        <p style="font-size:10px;color:#333;margin:0;line-height:1.55;font-family:Arial,sans-serif;">${uso}</p>
      </div>`:""}
    </div>
  </div>`;
}

function tarjetaImpar(p, imgSrc, color, num, vendNombre) {
  const precio=formatoPrecio(p.valor), cat=nombreCategoria(p.categoria_id).toUpperCase();
  const desc=(p.descripcion||"").substring(0,200), uso=(p.recomendacion||"").substring(0,160);
  return `<div style="display:flex;height:220px;margin-bottom:20px;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,.13);page-break-inside:avoid;background:#fff;">
    <div style="flex:1;padding:18px 20px;display:flex;flex-direction:column;justify-content:space-between;">
      <div>
        <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px;gap:10px;">
          <div>
            <div style="font-family:Georgia,serif;font-size:16px;font-weight:bold;color:#1a1a1a;line-height:1.25">${p.nombre}</div>
            <div style="font-size:9.5px;color:#7a9e86;margin-top:2px">${vendNombre}</div>
          </div>
          <div style="background:${color};color:#fff;padding:5px 12px;border-radius:24px;font-size:13px;font-weight:700;white-space:nowrap;flex-shrink:0;box-shadow:0 2px 8px ${hexRgba(color,.35)}">${precio}</div>
        </div>
        <div style="height:2px;background:linear-gradient(to right,${color},transparent);margin-bottom:10px;border-radius:2px;"></div>
        ${desc?`<p style="font-size:11px;color:#444;line-height:1.65;margin:0 0 8px;font-family:Arial,sans-serif;">${desc}</p>`:""}
      </div>
      ${uso?`<div style="background:${hexRgba(color,.07)};border-left:3px solid ${color};border-radius:0 8px 8px 0;padding:7px 10px;">
        <div style="font-size:8px;font-weight:800;color:${color};text-transform:uppercase;letter-spacing:.1em;margin-bottom:3px;">✦ Modo de uso</div>
        <p style="font-size:10px;color:#333;margin:0;line-height:1.55;font-family:Arial,sans-serif;">${uso}</p>
      </div>`:""}
    </div>
    <div style="width:220px;min-width:220px;position:relative;overflow:hidden;background:${imgSrc?'#111':shiftColor(color,60)};">
      ${imgSrc?`<img src="${imgSrc}" style="width:100%;height:100%;object-fit:cover;display:block;opacity:.92"/>`:`<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;font-size:56px">📦</div>`}
      <div style="position:absolute;top:12px;right:12px;font-family:Georgia,serif;font-size:28px;font-weight:bold;color:rgba(255,255,255,.35)">${String(num).padStart(2,"0")}</div>
      <div style="position:absolute;bottom:0;left:0;right:0;padding:28px 12px 10px;background:linear-gradient(transparent,rgba(0,0,0,.6));">
        <span style="font-size:9px;font-weight:800;letter-spacing:.15em;color:rgba(255,255,255,.9);text-transform:uppercase;">${cat}</span>
      </div>
    </div>
  </div>`;
}

// ── Exportar ──────────────────────────────────────────────
document.getElementById("btnExportar").addEventListener("click", async () => {
  const btn   = document.getElementById("btnExportar");
  const lista = filtrarOrdenar();
  if (!lista.length) { alert("No hay productos para exportar."); return; }

  btnCargando(btn, true);

  const dominio = (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1")
    ? "gistore.com" : window.location.hostname;
  const hoy     = new Date().toLocaleDateString("es-CO", {year:"numeric",month:"long",day:"numeric"});

  // Determinar vendedor(es) para el encabezado
  const filtroV   = document.getElementById("filtroVendedor").value;
  const vendSel   = filtroV !== "todos" ? vendedores.find(v => v.id === filtroV) : null;
  const color     = vendSel?.color || "#1a6b3c";
  const logo      = logoSVG(color);
  const tituloCat = vendSel ? vendSel.nombre : "GI Store — Todos los productos";
  const subtitulo = vendSel ? (vendSel.ciudad || "") : `${vendedores.length} vendedores · ${lista.length} productos`;

  // Convertir imágenes
  const imagenes = {};
  for (let i = 0; i < lista.length; i += 6) {
    await Promise.all(lista.slice(i, i+6).map(async p => {
      imagenes[p.id] = p.imagen ? await imgABase64(p.imagen) : "";
    }));
  }

  const tarjetas = lista.map((p, i) => {
    const vend = vendedores.find(v => v.id === p.vendedor_id);
    const col  = vend?.color || color;
    return i % 2 === 0
      ? tarjetaPar(p,   imagenes[p.id], col, i+1, vend?.nombre || "")
      : tarjetaImpar(p, imagenes[p.id], col, i+1, vend?.nombre || "");
  }).join("");

  const html = `<div style="font-family:Arial,Helvetica,sans-serif;margin:0;padding:0;background:#f9f7f4;">
    <div style="background:linear-gradient(150deg,${color} 0%,${shiftColor(color,-30)} 100%);padding:36px 40px 28px;position:relative;overflow:hidden;">
      <div style="position:absolute;right:-60px;top:-60px;width:280px;height:280px;border-radius:50%;background:rgba(255,255,255,.07)"></div>
      <div style="display:flex;justify-content:space-between;align-items:flex-start;position:relative;">
        <div>
          <img src="${logo}" style="height:36px;margin-bottom:14px;display:block;"/>
          <div style="font-size:9px;letter-spacing:.25em;text-transform:uppercase;color:rgba(255,255,255,.65);margin-bottom:6px;">Catálogo oficial de productos</div>
          <h1 style="font-family:Georgia,serif;font-size:26px;color:#fff;margin:0 0 6px;font-weight:bold;">${tituloCat}</h1>
          ${subtitulo?`<p style="font-size:12px;color:rgba(255,255,255,.75);margin:0 0 4px;">${subtitulo}</p>`:""}
          <p style="font-size:10px;color:rgba(255,255,255,.55);margin:4px 0 0;">${lista.length} producto${lista.length!==1?"s":""} · ${hoy}</p>
        </div>
        <div style="background:rgba(255,255,255,.15);border-radius:12px;padding:14px 18px;text-align:right;border:1px solid rgba(255,255,255,.25);">
          ${vendSel?.whatsapp?`<div style="font-size:11px;color:#fff;margin-bottom:6px;font-weight:600;">📱 ${vendSel.whatsapp}</div>`:""}
          <div style="font-size:10px;color:rgba(255,255,255,.8);">🌐 ${dominio}</div>
        </div>
      </div>
      <div style="height:1px;background:rgba(255,255,255,.2);margin-top:22px;"></div>
    </div>
    <div style="padding:24px 28px 8px;">${tarjetas}</div>
    <div style="background:linear-gradient(135deg,${color} 0%,${shiftColor(color,-25)} 100%);padding:16px 40px;display:flex;justify-content:space-between;align-items:center;">
      <div style="display:flex;align-items:center;gap:14px;">
        <img src="${logo}" style="height:26px;"/>
        <div>
          <div style="font-size:11px;font-weight:700;color:#fff;">${tituloCat}</div>
          ${subtitulo?`<div style="font-size:9.5px;color:rgba(255,255,255,.7);">${subtitulo}</div>`:""}
        </div>
      </div>
      <div style="text-align:right;">
        <div style="font-size:10px;color:rgba(255,255,255,.8);">🌐 ${dominio}</div>
        <div style="font-size:9px;color:rgba(255,255,255,.5);margin-top:2px;">© ${new Date().getFullYear()} · Todos los derechos reservados</div>
      </div>
    </div>
  </div>`;

  const contenedor = document.getElementById("contenidoPDF");
  contenedor.innerHTML = html;
  contenedor.style.display = "block";
  const nombre = vendSel ? vendSel.nombre.replace(/\s+/g,"-").toLowerCase() : "todos";
  const opciones = {
    margin: [0,0,0,0], filename: `catalogo-${nombre}.pdf`,
    image: {type:"jpeg",quality:.96},
    html2canvas: {scale:2, useCORS:true, allowTaint:true, backgroundColor:"#f9f7f4"},
    jsPDF: {unit:"mm",format:"a4",orientation:"portrait"},
  };
  try {
    await html2pdf().set(opciones).from(contenedor).save();
  } finally {
    contenedor.style.display = "none";
    btnCargando(btn, false);
  }
});

cargar();