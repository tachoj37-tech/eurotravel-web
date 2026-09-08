/* ------------------------------------------------------------
   EL RELEVO · el dueño toma un chat y se lo devuelve a la IA
   ------------------------------------------------------------
   Dictado del dueño (7-sep-2026): «poder activar la IA en un chat o
   manejarlo yo». Lo que se vigila:

   1 · «yo» citando un mensaje del cliente: el bot se calla con ESE
       cliente y le reenvía al dueño lo que escriba (texto y medios).
   2 · El dueño contesta el reenvío y le llega literal al cliente.
   3 · «bot» devuelve el chat: la IA vuelve a contestar.
   4 · Queda en la ficha y viaja al almacén (`en_manos_de`), y el
       tablero lo marca con ✋.
   5 · «yo» sin cliente pide de quién.
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
process.env.HOY_DE_PRUEBA = '2026-09-07';
process.env.ANTHROPIC_API_KEY = 'clave-de-mentiras';
process.env.SITIO_URL = 'https://eurotravel-web.vercel.app';
process.env.ALMACEN_URL = 'https://abcdefghijklmnopqrst.supabase.co';
process.env.ALMACEN_CLAVE = 'sb_secret_de_mentiras';
process.env.AGENTE_IA = '1';
process.env.SIEMPRE_IA = '0';
delete process.env.VERCEL_ENV;
process.env.AHORA_DE_PRUEBA = String(Date.parse('2026-09-07T16:00:00Z'));

const atiende = (await import(pathToFileURL(path.join(RAIZ, 'api', 'whatsapp.mjs')).href)).default;
const webhook = (await import(pathToFileURL(path.join(RAIZ, 'api', '_whatsapp-webhook.js')).href)).default;
const agente = (await import(pathToFileURL(path.join(RAIZ, 'api', '_agente.js')).href)).default;
const tickets = (await import(pathToFileURL(path.join(RAIZ, 'api', '_tickets.js')).href)).default;

let buenas = 0, malas = 0;
function ok(que, dio, esperaba) {
  const bien = JSON.stringify(dio) === JSON.stringify(esperaba);
  if (bien) { buenas++; console.log('ok   ' + que); }
  else { malas++; console.log('MAL  ' + que + '\n     dio      ' + JSON.stringify(dio) + '\n     esperaba ' + JSON.stringify(esperaba)); }
}
function okQue(que, condicion) { ok(que, !!condicion, true); }
function titulo(t) { console.log('\n== ' + t.toUpperCase() + ' =='); }

let mandados = [];
let upserts = [];
let llamadasALaIA = 0;
globalThis.fetch = async function (url, opciones) {
  const u = String(url);
  const o = opciones || {};
  const cuerpo = o.body ? JSON.parse(o.body) : {};
  if (u.indexOf('graph.facebook.com') !== -1 && /\/messages$/.test(u)) {
    mandados.push(cuerpo);
    return { ok: true, status: 200, json: async () => ({ messages: [{ id: 'wamid.s' + mandados.length }] }), text: async () => '{}' };
  }
  if (u.indexOf('api.anthropic.com') !== -1) {
    llamadasALaIA++;
    const t = ((cuerpo.messages || [])[0] || {}).content || '';
    const dijo = { respuesta: 'Aquí ando 🙌 ¿A dónde va el plan?', datos: {}, accion: 'seguir' };
    if (/vallarta/i.test(t)) dijo.respuesta = 'Vallarta, va. ¿Qué día salen?';
    return { ok: true, status: 200, json: async () => ({ content: [{ text: JSON.stringify(dijo) }], usage: { input_tokens: 1200, output_tokens: 60 } }) };
  }
  if (u.indexOf('supabase.co/rest/v1/fichas?on_conflict=numero') !== -1) {
    upserts.push(cuerpo);
    return { ok: true, status: 201, text: async () => '', json: async () => null };
  }
  if (u.indexOf('supabase.co/rest/v1/') !== -1) {
    return { ok: true, status: 200, json: async () => [], text: async () => '' };
  }
  throw new Error('el bot llamó a algo que no debía: ' + u);
};

const firma = (c) => 'sha256=' + crypto.createHmac('sha256', SECRETO).update(Buffer.from(c, 'utf8')).digest('hex');
let contador = 0;
async function manda(mensaje) {
  const cuerpo = JSON.stringify({ entry: [{ changes: [{ value: { metadata: { phone_number_id: '111' },
    messages: [Object.assign({ id: 'wamid.r.' + (++contador) }, mensaje)] } }] }] });
  await atiende(new Request('https://x/api/whatsapp', { method: 'POST', body: cuerpo, headers: { 'x-hub-signature-256': firma(cuerpo) } }));
}
const dice = (texto, de) => manda({ from: de, type: 'text', text: { body: texto } });
const contesta = (ticket, texto) => manda({ from: DUENO, type: 'text', text: { body: texto }, context: { id: ticket } });
function mismo(a, b) { return String(a || '').replace(/\D/g, '').slice(-10) === String(b || '').replace(/\D/g, '').slice(-10); }
function textos(para) { return mandados.filter((m) => mismo(m.to, para)).map((m) => (m.text && m.text.body) || (m.image && m.image.caption) || ''); }
function ultimoAlDueno() { let idx = -1; mandados.forEach(function (m, i) { if (mismo(m.to, DUENO)) idx = i; }); return idx < 0 ? null : 'wamid.s' + (idx + 1); }
function limpia() { webhook.olvidaTodo(); agente.olvidaTodo(); tickets.olvidaTodo(); mandados = []; upserts = []; llamadasALaIA = 0; }
const DUENO = process.env.DUENO_WHATSAPP;

/* ============================================================ */
titulo('«yo»: el dueño toma el chat');
{
  limpia();
  const C = '5213366675001';
  await dice('hola', C);
  ok('la IA contestó el primer mensaje', textos(C).length, 1);
  /* El dueño necesita un mensaje del cliente que citar: se lo pide con «ver». */
  await dice('ver ' + C, DUENO);
  const ticketVer = ultimoAlDueno();
  okQue('«ver» le da un mensaje citable', !!ticketVer);
  await contesta(ticketVer, 'yo');
  okQue('el dueño recibe la confirmación de que tomó el chat', /Tomaste el chat/.test(textos(DUENO).join('\n')));
  ok('  la ficha lo dice', tickets.fichaDe(C).enManosDe, 'dueno');
  okQue('  y viaja al almacén (en_manos_de)', upserts.some((u) => u.numero === '3366675001' && u.en_manos_de === 'dueno'));

  llamadasALaIA = 0;
  const antesCliente = textos(C).length;
  await dice('¿y a vallarta cuánto?', C);
  ok('el cliente escribe y el bot NO contesta', textos(C).length, antesCliente);
  ok('  ni llama a la IA', llamadasALaIA, 0);
  const reenvio = textos(DUENO).slice(-1)[0];
  okQue('  el dueño recibe el reenvío tal cual', /en tus manos/.test(reenvio) && /a vallarta cu[aá]nto/i.test(reenvio));

  await contesta(ultimoAlDueno(), 'Sale en lo que te dije el otro día, ¿va?');
  ok('el dueño contesta el reenvío y le llega literal al cliente', textos(C).slice(-1)[0], 'Sale en lo que te dije el otro día, ¿va?');

  /* Una foto del cliente también se reenvía. */
  mandados = [];
  await manda({ from: C, type: 'image', image: { id: 'MEDIA-DEL-CLIENTE' } });
  const foto = mandados.find((m) => mismo(m.to, DUENO) && m.image && m.image.id === 'MEDIA-DEL-CLIENTE');
  okQue('una foto del cliente le llega al dueño como foto', !!foto);
  ok('  y al cliente no se le contesta', textos(C).length, 0);

  /* El tablero lo marca. */
  mandados = [];
  await dice('tablero', DUENO);
  okQue('el tablero marca el chat con ✋', /✋ 5213366675001/.test(textos(DUENO).join('\n')));
}

/* ============================================================ */
titulo('«bot»: el chat vuelve a la ia');
{
  const C = '5213366675001';
  mandados = []; upserts = [];
  await dice('¿sigues ahí?', C);   // sigue en manos del dueño: reenvío
  await contesta(ultimoAlDueno(), 'bot');
  okQue('el dueño recibe «el bot retoma»', /retoma el chat/.test(textos(DUENO).join('\n')));
  ok('  la ficha lo suelta', tickets.fichaDe(C).enManosDe, null);
  okQue('  y en el almacén queda en nulo', upserts.some((u) => u.numero === '3366675001' && u.en_manos_de === null));
  llamadasALaIA = 0;
  const antes = textos(C).length;
  await dice('a vallarta', C);
  ok('la IA vuelve a contestar', textos(C).length, antes + 1);
  ok('  con su llamada', llamadasALaIA, 1);
}

/* ============================================================ */
titulo('«yo» por número escrito, y «yo» sin cliente');
{
  limpia();
  const C = '5213366675002';
  await dice('hola', C);
  await dice(C + ' yo', DUENO);
  ok('«<número> yo» toma el chat', tickets.fichaDe(C).enManosDe, 'dueno');
  await dice(C + ' bot', DUENO);
  ok('«<número> bot» lo devuelve', tickets.fichaDe(C).enManosDe, null);
  /* Como lo quiere el dueño: los 10 dígitos pegados, sin 52 1. */
  await dice('3366675002 yo', DUENO);
  ok('«3366675002 yo» (10 dígitos pegados) toma el chat', tickets.fichaDe(C).enManosDe, 'dueno');
  ok('  y la ficha conserva el número completo para mandar', tickets.fichaDe(C).cliente, C);
  mandados = [];
  await dice('me urge', C);
  okQue('  el reenvío llega al dueño', /en tus manos/.test(textos(DUENO).join('\n')));
  await dice('3366675002 bot', DUENO);
  ok('«3366675002 bot» lo devuelve', tickets.fichaDe(C).enManosDe, null);
  mandados = [];
  await dice('yo', DUENO);
  okQue('«yo» sin cliente: se le pregunta de quién', /De qui[eé]n/.test(textos(DUENO).join('\n')));
}

console.log('\n' + buenas + ' buenas, ' + malas + ' malas');
process.exit(malas ? 1 : 0);
