/* ------------------------------------------------------------
   LOS RECORDATORIOS
   ------------------------------------------------------------
   Lo que se vigila aquí, en orden de qué tan caro sale si falla:

   1 · Que NUNCA se afirme que una fecha está libre sin que
       alguien lo haya comprobado. El dueño lo cachó antes de que
       se escribiera: «¿qué tal si después de las 72 horas ya se
       llenó?». Decírselo y que no sea cierto es peor que no
       escribir.
   2 · Que NUNCA haya un descuento. «Esos los ofrezco yo, tú no».
   3 · Que no haya un cuarto toque. Tres y silencio.
   4 · Que el mismo cliente no reciba dos veces el mismo texto.
   ------------------------------------------------------------ */

const r = require('../api/_recordatorios.js');

let buenas = 0, malas = 0;
function ok(que, dio, esperaba) {
  const bien = JSON.stringify(dio) === JSON.stringify(esperaba);
  if (bien) { buenas++; console.log('ok   ' + que); }
  else {
    malas++;
    console.log('MAL  ' + que);
    console.log('     dio      ' + JSON.stringify(dio));
    console.log('     esperaba ' + JSON.stringify(esperaba));
  }
}
function okQue(que, condicion) { ok(que, !!condicion, true); }
function titulo(t) { console.log('\n== ' + t.toUpperCase() + ' =='); }

const TODOS = r.UNA_HORA
  .concat(r.VEINTICUATRO_HORAS)
  .concat(r.SETENTA_Y_DOS_SIN_CALENDARIO)
  .concat(r.SETENTA_Y_DOS_CON_CALENDARIO);

/* ============================================================ */
titulo('hay diez de cada uno, y ninguno repetido');

ok('diez para la primera hora', r.UNA_HORA.length, 10);
ok('diez para las 24', r.VEINTICUATRO_HORAS.length, 10);
ok('diez para las 72, sin calendario', r.SETENTA_Y_DOS_SIN_CALENDARIO.length, 10);
ok('diez para las 72, con calendario', r.SETENTA_Y_DOS_CON_CALENDARIO.length, 10);

ok('los 40 son distintos entre sí', new Set(TODOS).size, 40);

/* Y ninguno larguísimo: en WhatsApp un párrafo se salta. */
const largos = TODOS.filter(function (t) { return t.length > 160; });
ok('ninguno se pasa de largo', largos, []);

/* ============================================================ */
titulo('NUNCA un precio, NUNCA un descuento');

/* «no hay ningún descuento jamás. Esos descuentos por tu propia cuenta
   los ofrezco yo, pero tú no» — el dueño, 2-sep-2026.

   Y la investigación dice lo mismo por otro lado: ofrecer descuento
   temprano entrena al cliente a NO contestar la primera vez, a ver si
   le bajan. Se arruina el siguiente viaje y el siguiente. */
const conDinero = TODOS.filter(function (t) {
  return /\$|\bpesos?\b|descuent|rebaj|promoci[oó]n|oferta|te lo dejo en|precio especial|\d{3,}/i.test(t);
});
ok('ningún recordatorio trae dinero ni descuento', conDinero, []);

/* Tampoco urgencia inventada del tipo «quedan 2 lugares». */
const conUrgenciaFalsa = TODOS.filter(function (t) {
  return /quedan \d|[uú]ltimo lugar|se agota|corre|apres[uú]rate|no lo pienses/i.test(t);
});
ok('ni urgencia inventada', conUrgenciaFalsa, []);

/* Ni afirmaciones de la empresa que no podemos sostener. */
const inventos = TODOS.filter(function (t) {
  return /\b\d+\s*(a[nñ]os|unidades|grupos)\b|el mejor|l[ií]der|garantiz|n[uú]mero uno/i.test(t);
});
ok('ni datos de la empresa que no tenemos', inventos, []);

/* ============================================================ */
titulo('la fecha libre NO se afirma sin comprobarla');

/* ESTA ES LA IMPORTANTE DE TODO EL ARCHIVO. */
const AFIRMA_LIBRE = /libre|disponible|sigue abierto|todav[ií]a (tengo|alcanzas)|apartada/i;

/* Sin calendario, ninguno de los diez puede afirmarlo. */
const seAdelantan = r.SETENTA_Y_DOS_SIN_CALENDARIO.filter(function (t) {
  return AFIRMA_LIBRE.test(t);
});
ok('sin calendario, ninguno dice que la fecha está libre', seAdelantan, []);

/* Y el que se pide sin bandera tampoco. */
const sinBandera = r.recordatorio(3, { cliente: '5213311112222' });
okQue('el tercer toque por omisión no afirma disponibilidad',
  !AFIRMA_LIBRE.test(sinBandera));

/* Aunque digan que sí, si no viene la fecha NO se usa el juego que la
   nombra: un mensaje que dice «el [fecha]» con el hueco vacío es peor
   que no mandar nada. */
const sinFecha = r.recordatorio(3, { cliente: '5213311112222', fechaLibre: true });
okQue('con bandera pero SIN fecha, tampoco', !AFIRMA_LIBRE.test(sinFecha));
okQue('y nunca queda el hueco sin rellenar', !/\[fecha\]/.test(sinFecha));

/* Con las dos cosas sí, y con la fecha puesta. */
const conTodo = r.recordatorio(3, {
  cliente: '5213311112222', fechaLibre: true, fecha: '12 de septiembre'
});
okQue('con calendario Y fecha, ya puede decirlo', AFIRMA_LIBRE.test(conTodo));
/* No todas las variantes nombran la fecha: algunas dicen «tu fecha» y
   se leen mejor así. Lo que sí tiene que cumplirse SIEMPRE es que no
   quede un hueco sin rellenar. */
okQue('  sin dejar el hueco', !/\[fecha\]/.test(conTodo));

/* Y las que SÍ lo nombran, lo rellenan de verdad. */
(function () {
  const conHueco = r.SETENTA_Y_DOS_CON_CALENDARIO
    .filter(function (t) { return /\[fecha\]/.test(t); });
  okQue('varias variantes nombran la fecha', conHueco.length >= 4);

  const malRellenadas = conHueco.filter(function (t) {
    const salida = t.replace(/\[fecha\]/g, '12 de septiembre');
    return !/12 de septiembre/.test(salida) || /\[fecha\]/.test(salida);
  });
  ok('  y todas la rellenan bien', malRellenadas, []);
})();

/* Ni uno solo de los diez «con calendario» puede quedarse con el hueco. */
const huecos = r.SETENTA_Y_DOS_CON_CALENDARIO.filter(function (t, i) {
  const salida = String(t).replace(/\[fecha\]/g, '12 de septiembre');
  return /\[fecha\]/.test(salida);
});
ok('ninguno se queda con el hueco al rellenarlo', huecos, []);

/* ============================================================ */
titulo('tres toques, y se acaba');

okQue('hay primero', !!r.recordatorio(1, { cliente: '52133' }));
okQue('hay segundo', !!r.recordatorio(2, { cliente: '52133' }));
okQue('hay tercero', !!r.recordatorio(3, { cliente: '52133' }));
/* El cuarto NO existe, y devolver null es la forma de que no exista:
   quien llame no tiene nada que mandar. Después del tercero, insistir
   quema al cliente para siempre. */
ok('NO hay cuarto', r.recordatorio(4, { cliente: '52133' }), null);
ok('ni quinto', r.recordatorio(5, { cliente: '52133' }), null);

ok('y los tiempos son 1, 24 y 72 horas', r.A_LAS_HORAS, [1, 24, 72]);

/* ============================================================ */
titulo('a cada quien le toca una distinta');

/* Pedido del dueño: «que el cliente no diga: está mandando lo mismo,
   ya me la sé». */
(function () {
  const numeros = [];
  for (let i = 0; i < 200; i++) numeros.push('52133' + (10000000 + i * 7));

  [1, 2, 3].forEach(function (toque) {
    const salieron = numeros.map(function (n) {
      return r.recordatorio(toque, { cliente: n });
    });
    const distintas = new Set(salieron).size;
    /* Con 200 clientes y 10 variantes, tienen que salir las 10. Si
       saliera una sola, el repartidor estaría roto y nadie lo notaría
       hasta que el vendedor viera cien mensajes idénticos. */
    ok('toque ' + toque + ': con 200 clientes salen las 10 variantes',
      distintas, 10);
  });
})();

/* Y el MISMO cliente recibe siempre la misma en su secuencia: si
   cambiara a media conversación, el bot se contradiría solo. */
(function () {
  const uno = r.recordatorio(1, { cliente: '5213399998888' });
  const otra = r.recordatorio(1, { cliente: '5213399998888' });
  ok('el mismo cliente recibe la misma, no una al azar', uno, otra);
})();

/* Pero si vuelve semanas después por otro viaje, le toca otra: si no,
   sentiría que le mandan la grabación de siempre. */
(function () {
  const primera = r.recordatorio(1, { cliente: '5213399998888', vuelta: 0 });
  let cambio = 0;
  for (let v = 1; v <= 9; v++) {
    if (r.recordatorio(1, { cliente: '5213399998888', vuelta: v }) !== primera) cambio++;
  }
  okQue('si vuelve por otro viaje, le tocan otras', cambio >= 7);
})();

/* ============================================================ */
titulo('y ninguno anuncia que pasa con alguien');

/* El bot vive dentro del chat del vendedor: no hay a quién pasar. */
const delatan = TODOS.filter(function (t) {
  return /te paso con|un vendedor|te contactar|asesor/i.test(t);
});
ok('ninguno delata al bot', delatan, []);

/* ============================================================ */
console.log('\n' + buenas + ' buenas, ' + malas + ' malas');
process.exit(malas ? 1 : 0);
