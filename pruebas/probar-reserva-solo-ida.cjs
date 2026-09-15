/* ============================================================
   EL SOLO IDA SE COBRABA Y NO SE REGISTRABA (15-sep-2026)
   ============================================================
       node pruebas/probar-reserva-solo-ida.cjs

   La página manda `regreso: ''` cuando el viaje es solo ida, y
   `/api/pagar` lo cobra bien: el precio de un sentido. Pero el
   webhook convertía ese regreso vacío en una fecha vacía, y la
   revisión «fechas ilegibles» contestaba 200 y se iba:

     · el dinero YA estaba cobrado,
     · NO se creaba contrato en EuroSystem,
     · NO salía el correo al cliente,
     · y Stripe no reintentaba, porque le dijimos 200.

   Y además `tipoViaje` iba fijo en 'REDONDO'.

   Lo que pide la puerta —`../EUROSYSTEM/CONTRATOS-API.md` §2 y
   `src/lib/contratos/tipos.ts`—:

     fechaRegreso  OBLIGATORIA, con zona, y POSTERIOR a la salida
     tipoViaje     'REDONDO' | 'SENCILLO'

   Así que el solo ida viaja como SENCILLO, con el regreso al cierre
   del mismo día de la salida (23:59:59), igual que ya lo resolvió el
   bot el 10-sep-2026 para los viajes de un día. Y se dice en las
   observaciones que esa hora no es un acuerdo.

   Esta prueba corre en MODO REAL (`livemode: true`): el modo prueba
   no toca EuroSystem y no habría visto el defecto.
   ============================================================ */
'use strict';

let buenas = 0, malas = 0;
function igual(nombre, dio, esperado) {
  const a = JSON.stringify(dio), b = JSON.stringify(esperado);
  if (a === b) { buenas++; console.log('ok   ' + nombre); }
  else { malas++; console.log('MAL  ' + nombre + '\n     dio      ' + a + '\n     esperaba ' + b); }
}
function cierto(nombre, v) { igual(nombre, !!v, true); }

process.env.STRIPE_WEBHOOK_SECRET = '';          // cuerpo como objeto: se consulta a Stripe
process.env.CONTRATOS_API_KEY = 'llave_de_mentiras';
process.env.STRIPE_SECRET_KEY = 'sk_test_de_mentiras';
process.env.RESEND_API_KEY = 're_de_mentiras';
process.env.LIGAS_SECRETO = 'secreto_de_ligas_de_mentiras';

const logica = require('../api/_webhook-logica.js');
const correo = require('../api/_correo.js');

/* Una fecha lejana a propósito: una prueba con fecha cercana caduca con el
   calendario (ya pasó en este proyecto). */
const META_SOLO_IDA = {
  folio: 'ET-S0L0-1DA', nombre: 'Rosa Martínez Gil', telefono: '3312345678',
  correo: 'rosa@ejemplo.mx', canal: 'correo', ruta: 'Guadalajara → Puerto Vallarta',
  origen: 'Guadalajara, Jalisco, México', destino: 'Puerto Vallarta, Jalisco, México',
  unidad: 'Sprinter', salida: '2030-03-20T08:00', regreso: '',
  viaje: 'SENCILLO',
  dias: '1', km: '640', total: '12350', anticipo: '2500', saldo: '9850'
};

function sesionDe(meta, id) {
  return {
    id: id, livemode: true, payment_status: 'paid', status: 'complete',
    payment_method_types: ['card'], metadata: meta,
    customer_details: { email: meta.correo }
  };
}

let sesionEnStripe = null;
let alSistema = null;
let alCorreo = null;
function finge(folio) {
  alSistema = null; alCorreo = null;
  global.fetch = function (url, opc) {
    const u = String(url);
    if (u.indexOf('api.stripe.com') >= 0) {
      return Promise.resolve({ ok: !!sesionEnStripe, status: sesionEnStripe ? 200 : 404,
        json: function () { return Promise.resolve(sesionEnStripe || { error: { message: 'no' } }); } });
    }
    if (u.indexOf('api.resend.com') >= 0) {
      alCorreo = JSON.parse(opc.body);
      return Promise.resolve({ ok: true, status: 200, json: function () { return Promise.resolve({ id: 'em_1' }); } });
    }
    alSistema = { url: u, cuerpo: JSON.parse(opc.body) };
    return Promise.resolve({ ok: true, status: 201,
      json: function () { return Promise.resolve({ folio: folio, repetido: false, pdfBase64: 'JVBERi0xLjMK' }); } });
  };
}

function venceLaLiga(texto) {
  const m = /viaje\.html\?t=([A-Za-z0-9_-]+)\./.exec(texto || '');
  if (!m) return 0;
  const b64 = m[1].replace(/-/g, '+').replace(/_/g, '/');
  try { return JSON.parse(Buffer.from(b64, 'base64').toString('utf8')).e || 0; }
  catch (e) { return 0; }
}

(async function () {

  /* ================= EL CUERPO QUE SE ARMA ================= */
  {
    const c = logica.contratoDesde(META_SOLO_IDA, { id: 'cs_live_SOLOIDA1' });
    igual('solo ida: tipoViaje SENCILLO', c.servicio.tipoViaje, 'SENCILLO');
    igual('la salida lleva zona', c.servicio.fechaSalida, '2030-03-20T08:00:00-06:00');
    igual('el regreso es el cierre del mismo día, con zona',
      c.servicio.fechaRegreso, '2030-03-20T23:59:59-06:00');
    cierto('y es POSTERIOR a la salida, que es lo que exige EuroSystem',
      Date.parse(c.servicio.fechaRegreso) > Date.parse(c.servicio.fechaSalida));
    cierto('las observaciones dicen que es solo ida',
      /solo ida/i.test(c.observaciones));
    cierto('y que la hora de regreso no es un acuerdo',
      /23:59/.test(c.observaciones));
  }

  /* Una sesión pagada ANTES de este arreglo no trae `viaje`. Su regreso vacío
     basta: `/api/pagar` cobra solo ida justamente cuando no hay regreso
     (`redondo = cuerpo.redondo !== false && !!cuerpo.regreso`). */
  {
    const vieja = Object.assign({}, META_SOLO_IDA);
    delete vieja.viaje;
    const c = logica.contratoDesde(vieja, { id: 'cs_live_VIEJA' });
    igual('sesión vieja sin `viaje`, sin regreso: también SENCILLO',
      [c.servicio.tipoViaje, c.servicio.fechaRegreso],
      ['SENCILLO', '2030-03-20T23:59:59-06:00']);
  }

  /* Una salida tan tarde que el cierre del día no le queda después: se pasa
     al día siguiente en vez de mandar un regreso igual a la salida (422). */
  {
    const tarde = Object.assign({}, META_SOLO_IDA, { salida: '2030-03-31T23:59:59' });
    const c = logica.contratoDesde(tarde, { id: 'cs_live_TARDE' });
    cierto('salida a las 23:59:59: el regreso igual queda después (' + c.servicio.fechaRegreso + ')',
      Date.parse(c.servicio.fechaRegreso) > Date.parse(c.servicio.fechaSalida));
  }

  /* El redondo NO cambia. */
  {
    const redondo = Object.assign({}, META_SOLO_IDA, { regreso: '2030-03-23T18:00', viaje: 'REDONDO', dias: '4' });
    const c = logica.contratoDesde(redondo, { id: 'cs_live_REDONDO' });
    igual('redondo: sigue REDONDO con su regreso',
      [c.servicio.tipoViaje, c.servicio.fechaRegreso],
      ['REDONDO', '2030-03-23T18:00:00-06:00']);
    igual('y sin la nota de solo ida', /solo ida/i.test(c.observaciones), false);
  }

  /* ================= EL WEBHOOK COMPLETO, EN MODO REAL ================= */
  {
    sesionEnStripe = sesionDe(META_SOLO_IDA, 'cs_live_SOLOIDA1');
    finge(52001);
    const r = await logica.procesa(
      { type: 'checkout.session.completed', data: { object: { id: 'cs_live_SOLOIDA1' } } }, '');

    igual('solo ida pagado: 200 con folio, no «fechas ilegibles»',
      [r.status, r.cuerpo.folio, r.cuerpo.error], [200, 52001, undefined]);
    cierto('SÍ se llamó a la puerta de contratos',
      alSistema && alSistema.url.indexOf('/api/contratos/externo') > 0);
    const s = (alSistema && alSistema.cuerpo.servicio) || {};
    igual('con tipoViaje SENCILLO', s.tipoViaje, 'SENCILLO');
    igual('con las dos fechas que pide la puerta',
      [s.fechaSalida, s.fechaRegreso],
      ['2030-03-20T08:00:00-06:00', '2030-03-20T23:59:59-06:00']);
    igual('y los montos cobrados', [alSistema && alSistema.cuerpo.cobro.montoTotal,
      alSistema && alSistema.cuerpo.cobro.anticipo], [12350, 2500]);

    cierto('SÍ salió el correo al cliente', !!alCorreo);
    igual('a su correo', alCorreo && alCorreo.to, ['rosa@ejemplo.mx']);
    cierto('el correo dice «Solo ida»', alCorreo && /Solo ida/.test(alCorreo.text) && /Solo ida/.test(alCorreo.html));

    /* La liga del viaje vence 90 días después del regreso. Sin regreso vencía
       a los 30 días de HOY, y un viaje a seis meses se quedaba sin liga
       antes de salir. Para el solo ida se cuenta desde la salida. */
    const vence = venceLaLiga(alCorreo && alCorreo.text);
    cierto('la liga del solo ida vence después de la salida, no a los 30 días',
      vence > Date.UTC(2030, 2, 20));
  }

  /* ================= EL CORREO, SUELTO ================= */
  {
    const m = correo.mensajeDeContrato(Object.assign({}, META_SOLO_IDA), null, '');
    cierto('mensaje de solo ida: renglón «Solo ida»', /Solo ida/.test(m.text));
    const mr = correo.mensajeDeContrato(Object.assign({}, META_SOLO_IDA,
      { regreso: '2030-03-23T18:00', viaje: 'REDONDO' }), null, '');
    igual('el redondo no dice «Solo ida»', /Solo ida/.test(mr.text), false);
  }

  /* ================= /api/pagar: lo que se cobra y lo que anota =================
     El precio del solo ida lo vuelve a sacar el servidor; aquí se exige que
     sea el MISMO que enseñó /api/cotizar y que la sesión de Stripe se lleve
     escrito que el viaje es SENCILLO, para que el webhook no tenga que
     adivinarlo. El interruptor se enciende aquí para poder comparar cuentas
     (cero contra cero no prueba nada). */
  {
    process.env.GOOGLE_ROUTES_KEY = 'de_mentiras';
    const tarifa = require('../api/_tarifa.js');
    const antes = tarifa.PAGINA_DA_PRECIOS;
    tarifa.PAGINA_DA_PRECIOS = true;
    const cotizar = require('../api/cotizar.js');
    const pagar = require('../api/pagar.js');

    let alStripe = null;
    global.fetch = function (url, opc) {
      const u = String(url);
      if (u.indexOf('routes.googleapis.com') >= 0) {
        return Promise.resolve({ ok: true, json: function () { return Promise.resolve({
          routes: [{ distanceMeters: 330000, duration: '14000s' }] }); } });
      }
      if (u.indexOf('api.stripe.com') >= 0) {
        alStripe = new URLSearchParams(opc.body);
        return Promise.resolve({ ok: true, json: function () { return Promise.resolve({
          id: 'cs_test_x', url: 'https://checkout.stripe.com/x' }); } });
      }
      return Promise.reject(new Error('inesperado: ' + u));
    };
    function res() {
      const r = { _status: null, _json: null };
      r.status = function (s) { r._status = s; return r; };
      r.json = function (j) { r._json = j; return r; };
      r.end = function () { return r; };
      return r;
    }
    const cab = { origin: 'https://eurotravel-web.vercel.app', 'x-vercel-forwarded-for': '10.9.9.9' };
    const viaje = {
      origen: { placeId: 'ChIJ_O_si', lat: 20.66, lng: -103.35, direccion: 'Guadalajara, Jalisco, México' },
      destino: { placeId: 'ChIJ_D_si', lat: 20.65, lng: -105.22, direccion: 'Puerto Vallarta, Jalisco, México' },
      salida: '2030-03-20T08:00', regreso: '', redondo: false, unidad: 'Sprinter'
    };
    const r1 = res();
    await cotizar({ method: 'POST', headers: cab, body: Object.assign({}, viaje) }, r1);
    const r2 = res();
    await pagar({ method: 'POST', headers: cab, body: Object.assign({}, viaje, {
      nombre: 'Rosa Martínez', correo: 'rosa@ejemplo.mx', telefono: '3312345678',
      rutaTexto: 'Guadalajara → Puerto Vallarta', puntoSalida: 'Afuera del Tec', pasajeros: 12
    }) }, r2);

    igual('solo ida a Vallarta: cotiza y cobra (200 y 200)', [r1._status, r2._status], [200, 200]);
    cierto('cotizar lo da como solo ida', r1._json && r1._json.redondo === false);
    igual('se cobra el mismo total que se enseñó', r2._json && r2._json.total, r1._json && r1._json.total);
    igual('y el mismo anticipo', r2._json && r2._json.anticipo, r1._json && r1._json.anticipo);
    igual('la sesión de Stripe anota el viaje como SENCILLO',
      alStripe && alStripe.get('metadata[viaje]'), 'SENCILLO');
    igual('con el regreso vacío, como llegó', alStripe && alStripe.get('metadata[regreso]'), '');
    igual('y el total anotado es el cobrado',
      alStripe && Number(alStripe.get('metadata[total]')), r2._json && r2._json.total);

    tarifa.PAGINA_DA_PRECIOS = antes;
  }

  console.log('\n' + buenas + ' buenas, ' + malas + ' malas');
  process.exit(malas ? 1 : 0);
})();
