// ============================================================
//  productos.js — Gestión de productos
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
function formatoPrecio(n) {
  return '$' + Number(n || 0).toLocaleString('es-CO');
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
let productos  = [];
let categorias = [];
let vendedores = [];
let idEliminar = null;
let busqueda   = '';

const POR_PAG_PROD = 30;
let paginaProd     = 1;

// ── Cargar ────────────────────────────────────────────────
async function cargar(mantenerPagina = false) {
  const paginaAntes = paginaProd;
  try {
    [productos, categorias, vendedores] = await Promise.all([
      apiGet('productos.php?accion=listar'),
      apiGet('productos.php?accion=categorias'),
      apiGet('vendedores.php?accion=obtener'),
    ]);
    // Parsear beneficios: vienen como string JSON o texto plano
    productos = productos.map(p => ({
      ...p,
      activo: !!Number(p.activo),
      beneficios: (() => {
        if (!p.beneficios) return [];
        try { return JSON.parse(p.beneficios); } catch { return p.beneficios.split('\n').filter(Boolean); }
      })(),
    }));
    paginaProd = mantenerPagina ? paginaAntes : 1;
    renderTablaPag();
  } catch (e) { console.error(e); }
}

function nombreCategoria(id) {
  const c = categorias.find(x => String(x.id) === String(id));
  return c ? c.nombre : '—';
}
function nombreVendedor(id) {
  const v = vendedores.find(x => String(x.id) === String(id));
  return v ? v.nombre : '—';
}

// ── Buscador ──────────────────────────────────────────────
document.getElementById('buscador').addEventListener('input', e => {
  busqueda   = e.target.value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  paginaProd = 1;
  renderTablaPag();
});

function renderTabla() {
  paginaProd = 1;
  renderTablaPag();
}

function renderTablaPag() {
  const filtrados = busqueda
    ? productos.filter(p => {
        const txt = (p.nombre + ' ' + (p.descripcion || ''))
          .toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        return txt.includes(busqueda);
      })
    : productos;

  const total     = filtrados.length;
  const totalPags = Math.max(1, Math.ceil(total / POR_PAG_PROD));
  if (paginaProd > totalPags) paginaProd = totalPags;

  const desde  = (paginaProd - 1) * POR_PAG_PROD;
  const pagina = filtrados.slice(desde, desde + POR_PAG_PROD);

  document.getElementById('totalProductos').textContent =
    total + ' producto' + (total !== 1 ? 's' : '') +
    (totalPags > 1 ? '  ·  pág. ' + paginaProd + ' / ' + totalPags : '');

  const wrap = document.getElementById('tablaWrap');
  if (!filtrados.length) {
    wrap.innerHTML = '<p class="vacio-txt">Sin productos encontrados.</p>';
    return;
  }

  const imgCell = p => {
    if (!p.imagen)
      return `<div style="width:44px;height:44px;border-radius:8px;background:var(--verde-claro);
                          display:flex;align-items:center;justify-content:center;font-size:1.2rem">📦</div>`;
    const src = p.imagen.startsWith('http') ? p.imagen : '../../' + p.imagen;
    return `<img src="${src}" style="width:44px;height:44px;object-fit:cover;border-radius:8px;
                                     border:1.5px solid var(--borde);display:block">`;
  };

  const filas = pagina.map(p => `
    <tr>
      <td style="padding:8px">${imgCell(p)}</td>
      <td style="padding:8px;max-width:180px">
        <strong style="display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-size:.875rem">${p.nombre}</strong>
      </td>
      <td style="padding:8px;white-space:nowrap;font-size:.875rem">${formatoPrecio(p.valor)}</td>
      <td style="padding:8px;font-size:.85rem">${nombreCategoria(p.categoria_id)}</td>
      <td style="padding:8px;font-size:.85rem">${nombreVendedor(p.vendedor_id)}</td>
      <td style="padding:8px">
        <span class="badge badge-${p.activo ? 'activo' : 'inactivo'}">${p.activo ? 'Activo' : 'Inactivo'}</span>
      </td>
      <td style="padding:8px">
        <div class="td-acciones">
          <button class="btn-tabla btn-editar"   data-id="${p.id}">✏ Editar</button>
          <button class="btn-tabla btn-eliminar" data-id="${p.id}" data-nombre="${p.nombre}">🗑 Eliminar</button>
        </div>
      </td>
    </tr>`).join('');

  const paginador = totalPags > 1 ? buildPaginador(paginaProd, totalPags) : '';

  wrap.innerHTML = `
    <div style="overflow-x:auto;-webkit-overflow-scrolling:touch">
      <table style="min-width:620px;width:100%">
        <thead><tr>
          <th style="padding:8px;width:60px">Imagen</th>
          <th style="padding:8px">Nombre</th>
          <th style="padding:8px">Valor</th>
          <th style="padding:8px">Categoría</th>
          <th style="padding:8px">Vendedor</th>
          <th style="padding:8px">Estado</th>
          <th style="padding:8px">Acciones</th>
        </tr></thead>
        <tbody>${filas}</tbody>
      </table>
    </div>
    ${paginador}`;

  wrap.querySelectorAll('.btn-editar').forEach(btn =>
    btn.addEventListener('click', () => abrirEditar(btn.dataset.id)));
  wrap.querySelectorAll('.btn-eliminar').forEach(btn =>
    btn.addEventListener('click', () => abrirEliminar(btn.dataset.id, btn.dataset.nombre)));
  wrap.querySelectorAll('[data-pag-prod]').forEach(btn =>
    btn.addEventListener('click', () => {
      paginaProd = parseInt(btn.dataset.pagProd);
      renderTablaPag();
      wrap.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }));
}

// ── Paginador ─────────────────────────────────────────────
function buildPaginador(actual, total) {
  if (total <= 1) return '';
  const MAX = window.innerWidth < 500 ? 3 : 5;
  let ini = Math.max(1, actual - Math.floor(MAX / 2));
  let fin = Math.min(total, ini + MAX - 1);
  if (fin - ini < MAX - 1) ini = Math.max(1, fin - MAX + 1);
  const TAM = window.innerWidth < 500 ? '44px' : '36px';
  const FS  = window.innerWidth < 500 ? '.9rem' : '.82rem';
  const s = on =>
    `display:inline-flex;align-items:center;justify-content:center;` +
    `min-width:${TAM};height:${TAM};padding:0 8px;border-radius:8px;` +
    `font-size:${FS};font-weight:600;cursor:pointer;` +
    `background:${on ? 'var(--verde)' : 'var(--fondo-2)'};` +
    `color:${on ? '#fff' : 'var(--texto)'};` +
    `border:1.5px solid ${on ? 'var(--verde)' : 'var(--borde)'};transition:background .15s;`;
  let btns = '';
  if (actual > 1)    btns += `<button data-pag-prod="${actual - 1}" style="${s(false)}">←</button>`;
  for (let i = ini; i <= fin; i++) btns += `<button data-pag-prod="${i}" style="${s(i === actual)}">${i}</button>`;
  if (actual < total) btns += `<button data-pag-prod="${actual + 1}" style="${s(false)}">→</button>`;
  const info = `<span style="font-size:.8rem;color:var(--texto-suave);white-space:nowrap">Pág. ${actual} / ${total}</span>`;
  return `<div style="display:flex;align-items:center;justify-content:center;gap:6px;margin-top:1.25rem;padding:.75rem 0;flex-wrap:wrap">${btns}${info}</div>`;
}

// ── Cloudinary ────────────────────────────────────────────
const CLOUD_NAME    = 'dqmrgerue';
const UPLOAD_PRESET = 'gi-store';
let archivoSeleccionado = null;

const zonaImagen  = document.getElementById('zonaImagen');
const inputFile   = document.getElementById('fImagenFile');
const previstaDiv = document.getElementById('previstaImagen');
const imgPreview  = document.getElementById('imgPreview');
const imgNombre   = document.getElementById('imgNombre');
const imgEstado   = document.getElementById('imgEstado');
const btnQuitar   = document.getElementById('btnQuitarImg');

zonaImagen.addEventListener('click', () => inputFile.click());

zonaImagen.addEventListener('dragover', e => {
  e.preventDefault();
  zonaImagen.style.borderColor = 'var(--verde)';
  zonaImagen.style.background  = 'var(--verde-hover)';
});
zonaImagen.addEventListener('dragleave', () => {
  zonaImagen.style.borderColor = 'var(--verde-borde)';
  zonaImagen.style.background  = 'var(--verde-claro)';
});
zonaImagen.addEventListener('drop', e => {
  e.preventDefault();
  zonaImagen.style.borderColor = 'var(--verde-borde)';
  zonaImagen.style.background  = 'var(--verde-claro)';
  const file = e.dataTransfer.files[0];
  if (file) seleccionarArchivo(file);
});
inputFile.addEventListener('change', e => {
  const file = e.target.files[0];
  if (file) seleccionarArchivo(file);
});

function seleccionarArchivo(file) {
  if (!file.type.startsWith('image/')) { alert('Solo se permiten imágenes (JPG, PNG, WEBP).'); return; }
  if (file.size > 5 * 1024 * 1024)    { alert('La imagen no puede superar 5MB.'); return; }
  archivoSeleccionado   = file;
  imgPreview.src        = URL.createObjectURL(file);
  imgNombre.textContent = file.name;
  imgEstado.textContent = 'Lista para guardar';
  imgEstado.style.color = 'var(--texto-suave)';
  previstaDiv.style.display = 'flex';
  document.getElementById('zonaTexto').innerHTML =
    "<p style='font-size:.82rem;color:var(--verde);font-weight:600'>✓ Imagen seleccionada</p>";
}

btnQuitar.addEventListener('click', () => {
  archivoSeleccionado = null;
  inputFile.value     = '';
  document.getElementById('fImagen').value = '';
  previstaDiv.style.display = 'none';
  resetZonaTexto();
});

async function subirImagen() {
  if (!archivoSeleccionado) return null;
  imgEstado.textContent = 'Subiendo...';
  imgEstado.style.color = 'var(--advertencia)';
  const formData = new FormData();
  formData.append('file',          archivoSeleccionado);
  formData.append('upload_preset', UPLOAD_PRESET);
  formData.append('folder',        'productos-clientes');
  const res  = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`, { method: 'POST', body: formData });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error?.message || 'Error al subir');
  imgEstado.textContent = '✓ Subida correctamente';
  imgEstado.style.color = 'var(--ok)';
  return data.secure_url;
}

// ── Llenar selects ────────────────────────────────────────
function llenarSelects(catId = '', vendId = '') {
  document.getElementById('fCategoria').innerHTML =
    `<option value="">— Categoría —</option>` +
    categorias.map(c =>
      `<option value="${c.id}" ${String(c.id) === String(catId) ? 'selected' : ''}>${c.nombre}</option>`
    ).join('');

  document.getElementById('fVendedor').innerHTML =
    `<option value="">— Vendedor —</option>` +
    vendedores.map(v =>
      `<option value="${v.id}" ${String(v.id) === String(vendId) ? 'selected' : ''}>${v.nombre}</option>`
    ).join('');
}

// ── Modal crear ───────────────────────────────────────────
document.getElementById('btnNuevo').addEventListener('click', () => {
  limpiarModal();
  document.getElementById('modalTitulo').textContent = 'Nuevo producto';
  document.getElementById('productoId').value = '';
  llenarSelects();
  ocultarMensajes();
  abrirModal('modalOverlay');
});

// ── Modal editar ──────────────────────────────────────────
function abrirEditar(id) {
  const p = productos.find(x => String(x.id) === String(id));
  if (!p) return;
  limpiarModal();
  document.getElementById('modalTitulo').textContent = 'Editar producto';
  document.getElementById('productoId').value         = p.id;
  document.getElementById('fNombre').value            = p.nombre        || '';
  document.getElementById('fValor').value             = p.valor         || '';
  document.getElementById('fDescripcion').value       = p.descripcion   || '';
  document.getElementById('fRecomendacion').value     = p.recomendacion || '';
  document.getElementById('fBeneficios').value        = (p.beneficios || []).join('\n');
  document.getElementById('fActivo').value            = p.activo ? 'true' : 'false';
  document.getElementById('fImagen').value            = p.imagen || '';
  archivoSeleccionado = null;

  if (p.imagen) {
    const src = p.imagen.startsWith('http') ? p.imagen : '../../' + p.imagen;
    imgPreview.src        = src;
    imgNombre.textContent = p.imagen.split('/').pop();
    imgEstado.textContent = 'Imagen actual';
    imgEstado.style.color = 'var(--texto-suave)';
    previstaDiv.style.display = 'flex';
    document.getElementById('zonaTexto').innerHTML =
      "<p style='font-size:.82rem;color:var(--verde);font-weight:600'>✓ Imagen actual cargada</p>";
  }

  llenarSelects(p.categoria_id, p.vendedor_id);
  ocultarMensajes();
  abrirModal('modalOverlay');
}

// ── Guardar ───────────────────────────────────────────────
document.getElementById('btnGuardar').addEventListener('click', async () => {
  const id          = document.getElementById('productoId').value;
  const nombre      = document.getElementById('fNombre').value.trim();
  const valor       = Number(document.getElementById('fValor').value);
  const categoria_id= document.getElementById('fCategoria').value;
  const vendedor_id = document.getElementById('fVendedor').value;
  const descripcion = document.getElementById('fDescripcion').value.trim();
  const recomendacion=document.getElementById('fRecomendacion').value.trim();
  const beneficiosArr = document.getElementById('fBeneficios').value
  .split('\n').map(b => b.trim()).filter(Boolean);
const beneficios = beneficiosArr.length ? JSON.stringify(beneficiosArr) : '[]'; 
  const activo      = document.getElementById('fActivo').value === 'true' ? 1 : 0;

  if (!nombre)      { mostrarError('El nombre es obligatorio.');  return; }
  if (!valor)       { mostrarError('El valor es obligatorio.');   return; }
  if (!vendedor_id) { mostrarError('Selecciona un vendedor.');    return; }
  if (!categoria_id) { mostrarError('Selecciona una categoría.'); return; }

  const btn = document.getElementById('btnGuardar');
  btnCargando(btn, true); ocultarMensajes();

  // Subir imagen a Cloudinary si hay archivo nuevo
  let imagen = document.getElementById('fImagen').value.trim();
  if (archivoSeleccionado) {
    try {
      imagen = await subirImagen();
      if (!imagen) { mostrarError('No se pudo subir la imagen.'); btnCargando(btn, false); return; }
      archivoSeleccionado = null;
    } catch (e) {
      mostrarError('Error subiendo la imagen: ' + e.message);
      btnCargando(btn, false);
      return;
    }
  }

  try {
    const params = { nombre, valor, categoria_id, vendedor_id,
                     imagen, descripcion, recomendacion, beneficios, activo };
    if (id) {
      await apiPost('productos.php?accion=actualizar', { id, ...params });
      mostrarOk('Producto actualizado correctamente.');
    } else {
      await apiPost('productos.php?accion=crear', params);
      mostrarOk('Producto creado correctamente.');
    }
    await cargar(true);
    setTimeout(() => cerrarModal('modalOverlay'), 1200);
  } catch (e) {
    mostrarError(e.message || 'Error al guardar. Intenta de nuevo.');
    console.error(e);
  } finally {
    btnCargando(btn, false);
  }
});

// ── Eliminar ──────────────────────────────────────────────
function abrirEliminar(id, nombre) {
  idEliminar = id;
  document.getElementById('nombreEliminar').textContent = nombre;
  abrirModal('modalEliminar');
}
document.getElementById('btnConfirmarEliminar').addEventListener('click', async () => {
  const btn = document.getElementById('btnConfirmarEliminar');
  btnCargando(btn, true);
  try {
    await apiPost('productos.php?accion=eliminar', { id: idEliminar });
    cerrarModal('modalEliminar');
    await cargar(true);
  } catch (e) { console.error(e); }
  finally { btnCargando(btn, false); }
});

// ── Cerrar modales ────────────────────────────────────────
document.getElementById('btnCancelar').addEventListener('click', () => cerrarModal('modalOverlay'));
document.getElementById('btnCancelarEliminar').addEventListener('click', () => cerrarModal('modalEliminar'));
document.getElementById('modalOverlay').addEventListener('click', e => {
  if (e.target === document.getElementById('modalOverlay')) cerrarModal('modalOverlay');
});

// ── Helpers UI ────────────────────────────────────────────
function resetZonaTexto() {
  document.getElementById('zonaTexto').innerHTML = `
    <div style="font-size:2rem;margin-bottom:.4rem">🖼️</div>
    <p style="font-size:.85rem;color:var(--texto-medio);margin-bottom:.3rem"><strong>Haz clic para seleccionar</strong> o arrastra aquí</p>
    <p style="font-size:.75rem;color:var(--texto-suave)">JPG, PNG, WEBP — máx. 5MB</p>`;
}
function limpiarModal() {
  ['fNombre','fValor','fImagen','fDescripcion','fRecomendacion','fBeneficios'].forEach(id => {
    document.getElementById(id).value = '';
  });
  document.getElementById('fActivo').value = 'true';
  previstaDiv.style.display = 'none';
  archivoSeleccionado = null;
  inputFile.value = '';
  resetZonaTexto();
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