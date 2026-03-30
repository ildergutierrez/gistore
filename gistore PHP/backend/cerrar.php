<?php
//cerrar sesion
session_start();
session_unset();
session_destroy();
header('Content-Type: application/json');
function ok(): never
{
    echo json_encode(['ok' => true ]);
    exit;
}
ok();