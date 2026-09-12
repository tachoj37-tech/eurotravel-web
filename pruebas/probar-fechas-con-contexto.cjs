/* ============================================================
   LAS FECHAS NO VIVEN SOLAS (11-sep-2026 · fase 2)
   ============================================================
   Una fecha suelta —«el 20», «el 3»— no significa nada por sí misma.
   Significa algo por lo que se dijo antes: el mes que el cliente ya
   nombró, o la salida que ya quedó anotada. El bot resolvía cada una
   contra HOY salvo en dos lugares donde alguien se acordó de anclarla,
   y en todos los demás el día caía tres meses antes sin que nada
   tronara.

   Lo que se coló, todo cazado hablándole al bot el 11-sep-2026:

     «vamos en diciembre, somos 40» … «20»   →  20 de SEPTIEMBRE
     «un camion a vallarta en diciembre» … «20»  →  20 de SEPTIEMBRE
       y de pilón el destino quedaba en «Vallarta En Diciembre»
     salida 20-dic … «mejor salimos el 22»   →  «Anotado», y seguía el 20
     salida 20-dic … «cambia la salida al 22» →  ni eso: contestaba otra cosa

   Los dos primeros mandan el camión tres meses antes. Los dos últimos
   son peores de otra manera: el cliente VE que pidió el cambio, el bot
   le dice que sí, y el viaje sale con la fecha vieja.

   El contrato de esta batería: una fecha se lee con lo que ya se sabe,
   y una fecha puesta se corrige igual que se corrige el número de
   personas.
   ============================================================ */
'use strict';

const path = require('path');
const RAIZ = path.join(__dirname, '..');
const conv = require(path.join(RAIZ, 'bot.js'));

/* Fijo, para que la batería no cambie de resultado en año nuevo. */
const HOY = '2026-09-11';

let buenas = 0, malas = 0;
function ok(que, condicion) {
  if (condicion) { buenas++; console.log('ok   ' + que); }
  else { malas++; console.log('FALLA ' + que); }
}
function igual(que, dio, espera) {
  const bien = JSON.stringify(dio) === JSON.stringify(espera);
  if (bien) { buenas++; console.log('ok   ' + que); }
  else { malas++; console.log('FALLA ' + que + '\n       dio: ' + JSON.stringify(dio) +
    '\n       esperaba: ' + JSON.stringify(espera)); }
}
function titulo(t) { console.log('\n== ' + t.toUpperCase() + ' =='); }

/* Habla con el bot de corrido y devuelve el último estado. */
function habla(mensajes) {
  let e = null, ultimo = null;
  for (const m of mensajes) {
    ultimo = conv.respuestaA(m, e, HOY);
    e = ultimo.estado;
  }
  return { estado: e || {}, texto: (ultimo && ultimo.texto) || '' };
}

/* El camino corto hasta tener salida y regreso puestos, para no
   repetirlo en cada caso. */
const HASTA_LA_FECHA = ['hola', 'a vallarta', 'somos 40', 'de guadalajara'];

titulo('el mes dicho antes manda, lo diga donde lo diga');
{
  /* Esto ya funcionaba SOLO si el mes iba solo en su propio mensaje y
     justo en el paso de la fecha. Fuera de ahí se perdía. */
  const a = habla(HASTA_LA_FECHA.concat(['diciembre', '20']));
  igual('«diciembre» y luego «20» (ya funcionaba)', a.estado.salida, '2026-12-20');

  const b = habla(['hola', 'a vallarta', 'vamos en diciembre, somos 40',
    'de guadalajara', '20']);
  igual('el mes dicho en el paso de cuántos son', b.estado.salida, '2026-12-20');

  const c = habla(['quiero un camion a vallarta en diciembre para 40',
    'de guadalajara', '20']);
  igual('el mes dicho en el primer mensaje', c.estado.salida, '2026-12-20');
  igual('  y el mes no se queda pegado al destino', c.estado.destino, 'Puerto Vallarta');

  /* El mes NO puede ganarle a una fecha completa: si el cliente dice
     diciembre y luego «5 de enero», sale en enero. */
  const d = habla(HASTA_LA_FECHA.concat(['diciembre', '5 de enero']));
  igual('una fecha completa le gana al mes dicho', d.estado.salida, '2027-01-05');
}

titulo('una fecha puesta se corrige, no se queda clavada');
{
  const base = HASTA_LA_FECHA.concat(['20 de diciembre', 'el 23']);

  const a = habla(base.concat(['mejor salimos el 22']));
  igual('«mejor salimos el 22» mueve la salida', a.estado.salida, '2026-12-22');
  igual('  y no toca el regreso', a.estado.regreso, '2026-12-23');
  ok('  y lo dice', /22 de diciembre/.test(a.texto));

  const b = habla(base.concat(['2 movimientos', 'cambia la salida al 22 porfa']));
  igual('se puede corregir ya en el paso de escoger camión', b.estado.salida, '2026-12-22');

  const c = habla(base.concat(['mejor regresamos el 26']));
  igual('«mejor regresamos el 26» mueve el regreso', c.estado.regreso, '2026-12-26');
  igual('  y no toca la salida', c.estado.salida, '2026-12-20');

  /* El día suelto de la corrección se ancla al mes del viaje, no a hoy:
     si no, «mejor el 22» de un viaje de diciembre caía en septiembre y
     el bot contestaba que el regreso queda antes de la salida. */
  const d = habla(HASTA_LA_FECHA.concat(['30 de diciembre', 'el 3',
    'mejor salimos el 28']));
  igual('la corrección se ancla al mes del viaje', d.estado.salida, '2026-12-28');
  igual('  y el regreso de año nuevo se queda donde estaba', d.estado.regreso, '2027-01-03');
}

titulo('lo que NO puede mover una fecha');
{
  const base = HASTA_LA_FECHA.concat(['20 de diciembre', 'el 23']);

  /* El peligro de leer fechas en cualquier mensaje: los números que
     contestan OTRA pregunta. Si esto se rompe, el viaje cambia de día
     cada vez que el cliente teclea un número. */
  const a = habla(base.concat(['2']));
  igual('un «2» contestando los movimientos no mueve la salida', a.estado.salida, '2026-12-20');
  igual('  ni el regreso', a.estado.regreso, '2026-12-23');

  const b = habla(base.concat(['somos 22']));
  igual('«somos 22» es gente, no el día 22', b.estado.salida, '2026-12-20');
  igual('  y sí corrige la gente', Number(b.estado.gente), 22);

  const c = habla(base.concat(['el 28']));
  igual('un día suelto SIN palabra de cambio no mueve la salida', c.estado.salida, '2026-12-20');

  const d = habla(base.concat(['mejor 3 movimientos']));
  igual('«mejor 3 movimientos» no es una fecha', d.estado.salida, '2026-12-20');
  igual('  ni toca el regreso', d.estado.regreso, '2026-12-23');
}

titulo('cuando no se sabe cuál fecha, se pregunta');
{
  const base = HASTA_LA_FECHA.concat(['20 de diciembre', 'el 23']);
  const a = habla(base.concat(['mejor el 22']));
  /* Con las dos fechas puestas y sin decir cuál, adivinar es apostar a
     que el camión salga el día bueno. Cuesta un mensaje preguntar. */
  ok('pregunta cuál de las dos', /salida|regreso/i.test(a.texto) && /\?/.test(a.texto));
  igual('  y mientras tanto no mueve nada', [a.estado.salida, a.estado.regreso],
    ['2026-12-20', '2026-12-23']);
}

titulo('lo que ya funcionaba sigue funcionando');
{
  const a = habla(HASTA_LA_FECHA.concat(['30 de diciembre', 'el 3']));
  igual('el regreso se ancla a la salida, no a hoy', a.estado.regreso, '2027-01-03');

  const b = habla(HASTA_LA_FECHA.concat(['20 de noviembre', 'el 22']));
  igual('y el del mes que viene también', b.estado.regreso, '2026-11-22');

  const c = habla(HASTA_LA_FECHA.concat(['del 20 al 23 de diciembre']));
  igual('el rango se lee de un jalón', [c.estado.salida, c.estado.regreso],
    ['2026-12-20', '2026-12-23']);
}

titulo('el día de la semana es una fecha, y es como contesta la gente');
{
  /* HOY es viernes 11 de septiembre de 2026. */
  const a = habla(HASTA_LA_FECHA.concat(['el sabado']));
  igual('«el sabado» es el sábado que viene', a.estado.salida, '2026-09-12');

  const b = habla(HASTA_LA_FECHA.concat(['el proximo viernes']));
  igual('«el proximo viernes» no es hoy', b.estado.salida, '2026-09-18');

  const c = habla(HASTA_LA_FECHA.concat(['este domingo']));
  igual('«este domingo»', c.estado.salida, '2026-09-13');

  /* Y contestando el regreso se ancla a la salida, no a hoy. */
  const d = habla(HASTA_LA_FECHA.concat(['20 de diciembre', 'el martes']));
  igual('«el martes» de regreso cae después de la salida', d.estado.regreso, '2026-12-22');

  /* El bot ofrece estas dos palabras como botones en R52: si no las
     entiende, el cliente aprieta su propio botón y no pasa nada. */
  ok('«el sabado» no deja el viaje sin fecha', !!a.estado.salida);
}

titulo('el rango que cruza de año trae sus dos fechas');
{
  /* El viaje de fin de año es el más caro que se vende. Se quedaba con
     la salida y tiraba el regreso: la frase trae el mes en los DOS
     extremos y `fechaDe` se comía el primero antes de que el lector de
     rangos la viera (11-sep-2026). */
  const a = habla(HASTA_LA_FECHA.concat(['del 20 de diciembre al 3 de enero']));
  igual('«del 20 de diciembre al 3 de enero»', [a.estado.salida, a.estado.regreso],
    ['2026-12-20', '2027-01-03']);

  const b = habla(HASTA_LA_FECHA.concat(['del 30 de diciembre al 2 de enero']));
  igual('«del 30 de diciembre al 2 de enero»', [b.estado.salida, b.estado.regreso],
    ['2026-12-30', '2027-01-02']);

  /* El fin de semana, que es el viaje más común que hay, se pide así y
     no con números. HOY es viernes 11 de septiembre de 2026. */
  const c = habla(HASTA_LA_FECHA.concat(['del viernes al domingo']));
  igual('«del viernes al domingo»', [c.estado.salida, c.estado.regreso],
    ['2026-09-18', '2026-09-20']);
}

titulo('mover el viaje entero no lo deja en un callejón');
{
  const base = HASTA_LA_FECHA.concat(['20 de diciembre', 'el 23']);

  /* Un viaje de 4 días que se mueve a enero sigue siendo de 4 días. El
     bot contestaba «esa salida queda después del regreso» y repetía lo
     mismo para siempre: no había manera de salir de ahí más que
     empezar la conversación de cero (11-sep-2026). */
  const a = habla(base.concat(['mejor cambiamos, salimos el 5 de enero']));
  igual('la salida se mueve a enero', a.estado.salida, '2027-01-05');
  igual('  y el regreso se mueve los mismos días', a.estado.regreso, '2027-01-08');
  ok('  y lo dice completo', /8 de enero/.test(a.texto));

  /* Al revés no se infiere nada: acortar el viaje es decisión suya. */
  const b = habla(base.concat(['mejor regresamos el 18']));
  igual('un regreso antes de la salida no se acepta solo', b.estado.regreso, '2026-12-23');
  ok('  y se le dice por qué', /antes\*? de la salida/i.test(b.texto));
}

titulo('«ya no» cambia de fecha, no tira el viaje');
{
  const base = HASTA_LA_FECHA.concat(['20 de diciembre', 'el 23']);
  /* Esto borraba la conversación ENTERA: destino, gente, origen y las
     dos fechas. El cliente quería mover el viaje a enero y se quedaba
     sin nada, empezando de cero (11-sep-2026). */
  const a = habla(base.concat(['ya no, mejor en enero']));
  ok('el viaje sigue vivo', !!a.estado.destino && !!a.estado.gente);
  igual('  con el destino puesto', a.estado.destino, 'Puerto Vallarta');
  igual('  y con la gente puesta', Number(a.estado.gente), 40);
}

console.log('\n' + buenas + ' buenas, ' + malas + ' malas');
process.exit(malas ? 1 : 0);
