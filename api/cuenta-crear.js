/* ============================================================
   «Quiero crear una cuenta»
   ------------------------------------------------------------
   La cáscara. Todo lo que decide vive en `_cuentas-logica.js`,
   que se prueba sin red y sin servidor.

   El freno es apretado a propósito: cada alta crea un cliente en
   Stripe y manda un correo, y las dos cosas cuestan. El freno por
   correo —para que nadie le llene la bandeja a otro— vive en la
   ficha del cliente, no aquí: en funciones serverless un contador
   en memoria no cuenta nada, porque cada llamada puede caer en
   otra máquina.
   ============================================================ */

const defensas = require('./_defensas');
const logica = require('./_cuentas-logica');

const freno = defensas.creaFreno({ porMinuto: 5, porDia: 200 });

module.exports = async function handler(req, res) {
  if (defensas.puerta(req, res)) return;

  const frenado = freno(req);
  if (frenado) { res.status(frenado.status).json({ error: frenado.error }); return; }

  const r = await logica.crear(defensas.cuerpoJSON(req));
  res.status(r.status).json(r.cuerpo);
};
