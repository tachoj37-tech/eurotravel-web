/* ============================================================
   La pantalla temporal de costos, y su candado
   ------------------------------------------------------------
       node pruebas/probar-prueba-cotizador.cjs

   Esta puerta devuelve JUSTO lo que las otras esconden: el
   kilometraje, la tarifa por kilometro, lo que vale la noche y
   lo que vale el dia de movimientos.

   Por eso lo unico que de verdad hay que probar aqui no son las
   cuentas —esas ya las prueban las otras nueve baterias, y salen
   de la MISMA funcion— sino el candado:

     · sin CLAVE_COTIZADOR configurada, no contesta NADA
     · con clave mala, tampoco
     · y lo que contesta con clave buena cuadra con lo que se
       cobra de verdad

   Ese ultimo punto importa tanto como el candado: una pantalla
   para revisar costos que enseñara numeros distintos de los que
   se cobran seria peor que no tenerla.
   ============================================================ */
'use strict';

let buenas = 0, malas = 0;
function igual(nombre, dio, esperado) {
  const a = JSON.stringify(dio), b = JSON.stringify(esperado);
  if (a === b) { buenas++; console.log('ok   ' + nombre); }
  else { malas++; console.log('MAL  ' + nombre + '\n     dio      ' + a + '\n     esperaba ' + b); }
}
function cierto(nombre, v) { igual(nombre, !!v, true); }

/* No hay red: si algo intentara salir, esto lo caza. */
global.fetch = function (url) {
  return Promise.reject(new Error('esta prueba no debe salir a la red: ' + url));
};

const puerta = require('../api/prueba-cotizador.js');
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

/* Un destino de la LISTA de precios: asi no hace falta medir con Google y la
   prueba corre sin red de ninguna clase. */
const VALLARTA = { direccion: 'Puerto Vallarta, Jalisco, México', placeId: 'ChIJ_pv' };

async function pide(cuerpo) {
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
    const r = await pide({ clave: '', destino: VALLARTA, dias: 4 });
    igual('sin CLAVE_COTIZADOR no contesta', r._status, 503);
    igual('y lo dice sin dar datos', r._json.error, 'sin clave');
    cierto('el aviso explica que hay que ponerla en Vercel',
      /CLAVE_COTIZADOR/.test(r._json.aviso));
  }
  {
    /* Y tampoco abre inventandose una clave: sin variable, NINGUNA clave
       sirve. Si esto contestara 200, la puerta estaria abierta de par en par. */
    const r = await pide({ clave: 'loquesea', destino: VALLARTA, dias: 4 });
    igual('sin variable, ninguna clave abre', r._status, 503);
  }

  /* ============ 2. CON CLAVE, PERO EQUIVOCADA ============ */
  process.env.CLAVE_COTIZADOR = 'la-buena-de-verdad-2026';
  {
    const r = await pide({ clave: 'la-buena-de-verda', destino: VALLARTA, dias: 4 });
    igual('una clave parecida no abre', r._status, 401);
    igual('ni la vacia', (await pide({ clave: '', destino: VALLARTA, dias: 4 }))._status, 401);
    igual('ni sin mandarla', (await pide({ destino: VALLARTA, dias: 4 }))._status, 401);
    igual('ni la buena con un espacio pegado',
      (await pide({ clave: 'la-buena-de-verdad-2026 ', destino: VALLARTA, dias: 4 }))._status, 401);
    igual('ni cambiada de mayusculas',
      (await pide({ clave: 'LA-BUENA-DE-VERDAD-2026', destino: VALLARTA, dias: 4 }))._status, 401);

    /* Y que lo que devuelve al rechazar NO traiga ni un numero del precio */
    cierto('al rechazar no se le escapa ningun costo',
      JSON.stringify(r._json).match(/km|tarifa|traslado|\d{4}/i) === null);
  }

  /* ============ 3. LA PUERTA COMUN SIGUE PUESTA ============
     El candado nuevo no puede haber saltado las defensas de siempre. */
  {
    const r1 = res();
    await puerta({ method: 'GET', headers: cabeceras(), body: {} }, r1);
    igual('por GET no contesta', r1._status, 405);

    const r2 = res();
    await puerta({ method: 'POST', headers: { origin: 'https://sitio-ajeno.com' }, body: {} }, r2);
    igual('desde otro sitio tampoco', r2._status, 403);
  }

  /* ============ 4. CON LA CLAVE BUENA, ENSEÑA LA COCINA ============ */
  {
    const r = await pide({ clave: 'la-buena-de-verdad-2026', destino: VALLARTA, dias: 4 });
    igual('con la clave buena, abre', r._status, 200);

    const d = r._json;
    igual('Vallarta sale de la lista, no de los kilometros',
      d.traslado.deLista, 'Puerto Vallarta y alrededores');
    igual('y por eso no se midio nada', [d.traslado.seMidio, d.traslado.km], [false, null]);
    igual('4 dias son 3 noches', [d.viaje.dias, d.viaje.noches], [4, 3]);
    igual('sus 19,000 de lista', d.total, 19000);

    /* Aqui SI tiene que salir lo que en las otras puertas no sale. Si esto
       dejara de salir, la pantalla dejaria de servir para lo que existe. */
    cierto('enseña el minimo por dia', d.traslado.pisoPorDia === tarifa.MINIMO_POR_DIA);
    cierto('enseña lo que vale la noche', d.estadia.porNoche === tarifa.EXTRA_POR_NOCHE);
    cierto('y las bandas de los movimientos',
      Array.isArray(d.movimientos.bandas) && d.movimientos.bandas.length === 5);
  }

  /* ============ 5. LO QUE ENSEÑA ES LO QUE SE COBRA ============
     Se compara contra `calcula` —la misma funcion que usan /api/cotizar y
     /api/pagar— en varios viajes distintos. Si esta pantalla calculara por
     su cuenta, revisaria costos que no son los de verdad. */
  {
    const CASOS = [
      ['Vallarta 4 dias, sin movimientos', VALLARTA, 4, []],
      ['Vallarta 4 dias, movimientos en 2', VALLARTA, 4,
        [{ horaInicio: '08:00', horaFin: '16:00' }, { horaInicio: '08:00', horaFin: '21:00' }]],
      ['CDMX 3 dias, movimientos los 3',
        { direccion: 'Ciudad de México, Ciudad de México, México' }, 3,
        [{ horaInicio: '08:00', horaFin: '16:00' }, { horaInicio: '08:00', horaFin: '16:00' },
         { horaInicio: '08:00', horaFin: '16:00' }]],
      ['Huasteca 4 dias, horas largas',
        { direccion: 'Huasteca Potosina, San Luis Potosí, México' }, 4,
        [{ horaInicio: '07:00', horaFin: '21:00' }, { horaInicio: '06:00', horaFin: '20:30' }]],
      ['Chapala 7 dias, donde manda el piso',
        { direccion: 'Chapala, Jalisco, México' }, 7, []]
    ];

    const rotos = [];
    for (const [nombre, destino, dias, movs] of CASOS) {
      const r = await pide({ clave: 'la-buena-de-verdad-2026', destino: destino, dias: dias, movimientos: movs });
      /* la cuenta de verdad, por la misma puerta que cobra */
      const p = tarifa.calcula(0, dias, { noches: dias - 1, movimientos: movs, destino: destino });
      if (r._json.total !== p.total || r._json.anticipo !== p.anticipo) {
        rotos.push({ nombre, pantalla: r._json.total, seCobra: p.total });
      }
      /* y sus tres partes tienen que reconstruir el total */
      const partes = r._json.traslado.final + r._json.estadia.importe + r._json.movimientos.importe;
      if (partes !== r._json.total) rotos.push({ nombre, partes: partes, total: r._json.total });
    }
    igual('los ' + CASOS.length + ' casos: la pantalla enseña lo que se cobra', rotos, []);
    if (rotos.length) console.log('   ' + JSON.stringify(rotos, null, 1));
  }

  /* ============ 6. LOS CASOS FEOS ============ */
  {
    const c = 'la-buena-de-verdad-2026';
    igual('sin destino, lo dice y no revienta',
      (await pide({ clave: c, dias: 4 }))._status, 400);

    /* Dias fuera de rango: se acotan, no se creen. Sin tope, «dias: 99999»
       haria 99,999 vueltas al pintar y colgaria la pantalla. */
    const muchos = await pide({ clave: c, destino: VALLARTA, dias: 99999 });
    igual('99,999 dias se acotan a 60', muchos._json.viaje.dias, 60);
    const cero = await pide({ clave: c, destino: VALLARTA, dias: 0 });
    igual('0 dias se levanta a 1', cero._json.viaje.dias, 1);
    const negativo = await pide({ clave: c, destino: VALLARTA, dias: -5 });
    igual('dias negativos tambien', negativo._json.viaje.dias, 1);

    /* Una lista de movimientos que no es lista no puede tumbar nada */
    const basura = await pide({ clave: c, destino: VALLARTA, dias: 3, movimientos: 'muchos' });
    igual('movimientos que no son lista: ninguno', basura._json.movimientos.dias, 0);

    /* Mas dias con movimiento que dias de servicio: se acotan igual que en
       la puerta que cobra. Si aqui se contaran mas, el dueño revisaria un
       costo mas alto del que se cobra. */
    const seis = [];
    for (let i = 0; i < 6; i++) seis.push({ horaInicio: '08:00', horaFin: '16:00' });
    const acotado = await pide({ clave: c, destino: VALLARTA, dias: 2, movimientos: seis });
    igual('seis movimientos en un viaje de 2 dias: solo 2', acotado._json.movimientos.dias, 2);
  }

  console.log('\n' + buenas + ' buenas, ' + malas + ' malas');
  process.exit(malas ? 1 : 0);
})();
