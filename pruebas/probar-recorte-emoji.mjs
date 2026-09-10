/* ============================================================
   EL EMOJI PARTIDO QUE DEJABA MUDO AL BOT (10-sep-2026)
   ============================================================
   Cazado en la corrida real con el modelo de verdad. La API contestaba:

     400 · "The request body is not valid JSON: no low surrogate in
     string: line 1 column 31678 (char 31677)"

   La causa: `slice` corta por unidades de UTF-16 y un emoji ocupa DOS.
   Al recortar el historial a 220 caracteres, el corte caía a la mitad
   de un emoji y dejaba media pareja suelta. Con eso el cuerpo de la
   petición deja de ser JSON válido.

   Lo grave no es el turno que falla, es lo que viene después: el emoji
   partido vive en el HISTORIAL, y el historial se manda otra vez en
   cada turno. O sea que el cliente se queda SIN IA para siempre y
   recibe la misma frase enlatada conteste lo que conteste. En la
   corrida del 10-sep fueron 163 fallos en 51 conversaciones; de la
   `y` en adelante, casi ninguna volvió a tener IA.

   Es el mismo síntoma que el dueño reportó dos veces con sus palabras:
   «se trabó horrible» y «se vuelve muy loco».

   Empezaba justo después del resumen del viaje, que es el mensaje del
   bot con más emojis: 📋 📍 📅 🚌 🚐 🙌.
   ============================================================ */
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import { createRequire } from 'module';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.join(AQUI, '..');
const require = createRequire(pathToFileURL(path.join(RAIZ, 'x.js')).href);

let buenas = 0, malas = 0;
function ok(que, condicion) {
  if (condicion) { buenas++; console.log('ok   ' + que); }
  else { malas++; console.log('FALLA ' + que); }
}
function titulo(t) { console.log('\n== ' + t.toUpperCase() + ' =='); }

const entendedor = require('./api/_entender.js');
const agente = require('./api/_agente.js');

/* Media pareja suelta: una alta sin su baja, o una baja sin su alta.
   Es exactamente lo que hace que `JSON.stringify` produzca algo que el
   servidor no puede leer. */
const MEDIA_PAREJA = /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?:^|[^\uD800-\uDBFF])[\uDC00-\uDFFF]/;

/* El resumen de verdad que manda el bot antes del precio. */
const RESUMEN = 'Perfecto, ya tengo todo tu viaje 📋\n\n' +
  '📍 Guadalajara → Puerto Vallarta\n' +
  '📅 20 de octubre de 2026 al 22 de octubre de 2026 · 3 días\n' +
  '🚌 Sprinter · 18 personas\n' +
  '🚐 Sin movimientos: los llevamos y los traemos\n\n' +
  'En un momento te paso tu precio y la disponibilidad 🙌';

titulo('1 · así se rompía: `slice` parte el emoji');
{
  /* Se busca un corte que de verdad parta un emoji, para que la prueba
     no dependa de que yo haya contado bien los caracteres. */
  let cortesQueRompen = 0;
  for (let n = 1; n <= RESUMEN.length; n++) {
    if (MEDIA_PAREJA.test(RESUMEN.slice(0, n))) cortesQueRompen++;
  }
  ok('con `slice` hay cortes que dejan media pareja (' + cortesQueRompen + ')', cortesQueRompen > 0);
}

titulo('2 · `recorta` nunca deja media pareja, corte donde corte');
{
  let sucios = 0;
  for (let n = 1; n <= RESUMEN.length + 5; n++) {
    if (MEDIA_PAREJA.test(entendedor.recorta(RESUMEN, n))) sucios++;
  }
  ok('ningún corte de 1 a ' + (RESUMEN.length + 5) + ' deja media pareja', sucios === 0);

  /* OJO CON LA ASERCIÓN FÁCIL, que ya me engañó una vez en esta misma
     prueba: `JSON.parse(JSON.stringify(x))` pasa en verde AUNQUE haya
     media pareja. JavaScript la escribe como la secuencia de texto
     «\ud83d» —siete caracteres ASCII— y la vuelve a leer sin quejarse,
     así que ni el redondeo por JSON ni la codificación en UTF-8 delatan
     nada. Quien se queja es el servidor, y su reclamo es literal:
     «no low surrogate in string».

     Entonces lo que hay que medir es el TEXTO que viaja: que no lleve
     una escapada alta sin su baja detrás. */
  const ESCAPADA_SUELTA = /\\u[dD][89abAB][0-9a-fA-F]{2}(?!\\u[dD][c-fC-F][0-9a-fA-F]{2})/;
  let rotos = 0;
  for (let n = 1; n <= RESUMEN.length + 5; n++) {
    const cuerpo = JSON.stringify({ t: entendedor.recorta(RESUMEN, n) });
    if (ESCAPADA_SUELTA.test(cuerpo)) rotos++;
  }
  ok('ningún cuerpo lleva una escapada alta sin su baja', rotos === 0);

  /* Y la contraprueba, para que se vea que la medida sirve: con `slice`
     el mismo texto sí produce cuerpos que el servidor rechaza. */
  let conSlice = 0;
  for (let n = 1; n <= RESUMEN.length; n++) {
    if (ESCAPADA_SUELTA.test(JSON.stringify({ t: RESUMEN.slice(0, n) }))) conSlice++;
  }
  ok('con `slice` sí los produce (' + conSlice + ' de ' + RESUMEN.length + ')', conSlice > 0);
}

titulo('3 · lo que no tiene emoji se recorta igual que antes');
{
  const texto = 'Guadalajara a Puerto Vallarta del 20 al 22 de octubre con dieciocho personas';
  ok('corta a la medida pedida', entendedor.recorta(texto, 20) === texto.slice(0, 20));
  ok('si cabe, no toca nada', entendedor.recorta(texto, 500) === texto);
  ok('un texto vacío sigue vacío', entendedor.recorta('', 10) === '');
  ok('null y undefined dan cadena vacía',
    entendedor.recorta(null, 10) === '' && entendedor.recorta(undefined, 10) === '');
  ok('un número se vuelve su texto', entendedor.recorta(2026, 10) === '2026');
}

titulo('4 · el emoji entero sí cabe cuando hay lugar');
{
  const s = entendedor.recorta('viaje 📋', 8);
  ok('«viaje 📋» completo a 8 caracteres', s === 'viaje 📋');
  const corto = entendedor.recorta('viaje 📋', 7);
  ok('a 7 se va el emoji entero, no la mitad', corto === 'viaje ' && !MEDIA_PAREJA.test(corto));
}

titulo('5 · el historial del agente ya no guarda medias parejas');
{
  /* El camino real: el bot manda el resumen, se guarda en el historial
     y de ahí sale recortado a 220 en cada turno siguiente. */
  agente.olvidaTodo();
  const cliente = '5213366679999';
  /* Un texto largo que además termine en emoji: obliga al corte. */
  const largo = RESUMEN + ' ' + RESUMEN + ' ' + RESUMEN;
  agente.recuerda(cliente, 'bot', largo);
  agente.recuerda(cliente, 'cliente', 'ok 👍');
  const h = agente.historialDe(cliente);
  ok('el historial guardó los dos turnos', h.length === 2);
  let sucios = 0;
  for (const t of h) if (MEDIA_PAREJA.test(String(t.texto))) sucios++;
  ok('ningún turno guardado tiene media pareja', sucios === 0);

  /* Y sembrarlo desde el almacén, que es el otro camino de entrada. */
  agente.olvidaTodo();
  agente.siembraHistorial(cliente, [{ de: 'bot', texto: largo }, { de: 'cliente', texto: 'va 🙌' }]);
  let sucios2 = 0;
  for (const t of agente.historialDe(cliente)) if (MEDIA_PAREJA.test(String(t.texto))) sucios2++;
  ok('el historial sembrado tampoco', sucios2 === 0);
}

console.log('\n' + buenas + ' buenas, ' + malas + ' malas');
process.exit(malas ? 1 : 0);
