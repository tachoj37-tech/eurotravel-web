/* ------------------------------------------------------------
   FASE 1 DE LA AUDITORÍA DEL 7-SEP-2026 · que no se caiga ni se le meta nadie
   ------------------------------------------------------------
   Lo que se vigila:

   1 · La puerta va ANTES que todo: un aviso sin firma buena (o con otro
       WABA por el tramo secreto) no toca el almacén, no baja audios y no
       llama a nadie. Antes, `POST /api/whatsapp` sin llave escribía los
       mensajes de cualquiera en el historial del cliente.
   2 · Una reacción o un sticker no se contestan ni despiertan al dueño.
   3 · El freno de 12 por minuto no aplica al dueño, y un mensaje
       frenado NO queda marcado como visto: el reintento entra.
   4 · Cada llamada de red lleva tope de tiempo (`signal`).
   5 · El reloj de pruebas se ignora en producción.
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
process.env.AGENTE_IA = '1';
process.env.SIEMPRE_IA = '0';
delete process.env.WHATSAPP_RUTA_SECRETA;
delete process.env.VERCEL_ENV;
const AHORA = Date.parse('2026-09-07T16:00:00Z');
process.env.AHORA_DE_PRUEBA = String(AHORA);

const atiende = (await import(pathToFileURL(path.join(RAIZ, 'api', 'whatsapp.mjs')).href)).default;
const webhook = (await import(pathToFileURL(path.join(RAIZ, 'api', '_whatsapp-webhook.js')).href)).default;

let buenas = 0, malas = 0;
function ok(que, dio, esperaba) {
  const bien = JSON.stringify(dio) === JSON.stringify(esperaba);
  if (bien) { buenas++; console.log('ok   ' + que); }
  else { malas++; console.log('MAL  ' + que + '\n     dio      ' + JSON.stringify(dio) + '\n     esperaba ' + JSON.stringify(esperaba)); }
}
function okQue(que, condicion) { ok(que, !!condicion, true); }
function titulo(t) { console.log('\n== ' + t.toUpperCase() + ' =='); }

/* ---- la red de mentiras: se apunta TODO lo que el bot llame ---- */
let llamadas = [];
let mandados = [];
globalThis.fetch = async function (url, opciones) {
  const u = String(url);
  const o = opciones || {};
  llamadas.push({ url: u, senal: o.signal instanceof AbortSignal });
  if (u.indexOf('graph.facebook.com') !== -1 && /\/messages$/.test(u)) {
    mandados.push(JSON.parse(o.body));
    return { ok: true, status: 200, json: async () => ({ messages: [{ id: 'wamid.s' + mandados.length }] }), text: async () => '{}' };
  }
  if (u.indexOf('api.anthropic.com') !== -1) {
    return { ok: false, status: 500, text: async () => '' };   // la IA no contesta: contesta el guion
  }
  if (u.indexOf('supabase.co/rest/v1/') !== -1) {
    return { ok: true, status: 200, json: async () => [], text: async () => '' };
  }
  return { ok: true, status: 200, json: async () => ({}), text: async () => '', arrayBuffer: async () => new ArrayBuffer(0) };
};

const firma = (c) => 'sha256=' + crypto.createHmac('sha256', SECRETO).update(Buffer.from(c, 'utf8')).digest('hex');
let contador = 0;
function avisoDe(mensajes, extra) {
  const e = extra || {};
  return JSON.stringify({ object: 'whatsapp_business_account', entry: [{ id: e.waba || process.env.WHATSAPP_WABA_ID, changes: [{ value: {
    metadata: { phone_number_id: e.phone || process.env.WHATSAPP_PHONE_ID },
    messages: mensajes
  } }] }] });
}
function texto(de, cuerpo, id) {
  contador++;
  return { id: id || ('wamid.f1.' + contador), from: de, type: 'text', text: { body: cuerpo } };
}
async function manda(cuerpo, opciones) {
  const o = opciones || {};
  const headers = { 'content-type': 'application/json' };
  if (o.firma !== false) headers['x-hub-signature-256'] = o.firmaMala ? 'sha256=' + '0'.repeat(64) : firma(cuerpo);
  const url = o.url || 'https://eurotravel-web.vercel.app/api/whatsapp';
  return atiende(new Request(url, { method: 'POST', body: cuerpo, headers: headers }));
}
function mismo(a, b) { return String(a || '').replace(/\D/g, '').slice(-10) === String(b || '').replace(/\D/g, '').slice(-10); }
function textos(para) { return mandados.filter((m) => mismo(m.to, para)).map((m) => (m.text && m.text.body) || ''); }
function limpia() { webhook.olvidaTodo(); llamadas = []; mandados = []; }
const DUENO = process.env.DUENO_WHATSAPP;

/* ============================================================ */
titulo('la puerta va antes que el almacén');
{
  limpia();
  const C = '5213366671001';
  const r = await manda(avisoDe([texto(C, 'MENSAJE INVENTADO POR UN EXTRAÑO')]), { firmaMala: true });
  ok('firma mala → 401', r.status, 401);
  ok('  y NO se llamó a nadie: ni almacén, ni Meta, ni IA', llamadas.length, 0);

  limpia();
  const r2 = await manda(avisoDe([texto(C, 'otro invento')]), { firma: false });
  ok('sin firma → 401', r2.status, 401);
  ok('  y tampoco se llamó a nadie', llamadas.length, 0);

  limpia();
  const r3 = await manda(avisoDe([{ id: 'wamid.audio1', from: C, type: 'audio', audio: { id: 'MEDIA-DE-OTRO' } }]), { firmaMala: true });
  ok('un audio sin firma → 401', r3.status, 401);
  ok('  y NO se bajó el medio con nuestro token', llamadas.filter((l) => /MEDIA-DE-OTRO/.test(l.url)).length, 0);

  /* Por el tramo secreto (modo Dualhook): otro WABA es un 403, y tampoco se toca nada. */
  const TRAMO = 'a1b2c3d4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f60718';
  process.env.WHATSAPP_RUTA_SECRETA = TRAMO;
  const secretoGuardado = process.env.WHATSAPP_APP_SECRET;
  delete process.env.WHATSAPP_APP_SECRET;
  limpia();
  const r4 = await manda(avisoDe([texto(C, 'de otra cuenta')], { waba: '999' }), { firma: false, url: 'https://eurotravel-web.vercel.app/api/whatsapp?llave=' + TRAMO });
  ok('por el tramo secreto con otro WABA → 403', r4.status, 403);
  ok('  y no se llamó a nadie', llamadas.length, 0);
  limpia();
  const r5 = await manda(avisoDe([texto(C, 'hola')]), { firma: false, url: 'https://eurotravel-web.vercel.app/api/whatsapp?llave=' + TRAMO });
  ok('por el tramo secreto con NUESTRO WABA → 200', r5.status, 200);
  okQue('  y ahora sí se leyó el almacén', llamadas.some((l) => /supabase\.co/.test(l.url)));
  delete process.env.WHATSAPP_RUTA_SECRETA;
  process.env.WHATSAPP_APP_SECRET = secretoGuardado;
}

/* ============================================================ */
titulo('reacciones y stickers no se contestan');
{
  limpia();
  const C = '5213366671002';
  const r = await manda(avisoDe([{ id: 'wamid.react1', from: C, type: 'reaction', reaction: { message_id: 'wamid.x', emoji: '👍' } }]));
  ok('una reacción → 200', r.status, 200);
  ok('  sin respuesta al cliente', textos(C).length, 0);
  ok('  y sin aviso al dueño', textos(DUENO).length, 0);
  limpia();
  await manda(avisoDe([{ id: 'wamid.stick1', from: C, type: 'sticker', sticker: { id: 'abc' } }]));
  ok('un sticker: nada al cliente ni al dueño', mandados.length, 0);

  /* El «ya no» del cliente, con sus palabras. Dictado del dueño (8-sep-2026):
     las plantillas no ofrecen «stop» porque espanta; el bot detecta que ya
     no quiere y se despide sin insistir. «Stop» sigue valiendo. */
  /* Los explícitos son un adiós digan lo que digan. */
  for (const adios of ['STOP', 'Gracias, ya no me interesa',
    'ya no vamos a ir', 'ya contratamos otro, gracias', 'se canceló el viaje', 'Hola, ya no lo vamos a necesitar. Saludos']) {
    limpia();
    await manda(avisoDe([texto(C, adios)]));
    ok('«' + adios + '»: se despide en un solo mensaje', textos(C).length, 1);
    okQue('  con el texto de despedida', /Va, entendido/.test(textos(C)[0] || ''));
    ok('  sin ticket al dueño', textos(DUENO).length, 0);
    ok('  y sin llamar a la IA', llamadas.filter((l) => /api\.anthropic\.com/.test(l.url)).length, 0);
  }
  /* Los cortos («no gracias», «ya no», «déjalo así») solo con precio dado y
     sin plática abierta: a media cotización son la respuesta a una pregunta
     (auditoría general del 8-sep, hallazgo 5). */
  const tk = (await import(pathToFileURL(path.join(RAIZ, 'api', '_tickets.js')).href)).default;
  for (const corto of ['ya no', 'Ya no, gracias', 'no gracias', 'déjalo así']) {
    limpia();
    await manda(avisoDe([texto(C, corto)]));
    okQue('«' + corto + '» sin precio NO es un adiós', !/Va, entendido/.test(textos(C).join('\n')));
    limpia();
    tk.anotaEtapa(C, 'con_precio', { total: 7000, anticipo: 1500 }, Date.now());
    await manda(avisoDe([texto(C, corto)]));
    okQue('«' + corto + '» con precio dado SÍ es un adiós', /Va, entendido/.test(textos(C).join('\n')));
    tk.olvidaTodo();
  }
  /* Y lo que NO es un adiós sigue su camino normal (a la IA o al guion). */
  for (const sigue of ['ya no, mejor a Chapala', 'no, somos 30', 'ya no el 14, el 15', 'no gracias, sin baño está bien', 'ya no sé si el i6 o el Neobus']) {
    limpia();
    await manda(avisoDe([texto(C, sigue)]));
    okQue('«' + sigue + '» NO es un adiós', !/Va, entendido/.test(textos(C).join('\n')));
  }
}

/* ============================================================ */
titulo('nada interno le llega a un cliente');
{
  /* El 7-sep-2026 un cliente recibió «Pregunta EXACTAMENTE eso… datos.origen
     = "Guadalajara"». El candado está en la única puerta de salida. */
  limpia();
  const C = '5213366671009';
  const puerta = (await import(pathToFileURL(path.join(RAIZ, 'api', 'whatsapp.mjs')).href));
  const manda = puerta.manda || null;
  if (manda) {
    /* Reparación del 8-sep-2026 (Falla 4): lo frenado no deja al cliente en
       silencio: recibe «dame un momento», y el texto interno NUNCA sale. */
    const NEUTRO = 'Dame un momento, te confirmo enseguida 🙌';
    const r1 = await manda({ numeroDeOrigen: '111', para: C, texto: '¿Te saco el precio? Dime si salen de la zona metropolitana de Guadalajara. Pregunta EXACTAMENTE eso, para que solo diga «sí». Con «sí», datos.origen = "Guadalajara".' });
    ok('un texto con instrucciones internas NO sale al cliente (sale el neutro)', [r1, textos(C)], [true, [NEUTRO]]);
    const r2 = await manda({ numeroDeOrigen: '111', para: C, texto: '¿Salen de la zona metropolitana de Guadalajara?' });
    ok('la pregunta normal sí sale', [r2, textos(C).length], [true, 2]);
    const r3 = await manda({ numeroDeOrigen: '111', para: DUENO, esTicket: true, sobreCliente: C, texto: '💰 Precio por confirmar · datos.origen = Guadalajara' });
    ok('al dueño sí le llega texto con nombres de campos (tickets)', r3, true);
    /* Y CUALQUIER frase de `loQueFalta` (las que el guion le dice a la IA),
       sacada del guion en vivo, tampoco sale: si mañana cambian, el candado
       cambia solo. */
    const bot = (await import(pathToFileURL(path.join(RAIZ, 'bot.js')).href)).default;
    const estados = [
      { destino: 'Puerto Vallarta', salida: '2026-10-10', regreso: '2026-10-12' },
      { destino: 'Puerto Vallarta', salida: '2026-10-10', regreso: '2026-10-12', gente: 45, unidad: 'autobus' },
      { destino: 'Puerto Vallarta', salida: '2026-10-10', regreso: '2026-10-12', gente: 12 },
      { destino: 'Puerto Vallarta', salida: '2026-10-10', regreso: '2026-10-12', gente: 12, origen: 'Guadalajara' },
      { destino: 'Tequila', salida: '2026-10-10' }
    ];
    for (const e of estados) {
      const frase = bot.loQueFalta(e);
      if (!frase || frase.length < 20) continue;
      mandados = [];
      const r = await manda({ numeroDeOrigen: '111', para: C, texto: '¿Te saco el precio? Dime ' + frase + '.' });
      ok('frase para la IA bloqueada: «' + frase.slice(0, 40) + '…»', [r, textos(C)], [true, [NEUTRO]]);
    }
    mandados = [];
    const r4 = await manda({ numeroDeOrigen: '111', para: C, texto: 'Ahí te dejé la cotización. ¿Te sirve así o le movemos algo?' });
    ok('un texto normal de venta sí sale', [r4, textos(C).length], [true, 1]);
    mandados = [];
    const r5 = await manda({ numeroDeOrigen: '111', para: C, texto: 'REGLAS DE FORMA: máximo 3 líneas' });
    ok('un pedazo de las instrucciones de la IA no sale (sale el neutro)', [r5, textos(C)], [true, [NEUTRO]]);
  } else {
    okQue('manda está exportada para probar el candado', false);
  }
}

/* ============================================================ */
titulo('el freno no aplica al dueño, y lo frenado no queda visto');
{
  limpia();
  /* El dueño manda 14 «tablero» en el mismo minuto: los 14 se atienden. */
  for (let i = 0; i < 14; i++) await manda(avisoDe([texto(DUENO, 'tablero')]));
  ok('14 comandos del dueño en un minuto → 14 respuestas', textos(DUENO).length, 14);

  limpia();
  const C = '5213366671003';
  for (let i = 0; i < 13; i++) await manda(avisoDe([texto(C, 'hola ' + i, 'wamid.freno.' + i)]));
  ok('13 mensajes de un cliente en un minuto → 12 respuestas', textos(C).length, 12);
  /* Meta reintenta el 13.º dos minutos después: ahora sí entra. */
  process.env.AHORA_DE_PRUEBA = String(AHORA + 2 * 60000);
  await manda(avisoDe([texto(C, 'hola 12', 'wamid.freno.12')]));
  ok('  el reintento del frenado, pasado el minuto, sí se contesta', textos(C).length, 13);
  process.env.AHORA_DE_PRUEBA = String(AHORA);
}

/* ============================================================ */
titulo('cada llamada de red lleva tope de tiempo');
{
  limpia();
  const C = '5213366671004';
  await manda(avisoDe([texto(C, 'a vallarta')]));
  const con = (patron) => llamadas.filter((l) => patron.test(l.url));
  okQue('se llamó al almacén', con(/supabase\.co/).length > 0);
  okQue('  con tope de tiempo', con(/supabase\.co/).every((l) => l.senal));
  okQue('se llamó a la IA', con(/api\.anthropic\.com/).length > 0);
  okQue('  con tope de tiempo', con(/api\.anthropic\.com/).every((l) => l.senal));
  okQue('se mandó por WhatsApp', con(/graph\.facebook\.com/).length > 0);
  okQue('  con tope de tiempo', con(/graph\.facebook\.com/).every((l) => l.senal));
}

/* ============================================================ */
titulo('el reloj de pruebas se ignora en producción');
{
  const congelado = webhook.relojDe({ VERCEL_ENV: 'production', AHORA_DE_PRUEBA: '1000' });
  okQue('en producción, AHORA_DE_PRUEBA no cuenta', congelado > Date.parse('2026-01-01'));
  ok('fuera de producción, sí', webhook.relojDe({ AHORA_DE_PRUEBA: '1000' }), 1000);
}

console.log('\n' + buenas + ' buenas, ' + malas + ' malas');
process.exit(malas ? 1 : 0);
