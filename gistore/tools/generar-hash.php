#!/usr/bin/env php
<?php
// ============================================================
//  tools/generar-hash.php
//  Herramienta CLI para generar hashes bcrypt de contraseñas
//
//  USO:
//    php tools/generar-hash.php miContraseña123
//
//  También sirve para crear el INSERT del primer admin:
//    php tools/generar-hash.php
//  (modo interactivo)
// ============================================================

$password = $argv[1] ?? null;

if (!$password) {
    echo "GI Store — Generador de hash bcrypt\n";
    echo "Ingresa la contraseña: ";
    $password = trim(fgets(STDIN));
}

if (strlen($password) < 8) {
    echo "⚠  La contraseña debe tener al menos 8 caracteres.\n";
    exit(1);
}

$hash = password_hash($password, PASSWORD_BCRYPT, ['cost' => 12]);

echo "\n";
echo "Password: $password\n";
echo "Hash:     $hash\n\n";
echo "SQL para insertar admin:\n";
echo "INSERT INTO usuarios (correo, password_hash, rol, activo) VALUES\n";
echo "  ('admin@tudominio.com', '$hash', 1, 1);\n\n";
echo "SQL para actualizar password de admin existente:\n";
echo "UPDATE usuarios SET password_hash = '$hash' WHERE rol = 1;\n\n";
