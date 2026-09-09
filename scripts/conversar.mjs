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
globalThis.fetch = async function (url, opciones) {
  const u = String(url);
  if (u.indexOf('graph.facebook.com') !== -1) {
    mandados.push(JSON.parse(opciones.body));
    return { ok: true, status: 200, json: async () => ({ messages: [{ id: 'wamid.s' + mandados.length }] }), text: async () => '{}' };
  }
  if (u.indexOf('api.anthropic.com') !== -1) return fetchReal(url, opciones);
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
async function corre(nombre, C, guion) {
  webhook.olvidaTodo(); agente.olvidaTodo(); tk.olvidaTodo(); mandados = [];
  console.log('\n══════════ ' + nombre + ' ══════════');
  for (const paso of guion) {
    const antes = mandados.length;
    if (typeof paso === 'function') { await paso(); }
    else { console.log('\nCLIENTE: ' + paso); await manda(C, paso); }
    for (const m of mandados.slice(antes)) {
      if (mismo(m.to, C)) console.log('BOT:     ' + ((m.text && m.text.body) || (m.image ? '[foto ' + (m.image.link || m.image.id) + '] ' + (m.image.caption || '') : JSON.stringify(m))).replace(/\n/g, '\n         '));
      else if (mismo(m.to, DUENO)) console.log('→ DUEÑO: ' + ((m.text && m.text.body) || '[medio]').split('\n')[0]);
    }
  }
}
const va = (C) => async () => {
  const t = ultimoTicket();
  if (!t) { console.log('(sin ticket que contestar)'); return; }
  console.log('\nDUEÑO contesta el ticket: va');
  await manda(DUENO, 'va', { context: { id: t } });
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
  i: ['buen día, cotización para 45 pax GDL–Mazatlán, 10 al 12 de octubre, unidad ejecutiva', 'requiero tarifa neta y si manejan comisión', 'facturan? y me mandan póliza de seguro', 'el i6s está bien', 'ok quedo al pendiente del neto']
};
const pedidos = process.argv.slice(2).filter((x) => escenarios[x]);
for (const k of (pedidos.length ? pedidos : Object.keys(escenarios))) {
  const C = '521336667900' + { a: 1, b: 2, c: 3, d: 4, e: 5, f: 6, g: 7, h: 8, i: 9 }[k];
  const guion = escenarios[k].map((p) => (typeof p === 'function' && p.length === 0 && k === 'e') ? p : p);
  await corre('Escenario ' + k, C, guion);
  console.log('\n(gastado hasta aquí: $' + gastado.toFixed(3) + ' USD)');
}
console.log('\nListo. Gasto total: $' + gastado.toFixed(3) + ' USD.');
