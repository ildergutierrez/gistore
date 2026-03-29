// ============================================================
//  vendedores-inactivos.js — Vendedores desactivados
//  Permite ver y reactivar vendedores con estado="desactivado"
// ============================================================

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

// ── Helpers HTTP ──────────────────────────────────────────
async function apiGet(endpoint) {
  const token = await getToken();
  const resp  = await fetch(`../backend/${endpoint}&token=${token}`, { credentials: 'include' });
  const data  = await resp.json();
  if (!data.ok) throw new Error(data.error || 'Error');
  return data.datos;
}

async function apiPost(endpoint, params = {}) {
  const token = await getToken();
  const body  = new URLSearchParams({ ...params, token });
  const resp  = await fetch(`../backend/${endpoint}`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });
  const data = await resp.json();
  if (!data.ok) throw new Error(data.error || 'Error');
  return data.datos;
}

// ── Helpers UI ────────────────────────────────────────────
function fechaHoy() {
  return new Date().toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric' });
}
function btnCargando(btn, cargando) {
  btn.disabled = cargando;
  btn.classList.toggle('cargando', cargando);
}
function abrirModal(id)  { document.getElementById(id).classList.add('visible');    }
function cerrarModal(id) { document.getElementById(id).classList.remove('visible'); }

// ── Init ──────────────────────────────────────────────────
document.getElementById('fechaHoy').textContent = fechaHoy();

document.getElementById('btnSalir').addEventListener('click', async () => {
  const resp = await fetch('../../backend/cerrar.php', { credentials: 'include' });
  const data = await resp.json();
  if (data.ok) window.location.href = '../../index.html';
});

// ── Estado global ─────────────────────────────────────────
let desactivados = [];
let idReactivar  = null;

// ── Cargar tabla ──────────────────────────────────────────
async function cargar() {
  try {
    desactivados = await apiGet('vendedores.php?accion=desactivados');
    document.getElementById('totalDesactivados').textContent =
      desactivados.length + ' desactivado' + (desactivados.length !== 1 ? 's' : '');
    aplicarFiltro();
  } catch (e) {
    console.error('Error cargando vendedores desactivados:', e);
  }
}

// ── Filtro por celular ────────────────────────────────────
function aplicarFiltro() {
  const q     = (document.getElementById('filtroCelular')?.value || '').trim().replace(/\s/g, '');
  const lista = q
    ? desactivados.filter(v => (v.whatsapp || '').replace(/\s/g, '').includes(q))
    : desactivados;

  const btnClear = document.getElementById('filtroClear');
  if (btnClear) btnClear.style.display = q ? 'inline' : 'none';

  renderTabla(lista);
}

function renderTabla(lista) {
  const wrap = document.getElementById('tablaWrap');
  const q    = (document.getElementById('filtroCelular')?.value || '').trim();

  if (!desactivados.length) {
    wrap.innerHTML = '<p class="vacio-txt">No hay vendedores desactivados. ✅</p>';
    return;
  }
  if (!lista.length) {
    wrap.innerHTML = `<p class="filtro-sin-resultados">
      📵 Sin resultados para <strong>${q}</strong>.
      <br/><span style="font-size:.8rem">Verifica el número e intenta de nuevo.</span>
    </p>`;
    return;
  }

  wrap.innerHTML = `
    <table>
      <thead>
        <tr>
          <th>Color</th>
          <th>Nombre</th>
          <th>Ciudad</th>
          <th>WhatsApp</th>
          <th>Correo</th>
          <th>Acción</th>
        </tr>
      </thead>
      <tbody>
        ${lista.map(v => `
          <tr style="opacity:.85">
            <td>
              <div style="width:22px;height:22px;border-radius:50%;
                          background:${v.color || '#94a3b8'};
                          border:2px solid #ddd;filter:grayscale(40%)"></div>
            </td>
            <td><strong>${v.nombre}</strong></td>
            <td>${v.ciudad || '—'}</td>
            <td>${v.whatsapp
              ? `<a href="https://wa.me/${v.whatsapp}" target="_blank"
                    style="color:var(--verde);text-decoration:none">📱 ${v.whatsapp}</a>`
              : '—'}</td>
            <td>${v.correo || '—'}</td>
            <td>
              <button class="btn-reactivar" data-id="${v.id}" data-nombre="${v.nombre}">
                ✅ Reactivar
              </button>
            </td>
          </tr>`).join('')}
      </tbody>
    </table>`;

  wrap.querySelectorAll('.btn-reactivar').forEach(btn =>
    btn.addEventListener('click', () => abrirReactivar(btn.dataset.id, btn.dataset.nombre))
  );
}

// ── Eventos buscador ──────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  const input    = document.getElementById('filtroCelular');
  const btnClear = document.getElementById('filtroClear');

  input?.addEventListener('input', aplicarFiltro);

  btnClear?.addEventListener('click', () => {
    input.value = '';
    btnClear.style.display = 'none';
    input.focus();
    aplicarFiltro();
  });

  input?.addEventListener('keydown', e => {
    if (e.key === 'Escape' && input.value) {
      input.value = '';
      btnClear.style.display = 'none';
      aplicarFiltro();
    }
  });
});

// ── Modal reactivar ───────────────────────────────────────
function abrirReactivar(id, nombre) {
  idReactivar = id;
  document.getElementById('nombreReactivar').textContent = nombre;
  abrirModal('modalReactivar');
}

document.getElementById('btnConfirmarReactivar').addEventListener('click', async () => {
  const btn = document.getElementById('btnConfirmarReactivar');
  btnCargando(btn, true);
  try {
    await apiPost('vendedores.php?accion=reactivar', { id: idReactivar });
    cerrarModal('modalReactivar');
    await cargar();
  } catch (e) {
    console.error('Error al reactivar vendedor:', e);
    alert('Hubo un problema al reactivar. Intenta de nuevo.');
  } finally {
    btnCargando(btn, false);
  }
});

// ── Cerrar modal ──────────────────────────────────────────
document.getElementById('btnCancelarReactivar').addEventListener('click',
  () => cerrarModal('modalReactivar')
);
document.getElementById('modalReactivar').addEventListener('click', e => {
  if (e.target === document.getElementById('modalReactivar')) cerrarModal('modalReactivar');
});

// ── Arrancar ──────────────────────────────────────────────
cargar();