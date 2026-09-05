/* ============================================================
   Cotizador — función serverless de Vercel
   ------------------------------------------------------------
   Calcula los kilómetros con la Routes API de Google y devuelve
   el precio ya armado. El navegador NUNCA ve la clave ni la
   tarifa: pide a este endpoint y aquí se hace todo.

   Que la tarifa viva aquí y no en el navegador importa: cuando
   la fase 4 genere el contrato, va a volver a calcular con este
   mismo archivo, y no hay forma de que el cliente mande un
   precio inventado.

   Reglas de negocio (confirmadas por el dueño, en _tarifa.js):
     · Ida y vuelta se miden por separado y se suman
     · No se cobra la estadía ni el traslado desde la base
   El precio por kilómetro y el mínimo por día NO se escriben
   aquí a propósito: viven solo en _tarifa.js, del lado del
   servidor, para que el cliente nunca los vea.

   Defensas: en _defensas.js, compartidas con places, pagar y
   diagnostico. Ya no hay lista que sincronizar a mano.
   ============================================================ */

const nucleo = require('./_cotiza-nucleo'); // el calculo, compartido con el bot
const defensas = require('./_defensas');    // origen, freno e IP, en un lugar

// La Routes API cuesta más que el autocompletado, así que los topes son más bajos
const freno = defensas.creaFreno({ porMinuto: 30, porDia: 500 });

module.exports = async function handler(req, res) {
  if (defensas.puerta(req, res)) return;

  const frenado = freno(req);
  if (frenado) { res.status(frenado.status).json({ error: frenado.error }); return; }

  /* ------------------------------------------------------------
     EL CÁLCULO YA NO ESTÁ AQUÍ
     ------------------------------------------------------------
     Vive en `_cotiza-nucleo.js`, porque ahora se pide desde dos
     lados: esta pantalla y el bot de WhatsApp. Antes estaba aquí
     adentro, y el bot no podía usarlo —no tiene `req` ni `res`—,
     así que en WhatsApp el precio simplemente nunca llegaba: el
     bot decía «déjame sacar el precio…» y ahí se acababa todo.

     Lo que queda aquí es lo que SÍ es de esta puerta: el freno, el
     origen permitido, y traducir la respuesta a códigos HTTP.
     ------------------------------------------------------------ */
  let r;
  try {
    r = await nucleo.cotiza(defensas.cuerpoJSON(req), process.env.GOOGLE_ROUTES_KEY);
  } catch (e) {
    res.status(502).json({ error: 'No se pudo calcular la distancia' });
    return;
  }

  if (!r.ok) {
    const salida = { error: r.error };
    if (r.aviso) salida.aviso = r.aviso;
    res.status(r.status || 400).json(salida);
    return;
  }

  res.status(200).json(r.precio);
};
