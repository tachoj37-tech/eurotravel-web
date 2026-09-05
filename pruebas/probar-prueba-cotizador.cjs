/* ============================================================
   La pantalla temporal de costos, y su candado
   ------------------------------------------------------------
       node pruebas/probar-prueba-cotizador.cjs

   Esta puerta devuelve JUSTO lo que las otras esconden: el
   kilometraje, la tarifa por kilometro, lo que vale la noche y
   lo que vale el dia de movimientos.

   Lo que hay que probar aqui no son las cuentas —esas ya las
   prueban las otras diez baterias, y salen de la MISMA funcion—
   sino tres cosas propias:

     · el candado: sin CLAVE_COTIZADOR no contesta NADA
     · que de verdad MIDA con Google, desde el origen que se le
       diga, y que sirva cualquier lugar escrito a mano
     · que lo que enseña sea lo que se cobra
   ============================================================ */
'use strict';

let buenas = 0, malas = 0;
function igual(nombre, dio, esperado) {
  const a = JSON.stringify(dio), b = JSON.stringify(esperado);
  if (a === b) { buenas++; console.log('ok   ' + nombre); }
  else { malas++; console.log('MAL  ' + nombre + '\n     dio      ' + a + '\n     esperaba ' + b); }
}
function cierto(nombre, v) { igual(nombre, !!v, true); }

/* ------------------------------------------------------------
   GOOGLE, FINGIDO
   ------------------------------------------------------------
   Contesta los metros que se le pidan y APUNTA cada tramo que le
   pidieron medir. Eso ultimo importa tanto como los metros: parte
   de lo que hay que comprobar es que de verdad se mida, y DESDE
   DONDE. Cualquier otra llamada a la red revienta la prueba.
   ------------------------------------------------------------ */
let METROS = 300000;
let MIDE = true;
let TRAMOS = [];
global.fetch = function (url, opc) {
  const u = String(url);
  if (u.indexOf('routes.googleapis.com') < 0) {
    return Promise.reject(new Error('esta prueba no debe llamar a ' + u));
  }
  const cuerpo = JSON.parse(opc.body);
  TRAMOS.push({ de: cuerpo.origin, a: cuerpo.destination });
  if (!MIDE) return Promise.resolve({ ok: true, json: () => Promise.resolve({ routes: [] }) });
  return Promise.resolve({ ok: true, json: () => Promise.resolve({
    routes: [{ distanceMeters: METROS, duration: '1000s' }]
  }) });
};
process.env.GOOGLE_ROUTES_KEY = 'de_mentiras';

/* Se movio a `pendiente/` el 2-sep-2026 para dejarle su lugar a
   `/api/entender`: el plan Hobby de Vercel deja 12 funciones y con la de
   la IA eran 13. Se escogio esta porque su propio encabezado dice
   «TEMPORAL, se borra cuando termine de revisarlos», y porque es la
   unica puerta que ensena a proposito kilometros y tarifas — sacarla de
   internet es ganancia, no perdida.

   Sigue viva y probada: se abre en local con `npm start`. */
const puerta = require('../pendiente/prueba-cotizador-api.js');
const tarifa = require('../api/_tarifa.js');

function res() {
  const r = { _status: null, _json: null };
  r.status = function (s) { r._status = s; return r; };
  r.json = function (j) { r._json = j; return r; };
  r.end = function () { return r; };
  return r;
}

let corrida = 0;
function cabeceras() {
  corrida++;
  return {
    origin: 'https://eurotravel-web.vercel.app',
    'x-vercel-forwarded-for': '10.1.' + Math.floor(corrida / 250) + '.' + (corrida % 250)
  };
}

/* _rutas guarda en cache por par de puntos, y prefiere el placeId sobre el
   texto. Se le cambia el placeId en cada llamada para que vuelva a "medir";
   la DIRECCION se deja intacta, porque de ella depende en que renglon de la
   lista de precios cae el destino. */
let marca = 0;
function punto(direccion) {
  return { direccion: direccion, placeId: 'ChIJ_x' + (++marca) };
}
const VALLARTA = 'Puerto Vallarta, Jalisco, México';
const CLAVE = 'la-buena-de-verdad-2026';

async function pide(cuerpo) {
  TRAMOS = [];
  const r = res();
  await puerta({ method: 'POST', headers: cabeceras(), body: cuerpo }, r);
  return r;
}

(async function () {

  /* ============ 1. SIN CLAVE CONFIGURADA, FALLA CERRADA ============
     Es la parte que mas importa. Una variable de entorno que alguien olvida
     poner NO puede volverse una puerta abierta: tiene que volverse una
     puerta que no abre. */
  delete process.env.CLAVE_COTIZADOR;
  {
    const r = await pide({ clave: '', destino: punto(VALLARTA), dias: 4 });
    igual('sin CLAVE_COTIZADOR no contesta', r._status, 503);
    igual('y lo dice sin dar datos', r._json.error, 'sin clave');
    cierto('el aviso explica que hay que ponerla en Vercel',
      /CLAVE_COTIZADOR/.test(r._json.aviso));
    igual('y ni siquiera llego a medir con Google', TRAMOS.length, 0);
  }
  {
    /* Y tampoco abre inventandose una clave: sin variable, NINGUNA clave
       sirve. Si esto contestara 200, la puerta estaria abierta de par en par. */
    const r = await pide({ clave: 'loquesea', destino: punto(VALLARTA), dias: 4 });
    igual('sin variable, ninguna clave abre', r._status, 503);
  }

  /* ============ 2. CON CLAVE, PERO EQUIVOCADA ============ */
  process.env.CLAVE_COTIZADOR = CLAVE;
  {
    const r = await pide({ clave: 'la-buena-de-verda', destino: punto(VALLARTA), dias: 4 });
    igual('una clave parecida no abre', r._status, 401);
    igual('ni la vacia', (await pide({ clave: '', destino: punto(VALLARTA), dias: 4 }))._status, 401);
    igual('ni sin mandarla', (await pide({ destino: punto(VALLARTA), dias: 4 }))._status, 401);
    igual('ni la buena con un espacio pegado',
      (await pide({ clave: CLAVE + ' ', destino: punto(VALLARTA), dias: 4 }))._status, 401);
    igual('ni cambiada de mayusculas',
      (await pide({ clave: CLAVE.toUpperCase(), destino: punto(VALLARTA), dias: 4 }))._status, 401);
    igual('y con clave mala no se gasta una llamada a Google', TRAMOS.length, 0);

    cierto('al rechazar no se le escapa ningun costo',
      JSON.stringify(r._json).match(/km|tarifa|traslado|\d{4}/i) === null);
  }

  /* ============ 3. LA PUERTA COMUN SIGUE PUESTA ============ */
  {
    const r1 = res();
    await puerta({ method: 'GET', headers: cabeceras(), body: {} }, r1);
    igual('por GET no contesta', r1._status, 405);

    const r2 = res();
    await puerta({ method: 'POST', headers: { origin: 'https://sitio-ajeno.com' }, body: {} }, r2);
    igual('desde otro sitio tampoco', r2._status, 403);
  }

  /* ============================================================
     4. SIEMPRE SE MIDE CON GOOGLE, Y DESDE DONDE SE LE DIGA
     ------------------------------------------------------------
     Es la razon de ser de esta pantalla: poder cotizar CUALQUIER
     lugar, este o no en la lista de precios.
     ============================================================ */
  {
    /* --- 4a. un destino QUE SI esta en la lista tambien se mide --- */
    const r = await pide({ clave: CLAVE, destino: punto(VALLARTA), dias: 4 });
    igual('un destino de la lista tambien se mide', r._json.traslado.seMidio, true);
    igual('se midieron los dos tramos, ida y vuelta', TRAMOS.length, 2);
    igual('y aun asi cobra su precio de lista', r._json.total, 19000);
    igual('los kilometros salen, aunque no muevan el precio', r._json.traslado.km, 600);

    /* La comparacion que solo se ve aqui: que diria la formula con esos km.
           6,500 + 600 × 22 = 19,700  contra los 19,000 de la lista           */
    igual('y al lado, lo que diria la formula', r._json.comparativa.porFormula, 19700);
    igual('con su diferencia', r._json.comparativa.diferencia, 700);
  }

  {
    /* --- 4b. un lugar ESCRITO A MANO, que no existe en ningun catalogo --- */
    METROS = 250000;
    const r = await pide({ clave: CLAVE, dias: 3,
      destino: { direccion: 'Hotel Misión Xilitla, Xilitla, San Luis Potosí' } });
    igual('un lugar escrito a mano se cotiza', r._status, 200);
    cierto('se midio con Google', r._json.traslado.seMidio === true);
    /* Google geocodifica el texto suelto: se le manda como `address` */
    cierto('y se le mando el texto tal cual a Google',
      JSON.stringify(TRAMOS[0].a).indexOf('Xilitla') >= 0);
    /* «Xilitla» cae en el renglon de la Huasteca, que SI tiene precio */
    igual('y cae en el renglon que le toca', r._json.traslado.deLista, 'Huasteca Potosina');
  }

  {
    /* --- 4c. un lugar escrito a mano que NO esta en ninguna lista ---

       ESTE CASO USABA BERNAL, y dejo de servir el 28-ago-2026: el dueño le
       dicto a Bernal su propia regla —«a Bernal 1000 el dia»— asi que ya no
       es un destino «fuera de todo», que es justo lo que este caso existe
       para probar. Se cambio a Tequisquiapan, que sigue sin regla.

       No se ajusto el numero esperado para que pasara: se cambio el EJEMPLO,
       porque lo que la prueba vigila —que un destino sin lista ni regla se
       cotice por formula pelona— sigue siendo cierto y hay que seguir
       vigilandolo. El caso de Bernal con su regla se prueba aparte, en
       probar-dia-no-gratis.cjs. */
    METROS = 250000;                                     // 500 km ida y vuelta
    const r = await pide({ clave: CLAVE, dias: 3,
      destino: { direccion: 'Centro, Tequisquiapan, Querétaro' } });
    igual('un destino fuera de la lista se cotiza por formula',
      r._json.traslado.porFormula, true);
    //  6,500 + 500 × 22 = 17,500  ·  minimo 3 × 3,000 = 9,000  ·  gana la formula
    igual('con la formula sobre los km medidos', r._json.total, 17500);
    igual('y no hay comparacion que hacer', r._json.comparativa, null);
  }

  {
    /* --- 4d. EL ORIGEN se puede cambiar, y se mide desde ahi --- */
    METROS = 400000;
    const r = await pide({ clave: CLAVE, dias: 3,
      origen: { direccion: 'Puerto Vallarta, Jalisco, México', placeId: 'ChIJ_orig1' },
      destino: punto('Bernal, Querétaro, México') });
    igual('se midio desde el origen que se le dijo',
      JSON.stringify(TRAMOS[0].de).indexOf('ChIJ_orig1') >= 0, true);
    igual('y el viaje lo dice', r._json.viaje.desde, 'Puerto Vallarta, Jalisco, México');

    /* --------------------------------------------------------------
       ESTA ASERCION CAMBIO DE LADO, Y ESTABA VERDE POR EL DEFECTO

       Decia `saleDeCasa === false`, y pasaba. Pero este origen NO trae
       coordenadas —solo texto y placeId— asi que no habia forma de saber
       a que distancia estaba. Salia `false` porque `isFinite(null)` da
       true en JavaScript: se medía la distancia de Guadalajara al 0,0 del
       Golfo de Guinea, doce mil kilometros, y claro que daba «lejos».

       O sea que la prueba comprobaba el resultado correcto por el camino
       equivocado, y se hubiera quedado verde con cualquier origen del
       mundo. Sin coordenadas la respuesta buena es `null`: no se puede
       saber. Que se sepa de verdad se prueba abajo, con coordenadas.
       -------------------------------------------------------------- */
    igual('sin coordenadas no se puede saber si es de casa', r._json.viaje.saleDeCasa, null);
  }

  {
    /* --- 4e. sin origen, sale de la base --- */
    const r = await pide({ clave: CLAVE, destino: punto('Bernal, Querétaro, México'), dias: 3 });
    igual('sin decir origen, sale de la base',
      r._json.viaje.desde, 'San Pedro Tlaquepaque, Jalisco, México');
    igual('y eso SI es de casa', r._json.viaje.saleDeCasa, true);
    igual('a cero km de casa', r._json.viaje.aCuantoDeCasa, 0);
  }

  {
    /* --- 4f. precio de lista con origen lejano ---
       Monterrey NO es un origen dictado, así que Vallarta le cuesta los
       mismos $19,000 de lista. Eso es una DECISION del dueño, no un
       descuido: el 28-ago-2026 acotó la regla del origen a «solo el radio
       de Ocotlán», y un número que él no escribió no se cobra (R12).

       Esta aserción fue y volvió el mismo día. Primero decía $19,000
       documentando un hueco; luego $34,800 cuando le puse un respaldo por
       kilómetros; y al acotarlo él, volvió a $19,000 — ahora por regla, no
       por hueco. El aviso de abajo es lo que sigue importando: la pantalla
       tiene que ACUSAR que no sale de casa, para que la oficina lo vea. */
    METROS = 700000;                                    // 1,400 km ida y vuelta
    const r = await pide({ clave: CLAVE, dias: 3,
      origen: { direccion: 'Monterrey, Nuevo León, México', lat: 25.6866, lng: -100.3161 },
      destino: punto(VALLARTA) });
    igual('sin origen dictado, manda el precio de lista', r._json.total, 19000);
    igual('y no se le suma nada por la salida', r._json.salida.importe, 0);
    igual('porque Monterrey no está entre los orígenes conocidos',
      r._json.salida.origenesConocidos.indexOf('Monterrey'), -1);
    igual('pero se acusa que NO sale de casa', r._json.viaje.saleDeCasa, false);
    cierto('y se dice a cuanto esta', r._json.viaje.aCuantoDeCasa > 500);
    //  6,500 + 1,400 × 22 = 37,300 contra 19,000 de lista: 18,300 de menos
    igual('con la comparacion enfrente', r._json.comparativa.diferencia, 18300);
  }

  {
    /* --- 4f-bis. UN ORIGEN SIN COORDENADAS NO ESTA «LEJOS DE CASA» ---
       `isFinite(null)` da **true** en JavaScript, porque coacciona a 0 antes
       de mirar. Con eso, un origen escrito a mano —que no trae coordenadas—
       se comparaba contra el 0,0 del Golfo de Guinea y salia «a 12,000 km de
       casa», con su aviso rojo y todo.

       Es la MISMA trampa que en _rutas.js, cometida otra vez en el archivo
       de al lado. Sin coordenadas la respuesta correcta no es «lejos»: es
       «no se puede saber». */
    METROS = 300000;
    const r = await pide({ clave: CLAVE, dias: 3,
      origen: { direccion: 'Bodega en la carretera a Chapala', lat: null, lng: null },
      destino: punto(VALLARTA) });
    igual('un origen sin coordenadas no dice ni que si ni que no',
      r._json.viaje.saleDeCasa, null);
    igual('y no inventa una distancia', r._json.viaje.aCuantoDeCasa, null);
    igual('pero el viaje se cotiza igual', r._json.total, 19000);

    /* y con coordenadas de verdad, si contesta */
    const conCoords = await pide({ clave: CLAVE, dias: 3,
      origen: { direccion: 'Zapopan, Jalisco, México', lat: 20.6719, lng: -103.4165 },
      destino: punto(VALLARTA) });
    igual('con coordenadas de casa, si sabe que es de casa',
      conCoords._json.viaje.saleDeCasa, true);
  }

  {
    /* --- 4g. si Google no encuentra ruta --- */
    MIDE = false;
    const deLista = await pide({ clave: CLAVE, destino: punto(VALLARTA), dias: 4 });
    igual('sin ruta, un destino de lista SIGUE teniendo precio', deLista._json.total, 19000);
    igual('pero se dice que no se midio', deLista._json.traslado.seMidio, false);
    cierto('con su motivo', /no encontró ruta/i.test(deLista._json.traslado.porQueNoSeMidio));
    igual('y no hay comparacion posible', deLista._json.comparativa, null);

    const sinLista = await pide({ clave: CLAVE, destino: punto('Bernal, Querétaro, México'), dias: 4 });
    igual('sin ruta y fuera de la lista, no hay precio que inventar', sinLista._status, 422);
    MIDE = true;
  }

  {
    /* --- 4h. sin clave de rutas configurada --- */
    delete process.env.GOOGLE_ROUTES_KEY;
    const deLista = await pide({ clave: CLAVE, destino: punto(VALLARTA), dias: 4 });
    igual('sin GOOGLE_ROUTES_KEY, la lista sigue contestando', deLista._json.total, 19000);
    igual('sin gastar una llamada', TRAMOS.length, 0);
    cierto('y lo explica', /GOOGLE_ROUTES_KEY/.test(deLista._json.traslado.porQueNoSeMidio));

    const sinLista = await pide({ clave: CLAVE, destino: punto('Bernal, Querétaro, México'), dias: 4 });
    igual('pero lo que hay que medir, no', sinLista._status, 422);
    process.env.GOOGLE_ROUTES_KEY = 'de_mentiras';
  }

  /* ============ 5. LO QUE ENSEÑA ES LO QUE SE COBRA ============
     Se compara contra `calcula` —la misma funcion que usan /api/cotizar y
     /api/pagar— en varios viajes distintos. Si esta pantalla calculara por
     su cuenta, revisaria costos que no son los de verdad. */
  {
    METROS = 300000;                                     // 600 km ida y vuelta
    const CASOS = [
      ['Vallarta 4 dias, sin movimientos', VALLARTA, 4, []],
      ['Vallarta 4 dias, movimientos en 2', VALLARTA, 4,
        [{ horaInicio: '08:00', horaFin: '16:00' }, { horaInicio: '08:00', horaFin: '21:00' }]],
      ['CDMX 3 dias, movimientos los 3', 'Ciudad de México, Ciudad de México, México', 3,
        [{ horaInicio: '08:00', horaFin: '16:00' }, { horaInicio: '08:00', horaFin: '16:00' },
         { horaInicio: '08:00', horaFin: '16:00' }]],
      ['Huasteca 4 dias, horas largas', 'Huasteca Potosina, San Luis Potosí, México', 4,
        [{ horaInicio: '07:00', horaFin: '21:00' }, { horaInicio: '06:00', horaFin: '20:30' }]],
      ['Chapala 7 dias, donde manda el piso', 'Chapala, Jalisco, México', 7, []],
      ['Bernal 5 dias, por formula', 'Bernal, Querétaro, México', 5, []],
      ['Bernal 2 dias con movimientos', 'Bernal, Querétaro, México', 2,
        [{ horaInicio: '08:00', horaFin: '17:30' }]]
    ];

    const rotos = [];
    for (const [nombre, direccion, dias, movs] of CASOS) {
      const p1 = punto(direccion);
      const r = await pide({ clave: CLAVE, destino: p1, dias: dias, movimientos: movs });
      /* la cuenta de verdad, por la misma puerta que cobra */
      const p = tarifa.calcula(600, dias, { noches: dias - 1, movimientos: movs, destino: p1 });
      if (r._json.total !== p.total || r._json.anticipo !== p.anticipo) {
        rotos.push({ nombre, pantalla: r._json.total, seCobra: p.total });
      }
      /* Son CUATRO partes desde el 28-ago-2026: el recargo por salir de otro
         lado es la cuarta. Sin sumarlo aquí, esta prueba se puso roja en el
         caso de Chapala —y tenía razón: la pantalla enseñaba un desglose que
         no cuadraba con su propio total. */
      const partes = r._json.traslado.final + r._json.estadia.importe +
        r._json.movimientos.importe + r._json.salida.importe;
      if (partes !== r._json.total) rotos.push({ nombre, partes: partes, total: r._json.total });
    }
    igual('los ' + CASOS.length + ' casos: la pantalla enseña lo que se cobra', rotos, []);
    if (rotos.length) console.log('   ' + JSON.stringify(rotos, null, 1));
  }

  /* ============ 6. LOS CASOS FEOS ============ */
  {
    igual('sin destino, lo dice y no revienta',
      (await pide({ clave: CLAVE, dias: 4 }))._status, 400);
    igual('un destino de una letra tampoco pasa',
      (await pide({ clave: CLAVE, dias: 4, destino: { direccion: 'x' } }))._status, 400);

    /* Dias fuera de rango: se acotan, no se creen. Sin tope, «dias: 99999»
       haria 99,999 vueltas al pintar y colgaria la pantalla. */
    igual('99,999 dias se acotan a 60',
      (await pide({ clave: CLAVE, destino: punto(VALLARTA), dias: 99999 }))._json.viaje.dias, 60);
    igual('0 dias se levanta a 1',
      (await pide({ clave: CLAVE, destino: punto(VALLARTA), dias: 0 }))._json.viaje.dias, 1);
    igual('dias negativos tambien',
      (await pide({ clave: CLAVE, destino: punto(VALLARTA), dias: -5 }))._json.viaje.dias, 1);

    igual('movimientos que no son lista: ninguno',
      (await pide({ clave: CLAVE, destino: punto(VALLARTA), dias: 3, movimientos: 'muchos' }))
        ._json.movimientos.dias, 0);

    /* Mas dias con movimiento que dias de servicio: se acotan igual que en
       la puerta que cobra. Si aqui se contaran mas, el dueño revisaria un
       costo mas alto del que se cobra. */
    const seis = [];
    for (let i = 0; i < 6; i++) seis.push({ horaInicio: '08:00', horaFin: '16:00' });
    igual('seis movimientos en un viaje de 2 dias: solo 2',
      (await pide({ clave: CLAVE, destino: punto(VALLARTA), dias: 2, movimientos: seis }))
        ._json.movimientos.dias, 2);

    /* Un origen que es basura cae en la base, no revienta */
    const conBasura = await pide({ clave: CLAVE, destino: punto(VALLARTA), dias: 3, origen: 12345 });
    igual('un origen que no es objeto cae en la base',
      conBasura._json.viaje.desde, 'San Pedro Tlaquepaque, Jalisco, México');

    /* Un placeId con caracteres raros se descarta, pero la direccion salva */
    const raro = await pide({ clave: CLAVE, dias: 3,
      destino: { direccion: VALLARTA, placeId: '../../etc/passwd' } });
    igual('un placeId con basura no tumba nada', raro._status, 200);
    igual('y el destino se reconoce por su texto', raro._json.traslado.deLista,
      'Puerto Vallarta y alrededores');
  }

  console.log('\n' + buenas + ' buenas, ' + malas + ' malas');
  process.exit(malas ? 1 : 0);
})();
