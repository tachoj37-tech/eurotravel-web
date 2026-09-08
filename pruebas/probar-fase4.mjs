/* ------------------------------------------------------------
   FASE 4 DE LA AUDITORÍA DEL 7-SEP-2026 · que la memoria y el cron sean confiables
   ------------------------------------------------------------
   Lo que se vigila:

   1 · La memoria vieja de una instancia no pisa lo nuevo de la base:
       gana la ficha más reciente.
   2 · Un fallo de LECTURA del almacén no borra la charla del cliente.
   3 · La purga de 45 días corre desde el cron, a las 4 de la mañana.
   4 · La marca de «columna que falta» va por tabla: que a `fichas` le
       falte una columna no deja a `tickets` sin su carga.
   5 · Un aviso sin `changes` no pasa como nuestro.
   (La marca condicional del toque y el «sin plantilla no se marca»
   viven en probar-seguimiento-puerta.mjs.)
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
process.env.WHATSAPP_WABA_ID = '2142416706689411';
process.env.DUENO_WHATSAPP = '5213311112222';
process.env.HOY_DE_PRUEBA = '2026-09-07';
process.env.ANTHROPIC_API_KEY = 'clave-de-mentiras';
process.env.SITIO_URL = 'https://eurotravel-web.vercel.app';
process.env.ALMACEN_URL = 'https://abcdefghijklmnopqrst.supabase.co';
process.env.ALMACEN_CLAVE = 'sb_secret_de_mentiras';
process.env.CRON_SECRET = 'secreto-del-cron-de-prueba-largo';
process.env.AGENTE_IA = '1';
process.env.SIEMPRE_IA = '0';
delete process.env.VERCEL_ENV;
process.env.AHORA_DE_PRUEBA = String(Date.parse('2026-09-07T16:00:00Z'));

const atiende = (await import(pathToFileURL(path.join(RAIZ, 'api', 'whatsapp.mjs')).href)).default;
const webhook = (await import(pathToFileURL(path.join(RAIZ, 'api', '_whatsapp-webhook.js')).href)).default;
const almacen = (await import(pathToFileURL(path.join(RAIZ, 'api', '_almacen.js')).href)).default;
const tickets = (await import(pathToFileURL(path.join(RAIZ, 'api', '_tickets.js')).href)).default;

let buenas = 0, malas = 0;
function ok(que, dio, esperaba) {
  const bien = JSON.stringify(dio) === JSON.stringify(esperaba);
  if (bien) { buenas++; console.log('ok   ' + que); }
  else { malas++; console.log('MAL  ' + que + '\n     dio      ' + JSON.stringify(dio) + '\n     esperaba ' + JSON.stringify(esperaba)); }
}
function okQue(que, condicion) { ok(que, !!condicion, true); }
function titulo(t) { console.log('\n== ' + t.toUpperCase() + ' =='); }

let llamadas = [];
let charlasCaidas = false;      // la lectura de charlas falla (500)
let fichasSinColumna = false;   // fichas no tiene precio_en
globalThis.fetch = async function (url, opciones) {
  const u = String(url);
  const o = opciones || {};
  llamadas.push({ url: u, metodo: o.method || 'GET', cuerpo: o.body ? JSON.parse(o.body) : null });
  if (u.indexOf('graph.facebook.com') !== -1) {
    return { ok: true, status: 200, json: async () => ({ messages: [{ id: 'wamid.s' + llamadas.length }] }), text: async () => '{}' };
  }
  if (u.indexOf('api.anthropic.com') !== -1) return { ok: false, status: 500, text: async () => '' };
  if (u.indexOf('supabase.co/rest/v1/charlas?numero=eq.') !== -1 && (o.method || 'GET') === 'GET') {
    if (charlasCaidas) return { ok: false, status: 500, text: async () => 'caída' };
    return { ok: true, status: 200, json: async () => [], text: async () => '' };
  }
  if (u.indexOf('supabase.co/rest/v1/fichas?on_conflict=numero') !== -1 && fichasSinColumna && o.body && /"precio_en"/.test(o.body)) {
    return { ok: false, status: 400, text: async () => JSON.stringify({ code: 'PGRST204', message: "Could not find the 'precio_en' column of 'fichas' in the schema cache" }) };
  }
  if (u.indexOf('supabase.co/rest/v1/') !== -1) {
    return { ok: true, status: 200, json: async () => [], text: async () => '' };
  }
  throw new Error('el bot llamó a algo que no debía: ' + u);
};

const firma = (c) => 'sha256=' + crypto.createHmac('sha256', SECRETO).update(Buffer.from(c, 'utf8')).digest('hex');
let contador = 0;
async function dice(texto, de) {
  const cuerpo = JSON.stringify({ entry: [{ changes: [{ value: { metadata: { phone_number_id: '111' },
    messages: [{ id: 'wamid.f4.' + (++contador), from: de, type: 'text', text: { body: texto } }] } }] }] });
  await atiende(new Request('https://x/api/whatsapp', { method: 'POST', body: cuerpo, headers: { 'x-hub-signature-256': firma(cuerpo) } }));
}
const cron = () => atiende(new Request('https://eurotravel-web.vercel.app/api/whatsapp?llave=seguimiento', { headers: { authorization: 'Bearer ' + process.env.CRON_SECRET } }));
function limpia() { webhook.olvidaTodo(); tickets.olvidaTodo(); llamadas = []; charlasCaidas = false; fichasSinColumna = false; }

/* ============================================================ */
titulo('la ficha más reciente gana');
{
  tickets.olvidaTodo();
  const C = '5213366674001';
  tickets.anotaEtapa(C, 'pidio_precio', {}, 1000);           // memoria vieja: visto 1000
  tickets.siembraFicha({ cliente: C, etapa: 'con_precio', total: 9000, visto: 5000, toques: 0 });
  ok('la base más nueva (visto 5000) pisa la memoria vieja', [tickets.fichaDe(C).etapa, tickets.fichaDe(C).total], ['con_precio', 9000]);
  tickets.anotaEtapa(C, 'va_a_apartar', {}, 9000);            // memoria nueva: visto 9000
  tickets.siembraFicha({ cliente: C, etapa: 'pidio_precio', total: null, visto: 5000, toques: 2 });
  ok('la base más vieja NO pisa la memoria nueva', tickets.fichaDe(C).etapa, 'va_a_apartar');
  ok('  pero sus toques (los pone el cron) sí entran', tickets.fichaDe(C).toques, 2);
}

/* ============================================================ */
titulo('un fallo de lectura no borra la charla');
{
  limpia();
  const C = '5213366674002';
  charlasCaidas = true;
  await dice('👍', C);   // el guion no deja estado con esto; sin lectura, no hay nada en memoria
  const borrados = llamadas.filter((l) => l.metodo === 'DELETE' && /charlas\?numero=eq\.3366674002/.test(l.url));
  ok('con la lectura caída y sin estado en memoria, NO se manda DELETE de la charla', borrados.length, 0);

  limpia();
  await dice('👍', C);   // lectura buena que dice «no hay charla»: ahí sí se puede guardar/borrar
  okQue('  con la lectura buena, el flujo normal sigue (se guarda o se borra)', llamadas.some((l) => /charlas/.test(l.url) && l.metodo !== 'GET'));
}

/* ============================================================ */
titulo('la purga corre a las 4 de la mañana desde el cron');
{
  limpia();
  process.env.AHORA_DE_PRUEBA = String(Date.parse('2026-09-08T10:05:00Z'));   // 4:05 a.m. en Guadalajara
  await cron();
  await new Promise((r) => setTimeout(r, 20));
  const borrados = llamadas.filter((l) => l.metodo === 'DELETE').map((l) => l.url.replace(/.*rest\/v1\//, '').replace(/=lt\..*/, ''));
  /* Desde el 8-sep-2026 también se purgan los avisos vistos (tabla `vistos`,
     contra el reintento de Meta). */
  ok('a las 4 a.m. se tiran mensajes, charlas, tickets y avisos vistos viejos', borrados, ['mensajes?cuando', 'charlas?cuando', 'tickets?creado', 'vistos?cuando']);
  llamadas = [];
  await cron();
  await new Promise((r) => setTimeout(r, 20));
  ok('  y no se repite en la misma instancia el mismo día', llamadas.filter((l) => l.metodo === 'DELETE').length, 0);
  llamadas = [];
  process.env.AHORA_DE_PRUEBA = String(Date.parse('2026-09-08T16:00:00Z'));   // 10 a.m.
  await cron();
  await new Promise((r) => setTimeout(r, 20));
  ok('  a otra hora no corre', llamadas.filter((l) => l.metodo === 'DELETE').length, 0);
  process.env.AHORA_DE_PRUEBA = String(Date.parse('2026-09-07T16:00:00Z'));
}

/* ============================================================ */
titulo('la marca de «columna que falta» va por tabla');
{
  limpia();
  fichasSinColumna = true;
  const C = '5213366674003';
  await almacen.guardaFicha({ cliente: C, etapa: 'con_precio', precioEn: Date.now() - 3600000, toques: 0, visto: Date.now() });
  okQue('fichas sin precio_en: se guardó sin ella', llamadas.filter((l) => /fichas\?on_conflict/.test(l.url)).length === 2);
  llamadas = [];
  await almacen.guardaTicket('wamid.t1', C, { resumen: { destino: 'Chapala' } });
  const ticket = llamadas.find((l) => /tickets\?on_conflict/.test(l.url));
  okQue('tickets sigue mandando su carga (la marca de fichas no lo contagia)', ticket && ticket.cuerpo && ticket.cuerpo.carga);
}

/* ============================================================ */
titulo('un aviso sin cambios no es nuestro');
{
  const env = { WHATSAPP_WABA_ID: '2142416706689411', WHATSAPP_PHONE_ID: '111' };
  ok('entry sin changes → no', webhook.avisoEsNuestro({ object: 'whatsapp_business_account', entry: [{ id: '2142416706689411' }] }, env), false);
  ok('entry con nuestro número → sí', webhook.avisoEsNuestro({ object: 'whatsapp_business_account', entry: [{ id: '2142416706689411', changes: [{ value: { metadata: { phone_number_id: '111' } } }] }] }, env), true);
  ok('otro número → no', webhook.avisoEsNuestro({ object: 'whatsapp_business_account', entry: [{ id: '2142416706689411', changes: [{ value: { metadata: { phone_number_id: '999' } } }] }] }, env), false);
}

console.log('\n' + buenas + ' buenas, ' + malas + ' malas');
process.exit(malas ? 1 : 0);
