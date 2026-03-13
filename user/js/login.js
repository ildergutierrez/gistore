// ============================================================
//  login.js — Login + recuperar contraseña
// ============================================================
import { iniciarSesion, redirigirSiSesion, mensajeError } from "./auth.js";
import { btnCargando } from "./ui.js";
import { auth } from "./firebase.js";
import { sendPasswordResetEmail }
  from "https://www.gstatic.com/firebasejs/12.10.0/firebase-auth.js";

redirigirSiSesion("pages/dashboard.html");

// ── Login ─────────────────────────────────────────────────
const btnLogin    = document.getElementById("btnLogin");
const inputCorreo = document.getElementById("correo");
const inputPass   = document.getElementById("contrasena");
const msgError    = document.getElementById("msgError");
const textoError  = document.getElementById("textoError");

function mostrarError(msg) {
  textoError.textContent = msg;
  msgError.classList.add("visible");
  inputCorreo.classList.add("error-input");
  inputPass.classList.add("error-input");
}
function limpiarError() {
  msgError.classList.remove("visible");
  inputCorreo.classList.remove("error-input");
  inputPass.classList.remove("error-input");
}

async function login() {
  limpiarError();
  const correo = inputCorreo.value.trim();
  const pass   = inputPass.value;
  if (!correo || !pass) { mostrarError("Completa todos los campos."); return; }

  btnCargando(btnLogin, true);
  try {
    await iniciarSesion(correo, pass);
    window.location.href = "pages/dashboard.html";
  } catch (err) {
    mostrarError(mensajeError(err.code));
    btnCargando(btnLogin, false);
  }
}

btnLogin.addEventListener("click", login);
inputPass.addEventListener("keydown",   e => { if (e.key === "Enter") login(); });
inputCorreo.addEventListener("keydown", e => { if (e.key === "Enter") inputPass.focus(); });

// ── Recuperar contraseña ──────────────────────────────────
const btnOlvide        = document.getElementById("btnOlvide");
const panelRecuperar   = document.getElementById("panelRecuperar");
const btnEnviarRecup   = document.getElementById("btnEnviarRecup");
const btnCancelarRecup = document.getElementById("btnCancelarRecup");
const correoRecup      = document.getElementById("correoRecup");
const msgErrorRecup    = document.getElementById("msgErrorRecup");
const textoErrorRecup  = document.getElementById("textoErrorRecup");
const msgOkRecup       = document.getElementById("msgOkRecup");
const textoOkRecup     = document.getElementById("textoOkRecup");

btnOlvide.addEventListener("click", () => {
  // Prellenar con el correo del login si ya lo escribió
  correoRecup.value = inputCorreo.value.trim() || "";
  panelRecuperar.style.display = "block";
  msgErrorRecup.classList.remove("visible");
  msgOkRecup.classList.remove("visible");
  correoRecup.focus();
  btnOlvide.style.display = "none";
});

btnCancelarRecup.addEventListener("click", () => {
  panelRecuperar.style.display = "none";
  btnOlvide.style.display = "inline";
  msgErrorRecup.classList.remove("visible");
  msgOkRecup.classList.remove("visible");
});

btnEnviarRecup.addEventListener("click", async () => {
  const correo = correoRecup.value.trim();
  msgErrorRecup.classList.remove("visible");
  msgOkRecup.classList.remove("visible");

  if (!correo) {
    textoErrorRecup.textContent = "Ingresa tu correo.";
    msgErrorRecup.classList.add("visible");
    return;
  }

  btnCargando(btnEnviarRecup, true);
  try {
    await sendPasswordResetEmail(auth, correo);
    textoOkRecup.textContent = "✓ Enlace enviado. Revisa tu correo (también el spam).";
    msgOkRecup.classList.add("visible");
    correoRecup.value = "";
    // Ocultar botón enviar para evitar doble envío
    btnEnviarRecup.style.display = "none";
    setTimeout(() => {
      panelRecuperar.style.display = "none";
      btnOlvide.style.display = "inline";
      btnEnviarRecup.style.display = "";
    }, 4000);
  } catch (e) {
    const errores = {
      "auth/user-not-found":         "No existe cuenta con ese correo.",
      "auth/invalid-email":          "El formato del correo no es válido.",
      "auth/network-request-failed": "Sin conexión. Verifica tu internet.",
      "auth/too-many-requests":      "Demasiados intentos. Espera unos minutos.",
    };
    textoErrorRecup.textContent = errores[e.code] || "Error al enviar. Intenta de nuevo.";
    msgErrorRecup.classList.add("visible");
    console.error(e);
  } finally {
    btnCargando(btnEnviarRecup, false);
  }
});