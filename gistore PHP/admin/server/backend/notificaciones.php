<?php
// ============================================================
//  gistore/admin/server/backend/notificaciones.php
//  Devuelve el conteo REAL de correos sin leer directamente
//  desde el servidor IMAP — sin tocar la BBDD.
//  Se llama desde TODOS los HTML del módulo para el badge.
//
//  GET  accion=sin_leer
//       &cuenta_id=N     ← si se omite usa la cuenta principal
//
//  Respuesta: { ok: true, datos: { sin_leer: N, cuenta_email: "..." } }
// ============================================================

require_once __DIR__ . '/_helpers.php';
validar_token();
validar_sesion_admin();

if (!function_exists('imap_open')) {
    // No dar error, solo devolver 0 para no romper otros HTML
    ok(['sin_leer' => 0, 'cuenta_email' => '', 'imap_disponible' => false]);
}

$pdo    = conectar();
$accion = accion();

if ($accion === 'sin_leer') {
    $cuenta_id = (int)($_GET['cuenta_id'] ?? 0);

    // Obtener cuenta (principal si no se especifica)
    if ($cuenta_id) {
        $st = $pdo->prepare("SELECT * FROM com_smtp_cuentas WHERE id = :id LIMIT 1");
        $st->execute([':id' => $cuenta_id]);
        $c = $st->fetch(PDO::FETCH_ASSOC);
    } else {
        $c = $pdo->query("SELECT * FROM com_smtp_cuentas WHERE principal = 1 LIMIT 1")
                 ->fetch(PDO::FETCH_ASSOC);
    }

    if (!$c || !$c['imap_host']) {
        ok(['sin_leer' => 0, 'cuenta_email' => $c['email'] ?? '', 'imap_disponible' => false]);
    }

    $flags   = $c['imap_ssl'] ? '/ssl/novalidate-cert' : '/notls/novalidate-cert';
    $mailbox = "{{$c['imap_host']}:{$c['imap_puerto']}/imap{$flags}}INBOX";
    $usuario = $c['imap_usuario'] ?: $c['email'];
    $pass    = descifrar($c['password']);

    imap_timeout(IMAP_OPENTIMEOUT, 8);
    imap_timeout(IMAP_READTIMEOUT, 8);

    $imap = @imap_open($mailbox, $usuario, $pass, 0, 1);
    if (!$imap) {
        ok(['sin_leer' => 0, 'cuenta_email' => $c['email'], 'imap_disponible' => false,
            'error' => imap_last_error() ?: 'No se pudo conectar']);
    }

    $info     = @imap_status($imap, $mailbox, SA_UNSEEN);
    $sin_leer = $info ? (int)$info->unseen : 0;
    imap_close($imap);

    ok(['sin_leer' => $sin_leer, 'cuenta_email' => $c['email'], 'imap_disponible' => true]);
}

ok(['sin_leer' => 0]);

function descifrar(string $cifrado): string
{
    if (!$cifrado) return '';
    $key  = hash('sha256', $_SERVER['SERVER_NAME'] . 'gi_smtp_secret', true);
    $blob = base64_decode($cifrado);
    if (strlen($blob) < 17) return '';
    return (string)@openssl_decrypt(substr($blob, 16), 'AES-256-CBC', $key, 0, substr($blob, 0, 16));
}