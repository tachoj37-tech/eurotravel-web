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
function pasoDeCotizacion(t, crudo, estado, hoy) {
  const e = estado;

  if (tiene(t, ['cancelar', 'olvidalo', 'ya no', 'mejor no', 'empezar de nuevo'])) {
    return { texto: 'Listo, lo dejamos ahí 👍\n\n¿Te ayudo con algo más?',
      pasa: false, estado: null };
  }

  if (e.paso === 'destino') {
    const d = String(crudo).trim().slice(0, 120);
    if (d.length < 3) {
      return { texto: '¿A qué ciudad o lugar van?', pasa: false, estado: e };
    }
    return {
      texto: 'Perfecto, *' + d + '* 📍\n\n¿Y de dónde salen?',
      pasa: false,
      estado: { paso: 'origen', destino: d }
    };
  }

  if (e.paso === 'origen') {
    const o = String(crudo).trim().slice(0, 120);
    if (o.length < 3) {
      return { texto: '¿De qué ciudad salen?', pasa: false, estado: e };
    }
    return {
      texto: '¿Qué día salen? Puedes escribirlo como quieras: *10 de septiembre*, ' +
        '*10/9*, o *mañana*.',
      pasa: false,
      estado: { paso: 'salida', destino: e.destino, origen: o }
    };
  }

  if (e.paso === 'salida') {
    const f = fechaDe(crudo, hoy);
    if (!f) {
      return { texto: 'No entendí la fecha 🙈 Escríbela como *10 de septiembre* o *10/9*.',
        pasa: false, estado: e };
    }
    return {
      texto: 'Salen el *' + fechaEnPalabras(f) + '*.\n\n¿Y qué día regresan?',
      pasa: false,
      estado: { paso: 'regreso', destino: e.destino, origen: e.origen, salida: f }
    };
  }

  if (e.paso === 'regreso') {
    const f = fechaDe(crudo, hoy);
    if (!f) {
      return { texto: 'Esa fecha no la entendí. ¿Qué día regresan?', pasa: false, estado: e };
    }
    if (f < e.salida) {
      return {
        texto: 'El regreso queda antes de la salida 🤔 Salen el *' +
          fechaEnPalabras(e.salida) + '*. ¿Qué día vuelven?',
        pasa: false, estado: e
      };
    }
    return {
      texto: 'Va, déjame sacar el precio…',
      pasa: false,
      estado: null,
      cotiza: {
        unidad: 'sprinter',
        origen: { direccion: e.origen },
        destino: { direccion: e.destino },
        salida: e.salida,
        regreso: f,
        redondo: true
      },
      /* Se guarda en palabras para poder repetirlo al dar el precio: el
         cliente tiene que ver QUÉ se cotizó, no solo cuánto. */
      resumen: { destino: e.destino, origen: e.origen, salida: e.salida, regreso: f }
    };
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
      '🗓️ ' + precio.dias + (precio.dias === 1 ? ' día' : ' días') + ' de servicio\n\n' +
      '*Total: ' + pesos(precio.total) + '* (IVA incluido)\n' +
      'Para apartar: ' + pesos(precio.anticipo) + '\n' +
      'Resto al abordar: ' + pesos(precio.saldo) + '\n\n' +
      'Incluye operador, combustible, casetas y seguro de viajero.\n\n' +
      '¿Lo apartamos? Puedes hacerlo en línea aquí:\n' + SITIO + '/#/cotizar\n' +
      'O márcale al *' + TELEFONO + '* si prefieres.',
    pasa: false
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
      return {
        texto: 'Para ' + gente + ' personas te va la *' + u.name + '* (' + u.cap + ').\n\n' +
          'Te saco el precio ahorita mismo 👇\n\n¿A dónde van?',
        pasa: false,
        estado: { paso: 'destino' }
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
       persona. Así que primero eso. */
    return {
      texto: 'Con gusto 🚌 ¿Cuántas personas viajan?\n\n' +
        'Si son *20 o menos* te saco el precio aquí mismo en un minuto.',
      pasa: false
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
    return {
      texto: 'Para ' + gente + ' personas te va la *' + u.name + '*.\n\n' + fichaDe(u) +
        (u.cotizadorAutomatico
          ? '\n\n¿Te saco el precio? Dime *a dónde van*.'
          : '\n\n¿A dónde van y qué días? Con eso te cotizan.'),
      pasa: !u.cotizadorAutomatico,
      estado: u.cotizadorAutomatico ? { paso: 'destino' } : null
    };
  }

  /* ---- una unidad por su nombre ---- */
  for (let i = 0; i < UNIDADES.length; i++) {
    const u = UNIDADES[i];
    if (t.indexOf(normaliza(u.name)) !== -1) {
      return { texto: fichaDe(u), pasa: false };
    }
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
  UNIDADES, TELEFONO
};
