/* ------------------------------------------------------------
   EL SEGUIMIENTO · la decisión, con reloj de mentiras
   ------------------------------------------------------------
   Lo que se vigila, en orden de qué tan caro sale si falla:

   1 · Que NUNCA se le escriba a quien ya contestó. Dictado del
       dueño: «si el cliente contesta, ya no quiero mensajes
       automáticos».
   2 · Que sean 22 horas, 3 días y 7 días desde que RECIBIÓ el
       precio (dictado del 6-sep-2026: 24 h / 3 d / 7 d; el 8-sep el
       primero bajó a 22 h para caber en la ventana de Meta y salir
       sin plantilla), y que no haya cuarto.
   3 · Que de noche no se mande nada, y que a las 9 de la mañana de
       Guadalajara sí (Vercel corre en UTC: son las 15:00 allá).
   4 · Que si se pasaron dos toques se mande uno solo, el que toca.
   5 · Que la ventana de 24 h de Meta se calcule desde el último
       mensaje del CLIENTE, no desde el precio. El de 22 h cae
       dentro (texto libre); los de 3 y 7 días caen fuera y van
       al dueño, salvo que haya plantilla.
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
const D = 24 * H;
/* Un lunes a las 10:00 de Guadalajara (16:00 UTC; Jalisco no cambia de
   horario desde 2022). */
const DIA = Date.parse('2026-09-07T16:00:00Z');

/* Precio hace 25 h, él escribió una hora antes del precio. */
function ficha(extra) {
  return Object.assign({
    cliente: '5213311111111', etapa: 'con_precio',
    precioEn: DIA - 25 * H, clienteEn: DIA - 26 * H, toques: 0
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

/* 8-sep-2026: el primero a las 22 h, para caer dentro de la ventana de 24 h
   y salir como texto libre sin plantilla («quitamos lo de Meta»). */
ok('son 22 h, 3 días y 7 días', s.HORAS, [22, 72, 168]);
ok('y son los mismos que conoce _recordatorios', s.HORAS, r.A_LAS_HORAS);
ok('se cierra a los 8 días', s.TOPE_MS / D, 8);

/* ============================================================ */
titulo('a quién le toca');

ok('sin precio no hay nada', s.decide({ cliente: 'x', etapa: 'con_precio' }, DIA).toque, 0);
ok('a las 4 horas, todavía no', s.decide(ficha({ precioEn: DIA - 4 * H, clienteEn: DIA - 5 * H }), DIA), { toque: 0, motivo: 'aún no' });
ok('a las 21:59, todavía no', s.decide(ficha({ precioEn: DIA - 22 * H + 60000 }), DIA).toque, 0);
ok('a las 22 en punto, el primero', s.decide(ficha({ precioEn: DIA - 22 * H }), DIA).toque, 1);
ok('  y con el cliente escribiendo 23 h antes, la ventana sigue abierta: texto libre',
  s.decide(ficha({ precioEn: DIA - 22 * H, clienteEn: DIA - 23 * H }), DIA).ventanaAbierta, true);
ok('a las 25, el primero (y la ventana ya cerró: va por plantilla)',
  s.decide(ficha(), DIA), { toque: 1, motivo: 'toca', ventanaAbierta: false });
ok('con el primero ya mandado, a las 25 nada', s.decide(ficha({ toques: 1 }), DIA).toque, 0);
ok('a los 3 días, el segundo', s.decide(ficha({ precioEn: DIA - 3 * D, clienteEn: DIA - 3 * D - H, toques: 1 }), DIA).toque, 2);
ok('a los 7 días, el tercero', s.decide(ficha({ precioEn: DIA - 7 * D, clienteEn: DIA - 7 * D - H, toques: 2 }), DIA).toque, 3);
ok('con los tres mandados, completo', s.decide(ficha({ precioEn: DIA - 7 * D - H, toques: 3 }), DIA), { toque: 0, motivo: 'completo' });
ok('a los 8 días y una hora se cierra, aunque falte uno',
  s.decide(ficha({ precioEn: DIA - 8 * D - H, clienteEn: DIA - 8 * D - 2 * H, toques: 2 }), DIA), { toque: 0, motivo: 'tarde', cerrar: true });

/* ============================================================ */
titulo('si contestó, se acabó');

ok('escribió después del precio: cerrar, y nada',
  s.decide(ficha({ precioEn: DIA - 25 * H, clienteEn: DIA - 1 * H }), DIA), { toque: 0, motivo: 'contestó', cerrar: true });
ok('escribió después aunque ya fuera hora del segundo: nada',
  s.decide(ficha({ precioEn: DIA - 4 * D, clienteEn: DIA - 2 * H, toques: 1 }), DIA).toque, 0);
ok('avanzó de etapa (dijo que sí): cerrar',
  s.decide(ficha({ etapa: 'va_a_apartar' }), DIA), { toque: 0, motivo: 'ya avanzó', cerrar: true });
ok('ya tiene contrato: cerrar',
  s.decide(ficha({ contratoSubido: { folio: 'ET-1' } }), DIA).cerrar, true);

/* ============================================================ */
titulo('de noche no');

const NOCHE = Date.parse('2026-09-08T04:00:00Z'); // 10 p.m. en Guadalajara
ok('a las 10 p.m. el primero espera', s.decide(ficha({ precioEn: NOCHE - 25 * H, clienteEn: NOCHE - 26 * H }), NOCHE), { toque: 0, motivo: 'de noche' });
const MANANA = Date.parse('2026-09-08T15:00:00Z'); // 9 a.m.
ok('y a las 9 a.m. sale (36 h después del precio sigue siendo el primero)',
  s.decide(ficha({ precioEn: MANANA - 36 * H, clienteEn: MANANA - 37 * H }), MANANA).toque, 1);

/* ============================================================ */
titulo('si se pasaron dos, se manda uno');

ok('a los 4 días sin ninguno, va el SEGUNDO (no el primero)',
  s.decide(ficha({ precioEn: DIA - 4 * D, clienteEn: DIA - 4 * D - H, toques: 0 }), DIA).toque, 2);
ok('a los 7 días y medio sin ninguno, va el tercero',
  s.decide(ficha({ precioEn: DIA - 7.5 * D, clienteEn: DIA - 7.5 * D - H, toques: 0 }), DIA).toque, 3);

/* ============================================================ */
titulo('la ventana de 24 h de meta');

ok('el cliente escribió hace 26 h: cerrada', s.decide(ficha(), DIA).ventanaAbierta, false);
ok('escribió hace 23 h (el precio llegó justo después): abierta',
  s.decide(ficha({ precioEn: DIA - 24 * H, clienteEn: DIA - 23 * H - 60000 }), DIA).motivo, 'contestó');
ok('escribió una hora antes del precio de hace 24 h: cerrada',
  s.decide(ficha({ precioEn: DIA - 24 * H, clienteEn: DIA - 25 * H }), DIA).ventanaAbierta, false);
ok('sin fecha de su último mensaje (ficha vieja): cerrada, por si acaso',
  s.decide(ficha({ clienteEn: null }), DIA).ventanaAbierta, false);
ok('la ventana mide 23 h y media', s.VENTANA_MS / H, 23.5);

/* ============================================================ */
titulo('los textos existen para los tres');

[1, 2, 3].forEach(function (n) {
  const t = r.recordatorio(n, { cliente: '5213311111111', vuelta: 7 });
  ok('hay texto para el toque ' + n, typeof t === 'string' && t.length > 10, true);
  ok('  sin precio ni descuento', /\$|descuento|%/i.test(t), false);
});

console.log('\n' + buenas + ' buenas, ' + malas + ' malas');
process.exit(malas ? 1 : 0);
