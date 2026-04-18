<?php
// ============================================================
//  gistore/admin/server/backend/p_bienvenida.php
//  Plantilla de bienvenida al vendedor
//  tabla: com_plantilla_bienvenida
//
//  GET  accion=obtener          ← carga la configuración actual
//  POST accion=guardar          ← guarda cambios
//  POST accion=prueba           ← envía correo de prueba a un email
//  POST accion=enviar_vendedor  ← envía bienvenida a un vendedor recién registrado
//                                  (llamado desde vendedores.php al crear uno)
//
//  Archivos adjuntos fijos:
//    gistore/admin/doc/gistore-politicas.pdf
//    gistore/admin/doc/manuel.pdf
// ============================================================

require_once __DIR__ . '/_helpers.php';
validar_token();
validar_sesion_admin();

$pdo    = conectar();
$accion = accion();

// Ruta de los PDF fijos (relativa a este archivo)
define('DOC_DIR',    __DIR__ . '/../../../admin/doc/');
define('PDF_POLI',   DOC_DIR . 'gistore-politicas.pdf');
define('PDF_MANUAL', DOC_DIR . 'manuel.pdf');

// ── OBTENER ───────────────────────────────────────────────
if ($accion === 'obtener') {
    $fila = $pdo->query("SELECT * FROM com_plantilla_bienvenida WHERE id = 1")->fetch(PDO::FETCH_ASSOC);
    if (!$fila) error_respuesta('Plantilla no encontrada', 404);
    ok($fila);
}

// ── GUARDAR ───────────────────────────────────────────────
if ($accion === 'guardar') {
    $asunto     = str_in('asunto');
    $encabezado = str_in('encabezado');
    $subtitulo  = str_in('subtitulo');
    $cuerpo     = trim((string)campo('cuerpo'));
    $btn_cta    = str_in('btn_cta');
    $color      = str_in('color_header');
    $auto       = (int)(bool)campo('auto_envio', true);

    if (!$asunto || !$cuerpo) error_respuesta('Asunto y cuerpo son obligatorios');

    // UPSERT: actualizar id=1, o insertar si no existe
    $pdo->prepare(
        "INSERT INTO com_plantilla_bienvenida
           (id, asunto, encabezado, subtitulo, cuerpo, btn_cta, color_header, auto_envio)
         VALUES (1, :asunto, :encabezado, :subtitulo, :cuerpo, :btn, :color, :auto)
         ON DUPLICATE KEY UPDATE
           asunto      = VALUES(asunto),
           encabezado  = VALUES(encabezado),
           subtitulo   = VALUES(subtitulo),
           cuerpo      = VALUES(cuerpo),
           btn_cta     = VALUES(btn_cta),
           color_header= VALUES(color_header),
           auto_envio  = VALUES(auto_envio)"
    )->execute([
        ':asunto'     => $asunto,
        ':encabezado' => $encabezado,
        ':subtitulo'  => $subtitulo,
        ':cuerpo'     => $cuerpo,
        ':btn'        => $btn_cta,
        ':color'      => $color,
        ':auto'       => $auto,
    ]);
    ok(['accion' => 'guardado']);
}

// ── PRUEBA ────────────────────────────────────────────────
if ($accion === 'prueba') {
    $email_prueba = str_in('email_prueba');
    if (!filter_var($email_prueba, FILTER_VALIDATE_EMAIL))
        error_respuesta('Email de prueba inválido');

    $plantilla = $pdo->query("SELECT * FROM com_plantilla_bienvenida WHERE id = 1")
                     ->fetch(PDO::FETCH_ASSOC);
    if (!$plantilla) error_respuesta('Plantilla no configurada');

    $smtp = smtp_principal($pdo);
    if (!$smtp) error_respuesta('No hay cuenta SMTP principal configurada');

    $datos_demo = [
        'nombre' => 'Vendedor Demo',
        'tienda' => 'Tienda Demo',
        'plan'   => 'Pro',
        'email'  => $email_prueba,
        'fecha'  => date('d/m/Y'),
    ];

    try {
        enviar_bienvenida($smtp, $plantilla, $email_prueba, $datos_demo);
        ok(['enviado' => $email_prueba]);
    } catch (\Exception $e) {
        error_respuesta('Error al enviar prueba: ' . $e->getMessage());
    }
}

// ── ENVIAR A VENDEDOR ─────────────────────────────────────
// Llamado internamente al registrar un vendedor nuevo.
// Parámetros: vendedor_id  (o email+nombre+tienda+plan directamente)
if ($accion === 'enviar_vendedor') {
    $vendedor_id = int_in('vendedor_id');

    // Cargar plantilla
    $plantilla = $pdo->query("SELECT * FROM com_plantilla_bienvenida WHERE id = 1")
                     ->fetch(PDO::FETCH_ASSOC);
    if (!$plantilla) ok(['omitido' => 'sin_plantilla']);
    if (!$plantilla['auto_envio']) ok(['omitido' => 'auto_envio_desactivado']);

    $smtp = smtp_principal($pdo);
    if (!$smtp) error_respuesta('No hay cuenta SMTP configurada');

    // Datos del vendedor
    if ($vendedor_id > 0) {
        $st = $pdo->prepare(
            "SELECT v.nombre, v.correo AS email, v.nombre AS tienda,
                    COALESCE(pm.nombre, '') AS plan
               FROM vendedores v
               LEFT JOIN membresias m  ON m.vendedor_id = v.id AND m.estado = 'activo'
               LEFT JOIN planes_membresia pm ON pm.id = m.plan_id
              WHERE v.id = :id LIMIT 1"
        );
        $st->execute([':id' => $vendedor_id]);
        $v = $st->fetch(PDO::FETCH_ASSOC);
        if (!$v) error_respuesta('Vendedor no encontrado', 404);
    } else {
        $v = [
            'nombre' => str_in('nombre'),
            'email'  => str_in('email'),
            'tienda' => str_in('tienda') ?: str_in('nombre'),
            'plan'   => str_in('plan'),
        ];
        if (!$v['email']) error_respuesta('email es obligatorio');
    }

    $datos = array_merge($v, ['fecha' => date('d/m/Y')]);

    try {
        enviar_bienvenida($smtp, $plantilla, $v['email'], $datos);

        // Registrar en historial de enviados
        require_once __DIR__ . '/../../../../vendor/autoload.php';
        $asunto_p = personalizar($plantilla['asunto'], $datos);
        $cuerpo_p = personalizar($plantilla['cuerpo'], $datos);

        $pdo->prepare(
            "INSERT INTO com_correos_enviados
               (cuenta_smtp_id, tipo, para_email, para_nombre, asunto, cuerpo, total_dest, total_ok)
             VALUES (:smtp, 'individual', :email, :nombre, :asunto, :cuerpo, 1, 1)"
        )->execute([
            ':smtp'   => $smtp['id'],
            ':email'  => $v['email'],
            ':nombre' => $v['nombre'],
            ':asunto' => $asunto_p,
            ':cuerpo' => $cuerpo_p,
        ]);

        ok(['enviado' => $v['email']]);
    } catch (\Exception $e) {
        error_respuesta('Error al enviar bienvenida: ' . $e->getMessage());
    }
}

error_respuesta('Acción no reconocida', 404);

// ══════════════════════════════════════════════════════════
// ── Funciones internas ────────────────────────────────────
// ══════════════════════════════════════════════════════════

function smtp_principal(PDO $pdo): array|false
{
    return $pdo->query(
        "SELECT id, email, remitente, host, puerto, usuario, password, ssl
           FROM com_smtp_cuentas WHERE principal = 1 LIMIT 1"
    )->fetch(PDO::FETCH_ASSOC);
}

function smtp_descifrar(string $cifrado): string
{
    $key  = hash('sha256', $_SERVER['SERVER_NAME'] . 'gi_smtp_secret', true);
    $blob = base64_decode($cifrado);
    $iv   = substr($blob, 0, 16);
    $enc  = substr($blob, 16);
    return (string)openssl_decrypt($enc, 'AES-256-CBC', $key, 0, $iv);
}

function personalizar(string $texto, array $datos): string
{
    return str_replace(
        ['[nombre]', '[tienda]', '[plan]', '[email]', '[fecha]'],
        [$datos['nombre'] ?? '', $datos['tienda'] ?? '',
         $datos['plan']   ?? '', $datos['email']  ?? '', $datos['fecha'] ?? date('d/m/Y')],
        $texto
    );
}

function enviar_bienvenida(array $smtp, array $plantilla, string $to_email, array $datos): void
{
    require_once __DIR__ . '/../../../../vendor/autoload.php';

    $asunto_p = personalizar($plantilla['asunto'], $datos);
    $cuerpo_p = personalizar($plantilla['cuerpo'], $datos);

    // ── Construir HTML del correo ──────────────────────────
    $color   = htmlspecialchars($plantilla['color_header'] ?? '#1a6b3c');
    $encab   = htmlspecialchars($plantilla['encabezado']   ?? 'Bienvenido');
    $sub     = htmlspecialchars($plantilla['subtitulo']    ?? '');
    $btn     = htmlspecialchars($plantilla['btn_cta']      ?? 'Ir al panel');
    $cuerpo_html = nl2br(htmlspecialchars($cuerpo_p));

    $html = <<<HTML
    <!DOCTYPE html><html lang="es"><head><meta charset="UTF-8">
    <meta name="viewport" content="width=device-width,initial-scale=1">
    <style>
      body{font-family:'Helvetica Neue',Arial,sans-serif;background:#f4f9f6;margin:0;padding:20px}
      .wrap{max-width:600px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(26,107,60,.1)}
      .header{background:{$color};padding:36px 32px;text-align:center}
      .header h1{color:#fff;font-size:24px;margin:0 0 8px}
      .header p{color:rgba(255,255,255,.85);margin:0;font-size:15px}
      .body{padding:32px}
      .body p{color:#3d5a45;font-size:15px;line-height:1.7;margin:0 0 16px}
      .btn{display:inline-block;background:{$color};color:#fff !important;
           padding:12px 28px;border-radius:8px;text-decoration:none;
           font-weight:600;font-size:15px;margin-top:8px}
      .footer{background:#f4f9f6;padding:20px 32px;text-align:center;
              font-size:12px;color:#7a9e86;border-top:1px solid #ddeee5}
    </style></head><body>
    <div class="wrap">
      <div class="header">
        <h1>{$encab}</h1>
        <p>{$sub}</p>
      </div>
      <div class="body">
        <p>{$cuerpo_html}</p>
        <p><a href="#" class="btn">{$btn}</a></p>
      </div>
      <div class="footer">
        © 2026 GI Store · Recibes este correo porque eres vendedor registrado.
      </div>
    </div>
    </body></html>
    HTML;

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

    $mail->setFrom($smtp['email'], $smtp['remitente']);
    $mail->addAddress($to_email, $datos['nombre'] ?? '');

    $mail->isHTML(true);
    $mail->Subject = $asunto_p;
    $mail->Body    = $html;
    $mail->AltBody = $cuerpo_p;   // versión texto plano

    // ── Adjuntos PDF fijos ────────────────────────────────
    if (file_exists(PDF_POLI))
        $mail->addAttachment(PDF_POLI, 'GI Store — Políticas.pdf');

    if (file_exists(PDF_MANUAL))
        $mail->addAttachment(PDF_MANUAL, 'GI Store — Manual.pdf');

    $mail->send();
}