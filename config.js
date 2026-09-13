/* ============================================================
   Configuración pública del sitio
   ------------------------------------------------------------
   Aquí NO va ninguna clave. El autocompletado de direcciones se
   pide a /api/places, y es ese endpoint —que corre en el
   servidor— quien habla con Google usando GOOGLE_PLACES_KEY.

   Las claves viven solo en las variables de entorno de Vercel:

     GOOGLE_PLACES_KEY  · autocompletado de direcciones
     GOOGLE_ROUTES_KEY  · cálculo de kilómetros (Fase 2)

   Ninguna de las dos se envía al navegador ni se guarda en este
   repositorio.
   ============================================================ */

window.CONFIG = {
  PAIS: 'mx',
  IDIOMA: 'es',
  API_PLACES: '/api/places',

  /* ------------------------------------------------------------
     EL WHATSAPP DE LA PÁGINA, EN UN SOLO LUGAR
     ------------------------------------------------------------
     El 12-sep-2026 había OCHO `wa.me` repartidos en cuatro archivos,
     y con DOS números distintos: el del WhatsApp y —en cuatro de los
     ocho— el del TELÉFONO. Entre esos cuatro estaba el botón «Enviar
     por WhatsApp» del resumen de la cotización, que es el momento de
     mayor intención de compra de la página: el cliente acababa de
     armar su viaje, picaba, y le escribía a un número que no es el
     WhatsApp de la empresa.

     Y LO QUE VIENE LO HACE PEOR. El WhatsApp se va a mudar a Kommo
     —dictado del dueño: «va a abrir el whatsapp que estamos
     trabajando con kommo, ve ajustando la ruta»—. Con el número
     escrito a mano en ocho lugares, ese día hay que acertarle a los
     ocho. Desde aquí es UN renglón.

     HOY SIGUE SIENDO EL DE SIEMPRE, a propósito: el número que ya
     está en Kommo es nuevo y de pruebas, y la mudanza del bueno
     viene después (ver `docs/PASAR-EL-BOT-A-KOMMO.md`). Lo que se
     adelanta es la ruta, no el cambio.

     NO ES UN SECRETO: va en el pie de página, a la vista de
     cualquiera. Por eso vive aquí y no en una variable de entorno.
     El servidor tiene la suya —`WHATSAPP_PUBLICO`— porque allá no se
     carga este archivo.
     ------------------------------------------------------------ */
  WHATSAPP: '523321832993',

  /* Lo que el cliente encuentra ya escrito al abrir WhatsApp, para que
     solo le dé enviar. Del plan, palabra por palabra. */
  WHATSAPP_TEXTO: 'Hola, estoy viendo su página y quiero cotizar un viaje.'
};
