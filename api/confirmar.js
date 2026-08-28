/* ============================================================
   Confirmar un pago — función serverless de Vercel
   ------------------------------------------------------------
   Le pregunta a Stripe si una sesión de pago se pagó de verdad.

   POR QUE EXISTE
   --------------
   Al volver de Stripe, la pagina mostraba «Listo, tu viaje esta
   apartado» solo porque la direccion traia `?pago=listo`. Eso lo
   escribe cualquiera: entrando a mano a

       /?pago=listo&folio=ET-LO-QUE-SEA

   salia la pantalla de pago confirmado, con el folio inventado.
   No movia dinero —el dinero lo tiene Stripe— pero servia para
   sacar una captura que parece comprobante y enseñarla en la
   oficina. Ahora la pantalla no cree nada de la direccion: manda
   el id de la sesion aqui, y aqui se le pregunta a Stripe.

   LO QUE SALE DE AQUI
   -------------------
   Solo lo que el cliente ya sabe de su propia compra, por lista
   blanca. La metadata de Stripe tambien guarda el KILOMETRAJE,
   y ese NO sale: con el total y los kilometros juntos, la tarifa
   por kilometro se saca dividiendo. Misma regla que en _tarifa.
   ============================================================ */

const defensas = require('./_defensas');
const stripe = require('./_stripe');
const publico = require('./_publico');

/* Consultar una sesion es barato, pero es una puerta que habla con Stripe:
   se frena igual. Alto para que quien pago pueda recargar sin topar. */
const freno = defensas.creaFreno({ porMinuto: 20, porDia: 800 });

/* El aviso importa más aquí que en ningún otro: quien llega a esta puerta
   ACABA DE PAGAR. Si algo revienta, lo primero que tiene que leer es que su
   cobro no se perdió. */
module.exports = defensas.aPruebaDeTronadas('confirmar',
  'Tu pago sí se hizo. No pudimos enseñarte el resumen ahora mismo, pero tu ' +
  'contrato va en camino a tu correo. Si en unos minutos no llega, llámanos.',
  async function handler(req, res) {
  if (defensas.puerta(req, res)) return;

  const frenado = freno(req);
  if (frenado) { res.status(frenado.status).json({ error: frenado.error }); return; }

  if (!stripe.hayClave()) {
    // Sin clave no se puede confirmar nada. Y sin confirmar, NO se dice que
    // esta pagado: mejor un «lo estamos revisando» que un comprobante falso.
    res.status(503).json({ error: 'stripe sin configurar' });
    return;
  }

  const cuerpo = defensas.cuerpoJSON(req);
  const id = cuerpo.sesion;
  if (!stripe.idDeSesionValido(id)) { res.status(400).json({ error: 'sesión inválida' }); return; }

  const consulta = await stripe.traeSesion(id);

  if (consulta.error) {
    /* `reintentar` significa que no se pudo ni preguntarle a Stripe. Cualquier
       otro error es que Stripe contesto que no: un id que no existe, o de otra
       cuenta. En ninguno de los dos casos se confirma nada, y el motivo
       tecnico se queda aqui. */
    if (consulta.reintentar) { res.status(502).json({ error: 'no se pudo consultar el pago' }); return; }
    res.status(404).json({ estado: 'sinPagar' });
    return;
  }

  const datos = consulta.sesion;
  const m = datos.metadata || {};

  /* Tres estados, y la diferencia importa —pagado, pendiente, sinPagar—. La
     regla NO se escribe aqui: vive en `_stripe.js`, porque el webhook tiene
     que contestar exactamente lo mismo. Antes estaba copiada en los dos, y el
     dia que se separaran, la pantalla diria «apartado» y el contrato no se
     crearia. */
  const estado = consulta.estado;

  /* La lista blanca ya no se escribe aqui: vive en `_publico.js`, junto con
     la de la cotizacion y la del cobro. El folio y los montos salen de la
     METADATA DE STRIPE, no de lo que mando el navegador — y en esa metadata
     tambien esta `km`, que de ahi no pasa. */
  res.status(200).json(publico.confirmacion(m, estado));
});
