/* ============================================================
   Auditoria independiente del precio
   ------------------------------------------------------------
       node pruebas/auditar-tarifa.cjs

   Las otras pruebas comprueban casos. Esta comprueba la REGLA, y
   lo hace calculando por su cuenta: las tarifas y los precios de
   abajo estan escritos A MANO, no leidos de _tarifa.js ni de
   _destinos.js. Si el archivo del dinero tuviera un error, una
   prueba que use sus propias constantes lo repetiria y no lo
   veria. Esta no.

   ------------------------------------------------------------
   AQUI SE AUDITABAN LAS BANDAS DE $34 / $25 / $23

   Y una seccion entera comprobaba que la tarifa nueva abaratara
   TODOS los viajes contra la anterior. Las dos se fueron el
   25-ago-2026 con la llegada de la LISTA DE PRECIOS 2027: ya no
   hay curva que auditar contra otra curva, hay 40 precios reales.

   Lo que las sustituye es mejor: se audita la lista contra los
   numeros del Excel, escritos a mano aqui abajo.
   ============================================================ */
'use strict';
const t = require('../api/_tarifa.js');

let buenas = 0, malas = 0;
function igual(nombre, dio, esperado) {
  const a = JSON.stringify(dio), b = JSON.stringify(esperado);
  if (a === b) { buenas++; console.log('ok   ' + nombre); }
  else { malas++; console.log('MAL  ' + nombre + '\n     dio      ' + a + '\n     esperaba ' + b); }
}

/* ============================================================
   LAS REGLAS, ESCRITAS A MANO
   ------------------------------------------------------------
   Esto es lo que el dueño dicto, en palabras, vuelto formula. Si
   algun dia cambia una tarifa hay que cambiarla EN LOS DOS
   LADOS, y que haya que hacerlo dos veces es justamente lo que
   hace util esta prueba.
   ============================================================ */
const corta = n => Math.floor(n / 100) * 100;

/* El traslado de un destino que NO esta en la lista */
function formulaAMano(km) {
  if (km > 1400) return null;                 // null = lo cotiza un asesor
  return 6500 + 22 * km;
}
/* El piso por dia defiende a la formula Y a la lista */
function trasladoAMano(precioBase, dias) {
  return corta(Math.max(precioBase, dias * 3000));
}
/* La estadia se cobra de dos formas, y cual depende de si hay movimientos.

   `porDia` cambio de lado el 26-ago-2026: el dueño confirmo que CDMX y
   Huasteca cobran $1,000 por CADA dia de estadia AUNQUE no haya movimientos
   («si no tiene movimientos, nomas vas a cobrar mil»). Antes esos casos
   caian en el paquete de 3 noches gratis, que era un modelo inventado
   (criterio de precios, error nº 1). */
function estadiaAMano(dias, noches, cuantosMovimientos, porDia) {
  if (porDia || cuantosMovimientos > 0) return dias * 1000;   // dia por dia
  return Math.max(0, noches - 3) * 1000;               // paquete de 3 noches
}

/* El precio por duracion de los destinos que el Excel trae con varios dias
   (criterio R1). Reimplementado a mano a proposito, como todo lo de aqui. */
function porDuracionAMano(regla, dias) {
  const tabla = regla.porDias;
  if (tabla[dias] !== undefined) return tabla[dias];
  const ds = Object.keys(tabla).map(Number).sort(function (a, b) { return a - b; });
  if (dias < ds[0]) return tabla[ds[0]];
  let base = ds[0];
  for (let i = 0; i < ds.length; i++) if (ds[i] <= dias) base = ds[i];
  return tabla[base] + (dias - base) * regla.diaExtra;
}
function diaDeMovimientoAMano(horas, esHuasteca) {
  if (esHuasteca) return 3000;
  if (horas <= 8) return 3000;
  if (horas <= 9) return 3500;
  if (horas <= 10) return 4000;
  if (horas <= 12) return 4500;
  return 5000;
}

/* ============================================================
   LOS PRECIOS DE SU LISTA, COPIADOS DEL EXCEL A MANO
   ------------------------------------------------------------
   Columna sprinter de LISTA DE PRECIOS 2027.xlsx. Son los que el
   dueño tiene escritos, no los que calcula el codigo.

   Leon y Tepic no venian en el Excel: el dueño los dicto aparte
   («leon y tepic subele 1300 pesos nomas»).

   La CDMX y la Huasteca no estan aqui: su precio del Excel
   incluye dias y movimientos, asi que se auditan en su propia
   seccion, reconstruyendolos.
   ============================================================ */
const SU_LISTA = [
  ['Chapala, Jalisco, México', 6500],
  /* Los tres que el dueño dicto el 26-ago-2026 corrigiendo a la formula
     (criterio R11): el vecino de un destino de lista se ancla a la lista.
     Cosala cobraba 9,400, Magdalena 9,800 y Zirahuen 18,500. */
  ['San Juan Cosalá, Jalisco, México', 6500],
  ['Magdalena, Jalisco, México', 7500],
  ['Zirahuén, Michoacán, México', 23000],
  /* Segunda tanda dictada (26-ago-2026). Zacoalco a 5,000 con los mismos
     kilometros que Tequila a 7,000: el precio no es funcion del km (R12). */
  ['Tala, Jalisco, México', 6000],
  ['Zacoalco de Torres, Jalisco, México', 5000],
  ['Cocula, Jalisco, México', 6500],
  /* Cambió de 8,500 a 7,000 el 26-ago-2026. No es que la prueba estuviera
     mal: el dueño bajó el precio de lista de la Sprinter a Tequila. */
  ['Tequila, Jalisco, México', 7000],
  ['Tapalpa, Jalisco, México', 14500],
  ['Mazamitla, Jalisco, México', 14500],
  ['San Juan de los Lagos, Jalisco, México', 14000],
  ['Zamora, Michoacán, México', 14500],
  /* El tercer campo es la regla del Excel para ese destino, cuando la hay:
     `porDias` son sus precios por duracion, `diasIncluidos` marca paquete.
     Entraron el 26-ago-2026, cuando el dueño tumbo el modelo de noches. */
  /* Los dias extra deducidos de los escalones (2,500 y 3,000) los bajo el
     dueño a 1,500 el 26-ago-2026, como el de Guanajuato. */
  ['El Manto, Jalisco, México', 14000, { porDias: { 1: 14000, 3: 19000 }, diaExtra: 1500 }],
  ['Talpa de Allende, Jalisco, México', 15000, { porDias: { 1: 15000, 2: 16500 }, diaExtra: 1500 }],
  ['Tepic, Nayarit, México', 16900],
  ['León, Guanajuato, México', 17600],
  ['Rincón de Guayabitos, Nayarit, México', 18500],
  ['Chacala, Nayarit, México', 16500],
  ['Sayulita, Nayarit, México', 18000],
  /* El dia extra bajo de 2,750 (deducido de los escalones) a 1,500 por
     correccion del dueño el 26-ago-2026: «si queda muy caro». */
  ['Guanajuato, Guanajuato, México', 19000, { porDias: { 1: 19000, 3: 24500 }, diaExtra: 1500 }],
  ['Manzanillo, Colima, México', 18500],
  ['Morelia, Michoacán, México', 19000],
  ['Puerto Vallarta, Jalisco, México', 19000],
  ['Punta Perula, Jalisco, México', 20500],
  ['Mismaloya, Puerto Vallarta, Jalisco, México', 20000],
  ['Pátzcuaro, Michoacán, México', 25000],
  ['San Miguel de Allende, Guanajuato, México', 26500],
  ['Barra de Navidad, Jalisco, México', 20500],
  ['Zacatecas, Zacatecas, México', 25000],
  ['Tlalpujahua, Michoacán, México', 23500, { porDias: { 1: 23500, 2: 26500 }, diaExtra: 1500 }],
  ['Tenacatita, Jalisco, México', 20000],
  ['Mayto, Jalisco, México', 26500],
  ['Mazatlán, Sinaloa, México', 28000],
  ['Valle de Bravo, Estado de México, México', 32000],
  ['Ixtapa Zihuatanejo, Guerrero, México', 29500],
  /* Tolantongo trae en el Excel su propio precio CON movimientos, que ya lo
     incluye todo (correccion del dueño, 26-ago-2026). */
  ['Grutas Tolantongo, Hidalgo, México', 29500, { conMovimientos: 34500 }],
  ['Real de Catorce, San Luis Potosí, México', 34500],
  /* Puebla: 2 dias del Excel y $2,000 el dia extra («el dia tres subele a
     dos mil», 26-ago-2026; cuadra con su fila 10: «$2,000 SPR»). */
  ['Puebla, Puebla, México', 36500, { porDias: { 2: 36500 }, diaExtra: 2000 }],
  ['Zacatlán, Puebla, México', 39500, { porDias: { 2: 39500 }, diaExtra: 2000 }],
  ['Acapulco, Guerrero, México', 60000],
  ['Oaxaca de Juárez, Oaxaca, México', 75000],
  ['San Cristóbal de las Casas, Chiapas, México', 85000, { diasIncluidos: 8 }],
  ['Barrancas del Cobre, Chihuahua, México', 75000],
  ['Cancún, Quintana Roo, México', 145000, { diasIncluidos: 17 }]
];

/* ============ 1. LA LISTA DA EXACTAMENTE LO QUE DICE EL EXCEL ============
   Un dia de servicio, sin noches ni movimientos: el precio pelado. */
(function () {
  const rotos = [];
  SU_LISTA.forEach(function (fila) {
    const dio = t.calcula(1, 1, { destino: { direccion: fila[0] } }).total;
    /* un dia de servicio pone un piso de 3,000, que ninguno de estos alcanza */
    const esperado = trasladoAMano(fila[1], 1);
    if (dio !== esperado) rotos.push({ destino: fila[0], dio: dio, esperaba: esperado });
  });
  console.log('(' + SU_LISTA.length + ' destinos de su lista, copiados del Excel a mano)');
  igual('los ' + SU_LISTA.length + ' dan su precio del Excel, al peso', rotos.length, 0);
  if (rotos.length) console.log('   ' + JSON.stringify(rotos.slice(0, 4), null, 1));
})();

/* ============ 2. NINGUN PRECIO ES ABSURDO ============
   El Excel traia el Marcopolo de Barrancas en $1,300,000: un cero de mas.
   Esta prueba caza el siguiente. Un traslado de sprinter no puede salirse de
   este rango sin que alguien lo mire. */
(function () {
  const fuera = SU_LISTA.filter(function (f) { return f[1] < 5000 || f[1] > 200000; });
  igual('ningun precio de sprinter se sale del rango razonable', fuera, []);

  /* y el mismo rango, contra lo que de verdad devuelve el codigo */
  const raros = [];
  SU_LISTA.forEach(function (f) {
    const p = t.calcula(1, 1, { destino: { direccion: f[0] } }).total;
    if (p < 5000 || p > 200000) raros.push({ destino: f[0], precio: p });
  });
  igual('ni lo que devuelve el codigo', raros, []);
})();

/* ============ 3. LA CDMX Y LA HUASTECA, RECONSTRUIDAS ============
   Sus precios del Excel vienen CON dias y movimientos incluidos. Aqui se
   comprueba que las reglas, sumadas, den esos mismos numeros.

   Los cinco renglones del Excel, copiados a mano:
       CDMX 1 DIA ......... 26,000
       CDMX X 2 dias ...... 30,000
       CDMX 3 días ........ 34,000
       HUASTECA 3 DIAS .... 38,500
       HUASTECA 4 dias .... 42,500                                        */
(function () {
  const OCHO_HORAS = { horaInicio: '08:00', horaFin: '16:00' };
  function movDe(n) { const l = []; for (let i = 0; i < n; i++) l.push(OCHO_HORAS); return l; }

  const DEL_EXCEL = [
    ['Ciudad de México, Ciudad de México, México', 1, 26000],
    ['Ciudad de México, Ciudad de México, México', 2, 30000],
    ['Ciudad de México, Ciudad de México, México', 3, 34000],
    ['Huasteca Potosina, San Luis Potosí, México', 3, 38500],
    ['Huasteca Potosina, San Luis Potosí, México', 4, 42500]
  ];

  const rotos = [];
  DEL_EXCEL.forEach(function (f) {
    const dias = f[1];
    const p = t.calcula(1200, dias, {
      destino: { direccion: f[0] },
      noches: dias - 1,
      movimientos: movDe(dias)                  // se mueve TODOS los dias
    });
    if (p.total !== f[2]) rotos.push({ destino: f[0], dias: dias, dio: p.total, excel: f[2] });
  });
  igual('los cinco renglones con dias del Excel cuadran al peso', rotos, []);

  /* Y el caso que el dueño dicto con sus palabras: 4 dias, movimientos en 2.
     Los dos dias parados valen $1,000 cada uno «porque se queda la sprinter
     inutil ahi».
         22,000 de base + 4 dias × 1,000 + 2 movimientos × 3,000 = 32,000    */
  const cuatroConDos = t.calcula(1102, 4, {
    destino: { direccion: 'Ciudad de México, Ciudad de México, México' },
    noches: 3, movimientos: movDe(2)
  });
  igual('CDMX 4 dias con movimientos en 2: 32,000', cuatroConDos.total, 32000);
})();

/* ============ 3b. LAS CORRECCIONES DEL DUEÑO, AL PESO ============
   El 26-ago-2026 el dueño tumbo el modelo de «3 noches gratis + $1,000»:
   cobraba $5,500 de menos en Guanajuato 3 dias y $13,000 de mas en Cancun.
   Cada renglon de aqui es una correccion suya contra el Excel. Si alguno se
   pone rojo, se le esta cobrando mal a un cliente otra vez. */
(function () {
  function sinMov(direccion, dias) {
    return t.calcula(999, dias, {
      destino: { direccion: direccion }, noches: Math.max(0, dias - 1), movimientos: []
    }).total;
  }

  /* los precios por duracion del Excel, tal cual */
  igual('Guanajuato MISMO DIA: 19,000', sinMov('Guanajuato, Guanajuato, México', 1), 19000);
  igual('Guanajuato 3 DIAS SIN MOV: 24,500 (cobraba 19,000)', sinMov('Guanajuato, Guanajuato, México', 3), 24500);
  /* el dia extra que dicto el dueño: «mil quinientos» (26-ago-2026);
     el primer calculo, 2,750 deducido de los escalones, le parecio caro */
  igual('Guanajuato 4 dias: 24,500 + 1,500', sinMov('Guanajuato, Guanajuato, México', 4), 26000);
  igual('Guanajuato 5 dias: 24,500 + 3,000', sinMov('Guanajuato, Guanajuato, México', 5), 27500);
  /* «dejalos en 1500» (26-ago-2026): El Manto y Tlalpujahua, mismo dia extra */
  igual('El Manto 4 dias: 19,000 + 1,500', sinMov('El Manto, Jalisco, México', 4), 20500);
  igual('Tlalpujahua 3 dias: 26,500 + 1,500', sinMov('Tlalpujahua, Michoacán, México', 3), 28000);
  igual('El Manto 1 DIA: 14,000', sinMov('El Manto, Jalisco, México', 1), 14000);
  igual('El Manto 3 DIAS: 19,000 (cobraba 14,000)', sinMov('El Manto, Jalisco, México', 3), 19000);
  igual('Tlalpujahua 1 DIA: 23,500', sinMov('Tlalpujahua, Michoacán, México', 1), 23500);
  igual('Tlalpujahua 2 DIAS: 26,500 (cobraba 23,500)', sinMov('Tlalpujahua, Michoacán, México', 2), 26500);
  igual('Talpa 1 DIA: 15,000', sinMov('Talpa de Allende, Jalisco, México', 1), 15000);
  igual('Talpa 2 dias: 16,500 (cobraba 15,000)', sinMov('Talpa de Allende, Jalisco, México', 2), 16500);
  /* y entre escalones, el dia extra PROPIO: Talpa 3 dias = 16,500 + 1,500 */
  igual('Talpa 3 dias: 16,500 + su dia extra de 1,500', sinMov('Talpa de Allende, Jalisco, México', 3), 18000);

  /* la Burrita es OTRO producto, no Talpa mas dias: es la peregrinacion —la
     gente se va caminando y el camion la va esperando en puntos (R4) */
  igual('Talpa Burrita 4 dias: 26,500', sinMov('Talpa Burrita, Jalisco, México', 4), 26500);
  igual('escribir «burrita» no cae en la Talpa normal',
    t.calcula(999, 4, { destino: { direccion: 'peregrinación talpa burrita' }, noches: 3 })
      .interno.destinoDeLista, 'Talpa Burrita (peregrinación)');

  /* los paquetes ya incluyen sus dias (R2) */
  igual('Cancun 17 dias: 145,000 pelados (cobraba 158,000)', sinMov('Cancún, Quintana Roo, México', 17), 145000);
  igual('Chiapas 8 dias: 85,000 pelados (cobraba 89,000)', sinMov('San Cristóbal de las Casas, Chiapas, México', 8), 85000);
  igual('y el dia 18 de Cancun SI se cobra', sinMov('Cancún, Quintana Roo, México', 18), 146000);

  /* CDMX y Huasteca sin movimientos: $1,000 por dia, no noches gratis (R3).
     Palabras del dueño: «si no tiene movimientos, nomas vas a cobrar mil». */
  igual('CDMX 3 dias sin movimientos: 22,000 + 3,000', sinMov('Ciudad de México, Ciudad de México, México', 3), 25000);
  igual('Huasteca 3 dias sin movimientos: 26,500 + 3,000', sinMov('Huasteca Potosina, San Luis Potosí, México', 3), 29500);

  /* --- la segunda tanda de correcciones del dueño (26-ago-2026) --- */

  /* Puebla: «el dia tres subele a dos mil» */
  igual('Puebla 2 dias: sus 36,500', sinMov('Puebla, Puebla, México', 2), 36500);
  igual('Puebla 3 dias: 36,500 + 2,000', sinMov('Puebla, Puebla, México', 3), 38500);
  igual('Zacatlan 3 dias: 39,500 + 2,000', sinMov('Zacatlán, Puebla, México', 3), 41500);

  /* Tolantongo con movimientos: el precio del Excel, no la suma de bandas.
     Antes daba 41,500 y el dueño dijo: «si, estas mal, dalo de acuerdo al
     Excel». */
  const tolantongo = t.calcula(999, 3, {
    destino: { direccion: 'Grutas Tolantongo, Hidalgo, México' }, noches: 2,
    movimientos: [{ horaInicio: '08:00', horaFin: '16:00' },
                  { horaInicio: '08:00', horaFin: '16:00' }]
  });
  igual('Tolantongo CON movimientos: los 34,500 del Excel (cobraba 41,500)', tolantongo.total, 34500);
  igual('y el desglose sigue sumando el total',
    tolantongo.desglose.servicio + tolantongo.desglose.importeMovimientos, 34500);
  igual('Tolantongo SIN movimientos sigue en 29,500', sinMov('Grutas Tolantongo, Hidalgo, México', 3), 29500);

  /* Guayabitos, confirmado: hasta 4 dias su precio, y cada noche de mas
     suma 1,000 */
  igual('Guayabitos 4 dias: sus 18,500', sinMov('Rincón de Guayabitos, Nayarit, México', 4), 18500);
  igual('Guayabitos 5 dias: 18,500 + 1,000', sinMov('Rincón de Guayabitos, Nayarit, México', 5), 19500);

  /* El recorrido combinado que el dueño mando crear («crealo»): antes caia
     en Mariposa (23,000) o en Patzcuaro (25,000) y cobraba de menos. */
  igual('Mariposa/Azufres/Patzcuaro: sus 29,000',
    sinMov('tour mariposa monarca, los azufres y pátzcuaro', 1), 29000);
  igual('y la Mariposa sola sigue en 23,000',
    sinMov('Santuario de la Mariposa Monarca, Michoacán, México', 1), 23000);
  igual('y Patzcuaro solo sigue en 25,000',
    sinMov('Pátzcuaro, Michoacán, México', 1), 25000);

  /* El estado NO es la capital (mismo defecto que Guanajuato y Oaxaca,
     cazado el 26-ago-2026): Nochistlán está a 150 km de Guadalajara y caía
     en los 25,000 de Zacatecas capital. */
  igual('Nochistlán NO cae en la capital de Zacatecas',
    t.calcula(300, 1, { destino: { direccion: 'Nochistlán de Mejía, Zacatecas, México' } })
      .interno.destinoDeLista, null);
  igual('la capital sí sigue cayendo en su renglón',
    t.calcula(708, 1, { destino: { direccion: 'Zacatecas, Zacatecas, México' } })
      .interno.destinoDeLista, 'Zacatecas');

  /* --- SOLO IDA: 65% del precio de un día sin movimientos (26-ago-2026) ---
     Antes un solo-ida a un destino de lista cobraba lo mismo que el redondo:
     `redondo` se calculaba en cotizar y NUNCA llegaba a calcula. */
  function soloIda(direccion, dias, extra) {
    return t.calcula(999, dias || 1, Object.assign({
      destino: { direccion: direccion }, noches: 0, movimientos: [], redondo: false
    }, extra || {})).total;
  }
  /* Chapala 1 día son $6,500 → solo ida = floor(0.65×6500 /100)×100 = 4,200 */
  igual('Chapala solo ida: 65% de 6,500 = 4,200', soloIda('Chapala, Jalisco, México'), 4200);
  igual('Chapala redondo sigue en 6,500', sinMov('Chapala, Jalisco, México', 1), 6500);
  /* Tequila 7,000 → 0.65×7000 = 4,550 → floor a 4,500 */
  igual('Tequila solo ida: 4,500', soloIda('Tequila, Jalisco, México'), 4500);
  /* Un solo-ida IGNORA días, noches y movimientos: aunque le manden 5 días y
     movimientos, sigue siendo el 65% del precio de UN día. */
  igual('solo ida ignora los días extra',
    soloIda('Chapala, Jalisco, México', 5, { noches: 4 }), 4200);
  igual('solo ida ignora los movimientos',
    soloIda('Chapala, Jalisco, México', 3, { movimientos: [
      { horaInicio: '08:00', horaFin: '16:00' }, { horaInicio: '08:00', horaFin: '16:00' }] }), 4200);
  /* Un destino de fórmula: 65% de su precio redondo de un día. A 999 km el
     redondo de 1 día es floor((6500 + 22×999)/100)×100 = 28,400 → 0.65 =
     18,460 → floor a 18,400. */
  const redondoFormula = t.calcula(999, 1, { destino: { direccion: 'un pueblo cualquiera' }, noches: 0, movimientos: [] }).total;
  igual('la fórmula redonda de referencia', redondoFormula, 28400);
  igual('fórmula solo ida: 65% de ese redondo', soloIda('un pueblo cualquiera'), 18400);

  /* --- fechas invertidas (26-ago-2026) ---
     El `Math.max(1, …)` de diasDeServicio tragaba un regreso anterior a la
     salida como un viaje de un día y lo cotizaba sin avisar. */
  igual('regreso ANTES que salida se detecta',
    t.regresoAntesDeSalida('2026-09-10', '2026-09-05'), true);
  igual('mismo día no es invertido',
    t.regresoAntesDeSalida('2026-09-10', '2026-09-10'), false);
  igual('un viaje normal tampoco',
    t.regresoAntesDeSalida('2026-09-10', '2026-09-12'), false);
  igual('sin regreso no es invertido (es solo ida)',
    t.regresoAntesDeSalida('2026-09-10', ''), false);
  igual('con fechas ilegibles no inventa un error de orden',
    t.regresoAntesDeSalida('no-es-fecha', 'tampoco'), false);
})();

/* ============ 4. LA FORMULA DE RESPALDO, KILOMETRO POR KILOMETRO ============ */
(function () {
  let malos = 0, primero = null;
  for (let km = 0; km <= 1400; km++) {
    const esperado = 6500 + 22 * km;
    if (Math.abs(t.trasladoDe(km, null).total - esperado) > 0.000001) {
      malos++;
      if (primero === null) primero = km;
    }
  }
  igual('los 1,401 kilometros enteros dan 6,500 + 22 el km', [malos, primero], [0, null]);

  /* y con decimales, que es como llegan de Google */
  let malosDec = 0;
  for (let km = 0.1; km <= 1400; km += 7.3) {
    if (Math.abs(t.trasladoDe(km, null).total - (6500 + 22 * km)) > 0.000001) malosDec++;
  }
  igual('y con decimales tambien', malosDec, 0);

  /* el borde exacto del tope */
  igual('1,400 km justos todavia se cotizan solos', t.trasladoDe(1400, null).total, 6500 + 22 * 1400);
  igual('1,400.001 ya no', !!t.trasladoDe(1400.001, null).requiereAsesor, true);

  /* Un viaje sin precio no cobra NADA, ni noches ni movimientos */
  let conCobro = 0;
  for (let km = 1401; km <= 5000; km += 37) {
    const p = t.calcula(km, 5, {
      noches: 4,
      movimientos: [{ horaInicio: '08:00', horaFin: '16:00' }, { horaInicio: '08:00', horaFin: '21:00' }]
    });
    if (p.total !== 0 || p.anticipo !== 0 || p.desglose.servicio !== 0) conCobro++;
  }
  igual('arriba del tope NUNCA se cobra un peso', conCobro, 0);
})();

/* ============ 5. QUE TAN LEJOS QUEDA LA FORMULA DE SUS PRECIOS ============
   La formula solo contesta por los destinos que NO estan en la lista, asi que
   nunca cambia un precio suyo. Pero si se le va la mano con un destino nuevo,
   se le va a ir con todos. Esto mide el desvio contra sus 38 precios reales y
   lo deja anclado: si alguien toca la formula, aqui se ve cuanto la movio. */
(function () {
  const KM = {           /* ida y vuelta, medidos con la Routes API */
    'Chapala, Jalisco, México': 100, 'Tequila, Jalisco, México': 136,
    'Tapalpa, Jalisco, México': 262, 'Mazamitla, Jalisco, México': 268,
    'San Juan de los Lagos, Jalisco, México': 286, 'Zamora, Michoacán, México': 314,
    'El Manto, Jalisco, México': 314, 'Talpa de Allende, Jalisco, México': 402,
    'Tepic, Nayarit, México': 414, 'León, Guanajuato, México': 444,
    'Rincón de Guayabitos, Nayarit, México': 474, 'Chacala, Nayarit, México': 502,
    'Sayulita, Nayarit, México': 532, 'Guanajuato, Guanajuato, México': 550,
    'Manzanillo, Colima, México': 574, 'Morelia, Michoacán, México': 574,
    'Puerto Vallarta, Jalisco, México': 620, 'Punta Perula, Jalisco, México': 620,
    'Mismaloya, Puerto Vallarta, Jalisco, México': 656, 'Pátzcuaro, Michoacán, México': 656,
    'San Miguel de Allende, Guanajuato, México': 674, 'Barra de Navidad, Jalisco, México': 692,
    'Zacatecas, Zacatecas, México': 708, 'Tlalpujahua, Michoacán, México': 762,
    'Tenacatita, Jalisco, México': 762, 'Mayto, Jalisco, México': 798,
    'Mazatlán, Sinaloa, México': 962, 'Valle de Bravo, Estado de México, México': 1032,
    'Ixtapa Zihuatanejo, Guerrero, México': 1056, 'Grutas Tolantongo, Hidalgo, México': 1102,
    'Real de Catorce, San Luis Potosí, México': 1186, 'Puebla, Puebla, México': 1338,
    'Zacatlán, Puebla, México': 1368
  };

  let suma = 0, cuantos = 0, peor = 0, peorNombre = '';
  SU_LISTA.forEach(function (f) {
    const km = KM[f[0]];
    if (km === undefined) return;                 // los de arriba del tope no aplican
    const err = Math.abs(formulaAMano(km) - f[1]);
    suma += err; cuantos++;
    if (err > peor) { peor = err; peorNombre = f[0]; }
  });
  const promedio = Math.round(suma / cuantos);
  console.log('(la formula contra ' + cuantos + ' precios reales: $' + promedio.toLocaleString('es-MX') +
    ' de error promedio; el peor es ' + peorNombre.split(',')[0] + ' con $' + peor.toLocaleString('es-MX') + ')');

  igual('la formula no se desvia mas de $2,500 en promedio', promedio <= 2500, true);
  igual('y de ningun destino se aleja mas de $6,000', peor <= 6000, true);
})();

/* ============ 6. EL VIAJE COMPLETO, MILES DE COMBINACIONES ============
   Destinos FUERA de la lista, para auditar la formula, el piso, la estadia y
   los movimientos todos juntos contra el modelo escrito a mano. */
(function () {
  const HUASTECA = { placeId: 'ChIJv8IdsTSP1oURPsKDyokOts4' };   // solo el id: la lista no lo ve
  const OTRO = { placeId: 'ChIJ_cualquier_otro' };

  const JUEGOS_DE_MOVIMIENTOS = [
    [],
    [{ horaInicio: '08:00', horaFin: '16:00', horas: 8 }],
    [{ horaInicio: '08:00', horaFin: '17:30', horas: 9.5 }, { horaInicio: '09:00', horaFin: '21:00', horas: 12 }],
    [{ horaInicio: '07:00', horaFin: '21:00', horas: 14 }, { horaInicio: '08:00', horaFin: '16:00', horas: 8 },
     { horaInicio: '08:00', horaFin: '18:01', horas: 10 + 1 / 60 }]
  ];

  let casos = 0;
  const rotos = { total: [], anticipo: [], desglose: [], huasteca: [] };

  for (let km = 0; km <= 1400; km += 13) {
    for (const dias of [1, 3, 4, 6, 9, 15]) {
      const noches = Math.max(0, dias - 1);
      for (let j = 0; j < JUEGOS_DE_MOVIMIENTOS.length; j++) {
        const movs = JUEGOS_DE_MOVIMIENTOS[j];
        for (const destino of [OTRO, HUASTECA]) {
          const esHuasteca = destino === HUASTECA;
          casos++;

          // --- a mano ---
          const cuantos = Math.min(movs.length, dias);      // el tope son los DIAS
          let movAMano = 0;
          for (let i = 0; i < cuantos; i++) {
            movAMano += diaDeMovimientoAMano(movs[i].horas, esHuasteca);
          }
          /* La Huasteca cobra su estadia por dia SIEMPRE (criterio R3);
             el destino cualquiera sigue con el paquete de 3 noches. */
          const esperado = trasladoAMano(formulaAMano(km), dias) +
            estadiaAMano(dias, noches, cuantos, esHuasteca) + movAMano;

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

/* ============ 7. LO MISMO, PERO CON DESTINOS DE SU LISTA ============
   Aqui el traslado sale de la tabla y no de la formula, y hay que comprobar
   que el resto de las reglas se le suman igual. */
(function () {
  const MOVS = [
    [],
    [{ horaInicio: '08:00', horaFin: '16:00', horas: 8 }],
    [{ horaInicio: '06:00', horaFin: '20:30', horas: 14.5 }, { horaInicio: '08:00', horaFin: '17:00', horas: 9 }]
  ];

  let casos = 0;
  const rotos = [];
  SU_LISTA.forEach(function (fila) {
    for (const dias of [1, 4, 7, 12]) {
      const noches = Math.max(0, dias - 1);
      for (const movs of MOVS) {
        casos++;
        const cuantos = Math.min(movs.length, dias);
        let movAMano = 0;
        for (let i = 0; i < cuantos; i++) movAMano += diaDeMovimientoAMano(movs[i].horas, false);

        /* Tres formas de armar el esperado, segun la regla del Excel
           (cambio de lado el 26-ago-2026, criterio R1 y R2):
             · porDias: el precio ya es de ESA duracion, sin estadia aparte;
               los movimientos si se suman (el Excel dice «SIN MOV»).
             · diasIncluidos: paquete; noches gratis hasta un dia antes del
               regreso. Antes Cancun 17 dias cobraba $13,000 de mas.
             · sin regla: el modelo de siempre. */
        const reglaExcel = fila[2] || null;
        let esperado;
        if (reglaExcel && reglaExcel.conMovimientos && cuantos > 0) {
          /* R5: el precio con movimientos del Excel ya lo incluye todo;
             solo el piso por dia le puede ganar. */
          esperado = trasladoAMano(reglaExcel.conMovimientos, dias);
        } else if (reglaExcel && reglaExcel.porDias) {
          esperado = trasladoAMano(porDuracionAMano(reglaExcel, dias), dias) + movAMano;
        } else if (reglaExcel && reglaExcel.diasIncluidos) {
          const gratis = Math.max(3, reglaExcel.diasIncluidos - 1);
          const estadia = cuantos > 0 ? dias * 1000 : Math.max(0, noches - gratis) * 1000;
          esperado = trasladoAMano(fila[1], dias) + estadia + movAMano;
        } else {
          esperado = trasladoAMano(fila[1], dias) + estadiaAMano(dias, noches, cuantos, false) + movAMano;
        }

        const p = t.calcula(999, dias, {
          destino: { direccion: fila[0] }, noches: noches, movimientos: movs
        });
        if (p.total !== esperado) {
          rotos.push({ destino: fila[0], dias: dias, movs: movs.length, dio: p.total, esperaba: esperado });
        }
      }
    }
  });
  console.log('(' + casos.toLocaleString('es-MX') + ' viajes a destinos de su lista)');
  igual('con precio de lista, las demas reglas se suman igual', rotos.length, 0);
  if (rotos.length) console.log('   primeros fallos: ' + JSON.stringify(rotos.slice(0, 3), null, 1));
})();

/* ============ 8. LO QUE EL CLIENTE NO PUEDE VER ============ */
(function () {
  let fugas = 0;
  for (let km = 100; km <= 1400; km += 97) {
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

  /* y con un destino de la lista tampoco sale el NOMBRE del renglon, que
     diria «este precio salio de una tabla» */
  const conLista = t.calcula(620, 4, {
    destino: { direccion: 'Puerto Vallarta, Jalisco, México' }, noches: 3
  });
  const afuera = Object.assign({}, conLista);
  delete afuera.interno;
  igual('ni de que renglon de la lista salio',
    JSON.stringify(afuera).indexOf('Vallarta'), -1);
})();

console.log('\n' + buenas + ' buenas, ' + malas + ' malas');
process.exit(malas ? 1 : 0);
