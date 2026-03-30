<?php
// ============================================================
//  backend/login.php
// ============================================================
session_start();
header('Content-Type: application/json');

require_once __DIR__ . '/../../backend/conexion.php';

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
function verificar_token(): void
{
    $token    = $_POST['token']              ?? '';
    $guardado = $_SESSION['csrf_token']      ?? '';
    $tiempo   = $_SESSION['csrf_token_time'] ?? 0;

    if (!$token || !$guardado || !hash_equals($guardado, $token))
        error_respuesta('Token inválido', 403);

    if ((time() - $tiempo) > 7200)
        error_respuesta('Token expirado', 403);
}

function leer_campos(): array
{
    $correo   = trim($_POST['correo']   ?? '');
    $password = trim($_POST['password'] ?? '');

    if (!$correo || !$password)
        error_respuesta('Completa todos los campos.');

    return compact('correo', 'password');
}

function buscar_usuario(PDO $pdo, string $correo): array
{
    $stmt = $pdo->prepare("SELECT id, correo, password_hash, rol, activo
                           FROM usuarios
                           WHERE correo = ?
                           LIMIT 1");
    $stmt->execute([$correo]);
    $usuario = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$usuario)
        error_respuesta('Correo o contraseña incorrectos.');

    return $usuario;
}

function validar_usuario(array $usuario, string $password): void
{
    if (!password_verify($password, $usuario['password_hash']))
        error_respuesta('Correo o contraseña incorrectos.');

    if (!$usuario['activo'])
        error_respuesta('Tu cuenta está desactivada.');

    if ((int)$usuario['rol'] !== 1)
        error_respuesta('No tienes permisos de administrador.');
}

function crear_sesion(array $usuario): void
{
    $_SESSION['usuario_id'] = $usuario['id'];
    $_SESSION['correo']     = $usuario['correo'];
    $_SESSION['rol']        = $usuario['rol'];

}

// ── Router ────────────────────────────────────────────────
verificar_token();

['correo' => $correo, 'password' => $password] = leer_campos();

$pdo     = __Conectar();
$usuario = buscar_usuario($pdo, $correo);

validar_usuario($usuario, $password);
crear_sesion($usuario);

__Desconectar($pdo);
ok(['rol' => $usuario['rol'], 'correo' => $usuario['correo']]);