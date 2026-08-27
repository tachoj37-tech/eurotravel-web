/* ============================================================
   «Mándame el código otra vez»
   ------------------------------------------------------------
   El dueño lo pidió así: «el código se manda las veces que sea
   necesario hasta que el cliente verifique su correo».

   Necesario no es infinito. Los dos topes —un minuto entre envíos
   y doce en 24 horas— viven en la ficha del cliente, en
   `_cuentas.puedeMandarCodigo`, para que no se los salte quien
   insista hasta caer en otra máquina.
   ============================================================ */

const defensas = require('./_defensas');
const logica = require('./_cuentas-logica');

const freno = defensas.creaFreno({ porMinuto: 6, porDia: 300 });

module.exports = async function handler(req, res) {
  if (defensas.puerta(req, res)) return;

  const frenado = freno(req);
  if (frenado) { res.status(frenado.status).json({ error: frenado.error }); return; }

  const r = await logica.reenviar(defensas.cuerpoJSON(req));
  res.status(r.status).json(r.cuerpo);
};
