// ============================================================
//  user/js/auth.js — Verificación de sesión vendedor
// ============================================================

async function VerificarSesion() {
  try {
    const response = await fetch('/../backend/sesion.php?accion=verificar&ac=user', {
      credentials: 'include'   // ← faltaba esto
    });
   
    // El 401 significa "sin sesión" → es normal en login, no hacer nada


    const data = await response.json();

    // Si ya tiene sesión activa como vendedor, redirigir al dashboard
    if (!data.ok || data.ok && data.datos?.rol === 1) {
      window.location.href = '../index.html';
    }

  } catch (error) {
    console.error('Error al verificar la sesión:', error);
  }
}

// ── Cerrar sesión ─────────────────────────────────────────
async function cerrarSesion() {
  console.log('Cerrando sesión...');
  try {
    const respuesta = await fetch('../../backend/cerrar.php', { credentials: 'include' });
    const data = await respuesta.json();

    if (data.ok) {
      window.location.href = '../index.html';
    }
  } catch (error) {
    console.error('Error al cerrar sesión:', error);
  }
}

if (document.getElementById('btnSalir')) {
  document.getElementById('btnSalir').addEventListener('click', cerrarSesion);
}

VerificarSesion();