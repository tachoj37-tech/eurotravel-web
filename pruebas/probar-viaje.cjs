/* ============================================================
   La pantalla propia del cliente
   ------------------------------------------------------------
       node pruebas/probar-viaje.cjs

   Lo que se juega: que el cliente A no vea NADA del cliente B.
   Y algo que se ve menos y pesa igual: que una liga inventada no
   nos haga preguntarle a Stripe por sesiones ajenas. Aunque
   nunca contestemos con los datos, quien prueba identificadores
   se entera de cuales existen.

   Por eso la firma se verifica ANTES de tocar Stripe, y aqui se
   cuenta cuantas veces se le pregunto.
   ============================================================ */
'use strict';

let buenas = 0, malas = 0;
function igual(nombre, dio, esperado) {
  const a = JSON.stringify(dio), b = JSON.stringify(esperado);
  if (a === b) { buenas++; console.log('ok   ' + nombre); }
  else { malas++; console.log('MAL  ' + nombre + '\n     dio      ' + a + '\n     esperaba ' + b); }
}
function cierto(nombre, v) { igual(nombre, !!v, true); }

process.env.LIGAS_SECRETO = 'secreto-de-mentiras-para-las-pruebas';
process.env.STRIPE_SECRET_KEY = 'sk_test_de_mentiras';

/* Stripe, fingido, contando cuantas veces se le pregunta. */
let PREGUNTAS_A_STRIPE = 0;
let SESIONES = {};
global.fetch = function (url) {
  const u = String(url);
  if (u.indexOf('api.stripe.com') < 0) return Promise.reject(new Error('inesperado: ' + u));
  PREGUNTAS_A_STRIPE++;
  const id = (u.match(/sessions\/([^/?]+)/) || [])[1];
  const s = SESIONES[id];
  return Promise.resolve({ ok: !!s, status: s ? 200 : 404,
    json: () => Promise.resolve(s || { error: { message: 'no such checkout session' } }) });
};

const ligas = require('../api/_ligas.js');
const viaje = require('../api/viaje.js');

function res() {
  const r = { _status: null, _json: null };
  r.status = s => { r._status = s; return r; };
  r.json = j => { r._json = j; return r; };
  r.end = () => r;
  return r;
}
let n = 0;
function cab() {
  n++;
  return { origin: 'https://eurotravel-web.vercel.app',
           'x-vercel-forwarded-for': '10.6.' + Math.floor(n / 250) + '.' + (n % 250) };
}
async function abre(token) {
  PREGUNTAS_A_STRIPE = 0;
  const r = res();
  await viaje({ method: 'POST', headers: cab(), body: { t: token } }, r);
  return r;
}

/* Dos clientes distintos, con datos distintos. La metadata trae `km` a
   proposito: es lo que no puede salir. */
function sesionDe(id, quien, folio) {
  return {
    id: id, payment_status: 'paid', status: 'complete',
    metadata: {
      folio: folio, nombre: quien, correo: quien.toLowerCase() + '@ejemplo.mx',
      telefono: '3312345678', canal: 'correo',
      ruta: 'Guadalajara → Puerto Vallarta',
      origen: 'Guadalajara, Jalisco, México', destino: 'Puerto Vallarta, Jalisco, México',
      unidad: 'Sprinter', salida: '2026-09-03T08:00', regreso: '2026-09-06T18:00',
      dias: '4', puntoSalida: 'Av. Vallarta 1234',
      km: '621.2', nochesExtra: '0', importeNoches: '4000',
      movDias: '1', movImporte: '3000', movDetalle: '2026-09-04: 08:00 a 16:00',
      total: '26000', anticipo: '5200', saldo: '20800'
    }
  };
}
SESIONES = {
  cs_test_ANA: sesionDe('cs_test_ANA', 'Ana', 'ET-AAAA-111'),
  cs_test_BETO: sesionDe('cs_test_BETO', 'Beto', 'ET-BBBB-222')
};

(async function () {

  /* ============ 1. CADA QUIEN VE LO SUYO, Y NADA MAS ============ */
  const deAna = ligas.firma('cs_test_ANA', '2026-09-06');
  const deBeto = ligas.firma('cs_test_BETO', '2026-09-06');

  const ana = await abre(deAna);
  igual('Ana abre su viaje', ana._status, 200);
  igual('y ve SU folio', ana._json.folio, 'ET-AAAA-111');
  igual('y su nombre', ana._json.nombre, 'Ana');

  const beto = await abre(deBeto);
  igual('Beto ve el suyo', beto._json.folio, 'ET-BBBB-222');

  /* El ataque: Ana pega la carga de Beto con su propia firma. */
  const inventada = deBeto.split('.')[0] + '.' + deAna.split('.')[1];
  const robo = await abre(inventada);
  igual('Ana NO puede abrir el viaje de Beto', robo._status, 404);
  igual('y no se le escapa ni el folio', JSON.stringify(robo._json).indexOf('BBBB'), -1);

  /* ============ 2. UNA LIGA INVENTADA NO LLEGA A STRIPE ============
     Es la parte que se ve menos. Si preguntaramos primero y verificaramos
     despues, quien prueba identificadores sabria cuales existen por el
     tiempo o por el codigo de respuesta. */
  igual('una liga inventada no le pregunta a Stripe', PREGUNTAS_A_STRIPE, 0);

  const basura = await abre('esto.noesuntoken');
  igual('una liga de basura tampoco', PREGUNTAS_A_STRIPE, 0);
  igual('y contesta 404', basura._status, 404);

  const vacia = await abre('');
  igual('sin liga, tampoco', PREGUNTAS_A_STRIPE, 0);

  /* Y la buena SI llega, una sola vez */
  await abre(deAna);
  igual('una liga buena pregunta UNA vez', PREGUNTAS_A_STRIPE, 1);

  /* ============ 3. LA REGLA DEL KILOMETRO ============
     La metadata de Stripe trae `km`. Esta pantalla es el camino mas nuevo
     por donde se podria escapar. */
  const texto = JSON.stringify(ana._json);
  igual('ni el kilometraje ni ninguna tarifa salen',
    texto.match(/\bkm\b|kilometr|tarifa|621\.2/i), null);
  igual('ni la tarifa por noche', texto.match(/nochesExtra|importeNoches/i), null);
  igual('ni lo que cuesta el dia de movimientos', texto.match(/movImporte/), null);

  /* Y tampoco datos personales que no hacen falta en pantalla */
  igual('ni el teléfono', texto.indexOf('3312345678'), -1);
  igual('ni el correo', texto.indexOf('@ejemplo.mx'), -1);

  /* Lo que SI tiene que ver */
  igual('los montos llegan completos',
    [ana._json.total, ana._json.anticipo, ana._json.saldo], [26000, 5200, 20800]);
  igual('y su viaje', [ana._json.origen, ana._json.dias],
    ['Guadalajara, Jalisco, México', 4]);
  igual('y sus días con movimiento', ana._json.diasMovimiento, 1);

  /* ============ 4. LA LIGA VENCIDA MANDA A LA OTRA PUERTA ============
     No se le deja mirando un error sin salida: se le dice que venció, que es
     distinto de «no existe», y con eso la pantalla lo manda a WhatsApp. */
  const vieja = ligas.firma('cs_test_ANA', '2020-01-01', Date.UTC(2020, 0, 1));
  const rv = await abre(vieja);
  igual('una liga vencida contesta 410', rv._status, 410);
  igual('y lo dice, para poder mandarlo a la otra puerta', rv._json.vencida, true);
  igual('sin preguntarle a Stripe', PREGUNTAS_A_STRIPE, 0);

  /* ============ 5. LO QUE NO EXISTE Y LO QUE NO SE PAGO ============ */
  const fantasma = ligas.firma('cs_test_NO_EXISTE', '2026-09-06');
  const rf = await abre(fantasma);
  igual('una sesión que Stripe no reconoce: 404', rf._status, 404);

  /* --------------------------------------------------------------
     OXXO: EL VOUCHER EXISTE Y EL DINERO NO HA ENTRADO

     Esta asercion cambio de lado. Pedia que un voucher sin pagar no
     enseñara nada, y estaba mal: mientras el dinero llega, el cliente SI
     tiene que poder ver que reservo —a donde, cuando, cuanto— y que el
     pago sigue en camino. Lo que no puede es decirle «tu viaje esta
     apartado», y no se lo dice: sale como `pendiente` y la pantalla pinta
     «Estamos confirmando tu pago».
     -------------------------------------------------------------- */
  SESIONES.cs_test_OXXO = Object.assign(sesionDe('cs_test_OXXO', 'Caro', 'ET-CCCC-333'),
    { payment_status: 'unpaid', status: 'open' });
  const rOxxo = await abre(ligas.firma('cs_test_OXXO', '2026-09-06'));
  igual('un voucher sin pagar SÍ enseña el viaje', rOxxo._status, 200);
  igual('pero NO dice que esté apartado', rOxxo._json.estado, 'pendiente');
  igual('y su folio sí lo ve', rOxxo._json.folio, 'ET-CCCC-333');

  /* Una sesion abandonada, en cambio, no tiene nada que enseñar */
  SESIONES.cs_test_MUERTA = { id: 'cs_test_MUERTA', payment_status: 'unpaid',
                              status: 'expired', metadata: {} };
  const rMuerta = await abre(ligas.firma('cs_test_MUERTA', '2026-09-06'));
  igual('una sesión abandonada no enseña un viaje', rMuerta._json.estado, 'sinPagar');
  igual('y lo dice con palabras', typeof rMuerta._json.aviso, 'string');

  /* ============ 6. LAS DEFENSAS DE SIEMPRE ============ */
  {
    const r1 = res();
    await viaje({ method: 'GET', headers: cab(), body: {} }, r1);
    igual('por GET no contesta', r1._status, 405);

    const r2 = res();
    await viaje({ method: 'POST', headers: { origin: 'https://sitio-ajeno.com' }, body: {} }, r2);
    igual('desde otro sitio tampoco', r2._status, 403);
  }

  /* ============ 7. SIN LIGAS_SECRETO, FALLA CERRADA ============ */
  {
    const guardado = process.env.LIGAS_SECRETO;
    delete process.env.LIGAS_SECRETO;
    const r = await abre(deAna);
    igual('sin LIGAS_SECRETO no abre ninguna liga', r._status, 404);
    igual('y no le pregunta a Stripe', PREGUNTAS_A_STRIPE, 0);
    process.env.LIGAS_SECRETO = guardado;
  }

  console.log('\n' + buenas + ' buenas, ' + malas + ' malas');
  process.exit(malas ? 1 : 0);
})();
