/* ============================================================
   LOS PAGOS DE LA PÁGINA VIEJA NO SON NUESTROS
   ------------------------------------------------------------
       node pruebas/probar-pagos-ajenos.cjs

   LO DIJO EL DUEÑO el 16-sep-2026: la cuenta de Stripe que va a usar
   esta página YA recibe pagos de la página vieja (el WordPress), con
   su propio webhook hecho por otro programador. «Que todo este
   proceso de Stripe no mueva nada, que no afecte la recepción de
   pagos actual.»

   Un webhook nuevo no estorba al viejo: cada endpoint recibe su
   copia. Pero NUESTRO webhook va a recibir TAMBIÉN los eventos de la
   página vieja, porque viven en la misma cuenta. Y hasta hoy:

     · `checkout.session.completed` de una sesión ajena caía en
       «fechas ilegibles»: 200 por casualidad, con un error en el
       registro que dice «registrar a mano».
     · `charge.refunded` de un cobro ajeno se trataba como el
       reembolso de un ANTICIPO nuestro: correo de alarma a la
       oficina, llamada a EuroSystem para revertir un abono que no
       existe, 404, 500, Stripe reintentando tres días.

   Desde hoy hay UNA sola regla, en un solo lugar (`esDeLaPagina`):
   una sesión es nuestra si su metadata trae un folio `ET-…` (compra
   desde la página) o `tipo: abono` con su `contrato` (abono desde el
   portal). Lo demás es ajeno: 200, `ajeno: true`, y NADA más: ni
   correo, ni EuroSystem, ni aviso.
   ============================================================ */
'use strict';

let buenas = 0, malas = 0;
function igual(nombre, dio, esperado) {
  const a = JSON.stringify(dio), b = JSON.stringify(esperado);
  if (a === b) { buenas++; console.log('ok   ' + nombre); }
  else { malas++; console.log('MAL  ' + nombre + '\n     dio      ' + a + '\n     esperaba ' + b); }
}
function cierto(nombre, v) { igual(nombre, !!v, true); }

process.env.STRIPE_WEBHOOK_SECRET = 'whsec_x';
process.env.STRIPE_SECRET_KEY = 'sk_live_x';
process.env.CONTRATOS_API_KEY = 'llave_x';
process.env.RESEND_API_KEY = 're_x';
process.env.AVISOS_A = 'ventas@eurotravel.com.mx';
process.env.AVISO_TELEGRAM_TOKEN = 'tg_x';
process.env.AVISO_TELEGRAM_CHAT = '1';

let SESION = null;
let CORREOS = [], EURO = [], AVISOS = [], INESPERADAS = [];
const CARGO = { id: 'ch_viejo', amount: 250000, amount_refunded: 250000, disputed: false };

global.fetch = function (url, opc) {
  const u = String(url);
  if (u.indexOf('/checkout/sessions?payment_intent=') >= 0) {
    return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({ data: SESION ? [SESION] : [] }) });
  }
  if (u.indexOf('/checkout/sessions/') >= 0) {
    return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(SESION) });
  }
  if (u.indexOf('/payment_intents/') >= 0) {
    return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({ id: 'pi_VIEJO', latest_charge: CARGO }) });
  }
  if (u.indexOf('/api/contratos') >= 0) { EURO.push(u); return Promise.resolve({ ok: false, status: 404, json: () => Promise.resolve({ error: 'no existe' }) }); }
  if (u.indexOf('api.resend.com') >= 0) { CORREOS.push(JSON.parse(opc.body)); return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({ id: 'em' }) }); }
  if (u.indexOf('api.telegram.org') >= 0) { AVISOS.push(u); return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({ ok: true }) }); }
  INESPERADAS.push(u);
  return Promise.reject(new Error('inesperado: ' + u));
};

const firma = require('../api/_firma-stripe.js');
const logica = require('../api/_webhook-logica.js');

function limpia() { CORREOS = []; EURO = []; AVISOS = []; INESPERADAS = []; }
async function llega(tipo, objeto) {
  limpia();
  const ev = JSON.stringify({ type: tipo, data: { object: objeto } });
  return logica.procesa(ev, firma.firmaDePrueba(ev, 'whsec_x'));
}

/* Una sesión de la página vieja: pagada, real, y sin nada nuestro en la
   metadata (un Payment Link, por ejemplo, no trae metadata). */
function sesionAjena(metadata) {
  return { id: 'cs_live_VIEJA', payment_status: 'paid', status: 'complete', livemode: true,
    amount_total: 250000, currency: 'mxn', customer_details: { email: 'cliente@viejo.mx' },
    metadata: metadata || {} };
}

(async function () {
  console.log('\n── 1 · esDeLaPagina: la regla, en un solo lugar ──');
  cierto('la lógica exporta esDeLaPagina', typeof logica.esDeLaPagina === 'function');
  const es = logica.esDeLaPagina || function () { return 'no existe'; };
  igual('folio ET-… es nuestra (compra)', es({ metadata: { folio: 'ET-Q7TW-K3R', salida: '2026-10-09' } }), true);
  igual('tipo abono + contrato es nuestra (portal)', es({ metadata: { tipo: 'abono', contrato: '51001' } }), true);
  igual('sin metadata NO es nuestra', es({ metadata: {} }), false);
  igual('sin objeto metadata NO es nuestra', es({}), false);
  igual('metadata ajena (otro programador) NO es nuestra', es({ metadata: { order_id: '8812', plugin: 'woo' } }), false);
  igual('un folio que no empieza con ET- NO es nuestra', es({ metadata: { folio: '8812' } }), false);
  igual('tipo abono SIN contrato NO es nuestra', es({ metadata: { tipo: 'abono' } }), false);

  console.log('\n── 2 · Una compra de la página vieja, pagada de verdad ──');
  for (const tipo of ['checkout.session.completed', 'checkout.session.async_payment_succeeded']) {
    SESION = sesionAjena({ order_id: '8812' });
    const r = await llega(tipo, { id: 'cs_live_VIEJA' });
    igual(tipo + ': contesta 200', r.status, 200);
    igual(tipo + ': dice que es ajena', r.cuerpo.ajeno, true);
    igual(tipo + ': no toca EuroSystem', EURO.length, 0);
    igual(tipo + ': no manda correos', CORREOS.length, 0);
    igual(tipo + ': no manda avisos', AVISOS.length, 0);
    igual(tipo + ': no hace ninguna otra llamada', INESPERADAS.length, 0);
  }

  console.log('\n── 3 · Un reembolso y un contracargo de la página vieja ──');
  const REEMBOLSO = { id: 'ch_viejo', payment_intent: 'pi_VIEJO', amount: 250000, amount_refunded: 250000 };
  const CONTRACARGO = { id: 'dp_viejo', charge: 'ch_viejo', payment_intent: 'pi_VIEJO', amount: 250000 };
  CARGO.disputed = true;
  for (const [tipo, objeto] of [['charge.refunded', REEMBOLSO], ['charge.dispute.created', CONTRACARGO], ['charge.dispute.funds_withdrawn', CONTRACARGO]]) {
    SESION = sesionAjena({});
    const r = await llega(tipo, objeto);
    igual(tipo + ': contesta 200 (Stripe no reintenta)', r.status, 200);
    igual(tipo + ': dice que es ajena', r.cuerpo.ajeno, true);
    igual(tipo + ': NO alarma a la oficina', CORREOS.length, 0);
    igual(tipo + ': NO pide revertir nada a EuroSystem', EURO.length, 0);
  }

  console.log('\n── 4 · Y lo nuestro sigue entrando igual ──');
  SESION = { id: 'cs_live_NUESTRA', payment_status: 'paid', status: 'complete', livemode: true,
    amount_total: 150000, currency: 'mxn',
    metadata: { folio: 'ET-Q7TW-K3R', nombre: 'Ana Ruiz', correo: 'ana@ejemplo.mx', telefono: '3312345678',
      ruta: 'Guadalajara → Chapala', origen: 'Guadalajara', destino: 'Chapala', unidad: 'sprinter',
      salida: '2026-10-09T08:00', regreso: '2026-10-11T18:00', viaje: 'REDONDO', total: '6500', anticipo: '1500', saldo: '5000' } };
  const r = await llega('checkout.session.completed', { id: 'cs_live_NUESTRA' });
  cierto('una compra nuestra no se marca ajena', !r.cuerpo.ajeno);
  cierto('una compra nuestra sí busca a EuroSystem', EURO.length >= 1);

  console.log('\n' + buenas + ' buenas, ' + malas + ' malas');
  process.exit(malas ? 1 : 0);
})();
