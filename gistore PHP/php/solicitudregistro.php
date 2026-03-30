<?php
// ============================================================
//  gistore/php/solicitudregistro.php
//  Recibe datos del formulario de registro de vendedores
//  y envía correo con PHPMailer.
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
    $tienda      = clean($_POST['tienda']      ?? '');
    $ciudad      = clean($_POST['ciudad']      ?? '');
    $correo      = filter_var(trim($_POST['correo'] ?? ''), FILTER_SANITIZE_EMAIL);
    $whatsapp    = clean($_POST['whatsapp']    ?? '');
    $descripcion = clean($_POST['descripcion'] ?? '');

    // ── Validación ─────────────────────────────────────────
    if (!$tienda)      throw new Exception('El nombre de la tienda es obligatorio.');
    if (!$ciudad)      throw new Exception('La ciudad o municipio es obligatoria.');
    if (!filter_var($correo, FILTER_VALIDATE_EMAIL))
                       throw new Exception('El correo electrónico no es válido.');
    if (!$whatsapp)    throw new Exception('El WhatsApp de contacto es obligatorio.');
    if (!$descripcion) throw new Exception('La descripción de productos es obligatoria.');

    // ── Enviar correo ──────────────────────────────────────
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
    $mail->addAddress('registro@gistore.com.co', 'GI Store Solicitud de Registro');
    $mail->addReplyTo($correo, $tienda);

    $mail->isHTML(true);
    $mail->Subject = "$tienda - Solicita Registro";

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
        🏪 Nueva solicitud de registro de vendedor
      </h2>
      <p style='color:#64748b;font-size:.88rem;margin-bottom:1.5rem'>
        Un interesado completó el formulario de registro. Revisa los datos y asigna la categoría correspondiente.
      </p>

      <!-- Datos del solicitante -->
      <table style='width:100%;border-collapse:collapse;font-size:.9rem;margin-bottom:1.5rem'>
        <tr style='background:#f0fdf4'>
          <td style='padding:.65rem .9rem;font-weight:700;color:#1a6b3c;width:36%;border-bottom:1px solid #d1ead9'>Tienda / Nombre</td>
          <td style='padding:.65rem .9rem;color:#1e293b;border-bottom:1px solid #d1ead9'>$tienda</td>
        </tr>
        <tr>
          <td style='padding:.65rem .9rem;font-weight:700;color:#1a6b3c;border-bottom:1px solid #d1ead9'>Ciudad</td>
          <td style='padding:.65rem .9rem;color:#1e293b;border-bottom:1px solid #d1ead9'>$ciudad</td>
        </tr>
        <tr style='background:#f0fdf4'>
          <td style='padding:.65rem .9rem;font-weight:700;color:#1a6b3c;border-bottom:1px solid #d1ead9'>Correo</td>
          <td style='padding:.65rem .9rem;border-bottom:1px solid #d1ead9'>
            <a href='mailto:$correo' style='color:#2d9e5f'>$correo</a>
          </td>
        </tr>
        <tr>
          <td style='padding:.65rem .9rem;font-weight:700;color:#1a6b3c;border-bottom:1px solid #d1ead9'>WhatsApp</td>
          <td style='padding:.65rem .9rem;border-bottom:1px solid #d1ead9'>
            <a href='https://wa.me/57$whatsapp' style='color:#2d9e5f'>+57 $whatsapp</a>
          </td>
        </tr>
      </table>

      <!-- Descripción de productos -->
      <div style='background:#f0fdf4;border:1.5px solid #d1ead9;border-radius:12px;padding:1rem 1.2rem;margin-bottom:1.5rem'>
        <p style='font-size:.78rem;font-weight:700;color:#1a6b3c;text-transform:uppercase;letter-spacing:.06em;margin-bottom:.5rem'>
          📦 Qué vende el solicitante
        </p>
        <p style='font-size:.92rem;color:#1e293b;line-height:1.7;margin:0'>$descripcion</p>
      </div>

      <!-- Aviso para el admin -->
      <div style='background:#fffbeb;border:1px solid #fde68a;border-radius:10px;padding:.85rem 1rem;font-size:.85rem;color:#92400e;margin-bottom:1.5rem'>
        💡 <strong>Acción requerida:</strong> Revisa la descripción y asigna la categoría más adecuada,
        o crea una nueva si no existe. Luego comunícate con el solicitante para darle acceso.
      </div>

      <!-- Footer -->
      <p style='color:#94a3b8;font-size:.75rem;border-top:1px solid #e2e8f0;padding-top:1rem;line-height:1.6'>
        ⚠️ Mensaje automático desde el formulario de registro de GI Store.<br>
        Para responder al solicitante escribe a
        <a href='mailto:$correo' style='color:#94a3b8'>$correo</a>
        o contáctalo por WhatsApp al +57 $whatsapp.
      </p>
      <p style='color:#94a3b8;font-size:.75rem;margin-top:.3rem'>
        © 2026 GI Store · Aguachica, Cesar
      </p>
    </div>";

    $mail->AltBody =
        "Nueva solicitud de registro — GI Store\n\n" .
        "Tienda/Nombre: $tienda\n" .
        "Ciudad: $ciudad\n" .
        "Correo: $correo\n" .
        "WhatsApp: +57 $whatsapp\n\n" .
        "Qué vende:\n$descripcion";

    $mail->send();
    jsonOut(true);

} catch (Exception $e) {
    error_log('PHPMailer ERROR [registro]: ' . ($mail->ErrorInfo ?? $e->getMessage()));
    jsonOut(false, 'No se pudo enviar la solicitud: ' . ($mail->ErrorInfo ?? $e->getMessage()));
} catch (\Throwable $e) {
    error_log('ERROR [registro]: ' . $e->getMessage());
    jsonOut(false, $e->getMessage());
}