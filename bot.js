/* ============================================================
   Qué contesta el bot de WhatsApp
   ------------------------------------------------------------
   Aquí NO hay red, ni Meta, ni claves: solo texto que entra y
   texto que sale. Por eso se puede probar entero sin conectar
   nada, y por eso vive aparte de `whatsapp.js`.

   TRES REGLAS QUE NO SE ROMPEN

   1. NO INVENTA PRECIOS. Nunca. Los precios los dicta el dueño
      (R12 del criterio). Si el cliente pide precio, el bot manda
      la liga del cotizador o pasa la conversación a una persona,
      pero jamás dice una cifra que no salió del motor de cobro.

   2. NO INVENTA DATOS. Todo lo que dice de las unidades sale de
      `unidades.js`, que el propio archivo declara FUENTE ÚNICA.
      Si algo no está ahí, el bot no lo sabe y lo dice.

   3. NO USA IA. Es puro texto contra palabras clave. Cuesta cero
      por mensaje y contesta igual de rápido de noche que de día.
      Cuando no entiende, no adivina: pasa con una persona.
      Adivinar mal el precio de un viaje cuesta más que no
      contestar.
   ============================================================ */

/* ------------------------------------------------------------
   Las unidades salen del catálogo del sitio, no de una copia.
   `unidades.js` es un archivo de navegador: hace
   `window.UNIDADES = [...]`. En el servidor no hay `window`, así
   que se le presta uno antes de pedirlo. Es la misma maña que ya
   usan las pruebas del proyecto.

   Se hace así, y no copiando la lista aquí, porque una copia se
   desactualiza en silencio: el dueño daría de alta una unidad y
   el bot seguiría ofreciendo la flota vieja.
   ------------------------------------------------------------ */
global.window = global.window || {};
require('./unidades');
const UNIDADES = global.window.UNIDADES || [];

const TELEFONO = '33 2400 2285';
const SITIO = process.env.SITIO_URL || 'https://eurotravel-web.vercel.app';

/* Quita acentos y baja a minúsculas, para que «cuántos» y «cuantos»
   sean la misma palabra. Sin esto, media conversación se pierde por
   un acento. */
function normaliza(t) {
  return String(t || '')
    .toLowerCase()
    .normalize('NFD')
    /* Los acentos van con escape, no con el caracter suelto: son
       invisibles en el editor y cualquier copiar-pegar los borra sin
       que se note. U+0300 a U+036F son las tildes que `NFD` separo. */
    .replace(/[̀-ͯ]/g, '')
    .trim();
}

/* ------------------------------------------------------------
   PALABRA COMPLETA, NO PEDAZO
   ------------------------------------------------------------
   Esto empezó buscando con `indexOf`, y estaba mal de tres formas
   que las pruebas cazaron de golpe:

     «somos 45 PERSONAS»        -> casaba con «persona» y en vez de
                                   recomendar unidad, pasaba con
                                   alguien sin contestar nada
     «CUÁNTOS caben»            -> casaba con «cuanto» y lo trataba
                                   como pregunta de precio
     «BUSCO un camión»          -> casaba con «bus»

   Con `\b` a los lados, «persona» ya no casa dentro de «personas»
   porque después viene una letra.

   Aquí `\b` SÍ es de fiar, y en otras partes de este proyecto no:
   `\b` no reconoce las acentuadas, pero `normaliza` ya les quitó
   el acento antes de llegar, así que a esta altura todo es ASCII.
   ------------------------------------------------------------ */
function tiene(t, palabras) {
  for (let i = 0; i < palabras.length; i++) {
    if (new RegExp('\\b' + palabras[i] + '\\b').test(t)) return true;
  }
  return false;
}

/* ------------------------------------------------------------
   FECHAS
   ------------------------------------------------------------
   El cliente escribe la fecha como se le da la gana, igual que en
   el papel: «10 de septiembre», «10/9», «mañana», «el 15».

   Todo viaja como texto `aaaa-mm-dd` y NUNCA se arma un `Date` a
   partir de pedazos: `new Date('2026-09-10')` es medianoche UTC,
   o sea las 18:00 del día ANTERIOR aquí. Ese defecto no se ve en
   la computadora de la oficina, solo en el servidor — y aquí
   correría en los dos lados.

   En formato ISO el orden alfabético ES el cronológico, así que
   comparar cadenas basta y no hay zona horaria que se cuele.
   ------------------------------------------------------------ */
const MESES = {
  enero: 1, ene: 1, febrero: 2, feb: 2, marzo: 3, mar: 3, abril: 4, abr: 4,
  mayo: 5, may: 5, junio: 6, jun: 6, julio: 7, jul: 7, agosto: 8, ago: 8,
  septiembre: 9, setiembre: 9, sep: 9, sept: 9, octubre: 10, oct: 10,
  noviembre: 11, nov: 11, diciembre: 12, dic: 12
};

function dosDigitos(n) { return (n < 10 ? '0' : '') + n; }

/* El día de hoy en `aaaa-mm-dd`, con la hora LOCAL. Se usan las
   partes locales del reloj, no `toISOString`, que convierte a UTC y
   después de las 6 de la tarde daría mañana. */
function hoyISO(reloj) {
  const d = reloj || new Date();
  return d.getFullYear() + '-' + dosDigitos(d.getMonth() + 1) + '-' + dosDigitos(d.getDate());
}

/* Suma días a una fecha ISO sin construir un Date con texto. */
function masDias(iso, n) {
  const p = iso.split('-');
  const d = new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2]));
  d.setDate(d.getDate() + n);
  return hoyISO(d);
}

function diasDelMes(anio, mes) {
  return new Date(anio, mes, 0).getDate();
}

/* Devuelve `aaaa-mm-dd` o null. `hoy` entra como parámetro —y no se
   pregunta al reloj aquí dentro— para que las pruebas puedan fijar
   el día y no cambien de resultado en año nuevo. */
function fechaDe(texto, hoy) {
  const t = normaliza(texto);
  const base = hoy || hoyISO();

  if (/\bhoy\b/.test(t)) return base;
  if (/\bmanana\b/.test(t)) return masDias(base, 1);
  if (/\bpasado manana\b/.test(t)) return masDias(base, 2);

  const anioHoy = Number(base.slice(0, 4));

  /* «10 de septiembre», «10 septiembre», «10 de sep del 2027» */
  let m = t.match(/(\d{1,2})\s*(?:de\s*)?([a-z]+)(?:\s*(?:de(?:l)?\s*)?(\d{4}))?/);
  if (m && MESES[m[2]]) {
    return armaFecha(Number(m[3]) || null, MESES[m[2]], Number(m[1]), base);
  }

  /* «10/9», «10-09-2026», «10.9.26» */
  m = t.match(/\b(\d{1,2})[\/\-.](\d{1,2})(?:[\/\-.](\d{2,4}))?\b/);
  if (m) {
    let a = m[3] ? Number(m[3]) : null;
    if (a !== null && a < 100) a += 2000;
    return armaFecha(a, Number(m[2]), Number(m[1]), base);
  }

  /* «el 15», a secas: el 15 más cercano que no haya pasado. */
  m = t.match(/^(?:el\s*)?(\d{1,2})$/);
  if (m) {
    const dia = Number(m[1]);
    const mesHoy = Number(base.slice(5, 7));
    const diaHoy = Number(base.slice(8, 10));
    let mes = mesHoy, anio = anioHoy;
    if (dia < diaHoy) { mes += 1; if (mes > 12) { mes = 1; anio += 1; } }
    return armaFecha(anio, mes, dia, base);
  }

  return null;
}

function armaFecha(anio, mes, dia, base) {
  if (!(mes >= 1 && mes <= 12)) return null;
  const anioHoy = Number(base.slice(0, 4));
  let a = anio || anioHoy;
  if (!(dia >= 1 && dia <= diasDelMes(a, mes))) return null;
  let iso = a + '-' + dosDigitos(mes) + '-' + dosDigitos(dia);
  /* Sin año escrito, una fecha ya pasada se entiende del año que viene:
     nadie cotiza un viaje para atrás. Con año escrito se respeta. */
  if (!anio && iso < base) {
    a += 1;
    if (dia > diasDelMes(a, mes)) return null;      // 29 de febrero
    iso = a + '-' + dosDigitos(mes) + '-' + dosDigitos(dia);
  }
  return iso;
}

/* Para enseñarla como la diría una persona. */
const NOMBRE_MES = ['', 'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
function fechaEnPalabras(iso) {
  return Number(iso.slice(8, 10)) + ' de ' + NOMBRE_MES[Number(iso.slice(5, 7))] +
    ' de ' + iso.slice(0, 4);
}

/* ------------------------------------------------------------
   «Somos 30» · «para 45 personas» · «45 pax»
   ------------------------------------------------------------
   Se busca un número que venga acompañado de algo que hable de
   gente. Un número suelto NO cuenta: «salimos el 15» es una
   fecha, no quince pasajeros, y recomendarle una Sprinter a un
   grupo de cincuenta por confundir eso es perder la venta.
   ------------------------------------------------------------ */
function cuantaGente(t) {
  /* Los botones que ofrece el propio bot. Si no se leyeran aquí, el bot
     se atoraría con su propia opción — que fue lo que pasó al probarlo. */
  if (/mas de (\d{1,3})/.test(t)) return Number(t.match(/mas de (\d{1,3})/)[1]) + 1;
  if (/entre \d{1,3} y (\d{1,3})/.test(t)) return Number(t.match(/entre \d{1,3} y (\d{1,3})/)[1]);
  if (/(\d{1,3}) o menos/.test(t)) return Number(t.match(/(\d{1,3}) o menos/)[1]);

  const pistas = /(\d{1,3})\s*(personas|pasajeros|pax|gente|alumnos|ninos|adultos|somos|alumnas)/;
  const alReves = /(somos|para|seriamos|van|vamos|iriamos|serian)\s*(?:como\s*)?(\d{1,3})/;
  let m = t.match(pistas);
  if (m) return parseInt(m[1], 10);
  m = t.match(alReves);
  if (m) return parseInt(m[2], 10);
  return null;
}

/* La unidad más chica en la que cabe el grupo. Se ordena por
   capacidad para no depender del orden del catálogo. */
function unidadPara(gente) {
  const caben = UNIDADES
    .filter(function (u) { return Number(u.max) >= gente; })
    .sort(function (a, b) { return Number(a.max) - Number(b.max); });
  return caben.length ? caben[0] : null;
}

function listaDeUnidades() {
  return UNIDADES.map(function (u) {
    return '• *' + u.name + '* — ' + u.cap;
  }).join('\n');
}

/* Lo que trae una unidad, con sus palabras del catálogo. */
function fichaDe(u) {
  const cosas = (u.spec || []).map(function (s) {
    return Array.isArray(s) ? s[1] : s;
  });
  return '*' + u.name + '* — ' + u.cap + '\n\n' +
    cosas.map(function (c) { return '✓ ' + c; }).join('\n');
}

const PASA = {
  texto: 'Con gusto te paso con una persona del equipo 🙌\n\n' +
    'Escríbele o márcale al *' + TELEFONO + '* y te atienden directo.\n\n' +
    'Si prefieres, déjame aquí a dónde vas y cuántos son, y alguien te ' +
    'contesta en cuanto pueda.',
  pasa: true
};

/* ------------------------------------------------------------
   LA RESPUESTA
   ------------------------------------------------------------
   Devuelve { texto, pasa }. `pasa` en true significa que esta
   conversación necesita una persona: quien llame decide si eso
   es avisarle al dueño, marcarla en un tablero, o nada.
   ------------------------------------------------------------ */
/* ------------------------------------------------------------
   LA COTIZACIÓN, PASO A PASO
   ------------------------------------------------------------
   Solo para la Sprinter: es la única unidad con
   `cotizadorAutomatico` en el catálogo. Para las demás el precio
   lo da una persona, y el bot no lo inventa.

   El estado NO vive aquí dentro. Entra y sale como parámetro,
   por dos razones:

     · en el servidor esto corre sin memoria entre mensajes; una
       variable de módulo se mezclaría entre clientes distintos
     · así se puede probar cada paso sin fingir una conversación

   Cuando ya juntó los cuatro datos NO cotiza: devuelve `cotiza`
   con lo que hay que preguntarle a `/api/cotizar`. Quien llama es
   el que tiene la red. El precio SIEMPRE sale del motor de cobro,
   nunca de aquí (R12).
   ------------------------------------------------------------ */
/* Las horas del recorrido mueven el precio, así que se preguntan. Se
   ofrecen TRES, que es el máximo de botones de WhatsApp, y con
   etiquetas de menos de 20 caracteres, que es su tope. */
/* Tres, porque tres son los botones de WhatsApp. La de en medio dice
   «20» a propósito: es el corte real —hasta ahí llega la Sprinter, que
   es la única que se cotiza sola—. */
const OPCIONES_GENTE = ['Somos 10 o menos', 'Entre 11 y 20', 'Somos más de 20'];

const HORAS_MOV = [
  { etiqueta: 'Hasta 8 horas', fin: '16:00' },
  { etiqueta: 'Hasta 10 horas', fin: '18:00' },
  { etiqueta: 'Todo el día', fin: '20:00' }
];

/* Días de servicio contando los dos extremos: salir el 10 y volver el
   12 son tres días. Se arma el Date con NÚMEROS, nunca con el texto:
   `new Date('2026-09-10')` es medianoche UTC, o sea el día anterior. */
function diasEntre(desde, hasta) {
  const arma = function (s) {
    return new Date(Number(s.slice(0, 4)), Number(s.slice(5, 7)) - 1, Number(s.slice(8, 10)));
  };
  return Math.round((arma(hasta) - arma(desde)) / 86400000) + 1;
}

function resumenDe(e) {
  const dias = diasEntre(e.salida, e.regreso);
  let t = '📍 ' + e.origen + ' → ' + e.destino + '\n' +
    '📅 ' + fechaEnPalabras(e.salida) + ' al ' + fechaEnPalabras(e.regreso) +
    '  (' + dias + (dias === 1 ? ' día' : ' días') + ')';
  if (e.recorridos > 0) {
    t += '\n🚐 ' + e.recorridos + (e.recorridos === 1 ? ' día' : ' días') +
      ' de recorrido, ' + HORAS_MOV[e.banda || 0].etiqueta.toLowerCase();
  } else if (e.recorridos === 0) {
    t += '\n🚐 Sin recorridos, solo ida y vuelta';
  }
  return t;
}

/* Arma lo que se le pregunta en cada casilla, con sus opciones. Las
   opciones son las que en WhatsApp serán botones o lista, y por eso
   se respetan sus topes: 3 botones de 20 caracteres, o 10 filas de
   24. Hay una prueba que lo vigila. */
function pregunta(estado) {
  const e = estado;
  switch (e.paso) {
    case 'destino':
      return { texto: '¿A dónde van? 📍\n\nEscríbeme la ciudad o el lugar.', opciones: [] };
    case 'origen':
      return {
        texto: '¿De dónde salen?',
        opciones: ['Guadalajara', 'Tlaquepaque', 'Otro lugar']
      };
    case 'origenLibre':
      return { texto: '¿De qué ciudad salen?', opciones: [] };
    case 'salida':
      return {
        texto: '¿Qué día salen? 📅\n\nEscríbelo como quieras: *10 de septiembre*, ' +
          '*10/9* o *mañana*.',
        opciones: []
      };
    case 'regreso':
      return { texto: '¿Y qué día regresan?', opciones: [] };
    case 'recorridos': {
      const dias = diasEntre(e.salida, e.regreso);
      /* Nunca más días de recorrido que días de viaje, y la lista de
         WhatsApp aguanta 10 filas contando la de «ninguno». */
      const tope = Math.min(dias, 9);
      const ops = ['Ninguno'];
      for (let i = 1; i <= tope; i++) ops.push(i + (i === 1 ? ' día' : ' días'));
      return {
        texto: 'Durante el viaje, ¿van a usar la unidad para pasear o hacer ' +
          'recorridos? 🚐\n\n¿Cuántos días?',
        opciones: ops
      };
    }
    case 'horas':
      return {
        texto: '¿Cuántas horas al día, más o menos?',
        opciones: HORAS_MOV.map(function (h) { return h.etiqueta; })
      };
    case 'confirmar':
      return {
        texto: 'Déjame confirmar 👇\n\n' + resumenDe(e) + '\n\n¿Todo bien?',
        opciones: ['Sí, cotizar', 'Cambiar algo']
      };
    case 'cambiar':
      return {
        texto: '¿Qué cambiamos?',
        opciones: ['El destino', 'De dónde salen', 'Las fechas', 'Los recorridos']
      };
  }
  return null;
}

/* Hace la pregunta de la casilla en la que quedó. */
function siguiente(e) {
  const p = pregunta(e);
  return { texto: p.texto, opciones: p.opciones, pasa: false, estado: e };
}

function pasoDeCotizacion(t, crudo, estado, hoy) {
  const e = Object.assign({}, estado);
  const dicho = String(crudo).trim();

  if (tiene(t, ['cancelar', 'olvidalo', 'ya no', 'mejor no'])) {
    return { texto: 'Listo, lo dejamos ahí 👍\n\n¿Te ayudo con algo más?',
      pasa: false, estado: null, opciones: [] };
  }

  /* ---- a dónde ---- */
  if (e.paso === 'destino') {
    if (dicho.length < 3) return siguiente(e);
    e.destino = dicho.slice(0, 120);
    e.paso = e.origen ? 'confirmar' : 'origen';
    return siguiente(e);
  }

  /* ---- de dónde ---- */
  if (e.paso === 'origen') {
    if (/otro/.test(t)) { e.paso = 'origenLibre'; return siguiente(e); }
    if (dicho.length < 3) return siguiente(e);
    e.origen = dicho.slice(0, 120);
    e.paso = e.salida ? 'confirmar' : 'salida';
    return siguiente(e);
  }
  if (e.paso === 'origenLibre') {
    if (dicho.length < 3) return siguiente(e);
    e.origen = dicho.slice(0, 120);
    e.paso = e.salida ? 'confirmar' : 'salida';
    return siguiente(e);
  }

  /* ---- cuándo ---- */
  if (e.paso === 'salida') {
    const f = fechaDe(crudo, hoy);
    if (!f) {
      return { texto: 'Esa fecha no la entendí 🙈\n\nEscríbela como *10 de septiembre* ' +
        'o *10/9*.', pasa: false, estado: e, opciones: [] };
    }
    e.salida = f;
    /* Si ya había regreso y quedó antes, se vuelve a preguntar. */
    if (e.regreso && e.regreso < f) e.regreso = null;
    e.paso = e.regreso ? 'confirmar' : 'regreso';
    return siguiente(e);
  }

  if (e.paso === 'regreso') {
    const f = fechaDe(crudo, hoy);
    if (!f) {
      return { texto: 'Esa fecha no la entendí. ¿Qué día regresan?',
        pasa: false, estado: e, opciones: [] };
    }
    if (f < e.salida) {
      return {
        texto: 'El regreso queda antes de la salida 🤔\n\nSalen el *' +
          fechaEnPalabras(e.salida) + '*. ¿Qué día vuelven?',
        pasa: false, estado: e, opciones: []
      };
    }
    e.regreso = f;
    /* R22: el viaje de un día no cobra movimientos, así que preguntarlos
       sería pedirle un dato al cliente para después ignorarlo. Se salta
       la casilla y se deja en cero. */
    if (diasEntre(e.salida, f) === 1) {
      e.recorridos = 0;
      e.paso = 'confirmar';
    } else {
      e.paso = typeof e.recorridos === 'number' ? 'confirmar' : 'recorridos';
    }
    return siguiente(e);
  }

  /* ---- recorridos ---- */
  if (e.paso === 'recorridos') {
    let n = null;
    if (/ningun|no\b|nada|solo ida|ninguna/.test(t)) n = 0;
    else {
      const m = t.match(/(\d{1,2})/);
      if (m) n = Number(m[1]);
    }
    if (n === null || n < 0) return siguiente(e);
    const tope = diasEntre(e.salida, e.regreso);
    if (n > tope) {
      return {
        texto: 'El viaje dura *' + tope + (tope === 1 ? ' día' : ' días') +
          '*, así que no pueden ser más recorridos que eso. ¿Cuántos días?',
        pasa: false, estado: e, opciones: pregunta(e).opciones
      };
    }
    e.recorridos = n;
    e.paso = n === 0 ? 'confirmar' : 'horas';
    return siguiente(e);
  }

  if (e.paso === 'horas') {
    let b = null;
    if (/todo|12|doce/.test(t)) b = 2;
    else if (/10|diez/.test(t)) b = 1;
    else if (/8|ocho/.test(t)) b = 0;
    if (b === null) return siguiente(e);
    e.banda = b;
    e.paso = 'confirmar';
    return siguiente(e);
  }

  /* ---- confirmar ---- */
  if (e.paso === 'confirmar') {
    if (/cambiar|no\b|corregi|modificar/.test(t)) {
      e.paso = 'cambiar';
      return siguiente(e);
    }
    /* Cualquier otra cosa se toma como que sí: es lo que quiso decir
       quien contesta «va», «sale», «dale» o «ok». */
    const movimientos = [];
    for (let i = 0; i < (e.recorridos || 0); i++) {
      movimientos.push({ horaInicio: '08:00', horaFin: HORAS_MOV[e.banda || 0].fin });
    }
    return {
      texto: 'Va, déjame sacar el precio…',
      pasa: false,
      estado: null,
      opciones: [],
      cotiza: {
        unidad: 'sprinter',
        origen: { direccion: e.origen },
        destino: { direccion: e.destino },
        salida: e.salida,
        regreso: e.regreso,
        redondo: true,
        movimientos: movimientos
      },
      /* Se guarda para poder repetirlo al dar el precio: el cliente
         tiene que ver QUÉ se cotizó, no solo cuánto. */
      resumen: {
        destino: e.destino, origen: e.origen, salida: e.salida, regreso: e.regreso,
        recorridos: e.recorridos || 0, horas: HORAS_MOV[e.banda || 0].etiqueta
      }
    };
  }

  /* ---- corregir una casilla sin volver a empezar ---- */
  if (e.paso === 'cambiar') {
    if (/destino|donde van|a donde/.test(t)) { e.paso = 'destino'; e.destino = null; }
    else if (/salen|origen|de donde/.test(t)) { e.paso = 'origen'; e.origen = null; }
    else if (/fecha|dia|cuando/.test(t)) { e.paso = 'salida'; e.salida = null; e.regreso = null; }
    else if (/recorrid|pasear|movim/.test(t)) { e.paso = 'recorridos'; e.recorridos = null; e.banda = null; }
    else return siguiente(e);
    return siguiente(e);
  }

  return null;
}

/* ------------------------------------------------------------
   Arma el mensaje con el precio que devolvió `/api/cotizar`.
   El número entra tal cual del motor de cobro: aquí NO se
   calcula ni se redondea nada.
   ------------------------------------------------------------ */
function textoDeCotizacion(precio, resumen) {
  if (!precio || typeof precio.total !== 'number') {
    return {
      texto: 'No pude sacar el precio de ese viaje 🙈\n\nMárcale al *' + TELEFONO +
        '* y te lo cotizan al momento.',
      pasa: true
    };
  }
  if (precio.requiereAsesor) {
    return {
      texto: 'Ese viaje lo tenemos que cotizar a la medida.\n\nMárcale al *' +
        TELEFONO + '* y te atienden.',
      pasa: true
    };
  }

  const pesos = function (n) { return '$' + Number(n).toLocaleString('es-MX'); };
  const r = resumen || {};

  return {
    texto: '🚐 *Sprinter · hasta 20 pasajeros*\n\n' +
      (r.origen ? '📍 ' + r.origen + ' → ' + r.destino + '\n' : '') +
      (r.salida ? '📅 ' + fechaEnPalabras(r.salida) + ' al ' + fechaEnPalabras(r.regreso) + '\n' : '') +
      '🗓️ ' + precio.dias + (precio.dias === 1 ? ' día' : ' días') + ' de servicio\n' +
      (r.recorridos ? '🚐 ' + r.recorridos + (r.recorridos === 1 ? ' día' : ' días') +
        ' de recorrido (' + String(r.horas).toLowerCase() + ')\n' : '') +
      '\n*Total: ' + pesos(precio.total) + '* (IVA incluido)\n' +
      'Para apartar: ' + pesos(precio.anticipo) + '\n' +
      'Resto al abordar: ' + pesos(precio.saldo) + '\n\n' +
      'Incluye operador, combustible, casetas y seguro de viajero.\n\n' +
      '¿Lo apartamos?',
    pasa: false,
    opciones: ['Apartar en línea', 'Hablar con alguien', 'Cotizar otro']
  };
}

function respuestaA(mensaje, estado, hoy) {
  const t = normaliza(mensaje);

  /* Si va a media cotización, ese paso manda: lo que escriba es la
     respuesta a lo que se le acaba de preguntar, no un tema nuevo.
     Sin esto, contestar «Chapala» se leería como saludo fallido. */
  if (estado && estado.paso) {
    const seguir = pasoDeCotizacion(t, mensaje, estado, hoy);
    if (seguir) return seguir;
  }

  if (!t) {
    return {
      texto: 'No alcancé a leer eso. ¿Me lo escribes de nuevo?',
      pasa: false
    };
  }

  /* Que pida una persona gana sobre todo lo demás. Si alguien
     escribe «quiero hablar con alguien, cuánto cuesta», lo que
     quiere es la persona, no el precio. */
  if (tiene(t, ['persona', 'humano', 'asesor', 'alguien', 'agente',
    'me atienda', 'hablar con', 'ejecutivo', 'operador'])) {
    return PASA;
  }

  /* ---- el precio: lo más delicado ---- */
  /* «cotiz» va con comodín porque cubre cotizar, cotización y cotizame.
     «vale» se quitó a propósito: en México «vale» es «de acuerdo», y
     «vale, gracias» acababa contestando una explicación de precios. */
  if (tiene(t, ['precio', 'precios', 'costo', 'costos', 'cuesta', 'cuanto',
    'tarifa', 'tarifas', 'cotiz\\w*', 'presupuesto', 'cobran', 'cobras'])) {
    const gente = cuantaGente(t);
    const u = gente ? unidadPara(gente) : null;

    /* Solo la unidad marcada con `cotizadorAutomatico` tiene precio en
       línea. Para las demás el precio se da personalmente, y el bot no
       tiene ningún negocio inventándolo. */
    /* La Sprinter SÍ se cotiza aquí mismo, porque es la única con
       `cotizadorAutomatico` en el catálogo. Se arranca el paso a paso. */
    if (u && u.cotizadorAutomatico) {
      const p = siguiente({ paso: 'destino' });
      return {
        texto: 'Para ' + gente + ' personas te va la *' + u.name + '* (' + u.cap + ').\n\n' +
          'Te saco el precio ahorita 👇\n\n' + p.texto,
        pasa: false, estado: p.estado, opciones: p.opciones
      };
    }
    if (u) {
      return {
        texto: 'Para ' + gente + ' personas te va la *' + u.name + '* (' + u.cap + ').\n\n' +
          'El precio de esa unidad lo damos personalmente, porque depende del ' +
          'destino, los días y los recorridos.\n\n' +
          'Márcale al *' + TELEFONO + '* y te lo cotizan al momento.',
        pasa: true
      };
    }
    /* Sin saber cuántos son no se puede escoger unidad, y sin unidad no
       se sabe si el precio se puede dar aquí o lo tiene que dar una
       persona. Así que primero eso.

       Va con opciones y no a teclear libre: se probó con Playwright y
       esta pregunta era la única del camino que dejaba al cliente
       solo frente a la caja de texto. */
    return {
      texto: 'Con gusto 🚌 ¿Cuántas personas viajan?\n\n' +
        'Si son *20 o menos* te saco el precio aquí mismo.',
      pasa: false,
      opciones: OPCIONES_GENTE
    };
  }

  /* ---- cuántos caben / qué unidad ---- */
  const gente = cuantaGente(t);
  if (gente) {
    const u = unidadPara(gente);
    if (!u) {
      const mayor = UNIDADES.reduce(function (a, b) {
        return Number(b.max) > Number(a.max) ? b : a;
      }, UNIDADES[0]);
      return {
        texto: 'Para ' + gente + ' personas se necesita más de una unidad — la ' +
          'más grande que tenemos es la *' + mayor.name + '* (' + mayor.cap + ').\n\n' +
          'Eso ya se arma a la medida. Márcale al *' + TELEFONO + '* y te lo cotizan.',
        pasa: true
      };
    }
    if (u.cotizadorAutomatico) {
      const p = siguiente({ paso: 'destino' });
      return {
        texto: 'Para ' + gente + ' personas te va la *' + u.name + '* (' + u.cap + ').\n\n' +
          'Te saco el precio ahorita 👇\n\n' + p.texto,
        pasa: false, estado: p.estado, opciones: p.opciones
      };
    }
    return {
      texto: 'Para ' + gente + ' personas te va la *' + u.name + '*.\n\n' + fichaDe(u) +
        '\n\n¿A dónde van y qué días? Con eso te cotizan.',
      pasa: true, opciones: []
    };
  }

  /* ------------------------------------------------------------
     UNA UNIDAD POR SU NOMBRE
     ------------------------------------------------------------
     Antes esto solo enseñaba la ficha y ahí se moría: el dueño
     escribió «quiero una Sprinter» y el bot le contestó qué
     incluye, sin ofrecerle cotizar. Quien nombra la unidad que
     quiere ya decidió; lo que sigue es el precio, no el folleto.
     ------------------------------------------------------------ */
  for (let i = 0; i < UNIDADES.length; i++) {
    const u = UNIDADES[i];
    if (t.indexOf(normaliza(u.name)) !== -1) {
      if (u.cotizadorAutomatico) {
        const p = siguiente({ paso: 'destino' });
        return {
          texto: '*' + u.name + '* — ' + u.cap + ' 🚐\n\nTe saco el precio ahorita.\n\n' +
            p.texto,
          pasa: false, estado: p.estado, opciones: p.opciones
        };
      }
      return {
        texto: fichaDe(u) + '\n\n¿A dónde van y qué días? Con eso te cotizan.',
        pasa: true, opciones: []
      };
    }
  }

  /* ---- «quiero cotizar», sin más ---- */
  if (tiene(t, ['cotizar', 'cotizame', 'cotizacion', 'quiero rentar', 'necesito rentar',
    'quiero un', 'necesito un', 'rentar'])) {
    return {
      texto: 'Va 🚐 ¿Cuántas personas viajan?\n\nSi son *20 o menos* te saco el precio ' +
        'aquí mismo.',
      pasa: false, opciones: []
    };
  }

  /* ---- la flota ---- */
  if (tiene(t, ['unidad', 'unidades', 'camion', 'autobus', 'autobuses', 'bus',
    'flota', 'vehiculo', 'transporte', 'capacidad', 'caben'])) {
    return {
      texto: 'Estas son nuestras unidades:\n\n' + listaDeUnidades() +
        '\n\n¿Cuántas personas viajan? Con eso te digo cuál te conviene.',
      pasa: false
    };
  }

  /* ---- qué incluye ---- */
  if (tiene(t, ['incluye', 'incluyen', 'servicio', 'baño', 'bano', 'aire',
    'seguro', 'gasolina', 'combustible', 'caseta', 'chofer', 'gps'])) {
    return {
      texto: 'Todos nuestros servicios incluyen:\n\n' +
        '✓ Operador profesional\n' +
        '✓ Seguro de viajero\n' +
        '✓ Monitoreo GPS 24/7\n' +
        '✓ Combustible y casetas\n\n' +
        'Cada unidad además trae lo suyo. ¿Cuál te interesa?\n\n' + listaDeUnidades(),
      pasa: false
    };
  }

  /* ---- saludo ---- */
  if (tiene(t, ['hola', 'buenas', 'buenos dias', 'buen dia', 'buenas tardes',
    'buenas noches', 'que tal', 'saludos', 'informacion', 'informes'])) {
    return {
      texto: '¡Hola! 👋 Bienvenido a *Eurotravel*, renta de autobuses en ' +
        'Tlaquepaque, Jalisco.\n\n' +
        'Puedo ayudarte con:\n\n' +
        '🚌 Nuestras unidades y cuántos caben\n' +
        '✅ Qué incluye el servicio\n' +
        '💬 Pasarte con una persona\n\n' +
        'Dime qué necesitas, o de una vez *a dónde vas y cuántos son*.',
      pasa: false
    };
  }

  /* ---- gracias / despedida ---- */
  if (tiene(t, ['gracias', 'muchas gracias', 'adios', 'hasta luego', 'bye'])) {
    return {
      texto: '¡Con gusto! Aquí andamos para lo que necesites 🚌',
      pasa: false
    };
  }

  /* ------------------------------------------------------------
     No entendió. Y aquí NO adivina.
     ------------------------------------------------------------ */
  return {
    texto: 'Esa no me la sé bien, y prefiero no contestarte mal 🙏\n\n' +
      'Te paso con una persona: márcale al *' + TELEFONO + '*.\n\n' +
      'O si quieres, dime *cuántos son y a dónde van* y te oriento.',
    pasa: true
  };
}

module.exports = {
  respuestaA, textoDeCotizacion,
  normaliza, cuantaGente, unidadPara, fechaDe, fechaEnPalabras, hoyISO,
  /* `pregunta` y `diasEntre` se exportan para poder vigilarlos desde las
     pruebas: que ninguna opción se pase de los topes de WhatsApp —3
     botones de 20 caracteres o 10 filas de 24— y que los días se cuenten
     con los dos extremos. */
  pregunta, diasEntre, HORAS_MOV,
  UNIDADES, TELEFONO, SITIO
};
