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
/* Y un tercero: Resend, desde que el cliente recibe su contrato por correo.
   Se apunta aparte porque lo que se le manda a Resend NO puede confundirse
   con lo que se le manda a EuroSystem. */
let ultimoCorreo = null;
let RESEND_DICE = { ok: true, status: 200, cuerpo: { id: 'em_1' } };
function euroDice(status, datos) {
  global.fetch = function (url, opc) {
    if (String(url).indexOf('api.stripe.com') >= 0) {
      return Promise.resolve({ ok: !!sesionEnStripe, status: sesionEnStripe ? 200 : 404,
        json: function () { return Promise.resolve(sesionEnStripe || { error: { message: 'no such session' } }); } });
    }
    if (String(url).indexOf('api.resend.com') >= 0) {
      ultimoCorreo = { cabeceras: opc.headers, cuerpo: JSON.parse(opc.body) };
      return Promise.resolve({ ok: RESEND_DICE.ok, status: RESEND_DICE.status,
        json: function () { return Promise.resolve(RESEND_DICE.cuerpo); } });
    }
    ultimoEnvio = { url: url, opciones: opc, cuerpo: JSON.parse(opc.body) };
    return Promise.resolve({ ok: status >= 200 && status < 300, status: status,
      json: function () { return Promise.resolve(datos); } });
  };
}

(async function () {

  /* ============================================================
     SIN EL SECRETO NO SE LE CREE A NADIE
     ------------------------------------------------------------
     `.env.example` lo dice desde siempre: «Sin el, /api/webhook-stripe
     contesta 500 y Stripe reintenta hasta tres dias». El codigo hacia
     otra cosa: se saltaba la firma y seguia adelante consultando a
     Stripe. O sea que una variable sin poner APAGABA el primer candado
     en silencio, y el unico aviso era un renglon en el registro.

     No es lo mismo «no pude comprobar la firma porque el entorno me
     parseo el cuerpo» —eso pasa en produccion con todo el trafico bueno
     y por eso se sigue— que «nadie configuro el secreto». Lo segundo es
     una puerta sin cerradura, y se contesta 500: el cobro no se pierde,
     se queda esperando tres dias a que alguien ponga la variable.
     ============================================================ */
  let r = res();
  {
    const guardado = process.env.STRIPE_WEBHOOK_SECRET;
    ultimoEnvio = null;
    sesionEnStripe = sesionPagada;
    euroDice(201, { folio: 1 });

    for (const falta of ['', '   ', undefined]) {
      if (falta === undefined) delete process.env.STRIPE_WEBHOOK_SECRET;
      else process.env.STRIPE_WEBHOOK_SECRET = falta;

      ultimoEnvio = null;
      r = res();
      await handler(pide({ type: 'checkout.session.completed', data: { object: sesionPagada } }), r);
      igual('sin STRIPE_WEBHOOK_SECRET (' + JSON.stringify(falta) + '): 500, no se procesa',
        r._status, 500);
      igual('sin STRIPE_WEBHOOK_SECRET: NO se llamó a EuroSystem', ultimoEnvio, null);
    }

    /* Ni siquiera una reversa, que es lo que mas caro sale dejar pasar. */
    ultimoEnvio = null;
    r = res();
    await handler(pide({ type: 'charge.refunded',
      data: { object: { id: 'ch_1', payment_intent: 'pi_ABC123', amount_refunded: 520000 } } }), r);
    igual('sin secreto, ni una reversa se atiende: 500', r._status, 500);

    process.env.STRIPE_WEBHOOK_SECRET = guardado;
  }

  /* -------- firma inventada: no se registra NADA -------- */
  ultimoEnvio = null;
  sesionEnStripe = sesionPagada;
  euroDice(201, { folio: 1 });
  r = res();
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

  /* ============================================================
     SEMANTICA DE REINTENTOS · UN COBRO NO SE PIERDE NUNCA
     ------------------------------------------------------------
     Aqui esta el defecto mas caro que tuvo este archivo, y estuvo
     escrito como acierto durante semanas:

         «EuroSystem rechaza por datos (422): 200, que Stripe NO insista»

     Eso suena razonable —reintentar mil veces un 422 solo hace
     ruido— y es falso donde importa: EL DINERO YA SE COBRO. Con un
     200, Stripe da el aviso por entregado y NO VUELVE. El contrato
     no existe, el cliente no recibe nada, y lo unico que queda del
     cobro es un renglon de `console.error` que nadie lee.

     Con un 500, Stripe insiste hasta tres dias. Eso le da a la
     oficina tres dias para arreglar la llave o el dato y que el
     contrato se cree solo. Si al tercer dia no se arreglo, el cobro
     esta igual de perdido que antes — pero se tuvieron tres dias
     para no perderlo.

     La idempotencia por `referenciaExterna` (CONTRATOS-API.md §5)
     es lo que hace que insistir sea gratis: el reintento que SI
     entra devuelve el mismo folio con `repetido: true`.

     Y una sola cosa mas, que es la que le toca al cliente: EL
     CORREO NO SALE si el contrato no se creo. Prometerle un
     contrato que no existe es peor que no escribirle.
     ============================================================ */
  /* Con clave de correo puesta: si no, «no salio correo» seria cierto por
     una variable que falta y la asercion no probaria nada. */
  process.env.RESEND_API_KEY = 're_de_mentiras';
  RESEND_DICE = { ok: true, status: 200, cuerpo: { id: 'em_1' } };

  for (const codigo of [400, 422, 401]) {
    ultimoCorreo = null;
    sesionEnStripe = sesionPagada;
    euroDice(codigo, { error: 'no pasa', detalle: [] });
    r = res();
    await handler(pide({ type: 'checkout.session.completed', data: { object: sesionPagada } }), r);
    igual('EuroSystem rechaza (' + codigo + '): 500, que Stripe insista tres dias', r._status, 500);
    igual('EuroSystem rechaza (' + codigo + '): y NUNCA 200', r._status === 200, false);
    igual('EuroSystem rechaza (' + codigo + '): NO se le promete al cliente un contrato que no existe',
      ultimoCorreo, null);
  }

  /* El reintento que SI entra: EuroSystem contesta «ya existia». No se
     duplica nada —mismo folio— y de ahi en adelante todo sigue como en el
     camino bueno: correo al cliente y 200 para que Stripe se quede en paz. */
  ultimoCorreo = null;
  sesionEnStripe = sesionPagada;
  euroDice(200, { folio: 51099, repetido: true, pdfBase64: 'JVBERi0xLjMK' });
  r = res();
  await handler(pide({ type: 'checkout.session.completed', data: { object: sesionPagada } }), r);
  igual('reintento con contrato ya creado: 200 y el MISMO folio',
    [r._status, r._json.folio, r._json.repetido], [200, 51099, true]);
  cierto('y el correo al cliente si sale, una sola vez', !!ultimoCorreo);
  igual('al correo del cliente', ultimoCorreo.cuerpo.to, ['quien@sea.mx']);

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

  /* ============================================================
     EL CORREO AL CLIENTE
     ------------------------------------------------------------
     Hasta hoy el cliente pagaba y no recibia NADA, mientras la
     pantalla le prometia «te mandamos el folio y las
     instrucciones». Esto comprueba que ahora si sale, y que sale
     DESPUES de crear el contrato y con su folio.
     ============================================================ */
  process.env.RESEND_API_KEY = 're_de_mentiras';

  /* -------- el camino bueno: contrato creado y correo enviado -------- */
  ultimoEnvio = null; ultimoCorreo = null;
  sesionEnStripe = sesionPagada;
  RESEND_DICE = { ok: true, status: 200, cuerpo: { id: 'em_ok' } };
  euroDice(201, { folio: 51001, pdfBase64: 'JVBERi0xLjMK' });
  r = res();
  await handler(pide({ type: 'checkout.session.completed', data: { object: sesionPagada } }), r);

  igual('pago con correo: 200 y lo acusa', [r._status, r._json.correo], [200, true]);
  cierto('se le pidió el PDF a EuroSystem', ultimoEnvio.cuerpo.incluirPdf === true);
  cierto('salió el correo', !!ultimoCorreo);
  igual('al correo del cliente', ultimoCorreo.cuerpo.to, ['quien@sea.mx']);
  /* --------------------------------------------------------------
     UN SOLO FOLIO PARA EL CLIENTE, Y ES EL DE LA PAGINA

     Esta asercion cambio de lado. Pedia que el asunto llevara el folio de
     EuroSystem, y con eso el cliente terminaba con DOS numeros para el
     mismo viaje: el correo decia «folio 51001» y su pantalla de viaje
     decia «ET-K3M9-4Q2». Y el `ET-` es el que ya vio en la pantalla de
     pago, antes de que llegara ningun correo.

     Ahora el folio es uno solo en los tres lados —pantalla de pago,
     correo y pantalla del viaje— y el numero de contrato va aparte, en
     chico, porque ese si aparece en el PDF adjunto.
     -------------------------------------------------------------- */
  cierto('el asunto lleva el folio de la página, el que el cliente ya vio',
    ultimoCorreo.cuerpo.subject.indexOf('ET-K3M9-4Q2') >= 0);
  cierto('y el número de contrato va dentro, para reconocer el PDF',
    ultimoCorreo.cuerpo.text.indexOf('Contrato 51001') >= 0);
  cierto('y el contrato adjunto', ultimoCorreo.cuerpo.attachments &&
    ultimoCorreo.cuerpo.attachments[0].content === 'JVBERi0xLjMK');

  /* La metadata de Stripe trae `km`. El correo NO puede llevarlo. */
  igual('y sin kilometraje ni tarifa en el correo',
    JSON.stringify(ultimoCorreo.cuerpo).match(/\bkm\b|kilometr|tarifa|621\.2/i), null);

  /* -------- el correo falla, pero es pasajero: que Stripe reintente --------
     El contrato YA existe. Crearlo otra vez es idempotente —EuroSystem
     contesta «ya existia»—, asi que reintentar no duplica y le da al correo
     mas oportunidades durante tres dias. */
  ultimoCorreo = null;
  RESEND_DICE = { ok: false, status: 500, cuerpo: { message: 'internal' } };
  euroDice(201, { folio: 51002, pdfBase64: 'JVBERi0xLjMK' });
  r = res();
  await handler(pide({ type: 'checkout.session.completed', data: { object: sesionPagada } }), r);
  igual('Resend caído: 500 para que Stripe reintente', r._status, 500);
  igual('y se dice qué folio quedó sin correo', r._json.folio, 51002);

  /* -------- el correo falla y NO se arregla esperando --------
     Dominio sin verificar. Reintentar tres dias seria tener a Stripe
     golpeando una puerta que no va a abrir. Se acusa recibo y se grita en
     el registro para mandarlo a mano. */
  RESEND_DICE = { ok: false, status: 403, cuerpo: { message: 'domain is not verified' } };
  euroDice(201, { folio: 51003, pdfBase64: 'JVBERi0xLjMK' });
  r = res();
  await handler(pide({ type: 'checkout.session.completed', data: { object: sesionPagada } }), r);
  igual('dominio sin verificar: 200, no se reintenta', r._status, 200);
  igual('y se acusa que el correo no salió', r._json.correo, false);
  igual('pero el folio no se pierde', r._json.folio, 51003);

  /* -------- sin RESEND_API_KEY el contrato SIGUE registrándose --------
     El correo es lo nuevo; no puede tumbar lo que ya funcionaba. */
  delete process.env.RESEND_API_KEY;
  ultimoCorreo = null;
  euroDice(201, { folio: 51004 });
  r = res();
  await handler(pide({ type: 'checkout.session.completed', data: { object: sesionPagada } }), r);
  igual('sin clave de correo: el contrato se registra igual', [r._status, r._json.folio], [200, 51004]);
  igual('no se intentó mandar nada', ultimoCorreo, null);
  igual('y no se le pide a Stripe que reintente por una variable que falta',
    r._json.correo, false);

  /* ============================================================
     UN ABONO DEL CLIENTE NO ES UNA COMPRA NUEVA
     ------------------------------------------------------------
     Hasta hoy, un cobro con `tipo: 'abono'` caía en la rama de los
     contratos: se armaba un contrato con la metadata de un abono
     —sin nombre, sin fechas—, la revisión de «fechas ilegibles»
     contestaba 200 y EL DINERO SE PERDIA EN SILENCIO. El cliente
     abonaba, Stripe cobraba, y en EuroSystem no aparecía nada.

     Ahora tiene su propia rama, y lo que se juega es lo de siempre:

       1. se registra en EuroSystem por la puerta de §13, con el
          `pi_…` como referencia —EL MISMO que usa la reversa, que
          es lo que hace idempotente a las dos puertas—
       2. si esa puerta dice que no, 500: que Stripe insista tres
          días. El dinero ya se cobró.
       3. y EL CORREO AL CLIENTE VA DESPUES de registrar, para que
          el reintento no le escriba dos veces
       4. NUNCA se crea un contrato con un abono
     ============================================================ */
  process.env.RESEND_API_KEY = 're_de_mentiras';
  RESEND_DICE = { ok: true, status: 200, cuerpo: { id: 'em_abono' } };

  /* Un abono del portal: lleva el número de contrato de EuroSystem y el
     `pi_…` del cobro, y NO lleva folio de la página. */
  const sesionDeAbono = {
    id: 'cs_test_ABONO', payment_status: 'paid', payment_method_types: ['card'],
    payment_intent: 'pi_DEL_ABONO', amount_total: 500000,
    customer_details: { email: 'quien@sea.mx' },
    metadata: { tipo: 'abono', contrato: '43773', monto: '5000', origen: 'WEB-PORTAL' }
  };

  /* Los envíos, separados por puerta: el de contratos no puede confundirse
     con el de abonos, que es justo el defecto que se está tapando. */
  let AEUROSYSTEM = [];
  function euroDiceAlAbono(status, datos) {
    AEUROSYSTEM = [];
    global.fetch = function (url, opc) {
      const u = String(url);
      if (u.indexOf('api.stripe.com') >= 0) {
        return Promise.resolve({ ok: !!sesionEnStripe, status: sesionEnStripe ? 200 : 404,
          json: function () { return Promise.resolve(sesionEnStripe || { error: { message: 'no' } }); } });
      }
      if (u.indexOf('api.resend.com') >= 0) {
        ultimoCorreo = { cabeceras: opc.headers, cuerpo: JSON.parse(opc.body) };
        return Promise.resolve({ ok: RESEND_DICE.ok, status: RESEND_DICE.status,
          json: function () { return Promise.resolve(RESEND_DICE.cuerpo); } });
      }
      AEUROSYSTEM.push({ url: u, cuerpo: JSON.parse(opc.body) });
      return Promise.resolve({ ok: status >= 200 && status < 300, status: status,
        json: function () { return Promise.resolve(datos); } });
    };
  }
  function laDelAbono() {
    return AEUROSYSTEM.filter(function (l) { return l.url.indexOf('/abono-externo') > 0; })[0];
  }
  function alosCorreos(quien) {
    return ultimoCorreo && ultimoCorreo.cuerpo.to.indexOf(quien) >= 0;
  }

  /* -------- el camino bueno -------- */
  ultimoCorreo = null;
  sesionEnStripe = sesionDeAbono;
  euroDiceAlAbono(201, { registrado: true });
  r = res();
  await handler(pide({ type: 'checkout.session.completed', data: { object: sesionDeAbono } }), r);

  igual('abono pagado: 200 y lo dice', [r._status, r._json.abono], [200, true]);
  cierto('se llamó a la puerta de abonos de §13', !!laDelAbono());
  igual('  y NUNCA a la de contratos',
    AEUROSYSTEM.filter(function (l) { return l.url.indexOf('/contratos/externo') > 0; }).length, 0);

  {
    const enviado = laDelAbono().cuerpo;
    igual('el folio que se manda es el NÚMERO DE CONTRATO de EuroSystem',
      enviado.folio, 43773);
    igual('el monto es lo que de verdad se cobró, en pesos', enviado.monto, 5000);
    igual('la referencia es el mismo pi_ que usa la reversa',
      enviado.referencia, 'pi_DEL_ABONO');
    cierto('y la fecha lleva zona horaria', /[+-]\d{2}:\d{2}$/.test(String(enviado.fecha)));
    igual('no se manda nada más', Object.keys(enviado).sort(),
      ['fecha', 'folio', 'monto', 'referencia']);
  }

  cierto('le llega su comprobante al cliente', alosCorreos('quien@sea.mx'));
  cierto('  y dice cuánto abonó',
    ultimoCorreo.cuerpo.text.indexOf('5,000') >= 0 ||
    ultimoCorreo.cuerpo.text.indexOf('5000') >= 0);

  /* -------- el reintento que ya estaba registrado -------- */
  ultimoCorreo = null;
  euroDiceAlAbono(200, { repetido: true });
  r = res();
  await handler(pide({ type: 'checkout.session.completed', data: { object: sesionDeAbono } }), r);
  igual('«ya estaba registrado»: 200 y no se duplica',
    [r._status, r._json.repetido], [200, true]);

  /* -------- EuroSystem dice que no: el cobro NO se pierde -------- */
  for (const codigo of [404, 422, 401, 500]) {
    ultimoCorreo = null;
    euroDiceAlAbono(codigo, { error: 'no' });
    r = res();
    await handler(pide({ type: 'checkout.session.completed', data: { object: sesionDeAbono } }), r);
    igual('EuroSystem rechaza el abono (' + codigo + '): 500 para que Stripe insista',
      r._status, 500);
    igual('EuroSystem rechaza el abono (' + codigo + '): NO se le escribe al cliente todavía',
      ultimoCorreo, null);
  }

  /* -------- EuroSystem inalcanzable -------- */
  ultimoCorreo = null;
  global.fetch = function (url) {
    if (String(url).indexOf('api.stripe.com') >= 0) {
      return Promise.resolve({ ok: true, status: 200,
        json: function () { return Promise.resolve(sesionDeAbono); } });
    }
    return Promise.reject(new Error('sin red'));
  };
  r = res();
  await handler(pide({ type: 'checkout.session.completed', data: { object: sesionDeAbono } }), r);
  igual('EuroSystem inalcanzable: 500, que Stripe reintente', r._status, 500);
  igual('  y sin correo al cliente', ultimoCorreo, null);

  /* -------- un abono SIN número de contrato --------
     Son los de la pantalla del viaje, que salen de una liga y no conocen el
     número de EuroSystem. Reintentar no arregla una metadata que no va a
     cambiar nunca, así que se avisa a la oficina y se acusa recibo. */
  {
    const sinContrato = Object.assign({}, sesionDeAbono, {
      id: 'cs_test_ABONO_VIEJO',
      metadata: { tipo: 'abono', folio: 'ET-K3M9-4Q2', monto: '5000', origen: 'WEB' }
    });
    ultimoCorreo = null;
    sesionEnStripe = sinContrato;
    euroDiceAlAbono(201, { registrado: true });
    r = res();
    await handler(pide({ type: 'checkout.session.completed', data: { object: sinContrato } }), r);
    igual('abono sin número de contrato: 200, no se reintenta en balde', r._status, 200);
    igual('  y NO se le inventa un folio a EuroSystem', AEUROSYSTEM.length, 0);
    cierto('  pero la oficina se entera', !!ultimoCorreo);
  }

  /* -------- un abono de PRUEBA no se registra -------- */
  {
    const dePrueba = Object.assign({}, sesionDeAbono, { livemode: false });
    ultimoCorreo = null;
    sesionEnStripe = dePrueba;
    euroDiceAlAbono(201, { registrado: true });
    r = res();
    await handler(pide({ type: 'checkout.session.completed', data: { object: dePrueba } }), r);
    igual('abono con tarjeta de prueba: 200 y NO se registra',
      [r._status, AEUROSYSTEM.length], [200, 0]);
  }

  /* -------- un abono sin pagar (voucher de OXXO) no registra nada -------- */
  {
    const sinPagar = Object.assign({}, sesionDeAbono, { payment_status: 'unpaid' });
    sesionEnStripe = sinPagar;
    euroDiceAlAbono(201, { registrado: true });
    r = res();
    await handler(pide({ type: 'checkout.session.completed', data: { object: sinPagar } }), r);
    igual('abono con voucher sin pagar: 200 y NO se registra',
      [r._status, AEUROSYSTEM.length], [200, 0]);
  }

  console.log('\n' + buenas + ' buenas, ' + malas + ' malas');
  process.exit(malas ? 1 : 0);
})();
