/* Que el aviso de errores reporte lo que debe y CALLE lo que debe.
   ------------------------------------------------------------------
   Esto no se puede mirar a ojo: la decision vive dentro de errores.js
   y solo se nota en produccion, con un cliente enfrente. Aqui se
   corre el archivo de verdad en un navegador de mentiras y se revisa
   que salio por el cable. */

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const FUENTE = fs.readFileSync(path.join(__dirname, '..', 'errores.js'), 'utf8');
const BUZON = 'ingest.us.sentry.io';

let buenas = 0, malas = 0;
function ok(que, dio, esperaba) {
  const bien = JSON.stringify(dio) === JSON.stringify(esperaba);
  if (bien) { buenas++; console.log('ok   ' + que); }
  else {
    malas++;
    console.log('MAL  ' + que);
    console.log('     dio      ' + JSON.stringify(dio));
    console.log('     esperaba ' + JSON.stringify(esperaba));
  }
}

/* Monta un navegador de mentiras, corre errores.js dentro, y
   devuelve con que se puede jugar. `respuestas` dice que contesta
   cada ruta: un numero es el estado, un Error es que se cayo. */
function navegador(direccion, respuestas) {
  const avisos = [];      // lo que salio hacia Sentry
  const pedidas = [];     // todas las peticiones que se hicieron

  function fetchDeFabrica(entrada, opciones) {
    const url = String(typeof entrada === 'string' ? entrada : entrada.url);
    pedidas.push(url);
    if (url.indexOf(BUZON) !== -1) {
      avisos.push(JSON.parse(String(opciones.body).split('\n')[2]));
      return Promise.resolve({ status: 200, ok: true });
    }
    const q = respuestas ? respuestas[new URL(url, direccion).pathname] : 200;
    if (q instanceof Error) return Promise.reject(q);
    return Promise.resolve({ status: q || 200, ok: (q || 200) < 400 });
  }

  const oyentes = {};
  const ventana = {
    fetch: fetchDeFabrica,
    addEventListener: function (n, f) { (oyentes[n] = oyentes[n] || []).push(f); },
    crypto: require('crypto').webcrypto,
    location: new URL(direccion),
    navigator: { userAgent: 'prueba' },
    URL: URL,
    Date: Date,
    Math: Math,
    JSON: JSON,
    Uint8Array: Uint8Array,
    console: console
  };
  ventana.window = ventana;
  ventana.location.href = direccion;
  ventana.globalThis = ventana;

  vm.createContext(ventana);
  vm.runInContext(FUENTE, ventana);

  return { ventana: ventana, avisos: avisos, pedidas: pedidas, oyentes: oyentes };
}

const VIVO = 'https://eurotravel-web.vercel.app/';
const espera = () => new Promise(function (r) { setTimeout(r, 10); });

(async function () {

  console.log('\n== EL SERVIDOR CONTESTO MAL ==');
  {
    const n = navegador(VIVO, { '/api/pagar': 500 });
    await n.ventana.fetch('/api/pagar', { method: 'POST' });
    await espera();
    ok('un 500 en /api/pagar SI se reporta', n.avisos.length, 1);
    ok('  y dice que fue el servidor',
      n.avisos[0] && n.avisos[0].exception.values[0].type, 'ServidorFallo');
  }
  {
    const n = navegador(VIVO, { '/api/cuenta': 503 });
    await n.ventana.fetch('/api/cuenta', { method: 'POST' });
    await espera();
    ok('un 503 tambien se reporta', n.avisos.length, 1);
  }

  console.log('\n== LO NORMAL NO SE REPORTA ==');
  {
    const n = navegador(VIVO, { '/api/cuenta': 401 });
    await n.ventana.fetch('/api/cuenta', { method: 'POST' });
    await espera();
    ok('una contrasena mal (401) NO se reporta', n.avisos.length, 0);
  }
  {
    const n = navegador(VIVO, { '/api/cuenta': 400 });
    await n.ventana.fetch('/api/cuenta', { method: 'POST' });
    await espera();
    ok('un 400 NO se reporta', n.avisos.length, 0);
  }
  {
    const n = navegador(VIVO, { '/api/cotizar': 200 });
    await n.ventana.fetch('/api/cotizar', { method: 'POST' });
    await espera();
    ok('una peticion que salio bien NO se reporta', n.avisos.length, 0);
  }

  console.log('\n== SE CAYO LA CONEXION ==');
  {
    const n = navegador(VIVO, { '/api/pagar': new Error('sin red') });
    try { await n.ventana.fetch('/api/pagar', { method: 'POST' }); } catch (e) {}
    await espera();
    ok('cortarse en /api/pagar SI se reporta', n.avisos.length, 1);
    ok('  y se distingue de un fallo del servidor',
      n.avisos[0] && n.avisos[0].exception.values[0].type, 'PagoSinConexion');
  }
  {
    const n = navegador(VIVO, { '/api/confirmar': new Error('sin red') });
    try { await n.ventana.fetch('/api/confirmar', { method: 'POST' }); } catch (e) {}
    await espera();
    ok('cortarse en /api/confirmar SI se reporta', n.avisos.length, 1);
  }
  {
    const n = navegador(VIVO, { '/api/places': new Error('sin red') });
    try { await n.ventana.fetch('/api/places', { method: 'POST' }); } catch (e) {}
    await espera();
    ok('el wifi caido en /api/places NO se reporta', n.avisos.length, 0);
  }

  console.log('\n== LO DE FUERA NO ES ASUNTO SUYO ==');
  {
    const n = navegador(VIVO, {});
    await n.ventana.fetch('https://maps.googleapis.com/x').catch(function () {});
    await espera();
    ok('una peticion a otro sitio NO se vigila', n.avisos.length, 0);
  }
  {
    // Lo importante: el aviso a Sentry no puede provocar otro aviso.
    const n = navegador(VIVO, { '/api/pagar': 500 });
    await n.ventana.fetch('/api/pagar', { method: 'POST' });
    await espera(); await espera();
    ok('un aviso no provoca otro aviso (sin bucle)', n.avisos.length, 1);
  }

  console.log('\n== EL TOKEN DEL CLIENTE NO SALE ==');
  {
    const liga = 'https://eurotravel-web.vercel.app/viaje.html?ev=TOKEN.FIRMA';
    const n = navegador(liga, { '/api/pagar': 500 });
    await n.ventana.fetch('/api/pagar', { method: 'POST' });
    await espera();
    ok('la direccion reportada va sin el token',
      n.avisos[0] && n.avisos[0].request.url,
      'https://eurotravel-web.vercel.app/viaje.html');
    ok('  y no queda rastro del token en TODO el aviso',
      JSON.stringify(n.avisos[0] || {}).indexOf('TOKEN') !== -1, false);
  }

  console.log('\n== FRENOS ==');
  {
    const n = navegador('http://localhost:5175/', { '/api/pagar': 500 });
    await n.ventana.fetch('/api/pagar', { method: 'POST' });
    await espera();
    ok('desde localhost no se manda nada', n.avisos.length, 0);
  }
  {
    const n = navegador(VIVO, { '/api/pagar': 500 });
    for (let i = 0; i < 12; i++) {
      await n.ventana.fetch('/api/pagar?n=' + i, { method: 'POST' });
    }
    await espera();
    ok('el mismo fallo repetido se manda UNA vez', n.avisos.length, 1);
  }
  {
    const n = navegador(VIVO, {});
    for (let i = 0; i < 12; i++) n.ventana.avisaError('distinto ' + i);
    await espera();
    ok('hay tope de 5 avisos distintos por visita', n.avisos.length, 5);
  }

  console.log('\n== NO ROMPE LA PETICION ==');
  {
    const n = navegador(VIVO, { '/api/pagar': 500 });
    const r = await n.ventana.fetch('/api/pagar', { method: 'POST' });
    ok('quien pidio recibe su respuesta igual', r.status, 500);
  }
  {
    const n = navegador(VIVO, { '/api/pagar': new Error('sin red') });
    let trono = false;
    try { await n.ventana.fetch('/api/pagar', { method: 'POST' }); }
    catch (e) { trono = true; }
    ok('y si se cae, sigue cayendose para quien pidio', trono, true);
  }

  console.log('\n' + buenas + ' buenas, ' + malas + ' malas');
  process.exit(malas === 0 ? 0 : 1);
})();
