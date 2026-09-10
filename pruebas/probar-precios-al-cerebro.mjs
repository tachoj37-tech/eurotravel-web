/* ============================================================
   EL VOLCADO DE PRECIOS AL CEREBRO (10-sep-2026)
   ============================================================
   El dueño pidió que lo aprendido se guardara «en el cerebro de
   criterio». El bot no puede escribirlo —Vercel tiene el disco en solo
   lectura y no hace commits—, así que guarda en Supabase y
   `scripts/precios-al-cerebro.mjs` vuelca esa tabla a dos archivos:

     cerebro/precios-que-he-dado.md   el resumen, con sus enlaces
     docs/PRECIOS-QUE-HE-DADO.md     la tabla completa

   Esta batería prueba el FORMATO con renglones de mentiras: sin red,
   sin almacén y sin un peso gastado. Lo que vigila, en orden de qué tan
   caro sale si falla:

   1 · Que el número que se enseña como bueno sea el MISMO que el ticket
       le sugeriría. Si los dos dijeran cosas distintas, el cerebro
       estaría mintiendo sobre el propio bot.
   2 · Que los viajes de prueba no se cuelen: son los que él usó para
       probar, no criterio suyo.
   3 · Que un viaje dado a dos precios distintos se señale en vez de
       esconderse.
   ============================================================ */
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.join(AQUI, '..');

let buenas = 0, malas = 0;
function ok(que, condicion) {
  if (condicion) { buenas++; console.log('ok   ' + que); }
  else { malas++; console.log('FALLA ' + que); }
}
function titulo(t) { console.log('\n== ' + t.toUpperCase() + ' =='); }

const volcado = await import(pathToFileURL(path.join(RAIZ, 'scripts', 'precios-al-cerebro.mjs')).href);
const aprendidos = (await import(pathToFileURL(path.join(RAIZ, 'api', '_precios-aprendidos.js')).href)).default;

/* Renglones como los que guarda `renglonDe`. */
function renglon(x) {
  return Object.assign({
    clave: 'zmg|chapala|sprinter|3', origen: 'Guadalajara', destino: 'Chapala',
    unidad: 'Sprinter', dias: 3, pasajeros: 12, total: 6500, anticipo: 1500,
    fijado: false, cliente: '3312345678', salida: '2026-11-20',
    cuando: '2026-09-01T10:00:00Z'
  }, x);
}

titulo('los de prueba no son criterio: se apartan');
{
  const filas = [
    renglon({ cliente: '3312345678' }),
    renglon({ cliente: '5213366679001' }),
    renglon({ cliente: '3366671111' }),
    renglon({ cliente: '3311112222' })
  ];
  const por = volcado.agrupa(filas);
  const cuantos = Array.from(por.values()).reduce(function (n, l) { return n + l.length; }, 0);
  ok('de 4 renglones solo entra el del cliente de verdad', cuantos === 1);
  ok('  y los de prueba se reconocen por su número',
    volcado.DE_PRUEBA.test('5213366679001') && volcado.DE_PRUEBA.test('3366671111'));
  ok('  sin tumbar a un cliente normal', !volcado.DE_PRUEBA.test('3312345678'));
}

titulo('un total en cero no cuenta');
{
  const por = volcado.agrupa([renglon({ total: 0 }), renglon({ total: null }), renglon({ total: 6500 })]);
  const cuantos = Array.from(por.values()).reduce(function (n, l) { return n + l.length; }, 0);
  ok('solo entra el que tiene número', cuantos === 1);
}

titulo('el que manda es el mismo que sugeriría el ticket');
{
  /* Esto es lo importante de toda la batería: el cerebro no puede decir
     un número y el ticket otro. La regla vive en `lineasDeHistorial`
     (`api/_precios-aprendidos.js`) y aquí se comprueba contra ella. */
  const lista = [
    renglon({ total: 7000, fijado: false, cuando: '2026-09-05T10:00:00Z' }),
    renglon({ total: 6800, fijado: true, cuando: '2026-09-03T10:00:00Z' }),
    renglon({ total: 6500, fijado: true, cuando: '2026-09-01T10:00:00Z' })
  ];
  const manda = volcado.elQueMandaHoy(lista);
  ok('gana el último que él FIJÓ, no el más reciente', manda.total === 6800);

  const delTicket = aprendidos.lineasDeHistorial(lista).join('\n');
  ok('  y es el mismo número que el ticket le sugiere',
    delTicket.indexOf('$6,800') !== -1);

  /* Y si nunca fijó ninguno, el más reciente. */
  const sinFijar = [
    renglon({ total: 7000, fijado: false, cuando: '2026-09-05T10:00:00Z' }),
    renglon({ total: 6500, fijado: false, cuando: '2026-09-01T10:00:00Z' })
  ];
  ok('sin ninguno fijado, manda el más reciente', volcado.elQueMandaHoy(sinFijar).total === 7000);
  ok('  y el ticket dice lo mismo',
    aprendidos.lineasDeHistorial(sinFijar).join('\n').indexOf('$7,000') !== -1);
}

titulo('la página del cerebro');
{
  const filas = [
    renglon({ total: 6500, fijado: true }),
    renglon({ clave: 'zmg|puerto vallarta|marcopolo paradiso g8|3', destino: 'Puerto Vallarta',
      unidad: 'Marcopolo Paradiso G8', total: 38000, fijado: true }),
    renglon({ clave: 'zona ocotlan|chapala|sprinter|3', origen: 'Ocotlán', total: 11000, fijado: true })
  ];
  const md = volcado.laPaginaDelCerebro(volcado.agrupa(filas));

  ok('lleva su título', /^# Los precios que ya di/m.test(md));
  ok('agrupa por unidad', /## Sprinter/.test(md) && /## Marcopolo Paradiso G8/.test(md));
  ok('enseña los tres números', /\$6,500/.test(md) && /\$38,000/.test(md) && /\$11,000/.test(md));
  ok('marca con ✍️ lo que él escribió', /\$6,500\*\* ✍️/.test(md));
  ok('separa Ocotlán de Guadalajara', /Ocotlán/.test(md) && /Guadalajara/.test(md));
  ok('explica qué es «el mismo viaje»', /zona de salida, destino, unidad y/.test(md));
  ok('avisa que se reescribe solo', /me lo pisa/.test(md));

  /* Los enlaces del cerebro, que es lo que lo hace parte del cerebro y no
     un archivo suelto. */
  for (const enlace of ['[[precio-de-lista]]', '[[como-se-arma-un-precio]]',
    '[[de-donde-salen]]', '[[quien-manda]]', '[[MAPA]]']) {
    ok('enlaza a ' + enlace, md.indexOf(enlace) !== -1);
  }
}

titulo('cuando cambió de opinión, se señala');
{
  const filas = [
    renglon({ total: 7000, fijado: true, cuando: '2026-09-05T10:00:00Z' }),
    renglon({ total: 6500, fijado: true, cuando: '2026-09-01T10:00:00Z' })
  ];
  const md = volcado.laPaginaDelCerebro(volcado.agrupa(filas));
  ok('dice que ese viaje lo dio a más de un precio', /más de un precio/.test(md));
  ok('  y enseña los dos', /\$7,000/.test(md) && /\$6,500/.test(md));

  /* Un viaje dado siempre al mismo precio NO se señala: sería ruido. */
  const iguales = [renglon({ total: 6500 }), renglon({ total: 6500, cuando: '2026-09-02T10:00:00Z' })];
  ok('uno dado siempre igual no se señala',
    !/más de un precio/.test(volcado.laPaginaDelCerebro(volcado.agrupa(iguales))));
}

titulo('sin nada guardado no se inventa una tabla vacía');
{
  const md = volcado.laPaginaDelCerebro(volcado.agrupa([]));
  ok('lo dice con todas sus letras', /Todavía no hay ninguno/.test(md));
  ok('  y no deja encabezados de tabla sueltos', !/\|---\|/.test(md));
}

titulo('la tabla larga');
{
  const filas = [renglon({ total: 6500, fijado: true }), renglon({ total: 7000, cuando: '2026-09-05T10:00:00Z' })];
  const md = volcado.laTablaLarga(filas, volcado.agrupa(filas));
  ok('cuenta los renglones', /Renglones guardados: \*\*2\*\*/.test(md));
  ok('avisa que no se edita a mano', /no se edita a mano/.test(md));
  ok('trae el más reciente arriba',
    md.indexOf('2026-09-05') < md.indexOf('2026-09-01'));
  ok('manda al resumen del cerebro', /cerebro\/precios-que-he-dado\.md/.test(md));
}

console.log('\n' + buenas + ' buenas, ' + malas + ' malas');
process.exit(malas ? 1 : 0);
