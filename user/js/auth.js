// ============================================================
//  auth.js — Autenticación portal vendedores
//  Protección cruzada: el admin no puede ingresar aquí
// ============================================================
import { auth } from "./firebase.js";
import {
  signInWithEmailAndPassword, signOut, onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.10.0/firebase-auth.js";

// Correo del admin — bloqueado en este portal
const ADMIN_EMAIL = "aplicativosawebs@gmail.com";

async function iniciarSesion(correo, contrasena) {
  // Bloquear al admin
  if (correo.toLowerCase() === ADMIN_EMAIL.toLowerCase()) {
    const err = new Error("No autorizado");
    err.code = "auth/is-admin";
    throw err;
  }
  const cred = await signInWithEmailAndPassword(auth, correo, contrasena);
  return cred.user;
}

async function cerrarSesion() {
  await signOut(auth);
}

function protegerPagina(rutaLogin = "../index.html") {
  // Ocultar hasta confirmar sesión válida
  document.body.style.visibility = "hidden";

  onAuthStateChanged(auth, async user => {
    // Sin sesión → ir al login
    if (!user) {
      window.location.href = rutaLogin;
      return;
    }
    // Admin intentando entrar al portal de vendedores → bloquear
    if (user.email.toLowerCase() === ADMIN_EMAIL.toLowerCase()) {
      await signOut(auth);
      window.location.href = rutaLogin;
      return;
    }
    // Usuario válido → mostrar página
    document.body.style.visibility = "visible";
  });
}

function redirigirSiSesion(rutaDashboard = "pages/dashboard.html") {
  onAuthStateChanged(auth, user => {
    if (user && user.email.toLowerCase() !== ADMIN_EMAIL.toLowerCase()) {
      window.location.href = rutaDashboard;
    }
  });
}

function usuarioActual() {
  return auth.currentUser;
}

const ERRORES_AUTH = {
  "auth/invalid-credential":     "Correo o contraseña incorrectos.",
  "auth/user-not-found":         "No existe una cuenta con ese correo.",
  "auth/wrong-password":         "Contraseña incorrecta.",
  "auth/too-many-requests":      "Demasiados intentos. Espera unos minutos.",
  "auth/network-request-failed": "Sin conexión. Verifica tu internet.",
  "auth/is-admin":               "Esta cuenta es del administrador. Ingresa por el panel admin.",
};

function mensajeError(codigo) {
  return ERRORES_AUTH[codigo] || "Error al iniciar sesión. Intenta de nuevo.";
}

export { iniciarSesion, cerrarSesion, protegerPagina, redirigirSiSesion, usuarioActual, mensajeError };