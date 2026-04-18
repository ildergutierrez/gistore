<?php
// ============================================================
//  user/backend/recuperar.php
//  Tabla: recuperar (id, correo, token, creado_en)
//
//  Acciones POST:
//    solicitar → genera código 6 dígitos, guarda en recuperar, envía correo
//    verificar → valida código (30 min), guarda sesión temporal
//    cambiar   → actualiza contraseña usando sesión temporal
// ============================================================

if (session_status() === PHP_SESSION_NONE)
    session_start();

header('Content-Type: application/json');

// ── PHPMailer — vendor en gistore/vendor/ ─────────────────
require_once __DIR__ . '/../../vendor/autoload.php';
use PHPMailer\PHPMailer\PHPMailer;
use PHPMailer\PHPMailer\Exception;
use PHPMailer\PHPMailer\SMTP;

// ── Conexión BD ───────────────────────────────────────────
require_once __DIR__ . '/../../backend/conexion.php';
$pdo = __Conectar();

// ── Helpers ───────────────────────────────────────────────
function ok(mixed $datos = null): never {
    echo json_encode(['ok' => true, 'datos' => $datos], JSON_UNESCAPED_UNICODE);
    exit;
}
function err(string $msg, int $code = 400): never {
    http_response_code($code);
    echo json_encode(['ok' => false, 'error' => $msg], JSON_UNESCAPED_UNICODE);
    exit;
}
function enmascararCorreo(string $correo): string {
    [$local, $dominio] = explode('@', $correo, 2);
    return substr($local, 0, min(2, strlen($local))) . '***@' . $dominio;
}

// ── PHPMailer — puerto 465 SSL ────────────────────────────
function enviarCodigo(string $destinatario, string $codigo): array {
    $mail = new PHPMailer(true);
    try {
        $mail->SMTPDebug  = SMTP::DEBUG_SERVER;
        $mail->Debugoutput = function($str, $level) {
            error_log("PHPMailer [$level]: $str");
        };

        $mail->isSMTP();
        $mail->Host       = 'mail.gistore.com.co';
        $mail->SMTPAuth   = true;
        $mail->Username   = 'notificaciones@gistore.com.co';
        $mail->Password   = 'G15tores260*';
        $mail->SMTPSecure = PHPMailer::ENCRYPTION_SMTPS;
        $mail->Port       = 465;
        $mail->CharSet    = 'UTF-8';
        $mail->Timeout    = 15;

        $mail->setFrom('notificaciones@gistore.com.co', 'GI Store');
        $mail->addAddress($destinatario);
        $mail->isHTML(true);
        $mail->Subject = "Tu código de recuperación: $codigo — GI Store";
        $mail->Body    = "
        <div style='font-family:Inter,Arial,sans-serif;max-width:480px;margin:0 auto;padding:2rem'>

          <div style='text-align:center;margin-bottom:1.75rem'>
            <div style='display:inline-block;background:#1a6b3c;border-radius:12px;padding:.7rem 1.5rem'>
              <img src='https://gistore.com.co/img/favicon/gi-icono-blanco.svg'
                   alt='GI Store'
                   width='36' height='36'
                   style='display:inline-block;vertical-align:middle;margin-right:.5rem'>
              <span style='color:#fff;font-size:1.1rem;font-weight:800;vertical-align:middle'>GI Store</span>
            </div>
          </div>

          <h2 style='color:#0f172a;font-size:1.2rem;font-weight:700;margin-bottom:.5rem'>
            Recupera tu contraseña
          </h2>
          <p style='color:#475569;font-size:.9rem;line-height:1.6;margin-bottom:1.5rem'>
            Recibimos una solicitud para restablecer tu contraseña.
            Usa el siguiente código en la página de recuperación:
          </p>

          <div style='text-align:center;margin:1.5rem 0'>
            <div style='display:inline-block;background:#f0faf4;border:2px dashed #34d399;
                        border-radius:14px;padding:1.25rem 2.5rem'>
              <span style='font-size:2.8rem;font-weight:800;letter-spacing:.4em;
                           color:#1a6b3c;font-family:monospace'>$codigo</span>
            </div>
            <p style='font-size:.78rem;color:#94a3b8;margin-top:.65rem'>
              ⏱ Expira en <strong>30 minutos</strong>
            </p>
          </div>

          <p style='color:#94a3b8;font-size:.78rem;line-height:1.6;
                    border-top:1px solid #e2e8f0;padding-top:1rem'>
            Si no solicitaste este cambio, ignora este correo — tu contraseña no será modificada.
          </p>

          <p style='color:#cbd5e1;font-size:.75rem;margin-top:.75rem;
                    background:#f8fafc;border-radius:8px;padding:.75rem;line-height:1.6'>
            ⚠️ Este es un mensaje automático. Por favor no respondas este correo,
            ya que no está siendo monitoreado. Si necesitas ayuda comunícate con
            soporte a través de la plataforma.
          </p>

          <p style='color:#94a3b8;font-size:.75rem;margin-top:.4rem'>
            © 2026 GI Store · Aguachica, Cesar
          </p>

        </div>";
        $mail->AltBody = "Tu código GI Store: $codigo — Expira en 30 minutos. Este es un mensaje automático, por favor no respondas este correo.";

        $mail->send();
        return ['ok' => true];

    } catch (Exception $e) {
        $errorInfo = $mail->ErrorInfo;
        error_log('PHPMailer ERROR [recuperar]: ' . $errorInfo);
        return ['ok' => false, 'detalle' => $errorInfo];
    }
}

// ════════════════════════════════════════════════════════════
//  ACCION: solicitar
//  POST: correo
// ════════════════════════════════════════════════════════════
function accion_solicitar(PDO $pdo): void {
    $correo = trim($_POST['correo'] ?? '');
    if (!$correo || !filter_var($correo, FILTER_VALIDATE_EMAIL))
        err('Ingresa un correo electrónico válido.');

    // Limpiar tokens expirados de toda la tabla
    $pdo->prepare(
        "DELETE FROM recuperar WHERE creado_en < DATE_SUB(NOW(), INTERVAL 30 MINUTE)"
    )->execute();

    // Verificar que el usuario existe y está activo (rol=2 vendedor)
    $stmt = $pdo->prepare(
        "SELECT id, activo FROM usuarios WHERE correo = ? AND rol = 2 LIMIT 1"
    );
    $stmt->execute([$correo]);
    $usuario = $stmt->fetch(PDO::FETCH_ASSOC);

    // Respuesta genérica si no existe — no revelar
    if (!$usuario || !(int)$usuario['activo'])
        ok(['enviado' => true, 'correo_mask' => enmascararCorreo($correo)]);

    // Generar código de 6 dígitos
    $codigo = str_pad((string)random_int(0, 999999), 6, '0', STR_PAD_LEFT);

    // Eliminar cualquier solicitud anterior del mismo correo
    $pdo->prepare("DELETE FROM recuperar WHERE correo = ?")->execute([$correo]);

    // Guardar nuevo token en tabla recuperar
    $stmt = $pdo->prepare(
        "INSERT INTO recuperar (correo, token, creado_en) VALUES (?, ?, NOW())"
    );
    $stmt->execute([$correo, (int)$codigo]);

    $insertId = (int)$pdo->lastInsertId();

    // Verificar que se guardó correctamente
    if ($insertId === 0)
        err('Error al guardar el código. Intenta de nuevo.');

    // Intentar enviar el correo
    $resultado = enviarCodigo($correo, $codigo);

    if (!$resultado['ok']) {
        // Revertir: eliminar el registro si el correo falló
        $pdo->prepare("DELETE FROM recuperar WHERE id = ?")->execute([$insertId]);

        // En producción, mensaje genérico. En desarrollo, puedes mostrar el detalle:
        // err('Error SMTP: ' . ($resultado['detalle'] ?? 'desconocido'));
        err('No se pudo enviar el correo. Verifica que la dirección sea correcta e intenta más tarde.');
    }

    ok(['enviado' => true, 'correo_mask' => enmascararCorreo($correo)]);
}

// ════════════════════════════════════════════════════════════
//  ACCION: verificar
//  POST: correo, codigo
// ════════════════════════════════════════════════════════════
function accion_verificar(PDO $pdo): void {
    $correo = trim($_POST['correo'] ?? '');
    $codigo = trim($_POST['codigo'] ?? '');

    if (!$correo || !$codigo) err('Datos incompletos.');

    // Buscar registro por correo y token, verificando expiración directo en SQL
    $stmt = $pdo->prepare(
        "SELECT r.id, u.id AS usuario_id
         FROM recuperar r
         JOIN usuarios u ON u.correo = r.correo
         WHERE r.correo = ?
           AND r.token  = ?
           AND r.creado_en >= DATE_SUB(NOW(), INTERVAL 30 MINUTE)
         LIMIT 1"
    );
    $stmt->execute([$correo, (int)$codigo]);
    $fila = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$fila) {
        // Distinguir entre código incorrecto y solicitud inexistente/expirada
        $existe = $pdo->prepare(
            "SELECT id FROM recuperar WHERE correo = ? LIMIT 1"
        );
        $existe->execute([$correo]);

        if ($existe->fetch())
            err('Código incorrecto o expirado. Verifica e intenta de nuevo.');
        else
            err('No hay solicitud activa para este correo. Solicita un código nuevo.');
    }

    // Guardar sesión temporal para accion=cambiar
    $_SESSION['recup_usuario_id'] = (int)$fila['usuario_id'];
    $_SESSION['recup_rec_id']     = (int)$fila['id'];
    $_SESSION['recup_time']       = time();

    ok(['verificado' => true]);
}

// ════════════════════════════════════════════════════════════
//  ACCION: cambiar
//  POST: pass_nueva, pass_conf
// ════════════════════════════════════════════════════════════
function accion_cambiar(PDO $pdo): void {
    $pass_nueva = trim($_POST['pass_nueva'] ?? '');
    $pass_conf  = trim($_POST['pass_conf']  ?? '');

    $usuario_id = $_SESSION['recup_usuario_id'] ?? null;
    $rec_id     = $_SESSION['recup_rec_id']     ?? null;
    $recup_time = $_SESSION['recup_time']        ?? 0;

    if (!$usuario_id || !$rec_id)
        err('Sesión inválida. Vuelve a ingresar el código.');

    // Sesión temporal válida por 10 minutos desde la verificación
    if ((time() - $recup_time) > 600)
        err('La sesión expiró. Vuelve a ingresar el código.');

    if (strlen($pass_nueva) < 6)    err('La contraseña debe tener al menos 6 caracteres.');
    if ($pass_nueva !== $pass_conf) err('Las contraseñas no coinciden.');

    // Verificar que el registro de recuperación aún existe en BD
    $check = $pdo->prepare("SELECT id FROM recuperar WHERE id = ? LIMIT 1");
    $check->execute([$rec_id]);
    if (!$check->fetch())
        err('El código ya fue usado o expiró. Solicita uno nuevo.');

    // Actualizar contraseña en usuarios
    $updated = $pdo->prepare(
        "UPDATE usuarios SET password_hash = ?, actualizado_en = NOW() WHERE id = ?"
    );
    $updated->execute([password_hash($pass_nueva, PASSWORD_DEFAULT), $usuario_id]);

    if ($updated->rowCount() === 0)
        err('No se pudo actualizar la contraseña. Intenta de nuevo.');

    // Eliminar el registro de recuperación usado
    $pdo->prepare("DELETE FROM recuperar WHERE id = ?")->execute([$rec_id]);

    // Limpiar sesión temporal
    unset($_SESSION['recup_usuario_id'], $_SESSION['recup_rec_id'], $_SESSION['recup_time']);

    ok(['cambiado' => true]);
}

// ── Router ────────────────────────────────────────────────
if ($_SERVER['REQUEST_METHOD'] !== 'POST') err('Método no permitido.', 405);

match ($_POST['accion'] ?? '') {
    'solicitar' => accion_solicitar($pdo),
    'verificar' => accion_verificar($pdo),
    'cambiar'   => accion_cambiar($pdo),
    default     => err('Acción no reconocida.', 404),
};