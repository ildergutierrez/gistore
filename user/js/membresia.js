// ============================================================
//  membresia.js — Portal Vendedor GI Store
//  Versión: 2026-03-14 (producción)
//
//  Responsabilidades:
//    · Verificar sesión y bloquear acceso al admin
//    · Mostrar el estado de la membresía activa del vendedor
//    · Leer los planes disponibles desde Firestore
//    · Mostrar solo el plan "Fundador" si el vendedor tiene ese beneficio
//    · Calcular la firma SHA-256 a través de la Cloud Function (seguro)
//    · Inyectar el botón de pago de Wompi dentro de un iframe
//    · Listar el historial de pagos del vendedor
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

// Correo del administrador — se bloquea su acceso al portal vendedor
const ADMIN_EMAIL = "aplicativosawebs@gmail.com";

// Llave pública de Wompi (producción).
// Esta llave es PÚBLICA: es seguro incluirla en el código del cliente.
const WOMPI_LLAVE_PUBLICA = "pub_prod_tbXbehx4yN4oEHj50A4mmWhR2am0ldc2";

// Endpoint de la Cloud Function que calcula la firma SHA-256.
// La llave de integridad (privada) vive únicamente en el servidor.
const FIRMA_URL = "https://us-central1-gi-store-5a5eb.cloudfunctions.net/firmaWompi";

// URL de redirección tras completar el pago en Wompi
const REDIRECT_URL = "https://ildergutierrez.github.io/gistore/user/pages/pago-resultado.html";

// ════════════════════════════════════════════════════════════
//  UTILIDADES DE FORMATO
// ════════════════════════════════════════════════════════════

/**
 * Convierte un Timestamp de Firestore o una cadena ISO a una
 * fecha legible en español colombiano.
 */
function formatFecha(ts) {
  if (!ts) return "—";
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleDateString("es-CO", {
    year: "numeric", month: "long", day: "numeric",
  });
}

/**
 * Calcula los días que faltan hasta una fecha (Timestamp o string).
 * Devuelve un número negativo si ya venció.
 */
function diasRestantes(ts) {
  if (!ts) return -1;
  const fin = ts.toDate ? ts.toDate() : new Date(ts);
  return Math.ceil((fin - new Date()) / 864e5); // 864e5 = ms en un día
}

/** Formatea un número como precio en pesos colombianos: $25.000 */
function formatCOP(n) {
  return "$" + Number(n).toLocaleString("es-CO");
}

/**
 * Convierte una duración en días a una etiqueta legible:
 * 30 → "1 mes", 365 → "1 año", 14 → "2 semanas", etc.
 */
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

/** Genera el badge de días restantes según urgencia. */
function badgeDias(dias) {
  if (dias < 0)  return `<span class="dias-restantes venc">❌ Vencida</span>`;
  if (dias <= 7) return `<span class="dias-restantes warn">⚠️ ${dias} días restantes</span>`;
  return `<span class="dias-restantes ok">✅ ${dias} días restantes</span>`;
}

/**
 * Muestra la alerta superior de estado de membresía.
 * @param {"ok"|"warn"|"error"} tipo
 * @param {string} mensaje
 */
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

/**
 * Renderiza las filas de estado (plan activo, fechas, barra de progreso).
 * Si no hay membresía activa, muestra un mensaje informativo.
 * @param {object|null} membresia — documento de Firestore o null
 */
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

  // Alerta según urgencia
  if (dias < 0)       mostrarAlerta("error", "Tu membresía ha vencido. Renueva ahora para recuperar el acceso.");
  else if (dias <= 7) mostrarAlerta("warn",  `Tu membresía vence en ${dias} día${dias !== 1 ? "s" : ""}. Renueva para no perder el acceso.`);
  else                mostrarAlerta("ok",    `¡Tu membresía está activa! Tienes ${dias} días disponibles.`);
}

// ════════════════════════════════════════════════════════════
//  RENDER: HISTORIAL DE PAGOS
// ════════════════════════════════════════════════════════════

/**
 * Renderiza la lista de pagos aprobados del vendedor.
 * @param {Array} pagos — array de documentos de la colección "pagos"
 */
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

/**
 * Solicita la firma SHA-256 a la Cloud Function "firmaWompi".
 * La llave de integridad NUNCA sale del servidor.
 *
 * @param {string} referencia      — referencia única de la transacción
 * @param {number} montoEnCentavos — monto en centavos (ej: 2500000)
 * @returns {Promise<string>}      — hash SHA-256 como cadena hexadecimal
 */
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
//  WOMPI — INYECCIÓN DEL BOTÓN DE PAGO
// ════════════════════════════════════════════════════════════

/**
 * Inyecta el widget de pago de Wompi dentro de un iframe.
 *
 * Por qué un iframe:
 *   El widget de Wompi solo se inicializa correctamente cuando su <script>
 *   se inserta en el DOM por primera vez. Si se reemplaza dinámicamente
 *   (al cambiar de plan), el widget queda en un estado inconsistente.
 *   El iframe garantiza un contexto limpio en cada render.
 *
 * @param {number} monto      — precio en COP (ej: 25000)
 * @param {string} referencia — referencia única GIS-xxxxxxxx-monto-timestamp
 */
async function inyectarBotonWompi(monto, referencia) {
  // Number() convierte el string del dataset a número antes de operar.
  // Math.round("25000") devuelve NaN; Number("25000") devuelve 25000.
  const montoEnCentavos = Math.round(Number(monto)) * 100;
  if (!montoEnCentavos || montoEnCentavos <= 0) return;

  const wrap = document.getElementById("wompi-btn-wrap");
  if (!wrap) return;

  // Indicador de carga mientras se obtiene la firma del servidor
  wrap.innerHTML = `
    <div style="text-align:center;padding:.75rem;font-size:.8rem;color:var(--texto-suave)">
      Preparando botón de pago…
    </div>`;

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

  const emailCliente  = auth.currentUser?.email       || "";
  const nombreCliente = auth.currentUser?.displayName || "";

  // HTML completo del widget dentro del iframe.
  // El cierre del tag <script> se escapa para evitar que el parser HTML
  // del documento padre lo interprete antes de escribirlo en el iframe.
  const htmlIframe = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8"/>
  <style>
    body { margin:0; padding:0; background:transparent; }
    .waybox-button { width:100% !important; min-width:unset !important; }
  </style>
</head>
<body>
  <form>
    <script
      src="https://checkout.wompi.co/widget.js"
      data-render="button"
      data-public-key="${WOMPI_LLAVE_PUBLICA}"
      data-currency="COP"
      data-amount-in-cents="${montoEnCentavos}"
      data-reference="${referencia}"
      data-signature:integrity="${firma}"
      data-redirect-url="${REDIRECT_URL}"
      data-customer-data:email="${emailCliente}"
      data-customer-data:full-name="${nombreCliente}">
    <\/script>
  </form>
</body>
</html>`;

  // Limpiar e insertar el iframe
  wrap.innerHTML = "";

  const iframe = document.createElement("iframe");
  iframe.style.cssText = "width:100%;border:none;min-height:56px;overflow:hidden;display:block;";
  iframe.scrolling = "no";
  wrap.appendChild(iframe);

  // Escribir el HTML directamente en el documento del iframe
  const iDoc = iframe.contentDocument || iframe.contentWindow.document;
  iDoc.open();
  iDoc.write(htmlIframe);
  iDoc.close();

  // Ajustar la altura del iframe una vez que el widget termine de cargar
  iframe.onload = () => {
    try {
      const altura = iframe.contentWindow.document.body.scrollHeight;
      if (altura > 10) iframe.style.height = (altura + 8) + "px";
    } catch (_) {
      // En producción con HTTPS el iframe puede ser cross-origin;
      // la altura fija de min-height es suficiente en ese caso.
    }
  };
}

/** Genera una referencia única por transacción. Formato: GIS-{uid8}-{monto}-{timestamp} */
function generarReferencia(vendedorId, monto) {
  return `GIS-${vendedorId.slice(0, 8)}-${monto}-${Date.now()}`;
}

// ════════════════════════════════════════════════════════════
//  RENDER: PLANES DE PAGO (DINÁMICOS DESDE FIRESTORE)
// ════════════════════════════════════════════════════════════

/**
 * Renderiza las tarjetas de plan dentro de #planesWrap.
 *
 * Reglas de visibilidad:
 *  - Fundador vigente  → ve SOLO el plan "fundador" (nombre incluye "fundador").
 *                        Si no existe ese plan en Firestore, ve todos los activos.
 *  - No es fundador    → ve todos los planes activos EXCEPTO el plan "fundador".
 *
 * @param {Array}   planes      — documentos de "planes_membresia" en Firestore
 * @param {boolean} esFundador  — si el vendedor tiene el beneficio fundador vigente
 * @param {string}  vendedorId  — ID del documento del vendedor en Firestore
 */
function renderPlanes(planes, esFundador, vendedorId) {
  const wrap = document.getElementById("planesWrap");
  if (!wrap) return;

  // Filtrar planes según la condición de fundador
  let planesToShow;

  if (esFundador) {
    const soloFundador = planes.filter(
      p => p.activo && p.nombre.toLowerCase().includes("fundador")
    );
    // Fallback: si el admin no configuró un plan "fundador", mostrar todos
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
    const esPlanFundador = plan.nombre.toLowerCase().includes("fundador");
    const etiquetaDuracion = diasAEtiqueta(plan.duracion_dias);

    return `
      <div class="plan-card${indice === 0 ? " seleccionado" : ""}"
           data-plan-id="${plan.id}"
           data-monto="${plan.precio}"
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
              ${formatCOP(plan.precio)}
              ${etiquetaDuracion ? `<span>/ ${etiquetaDuracion}</span>` : ""}
            </div>
            <div class="plan-radio"></div>
          </div>
        </div>
      </div>`;
  }).join("");

  // Registrar los eventos de selección sobre las tarjetas recién creadas
  inicializarSeleccion(vendedorId);
}

// ════════════════════════════════════════════════════════════
//  SELECCIÓN DE PLAN → ACTUALIZA RESUMEN Y BOTÓN WOMPI
// ════════════════════════════════════════════════════════════

/**
 * Registra los eventos de clic en las tarjetas de plan y selecciona
 * la primera por defecto, disparando la generación del botón Wompi.
 * @param {string} vendedorId
 */
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

  // Seleccionar la primera tarjeta disponible al cargar
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
  // Sin sesión activa → redirigir al login
  if (!user) {
    location.href = "../index.html";
    return;
  }

  // El administrador no tiene acceso al portal vendedor
  if (user.email.toLowerCase() === ADMIN_EMAIL.toLowerCase()) {
    await signOut(auth);
    location.href = "../index.html";
    return;
  }

  // Revelar la página y configurar la fecha
  document.body.style.visibility = "visible";
  mostrarFechaHoy();

  // Botón de cerrar sesión
  const btnSalir = document.getElementById("btnSalir");
  if (btnSalir) {
    btnSalir.addEventListener("click", () =>
      signOut(auth).then(() => location.href = "../index.html")
    );
  }

  try {
    // ── 1. Buscar el perfil del vendedor por uid_auth ───────────────
    // El ID del documento en "vendedores" NO es el uid de Firebase Auth;
    // hay que buscarlo por el campo "uid_auth".
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
    const colMembresias = collection(db, "membresias");
    const consultaMembresia = query(
      colMembresias,
      where("vendedor_id", "==", vendedorId),
      where("estado",      "==", "activa"),
      orderBy("fecha_fin", "desc"),
      limit(1)
    );

    const [resultadoMembresia, resultadoPlanes, resultadoFundador] =
      await Promise.allSettled([
        // Membresía con fallback por si el índice compuesto no existe
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

      // Ordenar descendente por fecha_fin para tomar la más reciente
      activas.sort((a, b) => {
        const fa = a.fecha_fin?.toDate ? a.fecha_fin.toDate() : new Date(a.fecha_fin || 0);
        const fb = b.fecha_fin?.toDate ? b.fecha_fin.toDate() : new Date(b.fecha_fin || 0);
        return fb - fa;
      });

      membresia = activas[0] || null;
    }

    renderEstado(membresia);

    // ── 4. Renderizar planes con la condición de fundador ───────────
    const planes     = resultadoPlanes.status     === "fulfilled" ? resultadoPlanes.value              : [];
    const esFundador = resultadoFundador.status   === "fulfilled" ? (resultadoFundador.value?.esFundador ?? false) : false;

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