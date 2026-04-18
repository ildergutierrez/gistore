<?php
// ============================================================
//  user/backend/audios.php  v2
//  Banco de música royalty-free — SIN API KEY externa
//  Catálogo local curado + Jamendo API (opcional, gratis)
//
//  LOCAL: funciona sin ninguna key, pistas reales via SoundHelix
//  PRODUCCIÓN: activa Jamendo (key gratis en developer.jamendo.com)
//              cambiando USE_JAMENDO a true
//
//  La respuesta JSON es idéntica a la versión anterior:
//  { ok, total, pagina, datos: [{id,titulo,genero,mood,duracion,url,url_page,autor}] }
// ============================================================

if (session_status() === PHP_SESSION_NONE) session_start();

header('Content-Type: application/json; charset=UTF-8');

// ── Autenticación ─────────────────────────────────────────
if (empty($_SESSION['usuario_id']) || (int)($_SESSION['rol'] ?? 0) !== 2) {
    http_response_code(401);
    die(json_encode(['ok' => false, 'error' => 'No autenticado.']));
}

// ── CSRF ──────────────────────────────────────────────────
$token    = $_GET['token'] ?? '';
$guardado = $_SESSION['csrf_token']      ?? '';
$tiempo   = $_SESSION['csrf_token_time'] ?? 0;

if (!$token || !$guardado || !hash_equals($guardado, $token)) {
    http_response_code(403);
    die(json_encode(['ok' => false, 'error' => 'Token inválido.']));
}
if ((time() - $tiempo) > 7200) {
    http_response_code(403);
    die(json_encode(['ok' => false, 'error' => 'Token expirado.']));
}

// ════════════════════════════════════════════════════════════
//  CONFIG
// ════════════════════════════════════════════════════════════
define('USE_JAMENDO', false);   // → true para Jamendo en producción
define('JAMENDO_KEY', '');      // → tu client_id de developer.jamendo.com (gratis)

// ════════════════════════════════════════════════════════════
//  CATÁLOGO LOCAL
//  SoundHelix: MP3 públicos, dominio libre, sin key.
//  18 pistas × géneros distintos — idéntico formato al JS.
// ════════════════════════════════════════════════════════════
$CATALOGO = [
  ['id'=>1001,'titulo'=>'Upbeat Corporate Background',    'genero'=>'corporate',    'mood'=>'energetic','duracion'=>120,'url'=>'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3',  'url_page'=>'https://www.soundhelix.com','autor'=>'SoundHelix'],
  ['id'=>1002,'titulo'=>'Motivational Business Theme',    'genero'=>'corporate',    'mood'=>'happy',    'duracion'=>95, 'url'=>'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3',  'url_page'=>'https://www.soundhelix.com','autor'=>'SoundHelix'],
  ['id'=>1003,'titulo'=>'Professional Presentation',      'genero'=>'corporate',    'mood'=>'calm',     'duracion'=>110,'url'=>'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3',  'url_page'=>'https://www.soundhelix.com','autor'=>'SoundHelix'],
  ['id'=>1004,'titulo'=>'Electronic Dance Beat',          'genero'=>'electronic',   'mood'=>'energetic','duracion'=>130,'url'=>'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-4.mp3',  'url_page'=>'https://www.soundhelix.com','autor'=>'SoundHelix'],
  ['id'=>1005,'titulo'=>'Synth Pop Groove',               'genero'=>'electronic',   'mood'=>'happy',    'duracion'=>118,'url'=>'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-5.mp3',  'url_page'=>'https://www.soundhelix.com','autor'=>'SoundHelix'],
  ['id'=>1006,'titulo'=>'Future Bass Instrumental',       'genero'=>'electronic',   'mood'=>'dramatic', 'duracion'=>143,'url'=>'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-6.mp3',  'url_page'=>'https://www.soundhelix.com','autor'=>'SoundHelix'],
  ['id'=>1007,'titulo'=>'Peaceful Ambient Flow',          'genero'=>'ambient',      'mood'=>'calm',     'duracion'=>175,'url'=>'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-7.mp3',  'url_page'=>'https://www.soundhelix.com','autor'=>'SoundHelix'],
  ['id'=>1008,'titulo'=>'Soft Atmospheric Pad',           'genero'=>'ambient',      'mood'=>'calm',     'duracion'=>160,'url'=>'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-8.mp3',  'url_page'=>'https://www.soundhelix.com','autor'=>'SoundHelix'],
  ['id'=>1009,'titulo'=>'Catchy Pop Instrumental',        'genero'=>'pop',          'mood'=>'happy',    'duracion'=>102,'url'=>'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-9.mp3',  'url_page'=>'https://www.soundhelix.com','autor'=>'SoundHelix'],
  ['id'=>1010,'titulo'=>'Feel Good Pop Beat',             'genero'=>'pop',          'mood'=>'happy',    'duracion'=>115,'url'=>'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-10.mp3', 'url_page'=>'https://www.soundhelix.com','autor'=>'SoundHelix'],
  ['id'=>1011,'titulo'=>'Cool Jazz Cafe',                 'genero'=>'jazz',         'mood'=>'calm',     'duracion'=>198,'url'=>'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-11.mp3', 'url_page'=>'https://www.soundhelix.com','autor'=>'SoundHelix'],
  ['id'=>1012,'titulo'=>'Smooth Jazz Background',         'genero'=>'jazz',         'mood'=>'romantic', 'duracion'=>210,'url'=>'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-12.mp3', 'url_page'=>'https://www.soundhelix.com','autor'=>'SoundHelix'],
  ['id'=>1013,'titulo'=>'Tropical Latin Rhythm',          'genero'=>'latin',        'mood'=>'happy',    'duracion'=>128,'url'=>'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-13.mp3', 'url_page'=>'https://www.soundhelix.com','autor'=>'SoundHelix'],
  ['id'=>1014,'titulo'=>'Salsa Instrumental Beat',        'genero'=>'latin',        'mood'=>'energetic','duracion'=>145,'url'=>'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-14.mp3', 'url_page'=>'https://www.soundhelix.com','autor'=>'SoundHelix'],
  ['id'=>1015,'titulo'=>'Epic Motivational Rise',         'genero'=>'motivational', 'mood'=>'dramatic', 'duracion'=>138,'url'=>'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-15.mp3', 'url_page'=>'https://www.soundhelix.com','autor'=>'SoundHelix'],
  ['id'=>1016,'titulo'=>'Power Rock Instrumental',        'genero'=>'rock',         'mood'=>'energetic','duracion'=>162,'url'=>'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-16.mp3', 'url_page'=>'https://www.soundhelix.com','autor'=>'SoundHelix'],
  ['id'=>1017,'titulo'=>'Elegant Classical Piano',        'genero'=>'classical',    'mood'=>'romantic', 'duracion'=>220,'url'=>'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-17.mp3', 'url_page'=>'https://www.soundhelix.com','autor'=>'SoundHelix'],
  ['id'=>1018,'titulo'=>'Chill Hip Hop Beat',             'genero'=>'hip-hop',      'mood'=>'calm',     'duracion'=>125,'url'=>'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3',  'url_page'=>'https://www.soundhelix.com','autor'=>'SoundHelix'],
];

// ── Routing ───────────────────────────────────────────────
$accion = $_GET['accion'] ?? 'buscar';

// ══════════════════════════════════════════════════════════
//  ACCIÓN: buscar
// ══════════════════════════════════════════════════════════
if ($accion === 'buscar') {

    if (USE_JAMENDO && JAMENDO_KEY) {
        $q      = trim($_GET['q']      ?? '');
        $genero = trim($_GET['genero'] ?? '');
        $pag    = max(1,(int)($_GET['pagina']     ?? 1));
        $pp     = min(20,max(4,(int)($_GET['por_pagina'] ?? 12)));
        echo json_encode(_jamendo($q,$genero,$pag,$pp), JSON_UNESCAPED_UNICODE);
        exit;
    }

    $q      = strtolower(trim($_GET['q']      ?? ''));
    $genero = strtolower(trim($_GET['genero'] ?? ''));
    $pag    = max(1,(int)($_GET['pagina']     ?? 1));
    $pp     = min(20,max(4,(int)($_GET['por_pagina'] ?? 12)));

    $lista = $CATALOGO;

    if ($genero) {
        $lista = array_values(array_filter($lista,
            fn($p) => stripos($p['genero'], $genero) !== false));
    }

    $ignorar = ['background','instrumental','music','background instrumental'];
    if ($q && !in_array($q, $ignorar)) {
        $terminos = array_filter(explode(' ', $q));
        $temp = array_values(array_filter($lista, function($p) use ($terminos) {
            $h = strtolower("{$p['titulo']} {$p['genero']} {$p['mood']} {$p['autor']}");
            foreach ($terminos as $t) { if (stripos($h,$t)!==false) return true; }
            return false;
        }));
        if (!empty($temp)) $lista = $temp;
    }

    $total  = count($lista);
    $offset = ($pag - 1) * $pp;
    $datos  = array_values(array_slice($lista, $offset, $pp));

    // Asegurar tipos
    foreach ($datos as &$d) { $d['id']=(int)$d['id']; $d['duracion']=(int)$d['duracion']; }

    echo json_encode(['ok'=>true,'total'=>$total,'pagina'=>$pag,'datos'=>$datos],
                     JSON_UNESCAPED_UNICODE);
    exit;
}

// ══════════════════════════════════════════════════════════
//  ACCIÓN: categorias
// ══════════════════════════════════════════════════════════
if ($accion === 'categorias') {
    echo json_encode([
        'ok'=>true,
        'generos'=>[
            ['id'=>'',            'nombre'=>'🎵 Todos'],
            ['id'=>'corporate',   'nombre'=>'💼 Corporativo'],
            ['id'=>'pop',         'nombre'=>'🎤 Pop'],
            ['id'=>'electronic',  'nombre'=>'⚡ Electrónico'],
            ['id'=>'jazz',        'nombre'=>'🎷 Jazz'],
            ['id'=>'classical',   'nombre'=>'🎻 Clásico'],
            ['id'=>'rock',        'nombre'=>'🎸 Rock'],
            ['id'=>'ambient',     'nombre'=>'🌊 Ambient'],
            ['id'=>'hip-hop',     'nombre'=>'🎧 Hip-Hop'],
            ['id'=>'latin',       'nombre'=>'💃 Latino'],
            ['id'=>'motivational','nombre'=>'🚀 Motivacional'],
        ],
        'moods'=>[
            ['id'=>'',         'nombre'=>'😊 Cualquier mood'],
            ['id'=>'happy',    'nombre'=>'😄 Alegre'],
            ['id'=>'calm',     'nombre'=>'😌 Tranquilo'],
            ['id'=>'dramatic', 'nombre'=>'😮 Dramático'],
            ['id'=>'romantic', 'nombre'=>'💕 Romántico'],
            ['id'=>'energetic','nombre'=>'🔥 Energético'],
        ],
    ], JSON_UNESCAPED_UNICODE);
    exit;
}

// ════════════════════════════════════════════════════════════
//  JAMENDO — respuesta con el mismo formato
// ════════════════════════════════════════════════════════════
function _jamendo(string $q, string $genero, int $pag, int $pp): array {
    $offset = ($pag - 1) * $pp;
    $tags   = $genero ?: ($q ?: 'instrumental');
    $params = http_build_query([
        'client_id'=>JAMENDO_KEY,'format'=>'json',
        'limit'=>$pp,'offset'=>$offset,
        'tags'=>$tags,'audioformat'=>'mp32',
        'include'=>'musicinfo','groupby'=>'artist_id',
    ]);
    $raw = @file_get_contents("https://api.jamendo.com/v3.0/tracks/?{$params}",false,
        stream_context_create(['http'=>['method'=>'GET','timeout'=>10,'header'=>"User-Agent: GIStore/1.0\r\n"]]));
    if (!$raw) return ['ok'=>false,'error'=>'No se pudo conectar con Jamendo.'];
    $data = json_decode($raw,true);
    if (empty($data['results'])) return ['ok'=>true,'total'=>0,'pagina'=>$pag,'datos'=>[]];
    $pistas=[];
    foreach($data['results'] as $t){
        if(empty($t['audio'])) continue;
        $pistas[]=['id'=>(int)$t['id'],'titulo'=>$t['name']??'Sin título',
            'genero'=>$t['musicinfo']['tags']['genres'][0]??$genero,
            'mood'=>$t['musicinfo']['tags']['instruments'][0]??'',
            'duracion'=>(int)($t['duration']??0),
            'url'=>$t['audio'],'url_page'=>$t['shareurl']??'','autor'=>$t['artist_name']??''];
    }
    return ['ok'=>true,'total'=>(int)($data['headers']['results_fullcount']??count($pistas)),'pagina'=>$pag,'datos'=>$pistas];
}

// ════════════════════════════════════════════════════════════
//  ACCIÓN: proxy
//  Descarga el MP3 desde el servidor externo y lo sirve desde
//  este dominio, eliminando el problema de CORS en el cliente.
//  Uso: audios.php?accion=proxy&url=https://...mp3&token=...
// ════════════════════════════════════════════════════════════
if ($accion === 'proxy') {
    $url = trim($_GET['url'] ?? '');
    if (!$url || !filter_var($url, FILTER_VALIDATE_URL)) {
        http_response_code(400);
        die(json_encode(['ok'=>false,'error'=>'URL inválida.']));
    }

    // Solo permitir dominios de audio conocidos
    $host = parse_url($url, PHP_URL_HOST);
    $permitidos = ['soundhelix.com','www.soundhelix.com','cdn.jamendo.com','storage.jamendo.com','prod-1.storage.jamendo.com'];
    $ok = false;
    foreach ($permitidos as $p) { if ($host === $p || str_ends_with($host,'.'.$p)) { $ok=true; break; } }
    if (!$ok) { http_response_code(403); die(json_encode(['ok'=>false,'error'=>'Dominio no permitido.'])); }

    // Descargar el audio
    $ctx = stream_context_create(['http'=>[
        'method'     => 'GET',
        'timeout'    => 15,
        'header'     => "User-Agent: GIStore/1.0\r\nRange: bytes=0-\r\n",
        'follow_location' => 1,
    ]]);
    $data = @file_get_contents($url, false, $ctx);
    if ($data === false) {
        http_response_code(502);
        die(json_encode(['ok'=>false,'error'=>'No se pudo descargar el audio.']));
    }

    // Servir con cabeceras CORS correctas
    header('Content-Type: audio/mpeg');
    header('Access-Control-Allow-Origin: *');
    header('Cache-Control: public, max-age=86400');
    header('Content-Length: ' . strlen($data));
    echo $data;
    exit;
}

http_response_code(400);
echo json_encode(['ok'=>false,'error'=>'Acción no válida.']);