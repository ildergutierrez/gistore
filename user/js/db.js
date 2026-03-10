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

// ── Actualizar vendedor (para perfil) ─────────────────────
async function actualizarVendedor(id, datos) {
  await updateDoc(doc(db, "vendedores", id), {
    ...datos,
    actualizado_en: new Date().toISOString(),
  });
}

// ── Obtener membresía del vendedor ────────────────────────
// Nota: requiere índice en Firestore: vendedor_id ASC + fecha_fin DESC
// Si falla, usar la versión sin orderBy
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
  } catch (e) {
    // Fallback sin orderBy si no existe el índice compuesto
    const q2   = query(collection(db, "membresias"), where("vendedor_id", "==", vendedor_id));
    const snap = await getDocs(q2);
    if (snap.empty) return null;
    // Ordenar manualmente por fecha_fin desc
    const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    docs.sort((a, b) => (b.fecha_fin || "").localeCompare(a.fecha_fin || ""));
    return docs[0];
  }
}

// ── Obtener categorías ────────────────────────────────────
async function obtenerCategorias() {
  try {
    const q    = query(collection(db, "categorias"), orderBy("orden"));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch (e) {
    const snap = await getDocs(collection(db, "categorias"));
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  }
}

// ── Obtener productos del vendedor ────────────────────────
async function obtenerMisProductos(vendedor_id) {
  const q    = query(collection(db, "productos"), where("vendedor_id", "==", vendedor_id));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

// ── Crear producto ────────────────────────────────────────
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

// ── Actualizar producto ───────────────────────────────────
async function actualizarProducto(id, datos) {
  await updateDoc(doc(db, "productos", id), {
    ...datos,
    actualizado_en: new Date().toISOString(),
  });
}

// ── Eliminar producto ─────────────────────────────────────
async function eliminarProducto(id) {
  await deleteDoc(doc(db, "productos", id));
}

// ── Desactivar todos los productos de un vendedor ─────────
async function desactivarProductosVendedor(vendedor_id) {
  const q    = query(collection(db, "productos"), where("vendedor_id", "==", vendedor_id));
  const snap = await getDocs(q);
  const promesas = snap.docs.map(d =>
    updateDoc(doc(db, "productos", d.id), {
      activo: false,
      actualizado_en: new Date().toISOString(),
    })
  );
  await Promise.all(promesas);
  return snap.docs.length; // retorna cuántos se desactivaron
}

// ── Reactivar todos los productos de un vendedor ───────────
async function reactivarProductosVendedor(vendedor_id) {
  const q    = query(collection(db, "productos"), where("vendedor_id", "==", vendedor_id));
  const snap = await getDocs(q);
  const promesas = snap.docs.map(d =>
    updateDoc(doc(db, "productos", d.id), {
      activo: true,
      actualizado_en: new Date().toISOString(),
    })
  );
  await Promise.all(promesas);
  return snap.docs.length;
}

// ── Membresía vigente ─────────────────────────────────────
function membresiaVigente(m) {
  if (!m || m.estado !== "activa") return false;
  return m.fecha_fin >= new Date().toISOString().split("T")[0];
}

export {
  obtenerVendedorPorUid,
  actualizarVendedor,
  desactivarProductosVendedor,
  reactivarProductosVendedor,
  obtenerMembresiaVendedor,
  obtenerCategorias,
  obtenerMisProductos,
  crearProducto,
  actualizarProducto,
  eliminarProducto,
  membresiaVigente,
};
// (este bloque se agrega al final — no reemplaza el archivo)