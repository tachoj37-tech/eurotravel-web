/* ============================================================
   LA CONTINUACIÓN DEL SALESBOT SE REINTENTA UNA VEZ (22-sep-2026)
   ============================================================
   Si `continuaSalesbot` no llega a Kommo, el bot se queda esperando y el
   cliente sin respuesta: Kommo no reintenta. Un tropiezo de red o un 5xx
   se reintenta UNA vez; un 4xx (token viejo, return_url caducado) no,
   porque fallaría igual.
   ============================================================ */
'use strict';

const path = require('path');
process.env.KOMMO_SUBDOMINIO = 'eurotravel';
process.env.KOMMO_TOKEN = 'token-de-mentiras';
const kommo = require(path.join(__dirname, '..', 'api', '_kommo.js'));

let buenas = 0, malas = 0;
function ok(que, condicion) {
  if (condicion) { buenas++; console.log('ok   ' + que); }
  else { malas++; console.log('FALLA ' + que); }
}
const URL_RETORNO = 'https://eurotravel.kommo.com/api/v4/salesbot/84760/continue/abc';
const CUERPO = { data: { status: 'sigue', texto: 'hola' }, execute_handlers: [{ handler: 'goto', params: { type: 'question', step: 1 } }] };

/* Un `pide` de mentiras que contesta según una lista, en orden. */
function pideQue(respuestas) {
  const llamadas = [];
  const pide = async function (url, opciones) {
    llamadas.push({ url: url, body: opciones.body });
    const r = respuestas.shift();
    if (r instanceof Error) throw r;
    return { ok: r >= 200 && r < 300, status: r, text: async function () { return 'detalle ' + r; } };
  };
  pide.llamadas = llamadas;
  return pide;
}

(async function () {
  let pide = pideQue([200]);
  ok('a la primera: una sola llamada y true', await kommo.continuaSalesbot(URL_RETORNO, CUERPO, { pide: pide }) === true && pide.llamadas.length === 1);
  ok('  con el cuerpo tal cual', JSON.parse(pide.llamadas[0].body).data.texto === 'hola');

  pide = pideQue([new Error('fetch failed'), 200]);
  ok('tropiezo de red: se reintenta una vez y llega', await kommo.continuaSalesbot(URL_RETORNO, CUERPO, { pide: pide }) === true && pide.llamadas.length === 2);

  pide = pideQue([502, 200]);
  ok('502 de Kommo: se reintenta una vez y llega', await kommo.continuaSalesbot(URL_RETORNO, CUERPO, { pide: pide }) === true && pide.llamadas.length === 2);

  pide = pideQue([new Error('fetch failed'), new Error('fetch failed'), 200]);
  ok('dos tropiezos seguidos: solo dos intentos y false', await kommo.continuaSalesbot(URL_RETORNO, CUERPO, { pide: pide }) === false && pide.llamadas.length === 2);

  pide = pideQue([401, 200]);
  ok('401 (token viejo): NO se reintenta, false a la primera', await kommo.continuaSalesbot(URL_RETORNO, CUERPO, { pide: pide }) === false && pide.llamadas.length === 1);

  pide = pideQue([404, 200]);
  ok('404 (return_url caducado): NO se reintenta', await kommo.continuaSalesbot(URL_RETORNO, CUERPO, { pide: pide }) === false && pide.llamadas.length === 1);

  console.log('\n' + buenas + ' buenas, ' + malas + ' malas');
  process.exit(malas ? 1 : 0);
})();
