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

/* 13-sep-2026: los avisos al dueño quedaron APAGADOS por omisión (dictado:
   «no quiero que me mandes nada a mi número»). Esta batería prueba ese
   canal, que sigue vivo detrás del interruptor, así que lo enciende. El
   apagado se comprueba aparte, en probar-nada-al-dueno.mjs. */
process.env.AVISOS_AL_DUENO = '1';
process.env.HOY_DE_PRUEBA = '2026-09-05';
process.env.DISPONIBILIDAD_API_KEY = 'llave-de-lectura-de-mentiras';
process.env.ANTHROPIC_API_KEY = 'clave-de-mentiras';
process.env.SITIO_URL = 'https://eurotravel-web.vercel.app';
process.env.CONFIRMAR_PRECIOS = '1';
process.env.CONFIRMAR_DISPONIBILIDAD = '1';
process.env.AGENTE_IA = '1';
/* ------------------------------------------------------------
   ESTE ARCHIVO PRUEBA EL CAMINO AUTOMÁTICO, CON LA VARIABLE EN 0
   ------------------------------------------------------------
   Desde el 10-sep-2026 el bot en producción llega HASTA la cotización y
   ahí entrega el chat a una persona (BOT_HASTA_COTIZACION=1). Lo que
   hacía solo después del precio —el apartado con la CLABE, el acuse del
   comprobante, las preguntas del contrato— no se borró: ahora lo dispara
   la persona con una palabra, y sigue existiendo tal cual.

   Estas pruebas describen ESE camino, así que fijan la variable en 0 a
   propósito. No son pruebas obsoletas: son las que garantizan que apagar
   el relevo devuelve el bot completo. El camino nuevo se prueba aparte.
   ------------------------------------------------------------ */
process.env.BOT_HASTA_COTIZACION = '0';

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
function textos(para) { return mandados.filter((m) => mismo(m.to, para)).map((m) => (m.text && m.text.body) || (m.interactive && m.interactive.body && m.interactive.body.text) || ''); }
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
  /* Cambió de lado el 13-sep-2026. Esto exigía que el «hola» lo contestara
     la IA; desde el 12-sep el dueño dictó el saludo con «¿Qué necesitas?» y
     dos botones, y la IA no manda botones: en su prueba desde su número el
     saludo nunca salió. El saludo es del guion; la IA sigue desde el
     mensaje siguiente, y sabe qué se dijo (ver la línea del contexto). */
  okQue('«hola»: contesta el saludo con «¿Qué necesitas?», no la IA', /¿Qué necesitas\?/.test(textos(C).slice(-1)[0] || ''));
  const botones = (mandados.filter((m) => mismo(m.to, C)).slice(-1)[0] || {}).interactive;
  okQue('  con sus dos botones', !!botones && JSON.stringify(botones).includes('Cotizar un viaje') && JSON.stringify(botones).includes('Hablar con alguien'));
  await dice('bien y tu?', C);
  ok('«bien y tú?» es plática, no destino', textos(C).slice(-1)[0], 'Muy bien, gracias. Cuéntame, ¿a dónde van?');
  okQue('  y el guion NO guardó «Bien y Tu?» como destino', !textos(C).join('\n').includes('Bien y Tu'));
  const s = sistemasVistos[sistemasVistos.length - 1] || [];
  okQue('  la IA recibió el contexto (hoy, lo sabido, últimos mensajes)', JSON.stringify(s).includes('ÚLTIMOS MENSAJES') && JSON.stringify(s).includes('Cliente: hola'));
  await dice('a vta', C);
  await dice('pasado', C);
  await dice('regresamos el 9', C);
  const antesDeLos12 = mandados.length;
  await dice('somos aprox 12', C);
  /* Dictado del dueño, 16-sep-2026: «cuando alguien elija una unidad le
     mande fotos». Con 12 la unidad es la Sprinter y queda elegida en ese
     turno: salen sus tres fotos, la de afuera primero (`orden` en
     medios-unidades.js), con pie, y una sola vez por plática. */
  const fotosAlElegir = mandados.slice(antesDeLos12).filter((m) => mismo(m.to, C) && m.image && m.image.link);
  ok('al quedar la Sprinter salen sus 3 fotos', fotosAlElegir.length, 3);
  okQue('  la primera es la de afuera (sprinter-01) y lleva pie con el nombre',
    /sprinter-01\.jpg$/.test(fotosAlElegir[0] ? fotosAlElegir[0].image.link : '') && /Sprinter/.test((fotosAlElegir[0] && fotosAlElegir[0].image.caption) || ''));
  await dice('salimos de gdl', C);
  const antesDelPrecio = textos(C).length;
  const mandadosAntesDeLaEspera = mandados.length;
  await dice('solo nos llevan y traen', C);
  const alCliente = textos(C).slice(antesDelPrecio).join('\n');
  const alDueno = textos(DUENO).join('\n');
  okQue('con todo junto, el motor cotiza: el cliente recibe la espera (compuerta)', /en un momento te paso tu precio/i.test(alCliente));
  /* «No me pidió unidad, el cliente no sabe en qué lo llevan» (7-sep-2026). */
  /* Cambió el 10-sep-2026: la espera pasó de una línea a un resumen del
     viaje completo, para que el vendedor cotice leyendo solo ese mensaje.
     La unidad sigue ahí —que es lo que esta línea vigila—, ahora en su
     renglón: «🚌 Sprinter · 12 personas». */
  okQue('  y la espera le dice en qué lo llevan (Sprinter para 12)',
    /Sprinter · 12 personas/.test(alCliente));
  okQue('  y trae el viaje completo, para no releer la conversación',
    /Guadalajara → Puerto Vallarta/.test(alCliente) && /Sin movimientos/.test(alCliente));
  okQue('  y le ofrece corregir si algo está mal',
    /algo de arriba está mal/i.test(alCliente));
  /* Reparación Falla 6 (8-sep-2026): la foto va con el PRECIO, no con la
     espera (esa queda apagada por bandera FOTO_CON_LA_ESPERA). */
  const fotosAlCliente = mandados.slice(mandadosAntesDeLaEspera).filter((m) => mismo(m.to, C) && m.image && m.image.link);
  ok('  y con la espera NO va foto (ya las vio al elegir; y la del precio va con el precio)', fotosAlCliente.length, 0);
  const instrucciones = JSON.stringify(sistemasVistos[sistemasVistos.length - 1] || []);
  okQue('  la IA sabe que para Tequila/Chapala pregunta «¿Es ida y vuelta el mismo día?»', /Es ida y vuelta el mismo d[ií]a/.test(instrucciones));
  okQue('  y que nombra la unidad en el mismo mensaje en que le dicen cuántos', /EN EL MISMO MENSAJE/.test(instrucciones));
  okQue('  y al dueño le llega el ticket de precio', /Precio por confirmar/.test(alDueno));
  okQue('  con Puerto Vallarta, 12 pax y las fechas', /Vallarta/.test(alDueno) && /12 pax/.test(alDueno));
  okQue('  el cliente nunca vio un precio ni un «no entendí»', !/\$\s?\d|no entend|no me qued/i.test(textos(C).join('\n')));
  /* 8 mensajes, 7 llamadas: el «hola» lo contesta el guion desde el
     13-sep-2026 (ver arriba). Una llamada por cada mensaje que sí es de la IA. */
  ok('  una llamada a la IA por mensaje (menos el saludo)', llamadasALaIA, 7);
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
  okQue('el cliente recibe la espera: «en breve te paso tu cotización y la disponibilidad»', /en un momento te paso tu precio y la disponibilidad/i.test(alCliente));
  okQue('  y NUNCA «mándale esto por WhatsApp al…»', !/M[aá]ndale esto|33 2400/.test(alCliente));
  /* El calendario se pregunta por CATEGORÍA (AUTOBUS), no por el nombre
     del camión: con «NEOBUS» EuroSystem contestaba 422 y el ticket iba sin
     calendario. */
  okQue('  el calendario se consultó como AUTOBUS, no como «NEOBUS»', /tipo=AUTOBUS/.test(calendarioPedido.slice(-1)[0] || ''));
  /* CAMBIÓ DE LADO EL 10-sep-2026. Pedía que el ticket dijera «escríbeme el
     precio», o sea que llegara sin un solo número. Y llegaba sin número
     aunque el Neobus a Vallarta estuviera escrito en el Excel desde
     siempre ($34,000, columna «NEOBUS/i6 50/51 PAX»): el motor solo cotiza Sprinter,
     así que las otras seis columnas del catálogo eran datos muertos.

     Lo que sigue siendo cierto —y es lo que esta aserción cuida ahora— es
     que el bot NO cotiza el camión: le enseña al dueño el renglón de su
     lista, diciendo de qué columna salió, y el precio lo pone él. */
  okQue('  al dueño le llega su ticket de precio', /Precio por confirmar/.test(alDueno));
  /* El rótulo es el de SU hoja, copiado de la captura que mandó el
     10-sep-2026, para que encuentre el renglón sin traducir nada. */
  okQue('  con el renglón del Excel para el Neobus, nombrando la columna',
    /Del Excel: \*\$34,000\*/.test(alDueno) && /columna «NEOBUS\/i6 50\/51 PAX»/.test(alDueno));
  okQue('  y sin un precio calculado por el motor', !/Calculado:/.test(alDueno));
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
  const esperas = () => textos(C).filter((t) => /en un momento te paso tu precio/i.test(t)).length;
  ok('la espera salió una vez', esperas(), 1);
  /* 16-sep-2026, dictado del dueño: el resumen de la cotización dice qué
     incluye, con combustible y casetas en renglones aparte y con emoji. */
  const laEspera = textos(C).filter((t) => /en un momento te paso tu precio/i.test(t))[0] || '';
  okQue('  y el resumen dice qué incluye, renglón por renglón',
    /Incluye:\n👨‍✈️ Operador profesional\n⛽ Combustible\n🛣️ Casetas\n🛡️ Seguro de viajero\n📡 Monitoreo GPS 24\/7\n/.test(laEspera));
  const tickets = () => textos(DUENO).filter((t) => /Precio por confirmar/.test(t)).length;
  ok('  y un ticket al dueño', tickets(), 1);

  await dice('ok', C);
  ok('«ok» después de la espera: NO se repite la espera', esperas(), 1);
  ok('  ni llega otro ticket', tickets(), 1);
  /* Cambió el 8-sep-2026 (R14): dos «Va» seguidos suenan a máquina, así que
     la muletilla repetida se recorta. Y cambió otra vez el 10-sep-2026: la
     espera ya no abre con «Va.» sino con «Perfecto, ya tengo todo tu
     viaje», así que no hay muletilla que repetir y el «Va,» de la IA se
     queda. El candado sigue vivo; lo que cambió es que ya no aplica aquí. */
  ok('  contesta la IA, y ya no hay «Va» repetido que recortar', textos(C).slice(-1)[0], 'Va, en cuanto lo tenga te aviso 🙌');
  const s1 = JSON.stringify(sistemasVistos[sistemasVistos.length - 1] || []);
  okQue('  y la IA supo que el precio ya estaba pedido', s1.includes('PRECIO YA PEDIDO'));

  await dice('quiero cotizar otro viaje a mazamitla', C);
  ok('«otro viaje»: NO se repite la espera', esperas(), 1);
  ok('  la IA pregunta lo que sigue del viaje nuevo', textos(C).slice(-1)[0], 'Mazamitla, va. ¿Qué día salen?');
  await dice('el 20', C);
  const s2 = JSON.stringify(sistemasVistos[sistemasVistos.length - 1] || []);
  /* Lo SABIDO del viaje nuevo es solo Mazamitla; el de Vallarta aparece
     aparte, como «precio ya pedido», para que la IA no lo confunda. */
  /* Desde el 9-sep-2026 la fecha también queda fijada aquí: con el viaje
     conocido y sin salida, la fecha que traiga el mensaje ES la salida (el
     modelo la trataba como pregunta y el viaje se quedaba sin fecha). Lo
     que se vigila sigue siendo lo mismo: que el viaje nuevo NO arrastre
     nada del de Vallarta, que aparece aparte como precio ya pedido. */
  const sabido = (s2.split('YA SE SABE DEL VIAJE:')[1] || '').split('\\n')[0];
  okQue('  el viaje nuevo empezó de cero: Mazamitla, sin nada de Vallarta',
    /destino=Mazamitla/.test(sabido) && !/Vallarta/.test(sabido));
  okQue('  y el de Vallarta sigue aparte, como precio ya pedido', /PRECIO YA PEDIDO[^\\]*Vallarta/.test(s2));
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
  mandados.forEach(function (m, i) { if (mismo(m.to, DUENO) && /Precio por confirmar/.test((m.text && m.text.body) || (m.interactive && m.interactive.body && m.interactive.body.text) || '')) idsDeTickets.push('wamid.s' + (i + 1)); });
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
titulo('con 50 nunca se ofrece un autobús de 47 (7-sep-2026)');
{
  limpia();
  const C = '5213366670212';
  laIA = function (t) {
    if (/vallarta/i.test(t)) return { respuesta: 'Vallarta, va. ¿Qué día salen?', datos: { destino: 'Puerto Vallarta' }, accion: 'seguir' };
    if (/9 de septiembre/i.test(t)) return { respuesta: 'Listo. ¿Y regresan?', datos: { salida: '2026-09-09' }, accion: 'seguir' };
    if (/el 14/i.test(t)) return { respuesta: 'Del 9 al 14. ¿Como cuántos van?', datos: { regreso: '2026-09-14' }, accion: 'seguir' };
    /* La IA se equivoca y ofrece el i6 de 47 y el Century de 49 para 50. */
    if (/somos 50/i.test(t)) return { respuesta: 'Para 50 les caben:\nIrizar i6 — Premium — 47 asientos\nIrizar Century — Clásico — 49 asientos\nNeobus — Gran Turismo — 50 asientos\n¿Cuál te late?', datos: { gente: 50 }, accion: 'seguir' };
    return null;
  };
  for (const t of ['a vallarta', 'el 9 de septiembre', 'el 14']) await dice(t, C);
  await dice('somos 50', C);
  const lista = textos(C).slice(-1)[0];
  /* Dictado del dueño, 7-sep-2026: primero los que caben («se ajustan a la
     capacidad»), y HASTA EL FINAL los que no, como otras opciones. */
  const corte = lista.indexOf('no caben');
  okQue('el mensaje tiene su parte de «no caben, pero también tenemos otras opciones»', corte > 0 && /otras opciones por si gustas/.test(lista));
  const antesDelCorte = lista.slice(0, corte), despuesDelCorte = lista.slice(corte);
  okQue('primero van los que caben (G8, i6S, Neobus)', /G8/.test(antesDelCorte) && /i6S/.test(antesDelCorte) && /Neobus/.test(antesDelCorte));
  okQue('  y dice que se ajustan a la capacidad / que son los que les caben', /se ajustan a la capacidad/.test(antesDelCorte) && /porque son los que les caben/.test(antesDelCorte));
  /* CAMBIÓ DE LADO EL 16-sep-2026: en el chat el i6 es UNA unidad de «47 y
     51» (dictado del dueño: «júntalo»), así que a 50 sí les cabe. El
     Century, «47 y 49», no. */
  okQue('el Irizar i6 (47 y 51) SÍ va entre los que caben', /Irizar i6 — Premium — 47 y 51 asientos/.test(antesDelCorte));
  okQue('el Century (47 y 49) NO va entre los que caben', !/Irizar Century —/.test(antesDelCorte));
  okQue('  pero sí sale al final, como otra opción, con sus dos capacidades',
    /Irizar Century — Clásico — 47 y 49 asientos/.test(despuesDelCorte));
  okQue('  y ya no hay un «Irizar Century 49» ni un «Irizar i6 51» aparte',
    !/Century 49/.test(lista) && !/i6 51/.test(lista));
  okQue('  cierra preguntando cuál', /¿Cuál te late\?/.test(lista));
}

/* ============================================================ */
titulo('los dos Centurys: cada grupo cae en el que le toca (12-sep-2026)');
{
  const bot = (await import(pathToFileURL(path.join(RAIZ, 'bot.js')).href)).default;
  const caben = function (n) { return bot.autobusesPara(n).caben.join('\n'); };
  const noCaben = function (n) { return bot.autobusesPara(n).noCaben.join('\n'); };

  /* ------------------------------------------------------------
     CAMBIÓ DE LADO EL 12-sep-2026, Y LO CAMBIÓ EL DUEÑO

     Decía «el Century cuenta como 49: con 48 se ofrece, con 49 no». Era
     UN Century con `max` 48 —el asiento de margen de su dictado del
     7-sep— cubriendo las dos columnas del Excel.

     Él lo partió: «irizar century 47 es uno, irizar century de 49 es
     otro… son unidades con diferentes precios, no los pongas en una misma
     unidad». Y el Excel le da la razón: Mazatlán son $38,000 en la columna
     del de 47 y $40,000 en la del de 49.

     Ahora no hay que elegir un `max` de compromiso: cada uno tiene su
     capacidad real, y el grupo cae en el que le toca. El margen que daba
     el 48 sale solo — con 48 personas se ofrece el de 49, no el de 47.

     OJO: `unidades.js` lo comparten la página y el bot, así que esto
     también cambia lo que el bot ofrece por WhatsApp. No se tocó `bot.js`
     —el catálogo es uno solo y así debe ser—, pero el efecto es de los dos
     lados y conviene saberlo.
     ------------------------------------------------------------ */
  /* Y VOLVIÓ A CAMBIAR EL 16-sep-2026, también por el dueño: «el irizar i6
     júntalo, o sea refiérete a él como irizar i6 47 y 51 pasajeros, lo
     mismo con el century. Esto solo aplica en el chat». El catálogo del
     sitio sigue con las dos columnas; en el chat cada uno es UNA unidad
     con sus dos capacidades y el grupo cabe si cabe en la grande. */
  const century = /Irizar Century — Clásico — 47 y 49 asientos/;
  const i6 = /Irizar i6 — Premium — 47 y 51 asientos/;

  okQue('con 46 cabe el Century (47 y 49)', century.test(caben(46)));
  okQue('con 48 sigue cabiendo (por el de 49)', century.test(caben(48)));
  okQue('con 49 también', century.test(caben(49)));
  okQue('con 50 ya no cabe', !century.test(caben(50)) && century.test(noCaben(50)));
  okQue('  y no hay ningún «Century 49» aparte', !/Century 49/.test(caben(46) + noCaben(46)));

  okQue('con 46 también caben el i6 y el PB', i6.test(caben(46)) && /Irizar PB/.test(caben(46)));
  okQue('con 48, el PB (47) ya no cabe pero el i6 (47 y 51) sí', /Irizar PB/.test(noCaben(48)) && i6.test(caben(48)));
  okQue('con 50 caben G8, i6S, Neobus y el i6', /G8/.test(caben(50)) && /i6S/.test(caben(50)) && /Neobus/.test(caben(50)) && i6.test(caben(50)));
  okQue('  y no caben el PB ni el Century', /Irizar PB/.test(noCaben(50)) && century.test(noCaben(50)));
  okQue('con 52 no cabe ninguno y se ofrecen dos unidades', bot.autobusesPara(52).caben.length === 0 && /dos unidades/.test(bot.mensajeDeAutobuses(52)));
  const m = bot.mensajeDeAutobuses(50);
  okQue('el mensaje de 50 pone los que caben ANTES de «no caben»', m.indexOf('G8') < m.indexOf('no caben') && m.indexOf('Neobus') < m.indexOf('no caben'));
  okQue('  y los que no caben DESPUÉS', m.indexOf('Century') > m.indexOf('no caben') && m.indexOf('Irizar PB') > m.indexOf('no caben'));
  okQue('con 21 caben todos y no hay parte de «no caben»', bot.autobusesPara(21).noCaben.length === 0 && !/no caben/.test(bot.mensajeDeAutobuses(21)));
  okQue('la instrucción a la IA trae el mensaje con ese orden', /no caben, pero también tenemos otras opciones/.test(bot.loQueFalta({ destino: 'Puerto Vallarta', salida: '2026-09-09', regreso: '2026-09-14', gente: 50 }) || ''));
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

/* ============================================================ */
titulo('si ya pidió fotos de la unidad, con el precio no se le repite la foto (8-sep-2026)');
{
  limpia();
  const C = '5213366670222';
  laIA = function (t) {
    if (/tequila/i.test(t)) return { respuesta: 'Tequila, va. ¿Qué día salen?', datos: { destino: 'Tequila' }, accion: 'seguir' };
    if (/20 de septiembre/i.test(t)) return { respuesta: '¿Es ida y vuelta el mismo día?', datos: { salida: '2026-09-20' }, accion: 'seguir' };
    if (/^s[ií], mismo/i.test(t)) return { respuesta: 'Listo. ¿Como cuántos van?', datos: { regreso: '2026-09-20' }, accion: 'seguir' };
    if (/somos 15/i.test(t)) return { respuesta: 'Para 15 la unidad es la Sprinter. ¿Salen de la zona metropolitana de Guadalajara?', datos: { gente: 15 }, accion: 'seguir' };
    if (/fotos/i.test(t)) return { respuesta: null, datos: {}, accion: 'fotos', unidadPedida: 'sprinter' };
    if (/^s[ií]$/i.test(t)) return { respuesta: null, datos: { origen: 'Guadalajara' }, accion: 'cotizar' };
    return null;
  };
  await dice('vamos a tequila', C);
  await dice('el 20 de septiembre', C);
  await dice('sí, mismo día', C);
  await dice('somos 15', C);
  await dice('tienes fotos de la sprinter?', C);
  const fotosPedidas = mandados.filter((m) => mismo(m.to, C) && m.image && m.image.link).length;
  okQue('al pedir fotos llegan fotos de la Sprinter', fotosPedidas >= 1);
  okQue('  y la plática recuerda que ya las vio', ((webhook.charlaDe(C) || {}).fotosVistas || []).indexOf('sprinter') >= 0);
  const antesDelPrecio = mandados.length;
  await dice('sí', C);
  const alCliente = textos(C).slice(-2).join('\n');
  okQue('con todo, llega la espera del precio', /en un momento te paso tu precio/i.test(alCliente));
  const fotosConElPrecio = mandados.slice(antesDelPrecio).filter((m) => mismo(m.to, C) && m.image && m.image.link).length;
  ok('  y con el precio NO va otra vez la foto', fotosConElPrecio, 0);
  okQue('  y ningún mensaje dice «ésta es la que les tocaría»', !/les tocar[ií]a/.test(textos(C).join('\n')));
}

/* ============================================================ */
titulo('el candado se saca del prompt en vivo: ninguna regla suelta le llega al cliente (auditoría 7-sep-2026, 1)');
{
  /* La auditoría comprobó que de 242 renglones del prompt, 205 pasaban el
     candado viejo (que solo tenía las cadenas del incidente). Ahora el
     candado se arma con el prompt mismo. */
  const conversacion = (await import(pathToFileURL(path.join(RAIZ, 'bot.js')).href)).default;
  /* Se miden las INSTRUCCIONES (sin la psicología de ventas ni «lo único
     cierto», que son frases que la IA sí debe decir; auditoría del 8-sep). */
  const prompt = agente.soloInstrucciones(agente.instruccionesDelAgente({}));
  const reglas = prompt.split('\n').filter((r) => r.trim().length >= 30 && !/^\s*(\{|Cliente:)/.test(r));
  const pasan = reglas.filter((r) => !agente.esTextoInterno(r));
  okQue('de ' + reglas.length + ' renglones de instrucciones, pasan el candado a lo más 25 (pasan ' + pasan.length + ')', pasan.length <= 25);
  okQue('  y los que pasan son puras frases de ejemplo entre comillas', pasan.every((r) => /«|"/.test(r)));
  /* La regla exacta que se fugó el 7-sep, tal como la escribe el prompt
     («es» en vez de «=»): frenada. */
  okQue('la regla del origen, tal como está en el prompt, se frena',
    agente.esTextoInterno('· El origen se pregunta como sí/no: «¿Salen de la zona metropolitana de Guadalajara?». Con «sí», datos.origen es "Guadalajara"; solo si dice que no, pregunta de qué ciudad.'));
  okQue('  también sin el «datos.»', agente.esTextoInterno('El origen se pregunta como sí/no: «¿Salen de la zona metropolitana de Guadalajara?». Solo si dice que no, pregunta de qué ciudad.'));
  okQue('  «Con el número de personas TÚ dices la unidad; no la preguntas…»', agente.esTextoInterno('Con el número de personas TÚ dices la unidad; no la preguntas. Los datos llegan en cualquier orden, de golpe o de a poco.'));
  okQue('  «"accion":"seguir"» suelto', agente.esTextoInterno('"accion":"seguir"'));
  okQue('  la frase del «mismo día» con CUALQUIER destino, no solo Tequila (hallazgo 4)',
    agente.esTextoInterno('si es ida y vuelta el mismo día (lo más común para Chapala); pregunta EXACTAMENTE «¿Es ida y vuelta el mismo día?» y, si dice que sí, regreso = salida'));
  okQue('  la marca de plantilla (hallazgo 5)', agente.esTextoInterno('[plantilla eurotravel_toque1 · tu viaje a Puerto Vallarta]'));
  okQue('  y «[fecha]» sin llenar (hallazgo 10)', agente.esTextoInterno('Tu fecha [fecha] sigue libre, ¿te la aparto?'));
  /* Lo que SÍ puede decir: las frases de venta del guion y los ejemplos del prompt. */
  ['¡Qué tal! Bienvenido a Eurotravel 🚐 ¿A dónde va el plan?',
    '¿Salen de la zona metropolitana de Guadalajara?',
    'Para 20 la unidad es la Sprinter, es la que hay para grupos de hasta 20. ¿Qué día salen?',
    'Va, Chapala. ¿Es ida y vuelta el mismo día?',
    'Listo, i6S. Allá, ¿se van a andar moviendo con el camión o solo los llevamos y traemos?',
    'Va. En breve te paso tu cotización y la disponibilidad de tu viaje 🙌',
    'Salen en la noche, duermen en el camino y amanecen allá sin gastar en hotel. ¿Qué día salen?',
    'Te recomiendo el Neobus: es el que mejor se ajusta para 48 y trae baño. ¿Te late?',
    conversacion.mensajeDeAutobuses(50)
  ].forEach((f) => okQue('  pasa: «' + f.slice(0, 50).replace(/\n/g, ' ') + '…»', !agente.esTextoInterno(f)));

  /* Y de punta a punta: la IA repite una regla del prompt y el cliente
     recibe algo del guion en su lugar. */
  limpia();
  const C = '5213366670220';
  laIA = function (t) {
    if (/vallarta/i.test(t)) return { respuesta: 'Vallarta, va. ¿Qué día salen?', datos: { destino: 'Puerto Vallarta' }, accion: 'seguir' };
    return { respuesta: 'El origen se pregunta como sí/no: «¿Salen de la zona metropolitana de Guadalajara?». Solo si dice que no, pregunta de qué ciudad. Nunca preguntes zona, norte/sur, colonia ni dirección: eso se pide hasta el contrato.', datos: {}, accion: 'seguir' };
  };
  await dice('a vallarta', C);
  await dice('el 9 de septiembre', C);
  const todo = textos(C).join('\n');
  okQue('la regla NO le llegó al cliente', !/se pregunta como sí\/no|Nunca preguntes zona/.test(todo));
  okQue('  y sí recibió algo (el guion tomó la vuelta)', textos(C).length >= 2 && textos(C).slice(-1)[0].trim().length > 0);
}

/* ============================================================ */
titulo('a otro número nunca, desde la única puerta de salida (auditoría 7-sep-2026, 2 y 3)');
{
  limpia();
  const { manda } = await import(pathToFileURL(path.join(RAIZ, 'api', 'whatsapp.mjs')).href);
  const C = '5213366670221';
  const salio = await manda({ numeroDeOrigen: '111', para: C, pasaAPersona: false, escribio: '[prueba]',
    texto: 'Claro 🙌 Márcame o escríbeme al *33 2400 2285* y te atiendo.' });
  okQue('el envío sale', salio === true);
  ok('  pero al cliente le llega la espera honesta, sin el teléfono', textos(C).slice(-1)[0], 'Va, en breve te contestan por aquí mismo 🙌');
  okQue('  y al dueño el ticket de «quiere hablar contigo»', /Quiere hablar contigo/.test(textos(DUENO).join('\n')) && new RegExp(C).test(textos(DUENO).join('\n')));
  /* La marca de plantilla no sale como texto… */
  mandados = [];
  const bloqueado = await manda({ numeroDeOrigen: '111', para: C, pasaAPersona: false, texto: '[plantilla eurotravel_toque1 · tu viaje a Puerto Vallarta]' });
  /* Reparación del 8-sep-2026 (Falla 4): lo frenado no deja al cliente en
     silencio; recibe el texto neutro (y la marca nunca sale). */
  okQue('la marca «[plantilla …]» como texto se frena (sale el texto neutro, nunca la marca)',
    bloqueado === true && textos(C).length === 1 && /Dame un momento/.test(textos(C)[0]) && !/plantilla/.test(textos(C)[0]));
  /* …pero la plantilla de verdad sí se manda (el candado no la toca). */
  mandados = [];
  const plantilla = await manda({ numeroDeOrigen: '111', para: C, pasaAPersona: false,
    plantilla: { nombre: 'eurotravel_toque1', idioma: 'es_MX', parametros: ['tu viaje a Puerto Vallarta'] },
    texto: '[plantilla eurotravel_toque1 · tu viaje a Puerto Vallarta]' });
  okQue('  y la plantilla de verdad sí sale', plantilla === true && mandados.length === 1 && mandados[0].type === 'template');
}

/* ============================================================ */
titulo('auditoría general del 8-sep: el candado no se come las frases de venta (1)');
{
  [
    'Incluye chofer, combustible, casetas, seguro de viajero y GPS las 24 horas.',
    'Claro, es lana. ¿Sería mala idea apartarte la fecha mientras lo piensas, para que no se te vaya?',
    'Todas las unidades van con seguro de viajero y chofer con experiencia.',
    'Se aparta la fecha con un anticipo por transferencia y el resto lo liquidas antes de salir.',
    'Escuelas, empresas, familias y peregrinaciones viajan con nosotros; llevamos 14 años operando.',
    'Y allá tienen la unidad a su disposición para moverse.',
    'La Sprinter es de 20 pasajeros con aire, pantalla y asientos reclinables. ¿Te la aparto?',
    'Nadie se queda esperando en la banqueta: pasamos por ustedes a la hora que digan.'
  ].forEach((f) => okQue('pasa: «' + f.slice(0, 55) + '…»', !agente.esTextoInterno(f)));
  okQue('  y las instrucciones siguen frenadas',
    agente.esTextoInterno('· Hasta 20 personas SOLO HAY SPRINTER: no es una recomendación entre varias, es la unidad que hay para ese tamaño') &&
    agente.esTextoInterno('El origen se pregunta como sí/no: «¿Salen de la zona metropolitana de Guadalajara?». Solo si dice que no, pregunta de qué ciudad.'));
}

/* ============================================================ */
titulo('auditoría general del 8-sep: con precio dado, lo que sigue es apartar (8, 9, 12, 16)');
{
  const tk = (await import(pathToFileURL(path.join(RAIZ, 'api', '_tickets.js')).href)).default;
  const conPrecio = (C, extra) => tk.anotaEtapa(C, 'con_precio', Object.assign({
    total: 7000, anticipo: 1500,
    viajeDatos: { origen: 'Guadalajara', destino: 'Tequila', salida: '2026-09-20', regreso: '2026-09-20', gente: 15, unidad: 'Sprinter' }
  }, extra || {}), Date.now());

  /* 8 · fotos con el precio ya dado: el remate es de apartado. */
  limpia();
  let C = '5213366670230';
  conPrecio(C);
  laIA = () => ({ respuesta: null, datos: {}, accion: 'fotos', unidadPedida: 'sprinter' });
  await dice('mándame fotos de la sprinter', C);
  /* 8-sep-2026 («que deje de sonar a guion», MODO_GUION apagado): tras las
     fotos no sale ninguna pregunta enlatada; solo lo que la IA diga, o nada. */
  okQue('tras las fotos, a quien ya tiene precio NO se le pregunta «¿A dónde van?»', !/d[oó]nde van/i.test(textos(C).join('\n')));
  okQue('  y sin remate enlatado (las fotos hablan solas)', !/¿Te saco el precio\?|¿Te la aparto\?/.test(textos(C).join('\n')));
  okQue('  las fotos sí llegaron', mandados.some((m) => mismo(m.to, C) && m.image && /sprinter/i.test(m.image.link || '')));

  /* 9 · cambio de fecha después del precio: al dueño, no se confirma. */
  limpia();
  C = '5213366670231';
  conPrecio(C);
  laIA = (t) => /el 21/i.test(t) ? { respuesta: 'Va, checo el 21 y te digo.', datos: { salida: '2026-09-21' }, accion: 'seguir' } : null;
  await dice('oye y si mejor nos vamos el 21?', C);
  okQue('«mejor el 21»: al cliente «déjame checar ese cambio»', /d[eé]jame checar ese cambio/.test(textos(C).slice(-1)[0] || ''));
  okQue('  y NO le llegó el «checo el 21» de la IA', !/checo el 21/.test(textos(C).join('\n')));
  okQue('  al dueño le llega «Quiere cambiar la fecha» con la nueva', /Quiere cambiar la fecha/.test(textos(DUENO).join('\n')) && /21/.test(textos(DUENO).join('\n')));
  okQue('  y la ficha sigue con la fecha original', tk.fichaDe(C).viajeDatos.salida === '2026-09-20');

  /* 12 · con el chat en manos del dueño, el «ya no» no lo contesta el bot. */
  limpia();
  C = '5213366670232';
  conPrecio(C, { enManosDe: 'dueno' });
  laIA = () => null;
  await dice('ya no gracias', C);
  okQue('con el chat tomado por el dueño, el bot no contesta el «ya no»', !/Va, entendido/.test(textos(C).join('\n')));
  okQue('  y al dueño se le reenvía', /ya no gracias/.test(textos(DUENO).join('\n')));

  /* 16 · «ok» después del precio: la IA contesta y NO sale el «te están escribiendo». */
  limpia();
  C = '5213366670233';
  conPrecio(C);
  laIA = (t) => /^ok$/i.test(t) ? { respuesta: 'Perfecto, aquí ando para lo que necesites 🙌', datos: {}, accion: 'seguir' } : null;
  await dice('ok', C);
  okQue('«ok» con precio dado: contesta la IA', /aquí ando/.test(textos(C).slice(-1)[0] || ''));
  okQue('  y al dueño NO le llega «Te están escribiendo»', !/Te están escribiendo/.test(textos(DUENO).join('\n')));

  /* 3 · IA callada: el comprobante sí llega al dueño; el texto no se contesta pero cuenta como «contestó». */
  limpia();
  C = '5213366670234';
  conPrecio(C);
  tk.callaLaIA(C);
  const foto = JSON.stringify({ entry: [{ changes: [{ value: { metadata: { phone_number_id: '111' },
    messages: [{ id: 'wamid.foto-callada', from: C, type: 'image', image: { id: 'IMG1' } }] } }] }] });
  await atiende(new Request('https://x/api/whatsapp', { method: 'POST', body: foto, headers: { 'x-hub-signature-256': firma(foto) } }));
  okQue('con la IA callada, la foto del depósito SÍ le llega al dueño', mandados.some((m) => mismo(m.to, DUENO) && m.image && m.image.id === 'IMG1'));
  ok('  y la etapa subió a «mandó comprobante»', tk.fichaDe(C).etapa, 'mando_comprobante');
  const antesTexto = textos(C).length;
  await dice('ya te deposité', C);
  ok('  un texto suyo no se contesta (el dueño está en ese chat)', textos(C).length, antesTexto);
  okQue('  pero cuenta como «contestó» (clienteEn)', typeof tk.fichaDe(C).clienteEn === 'number');
  tk.liberaLaIA(C);
}

/* ============================================================ */
titulo('lo que el dueño teclea como comando no se anota en la plática del cliente (auditoría 7-sep-2026, 9)');
{
  const es = (t) => webhook.esComandoDelDueno({ text: { body: t } });
  okQue('«total 48000» es comando', es('total 48000') && es('total $48,000') && es('Total 48 mil'));
  okQue('«3312345678 yo» y «3312345678 bot» son comandos', es('3312345678 yo') && es('3312345678 bot') && es('+52 1 33 1234 5678: yo'));
  okQue('«tablero», «ver», «yo», «bot» siguen siendo comandos', es('tablero') && es('yo') && es('bot'));
  okQue('  pero lo que sí le dice a un cliente, no', !es('quedamos en 48,000') && !es('3312345678 quedamos en 48,000') && !es('va'));
}

/* ============================================================ */
titulo('la lista de autobuses con los asientos mal (i6 «47» en vez de «47 y 51») se cambia por la del motor (16-sep-2026)');
{
  mandados = [];
  const C = '5213366670499';
  /* Corrida real con el modelo (16-sep-2026, escenario u): copió un ejemplo
     viejo del prompt y escribió «Irizar i6 — Premium — 47 asientos» y
     «Irizar Century — Clásico — 47 asientos». En el chat son «47 y 51» y
     «47 y 49» (dictado del dueño). */
  laIA = function (t) {
    if (/somos 45/i.test(t)) return { respuesta: 'Para 45 les caben estos:\nMarcopolo Paradiso G8 — Premium — 51 asientos\nIrizar i6S — Premium — 51 asientos\nNeobus — Gran Turismo — 50 asientos\nIrizar i6 — Premium — 47 asientos\nIrizar PB — Turismo — 47 asientos\nIrizar Century — Clásico — 47 asientos\n¿Cuál te late?', datos: { gente: 45 }, accion: 'seguir' };
    return { respuesta: 'Va, ¿a dónde van?', datos: {}, accion: 'seguir' };
  };
  await dice('vamos a mazatlán', C);
  await dice('somos 45', C);
  const lista = textos(C).slice(-1)[0];
  okQue('la lista que llega dice «Irizar i6 — Premium — 47 y 51 asientos»', /Irizar i6 — Premium — 47 y 51 asientos/.test(lista));
  okQue('  y «Irizar Century — Clásico — 47 y 49 asientos»', /Irizar Century — Clásico — 47 y 49 asientos/.test(lista));
  okQue('  y no queda ningún «— 47 asientos» del i6 o del Century', !/Irizar i6 — Premium — 47 asientos/.test(lista) && !/Century — Clásico — 47 asientos/.test(lista));
}

/* ============================================================ */
titulo('«4» contestando «¿cuántos van?» es gente, no fecha; y «14 al 17 de octubre» manda sobre el estado (plática real del 16-sep-2026)');
{
  mandados = [];
  const C = '5213366670498';
  laIA = function (t) {
    if (/^vta$/i.test(t)) return { respuesta: '¿Puerto Vallarta? ¿Cuántos van y qué días?', datos: { destino: 'Puerto Vallarta' }, accion: 'seguir' };
    if (/^4$/.test(t.trim())) return { respuesta: 'Perfecto, 4 personas. ¿Qué día salen?', datos: { gente: 4 }, accion: 'seguir' };
    /* El modelo, con «salida=…» enfrente, solo mueve el regreso. */
    if (/14 al 17 de octubre/i.test(t)) return { respuesta: 'Listo, regresan el 17. ¿Salen de la zona metropolitana de Guadalajara?', datos: { regreso: '2026-10-17' }, accion: 'seguir' };
    return { respuesta: 'Va.', datos: {}, accion: 'seguir' };
  };
  await dice('vta', C);
  await dice('4', C);
  const charla4 = webhook.charlaDe(C);
  okQue('«4» tras «¿cuántos van?» no fija la salida en el 4 de octubre', !(charla4 && charla4.salida));
  await dice('14 al 17 de octubre', C);
  const charla = webhook.charlaDe(C);
  ok('el rango escrito manda: salida 14 de octubre', charla && charla.salida, '2026-10-14');
  ok('  y regreso 17 de octubre', charla && charla.regreso, '2026-10-17');
}

/* ============================================================ */
titulo('spec §5 (16-sep): molesto o pidiendo persona → a una persona a la primera, aunque la IA no lo escoja');
{
  limpia();
  /* Números nuevos: las fichas de los de arriba siguen vivas entre bloques. */
  const C = '5213366670251';
  laIA = function (t) {
    if (/vallarta/i.test(t)) return { respuesta: 'Vallarta, va. ¿Qué día salen?', datos: { destino: 'Puerto Vallarta' }, accion: 'seguir' };
    /* La IA de mentiras NO escoge persona: sigue como si nada. */
    return { respuesta: 'Perdón, ¿me repites la fecha?', datos: {}, accion: 'seguir' };
  };
  await dice('a vallarta', C);
  await dice('NO ME ENTIENDES NADA!!! pásame con alguien', C);
  /* 17-sep (simulación x13): el candado ya no pone texto propio; deja que
     el camino de «persona» conteste con su variante y marque esPersona,
     que es lo que apaga el bot por Kommo. */
  okQue('el cliente recibe el paso a persona', /te contestan por aquí|te atienden por aquí|te atiende|te contesta/.test(textos(C).slice(-1)[0] || ''));
  okQue('  y no la respuesta de la IA', !textos(C).some((t) => /me repites la fecha/.test(t)));
  limpia();
  const D = '5213366670252';
  await dice('a vallarta', D);
  await dice('no entiendo bien el precio, ¿me lo explicas?', D);
  /* Lo que conteste lo deciden la IA y sus guardias; lo que importa es que
     NO sea el paso a persona. */
  okQue('una duda normal NO pasa a persona', textos(D).length > 0 && !textos(D).some((t) => /te atiende alguien del equipo/.test(t)));
}

/* ============================================================ */
titulo('simulación del 17-sep (x2, x11, x17, x20): lo que la IA dejó pasar lo tapa el código');
{
  /* x11 · La IA afirma disponibilidad: se cambia por «te la confirmo». */
  limpia();
  const A = '5213366670261';
  laIA = function (t) {
    if (/disponible/i.test(t)) return { respuesta: 'El 20 de diciembre sí tenemos disponible. ¿A dónde van?', datos: {}, accion: 'seguir' };
    return { respuesta: 'Va. ¿A dónde van?', datos: {}, accion: 'seguir' };
  };
  await dice('tienen disponible el 20 de diciembre?', A);
  const rA = textos(A).slice(-1)[0] || '';
  okQue('x11 · no afirma disponibilidad: dice que la confirma y conserva la pregunta', /te la confirmo en un momento con el equipo/.test(rA) && /¿A dónde van\?/.test(rA) && !/sí tenemos disponible/.test(rA));
  laIA = function () { return { respuesta: 'El 20 de diciembre está bien. ¿A dónde van?', datos: {}, accion: 'seguir' }; };
  await dice('hay lugar el 20 de diciembre?', A);
  okQue('x11 · «está bien» a una pregunta de disponibilidad también se cambia', /te la confirmo/.test(textos(A).slice(-1)[0] || ''));

  /* x2 · «12» con la fecha sabida y sin gente = gente. */
  limpia();
  const B = '5213366670262';
  laIA = function (t) {
    if (/vallarta/i.test(t)) return { respuesta: 'Vallarta, va. ¿Qué día salen?', datos: { destino: 'Puerto Vallarta' }, accion: 'seguir' };
    if (/24/.test(t)) return { respuesta: 'Del 24 al 26, va. ¿Salen de Guadalajara?', datos: { salida: '2026-10-24', regreso: '2026-10-26' }, accion: 'seguir' };
    /* La IA ignora el «12». */
    return { respuesta: '¿Salen de la zona metropolitana de Guadalajara?', datos: {}, accion: 'seguir' };
  };
  await dice('a vallarta', B);
  await dice('del 24 al 26 de octubre', B);
  await dice('12', B);
  ok('x2 · el «12» queda como gente en la plática', (webhook.charlaDe(B) || {}).gente, 12);

  /* x20 · Todo conocido y la IA se queda charlando: se cotiza. */
  limpia();
  const C = '5213366670263';
  laIA = function () { return { respuesta: 'Vallarta del 10 al 12, 20 personas: va perfecto. Ida y vuelta desde Guadalajara, ¿correcto?',
    datos: { destino: 'Puerto Vallarta', salida: '2026-10-10', regreso: '2026-10-12', gente: 20, origen: 'Guadalajara', recorridos: 0 }, accion: 'seguir' }; };
  await dice('a vallarta del 10 al 12 de octubre, 20 personas de guadalajara, sin movimientos', C);
  okQue('x20 · con los seis datos sale el resumen aunque la IA no pidiera el precio', textos(C).some((t) => /ya tengo todo tu viaje/i.test(t)));
  okQue('  y el ticket al dueño', textos(DUENO).some((t) => /Precio por confirmar/.test(t) && /Puerto Vallarta/.test(t)));

  /* x17 · «perdón, somos 15» después del ticket: ticket corregido. Este
     camino es el de producción y el de Kommo: hasta la cotización. */
  limpia();
  process.env.BOT_HASTA_COTIZACION = '1';
  const D = '5213366670264';
  laIA = function (t) {
    /* Como Haiku de verdad (corrida x17 real): manda la gente nueva Y una
       unidad equivocada («autobus» para 15). La Sprinter del ticket se
       queda, porque 15 le caben. */
    if (/somos 15/i.test(t)) return { respuesta: 'Perfecto, 15. ¿Y qué día regresan?', datos: { gente: 15, unidad: 'autobus' }, accion: 'seguir' };
    return { respuesta: null, datos: { destino: 'Chapala', salida: '2026-10-04', regreso: '2026-10-04', gente: 12, origen: 'Guadalajara', recorridos: 0 }, accion: 'cotizar' };
  };
  await dice('a chapala el 4 de octubre somos 12 de guadalajara mismo dia sin movimientos', D);
  const ticketsAntes = textos(DUENO).filter((t) => /Precio por confirmar/.test(t)).length;
  await dice('perdón, somos 15', D);
  const ticketsDespues = textos(DUENO).filter((t) => /Precio por confirmar/.test(t));
  ok('x17 · sale un segundo ticket, corregido', ticketsDespues.length, ticketsAntes + 1);
  okQue('  con 15 pax', /15 pax/.test(ticketsDespues[ticketsDespues.length - 1] || ''));
  okQue('  y al cliente le llega el resumen con 15 personas, no la lista de autobuses', /15 personas/.test(textos(D).slice(-1)[0] || '') && !/Marcopolo/.test(textos(D).slice(-1)[0] || ''));
  process.env.BOT_HASTA_COTIZACION = '0';

  /* x6 · «¿tienen baño?» y la IA lista la flota: se contesta la pregunta. */
  limpia();
  const E = '5213366670265';
  laIA = function () { return { respuesta: 'Estos son los autobuses que tenemos:\nMarcopolo Paradiso G8 — Premium — 51 asientos\nIrizar i6S — Premium — 51 asientos\nIrizar i6 — Premium — 47 y 51 asientos\nNeobus — Gran Turismo — 50 asientos\nIrizar Century — Clásico — 47 y 49 asientos\nIrizar PB — Turismo — 47 asientos\n\n¿Te mando fotos de alguno?', datos: {}, accion: 'seguir' }; };
  await dice('los autobuses tienen baño?', E);
  const rE = textos(E).slice(-1)[0] || '';
  okQue('x6 · contesta que sí traen baño y aire, sin listar la flota', /traen baño y aire/.test(rE) && !/Marcopolo/.test(rE));

  /* Observación 3 del dueño (17-sep-2026, su teléfono): «quiero una sprinter
     para ir a mazatlán» y NO llegaron las fotos. El guion fija la Sprinter
     por el nombre ANTES de que conteste la IA, y la comparación «¿ya la
     tenía?» la veía como vieja. Las fotos salen la primera vez que la
     unidad queda escogida, la diga la IA o la diga el cliente. */
  limpia();
  const F = '5213366670266';
  laIA = function (t) {
    if (/sprinter/i.test(t)) return { respuesta: 'Listo, Sprinter a Mazatlán. ¿Cuándo salen y cuándo regresan?', datos: { destino: 'Mazatlán', unidad: 'sprinter' }, accion: 'seguir' };
    return { respuesta: 'Va. ¿Cuándo salen?', datos: {}, accion: 'seguir' };
  };
  const antesDeNombrarla = mandados.length;
  await dice('quiero una sprinter para ir a mazatlán', F);
  const fotosAlNombrarla = mandados.slice(antesDeNombrarla).filter((m) => mismo(m.to, F) && m.image && m.image.link);
  ok('obs. 3 · «quiero una sprinter para ir a mazatlán»: salen sus 3 fotos', fotosAlNombrarla.length, 3);
  okQue('  la primera es la de afuera (sprinter-01) con pie', /sprinter-01\.jpg$/.test(fotosAlNombrarla[0] ? fotosAlNombrarla[0].image.link : '') && /Sprinter/.test((fotosAlNombrarla[0] && fotosAlNombrarla[0].image.caption) || ''));
  const antesDeLaFecha = mandados.length;
  await dice('salimos del 20 al 25', F);
  ok('  y en el siguiente turno no se repiten', mandados.slice(antesDeLaFecha).filter((m) => mismo(m.to, F) && m.image).length, 0);

  /* Simulación z1 (17-sep-2026, modelo real): «salimos del 20 al 25» sin mes
     y sin fecha previa; hoy es 5 de septiembre. Una corrida lo dejó en
     septiembre y otra en OCTUBRE. Sin mes en el mensaje ni en la plática,
     el rango es el más cercano que no ha pasado: 20–25 de septiembre. */
  limpia();
  const G = '5213366670267';
  laIA = function (t) {
    if (/mazatl/i.test(t)) return { respuesta: 'Listo, Sprinter a Mazatlán. ¿Cuándo salen y cuándo regresan?', datos: { destino: 'Mazatlán', unidad: 'sprinter' }, accion: 'seguir' };
    if (/20 al 25/i.test(t)) return { respuesta: 'Perfecto, del 20 al 25 de octubre. ¿Salen de la zona metropolitana de Guadalajara?', datos: { salida: '2026-10-20', regreso: '2026-10-25' }, accion: 'seguir' };
    return { respuesta: 'Va.', datos: {}, accion: 'seguir' };
  };
  await dice('quiero una sprinter para ir a mazatlán', G);
  await dice('salimos del 20 al 25', G);
  const charlaG = webhook.charlaDe(G);
  ok('z1 · «del 20 al 25» sin mes, hoy 5-sep: la salida queda en septiembre aunque la IA diga octubre', charlaG && charlaG.salida, '2026-09-20');
  ok('  y el regreso también', charlaG && charlaG.regreso, '2026-09-25');
  okQue('  y al cliente no se le repite «octubre»', !/octubre/i.test(textos(G).slice(-1)[0] || ''));
}

console.log('\n' + buenas + ' buenas, ' + malas + ' malas');
process.exit(malas ? 1 : 0);
