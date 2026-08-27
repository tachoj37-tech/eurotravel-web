/* ============================================================
   El día que entre el dominio de verdad
   ------------------------------------------------------------
       node pruebas/probar-dominio.cjs

   POR QUE EXISTE ESTA PRUEBA

   El dueño avisó el 27-ago-2026 que en unos seis días la página
   pasa a su dominio real. El dominio estaba escrito a mano en una
   línea de `_defensas.js`, y de esa línea salen TRES cosas:

     1. quién puede llamar a las APIs
     2. a dónde regresa Stripe después de pagar
     3. la liga propia que va en el correo del contrato

   O sea que el día del cambio, sin tocar nada: cotizar y pagar
   contestando 403, y todos los correos mandando al dominio viejo.

   Ahora sale de `SITIO_URL`. Lo que se prueba aquí es justo eso:
   que poner la variable mueva las tres, que el `.vercel.app` NO
   se caiga de la lista —hay ligas ya mandadas apuntando ahí— y que
   una variable mal tecleada no se lleve el sitio por delante.
   ============================================================ */
'use strict';

let buenas = 0, malas = 0;
function igual(nombre, dio, esperado) {
  const a = JSON.stringify(dio), b = JSON.stringify(esperado);
  if (a === b) { buenas++; console.log('ok   ' + nombre); }
  else { malas++; console.log('MAL  ' + nombre + '\n     dio      ' + a + '\n     esperaba ' + b); }
}
function cierto(nombre, v) { igual(nombre, !!v, true); }
function falso(nombre, v) { igual(nombre, !!v, false); }

const RUTA = require.resolve('../api/_defensas.js');
const VERCEL = 'https://eurotravel-web.vercel.app';
const REAL = 'https://eurotravel.com.mx';

/* Carga el módulo de cero con las variables que se le den. Hay que borrarlo
   de la caché porque la lista se arma al cargar, una sola vez —que es lo
   correcto en producción: no se recalcula en cada petición—. */
function conEntorno(vars) {
  const antes = {};
  ['SITIO_URL', 'ORIGENES_EXTRA', 'VERCEL_ENV'].forEach(function (k) {
    antes[k] = process.env[k];
    if (vars && Object.prototype.hasOwnProperty.call(vars, k)) {
      if (vars[k] === null) delete process.env[k]; else process.env[k] = vars[k];
    } else {
      delete process.env[k];
    }
  });
  delete require.cache[RUTA];
  const mod = require(RUTA);
  /* se deja el entorno como estaba, para no contagiar a la prueba siguiente */
  Object.keys(antes).forEach(function (k) {
    if (antes[k] === undefined) delete process.env[k]; else process.env[k] = antes[k];
  });
  return mod;
}

function req(headers) { return { headers: headers || {}, method: 'POST' }; }

/* ============ 1. COMO ESTA HOY ============ */
{
  const D = conEntorno({ VERCEL_ENV: 'production' });
  igual('sin SITIO_URL, el sitio sigue siendo el de Vercel', D.PERMITIDOS[0], VERCEL);
  igual('y no hay nada más en producción', D.PERMITIDOS, [VERCEL]);
}

/* ============ 2. EL DIA DEL CAMBIO ============
   Ésta es LA prueba: una variable, y se mueven las tres cosas. */
{
  const D = conEntorno({ SITIO_URL: REAL, VERCEL_ENV: 'production' });

  igual('el dominio real manda', D.PERMITIDOS[0], REAL);
  cierto('el dominio real puede llamar a las APIs',
    D.origenValido(req({ origin: REAL })));
  igual('Stripe regresa al dominio real', D.sitioDe(req({ origin: REAL })), REAL);

  /* 3 · la liga del correo. El webhook la arma con PERMITIDOS[0] porque
     Stripe no manda Origin: si esto se rompe, el cliente recibe su contrato
     con una liga al dominio viejo y nadie se entera hasta que se queje. */
  const ligas = require('../api/_ligas.js');
  process.env.LIGAS_SECRETO = process.env.LIGAS_SECRETO || 'secreto-de-prueba-1234567890';
  const liga = ligas.ligaDelViaje(D.PERMITIDOS[0], 'cs_test_1', '2026-09-10', Date.now());
  cierto('la liga del correo apunta al dominio real', liga.indexOf(REAL + '/viaje.html?t=') === 0);
}

/* ============ 3. EL .VERCEL.APP NO SE CAE ============
   Las ligas ya mandadas apuntan ahí. Un cliente que abra un correo de la
   semana pasada tiene que poder entrar. */
{
  const D = conEntorno({ SITIO_URL: REAL, VERCEL_ENV: 'production' });
  cierto('el .vercel.app sigue permitido', D.PERMITIDOS.indexOf(VERCEL) >= 0);
  cierto('y todavía puede llamar a las APIs', D.origenValido(req({ origin: VERCEL })));
  igual('pero ya no es el que sale en los correos', D.PERMITIDOS[0], REAL);
  igual('quien llegue por el viejo, regresa al viejo',
    D.sitioDe(req({ origin: VERCEL })), VERCEL);
}

/* ============ 4. EL www ============ */
{
  const D = conEntorno({
    SITIO_URL: REAL, ORIGENES_EXTRA: 'https://www.eurotravel.com.mx', VERCEL_ENV: 'production'
  });
  cierto('el www también entra', D.origenValido(req({ origin: 'https://www.eurotravel.com.mx' })));
  igual('sin quitarle el primer lugar al de verdad', D.PERMITIDOS[0], REAL);
  igual('y varios separados por coma', conEntorno({
    SITIO_URL: REAL, ORIGENES_EXTRA: ' https://www.eurotravel.com.mx , https://eurotravel.mx ',
    VERCEL_ENV: 'production'
  }).PERMITIDOS, [REAL, 'https://www.eurotravel.com.mx', 'https://eurotravel.mx', VERCEL]);
}

/* ============ 5. UNA VARIABLE MAL TECLEADA NO TUMBA EL SITIO ============
   Se teclea una vez, de prisa, el día del cambio. Lo que no tenga forma de
   origen se tira y se sigue con el de siempre: más vale el dominio viejo
   que ninguno. */
{
  const malos = [
    'eurotravel.com.mx',                       // sin protocolo
    'https://eurotravel.com.mx/inicio',        // con ruta
    'https://eurotravel.com.mx?x=1',           // con pregunta
    'http://eurotravel.com.mx',                // sin candado
    'javascript:alert(1)',                     // ni de broma
    '   ',
    'https://'
  ];
  const cayeron = malos.filter(function (m) {
    return conEntorno({ SITIO_URL: m, VERCEL_ENV: 'production' }).PERMITIDOS[0] !== VERCEL;
  });
  igual('ninguna variable mal escrita se vuelve el sitio', cayeron, []);

  /* ESTA ASERCION CAMBIO DE LADO, y vale la pena decir por qué.
     Nació diciendo que `https://eurotravel.com.mx/` —con barra al final— se
     tenía que TIRAR, por miedo a que armara `https://x.mx//viaje.html`. Se
     puso roja, y la roja tenía razón: `new URL(...).origin` ya devuelve el
     origen sin barra, así que el valor sale normalizado y bueno. Tirarlo
     sería rechazar el error de dedo más común del día del cambio —copiar el
     dominio del navegador, que siempre trae la barra— a cambio de nada. */
  igual('la barra al final se limpia sola, no se tira',
    conEntorno({ SITIO_URL: 'https://eurotravel.com.mx/', VERCEL_ENV: 'production' }).PERMITIDOS,
    [REAL, VERCEL]);

  /* y lo que sí trae forma buena, pasa */
  igual('un origen bien escrito sí entra',
    conEntorno({ SITIO_URL: REAL, VERCEL_ENV: 'production' }).PERMITIDOS[0], REAL);
}

/* ============ 6. LO QUE YA SE HABIA GANADO NO SE PIERDE ============
   El hueco de comparar por prefijo se pagó una vez y se comprobó contra el
   sitio publicado. Que la lista ahora venga de una variable no lo reabre. */
{
  const D = conEntorno({ SITIO_URL: REAL, VERCEL_ENV: 'production' });
  const parecidos = [
    'https://eurotravel.com.mx.malicioso.example',
    'https://eurotravel.com.mxmalicioso.example',
    'https://malicioso.example'
  ];
  const abrieron = parecidos.filter(function (d) { return D.origenValido(req({ origin: d })); });
  igual('ningún dominio parecido abre', abrieron, []);

  const desvios = parecidos.filter(function (d) {
    return D.PERMITIDOS.indexOf(D.sitioDe(req({ referer: d + '/' }))) < 0;
  });
  igual('y sitioDe no manda a ninguno de ellos', desvios, []);
}

/* ============ 7. LOCALHOST SIGUE SIN VIAJAR A PRODUCCION ============ */
{
  falso('en producción no hay localhost',
    conEntorno({ SITIO_URL: REAL, VERCEL_ENV: 'production' }).PERMITIDOS
      .some(function (o) { return o.indexOf('localhost') >= 0; }));
  cierto('fuera de producción sí',
    conEntorno({ SITIO_URL: REAL, VERCEL_ENV: 'preview' }).PERMITIDOS
      .some(function (o) { return o.indexOf('localhost') >= 0; }));
}

/* Se deja el módulo cargado como está en producción, para que no le quede
   una lista rara a lo que corra después en la misma batería. */
delete require.cache[RUTA];

console.log('\n' + buenas + ' buenas, ' + malas + ' malas');
process.exit(malas ? 1 : 0);
