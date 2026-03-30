<?php
//================================================
// admin/backend/publicidad.php
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

// ── Obtener publicidades + conteo de hoy ─────────────────
function obtener_Publicidades($conn): array
{
    $hoy = date('Y-m-d');
    $stmt = $conn->prepare("
        SELECT p.*,
               COALESCE(pi.contador, 0) AS _hoy_count
        FROM publicidad p
        LEFT JOIN publicidad_impresiones pi
               ON pi.publicidad_id = p.id
              AND pi.fecha = :hoy
        ORDER BY p.creado_en DESC
    ");
    $stmt->execute([':hoy' => $hoy]);
    return $stmt->fetchAll(PDO::FETCH_ASSOC);
}

// ── Crear publicidad ──────────────────────────────────────
function crear_Publicidad($conn): void
{
    $titulo        = trim($_POST['titulo']        ?? '');
    $imagen_url    = trim($_POST['imagen_url']    ?? '');
    $url_destino   = trim($_POST['url_destino']   ?? '');
    $fecha_inicio  = trim($_POST['fecha_inicio']  ?? '');
    $fecha_fin     = trim($_POST['fecha_fin']     ?? '');
    $limite_diario = intval($_POST['limite_diario'] ?? 50);
    $estado        = trim($_POST['estado']        ?? 'activa');

    if (!$fecha_inicio)  error_respuesta('La fecha de inicio es obligatoria.');
    if (!$fecha_fin)     error_respuesta('La fecha de fin es obligatoria.');
    if ($fecha_fin < $fecha_inicio) error_respuesta('La fecha de fin debe ser posterior al inicio.');

    $estados_validos = ['activa', 'inactiva', 'pausada', 'pausada_auto'];
    if (!in_array($estado, $estados_validos)) $estado = 'activa';

    $stmt = $conn->prepare("
        INSERT INTO publicidad
            (titulo, imagen_url, url_destino, fecha_inicio, fecha_fin,
             limite_diario, estado, creado_en, actualizado_en)
        VALUES
            (:titulo, :imagen_url, :url_destino, :fecha_inicio, :fecha_fin,
             :limite_diario, :estado, NOW(), NOW())
    ");
    $stmt->execute([
        ':titulo'        => $titulo        ?: null,
        ':imagen_url'    => $imagen_url    ?: null,
        ':url_destino'   => $url_destino   ?: null,
        ':fecha_inicio'  => $fecha_inicio,
        ':fecha_fin'     => $fecha_fin,
        ':limite_diario' => $limite_diario,
        ':estado'        => $estado,
    ]);

    ok(['id' => $conn->lastInsertId()]);
}

// ── Actualizar publicidad ─────────────────────────────────
function actualizar_Publicidad($conn): void
{
    $id            = intval($_POST['id']            ?? 0);
    $estado        = trim($_POST['estado']          ?? '');

    if (!$id) error_respuesta('ID inválido.');

    // Si solo viene el estado (auto-pausa / reactivación desde JS)
    $soloEstado = count(array_filter(array_keys($_POST), fn($k) => !in_array($k, ['id','estado','token','accion']))) === 0;

    $estados_validos = ['activa', 'inactiva', 'pausada', 'pausada_auto'];

    if ($soloEstado && $estado) {
        if (!in_array($estado, $estados_validos)) error_respuesta('Estado inválido.');
        $stmt = $conn->prepare("
            UPDATE publicidad SET estado = :estado, actualizado_en = NOW() WHERE id = :id
        ");
        $stmt->execute([':estado' => $estado, ':id' => $id]);
        ok(['id' => $id]);
    }

    // Actualización completa
    $titulo        = trim($_POST['titulo']        ?? '');
    $imagen_url    = trim($_POST['imagen_url']    ?? '');
    $url_destino   = trim($_POST['url_destino']   ?? '');
    $fecha_inicio  = trim($_POST['fecha_inicio']  ?? '');
    $fecha_fin     = trim($_POST['fecha_fin']     ?? '');
    $limite_diario = intval($_POST['limite_diario'] ?? 50);

    if (!$fecha_inicio) error_respuesta('La fecha de inicio es obligatoria.');
    if (!$fecha_fin)    error_respuesta('La fecha de fin es obligatoria.');
    if ($fecha_fin < $fecha_inicio) error_respuesta('La fecha de fin debe ser posterior al inicio.');
    if ($estado && !in_array($estado, $estados_validos)) $estado = 'activa';

    $stmt = $conn->prepare("
        UPDATE publicidad
        SET titulo         = :titulo,
            imagen_url     = :imagen_url,
            url_destino    = :url_destino,
            fecha_inicio   = :fecha_inicio,
            fecha_fin      = :fecha_fin,
            limite_diario  = :limite_diario,
            estado         = :estado,
            actualizado_en = NOW()
        WHERE id = :id
    ");
    $stmt->execute([
        ':titulo'        => $titulo        ?: null,
        ':imagen_url'    => $imagen_url    ?: null,
        ':url_destino'   => $url_destino   ?: null,
        ':fecha_inicio'  => $fecha_inicio,
        ':fecha_fin'     => $fecha_fin,
        ':limite_diario' => $limite_diario,
        ':estado'        => $estado ?: 'activa',
        ':id'            => $id,
    ]);

    ok(['id' => $id]);
}

// ── Eliminar publicidad ───────────────────────────────────
function eliminar_Publicidad($conn): void
{
    $id = intval($_POST['id'] ?? 0);
    if (!$id) error_respuesta('ID inválido.');

    // Eliminar impresiones asociadas primero (FK)
    $conn->prepare("DELETE FROM publicidad_impresiones WHERE publicidad_id = ?")->execute([$id]);
    $conn->prepare("DELETE FROM publicidad WHERE id = ?")->execute([$id]);
    ok(['id' => $id]);
}

// ── Registrar impresión (GET — lo llama el catálogo público) ──
function registrar_Impresion($conn): void
{
    $id  = intval($_GET['id'] ?? 0);
    $hoy = date('Y-m-d');
    if (!$id) error_respuesta('ID inválido.');

    // INSERT ... ON DUPLICATE KEY UPDATE para upsert atómico
    $stmt = $conn->prepare("
        INSERT INTO publicidad_impresiones (publicidad_id, fecha, contador)
        VALUES (:id, :hoy, 1)
        ON DUPLICATE KEY UPDATE contador = contador + 1
    ");
    $stmt->execute([':id' => $id, ':hoy' => $hoy]);
    ok(['registrado' => true]);
}

// ── Router ────────────────────────────────────────────────
$accion = $_GET['accion'] ?? $_POST['accion'] ?? '';
$metodo = $_SERVER['REQUEST_METHOD'];

match (true) {
    $accion === 'obtener'   && $metodo === 'GET'  => ok(obtener_Publicidades($pdo)),
    $accion === 'crear'     && $metodo === 'POST' => crear_Publicidad($pdo),
    $accion === 'actualizar'&& $metodo === 'POST' => actualizar_Publicidad($pdo),
    $accion === 'eliminar'  && $metodo === 'POST' => eliminar_Publicidad($pdo),
    $accion === 'impresion' && $metodo === 'GET'  => registrar_Impresion($pdo),
    default                                       => error_respuesta('Acción no reconocida.', 404),
};