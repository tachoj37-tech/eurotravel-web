/* ============================================================
   QUE NO SE PIERDA NADA CUANDO VERCEL RECICLE
   ------------------------------------------------------------
   Todo el bot vivía en memoria. Funciona mientras la instancia
   siga viva, y deja de funcionar sin avisar cuando se recicla —
   que pasa tras unos minutos sin tráfico.

   Lo que se perdía no era un detalle:

     · En qué iba cada cliente.
     · Los datos del contrato que YA le habías dictado.
     · La conversación a medias: le habías dicho a dónde ibas y
       el bot volvía a preguntar «¿a dónde va el plan?».

   Con un comprobante de por medio, eso es perder al cliente.

   Aquí se prueba con una base de mentiras —un `fetch` que
   guarda en un objeto— y RECICLANDO la instancia a propósito:
   se le borra toda la memoria al bot a media conversación, como
   se la borra Vercel, y se comprueba que sigue sabiendo quién
   es cada quien.

   Lo que se vigila, en orden de qué tan caro sale si falla:

   1 · Que después del reciclaje el cliente NO empiece de cero.
   2 · Que un cliente no herede la ficha de otro. La llave son
       los últimos 10 dígitos y por eso «521 33…» y «33…» son la
       misma persona — y dos personas distintas, nunca.
   3 · Que si la base no contesta, el bot SIGA. Perder el tablero
       es malo; dejar de contestarle a quien ya pagó es peor.
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
process.env.ALMACEN_URL = 'https://base-de-mentiras.supabase.co';
process.env.ALMACEN_CLAVE = 'llave-de-mentiras';
delete process.env.ANTHROPIC_API_KEY;   // sin IA: aquí se prueba la memoria

const atiende = (await import(pathToFileURL(path.join(RAIZ, 'api', 'whatsapp.mjs')).href)).default;
const webhook = (await import(pathToFileURL(path.join(RAIZ, 'api', '_whatsapp-webhook.js')).href)).default;
const tk = (await import(pathToFileURL(path.join(RAIZ, 'api', '_tickets.js')).href)).default;
const almacen = (await import(pathToFileURL(path.join(RAIZ, 'api', '_almacen.js')).href)).default;

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
   LA BASE DE MENTIRAS
   ------------------------------------------------------------
   Un PostgREST de juguete: entiende el upsert, el `numero=eq.X`
   y el DELETE, que es todo lo que `_almacen.js` usa.
   ------------------------------------------------------------ */
const tablas = { fichas: new Map(), charlas: new Map(), mensajes: [] };
let mandados = [];
let baseCaida = false;
let escrituras = 0;

globalThis.fetch = async function (url, opciones) {
  const u = String(url);
  const o = opciones || {};

  if (u.indexOf('graph.facebook.com') !== -1) {
    mandados.push(o.body ? JSON.parse(o.body) : {});
    return {
      ok: true, status: 200,
      json: async function () { return { messages: [{ id: 'w' + mandados.length }] }; },
      text: async function () { return '{}'; }
    };
  }

  if (u.indexOf('base-de-mentiras') !== -1) {
    if (baseCaida) return { ok: false, status: 500, text: async function () { return 'caida'; } };

    const cual = u.match(/\/rest\/v1\/(\w+)/)[1];
    const filtro = (u.match(/numero=eq\.(\d+)/) || [])[1];
    const cuerpo = o.body ? JSON.parse(o.body) : null;

    if (o.method === 'POST') {
      escrituras++;
      if (cual === 'mensajes') tablas.mensajes.push(cuerpo);
      else tablas[cual].set(cuerpo.numero, cuerpo);
      return { ok: true, status: 201, json: async function () { return []; },
        text: async function () { return ''; } };
    }
    if (o.method === 'DELETE') {
      if (filtro) tablas[cual].delete(filtro);
      return { ok: true, status: 204, json: async function () { return []; },
        text: async function () { return ''; } };
    }
    /* GET */
    let filas = cual === 'mensajes' ? tablas.mensajes.slice()
      : Array.from(tablas[cual].values());
    if (filtro) filas = filas.filter(function (f) { return f.numero === filtro; });
    return { ok: true, status: 200, json: async function () { return filas; },
      text: async function () { return ''; } };
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
      messages: [Object.assign({ id: 'a' + n, from: de }, msg)]
    } }] }]
  });
  await atiende(new Request('https://x/api/whatsapp', {
    method: 'POST', body: cuerpo,
    headers: { 'x-hub-signature-256': firma(cuerpo) }
  }));
}
const dice = function (de, t) { return manda(de, { type: 'text', text: { body: t } }); };

/* CAMBIÓ EL 5-SEP-2026: se compara por los últimos 10 dígitos, no la
   cadena entera. El bot ahora manda a los mexicanos como 52 + 10 aunque
   lleguen como 521 + 10 —Meta lo exige y su lista de destinatarios los
   guarda así—, y los números de estas pruebas vienen con 521. Es la misma
   regla que usa `_tickets.mismoNumero` en producción: lo que se vigila es
   que le llegó a LA MISMA PERSONA, no que la cadena sea idéntica. */
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

/* Lo que hace Vercel cuando recicla: la memoria del proceso se va, la
   base se queda. Es EXACTAMENTE lo que esta prueba necesita simular. */
function vercelRecicla() {
  webhook.olvidaTodo();
  tk.olvidaTodo();
}

const DUENO = '5213311112222';

/* ============================================================ */
titulo('la conversación sobrevive al reciclaje');

vercelRecicla();
tablas.fichas.clear(); tablas.charlas.clear(); tablas.mensajes.length = 0;
mandados = [];

{
  const C = '5213366660001';
  await dice(C, 'a chapala el 12 de septiembre somos 12, salimos de guadalajara');
  okQue('el bot entendió el viaje', /Chapala/.test(textos(C)[0] || ''));
  okQue('y quedó guardado en la base', tablas.charlas.size === 1);

  /* AQUÍ. Vercel recicla a media conversación. */
  vercelRecicla();
  ok('  la memoria quedó vacía', tk.fichaDe(C), null);

  mandados = [];
  await dice(C, 'regresamos el 14');

  const t = textos(C)[0] || '';
  /* Si NO se hubiera recuperado, contestaría «¿a dónde va el plan?»
     o «esa fecha no la entendí» — que fue el defecto original. */
  okQue('y aun así siguió la conversación donde iba',
    /3 días|recorrido/i.test(t));
  okQue('  sin volver a preguntar a dónde va', !/a d[oó]nde va el plan/i.test(t));
}

/* ============================================================ */
titulo('la etapa y el contrato también sobreviven');

vercelRecicla();
tablas.fichas.clear(); tablas.charlas.clear();
mandados = [];

{
  const C = '5213366660002';
  tk.anotaEtapa(C, 'con_precio', {
    total: 9500, anticipo: 2000, viaje: '📍 GDL → Tequila'
  });
  await manda(C, { type: 'image', image: { id: 'comp' } });
  okQue('la ficha quedó guardada', tablas.fichas.has('3366660002'));

  vercelRecicla();
  ok('  la memoria quedó vacía', tk.fichaDe(C), null);

  mandados = [];
  await manda(C, { type: 'image', image: { id: 'comp2' } });

  const alDueno = textos(DUENO)[0] || '';
  /* Sin la base, este aviso llegaría pelón: «te mandaron esto» y un
     número. Con ella, sigue sabiendo de qué viaje era y cuánto
     esperabas — que es justo lo que el dueño pidió no tener que ir a
     buscar. */
  okQue('el aviso del comprobante SIGUE sabiendo de qué viaje era',
    /Tequila/.test(alDueno));
  okQue('  y cuánto esperabas', /\$2,000/.test(alDueno));
  ok('  y la etapa no retrocedió', tk.fichaDe(C).etapa, 'mando_comprobante');
}

/* ============================================================ */
titulo('y el tablero también');

vercelRecicla();
mandados = [];
{
  const r = await dice(DUENO, 'tablero');
  const t = textos(DUENO).join('\n');
  /* Las fichas de los dos clientes de arriba siguen en la base. */
  okQue('el tablero se rearma de la base', /3366660002|5213366660002/.test(t));
}

/* ============================================================ */
titulo('dos clientes NUNCA se cruzan, ni pasando por la base');

vercelRecicla();
tablas.fichas.clear(); tablas.charlas.clear();
mandados = [];

{
  const gente = [];
  for (let i = 0; i < 12; i++) gente.push('52133' + (66670000 + i * 7));
  const destinos = ['Chapala', 'Tequila', 'Mazamitla', 'Ajijic'];

  gente.forEach(function (num, i) {
    tk.anotaEtapa(num, 'con_precio', {
      total: 5000 + i, viaje: '📍 ' + destinos[i % 4]
    });
  });
  /* Un mensaje de cada quien, entreverados, para que todo se escriba. */
  for (const num of gente) await dice(num, 'hola');

  /* Reciclaje total: todo tiene que volver de la base. */
  vercelRecicla();
  for (const num of gente) await dice(num, 'hola otra vez');

  let cruces = 0;
  gente.forEach(function (num, i) {
    const f = tk.fichaDe(num);
    if (!f) { cruces++; return; }
    if (f.cliente !== num) cruces++;
    if (f.total !== 5000 + i) cruces++;
    if (f.viaje !== '📍 ' + destinos[i % 4]) cruces++;
  });
  ok('12 clientes, ida y vuelta por la base, 0 cruces', cruces, 0);
}

/* El mismo número escrito de tres formas es UNA persona, no tres. Si
   fueran tres, el que depositó como «521 33…» no aparecería al escribir
   como «33…» y su comprobante se quedaría huérfano. */
{
  ok('«5213312345678» y «3312345678» son la misma llave',
    [almacen.llave('5213312345678'), almacen.llave('3312345678')],
    ['3312345678', '3312345678']);
  ok('y «+52 1 33 1234 5678» también',
    almacen.llave('+52 1 33 1234 5678'), '3312345678');
  okQue('pero dos personas distintas NO comparten llave',
    almacen.llave('5213312345678') !== almacen.llave('5213312345679'));
}

/* ============================================================ */
titulo('la conversación queda guardada, no solo el estado');

/* Sin esto, la bandeja compartida que se haga después abriría en
   blanco: tendría en qué va cada cliente y ni una sola línea de lo
   que se dijeron. Y es lo que el dueño pidió que durara un mes. */
vercelRecicla();
tablas.fichas.clear(); tablas.charlas.clear(); tablas.mensajes.length = 0;
mandados = [];

{
  const C = '5213366660010';
  await dice(C, 'a chapala el 12 de septiembre somos 12, salimos de guadalajara');
  await dice(C, 'regresamos el 14');
  await manda(C, { type: 'image', image: { id: 'comp-x' } });

  const suyos = tablas.mensajes.filter(function (m) { return m.numero === '3366660010'; });
  okQue('se guardó lo que escribió el cliente',
    suyos.some(function (m) { return m.de === 'cliente' && /chapala/i.test(m.texto); }));
  okQue('  y lo que contestó el bot',
    suyos.some(function (m) { return m.de === 'bot' && /Chapala/.test(m.texto); }));
  /* Una foto no trae texto: se apunta QUÉ fue, que es lo que después
     explica un hueco en la conversación. */
  okQue('  y que mandó una foto',
    suyos.some(function (m) { return m.tipo === 'image'; }));

  /* Cada mensaje de entrada se apunta UNA vez, aunque el bot conteste
     dos cosas. Si no, la bandeja mostraría al cliente repitiéndose. */
  const repetidos = suyos.filter(function (m) {
    return m.de === 'cliente' && /regresamos el 14/.test(m.texto);
  });
  ok('cada mensaje se apunta una sola vez', repetidos.length, 1);

  /* Y el ticket al dueño NO va en la conversación del cliente: el
     cliente nunca lo vio, y meterlo llenaría la bandeja de ruido. */
  okQue('los tickets al dueño no ensucian la conversación',
    !suyos.some(function (m) { return /🎫|Contéstame \*este mensaje\*/.test(m.texto); }));
}

/* Lo que escribe el dueño SÍ va, y bajo el número del CLIENTE — no
   del suyo. Guardado bajo el del dueño, su bandeja sería una sola
   conversación gigante consigo mismo. */
{
  const C = '5213366660011';
  tk.anotaEtapa(C, 'con_precio', { total: 9500 });
  tk.recuerdaTicket('wamid.ticket1', C);
  mandados = [];
  await manda(DUENO, {
    type: 'text',
    text: { body: 'Te sale en 9,500 con todo' },
    context: { id: 'wamid.ticket1' }
  });

  const suyos = tablas.mensajes.filter(function (m) { return m.numero === '3366660011'; });
  okQue('lo que escribe el dueño queda en la conversación del cliente',
    suyos.some(function (m) { return m.de === 'dueno' && /9,500/.test(m.texto); }));
  const delDueno = tablas.mensajes.filter(function (m) { return m.numero === '3311112222'; });
  ok('  y NO bajo el número del dueño', delDueno, []);
}

/* ============================================================ */
titulo('si la base se cae, el bot SIGUE');

/* Perder el tablero es malo. Dejar de contestarle a alguien que ya
   pagó es peor. Ninguna de estas piezas puede tumbar al bot. */
vercelRecicla();
mandados = [];
baseCaida = true;

{
  const C = '5213366660009';
  await dice(C, 'a chapala el 12 de septiembre somos 12, salimos de guadalajara');
  const t = textos(C);
  ok('al cliente le llega su respuesta igual', t.length, 1);
  okQue('  y es la buena', /Chapala/.test(t[0]));
}
baseCaida = false;

/* ============================================================ */
titulo('y no se escribe de más');

/* Escribir la cartera entera en cada mensaje sería pagar una base de
   datos para hacerle daño. Solo se tocan los números de ESTE aviso.

   OJO CON CÓMO SE MIDE. Esto contaba «a lo mucho 2 filas» y cambió de
   bando el 3-sep-2026, cuando se empezó a guardar también la
   conversación: ahora un mensaje escribe su ficha, su charla, lo que
   dijo el cliente y lo que contestó el bot. Son más de dos, y está
   bien.

   Lo que de verdad importa no es el número: es que NO CREZCA con la
   cartera. Un bot con 500 clientes tiene que escribir lo mismo por
   mensaje que uno con 10. Por eso se mide dos veces, con carteras de
   tamaños muy distintos, y se comparan entre sí. */
vercelRecicla();
tablas.fichas.clear(); tablas.charlas.clear(); tablas.mensajes.length = 0;
mandados = [];
{
  for (let i = 0; i < 10; i++) {
    tk.anotaEtapa('5213377770' + (100 + i), 'con_precio', { total: 1000 + i });
  }
  escrituras = 0;
  await dice('5213377770105', 'hola');
  const conPocos = escrituras;

  for (let i = 0; i < 200; i++) {
    tk.anotaEtapa('5213399' + (500000 + i), 'con_precio', { total: 2000 + i });
  }
  escrituras = 0;
  await dice('5213377770106', 'hola');
  const conMuchos = escrituras;

  ok('con 200 clientes se escribe lo mismo que con 10', conMuchos, conPocos);
  /* Y que ese número siga siendo chico: ficha, charla, lo que dijo y
     lo que se contestó. Si un día se dispara, algo está escribiendo
     de más. */
  okQue('y son pocas filas por mensaje (' + conPocos + ')', conPocos <= 6);
}

/* ============================================================ */
titulo('sin base configurada, todo sigue igual que antes');

{
  const url = process.env.ALMACEN_URL;
  delete process.env.ALMACEN_URL;
  ok('el almacén se apaga solo', almacen.hayAlmacen(), false);

  vercelRecicla();
  mandados = [];
  await dice('5213388880001', 'a chapala el 12 de septiembre somos 12, salimos de guadalajara');
  okQue('y el bot contesta como siempre', /Chapala/.test(textos('5213388880001')[0] || ''));

  process.env.ALMACEN_URL = url;
}

/* ============================================================
   VER LA CONVERSACIÓN COMPLETA
   ------------------------------------------------------------
   El dueño escribe «ver 33…» y se le pinta la plática entera con
   ese cliente. Nació de esto, el 4-sep-2026:

     «que los mensajes queden en el vacío me asusta muchísimo»

   Y estaba fundado a medias: nada se perdía —todo se guardaba
   desde el primer día— pero no había cómo LEERLO.

   Lo que se vigila, en orden de qué tan caro sale si falla:

   1 · Que lo que se pinte sea lo que el cliente dijo DE VERDAD,
       sacado de la base y no de la memoria. Si saliera de la
       memoria, después de un reciclaje diría que nadie escribió.
   2 · Que la conversación de un cliente NUNCA salga bajo el
       número de otro. Es la misma llave de siempre y el mismo
       daño de siempre.
   3 · Que «ver» no se le reenvíe al cliente. Se usa RESPONDIENDO
       su ticket, y por ese camino el bot le mandaba la palabra
       «ver» a la cara y además se la guardaba en su historial.
   4 · Que si la base no contesta se diga, en vez de callarse. Un
       «no hay nada» falso se lee como «este cliente nunca
       escribió», y ahí se pierde la venta.
   ============================================================ */
titulo('ver la conversación completa');

vercelRecicla();
tablas.fichas.clear(); tablas.charlas.clear(); tablas.mensajes.length = 0;
mandados = [];

{
  const C = '5213366660777';
  await dice(C, 'somos 40 a puerto vallarta el 20 de octubre, salimos de guadalajara');
  await dice(C, 'es para la boda de mi hermana');

  mandados = [];
  await dice(DUENO, 'ver ' + C);
  const vistos = textos(DUENO);

  ok('la conversación se le manda al dueño, en un solo mensaje', vistos.length, 1);
  const v = vistos[0] || '';

  okQue('trae el encabezado con el número', /💬 \*Conversación con /.test(v));
  okQue('trae lo que el cliente dijo, tal cual', /boda de mi hermana/.test(v));
  okQue('  y también lo primero que escribió', /puerto vallarta/i.test(v));
  okQue('se ve quién dijo cada cosa', v.indexOf('👤') !== -1 && v.indexOf('🤖') !== -1);

  /* Un chat se lee del más viejo al más nuevo. La base los entrega al
     revés —se piden los últimos N con `desc`— y si ese orden se
     colara, el dueño leería la plática de atrás para adelante. */
  okQue('va en orden: lo primero, primero',
    v.indexOf('puerto vallarta') < v.indexOf('boda de mi hermana'));

  /* Y nunca al cliente. */
  ok('al cliente no le llega nada de esto', textos(C), []);
}

/* La conversación sale de la BASE, no de la memoria. Se prueba
   reciclando a propósito: si saliera de memoria, aquí diría que no
   hay nada guardado —que es exactamente el miedo que esto vino a
   quitar. */
{
  const C = '5213366660777';
  vercelRecicla();
  mandados = [];
  await dice(DUENO, 'ver ' + C);
  okQue('sobrevive al reciclaje de Vercel',
    /boda de mi hermana/.test(textos(DUENO)[0] || ''));
}

/* Dos clientes distintos, dos conversaciones distintas. Nunca una. */
{
  const A = '5213366660801';
  const B = '5213366660802';
  vercelRecicla();
  await dice(A, 'somos 30 a mazatlan el 5 de noviembre desde guadalajara');
  await dice(B, 'somos 50 a monterrey el 9 de noviembre desde guadalajara');

  mandados = [];
  await dice(DUENO, 'ver ' + A);
  const deA = textos(DUENO)[0] || '';
  okQue('la conversación de A trae lo de A', /mazatlan/i.test(deA));
  okQue('  y NADA de B', !/monterrey/i.test(deA));
}

/* «ver» sin decir de quién: se pregunta, no se adivina ni se traga. */
{
  vercelRecicla();
  mandados = [];
  await dice(DUENO, 'ver');
  const r = textos(DUENO)[0] || '';
  okQue('«ver» a secas pregunta de quién', /¿De quién\?/.test(r));
  okQue('  y le dice cómo pedirlo', /ver 3312345678/.test(r));
}

/* ------------------------------------------------------------
   EL CAMINO RECOMENDADO: RESPONDER EL TICKET CON «ver»
   ------------------------------------------------------------
   Y la regresión que lo acompaña. `clienteDeLaRespuesta` corre en
   DOS lados —al decidir a quién reenviar, y al apuntar en la base—
   así que sin el freno la palabra «ver» acababa guardada dentro de
   la plática del cliente, ensuciando justo lo que se iba a leer.
   ------------------------------------------------------------ */
{
  const C = '5213366660903';
  vercelRecicla();
  tablas.mensajes.length = 0;
  mandados = [];

  /* Pedir una persona ANTES de decir a dónde va: eso levanta el aviso
     al dueño, y ese aviso viaja con `esTicket` y `sobreCliente`, que
     es lo que hace que responderlo se amarre con este cliente.

     Va primero a propósito. Un viaje que el bot resuelve solo no
     levanta nada —da el precio y no molesta a nadie—, así que por ese
     camino no habría ticket que responder. Y a media conversación
     tampoco sirve: con el bot esperando la fecha de regreso, «quiero
     hablar con alguien» se lee como un intento de fecha. */
  await dice(C, 'quiero hablar con alguien');

  /* La base de mentiras numera `w1, w2…` por posición en `mandados`,
     y el arreglo se vació arriba: el envío de la posición i trae el
     id `w(i+1)`. Se busca cuál fue para el dueño en vez de asumir que
     fue el último — al cliente también se le contestó. */
  const iTicket = mandados.findIndex(function (m) { return mismo(m.to, DUENO); });
  okQue('al dueño le llegó su aviso', iTicket !== -1);
  const idDelTicket = 'w' + (iTicket + 1);

  /* Y ahora sí, algo que leer en el historial. */
  await dice(C, 'somos 45 a tequila el 3 de diciembre desde guadalajara');

  mandados = [];
  await manda(DUENO, {
    type: 'text', text: { body: 'ver' },
    context: { id: idDelTicket }
  });

  const v = textos(DUENO)[0] || '';
  okQue('respondiendo el ticket con «ver» sale la conversación',
    /💬 \*Conversación con /.test(v) && /tequila/i.test(v));
  ok('  y al cliente no le llega la palabra «ver»', textos(C), []);

  /* La regresión: «ver» NO se guarda como algo que el dueño le dijo. */
  const suyos = tablas.mensajes.filter(function (m) {
    return m.numero === C.slice(-10);
  });
  ok('«ver» no queda guardado en el historial del cliente',
    suyos.filter(function (m) { return m.texto === 'ver'; }).length, 0);
  okQue('  pero lo que sí dijo el cliente sigue ahí',
    suyos.some(function (m) { return /tequila/i.test(m.texto); }));
}

/* Un número del que no hay nada. Se dice, y se dice por qué. */
{
  vercelRecicla();
  mandados = [];
  await dice(DUENO, 'ver 3300000000');
  const r = textos(DUENO)[0] || '';
  okQue('de un número sin nada, se avisa', /No hay nada guardado/.test(r));
}

/* Si la base se cae, el dueño ve que se cayó. Callarse o decir «no hay
   nada» sería mentirle sobre un cliente que sí escribió. */
{
  const C = '5213366660777';
  vercelRecicla();
  mandados = [];
  baseCaida = true;
  await dice(DUENO, 'ver ' + C);
  baseCaida = false;

  const r = textos(DUENO)[0] || '';
  okQue('con la base caída se le avisa, no se calla',
    /No pude leer el almacén/.test(r));
  okQue('  y NO se le dice que el cliente no escribió',
    !/No hay nada guardado/.test(r));
}

/* ------------------------------------------------------------
   EL TOPE · Meta corta en 4096
   ------------------------------------------------------------
   Con una plática larga, un mensaje que Meta rechaza no llega —y
   un historial que no llega es lo mismo que no tenerlo. Se tiran
   los MÁS VIEJOS, porque lo último es lo que sirve para contestar.
   ------------------------------------------------------------ */
{
  const muchas = [];
  for (let i = 0; i < 60; i++) {
    muchas.push({
      numero: '3312345678', de: i % 2 ? 'bot' : 'cliente',
      texto: 'mensaje numero ' + i + ' ' + 'x'.repeat(300),
      cuando: new Date(Date.UTC(2026, 8, 4, 10, i)).toISOString()
    });
  }
  const t = webhook.armaConversacion('3312345678', muchas);

  okQue('una plática larga cabe en un mensaje de WhatsApp', t.length <= 4096);
  okQue('  se dice cuántos no cupieron', /no cupieron\._/.test(t));
  okQue('  y lo que queda es lo MÁS NUEVO', t.indexOf('mensaje numero 59') !== -1);
  okQue('  no lo más viejo', t.indexOf('mensaje numero 0 ') === -1);
}

/* Un mensaje larguísimo solo no se come la pantalla entera. */
{
  const t = webhook.armaConversacion('3312345678', [
    { numero: '3312345678', de: 'cliente', texto: 'a'.repeat(2000),
      cuando: '2026-09-04T16:00:00.000Z' },
    { numero: '3312345678', de: 'cliente', texto: 'y esto es lo que importa',
      cuando: '2026-09-04T16:01:00.000Z' }
  ]);
  okQue('un mensaje kilométrico se recorta', t.indexOf('…') !== -1);
  okQue('  y el de después sigue visible', /y esto es lo que importa/.test(t));
}

/* Los saltos de línea se aplanan: sin esto, un mensaje largo del bot
   se leería como veinte mensajes distintos. */
{
  const t = webhook.armaConversacion('3312345678', [
    { numero: '3312345678', de: 'bot', texto: 'linea uno\nlinea dos',
      cuando: '2026-09-04T16:00:00.000Z' }
  ]);
  ok('un mensaje de varias líneas ocupa un solo renglón',
    t.split('\n').filter(function (l) { return /linea uno/.test(l); }).length, 1);
  okQue('  y no se pierde la segunda línea', /linea dos/.test(t));
}

/* ============================================================
   EL MODO ESPIA
   ------------------------------------------------------------
   Con `ESPIAR` prendido, cada mensaje que sale hacia un cliente
   se le copia al dueño. Es para vigilar el estreno del bot.

   Lo que se vigila, en orden de qué tan caro sale si falla:

   1 · Que APAGADO no cambie absolutamente nada. Es la mitad más
       importante: un interruptor de vigilancia que se filtra a
       producción llena el celular del dueño y lo entrena a
       ignorar sus propios avisos.
   2 · Que el espejo NO se espeje a sí mismo. Se manda desde
       `manda`, que es lo mismo que lo dispara: sin el freno de
       `esTicket` sería un mensaje que engendra otro para
       siempre, contra la API de Meta.
   3 · Que copie el texto FINAL, el que el cliente recibió, y no
       el que se pensaba mandar antes del precio o de la IA.
   4 · Que responder el espejo le llegue al cliente. La otra
       mitad de lo que pidió: «poder revisar y accionar».
   ============================================================ */
titulo('el modo espía');

/* --- apagado, que es como viene --- */
{
  vercelRecicla();
  mandados = [];
  delete process.env.ESPIAR;

  const C = '5213366661001';
  await dice(C, 'a chapala el 12 de septiembre somos 12, salimos de guadalajara');

  okQue('apagado, al cliente se le contesta igual', /Chapala/.test(textos(C)[0] || ''));
  ok('  y al dueño no le llega ningún espejo',
    textos(DUENO).filter(function (t) { return /👁/.test(t); }), []);
}

/* --- prendido --- */
{
  vercelRecicla();
  mandados = [];
  process.env.ESPIAR = '1';

  const C = '5213366661002';
  await dice(C, 'a chapala el 12 de septiembre somos 12, salimos de guadalajara');

  const espejos = textos(DUENO).filter(function (t) { return /👁/.test(t); });
  okQue('prendido, al dueño le llega el espejo', espejos.length >= 1);

  const e = espejos[0] || '';
  okQue('  trae el número del cliente', e.indexOf(C) !== -1);
  okQue('  trae lo que el cliente escribió', /a chapala el 12 de septiembre/i.test(e));
  okQue('  y lo que el bot le contestó', /Chapala/.test(e));
  okQue('  y le dice que puede contestarlo', /Contéstame esto/.test(e));

  /* Y al cliente NO le llega el espejo, que sería enseñarle la
     vigilancia. */
  okQue('el cliente no ve nada de esto',
    textos(C).every(function (t) { return t.indexOf('👁') === -1; }));
}

/* --- que el espejo no se espeje ---
   HONESTIDAD SOBRE LO QUE ESTA PRUEBA PRUEBA: hay DOS frenos a la
   recursión —`esTicket` en el espejo, y que no se copie lo que ya va
   para el dueño— y cualquiera de los dos basta. Se comprobó quitando
   cada uno: la prueba sigue verde, porque el otro la sostiene. Así
   que esto NO es una prueba de que ambos frenos estén; es una red
   por si un día se quitan los dos, que es cuando esto se convertiría
   en mensajes infinitos contra la API de Meta.
   El freno que SÍ se probó rojo es `esTicket`, abajo, en la parte de
   responder el espejo: sin él, contestar no llega a nadie. */
{
  vercelRecicla();
  mandados = [];
  process.env.ESPIAR = '1';

  const C = '5213366661003';
  await dice(C, 'a chapala el 12 de septiembre somos 12, salimos de guadalajara');

  const espejos = textos(DUENO).filter(function (t) { return /👁/.test(t); });
  /* Un espejo por mensaje que salió al cliente. Si se espejara a sí
     mismo esto crecería sin fin, y con un tope de 25 ya se notaría. */
  okQue('el espejo no engendra más espejos (' + espejos.length + ')',
    espejos.length > 0 && espejos.length < 5);
  okQue('  y ninguno habla del dueño',
    espejos.every(function (t) { return t.indexOf(DUENO) === -1; }));
}

/* --- el texto que se copia es el FINAL --- */
{
  vercelRecicla();
  mandados = [];
  process.env.ESPIAR = '1';

  /* El tablero es el caso claro: el webhook arma uno con la memoria y
     `whatsapp.mjs` lo rearma con la base. Va al dueño, así que no se
     espeja — pero sirve para comprobar que el espejo se engancha
     donde el texto ya está resuelto y no antes. */
  const C = '5213366661004';
  await dice(C, 'a chapala el 12 de septiembre somos 12, salimos de guadalajara');
  const espejo = textos(DUENO).filter(function (t) { return /👁/.test(t); })[0] || '';
  const alCliente = textos(C)[0] || '';

  okQue('el espejo copia lo mismo que recibió el cliente',
    alCliente.length > 0 && espejo.indexOf(alCliente.slice(0, 60)) !== -1);
}

/* --- y se puede accionar: responder el espejo le llega al cliente --- */
{
  vercelRecicla();
  mandados = [];
  process.env.ESPIAR = '1';

  const C = '5213366661005';
  await dice(C, 'a chapala el 12 de septiembre somos 12, salimos de guadalajara');

  const i = mandados.findIndex(function (m) {
    return mismo(m.to, DUENO) && /👁/.test((m.text && m.text.body) || '');
  });
  okQue('hay un espejo que responder', i !== -1);

  mandados = [];
  await manda(DUENO, {
    type: 'text', text: { body: 'yo te lo dejo en 9,500, ya lo hablamos' },
    context: { id: 'w' + (i + 1) }
  });

  ok('al contestar el espejo, las palabras del dueño llegan al cliente',
    textos(C), ['yo te lo dejo en 9,500, ya lo hablamos']);
}

/* --- y se apaga --- */
{
  vercelRecicla();
  mandados = [];
  process.env.ESPIAR = '0';

  const C = '5213366661006';
  await dice(C, 'a chapala el 12 de septiembre somos 12, salimos de guadalajara');
  ok('con ESPIAR=0 se apaga otra vez',
    textos(DUENO).filter(function (t) { return /👁/.test(t); }), []);

  delete process.env.ESPIAR;
}

/* ============================================================
   EL «1» DE MÉXICO AL MANDAR
   ------------------------------------------------------------
   WhatsApp reporta los celulares mexicanos como 521 + 10 dígitos,
   pero Meta pide mandar a 52 + 10 y así los guarda en su lista de
   destinatarios. Contestando al 521 crudo, Meta rechazaba con
   #131030 «no está en la lista de autorizados» aunque sí estuviera.

   Se cazó el 5-sep-2026 en el primer «hola» real: toda la cadena
   funcionó y se cayó en el último metro por ese dígito.
   ============================================================ */
titulo('el «1» de méxico se quita al mandar');

{
  vercelRecicla();
  mandados = [];
  delete process.env.ESPIAR;

  /* Cliente con el 521 viejo, como llega de verdad. */
  const C = '5213366661234';
  await dice(C, 'a chapala el 12 de septiembre somos 12, salimos de guadalajara');

  const aEl = mandados.filter(function (m) { return /3366661234$/.test(m.to); });
  okQue('al cliente sí se le contestó', aEl.length >= 1);
  ok('  y se le mandó SIN el 1: 52 + 10 dígitos', aEl[0] && aEl[0].to, '523366661234');
}

{
  vercelRecicla();
  mandados = [];

  /* Un número que ya viene con 52 + 10 no se toca. */
  const C = '523366665678';
  await dice(C, 'a chapala el 12 de septiembre somos 12, salimos de guadalajara');
  const aEl = mandados.filter(function (m) { return /3366665678$/.test(m.to); });
  ok('un 52 + 10 se queda igual', aEl[0] && aEl[0].to, '523366665678');
}

{
  vercelRecicla();
  mandados = [];

  /* Y el dueño, que se escribe con 52 + 10 en DUENO_WHATSAPP, recibe
     igual: el ticket va al número tal cual. */
  const C = '5213366669999';
  await dice(C, 'quiero hablar con alguien');
  const alDueno = mandados.filter(function (m) { return mismo(m.to, DUENO); });
  okQue('el ticket al dueño sigue llegando a su 52 + 10', alDueno.length >= 1);
}

/* ============================================================ */
console.log('\n' + buenas + ' buenas, ' + malas + ' malas');
process.exit(malas ? 1 : 0);
