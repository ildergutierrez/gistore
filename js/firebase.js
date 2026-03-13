// ============================================================
//  firebase.js — Catálogo público (raíz)
//  Proyecto: gi-store-5a5eb
// ============================================================
import { initializeApp }
  from "https://www.gstatic.com/firebasejs/12.10.0/firebase-app.js";
import {
  getFirestore, collection,
  getDocs, query, where, orderBy
} from "https://www.gstatic.com/firebasejs/12.10.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey:            "AIzaSyBviMH3re9aHjiLb5p-5hSjXd4gAchTvgI",
  authDomain:        "gi-store-5a5eb.firebaseapp.com",
  projectId:         "gi-store-5a5eb",
  storageBucket:     "gi-store-5a5eb.firebasestorage.app",
  messagingSenderId: "157652441199",
  appId:             "1:157652441199:web:c42285a80f117f79cc159a"
};

const app = initializeApp(firebaseConfig);
const db  = getFirestore(app);

// ── Productos activos (lectura pública) ────────────────────
async function obtenerProductosActivos() {
  // Intenta con filtro; si falla por permisos o índice, trae todos y filtra
  try {
    const q    = query(collection(db, "productos"), where("activo", "==", true));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch {
    const snap = await getDocs(collection(db, "productos"));
    return snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(p => p.activo === true);
  }
}

// ── Categorías ─────────────────────────────────────────────
async function obtenerCategorias() {
  try {
    const q    = query(collection(db, "categorias"), orderBy("orden"));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch {
    const snap = await getDocs(collection(db, "categorias"));
    return snap.docs.map(d => ({ id: d.id, ...d.data() }))
                    .sort((a, b) => (a.orden || 0) - (b.orden || 0));
  }
}

// ── Vendedores ─────────────────────────────────────────────
async function obtenerVendedores() {
  const snap = await getDocs(collection(db, "vendedores"));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export { obtenerProductosActivos, obtenerCategorias, obtenerVendedores };