// ============================================================
//  user/js/membresia.js — Portal Vendedor GI Store
//  Consume:
//    ../backend/membresias.php   → membresía + fundador
//    ../backend/wompi_config.php → claves Wompi + firma
//    ../backend/vendedor.php     → nombre del vendedor
// ============================================================

// ── Token CSRF (igual que dashboard.js) ──────────────────
let _token = null;

async function getToken() {
  if (_token) return _token;
  try {
    const resp = await fetch('../../backend/tokens.php?accion=obtener', { credentials: 'include' });
    const data = await resp.json();
    _token = data.token || '';
  } catch { _token = ''; }
  return _token;
}

// ── Claves Wompi (se llenan desde wompi_config.php) ───────
let WOMPI_LLAVE_PUBLICA = '';

// ════════════════════════════════════════════════════════════
//  UTILIDADES DE FORMATO
// ════════════════════════════════════════════════════════════

function formatFecha(str) {
  if (!str) return '—';
  return new Date(str).toLocaleDateString('es-CO', {
    year: 'numeric', month: 'long', day: 'numeric'
  });
}

function diasRestantes(str) {
  if (!str) return -1;
  return Math.ceil((new Date(str) - new Date()) / 864e5);
}

function formatCOP(n) {
  return '$' + Number(n).toLocaleString('es-CO');
}

function diasAEtiqueta(dias) {
  if (!dias || dias <= 0) return '';
  const d = Number(dias);
  if (d % 365 === 0) { const y = d / 365; return `${y} año${y > 1 ? 's' : ''}`; }
  if (d % 30  === 0) { const m = d / 30;  return `${m} mes${m > 1 ? 'es' : ''}`; }
  if (d % 7   === 0) { const s = d / 7;   return `${s} semana${s > 1 ? 's' : ''}`; }
  return `${d} día${d > 1 ? 's' : ''}`;
}

// ════════════════════════════════════════════════════════════
//  UI
// ════════════════════════════════════════════════════════════

function badgeDias(dias) {
  if (dias < 0)  return `<span class="dias-restantes venc">❌ Vencida</span>`;
  if (dias <= 7) return `<span class="dias-restantes warn">⚠️ ${dias} días restantes</span>`;
  return `<span class="dias-restantes ok">✅ ${dias} días restantes</span>`;
}

function mostrarAlerta(tipo, mensaje) {
  const el = document.getElementById('alertaMembresia');
  if (!el) return;
  el.style.display = 'flex';
  el.innerHTML = `
    <div class="alerta-membresia ${tipo}">
      <span>${tipo === 'error' ? '❌' : tipo === 'warn' ? '⚠️' : '✅'}</span>
      <span>${mensaje}</span>
    </div>`;
}

// ════════════════════════════════════════════════════════════
//  RENDER: ESTADO DE LA MEMBRESÍA
//  Campos que devuelve membresias.php:
//    membresia → { id, fecha_inicio, fecha_fin, estado, plan_id, plan_nombre }
//    fundador  → { esFundador, fechaRegistro }
// ════════════════════════════════════════════════════════════

function renderEstado(membresia) {
  const el = document.getElementById('estadoContenido');
  if (!el) return;

  if (!membresia) {
    el.innerHTML = `
      <div class="estado-fila">
        <span class="estado-fila-label">Estado</span>
        <span class="badge badge-inactivo">Sin membresía</span>
      </div>
      <p style="font-size:.83rem;color:var(--texto-suave);margin-top:.75rem">
        Aún no tienes una membresía activa. Elige un plan y realiza tu pago
        para activar tu acceso completo a GI Store.
      </p>`;
    mostrarAlerta('error', 'No tienes membresía activa. Realiza tu pago para acceder a todas las funciones.');
    return;
  }

  const dias     = diasRestantes(membresia.fecha_fin);
  const duracion = membresia.duracion_dias || 30;
  const pct      = Math.max(0, Math.min(100, Math.round((dias / duracion) * 100)));

  el.innerHTML = `
    <div class="estado-fila">
      <span class="estado-fila-label">Estado</span>
      ${badgeDias(dias)}
    </div>
    <div class="estado-fila">
      <span class="estado-fila-label">Plan activo</span>
      <span class="estado-fila-valor">${membresia.plan_nombre || 'Estándar'}</span>
    </div>
    <div class="estado-fila">
      <span class="estado-fila-label">Inicio</span>
      <span class="estado-fila-valor">${formatFecha(membresia.fecha_inicio)}</span>
    </div>
    <div class="estado-fila">
      <span class="estado-fila-label">Vence</span>
      <span class="estado-fila-valor">${formatFecha(membresia.fecha_fin)}</span>
    </div>
    <div class="progreso-wrap">
      <div class="progreso-label">
        <span>Tiempo restante</span>
        <span>${Math.max(0, dias)} / ${duracion} días</span>
      </div>
      <div class="progreso-barra">
        <div class="progreso-fill" style="width:${pct}%"></div>
      </div>
    </div>`;

  if (dias < 0)       mostrarAlerta('error', 'Tu membresía ha vencido. Renueva ahora para recuperar el acceso.');
  else if (dias <= 7) mostrarAlerta('warn',  `Tu membresía vence en ${dias} día${dias !== 1 ? 's' : ''}. Renueva para no perder el acceso.`);
  else                mostrarAlerta('ok',    `¡Tu membresía está activa! Tienes ${dias} días disponibles.`);
}

// ════════════════════════════════════════════════════════════
//  RENDER: HISTORIAL — tabla con paginación
// ════════════════════════════════════════════════════════════

const HISTORIAL_POR_PAGINA = 10;
let _historialPagos   = [];
let _historialPagActual = 1;

function renderHistorial(pagos) {
  _historialPagos     = pagos || [];
  _historialPagActual = 1;
  _pintarHistorial();
}

function _pintarHistorial() {
  const el = document.getElementById('historialContenido');
  if (!el) return;

  if (_historialPagos.length === 0) {
    el.innerHTML = `
      <p style="font-size:.83rem;color:var(--texto-suave);text-align:center;padding:1.5rem 0">
        Sin pagos registrados aún.
      </p>`;
    return;
  }

  const total    = _historialPagos.length;
  const paginas  = Math.ceil(total / HISTORIAL_POR_PAGINA);
  const desde    = (_historialPagActual - 1) * HISTORIAL_POR_PAGINA;
  const hasta    = Math.min(desde + HISTORIAL_POR_PAGINA, total);
  const pagina   = _historialPagos.slice(desde, hasta);

  // ── Tabla ────────────────────────────────────────────────
  const filas = pagina.map(p => {
    const estadoClass = p.estado === 'activa'   ? 'badge-activo'
                      : p.estado === 'vencida'  ? 'badge-vencida'
                      : 'badge-inactivo';
    const estadoLabel = p.estado === 'activa'   ? '✓ Activa'
                      : p.estado === 'vencida'  ? 'Vencida'
                      : p.estado || 'Cancelada';
    return `
      <tr>
        <td>
          <div style="font-weight:600;font-size:.84rem">${p.plan_nombre || 'Membresía'}</div>
          <div class="historial-fecha">${formatFecha(p.fecha_inicio)}</div>
        </td>
        <td>${formatFecha(p.fecha_fin)}</td>
        <td><span class="badge ${estadoClass}" style="font-size:.72rem">${estadoLabel}</span></td>
        <td><span class="historial-monto">${formatCOP(p.monto || 0)}</span></td>
      </tr>`;
  }).join('');

  // ── Paginación ───────────────────────────────────────────
  let paginaBtns = '';
  if (paginas > 1) {
    // Anterior
    paginaBtns += `<button class="pag-btn" onclick="_irPagHistorial(${_historialPagActual - 1})"
      ${_historialPagActual === 1 ? 'disabled' : ''}>‹</button>`;
    // Números
    for (let i = 1; i <= paginas; i++) {
      paginaBtns += `<button class="pag-btn ${i === _historialPagActual ? 'activo' : ''}"
        onclick="_irPagHistorial(${i})">${i}</button>`;
    }
    // Siguiente
    paginaBtns += `<button class="pag-btn" onclick="_irPagHistorial(${_historialPagActual + 1})"
      ${_historialPagActual === paginas ? 'disabled' : ''}>›</button>`;
  }

  el.innerHTML = `
    <div style="overflow-x:auto">
      <table class="historial-tabla">
        <thead>
          <tr>
            <th>Plan</th>
            <th>Vence</th>
            <th>Estado</th>
            <th>Monto</th>
          </tr>
        </thead>
        <tbody>${filas}</tbody>
      </table>
    </div>
    ${paginas > 1 ? `
    <div class="historial-paginacion">
      <span class="historial-paginacion-info">
        Mostrando ${desde + 1}–${hasta} de ${total} registros
      </span>
      <div class="historial-paginacion-btns">${paginaBtns}</div>
    </div>` : ''}`;
}

function _irPagHistorial(pag) {
  const paginas = Math.ceil(_historialPagos.length / HISTORIAL_POR_PAGINA);
  if (pag < 1 || pag > paginas) return;
  _historialPagActual = pag;
  _pintarHistorial();
  document.getElementById('historialContenido')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

// ════════════════════════════════════════════════════════════
//  WOMPI — ESPERAR SDK
// ════════════════════════════════════════════════════════════

function esperarWidgetCheckout(intentosMax = 20, intervaloMs = 300) {
  return new Promise((resolve, reject) => {
    if (typeof window.WidgetCheckout === 'function') { resolve(); return; }
    let intentos = 0;
    const id = setInterval(() => {
      intentos++;
      if (typeof window.WidgetCheckout === 'function') {
        clearInterval(id); resolve();
      } else if (intentos >= intentosMax) {
        clearInterval(id);
        reject(new Error('WidgetCheckout no cargó.'));
      }
    }, intervaloMs);
  });
}

// ════════════════════════════════════════════════════════════
//  WOMPI — FIRMA (GET wompi_config.php?accion=firma)
// ════════════════════════════════════════════════════════════

async function obtenerFirma(referencia, montoEnCentavos) {
  const token = await getToken();
  const url   = `../backend/wompi_config.php?accion=firma&token=${token}`
              + `&referencia=${encodeURIComponent(referencia)}`
              + `&monto_centavos=${montoEnCentavos}`;
  const resp  = await fetch(url, { credentials: 'include' });
  const json  = await resp.json();
  if (!json.ok) throw new Error(json.error || 'Error al calcular firma');
  return json.datos.firma;
}

// ════════════════════════════════════════════════════════════
//  WOMPI — BOTÓN DE PAGO
// ════════════════════════════════════════════════════════════

async function inyectarBotonWompi(monto, referencia, llavePub) {
  const montoCOP        = parseInt(String(monto).replace(/[^0-9]/g, ''), 10);
  const montoEnCentavos = montoCOP * 100;

  if (!Number.isInteger(montoEnCentavos) || montoEnCentavos <= 0) return;

  const wrap = document.getElementById('wompi-btn-wrap');
  if (!wrap) return;

  wrap.innerHTML = `
    <div style="text-align:center;padding:.75rem;font-size:.8rem;color:var(--texto-suave)">
      Preparando botón de pago…
    </div>`;

  try { await esperarWidgetCheckout(); }
  catch {
    wrap.innerHTML = `<p style="font-size:.8rem;color:var(--error);text-align:center;padding:.5rem">
      Error al cargar el sistema de pago. Recarga la página.</p>`;
    return;
  }

  let firma;
  try { firma = await obtenerFirma(referencia, montoEnCentavos); }
  catch (e) {
    console.error('Firma Wompi:', e);
    wrap.innerHTML = `<p style="font-size:.8rem;color:var(--error);text-align:center;padding:.5rem">
      No se pudo preparar el botón de pago. Recarga la página.</p>`;
    return;
  }

  if (!firma || firma.length < 10) {
    wrap.innerHTML = `<p style="font-size:.8rem;color:var(--error);text-align:center;padding:.5rem">
      Error de seguridad. Recarga la página.</p>`;
    return;
  }

  const config = {
    currency:      'COP',
    amountInCents: montoEnCentavos,
    reference:     referencia,
    publicKey:     llavePub,
    signature:     { integrity: firma },
  };

  const checkout = new window.WidgetCheckout(config);

  wrap.innerHTML = '';
  const btn = document.createElement('button');
  btn.type      = 'button';
  btn.className = 'waybox-button';
  btn.style.cssText = 'width:100%;display:flex;align-items:center;justify-content:center;gap:.5rem;font-size:1rem;padding:.75rem 1rem;cursor:pointer;border-radius:8px;';
  btn.innerHTML = `
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18"
         viewBox="0 0 229.5 229.5" style="flex-shrink:0">
      <path fill="#fff" d="M214.419 32.12A7.502 7.502 0 0 0 209 25.927L116.76.275
        a7.496 7.496 0 0 0-4.02 0L20.5 25.927a7.5 7.5 0 0 0-5.419 6.193
        c-.535 3.847-12.74 94.743 18.565 139.961 31.268 45.164 77.395 56.738
        79.343 57.209a7.484 7.484 0 0 0 3.522 0c1.949-.471 48.076-12.045
        79.343-57.209 31.305-45.217 19.1-136.113 18.565-139.961z
        m-40.186 53.066l-62.917 62.917c-1.464 1.464-3.384 2.197-5.303 2.197
        s-3.839-.732-5.303-2.197l-38.901-38.901a7.497 7.497 0 0 1 0-10.606
        l7.724-7.724a7.5 7.5 0 0 1 10.606 0l25.874 25.874 49.89-49.891
        a7.497 7.497 0 0 1 10.606 0l7.724 7.724a7.5 7.5 0 0 1 0 10.607z"/>
    </svg>
    Paga con <strong style="margin-left:.25rem">Wompi</strong>`;

  btn.addEventListener('click', () => {
    checkout.open(async result => {
      const tx = result?.transaction;
      if (!tx) return;

      if (tx.status === 'APPROVED') {
        mostrarAlerta('ok', '⏳ Pago aprobado. Activando membresía…');
        btn.disabled = true;

        try {
          const token  = await getToken();
          const planId = Number(document.querySelector('#planesWrap .plan-card.seleccionado')?.dataset?.planId ?? 0);
          const monto  = Number(document.querySelector('#planesWrap .plan-card.seleccionado')?.dataset?.monto   ?? 0);

          const resp = await fetch(
            `../backend/membresias.php?accion=activar&token=${token}`,
            {
              method:      'POST',
              credentials: 'include',
              headers:     { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                wompi_tx_id: tx.id,
                plan_id:     planId,
                monto:       monto,
              }),
            }
          );
          const data = await resp.json();

          if (data.ok) {
            mostrarAlerta('ok', `✅ ¡Membresía activada hasta el ${new Date(data.datos.fecha_fin + 'T00:00:00').toLocaleDateString('es-CO', { year:'numeric', month:'long', day:'numeric' })}!`);
            setTimeout(() => location.reload(), 2500);
          } else {
            mostrarAlerta('warn', `Pago aprobado pero ocurrió un error al activar: ${data.error || 'contacta soporte.'}`);
            console.error('activar membresia:', data);
          }
        } catch (e) {
          console.error('Error al activar membresía:', e);
          mostrarAlerta('warn', 'Pago aprobado pero no se pudo activar automáticamente. Recarga la página.');
        }

      } else {
        mostrarAlerta('warn', `Transacción ${tx.status || 'pendiente'}. Revisa tu historial.`);
      }
    });
  });

  wrap.appendChild(btn);
}

// ════════════════════════════════════════════════════════════
//  REFERENCIA ÚNICA POR TRANSACCIÓN
// ════════════════════════════════════════════════════════════

function generarReferencia(vendedorId, monto) {
  return `GIS-${String(vendedorId).slice(0, 8)}-${monto}-${Date.now()}`;
}

// ════════════════════════════════════════════════════════════
//  RENDER: PLANES
// ════════════════════════════════════════════════════════════

function renderPlanes(planes, esFundador, vendedorId) {
  const wrap = document.getElementById('planesWrap');
  if (!wrap) return;

  let planesToShow;
  if (esFundador) {
    // Si es fundador, mostrar solo los planes con "fundador" en el nombre
    // Si no hubiera ninguno, mostrar todos los activos como fallback
    const soloFundador = planes.filter(p => p.activo && p.nombre.toLowerCase().includes('fundador'));
    planesToShow = soloFundador.length > 0 ? soloFundador : planes.filter(p => p.activo);
  } else {
    // Vendedor normal: ocultar planes fundador
    planesToShow = planes.filter(p => p.activo && !p.nombre.toLowerCase().includes('fundador'));
  }

  if (planesToShow.length === 0) {
    wrap.innerHTML = `
      <p style="font-size:.83rem;color:var(--texto-suave);text-align:center;padding:1rem 0">
        No hay planes disponibles. Contacta al administrador.
      </p>`;
    return;
  }

  wrap.innerHTML = planesToShow.map((plan, i) => {
    
    const esPlanFundador   = plan.nombre.toLowerCase().includes('fundador');
    const etiquetaDuracion = diasAEtiqueta(plan.duracion_dias);
    const precioEntero     = parseInt(String(plan.precio)) || 0;

    return `
      <div class="plan-card${i === 0 ? ' seleccionado' : ''}"
           data-plan-id="${plan.id}"
           data-monto="${precioEntero}"
           data-label="${plan.nombre}${etiquetaDuracion ? ' · ' + etiquetaDuracion : ''}"
           data-duracion="${plan.duracion_dias || 30}">
        ${esPlanFundador ? `<div class="plan-badge">🌱 Fundador</div>` : ''}
        <div class="plan-card-top">
          <div style="flex:1;min-width:0">
            <div class="plan-nombre">${plan.nombre}</div>
            <div class="plan-desc">
              ${plan.descripcion || (etiquetaDuracion ? 'Duración: ' + etiquetaDuracion : '')}
            </div>
          </div>
          <div style="display:flex;align-items:flex-start;gap:.65rem;flex-shrink:0">
            <div class="plan-precio">
              ${formatCOP(precioEntero)}
              ${etiquetaDuracion ? `<span>/ ${etiquetaDuracion}</span>` : ''}
            </div>
            <div class="plan-radio"></div>
          </div>
        </div>
      </div>`;
  }).join('');

  inicializarSeleccion(vendedorId);
}

// ════════════════════════════════════════════════════════════
//  SELECCIÓN DE PLAN → RESUMEN + BOTÓN WOMPI
// ════════════════════════════════════════════════════════════

function inicializarSeleccion(vendedorId) {
  const tarjetas     = document.querySelectorAll('#planesWrap .plan-card');
  const resumenLabel = document.getElementById('resumenLabel');
  const resumenMonto = document.getElementById('resumenMonto');

  function seleccionar(tarjeta) {
    tarjetas.forEach(t => t.classList.remove('seleccionado'));
    tarjeta.classList.add('seleccionado');

    const monto      = Number(tarjeta.dataset.monto);
    const etiqueta   = tarjeta.dataset.label;
    const referencia = generarReferencia(vendedorId, monto);

    if (resumenLabel) resumenLabel.textContent = etiqueta;
    if (resumenMonto) resumenMonto.textContent = formatCOP(monto);

    if (!WOMPI_LLAVE_PUBLICA) {
      const wrap = document.getElementById('wompi-btn-wrap');
      if (wrap) wrap.innerHTML = `<p style="font-size:.8rem;color:var(--error);text-align:center;padding:.5rem">
        Error de configuración de pago. Recarga la página.</p>`;
      console.error('WOMPI_LLAVE_PUBLICA está vacía. Verifica la columna public en la tabla wpis.');
      return;
    }

    inyectarBotonWompi(monto, referencia, WOMPI_LLAVE_PUBLICA);
  }

  tarjetas.forEach(t => t.addEventListener('click', () => seleccionar(t)));
  const porDefecto = document.querySelector('#planesWrap .plan-card.seleccionado') || tarjetas[0];
  if (porDefecto) seleccionar(porDefecto);
}

// ════════════════════════════════════════════════════════════
//  FECHA DE HOY
// ════════════════════════════════════════════════════════════

function mostrarFechaHoy() {
  const el = document.getElementById('fechaHoy');
  if (el) el.textContent = new Date().toLocaleDateString('es-CO', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });
}

// ════════════════════════════════════════════════════════════
//  PUNTO DE ENTRADA
// ════════════════════════════════════════════════════════════

async function init() {
  mostrarFechaHoy();
  document.body.style.visibility = 'visible'; // ← aquí, revela inmediatamente
  
  const token = await getToken();
  if (!token) {
    mostrarAlerta('error', 'Error de autenticación. Recarga la página.');
    return;
  }

  try {
    // ── Paralelo: membresía + claves Wompi + vendedor ──────
    const [resMem, resWompi, resVendedor] = await Promise.all([
      fetch(`../backend/membresias.php?token=${token}`,                { credentials: 'include' }).then(r => r.json()),
      fetch(`../backend/wompi_config.php?accion=claves&token=${token}`, { credentials: 'include' }).then(r => r.json()),
      fetch(`../backend/vendedor.php?accion=stats&token=${token}`,     { credentials: 'include' }).then(r => r.json()),
    ]);

    // ── Vendedor ───────────────────────────────────────────
    const vendedorId = resVendedor?.id || 0;
    const nomEl      = document.getElementById('vendedorNombre');
    if (nomEl) nomEl.textContent = resVendedor?.nombre || 'Vendedor';

    // ── Claves Wompi ───────────────────────────────────────
    if (resWompi.ok) {
      WOMPI_LLAVE_PUBLICA = resWompi.datos.llave_publica || '';
    } else {
      console.warn('Wompi config:', resWompi.error);
    }

    // ── Membresía + fundador ───────────────────────────────
    if (!resMem.ok) {
      mostrarAlerta('error', resMem.error || 'No se pudo cargar la membresía.');
      renderEstado(null);
      renderHistorial([]);
      return;
    }

    const { membresia, fundador } = resMem.datos;
    renderEstado(membresia);

    // ── Planes ─────────────────────────────────────────────
    const resPlanes = await fetch(
      `../backend/membresias.php?accion=planes&token=${token}`,
      { credentials: 'include' }
    ).then(r => r.json());

    const planes     = resPlanes.ok && Array.isArray(resPlanes.datos) ? resPlanes.datos : [];
    const esFundador = fundador?.esFundador ?? false;
    renderPlanes(planes, esFundador, vendedorId);

    // ── Historial ──────────────────────────────────────────
    const resHist = await fetch(
      `../backend/membresias.php?accion=historial&token=${token}`,
      { credentials: 'include' }
    ).then(r => r.json());

    const pagos = resHist.ok && Array.isArray(resHist.datos) ? resHist.datos : [];
    renderHistorial(pagos);

  } catch (e) {
    console.error('Error al cargar membresía:', e);
    const contenido = document.getElementById('estadoContenido');
    if (contenido) contenido.innerHTML = `
      <p style="color:var(--error);font-size:.85rem">
        Ocurrió un error al cargar tu membresía. Recarga la página.
      </p>`;
  }
}

init();