/* ============================================================
   Pruebas de las defensas — sin red, sin navegador
   ------------------------------------------------------------
       node pruebas/probar-defensas.cjs

   Lo que mas importa aqui: el ataque que EuroSystem pago. Rotar
   el PRIMER x-forwarded-for no debe librar el freno; fijar la IP
   real del borde si debe frenarlo. Si esta prueba pasa, el hueco
   que motivo esta consolidacion esta cerrado.
   ============================================================ */
'use strict';
const D = require('../api/_defensas.js');

let buenas = 0, malas = 0;
function igual(nombre, dio, esperado) {
  const a = JSON.stringify(dio), b = JSON.stringify(esperado);
  if (a === b) { buenas++; console.log('ok   ' + nombre); }
  else { malas++; console.log('MAL  ' + nombre + '\n     dio      ' + a + '\n     esperaba ' + b); }
}
function cierto(nombre, v) { igual(nombre, !!v, true); }

function req(headers, method) {
  return { headers: headers || {}, method: method || 'POST' };
}
/* un res de mentiras que recuerda con que lo llamaron */
function res() {
  const r = { _status: null, _json: null, _ended: false };
  r.status = function (s) { r._status = s; return r; };
  r.json = function (j) { r._json = j; return r; };
  r.end = function () { r._ended = true; return r; };
  return r;
}

/* ---------------- la IP de confianza: el corazon ------------------------ */
igual('sin cabeceras: sin-ip',
  D.ipDeConfianza(req({})), 'sin-ip');

igual('x-vercel-forwarded-for manda sobre todo',
  D.ipDeConfianza(req({ 'x-vercel-forwarded-for': '9.9.9.9', 'x-forwarded-for': '1.1.1.1, 2.2.2.2' })),
  '9.9.9.9');

igual('sin vercel: se toma el ULTIMO x-forwarded-for, no el primero',
  D.ipDeConfianza(req({ 'x-forwarded-for': 'cliente-mentiroso, 2.2.2.2, 3.3.3.3-borde' })),
  '3.3.3.3-borde');

/* EL ATAQUE. Quien ataca rota el primer valor en cada peticion. Como el freno
   cuenta por la IP de confianza (el ultimo), las 40 peticiones caen en la
   MISMA clave y el freno de 30 salta. Si contara por el primero, jamas. */
(function () {
  const freno = D.creaFreno({ porMinuto: 30, porDia: 10000 });
  let frenadas = 0;
  for (let i = 0; i < 40; i++) {
    const r = freno(req({ 'x-forwarded-for': 'atacante-' + i + ', 3.3.3.3-borde' }));
    if (r && r.status === 429) frenadas++;
  }
  cierto('rotar el primer x-forwarded-for NO libra el freno (>=10 frenadas)', frenadas >= 10);
})();

/* Y el caso honesto: un visitante real detras del mismo borde tampoco se pasa. */
(function () {
  const freno = D.creaFreno({ porMinuto: 5, porDia: 10000 });
  const cab = { 'x-vercel-forwarded-for': '8.8.8.8' };
  const codigos = [];
  for (let i = 0; i < 7; i++) { const r = freno(req(cab)); codigos.push(r ? r.status : 'ok'); }
  igual('5 por minuto: las primeras 5 pasan, la 6 y 7 se frenan',
    codigos, ['ok', 'ok', 'ok', 'ok', 'ok', 429, 429]);
})();

/* dos IPs distintas no se estorban */
(function () {
  const freno = D.creaFreno({ porMinuto: 2, porDia: 10000 });
  freno(req({ 'x-vercel-forwarded-for': 'A' }));
  freno(req({ 'x-vercel-forwarded-for': 'A' }));
  const aFrenada = freno(req({ 'x-vercel-forwarded-for': 'A' }));
  const bLibre = freno(req({ 'x-vercel-forwarded-for': 'B' }));
  cierto('la IP A ya frenada', aFrenada && aFrenada.status === 429);
  igual('la IP B sigue libre', bLibre, null);
})();

/* el tope diario, aparte del de minuto */
(function () {
  const freno = D.creaFreno({ porMinuto: 10000, porDia: 3 });
  const codigos = [];
  for (let i = 0; i < 5; i++) { const r = freno(req({ 'x-vercel-forwarded-for': 'x' + i })); codigos.push(r ? r.status : 'ok'); }
  igual('tope diario de 3: la 4a y 5a caen aunque sean IPs distintas',
    codigos, ['ok', 'ok', 'ok', 429, 429]);
})();

/* ---------------- la puerta -------------------------------------------- */
(function () {
  const r = res();
  const corto = D.puerta(req({}, 'OPTIONS'), r, {});
  cierto('OPTIONS: contesta 204 y corta', corto && r._status === 204 && r._ended);
})();
(function () {
  const r = res();
  const corto = D.puerta(req({ origin: 'https://eurotravel-web.vercel.app' }, 'GET'), r, {});
  cierto('GET donde solo se permite POST: 405', corto && r._status === 405);
})();
(function () {
  const r = res();
  const corto = D.puerta(req({ origin: 'https://sitio-malo.example' }, 'POST'), r, {});
  cierto('origen ajeno: 403', corto && r._status === 403);
})();
(function () {
  const r = res();
  const corto = D.puerta(req({ origin: 'https://eurotravel-web.vercel.app' }, 'POST'), r, {});
  igual('origen bueno y POST: deja pasar (no corta)', corto, false);
})();
(function () {
  const r = res();
  const corto = D.puerta(req({ origin: 'https://eurotravel-web.vercel.app' }, 'GET'), r, { metodos: ['GET'] });
  igual('GET permitido explicitamente: deja pasar', corto, false);
})();

/* ---------------- origen y sitio -------------------------------------- */
cierto('origenValido por referer con ruta',
  D.origenValido(req({ referer: 'https://eurotravel-web.vercel.app/#/cotizar' })));
igual('sitioDe reconoce localhost',
  D.sitioDe(req({ origin: 'http://localhost:5175' })), 'http://localhost:5175');
igual('sitioDe cae al primero si no reconoce',
  D.sitioDe(req({ origin: 'https://otro.example' })), 'https://eurotravel-web.vercel.app');

/* ---------------- cuerpoJSON ------------------------------------------ */
igual('cuerpoJSON con objeto', D.cuerpoJSON({ body: { a: 1 } }), { a: 1 });
igual('cuerpoJSON con texto', D.cuerpoJSON({ body: '{"a":2}' }), { a: 2 });
igual('cuerpoJSON con basura no revienta', D.cuerpoJSON({ body: 'no-json' }), {});
igual('cuerpoJSON sin cuerpo', D.cuerpoJSON({}), {});

console.log('\n' + buenas + ' buenas, ' + malas + ' malas');
process.exit(malas ? 1 : 0);
