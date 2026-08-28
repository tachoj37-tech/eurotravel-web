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
const publico = require('./_publico');   // y que puede ver el cliente, alla

// La Routes API cuesta más que el autocompletado, así que los topes son más bajos
const freno = defensas.creaFreno({ porMinuto: 30, porDia: 500 });

module.exports = async function handler(req, res) {
  if (defensas.puerta(req, res)) return;

  /* La clave de Google se comprueba MAS ABAJO, cuando ya se sabe si hace
     falta medir. Antes se exigía aquí, antes de mirar nada, y con eso un
     destino de precio cerrado —que no necesita a Google para nada— se
     quedaba sin cotizar por una clave que no iba a usar. */
  const clave = process.env.GOOGLE_ROUTES_KEY;

  const frenado = freno(req);
  if (frenado) { res.status(frenado.status).json({ error: frenado.error }); return; }

  const cuerpo = defensas.cuerpoJSON(req);

  const origen = rutas.formasDe(cuerpo.origen);
  const destino = rutas.formasDe(cuerpo.destino);
  if (!origen.length || !destino.length) {
    res.status(400).json({ error: 'Falta el origen o el destino' });
    return;
  }

  /* ------------------------------------------------------------
     LA UNIDAD, SI LA MANDAN

     El precio sale siempre de la columna sprinter de la lista, que es la
     única que hoy se cotiza en línea. Si el navegador dice cuál es y no es
     esa, aquí se dice que no —para que cotizar y cobrar contesten lo mismo,
     que es la razón de que estos dos archivos compartan `_tarifa`—.

     Si NO la mandan se sigue, porque durante un tiempo no se mandaba y una
     pantalla vieja en el caché de alguien no puede quedarse sin cotizador.
     El freno que de verdad importa está en `/api/pagar`, que es donde se
     compromete el dinero, y ahí sí es estricto.
     ------------------------------------------------------------ */
  if (cuerpo.unidad && !tarifa.seSabeCotizar(cuerpo.unidad)) {
    res.status(422).json({
      error: 'unidad no cotizable',
      aviso: 'Esa unidad se cotiza a la medida. Escríbenos y te pasamos el precio hoy mismo.'
    });
    return;
  }

  if (tarifa.regresoAntesDeSalida(cuerpo.salida, cuerpo.regreso)) {
    res.status(422).json({
      error: 'fechas invertidas',
      aviso: 'La fecha de regreso es anterior a la de salida. Revísalas, por favor.'
    });
    return;
  }

  const redondo = cuerpo.redondo !== false && !!cuerpo.regreso;
  const dias = tarifa.diasDeServicio(cuerpo.salida, cuerpo.regreso);
  const noches = tarifa.nochesDe(cuerpo.salida, cuerpo.regreso);

  /* ------------------------------------------------------------
     ¿HAY QUE MEDIR, O YA SABEMOS CUÁNTO CUESTA?

     Medir son DOS llamadas de pago a Google por cotización, y una reserva
     son varias cotizaciones: el cliente cambia la fecha, cambia la unidad,
     captura movimientos, y cada cambio vuelve a pedir precio.

     Cuando el destino tiene precio CERRADO en la lista, esos kilómetros no
     mueven un peso —`trasladoDe` ni los mira— así que se pagaban dos
     llamadas por una respuesta que se tiraba.

     Quién sabe si hacen falta es `_tarifa`, no este archivo: es el dueño
     del dinero. /api/pagar NO hace esto y mide siempre, porque el
     kilometraje va al contrato y la oficina lo lee ahí.
     ------------------------------------------------------------ */
  const hayQueMedir = tarifa.necesitaMedirse(cuerpo.destino, cuerpo.unidad);

  if (hayQueMedir && !clave) {
    // Sin clave el sitio no se rompe: el viaje sigue y se cotiza a mano
    res.status(503).json({ error: 'Cotizador en línea no configurado' });
    return;
  }

  try {
    let kmTotal = 0;

    if (hayQueMedir) {
      const ida = await rutas.mideTramo(origen, destino, clave);
      if (!ida) {
        res.status(422).json({
          error: 'sin ruta de ida',
          aviso: 'No encontramos una ruta por carretera entre esos dos puntos.'
        });
        return;
      }

      /* La vuelta se mide aparte —por sentidos únicos y entronques rara vez
         da igual que la ida— y SIEMPRE, aunque sea solo ida: el precio de un
         solo-ida es el 65% del precio REDONDO de un día, así que hace falta
         la vuelta para saber cuál es ese precio redondo. En destinos de lista
         esto no cuesta nada: ni siquiera se llega aquí, el precio es fijo. */
      const vuelta = await rutas.mideTramo(destino, origen, clave);
      if (!vuelta) {
        res.status(422).json({
          error: 'sin ruta de vuelta',
          aviso: 'No encontramos la ruta de regreso entre esos dos puntos.'
        });
        return;
      }

      /* La conversión vive en _tarifa, no aquí: cotizar y cobrar TIENEN que
         sacar el mismo número del mismo lugar. */
      kmTotal = tarifa.kmDe(ida.metros, vuelta ? vuelta.metros : 0);
    }

    /* Las noches extra y los movimientos se suman aquí adentro, no aquí
       afuera. La lista de movimientos entra CRUDA —tal como la mandó el
       navegador— y _tarifa la acota: cuántos días caben y en qué banda de
       horas cae cada uno. Estas dos líneas son idénticas en /api/pagar, y
       tienen que serlo. */
    const p = tarifa.calcula(kmTotal, dias, {
      noches: noches,
      movimientos: cuerpo.movimientos,
      destino: cuerpo.destino,
      origen: cuerpo.origen,
      redondo: redondo
    });

    /* Qué del precio puede salir NO se decide aquí: lo decide `_publico.js`,
       que es el único dueño de la regla del kilómetro. Antes se enumeraba a
       mano en este archivo y otra vez en `pagar.js`, y las dos listas podían
       separarse. Aquí solo se agrega lo que no es dinero. */
    res.status(200).json(Object.assign(
      { dias: dias, redondo: redondo },
      publico.precio(p)
    ));
  } catch (e) {
    res.status(502).json({ error: 'No se pudo calcular la distancia' });
  }
};
