// ============================================================
//  categorias.js — Gestión de categorías
// ============================================================
import { cerrarSesion, protegerPagina } from "./auth.js";
import {
  obtenerCategorias, crearCategoria,
  actualizarCategoria, eliminarCategoria
} from "./db.js";
import { fechaHoy, btnCargando, abrirModal, cerrarModal } from "./ui.js";

protegerPagina("../index.html");

document.getElementById("fechaHoy").textContent = fechaHoy();
document.getElementById("btnSalir").addEventListener("click", async () => {
  await cerrarSesion(); window.location.href = "../index.html";
});

// ── Estado global ─────────────────────────────────────────
let categorias = [];
let idEliminar = "";

// ── Cargar ────────────────────────────────────────────────
async function cargar() {
  try {
    categorias = await obtenerCategorias();
    document.getElementById("totalCategorias").textContent =
      categorias.length + " categoría" + (categorias.length !== 1 ? "s" : "");
    renderTabla();
  } catch (e) { console.error(e); }
}

function renderTabla() {
  const wrap = document.getElementById("tablaWrap");
  if (!categorias.length) {
    wrap.innerHTML = '<p class="vacio-txt">Sin categorías registradas.</p>';
    return;
  }
  wrap.innerHTML = `
    <table>
      <thead>
        <tr>
          <th>Orden</th>
          <th>Nombre</th>
          <th>Acciones</th>
        </tr>
      </thead>
      <tbody>
        ${categorias.map(c => `
          <tr>
            <td><span class="badge" style="background:var(--verde-claro);color:var(--verde);font-weight:700">${c.orden}</span></td>
            <td><strong>${c.nombre}</strong></td>
            <td>
              <div class="td-acciones">
                <button class="btn-tabla btn-editar"   data-id="${c.id}">✏ Editar</button>
                <button class="btn-tabla btn-eliminar" data-id="${c.id}" data-nombre="${c.nombre}">🗑 Eliminar</button>
              </div>
            </td>
          </tr>`).join("")}
      </tbody>
    </table>`;

  wrap.querySelectorAll(".btn-editar").forEach(btn =>
    btn.addEventListener("click", () => abrirEditar(btn.dataset.id)));
  wrap.querySelectorAll(".btn-eliminar").forEach(btn =>
    btn.addEventListener("click", () => abrirEliminar(btn.dataset.id, btn.dataset.nombre)));
}

// ── Modal crear ───────────────────────────────────────────
document.getElementById("btnNuevo").addEventListener("click", () => {
  limpiarModal();
  document.getElementById("modalTitulo").textContent = "Nueva categoría";
  document.getElementById("categoriaId").value = "";
  document.getElementById("fOrden").value = categorias.length + 1;
  ocultarMensajes();
  abrirModal("modalOverlay");
});

// ── Modal editar ──────────────────────────────────────────
function abrirEditar(id) {
  const c = categorias.find(x => x.id === id);
  if (!c) return;
  limpiarModal();
  document.getElementById("modalTitulo").textContent = "Editar categoría";
  document.getElementById("categoriaId").value = c.id;
  document.getElementById("fNombre").value     = c.nombre || "";
  document.getElementById("fOrden").value      = c.orden  || 1;
  ocultarMensajes();
  abrirModal("modalOverlay");
}

// ── Guardar ───────────────────────────────────────────────
document.getElementById("btnGuardar").addEventListener("click", async () => {
  const id     = document.getElementById("categoriaId").value;
  const nombre = document.getElementById("fNombre").value.trim();
  const orden  = Number(document.getElementById("fOrden").value) || 1;

  if (!nombre) { mostrarError("El nombre es obligatorio."); return; }

  const btn = document.getElementById("btnGuardar");
  btnCargando(btn, true);
  ocultarMensajes();

  try {
    if (id) {
      await actualizarCategoria(id, { nombre, orden });
      mostrarOk("Categoría actualizada.");
    } else {
      await crearCategoria({ nombre, orden });
      mostrarOk("Categoría creada.");
    }
    await cargar();
    setTimeout(() => cerrarModal("modalOverlay"), 1000);
  } catch (e) {
    mostrarError("Error al guardar. Intenta de nuevo.");
    console.error(e);
  } finally {
    btnCargando(btn, false);
  }
});

// ── Eliminar ──────────────────────────────────────────────
function abrirEliminar(id, nombre) {
  idEliminar = id;
  document.getElementById("nombreEliminar").textContent = nombre;
  abrirModal("modalEliminar");
}
document.getElementById("btnConfirmarEliminar").addEventListener("click", async () => {
  const btn = document.getElementById("btnConfirmarEliminar");
  btnCargando(btn, true);
  try {
    await eliminarCategoria(idEliminar);
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
  document.getElementById("fNombre").value = "";
  document.getElementById("fOrden").value  = "";
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