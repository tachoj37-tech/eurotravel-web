/* ============================================================
   El codigo de entrada y la sesion de ocho horas
   ------------------------------------------------------------
       node pruebas/probar-acceso.cjs

   La liga sola ya no abre nada. Esto es lo que decide quien
   entra, asi que aqui se prueba lo que de verdad se juega:

     · el codigo sirve UNA SOLA VEZ
     · vence a los diez minutos
     · aguanta cinco intentos y no mas
     · nunca se guarda el codigo, solo su resumen
     · la sesion de A NO sirve para el cliente B
     · y a las ocho horas se acaba
   ============================================================ */
'use strict';
const acceso = require('../api/_acceso.js');

let buenas = 0, malas = 0;
function igual(nombre, dio, esperado) {
  const a = JSON.stringify(dio), b = JSON.stringify(esperado);
  if (a === b) { buenas++; console.log('ok   ' + nombre); }
  else { malas++; console.log('MAL  ' + nombre + '\n     dio      ' + a + '\n     esperaba ' + b); }
}
function cierto(nombre, v) { igual(nombre, !!v, true); }

process.env.LIGAS_SECRETO = 'secreto-de-mentiras-para-las-pruebas';
const AHORA = 1800000000000;
const MINUTO = 60000;
const HORA = 3600000;

/* ============ 1. EL CODIGO NUNCA SE GUARDA, SOLO SU RESUMEN ============
   Quien vea la metadata en el panel de Stripe no puede entrar con ella. */
(function () {
  const codigo = '123456';
  const m = acceso.paraGuardar(codigo, AHORA);
  const guardado = JSON.stringify(m);
  igual('el código NO aparece en lo que se guarda', guardado.indexOf('123456'), -1);
  cierto('lo que se guarda es un resumen largo', m[acceso.CAMPO_HASH].length >= 64);
  igual('con su vencimiento', Number(m[acceso.CAMPO_VENCE]), AHORA + acceso.VIDA_CODIGO_MS);
  igual('y el contador en cero', m[acceso.CAMPO_INTENTOS], '0');

  /* El resumen lleva el secreto adentro: sin el no se puede armar una tabla
     de los solo un millon de codigos posibles. */
  const otroSecreto = process.env.LIGAS_SECRETO;
  process.env.LIGAS_SECRETO = 'otro-secreto';
  const conOtro = acceso.paraGuardar(codigo, AHORA);
  cierto('el resumen cambia con el secreto', conOtro[acceso.CAMPO_HASH] !== m[acceso.CAMPO_HASH]);
  process.env.LIGAS_SECRETO = otroSecreto;
})();

/* ============ 2. EL CODIGO BUENO ENTRA, LOS DEMAS NO ============ */
(function () {
  const codigo = '654321';
  const m = acceso.paraGuardar(codigo, AHORA);

  igual('el código correcto entra', acceso.revisaCodigo(m, codigo, AHORA).ok, true);
  igual('otro código no', acceso.revisaCodigo(m, '654322', AHORA).ok, false);
  igual('y se acusa para subir el contador', acceso.revisaCodigo(m, '654322', AHORA).gastado, true);

  /* La gente pega «Tu codigo: 65 43 21» */
  igual('se acepta pegado con espacios', acceso.revisaCodigo(m, '65 43 21', AHORA).ok, true);
  igual('y con texto alrededor', acceso.revisaCodigo(m, 'Tu código: 654321', AHORA).ok, true);
  igual('uno incompleto no', acceso.revisaCodigo(m, '654', AHORA).ok, false);
  igual('vacío tampoco', acceso.revisaCodigo(m, '', AHORA).ok, false);
  igual('ni letras', acceso.revisaCodigo(m, 'abcdef', AHORA).ok, false);

  /* Sin codigo pedido no se entra ni con el codigo que sea */
  igual('sin código pedido, nadie entra', acceso.revisaCodigo({}, '654321', AHORA).ok, false);
  igual('y se dice que no había ninguno',
    acceso.revisaCodigo({}, '654321', AHORA).motivo, 'no hay código pedido');
  igual('un contador no sube por un código que nunca existió',
    !!acceso.revisaCodigo({}, '654321', AHORA).gastado, false);
})();

/* ============ 3. VENCE A LOS DIEZ MINUTOS ============ */
(function () {
  const codigo = '111222';
  const m = acceso.paraGuardar(codigo, AHORA);
  igual('a los 9 minutos todavía sirve', acceso.revisaCodigo(m, codigo, AHORA + 9 * MINUTO).ok, true);
  igual('a los 10 justos, en el filo', acceso.revisaCodigo(m, codigo, AHORA + 10 * MINUTO).ok, true);
  igual('a los 11, ya no', acceso.revisaCodigo(m, codigo, AHORA + 11 * MINUTO).ok, false);
  igual('y se dice que fue por vencimiento',
    acceso.revisaCodigo(m, codigo, AHORA + 11 * MINUTO).motivo, 'código vencido');
  igual('un vencido no gasta intento',
    !!acceso.revisaCodigo(m, codigo, AHORA + 11 * MINUTO).gastado, false);

  /* metadata rota: no revienta ni deja pasar */
  const rota = Object.assign({}, m); rota[acceso.CAMPO_VENCE] = 'mañana';
  igual('un vencimiento ilegible no deja pasar', acceso.revisaCodigo(rota, codigo, AHORA).ok, false);
})();

/* ============ 4. CINCO INTENTOS Y SE CIERRA ============ */
(function () {
  const codigo = '333444';
  const m = acceso.paraGuardar(codigo, AHORA);

  for (let i = 0; i < acceso.INTENTOS; i++) {
    const r = acceso.revisaCodigo(m, '000000', AHORA);
    igual('intento ' + (i + 1) + ' falla y cuenta', [r.ok, r.van], [false, i + 1]);
    m[acceso.CAMPO_INTENTOS] = String(r.van);
  }
  const cerrado = acceso.revisaCodigo(m, codigo, AHORA);
  igual('al sexto ya no abre NI CON EL CODIGO BUENO', cerrado.ok, false);
  igual('y se acusa que se agotaron', cerrado.agotado, true);
})();

/* ============ 5. UN SOLO USO ============
   `paraBorrar` es lo que se escribe al acertar. Si eso no vaciara los tres
   campos, un codigo que se quedo en el historial del correo seguiria
   abriendo la puerta sus diez minutos completos. */
(function () {
  const codigo = '555666';
  let m = acceso.paraGuardar(codigo, AHORA);
  igual('la primera vez entra', acceso.revisaCodigo(m, codigo, AHORA).ok, true);

  m = Object.assign({}, m, acceso.paraBorrar());
  igual('la segunda ya no', acceso.revisaCodigo(m, codigo, AHORA).ok, false);
  igual('porque no queda resumen', m[acceso.CAMPO_HASH], '');
  igual('ni vencimiento', m[acceso.CAMPO_VENCE], '');
  igual('ni contador', m[acceso.CAMPO_INTENTOS], '');
})();

/* ============ 6. LOS CODIGOS NO SE REPITEN NI SE ADIVINAN ============ */
(function () {
  const vistos = {};
  let repetidos = 0, malFormados = 0;
  for (let i = 0; i < 3000; i++) {
    const c = acceso.nuevoCodigo();
    if (!/^\d{6}$/.test(c)) malFormados++;
    if (vistos[c]) repetidos++;
    vistos[c] = true;
  }
  igual('los 3,000 códigos son de 6 dígitos', malFormados, 0);
  /* Con un millon de posibles y 3,000 tiradas, unas cuantas coincidencias son
     normales (paradoja del cumpleaños). Lo que importa es que no salga
     siempre el mismo ni un puñado. */
  cierto('y salen bien repartidos (' + Object.keys(vistos).length + ' distintos de 3,000)',
    Object.keys(vistos).length > 2900);
})();

/* ============ 7. LA SESION DE OCHO HORAS ============ */
(function () {
  const deAna = acceso.firmaSesion('cus_ANA', AHORA);
  const deBeto = acceso.firmaSesion('cus_BETO', AHORA);

  igual('la sesión de Ana vale para Ana', acceso.sesionValida(deAna, 'cus_ANA', AHORA), true);

  /* LA PRUEBA QUE IMPORTA: la sesion de Ana NO sirve para el viaje de Beto.
     Sin esto, quien ya verifico lo suyo entraria a lo ajeno nada mas
     cambiando la liga. */
  igual('la de Ana NO sirve para Beto', acceso.sesionValida(deAna, 'cus_BETO', AHORA), false);
  igual('ni la de Beto para Ana', acceso.sesionValida(deBeto, 'cus_ANA', AHORA), false);
  igual('ni para un cliente inventado', acceso.sesionValida(deAna, 'cus_LOQUESEA', AHORA), false);
  igual('ni sin cliente', acceso.sesionValida(deAna, '', AHORA), false);

  /* ocho horas */
  igual('a las 7 horas sigue viva', acceso.sesionValida(deAna, 'cus_ANA', AHORA + 7 * HORA), true);
  igual('a las 8 justas, en el filo', acceso.sesionValida(deAna, 'cus_ANA', AHORA + 8 * HORA), true);
  igual('a las 8 y un minuto, se acabó',
    acceso.sesionValida(deAna, 'cus_ANA', AHORA + 8 * HORA + MINUTO), false);
  igual('son las 8 horas que pidió el dueño', acceso.HORAS_SESION, 8);

  /* firmas alteradas */
  const carga = deAna.split('.')[0], firma = deAna.split('.')[1];
  igual('con la firma de otro no vale',
    acceso.sesionValida(carga + '.' + deBeto.split('.')[1], 'cus_ANA', AHORA), false);
  igual('ni con la carga cambiada',
    acceso.sesionValida(deBeto.split('.')[0] + '.' + firma, 'cus_BETO', AHORA), false);
  ['', '.', 'a.b', 'sinpunto', null].forEach(function (mala) {
    if (acceso.sesionValida(mala, 'cus_ANA', AHORA)) {
      malas++; console.log('MAL  se coló una sesión mala: ' + JSON.stringify(mala));
    }
  });
  buenas++; console.log('ok   ninguna sesión mal formada vale, y ninguna revienta');
})();

/* ============ 8. LA COOKIE ============ */
(function () {
  const c = acceso.cookieDeSesion('el-token');
  cierto('no la puede leer el JavaScript de la página', /HttpOnly/.test(c));
  cierto('solo viaja por HTTPS', /Secure/.test(c));
  cierto('y no se manda desde un sitio ajeno', /SameSite=Lax/.test(c));
  cierto('dura ocho horas', c.indexOf('Max-Age=' + (8 * 3600)) >= 0);
  cierto('la de borrar la mata', /Max-Age=0/.test(acceso.cookieBorrada()));

  /* leerla de la cabecera */
  const req = function (cookie) { return { headers: { cookie: cookie } }; };
  igual('se lee la cookie', acceso.sesionDe(req('ev=abc123')), 'abc123');
  igual('entre otras', acceso.sesionDe(req('otra=1; ev=abc123; mas=2')), 'abc123');
  /* Una cookie que se llame `xev` NO puede hacerse pasar por `ev` */
  igual('una cookie parecida no se cuela', acceso.sesionDe(req('xev=trampa')), '');
  igual('ni una que la contenga', acceso.sesionDe(req('preven=trampa')), '');
  igual('sin cookie, vacío', acceso.sesionDe(req('')), '');
  igual('sin cabeceras tampoco revienta', acceso.sesionDe({}), '');

  /* --------------------------------------------------------------
     DOS COOKIES CON EL MISMO NOMBRE: NO SE ELIGE, NO SE ABRE

     Se encontro atacando la propia liga. Antes se quedaba con LA ULTIMA,
     que es una decision arbitraria: metiendo una segunda cookie `ev`
     despues de la buena, la buena se anulaba. Nadie entra a nada ajeno con
     eso —tendria que firmarla— pero deja fuera al cliente legitimo, o lo
     mete a una sesion que no es la suya.

     Un navegador normal manda UNA. Dos es una anomalia, y ante una
     anomalia en un candado la respuesta es no abrir.
     -------------------------------------------------------------- */
  igual('dos cookies con el mismo nombre: ninguna vale',
    acceso.sesionDe(req('ev=buena; ev=mala')), '');
  igual('ni al reves', acceso.sesionDe(req('ev=mala; ev=buena')), '');
  igual('ni tres', acceso.sesionDe(req('ev=a; otra=x; ev=b; ev=c')), '');
  igual('una sola sigue valiendo', acceso.sesionDe(req('otra=x; ev=buena; mas=y')), 'buena');
})();

/* ============ 9. LA PISTA DEL CORREO ============
   Se enseña para que sepa donde buscar, sin publicar el correo de nadie. */
(function () {
  igual('se tapa el correo', acceso.pistaDeCorreo('ana@ejemplo.mx'), 'a***@ejemplo.mx');
  igual('sin importar el largo', acceso.pistaDeCorreo('mariana.robles@empresa.com.mx'),
    'm***@empresa.com.mx');
  igual('uno raro no revienta', acceso.pistaDeCorreo('sinarroba'), '');
  igual('vacío tampoco', acceso.pistaDeCorreo(''), '');
  igual('ni uno que empiece con arroba', acceso.pistaDeCorreo('@x.mx'), '');
})();

/* ============ 10. SIN LLAVE, FALLA CERRADA ============ */
(function () {
  const guardado = process.env.LIGAS_SECRETO;
  const t = acceso.firmaSesion('cus_ANA', AHORA);
  const m = acceso.paraGuardar('999888', AHORA);

  delete process.env.LIGAS_SECRETO;
  igual('sin LIGAS_SECRETO no hay llave', acceso.hayClave(), false);
  igual('no se firma sesión', acceso.firmaSesion('cus_ANA', AHORA), '');
  igual('no vale una sesión vieja', acceso.sesionValida(t, 'cus_ANA', AHORA), false);
  igual('y ningún código entra', acceso.revisaCodigo(m, '999888', AHORA).ok, false);

  process.env.LIGAS_SECRETO = guardado;
})();

console.log('\n' + buenas + ' buenas, ' + malas + ' malas');
process.exit(malas ? 1 : 0);
