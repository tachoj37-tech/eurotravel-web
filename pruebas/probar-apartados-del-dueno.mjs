/* ============================================================
   LO QUE NO LE LLEGÓ AL DUEÑO NO SE PIERDE (10-sep-2026)
   ============================================================
   La ventana de 24 horas de Meta corre en las DOS direcciones. Si el
   dueño lleva un día sin escribirle al número del bot, Meta rechaza
   todo lo que le mandemos —incluido «te mandaron un comprobante»— con
   el error 131047.

   Hasta hoy eso solo dejaba un renglón en el registro y el aviso se
   perdía PARA SIEMPRE: el webhook le contesta 200 a Meta, así que Meta
   tampoco reintenta. Ya le pasó el 9-sep-2026 y se tardó un día en
   descubrirse — el cliente había depositado y del otro lado no había
   nadie.

   Ahora se apartan y se le entregan en cuanto él escribe, que es el
   instante exacto en que la ventana se reabre.

   LO QUE ESTO NO ES: memoria de verdad. Vive en la instancia, así que
   un despliegue se la lleva. Cubre el caso común —el dueño escribe en
   las horas siguientes— y no cubre el caso malo. Lo durable pide una
   tabla nueva, y eso pasa por el dueño.
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
process.env.ANTHROPIC_API_KEY = 'k';
process.env.AGENTE_IA = '1';
process.env.CONFIRMAR_PRECIOS = '1';
process.env.BOT_HASTA_COTIZACION = '1';
delete process.env.ALMACEN_URL; delete process.env.ALMACEN_CLAVE;

let buenas = 0, malas = 0;
function okQue(que, condicion) {
  if (condicion) { buenas++; console.log('ok   ' + que); }
  else { malas++; console.log('FALLA ' + que); }
}
function titulo(t) { console.log('\n== ' + t.toUpperCase() + ' =='); }

/* La ventana, en una variable: cerrada = Meta rechaza con 131047, que es
   exactamente lo que contesta cuando el destinatario lleva más de 24 h
   sin escribir. */
let ventanaCerrada = false;
let mandados = [];
globalThis.fetch = async function (url, opciones) {
  const u = String(url);
  const cuerpo = opciones && opciones.body ? JSON.parse(opciones.body) : {};
  if (u.indexOf('graph.facebook.com') !== -1) {
    if (ventanaCerrada && String(cuerpo.to || '').indexOf('3311112222') !== -1) {
      return { ok: false, status: 400, json: async () => ({}),
        text: async () => JSON.stringify({ error: { message: '(#131047) Re-engagement message', code: 131047 } }) };
    }
    mandados.push(cuerpo);
    return { ok: true, status: 200, json: async () => ({ messages: [{ id: 'wamid.s' + mandados.length }] }), text: async () => '{}' };
  }
  if (u.indexOf('api.anthropic.com') !== -1) {
    return { ok: true, status: 200, text: async () => '',
      json: async () => ({ content: [{ type: 'text', text: JSON.stringify({ respuesta: 'Va 🙌', datos: {}, accion: 'seguir' }) }],
        usage: { input_tokens: 1, output_tokens: 1 } }) };
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
  return mandados.filter((m) => mismo(m.to, para)).map((m) => (m.text && m.text.body) || (m.image && m.image.caption) || '');
}
async function dice(texto, de) {
  n++;
  const c = JSON.stringify({ entry: [{ changes: [{ value: { metadata: { phone_number_id: '111' },
    contacts: [{ wa_id: de, profile: { name: 'Cliente' } }],
    messages: [{ id: 'wamid.a' + n, from: de, type: 'text', text: { body: texto } }] } }] }] });
  await atiende(new Request('https://x/api/whatsapp', { method: 'POST', body: c, headers: { 'x-hub-signature-256': firma(c) } }));
}

titulo('con la ventana cerrada, el aviso no se pierde: se aparta');
{
  webhook.olvidaTodo(); agente.olvidaTodo(); tk.olvidaTodo(); mandados = [];
  ventanaCerrada = true;

  /* Un número nuevo escribe: eso dispara el aviso «primer mensaje», que es
     una de las cinco cosas que el dueño pidió que le lleguen siempre. */
  await dice('hola, quiero cotizar un viaje a vallarta', '5213366667001');

  okQue('al dueño no le llegó nada (Meta lo rechazó)', textos(DUENO).length === 0);
  okQue('pero al cliente sí se le contestó', textos('5213366667001').length > 0);
}

titulo('en cuanto el dueño escribe, se le entrega lo apartado');
{
  ventanaCerrada = false;
  const antes = textos(DUENO).length;

  /* El dueño escribe cualquier cosa: con eso la ventana se reabre. */
  await dice('hola', DUENO);

  const suyos = textos(DUENO);
  okQue('ahora sí le llegó algo', suyos.length > antes);
  const lote = suyos.join('\n');
  okQue('  y viene marcado como lo que no le llegó', /no te lleg[oó] mientras la ventana estaba cerrada/i.test(lote));
  okQue('  con el aviso del número nuevo dentro', /N[uú]mero nuevo escribiendo/.test(lote));
  okQue('  y le explica por qué pasó', /24 h sin mandarle nada al bot/i.test(lote));
}

titulo('no se entrega dos veces');
{
  const antes = textos(DUENO).length;
  await dice('otra cosa', DUENO);
  const nuevos = textos(DUENO).slice(antes).join('\n');
  okQue('el segundo mensaje del dueño ya no repite el lote',
    !/no te lleg[oó] mientras la ventana estaba cerrada/i.test(nuevos));
}

titulo('con la ventana abierta todo sigue igual que siempre');
{
  webhook.olvidaTodo(); agente.olvidaTodo(); tk.olvidaTodo(); mandados = [];
  ventanaCerrada = false;

  await dice('hola, cotizo un viaje a chapala', '5213366667002');
  const suyos = textos(DUENO).join('\n');
  okQue('el aviso le llega directo', /N[uú]mero nuevo escribiendo/.test(suyos));
  okQue('  y sin la envoltura de apartados',
    !/no te lleg[oó] mientras la ventana estaba cerrada/i.test(suyos));
}

console.log('\n' + buenas + ' buenas, ' + malas + ' malas');
process.exit(malas ? 1 : 0);
