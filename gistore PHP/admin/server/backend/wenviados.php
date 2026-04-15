<?php
// ============================================================
//  gistore/admin/server/backend/wenviados.php
//  Envío de WhatsApp (individual / masivo) + historial
//  tablas: com_wa_envios, com_wa_envio_detalle, com_wa_config
//
//  GET  accion=listar   [&tipo=] [&status=] [&q=]
//  GET  accion=ver      &id=N
//  POST accion=enviar   (individual o masivo)
// ============================================================

require_once __DIR__ . '/_helpers.php';
validar_token();
validar_sesion_admin();

$pdo    = conectar();
$accion = accion();

// ── LISTAR ────────────────────────────────────────────────
if ($accion === 'listar') {
    $tipo   = trim($_GET['tipo']   ?? '');
    $status = trim($_GET['status'] ?? '');
    $q      = trim($_GET['q']      ?? '');
    $pagina = max(1, (int)($_GET['pagina'] ?? 1));
    $pp     = 25;

    $where  = ['1=1'];
    $params = [];

    if (in_array($tipo, ['masivo', 'individual'])) {
        $where[]        = 'tipo = :tipo';
        $params[':tipo'] = $tipo;
    }
    if (in_array($status, ['ok', 'parcial', 'fail'])) {
        $where[]           = 'status = :status';
        $params[':status']  = $status;
    }
    if ($q) {
        $where[]   = '(grupo_destino LIKE :q OR mensaje LIKE :q OR telefono LIKE :q)';
        $params[':q'] = "%$q%";
    }

    $cond = implode(' AND ', $where);
    $stC  = $pdo->prepare("SELECT COUNT(*) FROM com_wa_envios WHERE $cond");
    $stC->execute($params);
    $total = (int)$stC->fetchColumn();

    $st = $pdo->prepare(
        "SELECT id, tipo, grupo_destino, telefono, mensaje,
                total_dest, total_ok, total_fail, status,
                DATE_FORMAT(enviado_en,'%d %b %Y %H:%i') AS fecha
           FROM com_wa_envios
          WHERE $cond
          ORDER BY enviado_en DESC
          LIMIT :lim OFFSET :off"
    );
    foreach ($params as $k => $v) $st->bindValue($k, $v);
    $st->bindValue(':lim', $pp,               PDO::PARAM_INT);
    $st->bindValue(':off', ($pagina-1) * $pp, PDO::PARAM_INT);
    $st->execute();

    ok(['total' => $total, 'pagina' => $pagina, 'envios' => $st->fetchAll(PDO::FETCH_ASSOC)]);
}

// ── VER (con detalle por número) ──────────────────────────
if ($accion === 'ver') {
    $id = (int)($_GET['id'] ?? 0);
    if (!$id) error_respuesta('ID requerido');

    $st = $pdo->prepare(
        "SELECT *, DATE_FORMAT(enviado_en,'%d %b %Y %H:%i') AS fecha
           FROM com_wa_envios WHERE id = :id"
    );
    $st->execute([':id' => $id]);
    $envio = $st->fetch(PDO::FETCH_ASSOC);
    if (!$envio) error_respuesta('Envío no encontrado', 404);

    $detalle = $pdo->prepare(
        "SELECT telefono, nombre, status, error_msg,
                DATE_FORMAT(enviado_en,'%H:%i') AS hora
           FROM com_wa_envio_detalle
          WHERE envio_id = :id ORDER BY id ASC"
    );
    $detalle->execute([':id' => $id]);
    $envio['detalle'] = $detalle->fetchAll(PDO::FETCH_ASSOC);

    ok($envio);
}

// ── ENVIAR ────────────────────────────────────────────────
if ($accion === 'enviar') {
    $cfg = wa_config($pdo);
    if (!$cfg) error_respuesta('Configura la API de WhatsApp primero');

    $tipo        = str_in('tipo');   // individual | masivo
    $mensaje_raw = trim((string)campo('mensaje'));
    $plantilla_id = int_in('plantilla_id') ?: null;

    if (!$mensaje_raw) error_respuesta('El mensaje es obligatorio');
    if (!in_array($tipo, ['individual', 'masivo']))
        error_respuesta('tipo debe ser individual o masivo');

    if ($tipo === 'individual') {
        // ── Individual ────────────────────────────────────
        $telefono = str_in('telefono');
        $nombre   = str_in('nombre');
        if (!$telefono) error_respuesta('Número de teléfono requerido');

        $dest = ['nombre' => $nombre, 'tienda' => '', 'plan' => '',
                 'email' => '', 'fecha' => date('d/m/Y')];
        $msg  = personalizar($mensaje_raw, $dest);

        $resp = wa_send_text($cfg, $telefono, $msg);
        $ok   = !isset($resp['error']);

        $envio_id = insertar_envio($pdo, [
            'tipo'       => 'individual',
            'grupo'      => $nombre ?: $telefono,
            'telefono'   => $telefono,
            'plantilla'  => $plantilla_id,
            'mensaje'    => $mensaje_raw,
            'total'      => 1,
            'ok'         => $ok ? 1 : 0,
            'fail'       => $ok ? 0 : 1,
            'status'     => $ok ? 'ok' : 'fail',
        ]);

        insertar_detalle($pdo, $envio_id, $telefono, $nombre,
            $ok ? 'ok' : 'fail',
            $ok ? '' : ($resp['error']['message'] ?? 'Error desconocido'));

        if ($plantilla_id) incrementar_uso($pdo, $plantilla_id);
        ok(['id' => $envio_id, 'status' => $ok ? 'ok' : 'fail',
            'mensaje_api' => $resp['error']['message'] ?? null]);

    } else {
        // ── Masivo ────────────────────────────────────────
        $grupo      = str_in('grupo_destino');
        $emails_raw = str_in('telefonos_manual');

        $destinatarios = resolver_destinatarios($pdo, $grupo, $emails_raw);
        if (!$destinatarios) error_respuesta('No se encontraron destinatarios');

        $ok_n = 0; $fail_n = 0; $detalles_tmp = [];

        foreach ($destinatarios as $d) {
            $msg  = personalizar($mensaje_raw, $d);
            $resp = wa_send_text($cfg, $d['whatsapp'] ?? $d['telefono'] ?? '', $msg);
            $es_ok = !isset($resp['error']);
            $es_ok ? $ok_n++ : $fail_n++;
            $detalles_tmp[] = [
                'tel'    => $d['whatsapp'] ?? $d['telefono'] ?? '',
                'nombre' => $d['nombre'] ?? '',
                'status' => $es_ok ? 'ok' : 'fail',
                'error'  => $es_ok ? '' : ($resp['error']['message'] ?? ''),
            ];
        }

        $status_global = $fail_n === 0 ? 'ok' : ($ok_n === 0 ? 'fail' : 'parcial');

        $envio_id = insertar_envio($pdo, [
            'tipo'      => 'masivo',
            'grupo'     => $grupo ?: 'Lista manual',
            'telefono'  => '',
            'plantilla' => $plantilla_id,
            'mensaje'   => $mensaje_raw,
            'total'     => count($destinatarios),
            'ok'        => $ok_n,
            'fail'      => $fail_n,
            'status'    => $status_global,
        ]);

        foreach ($detalles_tmp as $det) {
            insertar_detalle($pdo, $envio_id, $det['tel'], $det['nombre'],
                             $det['status'], $det['error']);
        }

        if ($plantilla_id) incrementar_uso($pdo, $plantilla_id);
        ok([
            'id'       => $envio_id,
            'enviados' => $ok_n,
            'fallidos' => $fail_n,
            'status'   => $status_global,
        ]);
    }
}

error_respuesta('Acción no reconocida', 404);

// ── Helpers ───────────────────────────────────────────────
function wa_config(PDO $pdo): array|false
{
    return $pdo->query("SELECT * FROM com_wa_config WHERE id = 1 AND activo = 1")
               ->fetch(PDO::FETCH_ASSOC);
}

function wa_send_text(array $cfg, string $telefono, string $mensaje): array
{
    if (!$telefono) return ['error' => ['message' => 'Número vacío']];
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
        'timeout'       => 12,
        'ignore_errors' => true,
    ]]);
    $body = @file_get_contents($url, false, $ctx);
    return json_decode($body ?: '{}', true) ?? [];
}

function personalizar(string $texto, array $d): string
{
    return str_replace(
        ['[nombre]', '[tienda]', '[plan]', '[email]', '[fecha]'],
        [$d['nombre'] ?? '', $d['tienda'] ?? '', $d['plan'] ?? '',
         $d['email']  ?? '', date('d/m/Y')],
        $texto
    );
}

function resolver_destinatarios(PDO $pdo, string $grupo, string $raw): array
{
    if ($raw) {
        $lista = [];
        foreach (explode(',', $raw) as $t) {
            $t = trim($t);
            if ($t) $lista[] = ['whatsapp' => $t, 'nombre' => '', 'tienda' => '', 'plan' => ''];
        }
        return $lista;
    }
    $sql = match ($grupo) {
        'todos'        => "SELECT whatsapp, nombre, nombre AS tienda, '' AS plan
                            FROM vendedores WHERE estado != 'desactivado' AND whatsapp != ''",
        'activos'      => "SELECT whatsapp, nombre, nombre AS tienda, '' AS plan
                            FROM vendedores WHERE estado = 'activo' AND whatsapp != ''",
        'inactivos'    => "SELECT whatsapp, nombre, nombre AS tienda, '' AS plan
                            FROM vendedores WHERE estado = 'inactivo' AND whatsapp != ''",
        'plan-basico'  => "SELECT v.whatsapp, v.nombre, v.nombre AS tienda, pm.nombre AS plan
                            FROM vendedores v
                            JOIN membresias m ON m.vendedor_id = v.id AND m.estado='activo'
                            JOIN planes_membresia pm ON pm.id = m.plan_id
                           WHERE pm.nombre LIKE '%bás%' AND v.whatsapp != ''",
        'plan-pro'     => "SELECT v.whatsapp, v.nombre, v.nombre AS tienda, pm.nombre AS plan
                            FROM vendedores v
                            JOIN membresias m ON m.vendedor_id = v.id AND m.estado='activo'
                            JOIN planes_membresia pm ON pm.id = m.plan_id
                           WHERE pm.nombre LIKE '%pro%' AND v.whatsapp != ''",
        'plan-premium' => "SELECT v.whatsapp, v.nombre, v.nombre AS tienda, pm.nombre AS plan
                            FROM vendedores v
                            JOIN membresias m ON m.vendedor_id = v.id AND m.estado='activo'
                            JOIN planes_membresia pm ON pm.id = m.plan_id
                           WHERE pm.nombre LIKE '%prem%' AND v.whatsapp != ''",
        default        => null,
    };
    return $sql ? $pdo->query($sql)->fetchAll(PDO::FETCH_ASSOC) : [];
}

function insertar_envio(PDO $pdo, array $d): int
{
    $pdo->prepare(
        "INSERT INTO com_wa_envios
           (tipo, grupo_destino, telefono, plantilla_id, mensaje,
            total_dest, total_ok, total_fail, status)
         VALUES (:tipo, :grupo, :tel, :pid, :msg, :total, :ok, :fail, :status)"
    )->execute([
        ':tipo'   => $d['tipo'],
        ':grupo'  => $d['grupo'],
        ':tel'    => $d['telefono'],
        ':pid'    => $d['plantilla'],
        ':msg'    => $d['mensaje'],
        ':total'  => $d['total'],
        ':ok'     => $d['ok'],
        ':fail'   => $d['fail'],
        ':status' => $d['status'],
    ]);
    return (int)$pdo->lastInsertId();
}

function insertar_detalle(PDO $pdo, int $envio_id, string $tel, string $nom,
                          string $status, string $error): void
{
    $pdo->prepare(
        "INSERT INTO com_wa_envio_detalle (envio_id, telefono, nombre, status, error_msg)
         VALUES (:eid, :tel, :nom, :st, :err)"
    )->execute([
        ':eid' => $envio_id,
        ':tel' => $tel,
        ':nom' => $nom,
        ':st'  => $status,
        ':err' => $error,
    ]);
}

function incrementar_uso(PDO $pdo, int $pid): void
{
    $pdo->prepare("UPDATE com_plantillas SET usos = usos + 1 WHERE id = :id")
        ->execute([':id' => $pid]);
}