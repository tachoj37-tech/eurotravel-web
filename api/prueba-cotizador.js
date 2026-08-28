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
const origenes = require('./_origenes');
const rutas = require('./_rutas');
const defensas = require('./_defensas');

/* Mide como /api/cotizar, así que se le pone el mismo tope. Es de una sola
   persona revisando, no de clientes: por minuto se aprieta más. */
const freno = defensas.creaFreno({ porMinuto: 20, porDia: 300 });

/* ------------------------------------------------------------
   DE DÓNDE SALEN LAS UNIDADES
   ------------------------------------------------------------
   La base de Eurotravel. Es solo el VALOR POR OMISIÓN: la
   pantalla deja cambiarlo, porque parte de lo que se revisa aquí
   es justamente qué pasa cuando el viaje no sale de casa.
   ------------------------------------------------------------ */
const BASE = {
  placeId: 'ChIJA0pBpoezKIQREKq-cByLC14',       // San Pedro Tlaquepaque
  direccion: 'San Pedro Tlaquepaque, Jalisco, México',
  lat: 20.602519, lng: -103.336158
};

/* Hasta dónde llega «la zona de casa». Los precios de la lista se armaron
   saliendo de Guadalajara; más lejos de esto, la lista deja de describir el
   viaje y la pantalla lo avisa. 60 km cubre toda la zona metropolitana. */
const RADIO_DE_CASA_KM = 60;

/* ------------------------------------------------------------
   UN NÚMERO DE VERDAD, Y `isFinite` NO SIRVE PARA PREGUNTARLO
   ------------------------------------------------------------
   `isFinite(null)` da **true**, porque coacciona a 0 antes de mirar. Lo
   mismo con `''` y con `[]`. Es la misma trampa que convertía los puntos
   sin coordenadas en el 0,0 del Golfo de Guinea en `_rutas.js`, y aquí
   volvía a caer: un origen escrito a mano —sin coordenadas— se comparaba
   contra el 0,0 y salía «a 12,000 km de casa», con su aviso y todo.

   `Number.isFinite` no coacciona. Y como del navegador pueden llegar como
   texto, se convierten antes y se pregunta después.
   ------------------------------------------------------------ */
function numeroDe(v) {
  if (v === null || v === undefined || v === '' || typeof v === 'boolean') return NaN;
  const n = Number(v);
  return Number.isFinite(n) ? n : NaN;
}

/* Distancia en línea recta entre dos puntos, para saber si el origen sigue
   siendo la zona de casa. No es la distancia por carretera —esa la mide
   Google— y no hace falta que lo sea: aquí solo se contesta «¿está cerca?».

   Devuelve null cuando alguno de los dos no trae coordenadas, y quien llama
   lo entiende como «no se puede saber», que NO es lo mismo que «está lejos». */
function lineaRecta(a, b) {
  a = a || {}; b = b || {};
  if (!Number.isFinite(numeroDe(a.lat)) || !Number.isFinite(numeroDe(a.lng)) ||
      !Number.isFinite(numeroDe(b.lat)) || !Number.isFinite(numeroDe(b.lng))) return null;
  const rad = Math.PI / 180;
  const aLat = numeroDe(a.lat), aLng = numeroDe(a.lng);
  const bLat = numeroDe(b.lat), bLng = numeroDe(b.lng);
  const dLat = (bLat - aLat) * rad;
  const dLng = (bLng - aLng) * rad;
  const s = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(aLat * rad) * Math.cos(bLat * rad) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  return 6371 * 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s));
}

/* ------------------------------------------------------------
   LA CLAVE, COMPARADA SIN FILTRAR EL TIEMPO
   ------------------------------------------------------------
   Un `===` sobre cadenas se corta en la primera letra distinta, y
   ese tiempo se puede medir para adivinar la clave letra por
   letra. `timingSafeEqual` tarda lo mismo acierte o no.

   Necesita dos búferes del MISMO largo o revienta, así que
   primero se resumen los dos con SHA-256 para que siempre midan
   igual.
   ------------------------------------------------------------ */
function claveValida(dio) {
  const buena = process.env.CLAVE_COTIZADOR;
  if (!buena) return null;                     // null = no está configurada
  const a = crypto.createHash('sha256').update(String(dio || '')).digest();
  const b = crypto.createHash('sha256').update(String(buena)).digest();
  return crypto.timingSafeEqual(a, b);
}

/* Un punto tal como lo manda la pantalla, acotado. Si no trae nada usable
   devuelve null y quien llama decide qué hacer. */
function puntoDe(p, porOmision) {
  if (!p || typeof p !== 'object') return porOmision || null;
  const direccion = String(p.direccion || p.texto || '').trim().slice(0, 300);
  const placeId = String(p.placeId || '').slice(0, 200);
  /* `numeroDe`, no `Number`: un `lat: null` del navegador se volvía cero, y
     cero es una coordenada válida en el Golfo de Guinea. */
  const lat = numeroDe(p.lat), lng = numeroDe(p.lng);
  if (!direccion && !placeId && !Number.isFinite(lat)) return porOmision || null;
  return {
    direccion: direccion,
    placeId: /^[A-Za-z0-9_-]+$/.test(placeId) ? placeId : '',
    lat: Number.isFinite(lat) ? lat : null,
    lng: Number.isFinite(lng) ? lng : null
  };
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
  const origen = puntoDe(cuerpo.origen, BASE);
  const destino = puntoDe(cuerpo.destino, null);
  if (!destino) {
    res.status(400).json({ error: 'sin destino', aviso: 'Falta decir a dónde va.' });
    return;
  }

  const formasOrigen = rutas.formasDe(origen);
  const formasDestino = rutas.formasDe(destino);
  if (!formasOrigen.length) {
    res.status(400).json({ error: 'origen ilegible', aviso: 'No entendí de dónde sale.' });
    return;
  }
  if (!formasDestino.length) {
    res.status(400).json({ error: 'destino ilegible', aviso: 'No entendí a dónde va.' });
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
       SIEMPRE SE MIDE CON GOOGLE

       Antes se medía solo cuando el destino NO estaba en la lista —para
       ahorrar llamadas— y eso apagaba justo lo que esta pantalla existe
       para enseñar. Aquí los kilómetros valen aunque no muevan el precio:
       son cómo se comprueba si un precio de lista sigue teniendo sentido.

       Si no hay clave de rutas, o Google no encuentra camino, el destino
       de lista SIGUE teniendo precio —el suyo es cerrado— y solo se pierde
       la comparación. El que se cotiza por fórmula sí se cae, porque sin
       kilómetros no hay fórmula.
       ------------------------------------------------------------ */
    const enLista = destinos.precioDeLista(destino, 'sprinter');
    const claveRutas = process.env.GOOGLE_ROUTES_KEY;

    let kmTotal = 0, seMidio = false, porQueNoSeMidio = '';

    if (!claveRutas) {
      porQueNoSeMidio = 'Falta GOOGLE_ROUTES_KEY en Vercel.';
    } else {
      const ida = await rutas.mideTramo(formasOrigen, formasDestino, claveRutas);
      const vuelta = ida ? await rutas.mideTramo(formasDestino, formasOrigen, claveRutas) : null;
      if (ida && vuelta) {
        kmTotal = tarifa.kmDe(ida.metros, vuelta.metros);
        seMidio = true;
      } else {
        porQueNoSeMidio = 'Google no encontró ruta por carretera entre esos dos puntos.';
      }
    }

    if (!seMidio && !enLista) {
      res.status(422).json({
        error: 'sin ruta',
        aviso: 'Ese destino no está en tu lista, así que hay que medirlo, y no se pudo. ' +
               porQueNoSeMidio
      });
      return;
    }

    /* La MISMA función que cotiza y que cobra. Si esta pantalla calculara
       por su cuenta, enseñaría costos que no son los que se cobran, y
       entonces no serviría para revisar nada. */
    const p = tarifa.calcula(kmTotal, dias, {
      noches: noches,
      movimientos: movimientos,
      destino: destino,
      origen: origen
    });

    /* ------------------------------------------------------------
       LA COMPARACIÓN QUE SOLO SE VE AQUÍ

       Cuando el destino está en la lista, su precio es cerrado y los
       kilómetros no lo mueven. Eso es correcto para un viaje que sale de
       Guadalajara —que es como se armó la lista— y deja de serlo si el
       viaje sale de otro lado.

       Aquí se pone al lado lo que la fórmula diría con los kilómetros de
       VERDAD, para que el dueño vea de un golpe si un precio de lista
       sigue describiendo el viaje o si ya se quedó corto.
       ------------------------------------------------------------ */
    let comparativa = null;
    if (enLista && seMidio) {
      const porFormula = kmTotal <= tarifa.TOPE_FORMULA_KM
        ? tarifa.BASE_TRASLADO + tarifa.POR_KM * kmTotal
        : null;
      comparativa = {
        deLista: enLista.precio,
        porFormula: porFormula === null ? null : Math.round(porFormula),
        pasaElTope: porFormula === null,
        diferencia: porFormula === null ? null : Math.round(porFormula - enLista.precio)
      };
    }

    /* ¿El viaje sale de casa? Los precios de la lista se armaron saliendo de
       Guadalajara. Si sale de otro lado, la lista puede estar describiendo
       otro viaje —y la página de verdad la aplicaría igual—. */
    const lejosDeCasa = lineaRecta(BASE, origen || {});
    const saleDeCasa = lejosDeCasa === null ? null : lejosDeCasa <= RADIO_DE_CASA_KM;

    /* Aquí SÍ sale todo. Es la razón de existir de esta puerta. */
    res.status(200).json({
      viaje: {
        desde: (origen && origen.direccion) || BASE.direccion,
        hasta: destino.direccion,
        dias: dias,
        noches: noches,
        saleDeCasa: saleDeCasa,
        aCuantoDeCasa: lejosDeCasa === null ? null : Math.round(lejosDeCasa)
      },
      /* De dónde salió el traslado, en palabras */
      traslado: {
        deLista: p.interno.destinoDeLista,
        porFormula: p.interno.porFormula,
        requiereAsesor: p.requiereAsesor,
        km: seMidio ? Math.round(kmTotal * 10) / 10 : null,
        seMidio: seMidio,
        porQueNoSeMidio: porQueNoSeMidio,
        tarifaKm: p.interno.tarifaKm,
        base: tarifa.BASE_TRASLADO,
        porKm: tarifa.POR_KM,
        topeFormulaKm: tarifa.TOPE_FORMULA_KM,
        antesDelPiso: p.interno.porKilometro,
        piso: p.interno.minimo,
        pisoPorDia: tarifa.MINIMO_POR_DIA,
        aplicoPiso: p.interno.aplicoMinimo,
        sinRedondear: p.interno.sinRedondear,
        final: p.interno.traslado
      },
      comparativa: comparativa,
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
      /* Lo que suma salir de otro lado. Es la cuarta parte del total, y tiene
         que aparecer aquí o el desglose de esta pantalla deja de sumar —que
         es justo como se cazó al agregarlo—. `dictado` dice si el número lo
         puso el dueño en su Excel o lo sacaron los kilómetros medidos. */
      salida: {
        desde: p.interno.salidaDesde,
        dictado: p.interno.recargoDictado,
        margenKm: origenes.MARGEN_KM,
        importe: p.interno.recargoSalida
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
