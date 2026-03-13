// ============================================================
//  db.js — Operaciones Firestore (CRUD)
//  Colecciones: vendedores, membresias, categorias, productos, fundadores
// ============================================================
import { db } from "./firebase.js";
import {
  collection, doc,
  getDoc, getDocs, addDoc, updateDoc, deleteDoc,
  query, where, orderBy
} from "https://www.gstatic.com/firebasejs/12.10.0/firebase-firestore.js";

// ══════════════════════════════════════════════════════════
//  VENDEDORES
// ══════════════════════════════════════════════════════════
async function obtenerVendedores() {
  const snap = await getDocs(collection(db, "vendedores"));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}
async function obtenerVendedor(id) {
  const snap = await getDoc(doc(db, "vendedores", id));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}
async function crearVendedor(datos) {
  const ref = await addDoc(collection(db, "vendedores"), {
    nombre:         datos.nombre      || "",
    ciudad:         datos.ciudad      || "",
    correo:         datos.correo      || "",
    whatsapp:       datos.whatsapp    || "",
    perfil:         datos.perfil      || "",   // URL de la imagen de perfil
    foto_perfil:    datos.descripcion || "",   // Descripción de la tienda
    color:          datos.color       || "#1a6b3c",
    estado:         datos.estado      || "inactivo",
    uid_auth:       datos.uid_auth    || "",
    creado_en:      new Date().toISOString(),
    actualizado_en: new Date().toISOString(),
  });
  return ref.id;
}
async function actualizarVendedor(id, datos) {
  await updateDoc(doc(db, "vendedores", id), {
    ...datos,
    actualizado_en: new Date().toISOString(),
  });
}
async function eliminarVendedor(id) {
  await deleteDoc(doc(db, "vendedores", id));
}

// ══════════════════════════════════════════════════════════
//  MEMBRESÍAS
// ══════════════════════════════════════════════════════════
async function obtenerMembresias() {
  const snap = await getDocs(collection(db, "membresias"));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}
async function obtenerMembresia(vendedor_id) {
  try {
    const q = query(
      collection(db, "membresias"),
      where("vendedor_id", "==", vendedor_id),
      orderBy("fecha_fin", "desc")
    );
    const snap = await getDocs(q);
    if (snap.empty) return null;
    const d = snap.docs[0];
    return { id: d.id, ...d.data() };
  } catch {
    const q2   = query(collection(db, "membresias"), where("vendedor_id", "==", vendedor_id));
    const snap = await getDocs(q2);
    if (snap.empty) return null;
    const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    docs.sort((a, b) => (b.fecha_fin || "").localeCompare(a.fecha_fin || ""));
    return docs[0];
  }
}
async function crearMembresia(datos) {
  const ref = await addDoc(collection(db, "membresias"), {
    vendedor_id:  datos.vendedor_id  || "",
    fecha_inicio: datos.fecha_inicio || "",
    fecha_fin:    datos.fecha_fin    || "",
    estado:       datos.estado       || "activa",
    notas:        datos.notas        || "",
    creado_en:    new Date().toISOString(),
  });
  const hoy    = new Date().toISOString().split("T")[0];
  const activo = datos.estado === "activa" && (datos.fecha_fin || "") >= hoy;
  await actualizarVendedor(datos.vendedor_id, { estado: activo ? "activo" : "inactivo" });
  await actualizarProductosVendedor(datos.vendedor_id, activo);
  return ref.id;
}
async function actualizarMembresia(id, datos) {
  await updateDoc(doc(db, "membresias", id), {
    ...datos,
    actualizado_en: new Date().toISOString(),
  });
  // Sincronizar productos y estado del vendedor automáticamente
  if (datos.vendedor_id && datos.estado !== undefined) {
    const hoy    = new Date().toISOString().split("T")[0];
    const activo = datos.estado === "activa" && (datos.fecha_fin || "") >= hoy;
    await actualizarProductosVendedor(datos.vendedor_id, activo);
    await actualizarVendedor(datos.vendedor_id, { estado: activo ? "activo" : "inactivo" });
  }
}

// ── Eliminar membresía → desactiva productos automáticamente ──
async function eliminarMembresia(id) {
  const snap = await getDoc(doc(db, "membresias", id));
  if (snap.exists()) {
    const m = snap.data();
    if (m.vendedor_id) {
      await actualizarProductosVendedor(m.vendedor_id, false);
      await actualizarVendedor(m.vendedor_id, { estado: "inactivo" });
    }
  }
  await deleteDoc(doc(db, "membresias", id));
}

// ── Activar/desactivar todos los productos de un vendedor ──
async function actualizarProductosVendedor(vendedor_id, activo) {
  const q    = query(collection(db, "productos"), where("vendedor_id", "==", vendedor_id));
  const snap = await getDocs(q);
  await Promise.all(snap.docs.map(d =>
    updateDoc(doc(db, "productos", d.id), {
      activo,
      actualizado_en: new Date().toISOString(),
    })
  ));
  return snap.docs.length;
}

// ══════════════════════════════════════════════════════════
//  FUNDADORES (los 15 primeros vendedores — plan especial 1 año)
//  Colección: "fundadores"
//  Campos: vendedor_id, fecha_registro (YYYY-MM-DD), creado_en
// ══════════════════════════════════════════════════════════
async function obtenerFundadores() {
  const snap = await getDocs(collection(db, "fundadores"));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

async function esFundadorVigente(vendedor_id) {
  const q    = query(collection(db, "fundadores"), where("vendedor_id", "==", vendedor_id));
  const snap = await getDocs(q);
  if (snap.empty) return false;
  const f = snap.docs[0].data();
  if (!f.fecha_registro) return false;
  // Vigente si no han pasado 365 días desde fecha_registro
  const fechaFin = new Date(f.fecha_registro);
  fechaFin.setFullYear(fechaFin.getFullYear() + 1);
  return new Date() < fechaFin;
}

async function registrarFundador(vendedor_id) {
  const snap = await getDocs(collection(db, "fundadores"));
  if (snap.docs.length >= 15) return { ok: false, razon: "cupo_lleno" };
  const existe = snap.docs.some(d => d.data().vendedor_id === vendedor_id);
  if (existe) return { ok: false, razon: "ya_fundador" };
  await addDoc(collection(db, "fundadores"), {
    vendedor_id,
    fecha_registro: new Date().toISOString().split("T")[0],
    creado_en:      new Date().toISOString(),
  });
  return { ok: true };
}

async function contarFundadores() {
  const snap = await getDocs(collection(db, "fundadores"));
  return snap.docs.length;
}

// ══════════════════════════════════════════════════════════
//  CATEGORÍAS
// ══════════════════════════════════════════════════════════
async function obtenerCategorias() {
  try {
    const q    = query(collection(db, "categorias"), orderBy("orden"));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch {
    const snap = await getDocs(collection(db, "categorias"));
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  }
}
async function crearCategoria(datos) {
  const ref = await addDoc(collection(db, "categorias"), {
    nombre: datos.nombre || "",
    orden:  datos.orden  || 0,
  });
  return ref.id;
}
async function actualizarCategoria(id, datos) {
  await updateDoc(doc(db, "categorias", id), datos);
}
async function eliminarCategoria(id) {
  await deleteDoc(doc(db, "categorias", id));
}

// ══════════════════════════════════════════════════════════
//  PRODUCTOS
// ══════════════════════════════════════════════════════════
async function obtenerProductos() {
  const snap = await getDocs(collection(db, "productos"));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}
async function obtenerProductosActivos() {
  try {
    const q    = query(collection(db, "productos"), where("activo", "==", true), orderBy("nombre"));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch {
    const snap = await getDocs(collection(db, "productos"));
    return snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(p => p.activo);
  }
}
async function obtenerProductosPorVendedor(vendedor_id) {
  const q    = query(collection(db, "productos"), where("vendedor_id", "==", vendedor_id));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}
async function obtenerProducto(id) {
  const snap = await getDoc(doc(db, "productos", id));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}
async function crearProducto(datos) {
  const ref = await addDoc(collection(db, "productos"), {
    nombre:        datos.nombre        || "",
    valor:         Number(datos.valor) || 0,
    descripcion:   datos.descripcion   || "",
    recomendacion: datos.recomendacion || "",
    beneficios:    datos.beneficios    || [],
    imagen:        datos.imagen        || "",
    categoria_id:  datos.categoria_id  || "",
    vendedor_id:   datos.vendedor_id   || "",
    activo:        datos.activo        ?? true,
    creado_en:     new Date().toISOString(),
  });
  return ref.id;
}
async function actualizarProducto(id, datos) {
  await updateDoc(doc(db, "productos", id), {
    ...datos,
    actualizado_en: new Date().toISOString(),
  });
}
async function eliminarProducto(id) {
  await deleteDoc(doc(db, "productos", id));
}

function membresiaVigente(m) {
  if (!m || m.estado !== "activa") return false;
  return m.fecha_fin >= new Date().toISOString().split("T")[0];
}

export {
  obtenerVendedores, obtenerVendedor,
  crearVendedor, actualizarVendedor, eliminarVendedor,
  obtenerMembresias, obtenerMembresia,
  crearMembresia, actualizarMembresia, eliminarMembresia,
  actualizarProductosVendedor,
  obtenerFundadores, esFundadorVigente,
  registrarFundador, contarFundadores,
  obtenerCategorias, crearCategoria, actualizarCategoria, eliminarCategoria,
  obtenerProductos, obtenerProductosActivos,
  obtenerProductosPorVendedor, obtenerProducto,
  crearProducto, actualizarProducto, eliminarProducto,
  membresiaVigente,
};