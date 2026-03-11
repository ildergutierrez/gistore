// ============================================================
//  dashboard.js — Portal vendedor
//  Muestra plan (Fundador / Normal) con botón → membresia.html
// ============================================================
import { cerrarSesion, protegerPagina } from "./auth.js";
import {
  obtenerVendedorPorUid, obtenerMembresiaVendedor,
  obtenerMisProductos, membresiaVigente, esFundadorVigente
} from "./db.js";
import { fechaHoy, formatoPrecio } from "./ui.js";
import { auth } from "./firebase.js";
import { onAuthStateChanged }
  from "https://www.gstatic.com/firebasejs/12.10.0/firebase-auth.js";

protegerPagina("../index.html");

document.getElementById("fechaHoy").textContent = fechaHoy();
document.getElementById("btnSalir").addEventListener("click", async () => {
  await cerrarSesion();
  window.location.href = "../index.html";
});

// ── Precios por plan ──────────────────────────────────────
const PRECIO_FUNDADOR = 15000;  // COP / mes
const PRECIO_NORMAL   = 25000;  // COP / mes

// ── Cargar datos ──────────────────────────────────────────
onAuthStateChanged(auth, async (user) => {
  if (!user) return;

  try {
    const vendedor = await obtenerVendedorPorUid(user.uid);

    if (!vendedor) {
      document.getElementById("bienvenida").textContent = "⚠ Perfil no encontrado.";
      document.getElementById("panelMembresia").innerHTML =
        `<p style="color:var(--texto-medio);font-size:.87rem">
          No se encontró un perfil asociado a esta cuenta.<br/>
          Contacta al administrador.
        </p>`;
      setStats("—", "—", "—");
      return;
    }

    sessionStorage.setItem("vendedor_id",     vendedor.id);
    sessionStorage.setItem("vendedor_nombre", vendedor.nombre);
    sessionStorage.setItem("vendedor_color",  vendedor.color || "#1a6b3c");

    document.getElementById("bienvenida").textContent = "Hola, " + vendedor.nombre + " 👋";
    // vendedorNombre solo existe en páginas con sidebar (membresia.html, etc.)
    const elNombre = document.getElementById("vendedorNombre");
    if (elNombre) elNombre.textContent = vendedor.nombre;

    // Consultar membresía y estado fundador en paralelo
    const [mem, infoFundador] = await Promise.all([
      obtenerMembresiaVendedor(vendedor.id),
      esFundadorVigente(vendedor.id),
    ]);

    renderMembresia(mem, vendedor, infoFundador);

    // Estadísticas de productos
    const productos = await obtenerMisProductos(vendedor.id);
    const activos   = productos.filter(p => p.activo).length;
    setStats(productos.length, activos, productos.length - activos);

  } catch (e) {
    console.error(e);
    const elBienvenida = document.getElementById("bienvenida");
    if (elBienvenida) elBienvenida.textContent = "Error al cargar datos.";
  }
});

function setStats(total, activos, inactivos) {
  document.getElementById("statProductos").textContent = total || "0";
  document.getElementById("statActivos").textContent   = activos || "0";
  document.getElementById("statInactivos").textContent = inactivos || "0";
}

// ── Render panel membresía ────────────────────────────────
function renderMembresia(mem, vendedor, infoFundador) {
  const el      = document.getElementById("panelMembresia");
  const hoy     = new Date().toISOString().split("T")[0];
  const vigente = membresiaVigente(mem);

  const esFundador = infoFundador?.esFundador || false;
  const precio     = esFundador ? PRECIO_FUNDADOR : PRECIO_NORMAL;
  const planNombre = esFundador ? "⭐ Plan Fundador" : "Plan Estándar";
  const planColor  = esFundador
    ? "background:#fef9c3;color:#92400e;border:1.5px solid #f59e0b"
    : "background:var(--fondo-2);color:var(--texto-medio);border:1.5px solid var(--borde)";

  const badgePlan = `<span style="display:inline-block;border-radius:8px;padding:.25rem .75rem;
    font-size:.78rem;font-weight:700;${planColor}">${planNombre}</span>`;

  // Botón de pago → página de membresía (pago en línea con Wompi)
  const btnPago = `
    <a href="membresia.html"
       class="btn btn-primary"
       style="white-space:nowrap;display:inline-flex;align-items:center;gap:.5rem">
      💳 Pagar membresía — ${formatoPrecio(precio)}/mes
    </a>`;

  // Sin membresía
  if (!mem) {
    el.innerHTML = `
      <div style="display:flex;flex-wrap:wrap;align-items:flex-start;justify-content:space-between;gap:1.25rem">
        <div>
          <div style="margin-bottom:.6rem">${badgePlan}</div>
          <span class="badge badge-inactivo" style="font-size:.85rem;padding:.3rem .9rem">Sin membresía</span>
          <p style="font-size:.83rem;color:var(--texto-medio);margin-top:.5rem">
            No tienes membresía activa. Realiza tu pago en línea para activarla.
            ${esFundador ? `<br/><span style="color:#92400e;font-size:.8rem">Tu cupo fundador vence el <strong>${infoFundador.fechaVence}</strong>.</span>` : ""}
          </p>
        </div>
        ${btnPago}
      </div>`;
    return;
  }

  const dias = Math.ceil((new Date(mem.fecha_fin) - new Date(hoy)) / 86400000);

  // Vencida
  if (!vigente) {
    el.innerHTML = `
      <div style="display:flex;flex-wrap:wrap;align-items:flex-start;justify-content:space-between;gap:1.25rem">
        <div>
          <div style="margin-bottom:.6rem">${badgePlan}</div>
          <span class="badge badge-vencida" style="font-size:.85rem;padding:.3rem .9rem">Membresía vencida</span>
          <p style="font-size:.83rem;color:var(--texto-medio);margin-top:.5rem">
            Tu membresía venció el <strong>${mem.fecha_fin}</strong>. Renuévala para volver a aparecer en el catálogo.
            ${esFundador ? `<br/><span style="color:#92400e;font-size:.8rem">Tu beneficio fundador vence el <strong>${infoFundador.fechaVence}</strong>.</span>` : ""}
          </p>
        </div>
        ${btnPago}
      </div>`;
    return;
  }

  // Alertas de vencimiento próximo
  let alerta = "";
  if (dias <= 7) {
    alerta = `<div class="msg-error visible" style="margin-bottom:1rem">
      <span>⚠&nbsp;</span><span>Tu membresía vence en ${dias} día${dias !== 1 ? "s" : ""}. ¡Renuévala pronto!</span>
    </div>`;
  } else if (dias <= 30) {
    alerta = `<div style="background:var(--adv-bg,#fffbeb);border:1.5px solid var(--adv-borde,#f59e0b);
              border-radius:8px;padding:.6rem .9rem;font-size:.83rem;color:var(--advertencia,#d97706);margin-bottom:1rem">
      ⏰ Tu membresía vence en ${dias} días (${mem.fecha_fin})
    </div>`;
  }

  // Activa — botón renovar también va a membresia.html
  el.innerHTML = `
    ${alerta}
    <div style="display:flex;flex-wrap:wrap;align-items:flex-start;justify-content:space-between;gap:1.25rem">
      <div>
        <div style="margin-bottom:.6rem">${badgePlan}</div>
        <span class="badge badge-activo" style="font-size:.85rem;padding:.3rem .9rem">✓ Membresía activa</span>
        <p style="font-size:.83rem;color:var(--texto-medio);margin-top:.5rem">
          Válida hasta: <strong>${mem.fecha_fin}</strong> · ${dias} día${dias !== 1 ? "s" : ""} restante${dias !== 1 ? "s" : ""}
          ${esFundador
            ? `<br/><span style="color:#92400e;font-size:.8rem">⭐ Beneficio fundador activo hasta <strong>${infoFundador.fechaVence}</strong></span>`
            : ""}
        </p>
      </div>
      <a href="membresia.html" class="btn btn-secundario" style="white-space:nowrap">
        💳 Renovar membresía
      </a>
    </div>`;
}