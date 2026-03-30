<?php
//================================================
// admin/backend/planes.php
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

// ── Obtener todos ─────────────────────────────────────────
function obtener_Planes($conn) {
    $stmt = $conn->prepare("
        SELECT id, nombre, descripcion, precio, duracion_dias,
               activo, orden, creado_en, actualizado_en
        FROM planes_membresia
        ORDER BY orden ASC, id ASC
    ");
    $stmt->execute();
    return $stmt->fetchAll(PDO::FETCH_ASSOC);
}

// ── Crear ─────────────────────────────────────────────────
function crear_Plan($conn) {
    $nombre       = trim($_POST['nombre']        ?? '');
    $descripcion  = trim($_POST['descripcion']   ?? '');
    $precio       = floatval($_POST['precio']    ?? 0);
    $duracion     = intval($_POST['duracion_dias'] ?? 30);
    $orden        = intval($_POST['orden']       ?? 0);
    $activo       = isset($_POST['activo']) ? (int)(bool)$_POST['activo'] : 1;

    if (!$nombre)       error_respuesta('El nombre del plan es obligatorio.');
    if ($precio < 0)    error_respuesta('El precio no puede ser negativo.');
    if ($duracion < 1)  error_respuesta('La duración debe ser al menos 1 día.');

    $stmt = $conn->prepare("
        INSERT INTO planes_membresia (nombre, descripcion, precio, duracion_dias, activo, orden, creado_en, actualizado_en)
        VALUES (:nombre, :descripcion, :precio, :duracion_dias, :activo, :orden, NOW(), NOW())
    ");
    $stmt->execute([
        ':nombre'       => $nombre,
        ':descripcion'  => $descripcion ?: null,
        ':precio'       => $precio,
        ':duracion_dias'=> $duracion,
        ':activo'       => $activo,
        ':orden'        => $orden,
    ]);

    ok(['id' => $conn->lastInsertId()]);
}

// ── Actualizar ────────────────────────────────────────────
function actualizar_Plan($conn) {
    $id           = intval($_POST['id']           ?? 0);
    $nombre       = trim($_POST['nombre']         ?? '');
    $descripcion  = trim($_POST['descripcion']    ?? '');
    $precio       = floatval($_POST['precio']     ?? 0);
    $duracion     = intval($_POST['duracion_dias'] ?? 30);
    $orden        = intval($_POST['orden']        ?? 0);
    $activo       = isset($_POST['activo']) ? (int)(bool)$_POST['activo'] : 1;

    if (!$id)       error_respuesta('ID de plan inválido.');
    if (!$nombre)   error_respuesta('El nombre del plan es obligatorio.');
    if ($precio < 0) error_respuesta('El precio no puede ser negativo.');
    if ($duracion < 1) error_respuesta('La duración debe ser al menos 1 día.');

    $stmt = $conn->prepare("
        UPDATE planes_membresia
        SET nombre = :nombre, descripcion = :descripcion, precio = :precio,
            duracion_dias = :duracion_dias, activo = :activo,
            orden = :orden, actualizado_en = NOW()
        WHERE id = :id
    ");
    $stmt->execute([
        ':nombre'        => $nombre,
        ':descripcion'   => $descripcion ?: null,
        ':precio'        => $precio,
        ':duracion_dias' => $duracion,
        ':activo'        => $activo,
        ':orden'         => $orden,
        ':id'            => $id,
    ]);

    ok(['id' => $id]);
}

// ── Eliminar ──────────────────────────────────────────────
function eliminar_Plan($conn) {
    $id = intval($_POST['id'] ?? 0);
    if (!$id) error_respuesta('ID de plan inválido.');

    // Verificar que no tenga membresías asociadas
    $check = $conn->prepare("SELECT COUNT(*) FROM membresias WHERE plan_id = ?");
    $check->execute([$id]);
    if ($check->fetchColumn() > 0)
        error_respuesta('No se puede eliminar: el plan tiene membresías asociadas.');

    $conn->prepare("DELETE FROM planes_membresia WHERE id = ?")->execute([$id]);
    ok(['id' => $id]);
}

// ── Router ────────────────────────────────────────────────
$accion = $_GET['accion'] ?? $_POST['accion'] ?? '';

match ($accion) {
    'obtener'    => ok(obtener_Planes($pdo)),
    'crear'      => crear_Plan($pdo),
    'actualizar' => actualizar_Plan($pdo),
    'eliminar'   => eliminar_Plan($pdo),
    default      => error_respuesta('Acción no reconocida.', 404),
};