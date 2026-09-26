/* ============================================================
   EL TICKET ES DONDE EL BOT SE BAJA (13-sep-2026)
   ============================================================
   Dictado del dueño: «el agente solo llega al ticket y listo… le pregunta
   al cliente si todo bien, si el cliente quiere mover algo lo mueve, y ya;
   si el cliente le dice que sí, listo, ya no hay bot». Y: «si el cliente no
   dice nada… no pongas nada».

   Corrida con el modelo real del mismo día: el relevo a la persona solo
   ocurría cuando el BOT mandaba el precio, y el bot ya no manda precio. El
   chat nunca pasaba a nadie. Después del ticket el bot le contestó a un
   cliente «Ya está apartado desde hace rato» —falso—, repitió dos veces el
   mismo párrafo a «¿cómo sé que no me van a estafar?» y a «¿tienen
   oficina?», y a la foto del comprobante le dijo «Ya lo vi, déjame
   revisarlo».

   Y un defecto aparte, del mismo día: el botón pulsado. Meta no lo manda
   como texto sino como `interactive`, y el bot solo leía texto. Todas las
   pruebas simulaban el botón escribiendo su texto, así que nadie lo vio.
   ============================================================ */

import crypto from 'crypto';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.join(AQUI, '..');

const SECRETO = 'secreto-de-prueba';
process.env.WHATSAPP_APP_SECRET = SECRETO;
process.env.WHATSAPP_TOKEN = 'tok';
process.env.WHATSAPP_PHONE_ID = '111';
process.env.DUENO_WHATSAPP = '5213311112222';
delete process.env.AVISOS_AL_DUENO;
process.env.ANTHROPIC_API_KEY = 'k';
process.env.AGENTE_IA = '1';
/* Esta prueba hace más de 300 turnos con la IA de mentiras en un solo
   proceso; sin esto, a media prueba «tope diario de IA» y todo cae al
   guion (21-sep-2026). */
process.env.TOPE_IA_POR_DIA = '5000';
process.env.CONFIRMAR_PRECIOS = '1';
process.env.SITIO_URL = 'https://eurotravel-web.vercel.app';
delete process.env.BOT_HASTA_COTIZACION;   // como en producción: sin poner = encendido
/* Con CLABE, como en producción: sin ella, la ficha bancaria que el guion
   anexaba a «apártamelo» no salía, y la primera versión de esta batería
   pasó sin ver ese hueco (lo cazó la corrida con el modelo real). */
process.env.CLABE = '012320001927217407';
process.env.CUENTA = '0192721740';
delete process.env.ESPIAR;
delete process.env.ALMACEN_URL; delete process.env.ALMACEN_CLAVE;

let buenas = 0, malas = 0;
function ok(que, condicion) {
  if (condicion) { buenas++; console.log('ok   ' + que); }
  else { malas++; console.log('FALLA ' + que); }
}
function titulo(t) { console.log('\n== ' + t.toUpperCase() + ' =='); }

let mandados = [];
let laIA = function () { return null; };

globalThis.fetch = async function (url, opciones) {
  const u = String(url);
  const cuerpo = opciones && opciones.body ? JSON.parse(opciones.body) : {};
  if (u.indexOf('graph.facebook.com') !== -1) {
    mandados.push(cuerpo);
    return { ok: true, status: 200, json: async () => ({ messages: [{ id: 'wamid.s' + mandados.length }] }), text: async () => '{}' };
  }
  if (u.indexOf('api.anthropic.com') !== -1) {
    const ultimo = ((cuerpo.messages || []).slice(-1)[0] || {}).content;
    const j = laIA(typeof ultimo === 'string' ? ultimo : JSON.stringify(ultimo || ''));
    if (!j) return { ok: false, status: 500, json: async () => ({}), text: async () => 'e' };
    return { ok: true, status: 200, json: async () => ({ content: [{ type: 'text', text: JSON.stringify(j) }], usage: { input_tokens: 1, output_tokens: 1 } }), text: async () => '' };
  }
  return { ok: false, status: 500, json: async () => ({}), text: async () => 'sin red' };
};

const atiende = (await import(pathToFileURL(path.join(RAIZ, 'api', 'whatsapp.mjs')).href)).default;
const webhook = (await import(pathToFileURL(path.join(RAIZ, 'api', '_whatsapp-webhook.js')).href)).default;
const agente = (await import(pathToFileURL(path.join(RAIZ, 'api', '_agente.js')).href)).default;
const tk = (await import(pathToFileURL(path.join(RAIZ, 'api', '_tickets.js')).href)).default;

let n = 0;
const firma = (c) => 'sha256=' + crypto.createHmac('sha256', SECRETO).update(c).digest('hex');
const mismo = (a, b) => String(a || '').replace(/\D/g, '').slice(-10) === String(b || '').replace(/\D/g, '').slice(-10);
function textos(para) {
  return mandados.filter((m) => mismo(m.to, para)).map((m) => (m.text && m.text.body) ||
    (m.interactive && m.interactive.body && m.interactive.body.text) || (m.image && m.image.caption) ||
    (m.image ? '[foto]' : ''));
}
function limpia() { webhook.olvidaTodo(); agente.olvidaTodo(); tk.olvidaTodo(); mandados = []; laIA = function () { return null; }; }
async function llega(mensaje, de) {
  n++;
  const c = JSON.stringify({ entry: [{ changes: [{ value: { metadata: { phone_number_id: '111' },
    contacts: [{ wa_id: de, profile: { name: 'Cliente' } }],
    messages: [Object.assign({ id: 'wamid.h' + n, from: de }, mensaje)] } }] }] });
  await atiende(new Request('https://x/api/whatsapp', { method: 'POST', body: c, headers: { 'x-hub-signature-256': firma(c) } }));
}
const dice = (texto, de) => llega({ type: 'text', text: { body: texto } }, de);

/* Hasta el ticket, con el guion solo (sin IA): determinista. */
async function hastaElTicket(C) {
  for (const m of ['hola', 'Cotizar un viaje', 'a chapala', 'somos 14', 'de guadalajara',
    '18 de octubre', 'el mismo dia', 'si']) {
    await dice(m, C);
  }
}

/* ============================================================ */
titulo('el botón pulsado se lee como lo que dice');
{
  limpia();
  const C = '5213366670001';
  await dice('hola', C);
  const antes = textos(C).length;
  await llega({ type: 'interactive', interactive: { type: 'button_reply',
    button_reply: { id: 'b1', title: 'Cotizar un viaje' } } }, C);
  const dijo = textos(C).slice(antes).join('\n');
  ok('a «Cotizar un viaje» pulsado le contesta (dijo: ' + JSON.stringify(dijo.slice(0, 80)) + ')', dijo.length > 0);
  /* Sin el arreglo contestaba «Lo recibí 👍 Cuéntame por aquí: ¿a dónde
     van, qué día y cuántos son?», que es lo que se le dice a una foto o a
     una ubicación. Por eso se exige la respuesta DEL BOTÓN, igual a la que
     sale cuando el cliente lo escribe. */
  const E = '5213366670003';
  await dice('hola', E);
  const antesE = textos(E).length;
  await dice('Cotizar un viaje', E);
  const escrito = textos(E).slice(antesE).join('\n');
  ok('  y contesta lo mismo que si lo hubiera escrito', dijo === escrito && !/Lo recib/i.test(dijo));

  /* Y la respuesta rápida de una plantilla, que llega como `button`. */
  limpia();
  const D = '5213366670002';
  await dice('hola', D);
  const antes2 = textos(D).length;
  await llega({ type: 'button', button: { text: 'Cotizar un viaje', payload: 'x' } }, D);
  const dijo2 = textos(D).slice(antes2).join('\n');
  ok('la respuesta rápida de plantilla también', /d[oó]nde/i.test(dijo2) && !/Lo recib/i.test(dijo2));
}

/* ============================================================ */
titulo('el ticket pregunta si todo bien');
{
  limpia();
  const C = '5213366670010';
  await hastaElTicket(C);
  const todo = textos(C).join('\n');
  ok('salió el ticket', /Chapala/.test(todo) && /en un momento te paso tu precio/i.test(todo));
  ok('  y pregunta «¿todo bien?»', /todo bien\?/i.test(todo));
}

/* ============================================================ */
titulo('después del ticket, lo que no corrige el viaje no lo contesta el bot');
{
  /* La IA de mentiras contesta lo que contestó la de verdad el 13-sep. */
  const MENTIRA = { respuesta: 'Ya está apartado desde hace rato 🙌', datos: {}, accion: 'seguir' };
  /* «sí, todo bien» ya no está en esta lista: desde el 21-sep-2026 un
     acuse no apaga el bot (ver el bloque de abajo). */
  for (const frase of ['apártamelo ya', 'oye y cómo sé que no me van a estafar?',
    'me pasas tu RFC?', 'quiero hablar con una persona']) {
    limpia();
    const C = '5213366670020';
    await hastaElTicket(C);
    laIA = function () { return MENTIRA; };
    const antes = textos(C).length;
    await dice(frase, C);
    const tras = textos(C).slice(antes);
    ok('«' + frase + '» → el bot no escribe nada (escribió ' + tras.length + ')', tras.length === 0);
    ok('  y el chat queda en manos de una persona', (tk.fichaDe(C) || {}).enManosDe === 'dueno');
  }

  /* Y ya en manos de la persona, el siguiente tampoco. */
  limpia();
  const E = '5213366670021';
  await hastaElTicket(E);
  laIA = function () { return MENTIRA; };
  await dice('sí, todo bien', E);
  const antes = textos(E).length;
  await dice('oye y tienen oficina?', E);
  ok('ni el mensaje que sigue', textos(E).slice(antes).length === 0);
}

/* ============================================================ */
titulo('una foto o un documento después del ticket, tampoco');
{
  limpia();
  const C = '5213366670030';
  await hastaElTicket(C);
  const antes = textos(C).length;
  await llega({ type: 'image', image: { id: 'img1', mime_type: 'image/jpeg' } }, C);
  ok('a la foto el bot no le contesta', textos(C).slice(antes).length === 0);
  ok('  y el chat queda en manos de una persona', (tk.fichaDe(C) || {}).enManosDe === 'dueno');
}

/* ============================================================ */
titulo('después del ticket, pedir fotos SÍ se atiende (21-sep-2026)');
{
  /* Revisión del 21-sep con el modelo real (escenario x20): tras el resumen
     el cliente pidió «y fotos de la suburban?» y el bot se calló y pasó el
     chat a una persona. Las fotos se mandan siempre que las pidan; eso no
     cambia el viaje ni pide precio. */
  limpia();
  const C = '5213366670035';
  await hastaElTicket(C);
  laIA = function () { return { respuesta: '', datos: {}, accion: 'fotos', unidadPedida: 'suburban' }; };
  const antes = textos(C).length;
  await dice('y fotos de la suburban?', C);
  const tras = textos(C).slice(antes);
  ok('le llegan fotos', tras.some((t) => t === '[foto]' || /Suburban/.test(t)));
  ok('  sin repetir el resumen ni cotizar de nuevo', !tras.some((t) => /ya tengo todo tu viaje/.test(t)));
  ok('  y la unidad del ticket sigue siendo la Sprinter', /sprinter/i.test(String((tk.fichaDe(C) || {}).porConfirmar && tk.fichaDe(C).porConfirmar.resumen && tk.fichaDe(C).porConfirmar.resumen.unidadNombre || 'sprinter')));
}

/* ============================================================ */
titulo('«no nos movemos» después del ticket NO es «algo está mal» (21-sep-2026)');
{
  /* Escenario w2: el resumen pregunta «¿Todo bien?» y el cliente contesta
     «no nos movemos» (confirma que no hay recorridos). El candado leía el
     «no» del principio y preguntaba «¿Qué le corrijo?». Un «no» a secas
     sí es corrección; un «no» que empieza una frase del viaje, no. */
  limpia();
  const C = '5213366670036';
  await hastaElTicket(C);
  laIA = function () { return { respuesta: 'Va, sin movimientos 🙌', datos: { recorridos: 0 }, accion: 'seguir' }; };
  let antes = textos(C).length;
  await dice('no nos movemos', C);
  ok('no le contesta «¿Qué le corrijo?»', !textos(C).slice(antes).some((t) => /Qué le corrijo/.test(t)));

  limpia();
  const D = '5213366670037';
  await hastaElTicket(D);
  laIA = function () { return { respuesta: 'Dime qué corrijo', datos: {}, accion: 'seguir' }; };
  antes = textos(D).length;
  await dice('no', D);
  ok('pero a un «no» a secas sí le pregunta qué corregir', textos(D).slice(antes).some((t) => /Qué le corrijo/.test(t)));
  antes = textos(D).length;
  await dice('no, la fecha está mal', D);
  ok('  y a «no, la fecha está mal» también', textos(D).slice(antes).some((t) => /Qué le corrijo/.test(t)));
}

/* ============================================================ */
titulo('con la IA caída después del ticket, tampoco');
{
  limpia();
  const C = '5213366670040';
  await hastaElTicket(C);
  const antes = textos(C).length;
  /* Cambió de lado el 21-sep-2026 (dictado: «en breve te lo paso está
     bien»): una pregunta por el precio, aun sin IA, recibe «en breve» y el
     bot sigue vivo. Antes: silencio y a la persona. */
  await dice('y cuánto sería más o menos?', C);   // laIA sigue en null: la IA no contesta
  const trasPrecio = textos(C).slice(antes).join('\n');
  ok('«¿y cuánto?» sin IA recibe «en breve te paso tu cotización»', /en breve te paso tu cotizaci/i.test(trasPrecio) && textos(C).length - antes === 1);
  ok('  sin ninguna cifra', !/\$|\d{4,}/.test(trasPrecio));
  ok('  y el bot sigue vivo', !(tk.fichaDe(C) || {}).enManosDe);
  const antesOk = textos(C).length;
  await dice('ok gracias', C);
  ok('«ok gracias» sin IA: no escribe nada', textos(C).slice(antesOk).length === 0);
  ok('  y el bot sigue vivo', !(tk.fichaDe(C) || {}).enManosDe);
  const antesRfc = textos(C).length;
  await dice('me pasas tu RFC?', C);
  ok('«RFC» sin IA: no escribe nada y pasa a la persona', textos(C).slice(antesRfc).length === 0 && (tk.fichaDe(C) || {}).enManosDe === 'dueno');
}

/* ============================================================ */
titulo('«¿y dan factura?» a media cotización: se contesta y luego se pregunta lo que falta (26-sep-2026, y3)');
{
  /* La IA contestó lo de la factura y de paso prometió el precio con datos
     que faltaban; antes se tiraba todo y solo salía «¿Qué día salen?». */
  limpia();
  const C = '5213366670071';
  laIA = function () { return { respuesta: 'Vallarta con 14, va 🙌 ¿Qué fechas tienen en mente?', datos: { destino: 'Puerto Vallarta', gente: 14 }, accion: 'seguir' }; };
  await dice('a vallarta, somos 14', C);
  laIA = function () { return { respuesta: 'Sí, damos factura sin problema 🧾 En un momento te paso el precio. ¿Te late?', datos: {}, accion: 'seguir' }; };
  const antes = textos(C).length;
  await dice('y dan factura?', C);
  const tras = textos(C).slice(antes).join('\n');
  ok('contesta lo de la factura', /factura/i.test(tras));
  ok('  sin la promesa del precio ni su pregunta', !/te paso el precio|te late/i.test(tras));
  ok('  y sigue con lo que falta (la fecha)', /qu[eé] d[ií]a salen/i.test(tras));
}

titulo('la lista de autobuses se manda una vez (25-sep-2026, modelo real, escenario a1)');
{
  /* A «¿solo tienes el i6S de doble puerta?» la IA contestó la lista de
     seis autobuses otra vez, un turno después de mandarla. Si insiste, la
     lista se recorta y queda lo demás. */
  const LISTA = 'Para 51 se ajustan a la capacidad estos:\nMarcopolo Paradiso G8 — Premium — 51 asientos\nIrizar i6S — Premium — 51 asientos\nIrizar i6 — Premium — 47 y 51 asientos\nNeobus — Gran Turismo — 50 asientos\n\n¿Cuál te late?';
  limpia();
  const C = '5213366670070';
  let vez = 0;
  laIA = function () {
    vez++;
    if (vez === 1) return { respuesta: 'San Juan de los Lagos, va 🙌 ' + LISTA, datos: { destino: 'San Juan de los Lagos', salida: '2026-11-28', regreso: '2026-11-28', unidad: 'autobus' }, accion: 'seguir' };
    /* Segunda llamada: contesta, pero con la lista (a medias) otra vez. */
    return { respuesta: 'Sí, el i6S es de doble puerta 🚌 ' + LISTA, datos: {}, accion: 'seguir' };
  };
  await dice('a san juan de los lagos el 28 de noviembre, mismo día, 50 personas en autobús', C);
  const antes = textos(C).length;
  await dice('solo tienes el irizar i6s de doble puerta?', C);
  const tras = textos(C).slice(antes).join('\n');
  ok('la segunda vez la lista NO sale (ni la de la IA ni la del motor)', !/Neobus — Gran Turismo|Marcopolo Paradiso G8 — Premium|se ajustan a la capacidad/.test(tras));
  ok('  pero sí sale lo que contestó', /doble puerta/.test(tras));
  ok('  y sin gastar una llamada más a la IA', vez === 2);
  /* Si la vuelve a pedir, sí se repite: eso es atenderlo. */
  const antes2 = textos(C).length;
  await dice('a ver, qué camiones tienes?', C);
  ok('si pide los camiones otra vez, la lista sí sale', /Neobus — Gran Turismo/.test(textos(C).slice(antes2).join('\n')));
}

titulo('un «ok» después del ticket no apaga el bot; un «¿y cuánto?» recibe «en breve» (21-sep-2026)');
{
  /* Dictado: «el ok, ten cuidado que no se apague cuando no debería» y
     «en breve te lo paso está bien». Caso real: lead 26919490 dijo
     «Perfecto» al resumen y el bot se apagó para siempre. */
  const MENTIRA = { respuesta: 'Ya está apartado desde hace rato 🙌', datos: {}, accion: 'seguir' };
  for (const frase of ['ok', 'Perfecto', 'sí, todo bien', 'muchas gracias', 'va, quedo pendiente', '👍']) {
    limpia();
    const C = '5213366670060';
    await hastaElTicket(C);
    laIA = function () { return MENTIRA; };
    const antes = textos(C).length;
    await dice(frase, C);
    ok('«' + frase + '» → el bot no escribe nada (escribió ' + textos(C).slice(antes).length + ')', textos(C).slice(antes).length === 0);
    ok('  y el bot SIGUE vivo (no pasa a la persona)', !(tk.fichaDe(C) || {}).enManosDe);
  }
  for (const frase of ['y cuánto sale?', 'ya tienes el precio?', 'cuánto sería más o menos', 'me pasas la cotización?', 'qué costo tiene']) {
    limpia();
    const C = '5213366670061';
    await hastaElTicket(C);
    laIA = function () { return { respuesta: 'Serían como $38,000 más o menos 🙌', datos: {}, accion: 'seguir' }; };
    const antes = textos(C).length;
    await dice(frase, C);
    const tras = textos(C).slice(antes).join('\n');
    ok('«' + frase + '» → «en breve te paso tu cotización», sin precio', /en breve te paso tu cotizaci/i.test(tras) && !/\$|38/.test(tras) && textos(C).length - antes === 1);
    ok('  y el bot sigue vivo', !(tk.fichaDe(C) || {}).enManosDe);
  }
  /* 25-sep-2026, dictado: «ya sabes cuál es la regla del apartado». Después
     del resumen, «¿cuánto es el apartado?» NO es una pregunta por el
     precio: se contesta la regla (20 % a los $500), sin cifras del viaje,
     y el bot sigue vivo. */
  for (const frase of ['cuánto es el apartado?', 'y de anticipo cuánto sería', 'cuánto tengo que depositar para apartar', 'como es la dinámica para apartar']) {
    limpia();
    const C = '5213366670063';
    await hastaElTicket(C);
    laIA = function () { return { respuesta: 'Serían $7,600 de apartado 🙌', datos: {}, accion: 'seguir' }; };
    const antes = textos(C).length;
    await dice(frase, C);
    const tras = textos(C).slice(antes).join('\n');
    ok('«' + frase + '» → la regla del apartado (20 % a los $500), sin cifras del viaje ni «en breve»',
      /20 %/.test(tras) && /500 pesos/.test(tras) && !/7,600|en breve|\$/i.test(tras) && textos(C).length - antes === 1);
    ok('  y el bot sigue vivo', !(tk.fichaDe(C) || {}).enManosDe);
  }
  /* Y después del «ok», una pregunta por el precio todavía se contesta:
     el bot no se apagó con el acuse. */
  limpia();
  const D = '5213366670062';
  await hastaElTicket(D);
  laIA = function () { return MENTIRA; };
  await dice('ok', D);
  const antes2 = textos(D).length;
  await dice('y ya tienes el precio?', D);
  ok('tras el «ok», «¿ya tienes el precio?» recibe «en breve»', /en breve te paso tu cotizaci/i.test(textos(D).slice(antes2).join('\n')));
  /* Pedir fotos después del «ok» tampoco se pierde. */
  ok('  y sigue vivo', !(tk.fichaDe(D) || {}).enManosDe);
}

/* ============================================================ */
titulo('pero una corrección del viaje sí la hace');
{
  limpia();
  const C = '5213366670050';
  await hastaElTicket(C);
  laIA = function (t) {
    /* Con la frase que dijo la IA de verdad (escenario bl): falsa, porque
       la Sprinter lleva 20. */
    if (/somos 20/.test(t)) return { respuesta: 'Sin problema, para ese número la unidad es el autobús: te paso las opciones que caben.', datos: { gente: 20 }, accion: 'cotizar' };
    return { respuesta: 'Perfecto', datos: {}, accion: 'seguir' };
  };
  const antes = textos(C).length;
  await dice('mejor somos 20', C);
  const tras = textos(C).slice(antes).join('\n');
  ok('«mejor somos 20» le manda el ticket corregido', /20 personas/.test(tras) && /Chapala/.test(tras));
  ok('  y solo el ticket: sin lo que la IA dijo encima', !/autob[uú]s/i.test(tras) && textos(C).length - antes === 1);
  ok('  y el chat sigue con el bot, esperando su «sí»', !(tk.fichaDe(C) || {}).enManosDe);

  const antes2 = textos(C).length;
  await dice('si asi esta bien', C);
  ok('  y a su «sí» ya no le contesta', textos(C).slice(antes2).length === 0);
  /* Cambió de lado el 21-sep-2026: el «sí» es un acuse y ya no apaga el
     bot (dictado: «ten cuidado que no se apague cuando no debería»). */
  ok('  y el bot sigue vivo', !(tk.fichaDe(C) || {}).enManosDe);
}

/* ============================================================ */
titulo('con la unidad escogida, la IA no se queda en cuántos son');
{
  /* La respuesta que dio la IA en la prueba del dueño desde su número
     (13-sep-2026): «sería una sprinter» → «Listo, Sprinter para ustedes.
     ¿Cuántos son, más o menos?». El candado de «pregunta que sobra» solo
     valía con autobús. */
  limpia();
  const C = '5213366670060';
  for (const m of ['hola', 'Cotizar un viaje', 'a vallarta', '15 de noviembre', 'el 17']) await dice(m, C);
  laIA = function () {
    return { respuesta: 'Listo, Sprinter para ustedes. ¿Cuántos son, más o menos?', datos: { unidad: 'sprinter' }, accion: 'seguir' };
  };
  const antes = textos(C).length;
  await dice('sería una sprinter', C);
  const tras = textos(C).slice(antes).join('\n');
  ok('no le vuelve a preguntar cuántos son (dijo: ' + JSON.stringify(tras.slice(0, 90)) + ')',
    tras.length > 0 && !/cu[aá]ntos (son|van)/i.test(tras));
}

/* ============================================================ */
titulo('un día suelto es ese día, lo anote como lo anote la IA');
{
  /* La plática del dueño con el modelo real (13-sep-2026): salida el 15,
     «17» al regreso, y la IA anotó regreso = 15. El ticket salió de un día. */
  limpia();
  const C = '5213366670070';
  laIA = function (t) {
    if (/a vallarta/.test(t)) return { respuesta: 'Vallarta, va. ¿Qué día salen?', datos: { destino: 'Puerto Vallarta' }, accion: 'seguir' };
    if (/15 de noviembre/.test(t)) return { respuesta: 'El 15, va. ¿Y el regreso?', datos: { salida: '2026-11-15' }, accion: 'seguir' };
    if (/^17$/.test(t.trim())) return { respuesta: 'Listo, ida y vuelta el 15. ¿Cuántos van?', datos: { regreso: '2026-11-15' }, accion: 'seguir' };
    return { respuesta: 'Va.', datos: {}, accion: 'seguir' };
  };
  for (const m of ['hola', 'Cotizar un viaje', 'a vallarta', '15 de noviembre', '17']) await dice(m, C);
  const charla = webhook.charlaDe(C) || {};
  ok('«17» deja el regreso el 17, no el 15 que anotó la IA (quedó ' + charla.regreso + ')', charla.regreso === '2026-11-17');
}

/* ============================================================ */
titulo('la segunda prueba del dueño: «15 a 20 de septiembre»');
{
  /* Siempre un mes futuro: el próximo año, en septiembre. */
  const ANIO_FUTURO = String(new Date().getFullYear() + 1);
  const MES_NUM = '09';
  const MES_FUTURO = 'septiembre';
  /* Tal cual, 13-sep-2026 5:59 p.m. La IA leyó bien las dos fechas y el
     candado tiró el regreso porque el lector del guion no entendía «a». */
  limpia();
  const C = '5213366670080';
  await dice('hola', C);
  await dice('Cotizar un viaje', C);
  laIA = function (t) {
    if (/vallarta en sprinter/.test(t)) return { respuesta: 'Puerto Vallarta con Sprinter, perfecto. ¿Qué días salen y regresan?', datos: { destino: 'Puerto Vallarta' }, accion: 'seguir' };
    /* Las fechas van un año adelante del reloj real: la prueba original
       decía «septiembre de 2026» y caducó el 15-sep-2026 (una fecha
       pasada se tira, y con razón). Ver [[eurotravel-pruebas-que-caducan]]. */
    if (/15 a 20/.test(t)) return { respuesta: 'Listo, del 15 al 20 de ' + MES_FUTURO + '. ¿Salen de la zona metropolitana de Guadalajara?', datos: { salida: ANIO_FUTURO + '-' + MES_NUM + '-15', regreso: ANIO_FUTURO + '-' + MES_NUM + '-20' }, accion: 'seguir' };
    return { respuesta: 'Perfecto.', datos: { origen: 'Guadalajara' }, accion: 'seguir' };
  };
  await dice('vallarta en sprinter', C);
  await dice('15 a 20 de ' + MES_FUTURO + ' de ' + ANIO_FUTURO, C);
  const charla = webhook.charlaDe(C) || {};
  ok('se quedan las dos fechas (salida ' + charla.salida + ', regreso ' + charla.regreso + ')',
    charla.salida === ANIO_FUTURO + '-' + MES_NUM + '-15' && charla.regreso === ANIO_FUTURO + '-' + MES_NUM + '-20');
  const antes = textos(C).length;
  await dice('si', C);
  ok('  y a «si» no le vuelve a preguntar el regreso', !/regresan/i.test(textos(C).slice(antes).join('\n')));
  /* Y del lado del guion, que es el respaldo. */
  const bot = (await import(pathToFileURL(path.join(RAIZ, 'bot.js')).href)).default;
  for (const [frase, ida, vuelta] of [['15 a 20 de septiembre', '2026-09-15', '2026-09-20'],
    ['15-20 septiembre', '2026-09-15', '2026-09-20'], ['15 al 20', '2026-09-15', '2026-09-20'],
    ['20 de dic a 2 de enero', '2026-12-20', '2027-01-02']]) {
    const j = bot.leeDeUnJalon(frase, '2026-09-13') || {};
    ok('el guion lee «' + frase + '» como rango', j.salida === ida && j.regreso === vuelta);
  }
  const bot2 = bot;
  ok('«de 8 a 10 de la mañana» no es un rango de días', !(bot2.leeDeUnJalon('de 8 a 10 de la mañana', '2026-09-13') || {}).regreso);
}

/* ============================================================ */
titulo('las preguntas del mismo mensaje se contestan antes del ticket; solo se calla lo del precio (22-sep-2026)');
{
  /* Escenario x14 con el modelo real: dio todo el viaje y preguntó cuatro
     cosas; la IA las contestó y el bot tiró su texto entero porque
     mencionaba el precio. El cliente recibió solo el ticket. */
  limpia();
  const C = '5213366670070';
  await dice('hola', C);
  await dice('Nueva cotización', C);
  laIA = function () {
    return { respuesta: 'Sí, el operador se queda con ustedes todo el viaje. Sí se puede pagar en dos partes y sí hay factura. El precio te lo paso en un momento.',
      datos: { destino: 'Chapala', origen: 'Guadalajara', salida: '2026-10-04', regreso: '2026-10-04', gente: 12, unidad: 'sprinter', recorridos: 0 },
      accion: 'cotizar' };
  };
  const antes = textos(C).length;
  await dice('a chapala el 4 de octubre somos 12 de guadalajara mismo dia sin movimientos, ¿el chofer se queda con nosotros, se puede pagar en dos partes y hay factura? y cuánto sale', C);
  const tras = textos(C).slice(antes).join('\n');
  ok('contesta lo del operador y el pago', /operador se queda/.test(tras) && /dos partes/.test(tras) && /factura/.test(tras));
  ok('  sin la oración del precio', !/precio te lo paso/.test(tras));
  ok('  y el ticket sale también', /Chapala/.test(tras) && /en un momento te paso tu precio/i.test(tras));
}

/* ============================================================ */
titulo('y al dueño, nada');
{
  ok('en toda la batería no le llegó nada a su número', textos(process.env.DUENO_WHATSAPP).length === 0);
}

console.log('\n' + buenas + ' buenas, ' + malas + ' malas');
process.exit(malas ? 1 : 0);
