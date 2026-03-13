// ============================================================
//  login.js — Login admin + recuperar contraseña
// ============================================================
import { iniciarSesion, redirigirSiSesion, mensajeError } from "./auth.js";
import { btnCargando } from "./ui.js";
import { auth } from "./firebase.js";
import { sendPasswordResetEmail }
  from "https://www.gstatic.com/firebasejs/12.10.0/firebase-auth.js";

redirigirSiSesion("pages/dashboard.html");

const btnLogin    = document.getElementById("btnLogin");
const inputCorreo = document.getElementById("correo");
const inputPass   = document.getElementById("contrasena");
const msgError    = document.getElementById("msgError");
const textoError  = document.getElementById("textoError");

// Ver/ocultar contraseña
document.getElementById("btnVerPass").addEventListener("click", () => {
  const input = document.getElementById("contrasena");
  const btn   = document.getElementById("btnVerPass");
  if (input.type === "password") { input.type = "text";     btn.textContent = "🙈"; }
  else                           { input.type = "password"; btn.textContent = "👁"; }
});

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
document.getElementById("btnOlvide").addEventListener("click", () => {
  document.getElementById("correoRecup").value = inputCorreo.value.trim();
  document.getElementById("panelRecuperar").style.display = "block";
  document.getElementById("msgErrorRecup").classList.remove("visible");
  document.getElementById("msgOkRecup").classList.remove("visible");
  document.getElementById("btnOlvide").style.display = "none";
  document.getElementById("correoRecup").focus();
});

document.getElementById("btnCancelarRecup").addEventListener("click", () => {
  document.getElementById("panelRecuperar").style.display = "none";
  document.getElementById("btnOlvide").style.display = "inline";
});

document.getElementById("btnEnviarRecup").addEventListener("click", async () => {
  const correo = document.getElementById("correoRecup").value.trim();
  document.getElementById("msgErrorRecup").classList.remove("visible");
  document.getElementById("msgOkRecup").classList.remove("visible");

  if (!correo) {
    document.getElementById("textoErrorRecup").textContent = "Ingresa tu correo.";
    document.getElementById("msgErrorRecup").classList.add("visible"); return;
  }
  const btn = document.getElementById("btnEnviarRecup");
  btnCargando(btn, true);
  try {
    await sendPasswordResetEmail(auth, correo);
    document.getElementById("textoOkRecup").textContent = "✓ Enlace enviado. Revisa tu correo (también el spam).";
    document.getElementById("msgOkRecup").classList.add("visible");
    document.getElementById("correoRecup").value = "";
    document.getElementById("btnEnviarRecup").style.display = "none";
    setTimeout(() => {
      document.getElementById("panelRecuperar").style.display = "none";
      document.getElementById("btnOlvide").style.display = "inline";
      document.getElementById("btnEnviarRecup").style.display = "";
    }, 4000);
  } catch (e) {
    const errores = {
      "auth/user-not-found":  "No existe cuenta con ese correo.",
      "auth/invalid-email":   "Formato de correo inválido.",
      "auth/too-many-requests": "Demasiados intentos. Espera unos minutos.",
    };
    document.getElementById("textoErrorRecup").textContent = errores[e.code] || "Error al enviar.";
    document.getElementById("msgErrorRecup").classList.add("visible");
  } finally {
    btnCargando(btn, false);
  }
});