// ============================================================
//  functions/index.js — GI Store Cloud Functions
//  Versión: 2026-03-14 (producción)
//
//  Funciones exportadas:
//    · firmaWompi   → calcula la firma SHA-256 para el widget de pago.
//                     El secreto de integridad nunca sale del servidor.
//    · webhookWompi → recibe los eventos de Wompi, verifica la firma
//                     del evento y activa la membresía en Firestore de
//                     forma atómica cuando un pago es aprobado.
//
//  Secrets requeridos en Firebase Secret Manager:
//    · WOMPI_LLAVE_PRIVADA      (llave privada de la cuenta Wompi)
//    · WOMPI_SECRETO_INTEGRIDAD (llave de integridad para firmar pagos)
//    · WOMPI_SECRETO_EVENTOS    (llave para verificar eventos webhook)
// ============================================================

const { onRequest } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");
const admin  = require("firebase-admin");
const crypto = require("crypto");

admin.initializeApp();
const db = admin.firestore();

// ── Declaración de secrets (se resuelven en tiempo de ejecución) ──
const SECRET_LLAVE_PRIVADA = defineSecret("WOMPI_LLAVE_PRIVADA");
const SECRET_INTEGRIDAD    = defineSecret("WOMPI_SECRETO_INTEGRIDAD");
const SECRET_EVENTOS       = defineSecret("WOMPI_SECRETO_EVENTOS");

// ════════════════════════════════════════════════════════════
//  HELPERS INTERNOS
// ════════════════════════════════════════════════════════════

/**
 * Verifica la firma de un evento webhook de Wompi.
 * Wompi firma concatenando: id + status + amount_in_cents + timestamp + secreto.
 *
 * @param {object} body             — cuerpo del request parseado como JSON
 * @param {string} checksum         — hash enviado por Wompi en body.signature.checksum
 * @param {string} secretoEventos   — secret WOMPI_SECRETO_EVENTOS
 * @returns {boolean}
 */
function verificarFirmaEvento(body, checksum, secretoEventos) {
  if (!secretoEventos) {
    console.warn("WOMPI_SECRETO_EVENTOS no disponible en este entorno");
    return false;
  }

  const cadena = [
    body.data?.transaction?.id              || "",
    body.data?.transaction?.status          || "",
    body.data?.transaction?.amount_in_cents || "",
    body.timestamp                          || "",
    secretoEventos,
  ].join("");

  const hashCalculado = crypto.createHash("sha256").update(cadena).digest("hex");
  return hashCalculado === checksum;
}

/**
 * Calcula la fecha de fin de membresía sumando 'dias' días a 'desde'.
 *
 * @param {number} dias   — duración del plan en días (por defecto 30)
 * @param {Date}   desde  — fecha de inicio (por defecto hoy)
 * @returns {admin.firestore.Timestamp}
 */
function calcularFechaFin(dias = 30, desde = new Date()) {
  const fecha = new Date(desde);
  fecha.setDate(fecha.getDate() + dias);
  return admin.firestore.Timestamp.fromDate(fecha);
}

/**
 * Determina el plan contratado buscando en la colección "planes_membresia"
 * el documento cuyo precio coincida con el monto pagado (tolerancia ±1%).
 *
 * Estrategia de búsqueda:
 *   1. Coincidencia exacta con tolerancia del 1% (cubre redondeos de pasarela)
 *   2. Plan más caro que sea <= al monto pagado (el vendedor pagó de más)
 *   3. Plan más barato disponible (fallback extremo)
 *   4. Valores fijos si Firestore no responde
 *
 * @param {number} montoEnCentavos — monto de la transacción en centavos
 * @returns {Promise<{nombre: string, dias: number, planId: string|null}>}
 */
async function determinarPlan(montoEnCentavos) {
  const montoCOP = montoEnCentavos / 100;

  try {
    const snapshot = await db.collection("planes_membresia")
      .where("activo", "==", true)
      .get();

    if (!snapshot.empty) {
      const planes = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));

      // 1. Coincidencia exacta (tolerancia ±1%)
      const coincidenciaExacta = planes.find(p =>
        Math.abs((p.precio || 0) - montoCOP) / Math.max(montoCOP, 1) <= 0.01
      );
      if (coincidenciaExacta) {
        return {
          nombre: coincidenciaExacta.nombre,
          dias:   Number(coincidenciaExacta.duracion_dias) || 30,
          planId: coincidenciaExacta.id,
        };
      }

      // 2. Plan más caro que no supere el monto pagado
      const candidatos = planes
        .filter(p => (p.precio || 0) <= montoCOP)
        .sort((a, b) => b.precio - a.precio);

      if (candidatos.length > 0) {
        const elegido = candidatos[0];
        return {
          nombre: elegido.nombre,
          dias:   Number(elegido.duracion_dias) || 30,
          planId: elegido.id,
        };
      }

      // 3. El plan más barato (el vendedor pagó menos de lo esperado)
      planes.sort((a, b) => a.precio - b.precio);
      const masBarato = planes[0];
      return {
        nombre: masBarato.nombre,
        dias:   Number(masBarato.duracion_dias) || 30,
        planId: masBarato.id,
      };
    }
  } catch (error) {
    console.error("Error consultando planes_membresia:", error.message);
  }

  // 4. Fallback con rangos fijos si Firestore no responde
  console.warn("Usando fallback de planes hardcodeados");
  if (montoCOP <= 17000) return { nombre: "Plan Fundador", dias: 30, planId: null };
  return { nombre: "Plan Estándar", dias: 30, planId: null };
}

/**
 * Busca un vendedor en Firestore por su correo electrónico.
 * @param {string|null} email
 * @returns {Promise<object|null>}
 */
async function buscarVendedorPorEmail(email) {
  if (!email) return null;
  const snap = await db.collection("vendedores")
    .where("correo", "==", email)
    .limit(1)
    .get();
  return snap.empty ? null : { id: snap.docs[0].id, ...snap.docs[0].data() };
}

/**
 * Busca un vendedor por el fragmento de su UID incluido en la referencia.
 * Formato de referencia: GIS-{uid_8chars}-{monto}-{timestamp}
 * @param {string} referencia
 * @returns {Promise<object|null>}
 */
async function buscarVendedorPorReferencia(referencia) {
  const partes = (referencia || "").split("-");
  if (partes.length < 2) return null;

  const fragmento = partes[1];
  const snap = await db.collection("vendedores")
    .orderBy("__name__")
    .startAt(fragmento)
    .endAt(fragmento + "\uf8ff")
    .limit(1)
    .get();

  return snap.empty ? null : { id: snap.docs[0].id, ...snap.docs[0].data() };
}

// ════════════════════════════════════════════════════════════
//  FUNCIÓN 1: firmaWompi
//  Calcula la firma de integridad para el widget de Wompi.
//  El cliente envía { referencia, montoEnCentavos } y recibe { firma }.
//  La llave secreta nunca abandona el servidor.
// ════════════════════════════════════════════════════════════

exports.firmaWompi = onRequest(
  {
    region:  "us-central1",
    cors:    [
      "https://ildergutierrez.github.io", // GitHub Pages (producción)
      "http://localhost",                  // Desarrollo local
      "http://127.0.0.1",
    ],
    secrets: [SECRET_INTEGRIDAD],
  },
  async (req, res) => {
    if (req.method !== "POST") {
      return res.status(405).send("Método no permitido");
    }

    const { referencia, montoEnCentavos } = req.body || {};

    if (!referencia || !montoEnCentavos || Number(montoEnCentavos) <= 0) {
      return res.status(400).json({ error: "Parámetros inválidos o faltantes" });
    }

    const secreto = SECRET_INTEGRIDAD.value();
    const cadena  = `${referencia}${montoEnCentavos}COP${secreto}`;
    const firma   = crypto.createHash("sha256").update(cadena).digest("hex");

    return res.status(200).json({ firma });
  }
);

// ════════════════════════════════════════════════════════════
//  FUNCIÓN 2: webhookWompi
//  Recibe eventos de Wompi (transaction.updated), verifica la firma
//  del evento y activa la membresía en Firestore de forma atómica.
// ════════════════════════════════════════════════════════════

exports.webhookWompi = onRequest(
  {
    region:  "us-central1",
    cors:    false, // Wompi envía directamente, no desde un navegador
    secrets: [SECRET_LLAVE_PRIVADA, SECRET_INTEGRIDAD, SECRET_EVENTOS],
  },
  async (req, res) => {
    // Los secrets solo están disponibles dentro del handler
    const secretoEventos = SECRET_EVENTOS.value();

    if (req.method !== "POST") {
      return res.status(405).send("Método no permitido");
    }

    const body     = req.body;
    const checksum = body?.signature?.checksum;
    const evento   = body?.event;

    console.log(`Webhook recibido: evento=${evento}`,
      `ref=${body?.data?.transaction?.reference}`);

    // ── 1. Verificar autenticidad del evento ─────────────────────────
    if (!verificarFirmaEvento(body, checksum, secretoEventos)) {
      console.error("Firma de evento inválida — solicitud rechazada");
      return res.status(401).send("Firma inválida");
    }

    // ── 2. Ignorar eventos que no sean actualizaciones de transacción ──
    if (evento !== "transaction.updated") {
      return res.status(200).send("Evento ignorado");
    }

    const tx = body?.data?.transaction;

    // ── 3. Solo procesar transacciones aprobadas ─────────────────────
    if (!tx || tx.status !== "APPROVED") {
      console.log(`Transacción ignorada: estado=${tx?.status}`);
      return res.status(200).send("Transacción no aprobada, ignorada");
    }

    const referencia = tx.reference;
    const monto      = tx.amount_in_cents;
    const email      = tx.customer_email;
    const txId       = tx.id;

    // ── 4. Idempotencia: no procesar el mismo pago dos veces ─────────
    const pagoRef  = db.collection("pagos").doc(txId);
    const pagoSnap = await pagoRef.get();

    if (pagoSnap.exists) {
      console.log(`Pago ya procesado anteriormente: txId=${txId}`);
      return res.status(200).send("Pago ya registrado");
    }

    // ── 5. Identificar al vendedor ───────────────────────────────────
    // Estrategia: primero por email, luego por fragmento de UID en la referencia
    let vendedor = await buscarVendedorPorEmail(email);

    if (!vendedor) {
      vendedor = await buscarVendedorPorReferencia(referencia);
    }

    if (!vendedor) {
      console.error(`Vendedor no encontrado: email=${email} | ref=${referencia}`);
      // Guardar el pago como "sin_vendedor" para revisión manual
      await pagoRef.set({
        tx_id:     txId,
        referencia,
        monto:     monto / 100,
        email,
        estado:    "sin_vendedor",
        creado_en: admin.firestore.FieldValue.serverTimestamp(),
        raw:       tx,
      });
      return res.status(200).send("Vendedor no encontrado — guardado para revisión");
    }

    const vendedorId = vendedor.id;
    const plan       = await determinarPlan(monto);

    // ── 6. Calcular la nueva fecha de fin de membresía ───────────────
    // Si ya tiene una membresía activa, se extiende desde su fecha de vencimiento.
    // Si no tiene, se calcula desde hoy.
    const membresiaActual = await db.collection("membresias")
      .where("vendedor_id", "==", vendedorId)
      .where("estado", "==", "activa")
      .orderBy("fecha_fin", "desc")
      .limit(1)
      .get();

    let nuevaFechaFin;

    if (!membresiaActual.empty) {
      const finActual = membresiaActual.docs[0].data().fecha_fin.toDate();
      // Extender desde el fin actual si todavía no venció; si venció, desde hoy
      const base = finActual > new Date() ? finActual : new Date();
      nuevaFechaFin = calcularFechaFin(plan.dias, base);
    } else {
      nuevaFechaFin = calcularFechaFin(plan.dias);
    }

    const ahora = admin.firestore.FieldValue.serverTimestamp();

    // ── 7. Transacción atómica en Firestore ──────────────────────────
    await db.runTransaction(async (t) => {

      // 7a. Marcar la membresía activa anterior como "renovada"
      if (!membresiaActual.empty) {
        membresiaActual.docs.forEach(d =>
          t.update(d.ref, { estado: "renovada", actualizado_en: ahora })
        );
      }

      // 7b. Crear la nueva membresía activa
      t.set(db.collection("membresias").doc(), {
        vendedor_id:   vendedorId,
        plan:          plan.nombre,
        plan_id:       plan.planId || null,
        dias:          plan.dias,
        duracion_dias: plan.dias,      // campo redundante para el frontend
        monto:         monto / 100,    // almacenar en COP, no en centavos
        estado:        "activa",
        fecha_inicio:  admin.firestore.Timestamp.now(),
        fecha_fin:     nuevaFechaFin,
        tx_id:         txId,
        referencia,
        creado_en:     ahora,
      });

      // 7c. Registrar el pago aprobado
      t.set(pagoRef, {
        vendedor_id: vendedorId,
        tx_id:       txId,
        referencia,
        monto:       monto / 100,
        plan:        plan.nombre,
        estado:      "aprobado",
        email,
        fecha_pago:  ahora,
        creado_en:   ahora,
      });

      // 7d. Activar al vendedor en el catálogo público
      t.update(db.collection("vendedores").doc(vendedorId), {
        estado:            "activo",
        ultima_renovacion: ahora,
      });
    });

    console.log(
      `✅ Membresía activada: vendedor=${vendedorId}`,
      `| plan=${plan.nombre} (${plan.dias} días)`,
      `| vence=${nuevaFechaFin.toDate().toISOString()}`
    );

    return res.status(200).send("OK");
  }
);