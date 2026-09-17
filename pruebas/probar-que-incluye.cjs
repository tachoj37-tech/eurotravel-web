/* ============================================================
   QUÉ INCLUYE EL SERVICIO, Y QUÉ NO VA EN EL SALUDO (16-sep-2026)
   ============================================================
   Dictado del dueño, tal cual:

     «no digas que incluye chofer en el saludo, solo renta de
      autobuses y sprinter; cuando te pregunten qué incluye vas a
      decir que incluye, separa gasolina y casetas, son dos cosas
      diferentes, les pones emojis; de igual forma cuando generes el
      ticket de cotización agrega que incluye»

   Antes había tres redacciones sueltas y en dos de ellas «combustible
   y casetas» iban en un mismo renglón. Ahora la lista vive UNA vez en
   `bot.js` (LO_QUE_INCLUYE) y de ahí la toman «¿qué incluye?», el
   mensaje del precio y el resumen previo al precio (ese último se
   vigila desde probar-agente.mjs, porque vive en whatsapp.mjs).
   ============================================================ */
'use strict';

const path = require('path');
const RAIZ = path.join(__dirname, '..');
const bot = require(path.join(RAIZ, 'bot.js'));
const agente = require(path.join(RAIZ, 'api', '_agente.js'));

let buenas = 0, malas = 0;
function ok(que, condicion) {
  if (condicion) { buenas++; console.log('ok   ' + que); }
  else { malas++; console.log('FALLA ' + que); }
}
function titulo(t) { console.log('\n== ' + t.toUpperCase() + ' =='); }

const HOY = '2026-09-16';
const LISTA = '👨‍✈️ Operador profesional\n⛽ Combustible\n🛣️ Casetas\n🛡️ Seguro de viajero\n📡 Monitoreo GPS 24/7';

titulo('1 · la lista: una sola, con emoji, combustible y casetas aparte');
{
  const l = bot.loQueIncluye();
  ok('la lista es la dictada', l === LISTA);
  const renglones = l.split('\n');
  ok('cinco renglones', renglones.length === 5);
  ok('cada renglón abre con su emoji', renglones.every(function (r) { return /^[^\w\s]/.test(r); }));
  ok('combustible va solo en su renglón', renglones.some(function (r) { return r === '⛽ Combustible'; }));
  ok('casetas va sola en el suyo', renglones.some(function (r) { return r === '🛣️ Casetas'; }));
  ok('ningún renglón junta las dos', !renglones.some(function (r) { return /combustible/i.test(r) && /caseta/i.test(r); }));
}

titulo('2 · el saludo: renta de autobuses y Sprinter, sin chofer');
{
  /* Tres variantes, escogidas por el largo del mensaje (largo % 3). */
  ['hola', 'buenas', 'buenos dias'].forEach(function (m) {
    const r = bot.respuestaA(m, null, HOY);
    const t = String((r && r.texto) || '');
    ok('«' + m + '»: no dice chofer', t.length > 0 && !/chofer/i.test(t));
    ok('  y sí dice autobuses y Sprinter', /autobuses y Sprinter/.test(t));
    ok('  y tampoco recita lo que incluye', !/combustible|casetas|operador/i.test(t));
  });
}

titulo('3 · «¿qué incluye?» contesta con la lista tal cual');
{
  ['que incluye', 'ke incluye el servicio', 'incluye gasolina?', 'trae casetas'].forEach(function (m) {
    const r = bot.respuestaA(m, null, HOY);
    const t = String((r && r.texto) || '');
    ok('«' + m + '»: trae la lista completa', t.indexOf(LISTA) >= 0);
  });
  const t = String(bot.respuestaA('que incluye', null, HOY).texto || '');
  ok('  ya no queda el «Combustible y casetas» de antes', !/Combustible y casetas/.test(t));
  ok('  ni las palomitas', !/✓/.test(t));
}

titulo('4 · el mensaje del precio dice qué incluye, renglón por renglón');
{
  const r = bot.textoDeCotizacion(
    { total: 9000, anticipo: 3000, saldo: 6000, dias: 3 },
    { origen: 'Guadalajara', destino: 'Chapala', salida: '2026-10-20', regreso: '2026-10-22', gente: 12, unidad: 'sprinter' });
  const t = String((r && r.texto) || '');
  ok('abre el bloque con «Incluye:»', t.indexOf('Incluye:\n' + LISTA) >= 0);
  ok('  después del total', t.indexOf('Total') < t.indexOf('Incluye:'));
  ok('  y antes del cierre', t.indexOf('Incluye:') < t.indexOf('te bloqueo'));
  ok('  sin el renglón viejo de una sola línea', !/Incluye operador, combustible, casetas/.test(t));
}

titulo('5 · la IA recibe la misma lista y la regla del saludo');
{
  const p = String(agente.instruccionesDelAgente({}) || '');
  ok('el prompt trae la lista tal cual', p.indexOf(LISTA) >= 0);
  ok('  y la regla de no juntar combustible y casetas', /nunca en el mismo renglón/.test(p));
  ok('  y la del saludo sin chofer', /sin mencionar chofer/.test(p));
  ok('  y la lista es excepción a las tres líneas', /la de qué incluye/.test(p));
  ok('  y ya no se presenta «con chofer»', !/autobuses con chofer para/.test(p));
}

console.log('\n' + buenas + ' buenas, ' + malas + ' malas');
process.exit(malas ? 1 : 0);
