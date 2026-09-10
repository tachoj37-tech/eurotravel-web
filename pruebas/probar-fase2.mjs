/* ------------------------------------------------------------
   FASE 2 DE LA AUDITORÍA DEL 7-SEP-2026 · que el dinero y la compuerta sean exactos
   ------------------------------------------------------------
   Lo que se vigila:

   1 · Tras el «va» del dueño, la ficha del CLIENTE se guarda en la base
       (etapa con precio, precio_en), aunque el aviso solo traiga el
       número del dueño.
   2 · Solo el ticket del precio confirma precio: un «15000» a otro
       ticket no manda nada al cliente y se le dice al dueño.
   3 · El filtro de cifras cierra los huecos y no tira frases buenas.
   4 · «Apartar» sin precio no suelta la CLABE; «persona» no manda al
       cliente a otro número.
   5 · Un precio fijado en autobús no dice «undefined días».
   6 · Formas de escribir el precio: «52 000», «$52,000.00», «va 52000».
   7 · La etapa «ya tiene precio» se anota solo si WhatsApp aceptó.
   8 · «total 48000» actualiza la ficha sin escribirle al cliente.
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
process.env.ALMACEN_URL = 'https://abcdefghijklmnopqrst.supabase.co';
process.env.ALMACEN_CLAVE = 'sb_secret_de_mentiras';
process.env.CLABE = '012345678901234567';
delete process.env.VERCEL_ENV;
const AHORA = Date.parse('2026-09-05T16:00:00Z');
process.env.AHORA_DE_PRUEBA = String(AHORA);

const atiende = (await import(pathToFileURL(path.join(RAIZ, 'api', 'whatsapp.mjs')).href)).default;
const webhook = (await import(pathToFileURL(path.join(RAIZ, 'api', '_whatsapp-webhook.js')).href)).default;
const agente = (await import(pathToFileURL(path.join(RAIZ, 'api', '_agente.js')).href)).default;
const confirmacion = (await import(pathToFileURL(path.join(RAIZ, 'api', '_confirmacion.js')).href)).default;
const aprendidos = (await import(pathToFileURL(path.join(RAIZ, 'api', '_precios-aprendidos.js')).href)).default;
const fichas = (await import(pathToFileURL(path.join(RAIZ, 'api', '_tickets.js')).href)).default;

let buenas = 0, malas = 0;
function ok(que, dio, esperaba) {
  const bien = JSON.stringify(dio) === JSON.stringify(esperaba);
  if (bien) { buenas++; console.log('ok   ' + que); }
  else { malas++; console.log('MAL  ' + que + '\n     dio      ' + JSON.stringify(dio) + '\n     esperaba ' + JSON.stringify(esperaba)); }
}
function okQue(que, condicion) { ok(que, !!condicion, true); }
function titulo(t) { console.log('\n== ' + t.toUpperCase() + ' =='); }

/* ---- Meta, la IA y el almacén de mentiras ---- */
let mandados = [];
let upserts = [];
let rechazaMetaPara = null;   // número al que Meta «rechaza» el envío
let laIA = function () { return null; };
globalThis.fetch = async function (url, opciones) {
  const u = String(url);
  const o = opciones || {};
  const cuerpo = o.body ? JSON.parse(o.body) : {};
  if (u.indexOf('graph.facebook.com') !== -1 && /\/messages$/.test(u)) {
    if (rechazaMetaPara && String(cuerpo.to).slice(-10) === String(rechazaMetaPara).slice(-10)) {
      return { ok: false, status: 400, text: async () => '{"error":{"code":131047}}' };
    }
    mandados.push(cuerpo);
    return { ok: true, status: 200, json: async () => ({ messages: [{ id: 'wamid.s' + mandados.length }] }), text: async () => '{}' };
  }
  if (u.indexOf('api.anthropic.com') !== -1) {
    const dijo = laIA(((cuerpo.messages || [])[0] || {}).content || '');
    if (!dijo) return { ok: false, status: 500, text: async () => '' };
    return { ok: true, status: 200, json: async () => ({ content: [{ text: JSON.stringify(dijo) }], usage: { input_tokens: 1200, output_tokens: 60 } }) };
  }
  if (u.indexOf('supabase.co/rest/v1/fichas?on_conflict=numero') !== -1) {
    upserts.push(cuerpo);
    return { ok: true, status: 201, text: async () => '', json: async () => null };
  }
  if (u.indexOf('supabase.co/rest/v1/') !== -1) {
    return { ok: true, status: 200, json: async () => [], text: async () => '' };
  }
  if (u.indexOf('/api/disponibilidad') !== -1) {
    return { ok: true, status: 200, json: async () => ({ datos: { libres: 2, total: 4 } }), text: async () => '' };
  }
  throw new Error('el bot llamó a algo que no debía: ' + u);
};

const firma = (c) => 'sha256=' + crypto.createHmac('sha256', SECRETO).update(Buffer.from(c, 'utf8')).digest('hex');
let contador = 0;
async function manda(mensaje) {
  contador++;
  const cuerpo = JSON.stringify({ entry: [{ changes: [{ value: { metadata: { phone_number_id: '111' },
    messages: [Object.assign({ id: 'wamid.f2.' + contador }, mensaje)] } }] }] });
  await atiende(new Request('https://x/api/whatsapp', { method: 'POST', body: cuerpo, headers: { 'x-hub-signature-256': firma(cuerpo) } }));
}
const dice = (texto, de) => manda({ from: de, type: 'text', text: { body: texto } });
const contesta = (ticket, texto) => manda({ from: DUENO, type: 'text', text: { body: texto }, context: { id: ticket } });
function mismo(a, b) { return String(a || '').replace(/\D/g, '').slice(-10) === String(b || '').replace(/\D/g, '').slice(-10); }
function textos(para) { return mandados.filter((m) => mismo(m.to, para)).map((m) => (m.text && m.text.body) || (m.image && m.image.caption) || ''); }
function ultimoTicket(patron) {
  let idx = -1;
  mandados.forEach(function (m, i) { if (mismo(m.to, DUENO) && (!patron || patron.test((m.text && m.text.body) || ''))) idx = i; });
  return idx < 0 ? null : 'wamid.s' + (idx + 1);
}
function limpia() { webhook.olvidaTodo(); agente.olvidaTodo(); fichas.olvidaTodo && fichas.olvidaTodo(); mandados = []; upserts = []; rechazaMetaPara = null; }
const DUENO = process.env.DUENO_WHATSAPP;

/* La IA de una cotización completa a Vallarta con 12. */
function iaDeVallarta(t) {
  if (/vallarta/i.test(t)) return { respuesta: 'Vallarta, va. ¿Qué día salen?', datos: { destino: 'Puerto Vallarta' }, accion: 'seguir' };
  if (/9 de septiembre/i.test(t)) return { respuesta: 'Listo. ¿Y regresan?', datos: { salida: '2026-09-09' }, accion: 'seguir' };
  if (/el 14/i.test(t)) return { respuesta: 'Del 9 al 14. ¿Como cuántos van?', datos: { regreso: '2026-09-14' }, accion: 'seguir' };
  if (/somos 12/i.test(t)) return { respuesta: '12 van perfecto en Sprinter. ¿Salen de la zona metropolitana de Guadalajara?', datos: { gente: 12 }, accion: 'seguir' };
  if (/^s[ií]$/i.test(t)) return { respuesta: 'Perfecto. ¿Se mueven allá o solo los llevamos y traemos?', datos: { origen: 'Guadalajara' }, accion: 'seguir' };
  if (/solo nos llevan/i.test(t)) return { respuesta: null, datos: { recorridos: 0 }, accion: 'cotizar' };
  return null;
}
async function cotizaVallarta(C) {
  for (const t of ['a vallarta', 'el 9 de septiembre', 'el 14', 'somos 12', 'sí', 'solo nos llevan y traen']) await dice(t, C);
}

/* ============================================================ */
titulo('tras el «va», la ficha del cliente se guarda en la base');
{
  limpia();
  const C = '5213366672001';
  laIA = iaDeVallarta;
  await cotizaVallarta(C);
  const ticket = ultimoTicket(/^💰/);
  okQue('hay ticket de precio', !!ticket);
  upserts = [];
  await contesta(ticket, 'va');
  okQue('el cliente recibió el precio', /\*Total: \$/.test(textos(C).join('\n')));
  const delCliente = upserts.filter((u) => u.numero === '3366672001');
  okQue('la ficha del CLIENTE se guardó aunque el aviso era del dueño', delCliente.length >= 1);
  const ultima = delCliente[delCliente.length - 1] || {};
  ok('  con etapa «con precio»', ultima.etapa, 'con_precio');
  okQue('  con precio_en (arranca el seguimiento)', !!ultima.precio_en);
  ok('  y sin precio pendiente (por_confirmar en nulo explícito)', ultima.por_confirmar, null);
  okQue('  con el viaje en datos (para el contrato)', !!(ultima.viaje_datos && ultima.viaje_datos.destino));
}

/* ============================================================ */
titulo('solo el ticket del precio confirma precio');
{
  limpia();
  const C = '5213366672002';
  laIA = function (t) {
    if (/rfc/i.test(t)) return { respuesta: null, datos: {}, accion: 'dueno' };
    return iaDeVallarta(t);
  };
  await cotizaVallarta(C);
  await dice('me pasas tu rfc?', C);
  const ticketRfc = ultimoTicket(/Un cliente pregunta/);
  const antes = textos(C).length;
  await contesta(ticketRfc, '15000');
  okQue('«15000» al ticket del RFC NO manda cotización al cliente', !/\*Total: \$/.test(textos(C).slice(antes).join('\n')));
  okQue('  y al dueño se le dice cuál ticket es', /no es el ticket del precio/i.test(textos(DUENO).join('\n')));
  const ticketPrecio = ultimoTicket(/^💰/);
  await contesta(ticketPrecio, '15000');
  okQue('al ticket del precio sí: el cliente recibe $15,000', /\*Total: \$15,000\*/.test(textos(C).join('\n')));
  const antes2 = textos(C).length;
  await contesta(ticketPrecio, 'va');
  okQue('un segundo «va» al mismo ticket no manda nada al cliente', textos(C).slice(antes2).length === 0);
}

/* ============================================================ */
titulo('el filtro de cifras');
{
  const bloquea = ['Sale en 18,500 todo incluido.', 'Te queda en 18500.', 'Serían aproximadamente veinte mil', 'Con 3,000 te bloqueo la fecha',
    'de anticipo 3000 y el resto antes', 'son mil pesos por persona', 'márcame al 33 2400 2285', 'desde 4,500 el viaje'];
  bloquea.forEach((t) => ok('bloquea «' + t + '»', agente.sanea(t) === null, true));
  const deja = ['Van desde 2 días allá', 'Somos 12, va perfecto en Sprinter', 'Hasta 20 pasajeros', 'El 20 de noviembre de 2026, listo',
    'Mil gracias, ¿qué día salen?', 'Para 47 el i6 queda justo'];
  deja.forEach((t) => ok('deja pasar «' + t + '»', agente.sanea(t) !== null, true));
}

/* ============================================================ */
titulo('«apartar» sin precio no suelta la CLABE; «persona» no manda a otro número');
{
  limpia();
  const C = '5213366672003';
  laIA = function (t) {
    if (/apartar/i.test(t)) return { respuesta: null, datos: {}, accion: 'apartar' };
    if (/persona/i.test(t)) return { respuesta: null, datos: {}, accion: 'persona' };
    return iaDeVallarta(t);
  };
  await dice('a vallarta', C);
  await dice('ya quiero apartar', C);
  const t = textos(C).join('\n');
  okQue('sin precio: no sale la CLABE', !/012345678901234567/.test(t) && !mandados.some((m) => mismo(m.to, C) && m.image && /ficha-bancaria/.test(m.image.link || '')));
  okQue('  y se le dice que primero va el precio', /primero te confirmo el precio/i.test(t));
  await dice('quiero hablar con una persona', C);
  okQue('«persona»: no se le manda a otro número', !/33\s?2400\s?2285|m[aá]rcame/i.test(textos(C).join('\n')));
  okQue('  y al dueño le llega que quiere hablar', /Quiere hablar contigo/.test(textos(DUENO).join('\n')));

  /* Sin IA (el guion de respaldo) tampoco se manda a otro número. */
  limpia();
  laIA = function () { return null; };
  await dice('quiero hablar con una persona', C);
  okQue('sin IA, el guion tampoco manda al 33 2400 2285', !/33\s?2400\s?2285|m[aá]rcame/i.test(textos(C).join('\n')));
  okQue('  y avisa al dueño', textos(DUENO).length >= 1);
}

/* ============================================================ */
titulo('un precio fijado en autobús no dice «undefined días»');
{
  limpia();
  const C = '5213366672004';
  laIA = function (t) {
    if (/vallarta/i.test(t)) return { respuesta: 'Vallarta, va. ¿Qué día salen?', datos: { destino: 'Puerto Vallarta' }, accion: 'seguir' };
    if (/9 de septiembre/i.test(t)) return { respuesta: 'Listo. ¿Y regresan?', datos: { salida: '2026-09-09' }, accion: 'seguir' };
    if (/el 14/i.test(t)) return { respuesta: 'Del 9 al 14. ¿Como cuántos van?', datos: { regreso: '2026-09-14' }, accion: 'seguir' };
    if (/somos 48/i.test(t)) return { respuesta: 'Opciones:\nNeobus — Gran Turismo — 50 asientos\n¿Cuál?', datos: { gente: 48 }, accion: 'seguir' };
    if (/neobus/i.test(t)) return { respuesta: 'Neobus, va. ¿Salen de la zona metropolitana de Guadalajara?', datos: { autobus: 'neobus' }, accion: 'seguir' };
    if (/^s[ií]$/i.test(t)) return { respuesta: 'Perfecto. ¿Se mueven allá o solo los llevamos?', datos: { origen: 'Guadalajara' }, accion: 'seguir' };
    if (/solo nos llevan/i.test(t)) return { respuesta: null, datos: { recorridos: 0 }, accion: 'cotizar' };
    return null;
  };
  for (const t of ['a vallarta', 'el 9 de septiembre', 'el 14', 'somos 48', 'el neobus', 'sí', 'solo nos llevan y traen']) await dice(t, C);
  const ticket = ultimoTicket(/^💰/);
  await contesta(ticket, '52 000');
  const precio = textos(C).join('\n');
  okQue('«52 000» con espacio se leyó como precio', /\*Total: \$52,000\*/.test(precio));
  okQue('  sin «undefined»', !/undefined/.test(precio));
  okQue('  con los días de servicio (6 días, del 9 al 14)', /6 días de servicio/.test(precio));
}

/* ============================================================ */
titulo('formas de escribir el precio');
{
  ok('«52 000»', confirmacion.interpreta('52 000'), { tipo: 'precio', total: 52000 });
  ok('«$52,000.00»', confirmacion.interpreta('$52,000.00'), { tipo: 'precio', total: 52000 });
  ok('«va 52000»', confirmacion.interpreta('va 52000'), { tipo: 'precio', total: 52000 });
  ok('«va, 52,000»', confirmacion.interpreta('va, 52,000'), { tipo: 'precio', total: 52000 });
  ok('«2026» es un año, no un precio', confirmacion.interpreta('2026'), { tipo: 'texto' });
  ok('«48 mil» siguen siendo 48,000', confirmacion.interpreta('48 mil'), { tipo: 'precio', total: 48000 });
  ok('«va» a secas sigue siendo va', confirmacion.interpreta('va'), { tipo: 'va' });
}

/* ============================================================ */
titulo('la etapa «ya tiene precio» solo si whatsapp aceptó');
{
  limpia();
  const C = '5213366672005';
  laIA = iaDeVallarta;
  await cotizaVallarta(C);
  const ticket = ultimoTicket(/^💰/);
  rechazaMetaPara = C;          // Meta rechaza el mensaje del precio (ventana cerrada)
  upserts = [];
  await contesta(ticket, 'va');
  okQue('el cliente NO recibió el precio (Meta lo rechazó)', !/\*Total: \$/.test(textos(C).join('\n')));
  const f = fichas.fichaDe(C);
  okQue('  y la ficha NO dice «con precio» ni arranca el seguimiento', f && f.etapa !== 'con_precio' && !f.precioEn);
  rechazaMetaPara = null;
}

/* ============================================================ */
titulo('«total 48000» actualiza la ficha sin escribirle al cliente');
{
  limpia();
  const C = '5213366672006';
  laIA = iaDeVallarta;
  await cotizaVallarta(C);
  const ticket = ultimoTicket(/^💰/);
  await contesta(ticket, 'va');
  const antes = textos(C).length;
  await contesta(ticket, 'total 48000');
  ok('al cliente no le llegó nada', textos(C).length, antes);
  const f = fichas.fichaDe(C);
  ok('la ficha quedó en 48,000', f && f.total, 48000);
  ok('  con anticipo del 20 % a $500 arriba (10,000)', f && f.anticipo, 10000);
  okQue('  y el dueño recibió la confirmación', /actualizado a \*\$48,000\*/.test(textos(DUENO).join('\n')));
}

/* ============================================================ */
titulo('la clave del precio aprendido distingue agencia');
{
  const base = { origen: 'Guadalajara', destino: 'Chapala', salida: '2026-11-20', regreso: '2026-11-22' };
  /* El origen entra por ZONA desde el 10-sep-2026 —«zmg» y no
     «guadalajara»—; ver la nota en `claveDe`. Lo que esta prueba vigila
     no cambió: que la agencia no comparta llave con el particular. */
  ok('particular: la clave de siempre', aprendidos.claveDe(base, 'Sprinter'), 'zmg|chapala|sprinter|3');
  ok('agencia: otra clave', aprendidos.claveDe(Object.assign({}, base, { agencia: true }), 'Sprinter'), 'zmg|chapala|sprinter|3|agencia');
}

console.log('\n' + buenas + ' buenas, ' + malas + ' malas');
process.exit(malas ? 1 : 0);
