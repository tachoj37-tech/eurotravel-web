/* ============================================================
   De dónde SALE el viaje, y qué le suma
   ------------------------------------------------------------
   La lista de precios está medida desde Guadalajara. Saliendo de
   otro lado, el mismo viaje puede costar más —o exactamente lo
   mismo—, y eso NO depende de la distancia sino de si el origen
   queda DE CAMINO al destino.

   El dueño lo dijo así el 28-ago-2026:

     «hay viajes que se mantienen igual, porque muchas veces
      Ocotlán queda de pasada para llegar a un destino […] si un
      viaje sale de Tequila, tú pensarías que cuesta más, pero
      no, porque Tequila está de camino a Vallarta.»

   POR QUE UNA TABLA Y NO UNA FORMULA

   El mismo motivo que en `_destinos.js`. Se midió: de las 49
   columnas de la fila 11 del Excel, 19 no suben nada, 29 suben
   entre $2,000 y $6,000 y Morelia BAJA $500. Los importes van en
   escalones de $500 y no salen de una curva.

   Se probó la regla geométrica contra sus números —¿está Ocotlán
   más cerca del destino que Guadalajara?— y acierta en 38 de 49.
   Los 18 destinos que quedan más lejos suben los 18, sin una
   sola excepción. Los 11 que fallan son todos del mismo tipo:
   Guanajuato, San Juan de los Lagos, Real de Catorce, Zacatecas
   y la Huasteca se ven más cerca en el mapa, pero se llega a
   ellos por Lagos de Moreno, al noreste, y Ocotlán está al
   sureste. Es desvío aunque parezca atajo.

   O sea: el criterio del dueño es correcto y se mide POR
   CARRETERA, no en línea recta. Por eso el respaldo de
   `_tarifa.js` usa los kilómetros que mide Google, no estas
   coordenadas.

   COMO SE AGREGA UN ORIGEN

   Un renglón más en ORIGENES con lo que diga su fila del Excel.
   El dueño irá pasando más —«te iré pasando más destinos de
   salida con precios»—; Yurécuaro (fila 22) y Dominical (fila
   25) ya están en el mismo archivo, esperando.
   ============================================================ */

/* --------------------------------------------------------------
   SOLO EL RADIO. NO HAY RESPALDO POR KILOMETROS.

   Hubo uno y se quitó el 28-ago-2026, el mismo día, por orden del
   dueño: «de momento solo vamos a usar el radio de Ocotlán, ahí te
   vas a basar para actualizar todos los destinos de la fila 11».

   Lo que hacía: para un origen que NO estuviera en esta tabla,
   comparaba el viaje medido contra el mismo viaje desde
   Guadalajara y cobraba los kilómetros de más, perdonando 60 —el
   ancho del área metropolitana, para que un vecino de Zapopan no
   viera un recargo de $200 por existir—.

   Por qué se fue: cobraba números que él nunca dictó. Un viaje
   desde Monterrey a Vallarta le sumaba $15,800 salidos de una
   cuenta mía, no de su Excel, y eso es exactamente lo que prohíbe
   R12. Mientras no haya un origen dictado, la página cobra precio
   de Guadalajara — que es lo que hacía antes y nunca le costó una
   queja.

   Para retomarlo: la cuenta era
   `medido − km del catálogo − 60`, a POR_KM, redondeado abajo a la
   centena. El criterio lo guarda entero en R19.
   -------------------------------------------------------------- */

/* --------------------------------------------------------------
   LOS MUNICIPIOS DEL AREA METROPOLITANA MATAN LA COINCIDENCIA

   Sin esto había un falso positivo caro. La página casi nunca manda
   coordenadas —solo llegan si el cliente usa el GPS o pega un link
   del mapa; eligiendo una sugerencia NO llegan—, así que el texto
   es el camino normal, no la excepción.

   Y Google, buscando «Ocotlán, Jalisco», devuelve como segunda
   sugerencia:

       «Ocotlan, Jalisco I Sección, Tonalá, Jalisco, México»

   que es una CALLE en Tonalá, a diez minutos del centro de
   Guadalajara. Por texto entraba al recargo, y a ese cliente se le
   habrían cobrado hasta $6,000 de más.

   Sobrecobrar a alguien de Guadalajara es peor que no cobrarle a
   alguien de Ocotlán: el primero se entera y se va.

   Nombrar un municipio metropolitano gana siempre. Las coordenadas,
   cuando llegan, ganan sobre todo lo demás.
   -------------------------------------------------------------- */
/* OJO CON `\b` Y LOS ACENTOS: en JavaScript `\w` es solo [A-Za-z0-9_], así
   que la `á` NO cuenta como letra. En «Tonalá,» el `\b` del final se pide
   entre `á` y `,` —dos no-letras— y NO hay frontera: la coincidencia falla
   justo en la forma acentuada, que es la que escribe Google.

   Esto se cazó a la primera corrida y por eso está escrito: son lookarounds
   con la lista de letras de verdad, no `\b`. */
const LETRA = 'a-záéíóúüñ';
const AREA_METROPOLITANA = new RegExp(
  '(?<![' + LETRA + '])(guadalajara|zapopan|tlaquepaque|tonal[aá]|tlajomulco|' +
  'el\\s+salto|zapotlanejo|juanacatl[aá]n|ixtlahuac[aá]n)(?![' + LETRA + '])', 'i');

const ORIGENES = [
  {
    nombre: 'Ocotlán',
    /* Fila 11 del Excel, «SPRINTER OCOTLAN». Leída el 28-ago-2026. */
    fila: 11,

    /* Ocotlán, Jalisco. El radio alcanza la ribera este del lago: mismo rumbo
       y misma distancia, así que el desvío es prácticamente el mismo. */
    lat: 20.3529, lng: -102.7745, radioKm: 25,

    /* --------------------------------------------------------
       LOS PUEBLOS VAN CON SUS COORDENADAS, NO SUELTOS

       Cuando el cliente escribe la dirección a mano no llegan
       coordenadas —la página manda lat y lng en null—, así que
       hace falta reconocerlo por el texto. Y ahí estuvo un
       defecto que duró lo que tardé en medirlo:

       la lista de nombres y el radio decían cosas distintas.
       Atotonilco el Alto está a 35 km y el texto lo aceptaba;
       Zapotlán del Rey y Tototlán están a 18 y 21 km y el texto
       los rechazaba. O sea que el MISMO cliente pagaba distinto
       según si Google le devolvió coordenadas o no.

       Por eso cada pueblo va con su punto y el buscador de texto
       se arma de esta lista: no hay dos verdades que puedan
       separarse. `probar-origenes.cjs` mide cada uno contra el
       radio, así que un pueblo agregado a ojo se pone rojo.
       -------------------------------------------------------- */
    pueblos: [
      { n: 'Ocotlán',           busca: /ocotl[aá]n/i,        lat: 20.3529, lng: -102.7745 },
      { n: 'Jamay',             busca: /jamay/i,             lat: 20.2939, lng: -102.7086 },
      { n: 'Poncitlán',         busca: /poncitl[aá]n/i,      lat: 20.3833, lng: -102.9167 },
      { n: 'Zapotlán del Rey',  busca: /zapotl[aá]n\s+del\s+rey/i, lat: 20.4667, lng: -102.9000 },
      { n: 'Tototlán',          busca: /tototl[aá]n/i,       lat: 20.5453, lng: -102.7975 },
      { n: 'La Barca',          busca: /la\s+barca/i,        lat: 20.2917, lng: -102.5528 }
    ],

    /* Pide Jalisco a propósito: hay otro Ocotlán en Oaxaca, y otro Zapotlán
       —el Grande, Ciudad Guzmán— que no es este. */
    enSuEstado: /\bjal(isco)?\b/i,

    /* --------------------------------------------------------
       LO QUE SUBE, DESTINO POR DESTINO

       Cero NO es lo mismo que ausente, aunque hoy cobren igual:
       cero es «el dueño dijo que no sube» y ausente es «no viene en
       su Excel». Los dos dan precio de Guadalajara, pero el ausente
       está esperando su número y el cero ya lo tiene. Cuando él
       dicte los que faltan, la diferencia importa.
       -------------------------------------------------------- */
    recargo: {
      /* No suben: Ocotlán queda de camino */
      'Ciudad de México': 0,
      'Puebla': 0,
      'Puebla con Zacatlán': 0,
      'Tlalpujahua': 0,
      'Grutas Tolantongo': 0,
      'Ixtapa Zihuatanejo': 0,
      'Camécuaro / Zamora': 0,
      'Chiapas': 0,
      'Oaxaca': 0,
      'Cancún': 0,
      'Acapulco': 0,
      'Valle de Bravo / Nevado de Toluca': 0,
      'Pátzcuaro / Uruapan': 0,
      'Santuario de la Mariposa Monarca': 0,
      'Mariposa / Azufres / Pátzcuaro': 0,

      /* Baja: Morelia queda más cerca desde Ocotlán. Es el único de los 49. */
      'Morelia': -500,

      /* --------------------------------------------------------
         TRES QUE NO VIENEN EN SU EXCEL Y DICTO APARTE

         El dueño los vio en la hoja de 50 viajes del 28-ago-2026 y
         marcó dos: «estos dos muy caros, deben ser mínimo 9,000»
         —Tala y Zacoalco, los dos en $6,000 a dos días—. Y luego:
         «sube el 3000 también», o sea que a Cocula, que estaba
         justo debajo y al mismo rumbo, le toca lo mismo.

         Los tres quedan al PONIENTE de Guadalajara, así que desde
         Ocotlán son desvío igual que Tequila o Chapala. Con los
         $3,000, los dos que marcó dan los $9,000 que pidió.
         -------------------------------------------------------- */
      'Tala': 3000,
      'Zacoalco de Torres': 3000,
      'Cocula': 3000,

      /* Suben */
      'San Juan de los Lagos': 2000,
      'San Miguel de Allende': 2000,
      'El Manto': 3000,
      'Mazamitla': 3500,
      'Tapalpa': 3500,
      'Talpa Burrita (peregrinación)': 3500,
      'Mayto': 3500,
      'Real de Catorce': 4000,
      'Tenacatita': 4000,
      'Zacatecas': 4000,
      'Chapala': 4500,
      /* R28 · «San Juan Cosalá y Chapala deberían ser lo mismo, literal
         están a 10 minutos» (1-sep-2026). El ancla de R11 no se queda en
         el precio base: arrastra también el recargo de salida. Antes
         heredaba el precio y no el recargo, y esa inconsistencia era mía
         —Magdalena sí heredaba el de Tequila—. */
      'San Juan Cosalá (ribera de Chapala)': 4500,
      'Punta Perula': 4500,
      'Rincón de Guayabitos': 4500,
      'Tequila / Guachimontones': 5000,
      'Barrancas del Cobre': 5000,
      'Manzanillo': 5000,
      'Chacala': 5500,
      'Puerto Vallarta y alrededores': 6000,
      'Mismaloya': 6000,
      'Sayulita / San Pancho': 6000,
      'Mazatlán': 6000,
      'Melaque / Barra de Navidad': 6000,

      /* --------------------------------------------------------
         TRES DONDE EL RECARGO CAMBIA CON LOS DIAS

         El Excel les da dos columnas con dos recargos distintos, y
         no se puede elegir uno sin tirar el otro:

           Huasteca    3 días +$4,000  ·  4 días +$2,000
           Talpa       1 día  +$4,500  ·  2 días +$4,000
           Guanajuato  1 día  +$3,000  ·  3 días +$3,500

         Para los días que él NO escribió se usa el dictado más
         cercano. Es lo que menos inventa, pero es una elección
         mía y está anotada en el criterio para preguntársela.

         El de la Huasteca además huele raro y hay que
         confirmarlo: desde Ocotlán, 3 días cuestan $42,500, que
         es EXACTAMENTE lo que cuestan 4 días desde Guadalajara.
         -------------------------------------------------------- */
      'Huasteca Potosina': { porDias: { 3: 4000, 4: 2000 } },
      'Talpa de Allende': { porDias: { 1: 4500, 2: 4000 } },
      'Guanajuato': { porDias: { 1: 3000, 3: 3500 } }
    }
  },

  {
    nombre: 'Yurécuaro',
    /* Fila 22 del Excel, «YUCUARO SPRINTER». Leída el 29-ago-2026. */
    fila: 22,

    /* Yurécuaro, Michoacán. RADIO DE 22, no de 25: Ocotlán está a 51.2 km,
       así que con 25 los dos círculos quedarían a 1.2 km de tocarse. Con 22
       hay 4.2 km de aire, y de todos modos `buscaOrigen` se queda con el más
       cercano si algún día se encimaran. */
    lat: 20.3389, lng: -102.2836, radioKm: 22,

    pueblos: [
      { n: 'Yurécuaro',              busca: /yur[eé]cuaro/i,          lat: 20.3389, lng: -102.2836 },
      { n: 'Tanhuato',               busca: /tanhuato/i,              lat: 20.2911, lng: -102.3350 },
      { n: 'Degollado',              busca: /degollado/i,             lat: 20.4592, lng: -102.1811 },
      { n: 'Vista Hermosa',          busca: /vista\s+hermosa/i,       lat: 20.2833, lng: -102.4667 },
      { n: 'Ixtlán de los Hervores', busca: /ixtl[aá]n\s+de\s+los\s+hervores/i, lat: 20.1919, lng: -102.4058 }
    ],

    /* Degollado es de Jalisco y los otros cuatro de Michoacán, así que aquí
       el guardia acepta los dos estados. La lista de pueblos es la que
       decide; esto solo evita confundir un pueblo del mismo nombre en otro
       lado del país. */
    enSuEstado: /\b(mich(oac[aá]n)?|jal(isco)?)\b/i,

    /* --------------------------------------------------------
       LA FILA 22, TAL CUAL

       33 de sus 49 columnas traen número. Las 16 vacías no se
       inventan: pagan precio de Guadalajara hasta que él las
       dicte.

       Yurécuaro está MAS al oriente que Ocotlán, y por eso sus
       recargos al poniente son mayores —Chapala +$10,000 contra
       los +$4,500 de Ocotlán— y en cambio Tolantongo e Ixtapa le
       salen MAS BARATOS que desde Guadalajara: le quedan de
       camino. Eso confirma el criterio del dueño por segunda vez,
       ahora con un origen distinto.
       -------------------------------------------------------- */
    recargo: {
      /* No suben: quedan de camino */
      'Ciudad de México': 0,
      'Camécuaro / Zamora': 0,

      /* BAJAN: Yurécuaro está de camino y más cerca */
      'Grutas Tolantongo': -6500,
      'Ixtapa Zihuatanejo': -3000,

      /* Suben */
      'Guanajuato': { porDias: { 1: 6000, 3: 2000 } },
      'San Miguel de Allende': 2500,
      'Zacatecas': 3500,
      'Mazatlán': 4000,
      'El Manto': 4000,
      'Tlalpujahua': 4000,
      'Melaque / Barra de Navidad': 4500,
      'Mayto': 5500,
      'Chacala': 6000,
      'Punta Perula': 6000,
      'Mazamitla': 7000,
      'Tapalpa': 7000,
      'Rincón de Guayabitos': 7500,
      'Sayulita / San Pancho': 8000,
      'Huasteca Potosina': 8000,
      'Talpa Burrita (peregrinación)': 8500,
      'Puerto Vallarta y alrededores': 9000,
      'Mismaloya': 9000,
      'Chapala': 10000,
      'San Juan Cosalá (ribera de Chapala)': 10000,   // R28, igual que Chapala
      'Tequila / Guachimontones': 10000,
      'Barrancas del Cobre': 10000,
      'Talpa de Allende': 10000,
      'Real de Catorce': 10500,

      /* --------------------------------------------------------
         PUEBLA: SU NUMERO, PERO HAY QUE CONFIRMARLO

         +$12,000 es el recargo más alto de toda la fila, y es el
         ÚNICO renglón donde el patrón geográfico se invierte:
         desde Ocotlán Puebla dice «MISMO COSTO GDL», y Yurécuaro
         queda todavía MAS de camino a Puebla que Ocotlán. Debería
         costar igual o menos, no doce mil más.

         Se implementa porque es su número y la magnitud es
         creíble —no como la de Chiapas, abajo—, pero está
         señalado en el criterio para preguntárselo.
         -------------------------------------------------------- */
      'Puebla': 12000

      /* --------------------------------------------------------
         CHIAPAS NO ENTRA, Y ES A PROPOSITO

         Su celda dice $16,500 cuando desde Guadalajara son
         $85,000: un recargo de MENOS $68,500 en un viaje de ocho
         días. Está sola entre celdas vacías y tiene toda la pinta
         de un número que cayó en la columna equivocada.

         Implementarla le costaría $68,500 en el primer cliente de
         Yurécuaro que pidiera Chiapas. Al quedar fuera, ese viaje
         cobra los $85,000 de Guadalajara, que es lo prudente
         mientras él no lo confirme. Señalado, no inventado (R12).
         -------------------------------------------------------- */
    }
  }
];

function lejosEnKm(lat1, lng1, lat2, lng2) {
  const r = Math.PI / 180, RADIO = 6371;
  const dLat = (lat2 - lat1) * r, dLng = (lng2 - lng1) * r;
  const s = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * r) * Math.cos(lat2 * r) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  return 2 * RADIO * Math.asin(Math.sqrt(s));
}

/* Un número de verdad. `Number(null)` da 0, y 0 es una coordenada válida
   —el Golfo de Guinea—: el mismo defecto que ya se pagó en `_rutas.js`. */
function coordenada(v) {
  if (v === null || v === undefined || v === '' || typeof v === 'boolean') return NaN;
  const n = Number(v);
  return isFinite(n) ? n : NaN;
}

/* De qué origen conocido salió el viaje, o null.

   Las coordenadas MANDAN sobre el texto: si vienen y caen fuera del radio,
   el viaje no es de aquí aunque la dirección diga «Ocotlán» —hay otro en
   Oaxaca—. El texto solo decide cuando no hay coordenadas, que es el caso
   normal cuando el cliente escribe la dirección a mano. */
function buscaOrigen(origen) {
  if (!origen || typeof origen !== 'object') return null;
  const lat = coordenada(origen.lat), lng = coordenada(origen.lng);
  const hayPunto = !isNaN(lat) && !isNaN(lng);
  const texto = String(origen.direccion || origen.texto || origen.nombre || '');

  /* --------------------------------------------------------------
     GANA EL MAS CERCANO, NO EL PRIMERO DE LA LISTA

     Antes se devolvía el primero cuyo radio alcanzara, y eso hacía
     que el precio dependiera del ORDEN del arreglo —que es
     arbitrario—. Con un solo origen no se notaba; al entrar
     Yurécuaro sí: sus radios quedan a 1.2 km de tocarse, y un
     pueblo en medio le habría tocado a quien estuviera escrito
     primero, no a quien de verdad le queda cerca.

     Así, agregar un origen nuevo no puede cambiarle el precio a
     otro por accidente. `probar-origenes.cjs` lo exige. */
  if (hayPunto) {
    let mejor = null, mejorKm = Infinity;
    for (let i = 0; i < ORIGENES.length; i++) {
      const o = ORIGENES[i];
      const km = lejosEnKm(lat, lng, o.lat, o.lng);
      if (km <= o.radioKm && km < mejorKm) { mejor = o; mejorKm = km; }
    }
    return mejor;
  }

  /* Por texto no hay distancia que comparar: gana el pueblo que coincida.
     Los nombres son propios y no se repiten entre orígenes —hay una prueba
     que lo exige—, así que no puede haber empate. */
  if (!texto) return null;
  for (let i = 0; i < ORIGENES.length; i++) {
    const o = ORIGENES[i];
    if (!o.enSuEstado.test(texto)) continue;
    if (AREA_METROPOLITANA.test(texto)) continue;   // una calle de Tonalá no es Ocotlán
    for (let j = 0; j < o.pueblos.length; j++) {
      if (o.pueblos[j].busca.test(texto)) return o;
    }
  }
  return null;
}

/* El recargo que el dueño dictó para este origen y este destino.

   Devuelve null cuando no dictó nada —y entonces manda el respaldo por
   kilómetros—, y un número cuando sí, INCLUIDO el cero: «no sube» es una
   respuesta suya, no una ausencia. */
function recargoDictado(origen, nombreDestino, dias) {
  const o = buscaOrigen(origen);
  if (!o || !nombreDestino) return null;

  const r = o.recargo[nombreDestino];
  if (r === undefined) return null;
  if (typeof r === 'number') return r;

  if (r && r.porDias) {
    const pedidos = Math.max(1, Math.floor(Number(dias) || 1));
    if (r.porDias[pedidos] !== undefined) return r.porDias[pedidos];

    /* El dictado más cercano. Empatados, gana el de menos días: es el que él
       escribió para el viaje más corto, y no infla los largos. */
    const escritos = Object.keys(r.porDias).map(Number).sort(function (a, b) { return a - b; });
    let mejor = escritos[0];
    for (let i = 1; i < escritos.length; i++) {
      if (Math.abs(escritos[i] - pedidos) < Math.abs(mejor - pedidos)) mejor = escritos[i];
    }
    return r.porDias[mejor];
  }
  return null;
}

module.exports = { ORIGENES, buscaOrigen, recargoDictado, lejosEnKm };
