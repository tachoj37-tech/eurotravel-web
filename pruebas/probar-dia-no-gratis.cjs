/* ============================================================
   R18 — abajo de $15,000, el día no es gratis
   ------------------------------------------------------------
       node pruebas/probar-dia-no-gratis.cjs

   DE DONDE SALIO

   El 28-ago-2026 el dueño revisó los 50 casos que la página cotiza
   sola y vio que tres y cuatro días costaban EXACTAMENTE lo mismo
   que dos: las tres noches incluidas se los comían. Dictó, en dos
   tiempos y con estas palabras:

       «súbeles 500, el día, a los 4 de abajo»
       «a Bernal 1000 el día»
       «esos 500 exclusivamente a destinos abajo de 15,000
        en precio normal»

   Quedó entonces una regla general por PRECIO, no por distancia ni
   por estar en la tabla: si el viaje de dos días cuesta menos de
   $15,000, cada día de más vale $500. Comala y Autlán están arriba
   del tope pero él los nombró, así que llevan la suya. Bernal
   también, a $1,000.

   LO QUE ESTA PRUEBA VIGILA, en orden de gravedad

   1. QUE NINGUN PRECIO BAJE. Aquí me equivoqué dos veces —ver el
      comentario de `cobraNoches`— y las dos veces el error era el
      mismo: cobrar una noche que era gratis terminaba abaratando
      las que ya se cobraban. Un viaje de diez días llegó a bajar
      $2,000. Ésta es LA aserción de este archivo.
   2. Que el viaje de DOS DIAS no se haya movido: él no pidió
      subirlo, y cobrar «el día» desde el primero lo habría subido.
   3. Que el día de más sí se cobre.
   4. Que arriba de $15,000 nada cambie, salvo lo que él dictó.
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
   el 27-ago-2026 en el viaje de dos días. Abajo se comprueba que en efecto lo
   reproducen: si algún día cambia la tarifa por kilómetro, esa aserción avisa
   antes de que el resto empiece a medir otra cosa. */
const FUERA = {
  'Ocotlán': { km: 160, dosDias: 10000, dia: 500 },        // por la regla general
  'Comala': { km: 442, dosDias: 16200, dia: 500 },         // dictado, arriba del tope
  'Autlán de Navarro': { km: 424, dosDias: 15800, dia: 500 },
  'Bernal': { km: 815, dosDias: 24400, dia: 1000 },        // dictado
  'Tequisquiapan': { km: 820, dosDias: 24500, dia: 0 }     // sin regla: no cambia
};

function q(nombre, km, dias, movs) {
  const movimientos = [];
  for (let i = 0; i < (movs || 0); i++) movimientos.push({ horaInicio: '09:00', horaFin: '15:00' });
  return t.calcula(km, dias, {
    destino: { texto: nombre }, noches: dias - 1, movimientos: movimientos, unidad: 'sprinter'
  }).total;
}

/* ============ 1. NINGUN PRECIO BAJA ============
   Se recorre TODA la tabla del dueño y los de fuera, de 1 a 20 días, contra
   lo que costaban antes de esta regla. Es la aserción que más vale. */
{
  const ANTES = require('./datos/precios-antes-de-r18.json');
  const bajaron = [];
  Object.keys(ANTES).forEach(function (clave) {
    const partes = clave.split('|');
    const nombre = partes[0], dias = Number(partes[1]), km = Number(partes[2]);
    const ahora = q(nombre, km, dias, 0);
    if (ahora < ANTES[clave]) {
      bajaron.push(nombre + ' a ' + dias + 'd: $' + ANTES[clave] + ' → $' + ahora);
    }
  });
  igual('NINGUN precio bajó, en ' + Object.keys(ANTES).length + ' combinaciones', bajaron, []);
}

/* ============ 2. EL VIAJE DE DOS DIAS NO SE MOVIO ============ */
{
  const movidos = Object.keys(FUERA).filter(function (d) {
    return q(d, FUERA[d].km, 2, 0) !== FUERA[d].dosDias;
  });
  igual('los kilómetros reproducen el precio medido, y DOS DIAS no se movió', movidos, []);

  const alReves = Object.keys(FUERA).filter(function (d) {
    return q(d, FUERA[d].km, 1, 0) > q(d, FUERA[d].km, 2, 0);
  });
  igual('y un día nunca sale más caro que dos', alReves, []);
}

/* ============ 3. EL DIA DE MAS SE COBRA ============ */
{
  Object.keys(FUERA).forEach(function (d) {
    const c = FUERA[d];
    const dos = q(d, c.km, 2, 0), tres = q(d, c.km, 3, 0);
    igual(d + ': el tercer día cuesta ' + c.dia +
      '   ($' + dos.toLocaleString('es-MX') + ' → $' + tres.toLocaleString('es-MX') + ')',
      tres - dos, c.dia);
  });
}

/* ============ 4. EL CORTE ES POR PRECIO ============
   Un destino barato de la tabla entra; uno caro no. */
{
  const baratos = DESTINOS.filter(function (d) {
    return d.precio.sprinter && d.precio.sprinter < t.TOPE_DIA_BARATO && !d.diasIncluidos;
  });
  const caros = DESTINOS.filter(function (d) {
    return d.precio.sprinter && d.precio.sprinter >= t.TOPE_DIA_BARATO && !d.diasIncluidos;
  });

  /* En los baratos, el tercer día ya no es gratis. Se compara contra el
     traslado y no contra el precio de dos días, porque en varios manda el
     piso de $3,000 por día y ése no es cosa de esta regla. */
  const gratis = baratos.filter(function (d) {
    return q(d.nombre, d.km, 3, 0) === q(d.nombre, d.km, 2, 0);
  }).map(function (d) { return d.nombre; });
  igual('en los ' + baratos.length + ' renglones baratos, el tercer día ya no es gratis', gratis, []);

  /* En los caros, la regla NO los tocó.

     ESTA ASERCION NACIO MAL: decía «el tercer día sigue incluido» y comparaba
     3 días contra 2. Se puso roja con siete destinos, y la roja tenía razón:
     varios caros YA cobraban el día antes de esta regla —CDMX y la Huasteca
     por su `estadiaPorDia`, y otros por el `diaExtra` de su propio renglón—.
     Que el tercer día les cueste no es cosa mía.

     Lo que hay que comprobar es que esta regla no los MOVIO, y eso se mide
     contra los precios congelados de antes, no contra su propio viaje de dos
     días. */
  const ANTES2 = require('./datos/precios-antes-de-r18.json');
  const movidos = [];
  caros.forEach(function (d) {
    [2, 3, 4, 5, 7].forEach(function (dias) {
      const clave = d.nombre + '|' + dias + '|' + d.km;
      if (!(clave in ANTES2)) return;
      const ahora = q(d.nombre, d.km, dias, 0);
      if (ahora !== ANTES2[clave]) movidos.push(d.nombre + ' a ' + dias + 'd');
    });
  });
  igual('y a los ' + caros.length + ' caros la regla no los movió ni un peso', movidos, []);
}

/* ============ 5. LA CUARTA NOCHE VUELVE A LOS MIL ============
   Los $500 son solo para las noches que antes venían incluidas. */
{
  /* Se mide CONTRA LOS PRECIOS CONGELADOS, que es lo único que aísla esta
     regla del piso de $3,000 por día.

     La primera versión comparaba 4 días contra 3 y esperaba $3,500. Salió
     $2,500 y la roja tenía razón: entre esos dos días el piso salta de
     $10,000 a $12,000 —dos mil— y la noche pone quinientos. Mezclar las dos
     reglas en una resta no prueba ninguna de las dos. */
  const ANTES3 = require('./datos/precios-antes-de-r18.json');
  const km = FUERA['Ocotlán'].km;
  const subio = function (dias) {
    return q('Ocotlán', km, dias, 0) - ANTES3['Ocotlán|' + dias + '|' + km];
  };
  igual('Ocotlán a 3 días: una noche destapada, +500', subio(3), 500);
  igual('a 4 días: dos noches destapadas, +1000', subio(4), 1000);
  /* De la cuarta noche en adelante manda la de siempre, así que ya no sube
     más: esas noches se cobraban a mil antes y a mil ahora. */
  igual('a 7 días ya no sube más: esas noches ya se cobraban', subio(7), 1000);
  igual('ni a 20 días', subio(20), 1000);
}

/* ============ 6. NO SE COME LO QUE YA ESTABA ============ */
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
