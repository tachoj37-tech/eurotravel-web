/* ============================================================
   R25 — tres noches para todos, y los tres que él dictó por su nombre
   ------------------------------------------------------------
       node pruebas/probar-dia-no-gratis.cjs

   ESTE ARCHIVO CAMBIO DE LADO EL 30-ago-2026, Y ENTERO.

   Nació el 28-ago para vigilar R18: «abajo de $15,000 el día no es
   gratis, $500 la noche destapada». Dos días después, al
   preguntarle si esa regla seguía en pie —con los once destinos
   afectados y sus números enfrente— el dueño contestó:

       «todos los viajes que tengan el destino y un precio, ya te
        dije, tres noches y mil por cada noche arriba»

   O sea que el corte de los $15,000 se acabó. Las aserciones que
   exigían los $500 se voltearon; las que vigilaban que no bajara
   ningún precio siguen igual de vivas.

   LO QUE NO SE FUE: Comala, Autlán y Bernal. Esos NO tienen
   columna en el Excel —«un destino y un precio» no los alcanza— y
   él los dictó uno por uno, con nombre propio y su tarifa. Siguen
   con la suya, y aquí se comprueba.

   LO QUE VIGILA, en orden de gravedad

   1. Que los precios hayan vuelto EXACTAMENTE a como estaban
      antes de R18. El archivo congelado que servía para probar que
      nada bajaba ahora sirve para probar que todo volvió: si un
      solo renglón queda distinto, es que el retiro se hizo a
      medias.
   2. Que los tres dictados NO se hayan ido con R18.
   3. Que ningún viaje de un día salga más caro que el de dos.
   ============================================================ */
'use strict';

const t = require('../api/_tarifa.js');
const { DESTINOS } = require('../api/_destinos.js');

let buenas = 0, malas = 0;
function igual(nombre, dio, esperado) {
  const a = JSON.stringify(dio), b = JSON.stringify(esperado);
  if (a === b) { buenas++; console.log('ok   ' + nombre); }
  else { malas++; console.log('MAL  ' + nombre + '\n     dio      ' + a + '\n     esperaba ' + b); }
}

/* Kilómetros escogidos para reproducir el precio que el sitio publicado dio
   el 27-ago-2026 en el viaje de dos días. */
const FUERA = {
  'Ocotlán': { km: 160, dosDias: 10000, dia: 0 },          // volvió a la regla general
  'Comala': { km: 442, dosDias: 16200, dia: 500 },         // dictado, sigue
  'Autlán de Navarro': { km: 424, dosDias: 15800, dia: 500 },
  'Bernal': { km: 815, dosDias: 24400, dia: 1000 },        // dictado, sigue
  'Tequisquiapan': { km: 820, dosDias: 24500, dia: 0 }     // nunca tuvo regla
};

function q(nombre, km, dias, movs) {
  const movimientos = [];
  for (let i = 0; i < (movs || 0); i++) movimientos.push({ horaInicio: '09:00', horaFin: '15:00' });
  return t.calcula(km, dias, {
    destino: { texto: nombre }, noches: dias - 1, movimientos: movimientos, unidad: 'sprinter'
  }).total;
}

/* ============ 1. NINGUN PRECIO SE MUEVE SIN QUE ALGUIEN LO DECIDA ==========

   CAMBIO DE BASE — 1-sep-2026, y hay que entender por qué.

   Esta aserción vigilaba que los precios hubieran vuelto EXACTO a como
   estaban antes de R18. Esa misión se cumplió el 30-ago y ya no se puede
   repetir: **R34 los cambió a propósito**.

   R34 salió de una orden del dueño —«cobra 6500 Chapala 4 días»— al
   descubrir que mi piso de $3,000 por día le ganaba a los precios de su
   propio Excel. Chapala a cuatro días cobraba $12,000 valiendo $6,500.

   Contra la base vieja se movieron **219 de 570**: 189 bajaron —el piso
   que se fue— y 30 subieron, que es Acapulco cobrando sus movimientos y
   su día extra de $4,000 (R35).

   La base vieja se DEJA en el repositorio: es el registro de qué cobraba
   la página antes, y con ella se reconstruye cualquier precio viejo si
   un cliente reclama.

   Lo que vigila ahora es lo mismo de siempre, contra la base nueva: que
   ningún precio se mueva sin que alguien lo haya decidido. Si esta
   aserción se pone en rojo, o hubo una regla nueva —y entonces se
   recongela y se escribe por qué— o se rompió algo sin querer. */
{
  const BASE = require('./datos/precios-1-sep-2026.json');
  const DICTADOS = ['Comala', 'Autlán de Navarro', 'Bernal'];
  const distintos = [];
  Object.keys(BASE).forEach(function (clave) {
    const partes = clave.split('|');
    const nombre = partes[0], dias = Number(partes[1]), km = Number(partes[2]);
    if (DICTADOS.indexOf(nombre) >= 0) return;
    const ahora = q(nombre, km, dias, 0);
    if (ahora !== BASE[clave]) {
      distintos.push(nombre + ' a ' + dias + 'd: era $' + BASE[clave] + ', ahora $' + ahora);
    }
  });
  igual('ningun precio se movio solo, en ' +
    Object.keys(BASE).length + ' combinaciones', distintos, []);
}

/* ============ 2. LOS TRES DICTADOS SIGUEN COBRANDO LO SUYO ============
   Comala y Autlán a $500 el día, Bernal a $1,000. Si el retiro de R18 se
   los hubiera llevado por delante, aquí se ve. */
{
  Object.keys(FUERA).forEach(function (d) {
    const c = FUERA[d];
    const dos = q(d, c.km, 2, 0), tres = q(d, c.km, 3, 0);
    igual(d + ': el tercer día cuesta ' + c.dia +
      '   ($' + dos.toLocaleString('es-MX') + ' → $' + tres.toLocaleString('es-MX') + ')',
      tres - dos, c.dia);
  });

  /* Y su tarifa dictada NO abarata las noches que ya se cobraban a mil.
     Éste fue un defecto real, cometido dos veces: ver `cobraNoches`. */
  const ANTES = require('./datos/precios-antes-de-r18.json');
  ['Comala', 'Autlán de Navarro', 'Bernal'].forEach(function (d) {
    const km = FUERA[d].km;
    const bajaron = [3, 4, 5, 7, 10, 20].filter(function (dias) {
      const clave = d + '|' + dias + '|' + km;
      return (clave in ANTES) && q(d, km, dias, 0) < ANTES[clave];
    });
    igual(d + ': ninguna duración bajó contra lo de antes', bajaron, []);
  });
}

/* ============ 3. TRES NOCHES PARA TODOS LOS DE LA TABLA ============
   Ya no hay corte por precio: barato o caro, el que solo trae nombre y
   precio lleva sus tres noches. */
{
  const soloNombre = DESTINOS.filter(function (d) {
    if (!d.precio.sprinter) return false;
    if (d.diasIncluidos || d.porDias || d.movimientosIncluidos) return false;
    /* CDMX y la Huasteca quedan fuera aunque el catálogo no los marque: su
       regla les cobra $1,000 por CADA día desde el primero (R3), así que
       nunca tuvieron noches incluidas que perdonar. La primera versión de
       este filtro los dejaba dentro y la aserción se puso roja con razón. */
    const r = t.reglaDeDestino({ nombre: d.nombre });
    if (r && r.estadiaPorDia) return false;
    return true;
  });
  /* Con tres noches incluidas, 2 y 3 días valen igual salvo que mande el
     piso de $3,000 por día — que no es cosa de esta regla. */
  const raros = soloNombre.filter(function (d) {
    const dos = q(d.nombre, d.km, 2, 0), tres = q(d.nombre, d.km, 3, 0);
    const pisoDeTres = 3 * t.MINIMO_POR_DIA;
    return tres !== dos && tres !== pisoDeTres;
  }).map(function (d) { return d.nombre; });
  igual('en los ' + soloNombre.length + ' de solo nombre, el 3er día es gratis o lo pone el piso',
    raros, []);

  /* Y la cuarta noche sí cobra sus mil, en todos. */
  const sinCobrar = soloNombre.filter(function (d) {
    const cuatro = q(d.nombre, d.km, 4, 0), cinco = q(d.nombre, d.km, 5, 0);
    return cinco - cuatro < 1000;
  }).map(function (d) { return d.nombre; });
  igual('y del 4º día al 5º suben al menos sus mil', sinCobrar, []);
}

/* ============ 4. UN DIA NUNCA CUESTA MAS QUE DOS ============ */
{
  const alReves = Object.keys(FUERA).filter(function (d) {
    return q(d, FUERA[d].km, 1, 0) > q(d, FUERA[d].km, 2, 0);
  });
  igual('un día nunca sale más caro que dos', alReves, []);
}

/* ============ 5. NO SE COME LO QUE YA ESTABA ============ */
{
  const sin = q('Comala', FUERA['Comala'].km, 3, 0);
  const con = q('Comala', FUERA['Comala'].km, 3, 2);
  igual('con movimientos se cobran los dos conceptos', con > sin, true);

  const ida = t.calcula(FUERA['Bernal'].km, 1, {
    destino: { texto: 'Bernal' }, noches: 0, movimientos: [], unidad: 'sprinter', redondo: false
  }).total;
  igual('solo ida sigue sin pagar noches', ida < q('Bernal', FUERA['Bernal'].km, 2, 0), true);
}

console.log('\n' + buenas + ' buenas, ' + malas + ' malas');
process.exit(malas ? 1 : 0);
