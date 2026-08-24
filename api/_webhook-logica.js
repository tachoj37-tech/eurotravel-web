/* ============================================================
   Webhook de Stripe — función serverless de Vercel
   ------------------------------------------------------------
   Stripe avisa aqui cuando un pago se concreta, y aqui se
   registra el contrato en EuroSystem.

   POR QUE HACE FALTA
   ------------------
   Antes, la unica forma de enterarse de un pago era que el
   cliente regresara a la pagina. Si cerraba la pestaña, o si
   pagaba el voucher de OXXO tres dias despues en la tienda, el
   dinero entraba y NADIE se enteraba salvo que alguien mirara el
   panel de Stripe a mano.

   LOS DOS EVENTOS
   ---------------
   checkout.session.completed              tarjeta: paga al momento
   checkout.session.async_payment_succeeded  OXXO: paga dias despues

   El primero tambien llega con OXXO, pero con payment_status
   `unpaid` —el voucher se genero, el dinero no ha entrado—. Por
   eso no basta con el nombre del evento: se revisa el estado del
   pago antes de registrar nada.

   QUE CONTESTA, Y POR QUE IMPORTA
   -------------------------------
   Stripe reintenta hasta tres dias mientras la respuesta no sea
   2xx. Eso se aprovecha:

     · 200  procesado, o algo que reintentar no arregla (datos que
            EuroSystem rechaza). Reintentar mil veces un 422 solo
            hace ruido.
     · 500  algo que SI se puede arreglar: falta configurar una
            llave, o EuroSystem no contesto. Que Stripe insista
            le da a la oficina tres dias para acomodarlo, y el
            pago no se pierde.
     · 400  la firma no cuadra. No es Stripe.

   LA LLAVE DE EUROSYSTEM ES DE SERVIDOR A SERVIDOR
   ------------------------------------------------
   `CONTRATOS_API_KEY` vive solo en las variables de Vercel y
   jamas sale de aqui. Quien la vea puede registrar contratos a
   nombre de la empresa.
   ============================================================ */

const firma = require('./_firma-stripe');

const EUROSYSTEM = process.env.EUROSYSTEM_URL || 'https://eurosystem-smoky.vercel.app';
const PUERTA = '/api/contratos/externo';

/* El centro de Mexico. Fijo, no calculado: Mexico dejo el horario de verano en
   2022, asi que -06:00 vale todo el año. La puerta de EuroSystem RECHAZA una
   fecha sin zona horaria, y con razon: sin ella cada servidor la lee en la
   suya y el camion sale seis horas antes. */
const ZONA = '-06:00';

function conZona(fecha) {
  const t = String(fecha || '').trim();
  if (!t) return '';
  if (/(Z|[+-]\d{2}:?\d{2})$/.test(t)) return t;          // ya la trae
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(t)) return t + ':00' + ZONA;
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/.test(t)) return t + ZONA;
  if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return t + 'T00:00:00' + ZONA;
  return '';
}

/* AUTOBUS | SPRINTER | SUBURBAN, a partir de como se vende la unidad. */
function claseDeUnidad(nombre) {
  const n = String(nombre || '').toLowerCase();
  if (n.indexOf('sprinter') >= 0) return 'SPRINTER';
  if (n.indexOf('suburban') >= 0) return 'SUBURBAN';
  if (n.indexOf('irizar') >= 0 || n.indexOf('neobus') >= 0 || n.indexOf('autob') >= 0) return 'AUTOBUS';
  return null;
}

/* Arma el cuerpo que pide CONTRATOS-API.md a partir de la metadata que
   pagar.js guardo en la sesion de Stripe. */
function contratoDesde(m, sesion) {
  const nombre = String(m.nombre || '').trim();
  const partes = nombre.split(/\s+/);

  return {
    /* La misma reserva nunca genera dos contratos, y los folios de EuroSystem
       son consecutivos: un gemelo deja un hueco que ya no se cierra. El id de
       la sesion de Stripe es unico y estable entre reintentos, asi que es la
       referencia perfecta. */
    referenciaExterna: 'WEB-' + String(sesion.id || '').slice(0, 70),
    observaciones: 'Reservado en línea. Folio de la página: ' + (m.folio || '—') +
      '. Anticipo pagado con Stripe' +
      (sesion.payment_method_types && sesion.payment_method_types.length
        ? ' (' + sesion.payment_method_types.join(', ') + ')' : '') + '.',
    cliente: {
      nombre: partes[0] || nombre || 'Sin nombre',
      apellidos: partes.slice(1).join(' ') || undefined,
      telefono: String(m.telefono || '').trim(),
      email: String(m.correo || (sesion.customer_details && sesion.customer_details.email) || '').trim() || undefined
    },
    servicio: {
      fechaSalida: conZona(m.salida),
      fechaRegreso: conZona(m.regreso),
      origen: String(m.origen || '').trim() || 'Por confirmar',
      destino: String(m.destino || '').trim() || 'Por confirmar',
      tipoViaje: 'REDONDO',
      tipoUnidad: claseDeUnidad(m.unidad) || undefined,
      tipoUnidadDetalle: String(m.unidad || '').trim() || undefined,
      pasajeros: 1
    },
    cobro: {
      montoTotal: Number(m.total) || 0,
      anticipo: Number(m.anticipo) || 0,
      formaPago: 'TARJETA',
      condicionesPago: 'Anticipo pagado en línea. Saldo por cubrir antes de la salida.',
      incluyeCombustible: true,
      incluyeCasetas: true
    }
  };
}

async function procesa(crudo, cabeceraFirma) {

  /* Ojo: aqui NO va el guardia de origen de _defensas. Stripe llama de
     servidor a servidor y no manda cabecera Origin ni Referer; exigirla
     cerraria la puerta justo a quien tiene que entrar. Lo que la protege es
     la firma, que es mas fuerte que cualquier lista de origenes. */

  const secreto = (process.env.STRIPE_WEBHOOK_SECRET || '').trim();

  const v = firma.verifica(crudo, cabeceraFirma, secreto);
  if (!v.ok) {
    // El motivo se queda en el registro del servidor. A quien tocó la puerta
    // no se le explica por qué no abrió.
    console.error('[webhook] firma rechazada: ' + v.motivo);
    return { status: 400, cuerpo: { error: 'firma inválida' } };
  }

  let evento;
  try { evento = JSON.parse(crudo.toString('utf8')); }
  catch (e) { return { status: 400, cuerpo: { error: 'cuerpo ilegible' } }; return; }

  const tipo = evento.type;
  const sesion = (evento.data && evento.data.object) || {};

  const NOS_IMPORTAN = ['checkout.session.completed', 'checkout.session.async_payment_succeeded'];
  if (NOS_IMPORTAN.indexOf(tipo) < 0) {
    return { status: 200, cuerpo: { recibido: true, ignorado: tipo } };
  }

  /* No basta el nombre del evento: `completed` tambien llega con OXXO, con el
     voucher generado y el dinero SIN entrar. Se registra contrato solo cuando
     el pago de verdad esta hecho. */
  const pagado = sesion.payment_status === 'paid' || sesion.payment_status === 'no_payment_required';
  if (!pagado) {
    console.log('[webhook] ' + tipo + ' sin pago aún (' + sesion.payment_status + '), no se registra');
    return { status: 200, cuerpo: { recibido: true, pendiente: true } };
  }

  const llave = (process.env.CONTRATOS_API_KEY || '').trim();
  if (!llave) {
    /* 500 a proposito: Stripe reintenta hasta tres dias, y eso le da a la
       oficina tiempo de configurar la llave sin perder el pago. */
    console.error('[webhook] falta CONTRATOS_API_KEY: el pago ' + (sesion.id || '') +
      ' NO se registró. Stripe reintentará.');
    return { status: 500, cuerpo: { error: 'sin llave de EuroSystem' } };
  }

  const cuerpo = contratoDesde(sesion.metadata || {}, sesion);

  if (!cuerpo.servicio.fechaSalida || !cuerpo.servicio.fechaRegreso) {
    console.error('[webhook] fechas ilegibles en la sesión ' + (sesion.id || '') +
      ': salida="' + (sesion.metadata || {}).salida + '" regreso="' + (sesion.metadata || {}).regreso +
      '". Registrar a mano.');
    return { status: 200, cuerpo: { recibido: true, error: 'fechas ilegibles' } };
  }

  try {
    const r = await fetch(EUROSYSTEM + PUERTA, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': llave },
      body: JSON.stringify(cuerpo)
    });
    const d = await r.json().catch(function () { return {}; });

    if (r.ok) {
      console.log('[webhook] contrato ' + d.folio + (d.repetido ? ' (ya existía)' : ' creado') +
        ' para la sesión ' + sesion.id);
      return { status: 200, cuerpo: { recibido: true, folio: d.folio, repetido: !!d.repetido } };
    }

    /* 401/422 no se arreglan reintentando: la llave está mal o los datos no
       pasan la validación. Se acusa recibo para que Stripe deje de insistir, y
       se grita en el registro para que alguien lo capture a mano. */
    if (r.status === 401 || r.status === 422 || r.status === 400) {
      console.error('[webhook] EuroSystem rechazó el contrato (' + r.status + '): ' +
        JSON.stringify(d).slice(0, 400) + ' — sesión ' + sesion.id + '. REGISTRAR A MANO.');
      return { status: 200, cuerpo: { recibido: true, error: 'rechazado por EuroSystem' } };
    }

    // 429, 500, 503: sí se arreglan esperando. Que Stripe reintente.
    console.error('[webhook] EuroSystem contestó ' + r.status + '; Stripe reintentará. Sesión ' + sesion.id);
    return { status: 500, cuerpo: { error: 'EuroSystem no disponible' } };
  } catch (e) {
    console.error('[webhook] no se pudo hablar con EuroSystem: ' + e.message + '; Stripe reintentará.');
    return { status: 500, cuerpo: { error: 'EuroSystem inalcanzable' } };
  }
}

module.exports = { procesa, contratoDesde, conZona, claseDeUnidad };
