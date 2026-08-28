/* ============================================================
   El recargo por salir de otro lado
   ------------------------------------------------------------
   Fila 11 del Excel («SPRINTER OCOTLAN»), dictada por el dueño el
   28-ago-2026. Se comprueban tres cosas:

     1. Que cada nombre de la tabla de orígenes EXISTA en el
        catálogo de destinos. Un acento de más ahí no truena
        nada: nomás deja de cobrar, en silencio y para siempre.
     2. Que los 49 renglones de su fila den el precio que él
        escribió, sumados al precio de Guadalajara.
     3. Que la regla de «queda de camino» funcione sin caso
        especial para un origen que NO está en su Excel.
   ============================================================ */
const tarifa = require('../api/_tarifa');
const destinos = require('../api/_destinos');
const origenes = require('../api/_origenes');

let buenas = 0, malas = 0;
function ok(que, real, esperado) {
  if (real === esperado) { buenas++; return; }
  malas++;
  console.log('  MAL  ' + que + '\n       esperaba ' + esperado + ' y dio ' + real);
}
function titulo(t) { console.log('\n' + t); }

/* ------------------------------------------------------------
   1. NINGUN NOMBRE INVENTADO

   Este es el candado que de verdad importa. Si alguien escribe
   'Rincon de Guayabitos' sin acento, `recargoDictado` devuelve
   null, el respaldo por kilómetros contesta otra cosa, y nadie
   se entera hasta que un cliente paga de menos.
   ------------------------------------------------------------ */
titulo('Cada destino de la tabla de orígenes existe en el catálogo');
const enCatalogo = {};
destinos.DESTINOS.forEach(function (d) { enCatalogo[d.nombre] = true; });
origenes.ORIGENES.forEach(function (o) {
  Object.keys(o.recargo).forEach(function (nombre) {
    ok(o.nombre + ' -> «' + nombre + '» está en el catálogo', !!enCatalogo[nombre], true);
  });
});

/* ------------------------------------------------------------
   2. LA FILA 11, RENGLON POR RENGLON

   `esperado` es el precio que trae SU Excel saliendo de Ocotlán.
   Los días son los de la columna: no se inventan.
   ------------------------------------------------------------ */
titulo('Los precios de Ocotlán, tal como los escribió');
const OCOTLAN = { lat: 20.3529, lng: -102.7745, direccion: 'Ocotlán, Jal., México' };

/* destino, días, movimientos, lo que dice el Excel desde Ocotlán */
const FILA_11 = [
  ['Puerto Vallarta y alrededores', 4, 0, 25000],
  ['Mismaloya',                     4, 0, 26000],
  ['Sayulita / San Pancho',         4, 0, 24000],
  ['Mazamitla',                     2, 0, 18000],
  ['Tapalpa',                       2, 0, 18000],
  ['Chapala',                       1, 0, 11000],
  /* El Excel dice $13,500, y esta aserción CAMBIO DE LADO a propósito.
     Aquel número se apoya en los $8,500 de Tequila desde Guadalajara, que el
     dueño bajó a $7,000 el 26-ago-2026. Lo que se hereda de su fila 11 es el
     RECARGO —$13,500 − $8,500 = $5,000—, no el precio viejo: el desvío a
     Ocotlán no cambió porque él le bajara a Tequila.
     $7,000 + $5,000 = $12,000. Está anotado en el criterio para confirmárselo. */
  ['Tequila / Guachimontones',      1, 0, 12000],
  ['Chacala',                       4, 0, 22000],
  ['Punta Perula',                  4, 0, 25000],
  ['Rincón de Guayabitos',          4, 0, 23000],
  ['Mazatlán',                      4, 0, 34000],
  ['Real de Catorce',               4, 0, 38500],
  ['Barrancas del Cobre',           7, 0, 80000],
  ['Tenacatita',                    4, 0, 24000],
  ['Manzanillo',                    4, 0, 23500],
  ['Melaque / Barra de Navidad',    4, 0, 26500],
  ['San Juan de los Lagos',         1, 0, 16000],
  ['San Miguel de Allende',         2, 0, 28500],
  ['Zacatecas',                     2, 0, 29000],
  ['Mayto',                         4, 0, 30000],
  ['Talpa Burrita (peregrinación)', 4, 0, 30000],
  ['El Manto',                      1, 0, 17000],
  ['El Manto',                      3, 0, 22000],
  ['Talpa de Allende',              1, 0, 19500],
  ['Talpa de Allende',              2, 0, 20500],
  ['Guanajuato',                    1, 0, 22000],
  ['Guanajuato',                    3, 0, 28000],

  /* Los que NO suben: Ocotlán queda de camino */
  ['Camécuaro / Zamora',            1, 0, 14500],
  ['Tlalpujahua',                   1, 0, 23500],
  ['Tlalpujahua',                   2, 0, 26500],
  ['Grutas Tolantongo',             3, 0, 29500],
  ['Ixtapa Zihuatanejo',            4, 0, 29500],
  ['Chiapas',                       8, 0, 85000],
  ['Oaxaca',                        4, 0, 75000],
  ['Cancún',                       17, 0, 145000],
  ['Acapulco',                      4, 0, 60000],
  ['Valle de Bravo / Nevado de Toluca', 4, 0, 32000],
  ['Pátzcuaro / Uruapan',           4, 0, 25000],
  ['Santuario de la Mariposa Monarca', 1, 0, 23000],
  ['Mariposa / Azufres / Pátzcuaro', 4, 0, 29000],

  /* El único que BAJA */
  ['Morelia',                       1, 0, 18500],

  /* Los tres que traen movimientos metidos en su precio del Excel */
  ['Ciudad de México',              1, 1, 26000],
  ['Ciudad de México',              2, 2, 30000],
  ['Ciudad de México',              3, 3, 34000],
  ['Huasteca Potosina',             3, 3, 42500],
  ['Huasteca Potosina',             4, 4, 44500],
  ['Puebla',                        2, 0, 36500],
  ['Puebla con Zacatlán',           2, 0, 39500]
];

function cotiza(nombre, dias, cuantosMovimientos, origen) {
  const d = destinos.buscaDestino({ nombre: nombre });
  const movs = [];
  for (let i = 0; i < cuantosMovimientos; i++) movs.push({ salida: '09:00', regreso: '17:00' });
  /* Los kilómetros del catálogo son los de Guadalajara. Para el origen que
     SI está dictado da igual lo que midan —manda su número—, y así la
     prueba no depende de una medición contra Google. */
  const r = tarifa.calcula(d.km, dias, {
    destino: { nombre: nombre }, origen: origen, unidad: 'sprinter',
    noches: Math.max(0, dias - 1), movimientos: movs
  });
  return r.total;
}

FILA_11.forEach(function (f) {
  const nombre = f[0], dias = f[1], movs = f[2], esperado = f[3];
  ok(nombre + ' ' + dias + ' día(s) desde Ocotlán', cotiza(nombre, dias, movs, OCOTLAN), esperado);
});

/* ------------------------------------------------------------
   3. SALIR DE GUADALAJARA NO CAMBIO NADA

   El recargo es un extra: si no hay origen conocido y el viaje
   mide lo de siempre, el precio tiene que ser EXACTAMENTE el de
   antes. Esta es la prueba de que no se rompió lo que ya estaba.
   ------------------------------------------------------------ */
titulo('Desde Guadalajara todo sigue igual que antes');
const GDL = { lat: 20.675171, lng: -103.347338, direccion: 'Guadalajara, Jal., México' };
[['Puerto Vallarta y alrededores', 4, 0, 19000],
 ['Chapala', 1, 0, 6500],
 ['Mazatlán', 4, 0, 28000],
 ['Ciudad de México', 3, 3, 34000],
 ['Cancún', 17, 0, 145000]].forEach(function (f) {
  ok(f[0] + ' desde Guadalajara', cotiza(f[0], f[1], f[2], GDL), f[3]);
});
[['Puerto Vallarta y alrededores', 4, 0, 19000],
 ['Chapala', 1, 0, 6500]].forEach(function (f) {
  ok(f[0] + ' sin origen ninguno', cotiza(f[0], f[1], f[2], null), f[3]);
});

/* ------------------------------------------------------------
   4. LA REGLA DEL DUEÑO, SIN CASO ESPECIAL

   «Si un viaje sale de Tequila, tú pensarías que cuesta más,
   pero no, porque Tequila está de camino a Vallarta.»

   Tequila NO está en su Excel como origen. Lo resuelve el
   respaldo: el viaje mide MENOS que desde Guadalajara, la resta
   sale negativa, y no se cobra nada.
   ------------------------------------------------------------ */
titulo('Tequila a Vallarta: de camino, mismo precio');
const TEQUILA = { lat: 20.881945, lng: -103.8325, direccion: 'Tequila, Jal., México' };
const VLL = destinos.buscaDestino({ nombre: 'Puerto Vallarta y alrededores' });

function conKm(nombre, km, dias, origen) {
  const r = tarifa.calcula(km, dias, {
    destino: { nombre: nombre }, origen: origen, unidad: 'sprinter',
    noches: Math.max(0, dias - 1), movimientos: []
  });
  return r.total;
}

/* Tequila está a unos 60 km rumbo a Vallarta, así que el redondo mide
   ~120 km MENOS que los 620 del catálogo. Da igual lo que mida: Tequila no
   es un origen dictado, así que no se le suma nada. */
ok('Tequila -> Vallarta (mide 120 km menos)', conKm('Puerto Vallarta y alrededores', VLL.km - 120, 4, TEQUILA), 19000);
ok('Tequila -> Vallarta aunque midiera 300 km de más', conKm('Puerto Vallarta y alrededores', VLL.km + 300, 4, TEQUILA), 19000);

/* ------------------------------------------------------------
   UN ORIGEN QUE NO ESTA DICTADO NO PAGA, MIDA LO QUE MIDA

   ESTAS ASERCIONES CAMBIARON DE LADO EL 28-ago-2026, el mismo día
   que nacieron. La primera versión traía un respaldo: para un
   origen desconocido comparaba el viaje medido contra el mismo
   viaje desde Guadalajara y cobraba los kilómetros de más. A
   Monterrey–Vallarta le sumaba $15,800.

   El dueño lo acotó: «de momento solo vamos a usar el radio de
   Ocotlán». Y tenía razón de fondo: esos $15,800 salían de una
   cuenta mía, no de su Excel, que es justo lo que prohíbe R12.
   ------------------------------------------------------------ */
titulo('Un origen que no dictó no paga, aunque el viaje mida de más');
const ZAC = destinos.buscaDestino({ nombre: 'Zacatecas' });
const COLIMA = { lat: 19.2452, lng: -103.7241, direccion: 'Colima, Col., México' };
ok('Colima -> Zacatecas, mismo km que GDL', conKm('Zacatecas', ZAC.km, 2, COLIMA), 25000);
ok('Colima -> Zacatecas, 460 km de más: sigue sin cobrar',
  conKm('Zacatecas', ZAC.km + 460, 2, COLIMA), 25000);
const MONTERREY = { lat: 25.6866, lng: -100.3161, direccion: 'Monterrey, N.L., México' };
ok('Monterrey -> Vallarta, 780 km de más: sigue sin cobrar',
  conKm('Puerto Vallarta y alrededores', VLL.km + 780, 3, MONTERREY), 19000);

/* Y el otro lado del mismo candado: DENTRO del radio de Ocotlán, un destino
   que su fila no menciona tampoco paga. Son 8 del catálogo —Tepic, León,
   Tala, Zacoalco, Cocula, Magdalena, San Juan Cosalá y Zirahuén—, que no
   vienen en su Excel. Está señalado en el criterio. */
titulo('Desde Ocotlán, un destino que su fila no menciona no paga');
[['Tepic', 2, 16900], ['León', 1, 17600]].forEach(function (f) {
  ok(f[0] + ' desde Ocotlán: sin número dictado, precio de Guadalajara',
    cotiza(f[0], f[1], 0, OCOTLAN), f[2]);
});

/* ------------------------------------------------------------
   5. QUE EL RECARGO NO SE META EN LOS MOVIMIENTOS

   El dueño lo pidió explícito: «lo añades como extra, para que se
   puedan calcular movimientos normalmente». O sea que dos viajes
   iguales, uno desde Ocotlán, tienen que diferir EXACTAMENTE en
   el recargo, movimientos incluidos.
   ------------------------------------------------------------ */
titulo('Los movimientos se calculan igual, salga de donde salga');
[['Puerto Vallarta y alrededores', 4, 6000], ['Chapala', 3, 4500], ['Zacatecas', 5, 4000]]
  .forEach(function (f) {
    const nombre = f[0], dias = f[1], recargo = f[2];
    for (let movs = 0; movs <= 3; movs++) {
      const desdeGdl = cotiza(nombre, dias, movs, GDL);
      const desdeOco = cotiza(nombre, dias, movs, OCOTLAN);
      ok(nombre + ' ' + dias + 'd con ' + movs + ' movimiento(s): la diferencia es el puro recargo',
        desdeOco - desdeGdl, recargo);
    }
  });

/* ------------------------------------------------------------
   5-bis. EL RECARGO VA DESPUES DEL PISO POR DIA

   Esta es la que se rompe callada. Chapala son $6,500 y el piso
   son $3,000 por día: pedida a diez días, el piso ($30,000) le
   gana al precio de lista. Si el recargo se sumara ANTES del
   piso, $6,500 + $4,500 = $11,000 seguiría por debajo de los
   $30,000 y el recargo desaparecería sin dejar rastro.

   Sumado al final, como pidió el dueño, el viaje son $34,500.
   ------------------------------------------------------------ */
titulo('El recargo sobrevive al piso por día');
const chapalaLargaGdl = cotiza('Chapala', 10, 0, GDL);
const chapalaLargaOco = cotiza('Chapala', 10, 0, OCOTLAN);
/* $30,000 de piso (10 días × $3,000) + $7,000 de noches. Las noches salen de
   R18, que a Chapala le destapa 2 a $500 y le cobra las otras 6 a $1,000. */
ok('Chapala 10 días desde Guadalajara: manda el piso', chapalaLargaGdl, 37000);
ok('Chapala 10 días desde Ocotlán: el piso NO se come el recargo',
  chapalaLargaOco - chapalaLargaGdl, 4500);

/* ------------------------------------------------------------
   6. LOS DESTINOS DE FORMULA NO LLEVAN RECARGO

   Un destino que no está en la lista ya cobró por los kilómetros
   que midió Google. Sumarle recargo sería cobrarlo dos veces.
   ------------------------------------------------------------ */
titulo('Un destino de fórmula no lleva recargo: el km ya lo cobró');
/* OJO al elegir el ejemplo: Ajijic NO sirve, aunque no venga en el Excel.
   El buscador de Chapala es /chapala|ajijic/i, o sea que Ajijic ES un destino
   de lista y sí le toca recargo. La primera versión de esta prueba usaba
   Ajijic y se puso roja con razón. Villa Corona sí cae en la fórmula: el
   dueño lo confirmó el 26-ago-2026 («$8,800 está bien»). */
const VILLA = { nombre: 'Villa Corona, Jal.' };
const porFormula = tarifa.calcula(120, 2, { destino: VILLA, origen: OCOTLAN, unidad: 'sprinter', noches: 1, movimientos: [] });
const porFormulaGdl = tarifa.calcula(120, 2, { destino: VILLA, origen: GDL, unidad: 'sprinter', noches: 1, movimientos: [] });
ok('Villa Corona desde Ocotlán y desde Guadalajara, a los mismos km, cuestan igual',
  porFormula.total, porFormulaGdl.total);
ok('y su recargo es cero', porFormula.interno.recargoSalida, 0);

/* ------------------------------------------------------------
   6-bis. EL TEXTO Y EL RADIO TIENEN QUE DECIR LO MISMO

   Esto nació de un defecto medido el 28-ago-2026: la lista de
   pueblos aceptaba Atotonilco el Alto, que está a 35 km, y
   rechazaba Zapotlán del Rey y Tototlán, que están a 18 y 21. O
   sea que el MISMO cliente pagaba distinto según si Google le
   devolvió coordenadas o no.

   Cada pueblo lleva ahora su punto, y aquí se mide contra el
   radio. Un pueblo agregado a ojo se pone rojo.
   ------------------------------------------------------------ */
titulo('Cada pueblo listado cae de verdad dentro del radio');
origenes.ORIGENES.forEach(function (o) {
  o.pueblos.forEach(function (p) {
    const km = origenes.lejosEnKm(p.lat, p.lng, o.lat, o.lng);
    ok(p.n + ' está a ' + km.toFixed(1) + ' km, dentro de los ' + o.radioKm, km <= o.radioKm, true);
    /* Y las dos puertas —punto y texto— tienen que dar el mismo veredicto */
    const porPunto = (origenes.buscaOrigen({ lat: p.lat, lng: p.lng }) || {}).nombre || null;
    const porTexto = (origenes.buscaOrigen({ direccion: p.n + ', Jal., México' }) || {}).nombre || null;
    ok(p.n + ': coordenadas y texto coinciden', porPunto, porTexto);
  });
});
/* Y el que se cayó de la lista: por texto tampoco debe entrar */
ok('Atotonilco el Alto (35 km) ya no entra por texto',
  origenes.buscaOrigen({ direccion: 'Atotonilco el Alto, Jal., México' }), null);
ok('ni por coordenadas',
  origenes.buscaOrigen({ lat: 20.5497, lng: -102.5097 }), null);

/* ------------------------------------------------------------
   7. EL OTRO OCOTLAN
   ------------------------------------------------------------ */
titulo('Ocotlán de Morelos, Oaxaca, no es este Ocotlán');
ok('por texto, Oaxaca no cuenta',
  origenes.buscaOrigen({ direccion: 'Ocotlán de Morelos, Oax., México' }), null);
ok('por coordenadas, Oaxaca no cuenta',
  origenes.buscaOrigen({ lat: 16.7972, lng: -96.6742, direccion: 'Ocotlán, Oax.' }), null);
ok('las coordenadas mandan sobre el texto',
  origenes.buscaOrigen({ lat: 20.675171, lng: -103.347338, direccion: 'Ocotlán, Jal.' }), null);
ok('La Barca sí cuenta',
  (origenes.buscaOrigen({ direccion: 'La Barca, Jalisco, México' }) || {}).nombre, 'Ocotlán');

/* ------------------------------------------------------------ */
console.log('\n' + buenas + ' buenas, ' + malas + ' malas');
process.exit(malas ? 1 : 0);
