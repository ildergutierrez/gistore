// ============================================================
//  vendedores.js — Gestión de vendedores + creación en Auth
// ============================================================
import { cerrarSesion, protegerPagina } from "./auth.js";
import {
  obtenerVendedores, crearVendedor,
  actualizarVendedor, eliminarVendedor
} from "./db.js";
import { fechaHoy, btnCargando, abrirModal, cerrarModal } from "./ui.js";
import { auth } from "./firebase.js";
import { createUserWithEmailAndPassword }
  from "https://www.gstatic.com/firebasejs/12.10.0/firebase-auth.js";

protegerPagina("../index.html");

document.getElementById("fechaHoy").textContent = fechaHoy();
document.getElementById("btnSalir").addEventListener("click", async () => {
  await cerrarSesion(); window.location.href = "../index.html";
});

// ── Paleta de colores ─────────────────────────────────────
const COLORES = [
  "#1a6b3c","#2d8a56","#4caf50","#81c784","#a5d6a7",
  "#1565c0","#1976d2","#2196f3","#64b5f6","#0891b2",
  "#b71c1c","#dc2626","#e53935","#e91e63","#be185d",
  "#6a1b9a","#7c3aed","#9c27b0","#ab47bc","#8e24aa",
  "#e65100","#d97706","#f57c00","#ffa726","#fbc02d",
  "#4e342e","#795548","#92400e","#6d4c41","#a1887f",
  "#1a1a2e","#374151","#1e3a5f","#263238","#455a64",
  "#006064","#00838f","#00acc1","#26c6da","#00bcd4",
];

function actualizarPreview(color) {
  document.getElementById("fColor").value = color;
  document.getElementById("colorPicker").value = color;
  document.getElementById("colorPreview").style.background = color;
  document.getElementById("colorHex").textContent = color.toUpperCase();
}

function renderColorFila(colorActual) {
  const fila = document.getElementById("colorFila");
  fila.innerHTML = COLORES.map(c => `
    <div class="color-op"
         style="background:${c};width:100%;aspect-ratio:1;border-radius:8px;cursor:pointer;
                border:2px solid transparent;transition:transform .15s,border-color .15s;
                box-shadow:0 1px 3px rgba(0,0,0,.2)"
         data-color="${c}" title="${c}"></div>
  `).join("");

  fila.querySelectorAll(".color-op").forEach(el => {
    el.addEventListener("click", () => {
      fila.querySelectorAll(".color-op").forEach(e => {
        e.style.borderColor = "transparent";
        e.style.transform = "scale(1)";
      });
      el.style.borderColor = "#fff";
      el.style.transform = "scale(1.2)";
      actualizarPreview(el.dataset.color);
    });
    if (el.dataset.color.toLowerCase() === colorActual.toLowerCase()) {
      el.style.borderColor = "#fff";
      el.style.transform = "scale(1.2)";
    }
  });

  actualizarPreview(colorActual);

  document.getElementById("colorPicker").oninput = (e) => {
    fila.querySelectorAll(".color-op").forEach(el => {
      el.style.borderColor = "transparent";
      el.style.transform = "scale(1)";
    });
    actualizarPreview(e.target.value);
  };
}

// ── Ver/ocultar contraseña (modal crear) ──────────────────
document.getElementById("btnVerPass").addEventListener("click", () => {
  const input = document.getElementById("fPassword");
  const btn   = document.getElementById("btnVerPass");
  if (input.type === "password") { input.type = "text";     btn.textContent = "🙈"; }
  else                           { input.type = "password"; btn.textContent = "👁"; }
});

// ── Estado global ─────────────────────────────────────────
let vendedores = [];
let idEliminar = "";
let idVincular = "";

// ── Cargar tabla ──────────────────────────────────────────
async function cargar() {
  try {
    vendedores = await obtenerVendedores();
    document.getElementById("totalVendedores").textContent =
      vendedores.length + " vendedor" + (vendedores.length !== 1 ? "es" : "");
    renderTabla();
  } catch (e) { console.error(e); }
}

function renderTabla() {
  const wrap = document.getElementById("tablaWrap");
  if (!vendedores.length) {
    wrap.innerHTML = '<p class="vacio-txt">Sin vendedores registrados. Crea el primero.</p>';
    return;
  }
  wrap.innerHTML = `
    <table>
      <thead>
        <tr>
          <th>Color</th><th>Nombre</th><th>Ciudad</th>
          <th>WhatsApp</th><th>Correo</th><th>Acceso</th><th>Estado</th><th>Acciones</th>
        </tr>
      </thead>
      <tbody>
        ${vendedores.map(v => `
          <tr>
            <td><div style="width:22px;height:22px;border-radius:50%;background:${v.color||'#1a6b3c'};border:2px solid #ddd"></div></td>
            <td><strong>${v.nombre}</strong></td>
            <td>${v.ciudad || "—"}</td>
            <td>${v.whatsapp
              ? `<a href="https://wa.me/${v.whatsapp}" target="_blank" style="color:var(--verde);text-decoration:none">📱 ${v.whatsapp}</a>`
              : "—"}</td>
            <td>${v.correo || "—"}</td>
            <td>${v.uid_auth
              ? `<span class="badge badge-activo" title="UID: ${v.uid_auth}">✓ Con acceso</span>`
              : `<span class="badge badge-inactivo">Sin acceso</span>`}</td>
            <td><span class="badge badge-${v.estado==='activo'?'activo':'inactivo'}">
              ${v.estado==='activo'?'Activo':'Inactivo'}
            </span></td>
            <td>
              <div class="td-acciones">
                <button class="btn-tabla btn-editar"   data-id="${v.id}">✏ Editar</button>
                ${!v.uid_auth ? `<button class="btn-tabla btn-vincular" data-id="${v.id}" data-correo="${v.correo}" style="background:var(--adv-bg);color:var(--advertencia);border:1.5px solid var(--adv-borde)">🔑 Vincular</button>` : ""}
                <button class="btn-tabla btn-eliminar" data-id="${v.id}" data-nombre="${v.nombre}">🗑 Eliminar</button>
              </div>
            </td>
          </tr>`).join("")}
      </tbody>
    </table>`;

  wrap.querySelectorAll(".btn-editar").forEach(btn =>
    btn.addEventListener("click", () => abrirEditar(btn.dataset.id)));
  wrap.querySelectorAll(".btn-vincular").forEach(btn =>
    btn.addEventListener("click", () => abrirVincular(btn.dataset.id, btn.dataset.correo)));
  wrap.querySelectorAll(".btn-eliminar").forEach(btn =>
    btn.addEventListener("click", () => abrirEliminar(btn.dataset.id, btn.dataset.nombre)));
}

// ── Modal crear ───────────────────────────────────────────
document.getElementById("btnNuevo").addEventListener("click", () => {
  limpiarModal();
  document.getElementById("modalTitulo").textContent = "Nuevo vendedor";
  document.getElementById("vendedorId").value = "";
  document.getElementById("campoPassword").style.display = "block";
  renderColorFila("#1a6b3c");
  ocultarMensajes();
  abrirModal("modalOverlay");
});

// ── Modal editar ──────────────────────────────────────────
function abrirEditar(id) {
  const v = vendedores.find(x => x.id === id);
  if (!v) return;
  limpiarModal();
  document.getElementById("modalTitulo").textContent = "Editar vendedor";
  document.getElementById("vendedorId").value  = v.id;
  document.getElementById("fNombre").value     = v.nombre   || "";
  document.getElementById("fCiudad").value     = v.ciudad   || "";
  document.getElementById("fCorreo").value     = v.correo   || "";
  document.getElementById("fWhatsapp").value   = v.whatsapp || "";
  document.getElementById("fColor").value      = v.color    || "#1a6b3c";
  document.getElementById("fEstado").value     = v.estado   || "inactivo";
  document.getElementById("campoPassword").style.display = v.uid_auth ? "none" : "block";
  renderColorFila(v.color || "#1a6b3c");
  ocultarMensajes();
  abrirModal("modalOverlay");
}

// ── Guardar vendedor ──────────────────────────────────────
document.getElementById("btnGuardar").addEventListener("click", async () => {
  const id       = document.getElementById("vendedorId").value;
  const nombre   = document.getElementById("fNombre").value.trim();
  const ciudad   = document.getElementById("fCiudad").value.trim();
  const correo   = document.getElementById("fCorreo").value.trim();
  const password = document.getElementById("fPassword").value;
  const whatsapp = document.getElementById("fWhatsapp").value.trim();
  const color    = document.getElementById("fColor").value;
  const estado   = document.getElementById("fEstado").value;

  if (!nombre) { mostrarError("El nombre es obligatorio."); return; }
  if (!correo) { mostrarError("El correo es obligatorio."); return; }
  if (!id && !password) { mostrarError("La contraseña es obligatoria para crear el acceso."); return; }
  if (!id && password.length < 6) { mostrarError("La contraseña debe tener al menos 6 caracteres."); return; }

  const btn = document.getElementById("btnGuardar");
  btnCargando(btn, true);
  ocultarMensajes();

  try {
    let uid_auth = "";
    if (!id) {
      mostrarOk("Creando acceso...");
      const cred = await createUserWithEmailAndPassword(auth, correo, password);
      uid_auth = cred.user.uid;
    }

    const datos = { nombre, ciudad, correo, whatsapp, color, estado };
    if (uid_auth) datos.uid_auth = uid_auth;

    if (id) {
      await actualizarVendedor(id, datos);
      mostrarOk("Vendedor actualizado correctamente.");
    } else {
      await crearVendedor({ ...datos, uid_auth });
      mostrarOk("✓ Vendedor creado con acceso al portal.");
    }

    await cargar();
    setTimeout(() => cerrarModal("modalOverlay"), 2000);

  } catch (e) {
    console.error(e);
    const errores = {
      "auth/email-already-in-use":   "Este correo ya tiene una cuenta registrada.",
      "auth/invalid-email":          "El formato del correo no es válido.",
      "auth/weak-password":          "Contraseña débil. Usa al menos 6 caracteres.",
      "auth/network-request-failed": "Sin conexión. Verifica tu internet.",
    };
    mostrarError(errores[e.code] || "Error: " + e.message);
  } finally {
    btnCargando(btn, false);
  }
});

// ── Modal vincular acceso ─────────────────────────────────
function abrirVincular(id, correo) {
  idVincular = id;
  document.getElementById("vCorreo").value   = correo || "";
  document.getElementById("vPassword").value = "";
  document.getElementById("vPassword").type  = "password";
  document.getElementById("btnVerPassV").textContent = "👁";
  document.getElementById("msgErrorV").classList.remove("visible");
  document.getElementById("msgOkV").classList.remove("visible");
  abrirModal("modalVincular");
}

document.getElementById("btnVerPassV").addEventListener("click", () => {
  const input = document.getElementById("vPassword");
  const btn   = document.getElementById("btnVerPassV");
  if (input.type === "password") { input.type = "text";     btn.textContent = "🙈"; }
  else                           { input.type = "password"; btn.textContent = "👁"; }
});

document.getElementById("btnConfirmarVincular").addEventListener("click", async () => {
  const correo   = document.getElementById("vCorreo").value.trim();
  const password = document.getElementById("vPassword").value;

  if (!correo) {
    document.getElementById("textoErrorV").textContent = "El correo es obligatorio.";
    document.getElementById("msgErrorV").classList.add("visible"); return;
  }
  if (password.length < 6) {
    document.getElementById("textoErrorV").textContent = "La contraseña debe tener al menos 6 caracteres.";
    document.getElementById("msgErrorV").classList.add("visible"); return;
  }

  const btn = document.getElementById("btnConfirmarVincular");
  btnCargando(btn, true);
  document.getElementById("msgErrorV").classList.remove("visible");
  document.getElementById("msgOkV").classList.remove("visible");

  try {
    const cred     = await createUserWithEmailAndPassword(auth, correo, password);
    const uid_auth = cred.user.uid;
    await actualizarVendedor(idVincular, { uid_auth, correo });
    document.getElementById("textoOkV").textContent = "✓ Acceso vinculado correctamente.";
    document.getElementById("msgOkV").classList.add("visible");
    await cargar();
    setTimeout(() => cerrarModal("modalVincular"), 1500);
  } catch (e) {
    const errores = {
      "auth/email-already-in-use":   "Este correo ya tiene cuenta. Ve a Firebase Auth, copia el UID y actualízalo en Firestore.",
      "auth/invalid-email":          "El formato del correo no es válido.",
      "auth/weak-password":          "Contraseña débil. Usa al menos 6 caracteres.",
      "auth/network-request-failed": "Sin conexión. Verifica tu internet.",
    };
    document.getElementById("textoErrorV").textContent = errores[e.code] || "Error: " + e.message;
    document.getElementById("msgErrorV").classList.add("visible");
    console.error(e);
  } finally {
    btnCargando(btn, false);
  }
});

document.getElementById("btnCancelarVincular").addEventListener("click", () => cerrarModal("modalVincular"));
document.getElementById("modalVincular").addEventListener("click", e => {
  if (e.target === document.getElementById("modalVincular")) cerrarModal("modalVincular");
});

// ── Modal eliminar ────────────────────────────────────────
function abrirEliminar(id, nombre) {
  idEliminar = id;
  document.getElementById("nombreEliminar").textContent = nombre;
  abrirModal("modalEliminar");
}

document.getElementById("btnConfirmarEliminar").addEventListener("click", async () => {
  const btn = document.getElementById("btnConfirmarEliminar");
  btnCargando(btn, true);
  try {
    await eliminarVendedor(idEliminar);
    cerrarModal("modalEliminar");
    await cargar();
  } catch (e) { console.error(e); }
  finally { btnCargando(btn, false); }
});

// ── Cerrar modales ────────────────────────────────────────
document.getElementById("btnCancelar").addEventListener("click",        () => cerrarModal("modalOverlay"));
document.getElementById("btnCancelarEliminar").addEventListener("click", () => cerrarModal("modalEliminar"));
document.getElementById("modalOverlay").addEventListener("click", e => {
  if (e.target === document.getElementById("modalOverlay")) cerrarModal("modalOverlay");
});
document.getElementById("modalEliminar").addEventListener("click", e => {
  if (e.target === document.getElementById("modalEliminar")) cerrarModal("modalEliminar");
});

// ── Helpers ───────────────────────────────────────────────
function limpiarModal() {
  ["fNombre","fCiudad","fCorreo","fWhatsapp","fPassword"].forEach(id => {
    document.getElementById(id).value = "";
  });
  document.getElementById("fPassword").type         = "password";
  document.getElementById("btnVerPass").textContent = "👁";
  document.getElementById("fEstado").value = "activo";
  document.getElementById("fColor").value  = "#1a6b3c";
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