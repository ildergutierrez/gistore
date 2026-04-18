<?php
//================================================
// gistore/php/vendedores.php — Público, solo lectura
// Maneja: vendedores, vendedor, productos,
//         productos_vendedor, producto,
//         publicidades, impresion
//================================================

if (session_status() === PHP_SESSION_NONE)
    session_start();

header('Content-Type: application/json');

// ── Verificar token ───────────────────────────────────────
$token    = $_GET['token']  ?? $_POST['token']  ?? '';
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

// ── Conexión ──────────────────────────────────────────────
require_once __DIR__ . '/../backend/conexion.php';
$pdo = __Conectar();

// ── Helpers ───────────────────────────────────────────────
function ok(mixed $datos = null): never
{
    echo json_encode(['ok' => true, 'datos' => $datos], JSON_UNESCAPED_UNICODE);
    exit;
}
function error_respuesta(string $msg, int $codigo = 400): never
{
    http_response_code($codigo);
    echo json_encode(['ok' => false, 'error' => $msg], JSON_UNESCAPED_UNICODE);
    exit;
}
function resolverImagen(string $img): string
{
    if (!$img) return '';
    if (str_starts_with($img, 'http://') || str_starts_with($img, 'https://')) return $img;
    $protocolo = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ? 'https' : 'http';
    $dominio   = $protocolo . '://' . $_SERVER['HTTP_HOST'];
    $img       = ltrim($img, '/');
    return $dominio . '/' . $img;
}
function parsearBeneficios($raw): array
{
    if (!$raw) return [];
    $decoded = json_decode($raw, true);
    if (is_array($decoded)) return $decoded;
    return array_values(array_filter(array_map('trim', explode("\n", $raw))));
}

// ── Acción: vendedores activos ────────────────────────────
function obtener_Vendedores($pdo): void
{
    $stmt = $pdo->prepare("
        SELECT id, usuario_id, nombre, ciudad, correo, whatsapp,
               descripcion, perfil, color, url_web, redes, estado
        FROM vendedores
        WHERE estado = 'activo'
        ORDER BY nombre ASC
    ");
    $stmt->execute();
    $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
    $rows = array_map(function($v) {
        $v['perfil'] = resolverImagen($v['perfil'] ?? '');
        return $v;
    }, $rows);
    ok($rows);
}

// ── Acción: un vendedor por ID ────────────────────────────
function obtener_Vendedor($pdo): void
{
    $id = trim($_GET['id'] ?? '');
    if (!$id) error_respuesta('ID requerido.');

    $stmt = $pdo->prepare("
        SELECT id, usuario_id, nombre, ciudad, correo, whatsapp,
               descripcion, perfil, color, url_web, redes, estado
        FROM vendedores
        WHERE id = :id AND estado = 'activo'
        LIMIT 1
    ");
    $stmt->execute([':id' => $id]);
    $v = $stmt->fetch(PDO::FETCH_ASSOC);
    if (!$v) error_respuesta('Vendedor no encontrado.', 404);

    $v['perfil'] = resolverImagen($v['perfil'] ?? '');
    ok($v);
}

// ── Acción: todos los productos activos ───────────────────
function obtener_Productos($pdo): void
{
    $stmt = $pdo->prepare("
        SELECT p.id, p.vendedor_id, p.categoria_id, p.nombre,
               p.descripcion, p.recomendacion, p.beneficios,
               p.valor, p.imagen, p.activo,
               v.nombre      AS vendedor_nombre,
               v.whatsapp    AS vendedor_whatsapp,
               v.ciudad      AS vendedor_ciudad,
               v.perfil      AS vendedor_perfil,
               v.color       AS vendedor_color
        FROM productos p
        INNER JOIN vendedores v ON v.id = p.vendedor_id AND v.estado = 'activo'
        WHERE p.activo = 1
        ORDER BY p.nombre ASC
    ");
    $stmt->execute();
    $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
    $rows = array_map(function($p) {
        $p['beneficios']       = parsearBeneficios($p['beneficios']);
        $p['activo']           = (bool) $p['activo'];
        $p['imagen']           = resolverImagen($p['imagen'] ?? '');
        $p['vendedor_perfil']  = resolverImagen($p['vendedor_perfil'] ?? '');
        return $p;
    }, $rows);
    ok($rows);
}

// ── Acción: productos de un vendedor específico ───────────
function obtener_Productos_Vendedor($pdo): void
{
    $id = trim($_GET['id'] ?? '');
    if (!$id) error_respuesta('ID de vendedor requerido.');

    $stmt = $pdo->prepare("
        SELECT p.id, p.vendedor_id, p.categoria_id, p.nombre,
               p.descripcion, p.recomendacion, p.beneficios,
               p.valor, p.imagen, p.activo,
               v.nombre      AS vendedor_nombre,
               v.whatsapp    AS vendedor_whatsapp,
               v.ciudad      AS vendedor_ciudad,
               v.perfil      AS vendedor_perfil,
               v.color       AS vendedor_color
        FROM productos p
        INNER JOIN vendedores v ON v.id = p.vendedor_id AND v.estado = 'activo'
        WHERE p.activo = 1 AND p.vendedor_id = :id
        ORDER BY p.nombre ASC
    ");
    $stmt->execute([':id' => $id]);
    $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
    $rows = array_map(function($p) {
        $p['beneficios']      = parsearBeneficios($p['beneficios']);
        $p['activo']          = (bool) $p['activo'];
        $p['imagen']          = resolverImagen($p['imagen'] ?? '');
        $p['vendedor_perfil'] = resolverImagen($p['vendedor_perfil'] ?? '');
        return $p;
    }, $rows);
    ok($rows);
}

// ── Acción: un producto por ID ────────────────────────────
function obtener_Producto($pdo): void
{

    $id = intval($_GET['id'] ?? 0);
    if (!$id) error_respuesta('ID inválido.');

    $stmt = $pdo->prepare("
        SELECT p.id, p.vendedor_id, p.categoria_id, p.nombre,
               p.descripcion, p.recomendacion, p.beneficios,
               p.valor, p.imagen, p.activo,
               v.nombre      AS vendedor_nombre,
               v.whatsapp    AS vendedor_whatsapp,
               v.ciudad      AS vendedor_ciudad,
               v.perfil      AS vendedor_perfil,
               v.color       AS vendedor_color
        FROM productos p
        INNER JOIN vendedores v ON v.id = p.vendedor_id AND v.estado = 'activo'
        WHERE p.id = ? AND p.activo = 1
        LIMIT 1
    ");
    $stmt->execute([$id]);
    $p = $stmt->fetch(PDO::FETCH_ASSOC);
    if (!$p) error_respuesta('Producto no encontrado.', 404);

    $p['beneficios']      = parsearBeneficios($p['beneficios']);
    $p['activo']          = (bool) $p['activo'];
    $p['imagen']          = resolverImagen($p['imagen'] ?? '');
    $p['vendedor_perfil'] = resolverImagen($p['vendedor_perfil'] ?? '');
    ok($p);
}

// ── Acción: publicidades activas ──────────────────────────
function obtener_Publicidades($pdo): void
{
    $hoy  = date('Y-m-d');
    $stmt = $pdo->prepare("
        SELECT p.id, p.titulo, p.imagen_url, p.url_destino,
               p.fecha_inicio, p.fecha_fin, p.limite_diario, p.estado,
               COALESCE(pi.contador, 0) AS impresiones_hoy
        FROM publicidad p
        LEFT JOIN publicidad_impresiones pi
               ON pi.publicidad_id = p.id AND pi.fecha = :hoy
        WHERE p.estado IN ('activa', 'pausada_auto')
          AND p.fecha_inicio <= :hoy2
          AND p.fecha_fin    >= :hoy3
        ORDER BY impresiones_hoy ASC
    ");
    $stmt->execute([':hoy' => $hoy, ':hoy2' => $hoy, ':hoy3' => $hoy]);
    $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
    $rows = array_map(function($p) {
        $p['limite_diario']   = (int) $p['limite_diario'];
        $p['impresiones_hoy'] = (int) $p['impresiones_hoy'];
        return $p;
    }, $rows);
    ok($rows);
}

// ── Acción: registrar impresión ───────────────────────────
function registrar_Impresion($pdo): void
{
    $id  = intval($_GET['id'] ?? 0);
    $hoy = date('Y-m-d');
    if (!$id) error_respuesta('ID inválido.');

    $stmt = $pdo->prepare("
        INSERT INTO publicidad_impresiones (publicidad_id, fecha, contador)
        VALUES (:id, :hoy, 1)
        ON DUPLICATE KEY UPDATE contador = contador + 1
    ");
    $stmt->execute([':id' => $id, ':hoy' => $hoy]);
    ok(['registrado' => true]);
}

// ── Router ────────────────────────────────────────────────
$accion = $_GET['accion'] ?? '';

match ($accion) {
    'vendedores'         => obtener_Vendedores($pdo),
    'vendedor'           => obtener_Vendedor($pdo),
    'productos'          => obtener_Productos($pdo),
    'productos_vendedor' => obtener_Productos_Vendedor($pdo),
    'producto'           => obtener_Producto($pdo),
    'publicidades'       => obtener_Publicidades($pdo),
    'impresion'          => registrar_Impresion($pdo),
    default              => error_respuesta('Acción no reconocida.', 404),
};