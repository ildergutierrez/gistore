// ============================================================
//  DICCIONARIO DE CATEGORÍAS
// ============================================================
const CATEGORIAS = {
  1: "Productos naturales",
  2: "Hogar & Deco",
  3: "Moda",
  4: "Belleza & Cuidado",
  5: "Deportes",
  6: "Juguetes",
};

// ============================================================
//  DICCIONARIO DE PRODUCTOS
//  Campos: nombre, valor, beneficios (array), descripcion,
//          imagen (URL placeholder), categoria (número)
// ============================================================
const PRODUCTOS = [
  {
    id: 1,
    nombre: "Auriculares Bluetooth Pro",
    valor: 189000,
    beneficios: ["Cancelación de ruido activa", "40h de batería", "Carga rápida USB-C"],
    descripcion:
      "Auriculares inalámbricos con tecnología de cancelación de ruido de última generación. Perfectos para trabajo, viajes y entretenimiento. Sonido premium con graves profundos y agudos cristalinos.",
    imagen: "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=600&q=80",
    categoria: 1,
  },
  {
    id: 2,
    nombre: "Smartwatch Serie X",
    valor: 345000,
    beneficios: ["Monitor cardíaco 24/7", "GPS integrado", "Resistente al agua IP68"],
    descripcion:
      "Reloj inteligente con pantalla AMOLED de alta resolución. Monitorea tu salud, actividad física y recibe notificaciones directamente en tu muñeca.",
    imagen: "https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=600&q=80",
    categoria: 1,
  },
  {
    id: 3,
    nombre: "Parlante Portátil 360°",
    valor: 129000,
    beneficios: ["Sonido 360 grados", "12h de batería", "Resistente al agua"],
    descripcion:
      "Parlante portátil con sonido envolvente y bajos potentes. Conéctalo vía Bluetooth 5.0 y disfruta tu música en cualquier lugar.",
    imagen: "https://images.unsplash.com/photo-1608043152269-423dbba4e7e1?w=600&q=80",
    categoria: 1,
  },
  {
    id: 4,
    nombre: "Lámpara Nórdica LED",
    valor: 95000,
    beneficios: ["Luz regulable 3 tonos", "Ahorro energético A++", "Diseño minimalista"],
    descripcion:
      "Lámpara de escritorio con brazo articulado y luz LED regulable. Ilumina tu espacio con estilo escandinavo y cuida tus ojos con tecnología antiparpadeo.",
    imagen: "https://images.unsplash.com/photo-1507473885765-e6ed057f782c?w=600&q=80",
    categoria: 2,
  },
  {
    id: 5,
    nombre: "Set Cojines Decorativos",
    valor: 72000,
    beneficios: ["Tela suave de alta calidad", "Lavables a máquina", "Set de 4 unidades"],
    descripcion:
      "Hermoso set de cojines decorativos en tonos tierra con texturas variadas. Transforma tu sala o dormitorio con un toque acogedor y moderno.",
    imagen: "https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=600&q=80",
    categoria: 2,
  },
  {
    id: 6,
    nombre: "Difusor de Aromas",
    valor: 58000,
    beneficios: ["Ultrasonido silencioso", "7 colores LED", "Apagado automático"],
    descripcion:
      "Difusor ultrasónico de aceites esenciales con luz ambiental de 7 colores. Crea un ambiente relajante y purifica el aire de tu hogar.",
    imagen: "https://images.unsplash.com/photo-1608181831688-8b8b97ea3b7a?w=600&q=80",
    categoria: 2,
  },
  {
    id: 10,
    nombre: "Serum Vitamina C",
    valor: 85000,
    beneficios: ["Antioxidante potente", "Ilumina la piel", "Fórmula vegana"],
    descripcion:
      "Sérum concentrado con 20% de vitamina C estabilizada. Reduce manchas, unifica el tono y aporta luminosidad visible desde la primera semana de uso.",
    imagen: "https://images.unsplash.com/photo-1620916566398-39f1143ab7be?w=600&q=80",
    categoria: 4,
  },
  {
    id: 11,
    nombre: "Set Maquillaje Premium",
    valor: 145000,
    beneficios: ["24 sombras pigmentadas", "Libre de crueldad animal", "Incluye pinceles"],
    descripcion:
      "Paleta de sombras con acabados mate, shimmer y metálico. Fórmula de larga duración que no transfiere. Ideal para looks de día y noche.",
    imagen: "https://images.unsplash.com/photo-1512496015851-a90fb38ba796?w=600&q=80",
    categoria: 4,
  },
  {
    id: 12,
    nombre: "Rodillo Jade Facial",
    valor: 45000,
    beneficios: ["Piedra jade natural", "Reduce inflamación", "Mejora circulación"],
    descripcion:
      "Rodillo facial de jade auténtico para masajes desinflamatorios. Ayuda a drenar el sistema linfático, reducir bolsas y potenciar la absorción de tus cremas.",
    imagen: "https://images.unsplash.com/photo-1616394584738-fc6e612e71b9?w=600&q=80",
    categoria: 4,
  },
  {
    id: 13,
    nombre: "Bicicleta Spinning Pro",
    valor: 890000,
    beneficios: ["Resistencia magnética", "Monitor de ritmo cardíaco", "Asiento ajustable"],
    descripcion:
      "Bicicleta estática de spinning con sistema de resistencia magnética silencioso. Pantalla LCD que muestra velocidad, distancia, calorías y pulso.",
    imagen: "https://images.unsplash.com/photo-1534258936925-c58bed479fcb?w=600&q=80",
    categoria: 5,
  },
  {
    id: 14,
    nombre: "Kit Yoga Completo",
    valor: 95000,
    beneficios: ["Mat antideslizante 6mm", "Incluye bloques y correa", "Bolsa de transporte"],
    descripcion:
      "Kit completo para tu práctica de yoga. Mat de alta densidad con superficie antideslizante, 2 bloques de foam y correa de extensión.",
    imagen: "https://images.unsplash.com/photo-1601925228527-79ad4d5d46b3?w=600&q=80",
    categoria: 5,
  },
  {
    id: 15,
    nombre: "Guantes de Boxeo",
    valor: 75000,
    beneficios: ["Cuero sintético premium", "Relleno de espuma doble", "Par 12 oz"],
    descripcion:
      "Guantes de entrenamiento para boxeo y artes marciales. Interior acolchado que protege tus manos y muñecas durante la práctica.",
    imagen: "https://images.unsplash.com/photo-1591563088691-9b1ca58f2ee7?w=600&q=80",
    categoria: 5,
  },
  {
    id: 16,
    nombre: "LEGO Arquitectura",
    valor: 195000,
    beneficios: ["680 piezas", "Para mayores de 12 años", "Diseño exclusivo"],
    descripcion:
      "Set de construcción arquitectónica inspirado en monumentos famosos. Desarrolla creatividad y paciencia mientras construyes réplicas en miniatura.",
    imagen: "https://images.unsplash.com/photo-1587654780291-39c9404d746b?w=600&q=80",
    categoria: 6,
  },
  {
    id: 17,
    nombre: "Control Remoto 4x4",
    valor: 125000,
    beneficios: ["Todo terreno", "Batería 45 min", "Velocidad 25 km/h"],
    descripcion:
      "Vehículo todo terreno a control remoto con tracción en las 4 ruedas. Escala obstáculos, barro y superficies irregulares con potente motor brushless.",
    imagen: "https://images.unsplash.com/photo-1596461404969-9ae70f2830c1?w=600&q=80",
    categoria: 6,
  },
  {
    id: 18,
    nombre: "Cámara Instantánea Mini",
    valor: 235000,
    beneficios: ["Impresión instantánea", "Flash automático", "Incluye 10 fotos"],
    descripcion:
      "Cámara de impresión instantánea con fotos tamaño cartera. Conecta vía Bluetooth para imprimir desde tu celular o toma fotos directamente.",
    imagen: "https://images.unsplash.com/photo-1526170375885-4d8ecf77b99f?w=600&q=80",
    categoria: 1,
  },
  {
    id: 19,
    nombre: "Tapete Persa Moderno",
    valor: 310000,
    beneficios: ["200x300cm", "Pelo corto fácil limpieza", "Antideslizante"],
    descripcion:
      "Tapete con diseño persa contemporáneo en tonos neutrales. Fabricado en fibra de polipropileno resistente a manchas y de fácil mantenimiento.",
    imagen: "https://images.unsplash.com/photo-1586023492125-27b2c045efd7?w=600&q=80",
    categoria: 2,
  },
  
  {
    id: 21,
    nombre: "Tablet Educativa Kids",
    valor: 285000,
    beneficios: ["Carcasa resistente", "Control parental", "200 juegos educativos"],
    descripcion:
      "Tablet diseñada especialmente para niños con contenido educativo supervisado. Pantalla resistente a caídas y batería de larga duración.",
    imagen: "https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?w=600&q=80",
    categoria: 6,
  },
  {
    id: 22,
    nombre: "Proteína Whey Premium",
    valor: 115000,
    beneficios: ["25g proteína por porción", "Sin azúcar añadida", "30 porciones"],
    descripcion:
      "Proteína de suero de leche de alta calidad para recuperación muscular. Sin sabores artificiales, endulzada con stevia. Sabor chocolate intenso.",
    imagen: "https://images.unsplash.com/photo-1517836357463-d25dfeac3438?w=600&q=80",
    categoria: 5,
  },
  {
    id: 23,
    nombre: "Crema Hidratante Cuerpo",
    valor: 52000,
    beneficios: ["Con manteca de karité", "Absorción rápida", "500ml"],
    descripcion:
      "Crema corporal ultra hidratante con manteca de karité y aceite de argán. Nutre intensamente la piel seca, dejándola suave y radiante todo el día.",
    imagen: "https://images.unsplash.com/photo-1556229010-6c3f2c9ca5f8?w=600&q=80",
    categoria: 4,
  },
  {
    id: 24,
    nombre: "Silla Ergonómica Home",
    valor: 520000,
    beneficios: ["Soporte lumbar ajustable", "Reposabrazos 4D", "Altura regulable"],
    descripcion:
      "Silla de oficina ergonómica diseñada para largas jornadas de trabajo. Soporte lumbar con curvatura ajustable y malla transpirable para mayor confort.",
    imagen: "https://images.unsplash.com/photo-1592078615290-033ee584e267?w=600&q=80",
    categoria: 2,
  },
];

// Número de WhatsApp del vendedor (con código de país, sin +)
const WHATSAPP_NUMERO = "573125028026";
