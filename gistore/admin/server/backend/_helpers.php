<?php
// ============================================================
//  gistore/admin/server/backend/_helpers.php
//  Funciones compartidas por todos los backends de server/
//  NO se llama directamente — se incluye con require_once
// ============================================================

// ── Arrancar sesión si aún no está activa ─────────────────
if (session_status() === PHP_SESSION_NONE) session_start();

// ── Cabeceras comunes ─────────────────────────────────────
header('Content-Type: application/json; charset=utf-8');
header('X-Content-Type-Options: nosniff');

// ── Helpers de respuesta ──────────────────────────────────
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

// ── Validar token CSRF ────────────────────────────────────
// Acepta el token por GET, POST o cabecera X-CSRF-Token
function validar_token(): void
{
    $token    = $_GET['token']
             ?? $_POST['token']
             ?? ($_SERVER['HTTP_X_CSRF_TOKEN'] ?? '');
    $guardado = $_SESSION['csrf_token']      ?? '';
    $tiempo   = $_SESSION['csrf_token_time'] ?? 0;

    if (!$token || !$guardado || !hash_equals($guardado, $token))
        error_respuesta('Token CSRF inválido', 403);

    if ((time() - $tiempo) > 7200)
        error_respuesta('Token CSRF expirado', 403);
}

// ── Verificar sesión admin (rol = 1) ──────────────────────
function validar_sesion_admin(): void
{
    if (!isset($_SESSION['usuario_id'], $_SESSION['rol']))
        error_respuesta('Sin sesión activa', 401);

    if ((int)$_SESSION['rol'] !== 1)
        error_respuesta('Acceso denegado', 403);
}

// ── Conexión PDO ──────────────────────────────────────────
function conectar(): PDO
{
    require_once __DIR__ . '/../../../backend/conexion.php';
    return __Conectar();
}

// ── Obtener acción ────────────────────────────────────────
function accion(): string
{
    return trim($_GET['accion'] ?? $_POST['accion'] ?? '');
}

// ── Leer JSON del body (para fetch con Content-Type: application/json)
function body_json(): array
{
    static $cache = null;
    if ($cache !== null) return $cache;
    $raw = file_get_contents('php://input');
    $cache = $raw ? (json_decode($raw, true) ?? []) : [];
    return $cache;
}

// ── Leer campo de POST o JSON body ───────────────────────
function campo(string $key, mixed $default = ''): mixed
{
    return $_POST[$key] ?? body_json()[$key] ?? $default;
}

// ── Sanitizar cadena simple ───────────────────────────────
function str_in(string $key, mixed $default = ''): string
{
    return trim((string)campo($key, $default));
}

// ── Sanitizar entero ──────────────────────────────────────
function int_in(string $key, int $default = 0): int
{
    return (int)campo($key, $default);
}
