/* ============================================================
   EL RASTRO DE DÓNDE SE ATORA (11-sep-2026 · fase 4)
   ============================================================
   Esta sesión encontró más de treinta defectos, y todos salieron de lo
   mismo: hablarle al bot a mano hasta que se trabara. Es un método
   caro y lento, y encuentra lo que a mí se me ocurre escribir — no lo
   que de verdad escriben los clientes.

   El bot ya sabía rendirse y llamar a una persona cuando no puede leer
   lo que le contestan. Lo que no hacía era dejar escrito POR QUÉ: el
   vendedor entraba a una conversación trabada sin saber qué frase no
   se entendió, y quien arregla el bot tenía que adivinarla.

   Desde hoy la respuesta trae `atorado` con el paso y la frase exacta,
   y el webhook la escribe. El defecto lo encuentra la producción.

   Esta batería cuida las dos mitades: que el rastro salga cuando toca,
   y que NO salga cuando la conversación va bien — un aviso que sale
   siempre no es un aviso, es ruido, y a los dos días nadie lo lee.
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

/* Le contesta puras cosas ilegibles al mismo paso hasta que se rinda. */
function seAtora(estadoInicial, frases) {
  let e = estadoInicial, r = null;
  for (const f of frases) {
    r = conv.respuestaA(f, e, HOY);
    e = r.estado;
    if (r.pasa) return r;
  }
  return r;
}

titulo('cuando se rinde, deja escrito dónde y con qué');
{
  const r = seAtora(
    { paso: 'salida', destino: 'Chapala', gente: 12, unidad: 'sprinter' },
    ['cuando se pueda', 'pues ya veremos', 'lo que se acomode', 'ahi luego vemos']);

  ok('se entregó a una persona', r.pasa === true);
  ok('y viene el rastro', !!r.atorado);
  ok('  con el paso donde se trabó', r.atorado && r.atorado.paso === 'salida');
  ok('  y con lo que el cliente escribió',
    r.atorado && /ahi luego vemos|lo que se acomode|pues ya veremos/.test(r.atorado.dijo));
  ok('  recortado, no el mensaje entero de quien escriba una novela',
    r.atorado && r.atorado.dijo.length <= 120);
}

titulo('y se traba en el paso que sea');
{
  const r = seAtora(
    { paso: 'regreso', destino: 'Chapala', gente: 12, unidad: 'sprinter',
      salida: '2026-12-20' },
    ['cuando acabe la fiesta', 'pues ya tarde', 'al ratito', 'cuando se pueda']);
  ok('se entregó', r.pasa === true);
  ok('y el rastro dice «regreso»', r.atorado && r.atorado.paso === 'regreso');
}

titulo('una conversación que va bien NO deja rastro');
{
  /* Si esto se rompe, el aviso sale en cada viaje y deja de servir:
     nadie revisa un registro que siempre tiene algo. */
  let e = null, vistos = 0;
  for (const m of ['hola', 'a chapala', 'somos 12', 'de guadalajara',
    '20 de diciembre', 'el 23', 'si']) {
    const r = conv.respuestaA(m, e, HOY);
    e = r.estado;
    if (r.atorado) vistos++;
  }
  ok('ni un rastro en un viaje que salió completo', vistos === 0);
}

titulo('el rastro no cambia lo que el cliente ve');
{
  const r = seAtora(
    { paso: 'salida', destino: 'Chapala', gente: 12, unidad: 'sprinter' },
    ['cuando se pueda', 'pues ya veremos', 'lo que se acomode', 'ahi luego vemos']);
  /* El cliente no se entera de que hubo un rastro: ve la misma frase de
     siempre, sin confesiones. */
  ok('sigue sin confesar que no entendió',
    !/no (la )?entend|no alcanc|no pude leer/i.test(r.texto || ''));
  ok('  y la frase es la de siempre', /te confirmo en un momento/i.test(r.texto || ''));
}

console.log('\n' + buenas + ' buenas, ' + malas + ' malas');
process.exit(malas ? 1 : 0);
