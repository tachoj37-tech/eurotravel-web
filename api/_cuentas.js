/* ============================================================
   Las cuentas de los clientes
   ------------------------------------------------------------
   Hasta hoy la página no tenía cuentas: cada viaje era una liga
   firmada, y quien tuviera la liga entraba. Sigue siendo así para
   quien compra como invitado.

   El dueño pidió el segundo camino el 26-ago-2026: antes de pagar,
   «continuar como invitado» o «crear cuenta», y a la cuenta se
   entra con CORREO Y CONTRASEÑA.

   COMO ENTRA CADA QUIEN, EN SUS PALABRAS

     «El código se manda las veces que sea necesario hasta que el
      cliente verifique su correo. Una vez que creó correo y
      contraseña ya no le vas a mandar correos para nada al entrar,
      puede entrar con su contraseña. Solo le mandarías correo si
      olvida su contraseña.»

   O sea que el correo aparece DOS veces en la vida de una cuenta:
   al confirmarla —cuantas veces haga falta— y si se le olvida la
   contraseña. Nunca al entrar.

   DONDE VIVE UNA CUENTA

   En la ficha del cliente de Stripe, que ya guarda su correo, su
   nombre, su teléfono y todos sus pagos. El proyecto no tiene base
   de datos ni una sola dependencia, y esto no las trae.

   Lo que eso cuesta, dicho de frente: Stripe NO impide dos clientes
   con el mismo correo, así que la unicidad se cuida aquí (ver
   `buscaPorCorreo`), y el resumen de la contraseña se ve en el
   panel de Stripe. Un resumen no es la contraseña —no se puede
   deshacer— pero queda dicho.

   LA CONTRASEÑA NO SE GUARDA. NUNCA.

   Se guarda `scrypt(contraseña, sal)`, que es lento a propósito:
   probar un millón de contraseñas cuesta tiempo de verdad. La sal
   es distinta por cliente, así que dos personas con la misma
   contraseña tienen resúmenes distintos y no se puede atacar a
   todas de una.

   `scrypt` viene dentro de Node. Cero dependencias, como el resto.

   El nombre empieza con guion bajo para que Vercel no lo publique
   como una dirección más del sitio.
   ============================================================ */

const crypto = require('crypto');

/* Los campos de la cuenta en la ficha del cliente. Con prefijo `cuenta_`
   para no chocar con los `acceso_*` del código de la liga, que viven en la
   misma ficha y sirven para otra cosa. */
const CAMPO_HASH = 'cuenta_hash';
const CAMPO_SAL = 'cuenta_sal';
const CAMPO_VERIFICADA = 'cuenta_verificada';
const CAMPO_GOOGLE = 'cuenta_google';
const CAMPO_CREADA = 'cuenta_creada';

/* ------------------------------------------------------------
   EL COSTO DE `scrypt`, Y POR QUE ESTOS NUMEROS
   ------------------------------------------------------------
   N=16384 · r=8 · p=1 son los parámetros que recomienda el propio
   Node. Piden 16 MB de memoria por intento —N × r × 128— y tardan
   del orden de 100 ms.

   Ese retraso es el punto: al cliente le cuesta un parpadeo una
   vez, y a quien quiera probar contraseñas a lo bruto le cuesta
   cien milisegundos CADA UNA. Un diccionario de un millón se
   vuelve un día y medio de máquina en vez de un segundo.

   `maxmem` va explícito y con holgura: el tope por omisión de Node
   son 32 MB y estos parámetros piden 16, pero dejarlo al aire
   significa que un cambio de parámetros truena en producción en
   vez de aquí.
   ------------------------------------------------------------ */
const SCRYPT = { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };
const LARGO_HASH = 32;          // bytes; 64 caracteres en hexadecimal
const LARGO_SAL = 16;

/* ------------------------------------------------------------
   QUE CONTRASEÑA SE ACEPTA
   ------------------------------------------------------------
   Un mínimo de ocho, y nada más. No se piden mayúsculas ni signos
   raros: esas reglas empujan a la gente a «Password1!» y a
   apuntarla en un papel, que es peor que una frase larga.

   Se topa a 200 para que nadie mande un megabyte y ponga a `scrypt`
   a trabajar de gratis contra el servidor.
   ------------------------------------------------------------ */
const MINIMO = 8;
const MAXIMO = 200;

function porQueNoSirve(contrasena) {
  const c = String(contrasena == null ? '' : contrasena);
  if (!c) return 'Escribe una contraseña.';
  if (c.length < MINIMO) return 'La contraseña necesita al menos ' + MINIMO + ' caracteres.';
  if (c.length > MAXIMO) return 'Esa contraseña es demasiado larga.';
  return null;
}

function nuevaSal() { return crypto.randomBytes(LARGO_SAL).toString('hex'); }

/* El resumen. Devuelve una promesa porque `scrypt` tarda a propósito y
   bloquear el hilo cien milisegundos por intento dejaría al servidor sordo
   mientras tanto. */
function resumen(contrasena, sal) {
  return new Promise(function (listo, falla) {
    crypto.scrypt(String(contrasena), String(sal), LARGO_HASH, SCRYPT, function (e, clave) {
      if (e) falla(e); else listo(clave.toString('hex'));
    });
  });
}

function igualesEnTiempoConstante(a, b) {
  const A = Buffer.from(String(a), 'utf8');
  const B = Buffer.from(String(b), 'utf8');
  /* `timingSafeEqual` truena si miden distinto. Que midan distinto NO es
     secreto —son resúmenes de largo fijo— así que se resuelve antes. */
  if (A.length !== B.length) return false;
  return crypto.timingSafeEqual(A, B);
}

/* ------------------------------------------------------------
   CREAR: lo que hay que escribir en la ficha del cliente
   ------------------------------------------------------------
   Nace SIN VERIFICAR. Hasta que el cliente teclee el código que le
   llegó al correo, la cuenta existe pero no abre.
   ------------------------------------------------------------ */
async function paraCrear(contrasena, ahoraMs) {
  const sal = nuevaSal();
  const m = {};
  m[CAMPO_SAL] = sal;
  m[CAMPO_HASH] = await resumen(contrasena, sal);
  m[CAMPO_VERIFICADA] = '';
  m[CAMPO_CREADA] = String(typeof ahoraMs === 'number' ? ahoraMs : Date.now());
  return m;
}

/* Cambiar la contraseña: sal NUEVA, no la de antes. Reusar la sal dejaría
   ver que la contraseña cambió pero el resumen no, y de rebote que la nueva
   es igual a la vieja. */
async function paraCambiar(contrasena) {
  const sal = nuevaSal();
  const m = {};
  m[CAMPO_SAL] = sal;
  m[CAMPO_HASH] = await resumen(contrasena, sal);
  return m;
}

function paraVerificar() {
  const m = {};
  m[CAMPO_VERIFICADA] = '1';
  return m;
}

function paraLigarGoogle(sub) {
  const m = {};
  m[CAMPO_GOOGLE] = String(sub || '').slice(0, 64);
  return m;
}

/* ------------------------------------------------------------
   LEER LO QUE HAY
   ------------------------------------------------------------ */
function tieneCuenta(metadata) {
  const m = metadata || {};
  return !!(String(m[CAMPO_HASH] || '') || String(m[CAMPO_GOOGLE] || ''));
}
function tieneContrasena(metadata) {
  return !!String((metadata || {})[CAMPO_HASH] || '');
}
function estaVerificada(metadata) {
  return String((metadata || {})[CAMPO_VERIFICADA] || '') === '1';
}
function googleDe(metadata) {
  return String((metadata || {})[CAMPO_GOOGLE] || '') || null;
}

/* ------------------------------------------------------------
   ¿ES SU CONTRASEÑA?
   ------------------------------------------------------------
   Devuelve una promesa de true/false, y NADA más. Quien llama no
   se entera de si la cuenta existe, si le falta la sal o si nunca
   tuvo contraseña: todo eso da `false`.

   Es a propósito. Un mensaje que distinga «esa cuenta no existe»
   de «esa contraseña no es» le regala a cualquiera una lista de
   los correos que sí están registrados.
   ------------------------------------------------------------ */
async function contrasenaValida(metadata, contrasena) {
  const m = metadata || {};
  const guardado = String(m[CAMPO_HASH] || '');
  const sal = String(m[CAMPO_SAL] || '');
  const c = String(contrasena == null ? '' : contrasena);
  if (!guardado || !sal || !c || c.length > MAXIMO) return false;
  let calculado;
  try { calculado = await resumen(c, sal); } catch (e) { return false; }
  return igualesEnTiempoConstante(calculado, guardado);
}

/* ------------------------------------------------------------
   EL CORREO, NORMALIZADO
   ------------------------------------------------------------
   Se guarda y se busca SIEMPRE en minúsculas y sin espacios. Se
   comprobó contra la cuenta real de Stripe que su filtro de correo
   distingue mayúsculas: sin esto, «Ana@x.mx» y «ana@x.mx» serían
   dos cuentas distintas y la segunda no encontraría a la primera.
   ------------------------------------------------------------ */
function normalizaCorreo(correo) {
  return String(correo == null ? '' : correo).trim().toLowerCase().slice(0, 160);
}

/* Una comprobación de forma, no de existencia. No valida que el correo
   exista —para eso está el código de seis dígitos— solo que se parezca a
   uno, para no crear clientes en Stripe con basura. */
function correoValido(correo) {
  const c = normalizaCorreo(correo);
  return /^[^\s@]+@[^\s@.]+\.[^\s@]{2,}$/.test(c);
}

module.exports = {
  CAMPO_HASH, CAMPO_SAL, CAMPO_VERIFICADA, CAMPO_GOOGLE, CAMPO_CREADA,
  MINIMO, MAXIMO,
  porQueNoSirve, nuevaSal, resumen,
  paraCrear, paraCambiar, paraVerificar, paraLigarGoogle,
  tieneCuenta, tieneContrasena, estaVerificada, googleDe,
  contrasenaValida, normalizaCorreo, correoValido
};
