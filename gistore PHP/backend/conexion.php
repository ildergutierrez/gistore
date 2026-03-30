<?php
// ============================================================
//  gistore/backend/conexion.php — Conexión MySQL PDO
//  GI Store
// ============================================================
//127.0.0.1'
declare(strict_types=1);

function __Conectar()
{

    $host    = '127.0.0.1';
    $puerto  = '3306';
    $bd      = 'gistorec_bbdd'; //'gistorec_bbdd';
    $usuario = 'root'; //'gistorec_admin';
    $clave   = ''; //'39D-#UlO33mFjf';

    $dsn = "mysql:host=$host;port=$puerto;dbname=$bd;charset=utf8mb4";

    try {
        $pdo = new PDO($dsn, $usuario, $clave, [
            PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES   => false,
            PDO::MYSQL_ATTR_INIT_COMMAND => "SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci",
        ]);
        //echo json_encode(['error' => false, 'mensaje' => 'Conexión exitosa']);
        return $pdo;
    } catch (PDOException $e) {
        http_response_code(500);
        die(json_encode(['error' => true, 'mensaje' => $e->getMessage()]));
    }
}

function __Desconectar(&$pdo)
{
    $pdo = null;
}

