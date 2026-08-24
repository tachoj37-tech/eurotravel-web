/* ============================================================
   Pruebas del webhook de Stripe — sin red
   ------------------------------------------------------------
       node pruebas/probar-webhook.cjs

   Lo que se juega aqui: que nadie pueda mandar un «ya pago»
   inventado y que se registre un contrato sin dinero de por medio.

   Dos candados, no uno:
     1. la firma, cuando el entorno deja ver los bytes crudos
     2. y sobre todo, que del aviso solo se toma el ID: si esta
        pagado o no se le pregunta a Stripe con nuestra clave.
        Un aviso mentiroso no sirve de nada.
   ============================================================ */
'use strict';
const firma = require('../api/_firma-stripe.js');

let buenas = 0, malas = 0;
function igual(nombre, dio, esperado) {
  const a = JSON.stringify(dio), b = JSON.stringify(esperado);
  if (a === b) { buenas++; console.log('ok   ' + nombre); }
  else { malas++; console.log('MAL  ' + nombre + '\n     dio      ' + a + '\n     esperaba ' + b); }
}
function cierto(nombre, v) { igual(nombre, !!v, true); }

const SECRETO = 'whsec_DE_MENTIRAS_para_las_pruebas';
const AHORA = 1789000000;

/* ================= LA FIRMA ================= */

const cuerpo = JSON.stringify({ type: 'checkout.session.completed', data: { object: { id: 'cs_1' } } });

cierto('firma buena: pasa',
  firma.verifica(cuerpo, firma.firmaDePrueba(cuerpo, SECRETO, AHORA), SECRETO, AHORA).ok);

igual('sin cabecera: no pasa',
  firma.verifica(cuerpo, '', SECRETO, AHORA).ok, false);

igual('sin secreto configurado: no pasa',
  firma.verifica(cuerpo, firma.firmaDePrueba(cuerpo, SECRETO, AHORA), '', AHORA).ok, false);

/* EL ATAQUE: alguien inventa un evento y lo firma con OTRO secreto */
igual('firmado con otro secreto: NO pasa',
  firma.verifica(cuerpo, firma.firmaDePrueba(cuerpo, 'whsec_el_del_atacante', AHORA), SECRETO, AHORA).ok,
  false);

/* EL OTRO ATAQUE: toma una firma legitima y le cambia el cuerpo */
(function () {
  const buena = firma.firmaDePrueba(cuerpo, SECRETO, AHORA);
  const alterado = JSON.stringify({ type: 'checkout.session.completed', data: { object: { id: 'cs_INVENTADA' } } });
  igual('cuerpo cambiado con firma legitima: NO pasa',
    firma.verifica(alterado, buena, SECRETO, AHORA).ok, false);
})();

/* REENVIO: una firma legitima pero vieja */
igual('firma de hace una hora: no pasa (vencida)',
  firma.verifica(cuerpo, firma.firmaDePrueba(cuerpo, SECRETO, AHORA - 3600), SECRETO, AHORA).ok,
  false);
cierto('firma de hace un minuto: si pasa',
  firma.verifica(cuerpo, firma.firmaDePrueba(cuerpo, SECRETO, AHORA - 60), SECRETO, AHORA).ok);

/* la cabecera trae basura o le falta la parte v1 */
igual('cabecera sin v1: no pasa', firma.verifica(cuerpo, 't=' + AHORA, SECRETO, AHORA).ok, false);
igual('cabecera sin t: no pasa', firma.verifica(cuerpo, 'v1=abc', SECRETO, AHORA).ok, false);
igual('t que no es numero: no pasa', firma.verifica(cuerpo, 't=ayer,v1=abc', SECRETO, AHORA).ok, false);

/* Stripe puede mandar varias v1 durante una rotacion de secreto */
(function () {
  const buena = firma.firmaDePrueba(cuerpo, SECRETO, AHORA).split('v1=')[1];
  cierto('varias v1, una buena: pasa',
    firma.verifica(cuerpo, 't=' + AHORA + ',v1=0000,v1=' + buena, SECRETO, AHORA).ok);
})();

/* el cuerpo parseado no sirve: los bytes exactos se perdieron */
igual('cuerpo como objeto: no pasa',
  firma.verifica({ type: 'x' }, firma.firmaDePrueba(cuerpo, SECRETO, AHORA), SECRETO, AHORA).ok,
  false);

/* ================= EL HANDLER ================= */

process.env.STRIPE_WEBHOOK_SECRET = SECRETO;
process.env.CONTRATOS_API_KEY = 'llave_de_mentiras';
process.env.STRIPE_SECRET_KEY = 'sk_test_de_mentiras';
const logica = require('../api/_webhook-logica.js');
/* La logica recibe el crudo y la firma, y devuelve la respuesta: la cascara
   .mjs solo consigue el cuerpo crudo y no tiene reglas que probar. */
async function handler(p, r) { const s = await logica.procesa(p.body, p.headers['stripe-signature']); r.status(s.status).json(s.cuerpo); }

function res() {
  const r = { _status: null, _json: null };
  r.status = function (s) { r._status = s; return r; };
  r.json = function (j) { r._json = j; return r; };
  return r;
}
function pide(evento, opciones) {
  const o = opciones || {};
  const crudo = typeof evento === 'string' ? evento : JSON.stringify(evento);
  return {
    method: o.metodo || 'POST',
    headers: { 'stripe-signature': o.sinFirma ? '' : firma.firmaDePrueba(crudo, o.secreto || SECRETO) },
    body: Buffer.from(crudo, 'utf8')
  };
}

const META = {
  folio: 'ET-K3M9-4Q2', nombre: 'Juana Pérez López', telefono: '3324002285',
  correo: 'quien@sea.mx', canal: 'correo', ruta: 'Guadalajara a Puerto Vallarta',
  origen: 'Guadalajara, Jalisco, México', destino: 'Puerto Vallarta, Jalisco, México',
  unidad: 'Sprinter', salida: '2026-09-03T08:00', regreso: '2026-09-06T18:00',
  dias: '4', km: '621.2', total: '21700', anticipo: '4340', saldo: '17360'
};
const sesionPagada = {
  id: 'cs_test_ABC', payment_status: 'paid', payment_method_types: ['card'],
  metadata: META, customer_details: { email: 'quien@sea.mx' }
};

/* Dos destinos que fingir: Stripe —que ahora es la fuente de verdad— y
   EuroSystem. `sesionEnStripe` es lo que Stripe contesta cuando se le
   pregunta por la sesion; el aviso del webhook ya no manda. */
let ultimoEnvio = null;
let sesionEnStripe = null;
function euroDice(status, datos) {
  global.fetch = function (url, opc) {
    if (String(url).indexOf('api.stripe.com') >= 0) {
      return Promise.resolve({ ok: !!sesionEnStripe, status: sesionEnStripe ? 200 : 404,
        json: function () { return Promise.resolve(sesionEnStripe || { error: { message: 'no such session' } }); } });
    }
    ultimoEnvio = { url: url, opciones: opc, cuerpo: JSON.parse(opc.body) };
    return Promise.resolve({ ok: status >= 200 && status < 300, status: status,
      json: function () { return Promise.resolve(datos); } });
  };
}

(async function () {

  /* -------- firma inventada: no se registra NADA -------- */
  ultimoEnvio = null;
  sesionEnStripe = sesionPagada;
  euroDice(201, { folio: 1 });
  let r = res();
  await handler(pide({ type: 'checkout.session.completed', data: { object: sesionPagada } },
                     { secreto: 'whsec_del_atacante' }), r);
  igual('evento con firma falsa: 400', r._status, 400);
  igual('y NO se llamó a EuroSystem', ultimoEnvio, null);

  /* -------- EL ATAQUE NUEVO: aviso inventado de una sesión que no existe.
     Aunque la firma cuadrara, Stripe dice que no la conoce y no pasa nada. */
  ultimoEnvio = null;
  sesionEnStripe = null;                      // Stripe: «no conozco esa sesión»
  euroDice(201, { folio: 9 });
  r = res();
  await handler(pide({ type: 'checkout.session.completed',
    data: { object: { id: 'cs_test_INVENTADA', payment_status: 'paid', metadata: META } } }), r);
  igual('sesión que Stripe no reconoce: 200 y NO registra', r._status, 200);
  igual('no se llamó a EuroSystem', ultimoEnvio, null);

  /* -------- el aviso MIENTE sobre el estado: Stripe manda -------- */
  ultimoEnvio = null;
  sesionEnStripe = Object.assign({}, sesionPagada, { payment_status: 'unpaid' });
  euroDice(201, { folio: 8 });
  r = res();
  await handler(pide({ type: 'checkout.session.completed',
    data: { object: Object.assign({}, sesionPagada, { payment_status: 'paid' }) } }), r);
  igual('el aviso dice pagado y Stripe dice que no: gana Stripe',
    [r._status, r._json.pendiente], [200, true]);
  igual('no se registró nada', ultimoEnvio, null);

  /* -------- el camino bueno -------- */
  ultimoEnvio = null;
  sesionEnStripe = sesionPagada;
  euroDice(201, { folio: 43773, repetido: false });
  r = res();
  await handler(pide({ type: 'checkout.session.completed', data: { object: sesionPagada } }), r);
  igual('pago real: 200 y folio', [r._status, r._json.folio], [200, 43773]);
  cierto('se llamó a la puerta documentada',
    ultimoEnvio && ultimoEnvio.url.indexOf('/api/contratos/externo') > 0);
  igual('la llave va en la cabecera, no en el cuerpo',
    ultimoEnvio.opciones.headers['x-api-key'], 'llave_de_mentiras');

  const enviado = ultimoEnvio.cuerpo;
  igual('la referencia sale del id de la sesión (idempotencia)',
    enviado.referenciaExterna, 'WEB-cs_test_ABC');
  igual('las fechas llevan zona horaria',
    [enviado.servicio.fechaSalida, enviado.servicio.fechaRegreso],
    ['2026-09-03T08:00:00-06:00', '2026-09-06T18:00:00-06:00']);
  igual('origen y destino van por separado',
    [enviado.servicio.origen, enviado.servicio.destino],
    ['Guadalajara, Jalisco, México', 'Puerto Vallarta, Jalisco, México']);
  igual('la clase de unidad se deduce', enviado.servicio.tipoUnidad, 'SPRINTER');
  igual('el nombre se parte en nombre y apellidos',
    [enviado.cliente.nombre, enviado.cliente.apellidos], ['Juana', 'Pérez López']);
  igual('los montos van completos', [enviado.cobro.montoTotal, enviado.cobro.anticipo], [21700, 4340]);

  /* -------- OXXO: voucher generado, dinero NO entrado -------- */
  ultimoEnvio = null;
  sesionEnStripe = Object.assign({}, sesionPagada, { payment_status: 'unpaid' });
  euroDice(201, { folio: 2 });
  r = res();
  await handler(pide({ type: 'checkout.session.completed',
    data: { object: Object.assign({}, sesionPagada, { payment_status: 'unpaid' }) } }), r);
  igual('OXXO sin pagar: 200 pero NO registra', [r._status, r._json.pendiente], [200, true]);
  igual('no se llamó a EuroSystem', ultimoEnvio, null);

  /* -------- OXXO pagado dias despues: ese SI registra -------- */
  ultimoEnvio = null;
  sesionEnStripe = Object.assign({}, sesionPagada, { payment_method_types: ['oxxo'] });
  euroDice(201, { folio: 44001 });
  r = res();
  await handler(pide({ type: 'checkout.session.async_payment_succeeded',
    data: { object: Object.assign({}, sesionPagada, { payment_method_types: ['oxxo'] }) } }), r);
  igual('OXXO pagado despues: registra', [r._status, r._json.folio], [200, 44001]);

  /* -------- semantica de reintentos -------- */
  sesionEnStripe = sesionPagada;
  euroDice(422, { error: 'validación', detalle: [] });
  r = res();
  await handler(pide({ type: 'checkout.session.completed', data: { object: sesionPagada } }), r);
  igual('EuroSystem rechaza por datos (422): 200, que Stripe NO insista', r._status, 200);

  euroDice(503, { error: 'sin llave' });
  r = res();
  await handler(pide({ type: 'checkout.session.completed', data: { object: sesionPagada } }), r);
  igual('EuroSystem caído (503): 500, que Stripe SI reintente', r._status, 500);

  global.fetch = function () { return Promise.reject(new Error('sin red')); };
  r = res();
  await handler(pide({ type: 'checkout.session.completed', data: { object: sesionPagada } }), r);
  igual('EuroSystem inalcanzable: 500, que Stripe reintente', r._status, 500);

  /* -------- sin llave de EuroSystem: el pago no se pierde -------- */
  sesionEnStripe = sesionPagada;
  euroDice(201, { folio: 7 });
  const llave = process.env.CONTRATOS_API_KEY;
  process.env.CONTRATOS_API_KEY = '';
  r = res();
  await handler(pide({ type: 'checkout.session.completed', data: { object: sesionPagada } }), r);
  igual('sin CONTRATOS_API_KEY: 500 para que Stripe insista tres días', r._status, 500);
  process.env.CONTRATOS_API_KEY = llave;

  /* -------- eventos que no nos tocan -------- */
  euroDice(201, { folio: 3 });
  ultimoEnvio = null;
  r = res();
  await handler(pide({ type: 'customer.created', data: { object: {} } }), r);
  igual('otro evento: 200 y se ignora', [r._status, r._json.ignorado], [200, 'customer.created']);
  igual('sin tocar EuroSystem', ultimoEnvio, null);

  /* -------- el metodo lo filtra la cascara, no la logica -------- */
  /* -------- fechas ilegibles: no se inventa una -------- */
  ultimoEnvio = null;
  sesionEnStripe = Object.assign({}, sesionPagada, { metadata: Object.assign({}, META, { salida: 'el jueves' }) });
  euroDice(201, { folio: 4 });
  r = res();
  await handler(pide({ type: 'checkout.session.completed', data: { object:
    Object.assign({}, sesionPagada, { metadata: Object.assign({}, META, { salida: 'el jueves' }) }) } }), r);
  igual('fecha ilegible: 200 y NO se registra con fecha inventada',
    [r._status, r._json.error], [200, 'fechas ilegibles']);
  igual('no se llamó a EuroSystem', ultimoEnvio, null);

  console.log('\n' + buenas + ' buenas, ' + malas + ' malas');
  process.exit(malas ? 1 : 0);
})();
