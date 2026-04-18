// ── Token CSRF ────────────────────────────────────────────
let _token = null;

async function getToken() {
  if (_token) return _token;
  try {
    const resp = await fetch('../backend/tokens.php?accion=obtener', { credentials: 'include' });
    const data = await resp.json();
    _token = data.token || '';
  } catch { _token = ''; }
  return _token;
}

async function apiGet(endpoint) {
  const token = await getToken();
  const resp = await fetch(`../backend/${endpoint}&token=${token}`, { credentials: 'include' });
  const data = await resp.json();
  if (!data.ok) throw new Error(data.error || 'Error');
  return data.datos;
}

async function apiPost(endpoint, body) {
  const token = await getToken();
  const form = new URLSearchParams({ ...body, token });
  const resp = await fetch(`../backend/${endpoint}`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: form
  });
  const data = await resp.json();
  if (!data.ok) throw new Error(data.error || 'Error');
  return data.datos;
}

// ── Render en #tbody ──────────────────────────────────────
// Campos que devuelve correo_enviados.php accion=listar:
// id, tipo, grupo_destino, para_email, para_nombre, asunto,
// total_dest, total_ok, total_fail, fecha
function render(lista) {
  const tbody = document.getElementById('tbody');
  if (!lista.length) {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:2rem;color:var(--texto-suave)">No hay correos enviados</td></tr>';
    return;
  }
  tbody.innerHTML = lista.map(e => `
    <tr onclick="ver(${e.id})" style="cursor:pointer">
      <td>
        <strong>${e.para_nombre || e.grupo_destino || '—'}</strong><br/>
        <span style="font-size:.75rem;color:var(--texto-suave)">
          ${e.para_email || (e.total_dest + ' destinatarios')}
        </span>
      </td>
      <td>${e.asunto}</td>
      <td>
        <span class="badge ${e.tipo === 'masivo' ? 'badge-enviado' : 'badge-activo'}">${e.tipo}</span>
      </td>
      <td style="text-align:center">
        ${+e.total_dest > 1 ? `<span class="badge badge-promo">${e.total_dest}</span>` : '—'}
      </td>
      <td style="font-size:.8rem;color:var(--texto-suave)">${e.fecha}</td>
      <td onclick="event.stopPropagation()">
        <div class="flex-center">
          <button class="btn btn-secundario btn-sm" onclick="ver(${e.id})">Ver</button>
          <button class="btn btn-primary btn-sm" onclick="reenviar(${e.id})">Reenviar</button>
        </div>
      </td>
    </tr>
  `).join('');
}

// ── Cargar desde correo_enviados.php?accion=listar ─────────
async function cargarEnviados() {
  const q    = document.getElementById('buscar').value.trim();
  const tipo = document.getElementById('filtroTipo').value;

  let url = 'correo_enviados.php?accion=listar';
  if (q)    url += `&q=${encodeURIComponent(q)}`;
  if (tipo) url += `&tipo=${encodeURIComponent(tipo)}`;

  try {
    const datos = await apiGet(url);
    // datos = { total, pagina, enviados: [...] }
    render(datos.enviados || []);
  } catch (err) {
    console.error('Error al cargar enviados:', err);
    document.getElementById('tbody').innerHTML =
      '<tr><td colspan="6" style="text-align:center;padding:2rem;color:var(--error)">Error al cargar enviados</td></tr>';
  }
}

// filtrar() — llamado por oninput y onchange en el HTML
function filtrar() {
  cargarEnviados();
}

// ── Ver detalle en modal ───────────────────────────────────
// Campos que devuelve accion=ver:
// id, tipo, grupo_destino, para_email, para_nombre, asunto, cuerpo, fecha,
// total_dest, total_ok, total_fail, smtp_nombre, adjuntos:[{nombre,tam_kb}]
async function ver(id) {
  try {
    const e = await apiGet(`correo_enviados.php?accion=ver&id=${id}`);

    // IDs del modal en enviados.html
    document.getElementById('mAsunto').textContent = e.asunto;
    document.getElementById('mPara').textContent   = e.para_nombre
      ? `${e.para_nombre} (${e.para_email})`
      : (e.grupo_destino || '—');
    document.getElementById('mFecha').textContent  = e.fecha;
    document.getElementById('mCuerpo').textContent = e.cuerpo;

    document.getElementById('modal').style.display = 'block';
  } catch (err) {
    console.error('Error al ver enviado:', err);
  }
}

// ── Reenviar ──────────────────────────────────────────────
async function reenviar(id) {
  if (!confirm('¿Reenviar este correo al destinatario original?')) return;
  try {
    await apiPost('correo_enviados.php?accion=reenviar', { id });
    mostrarToast('Correo reenviado correctamente.');
    cargarEnviados();
  } catch (err) {
    alert('Error al reenviar: ' + err.message);
  }
}

function cerrar() {
  document.getElementById('modal').style.display = 'none';
}

function mostrarToast(txt) {
  const d = document.createElement('div');
  d.style.cssText = 'position:fixed;top:1.5rem;right:1.5rem;background:var(--ok-bg);border:1.5px solid var(--ok-borde);border-radius:var(--radio-sm);padding:.7rem 1rem;font-size:.83rem;color:var(--ok);z-index:600;display:flex;align-items:center;gap:.5rem;box-shadow:var(--sombra-md)';
  d.innerHTML = `<span class="material-symbols-outlined" style="font-size:1rem">check_circle</span>${txt}`;
  document.body.appendChild(d);
  setTimeout(() => d.remove(), 3500);
}

// ── Init ──────────────────────────────────────────────────
cargarEnviados();

document.addEventListener('keydown', e => { if (e.key === 'Escape') cerrar(); });

document.addEventListener('DOMContentLoaded', () => {
  const b = document.getElementById('btnHamburguesa');
  const s = document.querySelector('.sidebar');
  const o = document.getElementById('sidebarOverlay');
  if (b && s && o) {
    b.addEventListener('click', () => { s.classList.toggle('abierto'); o.classList.toggle('visible'); });
    o.addEventListener('click', () => { s.classList.remove('abierto'); o.classList.remove('visible'); });
  }
});