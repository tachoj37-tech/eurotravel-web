/* ============================================================
   B15 · Nadie puede meter mano en una consulta del almacén
   ------------------------------------------------------------
       node pruebas/probar-filtros-del-almacen.cjs

   De la auditoría del 7-sep-2026:

     | B15 | BAJO | `_almacen.js` filtros | Filtros de PostgREST por
     | concatenación; hoy seguro porque todo pasa por `llave()`,
     | pero es deuda.

   POR QUÉ SE PAGA AHORA Y NO «EN CUALQUIER HUECO». El almacén está
   a punto de encenderse —es el pendiente #3— y con R47 los destinos
   que entran a `precios` vienen del campo libre de la página. Una
   deuda que nadie puede alcanzar es deuda; la misma deuda con la
   base prendida y texto de cliente entrando es otra cosa.

   QUÉ ES EL PELIGRO, EN CONCRETO. Los caminos se arman pegando
   texto: `'mensajes?numero=eq.' + k`. PostgREST separa filtros con
   `&`, así que un valor que traiga un `&` no agrega un dato: agrega
   OTRO FILTRO. Y en una base donde cada renglón es la conversación
   de un cliente, un filtro de más es leer la conversación de otro.

   No es inyección de SQL —PostgREST no ejecuta SQL del cliente—,
   es que se puede cambiar QUÉ RENGLONES DEVUELVE.

   LO QUE SE EXIGE AQUÍ:

     1. Que ningún valor pueda agregar un filtro, por hostil que
        venga. Se prueban `&`, `,`, `%`, comillas y saltos de línea.
     2. Que los topes (`limit`) sean números y nada más.
     3. Que `llave()` siga siendo lo que todo lo demás supone que
        es: diez dígitos, sin nada que PostgREST sepa leer.
   ============================================================ */
'use strict';

process.env.ALMACEN_URL = 'https://base-de-mentiras.supabase.co';
process.env.ALMACEN_CLAVE = 'clave-de-mentiras';

const path = require('path');
const RAIZ = path.join(__dirname, '..');
const almacen = require(path.join(RAIZ, 'api', '_almacen.js'));

let buenas = 0, malas = 0;
function igual(nombre, dio, esperado) {
  const a = JSON.stringify(dio), b = JSON.stringify(esperado);
  if (a === b) { buenas++; console.log('ok   ' + nombre); }
  else { malas++; console.log('MAL  ' + nombre + '\n     dio      ' + a + '\n     esperaba ' + b); }
}
function cierto(nombre, v) { igual(nombre, !!v, true); }

/* La base de mentiras: no contesta datos, solo APUNTA LA URL que le
   pidieron. Es lo único que se está juzgando. */
let urls = [];
global.fetch = function (url) {
  urls.push(String(url));
  return Promise.resolve({
    ok: true,
    json: function () { return Promise.resolve([]); },
    text: function () { return Promise.resolve(''); }
  });
};
function ultima() { return urls[urls.length - 1] || ''; }
function consulta() {
  const u = new URL(ultima());
  const p = {};
  u.searchParams.forEach(function (v, k) { p[k] = (p[k] === undefined) ? v : [].concat(p[k], v); });
  return { ruta: u.pathname, params: p, cuantosNumero: u.searchParams.getAll('numero').length };
}

/* Valores que un atacante escribiría. El primero es el que importa:
   cierra el filtro del número y abre otro con el de alguien más. */
const HOSTIL = '10&numero=eq.3399999999';
const RAROS = ['a&b=c', 'a,b', '100%', "o'brien", 'con espacio', 'salto\nlinea', '*'];

(async function () {

  console.log('--- el tope de una consulta es un número, y nada más ---');

  /* `mensajesDe(numero, cuantos)`: hoy sus tres llamadas pasan un número
     literal, así que esto no es un hueco abierto — es que dejará de
     depender de que el de mañana también lo haga. */
  urls = [];
  await almacen.mensajesDe('3312223344', HOSTIL);
  const c1 = consulta();
  igual('un tope hostil NO agrega un segundo filtro de número', c1.cuantosNumero, 1);
  igual('y el número sigue siendo el que se pidió', c1.params.numero, 'eq.3312223344');
  cierto('el límite queda en un número', /^\d+$/.test(String(c1.params.limit)));

  urls = [];
  await almacen.fichasDelTablero(HOSTIL);
  const c2 = consulta();
  igual('lo mismo en el tablero: ningún filtro colado', c2.cuantosNumero, 0);
  cierto('y su límite también es un número', /^\d+$/.test(String(c2.params.limit)));

  /* Un tope absurdo tampoco puede traerse la base entera. */
  urls = [];
  await almacen.mensajesDe('3312223344', 999999);
  cierto('un tope enorme se acota', Number(consulta().params.limit) <= 500);

  urls = [];
  await almacen.mensajesDe('3312223344', -5);
  cierto('y uno negativo no deja la consulta sin sentido',
    Number(consulta().params.limit) >= 1);

  console.log('\n--- el número del cliente ---');

  /* `llave()` es de lo que depende TODO lo demás: si algún día dejara
     pasar algo que no sea un dígito, cada camino de este archivo se
     vuelve alcanzable. */
  igual('llave() deja solo diez dígitos',
    ['+52 1 33 1222 3344', '521-33-1222-3344', '  3312223344  '].map(almacen.llave),
    ['3312223344', '3312223344', '3312223344']);
  igual('y de un valor hostil no sobrevive nada peligroso',
    almacen.llave('33&numero=eq.99'), '3399');
  cierto('nunca devuelve algo que PostgREST sepa leer',
    !/[&,=%*'"\s]/.test(almacen.llave('33&x=,%*\'" 44')));

  urls = [];
  await almacen.leeFicha('3312223344&select=*');
  igual('y por eso leer una ficha no se puede desviar',
    consulta().cuantosNumero, 1);

  console.log('\n--- el candado del seguimiento no se ablanda ---');

  /* ------------------------------------------------------------
     `marcaToque` no es una consulta cualquiera: es el CANDADO que
     impide que dos corridas del cron le manden el mismo recordatorio
     al mismo cliente. Actualiza «donde numero=X **y toques=de**», así
     que solo gana la corrida que vio el valor que leyó (B9/C13).

     Al escapar los valores estuve a punto de ablandarlo: con `de`
     ilegible, `Number(de) || 0` da CERO, y cero empareja con las
     fichas que no han recibido ningún toque. Un candado que ante la
     duda empareja no es un candado.

     Hoy no es alcanzable —quien llama ya hace `Number(f.toques) || 0`—
     pero la dirección importa: ante un valor que no es un conteo, esto
     no consulta nada.
     ------------------------------------------------------------ */
  for (const malo of ['abc', '1&numero=eq.99', {}, [], NaN, -1, 1.5, null, undefined]) {
    urls = [];
    const r = await almacen.marcaToque('3312223344', malo, 1);
    igual('con un conteo ilegible (' + JSON.stringify(malo === undefined ? 'undefined' : malo) +
      ') no consulta nada', [urls.length, r], [0, false]);
  }

  urls = [];
  await almacen.marcaToque('3312223344', 2, 3);
  cierto('y con un conteo bueno sí consulta', urls.length === 1);
  cierto('  filtrando por ese conteo exacto',
    new URL(ultima()).searchParams.get('toques') === 'eq.2');

  console.log('\n--- los valores de texto libre ---');

  /* La clave de un precio lleva el DESTINO, que lo escribe el cliente
     en la página. Es el único valor de texto libre que llega a un
     filtro, y con R47 ahora llegan todos por ahí. */
  for (const raro of RAROS) {
    urls = [];
    await almacen.preciosParecidos('zmg|' + raro + '|sprinter|1', 5);
    const c = consulta();
    const claves = new URL(ultima()).searchParams.getAll('clave');
    igual('destino «' + raro.replace(/\n/g, '\\n') + '»: un solo filtro de clave',
      claves.length, 1);
    cierto('  y no coló ningún parámetro de más',
      Object.keys(c.params).every(function (k) {
        return ['clave', 'select', 'order', 'limit'].indexOf(k) >= 0;
      }));
  }

  /* Y el ticket, que lo pone Meta pero llega de fuera igual. */
  urls = [];
  await almacen.leeTicket('wamid.ABC&cliente=eq.3399999999');
  const ct = consulta();
  igual('el id de un ticket tampoco agrega filtros',
    new URL(ultima()).searchParams.getAll('id').length, 1);
  cierto('  ni parámetros de más',
    Object.keys(ct.params).every(function (k) {
      return ['id', 'select', 'limit'].indexOf(k) >= 0;
    }));

  console.log('\n--- y que nadie vuelva a concatenar a pelo ---');

  /* La regla de verdad no es «acuérdate de escapar»: es que el archivo
     no tenga un solo valor pegado sin pasar por el ayudante. */
  const fs = require('fs');
  const CRUDO = fs.readFileSync(path.join(RAIZ, 'api', '_almacen.js'), 'utf8');

  /* SIN LOS COMENTARIOS, y ya van dos veces que esto muerde: el comentario
     que explica POR QUÉ existe `val()` cita el código viejo —
     `'mensajes?numero=eq.' + k`— y se disparaba solo. Una prueba que obliga
     a escribir el comentario con rodeos acaba con comentarios peores. */
  const FUENTE = CRUDO.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/[^\n]*/g, ' ');
  cierto('quitar los comentarios deja el código entero',
    FUENTE.length > CRUDO.length * 0.35 && FUENTE.indexOf('function val(') !== -1);

  const pegados = (FUENTE.match(/=(eq|lt|gt|gte|lte|neq)\.' \+ (?!val\(|tope\()/g) || []);
  igual('ningún filtro pega un valor sin pasarlo por val()', pegados, []);
  const topes = (FUENTE.match(/limit=' \+ (?!tope\()/g) || []);
  igual('ningún límite se pega sin pasarlo por tope()', topes, []);

  console.log('\n' + buenas + ' buenas, ' + malas + ' malas');
  process.exit(malas ? 1 : 0);
})();
