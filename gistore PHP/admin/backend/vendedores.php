<?php
//================================================
// admin/backend/vendedores.php
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

// ── Obtener vendedores ────────────────────────────────────
function obtener_VendedoresActivos($conn)
{
    $stmt = $conn->prepare("
        SELECT `id`, `usuario_id`, `nombre`, `ciudad`, `correo`, `whatsapp`,
               `descripcion`, `perfil`, `color`, `url_web`, `redes`, `estado`,
               `creado_en`, `actualizado_en`
        FROM vendedores
    ");
    $stmt->execute();
    return $stmt->fetchAll(PDO::FETCH_ASSOC);
}

// ── Crear vendedor ────────────────────────────────────────
function crear_Vendedor($conn)
{
    $nombre   = trim($_POST['nombre']   ?? '');
    $ciudad   = trim($_POST['ciudad']   ?? '');
    $correo   = trim($_POST['correo']   ?? '');
    $password = trim($_POST['password'] ?? '');
    $whatsapp = trim($_POST['whatsapp'] ?? '');
    $color    = trim($_POST['color']    ?? '#1a6b3c');
    $estado   = trim($_POST['estado']   ?? 'activo');

    if (!$nombre)              error_respuesta('El nombre es obligatorio.');
    if (!$correo)              error_respuesta('El correo es obligatorio.');
    if (!filter_var($correo, FILTER_VALIDATE_EMAIL))
                               error_respuesta('El correo no es válido.');
    if (!$password)            error_respuesta('La contraseña es obligatoria.');
    if (strlen($password) < 6) error_respuesta('La contraseña debe tener al menos 6 caracteres.');

    // Verificar correo duplicado en usuarios
    $check = $conn->prepare("SELECT id FROM usuarios WHERE correo = ?");
    $check->execute([$correo]);
    if ($check->fetch()) error_respuesta('Ya existe un usuario con ese correo.');

    $hash = password_hash($password, PASSWORD_DEFAULT);

    try {
        $conn->beginTransaction();

        // 1️⃣ Insertar en usuarios
        $stmt = $conn->prepare("
            INSERT INTO usuarios (correo, password_hash, rol, activo, creado_en, actualizado_en)
            VALUES (:correo, :password_hash, 2, 1, NOW(), NOW())
        ");
        $stmt->execute([
            ':correo'        => $correo,
            ':password_hash' => $hash,
        ]);
        $usuario_id = $conn->lastInsertId();

        // 2️⃣ Insertar en vendedores
        $stmt = $conn->prepare("
            INSERT INTO vendedores
                (usuario_id, nombre, ciudad, correo, whatsapp, color, estado, creado_en, actualizado_en)
            VALUES
                (:usuario_id, :nombre, :ciudad, :correo, :whatsapp, :color, :estado, NOW(), NOW())
        ");
        $stmt->execute([
            ':usuario_id' => $usuario_id,
            ':nombre'     => $nombre,
            ':ciudad'     => $ciudad,
            ':correo'     => $correo,
            ':whatsapp'   => $whatsapp,
            ':color'      => $color,
            ':estado'     => $estado,
        ]);
        $vendedor_id = $conn->lastInsertId();

        $conn->commit();
        ok(['id' => $vendedor_id, 'usuario_id' => $usuario_id]);

    } catch (\Throwable $e) {
        $conn->rollBack();
        error_respuesta('Error al crear el vendedor: ' . $e->getMessage());
    }
}

// ── Actualizar vendedor ───────────────────────────────────
function actualizar_Vendedor($conn)
{
    $id       = intval($_POST['id']     ?? 0);
    $nombre   = trim($_POST['nombre']   ?? '');
    $ciudad   = trim($_POST['ciudad']   ?? '');
    $correo   = trim($_POST['correo']   ?? '');
    $whatsapp = trim($_POST['whatsapp'] ?? '');
    $color    = trim($_POST['color']    ?? '#1a6b3c');
    $estado   = trim($_POST['estado']   ?? 'activo');
    $password = trim($_POST['password'] ?? '');

    if (!$id)     error_respuesta('ID de vendedor inválido.');
    if (!$nombre) error_respuesta('El nombre es obligatorio.');
    if (!$correo) error_respuesta('El correo es obligatorio.');
    if (!filter_var($correo, FILTER_VALIDATE_EMAIL))
                  error_respuesta('El correo no es válido.');

    // Obtener el usuario_id vinculado a este vendedor
    $rel = $conn->prepare("SELECT usuario_id FROM vendedores WHERE id = ?");
    $rel->execute([$id]);
    $vendedor = $rel->fetch(PDO::FETCH_ASSOC);
    if (!$vendedor) error_respuesta('Vendedor no encontrado.');
    $usuario_id = $vendedor['usuario_id'];

    // Verificar correo duplicado en otro usuario
    $check = $conn->prepare("SELECT id FROM usuarios WHERE correo = ? AND id != ?");
    $check->execute([$correo, $usuario_id]);
    if ($check->fetch()) error_respuesta('Ese correo ya lo usa otro vendedor.');

    try {
        $conn->beginTransaction();

        // 1️⃣ Actualizar correo (y password si viene) en usuarios
        if ($password) {
            if (strlen($password) < 6) error_respuesta('La contraseña debe tener al menos 6 caracteres.');
            $hash = password_hash($password, PASSWORD_DEFAULT);

            $stmt = $conn->prepare("
                UPDATE usuarios
                SET correo = :correo, password_hash = :password_hash, actualizado_en = NOW()
                WHERE id = :id
            ");
            $stmt->execute([
                ':correo'        => $correo,
                ':password_hash' => $hash,
                ':id'            => $usuario_id,
            ]);
        } else {
            $stmt = $conn->prepare("
                UPDATE usuarios
                SET correo = :correo, actualizado_en = NOW()
                WHERE id = :id
            ");
            $stmt->execute([
                ':correo' => $correo,
                ':id'     => $usuario_id,
            ]);
        }

        // 2️⃣ Actualizar datos en vendedores
        $stmt = $conn->prepare("
            UPDATE vendedores
            SET nombre = :nombre, ciudad = :ciudad, correo = :correo,
                whatsapp = :whatsapp, color = :color,
                estado = :estado, actualizado_en = NOW()
            WHERE id = :id
        ");
        $stmt->execute([
            ':nombre'   => $nombre,
            ':ciudad'   => $ciudad,
            ':correo'   => $correo,
            ':whatsapp' => $whatsapp,
            ':color'    => $color,
            ':estado'   => $estado,
            ':id'       => $id,
        ]);

        $conn->commit();
        ok(['id' => $id]);

    } catch (\Throwable $e) {
        $conn->rollBack();
        error_respuesta('Error al actualizar el vendedor: ' . $e->getMessage());
    }
}

// ── Desactivar vendedor ───────────────────────────────────
function desactivar_Vendedor($conn)
{
    $id = intval($_POST['id'] ?? 0);
    if (!$id) error_respuesta('ID de vendedor inválido.');

    try {
        $conn->beginTransaction();

        // Obtener usuario_id vinculado
        $rel = $conn->prepare("SELECT usuario_id FROM vendedores WHERE id = ?");
        $rel->execute([$id]);
        $vendedor = $rel->fetch(PDO::FETCH_ASSOC);
        if (!$vendedor) error_respuesta('Vendedor no encontrado.');

        // Desactivar en ambas tablas
        $conn->prepare("UPDATE vendedores SET estado = 'desactivado', actualizado_en = NOW() WHERE id = ?")
             ->execute([$id]);

        $conn->prepare("UPDATE usuarios SET activo = 0, actualizado_en = NOW() WHERE id = ?")
             ->execute([$vendedor['usuario_id']]);

        $conn->commit();
        ok(['id' => $id]);

    } catch (\Throwable $e) {
        $conn->rollBack();
        error_respuesta('Error al desactivar: ' . $e->getMessage());
    }
}

// ── Obtener desactivados ──────────────────────────────────
function obtener_VendedoresDesactivados($conn)
{
    $stmt = $conn->prepare("
        SELECT id, usuario_id, nombre, ciudad, correo, whatsapp,
               color, estado, creado_en, actualizado_en
        FROM vendedores
        WHERE estado = 'desactivado'
        ORDER BY actualizado_en DESC
    ");
    $stmt->execute();
    return $stmt->fetchAll(PDO::FETCH_ASSOC);
}

// ── Reactivar vendedor ────────────────────────────────────
function reactivar_Vendedor($conn)
{
    $id = intval($_POST['id'] ?? 0);
    if (!$id) error_respuesta('ID de vendedor inválido.');

    try {
        $conn->beginTransaction();

        $rel = $conn->prepare("SELECT usuario_id FROM vendedores WHERE id = ? AND estado = 'desactivado'");
        $rel->execute([$id]);
        $vendedor = $rel->fetch(PDO::FETCH_ASSOC);
        if (!$vendedor) error_respuesta('Vendedor no encontrado o ya está activo.');

        $conn->prepare("UPDATE vendedores SET estado = 'inactivo', actualizado_en = NOW() WHERE id = ?")
             ->execute([$id]);

        $conn->prepare("UPDATE usuarios SET activo = 1, actualizado_en = NOW() WHERE id = ?")
             ->execute([$vendedor['usuario_id']]);

        $conn->commit();
        ok(['id' => $id]);

    } catch (\Throwable $e) {
        $conn->rollBack();
        error_respuesta('Error al reactivar: ' . $e->getMessage());
    }
}

// ── Router ────────────────────────────────────────────────
$accion = $_GET['accion'] ?? $_POST['accion'] ?? '';

match ($accion) {
    'obtener'      => ok(obtener_VendedoresActivos($pdo)),
    'desactivados' => ok(obtener_VendedoresDesactivados($pdo)),
    'crear'        => crear_Vendedor($pdo),
    'actualizar'   => actualizar_Vendedor($pdo),
    'desactivar'   => desactivar_Vendedor($pdo),
    'reactivar'    => reactivar_Vendedor($pdo),
    default        => error_respuesta('Acción no reconocida.', 404),
};