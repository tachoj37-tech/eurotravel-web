/* ============================================================
   Continuar con Google
   ------------------------------------------------------------
       node pruebas/probar-google.cjs

   Aquí no se prueba «que funcione». Se prueba QUE NO SE PUEDA
   ENTRAR SIN SER, que es lo que de verdad cuesta dinero.

   La forma de probarlo: hacerse pasar por Google. La prueba se
   fabrica su propio par de llaves RSA, publica la pública donde
   el código va a buscar las de Google, y desde ahí firma papeles
   —buenos y torcidos— para ver cuáles pasan.

   LOS CUATRO ATAQUES QUE TIENEN QUE FALLAR:

     1. «alg:none» — un papel que dice que no lleva firma
     2. destinatario ajeno — un papel bueno de Google, pero
        emitido para OTRA aplicación
     3. correo sin verificar
     4. firma o contenido cambiados

   El 2 es el que más fácil se olvida: el papel es auténtico, la
   firma cuadra, y sin embargo dejar pasarlo es regalar todas las
   cuentas.
   ============================================================ */
'use strict';

const crypto = require('crypto');

const NUESTRO_ID = '1234567890-abcdefg.apps.googleusercontent.com';
const OTRA_APP = '9999999999-zzzzzzz.apps.googleusercontent.com';

process.env.GOOGLE_CLIENT_ID = NUESTRO_ID;
process.env.LIGAS_SECRETO = 'secreto-de-prueba-para-cuentas-1234567890';
process.env.STRIPE_SECRET_KEY = 'sk_test_x';
process.env.RESEND_API_KEY = 're_x';

let buenas = 0, malas = 0;
function igual(nombre, dio, esperado) {
  const a = JSON.stringify(dio), b = JSON.stringify(esperado);
  if (a === b) { buenas++; console.log('ok   ' + nombre); }
  else { malas++; console.log('MAL  ' + nombre + '\n     dio      ' + a + '\n     esperaba ' + b); }
}
function cierto(nombre, v) { igual(nombre, !!v, true); }
function falso(nombre, v) { igual(nombre, !!v, false); }

/* ============================================================
   NUESTRO GOOGLE DE MENTIRAS
   ============================================================ */
const KID = 'llave-de-prueba-1';
const par = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
const JWK = Object.assign(par.publicKey.export({ format: 'jwk' }),
  { kid: KID, alg: 'RS256', use: 'sig' });

function b64u(buf) {
  return Buffer.from(buf).toString('base64')
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

const AHORA = 1756000000000;      // un instante fijo: nada de relojes vivos

/* Arma un papel firmado. `opc.alg` y `opc.kid` sirven para torcerlo. */
function papel(cambios, opc) {
  const o = opc || {};
  const cabeza = { alg: o.alg || 'RS256', kid: o.kid === undefined ? KID : o.kid, typ: 'JWT' };
  const cuerpo = Object.assign({
    iss: 'https://accounts.google.com',
    aud: NUESTRO_ID,
    sub: '110000000000000000001',
    email: 'ana@gmail.com',
    email_verified: true,
    name: 'Ana Ruiz',
    iat: Math.floor(AHORA / 1000) - 60,
    exp: Math.floor(AHORA / 1000) + 3600
  }, cambios || {});

  const a = b64u(JSON.stringify(cabeza));
  const b = b64u(JSON.stringify(cuerpo));

  if (o.sinFirma) return a + '.' + b + '.';
  if (o.firmaHMAC) {
    /* El ataque de confusión de algoritmo: firmar con HMAC usando la llave
       PUBLICA como secreto, esperando que el servidor no mire el `alg`. */
    const h = crypto.createHmac('sha256', par.publicKey.export({ type: 'spki', format: 'pem' }));
    return a + '.' + b + '.' + b64u(h.update(a + '.' + b).digest());
  }
  const firma = crypto.sign('sha256', Buffer.from(a + '.' + b, 'utf8'),
    { key: par.privateKey, padding: crypto.constants.RSA_PKCS1_PADDING });
  return a + '.' + b + '.' + b64u(firma);
}

/* ============================================================
   STRIPE Y RESEND DE MENTIRAS
   ============================================================ */
let FICHAS = [], CORREOS = [], siguienteId = 1;
let GOOGLE_CONTESTA = true, VECES_QUE_PIDIERON_LLAVES = 0;

global.fetch = function (url, opc) {
  const u = String(url);

  if (u.indexOf('googleapis.com/oauth2/v3/certs') >= 0) {
    VECES_QUE_PIDIERON_LLAVES++;
    if (!GOOGLE_CONTESTA) return Promise.reject(new Error('Google no contesta'));
    return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({ keys: [JWK] }) });
  }
  if (u.indexOf('/customers?email=') >= 0) {
    const q = decodeURIComponent(u.split('email=')[1].split('&')[0]);
    return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({
      data: FICHAS.filter(function (f) { return f.email === q; }) }) });
  }
  if (/\/customers\/cus_/.test(u)) {
    const id = u.split('/customers/')[1];
    const f = FICHAS.find(function (x) { return x.id === id; });
    if (!f) return Promise.resolve({ ok: false, status: 404, json: () => Promise.resolve({ error: {} }) });
    if (!opc || opc.method !== 'POST') {
      return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(f) });
    }
    String(opc.body || '').split('&').forEach(function (par2) {
      const i = par2.indexOf('=');
      const k = decodeURIComponent(par2.slice(0, i));
      const v = decodeURIComponent(par2.slice(i + 1).replace(/\+/g, ' '));
      const m = /^metadata\[(.+)\]$/.exec(k);
      if (m) { if (v === '') delete f.metadata[m[1]]; else f.metadata[m[1]] = v; }
    });
    return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(f) });
  }
  if (u.indexOf('/customers') >= 0) {
    const f = { id: 'cus_' + String(siguienteId++).padStart(14, '0'), metadata: {} };
    String(opc.body || '').split('&').forEach(function (par2) {
      const i = par2.indexOf('=');
      const k = decodeURIComponent(par2.slice(0, i));
      const v = decodeURIComponent(par2.slice(i + 1).replace(/\+/g, ' '));
      const m = /^metadata\[(.+)\]$/.exec(k);
      if (m) { if (v !== '') f.metadata[m[1]] = v; }
      else if (k === 'email') f.email = v; else if (k === 'name') f.name = v;
    });
    FICHAS.push(f);
    return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(f) });
  }
  if (u.indexOf('resend') >= 0) {
    CORREOS.push(JSON.parse(opc.body));
    return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({ id: 'em' }) });
  }
  return Promise.reject(new Error('inesperado: ' + u));
};

const google = require('../api/_google.js');
const logica = require('../api/_cuentas-logica.js');
const cuentas = require('../api/_cuentas.js');

(async function () {

  /* ============ 1. UN PAPEL BUENO ENTRA ============
     Primero lo que sí, para saber que el resto falla por lo que se cree y
     no porque nada funcione. */
  {
    google.olvidaLlaves();
    const v = await google.verifica(papel(), AHORA);
    cierto('un papel bueno de Google pasa', v.ok);
    igual('y trae su correo', v.correo, 'ana@gmail.com');
    igual('su identificador', v.sub, '110000000000000000001');
    igual('y su nombre', v.nombre, 'Ana Ruiz');
  }

  /* ============ 2. «alg:none» ============
     El ataque de manual: un papel que dice «no llevo firma, créeme». */
  {
    const sinFirma = await google.verifica(papel({}, { alg: 'none', sinFirma: true }), AHORA);
    falso('un papel que dice alg:none NO pasa', sinFirma.ok);
    igual('y se sabe por qué', sinFirma.motivo, 'algoritmo none');

    /* la variante: alg:none pero CON firma buena pegada, por si alguien
       revisara la firma y no el algoritmo */
    const conFirmaBuena = papel().split('.');
    const cabezaNone = b64u(JSON.stringify({ alg: 'none', kid: KID, typ: 'JWT' }));
    falso('ni con una firma buena pegada al lado',
      (await google.verifica(cabezaNone + '.' + conFirmaBuena[1] + '.' + conFirmaBuena[2], AHORA)).ok);
  }

  /* ============ 3. CONFUSION DE ALGORITMO ============
     Firmar con HMAC usando la llave PUBLICA de Google como secreto. Si el
     código no mira el `alg`, esto entra: la llave pública la tiene
     cualquiera. */
  {
    const r = await google.verifica(papel({}, { alg: 'HS256', firmaHMAC: true }), AHORA);
    falso('un papel firmado con HMAC y la llave pública NO pasa', r.ok);
    igual('se corta en el algoritmo', r.motivo, 'algoritmo HS256');
  }

  /* ============ 4. EL DESTINATARIO — EL QUE MAS CARO SALE ============
     Un papel AUTENTICO de Google, con firma buena, emitido para otra
     aplicación. Google firma millones de éstos al día. Si no se revisa el
     destinatario, quien tenga cualquier app de Google entra a la cuenta de
     Eurotravel de sus propios usuarios. */
  {
    const ajeno = await google.verifica(papel({ aud: OTRA_APP }), AHORA);
    falso('un papel bueno pero de OTRA app NO pasa', ajeno.ok);
    igual('y se corta justo ahí', ajeno.motivo, 'destinatario ajeno');

    falso('sin destinatario tampoco', (await google.verifica(papel({ aud: undefined }), AHORA)).ok);

    /* ------------------------------------------------------------
       ESTA ES LA QUE ENCONTRO EL HUECO
       ------------------------------------------------------------
       La comprobación decía `String(cuerpo.aud) !== nuestroId`, y
       `String(['...'])` devuelve la cadena de adentro: una LISTA con
       nuestro id pasaba como si fuera nuestro id. El contenido del papel
       sale de `JSON.parse`, así que quien lo escribe elige el tipo.
       Se cerró exigiendo texto de verdad, no lo que se le parezca.
       ------------------------------------------------------------ */
    falso('ni con el destinatario metido en una lista',
      (await google.verifica(papel({ aud: [NUESTRO_ID] }), AHORA)).ok);
    falso('ni el emisor en una lista',
      (await google.verifica(papel({ iss: ['https://accounts.google.com'] }), AHORA)).ok);
    falso('ni el correo en una lista',
      (await google.verifica(papel({ email: ['ana@gmail.com'] }), AHORA)).ok);
    falso('ni el destinatario como número',
      (await google.verifica(papel({ aud: 1234567890 }), AHORA)).ok);
  }

  /* ============ 5. EL CORREO SIN VERIFICAR ============
     Google también da cuentas de Workspace, donde el dueño del dominio pone
     los correos que quiera. Sin esta comprobación, quien tenga un dominio se
     fabrica el correo que se le antoje. */
  {
    falso('correo sin verificar NO pasa',
      (await google.verifica(papel({ email_verified: false }), AHORA)).ok);
    falso('ni sin el campo',
      (await google.verifica(papel({ email_verified: undefined }), AHORA)).ok);
    igual('y se corta justo ahí',
      (await google.verifica(papel({ email_verified: false }), AHORA)).motivo,
      'correo sin verificar');
    /* Google lo manda a veces como texto, y así también vale */
    cierto('«true» en texto sí pasa, que así lo manda Google a veces',
      (await google.verifica(papel({ email_verified: 'true' }), AHORA)).ok);
    falso('pero «false» en texto no',
      (await google.verifica(papel({ email_verified: 'false' }), AHORA)).ok);
  }

  /* ============ 6. TOCAR EL PAPEL LO ROMPE ============ */
  {
    const bueno = papel();
    const trozos = bueno.split('.');

    /* cambiarle el correo sin volver a firmar */
    const otroCorreo = b64u(JSON.stringify({
      iss: 'https://accounts.google.com', aud: NUESTRO_ID, sub: '1', email: 'dueno@eurotravel.com.mx',
      email_verified: true, iat: Math.floor(AHORA / 1000), exp: Math.floor(AHORA / 1000) + 3600
    }));
    const r = await google.verifica(trozos[0] + '.' + otroCorreo + '.' + trozos[2], AHORA);
    falso('cambiarle el correo al papel lo invalida', r.ok);
    igual('por la firma', r.motivo, 'firma que no cuadra');

    /* un bit de la firma */
    const rota = trozos[2].slice(0, -2) + (trozos[2].slice(-2) === 'AA' ? 'BB' : 'AA');
    falso('una firma alterada no pasa',
      (await google.verifica(trozos[0] + '.' + trozos[1] + '.' + rota, AHORA)).ok);

    /* firmado con OTRA llave que no es la de Google */
    const impostor = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
    const a = trozos[0], b = trozos[1];
    const suya = b64u(crypto.sign('sha256', Buffer.from(a + '.' + b, 'utf8'),
      { key: impostor.privateKey, padding: crypto.constants.RSA_PKCS1_PADDING }));
    falso('firmado con una llave que no es de Google, no pasa',
      (await google.verifica(a + '.' + b + '.' + suya, AHORA)).ok);

    /* con un kid que no existe */
    falso('con una llave desconocida no pasa',
      (await google.verifica(papel({}, { kid: 'no-existe' }), AHORA)).ok);
  }

  /* ============ 7. FECHAS ============ */
  {
    const vencido = papel({ exp: Math.floor(AHORA / 1000) - 3600 });
    falso('un papel de hace una hora no vale', (await google.verifica(vencido, AHORA)).ok);
    igual('y se dice', (await google.verifica(vencido, AHORA)).motivo, 'vencido');

    /* la holgura de reloj: recién vencido SI vale, cinco minutos y un
       segundo NO. Los relojes no van iguales; eso no es cortesía, es que si
       no, falla gente de verdad. */
    cierto('recién vencido todavía pasa, por la holgura de reloj',
      (await google.verifica(papel({ exp: Math.floor(AHORA / 1000) - 60 }), AHORA)).ok);
    falso('pero seis minutos después ya no',
      (await google.verifica(papel({ exp: Math.floor(AHORA / 1000) - 360 }), AHORA)).ok);

    falso('sin fecha de vencimiento no pasa',
      (await google.verifica(papel({ exp: undefined }), AHORA)).ok);
    falso('un papel del futuro tampoco',
      (await google.verifica(papel({ iat: Math.floor(AHORA / 1000) + 3600 }), AHORA)).ok);
  }

  /* ============ 8. QUIEN LO FIRMO ============ */
  {
    falso('un emisor ajeno no pasa',
      (await google.verifica(papel({ iss: 'https://accounts.malicioso.example' }), AHORA)).ok);
    cierto('los dos emisores buenos de Google sí',
      (await google.verifica(papel({ iss: 'accounts.google.com' }), AHORA)).ok);
    falso('sin identificador de persona no pasa',
      (await google.verifica(papel({ sub: '' }), AHORA)).ok);
    falso('sin correo no pasa',
      (await google.verifica(papel({ email: '' }), AHORA)).ok);
  }

  /* ============ 9. BASURA ============ */
  {
    const basura = ['', null, undefined, 'no.es.un.jwt.nada', 'a.b', 'aaaa', {}, 12345,
      'x'.repeat(5000)];
    const pasaron = [];
    for (let i = 0; i < basura.length; i++) {
      const r = await google.verifica(basura[i], AHORA);
      if (r.ok) pasaron.push(String(basura[i]).slice(0, 20));
    }
    igual('nada de la basura pasa', pasaron, []);
  }

  /* ============ 10. SIN CONFIGURAR, FALLA CERRADO ============
     Hoy mismo: el dueño todavía no da el id. El botón no sale y la puerta
     no abre — nunca al revés. */
  {
    const antes = process.env.GOOGLE_CLIENT_ID;

    delete process.env.GOOGLE_CLIENT_ID;
    falso('sin id de cliente, no hay Google', google.hayGoogle());
    igual('y ningún papel pasa, ni el bueno',
      (await google.verifica(papel(), AHORA)).motivo, 'sin configurar');

    process.env.GOOGLE_CLIENT_ID = 'esto-no-es-un-id';
    falso('con un id mal escrito tampoco', google.hayGoogle());
    igual('y falla cerrado', (await google.verifica(papel(), AHORA)).motivo, 'sin configurar');

    process.env.GOOGLE_CLIENT_ID = antes;
    cierto('con el id bueno vuelve', google.hayGoogle());
  }

  /* ============ 11. SI GOOGLE NO CONTESTA ============
     Sin llaves no se puede comprobar una firma. Se falla cerrado y se le
     dice al cliente que lo intente, no se le deja pasar. */
  {
    google.olvidaLlaves();
    GOOGLE_CONTESTA = false;
    const r = await google.verifica(papel(), AHORA);
    falso('sin las llaves de Google no pasa nadie', r.ok);
    cierto('y se marca como «vuelve a intentar», no como «no eres tú»', r.reintentar);

    /* con llaves ya guardadas, una caída de Google no deja a nadie fuera */
    GOOGLE_CONTESTA = true;
    google.olvidaLlaves();
    cierto('con Google en pie, entra', (await google.verifica(papel(), AHORA)).ok);
    GOOGLE_CONTESTA = false;
    cierto('y si Google se cae después, las llaves guardadas sirven',
      (await google.verifica(papel(), AHORA)).ok);
    GOOGLE_CONTESTA = true;

    /* y no se le pregunta a Google en cada entrada */
    google.olvidaLlaves();
    VECES_QUE_PIDIERON_LLAVES = 0;
    await google.verifica(papel(), AHORA);
    await google.verifica(papel(), AHORA);
    await google.verifica(papel(), AHORA);
    igual('las llaves se piden UNA vez, no en cada entrada', VECES_QUE_PIDIERON_LLAVES, 1);
  }

  /* ============================================================
     LA SEGUNDA MITAD: QUE PASA DESPUES DE COMPROBAR EL PAPEL
     ============================================================ */

  /* ============ 12. CUENTA NUEVA ============ */
  {
    FICHAS = []; CORREOS = []; google.olvidaLlaves();
    const r = await logica.conGoogle({ credencial: papel() }, AHORA);

    igual('con Google se entra', r.status, 200);
    igual('y se abre sesión', typeof r.sesionPara, 'string');
    igual('la pantalla recibe su nombre', r.cuerpo.nombre, 'Ana Ruiz');
    igual('se creó un cliente, uno solo', FICHAS.length, 1);
    igual('con su correo', FICHAS[0].email, 'ana@gmail.com');

    /* nace VERIFICADA: Google acaba de comprobar el buzón, pedirle el código
       de seis dígitos sería pedirle dos veces lo mismo */
    cierto('la cuenta nace verificada', cuentas.estaVerificada(FICHAS[0].metadata));
    igual('y ligada a su Google', cuentas.googleDe(FICHAS[0].metadata), '110000000000000000001');
    igual('sin contraseña, que no la puso', cuentas.tieneContrasena(FICHAS[0].metadata), false);

    /* LO QUE EL DUEÑO PIDIO EXPRESO */
    igual('ENTRAR CON GOOGLE NO MANDA NINGUN CORREO', CORREOS.length, 0);

    igual('nunca sale el identificador de Stripe',
      JSON.stringify(r.cuerpo).indexOf('cus_'), -1);
  }

  /* ============ 13. LA SEGUNDA VEZ NO DUPLICA ============ */
  {
    const r = await logica.conGoogle({ credencial: papel() }, AHORA);
    igual('la segunda vez también entra', r.status, 200);
    igual('y NO se creó otro cliente', FICHAS.length, 1);
    igual('sigue sin mandar correos', CORREOS.length, 0);
  }

  /* ============ 14. UN CORREO QUE YA TIENE CUENTA CON CONTRASEÑA ============
     Se LIGA, no se duplica. Duplicar le partiría el historial de viajes en
     dos sin que se entere. */
  {
    FICHAS = []; CORREOS = [];
    await logica.crear({
      correo: 'ana@gmail.com', contrasena: 'una contraseña decente',
      nombre: 'Ana Ruiz', telefono: '3312345678'
    }, AHORA);
    const codigo = /\b(\d{6})\b/.exec(CORREOS[CORREOS.length - 1].text)[1];
    await logica.confirmar({ correo: 'ana@gmail.com', codigo: codigo }, AHORA);
    igual('había una cuenta con contraseña', FICHAS.length, 1);
    const suId = FICHAS[0].id;
    const cuantos = CORREOS.length;

    const r = await logica.conGoogle({ credencial: papel() }, AHORA);
    igual('entra con Google', r.status, 200);
    igual('SIN crear una segunda cuenta', FICHAS.length, 1);
    igual('y es la misma de siempre', r.sesionPara, suId);
    igual('sin mandarle ningún correo', CORREOS.length, cuantos);

    cierto('le queda ligado su Google', !!cuentas.googleDe(FICHAS[0].metadata));
    cierto('y su contraseña SIGUE sirviendo', cuentas.tieneContrasena(FICHAS[0].metadata));
    igual('de hecho entra con ella',
      (await logica.entrar({ correo: 'ana@gmail.com', contrasena: 'una contraseña decente' })).status, 200);
  }

  /* ============ 15. UNA CUENTA A MEDIAS SE COMPLETA ============
     Se registró con contraseña y nunca tecleó el código. Google acaba de
     comprobar ese mismo buzón: eso vale como confirmación. */
  {
    FICHAS = []; CORREOS = [];
    await logica.crear({
      correo: 'ana@gmail.com', contrasena: 'una contraseña decente', nombre: 'Ana Ruiz'
    }, AHORA);
    falso('quedó sin verificar', cuentas.estaVerificada(FICHAS[0].metadata));
    igual('y sin verificar NO entra con su contraseña',
      (await logica.entrar({ correo: 'ana@gmail.com', contrasena: 'una contraseña decente' })).status, 403);

    const r = await logica.conGoogle({ credencial: papel() }, AHORA);
    igual('pero con Google sí', r.status, 200);
    cierto('y le deja la cuenta verificada', cuentas.estaVerificada(FICHAS[0].metadata));

    /* ------------------------------------------------------------
       ESTA ASERCION CAMBIO DE LADO, y era una toma de cuenta.

       Decía: «así que ya entra con su contraseña también», y comprobaba que
       después de entrar con Google la contraseña sin confirmar siguiera
       sirviendo. Suena a comodidad. Es un agujero:

         1. Cualquiera pide una cuenta con el correo AJENO y una contraseña
            suya. Nace sin verificar y no abre — al dueño hasta se le escribe
            «si no fuiste tú, no tienes que hacer nada».
         2. Meses después el dueño entra con SU Google. Se verifica.
         3. El extraño entra con SU contraseña, a la cuenta de otro.

       Comprobado con el ataque completo, no supuesto. Una contraseña que solo
       existe en una cuenta sin verificar no la puso nadie que haya demostrado
       ser dueño del buzón: cuando alguien lo demuestra por otra puerta, esa
       contraseña se tira.

       Al dueño de verdad no le cuesta nada: entra con Google, o la repone en
       dos minutos con «olvidé mi contraseña».
       ------------------------------------------------------------ */
    falso('la contraseña SIN CONFIRMAR se tira', cuentas.tieneContrasena(FICHAS[0].metadata));
    igual('y ya no sirve para entrar',
      (await logica.entrar({ correo: 'ana@gmail.com', contrasena: 'una contraseña decente' })).status, 401);
    igual('pero con Google entra cuando quiera',
      (await logica.conGoogle({ credencial: papel() }, AHORA)).status, 200);
  }

  /* ============ 15-bis. NO SE PLANTA UNA CONTRASEÑA EN CUENTA AJENA ============
     El ataque completo, tal como se hacía. Es el defecto más caro que encontró
     la revisión de seguridad del 27-ago-2026 después de la entrada libre. */
  {
    FICHAS = []; CORREOS = [];
    const DEL_EXTRAÑO = 'la que puso el que no es';

    /* 1 · el extraño pide cuenta con el correo de la víctima */
    await logica.crear({ correo: 'ana@gmail.com', contrasena: DEL_EXTRAÑO, nombre: 'Quien Sea' }, AHORA);
    igual('todavía no puede entrar',
      (await logica.entrar({ correo: 'ana@gmail.com', contrasena: DEL_EXTRAÑO })).status, 403);

    /* 2 · la víctima entra con SU Google, como cualquier día */
    igual('la víctima entra con su Google',
      (await logica.conGoogle({ credencial: papel() }, AHORA)).status, 200);

    /* 3 · el extraño lo intenta otra vez */
    const despues = await logica.entrar({ correo: 'ana@gmail.com', contrasena: DEL_EXTRAÑO });
    igual('y DESPUES tampoco', despues.status, 401);
    falso('sin abrirle sesión', despues.sesionPara);
  }

  /* ============ 16. QUIEN COMPRO DE INVITADO ============
     Tiene ficha en Stripe con su historial, pero sin cuenta. La cuenta se le
     monta encima: si se creara al lado, sus viejos viajes no aparecerían en
     «Mis viajes». */
  {
    FICHAS = [{ id: 'cus_00000000007777', email: 'ana@gmail.com', name: 'Ana R.', metadata: {} }];
    CORREOS = [];
    const r = await logica.conGoogle({ credencial: papel() }, AHORA);
    igual('entra', r.status, 200);
    igual('sobre la ficha que ya tenía', r.sesionPara, 'cus_00000000007777');
    igual('sin crear otra', FICHAS.length, 1);
    cierto('y ahora sí tiene cuenta', cuentas.tieneCuenta(FICHAS[0].metadata));
  }

  /* ============ 17. LO QUE NO PASA LA PUERTA, NO ENTRA ============
     La misma lista de arriba, pero por la puerta de verdad: que la lógica
     no se le olvide comprobar nada. */
  {
    FICHAS = []; CORREOS = [];
    const torcidos = [
      ['alg:none', papel({}, { alg: 'none', sinFirma: true })],
      ['de otra app', papel({ aud: OTRA_APP })],
      ['correo sin verificar', papel({ email_verified: false })],
      ['vencido', papel({ exp: Math.floor(AHORA / 1000) - 7200 })],
      ['emisor ajeno', papel({ iss: 'https://malicioso.example' })],
      ['basura', 'no-es-un-papel'],
      ['vacío', '']
    ];
    const entraron = [];
    for (let i = 0; i < torcidos.length; i++) {
      const r = await logica.conGoogle({ credencial: torcidos[i][1] }, AHORA);
      if (r.status === 200 || r.sesionPara) entraron.push(torcidos[i][0]);
    }
    igual('ninguno de los papeles torcidos entra', entraron, []);
    igual('y NINGUNO creó un cliente en Stripe', FICHAS.length, 0);

    /* el aviso es el mismo para todos: no se le enseña a nadie qué arreglar */
    const a = await logica.conGoogle({ credencial: papel({ aud: OTRA_APP }) }, AHORA);
    const b = await logica.conGoogle({ credencial: 'basura' }, AHORA);
    igual('y todos dicen exactamente lo mismo', a.cuerpo, b.cuerpo);
  }

  /* ============ 18. SIN CONFIGURAR, LA PUERTA CONTESTA BIEN ============
     Es el estado de HOY. No puede reventar: tiene que decir «ahorita no» y
     mandar al cliente a su contraseña. */
  {
    const antes = process.env.GOOGLE_CLIENT_ID;
    delete process.env.GOOGLE_CLIENT_ID;

    const r = await logica.conGoogle({ credencial: papel() }, AHORA);
    igual('sin configurar contesta 503, no revienta', r.status, 503);
    falso('y no abre sesión', r.sesionPara);
    cierto('y le dice qué hacer', /correo y contrase/i.test(r.cuerpo.aviso));

    igual('la pantalla se entera de que no hay Google', logica.config().cuerpo.google, '');
    igual('y se dice que es porque falta ponerla', logica.config().cuerpo.porque, 'sin-poner');

    /* La diferencia entre estas dos es la diferencia entre «te falta
       redesplegar» y «lo pegaste mal», que son arreglos distintos. Sin esto,
       desde fuera las dos se ven igual: `{"google":""}`. */
    process.env.GOOGLE_CLIENT_ID = 'GOCSPX-esto-es-el-secreto-no-el-id';
    igual('con el SECRETO pegado por error, también apagado', logica.config().cuerpo.google, '');
    igual('pero se distingue de la otra', logica.config().cuerpo.porque, 'mala-forma');

    process.env.GOOGLE_CLIENT_ID = '"' + NUESTRO_ID + '"';
    igual('pegado con comillas, apagado y se sabe', logica.config().cuerpo.porque, 'mala-forma');

    process.env.GOOGLE_CLIENT_ID = antes;
    igual('con el id bueno, la pantalla lo recibe', logica.config().cuerpo.google, NUESTRO_ID);
    igual('y ya no hay nada que explicar', logica.config().cuerpo.porque, undefined);

    /* La comprobación de forma se aflojó a propósito: no adivina cómo
       escribe Google la parte de adelante, solo exige la cola. Que no
       rechace ids con forma rara pero legítima. */
    const buenos = [
      '407408718192-26mb2m6t3vk7pc0h6bkvbgu4hg.apps.googleusercontent.com',
      '1-a.apps.googleusercontent.com',
      '999999999999-AbC_dEf.xyz.apps.googleusercontent.com'
    ];
    const rechazados = buenos.filter(function (b) {
      process.env.GOOGLE_CLIENT_ID = b;
      return google.idDeCliente() !== b;
    });
    igual('ningún id con la cola buena se rechaza', rechazados, []);
    process.env.GOOGLE_CLIENT_ID = antes;
  }

  console.log('\n' + buenas + ' buenas, ' + malas + ' malas');
  process.exit(malas ? 1 : 0);
})();
