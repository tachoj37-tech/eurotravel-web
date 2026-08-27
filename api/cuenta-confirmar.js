/* ============================================================
   «Éste es mi código» — el de la cuenta
   ------------------------------------------------------------
   Si cuadra, la cuenta queda verificada y se abre la sesión de
   ocho horas en la misma respuesta: el cliente teclea seis dígitos
   y ya está dentro, sin un paso de más.

   Los tres candados son los mismos de la liga, porque es el mismo
   mecanismo: el código vence a los diez minutos, sirve una sola
   vez, y aguanta cinco intentos.

   Y a partir de aquí NO vuelve a recibir correos para entrar: el
   dueño lo pidió expresamente. Con su contraseña basta.
   ============================================================ */

const defensas = require('./_defensas');
const acceso = require('./_acceso');
const logica = require('./_cuentas-logica');

/* Contra la fuerza bruta sobre el código. El freno que de verdad ataja es el
   contador de intentos, que vive en Stripe y es el mismo para todas las
   máquinas; éste solo evita la ráfaga. */
const freno = defensas.creaFreno({ porMinuto: 10, porDia: 200 });

module.exports = async function handler(req, res) {
  if (defensas.puerta(req, res)) return;

  const frenado = freno(req);
  if (frenado) { res.status(frenado.status).json({ error: frenado.error }); return; }

  const r = await logica.confirmar(defensas.cuerpoJSON(req));

  /* La sesión se pone AQUI y no en la lógica: la cookie es cosa del
     transporte, y así la lógica se puede probar sin fingir un `res`. */
  if (r.sesionPara) {
    res.setHeader('Set-Cookie', acceso.cookieDeSesion(acceso.firmaSesion(r.sesionPara)));
  }
  res.status(r.status).json(r.cuerpo);
};
