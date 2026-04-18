<?php
// ============================================================
//  gistore/php/mensajesGenerico.php
//
//  Funciones de notificación al vendedor según estado de cuenta.
//
//  Funciones disponibles:
//    correo_cuenta_desactivada($tienda, $correo)
//    correo_suspension_180dias($tienda, $correo)
//    correo_aviso_160dias($tienda, $correo)
// ============================================================

require_once __DIR__ . '/../vendor/autoload.php';
use PHPMailer\PHPMailer\PHPMailer;
use PHPMailer\PHPMailer\Exception;

// ── Helpers compartidos ────────────────────────────────────

function _gistore_mailer(string $correo, string $tienda): PHPMailer {
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
    $mail->isHTML(true);
    return $mail;
}

function _gistore_header(): string {
    return "
      <div style='text-align:center;margin-bottom:1.75rem'>
        <div style='display:inline-block;background:#1a6b3c;border-radius:12px;padding:.7rem 1.5rem'>
          <img src='https://gistore.com.co/img/favicon/gi-icono-blanco.svg'
               alt='GI Store' width='32' height='32'
               style='display:inline-block;vertical-align:middle;margin-right:.5rem'>
          <span style='color:#fff;font-size:1.1rem;font-weight:800;vertical-align:middle'>GI Store</span>
        </div>
      </div>";
}

function _gistore_footer(): string {
    return "
      <p style='color:#94a3b8;font-size:.75rem;border-top:1px solid #e2e8f0;
                padding-top:1rem;line-height:1.6'>
        ¿Tienes dudas? Escríbenos a
        <a href='mailto:atencionalcliente@gistore.com.co' style='color:#94a3b8'>atencionalcliente@gistore.com.co</a>
        o contáctanos por WhatsApp.<br>
        ⚠️ Mensaje automático — por favor no respondas directamente a este correo.
      </p>
      <p style='color:#94a3b8;font-size:.75rem;margin-top:.3rem'>
        © 2026 GI Store · Aguachica, Cesar
      </p>";
}

function _gistore_validate(string $tienda, string $correo): void {
    if (!$tienda)
        throw new Exception('El nombre de la tienda es obligatorio.');
    if (!filter_var($correo, FILTER_VALIDATE_EMAIL))
        throw new Exception('El correo electrónico no es válido.');
}


// ══════════════════════════════════════════════════════════════
//  1) CUENTA DESACTIVADA
//     La cuenta fue desactivada. Tiene 90 días para reactivarla
//     o será eliminada permanentemente.
// ══════════════════════════════════════════════════════════════

function correo_cuenta_desactivada(string $tienda, string $correo): array {
    $tienda = htmlspecialchars(strip_tags(trim($tienda)), ENT_QUOTES, 'UTF-8');
    $correo = filter_var(trim($correo), FILTER_SANITIZE_EMAIL);

    try {
        _gistore_validate($tienda, $correo);

        $mail          = _gistore_mailer($correo, $tienda);
        $mail->Subject = "Tu cuenta en GI Store ha sido desactivada — $tienda";

        $mail->Body = "
        <div style='font-family:Inter,Arial,sans-serif;max-width:560px;margin:0 auto;padding:2rem'>
          " . _gistore_header() . "

          <h2 style='color:#0f172a;font-size:1.2rem;font-weight:800;margin-bottom:.4rem'>
            Tu cuenta ha sido desactivada, $tienda
          </h2>
          <p style='color:#475569;font-size:.92rem;line-height:1.7;margin-bottom:1.5rem'>
            Te informamos que tu cuenta de vendedor en <strong>GI Store</strong> ha sido
            <strong>desactivada</strong>. Tus productos ya no son visibles para los compradores
            mientras la cuenta permanezca inactiva.
          </p>

          <!-- Aviso de plazo -->
          <div style='background:#fef2f2;border:1.5px solid #fecaca;border-radius:12px;
                      padding:1.2rem 1.4rem;margin-bottom:1.5rem'>
            <p style='font-size:.78rem;font-weight:700;color:#dc2626;
                      text-transform:uppercase;letter-spacing:.06em;margin-bottom:.75rem'>
              ⏳ Tienes 90 días para reactivar
            </p>
            <p style='font-size:.92rem;color:#1e293b;line-height:1.7;margin:0'>
              A partir de hoy cuentas con <strong>90 días calendario</strong> para reactivar
              tu membresía y recuperar el acceso completo a tu tienda.<br><br>
              Si transcurrido ese plazo la cuenta sigue inactiva, será
              <strong>eliminada de forma permanente</strong> junto con todos tus productos,
              historial y configuración.
            </p>
          </div>

          <!-- Botón -->
          <div style='text-align:center;margin-bottom:1.75rem'>
            <a href='https://gistore.com.co/user/index.html' target='_blank' rel='noopener noreferrer'
               style='display:inline-block;background:#1a6b3c;color:#fff;font-weight:700;
                      font-size:.95rem;text-decoration:none;padding:.8rem 2rem;
                      border-radius:10px;letter-spacing:.02em'>
              Reactivar mi cuenta →
            </a>
          </div>

          <!-- Nota -->
          <div style='background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;
                      padding:.85rem 1rem;font-size:.85rem;color:#475569;margin-bottom:1.5rem'>
            💬 ¿Crees que esto es un error? Contáctanos antes de que venza el plazo
            para evitar la pérdida de tu información.
          </div>

          " . _gistore_footer() . "
        </div>";

        $mail->AltBody =
            "Tu cuenta en GI Store ha sido desactivada, $tienda.\n\n" .
            "Tienes 90 días calendario para reactivar tu membresía.\n" .
            "Si no lo haces, la cuenta será eliminada permanentemente.\n\n" .
            "Reactivar: https://gistore.com.co/user/index.html\n\n" .
            "¿Dudas? Escríbenos a atencionalcliente@gistore.com.co\n" .
            "Nota: Mensaje automático, no respondas directamente.\n" .
            "© 2026 GI Store · Aguachica, Cesar";

        $mail->send();
        return ['ok' => true];

    } catch (Exception $e) {
        error_log('PHPMailer ERROR [cuenta-desactivada]: ' . ($mail->ErrorInfo ?? $e->getMessage()));
        return ['ok' => false, 'error' => $mail->ErrorInfo ?? $e->getMessage()];
    } catch (\Throwable $e) {
        error_log('ERROR [cuenta-desactivada]: ' . $e->getMessage());
        return ['ok' => false, 'error' => $e->getMessage()];
    }
}


// ══════════════════════════════════════════════════════════════
//  2) MEMBRESÍA SIN ACTIVAR — 180 DÍAS (FASE DE SUSPENSIÓN)
//     Han pasado 180 días sin activar la membresía.
//     La cuenta entra en suspensión. Tiene 90 días para reactivar.
// ══════════════════════════════════════════════════════════════

function correo_suspension_180dias(string $tienda, string $correo): array {
    $tienda = htmlspecialchars(strip_tags(trim($tienda)), ENT_QUOTES, 'UTF-8');
    $correo = filter_var(trim($correo), FILTER_SANITIZE_EMAIL);

    try {
        _gistore_validate($tienda, $correo);

        $mail          = _gistore_mailer($correo, $tienda);
        $mail->Subject = "Tu cuenta en GI Store ha entrado en fase de suspensión — $tienda";

        $mail->Body = "
        <div style='font-family:Inter,Arial,sans-serif;max-width:560px;margin:0 auto;padding:2rem'>
          " . _gistore_header() . "

          <h2 style='color:#0f172a;font-size:1.2rem;font-weight:800;margin-bottom:.4rem'>
            Tu cuenta ha entrado en fase de suspensión, $tienda
          </h2>
          <p style='color:#475569;font-size:.92rem;line-height:1.7;margin-bottom:1.5rem'>
            Han transcurrido <strong>180 días</strong> desde la creación de tu cuenta en
            <strong>GI Store</strong> o activacion de la membresía.
            Por esta razón, tu cuenta ha entrado en <strong>fase de suspensión</strong>.
          </p>

          <!-- Aviso -->
          <div style='background:#fff7ed;border:1.5px solid #fed7aa;border-radius:12px;
                      padding:1.2rem 1.4rem;margin-bottom:1.5rem'>
            <p style='font-size:.78rem;font-weight:700;color:#ea580c;
                      text-transform:uppercase;letter-spacing:.06em;margin-bottom:.75rem'>
              ⚠️ Fase de suspensión — 90 días para reactivar
            </p>
            <p style='font-size:.92rem;color:#1e293b;line-height:1.7;margin:0'>
              A partir de hoy tienes <strong>90 días calendario</strong> para activar tu membresía
              y salir de la fase de suspensión.<br><br>
              Si no realizas la activación dentro de ese plazo, tu cuenta quedará
              <strong>inhabilitada permanentemente</strong> y no podrás recuperar
              la información registrada.
            </p>
          </div>

          <!-- Botón -->
          <div style='text-align:center;margin-bottom:1.75rem'>
            <a href='https://gistore.com.co/user/index.html' target='_blank' rel='noopener noreferrer'
               style='display:inline-block;background:#1a6b3c;color:#fff;font-weight:700;
                      font-size:.95rem;text-decoration:none;padding:.8rem 2rem;
                      border-radius:10px;letter-spacing:.02em'>
              Activar mi membresía →
            </a>
          </div>

          <!-- Nota -->
          <div style='background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;
                      padding:.85rem 1rem;font-size:.85rem;color:#475569;margin-bottom:1.5rem'>
            💬 Si tienes alguna duda sobre el proceso de activación o necesitas ayuda,
            contáctanos y con gusto te orientamos.
          </div>

          " . _gistore_footer() . "
        </div>";

        $mail->AltBody =
            "Tu cuenta en GI Store ha entrado en fase de suspensión, $tienda.\n\n" .
            "Han pasado 180 días sin activar tu membresía.\n" .
            "Tienes 90 días calendario para activarla antes de que la cuenta quede inhabilitada.\n\n" .
            "Activar membresía: https://gistore.com.co/user/index.html\n\n" .
            "¿Dudas? Escríbenos a atencionalcliente@gistore.com.co\n" .
            "Nota: Mensaje automático, no respondas directamente.\n" .
            "© 2026 GI Store · Aguachica, Cesar";

        $mail->send();
        return ['ok' => true];

    } catch (Exception $e) {
        error_log('PHPMailer ERROR [suspension-180dias]: ' . ($mail->ErrorInfo ?? $e->getMessage()));
        return ['ok' => false, 'error' => $mail->ErrorInfo ?? $e->getMessage()];
    } catch (\Throwable $e) {
        error_log('ERROR [suspension-180dias]: ' . $e->getMessage());
        return ['ok' => false, 'error' => $e->getMessage()];
    }
}


// ══════════════════════════════════════════════════════════════
//  3) AVISO PREVIO — 160 DÍAS SIN ACTIVAR
//     Faltan 20 días para llegar a los 180. Aviso de que si no
//     activa la membresía antes, la cuenta pasará a suspensión.
// ══════════════════════════════════════════════════════════════

function correo_aviso_160dias(string $tienda, string $correo): array {
    $tienda = htmlspecialchars(strip_tags(trim($tienda)), ENT_QUOTES, 'UTF-8');
    $correo = filter_var(trim($correo), FILTER_SANITIZE_EMAIL);

    try {
        _gistore_validate($tienda, $correo);

        $mail          = _gistore_mailer($correo, $tienda);
        $mail->Subject = "Aviso importante: tu cuenta pasará a suspensión en 20 días — $tienda";

        $mail->Body = "
        <div style='font-family:Inter,Arial,sans-serif;max-width:560px;margin:0 auto;padding:2rem'>
          " . _gistore_header() . "

          <h2 style='color:#0f172a;font-size:1.2rem;font-weight:800;margin-bottom:.4rem'>
            Aviso: tu membresía vence en 20 días, $tienda
          </h2>
          <p style='color:#475569;font-size:.92rem;line-height:1.7;margin-bottom:1.5rem'>
            Han transcurrido <strong>160 días</strong> desde que creaste tu cuenta en
            <strong>GI Store</strong> o sin que tu membresía haya sido activada.
            Te contactamos para que puedas tomar acción a tiempo.
          </p>

          <!-- Aviso -->
          <div style='background:#fefce8;border:1.5px solid #fde047;border-radius:12px;
                      padding:1.2rem 1.4rem;margin-bottom:1.5rem'>
            <p style='font-size:.78rem;font-weight:700;color:#ca8a04;
                      text-transform:uppercase;letter-spacing:.06em;margin-bottom:.75rem'>
              🕐 Te quedan 20 días para activar
            </p>
            <p style='font-size:.92rem;color:#1e293b;line-height:1.7;margin:0'>
              Si no activas tu membresía antes de cumplir los <strong>180 días</strong>,
              tu cuenta pasará automáticamente a <strong>fase de suspensión</strong>.<br><br>
              En esa fase tendrás un plazo adicional de 90 días para reactivarla.
              Evita llegar a esa instancia activando tu membresía hoy.
            </p>
          </div>

          <!-- Botón -->
          <div style='text-align:center;margin-bottom:1.75rem'>
            <a href='https://gistore.com.co/user/index.html' target='_blank' rel='noopener noreferrer'
               style='display:inline-block;background:#1a6b3c;color:#fff;font-weight:700;
                      font-size:.95rem;text-decoration:none;padding:.8rem 2rem;
                      border-radius:10px;letter-spacing:.02em'>
              Activar mi membresía ahora →
            </a>
          </div>

          <!-- Nota -->
          <div style='background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;
                      padding:.85rem 1rem;font-size:.85rem;color:#475569;margin-bottom:1.5rem'>
            💬 ¿Tienes dudas sobre cómo activar tu membresía? Escríbenos y te ayudamos
            antes de que se cumpla el plazo.
          </div>

          " . _gistore_footer() . "
        </div>";

        $mail->AltBody =
            "Aviso importante para $tienda:\n\n" .
            "Han pasado 160 días desde que creaste tu cuenta en GI Store sin activar tu membresía.\n" .
            "Si no la activas antes de los 180 días, tu cuenta pasará a fase de suspensión.\n\n" .
            "Activar membresía: https://gistore.com.co/user/index.html\n\n" .
            "¿Dudas? Escríbenos a atencionalcliente@gistore.com.co\n" .
            "Nota: Mensaje automático, no respondas directamente.\n" .
            "© 2026 GI Store · Aguachica, Cesar";

        $mail->send();
        return ['ok' => true];

    } catch (Exception $e) {
        error_log('PHPMailer ERROR [aviso-160dias]: ' . ($mail->ErrorInfo ?? $e->getMessage()));
        return ['ok' => false, 'error' => $mail->ErrorInfo ?? $e->getMessage()];
    } catch (\Throwable $e) {
        error_log('ERROR [aviso-160dias]: ' . $e->getMessage());
        return ['ok' => false, 'error' => $e->getMessage()];
    }
}