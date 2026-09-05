/* ============================================================
   LO QUE SALE DE VERDAD POR WHATSAPP
   ------------------------------------------------------------
   `probar-whatsapp.cjs` prueba la lógica y `probar-whatsapp-
   cascara.mjs` prueba que el archivo arranque. Ninguno de los dos
   miraba lo ÚNICO que le llega al cliente: los mensajes que se le
   mandan a Meta.

   Y ahí faltaban dos piezas enteras, las dos por la misma razón —
   `procesa` es síncrona y estas dos cosas necesitan red, así que
   se resuelven en la cáscara y nadie las estaba mirando:

     · EL PRECIO. El bot decía «Va, déjame sacar el precio…» y ahí
       se acababa la conversación. En la página el navegador veía
       `cotiza` y pedía el precio; en WhatsApp no lo miraba nadie.
       Una venta completa moría justo en el mensaje que importa.

     · LA IA DE RESPALDO. `noEntendio` es la señal de gastar una
       llamada a la IA. La página la miraba; WhatsApp no. O sea que
       en WhatsApp —donde están los clientes— la mitad «con IA» del
       diseño no existía.

   Aquí se le pone un `fetch` de mentiras al proceso y se lee lo
   que el bot QUISO mandar. Sin red, sin claves de verdad y sin un
   peso gastado.
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
/* La llave con la que el bot le habla a EuroSystem. Sin ella el bot no
   consulta el calendario y —cerrado a fallos— tampoco promete. */
process.env.CONTRATOS_API_KEY = 'llave-de-mentiras';
/* Con clave —de mentiras— para que el camino de la IA se recorra.
   Quien contesta es el `fetch` de abajo, no Anthropic. */
process.env.ANTHROPIC_API_KEY = 'clave-de-mentiras';

const atiende = (await import(pathToFileURL(path.join(RAIZ, 'api', 'whatsapp.mjs')).href)).default;
const webhook = (await import(pathToFileURL(path.join(RAIZ, 'api', '_whatsapp-webhook.js')).href)).default;
/* El guion, para probar sin red la regla de cuándo se mira el calendario. */
const conversacion = (await import(pathToFileURL(path.join(RAIZ, 'bot.js')).href)).default;

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

/* ------------------------------------------------------------
   EL `fetch` DE MENTIRAS
   ------------------------------------------------------------
   Apunta todo lo que sale y contesta lo que le digan. `laIADice`
   se cambia entre pruebas para fingir que la IA entendió o no.
   ------------------------------------------------------------ */
let mandados = [];
let llamadasALaIA = 0;
let laIADice = null;

globalThis.fetch = async function (url, opciones) {
  const u = String(url);
  const cuerpo = opciones && opciones.body ? JSON.parse(opciones.body) : {};

  if (u.indexOf('graph.facebook.com') !== -1) {
    mandados.push(cuerpo);
    return {
      ok: true, status: 200,
      json: async function () { return { messages: [{ id: 'wamid.salida' + mandados.length }] }; },
      text: async function () { return '{}'; }
    };
  }

  if (u.indexOf('api.anthropic.com') !== -1) {
    llamadasALaIA++;
    if (!laIADice) return { ok: false, status: 500, text: async function () { return ''; } };
    return {
      ok: true, status: 200,
      json: async function () {
        return { content: [{ text: JSON.stringify(laIADice) }] };
      }
    };
  }

  /* El calendario de EuroSystem (5-sep-2026). `calendarioDice` en null
     finge que EuroSystem está caído; un objeto finge su respuesta. */
  if (u.indexOf('/api/disponibilidad') !== -1) {
    llamadasAlCalendario++;
    ultimaConsultaAlCalendario = u;
    if (!calendarioDice) return { ok: false, status: 500, text: async function () { return ''; } };
    return {
      ok: true, status: 200,
      json: async function () { return { datos: calendarioDice }; },
      text: async function () { return ''; }
    };
  }

  throw new Error('el bot llamó a algo que no debía: ' + u);
};
let llamadasAlCalendario = 0;
let ultimaConsultaAlCalendario = '';
/* Por defecto hay lugar: las pruebas viejas de precio usan el 12 de
   septiembre —temporada alta— y sin esto todas caerían en «déjame
   revisar» en vez de probar el precio. Las pruebas del calendario lo
   vacían a propósito. */
let calendarioDice = { libres: 3, total: 4 };

const firma = function (c) {
  return 'sha256=' + crypto.createHmac('sha256', SECRETO)
    .update(Buffer.from(c, 'utf8')).digest('hex');
};

let contador = 0;
async function dice(texto, de) {
  contador++;
  const cuerpo = JSON.stringify({
    entry: [{ changes: [{ value: {
      metadata: { phone_number_id: '111' },
      messages: [{ id: 'wamid.p' + contador, from: de || '5213399998888',
        type: 'text', text: { body: texto } }]
    } }] }]
  });
  await atiende(new Request('https://x/api/whatsapp', {
    method: 'POST', body: cuerpo,
    headers: { 'x-hub-signature-256': firma(cuerpo) }
  }));
}

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
    .map(function (m) { return (m.text && m.text.body) || ''; });
}

const CLIENTE = '5213399998888';
const DUENO = '5213311112222';

/* ============================================================ */
titulo('la conversación entera, hasta el precio');

webhook.olvidaTodo();
mandados = [];
await dice('a chapala el 12 de septiembre somos 12, salimos de guadalajara');
await dice('regresamos el 14');
await dice('no vamos a pasear');
await dice('sí está bien');

{
  const alCliente = textos(CLIENTE);
  okQue('el bot contesta cada mensaje', alCliente.length >= 4);

  /* Lo que faltaba: DESPUÉS del «déjame sacar el precio» tiene que
     salir el precio. Antes ahí se acababa todo. */
  const avisa = alCliente.findIndex(function (t) { return /déjame sacar el precio/i.test(t); });
  okQue('avisa que va por el precio', avisa !== -1);
  okQue('  y el precio SÍ llega después', avisa !== -1 && !!alCliente[avisa + 1]);

  const precio = alCliente[avisa + 1] || '';
  okQue('  con un total en pesos', /\*Total: \$[\d,]+\*/.test(precio));
  okQue('  y el anticipo para bloquear la fecha', /te bloqueo/i.test(precio));
  okQue('  repitiéndole su destino y su fecha',
    /Chapala/.test(precio) && /12 de septiembre/.test(precio));

  /* R12 y R45 · el cliente NUNCA ve el kilometraje ni la tarifa. */
  okQue('  y sin enseñarle kilómetros ni tarifa por km',
    !/\bkm\b|kil[oó]metro|por km|tarifa/i.test(precio));

  /* Ni una llamada a Google: Chapala es destino de precio cerrado.
     Si un día se cuela una, este `fetch` truena y se nota. */
  ok('no se llamó a la IA en toda la conversación', llamadasALaIA, 0);
}

/* ============================================================ */
titulo('la IA de respaldo, cuando el guion se rinde');

/* CAMBIÓ EL 3-SEP-2026. Aquí decía «a chapala», porque ése era el
   mensaje con el que el guion se rendía. Ya no: el guion aprendió a
   leer un destino suelto, y con eso el mensaje más común que existe
   dejó de costar una llamada de pago.

   Así que ahora se prueba con algo que el guion DE VERDAD no entiende.
   Lo que se vigila sigue siendo lo mismo: que cuando se rinda, la IA
   entre — porque en WhatsApp nadie miraba `noEntendio` y esa mitad del
   diseño no existía. */
webhook.olvidaTodo();
mandados = [];
llamadasALaIA = 0;
laIADice = {
  intencion: 'cotizar', destino: 'Chapala', gente: null, unidad: null,
  origen: null, salida: null, regreso: null, respuesta: null
};

await dice('ando viendo lo del finde con la banda pues', '5213355554444');

{
  ok('se gastó UNA llamada a la IA, no más', llamadasALaIA, 1);

  const alCliente = textos('5213355554444');
  ok('y al cliente le llegó UNA sola respuesta', alCliente.length, 1);
  /* La del guion NO se manda: mandar las dos sería contestarle dos
     veces, y una de ellas mal. */
  okQue('  que NO es la de rendirse',
    !/checarte eso bien tantito/i.test(alCliente[0]));
  okQue('  sino la que sigue la conversación',
    /Chapala/i.test(alCliente[0]));
}

/* Y lo que la IA destrabó queda guardado: si no, el siguiente mensaje
   se vuelve a no entender y se paga la IA otra vez por lo mismo. */
{
  llamadasALaIA = 0;
  mandados = [];
  await dice('somos 14', '5213355554444');
  ok('el siguiente mensaje ya no necesita IA', llamadasALaIA, 0);
  okQue('  porque la conversación siguió con lo que ya sabía',
    textos('5213355554444').length === 1);
}

/* ============================================================ */
titulo('si la IA falla, el bot sigue');

/* «Que la IA falle jamás puede tumbar al bot.» Aquí contesta 500. */
webhook.olvidaTodo();
mandados = [];
llamadasALaIA = 0;
laIADice = null;

await dice('ando viendo lo del finde con la banda pues', '5213366665555');

{
  ok('se intentó', llamadasALaIA, 1);
  const alCliente = textos('5213366665555');
  ok('y aun así al cliente le llegó algo', alCliente.length, 1);
  okQue('  la respuesta del guion, que para eso está',
    /checarte eso bien tantito/i.test(alCliente[0]));
  /* Y al dueño le llega el aviso, porque ese mensaje lleva `pasa`. */
  okQue('y al dueño se le avisa', textos(DUENO).length >= 1);
}

/* ============================================================ */
titulo('y si el cotizador falla, tampoco se queda callado');

/* Un viaje que el motor no sabe cotizar solo. Lo que NO puede pasar
   es silencio después de «ahorita te paso el precio»: eso es una
   venta perdida sin rastro. */
webhook.olvidaTodo();
mandados = [];
llamadasALaIA = 0;
laIADice = null;

await dice('a chapala el 12 de septiembre somos 12, salimos de guadalajara', '5213377776666');
await dice('regresamos el 14', '5213377776666');
await dice('ninguno', '5213377776666');
await dice('sí', '5213377776666');

{
  const alCliente = textos('5213377776666');
  const ultimo = alCliente[alCliente.length - 1] || '';
  okQue('siempre hay un último mensaje con algo dentro', ultimo.length > 10);
  /* O trae el precio, o dice qué sigue. Nunca nada. */
  okQue('  y o trae el precio o dice qué sigue',
    /\*Total: \$/.test(ultimo) || /confirm|márcame|marcame|revisar/i.test(ultimo));
}

/* ============================================================
   EL CALENDARIO DE EUROSYSTEM ANTES DE PROMETER · 5-sep-2026
   ------------------------------------------------------------
   Dictado del dueño: en marzo, mayo, septiembre, o con 30 días o
   menos de anticipación, el bot NO da por hecho que hay unidad: le
   pregunta a EuroSystem cuántas quedan libres de ese tipo entre esas
   fechas. Si dice cero o no contesta, el bot dice que revisa y avisa
   a una persona. Fuera de eso, no gasta la llamada.

   Lo que se vigila, en orden de qué tan caro sale si falla:

   1 · Que sin lugar (o sin respuesta) NO salga precio ni «¿te la
       aparto?». Prometer una unidad comprometida es el peor caso.
   2 · Que el cliente NUNCA vea los números del calendario. «Quedan
       2» es escasez que el dueño no autorizó a nombrar.
   3 · Que fuera de temporada y con tiempo NO se llame: cada llamada
       cuesta y no aporta.
   4 · Que la regla pura sea la dictada: marzo/mayo/septiembre o ≤30 días.
   ============================================================ */
titulo('el calendario de eurosystem antes de prometer');

{
  const g = conversacion.hayQueRevisarDisponibilidad;
  okQue('septiembre → se revisa', g('2026-09-20', '2026-09-03'));
  okQue('marzo → se revisa', g('2027-03-10', '2026-09-03'));
  okQue('mayo → se revisa', g('2027-05-02', '2026-09-03'));
  okQue('noviembre a 20 días → se revisa', g('2026-11-01', '2026-10-12'));
  okQue('noviembre a 60 días → NO se revisa', !g('2026-11-30', '2026-10-01'));
  okQue('una fecha ilegible → NO se revisa (y no truena)', !g('mañana', '2026-09-03'));
}

/* Una sola frase no llega al precio: hay que contestar regreso, paseos y
   confirmar, como en la prueba de arriba. Mismo diálogo, otra fecha. */
async function cotizaChapala(C, salida, regreso) {
  await dice('a chapala el ' + salida + ' somos 12, salimos de guadalajara', C);
  await dice('regresamos el ' + regreso, C);
  await dice('no vamos a pasear', C);
  await dice('sí está bien', C);
}

/* Con lugar: el precio sale como siempre, y sí se consultó. */
{
  webhook.olvidaTodo(); mandados = []; llamadasAlCalendario = 0; ultimaConsultaAlCalendario = '';
  calendarioDice = { libres: 2, total: 4 };
  const C = '5213366670001';
  await cotizaChapala(C, '12 de septiembre', '14');
  const t = textos(C).join('\n');
  ok('con lugar se consultó UNA vez', llamadasAlCalendario, 1);
  okQue('  con tipo, salida y regreso en la consulta',
    /tipo=SPRINTER/.test(ultimaConsultaAlCalendario) && /salida=2026-09-12/.test(ultimaConsultaAlCalendario));
  okQue('  y el precio salió', /\*Total: \$/.test(t));
  okQue('  sin decirle al cliente cuántas quedan', !/libres|quedan \d/i.test(t));
}

/* Sin lugar: NO hay precio, se dice que se revisa, y se avisa a una persona. */
{
  webhook.olvidaTodo(); mandados = []; llamadasAlCalendario = 0;
  calendarioDice = { libres: 0, total: 4 };
  const C = '5213366670002';
  await cotizaChapala(C, '12 de septiembre', '14');
  const alCliente = textos(C).join('\n');
  const alDueno = textos(process.env.DUENO_WHATSAPP).join('\n');
  okQue('sin lugar NO sale precio', !/\*Total: \$/.test(alCliente));
  okQue('  ni «¿te la aparto?»', !/aparto/i.test(alCliente));
  okQue('  se le dice que se revisa', /revisar disponibilidad/i.test(alCliente));
  okQue('  sin números del calendario', !/\b0 de 4\b|libres/i.test(alCliente));
  okQue('  y al dueño le llega el ticket con lo que dijo EuroSystem',
    /Revisar disponibilidad/.test(alDueno) && /0 de 4 libres/.test(alDueno));
}

/* EuroSystem caído: se trata igual que sin lugar. Cerrado a fallos. */
{
  webhook.olvidaTodo(); mandados = []; llamadasAlCalendario = 0;
  calendarioDice = null;
  const C = '5213366670003';
  await cotizaChapala(C, '12 de septiembre', '14');
  const alCliente = textos(C).join('\n');
  okQue('si EuroSystem no contesta, tampoco se promete', !/\*Total: \$/.test(alCliente));
  okQue('  y se dice que se revisa', /revisar disponibilidad/i.test(alCliente));
  okQue('  y el ticket dice que no contestó',
    /no contestó/.test(textos(process.env.DUENO_WHATSAPP).join('\n')));
}

/* Fuera de temporada y con tiempo: ni se llama. */
{
  webhook.olvidaTodo(); mandados = []; llamadasAlCalendario = 0;
  calendarioDice = null;   // aunque estuviera caído, no importa: no se llama
  const C = '5213366670004';
  await cotizaChapala(C, '20 de noviembre', '22');
  const t = textos(C).join('\n');
  ok('noviembre a 78 días: cero llamadas al calendario', llamadasAlCalendario, 0);
  okQue('  y el precio sale normal', /\*Total: \$/.test(t));
}

/* Sin llave configurada no se consulta — y por eso tampoco se promete. */
{
  webhook.olvidaTodo(); mandados = []; llamadasAlCalendario = 0;
  calendarioDice = { libres: 3, total: 4 };
  const llave = process.env.CONTRATOS_API_KEY;
  delete process.env.CONTRATOS_API_KEY;
  const C = '5213366670005';
  await cotizaChapala(C, '12 de septiembre', '14');
  ok('sin llave no se llama', llamadasAlCalendario, 0);
  okQue('  y cerrado a fallos: no se promete', !/\*Total: \$/.test(textos(C).join('\n')));
  process.env.CONTRATOS_API_KEY = llave;
}
calendarioDice = { libres: 3, total: 4 };

/* ============================================================ */
console.log('\n' + buenas + ' buenas, ' + malas + ' malas');
process.exit(malas ? 1 : 0);
