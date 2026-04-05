<?php
// Archivo temporal de diagnóstico — eliminar después de usar
if (session_status() === PHP_SESSION_NONE) session_start();
header('Content-Type: application/json');

$info = [
    'php_version'      => PHP_VERSION,
    'disable_functions' => ini_get('disable_functions'),
    'upload_max_filesize' => ini_get('upload_max_filesize'),
    'post_max_size'    => ini_get('post_max_size'),
    'max_execution_time' => ini_get('max_execution_time'),
    'ffmpeg_paths'     => [],
    'proc_open'        => function_exists('proc_open'),
    'shell_exec'       => function_exists('shell_exec'),
    'exec'             => function_exists('exec'),
    'system'           => function_exists('system'),
    'session_usuario'  => !empty($_SESSION['usuario_id']),
    'session_rol'      => $_SESSION['rol'] ?? 'no definido',
    'session_csrf'     => !empty($_SESSION['csrf_token']),
];

// Buscar ffmpeg
foreach (['/usr/bin/ffmpeg','/usr/local/bin/ffmpeg','/bin/ffmpeg'] as $p) {
    $info['ffmpeg_paths'][$p] = is_executable($p);
}

// Intentar which ffmpeg con proc_open
if (function_exists('proc_open')) {
    $proc = @proc_open('which ffmpeg', [1=>['pipe','w'],2=>['pipe','w']], $pipes);
    if (is_resource($proc)) {
        $info['which_ffmpeg'] = trim(stream_get_contents($pipes[1]));
        fclose($pipes[1]); fclose($pipes[2]);
        proc_close($proc);
    }
}

echo json_encode($info, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);