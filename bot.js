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

/* ============================================================
   ESCRIBIR MAL NO PUEDE COSTAR UNA VENTA
   ------------------------------------------------------------
   La gente escribe desde el celular, con prisa y con el pulgar:
   «kiero uan spter», «cuanto kuesta», «vallarrta». Un bot que
   solo entiende lo bien escrito pierde clientes de verdad.

   Esto NO usa IA. Son tres pasos baratos, en orden de qué tan
   seguido aciertan:

   1. FONÉTICA. La mayoría de las faltas del español no cambian
      cómo suena la palabra: b/v, s/z/c, y/ll, la h muda, qu/k,
      g/j. Si dos palabras suenan igual, son la misma. Esto solo
      caza «kiero», «boy», «aser», «sierto», «llendo».

   2. ABREVIATURA. Escribir «spter» por «sprinter» no es una
      falta, es teclear rápido: se comieron letras pero las que
      quedaron van en orden. Si lo tecleado es subcadena en orden
      de la palabra buena, es esa.

   3. DISTANCIA. Para lo demás —una letra de más, una de menos,
      dos cambiadas de lugar— se cuenta cuántos cambios hacen
      falta. El tope sube con el largo de la palabra: en una de
      cuatro letras un cambio ya es otra palabra, en una de diez
      no.

   Las palabras cortas se comparan EXACTAS. «no» y «lo» están a
   un cambio, y confundirlas cambiaría el sentido de la frase.
   ============================================================ */

/* Cómo suena la palabra, a lo bruto. No es un algoritmo formal
   —no hace falta— sino las confusiones que de verdad se ven. */
function fonetica(p) {
  return String(p)
    .replace(/h/g, '')                       // la h no suena: ola = hola
    .replace(/qu|ck|k/g, 'k')                // kiero = quiero
    .replace(/c([eiéí])/g, 's$1')            // sierto = cierto
    .replace(/c/g, 'k')                      // kasa = casa
    .replace(/z/g, 's')                      // ves = vez
    .replace(/v/g, 'b')                      // boy = voy
    .replace(/ll/g, 'y')                     // lla = ya
    .replace(/g([eiéí])/g, 'j$1')            // jente = gente
    .replace(/x/g, 's')
    .replace(/(.)\1+/g, '$1');               // vallarrta = vallarta
}

/* ¿Lo tecleado son las letras de la palabra buena, en orden y sin
   inventar ninguna? Así se cazan las abreviaturas del pulgar. */
function esAbreviatura(corta, larga) {
  if (corta.length < 4 || corta.length >= larga.length) return false;
  if (corta.length / larga.length < 0.5) return false;
  if (corta[0] !== larga[0]) return false;   // la primera letra sí se respeta
  let j = 0;
  for (let i = 0; i < larga.length && j < corta.length; i++) {
    if (larga[i] === corta[j]) j++;
  }
  return j === corta.length;
}

/* Cuántos cambios hay de una palabra a la otra. Cuenta el cambio de
   lugar de dos letras contiguas como UNO —«uan» por «una»— porque es
   de las faltas más comunes al teclear rápido. */
function distancia(a, b) {
  const m = a.length, n = b.length;
  if (Math.abs(m - n) > 3) return 99;        // ni vale la pena medir
  const d = [];
  for (let i = 0; i <= m; i++) d[i] = [i];
  for (let j = 0; j <= n; j++) d[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const costo = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + costo);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
      }
    }
  }
  return d[m][n];
}

function tope(largo) {
  if (largo <= 4) return 0;                  // corta: exacta o nada
  if (largo <= 7) return 1;
  return 2;
}

/* ------------------------------------------------------------
   LAS QUE SE COMPARAN EXACTAS, PASE LO QUE PASE
   ------------------------------------------------------------
   Hay palabras cuyo vecino a un cambio de distancia significa otra
   cosa. Tolerarles la falta no ayuda: se equivoca.

   El caso que lo destapó: «somos 15 personaz» acababa en «te paso
   con una persona» —porque «personaz» está a un cambio de
   «persona»— en vez de recomendar unidad. Es la MISMA confusión
   que ya se había arreglado con los límites de palabra, y la
   tolerancia a faltas la revivió.

   Quien quiere una persona lo dice de otro modo: «hablar con»,
   «con alguien», «asesor». Esas siguen tolerando faltas.
   ------------------------------------------------------------ */
const EXACTAS = ['persona', 'no', 'si', 'dia', 'dias'];

/* ¿Lo que escribió es esta palabra, aunque la haya escrito mal? */
function esLaPalabra(dicho, buena) {
  if (dicho === buena) return true;
  if (EXACTAS.indexOf(buena) !== -1) return false;
  const fd = fonetica(dicho), fb = fonetica(buena);
  if (fd === fb) return true;                // suena igual
  if (esAbreviatura(dicho, buena) || esAbreviatura(fd, fb)) return true;
  const t = tope(buena.length);
  if (t === 0) return false;
  return distancia(fd, fb) <= t;
}

/* Parte la frase en palabras, para poder comparar una por una. */
function palabrasDe(t) {
  return String(t).split(/[^a-z0-9ñ]+/).filter(function (p) { return p.length > 0; });
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
  /* Primero exacto: es lo que acierta casi siempre y no cuesta nada. */
  for (let i = 0; i < palabras.length; i++) {
    if (new RegExp('\\b' + palabras[i] + '\\b').test(t)) return true;
  }
  /* Y si no, mal escrito. Solo se compara contra palabras sueltas y
     literales: las que traen espacio son frases —«hablar con»— y las
     que traen `\w*` son comodines; a esas no se les puede medir la
     distancia sin inventar coincidencias. */
  const sueltas = palabras.filter(function (p) { return /^[a-zñ]+$/.test(p); });
  if (!sueltas.length) return false;
  const dichas = palabrasDe(t);
  for (let i = 0; i < dichas.length; i++) {
    for (let j = 0; j < sueltas.length; j++) {
      if (esLaPalabra(dichas[i], sueltas[j])) return true;
    }
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

  /* «10 de septiembre», «10 septiembre», «10 de sep del 2027», y
     también «4 sep», «10 setiembre», «10 de septienbre». */
  let m = t.match(/(\d{1,2})\s*(?:de\s*)?([a-z]+)(?:\s*(?:de(?:l)?\s*)?(\d{4}))?/);
  if (m) {
    let mes = MESES[m[2]];
    if (!mes) {
      /* Mal escrito. Se compara contra los nombres largos nada más:
         medirle la distancia a «ene» o «may» confundiría meses entre
         sí, y equivocar el mes de un viaje no es un detalle. */
      const nombres = Object.keys(MESES).filter(function (k) { return k.length > 4; });
      for (let i = 0; i < nombres.length && !mes; i++) {
        if (esLaPalabra(m[2], nombres[i])) mes = MESES[nombres[i]];
      }
    }
    if (mes) return armaFecha(Number(m[3]) || null, mes, Number(m[1]), base);
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
     se atoraría con su propia opción — que fue lo que pasó al probarlo.

     «Más de 20» NO se lee aquí a propósito: no es un número, es la
     ausencia de uno. Antes se traducía a 21 y el bot contestaba «andan
     por poquito arriba», que a un grupo de 60 le suena absurdo y a
     nadie le sirve. Se detecta aparte, en `masDeQue`, para PREGUNTAR
     cuántos son. */
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
/* «somos más de 20», «como unos 40 o más», «bastantes». Dice que son
   MUCHOS, no cuántos. Devuelve el piso que mencionó, o 0 si ni eso. */
function masDeQue(t) {
  const m = t.match(/mas de (\d{1,3})|arriba de (\d{1,3})|(\d{1,3}) o mas/);
  if (m) return Number(m[1] || m[2] || m[3]);
  if (/\b(muchos|bastantes|un chingo|somos varios|harta gente)\b/.test(t)) return 0;
  return null;
}

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

function porId(id) {
  for (let i = 0; i < UNIDADES.length; i++) if (UNIDADES[i].id === id) return UNIDADES[i];
  return null;
}
const SPRINTER = porId('sprinter');
const SUBURBAN = porId('suburban');
const MAYOR = UNIDADES.reduce(function (a, b) {
  return Number(b.max) > Number(a.max) ? b : a;
}, UNIDADES[0]);

/* Hasta cuántos se le pregunta si pueden acomodarse en la Sprinter en
   vez de mandarlos derecho a un autobús. Arriba de esto ya no tiene
   caso: nadie deja a seis personas fuera. */
const CASI_SPRINTER = 24;

/* ------------------------------------------------------------
   QUÉ UNIDAD OFRECERLE
   ------------------------------------------------------------
   Esto lo pidió el dueño después de probarlo: con 21 personas el bot
   le saltaba directo a un autobús, sin preguntarle nada. Un grupo de
   21 casi siempre puede ser 20, y esa diferencia es la que decide si
   el precio sale al momento o hay que esperar a una persona.

   Y con grupos chicos hay DOS opciones y no una: la Suburban es
   servicio ejecutivo —interiores en piel, puerta a puerta— y cuesta
   distinto. Ofrecer solo la Sprinter era esconderle media flota.
   ------------------------------------------------------------ */
function recomienda(gente) {
  /* Grupo chico: caben en las dos, y son unidades muy distintas. */
  if (gente <= Number(SUBURBAN.max)) {
    return {
      texto: 'Para ' + gente + (gente === 1 ? ' persona' : ' personas') +
        ' tienes dos opciones 👇\n\n' +
        '🚐 *' + SPRINTER.name + '* — ' + SPRINTER.cap + '\n' +
        'La de siempre. Te la cotizo aquí mismo, al momento.\n\n' +
        '🚙 *' + SUBURBAN.name + '* — ' + SUBURBAN.cap + '\n' +
        'Servicio ejecutivo: interiores en piel, puerta a puerta. Es más ' +
        'premium y su precio lo da una persona.\n\n' +
        '¿Cuál te late?',
      opciones: ['La Sprinter', 'La Suburban'],
      estado: { paso: 'elegirChica', gente: gente }
    };
  }

  /* Le cabe a la Sprinter: derecho a cotizar. */
  if (gente <= Number(SPRINTER.max)) {
    const p = siguiente({ paso: 'destino', unidad: 'sprinter', gente: gente });
    return {
      texto: 'Para ' + gente + ' personas te va la *' + SPRINTER.name + '* (' +
        SPRINTER.cap + ').\n\nTe saco el precio ahorita 👇\n\n' + p.texto,
      opciones: p.opciones,
      estado: p.estado
    };
  }

  /* Por poquito arriba. Vale la pena preguntar antes de mandarlo con
     una persona: si pueden ser 20, tiene precio en un minuto. */
  if (gente <= CASI_SPRINTER) {
    return {
      texto: 'Andan por poquito arriba 🤏\n\nLa *' + SPRINTER.name + '* lleva ' +
        SPRINTER.max + ', y ustedes son ' + gente + '.\n\n' +
        'Si logran acomodarse en ' + SPRINTER.max + ', te saco el precio ahorita ' +
        'mismo. Si no, les paso un autobús y lo cotiza una persona.',
      opciones: ['Sí, somos ' + SPRINTER.max, 'Somos ' + gente],
      estado: { paso: 'ajustar', gente: gente }
    };
  }

  /* Ya es autobús. No se cotiza aquí, pero SÍ se le juntan todos los
     datos para que quien conteste solo ponga el precio. */
  const cabeEnUna = gente <= Number(MAYOR.max);
  const p = siguiente({ paso: 'destino', unidad: 'autobus', gente: gente });
  return {
    texto: (cabeEnUna
      ? 'Para ' + gente + ' personas les va un *autobús* (hasta ' + MAYOR.max + ' pasajeros).'
      : 'Para ' + gente + ' personas se ocupa más de una unidad — la más grande que ' +
        'tenemos lleva ' + MAYOR.max + '.') +
      '\n\nEse precio lo da una persona del equipo. Déjame juntar los datos para que ' +
      'te lo pasen rápido y no tengas que repetir nada 👇\n\n' + p.texto,
    opciones: p.opciones,
    estado: p.estado
  };
}

const HORAS_MOV = [
  { etiqueta: 'Hasta 8 horas', fin: '16:00' },
  { etiqueta: 'Hasta 10 horas', fin: '18:00' },
  { etiqueta: 'Todo el día', fin: '20:00' }
];

/* ------------------------------------------------------------
   LOS PASEOS CON NOMBRE, PARA PODER OFRECERLOS
   ------------------------------------------------------------
   Dictado el 1-sep-2026: «los 3 destinos de CDMX ofrécelos: si el
   cliente puso CDMX de destino y quiere movimientos, despliega esas
   3 opciones […] tanto en la app como en el chatbot».

   Esta tabla es un ESPEJO de la que cobra, que vive en
   `api/_tarifa.js`. Se duplica porque el navegador no puede leer
   `api/`, y un espejo se despega solo: si allá se agrega un paseo y
   aquí no, el bot deja de ofrecerlo y nadie se entera.

   Por eso `probar-whatsapp.cjs` compara las dos listas y se pone en
   rojo si dejan de coincidir. Los PRECIOS no se copian —esos solo
   viven allá, con el motor de cobro— aquí solo están los nombres.
   ------------------------------------------------------------ */
const PASEOS_POR_DESTINO = [
  { busca: /ciudad de m[eé]xico|cdmx|distrito federal/i,
    opciones: ['Taxco', 'Chalma', 'Xochimilco'] },
  { busca: /huasteca/i,
    opciones: ['El Meco', 'El Naranjo'] }
];

function paseosDe(destino) {
  const t = String(destino || '');
  for (let i = 0; i < PASEOS_POR_DESTINO.length; i++) {
    if (PASEOS_POR_DESTINO[i].busca.test(t)) return PASEOS_POR_DESTINO[i].opciones;
  }
  return null;
}

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
    if (e.lejos) t += ', lejos';
    /* El paseo se enseña aparte y con estrella: es lo que más mueve el
       precio de todo lo que se preguntó. Si el cliente lo escogió por
       error, aquí lo ve antes de que se le cobre. */
    if (e.paseo) t += '\n⭐ Con *' + e.paseo + '*';
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
    case 'cuantos':
      /* Sin opciones a propósito: cualquier rango que ofreciera sería
         otra vez «más de 20». Lo que hace falta es el número. */
      return {
        texto: e.piso
          ? '¿Como cuántos van? 🤔\n\nCon el número te digo qué unidad les ' +
            'conviene — no es lo mismo un grupo de ' + (e.piso + 5) + ' que de ' +
            (e.piso * 2) + '.'
          : '¿Como cuántos van?\n\nUn número aproximado me basta.',
        opciones: []
      };
    case 'elegirChica':
      return {
        texto: '¿La Sprinter o la Suburban?',
        opciones: ['La Sprinter', 'La Suburban']
      };
    case 'ajustar':
      return {
        texto: '¿Se acomodan en ' + SPRINTER.max + '?',
        opciones: ['Sí, somos ' + SPRINTER.max, 'Somos ' + (e.gente || 21)]
      };
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
    case 'paseo': {
      const ops = paseosDe(e.destino) || [];
      return {
        texto: 'En *' + e.destino + '* tenemos estos paseos 👇\n\n' +
          ops.map(function (o) { return '• ' + o; }).join('\n') +
          '\n\n¿Van a alguno? Si no, dime *ninguno* y contamos recorridos normales.',
        /* «Ninguno» va al final y no al principio: primero se enseña lo que
           sí se ofrece. Con los tres de CDMX son cuatro filas, y WhatsApp
           aguanta diez. */
        opciones: ops.concat(['Ninguno'])
      };
    }
    case 'lejos':
      return {
        texto: 'Esos recorridos, ¿son por la zona o se van lejos?\n\n' +
          'Lejos es *más de 80 km* — como irse a otra ciudad y volver.',
        opciones: ['Por la zona', 'Nos vamos lejos']
      };
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

/* ------------------------------------------------------------
   Hace la pregunta de la casilla en la que quedó, y antes acusa
   recibo de lo que acaba de contestar.

   Ese acuse no es adorno: en una conversación de verdad uno
   repite lo que oyó antes de seguir —«Chapala, va»— y así el
   otro se entera de inmediato si entendiste mal, en vez de
   descubrirlo hasta el final. Sin él, el bot se siente un
   formulario que no escucha.
   ------------------------------------------------------------ */
function siguiente(e, acuse) {
  const p = pregunta(e);
  return {
    texto: (acuse ? acuse + '\n\n' : '') + p.texto,
    opciones: p.opciones, pasa: false, estado: e
  };
}

function pasoDeCotizacion(t, crudo, estado, hoy) {
  const e = Object.assign({}, estado);
  const dicho = String(crudo).trim();

  if (tiene(t, ['cancelar', 'olvidalo', 'ya no', 'mejor no'])) {
    return { texto: 'Listo, lo dejamos ahí 👍\n\n¿Te ayudo con algo más?',
      pasa: false, estado: null, opciones: [] };
  }

  /* ---- ¿cuántos son, de verdad? ---- */
  if (e.paso === 'cuantos') {
    const n = cuantaGente(t) || (t.match(/^\s*(\d{1,3})\s*$/) ? Number(RegExp.$1) : null);
    if (!n) {
      /* Se vuelve a preguntar DISTINTO. Repetir la misma frase palabra
         por palabra es lo que más delata a un robot, y además no ayuda:
         si no se entendió la primera vez, decirlo igual no arregla nada. */
      return {
        texto: 'Perdón, no me quedó claro 🙈\n\nNada más el número: ¿son como *30*? ' +
          '¿*45*? Lo que sea, aunque no sea exacto.',
        pasa: false, estado: e, opciones: []
      };
    }
    const r = recomienda(n);
    return { texto: r.texto, pasa: false, estado: r.estado, opciones: r.opciones };
  }

  /* ---- ¿Sprinter o Suburban? ---- */
  if (e.paso === 'elegirChica') {
    if (/suburban/.test(t)) {
      e.unidad = 'suburban';
    } else if (/sprinter/.test(t)) {
      e.unidad = 'sprinter';
    } else {
      return siguiente(e);
    }
    e.paso = 'destino';
    const p = siguiente(e);
    return {
      texto: 'Va, la *' + (e.unidad === 'suburban' ? SUBURBAN.name : SPRINTER.name) + '*.\n\n' +
        (e.unidad === 'suburban'
          ? 'Su precio lo da una persona, así que déjame juntar los datos para que te ' +
            'lo pasen rápido 👇\n\n'
          : '') + p.texto,
      pasa: false, estado: p.estado, opciones: p.opciones
    };
  }

  /* ---- ¿se acomodan en 20? ---- */
  if (e.paso === 'ajustar') {
    /* «Sí, somos 20» contra «Somos 23». Se mira el número que dijo, no
       el sí o el no: los dos botones empiezan distinto pero lo que
       decide es cuántos son. */
    const n = cuantaGente(t);
    const cabe = /^si/.test(t) || (n !== null && n <= Number(SPRINTER.max));
    e.unidad = cabe ? 'sprinter' : 'autobus';
    if (n !== null) e.gente = cabe ? Number(SPRINTER.max) : n;
    e.paso = 'destino';
    const p = siguiente(e);
    return {
      texto: (cabe
        ? '¡Perfecto! Con ' + SPRINTER.max + ' les va la *' + SPRINTER.name +
          '* y te saco el precio ahorita 👇'
        : 'Sin problema, les va un *autobús*. Déjame juntar los datos para que una ' +
          'persona te pase el precio rápido 👇') + '\n\n' + p.texto,
      pasa: false, estado: p.estado, opciones: p.opciones
    };
  }

  /* ---- a dónde ---- */
  if (e.paso === 'destino') {
    if (dicho.length < 3) {
      return {
        texto: 'No alcancé a leer el lugar 🙈 ¿A qué ciudad van?',
        pasa: false, estado: e, opciones: []
      };
    }
    e.destino = dicho.slice(0, 120);
    e.paso = e.origen ? 'confirmar' : 'origen';
    return siguiente(e, '*' + e.destino + '*, va 📍');
  }

  /* ---- de dónde ---- */
  if (e.paso === 'origen' || e.paso === 'origenLibre') {
    if (e.paso === 'origen' && /otro/.test(t)) {
      e.paso = 'origenLibre';
      return siguiente(e);
    }
    if (dicho.length < 3) {
      return {
        texto: '¿De qué ciudad salen?', pasa: false, estado: e,
        opciones: e.paso === 'origen' ? pregunta(e).opciones : []
      };
    }
    e.origen = dicho.slice(0, 120);
    e.paso = e.salida ? 'confirmar' : 'salida';
    return siguiente(e, 'Salen de *' + e.origen + '* 👍');
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
    return siguiente(e, 'Salen el *' + fechaEnPalabras(f) + '* 📅');
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
    const dias = diasEntre(e.salida, f);
    /* R22: el viaje de un día no cobra movimientos, así que preguntarlos
       sería pedirle un dato al cliente para después ignorarlo. Se salta
       la casilla y se deja en cero. */
    if (dias === 1) {
      e.recorridos = 0;
      e.paso = 'confirmar';
      return siguiente(e, 'Van y vuelven el mismo día, perfecto 👍');
    }
    e.paso = typeof e.recorridos === 'number' ? 'confirmar' : 'recorridos';
    return siguiente(e, 'Entonces son *' + dias + ' días* de viaje.');
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
    if (n === 0) {
      e.paso = 'confirmar';
      return siguiente(e, 'Va, solo el traslado 👍');
    }
    /* Si el destino tiene paseos con nombre, se ofrecen ANTES de las horas:
       un paseo trae su propio precio y su propia duración, así que
       preguntarle las horas primero sería preguntar de más. */
    e.paso = paseosDe(e.destino) ? 'paseo' : 'lejos';
    return siguiente(e, n + (n === 1 ? ' día' : ' días') + ' de paseo, anotado 🚐');
  }

  /* ---- ¿alguno de los paseos con nombre? ---- */
  if (e.paso === 'paseo') {
    const ops = paseosDe(e.destino) || [];
    if (/ningun|no\b|nada|normales/.test(t)) {
      e.paseo = null;
    } else {
      let escogido = null;
      for (let i = 0; i < ops.length && !escogido; i++) {
        if (esLaPalabra(t, normaliza(ops[i])) ||
            palabrasDe(t).some(function (p) { return esLaPalabra(p, normaliza(ops[i].split(' ').pop())); })) {
          escogido = ops[i];
        }
      }
      if (!escogido) return siguiente(e);
      e.paseo = escogido;
    }
    e.paso = 'lejos';
    return siguiente(e, e.paseo ? '*' + e.paseo + '*, anotado ✅' : 'Va, recorridos normales.');
  }

  /* ---- ¿dentro de 80 km? ---- */
  if (e.paso === 'lejos') {
    if (/lejos|otra ciudad|fuera|si\b/.test(t)) e.lejos = true;
    else if (/zona|cerca|aqui|no\b/.test(t)) e.lejos = false;
    else return siguiente(e);
    e.paso = 'horas';
    return siguiente(e, e.lejos ? 'Recorridos largos, anotado.' : 'Por la zona, va.');
  }

  if (e.paso === 'horas') {
    let b = null;
    if (/todo|12|doce/.test(t)) b = 2;
    else if (/10|diez/.test(t)) b = 1;
    else if (/8|ocho/.test(t)) b = 0;
    if (b === null) {
      return {
        texto: '¿Como cuántas horas al día ocuparían la unidad?',
        pasa: false, estado: e, opciones: pregunta(e).opciones
      };
    }
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
      const m = { horaInicio: '08:00', horaFin: HORAS_MOV[e.banda || 0].fin };
      /* Los km solo se mandan cuando el cliente dijo que se van lejos. Si
         no lo dijo, NO se inventa un número: sin `km` el motor cobra la
         banda de horas de siempre. */
      if (e.lejos) m.km = 120;
      /* El paseo con nombre va en UN día, el primero. Es un producto que
         se hace una vez, no todos los días del viaje. */
      if (e.paseo && i === 0) m.paseo = e.paseo;
      movimientos.push(m);
    }

    /* ------------------------------------------------------------
       LO QUE NO SE COTIZA SOLO
       ------------------------------------------------------------
       Autobús y Suburban no tienen `cotizadorAutomatico`, así que el
       precio lo pone una persona. Pero el cliente ya contestó todo:
       sería una grosería —y una venta perdida— mandarlo a empezar de
       nuevo por teléfono.

       Se le entrega la solicitud armada. Quien conteste solo pone el
       precio, que es justo lo que pidió el dueño.
       ------------------------------------------------------------ */
    if (e.unidad && e.unidad !== 'sprinter') {
      return {
        texto: textoDeSolicitud(e),
        pasa: true,
        estado: null,
        opciones: ['Enviar por WhatsApp', 'Cotizar otro'],
        solicitud: {
          unidad: e.unidad, gente: e.gente || null,
          origen: e.origen, destino: e.destino,
          salida: e.salida, regreso: e.regreso,
          recorridos: e.recorridos || 0,
          horas: e.recorridos ? HORAS_MOV[e.banda || 0].etiqueta : null
        }
      };
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
        recorridos: e.recorridos || 0, horas: HORAS_MOV[e.banda || 0].etiqueta,
        paseo: e.paseo || null, lejos: !!e.lejos
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
   LA SOLICITUD ARMADA
   ------------------------------------------------------------
   Para lo que no se cotiza solo. Sale con todo lo que necesita
   quien vaya a poner el precio, en el orden en que lo va a
   buscar, y de una pieza para que el cliente pueda copiarla y
   pegarla en WhatsApp sin escribir nada.

   NO trae precio. Ese lo pone la persona (R12).
   ------------------------------------------------------------ */
function textoDeSolicitud(e) {
  const dias = diasEntre(e.salida, e.regreso);
  const queUnidad = e.unidad === 'suburban' ? SUBURBAN.name : 'Autobús';

  return '📋 *Solicitud de cotización*\n\n' +
    '🚌 Unidad: ' + queUnidad + '\n' +
    (e.gente ? '👥 Pasajeros: ' + e.gente + '\n' : '') +
    '📍 Salen de: ' + e.origen + '\n' +
    '📍 Van a: ' + e.destino + '\n' +
    '📅 Salida: ' + fechaEnPalabras(e.salida) + '\n' +
    '📅 Regreso: ' + fechaEnPalabras(e.regreso) + '\n' +
    '🗓️ ' + dias + (dias === 1 ? ' día' : ' días') + ' de servicio\n' +
    '🚐 Recorridos: ' + (e.recorridos
      ? e.recorridos + (e.recorridos === 1 ? ' día' : ' días') + ', ' +
        HORAS_MOV[e.banda || 0].etiqueta.toLowerCase()
      : 'ninguno') + '\n\n' +
    'Ya tengo todo ✅\n\n' +
    'Mándale esto por WhatsApp al *' + TELEFONO + '* y te pasan el precio en ' +
    'un momento — no tienes que volver a explicar nada.';
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

  /* ------------------------------------------------------------
     EL IVA NO SE NOMBRA, PERO SE COBRA IGUAL
     ------------------------------------------------------------
     Aclarado por el dueño el 31-ago-2026: «no quiero que no lo
     cobres, solo no lo menciones».

     Esto estuvo mal una vez y hay que dejarlo escrito. Primero se
     entendió «por WhatsApp no cobres IVA» como quitarle el 16 % al
     precio —sus precios de lista YA lo traen dentro, así que no
     cobrarlo habría sido cobrar menos—. Chapala 3 días habría
     pasado de $9,000 a $7,759: **$1,241 menos por viaje**.

     No es eso. El precio es el MISMO que en la página. Lo único
     que cambia es que aquí no se dice «IVA incluido», porque por
     este canal no se factura.

     Por eso los montos entran TAL CUAL del motor de cobro y aquí
     no se divide ni se multiplica nada.
     ------------------------------------------------------------ */
  return {
    texto: '🚐 *Sprinter · hasta 20 pasajeros*\n\n' +
      (r.origen ? '📍 ' + r.origen + ' → ' + r.destino + '\n' : '') +
      (r.salida ? '📅 ' + fechaEnPalabras(r.salida) + ' al ' + fechaEnPalabras(r.regreso) + '\n' : '') +
      '🗓️ ' + precio.dias + (precio.dias === 1 ? ' día' : ' días') + ' de servicio\n' +
      (r.recorridos ? '🚐 ' + r.recorridos + (r.recorridos === 1 ? ' día' : ' días') +
        ' de recorrido (' + String(r.horas).toLowerCase() +
        (r.lejos ? ', lejos' : '') + ')\n' : '') +
      (r.paseo ? '⭐ Con ' + r.paseo + '\n' : '') +
      '\n*Total: ' + pesos(precio.total) + '*\n' +
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
    /* «Más de 20» no dice cuántos son. Antes se leía como 21 y el bot
       contestaba «andan por poquito arriba», que a un grupo de 60 le
       suena absurdo. Ahora pregunta. */
    const piso = masDeQue(t);
    if (piso !== null) {
      const p = siguiente({ paso: 'cuantos', piso: piso });
      return { texto: p.texto, pasa: false, estado: p.estado, opciones: p.opciones };
    }
    const gente = cuantaGente(t);
    if (gente) {
      const r = recomienda(gente);
      return { texto: r.texto, pasa: false, estado: r.estado, opciones: r.opciones };
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
  const piso = masDeQue(t);
  if (piso !== null) {
    const p = siguiente({ paso: 'cuantos', piso: piso });
    return { texto: p.texto, pasa: false, estado: p.estado, opciones: p.opciones };
  }
  const gente = cuantaGente(t);
  if (gente) {
    const r = recomienda(gente);
    return { texto: r.texto, pasa: false, estado: r.estado, opciones: r.opciones };
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
    /* «spter», «suburvan», «neobús»: se busca por palabra y con
       tolerancia, no con `indexOf`, que exige escribirlo perfecto. */
    const nombre = normaliza(u.name);
    const loNombro = t.indexOf(nombre) !== -1 || palabrasDe(t).some(function (p) {
      return esLaPalabra(p, nombre);
    });
    if (loNombro) {
      if (u.cotizadorAutomatico) {
        const p = siguiente({ paso: 'destino', unidad: 'sprinter' });
        return {
          texto: '*' + u.name + '* — ' + u.cap + ' 🚐\n\nTe saco el precio ahorita.\n\n' +
            p.texto,
          pasa: false, estado: p.estado, opciones: p.opciones
        };
      }
      /* Las que no se cotizan solas TAMPOCO se quedan en la ficha: se
         le juntan los datos igual, para que quien ponga el precio no
         tenga que preguntarle todo otra vez. */
      const p = siguiente({
        paso: 'destino',
        unidad: u.id === 'suburban' ? 'suburban' : 'autobus'
      });
      return {
        texto: '*' + u.name + '* — ' + u.cap + '\n\nSu precio lo da una persona del ' +
          'equipo. Déjame juntar los datos para que te lo pasen rápido 👇\n\n' + p.texto,
        pasa: false, estado: p.estado, opciones: p.opciones
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
     ------------------------------------------------------------
     `noEntendio` es la señal para quien llama: aquí —y solo aquí—
     vale la pena gastar una llamada a la IA para que traduzca lo
     que quiso decir. Si no hay IA configurada, o falla, este
     mismo texto es la respuesta y el bot sigue funcionando.
     ------------------------------------------------------------ */
  return {
    texto: 'Esa no me la sé bien, y prefiero no contestarte mal 🙏\n\n' +
      'Te paso con una persona: márcale al *' + TELEFONO + '*.\n\n' +
      'O si quieres, dime *cuántos son y a dónde van* y te oriento.',
    pasa: true,
    noEntendio: true
  };
}

/* ------------------------------------------------------------
   LO QUE LA IA ALCANZÓ A LEER
   ------------------------------------------------------------
   Recibe los datos sueltos que sacó `_entender.js` y los mete en
   el mismo camino de siempre, saltándose lo que el cliente ya
   dijo. La IA NO escribe la respuesta: solo traduce. Todo lo que
   se le contesta lo redacta este archivo, y el precio lo sigue
   poniendo el motor de cobro.

   Devuelve null cuando lo entendido no alcanza para nada, y
   entonces quien llama se queda con la respuesta de siempre.
   ------------------------------------------------------------ */
function aplicaEntendido(datos, hoy) {
  if (!datos) return null;

  /* Intenciones que ya tienen respuesta escrita: se contesta esa. Es
     gratis y está mejor redactada que cualquier improvisación. */
  if (datos.intencion === 'persona') return respuestaA('quiero hablar con una persona', null, hoy);
  if (datos.intencion === 'unidades') return respuestaA('que unidades tienen', null, hoy);
  if (datos.intencion === 'incluye') return respuestaA('que incluye', null, hoy);
  if (datos.intencion === 'saludo') return respuestaA('hola', null, hoy);

  /* Para cotizar hace falta AL MENOS una pista de qué quiere. Con nada
     de nada, preguntar de cero es mejor que fingir que se entendió. */
  const algo = datos.gente || datos.unidad || datos.destino || datos.salida;
  if (!algo) return null;

  /* Qué unidad. Si dijo cuántos son, manda el número —es más confiable
     que el nombre que haya alcanzado a escribir—. */
  let unidad = datos.unidad;
  if (datos.gente) {
    if (datos.gente <= Number(SPRINTER.max)) unidad = 'sprinter';
    else if (datos.gente > CASI_SPRINTER) unidad = 'autobus';
    else unidad = null;                      // en la orilla: mejor preguntarle
  }

  /* Sin unidad clara se le devuelve al camino normal, que ya sabe
     preguntar bien lo que falta. */
  if (!unidad) {
    if (datos.gente) {
      const r = recomienda(datos.gente);
      return { texto: r.texto, pasa: false, estado: r.estado, opciones: r.opciones };
    }
    return null;
  }

  const e = { unidad: unidad, gente: datos.gente || null };
  if (datos.destino) e.destino = datos.destino;
  if (datos.origen) e.origen = datos.origen;
  if (datos.salida) e.salida = datos.salida;
  if (datos.regreso) e.regreso = datos.regreso;

  /* Solo ida: se cotiza como salir y volver el mismo día, que es lo que
     el motor sabe cobrar. Y así R22 le quita los movimientos solo. */
  if (datos.soloIda && e.salida && !e.regreso) e.regreso = e.salida;

  /* Al primer hueco que quede. El orden es el mismo de siempre. */
  if (!e.destino) e.paso = 'destino';
  else if (!e.origen) e.paso = 'origen';
  else if (!e.salida) e.paso = 'salida';
  else if (!e.regreso) e.paso = 'regreso';
  else if (diasEntre(e.salida, e.regreso) === 1) { e.recorridos = 0; e.paso = 'confirmar'; }
  else if (typeof e.recorridos !== 'number') e.paso = 'recorridos';
  else e.paso = 'confirmar';

  const p = siguiente(e);
  const leido = [];
  if (unidad === 'sprinter') leido.push(SPRINTER.name);
  else if (unidad === 'suburban') leido.push(SUBURBAN.name);
  else leido.push('autobús');
  if (e.destino) leido.push('a ' + e.destino);
  if (e.salida) leido.push(fechaEnPalabras(e.salida));

  return {
    /* Se le repite lo que se entendió ANTES de seguir. Si la IA leyó
       mal, el cliente lo ve de inmediato y lo corrige, en vez de
       enterarse hasta el final. */
    texto: 'Creo que entendí: *' + leido.join(', ') + '* 🤔\n\n' +
      'Si me equivoqué dime *cambiar algo*.\n\n' + p.texto,
    pasa: false, estado: p.estado, opciones: p.opciones
  };
}

module.exports = {
  respuestaA, textoDeCotizacion, textoDeSolicitud, aplicaEntendido,
  /* Para probar la tolerancia a faltas sin pasar por todo el bot. */
  esLaPalabra, fonetica, distancia,
  normaliza, cuantaGente, unidadPara, fechaDe, fechaEnPalabras, hoyISO,
  /* `pregunta` y `diasEntre` se exportan para poder vigilarlos desde las
     pruebas: que ninguna opción se pase de los topes de WhatsApp —3
     botones de 20 caracteres o 10 filas de 24— y que los días se cuenten
     con los dos extremos. */
  pregunta, diasEntre, HORAS_MOV,
  /* `paseosDe` lo usa TAMBIEN la pantalla de cotizar, no solo el chat. Se
     comparte a propósito: una tercera copia de esa tabla sería una tercera
     cosa que se despega sola. */
  paseosDe,
  UNIDADES, TELEFONO, SITIO
};
