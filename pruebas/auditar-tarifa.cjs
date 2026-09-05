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
/* R41 (1-sep-2026) · A la centena MAS CERCANA, no a la de abajo. Antes esto
   era `Math.floor` y por eso la fórmula de referencia daba 28,400 donde ahora
   da 28,500. */
const corta = n => Math.round(n / 100) * 100;

/* El traslado de un destino que NO esta en la lista */
function formulaAMano(km) {
  if (km > 1400) return null;                 // null = lo cotiza un asesor
  return 6500 + 22 * km;
}
/* R34 (1-sep-2026) · EL PISO YA NO DEFIENDE A LA LISTA.

   Antes decia:
       return corta(Math.max(precioBase, dias * 3000));
   o sea que el minimo de $3,000 por dia se aplicaba a todo. El dueño lo
   corrigio: un precio de SU lista es su precio, y el piso no puede subirlo.
   El piso sigue existiendo, pero solo para la formula — para los destinos
   que el no coti- zo nunca.

   Por eso ahora hay que decirle si el precio viene de la lista. */
function trasladoAMano(precioBase, dias, deLista) {
  return corta(deLista ? precioBase : Math.max(precioBase, dias * 3000));
}
/* La estadia se cobra de dos formas, y cual depende de si hay movimientos.

   `porDia` cambio de lado el 26-ago-2026: el dueño confirmo que CDMX y
   Huasteca cobran $1,000 por CADA dia de estadia AUNQUE no haya movimientos
   («si no tiene movimientos, nomas vas a cobrar mil»). Antes esos casos
   caian en el paquete de 3 noches gratis, que era un modelo inventado
   (criterio de precios, error nº 1). */
/* CAMBIO DE LADO el 26-ago-2026. Antes decia:
       if (porDia || cuantosMovimientos > 0) return dias * 1000;
   o sea que UN movimiento borraba las 3 noches incluidas y cobraba 1,000 por
   todos los dias. El dueño lo corrigio: «la playa es sencillo: cada noche que
   supere las 3 noches por defecto son 1000, y si tiene movimientos son 3000 x
   dia». Estadia y movimiento se SUMAN; no se excluyen.

   `porDia` (CDMX y Huasteca) sigue igual: su precio es un traslado de un dia,
   no un paquete, asi que ahi si se cobra desde el primer dia. */
/* CAMBIO DE LADO OTRA VEZ el 28-ago-2026, y tampoco por un arreglo: por una
   decision del dueño. Antes decia:

       return Math.max(0, noches - 3) * 1000;

   o sea tres noches incluidas para todos. Ese dia dicto R18: «esos 500
   exclusivamente a destinos abajo de 15,000 en precio normal». Abajo de ese
   precio ya solo viene UNA noche incluida, y las dos que se destaparon valen
   $500 — pero de la cuarta en adelante manda la de mil, porque esas ya se
   cobraban y cobrar una noche gratis no puede abaratar las demas.

   `precioNormal` es el traslado ANTES del piso y del corte: el corte de los
   15,000 lo hace el precio del viaje, no el de la lista ni la distancia. */
/* R25 REVOCA A R18 (30-ago-2026) · Tres noches incluidas para TODOS, sin
   importar el precio del viaje. R18 —«abajo de $15,000 solo viene una noche y
   las otras dos valen $500»— vivio dos dias y el dueño la deshizo.

   Todo el enredo de `barato`, `incluidas` y `destapadas` que estaba aqui era
   la copia a mano de R18. Se va completo. */
function estadiaAMano(dias, noches, cuantosMovimientos, porDia, precioNormal) {
  if (porDia) return dias * 1000;                      // CDMX y Huasteca: dia por dia
  return Math.max(0, noches - 3) * 1000;
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

/* R22 (29-ago-2026) · EL VIAJE DE UN DIA NO PAGA MOVIMIENTOS.

   Un viaje de un dia ES el movimiento: se sale, se anda y se regresa. Cobrar
   aparte por «moverse» seria cobrarlo dos veces.

   Faltaba aqui, y era la causa de dos de las auditorias en rojo: la de los
   5,184 viajes y la de los 528 con precio de lista. Las dos esperaban que
   Chapala a un dia con movimientos costara $3,000 mas. */
function movimientosAMano(movs, dias, esHuasteca) {
  /* LA EXCEPCION DE R22, escrita en el criterio: a CDMX y la Huasteca NO se
     les aplica. Su precio del Excel es una base MAS dias CON movimientos
     —«son cuatro mil por dia extra, pero con movimientos», R3—, asi que
     perdonarles el del primer dia tira su propia celda: CDMX un dia caeria a
     $23,000 cuando su Excel dice $26,000.

     La diferencia de fondo: «GUANAJUATO MISMO DIA $19,000» es el precio
     COMPLETO de ese dia y ya trae el movimiento dentro; «CDMX 1 DIA $26,000»
     es una BASE a la que se le suma el dia. */
  if (dias <= 1 && !esHuasteca) return 0;
  let suma = 0;
  for (let i = 0; i < movs.length; i++) {
    suma += diaDeMovimientoAMano(movs[i].horas, esHuasteca);
  }
  return suma;
}

/* R51 (2-sep-2026) · El anticipo es el 20% redondeado HACIA ARRIBA al medio
   millar. Antes esta auditoria lo comparaba contra `Math.round(total * 0.2)`. */
const anticipoAMano = total => Math.ceil(total * 0.20 / 500) * 500;

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
  /* R38 (1-sep-2026) · De $5,000 a $6,000, para igualarlo a Tala: «estos dos
     muy caros, deben ser minimo 9,000» — los DOS. Ninguno esta en el Excel. */
  ['Zacoalco de Torres, Jalisco, México', 6000],
  ['Cocula, Jalisco, México', 6500],
  /* Cambió de 8,500 a 7,000 el 26-ago-2026. No es que la prueba estuviera
     mal: el dueño bajó el precio de lista de la Sprinter a Tequila. */
  ['Tequila, Jalisco, México', 7000],
  ['Tapalpa, Jalisco, México', 14500],
  ['Mazamitla, Jalisco, México', 14500],
  ['San Juan de los Lagos, Jalisco, México', 14000],
  /* R24 · Su precio del Excel YA TRAE un dia de movimiento dentro, asi que
     el primero no se cobra aparte. Faltaba aqui y era el ultimo rojo de esta
     auditoria: pedia $17,500 a 4 dias con un movimiento donde van $14,500.

     NOTA · Morelia y la Mariposa Monarca tambien llevan `movimientosIncluidos`
     en el catalogo y NO hacen falta aqui: sus reglas del Excel los absorben
     por otro camino. Si algun dia empiezan a fallar, es por esto. */
  ['Zamora, Michoacán, México', 14500, { movimientosIncluidos: 1 }],
  /* El tercer campo es la regla del Excel para ese destino, cuando la hay:
     `porDias` son sus precios por duracion, `diasIncluidos` marca paquete.
     Entraron el 26-ago-2026, cuando el dueño tumbo el modelo de noches. */
  /* Los dias extra deducidos de los escalones (2,500 y 3,000) los bajo el
     dueño a 1,500 el 26-ago-2026, como el de Guanajuato. */
  ['El Manto, Jalisco, México', 14000, { movimientosIncluidos: 3, porDias: { 1: 14000, 3: 19000 }, diaExtra: 1500 }],
  ['Talpa de Allende, Jalisco, México', 15000, { movimientosIncluidos: 2, porDias: { 1: 15000, 2: 16500 }, diaExtra: 1500 }],
  ['Tepic, Nayarit, México', 16900],
  ['León, Guanajuato, México', 17600],
  ['Rincón de Guayabitos, Nayarit, México', 18500],
  ['Chacala, Nayarit, México', 16500],
  ['Sayulita, Nayarit, México', 18000],
  /* El dia extra bajo de 2,750 (deducido de los escalones) a 1,500 por
     correccion del dueño el 26-ago-2026: «si queda muy caro». */
  ['Guanajuato, Guanajuato, México', 19000, { porDias: { 1: 19000, 3: 24500 }, diaExtra: 1500 }],
  ['Manzanillo, Colima, México', 18500],
  ['Morelia, Michoacán, México', 19000, { movimientosIncluidos: 1 }],
  ['Puerto Vallarta, Jalisco, México', 19000],
  ['Punta Perula, Jalisco, México', 20500],
  ['Mismaloya, Puerto Vallarta, Jalisco, México', 20000],
  ['Pátzcuaro, Michoacán, México', 25000],
  ['San Miguel de Allende, Guanajuato, México', 26500],
  ['Barra de Navidad, Jalisco, México', 20500],
  ['Zacatecas, Zacatecas, México', 25000],
  ['Tlalpujahua, Michoacán, México', 23500, { movimientosIncluidos: 2, porDias: { 1: 23500, 2: 26500 }, diaExtra: 1500 }],
  ['Tenacatita, Jalisco, México', 20000],
  ['Mayto, Jalisco, México', 26500],
  ['Mazatlán, Sinaloa, México', 28000],
  ['Valle de Bravo, Estado de México, México', 32000],
  ['Ixtapa Zihuatanejo, Guerrero, México', 29500],
  /* Tolantongo trae en el Excel su propio precio CON movimientos, que ya lo
     incluye todo (correccion del dueño, 26-ago-2026). */
  /* Tolantongo son TRES dias («4» = donde empieza el dia extra, 26-ago-2026) */
  ['Grutas Tolantongo, Hidalgo, México', 29500, { conMovimientos: 34500, diasIncluidos: 3 }],
  ['Real de Catorce, San Luis Potosí, México', 34500],
  /* Puebla: 2 dias del Excel y $2,000 el dia extra («el dia tres subele a
     dos mil», 26-ago-2026; cuadra con su fila 10: «$2,000 SPR»). */
  /* R47 y R50 (1-sep-2026) · El dia extra de Puebla son $4,000 CON
     movimiento y $1,000 sin el. Aqui va el de sin, que es lo que audita
     `sinMov`; el de con se comprueba en la seccion del dia con movimiento.
     Traia $2,000 porque se habia copiado la nota de la celda de al lado
     (Q10, que es Zacatlan) en vez de la suya (P10). */
  ['Puebla, Puebla, México', 36500, { movimientosIncluidos: 2, porDias: { 2: 36500 }, diaExtra: 1000 }],
  ['Zacatlán, Puebla, México', 39500, { movimientosIncluidos: 2, porDias: { 2: 39500 }, diaExtra: 2000 }],
  /* «ACAPULCO 4 DIAS», y su dia vale 2,000 en los dos sentidos (26-ago-2026) */
  /* R35 (1-sep-2026) · «acapulco dice 60,000 4 dias, si fueran 5 serian
     64,000». El dia extra son $4,000, no $2,000. */
  ['Acapulco, Guerrero, México', 60000, { diasIncluidos: 4, diaExtra: 4000 }],
  ['Oaxaca de Juárez, Oaxaca, México', 75000],
  /* Chiapas: 85,000 POR 8 DIAS, y su dia vale 4,000 en los dos sentidos,
     igual que Cancun («Chiapas igual que Cancun, 4000», 26-ago-2026). */
  ['San Cristóbal de las Casas, Chiapas, México', 85000, { movimientosIncluidos: 8, diasIncluidos: 8, diaExtra: 4000 }],
  /* Barrancas: SIETE dias, y su dia vale 3,000 CON O SIN movimientos
     (dictado 26-ago-2026). Su columna del Excel no dice los dias. */
  ['Barrancas del Cobre, Chihuahua, México', 75000, { diasIncluidos: 7, diaExtra: 3000, movimientoCero: true }],
  /* Cancun: 145,000 POR 17 DIAS, y su dia vale 4,000 en los dos sentidos
     («el dia esta en 4000» / «si quiere 15 dias serian 8,000 menos»). */
  ['Cancún, Quintana Roo, México', 145000, { diasIncluidos: 17, diaExtra: 4000 }]
];

/* ============ 1. LA LISTA DA EXACTAMENTE LO QUE DICE EL EXCEL ============
   Un dia de servicio, sin noches ni movimientos: el precio pelado. */
(function () {
  const rotos = [];
  SU_LISTA.forEach(function (fila) {
    /* Cada destino se pide a SU duracion de referencia: la del Excel si la
       tiene. Cancun son $145,000 POR 17 DIAS, no un precio pelado — desde el
       26-ago-2026 su dia vale $4,000 y se descuenta hacia abajo, asi que
       pedirlo a un dia ya no da el numero del Excel (y no debe darlo). */
    const regla = fila[2] || {};
    const dias = regla.diasIncluidos || 1;
    const dio = t.calcula(1, dias, { destino: { direccion: fila[0] }, noches: 0, movimientos: [] }).total;
    /* R34 · Es precio DE LISTA: el piso de los $3,000 por día no lo toca.
       Antes esta línea no lo distinguía, y por eso Zacoalco a un día salía
       en $5,000 —el piso mandaba— cuando su precio es $6,000. */
    const esperado = trasladoAMano(fila[1], dias, true);
    if (dio !== esperado) rotos.push({ destino: fila[0], dias: dias, dio: dio, esperaba: esperado });
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
  /* Cambio de lado el 26-ago-2026: el dia de Cancun vale $4,000, no $1,000
     («Cancun, el dia esta en 4000»). Antes esta prueba exigia 146,000. */
  igual('y el dia 18 de Cancun vale 4,000, no 1,000',
    sinMov('Cancún, Quintana Roo, México', 18), 149000);

  /* CDMX y Huasteca sin movimientos: $1,000 por dia, no noches gratis (R3).
     Palabras del dueño: «si no tiene movimientos, nomas vas a cobrar mil». */
  igual('CDMX 3 dias sin movimientos: 22,000 + 3,000', sinMov('Ciudad de México, Ciudad de México, México', 3), 25000);
  igual('Huasteca 3 dias sin movimientos: 26,500 + 3,000', sinMov('Huasteca Potosina, San Luis Potosí, México', 3), 29500);

  /* --- la segunda tanda de correcciones del dueño (26-ago-2026) --- */

  /* Puebla · R47 y R50: el dia extra son $1,000 SIN movimiento. Zacatlan va
     por su cuenta y si son $2,000 (su celda Q10 dice «$2,000 SPR»). */
  igual('Puebla 2 dias: sus 36,500', sinMov('Puebla, Puebla, México', 2), 36500);
  igual('Puebla 3 dias sin movimiento: 36,500 + 1,000', sinMov('Puebla, Puebla, México', 3), 37500);
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
  /* Un destino de fórmula: 65% de su precio redondo de un día. A 999 km,
     6,500 + 22×999 = 28,478.

     R41 (1-sep-2026) · Ese 28,478 va a la centena MÁS CERCANA: **28,500**.
     Antes se cortaba hacia abajo y daba 28,400 — de ahí venía este número. */
  const redondoFormula = t.calcula(999, 1, { destino: { direccion: 'un pueblo cualquiera' }, noches: 0, movimientos: [] }).total;
  igual('la fórmula redonda de referencia', redondoFormula, 28500);
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

  /* ============ LA TANDA DEL 26-ago-2026, SEGUNDA PARTE ============ */

  function conMov(direccion, dias, cuantos) {
    const m = [];
    for (let i = 0; i < cuantos; i++) m.push({ horaInicio: '08:00', horaFin: '16:00' });
    return t.calcula(999, dias, {
      destino: { direccion: direccion }, noches: Math.max(0, dias - 1), movimientos: m
    }).total;
  }

  /* --- LA PLAYA: las 3 noches incluidas NO se pierden por moverse ---
     «cada noche que supere las 3 noches por defecto son 1000, y si tiene
     movimientos son 3000 x dia — o sea que un dia extra con movimientos
     son 4000». Antes, un solo movimiento borraba las noches incluidas y
     cobraba 1,000 por TODOS los dias: Vallarta 4d/2mov daba 29,000. */
  igual('Vallarta 4 dias sin movimientos: sus 19,000',
    sinMov('Puerto Vallarta, Jalisco, México', 4), 19000);
  igual('Vallarta 4 dias CON 2 movimientos: 19,000 + 2x3,000 (daba 29,000)',
    conMov('Puerto Vallarta, Jalisco, México', 4, 2), 25000);
  igual('Vallarta 6 dias CON 2 movimientos: + 2 noches extra + 2 bandas',
    conMov('Puerto Vallarta, Jalisco, México', 6, 2), 27000);
  igual('un dia extra CON movimiento son 4,000 (1,000 + 3,000)',
    conMov('Puerto Vallarta, Jalisco, México', 5, 1) -
    sinMov('Puerto Vallarta, Jalisco, México', 4), 4000);

  /* --- CANCUN: su dia vale 4,000 y se mueve en los DOS sentidos ---
     «Cancun, el dia esta en 4000» y «si el cliente quiere 15 dias solamente
     serian 8,000 menos del precio que esta en la tabla». */
  igual('Cancun 17 dias: sus 145,000 del Excel', sinMov('Cancún, Quintana Roo, México', 17), 145000);
  igual('Cancun 18 dias: +4,000 (antes +1,000)', sinMov('Cancún, Quintana Roo, México', 18), 149000);
  igual('Cancun 15 dias: 8,000 MENOS, como lo dictó', sinMov('Cancún, Quintana Roo, México', 15), 137000);
  igual('Cancun 16 dias: 4,000 menos', sinMov('Cancún, Quintana Roo, México', 16), 141000);

  /* --- y lo que NO debe haberse movido: CDMX y Huasteca reconstruyen su
     Excel al peso, porque su precio es un traslado de un dia, no un paquete */
  igual('CDMX 1 dia con movimiento sigue en sus 26,000',
    conMov('Ciudad de México, Ciudad de México, México', 1, 1), 26000);
  igual('CDMX 3 dias con movimientos sigue en sus 34,000',
    conMov('Ciudad de México, Ciudad de México, México', 3, 3), 34000);
  igual('Huasteca 3 dias con movimientos sigue en sus 38,500',
    conMov('Huasteca Potosina, San Luis Potosí, México', 3, 3), 38500);

  /* --- TOLANTONGO pasado el paquete (dictado 26-ago-2026) ---
     «Tolantongo 1000 sin movimientos, +3000 si hay movimientos». Antes el
     precio con movimientos era PLANO —34,500 dijeran lo que dijeran los
     dias— y el dia de mas no sumaba nada.

     Y son TRES dias: el dia extra empieza en el CUARTO. Se implemento
     primero con el paquete de siempre —4 dias— y el dueño lo corrigio con
     un «4» el mismo dia. */
  const TOL = 'Grutas Tolantongo, Hidalgo, México';
  igual('Tolantongo 3 dias, sin mov: sus 29,500', sinMov(TOL, 3), 29500);
  igual('Tolantongo 3 dias, con mov: sus 34,500', conMov(TOL, 3, 3), 34500);
  igual('el DIA 4 ya suma, sin mov: +1,000', sinMov(TOL, 4), 30500);
  igual('el DIA 4 con movimiento: +1,000 y +3,000', conMov(TOL, 4, 4), 38500);
  igual('dos dias de mas con movimiento: +2,000 y +6,000', conMov(TOL, 5, 5), 42500);

  /* --- CHIAPAS: su dia vale 4,000 y corre en los dos sentidos, como Cancun
     («Chiapas igual que Cancun, 4000», 26-ago-2026). Antes el dia 9 sumaba
     1,000 y pedir menos dias no descontaba nada. --- */
  const CHIS = 'San Cristóbal de las Casas, Chiapas, México';
  igual('Chiapas 8 dias: sus 85,000 del Excel', sinMov(CHIS, 8), 85000);
  igual('Chiapas 9 dias: +4,000 (antes +1,000)', sinMov(CHIS, 9), 89000);
  igual('Chiapas 7 dias: 4,000 MENOS', sinMov(CHIS, 7), 81000);
  igual('Chiapas 6 dias: 8,000 menos', sinMov(CHIS, 6), 77000);

  /* ACAPULCO: sus 4 dias no estaban marcados y su dia valia la noche de
     1,000. El dueño lo dicto en 2,000 el 26-ago-2026 («acapulco 2000 el
     dia»), y como todo dia dictado corre en los dos sentidos (R14). */
  const ACA = 'Acapulco, Guerrero, México';
  igual('Acapulco 4 dias: sus 60,000 del Excel', sinMov(ACA, 4), 60000);
  igual('Acapulco 5 dias: +4,000 (R35)', sinMov(ACA, 5), 64000);
  igual('Acapulco 3 dias: 4,000 menos (R35)', sinMov(ACA, 3), 56000);

  /* --- BARRANCAS DEL COBRE: 3,000 el dia, CON O SIN movimientos ---
     Dictado el 26-ago-2026. Es el primer destino donde moverse no cuesta
     aparte: alla el viaje ES el recorrido. Antes el dia valia la noche de
     1,000 y cada dia movido sumaba su banda encima. */
  /* Son SIETE dias: lo dicto el dueño el 26-ago-2026. Estuvo un rato con el
     paquete por omision de 4 y un viaje de 6 dias cobraba 81,000 en vez de
     72,000 — nueve mil de mas. */
  const BAR = 'Barrancas del Cobre, Chihuahua, México';
  igual('Barrancas 7 dias: sus 75,000 del Excel', sinMov(BAR, 7), 75000);
  igual('Barrancas 8 dias: +3,000', sinMov(BAR, 8), 78000);
  igual('Barrancas 6 dias: 3,000 menos (cobraba 81,000)', sinMov(BAR, 6), 72000);
  igual('Barrancas 5 dias: 6,000 menos', sinMov(BAR, 5), 69000);
  /* lo que lo distingue de todos los demas: moverse NO suma */
  [5, 6, 7, 9].forEach(function (d) {
    igual('Barrancas ' + d + ' dias: moverse no cambia el precio',
      conMov(BAR, d, d), sinMov(BAR, d));
  });
  /* ni con la banda mas cara, que en cualquier otro destino valdria 5,000 */
  const barLargo = t.calcula(999, 7, {
    destino: { direccion: BAR }, noches: 6,
    movimientos: [{ horaInicio: '08:00', horaFin: '21:00' }, { horaInicio: '08:00', horaFin: '21:00' }]
  });
  igual('ni con jornadas de 13 horas', barLargo.total, 75000);
  igual('y el desglose lo dice: cero de movimientos', barLargo.desglose.importeMovimientos, 0);

  /* Y los paquetes que el dueño NO ha tocado siguen dando su precio del
     Excel a su propia duracion. Es la prueba de que quitar el piso de las
     tres noches no movio a nadie mas. */
  igual('Talpa Burrita 4 dias sigue en 26,500', sinMov('peregrinación talpa burrita', 4), 26500);
  igual('Chiapas 8 dias sigue en 85,000', sinMov(CHIS, 8), 85000);
  igual('Cancun 17 dias sigue en 145,000', sinMov('Cancún, Quintana Roo, México', 17), 145000);
  igual('Guayabitos 4 dias sigue en 18,500', sinMov('Rincón de Guayabitos, Nayarit, México', 4), 18500);
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
  igual('1,400 km justos valen lo de siempre', t.trasladoDe(1400, null).total, 6500 + 22 * 1400);
  /* CAMBIO DE LADO DOS VECES, y la segunda deshizo a la primera.

     26-ago-2026: arriba del tope YA NO se pedia asesor («animate a cotizar
     tu»); entraba un «tramo largo» a $36 el km.

     1-sep-2026 · R45, y manda ésta: «si no sabes un precio al 100%, no se lo
     compartas al cliente: le dices que un vendedor lo va a contactar». El
     tramo largo se fue. Arriba de 1,400 km, un destino que NO esté en su
     lista deja de cotizarse.

     La razón está medida: la fórmula se equivoca $9,800 en promedio en los
     viajes largos contra $1,534 en los cortos, porque sus precios lejanos no
     son función del kilómetro —Oaxaca $75,000 a 1,988 km y Barrancas los
     mismos $75,000 a 2,882—.

     Esta auditoría llevaba desde entonces exigiendo lo contrario de la regla:
     pedía que SIEMPRE hubiera un precio arriba del tope. Eso es exactamente
     lo que R45 prohíbe. */
  igual('1,400.001 ya no se cotiza solo', !!t.trasladoDe(1400.001, null).requiereAsesor, true);
  igual('y no hay tramo largo que valga', !!t.trasladoDe(1400.001, null).tramoLargo, false);

  /* Lo que hay que cuidar ahora es lo opuesto: que arriba del tope NUNCA
     salga un número. Y sobre todo que los montos vengan en CERO — un precio
     a medias se cobraría; un cero la pantalla sabe leerlo. */
  let malosLargo = 0;
  for (let km = 1401; km <= 5000; km += 37) {
    const p = t.calcula(km, 5, {
      noches: 4,
      movimientos: [{ horaInicio: '08:00', horaFin: '16:00' }, { horaInicio: '08:00', horaFin: '21:00' }]
    });
    if (!p.requiereAsesor) malosLargo++;
    if (p.total !== 0 || p.anticipo !== 0 || p.saldo !== 0) malosLargo++;
  }
  igual('arriba del tope NUNCA hay precio, y todo viene en cero (R45)', malosLargo, 0);

  /* Los de SU lista sí siguen cotizando, por lejos que estén: ésos son
     precios suyos, no estimaciones. Cancún está a 4,282 km. */
  const cancun = t.calcula(4282, 5, {
    destino: { direccion: 'Cancún, Quintana Roo, México' }, noches: 4, movimientos: []
  });
  igual('pero un destino de su lista sí cotiza, aunque esté lejísimos',
    cancun.requiereAsesor === true || cancun.total === 0, false);
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
          /* R22 · Si el viaje es de un dia, los movimientos NO se cobran. */
          const movAMano = movimientosAMano(movs.slice(0, cuantos), dias, esHuasteca);
          /* La Huasteca cobra su estadia por dia SIEMPRE (criterio R3);
             el destino cualquiera sigue con el paquete de 3 noches.
             Aqui el precio sale de la formula, no de la lista: el piso SI
             aplica (R34). */
          const esperado = trasladoAMano(formulaAMano(km), dias, false) +
            estadiaAMano(dias, noches, cuantos, esHuasteca, formulaAMano(km)) + movAMano;

          // --- lo que hace la pagina ---
          const p = t.calcula(km, dias, { noches: noches, movimientos: movs, destino: destino });

          if (p.total !== esperado) rotos.total.push({ km, dias, noches, esHuasteca, dio: p.total, esperaba: esperado });
          if (p.anticipo !== anticipoAMano(esperado)) rotos.anticipo.push({ km, dias, dio: p.anticipo });
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
        /* Barrancas cobra el dia igual se mueva o no: su banda vale cero.
           Y R22: el viaje de un dia tampoco paga movimientos. */
        /* R24 · Los dias de movimiento que el precio del Excel ya trae
           dentro no se cobran otra vez: se saltan del principio. */
        const incluidos = (fila[2] && fila[2].movimientosIncluidos) || 0;
        const movAMano = (fila[2] && fila[2].movimientoCero)
          ? 0
          : movimientosAMano(movs.slice(incluidos, cuantos), dias, false);

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
          /* R5: el precio con movimientos del Excel cubre EL PAQUETE —sus
             noches y los movimientos de esos dias—. Pasado el paquete manda
             la regla de siempre: +1,000 la noche y +3,000 el dia movido
             (dictado el 26-ago-2026; antes esto era plano).

             Las noches del paquete salen del propio destino, SIN piso de
             tres: Tolantongo son 3 dias / 2 noches, y con piso su dia 4
             salia gratis. */
          const nochesPaq = reglaExcel.diasIncluidos ? reglaExcel.diasIncluidos - 1 : 3;
          let extra = Math.max(0, noches - nochesPaq) * 1000;
          /* R22 · un viaje de un dia no paga movimientos, ni siquiera los que
             se pasan del paquete. */
          if (dias > 1) {
            for (let i = nochesPaq + 1; i < cuantos; i++) extra += diaDeMovimientoAMano(movs[i].horas, false);
          }
          esperado = trasladoAMano(reglaExcel.conMovimientos, dias, true) + extra;
        } else if (reglaExcel && reglaExcel.porDias) {
          esperado = trasladoAMano(porDuracionAMano(reglaExcel, dias), dias, true) + movAMano;
        } else if (reglaExcel && reglaExcel.diasIncluidos && reglaExcel.diaExtra) {
          /* Paquete con tarifa de dia PROPIA (Cancun, $4,000): el precio se
             ajusta por duracion en los dos sentidos y ya no lleva estadia
             aparte. Dictado el 26-ago-2026. */
          const base = fila[1] + (dias - reglaExcel.diasIncluidos) * reglaExcel.diaExtra;
          esperado = trasladoAMano(base, dias, true) + movAMano;
        } else if (reglaExcel && reglaExcel.diasIncluidos) {
          /* Paquete sin tarifa de dia propia: noches gratis hasta un dia antes
             del regreso, y moverse YA NO las borra (correccion del 26-ago).
             Sin piso de tres: manda lo que diga el destino. */
          const gratis = reglaExcel.diasIncluidos - 1;
          esperado = trasladoAMano(fila[1], dias, true) + Math.max(0, noches - gratis) * 1000 + movAMano;
        } else {
          /* R34 · Precio de lista: sin piso. (Aqui decia que el precio
             decidia si caia abajo de los $15,000 de R18; R18 la revoco R25
             el 30-ago-2026 y ese corte ya no existe.) */
          esperado = trasladoAMano(fila[1], dias, true) +
            estadiaAMano(dias, noches, cuantos, false, fila[1]) + movAMano;
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
