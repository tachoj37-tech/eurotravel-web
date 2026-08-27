/* ============================================================
   Olvidé mi contraseña
   ------------------------------------------------------------
       node pruebas/probar-olvide.cjs

   ES LA PUERTA MAS DELICADA DEL SISTEMA DE CUENTAS: por aquí se
   cambia la contraseña de alguien SIN saber la que tenía. Si algo
   de esto se rompe, es el camino para robarse una cuenta.

   LO QUE SE CUIDA, en orden de gravedad:

     1. Sin el código del buzón no se cambia NADA.
     2. Pedirlo no dice si el correo tiene cuenta —si no, esto se
        vuelve un buscador de los clientes de la empresa—.
     3. El código es de un solo uso: gastado, ya no sirve.
     4. Ese código NO sirve para otra cuenta.
     5. La contraseña vieja deja de servir, y la sal es nueva.
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
    const id = u.split('/customers/')[1].split('?')[0];
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
const cuentas = require('../api/_cuentas.js');
const acceso = require('../api/_acceso.js');

const VIEJA = 'la contraseña de siempre';
const NUEVA = 'una contraseña nueva y larga';

/* El reloj lo pone la prueba: así los frenos de «un minuto entre envíos» se
   pueden saltar sin esperar, y sin volverlos de mentiras. */
let RELOJ = 1756000000000;
function avanzaUnMinuto() { RELOJ += 61 * 1000; }

async function cuentaLista(correo, nombre) {
  await logica.crear({ correo: correo, contrasena: VIEJA, nombre: nombre }, RELOJ);
  const codigo = /\b(\d{6})\b/.exec(CORREOS[CORREOS.length - 1].text)[1];
  await logica.confirmar({ correo: correo, codigo: codigo }, RELOJ);
  avanzaUnMinuto();
  return FICHAS.find(function (f) { return f.email === correo; });
}
function ultimoCodigo() {
  return /\b(\d{6})\b/.exec(CORREOS[CORREOS.length - 1].text)[1];
}

(async function () {

  /* ============ 1. EL RECORRIDO BUENO ============ */
  {
    FICHAS = []; CORREOS = [];
    const ana = await cuentaLista('ana@ejemplo.mx', 'Ana Ruiz');
    const cuantos = CORREOS.length;

    const pedir = await logica.olvide({ correo: 'ana@ejemplo.mx' }, RELOJ);
    igual('pedirlo contesta bien', pedir.status, 200);
    igual('y manda UN correo', CORREOS.length, cuantos + 1);

    const carta = CORREOS[CORREOS.length - 1];
    igual('al dueño de la cuenta', carta.to, ['ana@ejemplo.mx']);
    cierto('el asunto habla de la contraseña', /contrase/i.test(carta.subject));
    /* Lo que de verdad calma a quien lo recibe sin haberlo pedido */
    cierto('el correo dice que la contraseña NO cambió',
      /no cambi/i.test(carta.text));
    cierto('y avisa que alguien intenta entrar',
      /intentando entrar/i.test(carta.text));

    const codigo = ultimoCodigo();
    const r = await logica.claveNueva({ correo: 'ana@ejemplo.mx', codigo: codigo, nueva: NUEVA }, RELOJ);
    igual('con el código, la contraseña cambia', r.status, 200);
    igual('y se abre sesión, sin pedirle que entre otra vez', r.sesionPara, ana.id);
    igual('la pantalla recibe su nombre', r.cuerpo.nombre, 'Ana Ruiz');

    cierto('la NUEVA sirve', await cuentas.contrasenaValida(ana.metadata, NUEVA));
    falso('la VIEJA ya no', await cuentas.contrasenaValida(ana.metadata, VIEJA));
    igual('y entra con la nueva',
      (await logica.entrar({ correo: 'ana@ejemplo.mx', contrasena: NUEVA }, RELOJ)).status, 200);
    igual('con la vieja ya no entra',
      (await logica.entrar({ correo: 'ana@ejemplo.mx', contrasena: VIEJA }, RELOJ)).status, 401);
  }

  /* ============ 2. EL CODIGO ES DE UN SOLO USO ============
     Si sirviera dos veces, quien lo viera de reojo una vez podría volver a
     entrar cuando quisiera. */
  {
    const ana = FICHAS.find(function (f) { return f.email === 'ana@ejemplo.mx'; });
    avanzaUnMinuto();
    await logica.olvide({ correo: 'ana@ejemplo.mx' }, RELOJ);
    const codigo = ultimoCodigo();

    igual('el código sirve una vez',
      (await logica.claveNueva({ correo: 'ana@ejemplo.mx', codigo: codigo, nueva: 'otra mas larga todavia' }, RELOJ)).status, 200);
    igual('y la segunda ya no',
      (await logica.claveNueva({ correo: 'ana@ejemplo.mx', codigo: codigo, nueva: 'y una tercera larga' }, RELOJ)).status, 422);
    cierto('la contraseña quedó en la del primer uso',
      await cuentas.contrasenaValida(ana.metadata, 'otra mas larga todavia'));
  }

  /* ============ 3. PEDIRLO NO DICE SI LA CUENTA EXISTE ============
     ES LA PRUEBA DE ESTE PASO. Si se rompe, cualquiera saca la lista de
     clientes de la empresa probando correos. */
  {
    avanzaUnMinuto();
    const registrado = await logica.olvide({ correo: 'ana@ejemplo.mx' }, RELOJ);
    const inventado = await logica.olvide({ correo: 'nohay@ejemplo.mx' }, RELOJ);
    const malaForma = await logica.olvide({ correo: 'ni-correo-es' }, RELOJ);
    const vacio = await logica.olvide({}, RELOJ);

    igual('registrado e inventado dan el MISMO estado', registrado.status, inventado.status);
    /* Campo por campo, no «se parecen»: un campo de más ya delata. La pista
       sí cambia —sale del correo que escribió quien pregunta, no de la ficha—
       así que se comparan las FORMAS. */
    igual('y las MISMAS llaves en la respuesta',
      Object.keys(registrado.cuerpo).sort(), Object.keys(inventado.cuerpo).sort());
    igual('un correo mal escrito también', Object.keys(malaForma.cuerpo).sort(),
      Object.keys(inventado.cuerpo).sort());
    igual('y el cuerpo vacío también', Object.keys(vacio.cuerpo).sort(),
      Object.keys(inventado.cuerpo).sort());
    falso('ninguno abre sesión', registrado.sesionPara || inventado.sesionPara);

    /* Y lo que de verdad los separa —el correo— solo le llega al dueño */
    const antes = CORREOS.length;
    await logica.olvide({ correo: 'nadie@ejemplo.mx' }, RELOJ);
    igual('a un correo sin cuenta NO se le manda nada', CORREOS.length, antes);
  }

  /* ============ 4. FRENADO TAMPOCO SE NOTA ============
     Pedirlo dos veces seguidas: el segundo se frena, pero contesta igual. Si
     dijera «espera 40 segundos» solo a los registrados, ahí estaría el
     delator. */
  {
    avanzaUnMinuto();
    const primero = await logica.olvide({ correo: 'ana@ejemplo.mx' }, RELOJ);
    const cuantos = CORREOS.length;
    const segundo = await logica.olvide({ correo: 'ana@ejemplo.mx' }, RELOJ);
    igual('el segundo no manda otro correo', CORREOS.length, cuantos);
    igual('pero contesta lo mismo que el primero', segundo.cuerpo, primero.cuerpo);
    igual('y lo mismo que uno inventado',
      Object.keys(segundo.cuerpo).sort(),
      Object.keys((await logica.olvide({ correo: 'nohay@ejemplo.mx' }, RELOJ)).cuerpo).sort());
  }

  /* ============ 5. UN CODIGO NO SIRVE PARA OTRA CUENTA ============ */
  {
    FICHAS = []; CORREOS = [];
    const ana = await cuentaLista('ana@ejemplo.mx', 'Ana Ruiz');
    const beto = await cuentaLista('beto@ejemplo.mx', 'Beto Gil');

    await logica.olvide({ correo: 'ana@ejemplo.mx' }, RELOJ);
    const deAna = ultimoCodigo();

    const r = await logica.claveNueva({ correo: 'beto@ejemplo.mx', codigo: deAna, nueva: NUEVA }, RELOJ);
    igual('el código de Ana NO cambia la de Beto', r.status, 422);
    cierto('la de Beto sigue siendo la suya',
      await cuentas.contrasenaValida(beto.metadata, VIEJA));
    falso('y no le abrió sesión a nadie', r.sesionPara);
  }

  /* ============ 6. SIN CODIGO NO SE CAMBIA NADA ============ */
  {
    const ana = FICHAS.find(function (f) { return f.email === 'ana@ejemplo.mx'; });
    const intentos = [
      ['sin código', { correo: 'ana@ejemplo.mx', nueva: NUEVA }],
      ['con código vacío', { correo: 'ana@ejemplo.mx', codigo: '', nueva: NUEVA }],
      ['con código inventado', { correo: 'ana@ejemplo.mx', codigo: '000000', nueva: NUEVA }],
      ['con letras', { correo: 'ana@ejemplo.mx', codigo: 'abcdef', nueva: NUEVA }],
      ['sin correo', { codigo: '123456', nueva: NUEVA }]
    ];
    const pasaron = [];
    for (let i = 0; i < intentos.length; i++) {
      const r = await logica.claveNueva(intentos[i][1], RELOJ);
      if (r.status === 200 || r.sesionPara) pasaron.push(intentos[i][0]);
    }
    igual('ninguno cambia nada', pasaron, []);
    cierto('la contraseña de Ana sigue siendo la suya',
      await cuentas.contrasenaValida(ana.metadata, VIEJA));
  }

  /* ============ 7. LA CONTRASEÑA NUEVA TIENE QUE SERVIR ============ */
  {
    await logica.olvide({ correo: 'ana@ejemplo.mx' }, RELOJ + 120000);
    const codigo = ultimoCodigo();
    igual('una contraseña corta se rechaza',
      (await logica.claveNueva({ correo: 'ana@ejemplo.mx', codigo: codigo, nueva: 'corta' }, RELOJ)).status, 422);
    igual('y vacía también',
      (await logica.claveNueva({ correo: 'ana@ejemplo.mx', codigo: codigo, nueva: '' }, RELOJ)).status, 422);
    /* Y NO le gastó el código por eso: el error fue de la contraseña, no del
       código, y hacerle perder el intento sería castigarlo por escribir mal. */
    igual('el código sigue sirviendo después de eso',
      (await logica.claveNueva({ correo: 'ana@ejemplo.mx', codigo: codigo, nueva: NUEVA }, RELOJ)).status, 200);
  }

  /* ============ 8. EL CODIGO VENCE Y SE AGOTA ============ */
  {
    FICHAS = []; CORREOS = [];
    await cuentaLista('ana@ejemplo.mx', 'Ana Ruiz');
    await logica.olvide({ correo: 'ana@ejemplo.mx' }, RELOJ);
    const codigo = ultimoCodigo();

    const onceMinutos = RELOJ + 11 * 60 * 1000;
    igual('a los once minutos ya no vale',
      (await logica.claveNueva({ correo: 'ana@ejemplo.mx', codigo: codigo, nueva: NUEVA }, onceMinutos)).status, 422);

    /* CINCO errores se perdonan, el SEXTO mata el código.
       Esta aserción nació mal contada —hacía cinco intentos y esperaba que el
       quinto ya reventara— y la roja tenía razón: el quinto todavía es un
       intento válido que falla. Se deja el conteo explícito para que el
       contrato quede escrito y no haya que volver a deducirlo. */
    avanzaUnMinuto();
    await logica.olvide({ correo: 'ana@ejemplo.mx' }, RELOJ);
    const bueno = ultimoCodigo();
    const estados = [];
    for (let i = 0; i < 6; i++) {
      estados.push((await logica.claveNueva(
        { correo: 'ana@ejemplo.mx', codigo: '000001', nueva: NUEVA }, RELOJ)).status);
    }
    igual('los cinco primeros errores solo dicen «no es»',
      estados.slice(0, 5), [422, 422, 422, 422, 422]);
    igual('el sexto mata el código', estados[5], 429);
    igual('y ya ni el bueno sirve',
      (await logica.claveNueva({ correo: 'ana@ejemplo.mx', codigo: bueno, nueva: NUEVA }, RELOJ)).status, 429);
  }

  /* ============ 9. LA SAL ES NUEVA CADA VEZ ============
     Reusarla dejaría ver que la contraseña cambió pero el resumen no, y de
     rebote que la nueva es igual a la vieja. */
  {
    FICHAS = []; CORREOS = [];
    const ana = await cuentaLista('ana@ejemplo.mx', 'Ana Ruiz');
    const salVieja = ana.metadata[cuentas.CAMPO_SAL];

    await logica.olvide({ correo: 'ana@ejemplo.mx' }, RELOJ);
    await logica.claveNueva({ correo: 'ana@ejemplo.mx', codigo: ultimoCodigo(), nueva: NUEVA }, RELOJ);
    const salMedia = ana.metadata[cuentas.CAMPO_SAL];
    cierto('la sal cambió', salMedia !== salVieja);

    avanzaUnMinuto();
    await logica.olvide({ correo: 'ana@ejemplo.mx' }, RELOJ);
    await logica.claveNueva({ correo: 'ana@ejemplo.mx', codigo: ultimoCodigo(), nueva: 'y otra vez otra larga' }, RELOJ);
    cierto('y vuelve a cambiar en el siguiente', ana.metadata[cuentas.CAMPO_SAL] !== salMedia);
  }

  /* ============ 10. UNA CUENTA A MEDIAS SE COMPLETA ============
     Se registró, nunca tecleó el código de alta, y ahora recupera. Acabar
     aquí vale como confirmación: es el mismo buzón. */
  {
    FICHAS = []; CORREOS = [];
    await logica.crear({ correo: 'nueva@ejemplo.mx', contrasena: VIEJA, nombre: 'Nueva Uno' }, RELOJ);
    const ficha = FICHAS[0];
    falso('quedó sin verificar', cuentas.estaVerificada(ficha.metadata));

    avanzaUnMinuto();
    await logica.olvide({ correo: 'nueva@ejemplo.mx' }, RELOJ);
    const r = await logica.claveNueva({ correo: 'nueva@ejemplo.mx', codigo: ultimoCodigo(), nueva: NUEVA }, RELOJ);
    igual('recuperar funciona igual', r.status, 200);
    cierto('y la deja verificada', cuentas.estaVerificada(ficha.metadata));
    igual('así que ya entra',
      (await logica.entrar({ correo: 'nueva@ejemplo.mx', contrasena: NUEVA }, RELOJ)).status, 200);
  }

  /* ============ 11. QUIEN ENTRO CON GOOGLE PUEDE PONERSE UNA ============ */
  {
    FICHAS = [{ id: 'cus_00000000009999', email: 'goo@ejemplo.mx', name: 'Goo Gle',
      metadata: Object.assign(cuentas.paraLigarGoogle('1100'), cuentas.paraVerificar()) }];
    CORREOS = [];
    falso('no tenía contraseña', cuentas.tieneContrasena(FICHAS[0].metadata));

    await logica.olvide({ correo: 'goo@ejemplo.mx' }, RELOJ);
    igual('sí se le manda código', CORREOS.length, 1);
    const r = await logica.claveNueva({ correo: 'goo@ejemplo.mx', codigo: ultimoCodigo(), nueva: NUEVA }, RELOJ);
    igual('y se la puede poner', r.status, 200);
    cierto('ya sirve', await cuentas.contrasenaValida(FICHAS[0].metadata, NUEVA));
    cierto('sin perder su Google', !!cuentas.googleDe(FICHAS[0].metadata));
  }

  /* ============ 12. NADA DE ESTO ENSEÑA DE MAS ============ */
  {
    const pedir = await logica.olvide({ correo: 'goo@ejemplo.mx' }, RELOJ + 200000);
    const textoPedir = JSON.stringify(pedir.cuerpo);
    igual('pedirlo no enseña el identificador de Stripe', textoPedir.indexOf('cus_'), -1);
    falso('ni el código', /\b\d{6}\b/.test(textoPedir));
    /* La pista es «g***@ejemplo.mx»: dice a dónde fue sin escribirlo entero */
    cierto('pero sí dice a dónde llegó, tapado', /\*/.test(pedir.cuerpo.pista));
    igual('sin el correo completo', pedir.cuerpo.pista.indexOf('goo@'), -1);

    const ficha = FICHAS.find(function (f) { return f.email === 'goo@ejemplo.mx'; });
    const cambiar = await logica.claveNueva({ correo: 'goo@ejemplo.mx', codigo: ultimoCodigo(), nueva: 'ya la ultima larga' }, RELOJ + 200000);
    const textoCambiar = JSON.stringify(cambiar.cuerpo);
    igual('cambiarla no enseña el identificador', textoCambiar.indexOf('cus_'), -1);
    falso('ni la contraseña', /ya la ultima larga/.test(textoCambiar));
    falso('ni el resumen', textoCambiar.indexOf(ficha.metadata[cuentas.CAMPO_HASH]) >= 0);
  }

  console.log('\n' + buenas + ' buenas, ' + malas + ' malas');
  process.exit(malas ? 1 : 0);
})();
