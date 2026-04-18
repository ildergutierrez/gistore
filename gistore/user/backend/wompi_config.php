<?php
// ============================================================
//  user/backend/wompi_config.php
//  Sirve las claves de Wompi desde la tabla `wpis`
//  y genera la firma de integridad — todo por GET.
//
//  Tabla: wpis
//    public      → llave pública
//    privada     → llave privada  (nunca sale al frontend)
//    eventos     → evento_id
//    integridad  → llave de integridad
// ============================================================

if (session_status() === PHP_SESSION_NONE)
    session_start();

header('Content-Type: application/json');

// ── Autenticación: solo vendedores (rol 2) ────────────────
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

// ── Helpers ───────────────────────────────────────────────
function ok(mixed $datos = null): never
{
    echo json_encode(['ok' => true, 'datos' => $datos], JSON_UNESCAPED_UNICODE);
    exit;
}
function error_resp(string $msg, int $cod = 400): never
{
    http_response_code($cod);
    echo json_encode(['ok' => false, 'error' => $msg], JSON_UNESCAPED_UNICODE);
    exit;
}

// ── Leer claves desde tabla wpis ──────────────────────────
$stmt = $pdo->query("SELECT `public`, `eventos`, `integridad` FROM wpis LIMIT 1");
$row  = $stmt->fetch(PDO::FETCH_ASSOC);

if (!$row) {
    error_resp('Configuración de Wompi no encontrada.', 404);
}

$llave_publica    = $row['public']     ?? '';
$llave_integridad = $row['integridad'] ?? '';
$evento_id        = $row['eventos']    ?? '';

// ── Router GET ────────────────────────────────────────────
$accion = $_GET['accion'] ?? 'claves';

// ── GET ?accion=claves — claves públicas ──────────────────
if ($accion === 'claves') {
    ok([
        'llave_publica' => $llave_publica,
        'evento_id'     => $evento_id,
    ]);
}

// ── GET ?accion=firma&referencia=...&monto_centavos=... ───
if ($accion === 'firma') {
    $referencia     = trim($_GET['referencia']      ?? '');
    $monto_centavos = intval($_GET['monto_centavos'] ?? 0);

    if (!$referencia)         error_resp('referencia requerida');
    if ($monto_centavos <= 0) error_resp('monto_centavos inválido');
    if (!$llave_integridad)   error_resp('Llave de integridad no configurada', 500);

    // SHA256( referencia + monto_centavos + "COP" + llave_integridad )
    $cadena = $referencia . $monto_centavos . 'COP' . $llave_integridad;
    $firma  = hash('sha256', $cadena);

    ok(['firma' => $firma]);
}

error_resp('Acción no válida');