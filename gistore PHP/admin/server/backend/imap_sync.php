<?php
// ============================================================
//  gistore/admin/server/backend/imap_sync.php
//  Sincronización IMAP — lee correos del servidor de correo
//  y los importa a com_correos_recibidos.
//
//  ¿Cómo funciona?
//  ─────────────────────────────────────────────────────────
//  1. Para cada cuenta SMTP con imap_activo = 1 abre una
//     conexión IMAP usando la extensión imap de PHP.
//  2. Solo baja correos con UID > imap_ultimo_uid (nunca
//     duplica mensajes ya importados).
//  3. Guarda el cuerpo, remitente, asunto y adjuntos.
//  4. Actualiza imap_ultimo_uid al terminar.
//
//  Modos de uso:
//  ─────────────────────────────────────────────────────────
//  A) Llamado por fetch desde el frontend (bandeja.js):
//     GET  accion=sincronizar            ← sincroniza todas las cuentas activas
//     GET  accion=sincronizar&cuenta_id=N ← solo esa cuenta
//     GET  accion=estado                 ← devuelve fecha/hora del último sync
//
//  B) Cron en el servidor (cada 5 min):
//     php /ruta/imap_sync.php --cron
//
//  Requisito del servidor:
//     extension=imap  en php.ini  (php-imap en Ubuntu/Debian)
//     sudo apt install php-imap && sudo phpenmod imap
// ============================================================

// ── Arranque dual: web (requiere token) o cron ────────────
$es_cron = (PHP_SAPI === 'cli') && in_array('--cron', $argv ?? []);

if (!$es_cron) {
    require_once __DIR__ . '/_helpers.php';
    validar_token();
    validar_sesion_admin();
}

$pdo = $es_cron ? conectar_cron() : conectar();

// Verificar extensión imap
if (!function_exists('imap_open')) {
    $msg = 'La extensión PHP IMAP no está instalada. Ejecuta: sudo apt install php-imap && sudo phpenmod imap && sudo systemctl restart apache2';
    if ($es_cron) { echo $msg . PHP_EOL; exit(1); }
    error_respuesta($msg, 500);
}

define('DIR_ADJ_RECIBIDOS', __DIR__ . '/../uploads/recibidos/');
define('MAX_ADJ_BYTES',      10 * 1024 * 1024);   // 10 MB por adjunto
define('TIPOS_ADJ_IMAP',     ['pdf','doc','docx','xls','xlsx','ppt','pptx',
                               'jpg','jpeg','png','gif','webp','zip','txt','csv']);
define('CORREOS_POR_SYNC',   50);   // máximo de correos nuevos por cuenta por sincronización

$accion    = $es_cron ? 'sincronizar' : accion();
$cuenta_id = $es_cron ? 0 : (int)($_GET['cuenta_id'] ?? 0);

// ── ESTADO ────────────────────────────────────────────────
if ($accion === 'estado') {
    // Devuelve, por cuenta, cuándo fue el último correo recibido
    $filas = $pdo->query(
        "SELECT c.id, c.nombre, c.email,
                MAX(r.recibido_en) AS ultimo_correo,
                COUNT(r.id)        AS total_recibidos,
                SUM(r.leido = 0)   AS sin_leer
           FROM com_smtp_cuentas c
           LEFT JOIN com_correos_recibidos r ON r.cuenta_smtp_id = c.id AND r.eliminado = 0
          WHERE c.imap_activo = 1
          GROUP BY c.id"
    )->fetchAll(PDO::FETCH_ASSOC);
    ok($filas);
}

// ── SINCRONIZAR ───────────────────────────────────────────
if ($accion === 'sincronizar') {
    $sql = "SELECT id, nombre, email, imap_host, imap_puerto, imap_ssl,
                   imap_usuario, password, imap_ultimo_uid
              FROM com_smtp_cuentas
             WHERE imap_activo = 1";
    if ($cuenta_id) $sql .= " AND id = " . (int)$cuenta_id;

    $cuentas = $pdo->query($sql)->fetchAll(PDO::FETCH_ASSOC);

    if (!$cuentas) {
        $msg = $cuenta_id
            ? 'Cuenta no encontrada o IMAP no activado para esta cuenta.'
            : 'No hay cuentas con IMAP activo. Actívalo en Configuración → Cuentas de correo.';
        if ($es_cron) { echo $msg . PHP_EOL; exit(0); }
        ok(['sincronizados' => 0, 'info' => $msg]);
    }

    $resumen = [];

    foreach ($cuentas as $c) {
        $resultado = sincronizar_cuenta($pdo, $c);
        $resumen[] = [
            'cuenta'      => $c['nombre'],
            'email'       => $c['email'],
            'importados'  => $resultado['importados'],
            'errores'     => $resultado['errores'],
            'ultimo_uid'  => $resultado['ultimo_uid'],
        ];
        if ($es_cron) {
            echo "[{$c['email']}] Importados: {$resultado['importados']} | Errores: {$resultado['errores']}" . PHP_EOL;
        }
    }

    if ($es_cron) exit(0);
    ok(['resumen' => $resumen]);
}

if (!$es_cron) error_respuesta('Acción no reconocida', 404);

// ══════════════════════════════════════════════════════════
// ── Motor IMAP ────────────────────────────────────────────
// ══════════════════════════════════════════════════════════

function sincronizar_cuenta(PDO $pdo, array $c): array
{
    $importados = 0;
    $errores    = 0;
    $ultimo_uid = (int)$c['imap_ultimo_uid'];

    // ── Construir string de conexión ──────────────────────
    $flags  = $c['imap_ssl'] ? '/ssl/novalidate-cert' : '/notls/novalidate-cert';
    $mailbox = "{{$c['imap_host']}:{$c['imap_puerto']}/imap{$flags}}INBOX";
    $usuario  = $c['imap_usuario'] ?: $c['email'];
    $password = smtp_descifrar($c['password']);

    // Suprimir warnings de imap_open para manejarlos nosotros
    $imap = @imap_open($mailbox, $usuario, $password, OP_READONLY, 1);

    if (!$imap) {
        $err = imap_last_error();
        log_error_imap($pdo, $c['id'], $err);
        return ['importados' => 0, 'errores' => 1, 'ultimo_uid' => $ultimo_uid];
    }

    // ── Obtener UIDs nuevos ───────────────────────────────
    // Busca mensajes con UID > último sincronizado
    $uid_desde = $ultimo_uid + 1;
    $uids = @imap_search($imap, "UID {$uid_desde}:*", SE_UID);

    if (!$uids || !is_array($uids)) {
        imap_close($imap);
        return ['importados' => 0, 'errores' => 0, 'ultimo_uid' => $ultimo_uid];
    }

    // Limitar a CORREOS_POR_SYNC para no sobrecargar
    sort($uids);
    $uids = array_slice($uids, 0, CORREOS_POR_SYNC);

    foreach ($uids as $uid) {
        try {
            $importado = importar_mensaje($pdo, $imap, (int)$uid, $c);
            if ($importado) {
                $importados++;
                if ((int)$uid > $ultimo_uid) $ultimo_uid = (int)$uid;
            }
        } catch (\Throwable $e) {
            $errores++;
            log_error_imap($pdo, $c['id'], "UID {$uid}: " . $e->getMessage());
        }
    }

    imap_close($imap);

    // Actualizar último UID en la BBDD
    if ($ultimo_uid > (int)$c['imap_ultimo_uid']) {
        $pdo->prepare("UPDATE com_smtp_cuentas SET imap_ultimo_uid = :uid WHERE id = :id")
            ->execute([':uid' => $ultimo_uid, ':id' => $c['id']]);
    }

    return ['importados' => $importados, 'errores' => $errores, 'ultimo_uid' => $ultimo_uid];
}

// ── Importar un mensaje concreto ──────────────────────────
function importar_mensaje(PDO $pdo, $imap, int $uid, array $cuenta): bool
{
    // Verificar si ya existe (deduplicación por UID)
    $existe = $pdo->prepare(
        "SELECT id FROM com_correos_recibidos
          WHERE cuenta_smtp_id = :cid AND uid_imap = :uid LIMIT 1"
    );
    $existe->execute([':cid' => $cuenta['id'], ':uid' => $uid]);
    if ($existe->fetch()) return false;   // ya importado

    // Obtener número de secuencia a partir del UID
    $msgno = imap_msgno($imap, $uid);
    if (!$msgno) return false;

    // Cabeceras
    $headers = imap_headerinfo($imap, $msgno);
    if (!$headers) return false;

    // Message-ID (deduplicación secundaria)
    $message_id = trim($headers->message_id ?? '');

    // Verificar por Message-ID si ya existe (para correos sin UID previo)
    if ($message_id) {
        $exM = $pdo->prepare(
            "SELECT id FROM com_correos_recibidos WHERE message_id = :mid LIMIT 1"
        );
        $exM->execute([':mid' => $message_id]);
        if ($exM->fetch()) return false;
    }

    // Remitente
    $from      = $headers->from[0] ?? null;
    $de_email  = $from ? strtolower(trim($from->mailbox . '@' . $from->host)) : '';
    $de_nombre = '';
    if ($from && isset($from->personal)) {
        $de_nombre = imap_utf8(trim($from->personal, '"\''));
    }

    // Asunto
    $asunto = $headers->subject ? imap_utf8($headers->subject) : '(sin asunto)';

    // Fecha
    $recibido_en = date('Y-m-d H:i:s', $headers->udate ?? time());

    // Cuerpo
    [$cuerpo, $adjuntos] = extraer_cuerpo_y_adjuntos($imap, $msgno);

    // Clasificar spam por dominio bloqueado
    $dominio = strtolower(substr($de_email, strpos($de_email, '@') + 1));
    $stSpam  = $pdo->prepare("SELECT id FROM com_spam_dominios WHERE dominio = :d");
    $stSpam->execute([':d' => $dominio]);
    $es_spam = $stSpam->fetch() ? 1 : 0;

    // Insertar en BBDD
    $st = $pdo->prepare(
        "INSERT INTO com_correos_recibidos
           (cuenta_smtp_id, uid_imap, message_id, de_nombre, de_email,
            asunto, cuerpo, tipo, es_spam, recibido_en)
         VALUES (:cid, :uid, :mid, :de_nombre, :de_email,
                 :asunto, :cuerpo, 'consulta', :spam, :fecha)"
    );
    $st->execute([
        ':cid'      => $cuenta['id'],
        ':uid'      => $uid,
        ':mid'      => $message_id ?: null,
        ':de_nombre'=> $de_nombre,
        ':de_email' => $de_email,
        ':asunto'   => $asunto,
        ':cuerpo'   => $cuerpo,
        ':spam'     => $es_spam,
        ':fecha'    => $recibido_en,
    ]);
    $nuevo_id = (int)$pdo->lastInsertId();

    // Guardar adjuntos descargados del servidor IMAP
    if ($adjuntos && $nuevo_id) {
        $dir = DIR_ADJ_RECIBIDOS . $nuevo_id . '/';
        if (!is_dir($dir)) mkdir($dir, 0755, true);
        foreach ($adjuntos as $adj) {
            $nombre_seg = preg_replace('/[^a-zA-Z0-9._-]/', '_', $adj['nombre']);
            if (!$nombre_seg) continue;
            if (file_exists($dir . $nombre_seg))
                $nombre_seg = time() . '_' . $nombre_seg;
            file_put_contents($dir . $nombre_seg, $adj['datos']);
        }
    }

    return true;
}

// ── Extraer cuerpo y adjuntos de un mensaje IMAP ──────────
function extraer_cuerpo_y_adjuntos($imap, int $msgno): array
{
    $estructura = imap_fetchstructure($imap, $msgno);
    $cuerpo     = '';
    $adjuntos   = [];

    if (!$estructura) return ['', []];

    // Mensaje simple (sin partes)
    if (!isset($estructura->parts)) {
        $cuerpo = obtener_parte_texto($imap, $msgno, '', $estructura);
        return [$cuerpo, []];
    }

    // Mensaje multiparte
    procesar_partes($imap, $msgno, $estructura->parts, '1', $cuerpo, $adjuntos);

    // Si no hay texto plano, intentar con la parte 1
    if (!$cuerpo) {
        $raw = imap_fetchbody($imap, $msgno, '1');
        $cuerpo = imap_utf8($raw ?? '');
    }

    return [trim($cuerpo), $adjuntos];
}

function procesar_partes($imap, int $msgno, array $partes, string $prefijo,
                          string &$cuerpo, array &$adjuntos): void
{
    foreach ($partes as $i => $parte) {
        $seccion = $prefijo ? ($i + 1) : (string)($i + 1);

        // ── Adjunto (disposition = attachment, o nombre de fichero) ──
        $es_adjunto = false;
        if (isset($parte->disposition) && strtolower($parte->disposition) === 'attachment')
            $es_adjunto = true;
        if (!$es_adjunto && isset($parte->dparameters)) {
            foreach ($parte->dparameters as $dp) {
                if (strtolower($dp->attribute) === 'filename') { $es_adjunto = true; break; }
            }
        }
        if (!$es_adjunto && isset($parte->parameters)) {
            foreach ($parte->parameters as $p) {
                if (strtolower($p->attribute) === 'name') { $es_adjunto = true; break; }
            }
        }

        if ($es_adjunto) {
            $nombre = '';
            // Preferir dparameters (filename) sobre parameters (name)
            foreach (($parte->dparameters ?? []) as $dp) {
                if (strtolower($dp->attribute) === 'filename') {
                    $nombre = imap_utf8($dp->value); break;
                }
            }
            if (!$nombre) {
                foreach (($parte->parameters ?? []) as $p) {
                    if (strtolower($p->attribute) === 'name') {
                        $nombre = imap_utf8($p->value); break;
                    }
                }
            }
            if (!$nombre) $nombre = 'adjunto_' . $seccion;

            $ext = strtolower(pathinfo($nombre, PATHINFO_EXTENSION));
            if (in_array($ext, TIPOS_ADJ_IMAP)) {
                $raw  = imap_fetchbody($imap, $msgno, $seccion);
                $datos = decodificar($raw, $parte->encoding ?? 0);
                if (strlen($datos) <= MAX_ADJ_BYTES) {
                    $adjuntos[] = ['nombre' => $nombre, 'datos' => $datos];
                }
            }
            continue;
        }

        // ── Texto plano ──────────────────────────────────
        if ($parte->type === TYPETEXT && strtolower($parte->subtype) === 'plain' && !$cuerpo) {
            $raw    = imap_fetchbody($imap, $msgno, $seccion);
            $texto  = decodificar($raw, $parte->encoding ?? 0);
            $charset = 'UTF-8';
            foreach (($parte->parameters ?? []) as $p) {
                if (strtolower($p->attribute) === 'charset') {
                    $charset = $p->value; break;
                }
            }
            $cuerpo = @iconv($charset, 'UTF-8//IGNORE', $texto) ?: $texto;
        }

        // ── HTML (solo si no hay texto plano todavía) ────
        if ($parte->type === TYPETEXT && strtolower($parte->subtype) === 'html' && !$cuerpo) {
            $raw   = imap_fetchbody($imap, $msgno, $seccion);
            $html  = decodificar($raw, $parte->encoding ?? 0);
            $cuerpo = html_a_texto($html);
        }

        // ── Recursión en multipart ───────────────────────
        if ($parte->type === TYPEMULTIPART && isset($parte->parts)) {
            procesar_partes($imap, $msgno, $parte->parts, $seccion, $cuerpo, $adjuntos);
        }
    }
}

function obtener_parte_texto($imap, int $msgno, string $seccion, $estructura): string
{
    $raw = imap_fetchbody($imap, $msgno, $seccion ?: '1');
    return decodificar($raw ?: '', $estructura->encoding ?? 0);
}

function decodificar(string $raw, int $encoding): string
{
    return match ($encoding) {
        1  => imap_utf8($raw),          // QUOTED-PRINTABLE
        2  => base64_decode($raw),       // BASE64
        default => $raw,
    };
}

function html_a_texto(string $html): string
{
    // Convertir <br>, <p>, <div> a saltos de línea antes de strip_tags
    $html = preg_replace('/<br\s*\/?>/i', "\n", $html);
    $html = preg_replace('/<\/p>/i',      "\n", $html);
    $html = preg_replace('/<\/div>/i',    "\n", $html);
    $texto = strip_tags($html);
    $texto = html_entity_decode($texto, ENT_QUOTES | ENT_HTML5, 'UTF-8');
    return preg_replace("/\n{3,}/", "\n\n", trim($texto));
}

function log_error_imap(PDO $pdo, int $cuenta_id, string $msg): void
{
    // Simple: actualizar estado de la cuenta a 'error'
    try {
        $pdo->prepare("UPDATE com_smtp_cuentas SET estado = 'error' WHERE id = :id")
            ->execute([':id' => $cuenta_id]);
    } catch (\Throwable) {}
    // En producción podrías escribir a un archivo de log
    error_log("[GI IMAP] cuenta_id={$cuenta_id}: {$msg}");
}

// ── Helpers (replicados para modo cron sin _helpers.php) ──
function smtp_descifrar(string $cifrado): string
{
    if (!$cifrado) return '';
    $key  = hash('sha256', $_SERVER['SERVER_NAME'] . 'gi_smtp_secret', true);
    $blob = base64_decode($cifrado);
    if (strlen($blob) < 17) return '';
    $iv   = substr($blob, 0, 16);
    $enc  = substr($blob, 16);
    return (string)@openssl_decrypt($enc, 'AES-256-CBC', $key, 0, $iv);
}

function conectar_cron(): PDO
{
    // En modo cron cargamos la conexión directamente
    require_once __DIR__ . '/../../../backend/conexion.php';
    return __Conectar();
}
