
// ─── Tabs ───
function cambiarTab(id, el) {
  document.querySelectorAll('.wa-tab').forEach(t => t.classList.remove('activo'));
  document.querySelectorAll('.wa-panel').forEach(p => p.classList.remove('activo'));
  el.classList.add('activo');
  document.getElementById('tab-' + id).classList.add('activo');
}

// ─── Plantillas WA ───
const plantillasWA = {
  bienvenida: 'Hola [nombre] 👋\n\n¡Bienvenido a GI Store! Tu tienda [tienda] ya está activa en nuestra plataforma.\n\nCualquier duda estamos aquí para ayudarte 🛍️\n\n— Equipo GI Store',
  promo: '¡Hola [nombre]! 🎉\n\nTenemos una campaña especial disponible para tu tienda [tienda].\n\nEntra a tu panel ahora y aprovecha los beneficios exclusivos de esta temporada 🛒\n\n— GI Store',
  renovacion: 'Hola [nombre] ⏰\n\nTe recordamos que la membresía de tu tienda [tienda] está próxima a vencer.\n\nRenueva ahora y no pierdas ningún beneficio 👇\n\n— GI Store',
  recordatorio: 'Hola [nombre] ⚠️\n\nTienes un pago pendiente en tu cuenta de GI Store.\n\nPor favor regularízalo para evitar la suspensión de [tienda].\n\n— GI Store'
};

function cargarPlantillaWA() {
  const key = document.getElementById('plantillaWA').value;
  const ta = document.getElementById('msgWAmasivo');
  ta.value = key ? plantillasWA[key] : '';
  previsualizarMasivo();
  contarCaracteres(ta, 'ctMasivo');
}

function previsualizarMasivo() {
  const txt = document.getElementById('msgWAmasivo').value || '';
  const preview = document.getElementById('previewMasivo');
  preview.innerHTML = txt ? txt.replace(/\[nombre\]/g,'<strong>Carlos</strong>').replace(/\[tienda\]/g,'<strong>Tienda Demo</strong>').replace(/\n/g,'<br/>') : '<em style="color:var(--texto-suave)">El mensaje aparecerá aquí…</em>';
  document.getElementById('horaPreview').textContent = txt ? new Date().toLocaleTimeString('es-CO', {hour:'2-digit',minute:'2-digit'}) : '';
}

function actualizarContador() {
  const sel = document.getElementById('grupoWA');
  const opt = sel.options[sel.selectedIndex];
  const n = opt ? opt.dataset.n : '';
  document.getElementById('contadorWA').textContent = n ? `✓ Se enviará a ${n} vendedores` : '';
}

function contarCaracteres(ta, idCt) {
  document.getElementById(idCt).textContent = `${ta.value.length} / 1024`;
}

// ─── Enviar masivo ───
function enviarMasivo() {
  const grupo = document.getElementById('grupoWA').value;
  const msg = document.getElementById('msgWAmasivo').value.trim();
  document.getElementById('msgOkMasivo').classList.remove('visible');
  document.getElementById('msgErrMasivo').classList.remove('visible');
  if (!grupo || !msg) {
    document.getElementById('msgErrMasivoTxt').textContent = 'Selecciona un grupo y escribe el mensaje.';
    document.getElementById('msgErrMasivo').classList.add('visible');
    return;
  }
  const btn = document.getElementById('btnMasivo');
  const lbl = document.getElementById('lblMasivo');
  btn.disabled = true; lbl.textContent = 'Enviando…';
  setTimeout(() => {
    btn.disabled = false; lbl.textContent = 'Enviar campaña';
    const sel = document.getElementById('grupoWA');
    const n = sel.options[sel.selectedIndex].dataset.n;
    document.getElementById('msgOkMasivoTxt').textContent = `Campaña enviada a ${n} vendedores correctamente.`;
    document.getElementById('msgOkMasivo').classList.add('visible');
    // Agregar al historial
    agregarHistorial({ tipo:'masivo', grupo: sel.options[sel.selectedIndex].text, msg, n });
    document.getElementById('msgWAmasivo').value = '';
    document.getElementById('grupoWA').value = '';
    document.getElementById('contadorWA').textContent = '';
    previsualizarMasivo();
  }, 2000);
}

// ─── Enviar individual ───
function enviarIndividual() {
  const sel = document.getElementById('vendedorWA').value;
  const tel = document.getElementById('telefonoWA').value.trim();
  const destino = sel || tel;
  const msg = document.getElementById('msgWAind').value.trim();
  document.getElementById('msgOkInd').classList.remove('visible');
  document.getElementById('msgErrInd').classList.remove('visible');
  if (!destino || !msg) {
    document.getElementById('msgErrIndTxt').textContent = 'Selecciona o escribe un número y el mensaje.';
    document.getElementById('msgErrInd').classList.add('visible');
    return;
  }
  document.getElementById('msgOkIndTxt').textContent = `Mensaje enviado a ${destino}.`;
  document.getElementById('msgOkInd').classList.add('visible');
  agregarHistorial({ tipo:'individual', grupo: destino, msg, n:'1' });
  document.getElementById('msgWAind').value = '';
  document.getElementById('vendedorWA').value = '';
  document.getElementById('telefonoWA').value = '';
}

// ─── Historial ───
let historial = [
  { tipo:'masivo', grupo:'Vendedores activos (298)', n:'298', msg:'¡Hola! Tenemos una campaña especial…', fecha:'Hoy 09:00' },
  { tipo:'individual', grupo:'+573001234567', n:'1', msg:'Hola Carlos, ¿cómo va todo?', fecha:'Ayer 15:30' },
  { tipo:'masivo', grupo:'Plan premium (80)', n:'80', msg:'Recordatorio de renovación…', fecha:'Lun 11:00' },
];

function agregarHistorial(item) {
  item.fecha = new Date().toLocaleTimeString('es-CO', {hour:'2-digit',minute:'2-digit'}) + ' — hoy';
  historial.unshift(item);
  renderHistorial();
}

function renderHistorial() {
  const el = document.getElementById('historialLista');
  el.innerHTML = historial.map(h => `
    <div class="log-item">
      <div class="log-icon">${h.tipo==='masivo'?'📡':'💬'}</div>
      <div style="flex:1">
        <p style="font-size:.87rem;font-weight:600;color:var(--texto)">${h.grupo}</p>
        <p style="font-size:.8rem;color:var(--texto-suave);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:400px">${h.msg.substring(0,80)}${h.msg.length>80?'…':''}</p>
      </div>
      <div style="text-align:right;flex-shrink:0">
        <span class="badge ${h.tipo==='masivo'?'tag-masivo':'tag-individual'}" style="padding:.15rem .55rem;border-radius:6px;font-size:.72rem;font-weight:600;${h.tipo==='masivo'?'background:#e0e7ff;color:#3730a3':'background:var(--verde-claro);color:var(--verde)'}">${h.tipo}</span>
        <p style="font-size:.75rem;color:var(--texto-suave);margin-top:.2rem">${h.fecha} · ${h.n} msg</p>
      </div>
    </div>
  `).join('');
}

// Init
renderHistorial();
document.getElementById('horaPreview').textContent = '';

// Hamburguesa
document.addEventListener('DOMContentLoaded', () => {
  const btnH = document.getElementById('btnHamburguesa');
  const sidebar = document.querySelector('.sidebar');
  const overlay = document.getElementById('sidebarOverlay');
  btnH.addEventListener('click', () => { sidebar.classList.toggle('abierto'); overlay.classList.toggle('visible'); });
  overlay.addEventListener('click', () => { sidebar.classList.remove('abierto'); overlay.classList.remove('visible'); });
});
