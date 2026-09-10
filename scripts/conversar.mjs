/* ============================================================
   CINCO CONVERSACIONES CON EL MODELO DE VERDAD (8-sep-2026)
   ============================================================
   «Que el agente deje de sonar a guion»: corre el bot con sus módulos
   reales y la IA REAL (Haiku), con Meta de mentiras, y escribe las
   transcripciones. El cliente es un guion de mensajes por escenario.

   Lo corre el dueño en su máquina, con su llave (la llave no sale de ahí):

     $env:ANTHROPIC_API_KEY="sk-ant-..."; node scripts/conversar.mjs
     node scripts/conversar.mjs a        (solo el escenario a)

   Cada turno cuesta ~$0.002 con caché; los cinco escenarios, menos de
   $0.30. No manda nada a WhatsApp ni escribe en Supabase.
   ============================================================ */
import path from 'path';
import fs from 'fs';
import { fileURLToPath, pathToFileURL } from 'url';
import { createHmac } from 'crypto';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.join(AQUI, '..');
/* La llave también puede vivir en `.env.local` (está en .gitignore: nunca
   sube al repositorio), una línea: ANTHROPIC_API_KEY=sk-ant-... Así las
   conversaciones reales se pueden correr desde una terminal sin pegar la
   llave en ningún chat (8-sep-2026). */
if (!process.env.ANTHROPIC_API_KEY) {
  try {
    const local = fs.readFileSync(path.join(RAIZ, '.env.local'), 'utf8');
    const m = local.match(/^\s*ANTHROPIC_API_KEY\s*=\s*["']?([^"'\r\n]+)["']?\s*$/m);
    if (m) process.env.ANTHROPIC_API_KEY = m[1].trim();
  } catch (e) { /* sin archivo: se avisa abajo */ }
}
if (!process.env.ANTHROPIC_API_KEY) { console.error('Falta ANTHROPIC_API_KEY en el entorno o en .env.local.'); process.exit(2); }

process.env.WHATSAPP_APP_SECRET = 'secreto';
process.env.WHATSAPP_TOKEN = 'tok';
process.env.WHATSAPP_PHONE_ID = '111';
process.env.WHATSAPP_VERIFY_TOKEN = 'v';
process.env.DUENO_WHATSAPP = '5213311112222';
process.env.CONFIRMAR_PRECIOS = '1';
process.env.AGENTE_IA = '1';
process.env.SITIO_URL = 'https://eurotravel-web.vercel.app';
process.env.CLABE = process.env.CLABE || '012320001927217407';
process.env.CUENTA = process.env.CUENTA || '0192721740';
process.env.DATOS_BANCARIOS = process.env.DATOS_BANCARIOS || 'BBVA Bancomer · a nombre de Turismo ET, S.A. de C.V.';
/* Llave de mentiras: la puerta de contratos de aquí abajo es de mentiras
   también, así que no toca EuroSystem de verdad. */
process.env.CONTRATOS_API_KEY = 'llave-de-mentiras';
/* Como en producción desde el 10-sep-2026: el bot llega hasta la cotización
   y ahí el chat pasa a una persona, que dispara lo demás con sus botones. */
process.env.BOT_HASTA_COTIZACION = process.env.BOT_HASTA_COTIZACION || '1';
delete process.env.ALMACEN_URL; delete process.env.ALMACEN_CLAVE;

/* Tope de gasto (dictado del dueño, 8-sep-2026: «solo usa 1 dólar para
   pruebas»). El agente imprime `usd=` en cada llamada; aquí se suma y al
   pasar el tope el script se detiene. Las líneas [ia] y [turno] no se
   imprimen: la transcripción se lee mejor sin ellas. */
const TOPE_USD = Number(process.env.TOPE_USD || 1);
let gastado = 0;
for (const k of ['log', 'error']) {
  const original = console[k].bind(console);
  console[k] = function () {
    const s = Array.prototype.map.call(arguments, String).join(' ');
    const m = s.match(/\busd=(\d+(?:\.\d+)?)/);
    if (m) {
      gastado += Number(m[1]);
      if (gastado > TOPE_USD) {
        original('\n⛔ Tope de $' + TOPE_USD + ' USD alcanzado (gastado $' + gastado.toFixed(3) + '). Me detengo.');
        process.exit(3);
      }
      return;
    }
    /* Con VER_TURNOS=1 salen los turnos crudos: sirve para ver QUÉ dijo el
       modelo cuando un candado descarta su respuesta. */
    if (/^\[turno\]/.test(s) && process.env.VER_TURNOS !== '1') return;
    original.apply(console, arguments);
  };
}

const fetchReal = globalThis.fetch;
let mandados = [];
let contratos = [];
globalThis.fetch = async function (url, opciones) {
  const u = String(url);
  if (u.indexOf('graph.facebook.com') !== -1) {
    mandados.push(JSON.parse(opciones.body));
    return { ok: true, status: 200, json: async () => ({ messages: [{ id: 'wamid.s' + mandados.length }] }), text: async () => '{}' };
  }
  if (u.indexOf('api.anthropic.com') !== -1) return fetchReal(url, opciones);
  /* EuroSystem de mentiras: contesta como la puerta real de contratos, para
     poder ver el PDF llegando al cliente y al dueño sin registrar nada en el
     sistema de verdad. El cuerpo se guarda para revisarlo. */
  if (u.indexOf('/api/contratos/externo') !== -1) {
    contratos.push(JSON.parse(opciones.body));
    const folio = 50000 + contratos.length;
    console.log('\n[EuroSystem de mentiras] contrato registrado · folio ' + folio +
      ' · tipoViaje=' + ((JSON.parse(opciones.body).servicio || {}).tipoViaje || '—') +
      ' · pasajeros=' + ((JSON.parse(opciones.body).servicio || {}).pasajeros || '—'));
    return {
      ok: true, status: 201,
      json: async () => ({ folio: folio, urlPdf: 'https://eurosystem.site/api/contratos/x' + folio + '/pdf?t=firma', contratoId: 'c' + folio, estado: 'BORRADOR', repetido: false }),
      text: async () => '{}'
    };
  }
  return { ok: false, status: 500, json: async () => ({}), text: async () => 'sin red' };
};

const atiende = (await import(pathToFileURL(path.join(RAIZ, 'api', 'whatsapp.mjs')).href)).default;
const webhook = (await import(pathToFileURL(path.join(RAIZ, 'api', '_whatsapp-webhook.js')).href)).default;
const agente = (await import(pathToFileURL(path.join(RAIZ, 'api', '_agente.js')).href)).default;
const tk = (await import(pathToFileURL(path.join(RAIZ, 'api', '_tickets.js')).href)).default;
const DUENO = process.env.DUENO_WHATSAPP;

let n = 0;
function firma(c) { return 'sha256=' + createHmac('sha256', 'secreto').update(c).digest('hex'); }
function mismo(a, b) { return String(a || '').replace(/\D/g, '').slice(-10) === String(b || '').replace(/\D/g, '').slice(-10); }
async function manda(de, texto, extra) {
  n++;
  const cuerpo = JSON.stringify({ entry: [{ changes: [{ value: { metadata: { phone_number_id: '111' },
    contacts: [{ wa_id: de, profile: { name: 'Cliente' } }],
    messages: [Object.assign({ id: 'wamid.c' + n, from: de, type: 'text', text: { body: texto } }, extra || {}) ] } }] }] });
  await atiende(new Request('https://x/api/whatsapp', { method: 'POST', body: cuerpo, headers: { 'x-hub-signature-256': firma(cuerpo) } }));
}
function ultimoTicket() {
  let idx = -1; mandados.forEach((m, i) => { if (mismo(m.to, DUENO) && /Precio por confirmar/.test((m.text && m.text.body) || '')) idx = i; });
  return idx >= 0 ? 'wamid.s' + (idx + 1) : null;
}
/* Cómo se ve un mensaje en el teléfono: texto, foto, o el PDF del contrato
   (que desde el 9-sep-2026 va como archivo, no como liga). */
function comoSeVe(m) {
  if (m.text && m.text.body) return m.text.body;
  if (m.image) return '[foto ' + (m.image.link || 'del cliente') + '] ' + (m.image.caption || '');
  if (m.document) return '[PDF ' + (m.document.filename || m.document.link) + '] ' + (m.document.caption || '');
  return JSON.stringify(m);
}

async function corre(nombre, C, guion) {
  webhook.olvidaTodo(); agente.olvidaTodo(); tk.olvidaTodo(); mandados = []; contratos = [];
  console.log('\n══════════ ' + nombre + ' ══════════');
  for (const paso of guion) {
    const antes = mandados.length;
    if (typeof paso === 'function') { await paso(); }
    else { console.log('\nCLIENTE: ' + paso); await manda(C, paso); }
    for (const m of mandados.slice(antes)) {
      if (mismo(m.to, C)) console.log('BOT:     ' + comoSeVe(m).replace(/\n/g, '\n         '));
      /* El mensaje al dueño COMPLETO: es lo que él va a leer en su
         teléfono, y con una sola línea no se puede revisar. */
      else if (mismo(m.to, DUENO)) {
        console.log('→ DUEÑO:  ' + comoSeVe(m).replace(/\n/g, '\n          '));
      }
    }
  }
}
const va = (C) => async () => {
  const t = ultimoTicket();
  if (!t) { console.log('(sin ticket que contestar)'); return; }
  console.log('\nDUEÑO contesta el ticket: va');
  await manda(DUENO, 'va', { context: { id: t } });
};
/* El dueño contesta el ticket con «no hay»: no hay unidad esa fecha. */
const noHay = () => async () => {
  const t = ultimoTicket();
  if (!t) { console.log('(sin ticket que contestar)'); return; }
  console.log('\nDUEÑO contesta el ticket: no hay unidad para esa fecha');
  await manda(DUENO, 'no hay unidad para esa fecha', { context: { id: t } });
};
/* El dueño autoriza la transferencia contestando el comprobante que le
   reenvió el bot, que es como lo va a hacer en su teléfono. */
const apruebaPago = () => async () => {
  let idx = -1;
  mandados.forEach((m, i) => { if (mismo(m.to, DUENO)) idx = i; });
  if (idx < 0) { console.log('(no hay nada del dueño que contestar)'); return; }
  console.log('\nDUEÑO contesta el comprobante: va   (autoriza la transferencia)');
  await manda(DUENO, 'va', { context: { id: 'wamid.s' + (idx + 1) } });
};
/* El dueño escribe una orden suya (relevo, total, etc.). */
const dueno = (texto) => async () => {
  console.log('\nDUEÑO: ' + texto);
  await manda(DUENO, texto);
};
/* El cliente manda una foto (el comprobante del depósito). */
const foto = (C) => async () => {
  console.log('\nCLIENTE: [foto del comprobante]');
  await manda(C, '', { type: 'image', image: { id: 'media-' + Date.now(), mime_type: 'image/jpeg' } });
};
/* El dueño contesta con «va» el ÚLTIMO mensaje suyo que hable de lo que se
   le pide (los datos del contrato, la transferencia). Es como lo hace en el
   teléfono: busca ese mensaje y lo cita. */
const autoriza = (patron, etiqueta) => async () => {
  let idx = -1;
  mandados.forEach(function (m, i) {
    if (mismo(m.to, DUENO) && patron.test(comoSeVe(m))) idx = i;
  });
  if (idx < 0) { console.log('\n(⚠️ el dueño NO recibió nada de «' + etiqueta + '»: no hay qué autorizar)'); return; }
  console.log('\nDUEÑO contesta «' + etiqueta + '»: va');
  await manda(DUENO, 'va', { context: { id: 'wamid.s' + (idx + 1) } });
};
const autorizaDatos = () => autoriza(/ficha|datos del contrato|autorizar estos datos/i, 'los datos del contrato');
const autorizaTransferencia = () => autoriza(/verificar la transferencia|comprobante/i, 'la transferencia');

/* Los botones del dueño con el chat ya en sus manos: contesta cualquier
   mensaje suyo sobre ese cliente con una palabra. */
const boton = (palabra) => async () => {
  let idx = -1;
  mandados.forEach(function (m, i) { if (mismo(m.to, DUENO)) idx = i; });
  if (idx < 0) { console.log('\n(⚠️ no hay mensaje del dueño que contestar para «' + palabra + '»)'); return; }
  console.log('\nDUEÑO aprieta el botón: ' + palabra);
  await manda(DUENO, palabra, { context: { id: 'wamid.s' + (idx + 1) } });
};

/* El dueño contesta el ticket de un autobús con el precio. */
const precio = (monto) => async () => {
  const t = ultimoTicket();
  if (!t) { console.log('(sin ticket que contestar)'); return; }
  console.log('\nDUEÑO contesta el ticket: ' + monto);
  await manda(DUENO, String(monto), { context: { id: t } });
};

const escenarios = {
  a: ['hola buenas, ocupo cotisar un viaje a bta el 20 d octubre regresamos el 22 somos como 18 salimos d gdl, cuanto?', 'solo nos llevan y traen', 'ok'],
  b: ['hola! es que mi hermano se casa y le queremos hacer su despedida', 'pues estamos pensando en tequila, dicen que está padre', 'es que todavía no sabemos bien la fecha, pero mi mamá dice que el 18 de octubre', 'vamos como 14, aunque mi tío nunca confirma jaja', 'sí, todos de aquí de guadalajara', 'sí, ese mismo día regresamos', 'ok'],
  c: ['a mazatlán del 10 al 12 de octubre, 30 personas, desde guadalajara, solo nos llevan y traen', 'el neobus', 'oye y quién va a manejar?', 'y si se nos cancela?', 'tienen seguro?', 'me pueden facturar?', 'y si cambio la fecha después?', 'ok déjame ver con el grupo'],
  d: [async () => {
    /* Apartó hace meses: ficha con precio dado y comprobante recibido. */
    tk.anotaEtapa('5213366679004', 'mando_comprobante', { total: 19000, anticipo: 4000,
      viajeDatos: { origen: 'Guadalajara', destino: 'Puerto Vallarta', salida: '2026-11-14', regreso: '2026-11-16', gente: 18, unidad: 'Sprinter', nombre: 'Mariana' } }, Date.now());
  }, 'hola, cómo va lo mío?', 'y mi contrato ya está?', 'oye, creo que vamos a cambiar la fecha al 21 de noviembre', 'ok gracias'],
  e: ['a vallarta el 20 de octubre, regresamos el 22, somos 18, de guadalajara, solo nos llevan y traen', va('5213366679005'), 'lo voy a pensar', 'es que no sé, lo voy a pensar', 'bueno va, apártamelo'],
  /* f · lo que el dueño probó el 8-sep a las 6 p.m.: organiza, no sabe
     cuántos, quiere ver camiones, escoge el i6 y reserva. */
  f: ['buenas tardes', 'quiero cotizar un viaje a Sayulita', 'salimos pasado y quiero un camión', 'que camiones tiene?', 'i6', 'quiero reservar', 'si', 'sí, de guadalajara', precio(28000), 'ok apártamelo'],
  /* g · el que no sabe nada todavía y pregunta de todo antes de dar datos. */
  g: ['hola', 'oigan qué camiones manejan?', 'el más nuevo cuál es?', 'y ese cuánto sale a puerto vallarta?', 'todavía no sé cuántos vamos, apenas estoy juntando gente', 'el 3 de octubre y regresamos el 5', 'mándame fotos', 'ok luego les digo'],
  /* h · el cliente difícil: escribe mal, pide por persona, pide descuento,
     pregunta si es robot y se va por la tangente. */
  h: ['kiero 1 camion pa tekila el sabado', 'somos 40', 'sale mucho, cuanto x persona?', 'no me puedes hacer un descuento?', 'eres un robot vdd?', 'y si llueve q pasa', 'oye y venden boletos a monterrey', 'ah ok, luego te aviso'],
  /* i · agencia: habla de pax y neto, pide factura y varias fechas. */
  i: ['buen día, cotización para 45 pax GDL–Mazatlán, 10 al 12 de octubre, unidad ejecutiva', 'requiero tarifa neta y si manejan comisión', 'facturan? y me mandan póliza de seguro', 'el i6s está bien', 'ok quedo al pendiente del neto'],
  /* j · lo que nadie debe contestar de memoria: papeles, permisos, alcohol,
     mascotas, y un dato personal que el bot no debe pedir. */
  j: ['hola, es para un viaje de la escuela a Tapalpa', 'somos 44 alumnos y 4 maestros, el 17 de octubre ida y vuelta', 'me pasas tu RFC y razón social para la factura?', 'traen permiso federal de la SCT?', 'los muchachos pueden llevar cerveza?', 'y si llevamos un perro guía?', 'ok gracias'],
  /* k · después del precio cambia el grupo y regatea. */
  k: ['a chapala el 25 de octubre, ida y vuelta, somos 15, salimos de guadalajara, solo nos llevan y traen', va('5213366679011'), 'oye ya somos 22', 'y ahora cuánto sale?', 'está muy caro, el otro me lo dio en 8 mil', 'va pues, apártamelo'],
  /* l · el comprobante: manda la foto y luego dicta sus datos del contrato. */
  l: ['a tapalpa el 8 de noviembre, ida y vuelta, somos 16, de guadalajara, solo nos llevan y traen', va('5213366679012'), 'apártamelo', foto('5213366679012'),
    'soy Ricardo Núñez Salas', 'nos recogen en av. vallarta 1234, col. americana, a las 7 de la mañana', 'llegamos al hotel casa serena en tapalpa y nos regresamos a las 6 de la tarde'],
  /* m · ráfaga, cambio de destino a media cotización y pedir una persona. */
  m: ['hola', 'quiero cotizar', 'para el 15 de noviembre', 'somos 12', 'oye mejor cambiemos a mazamitla', 'de guadalajara', 'mejor quiero hablar con una persona'],
  /* n · viaje largo con recorridos: CDMX cuatro días. */
  n: ['a la ciudad de méxico del 5 al 8 de diciembre, somos 40, salimos de guadalajara', 'el neobus', 'sí, allá nos vamos a mover', 'dos días', 'por la zona', 'hasta 10 horas', 'sí, cotiza'],
  /* o · fecha encima y temporada alta. */
  o: ['necesito una sprinter para pasado mañana a chapala, somos 14, de guadalajara, ida y vuelta', 'sí, es urgente', 'y para el sábado de mayo que viene tienen?'],
  /* p · el relevo: el dueño toma el chat con «yo» y lo devuelve con «bot». */
  p: ['hola, quiero cotizar a mazatlán', 'somos 30, del 12 al 14 de diciembre, de guadalajara', dueno('3366679016 yo'),
    'oiga y me da un descuento si pago todo hoy?', dueno('3366679016 bot'), 'bueno, entonces el neobus'],
  /* q · dos viajes: pide otro sin haber cerrado el primero. */
  q: ['a tequila el 17 de octubre, ida y vuelta, somos 18, de guadalajara, solo nos llevan y traen', va('5213366679017'),
    'oye y aparte quiero cotizar otro a san juan de los lagos el 24, somos 40', 'de guadalajara también, ida y vuelta, solo nos llevan y traen', 'el i6s'],
  /* r · mensajes basura: emoji solo, un número suelto, un link, una sola letra. */
  r: ['👍', '3', 'https://www.google.com/maps/place/Tapalpa', 'k', 'ya mejor dime cuánto sale una sprinter a tapalpa el 20 de octubre para 15, de guadalajara, ida y vuelta'],
  /* s · LA COTIDIANA COMPLETA, de «buenas tardes» hasta el contrato.
     Es la que el dueño pidió: llega a que le pasen la cuenta, deposita,
     manda el comprobante y da sus datos. Va despacio, como escribe la
     gente: un dato por mensaje, con preguntas en medio. */
  s: ['buenas tardes', 'quiero información para un viaje', 'a puerto vallarta',
    'del 6 al 8 de noviembre', 'somos 16', 'sí, de guadalajara', 'solo nos llevan y traen',
    'qué incluye?', 'me mandas fotos?',
    va('5213366679019'),
    'ok, y cómo le hago para apartar?', foto('5213366679019'),
    'ya deposité, ahí te va el comprobante',
    'me llamo Laura Beltrán Ríos', 'nos recogen en av. patria 2050, zapopan, a las 6 de la mañana',
    'llegamos al hotel playa bonita en vallarta, y de regreso salimos a las 5 de la tarde',
    'ya quedó todo?'],
  /* t · LA MISMA, pero con AUTOBÚS: el precio no lo calcula el motor, lo
     pone el dueño escribiendo un número al ticket. Es el caso que el dueño
     quiere ver: que le llegue el precio a él, que lo confirme, y que le
     llegue bien al cliente. Sigue hasta el contrato. */
  t: ['buenas tardes, ocupo un camión', 'a mazatlán', 'del 20 al 22 de noviembre', 'somos 38',
    'sí, de guadalajara', 'solo nos llevan y traen', 'el i6s',
    precio(46500),
    '¿a qué cuenta les deposito?', foto('5213366679020'),
    'ya está el depósito', 'soy Óscar Medina Tapia',
    'nos recogen en calle hidalgo 45, tlaquepaque, a las 5 de la mañana',
    'llegamos al hotel las palmas en mazatlán y de regreso salimos a la 1 de la tarde'],
  /* u · las TRES autorizaciones del dueño, tal como las dictó el 9-sep:
     el «no hay» de disponibilidad, el precio, la transferencia y el
     contrato. Destino sencillo, sin direcciones hasta después del pago. */
  u: ['hola, ocupo una sprinter de ocotlán a tequila el 24 de octubre, ida y vuelta, somos 14, solo nos llevan y traen',
    noHay(), 'ah caray, y para el 31 de octubre?', 'sí, el mismo, ida y vuelta el mismo día',
    precio(9800),
    'va, ahí les deposito', foto('5213366679021'), apruebaPago(),
    'soy Norma Aguilar Ceja', 'nos recogen en morelos 210, ocotlán, a las 7 de la mañana',
    'llegamos a la plaza principal de tequila y salimos de regreso a las 7 de la noche'],

  /* ============================================================
     LA TANDA DEL 9-SEP-2026 (v–z)
     ============================================================
     Dictado del dueño: «actúa como un tonto: pregunta, pruébalo, no le
     hagas caso al chatbot, usa faltas de ortografía, equivócate, haz
     preguntas. Quiero que esto sea prueba de todo». Y de paso se prueban
     las tres cosas nuevas: las dos autorizaciones seguidas, el PDF que
     llega como archivo, y el viaje sencillo.
     ============================================================ */

  /* v · el que escribe pésimo y no contesta lo que se le pregunta. */
  v: ['ola', 'kiero saber precios', 'pss no se, a donde recomiendan',
    'aaa ok y a vallarta ke tal', 'no se cuantos vamos todavia', 'ay no se, como 20 o 30, depende',
    'y kuanto cuesta mas o menos?', 'ta caro no?', 'oye tienen wifi?',
    'aaa mira, es del 13 al 15 de noviembre', 'de gdl', 'nomas nos llevan y traen',
    'ke onda ya?'],

  /* w · VIAJE SENCILLO de verdad, hasta el contrato. Se revisa que el
     contrato salga SENCILLO y que el PDF le llegue a los dos. */
  w: ['buenas, ocupo una sprinter de guadalajara a tequila el 12 de noviembre, solo de ida, somos 15',
    'no, nada mas la ida, allá nos quedamos', 'sí, solo nos llevan',
    va('5213366679022'),
    'va, cómo le hago para apartar', foto('5213366679022'),
    'ya deposité', autorizaTransferencia(),
    'soy Fernando Ibarra Luna', 'nos recogen en av. lópez mateos 3000, zapopan, a las 8 de la mañana',
    'llegamos al hotel casa tequila, no hay regreso',
    autorizaDatos(), autorizaTransferencia(),
    'ya me llegó todo?'],

  /* x · el que no hace caso: le preguntan una cosa y contesta otra, tres
     veces seguidas, y manda el comprobante ANTES de tener precio. */
  x: ['hola quiero un camión para mi grupo', 'para un evento', 'es una boda',
    'a san miguel de allende', 'no me acuerdo bien de la fecha', 'ah sí, el 28 de noviembre',
    foto('5213366679023'),
    'ya te mandé el comprobante', 'regresamos el 30', 'somos 45', 'de guadalajara',
    'solo nos llevan y traen', 'el paradiso', precio(62000), 'órale, va'],

  /* y · LA COTIDIANA COMPLETA hasta el PDF, con las dos autorizaciones
     seguidas, que es como el dueño dijo que las va a dar. */
  y: ['buenas tardes, quiero cotizar', 'a puerto vallarta', 'del 4 al 6 de diciembre',
    'somos 17', 'sí, de guadalajara', 'nada más nos llevan y traen',
    va('5213366679024'),
    'va, apártamelo', foto('5213366679024'),
    'ya está el depósito', autorizaTransferencia(),
    'soy Adriana Ponce Vega', 'nos recogen en niños héroes 1500, guadalajara, a las 6 de la mañana',
    'llegamos al hotel villa del mar y de regreso salimos a las 4 de la tarde',
    autorizaDatos(),
    'ya quedó?'],

  /* z · el que se equivoca y corrige a media plática, regatea, deposita de
     menos y pregunta lo mismo tres veces. */
  z: ['a mazamitla el 15 de noviembre, somos 12, de guadalajara, ida y vuelta',
    'ay no, perdón, es el 15 de diciembre no de noviembre', 'sí, ida y vuelta el mismo día',
    'solo nos llevan y traen',
    va('5213366679025'),
    'está caro', 'no me lo dejas en 6 mil?', 'y si somos 10?',
    'bueno va', 'oye ya te dije que sí, dónde deposito', 'perdón, otra vez la cuenta?',
    'ya deposité pero nomás mandé la mitad', 'ok gracias'],

  /* ============================================================
     LA TANDA DEL 9-SEP-2026, SEGUNDA VUELTA (aa–ae)
     ============================================================
     Con la regla nueva de la cuenta: sale una vez, y un «apártamelo»
     después recibe la petición del depósito, no la CLABE otra vez.
     ============================================================ */

  /* aa · el insistente: pide apartar cuatro veces sin depositar. */
  aa: ['hola, quiero cotizar a tequila el 18 de octubre, ida y vuelta el mismo día, somos 14, de guadalajara, solo nos llevan y traen',
    va('5213366679027'),
    'apártamelo', 'sí apártamelo porfa', 'oye ya te dije que lo apartes',
    'bueno y a qué cuenta deposito?', 'ah ok, ya la vi', 'apártamelo ya'],

  /* ab · el desconfiado: pregunta si es seguro, pide comprobante de la
     empresa, quiere hablar con alguien, y al final deposita. */
  ab: ['buenas, ando viendo para un viaje a manzanillo el 21 de noviembre, regresamos el 23, somos 40, de guadalajara',
    'el i6s', 'solo nos llevan y traen',
    precio(58000),
    'oye y cómo sé que no me van a estafar?', 'tienen oficina?', 'me pasas tu RFC?',
    'quiero hablar con una persona', 'bueno va, ahí les deposito', foto('5213366679028'),
    'listo ya deposité'],

  /* ac · el que se equivoca de todo: fecha pasada, destino inexistente,
     grupo imposible, y un audio. */
  ac: ['quiero un camión para el 5 de enero', 'no, del año pasado no, de este',
    'vamos a nueva york', 'ah no verdad, entonces a mazatlán', 'somos 120',
    'ah no, somos 12', 'de guadalajara, ida y vuelta el 5 y 7 de enero, solo nos llevan y traen'],

  /* ad · el que ya apartó y quiere cambiar todo: fecha, unidad y destino. */
  ad: ['a chapala el 30 de octubre, ida y vuelta el mismo día, somos 15, de guadalajara, solo nos llevan y traen',
    va('5213366679030'),
    'apártamelo', foto('5213366679030'), apruebaPago(),
    'oye, podemos cambiar la fecha al 6 de noviembre?', 'y si mejor vamos a tequila?',
    'me llamo Sofía Carrillo Rangel'],

  /* ae · el de pocas palabras: contesta con monosílabos todo el camino. */
  ae: ['hola', 'viaje', 'vallarta', 'nov 20', 'nov 22', '16', 'gdl', 'no',
    va('5213366679031'),
    'ok', 'sí', 'apartar', 'ya'],

  /* ============================================================
     LA SEGUNDA COTIZACIÓN (af–ai)
     ============================================================
     Dictado del dueño (10-sep-2026): «le cuesta mucho las dobles
     cotizaciones; cotizó ya un viaje y luego le quieren sacar una nueva
     cotización y se vuelve muy loco».
     ============================================================ */

  /* af · el caso de su corrida: viaje 1 con precio YA dado y la cuenta
     mandada; pide otro y lo anuncia sin dar datos nuevos. */
  af: ['quiero cotizar a sayulita el 11 de septiembre, ida y vuelta el mismo día, somos 40, de guadalajara, solo nos llevan y traen',
    'el i6',
    precio(25000),
    'Buenas noches, quiero hacer una cotización a Vallarta del 15 de septiembre al 20',
    'es una nueva cotización', 'porfavor', 'si'],

  /* ag · el segundo viaje dicho completo de un jalón, sin avisar. */
  ag: ['a chapala el 20 de octubre, ida y vuelta el mismo día, somos 14, de guadalajara, solo nos llevan y traen',
    va('5213366679033'),
    'oye ahora quiero otra cotización: a mazatlán del 5 al 7 de diciembre, somos 45, de guadalajara, solo nos llevan y traen',
    'el paradiso'],

  /* ah · dos precios pendientes a la vez: el dueño contesta los dos y
     cada uno tiene que llegarle al cliente con SU viaje. */
  ah: ['cotización 1: a tequila el 17 de octubre, ida y vuelta el mismo día, somos 18, de guadalajara, solo nos llevan y traen',
    'y otra aparte: a san juan de los lagos el 24 de octubre, ida y vuelta, somos 45, de guadalajara, solo nos llevan y traen',
    'el i6s',
    precio(9500), precio(31000),
    '¿cuál precio es de cuál viaje?'],

  /* ai · cambia de opinión: pide el segundo y luego se regresa al
     primero, que ya tenía precio. */
  ai: ['a tapalpa el 8 de noviembre, ida y vuelta el mismo día, somos 16, de guadalajara, solo nos llevan y traen',
    va('5213366679035'),
    'oye y cuánto sale a mazamitla el 15 de noviembre igual de ida y vuelta con los mismos 16?',
    'mejor déjame el de tapalpa', 'apártamelo'],

  /* aj · LA VUELTA COMPLETA que pidió el dueño (10-sep-2026): cotiza uno,
     lo cotiza con precio, pide otro, lo cotiza también, se regresa al
     primero y LO COMPRA hasta el contrato. Si esto falla, se pierde al
     cliente: es la prueba que manda. */
  aj: ['hola, quiero cotizar a chapala el 20 de octubre, ida y vuelta el mismo día, somos 14, de guadalajara, solo nos llevan y traen',
    va('5213366679036'),
    'oye y aparte, ¿cuánto sale a mazatlán del 5 al 7 de diciembre para 45, de guadalajara, solo llevar y traer?',
    'el paradiso',
    precio(58000),
    'ok, mejor déjame el de chapala, ése sí lo quiero',
    'apártamelo', foto('5213366679036'), apruebaPago(),
    'soy Ramón Cárdenas Ibarra',
    'nos recogen en av. américas 400, guadalajara, a las 7 de la mañana',
    'llegamos al malecón de chapala y salimos de regreso a las 6 de la tarde',
    autorizaDatos(),
    '¿ya quedó?'],

  /* ak · el que pide tres cotizaciones seguidas sin cerrar ninguna, y al
     final quiere la de en medio. */
  ak: ['a tequila el 17 de octubre ida y vuelta el mismo día, somos 18, de guadalajara, solo nos llevan y traen',
    va('5213366679037'),
    'y otra a tapalpa el 24 de octubre, igual 18, mismo día, solo llevar y traer',
    va('5213366679037'),
    'y otra más a mazamitla el 31 de octubre, igual',
    va('5213366679037'),
    'me quedo con la de tapalpa', 'cuánto era?', 'apártamelo'],

  /* ============================================================
     AUDITORÍA EXTENSA DEL 10-SEP-2026 (al–az)
     ============================================================
     «Funge como cliente de verdad, actúa como cliente, pruébalo, haz de
     todo». Y el defecto que la disparó: el cliente NO sabe la dirección
     de llegada ni la hora, y eso puede quedar por confirmar.
     ============================================================ */

  /* al · EL QUE NO SABE NADA DEL DESTINO: la venta completa con las
     cuatro respuestas «no sé». Es la que dictó el dueño. */
  al: ['buenas, quiero una sprinter de guadalajara a vallarta del 22 al 25 de septiembre',
    'solo nos llevan y traen',
    va('5213366679038'),
    'va, apártamelo', foto('5213366679038'), apruebaPago(),
    'soy Gerardo Mendoza Ruiz',
    'todavía no sé la dirección exacta, es por la zona centro',
    'no sé a qué hora, como temprano',
    'no hemos reservado hotel todavía',
    'tampoco sé a qué hora nos regresamos',
    autorizaDatos(),
    'ya quedó?'],

  /* am · el que sabe unas y otras no, mezclado. */
  am: ['sprinter a chapala el 18 de octubre ida y vuelta el mismo día, de guadalajara, solo llevar y traer',
    va('5213366679039'),
    'apártamelo', foto('5213366679039'), apruebaPago(),
    'a nombre de Claudia Ríos Manzano, nos recogen en av. méxico 2500 a las 8',
    'la dirección de llegada todavía no la tengo',
    'como a las 6 de la tarde nos regresamos',
    autorizaDatos()],

  /* an · el impaciente que pregunta por su contrato antes de dar datos. */
  an: ['quiero cotizar a tequila el 25 de octubre, ida y vuelta el mismo día, somos 15, de guadalajara, solo llevar y traer',
    va('5213366679040'),
    'apártamelo', foto('5213366679040'),
    'y mi contrato?', 'cuándo me llega?', 'ya lo revisaron?',
    apruebaPago(), 'soy Hugo Ramírez Solís', 'no sé lo demás, luego te digo',
    autorizaDatos()],

  /* ao · el que escribe todo en un párrafo, con dos teléfonos y dos horas. */
  ao: ['sprinter a mazamitla el 7 de noviembre, ida y vuelta el mismo día, de guadalajara, solo llevar y traer',
    va('5213366679041'),
    'apártamelo', foto('5213366679041'), apruebaPago(),
    'Va a nombre de María Fernanda Ortiz Lugo, mi cel es el 3312345678 pero mi whats es este, nos recogen en Av. Vallarta 1234 col. Americana a las 6 de la mañana y vamos al Hotel Riu, regresamos como a las 4',
    autorizaDatos()],

  /* ap · el grosero y desconfiado, que además pide descuento y factura. */
  ap: ['a ver, cuánto por un camión a puerto vallarta',
    'del 20 al 22 de noviembre', 'somos 45', 'de guadalajara', 'solo llevar y traer', 'el i6s',
    precio(52000),
    'no mames está carísimo', 'me lo dejas en 40?', 'y facturas?',
    'quién me garantiza que no me van a dejar botado?', 'ok déjame lo pienso'],

  /* aq · la agencia que revende: pide neto, comisión y varias unidades. */
  aq: ['buen día, soy agencia, necesito 2 unidades para 90 pax GDL–Manzanillo del 12 al 14 de diciembre',
    'ejecutivas las dos', 'manejan tarifa neta para agencias?', 'y comisión?',
    'necesito factura y póliza', 'mándame la cotización por escrito'],

  /* ar · el que cambia todo tres veces antes de cerrar. */
  ar: ['a tequila el 17 de octubre, ida y vuelta el mismo día, somos 18, de guadalajara, solo llevar y traer',
    va('5213366679043'),
    'oye mejor el 24', 'y mejor somos 25', 'y mejor a tapalpa',
    'ya no, déjalo como estaba: tequila el 17 con 18'],

  /* as · el que manda audio, foto que no es comprobante, y sticker. */
  as: ['hola', foto('5213366679044'), 'esa es la foto del grupo jaja',
    'quiero cotizar a sayulita el 30 de octubre, ida y vuelta, somos 16, de guadalajara, solo llevar y traer',
    va('5213366679044'), 'apártamelo'],

  /* at · el que quiere cancelar después de depositar. */
  at: ['a chapala el 12 de octubre ida y vuelta el mismo día, somos 14, de guadalajara, solo llevar y traer',
    va('5213366679045'),
    'apártamelo', foto('5213366679045'), apruebaPago(),
    'oye ya no vamos a poder ir, se canceló el viaje', 'me devuelven mi dinero?'],

  /* au · el que pregunta cosas que el bot no puede saber. */
  au: ['hola, tienen unidades con baño?', 'y cuántos años tienen las unidades?',
    'sus choferes tienen licencia federal?', 'están asegurados?',
    'cuál es su dirección física?', 'ok, quiero cotizar a colima el 5 de noviembre para 20, de guadalajara, ida y vuelta'],

  /* ============================================================
     EL FLUJO NUEVO: EL BOT LLEGA HASTA LA COTIZACIÓN (av–ay)
     ============================================================
     Dictado del dueño (10-sep-2026). El bot cotiza y suelta el chat; de
     ahí en adelante el vendedor dispara con sus botones. Estos cuatro
     escenarios son los que hay que mirar antes de mover el bot a Kommo.
     ============================================================ */

  /* av · la venta completa por el camino nuevo, de «hola» al contrato,
     con el vendedor apretando los tres botones. */
  av: ['hola, quiero cotizar una sprinter a puerto vallarta',
    'del 6 al 8 de noviembre', 'somos 16', 'sí, de guadalajara', 'solo nos llevan y traen',
    va('5213366679048'),
    'va, me interesa', 'cómo le hago para apartar?',
    boton('cuenta'),
    'ya deposité', foto('5213366679048'),
    boton('recibido'),
    boton('contrato'),
    'soy Laura Beltrán Ríos', 'nos recogen en av. patria 2050, zapopan, a las 6 de la mañana',
    'llegamos al hotel playa bonita y de regreso salimos a las 5 de la tarde'],

  /* aw · el cliente sigue escribiendo después de la cotización: NADA de
     eso lo debe contestar el bot; todo tiene que llegarle al vendedor. */
  aw: ['a chapala el 20 de octubre, ida y vuelta el mismo día, somos 14, de guadalajara, solo nos llevan y traen',
    va('5213366679049'),
    'oye y qué incluye?', 'tienen seguro?', 'me puedes hacer descuento?',
    'y si somos 20?', 'ok déjame lo checo'],

  /* ax · pide OTRA cotización con el chat ya en manos del vendedor. El
     bot no debe despertar solo; con «bot» sí retoma y cotiza. */
  ax: ['a tequila el 17 de octubre, ida y vuelta el mismo día, somos 18, de guadalajara, solo nos llevan y traen',
    va('5213366679050'),
    'oye y aparte, cuánto sale a mazatlán del 5 al 7 de diciembre para 45?',
    dueno('3366679050 bot'),
    'cuánto sale a mazatlán del 5 al 7 de diciembre para 45, de guadalajara, solo llevar y traer?',
    'el paradiso'],

  /* ay · el vendedor aprieta botones a destiempo: sin cotización y con el
     cliente a media plática. No se debe romper ni mandar cosas raras. */
  ay: ['hola, quiero información',
    boton('cuenta'),
    'a tequila el 17 de octubre', boton('contrato'), 'somos 18']
};
const pedidos = process.argv.slice(2).filter((x) => escenarios[x]);
for (const k of (pedidos.length ? pedidos : Object.keys(escenarios))) {
  const C = '52133666790' + { a: '01', b: '02', c: '03', d: '04', e: '05', f: '06', g: '07', h: '08', i: '09', j: '10', k: '11', l: '12', m: '13', n: '14', o: '15', p: '16', q: '17', r: '18', s: '19', t: '20', u: '21', v: '26', w: '22', x: '23', y: '24', z: '25',
    aa: '27', ab: '28', ac: '29', ad: '30', ae: '31',
    af: '32', ag: '33', ah: '34', ai: '35', aj: '36', ak: '37',
    al: '38', am: '39', an: '40', ao: '41', ap: '42', aq: '43',
    ar: '44', as: '45', at: '46', au: '47',
    av: '48', aw: '49', ax: '50', ay: '51' }[k];
  const guion = escenarios[k].map((p) => (typeof p === 'function' && p.length === 0 && k === 'e') ? p : p);
  await corre('Escenario ' + k, C, guion);
  console.log('\n(gastado hasta aquí: $' + gastado.toFixed(3) + ' USD)');
}
console.log('\nListo. Gasto total: $' + gastado.toFixed(3) + ' USD.');
