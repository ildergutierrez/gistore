// ============================================================
//  membresia.js — Portal Vendedor GI Store
//  v20260314
//  · Planes dinámicos desde Firestore (planes_membresia)
//  · Si el vendedor es fundador vigente → solo ve su plan fundador
//  · Wompi con llave pública desde variable de entorno
// ============================================================
import { db, auth } from "./firebase.js";
import {
  collection, query,
  where, orderBy, limit, getDocs,
} from "https://www.gstatic.com/firebasejs/12.10.0/firebase-firestore.js";
import { onAuthStateChanged, signOut }
  from "https://www.gstatic.com/firebasejs/12.10.0/firebase-auth.js";
import { esFundadorVigente, obtenerPlanes } from "./db.js";

// ── Admin bloqueado ─────────────────────────────────────────
const ADMIN_EMAIL = "aplicativosawebs@gmail.com";

// ── Llave pública Wompi ─────────────────────────────────────
// En sandbox: prefijo pub_test_   |   En producción: prefijo pub_live_
// Se lee desde el objeto global window.__ENV inyectado por firebase.js
// o se toma del fallback de sandbox para desarrollo local.
const WOMPI_PUB_KEY = "pub_prod_tbXbehx4yN4oEHj50A4mmWhR2am0ldc2";

const FIRMA_URL   = "https://us-central1-gi-store-5a5eb.cloudfunctions.net/firmaWompi";
const REDIRECT_URL = "https://ildergutierrez.github.io/gistore/user/pages/pago-resultado.html";

// ════════════════════════════════════════════════════════════
//  Utilidades
// ════════════════════════════════════════════════════════════

function formatFecha(ts) {
  if (!ts) return "—";
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleDateString("es-CO", { year: "numeric", month: "long", day: "numeric" });
}

function diasRestantes(ts) {
  if (!ts) return -1;
  const fin = ts.toDate ? ts.toDate() : new Date(ts);
  return Math.ceil((fin - new Date()) / (1000 * 60 * 60 * 24));
}

function formatCOP(n) {
  return "$" + Number(n).toLocaleString("es-CO");
}

function diasAEtiqueta(dias) {
  if (!dias || dias <= 0) return "";
  const d = Number(dias);
  if (d % 365 === 0) { const y = d / 365; return `${y} año${y > 1 ? "s" : ""}`; }
  if (d % 30  === 0) { const m = d / 30;  return `${m} mes${m > 1 ? "es" : ""}`; }
  if (d % 7   === 0) { const s = d / 7;   return `${s} semana${s > 1 ? "s" : ""}`; }
  return `${d} día${d > 1 ? "s" : ""}`;
}

function badgeDias(dias) {
  if (dias < 0)  return `<span class="dias-restantes venc">❌ Vencida</span>`;
  if (dias <= 7) return `<span class="dias-restantes warn">⚠️ ${dias} días restantes</span>`;
  return `<span class="dias-restantes ok">✅ ${dias} días restantes</span>`;
}

function mostrarAlerta(tipo, mensaje) {
  const el = document.getElementById("alertaMembresia");
  if (!el) return;
  el.style.display = "flex";
  el.innerHTML = `<div class="alerta-membresia ${tipo}">
    <span>${tipo === "error" ? "❌" : tipo === "warn" ? "⚠️" : "✅"}</span>
    <span>${mensaje}</span>
  </div>`;
}

// ════════════════════════════════════════════════════════════
//  Render estado membresía
// ════════════════════════════════════════════════════════════

function renderEstado(membresia) {
  const el = document.getElementById("estadoContenido");
  if (!el) return;

  if (!membresia) {
    el.innerHTML = `
      <div class="estado-fila">
        <span class="estado-fila-label">Estado</span>
        <span class="badge badge-inactivo">Sin membresía</span>
      </div>
      <p style="font-size:.83rem;color:var(--texto-suave);margin-top:.75rem">
        Aún no tienes una membresía activa. Elige un plan y realiza tu pago para activar tu acceso.
      </p>`;
    mostrarAlerta("error", "No tienes membresía activa. Realiza tu pago para acceder a todas las funciones.");
    return;
  }

  const dias = diasRestantes(membresia.fecha_fin);
  // Barra de progreso basada en la duración del plan (o 30 días por defecto)
  const duracion = membresia.duracion_dias || 30;
  const pct = Math.max(0, Math.min(100, Math.round((dias / duracion) * 100)));

  el.innerHTML = `
    <div class="estado-fila">
      <span class="estado-fila-label">Estado</span>
      ${badgeDias(dias)}
    </div>
    <div class="estado-fila">
      <span class="estado-fila-label">Plan activo</span>
      <span class="estado-fila-valor">${membresia.plan || "Estándar"}</span>
    </div>
    <div class="estado-fila">
      <span class="estado-fila-label">Inicio</span>
      <span class="estado-fila-valor">${formatFecha(membresia.fecha_inicio)}</span>
    </div>
    <div class="estado-fila">
      <span class="estado-fila-label">Vence</span>
      <span class="estado-fila-valor">${formatFecha(membresia.fecha_fin)}</span>
    </div>
    <div class="progreso-wrap">
      <div class="progreso-label">
        <span>Tiempo restante</span>
        <span>${Math.max(0, dias)} / ${duracion} días</span>
      </div>
      <div class="progreso-barra">
        <div class="progreso-fill" style="width:${pct}%"></div>
      </div>
    </div>`;

  if (dias < 0)       mostrarAlerta("error", "Tu membresía ha vencido. Renueva ahora para recuperar el acceso.");
  else if (dias <= 7) mostrarAlerta("warn", `Tu membresía vence en ${dias} día${dias !== 1 ? "s" : ""}. Renueva para no perder el acceso.`);
  else                mostrarAlerta("ok", `¡Tu membresía está activa! Tienes ${dias} días disponibles.`);
}

// ════════════════════════════════════════════════════════════
//  Render historial de pagos
// ════════════════════════════════════════════════════════════

function renderHistorial(pagos) {
  const el = document.getElementById("historialContenido");
  if (!el) return;

  if (!pagos || pagos.length === 0) {
    el.innerHTML = `<p style="font-size:.83rem;color:var(--texto-suave);text-align:center;padding:1rem 0">Sin pagos registrados aún.</p>`;
    return;
  }

  el.innerHTML = pagos.map(p => `
    <div class="historial-item">
      <div>
        <div style="font-size:.85rem;font-weight:600">${p.plan || "Membresía"}</div>
        <div class="historial-fecha">${formatFecha(p.fecha_pago || p.creado_en)}</div>
      </div>
      <div style="display:flex;align-items:center;gap:.75rem;flex-wrap:wrap;justify-content:flex-end">
        <span class="historial-monto">${formatCOP(p.monto || 0)}</span>
        <span class="badge ${p.estado === "aprobado" ? "badge-activo" : "badge-inactivo"}" style="font-size:.75rem">
          ${p.estado === "aprobado" ? "✓ Aprobado" : p.estado || "Pendiente"}
        </span>
      </div>
    </div>`).join("");
}

// ════════════════════════════════════════════════════════════
//  Wompi — firma de integridad (SHA-256 en cliente)
// ════════════════════════════════════════════════════════════

async function calcularFirma(referencia, montoEnCentavos) {
  const resp = await fetch(FIRMA_URL, {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify({ referencia, montoEnCentavos }),
  });
  if (!resp.ok) throw new Error("Error calculando firma: " + resp.status);
  const { firma } = await resp.json();
  return firma;
}

// ════════════════════════════════════════════════════════════
//  Wompi — inyectar botón
// ════════════════════════════════════════════════════════════

async function inyectarBotonWompi(monto, referencia) {
  const montoEnCentavos = Math.round(monto) * 100;
  if (!montoEnCentavos || montoEnCentavos <= 0) return;

  // 1. Pedir firma al servidor (el secreto nunca sale de Cloud Functions)
  const firma = await calcularFirma(referencia, montoEnCentavos);

  // 2. Buscar el contenedor actual
  const wrapActual = document.getElementById("wompi-btn-wrap");
  if (!wrapActual) return;

  // 3. Crear form + script nuevos con los datos correctos del plan
  //    Wompi requiere <script> dentro de <form> y que sea una insercion nueva
  const nuevoForm = document.createElement("form");
  nuevoForm.id = "wompi-btn-wrap";

  const script = document.createElement("script");
  script.src = "https://checkout.wompi.co/widget.js";
  script.setAttribute("data-render",              "button");
  script.setAttribute("data-public-key",          WOMPI_PUB_KEY);
  script.setAttribute("data-currency",            "COP");
  script.setAttribute("data-amount-in-cents",     String(montoEnCentavos));
  script.setAttribute("data-reference",           referencia);
  script.setAttribute("data-signature:integrity", firma);
  script.setAttribute("data-redirect-url",        REDIRECT_URL);
  script.setAttribute("data-customer-data:email",
    auth.currentUser?.email || "");
  script.setAttribute("data-customer-data:full-name",
    auth.currentUser?.displayName || "");

  nuevoForm.appendChild(script);

  // 4. Reemplazar el contenedor — replaceWith mantiene el flujo del DOM
  wrapActual.replaceWith(nuevoForm);
}

function generarReferencia(vendedorId, monto) {
  return `GIS-${vendedorId.slice(0, 8)}-${monto}-${Date.now()}`;
}

// ════════════════════════════════════════════════════════════
//  Render planes dinámicos desde Firestore
//  Reglas:
//   · Si el vendedor ES fundador vigente → solo muestra el plan
//     cuyo nombre contiene "fundador" (case-insensitive).
//     Si no existe ese plan en Firestore, muestra todos los activos.
//   · Si NO es fundador → muestra todos los planes activos
//     EXCEPTO los que tengan "fundador" en el nombre.
// ════════════════════════════════════════════════════════════

function renderPlanes(planesFirestore, esFundador, vendedorId) {
  const wrap = document.getElementById("planesWrap");
  if (!wrap) return;

  // Filtrar según condición de fundador
  let planesToShow;
  if (esFundador) {
    const planFund = planesFirestore.filter(
      p => p.activo && p.nombre.toLowerCase().includes("fundador")
    );
    // Si el admin no creó un plan "fundador", mostrar todos activos como fallback
    planesToShow = planFund.length > 0 ? planFund : planesFirestore.filter(p => p.activo);
  } else {
    planesToShow = planesFirestore.filter(
      p => p.activo && !p.nombre.toLowerCase().includes("fundador")
    );
  }

  if (!planesToShow.length) {
    wrap.innerHTML = `<p style="font-size:.83rem;color:var(--texto-suave);text-align:center;padding:1rem 0">
      No hay planes disponibles en este momento.
    </p>`;
    return;
  }

  wrap.innerHTML = planesToShow.map((p, i) => {
    const esFund    = p.nombre.toLowerCase().includes("fundador");
    const etiqueta  = diasAEtiqueta(p.duracion_dias);
    const precioFmt = formatCOP(p.precio);
    const isFirst   = i === 0;
    return `
      <div class="plan-card${isFirst ? " seleccionado" : ""}"
           data-plan-id="${p.id}"
           data-monto="${p.precio}"
           data-label="${p.nombre}${etiqueta ? " · " + etiqueta : ""}"
           data-duracion="${p.duracion_dias || 30}">
        ${esFund ? `<div class="plan-badge">🌱 Fundador</div>` : ""}
        <div class="plan-card-top">
          <div>
            <div class="plan-nombre">${p.nombre}</div>
            <div class="plan-desc">${p.descripcion || (etiqueta ? "Duración: " + etiqueta : "")}</div>
          </div>
          <div style="display:flex;align-items:flex-start;gap:.75rem">
            <div class="plan-precio">${precioFmt}${etiqueta ? ` <span>/ ${etiqueta}</span>` : ""}</div>
            <div class="plan-radio"></div>
          </div>
        </div>
      </div>`;
  }).join("");

  // Inicializar selección
  initSeleccionPlan(vendedorId);
}

// ════════════════════════════════════════════════════════════
//  Lógica de selección de plan
// ════════════════════════════════════════════════════════════

function initSeleccionPlan(vendedorId) {
  const cards        = document.querySelectorAll(".plan-card");
  const resumenLabel = document.getElementById("resumenLabel");
  const resumenMonto = document.getElementById("resumenMonto");

  function seleccionar(card) {
    cards.forEach(c => c.classList.remove("seleccionado"));
    card.classList.add("seleccionado");

    const monto = parseInt(card.dataset.monto);
    const label = card.dataset.label;
    const ref   = generarReferencia(vendedorId, monto);

    if (resumenLabel) resumenLabel.textContent = label;
    if (resumenMonto) resumenMonto.textContent = formatCOP(monto);

    inyectarBotonWompi(monto, ref);
  }

  cards.forEach(card => card.addEventListener("click", () => seleccionar(card)));

  // Seleccionar la primera por defecto
  const primera = document.querySelector(".plan-card.seleccionado") || cards[0];
  if (primera) seleccionar(primera);
}

// ════════════════════════════════════════════════════════════
//  Fecha de hoy
// ════════════════════════════════════════════════════════════

function setFechaHoy() {
  const el = document.getElementById("fechaHoy");
  if (el) el.textContent = new Date().toLocaleDateString("es-CO",
    { weekday: "long", year: "numeric", month: "long", day: "numeric" });
}

// ════════════════════════════════════════════════════════════
//  Main — onAuthStateChanged
// ════════════════════════════════════════════════════════════

onAuthStateChanged(auth, async (user) => {
  if (!user) { location.href = "../index.html"; return; }

  // Bloquear admin
  if (user.email.toLowerCase() === ADMIN_EMAIL.toLowerCase()) {
    await signOut(auth);
    location.href = "../index.html";
    return;
  }

  document.body.style.visibility = "visible";
  setFechaHoy();

  const btnSalir = document.getElementById("btnSalir");
  if (btnSalir) btnSalir.addEventListener("click", () =>
    signOut(auth).then(() => location.href = "../index.html"));

  try {
    // ── 1. Obtener perfil del vendedor ──────────────────────
    const vendQ    = query(
      collection(db, "vendedores"),
      where("uid_auth", "==", user.uid)
    );
    const vendSnap = await getDocs(vendQ);

    if (vendSnap.empty) {
      console.warn("No se encontró perfil de vendedor para uid:", user.uid);
      const nomEl = document.getElementById("vendedorNombre");
      if (nomEl) nomEl.textContent = "Vendedor";
      renderEstado(null);
      renderHistorial([]);
      return;
    }

    const vendedorId = vendSnap.docs[0].id;
    const vendedor   = vendSnap.docs[0].data();

    const nomEl = document.getElementById("vendedorNombre");
    if (nomEl) nomEl.textContent = vendedor.nombre || "Vendedor";

    // ── 2. Cargar membresía activa, planes y estado fundador en paralelo ──
    const memRef = collection(db, "membresias");
    const memQ   = query(memRef,
      where("vendedor_id", "==", vendedorId),
      where("estado",      "==", "activa"),
      orderBy("fecha_fin", "desc"),
      limit(1));

    const [memResult, planesFirestore, infoFund] = await Promise.allSettled([
      // Membresía con fallback
      getDocs(memQ).catch(async () => {
        const fb = await getDocs(query(memRef, where("vendedor_id", "==", vendedorId)));
        return fb;
      }),
      obtenerPlanes(),
      esFundadorVigente(vendedorId),
    ]);

    // Procesar membresía
    let membresia = null;
    if (memResult.status === "fulfilled") {
      const snap = memResult.value;
      if (!snap.empty) {
        const docs = snap.docs.map(d => d.data());
        const activas = docs.filter(d => d.estado === "activa");
        activas.sort((a, b) => {
          const fa = a.fecha_fin?.toDate ? a.fecha_fin.toDate() : new Date(a.fecha_fin || 0);
          const fb = b.fecha_fin?.toDate ? b.fecha_fin.toDate() : new Date(b.fecha_fin || 0);
          return fb - fa;
        });
        membresia = activas[0] || null;
      }
    }

    // Procesar planes
    const planes = planesFirestore.status === "fulfilled" ? planesFirestore.value : [];

    // Procesar estado fundador
    const esFundador = infoFund.status === "fulfilled"
      ? (infoFund.value?.esFundador ?? false)
      : false;

    // ── 3. Render ───────────────────────────────────────────
    renderEstado(membresia);
    renderPlanes(planes, esFundador, vendedorId);

    // ── 4. Historial de pagos ───────────────────────────────
    let pagos = [];
    try {
      const pagosSnap = await getDocs(
        query(collection(db, "pagos"),
          where("vendedor_id", "==", vendedorId),
          orderBy("creado_en", "desc"),
          limit(10))
      );
      pagos = pagosSnap.docs.map(d => d.data());
    } catch (ePagos) {
      console.warn("Error cargando pagos:", ePagos.message);
    }
    renderHistorial(pagos);

  } catch (err) {
    console.error("Error cargando membresía:", err);
    const ec = document.getElementById("estadoContenido");
    if (ec) ec.innerHTML =
      `<p style="color:var(--error);font-size:.85rem">Error al cargar la membresía. Recarga la página.</p>`;
  }
});