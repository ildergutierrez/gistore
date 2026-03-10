// ============================================================
//  dashboard.js — Portal vendedor
// ============================================================
import { cerrarSesion, protegerPagina } from "../js/auth.js";
import { obtenerVendedorPorUid, obtenerMembresiaVendedor,
         obtenerMisProductos, membresiaVigente } from "../js/db.js";
import { fechaHoy, formatoPrecio } from "../js/ui.js";
import { auth } from "../js/firebase.js";
import { onAuthStateChanged }
  from "https://www.gstatic.com/firebasejs/12.10.0/firebase-auth.js";

protegerPagina("../index.html");

const WHATSAPP_ADMIN = "573145891108";

// FIX: un solo onAuthStateChanged que hace todo —
// evita carreras entre protegerPagina y la carga de datos
onAuthStateChanged(auth, async (user) => {
  if (!user) return; // protegerPagina ya maneja la redirección

  // Setear fecha y botón salir de forma segura (DOM ya listo)
  const elFecha  = document.getElementById("fechaHoy");
  const elSalir  = document.getElementById("btnSalir");
  if (elFecha) elFecha.textContent = fechaHoy();
  if (elSalir) {
    elSalir.addEventListener("click", async () => {
      await cerrarSesion();
      window.location.href = "../index.html";
    });
  }

  try {
    const vendedor = await obtenerVendedorPorUid(user.uid);

    if (!vendedor) {
      const elBienvenida = document.getElementById("bienvenida");
      const elPanel      = document.getElementById("panelMembresia");
      if (elBienvenida) elBienvenida.textContent = "⚠ Perfil no encontrado.";
      if (elPanel) elPanel.innerHTML =
        `<p style="color:var(--texto-medio);font-size:.87rem">
          No se encontró un perfil asociado a esta cuenta.<br/>
          Contacta al administrador.
        </p>`;
      const s = document.getElementById("statProductos");
      const a = document.getElementById("statActivos");
      const i = document.getElementById("statInactivos");
      if (s) s.textContent = "—";
      if (a) a.textContent = "—";
      if (i) i.textContent = "—";
      return;
    }

    // Guardar en sessionStorage para otras páginas
    sessionStorage.setItem("vendedor_id",     vendedor.id);
    sessionStorage.setItem("vendedor_nombre", vendedor.nombre);
    sessionStorage.setItem("vendedor_color",  vendedor.color || "#1a6b3c");

    const elBienvenida    = document.getElementById("bienvenida");
    const elVendedorNombre = document.getElementById("vendedorNombre");
    if (elBienvenida)     elBienvenida.textContent     = "Hola, " + vendedor.nombre + " 👋";
    if (elVendedorNombre) elVendedorNombre.textContent = vendedor.nombre;

    // Membresía
    const mem = await obtenerMembresiaVendedor(vendedor.id);
    renderMembresia(mem, vendedor);

    // Productos
    const productos = await obtenerMisProductos(vendedor.id);
    const activos   = productos.filter(p => p.activo).length;
    const sP = document.getElementById("statProductos");
    const sA = document.getElementById("statActivos");
    const sI = document.getElementById("statInactivos");
    if (sP) sP.textContent = productos.length || "0";
    if (sA) sA.textContent = activos || "0";
    if (sI) sI.textContent = (productos.length - activos) || "0";

  } catch (e) {
    console.error(e);
    const elBienvenida = document.getElementById("bienvenida");
    if (elBienvenida) elBienvenida.textContent = "Error al cargar datos.";
  }
});

function renderMembresia(mem, vendedor) {
  const el      = document.getElementById("panelMembresia");
  if (!el) return;
  const hoy     = new Date().toISOString().split("T")[0];
  const vigente = membresiaVigente(mem);

  if (!mem) {
    el.innerHTML = membresiaHTML("inactivo", "Sin membresía",
      "No tienes membresía activa. Contacta al administrador.", vendedor);
    return;
  }

  const dias = Math.ceil((new Date(mem.fecha_fin) - new Date(hoy)) / (1000*60*60*24));

  if (!vigente) {
    el.innerHTML = membresiaHTML("vencida", "Membresía vencida",
      "Tu membresía venció el " + mem.fecha_fin + ". Renuévala para seguir activo.", vendedor);
    return;
  }

  let alerta = "";
  if (dias <= 7) {
    alerta = `<div class="msg-error visible" style="margin-bottom:1rem">
      <span>⚠&nbsp;</span><span>Tu membresía vence en ${dias} día${dias!==1?'s':''}. ¡Renuévala pronto!</span>
    </div>`;
  } else if (dias <= 30) {
    alerta = `<div style="background:var(--adv-bg);border:1.5px solid var(--adv-borde);border-radius:8px;padding:.6rem .9rem;font-size:.83rem;color:var(--advertencia);margin-bottom:1rem">
      ⏰ Tu membresía vence en ${dias} días (${mem.fecha_fin})
    </div>`;
  }

  el.innerHTML = `
    ${alerta}
    <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:1rem">
      <div>
        <p style="font-size:.78rem;color:var(--texto-suave);text-transform:uppercase;letter-spacing:.05em;font-weight:600;margin-bottom:.3rem">Estado de membresía</p>
        <span class="badge badge-activo" style="font-size:.85rem;padding:.3rem .9rem">✓ Activa</span>
        <p style="font-size:.83rem;color:var(--texto-medio);margin-top:.5rem">Válida hasta: <strong>${mem.fecha_fin}</strong> · ${dias} días restantes</p>
      </div>
      <div style="display:flex;flex-direction:column;gap:.6rem;align-items:flex-end">
        <a href="membresia.html" class="btn btn-secundario" style="display:flex;align-items:center;gap:.4rem">
          <span class="material-symbols-outlined" style="font-size:1.1rem">id_card</span> Renovar membresía
        </a>
        <a href="https://wa.me/${WHATSAPP_ADMIN}?text=${encodeURIComponent('Hola, necesito ayuda con mi membresía de GI Store.')}"
           target="_blank" style="font-size:.78rem;color:var(--texto-suave);text-decoration:none;display:flex;align-items:center;gap:.3rem">
          💬 ¿Necesitas ayuda?
        </a>
      </div>
    </div>`;
}

function membresiaHTML(estado, titulo, msg, vendedor) {
  return `
    <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:1rem">
      <div>
        <p style="font-size:.78rem;color:var(--texto-suave);text-transform:uppercase;letter-spacing:.05em;font-weight:600;margin-bottom:.3rem">Estado de membresía</p>
        <span class="badge badge-${estado}" style="font-size:.85rem;padding:.3rem .9rem">${titulo}</span>
        <p style="font-size:.83rem;color:var(--texto-medio);margin-top:.5rem">${msg}</p>
      </div>
      <div style="display:flex;flex-direction:column;gap:.6rem;align-items:flex-end">
        <a href="membresia.html" class="btn btn-primary" style="display:flex;align-items:center;gap:.4rem">
          <span class="material-symbols-outlined" style="font-size:1.1rem">id_card</span> Activar membresía
        </a>
        <a href="https://wa.me/${WHATSAPP_ADMIN}?text=${encodeURIComponent('Hola, necesito ayuda con mi membresía de GI Store.')}"
           target="_blank" style="font-size:.78rem;color:var(--texto-suave);text-decoration:none;display:flex;align-items:center;gap:.3rem">
          💬 ¿Necesitas ayuda?
        </a>
      </div>
    </div>`;
}