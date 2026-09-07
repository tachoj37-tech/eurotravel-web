/* ------------------------------------------------------------
   EL SEGUIMIENTO · la puerta del cron y el envío, de punta a punta
   ------------------------------------------------------------
   Con la base y WhatsApp de mentiras. Lo que se vigila:

   1 · Que la puerta /api/whatsapp/seguimiento no abra sin
       CRON_SECRET (503), ni con una llave que no es (404), ni por
       POST (405).
   2 · Que a quien le toca se le MARQUE antes de mandar, y se le
       mande por la API de WhatsApp. Con toques a 24 h / 3 d / 7 d la
       ventana de Meta ya cerró siempre: van por plantilla.
   3 · Que sin plantilla no salga nada (y se diga), y con plantilla
       salga como `template`, sin texto libre.
   4 · Que al que contestó se le cierre (toques = 3) sin mandarle nada.
   5 · Que si la base no tiene las columnas nuevas, la ficha se
       guarde igual sin ellas (y no se pierda).
   ------------------------------------------------------------ */

import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.join(AQUI, '..');

const TRAMO = 'a1b2c3d4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f60718';
process.env.WHATSAPP_RUTA_SECRETA = TRAMO;
process.env.WHATSAPP_WABA_ID = '2142416706689411';
process.env.WHATSAPP_PHONE_ID = '111';
process.env.WHATSAPP_VERIFY_TOKEN = 'token-de-alta-largo-de-verdad';
process.env.WHATSAPP_TOKEN = 'dh_live_de_mentiras';
process.env.WHATSAPP_API_BASE = 'https://api.dualhook.com/v25.0';
delete process.env.WHATSAPP_APP_SECRET;
process.env.DUENO_WHATSAPP = '';
process.env.ALMACEN_URL = 'https://abcdefghijklmnopqrst.supabase.co';
process.env.ALMACEN_CLAVE = 'sb_secret_de_mentiras';
delete process.env.WHATSAPP_PLANTILLA_TOQUE1;
delete process.env.WHATSAPP_PLANTILLA_TOQUE2;
delete process.env.WHATSAPP_PLANTILLA_TOQUE3;

const H = 60 * 60 * 1000;
const D = 24 * H;
/* Lunes 10:00 de Guadalajara. */
const AHORA = Date.parse('2026-09-07T16:00:00Z');
process.env.AHORA_DE_PRUEBA = String(AHORA);

const puerta = (await import(pathToFileURL(path.join(RAIZ, 'api', 'whatsapp.mjs')).href)).default;
const URL_CRON = 'https://eurotravel-web.vercel.app/api/whatsapp?llave=seguimiento';

let buenas = 0, malas = 0;
function ok(que, dio, esperaba) {
  const bien = JSON.stringify(dio) === JSON.stringify(esperaba);
  if (bien) { buenas++; console.log('ok   ' + que); }
  else { malas++; console.log('MAL  ' + que + '\n     dio      ' + JSON.stringify(dio) + '\n     esperaba ' + JSON.stringify(esperaba)); }
}

/* ---- la base y WhatsApp de mentiras ---- */
let mandados = [];
let upserts = [];
let enBase = [];
let sinColumnas = false;   // simula una base sin el bloque del 6-sep-2026
const iso = (ms) => new Date(ms).toISOString();

globalThis.fetch = async function (url, opciones) {
  const u = String(url);
  const o = opciones || {};
  if (u.indexOf('api.dualhook.com') !== -1) {
    mandados.push({ url: u, cuerpo: JSON.parse(o.body) });
    return { ok: true, status: 200, json: async () => ({ messages: [{ id: 'wamid.s' + mandados.length }] }), text: async () => '{}' };
  }
  if (u.indexOf('supabase.co/rest/v1/fichas?on_conflict=numero') !== -1) {
    const fila = JSON.parse(o.body);
    /* Como PostgREST: nombra la PRIMERA columna que no existe; el bot la
       quita y vuelve a intentar, hasta que pasen todas. */
    const faltante = ['precio_en', 'toques', 'cliente_en', 'viajes'].find((c) => sinColumnas && c in fila);
    if (faltante) {
      return { ok: false, status: 400, text: async () => JSON.stringify({ code: 'PGRST204', message: "Could not find the '" + faltante + "' column of 'fichas' in the schema cache" }) };
    }
    upserts.push(fila);
    return { ok: true, status: 201, text: async () => '', json: async () => null };
  }
  if (u.indexOf('supabase.co/rest/v1/fichas?select=*&etapa=eq.con_precio') !== -1) {
    return { ok: true, status: 200, json: async () => enBase, text: async () => '[]' };
  }
  if (u.indexOf('supabase.co/rest/v1/') !== -1) {
    return { ok: true, status: 200, json: async () => [], text: async () => '' };
  }
  throw new Error('el bot llamó a algo que no debía: ' + u);
};

const GET = (auth) => puerta(new Request(URL_CRON, { headers: auth ? { authorization: auth } : {} }));
const POST = (auth) => puerta(new Request(URL_CRON, { method: 'POST', headers: { authorization: auth } }));
const LLAVE = 'Bearer secreto-del-cron-de-prueba-largo';

/* ============================================================ */
console.log('\n== LA PUERTA ==');
{
  delete process.env.CRON_SECRET;
  const r = await GET('Bearer lo-que-sea');
  ok('sin CRON_SECRET → 503', r.status, 503);

  process.env.CRON_SECRET = 'corto';
  ok('CRON_SECRET de menos de 16 → 503', (await GET('Bearer corto')).status, 503);

  process.env.CRON_SECRET = 'secreto-del-cron-de-prueba-largo';
  const r2 = await GET('Bearer otro-secreto-que-no-es-el-bueno');
  ok('llave equivocada → 404', r2.status, 404);
  ok('  y dice lo mismo que un tramo equivocado', await r2.text(), 'No encontrado');
  ok('sin cabecera → 404', (await GET(null)).status, 404);
  ok('POST con la llave buena → 405', (await POST(LLAVE)).status, 405);
  ok('nada de esto mandó mensajes', mandados.length, 0);
}

/* ============================================================ */
console.log('\n== A QUIÉN SE LE ESCRIBE (con plantilla del primer toque) ==');
{
  process.env.WHATSAPP_PLANTILLA_TOQUE1 = 'seguimiento_24h';
  enBase = [
    /* A · le toca el primero: precio hace 25 h, él escribió hace 26. */
    { numero: '3311111111', cliente: '5213311111111', etapa: 'con_precio', precio_en: iso(AHORA - 25 * H), cliente_en: iso(AHORA - 26 * H), toques: 0, viaje_datos: { salida: '2026-10-10' } },
    /* B · le toca el segundo (3 días) pero no hay plantilla para él. */
    { numero: '3322222222', cliente: '5213322222222', etapa: 'con_precio', precio_en: iso(AHORA - 3 * D - H), cliente_en: iso(AHORA - 3 * D - 2 * H), toques: 1 },
    /* C · todavía no: precio hace 2 h. */
    { numero: '3333333333', cliente: '5213333333333', etapa: 'con_precio', precio_en: iso(AHORA - 2 * H), cliente_en: iso(AHORA - 3 * H), toques: 0 },
    /* D · ya contestó después del precio. */
    { numero: '3344444444', cliente: '5213344444444', etapa: 'con_precio', precio_en: iso(AHORA - 25 * H), cliente_en: iso(AHORA - 1 * H), toques: 0 }
  ];
  mandados = []; upserts = [];
  const r = await GET(LLAVE);
  ok('la llave buena → 200', r.status, 200);
  const cuenta = await r.json();
  ok('revisó las cuatro', cuenta.revisadas, 4);
  ok('mandó UNO (A)', cuenta.mandados, 1);
  ok('uno espera (C)', cuenta.esperan, 1);
  ok('uno cerrado (D, contestó)', cuenta.cerradas, 1);
  ok('uno sin plantilla (B)', cuenta.sinPlantilla, 1);

  ok('a A se le escribió por WhatsApp', mandados.length, 1);
  ok('  al número de A, en formato 52 + 10', mandados[0].cuerpo.to, '523311111111');
  ok('  como plantilla (la ventana de 24 h ya cerró)', mandados[0].cuerpo.type, 'template');
  ok('  la del primer toque', mandados[0].cuerpo.template.name, 'seguimiento_24h');
  ok('  en español de México', mandados[0].cuerpo.template.language.code, 'es_MX');
  ok('  y sin texto libre', mandados[0].cuerpo.text, undefined);

  const deA = upserts.filter((u) => u.numero === '3311111111');
  ok('A quedó marcada con toques = 1 (antes de mandar)', deA.length === 1 && deA[0].toques, 1);
  ok('  y conserva precio_en', deA[0].precio_en, iso(AHORA - 25 * H));
  const deB = upserts.filter((u) => u.numero === '3322222222');
  ok('B quedó marcada con toques = 2 aunque no salió (no se reintenta cada 15 min)', deB.length === 1 && deB[0].toques, 2);
  const deD = upserts.filter((u) => u.numero === '3344444444');
  ok('D quedó cerrada con toques = 3', deD.length === 1 && deD[0].toques, 3);
  ok('C no se tocó', upserts.filter((u) => u.numero === '3333333333').length, 0);
  ok('a B, C y D no se les escribió', mandados.filter((m) => m.cuerpo.to !== '523311111111').length, 0);
  delete process.env.WHATSAPP_PLANTILLA_TOQUE1;
}

/* ============================================================ */
console.log('\n== SIN PLANTILLA NO SALE NADA ==');
{
  enBase = [
    { numero: '3311111111', cliente: '5213311111111', etapa: 'con_precio', precio_en: iso(AHORA - 25 * H), cliente_en: iso(AHORA - 26 * H), toques: 0 }
  ];
  mandados = []; upserts = [];
  const cuenta = await (await GET(LLAVE)).json();
  ok('sin WHATSAPP_PLANTILLA_TOQUE1 no se manda', [cuenta.mandados, mandados.length], [0, 0]);
  ok('  y se cuenta como sin plantilla', cuenta.sinPlantilla, 1);
}

/* ============================================================ */
console.log('\n== EL SEGUNDO Y EL TERCERO, CON PLANTILLA ==');
{
  process.env.WHATSAPP_PLANTILLA_TOQUE2 = 'seguimiento_3d';
  process.env.WHATSAPP_PLANTILLA_TOQUE3 = 'seguimiento_7d';
  enBase = [
    { numero: '3322222222', cliente: '5213322222222', etapa: 'con_precio', precio_en: iso(AHORA - 3 * D - H), cliente_en: iso(AHORA - 3 * D - 2 * H), toques: 1 },
    { numero: '3366666666', cliente: '5213366666666', etapa: 'con_precio', precio_en: iso(AHORA - 7 * D - H), cliente_en: iso(AHORA - 7 * D - 2 * H), toques: 2 }
  ];
  mandados = []; upserts = [];
  const cuenta = await (await GET(LLAVE)).json();
  ok('salieron los dos', cuenta.mandados, 2);
  ok('el de 3 días con su plantilla', mandados.find((m) => m.cuerpo.to === '523322222222').cuerpo.template.name, 'seguimiento_3d');
  ok('el de 7 días con la suya', mandados.find((m) => m.cuerpo.to === '523366666666').cuerpo.template.name, 'seguimiento_7d');
  ok('y quedaron en 2 y 3', [upserts.find((u) => u.numero === '3322222222').toques, upserts.find((u) => u.numero === '3366666666').toques], [2, 3]);
  delete process.env.WHATSAPP_PLANTILLA_TOQUE2;
  delete process.env.WHATSAPP_PLANTILLA_TOQUE3;
}

/* ============================================================ */
console.log('\n== DE NOCHE NO ==');
{
  process.env.WHATSAPP_PLANTILLA_TOQUE1 = 'seguimiento_24h';
  process.env.AHORA_DE_PRUEBA = String(Date.parse('2026-09-08T04:00:00Z')); // 10 p.m.
  const NOCHE = Number(process.env.AHORA_DE_PRUEBA);
  enBase = [
    { numero: '3311111111', cliente: '5213311111111', etapa: 'con_precio', precio_en: iso(NOCHE - 25 * H), cliente_en: iso(NOCHE - 26 * H), toques: 0 }
  ];
  mandados = []; upserts = [];
  const cuenta = await (await GET(LLAVE)).json();
  ok('a las 10 p.m. nadie recibe nada', [cuenta.mandados, mandados.length, upserts.length], [0, 0, 0]);
  ok('  y queda esperando', cuenta.esperan, 1);
  process.env.AHORA_DE_PRUEBA = String(AHORA);
  delete process.env.WHATSAPP_PLANTILLA_TOQUE1;
}

/* ============================================================ */
console.log('\n== SIN ALMACÉN ==');
{
  const url = process.env.ALMACEN_URL;
  delete process.env.ALMACEN_URL;
  mandados = [];
  const cuenta = await (await GET(LLAVE)).json();
  ok('sin almacén no revisa nada ni truena', [cuenta.revisadas, mandados.length], [0, 0]);
  process.env.ALMACEN_URL = url;
}

/* ============================================================ */
console.log('\n== LA BASE SIN LAS COLUMNAS NUEVAS (va al final: deja marca en la instancia) ==');
{
  const almacen = (await import(pathToFileURL(path.join(RAIZ, 'api', '_almacen.js')).href)).default;
  sinColumnas = true;
  upserts = [];
  const bien = await almacen.guardaFicha({ cliente: '5213355555555', etapa: 'con_precio', precioEn: AHORA - 5 * H, clienteEn: AHORA - 6 * H, toques: 0, visto: AHORA });
  ok('la ficha se guardó de todos modos', bien, true);
  ok('  en un segundo intento, sin las columnas nuevas', upserts.length === 1 && !('precio_en' in upserts[0]) && !('cliente_en' in upserts[0]) && !('toques' in upserts[0]), true);
  ok('  y con lo demás intacto', [upserts[0].numero, upserts[0].etapa], ['3355555555', 'con_precio']);
}

console.log('\n' + buenas + ' buenas, ' + malas + ' malas');
process.exit(malas ? 1 : 0);
