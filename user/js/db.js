// ============================================================
//  db.js — Operaciones Firestore para el portal de vendedores
// ============================================================
import { db } from "./firebase.js";
import {
  collection, doc,
  getDocs, addDoc, updateDoc, deleteDoc,
  query, where, orderBy, limit
} from "https://www.gstatic.com/firebasejs/12.10.0/firebase-firestore.js";

// ── Obtener vendedor por uid_auth ─────────────────────────
async function obtenerVendedorPorUid(uid) {
  const q    = query(collection(db, "vendedores"), where("uid_auth", "==", uid));
  const snap = await getDocs(q);
  if (snap.empty) return null;
  const d = snap.docs[0];
  return { id: d.id, ...d.data() };
}

// ── Actualizar vendedor (perfil) ──────────────────────────
async function actualizarVendedor(id, datos) {
  await updateDoc(doc(db, "vendedores", id), {
    ...datos,
    actualizado_en: new Date().toISOString(),
  });
}

// ── Membresía del vendedor ────────────────────────────────
async function obtenerMembresiaVendedor(vendedor_id) {
  try {
    const q = query(
      collection(db, "membresias"),
      where("vendedor_id", "==", vendedor_id),
      orderBy("fecha_fin", "desc"),
      limit(1)
    );
    const snap = await getDocs(q);
    if (snap.empty) return null;
    const d = snap.docs[0];
    return { id: d.id, ...d.data() };
  } catch {
    // Fallback sin índice compuesto
    const q2   = query(collection(db, "membresias"), where("vendedor_id", "==", vendedor_id));
    const snap = await getDocs(q2);
    if (snap.empty) return null;
    const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    docs.sort((a, b) => (b.fecha_fin || "").localeCompare(a.fecha_fin || ""));
    return docs[0];
  }
}

// ── ¿Es fundador vigente? ─────────────────────────────────
// Devuelve { esFundador: bool, fechaVence: string|null }
async function esFundadorVigente(vendedor_id) {
  try {
    const q    = query(collection(db, "fundadores"), where("vendedor_id", "==", vendedor_id));
    const snap = await getDocs(q);
    if (snap.empty) return { esFundador: false, fechaVence: null };
    const f = snap.docs[0].data();
    if (!f.fecha_registro) return { esFundador: false, fechaVence: null };
    const fechaVence = new Date(f.fecha_registro);
    fechaVence.setFullYear(fechaVence.getFullYear() + 1);
    const vigente = new Date() < fechaVence;
    return {
      esFundador: vigente,
      fechaVence: fechaVence.toISOString().split("T")[0],
      fechaRegistro: f.fecha_registro,
    };
  } catch {
    return { esFundador: false, fechaVence: null };
  }
}

// ── Categorías ────────────────────────────────────────────
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

// ── Productos del vendedor ────────────────────────────────
async function obtenerMisProductos(vendedor_id) {
  const q    = query(collection(db, "productos"), where("vendedor_id", "==", vendedor_id));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

// ── CRUD productos ────────────────────────────────────────
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

// ── Desactivar todos los productos de un vendedor ─────────
async function desactivarProductosVendedor(vendedor_id) {
  const q    = query(collection(db, "productos"), where("vendedor_id", "==", vendedor_id));
  const snap = await getDocs(q);
  await Promise.all(snap.docs.map(d =>
    updateDoc(doc(db, "productos", d.id), {
      activo: false,
      actualizado_en: new Date().toISOString(),
    })
  ));
  return snap.docs.length;
}

// ── Reactivar todos los productos de un vendedor ──────────
async function reactivarProductosVendedor(vendedor_id) {
  const q    = query(collection(db, "productos"), where("vendedor_id", "==", vendedor_id));
  const snap = await getDocs(q);
  await Promise.all(snap.docs.map(d =>
    updateDoc(doc(db, "productos", d.id), {
      activo: true,
      actualizado_en: new Date().toISOString(),
    })
  ));
  return snap.docs.length;
}

// ── Planes de membresía (lectura pública) ─────────────────
async function obtenerPlanes() {
  try {
    const q    = query(collection(db, "planes_membresia"), orderBy("orden"));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch {
    // Fallback sin índice
    const snap = await getDocs(collection(db, "planes_membresia"));
    const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    docs.sort((a, b) => (a.orden ?? 99) - (b.orden ?? 99));
    return docs;
  }
}

// ── Membresía vigente ─────────────────────────────────────
function membresiaVigente(m) {
  if (!m || m.estado !== "activa") return false;
  return m.fecha_fin >= new Date().toISOString().split("T")[0];
}

export {
  obtenerVendedorPorUid,
  actualizarVendedor,
  esFundadorVigente,
  desactivarProductosVendedor,
  reactivarProductosVendedor,
  obtenerMembresiaVendedor,
  obtenerCategorias,
  obtenerMisProductos,
  crearProducto,
  actualizarProducto,
  eliminarProducto,
  membresiaVigente,
  obtenerPlanes,
};