/* ============================================================
   EL SEGUNDO i6, EL DE 51 (10-sep-2026) · Y CÓMO LO VE EL CHAT (16-sep)
   ============================================================
   El dueño tiene DOS Irizar i6 —uno de 47 y otro de 51, «de éste solo
   hay 1»— y el de 51 no estaba en el catálogo. Se descubrió leyendo su
   Excel: el rótulo «NEOBUS/i6 50/51 PAX» nombraba un i6 de 51 que en el
   sistema no existía.

   Dictados del 10-sep, que siguen valiendo PARA EL CATÁLOGO DEL SITIO:

     «en el bot sí va, solo en la página déjalo como pendiente»
     «ponle que no hay fotos del i6 de 51, pero ofrécelo»

   Y lo que se rompe solo si nadie lo cuida:

   1 · Su PRECIO sale de la columna del Neobus, no de la del i6 de 47.
       A Chapala son $13,000 contra $12,000 — mil pesos por viaje.
   2 · Dos camiones llamados «Irizar i6» en el catálogo mezclarían los
       precios aprendidos, que se guardan por NOMBRE de unidad.

   CAMBIÓ DE LADO EL 16-sep-2026, EN EL CHAT. Dictado del dueño: «el
   irizar i6 júntalo, o sea refiérete a él como irizar i6 47 y 51
   pasajeros, lo mismo con el century. Esto solo aplica en el chat». Así
   que el catálogo del sitio sigue con los dos (dos columnas del Excel),
   pero el bot —página y WhatsApp— habla de UNA unidad «Irizar i6 — 47 y
   51 pasajeros», con las fotos como suyas (ya no «prestadas»), y cabe un
   grupo si cabe en la grande. Lo mismo el Century: «47 y 49».
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
/* El catálogo del SITIO, tal cual (bot.js ya lo cargó en window). */
const sitio = (global.window && global.window.UNIDADES) || [];
const elDe51 = sitio.filter(function (u) { return u.id === 'irizar-i6-51'; })[0];
const elDe47 = sitio.filter(function (u) { return u.id === 'irizar-i6'; })[0];
/* Y lo que ve el chat. */
const chat = bot.UNIDADES || [];
const i6Chat = chat.filter(function (u) { return u.id === 'irizar-i6'; })[0];
const centuryChat = chat.filter(function (u) { return u.id === 'irizar'; })[0];

/* Lleva la conversación hasta el paso de escoger camión y contesta `m`. */
function escoge(m, gente) {
  let e = null, r = null;
  for (const p of ['quiero un camion a vallarta', 'somos ' + (gente || 45),
    '20 de noviembre', '22 de noviembre', m]) {
    r = bot.respuestaA(p, e, HOY); e = r.estado;
  }
  return r;
}

titulo('en el catálogo del sitio sigue, con sus dos banderas');
{
  ok('existe', !!elDe51);
  ok('es de 51 pasajeros', elDe51 && elDe51.max === 51);
  ok('es autobús', elDe51 && elDe51.cat === 'autobus');
  ok('ya no lleva `soloBot`', elDe51 && !elDe51.soloBot);
  ok('lleva `soloCotizador`: en el cotizador sí, en la galería no',
    elDe51 && elDe51.soloCotizador === true);
  ok('lleva `sinFotos`: sigue sin fotos suyas', elDe51 && elDe51.sinFotos === true);
  ok('NO se cotiza solo en línea', elDe51 && elDe51.cotizadorAutomatico === false);
  ok('el i6 de 47 sigue ahí, de 47', elDe47 && elDe47.max === 47);
  ok('  y sí sale en la página', elDe47 && !elDe47.soloBot);
  const nombres = sitio.map(function (u) { return u.name; });
  ok('ningún nombre se repite en el catálogo', new Set(nombres).size === nombres.length);
  ok('el de 51 lleva el 51 en el nombre', elDe51 && /51/.test(elDe51.name));
}

titulo('la galería lo deja fuera, el cotizador no');
{
  const html = fs.readFileSync(path.join(RAIZ, 'index.html'), 'utf8');
  ok('index.html sigue filtrando las unidades `soloBot`',
    /window\.UNIDADES \|\| \[\]\)\.filter\(function \(u\) \{ return !u\.soloBot; \}\)/.test(html));
  ok('y la galería le quita además las `soloCotizador`',
    /EN_GALERIA = UNITS\.filter\(function \(u\) \{ return !u\.soloCotizador; \}\)/.test(html));
  ok('la galería se arma de esa lista', /EN_GALERIA\.forEach/.test(html));
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
  const cha51 = de('Chapala, Jal.', 'irizar-i6-51');
  const cha47 = de('Chapala, Jal.', 'irizar-i6');
  ok('a Chapala el de 51 son $13,000', cha51 && cha51.total === 13000);
  ok('  y el de 47 son $12,000', cha47 && cha47.total === 12000);
  ok('  o sea que NO comparten precio', cha51.total !== cha47.total);
}

titulo('en el chat es UNA unidad: «Irizar i6 — 47 y 51 pasajeros» (16-sep-2026)');
{
  ok('el chat no tiene un «irizar-i6-51» aparte', !chat.some(function (u) { return u.id === 'irizar-i6-51'; }));
  ok('  ni un «irizar-49»', !chat.some(function (u) { return u.id === 'irizar-49'; }));
  ok('el i6 del chat se llama «Irizar i6»', i6Chat && i6Chat.name === 'Irizar i6');
  ok('  con capacidad «47 y 51 pasajeros»', i6Chat && i6Chat.cap === '47 y 51 pasajeros');
  ok('  y su tope es 51', i6Chat && i6Chat.max === 51 && String(i6Chat.asientos) === '47 y 51');
  ok('el Century del chat es «47 y 49 pasajeros» con tope 49',
    centuryChat && centuryChat.cap === '47 y 49 pasajeros' && centuryChat.max === 49);
  ok('el catálogo del sitio NO cambió', elDe47.cap === '47 pasajeros' && elDe47.max === 47);

  /* A un grupo de 50 se le ofrece el i6 (por el de 51), nombrado una vez. */
  let e = null, r = null;
  for (const m of ['quiero un camion a vallarta', 'somos 50', '20 de noviembre', '22 de noviembre']) {
    r = bot.respuestaA(m, e, HOY); e = r.estado;
  }
  ok('el bot le ofrece el i6 a un grupo de 50', /Irizar i6\*/.test(r.texto));
  ok('  nombrado con sus dos capacidades', /47 y 51/.test(r.texto));
  ok('  y no aparece «Irizar i6 51»', !/i6 51/.test(r.texto));
}

titulo('«el i6» escoge el i6, sin preguntar cuál');
{
  ok('«el i6» con 45 escoge el i6', escoge('el i6', 45).estado.unidadNombre === 'Irizar i6');
  ok('«el i6 de 51» es el mismo', escoge('el i6 de 51', 45).estado.unidadNombre === 'Irizar i6');
  ok('«el i6 de 47» también', escoge('el i6 de 47', 45).estado.unidadNombre === 'Irizar i6');
  ok('con 50 personas «el i6» sigue siendo el i6', escoge('el i6', 50).estado.unidadNombre === 'Irizar i6');
  /* De 51 asientos hay TRES: G8, i6S e i6. «El de 51» no dice cuál. */
  const de51 = escoge('el de 51', 45);
  ok('«el de 51» no escoge por él: hay tres de 51', !de51.estado.unidadNombre);
  ok('  y pregunta solo entre los de 51',
    /De 51 tengo 3/.test(de51.texto) && (de51.opciones || []).length === 3);
  ok('«somos 51» no escoge ningún camión', !bot.unidadPorNombre('somos 51'));
}

titulo('los demás camiones se siguen escogiendo igual');
{
  const casos = [
    ['Irizar i6S', 'Irizar i6S'], ['el i6s', 'Irizar i6S'],
    ['Irizar i6 51', 'Irizar i6'], ['Irizar i6', 'Irizar i6'],
    ['el pb', 'Irizar PB'], ['el neobus', 'Neobus'],
    ['el marcopolo', 'Marcopolo Paradiso G8'], ['el g8', 'Marcopolo Paradiso G8'],
    ['el century de 47', 'Irizar Century'], ['el century de 49', 'Irizar Century'],
    ['el century', 'Irizar Century']
  ];
  for (const [dice, espera] of casos) {
    ok('«' + dice + '» → ' + espera, escoge(dice, 45).estado.unidadNombre === espera);
  }
  /* «el irizar» le queda a varios: se sigue preguntando. */
  ok('«el irizar» no escoge ninguno', !escoge('el irizar', 45).estado.unidadNombre);
}

titulo('las fotos del i6 son suyas: ya no hay «prestadas» en el chat');
{
  const n = bot.mediosDe('irizar-i6');
  ok('el i6 enseña sus fotos', n && !n.prestadas && /Ésta es la/.test(n.texto));
  ok('  y sus archivos son los suyos', n && n.fotos.every(function (f) { return /irizar-i6\//.test(f); }));
  ok('  nombrándose con sus dos capacidades', n && /47 y 51 pasajeros/.test(n.texto));
  ok('  sin disculparse por fotos que no tiene', n && !/no tengo fotos/i.test(n.texto));
}

console.log('\n' + buenas + ' buenas, ' + malas + ' malas');
process.exit(malas ? 1 : 0);
