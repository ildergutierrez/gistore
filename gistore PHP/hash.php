<?php

$clave  = "3185818424";
//hash la contraseña password_verify
$clave = password_hash($clave, PASSWORD_DEFAULT);
echo $clave;