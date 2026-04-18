<?php
// ============================================================
//  gistore/admin/server/backend/wenvio_detalle.php
//  Detalle de entregas por número de un envío masivo WA
//  tabla: com_wa_envio_detalle
//
//  GET  accion=listar  &envio_id=N  [&status=ok|fail]
// ============================================================

require_once __DIR__ . '/_helpers.php';
validar_token();
validar_sesion_admin();

$pdo    = conectar();
$accion = accion();

if ($accion === 'listar') {
    $envio_id = (int)($_GET['envio_id'] ?? 0);
    if (!$envio_id) error_respuesta('envio_id requerido');

    $status = trim($_GET['status'] ?? '');
    $where  = ['envio_id = :eid'];
    $params = [':eid' => $envio_id];

    if (in_array($status, ['ok', 'fail'])) {
        $where[]          = 'status = :status';
        $params[':status'] = $status;
    }

    $cond = implode(' AND ', $where);
    $st   = $pdo->prepare(
        "SELECT id, telefono, nombre, status, error_msg,
                DATE_FORMAT(enviado_en,'%d %b %Y %H:%i') AS fecha
           FROM com_wa_envio_detalle
          WHERE $cond
          ORDER BY id ASC"
    );
    $st->execute($params);
    ok($st->fetchAll(PDO::FETCH_ASSOC));
}

error_respuesta('Acción no reconocida', 404);