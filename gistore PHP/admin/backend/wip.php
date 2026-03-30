<?php
//================================================
// admin/backend/wip.php
//================================================

if (session_status() === PHP_SESSION_NONE)
    session_start();

header('Content-Type: application/json');

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

// ── Obtener registro wpis (solo hay uno; si no existe devuelve null) ──
function obtener_Wip($conn): mixed
{
    $stmt = $conn->prepare("SELECT id, public, privada, eventos, integridad FROM wpis LIMIT 1");
    $stmt->execute();
    $row = $stmt->fetch(PDO::FETCH_ASSOC);
    return $row ?: null;
}

// ── Guardar (INSERT si no existe, UPDATE si ya existe) ───
function guardar_Wip($conn): void
{
    $public      = trim($_POST['public']      ?? '');
    $privada     = trim($_POST['privada']      ?? '');
    $eventos     = trim($_POST['eventos']      ?? '');
    $integridad  = trim($_POST['integridad']   ?? '');

    if (!$public)     error_respuesta('El campo "public" es obligatorio.');
    if (!$privada)    error_respuesta('El campo "privada" es obligatorio.');
    if (!$eventos)    error_respuesta('El campo "eventos" es obligatorio.');
    if (!$integridad) error_respuesta('El campo "integridad" es obligatorio.');

    // ¿Ya existe un registro?
    $check = $conn->prepare("SELECT id FROM wpis LIMIT 1");
    $check->execute();
    $existente = $check->fetch(PDO::FETCH_ASSOC);

    if ($existente) {
        // UPDATE
        $stmt = $conn->prepare("
            UPDATE wpis
            SET public = :public, privada = :privada,
                eventos = :eventos, integridad = :integridad
            WHERE id = :id
        ");
        $stmt->execute([
            ':public'     => $public,
            ':privada'    => $privada,
            ':eventos'    => $eventos,
            ':integridad' => $integridad,
            ':id'         => $existente['id'],
        ]);
        ok(['id' => $existente['id'], 'accion' => 'actualizado']);
    } else {
        // INSERT
        $stmt = $conn->prepare("
            INSERT INTO wpis (public, privada, eventos, integridad)
            VALUES (:public, :privada, :eventos, :integridad)
        ");
        $stmt->execute([
            ':public'     => $public,
            ':privada'    => $privada,
            ':eventos'    => $eventos,
            ':integridad' => $integridad,
        ]);
        ok(['id' => $conn->lastInsertId(), 'accion' => 'creado']);
    }
}

// ── Router ────────────────────────────────────────────────
$accion = $_GET['accion'] ?? $_POST['accion'] ?? '';

match ($accion) {
    'obtener'  => ok(obtener_Wip($pdo)),
    'guardar'  => guardar_Wip($pdo),
    default    => error_respuesta('Acción no reconocida.', 404),
};