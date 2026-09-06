/* ------------------------------------------------------------
   EL SEGUIMIENTO · la decisión, con reloj de mentiras
   ------------------------------------------------------------
   Lo que se vigila, en orden de qué tan caro sale si falla:

   1 · Que NUNCA se le escriba a quien ya contestó. Dictado del
       dueño: «si el cliente contesta, ya no quiero mensajes
       automáticos».
   2 · Que sean 4, 24 y 72 horas desde que RECIBIÓ el precio, y que
       no haya cuarto.
   3 · Que de noche no se mande nada, y que a las 9 de la mañana de
       Guadalajara sí (Vercel corre en UTC: son las 15:00 allá).
   4 · Que si se pasaron dos toques se mande uno solo, el que toca.
   5 · Que la ventana de 24 h de Meta se calcule desde el último
       mensaje del CLIENTE, no desde el precio.
   ------------------------------------------------------------ */

const s = require('../api/_seguimiento.js');
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
function titulo(t) { console.log('\n== ' + t.toUpperCase() + ' =='); }

const H = 60 * 60 * 1000;
/* Un lunes a las 10:00 de Guadalajara (16:00 UTC; Jalisco no cambia de
   horario desde 2022). */
const DIA = Date.parse('2026-09-07T16:00:00Z');

function ficha(extra) {
  return Object.assign({
    cliente: '5213311111111', etapa: 'con_precio',
    precioEn: DIA - 5 * H, clienteEn: DIA - 6 * H, toques: 0
  }, extra || {});
}

/* ============================================================ */
titulo('la hora de guadalajara');

ok('16:00 UTC son las 10 en Guadalajara', s.horaEnGuadalajara(DIA), 10);
ok('15:00 UTC son las 9: ya se puede', s.esHoraDeEscribir(Date.parse('2026-09-07T15:00:00Z')), true);
ok('14:59 UTC son las 8:59: todavía no', s.esHoraDeEscribir(Date.parse('2026-09-07T14:59:00Z')), false);
ok('02:59 UTC son las 8:59 p.m.: todavía sí', s.esHoraDeEscribir(Date.parse('2026-09-08T02:59:00Z')), true);
ok('03:00 UTC son las 9 p.m.: ya no', s.esHoraDeEscribir(Date.parse('2026-09-08T03:00:00Z')), false);

/* ============================================================ */
titulo('los tiempos');

ok('son 4, 24 y 72 horas', s.HORAS, [4, 24, 72]);
ok('y son los mismos que conoce _recordatorios', s.HORAS, r.A_LAS_HORAS);
ok('se cierra a las 96', s.TOPE_MS / H, 96);

/* ============================================================ */
titulo('a quién le toca');

ok('sin precio no hay nada', s.decide({ cliente: 'x', etapa: 'con_precio' }, DIA).toque, 0);
ok('a las 2 horas, todavía no', s.decide(ficha({ precioEn: DIA - 2 * H }), DIA), { toque: 0, motivo: 'aún no' });
ok('a las 3:59, todavía no', s.decide(ficha({ precioEn: DIA - 4 * H + 60000 }), DIA).toque, 0);
ok('a las 4 en punto, el primero', s.decide(ficha({ precioEn: DIA - 4 * H }), DIA).toque, 1);
ok('a las 5, el primero', s.decide(ficha(), DIA), { toque: 1, motivo: 'toca', ventanaAbierta: true });
ok('con el primero ya mandado, a las 5 nada', s.decide(ficha({ toques: 1 }), DIA).toque, 0);
ok('a las 24, el segundo', s.decide(ficha({ precioEn: DIA - 24 * H, clienteEn: DIA - 25 * H, toques: 1 }), DIA).toque, 2);
ok('a las 72, el tercero', s.decide(ficha({ precioEn: DIA - 72 * H, clienteEn: DIA - 73 * H, toques: 2 }), DIA).toque, 3);
ok('con los tres mandados, completo', s.decide(ficha({ precioEn: DIA - 80 * H, toques: 3 }), DIA), { toque: 0, motivo: 'completo' });
ok('a las 97 horas se cierra, aunque falte uno',
  s.decide(ficha({ precioEn: DIA - 97 * H, clienteEn: DIA - 98 * H, toques: 2 }), DIA), { toque: 0, motivo: 'tarde', cerrar: true });

/* ============================================================ */
titulo('si contestó, se acabó');

ok('escribió después del precio: cerrar, y nada',
  s.decide(ficha({ precioEn: DIA - 5 * H, clienteEn: DIA - 1 * H }), DIA), { toque: 0, motivo: 'contestó', cerrar: true });
ok('escribió después aunque ya fuera hora del segundo: nada',
  s.decide(ficha({ precioEn: DIA - 30 * H, clienteEn: DIA - 2 * H, toques: 1 }), DIA).toque, 0);
ok('avanzó de etapa (dijo que sí): cerrar',
  s.decide(ficha({ etapa: 'va_a_apartar' }), DIA), { toque: 0, motivo: 'ya avanzó', cerrar: true });
ok('ya tiene contrato: cerrar',
  s.decide(ficha({ contratoSubido: { folio: 'ET-1' } }), DIA).cerrar, true);

/* ============================================================ */
titulo('de noche no');

const NOCHE = Date.parse('2026-09-08T04:00:00Z'); // 10 p.m. en Guadalajara
ok('a las 10 p.m. el primero espera', s.decide(ficha({ precioEn: NOCHE - 5 * H, clienteEn: NOCHE - 6 * H }), NOCHE), { toque: 0, motivo: 'de noche' });
const MANANA = Date.parse('2026-09-08T15:00:00Z'); // 9 a.m.
ok('y a las 9 a.m. sale (15 h después del precio sigue siendo el primero)',
  s.decide(ficha({ precioEn: MANANA - 15 * H, clienteEn: MANANA - 16 * H }), MANANA).toque, 1);

/* ============================================================ */
titulo('si se pasaron dos, se manda uno');

ok('a las 26 horas sin ninguno, va el SEGUNDO (no el primero)',
  s.decide(ficha({ precioEn: DIA - 26 * H, clienteEn: DIA - 27 * H, toques: 0 }), DIA).toque, 2);
ok('a las 75 sin ninguno, va el tercero',
  s.decide(ficha({ precioEn: DIA - 75 * H, clienteEn: DIA - 76 * H, toques: 0 }), DIA).toque, 3);

/* ============================================================ */
titulo('la ventana de 24 h de meta');

ok('el cliente escribió hace 6 h: abierta', s.decide(ficha(), DIA).ventanaAbierta, true);
ok('escribió hace 23 h: abierta', s.decide(ficha({ precioEn: DIA - 5 * H, clienteEn: DIA - 23 * H }), DIA).ventanaAbierta, true);
ok('escribió hace 23 h y media: cerrada (margen)', s.decide(ficha({ precioEn: DIA - 5 * H, clienteEn: DIA - 23.5 * H }), DIA).ventanaAbierta, false);
ok('el precio fue hace 5 h pero él escribió hace 30: cerrada',
  s.decide(ficha({ precioEn: DIA - 5 * H, clienteEn: DIA - 30 * H }), DIA).ventanaAbierta, false);
ok('sin fecha de su último mensaje (ficha vieja): cerrada, por si acaso',
  s.decide(ficha({ clienteEn: null }), DIA).ventanaAbierta, false);

/* ============================================================ */
titulo('los textos existen para los tres');

[1, 2, 3].forEach(function (n) {
  const t = r.recordatorio(n, { cliente: '5213311111111', vuelta: 7 });
  ok('hay texto para el toque ' + n, typeof t === 'string' && t.length > 10, true);
  ok('  sin precio ni descuento', /\$|descuento|%/i.test(t), false);
});

console.log('\n' + buenas + ' buenas, ' + malas + ' malas');
process.exit(malas ? 1 : 0);
