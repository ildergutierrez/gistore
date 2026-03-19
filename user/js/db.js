// ============================================================
//  user/js/db.js — Operaciones Firestore del portal vendedor
//  Versión: 2026-03-14
//
//  Colecciones que consume:
//    · vendedores       — perfil y datos del vendedor
//    · membresias       — historial de membresías
//    · planes_membresia — catálogo de planes con precios dinámicos
//    · fundadores       — vendedores con beneficio de precio especial
//    · categorias       — categorías de productos
//    · productos        — productos del vendedor
// ============================================================

import { db } from "./firebase.js";
import {
  collection, doc,
  getDocs, addDoc, updateDoc, deleteDoc,
  query, where, orderBy, limit,
} from "https://www.gstatic.com/firebasejs/12.10.0/firebase-firestore.js";

// ════════════════════════════════════════════════════════════
//  VENDEDORES
// ════════════════════════════════════════════════════════════

/**
 * Obtiene el perfil del vendedor cuyo campo uid_auth coincide con el UID
 * de Firebase Auth. El ID del documento NO es el uid de Auth.
 * @param {string} uid — UID de Firebase Authentication
 * @returns {Promise<object|null>}
 */
async function obtenerVendedorPorUid(uid) {
  const q    = query(collection(db, "vendedores"), where("uid_auth", "==", uid));
  const snap = await getDocs(q);
  if (snap.empty) return null;
  const d = snap.docs[0];
  return { id: d.id, ...d.data() };
}

/**
 * Actualiza los datos del perfil del vendedor.
 * @param {string} id     — ID del documento en "vendedores"
 * @param {object} datos  — campos a actualizar
 *
 * Campos soportados (todos opcionales en cada llamada):
 *   nombre       string  — nombre del vendedor / tienda
 *   ciudad       string  — ciudad de operación
 *   whatsapp     string  — número con código país, ej: 573145891108
 *   url_web      string  — URL de página web personal (https://…)
 *   descripcion  string  — descripción pública de la tienda (máx 300 chars)
 *   perfil       string  — URL de foto de perfil (Cloudinary)
 *   color        string  — color de marca en hex
 *
 * Redes sociales (subcolección "redes_sociales" en el documento del vendedor,
 * o bien almacenadas en el propio documento bajo el objeto "redes"):
 *   redes.facebook   string  — URL completa https://facebook.com/…
 *   redes.tiktok     string  — URL completa https://tiktok.com/@…
 *   redes.instagram  string  — URL completa https://instagram.com/…
 *   redes.youtube    string  — URL completa https://youtube.com/…
 *
 * Diseño: se guardan como un objeto anidado "redes" dentro del documento
 * "vendedores" para evitar crear una colección extra y simplificar las
 * consultas. Firestore permite actualizaciones parciales con dot-notation.
 */
async function actualizarVendedor(id, datos) {
  await updateDoc(doc(db, "vendedores", id), {
    ...datos,
    actualizado_en: new Date().toISOString(),
  });
}

// ════════════════════════════════════════════════════════════
//  MEMBRESÍAS
// ════════════════════════════════════════════════════════════

/**
 * Obtiene la membresía más reciente del vendedor (activa o no).
 * @param {string} vendedor_id — ID del documento del vendedor
 * @returns {Promise<object|null>}
 */
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
    // Fallback si el índice compuesto aún no existe en Firestore
    const q2   = query(collection(db, "membresias"), where("vendedor_id", "==", vendedor_id));
    const snap = await getDocs(q2);
    if (snap.empty) return null;
    const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    docs.sort((a, b) => (b.fecha_fin || "").localeCompare(a.fecha_fin || ""));
    return docs[0];
  }
}

/**
 * Evalúa si la membresía está vigente hoy.
 * @param {object|null} m — documento de membresía
 * @returns {boolean}
 */
function membresiaVigente(m) {
  if (!m || m.estado !== "activa") return false;
  return m.fecha_fin >= new Date().toISOString().split("T")[0];
}

// ════════════════════════════════════════════════════════════
//  PLANES DE MEMBRESÍA (DINÁMICOS DESDE FIRESTORE)
// ════════════════════════════════════════════════════════════

/**
 * Obtiene los planes de pago disponibles desde la colección "planes_membresia".
 *
 * Estructura esperada de cada documento:
 *   nombre:        string  — ej: "Plan Estándar"
 *   descripcion:   string  — descripción breve del plan
 *   precio:        number  — en COP (no en centavos), ej: 25000
 *   duracion_dias: number  — ej: 30
 *   activo:        boolean — solo se muestran los que tengan activo: true
 *   orden:         number  — posición en la lista (1 = primero)
 *
 * Para cambiar un precio basta con editar el campo "precio" en Firestore.
 * @returns {Promise<Array>}
 */
async function obtenerPlanes() {
  try {
    const q    = query(collection(db, "planes_membresia"), orderBy("orden"));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch {
    // Fallback sin índice del campo "orden"
    const snap = await getDocs(collection(db, "planes_membresia"));
    const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    docs.sort((a, b) => (a.orden ?? 99) - (b.orden ?? 99));
    return docs;
  }
}

// ════════════════════════════════════════════════════════════
//  FUNDADORES
// ════════════════════════════════════════════════════════════

/**
 * Determina si un vendedor tiene el beneficio de "Fundador" vigente.
 * El beneficio dura 1 año desde la fecha de registro en la colección "fundadores".
 *
 * @param {string} vendedor_id
 * @returns {Promise<{esFundador: boolean, fechaVence: string|null, fechaRegistro: string|null}>}
 */
async function esFundadorVigente(vendedor_id) {
  try {
    const q    = query(collection(db, "fundadores"), where("vendedor_id", "==", vendedor_id));
    const snap = await getDocs(q);

    if (snap.empty) return { esFundador: false, fechaVence: null };

    const datos = snap.docs[0].data();
    if (!datos.fecha_registro) return { esFundador: false, fechaVence: null };

    const fechaVence = new Date(datos.fecha_registro);
    fechaVence.setFullYear(fechaVence.getFullYear() + 1);
    const vigente = new Date() < fechaVence;

    return {
      esFundador:    vigente,
      fechaVence:    fechaVence.toISOString().split("T")[0],
      fechaRegistro: datos.fecha_registro,
    };
  } catch {
    return { esFundador: false, fechaVence: null };
  }
}

// ════════════════════════════════════════════════════════════
//  CATEGORÍAS
// ════════════════════════════════════════════════════════════

/**
 * Obtiene todas las categorías ordenadas por el campo "orden".
 * @returns {Promise<Array>}
 */
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

// ════════════════════════════════════════════════════════════
//  PRODUCTOS
// ════════════════════════════════════════════════════════════

/**
 * Obtiene todos los productos del vendedor (activos e inactivos).
 * @param {string} vendedor_id
 * @returns {Promise<Array>}
 */
async function obtenerMisProductos(vendedor_id) {
  const q    = query(collection(db, "productos"), where("vendedor_id", "==", vendedor_id));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

/** Crea un nuevo producto en Firestore. */
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

/** Actualiza los campos de un producto existente. */
async function actualizarProducto(id, datos) {
  await updateDoc(doc(db, "productos", id), {
    ...datos,
    actualizado_en: new Date().toISOString(),
  });
}

/** Elimina permanentemente un producto. */
async function eliminarProducto(id) {
  await deleteDoc(doc(db, "productos", id));
}

/**
 * Desactiva todos los productos de un vendedor (ej: al vencer la membresía).
 * @returns {Promise<number>} — cantidad de productos afectados
 */
async function desactivarProductosVendedor(vendedor_id) {
  const q    = query(collection(db, "productos"), where("vendedor_id", "==", vendedor_id));
  const snap = await getDocs(q);
  await Promise.all(snap.docs.map(d =>
    updateDoc(doc(db, "productos", d.id), {
      activo:         false,
      actualizado_en: new Date().toISOString(),
    })
  ));
  return snap.docs.length;
}

/**
 * Reactiva todos los productos de un vendedor (ej: al renovar la membresía).
 * @returns {Promise<number>} — cantidad de productos afectados
 */
async function reactivarProductosVendedor(vendedor_id) {
  const q    = query(collection(db, "productos"), where("vendedor_id", "==", vendedor_id));
  const snap = await getDocs(q);
  await Promise.all(snap.docs.map(d =>
    updateDoc(doc(db, "productos", d.id), {
      activo:         true,
      actualizado_en: new Date().toISOString(),
    })
  ));
  return snap.docs.length;
}

// ════════════════════════════════════════════════════════════
//  EXPORTACIONES
// ════════════════════════════════════════════════════════════

export {
  // Vendedor
  obtenerVendedorPorUid,
  actualizarVendedor,
  // Membresía
  obtenerMembresiaVendedor,
  membresiaVigente,
  // Planes de pago (dinámicos desde Firestore)
  obtenerPlanes,
  // Fundadores
  esFundadorVigente,
  // Categorías
  obtenerCategorias,
  // Productos
  obtenerMisProductos,
  crearProducto,
  actualizarProducto,
  eliminarProducto,
  desactivarProductosVendedor,
  reactivarProductosVendedor,
};