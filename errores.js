/* ============================================================
   Aviso de errores del navegador
   ------------------------------------------------------------
   Cuando algo truena en la pantalla de un cliente, nadie se
   entera: él cierra la pestaña y nosotros nunca supimos que
   pasó. Esto manda ese error a Sentry para poder verlo.

   Está escrito a mano, sin el SDK de Sentry, y es a propósito:

   1. El SDK manda la DIRECCIÓN COMPLETA de la página. Las ligas
      de viaje llevan el token firmado en la dirección
      (viaje.html?ev=...), así que el SDK le estaría entregando a
      un tercero la llave de entrada de cada cliente. El propio
      viaje.html tiene escrito arriba que ese token «no se manda
      a analítica». Aquí se recorta la dirección y solo va la
      ruta.

   2. El SDK graba lo que la gente teclea como «migajas», y esta
      es la página donde el cliente escribe su nombre, su
      teléfono y a dónde va. Nada de eso sale de aquí.

   3. El proyecto no tiene dependencias ni compilación. Meter el
      SDK obligaba a abrirle la puerta a un script de fuera en la
      misma página donde se paga.

   Lo único que sale: qué error fue, en qué archivo y renglón, en
   qué ruta, y qué navegador. Nada más.

   La clave de abajo es PÚBLICA por diseño: solo sirve para
   ESCRIBIR reportes, no para leer nada de la cuenta. Va en el
   navegador igual que en cualquier sitio que use Sentry.
   ============================================================ */

(function () {
  'use strict';

  var CLAVE = 'ad9365f0646677d1ac64a19cdb2b75e3';
  var PROYECTO = '4512008196980736';
  var CASA = 'https://o4512003711041536.ingest.us.sentry.io';
  var BUZON = CASA + '/api/' + PROYECTO + '/envelope/?sentry_key=' + CLAVE +
    '&sentry_version=7';

  // Se guarda el fetch de fábrica ANTES de envolverlo, más abajo. El aviso
  // tiene que salir por aquí: si saliera por el envuelto, un aviso que falla
  // provocaría otro aviso, y ese otro, sin fin.
  var fetchOriginal = window.fetch ? window.fetch.bind(window) : null;

  // En la computadora del desarrollador no reportamos: ensuciaría
  // el tablero con errores que estamos provocando a propósito.
  var esLocal = /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname) ||
    location.protocol === 'file:';

  // Un error dentro de un bucle de dibujado puede dispararse cientos
  // de veces por segundo. Con tope y sin repetidos, un cliente manda
  // cuando mucho cinco reportes distintos por visita.
  var TOPE = 5;
  var enviados = 0;
  var yaVistos = {};

  function identificador() {
    var b = new Uint8Array(16);
    if (window.crypto && crypto.getRandomValues) {
      crypto.getRandomValues(b);
    } else {
      for (var i = 0; i < 16; i++) b[i] = Math.floor(Math.random() * 256);
    }
    var s = '';
    for (var j = 0; j < 16; j++) s += ('0' + b[j].toString(16)).slice(-2);
    return s;
  }

  // La dirección sin lo que va después del signo de interrogación.
  // Ahí es donde viaja el token del cliente.
  function rutaLimpia() {
    try {
      var u = new URL(location.href);
      return u.origin + u.pathname;
    } catch (e) {
      return location.pathname || '/';
    }
  }

  function reporta(tipo, mensaje, archivo, renglon, columna, pila) {
    try {
      if (esLocal || enviados >= TOPE) return;

      var firma = tipo + '|' + mensaje + '|' + archivo + '|' + renglon;
      if (yaVistos[firma]) return;
      yaVistos[firma] = true;
      enviados++;

      var id = identificador();
      var evento = {
        event_id: id,
        timestamp: Date.now() / 1000,
        platform: 'javascript',
        level: 'error',
        logger: 'navegador',
        exception: {
          values: [{
            type: String(tipo || 'Error').slice(0, 120),
            value: String(mensaje || 'sin mensaje').slice(0, 500)
          }]
        },
        request: { url: rutaLimpia() },
        tags: { pagina: location.pathname },
        extra: {
          archivo: String(archivo || '').slice(0, 300),
          renglon: renglon,
          columna: columna,
          pila: String(pila || '').slice(0, 3000),
          navegador: navigator.userAgent
        }
      };

      var sobre =
        JSON.stringify({ event_id: id, sent_at: new Date().toISOString() }) + '\n' +
        JSON.stringify({ type: 'event' }) + '\n' +
        JSON.stringify(evento);

      // keepalive: si el error tumbó la página y el cliente la cierra,
      // el envío sigue en pie. text/plain evita el trámite previo de
      // permiso entre sitios, que retrasaría y a veces perdería el aviso.
      if (!fetchOriginal) return;
      fetchOriginal(BUZON, {
        method: 'POST',
        body: sobre,
        keepalive: true,
        headers: { 'Content-Type': 'text/plain;charset=UTF-8' }
      }).catch(function () { /* si el aviso falla, se calla */ });
    } catch (e) {
      // Un aviso de error jamás puede ser el que rompa la página.
    }
  }

  window.addEventListener('error', function (ev) {
    var e = ev.error;
    reporta(
      e && e.name ? e.name : 'Error',
      e && e.message ? e.message : ev.message,
      ev.filename, ev.lineno, ev.colno,
      e && e.stack ? e.stack : ''
    );
  });

  window.addEventListener('unhandledrejection', function (ev) {
    var r = ev.reason;
    reporta(
      r && r.name ? r.name : 'PromesaRechazada',
      r && r.message ? r.message : String(r),
      '', 0, 0,
      r && r.stack ? r.stack : ''
    );
  });

  // Para avisar de algo que no truena solo, por ejemplo cuando una
  // respuesta del servidor viene mal formada.
  window.avisaError = function (mensaje, detalle) {
    reporta('Aviso', mensaje, '', 0, 0, detalle ? String(detalle) : '');
  };

  /* ----------------------------------------------------------
     Las peticiones al servidor
     ----------------------------------------------------------
     Lo de arriba solo caza lo que TRUENA. Pero la página está
     escrita a la defensiva: hay 19 peticiones que atrapan su
     propia falla y le enseñan «No hubo conexión.» al cliente.
     Un .catch() así se traga el error y nadie se entera.

     Sin esto, un cliente podía fallar al pagar tres veces
     seguidas y el tablero seguía en cero.

     Se envuelve fetch UNA vez, aquí, en lugar de tocar las 19.
     Solo mira de paso: no cambia lo que devuelve, no lee el
     cuerpo de la respuesta —eso rompería a quien la pidió— y si
     algo sale mal se calla.

     Qué se reporta y qué no:

       · Solo lo nuestro (/api/…). Lo de fuera no es asunto suyo,
         y de paso esto deja fuera al propio aviso a Sentry.
       · El servidor contestó 500 o peor  → SIEMPRE. Ese es tuyo.
       · El servidor contestó 400-499     → NUNCA. Eso es normal:
         contraseña mal, código vencido, sesión caída.
       · Se cayó la conexión              → solo en /api/pagar y
         /api/confirmar. En los demás casi siempre es el wifi del
         cliente en el camión, no un defecto; pero si se cae a la
         mitad de un pago, eso se quiere saber pase lo que pase.
     ---------------------------------------------------------- */

  function comoUrl(entrada) {
    try {
      if (typeof entrada === 'string') return new URL(entrada, location.href);
      if (entrada instanceof URL) return entrada;
      if (entrada && typeof entrada.url === 'string') {
        return new URL(entrada.url, location.href);
      }
    } catch (e) { /* si no se puede leer, no se vigila */ }
    return null;
  }

  if (fetchOriginal) {
    window.fetch = function (entrada, opciones) {
      var promesa = fetchOriginal.apply(null, arguments);
      try {
        var u = comoUrl(entrada);
        var nuestra = u && u.origin === location.origin &&
          u.pathname.indexOf('/api/') === 0;
        if (nuestra) {
          var esDinero = /^\/api\/(pagar|confirmar)$/.test(u.pathname);
          // Esta rama cuelga de la promesa pero NO la reemplaza: quien
          // pidió sigue recibiendo la de siempre, con su mismo resultado.
          promesa.then(function (r) {
            if (r && r.status >= 500) {
              reporta('ServidorFallo',
                'El servidor contesto ' + r.status + ' en ' + u.pathname,
                u.pathname, 0, 0, '');
            }
          }, function (e) {
            if (esDinero) {
              reporta('PagoSinConexion',
                'Se corto la conexion en ' + u.pathname + ': ' +
                  (e && e.message ? e.message : String(e)),
                u.pathname, 0, 0, '');
            }
          });
        }
      } catch (e) { /* vigilar jamas puede romper la peticion */ }
      return promesa;
    };
  }
})();
