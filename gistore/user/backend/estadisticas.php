<?php
//================================================
// gistore/user/backend/categorias.php — Público, solo lectura
//================================================

if (session_status() === PHP_SESSION_NONE)
    session_start();
$id_user = $_SESSION['usuario_id'] ?? null;

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

// ── Conexión — ruta corregida ─────────────────────────────
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
function obtenerProductos($pdo, $id_producto){
    $stmt = $pdo->prepare("SELECT nombre FROM productos WHERE id = ? LIMIT 1");
    $stmt->execute([$id_producto]);
    return $stmt->fetch(PDO::FETCH_ASSOC)['nombre'] ?? 'Producto desconocido';
}

function obtnerCompartidos($pdo, $id_vendedor){
     $stmt = $pdo->prepare("SELECT id_producto, cantidad, fecha FROM compartidos WHERE id_vendedor = ? ORDER BY fecha ASC");
    $stmt->execute([$id_vendedor]);
}
function obtenrDestacados($pdo, $id_vendedor){
     $stmt = $pdo->prepare("SELECT id_producto, cantidad, fecha FROM destacados WHERE id_vendedor = ? ORDER BY fecha ASC");
    $stmt->execute([$id_vendedor]);
}
function verificar_usuario(PDO $pdo, int $id_user): array
{
    $stmt = $pdo->prepare("SELECT id FROM vendedores WHERE usuario_id = ? LIMIT 1");
    $stmt->execute([$id_user]);
    $usuario = $stmt->fetch(PDO::FETCH_ASSOC);

    return $usuario;
}
//unir destacados y compartidos y que tengas los nombres del producto y ordenarlos por fecha
function verificar_produto(PDO $pdo, int $id_vendedor): array
{
    $stmt = $pdo->prepare("SELECT 'compartido' AS tipo, id_producto, cantidad, fecha FROM compartidos WHERE id_vendedor = ? 
                            UNION ALL 
                            SELECT 'destacado' AS tipo, id_producto, cantidad, fecha FROM destacados WHERE id_vendedor = ? 
                            ORDER BY fecha ASC");
    $stmt->execute([$id_vendedor, $id_vendedor]);
    return $stmt->fetchAll(PDO::FETCH_ASSOC);
}

// ── Router ────────────────────────────────────────────────
$accion = $_GET['accion'] ?? '';
$user = verificar_usuario($pdo, $id_user);
if ($accion === 'obtener') {
   
   verificar_usuario($pdo, $id_user) || error_respuesta('Usuario no autorizado', 403);
    $datos = verificar_produto($pdo, $user['id']);
    foreach ($datos as &$item) {
        $item['nombre_producto'] = obtenerProductos($pdo, $item['id_producto']);
    }
    ok($datos);
}

error_respuesta('Acción no reconocida.', 404);