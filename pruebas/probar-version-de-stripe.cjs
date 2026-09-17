/* ============================================================
   LA PÁGINA FIJA SU VERSIÓN DE LA API DE STRIPE
   ------------------------------------------------------------
       node pruebas/probar-version-de-stripe.cjs

   El 16-sep-2026, al crear el webhook nuevo, Stripe enseñó la versión
   de la API de la cuenta: **2019-05-16**. Es la cuenta que ya cobra la
   página vieja y NO se le cambia nada, tampoco la versión.

   Y la página no fijaba ninguna: cada llamada salía con la versión de
   la cuenta. Con 2019-05-16, `expand[]=latest_charge` (el cobro de un
   pago, que existe desde la versión 2022-11-15) no existe: la reversa
   de un reembolso habría fallado en silencio, y cualquier otro campo
   nuevo del que dependa el código habría llegado vacío.

   La regla: TODA llamada a api.stripe.com lleva `Stripe-Version` con
   la versión que este código conoce. Así la página se comporta igual
   sin importar la versión de la cuenta, y la cuenta no se toca. Es una
   cabecera por petición: no cambia nada para la página vieja.
   ============================================================ */
'use strict';

let buenas = 0, malas = 0;
function igual(nombre, dio, esperado) {
  const a = JSON.stringify(dio), b = JSON.stringify(esperado);
  if (a === b) { buenas++; console.log('ok   ' + nombre); }
  else { malas++; console.log('MAL  ' + nombre + '\n     dio      ' + a + '\n     esperaba ' + b); }
}
function cierto(nombre, v) { igual(nombre, !!v, true); }

process.env.STRIPE_SECRET_KEY = 'sk_test_x';

const LLAMADAS = [];
global.fetch = function (url, opc) {
  LLAMADAS.push({ url: String(url), headers: (opc && opc.headers) || {}, method: (opc && opc.method) || 'GET' });
  const u = String(url);
  let cuerpo = {};
  if (u.indexOf('/checkout/sessions?') >= 0 || u.indexOf('/customers?') >= 0) cuerpo = { data: [] };
  else if (u.indexOf('/payment_intents/') >= 0) cuerpo = { id: 'pi_ABC123XYZ', latest_charge: { id: 'ch_1', amount: 100 } };
  else if (u.indexOf('/checkout/sessions/') >= 0) cuerpo = { id: 'cs_test_1', payment_status: 'paid', url: 'https://x' };
  else if (u.indexOf('/checkout/sessions') >= 0) cuerpo = { id: 'cs_test_1', url: 'https://x' };
  else if (u.indexOf('/customers/') >= 0) cuerpo = { id: 'cus_ABC123', metadata: {} };
  else if (u.indexOf('/customers') >= 0) cuerpo = { id: 'cus_ABC123' };
  return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(cuerpo) });
};

const stripe = require('../api/_stripe.js');

(async function () {
  console.log('\n── 1 · La versión vive en un solo lugar y es una que este código conoce ──');
  cierto('_stripe.js exporta VERSION_API', typeof stripe.VERSION_API === 'string' && stripe.VERSION_API.length > 0);
  cierto('tiene forma de fecha AAAA-MM-DD', /^\d{4}-\d{2}-\d{2}$/.test(String(stripe.VERSION_API)));
  cierto('es 2022-11-15 o posterior (cuando nació latest_charge)', String(stripe.VERSION_API) >= '2022-11-15');

  console.log('\n── 2 · Cada llamada a Stripe lleva esa versión ──');
  const casos = [
    ['traeSesion', () => stripe.traeSesion('cs_test_1')],
    ['sesionPorPago', () => stripe.sesionPorPago('pi_ABC123XYZ')],
    ['cargoDelPago', () => stripe.cargoDelPago('pi_ABC123XYZ')],
    ['traeCliente', () => stripe.traeCliente('cus_ABC123')],
    ['clientesPorCorreo', () => stripe.clientesPorCorreo('a@b.mx')],
    ['sesionesDelCliente', () => stripe.sesionesDelCliente('cus_ABC123', 5)],
    ['creaCliente', () => stripe.creaCliente({ email: 'a@b.mx', name: 'Ana' })],
    ['guardaEnCliente', () => stripe.guardaEnCliente('cus_ABC123', { a: '1' })],
    ['creaSesionDeCobro', () => stripe.creaSesionDeCobro({ mode: 'payment', success_url: 'https://x/ok', cancel_url: 'https://x/no', line_items: [{ quantity: 1, price_data: { currency: 'mxn', unit_amount: 100, product_data: { name: 'x' } } }] })]
  ];
  for (const [nombre, llama] of casos) {
    LLAMADAS.length = 0;
    try { await llama(); } catch (e) { console.log('     (' + nombre + ' tronó: ' + e.message + ')'); }
    const aStripe = LLAMADAS.filter(l => l.url.indexOf('api.stripe.com') >= 0);
    cierto(nombre + ': llamó a Stripe', aStripe.length >= 1);
    cierto(nombre + ': con Stripe-Version = VERSION_API', aStripe.length >= 1 && aStripe.every(l => l.headers['Stripe-Version'] === stripe.VERSION_API));
    cierto(nombre + ': y sigue llevando la llave', aStripe.every(l => /^Bearer sk_/.test(l.headers['Authorization'] || '')));
  }

  console.log('\n' + buenas + ' buenas, ' + malas + ' malas');
  process.exit(malas ? 1 : 0);
})();
