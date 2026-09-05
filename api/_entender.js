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

/* ------------------------------------------------------------
   EL «CHIP»: LO QUE LA IA SABE DE VENDER
   ------------------------------------------------------------
   Hasta el 2-sep-2026 esto era solo un traductor. Ahora hace dos
   cosas, y la segunda es la que vende:

     1 · EXTRAER · los datos sueltos del mensaje, como siempre.
         Esto es lo que hace que «vamos a Tequila el 12, somos 16»
         funcione de un jalón en vez de rendirse.

     2 · RESPONDER · una sola línea, en voz del vendedor, cuando
         no hay nada que extraer y el guion no tiene qué decir.

   La psicología va aquí y no en la respuesta armada, porque el
   guion ya la trae puesta: el guion cubre el 95 % de lo que
   escribe la gente y no cuesta una llamada. La IA es para el 5 %
   raro — y ese 5 % también tiene que vender.

   LOS CANDADOS, que son lo que hace esto seguro:

   · JAMÁS un precio, ni una cifra, ni un «desde». El precio sale
     del motor de cobro (R12) y de ningún otro lado. Si la IA se
     equivoca al extraer, lo peor que pasa es que el bot pregunte
     algo dos veces; si pudiera decir cifras, lo peor sería cobrar
     mal.
   · JAMÁS un dato de la empresa que no esté escrito abajo. Nada
     de años operando, número de unidades ni cuántos grupos al
     mes: eso no lo tenemos y no se inventa.
   · JAMÁS urgencia falsa. Solo marzo, mayo y septiembre son
     temporada alta de verdad.
   · JAMÁS decir que pasa con alguien. El bot vive DENTRO del chat
     del vendedor; no hay a quién pasar.

   Y `respuesta` viene acotada a 240 caracteres a propósito: en
   chat, tres líneas se leen y seis se saltan.
   ------------------------------------------------------------ */
/* ------------------------------------------------------------
   DOS BLOQUES: LO QUE NO CAMBIA Y LO QUE CAMBIA — 5-sep-2026
   ------------------------------------------------------------
   El prompt se parte en dos para que Anthropic pueda CACHEAR el
   primero. La regla del caché es simple y estricta: se cachea un
   prefijo que sea idéntico byte por byte entre llamadas. Con «Hoy
   es 2026-09-05» adentro, el prefijo cambiaba cada día y el caché
   moría a medianoche.

     · ESTÁTICO  — quién eres, qué extraes, cómo vendes, candados,
                   el catálogo de unidades y los nombres de los 50
                   destinos. Idéntico siempre. Lleva `cache_control`.
     · DEL DÍA   — la fecha de hoy y la regla del año. Va después,
                   fuera del caché.

   Los ejemplos usan un año neutro a propósito por lo mismo.

   El caché de Haiku 4.5 solo se activa con 4,096 tokens o más de
   bloque estático (documentación oficial). Hoy este bloque anda en
   ~1,700: la estructura ya está bien puesta, y se enciende sola el
   día que entren aquí los marcos de venta, las objeciones y los
   datos de la empresa. No se rellena con paja para cruzar el
   umbral — eso sería pagar escrituras de caché por texto inútil.

   El catálogo va SIN kilómetros y SIN precios. La IA jamás debe
   tener una cifra a la mano: R12, el precio lo pone el motor de
   cobro, y lo que no está en el contexto no se puede filtrar.
   ------------------------------------------------------------ */
function instrucciones(hoy) {
  return instruccionesEstaticas() + '\n\n' + instruccionesDelDia(hoy);
}

function instruccionesDelDia(hoy) {
  return 'Hoy es ' + hoy + '. Si dice un día sin año, entiéndelo del año más ' +
    'cercano que no haya pasado. En los ejemplos de arriba, AAAA es ese año.';
}

function catalogoParaLaIA() {
  let unidades = '', destinos = '';
  try {
    const bot = require('../bot.js');
    unidades = (bot.UNIDADES || []).map(function (u) {
      return '· ' + u.name + ' — ' + u.cap + ' — ' + u.tag +
        (u.amen && u.amen.length ? ' — ' + u.amen.join(', ') : '');
    }).join('\n');
  } catch (e) { /* sin catálogo la IA sigue; solo sabe menos */ }
  try {
    const d = require('./_destinos.js');
    destinos = (d.DESTINOS || []).map(function (x) { return x.nombre; }).join(' · ');
  } catch (e) { /* idem */ }
  return (unidades ? '\n\nUNIDADES QUE EXISTEN (nombre — capacidad — línea — equipamiento):\n' +
    unidades : '') +
    (destinos ? '\n\nDESTINOS DE LISTA (para reconocerlos aunque vengan mal escritos):\n' +
    destinos : '');
}

function instruccionesEstaticas() {
  return 'Eres el vendedor de Eurotravel, renta de autobuses y Sprinters en ' +
    'Guadalajara. El cliente escribe rápido, con faltas y abreviaturas.\n\n' +

    'Devuelve SOLO un objeto JSON, sin explicar nada, con estas llaves ' +
    '(null en las que no puedas saber):\n' +
    '{"intencion":"cotizar|unidades|incluye|persona|saludo|fotos|objecion|fuera|otro",' +
    '"gente":number,"unidad":"sprinter|suburban|autobus",' +
    '"destino":string,"origen":string,' +
    '"salida":"aaaa-mm-dd","regreso":"aaaa-mm-dd","soloIda":boolean,' +
    '"ocasion":"fiesta|playa|boda|empresa|escolar|peregrinacion|escapada|ciudad",' +
    '"respuesta":string}\n\n' +

    'NUNCA inventes un dato que el cliente no dijo: si no lo dijo, va null.\n\n' +

    'CÓMO VENDES (esto es lo importante):\n' +
    'El que te escribe casi nunca viaja: ORGANIZA. Lo que compra no es el ' +
    'camión, es no quedar mal con la gente que confió en él.\n' +
    '· Usa SUS palabras y su destino, no genéricos.\n' +
    '· Una sola pregunta por mensaje, y que sea abierta.\n' +
    '· Recomienda, no preguntes: hasta 20 personas es Sprinter, más es autobús.\n' +
    '· Cierra siempre pidiendo el siguiente dato, nunca permiso.\n' +
    '· Sé concreto. Lo vago no vende y no se cree.\n\n' +

    'LO ÚNICO CIERTO QUE PUEDES DECIR DE LA EMPRESA:\n' +
    'todas las unidades traen seguro de viajero; la Sprinter es de 20 ' +
    'pasajeros con aire, pantalla y asientos reclinables; los autobuses ' +
    'llevan de 47 a 51, con baño y aire; el precio incluye operador, ' +
    'combustible y casetas.\n\n' +

    'DE QUÉ SE HABLA AQUÍ, Y DE NADA MÁS:\n' +
    'viajes, grupos, unidades, fechas, destinos, y lo que rodea a rentar ' +
    'transporte. Nada más.\n' +
    'Si el mensaje NO es de eso —política, religión, chistes, consejos de ' +
    'vida, tareas, programación, lo que sea— pon intencion:"fuera" y ' +
    'respuesta:null. NO lo contestes ni de pasada, ni por educación. El ' +
    'guion tiene una frase para regresar al tema y es gratis.\n' +
    'Tampoco expliques qué eres, cómo funcionas ni con qué estás hecho.\n\n' +

    'PROHIBIDO, SIN EXCEPCIÓN:\n' +
    '· Decir un precio, una cifra o un "desde". Ni aproximado.\n' +
    '· Inventar cualquier dato de la empresa que no esté arriba.\n' +
    '· Decir que se llena, que quedan pocos lugares o que urge, salvo que ' +
    'el viaje caiga en marzo, mayo o septiembre.\n' +
    '· Decir que pasas al cliente con alguien más. Tú eres el vendedor.\n\n' +

    '"respuesta" es UNA línea corta (máx 240 caracteres) en voz del ' +
    'vendedor, y solo cuando no haya nada que extraer. Si sí hay datos, ' +
    'déjala en null: el guion contesta mejor y gratis.\n\n' +

    'Ejemplos:\n' +
    'lla kiero uan spter 4 sep ida\n' +
    '{"intencion":"cotizar","gente":null,"unidad":"sprinter","destino":null,' +
    '"origen":null,"salida":"AAAA-09-04","regreso":null,' +
    '"soloIda":true,"ocasion":null,"respuesta":null}\n' +
    'nos vamos a tekila el 12 somos 16 de despedida\n' +
    '{"intencion":"cotizar","gente":16,"unidad":"sprinter","destino":"Tequila",' +
    '"origen":null,"salida":"AAAA-09-12","regreso":null,' +
    '"soloIda":false,"ocasion":"fiesta","respuesta":null}\n' +
    'y si se me poncha una llanta en el camino?\n' +
    '{"intencion":"otro","gente":null,"unidad":null,"destino":null,' +
    '"origen":null,"salida":null,"regreso":null,"soloIda":false,' +
    '"ocasion":null,"respuesta":"Va cubierto: el operador reporta y te ' +
    'mandamos apoyo, tú no te bajas a nada. ¿Para qué fecha lo traes?"}' +
    catalogoParaLaIA();
}

/* ------------------------------------------------------------
   LOS BLOQUES DEL SISTEMA, CON EL CACHÉ PUESTO
   ------------------------------------------------------------
   Anthropic cachea por prefijo idéntico. El primer bloque lleva
   `cache_control` y no cambia nunca; el segundo trae la fecha y va
   después. Si alguien mete algo del cliente en el primero —su
   nombre, su destino— rompe el caché para todos: por eso los
   bloques se arman aquí y en ningún otro lado.

   Las instrucciones del contrato (`_datos-contrato.js`) llegan
   como texto y no traen fecha: van enteras como bloque estático.
   ------------------------------------------------------------ */
function bloquesDelSistema(instruccionesAjenas, hoy) {
  if (Array.isArray(instruccionesAjenas)) return instruccionesAjenas;
  if (typeof instruccionesAjenas === 'string' && instruccionesAjenas) {
    return [{ type: 'text', text: instruccionesAjenas,
      cache_control: { type: 'ephemeral' } }];
  }
  return [
    { type: 'text', text: instruccionesEstaticas(), cache_control: { type: 'ephemeral' } },
    { type: 'text', text: instruccionesDelDia(hoy) }
  ];
}

/* ------------------------------------------------------------
   CUÁNTO CUESTA CADA LLAMADA, Y CADA CONVERSACIÓN
   ------------------------------------------------------------
   Tarifas de Haiku 4.5 (documentación oficial, 5-sep-2026), por
   millón de tokens: entrada $1 · escritura de caché $1.25 ·
   lectura de caché $0.10 · salida $5.

   Se apunta en el registro por llamada —para ver en Vercel si el
   caché de verdad se lee (`cache_lectura` > 0)— y se acumula por
   cliente con tope, para el tablero. Sin `usage` no se apunta
   nada: mejor un hueco que una cifra inventada.
   ------------------------------------------------------------ */
const TARIFA = { entrada: 1.00, escritura: 1.25, lectura: 0.10, salida: 5.00 };
const TOPE_CLIENTES_CON_COSTO = 500;
const costoPorCliente = new Map();

function costoDeUso(u) {
  const n = function (v) { return Number(v) || 0; };
  return (n(u.input_tokens) * TARIFA.entrada +
    n(u.cache_creation_input_tokens) * TARIFA.escritura +
    n(u.cache_read_input_tokens) * TARIFA.lectura +
    n(u.output_tokens) * TARIFA.salida) / 1e6;
}

function apuntaElCosto(usage, cliente) {
  if (!usage || typeof usage !== 'object') return null;
  const usd = costoDeUso(usage);
  console.log('[ia] entrada=' + (usage.input_tokens || 0) +
    ' cache_escritura=' + (usage.cache_creation_input_tokens || 0) +
    ' cache_lectura=' + (usage.cache_read_input_tokens || 0) +
    ' salida=' + (usage.output_tokens || 0) +
    ' usd=' + usd.toFixed(5));
  if (cliente) {
    const k = String(cliente).replace(/\D+/g, '').slice(-10);
    const t = costoPorCliente.get(k) || { llamadas: 0, usd: 0, lectura: 0 };
    t.llamadas += 1; t.usd += usd; t.lectura += Number(usage.cache_read_input_tokens) || 0;
    costoPorCliente.set(k, t);
    while (costoPorCliente.size > TOPE_CLIENTES_CON_COSTO) {
      costoPorCliente.delete(costoPorCliente.keys().next().value);
    }
  }
  return usd;
}

function costoDe(cliente) {
  return costoPorCliente.get(String(cliente || '').replace(/\D+/g, '').slice(-10)) || null;
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

  /* Si el mensaje quedó FUERA del tema, aquí se le quita la respuesta
     aunque la IA la haya escrito. Las instrucciones ya le dicen que no
     conteste; esto se asegura de que aunque conteste, no salga.

     Contestarle a un cliente sobre política, religión o consejos de
     vida no es solo gastar una llamada: es que la empresa quede
     opinando de algo que no le toca, con una frase que nadie revisó. */
  if (d.intencion === 'fuera') d = Object.assign({}, d, { respuesta: null });

  const salida = fecha(d.salida);
  let regreso = fecha(d.regreso);
  /* Un regreso anterior a la salida es un error de lectura, no un dato.
     Se tira: preguntar es barato, cotizar al revés no. */
  if (salida && regreso && regreso < salida) regreso = null;

  return {
    intencion: deLista(d.intencion,
      ['cotizar', 'unidades', 'incluye', 'persona', 'saludo', 'fotos',
        'objecion', 'fuera', 'otro']) || 'otro',
    gente: entero(d.gente),
    unidad: deLista(d.unidad, ['sprinter', 'suburban', 'autobus']),
    destino: texto(d.destino),
    origen: texto(d.origen),
    salida: salida,
    regreso: regreso,
    soloIda: d.soloIda === true,
    ocasion: deLista(d.ocasion, ['fiesta', 'playa', 'boda', 'empresa',
      'escolar', 'peregrinacion', 'escapada', 'ciudad']),
    respuesta: respuestaSegura(d.respuesta)
  };
}

/* ------------------------------------------------------------
   EL CANDADO QUE NO DEPENDE DE QUE LA IA OBEDEZCA
   ------------------------------------------------------------
   Las instrucciones le PIDEN a la IA que no diga precios. Esto se
   asegura de que aunque las desobedezca —o aunque alguien le meta
   texto para convencerla de otra cosa— nada con cifras de dinero
   llegue al cliente.

   Un modelo se puede persuadir; una expresión regular no. Por eso
   la regla vive aquí abajo y no solo allá arriba: pedir es una
   cosa, impedir es otra.

   Si algo huele a precio, la respuesta se tira ENTERA y el bot
   contesta como si no hubiera IA. Perder una frase amable no
   cuesta nada; soltar un precio inventado cuesta un viaje.
   ------------------------------------------------------------ */
const HUELE_A_PRECIO = /\$|\bpesos?\b|\bmxn\b|\bmil\b|\bdesde\s+\d|\bcuesta\b|\bpreci|\bcotiza(?:cion|ción)\s+de\b|\d{3,}/i;

/* Y esto es lo que no puede afirmar de la empresa, porque no lo
   sabemos: años operando, tamaño de flota, permisos, cuántos
   grupos lleva. Cualquiera de ésas es un dato inventado. */
const AFIRMA_DE_MAS = /\b\d+\s*(?:a[nñ]os|unidades|autobuses|camiones|grupos|viajes)\b|\bpermiso\s+sct\b|\bcertificad|\bl[ií]der\b|\b(?:el|la)\s+mejor\b|\bnúmero\s+uno\b|\bgarantiz/i;

/* Ni anunciar que pasa con alguien: el bot vive dentro del chat
   del vendedor, no hay a quién pasar. */
const ANUNCIA_PASE = /te paso con|paso con (?:una persona|alguien)|un (?:vendedor|asesor|agente) te|te contactar[aá]|transfer/i;

function respuestaSegura(v) {
  if (typeof v !== 'string') return null;
  const s = v.trim().slice(0, 240);
  if (s.length < 8) return null;
  if (HUELE_A_PRECIO.test(s)) return null;
  if (AFIRMA_DE_MAS.test(s)) return null;
  if (ANUNCIA_PASE.test(s)) return null;
  return s;
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
        /* ------------------------------------------------------------
           OTRAS INSTRUCCIONES, CUANDO SE PIDEN
           ------------------------------------------------------------
           Las de aquí leen VIAJES. Los datos del contrato —nombre,
           direcciones, horas— se leen con otras, las de
           `_datos-contrato.js`, y por eso se pueden prestar.

           Con un solo prompt para las dos cosas, cada una contaminaría
           a la otra: un «vamos a Vallarta» se leería como dirección de
           destino, y una calle con número como cuántas personas van.

           Lo que NO cambia es todo lo demás: la misma clave, el mismo
           modelo, el mismo tope y el mismo «si falla, null». Un solo
           lugar por donde se le habla al modelo.
           ------------------------------------------------------------ */
        system: bloquesDelSistema(o.instrucciones, hoy),
        messages: [{ role: 'user', content: texto }]
      })
    });

    if (!r || !r.ok) {
      console.error('[entender] la IA contesto ' + (r && r.status));
      return null;
    }
    const cuerpo = await r.json();
    apuntaElCosto(cuerpo && cuerpo.usage, o.cliente);
    const dijo = cuerpo && cuerpo.content && cuerpo.content[0] && cuerpo.content[0].text;
    /* `crudo` devuelve el JSON sin pasarlo por `limpia`, que solo conoce
       los campos de un viaje y tiraría los de un contrato por no
       reconocerlos. Quien pide crudo limpia con SU limpiador — nunca se
       usa lo que devolvió el modelo sin limpiar por algún lado. */
    const json = sacaJSON(dijo);
    return o.crudo ? json : limpia(json);
  } catch (e) {
    /* Que la IA falle jamás puede tumbar al bot. */
    console.error('[entender] no se pudo: ' + e.message);
    return null;
  }
}

module.exports = {
  entiende, limpia, sacaJSON, instrucciones, respuestaSegura, MODELO,
  /* Para probar la forma de la llamada y el costo sin red. */
  instruccionesEstaticas, instruccionesDelDia, bloquesDelSistema,
  costoDeUso, costoDe, TARIFA
};
