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
const tarifa = require('./_tarifa');        // R47: de aqui sale el interruptor
const defensas = require('./_defensas');    // origen, freno e IP, en un lugar
const solicitud = require('./_solicitud');  // fases 2 y 3: el que no lleva precio

// La Routes API cuesta más que el autocompletado, así que los topes son más bajos
const freno = defensas.creaFreno({ porMinuto: 30, porDia: 500 });

/* ------------------------------------------------------------
   LA SOLICITUD LLEVA SU PROPIO FRENO, Y MUCHO MÁS APRETADO
   ------------------------------------------------------------
   Cotizar es una cuenta: sale cara en llamadas a Google y nada más.
   Mandar una solicitud SACA CORREOS de nuestro dominio, y eso se
   cobra distinto: con el freno de cotizar, una IP podría disparar
   treinta correos por minuto a la oficina y quemarnos la
   reputación del remitente.

   Cinco por minuto es de sobra para una persona —nadie pide su
   cotización cinco veces seguidas— y no alcanza para hacer daño.
   ------------------------------------------------------------ */
const frenoSolicitud = defensas.creaFreno({ porMinuto: 5, porDia: 200 });

module.exports = async function handler(req, res) {
  if (defensas.puerta(req, res)) return;

  const cuerpo = defensas.cuerpoJSON(req);

  /* ------------------------------------------------------------
     LA OTRA MITAD DE ESTA PUERTA · FASES 2 Y 3
     ------------------------------------------------------------
     Desde la fase 1 hay viajes que no llevan precio. El cliente que
     no escribía por su cuenta se perdía sin dejar rastro; con
     `accion: 'solicitud'` deja su WhatsApp o su correo y la ficha
     del viaje le llega al vendedor.

     VA AQUÍ DENTRO Y NO EN UN ARCHIVO NUEVO DE `api/`, y no es
     comodidad: el plan Hobby de Vercel publica DOCE funciones y hoy
     hay doce exactas. Un archivo más tumba el despliegue entero —ya
     pasó el 26-ago-2026— y lo caza `pruebas/probar-despliegue.cjs`.
     Es la misma salida que tomó `api/cuenta.js` con sus acciones.

     Y es la puerta que le toca: la solicitud nace del cotizador,
     con los mismos datos del viaje y el mismo origen permitido.
     ------------------------------------------------------------ */
  if (cuerpo && cuerpo.accion === 'solicitud') {
    const frenadaSolicitud = frenoSolicitud(req);
    if (frenadaSolicitud) {
      res.status(frenadaSolicitud.status).json({ error: frenadaSolicitud.error });
      return;
    }

    const revisada = solicitud.revisa(cuerpo);
    if (!revisada.ok) {
      res.status(422).json({ error: revisada.error, aviso: revisada.aviso });
      return;
    }

    /* El aviso puede fallar —Resend caído, sin llave— y aun así la solicitud
       se recibió. Se contesta 200 y el acuse de la pantalla sale igual: lo
       que NO puede pasar es que alguien deje sus datos y vea un error.
       El fallo queda gritado en el registro, dentro de `avisa`. */
    const salio = await solicitud.avisa(revisada.solicitud);
    res.status(200).json({
      recibida: true,
      /* Para que la pantalla sepa si prometer el correo o no. Nada de esto
         es dinero ni delata una tarifa. */
      porCorreo: !!salio.alCliente,
      contacto: revisada.solicitud.telefono ? 'whatsapp' : 'correo'
    });
    return;
  }

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
  /* ------------------------------------------------------------
     R46 · ESTA PUERTA NO DA UN PRECIO QUE NO SALIÓ DEL CRITERIO
     ------------------------------------------------------------
     Dictado del dueño, 11-sep-2026: «No me gustaría que el cotizador
     pueda cotizar si el cotizador NO tiene el precio desde el
     criterio de precios».

     Un destino que no está en la lista sale con `requiereAsesor` y
     la pantalla ya sabe qué decir: «te contacta un vendedor hoy
     mismo». La fórmula por kilómetros sigue existiendo para el bot y
     para la pantalla del dueño, que la piden sin esta opción.

     Se pone AQUÍ, en la puerta, y no dentro del núcleo: el núcleo lo
     comparten la página y el bot, y son dos públicos distintos.
     ------------------------------------------------------------ */
  let r;
  try {
    /* ------------------------------------------------------------
       R47 · Y HOY NO DA NINGUNO, NI DEL CRITERIO (12-sep-2026)
       ------------------------------------------------------------
       Dictado del dueño: «ningún precio para nadie». El interruptor
       vive en `_tarifa.js` con su porqué; aquí solo se le pregunta.

       Se pregunta y no se escribe `true` a mano para que el día que
       él lo encienda se encienda de un solo renglón, y no haya que
       acordarse de esta línea y de la gemela en `pagar.js`.
       ------------------------------------------------------------ */
    r = await nucleo.cotiza(cuerpo, process.env.GOOGLE_ROUTES_KEY,
      { soloDelCriterio: true, sinPrecio: !tarifa.PAGINA_DA_PRECIOS });
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
