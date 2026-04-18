// ============================================================
//  ui.js — Helpers de interfaz compartidos
// ============================================================

// ── Fecha en español ───────────────────────────────────────
const DIAS  = ["Domingo","Lunes","Martes","Miércoles","Jueves","Viernes","Sábado"];
const MESES = ["enero","febrero","marzo","abril","mayo","junio",
               "julio","agosto","septiembre","octubre","noviembre","diciembre"];

function fechaHoy() {
  const h = new Date();
  return DIAS[h.getDay()] + ", " + h.getDate() + " de " + MESES[h.getMonth()] + " " + h.getFullYear();
}

// ── Formato de precio COP ──────────────────────────────────
function formatoPrecio(valor) {
  return "$ " + Number(valor).toLocaleString("es-CO");
}

// ── Mostrar / ocultar mensaje ──────────────────────────────
function mostrarMensaje(elId, texto, tipo = "error") {
  const el = document.getElementById(elId);
  if (!el) return;
  el.querySelector("span:last-child").textContent = texto;
  el.className = "msg-" + tipo + " visible";
}
function ocultarMensaje(elId) {
  const el = document.getElementById(elId);
  if (el) el.classList.remove("visible");
}

// ── Botón con estado de carga ──────────────────────────────
function btnCargando(btn, estado) {
  btn.disabled = estado;
  estado ? btn.classList.add("cargando") : btn.classList.remove("cargando");
}

// ── Badge de estado ────────────────────────────────────────
function badgeEstado(estado) {
  const mapa = {
    activo:     { clase: "activo",    texto: "Activo"     },
    inactivo:   { clase: "inactivo",  texto: "Inactivo"   },
    activa:     { clase: "activo",    texto: "Activa"     },
    vencida:    { clase: "vencida",   texto: "Vencida"    },
    suspendida: { clase: "suspendida",texto: "Suspendida" },
  };
  const s = mapa[estado] || { clase: "inactivo", texto: estado };
  return `<span class="badge badge-${s.clase}">${s.texto}</span>`;
}

// ── Modal: abrir / cerrar ──────────────────────────────────
function abrirModal(id) {
  const m = document.getElementById(id);
  if (m) m.classList.add("visible");
}
function cerrarModal(id) {
  const m = document.getElementById(id);
  if (m) m.classList.remove("visible");
}

// ── Confirmar acción destructiva ───────────────────────────
function confirmar(msg) {
  return window.confirm(msg);
}

export {
  fechaHoy, formatoPrecio,
  mostrarMensaje, ocultarMensaje,
  btnCargando, badgeEstado,
  abrirModal, cerrarModal, confirmar,
};