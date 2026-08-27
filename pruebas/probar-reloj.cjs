/* ============================================================
   El reloj no dice si un correo tiene cuenta
   ------------------------------------------------------------
       node pruebas/probar-reloj.cjs

   POR QUE EXISTE ESTA PRUEBA

   De una revisión de seguridad el 27-ago-2026. Todo el sistema de
   cuentas está escrito para que un correo registrado y uno
   inventado contesten EXACTAMENTE lo mismo: mismo estado, mismo
   mensaje, mismos campos. Se probó campo por campo.

   Y aun así se podía sacar la lista de clientes de la empresa, sin
   leer una sola respuesta. Solo midiendo:

       entrar   correo CON cuenta →  61.7 ms
                correo SIN cuenta →   0.1 ms      661 veces

       olvide   correo CON cuenta →   187 ms
                correo SIN cuenta →    31 ms        6 veces

   Un candado que se abre con un cronómetro no es un candado.

   COMO SE TAPO CADA UNO

   `entrar` con trabajo de verdad: se corre `scrypt` aunque no haya
   cuenta. Sin retrasos falsos, y de paso encarece la fuerza bruta.

   `olvide` con un piso de tiempo en la cáscara: no se le puede
   mandar un correo a nadie, así que se empareja por abajo. Por eso
   ESTA prueba pasa por el ENDPOINT y no por la lógica: el piso vive
   ahí, igual que la cookie.
   ============================================================ */
'use strict';

process.env.LIGAS_SECRETO = 'secreto-de-prueba-para-cuentas-1234567890';
process.env.STRIPE_SECRET_KEY = 'sk_test_x';
process.env.RESEND_API_KEY = 're_x';
process.env.VERCEL_ENV = 'production';

let buenas = 0, malas = 0;
function igual(nombre, dio, esperado) {
  const a = JSON.stringify(dio), b = JSON.stringify(esperado);
  if (a === b) { buenas++; console.log('ok   ' + nombre); }
  else { malas++; console.log('MAL  ' + nombre + '\n     dio      ' + a + '\n     esperaba ' + b); }
}
function cierto(nombre, v) { igual(nombre, !!v, true); }

/* Stripe y el correo con retraso, porque en producción son llamadas de red.
   Sin el retraso la medición diría que no hay diferencia cuando sí la hay. */
const MS_STRIPE = 25, MS_RESEND = 110;
function tarda(ms, v) { return new Promise(function (r) { setTimeout(function () { r(v); }, ms); }); }

let FICHAS = [], CORREOS = [], n = 1;
global.fetch = async function (url, opc) {
  const u = String(url);
  if (u.indexOf('resend') >= 0) {
    await tarda(MS_RESEND);
    CORREOS.push(JSON.parse(opc.body));
    return { ok: true, status: 200, json: async () => ({ id: 'em' }) };
  }
  await tarda(MS_STRIPE);
  if (u.indexOf('/customers?email=') >= 0) {
    const q = decodeURIComponent(u.split('email=')[1].split('&')[0]);
    return { ok: true, status: 200, json: async () => ({ data: FICHAS.filter(f => f.email === q) }) };
  }
  if (/\/customers\/cus_/.test(u)) {
    const id = u.split('/customers/')[1].split('?')[0];
    const f = FICHAS.find(x => x.id === id);
    if (!f) return { ok: false, status: 404, json: async () => ({ error: {} }) };
    if (!opc || opc.method !== 'POST') return { ok: true, status: 200, json: async () => f };
    String(opc.body || '').split('&').forEach(function (p) {
      const i = p.indexOf('='); const k = decodeURIComponent(p.slice(0, i));
      const v = decodeURIComponent(p.slice(i + 1).replace(/\+/g, ' '));
      const m = /^metadata\[(.+)\]$/.exec(k);
      if (m) { if (v === '') delete f.metadata[m[1]]; else f.metadata[m[1]] = v; }
    });
    return { ok: true, status: 200, json: async () => f };
  }
  if (u.indexOf('/customers') >= 0) {
    const f = { id: 'cus_' + String(n++).padStart(14, '0'), metadata: {} };
    String(opc.body || '').split('&').forEach(function (p) {
      const i = p.indexOf('='); const k = decodeURIComponent(p.slice(0, i));
      const v = decodeURIComponent(p.slice(i + 1).replace(/\+/g, ' '));
      const m = /^metadata\[(.+)\]$/.exec(k);
      if (m) { if (v !== '') f.metadata[m[1]] = v; }
      else if (k === 'email') f.email = v; else if (k === 'name') f.name = v;
    });
    FICHAS.push(f);
    return { ok: true, status: 200, json: async () => f };
  }
  throw new Error('inesperado: ' + u);
};

const handler = require('../api/cuenta.js');
const logica = require('../api/_cuentas-logica.js');

/* Un `req`/`res` de mentiras, los mínimos que la cáscara necesita.

   CADA PETICION LLEGA DE UNA DIRECCION DISTINTA a propósito: el freno de la
   puerta cuenta por dirección, y si todas vinieran de la misma, a la quinta
   contestaría 429 y estaríamos midiendo el freno en vez del reloj. La primera
   versión de esta prueba hacía justo eso. */
let deQuien = 0;
function pide(cuerpo) {
  deQuien++;
  return new Promise(function (listo) {
    const req = {
      method: 'POST',
      headers: { origin: 'https://eurotravel-web.vercel.app',
        'x-vercel-forwarded-for': '203.0.' + Math.floor(deQuien / 250) + '.' + (deQuien % 250) },
      body: cuerpo
    };
    let estado = 200;
    const res = {
      setHeader: function () { return res; },
      status: function (s) { estado = s; return res; },
      json: function (d) { listo({ status: estado, datos: d }); return res; },
      end: function () { listo({ status: estado, datos: null }); return res; }
    };
    handler(req, res);
  });
}

function mediana(a) { const b = a.slice().sort(function (x, y) { return x - y; }); return b[Math.floor(b.length / 2)]; }

(async function () {

  /* Cuentas frescas: el freno de la ficha aplana los intentos repetidos
     contra la MISMA cuenta, así que quien ataca probaría una distinta cada
     vez. Eso es lo que hay que medir. */
  const registrados = [];
  for (let i = 0; i < 6; i++) {
    const correo = 'cliente' + i + '@ejemplo.mx';
    await logica.crear({ correo: correo, contrasena: 'la contraseña buena', nombre: 'Cliente ' + i });
    const cod = /\b(\d{6})\b/.exec(CORREOS[CORREOS.length - 1].text)[1];
    await logica.confirmar({ correo: correo, codigo: cod });
    registrados.push(correo);
  }

  /* ============ «OLVIDE MI CONTRASEÑA», POR LA PUERTA ============ */
  {
    const con = [], sin = [];
    for (let i = 0; i < 6; i++) {
      let t = Date.now();
      const a = await pide({ accion: 'olvide', correo: registrados[i] });
      con.push(Date.now() - t);
      igual('el registrado contesta 200', a.status, 200);

      t = Date.now();
      const b = await pide({ accion: 'olvide', correo: 'inventado' + i + '@ejemplo.mx' });
      sin.push(Date.now() - t);
      igual('y el inventado exactamente lo mismo', b.cuerpo === undefined ? b.status : b.status, a.status);
    }

    const a = mediana(con), b = mediana(sin);
    /* La proporción, no un número de milisegundos: en otra máquina los
       retrasos fingidos pesan distinto y un tope fijo se pondría rojo sin que
       nada esté mal. */
    const proporcion = b / a;
    cierto('con cuenta y sin cuenta tardan casi igual' +
      '  (con ' + a + ' ms · sin ' + b + ' ms)', proporcion > 0.85);
    cierto('y las dos por arriba del piso', a >= 1150 && b >= 1150);
  }

  /* ============ ENTRAR, POR LA PUERTA ============
     Aquí no hay piso: lo que empareja es `scrypt`, que corre haya cuenta o
     no. Si alguien lo quita, esto se pone rojo. */
  {
    const con = [], sin = [];
    for (let i = 0; i < 5; i++) {
      let t = process.hrtime.bigint();
      await pide({ accion: 'entrar', correo: registrados[0], contrasena: 'no es la buena' });
      con.push(Number(process.hrtime.bigint() - t) / 1e6);

      t = process.hrtime.bigint();
      await pide({ accion: 'entrar', correo: 'noexiste@ejemplo.mx', contrasena: 'no es la buena' });
      sin.push(Number(process.hrtime.bigint() - t) / 1e6);
    }
    const a = mediana(con), b = mediana(sin);
    cierto('entrar tarda casi igual con cuenta que sin ella' +
      '  (con ' + a.toFixed(0) + ' ms · sin ' + b.toFixed(0) + ' ms)', (b / a) > 0.6);
    cierto('y las dos cuestan trabajo de verdad', a > 20 && b > 20);
  }

  console.log('\n' + buenas + ' buenas, ' + malas + ' malas');
  process.exit(malas ? 1 : 0);
})();
