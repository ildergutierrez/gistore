// ============================================================
//  productos.js — Gestión de productos del vendedor
// ============================================================
import { cerrarSesion, protegerPagina } from "./auth.js";
import { obtenerVendedorPorUid, obtenerCategorias,
         obtenerMisProductos, crearProducto, actualizarProducto,
         eliminarProducto, obtenerMembresiaVendedor,
         membresiaVigente, desactivarProductosVendedor } from "./db.js";
import { fechaHoy, btnCargando, formatoPrecio, abrirModal, cerrarModal } from "./ui.js";
import { auth } from "./firebase.js";
import { onAuthStateChanged }
  from "https://www.gstatic.com/firebasejs/12.10.0/firebase-auth.js";

protegerPagina("../index.html");

// ── Cloudinary ────────────────────────────────────────────
const CLOUD_NAME    = "dqmrgerue";
const UPLOAD_PRESET = "gi-store";

// ── Estado global ─────────────────────────────────────────
let productos          = [];
let categorias         = [];
let vendedor           = null;
let idEliminar         = "";
let busqueda           = "";
let archivoSeleccionado = null;

// ── Inicializar elementos del DOM de forma segura ──────────
function el(id) { return document.getElementById(id); }

// ── Cargar datos ──────────────────────────────────────────
async function cargar(user) {
  try {
    if (!user) return;

    vendedor = await obtenerVendedorPorUid(user.uid);
    if (!vendedor) return;

    if (el("vendedorNombre")) el("vendedorNombre").textContent = vendedor.nombre;
    sessionStorage.setItem("vendedor_id", vendedor.id);

    // Verificar membresía
    const mem     = await obtenerMembresiaVendedor(vendedor.id);
    const vigente = membresiaVigente(mem);

    if (!vigente) {
      await desactivarProductosVendedor(vendedor.id);
      mostrarBannerMembresia(mem);
      bloquearAcciones(true);
    } else {
      ocultarBannerMembresia();
      bloquearAcciones(false);
    }

    [productos, categorias] = await Promise.all([
      obtenerMisProductos(vendedor.id),
      obtenerCategorias(),
    ]);
    renderTabla();
  } catch (e) { console.error(e); }
}

function mostrarBannerMembresia(mem) {
  let banner = el("bannerMembresia");
  if (!banner) {
    banner = document.createElement("div");
    banner.id = "bannerMembresia";
    const main = document.querySelector(".main");
    if (main && main.children[1]) main.insertBefore(banner, main.children[1]);
    else if (main) main.appendChild(banner);
  }
  const msg = mem
    ? "Tu membresía venció el " + mem.fecha_fin + ". Tus productos están desactivados y no son visibles en el catálogo."
    : "No tienes membresía activa. Tus productos están desactivados y no son visibles en el catálogo.";
  banner.innerHTML = `
    <div style="background:#fff3cd;border:1.5px solid #f59e0b;border-radius:10px;padding:1rem 1.25rem;margin-bottom:1.5rem;display:flex;align-items:center;gap:.75rem;flex-wrap:wrap">
      <span style="font-size:1.3rem">⚠️</span>
      <div style="flex:1">
        <strong style="color:#92400e;font-size:.9rem">Membresía inactiva</strong>
        <p style="color:#78350f;font-size:.82rem;margin:.2rem 0 0">${msg}</p>
      </div>
      <a href="https://wa.me/573145891108?text=${encodeURIComponent('Hola, quiero renovar mi membresía de GI Store.')}"
         target="_blank"
         style="background:#f59e0b;color:#fff;border-radius:8px;padding:.5rem 1rem;font-size:.82rem;font-weight:600;text-decoration:none;white-space:nowrap">
        💬 Renovar membresía
      </a>
    </div>`;
}

function ocultarBannerMembresia() {
  const banner = el("bannerMembresia");
  if (banner) banner.remove();
}

function bloquearAcciones(bloquear) {
  const btnNuevo = el("btnNuevo");
  if (!btnNuevo) return;
  if (bloquear) {
    btnNuevo.disabled = true;
    btnNuevo.title    = "Requiere membresía activa";
    btnNuevo.style.opacity = ".45";
    btnNuevo.style.cursor  = "not-allowed";
  } else {
    btnNuevo.disabled = false;
    btnNuevo.title    = "";
    btnNuevo.style.opacity = "1";
    btnNuevo.style.cursor  = "";
  }
}

function nombreCategoria(id) {
  const c = categorias.find(x => x.id === id);
  return c ? c.nombre : "—";
}

// ── Buscador ──────────────────────────────────────────────
el("buscador").addEventListener("input", e => {
  busqueda = e.target.value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"");
  renderTabla();
});

function renderTabla() {
  const filtrados = busqueda
    ? productos.filter(p => {
        const txt = p.nombre.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"");
        return txt.includes(busqueda);
      })
    : productos;

  if (el("totalProductos"))
    el("totalProductos").textContent =
      filtrados.length + " producto" + (filtrados.length !== 1 ? "s" : "");

  const wrap = el("tablaWrap");
  if (!wrap) return;

  if (!filtrados.length) {
    wrap.innerHTML = '<p class="vacio-txt">Sin productos. ¡Agrega tu primer producto!</p>';
    return;
  }

  wrap.innerHTML = `
    <table>
      <thead>
        <tr><th>Imagen</th><th>Nombre</th><th>Valor</th><th>Categoría</th><th>Estado</th><th>Acciones</th></tr>
      </thead>
      <tbody>
        ${filtrados.map(p => `
          <tr>
            <td>${p.imagen
      ? (p.imagen.startsWith("http")
        ? `<img src="${p.imagen}" style="width:44px;height:44px;object-fit:cover;border-radius:8px;border:1.5px solid var(--borde)">`
        : `<img src="../../${p.imagen}" style="width:44px;height:44px;object-fit:cover;border-radius:8px;border:1.5px solid var(--borde)">`
      )
      : `<div style="width:44px;height:44px;border-radius:8px;background:var(--verde-claro);display:flex;align-items:center;justify-content:center">📦</div>`
    }</td>
            <td><strong>${p.nombre}</strong></td>
            <td style="white-space:nowrap">${formatoPrecio(p.valor)}</td>
            <td>${nombreCategoria(p.categoria_id)}</td>
            <td><span class="badge badge-${p.activo ? 'activo' : 'inactivo'}">${p.activo ? 'Activo' : 'Inactivo'}</span></td>
            <td>
              <div class="td-acciones">
                <button class="btn-tabla btn-editar"   data-id="${p.id}">✏ Editar</button>
                <button class="btn-tabla btn-eliminar" data-id="${p.id}" data-nombre="${p.nombre}">🗑 Eliminar</button>
              </div>
            </td>
          </tr>`).join("")}
      </tbody>
    </table>`;

  wrap.querySelectorAll(".btn-editar").forEach(btn =>
    btn.addEventListener("click", () => abrirEditar(btn.dataset.id)));
  wrap.querySelectorAll(".btn-eliminar").forEach(btn =>
    btn.addEventListener("click", () => abrirEliminar(btn.dataset.id, btn.dataset.nombre)));
}

// ── Zona imagen ───────────────────────────────────────────
const zonaImagen  = el("zonaImagen");
const inputFile   = el("fImagenFile");
const previstaDiv = el("previstaImagen");
const imgPreview  = el("imgPreview");
const imgNombre   = el("imgNombre");
const imgEstado   = el("imgEstado");
const btnQuitar   = el("btnQuitarImg");

zonaImagen.addEventListener("click", () => inputFile.click());
zonaImagen.addEventListener("dragover", e => { e.preventDefault(); zonaImagen.style.borderColor = "var(--verde)"; });
zonaImagen.addEventListener("dragleave", () => { zonaImagen.style.borderColor = "var(--verde-borde)"; });
zonaImagen.addEventListener("drop", e => {
  e.preventDefault(); zonaImagen.style.borderColor = "var(--verde-borde)";
  if (e.dataTransfer.files[0]) seleccionarArchivo(e.dataTransfer.files[0]);
});
inputFile.addEventListener("change", e => { if (e.target.files[0]) seleccionarArchivo(e.target.files[0]); });

function seleccionarArchivo(file) {
  if (!file.type.startsWith("image/")) { alert("Solo imágenes (JPG, PNG, WEBP)."); return; }
  if (file.size > 5 * 1024 * 1024) { alert("Máximo 5MB."); return; }
  archivoSeleccionado = file;
  imgPreview.src = URL.createObjectURL(file);
  imgNombre.textContent = file.name;
  imgEstado.textContent = "Lista para guardar";
  imgEstado.style.color = "var(--texto-suave)";
  previstaDiv.style.display = "flex";
  el("zonaTexto").innerHTML =
    "<p style='font-size:.82rem;color:var(--verde);font-weight:600'>✓ Imagen seleccionada</p>";
}

btnQuitar.addEventListener("click", () => {
  archivoSeleccionado = null;
  inputFile.value = "";
  el("fImagen").value = "";
  previstaDiv.style.display = "none";
  resetZonaTexto();
});

function resetZonaTexto() {
  el("zonaTexto").innerHTML = `
    <div style="font-size:2rem;margin-bottom:.4rem">🖼️</div>
    <p style="font-size:.85rem;color:var(--texto-medio);margin-bottom:.3rem"><strong>Haz clic para seleccionar</strong> o arrastra aquí</p>
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
  const res  = await fetch("https://api.cloudinary.com/v1_1/" + CLOUD_NAME + "/image/upload",
    { method: "POST", body: formData });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error?.message || "Error al subir");
  imgEstado.textContent = "✓ Subida correctamente";
  imgEstado.style.color = "var(--ok)";
  return data.secure_url;
}

// ── Modal crear ───────────────────────────────────────────
el("btnNuevo").addEventListener("click", () => {
  limpiarModal();
  el("modalTitulo").textContent = "Nuevo producto";
  el("productoId").value = "";
  llenarCategorias();
  ocultarMensajes();
  abrirModal("modalOverlay");
});

// ── Modal editar ──────────────────────────────────────────
function abrirEditar(id) {
  const p = productos.find(x => x.id === id);
  if (!p) return;
  limpiarModal();
  el("modalTitulo").textContent   = "Editar producto";
  el("productoId").value           = p.id;
  el("fNombre").value              = p.nombre        || "";
  el("fValor").value               = p.valor         || "";
  el("fDescripcion").value         = p.descripcion   || "";
  el("fRecomendacion").value       = p.recomendacion || "";
  el("fBeneficios").value          = (p.beneficios || []).join("\n");
  el("fActivo").value              = String(p.activo ?? true);
  el("fImagen").value              = p.imagen || "";
  archivoSeleccionado = null;
  if (p.imagen) {
    imgPreview.src = p.imagen;
    imgNombre.textContent = "Imagen actual";
    imgEstado.textContent = "Imagen actual";
    imgEstado.style.color = "var(--texto-suave)";
    previstaDiv.style.display = "flex";
    el("zonaTexto").innerHTML =
      "<p style='font-size:.82rem;color:var(--verde);font-weight:600'>✓ Imagen actual cargada</p>";
  }
  llenarCategorias(p.categoria_id);
  ocultarMensajes();
  abrirModal("modalOverlay");
}

function llenarCategorias(seleccionada = "") {
  el("fCategoria").innerHTML =
    `<option value="">— Categoría —</option>` +
    categorias.map(c =>
      `<option value="${c.id}" ${c.id === seleccionada ? "selected" : ""}>${c.nombre}</option>`
    ).join("");
}

// ── Guardar ───────────────────────────────────────────────
el("btnGuardar").addEventListener("click", async () => {
  const id           = el("productoId").value;
  const nombre       = el("fNombre").value.trim();
  const valor        = Number(el("fValor").value);
  const categoria_id = el("fCategoria").value;
  const descripcion  = el("fDescripcion").value.trim();
  const recomendacion= el("fRecomendacion").value.trim();
  const beneficios   = el("fBeneficios").value.split("\n").map(b => b.trim()).filter(Boolean);
  const activo       = el("fActivo").value === "true";

  if (!nombre) { mostrarError("El nombre es obligatorio."); return; }
  if (!valor)  { mostrarError("El valor es obligatorio.");  return; }

  const btn = el("btnGuardar");
  btnCargando(btn, true);
  ocultarMensajes();

  try {
    let imagen = el("fImagen").value;
    if (archivoSeleccionado) {
      imagen = await subirImagen();
      archivoSeleccionado = null;
    }

    const datos = { nombre, valor, categoria_id, descripcion,
                    recomendacion, beneficios, activo, imagen,
                    vendedor_id: vendedor.id };
    if (id) {
      await actualizarProducto(id, datos);
      mostrarOk("Producto actualizado correctamente.");
    } else {
      await crearProducto(datos);
      mostrarOk("Producto creado correctamente.");
    }
    // FIX: pasar auth.currentUser para que cargar() funcione
    await cargar(auth.currentUser);
    setTimeout(() => cerrarModal("modalOverlay"), 1200);
  } catch (e) {
    mostrarError("Error al guardar: " + e.message);
    console.error(e);
  } finally {
    btnCargando(btn, false);
  }
});

// ── Eliminar ──────────────────────────────────────────────
function abrirEliminar(id, nombre) {
  idEliminar = id;
  el("nombreEliminar").textContent = nombre;
  abrirModal("modalEliminar");
}
el("btnConfirmarEliminar").addEventListener("click", async () => {
  const btn = el("btnConfirmarEliminar");
  btnCargando(btn, true);
  try {
    await eliminarProducto(idEliminar);
    cerrarModal("modalEliminar");
    // FIX: pasar auth.currentUser para que cargar() funcione
    await cargar(auth.currentUser);
  } catch (e) { console.error(e); }
  finally { btnCargando(btn, false); }
});

// ── Cerrar modales ────────────────────────────────────────
el("btnCancelar").addEventListener("click", () => cerrarModal("modalOverlay"));
el("btnCancelarEliminar").addEventListener("click", () => cerrarModal("modalEliminar"));
el("modalOverlay").addEventListener("click", e => {
  if (e.target === el("modalOverlay")) cerrarModal("modalOverlay");
});

// ── Helpers ───────────────────────────────────────────────
function limpiarModal() {
  ["fNombre","fValor","fDescripcion","fRecomendacion","fBeneficios"].forEach(id => {
    el(id).value = "";
  });
  el("fActivo").value = "true";
  el("fImagen").value = "";
  archivoSeleccionado = null;
  previstaDiv.style.display = "none";
  resetZonaTexto();
}
function ocultarMensajes() {
  el("msgError").classList.remove("visible");
  el("msgOk").classList.remove("visible");
}
function mostrarError(msg) {
  el("textoError").textContent = msg;
  el("msgError").classList.add("visible");
  el("msgOk").classList.remove("visible");
}
function mostrarOk(msg) {
  el("textoOk").textContent = msg;
  el("msgOk").classList.add("visible");
  el("msgError").classList.remove("visible");
}

// FIX: inicializar fechaHoy y btnSalir DENTRO del onAuthStateChanged
// para garantizar que el DOM esté listo y el usuario autenticado
onAuthStateChanged(auth, (user) => {
  if (!user) return;

  // Setear fecha y botón salir de forma segura
  if (el("fechaHoy")) el("fechaHoy").textContent = fechaHoy();
  if (el("btnSalir")) {
    el("btnSalir").addEventListener("click", async () => {
      await cerrarSesion();
      window.location.href = "../index.html";
    });
  }

  cargar(user);
});