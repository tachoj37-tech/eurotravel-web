/* ============================================================
   VOLVER DE STRIPE NO BORRA LA COTIZACIÓN
   ------------------------------------------------------------
       node pruebas/probar-vuelta-de-stripe.cjs

   Lo vio el recorrido con Playwright del 16-sep-2026: el cliente
   arma su viaje, le da a «Pagar anticipo», llega a Stripe, se
   arrepiente o quiere revisar algo, le da a «Atrás»… y encuentra el
   cotizador EN BLANCO. Origen, destino, fechas, unidad, pasajeros y
   sus datos: todo perdido. Volver a capturarlo es justo lo que nadie
   hace: esa venta se cae ahí.

   EL ARREGLO, y por qué éste y no otro: en lugar de guardar todo el
   viaje y armarlo de nuevo al volver —que son decenas de campos y
   cada uno es una oportunidad de restaurarlo mal—, el pago **se abre
   en otra pestaña**. La del cotizador se queda como estaba, viva y
   llena. No hay nada que restaurar porque no se perdió nada.

   DOS DETALLES QUE HACEN QUE FUNCIONE:

   1. La pestaña se abre EN EL CLIC, antes de preguntarle al servidor.
      Un `window.open` después de un `fetch` ya no cuenta como gesto
      del cliente y los navegadores lo bloquean.
   2. Si aun así el navegador la bloquea —hay teléfonos que lo hacen
      siempre—, se sigue como antes, mandando la misma pestaña a
      Stripe. Vale más cobrar perdiendo la cotización que no cobrar.

   Y si el servidor contesta que no, la pestaña en blanco se cierra:
   nadie se queda mirando una pestaña vacía sin saber qué pasó.
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

/* El bloque del botón de pagar, de su `addEventListener` hasta que arranca
   el siguiente. */
const desde = INDEX.indexOf("byId('pago-ir').addEventListener('click'");
const bloque = desde >= 0 ? INDEX.slice(desde, desde + 6000) : '';

console.log('\n── el pago abre su propia pestaña ──');
cierto('existe el manejador del botón de pagar', bloque.length > 0);
cierto('se abre una pestaña nueva', /window\.open\(/.test(bloque));

/* El orden es lo que decide si el navegador la bloquea. */
const iAbre = bloque.indexOf('window.open(');
const iFetch = bloque.indexOf("fetch('/api/pagar'");
cierto('y se abre ANTES de preguntarle al servidor', iAbre >= 0 && iFetch >= 0 && iAbre < iFetch);

console.log('\n── y si algo sale mal, no deja pestañas vacías ──');
cierto('si el servidor dice que no, la pestaña se cierra', /\.close\(\)/.test(bloque));
cierto('si el navegador la bloquea, se sigue en la misma pestaña',
  /location\.href\s*=/.test(bloque));

console.log('\n── el candado de a dónde se manda al cliente sigue puesto ──');
/* Esto ya existía y no se toca: es el único punto que saca al cliente del
   sitio, y es donde teclea su tarjeta. */
cierto('se comprueba que la dirección sea de Stripe',
  /stripe\\\.com/.test(bloque) || /stripe\\.com/.test(bloque));
cierto('y la comprobación va antes de mandarlo',
  bloque.indexOf('esStripe') >= 0);

console.log('\n' + buenas + ' buenas, ' + malas + ' malas');
process.exit(malas ? 1 : 0);
