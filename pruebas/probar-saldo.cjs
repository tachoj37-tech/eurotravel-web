/* ============================================================
   El saldo de un viaje, y qué abono se deja pasar
   ------------------------------------------------------------
       node pruebas/probar-saldo.cjs

   PASO 1 del spec de abonos en línea. Es la base de todo lo demás
   y no depende de nada externo, así que se prueba entera sin red.

   LO QUE SE CUIDA, en orden de gravedad — y todo esto es dinero:

     1. Un abono NO PAGADO no baja el saldo. Un voucher de OXXO
        generado y no pagado es una sesión que existe y un dinero
        que no entró.
     2. Los abonos de OTRO viaje no bajan este saldo. Quien tiene
        dos viajes no puede ver los abonos de uno descontados del
        otro.
     3. El anticipo NO se cuenta como abono. Es la sesión que creó
        el contrato; contarla dos veces regalaría el anticipo.
     4. No se puede abonar de más, ni menos del mínimo.
     5. El saldo nunca sale negativo ni el pagado por encima del
        total, pase lo que pase con los datos.
   ============================================================ */
'use strict';

const path = require('path');
const saldo = require(path.join(__dirname, '..', 'api', '_saldo.js'));

let buenas = 0, malas = 0;
function igual(nombre, dio, esperado) {
  const a = JSON.stringify(dio), b = JSON.stringify(esperado);
  if (a === b) { buenas++; console.log('ok   ' + nombre); }
  else { malas++; console.log('MAL  ' + nombre + '\n     dio      ' + a + '\n     esperaba ' + b); }
}
function cierto(nombre, v) { igual(nombre, !!v, true); }
function titulo(t) { console.log('\n== ' + t.toUpperCase() + ' =='); }

/* Una sesión de abono como la que crea Stripe. */
function abono(folio, monto, id) {
  return { id: id || ('cs_' + monto), metadata: { tipo: 'abono', folio: folio, monto: String(monto) } };
}
/* Y el anticipo: la sesión que creó el contrato. No lleva `tipo`. */
function anticipo(folio, monto) {
  return { id: 'cs_anticipo', metadata: { folio: folio, total: String(monto) } };
}

/* Por omisión, todo pagado. Los casos que necesitan otra cosa pasan su
   propio `estadoDe`. */
const TODO_PAGADO = function () { return 'pagado'; };

/* ============================================================ */
titulo('la cuenta, en el caso normal');
{
  const r = saldo.calcula({
    total: 19000, anticipo: 4000, folio: 'ET-1042',
    sesiones: [abono('ET-1042', 5000)], estadoDe: TODO_PAGADO
  });
  igual('el total es el del viaje', r.total, 19000);
  igual('lo pagado suma anticipo y abonos', r.pagado, 9000);
  igual('y el saldo es el resto', r.saldo, 10000);
  igual('con el abono en la lista', r.abonos.length, 1);
  igual('y sin descuadre', r.descuadre, 0);
}

/* ============================================================ */
titulo('un abono que no se pagó NO baja el saldo');
{
  /* El caso de verdad: genera su voucher de OXXO y no va a la tienda. La
     sesión existe en Stripe desde que se creó; el dinero no. */
  const r = saldo.calcula({
    total: 19000, anticipo: 4000, folio: 'ET-1042',
    sesiones: [abono('ET-1042', 5000, 'cs_oxxo')],
    estadoDe: function () { return 'sinPagar'; }
  });
  igual('no se cuenta', r.pagado, 4000);
  igual('y el saldo sigue completo', r.saldo, 15000);
  igual('ni sale en la lista', r.abonos, []);

  /* «pendiente» tampoco es pagado. */
  const p = saldo.calcula({
    total: 19000, anticipo: 4000, folio: 'ET-1042',
    sesiones: [abono('ET-1042', 5000)],
    estadoDe: function () { return 'pendiente'; }
  });
  igual('un abono pendiente tampoco cuenta', p.saldo, 15000);
}

/* ============================================================ */
titulo('los abonos de otro viaje no tocan éste');
{
  const r = saldo.calcula({
    total: 19000, anticipo: 4000, folio: 'ET-1042',
    sesiones: [abono('ET-1042', 5000), abono('ET-0988', 9000)],
    estadoDe: TODO_PAGADO
  });
  igual('solo cuenta el suyo', r.pagado, 9000);
  igual('y el saldo es el suyo', r.saldo, 10000);

  /* Un abono sin folio no se le cuelga a nadie. */
  const sinFolio = saldo.calcula({
    total: 19000, anticipo: 4000, folio: 'ET-1042',
    sesiones: [{ id: 'cs_x', metadata: { tipo: 'abono', monto: '5000' } }],
    estadoDe: TODO_PAGADO
  });
  igual('un abono sin folio no se cuenta', sinFolio.saldo, 15000);
}

/* ============================================================ */
titulo('el anticipo no se cuenta dos veces');
{
  /* La sesión que creó el contrato está en la lista del cliente, y NO
     lleva `tipo: abono`. Si se contara, el anticipo se regalaría. */
  const r = saldo.calcula({
    total: 19000, anticipo: 4000, folio: 'ET-1042',
    sesiones: [anticipo('ET-1042', 19000), abono('ET-1042', 5000)],
    estadoDe: TODO_PAGADO
  });
  igual('solo el abono suma', r.pagado, 9000);
  igual('y hay un solo abono', r.abonos.length, 1);
}

/* ============================================================ */
titulo('nada sale absurdo, pase lo que pase');
{
  /* Un abono duplicado, o un total corregido a la baja: el saldo se queda
     en cero y el descuadre se dice, para que se vea en el registro en vez
     de esconderse. */
  const r = saldo.calcula({
    total: 10000, anticipo: 4000, folio: 'ET-1',
    sesiones: [abono('ET-1', 5000, 'a'), abono('ET-1', 5000, 'b')],
    estadoDe: TODO_PAGADO
  });
  igual('el saldo no sale negativo', r.saldo, 0);
  igual('lo pagado no pasa del total', r.pagado, 10000);
  igual('y el descuadre se dice', r.descuadre, 4000);

  /* Basura en los datos no truena ni inventa dinero. */
  igual('sin nada, cero', saldo.calcula({}).saldo, 0);
  igual('con montos ilegibles, cero',
    saldo.calcula({ total: 'mucho', anticipo: null, sesiones: 'no es lista' }).saldo, 0);
  igual('un abono con monto ilegible no cuenta',
    saldo.calcula({ total: 10000, anticipo: 0, folio: 'ET-1',
      sesiones: [{ id: 'x', metadata: { tipo: 'abono', folio: 'ET-1', monto: 'mil' } }],
      estadoDe: TODO_PAGADO }).saldo, 10000);
  /* Y uno negativo tampoco SUBE el saldo. */
  igual('un abono negativo no sube el saldo',
    saldo.calcula({ total: 10000, anticipo: 0, folio: 'ET-1',
      sesiones: [abono('ET-1', -5000)], estadoDe: TODO_PAGADO }).saldo, 10000);
}

/* ============================================================ */
titulo('qué abono se deja pasar');
{
  /* Esto corre en el SERVIDOR contra el saldo de verdad: quien puede
     escribir el monto puede escribir cualquier monto. */
  igual('uno normal pasa', saldo.revisaAbono(5000, 10000), { ok: true, monto: 5000 });
  igual('el saldo completo pasa', saldo.revisaAbono(10000, 10000), { ok: true, monto: 10000 });

  cierto('de más NO pasa', !saldo.revisaAbono(10001, 10000).ok);
  cierto('  y se le dice cuánto debe', /10,000/.test(saldo.revisaAbono(10001, 10000).aviso));

  cierto('menos del mínimo NO pasa', !saldo.revisaAbono(99, 10000).ok);
  cierto('  y se le dice por qué', /comisi[oó]n/i.test(saldo.revisaAbono(99, 10000).aviso));
  igual('el mínimo justo sí pasa', saldo.revisaAbono(saldo.MINIMO_ABONO, 10000).ok, true);

  cierto('cero no pasa', !saldo.revisaAbono(0, 10000).ok);
  cierto('negativo no pasa', !saldo.revisaAbono(-500, 10000).ok);
  cierto('texto no pasa', !saldo.revisaAbono('mucho', 10000).ok);

  /* Y sobre un viaje ya pagado no se abona: se dice que está pagado, que
     es una buena noticia y no un error. */
  const pagado = saldo.revisaAbono(500, 0);
  cierto('sobre un viaje pagado no se abona', !pagado.ok);
  cierto('  y se le dice que ya está pagado', /pagado completo/i.test(pagado.aviso));
}

/* ============================================================ */
titulo('lo que se le sugiere al cliente');
{
  igual('la mitad y el total', saldo.sugerencias(10000), [5000, 10000]);
  igual('la mitad se redondea a la centena', saldo.sugerencias(10450), [5200, 10450]);
  /* Con un saldo chico, la mitad redondeada puede subir hasta el mínimo:
     de $150 la mitad es $75 y se ofrece $100, que sí es un abono válido.
     Se deja así a sabiendas —es más de la mitad, pero es lo más chico que
     se puede abonar— y en ningún caso se ofrece algo que no pasaría. */
  igual('con un saldo chico, la mitad sube al mínimo', saldo.sugerencias(150), [100, 150]);

  /* Lo que NUNCA puede pasar: que se sugiera un monto que `revisaAbono`
     rechazaría. Un botón que no funciona es peor que no tenerlo. */
  [10000, 10450, 150, 300, 99, 50, 0].forEach(function (s) {
    const malas = saldo.sugerencias(s).filter(function (m) {
      return !saldo.revisaAbono(m, s).ok;
    });
    igual('con saldo ' + s + ', ninguna sugerencia sería rechazada', malas, []);
  });

  /* Si la mitad no llega al mínimo, no se ofrece. */
  igual('por debajo del mínimo no se sugiere nada', saldo.sugerencias(50), []);
  igual('sin saldo tampoco', saldo.sugerencias(0), []);
}

console.log('\n' + buenas + ' buenas, ' + malas + ' malas');
process.exit(malas ? 1 : 0);
