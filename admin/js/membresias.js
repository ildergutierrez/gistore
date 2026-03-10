// ============================================================
//  membresias.js — Gestión de membresías
// ============================================================
import { cerrarSesion, protegerPagina } from "./auth.js";
import {
  obtenerMembresias, obtenerVendedores,
  crearMembresia, actualizarMembresia, eliminarMembresia
} from "./db.js";
import { fechaHoy, btnCargando, abrirModal, cerrarModal } from "./ui.js";

protegerPagina("../index.html");

document.getElementById("fechaHoy").textContent = fechaHoy();
document.getElementById("btnSalir").addEventListener("click", async () => {
  await cerrarSesion(); window.location.href = "../index.html";
});

// ── Estado global ─────────────────────────────────────────
let membresias = [];
let vendedores = [];
let idEliminar = "";
const hoyStr   = new Date().toISOString().split("T")[0];

// ── Cargar datos ──────────────────────────────────────────
async function cargar() {
  try {
    [membresias, vendedores] = await Promise.all([
      obtenerMembresias(),
      obtenerVendedores(),
    ]);
    document.getElementById("totalMembresias").textContent =
      membresias.length + " membresía" + (membresias.length !== 1 ? "s" : "");
    renderTabla();
  } catch (e) { console.error(e); }
}

function nombreVendedor(id) {
  const v = vendedores.find(x => x.id === id);
  return v ? v.nombre : "—";
}

function estadoReal(m) {
  if (m.estado === "activa" && m.fecha_fin < hoyStr) return "vencida";
  return m.estado;
}

function renderTabla() {
  const wrap = document.getElementById("tablaWrap");
  if (!membresias.length) {
    wrap.innerHTML = '<p class="vacio-txt">Sin membresías registradas.</p>';
    return;
  }

  // Ordenar: activas primero, luego por fecha_fin desc
  const ordenadas = [...membresias].sort((a, b) => {
    const ea = estadoReal(a), eb = estadoReal(b);
    if (ea === "activa" && eb !== "activa") return -1;
    if (ea !== "activa" && eb === "activa") return  1;
    return (b.fecha_fin || "").localeCompare(a.fecha_fin || "");
  });

  wrap.innerHTML = `
    <table>
      <thead>
        <tr>
          <th>Vendedor</th>
          <th>Fecha inicio</th>
          <th>Fecha fin</th>
          <th>Días restantes</th>
          <th>Estado</th>
          <th>Notas</th>
          <th>Acciones</th>
        </tr>
      </thead>
      <tbody>
        ${ordenadas.map(m => {
          const est      = estadoReal(m);
          const diasRest = diasRestantes(m.fecha_fin);
          const badgeCls = est === "activa" ? "activo" : est === "vencida" ? "vencida" : "suspendida";
          const badgeTxt = est === "activa" ? "Activa" : est === "vencida" ? "Vencida" : "Suspendida";
          return `<tr>
            <td><strong>${nombreVendedor(m.vendedor_id)}</strong></td>
            <td>${m.fecha_inicio || "—"}</td>
            <td>${m.fecha_fin    || "—"}</td>
            <td>${est === "activa" ? diasTag(diasRest) : "—"}</td>
            <td><span class="badge badge-${badgeCls}">${badgeTxt}</span></td>
            <td style="max-width:160px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${m.notas || "—"}</td>
            <td>
              <div class="td-acciones">
                <button class="btn-tabla btn-editar"   data-id="${m.id}">✏ Editar</button>
                <button class="btn-tabla btn-eliminar" data-id="${m.id}">🗑 Eliminar</button>
              </div>
            </td>
          </tr>`;
        }).join("")}
      </tbody>
    </table>`;

  wrap.querySelectorAll(".btn-editar").forEach(btn =>
    btn.addEventListener("click", () => abrirEditar(btn.dataset.id)));
  wrap.querySelectorAll(".btn-eliminar").forEach(btn =>
    btn.addEventListener("click", () => abrirEliminar(btn.dataset.id)));
}

function diasRestantes(fechaFin) {
  if (!fechaFin) return null;
  const diff = new Date(fechaFin) - new Date(hoyStr);
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}
function diasTag(dias) {
  if (dias === null) return "—";
  if (dias <= 0)  return `<span class="badge badge-vencida">Vencida</span>`;
  if (dias <= 7)  return `<span class="badge badge-vencida">${dias} días</span>`;
  if (dias <= 30) return `<span class="badge" style="background:#fef9c3;color:#a16207">${dias} días</span>`;
  return `<span class="badge badge-activo">${dias} días</span>`;
}

// ── Buscador de vendedor por teléfono ────────────────────
function llenarSelectVendedor(seleccionado = "") {
  // Al editar, mostrar el vendedor seleccionado en el campo
  if (seleccionado) {
    const v = vendedores.find(x => x.id === seleccionado);
    if (v) {
      document.getElementById("buscarTelefono").value = v.whatsapp || "";
      document.getElementById("vendedorEncontrado").innerHTML = `
        <div style="display:flex;align-items:center;gap:.75rem;padding:.65rem .9rem;
                    background:var(--verde-claro);border:1.5px solid var(--verde);
                    border-radius:8px;margin-top:.5rem">
          <div style="width:32px;height:32px;border-radius:50%;background:${v.color||'#1a6b3c'};
                      flex-shrink:0"></div>
          <div>
            <strong style="font-size:.9rem">${v.nombre}</strong>
            <div style="font-size:.78rem;color:var(--texto-suave)">${v.ciudad||""} · 📱 ${v.whatsapp||""}</div>
          </div>
          <span class="badge badge-activo" style="margin-left:auto">Seleccionado</span>
        </div>`;
      document.getElementById("fVendedor").value = v.id;
    }
  }
}

function buscarVendedorPorTel(tel) {
  const limpio = tel.replace(/\s+/g,"").replace(/^(\+57|57)/,"");
  return vendedores.find(v => {
    const w = (v.whatsapp||"").replace(/\s+/g,"").replace(/^(\+57|57)/,"");
    return w === limpio || w.endsWith(limpio) || limpio.endsWith(w);
  });
}

document.getElementById("buscarTelefono").addEventListener("input", function() {
  const tel = this.value.trim();
  const wrap = document.getElementById("vendedorEncontrado");
  document.getElementById("fVendedor").value = "";
  if (tel.length < 7) { wrap.innerHTML = ""; return; }
  const v = buscarVendedorPorTel(tel);
  if (v) {
    wrap.innerHTML = `
      <div style="display:flex;align-items:center;gap:.75rem;padding:.65rem .9rem;
                  background:var(--verde-claro);border:1.5px solid var(--verde);
                  border-radius:8px;margin-top:.5rem;cursor:pointer"
           onclick="seleccionarVendedor('${v.id}')">
        <div style="width:32px;height:32px;border-radius:50%;background:${v.color||'#1a6b3c'};flex-shrink:0"></div>
        <div style="flex:1">
          <strong style="font-size:.9rem">${v.nombre}</strong>
          <div style="font-size:.78rem;color:var(--texto-suave)">${v.ciudad||""} · 📱 ${v.whatsapp||""}</div>
        </div>
        <button type="button" style="background:var(--verde);color:#fff;border:none;border-radius:6px;
                padding:.35rem .8rem;font-size:.78rem;cursor:pointer;font-weight:600">
          ✓ Seleccionar
        </button>
      </div>`;
  } else {
    wrap.innerHTML = `<p style="font-size:.8rem;color:var(--texto-suave);margin-top:.4rem">
      Sin resultados para "<strong>${tel}</strong>"</p>`;
  }
});

window.seleccionarVendedor = function(id) {
  document.getElementById("fVendedor").value = id;
  const v = vendedores.find(x => x.id === id);
  if (!v) return;
  document.getElementById("vendedorEncontrado").innerHTML = `
    <div style="display:flex;align-items:center;gap:.75rem;padding:.65rem .9rem;
                background:var(--verde-claro);border:1.5px solid var(--verde);border-radius:8px;margin-top:.5rem">
      <div style="width:32px;height:32px;border-radius:50%;background:${v.color||'#1a6b3c'};flex-shrink:0"></div>
      <div style="flex:1">
        <strong style="font-size:.9rem">${v.nombre}</strong>
        <div style="font-size:.78rem;color:var(--texto-suave)">${v.ciudad||""} · 📱 ${v.whatsapp||""}</div>
      </div>
      <span class="badge badge-activo">✓ Seleccionado</span>
    </div>`;
};

// ── Modal crear ───────────────────────────────────────────
document.getElementById("btnNuevo").addEventListener("click", () => {
  limpiarModal();
  document.getElementById("modalTitulo").textContent = "Nueva membresía";
  document.getElementById("membresiaId").value = "";
  document.getElementById("fInicio").value = hoyStr;
  llenarSelectVendedor();
  ocultarMensajes();
  abrirModal("modalOverlay");
});

// ── Modal editar ──────────────────────────────────────────
function abrirEditar(id) {
  const m = membresias.find(x => x.id === id);
  if (!m) return;
  limpiarModal();
  document.getElementById("modalTitulo").textContent = "Editar membresía";
  document.getElementById("membresiaId").value = m.id;
  document.getElementById("fInicio").value     = m.fecha_inicio || "";
  document.getElementById("fFin").value        = m.fecha_fin    || "";
  document.getElementById("fEstado").value     = m.estado       || "activa";
  document.getElementById("fNotas").value      = m.notas        || "";
  llenarSelectVendedor(m.vendedor_id);
  ocultarMensajes();
  abrirModal("modalOverlay");
}

// ── Guardar ───────────────────────────────────────────────
document.getElementById("btnGuardar").addEventListener("click", async () => {
  const id          = document.getElementById("membresiaId").value;
  const vendedor_id = document.getElementById("fVendedor").value;
  const fecha_inicio= document.getElementById("fInicio").value;
  const fecha_fin   = document.getElementById("fFin").value;
  const estado      = document.getElementById("fEstado").value;
  const notas       = document.getElementById("fNotas").value.trim();

  if (!vendedor_id)  { mostrarError("Selecciona un vendedor.");     return; }
  if (!fecha_inicio) { mostrarError("La fecha de inicio es obligatoria."); return; }
  if (!fecha_fin)    { mostrarError("La fecha de fin es obligatoria.");    return; }
  if (fecha_fin < fecha_inicio) { mostrarError("La fecha de fin debe ser posterior al inicio."); return; }

  const btn = document.getElementById("btnGuardar");
  btnCargando(btn, true);
  ocultarMensajes();

  try {
    const datos = { vendedor_id, fecha_inicio, fecha_fin, estado, notas };
    if (id) {
      await actualizarMembresia(id, datos);
      // Sincronizar productos según estado de membresía
      const activo = estado === "activa" && fecha_fin >= new Date().toISOString().split("T")[0];
      mostrarOk("Membresía actualizada. Productos " + (activo ? "activados" : "desactivados") + " automáticamente.");
    } else {
      await crearMembresia(datos);
      mostrarOk("Membresía creada. Vendedor y productos activados correctamente.");
    }
    await cargar();
    setTimeout(() => cerrarModal("modalOverlay"), 1200);
  } catch (e) {
    mostrarError("Error al guardar. Intenta de nuevo.");
    console.error(e);
  } finally {
    btnCargando(btn, false);
  }
});

// ── Eliminar ──────────────────────────────────────────────
function abrirEliminar(id) {
  idEliminar = id;
  abrirModal("modalEliminar");
}
document.getElementById("btnConfirmarEliminar").addEventListener("click", async () => {
  const btn = document.getElementById("btnConfirmarEliminar");
  btnCargando(btn, true);
  try {
    await eliminarMembresia(idEliminar);
    cerrarModal("modalEliminar");
    await cargar();
  } catch (e) { console.error(e); }
  finally { btnCargando(btn, false); }
});

// ── Cerrar modales ────────────────────────────────────────
document.getElementById("btnCancelar").addEventListener("click",
  () => cerrarModal("modalOverlay"));
document.getElementById("btnCancelarEliminar").addEventListener("click",
  () => cerrarModal("modalEliminar"));
document.getElementById("modalOverlay").addEventListener("click", e => {
  if (e.target === document.getElementById("modalOverlay")) cerrarModal("modalOverlay");
});

// ── Helpers ───────────────────────────────────────────────
function limpiarModal() {
  document.getElementById("fVendedor").value       = "";
  document.getElementById("buscarTelefono").value  = "";
  document.getElementById("vendedorEncontrado").innerHTML = "";
  document.getElementById("fInicio").value  = "";
  document.getElementById("fFin").value     = "";
  document.getElementById("fEstado").value  = "activa";
  document.getElementById("fNotas").value   = "";
}
function ocultarMensajes() {
  document.getElementById("msgError").classList.remove("visible");
  document.getElementById("msgOk").classList.remove("visible");
}
function mostrarError(msg) {
  document.getElementById("textoError").textContent = msg;
  document.getElementById("msgError").classList.add("visible");
  document.getElementById("msgOk").classList.remove("visible");
}
function mostrarOk(msg) {
  document.getElementById("textoOk").textContent = msg;
  document.getElementById("msgOk").classList.add("visible");
  document.getElementById("msgError").classList.remove("visible");
}

cargar();