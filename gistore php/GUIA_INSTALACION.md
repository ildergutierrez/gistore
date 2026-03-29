# GI Store — Guía de Instalación MySQL + PHP

## Árbol del proyecto

```
gistore/
├── index.html                  ← Catálogo público (= index1.html original)
├── sitemap.xml
├── .htaccess                   ← Seguridad + caché
├── .env.example                ← Variables de entorno modelo
├── conexion.php                ← Conexión PDO segura ← CONFIGURA AQUÍ
├── database.sql                ← Schema completo MySQL ← EJECUTA PRIMERO
├── GUIA_INSTALACION.md         ← Este archivo
│
├── api/
│   ├── index.php               ← ⭐ API REST completa (reemplaza Firebase + Cloud Functions)
│   └── .htaccess
│
├── js/
│   ├── api.js                  ← ⭐ Cliente HTTP (reemplaza Firebase JS SDK)
│   ├── firebase.js             ← Stub vacío (compatibilidad)
│   ├── stores.js, app.js, foro.js, tienda.js, ...
│
├── admin/
│   ├── index.html              ← Login administrador
│   └── js/
│       ├── auth.js             ← ⭐ Auth reescrita (sesiones PHP)
│       ├── db.js               ← ⭐ Re-exporta api.js
│       ├── login.js            ← ⭐ Login sin Firebase
│       └── (resto igual al original)
│
├── user/
│   ├── index.html              ← Login vendedor
│   └── js/
│       ├── auth.js             ← ⭐ Auth reescrita
│       ├── db.js               ← ⭐ Re-exporta api.js
│       ├── login.js            ← ⭐ Login sin Firebase
│       └── (resto igual al original)
│
├── css/, page/                 ← Sin cambios
└── tools/
    └── generar-hash.php        ← Genera bcrypt para contraseñas
```

---

## Paso 1 — Crear base de datos

```sql
-- Ejecutar como root de MySQL:
CREATE DATABASE gistore CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'gistore_user'@'localhost' IDENTIFIED BY 'CAMBIA_ESTO';
GRANT ALL PRIVILEGES ON gistore.* TO 'gistore_user'@'localhost';
FLUSH PRIVILEGES;
```

```bash
mysql -u root -p gistore < database.sql
```

---

## Paso 2 — Configurar conexión

**Opción A (recomendada en producción) — variables en `.htaccess`:**
```apache
SetEnv DB_HOST localhost
SetEnv DB_PORT 3306
SetEnv DB_NAME gistore
SetEnv DB_USER gistore_user
SetEnv DB_PASS CAMBIA_ESTO
SetEnv APP_ENV production
SetEnv CORS_ORIGIN https://www.gistore.com.co
```

**Opción B — editar `conexion.php` directamente (solo desarrollo):**
```php
define('DB_PASS', 'CAMBIA_ESTO');
```

---

## Paso 3 — Subir archivos

Sube todos los archivos a la raíz pública del dominio (`public_html/`, `www/`, etc.).

La estructura de carpetas debe quedar:
```
public_html/
├── index.html
├── conexion.php
├── api/
├── admin/
├── user/
├── js/, css/, page/
└── ...
```

---

## Paso 4 — Cambiar password del admin

El admin por defecto insertado por `database.sql` es:
- **Correo:** `admin@gistore.com`
- **Password:** `Admin2024!`

**Cámbialo antes de usar en producción:**

```bash
php tools/generar-hash.php "TuNuevaContraseñaSegura"
```

Copia el hash generado y ejecuta en MySQL:
```sql
UPDATE usuarios 
SET correo = 'tuadmin@dominio.com',
    password_hash = '$2y$12$HASH_COPIADO_AQUI'
WHERE rol = 1;
```

---

## Paso 5 — Configurar claves Wompi

1. Ingresa al panel admin: `https://tudominio.com/admin/`
2. Ve a **API Claves** en el menú lateral
3. Crea estos 4 registros:

| servicio | nombre | URL | clave |
|---|---|---|---|
| `wompi_publica` | Llave Pública Wompi | `https://checkout.wompi.co` | `pub_test_...` o `pub_prod_...` |
| `wompi_privada` | Llave Privada Wompi | `https://api.wompi.co` | `prv_test_...` |
| `wompi_integridad` | Secreto Integridad | — | (secreto del dashboard Wompi) |
| `wompi_eventos` | Secreto Eventos | — | (secreto de eventos Wompi) |

> Los nombres de `servicio` deben ser **exactamente** los mostrados arriba.

---

## Paso 6 — Crear vendedores

1. En el panel admin, ve a **Vendedores → Nuevo vendedor**
2. Completa los datos del vendedor
3. Haz clic en **"Crear cuenta"** para asignarle correo y contraseña de acceso
4. Crea una membresía en **Membresías** para activarlo

---

## Roles

| rol | descripción | panel |
|---|---|---|
| `1` | Administrador | `/admin/` |
| `2` | Vendedor | `/user/` |

---

## Cómo funciona la arquitectura

```
Navegador
    │
    ├─ HTML/CSS/JS estáticos (sin cambios vs original)
    │
    └─ js/api.js (fetch) ──► /api/index.php ──► MySQL
                                    │
                                    ├── Sesiones PHP (reemplaza Firebase Auth)
                                    ├── CRUD vendedores/productos/etc.
                                    ├── Firma Wompi (reemplaza Cloud Function)
                                    └── Webhook Wompi (reemplaza Cloud Function)
```

### Equivalencias Firebase → PHP/MySQL

| Firebase | PHP/MySQL |
|---|---|
| `Firebase Auth` | Sesiones PHP + bcrypt |
| `Firestore` | MySQL con PDO |
| `Cloud Functions` | `api/index.php` |
| `Firebase JS SDK` | `js/api.js` (fetch nativo) |
| `admin SDK` | Endpoints PHP protegidos por `rol=1` |

---

## API REST — Endpoints principales

`POST /api/auth/login` — `{correo, password}`  
`POST /api/auth/logout`  
`GET  /api/categorias` — público  
`GET  /api/productos?activos=1` — público  
`GET  /api/publicidad/activas` — público  
`GET  /api/vendedores` — admin  
`POST /api/vendedores/{id}/desactivar` — admin  
`POST /api/vendedores/{id}/reactivar` — admin  
`GET  /api/me/vendedor` — vendedor  
`PUT  /api/me/vendedor` — vendedor  
`GET  /api/me/membresia` — vendedor  
`POST /api/wompi/firma` — pública  
`POST /api/wompi/webhook` — Wompi  

---

## Seguridad implementada

- PDO con prepared statements → previene SQL injection  
- bcrypt cost=12 → contraseñas seguras  
- Sesiones PHP httpOnly + secure + SameSite=Lax  
- Regeneración de session ID en login  
- Verificación de rol en cada endpoint protegido  
- CORS por origen configurado  
- `conexion.php` y `database.sql` bloqueados por `.htaccess`  
- Errores de BD no expuestos en producción  
- Firma SHA-256 verificada para webhook Wompi  
