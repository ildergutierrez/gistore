const DEFAULT = {
  asunto: '¡Bienvenido a GI Store, [nombre]! 🎉',
  encabezado: '¡Bienvenido a la familia GI Store!',
  subtitulo: 'Tu tienda ya está activa en nuestra plataforma',
  cuerpo: `Hola [nombre],

Nos alegra tenerte como parte de la familia GI Store. Tu tienda [tienda] ya está activa y lista para recibir clientes.

Aquí tienes un resumen de tu cuenta:
• Plan activo: [plan]
• Correo registrado: [email]
• Fecha de ingreso: [fecha]

Para empezar, te recomendamos:
1. Completar el perfil de tu tienda
2. Agregar tus productos al catálogo
3. Configurar tus métodos de pago

Si tienes alguna duda, escríbenos a soporte@gistore.com o responde este correo.

¡Mucho éxito!
Equipo GI Store`,
  btnCta: 'Ir a mi panel de vendedor',
  colorHeader: '#1a6b3c'
};

function actualizar() {
  const asunto   = document.getElementById('asunto').value;
  const encab    = document.getElementById('encabezado').value;
  const sub      = document.getElementById('subtitulo').value;
  const cuerpo   = document.getElementById('cuerpo').value;
  const btnTxt   = document.getElementById('btnCta').value;
  const color    = document.getElementById('colorHeader').value;

  document.getElementById('prevAsunto').textContent     = asunto.replace(/\[nombre\]/g,'Carlos').replace(/\[tienda\]/g,'Tienda Demo').replace(/\[plan\]/g,'Pro').replace(/\[email\]/g,'demo@gistore.com').replace(/\[fecha\]/g,new Date().toLocaleDateString('es-CO'));
  document.getElementById('prevEncabezado').textContent = encab;
  document.getElementById('prevSubtitulo').textContent  = sub;
  document.getElementById('prevHeader').style.background = color;
  document.getElementById('prevBtn').style.background   = color;
  document.getElementById('prevBtn').textContent        = btnTxt;
  document.getElementById('prevCuerpo').innerHTML = cuerpo
    .replace(/\[nombre\]/g,'<strong>Carlos</strong>')
    .replace(/\[tienda\]/g,'<strong>Tienda Demo</strong>')
    .replace(/\[plan\]/g,'<strong>Pro</strong>')
    .replace(/\[email\]/g,'demo@gistore.com')
    .replace(/\[fecha\]/g,new Date().toLocaleDateString('es-CO'))
    .replace(/\n/g,'<br/>');
}

function insertarVar(v) {
  const ta = document.getElementById('cuerpo');
  const s = ta.selectionStart;
  ta.value = ta.value.substring(0,s) + v + ta.value.substring(ta.selectionEnd);
  ta.selectionStart = ta.selectionEnd = s + v.length;
  ta.focus(); actualizar();
}

function guardar() {
  const btn = document.getElementById('btnGuardar');
  btn.disabled = true; btn.innerHTML = '<span class="material-symbols-outlined" style="font-size:1rem">hourglass_top</span>Guardando…';
  setTimeout(() => {
    btn.disabled = false; btn.innerHTML = '<span class="material-symbols-outlined" style="font-size:1rem">save</span>Guardar cambios';
    document.getElementById('msgOk').classList.add('visible');
    setTimeout(() => document.getElementById('msgOk').classList.remove('visible'), 4000);
  }, 900);
}

function resetear() {
  if (!confirm('¿Restablecer la plantilla por defecto? Se perderán los cambios no guardados.')) return;
  Object.keys(DEFAULT).forEach(k => { const el = document.getElementById(k); if (el) el.value = DEFAULT[k]; });
  actualizar();
}

function enviarPrueba() {
  const email = document.getElementById('correoTest').value.trim();
  if (!email) { alert('Ingresa un correo de prueba'); return; }
  const m = document.getElementById('msgPrueba');
  m.style.display = 'block';
  m.textContent = `✓ Correo de prueba enviado a ${email}.`;
  setTimeout(() => { m.style.display = 'none'; }, 4000);
}

document.getElementById('autoEnvio').addEventListener('change', function() {
  document.getElementById('lblAuto').textContent = this.checked ? 'Activo' : 'Inactivo';
});

document.getElementById('cuerpo').addEventListener('input', actualizar);

// Init
actualizar();

document.addEventListener('DOMContentLoaded', () => {
  const b = document.getElementById('btnHamburguesa'), s = document.querySelector('.sidebar'), o = document.getElementById('sidebarOverlay');
  b.addEventListener('click', () => { s.classList.toggle('abierto'); o.classList.toggle('visible'); });
  o.addEventListener('click', () => { s.classList.remove('abierto'); o.classList.remove('visible'); });
});
