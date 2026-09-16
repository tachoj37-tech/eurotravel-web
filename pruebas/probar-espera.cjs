/* ============================================================
   El camioncito en TODOS los tiempos de espera
   ------------------------------------------------------------
       node pruebas/probar-espera.cjs

   LO PIDIÓ EL DUEÑO el 15-sep-2026, con estas palabras:

     «en todos los tiempos de espera, pongas el camioncito que
      tenemos, el camioncito que se pone al iniciar la página.
      Veo que hay un botón de omitir. Si la animación de ese botón
      es opcional, pues no, nomás úsala cuando tengas que de verdad
      recargar.»

   Son dos cosas y esta prueba cuida las dos:

   1 · UN SOLO CAMIONCITO PARA TODA LA ESPERA. Antes había una
       ruedita gris genérica —`.precio-cargando i`, un borde con
       `border-top-color` dando vueltas— en la caja del precio, y
       en los demás lados no había NADA: el botón nada más cambiaba
       de letras. Ahora hay un solo ayudante, `htmlEspera()`, y
       todos los lados lo llaman.

   2 · LA ENTRADA CORRE UNA VEZ POR VISITA. La animación de entrada
       es bonita la primera vez y es un estorbo en la segunda. Se
       recuerda en `sessionStorage`, y se marca AL EMPEZAR: quien
       recarga a media animación ya la vio.

   Se lee el HTML como texto, igual que `probar-pantallas.cjs`: sin
   navegador y sin dependencias.
   ============================================================ */
'use strict';
const fs = require('fs');
const path = require('path');

let buenas = 0, malas = 0;
function igual(nombre, dio, esperado) {
  const a = JSON.stringify(dio), b = JSON.stringify(esperado);
  if (a === b) { buenas++; console.log('ok   ' + nombre); }
  else { malas++; console.log('MAL  ' + nombre + '\n     dio      ' + a + '\n     esperaba ' + b); }
}
function cierto(nombre, v) { igual(nombre, !!v, true); }

function lee(nombre) {
  return fs.readFileSync(path.join(__dirname, '..', nombre), 'utf8');
}

const INDEX = lee('index.html');
const VIAJE = lee('viaje.html');

/* Los comentarios NO cuentan: si no, un comentario que explica qué se
   quitó pondría la prueba en rojo justo por explicarlo. */
function sinComentarios(html) {
  return html.replace(/<!--[\s\S]*?-->/g, ' ').replace(/\/\*[\s\S]*?\*\//g, ' ');
}

const INDEX_S = sinComentarios(INDEX);
const VIAJE_S = sinComentarios(VIAJE);

/* ============================================================
   1 · EL AYUDANTE EXISTE Y ES UNO SOLO
   ============================================================ */

[['index.html', INDEX_S], ['viaje.html', VIAJE_S]].forEach(function (par) {
  const nombre = par[0], html = par[1];

  cierto(nombre + ': existe el ayudante htmlEspera()',
    /function\s+htmlEspera\s*\(/.test(html));

  /* El camioncito se dibuja UNA VEZ por archivo. Si aparece dos veces es
     que alguien copió el SVG en lugar de llamar al ayudante, y el día que
     se retoque el camión uno de los dos se va a quedar viejo. */
  const dibujos = (html.match(/viewBox="0 0 49 18"/g) || []).length;
  igual(nombre + ': el camioncito chico se dibuja una sola vez', dibujos, 1);

  /* Ligero: va dentro del HTML, no pide archivos ni imágenes. */
  const svg = html.slice(html.indexOf('viewBox="0 0 49 18"'),
                         html.indexOf('viewBox="0 0 49 18"') + 1600);
  cierto(nombre + ': el camioncito es SVG en línea, sin pedir archivos',
    !/<img|url\(|\.svg|\.png|\.gif/.test(svg));

  /* Las ruedas giran y el camino corre: es el mismo camión de la entrada. */
  cierto(nombre + ': el camioncito trae ruedas que giran', /espera-rueda/.test(html));
  cierto(nombre + ': el camioncito trae su camino', /espera-camino/.test(html));
  cierto(nombre + ': la rueda usa la animación spinW',
    /\.espera-rueda\s*\{[^}]*animation:\s*spinW/.test(html));
  cierto(nombre + ': el archivo define el giro spinW',
    /@keyframes\s+spinW/.test(html));

  /* Con `prefers-reduced-motion` el camión se queda quieto: se ve, pero
     no se mueve. Quien pidió que nada se mueva no tiene por qué recibir
     un camión dando vueltas. */
  const quietos = html.match(/@media\s*\(prefers-reduced-motion:\s*reduce\)\s*\{[\s\S]*?\n\s*\}/g) || [];
  cierto(nombre + ': con movimiento reducido el camioncito se queda quieto',
    quietos.some(function (b) { return /\.espera-rueda/.test(b) && /animation:\s*none/.test(b); }));

  /* En un teléfono chico el renglón se parte en lugar de desbordarse. */
  cierto(nombre + ': la espera se acomoda en pantalla chica',
    /\.espera\s*\{[^}]*flex-wrap:\s*wrap/.test(html));
});

/* ============================================================
   2 · NO QUEDA NINGUNA RUEDITA GENÉRICA
   ============================================================ */

cierto('index.html: ya no existe la ruedita de la caja del precio',
  !/precio-cargando/.test(INDEX_S));

cierto('index.html: ningún borde girando hace de ruedita',
  !/border-top-color:\s*var\(--red\)[^}]*animation/.test(INDEX_S));

/* El defecto que se está cerrando: una espera que solo cambia las letras
   del botón y no enseña el camioncito. Si alguien agrega una nueva, esta
   línea la caza. */
const VERBOS = 'Mandando|Abriendo el pago|Calculando|Creando|Entrando|Confirmando|Guardando|Obteniendo|Comprobando|Buscando';
const soloLetras = new RegExp('\\.textContent\\s*=\\s*\'(' + VERBOS + ')[^\']*…\'', 'g');

igual('index.html: ninguna espera se queda en puras letras',
  (INDEX_S.match(soloLetras) || []), []);
igual('viaje.html: ninguna espera se queda en puras letras',
  (VIAJE_S.match(soloLetras) || []), []);

/* ============================================================
   3 · CADA ESPERA LLAMA AL CAMIONCITO, CON SU TEXTO DE SIEMPRE
   ------------------------------------------------------------
   Los textos NO cambian: lo único que cambia es lo que se ve.
   ============================================================ */

const ESPERAS_INDEX = [
  ['la caja del precio', 'Calculando kilómetros…'],
  ['la solicitud al vendedor', 'Mandando…'],
  ['el paso a Stripe', 'Abriendo el pago…'],
  ['el recálculo del paso 2', 'Calculando…'],
  ['la ubicación del navegador', 'Obteniendo…'],
  ['crear la cuenta', 'Creando…'],
  ['entrar a la cuenta', 'Entrando…'],
  ['confirmar el código', 'Confirmando…'],
  ['guardar la contraseña', 'Guardando…'],
  ['traer sus viajes', 'Buscando tus viajes…']
];

ESPERAS_INDEX.forEach(function (e) {
  cierto('index.html: ' + e[0] + ' enseña el camioncito',
    INDEX_S.indexOf("htmlEspera('" + e[1] + "'") >= 0);
});

/* La vuelta de Stripe: mientras se le pregunta al banco, el cuadro verde
   tiene que enseñar el camión y no un texto suelto. */
cierto('index.html: la vuelta de Stripe enseña el camioncito mientras confirma',
  /pago-hecho-texto[\s\S]{0,400}?htmlEspera\(/.test(INDEX_S) ||
  /htmlEspera\([\s\S]{0,200}?\/api\/confirmar/.test(INDEX_S));

const ESPERAS_VIAJE = [
  ['la carga de su viaje', 'Buscando tu viaje…'],
  ['el paso a Stripe del abono', 'Abriendo el pago…'],
  ['la comprobación del código', 'Comprobando…'],
  ['el reenvío del código', 'Mandando…']
];

ESPERAS_VIAJE.forEach(function (e) {
  cierto('viaje.html: ' + e[0] + ' enseña el camioncito',
    VIAJE_S.indexOf("htmlEspera('" + e[1] + "'") >= 0);
});

/* Sin guion, `viaje.html` tiene que seguir diciendo lo mismo que hoy: la
   página entera la pinta el guion, pero ese renglón es lo único que ve
   quien llega con JavaScript apagado. No se le quita. */
cierto('viaje.html: sin guion sigue diciendo «Buscando tu viaje…»',
  /<p class="cargando">Buscando tu viaje…<\/p>/.test(VIAJE));

/* ============================================================
   4 · LA ANIMACIÓN DE ENTRADA: UNA VEZ POR VISITA
   ============================================================ */

cierto('index.html: la animación de entrada sigue existiendo',
  /<div id="intro">/.test(INDEX) && /class="intro-bus"/.test(INDEX));

cierto('index.html: el botón «Saltar» sigue ahí',
  /class="intro-skip"[^>]*id="skip"[^>]*>Saltar</.test(INDEX));

const bloqueIntro = INDEX_S.slice(
  INDEX_S.indexOf('var intro = byId(\'intro\')'),
  INDEX_S.indexOf('var VIEWS =')
);

cierto('index.html: se acuerda de la visita en sessionStorage',
  /sessionStorage\.getItem\('et_intro'\)/.test(bloqueIntro));

cierto('index.html: leer el recuerdo va dentro de try/catch',
  /try\s*\{[^}]*sessionStorage\.getItem\('et_intro'\)[^}]*\}\s*catch/.test(bloqueIntro));

cierto('index.html: si no hay recuerdo, la animación corre (lado seguro)',
  /var\s+vista\s*=\s*false\s*;/.test(bloqueIntro));

cierto('index.html: la segunda carga se salta la animación',
  /if\s*\(vista\s*\|\|\s*reduce\)\s*\{[\s\S]{0,220}?removeChild\(intro\)/.test(bloqueIntro));

/* Se marca AL EMPEZAR, no al acabar. Antes el recuerdo se escribía en
   `endIntro()`: quien recargaba al segundo y medio no había llegado ahí
   y volvía a ver la animación completa. */
const ramaQueCorre = bloqueIntro.slice(bloqueIntro.indexOf('} else {'));
cierto('index.html: el recuerdo se marca al EMPEZAR la animación',
  /marcaIntroVista\(\)/.test(ramaQueCorre) && /setTimeout\(endIntro/.test(ramaQueCorre));

igual('index.html: el recuerdo se escribe en un solo lugar',
  (INDEX_S.match(/sessionStorage\.setItem\('et_intro'/g) || []).length, 1);

cierto('index.html: escribir el recuerdo va dentro de try/catch',
  /function\s+marcaIntroVista[\s\S]{0,300}?try\s*\{[^}]*sessionStorage\.setItem\('et_intro'[^}]*\}\s*catch/.test(INDEX_S));

cierto('index.html: con movimiento reducido no hay animación de entrada',
  /vista\s*\|\|\s*reduce/.test(bloqueIntro));

console.log('\n' + buenas + ' buenas, ' + malas + ' malas');
process.exit(malas > 0 ? 1 : 0);
