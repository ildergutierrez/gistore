# GI Store — Migración MySQL + PHP

Ver .env.example para configuración.
Ver database.sql para el schema completo.
Ver api/index.php para todos los endpoints.
Ver js/api.js para el cliente HTTP (reemplaza Firebase SDK).

## Setup rápido
1. mysql -u root -p gistore < database.sql
2. Configurar variables en .htaccess: DB_HOST, DB_NAME, DB_USER, DB_PASS
3. php tools/generar-hash.php para cambiar password del admin
4. Configurar claves Wompi desde panel Admin → API Claves
