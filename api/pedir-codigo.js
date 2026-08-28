/* ============================================================
   «Mándame el código»
   ------------------------------------------------------------
   El cliente abrió su liga. Antes de enseñarle nada, aquí se le
   manda un código de seis dígitos AL CORREO CON EL QUE PAGÓ.

   No al que teclee quien está enfrente: eso es justamente lo que
   hace que esto sirva. Quien tenga la liga pero no el buzón, se
   queda en esta pantalla.

   NO SE CONTESTA NADA QUE NO SE SEPA YA

   La respuesta dice «te mandamos un código a a***@ejemplo.mx» y
   nada más. Ni el correo completo, ni si el viaje existe, ni de
   quién es. Quien llegó con una liga válida ya sabía que el viaje
   existe; los demás no se enteran de nada.
   ============================================================ */

const defensas = require('./_defensas');
const ligas = require('./_ligas');
const acceso = require('./_acceso');
const stripe = require('./_stripe');
const correo = require('./_correo');

/* ------------------------------------------------------------
   LOS FRENOS, Y EL ERROR QUE ESTE PROYECTO YA PAGO
   ------------------------------------------------------------
   De `antes-de-escribir`, regla 4: un candado que el atacante le
   puede cerrar a otro no es un candado.

   Aquí lo que hay que cuidar es NO LLENARLE EL BUZON a un cliente
   con códigos que no pidió. Ese freno no puede vivir solo en
   memoria —en serverless cada máquina cuenta por su lado— así que
   el de verdad es el vencimiento del propio código: mientras uno
   siga vivo, no se manda otro. Eso vive en Stripe, que sí es la
   misma para todas las máquinas.

   El de IP se queda como defensa en profundidad, no como la única.
   ------------------------------------------------------------ */
const freno = defensas.creaFreno({ porMinuto: 5, porDia: 60 });

module.exports = defensas.aPruebaDeTronadas('pedir-codigo',
  'No pudimos mandarte el código ahora mismo. Inténtalo en un momento.',
  async function handler(req, res) {
  if (defensas.puerta(req, res)) return;

  const frenado = freno(req);
  if (frenado) { res.status(frenado.status).json({ error: frenado.error }); return; }

  const cuerpo = defensas.cuerpoJSON(req);

  /* ---- la firma primero, antes de tocar Stripe ---- */
  const puerta = ligas.abre(cuerpo.t);
  if (!puerta.ok) {
    console.error('[pedir-codigo] liga rechazada: ' + puerta.motivo);
    res.status(puerta.vencida ? 410 : 404).json({
      error: puerta.vencida ? 'liga vencida' : 'no encontrado',
      vencida: !!puerta.vencida,
      aviso: puerta.vencida
        ? 'Esta liga ya venció. Escríbenos por WhatsApp con tu folio y te mandamos una nueva.'
        : 'Esta liga no es válida.'
    });
    return;
  }

  if (!stripe.hayClave() || !acceso.hayClave() || !correo.hayClave()) {
    console.error('[pedir-codigo] falta configuración: ' +
      (!stripe.hayClave() ? 'STRIPE_SECRET_KEY ' : '') +
      (!acceso.hayClave() ? 'LIGAS_SECRETO ' : '') +
      (!correo.hayClave() ? 'RESEND_API_KEY' : ''));
    res.status(503).json({ error: 'sin configurar',
      aviso: 'No pudimos mandarte el código ahora mismo. Escríbenos por WhatsApp.' });
    return;
  }

  const consulta = await stripe.traeSesion(puerta.sesion);
  if (consulta.error) {
    console.error('[pedir-codigo] ' + consulta.error + ' (' + puerta.sesion + ')');
    res.status(consulta.reintentar ? 503 : 404).json({ error: consulta.error,
      aviso: 'No encontramos ese viaje.' });
    return;
  }

  const sesion = consulta.sesion;
  const idCliente = typeof sesion.customer === 'string' ? sesion.customer
                  : (sesion.customer && sesion.customer.id) || '';
  /* Solo las sesiones PAGADAS traen cliente, y la liga solo se manda al
     pagar. Si aquí no hay cliente, algo raro pasó y no se inventa nada. */
  if (!idCliente) {
    console.error('[pedir-codigo] la sesión ' + sesion.id + ' no trae cliente de Stripe');
    res.status(409).json({ error: 'sin cliente',
      aviso: 'Todavía no podemos verificar este viaje. Escríbenos por WhatsApp.' });
    return;
  }

  const aDonde = String((sesion.metadata || {}).correo ||
    (sesion.customer_details && sesion.customer_details.email) || '').trim().toLowerCase();
  if (!aDonde) {
    console.error('[pedir-codigo] la sesión ' + sesion.id + ' no trae correo');
    res.status(409).json({ error: 'sin correo',
      aviso: 'No tenemos un correo para este viaje. Escríbenos por WhatsApp.' });
    return;
  }

  /* ------------------------------------------------------------
     ¿YA HAY UN CODIGO VIVO?

     Si el cliente le da dos veces al botón —o alguien insiste— no se le
     manda un correo por cada clic. Mientras el anterior siga vivo, se le
     dice que ya se mandó y punto. Es el freno que de verdad importa: el
     que impide llenarle el buzón a alguien con códigos que no pidió.
     ------------------------------------------------------------ */
  const fichaAntes = await stripe.traeCliente(idCliente);
  if (fichaAntes.error) {
    console.error('[pedir-codigo] ' + fichaAntes.error);
    res.status(503).json({ error: 'no se pudo consultar',
      aviso: 'No pudimos mandarte el código ahora mismo. Vuelve a intentar en un momento.' });
    return;
  }
  const vivo = Number(((fichaAntes.cliente || {}).metadata || {})[acceso.CAMPO_VENCE]);
  if (isFinite(vivo) && Date.now() < vivo) {
    res.status(200).json({ mandado: true, yaHabia: true, correo: acceso.pistaDeCorreo(aDonde),
      aviso: 'Ya te mandamos un código. Revisa tu correo.' });
    return;
  }

  /* ---- se arma, se guarda EL RESUMEN, y se manda ---- */
  const codigo = acceso.nuevoCodigo();
  /* USO_LIGA: este código sirve para VER UN VIAJE y nada más. El dueño se lo
     puede dictar a quien quiera —así está pensado— y por eso no puede valer
     también para entrar a su cuenta ni para cambiarle la contraseña. Hasta la
     revisión del 27-ago-2026 sí valía: era el mismo campo. */
  const guardado = await stripe.guardaEnCliente(idCliente,
    acceso.paraGuardar(codigo, null, acceso.USO_LIGA));
  if (guardado.error) {
    console.error('[pedir-codigo] no se pudo guardar el código: ' + guardado.error);
    res.status(503).json({ error: 'no se pudo preparar',
      aviso: 'No pudimos mandarte el código ahora mismo. Vuelve a intentar en un momento.' });
    return;
  }

  const envio = await correo.manda(correo.mensajeDeCodigo(aDonde, codigo,
    (sesion.metadata || {}).nombre, (sesion.metadata || {}).folio));
  if (!envio.ok) {
    console.error('[pedir-codigo] el código NO salió: ' + envio.motivo);
    res.status(503).json({ error: 'no se pudo mandar',
      aviso: 'No pudimos mandarte el código ahora mismo. Escríbenos por WhatsApp.' });
    return;
  }

  res.status(200).json({ mandado: true, correo: acceso.pistaDeCorreo(aDonde) });
});
