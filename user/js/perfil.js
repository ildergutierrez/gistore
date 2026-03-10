// ============================================================
//  perfil.js — Editar perfil del vendedor
// ============================================================
import { cerrarSesion } from "./auth.js";
import { obtenerVendedorPorUid, actualizarVendedor,
         obtenerMembresiaVendedor, membresiaVigente } from "./db.js";
import { fechaHoy, btnCargando } from "./ui.js";
import { auth } from "./firebase.js";
import { onAuthStateChanged, updatePassword,
         reauthenticateWithCredential, EmailAuthProvider }
  from "https://www.gstatic.com/firebasejs/12.10.0/firebase-auth.js";

// Ocultar cuerpo hasta confirmar sesión
document.body.style.visibility = "hidden";

function el(id) { return document.getElementById(id); }

// Ver/ocultar contraseñas
[
  ["btnVerPassActual", "fPassActual"],
  ["btnVerPassNueva",  "fNewPass"],
  ["btnVerPassConf",   "fConfPass"],
].forEach(([btnId, inputId]) => {
  const btn   = el(btnId);
  const input = el(inputId);
  if (!btn || !input) return;
  btn.addEventListener("click", () => {
    if (input.type === "password") { input.type = "text";     btn.textContent = "🙈"; }
    else                           { input.type = "password"; btn.textContent = "👁"; }
  });
});

let vendedor = null;

// Un solo listener que maneja auth + protección + carga de datos
onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = "../index.html";
    return;
  }

  // Mostrar la página sólo si es un usuario válido (no admin)
  document.body.style.visibility = "visible";

  // Setear fecha y botón salir de forma segura
  if (el("fechaHoy")) el("fechaHoy").textContent = fechaHoy();
  if (el("btnSalir")) {
    el("btnSalir").addEventListener("click", async () => {
      await cerrarSesion();
      window.location.href = "../index.html";
    });
  }

  try {
    vendedor = await obtenerVendedorPorUid(user.uid);
    if (!vendedor) {
      if (el("fNombre")) {
        el("fNombre").value = "";
        el("fNombre").placeholder = "Perfil no encontrado — contacta al admin";
      }
      return;
    }

    if (el("vendedorNombre")) el("vendedorNombre").textContent = vendedor.nombre;
    if (el("fNombre"))    el("fNombre").value   = vendedor.nombre   || "";
    if (el("fCiudad"))    el("fCiudad").value   = vendedor.ciudad   || "";
    if (el("fWhatsapp"))  el("fWhatsapp").value = vendedor.whatsapp || "";
    if (el("fCorreo"))    el("fCorreo").value   = vendedor.correo   || user.email || "";

    // Info cuenta
    const elEstado = el("infoEstado");
    if (elEstado) {
      elEstado.textContent = vendedor.estado === "activo" ? "Activo" : "Inactivo";
      elEstado.className   = "badge badge-" + (vendedor.estado === "activo" ? "activo" : "inactivo");
    }
    const elCreado = el("infoCreadoEn");
    if (elCreado) elCreado.textContent = vendedor.creado_en
      ? new Date(vendedor.creado_en).toLocaleDateString("es-CO") : "—";

    // Membresía
    const mem   = await obtenerMembresiaVendedor(vendedor.id);
    const elMem = el("infoMembresia");
    if (elMem) {
      if (!mem) {
        elMem.textContent = "Sin membresía";
        elMem.style.color = "var(--error)";
      } else if (!membresiaVigente(mem)) {
        elMem.textContent = "Vencida (" + mem.fecha_fin + ")";
        elMem.style.color = "var(--error)";
      } else {
        const dias = Math.ceil((new Date(mem.fecha_fin) - new Date()) / (1000*60*60*24));
        elMem.textContent = "Activa · " + dias + " días restantes";
        elMem.style.color = "var(--verde)";
      }
    }

  } catch (e) {
    console.error("Error cargando perfil:", e);
  }
});

// ── Guardar datos del perfil ──────────────────────────────
if (el("btnGuardarPerfil")) {
  el("btnGuardarPerfil").addEventListener("click", async () => {
    if (!vendedor) { mostrarError("Perfil no cargado. Recarga la página."); return; }

    const nombre   = el("fNombre")   ? el("fNombre").value.trim()   : "";
    const ciudad   = el("fCiudad")   ? el("fCiudad").value.trim()   : "";
    const whatsapp = el("fWhatsapp") ? el("fWhatsapp").value.trim() : "";

    if (!nombre) { mostrarError("El nombre es obligatorio."); return; }

    const btn = el("btnGuardarPerfil");
    btnCargando(btn, true);
    ocultarMensajes();

    try {
      await actualizarVendedor(vendedor.id, { nombre, ciudad, whatsapp });
      sessionStorage.setItem("vendedor_nombre", nombre);
      if (el("vendedorNombre")) el("vendedorNombre").textContent = nombre;
      mostrarOk("✓ Datos actualizados correctamente.");
    } catch (e) {
      mostrarError("Error al guardar. Intenta de nuevo.");
      console.error(e);
    } finally {
      btnCargando(btn, false);
    }
  });
}

// ── Cambiar contraseña ────────────────────────────────────
if (el("btnCambiarPass")) {
  el("btnCambiarPass").addEventListener("click", async () => {
    const passActual = el("fPassActual") ? el("fPassActual").value : "";
    const newPass    = el("fNewPass")    ? el("fNewPass").value    : "";
    const confPass   = el("fConfPass")   ? el("fConfPass").value   : "";

    if (el("msgErrorPass")) el("msgErrorPass").classList.remove("visible");
    if (el("msgOkPass"))    el("msgOkPass").classList.remove("visible");

    if (!passActual) { setErrorPass("Ingresa tu contraseña actual."); return; }
    if (newPass.length < 6) { setErrorPass("La nueva contraseña debe tener al menos 6 caracteres."); return; }
    if (newPass !== confPass) { setErrorPass("Las contraseñas nuevas no coinciden."); return; }
    if (passActual === newPass) { setErrorPass("La nueva contraseña debe ser diferente a la actual."); return; }

    const btn = el("btnCambiarPass");
    btnCargando(btn, true);

    try {
      const user       = auth.currentUser;
      const credential = EmailAuthProvider.credential(user.email, passActual);
      await reauthenticateWithCredential(user, credential);
      await updatePassword(user, newPass);

      if (el("textoOkPass")) el("textoOkPass").textContent = "✓ Contraseña actualizada correctamente.";
      if (el("msgOkPass"))   el("msgOkPass").classList.add("visible");

      ["fPassActual","fNewPass","fConfPass"].forEach(id => {
        if (el(id)) { el(id).value = ""; el(id).type = "password"; }
      });
      ["btnVerPassActual","btnVerPassNueva","btnVerPassConf"].forEach(id => {
        if (el(id)) el(id).textContent = "👁";
      });

    } catch (e) {
      const errores = {
        "auth/wrong-password":        "Contraseña actual incorrecta.",
        "auth/invalid-credential":    "Contraseña actual incorrecta.",
        "auth/weak-password":         "La nueva contraseña es muy débil.",
        "auth/requires-recent-login": "Sesión expirada. Cierra sesión y vuelve a ingresar.",
      };
      setErrorPass(errores[e.code] || "Error: " + e.message);
      console.error(e);
    } finally {
      btnCargando(btn, false);
    }
  });
}

// ── Helpers ───────────────────────────────────────────────
function setErrorPass(msg) {
  if (el("textoErrorPass")) el("textoErrorPass").textContent = msg;
  if (el("msgErrorPass"))   el("msgErrorPass").classList.add("visible");
}
function ocultarMensajes() {
  if (el("msgError")) el("msgError").classList.remove("visible");
  if (el("msgOk"))    el("msgOk").classList.remove("visible");
}
function mostrarError(msg) {
  if (el("textoError")) el("textoError").textContent = msg;
  if (el("msgError"))   el("msgError").classList.add("visible");
  if (el("msgOk"))      el("msgOk").classList.remove("visible");
}
function mostrarOk(msg) {
  if (el("textoOk")) el("textoOk").textContent = msg;
  if (el("msgOk"))   el("msgOk").classList.add("visible");
  if (el("msgError")) el("msgError").classList.remove("visible");
}