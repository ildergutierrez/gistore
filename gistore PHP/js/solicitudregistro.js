/**
 * solicitudregistro.js
 * Lógica completa del modal "Solicitar registro" de GI Store.
 * Requiere: colombia-ciudades.js cargado antes en el HTML.
 * Envía los datos al PHP via fetch (PHPMailer).
 */

(() => {
  const PHP = '../php/solicitudregistro.php';
  const $   = id => document.getElementById(id);

  // ── Helpers ───────────────────────────────────────────────
  const vEmail = e => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e.trim());
  const vTel   = t => /^\d{7,15}$/.test(t.replace(/\s/g, ''));

  function mostrarError(msg) {
    const el = $('modalError');
    el.textContent = msg;
    el.classList.add('visible');
    el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
  function ocultarError() { $('modalError').classList.remove('visible'); }
  function markInv(id, bad) { $(id)?.classList.toggle('invalido', bad); }

  function setLoading(on) {
    $('btnEnviar').disabled   = on;
    $('btnTexto').textContent = on ? 'Enviando…' : 'Enviar solicitud';
    $('spinner').style.display = on ? 'block' : 'none';
  }

  // ── Pasos animados ────────────────────────────────────────
  const PASOS = ['pasoReg1', 'pasoReg2', 'pasoReg3'];

  function animarPasos() {
    const [p1, p2, p3] = PASOS.map(id => $(id));
    if (!p1) return;
    p1.classList.remove('activo'); p1.classList.add('hecho');
    p2.classList.add('activo');
    setTimeout(() => {
      p2.classList.remove('activo'); p2.classList.add('hecho');
      p3.classList.add('activo');
    }, 1000);
    setTimeout(() => {
      p3.classList.remove('activo'); p3.classList.add('hecho');
    }, 2200);
  }

  function resetPasos() {
    PASOS.forEach((id, i) => {
      const el = $(id); if (!el) return;
      el.classList.remove('activo', 'hecho');
      if (i === 0) el.classList.add('activo');
    });
  }

  // ── Abrir modal ───────────────────────────────────────────
  function abrirModal() {
    $('modalOverlay').classList.add('abierto');
    document.body.style.overflow = 'hidden';

    if (!window._ccIniciado) {
      ColombiaCiudades.init('campo-ciudad', {
        placeholder: 'Escribe tu ciudad o municipio…',
      });
      window._ccIniciado = true;
    }
    setTimeout(() => $('campo-tienda')?.focus(), 80);
  }

  // ── Cerrar modal ──────────────────────────────────────────
  function cerrarModal() {
    $('modalOverlay').classList.remove('abierto');
    document.body.style.overflow = '';
    setTimeout(() => {
      // Volver al formulario
      $('modalFormulario').style.display  = '';
      $('modalExito').style.display       = 'none';
      $('modalExito').style.flexDirection = '';

      // Limpiar campos
      // Limpiar checkbox TyC
      const chkTyC = document.getElementById('chk-tyc');
      if (chkTyC) chkTyC.checked = false;

      ['campo-tienda', 'campo-correo', 'campo-whatsapp', 'campo-descripcion'].forEach(id => {
        const el = $(id); if (el) { el.value = ''; el.classList.remove('invalido'); }
      });

      // Reset dropdown ciudad
      const input = $('campo-ciudad');
      if (input) input.value = '';
      const lbl = document.querySelector('.cc-trigger .cc-label');
      if (lbl) { lbl.textContent = 'Escribe tu ciudad o municipio…'; lbl.classList.add('cc-placeholder'); }

      // Reset pasos y estados de éxito
      resetPasos();
      const chk = $('exitoCheckReg'); if (chk) chk.textContent = '⏳';
      const ttl = $('exitoTituloReg'); if (ttl) ttl.textContent = 'Enviando tu solicitud…';
      const msg = $('exitoMsgReg'); if (msg) msg.textContent = '';

      ocultarError();
      setLoading(false);
    }, 300);
  }

  // ── Enviar ────────────────────────────────────────────────
  async function enviarFormulario() {
    ocultarError();

    const tienda      = $('campo-tienda').value.trim();
    const ciudad      = $('campo-ciudad').value.trim();
    const correo      = $('campo-correo').value.trim();
    const whatsapp    = $('campo-whatsapp').value.trim();
    const descripcion = $('campo-descripcion').value.trim();

    // Validaciones
    let ok = true, msg = '';
    if (!tienda)                      { markInv('campo-tienda',       true); ok = false; msg = msg || 'El nombre de la tienda es obligatorio.'; }      else markInv('campo-tienda',       false);
    if (!ciudad)                      {                                       ok = false; msg = msg || 'Indica tu ciudad o municipio.'; }
    if (!correo   || !vEmail(correo)) { markInv('campo-correo',       true); ok = false; msg = msg || 'Ingresa un correo electrónico válido.'; }        else markInv('campo-correo',       false);
    if (!whatsapp || !vTel(whatsapp)) { markInv('campo-whatsapp',     true); ok = false; msg = msg || 'Ingresa un WhatsApp válido (solo dígitos).'; }   else markInv('campo-whatsapp',     false);
    if (!descripcion)                 { markInv('campo-descripcion',  true); ok = false; msg = msg || 'Describe brevemente lo que vendes.'; }           else markInv('campo-descripcion',  false);
    // Validar checkbox TyC
    const chkTyC = document.getElementById('chk-tyc');
    if (chkTyC && !chkTyC.checked) {
      ok = false;
      msg = msg || 'Debes aceptar los Términos y Condiciones para continuar.';
    }
    if (!ok) { mostrarError(msg); return; }

    setLoading(true);

    // Mostrar pantalla de progreso inmediatamente
    $('modalFormulario').style.display  = 'none';
    $('modalExito').style.display       = 'flex';
    $('modalExito').style.flexDirection = 'column';

    const chk = $('exitoCheckReg');
    const ttl = $('exitoTituloReg');
    const msgEl = $('exitoMsgReg');

    if (chk) chk.textContent  = '⏳';
    if (ttl) ttl.textContent  = 'Enviando tu solicitud…';
    if (msgEl) msgEl.textContent = 'Por favor espera un momento.';

    animarPasos();

    try {
      const fd = new FormData();
      fd.append('tienda',      tienda);
      fd.append('ciudad',      ciudad);
      fd.append('correo',      correo);
      fd.append('whatsapp',    whatsapp);
      fd.append('descripcion', descripcion);

      const resp = await fetch(PHP, { method: 'POST', body: fd });
      const data = await resp.json();

      if (!data.ok) {
        // Volver al formulario con error
        $('modalExito').style.display      = 'none';
        $('modalFormulario').style.display = '';
        mostrarError(data.error || 'No se pudo enviar la solicitud. Inténtalo de nuevo.');
        setLoading(false);
        return;
      }

      // ── Éxito ─────────────────────────────────────────────
      if (chk) chk.textContent  = '✅';
      if (ttl) ttl.textContent  = '¡Solicitud enviada con éxito!';
      if (msgEl) msgEl.innerHTML =
        'Recibimos tu solicitud de registro. <strong>Nos comunicaremos contigo pronto</strong> ' +
        'al correo o WhatsApp que indicaste para darte acceso a la plataforma y asignarte la categoría más adecuada para tus productos.';

    } catch (e) {
      $('modalExito').style.display      = 'none';
      $('modalFormulario').style.display = '';
      mostrarError('Error de conexión. Verifica tu internet e inténtalo de nuevo.');
      console.error(e);
      setLoading(false);
    }
  }

  function Verificadortyc(){
    const chkTyC = document.getElementById('chk-tyc');
    const mensaje = document.getElementById('exitoMsgReg');
    if (chkTyC && !chkTyC.checked) {
      if (mensaje) mensaje.textContent = 'Debes aceptar los Términos y Condiciones para continuar. Vuelva a intentar.';
       mensaje.style.color = 'red';
      return false;
    }
     mensaje.style.color = 'green';
    return enviarFormulario();
  }
  // ── Eventos ───────────────────────────────────────────────
  document.addEventListener('DOMContentLoaded', () => {
    $('btnSolicitarRegistro') ?.addEventListener('click', abrirModal);
    $('btnCerrar')             ?.addEventListener('click', cerrarModal);
    $('btnExitoCerrar')        ?.addEventListener('click', cerrarModal);
    $('btnEnviar')             ?.addEventListener('click', Verificadortyc);
    $('modalOverlay')          ?.addEventListener('click', e => { if (e.target === e.currentTarget) cerrarModal(); });
    document.addEventListener('keydown', e => { if (e.key === 'Escape') cerrarModal(); });
  });

})();