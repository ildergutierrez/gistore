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
  {
    id: 6,
    nombre: "Ginkgo Biloba",
    valor: 45000,
    beneficios: ["Mejorar el flujo sanguíneo cerebral y periférico", "Mejora la memoria y la concentración", "Actua como potente Antioxidante", "Reduce la fatiga mental y el estrés"],
    descripcion: "Es un suplemento natural enfocado en mejorar la circulación sanguínea, la función cognitiva (memoria, concentración) y reducir el estrés oxidativo. Se emplea para aliviar problemas circulatorios periféricos (piernas), síntomas de demencia leve y mejorar el equilibrio nervioso.",
    consumo: "Complemento alimenticio, no sustituye una dieta equilibrada. : 'Es importante no exceder la dosis diaria recomendada y consultar a un profesional de la salud antes de iniciar su consumo'.",
    imagen: "img/productos/2/6_32_ginkgo.jpeg",
    categoria: 1,
  },
  {
    id: 7,
    nombre: "ASHWAGANDHA KSM-66",
    valor: 60000,
    beneficios: ["Reduce el estrés y el cortisol", "Mejora del Sueño", "Rendimiento Físico y Mental", "Apoyo Hormonal"],
    descripcion: "Extracto de raíz de Withania somnifera de espectro completo, altamente concentrado (5% withanólidos), reconocido por su respaldo científico en la reducción de estrés, cortisol y mejora del sueño. Se considera una de las formas más puras y potentes, ideal para mejorar la memoria, la fuerza física y el equilibrio hormonal",
    consumo: "se toma comúnmente en dosis de 300 a 600 mg al día, preferiblemente dividida en dos tomas (mañana y noche) con alimentos. Es importante consultar a un profesional de la salud antes de comenzar su consumo, especialmente para personas con condiciones médicas preexistentes o que estén tomando otros medicamentos.",
    imagen: "img/productos/2/7_45_ksm-66.jpeg",
    categoria: 1,
  },
   {
    id: 8,
    nombre: " GLUCOSAMIN 1500 mg",
    valor: 54000,
    beneficios: ["Salud Articular", "Mejora la elasticidad de la piel", "Alivio del Dolor","Mejora la Hidratación"],
    descripcion: "Extracto de raíz de Withania somnifera de espectro completo, altamente concentrado (5% withanólidos), reconocido por su respaldo científico en la reducción de estrés, cortisol y mejora del sueño. Se considera una de las formas más puras y potentes, ideal para mejorar la memoria, la fuerza física y el equilibrio hormonal",
    consumo: "Se suele recomendar tomar dos cápsulas/comprimidos diarios con las comidas, o según las indicaciones de un profesional. Aviso: Este suplemento no es un medicamento y su eficacia puede variar según el individuo.",
    imagen: "img/productos/2/8_40_glucosamin.jpeg",
    categoria: 1,
  },
  {
    id: 9,
    nombre: "GAF-PLUS",
    valor: 41000,
    beneficios: ["Huesos fuertes", "Articulaciones flexible", "Energia vital"],
    descripcion: "Suplemento multivitamínico líquido de hierbas y vitaminas, diseñado para aumentar la energía y fortalecer el sistema inmunológico.",
    consumo: "Se recomienda tomar una copa (15 ml) dos veces al día. Debe conservarse refrigerado una vez abierto y consumirse en el menor tiempo posible. No es un medicamento, y se debe verificar su registro sanitario.",
    imagen: "img/productos/2/9_30_gaf-plus.jpeg",
    categoria: 1,
  },
  {
    id: 10,
    nombre: "Salud de la mujer",
    valor: 30000,
    beneficios: ["Desinflamante Femenino", "Alivia colicos menstruales", "Disminuye el flujo y las molestias"],
    descripcion: "Los jarabes para la 'Salud de la Mujer' son suplementos nutricionales formulados con hierbas (como hinojo, manzanilla, naranja) y extractos naturales, diseñados para regular el ciclo menstrual, aliviar cólicos, reducir inflamación uterina y equilibrar hormonas.",
    consumo: "se recomienda tomar vía oral, frecuentemente 3 veces al día. Generalmente se indica antes de las comidas para mejorar el ciclo menstrual, fertilidad y malestares, aunque siempre se debe verificar la etiqueta específica. Nota: Aunque los jarabes herbolarios son comunes, se recomienda consultar a un médico antes de iniciar su consumo, especialmente si hay condiciones preexistentes o embarazo.",
    imagen: "img/productos/2/10_23_salud_de_la_mujer.jpeg",
    categoria: 1,
  },
 {
    id: 11,
    nombre: "Vita Celebrina - Jarabe",
    valor: 40000,
    beneficios: ["Mejora la memoria", "Aumenta la concentración","Refuerza el rendimiento mental"],
    descripcion: "Suplemento dietario rico en vitaminas (A, B1, B2, B3, B6, C, E) y minerales, diseñado para apoyar la función cognitiva, mejorar la memoria, la concentración y el sistema inmunológico en niños y adultos",
    consumo: "A menudo se recomienda para niños mayores de 4 años, con dosis de 2 cucharaditas diarias. Nota: Este producto es un suplemento nutricional y no un medicamento.",
    imagen: "img/productos/2/11_28_vitacelebrina_jarabe.jpeg",
    categoria: 1,
  },
];

// Número de WhatsApp del vendedor (con código de país, sin +)
const WHATSAPP_NUMERO = "573145891108";


 /*
 {
    id: 0,
    nombre: "",
    valor: 30000,
    beneficios: ["", ""],
    descripcion: "",
    consumo: "",
    imagen: "",
    categoria: 1,
  },

  */