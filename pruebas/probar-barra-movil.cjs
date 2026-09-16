/* ============================================================
   LA BARRA DE PESTAÑAS DEL CELULAR ENSEÑA LAS CINCO
   ------------------------------------------------------------
       node pruebas/probar-barra-movil.cjs

   Medido con Playwright a 375 px de ancho el 16-sep-2026: las cinco
   pestañas sumaban 434 px (63 + 89 + 110 + 86 + 86) y «Contacto»
   empezaba en x = 377, o sea FUERA de la pantalla. La barra sí se
   desliza, pero sin barra visible nadie sabe que hay algo más a la
   derecha: para el cliente, «Contacto» no existe en el celular.

   Arreglo: en el celular las pestañas se reparten el ancho (flex),
   con letra de 13 px y menos aire a los lados, y «Cotizaciones» se
   llama «Cotizar» ahí (la barra de escritorio sigue igual). Con eso
   suman ~325 px y caben hasta en 360 px.

   Esta prueba lee el HTML como texto: cuida que la regla y el
   nombre corto no se pierdan. La medida real la dio Playwright.
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
  .replace(/<!--[\s\S]*?-->/g, ' ').replace(/\/\*[\s\S]*?\*\//g, ' ');

/* La barra móvil, tal cual está en el HTML. */
const barra = (INDEX.match(/<div class="tabs-mobile"[^>]*>([\s\S]*?)<\/div>/) || [])[1] || '';
cierto('existe la barra móvil', barra.length > 0);
const pestanas = [...barra.matchAll(/<button[^>]*data-go="([^"]+)"[^>]*>([^<]*)<\/button>/g)]
  .map(m => ({ va: m[1], dice: m[2].trim() }));
igual('tiene las cinco pestañas', pestanas.map(p => p.va), ['inicio', 'unidades', 'cotizar', 'nosotros', 'contacto']);
igual('en el celular dice «Cotizar», no «Cotizaciones»', (pestanas.find(p => p.va === 'cotizar') || {}).dice, 'Cotizar');
igual('y «Nosotros», no «Sobre nosotros»', (pestanas.find(p => p.va === 'nosotros') || {}).dice, 'Nosotros');

/* La regla que hace que quepan. */
const regla = (INDEX.match(/\.tabs-mobile \.tab\s*\{([^}]*)\}/) || [])[1] || '';
cierto('hay una regla propia para .tabs-mobile .tab', regla.length > 0);
cierto('las pestañas se reparten el ancho (flex: 1)', /flex:\s*1/.test(regla));
const fuente = Number((regla.match(/font-size:\s*(\d+)px/) || [])[1]);
cierto('letra de 13 px o menos en el celular (dio ' + fuente + ')', fuente > 0 && fuente <= 13);
const lados = (regla.match(/padding:\s*\d+px\s+(\d+)px/) || [])[1];
cierto('aire a los lados de 6 px o menos (dio ' + lados + ')', lados !== undefined && Number(lados) <= 6);
cierto('el texto va centrado', /text-align:\s*center/.test(regla));

/* La barra de escritorio no cambia: sigue diciendo «Cotizaciones». */
const escritorio = (INDEX.match(/<div class="tabs nav-mid"[^>]*>([\s\S]*?)<\/div>/) || [])[1] || '';
cierto('la barra de escritorio sigue diciendo «Cotizaciones»', /Cotizaciones/.test(escritorio));

console.log('\n' + buenas + ' buenas, ' + malas + ' malas');
process.exit(malas ? 1 : 0);
