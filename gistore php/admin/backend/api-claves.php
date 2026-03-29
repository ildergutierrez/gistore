<?php
//================================================
// admin/backend/api-claves.php
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

// ── Funciones CRUD ────────────────────────────────────────

function obtener_Claves($conn): array
{
    $stmt = $conn->prepare("
        SELECT id, servicio, nombre, origen_url, clave, modelos, activo, nota, creado_en, actualizado_en
        FROM api_claves
        ORDER BY servicio ASC
    ");
    $stmt->execute();
    return $stmt->fetchAll(PDO::FETCH_ASSOC);
}

function crear_Clave($conn): void
{
    $servicio  = trim($_POST['servicio']   ?? '');
    $nombre    = trim($_POST['nombre']     ?? '');
    $origenUrl = trim($_POST['origen_url'] ?? '');
    $clave     = trim($_POST['clave']      ?? '');
    $modelos   = trim($_POST['modelos']    ?? '[]');
    $nota      = trim($_POST['nota']       ?? '');
    $activo    = isset($_POST['activo']) ? (int)(bool)$_POST['activo'] : 1;

    if (!$servicio)  error_respuesta('El identificador del servicio es obligatorio.');
    if (!$nombre)    error_respuesta('El nombre es obligatorio.');
    if (!$origenUrl) error_respuesta('La URL de origen es obligatoria.');
    if (!$clave)     error_respuesta('La clave API es obligatoria.');

    // Validar que modelos sea JSON válido
    if ($modelos && json_decode($modelos) === null)
        error_respuesta('El campo modelos tiene formato inválido.');

    // Verificar que el servicio no exista ya (campo UNIQUE)
    $check = $conn->prepare("SELECT id FROM api_claves WHERE servicio = ?");
    $check->execute([$servicio]);
    if ($check->fetch()) error_respuesta('Ya existe una clave con ese identificador de servicio.');

    $stmt = $conn->prepare("
        INSERT INTO api_claves (servicio, nombre, origen_url, clave, modelos, activo, nota, creado_en, actualizado_en)
        VALUES (:servicio, :nombre, :origen_url, :clave, :modelos, :activo, :nota, NOW(), NOW())
    ");
    $stmt->execute([
        ':servicio'   => $servicio,
        ':nombre'     => $nombre,
        ':origen_url' => $origenUrl,
        ':clave'      => $clave,
        ':modelos'    => $modelos ?: '[]',
        ':activo'     => $activo,
        ':nota'       => $nota ?: null,
    ]);

    ok(['id' => $conn->lastInsertId()]);
}

function actualizar_Clave($conn): void
{
    $id        = intval($_POST['id']         ?? 0);
    $nombre    = trim($_POST['nombre']       ?? '');
    $origenUrl = trim($_POST['origen_url']   ?? '');
    $nuevaClave= trim($_POST['clave']        ?? '');
    $modelos   = trim($_POST['modelos']      ?? '[]');
    $nota      = trim($_POST['nota']         ?? '');
    $activo    = isset($_POST['activo']) ? (int)(bool)$_POST['activo'] : 1;

    if (!$id)        error_respuesta('ID inválido.');
    if (!$nombre)    error_respuesta('El nombre es obligatorio.');
    if (!$origenUrl) error_respuesta('La URL de origen es obligatoria.');

    if ($modelos && json_decode($modelos) === null)
        error_respuesta('El campo modelos tiene formato inválido.');

    // Si viene nueva clave, actualizarla; si no, mantener la existente
    if ($nuevaClave) {
        $stmt = $conn->prepare("
            UPDATE api_claves
            SET nombre = :nombre, origen_url = :origen_url, clave = :clave,
                modelos = :modelos, activo = :activo, nota = :nota,
                actualizado_en = NOW()
            WHERE id = :id
        ");
        $stmt->execute([
            ':nombre'     => $nombre,
            ':origen_url' => $origenUrl,
            ':clave'      => $nuevaClave,
            ':modelos'    => $modelos ?: '[]',
            ':activo'     => $activo,
            ':nota'       => $nota ?: null,
            ':id'         => $id,
        ]);
    } else {
        $stmt = $conn->prepare("
            UPDATE api_claves
            SET nombre = :nombre, origen_url = :origen_url,
                modelos = :modelos, activo = :activo, nota = :nota,
                actualizado_en = NOW()
            WHERE id = :id
        ");
        $stmt->execute([
            ':nombre'     => $nombre,
            ':origen_url' => $origenUrl,
            ':modelos'    => $modelos ?: '[]',
            ':activo'     => $activo,
            ':nota'       => $nota ?: null,
            ':id'         => $id,
        ]);
    }

    ok(['id' => $id]);
}

function eliminar_Clave($conn): void
{
    $id = intval($_POST['id'] ?? 0);
    if (!$id) error_respuesta('ID inválido.');

    $conn->prepare("DELETE FROM api_claves WHERE id = ?")->execute([$id]);
    ok(['id' => $id]);
}

// ── Router ────────────────────────────────────────────────
$accion = $_GET['accion'] ?? $_POST['accion'] ?? '';

match ($accion) {
    'obtener'    => ok(obtener_Claves($pdo)),
    'crear'      => crear_Clave($pdo),
    'actualizar' => actualizar_Clave($pdo),
    'eliminar'   => eliminar_Clave($pdo),
    default      => error_respuesta('Acción no reconocida.', 404),
};