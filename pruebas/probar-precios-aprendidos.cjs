/* La memoria de precios del dueño: qué es «el mismo viaje» y cómo se le enseña lo que dio. */
'use strict';
const ap = require('../api/_precios-aprendidos.js');

let buenas = 0, malas = 0;
function igual(nombre, dado, esperado) {
  const ok = JSON.stringify(dado) === JSON.stringify(esperado);
  if (ok) buenas++; else malas++;
  console.log((ok ? 'ok    ' : 'FALLA ') + nombre + (ok ? '' : '\n      dio ' + JSON.stringify(dado) + ', se esperaba ' + JSON.stringify(esperado)));
}

// La llave: mismo viaje aunque cambien mayúsculas, acentos, espacios o pasajeros.
const base = { origen: 'Guadalajara', destino: 'Chapala', salida: '2026-11-20', regreso: '2026-11-22', gente: 12 };
igual('clave normal', ap.claveDe(base, 'Sprinter'), 'guadalajara|chapala|sprinter|3');
igual('mayúsculas y acentos no separan viajes',
  ap.claveDe({ origen: 'GUADALAJARA ', destino: 'Chápala', salida: '2026-11-20', regreso: '2026-11-22' }, 'SPRINTER'),
  'guadalajara|chapala|sprinter|3');
igual('los pasajeros no separan viajes',
  ap.claveDe(Object.assign({}, base, { gente: 14 }), 'Sprinter'), ap.claveDe(base, 'Sprinter'));
igual('otra unidad es otro viaje', ap.claveDe(base, 'Irizar i6') !== ap.claveDe(base, 'Sprinter'), true);
igual('otros días son otro viaje', ap.claveDe(Object.assign({}, base, { regreso: '2026-11-21' }), 'Sprinter'), 'guadalajara|chapala|sprinter|2');
igual('ida y vuelta el mismo día es 1 día', ap.claveDe({ origen: 'gdl', destino: 'tequila', salida: '2026-10-01', regreso: '2026-10-01' }, 'Sprinter'), 'gdl|tequila|sprinter|1');
igual('sin unidad no truena', ap.claveDe(base, ''), 'guadalajara|chapala|sin unidad|3');

// El renglón que se guarda.
const r = ap.renglonDe(base, 'Sprinter', { total: 48000, anticipo: 10000 }, { fijado: true, cliente: '5213366670010' });
igual('renglón: clave, total, anticipo, fijado', [r.clave, r.total, r.anticipo, r.fijado], ['guadalajara|chapala|sprinter|3', 48000, 10000, true]);
igual('renglón: pasajeros de `gente`, días, salida', [r.pasajeros, r.dias, r.salida], [12, 3, '2026-11-20']);
igual('renglón: cliente a 10 dígitos', r.cliente, '3366670010');

// Las líneas del ticket.
igual('sin historial: nada (no se inventa)', ap.lineasDeHistorial([]), []);
igual('sin historial (null): nada', ap.lineasDeHistorial(null), []);
igual('un precio que él fijó: se enseña con ✍️ y se sugiere',
  ap.lineasDeHistorial([{ total: 48000, pasajeros: 12, salida: '2026-11-20', fijado: true }]),
  ['Antes lo diste a: $48,000 (20 nov · 12 pax) ✍️', 'Sugerido: *$48,000*']);
igual('se sugiere el último FIJADO aunque haya un «va» más reciente',
  ap.lineasDeHistorial([
    { total: 46000, pasajeros: 10, salida: '2026-12-01', fijado: false },
    { total: 48000, pasajeros: 12, salida: '2026-11-20', fijado: true }
  ]),
  ['Antes lo diste a: $46,000 (1 dic · 10 pax) · $48,000 (20 nov · 12 pax) ✍️', 'Sugerido: *$48,000*']);
igual('sin fijados, se sugiere el más reciente confirmado',
  ap.lineasDeHistorial([{ total: 46000, fijado: false }, { total: 45000, fijado: false }]),
  ['Antes lo diste a: $46,000 · $45,000', 'Sugerido: *$46,000*']);
igual('máximo tres en la línea',
  ap.lineasDeHistorial([{ total: 1000 }, { total: 2000 }, { total: 3000 }, { total: 4000 }])[0],
  'Antes lo diste a: $1,000 · $2,000 · $3,000');
igual('totales en cero se ignoran', ap.lineasDeHistorial([{ total: 0 }]), []);

console.log('\n' + buenas + ' buenas, ' + malas + ' malas');
process.exit(malas ? 1 : 0);
