/* ============================================================
   EL SEGUNDO i6, EL DE 51 (10-sep-2026)
   ============================================================
   El dueño tiene DOS Irizar i6 —uno de 47 y otro de 51, «de éste solo
   hay 1»— y el de 51 no estaba en el catálogo. Se descubrió leyendo su
   Excel: el rótulo «NEOBUS/i6 50/51 PAX» nombraba un i6 de 51 que en el
   sistema no existía.

   Sus tres dictados de ese día, que es lo que esta batería vigila:

     «en el bot sí va, solo en la página déjalo como pendiente»
     «ponle que no hay fotos del i6 de 51, pero ofrécelo»
     «si alguien pide fotos enséñale el de 47 i6, pero dile que no hay
      fotos pero que te puedo enseñar de este i6»

   Y lo que se rompe solo si nadie lo cuida:

   1 · Su PRECIO sale de la columna del Neobus, no de la del i6 de 47.
       A Chapala son $13,000 contra $12,000 — mil pesos por viaje.
   2 · Dos camiones llamados «Irizar i6» harían que «el i6» dejara de
       escoger a ninguno, y mezclarían los precios aprendidos, que se
       guardan por NOMBRE de unidad.
   3 · Las fotos prestadas NO pueden pasar por suyas. Enseñar un camión
       y entregar otro es de las pocas cosas que no se arreglan después.
   ============================================================ */
'use strict';

const fs = require('fs');
const path = require('path');
const RAIZ = path.join(__dirname, '..');
const bot = require(path.join(RAIZ, 'bot.js'));
const destinos = require(path.join(RAIZ, 'api', '_destinos.js'));

let buenas = 0, malas = 0;
function ok(que, condicion) {
  if (condicion) { buenas++; console.log('ok   ' + que); }
  else { malas++; console.log('FALLA ' + que); }
}
function titulo(t) { console.log('\n== ' + t.toUpperCase() + ' =='); }

const HOY = '2026-09-10';
const catalogo = bot.UNIDADES || [];
const elDe51 = catalogo.filter(function (u) { return u.id === 'irizar-i6-51'; })[0];
const elDe47 = catalogo.filter(function (u) { return u.id === 'irizar-i6'; })[0];

/* Lleva la conversación hasta el paso de escoger camión y contesta `m`. */
function escoge(m, gente) {
  let e = null, r = null;
  for (const p of ['quiero un camion a vallarta', 'somos ' + (gente || 45),
    '20 de noviembre', '22 de noviembre', m]) {
    r = bot.respuestaA(p, e, HOY); e = r.estado;
  }
  return r;
}

titulo('está en el catálogo, y con sus dos banderas');
{
  ok('existe', !!elDe51);
  ok('es de 51 pasajeros', elDe51 && elDe51.max === 51);
  ok('es autobús', elDe51 && elDe51.cat === 'autobus');
  ok('lleva `soloBot`: fuera de la página', elDe51 && elDe51.soloBot === true);
  ok('lleva `sinFotos`: todavía no tiene', elDe51 && elDe51.sinFotos === true);
  ok('NO se cotiza solo en línea', elDe51 && elDe51.cotizadorAutomatico === false);
  /* El i6 de 47 no se tocó. */
  ok('el i6 de 47 sigue ahí, de 47', elDe47 && elDe47.max === 47);
  ok('  y sí sale en la página', elDe47 && !elDe47.soloBot);
}

titulo('los nombres no chocan');
{
  /* Dos «Irizar i6» romperían la elección de camión Y la llave de los
     precios aprendidos, que se arma con el nombre de la unidad. */
  const nombres = catalogo.map(function (u) { return u.name; });
  ok('ningún nombre se repite en el catálogo', new Set(nombres).size === nombres.length);
  ok('el de 51 lleva el 51 en el nombre', elDe51 && /51/.test(elDe51.name));
}

titulo('la página lo deja fuera, el bot no');
{
  /* La galería y el selector del cotizador se arman de la MISMA lista,
     así que el filtro va una sola vez y cubre a los dos. */
  const html = fs.readFileSync(path.join(RAIZ, 'index.html'), 'utf8');
  ok('index.html filtra las unidades `soloBot`',
    /window\.UNIDADES \|\| \[\]\)\.filter\(function \(u\) \{ return !u\.soloBot; \}\)/.test(html));

  /* Y el bot sí lo ofrece: a un grupo de 50 tiene que aparecer. */
  let e = null, r = null;
  for (const m of ['quiero un camion a vallarta', 'somos 50', '20 de noviembre', '22 de noviembre']) {
    r = bot.respuestaA(m, e, HOY); e = r.estado;
  }
  ok('el bot lo ofrece a un grupo de 50', /Irizar i6 51/.test(r.texto));
  ok('  y no ofrece el de 47, que no les cabe', !/Irizar i6\* — 47/.test(r.texto));
}

titulo('su precio es el de la columna del Neobus, no el del i6 de 47');
{
  const de = (d, u) => destinos.preciosDeListaDeUnidad(d, u)[0];

  const vall51 = de('Puerto Vallarta, Jal.', 'irizar-i6-51');
  const vallNeo = de('Puerto Vallarta, Jal.', 'neobus');
  const vall47 = de('Puerto Vallarta, Jal.', 'irizar-i6');
  ok('a Vallarta va por «NEOBUS/i6 50/51 PAX»',
    vall51 && vall51.comoSeLlama === 'NEOBUS/i6 50/51 PAX' && vall51.total === 34000);
  ok('  el mismo renglón que el Neobus', vall51.total === vallNeo.total);
  ok('  y el de 47 va por el suyo, «PB/i6 47 pax»',
    vall47 && vall47.comoSeLlama === 'PB/i6 47 pax');

  /* En Vallarta las dos columnas dan $34,000 y el error no se notaría.
     En Chapala sí: mil pesos de diferencia por viaje. Por eso se
     comprueba en un destino donde SÍ se separan. */
  const cha51 = de('Chapala, Jal.', 'irizar-i6-51');
  const cha47 = de('Chapala, Jal.', 'irizar-i6');
  ok('a Chapala el de 51 son $13,000', cha51 && cha51.total === 13000);
  ok('  y el de 47 son $12,000', cha47 && cha47.total === 12000);
  ok('  o sea que NO comparten precio', cha51.total !== cha47.total);
}

titulo('«el i6» ya no dice cuál: se pregunta, no se adivina');
{
  /* Con 45 caben los dos, así que «el i6» es ambiguo de verdad. */
  const r = escoge('el i6', 45);
  ok('no escoge por el cliente', !r.estado.unidadNombre);
  ok('  le pregunta cuál', /Tengo dos/.test(r.texto));
  ok('  nombrando los dos con sus asientos',
    /Irizar i6 51\* — 51 pasajeros/.test(r.texto) && /Irizar i6\* — 47 pasajeros/.test(r.texto));

  /* Y si dice la capacidad, ahí sí se resuelve solo. */
  ok('«el i6 de 51» escoge el de 51', escoge('el i6 de 51', 45).estado.unidadNombre === 'Irizar i6 51');
  ok('«el de 51» también', escoge('el de 51', 45).estado.unidadNombre === 'Irizar i6 51');
  ok('«el i6 de 47» escoge el de 47', escoge('el i6 de 47', 45).estado.unidadNombre === 'Irizar i6');

  /* Con 50 personas el de 47 ni aparece, así que «el i6» no es ambiguo. */
  ok('con 50 personas «el i6» es el de 51, sin preguntar',
    escoge('el i6', 50).estado.unidadNombre === 'Irizar i6 51');
}

titulo('los demás camiones se siguen escogiendo igual');
{
  /* Ojo: «Irizar i6» es un pedazo de «Irizar i6S» y de «Irizar i6 51».
     Si el nombre más largo no ganara, escribir el nombre completo del
     i6S empataría con tres camiones y el bot preguntaría de más. */
  const casos = [
    ['Irizar i6S', 'Irizar i6S'], ['el i6s', 'Irizar i6S'],
    ['Irizar i6 51', 'Irizar i6 51'], ['Irizar i6', 'Irizar i6'],
    ['el pb', 'Irizar PB'], ['el neobus', 'Neobus'],
    ['el marcopolo', 'Marcopolo Paradiso G8'], ['el g8', 'Marcopolo Paradiso G8'],
    ['el century', 'Irizar Century']
  ];
  for (const [dice, espera] of casos) {
    ok('«' + dice + '» → ' + espera, escoge(dice, 45).estado.unidadNombre === espera);
  }
  /* «el irizar» le queda a cinco: se sigue preguntando. */
  ok('«el irizar» no escoge ninguno', !escoge('el irizar', 45).estado.unidadNombre);
}

titulo('las fotos son prestadas, y se dice de quién');
{
  const m = bot.mediosDe('irizar-i6-51');
  ok('sí contesta algo (se ofrece igual)', !!m);
  ok('las fotos son del i6 de 47', m && m.prestadas === 'irizar-i6');
  ok('  y los archivos también', m && m.fotos.every(function (f) { return /irizar-i6\//.test(f); }));
  ok('dice que de éste no hay', m && /no tengo fotos/i.test(m.texto));
  ok('  y nombra de quién son las que enseña', m && m.texto.indexOf('Irizar i6') !== -1);
  ok('  y dice los asientos de cada uno', m && /47/.test(m.texto) && /51/.test(m.texto));

  /* Lo que NO puede pasar: que las enseñe calladas, como suyas. */
  ok('NUNCA las hace pasar por suyas', m && !/Ésta es la \*Irizar i6 51\*/.test(m.texto));

  /* Y el de 47 sigue enseñando las suyas, sin disculparse. */
  const n = bot.mediosDe('irizar-i6');
  ok('el i6 de 47 enseña las suyas', n && !n.prestadas && /Ésta es la/.test(n.texto));
  ok('  y sus archivos son los suyos', n && n.fotos.every(function (f) { return /irizar-i6\//.test(f); }));
}

console.log('\n' + buenas + ' buenas, ' + malas + ' malas');
process.exit(malas ? 1 : 0);
