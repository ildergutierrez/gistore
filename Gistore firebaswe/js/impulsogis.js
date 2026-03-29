// impulsogis.js
// ─────────────────────────────────────────────────────────────
//  Dependencia en el HTML (antes de este script):
//    <script src="../js/colombia-ciudades.js"></script>
//
//  Requiere que servidor.py esté corriendo:
//    python servidor.py          (desarrollo: localhost:5000)
//    gunicorn servidor:app       (producción)
//
//  Cambia la constante API (línea ~25) a la URL de tu servidor.
// ─────────────────────────────────────────────────────────────

(() => {

  // ── URL del servidor Python ───────────────────────────────
  // En desarrollo: "http://localhost:5000"
  // En producción: "https://tudominio.com" (donde corre servidor.py)
  const API = "http://localhost:5000";

  // ── Destino de respaldo si el servidor no responde ────────
  const _D = [114,101,103,105,115,116,114,111,64,103,105,115,116,111,114,101,46,99,111,109,46,99,111]
    .map(c => String.fromCharCode(c)).join("");

  const $ = id => document.getElementById(id);

  const PLANES = {
    "Prueba":   { imp:"45",  dur:"7 días",  total:"315",   precio:"$5.000"  },
    "Básico":   { imp:"75",  dur:"15 días", total:"1.125", precio:"$12.000" },
    "Estándar": { imp:"100", dur:"15 días", total:"1.500", precio:"$20.000" },
    "Pro":      { imp:"150", dur:"30 días", total:"4.500", precio:"$40.000" },
    "Premium":  { imp:"250", dur:"30 días", total:"7.500", precio:"$65.000" },
  };

  // ── Animación de pasos en pantalla de éxito ───────────────
  function animarPasos(prefijo) {
    const paso1 = $(`${prefijo}1`);
    const paso2 = $(`${prefijo}2`);
    const paso3 = $(`${prefijo}3`);
    if (!paso1 || !paso2 || !paso3) return;

    // Estado inicial: paso 1 ya completado, paso 2 activo
    paso1.classList.remove("activo"); paso1.classList.add("hecho");
    paso2.classList.add("activo");

    // Tras 1.2s: paso 2 hecho, paso 3 activo (correo ya abierto)
    setTimeout(() => {
      paso2.classList.remove("activo"); paso2.classList.add("hecho");
      paso3.classList.add("activo");
    }, 1200);
  }

  function mostrarExito(idFormulario, idExito, idCheck, idTitulo, prefijoPasos, textoFinal) {
    $(idFormulario).style.display  = "none";
    $(idExito).style.display       = "flex";
    $(idExito).style.flexDirection = "column";
    animarPasos(prefijoPasos);

    // Tras animación: actualizar ícono y título
    setTimeout(() => {
      const check  = $(idCheck);
      const titulo = $(idTitulo);
      if (check)  check.textContent  = "✅";
      if (titulo) titulo.textContent = textoFinal;
    }, 1600);
  }

  // ── HELPERS ───────────────────────────────────────────────
  const vEmail = e => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e.trim());
  const vTel   = t => /^\d{7,15}$/.test(t.replace(/\s/g, ""));

  function showErr(id, msg) {
    const el = $(id);
    el.textContent = msg || "Completa todos los campos.";
    el.classList.add("visible");
    el.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }
  function hideErr(id) { $(id).classList.remove("visible"); }
  function markInv(id, bad) { const el = $(id); if (el) el.classList.toggle("invalido", bad); }

  function setLoading(btnId, txtId, spId, on, txt) {
    $(btnId).disabled         = on;
    $(txtId).textContent      = on ? "Enviando..." : txt;
    $(spId).style.display     = on ? "block" : "none";
  }

  // ── TABLA — selección interactiva ─────────────────────────
  let planActivo = null;

  document.querySelectorAll("#tablaPlanes tbody tr").forEach(tr => {
    tr.addEventListener("click", () => seleccionarPlan(tr.dataset.plan, tr));
    tr.querySelector(".plan-radio")?.addEventListener("click", e => {
      e.stopPropagation();
      seleccionarPlan(tr.dataset.plan, tr);
    });
  });

  function seleccionarPlan(plan, tr) {
    planActivo = plan;
    document.querySelectorAll("#tablaPlanes tbody tr").forEach(r => r.classList.remove("plan-seleccionado"));
    tr.classList.add("plan-seleccionado");
    const r = tr.querySelector(".plan-radio");
    if (r) r.checked = true;
    const sel = $("pub-plan");
    if (sel) sel.value = plan;
    actualizarResumen(plan);
  }

  function actualizarResumen(plan) {
    const d = PLANES[plan];
    if (!d) { $("pubPlanResumen").style.display = "none"; return; }
    $("prImp").textContent    = d.imp;
    $("prDur").textContent    = d.dur;
    $("prTotal").textContent  = d.total;
    $("prPrecio").textContent = d.precio;
    $("pubPlanResumen").style.display = "grid";
  }

  $("pub-plan")?.addEventListener("change", function () {
    planActivo = this.value || null;
    actualizarResumen(planActivo);
    if (planActivo) {
      document.querySelectorAll("#tablaPlanes tbody tr").forEach(tr => {
        const ok = tr.dataset.plan === planActivo;
        tr.classList.toggle("plan-seleccionado", ok);
        const r = tr.querySelector(".plan-radio");
        if (r) r.checked = ok;
      });
    }
  });

  // ── MODAL REGISTRO ────────────────────────────────────────
  function abrirReg() {
    $("modalOverlay").classList.add("abierto");
    document.body.style.overflow = "hidden";
    if (!window._ccIniciado) {
      ColombiaCiudades.init("campo-ciudad", { placeholder: "Escribe tu ciudad o municipio..." });
      window._ccIniciado = true;
    }
    setTimeout(() => $("campo-tienda")?.focus(), 80);
  }

  function cerrarReg() {
    $("modalOverlay").classList.remove("abierto");
    document.body.style.overflow = "";
    setTimeout(() => {
      $("modalFormulario").style.display  = "";
      $("modalExito").style.display       = "none";
      $("modalExito").style.flexDirection = "";
      ["pasoReg1","pasoReg2","pasoReg3"].forEach((id,i) => {
        const el = $(id); if (!el) return;
        el.classList.remove("activo","hecho");
        if (i === 0) el.classList.add("activo");
      });
      const chkR = $("exitoCheckReg"); if (chkR) chkR.textContent = "📨";
      const ttlR = $("exitoTituloReg"); if (ttlR) ttlR.textContent = "Abriendo tu correo…";
      ["campo-tienda", "campo-correo", "campo-whatsapp"].forEach(id => {
        const el = $(id); if (el) { el.value = ""; el.classList.remove("invalido"); }
      });
      const lbl = document.querySelector(".cc-trigger .cc-label");
      if (lbl) { lbl.textContent = "Escribe tu ciudad o municipio..."; lbl.classList.add("cc-placeholder"); }
      const hc = $("campo-ciudad"); if (hc) hc.value = "";
      hideErr("modalError");
      setLoading("btnEnviar", "btnTexto", "spinner", false, "Enviar solicitud");
    }, 300);
  }

  async function enviarReg() {
    hideErr("modalError");
    const tienda   = $("campo-tienda").value.trim();
    const ciudad   = $("campo-ciudad").value.trim();
    const correo   = $("campo-correo").value.trim();
    const whatsapp = $("campo-whatsapp").value.trim();

    let ok = true, msg = "";
    if (!tienda)                     { markInv("campo-tienda",   true); ok = false; msg = msg || "El nombre de la tienda es obligatorio."; } else markInv("campo-tienda",   false);
    if (!ciudad)                     {                                  ok = false; msg = msg || "Indica tu ciudad o municipio."; }
    if (!correo   || !vEmail(correo)){ markInv("campo-correo",   true); ok = false; msg = msg || "Ingresa un correo válido."; }           else markInv("campo-correo",   false);
    if (!whatsapp || !vTel(whatsapp)){ markInv("campo-whatsapp", true); ok = false; msg = msg || "Ingresa un WhatsApp válido."; }          else markInv("campo-whatsapp", false);

    if (!ok) { showErr("modalError", msg); return; }
    setLoading("btnEnviar", "btnTexto", "spinner", true, "");

    try {
      const res = await fetch(`${API}/api/registro`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          tienda, ciudad,
          correo,
          whatsapp: `+57 ${whatsapp}`,
        }),
      });

      const json = await res.json();
      if (!json.ok) throw new Error(json.error || "Error del servidor");

      mostrarExito(
        "modalFormulario", "modalExito",
        "exitoCheckReg", "exitoTituloReg",
        "pasoReg",
        "¡Solicitud enviada!"
      );

    } catch (err) {
      console.error("Registro:", err);
      // Fallback mailto si el servidor no responde
      const asunto = encodeURIComponent("Solicitud de registro — GI Store");
      const cuerpo = encodeURIComponent(
        `Hola, quiero solicitar mi registro en GI Store.\n\n` +
        `🏪 Tienda / Nombre: ${tienda}\n🌆 Ciudad: ${ciudad}\n` +
        `📧 Correo: ${correo}\n📱 WhatsApp: +57 ${whatsapp}`
      );
      // Mostrar éxito primero, luego abrir correo
      mostrarExito(
        "modalFormulario", "modalExito",
        "exitoCheckReg", "exitoTituloReg",
        "pasoReg",
        "¡Listo! Revisa tu correo"
      );
      await new Promise(r => setTimeout(r, 600));
      window.location.href = `mailto:${_D}?subject=${asunto}&body=${cuerpo}`;
    } finally {
      setLoading("btnEnviar", "btnTexto", "spinner", false, "Enviar solicitud");
    }
  }

  $("btnSolicitarRegistro")?.addEventListener("click", abrirReg);
  $("btnCerrar")            ?.addEventListener("click", cerrarReg);
  $("btnExitoCerrar")       ?.addEventListener("click", cerrarReg);
  $("btnEnviar")            ?.addEventListener("click", enviarReg);
  $("modalOverlay")         ?.addEventListener("click", e => { if (e.target === e.currentTarget) cerrarReg(); });

  // ── IMAGEN UPLOAD ─────────────────────────────────────────

  // ── MODAL PUBLICIDAD ──────────────────────────────────────
  function abrirPub() {
    $("modalPubOverlay").classList.add("abierto");
    document.body.style.overflow = "hidden";
    if (planActivo) { $("pub-plan").value = planActivo; actualizarResumen(planActivo); }
  }

  function cerrarPub() {
    $("modalPubOverlay").classList.remove("abierto");
    document.body.style.overflow = "";
    setTimeout(() => {
      $("modalPubFormulario").style.display  = "";
      $("modalPubExito").style.display       = "none";
      $("modalPubExito").style.flexDirection = "";
      ["pasoPub1","pasoPub2","pasoPub3"].forEach((id,i) => {
        const el = $(id); if (!el) return;
        el.classList.remove("activo","hecho");
        if (i === 0) el.classList.add("activo");
      });
      const chkP = $("exitoCheckPub"); if (chkP) chkP.textContent = "📨";
      const ttlP = $("exitoTituloPub"); if (ttlP) ttlP.textContent = "Abriendo tu correo…";
      ["pub-titulo", "pub-url", "pub-whatsapp", "pub-nombre", "pub-correo"].forEach(id => {
        const el = $(id); if (el) { el.value = ""; el.classList.remove("invalido"); }
      });
      $("pub-plan").value = planActivo || "";
      actualizarResumen(planActivo);
      hideErr("modalPubError");
      setLoading("btnEnviarPub", "btnPubTexto", "spinnerPub", false, "Enviar solicitud de pauta");
    }, 300);
  }

  async function enviarPub() {
    hideErr("modalPubError");

    const plan     = $("pub-plan").value;
    const titulo   = $("pub-titulo").value.trim();
    const url      = $("pub-url").value.trim();
    const whatsapp = $("pub-whatsapp").value.trim();
    const nombre   = $("pub-nombre").value.trim();
    const correo   = $("pub-correo").value.trim();

    let ok = true, msg = "";
    if (!plan)                     { $("pub-plan").classList.add("invalido");    ok = false; msg = msg || "Selecciona un plan."; }              else $("pub-plan").classList.remove("invalido");
    if (!titulo)                   { markInv("pub-titulo",   true);              ok = false; msg = msg || "El título es obligatorio."; }         else markInv("pub-titulo",   false);
    if (!url)                      { markInv("pub-url",      true);              ok = false; msg = msg || "La URL de destino es obligatoria."; } else markInv("pub-url",      false);
    if (!whatsapp||!vTel(whatsapp)){ markInv("pub-whatsapp", true);              ok = false; msg = msg || "Ingresa un WhatsApp válido."; }       else markInv("pub-whatsapp", false);
    if (!nombre)                   { markInv("pub-nombre",   true);              ok = false; msg = msg || "Tu nombre o empresa es obligatorio."; }else markInv("pub-nombre",   false);
    if (!correo||!vEmail(correo))  { markInv("pub-correo",   true);              ok = false; msg = msg || "Ingresa un correo válido."; }         else markInv("pub-correo",   false);

    if (!ok) { showErr("modalPubError", msg); return; }
    setLoading("btnEnviarPub", "btnPubTexto", "spinnerPub", true, "");

    const d = PLANES[plan] || {};

    // Armar mailto con todos los datos
    const asunto = encodeURIComponent(`Solicitud de publicidad — Plan ${plan} — GI Store`);
    const cuerpo = encodeURIComponent(
      `📣 SOLICITUD DE PUBLICIDAD — GI STORE\n` +
      `${"─".repeat(40)}\n\n` +
      `📋 PLAN SELECCIONADO\n` +
      `   Plan:              ${plan}\n` +
      `   Impresiones/día:   ${d.imp  || "—"}\n` +
      `   Duración:          ${d.dur  || "—"}\n` +
      `   Total impresiones: ${d.total|| "—"}\n` +
      `   Precio COP:        ${d.precio||"—"}\n\n` +
      `📝 DATOS DE LA CAMPAÑA\n` +
      `   Título:            ${titulo}\n` +
      `   URL de destino:    ${url}\n\n` +
      `👤 DATOS DE CONTACTO\n` +
      `   Nombre / Empresa:  ${nombre}\n` +
      `   Correo:            ${correo}\n` +
      `   WhatsApp:          +57 ${whatsapp}\n\n` +
      `${"─".repeat(40)}\n` +
      `⚠️  IMPORTANTE: Adjunta la imagen del banner antes de enviar este correo.`
    );

    // Mostrar pantalla de éxito con animación de pasos
    mostrarExito(
      "modalPubFormulario", "modalPubExito",
      "exitoCheckPub", "exitoTituloPub",
      "pasoPub",
      "¡Listo! Adjunta la imagen y envía"
    );
    setLoading("btnEnviarPub", "btnPubTexto", "spinnerPub", false, "Enviar solicitud de pauta");

    // Abrir correo tras breve pausa para que el usuario vea el paso 2
    await new Promise(r => setTimeout(r, 700));
    window.open(`mailto:${_D}?subject=${asunto}&body=${cuerpo}`, "_self");
  }

  $("btnSolicitarPublicidad")?.addEventListener("click", abrirPub);
  $("btnCerrarPub")          ?.addEventListener("click", cerrarPub);
  $("btnPubExitoCerrar")     ?.addEventListener("click", cerrarPub);
  $("btnEnviarPub")          ?.addEventListener("click", enviarPub);
  $("modalPubOverlay")       ?.addEventListener("click", e => { if (e.target === e.currentTarget) cerrarPub(); });

  document.addEventListener("keydown", e => {
    if (e.key === "Escape") { cerrarReg(); cerrarPub(); }
  });

})();