/* ============================================================
   Quién entra a ver un viaje
   ------------------------------------------------------------
   La liga sola YA NO ABRE NADA. Abre una puerta que pide un
   código de seis dígitos, y ese código llega al correo con el
   que se pagó — no al que teclee quien está enfrente.

   POR QUE, SI LA LIGA YA VA FIRMADA

   Porque la firma prueba que la liga es legítima, no que quien
   la tiene sea su dueño. Una liga sola es un pase al portador: la
   reenvía, la deja en el historial de una computadora prestada, o
   se la ve alguien por encima del hombro, y ya está adentro.

   LO QUE ESTO PROTEGE, Y LO QUE NO

   Dicho sin adorno, porque importa: el código llega AL MISMO
   CORREO donde está la liga. A quien ya entró al buzón, esto no
   lo detiene. Lo que detiene es todo lo demás —el reenvío, el
   historial, la liga compartida— que es la mayoría de los casos
   de verdad. Y si el dueño quiere dejar entrar a alguien, le
   dicta el código: esa es su autorización.

   OCHO HORAS

   Verificado una vez, no se vuelve a pedir en ocho horas. La
   prueba de eso vive en una cookie firmada que pone el servidor
   —`HttpOnly`, así que ni el JavaScript de la página la puede
   leer— y va atada al CLIENTE, no al viaje: quien tiene dos
   viajes con Eurotravel verifica una vez y ve los dos.

   DONDE VIVE EL CODIGO MIENTRAS TANTO

   Un código de un solo uso, con vencimiento y con intentos
   contados, es ESTADO. En funciones serverless la memoria no
   sirve: cada llamada puede caer en otra máquina.

   Vive en la metadata del cliente de Stripe, que es el objeto al
   que pertenece y que ya existe. Se guarda el HASH, nunca el
   código: quien vea la metadata en el panel de Stripe no puede
   entrar con ella.

   El nombre empieza con guion bajo para que Vercel no lo publique
   como una dirección más del sitio.
   ============================================================ */

const crypto = require('crypto');

const VIDA_CODIGO_MS = 10 * 60 * 1000;      // el código vive diez minutos
const INTENTOS = 5;                          // y aguanta cinco errores
const HORAS_SESION = 8;                      // lo que dijo el dueño
const VIDA_SESION_MS = HORAS_SESION * 60 * 60 * 1000;
const COOKIE = 'ev';                         // eurotravel · viaje

/* Los campos donde vive el código, en la ficha del cliente de Stripe. */
const CAMPO_HASH = 'acceso_hash';
const CAMPO_VENCE = 'acceso_vence';
const CAMPO_INTENTOS = 'acceso_intentos';

function secreto() { return (process.env.LIGAS_SECRETO || '').trim(); }
function hayClave() { return secreto().length > 0; }

/* ------------------------------------------------------------
   EL CODIGO
   ------------------------------------------------------------
   Seis dígitos, sacados con el generador criptográfico y no con
   `Math.random()`: ése es predecible y aquí lo que se adivina es
   la entrada al viaje de alguien.

   `randomInt` reparte parejo. Un `% 1000000` sobre bytes crudos
   no lo haría, y los primeros códigos serían más probables.
   ------------------------------------------------------------ */
function nuevoCodigo() {
  return String(crypto.randomInt(0, 1000000)).padStart(6, '0');
}

/* Se guarda el resumen, nunca el código. Va con el secreto adentro para que
   ni con la metadata en la mano se pueda armar una tabla de resúmenes de los
   solo un millón de códigos posibles. */
function resumen(codigo) {
  return crypto.createHmac('sha256', secreto())
    .update(String(codigo || ''), 'utf8').digest('hex');
}

function igualesEnTiempoConstante(a, b) {
  const A = Buffer.from(String(a), 'utf8');
  const B = Buffer.from(String(b), 'utf8');
  if (A.length !== B.length) return false;
  return crypto.timingSafeEqual(A, B);
}

/* Lo que hay que escribir en la ficha del cliente para dejar armado el
   código. Se devuelve en vez de escribirse aquí para poder probarlo sin red. */
function paraGuardar(codigo, ahoraMs) {
  const ahora = typeof ahoraMs === 'number' ? ahoraMs : Date.now();
  const m = {};
  m[CAMPO_HASH] = resumen(codigo);
  m[CAMPO_VENCE] = String(ahora + VIDA_CODIGO_MS);
  m[CAMPO_INTENTOS] = '0';
  return m;
}

/* Y lo que hay que escribir para borrarlo. Stripe borra un campo de metadata
   cuando se le manda vacío: ahí está el «un solo uso». */
function paraBorrar() {
  const m = {};
  m[CAMPO_HASH] = '';
  m[CAMPO_VENCE] = '';
  m[CAMPO_INTENTOS] = '';
  return m;
}

/* ------------------------------------------------------------
   ¿ES EL CODIGO BUENO?
   ------------------------------------------------------------
   Devuelve `{ ok }` o `{ ok:false, motivo, gastado }`.

   `gastado` dice si hay que subirle el contador de intentos. Solo
   se sube cuando el código EXISTE y no cuadra: si ya venció o
   nunca se pidió, subir el contador dejaría a alguien fuera por
   algo que ni siquiera intentó.

   EL LIMITE HONESTO: dos verificaciones al mismo tiempo podrían
   pasar las dos, porque esto no es una transacción. Con seis
   dígitos y diez minutos de vida el riesgo es despreciable, y el
   contador es de mejor esfuerzo. Queda dicho para que nadie lo
   descubra como sorpresa.
   ------------------------------------------------------------ */
function revisaCodigo(metadataDelCliente, codigo, ahoraMs) {
  if (!hayClave()) return { ok: false, motivo: 'sin LIGAS_SECRETO configurado' };
  const m = metadataDelCliente || {};
  const guardado = String(m[CAMPO_HASH] || '');
  if (!guardado) return { ok: false, motivo: 'no hay código pedido' };

  const vence = Number(m[CAMPO_VENCE]);
  const ahora = typeof ahoraMs === 'number' ? ahoraMs : Date.now();
  if (!isFinite(vence) || ahora > vence) return { ok: false, motivo: 'código vencido' };

  const van = Number(m[CAMPO_INTENTOS]) || 0;
  if (van >= INTENTOS) return { ok: false, motivo: 'demasiados intentos', agotado: true };

  /* Se acepta lo que la gente pega de verdad: «Tu código: 12 34 56». */
  const limpio = String(codigo || '').replace(/\D/g, '');
  if (limpio.length < 6) return { ok: false, motivo: 'código incompleto', gastado: true, van: van + 1 };

  if (!igualesEnTiempoConstante(resumen(limpio), guardado)) {
    return { ok: false, motivo: 'código incorrecto', gastado: true, van: van + 1 };
  }
  return { ok: true };
}

/* ------------------------------------------------------------
   LA SESION DE OCHO HORAS
   ------------------------------------------------------------
   Va firmada, como la liga, y no guarda nada de su lado. Se ata
   al CLIENTE: verificar una vez sirve para todos sus viajes.
   ------------------------------------------------------------ */
function aB64(b) {
  return Buffer.from(b).toString('base64')
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function deB64(t) {
  return Buffer.from(String(t || '').replace(/-/g, '+').replace(/_/g, '/'), 'base64');
}
function sello(carga) {
  return aB64(crypto.createHmac('sha256', secreto()).update(carga, 'utf8').digest());
}

function firmaSesion(idCliente, ahoraMs) {
  if (!hayClave() || !idCliente) return '';
  const ahora = typeof ahoraMs === 'number' ? ahoraMs : Date.now();
  const carga = aB64(JSON.stringify({ c: String(idCliente), e: ahora + VIDA_SESION_MS }));
  return carga + '.' + sello(carga);
}

/* ¿Esta sesión sigue viva, y es de este cliente? */
function sesionValida(token, idCliente, ahoraMs) {
  if (!hayClave()) return false;
  const t = String(token || '');
  const punto = t.indexOf('.');
  if (punto < 1 || punto === t.length - 1) return false;
  const carga = t.slice(0, punto);
  if (!igualesEnTiempoConstante(t.slice(punto + 1), sello(carga))) return false;

  let d;
  try { d = JSON.parse(deB64(carga).toString('utf8')); } catch (e) { return false; }
  if (!d || typeof d.c !== 'string' || typeof d.e !== 'number') return false;

  const ahora = typeof ahoraMs === 'number' ? ahoraMs : Date.now();
  if (ahora > d.e) return false;

  /* Que la sesión sea de OTRO cliente no es un detalle: es justo lo que
     impide que quien ya verificó lo suyo entre a lo ajeno cambiando la liga. */
  return igualesEnTiempoConstante(d.c, String(idCliente || ''));
}

/* ------------------------------------------------------------
   LA COOKIE
   ------------------------------------------------------------
   `HttpOnly` para que el JavaScript de la página no la pueda
   leer —ni el nuestro ni uno que se colara—. `Secure` para que
   solo viaje por HTTPS. `SameSite=Lax` para que no se mande
   desde un sitio ajeno.
   ------------------------------------------------------------ */
function cookieDeSesion(token, ahoraMs) {
  const segundos = Math.floor(VIDA_SESION_MS / 1000);
  return COOKIE + '=' + token +
    '; Path=/; Max-Age=' + segundos + '; HttpOnly; Secure; SameSite=Lax';
}
function cookieBorrada() {
  return COOKIE + '=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax';
}

/* ------------------------------------------------------------
   LEER LA COOKIE, SIN ADIVINAR
   ------------------------------------------------------------
   No se usa una expresión sobre toda la cadena: una cookie que se
   llame `xev` no puede hacerse pasar por `ev`.

   Y SI VIENE MAS DE UNA CON EL MISMO NOMBRE, NO SE ELIGE: se
   devuelve vacío.

   Antes se quedaba con la última, que es una decisión arbitraria
   y se comprobó atacándola: metiendo una segunda cookie `ev`
   después de la buena, la buena se anulaba. Nadie entra a nada
   ajeno con eso —tendría que firmarla— pero deja fuera al cliente
   legítimo, o lo mete a una sesión que no es la suya.

   Un navegador normal manda UNA. Dos es una anomalía, y ante una
   anomalía en un candado la respuesta es no abrir.
   ------------------------------------------------------------ */
/* ------------------------------------------------------------
   DE QUIEN ES ESTA SESION
   ------------------------------------------------------------
   `sesionValida` compara contra un cliente que quien llama YA
   sabe: en la liga, el que sale del viaje. Una cuenta no tiene ese
   dato de antemano — la cookie ES la identidad.

   EL ORDEN AQUI NO ES NEGOCIABLE: primero se comprueba el sello y
   la vigencia, y SOLO despues se lee el cliente de adentro. Leerlo
   antes seria creerle a un dato que escribe quien manda la cookie,
   y entonces cualquiera entraria a cualquier cuenta cambiando un
   texto en el navegador.

   Devuelve el identificador, o cadena vacia. Nunca revienta.
   ------------------------------------------------------------ */
function clienteDeSesion(token, ahoraMs) {
  if (!hayClave()) return '';
  const t = String(token || '');
  const punto = t.indexOf('.');
  if (punto < 1 || punto === t.length - 1) return '';

  const carga = t.slice(0, punto);
  /* el sello, antes que nada */
  if (!igualesEnTiempoConstante(t.slice(punto + 1), sello(carga))) return '';

  let d;
  try { d = JSON.parse(deB64(carga).toString('utf8')); } catch (e) { return ''; }
  if (!d || typeof d.c !== 'string' || typeof d.e !== 'number') return '';

  const ahora = typeof ahoraMs === 'number' ? ahoraMs : Date.now();
  if (ahora > d.e) return '';
  return d.c;
}

function sesionDe(req) {
  const crudo = String(((req && req.headers) || {}).cookie || '');
  const encontradas = [];
  crudo.split(';').forEach(function (trozo) {
    const i = trozo.indexOf('=');
    if (i < 0) return;
    if (trozo.slice(0, i).trim() === COOKIE) encontradas.push(trozo.slice(i + 1).trim());
  });
  if (encontradas.length !== 1) return '';
  return encontradas[0];
}

/* ------------------------------------------------------------
   LA PISTA DEL CORREO
   ------------------------------------------------------------
   «a***@ejemplo.mx». Se enseña para que sepa a dónde buscar el
   código, sin publicar el correo completo de nadie a quien nada
   más le llegó la liga.
   ------------------------------------------------------------ */
function pistaDeCorreo(correo) {
  const c = String(correo || '').trim();
  const i = c.indexOf('@');
  if (i < 1) return '';
  const antes = c.slice(0, i);
  const dominio = c.slice(i);
  return antes[0] + '***' + dominio;
}

module.exports = {
  VIDA_CODIGO_MS, INTENTOS, HORAS_SESION, VIDA_SESION_MS, COOKIE,
  CAMPO_HASH, CAMPO_VENCE, CAMPO_INTENTOS,
  hayClave, nuevoCodigo, paraGuardar, paraBorrar, revisaCodigo,
  firmaSesion, sesionValida, clienteDeSesion, cookieDeSesion, cookieBorrada, sesionDe,
  pistaDeCorreo
};
