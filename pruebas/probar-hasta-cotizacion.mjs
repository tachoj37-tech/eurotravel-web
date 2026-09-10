/* ============================================================
   EL BOT LLEGA HASTA LA COTIZACIÓN Y AHÍ ENTRA UNA PERSONA
   ============================================================
   Dictado del dueño (10-sep-2026): «que el bot solamente llegue hasta
   generar cotizaciones; una vez que la cotización se dé, ya ahí que sea
   persona», y «me gustaría que la persona tenga acceso sencillo a esto,
   pero que el cliente lo reciba, como un botón, sencillamente».

   Este arnés prueba ESE camino, con `BOT_HASTA_COTIZACION` en 1, que es
   como corre en producción. El camino automático de antes —el bot hacía
   solo el apartado, el comprobante y el contrato— no se borró y se sigue
   probando en los otros archivos, con la variable en 0.

   Lo que se vigila, en orden de qué tan caro sale si falla:

   1 · Que al entregarse el precio el chat quede en manos de una persona
       y el bot deje de contestarle al cliente. Si el bot sigue hablando
       encima del vendedor, el cliente ve dos voces.
   2 · Que lo que el cliente escriba después le llegue a la persona. Si
       no llega, el cliente queda hablándole a una pared.
   3 · Que los tres botones manden lo correcto, con la CLABE de verdad.
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
process.env.SITIO_URL = 'https://eurotravel-web.vercel.app';
process.env.CLABE = '012320001927217407';
process.env.CUENTA = '0192721740';
process.env.DATOS_BANCARIOS = 'BBVA · a nombre de Turismo ET, S.A. de C.V.';
/* LO QUE ESTE ARCHIVO PRUEBA. En 1 como en producción. */
process.env.BOT_HASTA_COTIZACION = '1';
delete process.env.ALMACEN_URL; delete process.env.ALMACEN_CLAVE;

let buenas = 0, malas = 0;
function ok(que, dio, esperaba) {
  const bien = JSON.stringify(dio) === JSON.stringify(esperaba);
  if (bien) { buenas++; console.log('ok   ' + que); }
  else {
    malas++;
    console.log('MAL  ' + que);
    console.log('     dio      ' + JSON.stringify(dio));
    console.log('     esperaba ' + JSON.stringify(esperaba));
  }
}
function okQue(que, condicion) { ok(que, !!condicion, true); }
function titulo(t) { console.log('\n== ' + t.toUpperCase() + ' =='); }

let mandados = [];
let laIA = function () { return { respuesta: 'Va 🙌', datos: {}, accion: 'seguir' }; };
globalThis.fetch = async function (url, opciones) {
  const u = String(url);
  const cuerpo = opciones && opciones.body ? JSON.parse(opciones.body) : {};
  if (u.indexOf('graph.facebook.com') !== -1) {
    mandados.push(cuerpo);
    return { ok: true, status: 200, json: async () => ({ messages: [{ id: 'wamid.s' + mandados.length }] }), text: async () => '{}' };
  }
  if (u.indexOf('api.anthropic.com') !== -1) {
    const ultimo = String(cuerpo.messages[cuerpo.messages.length - 1].content);
    const j = laIA(ultimo);
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
  return mandados.filter((m) => mismo(m.to, para)).map((m) => (m.text && m.text.body) || (m.image && m.image.caption) || '');
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
titulo('al entregar el precio, el chat pasa a una persona');
{
  limpia();
  const C = '5213366668001';
  tk.anotaEtapa(C, 'con_precio', { porConfirmar: { cotiza: null, total: null, anticipo: null,
    resumen: { origen: 'Guadalajara', destino: 'Tequila', salida: '2026-10-18', regreso: '2026-10-18',
      gente: 14, unidad: 'Sprinter', recorridos: 0 } } }, Date.now());
  tk.recuerdaTicket('wamid.precio-' + C, C, { cotiza: null,
    resumen: { origen: 'Guadalajara', destino: 'Tequila', salida: '2026-10-18', regreso: '2026-10-18',
      gente: 14, unidad: 'Sprinter', recorridos: 0 }, total: null, anticipo: null });

  /* El dueño pone el precio. */
  await dice('7000', DUENO, 'wamid.precio-' + C);
  okQue('el cliente recibe su precio', /\*Total: \$7,000\*/.test(textos(C).join('\n')));
  ok('  y el chat queda en manos de una persona', (tk.fichaDe(C) || {}).enManosDe, 'dueno');

  /* Y de aquí en adelante el bot ya no le contesta. */
  const antes = textos(C).length;
  laIA = () => ({ respuesta: 'Claro, con gusto te lo aparto.', datos: {}, accion: 'apartar' });
  await dice('sí, apártamelo', C);
  ok('el bot ya NO le contesta al cliente', textos(C).length, antes);
  okQue('  y lo que escribió le llega a la persona',
    /apártamelo/i.test(textos(DUENO).join('\n')));
}

/* ============================================================ */
titulo('los tres botones, con el chat ya en manos de una persona');
{
  limpia();
  const C = '5213366668002';
  tk.anotaEtapa(C, 'con_precio', { total: 7000, anticipo: 1500, enManosDe: 'dueno',
    viajeDatos: { origen: 'Guadalajara', destino: 'Tequila', salida: '2026-10-18', regreso: '2026-10-18',
      gente: 14, unidad: 'Sprinter', recorridos: 0 } }, Date.now());
  tk.recuerdaTicket('wamid.chat-' + C, C);

  let antes = textos(C).length;
  await dice('cuenta', DUENO, 'wamid.chat-' + C);
  const t1 = textos(C).slice(antes).join('\n');
  okQue('«cuenta» le manda el anticipo', /\$1,500/.test(t1));
  okQue('  y la CLABE de verdad, pelona', textos(C).indexOf('012320001927217407') >= 0);
  okQue('  y el número de cuenta', textos(C).indexOf('0192721740') >= 0);

  antes = textos(C).length;
  await dice('recibido', DUENO, 'wamid.chat-' + C);
  okQue('«recibido» le confirma el pago', /pago qued[oó] confirmado/i.test(textos(C).slice(antes).join('\n')));
  ok('  y la ficha lo marca aprobado', (tk.fichaDe(C) || {}).pagoAprobado, true);

  antes = textos(C).length;
  await dice('contrato', DUENO, 'wamid.chat-' + C);
  okQue('«contrato» le pide sus datos', /nombre completo/i.test(textos(C).slice(antes).join('\n')));

  /* Y el chat sigue siendo suyo: los botones no se lo devuelven al bot. */
  ok('los botones no le devuelven el chat al bot', (tk.fichaDe(C) || {}).enManosDe, 'dueno');
}

/* ============================================================ */
titulo('con «bot» el chat vuelve, y el bot hace todo como antes');
{
  limpia();
  const C = '5213366668003';
  tk.anotaEtapa(C, 'con_precio', { total: 7000, anticipo: 1500, enManosDe: 'dueno',
    viajeDatos: { origen: 'Guadalajara', destino: 'Tequila', salida: '2026-10-18', regreso: '2026-10-18',
      gente: 14, unidad: 'Sprinter', recorridos: 0 } }, Date.now());
  tk.recuerdaTicket('wamid.chat-' + C, C);
  await dice('bot', DUENO, 'wamid.chat-' + C);
  ok('«bot» suelta el chat', (tk.fichaDe(C) || {}).enManosDe, null);
  const antes = textos(C).length;
  laIA = () => ({ respuesta: null, datos: {}, accion: 'apartar' });
  await dice('apártamelo', C);
  okQue('y el bot vuelve a contestarle solo', textos(C).length > antes);
}

/* ============================================================ */
titulo('los botones a destiempo: sin cotización no se dice una frase rota');
{
  limpia();
  const C = '5213366668004';
  /* Ficha sin precio: el vendedor apretó «cuenta» antes de cotizar. */
  tk.anotaEtapa(C, 'escribio', {}, Date.now());
  tk.recuerdaTicket('wamid.chat-' + C, C);
  const antes = textos(C).length;
  await dice('cuenta', DUENO, 'wamid.chat-' + C);
  const t = textos(C).slice(antes).join('\n');
  okQue('no sale «el anticipo de anticipo»', !/el anticipo de anticipo/i.test(t));
  okQue('  se dice de otra forma, sin hueco', /se deja un anticipo/i.test(t));
  okQue('  y la cuenta sí le llega igual', textos(C).indexOf('012320001927217407') >= 0);
}

console.log('\n' + buenas + ' buenas, ' + malas + ' malas');
process.exit(malas ? 1 : 0);
