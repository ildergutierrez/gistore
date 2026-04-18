async function getToken() {
  try {
    const r = await fetch('../../backend/tokens.php?accion=obtener', { credentials: 'include' });
    const d = await r.json();
    return d.token || '';
  } catch { return ''; }
}

let grafica = null;
let DATOS = { destacados: [], compartidos: [] };
let modo = 'dia';

function parseFecha(f) { return new Date(f + 'T00:00:00'); }

function filtrar(arr, m) {
  const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
  return arr.filter(r => {
    const f = parseFecha(r.fecha);
    if (m === 'dia')    return f.getTime() === hoy.getTime();
    if (m === 'semana') { const l = new Date(hoy); l.setDate(l.getDate() - 6);  return f >= l; }
    if (m === 'mes')    { const l = new Date(hoy); l.setDate(l.getDate() - 29); return f >= l; }
    if (m === 'anio')   return f.getFullYear() === hoy.getFullYear();
    return true;
  });
}

function agruparFecha(arr) {
  const m = {};
  arr.forEach(r => { m[r.fecha] = (m[r.fecha] || 0) + Number(r.cantidad); });
  return m;
}

function agruparProducto(arr) {
  const m = {};
  arr.forEach(r => {
    if (!m[r.id_producto]) m[r.id_producto] = { id: r.id_producto, nombre: r.nombre_producto, cantidad: 0 };
    m[r.id_producto].cantidad += Number(r.cantidad);
  });
  return Object.values(m).sort((a, b) => b.cantidad - a.cantidad);
}

function actualizarCards(vis, com) {
  const totVis = vis.reduce((a, r) => a + Number(r.cantidad), 0);
  const totCom = com.reduce((a, r) => a + Number(r.cantidad), 0);
  const fechas = new Set([...vis.map(r => r.fecha), ...com.map(r => r.fecha)]);
  const porDia = agruparFecha(vis);
  const pico   = Object.values(porDia).length ? Math.max(...Object.values(porDia)) : 0;
  document.getElementById('c-vis').textContent  = totVis.toLocaleString('es-CO');
  document.getElementById('c-com').textContent  = totCom.toLocaleString('es-CO');
  document.getElementById('c-dias').textContent = fechas.size;
  document.getElementById('c-pico').textContent = pico.toLocaleString('es-CO');
}

function actualizarGrafica(vis, com) {
  const mapVis = agruparFecha(vis);
  const mapCom = agruparFecha(com);
  const fechas = [...new Set([...Object.keys(mapVis), ...Object.keys(mapCom)])].sort();
  const labels = fechas.map(f => {
    const d = parseFecha(f);
    return d.toLocaleDateString('es-CO', { day: '2-digit', month: 'short' });
  });

  if (grafica) { grafica.destroy(); grafica = null; }
  const ctx = document.getElementById('est-chart');
  if (!ctx) return;

  grafica = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [
        {
          label: 'Visitas',
          data: fechas.map(f => mapVis[f] || 0),
          borderColor: '#378add',
          backgroundColor: 'rgba(55,138,221,.12)',
          tension: 0.35,
          fill: true,
          borderWidth: 2,
          pointRadius: 5,
          pointHoverRadius: 7,
          pointBackgroundColor: '#378add',
          pointBorderColor: '#fff',
          pointBorderWidth: 2,
          borderDash: []
        },
        {
          label: 'Compartidos',
          data: fechas.map(f => mapCom[f] || 0),
          borderColor: '#1d9e75',
          backgroundColor: 'rgba(29,158,117,.08)',
          tension: 0.35,
          fill: true,
          borderWidth: 2,
          pointRadius: 5,
          pointHoverRadius: 7,
          pointBackgroundColor: '#1d9e75',
          pointBorderColor: '#fff',
          pointBorderWidth: 2,
          borderDash: [6, 4]
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          mode: 'index',
          intersect: false,
          callbacks: {
            label: ctx => ` ${ctx.dataset.label}: ${ctx.parsed.y.toLocaleString('es-CO')}`
          }
        }
      },
      scales: {
        x: {
          grid: { color: 'rgba(128,128,128,.1)' },
          ticks: { maxTicksLimit: 12, font: { size: 11 } }
        },
        y: {
          beginAtZero: true,
          grid: { color: 'rgba(128,128,128,.1)' },
          ticks: { precision: 0, font: { size: 11 } }
        }
      }
    }
  });
}

function renderTabla(id, filas) {
  const cont = document.getElementById(id);
  if (!cont) return;
  if (!filas.length) {
    cont.innerHTML = '<p style="color:var(--texto-suave);font-size:.85rem;padding:.5rem 0">Sin datos para este período</p>';
    return;
  }
  const rows = filas.slice(0, 5).map((r, i) => `
    <tr>
      <td style="width:8%;color:var(--texto-suave);font-size:.75rem;padding:.5rem .3rem;text-align:center;vertical-align:middle">${i + 1}</td>
      <td style="width:70%;padding:.5rem .4rem;font-size:.82rem;vertical-align:middle;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:0" title="${r.nombre}">${r.nombre}</td>
      <td style="width:22%;text-align:right;padding:.5rem .3rem;font-weight:700;font-size:.85rem;vertical-align:middle;white-space:nowrap">${Number(r.cantidad).toLocaleString('es-CO')}</td>
    </tr>`).join('');
  cont.innerHTML = `
    <table style="width:100%;border-collapse:collapse;table-layout:fixed;min-width:0">
      <thead>
        <tr>
          <th style="width:8%;padding:.35rem .3rem;text-align:center;font-weight:600;font-size:.7rem;color:var(--texto-suave);border-bottom:1.5px solid var(--borde)">#</th>
          <th style="width:70%;padding:.35rem .4rem;text-align:left;font-weight:600;font-size:.7rem;color:var(--texto-suave);border-bottom:1.5px solid var(--borde)">PRODUCTO</th>
          <th style="width:22%;padding:.35rem .3rem;text-align:right;font-weight:600;font-size:.7rem;color:var(--texto-suave);border-bottom:1.5px solid var(--borde)">TOTAL</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>`;
}

function render() {
  const vis = filtrar(DATOS.destacados, modo);
  const com = filtrar(DATOS.compartidos, modo);
  actualizarCards(vis, com);
  actualizarGrafica(vis, com);
  renderTabla('tbl-vistos',      agruparProducto(vis));
  renderTabla('tbl-compartidos', agruparProducto(com));
}

async function init() {
  try {
    const token = await getToken();
    if (!token) return;
    const res  = await fetch(`../backend/estadisticas.php?accion=obtener&token=${token}`, { credentials: 'include' });
    const json = await res.json();
    if (json.ok) {
      const raw = Array.isArray(json.datos) ? json.datos : [];
      DATOS.destacados  = raw.filter(r => r.tipo === 'destacado');
      DATOS.compartidos = raw.filter(r => r.tipo === 'compartido');
      render();
    }
  } catch (e) {
    console.error('estadistica init:', e);
  }
}

function iniciarActualizacion() {
  const delay = Math.floor(Math.random() * (35000 - 15000 + 1)) + 15000;
  setTimeout(() => {
    init();
    iniciarActualizacion();
  }, delay);
}

document.addEventListener('DOMContentLoaded', () => {
  // Filtros
  document.getElementById('est-filtros')?.addEventListener('click', e => {
    const btn = e.target.closest('.est-btn');
    if (!btn) return;
    document.querySelectorAll('.est-btn').forEach(b => b.classList.remove('activo'));
    btn.classList.add('activo');
    modo = btn.dataset.modo;
    render();
  });

  // Carga inicial + actualización con jitter
  init();
  iniciarActualizacion();
});