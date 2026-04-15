<?php
// ============================================================
//  gistore/admin/server/backend/cuentas.php  — VERSIÓN COMPLETA
//  CRUD de cuentas SMTP + campos IMAP
//  tabla: com_smtp_cuentas
//
//  GET  accion=listar
//  POST accion=guardar       (crear o editar — incluye campos IMAP)
//  POST accion=eliminar
//  POST accion=hacer_principal
//  POST accion=probar        (test SMTP)
//  POST accion=probar_imap   (test conexión IMAP)
// ============================================================

require_once __DIR__ . '/_helpers.php';
validar_token();
validar_sesion_admin();

$pdo    = conectar();
$accion = accion();

define('SMTP_CIPHER', 'AES-256-CBC');

function smtp_cifrar(string $plain): string
{
    if (!$plain) return '';
    $key = hash('sha256', $_SERVER['SERVER_NAME'] . 'gi_smtp_secret', true);
    $iv  = random_bytes(16);
    return base64_encode($iv . openssl_encrypt($plain, SMTP_CIPHER, $key, 0, $iv));
}
function smtp_descifrar(string $cifrado): string
{
    if (!$cifrado) return '';
    $key  = hash('sha256', $_SERVER['SERVER_NAME'] . 'gi_smtp_secret', true);
    $blob = base64_decode($cifrado);
    if (strlen($blob) < 17) return '';
    return (string)openssl_decrypt(substr($blob, 16), SMTP_CIPHER, $key, 0, substr($blob, 0, 16));
}

// ── LISTAR ────────────────────────────────────────────────
if ($accion === 'listar') {
    $filas = $pdo->query(
        "SELECT *
           FROM com_smtp_cuentas
          ORDER BY principal DESC, id ASC"
    )->fetchAll(PDO::FETCH_ASSOC);
    ok($filas);
}

// ── GUARDAR ───────────────────────────────────────────────
if ($accion === 'guardar') {
    $id          = int_in('id');
    $nombre      = str_in('nombre');
    $email       = str_in('email');
    $remitente   = str_in('remitente') ?: $nombre;
    $host        = str_in('host');
    $puerto      = int_in('puerto', 587);
    $usuario     = str_in('usuario');
    $password    = str_in('password');
    $ssl         = (int)(bool)campo('ssl', false);
    $principal   = (int)(bool)campo('principal', false);

    // ── Campos IMAP ──────────────────────────────────────
    $imap_host    = str_in('imap_host');
    $imap_puerto  = int_in('imap_puerto', 993);
    $imap_ssl     = (int)(bool)campo('imap_ssl', true);
    $imap_usuario = str_in('imap_usuario');   // si vacío, usará el email
    $imap_activo  = (int)(bool)campo('imap_activo', false);

    if (!$nombre || !$email || !$host || !$puerto)
        error_respuesta('Nombre, email, host y puerto son obligatorios');

    if ($principal)
        $pdo->exec("UPDATE com_smtp_cuentas SET principal = 0");

    if ($id > 0) {
        $sql = "UPDATE com_smtp_cuentas SET
                  nombre = :nombre, email = :email, remitente = :remitente,
                  host = :host, puerto = :puerto, usuario = :usuario, ssl = :ssl,
                  principal = :principal,
                  imap_host = :imap_host, imap_puerto = :imap_puerto,
                  imap_ssl  = :imap_ssl,  imap_usuario = :imap_usuario,
                  imap_activo = :imap_activo
                  " . ($password ? ", password = :password" : "") . "
                WHERE id = :id";
        $st = $pdo->prepare($sql);
        $st->bindValue(':nombre',       $nombre);
        $st->bindValue(':email',        $email);
        $st->bindValue(':remitente',    $remitente);
        $st->bindValue(':host',         $host);
        $st->bindValue(':puerto',       $puerto,      PDO::PARAM_INT);
        $st->bindValue(':usuario',      $usuario);
        $st->bindValue(':ssl',          $ssl,         PDO::PARAM_INT);
        $st->bindValue(':principal',    $principal,   PDO::PARAM_INT);
        $st->bindValue(':imap_host',    $imap_host);
        $st->bindValue(':imap_puerto',  $imap_puerto, PDO::PARAM_INT);
        $st->bindValue(':imap_ssl',     $imap_ssl,    PDO::PARAM_INT);
        $st->bindValue(':imap_usuario', $imap_usuario);
        $st->bindValue(':imap_activo',  $imap_activo, PDO::PARAM_INT);
        $st->bindValue(':id',           $id,          PDO::PARAM_INT);
        if ($password) $st->bindValue(':password', smtp_cifrar($password));
        $st->execute();
        ok(['id' => $id, 'accion' => 'actualizado']);
    } else {
        if (!$password) error_respuesta('La contraseña es obligatoria al crear');
        $pdo->prepare(
            "INSERT INTO com_smtp_cuentas
               (nombre, email, remitente, host, puerto, usuario, password, ssl, principal,
                imap_host, imap_puerto, imap_ssl, imap_usuario, imap_activo)
             VALUES
               (:nombre, :email, :remitente, :host, :puerto, :usuario, :password, :ssl, :principal,
                :imap_host, :imap_puerto, :imap_ssl, :imap_usuario, :imap_activo)"
        )->execute([
            ':nombre'       => $nombre,
            ':email'        => $email,
            ':remitente'    => $remitente,
            ':host'         => $host,
            ':puerto'       => $puerto,
            ':usuario'      => $usuario,
            ':password'     => smtp_cifrar($password),
            ':ssl'          => $ssl,
            ':principal'    => $principal,
            ':imap_host'    => $imap_host,
            ':imap_puerto'  => $imap_puerto,
            ':imap_ssl'     => $imap_ssl,
            ':imap_usuario' => $imap_usuario,
            ':imap_activo'  => $imap_activo,
        ]);
        ok(['id' => (int)$pdo->lastInsertId(), 'accion' => 'creado']);
    }
}

// ── HACER PRINCIPAL ───────────────────────────────────────
if ($accion === 'hacer_principal') {
    $id = int_in('id');
    if (!$id) error_respuesta('ID requerido');
    $pdo->exec("UPDATE com_smtp_cuentas SET principal = 0");
    $pdo->prepare("UPDATE com_smtp_cuentas SET principal = 1 WHERE id = :id")->execute([':id' => $id]);
    ok(['id' => $id]);
}

// ── ELIMINAR ──────────────────────────────────────────────
if ($accion === 'eliminar') {
    $id = int_in('id');
    if (!$id) error_respuesta('ID requerido');
    $pdo->prepare("DELETE FROM com_smtp_cuentas WHERE id = :id")->execute([':id' => $id]);
    ok(['eliminado' => $id]);
}

// ── PROBAR SMTP ───────────────────────────────────────────
if ($accion === 'probar') {
    $id = int_in('id');
    if (!$id) error_respuesta('ID requerido');
    $fila = $pdo->prepare("SELECT * FROM com_smtp_cuentas WHERE id = :id");
    $fila->execute([':id' => $id]);
    $c = $fila->fetch(PDO::FETCH_ASSOC);
    if (!$c) error_respuesta('Cuenta no encontrada', 404);

    require_once __DIR__ . '/../../../../vendor/autoload.php';
    $mail = new PHPMailer\PHPMailer\PHPMailer(true);
    try {
        $mail->isSMTP();
        $mail->Host       = $c['host'];
        $mail->Port       = (int)$c['puerto'];
        $mail->SMTPAuth   = true;
        $mail->Username   = $c['usuario'];
        $mail->Password   = smtp_descifrar($c['password']);
        $mail->SMTPSecure = $c['ssl']
            ? PHPMailer\PHPMailer\PHPMailer::ENCRYPTION_SMTPS
            : PHPMailer\PHPMailer\PHPMailer::ENCRYPTION_STARTTLS;
        $mail->SMTPDebug  = 0;
        $mail->smtpConnect();
        $mail->smtpClose();
        $pdo->prepare("UPDATE com_smtp_cuentas SET estado='ok' WHERE id=:id")->execute([':id'=>$id]);
        ok(['estado' => 'ok']);
    } catch (\Exception $e) {
        $pdo->prepare("UPDATE com_smtp_cuentas SET estado='error' WHERE id=:id")->execute([':id'=>$id]);
        error_respuesta('Error SMTP: ' . $e->getMessage());
    }
}

// ── PROBAR IMAP ───────────────────────────────────────────
if ($accion === 'probar_imap') {
    $id = int_in('id');
    if (!$id) error_respuesta('ID requerido');

    if (!function_exists('imap_open'))
        error_respuesta('Extensión PHP IMAP no instalada en el servidor. Ejecuta: sudo apt install php-imap && sudo phpenmod imap', 500);

    $fila = $pdo->prepare("SELECT * FROM com_smtp_cuentas WHERE id = :id");
    $fila->execute([':id' => $id]);
    $c = $fila->fetch(PDO::FETCH_ASSOC);
    if (!$c) error_respuesta('Cuenta no encontrada', 404);

    if (!$c['imap_host']) error_respuesta('Host IMAP no configurado para esta cuenta');

    $flags   = $c['imap_ssl'] ? '/ssl/novalidate-cert' : '/notls/novalidate-cert';
    $mailbox = "{{$c['imap_host']}:{$c['imap_puerto']}/imap{$flags}}INBOX";
    $usuario = $c['imap_usuario'] ?: $c['email'];
    $pass    = smtp_descifrar($c['password']);

    $imap = @imap_open($mailbox, $usuario, $pass, OP_READONLY, 1);
    if (!$imap) {
        $err = imap_last_error();
        error_respuesta('Error IMAP: ' . ($err ?: 'No se pudo conectar'));
    }

    $n = imap_num_msg($imap);
    imap_close($imap);
    ok(['estado' => 'ok', 'mensajes_en_inbox' => $n]);
}

error_respuesta('Acción no reconocida', 404);