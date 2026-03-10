// ============================================================
//  catalogo.js — Catálogo PDF estilo revista editorial
// ============================================================
import { cerrarSesion, protegerPagina } from "./auth.js";
import { obtenerVendedorPorUid, obtenerMisProductos, obtenerCategorias,
         obtenerMembresiaVendedor, membresiaVigente } from "./db.js";
import { fechaHoy, formatoPrecio, btnCargando } from "./ui.js";
import { auth } from "./firebase.js";
import { onAuthStateChanged }
  from "https://www.gstatic.com/firebasejs/12.10.0/firebase-auth.js";

protegerPagina("../index.html");

let productos  = [];
let categorias = [];
let vendedor   = null;

function el(id) { return document.getElementById(id); }

async function cargar(user) {
  try {
    if (!user) return;
    vendedor = await obtenerVendedorPorUid(user.uid);
    if (!vendedor) return;
    if (el("vendedorNombre")) el("vendedorNombre").textContent = vendedor.nombre;
    [productos, categorias] = await Promise.all([
      obtenerMisProductos(vendedor.id),
      obtenerCategorias(),
    ]);
    renderPrevia();
  } catch (e) { console.error(e); }
}

function nombreCategoria(id) {
  const c = categorias.find(x => x.id === id);
  return c ? c.nombre : "Sin categoría";
}

function filtrarOrdenar() {
  const filtro = el("filtroEstado") ? el("filtroEstado").value : "todos";
  const orden  = el("ordenPDF")     ? el("ordenPDF").value     : "nombre";
  let lista = [...productos];
  if (filtro === "activos")   lista = lista.filter(p => p.activo);
  if (filtro === "inactivos") lista = lista.filter(p => !p.activo);
  if (orden === "nombre")    lista.sort((a,b) => a.nombre.localeCompare(b.nombre));
  if (orden === "valor")     lista.sort((a,b) => a.valor - b.valor);
  if (orden === "categoria") lista.sort((a,b) => nombreCategoria(a.categoria_id).localeCompare(nombreCategoria(b.categoria_id)));
  return lista;
}

function renderPrevia() {
  const lista = filtrarOrdenar();
  if (el("totalPrevia")) el("totalPrevia").textContent = lista.length + " productos";
  const wrap = el("previaCatalogo");
  if (!wrap) return;
  if (!lista.length) {
    wrap.innerHTML = '<p class="vacio-txt">Sin productos para mostrar.</p>';
    return;
  }
  wrap.innerHTML = `
    <table>
      <thead>
        <tr><th>Imagen</th><th>Nombre</th><th>Valor</th><th>Categoría</th><th>Estado</th></tr>
      </thead>
      <tbody>
        ${lista.map(p => `
          <tr>
            <td>${p.imagen
              ? `<img src="${p.imagen}" style="width:44px;height:44px;object-fit:cover;border-radius:8px;border:1.5px solid var(--borde)">`
              : `<div style="width:44px;height:44px;border-radius:8px;background:var(--verde-claro);display:flex;align-items:center;justify-content:center">📦</div>`
            }</td>
            <td><strong>${p.nombre}</strong></td>
            <td>${formatoPrecio(p.valor)}</td>
            <td>${nombreCategoria(p.categoria_id)}</td>
            <td><span class="badge badge-${p.activo?'activo':'inactivo'}">${p.activo?'Activo':'Inactivo'}</span></td>
          </tr>`).join("")}
      </tbody>
    </table>`;
}

if (el("filtroEstado")) el("filtroEstado").addEventListener("change", renderPrevia);
if (el("ordenPDF"))     el("ordenPDF").addEventListener("change",    renderPrevia);

// ── Imagen a base64 ───────────────────────────────────────
function resolverImg(url) {
  if (!url) return "";
  if (url.startsWith("http://") || url.startsWith("https://") || url.startsWith("data:")) return url;
  url = url.replace(/\\/g, "/");
  url = url.replace(/^[A-Za-z]:\/.*?\/gistore\//, "");
  if (url.startsWith("img/")) url = "../../" + url;
  return new URL(url, window.location.href).href;
}

async function imgABase64(url) {
  if (!url) return "";
  try {
    const urlFinal = resolverImg(url);
    if (!urlFinal) return "";
    const r = await fetch(urlFinal);
    if (!r.ok) return "";
    const b = await r.blob();
    return await new Promise((res) => {
      const fr = new FileReader();
      fr.onload  = () => res(fr.result);
      fr.onerror = () => res("");
      fr.readAsDataURL(b);
    });
  } catch { return ""; }
}

function logoSVG(color) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 38">
    <rect width="120" height="38" rx="8" fill="${color}"/>
    <text x="60" y="24" font-family="Georgia,serif" font-size="16" font-weight="bold"
          fill="white" text-anchor="middle" letter-spacing="3">GI Store</text>
  </svg>`;
  return "data:image/svg+xml;base64," + btoa(svg);
}

function shiftColor(hex, amt) {
  try {
    const n = parseInt(hex.replace("#",""),16);
    const clamp = v => Math.max(0, Math.min(255, v));
    const r = clamp((n >> 16) + amt);
    const g = clamp(((n >> 8) & 0xFF) + amt);
    const b = clamp((n & 0xFF) + amt);
    return "#" + ((1<<24)+(r<<16)+(g<<8)+b).toString(16).slice(1);
  } catch { return hex; }
}

function hexRgba(hex, a) {
  try {
    const n = parseInt(hex.replace("#",""),16);
    return `rgba(${n>>16},${(n>>8)&0xFF},${n&0xFF},${a})`;
  } catch { return hex; }
}

function tarjetaPar(p, imgSrc, color, num) {
  const precio = formatoPrecio(p.valor);
  const cat    = nombreCategoria(p.categoria_id).toUpperCase();
  const desc   = (p.descripcion   || "").substring(0, 200);
  const uso    = (p.recomendacion || "").substring(0, 160);
  const numStr = String(num).padStart(2,"0");

  return `
  <div style="
    display:flex; height:220px; margin-bottom:20px;
    border-radius:16px; overflow:hidden;
    box-shadow:0 4px 24px rgba(0,0,0,.13);
    page-break-inside:avoid; background:#fff;
  ">
    <div style="
      width:220px; min-width:220px; position:relative; overflow:hidden;
      background:${imgSrc ? '#111' : shiftColor(color,60)};
    ">
      ${imgSrc
        ? `<img src="${imgSrc}" style="width:100%;height:100%;object-fit:cover;display:block;opacity:.92"/>`
        : `<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;font-size:56px">📦</div>`
      }
      <div style="
        position:absolute; top:12px; left:12px;
        font-family:Georgia,serif; font-size:28px; font-weight:bold;
        color:rgba(255,255,255,.35); line-height:1;
      ">${numStr}</div>
      <div style="
        position:absolute; bottom:0; left:0; right:0;
        padding:28px 12px 10px;
        background:linear-gradient(transparent, rgba(0,0,0,.6));
      ">
        <span style="
          font-size:9px; font-weight:800; letter-spacing:.15em;
          color:rgba(255,255,255,.9); text-transform:uppercase;
        ">${cat}</span>
      </div>
    </div>
    <div style="flex:1; padding:20px 22px; display:flex; flex-direction:column; justify-content:space-between; background:#fff;">
      <div>
        <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:10px; gap:10px;">
          <h2 style="
            font-family:Georgia,serif; font-size:17px; font-weight:bold;
            color:#1a1a1a; margin:0; line-height:1.25; flex:1;
          ">${p.nombre}</h2>
          <div style="
            background:${color}; color:#fff;
            padding:6px 14px; border-radius:24px;
            font-size:13px; font-weight:700;
            white-space:nowrap; flex-shrink:0;
            box-shadow:0 2px 8px ${hexRgba(color,.35)};
          ">${precio}</div>
        </div>
        <div style="height:2px; background:linear-gradient(to right,${color},transparent); margin-bottom:10px; border-radius:2px;"></div>
        ${desc ? `<p style="
          font-size:11.5px; color:#444; line-height:1.65; margin:0 0 10px;
          font-family:Arial,sans-serif;
        ">${desc}</p>` : ""}
      </div>
      ${uso ? `
      <div style="
        background:${hexRgba(color,.07)};
        border-left:3px solid ${color};
        border-radius:0 8px 8px 0;
        padding:8px 12px;
      ">
        <div style="font-size:8.5px; font-weight:800; color:${color}; text-transform:uppercase; letter-spacing:.1em; margin-bottom:3px;">✦ Modo de uso</div>
        <p style="font-size:10.5px; color:#333; margin:0; line-height:1.55; font-family:Arial,sans-serif;">${uso}</p>
      </div>` : ""}
    </div>
  </div>`;
}

function tarjetaImpar(p, imgSrc, color, num) {
  const precio = formatoPrecio(p.valor);
  const cat    = nombreCategoria(p.categoria_id).toUpperCase();
  const desc   = (p.descripcion   || "").substring(0, 200);
  const uso    = (p.recomendacion || "").substring(0, 160);
  const numStr = String(num).padStart(2,"0");

  return `
  <div style="
    display:flex; height:220px; margin-bottom:20px;
    border-radius:16px; overflow:hidden;
    box-shadow:0 4px 24px rgba(0,0,0,.13);
    page-break-inside:avoid; background:#fff;
  ">
    <div style="flex:1; padding:20px 22px; display:flex; flex-direction:column; justify-content:space-between; background:#fff;">
      <div>
        <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:10px; gap:10px;">
          <h2 style="
            font-family:Georgia,serif; font-size:17px; font-weight:bold;
            color:#1a1a1a; margin:0; line-height:1.25; flex:1;
          ">${p.nombre}</h2>
          <div style="
            background:${color}; color:#fff;
            padding:6px 14px; border-radius:24px;
            font-size:13px; font-weight:700;
            white-space:nowrap; flex-shrink:0;
            box-shadow:0 2px 8px ${hexRgba(color,.35)};
          ">${precio}</div>
        </div>
        <div style="height:2px; background:linear-gradient(to right,${color},transparent); margin-bottom:10px; border-radius:2px;"></div>
        ${desc ? `<p style="
          font-size:11.5px; color:#444; line-height:1.65; margin:0 0 10px;
          font-family:Arial,sans-serif;
        ">${desc}</p>` : ""}
      </div>
      ${uso ? `
      <div style="
        background:${hexRgba(color,.07)};
        border-left:3px solid ${color};
        border-radius:0 8px 8px 0;
        padding:8px 12px;
      ">
        <div style="font-size:8.5px; font-weight:800; color:${color}; text-transform:uppercase; letter-spacing:.1em; margin-bottom:3px;">✦ Modo de uso</div>
        <p style="font-size:10.5px; color:#333; margin:0; line-height:1.55; font-family:Arial,sans-serif;">${uso}</p>
      </div>` : ""}
    </div>
    <div style="
      width:220px; min-width:220px; position:relative; overflow:hidden;
      background:${imgSrc ? '#111' : shiftColor(color,60)};
    ">
      ${imgSrc
        ? `<img src="${imgSrc}" style="width:100%;height:100%;object-fit:cover;display:block;opacity:.92"/>`
        : `<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;font-size:56px">📦</div>`
      }
      <div style="
        position:absolute; top:12px; right:12px;
        font-family:Georgia,serif; font-size:28px; font-weight:bold;
        color:rgba(255,255,255,.35); line-height:1;
      ">${numStr}</div>
      <div style="
        position:absolute; bottom:0; left:0; right:0;
        padding:28px 12px 10px;
        background:linear-gradient(transparent, rgba(0,0,0,.6));
      ">
        <span style="font-size:9px; font-weight:800; letter-spacing:.15em; color:rgba(255,255,255,.9); text-transform:uppercase;">${cat}</span>
      </div>
    </div>
  </div>`;
}

// ── Exportar PDF ──────────────────────────────────────────
if (el("btnExportar")) {
  el("btnExportar").addEventListener("click", async () => {
    const btn   = el("btnExportar");
    const lista = filtrarOrdenar();
    if (!lista.length) { alert("No hay productos para exportar."); return; }

    const mem = await obtenerMembresiaVendedor(vendedor.id);
    if (!membresiaVigente(mem)) {
      mostrarAlertaMembresia(mem);
      return;
    }

    btnCargando(btn, true);

    const dominio = (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1" || window.location.hostname === "127.0.0.7")
      ? "gistore.com"
      : window.location.hostname;

    const hoy   = new Date().toLocaleDateString("es-CO", { year:"numeric", month:"long", day:"numeric" });
    const color = vendedor.color || "#1a6b3c";
    const logo  = logoSVG(color);

    const imagenes = {};
    for (let i = 0; i < lista.length; i += 6) {
      await Promise.all(lista.slice(i, i+6).map(async p => {
        imagenes[p.id] = p.imagen ? await imgABase64(p.imagen) : "";
      }));
    }

    const tarjetas = lista.map((p, i) =>
      i % 2 === 0
        ? tarjetaPar(p,   imagenes[p.id], color, i+1)
        : tarjetaImpar(p, imagenes[p.id], color, i+1)
    ).join("");

    const html = `
  <div style="font-family:Arial,Helvetica,sans-serif; margin:0; padding:0; background:#f9f7f4;">
    <div style="
      background:linear-gradient(150deg, ${color} 0%, ${shiftColor(color,-30)} 100%);
      padding:36px 40px 28px; position:relative; overflow:hidden;
    ">
      <div style="position:absolute; right:-60px; top:-60px; width:280px; height:280px; border-radius:50%; background:rgba(255,255,255,.07);"></div>
      <div style="position:absolute; right:40px; bottom:-80px; width:180px; height:180px; border-radius:50%; background:rgba(255,255,255,.05);"></div>
      <div style="display:flex; justify-content:space-between; align-items:flex-start; position:relative;">
        <div>
          <img src="${logo}" style="height:36px; margin-bottom:14px; display:block;"/>
          <div style="font-size:9px; letter-spacing:.25em; text-transform:uppercase; color:rgba(255,255,255,.65); margin-bottom:6px;">Catálogo oficial de productos</div>
          <h1 style="font-family:Georgia,serif; font-size:28px; color:#fff; margin:0 0 6px; font-weight:bold; line-height:1.15; text-shadow:0 2px 12px rgba(0,0,0,.2);">${vendedor.nombre}</h1>
          ${vendedor.ciudad ? `<p style="font-size:12px; color:rgba(255,255,255,.75); margin:0 0 4px;">📍 ${vendedor.ciudad}</p>` : ""}
          <p style="font-size:10px; color:rgba(255,255,255,.55); margin:6px 0 0;">${lista.length} producto${lista.length!==1?"s":""} · ${hoy}</p>
        </div>
        <div style="background:rgba(255,255,255,.15); backdrop-filter:blur(4px); border-radius:12px; padding:14px 18px; text-align:right; border:1px solid rgba(255,255,255,.25);">
          ${vendedor.whatsapp ? `<div style="font-size:11px; color:#fff; margin-bottom:6px; font-weight:600;">📱 ${vendedor.whatsapp}</div>` : ""}
          <div style="font-size:10px; color:rgba(255,255,255,.8);">🌐 ${dominio}</div>
        </div>
      </div>
      <div style="height:1px; background:rgba(255,255,255,.2); margin-top:22px; position:relative;">
        <div style="position:absolute; left:0; top:-3px; width:60px; height:7px; border-radius:4px; background:rgba(255,255,255,.5);"></div>
      </div>
    </div>
    <div style="padding:24px 28px 8px;">${tarjetas}</div>
    <div style="background:linear-gradient(135deg, ${color} 0%, ${shiftColor(color,-25)} 100%); padding:16px 40px; display:flex; justify-content:space-between; align-items:center;">
      <div style="display:flex; align-items:center; gap:14px;">
        <img src="${logo}" style="height:26px; opacity:.95"/>
        <div>
          <div style="font-size:11px; font-weight:700; color:#fff;">${vendedor.nombre}</div>
          ${vendedor.ciudad ? `<div style="font-size:9.5px; color:rgba(255,255,255,.7);">📍 ${vendedor.ciudad}</div>` : ""}
        </div>
      </div>
      <div style="text-align:right;">
        ${vendedor.whatsapp ? `<div style="font-size:10px; color:#fff; margin-bottom:3px; font-weight:600;">📱 ${vendedor.whatsapp}</div>` : ""}
        <div style="font-size:10px; color:rgba(255,255,255,.8);">🌐 ${dominio}</div>
        <div style="font-size:9px; color:rgba(255,255,255,.5); margin-top:2px;">© ${new Date().getFullYear()} · Todos los derechos reservados</div>
      </div>
    </div>
  </div>`;

    const contenedor = el("contenidoPDF");
    contenedor.innerHTML = html;
    contenedor.style.display = "block";

    const opciones = {
      margin:      [0, 0, 0, 0],
      filename:    "catalogo-" + vendedor.nombre.replace(/\s+/g,"-").toLowerCase() + ".pdf",
      image:       { type: "jpeg", quality: 0.96 },
      html2canvas: { scale: 2, useCORS: true, allowTaint: true, backgroundColor: "#f9f7f4" },
      jsPDF:       { unit: "mm", format: "a4", orientation: "portrait" },
    };

    try {
      await html2pdf().set(opciones).from(contenedor).save();
    } finally {
      contenedor.style.display = "none";
      btnCargando(btn, false);
    }
  });
}

function mostrarAlertaMembresia(mem) {
  const msg = mem
    ? "Tu membresía venció el " + mem.fecha_fin + ". Renueva para poder descargar el catálogo."
    : "No tienes membresía activa. Contacta al administrador para activarla.";

  let alerta = el("alertaMembresiaCatalogo");
  if (!alerta) {
    alerta = document.createElement("div");
    alerta.id = "alertaMembresiaCatalogo";
    const main = document.querySelector(".main");
    if (main && main.children[1]) main.insertBefore(alerta, main.children[1]);
    else if (main) main.appendChild(alerta);
  }
  alerta.innerHTML = `
    <div style="background:#fff3cd;border:1.5px solid #f59e0b;border-radius:10px;
                padding:1rem 1.25rem;margin-bottom:1.5rem;
                display:flex;align-items:center;gap:.75rem;flex-wrap:wrap">
      <span style="font-size:1.3rem">⚠️</span>
      <div style="flex:1">
        <strong style="color:#92400e;font-size:.9rem">Membresía inactiva</strong>
        <p style="color:#78350f;font-size:.82rem;margin:.2rem 0 0">${msg}</p>
      </div>
      <div style="display:flex;flex-direction:column;gap:.4rem;align-items:flex-end">
        <a href="membresia.html"
           style="background:#f59e0b;color:#fff;border-radius:8px;padding:.5rem 1rem;
                  font-size:.82rem;font-weight:600;text-decoration:none;white-space:nowrap;display:flex;align-items:center;gap:.35rem">
          <span class="material-symbols-outlined" style="font-size:1rem">id_card</span> Ir a membresía
        </a>
        <a href="https://wa.me/573145891108?text=${encodeURIComponent('Hola, necesito ayuda con mi membresía de GI Store.')}"
           target="_blank"
           style="font-size:.75rem;color:#92400e;text-decoration:none">
          💬 ¿Necesitas ayuda?
        </a>
      </div>
    </div>`;
}

// FIX: inicializar fecha/salir dentro del listener
onAuthStateChanged(auth, (user) => {
  if (!user) return;
  if (el("fechaHoy")) el("fechaHoy").textContent = fechaHoy();
  if (el("btnSalir")) {
    el("btnSalir").addEventListener("click", async () => {
      await cerrarSesion();
      window.location.href = "../index.html";
    });
  }
  cargar(user);
});