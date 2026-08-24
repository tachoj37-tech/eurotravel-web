/* ============================================================
   La máquina de cotización — el estado del viaje, sin pantalla
   ------------------------------------------------------------
   Aquí vive lo que antes estaba trenzado con el DOM en index.html:
   el estado del viaje (origen, destino, fechas, unidad), su
   validación, la carrera de "gana la última búsqueda" y la
   llamada a /api/cotizar. La pantalla quedó de adaptador: junta
   el borrador desde sus campos, se lo entrega a la máquina y
   pinta lo que ella conteste.

   Por qué existe: probar el flujo de cotización exigía un
   navegador apretando botones en orden. Con la máquina aparte,
   las reglas se prueban en Node a secas (pruebas/probar-cotizacion.cjs)
   y las fases que vienen —contrato en línea, por ejemplo— se
   enchufan aquí, no al DOM.

   LA REGLA DEL KILÓMETRO, del lado del navegador:
   este archivo corre en el navegador, así que aquí NUNCA vive
   una tarifa ni un kilometraje. Y por si algún día el servidor
   mandara de más, la respuesta se pasa por una lista blanca de
   campos: lo que no esté en CAMPOS_COTIZACION se tira antes de
   guardarse. La prueba de Node lo verifica.
   ============================================================ */
(function (raiz) {
  'use strict';

  /* ---------------- funciones puras (probables a secas) ---------------- */

  /* Las coordenadas viajan como texto "lat, lng"; la dirección en texto es
     el salvavidas: los destinos del catálogo de la página no traen place_id,
     solo nombre y estado. */
  function puntoDe(l) {
    var lat = null, lng = null;
    if (l && l.coords) {
      var p = String(l.coords).split(',');
      var a = Number(p[0]), b = Number(p[1]);
      if (isFinite(a) && isFinite(b)) { lat = a; lng = b; }
    }
    var texto = (l && l.direccionGoogle) || '';
    if (!texto && l && l.place) {
      var partes = [];
      if (l.calle) partes.push(l.calle);
      if (l.col) partes.push(l.col);
      partes.push(l.place[0]);
      if (l.place[1]) partes.push(l.place[1]);
      partes.push('México');
      texto = partes.join(', ');
    }
    return { placeId: (l && l.placeId) || '', lat: lat, lng: lng, direccion: texto };
  }

  /* ¿El punto que eligió es exacto, o nomás el nombre de la ciudad? De esto
     depende el aviso de "esta cifra puede afinarse". */
  function puntoExacto(l) { return !!(l && (l.placeId || l.coords) && !l.aprox); }

  /* Qué le falta a un borrador para poder buscarse. Devuelve claves, no
     mensajes: los textos son asunto de la pantalla. */
  function faltantes(b) {
    b = b || {};
    var f = [];
    if (!b.origen) f.push('origen');
    if (!b.destino) f.push('destino');
    if (!b.salida) f.push('fecha');
    /* el calendario ya no deja invertirlas, pero de estas fechas salen los
       días que se cobran: se revisa aunque sea de más */
    if (b.salida && b.regreso && b.regreso < b.salida) f.push('fechasInvertidas');
    if (!b.unidad) f.push('unidad');
    return f;
  }

  /* La lista blanca de la respuesta del cotizador. Kilómetros y tarifa NO
     están y no deben estar: con el total y los kilómetros juntos, el precio
     por kilómetro se saca dividiendo. */
  var CAMPOS_COTIZACION = ['dias', 'redondo', 'total', 'ivaIncluido', 'porcentajeAnticipo', 'anticipo', 'saldo'];

  function soloCamposPermitidos(d) {
    var limpio = {};
    for (var i = 0; i < CAMPOS_COTIZACION.length; i++) {
      var k = CAMPOS_COTIZACION[i];
      if (d && Object.prototype.hasOwnProperty.call(d, k)) limpio[k] = d[k];
    }
    return limpio;
  }

  /* ------------------------------ la máquina --------------------------- */

  /* opciones.pide: función tipo fetch. En el navegador se toma fetch; en las
     pruebas de Node se inyecta una falsa y el flujo completo corre sin red. */
  function crea(opciones) {
    var pide = (opciones && opciones.pide) ||
      (typeof raiz.fetch === 'function' ? raiz.fetch.bind(raiz) : null);

    var estado = {
      origen: null, destino: null,
      salida: '', regreso: '',
      unidad: null, redondo: true,
      cotizacion: null
    };

    /* por si alguien busca dos veces seguidas: gana la última */
    var serie = 0;
    var oyentes = [];

    function avisa() {
      for (var i = 0; i < oyentes.length; i++) { oyentes[i](estado); }
    }

    return {
      /* La vista del estado. Es el objeto vivo a propósito —la pantalla lo
         lee decenas de veces y copiarlo no compra nada—, pero se escribe
         SOLO con pon(): escribirle encima brinca la validación y la carrera. */
      estadoVivo: function () { return estado; },

      alCambiar: function (f) { oyentes.push(f); },

      faltantes: faltantes,

      /* ¿Esta unidad enseña precio en línea, o se cotiza a la medida? */
      cotizaEnAutomatico: function () {
        return !!(estado.unidad && estado.unidad.cotizadorAutomatico);
      },

      /* Compromete un viaje ya validado. Invalida cualquier cotización en
         vuelo: si la respuesta vieja llega tarde, se tira. */
      pon: function (viaje) {
        estado.origen = viaje.origen || null;
        estado.destino = viaje.destino || null;
        estado.salida = viaje.salida || '';
        estado.regreso = viaje.regreso || '';
        estado.unidad = viaje.unidad || null;
        estado.redondo = viaje.redondo !== false;
        estado.cotizacion = null;
        serie++;
        avisa();
      },

      /* Pide el precio al servidor. Contesta siempre con un veredicto:
           { tipo: 'manual' }                — la unidad no cotiza en línea
           { tipo: 'listo', cotizacion }     — precio guardado en el estado
           { tipo: 'sinPrecio', aviso }      — no se pudo; se cotiza a mano
           { tipo: 'tarde' }                 — llegó después de otra búsqueda
         La pantalla decide qué pintar con cada uno; aquí no hay un solo id. */
      cotiza: function () {
        if (!estado.unidad || !estado.unidad.cotizadorAutomatico) {
          return Promise.resolve({ tipo: 'manual' });
        }
        if (!pide) { return Promise.resolve({ tipo: 'sinPrecio', aviso: '' }); }

        var mio = ++serie;
        return pide('/api/cotizar', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            origen: puntoDe(estado.origen),
            destino: puntoDe(estado.destino),
            salida: estado.salida,
            regreso: estado.regreso,
            redondo: estado.redondo
          })
        }).then(function (r) {
          return r.json().then(function (d) { return { ok: r.ok, d: d }; },
                               function () { return { ok: false, d: {} }; });
        }).then(function (res) {
          if (mio !== serie) { return { tipo: 'tarde' }; }
          if (!res.ok) { return { tipo: 'sinPrecio', aviso: (res.d && res.d.aviso) || '' }; }
          estado.cotizacion = soloCamposPermitidos(res.d);
          avisa();
          return { tipo: 'listo', cotizacion: estado.cotizacion };
        }, function () {
          return (mio === serie) ? { tipo: 'sinPrecio', aviso: '' } : { tipo: 'tarde' };
        });
      }
    };
  }

  var COTIZACION = {
    crea: crea,
    puntoDe: puntoDe,
    puntoExacto: puntoExacto,
    faltantes: faltantes,
    CAMPOS_COTIZACION: CAMPOS_COTIZACION
  };

  raiz.COTIZACION = COTIZACION;
  /* para las pruebas de Node; en el navegador esta rama no existe */
  if (typeof module !== 'undefined' && module.exports) { module.exports = COTIZACION; }
})(typeof window !== 'undefined' ? window : globalThis);
