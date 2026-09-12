/* ============================================================
   EL PRECIO QUE SE GUARDA, Y EL QUE SE PIERDE (11-sep-2026)
   ============================================================
   `guardaPrecio` es la función que aprende: un renglón por cada precio
   que el dueño dicta. Hasta hoy **no tenía ni una prueba** —se contó:
   cero archivos de `pruebas/` la mencionaban— y se descubrió el mismo
   día en que se comprobó que la tabla `precios` NO EXISTE en Supabase.

   Meses de precios dictados que no se guardaron en ningún lado.

   Lo que esta batería cuida, por orden de importancia:

     1. Que cuando el guardado falla, QUEDE ESCRITO el renglón entero.
        Ese log es lo único que queda de ese precio: con él se repone a
        mano, sin él se perdió.
     2. Que un fallo de la base NO tumbe la conversación. El cliente
        tiene que recibir su precio aunque el aprendizaje esté roto.
     3. Que no se guarde basura: sin clave o sin total no hay renglón.

   Las tres se prueban con una puerta de mentiras, igual que se prueban
   Meta y EuroSystem: sin red y sin tocar ninguna base de verdad.
   ============================================================ */
'use strict';

const path = require('path');
const RAIZ = path.join(__dirname, '..');

let buenas = 0, malas = 0;
function ok(que, condicion) {
  if (condicion) { buenas++; console.log('ok   ' + que); }
  else { malas++; console.log('FALLA ' + que); }
}
function titulo(t) { console.log('\n== ' + t.toUpperCase() + ' =='); }

/* ------------------------------------------------------------
   La puerta de mentiras
   ------------------------------------------------------------
   `_almacen.js` se enciende con ALMACEN_URL y ALMACEN_CLAVE y habla por
   `fetch`. Se le ponen las dos variables y se le cambia el `fetch` por
   uno que contesta lo que diga cada prueba. */
function conAlmacen(queContesta) {
  const antesUrl = process.env.ALMACEN_URL;
  const antesClave = process.env.ALMACEN_CLAVE;
  const antesFetch = global.fetch;
  const antesError = console.error;

  process.env.ALMACEN_URL = 'https://mentiras.supabase.co';
  process.env.ALMACEN_CLAVE = 'clave-de-mentiras';

  const pedidos = [];
  const gritos = [];
  global.fetch = function (url, opciones) {
    pedidos.push({ url: String(url), opciones: opciones || {} });
    return Promise.resolve(queContesta(String(url), opciones || {}));
  };
  console.error = function () {
    gritos.push(Array.prototype.slice.call(arguments).join(' '));
  };

  /* Se recarga el módulo para que lea las variables nuevas. */
  delete require.cache[require.resolve(path.join(RAIZ, 'api/_almacen.js'))];
  const almacen = require(path.join(RAIZ, 'api/_almacen.js'));

  return {
    almacen: almacen, pedidos: pedidos, gritos: gritos,
    suelta: function () {
      global.fetch = antesFetch;
      console.error = antesError;
      if (antesUrl === undefined) delete process.env.ALMACEN_URL;
      else process.env.ALMACEN_URL = antesUrl;
      if (antesClave === undefined) delete process.env.ALMACEN_CLAVE;
      else process.env.ALMACEN_CLAVE = antesClave;
      delete require.cache[require.resolve(path.join(RAIZ, 'api/_almacen.js'))];
    }
  };
}

/* Un renglón como el que arma `_precios-aprendidos.js`. */
const RENGLON = {
  clave: 'gdl|chapala|irizar-i6s|2',
  total: 12500,
  anticipo: 1500,
  pasajeros: 40,
  salida: '2026-12-20',
  fijado: true,
  cuando: '2026-09-11T18:00:00.000Z'
};

titulo('cuando la base contesta bien');
(async function () {
  const p = conAlmacen(function () {
    return { ok: true, status: 201, text: async function () { return ''; },
      json: async function () { return []; } };
  });
  try {
    const guardo = await p.almacen.guardaPrecio(RENGLON);
    ok('dice que sí guardó', guardo === true);
    ok('  y le pegó a la tabla precios',
      p.pedidos.some(function (x) { return /\/rest\/v1\/precios$/.test(x.url); }));
    ok('  con el renglón entero en el cuerpo', p.pedidos.some(function (x) {
      const c = String(x.opciones.body || '');
      return c.indexOf('12500') >= 0 && c.indexOf('chapala') >= 0;
    }));
    ok('  y sin gritar nada', p.gritos.length === 0);
  } finally { p.suelta(); }

  titulo('cuando la tabla NO existe · el caso de hoy');
  {
    /* Esto es exactamente lo que está pasando en producción: la tabla
       `precios` no se creó nunca, así que PostgREST contesta 404. */
    const q = conAlmacen(function () {
      return { ok: false, status: 404,
        text: async function () { return '{"message":"relation \\"precios\\" does not exist"}'; },
        json: async function () { return {}; } };
    });
    try {
      const guardo = await q.almacen.guardaPrecio(RENGLON);
      ok('dice que NO guardó', guardo === false);
      /* La parte que importa: sin esto, el precio se perdió sin rastro. */
      const rastro = q.gritos.join(' | ');
      ok('deja escrito que se perdió un precio', /precio-perdido/.test(rastro));
      ok('  con el total, para poder reponerlo', /12500/.test(rastro));
      ok('  y con el viaje, para saber cuál era', /chapala/.test(rastro));
    } finally { q.suelta(); }
  }

  titulo('un fallo de la base no tumba la conversación');
  {
    /* Si la red se cae a media llamada, `fetch` revienta. El cliente
       tiene que recibir su precio igual: lo que se rompe es el
       aprendizaje, no la venta. */
    const q = conAlmacen(function () { throw new Error('sin red'); });
    try {
      let trono = false, guardo = null;
      try { guardo = await q.almacen.guardaPrecio(RENGLON); }
      catch (e) { trono = true; }
      ok('no revienta', trono === false);
      ok('  y avisa que no guardó', guardo === false);
    } finally { q.suelta(); }
  }

  titulo('no se guarda basura');
  {
    const q = conAlmacen(function () {
      return { ok: true, status: 201, text: async function () { return ''; },
        json: async function () { return []; } };
    });
    try {
      const malos = [
        [null, 'nada'],
        [{ total: 1000 }, 'sin clave'],
        [{ clave: 'x' }, 'sin total'],
        [{ clave: 'x', total: 0 }, 'total en cero'],
        [{ clave: 'x', total: -500 }, 'total negativo']
      ];
      for (const [r, porque] of malos) {
        const antes = q.pedidos.length;
        const guardo = await q.almacen.guardaPrecio(r);
        ok('«' + porque + '» no se guarda', guardo === false && q.pedidos.length === antes);
      }
    } finally { q.suelta(); }
  }

  titulo('con el almacén apagado no se intenta siquiera');
  {
    const antesUrl = process.env.ALMACEN_URL;
    const antesClave = process.env.ALMACEN_CLAVE;
    delete process.env.ALMACEN_URL;
    delete process.env.ALMACEN_CLAVE;
    delete require.cache[require.resolve(path.join(RAIZ, 'api/_almacen.js'))];
    const almacen = require(path.join(RAIZ, 'api/_almacen.js'));
    try {
      ok('el almacén se reporta apagado', almacen.hayAlmacen() === false);
      const guardo = await almacen.guardaPrecio(RENGLON);
      ok('  y guardar devuelve que no', guardo === false);
    } finally {
      if (antesUrl !== undefined) process.env.ALMACEN_URL = antesUrl;
      if (antesClave !== undefined) process.env.ALMACEN_CLAVE = antesClave;
      delete require.cache[require.resolve(path.join(RAIZ, 'api/_almacen.js'))];
    }
  }

  console.log('\n' + buenas + ' buenas, ' + malas + ' malas');
  process.exit(malas ? 1 : 0);
})();
