/* ============================================================
   Lo que se cotiza es lo que se cobra
   ------------------------------------------------------------
       node pruebas/probar-cotiza-vs-cobra.cjs

   Invoca los DOS endpoints de verdad —/api/cotizar y /api/pagar—
   con el mismo viaje, fingiendo a Google y a Stripe, y exige que
   el total coincida al peso.

   Es la prueba que mas vale de todas: si el cliente ve un precio
   en pantalla y en la pantalla de cobro le sale otro, da igual
   que las dos cuentas esten bien por separado.
   ============================================================ */
'use strict';

let buenas = 0, malas = 0;
function igual(nombre, dio, esperado) {
  const a = JSON.stringify(dio), b = JSON.stringify(esperado);
  if (a === b) { buenas++; console.log('ok   ' + nombre); }
  else { malas++; console.log('MAL  ' + nombre + '\n     dio      ' + a + '\n     esperaba ' + b); }
}

process.env.GOOGLE_ROUTES_KEY = 'de_mentiras';
process.env.STRIPE_SECRET_KEY = 'sk_test_de_mentiras';

const cotizar = require('../api/cotizar.js');
const pagar = require('../api/pagar.js');

/* Google y Stripe, fingidos. Google contesta los metros que se le pidan;
   Stripe contesta una sesion cualquiera con su URL. */
let METROS_IDA = 0, METROS_VUELTA = 0;
let vueltaPedida = false;
global.fetch = function (url, opc) {
  const u = String(url);
  if (u.indexOf('routes.googleapis.com') >= 0) {
    const cuerpo = JSON.parse(opc.body);
    /* Se distingue ida de vuelta por el orden de los puntos: la vuelta
       invierte origen y destino. */
    const esVuelta = JSON.stringify(cuerpo.origin).indexOf('DESTINO') >= 0;
    if (esVuelta) vueltaPedida = true;
    return Promise.resolve({ ok: true, json: () => Promise.resolve({
      routes: [{ distanceMeters: esVuelta ? METROS_VUELTA : METROS_IDA, duration: '1000s' }]
    }) });
  }
  if (u.indexOf('api.stripe.com') >= 0) {
    return Promise.resolve({ ok: true, json: () => Promise.resolve({
      id: 'cs_test_x', url: 'https://checkout.stripe.com/x'
    }) });
  }
  return Promise.reject(new Error('destino inesperado: ' + u));
};

const CABECERAS = { origin: 'https://eurotravel-web.vercel.app', 'x-vercel-forwarded-for': '1.2.3.4' };

function res() {
  const r = { _status: null, _json: null };
  r.status = function (s) { r._status = s; return r; };
  r.json = function (j) { r._json = j; return r; };
  r.end = function () { return r; };
  return r;
}

/* Los puntos llevan una marca para poder distinguir ida de vuelta arriba. */
const ORIGEN = { placeId: 'ChIJ_ORIGEN_x', lat: 20.6597, lng: -103.3496, direccion: 'Guadalajara' };
const DESTINO = { placeId: 'ChIJ_DESTINO_x', lat: 20.6534, lng: -105.2253, direccion: 'Puerto Vallarta' };

async function corre(metrosIda, metrosVuelta, salida, regreso) {
  METROS_IDA = metrosIda; METROS_VUELTA = metrosVuelta;
  /* El cache de _rutas guarda por par de puntos; se le cambia la marca en cada
     corrida para que vuelva a "medir" y no conteste lo de la vez pasada. */
  const marca = 'k' + metrosIda + '_' + metrosVuelta;
  const o = Object.assign({}, ORIGEN, { placeId: ORIGEN.placeId + marca });
  const d = Object.assign({}, DESTINO, { placeId: DESTINO.placeId + marca });

  const cuerpo = { origen: o, destino: d, salida: salida, regreso: regreso, redondo: !!regreso };

  const r1 = res();
  await cotizar({ method: 'POST', headers: CABECERAS, body: cuerpo }, r1);

  const r2 = res();
  await pagar({ method: 'POST', headers: CABECERAS, body: Object.assign({}, cuerpo, {
    nombre: 'Quien Sea', correo: 'x@y.mx', telefono: '3300000000',
    canal: 'correo', unidad: 'Sprinter', rutaTexto: 'A a B'
  }) }, r2);

  return { cotiza: r1._json, cobra: r2._json, estados: [r1._status, r2._status] };
}

(async function () {
  const VIAJES = [
    ['Vallarta redondo, 4 días', 311400, 309800, '2026-09-03T08:00', '2026-09-06T18:00'],
    ['justo en 800 km', 400000, 400000, '2026-09-03T08:00', '2026-09-05T18:00'],
    ['un metro pasado de 800 km', 400000, 400001, '2026-09-03T08:00', '2026-09-05T18:00'],
    ['justo en 1,000 km', 500000, 500000, '2026-09-03T08:00', '2026-09-07T18:00'],
    ['un metro pasado de 1,000 km', 500000, 500001, '2026-09-03T08:00', '2026-09-07T18:00'],
    ['los tres tramos, 1,210 km', 610000, 600000, '2026-09-03T08:00', '2026-09-07T18:00'],
    ['viaje corto: manda el mínimo', 40000, 40000, '2026-09-03T08:00', '2026-09-08T18:00'],
    ['solo ida', 750000, 0, '2026-09-03T08:00', ''],
    ['distancias impares', 333333, 444447, '2026-09-03T08:00', '2026-09-06T18:00'],
    ['viaje muy largo', 1400000, 1399999, '2026-09-03T08:00', '2026-09-14T18:00']
  ];

  let cuadran = 0;
  const fallas = [];

  for (const [nombre, ida, vuelta, salida, regreso] of VIAJES) {
    const r = await corre(ida, vuelta, salida, regreso);
    const a = r.cotiza, b = r.cobra;
    const mismoTotal = a && b && a.total === b.total;
    const mismoAnticipo = a && b && a.anticipo === b.anticipo;
    const mismoSaldo = a && b && a.saldo === b.saldo;

    if (mismoTotal && mismoAnticipo && mismoSaldo) {
      cuadran++;
      console.log('ok   ' + nombre.padEnd(30) + ' $' + String(a.total).padStart(6) +
        '  anticipo $' + String(a.anticipo).padStart(5));
      buenas++;
    } else {
      malas++;
      fallas.push({ nombre, cotiza: a, cobra: b, estados: r.estados });
      console.log('MAL  ' + nombre + '\n     cotiza ' + JSON.stringify(a) + '\n     cobra  ' + JSON.stringify(b));
    }
  }

  igual('los ' + VIAJES.length + ' viajes: cotizar y cobrar dan lo mismo', cuadran, VIAJES.length);

  /* Y que el cotizador no filtre el kilometraje, ni siquiera en los bordes. */
  const r = await corre(610000, 600000, '2026-09-03T08:00', '2026-09-07T18:00');
  igual('el cotizador no manda km ni tarifa',
    JSON.stringify(r.cotiza).match(/km|tarifa|tramo|1210|610/i), null);
  igual('el cobro tampoco',
    JSON.stringify(r.cobra).match(/\bkm\b|tarifa|tramo|1210/i), null);

  console.log('\n' + buenas + ' buenas, ' + malas + ' malas');
  process.exit(malas ? 1 : 0);
})();
