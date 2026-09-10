/* La memoria de precios del dueño: qué es «el mismo viaje» y cómo se le enseña lo que dio. */
'use strict';
const ap = require('../api/_precios-aprendidos.js');

let buenas = 0, malas = 0;
function igual(nombre, dado, esperado) {
  const ok = JSON.stringify(dado) === JSON.stringify(esperado);
  if (ok) buenas++; else malas++;
  console.log((ok ? 'ok    ' : 'FALLA ') + nombre + (ok ? '' : '\n      dio ' + JSON.stringify(dado) + ', se esperaba ' + JSON.stringify(esperado)));
}

/* La llave: mismo viaje aunque cambien mayúsculas, acentos, espacios o
   pasajeros.

   CAMBIÓ DE LADO EL 10-sep-2026, y por eso: el origen entra por ZONA y ya
   no como texto. Estas aserciones decían «guadalajara|…» y «gdl|…», o sea
   que daban por bueno que «Guadalajara», «gdl» y «Zapopan» fueran TRES
   viajes distintos. Con eso el dueño ponía el precio de Chapala una vez y
   la siguiente no se le sugería, porque el cliente escribió el nombre de
   su municipio en vez del de la ciudad — el aprendizaje casi no acumulaba.

   Dictado del dueño ese día: «lo único que quiero que reconozca el chatbot
   es si sale de la ZMG de Guadalajara o de Ocotlán, Yurécuaro, etc.». La
   zona es la unidad buena, y las de recargo conservan la suya. */
const base = { origen: 'Guadalajara', destino: 'Chapala', salida: '2026-11-20', regreso: '2026-11-22', gente: 12 };
igual('clave normal', ap.claveDe(base, 'Sprinter'), 'zmg|chapala|sprinter|3');
igual('mayúsculas y acentos no separan viajes',
  ap.claveDe({ origen: 'GUADALAJARA ', destino: 'Chápala', salida: '2026-11-20', regreso: '2026-11-22' }, 'SPRINTER'),
  'zmg|chapala|sprinter|3');
igual('los pasajeros no separan viajes',
  ap.claveDe(Object.assign({}, base, { gente: 14 }), 'Sprinter'), ap.claveDe(base, 'Sprinter'));
igual('otra unidad es otro viaje', ap.claveDe(base, 'Irizar i6') !== ap.claveDe(base, 'Sprinter'), true);
igual('otros días son otro viaje', ap.claveDe(Object.assign({}, base, { regreso: '2026-11-21' }), 'Sprinter'), 'zmg|chapala|sprinter|2');
igual('ida y vuelta el mismo día es 1 día', ap.claveDe({ origen: 'gdl', destino: 'tequila', salida: '2026-10-01', regreso: '2026-10-01' }, 'Sprinter'), 'zmg|tequila|sprinter|1');
igual('sin unidad no truena', ap.claveDe(base, ''), 'zmg|chapala|sin unidad|3');

/* Lo que la zona junta y lo que NO junta. Es la razón del cambio, así que
   va probado y no de palabra. */
function conOrigen(o) { return ap.claveDe(Object.assign({}, base, { origen: o }), 'Sprinter'); }
igual('toda la ZMG es el mismo viaje',
  [conOrigen('gdl'), conOrigen('Zapopan'), conOrigen('Tlaquepaque'), conOrigen('Tonalá'), conOrigen('de Guadalajara')],
  ['zmg|chapala|sprinter|3', 'zmg|chapala|sprinter|3', 'zmg|chapala|sprinter|3', 'zmg|chapala|sprinter|3', 'zmg|chapala|sprinter|3']);
igual('Ocotlán y sus pueblos van juntos, y aparte de la ZMG',
  [conOrigen('Ocotlán'), conOrigen('ocotlan'), conOrigen('Jamay'), conOrigen('La Barca')],
  ['zona ocotlan|chapala|sprinter|3', 'zona ocotlan|chapala|sprinter|3',
    'zona ocotlan|chapala|sprinter|3', 'zona ocotlan|chapala|sprinter|3']);
igual('Yurécuaro tiene la suya', conOrigen('Tanhuato'), 'zona yurecuaro|chapala|sprinter|3');
igual('y las tres zonas son tres viajes distintos',
  new Set([conOrigen('Guadalajara'), conOrigen('Ocotlán'), conOrigen('Yurécuaro')]).size, 3);
igual('un origen de fuera conserva su nombre', conOrigen('Colima'), 'colima|chapala|sprinter|3');

// El renglón que se guarda.
const r = ap.renglonDe(base, 'Sprinter', { total: 48000, anticipo: 10000 }, { fijado: true, cliente: '5213366670010' });
igual('renglón: clave, total, anticipo, fijado', [r.clave, r.total, r.anticipo, r.fijado], ['zmg|chapala|sprinter|3', 48000, 10000, true]);
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
