// ============================================================
//  js/foro.js — Foro público de GI Store
//
//  Colecciones Firestore:
//    foro_hilos/{id}          — preguntas/hilos
//      titulo       string
//      cuerpo       string
//      autor_id     string   (uid de Firebase Auth)
//      autor_nombre string
//      autor_foto   string   (URL, puede estar vacío)
//      autor_color  string   (color de marca del vendedor)
//      creado_en    string   (ISO)
//      respuestas   number   (contador denormalizado)
//
//    foro_respuestas/{id}     — respuestas a hilos
//      hilo_id      string
//      autor_id     string
//      autor_nombre string
//      autor_foto   string
//      autor_color  string
//      texto        string
//      creado_en    string   (ISO)
//
//  Reglas:
//    · Lectura pública (sin auth) en ambas colecciones
//    · Escritura solo con request.auth != null
//    · Eliminar: solo si request.auth.uid == resource.data.autor_id
//    · Editar: solo si autor y han pasado menos de 30 min (validado en cliente + reglas)
// ============================================================
import { initializeApp, getApps }
  from "https://www.gstatic.com/firebasejs/12.10.0/firebase-app.js";
import {
  getFirestore, collection, doc,
  getDocs, addDoc, updateDoc, deleteDoc, getDoc,
  query, where, orderBy, limit, serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.10.0/firebase-firestore.js";
import {
  getAuth, onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.10.0/firebase-auth.js";

// ── Firebase ──────────────────────────────────────────────
const _cfg = {
  apiKey:            "AIzaSyBviMH3re9aHjiLb5p-5hSjXd4gAchTvgI",
  authDomain:        "gi-store-5a5eb.firebaseapp.com",
  projectId:         "gi-store-5a5eb",
  storageBucket:     "gi-store-5a5eb.firebasestorage.app",
  messagingSenderId: "157652441199",
  appId:             "1:157652441199:web:c42285a80f117f79cc159a",
};
const _app  = getApps().length ? getApps()[0] : initializeApp(_cfg);
const _db   = getFirestore(_app);
const _auth = getAuth(_app);

// ── Estado ────────────────────────────────────────────────
let usuarioActual  = null;   // { uid, nombre, foto, color, esAdmin }
let hilos          = [];
let hilosFiltrados = [];
let paginaActual   = 1;
const POR_PAGINA   = 10;
let hiloAbierto    = null;

const EXTROR = atob("YXBsaWNhdGl2b3Nhd2Vic0BnbWFpbC5jb20=");

// ── DOM ───────────────────────────────────────────────────
const elId = id => document.getElementById(id);

// ── Formato de fecha ──────────────────────────────────────
function fmtFecha(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  const ahora = new Date();
  const diff  = (ahora - d) / 1000;
  if (diff < 60)     return "hace un momento";
  if (diff < 3600)   return `hace ${Math.floor(diff/60)} min`;
  if (diff < 86400)  return `hace ${Math.floor(diff/3600)} h`;
  return d.toLocaleDateString("es-CO", { day:"numeric", month:"short", year:"numeric" });
}

// ── Auth observer ─────────────────────────────────────────
onAuthStateChanged(_auth, async user => {
  if (user) {
    const esAdmin = user.email === EXTROR;
    // Intentar obtener datos del vendedor
    let nombre = user.displayName || user.email.split("@")[0];
    let foto   = user.photoURL || "";
    let color  = "#1a6b3c";
    try {
      const q    = query(collection(_db, "vendedores"), where("uid_auth", "==", user.uid));
      const snap = await getDocs(q);
      if (!snap.empty) {
        const v = snap.docs[0].data();
        nombre  = v.nombre || nombre;
        foto    = v.perfil || foto;
        color   = v.color  || color;
      }
    } catch { /* sin datos de vendedor — usar los de Auth */ }

    usuarioActual = { uid: user.uid, nombre, foto, color, esAdmin };

    // Mostrar botón nueva pregunta y aviso de sesión
    elId("btnNuevaPregunta").style.display = "inline-flex";
    elId("avisoLogin").style.display      = "block";
    elId("nombreSesion").textContent      = nombre;
  } else {
    usuarioActual = null;
    elId("btnNuevaPregunta").style.display = "none";
    elId("avisoLogin").style.display      = "none";
  }
  // Recargar hilos para reflejar estado
  await cargarHilos();
});

// ── Cargar hilos ──────────────────────────────────────────
async function cargarHilos() {
  try {
    const q    = query(collection(_db, "foro_hilos"), orderBy("creado_en", "desc"));
    const snap = await getDocs(q);
    hilos      = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    aplicarFiltro();
  } catch (e) {
    console.error("foro: cargarHilos", e);
    elId("listaHilos").innerHTML =
      `<div class="foro-vacio"><span style="font-size:2rem">⚠️</span><p>Error al cargar el foro.</p></div>`;
  }
}

// ── Filtro de búsqueda ────────────────────────────────────
function aplicarFiltro() {
  const txt = (elId("busqForo").value || "").toLowerCase().normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  hilosFiltrados = txt
    ? hilos.filter(h =>
        (h.titulo || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").includes(txt) ||
        (h.cuerpo || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").includes(txt)
      )
    : [...hilos];
  paginaActual = 1;
  renderHilos();
}

elId("busqForo").addEventListener("input", aplicarFiltro);

// ── Renderizar lista de hilos ─────────────────────────────
function renderHilos() {
  const inicio  = (paginaActual - 1) * POR_PAGINA;
  const pagina  = hilosFiltrados.slice(inicio, inicio + POR_PAGINA);
  const totalPags = Math.ceil(hilosFiltrados.length / POR_PAGINA);

  if (!hilosFiltrados.length) {
    elId("listaHilos").innerHTML =
      `<div class="foro-vacio"><span style="font-size:2.5rem">🔍</span><p>No hay hilos aún. ¡Sé el primero en preguntar!</p></div>`;
    elId("foroPaginado").innerHTML = "";
    return;
  }

  elId("listaHilos").innerHTML = pagina.map(h => `
    <div class="hilo-card">
      <div class="hilo-header">
        <div class="hilo-avatar" style="background:${h.autor_color||'#1a6b3c'}">
          ${h.autor_foto
            ? `<img src="${h.autor_foto}" alt="${h.autor_nombre||''}" onerror="this.style.display='none'">`
            : (h.autor_nombre||"?")[0].toUpperCase()}
        </div>
        <div class="hilo-meta">
          <div class="hilo-autor">${h.autor_nombre || "Vendedor"}</div>
          <div class="hilo-fecha">${fmtFecha(h.creado_en)}</div>
        </div>
      </div>
      <div class="hilo-titulo">${h.titulo || ""}</div>
      ${h.cuerpo ? `<div class="hilo-cuerpo">${h.cuerpo}</div>` : ""}
      <div class="hilo-footer">
        <div class="hilo-stats">
          <span>💬 ${h.respuestas || 0} respuesta${(h.respuestas||0)!==1?"s":""}</span>
        </div>
        <button class="btn-ver-hilo" onclick="abrirHilo('${h.id}')">
          Ver hilo →
        </button>
      </div>
    </div>`).join("");

  // Paginado
  let pagHtml = "";
  for (let i = 1; i <= totalPags; i++) {
    pagHtml += `<button class="pag-btn${i===paginaActual?" activo":""}"
      onclick="irPagina(${i})">${i}</button>`;
  }
  elId("foroPaginado").innerHTML = pagHtml;
}

window.irPagina = p => { paginaActual = p; renderHilos(); window.scrollTo({top:0,behavior:"smooth"}); };

// ── Abrir hilo ────────────────────────────────────────────
window.abrirHilo = async (hiloId) => {
  hiloAbierto = hilos.find(h => h.id === hiloId) || null;
  if (!hiloAbierto) return;

  elId("modalHiloTitulo").textContent = hiloAbierto.titulo || "";

  // Cuerpo: pregunta original + respuestas
  const cuerpoEl = elId("modalHiloCuerpo");
  cuerpoEl.innerHTML = `
    <div style="margin-bottom:1.25rem;padding-bottom:1.25rem;border-bottom:2px solid var(--borde,#e5e7eb)">
      <div style="display:flex;gap:.75rem;align-items:flex-start">
        <div class="hilo-avatar" style="background:${hiloAbierto.autor_color||'#1a6b3c'}">
          ${hiloAbierto.autor_foto
            ? `<img src="${hiloAbierto.autor_foto}" onerror="this.style.display='none'">`
            : (hiloAbierto.autor_nombre||"?")[0].toUpperCase()}
        </div>
        <div>
          <div class="hilo-autor">${hiloAbierto.autor_nombre||"Vendedor"}</div>
          <div class="hilo-fecha">${fmtFecha(hiloAbierto.creado_en)}</div>
        </div>
      </div>
      ${hiloAbierto.cuerpo ? `<p style="margin-top:.85rem;font-size:.9rem;color:var(--gris-700,#374151);line-height:1.6">${hiloAbierto.cuerpo}</p>` : ""}
    </div>
    <div id="listaRespuestas"><p style="color:var(--gris-500);font-size:.85rem">Cargando respuestas…</p></div>`;

  // Footer: caja de respuesta o aviso
  elId("modalHiloFooter").innerHTML = usuarioActual
    ? `<div class="caja-respuesta">
        <textarea id="txtRespuesta" placeholder="Escribe tu respuesta…" maxlength="1200"></textarea>
        <div class="caja-respuesta-footer">
          <button class="btn-verde" onclick="publicarRespuesta('${hiloId}')">Responder</button>
        </div>
       </div>`
    : `<div class="login-aviso">
        <a href="../user/index.html">Inicia sesión</a> como vendedor para responder.
       </div>`;

  elId("modalHilo").classList.add("visible");
  await cargarRespuestas(hiloId);
};

// ── Cargar respuestas ─────────────────────────────────────
async function cargarRespuestas(hiloId) {
  try {
    const q    = query(collection(_db, "foro_respuestas"),
                       where("hilo_id", "==", hiloId),
                       orderBy("creado_en", "asc"));
    const snap = await getDocs(q);
    const resps = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    renderRespuestas(resps, hiloId);
  } catch (e) {
    console.error("foro: cargarRespuestas", e);
    elId("listaRespuestas").innerHTML = `<p style="color:var(--gris-500);font-size:.85rem">Error al cargar respuestas.</p>`;
  }
}

function renderRespuestas(resps, hiloId) {
  const el = elId("listaRespuestas");
  if (!resps.length) {
    el.innerHTML = `<p style="color:var(--gris-500);font-size:.85rem;text-align:center;padding:1rem 0">Sin respuestas aún. ¡Sé el primero!</p>`;
    return;
  }

  const ahora = new Date();
  el.innerHTML = resps.map(r => {
    const esMio    = usuarioActual && r.autor_id === usuarioActual.uid;
    const esAdmin  = usuarioActual?.esAdmin;
    const puedoEditar = esMio && ((ahora - new Date(r.creado_en)) < 30 * 60 * 1000);
    const puedoElim   = esMio || esAdmin;

    return `<div class="respuesta-item" id="resp-${r.id}">
      <div class="resp-avatar" style="background:${r.autor_color||'#1a6b3c'}">
        ${r.autor_foto
          ? `<img src="${r.autor_foto}" onerror="this.style.display='none'">`
          : (r.autor_nombre||"?")[0].toUpperCase()}
      </div>
      <div class="resp-body">
        <div style="display:flex;align-items:center;gap:.5rem;flex-wrap:wrap">
          <span class="resp-autor">${r.autor_nombre||"Vendedor"}</span>
          <span class="resp-fecha">${fmtFecha(r.creado_en)}</span>
        </div>
        <div class="resp-texto" id="rtexto-${r.id}">${r.texto||""}</div>
        ${(puedoEditar||puedoElim) ? `
        <div class="resp-acciones">
          ${puedoEditar ? `<button class="btn-resp-accion" onclick="editarResp('${r.id}','${hiloId}')">✏️ Editar</button>` : ""}
          ${puedoElim   ? `<button class="btn-resp-accion eliminar" onclick="eliminarResp('${r.id}','${hiloId}')">🗑 Eliminar</button>` : ""}
        </div>` : ""}
      </div>
    </div>`;
  }).join("");
}

// ── Publicar respuesta ────────────────────────────────────
window.publicarRespuesta = async (hiloId) => {
  if (!usuarioActual) return;
  const txt = (elId("txtRespuesta")?.value || "").trim();
  if (!txt) { alert("Escribe tu respuesta primero."); return; }

  try {
    const datos = {
      hilo_id:      hiloId,
      autor_id:     usuarioActual.uid,
      autor_nombre: usuarioActual.nombre,
      autor_foto:   usuarioActual.foto,
      autor_color:  usuarioActual.color,
      texto:        txt,
      creado_en:    new Date().toISOString(),
    };
    await addDoc(collection(_db, "foro_respuestas"), datos);

    // Incrementar contador en hilo
    const hiloRef = doc(_db, "foro_hilos", hiloId);
    const hiloSnap = await getDoc(hiloRef);
    if (hiloSnap.exists()) {
      await updateDoc(hiloRef, { respuestas: (hiloSnap.data().respuestas || 0) + 1 });
    }

    // Actualizar local
    const h = hilos.find(x => x.id === hiloId);
    if (h) h.respuestas = (h.respuestas || 0) + 1;

    elId("txtRespuesta").value = "";
    await cargarRespuestas(hiloId);
  } catch (e) { console.error(e); alert("Error al publicar respuesta."); }
};

// ── Editar respuesta (solo si < 30 min) ───────────────────
window.editarResp = (respId, hiloId) => {
  const textoEl = elId(`rtexto-${respId}`);
  if (!textoEl) return;
  const textoActual = textoEl.textContent;
  textoEl.innerHTML = `
    <textarea style="width:100%;min-height:70px;border:1.5px solid var(--verde,#1a6b3c);border-radius:8px;padding:.5rem;font-size:.88rem;font-family:inherit;box-sizing:border-box"
      id="edit-${respId}">${textoActual}</textarea>
    <div style="display:flex;gap:.5rem;margin-top:.4rem;justify-content:flex-end">
      <button onclick="cancelarEdicion('${respId}','${textoActual}')" class="btn-gris" style="font-size:.78rem;padding:.3rem .7rem">Cancelar</button>
      <button onclick="guardarEdicion('${respId}','${hiloId}')" class="btn-verde" style="font-size:.78rem;padding:.3rem .7rem">Guardar</button>
    </div>`;
};

window.cancelarEdicion = (respId, textoOriginal) => {
  const el = elId(`rtexto-${respId}`);
  if (el) el.innerHTML = textoOriginal;
};

window.guardarEdicion = async (respId, hiloId) => {
  const nuevoTexto = (elId(`edit-${respId}`)?.value || "").trim();
  if (!nuevoTexto) { alert("El texto no puede estar vacío."); return; }
  // Verificar tiempo (30 min)
  try {
    const snap = await getDoc(doc(_db, "foro_respuestas", respId));
    if (!snap.exists()) { alert("Respuesta no encontrada."); return; }
    const diff = (new Date() - new Date(snap.data().creado_en)) / 1000 / 60;
    if (diff > 30) { alert("Han pasado más de 30 minutos, ya no puedes editar esta respuesta."); return; }
    await updateDoc(doc(_db, "foro_respuestas", respId), { texto: nuevoTexto });
    await cargarRespuestas(hiloId);
  } catch (e) { console.error(e); alert("Error al guardar."); }
};

// ── Eliminar respuesta ────────────────────────────────────
window.eliminarResp = async (respId, hiloId) => {
  if (!confirm("¿Eliminar esta respuesta?")) return;
  try {
    await deleteDoc(doc(_db, "foro_respuestas", respId));
    // Decrementar contador
    const hiloRef  = doc(_db, "foro_hilos", hiloId);
    const hiloSnap = await getDoc(hiloRef);
    if (hiloSnap.exists()) {
      const actual = hiloSnap.data().respuestas || 0;
      await updateDoc(hiloRef, { respuestas: Math.max(0, actual - 1) });
      const h = hilos.find(x => x.id === hiloId);
      if (h) h.respuestas = Math.max(0, (h.respuestas||0) - 1);
    }
    elId(`resp-${respId}`)?.remove();
  } catch (e) { console.error(e); alert("Error al eliminar."); }
};

// ── Modal nueva pregunta ──────────────────────────────────
elId("btnNuevaPregunta").addEventListener("click", () => {
  elId("fForoTitulo").value = "";
  elId("fForoCuerpo").value = "";
  elId("modalPregunta").classList.add("visible");
});

elId("btnCancelarPregunta").addEventListener("click", () => {
  elId("modalPregunta").classList.remove("visible");
});

elId("modalPregunta").addEventListener("click", e => {
  if (e.target === elId("modalPregunta")) elId("modalPregunta").classList.remove("visible");
});

elId("btnPublicarPregunta").addEventListener("click", async () => {
  if (!usuarioActual) { alert("Debes iniciar sesión."); return; }
  const titulo = (elId("fForoTitulo").value || "").trim();
  const cuerpo = (elId("fForoCuerpo").value || "").trim();
  if (!titulo) { alert("El título es obligatorio."); return; }

  elId("btnPublicarPregunta").disabled = true;
  try {
    await addDoc(collection(_db, "foro_hilos"), {
      titulo,
      cuerpo,
      autor_id:     usuarioActual.uid,
      autor_nombre: usuarioActual.nombre,
      autor_foto:   usuarioActual.foto,
      autor_color:  usuarioActual.color,
      respuestas:   0,
      creado_en:    new Date().toISOString(),
    });
    elId("modalPregunta").classList.remove("visible");
    await cargarHilos();
  } catch (e) { console.error(e); alert("Error al publicar. Verifica tu conexión."); }
  finally { elId("btnPublicarPregunta").disabled = false; }
});

// ── Cerrar modal hilo ─────────────────────────────────────
elId("btnCerrarHilo").addEventListener("click", () => {
  elId("modalHilo").classList.remove("visible");
  hiloAbierto = null;
});
elId("modalHilo").addEventListener("click", e => {
  if (e.target === elId("modalHilo")) elId("btnCerrarHilo").click();
});