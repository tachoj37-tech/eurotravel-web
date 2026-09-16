/* ============================================================
   Una sola barra de desplazamiento
   ------------------------------------------------------------
       node pruebas/probar-una-sola-barra.cjs

   LO VIO EL DUEÑO el 16-sep-2026 en la página publicada:

     «tiene una barra desplegable nada que ver a la derecha, hay
      dos, una que sí controla toda la página y otra que no hace
      nada, quita la inservible»

   LA CAUSA, medida en el navegador contra el sitio publicado:

   `#v-inicio { overflow-x: hidden; }` estaba puesto para que nada
   se asomara por los lados. Pero en CSS, si un eje deja de ser
   `visible`, el otro deja de serlo también: `overflow-y` pasa a
   `auto` solo, y la sección entera se vuelve un contenedor de
   scroll. Mientras la última banda (`#caminos.asoma`) espera su
   turno para aparecer, está corrida 26 px hacia abajo con
   `translateY(26px)`, y esos 26 px cuentan como contenido que
   rebasa: la sección enseñaba una barra propia que se movía 26 px
   y no servía para nada.

   EL ARREGLO: `overflow-x: clip`. Recorta lo que se asoma por los
   lados igual que `hidden`, pero NO convierte la sección en
   contenedor de scroll, así que `overflow-y` sigue `visible` y la
   única barra es la de la página. Se deja `hidden` antes de `clip`
   para los navegadores viejos que no conocen `clip`: ellos se
   quedan como estaban, ninguno se queda sin recorte.

   Se lee el HTML como texto, igual que `probar-espera.cjs`.
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

const INDEX = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8')
  .replace(/<!--[\s\S]*?-->/g, ' ')
  .replace(/\/\*[\s\S]*?\*\//g, ' ');

/* Todas las reglas cuyo selector es exactamente `#v-inicio`, con sus
   declaraciones juntas. Un `#v-inicio .algo` no cuenta. */
function reglasDeLaSeccion(css) {
  const cuerpos = [];
  const re = /(^|[}\s])#v-inicio\s*\{([^}]*)\}/g;
  let m;
  while ((m = re.exec(css))) cuerpos.push(m[2]);
  return cuerpos.join(';');
}
const declaraciones = reglasDeLaSeccion(INDEX)
  .split(';').map(function (d) { return d.trim().replace(/\s+/g, ' '); }).filter(Boolean);

console.log('\n── #v-inicio no es un contenedor de scroll ──');
cierto('hay reglas para #v-inicio', declaraciones.length > 0);
cierto('recorta los lados con overflow-x: clip', declaraciones.indexOf('overflow-x: clip') !== -1);

/* El orden importa: `hidden` primero (para los navegadores que no
   entienden `clip`) y `clip` después, que es la que gana. */
const iHidden = declaraciones.indexOf('overflow-x: hidden');
const iClip = declaraciones.indexOf('overflow-x: clip');
cierto('si conserva overflow-x: hidden, va ANTES de clip', iHidden === -1 || iHidden < iClip);

cierto('no fuerza scroll vertical propio (overflow-y)', !declaraciones.some(function (d) {
  return /^overflow-y: (auto|scroll|hidden)$/.test(d);
}));
cierto('no usa overflow a secas con hidden/auto/scroll', !declaraciones.some(function (d) {
  return /^overflow: (auto|scroll|hidden)/.test(d);
}));

console.log('\n' + buenas + ' buenas, ' + malas + ' malas');
process.exit(malas ? 1 : 0);
