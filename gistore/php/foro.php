<?php
// ============================================================
//  gistore/php/foro.php — Foro público
// ============================================================

ob_start();

if (session_status() === PHP_SESSION_NONE)
    session_start();

// ── Capturar errores fatales como JSON ────────────────────
function handleFatalError() {
    $error = error_get_last();
    if ($error !== null && in_array($error['type'], [E_ERROR, E_PARSE, E_CORE_ERROR, E_COMPILE_ERROR])) {
        ob_end_clean();
        header('Content-Type: application/json; charset=utf-8');
        http_response_code(500);
        echo json_encode([
            'ok'    => false,
            'error' => 'Error fatal: ' . $error['message'],
            'file'  => basename($error['file']),
            'line'  => $error['line']
        ]);
        exit;
    }
}
register_shutdown_function('handleFatalError');

set_exception_handler(function(Throwable $e) {
    ob_end_clean();
    header('Content-Type: application/json; charset=utf-8');
    http_response_code(500);
    echo json_encode([
        'ok'    => false,
        'error' => get_class($e) . ': ' . $e->getMessage(),
        'file'  => basename($e->getFile()),
        'line'  => $e->getLine()
    ]);
    exit;
});

ini_set('display_errors', 0);
ini_set('display_startup_errors', 0);
error_reporting(E_ALL);

// ── Conexión ──────────────────────────────────────────────
require_once __DIR__ . '/../backend/conexion.php';

if (!function_exists('__Conectar')) {
    ob_end_clean();
    http_response_code(500);
    die(json_encode(['ok' => false, 'error' => 'Función __Conectar no encontrada']));
}

$pdo = __Conectar();

if (!$pdo) {
    ob_end_clean();
    http_response_code(500);
    die(json_encode(['ok' => false, 'error' => 'Error de conexión a la base de datos']));
}

header('Content-Type: application/json; charset=utf-8');

// ── Verificar token CSRF (solo POST) ─────────────────────
$metodo = $_SERVER['REQUEST_METHOD'];

if ($metodo === 'POST') {
    $token    = $_POST['token'] ?? '';
    $guardado = $_SESSION['csrf_token']      ?? '';
    $tiempo   = $_SESSION['csrf_token_time'] ?? 0;

    if (!$token || !$guardado || !hash_equals($guardado, $token)) {
        ob_end_clean();
        http_response_code(403);
        die(json_encode(['ok' => false, 'error' => 'Token inválido']));
    }
    if ((time() - $tiempo) > 7200) {
        ob_end_clean();
        http_response_code(403);
        die(json_encode(['ok' => false, 'error' => 'Token expirado']));
    }
}

// ── Helpers ───────────────────────────────────────────────
function ok(mixed $datos = null): never
{
    ob_end_clean();
    echo json_encode(['ok' => true, 'datos' => $datos], JSON_UNESCAPED_UNICODE);
    exit;
}
function error_respuesta(string $msg, int $codigo = 400): never
{
    ob_end_clean();
    http_response_code($codigo);
    echo json_encode(['ok' => false, 'error' => $msg], JSON_UNESCAPED_UNICODE);
    exit;
}
function sesion_requerida(): void
{
    if (empty($_SESSION['usuario_id']) || empty($_SESSION['rol']))
        error_respuesta('Sesión requerida. Inicia sesión para continuar.', 401);
}
function solo_autor_o_admin(int $autor_usuario_id): void
{
    $uid = intval($_SESSION['usuario_id'] ?? 0);
    $rol = intval($_SESSION['rol']        ?? 0);
    if ($uid !== $autor_usuario_id && $rol !== 1)
        error_respuesta('Sin permiso.', 403);
}
function resolverImagen(string $img): string
{
    if (!$img) return '';
    if (str_starts_with($img, 'http://') || str_starts_with($img, 'https://')) return $img;
    $proto   = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ? 'https' : 'http';
    $dominio = $proto . '://' . $_SERVER['HTTP_HOST'];
    return $dominio . '/' . ltrim($img, '/');
}

// ── GET: obtener hilos (PÚBLICO) ──────────────────────────
function obtener_hilos(PDO $pdo): void
{
    try {
        $stmt = $pdo->query("
            SELECT h.id, h.titulo, h.contenido, h.usuario_id,
                   h.respuestas, h.creado_en,
                   COALESCE(v.nombre, 'Administrador') AS autor_nombre,
                   COALESCE(v.perfil, '')               AS autor_foto,
                   COALESCE(v.color, '#1a6b3c')         AS autor_color
            FROM foro_hilos h
            INNER JOIN usuarios u ON u.id = h.usuario_id
            LEFT  JOIN vendedores v ON v.usuario_id = u.id
            ORDER BY h.creado_en DESC
        ");
        $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
        foreach ($rows as &$r) {
            $r['id']         = (string) $r['id'];
            $r['respuestas'] = (int)    $r['respuestas'];
            $r['autor_foto'] = resolverImagen($r['autor_foto']);
        }
        unset($r);
        ok($rows);
    } catch (PDOException $e) {
        error_respuesta('Error al obtener hilos: ' . $e->getMessage(), 500);
    }
}

// ── GET: respuestas de un hilo (PÚBLICO) ──────────────────
function obtener_respuestas(PDO $pdo): void
{
    try {
        $hilo_id = intval($_GET['hilo_id'] ?? 0);
        if (!$hilo_id) error_respuesta('hilo_id requerido.');

        $stmt = $pdo->prepare("
            SELECT r.id, r.hilo_id, r.contenido, r.usuario_id, r.creado_en,
                   COALESCE(v.nombre, 'Administrador') AS autor_nombre,
                   COALESCE(v.perfil, '')               AS autor_foto,
                   COALESCE(v.color, '#1a6b3c')         AS autor_color
            FROM foro_respuestas r
            INNER JOIN usuarios u ON u.id = r.usuario_id
            LEFT  JOIN vendedores v ON v.usuario_id = u.id
            WHERE r.hilo_id = ?
            ORDER BY r.creado_en ASC
        ");
        $stmt->execute([$hilo_id]);
        $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
        foreach ($rows as &$r) {
            $r['id']         = (string) $r['id'];
            $r['hilo_id']    = (string) $r['hilo_id'];
            $r['autor_foto'] = resolverImagen($r['autor_foto']);
        }
        unset($r);
        ok($rows);
    } catch (PDOException $e) {
        error_respuesta('Error al obtener respuestas: ' . $e->getMessage(), 500);
    }
}

// ── POST: crear hilo ──────────────────────────────────────
function crear_hilo(PDO $pdo): void
{
    try {
        sesion_requerida();

        $titulo    = trim($_POST['titulo'] ?? '');
        $contenido = trim($_POST['cuerpo'] ?? '');

        $uid  = intval($_SESSION['usuario_id']);


        $stmt = $pdo->prepare("
            INSERT INTO foro_hilos (usuario_id, titulo, contenido, respuestas, creado_en, actualizado_en)
            VALUES (:uid, :titulo, :contenido, 0, NOW(), NOW())
        ");
        $stmt->execute([
            ':uid'       => $uid,
            ':titulo'    => $titulo,
            ':contenido' => $contenido, // string vacío '' es válido para text NOT NULL
        ]);

        $nuevoId = $pdo->lastInsertId();
        error_log("crear_hilo: creado id=$nuevoId");

        ok(['id' => (string) $nuevoId]);

    } catch (PDOException $e) {
        error_log("crear_hilo PDOException: " . $e->getMessage());
        error_respuesta('Error al crear el hilo: ' . $e->getMessage(), 500);
    }
}

// ── POST: crear respuesta ─────────────────────────────────
function crear_respuesta(PDO $pdo): void
{
    try {
        sesion_requerida();

        $hilo_id   = intval($_POST['hilo_id'] ?? 0);
        $contenido = trim($_POST['texto']     ?? '');

        if (!$hilo_id)   error_respuesta('hilo_id requerido.');
        if (!$contenido) error_respuesta('El texto es obligatorio.');

        $existe = $pdo->prepare("SELECT id FROM foro_hilos WHERE id = ? LIMIT 1");
        $existe->execute([$hilo_id]);
        if (!$existe->fetch()) error_respuesta('Hilo no encontrado.', 404);

        $uid = intval($_SESSION['usuario_id']);

        $pdo->prepare("
            INSERT INTO foro_respuestas (hilo_id, usuario_id, contenido, creado_en)
            VALUES (:hilo_id, :uid, :contenido, NOW())
        ")->execute([':hilo_id' => $hilo_id, ':uid' => $uid, ':contenido' => $contenido]);

        $pdo->prepare("UPDATE foro_hilos SET respuestas = respuestas + 1 WHERE id = ?")
            ->execute([$hilo_id]);

        ok(['id' => (string) $pdo->lastInsertId()]);

    } catch (PDOException $e) {
        error_respuesta('Error al crear respuesta: ' . $e->getMessage(), 500);
    }
}

// ── POST: editar respuesta ────────────────────────────────
function editar_respuesta(PDO $pdo): void
{
    try {
        sesion_requerida();

        $resp_id   = intval($_POST['resp_id'] ?? 0);
        $contenido = trim($_POST['texto']     ?? '');

        if (!$resp_id)   error_respuesta('resp_id requerido.');
        if (!$contenido) error_respuesta('El texto no puede estar vacío.');

        $stmt = $pdo->prepare("SELECT usuario_id, creado_en FROM foro_respuestas WHERE id = ? LIMIT 1");
        $stmt->execute([$resp_id]);
        $resp = $stmt->fetch(PDO::FETCH_ASSOC);
        if (!$resp) error_respuesta('Respuesta no encontrada.', 404);

        solo_autor_o_admin(intval($resp['usuario_id']));

        $rol = intval($_SESSION['rol'] ?? 0);
        if ($rol !== 1) {
            $diff = time() - strtotime($resp['creado_en']);
            if ($diff > 1800) error_respuesta('Han pasado más de 30 minutos. Ya no puedes editar.', 403);
        }

        $pdo->prepare("UPDATE foro_respuestas SET contenido = ? WHERE id = ?")
            ->execute([$contenido, $resp_id]);

        ok(['id' => (string) $resp_id]);

    } catch (PDOException $e) {
        error_respuesta('Error al editar respuesta: ' . $e->getMessage(), 500);
    }
}

// ── POST: eliminar hilo ───────────────────────────────────
function eliminar_hilo(PDO $pdo): void
{
    try {
        sesion_requerida();

        $hilo_id = intval($_POST['hilo_id'] ?? 0);
        if (!$hilo_id) error_respuesta('hilo_id requerido.');

        $stmt = $pdo->prepare("SELECT usuario_id FROM foro_hilos WHERE id = ? LIMIT 1");
        $stmt->execute([$hilo_id]);
        $hilo = $stmt->fetch(PDO::FETCH_ASSOC);
        if (!$hilo) error_respuesta('Hilo no encontrado.', 404);

        solo_autor_o_admin(intval($hilo['usuario_id']));

        $pdo->prepare("DELETE FROM foro_respuestas WHERE hilo_id = ?")->execute([$hilo_id]);
        $pdo->prepare("DELETE FROM foro_hilos      WHERE id      = ?")->execute([$hilo_id]);

        ok(['eliminado' => true]);

    } catch (PDOException $e) {
        error_respuesta('Error al eliminar hilo: ' . $e->getMessage(), 500);
    }
}

// ── POST: eliminar respuesta ──────────────────────────────
function eliminar_respuesta(PDO $pdo): void
{
    try {
        sesion_requerida();

        $resp_id = intval($_POST['resp_id'] ?? 0);
        $hilo_id = intval($_POST['hilo_id'] ?? 0);

        if (!$resp_id || !$hilo_id) error_respuesta('resp_id y hilo_id requeridos.');

        $stmt = $pdo->prepare("SELECT usuario_id FROM foro_respuestas WHERE id = ? LIMIT 1");
        $stmt->execute([$resp_id]);
        $resp = $stmt->fetch(PDO::FETCH_ASSOC);
        if (!$resp) error_respuesta('Respuesta no encontrada.', 404);

        solo_autor_o_admin(intval($resp['usuario_id']));

        $pdo->prepare("DELETE FROM foro_respuestas WHERE id = ?")->execute([$resp_id]);
        $pdo->prepare("
            UPDATE foro_hilos SET respuestas = GREATEST(0, respuestas - 1) WHERE id = ?
        ")->execute([$hilo_id]);

        ok(['eliminado' => true]);

    } catch (PDOException $e) {
        error_respuesta('Error al eliminar respuesta: ' . $e->getMessage(), 500);
    }
}

// ── Router ────────────────────────────────────────────────
$accion = $_GET['accion'] ?? $_POST['accion'] ?? '';

match (true) {
    $accion === 'obtener_hilos'      && $metodo === 'GET'  => obtener_hilos($pdo),
    $accion === 'obtener_respuestas' && $metodo === 'GET'  => obtener_respuestas($pdo),
    $accion === 'crear_hilo'         && $metodo === 'POST' => crear_hilo($pdo),
    $accion === 'crear_respuesta'    && $metodo === 'POST' => crear_respuesta($pdo),
    $accion === 'editar_respuesta'   && $metodo === 'POST' => editar_respuesta($pdo),
    $accion === 'eliminar_hilo'      && $metodo === 'POST' => eliminar_hilo($pdo),
    $accion === 'eliminar_respuesta' && $metodo === 'POST' => eliminar_respuesta($pdo),
    default => error_respuesta('Acción no válida.', 404),
};