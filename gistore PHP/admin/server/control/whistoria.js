const historial = [
  { id:1, tipo:'masivo', dest:'Vendedores activos (298)', n:298, ok:294, fail:4, fecha:'Hoy 09:00', status:'parcial', msg:'¡Hola [nombre]! 🎉\n\nTenemos una campaña especial para tu tienda [tienda].\n\nEntra al panel y activa tus beneficios 🛒\n\n— GI Store' },
  { id:2, tipo:'individual', dest:'+573001234567 · Carlos Mendoza', n:1, ok:1, fail:0, fecha:'Ayer 15:30', status:'ok', msg:'Hola Carlos 👋\n\nTu tienda Tienda Rápida ya está activa en GI Store. ¡Bienvenido!\n\n— Equipo GI Store' },
  { id:3, tipo:'masivo', dest:'Plan premium (80)', n:80, ok:80, fail:0, fecha:'Ayer 11:00', status:'ok', msg:'Hola [nombre] ⏰\n\nTu membresía premium vence en 7 días. Renueva ahora para no perder ningún beneficio.\n\n— GI Store' },
  { id:4, tipo:'individual', dest:'+573109876543 · Mariana Valencia', n:1, ok:1, fail:0, fecha:'Lun 16:45', status:'ok', msg:'Hola Mariana,\n\nTe confirmamos que tu membresía fue renovada exitosamente por 30 días más.\n\n— Equipo GI Store' },
  { id:5, tipo:'masivo', dest:'Vendedores inactivos (14)', n:14, ok:9, fail:5, fecha:'Lun 10:00', status:'parcial', msg:'Hola [nombre] 👋\n\nHace tiempo no vemos actividad en tu tienda [tienda]. ¿Podemos ayudarte?\n\n— GI Store' },
  { id:6, tipo:'individual', dest:'+573204567890 · Pedro Castillo', n:1, ok:0, fail:1, fecha:'Dom 14:20', status:'fail', msg:'Hola Pedro, se ha restablecido el acceso a tu panel. Por favor cambia tu contraseña al ingresar.\n\n— GI Store' },
  { id:7, tipo:'masivo', dest:'Plan básico (120)', n:120, ok:120, fail:0, fecha:'Vie 09:30', status:'ok', msg:'¡Hola [nombre]! 📢\n\nUna nueva categoría de productos está disponible en GI Store. ¡Aprovéchala para tu tienda [tienda]!\n\n— GI Store' },
  { id:8, tipo:'individual', dest:'+573158765432 · Tienda Rápida SAS', n:1, ok:1, fail:0, fecha:'Jue 11:15', status:'ok', msg:'Hola, te informamos que la carga masiva de tus 45 productos fue procesada correctamente.\n\n— GI Store' },
];

const statusInfo = {
  ok:      { label:'Entregado', cls:'badge-activo', dot:'status-ok' },
  parcial: { label:'Parcial',   cls:'badge-promo',  dot:'status-parcial' },
  fail:    { label:'Fallido',   cls:'badge-spam',   dot:'status-fail' },
};

function render(lista) {
  const el = document.getElementById('listaLog');
  if (!lista.length) { el.innerHTML = '<p class="cargando-txt">No hay registros que mostrar</p>'; return; }
  el.innerHTML = lista.map(h => `
    <div class="log-item" onclick="verDetalle(${h.id})">
      <div class="log-icon ${h.tipo}">
        ${h.tipo === 'masivo' ? '📡' : '💬'}
      </div>
      <div style="flex:1;min-width:0">
        <p style="font-size:.87rem;font-weight:600;color:var(--texto)">${h.dest}</p>
        <p class="log-msg">${h.msg.replace(/\n/g,' ').substring(0,90)}…</p>
      </div>
      <div class="log-right">
        <span class="badge ${statusInfo[h.status].cls}" style="display:inline-flex;align-items:center;gap:.3rem">
          <span class="status-dot ${statusInfo[h.status].dot}"></span>
          ${statusInfo[h.status].label}
        </span>
        <p style="font-size:.75rem;color:var(--texto-suave);margin-top:.3rem">${h.fecha} · ${h.n} msg</p>
        ${h.fail > 0 ? `<p style="font-size:.72rem;color:var(--error)">⚠ ${h.fail} fallido${h.fail>1?'s':''}</p>` : ''}
      </div>
    </div>`).join('');
}

function filtrar() {
  const q = document.getElementById('buscar').value.toLowerCase();
  const tipo = document.getElementById('filtroTipo').value;
  const st   = document.getElementById('filtroStatus').value;
  render(historial.filter(h =>
    (!q || h.dest.toLowerCase().includes(q) || h.msg.toLowerCase().includes(q)) &&
    (!tipo || h.tipo === tipo) &&
    (!st || h.status === st)
  ));
}

function verDetalle(id) {
  const h = historial.find(x => x.id === id);
  document.getElementById('modalGrid').innerHTML = `
    <div><p style="font-size:.75rem;color:var(--texto-suave);font-weight:600;text-transform:uppercase;letter-spacing:.04em">Destinatario</p><p style="font-size:.9rem;color:var(--texto)">${h.dest}</p></div>
    <div><p style="font-size:.75rem;color:var(--texto-suave);font-weight:600;text-transform:uppercase;letter-spacing:.04em">Tipo</p><p style="font-size:.9rem;color:var(--texto)">${h.tipo}</p></div>
    <div><p style="font-size:.75rem;color:var(--texto-suave);font-weight:600;text-transform:uppercase;letter-spacing:.04em">Fecha</p><p style="font-size:.9rem;color:var(--texto)">${h.fecha}</p></div>
    <div><p style="font-size:.75rem;color:var(--texto-suave);font-weight:600;text-transform:uppercase;letter-spacing:.04em">Estado</p>
      <span class="badge ${statusInfo[h.status].cls}">${statusInfo[h.status].label} — ${h.ok}/${h.n} entregados</span>
    </div>`;
  document.getElementById('modalMsg').textContent = h.msg;
  document.getElementById('modal').style.display = 'block';
}
function cerrar() { document.getElementById('modal').style.display = 'none'; }

render(historial);
document.addEventListener('keydown', e => { if (e.key === 'Escape') cerrar(); });
document.addEventListener('DOMContentLoaded', () => {
  const b = document.getElementById('btnHamburguesa'), s = document.querySelector('.sidebar'), o = document.getElementById('sidebarOverlay');
  b.addEventListener('click', () => { s.classList.toggle('abierto'); o.classList.toggle('visible'); });
  o.addEventListener('click', () => { s.classList.remove('abierto'); o.classList.remove('visible'); });
});
