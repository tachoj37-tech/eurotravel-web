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
const saldos = require('./_saldo');       // la cuenta de los abonos
const portal = require('./_portal');      // «Abona a tu viaje», contra EuroSystem

/* Es una pantalla que el cliente recarga y comparte consigo mismo entre el
   teléfono y la computadora. Generoso, pero no infinito: cada visita cuesta
   una consulta a Stripe. */
const freno = defensas.creaFreno({ porMinuto: 20, porDia: 800 });

/* ============================================================
   «ABONA A TU VIAJE» · LA ÚNICA ENTRADA SIN LIGA Y SIN CÓDIGO
   ------------------------------------------------------------
   El cliente que nunca compró en línea —el que apartó por
   teléfono y firmó en la oficina— no tiene liga ni sesión de
   Stripe. Lo único que tiene es su contrato impreso. Así que
   entra con el NÚMERO DE CONTRATO y un APELLIDO, y eso se le
   pregunta a EuroSystem (CONTRATOS-API.md §12).

   VIVE AQUÍ DENTRO, no en un `api/portal.js`. El plan publica
   DOCE funciones y hay doce exactas: un archivo más en `api/`
   tumba el despliegue entero —ya pasó el 26-ago-2026—. Es la
   misma salida que tomaron abonar y la vuelta de Stripe.

   EL FRENO ES LA PUERTA, NO UN ADORNO
   -----------------------------------
   Aquí se adivina un APELLIDO, y un apellido se adivina: con los
   veinte por minuto de la pantalla del viaje, quien prueba
   «García, Hernández, López…» sobre un folio cualquiera entra en
   una tarde. Cinco cada quince minutos por dirección (§12 lo pide
   con ese número) lo vuelve inútil, y EuroSystem tiene además su
   propio freno por folio.
   ============================================================ */
const frenoPortal = defensas.creaFreno({
  porVentana: 5, ventanaMs: 15 * 60000, porDia: 3000
});

const NO_AHORA_COBRO = 'No pudimos abrir el pago ahora mismo. Inténtalo en un momento.';

/* Lo que se le dice a quien llega con un pase que ya no sirve. Nunca es un
   callejón sin salida: consultar otra vez cuesta teclear folio y apellido. */
const VUELVE_A_CONSULTAR =
  'Vuelve a consultar tu viaje con tu número de contrato y tu apellido para abonar.';

async function consultaDelPortal(req, res, cuerpo) {
  const frenado = frenoPortal(req);
  if (frenado) {
    /* Se frena ANTES de preguntarle a EuroSystem: el freno existe para que
       nadie pueda usar nuestra llave para adivinar apellidos a su ritmo. */
    res.status(429).json({
      error: 'demasiadas',
      aviso: 'Demasiados intentos seguidos. Espera unos minutos y vuelve a intentar.'
    });
    return;
  }

  const r = await portal.consulta(cuerpo.folio, cuerpo.apellido);
  if (!r.ok) {
    /* `r.aviso` ya viene redactado para el cliente: el 404 con las palabras
       exactas de §12 —las mismas para folio que no existe, apellido que no
       cuadra y contrato sin confirmar— y lo demás sin nombrar a EuroSystem
       ni ninguna variable. */
    res.status(r.status).json({ error: 'no se pudo consultar', aviso: r.aviso });
    return;
  }

  /* ------------------------------------------------------------
     EL PASE
     ------------------------------------------------------------
     Quien acertó folio y apellido se lleva un pase firmado que dice de qué
     contrato se trata y cuánto debía. Con eso el cobro que sigue no tiene
     que creerle al navegador ni volver a pedir el apellido.

     Sin `LIGAS_SECRETO` no hay pase: la consulta se contesta igual —ver el
     saldo no depende de eso— pero el botón de abonar no va a poder abrir
     nada, y eso se grita en el registro.
     ------------------------------------------------------------ */
  const pase = ligas.firmaPortal(r.viaje.folio, r.viaje.saldo);
  if (!pase) {
    console.error('[portal] sin LIGAS_SECRETO: se puede consultar pero NO abonar en línea. ' +
      'Ponla en las variables de Vercel.');
  }

  res.status(200).json({
    viaje: r.viaje,
    pase: pase,
    abonoMinimo: saldos.MINIMO_ABONO,
    sugerencias: saldos.sugerencias(r.viaje.saldo)
  });
}

/* ------------------------------------------------------------
   EL COBRO QUE SALE DEL PASE
   ------------------------------------------------------------
   NADA DE ESTO SE LEE DEL NAVEGADOR: ni de qué contrato es ni
   cuánto se debe. Las dos cosas vienen dentro del pase, firmadas,
   y cambiarle un peso tumba el sello. Lo único que manda quien
   pide es el monto, y ése se revisa contra el saldo firmado con
   las mismas reglas de `_saldo.js` que usa el resto de la página.

   El pase NO ES UNA SESIÓN: no abre pantallas ni enseña datos.
   Solo sirve para esto.
   ------------------------------------------------------------ */
async function abonoDelPortal(req, res, cuerpo) {
  const pase = ligas.abrePortal(cuerpo.pase);
  if (!pase.ok) {
    console.error('[portal] pase rechazado: ' + pase.motivo);
    res.status(pase.vencida ? 410 : 401).json({
      error: 'pase no válido', vencida: !!pase.vencida, aviso: VUELVE_A_CONSULTAR
    });
    return;
  }

  const revisado = saldos.revisaAbono(cuerpo.monto, pase.saldo);
  if (!revisado.ok) {
    res.status(422).json({ error: 'monto no válido', aviso: revisado.aviso });
    return;
  }

  if (!stripe.hayClave()) {
    console.error('[portal] sin clave de Stripe: no se puede cobrar el abono del contrato ' +
      pase.contrato);
    res.status(503).json({ error: 'sin configurar', aviso: NO_AHORA_COBRO });
    return;
  }

  const sitio = defensas.sitioDe(req);
  const creada = await stripe.creaSesionDeCobro({
    mode: 'payment',
    locale: 'es-419',
    success_url: sitio + '/viaje.html?abono={CHECKOUT_SESSION_ID}',
    cancel_url: sitio + '/viaje.html',
    line_items: [{
      quantity: 1,
      price_data: {
        currency: 'mxn',
        unit_amount: revisado.monto * 100,          // Stripe cuenta en centavos
        product_data: {
          name: stripe.paraStripe('Abono · contrato ' + pase.contrato),
          description: stripe.paraStripe('Saldo antes de este abono $' +
            pase.saldo.toLocaleString('es-MX') + ' MXN')
        }
      }
    }],
    payment_method_types: revisado.monto <= 10000 ? ['card', 'oxxo'] : ['card'],
    metadata: {
      /* `tipo` es lo que hace que el webhook lo reconozca como abono y no
         como una compra nueva, y lo que `_reversas.js` lee si algún día se
         devuelve. `contrato` es el número de EuroSystem, que es lo único
         que esa puerta necesita para anotarlo (§13).

         NO lleva `folio`: este abono no es de una reserva de la página,
         es de un contrato de la oficina. Ponerle uno inventado haría que
         `_saldo.js` lo sumara al viaje equivocado. */
      tipo: saldos.TIPO_ABONO,
      contrato: String(pase.contrato),
      monto: String(revisado.monto),
      origen: 'WEB-PORTAL'
    }
  });

  if (!creada.ok || !creada.datos || !creada.datos.url) {
    console.error('[portal] Stripe no abrió el cobro del contrato ' + pase.contrato + ': ' +
      JSON.stringify((creada.datos && creada.datos.error) || {}).slice(0, 200));
    res.status(502).json({ error: 'no se pudo abrir el cobro', aviso: NO_AHORA_COBRO });
    return;
  }

  res.status(200).json({ url: creada.datos.url, monto: revisado.monto });
}

module.exports = defensas.aPruebaDeTronadas('viaje',
  'No pudimos abrir tu viaje ahora mismo. Inténtalo en un momento; ' +
  'tu liga sigue sirviendo.',
  async function handler(req, res) {
  if (defensas.puerta(req, res)) return;

  const frenado = freno(req);
  if (frenado) { res.status(frenado.status).json({ error: frenado.error }); return; }

  const cuerpo = defensas.cuerpoJSON(req);

  /* ------------------------------------------------------------
     0. «ABONA A TU VIAJE» — LO QUE ENTRA SIN LIGA

     Va ANTES de la firma porque no trae liga que firmar: el cliente de
     la oficina no tiene ninguna. Su candado es otro —folio, apellido, el
     freno de arriba y, para cobrar, el pase firmado— y está entero en
     las dos funciones de arriba.

     Todo lo demás de este archivo sigue exigiendo liga, Stripe y código,
     en ese orden, como siempre.
     ------------------------------------------------------------ */
  if (cuerpo.accion === 'consulta') { await consultaDelPortal(req, res, cuerpo); return; }
  /* El pase ES la acción: lo único que puede hacer quien lo trae es abrir
     su cobro. Por eso no hace falta preguntar nada más. */
  if (cuerpo.pase) { await abonoDelPortal(req, res, cuerpo); return; }

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

  /* ------------------------------------------------------------
     4. EL SALDO, Y ABONAR
     ------------------------------------------------------------
     PASOS 2 Y 3 del spec de abonos en línea. Van DENTRO de esta puerta y
     no en un `api/abonar.js` como decía el spec, y no es comodidad: el
     plan Hobby de Vercel publica DOCE funciones y hay doce exactas. Un
     archivo más tumba el despliegue entero —ya pasó el 26-ago-2026— y lo
     caza `pruebas/probar-despliegue.cjs`. Es la misma salida que tomó la
     solicitud dentro de `api/cotizar.js`.

     Y es la puerta que le toca: aquí ya se comprobó la firma de la liga,
     ya se preguntó a Stripe y ya se verificó que quien pide es el dueño
     del viaje. Abonar necesita exactamente esas tres cosas.

     TODO LO QUE SIGUE PASA DESPUÉS DE ESAS TRES COMPROBACIONES. Ése es el
     motivo de que esté hasta abajo del archivo y no arriba.
     ------------------------------------------------------------ */
  const metadata = sesion.metadata || {};
  const folio = String(metadata.folio || '').trim();

  /* El saldo se cuenta desde Stripe cada vez: es la única verdad del
     dinero y no se guarda copia (ver `_saldo.js`). */
  async function cuentaElSaldo() {
    const lista = await stripe.sesionesDelCliente(idCliente, 50);
    if (lista.error) return { error: lista.error, reintentar: lista.reintentar };
    return {
      cuenta: saldos.calcula({
        total: Number(metadata.total) || 0,
        anticipo: Number(metadata.anticipo) || 0,
        folio: folio,
        sesiones: lista.sesiones || [],
        estadoDe: stripe.estadoDePago
      })
    };
  }

  if (cuerpo.accion === 'abonar') {
    if (!folio) {
      res.status(409).json({ error: 'sin folio',
        aviso: 'Este viaje todavía no tiene folio. Escríbenos por WhatsApp.' });
      return;
    }

    const r = await cuentaElSaldo();
    if (r.error) {
      console.error('[viaje] no se pudo contar el saldo de ' + folio + ': ' + r.error);
      res.status(r.reintentar ? 503 : 502).json({ error: r.error,
        aviso: 'No pudimos consultar tu saldo ahora mismo. Inténtalo en un momento.' });
      return;
    }

    /* EL MONTO SE REVISA CONTRA EL SALDO DE VERDAD, no contra lo que dijo
       el navegador: quien puede escribir el monto puede escribir
       cualquiera. Misma disciplina que `pagar.js`, que recalcula el
       precio en vez de creerle a la pantalla. */
    const revisado = saldos.revisaAbono(cuerpo.monto, r.cuenta.saldo);
    if (!revisado.ok) {
      res.status(422).json({ error: 'monto no válido', aviso: revisado.aviso });
      return;
    }

    const sitio = defensas.sitioDe(req);
    const creada = await stripe.creaSesionDeCobro({
      mode: 'payment',
      locale: 'es-419',
      customer: idCliente,        // el MISMO cliente: su abono queda junto a su viaje
      success_url: sitio + '/viaje.html?t=' + encodeURIComponent(cuerpo.t) +
        '&abono={CHECKOUT_SESSION_ID}',
      cancel_url: sitio + '/viaje.html?t=' + encodeURIComponent(cuerpo.t),
      line_items: [{
        quantity: 1,
        price_data: {
          currency: 'mxn',
          unit_amount: revisado.monto * 100,      // Stripe cuenta en centavos
          product_data: {
            name: stripe.paraStripe('Abono · folio ' + folio),
            description: stripe.paraStripe(String(metadata.ruta || 'Servicio de transporte') +
              ' · Saldo antes de este abono $' + r.cuenta.saldo.toLocaleString('es-MX') + ' MXN')
          }
        }
      }],
      payment_method_types: revisado.monto <= 10000 ? ['card', 'oxxo'] : ['card'],
      metadata: {
        /* `tipo` y `folio` son lo que hace que `_saldo.js` lo encuentre y
           que `_reversas.js` lo reconozca si algún día se revierte. Sin
           ellos, el abono existe en Stripe y para nosotros no. */
        tipo: saldos.TIPO_ABONO,
        folio: folio,
        monto: String(revisado.monto),
        referenciaExterna: String(metadata.referenciaExterna || ''),
        origen: 'WEB'
      }
    });

    if (!creada.ok || !creada.datos || !creada.datos.url) {
      console.error('[viaje] Stripe no abrió el cobro del abono de ' + folio + ': ' +
        JSON.stringify((creada.datos && creada.datos.error) || {}).slice(0, 200));
      res.status(502).json({ error: 'no se pudo abrir el cobro',
        aviso: 'No pudimos abrir el pago ahora mismo. Inténtalo en un momento.' });
      return;
    }

    res.status(200).json({ url: creada.datos.url, monto: revisado.monto });
    return;
  }

  /* ------------------------------------------------------------
     LA VUELTA DE STRIPE · «tu pago fue recibido con éxito»
     ------------------------------------------------------------
     NO SE LE CREE A LA DIRECCIÓN DE REGRESO. Trae el id de la sesión,
     pero si le pagara al cliente escribirlo a mano, cualquiera pondría
     un id y vería «recibido con éxito» sin haber pagado. Se le pregunta
     a Stripe, igual que hace el webhook.

     Y se comprueba que ese abono sea DE ESTE VIAJE y de ESTE cliente:
     un id de sesión ajeno no puede contestar nada.
     ------------------------------------------------------------ */
  if (cuerpo.accion === 'abono') {
    const id = String(cuerpo.abono || '');
    if (!stripe.idDeSesionValido(id)) {
      res.status(422).json({ error: 'id con mala forma' });
      return;
    }

    const laDelAbono = await stripe.traeSesion(id);
    if (laDelAbono.error) {
      res.status(laDelAbono.reintentar ? 503 : 404).json({ error: laDelAbono.error,
        aviso: 'No pudimos confirmar tu pago ahora mismo. Vuelve a abrir tu liga en un momento.' });
      return;
    }

    const suya = laDelAbono.sesion || {};
    const dueno = typeof suya.customer === 'string' ? suya.customer
                : (suya.customer && suya.customer.id) || '';
    if (dueno !== idCliente || !saldos.esAbonoDe(suya, folio)) {
      console.error('[viaje] abono ajeno o de otro viaje: ' + id);
      res.status(404).json({ error: 'no encontrado' });
      return;
    }

    /* El saldo se vuelve a contar DESPUÉS del pago, para que el cliente
       vea el de ahora y no el de antes de abonar. */
    const r = await cuentaElSaldo();

    res.status(200).json({
      estado: laDelAbono.estado,                    // pagado · pendiente · sinPagar
      monto: Number((suya.metadata || {}).monto) || 0,
      folio: folio,
      saldo: r.cuenta ? r.cuenta.saldo : null,
      total: r.cuenta ? r.cuenta.total : null
    });
    return;
  }

  /* ---- 3. LO QUE PUEDE VER, Y NADA MÁS ---- */
  /* El saldo se cuenta desde Stripe y se le PASA a `_publico.js`, que
     sigue siendo el único que decide qué sale. Pegarlo después sería
     saltarse la lista, que es justamente lo que ese archivo existe para
     impedir. Si Stripe no contesta, el viaje se enseña igual con el saldo
     de la metadata: vale más un viaje con un saldo viejo que una pantalla
     de error. */
  const cuenta = await cuentaElSaldo();
  if (cuenta.error) {
    console.error('[viaje] sin saldo para ' + folio + ': ' + cuenta.error);
  } else if (cuenta.cuenta.descuadre > 0) {
    /* No se le enseña al cliente —no es asunto suyo y lo asustaría— pero
       no puede pasar callado. */
    console.error('[viaje] DESCUADRE de $' + cuenta.cuenta.descuadre +
      ' en el folio ' + folio);
  }

  res.status(200).json(publico.viaje(metadata, consulta.estado,
    cuenta.cuenta
      ? Object.assign({}, cuenta.cuenta, {
        abonoMinimo: saldos.MINIMO_ABONO,
        sugerencias: saldos.sugerencias(cuenta.cuenta.saldo)
      })
      : null));
});
