<?php
//================================================
// gistore/php/count.php — Público, solo lectura
// Maneja: conteo de clicks en cada modal para ver la descricción
//================================================

if (session_status() === PHP_SESSION_NONE)
    session_start();

header('Content-Type: application/json');

// ── Verificar token ───────────────────────────────────────
$token = $_GET['token'] ?? $_POST['token'] ?? '';
$guardado = $_SESSION['csrf_token'] ?? '';
$tiempo = $_SESSION['csrf_token_time'] ?? 0;

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

function consultaExistencia($pdo, $dato)
{
    $hoy = date('Y-m-d');
     try {
    $sql = $pdo->prepare("SELECT * FROM `destacados` WHERE id_producto = :id   ORDER BY `destacados`.`fecha` DESC");
    $sql->execute([':id' => $dato]);
    $count = $sql->fetch(PDO::FETCH_ASSOC);
    if ($count['fecha'] == $hoy)
        return $count['cantidad'];
    return 0;
     } catch (Exception $e) {
        error_respuesta($e->getMessage());

    }
}

function actualizarCount($pdo)
{
    $hoy = date('Y-m-d');
    $producto = $_POST['prod'] ?? '';
    $tienda = $_POST['store'] ?? '';
    $valor = consultaExistencia($pdo, $producto);
    $cantida = $valor + 1;
    if ($valor > 0) {
        $pdo->prepare("
            UPDATE destacados SET 
            cantidad = :cantidad  
            WHERE id_producto = :producto AND 
            fecha = :fecha
            ")->execute([
                    ':cantidad' => $cantida,
                    ':producto' => $producto,
                    ':fecha' => $hoy
                ]);

    } else {
        $stmt = $pdo->prepare("
        INSERT INTO destacados (id_producto, id_vendedor, cantidad, fecha)
        VALUES (:id, :id_tienda , 1, :hoy)
        ON DUPLICATE KEY UPDATE cantidad = cantidad + 1
    ");
        $stmt->execute([':id' => $producto, ':id_tienda' => $tienda, ':hoy' => $hoy]);
    }

    ok();
}

//====== Compartir ==========
function consultaCompartir($pdo, $dato)
{
    $hoy = date('Y-m-d');
    try {
        $sql = $pdo->prepare("SELECT * FROM `compartidos` WHERE id_producto = :id   ORDER BY `compartidos`.`fecha` DESC");
        $sql->execute([':id' => $dato]);
        $count = $sql->fetch(PDO::FETCH_ASSOC);
        if ($count['fecha'] == $hoy)
            return $count['cantidad'];
        return 0;
    } catch (Exception $e) {
        error_respuesta($e->getMessage());

    }
}

function compartirCount($pdo)
{
    $hoy = date('Y-m-d');
    $producto = $_POST['prod'] ?? '';
    $tienda = $_POST['store'] ?? '';
    $valor = consultaCompartir($pdo, $producto);
    $cantida = $valor + 1;
    if ($valor > 0) {
        $pdo->prepare("
            UPDATE compartidos SET 
            cantidad = :cantidad  
            WHERE id_producto = :producto AND 
            fecha = :fecha
            ")->execute([
                    ':cantidad' => $cantida,
                    ':producto' => $producto,
                    ':fecha' => $hoy
                ]);

    } else {
        $stmt = $pdo->prepare("
        INSERT INTO compartidos (id_producto, id_vendedor, cantidad, fecha)
        VALUES (:id, :id_tienda , 1, :hoy)
        ON DUPLICATE KEY UPDATE cantidad = cantidad + 1
    ");
        $stmt->execute([':id' => $producto, ':id_tienda' => $tienda, ':hoy' => $hoy]);
    }

    ok();
}

$accion = $_POST['accion'] ?? '';

match ($accion) { 
    'actualizar' => actualizarCount($pdo),
    'compartir' => compartirCount($pdo),
    default => error_respuesta('Acción no reconocida.', 404),
};
