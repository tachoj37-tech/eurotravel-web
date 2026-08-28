/* ============================================================
   Un pago de prueba no quema un folio
   ------------------------------------------------------------
       node pruebas/probar-pago-de-prueba.cjs

   POR QUE EXISTE

   El dueño pidió el 27-ago-2026 poder recorrer la compra completa
   —pagar, ver su correo, ver su viaje en «Mis viajes»— antes de
   lanzar, desde el dominio de hoy.

   Se midió qué le costaba: una tarjeta de prueba de Stripe creaba
   un contrato DE VERDAD en EuroSystem y le quemaba un folio del
   consecutivo. Y no una vez: cada vez que quisiera probar.

   Se puede separar limpio porque EL FOLIO QUE VE EL CLIENTE LO
   GENERA LA PAGINA, no EuroSystem. Así que en una prueba sigue
   pasando casi todo.

   LO QUE SE CUIDA, y el orden importa:

     1. Un pago DE VERDAD se registra siempre. Equivocarse hacia
        «no registrar» pierde una venta en silencio, que es lo
        más caro que puede pasar aquí.
     2. Un pago de prueba NO toca EuroSystem.
     3. Pero sí manda el correo y sí aparece en «Mis viajes».
     4. Y el aviso a la oficina dice que fue prueba.
   ============================================================ */
'use strict';

process.env.LIGAS_SECRETO = 'secreto-de-prueba-1234567890';
process.env.STRIPE_SECRET_KEY = 'sk_test_x';
process.env.RESEND_API_KEY = 're_x';
process.env.CONTRATOS_API_KEY = 'llave-de-prueba';

let buenas = 0, malas = 0;
function igual(nombre, dio, esperado) {
  const a = JSON.stringify(dio), b = JSON.stringify(esperado);
  if (a === b) { buenas++; console.log('ok   ' + nombre); }
  else { malas++; console.log('MAL  ' + nombre + '\n     dio      ' + a + '\n     esperaba ' + b); }
}
function cierto(nombre, v) { igual(nombre, !!v, true); }
function falso(nombre, v) { igual(nombre, !!v, false); }

const METADATA = {
  folio: 'ET-Q7TW-K3R', nombre: 'Ana Ruiz', correo: 'ana@ejemplo.mx',
  origen: 'Guadalajara', destino: 'Chapala',
  salida: '2026-09-10T08:00', regreso: '2026-09-10T18:00',
  total: 6500, anticipo: 3250, saldo: 3250, unidad: 'Sprinter', pasajeros: 12
};

let TOCO_EUROSYSTEM, CORREOS, SESION;

function arma(livemode) {
  TOCO_EUROSYSTEM = false;
  CORREOS = [];
  SESION = {
    id: 'cs_test_' + '9'.repeat(20), payment_status: 'paid', status: 'complete',
    customer: 'cus_00000000000001', livemode: livemode, metadata: METADATA
  };
}

global.fetch = async function (url, opc) {
  const u = String(url);
  if (u.indexOf('/checkout/sessions/') >= 0) {
    return { ok: true, status: 200, json: async () => SESION };
  }
  if (u.indexOf('/contratos/externo') >= 0) {
    TOCO_EUROSYSTEM = true;
    return { ok: true, status: 200, json: async () => ({ folio: '51001', pdfBase64: 'JVBERi0x' }) };
  }
  if (u.indexOf('resend') >= 0) {
    CORREOS.push(JSON.parse(opc.body));
    return { ok: true, status: 200, json: async () => ({ id: 'em' }) };
  }
  throw new Error('inesperado: ' + u);
};

const logica = require('../api/_webhook-logica.js');

function aviso() {
  return JSON.stringify({ type: 'checkout.session.completed',
    data: { object: { id: SESION.id } } });
}

(async function () {

  /* ============ 1. UN PAGO DE VERDAD SE REGISTRA. SIEMPRE. ============
     Va primero a propósito: es lo que no se puede romper. Equivocarse hacia
     «no registrar» pierde una venta y nadie se entera. */
  {
    arma(true);
    const r = await logica.procesa(aviso(), '');
    igual('un pago real contesta bien', r.status, 200);
    cierto('SI se registra en EuroSystem', TOCO_EUROSYSTEM);
    igual('con su folio de EuroSystem', r.cuerpo.folio, '51001');
    falso('y no se marca como prueba', r.cuerpo.prueba);
    igual('sale UN correo, el del cliente', CORREOS.length, 1);
    igual('a él', CORREOS[0].to, ['ana@ejemplo.mx']);
    cierto('con su contrato adjunto', !!(CORREOS[0].attachments || []).length);
  }

  /* ============ 2. SI EL CAMPO NO VIENE, TAMBIEN SE REGISTRA ============
     La polaridad del candado. Un aviso viejo, un Stripe que cambie el nombre
     del campo, cualquier cosa: ante la duda, SE REGISTRA. */
  {
    arma(true); delete SESION.livemode;
    const sinCampo = await logica.procesa(aviso(), '');
    cierto('sin el campo, se registra igual', TOCO_EUROSYSTEM);
    falso('y no se marca como prueba', sinCampo.cuerpo.prueba);

    const rarezas = [null, undefined, 0, '', 'false', 'no', {}];
    const noRegistrados = [];
    for (let i = 0; i < rarezas.length; i++) {
      arma(true); SESION.livemode = rarezas[i];
      await logica.procesa(aviso(), '');
      if (!TOCO_EUROSYSTEM) noRegistrados.push(JSON.stringify(rarezas[i]));
    }
    igual('ningún valor raro impide registrar un cobro', noRegistrados, []);
  }

  /* ============ 3. UN PAGO DE PRUEBA NO TOCA EUROSYSTEM ============ */
  {
    arma(false);
    const r = await logica.procesa(aviso(), '');
    igual('contesta bien, no es un error', r.status, 200);
    falso('NO se registró en EuroSystem', TOCO_EUROSYSTEM);
    cierto('y se dice que fue prueba', r.cuerpo.prueba);
    falso('sin folio de EuroSystem, porque no lo hubo', r.cuerpo.folio);
  }

  /* ============ 4. PERO SI PASA TODO LO DEMAS ============
     Que es justo lo que el dueño quiere poder ver. */
  {
    arma(false);
    await logica.procesa(aviso(), '');

    igual('salen DOS correos: el del cliente y el de la oficina', CORREOS.length, 2);

    const alCliente = CORREOS.find(function (c) { return c.to[0] === 'ana@ejemplo.mx'; });
    cierto('al cliente le llega el suyo', !!alCliente);
    cierto('con su folio de la página', /ET-Q7TW-K3R/.test(alCliente.text));
    cierto('y con su liga para ver el viaje', /viaje\.html\?t=/.test(alCliente.text));
    falso('sin contrato adjunto, que ése sí lo hace EuroSystem',
      !!(alCliente.attachments || []).length);

    const aLaOficina = CORREOS.find(function (c) { return c !== alCliente; });
    cierto('y la oficina se entera', !!aLaOficina);
    cierto('de que fue una prueba', /PRUEBA/i.test(aLaOficina.subject));
    cierto('y de que no se quemó folio', /no se quem/i.test(aLaOficina.text));
    cierto('y se le avisa qué significaría después del lanzamiento',
      /lanzamiento/i.test(aLaOficina.text));
  }

  /* ============ 5. NI SIQUIERA UN AVISO MENTIROSO LO APAGA ============
     El dato sale de la sesión que se le PREGUNTO a Stripe, no del aviso. Si
     saliera del aviso, cualquiera mandaría «esto era una prueba» para que un
     cobro de verdad no se registrara nunca. */
  {
    arma(true);
    const mentiroso = JSON.stringify({
      type: 'checkout.session.completed',
      data: { object: { id: SESION.id, livemode: false } }
    });
    await logica.procesa(mentiroso, '');
    cierto('un aviso que dice «es prueba» NO impide registrar un cobro real',
      TOCO_EUROSYSTEM);
  }

  console.log('\n' + buenas + ' buenas, ' + malas + ' malas');
  process.exit(malas ? 1 : 0);
})();
