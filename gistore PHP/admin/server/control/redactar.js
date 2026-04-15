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

// ── Plantillas locales para el selector #selectPlantilla ─
const plantillasLocales = {
  bienvenida: {
    asunto: 'Bienvenido a GI Store, [nombre] 🎉',
    cuerpo: 'Hola [nombre],\n\nNos alegra tenerte como parte de la familia GI Store. Tu tienda [tienda] ya está activa en nuestra plataforma.\n\nTu plan actual: [plan]\n\nSi tienes alguna pregunta, no dudes en escribirnos.\n\nSaludos,\nEquipo GI Store'
  },
  promo: {
    asunto: '¡Nueva campaña promocional disponible para [tienda]!',
    cuerpo: 'Hola [nombre],\n\nTenemos excelentes noticias: nuestra nueva campaña promocional ya está disponible.\n\nBeneficios de temporada:\n- Mayor visibilidad en el catálogo\n- Descuentos en publicidad destacada\n- Soporte prioritario\n\nNo te pierdas esta oportunidad.\n\nEquipo GI Store'
  },
  renovacion: {
    asunto: 'Tu membresía [plan] está próxima a vencer',
    cuerpo: 'Hola [nombre],\n\nTu membresía [plan] para la tienda [tienda] vence pronto.\n\nRenueva hoy y continúa disfrutando de todos los beneficios sin interrupciones.\n\nEquipo GI Store'
  },
  recordatorio: {
    asunto: 'Recordatorio de pago — [tienda]',
    cuerpo: 'Hola [nombre],\n\nTe recordamos que tienes un pago pendiente asociado a tu cuenta [tienda].\n\nPor favor realiza tu pago a la mayor brevedad.\n\nEquipo GI Store'
  }
};

// Cargar plantilla en #asunto y #editorMsg
function cargarPlantilla() {
  const key = document.getElementById('selectPlantilla').value;
  if (!key) return;
  const p = plantillasLocales[key];
  if (!p) return;
  document.getElementById('asunto').value = p.asunto;
  document.getElementById('editorMsg').innerText = p.cuerpo;
}

// Insertar variable en #editorMsg (contenteditable)
function insertarVariable(v) {
  document.getElementById('editorMsg').focus();
  document.execCommand('insertText', false, v);
}

// Formato en #editorMsg
function fmt(cmd) {
  document.getElementById('editorMsg').focus();
  document.execCommand(cmd);
}

// ── Modo masivo / individual ──────────────────────────────
// Toggle #toggleMasivo → muestra #modoIndividual o #modoMasivo
function cambiarModo() {
  const masivo = document.getElementById('toggleMasivo').checked;
  document.getElementById('modoIndividual').style.display = masivo ? 'none' : 'block';
  document.getElementById('modoMasivo').style.display     = masivo ? 'block' : 'none';
  document.getElementById('lblEnviar').textContent        = masivo ? 'Enviar masivo' : 'Enviar mensaje';
}

// Actualizar chip de grupo en #chips
function seleccionarGrupo() {
  const val = document.getElementById('selectGrupo').value;
  const labels = {
    todos: 'Todos los vendedores (312)', activos: 'Vendedores activos (298)',
    inactivos: 'Vendedores inactivos (14)', 'plan-basico': 'Plan básico (120)',
    'plan-pro': 'Plan profesional (98)', 'plan-premium': 'Plan premium (80)'
  };
  document.getElementById('chips').innerHTML = val
    ? `<span style="background:var(--verde-claro);border:1px solid var(--verde-borde);border-radius:20px;padding:.2rem .7rem;font-size:.78rem;color:var(--verde);font-weight:600">${labels[val] || val} ✓</span>`
    : '';
}

// ── Enviar correo → correo_enviados.php?accion=enviar ─────
// POST campos: asunto, cuerpo, es_masivo, para_email, para_nombre,
//              grupo_destino, emails_manual, plantilla_id
async function enviarCorreo() {
  const masivo      = document.getElementById('toggleMasivo').checked;
  const asunto      = document.getElementById('asunto').value.trim();
  const cuerpo      = document.getElementById('editorMsg').innerText.trim();
  const paraEmail   = !masivo ? document.getElementById('para').value.trim() : '';
  const grupo       = masivo ? document.getElementById('selectGrupo').value.trim() : '';
  const emailManual = masivo ? document.getElementById('emailsManual').value.trim() : '';

  // Ocultar mensajes previos
  document.getElementById('msgOk').classList.remove('visible');
  document.getElementById('msgError').classList.remove('visible');

  if (!asunto || !cuerpo || (!paraEmail && !grupo && !emailManual)) {
    document.getElementById('msgErrorTxt').textContent = 'Por favor completa todos los campos obligatorios.';
    document.getElementById('msgError').classList.add('visible');
    return;
  }

  const btn = document.getElementById('btnEnviar');
  btn.disabled = true;
  btn.innerHTML = '<span class="material-symbols-outlined" style="font-size:1rem">hourglass_top</span> Enviando…';

  try {
    const res = await apiPost('correo_enviados.php?accion=enviar', {
      asunto,
      cuerpo,
      es_masivo:     masivo ? 1 : 0,
      para_email:    paraEmail,
      para_nombre:   '',
      grupo_destino: grupo,
      emails_manual: emailManual
    });

    // Mostrar resultado en #msgOkTxt
    const txt = masivo
      ? `Enviados: ${res?.enviados ?? 0} · Fallidos: ${res?.fallidos ?? 0}`
      : `Mensaje enviado a ${paraEmail}.`;
    document.getElementById('msgOkTxt').textContent = txt;
    document.getElementById('msgOk').classList.add('visible');

    limpiarForm();
    await cargarBorradores(); // actualiza la lista de borradores
  } catch (err) {
    document.getElementById('msgErrorTxt').textContent = 'Error al enviar: ' + err.message;
    document.getElementById('msgError').classList.add('visible');
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<span class="material-symbols-outlined" style="font-size:1rem">send</span> <span id="lblEnviar">Enviar mensaje</span>';
  }
}

// ── Borradores → correos_borradores.php ───────────────────
// Render en #listaBorradores
// Campos que devuelve accion=listar: id, asunto, para_email, es_masivo, grupo_destino, fecha
async function cargarBorradores() {
  try {
    const lista = await apiGet('correos_borradores.php?accion=listar');
    renderBorradores(lista);
  } catch (err) { console.error('Error al cargar borradores:', err); }
}

function renderBorradores(lista) {
  const el = document.getElementById('listaBorradores');
  if (!lista.length) {
    el.innerHTML = '<p class="cargando-txt">No hay borradores guardados</p>';
    return;
  }
  el.innerHTML = lista.map(b => `
    <div style="display:flex;align-items:center;gap:.75rem;padding:.7rem 1.2rem;border-bottom:1px solid var(--fondo)">
      <div style="flex:1">
        <p style="font-size:.87rem;font-weight:600;color:var(--texto)">${b.asunto || '(sin asunto)'}</p>
        <p style="font-size:.75rem;color:var(--texto-suave)">${b.fecha}</p>
      </div>
      <button class="btn btn-secundario btn-sm" onclick="cargarBorrador(${b.id})">Editar</button>
      <button class="btn btn-peligro btn-sm" onclick="eliminarBorrador(${b.id})">✕</button>
    </div>
  `).join('');
}

// Guardar borrador → accion=guardar, id=0 (nuevo)
async function guardarBorrador() {
  const asunto    = document.getElementById('asunto').value.trim();
  const cuerpo    = document.getElementById('editorMsg').innerText.trim();
  const paraEmail = document.getElementById('para')?.value.trim() || '';
  const masivo    = document.getElementById('toggleMasivo').checked;
  const grupo     = document.getElementById('selectGrupo')?.value || '';

  if (!asunto) { alert('Escribe al menos un asunto para guardar'); return; }

  try {
    await apiPost('correos_borradores.php?accion=guardar', {
      id: 0, asunto, cuerpo, para_email: paraEmail,
      es_masivo: masivo ? 1 : 0, grupo_destino: grupo
    });
    document.getElementById('msgOkTxt').textContent = 'Borrador guardado correctamente.';
    document.getElementById('msgOk').classList.add('visible');
    setTimeout(() => document.getElementById('msgOk').classList.remove('visible'), 3000);
    await cargarBorradores();
  } catch (err) { console.error('Error al guardar borrador:', err); }
}

// Cargar borrador en el form → accion=ver&id=N
async function cargarBorrador(id) {
  try {
    const b = await apiGet(`correos_borradores.php?accion=ver&id=${id}`);
    document.getElementById('asunto').value = b.asunto || '';
    document.getElementById('editorMsg').innerText = b.cuerpo || '';
    if (b.para_email) {
      const el = document.getElementById('para');
      if (el) el.value = b.para_email;
    }
  } catch (err) { console.error('Error al cargar borrador:', err); }
}

// Eliminar borrador → accion=eliminar
async function eliminarBorrador(id) {
  try {
    await apiPost('correos_borradores.php?accion=eliminar', { id });
    await cargarBorradores();
  } catch (err) { console.error('Error al eliminar borrador:', err); }
}

// ── Limpiar formulario ────────────────────────────────────
function limpiarForm() {
  const para = document.getElementById('para');
  if (para) para.value = '';
  document.getElementById('asunto').value = '';
  document.getElementById('editorMsg').innerText = '';
  document.getElementById('selectPlantilla').value = '';
  const grupo = document.getElementById('selectGrupo');
  if (grupo) grupo.value = '';
  const chips = document.getElementById('chips');
  if (chips) chips.innerHTML = '';
  const emails = document.getElementById('emailsManual');
  if (emails) emails.value = '';
}

// ── Recuperar plantilla desde sessionStorage ──────────────
// (cuando se llega desde plantillas.html o publicidad.html)
(function recuperarPlantillaActiva() {
  const raw = sessionStorage.getItem('plantillaActiva');
  if (!raw) return;
  try {
    const p = JSON.parse(raw);
    if (p.asunto) document.getElementById('asunto').value = p.asunto;
    if (p.cuerpo) document.getElementById('editorMsg').innerText = p.cuerpo;
  } catch { /* ignorar */ }
  sessionStorage.removeItem('plantillaActiva');
})();

// ── Init ──────────────────────────────────────────────────
cargarBorradores();

document.addEventListener('DOMContentLoaded', () => {
  const b = document.getElementById('btnHamburguesa');
  const s = document.querySelector('.sidebar');
  const o = document.getElementById('sidebarOverlay');
  if (b && s && o) {
    b.addEventListener('click', () => { s.classList.toggle('abierto'); o.classList.toggle('visible'); });
    o.addEventListener('click', () => { s.classList.remove('abierto'); o.classList.remove('visible'); });
  }
});