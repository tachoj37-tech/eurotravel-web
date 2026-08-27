/* ============================================================
   El motor de las cuentas
   ------------------------------------------------------------
       node pruebas/probar-cuentas.cjs

   Aquí vive la contraseña de los clientes, así que esto se prueba
   antes de que exista una sola pantalla encima.

   Lo que se cuida, en orden de gravedad:

     1. la contraseña NUNCA se guarda, ni se puede sacar del resumen
     2. una cuenta nace SIN VERIFICAR y no abre hasta que lo esté
     3. equivocarse no dice si la cuenta existe
     4. dos personas con la misma contraseña tienen resúmenes distintos
   ============================================================ */
'use strict';

process.env.LIGAS_SECRETO = 'secreto-de-prueba-para-cuentas-1234567890';

let buenas = 0, malas = 0;
function igual(nombre, dio, esperado) {
  const a = JSON.stringify(dio), b = JSON.stringify(esperado);
  if (a === b) { buenas++; console.log('ok   ' + nombre); }
  else { malas++; console.log('MAL  ' + nombre + '\n     dio      ' + a + '\n     esperaba ' + b); }
}
function cierto(nombre, v) { igual(nombre, !!v, true); }
function falso(nombre, v) { igual(nombre, !!v, false); }

const c = require('../api/_cuentas.js');

(async function () {

  /* ============ 1. LA CONTRASEÑA NO SE GUARDA ============
     Es LA prueba. Si esta se rompe, un vistazo al panel de Stripe
     entrega las contraseñas de los clientes. */
  {
    const CLAVE = 'una contraseña larga y decente';
    const m = await c.paraCrear(CLAVE);

    igual('la contraseña NO aparece en lo que se guarda',
      JSON.stringify(m).indexOf(CLAVE), -1);
    /* ni un pedazo de ella */
    igual('ni un pedazo suyo', JSON.stringify(m).toLowerCase().indexOf('contraseña'), -1);
    cierto('lo que se guarda es un resumen en hexadecimal', /^[0-9a-f]{64}$/.test(m[c.CAMPO_HASH]));
    cierto('con su sal propia, también en hexadecimal', /^[0-9a-f]{32}$/.test(m[c.CAMPO_SAL]));

    /* y el resumen SÍ reconoce la contraseña buena */
    cierto('la contraseña buena entra', await c.contrasenaValida(m, CLAVE));
    falso('una parecida no', await c.contrasenaValida(m, 'una contraseña larga y decent'));
    falso('ni la vacía', await c.contrasenaValida(m, ''));
    falso('ni un nulo', await c.contrasenaValida(m, null));
  }

  /* ============ 2. DOS PERSONAS, LA MISMA CONTRASEÑA ============
     Sin sal propia, dos resúmenes iguales delatarían que comparten
     contraseña, y una sola tabla los abriría a los dos. */
  {
    const CLAVE = 'la misma de los dos';
    const a = await c.paraCrear(CLAVE);
    const b = await c.paraCrear(CLAVE);
    cierto('las sales son distintas', a[c.CAMPO_SAL] !== b[c.CAMPO_SAL]);
    cierto('y por eso los resúmenes también', a[c.CAMPO_HASH] !== b[c.CAMPO_HASH]);
    cierto('pero la contraseña abre las dos', await c.contrasenaValida(a, CLAVE));
    cierto('las dos, de verdad', await c.contrasenaValida(b, CLAVE));
  }

  /* ============ 3. NACE SIN VERIFICAR ============
     El dueño lo pidió así: el código se manda las veces que haga
     falta hasta que confirme. Antes de eso la cuenta existe pero
     no abre. */
  {
    const m = await c.paraCrear('otra contraseña buena');
    falso('una cuenta recién creada NO está verificada', c.estaVerificada(m));
    cierto('pero ya cuenta como cuenta', c.tieneCuenta(m));
    cierto('y ya tiene contraseña', c.tieneContrasena(m));

    const verificada = Object.assign({}, m, c.paraVerificar());
    cierto('al confirmar el correo, queda verificada', c.estaVerificada(verificada));
    cierto('y la contraseña sigue sirviendo', await c.contrasenaValida(verificada, 'otra contraseña buena'));
  }

  /* ============ 4. EQUIVOCARSE NO DICE SI LA CUENTA EXISTE ============
     `contrasenaValida` devuelve false y NADA mas: sin cuenta, sin
     sal, sin resumen, todo da lo mismo desde fuera. Un mensaje que
     distinguiera «no existe» de «no es esa» regala la lista de
     correos registrados. */
  {
    falso('sin metadata', await c.contrasenaValida(null, 'algo'));
    falso('con metadata vacía', await c.contrasenaValida({}, 'algo'));
    falso('con resumen pero sin sal',
      await c.contrasenaValida({ [c.CAMPO_HASH]: 'a'.repeat(64) }, 'algo'));
    falso('con sal pero sin resumen',
      await c.contrasenaValida({ [c.CAMPO_SAL]: 'b'.repeat(32) }, 'algo'));
    /* una cuenta de solo Google no tiene contraseña que valga */
    const soloGoogle = c.paraLigarGoogle('1234567890');
    cierto('una cuenta de Google cuenta como cuenta', c.tieneCuenta(soloGoogle));
    falso('pero no tiene contraseña', c.tieneContrasena(soloGoogle));
    falso('y ninguna contraseña la abre', await c.contrasenaValida(soloGoogle, 'lo que sea'));
  }

  /* ============ 5. QUE CONTRASEÑA SE ACEPTA ============ */
  {
    igual('una decente pasa', c.porQueNoSirve('doce caracteres'), null);
    igual('la de ocho justos pasa', c.porQueNoSirve('12345678'), null);
    cierto('una de siete no', !!c.porQueNoSirve('1234567'));
    cierto('la vacía tampoco', !!c.porQueNoSirve(''));
    cierto('ni un nulo', !!c.porQueNoSirve(null));
    /* el tope existe para que nadie ponga a scrypt a trabajar de gratis */
    cierto('una de un megabyte se rechaza', !!c.porQueNoSirve('x'.repeat(1000000)));
    falso('y ni siquiera se intenta resumir',
      await c.contrasenaValida({ [c.CAMPO_HASH]: 'a'.repeat(64), [c.CAMPO_SAL]: 'b'.repeat(32) },
        'x'.repeat(1000000)));
    /* el mensaje lo lee una persona, no un programador */
    cierto('el mensaje dice qué hacer', /contraseña/i.test(c.porQueNoSirve('123')));
    falso('y no nombra variables de entorno', /[A-Z_]{4,}=/.test(c.porQueNoSirve('123')));
  }

  /* ============ 6. EL CORREO SE NORMALIZA ============
     Comprobado contra la cuenta real de Stripe: su filtro de correo
     distingue mayúsculas. Sin esto, «Ana@x.mx» y «ana@x.mx» serían
     dos cuentas y la segunda no encontraría a la primera. */
  {
    igual('a minúsculas y sin espacios',
      c.normalizaCorreo('  Ana.Ruiz@Ejemplo.MX  '), 'ana.ruiz@ejemplo.mx');
    igual('un nulo da vacío', c.normalizaCorreo(null), '');
    cierto('un correo normal pasa', c.correoValido('ana@ejemplo.mx'));
    cierto('con mayúsculas también', c.correoValido('Ana@Ejemplo.MX'));
    falso('sin arroba no', c.correoValido('ana.ejemplo.mx'));
    falso('sin dominio tampoco', c.correoValido('ana@'));
    falso('ni sin punto', c.correoValido('ana@ejemplo'));
    falso('ni el vacío', c.correoValido(''));
    falso('ni con espacios adentro', c.correoValido('an a@ejemplo.mx'));
  }

  /* ============ 7. CAMBIAR LA CONTRASEÑA ============ */
  {
    const antes = await c.paraCrear('la vieja de siempre');
    const despues = Object.assign({}, antes, await c.paraCambiar('la nueva y distinta'));

    cierto('la nueva abre', await c.contrasenaValida(despues, 'la nueva y distinta'));
    falso('la vieja ya no', await c.contrasenaValida(despues, 'la vieja de siempre'));
    /* sal nueva: si se reusara, un resumen igual delataría que la nueva
       contraseña es la misma de antes.

       Se compara DOS CAMBIOS ENTRE SI, no contra la sal vieja. Probando en
       rojo salió que la primera versión de esta prueba no cazaba nada: con
       una sal fija en el código, seguía siendo distinta de la vieja y la
       prueba pasaba feliz. La propiedad de verdad es que la sal sea NUEVA
       cada vez, y eso solo se ve comparando dos cambios seguidos. */
    cierto('y estrena sal', antes[c.CAMPO_SAL] !== despues[c.CAMPO_SAL]);
    const otroCambio = await c.paraCambiar('la nueva y distinta');
    cierto('sal nueva CADA VEZ, no una fija en el código',
      despues[c.CAMPO_SAL] !== otroCambio[c.CAMPO_SAL]);
    cierto('y por eso la misma contraseña da dos resúmenes distintos',
      despues[c.CAMPO_HASH] !== otroCambio[c.CAMPO_HASH]);
    /* lo mismo al CREAR, que es el camino que recorre todo cliente nuevo */
    const uno = await c.paraCrear('idéntica para los dos');
    const dos = await c.paraCrear('idéntica para los dos');
    cierto('al crear también, sal nueva cada vez', uno[c.CAMPO_SAL] !== dos[c.CAMPO_SAL]);
  }

  /* ============ 8. LOS CAMPOS NO CHOCAN CON LOS DE LA LIGA ============
     La ficha del cliente de Stripe guarda TAMBIEN el codigo de la
     liga, en `acceso_*`. Si un campo se pisara, confirmar una cuenta
     borraria el codigo de un viaje o al reves. */
  {
    const acceso = require('../api/_acceso.js');
    const deCuenta = [c.CAMPO_HASH, c.CAMPO_SAL, c.CAMPO_VERIFICADA, c.CAMPO_GOOGLE, c.CAMPO_CREADA];
    const deLiga = [acceso.CAMPO_HASH, acceso.CAMPO_VENCE, acceso.CAMPO_INTENTOS];
    igual('ningún campo de cuenta se llama igual que uno de la liga',
      deCuenta.filter(function (x) { return deLiga.indexOf(x) >= 0; }), []);
    cierto('los de cuenta llevan su prefijo',
      deCuenta.every(function (x) { return x.indexOf('cuenta_') === 0; }));
  }

  console.log('\n' + buenas + ' buenas, ' + malas + ' malas');
  process.exit(malas ? 1 : 0);
})();
