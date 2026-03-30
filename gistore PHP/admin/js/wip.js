// ============================================================
//  admin/js/wip.js — Gestión de configuración WP (tabla wpis)
// ============================================================

// ── Token CSRF ────────────────────────────────────────────
let _tokenWip = null;

async function getTokenWip() {
  if (_tokenWip) return _tokenWip;
  try {
    const resp = await fetch('/../../backend/tokens.php?accion=obtener', { credentials: 'include' });
    const data = await resp.json();
    _tokenWip = data.token || '';
  } catch { _tokenWip = ''; }
  return _tokenWip;
}

async function wipGet(endpoint) {
  const token = await getTokenWip();
  const resp  = await fetch(`../backend/${endpoint}&token=${token}`, { credentials: 'include' });
  const data  = await resp.json();
  if (!data.ok) throw new Error(data.error || 'Error');
  return data.datos;
}

async function wipPost(endpoint, params = {}) {
  const token = await getTokenWip();
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
function wipEl(id) { return document.getElementById(id); }

function wipBtnCargando(btn, cargando) {
  btn.disabled = cargando;
  btn.classList.toggle('cargando', cargando);
}

function wipMostrarOk(m) {
  const el = wipEl('msgOk');
  const tx = wipEl('textoOk');
  if (!el || !tx) return;
  tx.textContent = m;
  el.classList.add('visible');
  wipEl('msgError')?.classList.remove('visible');
  setTimeout(() => el.classList.remove('visible'), 4000);
}

function wipMostrarError(m) {
  const el = wipEl('msgError');
  const tx = wipEl('textoError');
  if (!el || !tx) return;
  tx.textContent = m;
  el.classList.add('visible');
}

// ── Inyectar sección WIP en la página ─────────────────────
function inyectarSeccionWip() {
  // Busca el contenedor principal; si ya existe el panel, no lo duplica
  if (wipEl('wipPanel')) return;

  const main = document.querySelector('main.main');
  if (!main) return;

  const section = document.createElement('div');
  section.innerHTML = `
    <!-- ══ Panel WIP / Webhooks WordPress ══ -->
    <div class="panel" id="wipPanel" style="margin-top:1.5rem">
      <div class="panel-header">
        <h2>⚙️ Configuración Wompi</h2>
      </div>
      <div style="padding:1.25rem 1.5rem">

        <!-- Mensajes locales del panel WIP -->
        <div class="msg-error" id="wipMsgError" style="display:none">
          <span>⚠&nbsp;</span><span id="wipTextoError"></span>
        </div>
        <div class="msg-ok" id="wipMsgOk" style="display:none">
          <span>✓&nbsp;</span><span id="wipTextoOk"></span>
        </div>

        <!-- Tabla responsive de visualización -->
        <div id="wipTablaWrap">
          <p class="cargando-txt">Cargando…</p>
        </div>

        <!-- Formulario edición / creación -->
        <form id="wipForm" style="margin-top:1.5rem;display:none" autocomplete="off">
          <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:1rem;margin-bottom:1rem">

            <div class="campo">
              <label>Public <span style="font-size:.72rem;color:var(--texto-suave);font-weight:400">(clave pública)</span></label>
              <input type="text" id="wipPublic" placeholder="pk_live_…" autocomplete="off"/>
            </div>

            <div class="campo">
              <label>Privada <span style="font-size:.72rem;color:var(--texto-suave);font-weight:400">(clave privada)</span></label>
              <div style="position:relative">
                <input type="password" id="wipPrivada" placeholder="sk_live_…" autocomplete="new-password" style="padding-right:2.5rem"/>
                <button type="button" id="wipBtnVerPrivada"
                  style="position:absolute;right:.6rem;top:50%;transform:translateY(-50%);background:none;border:none;cursor:pointer;font-size:.95rem;color:var(--texto-suave)">👁</button>
              </div>
            </div>

            <div class="campo">
              <label>Eventos <span style="font-size:.72rem;color:var(--texto-suave);font-weight:400">(webhook eventos)</span></label>
              <input type="text" id="wipEventos" placeholder="whsec_…" autocomplete="off"/>
            </div>

            <div class="campo">
              <label>Integridad <span style="font-size:.72rem;color:var(--texto-suave);font-weight:400">(hash / secret)</span></label>
              <div style="position:relative">
                <input type="password" id="wipIntegridad" placeholder="wh_sec_…" autocomplete="new-password" style="padding-right:2.5rem"/>
                <button type="button" id="wipBtnVerIntegridad"
                  style="position:absolute;right:.6rem;top:50%;transform:translateY(-50%);background:none;border:none;cursor:pointer;font-size:.95rem;color:var(--texto-suave)">👁</button>
              </div>
            </div>

          </div>

          <div style="display:flex;gap:.75rem;flex-wrap:wrap;align-items:center">
            <button type="button" class="btn btn-secundario" id="wipBtnCancelar">Cancelar</button>
            <button type="button" class="btn btn-primary"   id="wipBtnGuardar">
              <span class="btn-texto">Guardar</span>
              <div class="spinner"></div>
            </button>
          </div>
        </form>

      </div>
    </div>
  `;

  main.appendChild(section);
  _bindWipEvents();
}

// ── Renderizar tabla ──────────────────────────────────────
function wipRenderTabla(datos) {
  const wrap = wipEl('wipTablaWrap');
  if (!wrap) return;

  if (!datos) {
    wrap.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:.75rem;margin-bottom:1rem">
        <p class="vacio-txt" style="margin:0">Sin configuración registrada.</p>
        <button class="btn btn-primary" id="wipBtnNuevo">
          <span class="material-symbols-outlined" style="font-size:1rem">add</span> Agregar configuración
        </button>
      </div>`;
    wipEl('wipBtnNuevo')?.addEventListener('click', () => wipAbrirForm(null));
    return;
  }

  // Máscara para campos sensibles
  const mask = v => v ? '••••••••••••' : '—';

  wrap.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:.75rem;margin-bottom:1rem">
      <span style="font-size:.82rem;color:var(--texto-suave)">Registro ID: <code>${datos.id}</code></span>
      <button class="btn btn-primary" id="wipBtnEditar" style="font-size:.82rem;padding:.35rem .9rem">
        ✏️ Editar
      </button>
    </div>

    <div class="tabla-responsive">
      <table>
        <thead>
          <tr>
            <th>Campo</th>
            <th>Valor</th>
            <th>Revelar</th>
          </tr>
        </thead>
        <tbody>
          ${[
            { campo: 'public',     label: 'Public',      valor: datos.public,     id: 'wip-pub',   sensible: false },
            { campo: 'privada',    label: 'Privada',     valor: datos.privada,    id: 'wip-priv',  sensible: true  },
            { campo: 'eventos',    label: 'Eventos',     valor: datos.eventos,    id: 'wip-ev',    sensible: false },
            { campo: 'integridad', label: 'Integridad',  valor: datos.integridad, id: 'wip-int',   sensible: true  },
          ].map(f => `
            <tr>
              <td style="font-weight:600;font-size:.85rem;white-space:nowrap">${f.label}</td>
              <td>
                <span class="clave-texto" id="${f.id}" style="font-family:monospace;font-size:.8rem;color:var(--texto-suave,#6b7280)"
                  data-val="${encodeURIComponent(f.valor || '')}"
                  data-shown="false">
                  ${f.sensible ? mask(f.valor) : (f.valor || '—')}
                </span>
              </td>
              <td>
                ${f.sensible
                  ? `<button class="btn-eye" onclick="wipToggleValor('${f.id}')" title="Revelar">👁</button>`
                  : '<span style="color:var(--texto-suave);font-size:.75rem">—</span>'
                }
              </td>
            </tr>`
          ).join('')}
        </tbody>
      </table>
    </div>`;

  wipEl('wipBtnEditar')?.addEventListener('click', () => wipAbrirForm(datos));
}

// ── Toggle revelar valor sensible ─────────────────────────
window.wipToggleValor = (id) => {
  const span = wipEl(id);
  if (!span) return;
  const shown = span.dataset.shown === 'true';
  if (shown) {
    span.textContent  = '••••••••••••';
    span.dataset.shown = 'false';
  } else {
    span.textContent  = decodeURIComponent(span.dataset.val || '');
    span.dataset.shown = 'true';
  }
};

// ── Abrir formulario ──────────────────────────────────────
function wipAbrirForm(datos) {
  const form = wipEl('wipForm');
  if (!form) return;

  wipEl('wipPublic').value     = datos?.public      || '';
  wipEl('wipPrivada').value    = datos?.privada      || '';
  wipEl('wipEventos').value    = datos?.eventos      || '';
  wipEl('wipIntegridad').value = datos?.integridad   || '';

  // Resetear visibilidad de contraseñas
  wipEl('wipPrivada').type    = 'password'; wipEl('wipBtnVerPrivada').textContent    = '👁';
  wipEl('wipIntegridad').type = 'password'; wipEl('wipBtnVerIntegridad').textContent = '👁';

  // Limpiar mensajes locales
  _wipLimpiarMsgs();
  form.style.display = 'block';
  wipEl('wipPublic').focus();
}

function wipCerrarForm() {
  const form = wipEl('wipForm');
  if (form) form.style.display = 'none';
  _wipLimpiarMsgs();
}

function _wipLimpiarMsgs() {
  const e = wipEl('wipMsgError'); if (e) e.style.display = 'none';
  const o = wipEl('wipMsgOk');   if (o) o.style.display = 'none';
}
function _wipSetErr(m) {
  const e = wipEl('wipMsgError'); const t = wipEl('wipTextoError');
  if (e && t) { t.textContent = m; e.style.display = ''; }
}
function _wipSetOk(m) {
  const o = wipEl('wipMsgOk'); const t = wipEl('wipTextoOk');
  if (o && t) { t.textContent = m; o.style.display = ''; }
  setTimeout(() => { if (o) o.style.display = 'none'; }, 4000);
}

// ── Cargar datos y renderizar ─────────────────────────────
async function wipCargar() {
  const wrap = wipEl('wipTablaWrap');
  if (wrap) wrap.innerHTML = '<p class="cargando-txt">Cargando…</p>';
  try {
    const datos = await wipGet('wip.php?accion=obtener');
    wipRenderTabla(datos);
  } catch (e) {
    console.error('[wip]', e);
    if (wrap) wrap.innerHTML = '<p class="vacio-txt">Error al cargar configuración WP.</p>';
  }
}

// ── Guardar ───────────────────────────────────────────────
async function wipGuardar() {
  const pub  = wipEl('wipPublic').value.trim();
  const priv = wipEl('wipPrivada').value.trim();
  const ev   = wipEl('wipEventos').value.trim();
  const int  = wipEl('wipIntegridad').value.trim();

  if (!pub)  { _wipSetErr('El campo "Public" es obligatorio.');     return; }
  if (!priv) { _wipSetErr('El campo "Privada" es obligatorio.');    return; }
  if (!ev)   { _wipSetErr('El campo "Eventos" es obligatorio.');    return; }
  if (!int)  { _wipSetErr('El campo "Integridad" es obligatoria.'); return; }

  const btn = wipEl('wipBtnGuardar');
  wipBtnCargando(btn, true);
  _wipLimpiarMsgs();

  try {
    const res = await wipPost('wip.php?accion=guardar', {
      public: pub, privada: priv, eventos: ev, integridad: int,
    });
    wipCerrarForm();
    _wipSetOk(res.accion === 'creado' ? '✓ Configuración creada.' : '✓ Configuración actualizada.');
    await wipCargar();
  } catch (e) {
    console.error('[wip]', e);
    _wipSetErr('Error al guardar: ' + (e.message || 'intenta de nuevo.'));
  } finally {
    wipBtnCargando(btn, false);
  }
}

// ── Bind de eventos (se llama después de inyectar el HTML) ─
function _bindWipEvents() {
  // Toggle ver/ocultar contraseñas en el form
  wipEl('wipBtnVerPrivada')?.addEventListener('click', () => {
    const inp = wipEl('wipPrivada');
    const btn = wipEl('wipBtnVerPrivada');
    inp.type = inp.type === 'password' ? 'text' : 'password';
    btn.textContent = inp.type === 'password' ? '👁' : '🙈';
  });
  wipEl('wipBtnVerIntegridad')?.addEventListener('click', () => {
    const inp = wipEl('wipIntegridad');
    const btn = wipEl('wipBtnVerIntegridad');
    inp.type = inp.type === 'password' ? 'text' : 'password';
    btn.textContent = inp.type === 'password' ? '👁' : '🙈';
  });

  wipEl('wipBtnCancelar')?.addEventListener('click', wipCerrarForm);
  wipEl('wipBtnGuardar')?.addEventListener('click', wipGuardar);
}

// ── Arranque ──────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  inyectarSeccionWip();
  wipCargar();
});