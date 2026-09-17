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
  /* Kommo mandó el aviso como formulario en producción (16-sep-2026). */
  const formulario = 'token=x.y.z&data%5Bfrom%5D=kommo&data%5Bmessage%5D=hola+que+tal&data%5Blead_id%5D=26818280' +
    '&data%5Bcontact_phone%5D=%2B52+1+344+102+9307&return_url=' + encodeURIComponent(bueno.return_url);
  const f = kommo.leeAvisoDeWidget(formulario);
  ok('un cuerpo de formulario (data[message]=…) se lee igual', f.leadId === '26818280' && f.mensaje === 'hola que tal' && f.numero === '5213441029307' && f.token === 'x.y.z');
  const f2 = kommo.leeAvisoDeWidget('token=x.y.z&data=' + encodeURIComponent(JSON.stringify(bueno.data)) + '&return_url=' + encodeURIComponent(bueno.return_url));
  ok('un formulario con data en JSON también', f2.leadId === '26818280' && f2.mensaje === 'hola');

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

  titulo('las fotos las adjunta el widget: carpeta y pie, sin ligas en el texto');
  const conFotos = [
    { para: '1', texto: 'Claro 📸' },
    { para: '1', ligaDeFoto: 'https://eurotravel-web.vercel.app/img/unidades/irizar-i6/irizar-i6-01.jpg', texto: 'Ésta es la *Irizar i6* — 47 y 51 pasajeros 📸' },
    { para: '1', ligaDeFoto: 'https://eurotravel-web.vercel.app/img/unidades/irizar-i6/irizar-i6-02.jpg', texto: '' },
    { para: '1', texto: 'Y el video por dentro 👇\nhttps://www.youtube.com/watch?v=abc' }
  ];
  const fk = kommo.fotosParaKommo(conFotos);
  ok('la carpeta es la de la unidad y el pie es el de la primera foto', fk && fk.carpeta === 'irizar-i6' && /Irizar i6/.test(fk.pie));
  const tk = kommo.textoParaKommo(conFotos, { sitio: 'https://eurotravel-web.vercel.app', fotosAparte: true });
  ok('el texto no lleva ligas de fotos pero sí el video de YouTube', !/img\/unidades/.test(tk) && /youtube\.com/.test(tk) && /Claro/.test(tk));
  ok('sin fotos del drive no hay carpeta', kommo.fotosParaKommo([{ para: '1', texto: 'hola' }, { para: '1', ligaDeFoto: 'https://x/no-existe.jpg' }]) === null);

  titulo('el widget: fotos por carpeta y tres salidas (sigue / terminó / silencio)');
  {
    /* Se ejecuta el script del widget tal cual lo carga Kommo (AMD) y se
       lee lo que registra al guardar el bot. */
    const fuente = require('fs').readFileSync(path.join(RAIZ, 'pendiente', 'kommo-widget', 'script.js'), 'utf8');
    let Widget = null;
    const define = function (deps, f) { Widget = f({}); };
    new Function('define', fuente)(define);
    const w = new Widget();
    const salidas = w.callbacks.salesbotDesignerSettings().exits.map(function (e) { return e.code; });
    ok('declara las salidas success, fail y silencio', salidas.join(',') === 'success,fail,silencio');
    const flujo = JSON.parse(w.callbacks.onSalesbotDesignerSave('eurobot', { url: 'https://x/api' }));
    ok('tres pasos: pedir al cerebro, fotos, salidas', flujo.length === 3 && flujo[0].question[0].handler === 'widget_request');
    const fotosPaso = flujo[1].question.filter(function (h) { return h.handler === 'conditions'; });
    ok('una condición por carpeta del drive, cada una con sus 3 fotos y su goto',
      fotosPaso.length === 8 && fotosPaso.every(function (c) {
        const r = c.params.result;
        return c.params.conditions[0].term1 === '{{json.fotos}}' && r.length === 4 &&
          r.slice(0, 3).every(function (m) { return m.handler === 'send_message' && m.params.attachments[0].type === 'picture'; }) &&
          r[0].params.text === '{{json.pie}}' && r[3].handler === 'goto' && r[3].params.step === 2;
      }));
    const salidasPaso = flujo[2].question;
    ok('«callado = si» sale por silencio antes de mirar el status',
      salidasPaso[0].params.conditions[0].term1 === '{{json.callado}}' && salidasPaso[0].params.result[0].params.value === 'silencio' &&
      salidasPaso[1].params.conditions[0].term1 === '{{json.status}}' && salidasPaso[2].params.value === 'fail');
  }

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
    if (/\/kommo-trabajo$/.test(u)) {
      reenvios.push({ url: u, tipo: init.headers['Content-Type'], body: init.body });
      return { ok: true, status: 200, text: async function () { return ''; }, json: async function () { return {}; } };
    }
    /* El ticket del precio, como nota interna del lead (16-sep-2026). */
    if (/\/api\/v4\/leads\/\d+\/notes$/.test(u)) {
      notas.push({ url: u, metodo: init.method, auth: init.headers.Authorization, body: JSON.parse(init.body) });
      return { ok: true, status: 200, text: async function () { return ''; }, json: async function () { return { _embedded: { notes: [{ id: 1 }] } }; } };
    }
    throw new Error('la prueba no debía llamar a ' + u);
  };
  const reenvios = [];
  const notas = [];
  /* Lo que el bot dice por Kommo también queda en la conversación del
     almacén (16-sep-2026): se espía `anotaMensaje` en el mismo módulo
     que usa whatsapp.mjs (es el mismo objeto de `module.exports`). */
  const almacen = require(path.join(RAIZ, 'api/_almacen.js'));
  const anotados = [];
  almacen.anotaMensaje = async function (numero, de, texto, tipo) { anotados.push({ de: de, texto: String(texto).slice(0, 40), tipo: tipo }); return true; };
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
  /* Kommo solo admite `show` (80 letras) y `goto` en execute_handlers, así
     que lo que dice el cerebro va en data.texto y lo pinta el bloque
     «Mensaje» del bot con {{json.texto}} (16-sep-2026). */
  /* Kommo exige al menos un handler: va el goto al paso de condiciones
     del widget (paso 1), que es lo que haría de todos modos. */
  ok('el cerebro sigue (status sigue), el texto va en data.texto y el único handler es el goto al paso 1',
    c1 && c1.data.status === 'sigue' && typeof c1.data.texto === 'string' && c1.data.texto.length > 0 &&
    Array.isArray(c1.execute_handlers) && c1.execute_handlers.length === 1 &&
    c1.execute_handlers[0].handler === 'goto' && c1.execute_handlers[0].params.step === 1);
  if (c1) console.log('   → ' + String(c1.data.texto).replace(/\n/g, ' ').slice(0, 120));
  ok('lo que dijo el bot por Kommo quedó anotado en la conversación del almacén',
    anotados.some(function (a) { return a.de === 'bot' && a.tipo === 'texto' && a.texto.length > 0; }));

  res = respuesta();
  await atiende(peticion(aviso(''), { 'x-interno': process.env.WHATSAPP_RUTA_SECRETA }), res);
  const c2 = continuaciones[1] && continuaciones[1].body;
  ok('sin texto (audio/foto) pide que lo escriba y sigue', c2 && c2.data.status === 'sigue' && /escribes/.test(c2.data.texto));

  res = respuesta();
  const malo = aviso('hola'); malo.token = jwt({ iss: 'x' }, 'otro-secreto');
  await atiende(peticion(malo, { 'x-interno': process.env.WHATSAPP_RUTA_SECRETA }), res);
  ok('token mal firmado: 200 pero no se contesta ni se llama a Kommo', res.cuerpo && res.cuerpo.ok === false && continuaciones.length === 2);

  res = respuesta();
  const sinToken = aviso('hola, quiero cotizar'); delete sinToken.token;
  await atiende(peticion(sinToken, { 'x-interno': process.env.WHATSAPP_RUTA_SECRETA }), res);
  ok('sin token (paso de código del Salesbot): se contesta igual', res.cuerpo && res.cuerpo.ok === true && continuaciones.length === 3);
  res = respuesta();
  await atiende(peticion(aviso('hola'), { 'x-interno': 'otra-llave' }), res);
  ok('sin el tramo interno: 404', res.codigo === 404);

  res = respuesta();
  const ajeno = aviso('hola'); ajeno.return_url = 'https://otra.kommo.com/api/v4/salesbot/1/continue/z';
  await atiende(peticion(ajeno, { 'x-interno': process.env.WHATSAPP_RUTA_SECRETA }), res);
  ok('return_url ajeno: no se contesta', res.cuerpo && res.cuerpo.ok === false && continuaciones.length === 3);

  titulo('el ticket del precio se pega como nota en el lead (16-sep-2026)');
  /* Por Kommo no hay «va»: el vendedor escribe el precio en el chat. El
     ticket con el calculado —que iba al WhatsApp del dueño y por Kommo no
     llegaba a nadie— se pega como nota interna del lead, aunque
     DUENO_WHATSAPP esté vacía. */
  delete process.env.DUENO_WHATSAPP;
  ok('la nota limpia lo que solo servía por WhatsApp',
    (function () {
      const n = kommo.notaDeTicket('💰 *Precio por confirmar*\n\nCalculado: *$9,000*\n\nContéstame *este mensaje*: *va* y se lo mando tal cual.\n_cliente: 5213319153931_');
      return /^🤖 EuroBot, para el vendedor\n\n💰/.test(n) && /Calculado: \*\$9,000\*/.test(n) &&
        !/Contéstame/.test(n) && !/_cliente:/.test(n) && /Escríbele el precio aquí mismo en el chat\.$/.test(n);
    })());
  ok('sin id numérico de lead no se pega nada', (await kommo.anotaEnLead('{{lead.id}}', 'x')) === false && notas.length === 0);
  const antesDeLaNota = continuaciones.length;
  /* Se contesta lo que el guion vaya preguntando, hasta que salga el ticket. */
  const contesta = function (pregunta) {
    const p = String(pregunta || '');
    if (/a dónde/i.test(p)) return 'a puerto vallarta';
    if (/regresan/i.test(p)) return 'el 22 de octubre';
    if (/qué día|cuándo salen|fecha/i.test(p)) return 'el 20 de octubre';
    if (/cuántos días/i.test(p)) return 'ninguno';
    if (/mover|mueven|movimientos|quieta|recorr/i.test(p)) return 'solo nos llevan y traen';
    if (/cuántos|cuántas personas/i.test(p)) return 'somos 12';
    if (/de qué ciudad|de dónde salen/i.test(p)) return 'Guadalajara';
    if (/zona metropolitana/i.test(p)) return 'sí';
    return 'sí';
  };
  let pregunta = continuaciones[continuaciones.length - 1].body.data.texto;
  for (let paso = 0; paso < 10 && !notas.length; paso++) {
    const t = contesta(pregunta);
    res = respuesta();
    await atiende(peticion(aviso(t), { 'x-interno': process.env.WHATSAPP_RUTA_SECRETA }), res);
    const c = continuaciones[continuaciones.length - 1] && continuaciones[continuaciones.length - 1].body;
    pregunta = String(c && c.data.texto);
    console.log('   «' + t + '» → ' + pregunta.replace(/\n/g, ' ').slice(0, 110));
  }
  ok('el cerebro siguió contestando por Kommo mientras tanto', continuaciones.length > antesDeLaNota);
  ok('se pegó UNA nota en el lead 26818280 con el token de la cuenta',
    notas.length === 1 && /\/leads\/26818280\/notes$/.test(notas[0].url) && notas[0].metodo === 'POST' && notas[0].auth === 'Bearer token-de-mentiras');
  const nota = notas[0] && notas[0].body[0];
  ok('es una nota común con el ticket del precio, sin el «va» ni el número del cliente',
    nota && nota.note_type === 'common' && /Precio por confirmar/.test(nota.params.text) &&
    /EuroBot, para el vendedor/.test(nota.params.text) && !/Contéstame/.test(nota.params.text) && !/_cliente:/.test(nota.params.text));
  if (nota) console.log('   nota → ' + nota.params.text.replace(/\n/g, ' | ').slice(0, 220));
  const ultima = continuaciones[continuaciones.length - 1].body;
  ok('al cliente le llegó el resumen con lo que incluye, y NADA del ticket',
    /Incluye:/.test(ultima.data.texto) && !/Precio por confirmar|Calculado/.test(ultima.data.texto));

  titulo('la primera puerta reenvía el aviso tal cual');
  /* Kommo manda un formulario; la segunda puerta lo recibe byte por byte
     como texto plano (con application/json Vercel lo parseaba, fallaba y
     llegaba vacío: «cuerpo ilegible», 16-sep-2026). */
  res = respuesta();
  await atiende(peticion(formulario, { 'content-type': 'application/x-www-form-urlencoded' }, 'kommo'), res);
  ok('contesta 200 ok a Kommo', res.codigo === 200 && res.cuerpo && res.cuerpo.ok === true);
  ok('reenvía como text/plain y con el mismo cuerpo', reenvios.length === 1 && /^text\/plain/.test(reenvios[0].tipo) && String(reenvios[0].body) === formulario);
  /* Si el entorno ya parseó el formulario (req.body objeto), se rearma. */
  res = respuesta();
  const parseada = peticion('', { 'content-type': 'application/x-www-form-urlencoded' }, 'kommo');
  delete parseada.rawBody; parseada.body = { token: 'x.y.z', 'data[lead_id]': '26818280', 'data[message]': 'hola', return_url: bueno.return_url };
  parseada[Symbol.asyncIterator] = async function* () {};
  await atiende(parseada, res);
  const rearmado = reenvios[1] && kommo.leeAvisoDeWidget(reenvios[1].body);
  ok('un cuerpo ya parseado se rearma como formulario y se lee', rearmado && rearmado.leadId === '26818280' && rearmado.mensaje === 'hola');

  global.fetch = fetchDeAntes;

  console.log('\n' + buenas + ' buenas, ' + malas + ' malas');
  process.exit(malas ? 1 : 0);
})().catch(function (e) { console.error(e); process.exit(1); });
