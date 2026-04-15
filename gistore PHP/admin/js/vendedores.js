// ============================================================
//  admin/js/vendedores.js — Gestión de vendedores (PHP + MySQL)
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
  const resp = await fetch(`../backend/${endpoint}&token=${token}`, { credentials: 'include' });
  const data = await resp.json();
  if (!data.ok) throw new Error(data.error || 'Error');
  return data.datos;
}

async function apiPost(endpoint, params = {}) {
  const token = await getToken();
  const body = new URLSearchParams({ ...params, token });
  const resp = await fetch(`../backend/${endpoint}`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });
  const data = await resp.json();
  //console.log('API Response:', data);
  if (!data.ok) throw new Error(data.error || 'Error');
  return data.datos;
}

// ── Fecha ─────────────────────────────────────────────────
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

// ── Paleta de colores ─────────────────────────────────────
const COLORES = [
  "#1a6b3c","#2d8a56","#4caf50","#81c784","#a5d6a7",
  "#1565c0","#1976d2","#2196f3","#64b5f6","#0891b2",
  "#b71c1c","#dc2626","#e53935","#e91e63","#be185d",
  "#6a1b9a","#7c3aed","#9c27b0","#ab47bc","#8e24aa",
  "#e65100","#d97706","#f57c00","#ffa726","#fbc02d",
  "#4e342e","#795548","#92400e","#6d4c41","#a1887f",
  "#1a1a2e","#374151","#1e3a5f","#263238","#455a64",
  "#006064","#00838f","#00acc1","#26c6da","#00bcd4",
];

function actualizarPreview(color) {
  document.getElementById('fColor').value                    = color;
  document.getElementById('colorPicker').value               = color;
  document.getElementById('colorPreview').style.background   = color;
  document.getElementById('colorHex').textContent            = color.toUpperCase();
}

function renderColorFila(colorActual) {
  const fila = document.getElementById('colorFila');
  fila.innerHTML = COLORES.map(c => `
    <div class="color-op"
         style="background:${c};width:100%;aspect-ratio:1;border-radius:8px;cursor:pointer;
                border:2px solid transparent;transition:transform .15s,border-color .15s;
                box-shadow:0 1px 3px rgba(0,0,0,.2)"
         data-color="${c}" title="${c}"></div>
  `).join('');

  fila.querySelectorAll('.color-op').forEach(el => {
    el.addEventListener('click', () => {
      fila.querySelectorAll('.color-op').forEach(e => {
        e.style.borderColor = 'transparent'; e.style.transform = 'scale(1)';
      });
      el.style.borderColor = '#fff'; el.style.transform = 'scale(1.2)';
      actualizarPreview(el.dataset.color);
    });
    if (el.dataset.color.toLowerCase() === colorActual.toLowerCase()) {
      el.style.borderColor = '#fff'; el.style.transform = 'scale(1.2)';
    }
  });

  actualizarPreview(colorActual);
  document.getElementById('colorPicker').oninput = (e) => {
    fila.querySelectorAll('.color-op').forEach(el => {
      el.style.borderColor = 'transparent'; el.style.transform = 'scale(1)';
    });
    actualizarPreview(e.target.value);
  };
}

// ── Ver/ocultar contraseña ────────────────────────────────
document.getElementById('btnVerPass').addEventListener('click', () => {
  const input = document.getElementById('fPassword');
  const btn   = document.getElementById('btnVerPass');
  if (input.type === 'password') { input.type = 'text';     btn.textContent = '🙈'; }
  else                           { input.type = 'password'; btn.textContent = '👁'; }
});

// ── Estado global ─────────────────────────────────────────
let vendedores = [];
let idEliminar = null;

// ── Cargar tabla ──────────────────────────────────────────
async function cargar() {
  try {
    const todos = await apiGet('vendedores.php?accion=obtener');
    vendedores = todos.filter(v => v.estado !== 'desactivado');
    //console.log(vendedores);
    document.getElementById('totalVendedores').textContent =
      vendedores.length + ' vendedor' + (vendedores.length !== 1 ? 'es' : '');
    aplicarFiltro();
  } catch (e) { console.error(e); }
}

// ── Filtro ────────────────────────────────────────────────
function aplicarFiltro() {
  const tel    = (document.getElementById('filtroTelefono')?.value || '').trim().replace(/\s/g, '');
  const correo = (document.getElementById('filtroCorreo')?.value   || '').trim().toLowerCase();

  const lista = vendedores.filter(v => {
    const telOk    = !tel    || (v.whatsapp || '').replace(/\s/g, '').includes(tel);
    const correoOk = !correo || (v.correo   || '').toLowerCase().includes(correo);
    return telOk && correoOk;
  });

  const clT = document.getElementById('clearTelefono');
  const clC = document.getElementById('clearCorreo');
  if (clT) clT.style.display = tel    ? 'inline' : 'none';
  if (clC) clC.style.display = correo ? 'inline' : 'none';

  renderTabla(lista, tel, correo);
}

function renderTabla(lista, tel = '', correo = '') {
  const wrap = document.getElementById('tablaWrap');

  if (!vendedores.length) {
    wrap.innerHTML = '<p class="vacio-txt">Sin vendedores registrados. Crea el primero.</p>';
    return;
  }
  if (!lista.length) {
    const q = [tel, correo].filter(Boolean).join(' / ');
    wrap.innerHTML = `<p class="filtro-sin-resultados">
      🔍 Sin resultados para <strong>${q}</strong>.
      <br/><span style="font-size:.8rem">Verifica los datos e intenta de nuevo.</span>
    </p>`;
    return;
  }

  wrap.innerHTML = `
    <table>
      <thead>
        <tr>
          <th>Color</th><th>Nombre</th><th>Ciudad</th>
          <th>WhatsApp</th><th>Correo</th><th>Estado</th><th>Acciones</th>
        </tr>
      </thead>
      <tbody>
        ${lista.map(v => `
          <tr>
            <td><div style="width:22px;height:22px;border-radius:50%;background:${v.color||'#1a6b3c'};border:2px solid #ddd"></div></td>
            <td><strong>${v.nombre}</strong></td>
            <td>${v.ciudad || '—'}</td>
            <td>${v.whatsapp
              ? `<a href="https://wa.me/${v.whatsapp}" target="_blank" style="color:var(--verde);text-decoration:none">📱 ${v.whatsapp}</a>`
              : '—'}</td>
            <td>${v.correo || '—'}</td>
            <td><span class="badge badge-${v.estado === 'activo' ? 'activo' : 'inactivo'}">
              ${v.estado === 'activo' ? 'Con Acceso' : 'Sin Acceso'}
            </span></td>
            <td>
              <div class="td-acciones">
                <button class="btn-tabla btn-editar"   data-id="${v.id}">✏ Editar</button>
                <button class="btn-tabla btn-eliminar" data-id="${v.id}" data-nombre="${v.nombre}">🚫 Desactivar</button>
              </div>
            </td>
          </tr>`).join('')}
      </tbody>
    </table>`;

  wrap.querySelectorAll('.btn-editar').forEach(btn =>
    btn.addEventListener('click', () => abrirEditar(btn.dataset.id)));
  wrap.querySelectorAll('.btn-eliminar').forEach(btn =>
    btn.addEventListener('click', () => abrirEliminar(btn.dataset.id, btn.dataset.nombre)));
}

// ── Filtros — eventos ─────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  const inTel  = document.getElementById('filtroTelefono');
  const inCorr = document.getElementById('filtroCorreo');
  const clT    = document.getElementById('clearTelefono');
  const clC    = document.getElementById('clearCorreo');

  inTel ?.addEventListener('input', aplicarFiltro);
  inCorr?.addEventListener('input', aplicarFiltro);

  clT?.addEventListener('click', () => { inTel.value  = ''; inTel.focus();  aplicarFiltro(); });
  clC?.addEventListener('click', () => { inCorr.value = ''; inCorr.focus(); aplicarFiltro(); });

  inTel ?.addEventListener('keydown', e => { if (e.key === 'Escape' && inTel.value)  { inTel.value  = ''; aplicarFiltro(); } });
  inCorr?.addEventListener('keydown', e => { if (e.key === 'Escape' && inCorr.value) { inCorr.value = ''; aplicarFiltro(); } });
});

// ── Modal crear ───────────────────────────────────────────
document.getElementById('btnNuevo').addEventListener('click', () => {
  limpiarModal();
  document.getElementById('modalTitulo').textContent = 'Nuevo vendedor';
  document.getElementById('vendedorId').value        = '';
  document.getElementById('campoPassword').style.display = 'block';
  renderColorFila('#1a6b3c');
  ocultarMensajes();
  abrirModal('modalOverlay');
});

// ── Modal editar ──────────────────────────────────────────
function abrirEditar(id) {
  const v = vendedores.find(x => String(x.id) === String(id));
  if (!v) return;
  limpiarModal();
  document.getElementById('modalTitulo').textContent = 'Editar vendedor';
  document.getElementById('vendedorId').value  = v.id;
  document.getElementById('fNombre').value     = v.nombre   || '';
  document.getElementById('fCiudad').value     = v.ciudad   || '';
  document.getElementById('fCorreo').value     = v.correo   || '';
  document.getElementById('fWhatsapp').value   = v.whatsapp || '';
  document.getElementById('fColor').value      = v.color    || '#1a6b3c';
  document.getElementById('fEstado').value     = v.estado   || 'inactivo';
  // En edición la contraseña es opcional (cambio de clave)
  document.getElementById('campoPassword').style.display = 'block';
  document.getElementById('fPassword').placeholder = 'Dejar en blanco para no cambiar';
  renderColorFila(v.color || '#1a6b3c');
  ocultarMensajes();
  abrirModal('modalOverlay');
}

// ── Guardar vendedor ──────────────────────────────────────
document.getElementById('btnGuardar').addEventListener('click', async () => {
  const id       = document.getElementById('vendedorId').value;
  const nombre   = document.getElementById('fNombre').value.trim();
  const ciudad   = document.getElementById('fCiudad').value.trim();
  const correo   = document.getElementById('fCorreo').value.trim();
  const password = document.getElementById('fPassword').value;
  const whatsapp = document.getElementById('fWhatsapp').value.trim();
  const color    = document.getElementById('fColor').value;
  const estado   = document.getElementById('fEstado').value;

  if (!nombre) { mostrarError('El nombre es obligatorio.'); return; }
  if (!correo) { mostrarError('El correo es obligatorio.'); return; }
  if (!id && !password) { mostrarError('La contraseña es obligatoria para crear el vendedor.'); return; }
  if (!id && password.length < 6) { mostrarError('La contraseña debe tener al menos 6 caracteres.'); return; }

  const btn = document.getElementById('btnGuardar');
  btnCargando(btn, true);
  ocultarMensajes();

  try {
    if (!id) {
      // ── Crear nuevo vendedor ──────────────────────────
      await apiPost('vendedores.php?accion=crear', { nombre, ciudad, correo, password, whatsapp, color, estado });
      mostrarOk('✓ Vendedor creado correctamente.');
    } else {
      // ── Editar vendedor existente ─────────────────────
      const params = { id, nombre, ciudad, correo, whatsapp, color, estado };
      if (password) params.password = password; // solo si se quiere cambiar
      await apiPost('vendedores.php?accion=actualizar', params);
      mostrarOk('✓ Vendedor actualizado correctamente.');
    }

    await cargar();
    setTimeout(() => cerrarModal('modalOverlay'), 2000);

  } catch (e) {
    console.error(e);
    mostrarError(e.message || 'Hubo un problema al guardar. Intenta de nuevo.');
  } finally {
    btnCargando(btn, false);
  }
});

// ── Modal desactivar ──────────────────────────────────────
function abrirEliminar(id, nombre) {
  idEliminar = id;
  document.getElementById('nombreEliminar').textContent = nombre;
  abrirModal('modalEliminar');
}

document.getElementById('btnConfirmarEliminar').addEventListener('click', async () => {
  const btn = document.getElementById('btnConfirmarEliminar');
  btnCargando(btn, true);
  try {
    await apiPost('vendedores.php?accion=desactivar', { id: idEliminar });
    cerrarModal('modalEliminar');
    await cargar();
  } catch (e) { console.error(e); }
  finally { btnCargando(btn, false); }
});

// ── Cerrar modales ────────────────────────────────────────
document.getElementById('btnCancelar').addEventListener('click',         () => cerrarModal('modalOverlay'));
document.getElementById('btnCancelarEliminar').addEventListener('click', () => cerrarModal('modalEliminar'));
document.getElementById('modalOverlay').addEventListener('click', e => {
  if (e.target === document.getElementById('modalOverlay')) cerrarModal('modalOverlay');
});
document.getElementById('modalEliminar').addEventListener('click', e => {
  if (e.target === document.getElementById('modalEliminar')) cerrarModal('modalEliminar');
});

// ── Helpers UI ────────────────────────────────────────────
function limpiarModal() {
  ['fNombre','fCiudad','fCorreo','fWhatsapp','fPassword'].forEach(id => {
    document.getElementById(id).value = '';
  });
  document.getElementById('fPassword').type         = 'password';
  document.getElementById('fPassword').placeholder  = '';
  document.getElementById('btnVerPass').textContent  = '👁';
  document.getElementById('fEstado').value = 'activo';
  document.getElementById('fColor').value  = '#1a6b3c';
}
function ocultarMensajes() {
  document.getElementById('msgError').classList.remove('visible');
  document.getElementById('msgOk').classList.remove('visible');
}
function mostrarError(msg) {
  document.getElementById('textoError').textContent = msg;
  document.getElementById('msgError').classList.add('visible');
  document.getElementById('msgOk').classList.remove('visible');
}
function mostrarOk(msg) {
  document.getElementById('textoOk').textContent = msg;
  document.getElementById('msgOk').classList.add('visible');
  document.getElementById('msgError').classList.remove('visible');
}

// ── Arrancar ──────────────────────────────────────────────
cargar();