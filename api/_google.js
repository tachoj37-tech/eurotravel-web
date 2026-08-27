/* ============================================================
   «Continuar con Google» — comprobar que el token es de verdad
   ------------------------------------------------------------
   El dueño lo pidió el 26-ago-2026, junto con las cuentas.

   COMO FUNCIONA, EN CORTO

   El botón de Google vive en la página. Cuando el cliente escoge
   su cuenta, Google le entrega al NAVEGADOR un papel firmado —un
   JWT— que dice «esta persona es fulano@gmail.com, y su correo
   está verificado». La página nos manda ese papel y aquí se
   comprueba la firma.

   TODO ESTO SE HACE CON EL `crypto` DE NODE. Cero dependencias,
   como el resto del proyecto: se piden las llaves públicas de
   Google y se verifica la firma a mano.

   ------------------------------------------------------------
   LAS CUATRO COMPROBACIONES, Y QUE PASA SI FALTA CADA UNA
   ------------------------------------------------------------
   Un papel firmado que no se revisa entero no sirve de nada. Cada
   una de éstas tapa un agujero distinto, y todas son necesarias:

   1. LA FIRMA, contra las llaves públicas de Google.
      Sin esto, cualquiera escribe un papel que diga lo que quiera
      y entra como quien se le antoje. Es la comprobación entera.

   2. EL ALGORITMO tiene que ser RS256.
      El ataque clásico contra JWT es mandar `"alg":"none"` —«este
      papel no lleva firma, créemelo»— y que el servidor obedezca.
      Aquí se compara contra RS256 y punto: lo que no sea eso, no
      pasa, aunque la firma venga.

   3. EL DESTINATARIO (`aud`) tiene que ser NUESTRO id de cliente.
      Éste es el que más fácil se olvida y el más caro. Google
      firma papeles idénticos para MILLONES de aplicaciones. Sin
      comprobar el destinatario, un token bueno emitido para
      cualquier otra app —una que el atacante haya hecho él
      mismo— pasaría nuestra revisión de firma y entraría como su
      dueño... a la cuenta de Eurotravel de esa persona.

   4. `email_verified` tiene que ser cierto.
      Google también da cuentas de Workspace, donde el dueño del
      dominio pone los correos que quiera. Si no se exige que el
      correo esté verificado, alguien con su propio dominio se
      hace un correo que apunte a donde no debe. Como aquí el
      correo ES la identidad —de él cuelga la cuenta de Stripe—,
      esto no es un detalle.

   Y la de fecha: un papel vencido no vale. Se deja cinco minutos
   de holgura porque los relojes no van iguales, no por cortesía.

   ------------------------------------------------------------
   POR QUE NO SE USA `nonce`
   ------------------------------------------------------------
   Google permite mandar un `nonce` de un solo uso para que un
   papel robado no se pueda volver a usar. No se usa aquí porque
   robarlo exige ya estar dentro del navegador del cliente —y
   quien está ahí se lleva la cookie de sesión, que dura ocho
   horas y sirve para lo mismo—. Queda dicho para que se sepa que
   fue decisión y no olvido.

   El guion bajo del nombre evita que Vercel lo publique como una
   dirección más del sitio.
   ============================================================ */

const crypto = require('crypto');

const LLAVES_DE_GOOGLE = 'https://www.googleapis.com/oauth2/v3/certs';

/* Google firma con los dos, según de dónde venga. Los dos son suyos. */
const EMISORES = ['accounts.google.com', 'https://accounts.google.com'];

/* Los relojes de dos máquinas nunca van exactamente iguales. Cinco minutos
   es lo que recomienda la propia especificación de OAuth. */
const HOLGURA_MS = 5 * 60 * 1000;

/* Un JWT de Google ronda los mil caracteres. El tope es para que nadie nos
   mande un megabyte y nos ponga a analizarlo de gratis. */
const LARGO_MAXIMO = 4096;

/* Las llaves de Google cambian cada tanto, no cada minuto. Una hora de
   memoria evita una llamada a Google en cada entrada. */
const CACHE_MS = 60 * 60 * 1000;

let cache = { llaves: null, hasta: 0 };

/* ------------------------------------------------------------
   EL ID DE CLIENTE
   ------------------------------------------------------------
   No es secreto: va escrito en la página y cualquiera lo ve. Lo
   que hace es identificar a NUESTRA aplicación, y por eso la
   comprobación 3 de arriba se apoya en él.

   Se exige la forma completa. Un id a medias —copiado sin la cola,
   que pasa— dejaría a Google a medio configurar sin que nadie se
   entere: el botón saldría y no entraría nadie.
   ------------------------------------------------------------ */
function idDeCliente() {
  const id = String(process.env.GOOGLE_CLIENT_ID || '').trim();
  if (!id) return '';
  if (!/^[A-Za-z0-9-]+\.apps\.googleusercontent\.com$/.test(id)) {
    /* Regla 9: esto lo lee un programador en el registro, nunca un cliente. */
    console.error('[google] GOOGLE_CLIENT_ID con mala forma; el botón queda apagado');
    return '';
  }
  return id;
}

/* Si esto es falso, la página ni siquiera enseña el botón. Vale más no
   ofrecerlo que ofrecerlo roto. */
function hayGoogle() { return !!idDeCliente(); }

/* ------------------------------------------------------------
   LAS LLAVES PUBLICAS DE GOOGLE
   ------------------------------------------------------------
   Si Google no contesta y hay llaves guardadas, se usan las
   guardadas: una caída de un minuto de su lado no tiene por qué
   dejar sin entrar a nadie. Y si no hay ni eso, se falla CERRADO
   —sin llaves no se puede comprobar una firma, y no comprobarla
   sería dejar pasar a todos—.
   ------------------------------------------------------------ */
async function llavesDeGoogle(ahoraMs) {
  const ahora = typeof ahoraMs === 'number' ? ahoraMs : Date.now();
  if (cache.llaves && ahora < cache.hasta) return cache.llaves;

  try {
    const r = await fetch(LLAVES_DE_GOOGLE);
    if (!r.ok) throw new Error('Google contestó ' + r.status);
    const d = await r.json();
    const llaves = (d && Array.isArray(d.keys)) ? d.keys : null;
    if (!llaves || !llaves.length) throw new Error('Google no mandó llaves');
    cache = { llaves: llaves, hasta: ahora + CACHE_MS };
    return llaves;
  } catch (e) {
    console.error('[google] no se pudieron traer las llaves: ' + (e && e.message));
    return cache.llaves || null;
  }
}

/* Solo para las pruebas: vaciar lo guardado entre casos. */
function olvidaLlaves() { cache = { llaves: null, hasta: 0 }; }

/* ------------------------------------------------------------
   PARTIR Y LEER EL PAPEL
   ------------------------------------------------------------ */
function deBase64Url(texto) {
  return Buffer.from(String(texto).replace(/-/g, '+').replace(/_/g, '/'), 'base64');
}

function leeJSON(parte) {
  try { return JSON.parse(deBase64Url(parte).toString('utf8')); } catch (e) { return null; }
}

/* ------------------------------------------------------------
   TEXTO, Y SOLO TEXTO
   ------------------------------------------------------------
   Esto salió de una prueba en rojo, y vale la pena contarlo porque
   es un tropiezo fácil. La comprobación del destinatario estaba
   escrita así:

       String(cuerpo.aud) !== nuestroId

   Y `String(['1234-abc.apps.googleusercontent.com'])` devuelve
   exactamente esa cadena: una LISTA con nuestro id dentro pasaba
   la comprobación como si fuera nuestro id. El contenido del papel
   sale de `JSON.parse`, así que quien lo escribe elige el tipo:
   texto, número, lista u objeto.

   Convertir a texto dentro de una comprobación de seguridad es
   dejar que el otro escoja las reglas. Se exige texto de verdad, y
   lo que no lo sea vale cadena vacía —que no coincide con nada—.
   ------------------------------------------------------------ */
function soloTexto(v) { return typeof v === 'string' ? v : ''; }

/* `reintentar` distingue «el papel no sirve» de «no pudimos comprobarlo».
   Al cliente hay que decirle cosas distintas: en el primer caso que use su
   contraseña, en el segundo que lo intente en un momento. */
function no(motivo, reintentar) {
  return { ok: false, motivo: motivo, reintentar: !!reintentar };
}

/* ------------------------------------------------------------
   LA COMPROBACION
   ------------------------------------------------------------
   Devuelve `{ok:true, correo, sub, nombre}` o `{ok:false, motivo}`.
   El motivo es para el registro del servidor: al cliente NUNCA se
   le dice cuál de las comprobaciones falló.
   ------------------------------------------------------------ */
async function verifica(credencial, ahoraMs) {
  const ahora = typeof ahoraMs === 'number' ? ahoraMs : Date.now();

  const nuestroId = idDeCliente();
  if (!nuestroId) return no('sin configurar');

  const t = String(credencial == null ? '' : credencial).trim();
  if (!t || t.length > LARGO_MAXIMO) return no('mal formado');

  const trozos = t.split('.');
  if (trozos.length !== 3) return no('mal formado');

  const cabeza = leeJSON(trozos[0]);
  const cuerpo = leeJSON(trozos[1]);
  if (!cabeza || !cuerpo) return no('mal formado');

  /* 2 · el algoritmo. Antes de nada, porque `alg:none` es el ataque de
     manual y el que se cuela en cuanto uno se confía. */
  if (cabeza.alg !== 'RS256') return no('algoritmo ' + String(cabeza.alg));

  const llaves = await llavesDeGoogle(ahora);
  if (!llaves) return no('sin llaves de Google', true);

  const kid = soloTexto(cabeza.kid);
  let jwk = null;
  for (let i = 0; i < llaves.length; i++) {
    if (String(llaves[i].kid) === kid) { jwk = llaves[i]; break; }
  }
  if (!jwk) return no('llave desconocida');

  /* 1 · la firma */
  let publica;
  try { publica = crypto.createPublicKey({ key: jwk, format: 'jwk' }); }
  catch (e) { return no('llave ilegible'); }

  let buena = false;
  try {
    buena = crypto.verify(
      'sha256',
      Buffer.from(trozos[0] + '.' + trozos[1], 'utf8'),
      { key: publica, padding: crypto.constants.RSA_PKCS1_PADDING },
      deBase64Url(trozos[2])
    );
  } catch (e) { return no('firma ilegible'); }
  if (!buena) return no('firma que no cuadra');

  /* Quién lo firmó */
  if (EMISORES.indexOf(soloTexto(cuerpo.iss)) < 0) return no('emisor ajeno');

  /* 3 · para quién es. El que más caro sale olvidar. */
  if (soloTexto(cuerpo.aud) !== nuestroId) return no('destinatario ajeno');

  /* La fecha */
  const vence = Number(cuerpo.exp) * 1000;
  if (!isFinite(vence) || vence <= 0) return no('sin vencimiento');
  if (ahora > vence + HOLGURA_MS) return no('vencido');
  const emitido = Number(cuerpo.iat) * 1000;
  if (isFinite(emitido) && emitido > 0 && emitido - HOLGURA_MS > ahora) return no('del futuro');

  /* 4 · el correo, y que Google lo haya verificado */
  const verificado = cuerpo.email_verified;
  if (verificado !== true && verificado !== 'true') return no('correo sin verificar');

  /* El correo ES la identidad: de él cuelga la cuenta de Stripe. Va con la
     misma exigencia de texto que el destinatario, por lo mismo. */
  const correo = soloTexto(cuerpo.email).trim().toLowerCase();
  if (!correo || correo.indexOf('@') < 1) return no('sin correo');

  const sub = soloTexto(cuerpo.sub).trim();
  if (!sub) return no('sin identificador');

  return {
    ok: true,
    correo: correo,
    sub: sub,
    nombre: soloTexto(cuerpo.name).trim().slice(0, 120)
  };
}

module.exports = {
  idDeCliente, hayGoogle, verifica,
  llavesDeGoogle, olvidaLlaves,
  EMISORES, HOLGURA_MS, LARGO_MAXIMO
};
