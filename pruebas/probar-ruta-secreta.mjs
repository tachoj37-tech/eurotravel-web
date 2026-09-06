/* ============================================================
   LA PUERTA DE DUALHOOK · /api/whatsapp/<tramo secreto>
   ------------------------------------------------------------
   Con Dualhook los avisos llegan firmados con un secreto que no es
   nuestro, así que la puerta es el tramo secreto de la URL y el
   webhook exige que el aviso sea de NUESTRO WABA y NUESTRO número.
   Aquí se prueba esa puerta de punta a punta, con Meta/Dualhook de
   mentiras.
   ============================================================ */
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.join(AQUI, '..');

const TRAMO = 'a1b2c3d4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f60718';   // 48 hex
process.env.WHATSAPP_RUTA_SECRETA = TRAMO;
process.env.WHATSAPP_WABA_ID = '2142416706689411';
process.env.WHATSAPP_PHONE_ID = '111';
process.env.WHATSAPP_VERIFY_TOKEN = 'token-de-alta-largo-de-verdad';
process.env.WHATSAPP_TOKEN = 'dh_live_de_mentiras';
process.env.WHATSAPP_API_BASE = 'https://api.dualhook.com/v25.0';
delete process.env.WHATSAPP_APP_SECRET;      // en este modo no hay firma nuestra
process.env.DUENO_WHATSAPP = '';
process.env.CONFIRMAR_PRECIOS = '0';
process.env.CONFIRMAR_DISPONIBILIDAD = '0';

/* La misma función de siempre: Vercel reescribe `/api/whatsapp/<tramo>` a
   `/api/whatsapp?llave=<tramo>` (vercel.json). Aquí se simula la URL ya
   reescrita, que es la que la función ve. */
const puerta = (await import(pathToFileURL(path.join(RAIZ, 'api', 'whatsapp.mjs')).href)).default;
const reescribe = (tramo) => 'https://eurotravel-web.vercel.app/api/whatsapp?llave=' + encodeURIComponent(tramo);

let buenas = 0, malas = 0;
function ok(que, dio, esperaba) {
  const bien = JSON.stringify(dio) === JSON.stringify(esperaba);
  if (bien) { buenas++; console.log('ok   ' + que); }
  else { malas++; console.log('MAL  ' + que + '\n     dio      ' + JSON.stringify(dio) + '\n     esperaba ' + JSON.stringify(esperaba)); }
}

let mandados = [];
globalThis.fetch = async function (url, opciones) {
  const u = String(url);
  if (u.indexOf('api.dualhook.com') !== -1) {
    mandados.push({ url: u, auth: (opciones.headers || {}).Authorization, cuerpo: JSON.parse(opciones.body) });
    return { ok: true, status: 200, json: async () => ({ messages: [{ id: 'wamid.s' + mandados.length }] }), text: async () => '{}' };
  }
  if (u.indexOf('graph.facebook.com') !== -1) throw new Error('en modo Dualhook no se debe hablar con Meta directo');
  throw new Error('el bot llamó a algo que no debía: ' + u);
};

function aviso(extra) {
  const e = extra || {};
  return JSON.stringify({
    object: e.object || 'whatsapp_business_account',
    entry: [{ id: e.waba || process.env.WHATSAPP_WABA_ID, changes: [{ value: {
      metadata: { phone_number_id: e.phone || process.env.WHATSAPP_PHONE_ID },
      messages: [{ id: 'wamid.' + Math.random().toString(36).slice(2), from: e.de || '5213399990001', type: 'text', text: { body: e.texto || 'hola' } }]
    } }] }]
  });
}
const POST = (tramo, cuerpo) => puerta(new Request(reescribe(tramo), { method: 'POST', body: cuerpo, headers: { 'content-type': 'application/json' } }));
const GET = (tramo, qs) => puerta(new Request(reescribe(tramo) + '&' + qs));

/* 1 · Tramo equivocado: 404 a todo, sin pista. */
{
  const r1 = await GET('otro-tramo', 'hub.mode=subscribe&hub.verify_token=' + process.env.WHATSAPP_VERIFY_TOKEN + '&hub.challenge=123');
  ok('GET con tramo equivocado → 404', r1.status, 404);
  ok('  y NO devuelve el reto', await r1.text(), 'No encontrado');
  mandados = [];
  const r2 = await POST('otro-tramo', aviso());
  ok('POST con tramo equivocado → 404', r2.status, 404);
  ok('  y no se manda nada', mandados.length, 0);
}

/* 2 · Tramo bueno: el reto de Meta se contesta. */
{
  const r = await GET(TRAMO, 'hub.mode=subscribe&hub.verify_token=' + process.env.WHATSAPP_VERIFY_TOKEN + '&hub.challenge=4567');
  ok('GET con el tramo bueno contesta el reto', [r.status, await r.text()], [200, '4567']);
  const malo = await GET(TRAMO, 'hub.mode=subscribe&hub.verify_token=otro&hub.challenge=4567');
  ok('  pero con verify token equivocado no', malo.status === 200, false);
}

/* 3 · Tramo bueno + aviso de NUESTRA cuenta, sin firma: se atiende y se contesta por Dualhook. */
{
  mandados = [];
  const r = await POST(TRAMO, aviso({ texto: 'hola' }));
  ok('aviso nuestro sin firma → 200', r.status, 200);
  ok('  se contestó UN mensaje', mandados.length >= 1, true);
  ok('  por la API de Dualhook con la llave dh_live', [/api\.dualhook\.com\/v25\.0\/111\/messages$/.test(mandados[0].url), mandados[0].auth], [true, 'Bearer dh_live_de_mentiras']);
  ok('  al cliente, en formato 52 + 10', mandados[0].cuerpo.to, '523399990001');
}

/* 4 · Aviso de OTRA cuenta: 403 y nada se manda. */
{
  mandados = [];
  const r = await POST(TRAMO, aviso({ waba: '999', de: '5213399990002' }));
  ok('otro WABA → 403', r.status, 403);
  ok('  y no se contesta', mandados.length, 0);
  const r2 = await POST(TRAMO, aviso({ phone: '222', de: '5213399990003' }));
  ok('otro número de origen → 403', r2.status, 403);
  const r3 = await POST(TRAMO, aviso({ object: 'page', de: '5213399990004' }));
  ok('otro objeto → 403', r3.status, 403);
}

/* 5 · Cuerpo ilegible sin firma: no se acepta (400). */
{
  const r = await POST(TRAMO, '{esto no es json');
  ok('cuerpo ilegible → 400', r.status, 400);
}

/* 6 · Sin WABA configurado: cerrado a fallos, 503. */
{
  const waba = process.env.WHATSAPP_WABA_ID;
  delete process.env.WHATSAPP_WABA_ID;
  const r = await POST(TRAMO, aviso({ de: '5213399990005' }));
  ok('sin WHATSAPP_WABA_ID → 503', r.status, 503);
  process.env.WHATSAPP_WABA_ID = waba;
}

/* 7 · Tramo configurado demasiado corto: la puerta no abre ni con el bueno. */
{
  process.env.WHATSAPP_RUTA_SECRETA = 'corto';
  const r = await GET('corto', 'hub.mode=subscribe&hub.verify_token=' + process.env.WHATSAPP_VERIFY_TOKEN + '&hub.challenge=1');
  ok('tramo de menos de 32 caracteres no abre', r.status, 404);
  delete process.env.WHATSAPP_RUTA_SECRETA;
  const r2 = await GET(TRAMO, 'hub.mode=subscribe&hub.verify_token=' + process.env.WHATSAPP_VERIFY_TOKEN + '&hub.challenge=1');
  ok('sin tramo configurado, 404', r2.status, 404);
  process.env.WHATSAPP_RUTA_SECRETA = TRAMO;
}

/* 8 · La puerta de siempre sigue cerrada a fallos: sin `llave` y sin secreto
   de Meta, 503 (no se cuela nadie por la vieja aprovechando el modo nuevo). */
{
  const r = await puerta(new Request('https://eurotravel-web.vercel.app/api/whatsapp', { method: 'POST', body: aviso({ de: '5213399990006' }) }));
  ok('sin llave y sin WHATSAPP_APP_SECRET → 503 (puerta vieja cerrada)', r.status, 503);
}

/* 9 · El mapa de Vercel manda /api/whatsapp/<tramo> a esta misma función. */
{
  const fs = await import('fs');
  const cfg = JSON.parse(fs.readFileSync(path.join(RAIZ, 'vercel.json'), 'utf8'));
  const regla = (cfg.rewrites || []).find((r) => r.source === '/api/whatsapp/:llave');
  ok('vercel.json reescribe /api/whatsapp/:llave a la función de siempre', regla && regla.destination, '/api/whatsapp?llave=:llave');
}

console.log('\n' + buenas + ' buenas, ' + malas + ' malas');
process.exit(malas ? 1 : 0);
