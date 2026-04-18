<?php
// ============================================================
//  user/backend/wompi_config.php
//  Sirve las claves de Wompi desde la tabla `wpis`
//  y genera la firma de integridad para transacciones.
//
//  Tabla: wpis
//    id          int  PRI auto_increment
//    public      text → llave pública  (pub_...)
//    privada     text → llave privada  (prv_...)  — nunca se expone al JS
//    eventos     text → evento_id de Wompi
//    integridad  text → llave de integridad
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
function error_resp(string $msg, int $cod = 400): never
{
    http_response_code($cod);
    echo json_encode(['ok' => false, 'error' => $msg], JSON_UNESCAPED_UNICODE);
    exit;
}

// ── Leer claves desde tabla wpis ─────────────────────────
$stmt = $pdo->query("SELECT `public`, `privada`, `eventos`, `integridad` FROM wpis LIMIT 1");
$row  = $stmt->fetch(PDO::FETCH_ASSOC);

if (!$row) {
    error_resp('Configuración de Wompi no encontrada en la base de datos.', 404);
}

$llave_publica    = $row['public']     ?? '';
// $llave_privada = $row['privada']    // nunca sale al frontend
$llave_integridad = $row['integridad'] ?? '';
$evento_id        = $row['eventos']    ?? '';

// ── Router ────────────────────────────────────────────────
$accion = $_GET['accion'] ?? $_POST['accion'] ?? 'claves';
$metodo = $_SERVER['REQUEST_METHOD'];

// ── GET ?accion=claves — devuelve claves públicas al JS ───
if ($accion === 'claves' && $metodo === 'GET') {
    ok([
        'llave_publica'    => $llave_publica,
        'llave_integridad' => $llave_integridad,
        'evento_id'        => $evento_id,
    ]);
}

// ── POST ?accion=firma — genera firma SHA-256 ─────────────
if ($accion === 'firma' && $metodo === 'POST') {
    $referencia     = trim($_POST['referencia']      ?? '');
    $monto_centavos = intval($_POST['monto_centavos'] ?? 0);

    if (!$referencia)         error_resp('referencia requerida');
    if ($monto_centavos <= 0) error_resp('monto_centavos inválido');
    if (!$llave_integridad)   error_resp('Llave de integridad no configurada', 500);

    // Documentación oficial Wompi:
    // SHA256( referencia + monto_centavos + "COP" + llave_integridad )
    $cadena = $referencia . $monto_centavos . 'COP' . $llave_integridad;
    $firma  = hash('sha256', $cadena);

    ok(['firma' => $firma]);
}

error_resp('Acción no válida');