/* ============================================================
   Nadie se queda sin respuesta
   ------------------------------------------------------------
       node pruebas/probar-tronadas.cjs

   POR QUE EXISTE ESTA PRUEBA

   El 27-ago-2026, corriendo la batería completa en esta misma
   máquina, Node tiró:

       [Error: Deriving bits failed]

   Es lo que `scrypt` contesta cuando no hay memoria. No es
   hipotético ni raro: la máquina anda corta y pasó de verdad.

   Se midió qué le pasaba a un cliente si eso ocurría mientras
   creaba su cuenta: NADA. Rechazo no atendido, sin respuesta. La
   pantalla le decía «no hubo conexión» —mentira, sí hubo: el que
   falló fue el servidor— y encima un rechazo no atendido puede
   tumbar la instancia y llevarse a los que estaban a media compra.

   Cinco de las once puertas no atrapaban nada. Ahora todas van
   envueltas en `_defensas.aPruebaDeTronadas`, y esto lo comprueba
   una por una: se les rompe algo adentro a propósito y se mira que
   el cliente reciba una respuesta con algo que pueda leer.
   ============================================================ */
'use strict';

process.env.LIGAS_SECRETO = 'secreto-de-prueba-para-cuentas-1234567890';
process.env.STRIPE_SECRET_KEY = 'sk_test_x';
process.env.RESEND_API_KEY = 're_x';
process.env.GOOGLE_PLACES_KEY = 'PRUEBA-places-000';
process.env.GOOGLE_ROUTES_KEY = 'PRUEBA-routes-000';
process.env.CLAVE_DIAGNOSTICO = 'clave-de-prueba';
process.env.CLAVE_COTIZADOR = 'clave-de-prueba';

let buenas = 0, malas = 0;
function igual(nombre, dio, esperado) {
  const a = JSON.stringify(dio), b = JSON.stringify(esperado);
  if (a === b) { buenas++; console.log('ok   ' + nombre); }
  else { malas++; console.log('MAL  ' + nombre + '\n     dio      ' + a + '\n     esperaba ' + b); }
}
function cierto(nombre, v) { igual(nombre, !!v, true); }

/* Todo lo que salga a la red truena. Es la forma más pareja de romper por
   dentro CUALQUIER puerta sin saber qué hace cada una. */
global.fetch = async function () { throw new Error('tronó a propósito'); };

/* Y `scrypt` también, que fue el que falló de verdad. Se guarda el bueno
   porque más abajo hace falta armar una contraseña de verdad antes de
   romperlo. */
const crypto = require('crypto');
const scryptDeVerdad = crypto.scrypt;
const scryptRoto = function (clave, sal, largo, opciones, listo) {
  const cb = typeof opciones === 'function' ? opciones : listo;
  process.nextTick(function () { cb(new Error('Deriving bits failed')); });
};
crypto.scrypt = scryptRoto;

/* Una `res` que apunta lo que le hicieron. */
function armaRes(listo) {
  let estado = 0;
  const res = {
    setHeader: function () { return res; },
    status: function (s) { estado = s; return res; },
    json: function (d) { listo({ contesto: true, estado: estado, cuerpo: d }); return res; },
    end: function () { listo({ contesto: true, estado: estado, cuerpo: null }); return res; }
  };
  return res;
}

/* Llama a una puerta y contesta qué pasó: si contestó, si se colgó, o si
   dejó escapar el error. */
function toca(archivo, cuerpo) {
  return new Promise(function (listo) {
    let yaFue = false;
    const acaba = function (r) { if (!yaFue) { yaFue = true; listo(r); } };

    const handler = require('../api/' + archivo);
    const req = {
      method: 'POST',
      headers: {
        origin: 'https://eurotravel-web.vercel.app',
        'x-vercel-forwarded-for': '203.0.113.' + Math.floor(Math.random() * 200 + 1),
        cookie: ''
      },
      body: cuerpo
    };

    try {
      const salida = handler(req, armaRes(acaba));
      if (salida && typeof salida.then === 'function') {
        salida.then(function () { /* si contestó, ya se avisó */ },
          function (e) { acaba({ contesto: false, escapo: (e && e.message) || 'error' }); });
      }
    } catch (e) {
      acaba({ contesto: false, escapo: (e && e.message) || 'error' });
    }

    setTimeout(function () { acaba({ contesto: false, colgada: true }); }, 2500);
  });
}

/* Cada puerta con un cuerpo que la haga entrar en materia. */
const PUERTAS = [
  ['cuenta.js', { accion: 'crear', correo: 'ana@ejemplo.mx', contrasena: 'una contraseña larga', nombre: 'Ana Ruiz' }],
  ['cuenta.js', { accion: 'entrar', correo: 'ana@ejemplo.mx', contrasena: 'una contraseña larga' }],
  ['viaje.js', { t: 'loquesea.loquesea' }],
  ['cerrar-sesion.js', {}],
  ['confirmar.js', { sesion: 'cs_test_' + '1'.repeat(20) }],
  ['pedir-codigo.js', { t: 'loquesea.loquesea' }],
  ['verificar-codigo.js', { t: 'loquesea.loquesea', codigo: '123456' }],
  ['cotizar.js', { origen: {}, destino: {}, salida: '2026-09-10' }],
  ['places.js', { q: 'Guadalajara' }]
];

(async function () {
  const sinRespuesta = [], sinAviso = [];

  for (let i = 0; i < PUERTAS.length; i++) {
    const archivo = PUERTAS[i][0];
    const que = archivo + (PUERTAS[i][1].accion ? ' · ' + PUERTAS[i][1].accion : '');
    const r = await toca(archivo, PUERTAS[i][1]);

    if (!r.contesto) {
      sinRespuesta.push(que + (r.colgada ? ' (se colgó)' : ' (escapó: ' + r.escapo + ')'));
      continue;
    }
    /* Contestó. Si contestó BIEN, no hay nada que exigirle: `cerrar-sesion`
       funciona aunque la red esté muerta, porque solo tira una galleta, y su
       `{cerrada:true}` es la respuesta correcta. La primera versión de esta
       prueba se lo reclamaba: pedía un aviso a una respuesta exitosa.

       Lo que sí se exige es que cuando algo SALE MAL, el cliente reciba algo
       que pueda leer. Un 500 pelón no le sirve a quien está esperando. */
    if (r.estado < 400) continue;
    const texto = JSON.stringify(r.cuerpo || {});
    const tieneAviso = /aviso|error|mensaje/i.test(texto) && texto.length > 12;
    if (!tieneAviso) sinAviso.push(que + ' -> ' + r.estado + ' ' + texto.slice(0, 60));
  }

  igual('NINGUNA puerta deja al cliente sin respuesta', sinRespuesta, []);
  igual('y todas le dicen algo que pueda leer', sinAviso, []);

  /* ============ EL CASO QUE DE VERDAD PASO ============
     `scrypt` sin memoria a media alta de cuenta. Aquí Stripe SÍ contesta
     —si no, el código ni llega a la contraseña y estaríamos midiendo otra
     cosa; así fallaba la primera versión de esta prueba— y lo único que
     falla es `scrypt`, como aquella tarde. */
  {
    global.fetch = async function (url) {
      const u = String(url);
      if (u.indexOf('/customers?email=') >= 0) {
        return { ok: true, status: 200, json: async () => ({ data: [] }) };
      }
      throw new Error('no debería llegar aquí');
    };

    const r = await toca('cuenta.js', { accion: 'crear', correo: 'ana@ejemplo.mx',
      contrasena: 'una contraseña larga', nombre: 'Ana Ruiz' });

    cierto('crear cuenta con scrypt sin memoria SÍ contesta', r.contesto);
    igual('y con un estado de «vuelve a intentar»', r.estado, 503);
    const aviso = String((r.cuerpo || {}).aviso || '');
    cierto('el aviso no nombra lo que se rompió por dentro',
      !/scrypt|Deriving|stack|undefined|null/i.test(aviso));
    cierto('y le dice que puede seguir como invitado', /invitado/i.test(aviso));
  }

  /* ============ «NO PUDE COMPROBAR» NO ES «ESTA MAL» ============
     Alguien entra con su contraseña BUENA y `scrypt` no puede comprobarla.
     Antes se le contestaba «ese correo o esa contraseña no son» — un error
     del servidor disfrazado de error del cliente. Y la persona concluye que
     se le olvidó, se va a «olvidé mi contraseña» y cambia una que estaba
     perfecta. */
  {
    /* Se arma una ficha con una contraseña de verdad, ANTES de romper scrypt. */
    crypto.scrypt = scryptDeVerdad;
    const cuentas = require('../api/_cuentas.js');
    const conClave = Object.assign(await cuentas.paraCrear('la contraseña buena'),
      cuentas.paraVerificar());
    cierto('la contraseña buena sirve mientras scrypt funciona',
      await cuentas.contrasenaValida(conClave, 'la contraseña buena'));

    /* y ahora se rompe */
    crypto.scrypt = scryptRoto;
    global.fetch = async function (url) {
      const u = String(url);
      if (u.indexOf('/customers?email=') >= 0) {
        return { ok: true, status: 200, json: async () => ({ data: [
          { id: 'cus_00000000000001', email: 'ana@ejemplo.mx', name: 'Ana Ruiz', metadata: conClave }
        ] }) };
      }
      throw new Error('no debería llegar aquí');
    };

    const r = await toca('cuenta.js', { accion: 'entrar', correo: 'ana@ejemplo.mx',
      contrasena: 'la contraseña buena' });
    cierto('entrar con scrypt roto SÍ contesta', r.contesto);
    const aviso = String((r.cuerpo || {}).aviso || '');
    igual('y NO le dice que su contraseña está mal', /contrase.a no son|no son/i.test(aviso), false);
    igual('sino que falló el servidor', r.estado, 503);
  }

  console.log('\n' + buenas + ' buenas, ' + malas + ' malas');
  process.exit(malas ? 1 : 0);
})();
