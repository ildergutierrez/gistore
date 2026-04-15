<?php
// ============================================================
//  gistore/admin/server/backend/correos_borradores.php
//  Borradores de correo  →  tabla: com_correos_borradores
//
//  GET  accion=listar
//  GET  accion=ver     &id=N
//  POST accion=guardar  (crea si id=0, actualiza si id>0)
//  POST accion=eliminar id=N
// ============================================================

require_once __DIR__ . '/_helpers.php';
validar_token();
validar_sesion_admin();

$pdo    = conectar();
$accion = accion();

// ── LISTAR ────────────────────────────────────────────────
if ($accion === 'listar') {
    $filas = $pdo->query(
        "SELECT id, asunto, para_email, es_masivo, grupo_destino,
                DATE_FORMAT(actualizado_en, '%d %b %Y %H:%i') AS fecha
           FROM com_correos_borradores
          ORDER BY actualizado_en DESC"
    )->fetchAll(PDO::FETCH_ASSOC);
    ok($filas);
}

// ── VER ───────────────────────────────────────────────────
if ($accion === 'ver') {
    $id = (int)($_GET['id'] ?? 0);
    if (!$id) error_respuesta('ID requerido');
    $st = $pdo->prepare("SELECT * FROM com_correos_borradores WHERE id = :id");
    $st->execute([':id' => $id]);
    $fila = $st->fetch(PDO::FETCH_ASSOC);
    if (!$fila) error_respuesta('Borrador no encontrado', 404);
    ok($fila);
}

// ── GUARDAR ───────────────────────────────────────────────
if ($accion === 'guardar') {
    $id            = int_in('id');
    $asunto        = str_in('asunto');
    $cuerpo        = trim((string)campo('cuerpo'));
    $para_email    = str_in('para_email');
    $es_masivo     = (int)(bool)campo('es_masivo', false);
    $grupo_destino = str_in('grupo_destino');
    $plantilla_id  = int_in('plantilla_id') ?: null;

    if ($id > 0) {
        $pdo->prepare(
            "UPDATE com_correos_borradores
                SET asunto = :asunto, cuerpo = :cuerpo, para_email = :para_email,
                    es_masivo = :masivo, grupo_destino = :grupo, plantilla_id = :pid
              WHERE id = :id"
        )->execute([
            ':asunto'    => $asunto,
            ':cuerpo'    => $cuerpo,
            ':para_email'=> $para_email,
            ':masivo'    => $es_masivo,
            ':grupo'     => $grupo_destino,
            ':pid'       => $plantilla_id,
            ':id'        => $id,
        ]);
        ok(['id' => $id, 'accion' => 'actualizado']);
    } else {
        $pdo->prepare(
            "INSERT INTO com_correos_borradores
               (asunto, cuerpo, para_email, es_masivo, grupo_destino, plantilla_id)
             VALUES (:asunto, :cuerpo, :para_email, :masivo, :grupo, :pid)"
        )->execute([
            ':asunto'    => $asunto,
            ':cuerpo'    => $cuerpo,
            ':para_email'=> $para_email,
            ':masivo'    => $es_masivo,
            ':grupo'     => $grupo_destino,
            ':pid'       => $plantilla_id,
        ]);
        ok(['id' => (int)$pdo->lastInsertId(), 'accion' => 'creado']);
    }
}

// ── ELIMINAR ──────────────────────────────────────────────
if ($accion === 'eliminar') {
    $id = int_in('id');
    if (!$id) error_respuesta('ID requerido');
    $pdo->prepare("DELETE FROM com_correos_borradores WHERE id = :id")
        ->execute([':id' => $id]);
    ok(['eliminado' => $id]);
}

error_respuesta('Acción no reconocida', 404);