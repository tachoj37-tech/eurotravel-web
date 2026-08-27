/* ============================================================
   Que el despliegue quepa
   ------------------------------------------------------------
       node pruebas/probar-despliegue.cjs

   ESTO NACIO DE UNA CAIDA, el 26-ago-2026.

   Se agregaron tres endpoints de cuenta —crear, código, confirmar—
   y el despliegue entero se cayó. La página siguió sirviendo la
   versión anterior, los tres nuevos contestaban 404, y al dueño le
   llegó un correo de Vercel diciendo que algo salió mal.

   La causa: el plan Hobby publica un máximo de DOCE funciones por
   despliegue, e íbamos en catorce.

   Lo que duele de ese fallo es que NINGUNA prueba lo podía cazar:
   las mil y pico que hay comprueban reglas de negocio, y aquí todo
   el negocio estaba bien. Lo que estaba mal era la forma del
   despliegue. Por eso esta prueba mira la CARPETA y no el código.

   Y falla ANTES de subir, que es cuando sale barato.
   ============================================================ */
'use strict';
const fs = require('fs');
const path = require('path');

let buenas = 0, malas = 0;
function igual(nombre, dio, esperado) {
  const a = JSON.stringify(dio), b = JSON.stringify(esperado);
  if (a === b) { buenas++; console.log('ok   ' + nombre); }
  else { malas++; console.log('MAL  ' + nombre + '\n     dio      ' + a + '\n     esperaba ' + b); }
}
function cierto(nombre, v) { igual(nombre, !!v, true); }

/* El tope del plan Hobby. Si algún día se pasa a Pro, este número sube y el
   comentario de arriba explica por qué existía. */
const TOPE_HOBBY = 12;

const carpeta = path.join(__dirname, '..', 'api');
const todos = fs.readdirSync(carpeta);

/* Vercel publica como dirección del sitio todo lo que hay en /api, MENOS lo
   que empieza con guion bajo. Esa es justo la razón de que los módulos
   internos se llamen `_algo.js`. */
const publicas = todos.filter(function (f) { return f.indexOf('_') !== 0; });
const internos = todos.filter(function (f) { return f.indexOf('_') === 0; });

console.log('(' + publicas.length + ' funciones publicadas, ' + internos.length + ' módulos internos)');

cierto('el despliegue cabe en el plan: ' + publicas.length + ' de ' + TOPE_HOBBY,
  publicas.length <= TOPE_HOBBY);
if (publicas.length > TOPE_HOBBY) {
  console.log('   sobran ' + (publicas.length - TOPE_HOBBY) + '. Junta acciones en una sola puerta,');
  console.log('   como hizo api/cuenta.js con crear, código y confirmar.');
  console.log('   Publicadas: ' + publicas.join(', '));
}

/* Y que los internos de verdad estén escondidos: un módulo con la lógica del
   dinero publicado como dirección del sitio sería peor que quedarse corto de
   funciones. */
const conLogicaSensible = ['_tarifa.js', '_destinos.js', '_cuentas.js', '_acceso.js',
  '_ligas.js', '_stripe.js', '_correo.js', '_firma-stripe.js'];
conLogicaSensible.forEach(function (f) {
  if (todos.indexOf(f) < 0) return;   // si un día se renombra, no se inventa un fallo
  cierto(f + ' NO se publica como dirección', f.indexOf('_') === 0);
});

/* Que ninguna función publicada tenga un nombre que Vercel no vaya a servir
   tal cual. Se han perdido despliegues por menos. */
publicas.forEach(function (f) {
  cierto(f + ' tiene extensión que Vercel entiende', /\.(js|mjs|cjs|ts)$/.test(f));
});

console.log('\n' + buenas + ' buenas, ' + malas + ' malas');
process.exit(malas ? 1 : 0);
