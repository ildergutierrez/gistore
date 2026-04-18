<?php
//================================================
// admin/server/backend/estadisticas.php
//================================================

if (session_status() === PHP_SESSION_NONE)
    session_start();

// ── Conexión ──────────────────────────────────────────────
require_once __DIR__ . '/../../../backend/conexion.php';
$pdo = __Conectar();

header('Content-Type: application/json');

// ── Verificar token ───────────────────────────────────────
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
function error_respuesta(string $msg, int $codigo = 400): never
{
    http_response_code($codigo);
    echo json_encode(['ok' => false, 'error' => $msg], JSON_UNESCAPED_UNICODE);
    exit;
}



// ── Helpers ───────────────────────────────────────────────
function ok(mixed $datos = null): never
{
    echo json_encode(['ok' => true, 'datos' => $datos], JSON_UNESCAPED_UNICODE);
    exit;
}


function obtenerActivos(PDO $pdo): array
{
    $stmt = $pdo->query("SELECT COUNT(*) FROM usuarios WHERE activo = 1");
    return ['activo' => (int)$stmt->fetchColumn()];
}
function obtenerInactivos(PDO $pdo): array
{
    $stmt = $pdo->query("SELECT COUNT(*) FROM usuarios WHERE activo = 0");
    return ['inactivo' => (int)$stmt->fetchColumn()];
}

function unirResulatdos(array $activos, array $desactios): array
{
    $resultado = ['activos' => $activos['activo'] ?? 0, 'desactivados' => $desactios['inactivo'] ?? 0];
    
  
  ok($resultado);
}

$accion = $_GET['accion'];

match ($accion) {
    'resumen' => ok(unirResulatdos(obtenerActivos($pdo), obtenerInactivos($pdo))),
    default   => error_respuesta('Acción no reconocida.', 404),
};
//echo json_encode(['ok' => false, 'error' => 'Acción no válida'], JSON_UNESCAPED_UNICODE);