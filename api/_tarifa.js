/* ============================================================
   Las reglas del dinero, en un solo lugar
   ------------------------------------------------------------
   Lo usan /api/cotizar y /api/pagar. Que vivan aquí y no en cada
   endpoint es a propósito: si el precio que se cotiza y el que se
   cobra pudieran salir de dos archivos distintos, tarde o
   temprano se separan y le cobras a alguien algo distinto de lo
   que le prometiste.

   El nombre empieza con guion bajo para que Vercel no lo publique
   como una dirección más del sitio.

   Reglas confirmadas por el dueño:
     · el kilómetro se cobra a UNA SOLA TARIFA elegida por el total
       del viaje (ver abajo), IVA YA INCLUIDO
     · mínimo $3,000 POR DÍA de servicio
     · el total se corta HACIA ABAJO a la centena
     · 3 noches incluidas; cada noche de más, $1,000
     · los movimientos en destino se cobran por día, según las horas
     · anticipo del 20% para apartar; el resto se abona

   EL ORDEN DE LA SUMA IMPORTA, y es el que dictó el dueño:

       1. los kilómetros a su tarifa
       2. ¿gana el mínimo por día? -> se corta a la centena
                                      = EL PRECIO DEL TRASLADO
       3. + las noches extra
       4. + los días con movimientos
                                      = TOTAL

   El corte a la centena cae SOLO sobre el traslado. Las noches y
   los movimientos ya son múltiplos de cien, así que el total sigue
   siendo redondo y no hace falta volver a cortar.
   ============================================================ */

/* ------------------------------------------------------------
   AQUÍ ESTABAN LAS BANDAS DE $34 / $25 / $23, Y SE FUERON
   ------------------------------------------------------------
   Durante un día el kilómetro se cobró a una sola tarifa elegida
   por el total, con un escalón de -$7,200 a los 801 km que el
   dueño aprobó a sabiendas.

   Se fue cuando llegó su LISTA DE PRECIOS 2027 con 40 precios
   reales. Contra ella, aquellas bandas se equivocaban $5,395 en
   promedio: cobraban $2,000 de más en Vallarta —su destino más
   vendido— y regalaban $4,000 en Mazatlán.

   Con precios de verdad enfrente, adivinar el precio con una
   curva dejó de tener sentido. Manda la lista.
   ------------------------------------------------------------ */

/* ------------------------------------------------------------
   LA FORMULA DE RESPALDO, Y CUANDO SE USA
   ------------------------------------------------------------
   Primero manda la LISTA DE PRECIOS (_destinos.js). Esta formula
   solo contesta por los destinos que no estan en ella.

   Salio de ajustarla contra los 40 precios reales de 2027:

       precio = $6,500 + $22 por kilometro redondo

   El $6,500 es lo que cuesta sacar la unidad —sale igual sea
   cerca o lejos— y el $22 es el kilometro puro. De ahi sale sola
   la devaluacion que se ve en los precios reales: el kilometro
   vale $87 a los 100 km y $28 a los 1,000, sin bandas ni
   escalones.

   Error promedio contra los precios reales: $2,069. Se probaron
   bandas planas ($2,004, pero con escalones de hasta -$5,074) y
   por tramos ($9,039). Esta gana por no tener escalon.

   ARRIBA DE 1,400 KM NO SE COTIZA SOLA. Ahi la curva deja de
   bajar y vuelve a subir —Cancun sale a $33.9 el kilometro,
   MAS caro que Vallarta— porque el viaje deja de ser ir y volver
   y se vuelve expedicion: hotel de operador, relevos, viaticos.
   La formula regalaria $48,000 en Cancun. Esos los cotiza una
   persona.
   ------------------------------------------------------------ */
const BASE_TRASLADO = 6500;
const POR_KM = 22;
const TOPE_FORMULA_KM = 1400;

/* ------------------------------------------------------------
   ARRIBA DE 1,400 KM: EL TRAMO LARGO
   ------------------------------------------------------------
   Antes aquí no se cotizaba: se contestaba «lo cotiza un asesor». El dueño
   lo quitó el 26-ago-2026: «que no haya asesor, anímate a cotizar tú».

   Se ajustó contra SUS propios precios de esa distancia, anclando el tramo
   en lo que vale la fórmula corta justo en los 1,400 km ($37,300) para que
   NO haya escalón — un destino a 1,401 km no puede costar de golpe miles
   más que uno a 1,399.

   Sale $36 por kilómetro, contra los $22 del tramo corto. El salto es real
   y está explicado: a esa distancia el viaje deja de ser ir y volver y se
   vuelve expedición —hotel de operador, relevos, viáticos—.

   ESTE TRAMO ES MUCHO MENOS FIABLE QUE EL CORTO, y hay que saberlo: error
   promedio de $9,800 contra los $1,534 del corto. No es que esté mal
   ajustado; es que los precios largos del dueño NO son función del
   kilómetro. Oaxaca son $75,000 a 1,988 km y Barrancas son $75,000 a
   2,882 km: novecientos kilómetros más por el mismo precio.

   Los cinco destinos que sirvieron de guía están todos EN la lista, así
   que la fórmula nunca los cotiza. Este tramo solo contesta por destinos
   lejanos que el dueño no ha puesto precio — y el día que ponga uno, entra
   al catálogo y deja de estimarse.
   ------------------------------------------------------------ */
const POR_KM_LARGO = 36;

/* La LISTA DE PRECIOS. Manda ella; lo de arriba solo contesta por los
   destinos que no estén en ella. */
const destinos = require('./_destinos');

/* De dónde SALE el viaje. La lista está medida desde Guadalajara; saliendo
   de otro lado el mismo viaje puede costar más. Ver `_origenes.js`. */
const origenes = require('./_origenes');

/* ------------------------------------------------------------
   QUE UNIDADES SE SABEN COTIZAR SOLAS
   ------------------------------------------------------------
   La LISTA DE PRECIOS trae siete columnas, una por tipo de
   unidad: para Puerto Vallarta van de $19,000 la Sprinter a
   $38,000 el Marcopolo.

   Pero lo que sale de aquí es SIEMPRE la columna sprinter,
   porque hoy es la única que el dueño quiso cotizar en línea
   («de momento solo sprinters»). Y la fórmula de respaldo ni
   siquiera mira la unidad: da el mismo número para una van que
   para un autobús de 51 pasajeros.

   Así que esto no es una lista de preferencias: es la lista de
   lo que este archivo SABE poner precio. Todo lo demás lo tiene
   que rechazar quien llama, no cobrarlo al precio de la van.

   La pantalla ya lo impedía —solo la Sprinter tiene cotizador
   automático— pero la pantalla no es la puerta: `/api/pagar`
   recibe la unidad como texto libre. Una petición armada a mano
   con «Irizar i6S» cobraba $19,000 por un autobús de $36,000, y
   el contrato que llega a EuroSystem decía «Irizar i6S».

   PARA AGREGAR UNA: hace falta su columna aquí Y comprobar que
   la fórmula de respaldo dé un número razonable para ella, que
   hoy no lo da. No basta con poner el renglón.
   ------------------------------------------------------------ */
const UNIDADES_QUE_COTIZAN = { sprinter: 'sprinter' };

/* Lo que manda el navegador es el NOMBRE de pantalla —«Sprinter»,
   «Irizar i6S · 51 pasajeros»—, no la clave. Se normaliza: sin acentos, sin
   mayúsculas, y sin lo que venga después del punto medio. */
function claveDeUnidad(loQueLlego) {
  const t = String(loQueLlego || '')
    .split('·')[0]
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(new RegExp('[\\u0300-\\u036f]', 'g'), '');
  return Object.prototype.hasOwnProperty.call(UNIDADES_QUE_COTIZAN, t)
    ? UNIDADES_QUE_COTIZAN[t]
    : null;
}

/* ¿Esta unidad se puede cotizar y cobrar en línea? Lo preguntan `cotizar` y
   `pagar`, y tienen que preguntarlo LOS DOS: si uno la aceptara y el otro
   no, el cliente vería un precio y no podría pagarlo, o peor, al revés. */
function seSabeCotizar(unidad) { return claveDeUnidad(unidad) !== null; }

/* ------------------------------------------------------------
   ¿HAY QUE MEDIR ESTE VIAJE, O YA SABEMOS CUÁNTO CUESTA?
   ------------------------------------------------------------
   Medir son DOS llamadas de pago a la Routes API de Google —ida y
   vuelta— por cada cotización. Y una reserva no es una
   cotización: el cliente cambia la fecha, cambia la unidad,
   captura movimientos, y cada cambio vuelve a cotizar.

   Cuando el destino tiene precio CERRADO en la lista, esos
   kilómetros no mueven un peso: `trasladoDe` ni los mira. Se
   pagaban dos llamadas por una respuesta que se tiraba, y 46 de
   los 79 destinos del catálogo tienen precio cerrado.

   La pregunta vive AQUI y no en `cotizar.js` a propósito: quien
   sabe si el kilometraje importa es el archivo del dinero. Si un
   día la lista cambia de forma, esto cambia con ella y los dos
   endpoints se enteran solos.

   OJO — `pagar.js` NO usa esto y mide siempre. El kilometraje va
   a la metadata del contrato y la oficina lo lee ahí. Se mide una
   vez, al comprometer el dinero, no en cada tecleo.
   ------------------------------------------------------------ */
function necesitaMedirse(destino, unidad) {
  return !destinos.precioDeLista(destino, claveDeUnidad(unidad) || 'sprinter');
}

/* ------------------------------------------------------------
   EL PRECIO DEL TRASLADO
   ------------------------------------------------------------
   Tres respuestas posibles, y en este orden:

     { deLista }        el destino esta en la lista de precios
     { porFormula }     no esta, pero cae dentro del tope
     { requiereAsesor } no esta y esta demasiado lejos

   Todo esto se queda del lado del servidor: al cliente NUNCA se
   le enseña el kilometraje ni lo que cuesta el kilometro.
   ------------------------------------------------------------ */
/* ------------------------------------------------------------
   EL PRECIO DE LISTA A LA DURACION PEDIDA
   ------------------------------------------------------------
   Regla R1 del criterio (docs/CRITERIO-DE-PRECIOS.md): la lista
   no es «traslado + noches», es precio por destino Y duración.
   El Excel trae varios precios para el mismo destino según los
   días, y aquí se elige:

     · duración exacta del Excel → ese precio, al peso
     · entre dos duraciones, o más allá de la última → el escalón
       anterior más el día extra PROPIO del destino
     · más corta que la primera → el de la primera (no existe un
       viaje más corto que el más corto del Excel)

   Antes de esta regla existía «3 noches gratis + $1,000 la
   extra», que era inventada: cobró $5,500 de menos en Guanajuato
   de 3 días y $13,000 de más en Cancún (criterio, error nº 1).
   ------------------------------------------------------------ */
function precioPorDuracion(enLista, dias) {
  const tabla = enLista.porDias;
  const dd = Math.max(1, Math.floor(Number(dias) || 1));

  /* ----------------------------------------------------------
     UN PAQUETE CON TARIFA DE DIA PROPIA SE MUEVE EN LOS DOS SENTIDOS

     Cancún son $145,000 por 17 días y su día vale $4,000. El dueño lo
     dictó el 26-ago-2026 con las dos mitades: hacia arriba, «el día está
     en 4000»; y hacia abajo, «si el cliente quiere 15 días solamente
     serían 8,000 menos del precio que está en la tabla».

     Así que el precio del Excel es un punto de referencia, no un piso:
     145,000 + (días − 17) × 4,000.
     ---------------------------------------------------------- */
  if (!tabla && typeof enLista.diasIncluidos === 'number' &&
      typeof enLista.diaExtra === 'number') {
    return enLista.precio + (dd - enLista.diasIncluidos) * enLista.diaExtra;
  }

  if (!tabla) return enLista.precio;

  const d = dd;
  if (typeof tabla[d] === 'number') return tabla[d];

  const duraciones = Object.keys(tabla).map(Number)
    .filter(function (x) { return isFinite(x) && typeof tabla[x] === 'number'; })
    .sort(function (a, b) { return a - b; });
  if (!duraciones.length) return enLista.precio;
  if (d < duraciones[0]) return tabla[duraciones[0]];

  let base = duraciones[0];
  for (let i = 0; i < duraciones.length; i++) if (duraciones[i] <= d) base = duraciones[i];
  const extra = typeof enLista.diaExtra === 'number' ? enLista.diaExtra : EXTRA_POR_NOCHE;
  return tabla[base] + (d - base) * extra;
}

function trasladoDe(kmTotal, destino, unidad, dias) {
  const km = Math.max(0, Number(kmTotal) || 0);

  /* La unidad se traduce a la columna de la lista. Si no se sabe cotizar,
     NO se adivina: cae en sprinter porque quien llama ya debió rechazarla
     antes de llegar aquí, y hay pruebas de que la rechaza. */
  const enLista = destinos.precioDeLista(destino, claveDeUnidad(unidad) || 'sprinter');
  if (enLista) {
    /* `porKm` va en null a propósito y no ausente: un precio de lista NO sale
       de una tarifa por kilómetro, y quien lea `interno.tarifaKm` tiene que
       ver eso y no un `undefined` que se pueda confundir con un cero. */
    return {
      total: precioPorDuracion(enLista, dias), deLista: enLista.nombre,
      porKm: null, km: km,
      /* Con esto decide `calcula` qué más puede sumar: un precio por duración
         ya trae su estadía, y un paquete ya trae sus días (criterio R1 y R2). */
      /* `porDuracion` también cuando el paquete trae su propia tarifa de día
         (Cancún): ese precio YA se ajustó por duración arriba, así que no se
         le pueden volver a sumar noches encima. */
      porDuracion: !!enLista.porDias ||
        (typeof enLista.diasIncluidos === 'number' && typeof enLista.diaExtra === 'number'),
      diasIncluidos: enLista.diasIncluidos || null,
      /* R24: los días que su columna del Excel ya trae con movimientos. */
      movimientosIncluidos: enLista.movimientosIncluidos || 0,
      precioConMovimientos: enLista.conMovimientos || null
    };
  }

  /* El tramo largo, sin escalón: arranca donde termina el corto. */
  if (km > TOPE_FORMULA_KM) {
    const ancla = BASE_TRASLADO + POR_KM * TOPE_FORMULA_KM;
    return {
      total: ancla + POR_KM_LARGO * (km - TOPE_FORMULA_KM),
      porFormula: true, tramoLargo: true, porKm: POR_KM_LARGO, km: km
    };
  }

  return { total: BASE_TRASLADO + POR_KM * km, porFormula: true, porKm: POR_KM, km: km };
}
const MINIMO_POR_DIA = 3000;          // piso por día de servicio, IVA incluido
const REDONDEO = 100;                 // el total se corta a la centena de abajo
const TASA_IVA = 0.16;
const ANTICIPO = 0.20;                // 20% para apartar la unidad

/* ------------------------------------------------------------
   LAS NOCHES QUE VAN INCLUIDAS
   ------------------------------------------------------------
   Todo viaje trae tres noches. De ahí en adelante, cada una son
   mil pesos: la unidad y el operador se quedan allá y ese día no
   pueden trabajar en otra cosa.

   Ojo con la palabra: son NOCHES, no días. Salir el 3 y regresar
   el 6 son tres noches y cuatro días de servicio. Los días de
   servicio mandan sobre el mínimo por día; las noches, sobre
   esto. Son dos cuentas distintas a propósito.
   ------------------------------------------------------------ */
const NOCHES_INCLUIDAS = 3;
const EXTRA_POR_NOCHE = 1000;

/* ------------------------------------------------------------
   R18 · ABAJO DE $15,000, EL DIA NO ES GRATIS
   ------------------------------------------------------------
   Dictado por el dueño el 28-ago-2026: «esos 500 exclusivamente a
   destinos abajo de 15,000 en precio normal».

   Venía de ver que en los viajes cercanos tres y cuatro días
   costaban EXACTAMENTE lo mismo que dos: las tres noches de
   `NOCHES_INCLUIDAS` se los comían enteros.

   EL CORTE ES POR PRECIO, NO POR DISTANCIA NI POR ESTAR EN LA
   TABLA. «Precio normal» es lo que cuesta el viaje de dos días —el
   de la tabla si está, el de la fórmula si no—. Así que esta regla
   alcanza también a los renglones baratos de la tabla, que es lo
   que el dueño dijo.

   Se cobra de la SEGUNDA noche en adelante: un viaje de dos días
   trae una noche y ésa sigue incluida. Cobrarla subiría el precio
   de dos días, y eso él no lo pidió.
   ------------------------------------------------------------ */
const TOPE_DIA_BARATO = 15000;
const DIA_BARATO = 500;

/* SOLO IDA. Dictado por el dueño el 26-ago-2026: un viaje de un solo sentido
   cuesta el 65% de un viaje de UN DÍA sin movimientos de ese mismo destino.
   No lleva noches ni movimientos —es dejar y ya—. Antes esto no se cobraba
   distinto: `redondo` se calculaba en cotizar pero nunca llegaba aquí, así
   que un solo-ida a un destino de lista cobraba lo mismo que el redondo. */
const FRACCION_UN_SENTIDO = 0.65;

/* ------------------------------------------------------------
   LOS MOVIMIENTOS EN DESTINO
   ------------------------------------------------------------
   Un servicio foráneo normal deja la unidad estacionada. Si el
   grupo la va a usar allá, ese día se cobra aparte, y el precio
   sale de CUÁNTAS HORAS la ocupan:

       hasta 8 horas ............ $3,000
       más de 8 y hasta 9 ....... $3,500
       más de 9 y hasta 10 ...... $4,000
       más de 10 y hasta 12 ..... $4,500
       más de 12 ................ $5,000

   Las horas partidas caen en la banda de arriba: un día de nueve
   y media paga $4,000. Se decidió así y no al revés porque el
   operador ya rebasó su jornada de nueve horas.

   Los $3,000 son piso: un día de dos horas cuesta lo mismo que
   uno de ocho. El camión ya está comprometido ese día.

   Lo que incluye el día —ocho horas dentro de la zona
   metropolitana del destino, o 40 km a la redonda del centro— es
   TEXTO del contrato, no una cuenta: aquí no se valida ninguna
   coordenada. Si el grupo se sale de la zona, lo acuerda con la
   oficina.
   ------------------------------------------------------------ */
const BANDAS_MOVIMIENTO = [
  { hasta: 8, precio: 3000 },
  { hasta: 9, precio: 3500 },
  { hasta: 10, precio: 4000 },
  { hasta: 12, precio: 4500 },
  { hasta: Infinity, precio: 5000 }
];

/* Tope duro de días con movimiento. No es una regla de negocio: es para que
   una lista inventada de diez mil renglones no se pasee por aquí. El tope de
   verdad son las noches de estadía, y lo pone movimientosDe(). */
const TOPE_DIAS_MOVIMIENTO = 60;

/* ------------------------------------------------------------
   DESTINOS CON REGLA PROPIA
   ------------------------------------------------------------
   Hay destinos donde las bandas de horas no aplican y el día de
   movimientos vale lo mismo sin importar cuántas horas sea.

   La Huasteca Potosina es el primero: allá los recorridos son
   entre cascadas y pueblos, y medir las horas no refleja lo que
   cuesta. Son $3,000 el día, punto.

   Es una TABLA y no un `if` a propósito: el día que otro destino
   necesite lo mismo, es un renglón más y no un parche.

   Se reconoce por el `placeId` del catálogo —que es exacto— y de
   rebote por el texto de la dirección, para cuando el cliente
   marca un hotel de allá en vez de elegir la región.
   ------------------------------------------------------------ */
/* R30 · Los tres paseos con nombre de CDMX. Van aquí arriba porque
   `DESTINOS_CON_REGLA` los usa en su propio renglón. Lo explicado está
   en `movimientosDe`. */
const PASEOS_CDMX = { taxco: 15000, chalma: 8000, xochimilco: 2000 };

/* ------------------------------------------------------------
   R29 · UN RECORRIDO QUE SE ALEJA MUCHO YA NO ES UN RECORRIDO
   ------------------------------------------------------------
   Dictado el 1-sep-2026: «no pueden exceder los 80 km de radio», y
   enseguida: «si cobra un recorrido de 120 km, o sea que supere
   los 80 km en lejanía, cóbralo en 5500».

   Un movimiento normal es salir a pasear desde donde están. Pasando
   los 80 km ya es medio traslado: más gasolina, más casetas, más
   horas del operador. Por eso tiene su propio precio y no una banda
   de horas.

   Se cobra por LEJANIA, no por horas: da igual si son seis horas o
   diez, si se fueron a 120 km son $5,500.
   ------------------------------------------------------------ */
const RADIO_MOVIMIENTO_KM = 80;
const MOVIMIENTO_LEJOS = 5500;

const DESTINOS_CON_REGLA = [
  {
    nombre: 'Huasteca Potosina',
    placeId: 'ChIJv8IdsTSP1oURPsKDyokOts4',   // el de lugares.js
    enTexto: /huasteca/i,
    movimientoPorDia: 3000,
    /* R39 (1-sep-2026) · «Recuerda que la Huasteca ya tiene movimientos,
       pero si uno de los movimientos es El Meco, ofrécelo como en CDMX
       con los 3 destinos; si lo seleccionas, le subes 3,000».

       Va como EXTRA, igual que los tres de CDMX: el día sigue costando
       sus $4,000 —$3,000 de movimiento más $1,000 de estadía— y encima
       se suman los $3,000 de El Meco. Aclarado el 1-sep: «a ese precio
       se le suman lo de Meco».

           Huasteca 4 días con 4 movimientos    $42,500
           uno de ellos es El Meco              $45,500 */
    paseos: { 'el meco': 3000, 'el naranjo': 3000 },
    estadiaPorDia: true
  },
  /* La CDMX comparte con la Huasteca la forma de cobrarse (criterio R3,
     palabras del dueño el 26-ago-2026): «son cuatro mil por día extra, pero
     con movimientos. Si no tiene movimientos, nomás vas a cobrar mil.»

     `estadiaPorDia` es eso: cada día de estadía vale $1,000, haya o no
     movimientos. Con movimientos, el día movido suma además su banda —$3,000
     el día normal— y así el día completo da los $4,000 del Excel. Antes, sin
     movimientos, las noches salían gratis hasta 3: eso era el modelo
     inventado y cobraba de menos.

     Las dos guardan en el catálogo una BASE derivada (22,000 y 26,500), no
     un precio del Excel: base + días×1,000 + movimientos reconstruye al peso
     sus cinco columnas. Puebla NO va aquí aunque el dueño la nombró junto a
     ellas: su renglón guarda el precio del Excel completo (36,500 = «PUEBLA
     2 DIAS» tal cual), y ponerle estadía por día lo cobraría doble. Cómo se
     cobra Puebla a otros días está en las preguntas abiertas del criterio. */
  {
    nombre: 'Ciudad de México',
    enTexto: /ciudad de m[eé]xico|cdmx/i,
    estadiaPorDia: true,
    /* R29 · «No aplica para Huasteca, CDMX» (1-sep-2026). Aquí el día NO
       sube con las horas: son $3,000 dure lo que dure, igual que en la
       Huasteca. Su precio del Excel ya está definido como base más días
       CON movimientos, así que escalonarlo encima lo sacaba de su celda.
       Sin esta línea, catorce horas cobraban $2,000 de más. */
    movimientoPorDia: 3000,
    /* R30 · Los tres paseos con nombre, de su propia hoja: «CON TAXCO
       $15,000 EXTRAS», «CON CHALMA $8,000», «CON XOCHIMILCO $2,000».
       Un día marcado con uno de éstos cuesta eso EN VEZ del movimiento
       de $3,000. Solo aquí. */
    paseos: PASEOS_CDMX
  },
  /* Barrancas del Cobre: «3,000 el día, CON O SIN movimientos» (dueño,
     26-ago-2026). Es el primer destino donde moverse no cuesta aparte — allá
     el viaje es el recorrido, no un traslado con paseos sueltos. El día lo
     cobra su `diaExtra` del catálogo; aquí solo se apaga la banda de horas,
     para que un día movido no sume otros $3,000 encima. */
  {
    nombre: 'Barrancas del Cobre',
    enTexto: /barranca|creel/i,
    movimientoPorDia: 0
  },

  /* ------------------------------------------------------------
     R18 · LOS CUATRO DONDE EL DIA NO ES GRATIS
     ------------------------------------------------------------
     Dictado por el dueño el 28-ago-2026 sobre la lista de los 50
     casos: «súbeles 500, el día, a los 4 de abajo» y «a Bernal
     1000 el día».

     Los cuatro salieron en la lista porque tres y cuatro días
     costaban lo mismo que dos. `nochesIncluidas: 1` deja incluida
     la noche del viaje de dos días —que él no pidió mover— y cobra
     de la segunda en adelante.

     NO ESTAN EN LA TABLA, y por eso van aquí y no allá: la tabla
     es del dueño y sus precios están por algo (R12). Esto no es un
     precio: es cómo se cobra el día que la tabla no menciona.
     ------------------------------------------------------------ */
  {
    nombre: 'Comala',
    enTexto: /comala/i,
    nochesIncluidas: 1,
    nocheExtra: 500
  },
  {
    nombre: 'Autlán de Navarro',
    enTexto: /autl[aá]n/i,
    nochesIncluidas: 1,
    nocheExtra: 500
  },
  {
    nombre: 'Bernal',
    enTexto: /bernal/i,
    nochesIncluidas: 1,
    nocheExtra: 1000
  }
];

/* ¿Este destino trae regla propia? Devuelve la regla o null.

   Vive aquí y no en cada endpoint por lo mismo de siempre: si cotizar y
   pagar reconocieran la Huasteca cada uno por su cuenta, un día uno la
   reconoce y el otro no, y el cliente ve un precio y se le cobra otro. */
function reglaDeDestino(destino) {
  if (!destino) return null;
  const id = String(destino.placeId || '').trim();
  const texto = String(destino.direccion || destino.texto || destino.nombre || '');
  for (let i = 0; i < DESTINOS_CON_REGLA.length; i++) {
    const r = DESTINOS_CON_REGLA[i];
    if (id && r.placeId === id) return r;
    if (texto && r.enTexto.test(texto)) return r;
  }
  return null;
}

/* "08:00" y "17:30" -> 9.5. Devuelve 0 si algo no cuadra, y 0 cae en la banda
   más barata, que es el piso: nadie puede pagar menos mandando basura. */
function horasDe(horaInicio, horaFin) {
  function minutos(t) {
    const m = /^(\d{1,2}):(\d{2})$/.exec(String(t || '').trim());
    if (!m) return NaN;
    const h = Number(m[1]), mm = Number(m[2]);
    if (h > 23 || mm > 59) return NaN;
    return h * 60 + mm;
  }
  const a = minutos(horaInicio), b = minutos(horaFin);
  if (!isFinite(a) || !isFinite(b) || b <= a) return 0;
  return (b - a) / 60;
}

function bandaDe(horas) {
  const h = Math.min(24, Math.max(0, Number(horas) || 0));
  for (let i = 0; i < BANDAS_MOVIMIENTO.length; i++) {
    if (h <= BANDAS_MOVIMIENTO[i].hasta) return BANDAS_MOVIMIENTO[i];
  }
  return BANDAS_MOVIMIENTO[BANDAS_MOVIMIENTO.length - 1];
}

/* ------------------------------------------------------------
   Los movimientos los declara el cliente, como las fechas. Aquí
   se acotan antes de que toquen un peso:

     · no puede haber más días con movimiento que DÍAS DE
       SERVICIO. Antes el tope eran las noches, y estaba mal: un
       viaje de tres días puede moverse los tres, y amarrarlo a
       las noches dejaba fuera el último y cobraba $3,000 de
       menos. Lo cazó la prueba que reconstruye «CDMX 3 días» de
       la lista real.
     · las horas se recortan a la banda; lo ilegible vale 0, que
       es el piso de $3,000

   Devuelve solo horas y precio. Las direcciones y los puntos a
   visitar no cambian el dinero, así que no entran aquí.
   ------------------------------------------------------------ */
/* ------------------------------------------------------------
   R30 · LOS TRES PASEOS CON NOMBRE DE CDMX
   ------------------------------------------------------------
   Dictado el 1-sep-2026, con su hoja enfrente: «CON TAXCO $15,000
   EXTRAS», «CON CHALMA $8,000», «CON XOCHIMILCO $2,000».

   No son movimientos normales: SUSTITUYEN el precio del día. Si
   ese día van a Taxco, ese día cuesta $15,000 en vez de $3,000 —
   no se suman los dos.

   Solo existen en CDMX y solo para Sprinter. Un destino los
   habilita poniendo `paseos` en su regla; los demás ni se
   enteran.

   Lo que costaba no tenerlos: Taxco se cobraba a $3,000. **Doce
   mil pesos de menos** cada vez que un grupo iba.

   La tabla se declara ARRIBA, junto a `DESTINOS_CON_REGLA`, porque
   ese arreglo la usa y un `const` no se puede leer antes de su
   renglón.
   ------------------------------------------------------------ */

/* Cómo lo escribió el cliente -> cuál de los tres es. Con tolerancia:
   «Taxco», «taxco», «TAXCO» y «xochimilco» sin acento son el mismo. */
function paseoDe(texto, tabla) {
  if (!texto || !tabla) return null;
  const t = String(texto).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
  return typeof tabla[t] === 'number' ? t : null;
}

function movimientosDe(lista, diasDeServicio, regla) {
  if (!Array.isArray(lista)) return [];
  const dias = Math.max(0, Math.floor(Number(diasDeServicio) || 0));
  const tope = Math.min(TOPE_DIAS_MOVIMIENTO, dias);
  /* `typeof`, no `&&`: una tarifa fija de CERO es válida —Barrancas cobra el
     día igual se mueva o no— y con `fijo || banda` el cero se caía a la banda
     por ser falso. */
  const fijo = regla && typeof regla.movimientoPorDia === 'number'
    ? regla.movimientoPorDia : null;

  /* ------------------------------------------------------------
     R22 · EL VIAJE DE UN DIA NO PAGA MOVIMIENTO

     Dictado por el dueño el 30-ago-2026, corrigiendo la hoja de los
     50 viajes reales: «los viajes de un solo día no cobres
     movimientos, éstos normalmente siempre tienen, no lo cobres».

     Tiene sentido y su propio Excel lo respalda: un paseo de un día
     ES el movimiento. «GUANAJUATO MISMO DIA $19,000» y «MORELIA 1
     DIA $19,000» son precios de un día que ya andando, y cobrarles
     $3,000 encima los sacaba de su propia lista.

     Los movimientos NO se borran, se ponen en cero: el operador
     necesita la hora aunque no cueste, y el contrato la imprime.

     LA EXCEPCION: CDMX Y LA HUASTECA

     A los destinos con `estadiaPorDia` no se les aplica, y no es un
     capricho: su precio del Excel ESTA DEFINIDO como base más días
     CON movimientos —palabras suyas en R3, «son cuatro mil por día
     extra, pero con movimientos»—. Perdonarles el del primer día
     tira su propia celda: CDMX 1 día caería a $23,000 cuando su
     Excel dice $26,000.

     Lo decide su mandamiento, no mi gusto: «si un cálculo da algo
     que no está en el Excel, el cálculo está mal, no el Excel».

     La diferencia de fondo es la que ya distingue R1 de R3.
     «GUANAJUATO MISMO DIA $19,000» es el precio COMPLETO de ese
     día; «CDMX 1 DIA $26,000» es una base a la que se le suma el
     día. Al primero el movimiento ya le venía dentro; al segundo
     se le suma aparte.
     ------------------------------------------------------------ */
  const gratis = dias === 1 && !(regla && regla.estadiaPorDia);

  const salida = [];
  for (let i = 0; i < lista.length && salida.length < tope; i++) {
    const d = lista[i] || {};
    const horas = horasDe(d.horaInicio, d.horaFin);
    /* Con regla propia las horas no cambian el precio, pero SÍ se guardan:
       el operador necesita saber a qué hora, aunque cueste lo mismo. */
    /* Un paseo con nombre manda sobre todo lo demás: sobre la banda de
       horas, sobre la tarifa fija del destino, y sobre el perdón del
       viaje de un día. Es un producto aparte que el cliente pidió. */
    /* R30 corregida (1-sep-2026) · EL PASEO SE SUMA, NO SUSTITUYE.

       Primero se entendió como sustitución —«la ficha cambiaría de 3,000
       a lo de la tabla»— y daba +$12,000 por Taxco. El dueño lo aclaró:
       «si eligen esos 3 destinos, SE LE SUMA a esa cantidad
       preestablecida, no se le suman 3,000 más eso».

       O sea: el día sigue costando lo que cuesta —en CDMX y la Huasteca
       son $4,000, $3,000 de movimiento más $1,000 de estadía— y el paseo
       va ENCIMA. Su hoja lo dice con esa palabra: «CON TAXCO $15,000
       EXTRAS».

           CDMX 3 días con 3 movimientos      $34,000
           uno de ellos es Taxco              $49,000   (+15,000) */
    const cual = paseoDe(d.paseo, regla && regla.paseos);
    if (cual) {
      const normal = fijo === null ? bandaDe(horas).precio : fijo;
      salida.push({
        horas: horas,
        precio: (gratis ? 0 : normal) + regla.paseos[cual],
        paseo: cual
      });
      continue;
    }

    /* R29 · Pasando los 80 km ya no es un paseo, es medio traslado: son
       $5,500 y las horas dejan de importar. Va DESPUES del paseo con
       nombre —Taxco está a 170 km de CDMX y aun así cuesta lo suyo— y
       ANTES de la banda, que es a la que sustituye. */
    const lejos = Number(d.km);
    if (Number.isFinite(lejos) && lejos > RADIO_MOVIMIENTO_KM) {
      salida.push({ horas: horas, precio: gratis ? 0 : MOVIMIENTO_LEJOS, lejos: true });
      continue;
    }

    const precio = fijo === null ? bandaDe(horas).precio : fijo;
    salida.push({ horas: horas, precio: gratis ? 0 : precio });
  }
  return salida;
}

function precioMovimientos(movimientos) {
  let total = 0;
  for (let i = 0; i < movimientos.length; i++) total += movimientos[i].precio;
  return total;
}

/* ------------------------------------------------------------
   DE METROS A KILÓMETROS, EN UN SOLO LUGAR
   ------------------------------------------------------------
   Parece de más, y no lo es. Antes cada endpoint lo hacía por su
   cuenta y NO en el mismo orden:

       cotizar:  ida/1000 + vuelta/1000
       pagar:    (ida + vuelta)/1000

   En matemáticas da igual; en coma flotante no siempre. Se buscó
   con datos: de 1,500,000 pares de distancias reales, en 1,818 el
   resultado difiere en el último bit. Hoy ninguno cambia el total
   —el corte a la centena se los traga— pero eso es suerte, no
   diseño: el día que se afine el redondeo, esos 1,818 se vuelven
   cien pesos de diferencia entre lo que se cotiza y lo que se
   cobra. Y ese es el peor defecto que puede tener esto.

   Con una sola función, cotizar y cobrar no pueden separarse.
   ------------------------------------------------------------ */
function kmDe(metrosIda, metrosVuelta) {
  const a = Math.max(0, Number(metrosIda) || 0);
  const b = Math.max(0, Number(metrosVuelta) || 0);
  return (a + b) / 1000;
}

/* Solo la parte de fecha, en UTC, para que no se cuele la zona horaria. */
function aDia(iso) {
  const p = String(iso || '').slice(0, 10).split('-');
  if (p.length !== 3) return NaN;
  return Date.UTC(Number(p[0]), Number(p[1]) - 1, Number(p[2]));
}

/* Días de servicio, contados inclusive: salir el 20 y regresar el 22 son 3 días. */
function diasDeServicio(salida, regreso) {
  const a = aDia(salida);
  if (!isFinite(a)) return 1;
  const b = aDia(regreso);
  if (!isFinite(b)) return 1;
  return Math.max(1, Math.round((b - a) / 86400000) + 1);
}

/* ¿El regreso es ANTES que la salida? El `Math.max(1, …)` de arriba lo tragaba
   en silencio como un viaje de un día; quien llama usa esto para avisar
   «fecha inválida» en vez de cotizar un viaje imposible. Con fechas ilegibles
   NO es este error (de eso se encarga otra validación). */
function regresoAntesDeSalida(salida, regreso) {
  const a = aDia(salida);
  const b = aDia(regreso);
  if (!isFinite(a) || !isFinite(b)) return false;
  return b < a;
}

/* Noches en destino: la RESTA, no la cuenta inclusive. Salir el 20 y regresar
   el 22 son 3 días de servicio pero 2 noches. Confundirlas cobra mil pesos de
   más en cada viaje, así que van en funciones distintas y con nombres
   distintos, no en una sola con un parámetro. */
function nochesDe(salida, regreso) {
  const a = aDia(salida);
  const b = aDia(regreso);
  if (!isFinite(a) || !isFinite(b)) return 0;
  return Math.max(0, Math.round((b - a) / 86400000));
}

/* ------------------------------------------------------------
   EL VIAJE QUE NO SE COTIZA SOLO
   ------------------------------------------------------------
   Devuelve la MISMA forma que `calcula`, con todo el dinero en
   cero. Que la forma sea idéntica no es adorno: quien llama pasa
   esto por `_publico.precio()` y lo manda igual que cualquier
   otro precio, sin un camino aparte que mantener.

   Del viaje sí se conserva lo que la oficina necesita para
   cotizarlo a mano —los kilómetros, los días, las horas que se
   pidieron—, y todo eso vive en `interno`, que no sale.
   ------------------------------------------------------------ */
function sinPrecio(km, dias, extras) {
  const regla = reglaDeDestino(extras.destino);
  const movimientos = movimientosDe(extras.movimientos, dias, regla);
  return {
    interno: {
      tarifaKm: null,
      km: km.km,
      minimoPorDia: MINIMO_POR_DIA,
      porKilometro: 0,
      minimo: 0,
      aplicoMinimo: false,
      sinRedondear: 0,
      redondeo: REDONDEO,
      horasMovimiento: movimientos.map(function (m) { return m.horas; }),
      traslado: 0,
      noches: Math.max(0, Math.floor(Number(extras.noches) || 0)),
      nochesIncluidas: NOCHES_INCLUIDAS,
      nochesExtra: 0,
      importeNoches: 0,
      destinoDeLista: null,
      porFormula: false,
      conMovimientos: movimientos.length > 0,
      diasParados: 0,
      reglaDestino: regla ? regla.nombre : null
    },
    requiereAsesor: true,
    total: 0,
    ivaIncluido: true,
    subtotal: 0,
    iva: 0,
    porcentajeAnticipo: Math.round(ANTICIPO * 100),
    anticipo: 0,
    saldo: 0,
    desglose: {
      servicio: 0,
      diasMovimiento: movimientos.length,
      importeMovimientos: 0,
      reglaDestino: regla ? regla.nombre : null
    }
  };
}

/* ------------------------------------------------------------
   LO QUE SUMA SALIR DE OTRO LADO
   ------------------------------------------------------------
   SOLO lo que el dueño dictó. No hay cuenta de respaldo: si el
   origen no está en `_origenes.js`, o si está pero su fila no dice
   nada de ese destino, no se suma nada y se cobra precio de
   Guadalajara. Un número que él no escribió no se cobra (R12).

   Y solo le pasa a los destinos DE LISTA. Uno de fórmula ya cobra
   por los kilómetros que midió Google, así que salir de más lejos
   ya se le cobró: sumarle un recargo sería cobrarlo dos veces. La
   lista, en cambio, tira el kilometraje —Vallarta son $19,000
   midan lo que midan—, y ahí es donde el origen se perdía.

   Su regla de «queda de pasada» no necesita geometría: ya viene
   resuelta a mano dentro de su propia fila. Los 19 destinos que
   escribió iguales SON los que quedan de camino. Y saliendo de
   Tequila —que no es un origen dictado— no se suma nada, que es
   justo lo que él dijo que tenía que pasar.

   No hay descuento por quedar de camino. El único destino que
   baja es Morelia, y baja porque él lo escribió, no porque una
   resta lo calculó.
   ------------------------------------------------------------ */
function recargoDeSalida(km, extras, dias) {
  const vacio = { importe: 0, origen: null, dictado: false };
  if (!km || !km.deLista) return vacio;          // fórmula: ya lo cobró el km

  const dictado = origenes.recargoDictado(extras.origen, km.deLista, dias);
  if (dictado === null) return vacio;            // él no lo escribió: no se cobra

  const cual = origenes.buscaOrigen(extras.origen);
  return { importe: dictado, origen: cual ? cual.nombre : null, dictado: true };
}

/* Del kilometraje, los días y lo que se declaró sale todo lo demás.

   `extras` es opcional y trae lo que el cliente declara:
     · noches       — noches de estadía (nochesDe), para las que se pasan de 3
     · movimientos  — lista de días con movimiento, tal como llega del
                      navegador: [{ horaInicio, horaFin }, …]
     · destino      — el punto de destino, para los que traen regla propia
                      (la Huasteca y los que vengan)
     · origen       — el punto de salida, para el recargo de `_origenes.js`

   Que la lista cruda y el destino entren AQUÍ, y no ya resueltos desde cada
   endpoint, es lo mismo que se hizo con kmDe: si cotizar y cobrar pudieran
   interpretarlos cada uno por su cuenta, un día lo hacen distinto. */
function calcula(kmTotal, dias, extras) {
  extras = extras || {};

  const km = trasladoDe(kmTotal, extras.destino, extras.unidad, dias);

  /* ----------------------------------------------------------
     ARRIBA DEL TOPE NO HAY PRECIO — Y NO ES LO MISMO QUE UNO BAJO

     Si aquí se dejara seguir la suma, el traslado valdría cero pero las
     noches y los movimientos se cobrarían igual: un Cancún de cuatro días
     con movimientos saldría en $16,000 y ese número llegaría a la pantalla
     como si fuera el precio del viaje.

     Cero es la única respuesta honesta. Quien llama lee `requiereAsesor` y
     enseña «te cotizamos hoy mismo» en vez de un número.
     ---------------------------------------------------------- */
  if (km.requiereAsesor) return sinPrecio(km, dias, extras);

  /* Solo ida: se resuelve como un caso aparte. No hay estadía ni movimientos
     que sumar —la unidad deja al grupo y se regresa—, así que se ignoran los
     días, las noches y los movimientos que vengan. Ver FRACCION_UN_SENTIDO. */
  const unSentido = extras.redondo === false;

  /* ----------------------------------------------------------
     EL MINIMO DEFIENDE TAMBIEN A LOS PRECIOS DE LA LISTA

     Primero se escribió al revés —el precio de la lista mandaba y no se le
     ponía piso— y dejaba un hueco: Chapala son $6,500 porque es un viaje de
     MISMO DÍA. Pedida a siete días, la unidad se iba una semana por esos
     mismos $6,500 más las noches.

     EL PISO NO LE GANA A UN PRECIO DE LISTA (R34, 1-sep-2026)

     Aquí decía que el piso «no contradice ni un renglón de la lista».
     Era falso, y costaba dinero: Chapala vale $6,500 en el Excel y la
     página cobraba $12,000 por cuatro días, porque cuatro por tres mil
     le ganaba al precio de él.

     El dueño lo cortó de tajo: «cobra 6500 Chapala 4 días». Su precio
     de lista cubre el paquete —cuatro días y tres noches por defecto,
     R26— y de ahí para arriba mandan las noches extra, no un piso que
     yo inventé.

     Le pasaba a los siete destinos baratos: Zacoalco, Tala, San Juan
     Cosalá, Chapala, Cocula, Tequila y Magdalena. De Mazamitla para
     arriba nunca se levantaba, porque su precio ya lo pasaba.

     El piso SIGUE para lo que se cotiza por fórmula: ahí no hay precio
     de él que respetar, y sin piso una unidad apartada diez días se
     cobraría como un paseo.
     ---------------------------------------------------------- */
  const minimo = km.deLista ? 0 : dias * MINIMO_POR_DIA;
  const aplicoMinimo = minimo > km.total;
  const bruto = aplicoMinimo ? minimo : km.total;

  /* R41 (1-sep-2026) · A la centena MAS CERCANA, no hacia abajo.
     Dictado: «solo redondea a la centena más cercana».

     Antes cortaba siempre hacia abajo, a favor del cliente. Con eso,
     $8,502 daba $8,500 —igual— pero $16,268 daba $16,200 en vez de
     $16,300: hasta $99 regalados por viaje sin que nadie lo decidiera.

     A los precios de lista no les hace nada: ya son múltiplos de cien. */
  const traslado = Math.round(bruto / REDONDEO) * REDONDEO;

  const noches = Math.max(0, Math.floor(Number(extras.noches) || 0));

  /* ----------------------------------------------------------
     DOS FORMAS DE COBRAR LA ESTADIA, Y LA DIFERENCIA IMPORTA

     SIN MOVIMIENTOS — es un paquete. La unidad se queda
     estacionada y las 3 primeras noches van incluidas; de ahí en
     adelante, $1,000 cada una. Es como se venden los viajes de
     playa: Vallarta de jueves a domingo son $19,000, sin cargo
     aparte por las noches.

     CON MOVIMIENTOS — se cobra día por día, y no hay noches
     incluidas. Cada día de estadía vale $1,000 porque la unidad
     está apartada allá y no puede trabajar en otra cosa; el día
     que además se mueve, se le suma su banda de horas.

     Un día de 8 horas sale entonces en $4,000, que es exactamente
     el escalón por día de CDMX y de la Huasteca en la lista real.
     ---------------------------------------------------------- */
  /* El tope de días con movimiento son los DÍAS DE SERVICIO, no las noches.
     Un viaje de tres días puede moverse los tres; amarrarlo a las noches
     dejaba fuera el último día y cobraba $3,000 de menos. Lo cazó la prueba
     que reconstruye «CDMX 3 días» de la lista real. */
  const regla = reglaDeDestino(extras.destino);
  /* Un solo-ida no se mueve: se ignoran los movimientos que lleguen. */
  const movimientos = unSentido ? [] : movimientosDe(extras.movimientos, dias, regla);

  /* ------------------------------------------------------------
     R24 · LO QUE LA COLUMNA YA TRAE, NO SE COBRA OTRA VEZ

     Dictado el 30-ago-2026: «todos los viajes que tengan, por
     ejemplo, Huasteca tres días, Ciudad de México dos días,
     tienen movimientos incluidos […] a excepción de Cancún».

     `movimientosIncluidos` son los DIAS que cubre su columna del
     Excel. Esos días se ponen en cero; del siguiente en adelante
     se cobran normal, porque ahí la columna ya se acabó —la misma
     frontera de R2 y R14.

     Se pone a CERO en vez de quitarlos: el operador necesita la
     hora aunque no cueste, igual que en R22.
     ------------------------------------------------------------ */
  for (let i = 0; i < movimientos.length && i < km.movimientosIncluidos; i++) {
    /* Un paseo con nombre NO se perdona aunque la columna traiga
       movimientos incluidos. Su propia hoja lo dice: «CON TAXCO $15,000
       EXTRAS» — extras, o sea encima de lo que ya cubre la columna.
       Perdonarlo aquí regalaría los $15,000. */
    if (movimientos[i].paseo) continue;
    movimientos[i].precio = 0;
  }

  const importeMovimientos = precioMovimientos(movimientos);
  const conMovimientos = movimientos.length > 0;

  /* ----------------------------------------------------------
     QUE SE LE PUEDE SUMAR AL TRASLADO — según de dónde salió

     · `porDuracion` (criterio R1): el precio ya ES el de esta
       duración —Guanajuato 3 días son $24,500, no $19,000 más
       noches—. No se suma estadía; los movimientos sí van aparte
       (el Excel dice «3 DIAS SIN MOV», o sea que moverse es otra
       cosa).
     · `diasIncluidos` (criterio R2): es un paquete. Cancún 17
       días son $145,000 completos; solo del día 18 en adelante
       hay noches que cobrar. Antes se le sumaban $13,000.
     · `estadiaPorDia` (criterio R3): CDMX y Huasteca cobran
       $1,000 por CADA día de estadía, haya movimientos o no.
     · el resto: 3 noches incluidas y $1,000 la extra; con
       movimientos, $1,000 por día. Es la regla de los viajes de
       playa y está en las preguntas abiertas del criterio,
       porque el $1,000 no aparece escrito en el Excel.
     ---------------------------------------------------------- */
  /* Las noches que trae el paquete. Si el destino dice cuántos días incluye,
     manda ÉL —aunque sean menos de las tres de siempre—.

     Antes iba con `Math.max(NOCHES_INCLUIDAS, …)`, que le ponía piso de tres
     y hacía imposible un paquete más corto. Tolantongo es de tres días, y su
     día extra empieza en el CUARTO: con el piso, ese día salía gratis. Lo
     dictó el dueño el 26-ago-2026 («4»). Quitar el piso no mueve a ningún
     otro: Talpa Burrita incluye 4 días (3 noches, igual que el piso),
     Chiapas 8 y Cancún 17. */
  /* ----------------------------------------------------------
     R18 · DESTINOS DONDE EL DIA NO ES GRATIS

     Dictado por el dueño el 28-ago-2026, mirando los 50 casos que
     la página cotiza sola: «súbeles 500, el día, a los 4 de abajo»
     y «a Bernal 1000 el día».

     Los cuatro eran Ocotlán, Comala y Autlán a 3 y 4 días, y
     Bernal a 3, y salieron porque los tres días y los cuatro
     costaban EXACTAMENTE lo mismo que dos: las tres noches de
     `NOCHES_INCLUIDAS` se las comían.

     SE COBRAN LOS DIAS QUE HOY SALEN GRATIS, NO TODOS. Un viaje de
     dos días trae una noche y ésa sigue incluida —el dueño no pidió
     mover el precio de dos días, y cobrarla subiría también ése—.
     Por eso es `nochesIncluidas: 1` y no `estadiaPorDia`, que es lo
     que usan CDMX y la Huasteca: aquéllas cobran desde el primer
     día porque su base es un traslado de UN día, no de dos.

     Queda entonces:  3 días = +una noche · 4 días = +dos noches.
     ---------------------------------------------------------- */
  /* ------------------------------------------------------------
     R25 · TRES NOCHES PARA TODOS — SE FUE EL CORTE DE LOS $15,000

     El 30-ago-2026 el dueño cerró la pregunta que le hice sobre
     este corte: «todos los viajes que tengan el destino y un
     precio, ya te dije, tres noches y mil por cada noche arriba».

     Aquí vivía R18: los destinos abajo de $15,000 llevaban UNA
     noche incluida y $500 las destapadas. Eso se acabó — su
     palabra de hoy es sobre TODOS, y se lo pregunté con los once
     destinos y sus números enfrente.

     LO QUE NO SE FUE: Comala, Autlán y Bernal. Esos no tienen
     columna en el Excel —«un destino y un precio» no los alcanza—
     y él los dictó UNO POR UNO con nombre propio. Siguen con su
     `nochesIncluidas` y su `nocheExtra` en DESTINOS_CON_REGLA.
     ------------------------------------------------------------ */
  const nochesIncluidas = (regla && typeof regla.nochesIncluidas === 'number')
    ? regla.nochesIncluidas
    : (km.diasIncluidos ? Math.max(0, km.diasIncluidos - 1) : NOCHES_INCLUIDAS);

  /* Lo que vale cada noche de más, cuando todas valen igual: la que el dueño
     le dictó al destino, o la de siempre.

     `typeof` y no `||`: una noche de cero pesos sería un valor válido y con
     `||` se caería a los mil. */
  const porNoche = (regla && typeof regla.nocheExtra === 'number')
    ? regla.nocheExtra
    : EXTRA_POR_NOCHE;

  /* ------------------------------------------------------------
     COBRAR UNA NOCHE QUE ERA GRATIS NO PUEDE ABARATAR LAS DEMAS
     ------------------------------------------------------------
     Aquí estuvo un defecto mío, DOS VECES, y las dos las cazó medir
     el cambio contra el código anterior en vez de confiar en que
     hacía lo que yo creía.

     La primera versión cobraba los $500 en TODAS las noches. Para
     tres y cuatro días daba lo que el dueño pidió, pero para siete
     el viaje salía MAS BARATO —Chapala de $24,000 a $23,500—
     porque las noches que ya se cobraban a $1,000 bajaban a $500.

     Lo arreglé solo para la regla general, y quedó igual de mal en
     los destinos con tarifa dictada: Comala y Autlán a diez días
     pasaban de $36,000 a $34,000.

     LA REGLA, ENTONCES, ES UNA SOLA: la tarifa rebajada vale para
     las noches que ANTES VENIAN INCLUIDAS, y de ahí en adelante
     manda la de siempre. El dueño pidió cobrar los días que salían
     gratis, no descontar los que ya se cobraban.
     ------------------------------------------------------------ */
  /* Ya no hay tarifa rebajada general: la única que queda es la que el dueño
     le dictó a un destino por su nombre (Comala, Autlán, Bernal). */
  const tarifaPropia = porNoche;

  function cobraNoches(cuantas) {
    /* Este destino no rebajó nada: todas sus noches valen igual. */
    if (nochesIncluidas >= NOCHES_INCLUIDAS) return cuantas * tarifaPropia;

    /* Sí rebajó: las que se destaparon van a su tarifa, y el resto a la de
       siempre —o a la propia si resultara más cara, para que una tarifa
       dictada alta no se caiga a los mil—. */
    const destapadas = Math.min(cuantas, NOCHES_INCLUIDAS - nochesIncluidas);
    return destapadas * tarifaPropia +
      (cuantas - destapadas) * Math.max(tarifaPropia, EXTRA_POR_NOCHE);
  }
  /* Las noches incluidas NO se pierden por moverse. Corrección del dueño el
     26-ago-2026: «la playa es sencillo: cada noche que supere las 3 noches
     por defecto son 1000, y si tiene movimientos son 3000 por día — o sea que
     un día extra con movimientos son 4000».

     O sea que estadía y movimiento son dos cobros independientes que se
     suman, no dos modos que se excluyen. Antes, en cuanto había UN
     movimiento se cobraban $1,000 por TODOS los días y las 3 noches
     incluidas desaparecían: Vallarta 4 días con 2 movimientos salía en
     $29,000 en vez de $25,000. */
  const nochesExtra = km.porDuracion ? 0 : Math.max(0, noches - nochesIncluidas);
  const diasParados = conMovimientos ? Math.max(0, dias - movimientos.length) : 0;

  let importeNoches;
  if (km.porDuracion) {
    importeNoches = 0;                     // la duración ya viene en el precio
  } else if (regla && regla.estadiaPorDia) {
    /* CDMX y Huasteca son la excepción: su precio es un traslado de UN día,
       no un paquete, así que la estadía se cobra desde el primer día y no
       hay noches incluidas que valgan. Reconstruye sus renglones del Excel
       al peso ($4,000 el día con movimiento = 1,000 + 3,000). */
    importeNoches = dias * EXTRA_POR_NOCHE;
  } else {
    importeNoches = cobraNoches(nochesExtra);
  }

  /* ----------------------------------------------------------
     R5 · EL PRECIO «CON MOVIMIENTOS» DEL PROPIO EXCEL

     Tolantongo trae DOS columnas: «SIN MOV $29,500» y «con mov
     $34,500». La segunda YA lo incluye todo: ni bandas de horas
     ni estadía aparte. Antes se cobraba 29,500 + días + bandas =
     $41,500, y el dueño corrigió el 26-ago-2026: «sí, estás mal,
     dalo de acuerdo al Excel».

     El piso por día manda igual que siempre: pedido a muchos
     días, el mínimo le gana al precio del Excel.
     ---------------------------------------------------------- */
  let cobroTraslado = traslado;
  let cobroNoches = importeNoches;
  let cobroMovimientos = importeMovimientos;
  if (km.precioConMovimientos && conMovimientos) {
    cobroTraslado = Math.floor(Math.max(km.precioConMovimientos, minimo) / REDONDEO) * REDONDEO;

    /* El precio del Excel cubre EL PAQUETE —sus noches incluidas y los
       movimientos de esos días—, no un viaje de cualquier duración. Pasado
       el paquete manda la regla de siempre (R13), que el dueño confirmó el
       26-ago-2026 para este destino: «Tolantongo $1,000 sin movimientos,
       +$3,000 si hay movimientos».

       Antes esto era plano: 34,500 dijeran lo que dijeran los días, así que
       el día de más no sumaba nada. */
    const diasDelPaquete = nochesIncluidas + 1;
    cobroNoches = nochesExtra * EXTRA_POR_NOCHE;
    cobroMovimientos = precioMovimientos(movimientos.slice(diasDelPaquete));

  }

  /* SOLO IDA manda sobre todo lo demás: 65% del precio de UN DÍA sin
     movimientos —o sea del traslado de lista o de fórmula, sin piso por
     varios días, sin noches, sin bandas—. Va al final para que ni la regla
     R5 ni la estadía se le cuelen. Hacia abajo al múltiplo de 100, como
     todo aquí, a favor del cliente. */
  if (unSentido) {
    const base1dia = Math.floor(km.total / REDONDEO) * REDONDEO;
    cobroTraslado = Math.floor(FRACCION_UN_SENTIDO * base1dia / REDONDEO) * REDONDEO;
    cobroNoches = 0;
    cobroMovimientos = 0;
  }

  /* ----------------------------------------------------------
     EL RECARGO DE SALIDA VA APARTE, Y AL FINAL

     Aparte porque el dueño lo pidió así —«lo añades como extra,
     para que se puedan calcular movimientos normalmente»—: si se
     metiera en el traslado, el piso por día y la regla R5 lo
     moverían, y las noches y las bandas se calcularían sobre un
     número que ya no es el de la lista.

     Al final por lo mismo: nada de lo de arriba lo toca.

     En un SOLO IDA se cobra la misma fracción que el traslado. El
     desvío sigue existiendo —la unidad tiene que ir por el grupo
     a Ocotlán—, pero no se hace dos veces.
     ---------------------------------------------------------- */
  const salida = recargoDeSalida(km, extras, dias);
  const cobroOrigen = unSentido
    ? Math.floor(FRACCION_UN_SENTIDO * salida.importe / REDONDEO) * REDONDEO
    : salida.importe;

  const total = cobroTraslado + cobroNoches + cobroMovimientos + cobroOrigen;

  // El anticipo se redondea al peso y el saldo se saca por resta, para que
  // las dos partes sumen exactamente el total y no sobre ni falte un centavo.
  // Se saca del total FINAL: si saliera del traslado a secas, se apartaría un
  // viaje de cincuenta mil con el anticipo de uno de treinta.
  const anticipo = Math.round(total * ANTICIPO);
  const saldo = total - anticipo;

  const subtotal = Math.round((total / (1 + TASA_IVA)) * 100) / 100;

  /* OJO con lo que se devuelve.
     La tarifa por kilómetro NO puede llegar al navegador. Y no basta con no
     escribirla en pantalla: si se manda en la respuesta, cualquiera la ve
     abriendo las herramientas del navegador. Peor aún, con los kilómetros y
     el total juntos se saca dividiendo. Por eso aquí se separa en dos:
     `interno`, que se queda en el servidor, y el resto, que sí puede salir. */
  return {
    interno: {
      tarifaKm: km.porKm,            // a qué salió el kilómetro en ESTE viaje
      km: km.km,
      minimoPorDia: MINIMO_POR_DIA,
      porKilometro: Math.round(km.total),
      minimo: minimo,
      aplicoMinimo: aplicoMinimo,
      sinRedondear: Math.round(bruto),
      redondeo: REDONDEO,
      /* Las horas de cada día con movimiento. Del lado del servidor por la
         misma razón que los tramos: el detalle de cómo se armó un precio no
         se le enseña a quien lo paga. */
      horasMovimiento: movimientos.map(function (m) { return m.horas; }),
      /* Y aquí las noches, por la MISMA razón que el kilómetro: «2 noches ·
         $2,000» le dice al cliente cuánto cuesta la noche. El servidor sí las
         necesita partidas —el contrato explica de dónde salió el total—, así
         que viven aquí y no en `desglose`. */
      traslado: cobroTraslado,
      noches: noches,
      nochesIncluidas: nochesIncluidas,   // la efectiva: un paquete incluye más
      nochesExtra: nochesExtra,
      importeNoches: cobroNoches,
      /* De dónde salió el traslado, para que la oficina lo pueda cuadrar:
         el nombre del destino si vino de la lista, o la marca de la fórmula. */
      destinoDeLista: km.deLista || null,
      porFormula: !!km.porFormula,
      /* El recargo por salir de otro lado, partido para que la oficina lo
         pueda cuadrar contra el Excel: de dónde salió, cuánto sumó, y si el
         número lo dictó el dueño o lo sacaron los kilómetros medidos. */
      salidaDesde: salida.origen,
      recargoSalida: cobroOrigen,
      recargoDictado: salida.dictado,
      conMovimientos: conMovimientos,
      diasParados: diasParados,
      /* Qué destino con regla propia aplicó, si alguno. La oficina lo lee en
         el contrato para saber por qué un día de movimientos costó lo que
         costó cuando las horas dirían otra cosa. */
      reglaDestino: regla ? regla.nombre : null
    },
    /* Los viajes muy largos no se cotizan solos: la fórmula regalaría miles.
       Quien llama lo lee y enseña «te cotizamos hoy mismo». */
    requiereAsesor: !!km.requiereAsesor,
    total: total,
    ivaIncluido: true,
    subtotal: subtotal,
    iva: Math.round((total - subtotal) * 100) / 100,
    porcentajeAnticipo: Math.round(ANTICIPO * 100),
    anticipo: anticipo,
    saldo: saldo,
    /* Qué sí puede ver el cliente.

       Son DOS números, no cuatro. El traslado y las noches extra van juntos a
       propósito: partidos, «2 noches · $2,000» delata la tarifa por noche
       igual que el total con los kilómetros delata la del kilómetro.

       Juntos siguen sumando el total exacto, y eso importa tanto como
       esconder la tarifa: un desglose que no cuadra con el total parece un
       error de cuentas, y el cliente llama a preguntar. */
    desglose: {
      /* El recargo de salida va DENTRO de «servicio», por la misma razón que
         las noches: partido, se lee como una tarifa. Y el desglose tiene que
         seguir sumando el total exacto. */
      servicio: cobroTraslado + cobroNoches + cobroOrigen,
      diasMovimiento: movimientos.length,
      importeMovimientos: cobroMovimientos,
      /* El NOMBRE del destino con regla propia, no su tarifa. Sale para que la
         pantalla no le prometa al cliente «8 horas incluidas» donde el día es
         tarifa fija sin importar las horas. */
      reglaDestino: regla ? regla.nombre : null
    }
  };
}

module.exports = {
  BASE_TRASLADO, POR_KM, TOPE_FORMULA_KM, POR_KM_LARGO,
  MINIMO_POR_DIA, REDONDEO, TASA_IVA, ANTICIPO,
  /* Se exporta para que `probar-whatsapp.cjs` compare esta tabla contra el
     espejo que tiene el bot. Si dejan de coincidir, el bot ofrecería un
     paseo que el motor no cobra —o al revés— y nadie se enteraría. */
  PASEOS_CDMX, RADIO_MOVIMIENTO_KM, MOVIMIENTO_LEJOS,
  NOCHES_INCLUIDAS, EXTRA_POR_NOCHE, TOPE_DIA_BARATO, DIA_BARATO, BANDAS_MOVIMIENTO, TOPE_DIAS_MOVIMIENTO,
  DESTINOS_CON_REGLA,
  recargoDeSalida,
  UNIDADES_QUE_COTIZAN, claveDeUnidad, seSabeCotizar, necesitaMedirse,
  kmDe, diasDeServicio, nochesDe, regresoAntesDeSalida, trasladoDe, reglaDeDestino,
  horasDe, bandaDe, movimientosDe, precioMovimientos,
  calcula
};
