/* ============================================================
   KOMMO EN DOS TIEMPOS · LOS 2 SEGUNDOS (12-sep-2026)
   ============================================================
   Kommo exige un 200 en DOS SEGUNDOS, y la IA tarda más. El bot, hasta
   hoy, hace todo el trabajo ANTES de contestar —a Meta le da igual
   esperar— así que para Kommo el camino se parte en dos invocaciones:

     /api/whatsapp/kommo           recibe, dispara y contesta. Rápido.
     /api/whatsapp/kommo-trabajo   hace el trabajo. Con su tiempo.

   Lo que esta batería cuida, y por qué cada cosa:

     · QUE LA PRIMERA CONTESTE RÁPIDO. Es el requisito entero. Si un día
       alguien mete una llamada lenta ahí, Kommo empieza a dar el aviso
       por fallido y a reintentar.
     · QUE LA SEGUNDA LLEVE LLAVE. Es una URL que gasta dinero: si fuera
       pública, cualquiera podría disparar llamadas a la IA a costa del
       dueño.
     · QUE APAGADO NO EXISTA. Mientras el bot viva en Dualhook, esa
       puerta contesta 404 como cualquier dirección que no lleva a nada.

   Todo con puertas de mentiras: no se llama a Kommo ni a la IA.
   ============================================================ */
'use strict';

const path = require('path');
const RAIZ = path.join(__dirname, '..');

let buenas = 0, malas = 0;
function ok(que, condicion) {
  if (condicion) { buenas++; console.log('ok   ' + que); }
  else { malas++; console.log('FALLA ' + que); }
}
function titulo(t) { console.log('\n== ' + t.toUpperCase() + ' =='); }

/* Una respuesta de Node de mentiras, que apunta lo que le mandan. */
function respuesta() {
  const r = { codigo: null, cuerpo: null };
  r.status = function (c) { r.codigo = c; return r; };
  r.json = function (x) { r.cuerpo = x; return r; };
  r.send = function (x) { r.cuerpo = x; return r; };
  return r;
}
/* Dos detalles de cómo llega una petición en Vercel, y los dos costaron
   una vuelta en falso al escribir esta batería:
   · la llave del rewrite viaja en `req.query`, no en la URL
   · `crudoDeNode` acepta `rawBody` directo, que es lo que Vercel pone
     cuando ya leyó el cuerpo */
function peticion(cuerpo, cabeceras, llave) {
  const texto = typeof cuerpo === 'string' ? cuerpo : JSON.stringify(cuerpo || {});
  return {
    method: 'POST',
    headers: Object.assign({ 'content-type': 'application/json' }, cabeceras || {}),
    url: '/api/whatsapp',
    query: { llave: llave || 'kommo' },
    rawBody: texto
  };
}

(async function () {
  process.env.SITIO_URL = 'https://eurotravel-web.vercel.app';
  process.env.WHATSAPP_RUTA_SECRETA = 'a'.repeat(48);

  titulo('con Kommo apagado, la puerta no existe');
  {
    delete process.env.KOMMO_SUBDOMINIO;
    delete process.env.KOMMO_TOKEN;
    delete require.cache[require.resolve(path.join(RAIZ, 'api/_kommo.js'))];
    const mod = await import('file://' + path.join(RAIZ, 'api/whatsapp.mjs').replace(/\\/g, '/') +
      '?v=' + Date.now());
    const atiende = mod.default;

    const b = respuesta();
    await atiende(peticion({ leads: {} }), b);
    ok('contesta 404', b.codigo === 404);
  }

  titulo('encendido, la primera puerta contesta rápido');
  {
    process.env.KOMMO_SUBDOMINIO = 'eurotravel';
    process.env.KOMMO_TOKEN = 'token-de-mentiras';
    delete require.cache[require.resolve(path.join(RAIZ, 'api/_kommo.js'))];

    /* La segunda puerta, de mentiras: apunta qué le llegó y tarda a
       propósito, para comprobar que la primera NO la espera. */
    const disparos = [];
    const antesFetch = global.fetch;
    global.fetch = function (url, init) {
      disparos.push({ url: String(url), init: init || {} });
      return new Promise(function (_, rechaza) {
        /* Como el trabajo de verdad: tarda más que el tope del disparo. */
        setTimeout(function () {
          const e = new Error('abortado'); e.name = 'TimeoutError'; rechaza(e);
        }, 750);
      });
    };

    const mod = await import('file://' + path.join(RAIZ, 'api/whatsapp.mjs').replace(/\\/g, '/') +
      '?v=' + Date.now());
    const atiende = mod.default;

    const arranque = Date.now();
    const b = respuesta();
    await atiende(peticion({ leads: { status: [{ id: 99 }] } }), b);
    const tardo = Date.now() - arranque;

    ok('contesta 200', b.codigo === 200);
    /* Lo que de verdad importa: DOS SEGUNDOS. Se pide con holgura —el
       tope del disparo son 700 ms— porque una máquina cargada tarda más
       que una en reposo, y una prueba que falla sola no sirve de nada. */
    ok('  y tarda menos de 2 segundos (tardó ' + tardo + ' ms)', tardo < 2000);

    ok('disparó el trabajo a la segunda puerta', disparos.length === 1);
    ok('  a la dirección que es',
      /\/api\/whatsapp\/kommo-trabajo$/.test(disparos[0] ? disparos[0].url : ''));
    ok('  con la llave interna',
      !!(disparos[0] && disparos[0].init.headers &&
         disparos[0].init.headers['x-interno'] === process.env.WHATSAPP_RUTA_SECRETA));
    ok('  y con el aviso entero, no vacío',
      !!(disparos[0] && /"leads"/.test(String(disparos[0].init.body || ''))));

    global.fetch = antesFetch;
  }

  titulo('la segunda puerta va con llave');
  {
    process.env.KOMMO_SUBDOMINIO = 'eurotravel';
    process.env.KOMMO_TOKEN = 'token-de-mentiras';
    const mod = await import('file://' + path.join(RAIZ, 'api/whatsapp.mjs').replace(/\\/g, '/') +
      '?v=' + Date.now());
    const atiende = mod.default;

    const sinLlave = respuesta();
    const req1 = peticion({ hola: 1 }, {}, 'kommo-trabajo');
    await atiende(req1, sinLlave);
    ok('sin la llave, 404', sinLlave.codigo === 404);

    const conOtra = respuesta();
    const req2 = peticion({ hola: 1 }, { 'x-interno': 'b'.repeat(48) }, 'kommo-trabajo');
    await atiende(req2, conOtra);
    ok('con una llave equivocada, 404', conOtra.codigo === 404);

    const buena = respuesta();
    const req3 = peticion({ hola: 1 }, { 'x-interno': process.env.WHATSAPP_RUTA_SECRETA }, 'kommo-trabajo');
    await atiende(req3, buena);
    ok('con la llave buena, 200', buena.codigo === 200);
  }

  titulo('sin SITIO_URL no se queda callado');
  {
    const antes = process.env.SITIO_URL;
    delete process.env.SITIO_URL;
    const mod = await import('file://' + path.join(RAIZ, 'api/whatsapp.mjs').replace(/\\/g, '/') +
      '?v=' + Date.now());
    const atiende = mod.default;
    const b = respuesta();
    await atiende(peticion({ leads: {} }), b);
    /* Contesta 200 igual —Kommo no tiene la culpa— pero el registro lo
       dice, que es lo que permite arreglarlo. */
    ok('contesta 200 aunque no pueda disparar', b.codigo === 200);
    process.env.SITIO_URL = antes;
  }

  console.log('\n' + buenas + ' buenas, ' + malas + ' malas');
  process.exit(malas ? 1 : 0);
})();
