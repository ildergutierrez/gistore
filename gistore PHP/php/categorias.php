<?php
//================================================
// gistore/php/categorias.php — Público, solo lectura
//================================================

if (session_status() === PHP_SESSION_NONE)
    session_start();

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

// ── Conexión ──────────────────────────────────────────────
require_once __DIR__ . '/../backend/conexion.php';
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

// ── Router ────────────────────────────────────────────────
$accion = $_GET['accion'] ?? '';

if ($accion === 'obtener') {
    $stmt = $pdo->prepare("
        SELECT c.id, c.nombre, c.orden
        FROM categorias c
        INNER JOIN productos p ON p.categoria_id = c.id
        GROUP BY c.id, c.nombre, c.orden
        ORDER BY c.orden ASC, c.nombre ASC
    ");
    $stmt->execute();
    ok($stmt->fetchAll(PDO::FETCH_ASSOC));
}

error_respuesta('Acción no reconocida.', 404);