/**
 * nav.js — Menú hamburguesa responsive · GI Store 2026
 * Incluir con: <script src="../js/nav.js" defer></script>
 * (ajustar ruta según profundidad del archivo)
 */

(function () {
  const hamburger  = document.getElementById('nav-hamburger');
  const menuMovil  = document.getElementById('nav-menu-movil');

  if (!hamburger || !menuMovil) return;

  // Toggle
  hamburger.addEventListener('click', () => {
    const abierto = menuMovil.classList.toggle('abierto');
    hamburger.classList.toggle('abierto', abierto);
    hamburger.setAttribute('aria-expanded', abierto);
    // Evita scroll del body cuando el menú está abierto
    document.body.style.overflow = abierto ? 'hidden' : '';
  });

  // Cerrar al hacer clic en un enlace
  menuMovil.querySelectorAll('a').forEach(link => {
    link.addEventListener('click', () => {
      menuMovil.classList.remove('abierto');
      hamburger.classList.remove('abierto');
      hamburger.setAttribute('aria-expanded', 'false');
      document.body.style.overflow = '';
    });
  });

  // Cerrar al hacer clic fuera
  document.addEventListener('click', (e) => {
    if (
      menuMovil.classList.contains('abierto') &&
      !menuMovil.contains(e.target) &&
      !hamburger.contains(e.target)
    ) {
      menuMovil.classList.remove('abierto');
      hamburger.classList.remove('abierto');
      hamburger.setAttribute('aria-expanded', 'false');
      document.body.style.overflow = '';
    }
  });

  // Cerrar con Escape
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && menuMovil.classList.contains('abierto')) {
      menuMovil.classList.remove('abierto');
      hamburger.classList.remove('abierto');
      hamburger.setAttribute('aria-expanded', 'false');
      document.body.style.overflow = '';
    }
  });
})();