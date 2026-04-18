<?php
// ============================================================
//  user/backend/videos.php
//  Devuelve las imágenes de los productos activos del vendedor
//  para el módulo de generación de videos publicitarios.
// ============================================================

if (session_status() === PHP_SESSION_NONE)
    session_start();

header('Content-Type: application/json');

// ── Autenticación ────────────────────────────────────────
if (empty($_SESSION['usuario_id']) || (int)($_SESSION['rol'] ?? 0) !== 2) {
    http_response_code(401);
    die(json_encode(['ok' => false, 'error' => 'No autenticado.']));
}

// ── CSRF ─────────────────────────────────────────────────
$token    = $_GET['token'] ?? '';
$guardado = $_SESSION['csrf_token']      ?? '';
$tiempo   = $_SESSION['csrf_token_time'] ?? 0;

if (!$token || !$guardado || !hash_equals($guardado, $token)) {
    http_response_code(403);
    die(json_encode(['ok' => false, 'error' => 'Token inválido']));
}
if ((time() - $tiempo) > 7200) {
    http_response_code(403);
    die(json_encode(['ok' => false, 'error' => 'Token expirado']));
}

// ── Conexión ─────────────────────────────────────────────
require_once __DIR__ . '/../../backend/conexion.php';
$pdo = __Conectar();

// ── Vendedor ─────────────────────────────────────────────
$stmt = $pdo->prepare("SELECT id FROM vendedores WHERE usuario_id = ? LIMIT 1");
$stmt->execute([(int)$_SESSION['usuario_id']]);
$vendedor = $stmt->fetch(PDO::FETCH_ASSOC);

if (!$vendedor) {
    http_response_code(404);
    die(json_encode(['ok' => false, 'error' => 'Vendedor no encontrado.']));
}

$vendedor_id = (int)$vendedor['id'];

// ── Detectar dominio base ─────────────────────────────────
$protocolo  = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ? 'https' : 'http';
$dominio    = $protocolo . '://' . $_SERVER['HTTP_HOST'];

// ── Accion: listar imágenes de productos activos ──────────
$accion = $_GET['accion'] ?? 'imagenes';

if ($accion === 'imagenes') {
    $stmt = $pdo->prepare("
        SELECT id, nombre, imagen
        FROM productos
        WHERE vendedor_id = ?
          AND activo      = 1
          AND imagen IS NOT NULL
          AND imagen     != ''
        ORDER BY nombre ASC
    ");
    $stmt->execute([$vendedor_id]);
    $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

    $resultado = [];
    foreach ($rows as $p) {
        $img = trim($p['imagen']);
        if (!$img) continue;

        // URL externa (Cloudinary, http/https) → usar tal cual
        if (str_starts_with($img, 'http://') || str_starts_with($img, 'https://')) {
            $url = $img;
        }
        // Ruta local que contiene img/ → construir URL completa del dominio
        elseif (str_contains($img, 'img/')) {
            // Limpiar "../" o "/" al inicio y armar URL absoluta
            $limpia = ltrim(preg_replace('/^(\.\.\/)+/', '', $img), '/');
            $url    = $dominio . '/' . $limpia;
        }
        // Cualquier otra ruta relativa
        else {
            $limpia = ltrim(preg_replace('/^(\.\.\/)+/', '', $img), '/');
            $url    = $dominio . '/' . $limpia;
        }

        $resultado[] = [
            'id'     => (int)$p['id'],
            'nombre' => $p['nombre'],
            'url'    => $url,
        ];
    }

    __Desconectar($pdo);
    echo json_encode(['ok' => true, 'datos' => $resultado], JSON_UNESCAPED_UNICODE);
    exit;
}

http_response_code(400);
echo json_encode(['ok' => false, 'error' => 'Acción no válida']);