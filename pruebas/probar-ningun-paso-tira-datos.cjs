/* ============================================================
   NINGÚN PASO TIRA UN DATO (11-sep-2026 · fase 3)
   ============================================================
   El cliente no contesta por turnos. Dice lo que se le ocurre cuando se
   le ocurre: suelta el origen mientras se le pregunta la fecha, corrige
   cuántos son cuando ya está escogiendo camión, y menciona que es una
   boda al final de todo.

   El guion, en cambio, sí va por turnos, y cada paso se traga el
   mensaje como si fuera la respuesta a SU pregunta. Lo que no encaja se
   tira — sin avisar, porque el paso cree que entendió.

   La cuenta del 11-sep-2026, antes de esta batería: de 48 combinaciones
   de paso y dato, **35 perdían el dato**. Los dos peores eran
   `recorridos` y `confirmar`, que no absorbían NADA: son los dos pasos
   justo antes de dar el precio, así que ahí es donde más caro sale.

   Esta batería es una tabla: cada paso por cada dato. Un hueco nuevo se
   ve como una celda en rojo, y agregar un paso o un dato obliga a
   llenar su renglón.

   Lo que NO se pide aquí: que el bot cambie de tema. Se pide que el
   dato quede guardado. Qué pregunta después es cosa de cada paso.
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
function titulo(t) { console.log('\n== ' + t.toUpperCase() + ' =='); }

/* Un viaje a medio armar en cada paso: solo lo que ese paso ya tendría.
   Lo demás queda hueco a propósito. */
const ESTADOS = {
  cuantos:    { paso: 'cuantos', destino: 'Chapala' },
  destino:    { paso: 'destino', gente: 40 },
  origen:     { paso: 'origen', destino: 'Chapala', gente: 40, unidad: 'autobus' },
  salida:     { paso: 'salida', destino: 'Chapala', gente: 40, origen: 'Guadalajara',
                unidad: 'autobus' },
  regreso:    { paso: 'regreso', destino: 'Chapala', gente: 40, origen: 'Guadalajara',
                unidad: 'autobus', salida: '2026-12-20' },
  elegirBus:  { paso: 'elegirBus', destino: 'Chapala', gente: 40, origen: 'Guadalajara',
                unidad: 'autobus', salida: '2026-12-20', regreso: '2026-12-23' },
  recorridos: { paso: 'recorridos', destino: 'Chapala', gente: 40, origen: 'Guadalajara',
                unidad: 'autobus', unidadNombre: 'Irizar i6S', unidadId: 'irizar-i6s',
                salida: '2026-12-20', regreso: '2026-12-23' },
  confirmar:  { paso: 'confirmar', destino: 'Chapala', gente: 40, origen: 'Guadalajara',
                unidad: 'autobus', unidadNombre: 'Irizar i6S', unidadId: 'irizar-i6s',
                salida: '2026-12-20', regreso: '2026-12-23', recorridos: 2 }
};

/* Cada dato, dicho como lo dice un cliente, y cómo se comprueba. */
const DATOS = [
  ['cuántos son', 'somos 33', function (e) { return Number(e.gente) === 33; }],
  ['el destino', 'vamos a tequila', function (e) { return e.destino === 'Tequila'; }],
  ['de dónde salen', 'salimos de zapopan', function (e) { return e.origen === 'Zapopan'; }],
  ['qué camión quieren', 'quiero el neobus',
    function (e) { return /neobus/i.test(e.unidadNombre || ''); }],
  ['que es sencillo', 'es solo de ida', function (e) { return e.soloIda === true; }],
  ['la ocasión', 'es para una boda', function (e) { return !!e.ocasion; }]
];

titulo('la tabla: cada paso contra cada dato');
{
  for (const paso of Object.keys(ESTADOS)) {
    for (const [nombre, dice, comprueba] of DATOS) {
      const antes = ESTADOS[paso];
      /* Si ya venía puesto, la celda no prueba nada: se da por buena. */
      if (comprueba(antes)) { buenas++; continue; }
      let quedo = false;
      try {
        const r = conv.respuestaA(dice, Object.assign({}, antes), HOY);
        quedo = comprueba(r.estado || {});
      } catch (e) { quedo = false; }
      ok('en «' + paso + '» se guarda ' + nombre + ' («' + dice + '»)', quedo);
    }
  }
}

titulo('y guardarlo no es tragárselo en silencio');
{
  /* Un dato que cambia el PRECIO no se cambia calladito: se acusa, para
     que el cliente lo corrija si se entendió mal. El destino y cuántos
     son mueven el precio; el resto no tanto. */
  const r = conv.respuestaA('vamos a tequila',
    Object.assign({}, ESTADOS.recorridos), HOY);
  ok('cambiar el destino se dice en voz alta', /tequila/i.test(r.texto || ''));

  const g = conv.respuestaA('somos 33', Object.assign({}, ESTADOS.confirmar), HOY);
  ok('cambiar cuántos son se dice en voz alta', /33/.test(g.texto || ''));
}

titulo('lo que NO debe absorberse');
{
  /* El «sí» de la confirmación es una respuesta, no un dato suelto: si
     `absorbeLoDemas` se lo comiera, el viaje no se cerraría nunca.
     Con autobús no sale `cotiza` sino `pasa` —el precio lo pone una
     persona—, así que lo que se vigila es que la solicitud salga. */
  for (const si of ['si', 'sale', 'dale', 'va', 'ok', 'esta bien']) {
    const r = conv.respuestaA(si, Object.assign({}, ESTADOS.confirmar), HOY);
    ok('«' + si + '» en confirmar cierra la solicitud', r.pasa === true);
  }

  /* Y un número contestando los movimientos son movimientos, no gente
     ni un día. */
  const m = conv.respuestaA('2', Object.assign({}, ESTADOS.recorridos), HOY);
  ok('un «2» en recorridos son movimientos', m.estado && m.estado.recorridos === 2);
  ok('  y no cambia cuántos son', !m.estado || Number(m.estado.gente) === 40);
  ok('  ni la fecha', !m.estado || m.estado.salida === '2026-12-20');

  /* Escoger el camión de la lista es escoger, no «mencionar» otro. */
  const b = conv.respuestaA('el i6s', Object.assign({}, ESTADOS.elegirBus), HOY);
  ok('en elegirBus se escoge el que dice', b.estado && /i6s/i.test(b.estado.unidadNombre || ''));
}

console.log('\n' + buenas + ' buenas, ' + malas + ' malas');
process.exit(malas ? 1 : 0);
