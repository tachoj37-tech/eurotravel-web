/* ============================================================
   LA MEMORIA DE PRECIOS, DE PUNTA A PUNTA
   ------------------------------------------------------------
   Dictado del dueño (5-sep-2026): «yo te pongo el precio y te
   aprendes el viaje; si alguien va a hacer el mismo viaje me vas a
   recomendar ese precio».

   Meta, el calendario y el ALMACÉN son de mentiras: aquí se mira
   que lo que el dueño contesta se guarde, y que el ticket del
   siguiente cliente con el mismo viaje lo traiga.
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
process.env.HOY_DE_PRUEBA = '2026-09-03';
process.env.DISPONIBILIDAD_API_KEY = 'llave-de-lectura-de-mentiras';
process.env.ANTHROPIC_API_KEY = 'clave-de-mentiras';
process.env.CONFIRMAR_PRECIOS = '1';
process.env.CONFIRMAR_DISPONIBILIDAD = '1';
/* El almacén de mentiras: con estas dos puestas, `hayAlmacen()` es cierto
   y todo lo que el bot guarde o lea pasa por el `fetch` de abajo. */
process.env.ALMACEN_URL = 'https://almacen.de.mentiras';
process.env.ALMACEN_CLAVE = 'clave-del-almacen-de-mentiras';

const atiende = (await import(pathToFileURL(path.join(RAIZ, 'api', 'whatsapp.mjs')).href)).default;
const webhook = (await import(pathToFileURL(path.join(RAIZ, 'api', '_whatsapp-webhook.js')).href)).default;

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

/* ---- el fetch de mentiras ---- */
let mandados = [];
let precios = [];          // la tabla `precios` de mentiras
let preciosGuardados = []; // lo que el bot mandó a guardar

globalThis.fetch = async function (url, opciones) {
  const u = String(url);
  const cuerpo = opciones && opciones.body ? JSON.parse(opciones.body) : {};
  const metodo = (opciones && opciones.method) || 'GET';

  if (u.indexOf('graph.facebook.com') !== -1) {
    mandados.push(cuerpo);
    return { ok: true, status: 200,
      json: async function () { return { messages: [{ id: 'wamid.salida' + mandados.length }] }; },
      text: async function () { return '{}'; } };
  }
  if (u.indexOf('/api/disponibilidad') !== -1) {
    return { ok: true, status: 200, json: async function () { return { datos: { libres: 2, total: 4 } }; }, text: async function () { return ''; } };
  }
  if (u.indexOf('almacen.de.mentiras') !== -1) {
    if (u.indexOf('/rest/v1/precios') !== -1) {
      if (metodo === 'POST') { precios.unshift(cuerpo); preciosGuardados.push(cuerpo); return { ok: true, status: 201, json: async function () { return {}; }, text: async function () { return ''; } }; }
      const m = u.match(/clave=eq\.([^&]+)/);
      const clave = m ? decodeURIComponent(m[1]) : '';
      const lista = precios.filter(function (p) { return p.clave === clave; });
      return { ok: true, status: 200, json: async function () { return lista; }, text: async function () { return ''; } };
    }
    /* fichas, charlas, mensajes, tickets: todo «bien» y vacío. */
    return { ok: true, status: metodo === 'GET' ? 200 : 201,
      json: async function () { return []; }, text: async function () { return ''; } };
  }
  if (u.indexOf('api.anthropic.com') !== -1) {
    return { ok: false, status: 500, text: async function () { return ''; } };
  }
  throw new Error('el bot llamó a algo que no debía: ' + u);
};

const firma = (c) => 'sha256=' + crypto.createHmac('sha256', SECRETO).update(Buffer.from(c, 'utf8')).digest('hex');
let contador = 0;
async function manda(mensaje) {
  contador++;
  const cuerpo = JSON.stringify({ entry: [{ changes: [{ value: {
    metadata: { phone_number_id: '111' },
    messages: [Object.assign({ id: 'wamid.p' + contador, type: 'text' }, mensaje)]
  } }] }] });
  await atiende(new Request('https://x/api/whatsapp', { method: 'POST', body: cuerpo, headers: { 'x-hub-signature-256': firma(cuerpo) } }));
}
const dice = (texto, de) => manda({ from: de, text: { body: texto } });
const contesta = (texto, citaId) => manda({ from: process.env.DUENO_WHATSAPP, text: { body: texto }, context: citaId ? { id: citaId } : undefined });
function mismo(a, b) { return String(a || '').replace(/\D/g, '').slice(-10) === String(b || '').replace(/\D/g, '').slice(-10); }
function textos(para) { return mandados.filter((m) => mismo(m.to, para)).map((m) => (m.text && m.text.body) || ''); }
function idDelUltimoTicket() {
  let idx = -1;
  mandados.forEach(function (m, i) { if (mismo(m.to, process.env.DUENO_WHATSAPP)) idx = i; });
  return idx < 0 ? null : 'wamid.salida' + (idx + 1);
}
async function cotizaChapala(C) {
  await dice('a chapala el 20 de noviembre somos 12, salimos de guadalajara', C);
  await dice('regresamos el 22', C);
  await dice('no vamos a pasear', C);
  await dice('sí está bien', C);
}
const DUENO = process.env.DUENO_WHATSAPP;

/* A · Primer cliente: el ticket no trae historial (no hay), el dueño fija 48,000. */
{
  webhook.olvidaTodo(); mandados = []; precios = []; preciosGuardados = [];
  const C = '5213366670101';
  await cotizaChapala(C);
  const t1 = textos(DUENO).join('\n');
  okQue('sin historial, el ticket no inventa nada', !/Antes lo diste|Sugerido/.test(t1));
  const ticket = idDelUltimoTicket();
  mandados = [];
  await contesta('48,000', ticket);
  okQue('el cliente recibió $48,000', /\*Total: \$48,000\*/.test(textos(C).join('\n')));
  ok('se guardó UN precio', preciosGuardados.length, 1);
  const g = preciosGuardados[0] || {};
  ok('  con el total que él fijó, marcado como fijado', [g.total, g.fijado], [48000, true]);
  okQue('  con la clave del viaje (origen, destino, unidad, días)', /^guadalajara\|chapala\|sprinter\|3$/.test(g.clave));
  ok('  con pasajeros y salida', [g.pasajeros, g.salida], [12, '2026-11-20']);
}

/* B · Segundo cliente, mismo viaje: el ticket trae lo que dio y lo sugiere; él dice «va». */
{
  webhook.olvidaTodo(); mandados = []; preciosGuardados = [];
  const C = '5213366670102';
  await cotizaChapala(C);
  const t2 = textos(DUENO).join('\n');
  okQue('el ticket enseña lo que dio antes', /Antes lo diste a: \$48,000/.test(t2));
  okQue('  y lo sugiere', /Sugerido: \*\$48,000\*/.test(t2));
  okQue('  marcado como fijado por él', /✍️/.test(t2));
  const ticket = idDelUltimoTicket();
  mandados = [];
  await contesta('va', ticket);
  okQue('con «va» el cliente recibe el precio calculado (no el sugerido)', /\*Total: \$/.test(textos(C).join('\n')));
  ok('y también se guarda, sin marcar como fijado', [preciosGuardados.length, (preciosGuardados[0] || {}).fijado], [1, false]);
}

/* C · Otro viaje (otro destino): sin historial. */
{
  webhook.olvidaTodo(); mandados = []; preciosGuardados = [];
  const C = '5213366670103';
  await dice('a tequila el 20 de noviembre somos 12, salimos de guadalajara', C);
  await dice('regresamos el 22', C);
  await dice('no vamos a pasear', C);
  await dice('sí está bien', C);
  const t3 = textos(DUENO).join('\n');
  okQue('otro destino: sin historial de Chapala', !/Antes lo diste/.test(t3));
}

console.log('\n' + buenas + ' buenas, ' + malas + ' malas');
process.exit(malas ? 1 : 0);
