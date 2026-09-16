/* ============================================================
   CONVERSAR POR LA PUERTA DE KOMMO · con el modelo real (16-sep-2026)
   ============================================================
   Igual que `conversar.mjs`, pero cada mensaje entra como lo manda el
   Salesbot de Kommo desde el paso de código (`widget_request`, sin
   token) y lo que se imprime es lo que Kommo recibiría en
   `execute_handlers`: textos, botones, fotos como adjunto del drive y
   la orden de parar. Kommo no se llama de verdad: el `return_url` se
   intercepta aquí. La IA sí es la real (llave en .env.local).

     node scripts/conversar-kommo.mjs            (todos los escenarios)
     node scripts/conversar-kommo.mjs b f        (solo esos)
   ============================================================ */
import path from 'path';
import fs from 'fs';
import { fileURLToPath, pathToFileURL } from 'url';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
if (!process.env.ANTHROPIC_API_KEY) {
  try {
    const local = fs.readFileSync(path.join(RAIZ, '.env.local'), 'utf8');
    const m = local.match(/^\s*ANTHROPIC_API_KEY\s*=\s*["']?([^"'\r\n]+)["']?\s*$/m);
    if (m) process.env.ANTHROPIC_API_KEY = m[1].trim();
  } catch (e) { /* sin archivo */ }
}
if (!process.env.ANTHROPIC_API_KEY) { console.error('Falta ANTHROPIC_API_KEY en el entorno o en .env.local.'); process.exit(2); }

/* El entorno de Kommo tal como queda en Vercel (sin secretos de verdad). */
process.env.KOMMO_SUBDOMINIO = 'direccioneurotravelcommx';
process.env.KOMMO_TOKEN = 'token-de-mentiras';
process.env.KOMMO_CANAL = '60452';
process.env.SITIO_URL = 'https://eurotravel-web.vercel.app';
process.env.WHATSAPP_RUTA_SECRETA = 'a'.repeat(48);
process.env.BOT_HASTA_COTIZACION = process.env.BOT_HASTA_COTIZACION || '1';
process.env.AGENTE_IA = '1';
process.env.CONFIRMAR_PRECIOS = '1';
delete process.env.WHATSAPP_TOKEN; delete process.env.WHATSAPP_PHONE_ID; delete process.env.WHATSAPP_WABA_ID;
delete process.env.ALMACEN_URL; delete process.env.ALMACEN_CLAVE; delete process.env.DUENO_WHATSAPP;
delete process.env.KOMMO_SECRETO;

const TOPE_USD = Number(process.env.TOPE_USD || 1);
let gastado = 0;
for (const k of ['log', 'error']) {
  const original = console[k].bind(console);
  console[k] = function () {
    const s = Array.prototype.map.call(arguments, String).join(' ');
    const m = s.match(/\busd=(\d+(?:\.\d+)?)/);
    if (m) {
      gastado += Number(m[1]);
      if (gastado > TOPE_USD) { original('\n⛔ Tope de $' + TOPE_USD + ' USD alcanzado (gastado $' + gastado.toFixed(3) + '). Me detengo.'); process.exit(3); }
    }
    if (/^\[(ia|turno)\]/.test(s)) return;
    original.apply(console, arguments);
  };
}

/* Kommo de mentiras: el return_url se intercepta; todo lo demás (la IA) pasa. */
const continuaciones = [];
const fetchReal = global.fetch;
global.fetch = async function (url, init) {
  const u = String(url);
  if (/\/continue\//.test(u)) {
    continuaciones.push(JSON.parse(init.body));
    return { ok: true, status: 200, text: async () => '', json: async () => ({}) };
  }
  return fetchReal(url, init);
};

const mod = await import(pathToFileURL(path.join(RAIZ, 'api', 'whatsapp.mjs')).href);
const atiende = mod.default;
const agente = (await import(pathToFileURL(path.join(RAIZ, 'api', '_agente.js')).href)).default;
const webhook = (await import(pathToFileURL(path.join(RAIZ, 'api', '_whatsapp-webhook.js')).href)).default;
const tk = (await import(pathToFileURL(path.join(RAIZ, 'api', '_tickets.js')).href)).default;
const fotos = JSON.parse(fs.readFileSync(path.join(RAIZ, 'api', '_kommo-fotos.json'), 'utf8'));
function nombreDeFoto(uuid) {
  for (const c of Object.keys(fotos)) for (const f of Object.keys(fotos[c])) if (fotos[c][f] === uuid) return c + '/' + f;
  return uuid;
}

function respuesta() {
  const r = { codigo: null, cuerpo: null };
  r.status = function (c) { r.codigo = c; return r; };
  r.json = function (x) { r.cuerpo = x; return r; };
  r.send = r.json;
  return r;
}
let n = 0;
async function manda(texto, lead) {
  n++;
  /* Lo que manda el paso de código: sin token; el número sale del contacto. */
  const cuerpo = JSON.stringify({
    data: { from: 'kommo', message: texto, lead_id: String(lead), contact_name: 'Cliente de prueba',
      contact_phone: '+52 1 33 4400 ' + String(lead).slice(-4), talk_id: 't' + lead },
    return_url: 'https://direccioneurotravelcommx.kommo.com/api/v4/salesbot/84562/continue/abc' + n
  });
  const res = respuesta();
  await atiende({ method: 'POST', headers: { 'content-type': 'application/json', 'x-interno': process.env.WHATSAPP_RUTA_SECRETA },
    url: '/api/whatsapp', query: { llave: 'kommo-trabajo' }, rawBody: cuerpo }, res);
  return res;
}
function pinta(h) {
  if (h.handler === 'show' && h.params.type === 'text') return h.params.value;
  if (h.handler === 'show' && h.params.type === 'buttons') return h.params.value + '\n   [' + h.params.buttons.join('] [') + ']';
  if (h.handler === 'send_message') {
    return '[foto ' + (h.params.attachments || []).map(a => nombreDeFoto(a.value)).join(', ') + '] ' +
      (h.params.text || '') + ' · canales ' + JSON.stringify(h.params.chat_sources);
  }
  if (h.handler === 'stop') return '⏹ PARAR EL BOT';
  return JSON.stringify(h);
}
let fallas = 0;
async function corre(nombre, lead, guion) {
  webhook.olvidaTodo(); agente.olvidaTodo(); tk.olvidaTodo(); continuaciones.length = 0;
  console.log('\n══════════ ' + nombre + ' ══════════');
  for (const texto of guion) {
    const antes = continuaciones.length;
    console.log('\nCLIENTE: ' + texto);
    const res = await manda(texto, lead);
    const nuevas = continuaciones.slice(antes);
    if (res.codigo !== 200 || !nuevas.length) {
      console.log('✗ FALLA: la puerta contestó ' + res.codigo + ' ' + JSON.stringify(res.cuerpo) + ' y Kommo recibió ' + nuevas.length + ' continuaciones');
      fallas++; continue;
    }
    for (const c of nuevas) {
      /* Lo que Kommo pinta con {{json.texto}} en su bloque «Mensaje». */
      if (c.data.texto) console.log('BOT:     ' + String(c.data.texto).replace(/\n/g, '\n         '));
      for (const h of c.execute_handlers) console.log('BOT:     ' + pinta(h).replace(/\n/g, '\n         '));
      console.log('         · status ' + c.data.status + (c.data.status === 'fin' ? ' ⏹ (el bot para)' : ''));
      const noAdmitidos = c.execute_handlers.filter(h => h.handler !== 'show' && h.handler !== 'goto');
      if (noAdmitidos.length) { console.log('✗ FALLA: handler que Kommo no admite: ' + noAdmitidos.map(h => h.handler).join(',')); fallas++; }
      const largos = c.execute_handlers.filter(h => h.handler === 'show' && String(h.params.value || '').length > 80);
      if (largos.length) { console.log('✗ FALLA: show de más de 80 letras'); fallas++; }
      if (!c.data.texto && !c.execute_handlers.length) { console.log('✗ FALLA: Kommo no recibió nada que decir'); fallas++; }
    }
  }
  console.log('\n(gastado hasta aquí: $' + gastado.toFixed(3) + ' USD)');
}

const escenarios = {
  b: ['Nueva cotización', 'hola! es que mi hermano se casa y le queremos hacer su despedida', 'pues estamos pensando en tequila, dicen que está padre', 'el 18 de octubre', 'vamos como 14', 'sí, todos de aquí de guadalajara', 'sí, ese mismo día regresamos', 'ok'],
  f: ['Nueva cotización', 'quiero cotizar un viaje a Sayulita', 'salimos pasado y quiero un camión', 'que camiones tiene?', 'mándame fotos del i6s', 'ese', 'regresamos el domingo', 'sí, de guadalajara'],
  f0: ['buenas tardes', 'quiero cotizar un viaje a Sayulita', 'salimos pasado y quiero un camión', 'que camiones tiene?', 'i6', 'quiero reservar', 'si', 'sí, de guadalajara'],
  p: ['hola', 'quiero hablar con una persona'],
  g: ['Nueva cotización', 'oigan qué camiones manejan?', 'el más nuevo cuál es?', 'y ese cuánto sale a puerto vallarta?', 'somos 40, del 5 al 7 de diciembre', 'sí de guadalajara', 'solo nos llevan y traen']
};
const pedidos = process.argv.slice(2).filter((x) => escenarios[x]);
let lead = 26818280;
for (const k of (pedidos.length ? pedidos : Object.keys(escenarios))) await corre('Escenario ' + k, lead++, escenarios[k]);
console.log('\nListo. Gasto total: $' + gastado.toFixed(3) + ' USD · fallas: ' + fallas);
process.exit(fallas ? 1 : 0);
