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

  /* Lo que se cobró de más, dicho en palabras. La oficina tiene que poder
     cuadrar el total con el cliente sin abrir Stripe. */
  const movDias = Number(m.movDias) || 0;
  const nochesExtra = Number(m.nochesExtra) || 0;
  const extras = [];
  if (nochesExtra) {
    extras.push(nochesExtra + (nochesExtra === 1 ? ' noche extra' : ' noches extra') +
      ' ($' + (Number(m.importeNoches) || 0).toLocaleString('es-MX') + ')');
  }
  if (movDias) {
    extras.push(movDias + (movDias === 1 ? ' día' : ' días') + ' con movimientos en destino ' +
      '($' + (Number(m.movImporte) || 0).toLocaleString('es-MX') + ')');
  }
  /* Hay destinos donde el día de movimientos cuesta lo mismo sin importar las
     horas. Si la oficina no lo lee aquí, va a creer que el precio salió mal. */
  const regla = String(m.reglaDestino || '').trim();
  const extrasTexto = extras.length
    ? ' El total incluye ' + extras.join(' y ') + '.' +
      (movDias
        ? (regla
            ? ' En ' + regla + ' el día con movimientos es tarifa fija, sin importar las horas.'
            : ' Cada día con movimientos cubre 8 horas dentro de la zona metropolitana ' +
              'del destino, o 40 km a la redonda del centro.')
        : '')
    : '';

  return {
    /* La misma reserva nunca genera dos contratos, y los folios de EuroSystem
       son consecutivos: un gemelo deja un hueco que ya no se cierra. El id de
       la sesion de Stripe es unico y estable entre reintentos, asi que es la
       referencia perfecta. */
    referenciaExterna: 'WEB-' + String(sesion.id || '').slice(0, 70),
    observaciones: 'Reservado en línea. Folio de la página: ' + (m.folio || '—') +
      '. Anticipo pagado con Stripe' +
      (sesion.payment_method_types && sesion.payment_method_types.length
        ? ' (' + sesion.payment_method_types.join(', ') + ')' : '') + '. ' +
      /* El cotizador en línea pregunta TIPO DE UNIDAD, no cuántos van: el
         precio sale de los kilómetros, no de las cabezas. Así que el «1» de
         abajo es el valor por omisión de la puerta, no un dato del cliente, y
         hay que decirlo o la oficina se lo cree. */
      'PASAJEROS: no se capturan en línea, confirmar con el cliente.' +
      extrasTexto,
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
      /* El punto exacto donde se recoge al grupo, con referencias. Es un campo
         aparte del origen a propósito: «Guadalajara» no le sirve al operador
         a las seis de la mañana, «afuera del Tec, puerta 3» sí. */
      direccionSalida: String(m.puntoSalida || '').trim() || undefined,
      tipoViaje: 'REDONDO',
      /* Las paradas y los días con movimiento, que es exactamente para lo que
         existe este campo: «paradas, horarios, lo que se acordó». Van juntos
         porque el contrato tiene un solo itinerario, y separados por renglón
         para que se lean como dos cosas distintas. */
      itinerario: [
        String(m.paradas || '').trim() ? 'Paradas o escalas: ' + String(m.paradas).trim() : '',
        String(m.movDetalle || '').trim() ? 'Movimientos: ' + String(m.movDetalle).trim() : ''
      ].filter(Boolean).join('\n') || undefined,
      /* `conMovimientos` NO se manda, ni siquiera cuando el cliente contestó
         que no habrá. En EuroSystem, `false` libera la unidad para otro
         servicio los días de en medio, y esa decisión no la puede tomar un
         formulario de internet: el cliente que dice "sin movimientos" muchas
         veces igual espera el camión estacionado en el hotel. Sin el campo,
         EuroSystem se queda en `true`, que es el lado seguro, y la oficina lo
         cambia si está segura. Lo que sí viaja es el dato completo: cuántos
         días con movimiento se pagaron y qué se capturó en cada uno. */
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

/* Le pregunta a Stripe como esta de verdad una sesion. Es la fuente de
   verdad de todo esto: lo que llega en el aviso solo sirve para saber POR
   CUAL preguntar. */
async function traeSesion(id) {
  const clave = (process.env.STRIPE_SECRET_KEY || '').trim();
  if (!clave) return { error: 'sin clave de Stripe' };
  if (!/^cs_[A-Za-z0-9_]{1,100}$/.test(String(id || ''))) return { error: 'id de sesión con mala forma' };
  try {
    const r = await fetch('https://api.stripe.com/v1/checkout/sessions/' + encodeURIComponent(id), {
      headers: { Authorization: 'Bearer ' + clave }
    });
    const d = await r.json();
    if (!r.ok || d.error) return { error: 'Stripe no reconoce la sesión' };
    return { sesion: d };
  } catch (e) {
    return { error: 'no se pudo consultar a Stripe', reintentar: true };
  }
}

/* `crudo` puede ser el cuerpo tal cual (Buffer/texto) o el objeto ya
   parseado, segun lo que deje pasar el entorno. */
async function procesa(crudo, cabeceraFirma) {

  /* Ojo: aqui NO va el guardia de origen de _defensas. Stripe llama de
     servidor a servidor y no manda cabecera Origin ni Referer; exigirla
     cerraria la puerta justo a quien tiene que entrar. */

  let evento;
  const traeBytes = Buffer.isBuffer(crudo) || typeof crudo === 'string';
  if (traeBytes) {
    try { evento = JSON.parse(crudo.toString('utf8')); }
    catch (e) { return { status: 400, cuerpo: { error: 'cuerpo ilegible' } }; }
  } else if (crudo && typeof crudo === 'object') {
    evento = crudo;
  } else {
    return { status: 400, cuerpo: { error: 'cuerpo ilegible' } };
  }

  /* LA FIRMA, cuando se puede. Solo cuadra si llegaron los BYTES exactos: si
     el entorno parseo el cuerpo, no hay nada que verificar. Y no pasa nada,
     porque abajo no se le cree una palabra a este aviso —se le pregunta a
     Stripe—. La firma es la primera puerta, no la unica. */
  const secreto = (process.env.STRIPE_WEBHOOK_SECRET || '').trim();
  if (traeBytes && secreto) {
    const v = firma.verifica(crudo, cabeceraFirma, secreto);
    if (!v.ok) {
      // El motivo se queda en el registro. A quien toco la puerta no se le
      // explica por que no abrio.
      console.error('[webhook] firma rechazada: ' + v.motivo);
      return { status: 400, cuerpo: { error: 'firma inválida' } };
    }
  } else if (!secreto) {
    console.error('[webhook] sin STRIPE_WEBHOOK_SECRET: no se pudo verificar la firma');
  } else {
    console.error('[webhook] el cuerpo no llegó crudo: no se pudo verificar la firma; ' +
      'se procede consultando a Stripe, que es la fuente de verdad');
  }

  const tipo = evento.type;

  const NOS_IMPORTAN = ['checkout.session.completed', 'checkout.session.async_payment_succeeded'];
  if (NOS_IMPORTAN.indexOf(tipo) < 0) {
    return { status: 200, cuerpo: { recibido: true, ignorado: tipo } };
  }

  /* ---------------------------------------------------------------------
     AQUI ESTA LA SEGURIDAD DE VERDAD
     ---------------------------------------------------------------------
     Del aviso solo se toma el ID. Todo lo demas —si se pago, cuanto, de
     quien— se le pregunta a Stripe con nuestra clave secreta. Asi, un aviso
     inventado no sirve de nada: Stripe contesta que esa sesion no existe, o
     que no esta pagada, y no se registra nada.

     Es mas fuerte que creerle a un aviso firmado, porque ni siquiera un
     aviso legitimo pero viejo puede afirmar algo que ya cambio. */
  const idAviso = (evento.data && evento.data.object && evento.data.object.id) || '';
  const consulta = await traeSesion(idAviso);
  if (consulta.error) {
    console.error('[webhook] ' + consulta.error + ' (' + idAviso + ')');
    // Si Stripe no contesto, que se reintente. Si no reconoce la sesion, no.
    return consulta.reintentar
      ? { status: 500, cuerpo: { error: consulta.error } }
      : { status: 200, cuerpo: { recibido: true, error: consulta.error } };
  }
  const sesion = consulta.sesion;

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
