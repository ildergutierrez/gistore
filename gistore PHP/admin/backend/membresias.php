<?php
//================================================
// admin/backend/membresias.php
//================================================
if (session_status() === PHP_SESSION_NONE) session_start();
header('Content-Type: application/json');

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

require_once __DIR__ . '/../../backend/conexion.php';
$pdo = __Conectar();

function ok(mixed $datos = null): never {
    echo json_encode(['ok' => true, 'datos' => $datos], JSON_UNESCAPED_UNICODE);
    exit;
}
function error_respuesta(string $msg, int $codigo = 400): never {
    http_response_code($codigo);
    echo json_encode(['ok' => false, 'error' => $msg], JSON_UNESCAPED_UNICODE);
    exit;
}

// ── Obtener todas ─────────────────────────────────────────
function obtener_Membresias($conn) {
    $stmt = $conn->prepare("
        SELECT id, vendedor_id, plan_id, fecha_inicio, fecha_fin,
               estado, notas, wompi_tx_id, creado_en, actualizado_en
        FROM membresias
        ORDER BY creado_en DESC
    ");
    $stmt->execute();
    return $stmt->fetchAll(PDO::FETCH_ASSOC);
}

// ── Crear ─────────────────────────────────────────────────
function crear_Membresia($conn) {
    $vendedor_id  = intval($_POST['vendedor_id']  ?? 0);
    $plan_id      = intval($_POST['plan_id']      ?? 0) ?: null;
    $fecha_inicio = trim($_POST['fecha_inicio']   ?? '');
    $fecha_fin    = trim($_POST['fecha_fin']       ?? '');
    $estado       = trim($_POST['estado']          ?? 'activa');
    $notas        = trim($_POST['notas']           ?? '');

    if (!$vendedor_id)  error_respuesta('El vendedor es obligatorio.');
    if (!$fecha_inicio) error_respuesta('La fecha de inicio es obligatoria.');
    if (!$fecha_fin)    error_respuesta('La fecha de fin es obligatoria.');
    if ($fecha_fin < $fecha_inicio) error_respuesta('La fecha fin debe ser posterior al inicio.');

    $estados_validos = ['activa', 'vencida', 'cancelada'];
    if (!in_array($estado, $estados_validos)) error_respuesta('Estado no válido.');

    $stmt = $conn->prepare("
        INSERT INTO membresias (vendedor_id, plan_id, fecha_inicio, fecha_fin, estado, notas, creado_en, actualizado_en)
        VALUES (:vendedor_id, :plan_id, :fecha_inicio, :fecha_fin, :estado, :notas, NOW(), NOW())
    ");
    $stmt->execute([
        ':vendedor_id'  => $vendedor_id,
        ':plan_id'      => $plan_id,
        ':fecha_inicio' => $fecha_inicio,
        ':fecha_fin'    => $fecha_fin,
        ':estado'       => $estado,
        ':notas'        => $notas ?: null,
    ]);

    ok(['id' => $conn->lastInsertId()]);
}

// ── Actualizar ────────────────────────────────────────────
function actualizar_Membresia($conn) {
    $id           = intval($_POST['id']           ?? 0);
    $vendedor_id  = intval($_POST['vendedor_id']  ?? 0);
    $plan_id      = intval($_POST['plan_id']      ?? 0) ?: null;
    $fecha_inicio = trim($_POST['fecha_inicio']   ?? '');
    $fecha_fin    = trim($_POST['fecha_fin']       ?? '');
    $estado       = trim($_POST['estado']          ?? 'activa');
    $notas        = trim($_POST['notas']           ?? '');

    if (!$id)           error_respuesta('ID de membresía inválido.');
    if (!$vendedor_id)  error_respuesta('El vendedor es obligatorio.');
    if (!$fecha_inicio) error_respuesta('La fecha de inicio es obligatoria.');
    if (!$fecha_fin)    error_respuesta('La fecha de fin es obligatoria.');
    if ($fecha_fin < $fecha_inicio) error_respuesta('La fecha fin debe ser posterior al inicio.');

    $estados_validos = ['activa', 'vencida', 'cancelada'];
    if (!in_array($estado, $estados_validos)) error_respuesta('Estado no válido.');

    $stmt = $conn->prepare("
        UPDATE membresias
        SET vendedor_id = :vendedor_id, plan_id = :plan_id,
            fecha_inicio = :fecha_inicio, fecha_fin = :fecha_fin,
            estado = :estado, notas = :notas, actualizado_en = NOW()
        WHERE id = :id
    ");
    $stmt->execute([
        ':vendedor_id'  => $vendedor_id,
        ':plan_id'      => $plan_id,
        ':fecha_inicio' => $fecha_inicio,
        ':fecha_fin'    => $fecha_fin,
        ':estado'       => $estado,
        ':notas'        => $notas ?: null,
        ':id'           => $id,
    ]);

    ok(['id' => $id]);
}

// ── Eliminar ──────────────────────────────────────────────
function eliminar_Membresia($conn) {
    $id = intval($_POST['id'] ?? 0);
    if (!$id) error_respuesta('ID de membresía inválido.');

    $stmt = $conn->prepare("DELETE FROM membresias WHERE id = ?");
    $stmt->execute([$id]);

    ok(['id' => $id]);
}

// ── Router ────────────────────────────────────────────────
$accion = $_GET['accion'] ?? $_POST['accion'] ?? '';

match ($accion) {
    'obtener'    => ok(obtener_Membresias($conn = $pdo)),
    'crear'      => crear_Membresia($pdo),
    'actualizar' => actualizar_Membresia($pdo),
    'eliminar'   => eliminar_Membresia($pdo),
    default      => error_respuesta('Acción no reconocida.', 404),
};