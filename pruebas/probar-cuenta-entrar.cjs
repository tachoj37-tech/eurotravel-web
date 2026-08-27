/* ============================================================
   Entrar, salir y quién soy
   ------------------------------------------------------------
       node pruebas/probar-cuenta-entrar.cjs

   LO QUE SE CUIDA, en orden de gravedad:

     1. la cookie NO se puede forjar ni cambiar de dueño
     2. equivocarse no dice si el correo tiene cuenta
     3. una cuenta sin confirmar no entra
     4. entrar NO manda correo — el dueño lo pidió expreso
     5. salir de verdad saca
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

let FICHAS = [], CORREOS = [], siguienteId = 1;

global.fetch = function (url, opc) {
  const u = String(url);
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
    String(opc.body || '').split('&').forEach(function (par) {
      const i = par.indexOf('=');
      const k = decodeURIComponent(par.slice(0, i));
      const v = decodeURIComponent(par.slice(i + 1).replace(/\+/g, ' '));
      const m = /^metadata\[(.+)\]$/.exec(k);
      if (m) { if (v === '') delete f.metadata[m[1]]; else f.metadata[m[1]] = v; }
    });
    return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(f) });
  }
  if (u.indexOf('/customers') >= 0) {
    const f = { id: 'cus_' + String(siguienteId++).padStart(14, '0'), metadata: {} };
    String(opc.body || '').split('&').forEach(function (par) {
      const i = par.indexOf('=');
      const k = decodeURIComponent(par.slice(0, i));
      const v = decodeURIComponent(par.slice(i + 1).replace(/\+/g, ' '));
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

const logica = require('../api/_cuentas-logica.js');
const acceso = require('../api/_acceso.js');

const CLAVE = 'una contraseña decente';

/* Deja una cuenta lista y confirmada, como quedaría después del paso 2. */
async function cuentaLista(correo, nombre) {
  await logica.crear({ correo: correo, contrasena: CLAVE, nombre: nombre, telefono: '3312345678' });
  const codigo = /\b(\d{6})\b/.exec(CORREOS[CORREOS.length - 1].text)[1];
  await logica.confirmar({ correo: correo, codigo: codigo });
  return FICHAS.find(function (f) { return f.email === correo; });
}

(async function () {

  /* ============ 1. ENTRAR ============ */
  {
    FICHAS = []; CORREOS = [];
    const ana = await cuentaLista('ana@ejemplo.mx', 'Ana Ruiz');
    const cuantosCorreos = CORREOS.length;

    const bien = await logica.entrar({ correo: 'ana@ejemplo.mx', contrasena: CLAVE });
    igual('con su contraseña entra', bien.status, 200);
    igual('y abre sesión para ELLA', bien.sesionPara, ana.id);
    igual('la pantalla recibe su nombre', bien.cuerpo.nombre, 'Ana Ruiz');

    /* Lo que el dueño pidió expreso */
    igual('ENTRAR NO MANDA NINGUN CORREO', CORREOS.length, cuantosCorreos);

    /* y con mayúsculas también, que es como la gente teclea */
    const conMayus = await logica.entrar({ correo: 'Ana@Ejemplo.MX', contrasena: CLAVE });
    igual('el correo con mayúsculas entra igual', conMayus.status, 200);

    /* lo que NO devuelve */
    igual('nunca sale el identificador de Stripe',
      JSON.stringify(bien.cuerpo).indexOf('cus_'), -1);
  }

  /* ============ 2. EQUIVOCARSE NO DICE SI LA CUENTA EXISTE ============
     Es LA prueba de este paso. Si se rompe, cualquiera saca la lista de
     clientes probando correos. */
  {
    const claveMala = await logica.entrar({ correo: 'ana@ejemplo.mx', contrasena: 'no es esa la buena' });
    const sinCuenta = await logica.entrar({ correo: 'nohay@ejemplo.mx', contrasena: CLAVE });
    const correoRaro = await logica.entrar({ correo: 'ni.correo.es', contrasena: CLAVE });
    const vacio = await logica.entrar({});

    igual('contraseña mala y correo inexistente dan el MISMO estado',
      claveMala.status, sinCuenta.status);
    igual('y EXACTAMENTE la misma respuesta', claveMala.cuerpo, sinCuenta.cuerpo);
    igual('un correo con mala forma también', correoRaro.cuerpo, sinCuenta.cuerpo);
    igual('y el cuerpo vacío también', vacio.cuerpo, sinCuenta.cuerpo);
    falso('ninguno abre sesión', claveMala.sesionPara || sinCuenta.sesionPara);
    /* el mensaje no nombra cuál de los dos falló */
    cierto('el aviso no distingue correo de contraseña',
      /correo o esa contrase/i.test(claveMala.cuerpo.aviso));
  }

  /* ============ 2-bis. EL RELOJ TAMPOCO DICE SI LA CUENTA EXISTE ============
     ESTA PRUEBA NACIO DE UNA REVISION DE SEGURIDAD, el 27-ago-2026, y de una
     medición:

         correo CON cuenta, contraseña mala →  61.7 ms
         correo SIN cuenta, misma petición  →   0.1 ms

     Seiscientas sesenta veces. Todo el trabajo de arriba —que los dos casos
     contesten palabra por palabra lo mismo— lo tiraba el cronómetro: bastaba
     medir para sacar la lista de correos registrados.

     La causa era la buena parte del diseño: `scrypt` tarda a propósito, pero
     solo corría cuando la cuenta existía.

     Se compara por PROPORCION y no contra un número de milisegundos: en una
     máquina rápida `scrypt` tarda menos y un tope fijo se pondría rojo sin
     que nada esté mal. Lo que importa es que los dos caminos cuesten lo
     mismo, no cuánto. */
  {
    FICHAS = []; CORREOS = [];
    await cuentaLista('ana@ejemplo.mx', 'Ana Ruiz');

    function mediana(a) { const b = a.slice().sort(function (x, y) { return x - y; }); return b[Math.floor(b.length / 2)]; }
    const con = [], sin = [];
    for (let i = 0; i < 9; i++) {
      let t = process.hrtime.bigint();
      await logica.entrar({ correo: 'ana@ejemplo.mx', contrasena: 'no es la buena' });
      con.push(Number(process.hrtime.bigint() - t) / 1e6);

      t = process.hrtime.bigint();
      await logica.entrar({ correo: 'nohay@ejemplo.mx', contrasena: 'no es la buena' });
      sin.push(Number(process.hrtime.bigint() - t) / 1e6);
    }
    const conCuenta = mediana(con), sinCuenta = mediana(sin);
    const proporcion = sinCuenta / conCuenta;

    cierto('un correo SIN cuenta cuesta casi lo mismo que uno CON cuenta' +
      '  (con ' + conCuenta.toFixed(1) + ' ms · sin ' + sinCuenta.toFixed(1) + ' ms)',
      proporcion > 0.5);
    /* Y que de verdad esté costando trabajo, no que las dos sean instantáneas
       porque alguien quitó `scrypt` de en medio. */
    cierto('y las dos cuestan trabajo de verdad', conCuenta > 5 && sinCuenta > 5);
  }

  /* ============ 3. SIN CONFIRMAR NO ENTRA ============
     Pero SOLO se le dice después de acertar la contraseña: así ya demostró
     que la cuenta es suya y no se le regala nada a nadie. */
  {
    FICHAS = []; CORREOS = [];
    await logica.crear({ correo: 'nueva@ejemplo.mx', contrasena: CLAVE, nombre: 'Nueva Uno' });

    const conClave = await logica.entrar({ correo: 'nueva@ejemplo.mx', contrasena: CLAVE });
    igual('sin confirmar no entra', conClave.status, 403);
    cierto('y se le dice que le falta confirmar', conClave.cuerpo.faltaConfirmar);
    falso('sin abrir sesión', conClave.sesionPara);

    /* con la contraseña MALA vuelve al mensaje genérico: no se entera de que
       ese correo tiene cuenta */
    const sinClave = await logica.entrar({ correo: 'nueva@ejemplo.mx', contrasena: 'otra cosa larga' });
    igual('con la contraseña mala NO se entera de que existe', sinClave.status, 401);
    falso('ni se le dice que falta confirmar', sinClave.cuerpo.faltaConfirmar);
  }

  /* ============ 4. LA COOKIE NO SE PUEDE FORJAR ============
     Lo más grave que podría pasar: entrar a la cuenta de otro cambiando un
     texto en el navegador. */
  {
    FICHAS = []; CORREOS = [];
    const ana = await cuentaLista('ana@ejemplo.mx', 'Ana Ruiz');
    const beto = await cuentaLista('beto@ejemplo.mx', 'Beto Gil');

    const suyo = acceso.firmaSesion(ana.id);
    igual('su propia cookie la reconoce', acceso.clienteDeSesion(suyo), ana.id);

    /* forjada a mano, sin sello */
    const inventada = Buffer.from(JSON.stringify({ c: beto.id, e: Date.now() + 3600000 }))
      .toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    igual('una cookie sin sello NO vale', acceso.clienteDeSesion(inventada + '.loquesea'), '');
    igual('ni sin punto', acceso.clienteDeSesion(inventada), '');
    igual('ni vacía', acceso.clienteDeSesion(''), '');
    igual('ni nula', acceso.clienteDeSesion(null), '');
    igual('ni basura', acceso.clienteDeSesion('no.es.una.cookie'), '');

    /* cambiarle el dueño a una cookie buena rompe el sello */
    const punto = suyo.indexOf('.');
    const cambiada = inventada + suyo.slice(punto);
    igual('cambiarle el dueño a una cookie buena la invalida',
      acceso.clienteDeSesion(cambiada), '');

    /* y una vencida tampoco */
    const vieja = acceso.firmaSesion(ana.id, Date.now() - 9 * 3600 * 1000);
    igual('una sesión de hace nueve horas ya no vale', acceso.clienteDeSesion(vieja), '');
    cierto('pero de siete sí', !!acceso.clienteDeSesion(acceso.firmaSesion(ana.id, Date.now() - 7 * 3600 * 1000)));
  }

  /* ============ 5. QUIEN SOY ============ */
  {
    const ana = FICHAS.find(function (f) { return f.email === 'ana@ejemplo.mx'; });

    const dentro = await logica.yo(ana.id);
    cierto('con sesión buena, está dentro', dentro.cuerpo.dentro);
    igual('y dice su nombre', dentro.cuerpo.nombre, 'Ana Ruiz');
    igual('nunca sale el identificador de Stripe',
      JSON.stringify(dentro.cuerpo).indexOf('cus_'), -1);

    const fuera = await logica.yo('');
    falso('sin sesión, fuera', fuera.cuerpo.dentro);
    igual('y NO es un error: es la respuesta normal de quien no entró', fuera.status, 200);

    /* cookie bien firmada de un cliente que ya no existe */
    const fantasma = await logica.yo('cus_00000000009999');
    falso('un cliente que ya no está, fuera', fantasma.cuerpo.dentro);
    cierto('y se le tira la cookie', fantasma.borrarSesion);

    /* una ficha sin cuenta —compró como invitado— no cuenta como sesión */
    FICHAS.push({ id: 'cus_00000000008888', email: 'invitado@ejemplo.mx', metadata: {} });
    const invitado = await logica.yo('cus_00000000008888');
    falso('quien compró como invitado no está «dentro»', invitado.cuerpo.dentro);
    cierto('y se le tira la cookie', invitado.borrarSesion);
  }

  /* ============ 6. SALIR ============ */
  {
    const r = logica.salir();
    igual('salir contesta bien', r.status, 200);
    cierto('y manda tirar la cookie', r.borrarSesion);
    /* la cookie borrada tiene que vencer en el pasado y seguir siendo HttpOnly */
    const galleta = acceso.cookieBorrada();
    cierto('la cookie borrada sigue siendo HttpOnly', /HttpOnly/i.test(galleta));
    cierto('y va marcada para morir', /Max-Age=0|Expires=/i.test(galleta));
  }

  console.log('\n' + buenas + ' buenas, ' + malas + ' malas');
  process.exit(malas ? 1 : 0);
})();
