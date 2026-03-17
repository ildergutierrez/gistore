/**
 * colombia-ciudades.js
 * Carga todos los municipios y ciudades de Colombia
 * usando la API pública del DANE / datos.gov.co
 * y construye un combobox con búsqueda en tiempo real.
 *
 * Uso:
 *   <script src="colombia-ciudades.js"></script>
 *   ColombiaCiudades.init("id-del-input");
 */

const ColombiaCiudades = (() => {

  // ── Cache en memoria ──────────────────────────────────────────
  let _ciudades = [];          // ["Bogotá D.C.", "Medellín", ...]
  let _cargado  = false;
  let _cargando = false;
  let _callbacks = [];

  // ── API pública del DANE (DIVIPOLA) ───────────────────────────
  // Fuente: https://www.datos.gov.co/resource/gdxc-w37w.json
  // Límite máximo por petición: 1000. Colombia tiene ~1122 municipios,
  // hacemos 2 peticiones con offset para cubrirlos todos.
  const API_BASE = "https://www.datos.gov.co/resource/gdxc-w37w.json";
  const CAMPOS   = "$select=nom_mpio,nom_dpto&$order=nom_mpio ASC";

  async function _fetchPagina(offset, limit = 1200) {
    const url = `${API_BASE}?${CAMPOS}&$limit=${limit}&$offset=${offset}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  }

  async function _cargarCiudades() {
    if (_cargado)  return _ciudades;
    if (_cargando) return new Promise(r => _callbacks.push(r));

    _cargando = true;

    try {
      // Una sola petición con límite alto cubre todos los municipios (~1122)
      const datos = await _fetchPagina(0, 1200);

      // Construir "Municipio, Departamento" y deduplicar
      const set = new Set();
      datos.forEach(d => {
        if (d.nom_mpio && d.nom_dpto) {
          const label = _capitalizar(d.nom_mpio) + ", " + _capitalizar(d.nom_dpto);
          set.add(label);
        }
      });

      _ciudades = [...set].sort((a, b) => a.localeCompare(b, "es"));
      _cargado  = true;
    } catch (err) {
      console.warn("ColombiaCiudades: fallo API externa, usando lista base.", err);
      _ciudades = _listaBase();
      _cargado  = true;
    }

    _cargando = false;
    _callbacks.forEach(r => r(_ciudades));
    _callbacks = [];
    return _ciudades;
  }

  function _capitalizar(str) {
    return str
      .toLowerCase()
      .split(" ")
      .map(p => p.charAt(0).toUpperCase() + p.slice(1))
      .join(" ");
  }

  // ── Constructor del combobox ──────────────────────────────────
  /**
   * init(inputId, opciones)
   * @param {string} inputId  - ID del <input> que se convertirá en combobox
   * @param {object} opciones
   *   maxResultados {number}  - máx items en dropdown (default 8)
   *   placeholder   {string}  - placeholder del input
   *   onSelect      {fn}      - callback(valorSeleccionado)
   */
  function init(inputId, opciones = {}) {
    const input = document.getElementById(inputId);
    if (!input) { console.error(`ColombiaCiudades: no encontré #${inputId}`); return; }

    const cfg = {
      maxResultados: opciones.maxResultados || 8,
      placeholder:   opciones.placeholder   || "Escribe tu ciudad o municipio...",
      onSelect:      opciones.onSelect       || null,
    };

    input.setAttribute("placeholder", cfg.placeholder);
    input.setAttribute("autocomplete", "off");
    input.setAttribute("role", "combobox");
    input.setAttribute("aria-autocomplete", "list");
    input.setAttribute("aria-expanded", "false");

    // Contenedor relativo para el dropdown
    let wrapper = input.parentElement;
    if (!wrapper.classList.contains("cc-wrapper")) {
      const w = document.createElement("div");
      w.className = "cc-wrapper";
      input.parentNode.insertBefore(w, input);
      w.appendChild(input);
      wrapper = w;
    }

    // Dropdown
    const lista = document.createElement("ul");
    lista.className = "cc-lista";
    lista.setAttribute("role", "listbox");
    lista.style.display = "none";
    wrapper.appendChild(lista);

    // Inyectar estilos si no existen
    _inyectarEstilos();

    // Estado
    let indiceActivo = -1;
    let ciudadesFiltradas = [];

    // Mostrar spinner mientras carga
    input.style.backgroundImage = "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='18' height='18' viewBox='0 0 24 24' fill='none' stroke='%236b7280' stroke-width='2'%3E%3Ccircle cx='12' cy='12' r='10' stroke-dasharray='31.4' stroke-dashoffset='10'%3E%3CanimateTransform attributeName='transform' type='rotate' from='0 12 12' to='360 12 12' dur='.7s' repeatCount='indefinite'/%3E%3C/circle%3E%3C/svg%3E\")";
    input.style.backgroundRepeat   = "no-repeat";
    input.style.backgroundPosition = "right .75rem center";
    input.style.paddingRight       = "2.5rem";

    _cargarCiudades().then(() => {
      input.style.backgroundImage = "";
      input.style.paddingRight    = "";
    });

    // ── Eventos ──
    input.addEventListener("input", () => {
      const q = input.value.trim();
      if (q.length < 2) { cerrarLista(); return; }
      filtrar(q);
    });

    input.addEventListener("keydown", e => {
      if (lista.style.display === "none") return;
      if (e.key === "ArrowDown") {
        e.preventDefault();
        indiceActivo = Math.min(indiceActivo + 1, ciudadesFiltradas.length - 1);
        resaltar();
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        indiceActivo = Math.max(indiceActivo - 1, -1);
        resaltar();
      } else if (e.key === "Enter") {
        e.preventDefault();
        if (indiceActivo >= 0) seleccionar(ciudadesFiltradas[indiceActivo]);
      } else if (e.key === "Escape") {
        cerrarLista();
      }
    });

    input.addEventListener("blur", () => {
      // Pequeño delay para que el click en item funcione
      setTimeout(cerrarLista, 150);
    });

    input.addEventListener("focus", () => {
      const q = input.value.trim();
      if (q.length >= 2) filtrar(q);
    });

    function filtrar(q) {
      const qNorm = _normalizar(q);
      ciudadesFiltradas = _ciudades
        .filter(c => _normalizar(c).includes(qNorm))
        .slice(0, cfg.maxResultados);

      if (ciudadesFiltradas.length === 0) { cerrarLista(); return; }

      lista.innerHTML = "";
      indiceActivo = -1;

      ciudadesFiltradas.forEach((ciudad, i) => {
        const li = document.createElement("li");
        li.className = "cc-item";
        li.setAttribute("role", "option");
        li.setAttribute("data-idx", i);
        li.innerHTML = _resaltarCoincidencia(ciudad, q);
        li.addEventListener("mousedown", () => seleccionar(ciudad));
        lista.appendChild(li);
      });

      lista.style.display = "block";
      input.setAttribute("aria-expanded", "true");
    }

    function resaltar() {
      [...lista.querySelectorAll(".cc-item")].forEach((li, i) => {
        li.classList.toggle("cc-item--activo", i === indiceActivo);
        if (i === indiceActivo) li.scrollIntoView({ block: "nearest" });
      });
    }

    function seleccionar(ciudad) {
      input.value = ciudad;
      cerrarLista();
      if (cfg.onSelect) cfg.onSelect(ciudad);
      // Disparar evento nativo para que funcione con cualquier framework
      input.dispatchEvent(new Event("change", { bubbles: true }));
    }

    function cerrarLista() {
      lista.style.display = "none";
      input.setAttribute("aria-expanded", "false");
      indiceActivo = -1;
    }
  }

  // ── Helpers ──────────────────────────────────────────────────
  function _normalizar(s) {
    return s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  }

  function _resaltarCoincidencia(texto, query) {
    const norm   = _normalizar(texto);
    const qNorm  = _normalizar(query);
    const idx    = norm.indexOf(qNorm);
    if (idx === -1) return _escaparHtml(texto);
    return (
      _escaparHtml(texto.slice(0, idx)) +
      `<mark>${_escaparHtml(texto.slice(idx, idx + query.length))}</mark>` +
      _escaparHtml(texto.slice(idx + query.length))
    );
  }

  function _escaparHtml(s) {
    return s.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
  }

  function _inyectarEstilos() {
    if (document.getElementById("cc-styles")) return;
    const s = document.createElement("style");
    s.id = "cc-styles";
    s.textContent = `
      .cc-wrapper { position: relative; }
      .cc-lista {
        position: absolute; top: calc(100% + 4px); left: 0; right: 0; z-index: 9999;
        background: #fff; border: 1.5px solid #d1d5db; border-radius: 10px;
        box-shadow: 0 8px 24px rgba(0,0,0,.12); padding: .3rem 0;
        max-height: 240px; overflow-y: auto; margin: 0; list-style: none;
        font-family: 'Segoe UI', system-ui, sans-serif; font-size: .92rem;
      }
      .cc-item {
        padding: .55rem 1rem; cursor: pointer; color: #1a2e22;
        transition: background .1s; line-height: 1.4;
      }
      .cc-item:hover, .cc-item--activo {
        background: #e8f5ee; color: #1a6b3c;
      }
      .cc-item mark {
        background: transparent; color: #1a6b3c;
        font-weight: 700; text-decoration: underline;
      }
      /* scrollbar sutil */
      .cc-lista::-webkit-scrollbar { width: 5px; }
      .cc-lista::-webkit-scrollbar-track { background: transparent; }
      .cc-lista::-webkit-scrollbar-thumb { background: #d1ead9; border-radius: 999px; }
    `;
    document.head.appendChild(s);
  }

  // ── Lista base (fallback si la API falla) ─────────────────────
  // Principales ciudades y capitales de departamento
  function _listaBase() {
    return [
      "Bogotá D.C., Cundinamarca","Medellín, Antioquia","Cali, Valle del Cauca",
      "Barranquilla, Atlántico","Cartagena, Bolívar","Cúcuta, Norte de Santander",
      "Bucaramanga, Santander","Pereira, Risaralda","Santa Marta, Magdalena",
      "Ibagué, Tolima","Manizales, Caldas","Pasto, Nariño","Neiva, Huila",
      "Villavicencio, Meta","Armenia, Quindío","Valledupar, Cesar",
      "Montería, Córdoba","Sincelejo, Sucre","Popayán, Cauca","Tunja, Boyacá",
      "Florencia, Caquetá","Quibdó, Chocó","Riohacha, La Guajira",
      "Yopal, Casanare","Arauca, Arauca","Mocoa, Putumayo","Leticia, Amazonas",
      "Mitú, Vaupés","Inírida, Guainía","San José del Guaviare, Guaviare",
      "Puerto Carreño, Vichada","Buenaventura, Valle del Cauca",
      "Bello, Antioquia","Soledad, Atlántico","Soacha, Cundinamarca",
      "Itagüí, Antioquia","Palmira, Valle del Cauca","Envigado, Antioquia",
    ].sort((a,b) => a.localeCompare(b,"es"));
  }

  // ── API pública ───────────────────────────────────────────────
  return { init, cargar: _cargarCiudades };

})();


/* ══════════════════════════════════════════════════════════════
   MODAL — SOLICITAR REGISTRO
   Toda la lógica del modal, validación y envío por correo.
══════════════════════════════════════════════════════════════ */
(() => {

  const DESTINO = "aplicativosawebs+gistore@gmail.com";

  // ── Referencias DOM ──────────────────────────────────────────
  const overlay     = () => document.getElementById("modalOverlay");
  const formulario  = () => document.getElementById("modalFormulario");
  const exito       = () => document.getElementById("modalExito");
  const errorBox    = () => document.getElementById("modalError");
  const btnEnviar   = () => document.getElementById("btnEnviar");
  const btnTexto    = () => document.getElementById("btnTexto");
  const spinner     = () => document.getElementById("spinner");

  const campo = id => document.getElementById(id);

  // ── Modal: abrir / cerrar ────────────────────────────────────
  function abrirModal() {
    overlay().classList.add("abierto");
    document.body.style.overflow = "hidden";

    // Inicializar combobox de ciudades una sola vez
    if (!window._ccIniciado) {
      ColombiaCiudades.init("campo-ciudad", {
        placeholder:   "Escribe tu ciudad o municipio...",
        maxResultados: 8,
      });
      window._ccIniciado = true;
    }

    campo("campo-tienda").focus();
  }

  function cerrarModal() {
    overlay().classList.remove("abierto");
    document.body.style.overflow = "";

    setTimeout(() => {
      formulario().style.display = "";
      exito().style.display      = "none";
      exito().style.flexDirection = "";
      ["campo-tienda", "campo-ciudad", "campo-correo", "campo-whatsapp"]
        .forEach(id => { campo(id).value = ""; });
      ocultarError();
      setLoading(false);
    }, 300);
  }

  // ── Error / loading ──────────────────────────────────────────
  function mostrarError(msg) {
    errorBox().textContent = msg || "Por favor completa todos los campos correctamente.";
    errorBox().classList.add("visible");
  }

  function ocultarError() {
    errorBox().classList.remove("visible");
  }

  function setLoading(on) {
    btnEnviar().disabled    = on;
    btnTexto().textContent  = on ? "Enviando..." : "Enviar solicitud";
    spinner().style.display = on ? "block" : "none";
  }

  // ── Validaciones ─────────────────────────────────────────────
  function validarEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }

  function validarTel(tel) {
    return /^\d{7,15}$/.test(tel.replace(/\s/g, ""));
  }

  // ── Envío ────────────────────────────────────────────────────
  async function enviarFormulario() {
    ocultarError();

    const tienda   = campo("campo-tienda").value.trim();
    const ciudad   = campo("campo-ciudad").value.trim();
    const correo   = campo("campo-correo").value.trim();
    const whatsapp = campo("campo-whatsapp").value.trim();

    if (!tienda)                          return mostrarError("El nombre de la tienda o tu nombre es requerido.");
    if (!ciudad)                          return mostrarError("Indica tu ciudad o municipio.");
    if (!correo || !validarEmail(correo)) return mostrarError("Ingresa un correo electrónico válido.");
    if (!whatsapp || !validarTel(whatsapp)) return mostrarError("Ingresa un número de WhatsApp válido (solo dígitos).");

    setLoading(true);

    const asunto = encodeURIComponent("Solicitud de registro — GI Store");
    const cuerpo = encodeURIComponent(
      `Hola, quiero solicitar mi registro en GI Store.\n\n` +
      `🏪 Tienda / Nombre: ${tienda}\n` +
      `🌆 Ciudad: ${ciudad}\n` +
      `📧 Correo: ${correo}\n` +
      `📱 WhatsApp: +57 ${whatsapp}`
    );

    await new Promise(r => setTimeout(r, 800));
    window.location.href = `mailto:${DESTINO}?subject=${asunto}&body=${cuerpo}`;

    formulario().style.display  = "none";
    exito().style.display       = "flex";
    exito().style.flexDirection = "column";
    setLoading(false);
  }

  // ── Bind de eventos al cargar el DOM ─────────────────────────
  document.addEventListener("DOMContentLoaded", () => {

    // Botón "Solicitar registro"
    document.getElementById("btnSolicitarRegistro")
      ?.addEventListener("click", abrirModal);

    // Botón ✕ del modal
    document.getElementById("btnCerrar")
      ?.addEventListener("click", cerrarModal);

    // Botón "Cerrar" pantalla éxito
    document.getElementById("btnExitoCerrar")
      ?.addEventListener("click", cerrarModal);

    // Botón "Enviar solicitud"
    document.getElementById("btnEnviar")
      ?.addEventListener("click", enviarFormulario);

    // Click en el overlay (fuera del modal)
    document.getElementById("modalOverlay")
      ?.addEventListener("click", e => {
        if (e.target === e.currentTarget) cerrarModal();
      });

    // Tecla Escape
    document.addEventListener("keydown", e => {
      if (e.key === "Escape") cerrarModal();
    });

  });

})();