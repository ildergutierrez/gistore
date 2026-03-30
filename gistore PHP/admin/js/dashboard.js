// ============================================================
//  dashboard.js — Controlador del dashboard
// ============================================================
function badgeEstado(estado) {
  const mapa = {
    activo: ['#dcfce7', '#15803d', 'Activo'],
    activa: ['#dcfce7', '#15803d', 'Activa'],
    desactivado: ['#ecd87c', '#854d0e', 'Desactivado'],
    inactivo: ['#4d4a48', '#fbfcf7', 'Inactivo'],
    vencida: ['#da9c62', '#fbfcf7', 'Vencida'],
    cancelada: ['#997709', '#f5ebe8', 'Cancelada'],
  };

  const [bg, text, label] = mapa[estado] ?? ['#ebebeb', '#374151', estado];
  return `<span style="background:${bg};color:${text};padding:2px 8px;border-radius:99px;font-size:0.75rem;font-weight:600;">${label}</span>`;
}

// ── Token CSRF ────────────────────────────────────────────
let _token = null;

async function getToken() {
  if (_token) return _token;
  try {
    const resp = await fetch('/../../backend/tokens.php?accion=obtener', { credentials: 'include' });
    const data = await resp.json();
    _token = data.token || '';
  } catch { _token = ''; }
  return _token;
}
//------Fecha de hoy --------
function fechaHoy() {
  const hoy = new Date();
  const opciones = { year: 'numeric', month: 'long', day: 'numeric' };
  return hoy.toLocaleDateString('es-ES', opciones);
}

// ── Helpers ───────────────────────────────────────────────
async function apiGet(endpoint) {
  const token = await getToken();
  const resp = await fetch(`../backend/${endpoint}&token=${token}`, { credentials: 'include' });
  const data = await resp.json();
  if (!data.ok) throw new Error(data.error || 'Error');
  return data.datos;
}

// ── Obtener datos ─────────────────────────────────────────
const obtenerVendedores = () => apiGet('vendedores.php?accion=obtener');
const obtenerMembresias = () => apiGet('membresias.php?accion=obtener');
const obtenerProductos = () => apiGet('productos.php?accion=obtener');
const obtenerCategorias = () => apiGet('categorias.php?accion=obtener');


// ── Fecha ─────────────────────────────────────────────────
document.getElementById('fechaHoy').textContent = fechaHoy();


// ── Cargar datos ──────────────────────────────────────────
async function cargarDatos() {
  try {
    const [vendedores, membresias, productos, categorias] = await Promise.all([
      obtenerVendedores(),
      obtenerMembresias(),
      obtenerProductos(),
      obtenerCategorias(),
    ]);

    const hoyStr = new Date().toISOString().split('T')[0];

    // Stats
    document.getElementById('statVendedores').textContent =
      vendedores.filter(v => v.estado === 'activo').length;
    document.getElementById('statMembresias').textContent =
      membresias.filter(m => m.estado === 'activa' && m.fecha_fin >= hoyStr).length;
    document.getElementById('statProductos').textContent =
      productos.filter(p => p.activo).length;
    document.getElementById('statCategorias').textContent =
      categorias.length;

    // Tabla vendedores
    const tvEl = document.getElementById('tablaVendedores');
    tvEl.innerHTML = vendedores.length
      ? `<table>
          <thead><tr><th>Nombre</th><th>Ciudad</th><th>Estado</th></tr></thead>
          <tbody>
            ${vendedores.slice(0, 6).map(v => `
              <tr>
                <td>${v.nombre}</td>
                <td>${v.ciudad || '—'}</td>
                <td>${badgeEstado(v.estado)}</td>
              </tr>`).join('')}
          </tbody>
        </table>`
      : '<p class="vacio-txt">Sin vendedores registrados.</p>';

    // Tabla membresías
    const vendMap = {};
    vendedores.forEach(v => vendMap[v.id] = v.nombre);

    const tmEl = document.getElementById('tablaMembresias');
    tmEl.innerHTML = membresias.length
      ? `<table>
          <thead><tr><th>Vendedor</th><th>Vence</th><th>Estado</th></tr></thead>
          <tbody>
            ${membresias.slice(0, 6).map(m => {
        const est = m.estado === 'activa' && m.fecha_fin >= hoyStr
          ? 'activa' : m.estado === 'activa' ? 'vencida' : m.estado;
        return `<tr>
                <td>${vendMap[m.vendedor_id] || '—'}</td>
                <td>${m.fecha_fin || '—'}</td>
                <td>${badgeEstado(est)}</td>
              </tr>`;
      }).join('')}
          </tbody>
        </table>`
      : '<p class="vacio-txt">Sin membresías registradas.</p>';

  } catch (err) {
    console.error('Error cargando dashboard:', err);
  }
}

cargarDatos();