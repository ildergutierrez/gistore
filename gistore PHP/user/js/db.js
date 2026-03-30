// ============================================================
//  user/js/db.js — Operaciones CRUD Portal Vendedor (MySQL via API PHP)
//  Mismo contrato de exports que el original
// ============================================================
import {
  obtenerMiVendedor, actualizarMiVendedor,
  obtenerMiMembresia, obtenerMisProductos, obtenerMiCatalogo,
  obtenerCategorias,
  crearProducto, actualizarProducto, eliminarProducto, obtenerProducto,
  obtenerPlanes,
  membresiaVigente,
  obtenerFundadores, esFundadorVigente, contarFundadores,
  firmaWompi,
  sesionActual,
} from '../../js/api.js';

// ── Obtener vendedor por UID (sesión actual) ───────────────
async function obtenerVendedorPorUid(uid) {
  // En la nueva arquitectura el uid viene de la sesión PHP
  // El endpoint /me/vendedor ya devuelve el vendedor correcto
  return obtenerMiVendedor();
}

// ── Actualizar vendedor ────────────────────────────────────
async function actualizarVendedor(id, datos) {
  return actualizarMiVendedor(datos);
}

// ── Membresía del vendedor actual ──────────────────────────
async function obtenerMembresiaVendedor(vendedor_id) {
  return obtenerMiMembresia();
}

// ── Productos del vendedor actual ──────────────────────────
async function obtenerProductosPorVendedor(vendedor_id) {
  return obtenerMisProductos();
}

// ── Re-exportar helpers directos ─────────────────────────
export {
  obtenerVendedorPorUid,
  actualizarVendedor,
  obtenerMembresiaVendedor,
  obtenerProductosPorVendedor,
  obtenerCategorias,
  crearProducto, actualizarProducto, eliminarProducto, obtenerProducto,
  obtenerPlanes,
  membresiaVigente,
  obtenerFundadores, esFundadorVigente, contarFundadores,
  firmaWompi,
  sesionActual,
  // aliases para compatibilidad
  obtenerMiCatalogo,
};
