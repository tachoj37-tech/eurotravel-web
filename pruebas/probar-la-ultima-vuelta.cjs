/* ============================================================
   LA ÚLTIMA VUELTA (11-sep-2026)
   ============================================================
   Cinco defectos que salieron de hablarle al bot después de dar las
   cinco fases por terminadas. Uno de ellos —el primero— lo metí YO
   esta misma tarde al arreglar otra cosa, y es el más caro de los
   cinco: la prueba que lo caza va primero por eso.

   La lección, otra vez: un arreglo que corta un camino antes de tiempo
   no se ve en ninguna batería que no lo busque. El bloque nuevo de
   corregir fechas se quedaba con el mensaje entero, y todo lo demás
   que venía en ese mensaje se perdía.
   ============================================================ */
'use strict';

const path = require('path');
const RAIZ = path.join(__dirname, '..');
const conv = require(path.join(RAIZ, 'bot.js'));

const HOY = '2026-09-11';

let buenas = 0, malas = 0;
function ok(que, condicion) {
  if (condicion) { buenas++; console.log('ok   ' + que); }
  else { malas++; console.log('FALLA ' + que); }
}
function igual(que, dio, espera) {
  const bien = JSON.stringify(dio) === JSON.stringify(espera);
  if (bien) { buenas++; console.log('ok   ' + que); }
  else {
    malas++;
    console.log('FALLA ' + que + '\n       dio: ' + JSON.stringify(dio) +
      '\n       esperaba: ' + JSON.stringify(espera));
  }
}
function titulo(t) { console.log('\n== ' + t.toUpperCase() + ' =='); }

function corrido(msgs) {
  let e = null, ultimo = null;
  for (const m of msgs) { ultimo = conv.respuestaA(m, e, HOY); e = ultimo.estado || {}; }
  return { estado: e, texto: (ultimo && ultimo.texto) || '', r: ultimo || {} };
}

const ARMADO = ['hola', 'a vallarta', 'somos 40', 'de gdl', '20 de diciembre', 'el 23'];

titulo('corregir la fecha no se traga el resto del mensaje');
{
  /* REGRESIÓN METIDA HOY. El bloque que corrige fechas corre antes que
     los pasos, y devolvía en cuanto encontraba un mes — sin dejar que
     nadie leyera el resto. «mejor cambiemos todo, ahora es a mazatlán
     en enero para 20 personas» movía el mes y dejaba el viaje yendo a
     Vallarta con 40 personas. */
  const a = corrido(ARMADO.concat(
    ['oye mejor cambiemos todo, ahora es a mazatlan en enero para 20 personas']));
  /* Sin exigir el acento: el destino se guarda como lo escribió el
     cliente, y el catálogo lo encuentra con o sin él. */
  ok('el destino cambia', /^mazatl[aá]n$/i.test(a.estado.destino || ''));
  igual('  y cuántos son también', Number(a.estado.gente), 20);
  ok('  y el mes quedó guardado para el día que falta',
    a.estado.mesDicho === 'enero' && !a.estado.salida);

  /* Y la otra mitad del mismo bloque: cuando SÍ hay fecha nueva. */
  const b = corrido(ARMADO.concat(['mejor salimos el 22 y somos 30']));
  igual('con fecha nueva, la fecha se mueve', b.estado.salida, '2026-12-22');
  igual('  y el resto del mensaje también se lee', Number(b.estado.gente), 30);
}

titulo('nadie confirma un viaje sin unidad');
{
  /* Al corregir a 55 personas, la unidad se borraba —bien, no caben—
     pero el paso se quedaba en «confirmar»: el cliente daba el sí a un
     resumen sin camión, y la solicitud le llegaba al vendedor sin
     decir en qué se van. */
  const a = corrido(ARMADO.concat(['el i6s', '0', 'somos 55']));
  ok('se le dice que no cabe en una sola unidad',
    /m[aá]s de una unidad/i.test(a.texto));
  ok('  y el viaje no se queda sin nada: va como autobús',
    a.estado.unidad === 'autobus');
  ok('  sin arrastrar el camión que ya no le cabe', !a.estado.unidadNombre);
  ok('  y queda marcado para el ticket', a.estado.noCabeEnUna === true);

  /* Con 45 sí hay camión, pero no el que había escogido (el de 47 sí,
     el i6S de 51 también). Lo que no puede pasar es seguir con uno que
     ya no le queda. */
  const b = corrido(ARMADO.concat(['el i6s', '0', 'somos 45']));
  ok('con 45 el viaje sigue vivo', !!b.estado.destino && Number(b.estado.gente) === 45);
  ok('  y si la unidad ya no cabe, no se queda puesta',
    !b.estado.unidadNombre || Number(b.estado.gente) <= 51);
}

titulo('el origen no se lleva pegado lo que venía después');
{
  /* «salimos de gdl sin movimientos» guardaba el origen como
     «Gdl Sin Movimientos». Ese texto viaja al ticket y al contrato, y
     el catálogo no lo reconoce: el recargo de salida sale mal. */
  const a = corrido(['hola quiero cotizar un camion a vallarta del 20 al 22 de ' +
    'diciembre somos 45 salimos de gdl sin movimientos']);
  igual('el origen queda limpio', a.estado.origen, 'Guadalajara');
  igual('  y el destino también', a.estado.destino, 'Puerto Vallarta');
  igual('  y las dos fechas', [a.estado.salida, a.estado.regreso],
    ['2026-12-20', '2026-12-22']);
  igual('  y cuántos son', Number(a.estado.gente), 45);
  ok('  y «sin movimientos» se leyó como cero', a.estado.recorridos === 0);
}

titulo('un asentimiento no es un pueblo');
{
  /* «sale» contestando «¿a dónde van?» se guardaba como el destino
     *Sale*. Es el mismo defecto de «Salen de *si esta bien*», del lado
     del destino: `comoOrigen` ya rechazaba los asentimientos y
     `comoDestino` no. */
  for (const d of ['sale', 'dale', 'va', 'ok', 'claro', 'esta bien', 'de acuerdo']) {
    ok('«' + d + '» no es un destino', conv.comoDestino(d) === null);
  }
  /* Y los lugares de verdad que se le parecen siguen pasando. */
  for (const d of ['salamanca', 'valle de bravo', 'dolores hidalgo']) {
    ok('«' + d + '» sí es un destino', !!conv.comoDestino(d));
  }
}

titulo('el flujo del dueño, de punta a punta (13-sep-2026)');
{
  /* Dictado: «le pone a quiero cotizar, el bot hace su cotización, no da
     precio, guía al cliente a generar el ticket con la confirmación de su
     viaje —gdl a vallarta i6s 51 pasajeros— y le pregunta si todo bien».

     Probándolo así salieron dos defectos de dinero en el camino más
     normal que hay: «somos 51» escogía el «Irizar i6 51» sin preguntar (el
     51 del nombre), y «el i6s» en el paso de recorridos se leía como SEIS
     días de recorrido. El resumen salía con un camión que el cliente
     nunca pidió. */
  const a = corrido(['hola', 'Cotizar un viaje', 'a vallarta', 'somos 51', 'de gdl',
    '20 de diciembre', 'el 23']);
  ok('«somos 51» no escoge camión por el cliente', !a.estado.unidadNombre);
  ok('  y le pregunta cuál', a.estado.paso === 'elegirBus');

  const b = corrido(['hola', 'Cotizar un viaje', 'a vallarta', 'somos 51', 'de gdl',
    '20 de diciembre', 'el 23', 'el i6s', '0']);
  igual('«el i6s» es el i6S, no el i6 51', b.estado.unidadNombre, 'Irizar i6S');
  ok('  y el resumen lo dice', /Irizar i6S/.test(b.texto));
  ok('  sin dar precio', !/\$\s?\d/.test(b.texto));
  ok('  y pregunta si todo bien', /todo bien/i.test(b.texto));
  ok('  sin botones: es el ticket', (b.r.opciones || []).length === 0);
  ok('  avisando que el precio viene', /en un momento te paso tu precio/i.test(b.texto));

  /* Lo que el cliente puede decirle al ticket, y qué tiene que pasar. */
  function sobreElTicket(frase) {
    return conv.respuestaA(frase, JSON.parse(JSON.stringify(b.estado)), HOY);
  }
  const c = sobreElTicket('mejor somos 45');
  ok('«mejor somos 45» corrige y NO cierra', !!c.estado && Number(c.estado.gente) === 45);
  ok('  y le vuelve a enseñar el ticket', /confirmar/i.test(c.texto));

  const d = sobreElTicket('es para una boda');
  ok('«es para una boda» NO cambia el destino',
    !d.estado || d.estado.destino === 'Puerto Vallarta');
  ok('  y la ocasión llega al vendedor',
    !!((d.estado && d.estado.ocasion) || (d.solicitud && d.solicitud.ocasion)));
  ok('«una boda» no es un destino', conv.comoDestino('una boda') === null);

  const s = sobreElTicket('si todo bien');
  ok('«sí, todo bien» cierra y pasa al vendedor', s.pasa === true);
}

titulo('los días de movimiento, sin inventarlos (escenario n, 13-sep-2026)');
{
  /* Con el modelo real, a «¿se van a mover allá?» el ticket salió con un
     día de movimiento que nadie dijo y con el viaje recortado de 4 días a
     2. Aquí se cuida la parte del guion; el candado sobre lo que devuelve
     la IA se comprueba abajo, leyendo el código. */
  const HASTA = ['hola', 'Cotizar un viaje', 'a la ciudad de mexico', 'somos 40', 'de gdl',
    '5 de diciembre', 'el 8', 'el neobus'];
  const base = corrido(HASTA);
  function dice(frase) { return conv.respuestaA(frase, JSON.parse(JSON.stringify(base.estado)), HOY); }

  const a = dice('sí, allá nos vamos a mover');
  ok('«sí, nos vamos a mover» no inventa cuántos días', !a.estado || a.estado.recorridos === undefined);
  ok('  y pregunta cuántos, no lo mismo otra vez', /cu[aá]ntos d[ií]as/i.test(a.texto));

  const b = dice('dos días');
  igual('«dos días», con letra, son 2 días de movimiento', b.estado && b.estado.recorridos, 2);
  igual('  y NO cambian el regreso', b.estado && b.estado.regreso, '2026-12-08');

  const c = dice('hasta 10 horas');
  ok('«hasta 10 horas» no son 10 días', !c.estado || c.estado.recorridos !== 10);

  const d = dice('es para una boda');
  ok('«es para UNA boda» no es un día de movimiento', !d.estado || d.estado.recorridos !== 1);

  /* El candado sobre la IA vive en whatsapp.mjs. Se comprueba que siga ahí. */
  const fs = require('fs');
  const wa = fs.readFileSync(path.join(RAIZ, 'api/whatsapp.mjs'), 'utf8');
  ok('los recorridos de la IA pasan por el candado', /recorridos de la IA descartados/.test(wa));
  ok('  y las fechas de la IA también', /de la IA descartada: /.test(wa));
}

titulo('la prueba del dueño desde su número (13-sep-2026)');
{
  /* Lo que escribió, tal cual. Con la IA el bot se quedó preguntando
     cuántos son después de «sería una sprinter»; el guion, que es el
     respaldo, guardaba «vamos pasado» y «regresamos» como la ciudad de
     salida y «sería una sprinter» como el destino. */
  const H = '2026-09-13';
  let e = null, r = null;
  const paso = {};
  for (const m of ['Hola', 'Cotizar un viaje', 'vamos a vta', 'vamos pasado', '17', 'regresamos', 'sería una sprinter']) {
    r = conv.respuestaA(m, e, H); e = r.estado || {}; paso[m] = JSON.parse(JSON.stringify(e));
  }
  igual('«vamos pasado» es pasado mañana', paso['vamos pasado'].salida, '2026-09-15');
  ok('  y no es la ciudad de salida', !paso['vamos pasado'].origen);
  ok('«regresamos» no es la ciudad de salida', !paso['regresamos'].origen);
  igual('«sería una sprinter» no cambia el destino', e.destino, 'Puerto Vallarta');
  igual('  y deja la Sprinter escogida', e.unidadNombre, 'Sprinter');
  ok('  y ya no pregunta cuántos van', e.paso !== 'cuantos' && !/cu[aá]ntos van/i.test(r.texto));
  ok('«una sprinter» no es un destino', conv.comoDestino('sería una sprinter') === null);
  /* Lo que no se debe romper: ciudades de verdad y «el sábado pasado». */
  ok('«la barca» sigue siendo ciudad', !!conv.comoOrigen('la barca'));
  ok('«el mes pasado» no es pasado mañana', conv.fechaDe('el mes pasado', H) !== '2026-09-15');
}

console.log('\n' + buenas + ' buenas, ' + malas + ' malas');
process.exit(malas ? 1 : 0);
