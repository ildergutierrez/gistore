// ============================================================
//  FIREBASE — Configuración e inicialización
//  GIStore · gistore-571b7 · SDK 12.10.0
// ============================================================
import { initializeApp }
  from "https://www.gstatic.com/firebasejs/12.10.0/firebase-app.js";
import {
  getFirestore, collection, doc,
  getDoc, getDocs, addDoc, updateDoc, deleteDoc,
  query, where, orderBy
} from "https://www.gstatic.com/firebasejs/12.10.0/firebase-firestore.js";
import {
  getAuth,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.10.0/firebase-auth.js";

// ── Configuración ──────────────────────────────────────────
const firebaseConfig = {
  apiKey:            "AIzaSyBymhSaKbs1o0fVvif5hs6Qd-ZAt2Y7Oa0",
  authDomain:        "gistore-571b7.firebaseapp.com",
  projectId:         "gistore-571b7",
  storageBucket:     "gistore-571b7.firebasestorage.app",
  messagingSenderId: "220432592098",
  appId:             "1:220432592098:web:cfc218555464a56b2842bb"
};

const app  = initializeApp(firebaseConfig);
const db   = getFirestore(app);
const auth = getAuth(app);

// ══════════════════════════════════════════════════════════
//  AUTH
// ══════════════════════════════════════════════════════════
async function iniciarSesion(correo, contrasena) {
  const cred = await signInWithEmailAndPassword(auth, correo, contrasena);
  return cred.user;
}
async function cerrarSesion() { await signOut(auth); }
function escucharSesion(cb)   { onAuthStateChanged(auth, cb); }

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
    nombre:    datos.nombre   || "",
    ciudad:    datos.ciudad   || "",
    correo:    datos.correo   || "",
    whatsapp:  datos.whatsapp || "",
    color:     datos.color    || "#1a6b3c",
    estado:    datos.estado   || "inactivo",
    uid_auth:  datos.uid_auth || "",
    creado_en: new Date().toISOString(),
  });
  return ref.id;
}
async function actualizarVendedor(id, datos) {
  await updateDoc(doc(db, "vendedores", id),
    { ...datos, actualizado_en: new Date().toISOString() });
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
  await actualizarVendedor(datos.vendedor_id, { estado: "activo" });
  return ref.id;
}
async function actualizarMembresia(id, datos) {
  await updateDoc(doc(db, "membresias", id),
    { ...datos, actualizado_en: new Date().toISOString() });
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
  const ref = await addDoc(collection(db, "categorias"),
    { nombre: datos.nombre || "", orden: datos.orden || 0 });
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
async function obtenerProductosActivos() {
  const q = query(
    collection(db, "productos"),
    where("activo", "==", true),
    orderBy("nombre")
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}
async function obtenerProductos() {
  const snap = await getDocs(collection(db, "productos"));
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
    valor:         datos.valor         || 0,
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
  await updateDoc(doc(db, "productos", id),
    { ...datos, actualizado_en: new Date().toISOString() });
}
async function eliminarProducto(id) {
  await deleteDoc(doc(db, "productos", id));
}

// ── Utilidad: verificar membresía vigente ──────────────────
function membresiaVigente(m) {
  if (!m || m.estado !== "activa") return false;
  return m.fecha_fin >= new Date().toISOString().split("T")[0];
}

// ── Exportar todo ──────────────────────────────────────────
export {
  db, auth,
  // Auth
  iniciarSesion, cerrarSesion, escucharSesion,
  // Vendedores
  obtenerVendedores, obtenerVendedor,
  crearVendedor, actualizarVendedor, eliminarVendedor,
  // Membresías
  obtenerMembresias, obtenerMembresia,
  crearMembresia, actualizarMembresia,
  // Categorías
  obtenerCategorias, crearCategoria,
  actualizarCategoria, eliminarCategoria,
  // Productos
  obtenerProductosActivos, obtenerProductos,
  obtenerProductosPorVendedor, obtenerProducto,
  crearProducto, actualizarProducto, eliminarProducto,
  // Utilidades
  membresiaVigente,
};