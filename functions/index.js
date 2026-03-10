// ============================================================
//  functions/index.js — GI Store
//  Cloud Function: webhook Wompi → activa membresía en Firestore
//  Secrets: WOMPI_LLAVE_PRIVADA, WOMPI_SECRETO_INTEGRIDAD,
//           WOMPI_SECRETO_EVENTOS (Firebase Secret Manager)
// ============================================================
const { onRequest } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");
const admin  = require("firebase-admin");
const crypto = require("crypto");

admin.initializeApp();
const db = admin.firestore();

// ── Declarar secrets (Firebase Secret Manager) ──────────────
const SECRET_LLAVE_PRIVADA     = defineSecret("WOMPI_LLAVE_PRIVADA");
const SECRET_INTEGRIDAD        = defineSecret("WOMPI_SECRETO_INTEGRIDAD");
const SECRET_EVENTOS           = defineSecret("WOMPI_SECRETO_EVENTOS");

// ── Utilidad: verificar firma del webhook ───────────────────
function verificarFirmaEvento(body, checksum, secretoEventos) {
  if (!secretoEventos) {
    console.warn("WOMPI_SECRETO_EVENTOS no disponible");
    return false;
  }
  const datos = [
    body.data?.transaction?.id             || "",
    body.data?.transaction?.status         || "",
    body.data?.transaction?.amount_in_cents || "",
    body.timestamp                         || "",
    secretoEventos
  ].join("");

  const hash = crypto.createHash("sha256").update(datos).digest("hex");
  return hash === checksum;
}

// ── Calcular nueva fecha fin de membresía ───────────────────
function calcularFechaFin(meses = 1) {
  const ahora = new Date();
  ahora.setMonth(ahora.getMonth() + meses);
  return admin.firestore.Timestamp.fromDate(ahora);
}

// ── Determinar plan por monto ───────────────────────────────
function determinarPlan(montoEnCentavos) {
  const monto = montoEnCentavos / 100;
  if (monto <= 10000) return { nombre: "Plan Fundador", meses: 1 };
  if (monto <= 25000) return { nombre: "Plan Estándar", meses: 1 };
  return { nombre: "Plan Estándar", meses: 1 };
}

// ── Extraer fragmento de UID desde la referencia ────────────
// Formato: GIS-{uid_8chars}-{monto}-{timestamp}
function extraerFragmentoUid(referencia, transaccion) {
  if (transaccion?.customer_email) return null; // se buscará por email
  const partes = (referencia || "").split("-");
  return partes.length >= 2 ? partes[1] : null;
}

// ── Buscar vendedor por email ───────────────────────────────
async function buscarVendedorPorEmail(email) {
  if (!email) return null;
  const snap = await db.collection("vendedores")
    .where("correo", "==", email)
    .limit(1)
    .get();
  return snap.empty ? null : { id: snap.docs[0].id, ...snap.docs[0].data() };
}

// ── Webhook principal ───────────────────────────────────────
exports.webhookWompi = onRequest(
  {
    region:  "us-central1",
    cors:    false,
    secrets: [SECRET_LLAVE_PRIVADA, SECRET_INTEGRIDAD, SECRET_EVENTOS]
  },
  async (req, res) => {

    // Leer secrets dentro del handler (disponibles solo en tiempo de ejecución)
    const WOMPI_SECRETO_EVENTOS    = SECRET_EVENTOS.value();
    const WOMPI_SECRETO_INTEGRIDAD = SECRET_INTEGRIDAD.value();

    // Solo aceptar POST
    if (req.method !== "POST") {
      return res.status(405).send("Método no permitido");
    }

    const body     = req.body;
    const checksum = body?.signature?.checksum;
    const evento   = body?.event;

    console.log("Webhook Wompi recibido:", evento,
      "ref:", body?.data?.transaction?.reference);

    // ── 1. Verificar firma ──────────────────────────────────
    if (!verificarFirmaEvento(body, checksum, WOMPI_SECRETO_EVENTOS)) {
      console.error("Firma inválida — posible petición fraudulenta");
      return res.status(401).send("Firma inválida");
    }

    // ── 2. Solo procesar pagos aprobados ────────────────────
    if (evento !== "transaction.updated") {
      return res.status(200).send("Evento ignorado");
    }

    const tx = body?.data?.transaction;
    if (!tx || tx.status !== "APPROVED") {
      console.log("Transacción no aprobada:", tx?.status);
      return res.status(200).send("Transacción no aprobada, ignorada");
    }

    const referencia = tx.reference;
    const monto      = tx.amount_in_cents;
    const email      = tx.customer_email;
    const txId       = tx.id;

    // ── 3. Evitar procesar dos veces el mismo pago ──────────
    const pagoRef  = db.collection("pagos").doc(txId);
    const pagoSnap = await pagoRef.get();
    if (pagoSnap.exists) {
      console.log("Pago ya procesado:", txId);
      return res.status(200).send("Pago ya registrado");
    }

    // ── 4. Buscar vendedor ──────────────────────────────────
    let vendedor = await buscarVendedorPorEmail(email);

    if (!vendedor) {
      const fragmento = extraerFragmentoUid(referencia, tx);
      if (fragmento) {
        const snap = await db.collection("vendedores")
          .orderBy("__name__")
          .startAt(fragmento)
          .endAt(fragmento + "\uf8ff")
          .limit(1)
          .get();
        if (!snap.empty) {
          vendedor = { id: snap.docs[0].id, ...snap.docs[0].data() };
        }
      }
    }

    if (!vendedor) {
      console.error("Vendedor no encontrado — email:", email, "ref:", referencia);
      await pagoRef.set({
        tx_id:     txId,
        referencia,
        monto:     monto / 100,
        email,
        estado:    "sin_vendedor",
        creado_en: admin.firestore.FieldValue.serverTimestamp(),
        raw:       tx
      });
      return res.status(200).send("Vendedor no encontrado, guardado para revisión");
    }

    const vendedorId = vendedor.id;
    const plan       = determinarPlan(monto);

    // ── 5. Buscar membresía activa existente ────────────────
    const memQ = await db.collection("membresias")
      .where("vendedor_id", "==", vendedorId)
      .where("estado", "==", "activa")
      .orderBy("fecha_fin", "desc")
      .limit(1)
      .get();

    // ── 6. Calcular nueva fecha fin ─────────────────────────
    let nuevaFechaFin;
    if (!memQ.empty) {
      const finActual = memQ.docs[0].data().fecha_fin.toDate();
      const base      = finActual > new Date() ? finActual : new Date();
      const extendida = new Date(base);
      extendida.setMonth(extendida.getMonth() + plan.meses);
      nuevaFechaFin = admin.firestore.Timestamp.fromDate(extendida);
    } else {
      nuevaFechaFin = calcularFechaFin(plan.meses);
    }

    const ahora = admin.firestore.FieldValue.serverTimestamp();

    // ── 7. Transacción atómica en Firestore ─────────────────
    await db.runTransaction(async (t) => {

      // 7a. Marcar membresías activas anteriores como renovadas
      if (!memQ.empty) {
        memQ.docs.forEach(d =>
          t.update(d.ref, { estado: "renovada", actualizado_en: ahora })
        );
      }

      // 7b. Crear nueva membresía
      t.set(db.collection("membresias").doc(), {
        vendedor_id:  vendedorId,
        plan:         plan.nombre,
        meses:        plan.meses,
        monto:        monto / 100,
        estado:       "activa",
        fecha_inicio: admin.firestore.Timestamp.now(),
        fecha_fin:    nuevaFechaFin,
        tx_id:        txId,
        referencia,
        creado_en:    ahora
      });

      // 7c. Registrar pago
      t.set(pagoRef, {
        vendedor_id: vendedorId,
        tx_id:       txId,
        referencia,
        monto:       monto / 100,
        plan:        plan.nombre,
        estado:      "aprobado",
        email,
        fecha_pago:  ahora,
        creado_en:   ahora
      });

      // 7d. Actualizar estado del vendedor
      t.update(db.collection("vendedores").doc(vendedorId), {
        estado:            "activo",
        ultima_renovacion: ahora
      });
    });

    console.log(
      `✅ Membresía activada: vendedor=${vendedorId}`,
      `plan=${plan.nombre}`,
      `hasta=${nuevaFechaFin.toDate().toISOString()}`
    );
    return res.status(200).send("OK");
  }
);