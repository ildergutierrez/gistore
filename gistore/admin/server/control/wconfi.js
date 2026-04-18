
function toggleVer(inputId, btn) {
  const inp = document.getElementById(inputId);
  inp.type = inp.type === 'password' ? 'text' : 'password';
  btn.textContent = inp.type === 'password' ? 'Ver' : 'Ocultar';
}

function copiar(inputId, btn) {
  const val = document.getElementById(inputId).value;
  if (!val) return;
  navigator.clipboard.writeText(val).then(() => {
    btn.textContent = '✓';
    setTimeout(() => btn.textContent = 'Copiar', 1500);
  });
}

function guardarConfig() {
  const token  = document.getElementById('token').value.trim();
  const phone  = document.getElementById('phoneId').value.trim();
  const waba   = document.getElementById('wabaId').value.trim();
  document.getElementById('msgErr').classList.remove('visible');
  if (!token || !phone || !waba) {
    document.getElementById('errTxt').textContent = 'Token, Phone ID y WABA ID son obligatorios.';
    document.getElementById('msgErr').classList.add('visible');
    return;
  }
  const btn = document.getElementById('btnGuardar');
  btn.disabled = true; btn.innerHTML = '<span class="material-symbols-outlined" style="font-size:1rem">hourglass_top</span>Guardando…';
  setTimeout(() => {
    btn.disabled = false; btn.innerHTML = '<span class="material-symbols-outlined" style="font-size:1rem">save</span>Guardar';
    document.getElementById('msgOk').classList.add('visible');
    setTimeout(() => document.getElementById('msgOk').classList.remove('visible'), 4000);
  }, 800);
}

function probarApi() {
  const token = document.getElementById('token').value.trim();
  const btn = document.getElementById('btnProbar');
  const bar = document.getElementById('statusBar');
  if (!token) { bar.className = 'status-bar status-err'; bar.innerHTML = '<span class="material-symbols-outlined" style="font-size:1rem">error</span>Ingresa el token antes de probar'; return; }
  btn.disabled = true; btn.innerHTML = '<span class="material-symbols-outlined" style="font-size:1rem">hourglass_top</span>Probando…';
  bar.className = 'status-bar status-off'; bar.innerHTML = '<span class="material-symbols-outlined" style="font-size:1rem">hourglass_top</span>Verificando conexión con Meta Cloud API…';
  setTimeout(() => {
    btn.disabled = false; btn.innerHTML = '<span class="material-symbols-outlined" style="font-size:1rem">bolt</span>Probar API';
    bar.className = 'status-bar status-ok';
    bar.innerHTML = '<span class="material-symbols-outlined" style="font-size:1rem">check_circle</span>API conectada correctamente · Meta Cloud API responde con status 200';
  }, 2000);
}

function enviarPrueba() {
  const tel = document.getElementById('testTel').value.trim();
  const msg = document.getElementById('testMsg').value.trim();
  const res = document.getElementById('testResult');
  if (!tel || !msg) { res.style.display='block'; res.style.background='var(--error-bg)'; res.style.border='1.5px solid var(--error-borde)'; res.style.color='var(--error)'; res.textContent='Ingresa un número y mensaje de prueba.'; return; }
  res.style.display = 'block'; res.style.background='var(--adv-bg)'; res.style.border='1.5px solid var(--adv-borde)'; res.style.color='#7c4c0a'; res.textContent = 'Enviando…';
  setTimeout(() => {
    res.style.background='var(--ok-bg)'; res.style.border='1.5px solid var(--ok-borde)'; res.style.color='var(--ok)';
    res.textContent = `✓ Mensaje de prueba enviado a ${tel}. Verifica tu WhatsApp.`;
  }, 1800);
}

// Actualizar label de versión en endpoint
document.getElementById('apiVersion').addEventListener('change', function() {
  document.getElementById('versionLabel').textContent = this.value;
});

document.addEventListener('DOMContentLoaded', () => {
  const b = document.getElementById('btnHamburguesa'), s = document.querySelector('.sidebar'), o = document.getElementById('sidebarOverlay');
  b.addEventListener('click', () => { s.classList.toggle('abierto'); o.classList.toggle('visible'); });
  o.addEventListener('click', () => { s.classList.remove('abierto'); o.classList.remove('visible'); });
});
