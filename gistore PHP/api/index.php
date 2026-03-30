<?php
// ============================================================
//  api/index.php — API REST central de GI Store
//  Reemplaza Firestore + Cloud Functions + Firebase Auth
//
//  Rutas disponibles:
//    POST   /api/auth/login
//    POST   /api/auth/logout
//    GET    /api/auth/sesion
//
//    GET    /api/vendedores
//    GET    /api/vendedores/{id}
//    POST   /api/vendedores
//    PUT    /api/vendedores/{id}
//    POST   /api/vendedores/{id}/desactivar
//    POST   /api/vendedores/{id}/reactivar
//
//    GET    /api/categorias
//    POST   /api/categorias
//    PUT    /api/categorias/{id}
//    DELETE /api/categorias/{id}
//
//    GET    /api/productos
//    GET    /api/productos/{id}
//    POST   /api/productos
//    PUT    /api/productos/{id}
//    DELETE /api/productos/{id}
//    GET    /api/productos/vendedor/{vendedor_id}
//
//    GET    /api/membresias
//    GET    /api/membresias/vendedor/{vendedor_id}
//    POST   /api/membresias
//    PUT    /api/membresias/{id}
//    DELETE /api/membresias/{id}
//
//    GET    /api/planes
//    POST   /api/planes
//    PUT    /api/planes/{id}
//    DELETE /api/planes/{id}
//
//    GET    /api/publicidad
//    GET    /api/publicidad/activas
//    POST   /api/publicidad
//    PUT    /api/publicidad/{id}
//    DELETE /api/publicidad/{id}
//    POST   /api/publicidad/{id}/impresion
//
//    GET    /api/fundadores
//    POST   /api/fundadores
//    GET    /api/fundadores/contar
//
//    GET    /api/foro/hilos
//    GET    /api/foro/hilos/{id}/respuestas
//    POST   /api/foro/hilos
//    POST   /api/foro/hilos/{id}/respuestas
//    DELETE /api/foro/hilos/{id}
//    DELETE /api/foro/respuestas/{id}
//
//    GET    /api/api-claves
//    GET    /api/api-claves/servicio/{servicio}
//    POST   /api/api-claves
//    PUT    /api/api-claves/{id}
//    DELETE /api/api-claves/{id}
//
//    POST   /api/wompi/firma
//    POST   /api/wompi/webhook
//
//    GET    /api/dashboard/stats
//
//    --- Portal Vendedor (requiere sesión vendedor) ---
//    GET    /api/me/vendedor
//    PUT    /api/me/vendedor
//    GET    /api/me/membresia
//    GET    /api/me/productos
//    POST   /api/me/productos
//    PUT    /api/me/productos/{id}
//    DELETE /api/me/productos/{id}
//    GET    /api/me/catalogo
// ============================================================

declare(strict_types=1);

// ── CORS ─────────────────────────────────────────────────
// Permitir el origen exacto que hace la petición (necesario con credentials: include)
$origen_env     = getenv('CORS_ORIGIN') ?: null;
$origen_request = $_SERVER['HTTP_ORIGIN'] ?? '';

// Orígenes válidos: el configurado en .env/SetEnv, o localhost/127.0.0.1 en desarrollo
$origenes_dev = [
    'http://localhost',
    'http://localhost:80',
    'http://127.0.0.1',
    'http://127.0.0.1:80',
    'http://localhost:3000',
    'http://127.0.0.1:3000',
];

if ($origen_env && $origen_request === $origen_env) {
    header("Access-Control-Allow-Origin: $origen_request");
} elseif (in_array($origen_request, $origenes_dev)) {
    header("Access-Control-Allow-Origin: $origen_request");
} elseif ($origen_request) {
    // Mismo dominio: permitir
    header("Access-Control-Allow-Origin: $origen_request");
} else {
    header('Access-Control-Allow-Origin: *');
}

header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With');
header('Access-Control-Allow-Credentials: true');
header('Vary: Origin');
header('Content-Type: application/json; charset=utf-8');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

// ── Conexión ─────────────────────────────────────────────
require_once __DIR__ . '/../conexion.php';

// ── Sesión segura ─────────────────────────────────────────
session_set_cookie_params([
    'lifetime' => 0,
    'path'     => '/',
    'secure'   => true,           // solo HTTPS — cambia a false en local
    'httponly' => true,           // inaccesible a JS
    'samesite' => 'Lax',
]);
session_start();

// ── Parsear método y ruta ─────────────────────────────────
$metodo = $_SERVER['REQUEST_METHOD'];
$uri    = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);

// Normalizar: quitar prefijo /api
$uri = preg_replace('#^/api#', '', $uri);
$uri = rtrim($uri, '/') ?: '/';

// Leer body JSON
$body = [];
$raw  = file_get_contents('php://input');
if ($raw) {
    $body = json_decode($raw, true) ?? [];
}

// ── Helpers de respuesta ──────────────────────────────────
function ok(mixed $datos = null, int $codigo = 200): never {
    http_response_code($codigo);
    echo json_encode(['ok' => true, 'datos' => $datos], JSON_UNESCAPED_UNICODE);
    exit;
}
function error(string $mensaje, int $codigo = 400): never {
    http_response_code($codigo);
    echo json_encode(['ok' => false, 'error' => $mensaje], JSON_UNESCAPED_UNICODE);
    exit;
}
function no_autorizado(): never { error('No autorizado', 401); }
function no_encontrado(): never { error('Recurso no encontrado', 404); }

// ── Helpers de sesión ─────────────────────────────────────
function sesion_usuario(): ?array {
    return $_SESSION['usuario'] ?? null;
}
function requerir_admin(): array {
    $u = sesion_usuario();
    if (!$u || (int)$u['rol'] !== 1) no_autorizado();
    return $u;
}
function requerir_vendedor(): array {
    $u = sesion_usuario();
    if (!$u || (int)$u['rol'] !== 2) no_autorizado();
    return $u;
}
function requerir_autenticado(): array {
    $u = sesion_usuario();
    if (!$u) no_autorizado();
    return $u;
}

// ════════════════════════════════════════════════════════════
//  RUTAS
// ════════════════════════════════════════════════════════════

// ── AUTH ─────────────────────────────────────────────────
if ($uri === '/auth/login' && $metodo === 'POST') {
    $correo    = trim($body['correo']    ?? '');
    $password  = trim($body['password'] ?? '');

    if (!$correo || !$password) error('Correo y contraseña requeridos');

    $stmt = $pdo->prepare('SELECT * FROM usuarios WHERE correo = ? AND activo = 1 LIMIT 1');
    $stmt->execute([$correo]);
    $usuario = $stmt->fetch();

    if (!$usuario || !password_verify($password, $usuario['password_hash'])) {
        error('Correo o contraseña incorrectos', 401);
    }

    // Actualizar hash si se usó un algoritmo más débil
    if (password_needs_rehash($usuario['password_hash'], PASSWORD_BCRYPT, ['cost' => 12])) {
        $nuevo = password_hash($password, PASSWORD_BCRYPT, ['cost' => 12]);
        $pdo->prepare('UPDATE usuarios SET password_hash = ? WHERE id = ?')
            ->execute([$nuevo, $usuario['id']]);
    }

    // Si es vendedor, verificar que no esté desactivado
    if ((int)$usuario['rol'] === 2) {
        $sv = $pdo->prepare('SELECT estado FROM vendedores WHERE usuario_id = ? LIMIT 1');
        $sv->execute([$usuario['id']]);
        $v = $sv->fetch();
        if ($v && $v['estado'] === 'desactivado') {
            error('__DESACTIVADO__', 403);
        }
    }

    // Regenerar ID de sesión para prevenir fijación
    session_regenerate_id(true);

    $_SESSION['usuario'] = [
        'id'     => $usuario['id'],
        'correo' => $usuario['correo'],
        'rol'    => (int)$usuario['rol'],
    ];

    // Para vendedores, cargar también su vendedor_id
    if ((int)$usuario['rol'] === 2) {
        $sv = $pdo->prepare('SELECT id FROM vendedores WHERE usuario_id = ? LIMIT 1');
        $sv->execute([$usuario['id']]);
        $vd = $sv->fetch();
        $_SESSION['usuario']['vendedor_id'] = $vd['id'] ?? null;
    }

    ok([
        'id'     => $usuario['id'],
        'correo' => $usuario['correo'],
        'rol'    => (int)$usuario['rol'],
    ]);
}

if ($uri === '/auth/logout' && $metodo === 'POST') {
    $_SESSION = [];
    session_destroy();
    ok(['mensaje' => 'Sesión cerrada']);
}

if ($uri === '/auth/sesion' && $metodo === 'GET') {
    $u = sesion_usuario();
    if (!$u) error('Sin sesión', 401);
    ok($u);
}

// ── DASHBOARD STATS (solo admin) ──────────────────────────
if ($uri === '/dashboard/stats' && $metodo === 'GET') {
    requerir_admin();

    $stats = [];
    $stats['total_vendedores']  = $pdo->query('SELECT COUNT(*) FROM vendedores')->fetchColumn();
    $stats['vendedores_activos'] = $pdo->query("SELECT COUNT(*) FROM vendedores WHERE estado='activo'")->fetchColumn();
    $stats['total_productos']   = $pdo->query('SELECT COUNT(*) FROM productos')->fetchColumn();
    $stats['productos_activos'] = $pdo->query('SELECT COUNT(*) FROM productos WHERE activo=1')->fetchColumn();
    $stats['membresias_activas'] = $pdo->query("SELECT COUNT(*) FROM membresias WHERE estado='activa' AND fecha_fin >= CURDATE()")->fetchColumn();
    $stats['total_categorias']  = $pdo->query('SELECT COUNT(*) FROM categorias')->fetchColumn();
    $stats['total_fundadores']  = $pdo->query('SELECT COUNT(*) FROM fundadores')->fetchColumn();
    ok($stats);
}

// ── VENDEDORES ────────────────────────────────────────────
if ($uri === '/vendedores' && $metodo === 'GET') {
    $estado = $_GET['estado'] ?? null;
    // Público: solo vendedores activos (para catálogo, tiendas, etc.)
    // Privado: listado completo requiere admin
    if ($estado === 'activo') {
        // Consulta pública — solo campos necesarios para el frontend
        $stmt = $pdo->query("SELECT id, nombre, ciudad, descripcion, perfil, color, url_web, redes, estado FROM vendedores WHERE estado = 'activo' ORDER BY nombre ASC");
        ok($stmt->fetchAll());
    }
    requerir_admin();
    if ($estado) {
        $stmt = $pdo->prepare('SELECT * FROM vendedores WHERE estado = ? ORDER BY creado_en DESC');
        $stmt->execute([$estado]);
    } else {
        $stmt = $pdo->query('SELECT * FROM vendedores ORDER BY creado_en DESC');
    }
    ok($stmt->fetchAll());
}

if ($uri === '/vendedores' && $metodo === 'POST') {
    requerir_admin();
    $id = uuid4();
    $pdo->prepare('INSERT INTO vendedores (id,nombre,ciudad,correo,whatsapp,descripcion,perfil,color,estado) VALUES (?,?,?,?,?,?,?,?,?)')
        ->execute([
            $id,
            $body['nombre']      ?? '',
            $body['ciudad']      ?? '',
            $body['correo']      ?? '',
            $body['whatsapp']    ?? '',
            $body['descripcion'] ?? '',
            $body['perfil']      ?? '',
            $body['color']       ?? '#1a6b3c',
            $body['estado']      ?? 'inactivo',
        ]);
    ok(['id' => $id], 201);
}

if (preg_match('#^/vendedores/([^/]+)$#', $uri, $m)) {
    $vid = $m[1];

    if ($metodo === 'GET') {
        $u = sesion_usuario();
        // Admin puede ver cualquiera; vendedor solo el suyo
        if (!$u) no_autorizado();
        if ((int)$u['rol'] === 2 && ($u['vendedor_id'] ?? null) !== $vid) no_autorizado();

        $stmt = $pdo->prepare('SELECT * FROM vendedores WHERE id = ? LIMIT 1');
        $stmt->execute([$vid]);
        $v = $stmt->fetch();
        if (!$v) no_encontrado();
        ok($v);
    }

    if ($metodo === 'PUT') {
        $u = sesion_usuario();
        if (!$u) no_autorizado();
        // Admin puede editar cualquiera; vendedor solo el suyo
        if ((int)$u['rol'] === 2 && ($u['vendedor_id'] ?? null) !== $vid) no_autorizado();

        $campos  = ['nombre','ciudad','correo','whatsapp','descripcion','perfil','color','url_web','redes','estado'];
        $updates = [];
        $vals    = [];
        foreach ($campos as $c) {
            if (array_key_exists($c, $body)) {
                $updates[] = "$c = ?";
                $vals[]    = is_array($body[$c]) ? json_encode($body[$c]) : $body[$c];
            }
        }
        if (empty($updates)) error('Sin campos para actualizar');
        $vals[] = $vid;
        $pdo->prepare('UPDATE vendedores SET ' . implode(', ', $updates) . ' WHERE id = ?')
            ->execute($vals);
        ok(['actualizado' => true]);
    }
}

if (preg_match('#^/vendedores/([^/]+)/desactivar$#', $uri, $m) && $metodo === 'POST') {
    requerir_admin();
    $vid = $m[1];
    // Desactivar cuenta de usuario asociada
    $pdo->prepare("UPDATE usuarios u JOIN vendedores v ON v.usuario_id = u.id SET u.activo = 0 WHERE v.id = ?")
        ->execute([$vid]);
    // Marcar vendedor como desactivado
    $pdo->prepare("UPDATE vendedores SET estado = 'desactivado' WHERE id = ?")
        ->execute([$vid]);
    // Desactivar todos sus productos
    $pdo->prepare("UPDATE productos SET activo = 0 WHERE vendedor_id = ?")
        ->execute([$vid]);
    ok(['desactivado' => true]);
}

if (preg_match('#^/vendedores/([^/]+)/reactivar$#', $uri, $m) && $metodo === 'POST') {
    requerir_admin();
    $vid = $m[1];
    // Reactivar cuenta de usuario
    $pdo->prepare("UPDATE usuarios u JOIN vendedores v ON v.usuario_id = u.id SET u.activo = 1 WHERE v.id = ?")
        ->execute([$vid]);
    // Verificar si tiene membresía vigente
    $stmt = $pdo->prepare("SELECT * FROM membresias WHERE vendedor_id = ? AND estado = 'activa' AND fecha_fin >= CURDATE() LIMIT 1");
    $stmt->execute([$vid]);
    $vigente = (bool)$stmt->fetch();
    $nuevoEstado = $vigente ? 'activo' : 'inactivo';
    $pdo->prepare("UPDATE vendedores SET estado = ? WHERE id = ?")
        ->execute([$nuevoEstado, $vid]);
    if ($vigente) {
        $pdo->prepare("UPDATE productos SET activo = 1 WHERE vendedor_id = ?")
            ->execute([$vid]);
    }
    ok(['reactivado' => true, 'vigente' => $vigente]);
}

// ── CREAR USUARIO PARA VENDEDOR ───────────────────────────
if ($uri === '/vendedores/crear-cuenta' && $metodo === 'POST') {
    requerir_admin();
    $correo   = trim($body['correo']   ?? '');
    $password = trim($body['password'] ?? '');
    $vid      = trim($body['vendedor_id'] ?? '');
    if (!$correo || !$password || !$vid) error('Datos incompletos');

    // Verificar que el vendedor existe
    $stmt = $pdo->prepare('SELECT id FROM vendedores WHERE id = ? LIMIT 1');
    $stmt->execute([$vid]);
    if (!$stmt->fetch()) error('Vendedor no encontrado', 404);

    // Crear usuario
    $hash = password_hash($password, PASSWORD_BCRYPT, ['cost' => 12]);
    try {
        $pdo->prepare('INSERT INTO usuarios (correo, password_hash, rol) VALUES (?, ?, 2)')
            ->execute([$correo, $hash]);
        $uid = $pdo->lastInsertId();
        // Vincular
        $pdo->prepare('UPDATE vendedores SET usuario_id = ? WHERE id = ?')
            ->execute([$uid, $vid]);
        ok(['usuario_id' => $uid]);
    } catch (PDOException $e) {
        if ($e->getCode() == 23000) error('Ya existe un usuario con ese correo');
        throw $e;
    }
}

// ── CATEGORÍAS ────────────────────────────────────────────
if ($uri === '/categorias' && $metodo === 'GET') {
    // Público
    $stmt = $pdo->query('SELECT * FROM categorias ORDER BY orden ASC, nombre ASC');
    ok($stmt->fetchAll());
}

if ($uri === '/categorias' && $metodo === 'POST') {
    requerir_admin();
    $id = uuid4();
    $pdo->prepare('INSERT INTO categorias (id,nombre,orden) VALUES (?,?,?)')
        ->execute([$id, $body['nombre'] ?? '', (int)($body['orden'] ?? 0)]);
    ok(['id' => $id], 201);
}

if (preg_match('#^/categorias/([^/]+)$#', $uri, $m)) {
    $cid = $m[1];
    if ($metodo === 'PUT') {
        requerir_admin();
        $pdo->prepare('UPDATE categorias SET nombre = ?, orden = ? WHERE id = ?')
            ->execute([$body['nombre'] ?? '', (int)($body['orden'] ?? 0), $cid]);
        ok(['actualizado' => true]);
    }
    if ($metodo === 'DELETE') {
        requerir_admin();
        $pdo->prepare('DELETE FROM categorias WHERE id = ?')->execute([$cid]);
        ok(['eliminado' => true]);
    }
}

// ── PRODUCTOS ─────────────────────────────────────────────
if ($uri === '/productos' && $metodo === 'GET') {
    $solo_activos = ($_GET['activos'] ?? null) === '1';
    if ($solo_activos) {
        $stmt = $pdo->query('SELECT * FROM productos WHERE activo = 1 ORDER BY nombre ASC');
    } else {
        $u = sesion_usuario();
        if (!$u || (int)$u['rol'] !== 1) error('No autorizado', 401);
        $stmt = $pdo->query('SELECT * FROM productos ORDER BY creado_en DESC');
    }
    $rows = $stmt->fetchAll();
    foreach ($rows as &$r) {
        $r['beneficios'] = $r['beneficios'] ? json_decode($r['beneficios'], true) : [];
    }
    ok($rows);
}

if (preg_match('#^/productos/vendedor/([^/]+)$#', $uri, $m) && $metodo === 'GET') {
    $u = sesion_usuario();
    if (!$u) no_autorizado();
    $vid = $m[1];
    if ((int)$u['rol'] === 2 && ($u['vendedor_id'] ?? null) !== $vid) no_autorizado();
    $stmt = $pdo->prepare('SELECT * FROM productos WHERE vendedor_id = ? ORDER BY creado_en DESC');
    $stmt->execute([$vid]);
    $rows = $stmt->fetchAll();
    foreach ($rows as &$r) { $r['beneficios'] = $r['beneficios'] ? json_decode($r['beneficios'], true) : []; }
    ok($rows);
}

if (preg_match('#^/productos/([^/]+)$#', $uri, $m)) {
    $pid = $m[1];

    if ($metodo === 'GET') {
        $stmt = $pdo->prepare('SELECT * FROM productos WHERE id = ? LIMIT 1');
        $stmt->execute([$pid]);
        $p = $stmt->fetch();
        if (!$p) no_encontrado();
        $p['beneficios'] = $p['beneficios'] ? json_decode($p['beneficios'], true) : [];
        ok($p);
    }

    if ($metodo === 'PUT') {
        $u = sesion_usuario();
        if (!$u) no_autorizado();
        // Verificar propiedad si es vendedor
        if ((int)$u['rol'] === 2) {
            $stmt = $pdo->prepare('SELECT vendedor_id FROM productos WHERE id = ? LIMIT 1');
            $stmt->execute([$pid]);
            $p = $stmt->fetch();
            if (!$p || $p['vendedor_id'] !== ($u['vendedor_id'] ?? null)) no_autorizado();
        }
        $campos = ['nombre','descripcion','recomendacion','beneficios','valor','imagen','categoria_id','activo'];
        $upds = []; $vals = [];
        foreach ($campos as $c) {
            if (array_key_exists($c, $body)) {
                $upds[] = "$c = ?";
                $vals[] = ($c === 'beneficios' && is_array($body[$c])) ? json_encode($body[$c]) : $body[$c];
            }
        }
        if (empty($upds)) error('Sin campos');
        $vals[] = $pid;
        $pdo->prepare('UPDATE productos SET ' . implode(', ', $upds) . ' WHERE id = ?')->execute($vals);
        ok(['actualizado' => true]);
    }

    if ($metodo === 'DELETE') {
        $u = sesion_usuario();
        if (!$u) no_autorizado();
        if ((int)$u['rol'] === 2) {
            $stmt = $pdo->prepare('SELECT vendedor_id FROM productos WHERE id = ? LIMIT 1');
            $stmt->execute([$pid]);
            $p = $stmt->fetch();
            if (!$p || $p['vendedor_id'] !== ($u['vendedor_id'] ?? null)) no_autorizado();
        }
        $pdo->prepare('DELETE FROM productos WHERE id = ?')->execute([$pid]);
        ok(['eliminado' => true]);
    }
}

if ($uri === '/productos' && $metodo === 'POST') {
    $u = sesion_usuario();
    if (!$u) no_autorizado();
    $vid = ((int)$u['rol'] === 2) ? ($u['vendedor_id'] ?? null) : ($body['vendedor_id'] ?? null);
    if (!$vid) error('vendedor_id requerido');
    $id = uuid4();
    $pdo->prepare('INSERT INTO productos (id,vendedor_id,categoria_id,nombre,descripcion,recomendacion,beneficios,valor,imagen,activo) VALUES (?,?,?,?,?,?,?,?,?,?)')
        ->execute([
            $id, $vid,
            $body['categoria_id']  ?? '',
            $body['nombre']        ?? '',
            $body['descripcion']   ?? '',
            $body['recomendacion'] ?? '',
            json_encode($body['beneficios'] ?? []),
            (float)($body['valor'] ?? 0),
            $body['imagen']        ?? '',
            isset($body['activo']) ? (int)$body['activo'] : 1,
        ]);
    ok(['id' => $id], 201);
}

// ── PLANES DE MEMBRESÍA ───────────────────────────────────
if ($uri === '/planes' && $metodo === 'GET') {
    $stmt = $pdo->query('SELECT * FROM planes_membresia ORDER BY orden ASC');
    ok($stmt->fetchAll());
}

if ($uri === '/planes' && $metodo === 'POST') {
    requerir_admin();
    $id = uuid4();
    $pdo->prepare('INSERT INTO planes_membresia (id,nombre,descripcion,precio,duracion_dias,activo,orden) VALUES (?,?,?,?,?,?,?)')
        ->execute([$id,$body['nombre']??'',$body['descripcion']??'',(float)($body['precio']??0),(int)($body['duracion_dias']??30),isset($body['activo'])?(int)$body['activo']:1,(int)($body['orden']??0)]);
    ok(['id' => $id], 201);
}

if (preg_match('#^/planes/([^/]+)$#', $uri, $m)) {
    $plid = $m[1];
    if ($metodo === 'PUT') {
        requerir_admin();
        $pdo->prepare('UPDATE planes_membresia SET nombre=?,descripcion=?,precio=?,duracion_dias=?,activo=?,orden=? WHERE id=?')
            ->execute([$body['nombre']??'',$body['descripcion']??'',(float)($body['precio']??0),(int)($body['duracion_dias']??30),isset($body['activo'])?(int)$body['activo']:1,(int)($body['orden']??0),$plid]);
        ok(['actualizado' => true]);
    }
    if ($metodo === 'DELETE') {
        requerir_admin();
        $pdo->prepare('DELETE FROM planes_membresia WHERE id = ?')->execute([$plid]);
        ok(['eliminado' => true]);
    }
}

// ── MEMBRESÍAS ────────────────────────────────────────────
if ($uri === '/membresias' && $metodo === 'GET') {
    requerir_admin();
    $stmt = $pdo->query('SELECT m.*, v.nombre AS vendedor_nombre FROM membresias m LEFT JOIN vendedores v ON v.id = m.vendedor_id ORDER BY m.creado_en DESC');
    ok($stmt->fetchAll());
}

if (preg_match('#^/membresias/vendedor/([^/]+)$#', $uri, $m) && $metodo === 'GET') {
    $u = sesion_usuario();
    if (!$u) no_autorizado();
    $vid = $m[1];
    if ((int)$u['rol'] === 2 && ($u['vendedor_id'] ?? null) !== $vid) no_autorizado();
    $stmt = $pdo->prepare('SELECT * FROM membresias WHERE vendedor_id = ? ORDER BY fecha_fin DESC');
    $stmt->execute([$vid]);
    ok($stmt->fetchAll());
}

if ($uri === '/membresias' && $metodo === 'POST') {
    requerir_admin();
    $vid  = $body['vendedor_id']  ?? '';
    $fin  = $body['fecha_fin']    ?? '';
    $ini  = $body['fecha_inicio'] ?? date('Y-m-d');
    $id   = uuid4();
    $pdo->prepare('INSERT INTO membresias (id,vendedor_id,plan_id,fecha_inicio,fecha_fin,estado,notas) VALUES (?,?,?,?,?,?,?)')
        ->execute([$id,$vid,$body['plan_id']??null,$ini,$fin,$body['estado']??'activa',$body['notas']??'']);
    // Actualizar estado del vendedor
    $hoy = date('Y-m-d');
    $activo = ($body['estado'] === 'activa' && $fin >= $hoy);
    $pdo->prepare("UPDATE vendedores SET estado = ? WHERE id = ?")
        ->execute([$activo ? 'activo' : 'inactivo', $vid]);
    if ($activo) {
        $pdo->prepare("UPDATE productos SET activo = 1 WHERE vendedor_id = ?")
            ->execute([$vid]);
    }
    ok(['id' => $id], 201);
}

if (preg_match('#^/membresias/([^/]+)$#', $uri, $m)) {
    $mid = $m[1];
    if ($metodo === 'PUT') {
        requerir_admin();
        $pdo->prepare('UPDATE membresias SET plan_id=?,fecha_inicio=?,fecha_fin=?,estado=?,notas=? WHERE id=?')
            ->execute([$body['plan_id']??null,$body['fecha_inicio']??'',$body['fecha_fin']??'',$body['estado']??'activa',$body['notas']??'',$mid]);
        // Sincronizar vendedor
        $stmt = $pdo->prepare('SELECT * FROM membresias WHERE id = ? LIMIT 1');
        $stmt->execute([$mid]);
        $mem = $stmt->fetch();
        if ($mem) {
            $hoy    = date('Y-m-d');
            $activo = ($mem['estado'] === 'activa' && $mem['fecha_fin'] >= $hoy);
            $pdo->prepare("UPDATE vendedores SET estado = ? WHERE id = ?")
                ->execute([$activo ? 'activo' : 'inactivo', $mem['vendedor_id']]);
            $pdo->prepare("UPDATE productos SET activo = ? WHERE vendedor_id = ?")
                ->execute([$activo ? 1 : 0, $mem['vendedor_id']]);
        }
        ok(['actualizado' => true]);
    }
    if ($metodo === 'DELETE') {
        requerir_admin();
        $stmt = $pdo->prepare('SELECT * FROM membresias WHERE id = ? LIMIT 1');
        $stmt->execute([$mid]);
        $mem = $stmt->fetch();
        if ($mem) {
            $pdo->prepare("UPDATE vendedores SET estado = 'inactivo' WHERE id = ?")
                ->execute([$mem['vendedor_id']]);
            $pdo->prepare("UPDATE productos SET activo = 0 WHERE vendedor_id = ?")
                ->execute([$mem['vendedor_id']]);
        }
        $pdo->prepare('DELETE FROM membresias WHERE id = ?')->execute([$mid]);
        ok(['eliminado' => true]);
    }
}

// ── FUNDADORES ────────────────────────────────────────────
if ($uri === '/fundadores/contar' && $metodo === 'GET') {
    ok(['total' => (int)$pdo->query('SELECT COUNT(*) FROM fundadores')->fetchColumn()]);
}

if ($uri === '/fundadores' && $metodo === 'GET') {
    requerir_admin();
    $stmt = $pdo->query('SELECT f.*, v.nombre AS vendedor_nombre FROM fundadores f LEFT JOIN vendedores v ON v.id = f.vendedor_id ORDER BY f.fecha_registro ASC');
    ok($stmt->fetchAll());
}

if ($uri === '/fundadores' && $metodo === 'POST') {
    requerir_admin();
    $vid = $body['vendedor_id'] ?? '';
    if (!$vid) error('vendedor_id requerido');
    $total = (int)$pdo->query('SELECT COUNT(*) FROM fundadores')->fetchColumn();
    if ($total >= 15) error('Cupo de fundadores lleno (máximo 15)');
    $stmt = $pdo->prepare('SELECT id FROM fundadores WHERE vendedor_id = ? LIMIT 1');
    $stmt->execute([$vid]);
    if ($stmt->fetch()) error('El vendedor ya es fundador');
    $pdo->prepare('INSERT INTO fundadores (vendedor_id, fecha_registro) VALUES (?, ?)')
        ->execute([$vid, date('Y-m-d')]);
    ok(['registrado' => true], 201);
}

// ── PUBLICIDAD ────────────────────────────────────────────
if ($uri === '/publicidad/activas' && $metodo === 'GET') {
    $hoy  = date('Y-m-d');
    $stmt = $pdo->prepare("SELECT * FROM publicidad WHERE estado = 'activa' AND fecha_inicio <= ? AND fecha_fin >= ? ORDER BY RAND()");
    $stmt->execute([$hoy, $hoy]);
    ok($stmt->fetchAll());
}

if ($uri === '/publicidad' && $metodo === 'GET') {
    requerir_admin();
    $stmt = $pdo->query('SELECT * FROM publicidad ORDER BY creado_en DESC');
    ok($stmt->fetchAll());
}

if ($uri === '/publicidad' && $metodo === 'POST') {
    requerir_admin();
    $id = uuid4();
    $pdo->prepare('INSERT INTO publicidad (id,titulo,imagen_url,url_destino,fecha_inicio,fecha_fin,limite_diario,estado) VALUES (?,?,?,?,?,?,?,?)')
        ->execute([$id,$body['titulo']??'',$body['imagen_url']??'',$body['url_destino']??'',$body['fecha_inicio']??date('Y-m-d'),$body['fecha_fin']??date('Y-m-d'),((int)($body['limite_diario']??50)),$body['estado']??'activa']);
    ok(['id' => $id], 201);
}

if (preg_match('#^/publicidad/([^/]+)/impresion$#', $uri, $m) && $metodo === 'POST') {
    $pubid = $m[1]; $hoy = date('Y-m-d');
    $pdo->prepare('INSERT INTO publicidad_impresiones (publicidad_id,fecha,contador) VALUES (?,?,1) ON DUPLICATE KEY UPDATE contador = contador + 1')
        ->execute([$pubid, $hoy]);
    ok(['contado' => true]);
}

if (preg_match('#^/publicidad/([^/]+)$#', $uri, $m)) {
    $pubid = $m[1];
    if ($metodo === 'PUT') {
        requerir_admin();
        $pdo->prepare('UPDATE publicidad SET titulo=?,imagen_url=?,url_destino=?,fecha_inicio=?,fecha_fin=?,limite_diario=?,estado=? WHERE id=?')
            ->execute([$body['titulo']??'',$body['imagen_url']??'',$body['url_destino']??'',$body['fecha_inicio']??'',$body['fecha_fin']??'',(int)($body['limite_diario']??50),$body['estado']??'activa',$pubid]);
        ok(['actualizado' => true]);
    }
    if ($metodo === 'DELETE') {
        requerir_admin();
        $pdo->prepare('DELETE FROM publicidad WHERE id = ?')->execute([$pubid]);
        ok(['eliminado' => true]);
    }
}

// ── FORO ──────────────────────────────────────────────────
if ($uri === '/foro/hilos' && $metodo === 'GET') {
    $stmt = $pdo->query('SELECT h.*, v.nombre AS vendedor_nombre, v.perfil AS vendedor_perfil FROM foro_hilos h LEFT JOIN vendedores v ON v.id = h.vendedor_id ORDER BY h.creado_en DESC');
    ok($stmt->fetchAll());
}

if ($uri === '/foro/hilos' && $metodo === 'POST') {
    requerir_autenticado();
    $u   = sesion_usuario();
    $vid = $u['vendedor_id'] ?? null;
    if (!$vid && (int)$u['rol'] !== 1) error('Solo vendedores pueden publicar en el foro');
    $id = uuid4();
    $pdo->prepare('INSERT INTO foro_hilos (id,titulo,contenido,vendedor_id) VALUES (?,?,?,?)')
        ->execute([$id, $body['titulo']??'', $body['contenido']??'', $vid ?? 'admin']);
    ok(['id' => $id], 201);
}

if (preg_match('#^/foro/hilos/([^/]+)/respuestas$#', $uri, $m)) {
    $hid = $m[1];
    if ($metodo === 'GET') {
        $stmt = $pdo->prepare('SELECT r.*, v.nombre AS vendedor_nombre, v.perfil AS vendedor_perfil FROM foro_respuestas r LEFT JOIN vendedores v ON v.id = r.vendedor_id WHERE r.hilo_id = ? ORDER BY r.creado_en ASC');
        $stmt->execute([$hid]);
        ok($stmt->fetchAll());
    }
    if ($metodo === 'POST') {
        requerir_autenticado();
        $u   = sesion_usuario();
        $vid = $u['vendedor_id'] ?? 'admin';
        $id  = uuid4();
        $pdo->prepare('INSERT INTO foro_respuestas (id,hilo_id,vendedor_id,contenido) VALUES (?,?,?,?)')
            ->execute([$id, $hid, $vid, $body['contenido']??'']);
        $pdo->prepare('UPDATE foro_hilos SET respuestas = respuestas + 1 WHERE id = ?')
            ->execute([$hid]);
        ok(['id' => $id], 201);
    }
}

if (preg_match('#^/foro/hilos/([^/]+)$#', $uri, $m) && $metodo === 'DELETE') {
    requerir_admin();
    $hid = $m[1];
    $pdo->prepare('DELETE FROM foro_respuestas WHERE hilo_id = ?')->execute([$hid]);
    $pdo->prepare('DELETE FROM foro_hilos WHERE id = ?')->execute([$hid]);
    ok(['eliminado' => true]);
}

if (preg_match('#^/foro/respuestas/([^/]+)$#', $uri, $m) && $metodo === 'DELETE') {
    requerir_admin();
    $rid = $m[1];
    $stmt = $pdo->prepare('SELECT hilo_id FROM foro_respuestas WHERE id = ? LIMIT 1');
    $stmt->execute([$rid]);
    $resp = $stmt->fetch();
    $pdo->prepare('DELETE FROM foro_respuestas WHERE id = ?')->execute([$rid]);
    if ($resp) {
        $pdo->prepare('UPDATE foro_hilos SET respuestas = GREATEST(0, respuestas - 1) WHERE id = ?')
            ->execute([$resp['hilo_id']]);
    }
    ok(['eliminado' => true]);
}

// ── CLAVES API ────────────────────────────────────────────
if ($uri === '/api-claves' && $metodo === 'GET') {
    requerir_autenticado(); // vendedores también pueden leer para usarlas
    $stmt = $pdo->query('SELECT * FROM api_claves ORDER BY servicio ASC');
    $rows = $stmt->fetchAll();
    // Si es vendedor, ocultar la clave raw — solo devolver si está activo
    $u = sesion_usuario();
    if ((int)$u['rol'] !== 1) {
        $rows = array_filter($rows, fn($r) => (bool)$r['activo']);
    }
    ok(array_values($rows));
}

if (preg_match('#^/api-claves/servicio/([^/]+)$#', $uri, $m) && $metodo === 'GET') {
    requerir_autenticado();
    $stmt = $pdo->prepare("SELECT * FROM api_claves WHERE servicio = ? AND activo = 1 LIMIT 1");
    $stmt->execute([$m[1]]);
    $clave = $stmt->fetch();
    if (!$clave) error("Clave API '{$m[1]}' no encontrada o inactiva", 404);
    $clave['modelos'] = $clave['modelos'] ? json_decode($clave['modelos'], true) : [];
    ok($clave);
}

if ($uri === '/api-claves' && $metodo === 'POST') {
    requerir_admin();
    $id = uuid4();
    $pdo->prepare('INSERT INTO api_claves (id,servicio,nombre,origen_url,clave,modelos,activo,nota) VALUES (?,?,?,?,?,?,?,?)')
        ->execute([$id,$body['servicio']??'',$body['nombre']??'',$body['origen_url']??'',$body['clave']??'',json_encode($body['modelos']??[]),isset($body['activo'])?(int)$body['activo']:1,$body['nota']??'']);
    ok(['id' => $id], 201);
}

if (preg_match('#^/api-claves/([^/]+)$#', $uri, $m)) {
    $cid = $m[1];
    if ($metodo === 'PUT') {
        requerir_admin();
        $pdo->prepare('UPDATE api_claves SET servicio=?,nombre=?,origen_url=?,clave=?,modelos=?,activo=?,nota=? WHERE id=?')
            ->execute([$body['servicio']??'',$body['nombre']??'',$body['origen_url']??'',$body['clave']??'',json_encode($body['modelos']??[]),isset($body['activo'])?(int)$body['activo']:1,$body['nota']??'',$cid]);
        ok(['actualizado' => true]);
    }
    if ($metodo === 'DELETE') {
        requerir_admin();
        $pdo->prepare('DELETE FROM api_claves WHERE id = ?')->execute([$cid]);
        ok(['eliminado' => true]);
    }
}

// ── WOMPI: FIRMA SHA-256 ──────────────────────────────────
if ($uri === '/wompi/firma' && $metodo === 'POST') {
    // Obtener secreto de integridad desde api_claves
    $stmt = $pdo->prepare("SELECT clave FROM api_claves WHERE servicio = 'wompi_integridad' AND activo = 1 LIMIT 1");
    $stmt->execute();
    $fila = $stmt->fetch();
    if (!$fila) error('Clave de integridad Wompi no configurada', 503);

    $referencia = $body['referencia'] ?? '';
    $monto      = $body['monto']      ?? '';   // en centavos
    $moneda     = $body['moneda']     ?? 'COP';
    $cadena     = $referencia . $monto . $moneda . $fila['clave'];
    $firma      = hash('sha256', $cadena);
    ok(['firma' => $firma]);
}

// ── WOMPI: WEBHOOK ────────────────────────────────────────
if ($uri === '/wompi/webhook' && $metodo === 'POST') {
    // Verificar firma del evento
    $checksum = $body['signature']['checksum'] ?? '';
    $stmt = $pdo->prepare("SELECT clave FROM api_claves WHERE servicio = 'wompi_eventos' AND activo = 1 LIMIT 1");
    $stmt->execute();
    $fila = $stmt->fetch();
    if ($fila) {
        $tx        = $body['data']['transaction'] ?? [];
        $cadena    = ($tx['id'] ?? '') . ($tx['status'] ?? '') . ($tx['amount_in_cents'] ?? '') . ($body['timestamp'] ?? '') . $fila['clave'];
        $calculado = hash('sha256', $cadena);
        if ($calculado !== $checksum) {
            http_response_code(401);
            echo json_encode(['ok' => false, 'error' => 'Firma inválida']);
            exit;
        }
    }

    if (($body['data']['transaction']['status'] ?? '') !== 'APPROVED') {
        ok(['mensaje' => 'Evento recibido, sin acción (no aprobado)']);
    }

    $tx         = $body['data']['transaction'];
    $monto      = (int)($tx['amount_in_cents'] ?? 0);
    $email      = $tx['customer_email'] ?? '';
    $referencia = $tx['reference']      ?? '';
    $txId       = $tx['id']             ?? '';

    // Buscar vendedor
    $stmt = $pdo->prepare('SELECT v.* FROM vendedores v JOIN usuarios u ON u.id = v.usuario_id WHERE u.correo = ? LIMIT 1');
    $stmt->execute([$email]);
    $vendedor = $stmt->fetch();

    if (!$vendedor) {
        // Buscar por referencia (formato: gistore-{fragmento_id})
        $partes = explode('-', $referencia);
        if (count($partes) >= 2) {
            $frag = $partes[1];
            $stmt = $pdo->prepare('SELECT * FROM vendedores WHERE id LIKE ? LIMIT 1');
            $stmt->execute([$frag . '%']);
            $vendedor = $stmt->fetch();
        }
    }

    if (!$vendedor) {
        http_response_code(200);
        echo json_encode(['ok' => false, 'error' => 'Vendedor no encontrado']);
        exit;
    }

    // Determinar plan
    $montoCOP = $monto / 100;
    $stmt     = $pdo->prepare("SELECT * FROM planes_membresia WHERE activo = 1 ORDER BY precio ASC");
    $stmt->execute();
    $planes   = $stmt->fetchAll();
    $plan     = null;
    foreach ($planes as $p) {
        if (abs(($p['precio'] - $montoCOP) / max($montoCOP, 1)) <= 0.01) { $plan = $p; break; }
    }
    if (!$plan && !empty($planes)) {
        usort($planes, fn($a,$b) => $b['precio'] - $a['precio']);
        foreach ($planes as $p) {
            if ($p['precio'] <= $montoCOP) { $plan = $p; break; }
        }
    }
    $dias = $plan ? (int)$plan['duracion_dias'] : 30;

    // Crear membresía
    $hoy    = date('Y-m-d');
    $fin    = date('Y-m-d', strtotime("+$dias days"));
    $memId  = uuid4();
    $pdo->prepare('INSERT INTO membresias (id,vendedor_id,plan_id,fecha_inicio,fecha_fin,estado,wompi_tx_id) VALUES (?,?,?,?,?,?,?)')
        ->execute([$memId, $vendedor['id'], $plan['id'] ?? null, $hoy, $fin, 'activa', $txId]);

    // Activar vendedor y productos
    $pdo->prepare("UPDATE vendedores SET estado = 'activo' WHERE id = ?")
        ->execute([$vendedor['id']]);
    $pdo->prepare("UPDATE productos SET activo = 1 WHERE vendedor_id = ?")
        ->execute([$vendedor['id']]);

    ok(['membresia_id' => $memId]);
}

// ── PORTAL VENDEDOR (me/) ─────────────────────────────────
if ($uri === '/me/vendedor' && $metodo === 'GET') {
    $u   = requerir_vendedor();
    $vid = $u['vendedor_id'] ?? null;
    if (!$vid) error('Vendedor no configurado', 404);
    $stmt = $pdo->prepare('SELECT * FROM vendedores WHERE id = ? LIMIT 1');
    $stmt->execute([$vid]);
    $v = $stmt->fetch();
    if (!$v) no_encontrado();
    ok($v);
}

if ($uri === '/me/vendedor' && $metodo === 'PUT') {
    $u   = requerir_vendedor();
    $vid = $u['vendedor_id'];
    $campos  = ['nombre','ciudad','whatsapp','descripcion','perfil','color','url_web','redes'];
    $updates = []; $vals = [];
    foreach ($campos as $c) {
        if (array_key_exists($c, $body)) {
            $updates[] = "$c = ?";
            $vals[]    = is_array($body[$c]) ? json_encode($body[$c]) : $body[$c];
        }
    }
    if (empty($updates)) error('Sin campos para actualizar');
    $vals[] = $vid;
    $pdo->prepare('UPDATE vendedores SET ' . implode(', ', $updates) . ' WHERE id = ?')->execute($vals);
    ok(['actualizado' => true]);
}

if ($uri === '/me/membresia' && $metodo === 'GET') {
    $u   = requerir_vendedor();
    $vid = $u['vendedor_id'];
    $stmt = $pdo->prepare("SELECT m.*, p.nombre AS plan_nombre FROM membresias m LEFT JOIN planes_membresia p ON p.id = m.plan_id WHERE m.vendedor_id = ? ORDER BY m.fecha_fin DESC LIMIT 1");
    $stmt->execute([$vid]);
    ok($stmt->fetch() ?: null);
}

if ($uri === '/me/productos' && $metodo === 'GET') {
    $u   = requerir_vendedor();
    $vid = $u['vendedor_id'];
    $stmt = $pdo->prepare('SELECT * FROM productos WHERE vendedor_id = ? ORDER BY creado_en DESC');
    $stmt->execute([$vid]);
    $rows = $stmt->fetchAll();
    foreach ($rows as &$r) { $r['beneficios'] = $r['beneficios'] ? json_decode($r['beneficios'], true) : []; }
    ok($rows);
}

if ($uri === '/me/catalogo' && $metodo === 'GET') {
    $u   = requerir_vendedor();
    $vid = $u['vendedor_id'];
    $stmt = $pdo->prepare('SELECT p.*, c.nombre AS categoria_nombre FROM productos p LEFT JOIN categorias c ON c.id = p.categoria_id WHERE p.vendedor_id = ? ORDER BY p.nombre ASC');
    $stmt->execute([$vid]);
    $rows = $stmt->fetchAll();
    foreach ($rows as &$r) { $r['beneficios'] = $r['beneficios'] ? json_decode($r['beneficios'], true) : []; }
    ok($rows);
}

// ── 404 ───────────────────────────────────────────────────
no_encontrado();