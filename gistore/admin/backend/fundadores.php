<?php
//================================================
// admin/backend/fundadores.php
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
function obtener_Fundadores($conn) {
    $stmt = $conn->prepare("
        SELECT id, vendedor_id, fecha_registro, creado_en
        FROM fundadores
        ORDER BY fecha_registro ASC
    ");
    $stmt->execute();
    return $stmt->fetchAll(PDO::FETCH_ASSOC);
}

// ── Contar ────────────────────────────────────────────────
function contar_Fundadores($conn) {
    $stmt = $conn->prepare("SELECT COUNT(*) FROM fundadores");
    $stmt->execute();
    ok(['total' => (int)$stmt->fetchColumn()]);
}

// ── Registrar fundador ────────────────────────────────────
function registrar_Fundador($conn) {
    $vendedor_id = intval($_POST['vendedor_id'] ?? 0);
    if (!$vendedor_id) error_respuesta('El vendedor es obligatorio.');

    // Máximo 15 fundadores
    $total = $conn->query("SELECT COUNT(*) FROM fundadores")->fetchColumn();
    if ($total >= 15) {
        echo json_encode([
            'ok'    => false,
            'razon' => 'cupo_lleno',
            'error' => 'Ya hay 15 fundadores registrados.',
        ], JSON_UNESCAPED_UNICODE);
        exit;
    }

    // Verificar duplicado
    $check = $conn->prepare("SELECT id FROM fundadores WHERE vendedor_id = ?");
    $check->execute([$vendedor_id]);
    if ($check->fetch()) {
        echo json_encode([
            'ok'    => false,
            'razon' => 'ya_es_fundador',
            'error' => 'Este vendedor ya es fundador.',
        ], JSON_UNESCAPED_UNICODE);
        exit;
    }

    $stmt = $conn->prepare("
        INSERT INTO fundadores (vendedor_id, fecha_registro, creado_en)
        VALUES (:vendedor_id, CURDATE(), NOW())
    ");
    $stmt->execute([':vendedor_id' => $vendedor_id]);

    ok(['id' => $conn->lastInsertId(), 'ok' => true]);
}

// ── Router ────────────────────────────────────────────────
$accion = $_GET['accion'] ?? $_POST['accion'] ?? '';

match ($accion) {
    'obtener'   => ok(obtener_Fundadores($pdo)),
    'contar'    => contar_Fundadores($pdo),
    'registrar' => registrar_Fundador($pdo),
    default     => error_respuesta('Acción no reconocida.', 404),
};