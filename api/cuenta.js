/* ============================================================
   Las cuentas — UNA sola puerta
   ------------------------------------------------------------
   Todas las acciones de cuenta entran por aquí y se reparten con
   el campo `accion`. Empezaron siendo tres endpoints y se
   juntaron el 26-ago-2026, cuando el despliegue se cayó.

   POR QUE UNA SOLA, Y NO UNA POR ACCION

   El plan Hobby de Vercel publica un máximo de DOCE funciones por
   despliegue. Con `cuenta-crear`, `cuenta-codigo` y
   `cuenta-confirmar` sueltas íbamos en catorce, y el despliegue
   entero se cayó: la página siguió sirviendo la versión anterior y
   los tres endpoints nuevos contestaban 404.

   Y no era un problema de tres: al plan de cuentas le faltan
   entrar, salir, quién soy, mis viajes, olvidé mi contraseña,
   contraseña nueva y Google. Siete más. Una función por acción no
   cabía de ninguna manera.

   Esto NO amontona la lógica: cada pieza sigue en su módulo y se
   prueba sin red. Lo único que se comparte es la cáscara HTTP.

   Cada acción trae su propio freno, porque no piden lo mismo:
   crear una cuenta crea un cliente en Stripe y manda un correo;
   preguntar quién soy no cuesta nada.
   ============================================================ */

const defensas = require('./_defensas');
const acceso = require('./_acceso');
const logica = require('./_cuentas-logica');

/* Un freno por acción, no uno solo para todas: si compartieran contador,
   quien esté probando códigos dejaría sin crear cuenta a los demás. */
const FRENOS = {
  crear: defensas.creaFreno({ porMinuto: 5, porDia: 200 }),
  codigo: defensas.creaFreno({ porMinuto: 6, porDia: 300 }),
  confirmar: defensas.creaFreno({ porMinuto: 10, porDia: 200 })
};

const ACCIONES = {
  crear: logica.crear,
  codigo: logica.reenviar,
  confirmar: logica.confirmar
};

module.exports = async function handler(req, res) {
  if (defensas.puerta(req, res)) return;

  const cuerpo = defensas.cuerpoJSON(req);
  const accion = String((cuerpo && cuerpo.accion) || '').trim();

  const hacer = Object.prototype.hasOwnProperty.call(ACCIONES, accion) ? ACCIONES[accion] : null;
  if (!hacer) {
    res.status(400).json({ error: true, aviso: 'No entendimos qué querías hacer.' });
    return;
  }

  const frenado = FRENOS[accion](req);
  if (frenado) { res.status(frenado.status).json({ error: true, aviso: frenado.error }); return; }

  const r = await hacer(cuerpo);

  /* La sesión se pone aquí y no en la lógica: la cookie es cosa del
     transporte, y así la lógica se prueba sin fingir un `res`. */
  if (r.sesionPara) {
    res.setHeader('Set-Cookie', acceso.cookieDeSesion(acceso.firmaSesion(r.sesionPara)));
  }
  res.status(r.status).json(r.cuerpo);
};
