/* ============================================================
   Cuando el bot de plano no entendió
   ------------------------------------------------------------
   Esto es lo ÚNICO del proyecto que usa IA, y se usa lo menos
   posible: solo cuando `bot.js` ya se rindió.

   Por qué así y no al revés:

     · Cada llamada cuesta. El 95 % de lo que escribe la gente
       —«hola», «cuánto cuesta», «somos 15»— ya lo entiende
       `bot.js` gratis, incluso mal escrito. Mandar todo a la IA
       sería pagar por lo que ya está resuelto.
     · Sin IA el bot contesta al instante. Con IA tarda uno o dos
       segundos. Que ese costo lo pague solo quien escribió algo
       raro, no todos.
     · Si la IA falla o se acaba la cuota, el bot NO se cae: se
       queda como estaba, pasando con una persona.

   QUÉ HACE Y QUÉ NO

   Traduce. Nada más. Lee «lla kiero uan spter 4 sep ida» y
   devuelve los datos sueltos: unidad Sprinter, salida 4 de
   septiembre, sin regreso. NO redacta la respuesta, NO decide
   precios y NO habla con el cliente.

   Eso importa: el precio lo sigue poniendo el motor de cobro
   (R12), y las respuestas las sigue escribiendo `bot.js`. Si la
   IA se equivoca, lo peor que pasa es que el bot pregunte algo
   que el cliente ya había dicho — nunca que cotice de más o de
   menos.
   ============================================================ */

const MODELO = 'claude-haiku-4-5-20251001';   // el más barato que hace esto bien
const TOPE_SALIDA = 400;                      // no necesita más para unos campos
const TOPE_ENTRADA = 500;                     // lo que el cliente escribió, acotado

/* Lo que se le pide. Va corto a propósito: cada palabra aquí se paga
   en cada llamada. */
function instrucciones(hoy) {
  return 'Eres un traductor de mensajes para una empresa de renta de autobuses ' +
    'en Guadalajara, México. El cliente escribe rápido, con faltas y ' +
    'abreviaturas.\n\n' +
    'Devuelve SOLO un objeto JSON, sin explicar nada, con estas llaves ' +
    '(usa null en las que no puedas saber):\n' +
    '{"intencion":"cotizar|unidades|incluye|persona|saludo|otro",' +
    '"gente":number,"unidad":"sprinter|suburban|autobus",' +
    '"destino":string,"origen":string,' +
    '"salida":"aaaa-mm-dd","regreso":"aaaa-mm-dd","soloIda":boolean}\n\n' +
    'Hoy es ' + hoy + '. Si dice un día sin año, entiéndelo del año más ' +
    'cercano que no haya pasado.\n' +
    'NUNCA inventes un dato que el cliente no dijo: si no lo dijo, va null.\n' +
    'No des precios ni opiniones.\n\n' +
    'Ejemplo:\n' +
    'lla kiero uan spter 4 sep ida\n' +
    '{"intencion":"cotizar","gente":null,"unidad":"sprinter","destino":null,' +
    '"origen":null,"salida":"' + hoy.slice(0, 4) + '-09-04","regreso":null,' +
    '"soloIda":true}';
}

/* Deja pasar solo lo que se entiende y con la forma correcta. Lo que
   venga raro se vuelve null: es preferible preguntarle al cliente que
   arrancar con un dato inventado. */
function limpia(d) {
  if (!d || typeof d !== 'object') return null;

  const texto = function (v, tope) {
    if (typeof v !== 'string') return null;
    const s = v.trim().slice(0, tope || 120);
    return s.length >= 2 ? s : null;
  };
  const fecha = function (v) {
    return typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null;
  };
  const entero = function (v) {
    const n = Number(v);
    return Number.isInteger(n) && n > 0 && n <= 500 ? n : null;
  };
  const deLista = function (v, lista) {
    return typeof v === 'string' && lista.indexOf(v) !== -1 ? v : null;
  };

  const salida = fecha(d.salida);
  let regreso = fecha(d.regreso);
  /* Un regreso anterior a la salida es un error de lectura, no un dato.
     Se tira: preguntar es barato, cotizar al revés no. */
  if (salida && regreso && regreso < salida) regreso = null;

  return {
    intencion: deLista(d.intencion,
      ['cotizar', 'unidades', 'incluye', 'persona', 'saludo', 'otro']) || 'otro',
    gente: entero(d.gente),
    unidad: deLista(d.unidad, ['sprinter', 'suburban', 'autobus']),
    destino: texto(d.destino),
    origen: texto(d.origen),
    salida: salida,
    regreso: regreso,
    soloIda: d.soloIda === true
  };
}

/* El modelo a veces envuelve el JSON en explicaciones o en ```json.
   Se saca el primer objeto que aparezca. */
function sacaJSON(texto) {
  const s = String(texto || '');
  const desde = s.indexOf('{');
  const hasta = s.lastIndexOf('}');
  if (desde === -1 || hasta <= desde) return null;
  try {
    return JSON.parse(s.slice(desde, hasta + 1));
  } catch (e) {
    return null;
  }
}

/* ------------------------------------------------------------
   `pide` entra como parámetro para poder probar esto sin gastar
   ni una llamada de verdad. En producción llega el `fetch` real.
   ------------------------------------------------------------ */
async function entiende(mensaje, opciones) {
  const o = opciones || {};
  const clave = o.clave || process.env.ANTHROPIC_API_KEY;
  const pide = o.pide || (typeof fetch === 'function' ? fetch : null);
  const hoy = o.hoy || new Date().toISOString().slice(0, 10);

  /* Sin clave configurada NO se cae: simplemente no hay IA, y el bot
     sigue contestando como siempre. Es una mejora, no un requisito. */
  if (!clave || !pide) return null;

  const texto = String(mensaje || '').trim().slice(0, TOPE_ENTRADA);
  if (texto.length < 2) return null;

  try {
    const r = await pide('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': clave,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: MODELO,
        max_tokens: TOPE_SALIDA,
        system: instrucciones(hoy),
        messages: [{ role: 'user', content: texto }]
      })
    });

    if (!r || !r.ok) {
      console.error('[entender] la IA contesto ' + (r && r.status));
      return null;
    }
    const cuerpo = await r.json();
    const dijo = cuerpo && cuerpo.content && cuerpo.content[0] && cuerpo.content[0].text;
    return limpia(sacaJSON(dijo));
  } catch (e) {
    /* Que la IA falle jamás puede tumbar al bot. */
    console.error('[entender] no se pudo: ' + e.message);
    return null;
  }
}

module.exports = { entiende, limpia, sacaJSON, instrucciones, MODELO };
