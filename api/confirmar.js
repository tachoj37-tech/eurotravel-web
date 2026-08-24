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

const STRIPE = 'https://api.stripe.com/v1';

/* Consultar una sesion es barato, pero es una puerta que habla con Stripe:
   se frena igual. Alto para que quien pago pueda recargar sin topar. */
const freno = defensas.creaFreno({ porMinuto: 20, porDia: 800 });

/* Los ids de sesion de Stripe son `cs_test_…` / `cs_live_…`. Se valida la
   forma antes de pegarla a una URL: nunca se mete en la direccion algo que
   vino del navegador sin revisar. */
function idValido(s) {
  return typeof s === 'string' && s.length <= 100 && /^cs_[A-Za-z0-9_]+$/.test(s);
}

module.exports = async function handler(req, res) {
  if (defensas.puerta(req, res)) return;

  const frenado = freno(req);
  if (frenado) { res.status(frenado.status).json({ error: frenado.error }); return; }

  const clave = (process.env.STRIPE_SECRET_KEY || '').trim();
  if (!clave) {
    // Sin clave no se puede confirmar nada. Y sin confirmar, NO se dice que
    // esta pagado: mejor un «lo estamos revisando» que un comprobante falso.
    res.status(503).json({ error: 'stripe sin configurar' });
    return;
  }

  const cuerpo = defensas.cuerpoJSON(req);
  const id = cuerpo.sesion;
  if (!idValido(id)) { res.status(400).json({ error: 'sesión inválida' }); return; }

  let datos;
  try {
    const r = await fetch(STRIPE + '/checkout/sessions/' + encodeURIComponent(id), {
      headers: { 'Authorization': 'Bearer ' + clave }
    });
    datos = await r.json();
    if (!r.ok || datos.error) {
      // Puede ser un id que no existe, o de otra cuenta. En ninguno de los dos
      // casos se confirma nada, y el motivo tecnico se queda aqui.
      res.status(404).json({ estado: 'sinPagar' });
      return;
    }
  } catch (e) {
    res.status(502).json({ error: 'no se pudo consultar el pago' });
    return;
  }

  const m = datos.metadata || {};

  /* Tres estados, y la diferencia importa:
       pagado    — el dinero ya entro
       pendiente — tipico de OXXO: el voucher se genero y Stripe regresa al
                   cliente a la pantalla de exito, pero AUN NO PAGA. Decirle
                   «tu viaje esta apartado» aqui seria mentirle al reves.
       sinPagar  — cualquier otra cosa */
  let estado = 'sinPagar';
  if (datos.payment_status === 'paid' || datos.payment_status === 'no_payment_required') {
    estado = 'pagado';
  } else if (datos.status === 'complete' || datos.status === 'open') {
    estado = 'pendiente';
  }

  /* Lista blanca. El folio y los montos salen de la METADATA DE STRIPE, no de
     lo que mando el navegador. `km` esta en la metadata y se queda aqui. */
  res.status(200).json({
    estado: estado,
    folio: typeof m.folio === 'string' ? m.folio.slice(0, 20) : '',
    anticipo: Number(m.anticipo) || 0,
    saldo: Number(m.saldo) || 0,
    total: Number(m.total) || 0,
    ruta: typeof m.ruta === 'string' ? m.ruta.slice(0, 90) : '',
    canal: m.canal === 'whatsapp' ? 'whatsapp' : 'correo'
  });
};
