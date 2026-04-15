<?php
//======================================
//gsitore/backend/tokens.php
//=====================================

if (session_status() === PHP_SESSION_NONE) session_start();
header('Content-Type: application/json');

$tiempo   = $_SESSION['csrf_token_time'] ?? 0;
$token    = $_SESSION['csrf_token']      ?? '';

// Solo genera uno nuevo si no existe o expiró, se genera cada 3 minutos para mayor seguridad
if (!$token || (time() - $tiempo) > 180) {
    $token = bin2hex(random_bytes(32));
    $_SESSION['csrf_token']      = $token;
    $_SESSION['csrf_token_time'] = time();
}

echo json_encode(['ok' => true, 'token' => $token]);