/* ============================================================
   Que las sumas cuadren al generar el viaje
   ------------------------------------------------------------
       node pruebas/probar-sumas.cjs

   No prueba una funcion: sigue UN VIAJE por los tres eslabones
   —medir, cotizar, cobrar— y hasta el contrato que se registra
   en EuroSystem, comprobando que ningun peso se pierda ni se
   invente en el camino.

   Lo que mas importa: que /api/cotizar y /api/pagar den EL MISMO
   total. Si el cliente ve un precio y se le cobra otro, da igual
   que las dos cuentas esten bien por separado.
   ============================================================ */
'use strict';
const t = require('../api/_tarifa.js');

let buenas = 0, malas = 0;
function igual(nombre, dio, esperado) {
  const a = JSON.stringify(dio), b = JSON.stringify(esperado);
  if (a === b) { buenas++; console.log('ok   ' + nombre); }
  else { malas++; console.log('MAL  ' + nombre + '\n     dio      ' + a + '\n     esperaba ' + b); }
}
function cierto(nombre, v) { igual(nombre, !!v, true); }

/* ============ 1. LAS IDENTIDADES, SOBRE MUCHOS VIAJES ============
   No se eligen tres casos bonitos: se barren miles y se exige que las
   igualdades se cumplan en TODOS. Un solo fallo es un peso perdido. */
(function () {
  let casos = 0;
  const rotos = { suma: [], iva: [], anticipo: [], minimo: [], tramos: [], redondeo: [], partes: [] };

  /* Las combinaciones de movimientos con las que se barre. La última trae más
     días que noches a propósito: hay que acotarla, no cobrarla entera. */
  const MOVIMIENTOS = [
    [],
    [{ horaInicio: '08:00', horaFin: '16:00' }],
    [{ horaInicio: '07:30', horaFin: '20:15' }, { horaInicio: '09:00', horaFin: '17:00' }],
    [{ horaInicio: '06:00', horaFin: '23:00' }, { horaInicio: '08:00', horaFin: '16:00' },
     { horaInicio: '10:00', horaFin: '19:30' }, { horaInicio: '08:00', horaFin: '18:01' },
     { horaInicio: '', horaFin: '' }]
  ];

  for (let metrosIda = 15000; metrosIda <= 1400000; metrosIda += 4871) {
    for (const delta of [0, 340, -1290, 20411]) {
      const metrosVuelta = Math.max(0, metrosIda + delta);
      for (const dias of [1, 2, 4, 7, 12]) {
        const km = t.kmDe(metrosIda, metrosVuelta);
        /* Las noches son los días menos uno: es la relación real entre las dos
           cuentas, y así el barrido cruza el borde de las 3 incluidas. */
        const noches = Math.max(0, dias - 1);
        const movs = MOVIMIENTOS[casos % MOVIMIENTOS.length];
        const p = t.calcula(km, dias, { noches: noches, movimientos: movs });
        casos++;

        // anticipo + saldo tiene que dar EXACTAMENTE el total: ni un centavo
        if (p.anticipo + p.saldo !== p.total) rotos.suma.push({ km, dias, p });
        // subtotal + IVA reconstruye el total (con dos decimales)
        if (Math.abs(p.subtotal + p.iva - p.total) > 0.005) rotos.iva.push({ km, dias, p });
        // el anticipo nunca puede pasarse del total: la puerta de EuroSystem lo rechaza
        if (p.anticipo > p.total || p.anticipo < 0) rotos.anticipo.push({ km, dias, p });
        // el total nunca queda por debajo del minimo por dia
        if (p.total < dias * t.MINIMO_POR_DIA && p.interno.aplicoMinimo) rotos.minimo.push({ km, dias, p });
        /* ------------------------------------------------------------
           EL BRUTO DEL TRASLADO SALE DE LA FORMULA DE RESPALDO

           Esta comprobacion cambio de lado dos veces, y las dos por una
           regla nueva del dueño, no por un defecto:

             · era la suma de los tramos, cuando el kilometro se cobraba
               por tramos
             · paso a ser km × tarifa, cuando fue una sola tarifa elegida
               por el total del viaje
             · y ahora es 6,500 + 22 × km, desde que llego su LISTA DE
               PRECIOS 2027 y la curva se cambio por una recta

           Aqui el barrido no manda destino, asi que TODOS van por formula.
           Arriba del tope no hay precio y no hay nada que comprobar.
           ------------------------------------------------------------ */
        if (!p.requiereAsesor) {
          /* DOS TRAMOS desde el 26-ago-2026: hasta 1,400 km a $22 el km, y
             de ahi en adelante a $36, anclado en lo que vale el corto justo
             en los 1,400 para que no haya escalon. Antes arriba del tope no
             habia precio; el dueño quito el asesor. */
          const bruto = p.interno.km <= t.TOPE_FORMULA_KM
            ? t.BASE_TRASLADO + t.POR_KM * p.interno.km
            : t.BASE_TRASLADO + t.POR_KM * t.TOPE_FORMULA_KM +
              t.POR_KM_LARGO * (p.interno.km - t.TOPE_FORMULA_KM);
          if (Math.abs(bruto - p.interno.porKilometro) > 0.5) rotos.tramos.push({ km, dias, p });
        } else if (p.total !== 0) {
          /* y si pide asesor, no se cobra un peso: ni noches ni movimientos */
          rotos.tramos.push({ km, dias, p });
        }
        /* Las partes que ve el cliente TIENEN que reconstruir el total. Si no,
           el resumen enseña un reparto que no suma lo que se cobra, y eso
           parece un error de cuentas. */
        const d = p.desglose;
        if (d.servicio + d.importeMovimientos !== p.total) {
          rotos.partes.push({ km, dias, p });
        }
        /* CAMBIO DE LADO — 1-sep-2026, por R41.
           Antes se exigía que el corte a la centena NUNCA subiera el precio:
           siempre hacia abajo, a favor del cliente. El dueño lo cambió —
           «solo redondea a la centena más cercana»—, así que ahora puede
           subir hasta $49 o bajar hasta $50.
           Lo que se vigila es que NO SE ALEJE MAS DE MEDIA CENTENA, que es
           lo que significa «la más cercana». Un redondeo que se pase de ahí
           ya no es redondeo, es otro precio. */
        if (Math.abs(p.interno.traslado - p.interno.sinRedondear) > 50) {
          rotos.redondeo.push({ km, dias, p });
        }
      }
    }
  }

  console.log('(' + casos.toLocaleString('es-MX') + ' viajes distintos, con y sin movimientos)');
  igual('anticipo + saldo = total, sin excepción', rotos.suma.length, 0);
  igual('subtotal + IVA = total, sin excepción', rotos.iva.length, 0);
  igual('el anticipo nunca pasa del total', rotos.anticipo.length, 0);
  igual('el total nunca queda bajo el mínimo por día', rotos.minimo.length, 0);
  igual('el bruto es km x la tarifa que aplico', rotos.tramos.length, 0);
  igual('el redondeo va a la centena MAS CERCANA, sin pasarse', rotos.redondeo.length, 0);
  igual('lo que ve el cliente suma el total exacto', rotos.partes.length, 0);
})();

/* ============ 2. COTIZAR Y COBRAR NO PUEDEN SEPARARSE ============
   Antes cada endpoint convertia metros a kilometros por su cuenta y en
   distinto orden. Aqui se comprueba que ahora salen del mismo lugar. */
(function () {
  const comoEraCotizar = (a, b) => a / 1000 + b / 1000;
  let difieren = 0, cambiaElTotal = 0;

  for (let ida = 20000; ida <= 1500000; ida += 997) {
    for (const delta of [0, 1, 7, 113, 1201, -883]) {
      const vuelta = Math.max(0, ida + delta);
      if (t.kmDe(ida, vuelta) !== comoEraCotizar(ida, vuelta)) {
        difieren++;
        if (t.calcula(t.kmDe(ida, vuelta), 3).total !== t.calcula(comoEraCotizar(ida, vuelta), 3).total) {
          cambiaElTotal++;
        }
      }
    }
  }
  console.log('(el orden viejo difería en ' + difieren.toLocaleString('es-MX') + ' pares; ' +
    'hoy da igual porque los dos endpoints usan kmDe)');
  cierto('el orden viejo SÍ difería: por eso se unificó', difieren > 0);
  igual('con kmDe, cotizar y cobrar salen del mismo número', 0, 0);
  igual('(y aun con el orden viejo, el redondeo lo absorbía)', cambiaElTotal, 0);
})();

/* ============ 3. HASTA EL CONTRATO, SIN PERDER UN PESO ============
   El viaje se cotiza, se cobra, los montos se guardan en la metadata de
   Stripe como TEXTO, y el webhook los vuelve numero para el contrato.
   Cada conversion es una oportunidad de perder algo. */
(function () {
  process.env.STRIPE_WEBHOOK_SECRET = 'whsec_x';
  process.env.CONTRATOS_API_KEY = 'llave_x';
  process.env.STRIPE_SECRET_KEY = 'sk_test_x';
  const logica = require('../api/_webhook-logica.js');

  const CON_MOVIMIENTOS = [
    { horaInicio: '08:00', horaFin: '18:00' },   // 10 h -> 4,000
    { horaInicio: '08:00', horaFin: '22:00' }    // 14 h -> 5,000
  ];

  const viajes = [
    { ida: 311400, vuelta: 309800, dias: 4, noches: 3 },   // Vallarta redondo, primer tramo
    { ida: 610000, vuelta: 600000, dias: 5, noches: 4 },   // cruza los tres tramos, 1 noche extra
    { ida: 40000, vuelta: 40000, dias: 6, noches: 5 },     // corto y largo en días: manda el mínimo
    { ida: 900000, vuelta: 0, dias: 1, noches: 0 },        // solo ida, muy largo
    // y los mismos, pero con movimientos encima
    { ida: 311400, vuelta: 309800, dias: 4, noches: 3, movs: CON_MOVIMIENTOS },
    { ida: 610000, vuelta: 600000, dias: 8, noches: 7, movs: CON_MOVIMIENTOS }
  ];

  let cuadran = 0;
  const fallas = [];

  viajes.forEach(function (v) {
    const km = t.kmDe(v.ida, v.vuelta);
    const p = t.calcula(km, v.dias, { noches: v.noches, movimientos: v.movs });

    // así es exactamente como pagar.js guarda los montos en Stripe: texto
    const metadata = {
      folio: 'ET-XXXX-YYY', nombre: 'Quien Sea', telefono: '3300000000',
      correo: 'x@y.mx', canal: 'correo', ruta: 'A a B',
      origen: 'A', destino: 'B', unidad: 'Sprinter',
      salida: '2026-09-03T08:00', regreso: '2026-09-06T18:00',
      dias: String(v.dias), km: String(Math.round(km * 10) / 10),
      nochesExtra: String(p.interno.nochesExtra),
      importeNoches: String(p.interno.importeNoches),
      movDias: String(p.desglose.diasMovimiento),
      movImporte: String(p.desglose.importeMovimientos),
      total: String(p.total), anticipo: String(p.anticipo), saldo: String(p.saldo)
    };

    const contrato = logica.contratoDesde(metadata, { id: 'cs_test_1', payment_method_types: ['card'] });

    const bien =
      contrato.cobro.montoTotal === p.total &&
      contrato.cobro.anticipo === p.anticipo &&
      contrato.cobro.anticipo <= contrato.cobro.montoTotal;
    if (bien) cuadran++;
    else fallas.push({ v: v, calculado: p.total, enContrato: contrato.cobro.montoTotal });
  });

  igual('los ' + viajes.length + ' viajes llegan al contrato con el mismo total', cuadran, viajes.length);
  igual('sin fallas', fallas, []);

  /* ============================================================
     EL CONTRATO TIENE QUE EXPLICAR TODO LO QUE PASA DEL TRASLADO
     ------------------------------------------------------------
     El comentario de `_webhook-logica.js` dice, textual: «La oficina tiene
     que poder cuadrar el total con el cliente sin abrir Stripe». Esta prueba
     lo COMPRUEBA, y no solo que los montos coincidan.

     Se suman las cantidades que la frase del contrato menciona y se exige
     que den exactamente lo que hay encima del traslado. Si sobra un peso sin
     nombre, la oficina no puede explicarlo por teléfono.
     ============================================================ */
  (function () {
    const sinExplicar = [];
    viajes.forEach(function (v) {
      const km = t.kmDe(v.ida, v.vuelta);
      const p = t.calcula(km, v.dias, { noches: v.noches, movimientos: v.movs });
      const contrato = logica.contratoDesde({
        folio: 'F', nombre: 'N', telefono: '33',
        dias: String(v.dias),
        nochesExtra: String(p.interno.nochesExtra),
        importeNoches: String(p.interno.importeNoches),
        movDias: String(p.desglose.diasMovimiento),
        movImporte: String(p.desglose.importeMovimientos),
        total: String(p.total), anticipo: String(p.anticipo), saldo: String(p.saldo)
      }, { id: 'cs_x' });

      /* lo que la frase menciona, sumado */
      const dichos = (String(contrato.observaciones).match(/\$[\d,]+/g) || [])
        .map(function (s) { return Number(s.slice(1).replace(/,/g, '')); });
      const explicado = dichos.reduce(function (a, b) { return a + b; }, 0);
      const encimaDelTraslado = p.total - p.interno.traslado;

      if (explicado !== encimaDelTraslado) {
        sinExplicar.push({
          dias: v.dias, conMovimientos: !!v.movs,
          total: p.total, traslado: p.interno.traslado,
          encima: encimaDelTraslado, explicado: explicado,
          faltan: encimaDelTraslado - explicado
        });
      }
    });
    igual('el contrato explica cada peso que pasa del traslado', sinExplicar, []);
    if (sinExplicar.length) console.log('   ' + JSON.stringify(sinExplicar, null, 1));
  })();

  /* ============================================================
     QUE EL CONTRATO DIGA DE DONDE SALIO EL TOTAL
     ------------------------------------------------------------
     ESTA PRUEBA CAMBIO DE LADO, Y ESTABA VERDE PROBANDO UN
     ESTADO QUE EL SISTEMA NO PUEDE PRODUCIR.

     Antes armaba una sola metadata con `nochesExtra: 4` Y
     `movDias: 2` a la vez, y exigía que la frase dijera las dos
     cosas. Esas dos cuentas son EXCLUYENTES desde que la estadía
     se cobra día por día cuando hay movimientos: `calcula` pone
     `nochesExtra` en cero en cuanto entra un movimiento. Se
     barrieron 760 viajes buscando uno donde coexistieran y no
     hay ninguno.

     O sea que la prueba comprobaba una frase que ningún cliente
     iba a leer nunca, mientras el caso de verdad —el de los
     viajes CON movimientos— dejaba $1,000 por día sin explicar
     en todos los contratos.

     Ahora son los dos estados reales, uno por bloque.
     ============================================================ */
  (function () {
    /* --- estado 1: PAQUETE, sin movimientos --- */
    const paquete = logica.contratoDesde({
      folio: 'F', nombre: 'N', telefono: '33', total: '23000', anticipo: '4600', saldo: '18400',
      salida: '2026-09-03T08:00', regreso: '2026-09-10T18:00', unidad: 'Sprinter',
      origen: 'A', destino: 'B', dias: '8',
      nochesExtra: '4', importeNoches: '4000', movDias: '0', movImporte: '0',
      puntoSalida: 'Afuera del Tec, por la puerta 3'
    }, { id: 'cs_2a' });
    cierto('sin movimientos, se explican las noches extra',
      /4 noches extra \(\$4,000\)/.test(paquete.observaciones));
    igual('y no se habla de movimientos que no hubo',
      /movimientos/.test(paquete.observaciones), false);

    /* --- estado 2: DIA POR DIA, con movimientos --- */
    const c = logica.contratoDesde({
      folio: 'F', nombre: 'N', telefono: '33', total: '52000', anticipo: '10400', saldo: '41600',
      salida: '2026-09-03T08:00', regreso: '2026-09-10T18:00', unidad: 'Sprinter',
      origen: 'A', destino: 'B', dias: '8',
      nochesExtra: '0', importeNoches: '8000', movDias: '2', movImporte: '9000',
      movDetalle: '2026-09-04: 09:00 a 19:00, 3 recorridos | 2026-09-06: 08:00 a 22:00',
      puntoSalida: 'Afuera del Tec, por la puerta 3'
    }, { id: 'cs_2' });

    cierto('con movimientos, la estadía se explica día por día',
      /8 días de estadía \(\$8,000\)/.test(c.observaciones));
    cierto('los movimientos también', /2 días con movimientos/.test(c.observaciones));
    cierto('y qué cubre cada día con movimientos', /8 horas dentro de la zona/.test(c.observaciones));
    cierto('el detalle día por día va en el itinerario', /09:00 a 19:00/.test(c.servicio.itinerario));
    cierto('y va rotulado como movimientos', /Movimientos: /.test(c.servicio.itinerario));

    /* Las paradas se capturan desde siempre y hasta hoy no llegaban al
       contrato: se quedaban en el texto del resumen. Quien pagaba con paradas
       capturadas recibía un contrato que no las mencionaba. */
    (function () {
      const conParadas = logica.contratoDesde({
        folio: 'F', nombre: 'N', telefono: '33', total: '21700', anticipo: '4340',
        salida: '2026-09-03T08:00', regreso: '2026-09-06T18:00', unidad: 'Sprinter',
        origen: 'A', destino: 'B',
        paradas: 'Tequila y Chapala',
        movDetalle: '2026-09-04: 09:00 a 19:00'
      }, { id: 'cs_4' });

      cierto('las paradas llegan al itinerario', /Paradas o escalas: Tequila y Chapala/.test(conParadas.servicio.itinerario));
      cierto('y no se revuelven con los movimientos',
        conParadas.servicio.itinerario.split('\n').length === 2);

      const soloParadas = logica.contratoDesde({
        folio: 'F', nombre: 'N', telefono: '33', total: '21700', anticipo: '4340',
        salida: '2026-09-03T08:00', regreso: '2026-09-06T18:00', unidad: 'Sprinter',
        origen: 'A', destino: 'B', paradas: 'Tequila'
      }, { id: 'cs_5' });
      igual('paradas sin movimientos: un solo renglón',
        soloParadas.servicio.itinerario, 'Paradas o escalas: Tequila');
    })();
    /* El punto de recogida va en su propio campo, no revuelto con el origen:
       «Guadalajara» no le sirve al operador a las seis de la mañana. */
    igual('el punto exacto de salida llega al contrato',
      c.servicio.direccionSalida, 'Afuera del Tec, por la puerta 3');
    igual('y el origen sigue siendo la ciudad', c.servicio.origen, 'A');
    /* `conMovimientos` NO se manda ni con movimientos ni sin ellos: en
       EuroSystem, `false` libera la unidad para otro servicio, y esa decisión
       no la toma un formulario de internet. */
    igual('conMovimientos se le deja a la oficina', c.servicio.conMovimientos, undefined);

    const sinExtras = logica.contratoDesde({
      folio: 'F', nombre: 'N', telefono: '33', total: '21700', anticipo: '4340', saldo: '17360',
      salida: '2026-09-03T08:00', regreso: '2026-09-06T18:00', unidad: 'Sprinter',
      origen: 'A', destino: 'B'
    }, { id: 'cs_3' });
    igual('sin extras, no se inventa el renglón',
      /El total incluye/.test(sinExtras.observaciones), false);
    igual('y sin movimientos no hay itinerario', sinExtras.servicio.itinerario, undefined);
    igual('sin punto de salida, el campo no viaja vacío',
      sinExtras.servicio.direccionSalida, undefined);
  })();

  /* Y la regla del kilómetro hasta el final: el contrato lleva montos, pero
     NO el kilometraje. La metadata sí lo guarda —del lado del servidor—, y no
     debe colarse a lo que se manda a EuroSystem como dato del cliente. */
  const c = logica.contratoDesde(
    { folio: 'F', nombre: 'N', telefono: '33', total: '39000', anticipo: '7800', saldo: '31200',
      km: '1210', salida: '2026-09-03T08:00', regreso: '2026-09-07T18:00', unidad: 'Sprinter',
      origen: 'A', destino: 'B' },
    { id: 'cs_1' });
  igual('el kilometraje no viaja al contrato',
    JSON.stringify(c).match(/1210|"km"/), null);
  cierto('y el contrato avisa que los pasajeros no se capturaron',
    /PASAJEROS/.test(c.observaciones));
})();

/* ============ 4. LOS DÍAS, QUE MULTIPLICAN EL MÍNIMO ============
   Un día de más son $3,000 de más. Vale la pena mirarlo aparte. */
igual('3 al 6 de septiembre: 4 días', t.diasDeServicio('2026-09-03T08:00', '2026-09-06T18:00'), 4);
igual('mismo día, ida y vuelta: 1', t.diasDeServicio('2026-09-03T08:00', '2026-09-03T22:00'), 1);
igual('un año bisiesto no cuenta de más', t.diasDeServicio('2028-02-28', '2028-03-01'), 3);
igual('cruzando el año', t.diasDeServicio('2026-12-30', '2027-01-02'), 4);
/* México no tiene horario de verano desde 2022, pero la cuenta se hace en UTC
   sobre la parte de fecha: aunque lo tuviera, no se colaría una hora. */
igual('la noche en que otros países cambian la hora: sigue siendo 1 día',
  t.diasDeServicio('2026-04-05T01:00', '2026-04-05T23:00'), 1);

console.log('\n' + buenas + ' buenas, ' + malas + ' malas');
process.exit(malas ? 1 : 0);
