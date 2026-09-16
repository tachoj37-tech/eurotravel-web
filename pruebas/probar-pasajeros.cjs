/* ============================================================
   LOS PASAJEROS SE PREGUNTAN, SE REVISAN Y LLEGAN AL CONTRATO
   (15-sep-2026)
   ============================================================
       node pruebas/probar-pasajeros.cjs

   Hasta hoy el cotizador no preguntaba cuántos van y el webhook
   mandaba `pasajeros: 1` a EuroSystem en TODO contrato: una Sprinter
   de veinte con «1 pasajero» impreso. La oficina lo tenía que
   adivinar y el cliente podía apartar una Sprinter para treinta.

   Lo que se exige aquí, de punta a punta:

     1. la capacidad sale de `unidades.js` —la fuente única—, no de
        una copia;
     2. `/api/pagar` NO abre el cobro sin pasajeros, ni con más de
        los que caben en la unidad (el navegador no es la defensa);
     3. el número viaja en la metadata de Stripe y llega al contrato
        de EuroSystem y al correo;
     4. la solicitud de los camiones también lo lleva a la ficha del
        vendedor;
     5. y la pantalla lo pide antes de buscar.
   ============================================================ */
'use strict';

let buenas = 0, malas = 0;
function igual(nombre, dio, esperado) {
  const a = JSON.stringify(dio), b = JSON.stringify(esperado);
  if (a === b) { buenas++; console.log('ok   ' + nombre); }
  else { malas++; console.log('MAL  ' + nombre + '\n     dio      ' + a + '\n     esperaba ' + b); }
}
function cierto(nombre, v) { igual(nombre, !!v, true); }

/* El secreto SI va puesto: sin el, el webhook contesta 500 y no procesa nada
   (probar-webhook.cjs lo cuida). Aqui el cuerpo llega como objeto, que es lo
   que pasa en produccion, y entonces manda la consulta a Stripe. */
process.env.STRIPE_WEBHOOK_SECRET = 'whsec_de_mentiras';
process.env.CONTRATOS_API_KEY = 'llave_de_mentiras';
process.env.STRIPE_SECRET_KEY = 'sk_test_de_mentiras';
process.env.RESEND_API_KEY = 're_de_mentiras';
process.env.GOOGLE_ROUTES_KEY = 'de_mentiras';

function cargaSiExiste(ruta) {
  try { return require(ruta); } catch (e) { console.log('     (no carga ' + ruta + ': ' + e.message + ')'); return null; }
}

(async function () {

  /* ================= 1 · LA CAPACIDAD, DE LA FUENTE ÚNICA ================= */
  const pax = cargaSiExiste('../api/_pasajeros.js') || {};
  const capacidadDe = pax.capacidadDe || function () { return null; };
  const revisa = pax.revisa || function () { return { ok: null }; };

  igual('Sprinter: caben 20', capacidadDe('Sprinter'), 20);
  igual('con el «· capacidad» que pinta la pantalla', capacidadDe('Irizar i6S · 51 pasajeros'), 51);
  igual('Suburban: caben 6', capacidadDe('Suburban'), 6);
  igual('Irizar Century 49: caben 49', capacidadDe('Irizar Century 49'), 49);
  igual('una unidad que no existe no tiene capacidad', capacidadDe('Camión de mentiras'), 0);

  igual('12 en una Sprinter: pasa', revisa('12', 'Sprinter'), { ok: true, pasajeros: 12 });
  igual('20 justos: pasa', revisa(20, 'Sprinter').pasajeros, 20);
  igual('21 en una Sprinter: no', revisa(21, 'Sprinter').ok, false);
  igual('cero: no', revisa(0, 'Sprinter').ok, false);
  igual('vacío: no (es obligatorio)', revisa('', 'Sprinter').ok, false);
  igual('sin mandar: no', revisa(undefined, 'Sprinter').ok, false);
  igual('con decimales: no', revisa('3.5', 'Sprinter').ok, false);
  igual('texto: no', revisa('muchos', 'Sprinter').ok, false);
  igual('negativo: no', revisa(-4, 'Sprinter').ok, false);
  cierto('y el aviso dice cuántos caben', /20/.test(revisa(25, 'Sprinter').aviso || ''));

  /* ================= 2 · /api/pagar ================= */
  {
    const tarifa = require('../api/_tarifa.js');
    const antes = tarifa.PAGINA_DA_PRECIOS;
    tarifa.PAGINA_DA_PRECIOS = true;           // para que haya cobro que abrir
    const pagar = require('../api/pagar.js');

    let alStripe = null;
    global.fetch = function (url, opc) {
      const u = String(url);
      if (u.indexOf('routes.googleapis.com') >= 0) {
        return Promise.resolve({ ok: true, json: function () { return Promise.resolve({
          routes: [{ distanceMeters: 330000, duration: '14000s' }] }); } });
      }
      if (u.indexOf('api.stripe.com') >= 0) {
        alStripe = new URLSearchParams(opc.body);
        return Promise.resolve({ ok: true, json: function () { return Promise.resolve({
          id: 'cs_test_x', url: 'https://checkout.stripe.com/x' }); } });
      }
      return Promise.reject(new Error('inesperado: ' + u));
    };
    function res() {
      const r = { _status: null, _json: null };
      r.status = function (s) { r._status = s; return r; };
      r.json = function (j) { r._json = j; return r; };
      r.end = function () { return r; };
      return r;
    }
    let ip = 0;
    async function paga(extra) {
      alStripe = null;
      const r = res();
      await pagar({ method: 'POST',
        headers: { origin: 'https://eurotravel-web.vercel.app', 'x-vercel-forwarded-for': '10.8.0.' + (++ip) },
        body: Object.assign({
          origen: { placeId: 'ChIJ_O_px' + ip, lat: 20.66, lng: -103.35, direccion: 'Guadalajara, Jalisco, México' },
          destino: { placeId: 'ChIJ_D_px' + ip, lat: 20.65, lng: -105.22, direccion: 'Puerto Vallarta, Jalisco, México' },
          salida: '2030-03-20T08:00', regreso: '2030-03-23T18:00', redondo: true, unidad: 'Sprinter',
          nombre: 'Rosa Martínez', correo: 'rosa@ejemplo.mx', telefono: '3312345678',
          rutaTexto: 'Guadalajara → Puerto Vallarta', puntoSalida: 'Afuera del Tec'
        }, extra) }, r);
      return r;
    }

    const sin = await paga({});
    igual('pagar sin pasajeros: 422 y NO abre cobro', [sin._status, alStripe], [422, null]);
    cierto('con un aviso para el cliente', sin._json && sin._json.aviso);

    const demas = await paga({ pasajeros: 25 });
    igual('25 en una Sprinter de 20: 422 y NO abre cobro', [demas._status, alStripe], [422, null]);

    const bien = await paga({ pasajeros: '12' });
    igual('12 en la Sprinter: 200', bien._status, 200);
    igual('y la metadata de Stripe lleva los pasajeros', alStripe && alStripe.get('metadata[pasajeros]'), '12');

    tarifa.PAGINA_DA_PRECIOS = antes;
  }

  /* ================= 3 · EL CONTRATO Y EL CORREO ================= */
  const logica = require('../api/_webhook-logica.js');
  const META = {
    folio: 'ET-PAX1-2QZ', nombre: 'Rosa Martínez Gil', telefono: '3312345678',
    correo: 'rosa@ejemplo.mx', canal: 'correo', ruta: 'Guadalajara → Puerto Vallarta',
    origen: 'Guadalajara, Jalisco, México', destino: 'Puerto Vallarta, Jalisco, México',
    unidad: 'Sprinter', salida: '2030-03-20T08:00', regreso: '2030-03-23T18:00', viaje: 'REDONDO',
    dias: '4', total: '19000', anticipo: '4000', saldo: '15000', pasajeros: '12'
  };
  {
    const c = logica.contratoDesde(META, { id: 'cs_live_PAX' });
    igual('el contrato lleva los pasajeros que dio el cliente', c.servicio.pasajeros, 12);
    igual('y ya no dice que no se capturan', /no se captur/i.test(c.observaciones), false);

    const vieja = Object.assign({}, META); delete vieja.pasajeros;
    const cv = logica.contratoDesde(vieja, { id: 'cs_live_PAXV' });
    igual('sesión de antes, sin pasajeros: 1 por omisión', cv.servicio.pasajeros, 1);
    cierto('y lo dice, para que la oficina no se lo crea', /PASAJEROS/.test(cv.observaciones));

    const rara = Object.assign({}, META, { pasajeros: '9999' });
    igual('un número fuera de lo que acepta la puerta (1–90) no viaja', logica.contratoDesde(rara, { id: 'cs_live_R' }).servicio.pasajeros, 1);
  }
  {
    let alSistema = null, alCorreo = null;
    /* `payment_intent` y `amount_total` los trae siempre una sesión pagada, y
       desde el 15-sep-2026 el webhook los lee para anotar el anticipo como
       abono en el contrato. */
    const sesion = { id: 'cs_live_PAXFULL', livemode: true, payment_status: 'paid', status: 'complete',
      payment_intent: 'pi_PAXFULL', amount_total: 400000,
      payment_method_types: ['card'], metadata: META, customer_details: { email: META.correo } };
    global.fetch = function (url, opc) {
      const u = String(url);
      if (u.indexOf('api.stripe.com') >= 0) {
        return Promise.resolve({ ok: true, status: 200, json: function () { return Promise.resolve(sesion); } });
      }
      if (u.indexOf('api.resend.com') >= 0) {
        alCorreo = JSON.parse(opc.body);
        return Promise.resolve({ ok: true, status: 200, json: function () { return Promise.resolve({ id: 'em' }); } });
      }
      /* La del abono no se apunta: lo que se mira aquí es el CONTRATO, y
         confundir las dos puertas dejaría la aserción mirando otro cuerpo. */
      if (u.indexOf('/abono-externo') > 0) {
        return Promise.resolve({ ok: true, status: 201, json: function () { return Promise.resolve({ registrado: true }); } });
      }
      alSistema = JSON.parse(opc.body);
      return Promise.resolve({ ok: true, status: 201, json: function () { return Promise.resolve({ folio: 53001 }); } });
    };
    const r = await logica.procesa({ type: 'checkout.session.completed', data: { object: { id: sesion.id } } }, '');
    igual('pago real con pasajeros: 200 y folio', [r.status, r.cuerpo.folio], [200, 53001]);
    igual('EuroSystem recibe pasajeros: 12', alSistema && alSistema.servicio.pasajeros, 12);
    cierto('el correo dice cuántos pasajeros', alCorreo && /Pasajeros/.test(alCorreo.text) && /12/.test(alCorreo.text));
  }

  /* ================= 4 · LA SOLICITUD DE LOS CAMIONES ================= */
  {
    const solicitud = require('../api/_solicitud.js');
    const rv = solicitud.revisa({ telefono: '3312345678', destino: 'Mazamitla', origen: 'Guadalajara',
      salida: '2030-03-20T08:00', regreso: '2030-03-21T18:00', unidad: 'Irizar i6S', pasajeros: 44 });
    igual('la solicitud acepta `pasajeros` (así lo manda la pantalla)', rv.ok && rv.solicitud.gente, 44);
    const ficha = solicitud.fichaParaElVendedor ? solicitud.fichaParaElVendedor(rv.solicitud) : '';
    cierto('y la ficha del vendedor dice «44 pasajeros»', /44 pasajeros/.test(ficha));
  }

  /* ================= 5 · LA PANTALLA ================= */
  {
    global.window = global.window || {};
    require('../unidades.js');
    const U = global.window.UNIDADES;
    const sprinter = U.filter(function (u) { return u.id === 'sprinter'; })[0];
    const COT = require('../cotizacion.js');
    const base = { origen: {}, destino: {}, salida: '2030-03-20T08:00', unidad: sprinter };
    cierto('sin pasajeros, la máquina dice que faltan', COT.faltantes(base).indexOf('pasajeros') >= 0);
    cierto('con 21 en la Sprinter, también',
      COT.faltantes(Object.assign({}, base, { pasajeros: 21 })).indexOf('pasajeros') >= 0);
    igual('con 12, no falta nada', COT.faltantes(Object.assign({}, base, { pasajeros: 12 })), []);
    const m = COT.crea({ pide: function () { return Promise.reject(new Error('no')); } });
    m.pon(Object.assign({}, base, { pasajeros: 12 }));
    igual('y el estado los guarda', m.estadoVivo().pasajeros, 12);

    const fs = require('fs');
    const html = fs.readFileSync(require('path').join(__dirname, '..', 'index.html'), 'utf8');
    cierto('el buscador tiene el campo de pasajeros', /id="s-pax"/.test(html));
    cierto('y /api/pagar lo recibe', /pasajeros:\s*VIAJE\.pasajeros/.test(html));
  }

  console.log('\n' + buenas + ' buenas, ' + malas + ' malas');
  process.exit(malas ? 1 : 0);
})();
