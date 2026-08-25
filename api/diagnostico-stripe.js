/* ============================================================
   DIAGNOSTICO TEMPORAL — BORRAR DESPUES DE USARLO
   ------------------------------------------------------------
   Comprueba contra la cuenta REAL de Stripe la cadena de la que
   depende todo el diseño de "mis viajes" y los abonos:

     1. las sesiones que crea pagar.js quedan con `customer`
        (o sea, customer_creation:'always' hace lo que dice)
     2. se puede encontrar a un cliente por su correo
     3. se pueden listar TODAS las sesiones de ese cliente

   Si las tres dan si, la liga y el "folio + codigo" se pueden
   construir sin base de datos propia y sin usar la busqueda de
   Stripe, que va retrasada hasta un minuto.

   NO devuelve datos personales completos: correos y nombres
   salen enmascarados. Solo interesa el si/no.
   ============================================================ */

const defensas = require('./_defensas');

const STRIPE = 'https://api.stripe.com/v1';

function tapa(texto) {
  const t = String(texto || '');
  if (!t) return null;
  const arroba = t.indexOf('@');
  if (arroba > 1) return t[0] + '***' + t.slice(arroba);
  return t.slice(0, 2) + '***';
}

async function aStripe(ruta, clave) {
  const r = await fetch(STRIPE + ruta, {
    headers: { 'Authorization': 'Bearer ' + clave }
  });
  return { ok: r.ok, estado: r.status, datos: await r.json() };
}

module.exports = async function handler(req, res) {
  if (defensas.puerta(req, res)) return;

  const clave = (process.env.STRIPE_SECRET_KEY || '').trim();
  if (!clave) { res.status(503).json({ error: 'sin STRIPE_SECRET_KEY' }); return; }

  const salida = { modo: clave.indexOf('sk_test_') === 0 ? 'prueba' : 'produccion', pasos: {} };

  try {
    /* --- 1. las ultimas sesiones: ¿traen customer? --- */
    const lista = await aStripe('/checkout/sessions?limit=10', clave);
    if (!lista.ok) {
      res.status(502).json({ error: 'stripe: ' + JSON.stringify(lista.datos).slice(0, 200) });
      return;
    }
    const sesiones = lista.datos.data || [];
    const conCliente = sesiones.filter(function (s) { return !!s.customer; });

    salida.pasos.uno = {
      pregunta: 'las sesiones de pagar.js quedan con customer',
      sesionesRevisadas: sesiones.length,
      conCustomer: conCliente.length,
      sinCustomer: sesiones.length - conCliente.length,
      ejemplo: sesiones[0] ? {
        customer_creation: sesiones[0].customer_creation,
        tieneCustomer: !!sesiones[0].customer,
        payment_status: sesiones[0].payment_status,
        folioEnMetadata: !!(sesiones[0].metadata && sesiones[0].metadata.folio),
        correo: tapa(sesiones[0].customer_details && sesiones[0].customer_details.email)
      } : null
    };

    if (!conCliente.length) {
      salida.veredicto = 'NO HAY SESIONES CON CLIENTE: no se puede comprobar lo demas';
      res.status(200).json(salida);
      return;
    }

    /* --- 2. buscar al cliente por su correo --- */
    const muestra = conCliente[0];
    const correo = (muestra.customer_details && muestra.customer_details.email) ||
                   muestra.customer_email || '';

    const porCorreo = await aStripe('/customers?email=' + encodeURIComponent(correo) + '&limit=5', clave);
    const clientes = (porCorreo.datos && porCorreo.datos.data) || [];

    salida.pasos.dos = {
      pregunta: 'se encuentra al cliente filtrando por correo',
      correoBuscado: tapa(correo),
      encontrados: clientes.length,
      elMismo: clientes.some(function (c) { return c.id === muestra.customer; })
    };

    /* ...y con el correo en MAYUSCULAS, para medir si de verdad distingue */
    if (correo && correo !== correo.toUpperCase()) {
      const mayus = await aStripe('/customers?email=' + encodeURIComponent(correo.toUpperCase()) + '&limit=5', clave);
      salida.pasos.dos.conMayusculasEncuentra = (((mayus.datos || {}).data) || []).length;
      salida.pasos.dos.nota = salida.pasos.dos.conMayusculasEncuentra === 0
        ? 'CONFIRMADO: distingue mayusculas. Hay que normalizar SIEMPRE a minusculas.'
        : 'no distingue mayusculas en esta cuenta';
    }

    /* --- 3. listar todas las sesiones de ese cliente --- */
    const suyas = await aStripe('/checkout/sessions?customer=' + encodeURIComponent(muestra.customer) + '&limit=20', clave);
    const lasSuyas = (suyas.datos && suyas.datos.data) || [];

    salida.pasos.tres = {
      pregunta: 'se listan todas las sesiones de ese cliente',
      estado: suyas.estado,
      cuantas: lasSuyas.length,
      todasSonSuyas: lasSuyas.every(function (s) { return s.customer === muestra.customer; }),
      folios: lasSuyas.map(function (s) { return (s.metadata || {}).folio || '(sin folio)'; })
    };

    /* --- 4. y traer una sola por su id, que es lo que hara la liga --- */
    const una = await aStripe('/checkout/sessions/' + encodeURIComponent(muestra.id), clave);
    salida.pasos.cuatro = {
      pregunta: 'se trae una sesion por su id, directo y sin retraso',
      estado: una.estado,
      folio: (una.datos && una.datos.metadata && una.datos.metadata.folio) || null,
      total: (una.datos && una.datos.metadata && una.datos.metadata.total) || null
    };

    const todoBien = salida.pasos.uno.conCustomer > 0 &&
                     salida.pasos.dos.elMismo &&
                     salida.pasos.tres.todasSonSuyas &&
                     salida.pasos.cuatro.estado === 200;

    salida.veredicto = todoBien
      ? 'LA CADENA COMPLETA FUNCIONA: se puede sin base de datos propia'
      : 'ALGO NO CUADRA: revisar los pasos';

    res.status(200).json(salida);
  } catch (e) {
    res.status(502).json({ error: String(e && e.message) });
  }
};
