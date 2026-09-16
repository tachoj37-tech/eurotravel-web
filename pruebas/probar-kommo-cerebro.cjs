/* ============================================================
   EL CEREBRO DENTRO DE KOMMO · el paso EuroBot (16-sep-2026)
   ============================================================
   Lo que se cuida aquí, y por qué:

     · QUE UN AVISO AJENO NO SE CONTESTE. El `return_url` es a donde se
       le habla al cliente: si no es de nuestra cuenta, no se sigue.
     · QUE EL TOKEN MAL FIRMADO SE RECHACE, y que sin llave se avise pero
       no se frene (la llave la pone el dueño en Vercel; hasta entonces
       el tramo interno es el candado).
     · QUE LO QUE EL CEREBRO MANDA SE TRADUZCA BIEN: texto, botones (3 de
       20) y fotos como adjunto del drive de Kommo.
     · QUE EL CAMINO ENTERO FUNCIONE con el guion (sin IA): el aviso de
       Kommo entra, el cerebro contesta, y a Kommo le llega `status` con
       los `execute_handlers`. Sin llamar a nadie de verdad.
   ============================================================ */
'use strict';

const path = require('path');
const crypto = require('crypto');
const RAIZ = path.join(__dirname, '..');

let buenas = 0, malas = 0;
function ok(que, condicion) {
  if (condicion) { buenas++; console.log('ok   ' + que); }
  else { malas++; console.log('FALLA ' + que); }
}
function titulo(t) { console.log('\n== ' + t.toUpperCase() + ' =='); }

function jwt(cuerpo, secreto) {
  const b64 = function (x) { return Buffer.from(JSON.stringify(x)).toString('base64').replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_'); };
  const cab = b64({ alg: 'HS256', typ: 'JWT' }), cue = b64(cuerpo);
  const firma = crypto.createHmac('sha256', secreto).update(cab + '.' + cue).digest('base64').replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
  return cab + '.' + cue + '.' + firma;
}

function respuesta() {
  const r = { codigo: null, cuerpo: null };
  r.status = function (c) { r.codigo = c; return r; };
  r.json = function (x) { r.cuerpo = x; return r; };
  r.send = function (x) { r.cuerpo = x; return r; };
  return r;
}
function peticion(cuerpo, cabeceras, llave) {
  return {
    method: 'POST',
    headers: Object.assign({ 'content-type': 'application/json' }, cabeceras || {}),
    url: '/api/whatsapp', query: { llave: llave || 'kommo-trabajo' },
    rawBody: typeof cuerpo === 'string' ? cuerpo : JSON.stringify(cuerpo || {})
  };
}

(async function () {
  const kommo = require(path.join(RAIZ, 'api/_kommo.js'));
  process.env.KOMMO_SUBDOMINIO = 'eurotravel';
  process.env.KOMMO_TOKEN = 'token-de-mentiras';

  titulo('leer el aviso del widget');
  const bueno = {
    token: 'x.y.z',
    data: { message: 'hola', lead_id: '26818280', contact_name: 'Tacho', contact_phone: '{{contact.phone}}', from: 'kommo' },
    return_url: 'https://eurotravel.kommo.com/api/v4/salesbot/84528/continue/abc'
  };
  const a = kommo.leeAvisoDeWidget(JSON.stringify(bueno));
  ok('lee lead, mensaje y nombre', a.leadId === '26818280' && a.mensaje === 'hola' && a.nombre === 'Tacho');
  ok('un marcador sin llenar cuenta como vacío y el número sale del lead', a.numero === '529926818280');
  ok('con teléfono, el número es el teléfono', kommo.leeAvisoDeWidget(JSON.stringify(Object.assign({}, bueno, { data: Object.assign({}, bueno.data, { contact_phone: '+52 1 344 102 9307' }) }))).numero === '5213441029307');
  ok('un return_url de otra cuenta se rechaza', !!kommo.leeAvisoDeWidget(JSON.stringify(Object.assign({}, bueno, { return_url: 'https://otra.kommo.com/x' }))).error);
  ok('un return_url que no es kommo se rechaza', !!kommo.leeAvisoDeWidget(JSON.stringify(Object.assign({}, bueno, { return_url: 'https://eurotravel.kommo.com.evil.com/x' }))).error);
  ok('sin lead no hay aviso', !!kommo.leeAvisoDeWidget(JSON.stringify(Object.assign({}, bueno, { data: { message: 'hola' } }))).error);
  ok('un cuerpo ilegible no truena', kommo.leeAvisoDeWidget('{no').error === 'cuerpo ilegible');

  titulo('el token del widget');
  ok('sin llave: null (se avisa, no se frena)', kommo.verificaTokenDeWidget('a.b.c', '') === null);
  ok('bien firmado: true', kommo.verificaTokenDeWidget(jwt({ iss: 'kommo', exp: Math.floor(Date.now() / 1000) + 60 }, 'secreto1'), 'secreto1') === true);
  ok('mal firmado: false', kommo.verificaTokenDeWidget(jwt({ iss: 'kommo' }, 'otro'), 'secreto1') === false);
  ok('vencido: false', kommo.verificaTokenDeWidget(jwt({ exp: 1 }, 'secreto1'), 'secreto1') === false);
  ok('basura: false', kommo.verificaTokenDeWidget('hola', 'secreto1') === false);

  titulo('de envíos a handlers de kommo');
  const h = kommo.handlersDeEnvios([
    { para: '1', texto: 'Hola 👋' },
    { para: '1', texto: '¿Cuál te late?', opciones: ['Sprinter', 'Autobús', 'Un nombre de botón demasiado largo'] },
    { para: '1', ligaDeFoto: 'https://eurotravel-web.vercel.app/img/unidades/irizar-i6s-01.jpg', texto: 'El i6S' },
    { para: '1', ligaDeFoto: 'https://eurotravel-web.vercel.app/img/unidades/no-existe.jpg', texto: '' },
    { para: '1', texto: '' }
  ], { canal: 60452 });
  ok('el texto va como show/text', h[0].handler === 'show' && h[0].params.type === 'text' && h[0].params.value === 'Hola 👋');
  ok('los botones van como show/buttons y el largo se descarta', h[1].params.type === 'buttons' && h[1].params.buttons.length === 2);
  ok('la foto conocida va como adjunto del drive, por el canal de pruebas',
    h[2].handler === 'send_message' && h[2].params.attachments[0].value === 'bd99c39a-eadc-4489-b20f-479e3922574b' &&
    h[2].params.chat_sources[0].id === 60452 && h[2].params.send_to_all_chat_sources === false);
  ok('la foto desconocida va como liga en texto', h[3].handler === 'show' && /no-existe\.jpg/.test(h[3].params.value));
  ok('un envío vacío no manda nada', h.length === 4);

  titulo('el camino entero, con el guion');
  process.env.SITIO_URL = 'https://eurotravel-web.vercel.app';
  process.env.WHATSAPP_RUTA_SECRETA = 'a'.repeat(48);
  process.env.KOMMO_SECRETO = 'secreto-widget';
  process.env.BOT_HASTA_COTIZACION = '1';
  delete process.env.ANTHROPIC_API_KEY;
  delete process.env.WHATSAPP_TOKEN;
  delete process.env.WHATSAPP_PHONE_ID;
  delete process.env.WHATSAPP_WABA_ID;
  delete process.env.ALMACEN_URL;

  const continuaciones = [];
  const fetchDeAntes = global.fetch;
  global.fetch = async function (url, init) {
    const u = String(url);
    if (/\/continue\//.test(u)) {
      continuaciones.push({ url: u, body: JSON.parse(init.body), auth: init.headers.Authorization });
      return { ok: true, status: 200, text: async function () { return ''; }, json: async function () { return {}; } };
    }
    throw new Error('la prueba no debía llamar a ' + u);
  };
  const mod = await import('file://' + path.join(RAIZ, 'api/whatsapp.mjs').replace(/\\/g, '/') + '?cerebro=' + Date.now());
  const atiende = mod.default;

  const aviso = function (texto) {
    return {
      token: jwt({ iss: 'kommo', exp: Math.floor(Date.now() / 1000) + 300 }, 'secreto-widget'),
      data: { message: texto, lead_id: '26818280', contact_name: 'Tacho', contact_phone: '{{contact.phone}}', from: 'kommo' },
      return_url: 'https://eurotravel.kommo.com/api/v4/salesbot/84528/continue/abc'
    };
  };

  let res = respuesta();
  await atiende(peticion(aviso('hola, quiero cotizar un viaje a vallarta'), { 'x-interno': process.env.WHATSAPP_RUTA_SECRETA }), res);
  ok('la puerta contesta 200 con ok', res.codigo === 200 && res.cuerpo && res.cuerpo.ok === true);
  ok('se llamó a return_url con el token de la cuenta', continuaciones.length === 1 && continuaciones[0].auth === 'Bearer token-de-mentiras');
  const c1 = continuaciones[0] && continuaciones[0].body;
  ok('el cerebro sigue (status sigue) y mandó al menos un texto',
    c1 && c1.data.status === 'sigue' && Array.isArray(c1.execute_handlers) && c1.execute_handlers.length >= 1 &&
    c1.execute_handlers.every(function (x) { return x.handler === 'show' || x.handler === 'send_message'; }));
  if (c1) console.log('   → ' + c1.execute_handlers.map(function (x) { return (x.params.value || x.params.text || '').replace(/\n/g, ' ').slice(0, 90); }).join(' | '));

  res = respuesta();
  await atiende(peticion(aviso(''), { 'x-interno': process.env.WHATSAPP_RUTA_SECRETA }), res);
  const c2 = continuaciones[1] && continuaciones[1].body;
  ok('sin texto (audio/foto) pide que lo escriba y sigue', c2 && c2.data.status === 'sigue' && /escribes/.test(c2.execute_handlers[0].params.value));

  res = respuesta();
  const malo = aviso('hola'); malo.token = jwt({ iss: 'x' }, 'otro-secreto');
  await atiende(peticion(malo, { 'x-interno': process.env.WHATSAPP_RUTA_SECRETA }), res);
  ok('token mal firmado: 200 pero no se contesta ni se llama a Kommo', res.cuerpo && res.cuerpo.ok === false && continuaciones.length === 2);

  res = respuesta();
  await atiende(peticion(aviso('hola'), { 'x-interno': 'otra-llave' }), res);
  ok('sin el tramo interno: 404', res.codigo === 404);

  res = respuesta();
  const ajeno = aviso('hola'); ajeno.return_url = 'https://otra.kommo.com/api/v4/salesbot/1/continue/z';
  await atiende(peticion(ajeno, { 'x-interno': process.env.WHATSAPP_RUTA_SECRETA }), res);
  ok('return_url ajeno: no se contesta', res.cuerpo && res.cuerpo.ok === false && continuaciones.length === 2);

  global.fetch = fetchDeAntes;

  console.log('\n' + buenas + ' buenas, ' + malas + ' malas');
  process.exit(malas ? 1 : 0);
})().catch(function (e) { console.error(e); process.exit(1); });
