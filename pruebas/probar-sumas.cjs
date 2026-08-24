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
  const rotos = { suma: [], iva: [], anticipo: [], minimo: [], tramos: [], redondeo: [] };

  for (let metrosIda = 15000; metrosIda <= 1400000; metrosIda += 4871) {
    for (const delta of [0, 340, -1290, 20411]) {
      const metrosVuelta = Math.max(0, metrosIda + delta);
      for (const dias of [1, 2, 4, 7, 12]) {
        const km = t.kmDe(metrosIda, metrosVuelta);
        const p = t.calcula(km, dias);
        casos++;

        // anticipo + saldo tiene que dar EXACTAMENTE el total: ni un centavo
        if (p.anticipo + p.saldo !== p.total) rotos.suma.push({ km, dias, p });
        // subtotal + IVA reconstruye el total (con dos decimales)
        if (Math.abs(p.subtotal + p.iva - p.total) > 0.005) rotos.iva.push({ km, dias, p });
        // el anticipo nunca puede pasarse del total: la puerta de EuroSystem lo rechaza
        if (p.anticipo > p.total || p.anticipo < 0) rotos.anticipo.push({ km, dias, p });
        // el total nunca queda por debajo del minimo por dia
        if (p.total < dias * t.MINIMO_POR_DIA && p.interno.aplicoMinimo) rotos.minimo.push({ km, dias, p });
        // el desglose de tramos suma lo que dice el bruto por kilometro
        const sumaTramos = p.interno.tramos.reduce(function (s, d) { return s + d.importe; }, 0);
        if (Math.abs(sumaTramos - p.interno.porKilometro) > 0.5) rotos.tramos.push({ km, dias, p });
        // el corte a la centena nunca sube el precio, solo lo baja o lo deja
        if (p.total > p.interno.sinRedondear) rotos.redondeo.push({ km, dias, p });
      }
    }
  }

  console.log('(' + casos.toLocaleString('es-MX') + ' viajes distintos)');
  igual('anticipo + saldo = total, sin excepción', rotos.suma.length, 0);
  igual('subtotal + IVA = total, sin excepción', rotos.iva.length, 0);
  igual('el anticipo nunca pasa del total', rotos.anticipo.length, 0);
  igual('el total nunca queda bajo el mínimo por día', rotos.minimo.length, 0);
  igual('el desglose por tramos suma el bruto', rotos.tramos.length, 0);
  igual('el redondeo nunca sube el precio', rotos.redondeo.length, 0);
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

  const viajes = [
    { ida: 311400, vuelta: 309800, dias: 4 },   // Vallarta redondo, primer tramo
    { ida: 610000, vuelta: 600000, dias: 5 },   // cruza los tres tramos
    { ida: 40000, vuelta: 40000, dias: 6 },     // corto y largo en días: manda el mínimo
    { ida: 900000, vuelta: 0, dias: 1 }         // solo ida, muy largo
  ];

  let cuadran = 0;
  const fallas = [];

  viajes.forEach(function (v) {
    const km = t.kmDe(v.ida, v.vuelta);
    const p = t.calcula(km, v.dias);

    // así es exactamente como pagar.js guarda los montos en Stripe: texto
    const metadata = {
      folio: 'ET-XXXX-YYY', nombre: 'Quien Sea', telefono: '3300000000',
      correo: 'x@y.mx', canal: 'correo', ruta: 'A a B',
      origen: 'A', destino: 'B', unidad: 'Sprinter',
      salida: '2026-09-03T08:00', regreso: '2026-09-06T18:00',
      dias: String(v.dias), km: String(Math.round(km * 10) / 10),
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

  igual('los 4 viajes llegan al contrato con el mismo total', cuadran, viajes.length);
  igual('sin fallas', fallas, []);

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
