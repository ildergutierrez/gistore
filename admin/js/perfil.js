// ============================================================
//  perfil.js — Perfil del administrador
// ============================================================
import { cerrarSesion } from "./auth.js";
import { fechaHoy, btnCargando } from "./ui.js";
import { auth } from "./firebase.js";
import { onAuthStateChanged, updatePassword,
         reauthenticateWithCredential, EmailAuthProvider }
  from "https://www.gstatic.com/firebasejs/12.10.0/firebase-auth.js";

document.body.style.visibility = "hidden";
document.getElementById("fechaHoy").textContent = fechaHoy();
document.getElementById("btnSalir").addEventListener("click", async () => {
  await cerrarSesion(); window.location.href = "../index.html";
});

// Ver/ocultar contraseñas
[["btnVerPass1","fPassActual"],["btnVerPass2","fNewPass"],["btnVerPass3","fConfPass"]].forEach(([b,i]) => {
  document.getElementById(b).addEventListener("click", () => {
    const inp = document.getElementById(i);
    const btn = document.getElementById(b);
    if (inp.type === "password") { inp.type = "text"; btn.textContent = "🙈"; }
    else { inp.type = "password"; btn.textContent = "👁"; }
  });
});

const ADMIN_EMAIL = "aplicativosawebs@gmail.com";

onAuthStateChanged(auth, async (user) => {
  if (!user || user.email.toLowerCase() !== ADMIN_EMAIL.toLowerCase()) {
    window.location.href = "../index.html";
    return;
  }
  document.body.style.visibility = "visible";

  // Llenar datos
  document.getElementById("fCorreo").value   = user.email;
  document.getElementById("infoCorreo").textContent = user.email;
  document.getElementById("infoSesion").textContent = user.metadata.lastSignInTime
    ? new Date(user.metadata.lastSignInTime).toLocaleString("es-CO") : "—";

  // Nombre guardado en localStorage
  const nombre = localStorage.getItem("admin_nombre") || "Administrador";
  document.getElementById("fNombre").value = nombre;
});

// ── Guardar nombre ────────────────────────────────────────
document.getElementById("btnGuardarPerfil").addEventListener("click", async () => {
  const nombre = document.getElementById("fNombre").value.trim();
  if (!nombre) { mostrarError("El nombre es obligatorio."); return; }
  const btn = document.getElementById("btnGuardarPerfil");
  btnCargando(btn, true); ocultarMensajes();
  try {
    localStorage.setItem("admin_nombre", nombre);
    mostrarOk("✓ Nombre actualizado correctamente.");
  } catch (e) {
    mostrarError("Error al guardar."); console.error(e);
  } finally { btnCargando(btn, false); }
});

// ── Cambiar contraseña ────────────────────────────────────
document.getElementById("btnCambiarPass").addEventListener("click", async () => {
  const passActual = document.getElementById("fPassActual").value;
  const newPass    = document.getElementById("fNewPass").value;
  const confPass   = document.getElementById("fConfPass").value;

  document.getElementById("msgErrorPass").classList.remove("visible");
  document.getElementById("msgOkPass").classList.remove("visible");

  if (!passActual)       { setErrPass("Ingresa tu contraseña actual."); return; }
  if (newPass.length < 6){ setErrPass("La nueva contraseña debe tener al menos 6 caracteres."); return; }
  if (newPass !== confPass){ setErrPass("Las contraseñas no coinciden."); return; }
  if (passActual === newPass){ setErrPass("La nueva contraseña debe ser diferente."); return; }

  const btn = document.getElementById("btnCambiarPass");
  btnCargando(btn, true);
  try {
    const user       = auth.currentUser;
    const credential = EmailAuthProvider.credential(user.email, passActual);
    await reauthenticateWithCredential(user, credential);
    await updatePassword(user, newPass);
    document.getElementById("textoOkPass").textContent = "✓ Contraseña actualizada.";
    document.getElementById("msgOkPass").classList.add("visible");
    ["fPassActual","fNewPass","fConfPass"].forEach(id => { document.getElementById(id).value = ""; document.getElementById(id).type = "password"; });
    ["btnVerPass1","btnVerPass2","btnVerPass3"].forEach(id => { document.getElementById(id).textContent = "👁"; });
  } catch (e) {
    const errores = {
      "auth/wrong-password":        "Contraseña actual incorrecta.",
      "auth/invalid-credential":    "Contraseña actual incorrecta.",
      "auth/weak-password":         "La nueva contraseña es muy débil.",
      "auth/requires-recent-login": "Sesión expirada. Cierra sesión y vuelve a ingresar.",
    };
    setErrPass(errores[e.code] || "Error: " + e.message); console.error(e);
  } finally { btnCargando(btn, false); }
});

function setErrPass(msg) {
  document.getElementById("textoErrorPass").textContent = msg;
  document.getElementById("msgErrorPass").classList.add("visible");
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