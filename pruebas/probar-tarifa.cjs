/* ============================================================
   Pruebas de las reglas del dinero
   ------------------------------------------------------------
       node pruebas/probar-tarifa.cjs

   Cada cuenta esperada esta escrita A MANO en el comentario, no
   sacada del propio codigo: si la prueba solo repitiera lo que
   hace la funcion, no comprobaria nada.
   ============================================================ */
'use strict';
const t = require('../api/_tarifa.js');

let buenas = 0, malas = 0;
function igual(nombre, dio, esperado) {
  const a = JSON.stringify(dio), b = JSON.stringify(esperado);
  if (a === b) { buenas++; console.log('ok   ' + nombre); }
  else { malas++; console.log('MAL  ' + nombre + '\n     dio      ' + a + '\n     esperaba ' + b); }
}
function cierto(nombre, v) { igual(nombre, !!v, true); }

/* ============ EL KILOMETRO POR TRAMOS ============ */

igual('0 km: nada', t.porTramos(0).total, 0);

//   100 × 35 = 3,500
igual('100 km, todo en el primer tramo', t.porTramos(100).total, 3500);

//   800 × 35 = 28,000
igual('800 km justos: el borde del primer tramo', t.porTramos(800).total, 28000);

//   800×35 + 1×28 = 28,000 + 28 = 28,028
igual('801 km: el kilometro 801 ya vale 28', t.porTramos(801).total, 28028);

//   800×35 + 200×28 = 28,000 + 5,600 = 33,600
igual('1,000 km justos: el borde del segundo tramo', t.porTramos(1000).total, 33600);

//   800×35 + 200×28 + 1×26 = 33,600 + 26 = 33,626
igual('1,001 km: el kilometro 1,001 ya vale 26', t.porTramos(1001).total, 33626);

//   800×35 + 200×28 + 200×26 = 28,000 + 5,600 + 5,200 = 38,800
igual('1,200 km: el ejemplo del dueño', t.porTramos(1200).total, 38800);

/* Ojo con esta: la primera vez la escribí con 1,200 km en el tercer tramo y
   falló. La equivocada era la prueba — de 1,000 a 2,000 hay MIL kilómetros,
   no mil doscientos. El código tenía razón.
     800×35 + 200×28 + 1000×26 = 28,000 + 5,600 + 26,000 = 59,600 */
igual('2,000 km: viaje largo', t.porTramos(2000).total, 59600);

/* LA PROPIEDAD QUE IMPORTA: mas kilometros SIEMPRE cuestan mas.
   Si se cobrara una sola tarifa segun el total, a 801 km costaria MENOS que a
   799 —un escalon absurdo— y convendria alargar el viaje. Con tramos, no. */
(function () {
  let anterior = -1, sube = true, dondeFalla = null;
  for (let km = 0; km <= 2500; km += 1) {
    const v = t.porTramos(km).total;
    if (v < anterior) { sube = false; dondeFalla = km; break; }
    anterior = v;
  }
  cierto('de 0 a 2,500 km el precio nunca baja al alargar el viaje' +
    (dondeFalla ? ' (falla en ' + dondeFalla + ')' : ''), sube);
})();

/* el desglose cuadra con el total, tramo por tramo */
(function () {
  const r = t.porTramos(1200);
  const suma = r.desglose.reduce(function (s, d) { return s + d.importe; }, 0);
  igual('el desglose suma exactamente el total', suma, r.total);
  igual('1,200 km caen en los tres tramos', r.desglose.map(function (d) { return d.km; }), [800, 200, 200]);
  igual('a los precios correctos', r.desglose.map(function (d) { return d.porKm; }), [35, 28, 26]);
})();

/* basura de entrada: no revienta ni cobra de mas */
igual('km negativos: 0', t.porTramos(-100).total, 0);
igual('km que no es numero: 0', t.porTramos('mucho').total, 0);
igual('km nulo: 0', t.porTramos(null).total, 0);

/* ============ DIAS DE SERVICIO ============ */

igual('salir y volver el mismo dia: 1 día', t.diasDeServicio('2026-09-03', '2026-09-03'), 1);
igual('del 3 al 6: 4 días, contados inclusive', t.diasDeServicio('2026-09-03', '2026-09-06'), 4);
igual('con hora pegada, igual', t.diasDeServicio('2026-09-03T08:00', '2026-09-06T18:00'), 4);
igual('sin regreso: 1 día', t.diasDeServicio('2026-09-03', ''), 1);
igual('fechas al reves: nunca menos de 1', t.diasDeServicio('2026-09-06', '2026-09-03'), 1);
/* del 31 de octubre al 2 de noviembre: cruza mes, y en 2026 México ya no
   tiene horario de verano, así que no hay hora que se cuele */
igual('cruzando de mes: 3 días', t.diasDeServicio('2026-10-31', '2026-11-02'), 3);

/* ============ EL CALCULO COMPLETO ============ */

/* Guadalajara–Vallarta redondo, 4 días: 621.2 km, primer tramo.
   621.2 × 35 = 21,742  ·  mínimo 4 × 3,000 = 12,000  ·  gana el kilometraje
   21,742 cortado a la centena de abajo = 21,700 */
(function () {
  const p = t.calcula(621.2, 4);
  igual('Vallarta redondo: total 21,700', p.total, 21700);
  igual('no aplicó el mínimo', p.interno.aplicoMinimo, false);
  igual('anticipo 20% redondeado al peso', p.anticipo, 4340);
  igual('saldo = total − anticipo, exacto', p.saldo, p.total - p.anticipo);
  igual('subtotal + IVA = total', Math.round((p.subtotal + p.iva) * 100) / 100, p.total);
})();

/* Un viaje largo que cruza los tres tramos: 1,200 km en 5 días.
   por tramos = 38,800  ·  mínimo 5 × 3,000 = 15,000  ·  gana el kilometraje
   38,800 ya es múltiplo de cien */
(function () {
  const p = t.calcula(1200, 5);
  igual('1,200 km en 5 días: 38,800', p.total, 38800);
  igual('el desglose de tramos se queda del lado del servidor',
    p.interno.tramos.map(function (d) { return d.porKm; }), [35, 28, 26]);
})();

/* Un viaje corto pero de muchos días: manda el mínimo.
   80 km × 35 = 2,800  ·  mínimo 3 × 3,000 = 9,000  ·  gana el mínimo */
(function () {
  const p = t.calcula(80, 3);
  igual('viaje corto de 3 días: manda el mínimo, 9,000', p.total, 9000);
  igual('y se acusa que aplicó', p.interno.aplicoMinimo, true);
})();

/* El redondeo SIEMPRE es hacia abajo, a favor del cliente */
(function () {
  //  700 × 35 = 24,500 exacto; 700.5 × 35 = 24,517.5 -> corta a 24,500
  igual('24,517.5 se corta a 24,500', t.calcula(700.5, 1).total, 24500);
  cierto('el total nunca queda por encima del bruto',
    t.calcula(933.7, 2).total <= t.calcula(933.7, 2).interno.sinRedondear);
})();

/* ============ LA REGLA DEL KILOMETRO ============ */

/* Lo que sale de calcula() se manda al navegador salvo `interno`. Aqui se
   comprueba que fuera de `interno` no viaje NADA con lo que se pueda sacar el
   precio por kilometro dividiendo. */
(function () {
  const p = t.calcula(1200, 5);
  const afuera = Object.assign({}, p);
  delete afuera.interno;
  igual('fuera de `interno` no van ni km ni tarifa',
    JSON.stringify(afuera).match(/km|tarifa|tramo|1200|38800\.\d/i), null);
  igual('las llaves que salen son solo estas',
    Object.keys(afuera).sort(),
    ['anticipo', 'iva', 'ivaIncluido', 'porcentajeAnticipo', 'saldo', 'subtotal', 'total']);
  cierto('y `interno` sí trae la tarifa, para el servidor', p.interno.tarifaKm === 35);
})();

console.log('\n' + buenas + ' buenas, ' + malas + ' malas');
process.exit(malas ? 1 : 0);
