/* ============================================================
   Configuración del sitio
   ------------------------------------------------------------
   GOOGLE_MAPS_KEY es la clave del NAVEGADOR. Va aquí a propósito:
   el autocompletado de direcciones corre en el equipo del cliente
   y no hay forma de ocultarla. Lo que la protege son las
   restricciones que tiene en Google Cloud:

     · Restricción de aplicación: solo https://eurotravel-web.vercel.app/*
     · Restricción de API: solo Places API (New)

   Si se deja vacía, el sitio sigue funcionando: las direcciones se
   escriben a mano, sin sugerencias.

   OJO: la clave del SERVIDOR (Routes API, para calcular kilómetros)
   NUNCA va en este archivo. Esa vive en las variables de entorno de
   Vercel y solo la lee el backend.
   ============================================================ */

window.CONFIG = {
  GOOGLE_MAPS_KEY: 'AIzaSyDAO0MroYUJaFzkK8NvJvaS2TWJi3yOH84',
  PAIS: 'mx',
  IDIOMA: 'es'
};
