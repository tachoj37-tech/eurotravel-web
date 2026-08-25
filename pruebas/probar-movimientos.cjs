/* ============================================================
   Las reglas de los movimientos — sin navegador
   ------------------------------------------------------------
       node pruebas/probar-movimientos.cjs

   Esto es lo que antes NO se podia hacer. Las reglas vivian
   dentro de index.html, revueltas con el pintado, y la unica
   forma de probarlas era apretando botones en un navegador: asi
   se comprobaron a mano las de esta semana.

   Lo que mas vale de este archivo es la ultima seccion: que el
   tope de dias con movimiento sea EL MISMO NUMERO que aplica el
   servidor. Hasta hoy, que coincidieran era una promesa.
   ============================================================ */
'use strict';
const M = require('../movimientos.js');
const tarifa = require('../api/_tarifa.js');

let buenas = 0, malas = 0;
function igual(nombre, dio, esperado) {
  const a = JSON.stringify(dio), b = JSON.stringify(esperado);
  if (a === b) { buenas++; console.log('ok   ' + nombre); }
  else { malas++; console.log('MAL  ' + nombre + '\n     dio      ' + a + '\n     esperaba ' + b); }
}
function cierto(nombre, v) { igual(nombre, !!v, true); }

/* ============ LAS NOCHES ============
   NOCHES no es lo mismo que DIAS DE SERVICIO: del 3 al 6 son cuatro dias
   y TRES noches. De las noches sale el tope. */
igual('del 3 al 6: 3 noches', M.noches('2026-09-03T08:00', '2026-09-06T18:00'), 3);
igual('ida y vuelta el mismo dia: 0', M.noches('2026-09-03T08:00', '2026-09-03T22:00'), 0);
igual('sin regreso: 0', M.noches('2026-09-03T08:00', ''), 0);
igual('sin nada: 0', M.noches('', ''), 0);
igual('fechas ilegibles: 0', M.noches('cuando sea', 'luego'), 0);
igual('cruzando el año: 3', M.noches('2026-12-30T08:00', '2027-01-02T18:00'), 3);
igual('febrero bisiesto: 2', M.noches('2028-02-28T08:00', '2028-03-01T18:00'), 2);

/* ============ ENCENDER, AGREGAR, QUITAR ============ */
(function () {
  const m = M.crea();
  igual('empieza apagado', m.estadoVivo().incluye, false);

  /* SIN NOCHES NO ENCIENDE. Lo encontro esta misma prueba: sin la guarda, un
     viaje de ida y vuelta el mismo dia quedaba con un dia capturado que el
     servidor jamas iba a contar -su tope seria cero-, y la pantalla enseñaria
     un dia que no se cobra. */
  igual('mismo dia, sin noches: no enciende',
    m.enciende('2026-09-03T08:00', '2026-09-03T22:00'), false);
  igual('y no deja dias sueltos', m.estadoVivo().dias.length, 0);
  igual('ni queda encendido', m.estadoVivo().incluye, false);

  m.enciende('2026-09-03T08:00', '2026-09-08T18:00');
  igual('al encender pone el primer dia solo', m.estadoVivo().dias.length, 1);
  igual('y queda encendido', m.estadoVivo().incluye, true);

  /* 3 noches -> caben 3 dias */
  cierto('cabe un segundo dia', m.agregaDia('2026-09-03', '2026-09-06'));
  cierto('y un tercero', m.agregaDia('2026-09-03', '2026-09-06'));
  igual('van tres', m.estadoVivo().dias.length, 3);
  igual('el cuarto NO cabe', m.agregaDia('2026-09-03', '2026-09-06'), false);
  igual('y no se agrego', m.estadoVivo().dias.length, 3);

  m.quitaDia(1);
  igual('quitar deja dos', m.estadoVivo().dias.length, 2);
  m.quitaDia(0); m.quitaDia(0);
  igual('nunca se queda en cero: un bloque encendido sin dias no sirve',
    m.estadoVivo().dias.length, 1);

  /* Si el viaje cambia y ya no hay noches, no hay movimientos */
  m.alCambiarElViaje('2026-09-03T08:00', '2026-09-03T22:00');
  igual('sin noches, se apaga', m.estadoVivo().incluye, false);
  igual('y no quedan dias', m.estadoVivo().dias.length, 0);
})();

/* ============ QUE ESTA MAL, Y DONDE ============
   Devuelve QUE dia y QUE campo, para que la pantalla marque el correcto. */
(function () {
  const m = M.crea();
  m.enciende('2026-09-03T08:00', '2026-09-08T18:00');
  const d = m.estadoVivo().dias;

  igual('un dia vacio: faltan los tres campos',
    m.revisa('2026-09-03', '2026-09-08').problemas.map(function (p) { return p.campo; }),
    [0, 1, 2]);

  d[0] = { fecha: '2026-09-04', horaInicio: '08:00', horaFin: '16:00' };
  igual('completo: sin problemas', m.revisa('2026-09-03', '2026-09-08').ok, true);

  /* fuera del rango del viaje */
  d[0].fecha = '2026-10-01';
  const fuera = m.revisa('2026-09-03', '2026-09-08');
  igual('fecha fuera del viaje: se acusa en el campo 0',
    [fuera.ok, fuera.problemas[0].campo, fuera.problemas[0].tipo], [false, 0, 'fueraDeRango']);

  /* horas al reves */
  d[0].fecha = '2026-09-04';
  d[0].horaFin = '07:00';
  const alReves = m.revisa('2026-09-03', '2026-09-08');
  igual('hora de fin antes que la de inicio: se acusa en el campo 2',
    [alReves.ok, alReves.problemas[0].campo, alReves.problemas[0].tipo], [false, 2, 'horasAlReves']);

  /* fecha repetida */
  d[0].horaFin = '16:00';
  m.agregaDia('2026-09-03', '2026-09-08');
  m.estadoVivo().dias[1] = { fecha: '2026-09-04', horaInicio: '09:00', horaFin: '17:00' };
  const repe = m.revisa('2026-09-03', '2026-09-08');
  igual('la misma fecha dos veces: se acusa la segunda',
    [repe.ok, repe.problemas[0].dia, repe.problemas[0].tipo], [false, 1, 'repetida']);

  /* apagado no se revisa nada */
  m.apaga();
  igual('apagado, siempre pasa', m.revisa('2026-09-03', '2026-09-08').ok, true);
})();

/* ============ LO QUE SE LE MANDA AL SERVIDOR ============
   Las dos formas tienen que tener EL MISMO LARGO siempre: el precio se cobra
   por dia, asi que si una filtrara un renglon y la otra no, se cotizaria un
   dia menos del que se cobra. */
(function () {
  const m = M.crea();
  m.enciende('2026-09-03T08:00', '2026-09-08T18:00');
  m.agregaDia('2026-09-03', '2026-09-08');
  m.agregaDia('2026-09-03', '2026-09-08');
  const d = m.estadoVivo().dias;
  d[0] = { fecha: '2026-09-04', horaInicio: '08:00', horaFin: '16:00' };
  d[1] = { fecha: '2026-09-05', horaInicio: '', horaFin: '' };      // incompleto
  d[2] = { fecha: '2026-09-06', horaInicio: '09:00', horaFin: '21:00' };

  igual('a cotizar van solo las horas',
    m.paraCotizar(),
    [{ horaInicio: '08:00', horaFin: '16:00' },
     { horaInicio: '', horaFin: '' },
     { horaInicio: '09:00', horaFin: '21:00' }]);

  igual('los incompletos NO se caen de la lista', m.paraCotizar().length, 3);
  igual('y las dos formas miden lo mismo', m.paraCotizar().length, m.paraCobrar().length);
  igual('a cobrar va el dia completo', m.paraCobrar()[0].fecha, '2026-09-04');

  m.apaga();
  igual('apagado, no se manda nada a cotizar', m.paraCotizar(), []);
  igual('ni a cobrar', m.paraCobrar(), []);
})();

/* ============ EL TOPE, CONTRA EL SERVIDOR DE VERDAD ============
   ESTA es la que no se podia escribir antes.

   La pantalla no deja capturar mas dias con movimiento que noches en
   destino. El servidor aplica el MISMO tope en `movimientosDe` de _tarifa.js.
   Si contaran distinto, el cliente veria un precio y se le cobraria otro.

   Aqui se comparan los dos numeros, uno contra el otro, sobre muchos viajes.
   Hasta hoy, que coincidieran era una promesa. */
(function () {
  const VIAJES = [
    ['2026-09-03T08:00', '2026-09-03T22:00'],   // 0 noches
    ['2026-09-03T08:00', '2026-09-04T18:00'],   // 1
    ['2026-09-03T08:00', '2026-09-06T18:00'],   // 3
    ['2026-09-03T08:00', '2026-09-08T18:00'],   // 5
    ['2026-12-30T08:00', '2027-01-02T18:00'],   // 3, cruzando el año
    ['2028-02-28T08:00', '2028-03-01T18:00']    // 2, bisiesto
  ];

  let difieren = [];
  let topesDistintos = [];

  VIAJES.forEach(function (v) {
    const nochesPantalla = M.noches(v[0], v[1]);
    const nochesServidor = tarifa.nochesDe(v[0], v[1]);
    if (nochesPantalla !== nochesServidor) {
      difieren.push({ viaje: v, pantalla: nochesPantalla, servidor: nochesServidor });
    }

    /* Y el tope de verdad: se llena la pantalla hasta donde deje, y se
       comprueba que el servidor cuente TODOS esos dias -ni uno de menos-. */
    const m = M.crea();
    m.enciende(v[0], v[1]);          // el viaje de esta vuelta, no otro
    while (m.agregaDia(v[0], v[1])) { /* hasta que no quepa otro */ }
    const capturados = m.estadoVivo().incluye ? m.estadoVivo().dias.length : 0;

    const cuentaElServidor = tarifa.movimientosDe(m.paraCotizar(), nochesServidor).length;
    if (capturados !== cuentaElServidor) {
      topesDistintos.push({ viaje: v, capturados: capturados, cuenta: cuentaElServidor });
    }
  });

  igual('la pantalla y el servidor cuentan las mismas noches', difieren, []);
  igual('y el servidor cobra TODOS los dias que la pantalla dejo capturar',
    topesDistintos, []);

  /* Y al reves: si alguien forzara mas dias de los que caben, el servidor
     los acota. La pantalla no deberia dejar llegar ahi, pero el servidor no
     confia en la pantalla. */
  const m = M.crea();
  m.enciende('2026-09-03T08:00', '2026-09-08T18:00');
  const d = m.estadoVivo().dias;
  for (let i = 0; i < 9; i++) d.push({ fecha: '', horaInicio: '08:00', horaFin: '16:00' });
  igual('con 3 noches, el servidor cuenta 3 aunque lleguen 10',
    tarifa.movimientosDe(m.paraCotizar(), 3).length, 3);
})();

console.log('\n' + buenas + ' buenas, ' + malas + ' malas');
process.exit(malas ? 1 : 0);
