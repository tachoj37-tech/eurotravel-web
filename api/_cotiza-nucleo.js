/* ============================================================
   El núcleo del cotizador
   ------------------------------------------------------------
   POR QUÉ EXISTE ESTE ARCHIVO

   El precio se pedía desde un solo lado —la página— y por eso
   vivía dentro de `cotizar.js`, revuelto con la puerta HTTP: el
   freno de peticiones, el origen permitido, los códigos de
   estado.

   Ahora se pide desde dos: la página y el bot de WhatsApp. Y el
   bot no tiene `req` ni `res`; tiene una conversación.

   Se pudo haber copiado el cálculo al bot. No se hizo, y la
   razón está escrita en `cotizar.js`: *«cotizar y cobrar TIENEN
   que sacar el mismo número del mismo lugar»*. Dos copias son
   dos copias hasta que alguien toca una — y ese día el cliente
   ve un precio por WhatsApp y otro en la pantalla.

   Así que aquí queda el cálculo, sin nada de HTTP, y los dos
   lados lo llaman. Lo que cada lado hace con el error —un 422 o
   una frase— ya es suyo.

   NO SE DECIDE PRECIO AQUÍ. Las reglas del dinero siguen en
   `_tarifa.js` y qué puede ver el cliente lo sigue decidiendo
   `_publico.js`. Esto solo mide, arma y entrega.
   ============================================================ */

'use strict';

const tarifa = require('./_tarifa');
const rutas = require('./_rutas');
const publico = require('./_publico');

/* ------------------------------------------------------------
   COTIZA, O DICE POR QUÉ NO
   ------------------------------------------------------------
   Devuelve `{ ok: true, precio }` o `{ ok: false, error, aviso }`.
   Nunca lanza por una entrada mala: solo por una falla de red,
   que es lo único que quien llama no puede prever.

   `aviso` es lo que se le puede enseñar al cliente. `error` es
   para el registro. Los dos hacen falta: mezclarlos es cómo se
   le acaba enseñando «sin ruta de vuelta» a alguien que solo
   quería ir a Chapala.
   ------------------------------------------------------------ */
async function cotiza(cuerpo, claveGoogle) {
  const c = cuerpo || {};

  const origen = rutas.formasDe(c.origen);
  const destino = rutas.formasDe(c.destino);
  if (!origen.length || !destino.length) {
    return { ok: false, error: 'Falta el origen o el destino', status: 400 };
  }

  /* La unidad, si la mandan. El precio en línea sale de la columna
     sprinter; si dicen otra, aquí se dice que no —para que cotizar y
     cobrar contesten lo mismo—. Si NO la mandan se sigue: hubo un
     tiempo en que no se mandaba y una pantalla vieja en el caché de
     alguien no puede quedarse sin cotizador. El freno que de verdad
     importa está en `/api/pagar`, donde se compromete el dinero. */
  if (c.unidad && !tarifa.seSabeCotizar(c.unidad)) {
    return {
      ok: false, status: 422, error: 'unidad no cotizable',
      aviso: 'Esa unidad se cotiza a la medida. Escríbenos y te pasamos el precio hoy mismo.'
    };
  }

  if (tarifa.regresoAntesDeSalida(c.salida, c.regreso)) {
    return {
      ok: false, status: 422, error: 'fechas invertidas',
      aviso: 'La fecha de regreso es anterior a la de salida. Revísalas, por favor.'
    };
  }

  const redondo = c.redondo !== false && !!c.regreso;
  const dias = tarifa.diasDeServicio(c.salida, c.regreso);
  const noches = tarifa.nochesDe(c.salida, c.regreso);

  /* ¿Hay que medir, o ya sabemos cuánto cuesta? Medir son DOS
     llamadas de pago a Google, y una reserva son varias cotizaciones:
     el cliente cambia la fecha, la unidad, los movimientos. Cuando el
     destino tiene precio CERRADO en la lista esos kilómetros no mueven
     un peso, así que se pagaban dos llamadas por una respuesta que se
     tiraba. Quién sabe si hacen falta es `_tarifa`, no este archivo. */
  const hayQueMedir = tarifa.necesitaMedirse(c.destino, c.unidad);

  if (hayQueMedir && !claveGoogle) {
    return { ok: false, status: 503, error: 'Cotizador en línea no configurado' };
  }

  let kmTotal = 0;

  if (hayQueMedir) {
    const ida = await rutas.mideTramo(origen, destino, claveGoogle);
    if (!ida) {
      return {
        ok: false, status: 422, error: 'sin ruta de ida',
        aviso: 'No encontramos una ruta por carretera entre esos dos puntos.'
      };
    }

    /* La vuelta se mide aparte —por sentidos únicos y entronques rara
       vez da igual que la ida— y SIEMPRE, aunque sea solo ida: el
       precio de un solo-ida es el 65% del precio REDONDO de un día,
       así que hace falta la vuelta para saber cuál es ese precio. */
    const vuelta = await rutas.mideTramo(destino, origen, claveGoogle);
    if (!vuelta) {
      return {
        ok: false, status: 422, error: 'sin ruta de vuelta',
        aviso: 'No encontramos la ruta de regreso entre esos dos puntos.'
      };
    }

    /* La conversión vive en `_tarifa`, no aquí. */
    kmTotal = tarifa.kmDe(ida.metros, vuelta ? vuelta.metros : 0);
  }

  /* Las noches extra y los movimientos se suman adentro. La lista de
     movimientos entra CRUDA y `_tarifa` la acota. */
  const p = tarifa.calcula(kmTotal, dias, {
    noches: noches,
    movimientos: c.movimientos,
    destino: c.destino,
    origen: c.origen,
    redondo: redondo,
    /* R43 · La salida decide el precio cuando el viaje es de un día y
       cae en domingo. Va TAMBIÉN en `pagar.js`. */
    salida: c.salida
  });

  /* Qué del precio puede salir lo decide `_publico.js`, el único dueño
     de la regla del kilómetro. Aquí solo se agrega lo que no es dinero. */
  return {
    ok: true,
    precio: Object.assign({ dias: dias, redondo: redondo }, publico.precio(p))
  };
}

module.exports = { cotiza };
