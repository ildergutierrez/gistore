// ============================================================
//  DICCIONARIO DE CATEGORÍAS
// ============================================================
const CATEGORIAS = {
  1: "Productos naturales",
  2: "Tecnologia",
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
    nombre: "Boldo + Clorofila y Menta",
    valor: 38000,
    beneficios: ["Desintoxicacion Natural", "Soporte Epatico", "Digestión saludable", "Purificación del cuerpo"],
    descripcion:
      "El Boldo + Clorofila y Menta es un suplemento natural que combina boldo, clorofila, menta, sábila y albahaca, ofreciendo una acción refrescante, depurativa y revitalizante. Este suplemento es ideal para quienes buscan un detox natural, apoyo digestivo y frescura interna y externa. Su fórmula está diseñada para apoyar la digestión, la desintoxicación y el bienestar general del organismo.",
    consumo: "Disolver una cucharada en un vaso de agua y consumir después de las comidas principales o según indicación profesional. Este suplemento es una opción natural para quienes desean mejorar su salud digestiva y general.",
    imagen: "img/productos/2/1_25_clorofila_menta.jpeg",
    categoria: 1,
  },
  {
    id: 2,
    nombre: "Citrato y Cloruro de Magnesio - potasio",
    valor: 50000,
    beneficios: ["Función Muscular y Nerviosa", "Regulación de la Presión Arterial", "Salud Ósea", "Alivio de Migrañas", "Apoyo Digestivo"],
    descripcion:
      "El Citrato y Cloruro de Magnesio 4 en 1 es un suplemento que combina varios beneficios para la salud:",
    consumo: "Dosis recomendada: Tomar 1 cápsula al día, preferiblemente con las comidas. - Consulta médica: Para dosificación personalizada, consulta con un especialista.",
    imagen: "img/productos/2/2_38_citrato.jpeg",
    categoria: 1,
  },
  {
    id: 3,
    nombre: "Vitamina E - 1.000 UI",
    valor: 52000,
    beneficios: ["Antioxidante Potente", "Salud de la Piel", "Protección Cardiovascular", "Mejora de la Salud Ocular", "Apoyo al Sistema Inmunológico"],
    descripcion: "La Vitamina E 1000 UI es un suplemento dietario que actúa como un potente antioxidante, ayudando a combatir los radicales libres en el cuerpo. Sus beneficios incluyen:",
    consumo: "Dosis Recomendada: La dosis de 1000 UI se puede tomar diariamente, pero es importante consultar a un médico antes de comenzar cualquier suplementación, especialmente para mujeres embarazadas o personas con condiciones de salud específicas. Forma de Consumo: La vitamina E es liposoluble, por lo que se recomienda tomarla con alimentos que contengan grasa para mejorar su absorción.",
    imagen: "img/productos/2/3_40_vitamina_E.jpeg",
    categoria: 1,
  },

  {
    id: 4,
    nombre: "Duo de bienestar Integral: Citrato de Magnesio + Vitamina E",
    valor: 55000,
    beneficios: ["Antioxidante Potente", "Relajación Muscular", "Salud Ósea", "Mejora de la Salud Ocular", "Reduce el Estrés Oxidativo", "Salud Ocular"],
    descripcion: "El Citrato de Magnesio y la Vitamina E se complementan para apoyar la salud muscular, nerviosa, cardiovascular y antioxidante, siendo seguros para consumo diario.",
    consumo: "Se recomienda tomar 2 gomitas al día para obtener los beneficios de ambos ingredientes, preferiblemente después de una comida. Este combo es ideal para quienes buscan un suplemento que apoye la salud desde adentro y facilite la adherencia a una rutina de bienestar.",
    imagen: "img/productos/2/4_40_magnecio+vitaminaE.jpeg",
    categoria: 1,
  },
  {
    id: 5,
    nombre: "Omega 3",
    valor: 55000,
    beneficios: ["Apoya la salud celebral y Cognitiva", "Reduce la inflamación corporal", "Mejora la salud Cardiovascular", "Mejor la hidratación y salud de la piel"],
    descripcion: "Los ácidos grasos omega-3 son esenciales para la salud y ofrecen una variedad de beneficios para la salud física y mental. Aquí hay una lista de los beneficios del omega-3:",
    consumo: "Dosis diaria recomendada: La Organización Mundial de la Salud (OMS) recomienda entre 250 y 2000 mg al día, dependiendo de la edad y la etapa de la vida.",
    imagen: "img/productos/2/5_40_omega3.jpeg",
    categoria: 1,
  },
];

// Número de WhatsApp del vendedor (con código de país, sin +)
const WHATSAPP_NUMERO = "573125028026";
