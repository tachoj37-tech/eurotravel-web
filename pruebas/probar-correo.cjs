/* ============================================================
   El correo al cliente
   ------------------------------------------------------------
       node pruebas/probar-correo.cjs

   Hasta hoy el cliente pagaba y no recibia NADA, mientras la
   pantalla le prometia «te mandamos el folio y las
   instrucciones». Esto es lo que cierra esa mentira, asi que lo
   que mas importa probar es que de verdad salga.

   Y lo segundo que mas importa: QUE NO SE LLEVE EL KILOMETRAJE.
   El mensaje se arma con la metadata de Stripe, y esa metadata
   TRAE `km`. Es un camino nuevo por donde la regla del kilometro
   se puede romper —y esta vez a un correo, que se guarda, se
   reenvia y se imprime—.
   ============================================================ */
'use strict';

let buenas = 0, malas = 0;
function igual(nombre, dio, esperado) {
  const a = JSON.stringify(dio), b = JSON.stringify(esperado);
  if (a === b) { buenas++; console.log('ok   ' + nombre); }
  else { malas++; console.log('MAL  ' + nombre + '\n     dio      ' + a + '\n     esperaba ' + b); }
}
function cierto(nombre, v) { igual(nombre, !!v, true); }

/* Resend, fingido. Apunta lo que se le pidio mandar. */
let A_RESEND = [];
let RESPUESTA = { ok: true, status: 200, cuerpo: { id: 'em_123' } };
global.fetch = function (url, opc) {
  const u = String(url);
  if (u.indexOf('api.resend.com') < 0) {
    return Promise.reject(new Error('esta prueba no debe llamar a ' + u));
  }
  A_RESEND.push({ cabeceras: opc.headers, cuerpo: JSON.parse(opc.body) });
  if (RESPUESTA.red) return Promise.reject(new Error('sin red'));
  return Promise.resolve({
    ok: RESPUESTA.ok, status: RESPUESTA.status,
    json: () => Promise.resolve(RESPUESTA.cuerpo)
  });
};

const correo = require('../api/_correo.js');

/* La metadata TAL COMO la arma pagar.js. Trae `km` a proposito: es lo que no
   puede salir. */
const METADATA = {
  folio: 'ET-Q7TW-K3R', nombre: 'Ana Ruiz Morales', telefono: '3312345678',
  correo: 'ana@ejemplo.mx', canal: 'correo',
  ruta: 'Guadalajara → Puerto Vallarta',
  origen: 'Guadalajara, Jalisco, México', destino: 'Puerto Vallarta, Jalisco, México',
  unidad: 'Sprinter', salida: '2026-09-03T08:00', regreso: '2026-09-06T18:00',
  dias: '4', puntoSalida: 'Av. Vallarta 1234, afuera del Sanborns',
  paradas: 'Tequila',
  /* NADA de esto puede salir en el correo */
  km: '621.2', nochesExtra: '0', importeNoches: '4000',
  movDias: '1', movImporte: '3000',
  total: '26000', anticipo: '5200', saldo: '20800'
};

/* ============ 1. LA REGLA DEL KILOMETRO, EN EL CORREO ============ */
(function () {
  const m = correo.mensajeDeContrato(METADATA, 'JVBERi0xLjMK');
  const todo = JSON.stringify(m);

  igual('ni el kilometraje ni ninguna tarifa salen en el correo',
    todo.match(/\bkm\b|kilometr|tarifa|621\.2|621/i), null);
  igual('ni la tarifa por noche', todo.match(/nochesExtra|importeNoches/i), null);
  igual('ni lo que cuesta un dia de movimientos', todo.match(/movImporte|movDias/), null);

  /* Y los montos que SI van, van completos */
  cierto('va lo que pago', todo.indexOf('5,200') >= 0);
  cierto('va lo que falta', todo.indexOf('20,800') >= 0);
  cierto('va el total', todo.indexOf('26,000') >= 0);
  cierto('va el folio', todo.indexOf('ET-Q7TW-K3R') >= 0);
})();

/* ============ 2. LO QUE LLEVA EL MENSAJE ============ */
(function () {
  const m = correo.mensajeDeContrato(METADATA, 'JVBERi0xLjMK');

  igual('va al correo del cliente', m.to, ['ana@ejemplo.mx']);
  cierto('el asunto trae el folio', m.subject.indexOf('ET-Q7TW-K3R') >= 0);
  cierto('sale de Eurotravel', /eurotravel/i.test(m.from));

  /* Version de texto ademas del HTML: hay clientes de correo que no pintan
     HTML, y sin esto verian un mensaje vacio. */
  cierto('lleva version en texto', typeof m.text === 'string' && m.text.length > 100);
  cierto('y version en HTML', typeof m.html === 'string' && m.html.indexOf('<') >= 0);

  /* El contrato, ADJUNTO. La liga de EuroSystem vence a los 30 dias; el
     adjunto no. El cliente tiene que poder abrirlo en marzo. */
  igual('el contrato va adjunto', m.attachments.length, 1);
  cierto('con nombre reconocible', /contrato-ET-Q7TW-K3R\.pdf/.test(m.attachments[0].filename));
  igual('y es el PDF que mando EuroSystem', m.attachments[0].content, 'JVBERi0xLjMK');

  /* Sin PDF el correo SIGUE saliendo: vale mas el folio sin contrato que
     nada. */
  const sinPdf = correo.mensajeDeContrato(METADATA, '');
  igual('sin PDF, no hay adjunto', sinPdf.attachments, undefined);
  cierto('pero el correo se manda igual', sinPdf.html.indexOf('ET-Q7TW-K3R') >= 0);
  igual('y no promete un adjunto que no va',
    /adjunto/i.test(sinPdf.html), false);
})();

/* ============ 3. LAS FECHAS, SIN QUE SE CUELE LA ZONA ============
   `new Date('2026-09-03')` es medianoche UTC, o sea las 18:00 del dia
   ANTERIOR en Tlaquepaque. Un correo que diga el dia equivocado manda a
   alguien al camion un dia tarde. */
(function () {
  igual('3 de septiembre, no 2', correo.fechaLarga('2026-09-03T08:00'),
    '3 de septiembre de 2026, 08:00');
  igual('sin hora tambien', correo.fechaLarga('2026-01-01'), '1 de enero de 2026');
  igual('el ultimo dia del año', correo.fechaLarga('2026-12-31T23:59'),
    '31 de diciembre de 2026, 23:59');
  igual('basura no revienta', correo.fechaLarga('el jueves'), '');
  igual('vacio tampoco', correo.fechaLarga(''), '');
  igual('un mes imposible tampoco', correo.fechaLarga('2026-13-01'), '');

  const m = correo.mensajeDeContrato(METADATA, '');
  cierto('y el correo dice el dia correcto', m.text.indexOf('3 de septiembre de 2026') >= 0);
  igual('nunca el dia anterior', m.text.indexOf('2 de septiembre'), -1);
})();

/* ============ 4. LO QUE ESCRIBIO UNA PERSONA NO ROMPE EL MENSAJE ============
   El nombre y el punto de salida los teclea el cliente. Un `<` suelto no
   puede meter etiquetas en el correo. */
(function () {
  const m = correo.mensajeDeContrato(Object.assign({}, METADATA, {
    nombre: '<script>alert(1)</script>',
    puntoSalida: 'Afuera del "Tec" & la <b>puerta 3</b>'
  }), '');
  igual('no se cuela una etiqueta por el nombre', /<script>/.test(m.html), false);
  cierto('se escapa', m.html.indexOf('&lt;script&gt;') >= 0);
  cierto('y los símbolos del texto se ven bien', m.html.indexOf('&amp;') >= 0);
})();

/* ============ 5. MANDARLO DE VERDAD ============ */
(function () {
  const antes = process.env.RESEND_API_KEY;

  /* --- sin clave configurada --- */
  delete process.env.RESEND_API_KEY;
  igual('sin RESEND_API_KEY no hay clave', correo.hayClave(), false);
  cierto('y lo dice claro', /RESEND_API_KEY/.test(correo.porQueNoSePuede()));

  process.env.RESEND_API_KEY = 're_de_mentiras';
  igual('con la clave puesta, si', correo.hayClave(), true);
  igual('y no hay nada que explicar', correo.porQueNoSePuede(), '');

  process.env.RESEND_API_KEY = antes === undefined ? 're_de_mentiras' : antes;
})();

(async function () {
  process.env.RESEND_API_KEY = 're_de_mentiras';

  /* --- sale bien --- */
  A_RESEND = [];
  RESPUESTA = { ok: true, status: 200, cuerpo: { id: 'em_abc' } };
  const bien = await correo.mandaContrato(METADATA, 'JVBERi0xLjMK');
  igual('se manda', bien.ok, true);
  igual('una sola llamada a Resend', A_RESEND.length, 1);
  cierto('con la clave en la cabecera, no en el cuerpo',
    A_RESEND[0].cabeceras.Authorization === 'Bearer re_de_mentiras');
  igual('y la clave NO viaja en el mensaje',
    JSON.stringify(A_RESEND[0].cuerpo).indexOf('re_de_mentiras'), -1);

  /* --- sin clave: no se intenta siquiera --- */
  const guardada = process.env.RESEND_API_KEY;
  delete process.env.RESEND_API_KEY;
  A_RESEND = [];
  const sinClave = await correo.mandaContrato(METADATA, '');
  igual('sin clave no se manda', sinClave.ok, false);
  igual('ni se gasta una llamada', A_RESEND.length, 0);
  igual('y NO se pide reintentar: una variable que falta no se arregla sola',
    sinClave.reintentar, false);
  process.env.RESEND_API_KEY = guardada;

  /* --- sin destinatario --- */
  A_RESEND = [];
  const sinCorreo = await correo.mandaContrato(
    Object.assign({}, METADATA, { correo: '' }), '');
  igual('sin destinatario no se manda', sinCorreo.ok, false);
  igual('ni se gasta una llamada', A_RESEND.length, 0);

  /* ------------------------------------------------------------
     LO QUE DECIDE SI STRIPE REINTENTA

     Un 4xx no se arregla esperando —dominio sin verificar, clave mala—.
     Un 5xx o un fallo de red si. Confundirlos es tener a Stripe tres dias
     golpeando una puerta que no va a abrir, o perder el correo de alguien
     que ya pago.
     ------------------------------------------------------------ */
  RESPUESTA = { ok: false, status: 403, cuerpo: { message: 'domain is not verified' } };
  const dominio = await correo.mandaContrato(METADATA, '');
  igual('dominio sin verificar: no se reintenta', dominio.reintentar, false);
  cierto('y el motivo lo dice', /not verified/.test(dominio.motivo));

  RESPUESTA = { ok: false, status: 401, cuerpo: { message: 'API key is invalid' } };
  igual('clave mala: no se reintenta', (await correo.mandaContrato(METADATA, '')).reintentar, false);

  RESPUESTA = { ok: false, status: 422, cuerpo: { message: 'invalid to' } };
  igual('destinatario rechazado: no se reintenta',
    (await correo.mandaContrato(METADATA, '')).reintentar, false);

  RESPUESTA = { ok: false, status: 500, cuerpo: { message: 'internal' } };
  igual('Resend caido: SI se reintenta', (await correo.mandaContrato(METADATA, '')).reintentar, true);

  RESPUESTA = { ok: false, status: 503, cuerpo: {} };
  igual('Resend en mantenimiento: SI', (await correo.mandaContrato(METADATA, '')).reintentar, true);

  RESPUESTA = { red: true };
  const caida = await correo.mandaContrato(METADATA, '');
  igual('sin red: SI se reintenta', caida.reintentar, true);
  igual('y no revienta', caida.ok, false);

  /* --- el correo se normaliza a minusculas ---
     Se comprobo contra la cuenta real de Stripe que su filtro de correo
     distingue mayusculas. Aqui todavia no se usa ese filtro, pero el correo
     sale ya normalizado para que cuando se use, cuadre. */
  RESPUESTA = { ok: true, status: 200, cuerpo: { id: 'em_x' } };
  A_RESEND = [];
  await correo.mandaContrato(Object.assign({}, METADATA, { correo: 'Ana@Ejemplo.MX' }), '');
  igual('el destinatario va en minúsculas', A_RESEND[0].cuerpo.to, ['ana@ejemplo.mx']);

  console.log('\n' + buenas + ' buenas, ' + malas + ' malas');
  process.exit(malas ? 1 : 0);
})();
