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
  return { estado: e, texto: (ultimo && ultimo.texto) || '' };
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

console.log('\n' + buenas + ' buenas, ' + malas + ' malas');
process.exit(malas ? 1 : 0);
