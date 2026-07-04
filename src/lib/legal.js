// Textos legales literales (fuente: documentos proporcionados por Mundo Mascotix).
// LEGAL_VERSION debe incrementarse si se modifica cualquier texto: cada firma
// guarda la versión y el hash SHA-256 del texto aceptado (requisito RGPD de
// poder demostrar qué texto exacto se aceptó).

export const LEGAL_VERSION = '2026-07-04.1';

export const URL_RESENA = 'https://g.page/r/CXhutFfZILZTEBM/review';

export const RESPONSABLE = {
  nombre: 'DANIELA CECILIA ANTEZANA CUEVAS (MUNDO MASCOTIX)',
  establecimiento: 'DermoSpa Veterinario · Mundo Mascotix',
  direccion: 'CALLE CONSTITUCIÓN 19, LOCAL DERECHA, ALCOBENDAS, 28100, MADRID',
  email: 'MUNDOMASCOTIX@GMAIL.COM',
  telefono: '693363510',
  localidad: 'Alcobendas',
};

export const CLAUSULAS_CONSENTIMIENTO = [
  {
    id: 'servicios',
    titulo: '1. Autorización de prestación de servicios',
    texto:
      'Autorizo expresamente a Mundo Mascotix a realizar los servicios de peluquería canina contratados en cada visita, incluyendo, pero no limitándose a: baño, corte, secado, deslanado, stripping, vaciado de glándulas anales, limpieza de oídos, corte de uñas y cualquier otro servicio adicional solicitado verbalmente o por escrito.',
    obligatoria: true,
  },
  {
    id: 'veracidad',
    titulo: '2. Veracidad de la información proporcionada',
    texto:
      'Declaro que el animal se encuentra en buen estado de salud físico y mental, y he comunicado previamente cualquier condición médica, comportamiento agresivo, fobia o alergia que pueda afectar al desarrollo del servicio. Me comprometo a actualizar esta información en futuras visitas si se producen cambios. Entiendo y acepto que existen factores de riesgo cardiovascular (edad, cardiopatías de base, sobrepeso, hipertensión, hipotiroidismo, coagulopatías, entre otros) que pueden derivar en un paro cardiorrespiratorio a causa del nerviosismo o de enfermedades previas del animal durante el servicio, y que Mundo Mascotix no se hace responsable de un desenlace fatal derivado de dichos factores, salvo negligencia grave o dolo.',
    obligatoria: true,
  },
  {
    id: 'exoneracion',
    titulo: '3. Exoneración de responsabilidad',
    texto:
      'Entiendo y acepto que, debido a la naturaleza de los servicios de peluquería canina, pueden producirse lesiones o daños menores accidentales (como cortes superficiales, irritaciones dérmicas, quemaduras por el uso de secadores o tijeras, estrés por manipulación, o caídas derivadas de movimientos bruscos del animal). Por la presente, exonero expresamente de toda responsabilidad civil, penal o administrativa tanto al personal trabajador como al titular o empresa gestora de Mundo Mascotix, incluyendo sus socios, empleados, colaboradores o cualquier persona vinculada laboral o contractualmente con la actividad, siempre que los hechos ocurridos no se deriven de negligencia grave o dolo.',
    obligatoria: true,
  },
  {
    id: 'emergencias',
    titulo: '4. Emergencias veterinarias',
    texto:
      'En caso de que durante el servicio el animal presente signos evidentes de malestar, agresividad extrema o urgencia médica, autorizo a Mundo Mascotix a contactar con un centro veterinario próximo y a actuar en el mejor interés del animal. Me comprometo a asumir íntegramente los costes derivados de la atención veterinaria que se derive de dicha actuación.',
    obligatoria: true,
  },
  {
    id: 'vigencia',
    titulo: '5. Duración y vigencia del presente documento',
    texto:
      'Este documento tendrá vigencia indefinida mientras no se revoque expresamente por escrito por parte del tutor. La firma de este documento autoriza los servicios de peluquería en visitas actuales y futuras. Cualquier modificación relevante (cambio de datos personales, estado de salud del animal, etc.) deberá ser comunicada por el tutor de forma voluntaria.',
    obligatoria: true,
  },
  {
    id: 'rgpd',
    titulo: '6. Protección de datos (RGPD / LOPDGDD)',
    texto:
      'Le informamos conforme a lo previsto en el RGPD y la LOPDGDD que DANIELA CECILIA ANTEZANA CUEVAS (MUNDO MASCOTIX) recaba y trata sus datos de carácter personal, aplicando las medidas técnicas y organizativas que garantizan su confidencialidad, con la finalidad de gestionar la contratación de los servicios desempeñados conforme a la relación que nos vincula. A estos efectos, usted da su consentimiento y autorización para dicho tratamiento. Conservaremos sus datos de carácter personal recogidos el tiempo imprescindible para gestionar la relación que nos vincula. Podrá ejercitar los derechos de acceso, rectificación, supresión, limitación, portabilidad y oposición dirigiéndose al Responsable con dirección CALLE CONSTITUCIÓN 19, LOCAL DERECHA, ALCOBENDAS, 28100, MADRID, enviando un correo a la dirección MUNDOMASCOTIX@GMAIL.COM.',
    obligatoria: true,
  },
];

// Condiciones preexistentes declaradas por el tutor, ligadas al momento de la firma.
export const CONDICIONES_PREEXISTENTES_OPCIONES = [
  'Cardiopatía',
  'Hipertensión',
  'Hipotiroidismo',
  'Sobrepeso',
  'Coagulopatías',
  'Alergias conocidas',
  'Ninguna conocida',
];

// Autorización de imágenes: checkbox independiente, puede quedarse sin marcar.
export const CLAUSULA_IMAGENES = {
  id: 'imagenes',
  titulo: 'Fotografías y redes sociales (opcional)',
  texto:
    'Autorizo expresamente a Mundo Mascotix a tomar fotografías y/o vídeos del animal durante la prestación del servicio y a publicarlas en sus redes sociales o material promocional, sin identificar al tutor ni comprometer la privacidad del cliente. Autorizo a ceder los derechos de imágenes (fotografías y vídeos) a favor de DANIELA CECILIA ANTEZANA CUEVAS (MUNDO MASCOTIX), a efectos de su uso en exposiciones, revistas, folletos, webs, blog, redes sociales o similares, desarrolladas con el fin de divulgación y promoción de las actividades de la empresa. Mundo Mascotix se compromete a no utilizar dicho material en ninguna actuación diferente de estas sin expresa autorización, y a que su utilización en ningún caso supondrá un daño a la honra e intimidad, respetando la normativa en materia de protección de datos e imagen.',
};

// Autorización de comunicaciones comerciales: checkbox independiente.
export const CLAUSULA_COMUNICACIONES = {
  id: 'comunicaciones',
  titulo: 'Comunicaciones comerciales (opcional)',
  texto:
    'Le informamos que conforme a lo previsto en el RGPD de 27 de abril de 2016 y la LO 3/2018 de 5 de diciembre que DANIELA CECILIA ANTEZANA CUEVAS (MUNDO MASCOTIX), recaba y trata sus datos de carácter personal, aplicando las medidas técnicas y organizativas que garantizan su confidencialidad, con la finalidad de gestionar la relación con los clientes pudiendo remitirle las comunicaciones necesarias por cualquier medio, incluido el correo electrónico, WhatsApp, SMS, etcétera. Usted da su consentimiento y autorización para dicho tratamiento. Conservaremos sus datos de carácter personal únicamente el tiempo imprescindible para gestionar nuestra relación. Podrá ejercitar gratuitamente los derechos de acceso, rectificación, supresión, limitación, portabilidad y oposición dirigiéndose a DANIELA CECILIA ANTEZANA CUEVAS (MUNDO MASCOTIX), con dirección en CALLE CONSTITUCIÓN 19, LOCAL DERECHA o mediante envío al email MUNDOMASCOTIX@GMAIL.COM con referencia RGPD/LOPDGDD.',
};

export const CLAUSULAS_INGRESO = [
  {
    id: 'reclamaciones',
    titulo: 'Reclamaciones',
    texto:
      'No se aceptan reclamaciones sobre el resultado del servicio transcurridas 24 horas desde la entrega de la mascota.',
  },
  {
    id: 'demora',
    titulo: 'Demora en la recogida',
    texto:
      'Una vez notificado el tutor de que la mascota está lista, dispone de 60 minutos para recogerla. Superado ese plazo, se aplicará un recargo de 15 € por hora o fracción de permanencia adicional en concepto de cuidado.',
  },
  {
    id: 'abandono',
    titulo: 'Abandono de la mascota',
    texto:
      'Si el tutor no recoge a la mascota antes del cierre del establecimiento el mismo día del servicio, esta se considerará abandonada. Mundo Mascotix podrá ponerla a disposición de las autoridades locales competentes (protectora o servicio municipal de recogida de animales), sin perjuicio de reclamar los gastos de custodia y cuidado generados.',
  },
  {
    id: 'rechazo',
    titulo: 'Derecho a rechazar o interrumpir el servicio',
    texto:
      'Mundo Mascotix se reserva el derecho a rechazar o interrumpir el servicio si la mascota presenta un estado de salud, agresividad o parásitos que pongan en riesgo al personal o a otros animales, sin derecho a reembolso íntegro si el servicio ya se ha iniciado parcialmente.',
  },
  {
    id: 'derivacion',
    titulo: 'Tratamientos adicionales',
    texto:
      'Cualquier tratamiento veterinario adicional detectado durante el servicio (p. ej. vaciado de glándulas con signos de infección) que requiera derivación se comunicará al tutor antes de aplicarlo, salvo urgencia.',
  },
  {
    id: 'precio',
    titulo: 'Variación del precio',
    texto:
      'El precio acordado puede variar si el estado real del pelaje (nudos, apelmazamiento) requiere tiempo o tratamiento adicional al presupuestado; se informará al tutor antes de aplicar el recargo cuando sea posible.',
  },
  {
    id: 'objetos',
    titulo: 'Objetos personales',
    texto:
      'Mundo Mascotix no se hace responsable de objetos personales (correas, arneses, juguetes) dejados con la mascota.',
  },
];

export const SERVICIOS = [
  'Baño',
  'Corte',
  'Secado',
  'Deslanado',
  'Stripping',
  'Vaciado de glándulas',
  'Limpieza de oídos',
  'Corte de uñas',
  'Otro',
];

export const COMPORTAMIENTO_OPCIONES = [
  'Tranquilo',
  'Nervioso',
  'Agresivo',
  'Juguetón',
  'Dócil',
  'Miedoso',
  'Cooperativo',
];

export const CUIDADOS_CHECKLIST = [
  'Hidratación de piel',
  'Evitar mojar la zona indicada unos días',
  'Revisar la zona marcada en el esquema',
  'Cepillado diario para evitar nudos',
  'Vigilar oídos tras la limpieza',
  'Consultar con veterinario la zona señalada',
];

export function textoLegalCompleto(clausulas) {
  return clausulas.map((c) => `${c.titulo}\n${c.texto}`).join('\n\n');
}

export async function hashTexto(texto) {
  const data = new TextEncoder().encode(texto);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}
