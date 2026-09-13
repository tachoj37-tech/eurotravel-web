/* ============================================================
   A SU NÚMERO NO SE MANDA NADA (13-sep-2026)
   ============================================================
   Dictado del dueño: «no quiero que me mandes nada a mi número, solo le
   mandas el ticket al cliente y ya».

   El flujo cambió: el ticket ya no le llega a él por separado. Se queda
   EN EL CHAT del cliente, y el vendedor lo lee ahí y pone el precio.

   Esta batería corre el camino completo —cliente que escribe por primera
   vez, cotiza, recibe su ticket— con el interruptor como queda en
   producción (sin tocar), y cuenta cuántos mensajes le llegan al dueño.
   Tienen que ser CERO.

   Y cuida la otra mitad: que apagar los avisos no le quite nada al
   cliente. Si por callar al dueño el cliente se queda sin su ticket, el
   arreglo es peor que el defecto.

   El canal de avisos NO se borró —sigue probado en otras once baterías,
   que encienden `AVISOS_AL_DUENO=1`—. Aquí se prueba apagado.
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
/* Lo que se prueba: el interruptor SIN poner, que es como queda. */
delete process.env.AVISOS_AL_DUENO;
process.env.ANTHROPIC_API_KEY = 'k';
process.env.AGENTE_IA = '1';
process.env.CONFIRMAR_PRECIOS = '1';
process.env.SITIO_URL = 'https://eurotravel-web.vercel.app';
process.env.BOT_HASTA_COTIZACION = '1';
delete process.env.ESPIAR;
delete process.env.ALMACEN_URL; delete process.env.ALMACEN_CLAVE;

let buenas = 0, malas = 0;
function ok(que, condicion) {
  if (condicion) { buenas++; console.log('ok   ' + que); }
  else { malas++; console.log('FALLA ' + que); }
}
function titulo(t) { console.log('\n== ' + t.toUpperCase() + ' =='); }

let mandados = [];
let laIA = function () { return null; };   // sin IA: el guion solo, determinista

globalThis.fetch = async function (url, opciones) {
  const u = String(url);
  const cuerpo = opciones && opciones.body ? JSON.parse(opciones.body) : {};
  if (u.indexOf('graph.facebook.com') !== -1) {
    mandados.push(cuerpo);
    return { ok: true, status: 200, json: async () => ({ messages: [{ id: 'wamid.s' + mandados.length }] }), text: async () => '{}' };
  }
  if (u.indexOf('api.anthropic.com') !== -1) {
    const j = laIA();
    if (!j) return { ok: false, status: 500, json: async () => ({}), text: async () => 'e' };
    return { ok: true, status: 200, json: async () => ({ content: [{ type: 'text', text: JSON.stringify(j) }], usage: { input_tokens: 1, output_tokens: 1 } }), text: async () => '' };
  }
  return { ok: false, status: 500, json: async () => ({}), text: async () => 'sin red' };
};

const atiende = (await import(pathToFileURL(path.join(RAIZ, 'api', 'whatsapp.mjs')).href)).default;
const webhook = (await import(pathToFileURL(path.join(RAIZ, 'api', '_whatsapp-webhook.js')).href)).default;
const agente = (await import(pathToFileURL(path.join(RAIZ, 'api', '_agente.js')).href)).default;
const tk = (await import(pathToFileURL(path.join(RAIZ, 'api', '_tickets.js')).href)).default;

const DUENO = process.env.DUENO_WHATSAPP;
let n = 0;
const firma = (c) => 'sha256=' + crypto.createHmac('sha256', SECRETO).update(c).digest('hex');
const mismo = (a, b) => String(a || '').replace(/\D/g, '').slice(-10) === String(b || '').replace(/\D/g, '').slice(-10);
function textos(para) {
  return mandados.filter((m) => mismo(m.to, para)).map((m) => (m.text && m.text.body) ||
    (m.interactive && m.interactive.body && m.interactive.body.text) || (m.image && m.image.caption) || '');
}
function limpia() { webhook.olvidaTodo(); agente.olvidaTodo(); tk.olvidaTodo(); mandados = []; }
async function dice(texto, de, cita) {
  n++;
  const c = JSON.stringify({ entry: [{ changes: [{ value: { metadata: { phone_number_id: '111' },
    contacts: [{ wa_id: de, profile: { name: 'Cliente' } }],
    messages: [Object.assign({ id: 'wamid.h' + n, from: de, type: 'text', text: { body: texto } }, cita ? { context: { id: cita } } : {})] } }] }] });
  await atiende(new Request('https://x/api/whatsapp', { method: 'POST', body: c, headers: { 'x-hub-signature-256': firma(c) } }));
}

/* ============================================================ */
titulo('un cliente nuevo cotiza de punta a punta');
{
  limpia();
  const C = '5213366669001';
  for (const m of ['hola', 'Cotizar un viaje', 'a chapala', 'somos 14', 'de guadalajara',
    '18 de octubre', 'el mismo dia', 'si']) {
    await dice(m, C);
  }
  const alDueno = textos(DUENO);
  ok('al dueño le llegan CERO mensajes (le llegaron ' + alDueno.length + ')', alDueno.length === 0);
  /* Los de antes, uno por uno, para que un día no vuelva uno solo. */
  ok('  ni «número nuevo escribiendo»', !/N[uú]mero nuevo/.test(alDueno.join('\n')));
  ok('  ni el ticket de precio por confirmar', !/Precio por confirmar/.test(alDueno.join('\n')));

  /* La otra mitad: el cliente sí tiene lo suyo. */
  const alCliente = textos(C).join('\n');
  ok('el cliente sí recibió su ticket', /Chapala/.test(alCliente) && /14/.test(alCliente));
  ok('  sin precio', !/\$\s?\d/.test(alCliente));
  /* Esta línea cazó otro defecto al escribirla: con la IA caída, el
     agente pisaba el estado del guion y el cliente, al decir «el mismo
     día», recibía otra vez «¿qué día salen?». Nunca llegaba al ticket. */
  ok('  y avisado de que viene', /en un momento te paso tu precio/i.test(alCliente) ||
    /en breve te paso tu cotizaci[oó]n/i.test(alCliente));
}

/* ============================================================ */
titulo('lo que el bot no sabe, tampoco se lo manda');
{
  limpia();
  const C = '5213366669002';
  await dice('hola', C);
  await dice('me pasas tu RFC para la factura?', C);
  ok('una pregunta que el bot no contesta no le llega al dueño', textos(DUENO).length === 0);
}

/* ============================================================ */
titulo('pero si él le escribe al bot, sí le contesta');
{
  /* Callar las respuestas a sus propias órdenes no es «no mandarle nada»:
     es romperle los comandos. «tablero» es algo que él pidió. */
  limpia();
  await dice('tablero', DUENO);
  ok('«tablero» sí le contesta', textos(DUENO).length >= 1);
}

console.log('\n' + buenas + ' buenas, ' + malas + ' malas');
process.exit(malas ? 1 : 0);
