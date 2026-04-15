<?php
// ============================================================
//  gistore/admin/server/backend/spam_dominios.php
//  Gestión de dominios bloqueados  →  tabla: com_spam_dominios
//
//  GET  accion=listar
//  POST accion=agregar   dominio=spam.com
//  POST accion=eliminar  id=N
// ============================================================

require_once __DIR__ . '/_helpers.php';
validar_token();
validar_sesion_admin();

$pdo    = conectar();
$accion = accion();

// ── LISTAR ────────────────────────────────────────────────
if ($accion === 'listar') {
    $filas = $pdo->query(
        "SELECT id, dominio, DATE_FORMAT(bloqueado_en,'%d %b %Y') AS fecha
           FROM com_spam_dominios ORDER BY dominio ASC"
    )->fetchAll(PDO::FETCH_ASSOC);
    ok($filas);
}

// ── AGREGAR ───────────────────────────────────────────────
if ($accion === 'agregar') {
    $dominio = strtolower(trim(str_replace('@', '', str_in('dominio'))));
    if (!$dominio) error_respuesta('Dominio requerido');

    try {
        $pdo->prepare("INSERT INTO com_spam_dominios (dominio) VALUES (:d)")
            ->execute([':d' => $dominio]);
        ok(['id' => (int)$pdo->lastInsertId(), 'dominio' => $dominio]);
    } catch (\PDOException $e) {
        if (str_contains($e->getMessage(), '1062')) // Duplicate
            error_respuesta('El dominio ya está bloqueado');
        throw $e;
    }
}

// ── ELIMINAR ──────────────────────────────────────────────
if ($accion === 'eliminar') {
    $id = int_in('id');
    if (!$id) error_respuesta('ID requerido');
    $pdo->prepare("DELETE FROM com_spam_dominios WHERE id = :id")
        ->execute([':id' => $id]);
    ok(['eliminado' => $id]);
}

error_respuesta('Acción no reconocida', 404);