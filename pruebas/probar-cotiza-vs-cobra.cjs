/* ============================================================
   Lo que se cotiza es lo que se cobra
   ------------------------------------------------------------
       node pruebas/probar-cotiza-vs-cobra.cjs

   Invoca los DOS endpoints de verdad —/api/cotizar y /api/pagar—
   con el mismo viaje, fingiendo a Google y a Stripe, y exige que
   el total coincida al peso.

   Es la prueba que mas vale de todas: si el cliente ve un precio
   en pantalla y en la pantalla de cobro le sale otro, da igual
   que las dos cuentas esten bien por separado.

   ------------------------------------------------------------
   R47 · POR QUE ESTA PRUEBA ENCIENDE EL INTERRUPTOR (12-sep-2026)
   ------------------------------------------------------------
   Desde el 12-sep-2026 las dos puertas no dan NINGUN precio:
   `tarifa.PAGINA_DA_PRECIOS` esta apagado y todo sale en cero.

   Con eso, esta prueba «pasaria» sola: cero es igual a cero, y
   coincidirian aunque una de las dos cuentas estuviera rota. La
   prueba que mas vale de todas se habria vuelto la que menos.

   Asi que aqui se ENCIENDE a proposito, para que las dos puertas
   vuelvan a hacer la cuenta completa y se pueda exigir que
   coincidan al peso. Es lo unico que se toca: ni el cuerpo de las
   peticiones ni los numeros esperados cambiaron.

   Y al final, con el interruptor como esta en produccion, se
   comprueba lo otro: que apagado NO sale numero por ninguna de las
   dos. Las dos mitades hacen falta —una cuida la cuenta, la otra
   cuida el candado— y ninguna sirve sin la otra.
   ------------------------------------------------------------
   ============================================================ */
'use strict';

let buenas = 0, malas = 0;
function igual(nombre, dio, esperado) {
  const a = JSON.stringify(dio), b = JSON.stringify(esperado);
  if (a === b) { buenas++; console.log('ok   ' + nombre); }
  else { malas++; console.log('MAL  ' + nombre + '\n     dio      ' + a + '\n     esperaba ' + b); }
}

process.env.GOOGLE_ROUTES_KEY = 'de_mentiras';
process.env.STRIPE_SECRET_KEY = 'sk_test_de_mentiras';

const cotizar = require('../api/cotizar.js');
const pagar = require('../api/pagar.js');

/* R47 · El interruptor, encendido para la cuenta. Ver la nota de arriba.
   Las dos puertas lo leen de aqui EN CADA PETICION —`!tarifa.PAGINA_DA_PRECIOS`
   dentro del manejador—, asi que se puede prender y apagar a media prueba;
   si algun dia alguna se lo copiara a una constante suya al cargar el
   modulo, la ultima seccion de este archivo se caeria y se sabria. */
const tarifa = require('../api/_tarifa.js');
const APAGADO_EN_PRODUCCION = tarifa.PAGINA_DA_PRECIOS;
tarifa.PAGINA_DA_PRECIOS = true;

/* Google y Stripe, fingidos. Google contesta los metros que se le pidan;
   Stripe contesta una sesion cualquiera con su URL. */
let METROS_IDA = 0, METROS_VUELTA = 0;
let vueltaPedida = false;
global.fetch = function (url, opc) {
  const u = String(url);
  if (u.indexOf('routes.googleapis.com') >= 0) {
    const cuerpo = JSON.parse(opc.body);
    /* Se distingue ida de vuelta por el orden de los puntos: la vuelta
       invierte origen y destino. */
    const esVuelta = JSON.stringify(cuerpo.origin).indexOf('DESTINO') >= 0;
    if (esVuelta) vueltaPedida = true;
    return Promise.resolve({ ok: true, json: () => Promise.resolve({
      routes: [{ distanceMeters: esVuelta ? METROS_VUELTA : METROS_IDA, duration: '1000s' }]
    }) });
  }
  if (u.indexOf('api.stripe.com') >= 0) {
    return Promise.resolve({ ok: true, json: () => Promise.resolve({
      id: 'cs_test_x', url: 'https://checkout.stripe.com/x'
    }) });
  }
  return Promise.reject(new Error('destino inesperado: ' + u));
};

/* Cada viaje es un cliente distinto, con su propia IP. No es adorno: el freno
   de /api/pagar deja pasar 12 por minuto, y con una sola IP la prueba se
   frenaba sola a partir del viaje 13 —y un 429 se ve identico a una cuenta
   mal hecha en la tabla de resultados—. El freno esta bien; era la prueba la
   que fingia que dieciocho cotizaciones venian de la misma computadora. */
function cabecerasDe(n) {
  return {
    origin: 'https://eurotravel-web.vercel.app',
    'x-vercel-forwarded-for': '10.0.' + Math.floor(n / 250) + '.' + (n % 250)
  };
}

function res() {
  const r = { _status: null, _json: null };
  r.status = function (s) { r._status = s; return r; };
  r.json = function (j) { r._json = j; return r; };
  r.end = function () { return r; };
  return r;
}

/* ------------------------------------------------------------
   EL DESTINO DE LA PRUEBA NO PUEDE ESTAR EN LA LISTA DE PRECIOS

   Aqui decia «Puerto Vallarta», y el 25-ago-2026 —cuando llego la LISTA DE
   PRECIOS 2027— Vallarta paso a tener precio cerrado. De un dia para otro
   todos los viajes de esta prueba dejaron de cotizarse por kilometros y
   ninguno lo dijo: los nombres seguian diciendo «justo en 800 km» y por
   dentro los kilometros ya no movian un peso.

   Tequisquiapan no esta en la lista y no empata con ningun renglon, asi que
   estos viajes de verdad ejercitan la formula. Los destinos CON precio de
   lista se prueban aparte, en su propia seccion al final.
   ------------------------------------------------------------ */
const ORIGEN = { placeId: 'ChIJ_ORIGEN_x', lat: 20.6597, lng: -103.3496, direccion: 'Guadalajara' };
const DESTINO = { placeId: 'ChIJ_DESTINO_x', lat: 20.6534, lng: -105.2253,
                  direccion: 'Tequisquiapan, Querétaro, México' };

let corrida = 0;

async function corre(metrosIda, metrosVuelta, salida, regreso, movimientos, destinoFijo, origenFijo) {
  METROS_IDA = metrosIda; METROS_VUELTA = metrosVuelta;
  /* El cache de _rutas guarda por par de puntos; se le cambia la marca en cada
     corrida para que vuelva a "medir" y no conteste lo de la vez pasada. */
  const marca = 'k' + metrosIda + '_' + metrosVuelta + '_' + (++corrida);
  /* `origenFijo` sirve para los orígenes con recargo propio (R19). Va aquí y
     no en el cuerpo suelto porque los DOS endpoints tienen que recibir el
     mismo origen: si uno se lo pasara a `calcula` y el otro no, el cliente
     vería un precio y se le cobraría otro. */
  const baseOrigen = origenFijo ? Object.assign({}, ORIGEN, origenFijo) : ORIGEN;
  const o = Object.assign({}, baseOrigen, { placeId: ORIGEN.placeId + marca });
  /* `destinoFijo` sirve para los destinos CON precio de lista: se le cambia la
     direccion pero se le deja la marca DESTINO en el placeId, que es lo que
     distingue la ida de la vuelta en el Google fingido. */
  const base = destinoFijo ? Object.assign({}, DESTINO, destinoFijo) : DESTINO;
  const d = Object.assign({}, base, { placeId: DESTINO.placeId + marca });

  const cuerpo = { origen: o, destino: d, salida: salida, regreso: regreso, redondo: !!regreso };

  /* A CADA endpoint se le manda lo que le manda la pagina de verdad, que NO es
     lo mismo: el cotizador recibe solo las horas —lo unico que mueve el
     precio— y el cobro recibe el dia completo, porque el detalle se imprime
     en el contrato. Si los dos precios se separaran por eso, aqui se ve. */
  const dias = movimientos || [];
  const soloHoras = dias.map(function (m) {
    return { horaInicio: m.horaInicio, horaFin: m.horaFin };
  });

  const cabeceras = cabecerasDe(corrida);

  const r1 = res();
  await cotizar({ method: 'POST', headers: cabeceras,
    body: Object.assign({}, cuerpo, { movimientos: soloHoras }) }, r1);

  const r2 = res();
  await pagar({ method: 'POST', headers: cabeceras, body: Object.assign({}, cuerpo, {
    nombre: 'Quien Sea', correo: 'x@y.mx', telefono: '3300000000',
    canal: 'correo', unidad: 'Sprinter', rutaTexto: 'A a B',
    movimientos: dias
  }) }, r2);

  return { cotiza: r1._json, cobra: r2._json, estados: [r1._status, r2._status] };
}

/* Un dia con movimiento como lo arma la pantalla, con todo su detalle. */
function dia(fecha, inicio, fin) {
  return {
    fecha: fecha, recorridos: '3', horaInicio: inicio, horaFin: fin,
    partida: { texto: 'Hotel Sheraton, ' + fecha },
    visitas: [{ texto: 'Malecon' }, { texto: 'Zona Romantica' }]
  };
}

(async function () {
  const VIAJES = [
    ['redondo de 621 km, 4 días', 311400, 309800, '2026-09-03T08:00', '2026-09-06T18:00'],
    ['800 km redondos', 400000, 400000, '2026-09-03T08:00', '2026-09-05T18:00'],
    ['un metro más', 400000, 400001, '2026-09-03T08:00', '2026-09-05T18:00'],
    ['1,000 km redondos', 500000, 500000, '2026-09-03T08:00', '2026-09-07T18:00'],
    ['un metro más', 500000, 500001, '2026-09-03T08:00', '2026-09-07T18:00'],
    ['1,210 km', 610000, 600000, '2026-09-03T08:00', '2026-09-07T18:00'],
    /* El borde del tope de la formula, por los dos lados: el ultimo viaje que
       se cotiza solo y el primero que ya no. Los dos tienen que dar lo MISMO
       en cotizar y en cobrar, y el de arriba tiene que dar cero en los dos. */
    ['1,400 km justos: el último que se cotiza solo', 700000, 700000, '2026-09-03T08:00', '2026-09-05T18:00'],
    ['un metro pasado del tope: lo cotiza un asesor', 700000, 700001, '2026-09-03T08:00', '2026-09-05T18:00'],
    ['viaje corto: manda el mínimo', 40000, 40000, '2026-09-03T08:00', '2026-09-08T18:00'],
    ['solo ida', 750000, 0, '2026-09-03T08:00', ''],
    ['distancias impares', 333333, 444447, '2026-09-03T08:00', '2026-09-06T18:00'],
    ['viaje muy largo: los dos piden asesor', 1400000, 1399999, '2026-09-03T08:00', '2026-09-14T18:00'],

    /* --- con noches extra y con movimientos --- */
    ['justo en 3 noches: nada extra', 311400, 309800, '2026-09-03T08:00', '2026-09-06T18:00', []],
    ['4 noches: una extra', 311400, 309800, '2026-09-03T08:00', '2026-09-07T18:00', []],
    ['un día de movimientos, 8 h', 311400, 309800, '2026-09-03T08:00', '2026-09-06T18:00',
      [dia('2026-09-04', '08:00', '16:00')]],
    ['un día de movimientos, 13 h', 311400, 309800, '2026-09-03T08:00', '2026-09-06T18:00',
      [dia('2026-09-04', '08:00', '21:00')]],
    ['tres días, tres bandas distintas', 311400, 309800, '2026-09-03T08:00', '2026-09-07T18:00',
      [dia('2026-09-04', '08:00', '16:00'), dia('2026-09-05', '08:00', '17:30'),
       dia('2026-09-06', '07:00', '20:01')]],
    ['noches extra Y movimientos, todo junto', 610000, 600000, '2026-09-03T08:00', '2026-09-10T18:00',
      [dia('2026-09-04', '09:00', '19:00'), dia('2026-09-06', '08:00', '22:00')]],
    ['más días con movimiento que noches: se acotan igual en los dos',
      40000, 40000, '2026-09-03T08:00', '2026-09-04T18:00',
      [dia('2026-09-03', '08:00', '22:00'), dia('2026-09-04', '08:00', '22:00'),
       dia('2026-09-05', '08:00', '22:00')]],
    ['días con horas ilegibles: caen en el piso en los dos',
      311400, 309800, '2026-09-03T08:00', '2026-09-06T18:00',
      [dia('2026-09-04', '', ''), dia('2026-09-05', '20:00', '02:00')]],

    /* --- DESTINOS CON PRECIO DE LISTA ---
       Aqui el traslado NO sale de los kilometros: sale de la tabla. Es el
       caso donde mas facil se separarian los dos endpoints —si uno leyera la
       lista y el otro no, el cliente veria un precio y se le cobraria otro—
       y por eso los kilometros que se les mandan son a proposito los que
       darian OTRO numero por formula. Misma leccion que la Huasteca. */
    ['de lista: Vallarta 4 días', 311400, 309800, '2026-09-03T08:00', '2026-09-06T18:00', [],
      { direccion: 'Puerto Vallarta, Jalisco, México' }],
    ['de lista: Mismaloya, que vive dentro de Vallarta',
      328000, 328000, '2026-09-03T08:00', '2026-09-06T18:00', [],
      { direccion: 'Mismaloya, Puerto Vallarta, Jalisco, México' }],
    ['de lista: CDMX 3 días con movimientos los 3',
      551000, 551000, '2026-09-03T08:00', '2026-09-05T18:00',
      [dia('2026-09-03', '08:00', '16:00'), dia('2026-09-04', '08:00', '16:00'),
       dia('2026-09-05', '08:00', '16:00')],
      { direccion: 'Ciudad de México, Ciudad de México, México' }],
    /* Cancun mide 4,282 km, muy arriba del tope: sin la lista, los dos
       endpoints dirian «lo cotiza un asesor». Con la lista, los dos tienen
       que cobrar sus 145,000. */
    ['de lista: Cancún, arriba del tope y aun así con precio',
      2141000, 2141000, '2026-09-03T08:00', '2026-09-10T18:00', [],
      { direccion: 'Cancún, Quintana Roo, México' }],
    /* Chapala son 6,500 porque es viaje de mismo dia. A siete dias manda el
       piso de 3,000 por dia, y los dos endpoints tienen que levantarlo igual. */
    ['de lista: Chapala a 7 días, donde manda el mínimo',
      50000, 50000, '2026-09-03T08:00', '2026-09-09T18:00', [],
      { direccion: 'Chapala, Jalisco, México' }]
  ];

  let cuadran = 0;
  const fallas = [];

  for (const [nombre, ida, vuelta, salida, regreso, movs, destinoFijo] of VIAJES) {
    const r = await corre(ida, vuelta, salida, regreso, movs, destinoFijo);
    const a = r.cotiza, b = r.cobra;

    /* ------------------------------------------------------------
       EL VIAJE QUE NO SE COTIZA SOLO TAMPOCO SE COBRA

       Arriba del tope de kilometros no hay precio. Aqui se exige que los
       dos endpoints estén de acuerdo en eso tambien: el cotizador lo dice
       con `requiereAsesor` y el cobro lo RECHAZA con un 422.

       Si el cobro dejara pasar uno de estos, Stripe recibiria un anticipo
       de cero y el viaje quedaria apartado gratis, con folio y todo.
       ------------------------------------------------------------ */
    if (a && a.requiereAsesor) {
      const bienRechazado = r.estados[1] === 422 && b && b.error === 'requiere asesor';
      const sinPrecio = a.total === 0 && a.anticipo === 0;
      if (bienRechazado && sinPrecio) {
        cuadran++; buenas++;
        console.log('ok   ' + nombre.padEnd(46) + '  lo cotiza un asesor, y el cobro lo rechaza');
      } else {
        malas++;
        fallas.push({ nombre, cotiza: a, cobra: b, estados: r.estados });
        console.log('MAL  ' + nombre + '\n     cotiza ' + JSON.stringify(a) +
          '\n     cobra  ' + r.estados[1] + ' ' + JSON.stringify(b));
      }
      continue;
    }

    const mismoTotal = a && b && a.total === b.total;
    const mismoAnticipo = a && b && a.anticipo === b.anticipo;
    const mismoSaldo = a && b && a.saldo === b.saldo;
    /* No basta con que el total coincida: si el desglose difiere, el cliente
       ve un reparto y el contrato lleva otro. */
    const mismoDesglose = a && b && JSON.stringify(a.desglose) === JSON.stringify(b.desglose);

    if (mismoTotal && mismoAnticipo && mismoSaldo && mismoDesglose) {
      cuadran++;
      console.log('ok   ' + nombre.padEnd(46) + ' $' + String(a.total).padStart(6) +
        '  anticipo $' + String(a.anticipo).padStart(5));
      buenas++;
    } else {
      malas++;
      fallas.push({ nombre, cotiza: a, cobra: b, estados: r.estados });
      console.log('MAL  ' + nombre + '\n     cotiza ' + JSON.stringify(a) + '\n     cobra  ' + JSON.stringify(b));
    }
  }

  igual('los ' + VIAJES.length + ' viajes: cotizar y cobrar dan lo mismo', cuadran, VIAJES.length);

  /* Y que el cotizador no filtre el kilometraje, ni siquiera en los bordes. */
  const r = await corre(610000, 600000, '2026-09-03T08:00', '2026-09-07T18:00');
  igual('el cotizador no manda km ni tarifa',
    JSON.stringify(r.cotiza).match(/km|tarifa|tramo|1210|610/i), null);
  igual('el cobro tampoco',
    JSON.stringify(r.cobra).match(/\bkm\b|tarifa|tramo|1210/i), null);

  /* Con movimientos encima, el desglose sale a la pantalla: se comprueba que
     tampoco por ahi se cuele el kilometraje. */
  const rm = await corre(610000, 600000, '2026-09-03T08:00', '2026-09-10T18:00',
    [dia('2026-09-04', '08:00', '18:00'), dia('2026-09-05', '08:00', '21:00')]);
  /* El kilometraje se busca como NUMERO SUELTO, no como pedazo de texto.
     Con `/610/` a secas la prueba se ponia roja el 26-ago-2026 por un total
     de 46,100 —que lleva «610» adentro— y parecia una fuga que no existia.
     Una prueba que grita en falso acaba ignorandose, y esta cuida la regla
     mas importante del proyecto. */
  igual('el desglose tampoco delata el kilometraje',
    JSON.stringify(rm.cotiza).match(/km|tarifa|tramo|(^|[^0-9])(1210|610)([^0-9]|$)/i), null);

  /* ------------------------------------------------------------
     CAMBIÓ DE LADO EL 12-sep-2026 · R46

     Este caso era Tequisquiapan —que NO está en la lista— y probaba la
     aritmética de la fórmula de respaldo:
       6,500 + 1,210 × 22 = 33,120, corte a la centena → 33,100
       + 4 noches extra (4,000) + movimientos (9,000) = 46,100

     El dueño dictó el 11-sep-2026 que la página no dé un precio que no
     salió del criterio. `/api/cotizar` pide ahora `soloDelCriterio`, así
     que Tequisquiapan ya no cotiza: contesta «lo cotiza un vendedor».

     La aritmética de la fórmula NO se quedó sin prueba: sigue viva donde
     sigue sirviendo —el bot y la pantalla del dueño— y la cuida
     `probar-tarifa.cjs`, que llama a `calcula` directo y sin la opción.
     Lo que se prueba AQUÍ es lo de esta puerta: que ya no da número.
     ------------------------------------------------------------ */
  igual('el caso completo, fuera del criterio, ya no da precio',
    [rm.cotiza.requiereAsesor, rm.cotiza.total, rm.cotiza.anticipo], [true, 0, 0]);
  igual('y el cobro lo rechaza igual que el cotizador',
    [rm.estados[1], rm.cobra && rm.cobra.error], [422, 'requiere asesor']);

  /* Y el mismo viaje —ocho días, dos días de movimientos— sobre un destino
     que SÍ está en la lista, para que el desglose siga teniendo quien lo
     cuide: es lo que de verdad se le enseña al cliente.
       Vallarta 8 días ........................ 23,000 (traslado y estadía)
       10 h -> 4,000 y 13 h -> 5,000 .......... + 9,000
                                                --------
                                                  32,000 */
  const rl = await corre(610000, 600000, '2026-09-03T08:00', '2026-09-10T18:00',
    [dia('2026-09-04', '08:00', '18:00'), dia('2026-09-05', '08:00', '21:00')],
    { direccion: 'Puerto Vallarta, Jalisco, México' });
  igual('de lista, con movimientos, da 32,000', rl.cotiza.total, 32000);
  /* Al cliente le llegan DOS numeros: traslado y estadia juntos y los
     movimientos aparte. Partirlos diria cuanto cuesta la noche. */
  igual('y su desglose lo explica sin delatar la tarifa por noche',
    [rl.cotiza.desglose.servicio, rl.cotiza.desglose.importeMovimientos],
    [23000, 9000]);
  igual('los dos numeros suman el total',
    rl.cotiza.desglose.servicio + rl.cotiza.desglose.importeMovimientos, rl.cotiza.total);
  /* Cambió con R51 (2-sep-2026): el 20% sube al medio millar. Y cambió de
     destino con R46 (12-sep-2026), porque el de antes ya no da precio: el
     20% de 32,000 son 6,400 y suben a 6,500. Lo que esta prueba cuida no es
     la cifra sino que cotizar y cobrar den lo MISMO — y siguen dándolo. */
  igual('el anticipo sube al medio millar (R51)', rl.cotiza.anticipo, 6500);

  /* LA HUASTECA, POR LOS DOS ENDPOINTS.
     Es el caso donde mas facil se separarian: si uno reconociera el destino y
     el otro no, el cliente veria un precio y se le cobraria otro. Aqui se
     manda el MISMO destino a los dos y se exige el mismo numero. */
  {
    const HUASTECA = { placeId: 'ChIJv8IdsTSP1oURPsKDyokOts4', lat: 21.474687, lng: -98.957083,
                       direccion: 'Huasteca Potosina, San Luis Potosí' };
    const largos = [dia('2026-09-04', '07:00', '21:00'), dia('2026-09-05', '06:00', '20:30')];

    METROS_IDA = 500000; METROS_VUELTA = 500000;   // 1,000 km -> segunda banda
    const marca = 'huasteca' + (++corrida);
    const cab = cabecerasDe(corrida);
    const cuerpo = {
      origen: Object.assign({}, ORIGEN, { placeId: ORIGEN.placeId + marca }),
      destino: Object.assign({}, HUASTECA, { placeId: HUASTECA.placeId }),
      salida: '2026-09-03T08:00', regreso: '2026-09-08T18:00', redondo: true
    };

    const c1 = res();
    await cotizar({ method: 'POST', headers: cab, body: Object.assign({}, cuerpo, {
      movimientos: largos.map(function (m) { return { horaInicio: m.horaInicio, horaFin: m.horaFin }; })
    }) }, c1);

    const c2 = res();
    await pagar({ method: 'POST', headers: cab, body: Object.assign({}, cuerpo, {
      nombre: 'Quien Sea', correo: 'x@y.mx', telefono: '3300000000',
      canal: 'correo', unidad: 'Sprinter', rutaTexto: 'A a B', movimientos: largos
    }) }, c2);

    /*  La Huasteca AHORA tiene precio de lista, y son dos reglas distintas
        que se aplican al mismo destino:
          · su base son 26,500 —la lista, no los kilometros—
          · y el dia con movimientos vale 3,000 sin importar las horas

        26,500 de lista  ·  minimo 6 dias × 3,000 = 18,000, no gana
        HAY movimientos: 6 dias × 1,000 .................... +  6,000
        dos dias de 14 h y 14.5 h: en la Huasteca, 3,000 c/u  +  6,000
                                                               --------
                                                                 38,500
        En cualquier otro destino esos dos dias serian 5,000 c/u = 10,000.

        Y 38,500 es EXACTAMENTE el renglon «HUASTECA 3 DIAS» de su lista de
        precios, al que se llega por otro camino: 3 dias de movimientos en
        vez de 2 mas 6 dias de estadia. Cuadra por los dos lados. */
    igual('Huasteca: cotizar da 38,500', c1._json && c1._json.total, 38500);
    igual('y cobrar da lo mismo', c2._json && c2._json.total, 38500);
    igual('los dos reconocen el destino',
      [c1._json.desglose.reglaDestino, c2._json.desglose.reglaDestino],
      ['Huasteca Potosina', 'Huasteca Potosina']);
    igual('las horas largas NO subieron el dia',
      c1._json.desglose.importeMovimientos, 6000);
  }

  /* ============================================================
     LA LISTA DE PRECIOS, POR LOS DOS ENDPOINTS Y AL PESO
     ------------------------------------------------------------
     Arriba se comprobo que cotizar y cobrar coinciden. Aqui, ademas, que
     el numero en el que coinciden es el que el dueño tiene escrito en su
     LISTA DE PRECIOS 2027. Coincidir en un numero equivocado tambien
     coincide.
     ============================================================ */
  {
    const ochoH = function (f) { return dia(f, '08:00', '16:00'); };

    //  22,000 de base + 3 dias × 1,000 + 3 movimientos × 3,000 = 34,000
    const cdmx = await corre(551000, 551000, '2026-09-03T08:00', '2026-09-05T18:00',
      [ochoH('2026-09-03'), ochoH('2026-09-04'), ochoH('2026-09-05')],
      { direccion: 'Ciudad de México, Ciudad de México, México' });
    igual('CDMX 3 días: los dos endpoints dan los 34,000 de su lista',
      [cdmx.cotiza.total, cdmx.cobra.total], [34000, 34000]);

    //  Vallarta de jueves a domingo: 4 dias, 3 noches, sus 19,000 pelados
    const vta = await corre(311400, 309800, '2026-09-03T08:00', '2026-09-06T18:00', [],
      { direccion: 'Puerto Vallarta, Jalisco, México' });
    igual('Vallarta 3 noches: los dos dan los 19,000 de su lista',
      [vta.cotiza.total, vta.cobra.total], [19000, 19000]);

    /* ------------------------------------------------------------
       R19 · EL MISMO VIAJE, SALIENDO DE OCOTLAN

       Esta es la que caza el defecto más caro de la regla nueva: que
       un endpoint le pase el origen a `calcula` y el otro no. El
       cliente vería $19,000 en la pantalla y se le cobrarían
       $25,000 en Stripe.

       $19,000 de lista + $6,000 que él dictó en su fila 11.
       ------------------------------------------------------------ */
    const vtaOco = await corre(390000, 390000, '2026-09-03T08:00', '2026-09-06T18:00', [],
      { direccion: 'Puerto Vallarta, Jalisco, México' },
      { lat: 20.3529, lng: -102.7745, direccion: 'Ocotlán, Jalisco, México' });
    igual('Vallarta desde Ocotlán: los dos endpoints dan los 25,000 de su fila 11',
      [vtaOco.cotiza.total, vtaOco.cobra.total], [25000, 25000]);
    igual('y el anticipo también coincide',
      [vtaOco.cotiza.anticipo, vtaOco.cobra.anticipo], [5000, 5000]);

    /* Y que el precio de lista NO se le enseñe al cliente como lo que es: el
       nombre del renglon se queda del lado del servidor.

       `reglaDestino` se excluye del barrido: es publico POR DISEÑO desde la
       Huasteca —arriba hay una prueba que exige verlo— y desde el 26-ago-2026
       la CDMX tambien trae regla, asi que su nombre aparece ahi. Lo que no
       puede aparecer es el renglon de PRECIOS (destinoDeLista), y eso se
       sigue barriendo completo. */
    const sinRegla = function (r) {
      const copia = JSON.parse(JSON.stringify(r));
      if (copia.desglose) delete copia.desglose.reglaDestino;
      return copia;
    };
    igual('pero ninguno le dice al cliente de qué renglón salió',
      JSON.stringify([sinRegla(vta.cotiza), sinRegla(cdmx.cotiza)]).match(/Vallarta|Ciudad de M/), null);
  }

  /* ============================================================
     LA UNIDAD QUE SE COBRA TIENE QUE SER LA QUE SE SABE COTIZAR
     ------------------------------------------------------------
     Tu lista de precios trae SIETE columnas, una por tipo de unidad, y
     para Puerto Vallarta van de $19,000 la Sprinter a $38,000 el
     Marcopolo. Pero el precio que sale de `_tarifa` es siempre el de la
     columna sprinter: ni `cotizar` ni `pagar` le pasaban `unidad`.

     La PANTALLA lo tapa —solo la Sprinter tiene cotizador automático— pero
     la pantalla no es la puerta. `/api/pagar` recibe `unidad` como texto
     libre y no comprueba nada, así que una petición armada a mano con
     «Irizar i6S» cobraba $19,000 por un autobús de $36,000, y el contrato
     que llega a EuroSystem decía «Irizar i6S».

     Es la regla 3 de `antes-de-escribir`: nada que mande el cliente decide,
     y lo que impide la pantalla lo tiene que impedir el servidor.
     ============================================================ */
  {
    const cuerpoBase = {
      origen: Object.assign({}, ORIGEN, { placeId: ORIGEN.placeId + 'unidad' }),
      destino: Object.assign({}, DESTINO, {
        placeId: DESTINO.placeId + 'unidad', direccion: 'Puerto Vallarta, Jalisco, México' }),
      salida: '2026-09-03T08:00', regreso: '2026-09-06T18:00', redondo: true,
      nombre: 'Quien Sea', correo: 'x@y.mx', telefono: '3300000000',
      canal: 'correo', rutaTexto: 'A a B'
    };

    async function cobra(unidad) {
      METROS_IDA = 311400; METROS_VUELTA = 309800;
      const marca = 'u' + (++corrida);
      const r = res();
      await pagar({ method: 'POST', headers: cabecerasDe(corrida), body: Object.assign({}, cuerpoBase, {
        unidad: unidad,
        origen: Object.assign({}, cuerpoBase.origen, { placeId: cuerpoBase.origen.placeId + marca }),
        destino: Object.assign({}, cuerpoBase.destino, { placeId: cuerpoBase.destino.placeId + marca })
      }) }, r);
      return r;
    }

    const sprinter = await cobra('Sprinter');
    igual('la Sprinter se cobra, como siempre', sprinter._status, 200);
    igual('y a su precio de lista', sprinter._json.total, 19000);

    /* Las que la página NO cotiza sola tampoco se pueden cobrar. Si esto
       contestara 200, se estaría vendiendo un autobús al precio de una van. */
    for (const unidad of ['Irizar i6S', 'Irizar i6', 'Irizar PB', 'Neobus', 'Suburban',
                          'Marcopolo', 'lo que sea', '']) {
      const r = await cobra(unidad);
      igual('«' + (unidad || '(vacío)') + '» no se puede cobrar', r._status, 422);
    }
  }

  /* ============================================================
     NO SE LE PAGA A GOOGLE POR UNA RESPUESTA QUE NO SE USA
     ------------------------------------------------------------
     Cuando el destino tiene precio CERRADO en la lista, los kilómetros no
     mueven un peso: `trasladoDe` ni los mira. Pero /api/cotizar los medía
     igual, y medir son DOS llamadas de pago a la Routes API por cotización.

     46 de los 79 destinos del catálogo tienen precio cerrado. Y una reserva
     no es una cotización: el cliente cambia la fecha, cambia la unidad,
     captura movimientos, y cada cambio vuelve a cotizar.

     /api/pagar SI sigue midiendo siempre: el kilometraje va a la metadata
     del contrato y la oficina lo lee ahí. Se mide una vez, al pagar, no en
     cada tecleo.
     ============================================================ */
  {
    function conteoDeGoogle() {
      let n = 0;
      const antes = global.fetch;
      global.fetch = function (url, opc) {
        if (String(url).indexOf('routes.googleapis.com') >= 0) n++;
        return antes(url, opc);
      };
      return { cuantas: function () { return n; }, suelta: function () { global.fetch = antes; } };
    }

    async function cotizaContando(destinoFijo) {
      METROS_IDA = 311400; METROS_VUELTA = 309800;
      const marca = 'g' + (++corrida);
      const espia = conteoDeGoogle();
      const r = res();
      await cotizar({ method: 'POST', headers: cabecerasDe(corrida), body: {
        origen: Object.assign({}, ORIGEN, { placeId: ORIGEN.placeId + marca }),
        destino: Object.assign({}, DESTINO, destinoFijo, { placeId: DESTINO.placeId + marca }),
        salida: '2026-09-03T08:00', regreso: '2026-09-06T18:00', redondo: true
      } }, r);
      const n = espia.cuantas();
      espia.suelta();
      return { llamadas: n, json: r._json, status: r._status };
    }

    const vallarta = await cotizaContando({ direccion: 'Puerto Vallarta, Jalisco, México' });
    igual('un destino de tu lista NO le pregunta a Google', vallarta.llamadas, 0);
    igual('y aun así cobra sus 19,000', vallarta.json.total, 19000);

    const cdmx = await cotizaContando({ direccion: 'Ciudad de México, Ciudad de México, México' });
    igual('la CDMX tampoco', cdmx.llamadas, 0);
    /* Cambio de lado el 26-ago-2026: son 4 dias sin movimientos, y el dueño
       corrigio que la CDMX cobra $1,000 por CADA dia aunque no haya
       movimientos («nomas vas a cobrar mil»). Los 22,000 pelados eran el
       modelo inventado de noches gratis. 22,000 + 4×1,000 = 26,000. */
    igual('y cobra sus 22,000 más los 4 días de estadía', cdmx.json.total, 26000);

    /* ------------------------------------------------------------
       CAMBIÓ DE LADO EL 12-sep-2026 · R46

       Bernal NO está en la lista. Antes se medía —dos llamadas de pago a
       Google— y se cotizaba por fórmula. Ahora la puerta pública pide
       `soloDelCriterio`, y con eso ya sabemos la respuesta antes de medir:
       no hay precio que dar.

       Así que las dos llamadas se vuelven CERO. No es solo un ahorro: es
       la señal de que la fórmula ya no se está calculando para el público.
       Si algún día vuelven a ser dos, es que alguien quitó la opción de la
       puerta y la página está otra vez inventando precios.
       ------------------------------------------------------------ */
    const bernal = await cotizaContando({ direccion: 'Bernal, Querétaro, México' });
    igual('el que no está en la lista ya NO se mide', bernal.llamadas, 0);
    igual('y no da precio: lo cotiza un vendedor',
      [bernal.status, bernal.json.requiereAsesor, bernal.json.total], [200, true, 0]);

    /* Solo ida y fuera de la lista: también cero llamadas y sin precio.
       Cambió dos veces, y las dos quedan escritas porque explican el
       número de hoy. El 26-ago-2026: antes un solo-ida medía solo la ida y
       cobraba medio viaje; el dueño dictó que cuesta el 65% del precio
       REDONDO de un día, y ese precio necesita la vuelta, así que pasaron a
       ser dos llamadas. El 12-sep-2026 (R46): fuera del criterio no hay
       precio, ni redondo ni de un sentido, así que ya no se mide nada.

       El 65% sigue probado donde sigue vivo: en `probar-tarifa.cjs`, y en
       esta misma prueba con los destinos de lista. */
    METROS_IDA = 311400; METROS_VUELTA = 288000;
    const espia = conteoDeGoogle();
    const soloIda = res();
    await cotizar({ method: 'POST', headers: cabecerasDe(++corrida), body: {
      origen: Object.assign({}, ORIGEN, { placeId: ORIGEN.placeId + 'si' + corrida }),
      destino: Object.assign({}, DESTINO, { placeId: DESTINO.placeId + 'si' + corrida,
                                            direccion: 'Bernal, Querétaro, México' }),
      salida: '2026-09-03T08:00', regreso: '', redondo: false } }, soloIda);
    const nIda = espia.cuantas(); espia.suelta();
    igual('solo ida fuera de la lista: tampoco se mide', nIda, 0);
    igual('y tampoco da precio',
      [soloIda._json && soloIda._json.requiereAsesor, soloIda._json && soloIda._json.total],
      [true, 0]);

    /* ---- Y SIN CLAVE DE GOOGLE, la lista sigue cotizando ----
       Antes /api/cotizar contestaba 503 antes de mirar nada. Ahora la clave
       solo hace falta cuando de verdad hay que medir. */
    const clave = process.env.GOOGLE_ROUTES_KEY;
    delete process.env.GOOGLE_ROUTES_KEY;
    const sinClave = await cotizaContando({ direccion: 'Puerto Vallarta, Jalisco, México' });
    igual('sin clave de Google, un destino de lista se cotiza igual', sinClave.status, 200);
    igual('a su precio de siempre', sinClave.json.total, 19000);
    /* CAMBIÓ DE LADO EL 12-sep-2026 · R46. Éste daba 503 «Cotizador en línea
       no configurado»: había que medir y no había con qué. Ahora ya no hay
       nada que medir, así que la falta de clave dejó de importar y el
       cliente ve lo que tiene que ver —«te contacta un vendedor»— en vez de
       un error del servidor. */
    const sinClaveFormula = await cotizaContando({ direccion: 'Bernal, Querétaro, México' });
    igual('y el de fuera contesta «te contactamos», no un 503',
      [sinClaveFormula.status, sinClaveFormula.json.requiereAsesor], [200, true]);
    process.env.GOOGLE_ROUTES_KEY = clave;
  }

  /* ============================================================
     R47 · Y AHORA CON EL INTERRUPTOR COMO ESTA EN PRODUCCION
     ------------------------------------------------------------
     Todo lo de arriba corrio con `PAGINA_DA_PRECIOS` encendido, para
     que hubiera cuentas que comparar. Aqui se devuelve a como esta de
     verdad y se exige lo contrario: que por las DOS puertas no salga
     numero.

     Se prueba con el destino MAS facil de todos —Puerto Vallarta, que
     esta en el Excel y que hasta ayer cotizaba solo a $19,000 con
     boton de apartar—. Si el candado se cayera, es el primero que se
     escaparia.

     Y va con los dos endpoints por lo de siempre: cerrar `/api/cotizar`
     sin cerrar `/api/pagar` no sirve de nada, porque una peticion
     armada a mano apartaria el viaje con folio, contrato y cobro.
     ============================================================ */
  tarifa.PAGINA_DA_PRECIOS = APAGADO_EN_PRODUCCION;
  igual('en produccion el interruptor esta apagado', tarifa.PAGINA_DA_PRECIOS, false);

  {
    METROS_IDA = 610000; METROS_VUELTA = 600000;
    const apagado = await corre(610000, 600000, '2026-09-03T08:00', '2026-09-10T18:00',
      [], { direccion: 'Puerto Vallarta, Jalisco, México' });

    igual('apagado, Vallarta ya no da los $19,000 por /api/cotizar',
      [apagado.cotiza.requiereAsesor, apagado.cotiza.total, apagado.cotiza.anticipo],
      [true, 0, 0]);
    igual('y /api/pagar lo rechaza en vez de cobrarlo',
      [apagado.estados[1], apagado.cobra && apagado.cobra.error],
      [422, 'requiere asesor']);
  }

  igual('sin fallas', fallas, []);

  console.log('\n' + buenas + ' buenas, ' + malas + ' malas');
  process.exit(malas ? 1 : 0);
})();
