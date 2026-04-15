<?php
//  gistore/php/notificacion.php
// ============================================================
//detectar si esta o no activo el usuarios
function estadoVendedor($PDO): array
{
    if (estadoTabla_g_D($PDO)) {
        return [];
    } else {
        limpiarEDesactivados($PDO);
        $stmt = $PDO->query("SELECT usuario_id, nombre, correo, actualizado_en  FROM vendedores WHERE estado = 'desactivado'");
        $resultado = $stmt->fetchAll(PDO::FETCH_ASSOC);
        registarEDesactivados($PDO);
        return $resultado;
    }
}

//desactivar vendedor
function DesactivarVendedor($PDO, $idVendedor): array
{
    $stmt = $PDO->query("UPDATE vendedores SET estado = 'desactivado' WHERE id = $idVendedor");
    return $stmt->fetchAll(PDO::FETCH_ASSOC);
}

//obtener datos del vendedor
function Vendedores($PDO, $idVendedor): array
{
    $stmt = $PDO->query("SELECT nombre, correo  FROM vendedores WHERE id = $idVendedor");
    return $stmt->fetchAll(PDO::FETCH_ASSOC);
}

//obtener datos de la membresia
function estadoMembresia($PDO, $idVendedor): array
{
    $stmt = $PDO->query("SELECT vendedor_id, fecha_fin FROM membresias WHERE estado = 'activa' AND 'vendedor_id' = $idVendedor");
    if ($stmt->rowCount() > 0) {
        return [];
    }
    $stmt = $PDO->query("SELECT vendedor_id, fecha_fin FROM membresias WHERE estado = 'vencida' AND vendedor_id = $idVendedor ORDER BY fecha_fin DESC LIMIT 1");
    $result = $stmt->fetchAll(PDO::FETCH_ASSOC);
    if (!empty($result)) {
        $dias = calcularDiasRestantes($result[0]['fecha_fin']) * -1;
        return ['ultima_membresia' => $dias];
    }
    return [];
}

//calcular dias restantes
function calcularDiasRestantes($fechaFin): int
{
    $hoy = new DateTime();
    $fin = new DateTime($fechaFin);
    return $hoy->diff($fin)->days * ($hoy > $fin ? -1 : 1);
}

//obtener vendedores y enviar correos
function obtenerVendedores($conn)
{
    if (estadoTabla_g($conn)) {
        return;
    }

    $info = array();
    $stmt = $conn->prepare("SELECT id FROM vendedores ");
    $stmt->execute();
    $resul = $stmt->fetchAll(PDO::FETCH_ASSOC);

    foreach ($resul as $vendedor) {
        $estadoMembresia = estadoMembresia($conn, $vendedor['id']);

        if (!empty($estadoMembresia)) {
            require_once __DIR__ . '/mensajesGenerico.php';
            $recoleccion = Vendedores($conn, $vendedor['id']);
            if ($estadoMembresia['ultima_membresia'] == 160) {

                //print_r($recoleccion);
                $info[] = ['id_vendedor' => $vendedor['id'], 'correo' => $recoleccion[0]['correo'], 'nombre' => $recoleccion[0]['nombre']];
                $data = correo_aviso_160dias($recoleccion[0]['nombre'], $recoleccion[0]['correo']);
                //print_r($data);
                if ($data['ok']) {
                    registarEMenbresia($conn, $recoleccion[0]['correo']);
                } else {
                    registarEMenbresia($conn, $recoleccion[0]['correo'], 0);
                }
            } elseif ($estadoMembresia['ultima_membresia'] == 180) {
                $data = correo_suspension_180dias($recoleccion[0]['nombre'], $recoleccion[0]['correo']);
                if ($data['ok']) {
                    registarEMenbresia($conn, $recoleccion[0]['correo'], 2);
                    DesactivarVendedor($conn, $vendedor['id']);
                }
                //return ['id_vendedor' => $vendedor['id'], 'correo' => $recoleccion[0]['correo'], 'nombre' => $recoleccion[0]['nombre']];
            } else {
                limpiarEMenbresia($conn);
            }
        }
    }
    return $info;
}

//verificar si se ha enviado el correo hoy
function estadoTabla_g($conn)
{
    $stmt = $conn->prepare("SELECT * FROM g_envio_membresia LIMIT 1");
    $resultado = $stmt->execute();
    if ($resultado['fecha'] == date('Y-m-d')) {
        return true;
    }

    return false;
}
function estadoTabla_g_D($conn)
{
    $stmt = $conn->prepare("SELECT * FROM g_envios_desactivados LIMIT 1");
    $stmt->execute();
    $resultado = $stmt->fetch(PDO::FETCH_ASSOC);
    if ($resultado['fecha'] == date('Y-m-d')) {
        return true;
    }
    return false;
}
//registrar el envio del correo
function registarEMenbresia($conn, $correo, $envio = 1)
{
    $stmt = $conn->prepare("INSERT INTO g_envio_membresia (`correo`, `envio`, `fecha`) VALUES (?, ?, ?)");
    $stmt->execute([$correo, $envio, date('Y-m-d H:i:s')]);
}

//limpiar tabla de envios
function limpiarEMenbresia($conn)
{
    $stmt = $conn->prepare("TRUNCATE TABLE `g_envio_membresia`");
    $stmt->execute();
}

//obtener vendedores desactivados y eliminar
function obtenerDesactivados(array $vendedores, PDO $conn): void
{
  //  print_r($vendedores);
    if (empty($vendedores)) {//si no hay vendedores desactivados,
        return;
    }
    foreach ($vendedores as $vendedor) {
        $dias = calcularDiasRestantes($vendedor['actualizado_en']);
        if ($dias >= 90) {
            eliminarDesativados($conn, $vendedor['usuario_id']);
        }
    }
}

//eliminar vendedores desactivados
function eliminarDesativados(PDO $conn, int $id_user)
{
    //productos
    $stmt = $conn->prepare("DELETE FROM productos WHERE vendedor_id = ?");
    $stmt->execute([$id_user]);
    //vendedores
    $stmt = $conn->prepare("DELETE FROM vendedores WHERE usuario_id = ?");
    $stmt->execute([$id_user]);

    //usuarios
    $stmt = $conn->prepare("DELETE FROM usuarios WHERE id = ?");
    $stmt->execute([$id_user]);
}
function registarEDesactivados($conn,  $envio = 1)
{
    $stmt = $conn->prepare("INSERT INTO g_envios_desactivados (`envio`, `fecha`) VALUES ( ?, ?)");
    $stmt->execute([$envio, date('Y-m-d H:i:s')]);
}

//limpiar tabla de envios
function limpiarEDesactivados($conn)
{
    $stmt = $conn->prepare("TRUNCATE TABLE `g_envios_desactivados`");
    $stmt->execute();
}

//Correo
require_once __DIR__ . '/../backend/conexion.php';
$pdo = __Conectar();
obtenerDesactivados(estadoVendedor($pdo), $pdo);
obtenerVendedores($pdo);
__Desconectar($pdo);
echo json_encode(['ok' => true, 'datos' => 'Proceso completado'], JSON_UNESCAPED_UNICODE);