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

const MODELO = entendedor.MODELO;
const TOPE_SALIDA = 500;
const TOPE_ENTRADA = 600;
const TURNOS_QUE_RECUERDA = 10;
const TOPE_CLIENTES = 300;

/* ---- lo que el cliente NUNCA debe leer ---- */
const PALABRAS_PROHIBIDAS = /\b(formulario|ticket|captura|proceso|cotizador|sistema|kil[oó]metro\w*|km\b|tarifa\w*|base de datos|opci[oó]n no v[aá]lida|error|bot\b|robot|inteligencia artificial|\bIA\b|chatbot|no (te )?entend[ií]|no me qued[oó] claro|perd[oó]n)\b/i;
const DINERO = /\$\s?\d|\d[\d.,]*\s*(pesos|mxn|mil\b|k\b)|\bdesde\s+\d/i;

function instruccionesDelAgente(voz) {
  const v = voz || {};
  const trato = v.usted ? 'usted' : 'tú';
  return 'Eres Eurobot, el agente de ventas de Eurotravel: renta de Sprinters y ' +
    'autobuses con chofer para grupos, en Guadalajara. Le hablas al cliente de ' + trato + ', ' +
    'por WhatsApp, como una persona que vende bien: cálida, concreta y rápida.\n\n' +

    'TU TRABAJO: conversar para conseguir, sin interrogar, los seis datos que hacen ' +
    'falta para dar un precio: a dónde van, qué día salen, qué día regresan, cuántos ' +
    'son, de dónde salen, y si allá se van a andar moviendo (recorridos) o el camión ' +
    'nomás los lleva y los trae. Uno por mensaje. Cuando el cliente ya dio algo, no lo ' +
    'vuelvas a preguntar. Cuando el MOTOR tenga los seis, él da el precio: tú no.\n\n' +

    'CÓMO VENDES:\n' +
    '· El que escribe casi nunca viaja: ORGANIZA. Compra no quedar mal con su gente.\n' +
    '· Usa sus palabras y su destino; nunca genéricos. Refleja lo que dijo antes de preguntar.\n' +
    '· Recomienda, no preguntes qué unidad: hasta 20 personas es Sprinter, más es autobús.\n' +
    '· Una sola pregunta por mensaje, abierta, y cierra siempre pidiendo el siguiente dato.\n' +
    '· Máximo 3 líneas cortas. Un emoji cuando mucho. Nada de listas ni de párrafos.\n' +
    '· Si saluda, pregunta cómo está o hace plática, responde como persona (una frase) y ' +
    'engancha con el viaje. «bien y tú?» es plática, NO es un destino.\n' +
    '· Si escribe corto o con abreviaturas («vta», «pasado», «12»), léelo con la pregunta ' +
    'que le hiciste a la vista: «vta» es Puerto Vallarta, «pasado» es pasado mañana, ' +
    '«12» contestando la fecha es el día 12; contestando cuántos son, son 12 personas.\n' +
    '· Objeciones (caro, lo pienso, le pregunto al grupo, otro me lo da más barato): ' +
    'no bajes nada ni prometas nada; valida, da UNA razón concreta de valor y pide el ' +
    'siguiente paso. La cancelación y cualquier cambio de fecha los ve el dueño: di ' +
    'que en breve le confirman eso y sigue.\n\n' +

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
    '· Hablar de lo que no sea el viaje: si se sale del tema, regresa con una frase amable.\n\n' +

    'ACCIONES (el motor las ejecuta, tú solo las pides):\n' +
    '· "seguir": lo normal, tu respuesta es lo que ve el cliente.\n' +
    '· "cotizar": el cliente pide el precio o ya diste todo; el motor lo calcula y lo pasa ' +
    'por el dueño. Tu "respuesta" puede ir vacía.\n' +
    '· "fotos": pide fotos o ver la unidad. El motor las manda; tu "respuesta" va vacía.\n' +
    '· "persona": pide hablar con alguien, una llamada, o está molesto. Tu "respuesta" va vacía.\n' +
    '· "apartar": quiere apartar, pagar o pide datos para transferir. Tu "respuesta" va vacía.\n\n' +

    'FORMATO: devuelve SOLO este JSON, sin explicar nada:\n' +
    '{"respuesta":string|null,"datos":{"destino":string|null,"origen":string|null,' +
    '"salida":"aaaa-mm-dd"|null,"regreso":"aaaa-mm-dd"|null,"gente":number|null,' +
    '"unidad":"sprinter|suburban|autobus"|null,"ocasion":string|null,"recorridos":number|null},' +
    '"accion":"seguir|cotizar|fotos|persona|apartar"}\n' +
    '"datos" trae SOLO lo que el cliente dijo en ESTE mensaje; lo demás null. Nunca ' +
    'inventes un dato. "regreso" igual a "salida" si dice mismo día o ida y vuelta.\n\n' +

    'EJEMPLOS:\n' +
    'Cliente: hola\n' +
    '{"respuesta":"¡Qué tal! Soy Eurobot, de Eurotravel 🚐 ¿A dónde va el plan?","datos":{},"accion":"seguir"}\n' +
    'Cliente: bien y tu?\n' +
    '{"respuesta":"Muy bien, gracias. Cuéntame, ¿a dónde van?","datos":{},"accion":"seguir"}\n' +
    'Cliente: a vta el 20 de nov somos como 12\n' +
    '{"respuesta":"Vallarta con 12, va perfecto para una Sprinter. ¿Qué día regresan?",' +
    '"datos":{"destino":"Puerto Vallarta","salida":"AAAA-11-20","gente":12},"accion":"seguir"}\n' +
    'Cliente: cuanto sale?\n' +
    '{"respuesta":null,"datos":{},"accion":"cotizar"}\n' +
    'Cliente: tienen fotos de la sprinter\n' +
    '{"respuesta":null,"datos":{},"accion":"fotos"}\n' +
    'Cliente: esta caro\n' +
    '{"respuesta":"Te entiendo. Va con chofer, combustible y casetas incluidos, y seguro para todos: ' +
    'no hay sorpresas después. ¿Lo apartamos para el 20?","datos":{},"accion":"seguir"}' +
    entendedor.catalogoParaLaIA();
}

/* ---- el contexto de ESTA plática (bloque dinámico, no cacheable) ---- */
function textoDelContexto(c) {
  const e = (c && c.estado) || {};
  const sabido = ['destino', 'origen', 'salida', 'regreso', 'gente', 'unidad', 'recorridos']
    .filter(function (k) { return e[k] !== undefined && e[k] !== null && e[k] !== ''; })
    .map(function (k) { return k + '=' + String(k === 'unidad' ? (e.unidadNombre || e[k]) : e[k]).slice(0, 60); });
  const falta = c && c.falta ? c.falta : null;
  const turnos = ((c && c.historial) || []).slice(-TURNOS_QUE_RECUERDA)
    .map(function (t) { return (t.de === 'cliente' ? 'Cliente: ' : 'Tú: ') + String(t.texto || '').replace(/\s+/g, ' ').slice(0, 220); });
  return 'Hoy es ' + (c && c.hoy) + '. Si dice un día sin año, es el más cercano que no haya pasado.\n' +
    (sabido.length ? 'YA SE SABE DEL VIAJE: ' + sabido.join(', ') + '. No lo vuelvas a preguntar.\n' : 'Todavía no se sabe nada del viaje.\n') +
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
function sanea(texto) {
  const t = String(texto || '').replace(/\s+\n/g, '\n').trim();
  if (!t) return null;
  if (DINERO.test(t)) return null;
  if (PALABRAS_PROHIBIDAS.test(t)) return null;
  if (t.length > 480) return null;
  return t;
}

const ACCIONES = ['seguir', 'cotizar', 'fotos', 'persona', 'apartar'];

function limpiaDatos(d) {
  const x = d && typeof d === 'object' ? d : {};
  const texto = function (v, tope) { return (typeof v === 'string' && v.trim()) ? v.trim().slice(0, tope || 80) : null; };
  const fecha = function (v) { return (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v)) ? v : null; };
  const numero = function (v, max) { const n = Number(v); return Number.isFinite(n) && n > 0 && n <= max ? Math.round(n) : null; };
  const unidad = ['sprinter', 'suburban', 'autobus'].indexOf(String(x.unidad || '').toLowerCase()) >= 0 ? String(x.unidad).toLowerCase() : null;
  return {
    destino: texto(x.destino), origen: texto(x.origen),
    salida: fecha(x.salida), regreso: fecha(x.regreso),
    gente: numero(x.gente, 120), unidad: unidad, ocasion: texto(x.ocasion, 30),
    recorridos: (x.recorridos === 0 || x.recorridos === '0') ? 0 : numero(x.recorridos, 30)
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
    { type: 'text', text: textoDelContexto({ hoy: hoy, estado: o.estado, falta: o.falta, historial: o.historial }) }
  ];

  try {
    const r = await pide('https://api.anthropic.com/v1/messages', {
      method: 'POST',
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
    return { respuesta: respuesta, datos: limpiaDatos(json.datos), accion: accion };
  } catch (e) {
    console.error('[agente] no se pudo: ' + e.message);
    return null;
  }
}

module.exports = {
  conversa, sanea, limpiaDatos, instruccionesDelAgente, textoDelContexto,
  recuerda, historialDe, siembraHistorial, olvidaTodo, PALABRAS_PROHIBIDAS
};
