// ============================================================
//  db.js — Operaciones Firestore (CRUD)
//  Colecciones: vendedores, membresias, categorias, productos
// ============================================================
import { db } from "./firebase.js";
import {
  collection, doc,
  getDoc, getDocs, addDoc, updateDoc, deleteDoc,
  query, where, orderBy
} from "https://www.gstatic.com/firebasejs/12.10.0/firebase-firestore.js";

// ══════════════════════════════════════════════════════════
//  VENDEDORES
//  Campos: nombre, ciudad, correo, whatsapp, color,
//          estado (activo|inactivo), uid_auth, creado_en
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
    nombre:    datos.nombre    || "",
    ciudad:    datos.ciudad    || "",
    correo:    datos.correo    || "",
    whatsapp:  datos.whatsapp  || "",
    color:     datos.color     || "#1a6b3c",
    estado:    datos.estado    || "inactivo",
    uid_auth:  datos.uid_auth  || "",
    creado_en: new Date().toISOString(),
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
//  Campos: vendedor_id, fecha_inicio, fecha_fin,
//          estado (activa|vencida|suspendida), notas
// ══════════════════════════════════════════════════════════
async function obtenerMembresias() {
  const snap = await getDocs(collection(db, "membresias"));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

async function obtenerMembresia(vendedor_id) {
  const q = query(
    collection(db, "membresias"),
    where("vendedor_id", "==", vendedor_id),
    orderBy("fecha_fin", "desc")
  );
  const snap = await getDocs(q);
  if (snap.empty) return null;
  const d = snap.docs[0];
  return { id: d.id, ...d.data() };
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
  // Activa el vendedor automáticamente
  await actualizarVendedor(datos.vendedor_id, { estado: "activo" });
  // Reactiva todos los productos del vendedor
  if (datos.estado !== "inactiva") {
    await actualizarProductosVendedor(datos.vendedor_id, true);
  }
  return ref.id;
}

async function actualizarMembresia(id, datos) {
  await updateDoc(doc(db, "membresias", id), {
    ...datos,
    actualizado_en: new Date().toISOString(),
  });

  // Si se cambia el estado, actualizar visibilidad de productos del vendedor
  if (datos.vendedor_id && datos.estado !== undefined) {
    const activo = datos.estado === "activa" && datos.fecha_fin >= new Date().toISOString().split("T")[0];
    await actualizarProductosVendedor(datos.vendedor_id, activo);
  }
}

// ── Activar/desactivar todos los productos de un vendedor ─
async function actualizarProductosVendedor(vendedor_id, activo) {
  const q    = query(collection(db, "productos"), where("vendedor_id", "==", vendedor_id));
  const snap = await getDocs(q);
  await Promise.all(snap.docs.map(d =>
    updateDoc(doc(db, "productos", d.id), {
      activo,
      actualizado_en: new Date().toISOString(),
    })
  ));
}

async function eliminarMembresia(id) {
  await deleteDoc(doc(db, "membresias", id));
}

// ══════════════════════════════════════════════════════════
//  CATEGORÍAS
//  Campos: nombre, orden
// ══════════════════════════════════════════════════════════
async function obtenerCategorias() {
  const q    = query(collection(db, "categorias"), orderBy("orden"));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
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
//  Campos: nombre, valor, descripcion, recomendacion,
//          beneficios[], imagen, categoria_id,
//          vendedor_id, activo, creado_en
// ══════════════════════════════════════════════════════════
async function obtenerProductos() {
  const snap = await getDocs(collection(db, "productos"));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

async function obtenerProductosActivos() {
  const q = query(
    collection(db, "productos"),
    where("activo", "==", true),
    orderBy("nombre")
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

async function obtenerProductosPorVendedor(vendedor_id) {
  const q = query(
    collection(db, "productos"),
    where("vendedor_id", "==", vendedor_id)
  );
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

// ── Utilidad ───────────────────────────────────────────────
function membresiaVigente(m) {
  if (!m || m.estado !== "activa") return false;
  return m.fecha_fin >= new Date().toISOString().split("T")[0];
}

export {
  // Vendedores
  obtenerVendedores, obtenerVendedor,
  crearVendedor, actualizarVendedor, eliminarVendedor,
  // Membresías
  obtenerMembresias, obtenerMembresia,
  crearMembresia, actualizarMembresia, eliminarMembresia,
  // Categorías
  obtenerCategorias, crearCategoria,
  actualizarCategoria, eliminarCategoria,
  // Productos
  obtenerProductos, obtenerProductosActivos,
  obtenerProductosPorVendedor, obtenerProducto,
  crearProducto, actualizarProducto, eliminarProducto,
  // Utilidades
  membresiaVigente,
};