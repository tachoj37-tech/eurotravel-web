/* ============================================================
   LO QUE ENCONTRÓ EL CLIENTE DIFÍCIL (11-sep-2026)
   ============================================================
   Dictado del dueño: «encuentra preguntas repetidas, encuentra
   olvidadas, se le olvidan las cosas, encuentra que se clave en el
   número de personas… ponte en modo tonto cuando le hables al chatbot».

   Se escribieron doce conversaciones nuevas en `scripts/conversar.mjs`
   —el que se contradice, el que contesta con preguntas, el que dice que
   sí a todo, el que escribe una palabra por mensaje— y se corrieron con
   el modelo de verdad. Salieron tres defectos, y los tres son de los que
   no truenan: el bot sigue hablando como si nada.

   Esta batería los fija. Cada bloque dice de qué conversación salió.
   ============================================================ */
'use strict';

const path = require('path');
const RAIZ = path.join(__dirname, '..');
const conv = require(path.join(RAIZ, 'bot.js'));

let buenas = 0, malas = 0;
function ok(que, condicion) {
  if (condicion) { buenas++; console.log('ok   ' + que); }
  else { malas++; console.log('FALLA ' + que); }
}
function titulo(t) { console.log('\n== ' + t.toUpperCase() + ' =='); }

const HOY = '2026-09-11';
function corre(msgs) {
  let e = null, r = null;
  for (const m of msgs) { r = conv.respuestaA(m, e, HOY); e = r.estado; }
  return { ultimo: r, estado: e };
}

titulo('el mes y el día en dos mensajes (escenario bk)');
{
  /* El cliente escribió «diciembre» y en el mensaje siguiente «20». El
     «20» se leía SOLO, sin el mes, y se resolvía al 20 más cercano desde
     hoy: 20 de SEPTIEMBRE. Tres meses de diferencia.

     Y el modelo, que sí tenía la plática, le contestaba «Listo, 20 de
     diciembre». O sea: el bot decía diciembre y el sistema guardaba
     septiembre. De ahí salen el precio, el calendario y el contrato — no
     se ve hasta que el camión no llega el día que era. */
  const r = corre(['hola', 'vallarta', '45', 'diciembre', '20', '22']);
  ok('«diciembre» + «20» es el 20 de DICIEMBRE', r.estado.salida === '2026-12-20');
  ok('  y el regreso se ancla al mismo mes', r.estado.regreso === '2026-12-22');

  ok('«en enero» + «5» es el 5 de enero', corre(['a chapala', 'somos 12', 'en enero', '5']).estado.salida === '2027-01-05');
  ok('«para octubre» + «el 8» es el 8 de octubre',
    corre(['a chapala', 'somos 12', 'para octubre', 'el 8']).estado.salida === '2026-10-08');

  /* Y lo de siempre no se movió. */
  ok('«20 de diciembre» de un jalón sigue igual',
    corre(['hola', 'vallarta', '45', '20 de diciembre']).estado.salida === '2026-12-20');
  ok('«20/12» con diagonal también', corre(['a chapala', 'somos 12', '20/12']).estado.salida === '2026-12-20');
  ok('«mañana» sigue siendo mañana', corre(['a chapala', 'somos 12', 'mañana']).estado.salida === '2026-09-12');
  ok('un día suelto SIN mes dicho se lee como siempre',
    corre(['a chapala', 'somos 12', '20']).estado.salida === '2026-09-20');

  /* El mes solo no se traga en silencio: se pregunta el día. */
  const soloMes = corre(['a chapala', 'somos 12', 'diciembre']);
  ok('un mes sin día pregunta QUÉ día', /qu[ée] d[ií]a de diciembre/i.test(soloMes.ultimo.texto));
  ok('  y no inventa una fecha', !soloMes.estado.salida);
}

titulo('«del 20 al 22 de diciembre» — el rango se lleva su mes (escenario bj)');
{
  /* El peor de todos, porque llega en el PRIMER mensaje y es de las
     formas más normales de escribirlo: «a vallarta del 20 al 22 de
     diciembre somos 45».

     La expresión que lee el rango capturaba nada más los dos días y
     tiraba el mes, así que devolvía «el 20» y «el 22» pelones y se
     resolvían a los más cercanos desde hoy: SEPTIEMBRE. Tres meses de
     diferencia, sin que nada truene, en el mensaje con el que más gente
     empieza.

     Y de rebote, contestar «¿qué día salen?» con el rango caía en «esa
     fecha no la entendí»: en la corrida del 11-sep-2026 el bot repitió
     la misma pregunta cuatro veces con el cliente diciéndole las fechas. */
  const lee = (t) => conv.leeDeUnJalon(t, HOY);

  const a = lee('a vallarta del 20 al 22 de diciembre somos 45');
  ok('el primer mensaje completo cae en diciembre', a.salida === '2026-12-20' && a.regreso === '2026-12-22');

  const b = lee('del 20 de diciembre al 22');
  ok('con el mes en el primer extremo también', b.salida === '2026-12-20' && b.regreso === '2026-12-22');

  /* Un viaje que cambia de mes: cada extremo se queda con el suyo. */
  const c = lee('del 30 de noviembre al 2 de diciembre');
  ok('y un viaje que cruza de mes no se aplasta',
    c.salida === '2026-11-30' && c.regreso === '2026-12-02');

  /* Sin mes escrito se lee como siempre: el más cercano. */
  const d = lee('del 20 al 22');
  ok('sin mes, sigue siendo el más cercano', d.salida === '2026-09-20' && d.regreso === '2026-09-22');

  /* Y contestando la pregunta del bot, que es el otro camino. */
  const e = corre(['a vallarta somos 45', 'del 20 al 22 de diciembre']);
  ok('contestar «¿qué día salen?» con el rango sí se entiende',
    e.estado.salida === '2026-12-20' && e.estado.regreso === '2026-12-22');
  ok('  y ya no vuelve a preguntar la fecha', !/qu[ée] d[ií]a salen/i.test(e.ultimo.texto));
}

titulo('una dirección no es una ciudad (escenario bh)');
{
  /* «Nos recogen en hidalgo 45 a las 6 de la mañana» dejaba el viaje con
     el origen en «Hidalgo 45». El resumen decía «📍 Hidalgo 45 →
     Tequila», el bot ya no preguntaba de qué ciudad salían, y esa cadena
     habría viajado al contrato.

     Y cuesta dinero: el origen decide el recargo de salida. Una
     dirección no empata con ninguna zona, así que un grupo de Ocotlán
     que da su calle se cotiza como si saliera de Guadalajara. */
  function hastaOrigen(m) {
    return corre(['a tequila somos 12', '20 de octubre', '22 de octubre', m]);
  }
  for (const d of ['hidalgo 45', 'av vallarta 1234', 'calle morelos 200', 'colonia centro']) {
    const r = hastaOrigen(d);
    ok('«' + d + '» no se guarda como ciudad', !r.estado.origen);
    ok('  y se le pide la ciudad', /de qu[ée] \*?ciudad\*? salen/i.test(r.ultimo.texto));
  }
  for (const c of ['guadalajara', 'ocotlan', 'zapopan', 'san juan de los lagos']) {
    ok('«' + c + '» sí es ciudad', !!hastaOrigen(c).estado.origen);
  }

  /* Y por el camino de la IA, que es por donde entró de verdad. */
  const porLaIA = (o) => (conv.pegaDatos({ paso: 'origen', destino: 'Tequila', gente: 12 }, { origen: o }) || {}).origen;
  ok('la IA tampoco puede meter una dirección', !porLaIA('Hidalgo 45'));
  ok('  ni una avenida con número', !porLaIA('Av. Vallarta 1234'));
  ok('  pero una ciudad sí pasa', porLaIA('Ocotlán') === 'Ocotlán');
  ok('  y la zona metropolitana se sigue normalizando', porLaIA('Zapopan') === 'Guadalajara');
}

titulo('el catálogo se manda completo (escenario az)');
{
  /* El motor le pasó al modelo la lista de los siete autobuses que le
     caben a un grupo de 45, con la instrucción de mandarla «TAL CUAL».
     El modelo la reescribió con sus palabras y se comió el Irizar i6 51
     — el que se acababa de dar de alta, o sea el que nadie iba a echar
     de menos. Un camión que no aparece es un camión que no se vende.

     Aquí se comprueba lo que el MOTOR manda, que es la fuente. El
     guardia que caza al modelo vive en `api/whatsapp.mjs` y tiene su
     prueba en la corrida con el modelo real. */
  const lista = conv.mensajeDeAutobuses(45);
  const buses = (conv.UNIDADES || []).filter(function (u) { return u.cat === 'autobus'; });
  const faltan = buses.filter(function (u) { return lista.indexOf(u.name) === -1; })
    .map(function (u) { return u.name; });
  ok('la lista para 45 trae los ' + buses.length + ' autobuses', faltan.length === 0);
  if (faltan.length) console.log('     faltaron: ' + faltan.join(', '));

  const todos = conv.mensajeDeTodosLosAutobuses();
  const faltan2 = buses.filter(function (u) { return todos.indexOf(u.name) === -1; })
    .map(function (u) { return u.name; });
  ok('y la lista completa también', faltan2.length === 0);

  /* El Century dice su rango de verdad, no un número redondeado. */
  ok('el Century dice «47 a 49», no «47»', /47 a 49/.test(lista));
}

titulo('se contradice con el número de personas (escenario az)');
{
  /* Dijo 45, luego 15, luego 45 otra vez. Manda el último. */
  const r = corre(['hola quiero cotizar a vallarta', 'somos 45', 'no perdón somos 15', 'ah no, al final sí somos 45']);
  ok('se queda con el último número que dijo', r.estado.gente === 45);

  /* Y la corrección a media cotización, que es la que se clavaba: esto
     solo llenaba el hueco si estaba VACÍO, así que «somos 40» y luego
     «perdón somos 12» dejaba el viaje en 40 sin decir nada. Es el defecto
     que el dueño ha reportado más veces con sus palabras: «se clava con
     el número de personas». */
  const s = corre(['a chapala', 'somos 40', 'perdón somos 12']);
  ok('corrige el número a media cotización', s.estado.gente === 12);
  ok('  y lo acusa, no se lo traga', /Son \*12\*/.test(s.ultimo.texto));

  /* Y si con el número nuevo ya no cabe la unidad que había, se suelta:
     un autobús para doce personas es tan malo como una van para cuarenta. */
  /* Desde el 11-sep-2026 no solo se suelta la que no cabe: si con el
     número nuevo la unidad es UNA sola —de 7 a 20 es la Sprinter y no
     hay de otra— se anota, para que el viaje no llegue a la
     confirmación sin decirle al cliente en qué se va. Arriba de 20 no
     se escoge por él: ahí está el paso de elegir camión. */
  const t = corre(['a vallarta somos 45', '20 de octubre', 'perdón somos 12']);
  ok('el autobús se suelta cuando bajan a 12', t.estado.unidad !== 'autobus');
  ok('  y queda la Sprinter, que es la única que puede ser', t.estado.unidad === 'sprinter');
  const u = corre(['a vallarta somos 12', '20 de octubre', 'perdón somos 45']);
  ok('y la Sprinter se suelta cuando suben a 45', u.estado.unidad !== 'sprinter');
}

/* ============================================================
   LA VUELTA DEL 11-sep-2026 POR LA TARDE
   ------------------------------------------------------------
   Ya no con guiones escritos, sino hablándole al bot turno por turno y
   decidiendo cada mensaje según lo que contestaba — que es como lo
   prueba el dueño. Seis defectos más, y cuatro salieron en los primeros
   cinco mensajes.
   ============================================================ */

titulo('ni una temporada ni una parrafada son un destino');
{
  /* Primer mensaje de esa vuelta: «pues todavía no sé, qué me
     recomiendas para un fin de semana» → «*Un Fin de Semana*, va 📍».
     Y al taparlo, se quedaba con la frase ENTERA: «*Pues Todavia No Se,
     Que Me Recomiendas Para Un Fin de Semana*, va 📍». */
  function comoDestino(t) {
    let e = conv.respuestaA('hola', null, HOY).estado;
    return conv.respuestaA(t, e, HOY).estado.destino;
  }
  for (const t of ['pues todavia no se, que me recomiendas para un fin de semana',
    'para un fin de semana', 'un puente', 'en semana santa', 'no se todavia']) {
    ok('«' + t + '» no es destino', !comoDestino(t));
  }

  /* Y los de verdad no se tocaron. */
  const buenos = [['a chapala', 'Chapala'], ['playa del carmen', 'Playa del Carmen'],
    ['san juan de los lagos', 'San Juan de los Lagos'], ['barra de navidad', 'Barra de Navidad'],
    ['el manto', 'El Manto'], ['la barca', 'La Barca'], ['valle de bravo', 'Valle de Bravo']];
  for (const [dice, espera] of buenos) {
    ok('«' + dice + '» sigue siendo ' + espera, comoDestino(dice) === espera);
  }
}

titulo('la muletilla del final no es parte del nombre');
{
  /* «a tequila entonces» → «*Tequila Entonces*, va 📍». Nadie se llama
     así, y ese texto es el que sale en el ticket y en el contrato. */
  function comoDestino(t) {
    let e = conv.respuestaA('hola', null, HOY).estado;
    return conv.respuestaA(t, e, HOY).estado.destino;
  }
  ok('«a tequila entonces» es Tequila', comoDestino('a tequila entonces') === 'Tequila');
  ok('«a chapala porfa» es Chapala', comoDestino('a chapala porfa') === 'Chapala');
  ok('«a vallarta pues» es Puerto Vallarta', comoDestino('a vallarta pues') === 'Puerto Vallarta');
  ok('«a chapala pues porfa» también', comoDestino('a chapala pues porfa') === 'Chapala');
}

titulo('«el» y «del» solo cortan cuando lo que sigue es fecha');
{
  /* «a playa del carmen» quedaba en «Playa» y «a barrancas del cobre» en
     «Barrancas» — y ése ya no lo encuentra el catálogo, o sea que cobra
     otro precio. El corte estaba para «a Tequila el 12» y se llevaba de
     paso a los destinos que traen «del» en el nombre. */
  ok('«a playa del carmen» entero', conv.destinoDeLaFrase('a playa del carmen') === 'Playa del Carmen');
  ok('«a barrancas del cobre» entero', conv.destinoDeLaFrase('a barrancas del cobre') === 'Barrancas del Cobre');
  /* Y el corte por fecha sigue haciendo su trabajo. */
  ok('«a tequila el 12» corta en la fecha', conv.destinoDeLaFrase('a tequila el 12') === 'Tequila');
  ok('«a chapala del 20 al 22» también', conv.destinoDeLaFrase('a chapala del 20 al 22') === 'Chapala');
  ok('«a mazatlan el sabado» también', conv.destinoDeLaFrase('a mazatlan el sabado') === 'Mazatlan');
}

titulo('«sábado 19» — el formato que el propio bot pide');
{
  /* Al repreguntar la fecha el bot dice «por ejemplo *sábado 12*». Y
     «sabado 19» devolvía null: el cliente hacía justo lo que le pidieron
     y recibía la misma pregunta otra vez. */
  ok('«sabado 19» se entiende', conv.fechaDe('sabado 19', HOY) === '2026-09-19');
  ok('«sábado 12» con acento también', conv.fechaDe('sábado 12', HOY) === '2026-09-12');
  ok('«viernes 20» también', conv.fechaDe('viernes 20', HOY) === '2026-09-20');
  ok('«sabado 19 de diciembre» lleva su mes', conv.fechaDe('sabado 19 de diciembre', HOY) === '2026-12-19');
  /* Y el candado que protegía el «el» sigue puesto: un número suelto en
     medio de una frase NO es una fecha. */
  ok('«somos 12» NO es el día 12', conv.fechaDe('somos 12', HOY) === null);
  ok('«somos 45 personas» tampoco', conv.fechaDe('somos 45 personas', HOY) === null);
}

titulo('a media lista de camiones, lo demás no se tira');
{
  /* Todo grupo de más de 20 pasa por el paso de escoger camión, y ahí
     solo se guardaban destino, fecha y gente. Quien contestaba «de gdl»
     o «nomás ir y venir» recibía «¿Cuál de esos te late? 🚌» y su dato
     se perdía. */
  const base = ['a tequila', 'somos 45', 'sabado 19', 'mismo dia'];
  const conOrigen = corre(base.concat(['de gdl']));
  ok('«de gdl» se guarda, y como Guadalajara', conOrigen.estado.origen === 'Guadalajara');

  const sinMover = corre(['a vallarta', 'somos 45', '20 de octubre', '22 de octubre', 'nomas ir y venir']);
  ok('«nomás ir y venir» son 0 recorridos', sinMover.estado.recorridos === 0);

  /* Y sigue sin escoger camión por él. */
  ok('  y el camión sigue sin escogerse solo', !conOrigen.estado.unidad);
}

titulo('«de gdl» a secas es de dónde salen');
{
  ok('«de gdl»', conv.origenDeLaFrase('de gdl') === 'gdl');
  ok('«desde ocotlan»', conv.origenDeLaFrase('desde ocotlan') === 'ocotlan');
  /* Lo que empieza con «de» y no es lugar: «de ida y vuelta» se estaba
     guardando como ciudad de origen. */
  ok('«de ida y vuelta» NO es un lugar', !conv.origenDeLaFrase('de ida y vuelta'));
  ok('«de regreso» tampoco', !conv.origenDeLaFrase('de regreso'));
  /* Y en medio de una frase el «de» no cuenta: aparece por todos lados. */
  ok('«barra de navidad» no da origen', !conv.origenDeLaFrase('barra de navidad'));
}

titulo('el viaje no llega a confirmar sin decir en qué se va');
{
  /* Con 20 personas la confirmación salía sin unidad: el cliente decía
     que sí a un resumen que no le decía en qué se iba. */
  const r = corre(['a tequila', 'somos 20', 'sabado 19', 'mismo dia', 'de gdl']);
  ok('con 20 queda la Sprinter', r.estado.unidad === 'sprinter');
  ok('  y la confirmación la nombra', /Sprinter/.test(r.ultimo.texto));
  ok('  con sus pasajeros', /20 pasajeros/.test(r.ultimo.texto));
  /* Arriba de 20 NO se escoge por él: ése es el paso de elegir camión. */
  ok('con 45 no se escoge solo', !corre(['a tequila', 'somos 45', 'sabado 19', 'mismo dia']).estado.unidad);
}

titulo('lo que salió con la IA apagada (corrida del 11-sep por la noche)');
{
  /* El tope diario de la API se agotó a media corrida, así que 240
     mensajes se contestaron SOLO con el guion. Fue un regalo: es
     exactamente el escenario «qué pasa el día que el modelo falle», y
     ahí salieron tres cosas más. */

  /* 1 · «dónde» no es un lugar, es la pregunta. */
  const comoDestino = (t) => (conv.respuestaA(t, null, HOY).estado || {}).destino;
  for (const t of ['no sé a dónde todavía', 'todavia no se a donde',
    'a donde me recomiendas', 'a donde van ustedes']) {
    ok('«' + t + '» no es destino', !comoDestino(t));
  }
  ok('pero «a chapala» sí', comoDestino('a chapala') === 'Chapala');
  ok('y «quiero ir a vallarta el 20» también', comoDestino('quiero ir a vallarta el 20') === 'Puerto Vallarta');

  /* 2 · «quiero un camión» tiene que dejar memoria. Sin esto el mensaje
     siguiente empezaba de cero: el cliente decía «el 20 de diciembre» y
     el bot contestaba «déjame checarte eso bien tantito». Y es la regla
     que el dueño dictó en mayúsculas: si dice camión, eso manda. */
  const camion = conv.respuestaA('quiero un camion', null, HOY);
  ok('«quiero un camión» deja el camión anotado', (camion.estado || {}).unidad === 'autobus');
  const van = conv.respuestaA('ocupo una camioneta', null, HOY);
  ok('«ocupo una camioneta» deja la Sprinter', (van.estado || {}).unidad === 'sprinter');

  /* 3 · La conversación entera, que antes se perdía en el primer
     mensaje, ahora llega completa. */
  const r = corre(['quiero un camion', 'el 20 de diciembre', 'no sé a dónde todavía',
    'a mazatlán', 'el i6s', 'de gdl', 'regresamos el 23', 'no nos movemos']);
  ok('el camión se conservó desde el primer mensaje', r.estado.unidadNombre === 'Irizar i6S');
  ok('  la fecha dicha antes del destino también', r.estado.salida === '2026-12-20');
  ok('  el destino', r.estado.destino === 'Mazatlán');
  ok('  el regreso', r.estado.regreso === '2026-12-23');
  ok('  el origen, y como ciudad', r.estado.origen === 'Guadalajara');
  ok('  los recorridos', r.estado.recorridos === 0);
  ok('  y llega a confirmar', r.estado.paso === 'confirmar');
}

console.log('\n' + buenas + ' buenas, ' + malas + ' malas');
process.exit(malas ? 1 : 0);
