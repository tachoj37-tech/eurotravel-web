/* ------------------------------------------------------------
   FASE 3 DE LA AUDITORÍA DEL 7-SEP-2026 · que entienda y corrija como persona
   ------------------------------------------------------------
   Lo que se vigila:

   1 · «¿cuánto sale?» sin todos los datos no deja al cliente sin nada.
   2 · El cliente puede corregir destino, fecha y cuántos son; al cambiar
       cuántos, se vuelve a ver en qué caben.
   3 · Cuántos son NO es requisito para escoger autobús (dictado del
       8-sep-2026); pero 60 en un i6 de 47 se detecta cuando llega la
       cuenta y se vuelve a escoger.
   4 · Una ráfaga de dos mensajes en un aviso: el segundo parte de lo
       que leyó la IA del primero, no de lo que entendió el guion.
   5 · Fechas imposibles o pasadas no entran.
   6 · Si contesta algo y a la vez completa el viaje, la respuesta sale
       antes de la espera.
   7 · Una foto del dueño citando un ticket se reenvía al cliente.
   8 · «Camioneta ejecutiva» es la Suburban; «autobús» sin modelo no
       promete el i6S.
   ------------------------------------------------------------ */

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
delete process.env.ALMACEN_URL;
delete process.env.VERCEL_ENV;
process.env.AHORA_DE_PRUEBA = String(Date.parse('2026-09-05T16:00:00Z'));

const atiende = (await import(pathToFileURL(path.join(RAIZ, 'api', 'whatsapp.mjs')).href)).default;
const webhook = (await import(pathToFileURL(path.join(RAIZ, 'api', '_whatsapp-webhook.js')).href)).default;
const agente = (await import(pathToFileURL(path.join(RAIZ, 'api', '_agente.js')).href)).default;
const bot = (await import(pathToFileURL(path.join(RAIZ, 'bot.js')).href)).default;

let buenas = 0, malas = 0;
function ok(que, dio, esperaba) {
  const bien = JSON.stringify(dio) === JSON.stringify(esperaba);
  if (bien) { buenas++; console.log('ok   ' + que); }
  else { malas++; console.log('MAL  ' + que + '\n     dio      ' + JSON.stringify(dio) + '\n     esperaba ' + JSON.stringify(esperaba)); }
}
function okQue(que, condicion) { ok(que, !!condicion, true); }
function titulo(t) { console.log('\n== ' + t.toUpperCase() + ' =='); }

let mandados = [];
let sistemasVistos = [];
let laIA = function () { return null; };
globalThis.fetch = async function (url, opciones) {
  const u = String(url);
  const o = opciones || {};
  const cuerpo = o.body ? JSON.parse(o.body) : {};
  if (u.indexOf('graph.facebook.com') !== -1 && /\/messages$/.test(u)) {
    mandados.push(cuerpo);
    return { ok: true, status: 200, json: async () => ({ messages: [{ id: 'wamid.s' + mandados.length }] }), text: async () => '{}' };
  }
  if (u.indexOf('api.anthropic.com') !== -1) {
    sistemasVistos.push(cuerpo.system);
    const dijo = laIA(((cuerpo.messages || [])[0] || {}).content || '');
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
async function aviso(mensajes) {
  const cuerpo = JSON.stringify({ entry: [{ changes: [{ value: { metadata: { phone_number_id: '111' },
    messages: mensajes.map((m) => Object.assign({ id: 'wamid.f3.' + (++contador) }, m)) } }] }] });
  await atiende(new Request('https://x/api/whatsapp', { method: 'POST', body: cuerpo, headers: { 'x-hub-signature-256': firma(cuerpo) } }));
}
const dice = (texto, de) => aviso([{ from: de, type: 'text', text: { body: texto } }]);
function mismo(a, b) { return String(a || '').replace(/\D/g, '').slice(-10) === String(b || '').replace(/\D/g, '').slice(-10); }
function textos(para) { return mandados.filter((m) => mismo(m.to, para)).map((m) => (m.text && m.text.body) || (m.image && m.image.caption) || ''); }
function limpia() { webhook.olvidaTodo(); agente.olvidaTodo(); mandados = []; sistemasVistos = []; }
const DUENO = process.env.DUENO_WHATSAPP;

/* ============================================================ */
titulo('«¿cuánto sale?» sin todos los datos no deja al cliente sin nada');
{
  limpia();
  const C = '5213366673001';
  laIA = function (t) {
    if (/tequila/i.test(t)) return { respuesta: 'Tequila, va. ¿Qué día salen?', datos: { destino: 'Tequila' }, accion: 'seguir' };
    if (/cuanto sale/i.test(t)) return { respuesta: null, datos: {}, accion: 'cotizar' };   // como la entrenó el prompt
    return null;
  };
  await dice('voy a tequila', C);
  const antes = textos(C).length;
  await dice('cuanto sale?', C);
  const nuevos = textos(C).slice(antes);
  ok('el cliente recibió UNA respuesta', nuevos.length, 1);
  okQue('  con texto de verdad (no vacío)', nuevos[0] && nuevos[0].trim().length > 5);
  okQue('  y sin cifras', !/\$|\d{4,}/.test(nuevos[0] || ''));
}

/* ============================================================ */
titulo('el cliente puede corregir');
{
  const a = bot.pegaDatos({ destino: 'Puerto Vallarta', salida: '2026-10-12', paso: 'regreso' }, { destino: 'Mazamitla' });
  ok('«mejor a Mazamitla» cambia el destino', a.destino, 'Mazamitla');
  ok('  y conserva la fecha', a.salida, '2026-10-12');
  const b = bot.pegaDatos({ destino: 'Puerto Vallarta', salida: '2026-10-12', regreso: '2026-10-14', gente: 15, unidad: 'sprinter', unidadNombre: 'Sprinter', paso: 'origen' }, { gente: 30 });
  ok('«somos 30» cambia la cuenta', b.gente, 30);
  ok('  y ya no es Sprinter', b.unidad, 'autobus');
  okQue('  toca escoger autobús', b.paso === 'elegirBus' && !b.unidadNombre);
  const c = bot.pegaDatos({ destino: 'Chapala', salida: '2026-10-12', regreso: '2026-10-14', paso: 'cuantos' }, { salida: '2026-10-19' });
  ok('«mejor el 19» cambia la salida', c.salida, '2026-10-19');
  ok('  y el regreso que quedó antes de la salida se vuelve a preguntar', c.paso, 'regreso');
  const d = bot.pegaDatos({ destino: 'Chapala', salida: '2026-10-12', regreso: '2026-10-14', gente: 12, unidad: 'sprinter', unidadNombre: 'Sprinter', paso: 'origen' }, { gente: 12 });
  ok('la misma cuenta no mueve nada', [d.gente, d.unidad], [12, 'sprinter']);
}

/* ============================================================ */
titulo('un autobús donde no caben no se acepta; pero cuántos son ya no es requisito para escogerlo');
{
  /* Cambió de lado el 8-sep-2026 (dictado del dueño: «lo que importa es la
     renta de camión, no las personas; puedo rentar un i6 sin que responda
     cuántos somos»). Con autobús y sin gente, lo primero es enseñar los
     autobuses; la cuenta se usa después, si la da, para ver si caben. */
  const a = bot.pegaDatos({ destino: 'Cancún', salida: '2026-11-10', regreso: '2026-11-15', unidad: 'autobus' }, {});
  ok('con autobús pero sin gente, lo que sigue es escoger cuál (no «cuántos»)', a.paso, 'elegirBus');
  const a2 = bot.pegaDatos({ destino: 'Cancún', salida: '2026-11-10', regreso: '2026-11-15', unidad: 'autobus' }, { autobus: 'irizar-i6' });
  ok('  y con el i6 escogido y sin gente, sigue el origen', [a2.unidadNombre, a2.paso], ['Irizar i6', 'origen']);
  const b = bot.pegaDatos({ destino: 'Cancún', salida: '2026-11-10', regreso: '2026-11-15', gente: 40, unidad: 'autobus', unidadNombre: 'Irizar i6', unidadId: 'irizar-i6', paso: 'origen' }, { gente: 50 });
  ok('50 en un i6 de 47: no cabe', b.noCabe && b.noCabe.nombre, 'Irizar i6');
  okQue('  se quita el camión y toca escoger otra vez (hay de 50 y 51)', !b.unidadNombre && b.paso === 'elegirBus');
  const c = bot.pegaDatos({ destino: 'Cancún', salida: '2026-11-10', regreso: '2026-11-15', gente: 40, unidad: 'autobus', unidadNombre: 'Irizar i6', unidadId: 'irizar-i6', paso: 'origen' }, { gente: 60 });
  okQue('60 no caben en ninguno: se avisa y no se inventa unidad', c.noCabe && c.noCabe.gente === 60 && !c.unidadNombre);
}

/* ============================================================ */
titulo('una ráfaga de dos mensajes en un aviso');
{
  limpia();
  const C = '5213366673002';
  /* Reparación del 8-sep-2026 (Falla 2, R5): la ráfaga se une en UN turno
     antes de procesar; la IA lee los dos mensajes juntos y contesta una vez. */
  laIA = function (t) {
    if (/boda de mi prima/i.test(t) && /12 de octubre/i.test(t)) return { respuesta: 'Qué padre, una boda en Tapalpa el 12. ¿Es ida y vuelta el mismo día?', datos: { destino: 'Tapalpa', ocasion: 'boda', salida: '2026-10-12' }, accion: 'seguir' };
    return null;
  };
  await aviso([
    { from: C, type: 'text', text: { body: 'voy a la boda de mi prima en Tapalpa' } },
    { from: C, type: 'text', text: { body: 'el 12 de octubre' } }
  ]);
  ok('la ráfaga se une: la IA contesta UNA vez', textos(C).length, 1);
  const visto = JSON.stringify(sistemasVistos[sistemasVistos.length - 1] || []);
  okQue('  y el guion no metió «La Boda de Mi Prima» como destino', !/destino=La Boda/i.test(visto));
  const charla = webhook.charlaDe(C) || {};
  ok('la plática quedó con Tapalpa y el 12', [charla.destino, charla.salida], ['Tapalpa', '2026-10-12']);
}

/* ============================================================ */
titulo('fechas imposibles o pasadas no entran');
{
  const l = (d) => agente.limpiaDatos(d, '2026-09-05');
  ok('2026-13-45 no es fecha', l({ salida: '2026-13-45' }).salida, null);
  ok('2026-02-30 no es fecha', l({ salida: '2026-02-30' }).salida, null);
  ok('2020-01-01 ya pasó', l({ salida: '2020-01-01' }).salida, null);
  ok('ayer ya pasó', l({ salida: '2026-09-04' }).salida, null);
  ok('hoy sí', l({ salida: '2026-09-05' }).salida, '2026-09-05');
  ok('el 9 de septiembre sí', l({ salida: '2026-09-09', regreso: '2026-09-14' }).regreso, '2026-09-14');
}

/* ============================================================ */
titulo('la respuesta sale antes de la espera');
{
  limpia();
  const C = '5213366673003';
  laIA = function (t) {
    if (/vallarta/i.test(t)) return { respuesta: 'Vallarta, va. ¿Qué día salen?', datos: { destino: 'Puerto Vallarta' }, accion: 'seguir' };
    if (/9 de septiembre/i.test(t)) return { respuesta: 'Listo. ¿Y regresan?', datos: { salida: '2026-09-09' }, accion: 'seguir' };
    if (/el 14/i.test(t)) return { respuesta: 'Del 9 al 14. ¿Como cuántos van?', datos: { regreso: '2026-09-14' }, accion: 'seguir' };
    if (/somos 12/i.test(t)) return { respuesta: '12 van perfecto en Sprinter. ¿Salen de la zona metropolitana de Guadalajara?', datos: { gente: 12 }, accion: 'seguir' };
    if (/traen aire/i.test(t)) return { respuesta: 'Sí, todas traen aire 🙌', datos: { origen: 'Guadalajara', recorridos: 0 }, accion: 'cotizar' };
    return null;
  };
  for (const t of ['a vallarta', 'el 9 de septiembre', 'el 14', 'somos 12']) await dice(t, C);
  const antes = textos(C).length;
  await dice('sí, de guadalajara, solo nos llevan y traen. ¿traen aire?', C);
  const nuevos = textos(C).slice(antes);
  ok('primero la respuesta a su pregunta', nuevos[0], 'Sí, todas traen aire 🙌');
  okQue('  y luego la espera del precio', /en un momento te paso tu precio/i.test(nuevos.slice(1).join('\n')));
  okQue('  y el ticket al dueño', /^💰/.test(textos(DUENO).slice(-2).join('\n')) || /Precio por confirmar/.test(textos(DUENO).join('\n')));
}

/* ============================================================ */
titulo('una foto del dueño citando el ticket se reenvía al cliente');
{
  limpia();
  const C = '5213366673004';
  laIA = function (t) {
    if (/rfc/i.test(t)) return { respuesta: null, datos: {}, accion: 'dueno' };
    return null;
  };
  await dice('me pasas tu rfc?', C);
  let idx = -1; mandados.forEach(function (m, i) { if (mismo(m.to, DUENO)) idx = i; });
  const ticket = 'wamid.s' + (idx + 1);
  await aviso([{ from: DUENO, type: 'image', image: { id: 'MEDIA-CONSTANCIA-1', caption: 'Aquí está la constancia' }, context: { id: ticket } }]);
  const foto = mandados.find((m) => mismo(m.to, C) && m.image && m.image.id === 'MEDIA-CONSTANCIA-1');
  okQue('al cliente le llegó la foto tal cual', !!foto);
  ok('  con el pie que puso el dueño', foto && foto.image.caption, 'Aquí está la constancia');
  okQue('  y al dueño NO se le dijo «no supe para quién es»', !/No supe para qui/i.test(textos(DUENO).join('\n')));
}

/* ============================================================ */
titulo('alias y unidad sin modelo');
{
  ok('«camioneta ejecutiva» es la Suburban', agente.unidadPorTexto('mándame fotos de la camioneta ejecutiva'), 'suburban');
  ok('«la camioneta» sigue siendo la Sprinter', agente.unidadPorTexto('fotos de la camioneta'), 'sprinter');
  const texto = bot.textoDeCotizacion(
    { total: 52000, anticipo: 10500, saldo: 41500, dias: 6 },
    { unidad: 'autobus', gente: 48, destino: 'Puerto Vallarta', origen: 'Guadalajara', salida: '2026-09-09', regreso: '2026-09-14', recorridos: 0 }
  ).texto;
  okQue('«autobús» sin modelo no promete el i6S', !/Irizar i6S|hasta 51/.test(texto));
  okQue('  dice Autobús', /Autob[uú]s/.test(texto));
}

console.log('\n' + buenas + ' buenas, ' + malas + ' malas');
process.exit(malas ? 1 : 0);
