<?php
// ============================================================
//  gistore/admin/server/backend/wconfig.php
//  Configuración de la Meta Cloud API (WhatsApp Business)
//  tabla: com_wa_config  (siempre id = 1)
//
//  GET  accion=obtener
//  POST accion=guardar
//  POST accion=probar         ← llama a la Graph API real
//  POST accion=prueba_mensaje  phone=+57... mensaje=texto
// ============================================================

require_once __DIR__ . '/_helpers.php';
validar_token();
validar_sesion_admin();

$pdo    = conectar();
$accion = accion();

// ── OBTENER ───────────────────────────────────────────────
if ($accion === 'obtener') {
    $fila = $pdo->query("SELECT * FROM com_wa_config WHERE id = 1")->fetch(PDO::FETCH_ASSOC);
    if ($fila) {
        // Nunca devolver el token completo al frontend, solo confirmar que existe
        $fila['token_configurado'] = !empty($fila['token']);
        $fila['token'] = $fila['token'] ? '••••••••' . substr($fila['token'], -6) : '';
    }
    ok($fila ?: []);
}

// ── GUARDAR ───────────────────────────────────────────────
if ($accion === 'guardar') {
    $token       = str_in('token');
    $phone_id    = str_in('phone_id');
    $waba_id     = str_in('waba_id');
    $telefono    = str_in('telefono');
    $api_version = str_in('api_version') ?: 'v19.0';

    if (!$phone_id || !$waba_id)
        error_respuesta('Phone ID y WABA ID son obligatorios');

    // Si el token viene enmascarado (••••) no lo sobreescribimos
    $cambiar_token = $token && !str_contains($token, '••');

    if ($cambiar_token) {
        $pdo->prepare(
            "INSERT INTO com_wa_config (id, token, phone_id, waba_id, telefono, api_version)
             VALUES (1, :tok, :pid, :wid, :tel, :ver)
             ON DUPLICATE KEY UPDATE
               token       = VALUES(token),
               phone_id    = VALUES(phone_id),
               waba_id     = VALUES(waba_id),
               telefono    = VALUES(telefono),
               api_version = VALUES(api_version)"
        )->execute([
            ':tok' => $token,
            ':pid' => $phone_id,
            ':wid' => $waba_id,
            ':tel' => $telefono,
            ':ver' => $api_version,
        ]);
    } else {
        // Solo actualizar los campos no sensibles
        $pdo->prepare(
            "UPDATE com_wa_config
                SET phone_id = :pid, waba_id = :wid, telefono = :tel, api_version = :ver
              WHERE id = 1"
        )->execute([
            ':pid' => $phone_id,
            ':wid' => $waba_id,
            ':tel' => $telefono,
            ':ver' => $api_version,
        ]);
    }
    ok(['guardado' => true]);
}

// ── PROBAR (verificar token contra Graph API) ─────────────
if ($accion === 'probar') {
    $cfg = wa_config($pdo);
    if (!$cfg || !$cfg['token'])
        error_respuesta('No hay configuración guardada. Guarda primero el token.');

    $url  = "https://graph.facebook.com/{$cfg['api_version']}/{$cfg['phone_id']}";
    $resp = wa_get($url, $cfg['token']);

    if (isset($resp['error'])) {
        error_respuesta('Meta API: ' . ($resp['error']['message'] ?? 'Error desconocido'));
    }
    ok(['estado' => 'ok', 'phone' => $resp['display_phone_number'] ?? '']);
}

// ── PRUEBA DE MENSAJE ─────────────────────────────────────
if ($accion === 'prueba_mensaje') {
    $cfg     = wa_config($pdo);
    if (!$cfg || !$cfg['token'])
        error_respuesta('Configura el token primero');

    $telefono = str_in('phone');
    $mensaje  = str_in('mensaje') ?: 'Hola desde GI Store — prueba de API ✅';
    if (!$telefono) error_respuesta('Número de teléfono requerido');

    $resp = wa_send_text($cfg, $telefono, $mensaje);
    if (isset($resp['error']))
        error_respuesta('Meta API: ' . ($resp['error']['message'] ?? 'Error'));

    ok(['message_id' => $resp['messages'][0]['id'] ?? null]);
}

error_respuesta('Acción no reconocida', 404);

// ── Helpers ───────────────────────────────────────────────
function wa_config(PDO $pdo): array|false
{
    return $pdo->query("SELECT * FROM com_wa_config WHERE id = 1 AND activo = 1")
               ->fetch(PDO::FETCH_ASSOC);
}

function wa_get(string $url, string $token): array
{
    $ctx = stream_context_create(['http' => [
        'method'  => 'GET',
        'header'  => "Authorization: Bearer $token\r\nContent-Type: application/json\r\n",
        'timeout' => 10,
        'ignore_errors' => true,
    ]]);
    $body = file_get_contents($url, false, $ctx);
    return json_decode($body ?: '{}', true) ?? [];
}

function wa_send_text(array $cfg, string $telefono, string $mensaje): array
{
    $url     = "https://graph.facebook.com/{$cfg['api_version']}/{$cfg['phone_id']}/messages";
    $payload = json_encode([
        'messaging_product' => 'whatsapp',
        'to'                => $telefono,
        'type'              => 'text',
        'text'              => ['body' => $mensaje],
    ]);
    $ctx = stream_context_create(['http' => [
        'method'        => 'POST',
        'header'        => "Authorization: Bearer {$cfg['token']}\r\nContent-Type: application/json\r\n",
        'content'       => $payload,
        'timeout'       => 15,
        'ignore_errors' => true,
    ]]);
    $body = file_get_contents($url, false, $ctx);
    return json_decode($body ?: '{}', true) ?? [];
}