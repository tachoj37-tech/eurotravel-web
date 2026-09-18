/* ============================================================
   LO QUE SE TOCA CON EL DEDO MIDE LO SUFICIENTE
   ------------------------------------------------------------
       node pruebas/probar-toque-movil.cjs

   Medido con Playwright a 390 px el 17-sep-2026: los puntos del
   carrusel de destinos («Ver Puerto Vallarta», «Ver Mazatlán»…)
   se dibujan de 26 × 3 px. Ya tenían un área de toque ampliada con
   un `::before`, pero llegaba a 32 × 32: por debajo de los 44 × 44
   que piden Apple y Google, y son los botones que cambian el
   destino que se enseña.

   No se cambia el dibujo —la rayita se ve igual— sino el área que
   responde al dedo.
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

const INDEX = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

console.log('\n── los puntos del carrusel se pueden tocar ──');

const regla = (INDEX.match(/#v-inicio \.punto::before\s*\{([^}]*)\}/) || [])[1] || '';
cierto('el punto tiene un área de toque aparte (::before)', regla.length > 0);
cierto('esa área es absoluta', /position:\s*absolute/.test(regla));
cierto('el punto es el ancla (position: relative)',
  /#v-inicio \.punto\s*\{[^}]*position:\s*relative/.test(INDEX));

/* El punto se dibuja de 26 × 3. Para llegar a 44 × 44 el área tiene que
   salirse 9 px a cada lado y 21 px arriba y abajo. */
function px(prop) {
  const m = regla.match(new RegExp(prop + ':\\s*(-?\\d+)px'));
  return m ? Number(m[1]) : 0;
}
const ancho = 26 - px('left') - px('right');
const alto = 3 - px('top') - px('bottom');
igual('a lo ancho llega a 44 px (dio ' + ancho + ')', ancho >= 44, true);
igual('a lo alto llega a 44 px (dio ' + alto + ')', alto >= 44, true);

/* El área es invisible: si se pintara, taparía la foto del carrusel. */
cierto('el área no se pinta', !/background\s*:/.test(regla));

console.log('\n' + buenas + ' buenas, ' + malas + ' malas');
process.exit(malas ? 1 : 0);
