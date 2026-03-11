// ============================================================
//  membresia.js — Portal Vendedor GI Store
//  Muestra estado membresía + inyecta botón Wompi
// ============================================================
import { db, auth } from "./firebase.js";
import {
  collection, query,
  where, orderBy, limit, getDocs
} from "https://www.gstatic.com/firebasejs/12.10.0/firebase-firestore.js";
import { onAuthStateChanged, signOut }
  from "https://www.gstatic.com/firebasejs/12.10.0/firebase-auth.js";
import { esFundadorVigente } from "./db.js";

// ── Admin bloqueado (igual que el resto del portal) ─────────
const ADMIN_EMAIL = "aplicativosawebs@gmail.com";

// ── Llave pública Wompi (sandbox) ──────────────────────────
const WOMPI_LLAVE_PUBLICA = "pub_test_TtJTkVzWXZARy6JSxSkd7JiOvzEvkDPG";

// ── Utilidades de fecha ─────────────────────────────────────
function formatFecha(ts) {
  if (!ts) return "—";
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleDateString("es-CO", { year: "numeric", month: "long", day: "numeric" });
}

function diasRestantes(ts) {
  if (!ts) return -1;
  const fin = ts.toDate ? ts.toDate() : new Date(ts);
  const hoy = new Date();
  return Math.ceil((fin - hoy) / (1000 * 60 * 60 * 24));
}

function formatMoneda(n) {
  return "$" + Number(n).toLocaleString("es-CO");
}

// ── Badge días restantes ────────────────────────────────────
function badgeDias(dias) {
  if (dias < 0)  return `<span class="dias-restantes venc">❌ Vencida</span>`;
  if (dias <= 7) return `<span class="dias-restantes warn">⚠️ ${dias} días restantes</span>`;
  return `<span class="dias-restantes ok">✅ ${dias} días restantes</span>`;
}

// ── Alerta superior ─────────────────────────────────────────
function mostrarAlerta(tipo, mensaje) {
  const el = document.getElementById("alertaMembresia");
  if (!el) return;
  el.style.display = "flex";
  el.innerHTML = `<div class="alerta-membresia ${tipo}"><span>${tipo === "error" ? "❌" : tipo === "warn" ? "⚠️" : "✅"}</span><span>${mensaje}</span></div>`;
}

// ── Renderizar estado membresía ─────────────────────────────
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
  const pct  = Math.max(0, Math.min(100, Math.round((dias / 30) * 100)));

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
        <span>${Math.max(0, dias)} / 30 días</span>
      </div>
      <div class="progreso-barra">
        <div class="progreso-fill" style="width:${pct}%"></div>
      </div>
    </div>`;

  if (dias < 0)       mostrarAlerta("error", "Tu membresía ha vencido. Renueva ahora para recuperar el acceso.");
  else if (dias <= 7) mostrarAlerta("warn", `Tu membresía vence en ${dias} día${dias !== 1 ? "s" : ""}. Renueva para no perder el acceso.`);
  else                mostrarAlerta("ok", `¡Tu membresía está activa! Tienes ${dias} días disponibles.`);
}

// ── Renderizar historial de pagos ───────────────────────────
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
        <span class="historial-monto">${formatMoneda(p.monto || 0)}</span>
        <span class="badge ${p.estado === "aprobado" ? "badge-activo" : "badge-inactivo"}" style="font-size:.75rem">
          ${p.estado === "aprobado" ? "✓ Aprobado" : p.estado || "Pendiente"}
        </span>
      </div>
    </div>`).join("");
}

// ── Inyectar botón Wompi ────────────────────────────────────
async function inyectarBotonWompi(vendedorId, monto, referencia, label) {
  const wrap = document.getElementById("wompi-btn-wrap");
  if (!wrap) return;

  const montoEnCentavos = monto * 100;

  // Calcular firma SHA-256 requerida por Wompi (sandbox y producción)
  const firma = await calcularFirma(referencia, montoEnCentavos);

  // Solo enviar redirect-url si el dominio está autorizado en Wompi.
  // En local (127.x, localhost) Wompi lanza error de "URL inválida".
  // En producción registra tu dominio en: Wompi → Desarrolladores → Configuración.
  const esLocal = ["localhost","127.0.0.1","127.0.0.7"].includes(location.hostname)
    || location.hostname.startsWith("192.168.");
  const DOMINIO_PRODUCCION = "https://ildergutierrez.github.io";
  const redirectUrl = esLocal
    ? null
    : `${DOMINIO_PRODUCCION}/gistore/user/pages/pago-resultado.html?ref=${referencia}`;

  // Wompi solo renderiza el botón cuando el <script> se inserta en el DOM.
  // Por eso hay que limpiar e insertar uno nuevo cada vez que cambia el plan.
  wrap.innerHTML = "";

  const script = document.createElement("script");
  script.src = "https://checkout.wompi.co/widget.js";
  script.setAttribute("data-render",                  "button");
  script.setAttribute("data-public-key",              WOMPI_LLAVE_PUBLICA);
  script.setAttribute("data-currency",                "COP");
  script.setAttribute("data-amount-in-cents",         String(montoEnCentavos));
  script.setAttribute("data-reference",               referencia);
  script.setAttribute("data-signature:integrity",     firma);
  if (redirectUrl)
    script.setAttribute("data-redirect-url",          redirectUrl);
  script.setAttribute("data-customer-data:email",     auth.currentUser?.email || "");
  script.setAttribute("data-customer-data:full-name", auth.currentUser?.displayName || "");

  wrap.appendChild(script);
}

// ── Generar referencia única ────────────────────────────────
function generarReferencia(vendedorId, monto) {
  const ts = Date.now();
  return `GIS-${vendedorId.slice(0, 8)}-${monto}-${ts}`;
}

// ── Selección de plan ───────────────────────────────────────
function initSeleccionPlan(vendedorId) {
  const planes       = document.querySelectorAll(".plan-card");
  const resumenLabel = document.getElementById("resumenLabel");
  const resumenMonto = document.getElementById("resumenMonto");

  function seleccionar(card) {
    planes.forEach(p => p.classList.remove("seleccionado"));
    card.classList.add("seleccionado");

    const monto = parseInt(card.dataset.monto);
    const label = card.dataset.label;
    const ref   = generarReferencia(vendedorId, monto);

    if (resumenLabel) resumenLabel.textContent = label;
    if (resumenMonto) resumenMonto.textContent = formatMoneda(monto);

    inyectarBotonWompi(vendedorId, monto, ref, label);
  }

  // Solo escuchar clicks en planes visibles
  planes.forEach(card => {
    if (card.style.display !== "none") {
      card.addEventListener("click", () => seleccionar(card));
    }
  });

  // Seleccionar el primero visible (o el que tenga clase "seleccionado")
  const def = document.querySelector(".plan-card.seleccionado:not([style*='display: none']):not([style*='display:none'])")
           || Array.from(planes).find(c => c.style.display !== "none");
  if (def) seleccionar(def);
}

// ── Fecha de hoy ────────────────────────────────────────────
function setFechaHoy() {
  const el = document.getElementById("fechaHoy");
  if (el) el.textContent = new Date().toLocaleDateString("es-CO",
    { weekday: "long", year: "numeric", month: "long", day: "numeric" });
}

// ── Main ─────────────────────────────────────────────────────
onAuthStateChanged(auth, async (user) => {
  // Sin sesión → login
  if (!user) { location.href = "../index.html"; return; }

  // Bloquear admin igual que el resto del portal
  if (user.email.toLowerCase() === ADMIN_EMAIL.toLowerCase()) {
    await signOut(auth);
    location.href = "../index.html";
    return;
  }

  // Usuario válido → mostrar página
  document.body.style.visibility = "visible";
  setFechaHoy();

  // Cerrar sesión
  const btnSalir = document.getElementById("btnSalir");
  if (btnSalir) btnSalir.addEventListener("click", () =>
    signOut(auth).then(() => location.href = "../index.html"));

  try {
    // ─────────────────────────────────────────────────────────
    // FIX: El documento de vendedor NO usa user.uid como ID.
    // Se busca por el campo uid_auth, igual que en db.js.
    // ─────────────────────────────────────────────────────────
    const vendQ    = query(
      collection(db, "vendedores"),
      where("uid_auth", "==", user.uid)
    );
    const vendSnap = await getDocs(vendQ);

    if (vendSnap.empty) {
      // No hay perfil de vendedor — mostrar error sin redirigir
      console.warn("No se encontró perfil de vendedor para uid:", user.uid);
      const nomEl = document.getElementById("vendedorNombre");
      if (nomEl) nomEl.textContent = "Vendedor";
      renderEstado(null);
      renderHistorial([]);
      return;
    }

    const vendedorDoc = vendSnap.docs[0];
    const vendedorId  = vendedorDoc.id;          // ID real del documento
    const vendedor    = vendedorDoc.data();

    const nomEl = document.getElementById("vendedorNombre");
    if (nomEl) nomEl.textContent = vendedor.nombre || "Vendedor";

    // ─────────────────────────────────────────────────────────
    // FIX: Membresía y pagos usan el ID del documento vendedor,
    // NO el uid de Auth. Antes usaba user.uid → nunca encontraba nada.
    // ─────────────────────────────────────────────────────────
    const memRef  = collection(db, "membresias");
    const memQ    = query(memRef,
      where("vendedor_id", "==", vendedorId),   // ← ID del doc, no user.uid
      where("estado", "==", "activa"),
      orderBy("fecha_fin", "desc"),
      limit(1));

    let membresia = null;
    try {
      const memSnap = await getDocs(memQ);
      membresia = memSnap.empty ? null : memSnap.docs[0].data();
    } catch (eIdx) {
      // Fallback si el índice compuesto no existe aún en Firestore
      console.warn("Índice membresias no listo, usando fallback:", eIdx.message);
      const memFallQ = query(memRef, where("vendedor_id", "==", vendedorId));
      const memFallSnap = await getDocs(memFallQ);
      if (!memFallSnap.empty) {
        const docs = memFallSnap.docs.map(d => d.data());
        const activas = docs.filter(d => d.estado === "activa");
        activas.sort((a, b) => {
          const fa = a.fecha_fin?.toDate ? a.fecha_fin.toDate() : new Date(a.fecha_fin || 0);
          const fb = b.fecha_fin?.toDate ? b.fecha_fin.toDate() : new Date(b.fecha_fin || 0);
          return fb - fa;
        });
        membresia = activas[0] || null;
      }
    }

    renderEstado(membresia);

    // Historial de pagos (también con el ID del documento vendedor)
    let pagos = [];
    try {
      const pagosQ    = query(collection(db, "pagos"),
        where("vendedor_id", "==", vendedorId),  // ← ID del doc, no user.uid
        orderBy("creado_en", "desc"),
        limit(10));
      const pagosSnap = await getDocs(pagosQ);
      pagos = pagosSnap.docs.map(d => d.data());
    } catch (ePagos) {
      console.warn("Error cargando pagos:", ePagos.message);
    }

    renderHistorial(pagos);

    // Verificar si es fundador → mostrar/ocultar plan y corregir precio
    try {
      const infoFund  = await esFundadorVigente(vendedorId);
      const cardFund  = document.getElementById("planFundador");
      const cardEst   = document.getElementById("planEstandar");
      if (cardFund) {
        if (infoFund?.esFundador) {
          // Sí es fundador: mostrar tarjeta (estaba oculta por defecto)
          cardFund.style.display = "";
          // Precio correcto 15000
          cardFund.dataset.monto = "15000";
          cardFund.dataset.label = "Plan Fundador · 1 mes";
          const precioEl = cardFund.querySelector(".plan-precio");
          if (precioEl) precioEl.innerHTML = "$15.000 <span>/mes</span>";
          // Seleccionar el plan fundador por defecto
          cardEst?.classList.remove("seleccionado");
          cardFund.classList.add("seleccionado");
        }
        // Si NO es fundador, la tarjeta queda oculta (display:none en HTML)
      }
    } catch (eFund) {
      console.warn("No se pudo verificar fundador:", eFund.message);
    }

    // Botón Wompi usa el ID del documento del vendedor como referencia
    initSeleccionPlan(vendedorId);

  } catch (err) {
    console.error("Error cargando membresía:", err);
    const ec = document.getElementById("estadoContenido");
    if (ec) ec.innerHTML =
      `<p style="color:var(--error);font-size:.85rem">Error al cargar la membresía. Recarga la página.</p>`;
  }
});