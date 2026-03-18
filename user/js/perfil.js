// ============================================================
//  perfil.js — Perfil del vendedor
//  Foto: Cloudinary carpeta "user" → guarda URL en vendedores.perfil
//  Descripción: guarda en vendedores.descripcion
// ============================================================
import { cerrarSesion } from "./auth.js";
import { obtenerVendedorPorUid, actualizarVendedor,
         obtenerMembresiaVendedor, membresiaVigente } from "./db.js";
import { fechaHoy, btnCargando } from "./ui.js";
import { auth } from "./firebase.js";
import { onAuthStateChanged, updatePassword,
         reauthenticateWithCredential, EmailAuthProvider }
  from "https://www.gstatic.com/firebasejs/12.10.0/firebase-auth.js";

document.body.style.visibility = "hidden";

function el(id) { return document.getElementById(id); }

// ── Cloudinary ────────────────────────────────────────────
const CLOUD_NAME    = "dqmrgerue";
const UPLOAD_PRESET = "gi-store-user";
const FOTO_FOLDER   = "user";

// ── Estado ────────────────────────────────────────────────
let vendedor    = null;
let archivoFoto = null;

// ── Ver/ocultar contraseñas ───────────────────────────────
[["btnVerPassActual","fPassActual"],
 ["btnVerPassNueva", "fNewPass"],
 ["btnVerPassConf",  "fConfPass"]].forEach(([b, i]) => {
  const btn = el(b); const inp = el(i);
  if (!btn || !inp) return;
  btn.addEventListener("click", () => {
    if (inp.type === "password") { inp.type = "text";     btn.textContent = "🙈"; }
    else                         { inp.type = "password"; btn.textContent = "👁"; }
  });
});

// ── Render avatar ─────────────────────────────────────────
function renderAvatar(fotoUrl, nombre, color) {
  const wrap = el("avatarWrap");
  if (!wrap) return;
  if (fotoUrl) {
    wrap.innerHTML = "";
    wrap.className = "avatar-foto";
    wrap.style.background = "";
    const img = document.createElement("img");
    img.src   = fotoUrl;
    img.alt   = nombre || "Foto";
    img.style.cssText = "width:100%;height:100%;object-fit:cover;display:block;border-radius:50%";
    img.onerror = () => renderAvatar("", nombre, color);
    wrap.appendChild(img);
    const btnElim = el("btnEliminarFoto");
    if (btnElim) btnElim.style.display = "inline-flex";
  } else {
    wrap.className   = "avatar-inicial";
    wrap.innerHTML   = "";
    wrap.textContent = (nombre || "V")[0].toUpperCase();
    wrap.style.background = color || "var(--verde)";
    const btnElim = el("btnEliminarFoto");
    if (btnElim) btnElim.style.display = "none";
  }
}

// ── Contador caracteres descripción ──────────────────────
function actualizarContador() {
  const txt     = el("fDescripcion");
  const contador = el("descContador");
  if (!txt || !contador) return;
  const restantes = 300 - txt.value.length;
  contador.textContent = restantes + " caracteres restantes";
  contador.style.color = restantes < 30 ? "var(--error)" : "var(--texto-suave)";
}

// ── Auth + carga de datos ─────────────────────────────────
onAuthStateChanged(auth, async (user) => {
  if (!user) { window.location.href = "../index.html"; return; }
  document.body.style.visibility = "visible";
  if (el("fechaHoy")) el("fechaHoy").textContent = fechaHoy();
  if (el("btnSalir")) {
    el("btnSalir").addEventListener("click", async () => {
      await cerrarSesion(); window.location.href = "../index.html";
    });
  }

  try {
    vendedor = await obtenerVendedorPorUid(user.uid);
    if (!vendedor) {
      if (el("fNombre")) el("fNombre").placeholder = "Perfil no encontrado — contacta al admin";
      return;
    }

    // Llenar campos
    if (el("vendedorNombre")) el("vendedorNombre").textContent = vendedor.nombre || "";
    if (el("fNombre"))       el("fNombre").value       = vendedor.nombre      || "";
    if (el("fCiudad"))       el("fCiudad").value       = vendedor.ciudad      || "";
    if (el("fWhatsapp"))     el("fWhatsapp").value     = vendedor.whatsapp    || "";
    if (el("fCorreo"))       el("fCorreo").value       = vendedor.correo      || user.email || "";
    if (el("fUrlWeb"))       el("fUrlWeb").value       = vendedor.url_web     || "";
    if (el("fDescripcion"))  el("fDescripcion").value  = vendedor.descripcion || "";
    actualizarContador();

    // Avatar
    renderAvatar(vendedor.perfil || "", vendedor.nombre, vendedor.color);

    // Estado
    const elEstado = el("infoEstado");
    if (elEstado) {
      elEstado.textContent = vendedor.estado === "activo" ? "Activo" : "Inactivo";
      elEstado.className   = "badge badge-" + (vendedor.estado === "activo" ? "activo" : "inactivo");
    }
    if (el("infoCreadoEn")) el("infoCreadoEn").textContent = vendedor.creado_en
      ? new Date(vendedor.creado_en).toLocaleDateString("es-CO") : "—";

    // Membresía
    const mem   = await obtenerMembresiaVendedor(vendedor.id);
    const elMem = el("infoMembresia");
    if (elMem) {
      if (!mem) {
        elMem.textContent = "Sin membresía"; elMem.style.color = "var(--error)";
      } else if (!membresiaVigente(mem)) {
        elMem.textContent = "Vencida (" + mem.fecha_fin + ")"; elMem.style.color = "var(--error)";
      } else {
        const dias = Math.ceil((new Date(mem.fecha_fin) - new Date()) / (1000*60*60*24));
        elMem.textContent = "Activa · " + dias + " días restantes"; elMem.style.color = "var(--verde)";
      }
    }
  } catch (e) { console.error("Error cargando perfil:", e); }
});

// ── Contador en tiempo real ───────────────────────────────
el("fDescripcion")?.addEventListener("input", actualizarContador);

// ── Seleccionar foto ──────────────────────────────────────
el("btnCambiarFoto")?.addEventListener("click", () => el("fFotoFile")?.click());

el("fFotoFile")?.addEventListener("change", () => {
  const file = el("fFotoFile").files[0];
  if (!file) return;
  if (file.size > 2 * 1024 * 1024) {
    alert("La imagen no puede superar 2 MB."); el("fFotoFile").value = ""; return;
  }
  archivoFoto = file;
  const reader = new FileReader();
  reader.onload = e => {
    const prev = el("fotoPreviewImg");
    const wrap = el("fotoPreviewWrap");
    const est  = el("fotoEstado");
    if (prev) prev.src           = e.target.result;
    if (wrap) wrap.style.display = "flex";
    if (est)  est.textContent    = "Lista para subir · " + (file.size/1024).toFixed(0) + " KB";
    const btnS = el("btnSubirFoto");
    if (btnS) btnS.style.display = "inline-flex";
  };
  reader.readAsDataURL(file);
});

// ── Quitar preview ────────────────────────────────────────
el("btnQuitarPreview")?.addEventListener("click", () => {
  archivoFoto = null;
  if (el("fFotoFile"))       el("fFotoFile").value = "";
  if (el("fotoPreviewWrap")) el("fotoPreviewWrap").style.display = "none";
  if (el("btnSubirFoto"))    el("btnSubirFoto").style.display    = "none";
});

// ── Subir foto ────────────────────────────────────────────
el("btnSubirFoto")?.addEventListener("click", async () => {
  if (!archivoFoto || !vendedor) return;
  const btn = el("btnSubirFoto");
  const est = el("fotoEstado");
  btnCargando(btn, true);
  if (est) { est.textContent = "Subiendo..."; est.style.color = "var(--advertencia)"; }
  try {
    const url = await subirCloudinary(archivoFoto);
    await actualizarVendedor(vendedor.id, { perfil: url });
    vendedor.perfil = url;
    renderAvatar(url, vendedor.nombre, vendedor.color);
    if (el("fotoPreviewWrap")) el("fotoPreviewWrap").style.display = "none";
    if (el("btnSubirFoto"))    el("btnSubirFoto").style.display    = "none";
    if (est) { est.textContent = "✓ Foto guardada"; est.style.color = "var(--ok,green)"; }
    archivoFoto = null;
    if (el("fFotoFile")) el("fFotoFile").value = "";
  } catch (e) {
    if (est) { est.textContent = "✗ " + e.message; est.style.color = "var(--error)"; }
    console.error(e);
  } finally { btnCargando(btn, false); }
});

// ── Eliminar foto ─────────────────────────────────────────
el("btnEliminarFoto")?.addEventListener("click", async () => {
  if (!vendedor) return;
  if (!confirm("¿Eliminar foto de perfil? Se usará tu inicial como avatar.")) return;
  const btn = el("btnEliminarFoto");
  btnCargando(btn, true);
  try {
    await actualizarVendedor(vendedor.id, { perfil: "" });
    vendedor.perfil = "";
    renderAvatar("", vendedor.nombre, vendedor.color);
    const est = el("fotoEstado");
    if (est) { est.textContent = "Foto eliminada"; est.style.color = "var(--texto-suave)"; }
  } catch (e) { console.error(e); alert("Error al eliminar foto."); }
  finally { btnCargando(btn, false); }
});

// ── Cloudinary upload ─────────────────────────────────────
async function subirCloudinary(file) {
  const fd = new FormData();
  fd.append("file",          file);
  fd.append("upload_preset", UPLOAD_PRESET);
  fd.append("folder",        FOTO_FOLDER);
  const res  = await fetch(
    "https://api.cloudinary.com/v1_1/" + CLOUD_NAME + "/image/upload",
    { method: "POST", body: fd }
  );
  const data = await res.json();
  if (!res.ok) throw new Error(data.error?.message || "Error Cloudinary");
  return data.secure_url;
}

// ── Guardar datos del perfil ──────────────────────────────
el("btnGuardarPerfil")?.addEventListener("click", async () => {
  if (!vendedor) { mostrarError("Perfil no cargado. Recarga la página."); return; }
  const nombre      = el("fNombre")?.value.trim()      || "";
  const ciudad      = el("fCiudad")?.value.trim()      || "";
  const whatsapp    = el("fWhatsapp")?.value.trim()    || "";
  const urlWeb      = el("fUrlWeb")?.value.trim()      || "";
  const descripcion = el("fDescripcion")?.value.trim() || "";

  if (!nombre) { mostrarError("El nombre es obligatorio."); return; }
  if (descripcion.length > 300) { mostrarError("La descripción no puede superar 300 caracteres."); return; }

  // Validar URL si se ingresó
  if (urlWeb) {
    try {
      const u = new URL(urlWeb);
      if (!["http:", "https:"].includes(u.protocol)) throw new Error();
    } catch {
      mostrarError("La URL de la página web no es válida. Debe iniciar con https:// o http://");
      return;
    }
  }

  const btn = el("btnGuardarPerfil");
  btnCargando(btn, true); ocultarMensajes();
  try {
    await actualizarVendedor(vendedor.id, { nombre, ciudad, whatsapp, url_web: urlWeb, descripcion });
    vendedor.nombre      = nombre;
    vendedor.descripcion = descripcion;
    vendedor.url_web     = urlWeb;
    if (el("vendedorNombre")) el("vendedorNombre").textContent = nombre;
    if (!vendedor.perfil) renderAvatar("", nombre, vendedor.color);
    mostrarOk("✓ Datos actualizados correctamente.");
  } catch (e) { mostrarError("Error al guardar. Intenta de nuevo."); console.error(e); }
  finally { btnCargando(btn, false); }
});

// ── Cambiar contraseña ────────────────────────────────────
el("btnCambiarPass")?.addEventListener("click", async () => {
  const passActual = el("fPassActual")?.value || "";
  const newPass    = el("fNewPass")?.value    || "";
  const confPass   = el("fConfPass")?.value   || "";
  el("msgErrorPass")?.classList.remove("visible");
  el("msgOkPass")?.classList.remove("visible");
  if (!passActual)           { setErrorPass("Ingresa tu contraseña actual."); return; }
  if (newPass.length < 6)    { setErrorPass("La nueva contraseña debe tener al menos 6 caracteres."); return; }
  if (newPass !== confPass)  { setErrorPass("Las contraseñas nuevas no coinciden."); return; }
  if (passActual === newPass){ setErrorPass("La nueva contraseña debe ser diferente a la actual."); return; }
  const btn = el("btnCambiarPass");
  btnCargando(btn, true);
  try {
    const user       = auth.currentUser;
    const credential = EmailAuthProvider.credential(user.email, passActual);
    await reauthenticateWithCredential(user, credential);
    await updatePassword(user, newPass);
    if (el("textoOkPass")) el("textoOkPass").textContent = "✓ Contraseña actualizada correctamente.";
    el("msgOkPass")?.classList.add("visible");
    ["fPassActual","fNewPass","fConfPass"].forEach(id => {
      if (el(id)) { el(id).value = ""; el(id).type = "password"; }
    });
    ["btnVerPassActual","btnVerPassNueva","btnVerPassConf"].forEach(id => {
      if (el(id)) el(id).textContent = "👁";
    });
  } catch (e) {
    const err = {
      "auth/wrong-password":        "Contraseña actual incorrecta.",
      "auth/invalid-credential":    "Contraseña actual incorrecta.",
      "auth/weak-password":         "La nueva contraseña es muy débil.",
      "auth/requires-recent-login": "Sesión expirada. Cierra sesión y vuelve a ingresar.",
    };
    setErrorPass(err[e.code] || "Error: " + e.message); console.error(e);
  } finally { btnCargando(btn, false); }
});

// ── Helpers ───────────────────────────────────────────────
function setErrorPass(msg) {
  if (el("textoErrorPass")) el("textoErrorPass").textContent = msg;
  el("msgErrorPass")?.classList.add("visible");
}
function ocultarMensajes() {
  el("msgError")?.classList.remove("visible");
  el("msgOk")?.classList.remove("visible");
}
function mostrarError(msg) {
  if (el("textoError")) el("textoError").textContent = msg;
  el("msgError")?.classList.add("visible");
  el("msgOk")?.classList.remove("visible");
}
function mostrarOk(msg) {
  if (el("textoOk")) el("textoOk").textContent = msg;
  el("msgOk")?.classList.add("visible");
  el("msgError")?.classList.remove("visible");
}