/* ============================================================
   LAS DIRECCIONES DE LA PÁGINA VIEJA NO SE PIERDEN
   ------------------------------------------------------------
       node pruebas/probar-ligas-viejas.cjs

   El 19-sep-2026 se listaron las direcciones que el WordPress lleva
   años enseñándole a Google:

     /inicio/  /contacto/  /cotizacion-en-linea/  /pagos-en-linea/
     /sobre-nosotros/  /empresariales/  /renta/  /renta/sprinter/
     /renta/suburban-3/  /renta/autobuses/  y seis páginas de autobuses

   El día que el dominio apunte a esta página, todas esas se vuelven
   un 404. Quien busque «eurotravel sprinter» en Google y le pique,
   aterriza en una página rota: tráfico que ya existe, perdido de un
   día para otro.

   Se arreglan con redirecciones permanentes (301). Google entiende
   esa mudanza y traslada el posicionamiento de la vieja a la nueva.
   Se hacen en `vercel.json`, así que **no gastan ninguna de las doce
   funciones** que permite el plan.

   El dueño decidió el 19-sep que el WordPress se apaga, así que esto
   es lo único que queda de él.
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

const CONF = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'vercel.json'), 'utf8'));
const redirs = CONF.redirects || [];

/* A dónde tiene que llegar cada dirección vieja. */
const MUDANZAS = [
  ['/inicio', '/#/inicio'],
  ['/contacto', '/#/contacto'],
  ['/cotizacion-en-linea', '/#/cotizar'],
  ['/empresariales', '/#/cotizar'],
  ['/sobre-nosotros', '/#/nosotros'],
  ['/renta', '/#/unidades'],
  ['/renta/autobuses', '/#/unidades'],
  ['/renta/sprinter', '/#/unidades'],
  ['/renta/suburban-3', '/#/unidades'],
  /* La de pagos es la más valiosa: quien llegue ahí quiere abonar. */
  ['/pagos-en-linea', '/viaje.html']
];

console.log('\n── cada dirección vieja tiene a dónde ir ──');
MUDANZAS.forEach(function (par) {
  const r = redirs.filter(function (x) { return x.source === par[0]; })[0];
  cierto(par[0] + ': existe la redirección', !!r);
  if (r) {
    igual(par[0] + ' → ' + par[1], r.destination, par[1]);
    /* Permanente, no temporal: es lo que le dice a Google que traslade
       el posicionamiento en vez de quedarse esperando a la vieja. */
    cierto(par[0] + ': es permanente', r.permanent === true);
  }
});

console.log('\n── las páginas de cada autobús también ──');
/* Eran seis: irizar-i6, irizar-i6s, irizar-i6-am, irizar-pb, irizar, neobus.
   Una regla con comodín las cubre todas, y también las que agreguen después. */
const comodin = redirs.filter(function (x) { return /^\/renta\/autobuses\/:/.test(x.source); })[0];
cierto('hay una regla que cubre todas las páginas de autobuses', !!comodin);
if (comodin) {
  igual('y lleva a unidades', comodin.destination, '/#/unidades');
  cierto('permanente', comodin.permanent === true);
}

console.log('\n── los restos de WordPress no se quedan colgando ──');
/* `/feed`, `/wp-json`, `/wp-admin`: direcciones que ya no existen y que los
   rastreadores siguen tocando. Van a la portada, no a un 404. */
['/feed', '/comments/feed'].forEach(function (s) {
  cierto(s + ': redirigida', redirs.some(function (x) { return x.source === s; }));
});
cierto('las de wp-* también', redirs.some(function (x) { return /^\/wp-/.test(x.source); }));

console.log('\n── y no se rompió nada de lo que ya había ──');
cierto('la puerta del bot sigue reescrita',
  (CONF.rewrites || []).some(function (x) { return x.source === '/api/whatsapp/:llave'; }));
cierto('el cron del seguimiento sigue', (CONF.crons || []).length >= 1);
cierto('las cabeceras de seguridad siguen', (CONF.headers || []).length >= 1);

console.log('\n' + buenas + ' buenas, ' + malas + ' malas');
process.exit(malas ? 1 : 0);
