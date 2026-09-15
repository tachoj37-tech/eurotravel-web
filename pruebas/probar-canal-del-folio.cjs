/* ============================================================
   EL FOLIO LLEGA POR CORREO, Y LA PÁGINA NO PROMETE OTRA COSA
   (15-sep-2026)
   ============================================================
       node pruebas/probar-canal-del-folio.cjs

   La caja de pago preguntaba «¿A dónde te mandamos el folio?» con dos
   opciones: «A mi correo» y «A mi WhatsApp». La segunda no hacía
   NADA: `/api/pagar` la guardaba en la metadata y el webhook mandaba
   el correo igual. Un cliente que la escogía esperaba un WhatsApp que
   nunca llegó.

   No se construye el envío por WhatsApp (escribirle primero a un
   cliente exige plantilla de Meta, descartada en docs/SEGUIMIENTO.md).
   Lo que se hace es dejar de prometerlo:

     · la pantalla ya no ofrece la opción, y dice que va al correo;
     · el aviso de «Tus datos» no promete nada «al teléfono»;
     · `/api/pagar` anota `canal: correo` pase lo que pase — si llega
       «whatsapp» de una página vieja en caché, no se registra una
       promesa que nadie va a cumplir.
   ============================================================ */
'use strict';

const fs = require('fs');
const path = require('path');

let buenas = 0, malas = 0;
function igual(nombre, dio, esperado) {
  const a = JSON.stringify(dio), b = JSON.stringify(esperado);
  if (a === b) { buenas++; console.log('ok   ' + nombre); }
  else { malas++; console.log('MAL  ' + nombre + '\n     dio      ' + a + '\n     esperaba ' + b); }
}
function cierto(nombre, v) { igual(nombre, !!v, true); }

const INDEX = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const VISIBLE = INDEX.replace(/<!--[\s\S]*?-->/g, ' ').replace(/\/\*[\s\S]*?\*\//g, ' ');

(async function () {

  /* ================= LA PANTALLA ================= */
  igual('ya no se ofrece «A mi WhatsApp» para el folio', /A mi WhatsApp/.test(VISIBLE), false);
  igual('ni un radio de canal que no hace nada', /name="canal"/.test(VISIBLE), false);
  const cuerpoPago = (/<div class="pago-cuerpo">([\s\S]*?)<div class="pago-acciones">/.exec(VISIBLE) || [])[1] || '';
  cierto('la caja de pago dice que el folio llega al correo', /correo/.test(cuerpoPago) && /folio/.test(cuerpoPago));
  igual('«Tus datos» no promete nada al teléfono',
    /al teléfono y al correo te llegan/.test(VISIBLE), false);
  igual('y el navegador ya no manda un canal a /api/pagar',
    /canal:\s*canal/.test(VISIBLE), false);

  /* ================= /api/pagar ================= */
  process.env.GOOGLE_ROUTES_KEY = 'de_mentiras';
  process.env.STRIPE_SECRET_KEY = 'sk_test_de_mentiras';
  const tarifa = require('../api/_tarifa.js');
  const antes = tarifa.PAGINA_DA_PRECIOS;
  tarifa.PAGINA_DA_PRECIOS = true;
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
  const r = { _status: null, _json: null };
  r.status = function (s) { r._status = s; return r; };
  r.json = function (j) { r._json = j; return r; };
  await pagar({ method: 'POST',
    headers: { origin: 'https://eurotravel-web.vercel.app', 'x-vercel-forwarded-for': '10.7.0.1' },
    body: {
      origen: { placeId: 'ChIJ_O_c', lat: 20.66, lng: -103.35, direccion: 'Guadalajara, Jalisco, México' },
      destino: { placeId: 'ChIJ_D_c', lat: 20.65, lng: -105.22, direccion: 'Puerto Vallarta, Jalisco, México' },
      salida: '2030-03-20T08:00', regreso: '2030-03-23T18:00', redondo: true, unidad: 'Sprinter',
      nombre: 'Rosa Martínez', correo: 'rosa@ejemplo.mx', telefono: '3312345678',
      rutaTexto: 'Guadalajara → Puerto Vallarta', pasajeros: 10,
      canal: 'whatsapp'          // una página vieja, en caché
    } }, r);
  igual('pagar abre el cobro', r._status, 200);
  igual('pero anota canal «correo» aunque llegue «whatsapp»',
    alStripe && alStripe.get('metadata[canal]'), 'correo');

  tarifa.PAGINA_DA_PRECIOS = antes;

  console.log('\n' + buenas + ' buenas, ' + malas + ' malas');
  process.exit(malas ? 1 : 0);
})();
