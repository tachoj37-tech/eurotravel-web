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
  /* `desglose` se agrego el 24-ago-2026 con las noches extra y los
     movimientos. La asercion cambio de lado a proposito: sin el, el precio le
     subia al cliente nueve mil pesos al capturar movimientos y nada en
     pantalla decia por que. Se revisa abajo que el desglose NO delate la
     regla del kilometro. */
  igual('las llaves que salen son solo estas',
    Object.keys(afuera).sort(),
    ['anticipo', 'desglose', 'iva', 'ivaIncluido', 'porcentajeAnticipo', 'saldo', 'subtotal', 'total']);
  cierto('y `interno` sí trae la tarifa, para el servidor', p.interno.tarifaKm === 35);
})();

/* Con noches extra y movimientos encima, lo que sale sigue sin delatar nada. */
(function () {
  const p = t.calcula(1200, 6, {
    noches: 5,
    movimientos: [{ horaInicio: '08:00', horaFin: '18:00' }]
  });
  const afuera = Object.assign({}, p);
  delete afuera.interno;
  igual('con movimientos, fuera de `interno` tampoco van km ni tarifa',
    JSON.stringify(afuera).match(/km|tarifa|tramo|1200/i), null);
  cierto('y las horas capturadas se quedan del lado del servidor',
    JSON.stringify(p.interno.horasMovimiento) === '[10]');
})();

/* ============ LAS NOCHES ============
   NOCHES no es lo mismo que DIAS DE SERVICIO, y confundirlas cuesta mil pesos
   por viaje: del 3 al 6 son cuatro dias y tres noches. */

igual('del 3 al 6 de septiembre: 3 noches', t.nochesDe('2026-09-03T08:00', '2026-09-06T18:00'), 3);
igual('los mismos dias son 4 de servicio', t.diasDeServicio('2026-09-03T08:00', '2026-09-06T18:00'), 4);
igual('ida y vuelta el mismo dia: 0 noches', t.nochesDe('2026-09-03T08:00', '2026-09-03T22:00'), 0);
igual('sin regreso: 0 noches', t.nochesDe('2026-09-03T08:00', ''), 0);
igual('cruzando el año: 3 noches', t.nochesDe('2026-12-30', '2027-01-02'), 3);
igual('febrero bisiesto: 2 noches', t.nochesDe('2028-02-28', '2028-03-01'), 2);

/* El borde exacto: tres noches todavia no cuestan; la cuarta si.
   Viaje de 400 km, 6 dias de servicio -> manda el minimo, 6 × 3,000 = 18,000 */
(function () {
  igual('3 noches: nada extra', t.calcula(400, 6, { noches: 3 }).total, 18000);
  igual('4 noches: mil pesos', t.calcula(400, 6, { noches: 4 }).total, 19000);
  igual('5 noches: dos mil', t.calcula(400, 6, { noches: 5 }).total, 20000);
  igual('10 noches: siete mil', t.calcula(400, 6, { noches: 10 }).total, 25000);
  igual('0 noches: nada extra', t.calcula(400, 6, { noches: 0 }).total, 18000);
  igual('sin decir nada de noches: nada extra', t.calcula(400, 6).total, 18000);
  /* Las noches se cuentan en `interno`, no en `desglose`: al cliente se le
     enseñan ya sumadas al traslado para no delatar la tarifa por noche. */
  igual('y el servidor las cuenta bien', t.calcula(400, 6, { noches: 5 }).interno.nochesExtra, 2);
})();

/* ============ LAS HORAS DE UN DIA CON MOVIMIENTO ============ */

igual('de 08:00 a 16:00 son 8 horas', t.horasDe('08:00', '16:00'), 8);
igual('de 08:00 a 17:30 son 9.5', t.horasDe('08:00', '17:30'), 9.5);
igual('la hora de fin antes que la de inicio no vale', t.horasDe('20:00', '02:00'), 0);
igual('la misma hora no vale', t.horasDe('08:00', '08:00'), 0);
igual('basura no vale', t.horasDe('manana', 'tarde'), 0);
igual('una hora imposible no vale', t.horasDe('08:00', '25:00'), 0);
igual('sin nada no vale', t.horasDe(null, undefined), 0);

/* ============ LAS BANDAS, EN SUS BORDES EXACTOS ============
        hasta 8 .......... 3,000
        mas de 8 y ≤9 .... 3,500
        mas de 9 y ≤10 ... 4,000
        mas de 10 y ≤12 .. 4,500
        mas de 12 ........ 5,000 */
(function () {
  function precioDe(inicio, fin) { return t.bandaDe(t.horasDe(inicio, fin)).precio; }

  igual('2 horas: el piso, 3,000', precioDe('08:00', '10:00'), 3000);
  igual('8 horas justas: 3,000', precioDe('08:00', '16:00'), 3000);
  igual('un minuto pasado de 8: 3,500', precioDe('08:00', '16:01'), 3500);
  igual('9 horas justas: 3,500', precioDe('08:00', '17:00'), 3500);
  igual('9 horas y media: 4,000 (la partida cae en la banda de arriba)',
    precioDe('08:00', '17:30'), 4000);
  igual('10 horas justas: 4,000', precioDe('08:00', '18:00'), 4000);
  igual('un minuto pasado de 10: 4,500', precioDe('08:00', '18:01'), 4500);
  igual('11 horas: 4,500', precioDe('08:00', '19:00'), 4500);
  igual('12 horas justas: 4,500', precioDe('08:00', '20:00'), 4500);
  igual('un minuto pasado de 12: 5,000', precioDe('08:00', '20:01'), 5000);
  igual('13 horas: 5,000', precioDe('08:00', '21:00'), 5000);
  igual('14 horas: 5,000', precioDe('08:00', '22:00'), 5000);
  igual('casi el dia entero: sigue siendo 5,000', precioDe('00:00', '23:59'), 5000);
  igual('horas ilegibles: caen en el piso, no en el techo',
    t.bandaDe(t.horasDe('x', 'y')).precio, 3000);
})();

/* ============ LOS MOVIMIENTOS, YA ACOTADOS ============ */
(function () {
  const tres = [
    { horaInicio: '08:00', horaFin: '16:00' },   // 8 h  -> 3,000
    { horaInicio: '08:00', horaFin: '18:00' },   // 10 h -> 4,000
    { horaInicio: '08:00', horaFin: '21:00' }    // 13 h -> 5,000
  ];

  igual('tres dias con movimiento: 12,000',
    t.precioMovimientos(t.movimientosDe(tres, 5)), 12000);

  /* No puede haber mas dias con movimiento que noches de estadia. Es la misma
     regla que aplica la pantalla, y TIENE que ser la misma: si el servidor
     contara mas dias que los que el cliente vio, se le cobraria de mas. */
  igual('con 2 noches, solo cuentan 2 dias',
    t.movimientosDe(tres, 2).length, 2);
  igual('con 0 noches, ninguno', t.movimientosDe(tres, 0).length, 0);
  igual('sin noches declaradas, ninguno', t.movimientosDe(tres).length, 0);
  igual('una lista que no es lista: ninguno', t.movimientosDe('muchos', 5).length, 0);
  igual('renglones vacios: caen en el piso',
    t.precioMovimientos(t.movimientosDe([{}, {}], 3)), 6000);

  /* Y el tope duro, contra una lista inventada */
  const milesDeDias = [];
  for (let i = 0; i < 5000; i++) milesDeDias.push({ horaInicio: '08:00', horaFin: '22:00' });
  igual('cinco mil dias con 3 noches: solo 3', t.movimientosDe(milesDeDias, 3).length, 3);
  igual('cinco mil dias con mil noches: el tope duro',
    t.movimientosDe(milesDeDias, 1000).length, t.TOPE_DIAS_MOVIMIENTO);
})();

/* ============ EL VIAJE COMPLETO, EN EL ORDEN QUE DICTO EL DUEÑO ============
   Primero los kilometros, luego las noches, al final los movimientos.

     400 km × 35 = 14,000  ·  minimo 6 dias × 3,000 = 18,000 -> gana el minimo
     5 noches -> 2 extra × 1,000 ................................ + 2,000
     movimientos de 8 h, 10 h y 13 h = 3,000 + 4,000 + 5,000 .... + 12,000
                                                                  --------
                                                                    32,000 */
(function () {
  const p = t.calcula(400, 6, {
    noches: 5,
    movimientos: [
      { horaInicio: '08:00', horaFin: '16:00' },
      { horaInicio: '08:00', horaFin: '18:00' },
      { horaInicio: '08:00', horaFin: '21:00' }
    ]
  });

  igual('el traslado, solo', p.interno.traslado, 18000);
  igual('las noches extra', p.interno.importeNoches, 2000);
  igual('los movimientos', p.desglose.importeMovimientos, 12000);
  igual('el total', p.total, 32000);
  igual('las tres partes suman el total',
    p.interno.traslado + p.interno.importeNoches + p.desglose.importeMovimientos, p.total);

  /* Y lo que ve el cliente son DOS numeros que tambien suman el total. Si el
     desglose no cuadrara con el total pareceria un error de cuentas, y eso es
     peor que no dar desglose. */
  igual('el cliente ve traslado y noches juntos', p.desglose.servicio, 20000);
  igual('y sus dos numeros suman el total',
    p.desglose.servicio + p.desglose.importeMovimientos, p.total);
  igual('la tarifa por noche NO sale del desglose',
    Object.keys(p.desglose).sort(), ['diasMovimiento', 'importeMovimientos', 'servicio']);

  /* El anticipo sale del total FINAL, no del traslado. Si saliera del
     traslado, se apartaria un viaje de 32,000 con el anticipo de uno de
     18,000: 3,600 en vez de 6,400. */
  igual('el anticipo es el 20% del total final', p.anticipo, 6400);
  igual('y el saldo, lo que queda', p.saldo, 25600);
  igual('anticipo + saldo = total', p.anticipo + p.saldo, p.total);
})();

/* El corte a la centena cae SOLO sobre el traslado. Como las noches y los
   movimientos ya son multiplos de cien, el total sigue siendo redondo. */
(function () {
  let noRedondos = 0, casos = 0;
  const listas = [
    [],
    [{ horaInicio: '08:00', horaFin: '16:00' }],
    [{ horaInicio: '08:00', horaFin: '17:00' }, { horaInicio: '09:00', horaFin: '21:30' }],
    [{ horaInicio: '07:15', horaFin: '19:45' }, { horaInicio: '08:00', horaFin: '16:00' },
     { horaInicio: '10:00', horaFin: '23:00' }]
  ];
  for (let km = 33.3; km <= 2600; km += 37.7) {
    for (const noches of [0, 3, 4, 9]) {
      for (const lista of listas) {
        const p = t.calcula(km, noches + 1, { noches: noches, movimientos: lista });
        casos++;
        if (p.total % 100 !== 0) noRedondos++;
      }
    }
  }
  console.log('(' + casos.toLocaleString('es-MX') + ' combinaciones de km, noches y movimientos)');
  igual('el total siempre queda en centenas', noRedondos, 0);
})();

console.log('\n' + buenas + ' buenas, ' + malas + ' malas');
process.exit(malas ? 1 : 0);
