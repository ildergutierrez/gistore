-- ============================================================
--  GI Store — Schema MySQL (PKs numéricas)
--  Migración completa desde Firebase / Firestore
--  IDs originales de Firebase descartados → INT AUTO_INCREMENT
--  v2: foro_hilos y foro_respuestas usan usuario_id (no vendedor_id)
-- ============================================================

SET NAMES utf8mb4;
SET foreign_key_checks = 0;

CREATE DATABASE IF NOT EXISTS gistorec_bbdd
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE gistorec_bbdd;

-- ──────────────────────────────────────────────────────────
--  USUARIOS (Admin rol=1 | Vendedor rol=2)
-- ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS usuarios (
  id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  correo          VARCHAR(191) NOT NULL UNIQUE,
  password_hash   VARCHAR(255) NOT NULL,
  rol             TINYINT NOT NULL DEFAULT 2 COMMENT '1=admin 2=vendedor',
  activo          TINYINT(1) NOT NULL DEFAULT 1,
  creado_en       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  actualizado_en  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ──────────────────────────────────────────────────────────
--  CATEGORÍAS
-- ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS categorias (
  id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  nombre      VARCHAR(200) NOT NULL,
  orden       INT NOT NULL DEFAULT 0,
  creado_en   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ──────────────────────────────────────────────────────────
--  VENDEDORES
-- ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS vendedores (
  id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  usuario_id      INT UNSIGNED NULL UNIQUE,
  nombre          VARCHAR(200) NOT NULL DEFAULT '',
  ciudad          VARCHAR(100) NOT NULL DEFAULT '',
  correo          VARCHAR(191) NOT NULL DEFAULT '',
  whatsapp        VARCHAR(30)  NOT NULL DEFAULT '',
  descripcion     TEXT,
  perfil          TEXT         COMMENT 'URL imagen de perfil (Cloudinary)',
  color           VARCHAR(10)  NOT NULL DEFAULT '#1a6b3c',
  url_web         VARCHAR(500) DEFAULT NULL,
  redes           JSON         COMMENT '{"facebook":"","instagram":"","tiktok":"","youtube":""}',
  estado          ENUM('activo','inactivo','desactivado') NOT NULL DEFAULT 'inactivo',
  creado_en       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  actualizado_en  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ──────────────────────────────────────────────────────────
--  PRODUCTOS
-- ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS productos (
  id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  vendedor_id     INT UNSIGNED NOT NULL,
  categoria_id    INT UNSIGNED NOT NULL,
  nombre          VARCHAR(300) NOT NULL DEFAULT '',
  descripcion     TEXT,
  recomendacion   TEXT,
  beneficios      JSON         COMMENT 'Array de strings',
  valor           DECIMAL(15,2) NOT NULL DEFAULT 0,
  imagen          TEXT         COMMENT 'URL o ruta imagen del producto',
  activo          TINYINT(1)   NOT NULL DEFAULT 1,
  creado_en       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  actualizado_en  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (vendedor_id)  REFERENCES vendedores(id) ON DELETE CASCADE,
  FOREIGN KEY (categoria_id) REFERENCES categorias(id) ON DELETE RESTRICT,
  INDEX idx_vendedor (vendedor_id),
  INDEX idx_categoria (categoria_id),
  INDEX idx_activo   (activo)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ──────────────────────────────────────────────────────────
--  PLANES DE MEMBRESÍA
-- ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS planes_membresia (
  id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  nombre          VARCHAR(200)  NOT NULL DEFAULT '',
  descripcion     TEXT,
  precio          DECIMAL(15,2) NOT NULL DEFAULT 0,
  duracion_dias   INT           NOT NULL DEFAULT 30,
  activo          TINYINT(1)    NOT NULL DEFAULT 1,
  orden           INT           NOT NULL DEFAULT 0,
  creado_en       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  actualizado_en  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ──────────────────────────────────────────────────────────
--  MEMBRESÍAS
-- ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS membresias (
  id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  vendedor_id     INT UNSIGNED NOT NULL,
  plan_id         INT UNSIGNED NULL,
  fecha_inicio    DATE        NOT NULL,
  fecha_fin       DATE        NOT NULL,
  estado          ENUM('activa','vencida','cancelada') NOT NULL DEFAULT 'activa',
  notas           TEXT,
  wompi_tx_id     VARCHAR(200) NULL COMMENT 'ID de transacción Wompi',
  creado_en       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  actualizado_en  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (vendedor_id) REFERENCES vendedores(id) ON DELETE CASCADE,
  FOREIGN KEY (plan_id)     REFERENCES planes_membresia(id) ON DELETE SET NULL,
  INDEX idx_vendedor  (vendedor_id),
  INDEX idx_estado    (estado),
  INDEX idx_fecha_fin (fecha_fin)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ──────────────────────────────────────────────────────────
--  FUNDADORES
-- ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS fundadores (
  id               INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  vendedor_id      INT UNSIGNED NOT NULL UNIQUE,
  fecha_registro   DATE        NOT NULL,
  creado_en        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (vendedor_id) REFERENCES vendedores(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ──────────────────────────────────────────────────────────
--  PUBLICIDAD (banners)
-- ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS publicidad (
  id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  titulo          VARCHAR(300)  NOT NULL DEFAULT '',
  imagen_url      TEXT,
  url_destino     TEXT,
  fecha_inicio    DATE          NOT NULL,
  fecha_fin       DATE          NOT NULL,
  limite_diario   INT           NOT NULL DEFAULT 50,
  estado          ENUM('activa','inactiva') NOT NULL DEFAULT 'activa',
  creado_en       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  actualizado_en  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_estado (estado),
  INDEX idx_fechas (fecha_inicio, fecha_fin)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ──────────────────────────────────────────────────────────
--  IMPRESIONES DE PUBLICIDAD
-- ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS publicidad_impresiones (
  id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  publicidad_id   INT UNSIGNED NOT NULL,
  fecha           DATE        NOT NULL,
  contador        INT         NOT NULL DEFAULT 0,
  UNIQUE KEY uk_pub_fecha (publicidad_id, fecha),
  FOREIGN KEY (publicidad_id) REFERENCES publicidad(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ──────────────────────────────────────────────────────────
--  FORO — HILOS
--  usuario_id → cualquier usuario puede abrir un hilo (admin o vendedor)
--  LEFT JOIN con vendedores para obtener nombre/perfil/color del autor
-- ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS foro_hilos (
  id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  titulo          VARCHAR(400) NOT NULL,
  contenido       TEXT         NOT NULL,
  usuario_id      INT UNSIGNED NOT NULL,
  respuestas      INT          NOT NULL DEFAULT 0,
  creado_en       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  actualizado_en  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE,
  INDEX idx_usuario (usuario_id),
  INDEX idx_creado  (creado_en)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ──────────────────────────────────────────────────────────
--  FORO — RESPUESTAS
--  usuario_id → cualquier usuario puede responder (admin o vendedor)
--  LEFT JOIN con vendedores para obtener nombre/perfil/color del autor
-- ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS foro_respuestas (
  id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  hilo_id         INT UNSIGNED NOT NULL,
  usuario_id      INT UNSIGNED NOT NULL,
  contenido       TEXT        NOT NULL,
  creado_en       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (hilo_id)    REFERENCES foro_hilos(id)  ON DELETE CASCADE,
  FOREIGN KEY (usuario_id) REFERENCES usuarios(id)    ON DELETE CASCADE,
  INDEX idx_hilo    (hilo_id),
  INDEX idx_usuario (usuario_id),
  INDEX idx_creado  (creado_en)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ──────────────────────────────────────────────────────────
--  CLAVES API
-- ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS api_claves (
  id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  servicio        VARCHAR(100) NOT NULL UNIQUE COMMENT 'ej: wompi, openrouter',
  nombre          VARCHAR(200) NOT NULL DEFAULT '',
  origen_url      VARCHAR(500) NOT NULL DEFAULT '',
  clave           TEXT         NOT NULL COMMENT 'API key cifrada',
  modelos         JSON         NULL COMMENT 'Array de modelos (para IA)',
  activo          TINYINT(1)   NOT NULL DEFAULT 1,
  nota            TEXT,
  creado_en       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  actualizado_en  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ──────────────────────────────────────────────────────────
--  SESIONES PHP
-- ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sesiones (
  id          VARCHAR(128) NOT NULL PRIMARY KEY,
  usuario_id  INT UNSIGNED NOT NULL,
  ip          VARCHAR(45)  NOT NULL DEFAULT '',
  user_agent  VARCHAR(500) NOT NULL DEFAULT '',
  token       VARCHAR(64)  NOT NULL UNIQUE,
  expira_en   DATETIME     NOT NULL,
  creado_en   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE,
  INDEX idx_token  (token),
  INDEX idx_expira (expira_en)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ============================================================
--  DATOS — orden respetando dependencias entre FK
-- ============================================================

-- ──────────────────────────────────────────────────────────
--  USUARIOS
--  id=1 → admin  |  id=2 → vendedor GI Store  |  id=3 → Café Aroma
--  IMPORTANTE: cambia la contraseña del admin antes de deploy
--  Password actual: Admin2024!
-- ──────────────────────────────────────────────────────────
INSERT INTO usuarios (id, correo, password_hash, rol, activo, creado_en) VALUES
  (1, 'admin@gistore.com',               '$2y$12$eGmQ6JD5Zr3YP4IxKv1OseXyMt8VWzUnBpQajNZf/Q7aLhcRrjDca', 1, 1, NOW()),
  (2, 'ilder1296@gmail.com',             '$2y$12$placeholder_hash_vendedor_1_cambiar_antes_de_deploy____', 2, 1, '2026-03-10 00:47:45'),
  (3, 'cafearomadelaserrania@gmail.com',  '$2y$12$placeholder_hash_vendedor_2_cambiar_antes_de_deploy____', 2, 1, '2026-03-18 19:48:03');

-- ──────────────────────────────────────────────────────────
--  CATEGORÍAS
--  id=1 Salud y Bienestar | 2 Café y Bebidas | 3 Hogar
--  id=4 Belleza | 5 Moda | 6 Tecnología | 7 Librería
-- ──────────────────────────────────────────────────────────
INSERT INTO categorias (id, nombre, orden, creado_en) VALUES
  (1, 'Salud y Bienestar',         1, NOW()),
  (2, 'Café y Bebidas',            2, NOW()),
  (3, 'Hogar',                     3, NOW()),
  (4, 'Belleza y Cuidado Personal', 4, NOW()),
  (5, 'Moda',                      5, NOW()),
  (6, 'Tecnología',                6, NOW()),
  (7, 'Librería',                  7, NOW());

-- ──────────────────────────────────────────────────────────
--  VENDEDORES
--  id=1 → GI Store (usuario_id=2)
--  id=2 → Café Aroma de la Serranía (usuario_id=3)
-- ──────────────────────────────────────────────────────────
INSERT INTO vendedores (id, usuario_id, nombre, ciudad, correo, whatsapp, descripcion, perfil, color, url_web, redes, estado, creado_en, actualizado_en) VALUES
  (1, 2,
   'GI Store',
   'Aguachica, Cesar',
   'ilder1296@gmail.com',
   '573145891108',
   'GI Store conecta compradores con vendedores independientes de Colombia. Cada vendedor presenta sus productos con transparencia — precios, fotos y beneficios reales — para que cierres tu compra directo por WhatsApp. Calidad · Estilo · Confianza.',
   'https://res.cloudinary.com/dqmrgerue/image/upload/v1773109424/productos-clientes/na1pa6cbyl1fdxzgx0ql.png',
   '#4caf50',
   NULL,
   '{}',
   'activo',
   '2026-03-10 00:47:45',
   '2026-03-20 06:33:13'),

  (2, 3,
   'Café Aroma de la Serranía',
   'Aguachica',
   'cafearomadelaserrania@gmail.com',
   '573185818424',
   NULL,
   NULL,
   '#795548',
   NULL,
   '{}',
   'activo',
   '2026-03-18 19:48:03',
   '2026-03-18 19:58:32');

-- ──────────────────────────────────────────────────────────
--  PLANES DE MEMBRESÍA
-- ──────────────────────────────────────────────────────────
INSERT INTO planes_membresia (id, nombre, descripcion, precio, duracion_dias, activo, orden, creado_en, actualizado_en) VALUES
  (1, 'Fundador',
   'El plan fundador es un privilegio solo para los 15 primeros integrantes de GI Store, por todo un año tendrán un 40% de descuento en la membresía.',
   15000, 30, 1, 1,
   '2026-03-14 18:13:20', '2026-03-14 18:13:20'),

  (2, 'Mensualidad',
   'Paga membresía mensual para obtener los beneficios de GI Store.',
   25000, 30, 1, 2,
   '2026-03-14 18:09:25', '2026-03-14 18:09:43'),

  (3, 'Trimestral',
   'Puedes ahorrar 15% para disfrutar de todos los beneficios de GI Store.',
   63750, 90, 1, 3,
   '2026-03-14 18:17:17', '2026-03-14 18:17:28'),

  (4, 'Semestre',
   'Acceso completo por 6 meses al catálogo GI Store, ahorra un 20%.',
   120000, 180, 1, 4,
   '2026-03-14 18:08:00', '2026-03-14 18:14:20'),

  (5, 'Anualidad',
   'Ahorra un 30% en la membresía, solo pagas una vez por año.',
   225000, 365, 1, 5,
   '2026-03-14 18:19:18', '2026-03-14 18:19:18');

-- ──────────────────────────────────────────────────────────
--  MEMBRESÍAS
--  vendedor 1 = GI Store (Fundador, sin plan asignado aún)
--  vendedor 2 = Café Aroma (primer mes gratis, sin plan)
-- ──────────────────────────────────────────────────────────
INSERT INTO membresias (id, vendedor_id, plan_id, fecha_inicio, fecha_fin, estado, notas, creado_en) VALUES
  (1, 1, NULL, '2026-03-09', '2026-04-30', 'activa', 'Fundador', '2026-03-11 20:59:53'),
  (2, 2, NULL, '2026-03-18', '2026-04-18', 'activa', 'Primera vendedora registrada, primer mes gratis', '2026-03-18 19:58:32');

-- ──────────────────────────────────────────────────────────
--  FUNDADORES
-- ──────────────────────────────────────────────────────────
INSERT INTO fundadores (id, vendedor_id, fecha_registro, creado_en) VALUES
  (1, 1, '2026-03-11', '2026-03-11 12:14:17'),
  (2, 2, '2026-03-18', '2026-03-18 19:57:49');

-- ──────────────────────────────────────────────────────────
--  PUBLICIDAD
--  id=1 → Portafolio Web (activa)
--  id=2 → registro vacío del JSON, se inserta inactivo
-- ──────────────────────────────────────────────────────────
INSERT INTO publicidad (id, titulo, imagen_url, url_destino, fecha_inicio, fecha_fin, limite_diario, estado, creado_en, actualizado_en) VALUES
  (1,
   'Portafolio Web',
   'https://res.cloudinary.com/dqmrgerue/image/upload/v1773893829/publicidad/zfrwqfkkqzzxfzuwcni1.png',
   'https://ildergutierrez.github.io/portafolio/',
   '2026-03-19', '2026-05-18',
   50, 'activa',
   '2026-03-19 04:17:09', '2026-03-21 00:34:58'),

  (2,
   'Sin título',
   NULL, NULL,
   CURDATE(), CURDATE(),
   50, 'inactiva',
   NOW(), NOW());

-- ──────────────────────────────────────────────────────────
--  IMPRESIONES DE PUBLICIDAD
-- ──────────────────────────────────────────────────────────
INSERT INTO publicidad_impresiones (publicidad_id, fecha, contador) VALUES
  (1, '2026-03-19',  69),
  (1, '2026-03-20', 105),
  (1, '2026-03-21', 263),
  (1, '2026-03-22',  61),
  (1, '2026-03-23',   1),
  (2, '2026-03-19',   1);

-- ──────────────────────────────────────────────────────────
--  API CLAVES
-- ──────────────────────────────────────────────────────────
INSERT INTO api_claves (id, servicio, nombre, origen_url, clave, modelos, activo, nota, creado_en, actualizado_en) VALUES
  (1,
   'openrouter',
   'OpenRouter IA',
   'https://openrouter.ai/api/v1/chat/completions',
   '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',
   '["google/gemma-3-27b-it:free","deepseek/deepseek-r1-distill-llama-70b:free","nousresearch/deephermes-3-llama-3-8b:free"]',
   1,
   'Clave generada 2026-03-19, plan gratuito OpenRouter',
   '2026-03-20 02:33:16', '2026-03-20 02:52:35');

-- ──────────────────────────────────────────────────────────
--  FORO — HILOS
--  usuario_id=1 → admin@gistore.com  (rol=1, no tiene fila en vendedores)
--  usuario_id=2 → ilder1296@gmail.com (rol=2, vendedor GI Store)
--
--  Para mostrar nombre/foto del autor en el frontend usar:
--    SELECT fh.*, COALESCE(v.nombre,'Administrador') AS autor_nombre,
--           v.perfil AS autor_foto, v.color AS autor_color
--    FROM foro_hilos fh
--    JOIN usuarios u ON u.id = fh.usuario_id
--    LEFT JOIN vendedores v ON v.usuario_id = u.id
-- ──────────────────────────────────────────────────────────
INSERT INTO foro_hilos (id, titulo, contenido, usuario_id, respuestas, creado_en, actualizado_en) VALUES
  (1,
   '¿Cómo funciona GI Store? Todo lo que necesitas saber',
   'GI Store es un catálogo digital donde encuentras productos de vendedores independientes en Colombia — suplementos, tecnología, moda, hogar y más.\nEl proceso es simple:\n\nExploras el catálogo y encuentras lo que te interesa\nLe das clic al producto para ver detalles, precio y quién lo vende\nPresionas "Comprar por WhatsApp" y quedas en contacto directo con el vendedor\nCoordinan el pago y el envío entre ustedes — sin intermediarios\n\nSin registros, sin pagos en línea, sin complicaciones.\nSi ves un producto destacado en la esquina de la pantalla, ese también es clickeable — te lleva directo a la ficha del producto.\n¿Eres vendedor y quieres publicar tus productos? Visita el portal de vendedores y empieza hoy.',
   1, 0,
   '2026-03-21 03:28:38', '2026-03-21 03:28:38'),

  (2,
   '¿Como puedo generar una publicidad para un solo producto?',
   'En la sección de ayuda vi que se podía editar un producto y descargarlo para usarlo como publicidad.\nexplica por favor',
   2, 1,
   '2026-03-22 21:40:50', '2026-03-22 21:40:50');

-- ──────────────────────────────────────────────────────────
--  FORO — RESPUESTAS
--  usuario_id=1 → admin respondió el hilo 2
--
--  Para mostrar nombre/foto del autor en el frontend usar:
--    SELECT fr.*, COALESCE(v.nombre,'Administrador') AS autor_nombre,
--           v.perfil AS autor_foto, v.color AS autor_color
--    FROM foro_respuestas fr
--    JOIN usuarios u ON u.id = fr.usuario_id
--    LEFT JOIN vendedores v ON v.usuario_id = u.id
--    WHERE fr.hilo_id = ?
-- ──────────────────────────────────────────────────────────
INSERT INTO foro_respuestas (id, hilo_id, usuario_id, contenido, creado_en) VALUES
  (1, 2, 1,
   'Hola.\nSi, para la edición de publicidad de un producto (para descargar), debes acceder en tu panel a la sección llamada "spotlight", allí podrá encontrar todos sus productos, solo seleccione al que desea editar. Aparecerán dos opciones: editar con IA (te genera texto llamativo del producto) o edición libre, el cual te enviará a una página donde tendrás libertad de escribir información de dicho producto y cambiar colores, insertar texto, ampliar o reducir la imagen, cambiar el tamaño de las letras y más. Al finalizar solo debes descargar.\nNota: "Si quieres cambiar la foto del producto, tienes dos opciones, cambiarlo por la URL o cambiar (editando) la imagen del producto".\nPosdata: dentro de la sección de edición libre, si das en editar libre, se abrirá una nueva ventana con todo limpio, solo esperando que tú llenes la información a tu gusto.\n\n--- Tener presente: Las imágenes solo se aceptan por URLs ---',
   '2026-03-22 22:47:47');

-- ──────────────────────────────────────────────────────────
--  PRODUCTOS  (todos de vendedor_id=1, categoria_id=1)
-- ──────────────────────────────────────────────────────────
INSERT INTO productos (id, vendedor_id, categoria_id, nombre, descripcion, recomendacion, beneficios, valor, imagen, activo, creado_en, actualizado_en) VALUES

(1, 1, 1,
 'Boldo + Clorofila y Menta',
 'Suplemento natural que combina boldo, clorofila, menta, sábila y albahaca con acción refrescante, depurativa y revitalizante.',
 'Disolver una cucharada en un vaso de agua y consumir después de las comidas principales.',
 '["Desintoxicacion Natural","Soporte Epatico","Digestión saludable","Purificación del cuerpo"]',
 38000, 'img/productos/2/1_25_clorofila_menta.jpeg', 1,
 '2026-03-09 23:00:26', '2026-03-20 06:33:11'),

(2, 1, 1,
 'Citrato y Cloruro de Magnesio - Potasio',
 'Suplemento de Magnesio 4 en 1 que combina varios beneficios para la salud muscular y nerviosa.',
 'Tomar 1 cápsula al día, preferiblemente con las comidas.',
 '["Función Muscular y Nerviosa","Regulación de la Presión Arterial","Salud Ósea","Alivio de Migrañas","Apoyo Digestivo"]',
 50000, 'img/productos/2/2_38_citrato.jpeg', 1,
 '2026-03-09 23:00:26', '2026-03-20 06:33:11'),

(3, 1, 1,
 'Vitamina E - 1.000 UI',
 'Suplemento dietario que actúa como potente antioxidante ayudando a combatir los radicales libres.',
 'La dosis de 1000 UI se puede tomar diariamente con alimentos que contengan grasa para mejorar su absorción.',
 '["Antioxidante Potente","Salud de la Piel","Protección Cardiovascular","Mejora de la Salud Ocular","Apoyo al Sistema Inmunológico"]',
 52000, 'img/productos/2/3_40_vitamina_E.jpeg', 1,
 '2026-03-09 23:00:26', '2026-03-20 06:33:11'),

(4, 1, 1,
 'Duo de bienestar Integral: Citrato de Magnesio + Vitamina E',
 'Combinación de Citrato de Magnesio y Vitamina E para apoyar la salud muscular, nerviosa, cardiovascular y antioxidante.',
 'Tomar 2 gomitas al día, preferiblemente después de una comida.',
 '["Antioxidante Potente","Relajación Muscular","Salud Ósea","Mejora de la Salud Ocular","Reduce el Estrés Oxidativo"]',
 55000, 'img/productos/2/4_40_magnecio+vitaminaE.jpeg', 1,
 '2026-03-09 23:00:27', '2026-03-20 06:33:11'),

(5, 1, 1,
 'Omega 3',
 'Los ácidos grasos omega-3 son esenciales para la salud física y mental.',
 'La OMS recomienda entre 250 y 2000 mg al día dependiendo de la edad.',
 '["Apoya la salud cerebral y Cognitiva","Reduce la inflamación corporal","Mejora la salud Cardiovascular","Mejora la hidratación y salud de la piel"]',
 55000, 'img/productos/2/5_40_omega3.jpeg', 1,
 '2026-03-09 23:00:27', '2026-03-20 06:33:11'),

(6, 1, 1,
 'Ginkgo Biloba',
 'Suplemento natural para mejorar la circulación sanguínea, la función cognitiva y reducir el estrés oxidativo.',
 'No exceder la dosis diaria recomendada. Consultar profesional antes de iniciar.',
 '["Mejorar el flujo sanguíneo cerebral y periférico","Mejora la memoria y la concentración","Actua como potente Antioxidante","Reduce la fatiga mental y el estrés"]',
 45000, 'img/productos/2/6_32_ginkgo.jpeg', 1,
 '2026-03-09 23:00:27', '2026-03-20 06:33:11'),

(7, 1, 1,
 'ASHWAGANDHA KSM-66',
 'Extracto de raíz de Withania somnifera de espectro completo, altamente concentrado con 5% withanólidos.',
 'Dosis de 300 a 600 mg al día, dividida en dos tomas (mañana y noche) con alimentos.',
 '["Reduce el estrés y el cortisol","Mejora del Sueño","Rendimiento Físico y Mental","Apoyo Hormonal"]',
 60000, 'img/productos/2/7_45_ksm-66.jpeg', 1,
 '2026-03-09 23:00:27', '2026-03-20 06:33:11'),

(8, 1, 1,
 'GLUCOSAMIN 1500 mg',
 'Suplemento de glucosamina de alta concentración para la salud articular.',
 'Tomar dos cápsulas diarias con las comidas.',
 '["Salud Articular","Mejora la elasticidad de la piel","Alivio del Dolor","Mejora la Hidratación"]',
 54000, 'img/productos/2/8_40_glucosamin.jpeg', 1,
 '2026-03-09 23:00:27', '2026-03-20 06:33:11'),

(9, 1, 1,
 'GAF-PLUS',
 'Suplemento multivitamínico líquido de hierbas y vitaminas para aumentar la energía y fortalecer el sistema inmunológico.',
 'Tomar una copa (15 ml) dos veces al día. Conservar refrigerado una vez abierto.',
 '["Huesos fuertes","Articulaciones flexible","Energia vital"]',
 41000, 'img/productos/2/9_30_gaf-plus.jpeg', 1,
 '2026-03-09 23:00:28', '2026-03-20 06:33:11'),

(10, 1, 1,
 'Salud de la mujer',
 'Jarabes formulados con hierbas para regular el ciclo menstrual, aliviar cólicos y equilibrar hormonas.',
 'Tomar por vía oral 3 veces al día, generalmente antes de las comidas.',
 '["Desinflamante Femenino","Alivia colicos menstruales","Disminuye el flujo y las molestias"]',
 30000, 'img/productos/2/10_23_salud_de_la_mujer.jpeg', 1,
 '2026-03-09 23:00:28', '2026-03-20 06:33:11'),

(11, 1, 1,
 'Vita Celebrina - Jarabe',
 'Suplemento rico en vitaminas y minerales para apoyar la función cognitiva en niños y adultos.',
 'Para niños mayores de 4 años, tomar 2 cucharaditas diarias.',
 '["Mejora la memoria","Aumenta la concentración","Refuerza el rendimiento mental"]',
 40000, 'img/productos/2/11_28_vitacelebrina_jarabe.jpeg', 1,
 '2026-03-09 23:00:28', '2026-03-20 06:33:11'),

(12, 1, 1,
 'Enervital - Jarabe',
 'Suplemento alimenticio con vitaminas y minerales esenciales para el desarrollo infantil.',
 'Tomar una medida 3 veces al día.',
 '["Aporta Energia","Refuerza las defensas","Crecimiento saludable"]',
 38000, 'img/productos/2/12_24_enervital.jpeg', 1,
 '2026-03-09 23:00:28', '2026-03-20 06:33:11'),

(13, 1, 1,
 'NeurisZinc - Capsulas',
 'Suplemento para apoyar la función cognitiva, mejorar la memoria y calmar síntomas de ansiedad.',
 'Posología indicada por el fabricante según presentación.',
 '["Apoyo a la Memoria","Mejora la concentración","Reduce el estrés y la ansiedad","Función neurologica saludable"]',
 38000, 'img/productos/2/13_25_neurizinc.jpeg', 1,
 '2026-03-09 23:00:28', '2026-03-20 06:33:11'),

(14, 1, 1,
 'GAF-PLUS OMEGA 3, 6, 9',
 'Suplemento en cápsulas rico en ácidos grasos omega-3 para apoyar la salud del corazón y el cerebro.',
 'Tomar 2 cápsulas al día con las comidas.',
 '["Piel radiante y elastica","Equilibrio Electrolitico","Reducción de la inflamación","Salud Cardiovascular y Cerebral"]',
 55000, 'img/productos/2/14_40_gaf-plus_omega3.jpeg', 1,
 '2026-03-09 23:00:28', '2026-03-20 06:33:11'),

(15, 1, 1,
 'Colageno Hidrolizado Healthy Life',
 'Suplemento de colágeno hidrolizado en cápsulas para promover la integridad estructural del cuerpo.',
 'Consultar la etiqueta del producto para instrucciones de uso personalizadas.',
 '["Mejora la salud de la piel","Salud articular y cartílago","Cabello y uñas fuertes","Soporte muscular","Bienestar general"]',
 50000, 'img/productos/2/15_35_colageno_hidrolizado.jpeg', 1,
 '2026-03-09 23:00:29', '2026-03-20 06:33:11'),

(16, 1, 1,
 'Vitamina D3 Healthful Life',
 'Suplemento de Vitamina D3 con 4.000 UI por cápsula para el fortalecimiento del sistema óseo.',
 'Ingerir 1 cápsula al día con una comida principal para mejorar la absorción.',
 '["Apoyo al sistema inmunitario","Huesos y dientes fuertes","Mejora el estado de ánimo y la energía"]',
 45000, 'img/productos/2/16_30_vitaminaD3.jpeg', 1,
 '2026-03-09 23:00:29', '2026-03-20 06:33:11'),

(17, 1, 1,
 'Vitamina C 1.000mg Healthful Life',
 'Suplemento de 1.000mg de Vitamina C con Zinc para maximizar la protección del sistema inmune.',
 'Tomar 1 cápsula al día, preferiblemente con alimentos.',
 '["Refuerzo Inmunológico","Protección Antioxidante","Piel Saludable y Cicatrización","Más Energía"]',
 40000, 'img/productos/2/17_28_vitaminaC_capsulas.jpeg', 1,
 '2026-03-09 23:00:29', '2026-03-20 06:33:11'),

(18, 1, 1,
 'Expectorante Pulmonar Plus Bronco Dilatador',
 'Jarabe expectorante y broncodilatador para limpiar las vías respiratorias y facilitar la respiración.',
 'Dosis varía según la edad. Verificar en el empaque o bajo indicación médica.',
 '["Reduce la tos y expulsa las flemas","Dilata los bronquios","Ayuda a respirar mejor","Alivia la congestión"]',
 36000, 'img/productos/2/18_25_pulmonar.jpeg', 1,
 '2026-03-09 23:00:29', '2026-03-20 06:33:11'),

(19, 1, 1,
 'Calostro Bovino Factor de Transferencia Omega 3, 6, 9',
 'Alimento en polvo a base de calostro bovino liofilizado enriquecido con proteína de suero de leche. Este suplemento combina el calostro con ácidos grasos esenciales y minerales para ofrecer una acción integral.',
 'Presentación: Polvo sabor vainilla (tarro de 600g). Dosis típica: Se recomienda disolver 1 a 2 cucharadas (aproximadamente 20-30g) en un vaso de agua, jugo o leche, una o dos veces al día. Momento ideal: Suele sugerirse tomarlo en ayunas o antes de la comida principal para maximizar la absorción de sus componentes bioactivos. Consideraciones: No debe ser consumido por personas alérgicas a la proteína de la leche de vaca. Consultar médico durante embarazo y lactancia.',
 '["Refuerza el sistema inmunológico","Mejora la salud intestinal","Fuente de Omega 3, 6 y 9","Aporta calcio y magnesio"]',
 50000, 'img/productos/2/19_35_calostro.jpeg', 1,
 '2026-03-09 23:00:29', '2026-03-20 06:33:11'),

(20, 1, 1,
 'Niños Aptmax',
 'Alimento en polvo con proteína de soya, suero de leche, calcio y magnesio. Sabor vainilla fresa.',
 'Seguir instrucciones de preparación del envase para la porción adecuada.',
 '["Crecimiento muscular","Desarrollo cognitivo","Energía sostenida","Bienestar general"]',
 42000, 'img/productos/2/20_30_aptmaxNiño.jpeg', 1,
 '2026-03-09 23:00:29', '2026-03-20 06:33:11'),

(21, 1, 1,
 'Citrato de Magnesio + Colágeno Hidrolizado',
 'Suplemento en polvo de citrato de magnesio, colágeno hidrolizado y calcio con sabor vainilla.',
 'Disolver la porción indicada en agua o bebida favorita.',
 '["Salud Ósea y Dental","Apoyo Articular y Muscular","Cuidado de la Piel y el Cabello","Alivio de la Fatiga","Función Muscular Normal"]',
 50000, 'img/productos/2/21_35_citrato_de_magnecio.jpeg', 1,
 '2026-03-09 23:00:30', '2026-03-20 06:33:11'),

(22, 1, 1,
 'Vitacerebrina Francesa',
 'Suplemento 100% natural para potenciar el rendimiento cerebral y proteger el sistema cardiovascular.',
 'El empaque contiene 20 tablecaps y 10 ampolletas. Seguir indicaciones para tratamiento completo.',
 '["Apoyo Cognitivo","Salud Cardiovascular","Energía Mental","Protección Antioxidante"]',
 38000, 'img/productos/2/22_25_VitacelebrinaFrancesa.jpeg', 1,
 '2026-03-09 23:00:30', '2026-03-20 06:33:11'),

(23, 1, 1,
 'Barrido Arterio Venoso',
 'Suplemento dietario sin azúcar para la salud del sistema circulatorio. Apto para diabéticos.',
 'Seguir indicaciones del envase. Generalmente 1 o 2 cápsulas diarias.',
 '["Limpieza arterial","Control de lípidos","Fortalecimiento vascular","Mejora del flujo sanguíneo","Salud cardiovascular"]',
 39000, 'img/productos/2/23_25_barrido.jpeg', 1,
 '2026-03-09 23:00:30', '2026-03-20 06:33:11'),

(24, 1, 1,
 'Combo Bienestar y Salud Digestiva (Lax Colon + Max Colon)',
 'Solución integral para el bienestar colónico combinando la acción depurativa de Lax Colon con la fibra de Max Colon.',
 'Lax Colon: según indicaciones del envase. Max Colon: disolver en agua antes de comidas.',
 '["Limpieza profunda del sistema digestivo","Combate el estreñimiento","Reductor de peso natural","Regula colesterol y azúcar","Contiene 10 extractos naturales"]',
 78000, 'img/productos/2/24_50_par_laxcolon_y_Maxcolon.jpeg', 1,
 '2026-03-09 23:00:30', '2026-03-20 06:33:11'),

(25, 1, 1,
 'Colágeno Hidrolizado + Biotina con Magnesio',
 'Suplemento líquido de 375ml con colágeno hidrolizado, biotina, magnesio y complejo vitamínico.',
 'Seguir instrucciones del envase, preferiblemente en la mañana.',
 '["Salud de la Piel","Fortalece el Cabello","Uñas Fuertes","Bienestar Articular","Soporte Inmune"]',
 38000, 'img/productos/2/25_25_colageno_biotina.jpeg', 1,
 '2026-03-09 23:00:30', '2026-03-20 06:33:11'),

(26, 1, 1,
 'Vino Cerebral Tónico Reconstituyente',
 'Tónico de 500ml con Ginkgo Biloba, Ginseng, Maca y nutrientes esenciales para mejorar la función cognitiva.',
 'Una copa dosificadora al día preferiblemente con el desayuno.',
 '["Apoyo a la memoria y concentración","Salud cardiovascular y cerebral","Energía y vitalidad","Rendimiento mental","Equilibrio y adaptógeno"]',
 36000, 'img/productos/2/26_25_Vino_celebral.jpeg', 1,
 '2026-03-09 23:00:30', '2026-03-20 06:33:11'),

(27, 1, 1,
 'Artrin Natural (Original Cubano)',
 'Producto natural en 25 grageas enfocado en el tratamiento de procesos degenerativos articulares.',
 'Consultar a un médico antes de su uso.',
 '["Tratamiento articular","Reducción del dolor","Alivio lumbar","Propiedades regenerativas"]',
 31000, 'img/productos/2/27_20_artrin.jpeg', 1,
 '2026-03-09 23:00:31', '2026-03-20 06:33:11'),

(28, 1, 1,
 'Ajo ROGOFF Garli (Improfarme)',
 'Tabletas recubiertas que combinan ajo con perejil, limón y complejo vitamínico para el bienestar circulatorio.',
 'Seguir la dosis diaria indicada en el empaque. Envase con 180 tabletas.',
 '["Salud Cardiovascular","Refuerzo Inmunitario","Acción Antioxidante","Efecto Depurativo","Sin mal aliento"]',
 31000, 'img/productos/2/28_20_ajo_regoff.jpeg', 1,
 '2026-03-09 23:00:31', '2026-03-20 06:33:11'),

(29, 1, 1,
 'Boromiel Jalea de Borojó',
 'Jalea de 500g elaborada con borojó y miel como suplemento energético reconstituyente.',
 'Consumir directamente, mezclar en jugos o usar como esparcible.',
 '["Fuerza y Energía Natural","Salud Física y Vitalidad","Soporte Inmunológico","Concentración y Agudeza Mental"]',
 34000, 'img/productos/2/29_20_Boromil.jpeg', 1,
 '2026-03-09 23:00:31', '2026-03-20 06:33:11'),

(30, 1, 1,
 'K.L.G Fórmula Natural (1000 ml)',
 'Suplemento líquido de 1000 ml para potenciar el vigor físico y la vitalidad masculina.',
 'Una copa dosificadora diaria, preferiblemente con alimentos.',
 '["Aumento de energía y resistencia","Mejora del desempeño","Salud y vitalidad general","Fórmula natural"]',
 45000, 'img/productos/2/30_30_KLG.jpeg', 1,
 '2026-03-09 23:00:31', '2026-03-20 06:33:11'),

(31, 1, 1,
 'El Secreto del Abuelo Culion (Vigorizante Ancestral)',
 'Tónico vigorizante de origen ancestral para potenciar la fuerza física y mental.',
 'Una copa dosificadora diaria con comidas principales.',
 '["Vitalidad Natural","Fuerza y Energía","Bienestar Diario","Concentración Clara","Poder Ancestral"]',
 45000, 'img/productos/2/31_30_el_abuelo.jpeg', 1,
 '2026-03-09 23:00:31', '2026-03-20 06:33:11'),

(32, 1, 1,
 'Castaño de Indias (Extracto Natural)',
 'Suplemento líquido de 375 ml para la circulación venosa de las piernas.',
 'Seguir instrucciones del empaque sobre modo de uso.',
 '["Mejora la circulación","Alivia várices","Reduce pesadez","Disminuye hinchazón","Alivio y confort"]',
 34000, 'img/productos/2/32_20_castañodeindia.jpeg', 1,
 '2026-03-09 23:00:32', '2026-03-20 06:33:11'),

(33, 1, 1,
 'Rompe Colchón (7 Potencias - Vuelve la Vida)',
 'Suplemento líquido de 1000 ml con 7 ingredientes naturales para maximizar la potencia y el vigor.',
 'Una copa dosificadora diaria o 30 minutos antes de actividad física.',
 '["Incrementa el deseo sexual","Brinda energía y vitalidad","Mejora el rendimiento","Aumenta la potencia masculina","Fórmula Multi-Extractos"]',
 45000, 'img/productos/2/33_30_rompe_colchon.jpeg', 1,
 '2026-03-09 23:00:32', '2026-03-20 06:33:11'),

(34, 1, 1,
 'El Secreto del Abuelo Culión (Vigorizante Ancestral)',
 'Vigorizante ancestral con extractos naturales energéticos y afrodisíacos para la vitalidad masculina.',
 'Una copa dosificadora diaria según indicaciones del envase.',
 '["Restaura la Potencia Masculina","Incrementa el Deseo Sexual","Proporciona Energía y Vitalidad","Mejora el Rendimiento Físico","Fórmula con Adaptógenos"]',
 45000, 'img/productos/2/34_30_el_abuelo.jpeg', 1,
 '2026-03-09 23:00:32', '2026-03-20 06:33:11'),

(35, 1, 1,
 'Mega Magnesio con Colágeno Marino',
 'Suplemento líquido de 1000 ml con Colágeno Marino, Vitamina C y dos tipos de magnesio.',
 'Una copa dosificadora diaria, preferiblemente en la mañana.',
 '["Favorece el Sistema Nervioso","Alivia el Dolor Muscular","Fortalece los Huesos","Energía y Vitalidad","Triple Fuente de Magnesio"]',
 49000, 'img/productos/2/35_35_megaMagnecio.jpeg', 1,
 '2026-03-09 23:00:32', '2026-03-20 06:33:11'),

(36, 1, 1,
 'VTAL Granulada',
 'Alimento granulado de 700g a base de suero de leche con albúmina, levadura y malta.',
 'Disolver la porción indicada en leche, agua o jugos.',
 '["Fortalecimiento Muscular","Energía y Vitalidad Sostenida","Apoyo Inmunológico y Cognitivo","Salud de Cabello Piel y Uñas","Bienestar Digestivo"]',
 42000, 'img/productos/2/36_30_vtalGranulada.jpeg', 1,
 '2026-03-09 23:00:33', '2026-03-20 06:33:11'),

(37, 1, 1,
 'Glucosamina + Chondroitina MF Natural',
 'Suplemento líquido para articulaciones y sistema óseo con glucosamina, condroitina y omegas.',
 'Una copa dosificadora diaria con comidas principales.',
 '["Alivia el dolor articular","Fortalece ligamentos y tendones","Protege los cartílagos","Previene la osteoporosis","Enriquecido con Omega 3 y 6"]',
 45000, 'img/productos/2/37_30_glucosamina.jpeg', 1,
 '2026-03-09 23:00:33', '2026-03-20 06:33:11'),

(38, 1, 1,
 'Vitamina C + Echinacea',
 'Suplemento líquido de 375 ml con Vitamina C y Echinacea. Sabor naranja endulzado con stevia.',
 'Dosis diaria indicada en el envase, preferiblemente en la mañana.',
 '["Refuerzo del sistema inmunitario","Fortalece tus defensas","Energía natural y bienestar","100% Natural","Endulzado con Stevia"]',
 32000, 'img/productos/2/38_20_vitamiaC.jpeg', 1,
 '2026-03-09 23:00:33', '2026-03-20 06:33:11'),

(39, 1, 1,
 'Colágeno Hidrolizado + Biotina',
 'Suplemento vitamínico líquido de 1000 ml con colágeno hidrolizado y biotina, endulzado con stevia.',
 'Seguir instrucciones del envase o de un profesional de la salud.',
 '["Mejora la elasticidad de la piel","Fortalece el cabello y las uñas","Hidratación profunda","Apoyo articular","Enriquecido con Vitamina E"]',
 38000, 'img/productos/2/39_25_colageno.jpeg', 1,
 '2026-03-09 23:00:33', '2026-03-20 06:33:11'),

(40, 1, 1,
 'Torovital Pharma Sangre de Toro',
 'Tónico vitamínico reconstituyente en jarabe de 500 ml para la vitalidad y rendimiento óptimo.',
 'Una copa dosificadora diaria con comidas principales.',
 '["Aumento de energía y vigor","Apoyo al sistema inmunitario","Mejora el rendimiento físico y mental","Complejo vitamínico completo","Reduce la fatiga"]',
 34000, 'img/productos/2/40_21_totovital.jpeg', 1,
 '2026-03-09 23:00:34', '2026-03-20 06:33:11'),

(41, 1, 1,
 'Jarabe de Zarzaparrilla Gomarti',
 'Suplemento en jarabe con 12 extractos botánicos para conservar en buen estado el hígado y los riñones.',
 'Tratamiento completo de 3 frascos según indicaciones del fabricante.',
 '["Salud Hepática","Función Renal Óptima","Digestión de Grasas","Reduce la Inflamación","Depurativo Natural"]',
 33000, 'img/productos/2/41_20_zarzaparrilla.jpeg', 1,
 '2026-03-09 23:00:34', '2026-03-20 06:33:11'),

(42, 1, 1,
 'Citrato de Potasio + Citrato de Magnesio',
 'Complemento alimenticio líquido de 1000 ml para optimizar la recuperación muscular y el rendimiento diario.',
 'Una copa dosificadora diaria con comidas para correcta absorción.',
 '["Apoya la función muscular","Reduce el cansancio y la fatiga","Fórmula sinérgica de doble acción","Bienestar general"]',
 50000, 'img/productos/2/42_35_citrato_de_potacsio.jpeg', 1,
 '2026-03-09 23:00:34', '2026-03-20 06:33:11'),

(43, 1, 1,
 'Vino Nutri Cerebral',
 'Reconstituyente cerebral líquido de 1000 ml 100% natural para nutrir la mente y el cuerpo.',
 'Una copa dosificadora diaria para beneficios de nutrición cerebral.',
 '["Apoyo Cognitivo Avanzado","Salud del Nervio Óptico","Energía y Vitalidad Global","Protección Neuronal","Equilibrio Neuro-Emocional"]',
 45000, 'img/productos/2/43_30_vino_nutri.jpeg', 1,
 '2026-03-09 23:00:34', '2026-03-20 06:33:11'),

(44, 1, 1,
 'Enfermedades de la Mujer',
 'Suplemento dietario natural de Laboratorios Prame elaborado a base de isoflavonas de soja, onagra, ortiga y vitaminas esenciales, diseñado para actuar como un apoyo nutricional en la salud de la mujer. Presentación: Frasco con 100 cápsulas.',
 'Se recomienda ingerir dos cápsulas al día por vía oral con suficiente agua, preferiblemente para personas mayores de 18 años y bajo supervisión médica si existen condiciones previas. Contraindicado en mujeres embarazadas o en periodo de lactancia. Almacenar en lugar fresco a temperatura no mayor a 30°C.',
 '["Equilibrio hormonal: Ayuda a regular las hormonas femeninas.","Bienestar femenino: Promueve la salud general de la mujer.","Apoyo ciclo menstrual: Brinda soporte durante el periodo.","Energía y vitalidad: Contribuye a mejorar los niveles de energía.","100% Natural: El producto está elaborado con ingredientes naturales."]',
 39000, 'https://res.cloudinary.com/dqmrgerue/image/upload/v1773786560/productos-clientes/mhefv3lvrhboi4gvastz.jpg', 1,
 '2026-03-17 22:29:20', '2026-03-20 06:33:11'),

(45, 1, 1,
 'Prostasan (Laboratorios Prame)',
 'Prostasan es un suplemento nutricional de origen 100% natural diseñado específicamente para el cuidado de la salud masculina. Fabricado por Laboratorios Prame en Perú, utiliza extractos botánicos para ofrecer un soporte integral al sistema genitourinario del hombre. Se comercializa en presentaciones de 100 cápsulas.',
 'Dosis: 2 cápsulas al día, preferiblemente después de las comidas principales. Tomar con abundante agua. No exceder la dosis recomendada. No recomendado para menores de 18 años. Evitar en caso de hipersensibilidad a cualquiera de sus ingredientes. No reemplaza tratamiento médico especializado.',
 '["Salud prostática integral: Contribuye al mantenimiento preventivo y saludable de la próstata.","Mejora el flujo urinario: Ayuda a normalizar la fuerza y constancia de la micción.","Reduce la frecuencia nocturna: Colabora en la disminución de las ganas constantes de orinar durante la noche.","Apoyo a la función reproductiva masculina: Aporta nutrientes que favorecen el bienestar del sistema reproductivo.","Energía y vitalidad: Incluye componentes que ayudan a mejorar el vigor y el rendimiento físico diario.","Protección antioxidante natural: Ayuda a proteger los tejidos de los radicales libres."]',
 39500, 'https://res.cloudinary.com/dqmrgerue/image/upload/v1773787136/productos-clientes/s1e9ukemqd3v62icjt8y.jpg', 1,
 '2026-03-17 22:38:56', '2026-03-20 06:33:11'),

(46, 1, 1,
 'Compuesto Riñosan (Laboratorios Prame)',
 'Riñosan es un suplemento nutricional de origen 100% natural formulado específicamente para el cuidado del sistema renal y urinario. Elaborado con una mezcla de hierbas puras diseñadas para promover el funcionamiento saludable de los riñones. Se presenta en un frasco con 100 cápsulas.',
 'Dosis: 2 cápsulas al día con abundante agua. Mantener en lugar fresco y seco, lejos de la luz solar directa. No recomendado en embarazo o lactancia. Destinado a adultos mayores de 18 años. No sustituye tratamientos médicos para insuficiencias renales graves.',
 '["Soporte renal integral: Ayuda al mantenimiento y funcionamiento óptimo de los riñones.","Equilibrio de electrolitos: Contribuye a mantener los niveles adecuados de sales y minerales en el cuerpo.","Salud de las vías urinarias: Promueve un sistema urinario libre de impurezas y saludable.","Promueve la diuresis saludable: Favorece la eliminación de líquidos y toxinas de manera natural.","Formulación herbal pura: Garantiza un producto libre de químicos sintéticos agresivos.","Energía y vitalidad: Ayuda a mejorar el bienestar general al mantener el organismo desintoxicado."]',
 48990, 'https://res.cloudinary.com/dqmrgerue/image/upload/v1773787236/productos-clientes/geljp0ulajjmw1csuks0.jpg', 1,
 '2026-03-17 22:40:36', '2026-03-20 06:33:11'),

(47, 1, 1,
 'Chanca Piedra (Laboratorios Prame)',
 'Suplemento nutricional 100% natural elaborado por Laboratorios Prame, formulado a base de extracto de planta entera. Diseñado para brindar soporte integral a la salud renal y de las vías urinarias. Se presenta en un frasco con 100 cápsulas.',
 'Dosis: 2 cápsulas diarias preferiblemente con las comidas principales. Acompañar con abundante agua. No recomendado en embarazo o lactancia. Para adultos mayores de 18 años. Consultar médico si existe condición renal preexistente grave.',
 '["Apoyo renal integral: Contribuye al funcionamiento saludable y preventivo de los riñones.","Mantiene la salud de las vías urinarias: Ayuda a conservar el sistema urinario en óptimas condiciones.","Ayuda a disolver cálculos: Propiedad tradicional de la planta que asiste en el tratamiento de sedimentos renales.","Equilibrio mineral: Colabora en la regulación de los minerales dentro del sistema renal.","Alivia la molestia espasmódica: Ayuda a reducir el malestar asociado a espasmos en el área renal.","Promueve la eliminación de toxinas: Facilita la depuración natural del organismo a través de la orina."]',
 49990, 'https://res.cloudinary.com/dqmrgerue/image/upload/v1773787395/productos-clientes/cp3oasaho2ixx6bsrfy7.jpg', 1,
 '2026-03-17 22:43:15', '2026-03-20 06:33:11');

SET foreign_key_checks = 1;

-- ============================================================
--  QUERY DE REFERENCIA — autor de hilos y respuestas
--  Usar siempre LEFT JOIN a vendedores para obtener nombre/foto/color.
--  El admin (usuario_id=1) no tiene fila en vendedores → COALESCE devuelve 'Administrador'.
-- ============================================================
--
--  Listar hilos con datos del autor:
--
--  SELECT
--    fh.id, fh.titulo, fh.contenido, fh.respuestas, fh.creado_en,
--    u.correo,
--    u.rol,
--    COALESCE(v.nombre, 'Administrador') AS autor_nombre,
--    v.perfil                            AS autor_foto,
--    COALESCE(v.color, '#1a6b3c')        AS autor_color
--  FROM foro_hilos fh
--  JOIN  usuarios  u ON u.id         = fh.usuario_id
--  LEFT JOIN vendedores v ON v.usuario_id = u.id
--  ORDER BY fh.creado_en DESC;
--
-- ──────────────────────────────────────────────────────────
--  Listar respuestas de un hilo con datos del autor:
--
--  SELECT
--    fr.id, fr.contenido, fr.creado_en,
--    u.correo,
--    u.rol,
--    COALESCE(v.nombre, 'Administrador') AS autor_nombre,
--    v.perfil                            AS autor_foto,
--    COALESCE(v.color, '#1a6b3c')        AS autor_color
--  FROM foro_respuestas fr
--  JOIN  usuarios  u ON u.id         = fr.usuario_id
--  LEFT JOIN vendedores v ON v.usuario_id = u.id
--  WHERE fr.hilo_id = ?
--  ORDER BY fr.creado_en ASC;
--
-- ============================================================
--  MAPA DE IDs  Firebase → MySQL  (referencia para migrar código)
-- ============================================================
-- VENDEDORES
--   0G1g6gbYawJiBxUldoZi  →  1  (GI Store)
--   HsuGyaIti6tqOO3pWSiP  →  2  (Café Aroma de la Serranía)
--
-- CATEGORÍAS
--   r4PQ7D2ZXin3S4G7cuDJ  →  1  (Salud y Bienestar)
--   51CZ8Pj8M16UCK449ZcB  →  2  (Café y Bebidas)
--   KLv9axMr8xcQSqEgUkzY  →  3  (Hogar)
--   dGc72xmFQ7lWyv6APwov  →  4  (Belleza y Cuidado Personal)
--   aYyaIlDrxX5FGxqPM33b  →  5  (Moda)
--   Pild05nMWeFn1nCIZgdm  →  6  (Tecnología)
--   MPNL32uQwU9h10xBScDi  →  7  (Librería)
--
-- PLANES DE MEMBRESÍA
--   6bfUUMW4Qf6LzHy95bjY  →  1  (Fundador)
--   BBFUpoD1ZnKDL4MWHBQl  →  2  (Mensualidad)
--   CoAi2o3xn2Kf0JihH1mO  →  3  (Trimestral)
--   kwzDDo9oHqrGtBRZhxl8  →  4  (Semestre)
--   v466eddOk5eKsGR18P2M  →  5  (Anualidad)
--
-- MEMBRESÍAS
--   CPtLAOtv5MWwGoBzayEP  →  1  (GI Store / Fundador)
--   BOWa1CQ9lIUOp4VJS7Nt  →  2  (Café Aroma / primer mes gratis)
--
-- PUBLICIDAD
--   Yw12TciU0mkewyOiLjyv  →  1  (Portafolio Web)
--   pQqBXx7XplNsvaKCo8y3  →  2  (Sin título / vacío)
--
-- FORO HILOS
--   tDqVQ1gacLjfOsWWYLRO  →  1  (¿Cómo funciona GI Store?)   autor: usuario_id=1 (admin)
--   pCfbgnV94og6sXeiN0X8  →  2  (¿Cómo generar publicidad?)  autor: usuario_id=2 (GI Store)
--
-- FORO RESPUESTAS
--   HVspkZ69Q39NxqWiZ3zL  →  1  autor: usuario_id=1 (admin)
--
-- API CLAVES
--   NBQKP8h7MuRPWvnmPca4  →  1  (OpenRouter)
-- ============================================================