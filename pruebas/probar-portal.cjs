/* ============================================================
   «Abona a tu viaje» — la puerta de consulta, sin red
   ------------------------------------------------------------
       node pruebas/probar-portal.cjs

   Es la única pantalla de la página que enseña datos de un
   contrato SIN liga y SIN código: solo con el número de contrato
   impreso en el PDF y un apellido. Por eso lo que se juega aquí
   no es que funcione, es que no se afloje:

     1. la llave de EuroSystem NUNCA sale al navegador, ni la
        dirección de EuroSystem
     2. lo que se le pasa al cliente es una LISTA BLANCA: si
        EuroSystem algún día contesta de más, de aquí no pasa
     3. el 404 se dice con las MISMAS palabras que EuroSystem, que
        son las mismas para «no existe», «no es tu apellido» y «no
        está confirmado». Distinguirlos le enseñaría a quien
        adivina cuáles folios existen.
     4. sin PORTAL_API_KEY se contesta 503 y la variable se nombra
        SOLO en el registro del servidor
   ============================================================ */
'use strict';

let buenas = 0, malas = 0;
function igual(nombre, dio, esperado) {
  const a = JSON.stringify(dio), b = JSON.stringify(esperado);
  if (a === b) { buenas++; console.log('ok   ' + nombre); }
  else { malas++; console.log('MAL  ' + nombre + '\n     dio      ' + a + '\n     esperaba ' + b); }
}
function cierto(nombre, v) { igual(nombre, !!v, true); }
function titulo(t) { console.log('\n== ' + t.toUpperCase() + ' =='); }

process.env.PORTAL_API_KEY = 'llave_del_portal_de_mentiras';
process.env.EUROSYSTEM_URL = 'https://eurosystem.site';

const portal = require('../api/_portal.js');

/* Lo que contesta EuroSystem en un 200, tal como lo describe
   CONTRATOS-API.md §12, y con dos campos de más a propósito: esta prueba
   existe justamente para que esos dos no lleguen al navegador. */
const RESPUESTA = {
  folio: 43773,
  destino: 'Puerto Vallarta, Jalisco',
  salida: '2026-10-03T08:00:00-06:00',
  regreso: '2026-10-06T18:00:00-06:00',
  unidad: 'Autobús Irizar',
  unidades: 1,
  total: 48000,
  abonado: 20000,
  descuento: 0,
  enRevision: 3000,
  saldo: 28000,
  abonos: [
    { fecha: '2026-09-01T12:00:00-06:00', monto: 15000, forma: 'TRANSFERENCIA' },
    { fecha: '2026-09-10T09:30:00-06:00', monto: 5000, forma: 'TARJETA' }
  ],
  pdf: 'https://eurosystem.site/api/contratos/43773/pdf?firma=abc',
  /* NO documentados, y no tienen por qué salir */
  operador: 'Juan Ramírez',
  telefonoCliente: '3312345678'
};

let LLAMADA = null;
function euroDice(status, datos) {
  global.fetch = function (url, opc) {
    LLAMADA = { url: String(url), opciones: opc,
      cuerpo: opc && opc.body ? JSON.parse(opc.body) : null };
    return Promise.resolve({
      ok: status >= 200 && status < 300, status: status,
      json: function () { return Promise.resolve(datos); }
    });
  };
}

(async function () {

  /* ============ 1. EL CAMINO BUENO ============ */
  LLAMADA = null;
  euroDice(200, RESPUESTA);
  let r = await portal.consulta(43773, 'Pérez');

  igual('acierta: ok', r.ok, true);
  cierto('se llamó a la puerta documentada (§12)',
    LLAMADA.url === 'https://eurosystem.site/api/portal/viaje');
  igual('la llave va en la cabecera',
    LLAMADA.opciones.headers['x-api-key'], 'llave_del_portal_de_mentiras');
  igual('el cuerpo es folio entero y apellido',
    LLAMADA.cuerpo, { folio: 43773, apellido: 'Pérez' });
  igual('y el método es POST', LLAMADA.opciones.method, 'POST');

  /* ============ 2. LA LISTA BLANCA ============
     Lo que sale tiene los campos de §12 y NADA más. Si mañana EuroSystem
     agrega un campo con el teléfono del cliente, de aquí no pasa. */
  igual('lo que sale son exactamente los campos de §12',
    Object.keys(r.viaje).sort(),
    ['abonado', 'abonos', 'descuento', 'destino', 'enRevision', 'folio',
      'pdf', 'regreso', 'saldo', 'salida', 'total', 'unidad', 'unidades']);
  igual('y el operador NO sale', r.viaje.operador, undefined);
  igual('ni el teléfono del cliente', r.viaje.telefonoCliente, undefined);

  igual('los montos pasan como números',
    [r.viaje.total, r.viaje.abonado, r.viaje.saldo, r.viaje.enRevision, r.viaje.descuento],
    [48000, 20000, 28000, 3000, 0]);
  igual('el folio también', r.viaje.folio, 43773);
  igual('la liga del PDF pasa tal cual', r.viaje.pdf, RESPUESTA.pdf);

  igual('cada abono lleva fecha, monto y forma, y nada más',
    r.viaje.abonos.map(function (a) { return Object.keys(a).sort().join(','); }),
    ['fecha,forma,monto', 'fecha,forma,monto']);
  igual('y los abonos vienen completos',
    r.viaje.abonos.map(function (a) { return a.monto; }), [15000, 5000]);

  /* Un abono con basura adentro no puede meter etiquetas ni objetos: se
     recorta a texto y número. */
  euroDice(200, Object.assign({}, RESPUESTA, {
    abonos: [{ fecha: '2026-09-01', monto: '7000', forma: { raro: true }, nota: 'de más' }]
  }));
  r = await portal.consulta(43773, 'Pérez');
  igual('un abono raro se limpia',
    r.viaje.abonos[0], { fecha: '2026-09-01', monto: 7000, forma: '' });

  /* Sin lista de abonos, la pantalla recibe una lista vacía y no un nulo:
     así no hay que preguntarse si existe antes de recorrerla. */
  euroDice(200, Object.assign({}, RESPUESTA, { abonos: null }));
  r = await portal.consulta(43773, 'Pérez');
  igual('sin abonos, lista vacía', r.viaje.abonos, []);

  /* La liga del PDF es al portador (§12): si viniera apuntando a otro lado,
     no se le pasa al cliente. */
  euroDice(200, Object.assign({}, RESPUESTA, { pdf: 'javascript:alert(1)' }));
  r = await portal.consulta(43773, 'Pérez');
  igual('un pdf que no es https no sale', r.viaje.pdf, '');
  euroDice(200, Object.assign({}, RESPUESTA, { pdf: 'http://eurosystem.site/x.pdf' }));
  r = await portal.consulta(43773, 'Pérez');
  igual('ni uno sin cifrar', r.viaje.pdf, '');

  /* ============ 3. EL 404, CON LAS PALABRAS DE EUROSYSTEM ============ */
  euroDice(404, { error: 'No encontramos un viaje con ese folio y apellido.' });
  r = await portal.consulta(43773, 'Quienquiera');
  igual('404: no ok, 404 y las palabras de §12',
    [r.ok, r.status, r.aviso],
    [false, 404, 'No encontramos un viaje con ese folio y apellido.']);
  igual('y no se cuela nada del viaje', r.viaje, undefined);

  /* EuroSystem contesta lo MISMO para folio que no existe, apellido que no
     cuadra y contrato sin confirmar. La página no puede decir más. */
  igual('la frase es la misma que exporta el módulo',
    portal.NO_ENCONTRADO, 'No encontramos un viaje con ese folio y apellido.');

  /* ============ 4. LOS «NO» DE EUROSYSTEM NO SE LE CUENTAN AL CLIENTE ============
     Ni el código, ni el detalle, ni que exista EuroSystem. */
  for (const codigo of [401, 403, 422, 429, 500, 503]) {
    euroDice(codigo, { error: 'llave equivocada', detalle: 'PORTAL_API_KEY' });
    r = await portal.consulta(43773, 'Pérez');
    igual('EuroSystem contesta ' + codigo + ': no ok', r.ok, false);
    igual('EuroSystem contesta ' + codigo + ': al cliente NO se le nombra EuroSystem',
      /eurosystem|api|llave|key/i.test(r.aviso || ''), false);
  }

  /* 429 es el único «no» del que el cliente sí saca algo: que espere. */
  euroDice(429, { error: 'demasiadas' });
  r = await portal.consulta(43773, 'Pérez');
  igual('429 de EuroSystem llega como 429', r.status, 429);

  /* ============ 5. EUROSYSTEM CAÍDO ============ */
  global.fetch = function () { return Promise.reject(new Error('sin red')); };
  r = await portal.consulta(43773, 'Pérez');
  igual('EuroSystem inalcanzable: 503 y un aviso amable',
    [r.ok, r.status], [false, 503]);
  cierto('y el aviso no nombra a nadie',
    !/eurosystem|fetch|red/i.test(r.aviso || ''));

  /* ============ 6. SIN LA LLAVE, LA PUERTA ESTÁ CERRADA ============
     503, y el nombre de la variable SOLO en el registro. */
  (function () {
    const guardada = process.env.PORTAL_API_KEY;
    for (const falta of ['', '   ']) {
      process.env.PORTAL_API_KEY = falta;
      igual('sin PORTAL_API_KEY (' + JSON.stringify(falta) + '): no hay llave',
        portal.hayLlave(), false);
    }
    process.env.PORTAL_API_KEY = guardada;
    cierto('con la llave puesta, sí hay', portal.hayLlave());
  })();

  (async function () {
    const guardada = process.env.PORTAL_API_KEY;
    process.env.PORTAL_API_KEY = '';
    LLAMADA = null;
    euroDice(200, RESPUESTA);
    const sinLlave = await portal.consulta(43773, 'Pérez');
    igual('sin llave: 503 y NO se llama a EuroSystem',
      [sinLlave.ok, sinLlave.status, LLAMADA], [false, 503, null]);
    igual('y al cliente no se le nombra la variable',
      /PORTAL_API_KEY/.test(sinLlave.aviso || ''), false);
    process.env.PORTAL_API_KEY = guardada;
  })();

  /* ============ 7. LO QUE SE TECLEA SE REVISA ANTES DE SALIR ============ */
  igual('un folio entero vale', portal.folioDeContrato('43773'), 43773);
  igual('con espacios también', portal.folioDeContrato('  43773  '), 43773);
  igual('un folio con letras no', portal.folioDeContrato('ET-AAAA-111'), 0);
  igual('ni con punto', portal.folioDeContrato('437.73'), 0);
  igual('ni el cero', portal.folioDeContrato('0'), 0);
  igual('ni negativo', portal.folioDeContrato('-5'), 0);
  igual('ni vacío', portal.folioDeContrato(''), 0);
  igual('ni absurdamente largo', portal.folioDeContrato('999999999999'), 0);

  igual('un apellido normal vale', portal.apellidoLimpio('  Pérez  '), 'Pérez');
  igual('uno compuesto también', portal.apellidoLimpio('De la Torre'), 'De la Torre');
  igual('vacío no', portal.apellidoLimpio('   '), '');
  igual('una sola letra no', portal.apellidoLimpio('P'), '');
  igual('se recorta lo larguísimo', portal.apellidoLimpio('a'.repeat(300)).length, 80);

  /* El folio y el apellido se revisan ANTES de gastar una llamada. */
  LLAMADA = null;
  euroDice(200, RESPUESTA);
  r = await portal.consulta(0, 'Pérez');
  igual('folio inválido: 422 y NO se llama a EuroSystem',
    [r.ok, r.status, LLAMADA], [false, 422, null]);
  LLAMADA = null;
  r = await portal.consulta(43773, '');
  igual('apellido vacío: 422 y NO se llama a EuroSystem',
    [r.ok, r.status, LLAMADA], [false, 422, null]);

  /* ============================================================
     SEGUNDA PARTE · LA PUERTA DE LA PÁGINA
     ------------------------------------------------------------
     Lo de arriba prueba el módulo que habla con EuroSystem. Esto
     prueba la puerta que toca el navegador: `POST /api/viaje` con
     `accion: 'consulta'`, y el cobro que sale de ahí.

     VIVE DENTRO DE `api/viaje.js` A PROPÓSITO. El plan publica DOCE
     funciones y hay doce exactas; un archivo más tumba el despliegue
     entero. Es la misma salida que ya tomaron abonar y la vuelta de
     Stripe.

     Lo que se juega aquí es distinto de lo de arriba:

       1. el freno por dirección —5 cada 15 minutos— porque lo que se
          adivina es un apellido
       2. que el cobro que se abre después NO le crea al navegador de
          qué contrato es ni cuánto se debe: eso viene firmado en el
          pase
     ============================================================ */
  titulo('la puerta de la página · POST /api/viaje');

  process.env.LIGAS_SECRETO = 'secreto-de-mentiras-para-las-pruebas';
  process.env.STRIPE_SECRET_KEY = 'sk_test_de_mentiras';
  process.env.PORTAL_API_KEY = 'llave_del_portal_de_mentiras';

  const ligas = require('../api/_ligas.js');
  const saldos = require('../api/_saldo.js');
  const puertaDelViaje = require('../api/viaje.js');

  /* La red entera, fingida y apuntada: EuroSystem por un lado, Stripe por
     el otro. Se apuntan las dos para poder afirmar que a una NO se le
     llamó, que es la mitad de lo que se prueba aquí. */
  let AEUROSYSTEM = [], ASTRIPE = [];
  function montaRed(opciones) {
    const o = opciones || {};
    AEUROSYSTEM = []; ASTRIPE = [];
    global.fetch = function (url, opc) {
      const u = String(url);
      if (u.indexOf('api.stripe.com') >= 0) {
        ASTRIPE.push({ url: u, cuerpo: String((opc && opc.body) || '') });
        return Promise.resolve({
          ok: o.stripeNoAbre !== true, status: o.stripeNoAbre ? 400 : 200,
          json: function () {
            return Promise.resolve(o.stripeNoAbre
              ? { error: { message: 'no' } }
              : { id: 'cs_test_ABONO', url: 'https://checkout.stripe.com/c/pay/cs_test_ABONO' });
          }
        });
      }
      AEUROSYSTEM.push({ url: u, cuerpo: opc && opc.body ? JSON.parse(opc.body) : null });
      const status = o.status || 200;
      return Promise.resolve({ ok: status >= 200 && status < 300, status: status,
        json: function () { return Promise.resolve(o.datos || RESPUESTA); } });
    };
  }

  function res() {
    const s = { _status: null, _json: null };
    s.status = function (c) { s._status = c; return s; };
    s.json = function (j) { s._json = j; return s; };
    s.end = function () { return s; };
    return s;
  }
  let cuantas = 0;
  function pide(cuerpo, ip) {
    cuantas++;
    return {
      method: 'POST',
      headers: {
        origin: 'https://eurotravel-web.vercel.app',
        'x-vercel-forwarded-for': ip || ('10.9.' + Math.floor(cuantas / 250) + '.' + (cuantas % 250))
      },
      body: cuerpo
    };
  }
  async function toca(cuerpo, ip) {
    const s = res();
    await puertaDelViaje(pide(cuerpo, ip), s);
    return s;
  }

  /* ============ 8. LA CONSULTA, DESDE EL NAVEGADOR ============ */
  montaRed({ status: 200, datos: RESPUESTA });
  let s = await toca({ accion: 'consulta', folio: '43773', apellido: 'Pérez' });

  igual('consulta buena: 200', s._status, 200);
  igual('  y el viaje viene con los campos de §12',
    Object.keys(s._json.viaje || {}).sort(),
    ['abonado', 'abonos', 'descuento', 'destino', 'enRevision', 'folio',
      'pdf', 'regreso', 'saldo', 'salida', 'total', 'unidad', 'unidades']);
  cierto('  se le preguntó a EuroSystem por el folio entero',
    AEUROSYSTEM.length === 1 && AEUROSYSTEM[0].cuerpo.folio === 43773);
  igual('  y NO se le preguntó nada a Stripe', ASTRIPE.length, 0);

  /* NI LA LLAVE NI LA DIRECCIÓN DE EUROSYSTEM VIAJAN AL NAVEGADOR. */
  igual('la respuesta no lleva la llave ni la dirección de EuroSystem',
    /llave_del_portal_de_mentiras|eurosystem\.site\/api\/portal/i.test(JSON.stringify(s._json)),
    false);

  /* EL PASE. Es lo que hace que el cobro de después no tenga que creerle
     nada al navegador. */
  cierto('sale un pase firmado', typeof s._json.pase === 'string' && s._json.pase.length > 20);
  const abierto = ligas.abrePortal(s._json.pase);
  igual('el pase dice qué contrato y cuánto se debía',
    [abierto.ok, abierto.contrato, abierto.saldo], [true, 43773, 28000]);
  igual('y la pantalla recibe el mínimo para abonar', s._json.abonoMinimo, saldos.MINIMO_ABONO);

  /* ============ 9. EL 404 Y EL 503, CON LAS MISMAS PALABRAS ============ */
  montaRed({ status: 404, datos: { error: portal.NO_ENCONTRADO } });
  s = await toca({ accion: 'consulta', folio: '43773', apellido: 'Quienquiera' });
  igual('folio o apellido que no cuadran: 404 y las palabras de §12',
    [s._status, s._json.aviso], [404, portal.NO_ENCONTRADO]);
  igual('  y sin pase', s._json.pase, undefined);

  (async function () {
    const guardada = process.env.PORTAL_API_KEY;
    process.env.PORTAL_API_KEY = '';
    montaRed({ status: 200, datos: RESPUESTA });
    const sinLlave = await toca({ accion: 'consulta', folio: '43773', apellido: 'Pérez' });
    igual('sin PORTAL_API_KEY: 503 y NO se toca EuroSystem',
      [sinLlave._status, AEUROSYSTEM.length], [503, 0]);
    igual('  y al cliente no se le nombra la variable',
      /PORTAL_API_KEY|EuroSystem/i.test(JSON.stringify(sinLlave._json)), false);
    process.env.PORTAL_API_KEY = guardada;
  })();

  /* Lo que se teclea se revisa antes de gastar una llamada. */
  montaRed({ status: 200, datos: RESPUESTA });
  s = await toca({ accion: 'consulta', folio: 'ET-AAAA-111', apellido: 'Pérez' });
  igual('un folio con letras: 422 y NO se toca EuroSystem',
    [s._status, AEUROSYSTEM.length], [422, 0]);

  /* ============ 10. EL FRENO: 5 CADA 15 MINUTOS ============
     Lo que se adivina aquí es un apellido, y un apellido se adivina. */
  {
    montaRed({ status: 404, datos: { error: portal.NO_ENCONTRADO } });
    const codigos = [];
    for (let i = 0; i < 6; i++) {
      const cada = await toca({ accion: 'consulta', folio: '43773', apellido: 'Apellido' + i },
        '200.0.0.7');
      codigos.push(cada._status);
    }
    igual('a la sexta consulta desde la misma dirección: 429',
      codigos, [404, 404, 404, 404, 404, 429]);

    const frenada = await toca({ accion: 'consulta', folio: '43773', apellido: 'Otro' }, '200.0.0.7');
    cierto('  y el 429 se dice con palabras, no con un código',
      typeof frenada._json.aviso === 'string' && frenada._json.aviso.length > 10);
    igual('  y frenado ya no se le pregunta a EuroSystem', AEUROSYSTEM.length, 5);
  }

  /* ============ 11. EL COBRO SALE DEL PASE, NO DEL NAVEGADOR ============ */
  {
    const pase = ligas.firmaPortal(43773, 28000);

    montaRed({});
    s = await toca({ pase: pase, monto: 5000 });
    igual('con el pase se abre el cobro: 200 y su liga',
      [s._status, s._json.url], [200, 'https://checkout.stripe.com/c/pay/cs_test_ABONO']);
    igual('  y no se le preguntó nada a EuroSystem', AEUROSYSTEM.length, 0);

    const aStripe = decodeURIComponent(String(ASTRIPE[0].cuerpo).replace(/\+/g, ' '));
    cierto('el cobro va marcado como abono', /metadata\[tipo\]=abono/.test(aStripe));
    cierto('  y lleva el número de contrato de EuroSystem',
      /metadata\[contrato\]=43773/.test(aStripe));
    cierto('  y el monto, para poder sumarlo después', /metadata\[monto\]=5000/.test(aStripe));
    cierto('  y se le cobran los centavos del monto revisado',
      /unit_amount\]=500000/.test(aStripe));

    /* EL CONTRATO NO SE LEE DEL NAVEGADOR. Aunque lo mande, manda el pase. */
    montaRed({});
    s = await toca({ pase: pase, monto: 5000, contrato: 99999, saldo: 999999 });
    const segundo = decodeURIComponent(String(ASTRIPE[0].cuerpo).replace(/\+/g, ' '));
    cierto('el contrato que manda el navegador se ignora',
      /metadata\[contrato\]=43773/.test(segundo) && segundo.indexOf('99999') < 0);

    /* UN PASE INVENTADO NO ABRE NINGÚN COBRO. */
    montaRed({});
    s = await toca({ pase: 'inventado.deveras', monto: 5000 });
    cierto('un pase inventado no abre cobro', s._status >= 400);
    igual('  y no se llama a Stripe', ASTRIPE.length, 0);

    /* EL MONTO SE TOPA CONTRA EL SALDO FIRMADO, no contra el del navegador. */
    montaRed({});
    s = await toca({ pase: pase, monto: 28001 });
    igual('abonar de más: 422 y sin cobro', [s._status, ASTRIPE.length], [422, 0]);

    montaRed({});
    s = await toca({ pase: pase, monto: 50 });
    igual('abonar menos del mínimo: 422 y sin cobro', [s._status, ASTRIPE.length], [422, 0]);
    cierto('  y se dice cuál es el mínimo',
      String(s._json.aviso || '').indexOf(String(saldos.MINIMO_ABONO)) >= 0);

    /* Un pase vencido manda a consultar otra vez, no a un error sin salida. */
    montaRed({});
    const viejo = ligas.firmaPortal(43773, 28000, Date.now() - 2 * 3600000);
    s = await toca({ pase: viejo, monto: 5000 });
    cierto('un pase vencido no cobra', s._status >= 400 && ASTRIPE.length === 0);
    cierto('  y se le dice que vuelva a consultar',
      /consult/i.test(String(s._json.aviso || '')));
  }

  /* ============ 12. NO SE GASTÓ UNA FUNCIÓN DE VERCEL ============ */
  {
    const fs = require('fs');
    const path = require('path');
    const RAIZ = path.join(__dirname, '..');
    const enApi = fs.readdirSync(path.join(RAIZ, 'api'));
    igual('no hay un api/portal.js suelto', enApi.indexOf('portal.js'), -1);
    igual('ni un api/consulta.js', enApi.indexOf('consulta.js'), -1);
    cierto('el motor del portal es módulo interno', enApi.indexOf('_portal.js') >= 0);

    const fuente = fs.readFileSync(path.join(RAIZ, 'api', 'viaje.js'), 'utf8');
    cierto('la consulta se atiende dentro de viaje.js', /accion === 'consulta'/.test(fuente));

    /* Y la variable nueva está documentada donde se buscan las variables. */
    const ejemplo = fs.readFileSync(path.join(RAIZ, '.env.example'), 'utf8');
    cierto('PORTAL_API_KEY está en .env.example', ejemplo.indexOf('PORTAL_API_KEY') >= 0);
  }

  console.log('\n' + buenas + ' buenas, ' + malas + ' malas');
  process.exit(malas ? 1 : 0);
})();
