/* ============================================================
   Mis viajes y cambiar la contraseña
   ------------------------------------------------------------
       node pruebas/probar-mis-viajes.cjs

   LO QUE SE CUIDA, en orden de gravedad:

     1. NADIE VE LOS VIAJES DE OTRO. Es toda la seguridad de esta
        puerta: el cliente sale de la cookie firmada, y si eso se
        rompe, cualquiera lee los viajes de cualquiera cambiando
        un texto en el navegador.

     2. Una sesión robada NO puede cambiar la contraseña sin saber
        la de ahorita. Si no, quien se sienta en una pestaña
        abierta deja al dueño fuera de su cuenta para siempre.

     3. La lista no enseña de más: ni el identificador de Stripe,
        ni el desglose de costos que el resto del sitio esconde.
   ============================================================ */
'use strict';

process.env.LIGAS_SECRETO = 'secreto-de-prueba-para-cuentas-1234567890';
process.env.STRIPE_SECRET_KEY = 'sk_test_x';
process.env.RESEND_API_KEY = 're_x';

let buenas = 0, malas = 0;
function igual(nombre, dio, esperado) {
  const a = JSON.stringify(dio), b = JSON.stringify(esperado);
  if (a === b) { buenas++; console.log('ok   ' + nombre); }
  else { malas++; console.log('MAL  ' + nombre + '\n     dio      ' + a + '\n     esperaba ' + b); }
}
function cierto(nombre, v) { igual(nombre, !!v, true); }
function falso(nombre, v) { igual(nombre, !!v, false); }

const ANA = 'cus_00000000000001';
const BETO = 'cus_00000000000002';

/* Las sesiones de cobro, como las devuelve Stripe. Ana tiene dos viajes,
   Beto uno, y hay una sesión a medias sin folio. */
const SESIONES = [
  { id: 'cs_test_ana1', customer: ANA, payment_status: 'paid', status: 'complete',
    metadata: { folio: 'ET-1001', origen: 'Guadalajara', destino: 'Chapala',
      salida: '2026-09-10', regreso: '2026-09-10', total: 6500, saldo: 3250, unidad: 'Sprinter' } },
  { id: 'cs_test_ana2', customer: ANA, payment_status: 'paid', status: 'complete',
    metadata: { folio: 'ET-1002', origen: 'Guadalajara', destino: 'Tequila',
      salida: '2026-11-02', regreso: '2026-11-02', total: 7000, saldo: 0, unidad: 'Sprinter' } },
  { id: 'cs_test_medias', customer: ANA, payment_status: 'unpaid', status: 'open',
    metadata: { origen: 'Guadalajara', destino: 'Tapalpa' } },
  { id: 'cs_test_beto1', customer: BETO, payment_status: 'paid', status: 'complete',
    metadata: { folio: 'ET-2001', origen: 'Zapopan', destino: 'Mazamitla',
      salida: '2026-10-01', regreso: '2026-10-02', total: 14500, saldo: 7250 } }
];

let FICHAS = [];
let FILTRO_DE_STRIPE_SIRVE = true;    // para probar el segundo cerrojo
let ULTIMA_URL = '';

global.fetch = function (url, opc) {
  const u = String(url);
  ULTIMA_URL = u;

  if (u.indexOf('/checkout/sessions?customer=') >= 0) {
    const quien = decodeURIComponent(u.split('customer=')[1].split('&')[0]);
    /* Cuando se finge que el filtro de Stripe no sirve, devuelve TODO: así se
       comprueba que el segundo cerrojo de nuestro lado sí filtra. */
    const data = FILTRO_DE_STRIPE_SIRVE
      ? SESIONES.filter(function (s) { return s.customer === quien; })
      : SESIONES.slice();
    return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({ data: data }) });
  }
  if (/\/customers\/cus_/.test(u)) {
    const id = u.split('/customers/')[1].split('?')[0];
    const f = FICHAS.find(function (x) { return x.id === id; });
    if (!f) return Promise.resolve({ ok: false, status: 404, json: () => Promise.resolve({ error: {} }) });
    if (!opc || opc.method !== 'POST') {
      return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(f) });
    }
    String(opc.body || '').split('&').forEach(function (par) {
      const i = par.indexOf('=');
      const k = decodeURIComponent(par.slice(0, i));
      const v = decodeURIComponent(par.slice(i + 1).replace(/\+/g, ' '));
      const m = /^metadata\[(.+)\]$/.exec(k);
      if (m) { if (v === '') delete f.metadata[m[1]]; else f.metadata[m[1]] = v; }
    });
    return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(f) });
  }
  return Promise.reject(new Error('inesperado: ' + u));
};

const logica = require('../api/_cuentas-logica.js');
const cuentas = require('../api/_cuentas.js');
const ligas = require('../api/_ligas.js');

(async function () {

  /* ============ 1. CADA QUIEN VE LOS SUYOS ============ */
  {
    const r = await logica.misViajes(ANA);
    igual('contesta bien', r.status, 200);
    cierto('y dice que está dentro', r.cuerpo.dentro);
    igual('Ana ve sus dos viajes', r.cuerpo.viajes.length, 2);
    igual('los folios son los suyos',
      r.cuerpo.viajes.map(function (v) { return v.folio; }).sort(), ['ET-1001', 'ET-1002']);
    igual('el más nuevo primero', r.cuerpo.viajes[0].folio, 'ET-1002');

    const b = await logica.misViajes(BETO);
    igual('Beto ve el suyo, uno', b.cuerpo.viajes.length, 1);
    igual('y es el suyo', b.cuerpo.viajes[0].folio, 'ET-2001');
    falso('el de Ana NO aparece con Beto',
      JSON.stringify(b.cuerpo).indexOf('ET-100') >= 0);
  }

  /* ============ 2. EL SEGUNDO CERROJO ============
     ESTA ES LA PRUEBA IMPORTANTE. Se finge que el filtro de Stripe deja de
     filtrar —cambió de nombre, lo ignoró, lo que sea— y se comprueba que
     nuestro lado igual no reparte los viajes de todos.

     Sin el segundo cerrojo, esa falla de allá se convierte en que cualquier
     cliente vea los viajes de la empresa entera, y no hay nada en la pantalla
     que lo delate. */
  {
    FILTRO_DE_STRIPE_SIRVE = false;
    const r = await logica.misViajes(ANA);
    igual('aunque Stripe devuelva TODO, Ana sigue viendo dos', r.cuerpo.viajes.length, 2);
    falso('el viaje de Beto no se cuela',
      JSON.stringify(r.cuerpo).indexOf('ET-2001') >= 0);
    FILTRO_DE_STRIPE_SIRVE = true;
  }

  /* ============ 3. SIN SESION NO HAY VIAJES ============ */
  {
    const vacio = await logica.misViajes('');
    igual('sin sesión contesta 200, no un error', vacio.status, 200);
    falso('y dice que no está dentro', vacio.cuerpo.dentro);
    igual('con la lista vacía', vacio.cuerpo.viajes, []);
    igual('nulo también', (await logica.misViajes(null)).cuerpo.viajes, []);
  }

  /* ============ 4. LO QUE LA LISTA NO ENSEÑA ============ */
  {
    const r = await logica.misViajes(ANA);
    const texto = JSON.stringify(r.cuerpo);
    igual('nunca sale el identificador de cliente de Stripe', texto.indexOf('cus_'), -1);
    igual('ni el de la sesión de cobro', texto.indexOf('cs_test'), -1);
    /* Lo que el resto del sitio esconde a propósito: nunca se enseña la
       tarifa por kilómetro ni los kilómetros del viaje. */
    falso('ni kilómetros', /\bkm\b|kilometr/i.test(texto));
    falso('ni tarifas por noche', /porNoche|porKm|tarifa/i.test(texto));
  }

  /* ============ 5. UN COBRO A MEDIAS NO ES UN VIAJE ============
     La sesión sin folio se queda fuera: es un cobro que no llegó a contrato,
     y enseñarlo haría que el cliente creyera que tiene un viaje que no tiene. */
  {
    const r = await logica.misViajes(ANA);
    falso('el cobro sin folio no aparece',
      JSON.stringify(r.cuerpo).indexOf('Tapalpa') >= 0);
  }

  /* ============ 6. CADA VIAJE TRAE SU LIGA, Y ES LA SUYA ============ */
  {
    const r = await logica.misViajes(ANA);
    const v = r.cuerpo.viajes.find(function (x) { return x.folio === 'ET-1001'; });
    cierto('el viaje trae liga', !!v.liga);
    cierto('y va a la pantalla del viaje', v.liga.indexOf('/viaje.html?t=') > 0);

    /* La liga tiene que abrir SU sesión de cobro y no otra: si se armaran
       todas con el mismo identificador, un cliente vería el viaje de otro. */
    const abierta = ligas.abre(v.liga.split('t=')[1]);
    cierto('la liga es válida', abierta.ok);
    igual('y apunta a SU cobro', abierta.sesion, 'cs_test_ana1');

    const otro = r.cuerpo.viajes.find(function (x) { return x.folio === 'ET-1002'; });
    igual('la del otro viaje apunta al otro cobro',
      ligas.abre(otro.liga.split('t=')[1]).sesion, 'cs_test_ana2');
  }

  /* ============ 7. CAMBIAR LA CONTRASEÑA ============ */
  {
    const VIEJA = 'la contraseña de antes';
    const NUEVA = 'una contraseña nueva y larga';
    FICHAS = [{ id: ANA, email: 'ana@ejemplo.mx', name: 'Ana Ruiz',
      metadata: await cuentas.paraCrear(VIEJA) }];
    Object.assign(FICHAS[0].metadata, cuentas.paraVerificar());

    /* la de ahorita mal: no cambia nada */
    const mal = await logica.cambiarClave({ actual: 'no es esa', nueva: NUEVA }, ANA);
    igual('con la contraseña de ahorita mal, no cambia', mal.status, 401);
    cierto('y la vieja SIGUE sirviendo',
      await cuentas.contrasenaValida(FICHAS[0].metadata, VIEJA));

    /* sin sesión: ni se intenta */
    igual('sin sesión no cambia nada',
      (await logica.cambiarClave({ actual: VIEJA, nueva: NUEVA }, '')).status, 401);
    cierto('y la vieja sigue sirviendo',
      await cuentas.contrasenaValida(FICHAS[0].metadata, VIEJA));

    /* una nueva que no sirve */
    igual('una contraseña corta se rechaza',
      (await logica.cambiarClave({ actual: VIEJA, nueva: 'corta' }, ANA)).status, 422);
    igual('y vacía también',
      (await logica.cambiarClave({ actual: VIEJA, nueva: '' }, ANA)).status, 422);

    /* la buena */
    const bien = await logica.cambiarClave({ actual: VIEJA, nueva: NUEVA }, ANA);
    igual('con la de ahorita bien, cambia', bien.status, 200);
    cierto('la nueva sirve', await cuentas.contrasenaValida(FICHAS[0].metadata, NUEVA));
    falso('y la vieja YA NO', await cuentas.contrasenaValida(FICHAS[0].metadata, VIEJA));

    /* la sal tiene que ser otra: reusarla dejaría ver que la contraseña
       cambió pero el resumen no, y de rebote que la nueva es igual a la vieja */
    const salPrimera = FICHAS[0].metadata[cuentas.CAMPO_SAL];
    await logica.cambiarClave({ actual: NUEVA, nueva: 'y otra mas todavia larga' }, ANA);
    cierto('cada cambio estrena sal',
      FICHAS[0].metadata[cuentas.CAMPO_SAL] !== salPrimera);
  }

  /* ============ 8. QUIEN ENTRO CON GOOGLE PUEDE PONERSE UNA ============
     Nunca tuvo contraseña, así que no hay ninguna que pedirle. */
  {
    FICHAS = [{ id: BETO, email: 'beto@ejemplo.mx', name: 'Beto Gil',
      metadata: Object.assign(cuentas.paraLigarGoogle('1100'), cuentas.paraVerificar()) }];
    falso('no tenía contraseña', cuentas.tieneContrasena(FICHAS[0].metadata));

    const r = await logica.cambiarClave({ nueva: 'su primera contraseña' }, BETO);
    igual('se la puede poner sin dar una anterior', r.status, 200);
    cierto('y ya sirve', await cuentas.contrasenaValida(FICHAS[0].metadata, 'su primera contraseña'));
    cierto('sin perder su Google', !!cuentas.googleDe(FICHAS[0].metadata));
  }

  /* ============ 9. LA CONTRASEÑA NUNCA VIAJA DE REGRESO ============ */
  {
    const r = await logica.cambiarClave({ actual: 'su primera contraseña', nueva: 'otra vez otra larga' }, BETO);
    const texto = JSON.stringify(r.cuerpo);
    falso('la respuesta no trae la contraseña', /contrase|otra vez otra larga/i.test(texto));
    falso('ni el resumen', texto.indexOf(FICHAS[0].metadata[cuentas.CAMPO_HASH]) >= 0);
    falso('ni la sal', texto.indexOf(FICHAS[0].metadata[cuentas.CAMPO_SAL]) >= 0);
  }

  console.log('\n' + buenas + ' buenas, ' + malas + ' malas');
  process.exit(malas ? 1 : 0);
})();
