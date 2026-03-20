// ============================================================
//  js/stores.js — Directorio de tiendas públicas
//  Lee la colección "vendedores" (estado == "activo")
//  Muestra tarjetas estilo producto, filtro por nombre
//  Click → page/tienda.html?v=<encoded_id>
// ============================================================
import { initializeApp, getApps }
  from "https://www.gstatic.com/firebasejs/12.10.0/firebase-app.js";
import {
  getFirestore, collection, getDocs, query, where
} from "https://www.gstatic.com/firebasejs/12.10.0/firebase-firestore.js";

// ── Firebase ──────────────────────────────────────────────
const _cfg = {
  apiKey:            "AIzaSyBviMH3re9aHjiLb5p-5hSjXd4gAchTvgI",
  authDomain:        "gi-store-5a5eb.firebaseapp.com",
  projectId:         "gi-store-5a5eb",
  storageBucket:     "gi-store-5a5eb.firebasestorage.app",
  messagingSenderId: "157652441199",
  appId:             "1:157652441199:web:c42285a80f117f79cc159a",
};
const _app = getApps().length ? getApps()[0] : initializeApp(_cfg);
const _db  = getFirestore(_app);

// ── Helpers ───────────────────────────────────────────────
function encodeId(id) { return btoa(String(id)).replace(/=/g, ""); }

function normalizar(t) {
  return (t || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function resolverImg(url) {
  if (!url) return "";
  if (url.startsWith("http://") || url.startsWith("https://") || url.startsWith("data:")) return url;
  url = url.replace(/\\/g, "/").replace(/^[A-Za-z]:\/.*?\/gistore\//, "").replace(/^\//, "");
  const isGH   = window.location.hostname.includes("github.io");
  const base   = isGH ? "/gistore" : "";
  return `${window.location.origin}${base}/${url}`;
}

// ── Estado ────────────────────────────────────────────────
let tiendas         = [];
let tiendasFiltradas = [];

// ── Cargar tiendas ────────────────────────────────────────
async function cargarTiendas() {
  try {
    // Solo vendedores activos
    const snap = await getDocs(
      query(collection(_db, "vendedores"), where("estado", "==", "activo"))
    );
    tiendas = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    // Ordenar por nombre
    tiendas.sort((a, b) => normalizar(a.nombre).localeCompare(normalizar(b.nombre)));
    tiendasFiltradas = [...tiendas];
    renderTiendas();
  } catch (e) {
    console.error("stores:", e);
    document.getElementById("storesGrid").innerHTML =
      `<div class="stores-vacio"><span>⚠️</span>Error al cargar las tiendas.</div>`;
  }
}

// ── Renderizar ────────────────────────────────────────────
function renderTiendas() {
  const grid = document.getElementById("storesGrid");
  const count = document.getElementById("storesCount");

  count.textContent = `${tiendasFiltradas.length} tienda${tiendasFiltradas.length !== 1 ? "s" : ""}`;

  if (!tiendasFiltradas.length) {
    grid.innerHTML = `<div class="stores-vacio"><span>🔍</span>No se encontraron tiendas.</div>`;
    return;
  }

  grid.innerHTML = tiendasFiltradas.map(v => {
    const color   = v.color || "#1a6b3c";
    const foto    = resolverImg(v.perfil || v.foto || "");
    const inicial = (v.nombre || "T")[0].toUpperCase();
    const desc    = v.descripcion || v.foto_perfil || "";
    const urlTienda = `tienda.html?v=${encodeId(v.id)}`;

    return `<a class="store-card" href="${urlTienda}" aria-label="Ver tienda de ${v.nombre||'vendedor'}">
      <!-- Banda de color -->
      <div class="store-card-banner" style="background:linear-gradient(135deg,${color},${color}cc)">
        <div class="store-card-avatar" style="background:${color}">
          ${foto
            ? `<img src="${foto}" alt="${v.nombre||''}" onerror="this.style.display='none'">`
            : inicial}
        </div>
      </div>
      <!-- Info -->
      <div class="store-card-body">
        <div class="store-card-nombre">${v.nombre || "Tienda"}</div>
        ${v.ciudad ? `<div class="store-card-ciudad">📍 ${v.ciudad}</div>` : ""}
        ${desc ? `<div class="store-card-desc">${desc}</div>` : ""}
        <span class="store-card-badge">Ver tienda →</span>
      </div>
    </a>`;
  }).join("");
}

// ── Filtro por nombre ─────────────────────────────────────
document.getElementById("busqStores").addEventListener("input", function () {
  const txt = normalizar(this.value);
  tiendasFiltradas = txt
    ? tiendas.filter(v => normalizar(v.nombre).includes(txt))
    : [...tiendas];
  renderTiendas();
});

// ── Init ──────────────────────────────────────────────────
cargarTiendas();