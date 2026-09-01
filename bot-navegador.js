/* ============================================================
   El chat de la página
   ------------------------------------------------------------
   Solo la pantalla. Lo que se contesta lo decide `bot.js`, el
   MISMO archivo que va a correr el webhook de WhatsApp: si un día
   se cambia una respuesta, cambia en los dos lados sola.

   Aquí NO vive ninguna tarifa. Cuando el bot ya juntó los datos
   devuelve `cotiza`, y este archivo se los pasa a `/api/cotizar`,
   que es la misma puerta que usa el cotizador de la página. El
   precio sale del motor de cobro o no sale.
   ============================================================ */

(function () {
  'use strict';

  var panel = document.getElementById('wa-chat');
  var hilo = document.getElementById('wa-hilo');
  var caja = document.getElementById('wa-caja');
  var forma = document.getElementById('wa-forma');
  var abrir = document.getElementById('wa-abrir');
  var cerrar = document.getElementById('wa-cerrar');
  var atajos = document.getElementById('wa-atajos');

  if (!panel || !window.BOT) return;

  /* El hilo de la conversación. `estado` es lo que el bot va
     recordando entre mensajes; vive aquí y no dentro del bot para
     que en el servidor cada cliente tenga el suyo. */
  var estado = null;
  var ocupado = false;
  var arrancado = false;

  /* El mismo escapador del resto del sitio: lo que se teclea NUNCA
     entra como HTML. */
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  /* WhatsApp pone negritas entre asteriscos y vuelve ligas las
     direcciones. Se imita para que se lea igual que allá. Todo se
     aplica DESPUÉS de escapar, así que nada de lo tecleado puede
     volverse etiqueta. */
  function comoWhatsApp(s) {
    return esc(s)
      .replace(/\*([^*\n]+)\*/g, '<b>$1</b>')
      .replace(/(https?:\/\/[^\s<]+)/g, function (u) {
        return '<a href="' + u + '" target="_blank" rel="noopener">' + u + '</a>';
      });
  }

  function burbuja(texto, quien) {
    var d = document.createElement('div');
    d.className = 'wa-b wa-' + quien;
    d.innerHTML = comoWhatsApp(texto);
    hilo.appendChild(d);
    hilo.scrollTop = hilo.scrollHeight;
    return d;
  }

  function escribiendo() {
    var d = document.createElement('div');
    d.className = 'wa-b wa-bot wa-puntos';
    d.innerHTML = '<span></span><span></span><span></span>';
    hilo.appendChild(d);
    hilo.scrollTop = hilo.scrollHeight;
    return d;
  }

  /* Contesta con un respiro. Instantáneo se siente a máquina, y
     además da tiempo de leer lo anterior. */
  function conPausa(fn, ms) {
    var p = escribiendo();
    setTimeout(function () { p.remove(); fn(); }, ms || 550);
  }

  function pintaAtajos(lista) {
    atajos.textContent = '';
    (lista || []).forEach(function (a) {
      var b = document.createElement('button');
      b.type = 'button';
      b.textContent = a;
      b.addEventListener('click', function () { manda(a); });
      atajos.appendChild(b);
    });
  }

  var ATAJOS_INICIO = ['Quiero cotizar', '¿Qué unidades tienen?',
    '¿Qué incluye?', 'Hablar con una persona'];

  /* ------------------------------------------------------------
     EL PRECIO
     ------------------------------------------------------------
     `/api/cotizar` decide. Si falla, se dice la verdad y se pasa
     con una persona: inventar un número aquí sería justo lo que el
     bot tiene prohibido.
     ------------------------------------------------------------ */
  function pideElPrecio(peticion, resumen) {
    fetch('/api/cotizar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(peticion)
    }).then(function (r) {
      return r.ok ? r.json() : null;
    }).then(function (precio) {
      conPausa(function () {
        var r = window.BOT.textoDeCotizacion(precio, resumen);
        burbuja(r.texto, 'bot');
        pintaAtajos(['Cotizar otro viaje', 'Hablar con una persona']);
        ocupado = false;
      }, 900);
    }).catch(function () {
      conPausa(function () {
        burbuja(window.BOT.textoDeCotizacion(null, resumen).texto, 'bot');
        pintaAtajos(ATAJOS_INICIO);
        ocupado = false;
      });
    });
  }

  function manda(texto) {
    if (ocupado || !String(texto).trim()) return;
    burbuja(texto, 'yo');
    caja.value = '';
    atajos.textContent = '';
    ocupado = true;

    var r;
    try {
      r = window.BOT.respuestaA(texto, estado);
    } catch (e) {
      /* Si el bot truena, el cliente no se queda mirando la nada. Y el
         aviso llega a Sentry por `errores.js`. */
      if (window.avisaError) window.avisaError('el bot trono', e && e.message);
      burbuja('Se me trabó algo 🙈 Márcale al *' + window.BOT.TELEFONO + '*.', 'bot');
      ocupado = false;
      return;
    }

    estado = r.estado || null;

    conPausa(function () {
      burbuja(r.texto, 'bot');
      if (r.cotiza) {
        pideElPrecio(r.cotiza, r.resumen);
        return;                       // el precio llega en el siguiente turno
      }
      if (r.pasa) {
        var liga = document.createElement('a');
        liga.className = 'wa-real';
        liga.href = 'https://wa.me/523321832993';
        liga.target = '_blank';
        liga.rel = 'noopener';
        liga.textContent = 'Abrir WhatsApp con una persona';
        hilo.appendChild(liga);
        hilo.scrollTop = hilo.scrollHeight;
      }
      pintaAtajos(estado ? [] : ATAJOS_INICIO);
      ocupado = false;
    });
  }

  function abre() {
    panel.hidden = false;
    abrir.setAttribute('aria-expanded', 'true');
    if (!arrancado) {
      arrancado = true;
      conPausa(function () {
        burbuja(window.BOT.respuestaA('hola').texto, 'bot');
        pintaAtajos(ATAJOS_INICIO);
      }, 400);
    }
    setTimeout(function () { caja.focus(); }, 100);
  }

  function cierra() {
    panel.hidden = true;
    abrir.setAttribute('aria-expanded', 'false');
    abrir.focus();
  }

  abrir.addEventListener('click', function () {
    panel.hidden ? abre() : cierra();
  });
  cerrar.addEventListener('click', cierra);

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && !panel.hidden) cierra();
  });

  forma.addEventListener('submit', function (e) {
    e.preventDefault();
    manda(caja.value);
  });
})();
