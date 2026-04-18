// ============================================================
//  gistore/admin/server/control/notif_global.js
//  Incluir en TODOS los HTML del módulo de comunicaciones.
//  Consulta correos sin leer reales via IMAP cada 90 segundos
//  y actualiza el badge del sidebar.
//
//  Uso: <script src="../control/notif_global.js"></script>
//  Colocar DESPUÉS de auth.js y ANTES del </body>
// ============================================================

(function () {
  'use strict';

  let _tokenCache = null;

  async function getToken() {
    if (_tokenCache) return _tokenCache;
    try {
      const r = await fetch('../backend/tokens.php', { credentials: 'include' });
      _tokenCache = (await r.json()).token || '';
    } catch { _tokenCache = ''; }
    return _tokenCache;
  }

  async function actualizarBadge() {
    try {
      const token = await getToken();
      const r     = await fetch(`../backend/notificaciones.php?accion=sin_leer&token=${token}`, {
        credentials: 'include'
      });
      const data  = await r.json();
      if (!data.ok) return;

      const n = data.datos?.sin_leer ?? 0;

      // Actualizar TODOS los badges del sidebar con la clase badge-nav
      // que estén dentro del enlace de bandeja
      document.querySelectorAll(
        '.nav a[href="bandeja.html"] .badge-nav, ' +
        '.nav a[href="bandeja.html"] [id^="badge"], ' +
        '#badgeSinLeer'
      ).forEach(el => {
        el.textContent    = n > 0 ? String(n) : '';
        el.style.display  = n > 0 ? '' : 'none';
      });

    } catch { /* fallo silencioso — no interrumpir la UI */ }
  }

  // Ejecutar al cargar y luego cada 90 segundos
  actualizarBadge();
  setInterval(actualizarBadge, 90_000);

})();
