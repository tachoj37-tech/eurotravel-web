/* ============================================================
   Fase 1 · La página no da un precio que no salió del criterio
   ------------------------------------------------------------
       node pruebas/probar-solo-del-criterio.cjs

   EL DICTADO DEL DUEÑO, en sus palabras:

     «No me gustaría que el cotizador pueda cotizar si el cotizador
      NO tiene el precio desde el criterio de precios.»

   Hasta hoy, un destino que no estaba en la lista se cotizaba con
   la fórmula por kilómetros: `BASE_TRASLADO + POR_KM × km`. Es un
   número que no salió del Excel de nadie, y es exactamente el que
   él no quiere que se le dé a un cliente.

   LA FÓRMULA NO SE BORRA. Sigue viva para el bot de WhatsApp y
   para la pantalla del dueño (`pendiente/prueba-cotizador-api.js`),
   donde sirve para estimar. Lo que cambia es que las DOS PUERTAS
   PÚBLICAS —`/api/cotizar` y `/api/pagar`— piden `soloDelCriterio`
   y con eso la apagan.

   QUÉ CUIDA ESTA PRUEBA, en orden de gravedad:

     1. Los 50 destinos de la lista siguen dando EXACTAMENTE el
        mismo número que daban antes del cambio, uno por uno y en
        cuatro duraciones. Si alguno se mueve un peso, se caza aquí.
     2. Fuera de la lista, por la puerta pública, NO sale número.
     3. La fórmula sigue viva para quien no pide `soloDelCriterio`.
     4. Las dos puertas públicas lo piden de verdad.
     5. El cliente NO lo puede apagar mandándolo en el cuerpo.
   ============================================================ */
'use strict';

const fs = require('fs');
const path = require('path');
const tarifa = require('../api/_tarifa.js');
const destinos = require('../api/_destinos.js');
const nucleo = require('../api/_cotiza-nucleo.js');

const RAIZ = path.join(__dirname, '..');

let buenas = 0, malas = 0;
function igual(nombre, dio, esperado) {
  const a = JSON.stringify(dio), b = JSON.stringify(esperado);
  if (a === b) { buenas++; console.log('ok   ' + nombre); }
  else { malas++; console.log('MAL  ' + nombre + '\n     dio      ' + a + '\n     esperaba ' + b); }
}

/* Un viaje cualquiera, saliendo de Guadalajara un lunes —para que no se
   cruce con el dominical, que es otro producto— y sin movimientos. Lo que
   se mide es el precio del destino, así que todo lo demás se deja quieto. */
function precioDe(texto, dias, opciones) {
  const p = tarifa.calcula(0, dias, Object.assign({
    noches: Math.max(0, dias - 1),
    destino: { texto: texto },
    origen: 'Guadalajara, Jalisco',
    redondo: true,
    salida: '2026-09-21T08:00'          // lunes
  }, opciones || {}));
  return p.requiereAsesor ? 'ASESOR' : p.total;
}

/* ------------------------------------------------------------
   1 · LOS 50 DESTINOS, CONGELADOS
   ------------------------------------------------------------
   Medidos el 12-sep-2026, ANTES de tocar nada, con el cotizador
   como estaba. Son cuatro duraciones por destino —1, 2, 4 y 8
   días— porque el criterio (R1) da precio por destino Y duración:
   un destino puede quedarse quieto en dos días y moverse en ocho.

   Dos renglones se piden con un texto distinto de su nombre
   —«Magdalena, Jalisco» y «Zirahuén, Michoacán»— porque su nombre
   en el catálogo trae el de OTRO destino entre paréntesis
   («Magdalena (pasando Tequila)») y la búsqueda, que trabaja sobre
   el texto de la dirección, se iría al renglón de junto. El cliente
   nunca escribe el nombre del catálogo; escribe el de la ciudad.

   SI UNA DE ESTAS FILAS SE PONE ROJA, no se ajusta el número de
   aquí: se averigua qué lo movió. Este archivo es la foto del
   antes, y su valor entero está en no retocarla.
   ------------------------------------------------------------ */
const DURACIONES = [1, 2, 4, 8];
const CONGELADOS = [
  ["San Juan Cosalá (ribera de Chapala)", [6500, 6500, 6500, 10500]],
  ["Chapala", [6500, 6500, 6500, 10500]],
  ["Tala", [6000, 6000, 6000, 10000]],
  ["Zacoalco de Torres", [6000, 6000, 6000, 10000]],
  ["Cocula", [6500, 6500, 6500, 10500]],
  ["Tequila / Guachimontones", [7000, 7000, 7000, 11000]],
  ["Magdalena, Jalisco", [7500, 7500, 7500, 11500]],
  ["Tapalpa", [14500, 14500, 14500, 18500]],
  ["Mazamitla", [14500, 14500, 14500, 18500]],
  ["San Juan de los Lagos", [14000, 14000, 14000, 18000]],
  ["Camécuaro / Zamora", [14500, 14500, 14500, 18500]],
  ["El Manto", [14000, 15500, 20500, 26500]],
  ["Talpa Burrita (peregrinación)", [26500, 26500, 26500, 30500]],
  ["Talpa de Allende", [15000, 16500, 19500, 25500]],
  ["Monterrey", [49200, 49200, 49200, 53200]],
  ["Tepic", [16900, 16900, 16900, 20900]],
  ["León", [17600, 17600, 17600, 21600]],
  ["Rincón de Guayabitos", [18500, 18500, 18500, 22500]],
  ["Chacala", [16500, 16500, 16500, 20500]],
  ["Sayulita / San Pancho", [18000, 18000, 18000, 22000]],
  ["Guanajuato", [19000, 20500, 26000, 32000]],
  ["Manzanillo", [18500, 18500, 18500, 22500]],
  ["Morelia", [19000, 19000, 19000, 23000]],
  ["Puerto Vallarta y alrededores", [19000, 19000, 19000, 23000]],
  ["Punta Perula", [20500, 20500, 20500, 24500]],
  ["Mismaloya", [20000, 20000, 20000, 24000]],
  ["Mariposa / Azufres / Pátzcuaro", [29000, 29000, 29000, 33000]],
  ["Pátzcuaro / Uruapan", [25000, 25000, 25000, 29000]],
  ["Zirahuén, Michoacán", [23000, 23000, 23000, 27000]],
  ["San Miguel de Allende", [26500, 26500, 26500, 30500]],
  ["Melaque / Barra de Navidad", [20500, 20500, 20500, 24500]],
  ["Zacatecas", [25000, 25000, 25000, 29000]],
  ["Tlalpujahua", [23500, 26500, 29500, 35500]],
  ["Tenacatita", [20000, 20000, 20000, 24000]],
  ["Santuario de la Mariposa Monarca", [23000, 23000, 23000, 27000]],
  ["Mayto", [26500, 26500, 26500, 30500]],
  ["Mazatlán", [28000, 28000, 28000, 32000]],
  ["Valle de Bravo / Nevado de Toluca", [32000, 32000, 32000, 36000]],
  ["Ixtapa Zihuatanejo", [29500, 29500, 29500, 33500]],
  ["Ciudad de México", [23000, 24000, 26000, 30000]],
  ["Grutas Tolantongo", [29500, 29500, 30500, 34500]],
  ["Real de Catorce", [34500, 34500, 34500, 38500]],
  ["Huasteca Potosina", [27500, 28500, 30500, 34500]],
  ["Puebla", [36500, 36500, 38500, 42500]],
  ["Puebla con Zacatlán", [39500, 39500, 43500, 51500]],
  ["Acapulco", [48000, 52000, 60000, 76000]],
  ["Oaxaca", [75000, 75000, 75000, 79000]],
  ["Chiapas", [57000, 61000, 69000, 85000]],
  ["Barrancas del Cobre", [57000, 60000, 66000, 78000]],
  ["Cancún", [81000, 85000, 93000, 109000]]
];

igual('la foto trae los 50 destinos de la lista', CONGELADOS.length, 50);

/* La lista no puede encogerse sin que alguien se entere: si un renglón se
   borra del catálogo, la tabla de arriba se quedaría probando 50 destinos
   que ya no son los del negocio. */
igual('y el catálogo sigue teniendo esos 50 con precio de Sprinter',
  destinos.DESTINOS.filter(function (d) { return typeof d.precio.sprinter === 'number'; }).length,
  50);

CONGELADOS.forEach(function (fila) {
  const texto = fila[0], esperados = fila[1];
  /* CON la regla nueva encendida, que es como los va a pedir la página. */
  igual(texto + ': mismo precio que antes',
    DURACIONES.map(function (d) { return precioDe(texto, d, { soloDelCriterio: true }); }),
    esperados);
});

/* Y sin la regla dan lo mismo, porque son de lista: la regla nueva no toca
   a los que ya tenían precio del criterio. Si esto se pusiera rojo, querría
   decir que la regla se está comiendo precios que sí existen. */
CONGELADOS.forEach(function (fila) {
  igual(fila[0] + ': la regla no le cambia nada',
    DURACIONES.map(function (d) { return precioDe(fila[0], d); }),
    fila[1]);
});

/* ------------------------------------------------------------
   2 · FUERA DE LA LISTA NO SALE NÚMERO
   ------------------------------------------------------------
   Éste es el hueco que cierra la fase 1. Los tres son lugares
   reales, cerca —para que caigan dentro del tope de kilómetros y
   la fórmula sí los hubiera cotizado—, y ninguno está en el Excel.
   ------------------------------------------------------------ */
const FUERA = ['Colima, Colima', 'Aguascalientes, Aguascalientes', 'Querétaro, Querétaro'];

FUERA.forEach(function (texto) {
  igual(texto + ' NO está en la lista de precios',
    destinos.precioDeLista({ texto: texto }, 'sprinter'), null);
  igual(texto + ': por la puerta pública no da precio',
    precioDe(texto, 2, { soloDelCriterio: true }), 'ASESOR');
});

/* Un viaje sin precio viene con TODOS los montos en cero, no con algunos.
   Si el traslado se apagara pero las noches y los movimientos se siguieran
   sumando, la pantalla pintaría un número que no es el del viaje —es el
   error que ya costó una vez y está escrito en `calcula`—. */
{
  const p = tarifa.calcula(0, 4, {
    noches: 3, destino: { texto: 'Colima, Colima' }, origen: 'Guadalajara, Jalisco',
    redondo: true, salida: '2026-09-21T08:00', soloDelCriterio: true,
    movimientos: [{ fecha: '2026-09-22', horaInicio: '09:00', horaFin: '18:00' }]
  });
  igual('sin precio, todo viene en cero',
    [p.requiereAsesor, p.total, p.anticipo, p.saldo, p.subtotal, p.desglose.servicio,
      p.desglose.importeMovimientos],
    [true, 0, 0, 0, 0, 0, 0]);
}

/* ------------------------------------------------------------
   3 · LA FÓRMULA SIGUE VIVA PARA QUIEN SÍ LA PUEDE USAR
   ------------------------------------------------------------
   El bot la usa para estimar y la pantalla del dueño para revisar
   de dónde sale un costo. Apagarla del todo sería borrar una
   herramienta suya, no cerrar un hueco.
   ------------------------------------------------------------ */
FUERA.forEach(function (texto) {
  const conFormula = precioDe(texto, 2);
  igual(texto + ': sin la regla, la fórmula sigue dando número',
    typeof conFormula === 'number' && conFormula > 0, true);
});

/* ------------------------------------------------------------
   4 · LAS DOS PUERTAS PÚBLICAS LA PIDEN
   ------------------------------------------------------------
   Se lee el código, no se supone. Si alguien quita la línea, la
   página vuelve a cotizar por fórmula y nada más truena: el
   cliente vería un precio de más o de menos y no habría señal.

   `/api/pagar` va aquí junto con `/api/cotizar` porque también es
   pública y ahí es donde se compromete el dinero. Si solo se
   cerrara la de cotizar, una petición armada a mano podría apartar
   un viaje a precio de fórmula — y con folio y contrato de por
   medio.
   ------------------------------------------------------------ */
['api/cotizar.js', 'api/pagar.js'].forEach(function (archivo) {
  const codigo = fs.readFileSync(path.join(RAIZ, archivo), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')      // los comentarios no son código
    .replace(/\/\/[^\n]*/g, ' ');
  igual(archivo + ' pide soloDelCriterio',
    /soloDelCriterio\s*:\s*true/.test(codigo), true);
});

/* El bot y la pantalla del dueño NO la piden, que es el punto de que la
   fórmula siga existiendo. Si un día alguien se las pone «por consistencia»,
   esto lo dice en voz alta antes de que el dueño se quede sin estimar. */
['api/whatsapp.mjs', 'pendiente/prueba-cotizador-api.js'].forEach(function (archivo) {
  const ruta = path.join(RAIZ, archivo);
  if (!fs.existsSync(ruta)) return;        // `pendiente/` se borra al lanzar
  igual(archivo + ' NO la pide —ahí la fórmula sirve—',
    /soloDelCriterio/.test(fs.readFileSync(ruta, 'utf8')), false);
});

/* ------------------------------------------------------------
   5 · EL CLIENTE NO LA PUEDE APAGAR
   ------------------------------------------------------------
   El cuerpo de la petición lo escribe el navegador, y el navegador
   es del cliente. Si `soloDelCriterio` se leyera de ahí, bastaría
   mandar `false` para que la página volviera a cotizar por
   fórmula: el freno estaría del lado de quien lo quiere brincar.

   Por eso es un argumento aparte de `cotiza()`, que solo pone
   quien llama desde el servidor.
   ------------------------------------------------------------ */
(async function () {
  const cuerpoTramposo = {
    origen: { direccion: 'Guadalajara, Jalisco' },
    destino: { direccion: 'Colima, Colima' },
    salida: '2026-09-21T08:00',
    regreso: '2026-09-22T18:00',
    unidad: 'sprinter',
    soloDelCriterio: false            // lo que mandaría quien quiere el precio viejo
  };

  const r = await nucleo.cotiza(cuerpoTramposo, null, { soloDelCriterio: true });
  igual('mandar soloDelCriterio:false en el cuerpo no revive la fórmula',
    [r.ok, r.precio && r.precio.requiereAsesor, r.precio && r.precio.total],
    [true, true, 0]);

  /* Y sin llave de Google tampoco se cae: un destino fuera de la lista ya
     no necesita medirse, porque no va a haber precio que dar de todos modos.
     Antes contestaba 503 «Cotizador en línea no configurado» y el cliente
     veía un error donde debía ver «te contacta un vendedor». De paso, la
     página deja de pagarle a Google dos mediciones que se iban a tirar. */
  const sinLlave = await nucleo.cotiza({
    origen: { direccion: 'Guadalajara, Jalisco' }, destino: { direccion: 'Colima, Colima' },
    salida: '2026-09-21T08:00', regreso: '2026-09-22T18:00', unidad: 'sprinter'
  }, null, { soloDelCriterio: true });
  igual('sin llave de Google, un destino de fuera contesta «te contactamos», no un error',
    [sinLlave.ok, sinLlave.precio && sinLlave.precio.requiereAsesor],
    [true, true]);

  /* Y uno de la lista sigue cotizando sin llave, como siempre: su precio es
     cerrado y los kilómetros no mueven un peso. */
  const deLista = await nucleo.cotiza({
    origen: { direccion: 'Guadalajara, Jalisco' }, destino: { direccion: 'Puerto Vallarta, Jalisco' },
    salida: '2026-09-21T08:00', regreso: '2026-09-22T18:00', unidad: 'sprinter'
  }, null, { soloDelCriterio: true });
  igual('Vallarta sigue dando sus $19,000 por la puerta pública',
    [deLista.ok, deLista.precio && deLista.precio.total], [true, 19000]);
  /* 17-sep-2026: el renglón del criterio (Excel, noches) es para el ticket
     del vendedor y solo sale con `conCriterio`, que la página nunca manda. */
  igual('  y por la puerta pública NO viene el desglose del criterio ni nada interno',
    [('criterio' in deLista.precio), ('interno' in deLista.precio)], [false, false]);
  const conCriterio = await nucleo.cotiza({
    origen: { direccion: 'Guadalajara, Jalisco' }, destino: { direccion: 'Puerto Vallarta, Jalisco' },
    salida: '2026-09-21T08:00', regreso: '2026-09-22T18:00', unidad: 'sprinter'
  }, null, { soloDelCriterio: true, conCriterio: true });
  igual('  con conCriterio (solo el ticket) viene el Excel y las noches, sin kilómetros ni tarifa',
    [conCriterio.precio.criterio && conCriterio.precio.criterio.destinoDeLista, conCriterio.precio.criterio && conCriterio.precio.criterio.traslado,
      conCriterio.precio.criterio && conCriterio.precio.criterio.nochesIncluidas, 'km' in (conCriterio.precio.criterio || {}), 'tarifaKm' in (conCriterio.precio.criterio || {}), 'interno' in conCriterio.precio],
    ['Puerto Vallarta y alrededores', 19000, 3, false, false, false]);

  /* ------------------------------------------------------------
     6 · LO QUE NO SE PUEDE ROMPER DE PASO
     ------------------------------------------------------------
     El dominical es un producto aparte, con su propio renglón en el
     Excel: también sale del criterio, así que la regla nueva no lo
     puede apagar. Se comprueba porque el bloque que lo resuelve va
     ANTES en el mismo lugar donde se metió la regla.
     ------------------------------------------------------------ */
  const domingo = tarifa.calcula(0, 1, {
    noches: 0, destino: { texto: 'Puerto Vallarta, Jalisco' },
    origen: 'Guadalajara, Jalisco', redondo: true,
    salida: '2026-09-20T08:00',       // domingo
    soloDelCriterio: true
  });
  igual('el dominical sigue saliendo con la regla encendida',
    [domingo.requiereAsesor, domingo.total > 0], [false, true]);

  /* Y la unidad que no se cotiza sola se sigue rechazando antes que nada:
     ese freno es de otra regla y no lo puede tapar el nuevo. */
  const camion = await nucleo.cotiza({
    origen: { direccion: 'Guadalajara, Jalisco' }, destino: { direccion: 'Puerto Vallarta, Jalisco' },
    salida: '2026-09-21T08:00', regreso: '2026-09-22T18:00', unidad: 'irizar-i6s'
  }, null, { soloDelCriterio: true });
  igual('un camión sigue dando 422 «unidad no cotizable»',
    [camion.ok, camion.status, camion.error], [false, 422, 'unidad no cotizable']);

  /* ------------------------------------------------------------
     7 · LA TARJETA NO SE CONTRADICE A SÍ MISMA
     ------------------------------------------------------------
     La tarjeta del resultado trae una línea verde —«Cotización en
     línea disponible para esta unidad»— que habla de la UNIDAD y se
     pinta ANTES de preguntarle al servidor. Con un destino fuera del
     criterio quedaba justo encima de «Te la enviamos hoy mismo»: dos
     cosas contrarias en la misma tarjeta, y la que se lee primero es
     la de arriba.

     Se comprueba leyendo el HTML, como el resto de lo de pantalla:
     la línea lleva un id para poder corregirla, y la rama de
     `requiereAsesor` la corrige.
     ------------------------------------------------------------ */
  const html = fs.readFileSync(path.join(RAIZ, 'index.html'), 'utf8');
  /* Una sola vez: escribirlo en las dos ramas del ternario deja el id
     repetido en el archivo, y `probar-pantallas.cjs` lo caza —pasó al
     escribir esto—. */
  igual('la línea de la tarjeta tiene id para poder corregirse, una sola vez',
    (html.match(/id="res-nota"/g) || []).length, 1);

  const ramaAsesor = html.slice(html.indexOf('if (c.requiereAsesor) {'),
    html.indexOf('precioNoDisponible(\'Este viaje lo cotiza un vendedor'));
  igual('y la rama de «lo cotiza un vendedor» la corrige',
    /res-nota/.test(ramaAsesor) && /se cotiza a la medida/.test(ramaAsesor), true);

  console.log('\n' + buenas + ' buenas, ' + malas + ' malas');
  process.exit(malas ? 1 : 0);
})();
