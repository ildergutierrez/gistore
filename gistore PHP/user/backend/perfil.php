<?php
// ============================================================
//  user/backend/perfil.php
//  CRUD del perfil del vendedor en sesión — MySQL
// ============================================================

if (session_status() === PHP_SESSION_NONE)
    session_start();

set_exception_handler(function ($e) {
    http_response_code(500);
    echo json_encode(['ok' => false, 'error' => $e->getMessage()]);
    exit;
});

header('Content-Type: application/json');

// ── Verificar sesión de vendedor (rol = 2) ────────────────
if (empty($_SESSION['usuario_id']) || (int)($_SESSION['rol'] ?? 0) !== 2) {
    http_response_code(401);
    die(json_encode(['ok' => false, 'error' => 'No autenticado.']));
}

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

$usuario_id = (int)$_SESSION['usuario_id'];

// ── Conexión ──────────────────────────────────────────────
require_once __DIR__ . '/../../backend/conexion.php';
$pdo = __Conectar();

// ── Helpers ───────────────────────────────────────────────
function ok(mixed $datos = null): never {
    echo json_encode(['ok' => true, 'datos' => $datos], JSON_UNESCAPED_UNICODE);
    exit;
}
function err(string $msg, int $code = 400): never {
    http_response_code($code);
    echo json_encode(['ok' => false, 'error' => $msg], JSON_UNESCAPED_UNICODE);
    exit;
}

// ── Obtener vendedor_id desde usuario_id ──────────────────
function obtener_vendedor_id($pdo, int $usuario_id): int {
    $stmt = $pdo->prepare("SELECT id FROM vendedores WHERE usuario_id = ? LIMIT 1");
    $stmt->execute([$usuario_id]);
    $row = $stmt->fetch(PDO::FETCH_ASSOC);
    if (!$row) err('Vendedor no encontrado.', 404);
    return (int)$row['id'];
}

// ════════════════════════════════════════════════════════════
//  ACCION: obtener — lee todos los datos del perfil
// ════════════════════════════════════════════════════════════
function accion_obtener($pdo, int $usuario_id): void {
    $stmt = $pdo->prepare("
        SELECT v.id, v.nombre, v.ciudad, v.correo, v.whatsapp,
               v.descripcion, v.perfil, v.color, v.url_web,
               v.redes, v.estado, v.creado_en, v.actualizado_en,
               m.estado        AS mem_estado,
               m.fecha_fin     AS mem_fecha_fin,
               p.nombre        AS mem_plan
        FROM vendedores v
        LEFT JOIN membresias m ON m.vendedor_id = v.id
            AND m.estado = 'activa'
            AND m.fecha_fin >= CURDATE()
        LEFT JOIN planes_membresia p ON p.id = m.plan_id
        WHERE v.usuario_id = ?
        ORDER BY m.fecha_fin DESC
        LIMIT 1
    ");
    $stmt->execute([$usuario_id]);
    $row = $stmt->fetch(PDO::FETCH_ASSOC);
    if (!$row) err('Perfil no encontrado.', 404);

    // redes viene como JSON en la BD
    $row['redes'] = $row['redes'] ? json_decode($row['redes'], true) : [];

    ok($row);
}

// ════════════════════════════════════════════════════════════
//  ACCION: actualizar — guarda nombre, ciudad, whatsapp,
//          url_web, descripcion, redes
// ════════════════════════════════════════════════════════════
function accion_actualizar($pdo, int $usuario_id): void {
    $vendedor_id = obtener_vendedor_id($pdo, $usuario_id);

    $nombre      = trim($_POST['nombre']      ?? '');
    $ciudad      = trim($_POST['ciudad']      ?? '');
    $whatsapp    = trim($_POST['whatsapp']    ?? '');
    $url_web     = trim($_POST['url_web']     ?? '');
    $descripcion = trim($_POST['descripcion'] ?? '');
    $redes_raw   = trim($_POST['redes']       ?? '{}');

    if (!$nombre) err('El nombre es obligatorio.');
    if (strlen($descripcion) > 300) err('La descripción no puede superar 300 caracteres.');

    // Validar url_web
    if ($url_web && !filter_var($url_web, FILTER_VALIDATE_URL))
        err('La URL de la página web no es válida.');

    // Validar y sanitizar redes (JSON)
    $redes = json_decode($redes_raw, true);
    if (!is_array($redes)) $redes = [];
    foreach ($redes as $red => $url) {
        if ($url && !filter_var($url, FILTER_VALIDATE_URL))
            err("La URL de $red no es válida.");
    }

    $stmt = $pdo->prepare("
        UPDATE vendedores SET
            nombre       = :nombre,
            ciudad       = :ciudad,
            whatsapp     = :whatsapp,
            url_web      = :url_web,
            descripcion  = :descripcion,
            redes        = :redes,
            actualizado_en = NOW()
        WHERE id = :id
    ");
    $stmt->execute([
        ':nombre'      => $nombre,
        ':ciudad'      => $ciudad,
        ':whatsapp'    => $whatsapp,
        ':url_web'     => $url_web ?: null,
        ':descripcion' => $descripcion ?: null,
        ':redes'       => json_encode($redes, JSON_UNESCAPED_UNICODE),
        ':id'          => $vendedor_id,
    ]);

    ok(['actualizado' => true, 'nombre' => $nombre]);
}

// ════════════════════════════════════════════════════════════
//  ACCION: actualizar_foto — guarda URL de foto (perfil)
// ════════════════════════════════════════════════════════════
function accion_actualizar_foto($pdo, int $usuario_id): void {
    $vendedor_id = obtener_vendedor_id($pdo, $usuario_id);
    $url = trim($_POST['perfil'] ?? '');

    // Permitir vacío (eliminar foto)
    if ($url && !filter_var($url, FILTER_VALIDATE_URL))
        err('URL de foto no válida.');

    $stmt = $pdo->prepare("
        UPDATE vendedores SET perfil = :perfil, actualizado_en = NOW()
        WHERE id = :id
    ");
    $stmt->execute([':perfil' => $url ?: null, ':id' => $vendedor_id]);

    ok(['perfil' => $url]);
}

// ════════════════════════════════════════════════════════════
//  ACCION: cambiar_password
// ════════════════════════════════════════════════════════════
function accion_cambiar_password($pdo, int $usuario_id): void {
    $pass_actual = $_POST['pass_actual'] ?? '';
    $pass_nueva  = $_POST['pass_nueva']  ?? '';
    $pass_conf   = $_POST['pass_conf']   ?? '';

    if (!$pass_actual)              err('Ingresa tu contraseña actual.');
    if (strlen($pass_nueva) < 6)    err('La nueva contraseña debe tener al menos 6 caracteres.');
    if ($pass_nueva !== $pass_conf) err('Las contraseñas no coinciden.');
    if ($pass_actual === $pass_nueva) err('La nueva contraseña debe ser diferente a la actual.');

    $stmt = $pdo->prepare("SELECT password_hash FROM usuarios WHERE id = ? LIMIT 1");
    $stmt->execute([$usuario_id]);
    $usuario = $stmt->fetch(PDO::FETCH_ASSOC);
    if (!$usuario) err('Usuario no encontrado.', 404);

    if (!password_verify($pass_actual, $usuario['password_hash']))
        err('Contraseña actual incorrecta.');

    $nuevo_hash = password_hash($pass_nueva, PASSWORD_DEFAULT);
    $stmt = $pdo->prepare("
        UPDATE usuarios SET password_hash = :hash, actualizado_en = NOW()
        WHERE id = :id
    ");
    $stmt->execute([':hash' => $nuevo_hash, ':id' => $usuario_id]);

    ok(['actualizado' => true]);
}

// ── Router ────────────────────────────────────────────────
$accion = $_GET['accion'] ?? $_POST['accion'] ?? '';
$metodo = $_SERVER['REQUEST_METHOD'];

match (true) {
    $accion === 'obtener'           && $metodo === 'GET'  => accion_obtener($pdo, $usuario_id),
    $accion === 'actualizar'        && $metodo === 'POST' => accion_actualizar($pdo, $usuario_id),
    $accion === 'actualizar_foto'   && $metodo === 'POST' => accion_actualizar_foto($pdo, $usuario_id),
    $accion === 'cambiar_password'  && $metodo === 'POST' => accion_cambiar_password($pdo, $usuario_id),
    default => err('Acción no reconocida.', 404),
};