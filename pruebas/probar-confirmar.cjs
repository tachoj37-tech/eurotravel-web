/* ============================================================
   Pruebas del verificador de pagos — sin red
   ------------------------------------------------------------
       node pruebas/probar-confirmar.cjs

   Stripe va fingido: se le pone un `fetch` de mentiras y se
   comprueba lo que de verdad importa —que un pago sin pagar
   nunca salga como pagado, y que el kilometraje que Stripe
   guarda en la metadata NO llegue al navegador—.
   ============================================================ */
'use strict';

let buenas = 0, malas = 0;
function igual(nombre, dio, esperado) {
  const a = JSON.stringify(dio), b = JSON.stringify(esperado);
  if (a === b) { buenas++; console.log('ok   ' + nombre); }
  else { malas++; console.log('MAL  ' + nombre + '\n     dio      ' + a + '\n     esperaba ' + b); }
}
function cierto(nombre, v) { igual(nombre, !!v, true); }

process.env.STRIPE_SECRET_KEY = 'sk_test_DE_MENTIRAS_000';
const confirmar = require('../api/confirmar.js');

const ORIGEN = { origin: 'https://eurotravel-web.vercel.app', 'x-vercel-forwarded-for': '5.5.5.5' };

function res() {
  const r = { _status: null, _json: null };
  r.status = function (s) { r._status = s; return r; };
  r.json = function (j) { r._json = j; return r; };
  r.end = function () { return r; };
  return r;
}

/* Stripe fingido: contesta lo que se le diga */
function stripeDice(respuesta, ok) {
  global.fetch = function () {
    return Promise.resolve({
      ok: ok !== false,
      json: function () { return Promise.resolve(respuesta); }
    });
  };
}

/* La metadata REAL que pagar.js guarda — incluye km, que no debe salir */
const META = {
  folio: 'ET-K3M9-4Q2', nombre: 'Quien sea', telefono: '3300000000',
  canal: 'correo', ruta: 'Guadalajara a Puerto Vallarta', unidad: 'Sprinter',
  salida: '2026-09-03', regreso: '2026-09-06', dias: '4',
  km: '621.2', total: '21700', anticipo: '4340', saldo: '17360'
};

(async function () {

  /* -------- un pago de verdad -------- */
  stripeDice({ payment_status: 'paid', status: 'complete', metadata: META });
  let r = res();
  await confirmar({ method: 'POST', headers: ORIGEN, body: { sesion: 'cs_test_abc123' } }, r);
  igual('pago real: estado pagado', r._json.estado, 'pagado');
  igual('el folio sale de Stripe, no del navegador', r._json.folio, 'ET-K3M9-4Q2');
  igual('los montos salen enteros', [r._json.anticipo, r._json.saldo, r._json.total], [4340, 17360, 21700]);

  /* LA PRUEBA QUE MAS IMPORTA: el kilometraje se queda en Stripe */
  igual('ni kilometros ni tarifa llegan al navegador',
    JSON.stringify(r._json).match(/km|621|kilometr|tarifa/i), null);
  igual('solo salen los campos de la lista blanca',
    Object.keys(r._json).sort(),
    ['anticipo', 'canal', 'estado', 'folio', 'ruta', 'saldo', 'total']);

  /* -------- OXXO: voucher generado, dinero NO entrado -------- */
  stripeDice({ payment_status: 'unpaid', status: 'complete', metadata: META });
  r = res();
  await confirmar({ method: 'POST', headers: ORIGEN, body: { sesion: 'cs_test_oxxo' } }, r);
  igual('OXXO sin pagar: estado pendiente, NO pagado', r._json.estado, 'pendiente');

  /* -------- sesion que no existe (o de otra cuenta) -------- */
  stripeDice({ error: { message: 'No such checkout.session' } }, false);
  r = res();
  await confirmar({ method: 'POST', headers: ORIGEN, body: { sesion: 'cs_test_inventada' } }, r);
  igual('sesion inexistente: 404 y sinPagar', [r._status, r._json.estado], [404, 'sinPagar']);

  /* -------- el id que manda el navegador se revisa -------- */
  const basura = ['', null, 'no-es-un-id', 'cs_../../otra-cosa', 'cs_' + 'x'.repeat(200), { a: 1 }];
  let todos400 = true;
  for (const mala of basura) {
    r = res();
    await confirmar({ method: 'POST', headers: ORIGEN, body: { sesion: mala } }, r);
    if (r._status !== 400) { todos400 = false; console.log('     paso una mala: ' + JSON.stringify(mala) + ' -> ' + r._status); }
  }
  cierto('ids con mala forma: los 6 rechazados con 400', todos400);

  /* -------- las defensas siguen puestas -------- */
  r = res();
  await confirmar({ method: 'POST', headers: { origin: 'https://sitio-malo.example' }, body: { sesion: 'cs_test_a' } }, r);
  igual('origen ajeno: 403', r._status, 403);

  r = res();
  await confirmar({ method: 'GET', headers: ORIGEN }, r);
  igual('GET: 405', r._status, 405);

  /* -------- sin clave de Stripe NO se confirma nada -------- */
  const guardada = process.env.STRIPE_SECRET_KEY;
  process.env.STRIPE_SECRET_KEY = '';
  r = res();
  await confirmar({ method: 'POST', headers: ORIGEN, body: { sesion: 'cs_test_a' } }, r);
  igual('sin clave: 503, y NUNCA dice pagado', [r._status, r._json.estado], [503, undefined]);
  process.env.STRIPE_SECRET_KEY = guardada;

  console.log('\n' + buenas + ' buenas, ' + malas + ' malas');
  process.exit(malas ? 1 : 0);
})();
