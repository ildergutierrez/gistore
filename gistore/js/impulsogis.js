// ============================================================
//  gistore/js/impulsogis.js  (sección publicidad)
//  Flujo: llenar form → subir imagen → fetch PHP → correo enviado
//  Sin descargas, sin mailto. Todo por PHPMailer.
// ============================================================

(() => {

  const PHP_PUBLICIDAD = '../php/enviar-publicidad.php';
  const $ = id => document.getElementById(id);

  // ── Planes ────────────────────────────────────────────────
  const PLANES = {
    'Prueba':   { imp: '45',  dur: '7 días',  total: '315',   precio: '$5.000'  },
    'Básico':   { imp: '75',  dur: '15 días', total: '1.125', precio: '$12.000' },
    'Estándar': { imp: '100', dur: '15 días', total: '1.500', precio: '$20.000' },
    'Pro':      { imp: '150', dur: '30 días', total: '4.500', precio: '$40.000' },
    'Premium':  { imp: '250', dur: '30 días', total: '7.500', precio: '$65.000' },
  };

  // ── Helpers ───────────────────────────────────────────────
  const vEmail = e => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e.trim());
  const vTel   = t => /^\d{7,15}$/.test(t.replace(/\s/g, ''));

  function showErr(id, msg) {
    const el = $(id); if (!el) return;
    el.textContent = msg;
    el.classList.add('visible');
    el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
  function hideErr(id) { $(id)?.classList.remove('visible'); }
  function markInv(id, bad) { $(id)?.classList.toggle('invalido', bad); }

  function setLoading(on) {
    const btn = $('btnEnviarPub');
    const txt = $('btnPubTexto');
    const sp  = $('spinnerPub');
    if (btn) btn.disabled      = on;
    if (txt) txt.textContent   = on ? 'Enviando…' : 'Enviar solicitud de pauta';
    if (sp)  sp.style.display  = on ? 'block' : 'none';
  }

  // ── Tabla: selección de plan ──────────────────────────────
  let planActivo = null;

  document.querySelectorAll('#tablaPlanes tbody tr').forEach(tr => {
    tr.addEventListener('click', () => seleccionarPlan(tr.dataset.plan, tr));
    tr.querySelector('.plan-radio')?.addEventListener('click', e => {
      e.stopPropagation();
      seleccionarPlan(tr.dataset.plan, tr);
    });
  });

  function seleccionarPlan(plan, tr) {
    planActivo = plan;
    document.querySelectorAll('#tablaPlanes tbody tr')
      .forEach(r => r.classList.remove('plan-seleccionado'));
    tr.classList.add('plan-seleccionado');
    const r = tr.querySelector('.plan-radio');
    if (r) r.checked = true;
    const sel = $('pub-plan');
    if (sel) sel.value = plan;
    actualizarResumen(plan);
  }

  function actualizarResumen(plan) {
    const d = PLANES[plan];
    if (!d) { $('pubPlanResumen').style.display = 'none'; return; }
    $('prImp').textContent    = d.imp;
    $('prDur').textContent    = d.dur;
    $('prTotal').textContent  = d.total;
    $('prPrecio').textContent = d.precio;
    $('pubPlanResumen').style.display = 'grid';
  }

  $('pub-plan')?.addEventListener('change', function () {
    planActivo = this.value || null;
    actualizarResumen(planActivo);
    if (planActivo) {
      document.querySelectorAll('#tablaPlanes tbody tr').forEach(tr => {
        const ok = tr.dataset.plan === planActivo;
        tr.classList.toggle('plan-seleccionado', ok);
        const r = tr.querySelector('.plan-radio');
        if (r) r.checked = ok;
      });
    }
  });

  // ── Zona de imagen ────────────────────────────────────────
  let imagenFile = null;

  function inyectarZonaImagen() {
    if ($('pub-imagen-zona')) return;

    const zona = document.createElement('div');
    zona.id        = 'pub-imagen-zona';
    zona.className = 'pub-imagen-zona';
    zona.innerHTML = `
      <input type="file" id="pub-imagen-input"
             accept="image/jpeg,image/png,image/webp" style="display:none">
      <div id="pub-imagen-drop" class="pub-imagen-drop" tabindex="0" role="button"
           aria-label="Seleccionar imagen del banner">
        <span id="pub-imagen-icono">🖼️</span>
        <span id="pub-imagen-label">Haz clic o arrastra aquí la imagen del banner</span>
        <small>JPG · PNG · WEBP · máx. 5 MB · recomendado 800 × 400 px</small>
        <img id="pub-imagen-preview" alt="Preview del banner" style="display:none">
      </div>
      <span id="pub-imagen-nombre" class="pub-imagen-nombre"></span>
    `;

    const avisoImg = document.querySelector('#modalPubFormulario .aviso-imagen');
    if (avisoImg) {
      avisoImg.parentNode.insertBefore(zona, avisoImg);
      avisoImg.style.display = 'none';
    } else {
      const campUrl = $('pub-url')?.closest('.campo');
      campUrl?.parentNode.insertBefore(zona, campUrl);
    }

    if (!document.getElementById('pub-imagen-estilos')) {
      const st = document.createElement('style');
      st.id = 'pub-imagen-estilos';
      st.textContent = `
        .pub-imagen-zona { margin-bottom: 1rem; }
        .pub-imagen-drop {
          border: 2px dashed #a7d3b8; border-radius: 12px;
          padding: 1.2rem 1rem; text-align: center; cursor: pointer;
          transition: border-color .2s, background .2s; background: #f0fdf4;
          display: flex; flex-direction: column; align-items: center; gap: .4rem;
          font-size: .85rem; color: #374151;
        }
        .pub-imagen-drop:hover,
        .pub-imagen-drop.drag-over { border-color: #2d9e5f; background: #e8f5ee; }
        .pub-imagen-drop.con-imagen { border-style: solid; border-color: #2d9e5f; }
        .pub-imagen-drop.invalida   { border-color: #dc2626; background: #fef2f2; }
        .pub-imagen-drop small { color: #6b7280; font-size: .75rem; }
        #pub-imagen-icono { font-size: 1.6rem; }
        #pub-imagen-preview {
          width: 100%; max-height: 140px; object-fit: cover;
          border-radius: 8px; margin-top: .4rem;
        }
        .pub-imagen-nombre {
          font-size: .78rem; color: #2d9e5f;
          display: block; margin-top: .35rem; word-break: break-all;
        }
      `;
      document.head.appendChild(st);
    }

    const input = $('pub-imagen-input');
    const drop  = $('pub-imagen-drop');

    drop.addEventListener('click',   () => input.click());
    drop.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') input.click(); });
    input.addEventListener('change', () => { if (input.files[0]) procesarImagen(input.files[0]); });
    drop.addEventListener('dragover',  e => { e.preventDefault(); drop.classList.add('drag-over'); });
    drop.addEventListener('dragleave', ()  => drop.classList.remove('drag-over'));
    drop.addEventListener('drop', e => {
      e.preventDefault();
      drop.classList.remove('drag-over');
      if (e.dataTransfer.files[0]) procesarImagen(e.dataTransfer.files[0]);
    });
  }

  function procesarImagen(file) {
    const TIPOS = ['image/jpeg', 'image/png', 'image/webp'];
    const drop   = $('pub-imagen-drop');
    const prev   = $('pub-imagen-preview');
    const lbl    = $('pub-imagen-label');
    const nombre = $('pub-imagen-nombre');

    if (!TIPOS.includes(file.type)) {
      drop.classList.add('invalida');
      showErr('modalPubError', 'Formato no válido. Usa JPG, PNG o WEBP.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      drop.classList.add('invalida');
      showErr('modalPubError', 'La imagen supera los 5 MB.');
      return;
    }

    drop.classList.remove('invalida');
    drop.classList.add('con-imagen');
    hideErr('modalPubError');
    imagenFile = file;

    const reader = new FileReader();
    reader.onload = e => {
      prev.src           = e.target.result;
      prev.style.display = 'block';
      lbl.textContent    = '✅ Imagen cargada — haz clic para cambiar';
      nombre.textContent = `📎 ${file.name} (${(file.size / 1024).toFixed(0)} KB)`;
    };
    reader.readAsDataURL(file);
  }

  function resetImagen() {
    imagenFile = null;
    const prev   = $('pub-imagen-preview');
    const lbl    = $('pub-imagen-label');
    const nombre = $('pub-imagen-nombre');
    const drop   = $('pub-imagen-drop');
    const input  = $('pub-imagen-input');
    if (prev)   { prev.src = ''; prev.style.display = 'none'; }
    if (lbl)    lbl.textContent = 'Haz clic o arrastra aquí la imagen del banner';
    if (nombre) nombre.textContent = '';
    if (drop)   drop.classList.remove('con-imagen', 'invalida');
    if (input)  input.value = '';
  }

  // ── Modal publicidad — abrir / cerrar ─────────────────────
  function abrirPub() {
    $('modalPubOverlay').classList.add('abierto');
    document.body.style.overflow = 'hidden';
    inyectarZonaImagen();
    if (planActivo) { $('pub-plan').value = planActivo; actualizarResumen(planActivo); }
  }

  function cerrarPub() {
    $('modalPubOverlay').classList.remove('abierto');
    document.body.style.overflow = '';
    setTimeout(() => {
      $('modalPubFormulario').style.display  = '';
      $('modalPubExito').style.display       = 'none';
      $('modalPubExito').style.flexDirection = '';
      ['pub-titulo', 'pub-url', 'pub-whatsapp', 'pub-nombre', 'pub-correo'].forEach(id => {
        const el = $(id); if (el) { el.value = ''; el.classList.remove('invalido'); }
      });
      $('pub-plan').value = planActivo || '';
      actualizarResumen(planActivo);
      resetImagen();
      hideErr('modalPubError');
      setLoading(false);
    }, 300);
  }

  // ── Validar formulario ────────────────────────────────────
  function validarPub() {
    let ok = true, msg = '';
    const plan     = $('pub-plan').value;
    const titulo   = $('pub-titulo').value.trim();
    const url      = $('pub-url').value.trim();
    const whatsapp = $('pub-whatsapp').value.trim();
    const nombre   = $('pub-nombre').value.trim();
    const correo   = $('pub-correo').value.trim();

    if (!plan)                        { markInv('pub-plan',     true); ok = false; msg = msg || 'Selecciona un plan.'; }                   else markInv('pub-plan',     false);
    if (!titulo)                      { markInv('pub-titulo',   true); ok = false; msg = msg || 'El título de la campaña es obligatorio.'; } else markInv('pub-titulo',   false);
    if (!url)                         { markInv('pub-url',      true); ok = false; msg = msg || 'La URL de destino es obligatoria.'; }       else markInv('pub-url',      false);
    if (!whatsapp || !vTel(whatsapp)) { markInv('pub-whatsapp', true); ok = false; msg = msg || 'Ingresa un WhatsApp válido.'; }             else markInv('pub-whatsapp', false);
    if (!nombre)                      { markInv('pub-nombre',   true); ok = false; msg = msg || 'El nombre o empresa es obligatorio.'; }     else markInv('pub-nombre',   false);
    if (!correo || !vEmail(correo))   { markInv('pub-correo',   true); ok = false; msg = msg || 'Ingresa un correo electrónico válido.'; }   else markInv('pub-correo',   false);
    if (!imagenFile) {
      $('pub-imagen-drop')?.classList.add('invalida');
      ok = false; msg = msg || 'Adjunta la imagen del banner.';
    } else {
      $('pub-imagen-drop')?.classList.remove('invalida');
    }
    return { ok, msg };
  }

  // ── Enviar ────────────────────────────────────────────────
  async function enviarPub() {
    hideErr('modalPubError');
    const { ok, msg } = validarPub();
    if (!ok) { showErr('modalPubError', msg); return; }

    setLoading(true);

    const fd = new FormData();
    fd.append('plan',     $('pub-plan').value);
    fd.append('titulo',   $('pub-titulo').value.trim());
    fd.append('url',      $('pub-url').value.trim());
    fd.append('whatsapp', $('pub-whatsapp').value.trim());
    fd.append('nombre',   $('pub-nombre').value.trim());
    fd.append('correo',   $('pub-correo').value.trim());
    fd.append('banner',   imagenFile);

    try {
      const resp = await fetch(PHP_PUBLICIDAD, { method: 'POST', body: fd });
      const data = await resp.json();

      if (!data.ok) {
        showErr('modalPubError', data.error || 'Error al enviar. Inténtalo de nuevo.');
        return;
      }

      // ── Éxito: mostrar pantalla de confirmación ───────────
      $('modalPubFormulario').style.display  = 'none';
      $('modalPubExito').style.display       = 'flex';
      $('modalPubExito').style.flexDirection = 'column';

      const chk = $('exitoCheckPub');
      const ttl = $('exitoTituloPub');
      const msg = $('msgExitoPub');
      if (chk) chk.textContent = '✅';
      if (ttl) ttl.textContent = '¡Solicitud enviada!';
      if (msg) msg.textContent = 'Recibimos tu solicitud de pauta. Nos comunicaremos contigo pronto para coordinar los detalles.';

      // Marcar todos los pasos como hechos
      ['pasoPub1', 'pasoPub2', 'pasoPub3'].forEach(id => {
        const el = $(id); if (!el) return;
        el.classList.remove('activo');
        el.classList.add('hecho');
      });

    } catch (e) {
      showErr('modalPubError', 'Error de conexión. Verifica tu internet e intenta de nuevo.');
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  // ── Modal registro (sin cambios) ──────────────────────────
  const EMAIL_DESTINO = [114,101,103,105,115,116,114,111,64,103,105,115,116,111,114,101,46,99,111,109,46,99,111]
    .map(c => String.fromCharCode(c)).join('');

  function abrirReg() {
    $('modalOverlay').classList.add('abierto');
    document.body.style.overflow = 'hidden';
    if (!window._ccIniciado && typeof ColombiaCiudades !== 'undefined') {
      ColombiaCiudades.init('campo-ciudad', { placeholder: 'Escribe tu ciudad o municipio…' });
      window._ccIniciado = true;
    }
    setTimeout(() => $('campo-tienda')?.focus(), 80);
  }

  function cerrarReg() {
    $('modalOverlay').classList.remove('abierto');
    document.body.style.overflow = '';
    setTimeout(() => {
      $('modalFormulario').style.display  = '';
      $('modalExito').style.display       = 'none';
      ['campo-tienda', 'campo-correo', 'campo-whatsapp'].forEach(id => {
        const el = $(id); if (el) { el.value = ''; el.classList.remove('invalido'); }
      });
      hideErr('modalError');
    }, 300);
  }

  async function enviarReg() {
    hideErr('modalError');
    const tienda   = $('campo-tienda').value.trim();
    const ciudad   = $('campo-ciudad').value.trim();
    const correo   = $('campo-correo').value.trim();
    const whatsapp = $('campo-whatsapp').value.trim();

    let ok = true, msg = '';
    if (!tienda)                      { markInv('campo-tienda',   true); ok = false; msg = msg || 'El nombre de la tienda es obligatorio.'; } else markInv('campo-tienda',   false);
    if (!ciudad)                      {                                   ok = false; msg = msg || 'Indica tu ciudad o municipio.'; }
    if (!correo   || !vEmail(correo)) { markInv('campo-correo',   true); ok = false; msg = msg || 'Ingresa un correo válido.'; }             else markInv('campo-correo',   false);
    if (!whatsapp || !vTel(whatsapp)) { markInv('campo-whatsapp', true); ok = false; msg = msg || 'Ingresa un WhatsApp válido.'; }            else markInv('campo-whatsapp', false);
    if (!ok) { showErr('modalError', msg); return; }

    const asunto = encodeURIComponent('Solicitud de registro — GI Store');
    const cuerpo = encodeURIComponent(
      `Hola, quiero solicitar mi registro en GI Store.\n\n` +
      `🏪 Tienda / Nombre: ${tienda}\n` +
      `🌆 Ciudad: ${ciudad}\n` +
      `📧 Correo: ${correo}\n` +
      `📱 WhatsApp: +57 ${whatsapp}`
    );

    $('modalFormulario').style.display  = 'none';
    $('modalExito').style.display       = 'flex';
    $('modalExito').style.flexDirection = 'column';

    //await new Promise(r => setTimeout(r, 400));
    //window.location.href = `mailto:${EMAIL_DESTINO}?subject=${asunto}&body=${cuerpo}`;
  }

  // ── Eventos ───────────────────────────────────────────────
  $('btnSolicitarRegistro')  ?.addEventListener('click', abrirReg);
  $('btnCerrar')              ?.addEventListener('click', cerrarReg);
  $('btnExitoCerrar')         ?.addEventListener('click', cerrarReg);
  $('btnEnviar')              ?.addEventListener('click', enviarReg);
  $('modalOverlay')           ?.addEventListener('click', e => { if (e.target === e.currentTarget) cerrarReg(); });

  $('btnSolicitarPublicidad') ?.addEventListener('click', abrirPub);
  $('btnCerrarPub')           ?.addEventListener('click', cerrarPub);
  $('btnPubExitoCerrar')      ?.addEventListener('click', cerrarPub);
  $('btnEnviarPub')           ?.addEventListener('click', enviarPub);
  $('modalPubOverlay')        ?.addEventListener('click', e => { if (e.target === e.currentTarget) cerrarPub(); });

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') { cerrarReg(); cerrarPub(); }
  });

})();