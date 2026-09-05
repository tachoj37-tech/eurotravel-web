/* ============================================================
   Las notas de voz, vueltas texto
   ------------------------------------------------------------
   En WhatsApp mexicano mucha gente manda audio antes que
   escribir. Sin esto, el bot contesta «¿me lo pones en un
   mensaje?» y pierde al cliente en el primer intento.

   QUÉ HACE

   Baja el audio de Meta y lo manda a transcribir. Devuelve TEXTO.
   Ese texto entra a `bot.js` por la misma puerta que si lo
   hubieran tecleado — el bot entero funciona igual, sin cambiarle
   una línea. El audio se vuelve texto en la puerta y ya.

   POR QUÉ GROQ Y NO OTRO

   No por barato, aunque lo es. Por RÁPIDO: una función de Vercel
   en el plan Hobby tiene unos diez segundos, y ahí caben bajar el
   audio Y transcribirlo. Whisper de OpenAI hace lo mismo pero más
   lento, y aquí el tiempo es el que aprieta, no el precio.

   Sale del orden de dos centavos de peso por nota de voz.

   ------------------------------------------------------------
   ARRIBA DEL MINUTO NO LO OYE LA IA · dictado del dueño
   ------------------------------------------------------------
   «que la ia no escuche audios arriba del minuto, eso que lo
    escuche la persona vendedor» (2-sep-2026).

   Y aquí hay algo que hay que decir tal cual: **el aviso de Meta
   NO trae la duración del audio.** Trae el tamaño en bytes. Así
   que el minuto se mide por PESO, y eso es una estimación, no un
   dato.

   La cuenta: WhatsApp manda sus notas de voz en Opus a unos
   16 kbps mono, o sea ~2 KB por segundo. Un minuto ≈ 120 KB. El
   tope se pone en 160 KB para no cortar por poquito a alguien que
   habló 55 segundos con mejor calidad.

   Si se pasa, NO se baja y NO se transcribe: se marca para que lo
   oiga el vendedor. Eso también ahorra — el audio largo es el
   caro y es justo el que no se paga.
   ============================================================ */

'use strict';

/* ------------------------------------------------------------
   EL MODELO COMPLETO, NO EL «TURBO»
   ------------------------------------------------------------
   Se arrancó con `whisper-large-v3-turbo`, que es una versión
   destilada: igual de buena con audio limpio y notablemente peor
   con ruido, con acento marcado o con alguien hablando lejos del
   micrófono. O sea, peor justo en el caso que importa — el dueño
   lo señaló: «los clientes a veces hablan muy borroso».

   El completo cuesta $0.111 la hora contra $0.04. Una nota de voz
   de 40 segundos pasa de medio centavo a dos centavos de peso.
   Por esa diferencia no se pelea: una transcripción mal hecha
   manda al cliente a otro destino y eso sí cuesta.
   ------------------------------------------------------------ */
const MODELO = 'whisper-large-v3';
const TOPE_BYTES = 160 * 1024;             // ~1 minuto de nota de voz
const VERSION_META = 'v20.0';

/* Ninguna llamada puede colgar la función: Meta reintenta el aviso si
   no le contestamos rápido, y un reintento es un mensaje duplicado
   para el cliente. */
const ESPERA_MAX = 7000;

/* ------------------------------------------------------------
   LAS PALABRAS QUE ESPERA OÍR
   ------------------------------------------------------------
   Los destinos salen del catálogo de verdad —`_destinos.js`— y no
   de una lista aparte: si el dueño da de alta un destino nuevo,
   entra aquí solo. Dos listas de lo mismo se separan siempre.

   El `try` es porque esto no puede tumbar una transcripción: si
   el catálogo no carga, se manda el vocabulario base y ya.
   ------------------------------------------------------------ */
const BASE = 'Eurotravel, Sprinter, Suburban, autobús, camioneta, ' +
  'cotización, viaje redondo, ida y vuelta, pasajeros, chofer, anticipo, ' +
  'Guadalajara, Tlaquepaque, Zapopan';

function vocabulario() {
  try {
    const destinos = require('./_destinos.js').DESTINOS || [];
    const nombres = destinos.map(function (d) { return d.nombre; })
      .filter(Boolean).slice(0, 60).join(', ');
    /* Whisper corta el prompt a 224 tokens. Se recorta a mano para que
       el corte caiga donde queremos y no a media palabra. */
    return (BASE + ', ' + nombres).slice(0, 850);
  } catch (e) {
    return BASE;
  }
}

/* ------------------------------------------------------------
   CUÁNDO NO CREERLE A LA TRANSCRIPCIÓN
   ------------------------------------------------------------
   Esto es lo más importante de todo el archivo, más que el modelo.

   Whisper SIEMPRE devuelve algo. Con un audio malo no dice «no
   entendí»: se inventa palabras que suenan parecido. Y una
   palabra inventada aquí no es un detalle — es otro destino, y
   otro destino es otro precio.

   `verbose_json` trae, por segmento:
     · `avg_logprob`     qué tan segura está de lo que oyó
     · `no_speech_prob`  qué tan probable es que no haya voz

   Los umbrales son los que Whisper usa por dentro para descartar
   segmentos, y aquí sirven igual. **Son heurísticos**: hay que
   ajustarlos con audios de verdad de sus clientes, no con teoría.

   Si la transcripción sale dudosa NO se le manda al bot: se marca
   para que la oiga el vendedor, igual que un audio largo. Es la
   misma regla de R45 aplicada al oído — si no se sabe al 100 %,
   no se actúa.
   ------------------------------------------------------------ */
const CONFIANZA_MINIMA = -0.85;   // avg_logprob; más negativo = peor
const RUIDO_MAXIMO = 0.55;        // no_speech_prob

function esDudosa(salida) {
  const segs = (salida && salida.segments) || [];
  if (!segs.length) return false;         // sin datos, no se juzga

  let malos = 0;
  for (let i = 0; i < segs.length; i++) {
    const s = segs[i] || {};
    const flojo = typeof s.avg_logprob === 'number' && s.avg_logprob < CONFIANZA_MINIMA;
    const mudo = typeof s.no_speech_prob === 'number' && s.no_speech_prob > RUIDO_MAXIMO;
    if (flojo || mudo) malos++;
  }
  /* Un segmento flojo entre varios es normal —una tos, un claxon—.
     Se marca dudosa cuando es la MITAD o más: ahí ya no es ruido
     puntual, es que no se oye. */
  return malos / segs.length >= 0.5;
}

function conTope(promesa, ms) {
  return Promise.race([
    promesa,
    new Promise(function (_, rechaza) {
      setTimeout(function () { rechaza(new Error('tardó de más')); }, ms || ESPERA_MAX);
    })
  ]);
}

/* ------------------------------------------------------------
   `pide` entra como parámetro para poder probar todo esto sin
   gastar una llamada de verdad ni tener claves. Es la misma maña
   de `_entender.js`.
   ------------------------------------------------------------ */
async function transcribe(idMedia, opciones) {
  const o = opciones || {};
  const pide = o.pide || (typeof fetch === 'function' ? fetch : null);
  const tokenMeta = o.tokenMeta || process.env.WHATSAPP_TOKEN;
  const claveGroq = o.claveGroq || process.env.GROQ_API_KEY;

  /* Sin claves NO se cae: simplemente no hay transcripción y el
     webhook contesta como siempre. Es una mejora, no un requisito. */
  if (!idMedia || !pide || !tokenMeta || !claveGroq) return null;

  try {
    /* 1 · Meta dice dónde está el archivo y CUÁNTO PESA. Este paso es
       el que decide si se transcribe: preguntar el tamaño es gratis,
       bajar el audio no. */
    const ficha = await conTope(pide(
      'https://graph.facebook.com/' + VERSION_META + '/' + encodeURIComponent(idMedia),
      { headers: { Authorization: 'Bearer ' + tokenMeta } }
    ));
    if (!ficha || !ficha.ok) return null;

    const datos = await ficha.json();
    if (!datos || !datos.url) return null;

    const bytes = Number(datos.file_size) || 0;
    if (bytes > TOPE_BYTES) {
      /* Ni se baja. El audio largo es el caro y es justo el que el
         dueño quiere que oiga una persona. */
      return { muyLargo: true, bytes: bytes };
    }

    /* 2 · El archivo, con el mismo token. */
    const archivo = await conTope(pide(datos.url, {
      headers: { Authorization: 'Bearer ' + tokenMeta }
    }));
    if (!archivo || !archivo.ok) return null;

    const crudo = await archivo.arrayBuffer();
    /* Segunda revisión del tamaño, ahora sobre lo que de verdad llegó:
       `file_size` lo dice Meta y podría venir mal o no venir. Un tope
       que solo confía en lo que le dicen no es un tope. */
    if (crudo.byteLength > TOPE_BYTES) {
      return { muyLargo: true, bytes: crudo.byteLength };
    }

    /* 3 · A transcribir. `language: es` no es adorno: sin él, un audio
       corto con ruido a veces se transcribe como si fuera otro idioma. */
    /* --------------------------------------------------------
       EL VOCABULARIO · lo que más ayuda, y es gratis
       --------------------------------------------------------
       Whisper acepta un `prompt` que sesga su vocabulario. No es
       una instrucción: son palabras que espera oír.

       Sin esto, «Ocotlán» sale «ocotlan», «Mazamitla» sale «masa
       mit la» y «Sprinter» sale «esprinter» o «printer». Y esas
       son EXACTAMENTE las palabras de las que depende el precio.

       Los destinos salen del catálogo de verdad, no de una lista
       aparte: si el dueño da de alta uno nuevo, entra solo.
       -------------------------------------------------------- */
    const forma = new FormData();
    forma.append('file', new Blob([crudo], {
      type: datos.mime_type || 'audio/ogg'
    }), 'nota.ogg');
    forma.append('model', MODELO);
    forma.append('language', 'es');
    forma.append('prompt', vocabulario());
    /* `verbose_json` en vez de `json`: trae los segmentos con su
       confianza, y de ahí sale el filtro de abajo. Cuesta lo mismo. */
    forma.append('response_format', 'verbose_json');

    const r = await conTope(pide('https://api.groq.com/openai/v1/audio/transcriptions', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + claveGroq },
      body: forma
    }));
    if (!r || !r.ok) {
      console.error('[transcribe] groq contesto ' + (r && r.status));
      return null;
    }

    const salida = await r.json();
    const texto = salida && typeof salida.text === 'string' ? salida.text.trim() : '';

    /* Un audio de puro ruido devuelve una cadena vacía o dos letras.
       Mandarle eso al bot solo lo haría contestar que no entendió; es
       mejor tratarlo como si no hubiera transcripción. */
    if (texto.length < 3) return null;

    /* Y aunque haya salido texto: si Whisper no estaba segura, NO se le
       cree. Vale más que lo oiga el vendedor a que el bot cotice para
       Ocotlán un viaje que era a Ocosingo. */
    if (esDudosa(salida)) {
      return { dudosa: true, texto: texto.slice(0, 500) };
    }

    return { texto: texto.slice(0, 500) };
  } catch (e) {
    /* Que falle transcribir jamás puede tumbar el webhook. */
    console.error('[transcribe] no se pudo: ' + e.message);
    return null;
  }
}

module.exports = { transcribe, esDudosa, vocabulario, TOPE_BYTES, MODELO };
