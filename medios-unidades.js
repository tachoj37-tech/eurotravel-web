/* ------------------------------------------------------------
   Fotos y video de cada unidad, para cuando el cliente pide ver.

   De dónde salieron: de la página oficial `eurotravel.com.mx`,
   bajadas el 2-sep-2026. Son fotos de estudio del dueño, no
   generadas ni de banco de imágenes.

   POR QUÉ ESTÁN AQUÍ Y NO ENLAZADAS A eurotravel.com.mx:
   ese dominio va a apuntar a esta misma página (ver
   `docs/CAMBIO-DE-DOMINIO.md`). El día del cambio, cualquier
   enlace a `eurotravel.com.mx/wp-content/...` se cae y el bot
   se queda mandando fotos rotas.

   Los originales pesaban 136 MB —archivos de cámara completos—.
   Aquí van a 1600 px de lado largo y calidad 82: 14 MB en total.
   Para WhatsApp y para el chat sobra; WhatsApp recomprime de
   todos modos.

   El `id` es el mismo de `unidades.js`, para poder cruzarlos.
   ------------------------------------------------------------ */

window.MEDIOS_UNIDADES = {

  /* La única que la página cotiza sola. Su carpeta es la que más
     se va a usar. */
  'sprinter':     { fotos: 7,  video: 'vOgRwIfsCAo' },

  'suburban':     { fotos: 11, video: null },   // la única sin video en el sitio
  'neobus':       { fotos: 8,  video: 'm7t-c0GDTKw' },
  'irizar-i6s':   { fotos: 7,  video: 'EzYe5KtLzVY' },
  'irizar-i6':    { fotos: 7,  video: 'GfHNhM8FIkA' },
  'irizar-pb':    { fotos: 6,  video: 'F6UTzxOxIQs' },

  /* YA SE SUPO QUÉ ES · Era la página genérica «Irizar» del sitio y
     resultó ser el **Century**, la unidad de entrada: 47 pasajeros,
     confirmado por el dueño y por su propia página el 4-sep-2026.

     Llevaba meses con sus fotos bajadas y sin estar en `unidades.js`,
     así que el bot no la podía ofrecer. Ya está dada de alta. */
  'irizar':       { fotos: 6,  video: '4bUMR2BYDog' },

  /* ------------------------------------------------------------
     EL G8 · fotos del dueño, no del sitio
     ------------------------------------------------------------
     Las únicas de esta lista que NO salieron de eurotravel.com.mx:
     el G8 es tan nuevo que todavía no está publicado ahí. Las mandó
     el dueño el 4-sep-2026 — dos exteriores, dos del pasillo y una
     del asiento.

     Llegaron en `.webp` y se convirtieron a `.jpg`. No fue capricho:
     **Meta no acepta webp para imágenes** —solo jpeg y png; el webp
     lo reserva para stickers— así que el bot no habría podido
     mandarlas. Se convirtieron con el códec de Windows, a 1600 px de
     lado largo y calidad 82, igual que todas las demás.

     La 01 es el exterior de tres cuartos a propósito: es la que sale
     junto al precio y la que el cliente reenvía a su grupo.
     ------------------------------------------------------------ */
  'g8':           { fotos: 5,  video: null }
};

/* EL AMARILLO NO VA · El sitio tiene un `irizar-i6-am` —un Volvo
   Irizar i6 amarillo, unidad 60, con calcas rojas y azules que no
   se parecen en nada al blanco con EURO TRAVEL del resto—. El
   dueño dijo el 2-sep-2026 que no se guarda. Sus 9 fotos y su
   video (`AgaYrHitlOs`) quedan fuera a propósito: si algún día
   vuelven a aparecer, es porque alguien las bajó sin leer esto. */

/* Las cinco del menú del sitio, una por unidad, en
   `img/unidades/portada/`. Sirven de miniatura. Eran seis: la del
   amarillo se quitó. */
window.PORTADAS_UNIDADES = 5;

/* ------------------------------------------------------------
   Cómo se arma la ruta de una foto:

     img/unidades/<id>/<id>-01.jpg  …  -0N.jpg

   Ejemplo: img/unidades/sprinter/sprinter-03.jpg

   Y el video: https://www.youtube.com/watch?v=<video>
   ------------------------------------------------------------ */

/* ------------------------------------------------------------
   DOS COSAS QUE EL SITIO OFICIAL DICE Y EL BOT NO DEBE REPETIR

   1 · «Wifi Ilimitado» en la Suburban. El dueño ya lo desmintió
       el 29-ago-2026 —«interiores de piel y pantalla táctil», el
       wifi no lo tiene— y ese mismo día se quitó de `index.html`.
       El sitio viejo todavía lo anuncia. Está mal ahí, no aquí.

   2 · ~~El i6 y el PB: 47 o 51.~~ **RESUELTO el 2-sep-2026.** Son
       **47** los dos, y lo confirmó el dueño con las capturas de su
       propia página: el número en grande y el diagrama de asientos
       numerado hasta el 47. `unidades.js` ya quedó en 47.
   ------------------------------------------------------------ */
