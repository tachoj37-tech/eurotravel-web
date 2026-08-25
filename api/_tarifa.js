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
   UNA SOLA TARIFA, ELEGIDA POR EL TOTAL DEL VIAJE
   ------------------------------------------------------------
   No es por tramos. Se mira cuántos kilómetros mide el viaje
   completo y TODOS se cobran a la misma tarifa:

       hasta      800 km  ->  los 800 a $34
       de 801 a 1,000 km  ->  TODOS a $25
       de 1,001 en adelante  ->  TODOS a $23

   Un viaje de 900 km, entonces, son 900 × 25 = 22,500. No 800 a
   una tarifa y 100 a otra: los novecientos a veinticinco.

   La cuenta es sobre el kilometraje del VIAJE COMPLETO —ida más
   vuelta sumadas—, no por tramo del recorrido.

   ------------------------------------------------------------
   EL ESCALÓN DE LOS 801 KM ES A PROPÓSITO. NO LO "ARREGLES".
   ------------------------------------------------------------
   Esto tiene una consecuencia que se midió antes de escribirlo y
   que el dueño aprobó con los números enfrente:

       800 km  ->  $27,200
       801 km  ->  $20,000     un kilómetro más, $7,200 menos

   Y no es solo el escalón: de 801 a 1,182 km, TODOS los viajes
   cobran menos que uno de 800 km. Son 382 kilómetros donde el
   viaje cuesta más gasolina, más casetas y más horas de operador,
   y deja menos dinero. Un cliente con un viaje de 780 km que
   agregue una parada y llegue a 810 paga $7,200 menos, y con esta
   regla eso es legítimo.

   Se le propuso la alternativa —las mismas tarifas 34/25/23 pero
   por tramos, que sube siempre y no tiene escalón— y eligió ésta.
   Si algún día se quiere cambiar, se cambia con él, no aquí.
   ------------------------------------------------------------ */
const BANDAS_KM = [
  { hasta: 800, porKm: 34 },
  { hasta: 1000, porKm: 25 },
  { hasta: Infinity, porKm: 23 }
];

/* Se conserva por claridad: es lo que cuesta el kilómetro de un viaje que no
   pasa de la primera banda, que son casi todos. */
const TARIFA_KM = BANDAS_KM[0].porKm;

function bandaKm(kmTotal) {
  const km = Math.max(0, Number(kmTotal) || 0);
  for (let i = 0; i < BANDAS_KM.length; i++) {
    if (km <= BANDAS_KM[i].hasta) return BANDAS_KM[i];
  }
  return BANDAS_KM[BANDAS_KM.length - 1];
}

/* Cuánto cuesta el kilometraje. Devuelve además a qué tarifa salió, que se
   queda del lado del servidor: al cliente NUNCA se le enseña ni el
   kilometraje ni lo que cuesta el kilómetro. */
function porKilometro(kmTotal) {
  const km = Math.max(0, Number(kmTotal) || 0);
  const banda = bandaKm(km);
  return { total: km * banda.porKm, porKm: banda.porKm, km: km };
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
const DESTINOS_CON_REGLA = [
  {
    nombre: 'Huasteca Potosina',
    placeId: 'ChIJv8IdsTSP1oURPsKDyokOts4',   // el de lugares.js
    enTexto: /huasteca/i,
    movimientoPorDia: 3000
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

     · no puede haber más días con movimiento que noches de
       estadía —es la misma regla que aplica la pantalla, y tiene
       que ser la misma o lo que se cotiza deja de ser lo que se
       cobra—
     · las horas se recortan a la banda; lo ilegible vale 0, que
       es el piso de $3,000

   Devuelve solo horas y precio. Las direcciones y los puntos a
   visitar no cambian el dinero, así que no entran aquí.
   ------------------------------------------------------------ */
function movimientosDe(lista, nochesDeEstadia, regla) {
  if (!Array.isArray(lista)) return [];
  const tope = Math.min(TOPE_DIAS_MOVIMIENTO, Math.max(0, Math.floor(Number(nochesDeEstadia) || 0)));
  const fijo = regla && regla.movimientoPorDia;
  const salida = [];
  for (let i = 0; i < lista.length && salida.length < tope; i++) {
    const d = lista[i] || {};
    const horas = horasDe(d.horaInicio, d.horaFin);
    /* Con regla propia las horas no cambian el precio, pero SÍ se guardan:
       el operador necesita saber a qué hora, aunque cueste lo mismo. */
    salida.push({ horas: horas, precio: fijo || bandaDe(horas).precio });
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

/* Del kilometraje, los días y lo que se declaró sale todo lo demás.

   `extras` es opcional y trae lo que el cliente declara:
     · noches       — noches de estadía (nochesDe), para las que se pasan de 3
     · movimientos  — lista de días con movimiento, tal como llega del
                      navegador: [{ horaInicio, horaFin }, …]
     · destino      — el punto de destino, para los que traen regla propia
                      (la Huasteca y los que vengan)

   Que la lista cruda y el destino entren AQUÍ, y no ya resueltos desde cada
   endpoint, es lo mismo que se hizo con kmDe: si cotizar y cobrar pudieran
   interpretarlos cada uno por su cuenta, un día lo hacen distinto. */
function calcula(kmTotal, dias, extras) {
  extras = extras || {};

  const km = porKilometro(kmTotal);
  const minimo = dias * MINIMO_POR_DIA;
  const aplicoMinimo = minimo > km.total;
  const bruto = aplicoMinimo ? minimo : km.total;

  // Hacia abajo, siempre a favor del cliente. Nunca queda por debajo del
  // mínimo, porque el mínimo ya es múltiplo de cien.
  const traslado = Math.floor(bruto / REDONDEO) * REDONDEO;

  // --- las noches que se pasan de las incluidas ---
  const noches = Math.max(0, Math.floor(Number(extras.noches) || 0));
  const nochesExtra = Math.max(0, noches - NOCHES_INCLUIDAS);
  const importeNoches = nochesExtra * EXTRA_POR_NOCHE;

  // --- los días con movimiento, ya acotados ---
  const regla = reglaDeDestino(extras.destino);
  const movimientos = movimientosDe(extras.movimientos, noches, regla);
  const importeMovimientos = precioMovimientos(movimientos);

  const total = traslado + importeNoches + importeMovimientos;

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
      traslado: traslado,
      noches: noches,
      nochesIncluidas: NOCHES_INCLUIDAS,
      nochesExtra: nochesExtra,
      importeNoches: importeNoches,
      /* Qué destino con regla propia aplicó, si alguno. La oficina lo lee en
         el contrato para saber por qué un día de movimientos costó lo que
         costó cuando las horas dirían otra cosa. */
      reglaDestino: regla ? regla.nombre : null
    },
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
      servicio: traslado + importeNoches,
      diasMovimiento: movimientos.length,
      importeMovimientos: importeMovimientos,
      /* El NOMBRE del destino con regla propia, no su tarifa. Sale para que la
         pantalla no le prometa al cliente «8 horas incluidas» donde el día es
         tarifa fija sin importar las horas. */
      reglaDestino: regla ? regla.nombre : null
    }
  };
}

module.exports = {
  TARIFA_KM, BANDAS_KM, MINIMO_POR_DIA, REDONDEO, TASA_IVA, ANTICIPO,
  NOCHES_INCLUIDAS, EXTRA_POR_NOCHE, BANDAS_MOVIMIENTO, TOPE_DIAS_MOVIMIENTO,
  DESTINOS_CON_REGLA,
  kmDe, diasDeServicio, nochesDe, bandaKm, porKilometro, reglaDeDestino,
  horasDe, bandaDe, movimientosDe, precioMovimientos,
  calcula
};
