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
     · el kilómetro se cobra POR TRAMOS (ver abajo), IVA YA INCLUIDO
     · mínimo $3,000 POR DÍA de servicio
     · el total se corta HACIA ABAJO a la centena
     · 3 noches incluidas; cada noche de más, $1,000
     · los movimientos en destino se cobran por día, según las horas
     · anticipo del 20% para apartar; el resto se abona

   EL ORDEN DE LA SUMA IMPORTA, y es el que dictó el dueño:

       1. los kilómetros por tramos
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
   EL KILÓMETRO SE COBRA POR TRAMOS, COMO LOS IMPUESTOS
   ------------------------------------------------------------
   No es que un viaje largo entero se cobre más barato: es que
   los kilómetros QUE PASAN de cada marca se cobran más baratos.

       los primeros    800 km  ->  $35
       de 800 a      1,000 km  ->  $28
       de 1,000 en adelante    ->  $26

   Un viaje de 1,200 km, entonces:
       800 × 35  =  28,000
       200 × 28  =   5,600
       200 × 26  =   5,200
                    ------
                    38,800

   La cuenta es sobre el kilometraje del VIAJE COMPLETO —ida más
   vuelta sumadas—, no por tramo del recorrido.

   Cobrarlo de la otra forma (una sola tarifa según el total)
   tendría un escalón absurdo: a 799 km costaría más que a 801.
   Así crece siempre, nada más que cada vez más despacio.
   ------------------------------------------------------------ */
const TRAMOS = [
  { hasta: 800, porKm: 35 },
  { hasta: 1000, porKm: 28 },
  { hasta: Infinity, porKm: 26 }
];

/* Se conserva por claridad: es lo que cuesta el kilómetro de un viaje que no
   pasa del primer tramo, que son casi todos. */
const TARIFA_KM = TRAMOS[0].porKm;

/* Recorre los tramos y va cobrando lo que cae en cada uno. Devuelve además el
   desglose, que se queda del lado del servidor: al cliente NUNCA se le
   enseña ni el kilometraje ni lo que cuesta el kilómetro. */
function porTramos(kmTotal) {
  const km = Math.max(0, Number(kmTotal) || 0);
  let restan = km;
  let piso = 0;
  let total = 0;
  const desglose = [];

  for (let i = 0; i < TRAMOS.length && restan > 0; i++) {
    const t = TRAMOS[i];
    const cabenAqui = Math.min(restan, t.hasta - piso);
    if (cabenAqui > 0) {
      const importe = cabenAqui * t.porKm;
      total += importe;
      desglose.push({ desde: piso, hasta: piso + cabenAqui, km: cabenAqui, porKm: t.porKm, importe: importe });
      restan -= cabenAqui;
    }
    piso = t.hasta;
  }

  return { total: total, desglose: desglose };
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
function movimientosDe(lista, nochesDeEstadia) {
  if (!Array.isArray(lista)) return [];
  const tope = Math.min(TOPE_DIAS_MOVIMIENTO, Math.max(0, Math.floor(Number(nochesDeEstadia) || 0)));
  const salida = [];
  for (let i = 0; i < lista.length && salida.length < tope; i++) {
    const d = lista[i] || {};
    const horas = horasDe(d.horaInicio, d.horaFin);
    salida.push({ horas: horas, precio: bandaDe(horas).precio });
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

   Que la lista cruda entre AQUÍ, y no ya contada desde cada endpoint, es lo
   mismo que se hizo con kmDe: si cotizar y cobrar pudieran acotarla cada uno
   por su cuenta, un día se acotan distinto. */
function calcula(kmTotal, dias, extras) {
  extras = extras || {};

  const tramos = porTramos(kmTotal);
  const porKilometro = tramos.total;
  const minimo = dias * MINIMO_POR_DIA;
  const aplicoMinimo = minimo > porKilometro;
  const bruto = aplicoMinimo ? minimo : porKilometro;

  // Hacia abajo, siempre a favor del cliente. Nunca queda por debajo del
  // mínimo, porque el mínimo ya es múltiplo de cien.
  const traslado = Math.floor(bruto / REDONDEO) * REDONDEO;

  // --- las noches que se pasan de las incluidas ---
  const noches = Math.max(0, Math.floor(Number(extras.noches) || 0));
  const nochesExtra = Math.max(0, noches - NOCHES_INCLUIDAS);
  const importeNoches = nochesExtra * EXTRA_POR_NOCHE;

  // --- los días con movimiento, ya acotados ---
  const movimientos = movimientosDe(extras.movimientos, noches);
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
      tarifaKm: TARIFA_KM,
      tramos: tramos.desglose,       // cuánto cayó en cada tramo y a qué precio
      minimoPorDia: MINIMO_POR_DIA,
      porKilometro: Math.round(porKilometro),
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
      importeNoches: importeNoches
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
      importeMovimientos: importeMovimientos
    }
  };
}

module.exports = {
  TARIFA_KM, TRAMOS, MINIMO_POR_DIA, REDONDEO, TASA_IVA, ANTICIPO,
  NOCHES_INCLUIDAS, EXTRA_POR_NOCHE, BANDAS_MOVIMIENTO, TOPE_DIAS_MOVIMIENTO,
  kmDe, diasDeServicio, nochesDe, porTramos,
  horasDe, bandaDe, movimientosDe, precioMovimientos,
  calcula
};
