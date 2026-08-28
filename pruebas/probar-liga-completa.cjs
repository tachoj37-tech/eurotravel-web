/* ============================================================
   El camino de la liga, de punta a punta
   ------------------------------------------------------------
       node pruebas/probar-liga-completa.cjs

   POR QUE EXISTE

   El 27-ago-2026 se le metió mano a lo más delicado del proyecto:
   el resumen del código de seis dígitos y el contenido de la
   cookie de sesión, para que un permiso de «ver un viaje» no
   pudiera hacerse pasar por uno de cuenta.

   Cada pieza tiene sus pruebas y todas quedaron verdes. Pero las
   piezas verdes no son un camino que funciona: el cliente que pagó
   recorre CUATRO puertas seguidas —abrir su liga, pedir su código,
   teclearlo, y ver su viaje— y lo que importa es que ese recorrido
   entero siga en pie.

   Esta prueba lo camina completo, por los endpoints de verdad.
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

const CLIENTE = 'cus_00000000000001';
const SESION = 'cs_test_' + '7'.repeat(20);
const FICHA = { id: CLIENTE, email: 'ana@ejemplo.mx', name: 'Ana Ruiz', metadata: {} };
const COBRO = {
  id: SESION, customer: CLIENTE, payment_status: 'paid', status: 'complete',
  customer_details: { email: 'ana@ejemplo.mx' },
  metadata: {
    folio: 'ET-4242', nombre: 'Ana Ruiz', destino: 'Chapala', origen: 'Guadalajara',
    salida: '2026-09-10', regreso: '2026-09-10', total: 6500, anticipo: 3250, saldo: 3250,
    unidad: 'Sprinter', km: 100
  }
};
let CORREOS = [];

global.fetch = async function (url, opc) {
  const u = String(url);
  if (u.indexOf('/checkout/sessions/') >= 0) {
    return { ok: true, status: 200, json: async () => COBRO };
  }
  if (/\/customers\/cus_/.test(u)) {
    if (!opc || opc.method !== 'POST') return { ok: true, status: 200, json: async () => FICHA };
    String(opc.body || '').split('&').forEach(function (p) {
      const i = p.indexOf('='); const k = decodeURIComponent(p.slice(0, i));
      const v = decodeURIComponent(p.slice(i + 1).replace(/\+/g, ' '));
      const m = /^metadata\[(.+)\]$/.exec(k);
      if (m) { if (v === '') delete FICHA.metadata[m[1]]; else FICHA.metadata[m[1]] = v; }
    });
    return { ok: true, status: 200, json: async () => FICHA };
  }
  if (u.indexOf('resend') >= 0) {
    CORREOS.push(JSON.parse(opc.body));
    return { ok: true, status: 200, json: async () => ({ id: 'em' }) };
  }
  throw new Error('inesperado: ' + u);
};

const ligas = require('../api/_ligas.js');
const acceso = require('../api/_acceso.js');

/* Un `req`/`res` de mentiras, y la galleta que va quedando. */
let GALLETA = '';
function pide(archivo, cuerpo) {
  return new Promise(function (listo) {
    const handler = require('../api/' + archivo);
    const req = {
      method: 'POST',
      headers: {
        origin: 'https://eurotravel-web.vercel.app',
        'x-vercel-forwarded-for': '203.0.113.5',
        cookie: GALLETA ? ('ev=' + GALLETA) : ''
      },
      body: cuerpo
    };
    let estado = 200;
    const res = {
      setHeader: function (k, v) {
        if (String(k).toLowerCase() === 'set-cookie') {
          const m = /^ev=([^;]*)/.exec(String(v));
          if (m) GALLETA = m[1];
        }
        return res;
      },
      status: function (s) { estado = s; return res; },
      json: function (d) { listo({ status: estado, datos: d }); return res; },
      end: function () { listo({ status: estado, datos: null }); return res; }
    };
    handler(req, res);
  });
}

(async function () {
  /* La liga que le llegó por correo al pagar. */
  const liga = ligas.ligaDelViaje('https://eurotravel-web.vercel.app', SESION, '2026-09-10');
  const t = liga.split('t=')[1];
  cierto('la liga se arma', !!t);

  /* --- 1 · abre su liga: todavía no ha comprobado que el correo es suyo ---
     Contesta 200 y NO es un descuido: no ha pasado nada malo, simplemente le
     falta el código. Igual que `yo` contesta 200 con `dentro:false`. Mi
     primera versión de esta prueba esperaba un 401 y estaba equivocada.

     Lo que sí importa —y es lo que se comprueba— es que en esa respuesta NO
     venga ni un dato del viaje. */
  const primerVistazo = await pide('viaje.js', { t: t });
  igual('sin código contesta, y no es un error', primerVistazo.status, 200);
  cierto('pide el código', (primerVistazo.datos || {}).requiereCodigo);
  cierto('y le dice a dónde le va a llegar',
    /\*/.test(String((primerVistazo.datos || {}).correo || '')));

  const asomo = JSON.stringify(primerVistazo.datos || {});
  falso('sin el código NO se asoma el folio', /ET-4242/.test(asomo));
  falso('ni el destino', /Chapala/.test(asomo));
  falso('ni los montos', /6500|3250/.test(asomo));
  falso('ni el correo completo', /ana@ejemplo\.mx/.test(asomo));

  /* --- 2 · pide su código --- */
  const pedido = await pide('pedir-codigo.js', { t: t });
  igual('pedir el código funciona', pedido.status, 200);
  igual('y sale UN correo', CORREOS.length, 1);
  const codigo = /\b(\d{6})\b/.exec(CORREOS[0].text)[1];

  /* --- 3 · lo teclea --- */
  const malo = await pide('verificar-codigo.js', { t: t, codigo: '000000' });
  igual('un código equivocado no abre', malo.status, 401);
  falso('y no enseña nada del viaje', /ET-4242|Chapala/.test(JSON.stringify(malo.datos || {})));

  const bueno = await pide('verificar-codigo.js', { t: t, codigo: codigo });
  igual('el bueno sí', bueno.status, 200);
  igual('y ya ve su viaje', (bueno.datos || {}).folio, 'ET-4242');
  cierto('con su galleta puesta', !!GALLETA);

  /* --- 4 · y desde ahí su viaje abre sin volver a pedir código --- */
  const otraVez = await pide('viaje.js', { t: t });
  igual('con la sesión, la liga ya abre directo', otraVez.status, 200);
  igual('y es su viaje', (otraVez.datos || {}).folio, 'ET-4242');

  /* --- LO QUE NO PUEDE PASAR ---
     Esa misma galleta es la de «ver un viaje». Que NO valga como sesión de
     cuenta es el arreglo del 27-ago-2026, y aquí se comprueba en el camino
     completo y no solo en la pieza suelta. */
  const comoCuenta = await pide('cuenta.js', { accion: 'yo' });
  falso('esa galleta NO entra a la cuenta', (comoCuenta.datos || {}).dentro);

  const susViajes = await pide('cuenta.js', { accion: 'mis-viajes' });
  igual('ni ve «Mis viajes»', (susViajes.datos || {}).viajes, []);

  /* Y el código que se le dictó tampoco cambia la contraseña de la cuenta.
     Se pide otro, porque el de arriba ya se usó. */
  CORREOS = [];
  await pide('pedir-codigo.js', { t: t });
  const dictado = /\b(\d{6})\b/.exec(CORREOS[0].text)[1];
  const intento = await pide('cuenta.js', {
    accion: 'clave-nueva', correo: 'ana@ejemplo.mx', codigo: dictado, nueva: 'una contraseña larga'
  });
  falso('el código dictado NO cambia la contraseña de la cuenta', intento.status === 200);
  falso('ni abre sesión de cuenta', (intento.datos || {}).ok);

  console.log('\n' + buenas + ' buenas, ' + malas + ' malas');
  process.exit(malas ? 1 : 0);
})();
