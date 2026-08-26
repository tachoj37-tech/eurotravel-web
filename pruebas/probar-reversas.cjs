/* ============================================================
   Cuando el dinero se regresa
   ------------------------------------------------------------
       node pruebas/probar-reversas.cjs

   Un reembolso o un contracargo significa que el dinero que ya
   habiamos dado por bueno SALIO de la cuenta. Si nadie se entera,
   el sistema sigue diciendo que ese viaje esta pagado y la unidad
   sale sin que nadie haya pagado. Eso es dinero perdido de
   verdad.

   LO QUE HABIA ANTES: NADA. Se comprobo mandandole un
   `charge.refunded` al webhook y contestaba «200 · ignorado»:
   Stripe lo daba por entregado y nunca reintentaba.

   Lo que se prueba, en orden de gravedad:

     1. una reversa NUNCA se contesta 200 sin avisarle a alguien
     2. si se cae el ANTICIPO, el aviso dice QUEMAR EL FOLIO
     3. si se cae un ABONO, solo se revierte ese abono
     4. sin la puerta de EuroSystem, el correo hace el trabajo
     5. la misma reversa avisada dos veces no revienta nada
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
process.env.STRIPE_SECRET_KEY = 'sk_test_x';
process.env.CONTRATOS_API_KEY = 'llave_x';
process.env.RESEND_API_KEY = 're_x';
process.env.AVISOS_A = 'ventas@eurotravel.com.mx';

/* Los tres destinos fingidos, cada uno con su interruptor. */
let SESION_POR_PAGO = null;
let EUROSYSTEM_REVERSA = { ok: false, status: 404 };   // por omision: no existe
let RESEND = { ok: true };
let CORREOS = [];
let LLAMADAS_EURO = [];

global.fetch = function (url, opc) {
  const u = String(url);
  if (u.indexOf('/checkout/sessions?payment_intent=') >= 0) {
    return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({
      data: SESION_POR_PAGO ? [SESION_POR_PAGO] : [] }) });
  }
  if (u.indexOf('reversa-externa') >= 0) {
    LLAMADAS_EURO.push(JSON.parse(opc.body));
    return Promise.resolve({ ok: EUROSYSTEM_REVERSA.ok, status: EUROSYSTEM_REVERSA.status,
      json: () => Promise.resolve({}) });
  }
  if (u.indexOf('api.resend.com') >= 0) {
    if (!RESEND.ok) return Promise.resolve({ ok: false, status: 500,
      json: () => Promise.resolve({ message: 'caido' }) });
    CORREOS.push(JSON.parse(opc.body));
    return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({ id: 'em' }) });
  }
  return Promise.reject(new Error('inesperado: ' + u));
};

const firma = require('../api/_firma-stripe.js');
const logica = require('../api/_webhook-logica.js');
const reversas = require('../api/_reversas.js');

function sesionCon(extra) {
  return Object.assign({
    id: 'cs_test_ANA', payment_status: 'paid', status: 'complete',
    customer: 'cus_ANA9K3M2X',
    metadata: {
      folio: 'ET-Q7TW-K3R', contrato: '51001', nombre: 'Ana Ruiz',
      correo: 'ana@ejemplo.mx', telefono: '3312345678',
      ruta: 'Guadalajara → Puerto Vallarta', salida: '2026-09-03T08:00',
      total: '26000', anticipo: '5200', saldo: '20800', km: '621.2'
    }
  }, extra || {});
}

async function avisa(tipo, objeto) {
  CORREOS = []; LLAMADAS_EURO = [];
  const ev = JSON.stringify({ type: tipo, data: { object: objeto } });
  return logica.procesa(ev, firma.firmaDePrueba(ev, 'whsec_x'));
}

/* Un reembolso, tal como lo manda Stripe */
const REEMBOLSO = { id: 'ch_1', payment_intent: 'pi_ABC123', amount: 520000,
                    amount_refunded: 520000 };
const CONTRACARGO = { id: 'dp_1', charge: 'ch_1', payment_intent: 'pi_ABC123', amount: 520000 };

(async function () {

  /* ============ 1. UNA REVERSA NUNCA SE IGNORA ============
     Es LA prueba. Si esta se rompe, el dinero se pierde en silencio. */
  {
    SESION_POR_PAGO = sesionCon();
    EUROSYSTEM_REVERSA = { ok: true, status: 200 };
    RESEND = { ok: true };

    for (const tipo of Object.keys(reversas.AVISOS)) {
      const r = await avisa(tipo, tipo.indexOf('dispute') >= 0 ? CONTRACARGO : REEMBOLSO);
      igual(tipo + ': NO se ignora', !!r.cuerpo.ignorado, false);
      igual(tipo + ': se atiende como reversa', r.cuerpo.reversa, true);
      igual(tipo + ': y se avisó a alguien', r.cuerpo.avisada, true);
    }
  }

  /* ============ 2. SI SE CAE EL ANTICIPO, SE QUEMA EL FOLIO ============ */
  {
    SESION_POR_PAGO = sesionCon();          // sin `tipo`, o sea el anticipo
    EUROSYSTEM_REVERSA = { ok: true, status: 200 };
    const r = await avisa('charge.refunded', REEMBOLSO);

    igual('el anticipo revertido se marca como ANTICIPO', r.cuerpo.clase, 'ANTICIPO');
    igual('y se dice de qué folio', r.cuerpo.folio, 'ET-Q7TW-K3R');

    /* lo que se le pide a EuroSystem */
    igual('a EuroSystem se le pide revertir el ANTICIPO', LLAMADAS_EURO[0].tipo, 'ANTICIPO');
    igual('con el pago como llave de idempotencia', LLAMADAS_EURO[0].referenciaPago, 'pi_ABC123');
    igual('y el contrato al que va', LLAMADAS_EURO[0].referenciaExterna, 'WEB-cs_test_ANA');
    igual('con el motivo', LLAMADAS_EURO[0].motivo, 'REEMBOLSO');
    igual('y el monto en pesos, no en centavos', LLAMADAS_EURO[0].monto, 5200);

    /* lo que lee la oficina */
    const aviso = CORREOS[0];
    cierto('el asunto grita que se cayó un contrato', /SE CAYO UN CONTRATO/.test(aviso.subject));
    cierto('con su folio', aviso.subject.indexOf('ET-Q7TW-K3R') >= 0);
    cierto('dice CANCELAR el contrato', /Cancelar el contrato 51001/.test(aviso.text));
    cierto('dice avisarle al cliente', /avisarle al cliente/i.test(aviso.text));
    cierto('y liberar la unidad', /Liberar la unidad/i.test(aviso.text));
    cierto('trae el teléfono para poder llamarle', aviso.text.indexOf('3312345678') >= 0);
    cierto('y la liga al pago en Stripe', aviso.text.indexOf('pi_ABC123') >= 0);
  }

  /* ============ 3. SI SE CAE UN ABONO, SOLO ESE ABONO ============ */
  {
    SESION_POR_PAGO = sesionCon({ metadata: Object.assign({}, sesionCon().metadata,
      { tipo: 'abono' }) });
    EUROSYSTEM_REVERSA = { ok: true, status: 200 };
    const r = await avisa('charge.dispute.created', CONTRACARGO);

    igual('un abono revertido se marca como ABONO', r.cuerpo.clase, 'ABONO');
    igual('y el motivo es contracargo', r.cuerpo.motivo, 'CONTRACARGO');
    igual('a EuroSystem se le pide revertir el ABONO', LLAMADAS_EURO[0].tipo, 'ABONO');

    const aviso = CORREOS[0];
    cierto('el asunto habla de un abono', /SE REVIRTIO UN ABONO/.test(aviso.subject));
    igual('y NO dice cancelar el contrato', /Cancelar el contrato/.test(aviso.text), false);
    cierto('dice marcar revertido ese abono', /Marcar revertido ese abono/.test(aviso.text));
    cierto('y explica que fue el banco', /banco del cliente/.test(aviso.text));
  }

  /* ============ 4. SIN LA PUERTA DE EUROSYSTEM, EL CORREO TRABAJA ============
     Es la situacion de HOY: esa puerta todavia no existe. Lo unico que impide
     perder el dinero es que una persona se entere. */
  {
    SESION_POR_PAGO = sesionCon();
    EUROSYSTEM_REVERSA = { ok: false, status: 404 };
    RESEND = { ok: true };
    const r = await avisa('charge.refunded', REEMBOLSO);

    igual('sin puerta en EuroSystem, la reversa NO se pierde', r.status, 200);
    igual('se acusa que EuroSystem no la registró', r.cuerpo.registrada, false);
    igual('pero SI se avisó', r.cuerpo.avisada, true);

    const aviso = CORREOS[0];
    cierto('y el aviso lo dice, para que se haga a mano',
      /NO pudo registrarlo/.test(aviso.text));
    cierto('nombrando el motivo', /todavía no existe/.test(aviso.text));
    cierto('y pidiendo que se haga a mano', /A MANO/.test(aviso.text));
  }

  /* ============ 5. SI NI EL CORREO SALE, QUE STRIPE INSISTA ============
     Es la ultima red. Vale mas que Stripe siga tocando la puerta tres dias a
     que el dinero se pierda en silencio. */
  {
    SESION_POR_PAGO = sesionCon();
    EUROSYSTEM_REVERSA = { ok: false, status: 404 };
    RESEND = { ok: false };
    const r = await avisa('charge.refunded', REEMBOLSO);

    igual('si nadie se enteró, se contesta 500', r.status, 500);
    igual('y NUNCA 200', r.status === 200, false);
  }

  /* ============ 6. LOS CASOS QUE NO SON NUESTROS ============ */
  {
    RESEND = { ok: true };
    /* un cobro capturado a mano en el panel de Stripe: no salio de aqui */
    SESION_POR_PAGO = null;
    const ajeno = await avisa('charge.refunded', REEMBOLSO);
    igual('un cobro que no salió de la página: se acusa y ya', ajeno.status, 200);
    igual('y se marca como ajeno', ajeno.cuerpo.ajeno, true);
    igual('sin molestar a la oficina', CORREOS.length, 0);

    /* un aviso sin pago que buscar */
    SESION_POR_PAGO = sesionCon();
    const sinPago = await avisa('charge.refunded', { id: 'ch_x' });
    igual('un aviso sin pago no revienta', sinPago.status, 200);
  }

  /* ============ 7. LAS PIEZAS, POR SEPARADO ============ */
  {
    igual('un pago normal NO es una reversa', reversas.esReversa('checkout.session.completed'), false);
    igual('un reembolso sí', reversas.esReversa('charge.refunded'), true);
    igual('el reembolso se llama REEMBOLSO', reversas.motivoDe('charge.refunded'), 'REEMBOLSO');
    igual('y la disputa, CONTRACARGO', reversas.motivoDe('charge.dispute.created'), 'CONTRACARGO');

    /* el pago se saca esté donde esté */
    igual('pago como texto', reversas.pagoDelAviso({ payment_intent: 'pi_1' }), 'pi_1');
    igual('pago como objeto', reversas.pagoDelAviso({ payment_intent: { id: 'pi_2' } }), 'pi_2');
    igual('sin pago, vacío', reversas.pagoDelAviso({}), '');
    igual('sin objeto tampoco revienta', reversas.pagoDelAviso(null), '');

    /* los centavos de Stripe se vuelven pesos */
    igual('520000 centavos son 5,200 pesos',
      reversas.montoRevertido('charge.refunded', { amount_refunded: 520000 }), 5200);
    igual('una disputa usa `amount`',
      reversas.montoRevertido('charge.dispute.created', { amount: 520000 }), 5200);
    igual('un reembolso PARCIAL cuenta lo que se fue, no el total',
      reversas.montoRevertido('charge.refunded', { amount: 520000, amount_refunded: 100000 }), 1000);
    igual('basura da cero, no NaN',
      reversas.montoRevertido('charge.refunded', { amount_refunded: 'mucho' }), 0);

    /* la clase se decide por lo que se ESCRIBIO al cobrar, no se adivina */
    igual('sin `tipo` es el anticipo', reversas.claseDePago({}), 'ANTICIPO');
    igual('con `tipo: abono` es un abono', reversas.claseDePago({ tipo: 'abono' }), 'ABONO');
    igual('con otro `tipo` cualquiera, anticipo', reversas.claseDePago({ tipo: 'lo que sea' }), 'ANTICIPO');
  }

  /* ============ 8. NI AQUI SE ESCAPA EL KILOMETRAJE ============
     El aviso se arma con la metadata de Stripe, que trae `km`. Va a la
     oficina, no al cliente, pero la regla se cumple igual: si un dia ese
     texto se le reenvia a alguien, no puede llevar la tarifa. */
  {
    SESION_POR_PAGO = sesionCon();
    EUROSYSTEM_REVERSA = { ok: true, status: 200 };
    RESEND = { ok: true };
    await avisa('charge.refunded', REEMBOLSO);
    igual('el aviso a la oficina no lleva kilometraje ni tarifa',
      JSON.stringify(CORREOS[0]).match(/\bkm\b|kilometr|621\.2|tarifa/i), null);
  }

  console.log('\n' + buenas + ' buenas, ' + malas + ' malas');
  process.exit(malas ? 1 : 0);
})();
