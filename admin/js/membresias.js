// ============================================================
//  membresias.js — Gestión de membresías + fundadores
// ============================================================
import { cerrarSesion, protegerPagina } from "./auth.js";
import {
  obtenerMembresias, obtenerVendedores,
  crearMembresia, actualizarMembresia, eliminarMembresia,
  obtenerFundadores, registrarFundador, contarFundadores,
  esFundadorVigente
} from "./db.js";
import { fechaHoy, btnCargando, abrirModal, cerrarModal } from "./ui.js";

protegerPagina("../index.html");

document.getElementById("fechaHoy").textContent = fechaHoy();
document.getElementById("btnSalir").addEventListener("click", async () => {
  await cerrarSesion(); window.location.href = "../index.html";
});

// ── Estado global ─────────────────────────────────────────
let membresias  = [];
let vendedores  = [];
let fundadores  = [];
let idEliminar  = "";
let membEliminar = null; // guarda objeto para mostrar confirmación
const hoyStr    = new Date().toISOString().split("T")[0];

// ── Cargar datos ──────────────────────────────────────────
async function cargar() {
  try {
    [membresias, vendedores, fundadores] = await Promise.all([
      obtenerMembresias(),
      obtenerVendedores(),
      obtenerFundadores(),
    ]);
    document.getElementById("totalMembresias").textContent =
      membresias.length + " membresía" + (membresias.length !== 1 ? "s" : "");
    renderTabla();
    renderFundadores();
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

// ── Tabla membresías ──────────────────────────────────────
function renderTabla() {
  const wrap = document.getElementById("tablaWrap");
  if (!membresias.length) {
    wrap.innerHTML = '<p class="vacio-txt">Sin membresías registradas.</p>';
    return;
  }
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
          <th>Vendedor</th><th>Plan</th><th>Inicio</th><th>Fin</th>
          <th>Días</th><th>Estado</th><th>Notas</th><th>Acciones</th>
        </tr>
      </thead>
      <tbody>
        ${ordenadas.map(m => {
          const est      = estadoReal(m);
          const diasRest = diasRestantes(m.fecha_fin);
          const badgeCls = est === "activa" ? "activo" : est === "vencida" ? "vencida" : "suspendida";
          const badgeTxt = est === "activa" ? "Activa" : est === "vencida" ? "Vencida" : "Suspendida";
          const esFund   = fundadores.some(f => f.vendedor_id === m.vendedor_id);
          const planTag  = esFund
            ? `<span class="badge" style="background:#fef9c3;color:#92400e">⭐ Fundador</span>`
            : `<span class="badge badge-suspendida">Normal</span>`;
          return `<tr>
            <td><strong>${nombreVendedor(m.vendedor_id)}</strong></td>
            <td>${planTag}</td>
            <td>${m.fecha_inicio || "—"}</td>
            <td>${m.fecha_fin    || "—"}</td>
            <td>${est === "activa" ? diasTag(diasRest) : "—"}</td>
            <td><span class="badge badge-${badgeCls}">${badgeTxt}</span></td>
            <td style="max-width:140px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${m.notas || "—"}</td>
            <td>
              <div class="td-acciones">
                <button class="btn-tabla btn-editar"   data-id="${m.id}">✏ Editar</button>
                <button class="btn-tabla btn-eliminar" data-id="${m.id}" data-vid="${m.vendedor_id}">🗑 Revocar</button>
              </div>
            </td>
          </tr>`;
        }).join("")}
      </tbody>
    </table>`;

  wrap.querySelectorAll(".btn-editar").forEach(btn =>
    btn.addEventListener("click", () => abrirEditar(btn.dataset.id)));
  wrap.querySelectorAll(".btn-eliminar").forEach(btn =>
    btn.addEventListener("click", () => abrirEliminar(btn.dataset.id, btn.dataset.vid)));
}

function diasRestantes(fechaFin) {
  if (!fechaFin) return null;
  const diff = new Date(fechaFin) - new Date(hoyStr);
  return Math.ceil(diff / 86400000);
}
function diasTag(dias) {
  if (dias === null) return "—";
  if (dias <= 0)  return `<span class="badge badge-vencida">Vencida</span>`;
  if (dias <= 7)  return `<span class="badge badge-vencida">${dias} días</span>`;
  if (dias <= 30) return `<span class="badge" style="background:#fef9c3;color:#a16207">${dias} días</span>`;
  return `<span class="badge badge-activo">${dias} días</span>`;
}

// ── Panel fundadores ──────────────────────────────────────
function renderFundadores() {
  const panel = document.getElementById("panelFundadores");
  if (!panel) return;
  const total   = fundadores.length;
  const cupos   = 15 - total;
  const hoy     = new Date().toISOString().split("T")[0];

  panel.innerHTML = `
    <div class="panel-header">
      <h2>⭐ Programa Fundadores <span style="font-weight:400;font-size:.85rem;color:var(--texto-suave)">(${total}/15 registrados · ${cupos} cupos libres)</span></h2>
    </div>
    <div style="padding:1.25rem 1.5rem">
      <p style="font-size:.85rem;color:var(--texto-medio);margin-bottom:1rem">
        Los primeros 15 vendedores inscritos tienen el <strong>plan Fundador por 1 año</strong>
        desde su fecha de registro. Al cumplir el año pasan automáticamente al plan normal.
      </p>
      ${!fundadores.length
        ? '<p class="vacio-txt">No hay fundadores registrados aún.</p>'
        : `<table>
            <thead>
              <tr><th>#</th><th>Vendedor</th><th>Registro</th><th>Vence</th><th>Estado</th><th>Acción</th></tr>
            </thead>
            <tbody>
              ${fundadores.map((f, i) => {
                const v          = vendedores.find(x => x.id === f.vendedor_id);
                const nombre     = v ? v.nombre : f.vendedor_id;
                const fechaVence = (() => {
                  if (!f.fecha_registro) return "—";
                  const d = new Date(f.fecha_registro);
                  d.setFullYear(d.getFullYear() + 1);
                  return d.toISOString().split("T")[0];
                })();
                const vigente  = fechaVence !== "—" && fechaVence > hoy;
                return `<tr>
                  <td>${i + 1}</td>
                  <td><strong>${nombre}</strong></td>
                  <td>${f.fecha_registro || "—"}</td>
                  <td>${fechaVence}</td>
                  <td>
                    ${vigente
                      ? `<span class="badge" style="background:#fef9c3;color:#92400e">⭐ Activo</span>`
                      : `<span class="badge badge-suspendida">Expirado → Normal</span>`}
                  </td>
                  <td>
                    <button class="btn-tabla btn-editar" onclick="asignarFundador('${f.vendedor_id}')">
                      Ver vendedor
                    </button>
                  </td>
                </tr>`;
              }).join("")}
            </tbody>
          </table>`}
      ${cupos > 0
        ? `<div style="margin-top:1rem">
            <button class="btn btn-primary btn-sm" id="btnRegistrarFundador" style="font-size:.82rem;padding:.5rem 1rem">
              + Registrar fundador (${cupos} cupos)
            </button>
           </div>`
        : `<p style="margin-top:.75rem;font-size:.82rem;color:var(--texto-suave)">✅ Cupo de fundadores completo (15/15).</p>`}
    </div>`;

  document.getElementById("btnRegistrarFundador")?.addEventListener("click", () => {
    document.getElementById("modalFundadorOverlay").classList.add("visible");
    renderSelectFundador();
  });
}

function renderSelectFundador() {
  const fundadorIds = new Set(fundadores.map(f => f.vendedor_id));
  const disponibles = vendedores.filter(v => !fundadorIds.has(v.id));
  const sel = document.getElementById("fFundadorVendedor");
  sel.innerHTML = `<option value="">— Selecciona vendedor —</option>` +
    disponibles.map(v => `<option value="${v.id}">${v.nombre} · ${v.ciudad}</option>`).join("");
}

document.getElementById("btnGuardarFundador")?.addEventListener("click", async () => {
  const id  = document.getElementById("fFundadorVendedor").value;
  const btn = document.getElementById("btnGuardarFundador");
  if (!id) { alert("Selecciona un vendedor."); return; }
  btnCargando(btn, true);
  try {
    const result = await registrarFundador(id);
    if (result.ok) {
      document.getElementById("modalFundadorOverlay").classList.remove("visible");
      await cargar();
    } else if (result.razon === "cupo_lleno") {
      alert("Ya hay 15 fundadores registrados. Cupo completo.");
    } else {
      alert("Este vendedor ya es fundador.");
    }
  } catch (e) { console.error(e); alert("Error al registrar fundador."); }
  finally { btnCargando(btn, false); }
});

document.getElementById("btnCancelarFundador")?.addEventListener("click", () => {
  document.getElementById("modalFundadorOverlay").classList.remove("visible");
});

// ── Buscar vendedor por teléfono ──────────────────────────
function llenarSelectVendedor(seleccionado = "") {
  if (seleccionado) {
    const v = vendedores.find(x => x.id === seleccionado);
    if (v) {
      document.getElementById("buscarTelefono").value = v.whatsapp || "";
      document.getElementById("vendedorEncontrado").innerHTML = tarjetaVendedor(v, true);
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
function tarjetaVendedor(v, seleccionado = false) {
  return `
    <div style="display:flex;align-items:center;gap:.75rem;padding:.65rem .9rem;
                background:var(--verde-claro);border:1.5px solid var(--verde);
                border-radius:8px;margin-top:.5rem;${!seleccionado ? 'cursor:pointer' : ''}"
         ${!seleccionado ? `onclick="seleccionarVendedor('${v.id}')"` : ""}>
      <div style="width:32px;height:32px;border-radius:50%;background:${v.color||'#1a6b3c'};flex-shrink:0"></div>
      <div style="flex:1">
        <strong style="font-size:.9rem">${v.nombre}</strong>
        <div style="font-size:.78rem;color:var(--texto-suave)">${v.ciudad||""} · 📱 ${v.whatsapp||""}</div>
      </div>
      ${seleccionado
        ? `<span class="badge badge-activo">✓ Seleccionado</span>`
        : `<button type="button" style="background:var(--verde);color:#fff;border:none;border-radius:6px;
              padding:.35rem .8rem;font-size:.78rem;cursor:pointer;font-weight:600">✓ Seleccionar</button>`}
    </div>`;
}

document.getElementById("buscarTelefono").addEventListener("input", function() {
  const tel  = this.value.trim();
  const wrap = document.getElementById("vendedorEncontrado");
  document.getElementById("fVendedor").value = "";
  if (tel.length < 7) { wrap.innerHTML = ""; return; }
  const v = buscarVendedorPorTel(tel);
  wrap.innerHTML = v
    ? tarjetaVendedor(v, false)
    : `<p style="font-size:.8rem;color:var(--texto-suave);margin-top:.4rem">Sin resultados para "<strong>${tel}</strong>"</p>`;
});

window.seleccionarVendedor = function(id) {
  document.getElementById("fVendedor").value = id;
  const v = vendedores.find(x => x.id === id);
  if (v) document.getElementById("vendedorEncontrado").innerHTML = tarjetaVendedor(v, true);
};

// ── Modal crear ───────────────────────────────────────────
document.getElementById("btnNuevo").addEventListener("click", () => {
  limpiarModal();
  document.getElementById("modalTitulo").textContent = "Nueva membresía";
  document.getElementById("membresiaId").value = "";
  document.getElementById("fInicio").value = hoyStr;
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
  const id           = document.getElementById("membresiaId").value;
  const vendedor_id  = document.getElementById("fVendedor").value;
  const fecha_inicio = document.getElementById("fInicio").value;
  const fecha_fin    = document.getElementById("fFin").value;
  const estado       = document.getElementById("fEstado").value;
  const notas        = document.getElementById("fNotas").value.trim();

  if (!vendedor_id)  { mostrarError("Selecciona un vendedor.");                            return; }
  if (!fecha_inicio) { mostrarError("La fecha de inicio es obligatoria.");                 return; }
  if (!fecha_fin)    { mostrarError("La fecha de fin es obligatoria.");                    return; }
  if (fecha_fin < fecha_inicio) { mostrarError("La fecha fin debe ser posterior al inicio."); return; }

  const btn = document.getElementById("btnGuardar");
  btnCargando(btn, true); ocultarMensajes();

  try {
    const datos  = { vendedor_id, fecha_inicio, fecha_fin, estado, notas };
    const activo = estado === "activa" && fecha_fin >= hoyStr;

    if (id) {
      await actualizarMembresia(id, datos);
      mostrarOk("Membresía actualizada. Productos " + (activo ? "activados ✅" : "desactivados ⛔") + " automáticamente.");
    } else {
      await crearMembresia(datos);
      mostrarOk("Membresía creada. Vendedor y productos " + (activo ? "activados ✅" : "registrados ⛔") + ".");
    }
    await cargar();
    setTimeout(() => cerrarModal("modalOverlay"), 1500);
  } catch (e) {
    mostrarError("Error al guardar. Intenta de nuevo.");
    console.error(e);
  } finally { btnCargando(btn, false); }
});

// ── Eliminar (con confirmación de impacto) ────────────────
function abrirEliminar(id, vid) {
  idEliminar   = id;
  const nombre = nombreVendedor(vid);
  document.getElementById("nombreEliminar").textContent = nombre;
  abrirModal("modalEliminar");
}

document.getElementById("btnConfirmarEliminar").addEventListener("click", async () => {
  const btn = document.getElementById("btnConfirmarEliminar");
  btnCargando(btn, true);
  try {
    await eliminarMembresia(idEliminar); // desactiva productos automáticamente
    cerrarModal("modalEliminar");
    await cargar();
  } catch (e) { console.error(e); }
  finally { btnCargando(btn, false); }
});

// ── Cerrar modales ────────────────────────────────────────
document.getElementById("btnCancelar").addEventListener("click", () => cerrarModal("modalOverlay"));
document.getElementById("btnCancelarEliminar").addEventListener("click", () => cerrarModal("modalEliminar"));
document.getElementById("modalOverlay").addEventListener("click", e => {
  if (e.target === document.getElementById("modalOverlay")) cerrarModal("modalOverlay");
});

// ── Helpers ───────────────────────────────────────────────
function limpiarModal() {
  document.getElementById("fVendedor").value              = "";
  document.getElementById("buscarTelefono").value         = "";
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