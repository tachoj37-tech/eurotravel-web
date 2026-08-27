/* ============================================================
   Crear una cuenta y confirmar el correo
   ------------------------------------------------------------
       node pruebas/probar-cuenta-alta.cjs

   Con un Stripe y un Resend de mentiras: no sale una sola
   petición a la red.

   LO QUE SE CUIDA, en orden de gravedad:

     1. NADA dice si un correo ya tiene cuenta
     2. una cuenta no abre hasta confirmar el correo
     3. el codigo se puede reenviar, pero no infinito
     4. si el correo no sale, no se deja un codigo que nadie vio
     5. quien ya compro como invitado no acaba con dos fichas
   ============================================================ */
'use strict';

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

/* ---------- el Stripe de mentiras ---------- */
let FICHAS = [];          // los clientes que "existen"
let CORREOS = [];         // lo que se mando por Resend
let RESEND_OK = true;
let siguienteId = 1;

global.fetch = function (url, opc) {
  const u = String(url);

  /* buscar por correo */
  if (u.indexOf('/customers?email=') >= 0) {
    const q = decodeURIComponent(u.split('email=')[1].split('&')[0]);
    return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({
      data: FICHAS.filter(function (f) { return f.email === q; }) }) });
  }
  /* escribir metadata en un cliente */
  if (/\/customers\/cus_/.test(u)) {
    const id = u.split('/customers/')[1];
    const f = FICHAS.find(function (x) { return x.id === id; });
    if (!f) return Promise.resolve({ ok: false, status: 404, json: () => Promise.resolve({ error: {} }) });
    String(opc.body || '').split('&').forEach(function (par) {
      const i = par.indexOf('=');
      const k = decodeURIComponent(par.slice(0, i));
      const v = decodeURIComponent(par.slice(i + 1).replace(/\+/g, ' '));
      const m = /^metadata\[(.+)\]$/.exec(k);
      if (m) { if (v === '') delete f.metadata[m[1]]; else f.metadata[m[1]] = v; }
    });
    return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(f) });
  }
  /* crear cliente */
  if (u.indexOf('/customers') >= 0) {
    const f = { id: 'cus_' + String(siguienteId++).padStart(14, '0'), metadata: {} };
    String(opc.body || '').split('&').forEach(function (par) {
      const i = par.indexOf('=');
      const k = decodeURIComponent(par.slice(0, i));
      const v = decodeURIComponent(par.slice(i + 1).replace(/\+/g, ' '));
      const m = /^metadata\[(.+)\]$/.exec(k);
      if (m) { if (v !== '') f.metadata[m[1]] = v; }
      else if (k === 'email') f.email = v;
      else if (k === 'name') f.name = v;
      else if (k === 'phone') f.phone = v;
    });
    FICHAS.push(f);
    return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(f) });
  }
  /* Resend */
  if (u.indexOf('resend') >= 0) {
    if (!RESEND_OK) return Promise.resolve({ ok: false, status: 403,
      json: () => Promise.resolve({ message: 'The domain is not verified' }) });
    CORREOS.push(JSON.parse(opc.body));
    return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({ id: 'em' }) });
  }
  return Promise.reject(new Error('inesperado: ' + u));
};

const logica = require('../api/_cuentas-logica.js');
const cuentas = require('../api/_cuentas.js');
const acceso = require('../api/_acceso.js');

const CLAVE = 'una contraseña decente';
function limpia() { FICHAS = []; CORREOS = []; RESEND_OK = true; }
function ficha(correo) { return FICHAS.find(function (f) { return f.email === correo; }); }
/* El codigo real que se mando: se saca probandolo contra el resumen guardado,
   que es justo lo que hace la pagina. Un millon de opciones, pero solo se
   prueban las que aparecen en el correo. */
function codigoDelCorreo() {
  const ultimo = CORREOS[CORREOS.length - 1];
  const m = /\b(\d{6})\b/.exec(ultimo.text || '');
  return m ? m[1] : null;
}

(async function () {

  /* ============ 1. EL ALTA FELIZ ============ */
  {
    limpia();
    const r = await logica.crear({ correo: 'Ana@Ejemplo.MX', contrasena: CLAVE,
      nombre: 'Ana Ruiz', telefono: '3312345678' });

    igual('contesta que sí', r.status, 200);
    cierto('y que mandó el código', r.cuerpo.mandado);
    igual('se creó UN cliente', FICHAS.length, 1);
    igual('con el correo en minúsculas', FICHAS[0].email, 'ana@ejemplo.mx');
    igual('y salió UN correo', CORREOS.length, 1);
    cierto('el asunto habla de confirmar la cuenta', /confirmar tu cuenta/i.test(CORREOS[0].subject));
    /* lo que mas importa de la ficha */
    falso('la cuenta NO nace verificada', cuentas.estaVerificada(FICHAS[0].metadata));
    igual('la contraseña no aparece por ningún lado',
      JSON.stringify(FICHAS[0]).indexOf(CLAVE), -1);
    cierto('pero la contraseña sí abre', await cuentas.contrasenaValida(FICHAS[0].metadata, CLAVE));
  }

  /* ============ 2. CONFIRMAR ============ */
  {
    const codigo = codigoDelCorreo();
    cierto('el correo trae un código de 6 dígitos', /^\d{6}$/.test(codigo));

    const malo = await logica.confirmar({ correo: 'ana@ejemplo.mx', codigo: '000000' });
    igual('un código equivocado no confirma', malo.status, 422);
    falso('y no abre sesión', malo.sesionPara);
    falso('la cuenta sigue sin verificar', cuentas.estaVerificada(ficha('ana@ejemplo.mx').metadata));

    const bien = await logica.confirmar({ correo: 'ana@ejemplo.mx', codigo: codigo });
    igual('el bueno sí', bien.status, 200);
    cierto('la deja verificada', bien.cuerpo.verificada);
    cierto('y abre sesión', !!bien.sesionPara);
    cierto('la ficha queda verificada', cuentas.estaVerificada(ficha('ana@ejemplo.mx').metadata));
    /* ------------------------------------------------------------
       ESTA ASERCION CAMBIO DE LADO, Y ES LA MAS CARA DEL PROYECTO
       ------------------------------------------------------------
       Decía: «confirmar dos veces no truena, solo entra», y comprobaba que
       la segunda vez devolviera `yaEstaba` y abriera sesión.

       Estaba dando por buena una ENTRADA LIBRE A CUALQUIER CUENTA. El código
       cortaba antes de revisar los seis dígitos si la cuenta ya estaba
       verificada —y toda cuenta que sirve lo está—, así que con el correo de
       alguien y un código inventado se recibía su sesión, sus viajes y las
       ligas de sus contratos. Comprobado, no supuesto.

       La prueba no lo cazó porque estaba escrita para confirmar la intención
       («que no truene si le dan dos veces») en vez de para atacar el camino.
       Una prueba que solo repite lo que el código quiso hacer no revisa nada.

       Ahora se comprueba lo contrario: el código es de UN SOLO USO y sin
       código no hay sesión, le hayan dado dos veces o veinte. */
    const otraVez = await logica.confirmar({ correo: 'ana@ejemplo.mx', codigo: codigo });
    igual('el mismo código NO sirve dos veces', otraVez.status, 422);
    falso('y la segunda vez NO abre sesión', otraVez.sesionPara);
  }

  /* ============ 2-bis. NO SE ENTRA A UNA CUENTA AJENA SIN EL CODIGO ============
     De la revisión de seguridad del 27-ago-2026. Es el ataque completo, tal
     como se hacía: se conoce el correo de alguien y nada más. */
  {
    /* NO se vacían FICHAS ni CORREOS: los bloques de abajo cuentan con la
       cuenta de Ana ya creada. Se usa un correo nuevo y ya. */
    await logica.crear({ correo: 'victima@ejemplo.mx', contrasena: 'su contraseña privada',
      nombre: 'Otra Persona' });
    const suyo = /\b(\d{6})\b/.exec(CORREOS[CORREOS.length - 1].text)[1];
    await logica.confirmar({ correo: 'victima@ejemplo.mx', codigo: suyo });

    const intentos = [
      ['un código inventado', '000000'],
      ['el código en blanco', ''],
      ['sin código', undefined],
      ['letras', 'abcdef'],
      ['el código que YA se usó', suyo]
    ];
    const entraron = [];
    for (let i = 0; i < intentos.length; i++) {
      const r = await logica.confirmar({ correo: 'victima@ejemplo.mx', codigo: intentos[i][1] });
      if (r.sesionPara) entraron.push(intentos[i][0]);
    }
    igual('con el correo de otro, NADA abre su sesión', entraron, []);
  }

  /* ============ 3. NADA DICE SI UN CORREO YA TIENE CUENTA ============
     Es LA prueba de este paso. Si se rompe, cualquiera saca la lista de
     clientes de la empresa probando correos. */
  {
    const conCuenta = await logica.crear({ correo: 'ana@ejemplo.mx', contrasena: 'otra distinta larga',
      nombre: 'Quien Sea', telefono: '3300000000' });
    const nuevo = await logica.crear({ correo: 'nadie@ejemplo.mx', contrasena: 'otra distinta larga',
      nombre: 'Otro Mas', telefono: '3300000000' });

    igual('registrarse con un correo QUE YA TIENE cuenta y con uno nuevo dan el mismo estado',
      conCuenta.status, nuevo.status);
    igual('y los mismos campos',
      Object.keys(conCuenta.cuerpo).sort(), Object.keys(nuevo.cuerpo).sort());
    /* La comparacion de VERDAD: la respuesta entera, no solo los nombres de
       los campos. La primera version solo comparaba las llaves y aun asi cazo
       una fuga —a uno le sobraba `pista`—; comparando el objeto completo,
       tambien cazaria un valor distinto en un campo que si esta en los dos.

       La `pista` es el propio correo tapado, que quien pregunta ya escribio,
       asi que se normaliza para poder comparar los dos cuerpos de frente. */
    const sinPista = function (c) { return Object.assign({}, c, { pista: '(el que escribio)' }); };
    igual('y EXACTAMENTE la misma respuesta, valor por valor',
      sinPista(conCuenta.cuerpo), sinPista(nuevo.cuerpo));

    /* y la contraseña de Ana NO cambió por el intento */
    cierto('la contraseña de la cuenta que ya existía sigue siendo la suya',
      await cuentas.contrasenaValida(ficha('ana@ejemplo.mx').metadata, CLAVE));
    falso('y NO se la cambió el que lo intentó',
      await cuentas.contrasenaValida(ficha('ana@ejemplo.mx').metadata, 'otra distinta larga'));

    /* al dueño del correo SI se le avisa: es a quien le importa */
    const aviso = CORREOS.filter(function (c) { return /intent[óo] registrarse/i.test(c.subject); });
    igual('al dueño del correo se le avisa del intento', aviso.length, 1);
    igual('y el aviso va a SU correo', aviso[0].to, ['ana@ejemplo.mx']);
  }

  /* ============ 4. UNA CUENTA SIN CONFIRMAR NO ABRE ============ */
  {
    const m = ficha('nadie@ejemplo.mx').metadata;
    cierto('existe', cuentas.tieneCuenta(m));
    falso('pero no está verificada', cuentas.estaVerificada(m));
  }

  /* ============ 5. EL REENVIO: «las veces que sea necesario», con tope ============ */
  {
    limpia();
    const AHORA = 1800000000000;
    await logica.crear({ correo: 'lento@ejemplo.mx', contrasena: CLAVE, nombre: 'Lento Uno' }, AHORA);
    igual('el alta manda el primero', CORREOS.length, 1);

    /* de inmediato: no */
    const seguido = await logica.reenviar({ correo: 'lento@ejemplo.mx' }, AHORA + 1000);
    igual('otro de inmediato se frena', seguido.status, 429);
    cierto('y dice cuántos segundos esperar', seguido.cuerpo.segundos > 0);
    igual('no salió correo de más', CORREOS.length, 1);

    /* pasado el minuto: sí */
    const luego = await logica.reenviar({ correo: 'lento@ejemplo.mx' }, AHORA + 61000);
    igual('pasado el minuto sí sale', luego.status, 200);
    igual('y llega otro correo', CORREOS.length, 2);

    /* hasta el tope de la ventana */
    let t = AHORA + 61000;
    for (let i = 0; i < 20; i++) { t += 61000; await logica.reenviar({ correo: 'lento@ejemplo.mx' }, t); }
    igual('no pasa del tope de 12 en 24 horas', CORREOS.length, cuentas.TOPE_VENTANA);

    /* y al día siguiente, otra vez */
    const manana = await logica.reenviar({ correo: 'lento@ejemplo.mx' }, AHORA + 25 * 3600 * 1000);
    igual('al día siguiente vuelve a poder', manana.status, 200);
  }

  /* ============ 6. EL REENVIO TAMPOCO DELATA ============ */
  {
    limpia();
    await logica.crear({ correo: 'existe@ejemplo.mx', contrasena: CLAVE, nombre: 'Existe Uno' });
    const c = codigoDelCorreo();
    await logica.confirmar({ correo: 'existe@ejemplo.mx', codigo: c });

    const aNadie = await logica.reenviar({ correo: 'nohay@ejemplo.mx' });
    const aVerificada = await logica.reenviar({ correo: 'existe@ejemplo.mx' });
    igual('reenviar a un correo sin cuenta y a uno ya verificado dan lo mismo',
      [aNadie.status, aNadie.cuerpo.mandado], [aVerificada.status, aVerificada.cuerpo.mandado]);
    igual('y no sale correo en ninguno de los dos', CORREOS.length, 1);
  }

  /* ============ 7. SI EL CORREO NO SALE, NO SE DEJA UN CODIGO FANTASMA ============
     Sin esto el cliente queda con una cuenta que pide un codigo que nunca
     vio, y con el contador de envios ya gastado. */
  {
    limpia();
    RESEND_OK = false;
    const r = await logica.crear({ correo: 'rebota@ejemplo.mx', contrasena: CLAVE, nombre: 'Rebota Uno' });
    igual('avisa que no se pudo mandar', r.status, 502);
    cierto('con un aviso legible', /c[óo]digo/i.test(r.cuerpo.aviso));
    falso('el aviso NO nombra variables de entorno', /[A-Z_]{4,}/.test(r.cuerpo.aviso));

    const m = ficha('rebota@ejemplo.mx').metadata;
    falso('no queda un código pedido que nadie vio', m[acceso.CAMPO_HASH]);
    cierto('pero la cuenta sí quedó creada, para poder reintentar', cuentas.tieneCuenta(m));

    /* y al reintentar con el correo ya bueno, funciona */
    RESEND_OK = true;
    const otra = await logica.reenviar({ correo: 'rebota@ejemplo.mx' }, Date.now() + 120000);
    igual('reintentar después sí manda', otra.status, 200);
    igual('y ahora sí llega', CORREOS.length, 1);
  }

  /* ============ 8. QUIEN YA COMPRO COMO INVITADO NO ACABA CON DOS FICHAS ============
     Stripe no impide dos clientes con el mismo correo. Si el alta creara uno
     nuevo, el cliente perderia de vista sus compras anteriores. */
  {
    limpia();
    FICHAS.push({ id: 'cus_00000000000099', email: 'viejo@ejemplo.mx',
      name: 'Cliente Viejo', metadata: { folio: 'ET-VIEJO' } });

    const r = await logica.crear({ correo: 'viejo@ejemplo.mx', contrasena: CLAVE, nombre: 'Cliente Viejo' });
    igual('el alta sale bien', r.status, 200);
    igual('y NO se creó una ficha nueva', FICHAS.length, 1);
    igual('la cuenta se montó sobre la que ya existía', FICHAS[0].id, 'cus_00000000000099');
    igual('sin perder lo que ya tenía', FICHAS[0].metadata.folio, 'ET-VIEJO');
    cierto('y su contraseña abre', await cuentas.contrasenaValida(FICHAS[0].metadata, CLAVE));
  }

  /* ============ 9. LO QUE NO SE ACEPTA ============ */
  {
    limpia();
    const casos = [
      ['sin correo', { contrasena: CLAVE, nombre: 'X Y' }],
      ['correo sin arroba', { correo: 'ana.mx', contrasena: CLAVE, nombre: 'X Y' }],
      ['contraseña corta', { correo: 'a@b.mx', contrasena: '123', nombre: 'X Y' }],
      ['sin contraseña', { correo: 'a@b.mx', nombre: 'X Y' }],
      ['sin nombre', { correo: 'a@b.mx', contrasena: CLAVE }],
      ['cuerpo vacío', {}],
      ['cuerpo nulo', null]
    ];
    for (const c of casos) {
      const r = await logica.crear(c[1]);
      igual(c[0] + ': se rechaza', r.status, 422);
    }
    igual('y no se creó ninguna ficha', FICHAS.length, 0);
    igual('ni salió ningún correo', CORREOS.length, 0);
  }

  console.log('\n' + buenas + ' buenas, ' + malas + ' malas');
  process.exit(malas ? 1 : 0);
})();
