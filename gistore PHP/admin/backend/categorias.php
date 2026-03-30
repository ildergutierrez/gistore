<?php
//================================================
// admin/backend/categorias.php
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
function obtener_Categorias($conn): array
{
    $stmt = $conn->prepare("SELECT * FROM categorias ORDER BY orden ASC, nombre ASC");
    $stmt->execute();
    return $stmt->fetchAll(PDO::FETCH_ASSOC);
}

function crear_Categoria($conn): void
{
    $nombre = trim($_POST['nombre'] ?? '');
    $orden  = intval($_POST['orden'] ?? 1);

    if (!$nombre) error_respuesta('El nombre es obligatorio.');

    $stmt = $conn->prepare("
        INSERT INTO categorias (nombre, orden)
        VALUES (:nombre, :orden)
    ");
    $stmt->execute([':nombre' => $nombre, ':orden' => $orden]);
    ok(['id' => $conn->lastInsertId()]);
}

function actualizar_Categoria($conn): void
{
    $id     = intval($_POST['id']     ?? 0);
    $nombre = trim($_POST['nombre']   ?? '');
    $orden  = intval($_POST['orden']  ?? 1);

    if (!$id)     error_respuesta('ID de categoría inválido.');
    if (!$nombre) error_respuesta('El nombre es obligatorio.');

    $stmt = $conn->prepare("
        UPDATE categorias
        SET nombre = :nombre, orden = :orden
        WHERE id = :id
    ");
    $stmt->execute([':nombre' => $nombre, ':orden' => $orden, ':id' => $id]);
    ok(['id' => $id]);
}

function eliminar_Categoria($conn): void
{
    $id = intval($_POST['id'] ?? 0);
    if (!$id) error_respuesta('ID de categoría inválido.');

    // Desvincular productos de esta categoría antes de eliminar
    $conn->prepare("UPDATE productos SET categoria_id = NULL WHERE categoria_id = ?")->execute([$id]);
    $conn->prepare("DELETE FROM categorias WHERE id = ?")->execute([$id]);
    ok(['id' => $id]);
}

// ── Router ────────────────────────────────────────────────
$accion = $_GET['accion'] ?? $_POST['accion'] ?? '';

match ($accion) {
    'obtener'    => ok(obtener_Categorias($pdo)),
    'crear'      => crear_Categoria($pdo),
    'actualizar' => actualizar_Categoria($pdo),
    'eliminar'   => eliminar_Categoria($pdo),
    default      => error_respuesta('Acción no reconocida.', 404),
};