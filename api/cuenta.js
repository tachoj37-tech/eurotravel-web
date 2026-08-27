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
  confirmar: defensas.creaFreno({ porMinuto: 10, porDia: 200 }),
  /* Entrar es el que más se intenta a lo bruto. El freno de fondo es
     `scrypt`, que cuesta ~100 ms por intento; éste solo corta la ráfaga.
     NO hay bloqueo por cuenta: la regla 4 del proyecto —un candado que el
     atacante le puede cerrar a otro no es un candado—. */
  entrar: defensas.creaFreno({ porMinuto: 8, porDia: 300 }),
  salir: defensas.creaFreno({ porMinuto: 20, porDia: 500 }),
  yo: defensas.creaFreno({ porMinuto: 40, porDia: 2000 }),
  /* Google es barato de comprobar —una firma, y las llaves están en memoria—
     pero cada intento fallido nos hace hablar con Stripe. El freno es contra
     la ráfaga; el de fondo es que sin un papel firmado por Google no se pasa
     de la primera comprobación. */
  google: defensas.creaFreno({ porMinuto: 10, porDia: 400 }),
  /* Ésta la pregunta la pantalla al abrir la bifurcación, y no cuesta nada:
     devuelve un id que ya es público. */
  config: defensas.creaFreno({ porMinuto: 40, porDia: 2000 })
};

/* Las que necesitan saber QUIEN está dentro reciben el id sacado de la
   cookie; las demás, el cuerpo. Se separan para que ninguna acción de las
   de arriba pueda leer la sesión por accidente. */
const CON_CUERPO = {
  crear: logica.crear,
  codigo: logica.reenviar,
  confirmar: logica.confirmar,
  entrar: logica.entrar,
  google: logica.conGoogle
};
const CON_SESION = {
  yo: logica.yo
};
/* Las que no miran ni el cuerpo ni la sesión. `config` solo devuelve el id
   de cliente de Google, que ya es público y va escrito en la página. */
const SIN_NADA = {
  config: logica.config
};

module.exports = async function handler(req, res) {
  if (defensas.puerta(req, res)) return;

  const cuerpo = defensas.cuerpoJSON(req);
  const accion = String((cuerpo && cuerpo.accion) || '').trim();

  const tiene = function (o) { return Object.prototype.hasOwnProperty.call(o, accion); };
  if (!tiene(CON_CUERPO) && !tiene(CON_SESION) && !tiene(SIN_NADA) && accion !== 'salir') {
    res.status(400).json({ error: true, aviso: 'No entendimos qué querías hacer.' });
    return;
  }

  const frenado = FRENOS[accion](req);
  if (frenado) { res.status(frenado.status).json({ error: true, aviso: frenado.error }); return; }

  let r;
  if (accion === 'salir') {
    r = logica.salir();
  } else if (tiene(SIN_NADA)) {
    r = SIN_NADA[accion]();
  } else if (tiene(CON_SESION)) {
    /* El cliente sale de la COOKIE, ya comprobado el sello: nunca de lo que
       manda el navegador en el cuerpo. Ahí estaría el hueco. */
    r = await CON_SESION[accion](acceso.clienteDeSesion(acceso.sesionDe(req)));
  } else {
    r = await CON_CUERPO[accion](cuerpo);
  }

  /* La cookie es cosa del transporte, y por eso se pone y se quita aquí y no
     en la lógica: así la lógica se prueba sin fingir un `res`. */
  if (r.sesionPara) {
    res.setHeader('Set-Cookie', acceso.cookieDeSesion(acceso.firmaSesion(r.sesionPara)));
  } else if (r.borrarSesion) {
    res.setHeader('Set-Cookie', acceso.cookieBorrada());
  }
  res.status(r.status).json(r.cuerpo);
};
