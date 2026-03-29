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
  getDocs, getDoc, addDoc, updateDoc, deleteDoc,
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
//  FORO
//  Colecciones:
//    foro_hilos/{id}       — hilos / preguntas
//    foro_respuestas/{id}  — respuestas a hilos
//
//  El vendedor puede:
//    · Crear hilos y respuestas (escritura con auth)
//    · Eliminar sus propias respuestas en cualquier momento
//    · Editar sus respuestas solo si han pasado < 30 minutos
// ════════════════════════════════════════════════════════════

async function obtenerHilosForo() {
  try {
    const q = query(collection(db, "foro_hilos"), orderBy("creado_en", "desc"));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch {
    const snap = await getDocs(collection(db, "foro_hilos"));
    return snap.docs.map(d => ({ id: d.id, ...d.data() }))
      .sort((a, b) => (b.creado_en || "").localeCompare(a.creado_en || ""));
  }
}

async function crearHiloForo(datos) {
  const ref = await addDoc(collection(db, "foro_hilos"), {
    titulo:       datos.titulo       || "",
    cuerpo:       datos.cuerpo       || "",
    autor_id:     datos.autor_id     || "",
    autor_nombre: datos.autor_nombre || "",
    autor_foto:   datos.autor_foto   || "",
    autor_color:  datos.autor_color  || "#1a6b3c",
    respuestas:   0,
    creado_en:    new Date().toISOString(),
  });
  return ref.id;
}

async function obtenerRespuestasForo(hiloId) {
  try {
    const q = query(
      collection(db, "foro_respuestas"),
      where("hilo_id", "==", hiloId),
      orderBy("creado_en", "asc")
    );
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch {
    const snap = await getDocs(
      query(collection(db, "foro_respuestas"), where("hilo_id", "==", hiloId))
    );
    return snap.docs.map(d => ({ id: d.id, ...d.data() }))
      .sort((a, b) => (a.creado_en || "").localeCompare(b.creado_en || ""));
  }
}

async function crearRespuestaForo(datos) {
  // Incrementar contador en el hilo
  const hiloRef  = doc(db, "foro_hilos", datos.hilo_id);
  const hiloSnap = await getDoc(hiloRef);
  if (hiloSnap.exists()) {
    await updateDoc(hiloRef, { respuestas: (hiloSnap.data().respuestas || 0) + 1 });
  }
  const ref = await addDoc(collection(db, "foro_respuestas"), {
    hilo_id:      datos.hilo_id      || "",
    autor_id:     datos.autor_id     || "",
    autor_nombre: datos.autor_nombre || "",
    autor_foto:   datos.autor_foto   || "",
    autor_color:  datos.autor_color  || "#1a6b3c",
    texto:        datos.texto        || "",
    creado_en:    new Date().toISOString(),
  });
  return ref.id;
}

/**
 * Edita una respuesta — solo si han pasado < 30 minutos.
 * La validación de tiempo también debe estar en las reglas Firestore.
 */
async function editarRespuestaForo(respId, nuevoTexto) {
  const snap = await getDoc(doc(db, "foro_respuestas", respId));
  if (!snap.exists()) throw new Error("Respuesta no encontrada.");
  const diffMin = (new Date() - new Date(snap.data().creado_en)) / 1000 / 60;
  if (diffMin > 30) throw new Error("Han pasado más de 30 minutos. No puedes editar esta respuesta.");
  await updateDoc(doc(db, "foro_respuestas", respId), { texto: nuevoTexto });
}

async function eliminarRespuestaForo(respId, hiloId) {
  await deleteDoc(doc(db, "foro_respuestas", respId));
  // Decrementar contador
  const hiloRef  = doc(db, "foro_hilos", hiloId);
  const hiloSnap = await getDoc(hiloRef);
  if (hiloSnap.exists()) {
    await updateDoc(hiloRef, { respuestas: Math.max(0, (hiloSnap.data().respuestas || 0) - 1) });
  }
}

// ════════════════════════════════════════════════════════════
//  CLAVES API (tabla: api_claves)
//
//  Colección: "api_claves"
//  Cada documento tiene:
//    servicio   string  — ej: "openrouter", "cloudinary", "wompi_pub"
//    clave      string  — valor de la clave API
//    activo     boolean — solo se usa si activo: true
//    nota       string  — descripción interna (opcional)
//
//  Las claves NUNCA se almacenan en el código fuente.
//  Primero se obtiene la clave de Firestore, luego se usa.
//  Solo el admin puede escribir en esta colección (reglas).
//  Los vendedores autenticados pueden leer las claves que necesiten.
// ════════════════════════════════════════════════════════════

const _cacheClaves = {};  // cache en memoria para no repetir lecturas

/**
 * Obtiene la clave API de un servicio desde Firestore.
 * Usa caché en memoria durante la sesión para minimizar lecturas.
 *
 * @param {string} servicio — ej: "openrouter"
 * @returns {Promise<string>} — la clave, o lanza error si no existe
 */
async function obtenerClaveApi(servicio) {
  if (_cacheClaves[servicio]) return _cacheClaves[servicio];

  const q    = query(
    collection(db, "api_claves"),
    where("servicio", "==", servicio),
    where("activo",   "==", true)
  );
  const snap = await getDocs(q);
  if (snap.empty) throw new Error(`Clave API "${servicio}" no encontrada o inactiva en Firestore.`);

  const clave = snap.docs[0].data().clave;
  _cacheClaves[servicio] = clave;
  return clave;
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
  // Foro
  obtenerHilosForo,
  crearHiloForo,
  obtenerRespuestasForo,
  crearRespuestaForo,
  editarRespuestaForo,
  eliminarRespuestaForo,
  // Claves API
  obtenerClaveApi,
};