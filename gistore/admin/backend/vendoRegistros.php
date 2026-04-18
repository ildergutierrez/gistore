<?php
// ============================================================
//  gistore/admin/backend/vendoRegistros.php
//  Llamado DESDE crear_Vendedor() en vendedores.php
//  después de insertar exitosamente el nuevo vendedor.
//
//  Envía correo de bienvenida al vendedor con:
//    - Saludo personalizado
//    - Credenciales de acceso (correo + contraseña en texto plano)
//    - PDF: gistore-politicas.pdf
//    - PDF: Manual de Usuario — Vendedor.pdf
//
//  De: notificaciones@gistore.com.co
//  A:  correo del vendedor recién creado
// ============================================================

ob_start();
header('Content-Type: application/json; charset=utf-8');

require_once __DIR__ . '/../../vendor/autoload.php';
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
    // Estos datos los envía crear_Vendedor() tras insertar
    // exitosamente el registro en BD.
    $tienda   = clean($_POST['tienda']   ?? '');   // nombre del vendedor / tienda
    $correo   = filter_var(trim($_POST['correo']   ?? ''), FILTER_SANITIZE_EMAIL); // correo electrónico del vendedor
    $password = trim($_POST['password'] ?? '');    // contraseña en texto plano (antes del hash)

    // ── Validación ─────────────────────────────────────────
    if (!$tienda)   throw new Exception('El nombre de la tienda es obligatorio.');
    if (!filter_var($correo, FILTER_VALIDATE_EMAIL))
                    throw new Exception('El correo electrónico no es válido.');
    if (!$password) throw new Exception('La contraseña es obligatoria.');

    // ── Rutas de los PDFs adjuntos ─────────────────────────
    $docDir      = __DIR__ . '/../doc/';
    $pdfPolitica = $docDir . 'gistore-politicas.pdf';
    $pdfManual   = $docDir . 'Manual de Usuario — Vendedor.pdf';

    if (!file_exists($pdfPolitica))
        throw new Exception('No se encontró el archivo: gistore-politicas.pdf');
    if (!file_exists($pdfManual))
        throw new Exception('No se encontró el archivo: Manual de Usuario — Vendedor.pdf');

    // ── Configurar PHPMailer ───────────────────────────────
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
    $mail->addAddress($correo, $tienda);
    $mail->addReplyTo('atencionalcliente@gistore.com.co', 'Soporte GI Store');

    // ── Adjuntos ───────────────────────────────────────────
    $mail->addAttachment($pdfPolitica, 'GI Store — Políticas.pdf');
    $mail->addAttachment($pdfManual,   'GI Store — Manual de Vendedor.pdf');

    // ── Contenido ──────────────────────────────────────────
    $mail->isHTML(true);
    $mail->Subject = "¡Bienvenido/a a GI Store, $tienda! 🎉";

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

      <!-- Bienvenida -->
      <h2 style='color:#0f172a;font-size:1.25rem;font-weight:800;margin-bottom:.4rem'>
        ¡Bienvenido/a a GI Store, $tienda! 🎉
      </h2>
      <p style='color:#475569;font-size:.92rem;line-height:1.7;margin-bottom:1.5rem'>
        Nos alegra tenerte como parte de nuestra comunidad de vendedores.
        Tu cuenta ha sido creada exitosamente. A continuación encontrarás
        tus datos de acceso para que puedas ingresar a tu panel de vendedor.
      </p>

      <!-- Credenciales -->
      <div style='background:#f0fdf4;border:1.5px solid #d1ead9;border-radius:12px;
                  padding:1.2rem 1.4rem;margin-bottom:1.5rem'>
        <p style='font-size:.78rem;font-weight:700;color:#1a6b3c;
                  text-transform:uppercase;letter-spacing:.06em;margin-bottom:1rem'>
          🔑 Tus credenciales de acceso
        </p>
        <table style='width:100%;border-collapse:collapse;font-size:.9rem'>
          <tr>
            <td style='padding:.55rem .7rem;font-weight:700;color:#1a6b3c;
                        width:38%;border-bottom:1px solid #d1ead9'>
              Tienda / Nombre
            </td>
            <td style='padding:.55rem .7rem;color:#1e293b;border-bottom:1px solid #d1ead9'>
              $tienda
            </td>
          </tr>
          <tr>
            <td style='padding:.55rem .7rem;font-weight:700;color:#1a6b3c;
                        border-bottom:1px solid #d1ead9'>
              Usuario
            </td>
            <td style='padding:.55rem .7rem;border-bottom:1px solid #d1ead9'>
              <a href='mailto:$correo' style='color:#2d9e5f;font-weight:600'>$correo</a>
            </td>
          </tr>
          <tr>
            <td style='padding:.55rem .7rem;font-weight:700;color:#1a6b3c'>
              Contraseña
            </td>
            <td style='padding:.55rem .7rem;color:#1e293b;
                        font-family:monospace;font-size:.95rem;font-weight:700;
                        letter-spacing:.04em'>
              $password
            </td>
          </tr>
        </table>
      </div>

      <!-- Botón acceso -->
      <div style='text-align:center;margin-bottom:1.75rem'>
        <a href='https://gistore.com.co/page/tyc.html' target='_blank' rel='noopener noreferrer'
           style='display:inline-block;background:#1a6b3c;color:#fff;
                  font-weight:700;font-size:.95rem;text-decoration:none;
                  padding:.8rem 2rem;border-radius:10px;letter-spacing:.02em'>
          Terminos y condiciones →
        </a>
      </div>
      <div style='text-align:center;margin-bottom:1.75rem'>
        <a href='https://gistore.com.co/user/index.html' target='_blank' rel='noopener noreferrer'
           style='display:inline-block;background:#1a6b3c;color:#fff;
                  font-weight:700;font-size:.95rem;text-decoration:none;
                  padding:.8rem 2rem;border-radius:10px;letter-spacing:.02em'>
          Portal de vendedor →
        </a>
      </div>

      <!-- Nota seguridad -->
      <div style='background:#fffbeb;border:1px solid #fde68a;border-radius:10px;
                  padding:.85rem 1rem;font-size:.85rem;color:#92400e;margin-bottom:1.5rem'>
        🔒 <strong>Recomendación:</strong> Por seguridad, te sugerimos cambiar tu contraseña
        la primera vez que ingreses a tu panel.
      </div>

      <!-- Adjuntos -->
      <div style='background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;
                  padding:.85rem 1rem;font-size:.85rem;color:#475569;margin-bottom:1.5rem'>
        📎 <strong>Documentos adjuntos en este correo:</strong><br>
        <ul style='margin:.5rem 0 0 1.2rem;padding:0;line-height:1.9'>
          <li>GI Store — Políticas</li>
          <li>GI Store — Manual de Vendedor</li>
        </ul>
        <p style='margin:.7rem 0 0;font-size:.82rem;color:#64748b'>
          Por favor léelos antes de publicar tus primeros productos.
        </p>
      </div>

      <!-- Footer -->
      <p style='color:#94a3b8;font-size:.75rem;border-top:1px solid #e2e8f0;
                padding-top:1rem;line-height:1.6'>
        ¿Tienes dudas? Escríbenos a
        <a href='mailto:atencionalcliente@gistore.com.co' style='color:#94a3b8'>atencionalcliente@gistore.com.co</a>
        o contáctanos por WhatsApp.<br>
        ⚠️ Mensaje automático — por favor no respondas directamente a este correo.
      </p>
      <p style='color:#94a3b8;font-size:.75rem;margin-top:.3rem'>
        © 2026 GI Store · Aguachica, Cesar
      </p>
    </div>";

    $mail->AltBody =
        "¡Bienvenido/a a GI Store, $tienda!\n\n" .
        "Tu cuenta ha sido creada. Aquí están tus datos de acceso:\n\n" .
        "Tienda / Nombre : $tienda\n" .
        "Usuario         : $correo\n" .
        "Contraseña      : $password\n\n" .
        "Ingresa a tu panel en: https://gistore.com.co/user/index.html\n\n" .
        "Encontrarás adjuntos en este correo:\n" .
        "  - GI Store — Políticas\n" .
        "  - GI Store — Manual de Vendedor\n\n" .
        "Por seguridad, te recomendamos cambiar tu contraseña al primer ingreso.\n\n" .
        "¿Dudas? Escríbenos a atencionalcliente@gistore.com.co\n <b>Nota:</b> Este es un mensaje automático, por favor no respondas directamente a este correo.\n" .
        "<center>© 2026 GI Store · Aguachica, Cesar</center>";

    $mail->send();
    jsonOut(true);

} catch (Exception $e) {
    error_log('PHPMailer ERROR [bienvenida-vendedor]: ' . ($mail->ErrorInfo ?? $e->getMessage()));
    jsonOut(false, 'No se pudo enviar el correo de bienvenida: ' . ($mail->ErrorInfo ?? $e->getMessage()));
} catch (\Throwable $e) {
    error_log('ERROR [bienvenida-vendedor]: ' . $e->getMessage());
    jsonOut(false, $e->getMessage());
}