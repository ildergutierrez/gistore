<?php
// diagnostico.php — ELIMINAR después de resolver el problema
header('Content-Type: text/plain; charset=utf-8');

echo "=== PHP Info relevante ===\n";
echo "PHP version: " . PHP_VERSION . "\n";
echo "upload_max_filesize: " . ini_get('upload_max_filesize') . "\n";
echo "post_max_size: "       . ini_get('post_max_size') . "\n";
echo "file_uploads: "        . (ini_get('file_uploads') ? 'ON' : 'OFF') . "\n";
echo "SMTP: "                . ini_get('SMTP') . "\n";
echo "sendmail_path: "       . ini_get('sendmail_path') . "\n\n";

echo "=== $_FILES al hacer POST ===\n";
print_r($_FILES);

echo "\n=== $_POST al hacer POST ===\n";
print_r($_POST);