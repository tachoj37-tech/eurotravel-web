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

/* ============ UNA SOLA TARIFA, ELEGIDA POR EL TOTAL ============
   TODOS los kilometros del viaje se cobran a la misma tarifa, y cual sea
   depende de cuanto mide el viaje completo:
       hasta 800 km ....... $34
       de 801 a 1,000 ..... $25
       de 1,001 en adelante $23 */

igual('0 km: nada', t.porKilometro(0).total, 0);

//   100 × 34 = 3,400
igual('100 km, en la primera banda', t.porKilometro(100).total, 3400);

//   800 × 34 = 27,200
igual('800 km justos: todavia la primera banda', t.porKilometro(800).total, 27200);

//   801 × 25 = 20,025   <- los 801, no solo el que se paso
igual('801 km: los OCHOCIENTOS UNO a 25', t.porKilometro(801).total, 20025);

//   1,000 × 25 = 25,000
igual('1,000 km justos: todavia la segunda banda', t.porKilometro(1000).total, 25000);

//   1,001 × 23 = 23,023   <- otra vez, TODOS
igual('1,001 km: los mil uno a 23', t.porKilometro(1001).total, 23023);

//   2,000 × 23 = 46,000
igual('2,000 km: viaje largo', t.porKilometro(2000).total, 46000);

igual('la tarifa que aplico se puede consultar', t.porKilometro(900).porKm, 25);

/* ------------------------------------------------------------------
   AQUI ESTABA LA PRUEBA CONTRARIA, Y CAMBIO DE LADO A PROPOSITO
   ------------------------------------------------------------------
   Antes esta prueba exigia que "mas kilometros SIEMPRE cuesten mas", y su
   comentario decia que cobrar una sola tarifa segun el total tendria un
   escalon absurdo. Con la regla vieja —por tramos— eso era cierto.

   El dueño cambio la regla el 24-ago-2026, con la comparacion enfrente:
   se le enseño que a 801 km se cobrarian $7,200 MENOS que a 800, y que de
   801 a 1,182 km todos los viajes cobrarian menos que uno de 800. Se le
   ofrecio la alternativa sin escalon (las mismas tarifas 34/25/23 pero por
   tramos) y eligio esta.

   Asi que la prueba ya no exige que no haya escalon: exige que el escalon
   sea EXACTAMENTE el que se aprobo. Si un dia alguien lo "arregla" creyendo
   que es un defecto, esto se lo dice.
   ------------------------------------------------------------------ */
(function () {
  const corta = n => Math.floor(n / 100) * 100;
  const traslado = km => corta(t.porKilometro(km).total);

  igual('a 800 km se cobra 27,200', traslado(800), 27200);
  igual('a 801 km se cobra 20,000', traslado(801), 20000);
  igual('o sea que un kilometro mas baja el precio 7,200',
    traslado(800) - traslado(801), 7200);
  igual('y a 1,001 baja otros 2,000 contra los 1,000',
    traslado(1000) - traslado(1001), 2000);

  /* Hasta donde llega el hoyo: cuantos kilometros cobran menos que 800 km */
  let desde = 801, hasta = 801;
  while (traslado(hasta) < traslado(800) && hasta < 6000) hasta++;
  igual('el hoyo va de 801 a 1,182 km', [desde, hasta - 1], [801, 1182]);

  /* Dentro de cada banda, eso si, mas kilometros siempre cuestan mas. */
  let rompe = null;
  [[0, 800], [801, 1000], [1001, 2500]].forEach(function (b) {
    let ant = -1;
    for (let km = b[0]; km <= b[1]; km++) {
      const v = t.porKilometro(km).total;
      if (v < ant) { rompe = km; break; }
      ant = v;
    }
  });
  igual('dentro de una banda el precio nunca baja', rompe, null);
})();

/* basura de entrada: no revienta ni cobra de mas */
igual('km negativos: 0', t.porKilometro(-100).total, 0);
igual('km que no es numero: 0', t.porKilometro('mucho').total, 0);
igual('km nulo: 0', t.porKilometro(null).total, 0);

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

/* Guadalajara–Vallarta redondo, 4 días: 621.2 km, primera banda.
   621.2 × 34 = 21,120.8  ·  mínimo 4 × 3,000 = 12,000  ·  gana el kilometraje
   21,120.8 cortado a la centena de abajo = 21,100 */
(function () {
  const p = t.calcula(621.2, 4);
  igual('Vallarta redondo: total 21,100', p.total, 21100);
  igual('no aplicó el mínimo', p.interno.aplicoMinimo, false);
  igual('anticipo 20% redondeado al peso', p.anticipo, 4220);
  igual('saldo = total − anticipo, exacto', p.saldo, p.total - p.anticipo);
  igual('subtotal + IVA = total', Math.round((p.subtotal + p.iva) * 100) / 100, p.total);
})();

/* Un viaje de 1,200 km en 5 días: cae en la tercera banda, TODOS a 23.
   1,200 × 23 = 27,600  ·  mínimo 5 × 3,000 = 15,000  ·  gana el kilometraje */
(function () {
  const p = t.calcula(1200, 5);
  igual('1,200 km en 5 días: 27,600', p.total, 27600);
  igual('la tarifa que aplicó se queda del lado del servidor', p.interno.tarifaKm, 23);
  igual('y el kilometraje también', p.interno.km, 1200);
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
  //  700 × 34 = 23,800 exacto; 700.5 × 34 = 23,817 -> corta a 23,800
  igual('23,817 se corta a 23,800', t.calcula(700.5, 1).total, 23800);
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
  /* 1,200 km caen en la tercera banda: todos a 23 */
  cierto('y `interno` sí trae la tarifa, para el servidor', p.interno.tarifaKm === 23);
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

/* ============ DESTINOS CON REGLA PROPIA ============
   En la Huasteca Potosina el dia con movimientos vale 3,000 SIEMPRE, cueste
   4 horas o 14. Las bandas de horas no aplican alla. */
(function () {
  const HUASTECA_ID = 'ChIJv8IdsTSP1oURPsKDyokOts4';   // el de lugares.js

  /* Se reconoce por el placeId del catalogo... */
  cierto('la Huasteca se reconoce por su placeId',
    t.reglaDeDestino({ placeId: HUASTECA_ID }) !== null);
  /* ...y de rebote por el texto, para cuando marcan un hotel de alla */
  cierto('y tambien si viene en la direccion',
    t.reglaDeDestino({ direccion: 'Hotel Taninul, Huasteca Potosina, SLP' }) !== null);
  cierto('sin acentos ni mayusculas tambien',
    t.reglaDeDestino({ direccion: 'ciudad valles, huasteca' }) !== null);
  igual('Vallarta no trae regla propia',
    t.reglaDeDestino({ placeId: 'ChIJ_otro', direccion: 'Puerto Vallarta, Jalisco' }), null);
  igual('sin destino, ninguna regla', t.reglaDeDestino(null), null);

  /* Cuatro dias con horas MUY distintas: en la Huasteca todos valen 3,000 */
  const dias = [
    { horaInicio: '08:00', horaFin: '12:00' },   // 4 h   -> banda normal 3,000
    { horaInicio: '08:00', horaFin: '18:00' },   // 10 h  -> banda normal 4,000
    { horaInicio: '07:00', horaFin: '21:00' },   // 14 h  -> banda normal 5,000
    { horaInicio: '06:00', horaFin: '20:30' }    // 14.5h -> banda normal 5,000
  ];

  const enLaHuasteca = t.movimientosDe(dias, 5, t.reglaDeDestino({ placeId: HUASTECA_ID }));
  igual('en la Huasteca los cuatro dias valen 3,000',
    enLaHuasteca.map(function (m) { return m.precio; }), [3000, 3000, 3000, 3000]);
  igual('o sea 12,000 por los cuatro', t.precioMovimientos(enLaHuasteca), 12000);

  /* pero las horas SI se guardan: el operador necesita saber a que hora */
  igual('y las horas no se pierden',
    enLaHuasteca.map(function (m) { return m.horas; }), [4, 10, 14, 14.5]);

  /* En cualquier otro destino, las mismas horas cuestan lo de siempre */
  const enVallarta = t.movimientosDe(dias, 5, null);
  igual('en otro destino mandan las bandas',
    enVallarta.map(function (m) { return m.precio; }), [3000, 4000, 5000, 5000]);
  igual('que son 17,000', t.precioMovimientos(enVallarta), 17000);

  /* Y el viaje completo, por la puerta de calcula() */
  const viaje = { noches: 4, movimientos: dias };
  const huasteca = t.calcula(900, 5, Object.assign({ destino: { placeId: HUASTECA_ID } }, viaje));
  const otro = t.calcula(900, 5, Object.assign({ destino: { placeId: 'ChIJ_otro' } }, viaje));

  //  900 km caen en la segunda banda: 900 × 25 = 22,500  ·  minimo 15,000
  //  4 noches -> 1 extra = 1,000     ·  movimientos 12,000 contra 17,000
  igual('Huasteca: 22,500 + 1,000 + 12,000', huasteca.total, 35500);
  igual('otro destino: 22,500 + 1,000 + 17,000', otro.total, 40500);
  igual('la diferencia son los 5,000 de las bandas', otro.total - huasteca.total, 5000);
  igual('y el contrato sabra por que', huasteca.interno.reglaDestino, 'Huasteca Potosina');
  igual('en otro destino no hay regla que explicar', otro.interno.reglaDestino, null);
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
  /* `reglaDestino` es un NOMBRE, no una tarifa: la pantalla lo necesita para
     no prometer «8 horas incluidas» donde el día es tarifa fija. */
  igual('la tarifa por noche NO sale del desglose',
    Object.keys(p.desglose).sort(),
    ['diasMovimiento', 'importeMovimientos', 'reglaDestino', 'servicio']);

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
