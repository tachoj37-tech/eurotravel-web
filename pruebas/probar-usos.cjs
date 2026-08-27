/* ============================================================
   Un permiso de «ver un viaje» no es una sesión de cuenta
   ------------------------------------------------------------
       node pruebas/probar-usos.cjs

   POR QUE EXISTE ESTA PRUEBA

   De la revisión de seguridad del 27-ago-2026. Aquí conviven dos
   permisos que se parecen y NO valen lo mismo:

     LIGA    ver UN viaje. El código de seis dígitos se le dicta a
             quien sea: así está pensado y así lo dice el código —el
             dueño puede dárselo a su esposa, a su agente o a quien
             le lleve el grupo—.

     CUENTA  entrar a la cuenta. Todos sus viajes, sus datos, y
             cambiarle la contraseña.

   Los dos usaban el MISMO campo para el código y la MISMA cookie,
   con el mismo contenido. Nadie preguntaba de cuál venía el
   permiso, así que:

     · el código dictado para ver un viaje servía para RESETEAR la
       contraseña de la cuenta, y
     · la cookie que salía de ver un viaje era una sesión de cuenta
       completa —con «Mis viajes» entero y, en una cuenta de
       Google, poder ponerle contraseña—.

   No era un hueco de la cuenta ni de la liga: era que los dos
   permisos se veían iguales.

   Ahora el uso va DENTRO del sello. Un permiso de liga no puede
   hacerse pasar por uno de cuenta porque la firma no cuadra — no
   porque alguien se acuerde de comprobarlo.
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

const acceso = require('../api/_acceso.js');
const CLIENTE = 'cus_00000000000001';

/* ============ 1. LA COOKIE ============ */
{
  const deLiga = acceso.firmaSesion(CLIENTE, null, acceso.USO_LIGA);
  const deCuenta = acceso.firmaSesion(CLIENTE, null, acceso.USO_CUENTA);

  igual('la cookie de cuenta sirve como cuenta',
    acceso.clienteDeSesion(deCuenta, null, acceso.USO_CUENTA), CLIENTE);
  igual('la de liga sirve como liga',
    acceso.clienteDeSesion(deLiga, null, acceso.USO_LIGA), CLIENTE);

  /* LA PRUEBA DE ESTE ARCHIVO */
  igual('la cookie de LIGA no sirve como cuenta',
    acceso.clienteDeSesion(deLiga, null, acceso.USO_CUENTA), '');
  igual('ni la de cuenta se hace pasar por liga',
    acceso.clienteDeSesion(deCuenta, null, acceso.USO_LIGA), '');

  /* Una cookie de antes de que esto existiera —sin `u`— vale la DEBIL. Se
     falla cerrado: quien la traiga tendrá que entrar otra vez a su cuenta, y
     eso es lo correcto cuando no se sabe de dónde salió un permiso. */
  const vieja = (function () {
    const carga = Buffer.from(JSON.stringify({ c: CLIENTE, e: Date.now() + 3600000 }))
      .toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    /* se firma con el mismo secreto, como lo haría la versión anterior */
    const crypto = require('crypto');
    const sello = crypto.createHmac('sha256', process.env.LIGAS_SECRETO)
      .update(carga, 'utf8').digest('base64')
      .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    return carga + '.' + sello;
  })();
  igual('una cookie vieja sin uso NO vale como cuenta',
    acceso.clienteDeSesion(vieja, null, acceso.USO_CUENTA), '');
  igual('pero sigue valiendo para ver su viaje',
    acceso.clienteDeSesion(vieja, null, acceso.USO_LIGA), CLIENTE);

  /* Y el uso va firmado: cambiarlo a mano rompe el sello. */
  const partes = deLiga.split('.');
  const cargaMala = Buffer.from(JSON.stringify({
    c: CLIENTE, e: Date.now() + 3600000, u: acceso.USO_CUENTA
  })).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  igual('cambiarle el uso a mano invalida la cookie',
    acceso.clienteDeSesion(cargaMala + '.' + partes[1], null, acceso.USO_CUENTA), '');

  /* Sin exigir uso —como lo llama `sesionValida` para la liga— sigue
     funcionando lo de siempre. */
  cierto('sin exigir uso, las dos se leen', !!acceso.clienteDeSesion(deLiga) &&
    !!acceso.clienteDeSesion(deCuenta));
}

/* ============ 2. EL CODIGO DE SEIS DIGITOS ============ */
{
  const CODIGO = '123456';
  const deLiga = acceso.paraGuardar(CODIGO, Date.now(), acceso.USO_LIGA);
  const deCuenta = acceso.paraGuardar(CODIGO, Date.now(), acceso.USO_CUENTA);

  cierto('el código de liga vale para la liga',
    acceso.revisaCodigo(deLiga, CODIGO, null, acceso.USO_LIGA).ok);
  cierto('el de cuenta vale para la cuenta',
    acceso.revisaCodigo(deCuenta, CODIGO, null, acceso.USO_CUENTA).ok);

  /* LA OTRA PRUEBA IMPORTANTE: el código que el dueño le dicta a alguien para
     que vea un viaje NO puede cambiarle la contraseña de la cuenta. */
  falso('el código dictado para ver un viaje NO vale para la cuenta',
    acceso.revisaCodigo(deLiga, CODIGO, null, acceso.USO_CUENTA).ok);
  falso('ni el de la cuenta abre un viaje',
    acceso.revisaCodigo(deCuenta, CODIGO, null, acceso.USO_LIGA).ok);

  /* Los dos resúmenes son distintos aunque el código sea el mismo: el uso va
     dentro del resumen, no en un campo aparte que alguien pueda ignorar. */
  cierto('el mismo código guarda resúmenes distintos según para qué es',
    deLiga[acceso.CAMPO_HASH] !== deCuenta[acceso.CAMPO_HASH]);

  /* Uno guardado por la versión anterior —sin uso— vale como liga, que es
     para lo que se pidió. */
  const antiguo = acceso.paraGuardar(CODIGO, Date.now());
  cierto('un código de antes vale para la liga',
    acceso.revisaCodigo(antiguo, CODIGO, null, acceso.USO_LIGA).ok);
  falso('y no para la cuenta',
    acceso.revisaCodigo(antiguo, CODIGO, null, acceso.USO_CUENTA).ok);
}

console.log('\n' + buenas + ' buenas, ' + malas + ' malas');
process.exit(malas ? 1 : 0);
