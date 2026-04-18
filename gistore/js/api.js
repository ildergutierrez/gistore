// ============================================================
//  gistore/js/api.js — Capa de datos pública (PHP + MySQL)
//  Token: backend/tokens.php (sesión PHP)
// ============================================================

const API_BASE = (() => {
  const isGH = window.location.hostname.includes('github.io');
  return isGH ? '/gistore/php' : '/php';
})();

const TOKEN_URL = (() => {
  const isGH = window.location.hostname.includes('github.io');
  return isGH ? '/gistore/backend/tokens.php' : '/backend/tokens.php';
})();

// ── Token de sesión ────────────────────────────────────────
// credentials:'include' es obligatorio para que PHP reciba
// la cookie de sesión y devuelva el mismo token que guardó.
let _tokenPublico = null;

async function obtenerToken() {
  if (_tokenPublico) return _tokenPublico;
  const r = await fetch(TOKEN_URL, { credentials: 'include' });
  if (!r.ok) throw new Error('No se pudo obtener el token');
  const d = await r.json();
  _tokenPublico = d.token;
  return _tokenPublico;
}

async function apiFetch(endpoint, params = {}) {
  const token = await obtenerToken();
  const qs    = new URLSearchParams({ token, ...params }).toString();
  const r     = await fetch(`${API_BASE}/${endpoint}?${qs}`, { credentials: 'include' });

  // Sesión caducada → renovar y reintentar una vez
  if (r.status === 403) {
    _tokenPublico = null;
    const token2  = await obtenerToken();
    const qs2     = new URLSearchParams({ token: token2, ...params }).toString();
    const r2      = await fetch(`${API_BASE}/${endpoint}?${qs2}`, { credentials: 'include' });
    if (!r2.ok) throw new Error(`API error ${r2.status}`);
    return r2.json();
  }
  if (!r.ok) throw new Error(`API error ${r.status}`);
  return r.json();
}

// ── Categorías ────────────────────────────────────────────
export async function obtenerCategorias() {
  const res = await apiFetch('categorias.php', { accion: 'obtener' });
  if (!res.ok) throw new Error(res.error || 'Error categorías');
  return res.datos;
}

// ── Todos los vendedores activos ──────────────────────────
export async function obtenerVendedores() {
  const res = await apiFetch('vendedores.php', { accion: 'vendedores' });
  if (!res.ok) throw new Error(res.error || 'Error vendedores');
  return res.datos;
}

// ── Un vendedor por ID ────────────────────────────────────
export async function obtenerVendedor(id) {
  const res = await apiFetch('vendedores.php', { accion: 'vendedor', id });
  if (!res.ok) throw new Error(res.error || 'Vendedor no encontrado');
  return res.datos;
}

// ── Todos los productos activos ───────────────────────────
export async function obtenerProductosActivos() {
  const res = await apiFetch('vendedores.php', { accion: 'productos' });
  if (!res.ok) throw new Error(res.error || 'Error productos');
  return res.datos;
}

// ── Productos de un vendedor específico ───────────────────
export async function obtenerProductosDeVendedor(vendedorId) {
  const res = await apiFetch('vendedores.php', { accion: 'productos_vendedor', id: vendedorId });
  if (!res.ok) throw new Error(res.error || 'Error productos vendedor');
  return res.datos;
}

// ── Un producto por ID ────────────────────────────────────
export async function obtenerProductoPorId(id) {
  const res = await apiFetch('vendedores.php', { accion: 'producto', id });
  if (!res.ok) throw new Error(res.error || 'Producto no encontrado');
  return res.datos;
}

// ── Publicidades activas ──────────────────────────────────
export async function obtenerPublicidadesActivas() {
  const res = await apiFetch('vendedores.php', { accion: 'publicidades' });
  if (!res.ok) throw new Error(res.error || 'Error publicidades');
  return res.datos;
}

// ── Registrar impresión de publicidad ─────────────────────
export async function incrementarImpresion(id) {
  return apiFetch('vendedores.php', { accion: 'impresion', id });
}