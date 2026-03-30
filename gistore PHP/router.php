<?php
// ============================================================
//  router.php — Router para php -S localhost:8000 router.php
// ============================================================

$uri = urldecode(parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH));

// ── API → api/index.php ───────────────────────────────────
if (str_starts_with($uri, '/api')) {
    // Reescribir REQUEST_URI quitando /api para que el router interno funcione
    $_SERVER['REQUEST_URI'] = $uri;
    chdir(__DIR__);
    require __DIR__ . '/api/index.php';
    return;
}

// ── Archivos estáticos con MIME correcto ──────────────────
$file = __DIR__ . $uri;
if ($uri !== '/' && file_exists($file) && is_file($file)) {
    $mimes = [
        'js'    => 'application/javascript',
        'mjs'   => 'application/javascript',
        'css'   => 'text/css',
        'html'  => 'text/html; charset=utf-8',
        'json'  => 'application/json',
        'png'   => 'image/png',
        'jpg'   => 'image/jpeg',
        'jpeg'  => 'image/jpeg',
        'gif'   => 'image/gif',
        'svg'   => 'image/svg+xml',
        'ico'   => 'image/x-icon',
        'woff'  => 'font/woff',
        'woff2' => 'font/woff2',
        'webp'  => 'image/webp',
        'xml'   => 'application/xml',
        'txt'   => 'text/plain',
    ];
    $ext = strtolower(pathinfo($file, PATHINFO_EXTENSION));
    if (isset($mimes[$ext])) {
        header('Content-Type: ' . $mimes[$ext]);
    }
    return false;
}

// ── Todo lo demás → index.html ────────────────────────────
header('Content-Type: text/html; charset=utf-8');
readfile(__DIR__ . '/index.html');