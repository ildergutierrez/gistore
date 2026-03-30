<?php
// ============================================================
//  user/backend/productos.php
//  Gestión de productos del vendedor en sesión (rol 2)
// ============================================================

if (session_status() === PHP_SESSION_NONE)
    session_start();

set_exception_handler(function($e) {
    http_response_code(500);
    echo json_encode(['ok' => false, 'error' => $e->getMessage()]);
    exit;
});

header('Content-Type: application/json');

// ── Verificar sesión activa y que sea vendedor (rol 2) ────
if (empty($_SESSION['usuario_id']) || (int)($_SESSION['rol'] ?? 0) !== 2) {
    http_response_code(401);
    die(json_encode(['ok' => false, 'error' => 'No autenticado.']));
}

// vendedor_id siempre del servidor, nunca del cliente
$usuario_id = (int)$_SESSION['usuario_id'];

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

// ── Obtener vendedor_id real desde la tabla vendedores ────
$stmt = $pdo->prepare("SELECT id FROM vendedores WHERE usuario_id = ? LIMIT 1");
$stmt->execute([$usuario_id]);
$vendedor = $stmt->fetch(PDO::FETCH_ASSOC);

if (!$vendedor) {
    http_response_code(404);
    die(json_encode(['ok' => false, 'error' => 'Perfil de vendedor no encontrado.']));
}

$vendedor_id = (int)$vendedor['id'];

// ── Helpers ───────────────────────────────────────────────
function ok(mixed $datos = null): never {
    echo json_encode(['ok' => true, 'datos' => $datos], JSON_UNESCAPED_UNICODE);
    exit;
}
function error_respuesta(string $msg, int $codigo = 400): never {
    http_response_code($codigo);
    echo json_encode(['ok' => false, 'error' => $msg], JSON_UNESCAPED_UNICODE);
    exit;
}

// ── Obtener productos del vendedor ────────────────────────
function obtener_Productos(PDO $conn, int $vendedor_id): void {
    $stmt = $conn->prepare("
        SELECT p.id, p.nombre, p.valor, p.activo, p.vendedor_id,
               p.descripcion, p.recomendacion, p.beneficios,
               p.imagen, p.categoria_id,
               c.nombre AS categoria_nombre
        FROM productos p
        LEFT JOIN categorias c ON c.id = p.categoria_id
        WHERE p.vendedor_id = ?
        ORDER BY p.nombre ASC
    ");
    $stmt->execute([$vendedor_id]);
    ok($stmt->fetchAll(PDO::FETCH_ASSOC));
}

// ── Estadísticas rápidas (para el dashboard) ──────────────
function stats_Productos(PDO $conn, int $vendedor_id): void {
    $stmt = $conn->prepare("
        SELECT
            COUNT(*)        AS total,
            SUM(activo = 1) AS activos,
            SUM(activo = 0) AS inactivos
        FROM productos
        WHERE vendedor_id = ?
    ");
    $stmt->execute([$vendedor_id]);
    $row = $stmt->fetch(PDO::FETCH_ASSOC);
    ok([
        'total'    => (int)$row['total'],
        'activos'  => (int)$row['activos'],
        'inactivos'=> (int)$row['inactivos'],
    ]);
}

// ── Categorías (para los selects del formulario) ──────────
function obtener_Categorias(PDO $conn): void {
    $stmt = $conn->prepare("
        SELECT id, nombre
        FROM categorias
        ORDER BY nombre ASC
    ");
    $stmt->execute();
    ok($stmt->fetchAll(PDO::FETCH_ASSOC));
}

// ── Crear producto ────────────────────────────────────────
function crear_Producto(PDO $conn, int $vendedor_id): void {
    $nombre        = trim($_POST['nombre']        ?? '');
    $valor         = floatval($_POST['valor']     ?? 0);
    $categoria_id  = intval($_POST['categoria_id'] ?? 0);
    $descripcion   = trim($_POST['descripcion']   ?? '');
    $recomendacion = trim($_POST['recomendacion'] ?? '');
    $beneficios    = trim($_POST['beneficios']    ?? '');
    $imagen        = trim($_POST['imagen']        ?? '');
    $activo        = isset($_POST['activo']) ? (int)(bool)$_POST['activo'] : 1;

    if (!$nombre)       error_respuesta('El nombre es obligatorio.');
    if ($valor <= 0)    error_respuesta('El valor debe ser mayor a cero.');
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
        ':vendedor_id'   => $vendedor_id,   // siempre de sesión
        ':categoria_id'  => $categoria_id,
        ':nombre'        => $nombre,
        ':descripcion'   => $descripcion   ?: null,
        ':recomendacion' => $recomendacion ?: null,
        ':beneficios'    => $beneficios    ?: null,
        ':valor'         => $valor,
        ':imagen'        => $imagen        ?: null,
        ':activo'        => $activo,
    ]);

    ok(['id' => $conn->lastInsertId()]);
}

// ── Actualizar producto ───────────────────────────────────
function actualizar_Producto(PDO $conn, int $vendedor_id): void {
    $id            = intval($_POST['id']           ?? 0);
    $nombre        = trim($_POST['nombre']         ?? '');
    $valor         = floatval($_POST['valor']      ?? 0);
    $categoria_id  = intval($_POST['categoria_id'] ?? 0) ?: null;
    $descripcion   = trim($_POST['descripcion']    ?? '');
    $recomendacion = trim($_POST['recomendacion']  ?? '');
    $beneficios    = trim($_POST['beneficios']     ?? '');
    $imagen        = trim($_POST['imagen']         ?? '');
    $activo        = isset($_POST['activo']) ? (int)(bool)$_POST['activo'] : 1;

    if (!$id)        error_respuesta('ID de producto inválido.');
    if (!$nombre)    error_respuesta('El nombre es obligatorio.');
    if ($valor <= 0) error_respuesta('El valor debe ser mayor a cero.');

    // Verificar que el producto pertenece a este vendedor
    $check = $conn->prepare("SELECT id FROM productos WHERE id = ? AND vendedor_id = ?");
    $check->execute([$id, $vendedor_id]);
    if (!$check->fetch()) error_respuesta('Producto no encontrado o sin permiso.', 403);

    $stmt = $conn->prepare("
        UPDATE productos
        SET categoria_id   = :categoria_id,
            nombre         = :nombre,
            descripcion    = :descripcion,
            recomendacion  = :recomendacion,
            beneficios     = :beneficios,
            valor          = :valor,
            imagen         = :imagen,
            activo         = :activo,
            actualizado_en = NOW()
        WHERE id = :id AND vendedor_id = :vendedor_id
    ");
    $stmt->execute([
        ':categoria_id'  => $categoria_id,
        ':nombre'        => $nombre,
        ':descripcion'   => $descripcion   ?: null,
        ':recomendacion' => $recomendacion ?: null,
        ':beneficios'    => $beneficios    ?: null,
        ':valor'         => $valor,
        ':imagen'        => $imagen        ?: null,
        ':activo'        => $activo,
        ':id'            => $id,
        ':vendedor_id'   => $vendedor_id,  // doble candado en el WHERE
    ]);

    ok(['id' => $id]);
}

// ── Eliminar producto ─────────────────────────────────────
function eliminar_Producto(PDO $conn, int $vendedor_id): void {
    $id = intval($_POST['id'] ?? 0);
    if (!$id) error_respuesta('ID de producto inválido.');

    $stmt = $conn->prepare("DELETE FROM productos WHERE id = ? AND vendedor_id = ?");
    $stmt->execute([$id, $vendedor_id]);

    if ($stmt->rowCount() === 0)
        error_respuesta('Producto no encontrado o sin permiso.', 403);

    ok(['id' => $id]);
}

// ── Router ────────────────────────────────────────────────
$accion = $_GET['accion'] ?? $_POST['accion'] ?? '';

match ($accion) {
    'obtener'    => obtener_Productos($pdo, $vendedor_id),
    'stats'      => stats_Productos($pdo, $vendedor_id),
    'categorias' => obtener_Categorias($pdo),
    'crear'      => crear_Producto($pdo, $vendedor_id),
    'actualizar' => actualizar_Producto($pdo, $vendedor_id),
    'eliminar'   => eliminar_Producto($pdo, $vendedor_id),
    default      => error_respuesta('Acción no reconocida.', 404),
};