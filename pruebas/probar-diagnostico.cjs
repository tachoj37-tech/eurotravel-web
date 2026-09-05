/* ============================================================
   El candado de /api/diagnostico
   ------------------------------------------------------------
       node pruebas/probar-diagnostico.cjs

   Esa puerta dice si Stripe está en producción, cuánto miden las
   claves y gasta cuota de Google y correos. La cabecera de origen
   NO la protege de curl a mano —una tanda de clientes de prueba
   lo confirmó el 26-ago-2026—. Así que va con clave y FALLA
   CERRADA: sin CLAVE_DIAGNOSTICO no abre para nadie.
   ============================================================ */
'use strict';

let buenas = 0, malas = 0;
function igual(nombre, dio, esperado) {
  if (JSON.stringify(dio) === JSON.stringify(esperado)) { buenas++; console.log('ok   ' + nombre); }
  else { malas++; console.log('MAL  ' + nombre + '\n     dio      ' + JSON.stringify(dio) +
    '\n     esperaba ' + JSON.stringify(esperado)); }
}

/* Nadie debe llamar de verdad a Google ni a Resend en esta prueba: el candado
   se resuelve ANTES de gastar un recurso. Si algo llama a fetch, es un bug. */
let fetchLlamado = false;
global.fetch = function () { fetchLlamado = true; return Promise.reject(new Error('no debió llamarse')); };

/* Se movio a `pendiente/` el 2-sep-2026 para dejarle su lugar de
   funcion al webhook de WhatsApp: el plan Hobby deja 12 y era la 13.
   El dueno lo autorizo. Sigue probado desde aqui. */
const handler = require('../pendiente/diagnostico.js');

function req(clave) {
  return { method: 'POST', headers: { origin: 'https://eurotravel-web.vercel.app' },
    body: clave === undefined ? {} : { clave: clave } };
}
function res() {
  const r = { _status: null, _json: null };
  r.status = function (s) { r._status = s; return r; };
  r.json = function (j) { r._json = j; return r; };
  return r;
}

(async function () {
  /* --- sin CLAVE_DIAGNOSTICO configurada: cerrada para todos --- */
  delete process.env.CLAVE_DIAGNOSTICO;
  let r = res();
  await handler(req('lo que sea'), r);
  igual('sin variable configurada: 401', r._status, 401);
  igual('y lo dice sin filtrar datos', r._json.error, 'sin clave');
  igual('sin variable, no se gasta ni una llamada', fetchLlamado, false);

  /* --- con clave configurada pero incorrecta --- */
  process.env.CLAVE_DIAGNOSTICO = 'la-buena-123';
  fetchLlamado = false;
  r = res();
  await handler(req('la-mala'), r);
  igual('clave incorrecta: 401', r._status, 401);
  igual('no dice si la variable existe o no', r._json.error, 'clave incorrecta');
  igual('clave mala, tampoco gasta llamadas', fetchLlamado, false);

  /* --- sin mandar clave --- */
  fetchLlamado = false;
  r = res();
  await handler(req(), r);
  igual('sin mandar clave: 401', r._status, 401);
  igual('sin clave, no gasta llamadas', fetchLlamado, false);

  console.log('\n' + buenas + ' buenas, ' + malas + ' malas');
  process.exit(malas ? 1 : 0);
})();
