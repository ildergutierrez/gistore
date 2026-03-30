// ============================================================
//  user/js/productos.js
//  Backend: PHP + MySQL  |  Auth: sesión PHP + CSRF token
// ============================================================

// ── Cloudinary ─────────────────────────────────────────────
const CLOUD_NAME    = "dqmrgerue";
const UPLOAD_PRESET = "gi-store";

// ── Rutas backend ──────────────────────────────────────────
const API_PRODUCTOS = "../backend/productos.php";
const API_TOKEN     = "../../backend/tokens.php";

// ── Estado global ──────────────────────────────────────────
let productos           = [];
let categorias          = [];
let idEliminar          = "";
let busqueda            = "";
let archivoSeleccionado = null;

// ── Fecha ─────────────────────────────────────────────────
document.getElementById("fechaHoy").textContent = new Date().toLocaleDateString("es-ES", {
  year: "numeric", month: "long", day: "numeric"
});

// ── Helper ruta imagen ─────────────────────────────────────
function urlImagen(ruta) {
  if (!ruta) return null;
  if (ruta.startsWith("http://") || ruta.startsWith("https://")) return ruta;
  const limpia = ruta.replace(/^(\.\.\/)+/, "").replace(/^\/+/, "");
  return "/" + limpia;
}

// ══════════════════════════════════════════════════════════
//  CSRF
// ══════════════════════════════════════════════════════════
let _token = null;

async function getToken() {
  if (_token) return _token;
  try {
    const res  = await fetch(API_TOKEN, { credentials: "include" });
    const data = await res.json();
    _token = data.token || "";
  } catch { _token = ""; }
  return _token;
}

// ══════════════════════════════════════════════════════════
//  API helpers
// ══════════════════════════════════════════════════════════
async function apiGet(accion) {
  const token = await getToken();
  const res   = await fetch(
    `${API_PRODUCTOS}?accion=${accion}&token=${encodeURIComponent(token)}`,
    { credentials: "include" }
  );
  const data = await res.json();
  if (!data.ok) throw new Error(data.error || "Error desconocido");
  return data.datos;
}

async function apiPost(params) {
  const token = await getToken();
  const form  = new FormData();
  form.append("token", token);
  for (const [k, v] of Object.entries(params)) form.append(k, v ?? "");
  const res  = await fetch(API_PRODUCTOS, {
    method: "POST", credentials: "include", body: form
  });
  const data = await res.json();
  if (!data.ok) throw new Error(data.error || "Error desconocido");
  return data.datos;
}

// ══════════════════════════════════════════════════════════
//  Cargar datos iniciales
// ══════════════════════════════════════════════════════════
async function cargar() {
  try {
    const token = await getToken();
    if (!token) { mostrarError("Error de autenticación."); return; }

    [productos, categorias] = await Promise.all([
      apiGet("obtener"),
      apiGet("categorias"),
    ]);

    await verificarMembresia();
    renderTabla();
  } catch (e) {
    console.error("Error al cargar:", e);
    mostrarError("No se pudieron cargar los productos. Recarga la página.");
  }
}

// ── Verificar membresía ────────────────────────────────────
async function verificarMembresia() {
  try {
    const token = await getToken();
    const res   = await fetch(
      `../backend/membresias.php?token=${encodeURIComponent(token)}`,
      { credentials: "include" }
    );
    const json = await res.json();
    if (!json.ok) { bloquearAcciones(true); mostrarBannerMembresia(null); return; }

    const { membresia } = json.datos;
    const hoy     = new Date().toISOString().split("T")[0];
    const vigente = membresia?.estado === "activa" && membresia?.fecha_fin >= hoy;

    if (vigente) {
      ocultarBannerMembresia();
      bloquearAcciones(false);
    } else {
      mostrarBannerMembresia(membresia);
      bloquearAcciones(true);
    }
  } catch {
    // Si el endpoint aún no existe, no bloquear
  }
}

function mostrarBannerMembresia(mem) {
  let banner = document.getElementById("bannerMembresia");
  if (!banner) {
    banner = document.createElement("div");
    banner.id = "bannerMembresia";
    const main = document.querySelector(".main");
    if (main && main.children[1]) main.insertBefore(banner, main.children[1]);
  }
  const msg = mem?.fecha_fin
    ? `Tu membresía venció el ${mem.fecha_fin}. Tus productos están desactivados.`
    : "No tienes membresía activa. Tus productos están desactivados.";
  banner.innerHTML = `
    <div style="background:#fff3cd;border:1.5px solid #f59e0b;border-radius:10px;
                padding:1rem 1.25rem;margin-bottom:1.5rem;display:flex;
                align-items:center;gap:.75rem;flex-wrap:wrap">
      <span style="font-size:1.3rem">⚠️</span>
      <div style="flex:1;min-width:0">
        <strong style="color:#92400e;font-size:.9rem">Membresía inactiva</strong>
        <p style="color:#78350f;font-size:.82rem;margin:.2rem 0 0">${msg}</p>
      </div>
      <a href="membresia.html"
         style="background:#f59e0b;color:#fff;border-radius:8px;padding:.5rem 1rem;
                font-size:.82rem;font-weight:600;text-decoration:none;white-space:nowrap">
        💳 Renovar membresía
      </a>
    </div>`;
}

function ocultarBannerMembresia() {
  document.getElementById("bannerMembresia")?.remove();
}

function bloquearAcciones(bloquear) {
  const btn = document.getElementById("btnNuevo");
  if (!btn) return;
  btn.disabled      = bloquear;
  btn.title         = bloquear ? "Requiere membresía activa" : "";
  btn.style.opacity = bloquear ? ".45" : "1";
  btn.style.cursor  = bloquear ? "not-allowed" : "";
}

// ══════════════════════════════════════════════════════════
//  Tabla + Paginación
// ══════════════════════════════════════════════════════════
const POR_PAG = 25;
let pagina    = 1;

document.getElementById("buscador").addEventListener("input", e => {
  busqueda = e.target.value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  pagina   = 1;
  renderTablaPag();
});

function renderTabla() { pagina = 1; renderTablaPag(); }

function nombreCategoria(id) {
  const c = categorias.find(x => String(x.id) === String(id));
  return c ? c.nombre : "—";
}

function renderTablaPag() {
  const filtrados = busqueda
    ? productos.filter(p => {
        const txt = p.nombre.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        return txt.includes(busqueda);
      })
    : productos;

  const total     = filtrados.length;
  const totalPags = Math.max(1, Math.ceil(total / POR_PAG));
  if (pagina > totalPags) pagina = totalPags;

  const desde    = (pagina - 1) * POR_PAG;
  const paginado = filtrados.slice(desde, desde + POR_PAG);

  const contadorEl = document.getElementById("totalProductos");
  if (contadorEl) {
    contadorEl.textContent =
      `${total} producto${total !== 1 ? "s" : ""}` +
      (totalPags > 1 ? `  ·  pág. ${pagina} / ${totalPags}` : "");
  }

  const wrap = document.getElementById("tablaWrap");
  if (!filtrados.length) {
    wrap.innerHTML = '<p class="vacio-txt">Sin productos. ¡Agrega tu primer producto!</p>';
    return;
  }

  const imgCell = p => {
    const src = urlImagen(p.imagen);
    if (!src)
      return `<div style="width:44px;height:44px;border-radius:8px;background:var(--verde-claro);
                          display:flex;align-items:center;justify-content:center;font-size:1.2rem">📦</div>`;
    return `<img src="${src}" alt="${escHtml(p.nombre)}"
                 style="width:44px;height:44px;object-fit:cover;border-radius:8px;
                        border:1.5px solid var(--borde);display:block"
                 onerror="this.outerHTML='<div style=\\'width:44px;height:44px;border-radius:8px;background:var(--verde-claro);display:flex;align-items:center;justify-content:center;font-size:1.2rem\\'>📦</div>'">`;
  };

  const filas = paginado.map(p => `
    <tr>
      <td style="padding:8px">${imgCell(p)}</td>
      <td style="padding:8px"><strong style="font-size:.875rem">${escHtml(p.nombre)}</strong></td>
      <td style="padding:8px;white-space:nowrap;font-size:.875rem">${formatoPrecio(p.valor)}</td>
      <td style="padding:8px;font-size:.85rem">${escHtml(nombreCategoria(p.categoria_id))}</td>
      <td style="padding:8px">
        <span class="badge badge-${p.activo == 1 ? "activo" : "inactivo"}">
          ${p.activo == 1 ? "Activo" : "Inactivo"}
        </span>
      </td>
      <td style="padding:8px">
        <div class="td-acciones">
          <button class="btn-tabla btn-editar"   data-id="${p.id}">✏ Editar</button>
          <button class="btn-tabla btn-eliminar" data-id="${p.id}" data-nombre="${escHtml(p.nombre)}">🗑 Eliminar</button>
        </div>
      </td>
    </tr>`).join("");

  const paginador = totalPags > 1 ? buildPaginador(pagina, totalPags) : "";

  wrap.innerHTML = `
    <div style="overflow-x:auto;-webkit-overflow-scrolling:touch">
      <table style="min-width:520px;width:100%">
        <thead><tr>
          <th style="padding:8px;width:60px">Imagen</th>
          <th style="padding:8px">Nombre</th>
          <th style="padding:8px">Valor</th>
          <th style="padding:8px">Categoría</th>
          <th style="padding:8px">Estado</th>
          <th style="padding:8px">Acciones</th>
        </tr></thead>
        <tbody>${filas}</tbody>
      </table>
    </div>
    ${paginador}`;

  wrap.querySelectorAll(".btn-editar").forEach(btn =>
    btn.addEventListener("click", () => abrirEditar(btn.dataset.id)));
  wrap.querySelectorAll(".btn-eliminar").forEach(btn =>
    btn.addEventListener("click", () => abrirEliminar(btn.dataset.id, btn.dataset.nombre)));
  wrap.querySelectorAll("[data-pag]").forEach(btn =>
    btn.addEventListener("click", () => {
      pagina = parseInt(btn.dataset.pag);
      renderTablaPag();
      wrap.scrollIntoView({ behavior: "smooth", block: "start" });
    }));
}

function buildPaginador(actual, total) {
  const esMovil = window.innerWidth < 500;
  const MAX = esMovil ? 3 : 5;
  let ini = Math.max(1, actual - Math.floor(MAX / 2));
  let fin = Math.min(total, ini + MAX - 1);
  if (fin - ini < MAX - 1) ini = Math.max(1, fin - MAX + 1);
  const TAM = esMovil ? "44px" : "36px";
  const FS  = esMovil ? ".9rem" : ".82rem";
  const s = on =>
    `display:inline-flex;align-items:center;justify-content:center;` +
    `min-width:${TAM};height:${TAM};padding:0 8px;border-radius:8px;` +
    `font-size:${FS};font-weight:600;cursor:pointer;` +
    `background:${on ? "var(--verde)" : "var(--fondo-2)"};` +
    `color:${on ? "#fff" : "var(--texto)"};` +
    `border:1.5px solid ${on ? "var(--verde)" : "var(--borde)"};transition:background .15s;`;
  let btns = "";
  if (actual > 1)     btns += `<button data-pag="${actual - 1}" style="${s(false)}">&#8592;</button>`;
  for (let i = ini; i <= fin; i++) btns += `<button data-pag="${i}" style="${s(i === actual)}">${i}</button>`;
  if (actual < total) btns += `<button data-pag="${actual + 1}" style="${s(false)}">&#8594;</button>`;
  const info = `<span style="font-size:.8rem;color:var(--texto-suave);white-space:nowrap">Pág. ${actual} / ${total}</span>`;
  return `<div style="display:flex;align-items:center;justify-content:center;gap:6px;
                      margin-top:1.25rem;padding:.75rem 0;flex-wrap:wrap">${btns}${info}</div>`;
}

// ══════════════════════════════════════════════════════════
//  Zona de imagen (Cloudinary)
// ══════════════════════════════════════════════════════════
const zonaImagen  = document.getElementById("zonaImagen");
const inputFile   = document.getElementById("fImagenFile");
const previstaDiv = document.getElementById("previstaImagen");
const imgPreview  = document.getElementById("imgPreview");
const imgNombre   = document.getElementById("imgNombre");
const imgEstado   = document.getElementById("imgEstado");
const btnQuitar   = document.getElementById("btnQuitarImg");

zonaImagen.addEventListener("click", () => inputFile.click());
zonaImagen.addEventListener("dragover", e => {
  e.preventDefault(); zonaImagen.style.borderColor = "var(--verde)";
});
zonaImagen.addEventListener("dragleave", () => {
  zonaImagen.style.borderColor = "var(--verde-borde)";
});
zonaImagen.addEventListener("drop", e => {
  e.preventDefault(); zonaImagen.style.borderColor = "var(--verde-borde)";
  if (e.dataTransfer.files[0]) seleccionarArchivo(e.dataTransfer.files[0]);
});
inputFile.addEventListener("change", e => {
  if (e.target.files[0]) seleccionarArchivo(e.target.files[0]);
});

function seleccionarArchivo(file) {
  if (!file.type.startsWith("image/")) { alert("Solo imágenes (JPG, PNG, WEBP)."); return; }
  if (file.size > 5 * 1024 * 1024)    { alert("Máximo 5MB."); return; }
  archivoSeleccionado       = file;
  imgPreview.src            = URL.createObjectURL(file);
  imgNombre.textContent     = file.name;
  imgEstado.textContent     = "Lista para guardar";
  imgEstado.style.color     = "var(--texto-suave)";
  previstaDiv.style.display = "flex";
  document.getElementById("zonaTexto").innerHTML =
    "<p style='font-size:.82rem;color:var(--verde);font-weight:600'>✓ Imagen seleccionada</p>";
}

btnQuitar.addEventListener("click", () => {
  archivoSeleccionado = null;
  inputFile.value     = "";
  document.getElementById("fImagen").value = "";
  previstaDiv.style.display = "none";
  resetZonaTexto();
});

function resetZonaTexto() {
  document.getElementById("zonaTexto").innerHTML = `
    <div style="font-size:2rem;margin-bottom:.4rem">🖼️</div>
    <p style="font-size:.85rem;color:var(--texto-medio);margin-bottom:.3rem">
      <strong>Haz clic para seleccionar</strong> o arrastra aquí
    </p>
    <p style="font-size:.75rem;color:var(--texto-suave)">JPG, PNG, WEBP — máx. 5MB</p>`;
}

async function subirImagen() {
  if (!archivoSeleccionado) return null;
  imgEstado.textContent = "Subiendo...";
  imgEstado.style.color = "var(--advertencia)";
  const formData = new FormData();
  formData.append("file",          archivoSeleccionado);
  formData.append("upload_preset", UPLOAD_PRESET);
  formData.append("folder",        "productos-clientes");
  const res  = await fetch(
    `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`,
    { method: "POST", body: formData }
  );
  const data = await res.json();
  if (!res.ok) throw new Error(data.error?.message || "Error al subir imagen");
  imgEstado.textContent = "✓ Subida correctamente";
  imgEstado.style.color = "var(--ok)";
  return data.secure_url;
}

// ══════════════════════════════════════════════════════════
//  Modales
// ══════════════════════════════════════════════════════════
document.getElementById("btnNuevo").addEventListener("click", () => {
  limpiarModal();
  document.getElementById("modalTitulo").textContent = "Nuevo producto";
  document.getElementById("productoId").value        = "";
  llenarCategorias();
  ocultarMensajes();
  abrirModal("modalOverlay");
});

function abrirEditar(id) {
  const p = productos.find(x => String(x.id) === String(id));
  if (!p) return;

  limpiarModal();
  document.getElementById("modalTitulo").textContent = "Editar producto";
  document.getElementById("productoId").value         = p.id;
  document.getElementById("fNombre").value            = p.nombre        || "";
  document.getElementById("fValor").value             = p.valor         || "";
  document.getElementById("fDescripcion").value       = p.descripcion   || "";
  document.getElementById("fRecomendacion").value     = p.recomendacion || "";
  // Parsear beneficios: puede venir como JSON array ["a","b"] o texto plano
  let beneficiosTexto = "";
  if (p.beneficios) {
    try {
      const arr = JSON.parse(p.beneficios);
      beneficiosTexto = Array.isArray(arr) ? arr.join("\n") : p.beneficios;
    } catch {
      beneficiosTexto = p.beneficios; // ya es texto plano, dejarlo como está
    }
  }
  document.getElementById("fBeneficios").value = beneficiosTexto;
  document.getElementById("fActivo").value            = String(p.activo == 1 ? "true" : "false");
  document.getElementById("fImagen").value            = p.imagen        || "";
  archivoSeleccionado = null;

  if (p.imagen) {
    const src = urlImagen(p.imagen);
    imgPreview.src = src;
    imgPreview.onerror = () => {
      imgPreview.src            = "";
      imgNombre.textContent     = "Imagen no encontrada";
      imgEstado.textContent     = "⚠ Ruta inválida o archivo eliminado";
      imgEstado.style.color     = "var(--advertencia, #f59e0b)";
      imgPreview.onerror        = null;
    };
    imgNombre.textContent     = "Imagen actual";
    imgEstado.textContent     = "Imagen actual";
    imgEstado.style.color     = "var(--texto-suave)";
    previstaDiv.style.display = "flex";
    document.getElementById("zonaTexto").innerHTML =
      "<p style='font-size:.82rem;color:var(--verde);font-weight:600'>✓ Imagen actual cargada</p>";
  }

  llenarCategorias(p.categoria_id);
  ocultarMensajes();
  abrirModal("modalOverlay");
}

function llenarCategorias(seleccionada = "") {
  document.getElementById("fCategoria").innerHTML =
    `<option value="">— Categoría —</option>` +
    categorias.map(c =>
      `<option value="${c.id}" ${String(c.id) === String(seleccionada) ? "selected" : ""}>${escHtml(c.nombre)}</option>`
    ).join("");
}

// ══════════════════════════════════════════════════════════
//  Guardar
// ══════════════════════════════════════════════════════════
document.getElementById("btnGuardar").addEventListener("click", async () => {
  const id           = document.getElementById("productoId").value;
  const nombre       = document.getElementById("fNombre").value.trim();
  const valor        = Number(document.getElementById("fValor").value);
  const categoria_id = document.getElementById("fCategoria").value;
  const descripcion  = document.getElementById("fDescripcion").value.trim();
  const recomendacion= document.getElementById("fRecomendacion").value.trim();
  // Convertir líneas del textarea a JSON array (filtra líneas vacías)
  const beneficiosRaw = document.getElementById("fBeneficios").value.trim();
  const beneficios = beneficiosRaw
    ? JSON.stringify(beneficiosRaw.split("\n").map(l => l.trim()).filter(Boolean))
    : "";
  const activo       = document.getElementById("fActivo").value === "true" ? 1 : 0;

  if (!nombre) { mostrarError("El nombre es obligatorio."); return; }
  if (!valor)  { mostrarError("El valor es obligatorio.");  return; }

  const btn = document.getElementById("btnGuardar");
  btnCargando(btn, true);
  ocultarMensajes();

  try {
    let imagen = document.getElementById("fImagen").value;
    if (archivoSeleccionado) {
      imagen = await subirImagen();
      archivoSeleccionado = null;
    }

    await apiPost({
      accion: id ? "actualizar" : "crear",
      ...(id ? { id } : {}),
      nombre, valor, categoria_id, descripcion,
      recomendacion, beneficios, activo, imagen,
    });

    mostrarOk(id ? "Producto actualizado correctamente." : "Producto creado correctamente.");
    await cargar();
    setTimeout(() => cerrarModal("modalOverlay"), 1200);
  } catch (e) {
    mostrarError("Error al guardar: " + e.message);
    console.error(e);
  } finally {
    btnCargando(btn, false);
  }
});

// ══════════════════════════════════════════════════════════
//  Eliminar
// ══════════════════════════════════════════════════════════
function abrirEliminar(id, nombre) {
  idEliminar = id;
  document.getElementById("nombreEliminar").textContent = nombre;
  abrirModal("modalEliminar");
}

document.getElementById("btnConfirmarEliminar").addEventListener("click", async () => {
  const btn = document.getElementById("btnConfirmarEliminar");
  btnCargando(btn, true);
  try {
    await apiPost({ accion: "eliminar", id: idEliminar });
    cerrarModal("modalEliminar");
    await cargar();
  } catch (e) {
    console.error("Error al eliminar:", e);
    mostrarError("No se pudo eliminar el producto.");
  } finally {
    btnCargando(btn, false);
  }
});

// ── Cerrar modales ─────────────────────────────────────────
document.getElementById("btnCancelar").addEventListener("click",
  () => cerrarModal("modalOverlay"));
document.getElementById("btnCancelarEliminar").addEventListener("click",
  () => cerrarModal("modalEliminar"));
document.getElementById("modalOverlay").addEventListener("click", e => {
  if (e.target === document.getElementById("modalOverlay")) cerrarModal("modalOverlay");
});

// ══════════════════════════════════════════════════════════
//  Helpers UI
// ══════════════════════════════════════════════════════════

// ── FIX PRINCIPAL: el CSS usa .visible, no .activo ────────
function abrirModal(id)  { document.getElementById(id).classList.add("visible"); }
function cerrarModal(id) { document.getElementById(id).classList.remove("visible"); }

function btnCargando(btn, estado) {
  btn.disabled = estado;
  btn.dataset.textoOriginal = btn.dataset.textoOriginal || btn.textContent;
  btn.textContent = estado ? "Guardando…" : btn.dataset.textoOriginal;
}

function formatoPrecio(n) {
  return "$" + Number(n).toLocaleString("es-CO");
}

function limpiarModal() {
  ["fNombre","fValor","fDescripcion","fRecomendacion","fBeneficios"].forEach(id => {
    document.getElementById(id).value = "";
  });
  document.getElementById("fActivo").value = "true";
  document.getElementById("fImagen").value = "";
  archivoSeleccionado = null;
  previstaDiv.style.display = "none";
  imgPreview.onerror = null;
  resetZonaTexto();
}

function ocultarMensajes() {
  document.getElementById("msgError").classList.remove("visible");
  document.getElementById("msgOk").classList.remove("visible");
}
function mostrarError(msg) {
  document.getElementById("textoError").textContent = msg;
  document.getElementById("msgError").classList.add("visible");
  document.getElementById("msgOk").classList.remove("visible");
}
function mostrarOk(msg) {
  document.getElementById("textoOk").textContent = msg;
  document.getElementById("msgOk").classList.add("visible");
  document.getElementById("msgError").classList.remove("visible");
}

function escHtml(str) {
  return String(str ?? "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;")
    .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

// ══════════════════════════════════════════════════════════
//  Init
// ══════════════════════════════════════════════════════════
cargar();