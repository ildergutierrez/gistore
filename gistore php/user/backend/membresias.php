<?php
// ============================================================
//  user/backend/membresias.php
// ============================================================

if (session_status() === PHP_SESSION_NONE)
    session_start();

header('Content-Type: application/json');

// ── Verificar sesión ──────────────────────────────────────
if (empty($_SESSION['usuario_id']) || (int)($_SESSION['rol'] ?? 0) !== 2) {
    http_response_code(401);
    die(json_encode(['ok' => false, 'error' => 'No autenticado.']));
}

// ── Verificar token CSRF ──────────────────────────────────
$token    = $_GET['token'] ?? '';
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

// ── Vendedor en sesión ────────────────────────────────────
$stmt = $pdo->prepare("SELECT id FROM vendedores WHERE usuario_id = ? LIMIT 1");
$stmt->execute([(int)$_SESSION['usuario_id']]);
$vendedor = $stmt->fetch(PDO::FETCH_ASSOC);

if (!$vendedor) {
    http_response_code(404);
    die(json_encode(['ok' => false, 'error' => 'Vendedor no encontrado.']));
}

$vendedor_id = (int)$vendedor['id'];

// ════════════════════════════════════════════════════════════
//  FUNCIÓN: sincronizar productos según estado de membresía
//
//  - Membresía ACTIVA y vigente  → activa todos los productos
//  - Sin membresía o vencida     → desactiva todos los productos
//                                  y marca la membresía como 'vencida'
// ════════════════════════════════════════════════════════════
function sincronizarProductosConMembresia(PDO $pdo, int $vendedor_id): void {
    $stmt = $pdo->prepare("
        SELECT id FROM membresias
        WHERE vendedor_id = ?
          AND estado      = 'activa'
          AND fecha_fin  >= NOW()
        LIMIT 1
    ");
    $stmt->execute([$vendedor_id]);
    $tieneMembresia = $stmt->fetch(PDO::FETCH_ASSOC);

    if ($tieneMembresia) {
        // ── Membresía ACTIVA → activar productos ─────────
        $pdo->prepare("
            UPDATE productos
            SET activo = 1
            WHERE vendedor_id = ?
              AND activo      = 0
        ")->execute([$vendedor_id]);

    } else {
        // ── Sin membresía activa → desactivar productos ──
        $pdo->prepare("
            UPDATE productos
            SET activo = 0
            WHERE vendedor_id = ?
              AND activo      = 1
        ")->execute([$vendedor_id]);

        // Marcar como vencidas las que aún figuren activas
        $pdo->prepare("
            UPDATE membresias
            SET estado = 'vencida'
            WHERE vendedor_id = ?
              AND estado      = 'activa'
              AND fecha_fin   < NOW()
        ")->execute([$vendedor_id]);
    }
}

// ── Ejecutar siempre al cargar ────────────────────────────
sincronizarProductosConMembresia($pdo, $vendedor_id);

// ── Routing por acción ────────────────────────────────────
$accion = $_GET['accion'] ?? 'estado';

// ══════════════════════════════════
//  ACCION: planes
// ══════════════════════════════════
if ($accion === 'planes') {
    $stmt = $pdo->prepare("
        SELECT id, nombre, descripcion, precio, duracion_dias, activo
        FROM planes_membresia
        WHERE activo = 1
        ORDER BY precio ASC
    ");
    $stmt->execute();
    $planes = $stmt->fetchAll(PDO::FETCH_ASSOC);
    __Desconectar($pdo);
    echo json_encode(['ok' => true, 'datos' => $planes], JSON_UNESCAPED_UNICODE);
    exit;
}

// ══════════════════════════════════
//  ACCION: historial
// ══════════════════════════════════
if ($accion === 'historial') {
    $stmt = $pdo->prepare("
        SELECT m.id, m.fecha_inicio, m.fecha_fin, m.estado,
               p.nombre AS plan_nombre, p.precio AS monto
        FROM membresias m
        LEFT JOIN planes_membresia p ON p.id = m.plan_id
        WHERE m.vendedor_id = :vendedor_id
        ORDER BY m.fecha_fin DESC
    ");
    $stmt->execute([':vendedor_id' => $vendedor_id]);
    $pagos = $stmt->fetchAll(PDO::FETCH_ASSOC);
    __Desconectar($pdo);
    echo json_encode(['ok' => true, 'datos' => $pagos], JSON_UNESCAPED_UNICODE);
    exit;
}

// ══════════════════════════════════
//  ACCION: estado (default)
// ══════════════════════════════════

// ── Membresía más reciente ────────────────────────────────
$stmt = $pdo->prepare("
    SELECT m.id, m.fecha_inicio, m.fecha_fin, m.estado,
           m.plan_id,
           p.nombre AS plan_nombre
    FROM membresias m
    LEFT JOIN planes_membresia p ON p.id = m.plan_id
    WHERE m.vendedor_id = :vendedor_id
    ORDER BY m.fecha_fin DESC
    LIMIT 1
");
$stmt->execute([':vendedor_id' => $vendedor_id]);
$membresia = $stmt->fetch(PDO::FETCH_ASSOC) ?: null;

// ── ¿Es fundador? ─────────────────────────────────────────
$stmt = $pdo->prepare("
    SELECT id, fecha_registro
    FROM fundadores
    WHERE vendedor_id = :vendedor_id
    LIMIT 1
");
$stmt->execute([':vendedor_id' => $vendedor_id]);
$fundador = $stmt->fetch(PDO::FETCH_ASSOC);

__Desconectar($pdo);

// ── Respuesta ─────────────────────────────────────────────
echo json_encode([
    'ok'    => true,
    'datos' => [
        'membresia' => $membresia,
        'fundador'  => [
            'esFundador'    => (bool)$fundador,
            'fechaRegistro' => $fundador['fecha_registro'] ?? null,
        ],
    ],
], JSON_UNESCAPED_UNICODE);