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
  config: defensas.creaFreno({ porMinuto: 40, porDia: 2000 }),
  /* Cada consulta de viajes es una llamada a Stripe, así que no se regala. */
  'mis-viajes': defensas.creaFreno({ porMinuto: 15, porDia: 800 }),
  /* Cambiar contraseña cuesta un `scrypt` de comprobación y otro de escritura:
     doscientos milisegundos de máquina por intento. */
  'cambiar-clave': defensas.creaFreno({ porMinuto: 6, porDia: 200 }),
  /* Recuperar manda correos, que cuestan dinero y llenan buzones ajenos. El
     freno de fondo son los doce por cuenta en 24 horas que vive en la ficha
     de Stripe; éste corta la ráfaga desde una misma dirección. */
  olvide: defensas.creaFreno({ porMinuto: 4, porDia: 150 }),
  /* Adivinar el código: seis dígitos, y el propio código solo aguanta cinco
     errores antes de morirse. Esto es contra la ráfaga de un millón. */
  'clave-nueva': defensas.creaFreno({ porMinuto: 8, porDia: 200 })
};

/* Las que necesitan saber QUIEN está dentro reciben el id sacado de la
   cookie; las demás, el cuerpo. Se separan para que ninguna acción de las
   de arriba pueda leer la sesión por accidente. */
const CON_CUERPO = {
  crear: logica.crear,
  codigo: logica.reenviar,
  confirmar: logica.confirmar,
  entrar: logica.entrar,
  google: logica.conGoogle,
  olvide: logica.olvide,
  'clave-nueva': logica.claveNueva
};
const CON_SESION = {
  yo: logica.yo,
  'mis-viajes': logica.misViajes
};
/* Las que necesitan las DOS cosas. Van aparte y nombradas para que se vea de
   un vistazo cuáles pueden tocar la sesión: la lista corta es la que se
   revisa cuando algo huele mal. */
const CON_AMBOS = {
  'cambiar-clave': logica.cambiarClave
};
/* Las que no miran ni el cuerpo ni la sesión. `config` solo devuelve el id
   de cliente de Google, que ya es público y va escrito en la página. */
const SIN_NADA = {
  config: logica.config
};

/* ------------------------------------------------------------
   EL PISO DE TIEMPO DE «OLVIDE MI CONTRASEÑA»
   ------------------------------------------------------------
   Sale de una revisión de seguridad el 27-ago-2026, y de medirlo:

     correo CON cuenta →  187 ms   (busca, escribe y manda correo)
     correo SIN cuenta →   31 ms   (busca y ya)

   Seis veces. La respuesta es palabra por palabra la misma en los
   dos casos —eso se cuidó— pero el reloj los separaba igual, y con
   eso se saca la lista de correos registrados de la empresa.

   `entrar` tenía lo mismo y ahí se arregló con trabajo de verdad:
   se corre `scrypt` aunque no haya cuenta. Aquí no se puede —no se
   le manda un correo a nadie— así que se empareja por abajo: la
   respuesta nunca sale antes del piso, exista la cuenta o no.

   VA EN LA CASCARA Y NO EN LA LOGICA, como la cookie: es cuánto
   tarda la RESPUESTA, no qué decide el servidor. Así la lógica se
   sigue probando sin esperar un segundo por llamada.

   El piso está por arriba de lo que tarda el camino largo en
   producción. Si Resend tuviera un día muy malo y se pasara, la
   diferencia volvería a asomarse; contra eso queda el tope de la
   puerta —cuatro por minuto, ciento cincuenta al día— que es lo
   que de verdad impide barrer una lista.
   ------------------------------------------------------------ */
const PISO_MS = { olvide: 1200 };

function esperaHasta(desde, ms) {
  const falta = ms - (Date.now() - desde);
  if (falta <= 0) return Promise.resolve();
  return new Promise(function (listo) { setTimeout(listo, falta); });
}

module.exports = async function handler(req, res) {
  if (defensas.puerta(req, res)) return;

  const arranco = Date.now();
  const cuerpo = defensas.cuerpoJSON(req);
  const accion = String((cuerpo && cuerpo.accion) || '').trim();

  const tiene = function (o) { return Object.prototype.hasOwnProperty.call(o, accion); };
  if (!tiene(CON_CUERPO) && !tiene(CON_SESION) && !tiene(CON_AMBOS) &&
      !tiene(SIN_NADA) && accion !== 'salir') {
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
  } else if (tiene(CON_AMBOS)) {
    /* El cuerpo va PRIMERO y la sesión después, en ese orden, para que nunca
       se pueda confundir uno con otro al leer la llamada. */
    r = await CON_AMBOS[accion](cuerpo, acceso.clienteDeSesion(acceso.sesionDe(req)));
  } else {
    r = await CON_CUERPO[accion](cuerpo);
  }

  /* Antes de contestar, el piso de tiempo si esta acción lo tiene. Ver la
     nota de arriba: sin esto, el reloj dice si un correo tiene cuenta. */
  if (PISO_MS[accion]) await esperaHasta(arranco, PISO_MS[accion]);

  /* La cookie es cosa del transporte, y por eso se pone y se quita aquí y no
     en la lógica: así la lógica se prueba sin fingir un `res`. */
  if (r.sesionPara) {
    res.setHeader('Set-Cookie', acceso.cookieDeSesion(acceso.firmaSesion(r.sesionPara)));
  } else if (r.borrarSesion) {
    res.setHeader('Set-Cookie', acceso.cookieBorrada());
  }
  res.status(r.status).json(r.cuerpo);
};
