/* ============================================================
   El catalogo de la pagina contra la lista de precios
   ------------------------------------------------------------
       node pruebas/probar-destinos.cjs

   La pagina ofrece 79 destinos en su catalogo (lugares.js) y la
   lista de precios tiene 41 renglones. El cruce entre los dos NO
   es obvio: un destino se reconoce por el TEXTO de su direccion,
   y ese texto trae el nombre del estado y a veces el de una
   ciudad mas grande.

   POR QUE EXISTE ESTA PRUEBA

   Ese cruce se hizo a mano una vez y salio mal en SEIS destinos,
   todos del mismo tipo —el nombre del grande vive dentro de la
   direccion del chico— y cada uno costaba dinero de verdad:

     Mismaloya          caia en Vallarta        -$1,000
     San Miguel         caia en Guanajuato      -$7,500
     Zacatlan           caia en Puebla          -$3,000
     Puerto Escondido   caia en Oaxaca          regalaba 500 km
     Huatulco           caia en Oaxaca          regalaba 500 km
     Chihuahua (ciudad) caia en Barrancas       cobraba 450 km de mas

   Los tres primeros se atajaron poniendolos a probarse primero;
   los tres ultimos, apretando la regla del grande. Ninguno de los
   seis lo hubiera visto una prueba de casos sueltos: solo se ven
   recorriendo el catalogo COMPLETO y mirando en que renglon cae
   cada uno.

   Aqui abajo esta ese cruce, escrito a mano y anclado. Si alguien
   agrega un destino al catalogo o mueve una regla, esta prueba
   dice exactamente en que precio cambio de renglon.
   ============================================================ */
'use strict';
const fs = require('fs');
const path = require('path');
const destinos = require('../api/_destinos.js');
const tarifa = require('../api/_tarifa.js');

let buenas = 0, malas = 0;
function igual(nombre, dio, esperado) {
  const a = JSON.stringify(dio), b = JSON.stringify(esperado);
  if (a === b) { buenas++; console.log('ok   ' + nombre); }
  else { malas++; console.log('MAL  ' + nombre + '\n     dio      ' + a + '\n     esperaba ' + b); }
}

/* lugares.js corre en el navegador: se lee y se evalua con un `window` de
   mentiras. Asi la prueba usa el catalogo DE VERDAD y no una copia que se
   pueda quedar vieja. */
const fuente = fs.readFileSync(path.join(__dirname, '..', 'lugares.js'), 'utf8');
const ventana = { LUGARES: null };
new Function('window', fuente)(ventana);
const LUGARES = ventana.LUGARES;

/* La direccion tal como la arma el navegador en cotizacion.js -> puntoDe()
   cuando el destino viene del catalogo y no de una busqueda en Google:
       calle, colonia, nombre, estado, 'México'                            */
function direccionDe(l) { return [l.n, l.e, 'México'].filter(Boolean).join(', '); }

function renglonDe(l) {
  const d = destinos.buscaDestino({ direccion: direccionDe(l), placeId: l.id });
  return d ? d.nombre : null;
}

igual('el catalogo se pudo leer', LUGARES && LUGARES.length > 0, true);

/* ============================================================
   1. EL CRUCE COMPLETO, ANCLADO A MANO
   ------------------------------------------------------------
   Cada destino del catalogo con el renglon de la lista en el que
   cae. `null` significa que no esta en la lista y se cotiza por
   formula —o lo ve un asesor, si esta muy lejos—, que es una
   respuesta correcta y no un hueco.
   ============================================================ */
const CRUCE = {
  /* --- Jalisco: el area de Guadalajara no esta en la lista --- */
  'Guadalajara': null,
  'Zapopan': null,
  'San Pedro Tlaquepaque': null,
  'Tonalá': null,
  'Tlajomulco de Zúñiga': null,
  'El Salto': null,
  'Aeropuerto Internacional de Guadalajara (GDL)': null,
  'Central de Autobuses Nueva de Guadalajara': null,
  'Expo Guadalajara': null,
  'Estadio Akron': null,
  'Auditorio Telmex': null,

  /* --- los que si tienen precio cerrado --- */
  'Puerto Vallarta': 'Puerto Vallarta y alrededores',
  'Aeropuerto de Puerto Vallarta (PVR)': 'Puerto Vallarta y alrededores',
  'Nuevo Vallarta': 'Puerto Vallarta y alrededores',
  'Punta Mita': 'Puerto Vallarta y alrededores',
  'San Blas': 'Puerto Vallarta y alrededores',
  'Chapala': 'Chapala',
  'Ajijic': 'Chapala',
  'Tequila': 'Tequila / Guachimontones',
  'Mazamitla': 'Mazamitla',
  'Tapalpa': 'Tapalpa',
  'San Juan de los Lagos': 'San Juan de los Lagos',
  'Barra de Navidad': 'Melaque / Barra de Navidad',
  'San Patricio Melaque': 'Melaque / Barra de Navidad',
  'Manzanillo': 'Manzanillo',
  'Mazatlán': 'Mazatlán',
  'Tepic': 'Tepic',
  'Sayulita': 'Sayulita / San Pancho',
  'León': 'León',
  'Guanajuato': 'Guanajuato',
  'San Miguel de Allende': 'San Miguel de Allende',
  'Ciudad de México': 'Ciudad de México',
  'Aeropuerto de la Ciudad de México (MEX)': 'Ciudad de México',
  'Toluca': 'Valle de Bravo / Nevado de Toluca',
  'Valle de Bravo': 'Valle de Bravo / Nevado de Toluca',
  'Morelia': 'Morelia',
  'Pátzcuaro': 'Pátzcuaro / Uruapan',
  'Uruapan': 'Pátzcuaro / Uruapan',
  'Zamora': 'Camécuaro / Zamora',
  'Zacatecas': 'Zacatecas',
  'Real de Catorce': 'Real de Catorce',
  'Huasteca Potosina': 'Huasteca Potosina',
  'Barrancas del Cobre': 'Barrancas del Cobre',
  'Puebla': 'Puebla',
  'Cholula': 'Puebla',
  'Oaxaca de Juárez': 'Oaxaca',
  'Acapulco': 'Acapulco',
  'Ixtapa Zihuatanejo': 'Ixtapa Zihuatanejo',
  'Cancún': 'Cancún',
  'Playa del Carmen': 'Cancún',
  'Tulum': 'Cancún',
  'San Cristóbal de las Casas': 'Chiapas',
  'Palenque': 'Chiapas',

  /* --- los que van por formula o con asesor --- */
  'San Sebastián del Oeste': null,
  'Lagos de Moreno': null,
  'Ciudad Guzmán': null,
  'Autlán de Navarro': null,
  'Colima': null,
  'Comala': null,
  'Aguascalientes': null,
  'Querétaro': null,
  'Tequisquiapan': null,
  'Bernal': null,
  'Teotihuacán': null,
  'San Luis Potosí': null,
  'Monterrey': null,
  'Saltillo': null,
  'Torreón': null,
  'Durango': null,
  'Veracruz': null,
  'Taxco': null,
  'Cuernavaca': null,
  'Tepoztlán': null,
  'Mérida': null,
  'Chichén Itzá': null,

  /* --- LOS SEIS QUE CAIAN MAL, cada uno con su motivo --- */
  /* «Dolores Hidalgo, Guanajuato» caia en la capital, 90 km antes */
  'Dolores Hidalgo': null,
  /* «Puerto Escondido, Oaxaca» y «Huatulco, Oaxaca» caian en la capital,
     500 km antes: se regalaba medio viaje */
  'Puerto Escondido': null,
  'Huatulco': null,
  /* la ciudad de Chihuahua caia en Barrancas, 450 km despues: se cobraba de mas */
  'Chihuahua': null,
  /* Mismaloya, San Miguel y Zacatlan estan arriba, en su renglon correcto */
  'Mismaloya': undefined     // no esta en el catalogo; se prueba abajo por texto
};

(function () {
  const rotos = [], sinAnclar = [];
  LUGARES.forEach(function (l) {
    const dio = renglonDe(l);
    if (!Object.prototype.hasOwnProperty.call(CRUCE, l.n)) { sinAnclar.push(l.n); return; }
    if (CRUCE[l.n] === undefined) return;
    if (dio !== CRUCE[l.n]) rotos.push({ destino: l.n, cae: dio, deberia: CRUCE[l.n] });
  });

  console.log('(' + LUGARES.length + ' destinos del catalogo de la pagina)');
  igual('todos los del catalogo estan anclados en esta prueba', sinAnclar, []);
  igual('y cada uno cae en el renglon que le toca', rotos, []);
  if (rotos.length) console.log('   ' + JSON.stringify(rotos, null, 1));
})();

/* ============================================================
   2. LOS SEIS ERRORES, UNO POR UNO Y CON SU PRECIO
   ------------------------------------------------------------
   Arriba se ancla EN QUE RENGLON cae cada uno. Aqui se comprueba
   ademas CUANTO DINERO era la diferencia, que es lo que de
   verdad importaba.
   ============================================================ */
(function () {
  /* `dias` importa: varios destinos ya cobran segun la duracion, asi que sin
     decirlo se leen como un viaje de UN dia y devuelven otro numero. Por
     omision se piden a un dia, que es como estaba, y quien tenga paquete
     pasa el suyo. */
  function precio(direccion, dias) {
    return tarifa.trasladoDe(999, { direccion: direccion }, null, dias || 1).total;
  }
  function pideAsesor(direccion, km) {
    return !!tarifa.trasladoDe(km, { direccion: direccion }).requiereAsesor;
  }

  /* -- los tres que caian en el precio de una CIUDAD mas grande -- */
  igual('Mismaloya cobra sus 20,000 y no los 19,000 de Vallarta',
    precio('Mismaloya, Puerto Vallarta, Jalisco, México'), 20000);
  igual('San Miguel cobra sus 26,500 y no los 19,000 de Guanajuato',
    precio('San Miguel de Allende, Guanajuato, México'), 26500);
  igual('Zacatlán cobra sus 39,500 y no los 36,500 de Puebla',
    precio('Zacatlán, Puebla, México'), 39500);

  /* -- los tres que caian en el precio de su ESTADO -- */
  igual('Dolores Hidalgo ya no cobra los 19,000 de Guanajuato',
    precio('Dolores Hidalgo, Guanajuato, México') === 19000, false);
  /* CAMBIO DE LADO el 26-ago-2026: antes estos tres pedian asesor porque
     arriba de 1,400 km no se cotizaba. El dueño quito el asesor, asi que
     ahora los cotiza el tramo largo. Lo que importa sigue igual y por eso
     se prueba asi: que NO cobren el precio de la capital de su estado. */
  igual('Puerto Escondido NO cobra los 75,000 de Oaxaca',
    precio('Puerto Escondido, Oaxaca, México') === 75000, false);
  igual('Huatulco tampoco',
    precio('Huatulco, Oaxaca, México') === 75000, false);
  igual('y la ciudad de Chihuahua no cobra los 75,000 de Barrancas',
    precio('Chihuahua, Chihuahua, México') === 75000, false);

  /* -- y los grandes siguen cobrando lo suyo -- */
  igual('Vallarta sigue en 19,000', precio('Puerto Vallarta, Jalisco, México'), 19000);
  igual('Guanajuato sigue en 19,000', precio('Guanajuato, Guanajuato, México'), 19000);
  igual('Puebla sigue en 36,500', precio('Puebla, Puebla, México'), 36500);
  igual('Oaxaca sigue en 75,000', precio('Oaxaca de Juárez, Oaxaca, México'), 75000);
  /* Barrancas se pide a sus 4 dias: su precio depende de la duracion desde
     que el dueño le dicto el dia de 3,000 (26-ago-2026). */
  igual('Barrancas sigue en 75,000', precio('Barrancas del Cobre, Chihuahua, México', 4), 75000);
})();

/* ============================================================
   3. LA TABLA, POR DENTRO
   ============================================================ */
(function () {
  /* Ningun renglon puede quedarse sin precio de sprinter: es la unica unidad
     que hoy cotiza en linea, y sin ella el destino se iria a la formula sin
     que nadie se entere. */
  const sinSprinter = destinos.DESTINOS
    .filter(function (d) { return typeof d.precio.sprinter !== 'number'; })
    .map(function (d) { return d.nombre; });
  igual('los 41 renglones traen precio de sprinter', sinSprinter, []);

  /* Ningun precio absurdo. El Excel traia el Marcopolo de Barrancas en
     $1,300,000 —un cero de mas— y nadie lo hubiera visto hasta cobrarlo. */
  const absurdos = [];
  destinos.DESTINOS.forEach(function (d) {
    Object.keys(d.precio).forEach(function (u) {
      const p = d.precio[u];
      if (p < 5000 || p > 250000) absurdos.push({ destino: d.nombre, unidad: u, precio: p });
    });
  });
  igual('ningun precio de la tabla se sale del rango razonable', absurdos, []);

  /* Nombres repetidos: dos renglones con el mismo nombre significan que uno
     de los dos nunca se alcanza. */
  const vistos = {}, repetidos = [];
  destinos.DESTINOS.forEach(function (d) {
    if (vistos[d.nombre]) repetidos.push(d.nombre);
    vistos[d.nombre] = true;
  });
  igual('ningun renglon repetido', repetidos, []);

  /* Sin destino, sin direccion o con basura: nunca revienta ni inventa */
  igual('sin destino no hay precio de lista', destinos.precioDeLista(null, 'sprinter'), null);
  igual('sin direccion tampoco', destinos.precioDeLista({ placeId: 'x' }, 'sprinter'), null);
  igual('una unidad que no existe tampoco',
    destinos.precioDeLista({ direccion: 'Chapala, Jalisco' }, 'submarino'), null);
  igual('sin decir unidad, se asume sprinter',
    destinos.precioDeLista({ direccion: 'Chapala, Jalisco' }).precio, 6500);
})();

console.log('\n' + buenas + ' buenas, ' + malas + ' malas');
process.exit(malas ? 1 : 0);
