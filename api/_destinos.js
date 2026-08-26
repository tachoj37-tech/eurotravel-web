/* ============================================================
   La lista de precios de Eurotravel, tal cual
   ------------------------------------------------------------
   Sacada de LISTA DE PRECIOS 2027.xlsx. Cada renglon es un
   destino con su precio CERRADO por tipo de unidad.

   POR QUE UNA TABLA Y NO UNA FORMULA

   Se probaron varias formulas contra estos 40 precios reales y
   ninguna los reproduce, por una razon de fondo: a la MISMA
   distancia los precios varian hasta $6,500 —CDMX y Tolantongo
   estan los dos a 1,102 km y cuestan $23,000 y $29,500—. Esa
   diferencia es conocimiento del destino: carretera, casetas,
   volumen, dificultad. No esta en el kilometraje y ninguna curva
   la puede adivinar.

   Se midio: interpolar entre destinos vecinos da $15,146 de
   error; la mejor formula da $2,069; la lista da CERO. Por eso
   la lista manda, y la formula de _tarifa.js solo contesta por
   los destinos que NO estan aqui.

   EL PRECIO ES LA BASE DEL TRASLADO

   No incluye movimientos ni noches: eso lo suma _tarifa.js con
   sus reglas.

   CDMX y HUASTECA venian en el Excel CON MOVIMIENTOS INCLUIDOS,
   asi que su base es mas barata que el precio de la lista. Se
   despejo sabiendo que cada dia de estadia cuesta $1,000 y que
   el dia con movimientos cuesta $3,000 mas —o sea $4,000—:

       CDMX 1 dia  = base + 1x4,000 = 26,000
       CDMX 2 dias = base + 2x4,000 = 30,000
       CDMX 3 dias = base + 3x4,000 = 34,000

   Los tres dan base = 22,000, y Huasteca da 26,500 por los dos
   lados. Que cinco ecuaciones independientes den el mismo numero
   es la prueba de que el modelo es el correcto.

   Y al reves: si el cliente pide esos mismos dias, el precio se
   reconstruye EXACTO al del Excel. Hay prueba de eso.

   LOS KILOMETROS SON MEDIDOS, NO SUPUESTOS

   Cada uno se midio con la Routes API de Google, ida y vuelta
   sumadas. Sirven para ordenar la tabla y para la formula de
   respaldo; el precio de un destino de esta lista NO se calcula
   con ellos.

   COMO SE AGREGA UNO

   Cuando la formula le pegue mal a un destino, se agrega aqui con
   su precio real y queda bien para siempre. Asi entraron Leon y
   Tepic, que el dueño corrigio a mano.
   ============================================================ */

const DESTINOS = [
  { nombre: "Chapala", km: 100,
    busca: /chapala|ajijic/i,
    precio: { busNC47: 10500, bus4849: 12000, neobusI6: 13000, pbI6: 12000, marcopolo: 15000, irizar: 14000, sprinter: 6500 } },
  { nombre: "Tequila / Guachimontones", km: 136,
    busca: /tequila|guachimont|amatit/i,
    /* Sprinter bajado de 8,500 a 7,000 el 26-ago-2026 por decisión del dueño.
       Solo la Sprinter: los autobuses siguen igual. */
    precio: { busNC47: 12000, bus4849: 13000, neobusI6: 15000, pbI6: 14000, marcopolo: 17000, irizar: 16000, sprinter: 7000 } },
  { nombre: "Tapalpa", km: 262,
    busca: /tapalpa/i,
    precio: { busNC47: 24000, bus4849: 25000, neobusI6: 27000, pbI6: 26000, marcopolo: 29000, irizar: 28000, sprinter: 14500 } },
  { nombre: "Mazamitla", km: 268,
    busca: /mazamitla/i,
    precio: { busNC47: 24000, bus4849: 25000, neobusI6: 27000, pbI6: 26000, marcopolo: 29000, irizar: 28000, sprinter: 14500 } },
  { nombre: "San Juan de los Lagos", km: 286,
    busca: /san juan de los lagos|santo toribio|sto toribio/i,
    precio: { busNC47: 24000, sprinter: 14000 } },
  { nombre: "Camécuaro / Zamora", km: 314,
    busca: /camecuaro|cam[eé]cuaro|zamora/i,
    precio: { busNC47: 26000, sprinter: 14500 } },
  { nombre: "El Manto", km: 314,
    busca: /el manto/i,
    /* El Excel trae dos duraciones: 1 día $14,000 y 3 días $19,000. El día
       extra de $2,500 se deduce de esos dos escalones: (19,000−14,000)/2. */
    precio: { busNC47: 22000, sprinter: 14000 },
    porDias: { 1: 14000, 3: 19000 },
    diaExtra: 2500 },
  /* VA ANTES que Talpa a propósito: «talpa burrita» empata con las dos
     expresiones, y aquí gana el primer renglón que empate.

     La Burrita NO es «Talpa más días»: es la peregrinación. La gente se va
     CAMINANDO a Talpa y el camión los va esperando en puntos del camino.
     Por eso vale $26,500 cuando Talpa 2 días vale $16,500. Lo explicó el
     dueño el 26-ago-2026 (criterio R4). */
  { nombre: "Talpa Burrita (peregrinación)", km: 402,
    busca: /burrit/i,
    precio: { busNC47: 38000, sprinter: 26500 },
    diasIncluidos: 4 },
  { nombre: "Talpa de Allende", km: 402,
    busca: /talpa/i,
    /* Los precios por duración vienen del Excel tal cual; el día extra de
       $1,500 lo dice su fila 10: «$3000 bus y $1500 spr día extra». */
    precio: { busNC47: 26000, bus4849: 27000, sprinter: 15000 },
    porDias: { 1: 15000, 2: 16500 },
    diaExtra: 1500 },
  { nombre: "Tepic", km: 414,
    busca: /tepic/i,
    precio: { sprinter: 16900 } },
  { nombre: "León", km: 444,
    busca: /le[oó]n, guanajuato|^le[oó]n/i,
    precio: { sprinter: 17600 } },
  { nombre: "Rincón de Guayabitos", km: 474,
    busca: /guayabitos/i,
    precio: { busNC47: 29000, bus4849: 30000, neobusI6: 32000, pbI6: 32000, marcopolo: 36000, irizar: 34000, sprinter: 18500 } },
  { nombre: "Chacala", km: 502,
    busca: /chacala/i,
    precio: { busNC47: 28000, bus4849: 29000, neobusI6: 31000, pbI6: 30000, marcopolo: 35000, irizar: 33000, sprinter: 16500 } },
  { nombre: "Sayulita / San Pancho", km: 532,
    busca: /sayulita|san pancho/i,
    precio: { busNC47: 30000, bus4849: 29000, neobusI6: 32000, pbI6: 32000, marcopolo: 36000, irizar: 34000, sprinter: 18000 } },
  /* «guanajuato» a secas se llevaba a Dolores Hidalgo, que esta 90 km mas
     alla, al precio de la capital. Se pide la CIUDAD: o abre la direccion, o
     viene repetida como ciudad y estado. */
  { nombre: "Guanajuato", km: 550,
    busca: /^guanajuato\b|guanajuato, *(gto|guanajuato)\b/i,
    /* Del Excel: «MISMO DIA $19,000» y «3 DIAS SIN MOV $24,500». Este fue
       el destino que destapó el modelo inventado de noches (criterio,
       error nº 1): cobraba $19,000 a 3 días.

       El día extra primero se dedujo de los escalones ((24,500−19,000)/2 =
       $2,750), pero el dueño lo corrigió el 26-ago-2026: «Guanajuato sí
       queda muy caro. Ponlo en mil quinientos el día extra.» El paso entre
       los escalones del Excel NO es la tarifa del día extra. */
    precio: { busNC47: 30000, bus4849: 31000, sprinter: 19000 },
    porDias: { 1: 19000, 3: 24500 },
    diaExtra: 1500 },
  { nombre: "Manzanillo", km: 574,
    busca: /manzanillo/i,
    precio: { busNC47: 30000, bus4849: 31000, neobusI6: 33000, pbI6: 32000, marcopolo: 37000, irizar: 35000, sprinter: 18500 } },
  { nombre: "Morelia", km: 574,
    busca: /morelia/i,
    precio: { busNC47: 30000, sprinter: 19000 } },
  { nombre: "Puerto Vallarta y alrededores", km: 620,
    busca: /vallarta|bucer|punta mita|san blas|nuevo vallarta/i,
    precio: { busNC47: 32000, bus4849: 33000, neobusI6: 34000, pbI6: 34000, marcopolo: 38000, irizar: 36000, sprinter: 19000 } },
  { nombre: "Punta Perula", km: 620,
    busca: /perula/i,
    precio: { busNC47: 34000, bus4849: 35000, neobusI6: 37000, pbI6: 36000, marcopolo: 41000, irizar: 39000, sprinter: 20500 } },
  { nombre: "Mismaloya", km: 656,
    busca: /mismaloya/i,
    precio: { busNC47: 33000, bus4849: 34000, neobusI6: 35000, pbI6: 35000, marcopolo: 39000, irizar: 37000, sprinter: 20000 } },
  /* VA ANTES que Pátzcuaro y que la Mariposa a propósito: el recorrido
     combinado los nombra a los dos, y aquí gana el primer renglón que
     empate. Lo pidió el dueño el 26-ago-2026 («créalo»): antes este texto
     caía en Mariposa ($23,000) o Pátzcuaro ($25,000) y cobraba de menos. */
  { nombre: "Mariposa / Azufres / Pátzcuaro", km: 820,
    busca: /azufre|(mariposa|monarca)[^,]*(p[aá]tzcuaro|uruapan)|(p[aá]tzcuaro|uruapan)[^,]*(mariposa|monarca)/i,
    precio: { busNC47: 45000, sprinter: 29000 } },
  { nombre: "Pátzcuaro / Uruapan", km: 656,
    busca: /p[aá]tzcuaro|uruapan/i,
    precio: { busNC47: 38000, bus4849: 39000, neobusI6: 43000, pbI6: 42000, marcopolo: 47000, irizar: 45000, sprinter: 25000 } },
  { nombre: "San Miguel de Allende", km: 674,
    busca: /san miguel de allende/i,
    precio: { busNC47: 40000, bus4849: 39000, neobusI6: 44000, pbI6: 42000, marcopolo: 48000, irizar: 46000, sprinter: 26500 } },
  { nombre: "Melaque / Barra de Navidad", km: 692,
    busca: /melaque|barra de navidad|cuastecomates/i,
    precio: { busNC47: 32000, bus4849: 33000, neobusI6: 35000, pbI6: 34000, marcopolo: 40000, irizar: 37000, sprinter: 20500 } },
  { nombre: "Zacatecas", km: 708,
    busca: /zacatecas/i,
    precio: { busNC47: 38000, bus4849: 39000, neobusI6: 42000, pbI6: 40000, marcopolo: 46000, irizar: 44000, sprinter: 25000 } },
  { nombre: "Tlalpujahua", km: 762,
    busca: /tlalpujahua/i,
    /* Del Excel: 1 día $23,500 y 2 días $26,500 → día extra $3,000. */
    precio: { busNC47: 36000, bus4849: 37000, neobusI6: 40000, pbI6: 38000, marcopolo: 44000, irizar: 42000, sprinter: 23500 },
    porDias: { 1: 23500, 2: 26500 },
    diaExtra: 3000 },
  { nombre: "Tenacatita", km: 762,
    busca: /tenacatita|boca de iguanas/i,
    precio: { busNC47: 32000, bus4849: 33000, neobusI6: 35000, pbI6: 34000, marcopolo: 39000, irizar: 37000, sprinter: 20000 } },
  { nombre: "Santuario de la Mariposa Monarca", km: 780,
    busca: /mariposa|angangueo|el rosario/i,
    precio: { busNC47: 36000, sprinter: 23000 } },
  { nombre: "Mayto", km: 798,
    busca: /mayto/i,
    precio: { busNC47: 42000, bus4849: 43000, neobusI6: 44000, pbI6: 45000, marcopolo: 49000, irizar: 47000, sprinter: 26500 } },
  { nombre: "Mazatlán", km: 962,
    busca: /mazatl/i,
    precio: { busNC47: 38000, bus4849: 40000, neobusI6: 44000, pbI6: 43000, marcopolo: 48000, irizar: 46000, sprinter: 28000 } },
  { nombre: "Valle de Bravo / Nevado de Toluca", km: 1032,
    busca: /valle de bravo|nevado de toluca|toluca/i,
    precio: { busNC47: 47000, bus4849: 48000, neobusI6: 51000, pbI6: 49000, marcopolo: 55000, irizar: 53000, sprinter: 32000 } },
  { nombre: "Ixtapa Zihuatanejo", km: 1056,
    busca: /ixtapa|zihuatanejo/i,
    precio: { busNC47: 43000, bus4849: 44000, neobusI6: 46000, pbI6: 45000, marcopolo: 50000, irizar: 48000, sprinter: 29500 } },
  { nombre: "Ciudad de México", km: 1102,
    busca: /ciudad de m|cdmx|distrito federal/i,
    precio: { busNC47: 40000, bus4849: 41000, neobusI6: 44000, pbI6: 42000, marcopolo: 48000, irizar: 46000, sprinter: 22000 } },
  { nombre: "Grutas Tolantongo", km: 1102,
    busca: /tolantongo/i,
    /* El Excel trae DOS columnas: «SIN MOV $29,500» y «con mov $34,500». Los
       movimientos van INCLUIDOS en la segunda: no se les suma banda ni
       estadía. Antes se cobraba 29,500 + días + bandas = $41,500, y el dueño
       corrigió el 26-ago-2026: «sí, estás mal, dalo de acuerdo al Excel». */
    precio: { busNC47: 45000, bus4849: 46000, neobusI6: 49000, pbI6: 47000, marcopolo: 53000, irizar: 51000, sprinter: 29500 },
    conMovimientos: 34500 },
  { nombre: "Real de Catorce", km: 1186,
    busca: /real de catorce|real de 14/i,
    precio: { busNC47: 48000, bus4849: 49000, neobusI6: 52000, pbI6: 50000, marcopolo: 56000, irizar: 54000, sprinter: 34500 } },
  { nombre: "Huasteca Potosina", km: 1262,
    busca: /huasteca|ciudad valles|xilitla|tamul/i,
    precio: { busNC47: 38000, bus4849: 40000, neobusI6: 42000, pbI6: 40000, marcopolo: 46500, irizar: 44000, sprinter: 26500 } },
  { nombre: "Puebla", km: 1338,
    busca: /puebla/i,
    /* «PUEBLA 2 DIAS $36,500». El día extra de $2,000 lo dictó el dueño el
       26-ago-2026 («el día tres súbele a dos mil») y cuadra con la fila 10
       del Excel: «$4,000 bus y $2,000 SPR». */
    precio: { busNC47: 58000, bus4849: 59000, neobusI6: 62000, pbI6: 60000, marcopolo: 65000, irizar: 63000, sprinter: 36500 },
    porDias: { 2: 36500 },
    diaExtra: 2000 },
  { nombre: "Puebla con Zacatlán", km: 1368,
    busca: /zacatl|chignahuapan|chignauapan/i,
    /* Mismo trato que Puebla: 2 días del Excel y $2,000 el extra (fila 10). */
    precio: { busNC47: 63000, bus4849: 65000, neobusI6: 68000, pbI6: 65000, marcopolo: 70000, irizar: 68000, sprinter: 39500 },
    porDias: { 2: 39500 },
    diaExtra: 2000 },
  { nombre: "Acapulco", km: 1796,
    busca: /acapulco/i,
    precio: { busNC47: 80000, bus4849: 85000, neobusI6: 90000, pbI6: 95000, marcopolo: 100000, irizar: 96500, sprinter: 60000 } },
  /* «oaxaca» a secas se llevaba a Puerto Escondido y a Huatulco —que estan en
     el estado, pero 500 km MAS ALLA de la capital— al precio de la capital.
     Ahora esos dos caen en «lo cotiza un asesor», que es lo correcto. */
  { nombre: "Oaxaca", km: 1988,
    busca: /^oaxaca\b|oaxaca de ju[aá]rez/i,
    precio: { busNC47: 100000, bus4849: 110000, neobusI6: 120000, pbI6: 115000, marcopolo: 130000, irizar: 125000, sprinter: 75000 } },
  { nombre: "Chiapas", km: 2848,
    busca: /chiapas|san crist|palenque|tuxtla/i,
    /* «CHIAPAS 8 DIAS»: el precio del Excel YA incluye los ocho días. Antes
       se le sumaban noches encima y cobraba $4,000 de más (criterio R2). */
    precio: { busNC47: 130000, bus4849: 135000, neobusI6: 145000, pbI6: 140000, marcopolo: 160000, irizar: 155000, sprinter: 85000 },
    diasIncluidos: 8 },
  /* El Excel trae el Marcopolo de Barrancas en 1,300,000: un cero de mas.
     En los 40 destinos el Marcopolo nunca pasa del Irizar por mas de 5,000, y
     aqui lo pasaria por 1,175,000. Se corrigio a 130,000 —el escalon que
     guarda contra el Irizar en Chiapas, el otro viaje de esa distancia— y se
     le aviso al dueño el 25-ago-2026. Si el numero bueno es otro, se cambia
     aqui. Hay una prueba que caza el proximo cero de mas. */
  /* Sin «chihuahua»: el estado entero caia aqui, y la ciudad de Chihuahua
     esta 450 km ANTES de las Barrancas. Cobrarle el precio de Barrancas es
     cobrarle de mas. Quien escriba «Chihuahua» va con un asesor. */
  { nombre: "Barrancas del Cobre", km: 2882,
    busca: /barranca|creel/i,
    precio: { busNC47: 105000, bus4849: 110000, neobusI6: 120000, pbI6: 115000, marcopolo: 130000, irizar: 125000, sprinter: 75000 } },
  { nombre: "Cancún", km: 4282,
    busca: /canc|riviera maya|playa del carmen|tulum/i,
    /* «CANCUN 17 DIAS»: el precio YA incluye los diecisiete días. Antes se
       le sumaban $13,000 de noches encima (criterio R2). */
    precio: { busNC47: 180000, bus4849: 185000, neobusI6: 195000, pbI6: 190000, marcopolo: 215000, irizar: 205000, sprinter: 145000 },
    diasIncluidos: 17 }
];

/* ------------------------------------------------------------
   TRES DESTINOS QUE VIVEN DENTRO DE OTRO
   ------------------------------------------------------------
   La tabla va ordenada por kilómetros, que se lee bien pero da
   la respuesta EQUIVOCADA en tres casos, porque una dirección
   empata con dos renglones y gana el que se probó primero:

     «Mismaloya, Puerto Vallarta»      -> caía en Vallarta, $19,000
                                          y son $20,000
     «San Miguel de Allende, Gto.»     -> caía en Guanajuato, $19,000
                                          y son $26,500
     «Zacatlán, Puebla»                -> caía en Puebla, $36,500
                                          y son $39,500

   Los tres son el caso «el nombre del grande viene incluido en la
   dirección del chico». Se prueban ANTES que los demás. Hay
   prueba de los tres.
   ------------------------------------------------------------ */
const PRIMERO = ['Mismaloya', 'San Miguel de Allende', 'Puebla con Zacatlán'];

/* ¿A cuál de la lista va este viaje? Se reconoce por el texto del destino que
   eligió el cliente. Devuelve el renglón o null.

   El navegador NUNCA hace esto: lo hace el servidor, para que la pantalla y
   el cobro no puedan discrepar. Misma lección que la Huasteca. */
function buscaDestino(destino) {
  if (!destino) return null;
  const texto = String(destino.direccion || destino.texto || destino.nombre || '');
  if (!texto) return null;

  const orden = DESTINOS.slice().sort(function (a, b) {
    return (PRIMERO.indexOf(b.nombre) >= 0) - (PRIMERO.indexOf(a.nombre) >= 0);
  });

  for (let i = 0; i < orden.length; i++) {
    if (orden[i].busca.test(texto)) return orden[i];
  }
  return null;
}

/* El precio cerrado de un destino para una unidad. Si la lista no trae esa
   unidad para ese destino, devuelve null y el viaje se va a la fórmula. */
function precioDeLista(destino, unidad) {
  const d = buscaDestino(destino);
  if (!d) return null;
  const p = d.precio[unidad || 'sprinter'];
  if (typeof p !== 'number') return null;
  return {
    precio: p, nombre: d.nombre, km: d.km,
    /* Los tres campos del criterio de precios (docs/CRITERIO-DE-PRECIOS.md):
       `porDias` son los precios del Excel por duración (solo Sprinter, que es
       lo único que se cotiza en línea), `diaExtra` la tarifa propia del
       destino más allá de su última duración, y `diasIncluidos` marca a los
       paquetes cuyo precio ya trae los días adentro. */
    porDias: d.porDias || null,
    diaExtra: typeof d.diaExtra === 'number' ? d.diaExtra : null,
    diasIncluidos: typeof d.diasIncluidos === 'number' ? d.diasIncluidos : null,
    /* R5: destinos cuyo Excel trae una columna aparte para el viaje CON
       movimientos (Tolantongo). Ese precio ya lo incluye todo. */
    conMovimientos: typeof d.conMovimientos === 'number' ? d.conMovimientos : null
  };
}

module.exports = { DESTINOS, buscaDestino, precioDeLista };
