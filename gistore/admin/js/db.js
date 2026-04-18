// ============================================================
//  admin/js/db.js — Operaciones CRUD (MySQL via API PHP)
//  Reemplaza Firestore + Cloud Functions
//  Mismo contrato de exports que el original
// ============================================================
import {
  obtenerVendedores, obtenerVendedor, obtenerVendedoresDesactivados,
  crearVendedor, actualizarVendedor, desactivarVendedor, reactivarVendedor,
  crearCuentaVendedor, actualizarProductosVendedor,
  obtenerMembresias, obtenerMembresia,
  crearMembresia, actualizarMembresia, eliminarMembresia,
  obtenerFundadores, esFundadorVigente, registrarFundador, contarFundadores,
  obtenerCategorias, crearCategoria, actualizarCategoria, eliminarCategoria,
  obtenerProductos, obtenerProductosActivos,
  obtenerProductosPorVendedor, obtenerProducto,
  crearProducto, actualizarProducto, eliminarProducto,
  membresiaVigente,
  obtenerPlanes, crearPlan, actualizarPlan, eliminarPlan,
  obtenerPublicidades, obtenerPublicidadesActivas,
  crearPublicidad, actualizarPublicidad, eliminarPublicidad,
  leerImpresionesHoy, incrementarImpresion,
  obtenerTodosHilosForo, obtenerRespuestasPorHilo,
  eliminarHiloForo, eliminarRespuestaForoAdmin,
  obtenerClavesApi, obtenerClaveApiPorServicio,
  crearClaveApi, actualizarClaveApi, eliminarClaveApi,
  obtenerStatsAdmin,
} from '../../js/api.js';

export {
  obtenerVendedores, obtenerVendedor, obtenerVendedoresDesactivados,
  crearVendedor, actualizarVendedor, desactivarVendedor, reactivarVendedor,
  crearCuentaVendedor, actualizarProductosVendedor,
  obtenerMembresias, obtenerMembresia,
  crearMembresia, actualizarMembresia, eliminarMembresia,
  obtenerFundadores, esFundadorVigente, registrarFundador, contarFundadores,
  obtenerCategorias, crearCategoria, actualizarCategoria, eliminarCategoria,
  obtenerProductos, obtenerProductosActivos,
  obtenerProductosPorVendedor, obtenerProducto,
  crearProducto, actualizarProducto, eliminarProducto,
  membresiaVigente,
  obtenerPlanes, crearPlan, actualizarPlan, eliminarPlan,
  obtenerPublicidades, obtenerPublicidadesActivas,
  crearPublicidad, actualizarPublicidad, eliminarPublicidad,
  leerImpresionesHoy, incrementarImpresion,
  obtenerTodosHilosForo, obtenerRespuestasPorHilo,
  eliminarHiloForo, eliminarRespuestaForoAdmin,
  obtenerClavesApi, obtenerClaveApiPorServicio,
  crearClaveApi, actualizarClaveApi, eliminarClaveApi,
  obtenerStatsAdmin,
};
