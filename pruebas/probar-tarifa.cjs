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

/* Un destino tal como lo arma el navegador: texto y placeId. */
function en(direccion, placeId) { return { direccion: direccion, placeId: placeId || '' }; }

/* ============================================================
   EL PRECIO DEL TRASLADO
   ------------------------------------------------------------
   AQUI ESTABAN LAS BANDAS DE $34 / $25 / $23, Y CAMBIARON DE LADO

   Durante un dia el kilometro se cobro a una sola tarifa elegida
   por el total del viaje, con un escalon de -$7,200 a los 801 km
   que el dueño aprobo a sabiendas. Esta prueba lo exigia: no que
   no hubiera escalon, sino que fuera EXACTAMENTE el aprobado.

   Se fue el 25-ago-2026, cuando llego su LISTA DE PRECIOS 2027
   con 40 precios reales. Contra ella aquellas bandas erraban
   $5,395 en promedio. Adivinar un precio con una curva dejo de
   tener sentido teniendo los precios de verdad enfrente.

   Ahora hay tres respuestas, y en este orden:
       1. el destino esta en la LISTA  -> su precio cerrado
       2. no esta y son <= 1,400 km    -> $6,500 + $22 el km
       3. no esta y esta mas lejos     -> lo cotiza un asesor
   ============================================================ */

/* ---- 1. LA LISTA MANDA ---- */
(function () {
  function precio(dir) { return t.trasladoDe(999, en(dir)).total; }

  igual('Chapala son 6,500', precio('Chapala, Jalisco, México'), 6500);
  igual('Vallarta son 19,000', precio('Puerto Vallarta, Jalisco, México'), 19000);
  igual('Mazatlan son 28,000', precio('Mazatlán, Sinaloa, México'), 28000);
  igual('la CDMX son 22,000 de base', precio('Ciudad de México, Ciudad de México, México'), 22000);
  igual('la Huasteca, 26,500 de base', precio('Huasteca Potosina, San Luis Potosí, México'), 26500);
  igual('Leon, los 17,600 que corrigio el dueño', precio('León, Guanajuato, México'), 17600);
  igual('Tepic, los 16,900 que corrigio el dueño', precio('Tepic, Nayarit, México'), 16900);

  /* Los kilometros que se le pasen dan IGUAL: un precio de lista es cerrado */
  igual('a un precio de lista no le mueven los kilometros',
    [t.trasladoDe(0, en('Chapala, Jalisco, México')).total,
     t.trasladoDe(5000, en('Chapala, Jalisco, México')).total], [6500, 6500]);

  /* Y se sabe DE DONDE salio, para que la oficina lo pueda cuadrar */
  igual('se acusa de que renglon salio',
    t.trasladoDe(620, en('Puerto Vallarta, Jalisco, México')).deLista,
    'Puerto Vallarta y alrededores');
  igual('un precio de lista no tiene tarifa por kilometro',
    t.trasladoDe(620, en('Puerto Vallarta, Jalisco, México')).porKm, null);

  /* Cancun mide 4,282 km —muy arriba del tope de la formula— pero esta en la
     lista, y la lista contesta primero. El tope solo aplica a la formula.

     Va con sus 17 dias: desde el 26-ago-2026 el precio de Cancun depende de
     la duracion («el dia esta en 4000», y hacia abajo tambien). Antes esta
     prueba no pasaba dias y leia los 145,000 pelados. */
  igual('Cancun esta en la lista aunque pase el tope',
    t.trasladoDe(4282, en('Cancún, Quintana Roo, México'), null, 17).total, 145000);
  igual('y por eso NO pide asesor',
    !!t.trasladoDe(4282, en('Cancún, Quintana Roo, México')).requiereAsesor, false);
})();

/* ---- 2. TRES DESTINOS QUE VIVEN DENTRO DE OTRO ----
   La direccion del chico trae el nombre del grande. Sin cuidado, los tres
   caian en el precio del grande y se cobraba de menos. */
(function () {
  function precio(dir) { return t.trasladoDe(999, en(dir)).total; }

  igual('Mismaloya son 20,000, no los 19,000 de Vallarta',
    precio('Mismaloya, Puerto Vallarta, Jalisco, México'), 20000);
  igual('San Miguel son 26,500, no los 19,000 de Guanajuato',
    precio('San Miguel de Allende, Guanajuato, México'), 26500);
  igual('Zacatlan son 39,500, no los 36,500 de Puebla',
    precio('Zacatlán, Puebla, México'), 39500);

  /* y los grandes siguen dando lo suyo */
  igual('Vallarta sigue en 19,000', precio('Puerto Vallarta, Jalisco, México'), 19000);
  igual('Guanajuato sigue en 19,000', precio('Guanajuato, Guanajuato, México'), 19000);
  igual('Puebla sigue en 36,500', precio('Puebla, Puebla, México'), 36500);
})();

/* ---- 3. TRES QUE CAIAN EN EL PRECIO DE SU ESTADO ----
   Mismo defecto que arriba, pero al reves: el nombre del ESTADO estaba en la
   regla del destino, asi que todo el estado caia en el precio de su capital.
   Los tres pasaron a la formula o al asesor el 25-ago-2026. */
(function () {
  igual('Dolores Hidalgo ya NO es Guanajuato',
    t.trasladoDe(740, en('Dolores Hidalgo, Guanajuato, México')).deLista, undefined);
  cierto('y se cotiza por formula',
    t.trasladoDe(740, en('Dolores Hidalgo, Guanajuato, México')).porFormula === true);

  /* Puerto Escondido esta 500 km MAS ALLA de Oaxaca: cobrarle el precio de
     Oaxaca era regalar el viaje.

     CAMBIO DE LADO el 26-ago-2026. Antes estas tres exigian `requiereAsesor`
     porque arriba de 1,400 km no se cotizaba. El dueño quito el asesor
     («animate a cotizar tu»), asi que ahora las contesta el tramo largo.
     Lo que se prueba sigue siendo lo mismo y es lo que importa: que NO
     hereden el precio de su vecino de la lista. */
  cierto('Puerto Escondido ya NO es Oaxaca',
    t.trasladoDe(2400, en('Puerto Escondido, Oaxaca, México')).deLista === undefined);
  cierto('y lo cotiza el tramo largo',
    t.trasladoDe(2400, en('Puerto Escondido, Oaxaca, México')).tramoLargo === true);
  cierto('Huatulco tampoco',
    t.trasladoDe(2500, en('Huatulco, Oaxaca, México')).deLista === undefined);
  igual('pero la capital sigue en su precio',
    t.trasladoDe(1988, en('Oaxaca de Juárez, Oaxaca, México')).total, 75000);

  /* La ciudad de Chihuahua esta 450 km ANTES de las Barrancas: cobrarle el
     precio de Barrancas era cobrarle de mas. */
  cierto('la ciudad de Chihuahua ya NO es Barrancas',
    t.trasladoDe(2400, en('Chihuahua, Chihuahua, México')).deLista === undefined);
  /* Van con sus SIETE dias: desde el 26-ago-2026 el precio de Barrancas
     depende de la duracion —su dia vale 3,000, con o sin movimientos— asi
     que sin decir dias se lee como un viaje de uno solo. */
  igual('pero las Barrancas siguen en su precio',
    t.trasladoDe(2882, en("Barrancas del Cobre, Chihuahua, México"), null, 7).total, 75000);
  igual('y Creel tambien',
    t.trasladoDe(2800, en("Creel, Chihuahua, México"), null, 7).total, 75000);
})();

/* ---- 4. LA FORMULA DE RESPALDO: $6,500 + $22 EL KILOMETRO ----
   Solo contesta por los destinos que NO estan en la lista. */
(function () {
  function f(km) { return t.trasladoDe(km, null).total; }

  //   6,500 + 0        = 6,500   <- sacar la unidad cuesta igual de cerca
  igual('0 km: el costo de sacar la unidad', f(0), 6500);
  //   6,500 + 100×22   = 8,700
  igual('100 km', f(100), 8700);
  //   6,500 + 500×22   = 17,500
  igual('500 km', f(500), 17500);
  //   6,500 + 1,000×22 = 28,500
  igual('1,000 km', f(1000), 28500);
  //   6,500 + 1,400×22 = 37,300   <- el borde es INCLUSIVE
  igual('1,400 km justos: el ultimo que se cotiza solo', f(1400), 37300);

  igual('la tarifa se puede consultar del lado del servidor',
    t.trasladoDe(500, null).porKm, 22);
  cierto('y se acusa que fue por formula', t.trasladoDe(500, null).porFormula === true);

  /* basura de entrada: no revienta ni cobra de mas */
  igual('km negativos: como si fueran cero', f(-100), 6500);
  igual('km que no es numero: como si fueran cero', f('mucho'), 6500);
  igual('km nulo: como si fueran cero', f(null), 6500);
})();

/* ---- 5. LA ASERCION QUE VUELVE: MAS KILOMETROS, MAS CARO ----
   Con las bandas esto era FALSO a proposito: a 801 km se cobraban $7,200
   menos que a 800. La formula no tiene escalones, asi que la prueba que se
   habia retirado vuelve a exigirse. */
(function () {
  let rompe = null, ant = -1;
  for (let km = 0; km <= t.TOPE_FORMULA_KM; km++) {
    const v = t.trasladoDe(km, null).total;
    if (v <= ant) { rompe = km; break; }
    ant = v;
  }
  igual('de 0 a 1,400 km el precio nunca baja ni se queda igual', rompe, null);
})();

/* ---- 6. ARRIBA DEL TOPE: EL TRAMO LARGO ----
   CAMBIO DE LADO el 26-ago-2026. Antes arriba de 1,400 km no habia precio y
   se contestaba «lo cotiza un asesor». El dueño lo quito: «que no haya
   asesor, animate a cotizar tu». Ahora hay un segundo tramo, a $36 el
   kilometro, anclado en lo que vale la formula corta en los 1,400.

   Lo que se prueba ahora es que NO haya escalon en la costura: un destino
   un kilometro mas lejos no puede costar de golpe miles mas. */
(function () {
  cierto('arriba del tope YA se cotiza, sin asesor',
    !t.trasladoDe(1400.001, null).requiereAsesor);
  cierto('y se marca como tramo largo', t.trasladoDe(2000, null).tramoLargo === true);

  /* LA TARIFA MISMA, fijada. Se descubrio probando en rojo: bajando el
     tramo largo de $36 a $22 NO se caia ni una asercion, porque todas
     miraban la forma —sin escalon, siempre subiendo, partes que cuadran—
     y ninguna el numero. Una tarifa de dinero sin prueba que la fije se
     puede cambiar por accidente y nadie se entera. */
  igual('el tramo largo cobra $36 el kilómetro', t.POR_KM_LARGO, 36);
  igual('y el corto sigue en $22', t.POR_KM, 22);
  igual('2,000 km: 37,300 del ancla + 600 × 36',
    t.trasladoDe(2000, null).total, 37300 + 600 * 36);
  igual('4,282 km (lo que mide Cancún): el ancla + 2,882 × 36',
    t.trasladoDe(4282, null).total, 37300 + 2882 * 36);

  const justoAntes = t.trasladoDe(1400, null).total;
  const justoDespues = t.trasladoDe(1401, null).total;
  igual('en los 1,400 justos vale lo de siempre', justoAntes, 37300);
  cierto('un km mas cuesta mas, no menos', justoDespues > justoAntes);
  cierto('y el salto en la costura es de centavos, no de miles',
    justoDespues - justoAntes < 100);

  /* El tramo largo tambien tiene que subir siempre. */
  let ant = -1, rompe = null;
  for (let km = 1400; km <= 5000; km += 7) {
    const v = t.trasladoDe(km, null).total;
    if (v <= ant) { rompe = km; break; }
    ant = v;
  }
  igual('de 1,400 a 5,000 km el precio nunca baja', rompe, null);

  /* Y el viaje completo ya da un numero, con sus noches y movimientos. */
  const p = t.calcula(4282, 4, {
    noches: 3,
    movimientos: [{ horaInicio: '08:00', horaFin: '16:00' },
                  { horaInicio: '08:00', horaFin: '18:00' }]
  });
  cierto('un viaje larguisimo ya trae precio', p.total > 0);
  cierto('y ya no pide asesor', !p.requiereAsesor);
  igual('el anticipo sigue siendo el 20%', p.anticipo, Math.round(p.total * 0.2));
  igual('y las dos partes suman el total',
    p.desglose.servicio + p.desglose.importeMovimientos, p.total);
  /* la oficina si necesita saber los kilometros, para revisarlo */
  igual('la oficina si ve los kilometros', p.interno.km, 4282);
  igual('y los dias que se pidieron con movimiento', p.desglose.diasMovimiento, 2);
})();

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

/* Un destino que NO esta en la lista: 621.2 km redondos, 4 dias.
   6,500 + 621.2 × 22 = 20,166.4  ·  minimo 4 × 3,000 = 12,000  ·  gana la formula

   CAMBIO DE LADO — 1-sep-2026, por R41. Antes se cortaba a la centena de
   ABAJO y daba 20,100; el dueño lo cambió a la centena MAS CERCANA —«solo
   redondea a la centena más cercana»— y 20,166.4 queda en 20,200. */
(function () {
  const p = t.calcula(621.2, 4);
  igual('un destino fuera de la lista: total 20,200', p.total, 20200);
  igual('no aplicó el mínimo', p.interno.aplicoMinimo, false);
  igual('anticipo 20% redondeado al peso', p.anticipo, 4040);
  igual('saldo = total − anticipo, exacto', p.saldo, p.total - p.anticipo);
  igual('subtotal + IVA = total', Math.round((p.subtotal + p.iva) * 100) / 100, p.total);
})();

/* Un viaje de 1,200 km en 5 días, fuera de la lista.
   6,500 + 1,200 × 22 = 32,900  ·  mínimo 5 × 3,000 = 15,000  ·  gana la fórmula */
(function () {
  const p = t.calcula(1200, 5);
  igual('1,200 km en 5 días: 32,900', p.total, 32900);
  igual('la tarifa que aplicó se queda del lado del servidor', p.interno.tarifaKm, 22);
  igual('y el kilometraje también', p.interno.km, 1200);
})();

/* Un viaje corto pero de muchos días: manda el mínimo.
   6,500 + 80 × 22 = 8,260  ·  mínimo 3 × 3,000 = 9,000  ·  gana el mínimo */
(function () {
  const p = t.calcula(80, 3);
  igual('viaje corto de 3 días: manda el mínimo, 9,000', p.total, 9000);
  igual('y se acusa que aplicó', p.interno.aplicoMinimo, true);
})();

/* El mínimo defiende TAMBIEN a los precios de la lista.
   Primero se escribio al reves y dejaba un hueco: Chapala son $6,500 porque
   es un viaje de MISMO DIA; pedida a cinco dias, la unidad se iba una semana
   por esos mismos $6,500. */
(function () {
  igual('Chapala un día: su precio de lista, 6,500',
    t.calcula(100, 1, { destino: en('Chapala, Jalisco, México') }).total, 6500);
  /* ESTA ASERCION CAMBIO DE LADO EL 28-ago-2026, y no por un arreglo: por una
     decision del dueño. Esperaba $16,000 —minimo 15,000 + UNA noche extra de
     mil, porque Chapala traia tres noches incluidas—.

     Ese dia dicto R18: «esos 500 exclusivamente a destinos abajo de 15,000 en
     precio normal», y Chapala entraba: una noche incluida y $500 las
     destapadas. Este numero fue $17,000 durante dos dias.

     Y VOLVIO A CAMBIAR DE LADO EL 30-ago-2026, a $16,000. Preguntado si ese
     corte seguia en pie, el dueño lo quito: «todos los viajes que tengan el
     destino y un precio, tres noches y mil por cada noche arriba» (R25).
     Chapala recupera sus tres noches.

     CAMBIO DE LADO — 1-sep-2026, por R34.
     Aquí se exigía que el piso de $3,000 por día le ganara al precio de
     Chapala: cinco días eran $16,000. El dueño lo corto: «cobra 6500
     Chapala 4 días». Su precio de lista cubre el paquete —cuatro días y
     tres noches, R26— y el piso que yo inventé no le puede ganar a un
     número suyo.

         6,500 de su Excel + 1 noche extra de las mil = 7,500 */
  igual('Chapala cinco días: su precio de lista + la noche extra',
    t.calcula(100, 5, { destino: en('Chapala, Jalisco, México'), noches: 4 }).total, 7500);
  /* y a un precio de lista que ya pasa el piso, el piso no le hace nada */
  igual('Vallarta cuatro días: sus 19,000, el piso ni se asoma',
    t.calcula(620, 4, { destino: en('Puerto Vallarta, Jalisco, México'), noches: 3 }).total, 19000);
})();

/* El redondeo SIEMPRE es hacia abajo, a favor del cliente */
(function () {
  //  6,500 + 700.5 × 22 = 21,911 -> corta a 21,900
  igual('21,911 se corta a 21,900', t.calcula(700.5, 1).total, 21900);
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
     regla del kilometro.

     `requiereAsesor` se agrego el 25-ago-2026. Es un SI o un NO, no una
     cantidad, y cuando vale `true` todos los montos vienen en cero: no hay
     nada de donde dividir. Sin el, la pantalla enseñaria «$0». */
  igual('las llaves que salen son solo estas',
    Object.keys(afuera).sort(),
    ['anticipo', 'desglose', 'iva', 'ivaIncluido', 'porcentajeAnticipo',
     'requiereAsesor', 'saldo', 'subtotal', 'total']);
  igual('y `interno` sí trae la tarifa, para el servidor', p.interno.tarifaKm, 22);
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
   Viaje de 400 km, 6 dias de servicio:
       6,500 + 400 × 22 = 15,300  ·  minimo 6 × 3,000 = 18,000 -> gana el minimo */
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

  /* ----------------------------------------------------------------
     EL TOPE SON LOS DIAS DE SERVICIO, Y ANTES ERAN LAS NOCHES

     Esta asercion cambio de lado el 25-ago-2026. Decia «con 2 noches, solo
     cuentan 2 dias», y estaba mal: un viaje de tres dias puede moverse los
     tres —sale, se mueve, y el ultimo dia se mueve y regresa— pero solo
     tiene dos noches. Amarrado a las noches se cobraban $3,000 de menos.

     Lo cazo la prueba que reconstruye «CDMX 3 dias» de la lista real: daba
     $31,000 y su lista dice $34,000. El tope de verdad son los dias.
     ---------------------------------------------------------------- */
  igual('con 3 dias de servicio, caben los 3', t.movimientosDe(tres, 3).length, 3);
  igual('con 2 dias, solo caben 2', t.movimientosDe(tres, 2).length, 2);
  igual('con 0 dias, ninguno', t.movimientosDe(tres, 0).length, 0);
  igual('sin dias declarados, ninguno', t.movimientosDe(tres).length, 0);
  igual('una lista que no es lista: ninguno', t.movimientosDe('muchos', 5).length, 0);
  igual('renglones vacios: caen en el piso',
    t.precioMovimientos(t.movimientosDe([{}, {}], 3)), 6000);

  /* Y el tope duro, contra una lista inventada */
  const milesDeDias = [];
  for (let i = 0; i < 5000; i++) milesDeDias.push({ horaInicio: '08:00', horaFin: '22:00' });
  igual('cinco mil dias con 3 de servicio: solo 3', t.movimientosDe(milesDeDias, 3).length, 3);
  igual('cinco mil dias con mil de servicio: el tope duro',
    t.movimientosDe(milesDeDias, 1000).length, t.TOPE_DIAS_MOVIMIENTO);
})();

/* ============ LAS DOS FORMAS DE COBRAR LA ESTADIA ============
   SIN movimientos es un PAQUETE: 3 noches incluidas, +$1,000 cada extra.
   CON movimientos se cobra DIA POR DIA: cada dia de estadia $1,000 —la
   unidad esta apartada alla y no puede trabajar en otra cosa— y el dia que
   ademas se mueve, se le suma su banda de horas. */
(function () {
  const vallarta = en('Puerto Vallarta, Jalisco, México');
  const ochoHoras = { horaInicio: '08:00', horaFin: '16:00' };

  //  paquete: 19,000 de lista, 3 noches incluidas
  igual('Vallarta 3 noches, sin movimientos: 19,000',
    t.calcula(620, 4, { destino: vallarta, noches: 3 }).total, 19000);
  //  5 noches -> 2 extra × 1,000
  igual('Vallarta 5 noches: 21,000',
    t.calcula(620, 6, { destino: vallarta, noches: 5 }).total, 21000);

  /* CAMBIO DE LADO el 26-ago-2026. Antes esta prueba exigia 26,000 porque el
     codigo borraba las noches incluidas en cuanto habia UN movimiento y
     cobraba 1,000 por TODOS los dias. El dueño lo corrigio: «la playa es
     sencillo: cada noche que supere las 3 noches por defecto son 1000, y si
     tiene movimientos son 3000 x dia». Son dos cobros que se SUMAN, no dos
     modos que se excluyen. 4 dias son 3 noches, o sea ninguna extra:
         19,000 + 0 de estadia + 1 dia de 8 h × 3,000 = 22,000              */
  igual('Vallarta 4 días con un movimiento: 22,000 (antes cobraba 26,000)',
    t.calcula(620, 4, { destino: vallarta, noches: 3, movimientos: [ochoHoras] }).total, 22000);
  igual('las 3 noches incluidas NO se pierden por moverse',
    t.calcula(620, 4, { destino: vallarta, noches: 3, movimientos: [ochoHoras] })
      .interno.nochesExtra, 0);
  /* Y la cuarta noche si se cobra, ademas de la banda: 1,000 + 3,000 */
  igual('un día extra CON movimiento son 4,000',
    t.calcula(620, 5, { destino: vallarta, noches: 4, movimientos: [ochoHoras] }).total, 23000);
  /* Los dias que la unidad se queda parada la oficina los ve, para explicarlo */
  igual('la oficina ve los días que la unidad se quedó parada',
    t.calcula(620, 4, { destino: vallarta, noches: 3, movimientos: [ochoHoras] })
      .interno.diasParados, 3);
})();

/* ============ SE RECONSTRUYE LA LISTA REAL? ============
   Esta es la prueba que de verdad importa: que las reglas de arriba, sumadas,
   den EXACTAMENTE los precios que el dueño tiene escritos en su lista de 2027
   para los dos destinos que alla vienen con dias y movimientos incluidos.

   Si algun dia alguien cambia una regla, esto se lo dice con su propia lista
   en la mano. */
(function () {
  const CDMX = en('Ciudad de México, Ciudad de México, México');
  const HUASTECA = en('Huasteca Potosina, San Luis Potosí, México');
  const ochoHoras = { horaInicio: '08:00', horaFin: '16:00' };
  function dias(n) { const l = []; for (let i = 0; i < n; i++) l.push(ochoHoras); return l; }

  //  22,000 + 1 dia × 1,000 + 1 movimiento × 3,000 = 26,000
  igual('CDMX 1 día, su lista dice 26,000',
    t.calcula(1102, 1, { destino: CDMX, noches: 0, movimientos: dias(1) }).total, 26000);
  //  22,000 + 2 × 1,000 + 2 × 3,000 = 30,000
  igual('CDMX 2 días, su lista dice 30,000',
    t.calcula(1102, 2, { destino: CDMX, noches: 1, movimientos: dias(2) }).total, 30000);
  //  22,000 + 3 × 1,000 + 3 × 3,000 = 34,000
  igual('CDMX 3 días, su lista dice 34,000',
    t.calcula(1102, 3, { destino: CDMX, noches: 2, movimientos: dias(3) }).total, 34000);

  //  26,500 + 3 × 1,000 + 3 × 3,000 = 38,500
  igual('Huasteca 3 días, su lista dice 38,500',
    t.calcula(1262, 3, { destino: HUASTECA, noches: 2, movimientos: dias(3) }).total, 38500);
  //  26,500 + 4 × 1,000 + 4 × 3,000 = 42,500
  igual('Huasteca 4 días, su lista dice 42,500',
    t.calcula(1262, 4, { destino: HUASTECA, noches: 3, movimientos: dias(4) }).total, 42500);

  /* Y el caso que dicto el dueño con sus palabras: «si el viaje dura 4 dias y
     solo hay movimientos en 2, los dias sin movimientos cobras solamente
     1,000, porque se queda la sprinter inutil ahi».
         22,000 + 4 dias × 1,000 + 2 movimientos × 3,000 = 32,000            */
  const cuatroConDos = t.calcula(1102, 4, { destino: CDMX, noches: 3, movimientos: dias(2) });
  igual('CDMX 4 días con movimientos solo en 2: 32,000', cuatroConDos.total, 32000);
  igual('y la oficina ve que 2 días se quedó parada', cuatroConDos.interno.diasParados, 2);
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
  const cuatroDias = [
    { horaInicio: '08:00', horaFin: '12:00' },   // 4 h   -> banda normal 3,000
    { horaInicio: '08:00', horaFin: '18:00' },   // 10 h  -> banda normal 4,000
    { horaInicio: '07:00', horaFin: '21:00' },   // 14 h  -> banda normal 5,000
    { horaInicio: '06:00', horaFin: '20:30' }    // 14.5h -> banda normal 5,000
  ];

  const enLaHuasteca = t.movimientosDe(cuatroDias, 5, t.reglaDeDestino({ placeId: HUASTECA_ID }));
  igual('en la Huasteca los cuatro dias valen 3,000',
    enLaHuasteca.map(function (m) { return m.precio; }), [3000, 3000, 3000, 3000]);
  igual('o sea 12,000 por los cuatro', t.precioMovimientos(enLaHuasteca), 12000);

  /* pero las horas SI se guardan: el operador necesita saber a que hora */
  igual('y las horas no se pierden',
    enLaHuasteca.map(function (m) { return m.horas; }), [4, 10, 14, 14.5]);

  /* En cualquier otro destino, las mismas horas cuestan lo de siempre */
  const enVallarta = t.movimientosDe(cuatroDias, 5, null);
  igual('en otro destino mandan las bandas',
    enVallarta.map(function (m) { return m.precio; }), [3000, 4000, 5000, 5000]);
  igual('que son 17,000', t.precioMovimientos(enVallarta), 17000);

  /* Y el viaje completo, por la puerta de calcula(). Los dos destinos van por
     FORMULA a proposito —solo con placeId, sin direccion, la lista no los
     reconoce— para que la unica diferencia entre los dos sea la regla.
         6,500 + 900 × 22 = 26,300  ·  minimo 5 × 3,000 = 15,000
         movimientos: 12,000 en la Huasteca contra 17,000 en otro lado

     LA ESTADIA CAMBIO DE LADO el 26-ago-2026. Antes los dos cobraban 5,000
     (5 dias × 1,000) porque moverse borraba las noches incluidas. Ahora solo
     la Huasteca cobra estadia por dia —su precio es un traslado, no un
     paquete—; el otro destino tiene sus 3 noches incluidas y de 4 noches
     solo paga UNA extra. Son dos reglas distintas a proposito.               */
  const viaje = { noches: 4, movimientos: cuatroDias };
  const huasteca = t.calcula(900, 5, Object.assign({ destino: { placeId: HUASTECA_ID } }, viaje));
  const otro = t.calcula(900, 5, Object.assign({ destino: { placeId: 'ChIJ_otro' } }, viaje));

  igual('Huasteca: 26,300 + 5 días × 1,000 + 12,000', huasteca.total, 43300);
  igual('otro destino: 26,300 + 1 noche extra × 1,000 + 17,000', otro.total, 44300);
  igual('la Huasteca cobra estadía los 5 días', huasteca.interno.importeNoches, 5000);
  igual('el otro solo la noche que pasa de tres', otro.interno.importeNoches, 1000);
  igual('y el contrato sabra por que', huasteca.interno.reglaDestino, 'Huasteca Potosina');
  igual('en otro destino no hay regla que explicar', otro.interno.reglaDestino, null);
})();

/* ============ EL VIAJE COMPLETO, EN EL ORDEN QUE DICTO EL DUEÑO ============
   Primero los kilometros, luego la estadia, al final los movimientos.

     6,500 + 400 × 22 = 15,300  ·  minimo 6 dias × 3,000 = 18,000 -> gana el minimo
     con movimientos se paga DIA POR DIA: 6 dias × 1,000 ............ + 6,000
     movimientos de 8 h, 10 h y 13 h = 3,000 + 4,000 + 5,000 ........ + 12,000
                                                                      --------
                                                                        36,000 */
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
  /* CAMBIO DE LADO el 26-ago-2026: antes eran 6,000 (6 dias × 1,000) porque
     moverse borraba las 3 noches incluidas. Ahora un destino de formula las
     conserva: de 5 noches, solo 2 pasan de tres. */
  igual('la estadía: solo las noches que pasan de tres', p.interno.importeNoches, 2000);
  igual('los movimientos', p.desglose.importeMovimientos, 12000);
  igual('el total', p.total, 32000);
  igual('las tres partes suman el total',
    p.interno.traslado + p.interno.importeNoches + p.desglose.importeMovimientos, p.total);

  /* Y lo que ve el cliente son DOS numeros que tambien suman el total. Si el
     desglose no cuadrara con el total pareceria un error de cuentas, y eso es
     peor que no dar desglose. */
  /* 18,000 + 2,000; era 24,000 cuando la estadia se cobraba por dia */
  igual('el cliente ve traslado y estadía juntos', p.desglose.servicio, 20000);
  igual('y sus dos numeros suman el total',
    p.desglose.servicio + p.desglose.importeMovimientos, p.total);
  /* `reglaDestino` es un NOMBRE, no una tarifa: la pantalla lo necesita para
     no prometer «8 horas incluidas» donde el día es tarifa fija. */
  igual('la tarifa por noche NO sale del desglose',
    Object.keys(p.desglose).sort(),
    ['diasMovimiento', 'importeMovimientos', 'reglaDestino', 'servicio']);

  /* El anticipo sale del total FINAL, no del traslado. Si saliera del
     traslado, se apartaria un viaje de 36,000 con el anticipo de uno de
     18,000: 3,600 en vez de 7,200. */
  /* 20% de 32,000; eran 7,200 cuando el total era 36,000 */
  igual('el anticipo es el 20% del total final', p.anticipo, 6400);
  igual('y el saldo, lo que queda', p.saldo, 25600);
  igual('anticipo + saldo = total', p.anticipo + p.saldo, p.total);
})();

/* El corte a la centena cae SOLO sobre el traslado. Como la estadia y los
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

/* ============================================================
   R22 · EL VIAJE DE UN DIA NO PAGA MOVIMIENTO (30-ago-2026)
   ------------------------------------------------------------
   Dictado por el dueño al revisar la hoja de los 50 viajes reales:
   «los viajes de un solo día no cobres movimientos, éstos
   normalmente siempre tienen, no lo cobres».

   ESTE HUECO EXISTIA Y POR ESO SE ESCAPO EL ERROR. Ninguna prueba
   cubria «un dia CON movimiento»: se probaba un dia sin ellos, y
   varios dias con ellos. Tequila salio en $10,000 y nadie se
   entero hasta que el dueño lo vio en el PDF.
   ============================================================ */
(function () {
  const destinos = require('../api/_destinos.js');
  const GDL = { lat: 20.675171, lng: -103.347338, direccion: 'Guadalajara, Jal.' };
  function q(nombre, dias, movs) {
    const d = destinos.buscaDestino({ nombre: nombre });
    const l = [];
    for (let i = 0; i < movs; i++) l.push({ salida: '09:00', regreso: '17:00' });
    return t.calcula(d.km, dias, { destino: { nombre: nombre }, origen: GDL,
      unidad: 'sprinter', noches: Math.max(0, dias - 1), movimientos: l }).total;
  }

  /* El caso que el dueño corrigio: cobraba $10,000 = 7,000 + 3,000 */
  igual('Tequila 1 día con movimiento son sus $7,000 pelados', q('Tequila / Guachimontones', 1, 1), 7000);
  igual('y sin movimiento, los mismos', q('Tequila / Guachimontones', 1, 0), 7000);

  /* Y ahora dos celdas del Excel que ANTES no cuadraban y ahora sí:
     «GUANAJUATO MISMO DIA $19,000» y «MORELIA 1 DIA $19,000» son el
     precio completo de ese día; cobrarles el movimiento encima los
     sacaba de su propia lista. */
  igual('Guanajuato mismo día con movimiento = su celda del Excel', q('Guanajuato', 1, 1), 19000);
  igual('Morelia 1 día con movimiento = su celda del Excel', q('Morelia', 1, 1), 19000);
  igual('Chapala 1 día con movimiento', q('Chapala', 1, 1), 6500);
  igual('tres movimientos en un día tampoco cobran', q('Chapala', 1, 3), 6500);

  /* LA EXCEPCION: CDMX y la Huasteca, cuyo precio del Excel ESTA
     definido como base mas dias CON movimientos (R3). Perdonarles el
     del primer dia tira su propia celda —CDMX caeria a $23,000— y el
     mandamiento dice que entonces el calculo esta mal, no el Excel. */
  igual('CDMX 1 día con movimiento sigue siendo su celda, $26,000', q('Ciudad de México', 1, 1), 26000);
  igual('y sin movimiento sí baja', q('Ciudad de México', 1, 0), 23000);

  /* De DOS dias en adelante todo se cobra igual que siempre */
  igual('CDMX 2 días con 2 movimientos', q('Ciudad de México', 2, 2), 30000);
  igual('CDMX 3 días con 3 movimientos', q('Ciudad de México', 3, 3), 34000);
  igual('Huasteca 3 días con 3 movimientos', q('Huasteca Potosina', 3, 3), 38500);
  igual('Huasteca 4 días con 4 movimientos', q('Huasteca Potosina', 4, 4), 42500);
  igual('Vallarta 4 días con 2 movimientos sigue cobrando los dos',
    q('Puerto Vallarta y alrededores', 4, 2), 19000 + 2 * 3000);
  igual('Chapala 2 días con 1 movimiento SÍ lo cobra', q('Chapala', 2, 1), 6500 + 3000);

  /* El movimiento se guarda aunque no se cobre: el operador necesita la
     hora y el contrato la imprime. */
  const p = t.calcula(100, 1, { destino: { nombre: 'Chapala' }, origen: GDL, unidad: 'sprinter',
    noches: 0, movimientos: [{ salida: '09:00', regreso: '17:00' }] });
  igual('el día con movimiento se sigue contando', p.desglose.diasMovimiento, 1);
  igual('pero su importe es cero', p.desglose.importeMovimientos, 0);
  igual('y sus horas quedan guardadas', p.interno.horasMovimiento.length, 1);

  /* ============================================================
     R23 · MORELIA Y MARIPOSA: PLANAS HASTA LA 3ª NOCHE
     ------------------------------------------------------------
     ESTO SE LE PRESENTO AL DUEÑO COMO DEFECTO Y NO LO ERA.

     Se le enseñó que cuatro días cuestan lo mismo que uno, y
     contestó: «ah, está bien; entonces cuando supere su tercera
     noche, o sea su 4ta, auméntale 1000 por noche» — que es lo
     que ya hacía.

     Las aserciones existen para que nadie lo vuelva a «arreglar»:
     si alguien les mete un día extra, se ponen rojas.
     ============================================================ */
  [['Morelia', 19000], ['Santuario de la Mariposa Monarca', 23000]].forEach(function (f) {
    const n = f[0], base = f[1];
    igual(n.split(' ')[0] + ': 1 día', q(n, 1, 0), base);
    igual(n.split(' ')[0] + ': 4 días cuestan lo mismo, y es a propósito', q(n, 4, 0), base);
    igual(n.split(' ')[0] + ': la 4ª noche cobra sus $1,000', q(n, 5, 0), base + 1000);
    igual(n.split(' ')[0] + ': la 5ª, otros mil', q(n, 6, 0), base + 2000);
  });

  /* CAMBIO DE LADO — 1-sep-2026, por R34.
     Estas dos exigían que el piso le ganara al precio de tabla. Ya no le
     gana a ninguno: el precio del Excel manda y arriba de sus tres noches
     corren los mil de siempre.

         Morelia   19,000 + 3 noches extra = 22,000
         Mariposa  23,000 + 4 noches extra = 27,000 */
  igual('Morelia 7 días: su precio + las noches de más', q('Morelia', 7, 0), 22000);
  igual('Mariposa 8 días: su precio + las noches de más',
    q('Santuario de la Mariposa Monarca', 8, 0), 27000);

  /* ============================================================
     R24 · LO QUE LA COLUMNA YA TRAE, NO SE COBRA OTRA VEZ
     ------------------------------------------------------------
     Dictado el 30-ago-2026: «todos los viajes que tengan, por
     ejemplo, Huasteca tres días, Ciudad de México dos días, tienen
     movimientos incluidos […] a excepción de Cancún».

     Cada aserción es la CELDA DE SU EXCEL con movimiento todos los
     días de esa columna. Si alguna sube, es que se está cobrando
     dos veces lo mismo.

     ACAPULCO SE FUE DE ESTA LISTA — 1-sep-2026, por R35.
     Estaba aquí porque yo le había puesto los cuatro días de
     movimientos incluidos. El dueño lo corrigió con la cuenta
     hecha: «Acapulco dice 60,000 4 días, si fueran 5 serían 64,000,
     y con mov 3,000 el día». O sea que SUS MOVIMIENTOS SE COBRAN,
     igual que en Guayabitos, que ya había corregido igual. Con dos
     movimientos son $66,000 y eso ahora se comprueba abajo.
     ============================================================ */
  [['Talpa de Allende', 2, 16500], ['Tlalpujahua', 2, 26500],
   ['El Manto', 3, 19000], ['Puebla', 2, 36500],
   ['Puebla con Zacatlán', 2, 39500],
   ['Talpa Burrita (peregrinación)', 4, 26500],
   ['Chiapas', 8, 85000], ['Camécuaro / Zamora', 1, 14500]
  ].forEach(function (f) {
    const [n, dias, celda] = f;
    igual(n.slice(0, 24) + ' ' + dias + 'd con movimiento todos los días = su celda',
      q(n, dias, dias), celda);
  });

  /* R35 · ACAPULCO Y CANCUN — dictados el 1-sep-2026 con la resta hecha.
     Los dos cobran sus movimientos aparte, y su día extra son $4,000. */
  igual('Acapulco 4 días sin movimientos = su celda', q('Acapulco', 4, 0), 60000);
  igual('Acapulco 5 días: su día extra son $4,000, no mil', q('Acapulco', 5, 0), 64000);
  igual('Acapulco 4 días con 2 movimientos: los cobra', q('Acapulco', 4, 2), 66000);
  igual('Cancún 18 días: su día extra también son $4,000',
    q('Cancún', 18, 0) - q('Cancún', 17, 0), 4000);

  /* R29 · Un recorrido que pasa de 80 km ya no es paseo: son $5,500, y las
     horas dejan de importar. Dictado el 1-sep-2026: «si cobra un recorrido
     de 120 km, o sea que supere los 80 km en lejanía, cóbralo en 5500». */
  {
    const conKm = function (km, fin) {
      return t.calcula(620, 4, {
        destino: en('Puerto Vallarta, Jalisco, México'), noches: 3, unidad: 'sprinter',
        movimientos: [{ horaInicio: '08:00', horaFin: fin || '16:00', km: km }]
      }).total;
    };
    const normal = conKm(40);
    igual('un recorrido de 120 km cuesta $5,500', conKm(120) - normal, 2500);
    igual('80 km exactos todavía es cerca: sigue en $3,000', conKm(80), normal);
    igual('81 km ya es lejos', conKm(81) - normal, 2500);
    /* Por lejanía, no por horas: da igual cuánto dure. */
    igual('a 120 km las horas dejan de importar', conKm(120, '20:00'), conKm(120, '16:00'));
    /* Sin km declarado se cobra como siempre: no se supone que sea lejos. */
    igual('sin decir los km, se cobra como siempre',
      t.calcula(620, 4, { destino: en('Puerto Vallarta, Jalisco, México'), noches: 3,
        unidad: 'sprinter', movimientos: [{ horaInicio: '08:00', horaFin: '16:00' }] }).total,
      normal);
  }

  /* R30 · Los tres paseos de CDMX SUSTITUYEN el movimiento de $3,000. */
  {
    const conMov = function (paseo) {
      return t.calcula(1102, 3, {
        destino: en('Ciudad de México'), noches: 2, unidad: 'sprinter',
        movimientos: [
          { horaInicio: '08:00', horaFin: '16:00' },
          { horaInicio: '08:00', horaFin: '16:00' },
          { horaInicio: '08:00', horaFin: '16:00', paseo: paseo }
        ]
      }).total;
    };
    const normal = conMov(null);
    igual('CDMX · Taxco cuesta $15,000 en vez de los $3,000', conMov('Taxco') - normal, 12000);
    igual('CDMX · Chalma cuesta $8,000 en vez de los $3,000', conMov('chalma') - normal, 5000);
    igual('CDMX · Xochimilco cuesta $2,000, o sea MENOS que un movimiento',
      conMov('XOCHIMILCO') - normal, -1000);
    igual('un paseo que no existe se ignora, no truena', conMov('Cancun'), normal);
    /* Solo en CDMX: en cualquier otro destino el nombre no significa nada. */
    igual('en Chapala un «paseo» no existe: cobra su movimiento normal',
      t.calcula(100, 3, { destino: en('Chapala, Jalisco, México'), noches: 2, unidad: 'sprinter',
        movimientos: [{ horaInicio: '08:00', horaFin: '16:00', paseo: 'taxco' }] }).total, 9500);
  }

  /* LAS TRES EXCEPCIONES, y las tres salen de él */
  igual('Cancún SÍ cobra sus movimientos aparte — su palabra',
    q('Cancún', 17, 3), 145000 + 3 * 3000);
  igual('Guanajuato 3 días también: su columna dice «SIN MOV»',
    q('Guanajuato', 3, 3), 24500 + 3 * 3000);
  /* Guayabitos entró con los demás al escribir R24 —su columna dice «hasta 4
     días»— y el dueño lo sacó el mismo día: «Guayabitos sí se cobran los
     movimientos extras». Su «hasta 4 días» habla de cuánto dura el precio, no
     de paseos: es estancia de playa, no recorrido. */
  igual('Guayabitos también cobra los suyos — lo corrigió el 30-ago',
    q('Rincón de Guayabitos', 4, 2), 18500 + 2 * 3000);

  /* Y pasada la duración de la columna, el movimiento se cobra normal:
     ahí la columna ya se acabó, igual que en R2 y R14. */
  igual('Puebla al 3er día ya cobra su movimiento',
    q('Puebla', 3, 3) - q('Puebla', 3, 2), 3000);
  igual('Chiapas al 9o día también',
    q('Chiapas', 9, 9) - q('Chiapas', 9, 8), 3000);
})();

console.log('\n' + buenas + ' buenas, ' + malas + ' malas');
process.exit(malas ? 1 : 0);
