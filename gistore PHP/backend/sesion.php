<?php
// ============================================================
//  gistore/backend/sesion.php — Verificación de sesión activa
// ============================================================
session_start();
header('Content-Type: application/json');

// ── Helpers ───────────────────────────────────────────────
function ok(mixed $datos = null): never
{
    echo json_encode(['ok' => true, 'datos' => $datos], JSON_UNESCAPED_UNICODE);
    exit;
}
function error_respuesta(string $msg, int $codigo = 400): never
{
    http_response_code($codigo);
    echo json_encode(['ok' => false, 'error' => $msg], JSON_UNESCAPED_UNICODE);
    exit;
}

// ── Validar GETs ─────────────────────────────────────────
$accion = trim($_GET['accion'] ?? '');
$acceso = trim($_GET['ac']     ?? '');

if (!$accion || !$acceso)
    error_respuesta('Parámetros requeridos: accion y ac', 400);

if ($accion !== 'verificar')
    error_respuesta('Acción no válida', 400);

if (!in_array($acceso, ['admin', 'user', 'foro']))
    error_respuesta('ac debe ser admin, user o foro', 400);

// ── NOTA: Las peticiones GET a este archivo NO requieren token CSRF
// ── para permitir verificación de sesión desde el frontend

// ── Verificar sesión ──────────────────────────────────────
if (!isset($_SESSION['usuario_id'], $_SESSION['rol'])) {
    error_respuesta('Sin sesión activa', 401);
}

$rol = intval($_SESSION['rol']);

// Para 'foro' permitimos cualquier sesión válida (admin o user)
if ($acceso === 'foro') {
    // Solo verificamos que haya sesión, sin restricción de rol
    ok([
        'usuario_id' => $_SESSION['usuario_id'],
        'correo'     => $_SESSION['correo'] ?? '',
        'rol'        => $rol,
        'tipo'       => $rol === 1 ? 'admin' : 'user'
    ]);
}

// Para 'admin' o 'user' verificamos roles específicos
$permitido = ($acceso === 'admin' && $rol === 1)
          || ($acceso === 'user'  && $rol === 2);

if (!$permitido) {
    error_respuesta('Acceso denegado', 403);
}

ok([
    'usuario_id' => $_SESSION['usuario_id'],
    'correo'     => $_SESSION['correo'] ?? '',
    'rol'        => $rol,
]);