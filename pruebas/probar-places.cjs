/* ============================================================
   El autocompletado: solo México, y que de verdad conteste
   ------------------------------------------------------------
       node pruebas/probar-places.cjs

   Dos cosas, y la segunda estaba rota en produccion sin que
   nadie lo viera:

   1. SOLO MEXICO. Eurotravel no hace viajes al extranjero, asi
      que una sugerencia de fuera solo sirve para que alguien
      elija un destino que no se puede cotizar.

   2. EL CERCO Y EL FILTRO DE PAIS NO PUEDEN IR JUNTOS. Iban, y
      Google rechazaba la peticion ENTERA: el buscador de
      direccion exacta —el que sale despues de elegir la ciudad,
      para marcar el hotel o el domicilio— no devolvia nada.
      Nunca. Y fallaba en silencio, porque la pagina trata el
      error igual que «no hay coincidencias».

      Se comprobo contra produccion con el mismo texto: sin
      cerco, cinco sugerencias; con cerco, «Google rechazo la
      solicitud».
   ============================================================ */
'use strict';

let buenas = 0, malas = 0;
function igual(nombre, dio, esperado) {
  const a = JSON.stringify(dio), b = JSON.stringify(esperado);
  if (a === b) { buenas++; console.log('ok   ' + nombre); }
  else { malas++; console.log('MAL  ' + nombre + '\n     dio      ' + a + '\n     esperaba ' + b); }
}
function cierto(nombre, v) { igual(nombre, !!v, true); }

process.env.GOOGLE_PLACES_KEY = 'de_mentiras';

/* Google, fingido. Apunta la peticion que le llego —que es la mitad de lo
   que hay que comprobar— y contesta las sugerencias que se le pongan. */
let PETICION = null;
let RESPUESTA = { suggestions: [] };
global.fetch = function (url, opc) {
  const u = String(url);
  if (u.indexOf('places.googleapis.com') < 0) {
    return Promise.reject(new Error('esta prueba no debe llamar a ' + u));
  }
  PETICION = opc.body ? JSON.parse(opc.body) : null;
  return Promise.resolve({ ok: true, json: () => Promise.resolve(RESPUESTA) });
};

const places = require('../api/places.js');

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
    'x-vercel-forwarded-for': '10.5.' + Math.floor(corrida / 250) + '.' + (corrida % 250)
  };
}

/* Una sugerencia como las arma Google */
function sug(id, principal, secundario) {
  return {
    placePrediction: {
      placeId: id,
      text: { text: principal + (secundario ? ', ' + secundario : '') },
      structuredFormat: { mainText: { text: principal }, secondaryText: { text: secundario || '' } }
    }
  };
}

async function busca(cuerpo) {
  PETICION = null;
  const r = res();
  await places({ method: 'POST', headers: cabeceras(), body: Object.assign({ accion: 'autocomplete' }, cuerpo) }, r);
  return r;
}

(async function () {

  /* ============ 1. EL CERCO NO PUEDE LLEVAR FILTRO DE PAIS ============
     Es la parte que estaba rota. Si esto se rompe otra vez, el buscador de
     direccion exacta se queda mudo y NADA lo grita. */
  {
    await busca({ input: 'Av Vallarta', pais: 'mx' });
    igual('sin cerco, se le pide a Google solo México',
      PETICION.includedRegionCodes, ['mx']);
    igual('y sin cerco', PETICION.locationRestriction, undefined);

    await busca({ input: 'Av Vallarta', pais: 'mx', centroLat: 20.6597, centroLng: -103.3496, radio: 60000 });
    cierto('con cerco, el cerco se manda', !!PETICION.locationRestriction);
    igual('y el filtro de pais NO, porque juntos Google rechaza todo',
      PETICION.includedRegionCodes, undefined);
    igual('el cerco lleva su centro y su radio',
      [PETICION.locationRestriction.circle.center.latitude,
       PETICION.locationRestriction.circle.radius], [20.6597, 60000]);
  }

  /* ============ 2. EL RADIO, ACOTADO ============ */
  {
    await busca({ input: 'hotel', centroLat: 20.6, centroLng: -103.3, radio: 999999999 });
    igual('un radio enorme se acota a 200 km', PETICION.locationRestriction.circle.radius, 200000);
    await busca({ input: 'hotel', centroLat: 20.6, centroLng: -103.3, radio: 1 });
    igual('y uno diminuto sube a 5 km', PETICION.locationRestriction.circle.radius, 5000);
  }

  /* ============ 3. UN CENTRO QUE NO ES CENTRO ============
     `Number(null)` da 0, y 0,0 es una coordenada valida —en el Golfo de
     Guinea—. Un centro nulo tiene que caer en «sin cerco», no en «cerco
     en medio del oceano», que dejaria la lista vacia para siempre. */
  {
    await busca({ input: 'hotel', pais: 'mx', centroLat: null, centroLng: null });
    igual('un centro nulo NO arma cerco', PETICION.locationRestriction, undefined);
    igual('y entonces si va el filtro de pais', PETICION.includedRegionCodes, ['mx']);

    await busca({ input: 'hotel', pais: 'mx', centroLat: 0, centroLng: 0 });
    igual('el 0,0 literal tampoco arma cerco', PETICION.locationRestriction, undefined);

    await busca({ input: 'hotel', pais: 'mx', centroLat: 'veinte', centroLng: 'menos ciento tres' });
    igual('un centro de letras tampoco', PETICION.locationRestriction, undefined);
  }

  /* ============ 4. SOLO MEXICO, DECIDIDO AQUI ============
     Con cerco no se le puede pedir a Google, asi que este filtro es la
     unica defensa en ese camino. */
  {
    RESPUESTA = { suggestions: [
      sug('a1', 'Chapala', 'Jal., México'),
      sug('a2', 'Hotel Real', 'Zapopan, Jal., México'),
      sug('a3', 'San Diego', 'CA, EE. UU.'),
      sug('a4', 'Chula Vista', 'California, Estados Unidos'),
      sug('a5', 'Ciudad de Guatemala', 'Guatemala'),
      sug('a6', 'Vancouver', 'BC, Canadá'),
      sug('a7', 'Mérida', 'Yuc., México')
    ]};
    const r = await busca({ input: 'lo que sea', centroLat: 32.5, centroLng: -117.0, radio: 60000 });
    igual('solo pasan los de México',
      r._json.suggestions.map(function (s) { return s.id; }), ['a1', 'a2', 'a7']);

    /* Vancouver es el caso fino: «BC» tambien es Baja California, asi que
       los paises de fuera se revisan ANTES que las abreviaturas. */
    igual('Vancouver no se cuela por su «BC»',
      r._json.suggestions.filter(function (s) { return s.principal === 'Vancouver'; }), []);

    /* Y no se le manda al navegador el campo con el que se decidio */
    igual('no sale el texto interno del filtro',
      Object.keys(r._json.suggestions[0]).sort(), ['id', 'principal', 'secundario']);
  }

  /* ============ 5. LOS DE MEXICO NO SE CAEN ============
     El riesgo del filtro es al reves: que se lleve lo bueno. En una busqueda
     con cerco Google a veces omite el pais —el cerco ya lo implica— y deja
     solo la abreviatura del estado. Sin eso contemplado, la lista se
     vaciaria y seria peor que el defecto que esto arregla. */
  {
    RESPUESTA = { suggestions: [
      sug('b1', 'Av. Vallarta 1234', 'Americana, Guadalajara, Jal.'),
      sug('b2', 'Hotel Riu', 'Nuevo Vallarta, Nay.'),
      sug('b3', 'Calle Morelos', 'Centro, Oax.'),
      sug('b4', 'Playa Norte', 'Q Roo'),
      sug('b5', 'Zócalo', 'CDMX'),
      sug('b6', 'Hotel del Centro', 'Monterrey, N.L.')
    ]};
    /* Ojo con el texto: con menos de 3 letras el endpoint ni pregunta y
       devuelve lista vacia. La primera version de esta prueba usaba «x» y
       fallaba por eso, no por el filtro. */
    const r = await busca({ input: 'hotel', centroLat: 20.6, centroLng: -103.3, radio: 60000 });
    igual('las abreviaturas de estado cuentan como México',
      r._json.suggestions.map(function (s) { return s.id; }),
      ['b1', 'b2', 'b3', 'b4', 'b5', 'b6']);
  }

  /* ============ 6. ACENTOS Y MAYUSCULAS ============ */
  {
    RESPUESTA = { suggestions: [
      sug('c1', 'Cancún', 'Q. Roo, MÉXICO'),
      sug('c2', 'Tijuana', 'B.C., Mexico'),
      sug('c3', 'Phoenix', 'AZ, EE.UU.')
    ]};
    const r = await busca({ input: 'playa', centroLat: 20.6, centroLng: -103.3 });
    igual('«MÉXICO» y «Mexico» valen igual',
      r._json.suggestions.map(function (s) { return s.id; }), ['c1', 'c2']);
  }

  /* ============ 7. LO DE SIEMPRE SIGUE PUESTO ============ */
  {
    RESPUESTA = { suggestions: [sug('d1', 'Chapala', 'Jal., México')] };

    const corto = await busca({ input: 'ab' });
    igual('menos de 3 letras ni se le pregunta a Google', corto._json.suggestions, []);

    const r1 = res();
    await places({ method: 'GET', headers: cabeceras(), body: {} }, r1);
    igual('por GET no contesta', r1._status, 405);

    const r2 = res();
    await places({ method: 'POST', headers: { origin: 'https://sitio-ajeno.com' }, body: {} }, r2);
    igual('desde otro sitio tampoco', r2._status, 403);

    /* Sin clave el sitio no se rompe: se escribe la direccion a mano */
    const guardada = process.env.GOOGLE_PLACES_KEY;
    delete process.env.GOOGLE_PLACES_KEY;
    const sinClave = await busca({ input: 'Chapala' });
    igual('sin clave configurada, 503 y no revienta', sinClave._status, 503);
    process.env.GOOGLE_PLACES_KEY = guardada;

    /* Y un error de Google no se le enseña al cliente tal cual */
    RESPUESTA = { error: { message: 'API key not valid', status: 'INVALID_ARGUMENT' } };
    const conError = await busca({ input: 'Chapala' });
    igual('un error de Google sale como 502', conError._status, 502);
    igual('sin filtrar lo que dijo Google',
      JSON.stringify(conError._json).indexOf('API key'), -1);
  }

  console.log('\n' + buenas + ' buenas, ' + malas + ' malas');
  process.exit(malas ? 1 : 0);
})();
