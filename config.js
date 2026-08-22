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
  API_PLACES: '/api/places'
};
