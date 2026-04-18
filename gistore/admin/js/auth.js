// ============================================================
//  admin/js/auth.js — Autenticación Admin (MySQL + PHP)
//  Reemplaza Firebase Authentication
//  El admin tiene rol = 1 en la tabla usuarios
// ============================================================
//verificar sesion por async
async function VerificarSesion(){
  try{
    const response = await fetch('/../backend/sesion.php?accion=verificar&ac=admin');
    const data = await response.json();
    //ver los datos de la respuesta

    
    if(!data.ok && data.datos['rol'] === 1){
      // El usuario es admin, permitir acceso
    
      window.location.href = '../../index.html'; // Redirige a index.html
    }
  } catch (error) {
    console.error('Error al verificar la sesion:', error);

  }
}
// ── Cerrar sesión ─────────────────────────────────────────
async function cerrarSesion() {
  console.log('Cerrando sesión...');
  const respuesta =  await fetch('../../backend/cerrar.php', { credentials: 'include' });
   const data = await respuesta.json();
   if(data.ok){
     window.location.href = '../../index.html'; // Redirige a index.html
   }

}
// ── Cerrar sesión ─────────────────────────────────────────
document.getElementById('btnSalir').addEventListener('click', cerrarSesion);

VerificarSesion();