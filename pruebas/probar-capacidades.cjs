/* ============================================================
   Las unidades que existen en dos capacidades
   ------------------------------------------------------------
       node pruebas/probar-capacidades.cjs

   El dueño tiene dos Irizar i6 —uno de 47 y otro de 51— y dos
   Centurys —uno de 47 y otro de 49—. Son el mismo camión con
   distinto número de asientos, y hasta el 12-sep-2026 la página
   no lo decía: el i6 de 51 estaba escondido detrás de `soloBot`
   esperando fotos propias, y el Century no se le ofrecía a un
   grupo de 49.

   Dictado suyo, 12-sep-2026:

     «recuerda poner en unidades century de 49 pasajeros e i6 de
      51 pasajeros, no necesito que agregues fotos, en la misma
      pestaña de la unidad ofrece el hecho de que hay otra
      alternativa de pasajeros, sigue enseñando las mismas fotos,
      recuerda que deben mostrarse en el cotizador»

   De ahí salen las tres reglas que se prueban aquí:

     1. En el COTIZADOR van las dos capacidades, porque ahí lo que
        se elige es cuánta gente cabe.
     2. En la GALERÍA va una sola tarjeta por modelo, y su ficha
        anuncia la otra medida. Dos tarjetas idénticas confunden.
     3. Las FOTOS son las mismas. No se inventó ninguna.
   ============================================================ */
'use strict';

const fs = require('fs');
const path = require('path');

const RAIZ = path.join(__dirname, '..');

/* VA PRIMERO, antes de `cargaEnWindow`: el bot lee el catálogo de un
   `window` prestado al cargarse, y si se pide después de que esa función
   ande poniendo y quitando `global.window`, se queda sin catálogo y no
   nombra ninguna unidad. Costó una corrida en rojo entenderlo. */
const bot = require(path.join(RAIZ, 'bot.js'));

let buenas = 0, malas = 0;
function igual(nombre, dio, esperado) {
  const a = JSON.stringify(dio), b = JSON.stringify(esperado);
  if (a === b) { buenas++; console.log('ok   ' + nombre); }
  else { malas++; console.log('MAL  ' + nombre + '\n     dio      ' + a + '\n     esperaba ' + b); }
}
function cierto(nombre, v) { igual(nombre, !!v, true); }

function cargaEnWindow(archivo, llave) {
  const antes = global.window;
  global.window = global.window || {};
  delete require.cache[require.resolve(path.join(RAIZ, archivo))];
  require(path.join(RAIZ, archivo));
  const valor = global.window[llave];
  global.window = antes;
  return valor;
}

const UNIDADES = cargaEnWindow('unidades.js', 'UNIDADES') || [];
const MEDIOS = cargaEnWindow('medios-unidades.js', 'MEDIOS_UNIDADES') || {};
const html = fs.readFileSync(path.join(RAIZ, 'index.html'), 'utf8');

function porId(id) { return UNIDADES.filter(function (u) { return u.id === id; })[0] || null; }

/* Las dos listas de la página, armadas igual que en `index.html`. Si allá
   cambia el filtro y aquí no, esta prueba se pone roja — que es justo lo que
   tiene que pasar: las dos listas son la regla. */
const EN_COTIZADOR = UNIDADES.filter(function (u) { return !u.soloBot; });
const EN_GALERIA = EN_COTIZADOR.filter(function (u) { return !u.soloCotizador; });

/* ------------------------------------------------------------
   1 · EL COTIZADOR LAS OFRECE LAS DOS
   ------------------------------------------------------------ */
igual('el i6 de 51 ya está en la página', !!porId('irizar-i6-51'), true);
igual('y ya no está escondido con soloBot', !!(porId('irizar-i6-51') || {}).soloBot, false);

igual('el selector del cotizador ofrece el i6 de 51',
  EN_COTIZADOR.map(function (u) { return u.id; }).indexOf('irizar-i6-51') >= 0, true);

/* Lo que se lee en el selector es `name · cap`, así que ahí tiene que verse
   el número de asientos: es lo único que distingue una variante de la otra. */
igual('y se lee con su capacidad',
  (porId('irizar-i6-51') || {}).name + ' · ' + (porId('irizar-i6-51') || {}).cap,
  'Irizar i6 51 · 51 pasajeros');

/* ------------------------------------------------------------
   LOS DOS CENTURYS SON DOS UNIDADES — corregido el 12-sep-2026
   ------------------------------------------------------------
   Esta prueba nació diciendo que el Century era UNA unidad con dos
   medidas, «47 a 49 pasajeros», cubriendo las dos columnas del Excel.

   El dueño lo corrigió el mismo día: «irizar century 47 es uno, irizar
   century de 49 es otro… son unidades con diferentes precios, no los
   pongas en una misma unidad». Y el Excel le da la razón — en Mazatlán
   son $38,000 contra $40,000.

   Con una sola unidad para las dos columnas, el precio que salía dependía
   de cuál se leyera primero. Que sean dos no es un matiz de conteo: es de
   dónde sale el número.
   ------------------------------------------------------------ */
igual('el Century de 47 es de 47', (porId('irizar') || {}).max, 47);
igual('  y se dice así', (porId('irizar') || {}).cap, '47 pasajeros');
igual('el Century de 49 existe como unidad propia', !!porId('irizar-49'), true);
igual('  y es de 49', (porId('irizar-49') || {}).max, 49);
igual('  con su nombre, que lleva el número', (porId('irizar-49') || {}).name, 'Irizar Century 49');

/* ------------------------------------------------------------
   Y EL DE 47 NO LLEVA EL SUYO, A PROPÓSITO
   ------------------------------------------------------------
   Se probó al revés —«Irizar Century 47»— y rompió algo peor: el bot
   escoge por «una palabra que sea SUYA y de nadie más», así que el «47»
   del nombre se volvió palabra exclusiva del Century y **«el i6 de 47»
   pasaba a escoger un Century**. Otro camión y otro precio: $34,000
   contra $32,000 en Vallarta.

   Es el mismo patrón que ya seguían los dos i6: «Irizar i6» es el de 47
   e «Irizar i6 51» el otro.
   ------------------------------------------------------------ */
igual('el de 47 NO lleva el número en el nombre', (porId('irizar') || {}).name, 'Irizar Century');

/* Y esto es lo que ese nombre protege: que pedir un i6 de 47 traiga un i6. */
{
  /* El bot se carga ARRIBA DEL TODO, antes de que `cargaEnWindow` ande
     prestando y quitando `global.window`: si se carga aquí, encuentra un
     `window` sin catálogo y no nombra nada. */
  const nombra = function (t) { return (bot.unidadesQueNombra(t) || []).map(function (u) { return u.name; }); };
  /* «el i6 de 47» le queda a los dos i6 —el número lo desempata después, ya
     en la conversación—, pero lo que NUNCA puede pasar es que nombre a un
     Century. Eso es lo que rompía el «47» en el nombre. */
  igual('«el i6 de 47» no nombra a ningún Century',
    nombra('el i6 de 47').filter(function (n) { return /century/i.test(n); }), []);
  igual('  y sí a los i6', nombra('el i6 de 47'), ['Irizar i6', 'Irizar i6 51']);
  /* Y en la conversación, el «47» escoge el de 47. */
  {
    const HOY = '2026-09-10';
    let e = null, r = null;
    for (const p of ['quiero un camion a vallarta', 'somos 45', '20 de noviembre',
      '22 de noviembre', 'el i6 de 47']) { r = bot.respuestaA(p, e, HOY); e = r.estado; }
    igual('  y la conversación acaba en el i6 de 47', r.estado.unidadNombre, 'Irizar i6');
  }
  igual('«el century de 49» nombra al de 49', nombra('el century de 49'), ['Irizar Century 49']);
  /* «el century» a secas le queda a los dos: ahí el bot pregunta, no
     adivina — y que le queden los dos es justo lo que debe pasar. */
  igual('«el century» a secas le queda a los dos', nombra('el century').length, 2);
}

/* Un grupo de 49 tiene que encontrar unidad. Antes no: el Century topaba en
   48 y las de arriba empiezan en 50. */
[47, 48, 49, 50, 51].forEach(function (gente) {
  const caben = EN_COTIZADOR.filter(function (u) { return u.max >= gente; });
  igual('un grupo de ' + gente + ' encuentra unidad', caben.length > 0, true);
});

/* ------------------------------------------------------------
   1b · «Y», NO «A»: NO EXISTE NINGUNO DE 48
   ------------------------------------------------------------
   Dictado del dueño, 12-sep-2026: «esa parte del excel esta mal, century e
   i6 que tienen dos variantes ponlas con "y"».

   «47 a 49» hace creer que existe un autobús de 48, y no existe: hay uno de
   47 y otro de 49. Él ya lo había precisado para el i6 —«no hay
   alternativas de 48, 49 y 50, solo 47 y 51»— y aquí lo extendió al
   Century.

   El rótulo del Excel «BUS 48/49 PAX» SÍ sigue diciendo 48/49, y debe: es
   el mapa del dueño a su propia hoja, no algo que vea el cliente. Por eso
   esto solo mira los textos de cara al cliente.
   ------------------------------------------------------------ */
{
  /* Ninguna capacidad de cara al cliente puede decir un rango con «a»: eso
     es lo que inventa los autobuses de 48 y 50. */
  const conRango = EN_COTIZADOR
    .filter(function (u) { return /\d+\s+a\s+\d+/.test(String(u.cap) + ' ' + String(u.asientos || '')); })
    .map(function (u) { return u.id + ': ' + u.cap; });
  igual('ninguna unidad anuncia un rango con «a»', conRango, []);

  /* Y ninguna se anuncia con un número que no es el suyo. */
  const mal = EN_COTIZADOR
    .filter(function (u) { return String(u.cap).indexOf(String(u.max)) < 0; })
    .filter(function (u) { return !/hasta/i.test(u.cap); })   // la Suburban dice «Hasta 6»
    .map(function (u) { return u.id + ': ' + u.cap + ' con max ' + u.max; });
  igual('cada unidad anuncia su propia capacidad', mal, []);

  /* Los avisos de la otra variante dicen los DOS números con «y», y dicen
     que los de en medio no existen. */
  const avisoCentury = (porId('irizar') || {}).alternativa || '';
  cierto('el aviso del Century dice 47 y 49', /47 y (otro de )?49/.test(avisoCentury));
  cierto('  y que no hay de 48', /no hay de 48/.test(avisoCentury));

  const avisoI6 = (porId('irizar-i6') || {}).alternativa || '';
  cierto('el aviso del i6 dice 47 y 51', /47 y (otro de )?51/.test(avisoI6));
  cierto('  y que no hay de 48, 49 ni 50', /no hay de 48, 49 ni 50/.test(avisoI6));

  /* Lo que la IA del chat tiene dictado también se corrigió: seguía diciendo
     «El Century es de 47 a 49: se ofrece hasta con 48, con 49 ya no», que es
     la regla de cuando era una sola unidad. */
  const agente = fs.readFileSync(path.join(RAIZ, 'api', '_agente.js'), 'utf8');
  igual('a la IA ya no se le dicta la regla vieja del Century',
    /se ofrece hasta con 48/.test(agente), false);
  cierto('  y sí que son dos, de 47 y de 49', /uno de 47 y otro de 49/.test(agente));

  /* Pero el rótulo del Excel no se tocó: es el mapa del dueño. */
  const destinos = require(path.join(RAIZ, 'api', '_destinos.js'));
  igual('el rótulo del Excel sigue siendo el suyo',
    destinos.NOMBRE_DE_COLUMNA.bus4849, 'BUS 48/49 PAX');
}

/* ------------------------------------------------------------
   2 · LA GALERÍA NO SE LLENA DE TARJETAS IGUALES
   ------------------------------------------------------------ */
igual('la galería sigue con una tarjeta por modelo',
  EN_GALERIA.map(function (u) { return u.id; }),
  ['g8', 'irizar-i6s', 'irizar-i6', 'irizar-pb', 'neobus', 'irizar', 'sprinter', 'suburban']);

igual('el i6 de 51 NO tiene tarjeta propia',
  EN_GALERIA.map(function (u) { return u.id; }).indexOf('irizar-i6-51') < 0, true);

/* Y en su lugar, la ficha del modelo lo anuncia. Sin esto, la variante
   existiría en el cotizador y nadie sabría de dónde salió. */
igual('la ficha del i6 anuncia la de 51',
  /51/.test((porId('irizar-i6') || {}).alternativa || ''), true);
igual('y la del Century, la de 49',
  /49/.test((porId('irizar') || {}).alternativa || ''), true);

/* Toda unidad con `soloCotizador` tiene que estar anunciada por alguna ficha
   de la galería: si no, es una opción que aparece de la nada. */
{
  const anuncios = EN_GALERIA.map(function (u) { return u.alternativa || ''; }).join(' ');
  const huerfanas = EN_COTIZADOR
    .filter(function (u) { return u.soloCotizador; })
    .filter(function (u) { return anuncios.indexOf(String(u.max)) < 0; })
    .map(function (u) { return u.id; });
  igual('ninguna variante del cotizador aparece sin anunciarse', huerfanas, []);
}

/* La pantalla tiene dónde pintarlo, y lo pinta. */
igual('el modal tiene su renglón para la alternativa',
  (html.match(/id="m-alterna"/g) || []).length, 1);
igual('y el guion lo llena desde el catálogo',
  /alterna\.textContent\s*=\s*u\.alternativa/.test(html), true);

/* La galería se arma de `EN_GALERIA` y el selector de `UNITS`: si los dos
   volvieran a leer la misma lista, el i6 de 51 saldría como tarjeta. */
igual('la galería y el cotizador leen listas distintas',
  /EN_GALERIA\.forEach/.test(html) && /UNITS\.forEach/.test(html), true);

/* ------------------------------------------------------------
   3 · LAS FOTOS SON LAS MISMAS
   ------------------------------------------------------------
   «No necesito que agregues fotos… sigue enseñando las mismas.»
   El i6 de 51 no tiene carpeta propia y no debe tenerla: enseña
   las del de 47 y se dice de quién son, que es lo que ya estaba
   resuelto en `medios-unidades.js`.
   ------------------------------------------------------------ */
igual('el i6 de 51 sigue sin fotos propias y con las prestadas dichas',
  MEDIOS['irizar-i6-51'], { fotos: 0, video: null, prestadas: 'irizar-i6' });

igual('y en la página usa la foto del i6 de 47',
  (porId('irizar-i6-51') || {}).img, (porId('irizar-i6') || {}).img);

igual('no se inventó una carpeta de fotos para él',
  fs.existsSync(path.join(RAIZ, 'img', 'unidades', 'irizar-i6-51')), false);

/* El Century de 49 tampoco tiene fotos propias: presta las del de 47 y se
   dice, igual que el i6 de 51. */
igual('el Century de 49 presta las fotos del de 47',
  MEDIOS['irizar-49'], { fotos: 0, video: null, prestadas: 'irizar' });
igual('  y en la página usa la misma imagen',
  (porId('irizar-49') || {}).img, (porId('irizar') || {}).img);
igual('  sin inventarle carpeta',
  fs.existsSync(path.join(RAIZ, 'img', 'unidades', 'irizar-49')), false);

/* ------------------------------------------------------------
   CADA UNA CON SU COLUMNA DEL EXCEL, Y SOLO LA SUYA
   ------------------------------------------------------------
   Ésta es la razón de que sean dos unidades y no una. Si dos capacidades
   compartieran columna, el precio de una se estaría cobrando por la otra.
   ------------------------------------------------------------ */
{
  const columnas = require(path.join(RAIZ, 'api', '_destinos.js')).COLUMNA_DE_UNIDAD;

  igual('el Century de 47 lee «BUS N C 47 PAX»', columnas['irizar'], ['busNC47']);
  igual('el Century de 49 lee «BUS 48/49 PAX»', columnas['irizar-49'], ['bus4849']);
  igual('el i6 de 47 lee «PB/i6 47 pax»', columnas['irizar-i6'], ['pbI6']);
  igual('el i6 de 51 lee «NEOBUS/i6 50/51 PAX»', columnas['irizar-i6-51'], ['neobusI6']);

  /* Ninguna unidad del cotizador puede leer DOS columnas: eso es
     exactamente lo que había antes y lo que el dueño mandó deshacer. */
  const conDos = EN_COTIZADOR
    .filter(function (u) { return (columnas[u.id] || []).length > 1; })
    .map(function (u) { return u.id; });
  igual('ninguna unidad lee más de una columna', conDos, []);

  /* Y toda unidad del cotizador tiene columna declarada —aunque sea vacía,
     como la Suburban, que no tiene precios en el Excel—: una unidad sin
     entrada aquí se cotizaría en silencio como si no estuviera en la lista. */
  const sinEntrada = EN_COTIZADOR
    .filter(function (u) { return !Object.prototype.hasOwnProperty.call(columnas, u.id); })
    .map(function (u) { return u.id; });
  igual('y todas tienen su entrada declarada', sinEntrada, []);
}

console.log('\n' + buenas + ' buenas, ' + malas + ' malas');
process.exit(malas ? 1 : 0);
