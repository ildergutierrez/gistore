<?php
// ============================================================
//  gistore/admin/server/backend/correo_recibidos.php
//  Bandeja de entrada — tabla: com_correos_recibidos
//
//  GET  accion=listar        [&spam=0|1] [&cuenta_id=N] [&q=texto] [&tipo=]
//  GET  accion=ver           &id=N
//  GET  accion=adjuntos      &id=N
//  GET  accion=descargar     &id=N&archivo=nombre
//  GET  accion=stats                       ← contadores para las tarjetas
//  POST accion=marcar_leido  id=N
//  POST accion=marcar_spam   id=N
//  POST accion=restaurar     id=N
//  POST accion=eliminar      id=N
//  POST accion=eliminar_masivo  ids[]=N,N
//  POST accion=vaciar_spam
//  POST accion=recibir       ← formularios externos / webhook
// ============================================================

require_once __DIR__ . '/_helpers.php';
validar_token();
validar_sesion_admin();

$pdo    = conectar();
$accion = accion();

define('DIR_ADJUNTOS_RECIBIDOS', __DIR__ . '/../uploads/recibidos/');
define('MAX_ADJUNTO_MB', 10);
define('TIPOS_PERMITIDOS', ['pdf','doc','docx','xls','xlsx','ppt','pptx',
                             'jpg','jpeg','png','gif','webp','zip','txt','csv']);

// ── STATS (para las tarjetas de la bandeja) ───────────────
if ($accion === 'stats') {
    $sin_leer = (int)$pdo->query(
        "SELECT COUNT(*) FROM com_correos_recibidos WHERE leido=0 AND es_spam=0 AND eliminado=0"
    )->fetchColumn();

    $hoy = (int)$pdo->query(
        "SELECT COUNT(*) FROM com_correos_recibidos
          WHERE es_spam=0 AND eliminado=0
            AND DATE(recibido_en) = CURDATE()"
    )->fetchColumn();

    $spam = (int)$pdo->query(
        "SELECT COUNT(*) FROM com_correos_recibidos WHERE es_spam=1 AND eliminado=0"
    )->fetchColumn();

    $enviados_mes = (int)$pdo->query(
        "SELECT COUNT(*) FROM com_correos_enviados
          WHERE MONTH(enviado_en)=MONTH(CURDATE())
            AND YEAR(enviado_en)=YEAR(CURDATE())"
    )->fetchColumn();

    ok([
        'sin_leer'     => $sin_leer,
        'hoy'          => $hoy,
        'spam'         => $spam,
        'enviados_mes' => $enviados_mes,
    ]);
}

// ── LISTAR ────────────────────────────────────────────────
if ($accion === 'listar') {
    $spam      = isset($_GET['spam']) ? (int)$_GET['spam'] : 0;
    $q         = trim($_GET['q']    ?? '');
    $tipo      = trim($_GET['tipo'] ?? '');
    $cuenta_id = (int)($_GET['cuenta_id'] ?? 0);
    $pagina    = max(1, (int)($_GET['pagina'] ?? 1));
    $por_pag   = 25;
    $offset    = ($pagina - 1) * $por_pag;

    $where  = ['eliminado = 0', 'es_spam = :spam'];
    $params = [':spam' => $spam];

    // Filtrar por cuenta solo si se pasó explícitamente Y existe la columna
    // (columna añadida por parche — si no existe no filtramos)
    if ($cuenta_id) {
        $cols = array_column(
            $pdo->query("SHOW COLUMNS FROM com_correos_recibidos LIKE 'cuenta_smtp_id'")->fetchAll(),
            'Field'
        );
        if ($cols) {
            $where[]              = 'cuenta_smtp_id = :cuenta_id';
            $params[':cuenta_id'] = $cuenta_id;
        }
    }

    if ($q) {
        $where[]      = '(de_nombre LIKE :q OR de_email LIKE :q OR asunto LIKE :q)';
        $params[':q'] = "%$q%";
    }
    if (in_array($tipo, ['transaccional', 'consulta', 'promo', 'otro'])) {
        $where[]         = 'tipo = :tipo';
        $params[':tipo'] = $tipo;
    }

    $cond = implode(' AND ', $where);

    $stCount = $pdo->prepare("SELECT COUNT(*) FROM com_correos_recibidos WHERE $cond");
    $stCount->execute($params);
    $total = (int)$stCount->fetchColumn();

    $st = $pdo->prepare(
        "SELECT id, de_nombre, de_email, asunto, tipo, leido, es_spam,
                DATE_FORMAT(recibido_en, '%d %b %Y %H:%i') AS fecha
           FROM com_correos_recibidos
          WHERE $cond
          ORDER BY recibido_en DESC
          LIMIT :limit OFFSET :offset"
    );
    foreach ($params as $k => $v) $st->bindValue($k, $v);
    $st->bindValue(':limit',  $por_pag, PDO::PARAM_INT);
    $st->bindValue(':offset', $offset,  PDO::PARAM_INT);
    $st->execute();

    ok([
        'total'   => $total,
        'pagina'  => $pagina,
        'por_pag' => $por_pag,
        'correos' => $st->fetchAll(PDO::FETCH_ASSOC),
    ]);
}

// ── VER ───────────────────────────────────────────────────
if ($accion === 'ver') {
    $id = (int)($_GET['id'] ?? 0);
    if (!$id) error_respuesta('ID requerido');

    $st = $pdo->prepare(
        "SELECT id, de_nombre, de_email, asunto, cuerpo, tipo, leido, es_spam,
                DATE_FORMAT(recibido_en, '%d %b %Y %H:%i') AS fecha
           FROM com_correos_recibidos
          WHERE id = :id AND eliminado = 0"
    );
    $st->execute([':id' => $id]);
    $fila = $st->fetch(PDO::FETCH_ASSOC);
    if (!$fila) error_respuesta('Correo no encontrado', 404);

    if (!$fila['leido']) {
        $pdo->prepare("UPDATE com_correos_recibidos SET leido = 1 WHERE id = :id")
            ->execute([':id' => $id]);
        $fila['leido'] = 1;
    }

    $fila['adjuntos'] = listar_adjuntos_recibidos($id);
    ok($fila);
}

// ── ADJUNTOS ──────────────────────────────────────────────
if ($accion === 'adjuntos') {
    $id = (int)($_GET['id'] ?? 0);
    if (!$id) error_respuesta('ID requerido');
    ok(listar_adjuntos_recibidos($id));
}

// ── DESCARGAR ─────────────────────────────────────────────
if ($accion === 'descargar') {
    $id      = (int)($_GET['id'] ?? 0);
    $archivo = basename($_GET['archivo'] ?? '');
    if (!$id || !$archivo) error_respuesta('ID y archivo requeridos');

    $ruta = DIR_ADJUNTOS_RECIBIDOS . $id . '/' . $archivo;
    if (!file_exists($ruta)) error_respuesta('Archivo no encontrado', 404);

    $existe = $pdo->prepare("SELECT id FROM com_correos_recibidos WHERE id=:id AND eliminado=0");
    $existe->execute([':id' => $id]);
    if (!$existe->fetch()) error_respuesta('Correo no encontrado', 404);

    $mime = mime_content_type($ruta) ?: 'application/octet-stream';
    header('Content-Type: '        . $mime);
    header('Content-Disposition: attachment; filename="' . $archivo . '"');
    header('Content-Length: '      . filesize($ruta));
    header('Cache-Control: private');
    readfile($ruta);
    exit;
}

// ── MARCAR LEÍDO ──────────────────────────────────────────
if ($accion === 'marcar_leido') {
    $id = int_in('id');
    if (!$id) error_respuesta('ID requerido');
    $pdo->prepare("UPDATE com_correos_recibidos SET leido=1 WHERE id=:id")->execute([':id'=>$id]);
    ok();
}

// ── MARCAR SPAM ───────────────────────────────────────────
if ($accion === 'marcar_spam') {
    $id = int_in('id');
    if (!$id) error_respuesta('ID requerido');
    $pdo->prepare("UPDATE com_correos_recibidos SET es_spam=1 WHERE id=:id")->execute([':id'=>$id]);
    ok();
}

// ── RESTAURAR ─────────────────────────────────────────────
if ($accion === 'restaurar') {
    $id = int_in('id');
    if (!$id) error_respuesta('ID requerido');
    $pdo->prepare("UPDATE com_correos_recibidos SET es_spam=0 WHERE id=:id")->execute([':id'=>$id]);
    ok();
}

// ── ELIMINAR ──────────────────────────────────────────────
if ($accion === 'eliminar') {
    $id = int_in('id');
    if (!$id) error_respuesta('ID requerido');
    $pdo->prepare("UPDATE com_correos_recibidos SET eliminado=1 WHERE id=:id")->execute([':id'=>$id]);
    ok();
}

// ── ELIMINAR MASIVO ───────────────────────────────────────
if ($accion === 'eliminar_masivo') {
    $ids = array_filter(array_map('intval', (array)campo('ids', [])));
    if (!$ids) error_respuesta('IDs requeridos');
    $ph = implode(',', array_fill(0, count($ids), '?'));
    $pdo->prepare("UPDATE com_correos_recibidos SET eliminado=1 WHERE id IN ($ph)")
        ->execute(array_values($ids));
    ok(['eliminados' => count($ids)]);
}

// ── VACIAR SPAM ───────────────────────────────────────────
if ($accion === 'vaciar_spam') {
    $ids = $pdo->query("SELECT id FROM com_correos_recibidos WHERE es_spam=1")
               ->fetchAll(PDO::FETCH_COLUMN);
    foreach ($ids as $sid) {
        $dir = DIR_ADJUNTOS_RECIBIDOS . $sid . '/';
        if (is_dir($dir)) { array_map('unlink', glob($dir.'*')); rmdir($dir); }
    }
    $pdo->exec("DELETE FROM com_correos_recibidos WHERE es_spam=1");
    ok(['eliminados' => count($ids)]);
}

// ── RECIBIR (formularios externos / webhook) ──────────────
if ($accion === 'recibir') {
    $de_nombre = str_in('de_nombre');
    $de_email  = str_in('de_email');
    $asunto    = str_in('asunto');
    $cuerpo    = trim((string)campo('cuerpo'));
    $tipo      = str_in('tipo');

    if (!$de_email || !$asunto) error_respuesta('de_email y asunto son obligatorios');
    if (!in_array($tipo, ['transaccional','consulta','promo','otro'])) $tipo = 'consulta';

    $dominio = strtolower(substr($de_email, strpos($de_email,'@')+1));
    $stSpam  = $pdo->prepare("SELECT id FROM com_spam_dominios WHERE dominio=:d");
    $stSpam->execute([':d' => $dominio]);
    $es_spam = $stSpam->fetch() ? 1 : 0;

    $pdo->prepare(
        "INSERT INTO com_correos_recibidos (de_nombre,de_email,asunto,cuerpo,tipo,es_spam)
         VALUES (:dn,:de,:as,:cu,:ti,:sp)"
    )->execute([
        ':dn' => $de_nombre, ':de' => $de_email, ':as' => $asunto,
        ':cu' => $cuerpo,    ':ti' => $tipo,      ':sp' => $es_spam,
    ]);
    $nuevo_id = (int)$pdo->lastInsertId();
    ok(['id' => $nuevo_id, 'es_spam' => (bool)$es_spam,
        'adjuntos' => guardar_adjuntos_recibidos($nuevo_id)]);
}

error_respuesta('Acción no reconocida', 404);

// ── Helpers ───────────────────────────────────────────────
function listar_adjuntos_recibidos(int $id): array
{
    $dir = DIR_ADJUNTOS_RECIBIDOS . $id . '/';
    if (!is_dir($dir)) return [];
    $out = [];
    foreach (glob($dir . '*') as $ruta) {
        $out[] = ['nombre' => basename($ruta),
                  'tam_kb' => round(filesize($ruta)/1024, 1),
                  'mime'   => mime_content_type($ruta)];
    }
    return $out;
}

function guardar_adjuntos_recibidos(int $id): array
{
    if (empty($_FILES['archivos'])) return [];
    $dir = DIR_ADJUNTOS_RECIBIDOS . $id . '/';
    if (!is_dir($dir)) mkdir($dir, 0755, true);

    $guardados = [];
    $archivos  = $_FILES['archivos'];
    if (!is_array($archivos['name']))
        $archivos = array_map(fn($v) => [$v], $archivos);

    foreach ($archivos['name'] as $i => $nombre) {
        if ($archivos['error'][$i] !== UPLOAD_ERR_OK) continue;
        if ($archivos['size'][$i]  > MAX_ADJUNTO_MB * 1024 * 1024) continue;
        $ext = strtolower(pathinfo($nombre, PATHINFO_EXTENSION));
        if (!in_array($ext, TIPOS_PERMITIDOS)) continue;
        $ns = preg_replace('/[^a-zA-Z0-9._-]/', '_', $nombre);
        $dest = $dir . $ns;
        if (file_exists($dest)) $ns = time() . '_' . $ns;
        if (move_uploaded_file($archivos['tmp_name'][$i], $dir . $ns))
            $guardados[] = $ns;
    }
    return $guardados;
}