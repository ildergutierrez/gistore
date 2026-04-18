<?php
//================================================
// admin/backend/perfil.php
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

// ── Verificar sesión de administrador ─────────────────────
if (!isset($_SESSION['usuario_id']) || (int)($_SESSION['rol'] ?? 0) !== 1) {
    http_response_code(403);
    die(json_encode(['ok' => false, 'error' => 'Acceso denegado']));
}

$usuario_id = (int)$_SESSION['usuario_id'];

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

// ── Obtener datos del perfil ──────────────────────────────
function obtener_Perfil($conn, int $id): void
{
    $stmt = $conn->prepare("
        SELECT id, correo, rol, activo, creado_en, actualizado_en
        FROM usuarios
        WHERE id = ? AND rol = 1
        LIMIT 1
    ");
    $stmt->execute([$id]);
    $usuario = $stmt->fetch(PDO::FETCH_ASSOC);
    if (!$usuario) error_respuesta('Usuario no encontrado.', 404);
    ok($usuario);
}

// ── Actualizar nombre (guardado en sesión) ────────────────
function actualizar_Nombre($conn, int $id): void
{
    // El nombre del admin no está en la BD (no hay campo nombre en usuarios)
    // Se devuelve ok para que el JS lo guarde donde quiera (sessionStorage, etc.)
    $nombre = trim($_POST['nombre'] ?? '');
    if (!$nombre) error_respuesta('El nombre es obligatorio.');

    // Guardar en sesión para que persista mientras dure la sesión
    $_SESSION['admin_nombre'] = $nombre;
    ok(['nombre' => $nombre]);
}

// ── Cambiar contraseña ────────────────────────────────────
function cambiar_Password($conn, int $id): void
{
    $pass_actual = trim($_POST['pass_actual'] ?? '');
    $pass_nueva  = trim($_POST['pass_nueva']  ?? '');
    $pass_conf   = trim($_POST['pass_conf']   ?? '');

    if (!$pass_actual)          error_respuesta('Ingresa tu contraseña actual.');
    if (strlen($pass_nueva) < 6) error_respuesta('La nueva contraseña debe tener al menos 6 caracteres.');
    if ($pass_nueva !== $pass_conf) error_respuesta('Las contraseñas no coinciden.');
    if ($pass_actual === $pass_nueva) error_respuesta('La nueva contraseña debe ser diferente a la actual.');

    // Obtener hash actual
    $stmt = $conn->prepare("SELECT password_hash FROM usuarios WHERE id = ? AND rol = 1 LIMIT 1");
    $stmt->execute([$id]);
    $usuario = $stmt->fetch(PDO::FETCH_ASSOC);
    if (!$usuario) error_respuesta('Usuario no encontrado.', 404);

    // Verificar contraseña actual
    if (!password_verify($pass_actual, $usuario['password_hash'])) {
        error_respuesta('Contraseña actual incorrecta.');
    }

    // Actualizar con nuevo hash
    $nuevo_hash = password_hash($pass_nueva, PASSWORD_DEFAULT);
    $stmt = $conn->prepare("
        UPDATE usuarios
        SET password_hash = :hash, actualizado_en = NOW()
        WHERE id = :id
    ");
    $stmt->execute([':hash' => $nuevo_hash, ':id' => $id]);

    ok(['actualizado' => true]);
}

// ── Router ────────────────────────────────────────────────
$accion = $_GET['accion'] ?? $_POST['accion'] ?? '';
$metodo = $_SERVER['REQUEST_METHOD'];

match (true) {
    $accion === 'obtener'           && $metodo === 'GET'  => obtener_Perfil($pdo, $usuario_id),
    $accion === 'actualizar_nombre' && $metodo === 'POST' => actualizar_Nombre($pdo, $usuario_id),
    $accion === 'cambiar_password'  && $metodo === 'POST' => cambiar_Password($pdo, $usuario_id),
    default                                               => error_respuesta('Acción no reconocida.', 404),
};