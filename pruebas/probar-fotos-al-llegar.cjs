/* ============================================================
   LAS FOTOS PESADAS BAJAN AL LLEGAR, NO AL ABRIR
   ------------------------------------------------------------
       node pruebas/probar-fotos-al-llegar.cjs

   «La página está lenta», dijo el dueño el 16-sep-2026. Medido
   contra el sitio publicado: 2.9 MB en la primera carga, y de esos
   **2.7 MB son ocho fotos de fondo** de las bandas «viajes» y
   «destinos», que están tan abajo que casi nadie las ve:

     viaje-sociales 480 KB · dest-tequila 526 · viaje-religioso 422
     viaje-turismo 356 · dest-vallarta 351 · viaje-descanso 266
     dest-cdmx 161 · dest-mazatlan 159

   Son `background-image` de CSS, y el navegador las pide en cuanto
   encuentra la regla: `loading="lazy"` no existe para fondos.

   EL ARREGLO: la regla cuelga de `.fotos`, una marca que el guion le
   pone a cada banda la primera vez que se acerca a la pantalla y que
   **no se quita nunca**. Así el navegador ni se entera de esas fotos
   hasta que el cliente baja. Quien nunca baja, nunca las descarga.

   NO cuelgan de `.viva`, que es la clase de la animación: esa entra y
   sale con el scroll, y la banda parpadearía al subir y bajar. Se
   probó y se vio: al llegar al final, solo la última banda conservaba
   su foto.

   Y un respaldo en `<noscript>`: sin guion no hay `.fotos`, y una
   banda sin su foto se vería vacía. Ahí se sirven las reglas de
   siempre.
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

/* Las ocho que pesan. Las de arriba —la portada y las unidades— no se tocan:
   esas sí se ven desde el primer segundo. */
const PESADAS = [
  'viaje-descanso', 'viaje-religioso', 'viaje-sociales', 'viaje-turismo',
  'dest-vallarta', 'dest-mazatlan', 'dest-cdmx', 'dest-tequila'
];

/* El `<noscript>` no cuenta como «la regla de siempre»: ahí vive el respaldo. */
const SIN_NOSCRIPT = INDEX.replace(/<noscript>[\s\S]*?<\/noscript>/g, ' ');

console.log('\n── ninguna foto pesada se pide al abrir ──');
PESADAS.forEach(function (foto) {
  const re = new RegExp('([^\\n]*)background-image:\\s*url\\(img/' + foto + '\\.jpg\\)', 'g');
  const renglones = [];
  let m;
  while ((m = re.exec(SIN_NOSCRIPT))) renglones.push(m[1]);
  igual(foto + ': tiene su regla', renglones.length, 1);
  cierto(foto + ': la regla cuelga de .fotos',
    renglones.length === 1 && /\.fotos\s/.test(renglones[0]));
});

console.log('\n── y la portada SÍ se sigue pidiendo de inmediato ──');
/* `noche.webp` es la foto del cartel: es lo primero que se ve y además se
   precarga. Si algún día cayera en la regla de `.viva`, la portada tardaría. */
cierto('la foto del cartel no depende de .viva',
  /(^|\n)#v-inicio \.foto-noche \{background-image:url\(img\/noche\.webp\)\}/.test(INDEX));
cierto('y se sigue precargando',
  /<link rel="preload" as="image" href="img\/noche\.webp"/.test(INDEX));

console.log('\n── respaldo para quien no tiene guion ──');
const noscript = (INDEX.match(/<noscript>[\s\S]*?<\/noscript>/g) || []).join('\n');
cierto('hay un <noscript> con estilos', /<style>/.test(noscript));
PESADAS.forEach(function (foto) {
  cierto(foto + ': está en el respaldo',
    noscript.indexOf('img/' + foto + '.jpg') >= 0);
});

console.log('\n' + buenas + ' buenas, ' + malas + ' malas');
process.exit(malas ? 1 : 0);
