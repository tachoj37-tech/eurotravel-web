/* ============================================================
   EL PÁRRAFO CON TODO ADENTRO
   ------------------------------------------------------------
   Lo que de verdad manda un cliente después de depositar:

     «Va a nombre de María Fernanda Ortiz Lugo, mi cel es el
      3312345678, nos recogen en Av. Vallarta 1234 col. Americana
      a las 6 de la mañana y vamos al Hotel Riu de Vallarta,
      regresamos el domingo como a las 4»

   Cinco datos, en desorden, con dos horas escritas como se
   hablan. Por eso el dueño dictó que aquí la IA entra SIEMPRE y
   no como respaldo: «no hay guion que lo lea».

   Este archivo pone un `fetch` de mentiras y comprueba lo que
   sale de verdad por Meta. Sin red, sin claves buenas y sin un
   peso gastado.

   Lo que se vigila, en orden de qué tan caro sale si falla:

   1 · Que la IA se llame SIEMPRE en esta etapa, aunque el guion
       tuviera algo que decir.
   2 · Que si la IA falla, el cliente NO se quede en silencio.
       Acaba de mandar dinero: el silencio ahí es la peor
       respuesta posible.
   3 · Que al dueño le llegue la ficha UNA vez, no en cada
       mensaje.
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
process.env.ANTHROPIC_API_KEY = 'clave-de-mentiras';

const atiende = (await import(pathToFileURL(path.join(RAIZ, 'api', 'whatsapp.mjs')).href)).default;
const webhook = (await import(pathToFileURL(path.join(RAIZ, 'api', '_whatsapp-webhook.js')).href)).default;
const tk = (await import(pathToFileURL(path.join(RAIZ, 'api', '_tickets.js')).href)).default;

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
let llamadasALaIA = 0;
let instruccionesQueLlegaron = '';
let laIADice = null;

globalThis.fetch = async function (url, opciones) {
  const u = String(url);
  const cuerpo = opciones && opciones.body ? JSON.parse(opciones.body) : {};

  if (u.indexOf('graph.facebook.com') !== -1) {
    mandados.push(cuerpo);
    return {
      ok: true, status: 200,
      json: async function () { return { messages: [{ id: 'wa' + mandados.length }] }; },
      text: async function () { return '{}'; }
    };
  }
  if (u.indexOf('api.anthropic.com') !== -1) {
    llamadasALaIA++;
    /* CAMBIÓ EL 5-SEP-2026: `system` ya no es un texto sino una lista de
       bloques —el primero con `cache_control`, para el caché del prompt—.
       Lo que esta prueba vigila no cambió: que a esta etapa lleguen las
       instrucciones de CONTRATO y no las de viajes. Se juntan los textos
       de los bloques para poder buscar en ellos como antes. */
    instruccionesQueLlegaron = Array.isArray(cuerpo.system)
      ? cuerpo.system.map(function (b) { return b.text || ''; }).join('\n')
      : (cuerpo.system || '');
    if (!laIADice) return { ok: false, status: 500, text: async function () { return ''; } };
    return {
      ok: true, status: 200,
      json: async function () { return { content: [{ text: JSON.stringify(laIADice) }] }; }
    };
  }
  throw new Error('llamó a algo que no debía: ' + u);
};

const firma = function (c) {
  return 'sha256=' + crypto.createHmac('sha256', SECRETO)
    .update(Buffer.from(c, 'utf8')).digest('hex');
};

let n = 0;
async function manda(de, msg) {
  n++;
  const cuerpo = JSON.stringify({
    entry: [{ changes: [{ value: {
      metadata: { phone_number_id: '111' },
      messages: [Object.assign({ id: 'k' + n, from: de }, msg)]
    } }] }]
  });
  await atiende(new Request('https://x/api/whatsapp', {
    method: 'POST', body: cuerpo,
    headers: { 'x-hub-signature-256': firma(cuerpo) }
  }));
}
const dice = function (de, t) { return manda(de, { type: 'text', text: { body: t } }); };

/* CAMBIÓ EL 5-SEP-2026: por los últimos 10 dígitos, no la cadena entera.
   El bot manda a los mexicanos como 52 + 10 aunque lleguen como 521 + 10
   —Meta lo exige—, y estos números de prueba vienen con 521. Misma regla
   que `_tickets.mismoNumero`: se vigila que llegó a la misma persona. */
function mismo(a, b) {
  const x = String(a || '').replace(/\D/g, '').slice(-10);
  const y = String(b || '').replace(/\D/g, '').slice(-10);
  return !!x && x === y;
}

function textos(para) {
  return mandados
    .filter(function (m) { return !para || mismo(m.to, para); })
    .map(function (m) { return (m.text && m.text.body) || (m.image && m.image.caption) || ''; });
}

const DUENO = '5213311112222';

/* ============================================================ */
titulo('el párrafo con todo adentro');

webhook.olvidaTodo(); tk.olvidaTodo();
mandados = []; llamadasALaIA = 0;
laIADice = {
  nombre: 'María Fernanda Ortiz Lugo',
  telefono: null,
  direccionSalida: 'Av. Vallarta 1234 col. Americana',
  horaSalida: '06:00',
  direccionDestino: 'Hotel Riu de Vallarta',
  horaRegreso: '16:00'
};

{
  const C = '5213344440001';
  tk.anotaEtapa(C, 'con_precio', { total: 9500, anticipo: 2000, viaje: '📍 GDL → Vallarta' });

  await manda(C, { type: 'image', image: { id: 'comp' } });
  ok('la foto NO gasta IA', llamadasALaIA, 0);

  mandados = [];
  await dice(C, 'Va a nombre de María Fernanda Ortiz Lugo, mi cel es el ' +
    '3312345678, nos recogen en Av. Vallarta 1234 col. Americana a las 6 de ' +
    'la mañana y vamos al Hotel Riu de Vallarta, regresamos el domingo como a las 4');

  /* LA REGLA DE ESTA ETAPA: la IA entra SIEMPRE, no como respaldo. */
  ok('el párrafo SÍ gasta una llamada de IA', llamadasALaIA, 1);
  okQue('  con las instrucciones de CONTRATO, no las de viajes',
    /direccionSalida/.test(instruccionesQueLlegaron) &&
    !/cuantas personas viajan/i.test(instruccionesQueLlegaron));

  const alCliente = textos(C);
  ok('y al cliente le llega UNA respuesta', alCliente.length, 1);
  okQue('  cerrando, porque ya estaba todo', /tengo todo/i.test(alCliente[0]));

  const f = tk.fichaDe(C);
  ok('la etapa avanzó a contrato listo', f.etapa, 'contrato_listo');
  ok('  con el nombre guardado', f.contrato.nombre, 'María Fernanda Ortiz Lugo');
  ok('  las dos direcciones', [f.contrato.direccionSalida, f.contrato.direccionDestino],
    ['Av. Vallarta 1234 col. Americana', 'Hotel Riu de Vallarta']);
  ok('  y las dos horas', [f.contrato.horaSalida, f.contrato.horaRegreso],
    ['06:00', '16:00']);

  const alDueno = textos(DUENO);
  ok('al dueño le llega la ficha', alDueno.length, 1);
  okQue('  con todo armado para pasarlo al contrato',
    /María Fernanda/.test(alDueno[0]) && /Vallarta 1234/.test(alDueno[0]) &&
    /06:00/.test(alDueno[0]));

  /* Y no le llega otra vez en cada mensaje que el cliente escriba
     después: una ficha repetida enseña a ignorar las fichas. */
  mandados = [];
  await dice(C, 'gracias!!');
  ok('y NO se le repite en el siguiente mensaje', textos(DUENO).length, 0);
}

/* ============================================================ */
titulo('cuando lo manda de dos en dos');

webhook.olvidaTodo(); tk.olvidaTodo();
mandados = []; llamadasALaIA = 0;

{
  const C = '5213344440002';
  tk.anotaEtapa(C, 'con_precio', { total: 9500, anticipo: 2000 });
  await manda(C, { type: 'image', image: { id: 'comp2' } });

  laIADice = {
    nombre: 'Raúl Gómez', telefono: null,
    direccionSalida: 'Calle Morelos 55', horaSalida: '07:00',
    direccionDestino: null, horaRegreso: null
  };
  mandados = [];
  await dice(C, 'soy Raúl Gómez, nos recogen en Calle Morelos 55 a las 7');

  const primera = textos(C)[0] || '';
  okQue('acusa lo que sí dio', /anotado/i.test(primera));
  okQue('  y pide solo lo que falta', /direcci[oó]n/i.test(primera));
  okQue('  sin volver a pedir el nombre', !/nombre completo/i.test(primera));

  /* Segundo mensaje, solo lo que faltaba. Lo de antes NO se puede
     perder: el cliente ya lo dijo una vez y ya pagó. */
  laIADice = {
    nombre: null, telefono: null,
    direccionSalida: null, horaSalida: null,
    direccionDestino: 'Hotel Costa Sur', horaRegreso: '15:00'
  };
  mandados = [];
  await dice(C, 'al Hotel Costa Sur, regresamos a las 3');

  const f = tk.fichaDe(C);
  ok('el nombre del primer mensaje NO se perdió', f.contrato.nombre, 'Raúl Gómez');
  ok('  ni su dirección de salida', f.contrato.direccionSalida, 'Calle Morelos 55');
  ok('  ni su hora', f.contrato.horaSalida, '07:00');
  ok('y lo nuevo se agregó', f.contrato.direccionDestino, 'Hotel Costa Sur');
  ok('ahora sí está listo', f.etapa, 'contrato_listo');
  okQue('y se le cierra al cliente', /tengo todo/i.test(textos(C)[0] || ''));
}

/* ============================================================ */
titulo('si la IA falla, el cliente NO se queda en silencio');

/* Acaba de mandar dinero. El silencio ahí es la peor respuesta que
   existe: es cuando empieza a pensar que le vieron la cara. */
webhook.olvidaTodo(); tk.olvidaTodo();
mandados = []; llamadasALaIA = 0;
laIADice = null;   // la IA contesta 500

{
  const C = '5213344440003';
  tk.anotaEtapa(C, 'con_precio', { total: 9500 });
  await manda(C, { type: 'image', image: { id: 'comp3' } });

  mandados = [];
  await dice(C, 'soy Ana López y nos vemos en mi casa');

  ok('se intentó la IA', llamadasALaIA, 1);
  const alCliente = textos(C);
  ok('y aun así al cliente le llegó algo', alCliente.length, 1);
  okQue('  volviéndole a pedir lo que falta', /me falta|nombre/i.test(alCliente[0]));
  okQue('  sin fingir que anotó algo', !/anotado/i.test(alCliente[0]));
}

/* ============================================================ */
titulo('y el que NO está en esa etapa no gasta IA de contrato');

/* La IA de contrato es cara comparada con el guion. Solo la alcanza
   quien ya depositó. */
webhook.olvidaTodo(); tk.olvidaTodo();
mandados = []; llamadasALaIA = 0;
laIADice = null;

{
  const C = '5213344440004';
  await dice(C, 'a chapala el 12 de septiembre somos 12, salimos de guadalajara');
  ok('un cliente normal no gasta IA', llamadasALaIA, 0);
  /* Y «a chapala» a secas TAMPOCO, desde el 3-sep-2026: el guion ya
     sabe leerlo. Antes se rendía y se pagaba una llamada por el
     mensaje más común que existe. */
  await dice('5213344440005', 'a chapala');
  ok('  ni «a chapala» a secas', llamadasALaIA, 0);
  okQue('  y el guion le contesta igual que siempre',
    /entend/i.test(textos(C)[0] || ''));
}

/* ============================================================ */
console.log('\n' + buenas + ' buenas, ' + malas + ' malas');
process.exit(malas ? 1 : 0);
