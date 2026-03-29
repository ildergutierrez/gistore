// ============================================================
//  membresia.js — Portal Vendedor GI Store
//  Versión: 2026-03-15
// ============================================================

import { db, auth } from "./firebase.js";
import {
  collection, query,
  where, orderBy, limit, getDocs,
} from "https://www.gstatic.com/firebasejs/12.10.0/firebase-firestore.js";
import { onAuthStateChanged, signOut }
  from "https://www.gstatic.com/firebasejs/12.10.0/firebase-auth.js";
import { esFundadorVigente, obtenerPlanes } from "./db.js";

// ════════════════════════════════════════════════════════════
//  CONFIGURACIÓN
// ════════════════════════════════════════════════════════════

const ADMIN_EMAIL         = "atencionalcliente@gistore.com.co";
const WOMPI_LLAVE_PUBLICA = "pub_prod_tbXbehx4yN4oEHj50A4mmWhR2amOldc2";
const FIRMA_URL           = "https://us-central1-gi-store-5a5eb.cloudfunctions.net/firmaWompi";
const REDIRECT_URL        = "https://ildergutierrez.github.io/gistore/user/pages/pago-resultado.html";

// ════════════════════════════════════════════════════════════
//  UTILIDADES DE FORMATO
// ════════════════════════════════════════════════════════════

function formatFecha(ts) {
  if (!ts) return "—";
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleDateString("es-CO", {
    year: "numeric", month: "long", day: "numeric",
  });
}

function diasRestantes(ts) {
  if (!ts) return -1;
  const fin = ts.toDate ? ts.toDate() : new Date(ts);
  return Math.ceil((fin - new Date()) / 864e5);
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

// ════════════════════════════════════════════════════════════
//  COMPONENTES DE UI
// ════════════════════════════════════════════════════════════

function badgeDias(dias) {
  if (dias < 0)  return `<span class="dias-restantes venc">❌ Vencida</span>`;
  if (dias <= 7) return `<span class="dias-restantes warn">⚠️ ${dias} días restantes</span>`;
  return `<span class="dias-restantes ok">✅ ${dias} días restantes</span>`;
}

function mostrarAlerta(tipo, mensaje) {
  const el = document.getElementById("alertaMembresia");
  if (!el) return;
  el.style.display = "flex";
  el.innerHTML = `
    <div class="alerta-membresia ${tipo}">
      <span>${tipo === "error" ? "❌" : tipo === "warn" ? "⚠️" : "✅"}</span>
      <span>${mensaje}</span>
    </div>`;
}

// ════════════════════════════════════════════════════════════
//  RENDER: ESTADO DE LA MEMBRESÍA
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
        Aún no tienes una membresía activa. Elige un plan y realiza tu pago
        para activar tu acceso completo a GI Store.
      </p>`;
    mostrarAlerta("error",
      "No tienes membresía activa. Realiza tu pago para acceder a todas las funciones.");
    return;
  }

  const dias     = diasRestantes(membresia.fecha_fin);
  const duracion = membresia.duracion_dias || membresia.dias || 30;
  const pct      = Math.max(0, Math.min(100, Math.round((dias / duracion) * 100)));

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
  else if (dias <= 7) mostrarAlerta("warn",  `Tu membresía vence en ${dias} día${dias !== 1 ? "s" : ""}. Renueva para no perder el acceso.`);
  else                mostrarAlerta("ok",    `¡Tu membresía está activa! Tienes ${dias} días disponibles.`);
}

// ════════════════════════════════════════════════════════════
//  RENDER: HISTORIAL DE PAGOS
// ════════════════════════════════════════════════════════════

function renderHistorial(pagos) {
  const el = document.getElementById("historialContenido");
  if (!el) return;

  if (!pagos || pagos.length === 0) {
    el.innerHTML = `
      <p style="font-size:.83rem;color:var(--texto-suave);text-align:center;padding:1rem 0">
        Sin pagos registrados aún.
      </p>`;
    return;
  }

  el.innerHTML = pagos.map(p => `
    <div class="historial-item">
      <div>
        <div style="font-size:.85rem;font-weight:600">${p.plan || "Membresía"}</div>
        <div class="historial-fecha">${formatFecha(p.fecha_pago || p.creado_en)}</div>
      </div>
      <div style="display:flex;align-items:center;gap:.65rem;flex-wrap:wrap;justify-content:flex-end">
        <span class="historial-monto">${formatCOP(p.monto || 0)}</span>
        <span class="badge ${p.estado === "aprobado" ? "badge-activo" : "badge-inactivo"}"
              style="font-size:.73rem">
          ${p.estado === "aprobado" ? "✓ Aprobado" : p.estado || "Pendiente"}
        </span>
      </div>
    </div>`).join("");
}

// ════════════════════════════════════════════════════════════
//  WOMPI — FIRMA DE INTEGRIDAD (SERVIDOR)
// ════════════════════════════════════════════════════════════

async function obtenerFirma(referencia, montoEnCentavos) {
  const respuesta = await fetch(FIRMA_URL, {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify({ referencia, montoEnCentavos }),
  });

  if (!respuesta.ok) {
    throw new Error(`Error al calcular firma: HTTP ${respuesta.status}`);
  }

  const { firma } = await respuesta.json();
  return firma;
}

// ════════════════════════════════════════════════════════════
//  WOMPI — ESPERAR A QUE EL SDK ESTÉ DISPONIBLE
//  El script de Wompi se carga como <script> normal, pero este
//  archivo es type="module" (scope aislado). WidgetCheckout puede
//  no estar en window todavía cuando se ejecuta este módulo.
// ════════════════════════════════════════════════════════════

function esperarWidgetCheckout(intentosMax = 20, intervaloMs = 300) {
  return new Promise((resolve, reject) => {
    if (typeof window.WidgetCheckout === "function") { resolve(); return; }
    let intentos = 0;
    const id = setInterval(() => {
      intentos++;
      if (typeof window.WidgetCheckout === "function") {
        clearInterval(id);
        resolve();
      } else if (intentos >= intentosMax) {
        clearInterval(id);
        reject(new Error("WidgetCheckout no cargó después de esperar."));
      }
    }, intervaloMs);
  });
}

// ════════════════════════════════════════════════════════════
//  WOMPI — BOTÓN DE PAGO (API JS OFICIAL)
// ════════════════════════════════════════════════════════════

async function inyectarBotonWompi(monto, referencia) {
  const montoCOP        = parseInt(String(monto).replace(/[^0-9]/g, ""), 10);
  const montoEnCentavos = montoCOP * 100;

  if (!Number.isInteger(montoEnCentavos) || montoEnCentavos <= 0) {
    console.error("Monto inválido para Wompi:", monto, "→", montoEnCentavos);
    return;
  }

  const wrap = document.getElementById("wompi-btn-wrap");
  if (!wrap) return;

  wrap.innerHTML = `
    <div style="text-align:center;padding:.75rem;font-size:.8rem;color:var(--texto-suave)">
      Preparando botón de pago…
    </div>`;

  // ── Esperar a que el SDK de Wompi esté disponible ──────────────────────
  // Necesario porque este archivo es type="module" y tiene scope aislado.
  // WidgetCheckout se carga como <script> normal y puede llegar después.
  try {
    await esperarWidgetCheckout();
  } catch (e) {
    console.error("WidgetCheckout no disponible:", e.message);
    wrap.innerHTML = `
      <p style="font-size:.8rem;color:var(--error);text-align:center;padding:.5rem">
        Error al cargar el sistema de pago. Recarga la página.
      </p>`;
    return;
  }

  // Obtener firma del servidor
  let firma;
  try {
    firma = await obtenerFirma(referencia, montoEnCentavos);
  } catch (error) {
    console.error("Error obteniendo firma Wompi:", error);
    wrap.innerHTML = `
      <p style="font-size:.8rem;color:var(--error);text-align:center;padding:.5rem">
        No se pudo preparar el botón de pago. Recarga la página e intenta de nuevo.
      </p>`;
    return;
  }

  if (!firma || typeof firma !== "string" || firma.length < 10) {
    console.error("Firma inválida recibida del servidor:", firma);
    wrap.innerHTML = `
      <p style="font-size:.8rem;color:var(--error);text-align:center;padding:.5rem">
        Error de seguridad al preparar el pago. Recarga la página.
      </p>`;
    return;
  }

  const emailCliente  = auth.currentUser?.email       || "";
  const nombreCliente = auth.currentUser?.displayName || "";

  // ── Configuración según documentación oficial de Wompi ──────────────────
  // Fuente: https://docs.wompi.co/en/docs/colombia/widget-checkout-web/
  // En el modo JS API (new WidgetCheckout), la firma NO va en el objeto config.
  // La integridad se valida server-side vía webhook. El objeto solo necesita
  // los 4 campos obligatorios: currency, amountInCents, reference, publicKey.
  const config = {
    currency:      "COP",
    amountInCents: montoEnCentavos,
    reference:     referencia,
    publicKey:     WOMPI_LLAVE_PUBLICA,
    redirectUrl:   REDIRECT_URL,       // opcional pero recomendado
  };

  // Agregar datos del cliente si están disponibles (opcionales)
  if (emailCliente || nombreCliente) {
    config.customerData = {};
    if (emailCliente)  config.customerData.email    = emailCliente;
    if (nombreCliente) config.customerData.fullName = nombreCliente;
  }

  // Instanciar el widget — NO abre el modal aún
  const checkout = new window.WidgetCheckout(config);

  // Reemplazar el indicador de carga por el botón estilizado
  wrap.innerHTML = "";

  const btn = document.createElement("button");
  btn.type      = "button";
  btn.className = "waybox-button";
  btn.style.cssText = "width:100%;display:flex;align-items:center;justify-content:center;gap:.5rem;font-size:1rem;padding:.75rem 1rem;cursor:pointer;border-radius:8px;";
  btn.innerHTML = `
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18"
         viewBox="0 0 229.5 229.5" style="flex-shrink:0">
      <path fill="#fff" d="M214.419 32.12A7.502 7.502 0 0 0 209 25.927L116.76.275
        a7.496 7.496 0 0 0-4.02 0L20.5 25.927a7.5 7.5 0 0 0-5.419 6.193
        c-.535 3.847-12.74 94.743 18.565 139.961 31.268 45.164 77.395 56.738
        79.343 57.209a7.484 7.484 0 0 0 3.522 0c1.949-.471 48.076-12.045
        79.343-57.209 31.305-45.217 19.1-136.113 18.565-139.961z
        m-40.186 53.066l-62.917 62.917c-1.464 1.464-3.384 2.197-5.303 2.197
        s-3.839-.732-5.303-2.197l-38.901-38.901a7.497 7.497 0 0 1 0-10.606
        l7.724-7.724a7.5 7.5 0 0 1 10.606 0l25.874 25.874 49.89-49.891
        a7.497 7.497 0 0 1 10.606 0l7.724 7.724a7.5 7.5 0 0 1 0 10.607z"/>
    </svg>
    Paga con <strong style="margin-left:.25rem">Wompi</strong>`;

  // Abrir el modal al hacer clic
  btn.addEventListener("click", () => {
    checkout.open(result => {
      const tx = result?.transaction;
      if (tx?.status === "APPROVED") {
        mostrarAlerta("ok", "¡Pago aprobado! Tu membresía se activará en unos segundos.");
      } else if (tx) {
        mostrarAlerta("warn", `Transacción ${tx.status || "pendiente"}. Revisa tu historial.`);
      }
    });
  });

  wrap.appendChild(btn);
}

// ════════════════════════════════════════════════════════════
//  REFERENCIA ÚNICA POR TRANSACCIÓN
// ════════════════════════════════════════════════════════════

function generarReferencia(vendedorId, monto) {
  return `GIS-${vendedorId.slice(0, 8)}-${monto}-${Date.now()}`;
}

// ════════════════════════════════════════════════════════════
//  RENDER: PLANES DE PAGO (DINÁMICOS DESDE FIRESTORE)
// ════════════════════════════════════════════════════════════

function renderPlanes(planes, esFundador, vendedorId) {
  const wrap = document.getElementById("planesWrap");
  if (!wrap) return;

  let planesToShow;

  if (esFundador) {
    const soloFundador = planes.filter(
      p => p.activo && p.nombre.toLowerCase().includes("fundador")
    );
    planesToShow = soloFundador.length > 0
      ? soloFundador
      : planes.filter(p => p.activo);
  } else {
    planesToShow = planes.filter(
      p => p.activo && !p.nombre.toLowerCase().includes("fundador")
    );
  }

  if (planesToShow.length === 0) {
    wrap.innerHTML = `
      <p style="font-size:.83rem;color:var(--texto-suave);text-align:center;padding:1rem 0">
        No hay planes disponibles en este momento. Contacta al administrador.
      </p>`;
    return;
  }

  wrap.innerHTML = planesToShow.map((plan, indice) => {
    const esPlanFundador   = plan.nombre.toLowerCase().includes("fundador");
    const etiquetaDuracion = diasAEtiqueta(plan.duracion_dias);
    const precioEntero     = parseInt(String(plan.precio).replace(/[^0-9]/g, ""), 10) || 0;

    return `
      <div class="plan-card${indice === 0 ? " seleccionado" : ""}"
           data-plan-id="${plan.id}"
           data-monto="${precioEntero}"
           data-label="${plan.nombre}${etiquetaDuracion ? " · " + etiquetaDuracion : ""}"
           data-duracion="${plan.duracion_dias || 30}">
        ${esPlanFundador ? `<div class="plan-badge">🌱 Fundador</div>` : ""}
        <div class="plan-card-top">
          <div style="flex:1;min-width:0">
            <div class="plan-nombre">${plan.nombre}</div>
            <div class="plan-desc">
              ${plan.descripcion || (etiquetaDuracion ? "Duración: " + etiquetaDuracion : "")}
            </div>
          </div>
          <div style="display:flex;align-items:flex-start;gap:.65rem;flex-shrink:0">
            <div class="plan-precio">
              ${formatCOP(precioEntero)}
              ${etiquetaDuracion ? `<span>/ ${etiquetaDuracion}</span>` : ""}
            </div>
            <div class="plan-radio"></div>
          </div>
        </div>
      </div>`;
  }).join("");

  inicializarSeleccion(vendedorId);
}

// ════════════════════════════════════════════════════════════
//  SELECCIÓN DE PLAN → ACTUALIZA RESUMEN Y BOTÓN WOMPI
// ════════════════════════════════════════════════════════════

function inicializarSeleccion(vendedorId) {
  const tarjetas     = document.querySelectorAll("#planesWrap .plan-card");
  const resumenLabel = document.getElementById("resumenLabel");
  const resumenMonto = document.getElementById("resumenMonto");

  function seleccionar(tarjeta) {
    tarjetas.forEach(t => t.classList.remove("seleccionado"));
    tarjeta.classList.add("seleccionado");

    const monto      = Number(tarjeta.dataset.monto);
    const etiqueta   = tarjeta.dataset.label;
    const referencia = generarReferencia(vendedorId, monto);

    if (resumenLabel) resumenLabel.textContent = etiqueta;
    if (resumenMonto) resumenMonto.textContent = formatCOP(monto);

    inyectarBotonWompi(monto, referencia);
  }

  tarjetas.forEach(t => t.addEventListener("click", () => seleccionar(t)));

  const porDefecto = document.querySelector("#planesWrap .plan-card.seleccionado")
                  || tarjetas[0];
  if (porDefecto) seleccionar(porDefecto);
}

// ════════════════════════════════════════════════════════════
//  FECHA DE HOY EN EL TOPBAR
// ════════════════════════════════════════════════════════════

function mostrarFechaHoy() {
  const el = document.getElementById("fechaHoy");
  if (el) el.textContent = new Date().toLocaleDateString("es-CO", {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
  });
}

// ════════════════════════════════════════════════════════════
//  PUNTO DE ENTRADA — SESIÓN ACTIVA
// ════════════════════════════════════════════════════════════

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    location.href = "../index.html";
    return;
  }

  if (user.email.toLowerCase() === ADMIN_EMAIL.toLowerCase()) {
    await signOut(auth);
    location.href = "../index.html";
    return;
  }

  document.body.style.visibility = "visible";
  mostrarFechaHoy();

  const btnSalir = document.getElementById("btnSalir");
  if (btnSalir) {
    btnSalir.addEventListener("click", () =>
      signOut(auth).then(() => location.href = "../index.html")
    );
  }

  try {
    // ── 1. Buscar el perfil del vendedor por uid_auth ───────────────
    const vendSnap = await getDocs(query(
      collection(db, "vendedores"),
      where("uid_auth", "==", user.uid)
    ));

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
    const colMembresias     = collection(db, "membresias");
    const consultaMembresia = query(
      colMembresias,
      where("vendedor_id", "==", vendedorId),
      where("estado",      "==", "activa"),
      orderBy("fecha_fin", "desc"),
      limit(1)
    );

    const [resultadoMembresia, resultadoPlanes, resultadoFundador] =
      await Promise.allSettled([
        getDocs(consultaMembresia).catch(async () =>
          getDocs(query(colMembresias, where("vendedor_id", "==", vendedorId)))
        ),
        obtenerPlanes(),
        esFundadorVigente(vendedorId),
      ]);

    // ── 3. Procesar la membresía más reciente activa ────────────────
    let membresia = null;

    if (resultadoMembresia.status === "fulfilled" && !resultadoMembresia.value.empty) {
      const docs    = resultadoMembresia.value.docs.map(d => d.data());
      const activas = docs.filter(d => d.estado === "activa");

      activas.sort((a, b) => {
        const fa = a.fecha_fin?.toDate ? a.fecha_fin.toDate() : new Date(a.fecha_fin || 0);
        const fb = b.fecha_fin?.toDate ? b.fecha_fin.toDate() : new Date(b.fecha_fin || 0);
        return fb - fa;
      });

      membresia = activas[0] || null;
    }

    renderEstado(membresia);

    // ── 4. Renderizar planes con la condición de fundador ───────────
    const planes     = resultadoPlanes.status   === "fulfilled" ? resultadoPlanes.value                          : [];
    const esFundador = resultadoFundador.status === "fulfilled" ? (resultadoFundador.value?.esFundador ?? false) : false;

    renderPlanes(planes, esFundador, vendedorId);

    // ── 5. Cargar el historial de los últimos 10 pagos ──────────────
    let pagos = [];
    try {
      const pagosSnap = await getDocs(query(
        collection(db, "pagos"),
        where("vendedor_id", "==", vendedorId),
        orderBy("creado_en", "desc"),
        limit(10)
      ));
      pagos = pagosSnap.docs.map(d => d.data());
    } catch (errPagos) {
      console.warn("No se pudo cargar el historial de pagos:", errPagos.message);
    }

    renderHistorial(pagos);

  } catch (error) {
    console.error("Error al cargar la página de membresía:", error);
    const contenido = document.getElementById("estadoContenido");
    if (contenido) {
      contenido.innerHTML = `
        <p style="color:var(--error);font-size:.85rem">
          Ocurrió un error al cargar tu membresía. Recarga la página.
        </p>`;
    }
  }
});