<?php
// ============================================================
//  admin/backend/foro.php — Gestión del foro
// ============================================================

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

// ── Conexión — UNA sola vez, disponible para todas las acciones ──
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

// ── Funciones ─────────────────────────────────────────────
function obtener_hilos($pdo): array
{
    $stmt = $pdo->query("SELECT h.*,
                                COALESCE(v.nombre, 'Administrador') AS vendedor_nombre,
                                v.perfil                            AS vendedor_perfil,
                                COALESCE(v.color, '#1a6b3c')        AS autor_color
                         FROM foro_hilos h
                         JOIN      usuarios  u ON u.id         = h.usuario_id
                         LEFT JOIN vendedores v ON v.usuario_id = u.id
                         ORDER BY h.creado_en DESC");
    return $stmt->fetchAll(PDO::FETCH_ASSOC);
}

function obtener_respuestas($pdo): array
{
    $hilo_id = intval($_GET['hilo_id'] ?? 0);
    if (!$hilo_id)
        error_respuesta('hilo_id requerido');

    $stmt = $pdo->prepare("SELECT r.*,
                                  COALESCE(v.nombre, 'Administrador') AS vendedor_nombre,
                                  v.perfil                            AS vendedor_perfil,
                                  COALESCE(v.color, '#1a6b3c')        AS autor_color
                           FROM foro_respuestas r
                           JOIN      usuarios  u ON u.id         = r.usuario_id
                           LEFT JOIN vendedores v ON v.usuario_id = u.id
                           WHERE r.hilo_id = ?
                           ORDER BY r.creado_en ASC");
    $stmt->execute([$hilo_id]);
    return $stmt->fetchAll(PDO::FETCH_ASSOC);
}

function eliminar_hilo($pdo): void
{
    $hilo_id = intval($_POST['hilo_id'] ?? 0);
    if (!$hilo_id)
        error_respuesta('hilo_id requerido');

    $pdo->prepare("DELETE FROM foro_respuestas WHERE hilo_id = ?")->execute([$hilo_id]);
    $pdo->prepare("DELETE FROM foro_hilos      WHERE id      = ?")->execute([$hilo_id]);
    ok(['eliminado' => true]);
}

function eliminar_respuesta($pdo): void
{
    $resp_id = intval($_POST['resp_id'] ?? 0);
    $hilo_id = intval($_POST['hilo_id'] ?? 0);
    if (!$resp_id || !$hilo_id)
        error_respuesta('resp_id y hilo_id requeridos');

    $pdo->prepare("DELETE FROM foro_respuestas WHERE id = ?")->execute([$resp_id]);
    $pdo->prepare("UPDATE foro_hilos SET respuestas = GREATEST(0, respuestas - 1) WHERE id = ?")
        ->execute([$hilo_id]);
    ok(['eliminado' => true]);
}

// ── Router ────────────────────────────────────────────────
$accion = $_GET['accion'] ?? $_POST['accion'] ?? '';
$metodo = $_SERVER['REQUEST_METHOD'];

if ($accion === 'obtener_hilos'      && $metodo === 'GET')  ok(obtener_hilos($pdo));
if ($accion === 'obtener_respuestas' && $metodo === 'GET')  ok(obtener_respuestas($pdo));
if ($accion === 'eliminar_hilo'      && $metodo === 'POST') eliminar_hilo($pdo);
if ($accion === 'eliminar_respuesta' && $metodo === 'POST') eliminar_respuesta($pdo);

error_respuesta('Acción no válida');