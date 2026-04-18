<?php
// ============================================================
//  user/backend/membresias.php
//  Solo lectura — devuelve membresía + nombre del vendedor en sesión
// ============================================================

if (session_status() === PHP_SESSION_NONE)
    session_start();

header('Content-Type: application/json');

// ── Verificar sesión ──────────────────────────────────────
if (empty($_SESSION['usuario_id']) || (int)($_SESSION['rol'] ?? 0) !== 2) {
    http_response_code(401);
    die(json_encode(['ok' => false, 'error' => 'No autenticado.']));
}

// ── Verificar token CSRF ──────────────────────────────────
$token    = $_GET['token'] ?? '';
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

// ── Vendedor en sesión (nombre incluido) ──────────────────
$stmt = $pdo->prepare("
    SELECT id, nombre, color
    FROM vendedores
    WHERE usuario_id = ?
    LIMIT 1
");
$stmt->execute([(int)$_SESSION['usuario_id']]);
$vendedor = $stmt->fetch(PDO::FETCH_ASSOC);

if (!$vendedor) {
    http_response_code(404);
    die(json_encode(['ok' => false, 'error' => 'Vendedor no encontrado.']));
}

$vendedor_id = (int)$vendedor['id'];



__Desconectar($pdo);

// ── Respuesta ─────────────────────────────────────────────
echo json_encode([
    'ok'    => true,

            'id'     => $vendedor_id,
            'nombre' => $vendedor['nombre'],
            'color'  => $vendedor['color'],

], JSON_UNESCAPED_UNICODE);