// ============================================================
//  user/js/dashboard.js
// ============================================================

const PRECIO_FUNDADOR = 15000;
const PRECIO_NORMAL   = 25000;

// ── Token CSRF ────────────────────────────────────────────
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

// ── Fecha ─────────────────────────────────────────────────
document.getElementById('fechaHoy').textContent = new Date().toLocaleDateString('es-ES', {
  year: 'numeric', month: 'long', day: 'numeric'
});
function fechaLimite(fecha) {
  let f = new Date(fecha);

  f.setFullYear(f.getFullYear() + 1);

  let año = f.getFullYear();
  let mes = String(f.getMonth() + 1).padStart(2, '0');
  let dia = String(f.getDate()).padStart(2, '0');

  return `${año}/${mes}/${dia}`;
}

// ── Helpers ───────────────────────────────────────────────
function formatoPrecio(n) {
  return '$' + Number(n).toLocaleString('es-CO');
}

function membresiaVigente(mem) {
  if (!mem || mem.estado !== 'activa') return false;
  const hoy = new Date().toISOString().split('T')[0];
  return mem.fecha_fin >= hoy;
}

function setStats(total, activos, inactivos) {
  document.getElementById('statProductos').textContent = total     ?? '0';
  document.getElementById('statActivos').textContent   = activos   ?? '0';
  document.getElementById('statInactivos').textContent = inactivos ?? '0';
}

function mostrarError(msg) {
  const elBienvenida = document.getElementById('bienvenida');
  if (elBienvenida) elBienvenida.textContent = '⚠ ' + msg;
  const panel = document.getElementById('panelMembresia');
  if (panel) panel.innerHTML =
    `<p style="color:var(--texto-medio);font-size:.87rem">${msg}</p>`;
  setStats('—', '—', '—');
}
function cargarNombreTienda(vendedor) {
  const el = document.getElementById('bienvenida');

  if (!el) return;

  if (vendedor && vendedor.nombre) {
    el.textContent = `Bienvenido, ${vendedor.nombre}`;
  } else {
    el.textContent = 'Bienvenido';
  }
}
// ── Init ──────────────────────────────────────────────────
async function init() {
  try {
    const token = await getToken();
    if (!token) { mostrarError('Error de autenticación.'); return; }

    // Dos fetches en paralelo
    const [resMem, resStats, resVendedor] = await Promise.all([
      fetch(`../backend/membresias.php?token=${token}`, { credentials: 'include' }),
      fetch(`../backend/productos.php?accion=stats&token=${token}`, { credentials: 'include' }),
      fetch(`../backend/vendedor.php?accion=stats&token=${token}`, { credentials: 'include' }),
    ]);

    const [jsonMem, jsonStats, jsonVen] = await Promise.all([
      resMem.json(),
      resStats.json(),
      resVendedor.json(),
  
    ]);
  
    // Estadísticas de productos
    if (jsonStats.ok) {
      const s = jsonStats.datos;
      setStats(s.total, s.activos, s.inactivos);
      
    } else {
      setStats(0, 0, 0);
    }

    // Membresía
    if (!jsonMem.ok) {
      mostrarError(jsonMem.error || 'No se pudo cargar la membresía.');
      return;
    }
    
    const { membresia, fundador } = jsonMem.datos;
    renderMembresia(membresia, fundador);

    cargarNombreTienda(jsonVen);
  } catch (e) {
    console.error(e);
    mostrarError('Error de conexión.');
  }
}

// ── Render membresía ──────────────────────────────────────
function renderMembresia(mem, fundador) {
  const el         = document.getElementById('panelMembresia');
  const hoy        = new Date().toISOString().split('T')[0];
  const vigente    = membresiaVigente(mem);
  const esFundador = fundador?.esFundador || false;
  const precio     = esFundador ? PRECIO_FUNDADOR : PRECIO_NORMAL;
  const planNombre = esFundador ? '⭐ Plan Fundador' : 'Plan Estándar';

  const planStyle = esFundador
    ? 'background:#fef9c3;color:#92400e;border:1.5px solid #f59e0b'
    : 'background:var(--fondo-2);color:var(--texto-medio);border:1.5px solid var(--borde)';

  const badgePlan = `<span style="display:inline-block;border-radius:8px;padding:.25rem .75rem;
    font-size:.78rem;font-weight:700;${planStyle}">${planNombre}</span>`;

  const btnPago = `
    <a href="membresia.html" class="btn btn-primary"
       style="white-space:nowrap;display:inline-flex;align-items:center;gap:.5rem">
      💳 Pagar membresía — ${formatoPrecio(precio)}/mes
    </a>`;

const notaFundador = esFundador
  ? `<br/><span style="color:#92400e;font-size:.8rem">
       ⭐ Eres miembro fundador desde el <strong>${fundador.fechaRegistro}</strong>.
     </span>`
  : '';
  // Sin membresía
  if (!mem) {
    el.innerHTML = `
      <div style="display:flex;flex-wrap:wrap;align-items:flex-start;justify-content:space-between;gap:1.25rem">
        <div>
          <div style="margin-bottom:.6rem">${badgePlan}</div>
          <span class="badge badge-inactivo" style="font-size:.85rem;padding:.3rem .9rem">Sin membresía</span>
          <p style="font-size:.83rem;color:var(--texto-medio);margin-top:.5rem">
            No tienes membresía activa. Realiza tu pago para activarla.${notaFundador}
          </p>
        </div>
        ${btnPago}
      </div>`;
    return;
  }

  const dias = Math.ceil((new Date(mem.fecha_fin) - new Date(hoy)) / 86_400_000);

  // Vencida
  if (!vigente) {
    el.innerHTML = `
      <div style="display:flex;flex-wrap:wrap;align-items:flex-start;justify-content:space-between;gap:1.25rem">
        <div>
          <div style="margin-bottom:.6rem">${badgePlan}</div>
          <span class="badge badge-vencida" style="font-size:.85rem;padding:.3rem .9rem">Membresía vencida</span>
          <p style="font-size:.83rem;color:var(--texto-medio);margin-top:.5rem">
            Venció el <strong>${mem.fecha_fin}</strong>. Renuévala para aparecer en el catálogo.${notaFundador}
          </p>
        </div>
        ${btnPago}
      </div>`;
    return;
  }

  // Alerta próximo vencimiento
  let alerta = '';
  if (dias <= 7) {
    alerta = `
      <div class="msg-error visible" style="margin-bottom:1rem">
        <span>⚠&nbsp;</span>
        <span>Tu membresía vence en ${dias} día${dias !== 1 ? 's' : ''}. ¡Renuévala pronto!</span>
      </div>`;
  } else if (dias <= 30) {
    alerta = `
      <div style="background:var(--adv-bg,#fffbeb);border:1.5px solid var(--adv-borde,#f59e0b);
                  border-radius:8px;padding:.6rem .9rem;font-size:.83rem;
                  color:var(--advertencia,#d97706);margin-bottom:1rem">
        ⏰ Tu membresía vence en ${dias} días (${mem.fecha_fin})
      </div>`;
  }

  // Activa
  el.innerHTML = `
    ${alerta}
    <div style="display:flex;flex-wrap:wrap;align-items:flex-start;justify-content:space-between;gap:1.25rem">
      <div>
        <div style="margin-bottom:.6rem">${badgePlan}</div>
        <span class="badge badge-activo" style="font-size:.85rem;padding:.3rem .9rem">✓ Membresía activa</span>
        <p style="font-size:.83rem;color:var(--texto-medio);margin-top:.5rem">
          Válida hasta: <strong>${mem.fecha_fin}</strong>
          · ${dias} día${dias !== 1 ? 's' : ''} restante${dias !== 1 ? 's' : ''}
          ${esFundador
            ? `<br/><span style="color:#92400e;font-size:.8rem">
                ⭐ Beneficio fundador hasta <strong>${fechaLimite(fundador.fechaRegistro)}</strong>
               </span>`
            : ''}
        </p>
      </div>
      <a href="membresia.html" class="btn btn-secundario" style="white-space:nowrap">
        💳 Renovar membresía
      </a>
    </div>`;
}

// ── Arrancar ──────────────────────────────────────────────
init();