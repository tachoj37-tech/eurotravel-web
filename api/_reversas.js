/* ============================================================
   Cuando el dinero se regresa
   ------------------------------------------------------------
   Un reembolso o un contracargo significa que el dinero que ya
   habíamos dado por bueno SALIÓ de la cuenta. Si nadie se entera,
   el sistema sigue diciendo que ese viaje está pagado y la unidad
   sale sin que nadie haya pagado por ella. Eso es dinero perdido
   de verdad, no un detalle de registro.

   LO QUE HABIA ANTES: NADA

   Se comprobó mandándole un `charge.refunded` al webhook: contestaba
   «200 · ignorado». Stripe lo daba por entregado y NUNCA reintentaba.
   Nadie se enteraba nunca.

   DOS CASOS, Y NO SE PARECEN

     ANTICIPO — es el pago que creó el contrato. Si ése se regresa,
                el viaje nunca se pagó: hay que QUEMAR EL FOLIO.
     ABONO    — el contrato sigue en pie y su anticipo también. Solo
                se revierte ese abono y el saldo vuelve a subir.

   EL CORREO A LA OFICINA ES LA GARANTIA, NO EL ADORNO

   El aviso se manda SIEMPRE, aunque EuroSystem lo registre bien:
   una reversa no es un movimiento de rutina, es una llamada que
   alguien tiene que hacerle al cliente antes del día del viaje. Y
   se manda ANTES de decidir qué se le contesta a Stripe, porque el
   dinero ya salió de la cuenta y eso no espera reintentos.

   Para que EuroSystem la registre se llama a la puerta de
   CONTRATOS-API.md §13. Si esa puerta dice que no —incluido el 404
   de «ese cobro aún no está registrado»— se le contesta a Stripe
   con un 500 para que insista: lo pide la propia §13, y sin eso la
   reversa se pierde.

   El nombre empieza con guion bajo para que Vercel no lo publique
   como una dirección más del sitio.
   ============================================================ */

/* Los avisos de Stripe que significan «el dinero se fue».

   `charge.dispute.created` es cuando el banco del cliente abre la disputa;
   `charge.dispute.funds_withdrawn` es cuando Stripe ya retiró el dinero de la
   cuenta. Se atienden LOS DOS: el primero para enterarse a tiempo, el segundo
   porque es el que de verdad mueve el dinero. La idempotencia por pago hace
   que los dos juntos no reviertan dos veces. */
const AVISOS = {
  'charge.refunded': 'REEMBOLSO',
  'charge.dispute.created': 'CONTRACARGO',
  'charge.dispute.funds_withdrawn': 'CONTRACARGO'
};

function esReversa(tipo) {
  return Object.prototype.hasOwnProperty.call(AVISOS, String(tipo || ''));
}
function motivoDe(tipo) { return AVISOS[String(tipo || '')] || 'REVERSA'; }

/* ------------------------------------------------------------
   DE QUE PAGO HABLA ESTE AVISO
   ------------------------------------------------------------
   Los tres avisos traen el objeto en distinto lugar: un `charge`
   lleva `payment_intent` directo; una `dispute` lo lleva igual
   pero además trae el `charge`. Se saca de donde esté.
   ------------------------------------------------------------ */
function pagoDelAviso(objeto) {
  const o = objeto || {};
  const pi = o.payment_intent;
  if (typeof pi === 'string' && pi) return pi;
  if (pi && typeof pi.id === 'string') return pi.id;
  return '';
}

/* Cuánto se fue, en pesos. Stripe cuenta en centavos.

   En un reembolso es `amount_refunded`; en una disputa es `amount`. Si no se
   entiende, se devuelve 0 y el aviso lo dice: vale más avisar sin el monto
   que no avisar. */
function montoRevertido(tipo, objeto) {
  const o = objeto || {};
  const centavos = String(tipo).indexOf('dispute') >= 0
    ? Number(o.amount)
    : Number(o.amount_refunded !== undefined ? o.amount_refunded : o.amount);
  if (!isFinite(centavos) || centavos < 0) return 0;
  return Math.round(centavos) / 100;
}

/* ------------------------------------------------------------
   EL VEREDICTO DE STRIPE, QUE ES EL QUE VALE
   ------------------------------------------------------------
   Lo de arriba lee el AVISO. Esto lee el COBRO tal como lo tiene
   Stripe, que es otra cosa: el aviso lo escribe quien llama a la
   puerta, el cobro lo escribe Stripe.

   Hizo falta porque se comprobó que la firma se puede saltar
   mandando `Content-Type: application/json` —Vercel parsea el
   cuerpo, se pierden los bytes exactos y ya no hay firma que
   comprobar—. Sin este segundo candado, cualquiera que supiera un
   `pi_…` podía inventar un reembolso y quemarle el folio a un
   viaje pagado.

   El monto sale de aquí, NUNCA del aviso.

   Nota de un caso raro: una disputa vieja YA GANADA deja
   `disputed` en true para siempre. Un aviso inventado sobre ese
   cobro pasaría este filtro y llegaría un correo de más a la
   oficina. Se prefiere ese correo de más a dejar pasar uno de
   menos: un contracargo que nadie ve sí cuesta dinero.
   ------------------------------------------------------------ */
function loQueDiceStripe(motivo, cargo) {
  const c = cargo || {};

  if (motivo === 'CONTRACARGO') {
    if (c.disputed !== true) {
      return { confirmada: false, porque: 'Stripe no ve ninguna disputa en ese cobro' };
    }
    const total = Number(c.amount);
    return { confirmada: true, monto: isFinite(total) && total > 0 ? Math.round(total) / 100 : 0 };
  }

  const devuelto = Number(c.amount_refunded);
  if (!isFinite(devuelto) || devuelto <= 0) {
    return { confirmada: false, porque: 'Stripe no ve ninguna devolución en ese cobro' };
  }
  return { confirmada: true, monto: Math.round(devuelto) / 100 };
}

/* ------------------------------------------------------------
   ¿ERA EL ANTICIPO O UN ABONO?
   ------------------------------------------------------------
   Lo dice la metadata de la sesión: los abonos se abren con
   `tipo = 'abono'`. Todo lo demás es el pago que creó el
   contrato.

   Se decide por lo que se ESCRIBIO al cobrar, no por el monto ni
   por la fecha: adivinar aquí sería quemar el folio de alguien
   que solo pidió un reembolso parcial de un abono.
   ------------------------------------------------------------ */
function claseDePago(metadata) {
  return String((metadata || {}).tipo || '') === 'abono' ? 'ABONO' : 'ANTICIPO';
}

/* ------------------------------------------------------------
   LO QUE SE LE PIDE A EUROSYSTEM
   ------------------------------------------------------------
   `POST /api/contratos/abono-externo/revertir`, CONTRATOS-API.md §13.
   DOS campos, ni uno más, y EuroSystem rechaza con 422 lo que no
   entienda:

     referencia   el `pi_…` de Stripe — EXACTAMENTE el mismo con el
                  que la página registra el abono al cobrarlo, que es
                  lo que hace idempotente a la puerta: el mismo pago
                  revertido nunca descuenta dos veces ni quema dos
                  folios.
     motivo       'reembolso' o 'contracargo'. EN MINUSCULAS: lo que
                  se usa aquí adentro —REEMBOLSO, CONTRACARGO— es
                  para que la oficina lo lea, no para EuroSystem.

   Lo demás que antes viajaba aquí —el tipo, el monto, la referencia
   del contrato, un detalle escrito— no lo pide esa puerta: EuroSystem
   ya sabe de qué contrato es el abono, y el monto lo tiene anotado de
   cuando entró. Todo eso sigue yendo al correo de la oficina, que es
   quien sí lo necesita para actuar.
   ------------------------------------------------------------ */
const MOTIVO_EUROSYSTEM = { REEMBOLSO: 'reembolso', CONTRACARGO: 'contracargo' };

function cuerpoParaEuroSystem(datos) {
  return {
    referencia: datos.pago,
    motivo: MOTIVO_EUROSYSTEM[datos.motivo] || 'reembolso'
  };
}

/* ------------------------------------------------------------
   EL AVISO A LA OFICINA
   ------------------------------------------------------------
   Tiene que servir para actuar SIN abrir Stripe y SIN abrir
   EuroSystem: quién, cuánto, de qué folio, qué pasó y qué hay que
   hacer. Si alguien lo lee en el celular a las once de la noche,
   tiene que entenderlo completo.
   ------------------------------------------------------------ */
function avisoDeReversa(datos) {
  const quemar = datos.clase === 'ANTICIPO';
  const pesos = function (n) {
    return '$' + Number(n || 0).toLocaleString('es-MX', { maximumFractionDigits: 0 });
  };

  const asunto = (quemar ? 'SE CAYO UN CONTRATO' : 'SE REVIRTIO UN ABONO') +
    ' · folio ' + (datos.folio || '—') + ' · ' + pesos(datos.monto);

  const renglones = [
    quemar
      ? 'El pago que creó este contrato SE REGRESÓ. El viaje NO está pagado.'
      : 'Un abono de este contrato se regresó. El saldo vuelve a subir.',
    '',
    'Folio:            ' + (datos.folio || '—'),
    'Contrato:         ' + (datos.contrato || '—'),
    'Cliente:          ' + (datos.nombre || '—'),
    'Correo:           ' + (datos.correo || '—'),
    'Teléfono:         ' + (datos.telefono || '—'),
    'Ruta:             ' + (datos.ruta || '—'),
    'Salida:           ' + (datos.salida || '—'),
    '',
    'Qué pasó:         ' + (datos.motivo === 'CONTRACARGO'
      ? 'CONTRACARGO — el banco del cliente disputó el cargo'
      : 'REEMBOLSO — el cargo se devolvió'),
    'Monto que se fue: ' + pesos(datos.monto),
    'Pago de Stripe:   ' + (datos.pago || '—'),
    '',
    'QUÉ HAY QUE HACER',
    quemar
      ? '  1. Cancelar el contrato ' + (datos.contrato || '—') + ' en EuroSystem.'
      : '  1. Marcar revertido ese abono en el contrato ' + (datos.contrato || '—') + '.',
    '  2. Avisarle al cliente antes de que se presente el día del viaje.',
    quemar ? '  3. Liberar la unidad de ese día.' : '',
    '',
    datos.eurosystem === true
      ? 'EuroSystem ya lo registró solo. Esto es nada más para que lo sepan.'
      : 'EuroSystem NO pudo registrarlo (' + (datos.eurosystemMotivo || 'sin detalle') +
        '). HAY QUE HACERLO A MANO.',
    '',
    'Verlo en Stripe: https://dashboard.stripe.com/payments/' + (datos.pago || '')
  ].filter(function (l) { return l !== ''; });

  return { asunto: asunto, texto: renglones.join('\n') };
}

module.exports = {
  AVISOS, esReversa, motivoDe, pagoDelAviso, montoRevertido, loQueDiceStripe,
  claseDePago, cuerpoParaEuroSystem, avisoDeReversa
};
