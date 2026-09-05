/* Lo que el dueño contesta a un precio por confirmar: «va», un número, o texto. */
'use strict';
const { interpreta } = require('../api/_confirmacion.js');

let buenas = 0, malas = 0;
function igual(nombre, dado, esperado) {
  const ok = JSON.stringify(dado) === JSON.stringify(esperado);
  if (ok) buenas++; else malas++;
  console.log((ok ? 'ok    ' : 'FALLA ') + nombre + (ok ? '' : '\n      dio ' + JSON.stringify(dado) + ', se esperaba ' + JSON.stringify(esperado)));
}

// «va» y parientes
for (const t of ['va', 'Va', 'VA!', 'ok', 'sí', 'si', 'dale', 'adelante', 'mándalo', 'listo', '👍', 'sale.']) {
  igual('«' + t + '» es va', interpreta(t), { tipo: 'va' });
}

// números
igual('48000', interpreta('48000'), { tipo: 'precio', total: 48000 });
igual('48,000', interpreta('48,000'), { tipo: 'precio', total: 48000 });
igual('48.000 (miles con punto)', interpreta('48.000'), { tipo: 'precio', total: 48000 });
igual('$48,000', interpreta('$48,000'), { tipo: 'precio', total: 48000 });
igual('48 mil', interpreta('48 mil'), { tipo: 'precio', total: 48000 });
igual('48k', interpreta('48k'), { tipo: 'precio', total: 48000 });
igual('48.5 mil', interpreta('48.5 mil'), { tipo: 'precio', total: 48500 });
igual('48,000 pesos', interpreta('48,000 pesos'), { tipo: 'precio', total: 48000 });
igual('1000 es el minimo', interpreta('1000'), { tipo: 'precio', total: 1000 });

// texto: todo lo demas se le pasa literal al cliente
igual('vacio', interpreta(''), { tipo: 'texto' });
igual('«2» es texto, no precio', interpreta('2'), { tipo: 'texto' });
igual('«999» es texto', interpreta('999'), { tipo: 'texto' });
igual('«va a estar en 48000» es texto (frase)', interpreta('va a estar en 48000'), { tipo: 'texto' });
igual('«no, dile que 50» es texto', interpreta('no, dile que 50'), { tipo: 'texto' });
igual('«vale» no es va (palabra distinta)', interpreta('vale'), { tipo: 'texto' });
igual('«ok pero dile que mañana» es texto', interpreta('ok pero dile que mañana'), { tipo: 'texto' });

console.log('\n' + buenas + ' buenas, ' + malas + ' malas');
process.exit(malas ? 1 : 0);
