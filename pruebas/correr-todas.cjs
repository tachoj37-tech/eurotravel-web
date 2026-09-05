/* ------------------------------------------------------------
   Corre TODAS las pruebas y las cuenta.

   POR QUÉ EXISTE ESTE ARCHIVO
   ---------------------------
   Antes, `npm run probar` era una sola línea del `package.json`
   con los 37 archivos encadenados con `&&`. Eso tiene dos fallas,
   y las dos se pagaron:

   1 · `&&` CORTA. `auditar-tarifa.cjs` es el octavo de la lista y
       lleva tiempo en rojo. Al fallar, las 29 pruebas que iban
       después NUNCA CORRÍAN. Quien veía el rojo creía estar viendo
       37 archivos y estaba viendo 8. El 2-sep-2026 se rompieron
       tres pruebas con un cambio de dinero (R51) y la batería no
       las delató: estaban del otro lado del corte.

   2 · LA LISTA SE OLVIDA. `probar-origenes.cjs` existía en la
       carpeta y NO estaba en la lista. Nunca corrió. Es la que
       cuida los recargos de Ocotlán y Yurécuaro — dinero.

   Por eso este corredor:

   · DESCUBRE los archivos solo. Nadie tiene que acordarse de
     agregar el suyo, así que nadie puede olvidarlo.
   · CORRE TODOS aunque uno truene, y hasta el final.
   · Cuenta el total de verdad y enseña el detalle de lo que falló.
   · Sale con error si algo falló, para que el despliegue lo note.

   Uso:
     npm run probar              todas
     npm run probar tarifa       solo las que digan «tarifa»
   ------------------------------------------------------------ */

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const AQUI = __dirname;

/* Un archivo de prueba es `probar-*` o `auditar-*`. Cualquier otra
   cosa en esta carpeta —`datos/`, algún ayudante -- se queda fuera
   sin que nadie tenga que decirlo. */
function esPrueba(nombre) {
  return /^(probar|auditar)-.+\.(cjs|mjs)$/.test(nombre);
}

const filtro = (process.argv[2] || '').toLowerCase();

const archivos = fs.readdirSync(AQUI)
  .filter(esPrueba)
  .filter(function (n) { return !filtro || n.toLowerCase().includes(filtro); })
  .sort();

if (archivos.length === 0) {
  console.error(filtro
    ? 'Ninguna prueba se llama «' + filtro + '».'
    : 'No hay pruebas en ' + AQUI + '. Algo está mal.');
  process.exit(1);
}

/* La última línea de resumen que imprime cada archivo, del estilo
   «231 buenas, 0 malas». De ahí salen los dos números. */
function cuenta(salida) {
  const lineas = salida.split('\n').filter(function (l) { return /buenas,/.test(l); });
  if (lineas.length === 0) return null;
  const m = lineas[lineas.length - 1].match(/(\d+)\s+buenas,\s+(\d+)\s+malas/);
  return m ? { buenas: Number(m[1]), malas: Number(m[2]) } : null;
}

let buenas = 0;
let malas = 0;
const rotas = [];
const sinResumen = [];

console.log('Corriendo ' + archivos.length + ' archivos de prueba\n');

for (const archivo of archivos) {
  const r = spawnSync(process.execPath, [path.join(AQUI, archivo)], {
    encoding: 'utf8',
    /* Sin tope: `auditar-tarifa` escupe miles de líneas y un búfer
       corto la truncaría justo donde está el detalle que se busca. */
    maxBuffer: 64 * 1024 * 1024
  });

  const salida = (r.stdout || '') + (r.stderr || '');
  const c = cuenta(salida);
  const nombre = archivo.replace(/\.(cjs|mjs)$/, '');

  if (!c) {
    /* Ni resumen ni nada: o tronó al arrancar, o cambió su formato
       de salida. Las dos cosas hay que verlas, no contarlas. */
    sinResumen.push({ nombre: nombre, salida: salida, codigo: r.status });
    console.log('  ??  ' + nombre + '   (sin resumen · salió con ' + r.status + ')');
    continue;
  }

  buenas += c.buenas;
  malas += c.malas;

  if (c.malas > 0) {
    rotas.push({ nombre: nombre, salida: salida, malas: c.malas });
    console.log('  MAL ' + nombre.padEnd(28) + c.buenas + ' buenas, ' + c.malas + ' MALAS');
  } else {
    console.log('  ok  ' + nombre.padEnd(28) + c.buenas);
  }
}

/* El detalle va al final y no mezclado entre archivo y archivo:
   así la lista de arriba se lee de un vistazo y quien quiera el
   porqué baja a buscarlo. */
if (rotas.length || sinResumen.length) {
  console.log('\n' + '='.repeat(60));
  console.log('EL DETALLE DE LO QUE FALLÓ');
  console.log('='.repeat(60));

  for (const p of rotas) {
    console.log('\n--- ' + p.nombre + ' · ' + p.malas + ' malas ---');
    const lineas = p.salida.split('\n');
    for (let i = 0; i < lineas.length; i++) {
      if (/^MAL/.test(lineas[i])) console.log(lineas.slice(i, i + 4).join('\n'));
    }
  }

  for (const p of sinResumen) {
    console.log('\n--- ' + p.nombre + ' · NO DIO RESUMEN ---');
    console.log(p.salida.split('\n').slice(-25).join('\n'));
  }
}

/* Los que NO dieron resumen cuentan como fallas en el renglón final.

   Aquí hubo un defecto el mismo día que se escribió este archivo:
   `probar-venta` tronó a media corrida y el resumen decía «39 archivos,
   0 con fallas». La cuenta de arriba solo miraba `rotas`, y un archivo
   que se cae ni siquiera llega a tener malas que contar.

   El proceso sí salía con error, pero el renglón que uno LEE mentía. Es
   la misma venda que este archivo existe para quitar. */
const conFallas = rotas.length + sinResumen.length;

console.log('\n' + '='.repeat(60));
console.log(buenas + ' buenas, ' + malas + ' malas   ·   ' +
  archivos.length + ' archivos, ' + conFallas + ' con fallas' +
  (sinResumen.length ? '  (' + sinResumen.length + ' se cayeron a media corrida)' : ''));
console.log('='.repeat(60));

process.exit(malas > 0 || sinResumen.length > 0 ? 1 : 0);
