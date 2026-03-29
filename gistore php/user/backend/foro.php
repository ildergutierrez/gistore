<?php
// ============================================================
//  user/backend/foro.php — Gestión del foro
// ============================================================

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

// ── Obtener usuario_id de sesión ──────────────────────────
function usuario_sesion(): int
{
    $uid = $_SESSION['usuario_id'] ?? 0;
    if (!$uid) error_respuesta('Sesión no iniciada', 401);
    return (int) $uid;
}

// ── Funciones ─────────────────────────────────────────────
function obtener_hilos($pdo): array
{
    $stmt = $pdo->query(
        "SELECT h.*,
                COALESCE(v.nombre, 'Administrador') AS vendedor_nombre,
                v.perfil                            AS vendedor_perfil,
                COALESCE(v.color, '#1a6b3c')        AS autor_color
         FROM foro_hilos h
         JOIN      usuarios  u ON u.id         = h.usuario_id
         LEFT JOIN vendedores v ON v.usuario_id = u.id
         ORDER BY h.creado_en DESC"
    );
    return $stmt->fetchAll(PDO::FETCH_ASSOC);
}

function obtener_respuestas($pdo): array
{
    $hilo_id = intval($_GET['hilo_id'] ?? 0);
    if (!$hilo_id) error_respuesta('hilo_id requerido');

    $stmt = $pdo->prepare(
        "SELECT r.*,
                COALESCE(v.nombre, 'Administrador') AS vendedor_nombre,
                v.perfil                            AS vendedor_perfil,
                COALESCE(v.color, '#1a6b3c')        AS autor_color
         FROM foro_respuestas r
         JOIN      usuarios  u ON u.id         = r.usuario_id
         LEFT JOIN vendedores v ON v.usuario_id = u.id
         WHERE r.hilo_id = ?
         ORDER BY r.creado_en ASC"
    );
    $stmt->execute([$hilo_id]);
    return $stmt->fetchAll(PDO::FETCH_ASSOC);
}

function crear_hilo($pdo): void
{
    $uid    = usuario_sesion();
    $titulo = trim($_POST['titulo'] ?? '');
    $cuerpo = trim($_POST['cuerpo'] ?? '');

    if (!$titulo) error_respuesta('El título es obligatorio');

    $stmt = $pdo->prepare(
        "INSERT INTO foro_hilos (usuario_id, titulo, contenido, respuestas, creado_en)
         VALUES (?, ?, ?, 0, NOW())"
    );
    $stmt->execute([$uid, $titulo, $cuerpo]);
    ok(['id' => $pdo->lastInsertId()]);
}

function crear_respuesta($pdo): void
{
    $uid     = usuario_sesion();
    $hilo_id = intval($_POST['hilo_id'] ?? 0);
    $texto   = trim($_POST['texto'] ?? '');

    if (!$hilo_id) error_respuesta('hilo_id requerido');
    if (!$texto)   error_respuesta('El texto no puede estar vacío');

    $stmt = $pdo->prepare(
        "INSERT INTO foro_respuestas (hilo_id, usuario_id, contenido, creado_en)
         VALUES (?, ?, ?, NOW())"
    );
    $stmt->execute([$hilo_id, $uid, $texto]);

    $pdo->prepare("UPDATE foro_hilos SET respuestas = respuestas + 1 WHERE id = ?")
        ->execute([$hilo_id]);

    ok(['id' => $pdo->lastInsertId()]);
}

function editar_respuesta($pdo): void
{
    $uid     = usuario_sesion();
    $resp_id = intval($_POST['resp_id'] ?? 0);
    $texto   = trim($_POST['texto'] ?? '');

    if (!$resp_id) error_respuesta('resp_id requerido');
    if (!$texto)   error_respuesta('El texto no puede estar vacío');

    // Solo puede editar el propio usuario y dentro de los 30 min
    $stmt = $pdo->prepare(
        "UPDATE foro_respuestas
         SET texto = ?
         WHERE id = ?
           AND usuario_id = ?
           AND creado_en >= DATE_SUB(NOW(), INTERVAL 30 MINUTE)"
    );
    $stmt->execute([$texto, $resp_id, $uid]);

    if ($stmt->rowCount() === 0)
        error_respuesta('No autorizado o tiempo de edición expirado', 403);

    ok(['editado' => true]);
}

function eliminar_hilo($pdo): void
{
    $hilo_id = intval($_POST['hilo_id'] ?? 0);
    if (!$hilo_id) error_respuesta('hilo_id requerido');

    $pdo->prepare("DELETE FROM foro_respuestas WHERE hilo_id = ?")->execute([$hilo_id]);
    $pdo->prepare("DELETE FROM foro_hilos      WHERE id      = ?")->execute([$hilo_id]);
    ok(['eliminado' => true]);
}

function eliminar_respuesta($pdo): void
{
    $uid     = usuario_sesion();
    $resp_id = intval($_POST['resp_id'] ?? 0);
    $hilo_id = intval($_POST['hilo_id'] ?? 0);

    if (!$resp_id || !$hilo_id) error_respuesta('resp_id y hilo_id requeridos');

    // Solo puede eliminar su propia respuesta (admin puede sin restricción)
    $stmt = $pdo->prepare(
        "DELETE FROM foro_respuestas WHERE id = ? AND usuario_id = ?"
    );
    $stmt->execute([$resp_id, $uid]);

    if ($stmt->rowCount() === 0)
        error_respuesta('No autorizado', 403);

    $pdo->prepare("UPDATE foro_hilos SET respuestas = GREATEST(0, respuestas - 1) WHERE id = ?")
        ->execute([$hilo_id]);

    ok(['eliminado' => true]);
}

// ── Router ────────────────────────────────────────────────
$accion = $_GET['accion'] ?? $_POST['accion'] ?? '';
$metodo = $_SERVER['REQUEST_METHOD'];

if ($accion === 'obtener_hilos'      && $metodo === 'GET')  ok(obtener_hilos($pdo));
if ($accion === 'obtener_respuestas' && $metodo === 'GET')  ok(obtener_respuestas($pdo));
if ($accion === 'crear_hilo'         && $metodo === 'POST') crear_hilo($pdo);
if ($accion === 'crear_respuesta'    && $metodo === 'POST') crear_respuesta($pdo);
if ($accion === 'editar_respuesta'   && $metodo === 'POST') editar_respuesta($pdo);
if ($accion === 'eliminar_hilo'      && $metodo === 'POST') eliminar_hilo($pdo);
if ($accion === 'eliminar_respuesta' && $metodo === 'POST') eliminar_respuesta($pdo);

error_respuesta('Acción no válida');