<?php
// ============================================================
//  user/backend/api_config.php
//  Devuelve la configuración de un servicio de API al frontend.
//  Solo accesible por vendedores autenticados (rol 2).
//  Lee de la tabla: api_claves (id, servicio, nombre,
//    origen_url, clave, modelos, activo, nota, ...)
// ============================================================

if (session_status() === PHP_SESSION_NONE)
    session_start();

set_exception_handler(function ($e) {
    http_response_code(500);
    echo json_encode(['ok' => false, 'error' => $e->getMessage()]);
    exit;
});

header('Content-Type: application/json');

// ── Autenticación: solo vendedores (rol 2) ────────────────
if (empty($_SESSION['usuario_id']) || (int)($_SESSION['rol'] ?? 0) !== 2) {
    http_response_code(401);
    die(json_encode(['ok' => false, 'error' => 'No autenticado.']));
}

// ── Verificar token CSRF ──────────────────────────────────
$token    = $_GET['token']  ?? $_POST['token']  ?? '';
$guardado = $_SESSION['csrf_token']      ?? '';
$tiempo   = $_SESSION['csrf_token_time'] ?? 0;

if (!$token || !$guardado || !hash_equals($guardado, $token)) {
    http_response_code(403);
    die(json_encode(['ok' => false, 'error' => 'Token inválido']));
}
if ((time() - $tiempo) > 7200) {
    http_response_code(403);
    die(json_encode(['ok' => false, 'error' => 'Token expirado']));
}

// ── Conexión ──────────────────────────────────────────────
require_once __DIR__ . '/../../backend/conexion.php';
$pdo = __Conectar();

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

// ── Parámetro: servicio ───────────────────────────────────
$servicio = trim($_GET['servicio'] ?? '');
if (!$servicio) error_respuesta('Parámetro "servicio" requerido.');

// ── Consulta ──────────────────────────────────────────────
$stmt = $pdo->prepare("
    SELECT servicio, nombre, origen_url, clave, modelos
    FROM   api_claves
    WHERE  servicio = ? AND activo = 1
    LIMIT  1
");
$stmt->execute([$servicio]);
$row = $stmt->fetch(PDO::FETCH_ASSOC);

if (!$row) {
    error_respuesta("Servicio \"$servicio\" no encontrado o inactivo.", 404);
}

// ── Parsear modelos (guardado como JSON en longtext) ──────
$modelos = [];
if (!empty($row['modelos'])) {
    $decoded = json_decode($row['modelos'], true);
    if (is_array($decoded)) {
        $modelos = array_values(array_filter($decoded));
    } else {
        // Fallback: líneas de texto separadas por salto de línea
        $modelos = array_values(array_filter(
            array_map('trim', explode("\n", $row['modelos']))
        ));
    }
}

ok([
    'servicio'   => $row['servicio'],
    'nombre'     => $row['nombre'],
    'origen_url' => $row['origen_url'] ?: 'https://openrouter.ai/api/v1/chat/completions',
    'clave'      => $row['clave'],
    'modelos'    => $modelos,
]);