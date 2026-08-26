/* ============================================================
   Prueba del cotizador — la cocina, no el platillo
   ------------------------------------------------------------
   TEMPORAL. Esta pantalla existe para que el dueño revise cómo
   se arman los costos, y se borra cuando termine de revisarlos.
   Va junta en dos archivos —éste y prueba-cotizador.html— para
   que borrarla sea borrar dos archivos y una línea del index.

   POR QUÉ NO REUSA /api/cotizar

   Porque hace lo contrario. `/api/cotizar` existe para ESCONDER
   la tarifa: pasa el precio por `_publico.js` y de ahí no sale
   ni un kilómetro. Esta puerta enseña justamente eso —el
   kilometraje, la tarifa, de qué renglón de la lista salió el
   precio, cuánto puso cada regla— porque revisar un costo es
   ver de dónde salió.

   Y POR ESO LLEVA CANDADO

   Un endpoint que devuelve la tarifa por kilómetro en una
   dirección pública es la regla del kilómetro rota, y da igual
   que la pantalla sea temporal: el buscador la indexa igual y la
   competencia la lee igual.

   El candado es una clave que el dueño pone en Vercel y que NO
   vive en este repositorio. Sin ella configurada, esta puerta no
   contesta nada: falla cerrada, no abierta. Es a propósito —una
   variable que se olvida de configurar no puede volverse una
   puerta abierta—.

   El nombre NO empieza con guion bajo: tiene que publicarse como
   dirección para que la pantalla la pueda llamar.
   ============================================================ */

const crypto = require('crypto');
const tarifa = require('./_tarifa');
const destinos = require('./_destinos');
const rutas = require('./_rutas');
const defensas = require('./_defensas');

/* Mide como /api/cotizar, así que se le pone el mismo tope. Es de una sola
   persona revisando, no de clientes: por minuto se aprieta más. */
const freno = defensas.creaFreno({ porMinuto: 20, porDia: 300 });

/* ------------------------------------------------------------
   DE DÓNDE SALEN LAS UNIDADES
   ------------------------------------------------------------
   La base de Eurotravel. Va fija porque la pantalla solo pregunta
   A DÓNDE va el viaje: el origen siempre es el mismo y preguntarlo
   sería una respuesta de más en una herramienta que existe para
   ser corta.
   ------------------------------------------------------------ */
const BASE = {
  placeId: 'ChIJA0pBpoezKIQREKq-cByLC14',       // San Pedro Tlaquepaque
  direccion: 'San Pedro Tlaquepaque, Jalisco, México',
  lat: 20.602519, lng: -103.336158
};

/* ------------------------------------------------------------
   LA CLAVE, COMPARADA SIN FILTRAR EL TIEMPO
   ------------------------------------------------------------
   Un `===` sobre cadenas se corta en la primera letra distinta, y
   ese tiempo se puede medir para adivinar la clave letra por
   letra. `timingSafeEqual` tarda lo mismo acierte o no.

   Necesita dos búferes del MISMO largo o revienta, así que
   primero se comparan los largos —que sí se pueden filtrar sin
   consecuencia— y se resumen los dos con SHA-256 para que
   siempre midan igual.
   ------------------------------------------------------------ */
function claveValida(dio) {
  const buena = process.env.CLAVE_COTIZADOR;
  if (!buena) return null;                     // null = no está configurada
  const a = crypto.createHash('sha256').update(String(dio || '')).digest();
  const b = crypto.createHash('sha256').update(String(buena)).digest();
  return crypto.timingSafeEqual(a, b);
}

module.exports = async function handler(req, res) {
  if (defensas.puerta(req, res)) return;

  const frenado = freno(req);
  if (frenado) { res.status(frenado.status).json({ error: frenado.error }); return; }

  const cuerpo = defensas.cuerpoJSON(req);

  const ok = claveValida(cuerpo.clave);
  if (ok === null) {
    /* El mensaje nombra una variable de entorno, y eso normalmente estaría
       mal dirigido —lo lee una persona, no un programador—. Aquí es la
       excepción: la persona que abre esta pantalla es el dueño, y es él
       quien tiene que ir a Vercel a ponerla. */
    res.status(503).json({
      error: 'sin clave',
      aviso: 'Falta configurar CLAVE_COTIZADOR en Vercel. Sin esa clave esta pantalla no abre.'
    });
    return;
  }
  if (!ok) {
    res.status(401).json({ error: 'clave incorrecta', aviso: 'Esa no es la clave.' });
    return;
  }

  /* ---- lo que preguntó la pantalla ---- */
  const destino = cuerpo.destino || {};
  const formasDestino = rutas.formasDe(destino);
  if (!formasDestino.length) {
    res.status(400).json({ error: 'sin destino', aviso: 'Falta decir a dónde va.' });
    return;
  }

  const dias = Math.min(60, Math.max(1, Math.floor(Number(cuerpo.dias) || 1)));
  /* Las noches son los días menos uno: salir el 3 y volver el 6 son cuatro
     días de servicio y tres noches. Es la misma relación que usa la pantalla
     de verdad, y confundirlas cuesta mil pesos por viaje. */
  const noches = Math.max(0, dias - 1);
  const movimientos = Array.isArray(cuerpo.movimientos) ? cuerpo.movimientos : [];

  try {
    /* ------------------------------------------------------------
       MEDIR SOLO CUANDO HAGA FALTA

       Si el destino está en la LISTA DE PRECIOS, su precio es cerrado y
       los kilómetros no mueven un peso. Medirlos sería pagarle a Google
       por un número que no se va a usar.
       ------------------------------------------------------------ */
    const enLista = destinos.precioDeLista(destino, 'sprinter');
    let kmTotal = 0, seMidio = false;

    if (!enLista) {
      const clave = process.env.GOOGLE_ROUTES_KEY;
      if (!clave) {
        res.status(503).json({ error: 'sin clave de rutas',
          aviso: 'Este destino no está en la lista y hay que medirlo, pero falta GOOGLE_ROUTES_KEY.' });
        return;
      }
      const origen = rutas.formasDe(BASE);
      const ida = await rutas.mideTramo(origen, formasDestino, clave);
      const vuelta = ida ? await rutas.mideTramo(formasDestino, origen, clave) : null;
      if (!ida || !vuelta) {
        res.status(422).json({ error: 'sin ruta',
          aviso: 'No encontramos ruta por carretera hasta ahí.' });
        return;
      }
      kmTotal = tarifa.kmDe(ida.metros, vuelta.metros);
      seMidio = true;
    }

    /* La MISMA función que cotiza y que cobra. Si esta pantalla calculara
       por su cuenta, enseñaría costos que no son los que se cobran, y
       entonces no serviría para revisar nada. */
    const p = tarifa.calcula(kmTotal, dias, {
      noches: noches,
      movimientos: movimientos,
      destino: destino
    });

    /* Aquí SÍ sale todo. Es la razón de existir de esta puerta. */
    res.status(200).json({
      viaje: {
        desde: BASE.direccion,
        hasta: String(destino.direccion || destino.texto || ''),
        dias: dias,
        noches: noches
      },
      /* De dónde salió el traslado, en palabras */
      traslado: {
        deLista: p.interno.destinoDeLista,
        porFormula: p.interno.porFormula,
        requiereAsesor: p.requiereAsesor,
        km: seMidio ? Math.round(kmTotal * 10) / 10 : null,
        seMidio: seMidio,
        tarifaKm: p.interno.tarifaKm,
        base: tarifa.BASE_TRASLADO,
        topeFormulaKm: tarifa.TOPE_FORMULA_KM,
        antesDelPiso: p.interno.porKilometro,
        piso: p.interno.minimo,
        pisoPorDia: tarifa.MINIMO_POR_DIA,
        aplicoPiso: p.interno.aplicoMinimo,
        sinRedondear: p.interno.sinRedondear,
        final: p.interno.traslado
      },
      estadia: {
        conMovimientos: p.interno.conMovimientos,
        nochesIncluidas: tarifa.NOCHES_INCLUIDAS,
        nochesExtra: p.interno.nochesExtra,
        porNoche: tarifa.EXTRA_POR_NOCHE,
        diasParados: p.interno.diasParados,
        importe: p.interno.importeNoches
      },
      movimientos: {
        dias: p.desglose.diasMovimiento,
        horas: p.interno.horasMovimiento,
        reglaDestino: p.interno.reglaDestino,
        bandas: tarifa.BANDAS_MOVIMIENTO,
        importe: p.desglose.importeMovimientos
      },
      total: p.total,
      anticipo: p.anticipo,
      saldo: p.saldo,
      porcentajeAnticipo: p.porcentajeAnticipo,
      subtotal: p.subtotal,
      iva: p.iva,
      requiereAsesor: p.requiereAsesor,
      /* Lo que vería el cliente de este mismo viaje, para poder compararlo */
      loQueVeElCliente: p.desglose
    });
  } catch (e) {
    res.status(502).json({ error: 'no se pudo calcular', aviso: 'Falló la medición de la ruta.' });
  }
};
