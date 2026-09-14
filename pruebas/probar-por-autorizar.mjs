/* ============================================================
   LA LISTA DE PRECIOS POR AUTORIZAR (13-sep-2026)
   ============================================================
   Dictado del dueño, al preguntarle cómo se suelta un precio aprendido:

     · cómo autoriza     «me lo dices a mí»: él lo dice en la sesión,
                         se apunta con fecha en `api/_precios-autorizados.js`
     · cuántas veces     3
     · cuál precio       el más reciente
     · y al cliente      «EL PRECIO NO DEBERIA SALIR SOLO TODAVIA»

   Lo que vigila esta batería, en orden de qué tan caro sale si falla:

   1 · Que NADA de esto llegue al cliente. Autorizar hoy es apuntar, no
       publicar: ni la página ni el cotizador leen el registro.
   2 · Que no se proponga un viaje con menos de tres clientes distintos.
       Tres cotizaciones del mismo cliente son una sola opinión.
   3 · Que el propuesto sea el MÁS RECIENTE, que es lo que él escogió.
   4 · Que lo ya autorizado no se vuelva a proponer, y que si él cobró
       otra cosa después, se le avise en vez de callarlo.
   ============================================================ */
import fs from 'fs';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.join(AQUI, '..');

let buenas = 0, malas = 0;
function ok(que, condicion) {
  if (condicion) { buenas++; console.log('ok   ' + que); }
  else { malas++; console.log('FALLA ' + que); }
}
function titulo(t) { console.log('\n== ' + t.toUpperCase() + ' =='); }

const volcado = await import(pathToFileURL(path.join(RAIZ, 'scripts', 'precios-al-cerebro.mjs')).href);
const registro = (await import(pathToFileURL(path.join(RAIZ, 'api', '_precios-autorizados.js')).href)).default;

function renglon(x) {
  return Object.assign({
    clave: 'zmg|chapala|sprinter|1', origen: 'Guadalajara', destino: 'Chapala',
    unidad: 'Sprinter', dias: 1, pasajeros: 12, total: 6500, anticipo: 1500,
    fijado: true, calculado: null, cliente: '3312345678', salida: '2026-11-20',
    cuando: '2026-09-01T10:00:00Z'
  }, x);
}

/* Tres clientes distintos al mismo viaje, el más reciente a $7,000. */
function tresClientes(extra) {
  return [
    renglon(Object.assign({ cliente: '3310000001', total: 6500, cuando: '2026-09-01T10:00:00Z' }, extra)),
    renglon(Object.assign({ cliente: '3310000002', total: 6800, cuando: '2026-09-03T10:00:00Z' }, extra)),
    renglon(Object.assign({ cliente: '3310000003', total: 7000, cuando: '2026-09-05T10:00:00Z', calculado: 6200 }, extra))
  ];
}

titulo('1 · nada de esto sale al cliente');
{
  ok('el registro dice que no sale al cliente', registro.SALEN_AL_CLIENTE === false);

  /* Que nadie del lado del cliente lo lea. Si algún día se engancha, esta
     prueba se pone roja a propósito: es la decisión del dueño, y cambiarla
     tiene que ser a la vista. Se miran sin comentarios, para que una nota
     que lo mencione no la tumbe. */
  const sinComentarios = (t) => t.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
  const lectores = fs.readdirSync(path.join(RAIZ, 'api'))
    .filter((n) => /\.(c?js|mjs)$/.test(n) && n !== '_precios-autorizados.js')
    .map((n) => path.join('api', n))
    .concat(['cotizacion.js', 'index.html', 'bot.js'].filter((n) => fs.existsSync(path.join(RAIZ, n))));
  const loLeen = lectores.filter((n) =>
    /_precios-autorizados/.test(sinComentarios(fs.readFileSync(path.join(RAIZ, n), 'utf8'))));
  ok('ningún archivo de la página ni del bot lee el registro' +
    (loLeen.length ? ' (lo leen: ' + loLeen.join(', ') + ')' : ''), loLeen.length === 0);

  /* Y que el registro no sea una función pública: en Vercel, lo que empieza
     con guion bajo no se publica. */
  ok('el registro empieza con guion bajo (no es una puerta pública)',
    fs.existsSync(path.join(RAIZ, 'api', '_precios-autorizados.js')));
}

titulo('el registro está bien escrito');
{
  ok('es una lista', Array.isArray(registro.AUTORIZADOS));
  ok('todo lo apuntado pasa la revisión', registro.revisa(registro.AUTORIZADOS).length === 0);

  const malos = registro.revisa([
    { clave: 'zmg|chapala|sprinter|1', total: 7000, fecha: '2026-09-13', frase: 'autoriza Chapala' },
    { clave: '', total: 7000, fecha: '2026-09-13', frase: 'x' },
    { clave: 'zmg|tequila|sprinter|1', total: 0, fecha: '2026-09-13', frase: 'x' },
    { clave: 'zmg|tapalpa|sprinter|1', total: 7000.5, fecha: '2026-09-13', frase: 'x' },
    { clave: 'zmg|mazamitla|sprinter|1', total: 7000, fecha: '13-sep', frase: 'x' },
    { clave: 'zmg|ajijic|sprinter|1', total: 7000, fecha: '2026-09-13', frase: '' }
  ]);
  ok('uno bueno pasa y cinco malos se señalan', malos.length === 5);

  const repetidos = registro.revisa([
    { clave: 'zmg|chapala|sprinter|1', total: 7000, fecha: '2026-09-13', frase: 'autoriza Chapala' },
    { clave: 'zmg|chapala|sprinter|1', total: 7200, fecha: '2026-09-20', frase: 'autoriza Chapala' }
  ]);
  ok('la misma clave dos veces se señala (¿cuál manda?)', repetidos.length === 1);
}

titulo('2 · se necesitan tres clientes distintos');
{
  const dos = volcado.porAutorizar(volcado.agrupa(tresClientes().slice(0, 2)), []);
  ok('con dos clientes no se propone', dos.listos.length === 0);
  ok('  pero se cuenta como «le falta poco»', dos.cerca.length === 1 && dos.cerca[0].veces === 2);

  const mismoCliente = volcado.porAutorizar(volcado.agrupa(
    tresClientes().map((f) => Object.assign({}, f, { cliente: '3319999999' }))), []);
  ok('tres veces el MISMO cliente no son tres', mismoCliente.listos.length === 0);

  const tres = volcado.porAutorizar(volcado.agrupa(tresClientes()), []);
  ok('con tres clientes distintos sí se propone', tres.listos.length === 1);
  ok('  y dice cuántos fueron', tres.listos[0] && tres.listos[0].veces === 3);

  /* Un renglón sin cliente (se guardó antes de que se anotara) cuenta
     como uno: no se sabe quién fue, pero sí que alguien pidió. */
  const sinCliente = volcado.porAutorizar(volcado.agrupa(
    tresClientes().map((f) => Object.assign({}, f, { cliente: null }))), []);
  ok('los renglones sin cliente cuentan uno por uno', sinCliente.listos.length === 1);

  ok('el mínimo es 3', volcado.MINIMO_PARA_PROPONER === 3);
}

titulo('3 · el propuesto es el más reciente');
{
  /* A propósito con el más reciente SIN fijar y uno anterior fijado: el
     ticket sugeriría el fijado ($6,800), pero para autorizar él escogió
     el más reciente. */
  const filas = tresClientes();
  filas[1].fijado = true;
  filas[2].fijado = false;
  const r = volcado.porAutorizar(volcado.agrupa(filas), []);
  ok('se propone $7,000, el más reciente', r.listos[0] && r.listos[0].propuesto === 7000);
  ok('  y se enseñan los anteriores, del más nuevo al más viejo',
    r.listos[0] && r.listos[0].anteriores.join(',') === '6800,6500');
  ok('  y lo que había calculado el motor', r.listos[0] && r.listos[0].motor === 6200);

  const sinMotor = volcado.porAutorizar(volcado.agrupa(tresClientes().map((f) =>
    Object.assign({}, f, { calculado: null }))), []);
  ok('si el motor no supo, queda nulo y no cero', sinMotor.listos[0] && sinMotor.listos[0].motor === null);
}

titulo('4 · lo ya autorizado');
{
  const igual = volcado.porAutorizar(volcado.agrupa(tresClientes()), [
    { clave: 'zmg|chapala|sprinter|1', total: 7000, fecha: '2026-09-13', frase: 'autoriza Chapala' }
  ]);
  ok('autorizado al mismo precio: no se vuelve a proponer', igual.listos.length === 0);
  ok('  ni se señala como cambiado', igual.cambiaron.length === 0);
  ok('  y se cuenta como autorizado', igual.autorizados === 1);

  const otro = volcado.porAutorizar(volcado.agrupa(tresClientes()), [
    { clave: 'zmg|chapala|sprinter|1', total: 6500, fecha: '2026-09-02', frase: 'autoriza Chapala' }
  ]);
  ok('autorizado a otro precio y después cobró distinto: se avisa', otro.cambiaron.length === 1);
  ok('  con los dos números', otro.cambiaron[0] && otro.cambiaron[0].autorizado === 6500 &&
    otro.cambiaron[0].propuesto === 7000);
  ok('  y no aparece también como nuevo', otro.listos.length === 0);
}

titulo('los de prueba y los ceros no cuentan');
{
  const filas = tresClientes();
  filas[2].cliente = '5213366679001';
  const r = volcado.porAutorizar(volcado.agrupa(filas), []);
  ok('un cliente de prueba no completa los tres', r.listos.length === 0);
}

titulo('la página de la lista');
{
  const conUno = volcado.laListaParaAutorizar(volcado.porAutorizar(volcado.agrupa(tresClientes()), []));
  ok('lleva su título', /^# Precios por autorizar/m.test(conUno));
  ok('dice que NO sale al cliente aunque se autorice', /no sale al cliente/i.test(conUno));
  ok('enseña el viaje', /Chapala/.test(conUno) && /Sprinter/.test(conUno));
  ok('enseña el propuesto', /\$7,000/.test(conUno));
  ok('enseña lo del motor', /\$6,200/.test(conUno));
  ok('le dice cómo autorizar', /autoriza/.test(conUno));
  ok('avisa que se reescribe sola', /me la pisa|la pisa/.test(conUno));

  /* La clave lleva «|», que es justo lo que separa las columnas de una
     tabla: sin escaparla, el renglón se parte en más columnas que el
     encabezado y la tabla se desbarata. Se cuentan los separadores sin
     escapar de cada renglón de la tabla. */
  const renglones = conUno.split('\n').filter((x) => /^\|/.test(x));
  const columnas = renglones.map((x) => x.replace(/\\\|/g, '').split('|').length);
  ok('todos los renglones de las tablas tienen tantas columnas como su encabezado',
    columnas.length > 0 && conUno.split(/\n\n/).every((bloque) => {
      const rs = bloque.split('\n').filter((x) => /^\|/.test(x));
      return new Set(rs.map((x) => x.replace(/\\\|/g, '').split('|').length)).size <= 1;
    }));

  const vacia = volcado.laListaParaAutorizar(volcado.porAutorizar(volcado.agrupa([]), []));
  ok('sin nada: lo dice, sin tabla vacía', /Todavía no hay/.test(vacia) && !/\|---\|/.test(vacia));
}

console.log('\n' + buenas + ' buenas, ' + malas + ' malas');
process.exit(malas ? 1 : 0);
