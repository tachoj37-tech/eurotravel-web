/* ============================================================
   Cerrar sesión
   ------------------------------------------------------------
   La verificación dura ocho horas. En la computadora de su casa
   eso es comodidad; en una prestada, en un cibercafé o en el
   celular que le pasó a alguien, es ocho horas de acceso para
   quien se siente después.

   Esto lo cierra al momento.

   Faltaba, y era una omisión: se prometió al diseñar la puerta
   del código y no se construyó. Se encontró atacando la propia
   liga —«¿hay forma de matar la cookie?»— y no la había.

   No necesita nada: borrar la cookie es decirle al navegador que
   la olvide. No hay estado del lado del servidor que limpiar,
   porque la sesión nunca se guardó de este lado.
   ============================================================ */

const defensas = require('./_defensas');
const acceso = require('./_acceso');

module.exports = async function handler(req, res) {
  if (defensas.puerta(req, res)) return;

  /* Sin frenos ni comprobaciones: cerrar sesión SIEMPRE tiene que poder.
     Un candado que a veces no deja salir no es un candado, es una trampa. */
  res.setHeader('Set-Cookie', acceso.cookieBorrada());
  res.status(200).json({ cerrada: true });
};
