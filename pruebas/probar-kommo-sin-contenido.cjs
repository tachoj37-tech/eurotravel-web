/* ============================================================
   KOMMO CONTESTA «NO HAY NADA NUEVO» (204) — 21-sep-2026
   ============================================================
   El registro de precios lee cada 15 minutos los leads que cambiaron.
   Cuando no cambió ninguno, Kommo contesta 204 SIN cuerpo, y `pide()`
   hacía `r.json()` sobre la nada: «Unexpected end of JSON input». El
   error se contaba como falla, el resumen decía `leads: 0` y nadie podía
   distinguir «no hubo nada» de «está roto». Visto en la revisión del
   lunes: el aprendizaje de precios estuvo ciego toda la semana y el
   registro no dejaba saber cuánto era por esto y cuánto por el token.

   Un 204 es éxito sin datos: se devuelve un objeto vacío, que los que
   leen la lista ya entienden como «cero leads», y sin gritar error.
   ============================================================ */
'use strict';

const path = require('path');
const RAIZ = path.join(__dirname, '..');
process.env.KOMMO_SUBDOMINIO = 'eurotravel';
process.env.KOMMO_TOKEN = 'token-de-mentiras';
const kommo = require(path.join(RAIZ, 'api/_kommo.js'));

let buenas = 0, malas = 0;
function ok(que, condicion) {
  if (condicion) { buenas++; console.log('ok   ' + que); }
  else { malas++; console.log('FALLA ' + que); }
}

function respuesta(status, cuerpo) {
  return async function () {
    return {
      ok: status >= 200 && status < 300, status: status,
      json: async function () { if (cuerpo === undefined) throw new SyntaxError('Unexpected end of JSON input'); return cuerpo; },
      text: async function () { return cuerpo === undefined ? '' : JSON.stringify(cuerpo); }
    };
  };
}

(async function () {
  const errores = [];
  const original = console.error;
  console.error = function () { errores.push(Array.prototype.join.call(arguments, ' ')); };

  const vacio = await kommo.pide('/leads?limit=50', { pide: respuesta(204) });
  ok('un 204 es éxito sin datos, no una falla', vacio !== null && typeof vacio === 'object');
  ok('  y no se registra como error', errores.length === 0);

  const lleno = await kommo.pide('/leads?limit=50', { pide: respuesta(200, { _embedded: { leads: [{ id: 1 }] } }) });
  ok('un 200 sigue devolviendo sus datos', lleno && lleno._embedded.leads[0].id === 1);

  const roto = await kommo.pide('/leads?limit=50', { pide: respuesta(401, { title: 'Unauthorized' }) });
  ok('un 401 sigue siendo falla (null), como siempre', roto === null);
  ok('  y ése sí se registra', errores.length === 1 && /401/.test(errores[0]));

  console.error = original;
  console.log('\n' + buenas + ' buenas, ' + malas + ' malas');
  process.exit(malas ? 1 : 0);
})();
