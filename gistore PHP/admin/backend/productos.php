<?php
//================================================
// admin/backend/vendedores.php
//================================================

if (session_status() === PHP_SESSION_NONE)
    session_start();

set_exception_handler(function($e) {
    http_response_code(500);
    echo json_encode(['ok' => false, 'error' => $e->getMessage()]);
    exit;
});
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
function obtener_Productos($conn) {
    $stmt = $conn->prepare("
        SELECT p.id, p.nombre, p.valor, p.activo, p.vendedor_id,
               v.nombre AS vendedor_nombre
        FROM productos p
        LEFT JOIN vendedores v ON v.id = p.vendedor_id
    ");
    $stmt->execute();
    return $stmt->fetchAll(PDO::FETCH_ASSOC);
}

function listar_Productos($conn) {
    $stmt = $conn->prepare("
        SELECT * FROM productos ");
    $stmt->execute();
    return $stmt->fetchAll(PDO::FETCH_ASSOC);
}
// ── Obtener categorías (necesario para los selects del JS) ─
function obtener_Categorias($conn) {
    $stmt = $conn->prepare("
        SELECT id, nombre
        FROM categorias
        ORDER BY nombre ASC
    ");
    $stmt->execute();
    return $stmt->fetchAll(PDO::FETCH_ASSOC);
}

// ── Crear producto ────────────────────────────────────────
function crear_Producto($conn) {
    $nombre       = trim($_POST['nombre']       ?? '');
    $valor        = floatval($_POST['valor']    ?? 0);
    $vendedor_id  = intval($_POST['vendedor_id'] ?? 0);
    $categoria_id = intval($_POST['categoria_id'] ?? 0);
    $descripcion  = trim($_POST['descripcion']  ?? '');
    $recomendacion= trim($_POST['recomendacion'] ?? '');
    $beneficios   = trim($_POST['beneficios']   ?? '');
    $imagen       = trim($_POST['imagen']       ?? '');
    $activo       = isset($_POST['activo']) ? (int)(bool)$_POST['activo'] : 1;

    if (!$nombre)      error_respuesta('El nombre es obligatorio.');
    if ($valor <= 0)   error_respuesta('El valor es obligatorio.');
    if (!$vendedor_id) error_respuesta('El vendedor es obligatorio.');
    if (!$categoria_id) error_respuesta('La categoría es obligatoria.');

    $stmt = $conn->prepare("
        INSERT INTO productos
            (vendedor_id, categoria_id, nombre, descripcion, recomendacion,
             beneficios, valor, imagen, activo, creado_en, actualizado_en)
        VALUES
            (:vendedor_id, :categoria_id, :nombre, :descripcion, :recomendacion,
             :beneficios, :valor, :imagen, :activo, NOW(), NOW())
    ");
    $stmt->execute([
        ':vendedor_id'  => $vendedor_id,
        ':categoria_id' => $categoria_id,
        ':nombre'       => $nombre,
        ':descripcion'  => $descripcion  ?: null,
        ':recomendacion'=> $recomendacion ?: null,
        ':beneficios'   => $beneficios   ?: null,
        ':valor'        => $valor,
        ':imagen'       => $imagen       ?: null,
        ':activo'       => $activo,
    ]);

    ok(['id' => $conn->lastInsertId()]);
}

// ── Actualizar producto ───────────────────────────────────
function actualizar_Producto($conn) {
    $id           = intval($_POST['id']          ?? 0);
    $nombre       = trim($_POST['nombre']        ?? '');
    $valor        = floatval($_POST['valor']     ?? 0);
    $vendedor_id  = intval($_POST['vendedor_id'] ?? 0);
    $categoria_id = intval($_POST['categoria_id'] ?? 0) ?: null;
    $descripcion  = trim($_POST['descripcion']   ?? '');
    $recomendacion= trim($_POST['recomendacion'] ?? '');
    $beneficios   = trim($_POST['beneficios']    ?? '');
    $imagen       = trim($_POST['imagen']        ?? '');
    $activo       = isset($_POST['activo']) ? (int)(bool)$_POST['activo'] : 1;

    if (!$id)          error_respuesta('ID de producto inválido.');
    if (!$nombre)      error_respuesta('El nombre es obligatorio.');
    if ($valor <= 0)   error_respuesta('El valor es obligatorio.');
    if (!$vendedor_id) error_respuesta('El vendedor es obligatorio.');

    $stmt = $conn->prepare("
        UPDATE productos
        SET vendedor_id   = :vendedor_id,
            categoria_id  = :categoria_id,
            nombre        = :nombre,
            descripcion   = :descripcion,
            recomendacion = :recomendacion,
            beneficios    = :beneficios,
            valor         = :valor,
            imagen        = :imagen,
            activo        = :activo,
            actualizado_en = NOW()
        WHERE id = :id
    ");
    $stmt->execute([
        ':vendedor_id'  => $vendedor_id,
        ':categoria_id' => $categoria_id,
        ':nombre'       => $nombre,
        ':descripcion'  => $descripcion  ?: null,
        ':recomendacion'=> $recomendacion ?: null,
        ':beneficios'   => $beneficios   ?: null,
        ':valor'        => $valor,
        ':imagen'       => $imagen       ?: null,
        ':activo'       => $activo,
        ':id'           => $id,
    ]);

    ok(['id' => $id]);
}

// ── Eliminar producto ─────────────────────────────────────
function eliminar_Producto($conn) {
    $id = intval($_POST['id'] ?? 0);
    if (!$id) error_respuesta('ID de producto inválido.');

    $conn->prepare("DELETE FROM productos WHERE id = ?")->execute([$id]);
    ok(['id' => $id]);
}

// ── Router ────────────────────────────────────────────────
$accion = $_GET['accion'] ?? $_POST['accion'] ?? '';

match ($accion) {
    'obtener'     => ok(obtener_Productos($pdo)),
    'listar'      => ok(listar_Productos($pdo)),
    'categorias'  => ok(obtener_Categorias($pdo)),
    'crear'       => crear_Producto($pdo),
    'actualizar'  => actualizar_Producto($pdo),
    'eliminar'    => eliminar_Producto($pdo),
    default       => error_respuesta('Acción no reconocida.', 404),
};