/* ============================================================
   TODOS LOS PRECIOS DE SPRINTER, AL VENDEDOR (16-sep-2026)
   ============================================================
   Dictado del dueño: «recuerda recomendar todos los precios de Sprinter,
   esos ya los sabes» y «quiero que salgan en la recomendación de la
   nota».

   R45 sigue para el CLIENTE: a más de 1,400 km el motor no da precio.
   Pero el vendedor sí recibe un aproximado por la fórmula del tramo largo
   (R16, $36 el km, ±$9,800), marcado como aproximado, en el ticket y en
   la nota del lead de Kommo. La bandera `estimaLargo` viaja por `extras`
   y solo la pone el ticket: las puertas públicas no la conocen, y el
   candado del criterio (R46) manda sobre ella.
   ============================================================ */
'use strict';

const path = require('path');
const RAIZ = path.join(__dirname, '..');
const tarifa = require(path.join(RAIZ, 'api', '_tarifa.js'));
const kommo = require(path.join(RAIZ, 'api', '_kommo.js'));

let buenas = 0, malas = 0;
function ok(que, condicion) {
  if (condicion) { buenas++; console.log('ok   ' + que); }
  else { malas++; console.log('FALLA ' + que); }
}
function titulo(t) { console.log('\n== ' + t.toUpperCase() + ' =='); }

const LEJOS = { destino: 'Un pueblo lejano que no está en la lista', origen: 'Guadalajara', redondo: true, salida: '2026-11-10', noches: 0, movimientos: [] };

titulo('1 · sin la bandera, R45: a más de 1,400 km no hay precio');
{
  const p = tarifa.calcula(2000, 1, Object.assign({}, LEJOS));
  ok('requiereAsesor y total 0', p.requiereAsesor === true && p.total === 0);
}

titulo('2 · con la bandera, el aproximado del tramo largo (R16)');
{
  const p = tarifa.calcula(2000, 1, Object.assign({}, LEJOS, { estimaLargo: true }));
  ok('ya hay número y no pide asesor', p.requiereAsesor === false && p.total > 0);
  /* Traslado: 6,500 + 22 × 1,400 + 36 × 600 = 58,900; el total puede
     subir por mínimo o redondeo, nunca bajar de ahí. */
  ok('el total no baja del traslado del tramo largo ($58,900)', p.total >= 58900);
  ok('y sigue sin escalón: a 1,401 km sale apenas más que a 1,400',
    tarifa.calcula(1401, 1, Object.assign({}, LEJOS, { estimaLargo: true })).total -
    tarifa.calcula(1400, 1, Object.assign({}, LEJOS)).total <= 500);
}

titulo('3 · la bandera no mueve nada del tramo corto');
{
  const sin = tarifa.calcula(900, 2, Object.assign({}, LEJOS, { noches: 1 }));
  const con = tarifa.calcula(900, 2, Object.assign({}, LEJOS, { noches: 1, estimaLargo: true }));
  ok('a 900 km da lo mismo con o sin bandera', sin.total === con.total && sin.total > 0);
}

titulo('4 · el candado de la página manda sobre la bandera (R46)');
{
  const p = tarifa.calcula(2000, 1, Object.assign({}, LEJOS, { estimaLargo: true, soloDelCriterio: true }));
  ok('con soloDelCriterio sigue sin precio aunque venga estimaLargo', p.requiereAsesor === true && p.total === 0);
}

titulo('5 · la nota del lead conserva el aproximado');
{
  const n = kommo.notaDeTicket('💰 *Precio por confirmar*\n📍 Guadalajara → Puerto Escondido\n🚌 Sprinter · 14 pax\nCalculado: sin precio cerrado (más de 1,400 km, lo pone una persona).\nAprox. por la fórmula larga (±$9,800): *$61,000*\nCalendario: 3 de 5 libres\nContéstame *este mensaje*: *va*');
  ok('trae el «sin precio cerrado» y el aproximado', /Calculado: sin precio cerrado/.test(n) && /Aprox\. por la fórmula larga \(±\$9,800\): \*\$61,000\*/.test(n));
  ok('  y sigue corta (4 renglones)', n.split('\n').length === 4);
}

console.log('\n' + buenas + ' buenas, ' + malas + ' malas');
process.exit(malas ? 1 : 0);
