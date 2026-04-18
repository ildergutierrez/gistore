<?php
// ============================================================
//  gistore/admin/server/backend/correo_enviados.php
//  Envío de correos vía PHPMailer.
//  NO guarda en BBDD — solo envía y responde ok/error.
//
//  POST accion=enviar
//       cuenta_id         ← si se omite usa la cuenta principal
//       asunto, cuerpo
//       es_masivo=0|1
//       para_email        ← si individual
//       para_nombre       ← si individual
//       grupo_destino     ← si masivo: todos|activos|inactivos|plan-basico|plan-pro|plan-premium
//       emails_manual     ← si masivo: lista separada por comas
//       plantilla_id      ← opcional, para incrementar contador de usos
//       archivos[]        ← adjuntos (multipart/form-data)
//
//  POST accion=responder
//       cuenta_id, para_email, para_nombre, asunto, cuerpo, archivos[]
// ============================================================

require_once __DIR__ . '/_helpers.php';
validar_token();
validar_sesion_admin();

$pdo    = conectar();
$accion = accion();

define('MAX_ADJ_MB_ENV', 15);
define('TIPOS_ADJ_ENV', ['pdf','doc','docx','xls','xlsx','jpg','jpeg','png','zip','txt','csv','mp4','mp3']);

// ─────────────────────────────────────────────────────────
// ENVIAR
// ─────────────────────────────────────────────────────────
if ($accion === 'enviar' || $accion === 'responder') {
    $cuenta_id   = int_in('cuenta_id');
    $asunto      = str_in('asunto');
    $cuerpo      = trim((string)campo('cuerpo'));
    $es_masivo   = (bool)campo('es_masivo', false);
    $plantilla_id = int_in('plantilla_id');

    if (!$asunto || !$cuerpo)
        error_respuesta('Asunto y cuerpo son obligatorios');

    // Obtener cuenta SMTP
    $smtp = $cuenta_id
        ? smtp_por_id($pdo, $cuenta_id)
        : smtp_principal($pdo);
    if (!$smtp) error_respuesta('No hay cuenta SMTP configurada');

    require_once __DIR__ . '/../../../../vendor/autoload.php';

    // Recoger adjuntos del request (quedan en tmp de PHP, no se guardan)
    $adj_tmp = recoger_adjuntos_tmp();

    if ($es_masivo) {
        $grupo      = str_in('grupo_destino');
        $email_raw  = str_in('emails_manual');
        $destinatarios = resolver_destinatarios($pdo, $grupo, $email_raw);
        if (!$destinatarios) error_respuesta('No se encontraron destinatarios');

        $ok_n = 0; $fail_n = 0; $errores = [];
        foreach ($destinatarios as $dest) {
            try {
                enviar_mail($smtp, $dest['email'], $dest['nombre'] ?? '',
                            personalizar($asunto, $dest),
                            personalizar($cuerpo, $dest),
                            $adj_tmp);
                $ok_n++;
            } catch (\Exception $e) {
                $fail_n++;
                $errores[] = ($dest['email'] ?? '?') . ': ' . $e->getMessage();
            }
        }

        // Limpiar temporales
        foreach ($adj_tmp as $a) @unlink($a['tmp']);

        if ($plantilla_id) incrementar_uso($pdo, $plantilla_id);

        ok(['enviados' => $ok_n, 'fallidos' => $fail_n, 'errores' => $errores]);

    } else {
        $para_email  = str_in('para_email');
        $para_nombre = str_in('para_nombre');
        if (!filter_var($para_email, FILTER_VALIDATE_EMAIL))
            error_respuesta('para_email inválido');

        try {
            enviar_mail($smtp, $para_email, $para_nombre, $asunto, $cuerpo, $adj_tmp);
        } catch (\Exception $e) {
            foreach ($adj_tmp as $a) @unlink($a['tmp']);
            error_respuesta('Error al enviar: ' . $e->getMessage());
        }

        foreach ($adj_tmp as $a) @unlink($a['tmp']);
        if ($plantilla_id) incrementar_uso($pdo, $plantilla_id);

        ok(['enviado' => $para_email]);
    }
}

error_respuesta('Acción no reconocida', 404);

// ── Funciones ─────────────────────────────────────────────

function smtp_principal(PDO $pdo): array|false
{
    return $pdo->query(
        "SELECT id, email, remitente, host, puerto, usuario, password, ssl
           FROM com_smtp_cuentas WHERE principal = 1 LIMIT 1"
    )->fetch(PDO::FETCH_ASSOC);
}

function smtp_por_id(PDO $pdo, int $id): array|false
{
    $st = $pdo->prepare(
        "SELECT id, email, remitente, host, puerto, usuario, password, ssl
           FROM com_smtp_cuentas WHERE id = :id LIMIT 1"
    );
    $st->execute([':id' => $id]);
    return $st->fetch(PDO::FETCH_ASSOC);
}

function smtp_descifrar(string $cifrado): string
{
    if (!$cifrado) return '';
    $key  = hash('sha256', $_SERVER['SERVER_NAME'] . 'gi_smtp_secret', true);
    $blob = base64_decode($cifrado);
    if (strlen($blob) < 17) return '';
    return (string)@openssl_decrypt(substr($blob, 16), 'AES-256-CBC', $key, 0, substr($blob, 0, 16));
}

function enviar_mail(array $smtp, string $to, string $nombre,
                     string $asunto, string $cuerpo, array $adj_tmp): void
{
    $mail = new PHPMailer\PHPMailer\PHPMailer(true);
    $mail->isSMTP();
    $mail->CharSet    = 'UTF-8';
    $mail->Host       = $smtp['host'];
    $mail->Port       = (int)$smtp['puerto'];
    $mail->SMTPAuth   = true;
    $mail->Username   = $smtp['usuario'];
    $mail->Password   = smtp_descifrar($smtp['password']);
    $mail->SMTPSecure = $smtp['ssl']
        ? PHPMailer\PHPMailer\PHPMailer::ENCRYPTION_SMTPS
        : PHPMailer\PHPMailer\PHPMailer::ENCRYPTION_STARTTLS;

    $mail->setFrom($smtp['email'], $smtp['remitente'] ?: $smtp['email']);
    $mail->addAddress($to, $nombre);

    $mail->isHTML(false);
    $mail->Subject = $asunto;
    $mail->Body    = $cuerpo;

    foreach ($adj_tmp as $a) {
        if (file_exists($a['tmp']))
            $mail->addAttachment($a['tmp'], $a['nombre']);
    }

    $mail->send();
}

function personalizar(string $texto, array $dest): string
{
    return str_replace(
        ['[nombre]', '[tienda]', '[plan]', '[email]', '[fecha]'],
        [$dest['nombre'] ?? '', $dest['tienda'] ?? '',
         $dest['plan']   ?? '', $dest['email']  ?? '', date('d/m/Y')],
        $texto
    );
}

function resolver_destinatarios(PDO $pdo, string $grupo, string $raw): array
{
    if ($raw) {
        $lista = [];
        foreach (explode(',', $raw) as $em) {
            $em = trim($em);
            if (filter_var($em, FILTER_VALIDATE_EMAIL))
                $lista[] = ['email' => $em, 'nombre' => '', 'tienda' => '', 'plan' => ''];
        }
        return $lista;
    }
    $sql = match ($grupo) {
        'todos'       => "SELECT correo AS email, nombre, nombre AS tienda, '' AS plan FROM vendedores WHERE estado != 'desactivado'",
        'activos'     => "SELECT correo AS email, nombre, nombre AS tienda, '' AS plan FROM vendedores WHERE estado = 'activo'",
        'inactivos'   => "SELECT correo AS email, nombre, nombre AS tienda, '' AS plan FROM vendedores WHERE estado = 'inactivo'",
        'plan-basico' => "SELECT v.correo AS email, v.nombre, v.nombre AS tienda, pm.nombre AS plan
                            FROM vendedores v JOIN membresias m ON m.vendedor_id=v.id AND m.estado='activo'
                            JOIN planes_membresia pm ON pm.id=m.plan_id WHERE pm.nombre LIKE '%bás%'",
        'plan-pro'    => "SELECT v.correo AS email, v.nombre, v.nombre AS tienda, pm.nombre AS plan
                            FROM vendedores v JOIN membresias m ON m.vendedor_id=v.id AND m.estado='activo'
                            JOIN planes_membresia pm ON pm.id=m.plan_id WHERE pm.nombre LIKE '%pro%'",
        'plan-premium'=> "SELECT v.correo AS email, v.nombre, v.nombre AS tienda, pm.nombre AS plan
                            FROM vendedores v JOIN membresias m ON m.vendedor_id=v.id AND m.estado='activo'
                            JOIN planes_membresia pm ON pm.id=m.plan_id WHERE pm.nombre LIKE '%prem%'",
        default       => null,
    };
    return $sql ? $pdo->query($sql)->fetchAll(PDO::FETCH_ASSOC) : [];
}

function recoger_adjuntos_tmp(): array
{
    if (empty($_FILES['archivos'])) return [];
    $lista    = [];
    $archivos = $_FILES['archivos'];
    if (!is_array($archivos['name']))
        $archivos = array_map(fn($v) => [$v], $archivos);
    foreach ($archivos['name'] as $i => $nombre) {
        if ($archivos['error'][$i] !== UPLOAD_ERR_OK) continue;
        if ($archivos['size'][$i]  > MAX_ADJ_MB_ENV * 1024 * 1024) continue;
        $ext = strtolower(pathinfo($nombre, PATHINFO_EXTENSION));
        if (!in_array($ext, TIPOS_ADJ_ENV)) continue;
        $lista[] = [
            'nombre' => preg_replace('/[^a-zA-Z0-9._\-]/', '_', $nombre),
            'tmp'    => $archivos['tmp_name'][$i],
        ];
    }
    return $lista;
}

function incrementar_uso(PDO $pdo, int $pid): void
{
    $pdo->prepare("UPDATE com_plantillas SET usos = usos + 1 WHERE id = :id")
        ->execute([':id' => $pid]);
}