/* ============================================================
   R18 — los cuatro donde el día no es gratis
   ------------------------------------------------------------
       node pruebas/probar-dia-no-gratis.cjs

   DE DONDE SALIO

   El 28-ago-2026 el dueño revisó la lista de los 50 casos que la
   página cotiza sola y vio que tres y cuatro días costaban
   EXACTAMENTE lo mismo que dos: las tres noches incluidas se los
   comían. Dictó, con esas palabras:

       «súbeles 500, el día, a los 4 de abajo»
       «a Bernal 1000 el día»

   LO QUE ESTA PRUEBA VIGILA, en orden de gravedad

   1. Que el viaje de DOS DIAS no se haya movido. Él no pidió
      subirlo, y cobrar «el día» desde el primero lo habría subido
      también. Un cambio que sube un precio que nadie mandó subir
      es dinero cobrado de más a un cliente.
   2. Que el día de más sí se cobre, que es lo que pidió.
   3. Que NINGUN otro destino cambie: la regla es de cuatro.
   4. Que no se coma lo que ya estaba: los movimientos siguen
      sumándose aparte y solo ida sigue sin pagar noches.
   ============================================================ */
'use strict';

const t = require('../api/_tarifa.js');

let buenas = 0, malas = 0;
function igual(nombre, dio, esperado) {
  const a = JSON.stringify(dio), b = JSON.stringify(esperado);
  if (a === b) { buenas++; console.log('ok   ' + nombre); }
  else { malas++; console.log('MAL  ' + nombre + '\n     dio      ' + a + '\n     esperaba ' + b); }
}

/* Los kilómetros NO se inventan ni se piden a Google en una prueba: se
   escogieron los que reproducen el precio que el sitio publicado dio el
   27-ago-2026 para el viaje de dos días. Abajo se comprueba que en efecto lo
   reproducen — si algún día la tarifa por kilómetro cambia, esa aserción
   avisa antes de que el resto empiece a medir otra cosa. */
const DESTINOS = {
  'Ocotlán': { km: 160, dosDias: 10000 },
  'Comala': { km: 442, dosDias: 16200 },
  'Autlán de Navarro': { km: 424, dosDias: 15800 },
  'Bernal': { km: 815, dosDias: 24400 },
  /* Éste NO lleva regla: está para comprobar que la regla no se derrama. */
  'Tequisquiapan': { km: 820, dosDias: 24500 }
};

function cotiza(nombre, dias, movs) {
  const movimientos = [];
  for (let i = 0; i < (movs || 0); i++) movimientos.push({ horaInicio: '09:00', horaFin: '15:00' });
  return t.calcula(DESTINOS[nombre].km, dias, {
    destino: { texto: nombre },
    noches: dias - 1,
    movimientos: movimientos,
    unidad: 'sprinter'
  });
}

/* ============ 0. LA BASE ES LA QUE SE MIDIO ============ */
{
  const fuera = Object.keys(DESTINOS).filter(function (d) {
    return cotiza(d, 2, 0).total !== DESTINOS[d].dosDias;
  });
  igual('los kilómetros reproducen el precio medido de 2 días', fuera, []);
}

/* ============ 1. EL VIAJE DE DOS DIAS NO SE MOVIO ============
   La aserción que más vale de este archivo. */
{
  const movidos = Object.keys(DESTINOS).filter(function (d) {
    return cotiza(d, 2, 0).total !== DESTINOS[d].dosDias;
  });
  igual('DOS DIAS sigue costando lo mismo en los cinco', movidos, []);

  const alReves = Object.keys(DESTINOS).filter(function (d) {
    return cotiza(d, 1, 0).total > cotiza(d, 2, 0).total;
  });
  igual('y un día nunca sale más caro que dos', alReves, []);
}

/* ============ 2. EL DIA DE MAS SI SE COBRA ============ */
{
  [['Ocotlán', 500], ['Comala', 500], ['Autlán de Navarro', 500], ['Bernal', 1000]]
    .forEach(function (c) {
      const dos = cotiza(c[0], 2, 0).total;
      const tres = cotiza(c[0], 3, 0).total;
      igual(c[0] + ': el tercer día cuesta ' + c[1] +
        '   ($' + dos.toLocaleString('es-MX') + ' → $' + tres.toLocaleString('es-MX') + ')',
        tres - dos, c[1]);
    });

  /* Y el cuarto cuesta otro tanto. Ocotlán no entra aquí: a cuatro días le
     gana el piso de $3,000 por día, que es una regla anterior y manda. */
  [['Comala', 1000], ['Autlán de Navarro', 1000], ['Bernal', 2000]].forEach(function (c) {
    igual(c[0] + ': el cuarto día suma otro tanto (' + c[1] + ' sobre dos días)',
      cotiza(c[0], 4, 0).total - cotiza(c[0], 2, 0).total, c[1]);
  });

  /* Ocotlán a cuatro días es el único donde entra el piso de $3,000 por día,
     que es una regla anterior y más fuerte.

     ESTA ASERCION NACIO MAL: esperaba que el total fuera el piso pelón
     ($12,000). No lo es, y la roja tenía razón — el piso defiende al
     TRASLADO, no al total, y las noches se suman encima. Que un destino
     cercano apartado muchos días no salga en $9,900 no quiere decir que las
     noches dejen de cobrarse. */
  const oco = cotiza('Ocotlán', 4, 0);
  igual('en Ocotlán a 4 días manda el piso, y las noches se suman encima',
    oco.total, 4 * t.MINIMO_POR_DIA + 2 * 500);
}

/* ============ 3. LA REGLA NO SE DERRAMA ============ */
{
  igual('Tequisquiapan, sin regla, sigue sin cobrar el tercer día',
    cotiza('Tequisquiapan', 3, 0).total - cotiza('Tequisquiapan', 2, 0).total, 0);
  igual('ni el cuarto',
    cotiza('Tequisquiapan', 4, 0).total - cotiza('Tequisquiapan', 2, 0).total, 0);
}

/* ============ 4. NO SE COME LO QUE YA ESTABA ============ */
{
  /* Estadía y movimiento se SUMAN, no se excluyen: eso ya se pagó una vez
     (Vallarta salía en 29,000 en vez de 25,000) y no se puede reabrir. */
  const sin = cotiza('Comala', 3, 0);
  const con = cotiza('Comala', 3, 2);
  igual('con movimientos se cobran los dos conceptos',
    con.total > sin.total && con.desglose.importeMovimientos > 0, true);
  igual('y la noche de la regla sigue adentro',
    con.total - con.desglose.importeMovimientos, sin.total);

  /* Solo ida no paga noches: es 65% de un día, y va al final para que ni la
     estadía ni las bandas se le cuelen. */
  const ida = t.calcula(DESTINOS['Bernal'].km, 1, {
    destino: { texto: 'Bernal' }, noches: 0, movimientos: [], unidad: 'sprinter', redondo: false
  });
  igual('solo ida sigue sin pagar noches',
    ida.total < cotiza('Bernal', 2, 0).total, true);
}

console.log('\n' + buenas + ' buenas, ' + malas + ' malas');
process.exit(malas ? 1 : 0);
