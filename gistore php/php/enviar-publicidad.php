<?php
// ============================================================
//  gistore/php/enviar-publicidad.php
//  Recibe FormData con datos de campaña + imagen del banner
//  Envía correo con imagen adjunta vía PHPMailer
//  De: notificaciones@gistore.com.co
//  A:  registro@gistore.com.co
// ============================================================

ob_start();
header('Content-Type: application/json; charset=utf-8');

require_once __DIR__ . '/../vendor/autoload.php';
use PHPMailer\PHPMailer\PHPMailer;
use PHPMailer\PHPMailer\Exception;

function jsonOut(bool $ok, string $error = ''): void {
    ob_end_clean();
    echo $ok
        ? json_encode(['ok' => true])
        : json_encode(['ok' => false, 'error' => $error]);
    exit;
}

function clean(string $v): string {
    return htmlspecialchars(strip_tags(trim($v)), ENT_QUOTES, 'UTF-8');
}

try {
    if ($_SERVER['REQUEST_METHOD'] !== 'POST')
        throw new Exception('Método no permitido.');

    // ── Captura y sanitización ─────────────────────────────
    $plan     = clean($_POST['plan']     ?? '');
    $titulo   = clean($_POST['titulo']   ?? '');
    $url      = clean($_POST['url']      ?? '');
    $whatsapp = clean($_POST['whatsapp'] ?? '');
    $nombre   = clean($_POST['nombre']   ?? '');
    $correo   = filter_var(trim($_POST['correo'] ?? ''), FILTER_SANITIZE_EMAIL);

    // ── Validación de campos ───────────────────────────────
    if (!$plan)     throw new Exception('Falta el plan seleccionado.');
    if (!$titulo)   throw new Exception('El título de la campaña es obligatorio.');
    if (!$url)      throw new Exception('La URL de destino es obligatoria.');
    if (!$whatsapp) throw new Exception('El WhatsApp de contacto es obligatorio.');
    if (!$nombre)   throw new Exception('El nombre o empresa es obligatorio.');
    if (!filter_var($correo, FILTER_VALIDATE_EMAIL))
        throw new Exception('El correo electrónico no es válido.');

    // ── Validación de imagen ───────────────────────────────
    if (empty($_FILES['banner']) || $_FILES['banner']['error'] === UPLOAD_ERR_NO_FILE)
        throw new Exception('No se recibió la imagen del banner.');

    $errCodes = [
        UPLOAD_ERR_INI_SIZE   => 'La imagen supera el límite del servidor.',
        UPLOAD_ERR_FORM_SIZE  => 'La imagen supera el límite del formulario.',
        UPLOAD_ERR_PARTIAL    => 'La imagen se subió de forma incompleta.',
        UPLOAD_ERR_NO_TMP_DIR => 'No hay carpeta temporal en el servidor.',
        UPLOAD_ERR_CANT_WRITE => 'No se pudo escribir la imagen en el servidor.',
        UPLOAD_ERR_EXTENSION  => 'Una extensión PHP bloqueó la subida.',
    ];
    $errCode = $_FILES['banner']['error'];
    if ($errCode !== UPLOAD_ERR_OK)
        throw new Exception($errCodes[$errCode] ?? "Error al subir imagen (código $errCode).");

    $tmpPath  = $_FILES['banner']['tmp_name'];
    $origName = basename($_FILES['banner']['name']);

    // Validar tipo MIME real
    $finfo   = new finfo(FILEINFO_MIME_TYPE);
    $mime    = $finfo->file($tmpPath);
    $tiposOk = ['image/jpeg', 'image/png', 'image/webp'];
    if (!in_array($mime, $tiposOk, true))
        throw new Exception("Tipo de imagen no permitido ($mime). Usa JPG, PNG o WEBP.");

    // Límite 5 MB
    if ($_FILES['banner']['size'] > 5 * 1024 * 1024)
        throw new Exception('La imagen supera los 5 MB permitidos.');

    // ── Enviar correo con PHPMailer ────────────────────────
    $mail = new PHPMailer(true);

    $mail->isSMTP();
    $mail->Host       = 'mail.gistore.com.co';
    $mail->SMTPAuth   = true;
    $mail->Username   = 'notificaciones@gistore.com.co';
    $mail->Password   = 'G15tores260*';
    $mail->SMTPSecure = PHPMailer::ENCRYPTION_SMTPS;
    $mail->Port       = 465;
    $mail->CharSet    = 'UTF-8';
    $mail->Timeout    = 15;

    $mail->setFrom('notificaciones@gistore.com.co', 'GI Store Notificaciones');
    $mail->addAddress('registro@gistore.com.co', 'GI Store Registro');
    $mail->addReplyTo($correo, $nombre);

    $mail->isHTML(true);
    $mail->Subject = "Solicitud de pauta publicitaria — Plan $plan | GI Store";

    // Adjuntar imagen del banner
    $mail->addAttachment($tmpPath, $origName);

    $mail->Body = "
    <div style='font-family:Inter,Arial,sans-serif;max-width:560px;margin:0 auto;padding:2rem'>

      <!-- Cabecera -->
      <div style='text-align:center;margin-bottom:1.75rem'>
        <div style='display:inline-block;background:#1a6b3c;border-radius:12px;padding:.7rem 1.5rem'>
          <img src='https://gistore.com.co/img/favicon/gi-icono-blanco.svg'
               alt='GI Store' width='32' height='32'
               style='display:inline-block;vertical-align:middle;margin-right:.5rem'>
          <span style='color:#fff;font-size:1.1rem;font-weight:800;vertical-align:middle'>GI Store</span>
        </div>
      </div>

      <!-- Título -->
      <h2 style='color:#0f172a;font-size:1.2rem;font-weight:800;margin-bottom:.3rem'>
        📣 Nueva solicitud de publicidad
      </h2>
      <p style='color:#64748b;font-size:.88rem;margin-bottom:1.5rem'>
        Recibiste una solicitud de pauta. Revisa los datos y la imagen adjunta.
      </p>

      <!-- Datos de la campaña -->
      <table style='width:100%;border-collapse:collapse;font-size:.9rem;margin-bottom:1.5rem'>
        <tr style='background:#f0fdf4'>
          <td style='padding:.65rem .9rem;font-weight:700;color:#1a6b3c;width:38%;border-bottom:1px solid #d1ead9'>Plan</td>
          <td style='padding:.65rem .9rem;color:#1e293b;border-bottom:1px solid #d1ead9'>$plan</td>
        </tr>
        <tr>
          <td style='padding:.65rem .9rem;font-weight:700;color:#1a6b3c;border-bottom:1px solid #d1ead9'>Título campaña</td>
          <td style='padding:.65rem .9rem;color:#1e293b;border-bottom:1px solid #d1ead9'>$titulo</td>
        </tr>
        <tr style='background:#f0fdf4'>
          <td style='padding:.65rem .9rem;font-weight:700;color:#1a6b3c;border-bottom:1px solid #d1ead9'>URL destino</td>
          <td style='padding:.65rem .9rem;border-bottom:1px solid #d1ead9'>
            <a href='$url' style='color:#2d9e5f'>$url</a>
          </td>
        </tr>
        <tr>
          <td style='padding:.65rem .9rem;font-weight:700;color:#1a6b3c;border-bottom:1px solid #d1ead9'>Nombre / Empresa</td>
          <td style='padding:.65rem .9rem;color:#1e293b;border-bottom:1px solid #d1ead9'>$nombre</td>
        </tr>
        <tr style='background:#f0fdf4'>
          <td style='padding:.65rem .9rem;font-weight:700;color:#1a6b3c;border-bottom:1px solid #d1ead9'>Correo</td>
          <td style='padding:.65rem .9rem;border-bottom:1px solid #d1ead9'>
            <a href='mailto:$correo' style='color:#2d9e5f'>$correo</a>
          </td>
        </tr>
        <tr>
          <td style='padding:.65rem .9rem;font-weight:700;color:#1a6b3c'>WhatsApp</td>
          <td style='padding:.65rem .9rem;color:#1e293b'>+57 $whatsapp</td>
        </tr>
      </table>

      <!-- Aviso adjunto -->
      <div style='background:#fffbeb;border:1px solid #fde68a;border-radius:10px;
                  padding:.85rem 1rem;font-size:.85rem;color:#92400e;margin-bottom:1.5rem'>
        🖼️ <strong>La imagen del banner está adjunta</strong> en este correo como <em>$origName</em>.
      </div>

      <!-- Footer -->
      <p style='color:#94a3b8;font-size:.75rem;border-top:1px solid #e2e8f0;
                padding-top:1rem;margin-top:.5rem;line-height:1.6'>
        ⚠️ Este es un mensaje automático generado desde el formulario de publicidad de GI Store.<br>
        Para responder al solicitante escribe a <a href='mailto:$correo' style='color:#94a3b8'>$correo</a>
        o contáctalo por WhatsApp al +57 $whatsapp.
      </p>
      <p style='color:#94a3b8;font-size:.75rem;margin-top:.3rem'>
        © 2026 GI Store · Aguachica, Cesar
      </p>
    </div>";

    $mail->AltBody =
        "Nueva solicitud de publicidad — GI Store\n\n" .
        "Plan: $plan\n" .
        "Título: $titulo\n" .
        "URL destino: $url\n" .
        "Nombre/Empresa: $nombre\n" .
        "Correo: $correo\n" .
        "WhatsApp: +57 $whatsapp\n\n" .
        "La imagen del banner está adjunta como $origName.";

    $mail->send();
    jsonOut(true);

} catch (Exception $e) {
    error_log('PHPMailer ERROR [publicidad]: ' . ($mail->ErrorInfo ?? $e->getMessage()));
    jsonOut(false, 'No se pudo enviar la solicitud: ' . ($mail->ErrorInfo ?? $e->getMessage()));
} catch (\Throwable $e) {
    error_log('ERROR [publicidad]: ' . $e->getMessage());
    jsonOut(false, $e->getMessage());
}