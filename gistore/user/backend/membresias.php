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
//  POST: activar membresía tras pago aprobado en Wompi
//  Body JSON: { wompi_tx_id, plan_id, monto }
// ══════════════════════════════════
if ($_SERVER['REQUEST_METHOD'] === 'POST' && $accion === 'activar') {
    $body    = json_decode(file_get_contents('php://input'), true) ?? [];
    $tx_id   = trim($body['wompi_tx_id'] ?? '');
    $plan_id = (int)($body['plan_id']    ?? 0);
    $monto   = (int)($body['monto']      ?? 0);

    if (!$tx_id || !$plan_id || $monto <= 0) {
        http_response_code(400);
        die(json_encode(['ok' => false, 'error' => 'Datos incompletos.']));
    }

    // ── Evitar duplicados: mismo wompi_tx_id ya registrado ──
    $chk = $pdo->prepare("SELECT id FROM membresias WHERE wompi_tx_id = ? LIMIT 1");
    $chk->execute([$tx_id]);
    if ($chk->fetch()) {
        __Desconectar($pdo);
        die(json_encode(['ok' => true, 'aviso' => 'Transacción ya registrada.']));
    }

    // ── Verificar transacción directamente con Wompi ─────────
    // Leer llave pública desde wpis para armar la URL
    $wpis = $pdo->query("SELECT `public` FROM wpis LIMIT 1")->fetch(PDO::FETCH_ASSOC);
    $pub  = $wpis['public'] ?? '';
    $wompi_base = str_starts_with($pub, 'pub_test_')
        ? 'https://sandbox.wompi.co/v1'
        : 'https://production.wompi.co/v1';

    $ctx = stream_context_create(['http' => [
        'method'  => 'GET',
        'header'  => "Authorization: Bearer {$pub}
",
        'timeout' => 10,
    ]]);
    $raw = @file_get_contents("{$wompi_base}/transactions/{$tx_id}", false, $ctx);
    if (!$raw) {
        http_response_code(502);
        die(json_encode(['ok' => false, 'error' => 'No se pudo verificar la transacción con Wompi.']));
    }
    $wompi = json_decode($raw, true);
    $status = $wompi['data']['status'] ?? '';

    if ($status !== 'APPROVED') {
        http_response_code(402);
        die(json_encode(['ok' => false, 'error' => "Transacción no aprobada (estado: {$status})."]));
    }

    // ── Obtener duración del plan ─────────────────────────────
    $plan = $pdo->prepare("SELECT duracion_dias FROM planes_membresia WHERE id = ? AND activo = 1 LIMIT 1");
    $plan->execute([$plan_id]);
    $planRow = $plan->fetch(PDO::FETCH_ASSOC);
    if (!$planRow) {
        http_response_code(404);
        die(json_encode(['ok' => false, 'error' => 'Plan no encontrado.']));
    }
    $duracion = (int)$planRow['duracion_dias'];

    // ── Calcular fecha_inicio y fecha_fin ─────────────────────
    // Si tiene membresía activa y vigente → sumar días al vencimiento actual
    // Si no → iniciar desde hoy
    $activa = $pdo->prepare("
        SELECT fecha_fin FROM membresias
        WHERE vendedor_id = ?
          AND estado      = 'activa'
          AND fecha_fin  >= CURDATE()
        ORDER BY fecha_fin DESC
        LIMIT 1
    ");
    $activa->execute([$vendedor_id]);
    $vigente = $activa->fetch(PDO::FETCH_ASSOC);

    if ($vigente) {
        // Sumar los nuevos días a la fecha de vencimiento actual
        $fecha_inicio = date('Y-m-d');
        $fecha_fin    = date('Y-m-d', strtotime($vigente['fecha_fin'] . " +{$duracion} days"));
    } else {
        // Membresía vencida o inexistente → empieza hoy
        $fecha_inicio = date('Y-m-d');
        $fecha_fin    = date('Y-m-d', strtotime("+{$duracion} days"));
    }

    // ── Insertar nueva membresía ──────────────────────────────
    $ins = $pdo->prepare("
        INSERT INTO membresias
            (vendedor_id, plan_id, fecha_inicio, fecha_fin, estado, notas, wompi_tx_id)
        VALUES
            (:vendedor_id, :plan_id, :fecha_inicio, :fecha_fin, 'activa', :notas, :wompi_tx_id)
    ");
    $ins->execute([
        ':vendedor_id'  => $vendedor_id,
        ':plan_id'      => $plan_id,
        ':fecha_inicio' => $fecha_inicio,
        ':fecha_fin'    => $fecha_fin,
        ':notas'        => "Pago Wompi {$tx_id} — \${$monto} COP",
        ':wompi_tx_id'  => $tx_id,
    ]);

    // ── Activar productos del vendedor ────────────────────────
    sincronizarProductosConMembresia($pdo, $vendedor_id);

    __Desconectar($pdo);
    echo json_encode([
        'ok'    => true,
        'datos' => [
            'fecha_inicio' => $fecha_inicio,
            'fecha_fin'    => $fecha_fin,
            'duracion_dias'=> $duracion,
        ],
    ], JSON_UNESCAPED_UNICODE);
    exit;
}

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