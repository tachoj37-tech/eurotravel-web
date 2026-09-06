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
  await atiende(new Request('https://x/api/whatsapp', { method: 'POST', body: cuerpo, headers: { 'x-hub-signature-256': firma(cuerpo) } }));
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
  okQue('con todo junto, el motor cotiza: el cliente recibe la espera (compuerta)', /te paso el precio en un momento/.test(alCliente));
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
  okQue('el cliente recibe la espera con disponibilidad (fecha cercana)', /checo disponibilidad/.test(alCliente));
  okQue('  y NUNCA «mándale esto por WhatsApp al…»', !/M[aá]ndale esto|33 2400/.test(alCliente));
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
