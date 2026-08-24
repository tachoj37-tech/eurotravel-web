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

const tarifa = require('./_tarifa');   // las reglas del dinero viven ahi, no aqui
const rutas  = require('./_rutas');    // y medir kilometros, alla
const defensas = require('./_defensas'); // origen, freno e IP, en un lugar

// La Routes API cuesta más que el autocompletado, así que los topes son más bajos
const freno = defensas.creaFreno({ porMinuto: 30, porDia: 500 });

module.exports = async function handler(req, res) {
  if (defensas.puerta(req, res)) return;

  const clave = process.env.GOOGLE_ROUTES_KEY;
  if (!clave) {
    // Sin clave el sitio no se rompe: el viaje sigue y se cotiza a mano
    res.status(503).json({ error: 'Cotizador en línea no configurado' });
    return;
  }

  const frenado = freno(req);
  if (frenado) { res.status(frenado.status).json({ error: frenado.error }); return; }

  const cuerpo = defensas.cuerpoJSON(req);

  const origen = rutas.formasDe(cuerpo.origen);
  const destino = rutas.formasDe(cuerpo.destino);
  if (!origen.length || !destino.length) {
    res.status(400).json({ error: 'Falta el origen o el destino' });
    return;
  }

  const redondo = cuerpo.redondo !== false && !!cuerpo.regreso;
  const dias = tarifa.diasDeServicio(cuerpo.salida, cuerpo.regreso);

  try {
    const ida = await rutas.mideTramo(origen, destino, clave);
    if (!ida) {
      res.status(422).json({
        error: 'sin ruta de ida',
        aviso: 'No encontramos una ruta por carretera entre esos dos puntos.'
      });
      return;
    }

    // La vuelta se mide aparte: por sentidos únicos y entronques rara vez da igual que la ida
    let vuelta = null;
    if (redondo) {
      vuelta = await rutas.mideTramo(destino, origen, clave);
      if (!vuelta) {
        res.status(422).json({
          error: 'sin ruta de vuelta',
          aviso: 'No encontramos la ruta de regreso entre esos dos puntos.'
        });
        return;
      }
    }

    /* La conversión vive en _tarifa, no aquí: cotizar y cobrar TIENEN que
       sacar el mismo número del mismo lugar. */
    const kmTotal = tarifa.kmDe(ida.metros, vuelta ? vuelta.metros : 0);

    const p = tarifa.calcula(kmTotal, dias);

    /* Se enumera a mano lo que sale, en vez de mandar el objeto completo.
       Los kilometros NO salen: con el total, la tarifa por kilometro se saca
       dividiendo, y el dueño pidio que el cliente nunca la vea. Lo demas
       —tarifa, minimo, calculo sin redondear— se queda en el servidor. */
    res.status(200).json({
      dias: dias,
      redondo: redondo,
      total: p.total,
      ivaIncluido: p.ivaIncluido,
      porcentajeAnticipo: p.porcentajeAnticipo,
      anticipo: p.anticipo,
      saldo: p.saldo
    });
  } catch (e) {
    res.status(502).json({ error: 'No se pudo calcular la distancia' });
  }
};
