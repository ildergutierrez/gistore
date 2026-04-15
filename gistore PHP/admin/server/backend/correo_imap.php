<?php
// ============================================================
//  gistore/admin/server/backend/correo_imap.php
//  Lee correos EN TIEMPO REAL desde el servidor IMAP.
//  NO guarda nada en la BBDD — funciona como Evolution:
//  cada petición abre IMAP, lee, devuelve y cierra.
//
//  GET  accion=listar
//       &cuenta_id=N          ← cuenta SMTP/IMAP a usar
//       &carpeta=INBOX        ← carpeta (INBOX, Sent, Spam, Drafts…)
//       &pagina=1
//       &q=texto              ← búsqueda en asunto/remitente
//
//  GET  accion=ver
//       &cuenta_id=N
//       &uid=N                ← UID IMAP del mensaje
//       &carpeta=INBOX
//
//  GET  accion=adjunto
//       &cuenta_id=N
//       &uid=N
//       &parte=N              ← índice del adjunto (0-based)
//       &carpeta=INBOX
//
//  GET  accion=carpetas
//       &cuenta_id=N          ← devuelve lista de carpetas del servidor
//
//  GET  accion=stats
//       &cuenta_id=N          ← sin_leer, total en INBOX
//
//  POST accion=mover
//       cuenta_id, uid, carpeta_origen, carpeta_destino
//       (mover mensaje entre carpetas del servidor: Spam, Papelera, etc.)
//
//  POST accion=eliminar
//       cuenta_id, uid, carpeta   ← marca como \Deleted en el servidor
//
//  POST accion=marcar_leido
//       cuenta_id, uid, carpeta
// ============================================================

require_once __DIR__ . '/_helpers.php';
validar_token();
validar_sesion_admin();

if (!function_exists('imap_open')) {
    error_respuesta(
        'Extensión PHP IMAP no instalada. En Kali Linux ejecuta: ' .
        'sudo apt update && sudo apt install php-imap -y && sudo phpenmod imap && sudo service apache2 restart',
        500
    );
}

$pdo    = conectar();
$accion = accion();

define('IMAP_TIMEOUT',    15);   // segundos
define('IMAP_POR_PAG',    25);   // mensajes por página en listar
define('MAX_ADJ_BYTES',   15 * 1024 * 1024);

// ── Obtener cuenta y abrir conexión IMAP ──────────────────
function imap_cuenta(PDO $pdo, int $cuenta_id): array
{
    if (!$cuenta_id) error_respuesta('cuenta_id es obligatorio');
    $st = $pdo->prepare("SELECT * FROM com_smtp_cuentas WHERE id = :id LIMIT 1");
    $st->execute([':id' => $cuenta_id]);
    $c = $st->fetch(PDO::FETCH_ASSOC);
    if (!$c) error_respuesta('Cuenta no encontrada', 404);
    if (!$c['imap_host']) error_respuesta('Esta cuenta no tiene host IMAP configurado');
    return $c;
}

function imap_abrir(array $c, string $carpeta = 'INBOX')
{
    $flags   = $c['imap_ssl'] ? '/ssl/novalidate-cert' : '/notls/novalidate-cert';
    $mailbox = "{{$c['imap_host']}:{$c['imap_puerto']}/imap{$flags}}{$carpeta}";
    $usuario = $c['imap_usuario'] ?: $c['email'];
    $pass    = imap_descifrar($c['password']);

    imap_timeout(IMAP_OPENTIMEOUT, IMAP_TIMEOUT);
    imap_timeout(IMAP_READTIMEOUT, IMAP_TIMEOUT);

    $imap = @imap_open($mailbox, $usuario, $pass, 0, 1);
    if (!$imap) {
        $err = imap_last_error();
        error_respuesta('Error IMAP: ' . ($err ?: 'No se pudo conectar al servidor de correo'));
    }
    return $imap;
}

function imap_descifrar(string $cifrado): string
{
    if (!$cifrado) return '';
    $key  = hash('sha256', $_SERVER['SERVER_NAME'] . 'gi_smtp_secret', true);
    $blob = base64_decode($cifrado);
    if (strlen($blob) < 17) return '';
    return (string)@openssl_decrypt(substr($blob, 16), 'AES-256-CBC', $key, 0, substr($blob, 0, 16));
}

// ─────────────────────────────────────────────────────────
// STATS — sin_leer y total en INBOX
// ─────────────────────────────────────────────────────────
if ($accion === 'stats') {
    $cuenta_id = (int)($_GET['cuenta_id'] ?? 0);
    $c    = imap_cuenta($pdo, $cuenta_id);
    $imap = imap_abrir($c, 'INBOX');

    $info      = imap_status($imap, imap_mailboxname($imap), SA_ALL);
    $sin_leer  = $info->unseen  ?? 0;
    $total     = $info->messages ?? 0;

    imap_close($imap);
    ok(['sin_leer' => (int)$sin_leer, 'total' => (int)$total]);
}

function imap_mailboxname($imap): string
{
    // Devuelve el mailbox al que está conectado
    $check = imap_check($imap);
    return $check ? $check->Mailbox : '';
}

// ─────────────────────────────────────────────────────────
// CARPETAS — lista de carpetas del servidor
// ─────────────────────────────────────────────────────────
if ($accion === 'carpetas') {
    $cuenta_id = (int)($_GET['cuenta_id'] ?? 0);
    $c    = imap_cuenta($pdo, $cuenta_id);

    $flags   = $c['imap_ssl'] ? '/ssl/novalidate-cert' : '/notls/novalidate-cert';
    $ref     = "{{$c['imap_host']}:{$c['imap_puerto']}/imap{$flags}}";
    $usuario = $c['imap_usuario'] ?: $c['email'];
    $pass    = imap_descifrar($c['password']);

    imap_timeout(IMAP_OPENTIMEOUT, IMAP_TIMEOUT);
    $imap = @imap_open($ref . 'INBOX', $usuario, $pass, 0, 1);
    if (!$imap) error_respuesta('Error IMAP: ' . (imap_last_error() ?: 'Conexión fallida'));

    $lista = imap_list($imap, $ref, '*');
    imap_close($imap);

    $carpetas = [];
    if ($lista) {
        foreach ($lista as $mb) {
            // Eliminar el prefijo de servidor para devolver solo el nombre
            $nombre = str_replace($ref, '', $mb);
            $carpetas[] = $nombre;
        }
        sort($carpetas);
    }
    ok($carpetas);
}

// ─────────────────────────────────────────────────────────
// LISTAR — encabezados de mensajes (sin cuerpo)
// ─────────────────────────────────────────────────────────
if ($accion === 'listar') {
    $cuenta_id = (int)($_GET['cuenta_id'] ?? 0);
    $carpeta   = trim($_GET['carpeta'] ?? 'INBOX');
    $pagina    = max(1, (int)($_GET['pagina'] ?? 1));
    $q         = trim($_GET['q'] ?? '');

    $c    = imap_cuenta($pdo, $cuenta_id);
    $imap = imap_abrir($c, $carpeta);

    $total_msgs = imap_num_msg($imap);

    // Búsqueda en el servidor IMAP (usa criterios RFC 3501)
    if ($q) {
        // Buscar en asunto o remitente (OR no soportado universalmente,
        // hacemos dos búsquedas y unimos)
        $por_asunto   = @imap_search($imap, 'SUBJECT "' . addslashes($q) . '"', SE_UID) ?: [];
        $por_remitente= @imap_search($imap, 'FROM "'    . addslashes($q) . '"', SE_UID) ?: [];
        $uids = array_unique(array_merge($por_asunto, $por_remitente));
        rsort($uids);   // más recientes primero
    } else {
        // Sin búsqueda: todos los mensajes ordenados reciente → antiguo
        $uids = @imap_search($imap, 'ALL', SE_UID) ?: [];
        rsort($uids);
    }

    $total = count($uids);
    // Paginación sobre los UIDs
    $uids_pagina = array_slice($uids, ($pagina - 1) * IMAP_POR_PAG, IMAP_POR_PAG);

    $correos = [];
    foreach ($uids_pagina as $uid) {
        $msgno = imap_msgno($imap, $uid);
        if (!$msgno) continue;
        $h = imap_headerinfo($imap, $msgno);
        if (!$h) continue;

        $from      = $h->from[0] ?? null;
        $de_email  = $from ? strtolower(trim($from->mailbox . '@' . $from->host)) : '';
        $de_nombre = ($from && isset($from->personal))
                     ? imap_utf8(trim($from->personal, '"\'')) : '';

        // Flags del mensaje
        $overview = imap_fetch_overview($imap, (string)$uid, FT_UID);
        $leido    = isset($overview[0]->seen) ? (bool)$overview[0]->seen : false;

        $correos[] = [
            'uid'       => $uid,
            'de_email'  => $de_email,
            'de_nombre' => $de_nombre,
            'asunto'    => $h->subject ? imap_utf8($h->subject) : '(sin asunto)',
            'fecha'     => $h->date    ? date('d M Y H:i', strtotime($h->date)) : '',
            'leido'     => $leido,
        ];
    }

    imap_close($imap);

    ok([
        'total'    => $total,
        'pagina'   => $pagina,
        'por_pag'  => IMAP_POR_PAG,
        'correos'  => $correos,
        'carpeta'  => $carpeta,
    ]);
}

// ─────────────────────────────────────────────────────────
// VER — cuerpo completo de un mensaje por UID
// ─────────────────────────────────────────────────────────
if ($accion === 'ver') {
    $cuenta_id = (int)($_GET['cuenta_id'] ?? 0);
    $uid       = (int)($_GET['uid']       ?? 0);
    $carpeta   = trim($_GET['carpeta']    ?? 'INBOX');
    if (!$uid) error_respuesta('uid es obligatorio');

    $c    = imap_cuenta($pdo, $cuenta_id);
    $imap = imap_abrir($c, $carpeta);

    $msgno = imap_msgno($imap, $uid);
    if (!$msgno) { imap_close($imap); error_respuesta('Mensaje no encontrado', 404); }

    $h = imap_headerinfo($imap, $msgno);
    if (!$h)     { imap_close($imap); error_respuesta('No se pudo leer el mensaje', 500); }

    // Remitente
    $from      = $h->from[0]    ?? null;
    $de_email  = $from ? strtolower(trim($from->mailbox . '@' . $from->host)) : '';
    $de_nombre = ($from && isset($from->personal))
                 ? imap_utf8(trim($from->personal, '"\'')) : '';

    // Destinatarios
    $para = [];
    foreach (($h->to ?? []) as $t) {
        $para[] = isset($t->personal)
                  ? imap_utf8($t->personal) . ' <' . $t->mailbox . '@' . $t->host . '>'
                  : $t->mailbox . '@' . $t->host;
    }

    // Estructura para extraer cuerpo y adjuntos
    [$cuerpo, $cuerpo_html, $adjuntos] = extraer_mensaje($imap, $msgno);

    // Marcar como leído en el servidor
    imap_setflag_full($imap, (string)$uid, '\\Seen', ST_UID);

    imap_close($imap);

    ok([
        'uid'        => $uid,
        'carpeta'    => $carpeta,
        'de_email'   => $de_email,
        'de_nombre'  => $de_nombre,
        'para'       => implode(', ', $para),
        'asunto'     => $h->subject ? imap_utf8($h->subject) : '(sin asunto)',
        'fecha'      => $h->date    ? date('d M Y H:i', strtotime($h->date)) : '',
        'cuerpo'     => $cuerpo,
        'cuerpo_html'=> $cuerpo_html,   // si existe, el JS puede mostrar HTML
        'adjuntos'   => $adjuntos,       // [{nombre, parte, tam_bytes, mime}]
    ]);
}

// ─────────────────────────────────────────────────────────
// ADJUNTO — descarga un adjunto concreto en tiempo real
// ─────────────────────────────────────────────────────────
if ($accion === 'adjunto') {
    $cuenta_id = (int)($_GET['cuenta_id'] ?? 0);
    $uid       = (int)($_GET['uid']       ?? 0);
    $parte     = (int)($_GET['parte']     ?? 0);   // número de sección IMAP
    $carpeta   = trim($_GET['carpeta']    ?? 'INBOX');
    if (!$uid) error_respuesta('uid es obligatorio');

    $c    = imap_cuenta($pdo, $cuenta_id);
    $imap = imap_abrir($c, $carpeta);

    $msgno = imap_msgno($imap, $uid);
    if (!$msgno) { imap_close($imap); error_respuesta('Mensaje no encontrado', 404); }

    // Re-extraer para obtener info del adjunto (nombre, encoding, mime)
    [, , $adjuntos] = extraer_mensaje($imap, $msgno);

    if (!isset($adjuntos[$parte])) {
        imap_close($imap);
        error_respuesta('Adjunto no encontrado', 404);
    }

    $adj      = $adjuntos[$parte];
    $raw      = imap_fetchbody($imap, $msgno, $adj['seccion']);
    $datos    = imap_decodificar($raw, $adj['encoding']);

    imap_close($imap);

    if (strlen($datos) > MAX_ADJ_BYTES) {
        error_respuesta('El adjunto supera el límite de ' . (MAX_ADJ_BYTES / 1024 / 1024) . ' MB');
    }

    $nombre = preg_replace('/[^a-zA-Z0-9._\-\(\) ]/', '_', $adj['nombre']);
    header('Content-Type: '        . ($adj['mime'] ?: 'application/octet-stream'));
    header('Content-Disposition: attachment; filename="' . $nombre . '"');
    header('Content-Length: '      . strlen($datos));
    header('Cache-Control: private, no-store');
    echo $datos;
    exit;
}

// ─────────────────────────────────────────────────────────
// MARCAR LEÍDO
// ─────────────────────────────────────────────────────────
if ($accion === 'marcar_leido') {
    $cuenta_id = int_in('cuenta_id');
    $uid       = int_in('uid');
    $carpeta   = str_in('carpeta') ?: 'INBOX';
    if (!$uid) error_respuesta('uid es obligatorio');

    $c    = imap_cuenta($pdo, $cuenta_id);
    $imap = imap_abrir($c, $carpeta);
    imap_setflag_full($imap, (string)$uid, '\\Seen', ST_UID);
    imap_close($imap);
    ok();
}

// ─────────────────────────────────────────────────────────
// MOVER — mueve el mensaje a otra carpeta en el servidor
// ─────────────────────────────────────────────────────────
if ($accion === 'mover') {
    $cuenta_id  = int_in('cuenta_id');
    $uid        = int_in('uid');
    $carpeta_or = str_in('carpeta_origen')  ?: 'INBOX';
    $carpeta_de = str_in('carpeta_destino');
    if (!$uid || !$carpeta_de) error_respuesta('uid y carpeta_destino son obligatorios');

    $c    = imap_cuenta($pdo, $cuenta_id);
    $imap = imap_abrir($c, $carpeta_or);

    $ok = imap_mail_move($imap, (string)$uid, $carpeta_de, CP_UID);
    imap_expunge($imap);
    imap_close($imap);

    if (!$ok) error_respuesta('No se pudo mover el mensaje');
    ok(['movido' => $uid, 'destino' => $carpeta_de]);
}

// ─────────────────────────────────────────────────────────
// ELIMINAR — marca \Deleted y expunge en el servidor
// ─────────────────────────────────────────────────────────
if ($accion === 'eliminar') {
    $cuenta_id = int_in('cuenta_id');
    $uid       = int_in('uid');
    $carpeta   = str_in('carpeta') ?: 'INBOX';
    if (!$uid) error_respuesta('uid es obligatorio');

    $c    = imap_cuenta($pdo, $cuenta_id);
    $imap = imap_abrir($c, $carpeta);
    imap_delete($imap, (string)$uid, FT_UID);
    imap_expunge($imap);
    imap_close($imap);
    ok(['eliminado' => $uid]);
}

error_respuesta('Acción no reconocida', 404);

// ══════════════════════════════════════════════════════════
// ── Funciones de extracción de mensaje ───────────────────
// ══════════════════════════════════════════════════════════

/**
 * Extrae texto plano, HTML y lista de adjuntos de un mensaje IMAP.
 * @return array [cuerpo_texto, cuerpo_html, adjuntos[]]
 */
function extraer_mensaje($imap, int $msgno): array
{
    $estructura  = imap_fetchstructure($imap, $msgno);
    $texto       = '';
    $html        = '';
    $adjuntos    = [];

    if (!$estructura) return ['', '', []];

    if (!isset($estructura->parts)) {
        // Mensaje sin partes (texto simple)
        $raw   = imap_fetchbody($imap, $msgno, '1');
        $texto = imap_decodificar($raw, $estructura->encoding ?? 0);
        $texto = normalizar_charset($texto, $estructura);
    } else {
        procesar_estructura($imap, $msgno, $estructura->parts, '', $texto, $html, $adjuntos);
        // Si no hay texto pero sí HTML, convertir HTML a texto
        if (!$texto && $html) $texto = html_a_texto($html);
    }

    return [trim($texto), $html, $adjuntos];
}

function procesar_estructura($imap, int $msgno, array $partes, string $prefijo,
                              string &$texto, string &$html, array &$adjuntos): void
{
    foreach ($partes as $i => $parte) {
        $seccion = $prefijo === '' ? (string)($i + 1) : $prefijo . '.' . ($i + 1);

        // ── Detectar adjunto ──────────────────────────────
        $es_adjunto = false;
        $nombre_adj = '';

        if (isset($parte->disposition) && strtolower($parte->disposition) === 'attachment')
            $es_adjunto = true;

        // Buscar nombre en dparameters (filename)
        foreach (($parte->dparameters ?? []) as $dp) {
            if (strtolower($dp->attribute) === 'filename') {
                $nombre_adj = imap_utf8($dp->value);
                $es_adjunto = true;
                break;
            }
        }
        // Buscar nombre en parameters (name)
        if (!$nombre_adj) {
            foreach (($parte->parameters ?? []) as $p) {
                if (strtolower($p->attribute) === 'name') {
                    $nombre_adj = imap_utf8($p->value);
                    if (!isset($parte->disposition) || strtolower($parte->disposition) !== 'inline')
                        $es_adjunto = true;
                    break;
                }
            }
        }

        if ($es_adjunto && $nombre_adj) {
            $mime    = strtolower(($parte->type === 0 ? 'text' :
                       ($parte->type === 1 ? 'multipart' :
                       ($parte->type === 2 ? 'message' :
                       ($parte->type === 3 ? 'application' :
                       ($parte->type === 4 ? 'audio' :
                       ($parte->type === 5 ? 'image' :
                       ($parte->type === 6 ? 'video' : 'application'))))))) .
                       '/' . strtolower($parte->subtype ?? 'octet-stream'));
            $adjuntos[] = [
                'nombre'   => $nombre_adj,
                'seccion'  => $seccion,
                'encoding' => $parte->encoding ?? 0,
                'tam_bytes'=> $parte->bytes    ?? 0,
                'mime'     => $mime,
            ];
            continue;
        }

        // ── Texto plano ───────────────────────────────────
        if ($parte->type === TYPETEXT && strtolower($parte->subtype) === 'plain' && !$texto) {
            $raw   = imap_fetchbody($imap, $msgno, $seccion);
            $dec   = imap_decodificar($raw, $parte->encoding ?? 0);
            $texto = normalizar_charset($dec, $parte);
        }

        // ── HTML ──────────────────────────────────────────
        if ($parte->type === TYPETEXT && strtolower($parte->subtype) === 'html' && !$html) {
            $raw  = imap_fetchbody($imap, $msgno, $seccion);
            $dec  = imap_decodificar($raw, $parte->encoding ?? 0);
            $html = normalizar_charset($dec, $parte);
        }

        // ── Multipart recursivo ───────────────────────────
        if ($parte->type === TYPEMULTIPART && isset($parte->parts)) {
            procesar_estructura($imap, $msgno, $parte->parts, $seccion, $texto, $html, $adjuntos);
        }
    }
}

function imap_decodificar(string $raw, int $encoding): string
{
    return match ($encoding) {
        1 => quoted_printable_decode($raw),   // QUOTED-PRINTABLE
        2 => base64_decode($raw),              // BASE64
        default => $raw,
    };
}

function normalizar_charset(string $texto, $parte): string
{
    $charset = 'UTF-8';
    foreach (($parte->parameters ?? []) as $p) {
        if (strtolower($p->attribute) === 'charset') {
            $charset = strtoupper($p->value);
            break;
        }
    }
    if ($charset !== 'UTF-8') {
        $conv = @iconv($charset, 'UTF-8//IGNORE', $texto);
        return $conv !== false ? $conv : $texto;
    }
    return $texto;
}

function html_a_texto(string $html): string
{
    $html = preg_replace('/<br\s*\/?>/i', "\n", $html);
    $html = preg_replace('/<\/p>/i',      "\n", $html);
    $html = preg_replace('/<\/div>/i',    "\n", $html);
    $texto = strip_tags($html);
    $texto = html_entity_decode($texto, ENT_QUOTES | ENT_HTML5, 'UTF-8');
    return preg_replace("/\n{3,}/", "\n\n", trim($texto));
}
