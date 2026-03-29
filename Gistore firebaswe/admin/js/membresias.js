// ============================================================
//  membresias.js — Gestión de membresías + fundadores + planes
// ============================================================
import { cerrarSesion, protegerPagina } from "./auth.js";
import {
  obtenerMembresias, obtenerVendedores,
  crearMembresia, actualizarMembresia, eliminarMembresia,
  obtenerFundadores, registrarFundador, contarFundadores,
  esFundadorVigente,
  obtenerPlanes, crearPlan, actualizarPlan, eliminarPlan,
} from "./db.js";
import { fechaHoy, btnCargando, abrirModal, cerrarModal } from "./ui.js";

protegerPagina("../index.html");

document.getElementById("fechaHoy").textContent = fechaHoy();
document.getElementById("btnSalir").addEventListener("click", async () => {
  await cerrarSesion(); window.location.href = "../index.html";
});

// ── Estado global ─────────────────────────────────────────
let membresias   = [];
let vendedores   = [];
let fundadores   = [];
let planes       = [];
let idEliminar   = "";
let idEliminarPlan = "";
const hoyStr     = new Date().toISOString().split("T")[0];

// ── Paginado ──────────────────────────────────────────────
const POR_PAGINA  = 30;
let paginaActual  = 1;
let ordenadas     = [];   // array ordenado, reutilizado por el paginado

// ── Cargar datos ──────────────────────────────────────────
async function cargar() {
  try {
    [membresias, vendedores, fundadores, planes] = await Promise.all([
      obtenerMembresias(),
      obtenerVendedores(),
      obtenerFundadores(),
      obtenerPlanes(),
    ]);
    document.getElementById("totalMembresias").textContent =
      membresias.length + " membresía" + (membresias.length !== 1 ? "s" : "");
    paginaActual = 1;
    renderTabla();
    renderPlanes();
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

// ════════════════════════════════════════════════════════════
//  SECCIÓN 1 — TABLA MEMBRESÍAS (con paginado)
// ════════════════════════════════════════════════════════════

function renderTabla() {
  const wrap       = document.getElementById("tablaWrap");
  const pagWrap    = document.getElementById("paginadoWrap");

  if (!membresias.length) {
    wrap.innerHTML   = '<p class="vacio-txt">Sin membresías registradas.</p>';
    pagWrap.innerHTML = "";
    return;
  }

  // Ordenar: activas primero, luego por fecha_fin desc
  ordenadas = [...membresias].sort((a, b) => {
    const ea = estadoReal(a), eb = estadoReal(b);
    if (ea === "activa" && eb !== "activa") return -1;
    if (ea !== "activa" && eb === "activa") return  1;
    return (b.fecha_fin || "").localeCompare(a.fecha_fin || "");
  });

  const totalPag = Math.ceil(ordenadas.length / POR_PAGINA);
  if (paginaActual > totalPag) paginaActual = totalPag;

  const inicio  = (paginaActual - 1) * POR_PAGINA;
  const pagina  = ordenadas.slice(inicio, inicio + POR_PAGINA);

  wrap.innerHTML = `
    <div style="overflow-x:auto">
      <table>
        <thead>
          <tr>
            <th>Vendedor</th><th>Plan</th><th>Inicio</th><th>Fin</th>
            <th>Días</th><th>Estado</th><th>Notas</th><th>Acciones</th>
          </tr>
        </thead>
        <tbody>
          ${pagina.map(m => {
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
      </table>
    </div>`;

  wrap.querySelectorAll(".btn-editar").forEach(btn =>
    btn.addEventListener("click", () => abrirEditar(btn.dataset.id)));
  wrap.querySelectorAll(".btn-eliminar").forEach(btn =>
    btn.addEventListener("click", () => abrirEliminar(btn.dataset.id, btn.dataset.vid)));

  renderPaginado(pagWrap, totalPag, ordenadas.length, inicio);
}

function renderPaginado(wrap, totalPag, totalItems, inicio) {
  if (totalPag <= 1) { wrap.innerHTML = ""; return; }

  const hasta = Math.min(inicio + POR_PAGINA, totalItems);
  const info  = `<span style="font-size:.8rem;color:var(--texto-suave);margin-right:.5rem">
                   ${inicio + 1}–${hasta} de ${totalItems}
                 </span>`;

  const btnBase = `style="border:1.5px solid var(--borde);border-radius:6px;padding:.3rem .65rem;
                   font-size:.82rem;cursor:pointer;line-height:1"`;

  const btnActivo   = `style="border:1.5px solid var(--verde);border-radius:6px;padding:.3rem .65rem;
                       font-size:.82rem;cursor:pointer;background:var(--verde);color:#fff;font-weight:700;line-height:1"`;

  let botones = `<button ${btnBase} id="pagPrev" ${paginaActual === 1 ? "disabled" : ""}>‹</button>`;

  for (let i = 1; i <= totalPag; i++) {
    const mostrar = i === 1 || i === totalPag ||
                    (i >= paginaActual - 2 && i <= paginaActual + 2);
    const esElipsis = (i === paginaActual - 3 && i > 1) ||
                      (i === paginaActual + 3 && i < totalPag);
    if (mostrar) {
      botones += `<button ${i === paginaActual ? btnActivo : btnBase} data-pag="${i}">${i}</button>`;
    } else if (esElipsis) {
      botones += `<span style="padding:0 .2rem;color:var(--texto-suave);font-size:.85rem">…</span>`;
    }
  }

  botones += `<button ${btnBase} id="pagNext" ${paginaActual === totalPag ? "disabled" : ""}>›</button>`;

  wrap.innerHTML = info + botones;

  wrap.querySelectorAll("[data-pag]").forEach(btn =>
    btn.addEventListener("click", () => {
      paginaActual = parseInt(btn.dataset.pag);
      renderTabla();
    })
  );
  wrap.querySelector("#pagPrev")?.addEventListener("click", () => { paginaActual--; renderTabla(); });
  wrap.querySelector("#pagNext")?.addEventListener("click", () => { paginaActual++; renderTabla(); });
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

// ════════════════════════════════════════════════════════════
//  SECCIÓN 2 — PLANES DE MEMBRESÍA (independiente)
// ════════════════════════════════════════════════════════════

function formatCOP(n) {
  return "$" + Number(n || 0).toLocaleString("es-CO");
}

function diasAEtiqueta(dias) {
  if (!dias || dias <= 0) return "—";
  const d = Number(dias);
  if (d % 365 === 0) { const y = d / 365; return `${y} año${y > 1 ? "s" : ""}`; }
  if (d % 30  === 0) { const m = d / 30;  return `${m} mes${m > 1 ? "es" : ""}`; }
  if (d % 7   === 0) { const s = d / 7;   return `${s} semana${s > 1 ? "s" : ""}`; }
  return `${d} día${d > 1 ? "s" : ""}`;
}

function renderPlanes() {
  const wrap = document.getElementById("tablaPlanes");
  if (!wrap) return;

  if (!planes.length) {
    wrap.innerHTML = `<p class="vacio-txt" style="padding:1rem 1.5rem">
      No hay planes creados. Crea el primero con el botón "+ Nuevo plan".
    </p>`;
    return;
  }

  wrap.innerHTML = `
    <div style="overflow-x:auto">
      <table>
        <thead>
          <tr>
            <th style="text-align:center">#</th>
            <th>Nombre del plan</th>
            <th>Descripción</th>
            <th>Precio</th>
            <th>Duración</th>
            <th>Días</th>
            <th>Estado</th>
            <th>Acciones</th>
          </tr>
        </thead>
        <tbody>
          ${planes.map((p, i) => `
            <tr>
              <td style="text-align:center;color:var(--texto-suave)">${p.orden ?? i + 1}</td>
              <td><strong>${p.nombre || "—"}</strong></td>
              <td style="max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;
                         color:var(--texto-medio);font-size:.83rem">${p.descripcion || "—"}</td>
              <td><strong style="color:var(--verde)">${formatCOP(p.precio)}</strong></td>
              <td>${diasAEtiqueta(p.duracion_dias)}</td>
              <td style="color:var(--texto-suave);font-size:.83rem">${p.duracion_dias ?? "—"}</td>
              <td>
                ${p.activo
                  ? `<span class="badge badge-activo">Activo</span>`
                  : `<span class="badge badge-suspendida">Inactivo</span>`}
              </td>
              <td>
                <div class="td-acciones">
                  <button class="btn-tabla btn-editar"   data-pid="${p.id}">✏ Editar</button>
                  <button class="btn-tabla btn-eliminar" data-pid="${p.id}" data-pnombre="${p.nombre}">🗑 Eliminar</button>
                </div>
              </td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>`;

  wrap.querySelectorAll(".btn-editar[data-pid]").forEach(btn =>
    btn.addEventListener("click", () => abrirEditarPlan(btn.dataset.pid)));
  wrap.querySelectorAll(".btn-eliminar[data-pid]").forEach(btn =>
    btn.addEventListener("click", () => abrirEliminarPlan(btn.dataset.pid, btn.dataset.pnombre)));
}

// ── Modal nuevo plan ──────────────────────────────────────
document.getElementById("btnNuevoPlan").addEventListener("click", () => {
  limpiarModalPlan();
  document.getElementById("modalPlanTitulo").textContent = "Nuevo plan";
  document.getElementById("planId").value   = "";
  document.getElementById("pOrden").value  = planes.length + 1;
  ocultarMensajesPlan();
  abrirModal("modalPlanOverlay");
});

// ── Modal editar plan ─────────────────────────────────────
function abrirEditarPlan(id) {
  const p = planes.find(x => x.id === id);
  if (!p) return;
  limpiarModalPlan();
  document.getElementById("modalPlanTitulo").textContent = "Editar plan";
  document.getElementById("planId").value         = p.id;
  document.getElementById("pNombre").value        = p.nombre        || "";
  document.getElementById("pDescripcion").value   = p.descripcion   || "";
  document.getElementById("pPrecio").value        = p.precio        ?? "";
  document.getElementById("pDuracionDias").value  = p.duracion_dias ?? "";
  document.getElementById("pOrden").value         = p.orden         ?? "";
  document.getElementById("pActivo").checked      = p.activo        ?? true;
  actualizarHintDuracion();
  ocultarMensajesPlan();
  abrirModal("modalPlanOverlay");
}

// Hint en tiempo real: convierte días a texto legible
document.getElementById("pDuracionDias").addEventListener("input", actualizarHintDuracion);
function actualizarHintDuracion() {
  const d   = parseInt(document.getElementById("pDuracionDias").value);
  const hint = document.getElementById("hintDuracion");
  hint.textContent = d > 0 ? `≈ ${diasAEtiqueta(d)}` : "";
}

// ── Guardar plan ──────────────────────────────────────────
document.getElementById("btnGuardarPlan").addEventListener("click", async () => {
  const id           = document.getElementById("planId").value.trim();
  const nombre       = document.getElementById("pNombre").value.trim();
  const descripcion  = document.getElementById("pDescripcion").value.trim();
  const precio       = parseFloat(document.getElementById("pPrecio").value);
  const duracionDias = parseInt(document.getElementById("pDuracionDias").value);
  const orden        = parseInt(document.getElementById("pOrden").value) || 0;
  const activo       = document.getElementById("pActivo").checked;

  if (!nombre)                              { mostrarErrorPlan("El nombre del plan es obligatorio.");        return; }
  if (isNaN(precio) || precio < 0)          { mostrarErrorPlan("Ingresa un precio válido (mínimo 0).");      return; }
  if (isNaN(duracionDias) || duracionDias < 1) { mostrarErrorPlan("La duración debe ser al menos 1 día."); return; }

  const btn = document.getElementById("btnGuardarPlan");
  btnCargando(btn, true);
  ocultarMensajesPlan();

  try {
    const datos = { nombre, descripcion, precio, duracion_dias: duracionDias, orden, activo };
    if (id) {
      await actualizarPlan(id, datos);
      mostrarOkPlan("Plan actualizado correctamente ✅");
    } else {
      await crearPlan(datos);
      mostrarOkPlan("Plan creado correctamente ✅");
    }
    planes = await obtenerPlanes();
    renderPlanes();
    setTimeout(() => cerrarModal("modalPlanOverlay"), 1400);
  } catch (e) {
    mostrarErrorPlan("Error al guardar el plan. Intenta de nuevo.");
    console.error(e);
  } finally { btnCargando(btn, false); }
});

// ── Eliminar plan ─────────────────────────────────────────
function abrirEliminarPlan(id, nombre) {
  idEliminarPlan = id;
  document.getElementById("nombreEliminarPlan").textContent = nombre || "este plan";
  abrirModal("modalEliminarPlan");
}

document.getElementById("btnConfirmarEliminarPlan").addEventListener("click", async () => {
  const btn = document.getElementById("btnConfirmarEliminarPlan");
  btnCargando(btn, true);
  try {
    await eliminarPlan(idEliminarPlan);
    cerrarModal("modalEliminarPlan");
    planes = await obtenerPlanes();
    renderPlanes();
  } catch (e) { console.error(e); }
  finally { btnCargando(btn, false); }
});

// ── Cerrar modales de planes ──────────────────────────────
document.getElementById("btnCancelarPlan").addEventListener("click", () =>
  cerrarModal("modalPlanOverlay"));
document.getElementById("btnCancelarEliminarPlan").addEventListener("click", () =>
  cerrarModal("modalEliminarPlan"));
document.getElementById("modalPlanOverlay").addEventListener("click", e => {
  if (e.target === document.getElementById("modalPlanOverlay")) cerrarModal("modalPlanOverlay");
});

// ── Helpers planes ────────────────────────────────────────
function limpiarModalPlan() {
  document.getElementById("planId").value         = "";
  document.getElementById("pNombre").value        = "";
  document.getElementById("pDescripcion").value   = "";
  document.getElementById("pPrecio").value        = "";
  document.getElementById("pDuracionDias").value  = "";
  document.getElementById("pOrden").value         = "";
  document.getElementById("pActivo").checked      = true;
  document.getElementById("hintDuracion").textContent = "";
}
function ocultarMensajesPlan() {
  document.getElementById("msgErrorPlan").classList.remove("visible");
  document.getElementById("msgOkPlan").classList.remove("visible");
}
function mostrarErrorPlan(msg) {
  document.getElementById("textoErrorPlan").textContent = msg;
  document.getElementById("msgErrorPlan").classList.add("visible");
  document.getElementById("msgOkPlan").classList.remove("visible");
}
function mostrarOkPlan(msg) {
  document.getElementById("textoOkPlan").textContent = msg;
  document.getElementById("msgOkPlan").classList.add("visible");
  document.getElementById("msgErrorPlan").classList.remove("visible");
}

// ════════════════════════════════════════════════════════════
//  SECCIÓN 3 — FUNDADORES (sin cambios)
// ════════════════════════════════════════════════════════════

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
        : `<div style="overflow-x:auto;-webkit-overflow-scrolling:touch;border-radius:10px;border:1px solid var(--borde)">
            <table style="min-width:560px;border:none">
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
          </table></div>`}
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

// ════════════════════════════════════════════════════════════
//  BUSCAR VENDEDOR + MODAL CREAR / EDITAR MEMBRESÍA (sin cambios)
// ════════════════════════════════════════════════════════════

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

// ── Guardar membresía ─────────────────────────────────────
document.getElementById("btnGuardar").addEventListener("click", async () => {
  const id           = document.getElementById("membresiaId").value;
  const vendedor_id  = document.getElementById("fVendedor").value;
  const fecha_inicio = document.getElementById("fInicio").value;
  const fecha_fin    = document.getElementById("fFin").value;
  const estado       = document.getElementById("fEstado").value;
  const notas        = document.getElementById("fNotas").value.trim();

  if (!vendedor_id)  { mostrarError("Selecciona un vendedor.");                               return; }
  if (!fecha_inicio) { mostrarError("La fecha de inicio es obligatoria.");                    return; }
  if (!fecha_fin)    { mostrarError("La fecha de fin es obligatoria.");                       return; }
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

// ── Eliminar membresía ────────────────────────────────────
function abrirEliminar(id, vid) {
  idEliminar = id;
  document.getElementById("nombreEliminar").textContent = nombreVendedor(vid);
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

// ── Cerrar modales membresía ──────────────────────────────
document.getElementById("btnCancelar").addEventListener("click", () => cerrarModal("modalOverlay"));
document.getElementById("btnCancelarEliminar").addEventListener("click", () => cerrarModal("modalEliminar"));
document.getElementById("modalOverlay").addEventListener("click", e => {
  if (e.target === document.getElementById("modalOverlay")) cerrarModal("modalOverlay");
});

// ── Helpers membresía ─────────────────────────────────────
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