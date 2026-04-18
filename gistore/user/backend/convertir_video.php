<?php
// ============================================================
//  user/backend/convertir_video.php  v4
//  Convierte video a avc1 + faststart (WhatsApp + Facebook)
//
//  REQUISITOS EN EL SERVIDOR:
//    sudo apt install ffmpeg -y
//    En php.ini (apache2): upload_max_filesize = 200M
//                          post_max_size       = 200M
//                          max_execution_time  = 120
// ============================================================

if (session_status() === PHP_SESSION_NONE) session_start();
header('Content-Type: application/json');   // default; se cambia al servir video

// ── Autenticación ─────────────────────────────────────────
if (empty($_SESSION['usuario_id']) || (int)($_SESSION['rol'] ?? 0) !== 2) {
    http_response_code(401);
    die(json_encode(['ok'=>false,'error'=>'No autenticado.']));
}

// ── CSRF ──────────────────────────────────────────────────
$token    = $_POST['token']              ?? '';
$guardado = $_SESSION['csrf_token']      ?? '';
$tiempo   = $_SESSION['csrf_token_time'] ?? 0;
if (!$token || !$guardado || !hash_equals($guardado, $token)) {
    http_response_code(403);
    die(json_encode(['ok'=>false,'error'=>'Token inválido.']));
}
if ((time() - $tiempo) > 7200) {
    http_response_code(403);
    die(json_encode(['ok'=>false,'error'=>'Token expirado.']));
}

// ── Buscar ffmpeg (rutas comunes en Debian/Kali/Ubuntu) ───
function hallarFfmpeg(): string {
    $rutas = [
        '/usr/bin/ffmpeg',
        '/usr/local/bin/ffmpeg',
        '/bin/ffmpeg',
        '/snap/bin/ffmpeg',
        '/opt/ffmpeg/bin/ffmpeg',
    ];
    foreach ($rutas as $r) {
        if (@is_executable($r)) return $r;
    }
    // Intentar con proc_open (más permisivo que shell_exec)
    if (function_exists('proc_open')) {
        foreach (['which ffmpeg', 'whereis ffmpeg'] as $wcmd) {
            $p = @proc_open($wcmd, [1=>['pipe','w'],2=>['pipe','w']], $pp);
            if (is_resource($p)) {
                $out = trim(stream_get_contents($pp[1]));
                fclose($pp[1]); fclose($pp[2]); proc_close($p);
                // whereis devuelve "ffmpeg: /usr/bin/ffmpeg", extraer ruta
                if (str_contains($out, ':')) $out = trim(explode(':', $out, 2)[1]);
                $out = explode(' ', $out)[0]; // primera ruta si hay varias
                if ($out && @is_executable($out)) return $out;
            }
        }
    }
    return '';
}

$ffmpeg = hallarFfmpeg();
if (!$ffmpeg) {
    http_response_code(500);
    die(json_encode([
        'ok'    => false,
        'error' => 'ffmpeg_no_encontrado',
        'ayuda' => 'Ejecuta en Kali: sudo apt install ffmpeg -y',
    ]));
}

// ── Verificar upload ──────────────────────────────────────
// PHP puede rechazar el archivo silenciosamente si supera
// upload_max_filesize antes de ejecutar el script.
// El error UPLOAD_ERR_INI_SIZE (1) lo indica.
if (empty($_FILES['video'])) {
    http_response_code(400);
    die(json_encode([
        'ok'    => false,
        'error' => 'upload_vacio',
        'ayuda' => 'El video supera upload_max_filesize en php.ini. '.
                   'Aumenta a 200M en /etc/php/8.4/apache2/php.ini',
    ]));
}
if ($_FILES['video']['error'] === UPLOAD_ERR_INI_SIZE ||
    $_FILES['video']['error'] === UPLOAD_ERR_FORM_SIZE) {
    http_response_code(413);
    die(json_encode([
        'ok'    => false,
        'error' => 'archivo_muy_grande',
        'ayuda' => 'Aumenta upload_max_filesize y post_max_size a 200M en php.ini y reinicia Apache.',
    ]));
}
if ($_FILES['video']['error'] !== UPLOAD_ERR_OK) {
    http_response_code(400);
    die(json_encode(['ok'=>false,'error'=>'Error de upload: código '.$_FILES['video']['error']]));
}

// ── Archivos temporales ───────────────────────────────────
$tmp = sys_get_temp_dir();
$uid = bin2hex(random_bytes(8));
$in  = "$tmp/gi_in_{$uid}.mp4";
$out = "$tmp/gi_out_{$uid}.mp4";
move_uploaded_file($_FILES['video']['tmp_name'], $in);

// ── Ejecutar FFmpeg ───────────────────────────────────────
// Flags:
//   libx264 baseline 3.1 → avc1, máxima compatibilidad (WhatsApp, FB, iOS, Android)
//   yuv420p              → espacio de color universal
//   r 30                 → 30fps constante
//   scale=720:1280       → dimensiones exactas (Facebook exige alto ≥ 120px)
//   faststart            → moov al inicio (streaming y WhatsApp)
//   aac stereo 128k      → audio compatible; -an si no hay pista de audio
$cmd = escapeshellarg($ffmpeg)
     . ' -y'
     . ' -i '    . escapeshellarg($in)
     . ' -c:v libx264 -profile:v baseline -level 3.1'
     . ' -pix_fmt yuv420p -r 30'
     . ' -vf "scale=720:1280:flags=lanczos"'
     . ' -movflags +faststart'
     . ' -c:a aac -b:a 128k -ac 2'
     . ' '       . escapeshellarg($out)
     . ' 2>&1';

$log = '';
if (function_exists('proc_open')) {
    $p = @proc_open($cmd, [0=>['pipe','r'],1=>['pipe','w'],2=>['pipe','w']], $pp);
    if (is_resource($p)) {
        fclose($pp[0]);
        $log = stream_get_contents($pp[1]) . stream_get_contents($pp[2]);
        fclose($pp[1]); fclose($pp[2]);
        proc_close($p);
    }
} else {
    $log = (string)(shell_exec($cmd) ?? '');
}

@unlink($in);

// ── Verificar resultado ───────────────────────────────────
if (!file_exists($out) || filesize($out) < 1000) {
    http_response_code(500);
    die(json_encode([
        'ok'    => false,
        'error' => 'ffmpeg_conversion_fallo',
        'debug' => substr($log, -1000),
    ]));
}

// ── Servir el video convertido ────────────────────────────
$size = filesize($out);
header('Content-Type: video/mp4');
header('Content-Disposition: attachment; filename="GIStore-video-wa.mp4"');
header('Content-Length: ' . $size);
header('Cache-Control: no-store');
header('Access-Control-Allow-Origin: *');
readfile($out);
@unlink($out);
exit;