// ============================================================
//  auth.js — Autenticación Admin
//  Protección cruzada: admin no puede entrar por user y viceversa
// ============================================================
import { auth } from "./firebase.js";
import {
  signInWithEmailAndPassword, signOut, onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.10.0/firebase-auth.js";
import { db } from "./firebase.js";
import { collection, query, where, getDocs }
  from "https://www.gstatic.com/firebasejs/12.10.0/firebase-firestore.js";

// Correo del administrador (único autorizado en este panel)
const ADMIN_EMAIL = "aplicativosawebs@gmail.com";

async function iniciarSesion(correo, contrasena) {
  const cred = await signInWithEmailAndPassword(auth, correo, contrasena);
  // Verificar que sea el admin — si no, cerrar sesión inmediatamente
  if (cred.user.email.toLowerCase() !== ADMIN_EMAIL.toLowerCase()) {
    await signOut(auth);
    const err = new Error("No autorizado");
    err.code = "auth/not-admin";
    throw err;
  }
  return cred.user;
}

async function cerrarSesion() {
  await signOut(auth);
}

function protegerPagina(rutaLogin = "../index.html") {
  document.body.style.visibility = "hidden";
  onAuthStateChanged(auth, async user => {
    if (!user) {
      window.location.href = rutaLogin;
      return;
    }
    // Si el usuario logueado NO es el admin → redirigir
    if (user.email.toLowerCase() !== ADMIN_EMAIL.toLowerCase()) {
      await signOut(auth);
      window.location.href = rutaLogin;
      return;
    }
    document.body.style.visibility = "visible";
  });
}

function redirigirSiSesion(rutaDashboard = "pages/dashboard.html") {
  onAuthStateChanged(auth, async user => {
    if (user && user.email.toLowerCase() === ADMIN_EMAIL.toLowerCase()) {
      window.location.href = rutaDashboard;
    }
  });
}

const ERRORES_AUTH = {
  "auth/invalid-credential":     "Correo o contraseña incorrectos.",
  "auth/user-not-found":         "No existe una cuenta con ese correo.",
  "auth/wrong-password":         "Contraseña incorrecta.",
  "auth/too-many-requests":      "Demasiados intentos. Espera unos minutos.",
  "auth/network-request-failed": "Sin conexión. Verifica tu internet.",
  "auth/not-admin":              "Esta cuenta no tiene acceso al panel de administración.",
};

function mensajeError(codigo) {
  return ERRORES_AUTH[codigo] || "Error al iniciar sesión. Intenta de nuevo.";
}

export { iniciarSesion, cerrarSesion, protegerPagina, redirigirSiSesion, mensajeError };