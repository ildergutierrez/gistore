// ============================================================
//  functions/index.js — GI Store Cloud Functions
//  Versión: 2026-03-17
//
//  Funciones exportadas:
//    · firmaWompi        → firma SHA-256 para el widget de pago
//    · webhookWompi      → activa membresía al recibir pago aprobado
//    · gestionarUsuario  → deshabilita/habilita cuentas en Firebase Auth
//
//  Secrets requeridos en Firebase Secret Manager:
//    · WOMPI_LLAVE_PRIVADA
//    · WOMPI_SECRETO_INTEGRIDAD
//    · WOMPI_SECRETO_EVENTOS
// ============================================================

const { onRequest } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");
const admin  = require("firebase-admin");
const crypto = require("crypto");

admin.initializeApp();
const db = admin.firestore();

const SECRET_LLAVE_PRIVADA = defineSecret("WOMPI_LLAVE_PRIVADA");
const SECRET_INTEGRIDAD    = defineSecret("WOMPI_SECRETO_INTEGRIDAD");
const SECRET_EVENTOS       = defineSecret("WOMPI_SECRETO_EVENTOS");

// ════════════════════════════════════════════════════════════
//  HELPERS INTERNOS
// ════════════════════════════════════════════════════════════

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

function calcularFechaFin(dias = 30, desde = new Date()) {
  const fecha = new Date(desde);
  fecha.setDate(fecha.getDate() + dias);
  return admin.firestore.Timestamp.fromDate(fecha);
}

async function determinarPlan(montoEnCentavos) {
  const montoCOP = montoEnCentavos / 100;
  try {
    const snapshot = await db.collection("planes_membresia")
      .where("activo", "==", true).get();
    if (!snapshot.empty) {
      const planes = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      const coincidenciaExacta = planes.find(p =>
        Math.abs((p.precio || 0) - montoCOP) / Math.max(montoCOP, 1) <= 0.01
      );
      if (coincidenciaExacta) return { nombre: coincidenciaExacta.nombre, dias: Number(coincidenciaExacta.duracion_dias) || 30, planId: coincidenciaExacta.id };
      const candidatos = planes.filter(p => (p.precio || 0) <= montoCOP).sort((a, b) => b.precio - a.precio);
      if (candidatos.length > 0) return { nombre: candidatos[0].nombre, dias: Number(candidatos[0].duracion_dias) || 30, planId: candidatos[0].id };
      planes.sort((a, b) => a.precio - b.precio);
      return { nombre: planes[0].nombre, dias: Number(planes[0].duracion_dias) || 30, planId: planes[0].id };
    }
  } catch (error) { console.error("Error consultando planes_membresia:", error.message); }
  console.warn("Usando fallback de planes hardcodeados");
  if (montoCOP <= 17000) return { nombre: "Plan Fundador", dias: 30, planId: null };
  return { nombre: "Plan Estándar", dias: 30, planId: null };
}

async function buscarVendedorPorEmail(email) {
  if (!email) return null;
  const snap = await db.collection("vendedores").where("correo", "==", email).limit(1).get();
  return snap.empty ? null : { id: snap.docs[0].id, ...snap.docs[0].data() };
}

async function buscarVendedorPorReferencia(referencia) {
  const partes = (referencia || "").split("-");
  if (partes.length < 2) return null;
  const fragmento = partes[1];
  const snap = await db.collection("vendedores")
    .orderBy("__name__").startAt(fragmento).endAt(fragmento + "\uf8ff").limit(1).get();
  return snap.empty ? null : { id: snap.docs[0].id, ...snap.docs[0].data() };
}

// ════════════════════════════════════════════════════════════
//  FUNCIÓN 1: firmaWompi
// ════════════════════════════════════════════════════════════

exports.firmaWompi = onRequest(
  {
    region:  "us-central1",
    cors:    ["https://ildergutierrez.github.io", "http://localhost", "http://127.0.0.1"],
    secrets: [SECRET_INTEGRIDAD],
  },
  async (req, res) => {
    if (req.method !== "POST") return res.status(405).send("Método no permitido");
    const { referencia, montoEnCentavos } = req.body || {};
    if (!referencia || !montoEnCentavos || Number(montoEnCentavos) <= 0)
      return res.status(400).json({ error: "Parámetros inválidos o faltantes" });
    const secreto = SECRET_INTEGRIDAD.value();
    const cadena  = `${referencia}${montoEnCentavos}COP${secreto}`;
    const firma   = crypto.createHash("sha256").update(cadena).digest("hex");
    return res.status(200).json({ firma });
  }
);

// ════════════════════════════════════════════════════════════
//  FUNCIÓN 2: webhookWompi
// ════════════════════════════════════════════════════════════

exports.webhookWompi = onRequest(
  {
    region:  "us-central1",
    cors:    false,
    secrets: [SECRET_LLAVE_PRIVADA, SECRET_INTEGRIDAD, SECRET_EVENTOS],
  },
  async (req, res) => {
    const secretoEventos = SECRET_EVENTOS.value();
    if (req.method !== "POST") return res.status(405).send("Método no permitido");
    const body     = req.body;
    const checksum = body?.signature?.checksum;
    const evento   = body?.event;
    console.log(`Webhook recibido: evento=${evento}`, `ref=${body?.data?.transaction?.reference}`);
    if (!verificarFirmaEvento(body, checksum, secretoEventos)) {
      console.error("Firma de evento inválida — solicitud rechazada");
      return res.status(401).send("Firma inválida");
    }
    if (evento !== "transaction.updated") return res.status(200).send("Evento ignorado");
    const tx = body?.data?.transaction;
    if (!tx || tx.status !== "APPROVED") {
      console.log(`Transacción ignorada: estado=${tx?.status}`);
      return res.status(200).send("Transacción no aprobada, ignorada");
    }
    const referencia = tx.reference;
    const monto      = tx.amount_in_cents;
    const email      = tx.customer_email;
    const txId       = tx.id;
    const pagoRef    = db.collection("pagos").doc(txId);
    const pagoSnap   = await pagoRef.get();
    if (pagoSnap.exists) { console.log(`Pago ya procesado: txId=${txId}`); return res.status(200).send("Pago ya registrado"); }
    let vendedor = await buscarVendedorPorEmail(email);
    if (!vendedor) vendedor = await buscarVendedorPorReferencia(referencia);
    if (!vendedor) {
      console.error(`Vendedor no encontrado: email=${email} | ref=${referencia}`);
      await pagoRef.set({ tx_id: txId, referencia, monto: monto / 100, email, estado: "sin_vendedor", creado_en: admin.firestore.FieldValue.serverTimestamp(), raw: tx });
      return res.status(200).send("Vendedor no encontrado — guardado para revisión");
    }
    const vendedorId      = vendedor.id;
    const plan            = await determinarPlan(monto);
    const membresiaActual = await db.collection("membresias")
      .where("vendedor_id", "==", vendedorId).where("estado", "==", "activa")
      .orderBy("fecha_fin", "desc").limit(1).get();
    let nuevaFechaFin;
    if (!membresiaActual.empty) {
      const finActual = membresiaActual.docs[0].data().fecha_fin.toDate();
      nuevaFechaFin   = calcularFechaFin(plan.dias, finActual > new Date() ? finActual : new Date());
    } else {
      nuevaFechaFin = calcularFechaFin(plan.dias);
    }
    const ahora = admin.firestore.FieldValue.serverTimestamp();
    await db.runTransaction(async (t) => {
      if (!membresiaActual.empty) membresiaActual.docs.forEach(d => t.update(d.ref, { estado: "renovada", actualizado_en: ahora }));
      t.set(db.collection("membresias").doc(), { vendedor_id: vendedorId, plan: plan.nombre, plan_id: plan.planId || null, dias: plan.dias, duracion_dias: plan.dias, monto: monto / 100, estado: "activa", fecha_inicio: admin.firestore.Timestamp.now(), fecha_fin: nuevaFechaFin, tx_id: txId, referencia, creado_en: ahora });
      t.set(pagoRef, { vendedor_id: vendedorId, tx_id: txId, referencia, monto: monto / 100, plan: plan.nombre, estado: "aprobado", email, fecha_pago: ahora, creado_en: ahora });
      t.update(db.collection("vendedores").doc(vendedorId), { estado: "activo", ultima_renovacion: ahora });
    });
    console.log(`✅ Membresía activada: vendedor=${vendedorId} | plan=${plan.nombre} (${plan.dias} días) | vence=${nuevaFechaFin.toDate().toISOString()}`);
    return res.status(200).send("OK");
  }
);

// ════════════════════════════════════════════════════════════
//  FUNCIÓN 3: gestionarUsuario
//
//  Deshabilita o habilita una cuenta en Firebase Auth usando
//  el Admin SDK. El cliente (admin panel) no puede hacer esto
//  directamente — solo el servidor tiene ese permiso.
//
//  POST { uid: string, accion: "deshabilitar" | "habilitar" }
//
//  Seguridad: verifica el ID Token del admin en el header
//  Authorization: Bearer <idToken>
// ════════════════════════════════════════════════════════════

exports.gestionarUsuario = onRequest(
  {
    region: "us-central1",
    cors:   false,
  },
  async (req, res) => {
    // CORS manual — el admin panel está en GitHub Pages
    res.set("Access-Control-Allow-Origin",  "*");
    res.set("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.set("Access-Control-Allow-Headers", "Content-Type, Authorization");

    if (req.method === "OPTIONS") { res.status(204).send(""); return; }
    if (req.method !== "POST")    { res.status(405).json({ error: "Método no permitido" }); return; }

    // ── 1. Verificar ID Token del admin ───────────────────
    const authHeader = (req.headers.authorization || "");
    const idToken    = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;

    if (!idToken) {
      res.status(401).json({ error: "No autorizado: falta token." });
      return;
    }

    let decoded;
    try {
      decoded = await admin.auth().verifyIdToken(idToken);
    } catch (e) {
      res.status(401).json({ error: "Token inválido: " + e.message });
      return;
    }

    const ADMIN_EMAIL = "aplicativosawebs@gmail.com";
    if ((decoded.email || "").toLowerCase() !== ADMIN_EMAIL.toLowerCase()) {
      res.status(403).json({ error: "Acceso denegado: solo el administrador." });
      return;
    }

    // ── 2. Validar body ───────────────────────────────────
    const { uid, accion } = req.body || {};

    if (!uid || typeof uid !== "string") {
      res.status(400).json({ error: "Falta el campo 'uid'." });
      return;
    }
    if (accion !== "deshabilitar" && accion !== "habilitar") {
      res.status(400).json({ error: "El campo 'accion' debe ser 'deshabilitar' o 'habilitar'." });
      return;
    }

    // ── 3. Actualizar cuenta en Firebase Auth ─────────────
    try {
      const disabled = (accion === "deshabilitar");
      await admin.auth().updateUser(uid, { disabled });

      console.log(`[gestionarUsuario] uid=${uid} → disabled=${disabled} por ${decoded.email}`);
      res.status(200).json({ ok: true, uid, disabled });

    } catch (e) {
      // uid no existe en Auth — vendedor sin cuenta registrada, no es error crítico
      if (e.code === "auth/user-not-found") {
        console.warn(`[gestionarUsuario] uid=${uid} no encontrado en Auth — se omite`);
        res.status(200).json({ ok: true, uid, sinCuenta: true });
        return;
      }
      console.error("[gestionarUsuario] Error:", e);
      res.status(500).json({ error: e.message });
    }
  }
);