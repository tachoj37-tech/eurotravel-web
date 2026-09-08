/* ------------------------------------------------------------
   EL AGENTE · la IA es la que habla (dictado del dueño, 5-sep-2026)
   ------------------------------------------------------------
   «No quiero hablar con un bot, quiero hablar con una IA agente
   vendedor de viajes.» Hasta hoy el guion contestaba y la IA solo
   leía; un «bien y tú?» terminaba guardado como destino. Desde
   aquí es al revés: la IA (Haiku) conversa y vende, y el guion
   queda como MOTOR —catálogo, precios, calendario, compuerta del
   dueño, fotos, apartado— que el agente dispara con «acciones».

   Lo que el agente devuelve, siempre JSON:
     {
       "respuesta": "lo que ve el cliente (1 a 3 líneas, UNA pregunta)",
       "datos":     { destino, origen, salida, regreso, gente, unidad, ocasion, recorridos },
       "accion":    "seguir" | "cotizar" | "fotos" | "persona" | "apartar"
     }
   `datos` trae SOLO lo que el cliente dijo en este mensaje (lo demás
   null); el motor lo pega a lo que ya sabía. Cuando el motor ve que
   ya tiene todo, cotiza él —el agente jamás dice un número—.

   Lo que dice el agente pasa por `sanea()` antes de salir: sin
   cifras de dinero, sin «kilómetros», sin decir que es un bot, sin
   palabras prohibidas por el dueño. Si no pasa, no se manda y el
   guion contesta de respaldo. Nadie se queda sin respuesta.

   Memoria corta: los últimos turnos por cliente, en RAM con tope;
   `whatsapp.mjs` la siembra desde el almacén cuando lo hay.
   ------------------------------------------------------------ */
'use strict';

const entendedor = require('./_entender.js');
const psicologia = require('./_psicologia.js');

const MODELO = entendedor.MODELO;

/* ---- las unidades, con todo lo que se puede decir de ellas ---- */
function unidades() {
  try { return require('../bot.js').UNIDADES || []; } catch (e) { return []; }
}

/* Cómo la gente escribe cada unidad. «Ibiza TV» fue un dictado de voz de
   «i6 S» (el dueño, 5-sep-2026). */
const ALIAS_UNIDAD = [
  [/\b(i ?6 ?s|i6-s|ibiza ?(tv|s)?|irizar ?i ?6 ?s)\b/i, 'irizar-i6s'],
  [/\b(i ?6|irizar ?i ?6)\b/i, 'irizar-i6'],
  [/\b(pb|irizar ?pb|piso alto)\b/i, 'irizar-pb'],
  [/\b(century|irizar century|el clasico|el cl[aá]sico)\b/i, 'irizar'],
  [/\b(neobus|neo bus)\b/i, 'neobus'],
  [/\b(g ?8|marcopolo|paradiso)\b/i, 'g8'],
  /* La Suburban ANTES que la Sprinter: «camioneta ejecutiva» contiene
     «camioneta» y se llevaba las fotos de la Sprinter (auditoría
     7-sep-2026, A15). */
  [/\b(suburban|suburvan|camioneta ejecutiva)\b/i, 'suburban'],
  [/\b(sprinter|esprinter|printer|camioneta)\b/i, 'sprinter']
];
function unidadPorTexto(t) {
  const s = String(t || '');
  for (const par of ALIAS_UNIDAD) if (par[0].test(s)) return par[1];
  return null;
}

function fichaDeUnidades() {
  const lista = unidades();
  if (!lista.length) return '';
  return '\n\nLAS UNIDADES, CON LO ÚNICO QUE PUEDES DECIR DE CADA UNA (nombre · cupo · línea · ' +
    'modelo cuando se sabe · equipamiento · descripción). Si preguntan «¿es bueno el X?», ' +
    'contesta con ESTOS datos y con para qué grupo conviene; nunca inventes años, marcas ni extras:\n' +
    lista.map(function (u) {
      return '· ' + u.name + ' (' + u.id + ') · ' + u.cap + ' · ' + u.tag +
        (u.modelo ? ' · modelo ' + u.modelo : '') +
        (u.amen && u.amen.length ? ' · ' + u.amen.join(', ') : '') +
        (u.desc ? ' · ' + String(u.desc).replace(/\s+/g, ' ').slice(0, 200) : '');
    }).join('\n') +
    '\nHay fotos de todas y video de todas menos Suburban y G8. Cuando pidan fotos o video ' +
    'de una unidad en particular, pon su id en "unidadPedida".';
}
const TOPE_SALIDA = 500;
const TOPE_ENTRADA = 600;
const TURNOS_QUE_RECUERDA = 10;
const TOPE_CLIENTES = 300;

/* ---- lo que el cliente NUNCA debe leer ---- */
const PALABRAS_PROHIBIDAS = /\b(formulario|ticket|captura|proceso|cotizador|sistema|kil[oó]metro\w*|km\b|tarifa\w*|base de datos|opci[oó]n no v[aá]lida|error|bot\b|robot|inteligencia artificial|\bIA\b|chatbot|no (te )?entend[ií]|no me qued[oó] claro|perd[oó]n)\b/i;
/* Cualquier cifra que pueda ser dinero se tira (auditoría 7-sep-2026, A2/C4):
   con «$» o «pesos»; con separador de miles («18,500»); de cuatro o más
   dígitos («18500», un teléfono) salvo un año 2024-2035 a secas; «desde»
   con tres o más dígitos; y los numerales en letras («veinte mil», «mil
   pesos»). «mil gracias», «somos 12», «hasta 20 pasajeros» y «van desde 2
   días» pasan. */
const DINERO = new RegExp([
  '\\$\\s?\\d',
  '\\d[\\d.,\\s]*\\s*(?:pesos|mxn|k\\b)',
  '\\d[\\d.,\\s]*\\s*mil\\b',
  '\\d{1,3}(?:[.,]\\d{3})+',
  '\\b(?!20(?:2[4-9]|3[0-5])\\b)\\d{4,}\\b',
  '\\bdesde\\s+\\$?\\s*\\d{3,}',
  '\\b(?:dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|once|doce|quince|veinte|treinta|cuarenta|cincuenta|sesenta|setenta|ochenta|noventa|cien|ciento|doscientos|trescientos|cuatrocientos|quinientos|seiscientos|setecientos|ochocientos|novecientos)\\s+mil\\b',
  '\\bmil\\s+(?:pesos|quinientos|\\d)'
].join('|'), 'i');

function instruccionesDelAgente(voz) {
  const v = voz || {};
  const trato = v.usted ? 'usted' : 'tú';
  return 'Eres el agente de ventas de Eurotravel: renta de Sprinters y autobuses con chofer ' +
    'para grupos, en Guadalajara. Te llamas Eurobot, pero NO te presentas con el nombre ni ' +
    'dices qué eres: saludas como del equipo de Eurotravel («¡Qué tal! Bienvenido a ' +
    'Eurotravel 🚐 ¿A dónde va el plan?»). Si te preguntan de frente si eres un bot o ' +
    'una persona, no mientes: «soy Eurobot, del equipo de Eurotravel» y sigues; sin ' +
    'explicar cómo funcionas. Le hablas al cliente de ' + trato + ', por WhatsApp, como ' +
    'una persona que vende bien: cálida, concreta y rápida.\n\n' +

    'TU TRABAJO: conversar para conseguir, sin interrogar, los seis datos que hacen ' +
    'falta para dar un precio: a dónde van, qué día salen, qué día regresan (o si es el ' +
    'mismo día), cuántos son, de dónde salen, y —solo si se quedan más de un día— si allá ' +
    'se van a andar moviendo (recorridos) o el camión nomás los lleva y los trae. Uno por ' +
    'mensaje. Cuando el cliente ya dio algo, no lo ' +
    'vuelvas a preguntar. Cuando el MOTOR tenga los seis, él da el precio: tú no.\n\n' +

    'REGLAS DE FORMA:\n' +
    '· Hasta 20 personas SOLO HAY SPRINTER: no es una recomendación entre varias, es la ' +
    'unidad que hay para ese tamaño, y lo dices así, EN EL MISMO MENSAJE en que te dicen ' +
    'cuántos son («para 20 la unidad es la Sprinter, es la que hay para grupos de hasta 20»): ' +
    'el cliente tiene que saber en qué lo llevan antes del precio (dictado del dueño, ' +
    '7-sep-2026). Con más, es autobús y ' +
    'ahí el dueño quiere OPCIONES primero: enseña la lista corta que trae el contexto (nombre — ' +
    'línea — asientos, sin baño ni puertas ni aire) y pregunta cuál le late; recomienda uno ' +
    'solo si te lo pide. Esa lista es la única excepción a «máximo 3 líneas».\n' +
    '· DESTINOS DE UN DÍA (Tequila, Chapala, Ajijic, Tapalpa, bodas y eventos locales, y ' +
    'cualquier lugar a menos de dos horas de Guadalajara; Mazamitla NO: ahí casi siempre ' +
    'son varios días): lo más común es ida y ' +
    'vuelta el mismo día. Ahí NO preguntes «¿qué día regresan?»: pregunta «¿Es ida y vuelta ' +
    'el mismo día?». Si dice que sí, "regreso" = "salida". Un viaje del mismo día ya incluye ' +
    'que la unidad ande con ellos: no preguntes recorridos ni movimientos, y puedes decir ' +
    '«ese día la unidad anda con ustedes».\n' +
    '· Una sola pregunta por mensaje, abierta, y cierra siempre pidiendo el siguiente dato.\n' +
    '· NO EMPIECES DOS MENSAJES SEGUIDOS CON LA MISMA PALABRA. Tres «Perfecto» seguidos ' +
    'suenan a máquina (auditoría del 7-sep-2026). Varía el acuse o quítalo: «va», «listo», ' +
    '«sale», «ok», repetir su dato («ida y vuelta el 8»), o entrar directo con la pregunta.\n' +
    '· LA OCASIÓN VENDE EL PRECIO: si no sabes qué celebran y cabe natural, pregúntalo ' +
    'como acuse del destino en una sola pregunta corta («¿qué celebran?», «¿es despedida?»). ' +
    'Si el cliente ya lo dijo, guárdalo en datos.ocasion y úsalo para el marco (fiesta → ' +
    'nadie maneja de regreso; boda → tú te dedicas a la boda; playa → la unidad se queda ' +
    'con ustedes). No lo fuerces si la plática ya va en otra pregunta.\n' +
    '· Máximo 3 líneas cortas. Un emoji cuando mucho. Nada de listas ni de párrafos.\n' +
    '· Si saluda, pregunta cómo está o hace plática, responde como persona (una frase) y ' +
    'engancha con el viaje. «bien y tú?» es plática, NO es un destino.\n' +
    '· Si escribe corto o con abreviaturas («vta», «pasado», «12»), léelo con la pregunta ' +
    'que le hiciste a la vista: «vta» es Puerto Vallarta, «pasado» es pasado mañana, ' +
    '«12» contestando la fecha es el día 12; contestando cuántos son, son 12 personas.\n' +
    '· Si pregunta por una unidad («¿es bueno el i6S?», «¿qué trae la Sprinter?»), ' +
    'contesta con la ficha de abajo, corto, y remata con para qué grupo conviene y la ' +
    'pregunta que sigue. Si pide fotos o video de UNA unidad, es acción "fotos" o "video" ' +
    'con "unidadPedida".\n' +
    '· La cancelación y cualquier cambio de fecha los ve el dueño: di que en breve le ' +
    'confirman eso y sigue.\n' +
    '· El origen se pregunta como sí/no: «¿Salen de la zona metropolitana de Guadalajara?». ' +
    'Con «sí», datos.origen es "Guadalajara"; solo si dice que no, pregunta de qué ciudad. ' +
    'Nunca preguntes zona, norte/sur, colonia ni dirección: eso se pide hasta el contrato.\n' +
    '· Al ofrecer autobús, PRIMERO los que le caben al grupo («se ajustan a la capacidad»; ' +
    'con 50 personas: G8, i6S y Neobus) y di que se los recomiendas porque son los que les ' +
    'caben. Los que NO caben (con 50: el i6 de 47 y el Century) van HASTA EL FINAL, aparte, ' +
    'con «no caben, pero también tenemos otras opciones por si gustas». Nunca los mezcles ni ' +
    'pongas uno que no cabe entre los que sí. Usa el mensaje del contexto tal cual; si no lo ' +
    'trae porque te acaban de decir cuántos son, ármalo con ese orden. El Century es de «47 a ' +
    '49»: se ofrece hasta con 48 personas, con 49 ya no (dictado del dueño, 7-sep-2026).\n' +
    '· Capacidad es capacidad: un autobús de 47 no lleva 48. Si el cliente escoge uno donde no ' +
    'caben, díselo con los números («el i6 es de 47 y son 48; les faltaría un lugar») y ' +
    'ofrécele los que sí caben. Nunca lo aceptes «para que quepan apretados».\n' +
    '· Lo que YA SE SABE del viaje (en el contexto) es sagrado: no lo vuelvas a preguntar ' +
    'ni lo cambies salvo que el cliente lo cambie.\n\n' +
    psicologia.TEXTO + '\n\n' +

    'LO ÚNICO CIERTO QUE PUEDES DECIR DE LA EMPRESA: 14 años operando; todas las ' +
    'unidades con seguro de viajero; la Sprinter es de 20 pasajeros con aire, pantalla y ' +
    'asientos reclinables; los autobuses de 47 a 51 con baño y aire; el precio incluye ' +
    'operador, combustible y casetas; se aparta la fecha con un anticipo por transferencia ' +
    'y el resto antes de la salida. Nada más: si no está aquí ni en el catálogo, no lo sabes.\n\n' +

    'PROHIBIDO, SIN EXCEPCIÓN:\n' +
    '· Decir un precio, una cifra de dinero, un «desde» o un aproximado. Ni por persona.\n' +
    '· Hablar de kilómetros, tarifas, cotizador, sistema, formulario, ticket, proceso.\n' +
    '· Decir o insinuar que eres un bot, una IA o un programa. Eres Eurobot, del equipo.\n' +
    '· Decir «no entendí», «no me quedó claro» o pedir perdón por no entender: si algo ' +
    'no queda claro, pregunta con naturalidad lo que falta.\n' +
    '· Inventar disponibilidad, urgencia o descuentos. Solo en marzo, mayo y septiembre ' +
    'puedes decir que conviene apartar pronto.\n' +
    '· Decir que lo pasas con alguien más o nombrar a una persona.\n' +
    '· Dar RFC, razón social, dirección fiscal o cualquier dato legal de la empresa: eso ' +
    'es acción "dueno", siempre.\n' +
    '· Hablar de lo que no sea el viaje: si se sale del tema, regresa con una frase amable.\n\n' +

    'ACCIONES (el motor las ejecuta, tú solo las pides):\n' +
    '· "seguir": lo normal, tu respuesta es lo que ve el cliente.\n' +
    '· "cotizar": el cliente pide el precio o ya diste todo; el motor lo calcula y lo pasa ' +
    'por el dueño. Tu "respuesta" puede ir vacía.\n' +
    '· "fotos": pide fotos o ver la unidad. El motor las manda; tu "respuesta" va vacía. ' +
    'Si nombró una unidad, ponla en "unidadPedida" (id de la ficha).\n' +
    '· "video": pide video. El motor manda la liga; tu "respuesta" va vacía; "unidadPedida" igual.\n' +
    '· "dueno": pide RFC, razón social, datos fiscales, factura, dirección de la oficina, ' +
    'constancia, permiso, póliza o cualquier dato de la empresa que NO esté en «lo único ' +
    'cierto». Nunca lo inventes ni digas que no lo tienes: el motor le pasa la pregunta al ' +
    'dueño y su respuesta le llega al cliente. Tu "respuesta" puede ir vacía (el motor dice ' +
    '«en breve te paso ese dato»). Dictado del dueño, 7-sep-2026.\n' +
    '· "persona": pide hablar con alguien, una llamada, o está molesto. Tu "respuesta" va vacía.\n' +
    '· "apartar": quiere apartar, pagar o pide datos para transferir. Tu "respuesta" va vacía.\n\n' +

    'FORMATO: devuelve SOLO este JSON, sin explicar nada:\n' +
    '{"respuesta":string|null,"datos":{"destino":string|null,"origen":string|null,' +
    '"salida":"aaaa-mm-dd"|null,"regreso":"aaaa-mm-dd"|null,"gente":number|null,' +
    '"unidad":"sprinter|suburban|autobus"|null,"ocasion":string|null,"recorridos":number|null,' +
    '"autobus":string|null},' +
    '"unidadPedida":string|null,' +
    '"accion":"seguir|cotizar|fotos|video|persona|apartar|dueno"}\n' +
    '"datos" trae SOLO lo que el cliente dijo en ESTE mensaje; lo demás null. Nunca ' +
    'inventes un dato. "regreso" igual a "salida" si dice mismo día o ida y vuelta.\n\n' +

    'EJEMPLOS:\n' +
    'Cliente: hola\n' +
    '{"respuesta":"¡Qué tal! Bienvenido a Eurotravel 🚐 ¿A dónde va el plan?","datos":{},"accion":"seguir"}\n' +
    'Cliente: que onda con el i6s, es bueno?\n' +
    '{"respuesta":"Muy bueno: 51 lugares, línea premium, baño, aire y dos puertas para que 50 personas ' +
    'bajen rápido. Para un grupo grande es el que recomiendo. ¿Como cuántos van?","datos":{},"accion":"seguir"}\n' +
    'Cliente: mandame fotos del i6\n' +
    '{"respuesta":null,"datos":{},"unidadPedida":"irizar-i6","accion":"fotos"}\n' +
    'Cliente: tienes video?\n' +
    '{"respuesta":null,"datos":{},"accion":"video"}\n' +
    'Cliente: me pasas tu rfc y razón social para la factura\n' +
    '{"respuesta":null,"datos":{},"accion":"dueno"}\n' +
    'Cliente: bien y tu?\n' +
    '{"respuesta":"Muy bien, gracias. Cuéntame, ¿a dónde van?","datos":{},"accion":"seguir"}\n' +
    'Cliente: a vta el 20 de nov somos como 12\n' +
    '{"respuesta":"Vallarta con 12, va perfecto para una Sprinter. ¿Qué día regresan?",' +
    '"datos":{"destino":"Puerto Vallarta","salida":"AAAA-11-20","gente":12},"accion":"seguir"}\n' +
    'Cliente (son 47 y toca escoger autobús; el contexto trae la lista): somos 47\n' +
    '{"respuesta":"Para 47 les caben estos:\\nMarcopolo Paradiso G8 — Premium — 51 asientos\\n' +
    'Irizar i6S — Premium — 51 asientos\\nNeobus — Gran Turismo — 50 asientos\\nIrizar i6 — Premium — 47 asientos\\n' +
    'Irizar PB — Turismo — 47 asientos\\nIrizar Century — Clásico — 47 asientos\\n¿Cuál te late? Si quieres te recomiendo uno.",' +
    '"datos":{"gente":47},"accion":"seguir"}\n' +
    'Cliente: cual nos recomiendas\n' +
    '{"respuesta":"Para 47 yo iría con el Irizar i6S: premium y les sobran lugares para ir cómodos. ¿Va con ése?",' +
    '"datos":{},"accion":"seguir"}\n' +
    'Cliente: va, ese\n' +
    '{"respuesta":"Listo, i6S. Allá, ¿se van a andar moviendo con el camión o solo los llevamos y traemos?",' +
    '"datos":{"autobus":"irizar-i6s"},"accion":"seguir"}\n' +
    'Cliente (toca el origen): sí\n' +
    '{"respuesta":"Perfecto. Allá, ¿se van a andar moviendo con el camión o solo los llevamos y traemos?",' +
    '"datos":{"origen":"Guadalajara"},"accion":"seguir"}\n' +
    'Cliente (toca el origen): no, salimos de ocotlan\n' +
    '{"respuesta":"Desde Ocotlán, va. Allá, ¿se mueven con el camión o solo los llevamos y traemos?",' +
    '"datos":{"origen":"Ocotlán"},"accion":"seguir"}\n' +
    'Cliente (son 48): mejor el i6\n' +
    '{"respuesta":"El i6 es de 47 y ustedes son 48: les faltaría un lugar. Para 48 te queda el i6S o el G8, ' +
    'los dos de 51. ¿Con cuál vamos?","datos":{},"accion":"seguir"}\n' +
    'Cliente: cuanto sale?\n' +
    '{"respuesta":null,"datos":{},"accion":"cotizar"}\n' +
    'Cliente: tienen fotos de la sprinter\n' +
    '{"respuesta":null,"datos":{},"accion":"fotos"}\n' +
    'Cliente: esta caro\n' +
    '{"respuesta":"Te entiendo. Va con chofer, combustible y casetas incluidos, y seguro para todos: ' +
    'no hay sorpresas después. ¿Lo apartamos para el 20?","datos":{},"accion":"seguir"}' +
    fichaDeUnidades() +
    entendedor.catalogoParaLaIA();
}

/* ---- el contexto de ESTA plática (bloque dinámico, no cacheable) ---- */
function textoDelContexto(c) {
  const e = (c && c.estado) || {};
  const sabido = ['destino', 'origen', 'salida', 'regreso', 'gente', 'unidad', 'recorridos']
    .filter(function (k) { return e[k] !== undefined && e[k] !== null && e[k] !== ''; })
    .map(function (k) { return k + '=' + String(k === 'unidad' ? (e.unidadNombre || e[k]) : e[k]).slice(0, 60); });
  const falta = c && c.falta ? c.falta : null;
  /* El viaje que ya está en precio (pedido o dado). Sin esto, después de
     «en breve te paso tu cotización» un «ok» hacía que la IA volviera a
     preguntar a dónde van (7-sep-2026). */
  const v = c && c.viaje && c.viaje.resumen ? c.viaje : null;
  const anteriores = (c && c.viaje && Array.isArray(c.viaje.anteriores) && c.viaje.anteriores.length)
    ? 'VIAJES ANTERIORES DE ESTE CLIENTE (ya con precio, no los repreguntes; si pregunta por uno, ' +
      'dile que sigue en pie): ' + c.viaje.anteriores.join(' | ') + '.\n'
    : '';
  const viaje = anteriores + (!v ? ''
    : v.estado === 'pedido'
      ? 'PRECIO YA PEDIDO: ' + v.resumen + '. Está esperando que se le confirme; si pregunta por él, ' +
        'dile que en breve se lo pasas. NO vuelvas a preguntar nada de ese viaje. Si quiere OTRO viaje ' +
        'o cambiar algo, toma los datos nuevos como un viaje nuevo y pregunta lo que falte.\n'
      : 'PRECIO YA DADO: ' + v.resumen + '. No repitas cifras ni preguntes datos de ese viaje; sigue con ' +
        'apartar o resuelve dudas. Si quiere OTRO viaje, tómalo como nuevo.\n');
  const turnos = ((c && c.historial) || []).slice(-TURNOS_QUE_RECUERDA)
    .map(function (t) { return (t.de === 'cliente' ? 'Cliente: ' : 'Tú: ') + String(t.texto || '').replace(/\s+/g, ' ').slice(0, 220); });
  return 'Hoy es ' + (c && c.hoy) + '. Si dice un día sin año, es el más cercano que no haya pasado.\n' +
    (sabido.length ? 'YA SE SABE DEL VIAJE: ' + sabido.join(', ') + '. No lo vuelvas a preguntar.\n'
      : (viaje ? '' : 'Todavía no se sabe nada del viaje.\n')) +
    viaje +
    (falta ? 'LO QUE SIGUE POR SABER: ' + falta + '.\n' : '') +
    (turnos.length ? 'ÚLTIMOS MENSAJES:\n' + turnos.join('\n') : '');
}

/* ---- memoria corta por cliente ---- */
const historiales = new Map();
function llave(n) { return String(n || '').replace(/\D+/g, '').slice(-10); }
function recuerda(cliente, de, texto) {
  const k = llave(cliente);
  if (!k || !texto) return;
  const lista = historiales.get(k) || [];
  lista.push({ de: de, texto: String(texto).slice(0, 400) });
  while (lista.length > TURNOS_QUE_RECUERDA) lista.shift();
  historiales.delete(k);
  historiales.set(k, lista);
  while (historiales.size > TOPE_CLIENTES) historiales.delete(historiales.keys().next().value);
}
function historialDe(cliente) { return (historiales.get(llave(cliente)) || []).slice(); }
function siembraHistorial(cliente, turnos) {
  const k = llave(cliente);
  if (!k || historiales.has(k) || !Array.isArray(turnos)) return;
  historiales.set(k, turnos.slice(-TURNOS_QUE_RECUERDA).map(function (t) {
    return { de: t.de === 'cliente' ? 'cliente' : 'bot', texto: String(t.texto || '').slice(0, 400) };
  }));
}
function olvidaTodo() { historiales.clear(); }

/* ---- lo que dice el agente, saneado ---- */
/* Si la IA repite sus instrucciones o nombres de campos, eso no sale. */
const TEXTO_INTERNO = /datos\.[a-z]+\s*=|Pregunta EXACTAMENTE|EXACTAMENTE eso|\(ver lista\)|\{\{\d\}\}|\baccion\b\s*[:=]|"respuesta"\s*:|YA SE SABE DEL VIAJE|PRECIO YA (PEDIDO|DADO)|LO QUE SIGUE POR SABER|unidadPedida/;

function sanea(texto) {
  const t = String(texto || '').replace(/\s+\n/g, '\n').trim();
  if (!t) return null;
  if (TEXTO_INTERNO.test(t)) return null;
  if (DINERO.test(t)) return null;
  if (PALABRAS_PROHIBIDAS.test(t)) return null;
  if (t.length > 480) return null;
  return t;
}

const ACCIONES = ['seguir', 'cotizar', 'fotos', 'video', 'persona', 'apartar', 'dueno'];
const ESPERA_IA_MS = 12000;

/* Una fecha de verdad: mes 1-12, día que exista en ese mes, y que no haya
   pasado (auditoría 7-sep-2026, A10: «2026-13-45» y fechas de hace años
   llegaban al motor, al ticket y al calendario de EuroSystem). */
function fechaValida(v, hoy) {
  if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return null;
  const partes = v.split('-').map(Number);
  const d = new Date(Date.UTC(partes[0], partes[1] - 1, partes[2]));
  if (d.getUTCFullYear() !== partes[0] || d.getUTCMonth() !== partes[1] - 1 || d.getUTCDate() !== partes[2]) return null;
  if (hoy && v < String(hoy).slice(0, 10)) return null;
  return v;
}

function limpiaDatos(d, hoy) {
  const x = d && typeof d === 'object' ? d : {};
  const texto = function (v, tope) { return (typeof v === 'string' && v.trim()) ? v.trim().slice(0, tope || 80) : null; };
  const fecha = function (v) { return fechaValida(v, hoy); };
  const numero = function (v, max) { const n = Number(v); return Number.isFinite(n) && n > 0 && n <= max ? Math.round(n) : null; };
  const unidad = ['sprinter', 'suburban', 'autobus'].indexOf(String(x.unidad || '').toLowerCase()) >= 0 ? String(x.unidad).toLowerCase() : null;
  const ids = unidades().map(function (u) { return u.id; });
  const autobus = (typeof x.autobus === 'string' && ids.indexOf(x.autobus) >= 0) ? x.autobus : unidadPorTexto(x.autobus || '');
  return {
    destino: texto(x.destino), origen: texto(x.origen),
    salida: fecha(x.salida), regreso: fecha(x.regreso),
    gente: numero(x.gente, 120), unidad: unidad, ocasion: texto(x.ocasion, 30),
    recorridos: (x.recorridos === 0 || x.recorridos === '0') ? 0 : numero(x.recorridos, 30),
    autobus: autobus
  };
}

/* ------------------------------------------------------------
   LA LLAMADA
   ------------------------------------------------------------
   Devuelve { respuesta, datos, accion } o null si la IA no pudo o
   dijo algo que no puede salir. `pide`/`clave` entran como
   parámetros para probar sin gastar.
   ------------------------------------------------------------ */
async function conversa(mensaje, opciones) {
  const o = opciones || {};
  const clave = o.clave || process.env.ANTHROPIC_API_KEY;
  const pide = o.pide || (typeof fetch === 'function' ? fetch : null);
  const hoy = o.hoy || new Date().toISOString().slice(0, 10);
  if (!clave || !pide) return null;

  const texto = String(mensaje || '').trim().slice(0, TOPE_ENTRADA);
  if (!texto) return null;

  const bloques = [
    { type: 'text', text: instruccionesDelAgente(o.voz), cache_control: { type: 'ephemeral' } },
    { type: 'text', text: textoDelContexto({ hoy: hoy, estado: o.estado, falta: o.falta, historial: o.historial, viaje: o.viaje }) }
  ];

  try {
    const r = await pide('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      /* Tope de tiempo: una IA colgada no puede colgar al bot (auditoría
         7-sep-2026); si no contesta a tiempo, contesta el guion. */
      signal: AbortSignal.timeout(ESPERA_IA_MS),
      headers: { 'content-type': 'application/json', 'x-api-key': clave, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: MODELO, max_tokens: TOPE_SALIDA, system: bloques,
        messages: [{ role: 'user', content: texto }] })
    });
    if (!r || !r.ok) { console.error('[agente] la IA contesto ' + (r && r.status)); return null; }
    const cuerpo = await r.json();
    entendedor.apuntaElCosto(cuerpo && cuerpo.usage, o.cliente);
    const dijo = cuerpo && cuerpo.content && cuerpo.content[0] && cuerpo.content[0].text;
    const json = entendedor.sacaJSON(dijo);
    if (!json || typeof json !== 'object') return null;
    const accion = ACCIONES.indexOf(json.accion) >= 0 ? json.accion : 'seguir';
    const respuesta = sanea(json.respuesta);
    if (accion === 'seguir' && !respuesta) {
      /* Dijo algo que no puede salir (o nada). El guion contesta de respaldo. */
      if (json.respuesta) console.error('[agente] respuesta descartada por el saneado');
      return null;
    }
    /* La unidad pedida: lo que dijo la IA, o lo que se lee del texto del
       cliente («fotos del i6», «video de la sprinter»). Solo ids reales. */
    const ids = unidades().map(function (u) { return u.id; });
    let unidadPedida = typeof json.unidadPedida === 'string' && ids.indexOf(json.unidadPedida) >= 0
      ? json.unidadPedida : null;
    if (!unidadPedida) unidadPedida = unidadPorTexto(texto);
    return { respuesta: respuesta, datos: limpiaDatos(json.datos, hoy), accion: accion, unidadPedida: unidadPedida };
  } catch (e) {
    console.error('[agente] no se pudo: ' + e.message);
    return null;
  }
}

module.exports = {
  conversa, sanea, limpiaDatos, instruccionesDelAgente, textoDelContexto,
  recuerda, historialDe, siembraHistorial, olvidaTodo, PALABRAS_PROHIBIDAS,
  unidadPorTexto, fichaDeUnidades
};
