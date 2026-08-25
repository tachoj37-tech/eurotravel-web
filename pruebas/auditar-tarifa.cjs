/* ============================================================
   Auditoria independiente del precio
   ------------------------------------------------------------
       node pruebas/auditar-tarifa.cjs

   Las otras pruebas comprueban casos. Esta comprueba la REGLA, y
   lo hace calculando por su cuenta: las tarifas de abajo estan
   escritas a mano, no leidas de _tarifa.js. Si el archivo del
   dinero tuviera un error, una prueba que use sus propias
   constantes lo repetiria y no lo veria. Esta no.

   Barre cada kilometro de 0 a 3,000 y cada combinacion de dias,
   noches y movimientos.
   ============================================================ */
'use strict';
const t = require('../api/_tarifa.js');

let buenas = 0, malas = 0;
function igual(nombre, dio, esperado) {
  const a = JSON.stringify(dio), b = JSON.stringify(esperado);
  if (a === b) { buenas++; console.log('ok   ' + nombre); }
  else { malas++; console.log('MAL  ' + nombre + '\n     dio      ' + a + '\n     esperaba ' + b); }
}

/* ---- LAS REGLAS, ESCRITAS A MANO ----
   Esto es lo que el dueño dicto, en palabras, vuelto formula. Si algun dia
   cambia una tarifa hay que cambiarla EN LOS DOS LADOS, y que haya que
   hacerlo dos veces es justamente lo que hace util esta prueba. */
const corta = n => Math.floor(n / 100) * 100;

function tarifaDelViaje(km) {
  if (km <= 800) return 34;
  if (km <= 1000) return 25;
  return 23;
}
function trasladoAMano(km, dias) {
  const porKm = km * tarifaDelViaje(km);
  const minimo = dias * 3000;
  return corta(Math.max(porKm, minimo));
}
function nochesAMano(noches) {
  return Math.max(0, noches - 3) * 1000;
}
function diaDeMovimientoAMano(horas, esHuasteca) {
  if (esHuasteca) return 3000;
  if (horas <= 8) return 3000;
  if (horas <= 9) return 3500;
  if (horas <= 10) return 4000;
  if (horas <= 12) return 4500;
  return 5000;
}

/* ============ 1. CADA KILOMETRO, DE 0 A 3,000 ============ */
(function () {
  let malos = 0, primero = null;
  for (let km = 0; km <= 3000; km++) {
    const esperado = km * tarifaDelViaje(km);
    if (Math.abs(t.porKilometro(km).total - esperado) > 0.000001) {
      malos++;
      if (primero === null) primero = km;
    }
  }
  igual('los 3,001 kilometros enteros dan lo que dice la regla', [malos, primero], [0, null]);

  /* y con decimales, que es como llegan de Google */
  let malosDec = 0;
  for (let km = 0.1; km <= 3000; km += 7.3) {
    const esperado = km * tarifaDelViaje(km);
    if (Math.abs(t.porKilometro(km).total - esperado) > 0.000001) malosDec++;
  }
  igual('y con decimales tambien', malosDec, 0);
})();

/* ============ 2. LOS BORDES EXACTOS DE CADA BANDA ============ */
igual('799 km a 34', t.porKilometro(799).total, 799 * 34);
igual('800 km a 34 (el borde es INCLUSIVE)', t.porKilometro(800).total, 800 * 34);
igual('800.001 km ya a 25', t.porKilometro(800.001).total, 800.001 * 25);
igual('1,000 km a 25 (el borde es INCLUSIVE)', t.porKilometro(1000).total, 1000 * 25);
igual('1,000.001 km ya a 23', t.porKilometro(1000.001).total, 1000.001 * 23);

/* ============ 3. EL VIAJE COMPLETO, MILES DE COMBINACIONES ============ */
(function () {
  const HUASTECA = { placeId: 'ChIJv8IdsTSP1oURPsKDyokOts4' };
  const OTRO = { placeId: 'ChIJ_cualquier_otro', direccion: 'Puerto Vallarta, Jalisco' };

  const JUEGOS_DE_MOVIMIENTOS = [
    [],
    [{ horaInicio: '08:00', horaFin: '16:00', horas: 8 }],
    [{ horaInicio: '08:00', horaFin: '17:30', horas: 9.5 }, { horaInicio: '09:00', horaFin: '21:00', horas: 12 }],
    [{ horaInicio: '07:00', horaFin: '21:00', horas: 14 }, { horaInicio: '08:00', horaFin: '16:00', horas: 8 },
     { horaInicio: '08:00', horaFin: '18:01', horas: 10 + 1 / 60 }]
  ];

  let casos = 0;
  const rotos = { total: [], anticipo: [], desglose: [], huasteca: [] };

  for (let km = 0; km <= 2600; km += 13) {
    for (const dias of [1, 3, 4, 6, 9, 15]) {
      const noches = Math.max(0, dias - 1);
      for (let j = 0; j < JUEGOS_DE_MOVIMIENTOS.length; j++) {
        const movs = JUEGOS_DE_MOVIMIENTOS[j];
        for (const destino of [OTRO, HUASTECA]) {
          const esHuasteca = destino === HUASTECA;
          casos++;

          // --- a mano ---
          const cuantos = Math.min(movs.length, noches);
          let movAMano = 0;
          for (let i = 0; i < cuantos; i++) {
            movAMano += diaDeMovimientoAMano(movs[i].horas, esHuasteca);
          }
          const esperado = trasladoAMano(km, dias) + nochesAMano(noches) + movAMano;

          // --- lo que hace la pagina ---
          const p = t.calcula(km, dias, { noches: noches, movimientos: movs, destino: destino });

          if (p.total !== esperado) rotos.total.push({ km, dias, noches, esHuasteca, dio: p.total, esperaba: esperado });
          if (p.anticipo !== Math.round(esperado * 0.2)) rotos.anticipo.push({ km, dias, dio: p.anticipo });
          if (p.desglose.servicio + p.desglose.importeMovimientos !== p.total) rotos.desglose.push({ km, dias });
          if (esHuasteca && p.desglose.importeMovimientos !== cuantos * 3000) {
            rotos.huasteca.push({ km, dias, dio: p.desglose.importeMovimientos, esperaba: cuantos * 3000 });
          }
        }
      }
    }
  }

  console.log('(' + casos.toLocaleString('es-MX') + ' viajes, calculados dos veces por caminos distintos)');
  igual('el total coincide con la regla, en todos', rotos.total.length, 0);
  igual('el anticipo es el 20% del total final, en todos', rotos.anticipo.length, 0);
  igual('lo que ve el cliente suma el total, en todos', rotos.desglose.length, 0);
  igual('en la Huasteca el dia SIEMPRE vale 3,000', rotos.huasteca.length, 0);
  if (rotos.total.length) console.log('   primeros fallos: ' + JSON.stringify(rotos.total.slice(0, 3)));
})();

/* ============ 4. ¿DE VERDAD BAJARON TODOS LOS VIAJES? ============
   El dueño pidio que las tarifas nuevas abarataran TODOS los viajes, no solo
   los largos. Aqui se comprueba contra la regla vieja, escrita a mano. */
(function () {
  function viejoPorTramos(km) {
    let restan = km, piso = 0, total = 0;
    for (const b of [{ hasta: 800, p: 35 }, { hasta: 1000, p: 28 }, { hasta: Infinity, p: 26 }]) {
      const caben = Math.min(restan, b.hasta - piso);
      if (caben > 0) { total += caben * b.p; restan -= caben; }
      piso = b.hasta;
      if (restan <= 0) break;
    }
    return total;
  }

  let subieron = 0, primeroQueSube = null, iguales = 0, bajaron = 0;
  for (let km = 1; km <= 3000; km++) {
    const antes = corta(viejoPorTramos(km));
    const ahora = corta(t.porKilometro(km).total);
    if (ahora > antes) { subieron++; if (primeroQueSube === null) primeroQueSube = km; }
    else if (ahora === antes) iguales++;
    else bajaron++;
  }
  console.log('(de 3,000 kilometrajes: ' + bajaron.toLocaleString('es-MX') + ' bajaron, ' +
    iguales + ' quedaron igual, ' + subieron + ' subieron)');
  igual('NINGUN viaje cuesta mas que con la tarifa vieja',
    [subieron, primeroQueSube], [0, null]);
})();

/* ============ 5. LO QUE EL CLIENTE NO PUEDE VER ============ */
(function () {
  let fugas = 0;
  for (let km = 100; km <= 2600; km += 97) {
    const p = t.calcula(km, 5, {
      noches: 6,
      movimientos: [{ horaInicio: '08:00', horaFin: '18:00' }],
      destino: { placeId: 'ChIJv8IdsTSP1oURPsKDyokOts4' }
    });
    const afuera = Object.assign({}, p);
    delete afuera.interno;
    const texto = JSON.stringify(afuera);
    /* ni el kilometraje, ni la tarifa por kilometro, ni la de la noche */
    if (/\bkm\b|tarifaKm|porKilometro|nochesExtra|importeNoches|traslado/i.test(texto)) fugas++;
    /* y que el numero de kilometros no aparezca como valor suelto */
    if (texto.indexOf(':' + km + ',') >= 0 || texto.indexOf(':' + km + '}') >= 0) fugas++;
  }
  igual('nunca se filtra el kilometraje ni ninguna tarifa', fugas, 0);
})();

console.log('\n' + buenas + ' buenas, ' + malas + ' malas');
process.exit(malas ? 1 : 0);
