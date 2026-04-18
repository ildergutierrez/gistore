<?php
// ============================================================
//  gistore/admin/server/backend/plantillas.php
//  CRUD de plantillas de correo y WhatsApp
//  tabla: com_plantillas
//
//  GET  accion=listar   [&canal=correo|whatsapp] [&categoria=...]
//  POST accion=guardar  (crea o edita según id)
//  POST accion=eliminar
//  POST accion=incrementar_uso  (suma 1 al contador de usos)
// ============================================================

require_once __DIR__ . '/_helpers.php';
validar_token();
validar_sesion_admin();

$pdo    = conectar();
$accion = accion();

// ── LISTAR ────────────────────────────────────────────────
if ($accion === 'listar') {
    $where  = ['activo = 1'];
    $params = [];

    $canal = trim($_GET['canal'] ?? '');
    if (in_array($canal, ['correo', 'whatsapp'])) {
        $where[]          = 'canal = :canal';
        $params[':canal'] = $canal;
    }

    $cat = trim($_GET['categoria'] ?? '');
    if (in_array($cat, ['transaccional', 'promo', 'informativo'])) {
        $where[]         = 'categoria = :categoria';
        $params[':cat']  = $cat;
    }

    $sql  = "SELECT id, nombre, canal, categoria, asunto, cuerpo, usos,
                    DATE_FORMAT(creado_en, '%d %b %Y') AS fecha
               FROM com_plantillas
              WHERE " . implode(' AND ', $where) . "
              ORDER BY usos DESC, id DESC";
    $st   = $pdo->prepare($sql);
    $st->execute($params);
    ok($st->fetchAll(PDO::FETCH_ASSOC));
}

// ── GUARDAR ───────────────────────────────────────────────
if ($accion === 'guardar') {
    $id        = int_in('id');
    $nombre    = str_in('nombre');
    $canal     = str_in('canal');
    $categoria = str_in('categoria');
    $asunto    = str_in('asunto');
    $cuerpo    = trim((string)campo('cuerpo'));

    if (!$nombre || !$cuerpo)
        error_respuesta('Nombre y cuerpo son obligatorios');

    if (!in_array($canal, ['correo', 'whatsapp']))
        error_respuesta('Canal debe ser correo o whatsapp');

    if (!in_array($categoria, ['transaccional', 'promo', 'informativo']))
        error_respuesta('Categoría inválida');

    if ($id > 0) {
        $pdo->prepare(
            "UPDATE com_plantillas
                SET nombre = :nombre, canal = :canal, categoria = :categoria,
                    asunto = :asunto, cuerpo = :cuerpo
              WHERE id = :id"
        )->execute([
            ':nombre'    => $nombre,
            ':canal'     => $canal,
            ':categoria' => $categoria,
            ':asunto'    => $asunto,
            ':cuerpo'    => $cuerpo,
            ':id'        => $id,
        ]);
        ok(['id' => $id, 'accion' => 'actualizado']);
    } else {
        $pdo->prepare(
            "INSERT INTO com_plantillas (nombre, canal, categoria, asunto, cuerpo)
             VALUES (:nombre, :canal, :categoria, :asunto, :cuerpo)"
        )->execute([
            ':nombre'    => $nombre,
            ':canal'     => $canal,
            ':categoria' => $categoria,
            ':asunto'    => $asunto,
            ':cuerpo'    => $cuerpo,
        ]);
        ok(['id' => (int)$pdo->lastInsertId(), 'accion' => 'creado']);
    }
}

// ── ELIMINAR (soft: activo = 0) ───────────────────────────
if ($accion === 'eliminar') {
    $id = int_in('id');
    if (!$id) error_respuesta('ID requerido');
    $pdo->prepare("UPDATE com_plantillas SET activo = 0 WHERE id = :id")
        ->execute([':id' => $id]);
    ok(['eliminado' => $id]);
}

// ── INCREMENTAR USO ───────────────────────────────────────
if ($accion === 'incrementar_uso') {
    $id = int_in('id');
    if (!$id) error_respuesta('ID requerido');
    $pdo->prepare("UPDATE com_plantillas SET usos = usos + 1 WHERE id = :id")
        ->execute([':id' => $id]);
    ok();
}

error_respuesta('Acción no reconocida', 404);