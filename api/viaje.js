/* ============================================================
   El viaje del cliente, abierto con su propia liga
   ------------------------------------------------------------
   El cliente pagó, le llegó su correo, y ahí venía un botón:
   «Ver mi viaje». Esto es lo que contesta cuando le da clic.

   EL ORDEN IMPORTA, Y NO ES NEGOCIABLE

       1. se verifica la FIRMA de la liga
       2. y solo entonces se le pregunta a Stripe

   Si se preguntara primero, una liga inventada nos haría
   consultar sesiones ajenas —una por intento— y eso ya es una
   fuga: quien prueba identificadores se entera de cuáles
   existen, aunque nunca le contestemos con los datos.

   NO SE LE CREE NADA AL NAVEGADOR

   La liga dice de qué sesión se trata; TODO lo demás —si está
   pagado, cuánto, a dónde va— se le pregunta a Stripe con
   nuestra clave. Es la misma disciplina del webhook.

   Y lo que sale pasa por `_publico.js`, que es el único dueño de
   la regla del kilómetro. En la metadata de Stripe vive `km`, y
   de ahí no pasa.
   ============================================================ */

const defensas = require('./_defensas');
const ligas = require('./_ligas');
const acceso = require('./_acceso');
const stripe = require('./_stripe');
const publico = require('./_publico');

/* Es una pantalla que el cliente recarga y comparte consigo mismo entre el
   teléfono y la computadora. Generoso, pero no infinito: cada visita cuesta
   una consulta a Stripe. */
const freno = defensas.creaFreno({ porMinuto: 20, porDia: 800 });

module.exports = async function handler(req, res) {
  if (defensas.puerta(req, res)) return;

  const frenado = freno(req);
  if (frenado) { res.status(frenado.status).json({ error: frenado.error }); return; }

  const cuerpo = defensas.cuerpoJSON(req);

  /* ---- 1. LA FIRMA, ANTES DE TOCAR STRIPE ---- */
  const puerta = ligas.abre(cuerpo.t);
  if (!puerta.ok) {
    /* El motivo se queda en el registro. A quien toca la puerta no se le
       explica por qué no abrió: decirle «la firma no cuadra» contra «esa
       sesión no existe» ya le enseña algo. */
    console.error('[viaje] liga rechazada: ' + puerta.motivo);

    /* La ÚNICA excepción, y es a favor del cliente: si la liga solo está
       vencida, hay que mandarlo a la segunda puerta en vez de dejarlo
       mirando un error sin salida. */
    if (puerta.vencida) {
      res.status(410).json({
        error: 'liga vencida',
        vencida: true,
        aviso: 'Esta liga ya venció. Escríbenos por WhatsApp con tu folio y te mandamos una nueva.'
      });
      return;
    }
    res.status(404).json({ error: 'no encontrado', aviso: 'Esta liga no es válida.' });
    return;
  }

  /* ---- 2. AHORA SÍ, QUE STRIPE DIGA LA VERDAD ---- */
  if (!stripe.hayClave()) {
    res.status(503).json({ error: 'sin configurar', aviso: 'No pudimos consultar tu viaje ahora mismo.' });
    return;
  }

  const consulta = await stripe.traeSesion(puerta.sesion);
  if (consulta.error) {
    console.error('[viaje] ' + consulta.error + ' (' + puerta.sesion + ')');
    /* Si Stripe no contestó, es pasajero y se le dice que reintente. Si no
       reconoce la sesión, la liga es válida pero apunta a nada: raro, y se
       trata como no encontrado. */
    res.status(consulta.reintentar ? 503 : 404).json({
      error: consulta.error,
      aviso: consulta.reintentar
        ? 'No pudimos consultar tu viaje ahora mismo. Vuelve a intentar en un momento.'
        : 'No encontramos ese viaje.'
    });
    return;
  }

  const sesion = consulta.sesion;

  /* ------------------------------------------------------------
     3. ¿YA SE VERIFICO, O HAY QUE MANDARLE UN CODIGO?

     La liga sola YA NO ABRE NADA. Prueba que la liga es legítima, no que
     quien la tiene sea su dueño: una liga reenviada, o dejada en el
     historial de una computadora prestada, sigue siendo válida.

     La sesión va atada al CLIENTE, no al viaje: quien tiene dos viajes con
     Eurotravel verifica una vez y ve los dos. Y comprobarla contra ESTE
     cliente es lo que impide que quien ya verificó lo suyo entre a lo ajeno
     nada más cambiando la liga.
     ------------------------------------------------------------ */
  const idCliente = typeof sesion.customer === 'string' ? sesion.customer
                  : (sesion.customer && sesion.customer.id) || '';

  if (!acceso.sesionValida(acceso.sesionDe(req), idCliente)) {
    const aDonde = String((sesion.metadata || {}).correo ||
      (sesion.customer_details && sesion.customer_details.email) || '');
    res.status(200).json({
      requiereCodigo: true,
      correo: acceso.pistaDeCorreo(aDonde),
      horas: acceso.HORAS_SESION
    });
    return;
  }

  /* Un viaje que nunca se pagó no tiene nada que enseñar. Puede pasar con un
     voucher de OXXO generado y no pagado: la liga existe desde que se creó la
     sesión, pero el dinero no ha entrado. */
  if (consulta.estado === 'sinPagar') {
    res.status(200).json({ estado: 'sinPagar',
      aviso: 'Este viaje todavía no tiene un pago registrado.' });
    return;
  }

  /* ---- 3. LO QUE PUEDE VER, Y NADA MÁS ---- */
  res.status(200).json(publico.viaje(sesion.metadata || {}, consulta.estado));
};
