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

/* Los destinos fingidos, cada uno con su interruptor. */

/* El cobro TAL COMO LO TIENE STRIPE, que es el que manda. Por omisión trae
   devolución Y disputa para que sirva a los dos motivos sin cambiarlo en cada
   caso; los casos en que Stripe NO confirma se prueban aparte, abajo. */
let CARGO = { id: 'ch_1', amount: 520000, amount_refunded: 520000, disputed: true };
let SESION_POR_PAGO = null;
/* La puerta de reversas YA EXISTE en EuroSystem: es
   `POST /api/contratos/abono-externo/revertir` (CONTRATOS-API.md §13). Por
   omision contesta lo bueno; los casos feos se encienden uno por uno. */
let EUROSYSTEM_REVERSA = { ok: true, status: 200, datos: { revertido: true } };
let RESEND = { ok: true };
let CORREOS = [];
let LLAMADAS_EURO = [];
let LLAMADAS_EURO_CRUDAS = [];

global.fetch = function (url, opc) {
  const u = String(url);
  if (u.indexOf('/payment_intents/') >= 0) {
    return Promise.resolve({ ok: true, status: 200,
      json: () => Promise.resolve({ id: 'pi_ABC123', latest_charge: CARGO }) });
  }
  if (u.indexOf('/checkout/sessions?payment_intent=') >= 0) {
    return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({
      data: SESION_POR_PAGO ? [SESION_POR_PAGO] : [] }) });
  }
  /* La puerta se reconoce por su direccion EXACTA, no por un pedazo del
     nombre: esta prueba existe justamente porque el codigo apuntaba a una
     direccion que no existe y nadie lo notaba. */
  if (u.indexOf('/api/contratos/') >= 0) {
    LLAMADAS_EURO.push(JSON.parse(opc.body));
    LLAMADAS_EURO_CRUDAS.push({ url: u, opciones: opc });
    if (EUROSYSTEM_REVERSA.tronar) return Promise.reject(new Error('sin red'));
    return Promise.resolve({ ok: EUROSYSTEM_REVERSA.ok, status: EUROSYSTEM_REVERSA.status,
      json: () => Promise.resolve(EUROSYSTEM_REVERSA.datos || {}) });
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
  CORREOS = []; LLAMADAS_EURO = []; LLAMADAS_EURO_CRUDAS = [];
  const ev = JSON.stringify({ type: tipo, data: { object: objeto } });
  return logica.procesa(ev, firma.firmaDePrueba(ev, 'whsec_x'));
}

/* Los correos que le llegaron a la OFICINA. Desde el 18-sep-2026 una reversa
   manda dos: el de la oficina y el del cliente. */
function aLaOficina() {
  return CORREOS.filter(function (c) { return (c.to || []).join(',').indexOf('eurotravel.com.mx') >= 0; });
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
    EUROSYSTEM_REVERSA = { ok: true, status: 200, datos: { revertido: true } };
    const r = await avisa('charge.refunded', REEMBOLSO);

    igual('el anticipo revertido se marca como ANTICIPO', r.cuerpo.clase, 'ANTICIPO');
    igual('y se dice de qué folio', r.cuerpo.folio, 'ET-Q7TW-K3R');

    /* ------------------------------------------------------------
       LA PUERTA DE VERDAD, LA QUE ESTA DOCUMENTADA

       Esto estuvo apuntando a `/api/contratos/reversa-externa`, que NO
       EXISTE en EuroSystem y nunca existio: era el nombre que se le
       puso de memoria a una puerta que todavia se estaba pidiendo. El
       404 constante se leia como «la puerta aun no esta» y el correo a
       la oficina tapaba el hueco — asi que ninguna reversa se registro
       jamas, y nadie lo notaba.

       La puerta real es `POST /api/contratos/abono-externo/revertir`
       (CONTRATOS-API.md §13) y su cuerpo son DOS campos, ni uno mas:
       `referencia` (el `pi_…`, que es lo que la pagina manda al
       registrar el abono) y `motivo`, en minusculas.
       ------------------------------------------------------------ */
    igual('se llama a la puerta documentada, la direccion EXACTA',
      LLAMADAS_EURO_CRUDAS[0].url, 'https://eurosystem.site/api/contratos/abono-externo/revertir');
    igual('con la llave en la cabecera',
      LLAMADAS_EURO_CRUDAS[0].opciones.headers['x-api-key'], 'llave_x');
    igual('y con POST', LLAMADAS_EURO_CRUDAS[0].opciones.method, 'POST');
    igual('el cuerpo es exactamente el de §13: referencia y motivo, nada mas',
      LLAMADAS_EURO[0], { referencia: 'pi_ABC123', motivo: 'reembolso' });
    igual('la referencia es el mismo `pi_…` con el que se registra el abono',
      LLAMADAS_EURO[0].referencia, 'pi_ABC123');

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
    EUROSYSTEM_REVERSA = { ok: true, status: 200, datos: { revertido: true } };
    const r = await avisa('charge.dispute.created', CONTRACARGO);

    igual('un abono revertido se marca como ABONO', r.cuerpo.clase, 'ABONO');
    igual('y el motivo es contracargo', r.cuerpo.motivo, 'CONTRACARGO');
    /* La puerta de §13 solo acepta `reembolso` o `contracargo`, en minusculas:
       el `CONTRACARGO` de adentro es para la oficina, no para EuroSystem. */
    igual('a EuroSystem el motivo le va en minusculas, como pide §13',
      LLAMADAS_EURO[0], { referencia: 'pi_ABC123', motivo: 'contracargo' });

    const aviso = CORREOS[0];
    cierto('el asunto habla de un abono', /SE REVIRTIO UN ABONO/.test(aviso.subject));
    igual('y NO dice cancelar el contrato', /Cancelar el contrato/.test(aviso.text), false);
    cierto('dice marcar revertido ese abono', /Marcar revertido ese abono/.test(aviso.text));
    cierto('y explica que fue el banco', /banco del cliente/.test(aviso.text));
  }

  /* ============ 4. EL 404: LA REVERSA LLEGO ANTES QUE SU COBRO ============
     Lo manda §13 con todas sus letras: «Si contesta 404 (esa referencia aún
     no está registrada), quien llama DEBE contestarle a Stripe con un error
     (no 2xx) para que Stripe reintente el aviso».

     Y tiene razon de ser: un reembolso puede llegar ANTES de que su cobro
     alcanzara a registrarse. Contestar 200 ahi es perder la reversa para
     siempre — el sistema se queda diciendo que el viaje esta pagado. */
  {
    SESION_POR_PAGO = sesionCon();
    EUROSYSTEM_REVERSA = { ok: false, status: 404, datos: { error: 'No hay un abono con esa referencia.' } };
    RESEND = { ok: true };
    const r = await avisa('charge.refunded', REEMBOLSO);

    igual('404 de EuroSystem: 500 para que Stripe reintente, como manda §13', r.status, 500);
    igual('y NUNCA 200: contestar 200 pierde la reversa', r.status === 200, false);

    /* Pero la oficina se entera IGUAL, y en el primer intento: el dinero ya
       salio de la cuenta y eso no espera tres dias de reintentos. */
    /* Desde el 18-sep-2026 al cliente tambien se le escribe, asi que se
       cuentan SOLO los de la oficina: es el que no puede faltar. */
    igual('y aun asi se le avisó a la oficina', aLaOficina().length, 1);
    const aviso = CORREOS[0];
    cierto('el aviso dice que EuroSystem no lo registró',
      /NO pudo registrarlo/.test(aviso.text));
    cierto('y pidiendo que se haga a mano', /A MANO/.test(aviso.text));
  }

  /* ============ 4bis. `yaEstaba`: el reintento que ya no tiene que hacer nada ====
     §13: un 200 con `yaEstaba` es un abono que ya se habia revertido. Es la
     otra cara del 404: cuando Stripe reintenta y el de antes SI entro, esto
     tiene que contestar 200 y dejar de insistir. */
  {
    SESION_POR_PAGO = sesionCon();
    EUROSYSTEM_REVERSA = { ok: true, status: 200, datos: { yaEstaba: true } };
    RESEND = { ok: true };
    const r = await avisa('charge.refunded', REEMBOLSO);

    igual('`yaEstaba`: 200, Stripe deja de insistir', r.status, 200);
    igual('y cuenta como registrada, porque lo está', r.cuerpo.registrada, true);
    igual('se avisó igual', r.cuerpo.avisada, true);
  }

  /* ============ 4ter. EUROSYSTEM CAIDO O MAL CONFIGURADO ============
     Ni 200 ni 404: la puerta esta, pero no contesta bien. Tampoco se da por
     buena — el abono sigue sin revertirse en EuroSystem. */
  {
    for (const caso of [{ status: 500 }, { status: 401 }, { status: 429 }]) {
      SESION_POR_PAGO = sesionCon();
      EUROSYSTEM_REVERSA = { ok: false, status: caso.status, datos: {} };
      RESEND = { ok: true };
      const r = await avisa('charge.refunded', REEMBOLSO);
      igual('EuroSystem contesta ' + caso.status + ': 500, que Stripe reintente', r.status, 500);
      igual('EuroSystem contesta ' + caso.status + ': y la oficina se entera igual',
        aLaOficina().length, 1);
    }

    /* Y si ni se le pudo hablar. */
    SESION_POR_PAGO = sesionCon();
    EUROSYSTEM_REVERSA = { ok: false, status: 0, tronar: true };
    const r = await avisa('charge.refunded', REEMBOLSO);
    igual('EuroSystem inalcanzable: 500, que Stripe reintente', r.status, 500);
    igual('y la oficina se entera igual', aLaOficina().length, 1);
  }

  /* ============ 5. SI NI EL CORREO SALE, QUE STRIPE INSISTA ============
     Es la ultima red. Vale mas que Stripe siga tocando la puerta tres dias a
     que el dinero se pierda en silencio. */
  {
    SESION_POR_PAGO = sesionCon();
    EUROSYSTEM_REVERSA = { ok: false, status: 404, datos: {} };
    RESEND = { ok: false };
    const r = await avisa('charge.refunded', REEMBOLSO);

    igual('si nadie se enteró, se contesta 500', r.status, 500);
    igual('y NUNCA 200', r.status === 200, false);

    /* Ni con EuroSystem contento: el aviso a una persona es la garantía. */
    EUROSYSTEM_REVERSA = { ok: true, status: 200, datos: { revertido: true } };
    const r2 = await avisa('charge.refunded', REEMBOLSO);
    igual('aunque EuroSystem la registre, sin aviso a nadie se contesta 500', r2.status, 500);
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

  /* ============ 9. UNA REVERSA INVENTADA NO MUEVE NADA ============
     Esta seccion salio de atacar el sitio PUBLICADO, no de imaginarla. La
     misma peticion, con la misma firma inventada, cambiando una sola cosa:

         Content-Type: text/plain          -> 400 firma inválida
         Content-Type: application/json    -> 200, y entró hasta la lógica

     O sea que la firma no era una puerta: era una puerta que el visitante
     podia decidir no tocar, porque con `application/json` Vercel parsea el
     cuerpo, se pierden los bytes exactos y ya no hay firma que comprobar.

     Lo que eso permitia: cualquiera que supiera un `pi_…` inventaba un
     reembolso y le quemaba el folio a un viaje pagado.

     El candado nuevo no es la firma —a Stripe no se le puede pedir que
     mande otro Content-Type—: es que ANTES de mover un peso se le pregunta
     a Stripe si ese dinero de verdad se fue. */
  {
    /* Asi llega en produccion cuando el cuerpo viene parseado: un objeto, sin
       bytes, o sea sin firma que valga. */
    const avisaSinFirma = async function (tipo, objeto) {
      CORREOS = []; LLAMADAS_EURO = [];
      return logica.procesa({ type: tipo, data: { object: objeto } }, 'firma inventada');
    };

    SESION_POR_PAGO = sesionCon();
    EUROSYSTEM_REVERSA = { ok: true, status: 200 };
    RESEND = { ok: true };

    /* --- a) el ataque: sin firma, y Stripe no ve ninguna devolucion --- */
    CARGO = { id: 'ch_1', amount: 520000, amount_refunded: 0, disputed: false };
    let r = await avisaSinFirma('charge.refunded', REEMBOLSO);
    igual('reembolso inventado: no se atiende', !!r.cuerpo.reversa, false);
    igual('reembolso inventado: se contesta 200, no un 500 con el que hacernos girar', r.status, 200);
    igual('reembolso inventado: NO se le pide nada a EuroSystem', LLAMADAS_EURO.length, 0);
    igual('reembolso inventado: NO se asusta a la oficina', CORREOS.length, 0);

    /* --- b) contracargo inventado: Stripe no ve disputa --- */
    r = await avisaSinFirma('charge.dispute.created', CONTRACARGO);
    igual('contracargo inventado: no se atiende', !!r.cuerpo.reversa, false);
    igual('contracargo inventado: no se quema ningún folio', LLAMADAS_EURO.length, 0);

    /* --- c) pero uno DE VERDAD sin firma sí pasa ---
       Hoy TODO el trafico bueno de Stripe llega asi —parseado, sin firma que
       comprobar—. Si esta prueba se pone en rojo, los reembolsos reales
       dejaron de atenderse, que es el defecto que se acaba de tapar. */
    CARGO = { id: 'ch_1', amount: 520000, amount_refunded: 520000, disputed: false };
    r = await avisaSinFirma('charge.refunded', REEMBOLSO);
    cierto('un reembolso real sin firma SÍ se atiende', r.cuerpo.reversa);
    igual('y se le avisa a la oficina', aLaOficina().length, 1);

    /* --- d) firmado pero Stripe todavía no lo refleja: que insista --- */
    CARGO = { id: 'ch_1', amount: 520000, amount_refunded: 0, disputed: false };
    r = await avisa('charge.refunded', REEMBOLSO);
    igual('firmado y sin confirmar: se pide reintento', r.status, 500);
    igual('firmado y sin confirmar: no se avisa todavía', CORREOS.length, 0);

    /* --- e) el monto lo dice Stripe, no el aviso --- */
    CARGO = { id: 'ch_1', amount: 520000, amount_refunded: 100000, disputed: false };
    r = await avisa('charge.refunded', { id: 'ch_1', payment_intent: 'pi_ABC123',
      amount: 999999999, amount_refunded: 999999999 });
    /* El monto ya no viaja a EuroSystem —§13 solo quiere `referencia` y
       `motivo`— pero es lo primero que la oficina necesita leer, asi que la
       regla se comprueba donde ahora vive: en el aviso. */
    cierto('el monto sale de Stripe ($1,000), no del aviso de Stripe',
      /Monto que se fue: \$1,000/.test(CORREOS[0].text));
    igual('y el monto inventado del aviso no aparece por ningún lado',
      /9,999,999/.test(JSON.stringify(CORREOS[0])), false);

    /* --- f) las piezas, por separado --- */
    igual('sin devolución, no hay reembolso que atender',
      reversas.loQueDiceStripe('REEMBOLSO', { amount_refunded: 0 }).confirmada, false);
    igual('con devolución, sí',
      reversas.loQueDiceStripe('REEMBOLSO', { amount_refunded: 520000 }).confirmada, true);
    igual('y el monto en pesos',
      reversas.loQueDiceStripe('REEMBOLSO', { amount_refunded: 520000 }).monto, 5200);
    igual('sin disputa, no hay contracargo',
      reversas.loQueDiceStripe('CONTRACARGO', { amount: 520000, disputed: false }).confirmada, false);
    igual('`disputed` tiene que ser true de verdad, no un valor que se le parezca',
      reversas.loQueDiceStripe('CONTRACARGO', { amount: 520000, disputed: 'sí' }).confirmada, false);
    igual('con disputa, sí',
      reversas.loQueDiceStripe('CONTRACARGO', { amount: 520000, disputed: true }).confirmada, true);
    igual('un cobro vacío no confirma nada',
      reversas.loQueDiceStripe('REEMBOLSO', null).confirmada, false);
  }

  /* ============================================================
     AL CLIENTE TAMBIÉN SE LE AVISA (18-sep-2026)
     ------------------------------------------------------------
     Dictado del dueño: «que le avise a la persona y al cliente; si fue
     un abono se cancela el abono y se revierte; si es contrato y el
     cliente no avisa ni dice nada, el usuario lo cancela, pero se le
     avisa siempre a una persona».

     O sea: la oficina SIEMPRE (ya estaba) y el cliente TAMBIÉN. Nadie
     cancela el contrato solo: eso lo decide una persona.

     Una regla más, que no dijo pero se cae de madura: al cliente se le
     escribe UNA vez por cobro. Stripe manda dos avisos por la misma
     disputa —`created` cuando el banco la abre y `funds_withdrawn`
     cuando se lleva el dinero— y dos correos por lo mismo asustan el
     doble. Al cliente se le escribe cuando el dinero de verdad salió.
     Y si fue él quien abrió la disputa, ya lo sabe: el de `created` es
     para la oficina, que es la que tiene que reaccionar.
     ============================================================ */
  {
    console.log('\n== AL CLIENTE TAMBIEN SE LE AVISA ==');

    function correosAl(quien) {
      return CORREOS.filter(function (c) {
        const para = (c.to || []).join(',');
        return quien === 'oficina' ? /eurotravel\.com\.mx/.test(para) : /ana@ejemplo\.mx/.test(para);
      });
    }

    /* --- a) un ABONO que se cae: se le dice que su saldo vuelve a subir --- */
    SESION_POR_PAGO = sesionCon({ metadata: Object.assign({}, sesionCon().metadata, { tipo: 'abono' }) });
    EUROSYSTEM_REVERSA = { ok: true, status: 200, datos: { revertido: true } };
    RESEND = { ok: true };
    let r = await avisa('charge.refunded', REEMBOLSO);
    igual('abono revertido: a la oficina le llega', correosAl('oficina').length, 1);
    igual('abono revertido: al cliente también', correosAl('cliente').length, 1);
    cierto('y se le dice que el abono no quedó aplicado',
      /no qued[oó] aplicado|se regres[oó]/i.test(JSON.stringify(correosAl('cliente')[0])));
    cierto('sin decirle que su viaje se cayó, porque no se cayó',
      !/no est[aá] apartado|se cay[oó] tu viaje/i.test(JSON.stringify(correosAl('cliente')[0])));
    igual('y la respuesta sigue siendo la de siempre', r.status, 200);

    /* --- b) el ANTICIPO que se cae: el viaje NO está apartado --- */
    SESION_POR_PAGO = sesionCon();           // sin `tipo` = anticipo
    r = await avisa('charge.refunded', REEMBOLSO);
    igual('anticipo revertido: a la oficina le llega', correosAl('oficina').length, 1);
    igual('anticipo revertido: al cliente también', correosAl('cliente').length, 1);
    cierto('y se le dice que su viaje no quedó apartado',
      /no qued[oó] apartado|no est[aá] apartado/i.test(JSON.stringify(correosAl('cliente')[0])));
    cierto('el correo de la oficina sigue gritando que se cayó un contrato',
      /SE CAYO UN CONTRATO|SE CAY[OÓ] UN CONTRATO/i.test(correosAl('oficina')[0].subject));

    /* --- c) NADIE cancela el contrato solo --- */
    cierto('a EuroSystem solo se le pide revertir, nunca cancelar',
      LLAMADAS_EURO_CRUDAS.every(function (l) { return !/cancel/i.test(l.url); }));
    cierto('y el cuerpo no trae ninguna orden de cancelar',
      LLAMADAS_EURO.every(function (c) { return !/cancel/i.test(JSON.stringify(c)); }));

    /* --- d) la disputa recién abierta: oficina sí, cliente no --- */
    SESION_POR_PAGO = sesionCon();
    CARGO.disputed = true;
    r = await avisa('charge.dispute.created', CONTRACARGO);
    igual('disputa abierta: la oficina se entera', correosAl('oficina').length, 1);
    igual('disputa abierta: al cliente NO se le escribe todavía', correosAl('cliente').length, 0);

    /* --- e) cuando el banco se lleva el dinero, ahí sí --- */
    r = await avisa('charge.dispute.funds_withdrawn', CONTRACARGO);
    igual('dinero retirado: la oficina se entera', correosAl('oficina').length, 1);
    igual('dinero retirado: al cliente también', correosAl('cliente').length, 1);

    /* --- f) sin correo del cliente no se truena: se le dice a la oficina --- */
    SESION_POR_PAGO = sesionCon({
      metadata: { folio: 'ET-Q7TW-K3R', contrato: '51001', nombre: 'Ana Ruiz' },
      customer_details: null
    });
    r = await avisa('charge.refunded', REEMBOLSO);
    igual('sin correo del cliente: a la oficina le llega igual', correosAl('oficina').length, 1);
    igual('sin correo del cliente: no se le escribe a nadie más', correosAl('cliente').length, 0);
    cierto('y el correo de la oficina avisa que no se le pudo escribir',
      /no se le pudo avisar al cliente|sin correo del cliente/i.test(JSON.stringify(correosAl('oficina')[0])));
    igual('y la reversa se atendió igual', r.cuerpo.reversa, true);

    /* --- g) si el correo del cliente falla, la reversa NO se pierde --- */
    SESION_POR_PAGO = sesionCon();
    let cuantos = 0;
    const resendBueno = global.fetch;
    global.fetch = function (url, opc) {
      const u = String(url);
      if (u.indexOf('api.resend.com') >= 0) {
        cuantos++;
        /* el primero (oficina) pasa, el segundo (cliente) truena */
        if (cuantos >= 2) return Promise.resolve({ ok: false, status: 500, json: () => Promise.resolve({}) });
        CORREOS.push(JSON.parse(opc.body));
        return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({ id: 'em' }) });
      }
      return resendBueno(url, opc);
    };
    r = await avisa('charge.refunded', REEMBOLSO);
    global.fetch = resendBueno;
    igual('si falla el correo al cliente, la reversa sigue atendida', r.cuerpo.reversa, true);
    igual('y se contesta 200 porque la oficina sí se enteró', r.status, 200);
  }

  console.log('\n' + buenas + ' buenas, ' + malas + ' malas');
  process.exit(malas ? 1 : 0);
})();
