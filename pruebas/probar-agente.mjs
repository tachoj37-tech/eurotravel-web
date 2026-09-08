/* ============================================================
   EL AGENTE, DE PUNTA A PUNTA
   ------------------------------------------------------------
   Dictado del dueño (5-sep-2026): «no quiero hablar con un bot,
   quiero hablar con una IA agente vendedor de viajes». Aquí Haiku
   es de mentiras y contesta lo que le digamos; lo que se vigila es
   el CABLEADO: que lo que dice la IA llegue al cliente, que lo que
   lee se pegue al viaje, que «bien y tú?» no sea un destino, que
   las acciones salgan por el motor (precio con compuerta, fotos,
   persona), y que sin IA el guion conteste de respaldo.
   ============================================================ */
import crypto from 'crypto';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.join(AQUI, '..');

const SECRETO = 'secreto-de-prueba';
process.env.WHATSAPP_APP_SECRET = SECRETO;
process.env.WHATSAPP_TOKEN = 'token-de-mentiras';
process.env.WHATSAPP_PHONE_ID = '111';
process.env.DUENO_WHATSAPP = '5213311112222';
process.env.HOY_DE_PRUEBA = '2026-09-05';
process.env.DISPONIBILIDAD_API_KEY = 'llave-de-lectura-de-mentiras';
process.env.ANTHROPIC_API_KEY = 'clave-de-mentiras';
process.env.SITIO_URL = 'https://eurotravel-web.vercel.app';
process.env.CONFIRMAR_PRECIOS = '1';
process.env.CONFIRMAR_DISPONIBILIDAD = '1';
process.env.AGENTE_IA = '1';
process.env.SIEMPRE_IA = '0';

const atiende = (await import(pathToFileURL(path.join(RAIZ, 'api', 'whatsapp.mjs')).href)).default;
const webhook = (await import(pathToFileURL(path.join(RAIZ, 'api', '_whatsapp-webhook.js')).href)).default;
const agente = (await import(pathToFileURL(path.join(RAIZ, 'api', '_agente.js')).href)).default;

let buenas = 0, malas = 0;
function ok(que, dio, esperaba) {
  const bien = JSON.stringify(dio) === JSON.stringify(esperaba);
  if (bien) { buenas++; console.log('ok   ' + que); }
  else { malas++; console.log('MAL  ' + que + '\n     dio      ' + JSON.stringify(dio) + '\n     esperaba ' + JSON.stringify(esperaba)); }
}
function okQue(que, condicion) { ok(que, !!condicion, true); }
function titulo(t) { console.log('\n== ' + t.toUpperCase() + ' =='); }

/* ---- Haiku de mentiras: contesta según lo que escribió el cliente ---- */
let mandados = [];
let llamadasALaIA = 0;
let sistemasVistos = [];
let calendarioPedido = [];
let laIA = function () { return null; };   // (textoDelCliente) -> objeto JSON o null (=500)

globalThis.fetch = async function (url, opciones) {
  const u = String(url);
  const cuerpo = opciones && opciones.body ? JSON.parse(opciones.body) : {};
  if (u.indexOf('graph.facebook.com') !== -1) {
    mandados.push(cuerpo);
    return { ok: true, status: 200, json: async () => ({ messages: [{ id: 'wamid.s' + mandados.length }] }), text: async () => '{}' };
  }
  if (u.indexOf('api.anthropic.com') !== -1) {
    llamadasALaIA++;
    sistemasVistos.push(cuerpo.system);
    const dijo = laIA(((cuerpo.messages || [])[0] || {}).content || '', cuerpo);
    if (!dijo) return { ok: false, status: 500, text: async () => '' };
    return { ok: true, status: 200, json: async () => ({ content: [{ text: JSON.stringify(dijo) }], usage: { input_tokens: 1200, output_tokens: 60 } }) };
  }
  if (u.indexOf('/api/disponibilidad') !== -1) {
    calendarioPedido.push(u);
    /* Como EuroSystem: solo las tres categorías; un nombre de unidad
       («NEOBUS», «IRIZAR I6S») es un 422 (visto en producción el
       7-sep-2026). */
    const tipo = new URL(u).searchParams.get('tipo');
    if (['AUTOBUS', 'SPRINTER', 'SUBURBAN'].indexOf(tipo) < 0) {
      return { ok: false, status: 422, json: async () => ({}), text: async () => 'tipo inválido' };
    }
    return { ok: true, status: 200, json: async () => ({ datos: { libres: 2, total: 4 } }), text: async () => '' };
  }
  throw new Error('el bot llamó a algo que no debía: ' + u);
};

const firma = (c) => 'sha256=' + crypto.createHmac('sha256', SECRETO).update(Buffer.from(c, 'utf8')).digest('hex');
let contador = 0;
async function dice(texto, de) {
  contador++;
  const cuerpo = JSON.stringify({ entry: [{ changes: [{ value: {
    metadata: { phone_number_id: '111' },
    messages: [{ id: 'wamid.p' + contador, from: de, type: 'text', text: { body: texto } }]
  } }] }] });
  const r = await atiende(new Request('https://x/api/whatsapp', { method: 'POST', body: cuerpo, headers: { 'x-hub-signature-256': firma(cuerpo) } }));
  /* Un 500 aquí es una excepción dentro del bot: se dice, no se esconde. */
  if (!r || r.status !== 200) console.log('     ¡el webhook contestó ' + (r && r.status) + ' a «' + texto + '»: ' + (r ? await r.text() : '') + '!');
}
function mismo(a, b) { return String(a || '').replace(/\D/g, '').slice(-10) === String(b || '').replace(/\D/g, '').slice(-10); }
function textos(para) { return mandados.filter((m) => mismo(m.to, para)).map((m) => (m.text && m.text.body) || ''); }
const DUENO = process.env.DUENO_WHATSAPP;
function limpia() { webhook.olvidaTodo(); agente.olvidaTodo(); mandados = []; llamadasALaIA = 0; sistemasVistos = []; }

/* ============================================================ */
titulo('la plática de un cliente real, ahora con el agente');
{
  limpia();
  const C = '5213366670201';
  laIA = function (t) {
    if (/^hola$/i.test(t)) return { respuesta: '¡Qué tal! Soy Eurobot, de Eurotravel 🚐 ¿A dónde va el plan?', datos: {}, accion: 'seguir' };
    if (/bien y tu/i.test(t)) return { respuesta: 'Muy bien, gracias. Cuéntame, ¿a dónde van?', datos: {}, accion: 'seguir' };
    if (/vta/i.test(t)) return { respuesta: 'Vallarta, va. ¿Qué día salen?', datos: { destino: 'Puerto Vallarta' }, accion: 'seguir' };
    if (/^pasado$/i.test(t)) return { respuesta: 'Pasado mañana, listo. ¿Y qué día regresan?', datos: { salida: '2026-09-07' }, accion: 'seguir' };
    if (/regresamos el 9/i.test(t)) return { respuesta: 'Del 7 al 9, perfecto. ¿Como cuántos van?', datos: { regreso: '2026-09-09' }, accion: 'seguir' };
    if (/aprox 12/i.test(t)) return { respuesta: '12 caben perfecto en una Sprinter. ¿De dónde salen?', datos: { gente: 12 }, accion: 'seguir' };
    if (/gdl/i.test(t)) return { respuesta: 'Desde Guadalajara. Allá, ¿se van a andar moviendo con la camioneta o solo los llevamos y traemos?', datos: { origen: 'Guadalajara' }, accion: 'seguir' };
    if (/solo nos llevan/i.test(t)) return { respuesta: null, datos: { recorridos: 0 }, accion: 'cotizar' };
    return null;
  };
  await dice('hola', C);
  ok('«hola»: contesta la IA', textos(C).slice(-1)[0], '¡Qué tal! Soy Eurobot, de Eurotravel 🚐 ¿A dónde va el plan?');
  await dice('bien y tu?', C);
  ok('«bien y tú?» es plática, no destino', textos(C).slice(-1)[0], 'Muy bien, gracias. Cuéntame, ¿a dónde van?');
  okQue('  y el guion NO guardó «Bien y Tu?» como destino', !textos(C).join('\n').includes('Bien y Tu'));
  const s = sistemasVistos[sistemasVistos.length - 1] || [];
  okQue('  la IA recibió el contexto (hoy, lo sabido, últimos mensajes)', JSON.stringify(s).includes('ÚLTIMOS MENSAJES') && JSON.stringify(s).includes('Cliente: hola'));
  await dice('a vta', C);
  await dice('pasado', C);
  await dice('regresamos el 9', C);
  await dice('somos aprox 12', C);
  await dice('salimos de gdl', C);
  const antesDelPrecio = textos(C).length;
  await dice('solo nos llevan y traen', C);
  const alCliente = textos(C).slice(antesDelPrecio).join('\n');
  const alDueno = textos(DUENO).join('\n');
  okQue('con todo junto, el motor cotiza: el cliente recibe la espera (compuerta)', /en breve te paso tu cotizaci/i.test(alCliente));
  /* «No me pidió unidad, el cliente no sabe en qué lo llevan» (7-sep-2026). */
  okQue('  y la espera le dice en qué lo llevan (Sprinter para 12)', /Ser[ií]an en Sprinter para 12/.test(alCliente));
  /* Efecto dotación: con la espera va la foto de la unidad que le tocaría. */
  const fotosAlCliente = mandados.filter((m) => mismo(m.to, C) && m.image && m.image.link);
  okQue('  y con la espera va la foto de la Sprinter («ésta es la que les tocaría»)',
    fotosAlCliente.some((m) => /sprinter/i.test(m.image.link) && /les tocar[ií]a/.test(m.image.caption || '')));
  const instrucciones = JSON.stringify(sistemasVistos[sistemasVistos.length - 1] || []);
  okQue('  la IA sabe que para Tequila/Chapala pregunta «¿Es ida y vuelta el mismo día?»', /Es ida y vuelta el mismo d[ií]a/.test(instrucciones));
  okQue('  y que nombra la unidad en el mismo mensaje en que le dicen cuántos', /EN EL MISMO MENSAJE/.test(instrucciones));
  okQue('  y al dueño le llega el ticket de precio', /Precio por confirmar/.test(alDueno));
  okQue('  con Puerto Vallarta, 12 pax y las fechas', /Vallarta/.test(alDueno) && /12 pax/.test(alDueno));
  okQue('  el cliente nunca vio un precio ni un «no entendí»', !/\$\s?\d|no entend|no me qued/i.test(textos(C).join('\n')));
  ok('  una llamada a la IA por mensaje', llamadasALaIA, 8);
}

/* ============================================================ */
titulo('autobús: por la compuerta del dueño, nunca a otro número (6-sep-2026)');
{
  limpia();
  const C = '5213366670207';
  laIA = function (t) {
    if (/vallarta/i.test(t)) return { respuesta: 'Vallarta, va. ¿Qué día salen?', datos: { destino: 'Puerto Vallarta' }, accion: 'seguir' };
    if (/9 de septiembre/i.test(t)) return { respuesta: 'Listo. ¿Y regresan?', datos: { salida: '2026-09-09' }, accion: 'seguir' };
    if (/el 14/i.test(t)) return { respuesta: 'Del 9 al 14. ¿Como cuántos van?', datos: { regreso: '2026-09-14' }, accion: 'seguir' };
    if (/somos 48/i.test(t)) return { respuesta: 'Para 48 les caben estos:\nMarcopolo Paradiso G8 — Premium — 51 asientos\nIrizar i6S — Premium — 51 asientos\nNeobus — Gran Turismo — 50 asientos\n¿Cuál te late?', datos: { gente: 48 }, accion: 'seguir' };
    if (/neobus/i.test(t)) return { respuesta: 'Neobus, va. ¿Salen de la zona metropolitana de Guadalajara?', datos: { autobus: 'neobus' }, accion: 'seguir' };
    if (/^s[ií]$/i.test(t)) return { respuesta: 'Perfecto. Allá, ¿se mueven con el camión o solo los llevamos y traemos?', datos: { origen: 'Guadalajara' }, accion: 'seguir' };
    if (/solo nos llevan/i.test(t)) return { respuesta: null, datos: { recorridos: 0 }, accion: 'cotizar' };
    return null;
  };
  await dice('a vallarta', C);
  await dice('el 9 de septiembre', C);
  await dice('el 14', C);
  await dice('somos 48', C);
  await dice('el neobus', C);
  await dice('sí', C);
  const antes = textos(C).length;
  await dice('solo nos llevan y traen', C);
  const alCliente = textos(C).slice(antes).join('\n');
  const alDueno = textos(DUENO).join('\n');
  okQue('el cliente recibe la espera: «en breve te paso tu cotización y la disponibilidad»', /en breve te paso tu cotizaci[oó]n y la disponibilidad/i.test(alCliente));
  okQue('  y NUNCA «mándale esto por WhatsApp al…»', !/M[aá]ndale esto|33 2400/.test(alCliente));
  /* El calendario se pregunta por CATEGORÍA (AUTOBUS), no por el nombre
     del camión: con «NEOBUS» EuroSystem contestaba 422 y el ticket iba sin
     calendario. */
  okQue('  el calendario se consultó como AUTOBUS, no como «NEOBUS»', /tipo=AUTOBUS/.test(calendarioPedido.slice(-1)[0] || ''));
  okQue('  al dueño le llega el ticket sin número y pidiéndolo', /Precio por confirmar/.test(alDueno) && /escr[ií]beme el precio/i.test(alDueno));
  okQue('  con Neobus, 48 pax y Vallarta', /Neobus/.test(alDueno) && /48 pax/.test(alDueno) && /Vallarta/.test(alDueno));
  /* El dueño contesta con el precio, citando el ticket. */
  let idx = -1; mandados.forEach(function (m, i) { if (mismo(m.to, DUENO)) idx = i; });
  const ticket = 'wamid.s' + (idx + 1);
  mandados = [];
  const cuerpo = JSON.stringify({ entry: [{ changes: [{ value: { metadata: { phone_number_id: '111' },
    messages: [{ id: 'wamid.d1', from: DUENO, type: 'text', text: { body: '52,000' }, context: { id: ticket } }] } }] }] });
  await atiende(new Request('https://x/api/whatsapp', { method: 'POST', body: cuerpo, headers: { 'x-hub-signature-256': firma(cuerpo) } }));
  okQue('con «52,000» del dueño, el cliente recibe ese precio', /\*Total: \$52,000\*/.test(textos(C).join('\n')));
  okQue('  con el anticipo del 20 % redondeado a $500 arriba ($10,500)', /\$10,500/.test(textos(C).join('\n')));
}

/* ============================================================ */
titulo('después de la espera no se vuelve a pedir el precio (7-sep-2026)');
{
  /* Visto en producción: después de «checo disponibilidad y te paso el
     precio», el bot contestaba LO MISMO a «ok», y al día siguiente a
     «quiero cotizar un viaje a vallarta» y a «sería otro viaje diferente».
     La plática se guardaba con todos los datos y el agente volvía a
     «cotizar» con cada mensaje. */
  limpia();
  const C = '5213366670208';
  laIA = function (t) {
    if (/otro viaje/i.test(t)) return { respuesta: 'Mazamitla, va. ¿Qué día salen?', datos: { destino: 'Mazamitla' }, accion: 'seguir' };
    if (/vallarta/i.test(t)) return { respuesta: 'Vallarta, va. ¿Qué día salen?', datos: { destino: 'Puerto Vallarta' }, accion: 'seguir' };
    if (/9 de septiembre/i.test(t)) return { respuesta: 'Listo. ¿Y regresan?', datos: { salida: '2026-09-09' }, accion: 'seguir' };
    if (/el 14/i.test(t)) return { respuesta: 'Del 9 al 14. ¿Como cuántos van?', datos: { regreso: '2026-09-14' }, accion: 'seguir' };
    if (/somos 12/i.test(t)) return { respuesta: '12 caben perfecto en una Sprinter. ¿Salen de la zona metropolitana de Guadalajara?', datos: { gente: 12 }, accion: 'seguir' };
    if (/^s[ií]$/i.test(t)) return { respuesta: 'Perfecto. Allá, ¿se mueven con la camioneta o solo los llevamos y traemos?', datos: { origen: 'Guadalajara' }, accion: 'seguir' };
    if (/solo nos llevan/i.test(t)) return { respuesta: null, datos: { recorridos: 0 }, accion: 'cotizar' };
    if (/^ok$/i.test(t)) return { respuesta: 'Va, en cuanto lo tenga te aviso 🙌', datos: {}, accion: 'seguir' };
    if (/^el 20$/i.test(t)) return { respuesta: 'El 20, va. ¿Y regresan?', datos: { salida: '2026-09-20' }, accion: 'seguir' };
    if (/^el 22$/i.test(t)) return { respuesta: 'Del 20 al 22. ¿Como cuántos van?', datos: { regreso: '2026-09-22' }, accion: 'seguir' };
    if (/somos 8/i.test(t)) return { respuesta: '8 van cómodos en Sprinter. ¿Salen de la zona metropolitana de Guadalajara?', datos: { gente: 8 }, accion: 'seguir' };
    if (/^gracias$/i.test(t)) return { respuesta: 'A ti 🙌', datos: {}, accion: 'seguir' };
    return null;
  };
  await dice('a vallarta', C);
  await dice('el 9 de septiembre', C);
  await dice('el 14', C);
  await dice('somos 12', C);
  await dice('sí', C);
  await dice('solo nos llevan y traen', C);
  const esperas = () => textos(C).filter((t) => /en breve te paso tu cotizaci/i.test(t)).length;
  ok('la espera salió una vez', esperas(), 1);
  const tickets = () => textos(DUENO).filter((t) => /Precio por confirmar/.test(t)).length;
  ok('  y un ticket al dueño', tickets(), 1);

  await dice('ok', C);
  ok('«ok» después de la espera: NO se repite la espera', esperas(), 1);
  ok('  ni llega otro ticket', tickets(), 1);
  ok('  contesta la IA', textos(C).slice(-1)[0], 'Va, en cuanto lo tenga te aviso 🙌');
  const s1 = JSON.stringify(sistemasVistos[sistemasVistos.length - 1] || []);
  okQue('  y la IA supo que el precio ya estaba pedido', s1.includes('PRECIO YA PEDIDO'));

  await dice('quiero cotizar otro viaje a mazamitla', C);
  ok('«otro viaje»: NO se repite la espera', esperas(), 1);
  ok('  la IA pregunta lo que sigue del viaje nuevo', textos(C).slice(-1)[0], 'Mazamitla, va. ¿Qué día salen?');
  await dice('el 20', C);
  const s2 = JSON.stringify(sistemasVistos[sistemasVistos.length - 1] || []);
  /* Lo SABIDO del viaje nuevo es solo Mazamitla; el de Vallarta aparece
     aparte, como «precio ya pedido», para que la IA no lo confunda. */
  okQue('  el viaje nuevo empezó de cero: lo sabido es solo Mazamitla', /YA SE SABE DEL VIAJE: destino=Mazamitla\./.test(s2));
  if (!/YA SE SABE DEL VIAJE: destino=Mazamitla\./.test(s2)) console.log('     contexto: ' + (s2.match(/YA SE SABE[^\\]*/) || [''])[0]);
  okQue('  y el de Vallarta sigue ahí como precio ya pedido', /PRECIO YA PEDIDO: [^"]*Vallarta/.test(s2));
  ok('  y sigue sin ticket nuevo (todavía faltan datos)', tickets(), 1);

  /* ---- la segunda cotización completa: dos tickets en el aire ---- */
  /* El freno es de 12 mensajes por minuto por remitente; este cliente ya
     lleva más. Se adelanta el reloj un par de minutos, como haría el
     tiempo real. */
  process.env.AHORA_DE_PRUEBA = String(Date.now() + 2 * 60000);
  await dice('el 22', C);
  await dice('somos 8', C);
  await dice('sí', C);
  await dice('solo nos llevan y traen', C);
  ok('la segunda cotización manda su propio ticket', tickets(), 2);
  ok('  y la espera salió dos veces (una por viaje)', esperas(), 2);
  const idsDeTickets = [];
  mandados.forEach(function (m, i) { if (mismo(m.to, DUENO) && /Precio por confirmar/.test((m.text && m.text.body) || '')) idsDeTickets.push('wamid.s' + (i + 1)); });
  const contexto3 = JSON.stringify(sistemasVistos[sistemasVistos.length - 1] || []);
  okQue('  al pedir el segundo precio, el de Vallarta NO se olvidó (queda como viaje anterior)', /VIAJES ANTERIORES[^"]*Vallarta/.test(contexto3) || /PRECIO YA PEDIDO[^"]*Vallarta/.test(contexto3));

  /* El dueño contesta PRIMERO el ticket viejo (Vallarta) y luego el nuevo. */
  const contesta = async function (ticket, texto) {
    const cuerpo = JSON.stringify({ entry: [{ changes: [{ value: { metadata: { phone_number_id: '111' },
      messages: [{ id: 'wamid.d-' + ticket, from: DUENO, type: 'text', text: { body: texto }, context: { id: ticket } }] } }] }] });
    await atiende(new Request('https://x/api/whatsapp', { method: 'POST', body: cuerpo, headers: { 'x-hub-signature-256': firma(cuerpo) } }));
  };
  const antesDeConfirmar = textos(C).length;
  await contesta(idsDeTickets[0], '52,000');
  const trasElPrimero = textos(C).slice(antesDeConfirmar).join('\n');
  okQue('«52,000» al ticket de Vallarta: el cliente recibe ESE precio', /\*Total: \$52,000\*/.test(trasElPrimero));
  okQue('  y es el viaje de Vallarta, no el de Mazamitla', /Vallarta/.test(trasElPrimero) && !/Mazamitla/.test(trasElPrimero));
  const antesDelSegundo = textos(C).length;
  await contesta(idsDeTickets[1], '30,000');
  const trasElSegundo = textos(C).slice(antesDelSegundo).join('\n');
  okQue('«30,000» al ticket de Mazamitla: el cliente recibe ESE precio', /\*Total: \$30,000\*/.test(trasElSegundo));
  okQue('  y es el viaje de Mazamitla', /Mazamitla/.test(trasElSegundo) && !/Vallarta/.test(trasElSegundo));

  /* Un segundo «va» al ticket de Vallarta, ya consumido: no manda nada
     (y menos el precio de Mazamitla). */
  const antesDelRepetido = textos(C).length;
  await contesta(idsDeTickets[0], 'va');
  ok('un segundo «va» al ticket ya contestado no vuelve a mandar precio', textos(C).slice(antesDelRepetido).filter((t) => /Total: \$/.test(t)).length, 0);

  await dice('gracias', C);
  const contexto4 = JSON.stringify(sistemasVistos[sistemasVistos.length - 1] || []);
  okQue('después de los dos precios, la IA ve los dos viajes (Mazamitla dado, Vallarta anterior)',
    /PRECIO YA DADO[^"]*Mazamitla/.test(contexto4) && /VIAJES ANTERIORES[^"]*Vallarta/.test(contexto4));
  delete process.env.AHORA_DE_PRUEBA;
}

/* ============================================================ */
titulo('una plática vieja atorada en «confirmar» no vuelve a pedir el precio');
{
  /* Las pláticas guardadas ANTES del arreglo del 7-sep-2026 traen todos los
     datos en el paso «confirmar» y viven hasta siete días. Con el precio ya
     pedido en la ficha, se descartan. */
  limpia();
  const C = '5213366670209';
  const fichas = (await import(pathToFileURL(path.join(RAIZ, 'api', '_tickets.js')).href)).default;
  webhook.siembraCharla(C, { paso: 'confirmar', destino: 'Puerto Vallarta', origen: 'Guadalajara',
    salida: '2026-09-09', regreso: '2026-09-14', gente: 12, unidad: 'sprinter', recorridos: 0 });
  fichas.anotaEtapa(C, 'pidio_precio', { porConfirmar: { cotiza: null, resumen: { destino: 'Puerto Vallarta', origen: 'Guadalajara', salida: '2026-09-09', regreso: '2026-09-14', gente: 12, unidad: 'sprinter' }, desde: Date.now() } });
  laIA = function (t) {
    if (/^ok$/i.test(t)) return { respuesta: 'Va, en cuanto lo tenga te aviso 🙌', datos: {}, accion: 'seguir' };
    return null;
  };
  await dice('ok', C);
  ok('«ok» con la plática vieja: contesta la IA, sin espera', textos(C).slice(-1)[0], 'Va, en cuanto lo tenga te aviso 🙌');
  ok('  y sin ticket al dueño', textos(DUENO).filter((t) => /Precio por confirmar/.test(t)).length, 0);
}

/* ============================================================ */
titulo('después de las fotos, la pregunta es para el cliente, no para la IA');
{
  /* Visto en producción el 7-sep-2026: «¿Te saco el precio? Dime si salen de
     la zona metropolitana de Guadalajara. Pregunta EXACTAMENTE eso… datos.origen
     = "Guadalajara"». Era el texto de instrucciones de `loQueFalta`. */
  limpia();
  const C = '5213366670211';
  laIA = function (t) {
    if (/vallarta/i.test(t)) return { respuesta: 'Vallarta, va. ¿Qué día salen?', datos: { destino: 'Puerto Vallarta' }, accion: 'seguir' };
    if (/9 de septiembre/i.test(t)) return { respuesta: 'Listo. ¿Y regresan?', datos: { salida: '2026-09-09' }, accion: 'seguir' };
    if (/el 14/i.test(t)) return { respuesta: 'Del 9 al 14. ¿Como cuántos van?', datos: { regreso: '2026-09-14' }, accion: 'seguir' };
    if (/somos 12/i.test(t)) return { respuesta: '12 van perfecto en Sprinter. ¿Salen de la zona metropolitana de Guadalajara?', datos: { gente: 12 }, accion: 'seguir' };
    if (/fotos/i.test(t)) return { respuesta: null, datos: {}, unidadPedida: 'sprinter', accion: 'fotos' };
    return null;
  };
  for (const t of ['a vallarta', 'el 9 de septiembre', 'el 14', 'somos 12']) await dice(t, C);
  const antes = textos(C).length;
  await dice('mándame fotos', C);
  const nuevos = textos(C).slice(antes).join('\n');
  okQue('llegaron las fotos', mandados.some((m) => mismo(m.to, C) && m.image));
  okQue('el remate NO trae instrucciones internas', !/EXACTAMENTE|datos\.|ver lista|lo más común\)/.test(nuevos));
  okQue('  y sí trae una pregunta para el cliente', /\?/.test(nuevos));

  /* El peor caso: la IA misma repite sus instrucciones como respuesta. */
  const antes2 = textos(C).length;
  laIA = function () {
    return { respuesta: '¿Te saco el precio? Dime si salen de la zona metropolitana de Guadalajara. Pregunta EXACTAMENTE eso, para que solo diga «sí». Con «sí», datos.origen = "Guadalajara".', datos: {}, accion: 'seguir' };
  };
  await dice('y luego?', C);
  const nuevos2 = textos(C).slice(antes2).join('\n');
  okQue('si la IA repite sus instrucciones, al cliente NO le llegan', !/EXACTAMENTE|datos\./.test(nuevos2));
  okQue('  y el cliente recibe algo del guion en su lugar', nuevos2.trim().length > 0);
}

/* ============================================================ */
titulo('RFC y razón social: «pregúntame a mí» (7-sep-2026)');
{
  limpia();
  const C = '5213366670210';
  laIA = function (t) {
    if (/rfc/i.test(t)) return { respuesta: null, datos: {}, accion: 'dueno' };
    return null;
  };
  await dice('me pasas tu rfc y razón social para la factura?', C);
  ok('el cliente recibe «en breve te paso ese dato»', textos(C).slice(-1)[0], 'Va, en breve te paso ese dato 🙌');
  const alDueno = textos(DUENO).join('\n');
  okQue('al dueño le llega la pregunta tal cual, como ticket', /Un cliente pregunta/.test(alDueno) && /rfc y razón social/i.test(alDueno));
  okQue('  el bot no inventó ningún RFC', !/[A-Z]{3,4}\d{6}[A-Z0-9]{3}/.test(textos(C).join('\n')));
  /* El dueño contesta citando el ticket: le llega literal al cliente. */
  let idx = -1; mandados.forEach(function (m, i) { if (mismo(m.to, DUENO)) idx = i; });
  const ticket = 'wamid.s' + (idx + 1);
  const cuerpo = JSON.stringify({ entry: [{ changes: [{ value: { metadata: { phone_number_id: '111' },
    messages: [{ id: 'wamid.rfc1', from: DUENO, type: 'text', text: { body: 'Eurotravel SA de CV, RFC EUR010101ABC' }, context: { id: ticket } }] } }] }] });
  await atiende(new Request('https://x/api/whatsapp', { method: 'POST', body: cuerpo, headers: { 'x-hub-signature-256': firma(cuerpo) } }));
  ok('lo que el dueño contesta le llega al cliente tal cual', textos(C).slice(-1)[0], 'Eurotravel SA de CV, RFC EUR010101ABC');
}

/* ============================================================ */
titulo('destinos de un día: se pregunta «¿es ida y vuelta el mismo día?»');
{
  const bot = (await import(pathToFileURL(path.join(RAIZ, 'bot.js')).href)).default;
  /* `loQueFalta` recalcula el paso con lo que se sabe: con destino y salida,
     lo que sigue es el regreso. */
  ['Tequila', 'Chapala', 'una boda en Tlajomulco', 'Tapalpa'].forEach(function (d) {
    okQue('para ' + d + ' la pregunta es la del mismo día', /ida y vuelta el mismo d[ií]a/.test(bot.loQueFalta({ destino: d, salida: '2026-09-08' }) || ''));
  });
  ['Puerto Vallarta', 'Cancún', 'Ciudad de México'].forEach(function (d) {
    okQue('para ' + d + ' se pregunta qué día regresan', /^qué día regresan/.test(bot.loQueFalta({ destino: d, salida: '2026-09-08' }) || ''));
  });
  okQue('al preguntar cuántos, se le recuerda a la IA que nombre la unidad', /Sprinter/.test(bot.loQueFalta({ destino: 'Tequila', salida: '2026-09-08', regreso: '2026-09-08' }) || ''));
}

/* ============================================================ */
titulo('lo que la IA no puede decir, no sale');
{
  limpia();
  const C = '5213366670202';
  laIA = function () { return { respuesta: 'Te sale en $18,000 con todo incluido', datos: {}, accion: 'seguir' }; };
  await dice('hola', C);
  const t = textos(C).join('\n');
  okQue('un precio alucinado se descarta y el guion contesta de respaldo', t.length > 0 && !/\$/.test(t));
  laIA = function () { return { respuesta: 'Soy un bot, pero con gusto te ayudo', datos: {}, accion: 'seguir' }; };
  mandados = [];
  await dice('a chapala', C);
  okQue('«soy un bot» se descarta', !/bot/i.test(textos(C).join('\n')) && textos(C).length > 0);
}

/* ============================================================ */
titulo('sin IA, el guion sigue solo');
{
  limpia();
  const C = '5213366670203';
  laIA = function () { return null; };   // 500
  await dice('hola', C);
  okQue('la IA caída: el guion saluda', /Eurotravel/.test(textos(C).join('\n')));
  await dice('a chapala', C);
  okQue('  y sigue el guion (pregunta la fecha)', /d[ií]a salen/i.test(textos(C).join('\n')));
}

/* ============================================================ */
titulo('las acciones salen por el motor');
{
  limpia();
  const C = '5213366670204';
  laIA = function (t) {
    if (/fotos/i.test(t)) return { respuesta: null, datos: {}, accion: 'fotos' };
    if (/persona/i.test(t)) return { respuesta: null, datos: {}, accion: 'persona' };
    return { respuesta: 'Va. ¿A dónde van?', datos: {}, accion: 'seguir' };
  };
  await dice('hola', C);
  mandados = [];
  await dice('tienen fotos de la sprinter?', C);
  okQue('«fotos»: al cliente le llegan imágenes', mandados.some((m) => mismo(m.to, C) && (m.type === 'image' || m.type === 'video')));
  mandados = [];
  await dice('quiero hablar con una persona', C);
  okQue('«persona»: el cliente recibe la respuesta del guion', textos(C).length >= 1);
  okQue('  y al dueño le llega el aviso', textos(DUENO).length >= 1);
}

/* ============================================================ */
titulo('fotos y video de LA unidad que piden (5-sep-2026)');
{
  limpia();
  const C = '5213366670206';
  laIA = function (t) {
    if (/fotos del i6\b/i.test(t)) return { respuesta: null, datos: {}, unidadPedida: 'irizar-i6', accion: 'fotos' };
    if (/video/i.test(t)) return { respuesta: null, datos: {}, accion: 'video' };
    if (/ibiza tv/i.test(t)) return { respuesta: 'El i6S es de los buenos: 51 lugares, premium, baño y dos puertas. ¿Como cuántos van?', datos: {}, accion: 'seguir' };
    return { respuesta: 'Va. ¿A dónde van?', datos: {}, accion: 'seguir' };
  };
  await dice('que onda con el ibiza tv, es bueno?', C);
  okQue('la pregunta por la unidad la contesta la IA con datos', /51 lugares/.test(textos(C).slice(-1)[0] || ''));
  mandados = [];
  await dice('mandame fotos del i6', C);
  const fotos = mandados.filter((m) => mismo(m.to, C) && m.type === 'image').map((m) => (m.image && m.image.link) || '');
  ok('«fotos del i6»: llegan hasta 3 fotos', fotos.length, 3);
  okQue('  y son del i6, no del i6S', fotos.every((f) => /\/irizar-i6\//.test(f)) && !fotos.some((f) => /i6s/.test(f)));
  /* El pie viaja DENTRO de la imagen (caption), no como texto aparte. */
  okQue('  con pie que nombra la unidad', mandados.some((m) => mismo(m.to, C) && m.image && /Irizar i6/.test(m.image.caption || '')));
  mandados = [];
  await dice('tienes video de esa?', C);
  okQue('«video»: llega la liga de YouTube', /youtube\.com\/watch/.test(textos(C).join('\n')));
  okQue('  y no vuelve a mandar las mismas fotos', !mandados.some((m) => mismo(m.to, C) && m.type === 'image'));
}

/* ============================================================ */
titulo('con el agente apagado, todo sigue como antes');
{
  limpia();
  process.env.AGENTE_IA = '0';
  const C = '5213366670205';
  laIA = function () { return { respuesta: 'NO DEBERÍA SALIR', datos: {}, accion: 'seguir' }; };
  await dice('hola', C);
  okQue('AGENTE_IA=0: contesta el guion', /Eurotravel/.test(textos(C).join('\n')) && !/NO DEBERÍA/.test(textos(C).join('\n')));
  process.env.AGENTE_IA = '1';
}

console.log('\n' + buenas + ' buenas, ' + malas + ' malas');
process.exit(malas ? 1 : 0);
