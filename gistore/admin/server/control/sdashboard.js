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

// ── Helpers ───────────────────────────────────────────────
async function apiGet(endpoint) {
  const token = await getToken();
  const resp = await fetch(`../backend/${endpoint}&token=${token}`, { credentials: 'include' });
  const data = await resp.json();
  if (!data.ok) throw new Error(data.error || 'Error');
  return data.datos;
}

const obtenerEstadisticas = () => apiGet('estadisticas.php?accion=resumen');

// ── Carga de datos en grafica, activos y desactivados ──────────────────────────────────────────
function actualizarDashboard(stats) {
  crearGrafica(stats);
}

function crearGrafica(stats) {
  const canvas = document.getElementById('grafica');

  new Chart(canvas, {
    type: 'bar',
    data: {
      labels: ['Activos', 'Desactivados'],
      datasets: [{
        data: [stats.activos || 0, stats.desactivados || 0],
        backgroundColor: ['#4CAF50', '#db2114']
      }]
    },
    options: {
      responsive: true,
      plugins: {
        legend: { position: 'bottom' }
      }
    }
  });
}

//cargar informacion al cargar la pagina
async function cargarEStadisticas() {
  try {
    const stats = await obtenerEstadisticas();
    actualizarDashboard(stats);
   console.log('Estadísticas obtenidas:', stats); // Debug
  } catch (error) {
    console.error('Error al cargar estadísticas:', error);
  }
}
cargarEStadisticas();
//document.addEventListener('DOMContentLoaded', cargarEStadisticas);