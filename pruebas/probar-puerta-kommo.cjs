/* ============================================================
   LA PUERTA DE KOMMO: EL CEREBRO DECIDE ANTES DEL SALUDO (16-sep-2026)
   ============================================================
   Spec: docs/ESPEC-UN-NUMERO-CUATRO-FUNCIONES.md §2, §4.3, §4.4.

   Dos de las cuatro funciones el dueño NO las puede probar con su
   teléfono (el comprobante de una agencia y el «gracias» tras el aviso
   de pago), así que aquí se prueban con TODAS las frases que se nos
   ocurrieron y con el camino entero por los tramos `kommo-puerta` y
   `kommo-trabajo-puerta`, sin llamar a nadie de verdad.

   Lo que se cuida:
     · una foto/PDF (mensaje vacío) → acuse fijo + nota en el lead
     · «te mando el comprobante» → «Va, mándamelo por aquí» y esperar
     · solo un agradecimiento → «De nada…»
     · una pregunta NUNCA cae en espera ni en denada
     · cualquier otra cosa → saludo (Kommo pone los botones)
     · los textos son los de _textos-fijos.js, tal cual
     · el tramo viejo `kommo` sigue igual (cotiza), sin `modo`
   ============================================================ */
'use strict';

const path = require('path');
const crypto = require('crypto');
const RAIZ = path.join(__dirname, '..');
const puerta = require(path.join(RAIZ, 'api', '_puerta-kommo.js'));
const TEXTOS = require(path.join(RAIZ, 'api', '_textos-fijos.js'));

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
    url: '/api/whatsapp', query: { llave: llave },
    rawBody: typeof cuerpo === 'string' ? cuerpo : JSON.stringify(cuerpo || {})
  };
}

titulo('1 · solo un agradecimiento (denada)');
[
  'gracias', 'Gracias', 'GRACIAS', 'muchas gracias', 'Muchas gracias!', 'mil gracias', 'muchísimas gracias',
  'ok gracias', 'ok, gracias', 'va gracias', 'perfecto gracias', 'gracias 🙏', '🙏', '👍', '👍🏽', 'ok 👍',
  'gracias por la info', 'gracias por la información', 'gracias, muy amable', 'gracias por tu ayuda',
  'listo gracias', 'excelente gracias', 'perfecto', 'ok', 'okey', 'va', 'sale', 'listo', 'entendido',
  'de acuerdo', 'recibido', 'gracias quedo pendiente', 'gracias, quedo al pendiente', 'gracias!! saludos',
  'grax', 'gracias buen día', 'muy amable gracias', 'gracias, estamos en contacto', 'ok perfecto gracias'
].forEach(function (f) { ok('«' + f + '» es solo gracias', puerta.soloAgradecimiento(f)); });

titulo('2 · NO es solo un agradecimiento');
[
  'gracias, ¿y mi contrato?', 'gracias pero no me ha llegado', 'gracias, cuándo me mandan el contrato',
  'ok y el saldo?', 'si', 'sí', 'no', 'hola', 'buenas tardes', 'buen día', 'vamos a vta', 'somos 12',
  'gracias, ahora quiero cotizar otro viaje', 'gracias por nada', 'quiero hablar con alguien',
  'ya vi el mensaje pero no entendí', 'ok me interesa', 'perfecto, ¿cómo aparto?', '14 al 17 de octubre',
  'gracias te mando el comprobante', ''
].forEach(function (f) { ok('«' + f + '» NO es solo gracias', !puerta.soloAgradecimiento(f)); });

titulo('3 · anuncia un pago (espera)');
[
  'te mando el comprobante', 'Te mando el comprobante del contrato 123', 'ahí va la ficha', 'ahi va el comprobante',
  'aquí te va el depósito', 'le mando el pago', 'les mando la transferencia', 'adjunto el comprobante',
  'ya hice la transferencia', 'ya deposité', 'ya realicé el pago', 'ya pagué el anticipo', 'acabo de depositar',
  'te paso la captura del pago', 'ahí te va el voucher', 'ya transferí', 'te comparto el comprobante del abono',
  'ahí está el pago', 'les dejo el comprobante', 'mando ficha de depósito', 'ya abonamos'
].forEach(function (f) { ok('«' + f + '» anuncia pago', puerta.anunciaPago(f)); });

titulo('4 · NO anuncia un pago');
[
  '¿cómo hago el pago?', 'como pago', 'dónde deposito', '¿me pasas la cuenta?', 'cuánto es el anticipo',
  '¿puedo pagar en dos partes?', 'quiero cotizar', 'gracias', 'hola', 'vamos a vallarta', 'me interesa el pb',
  'ya vi el precio', 'te mando los datos del contrato', 'ahí va mi nombre', 'ya salimos', '', '¿ya les llegó mi pago?'
].forEach(function (f) { ok('«' + f + '» NO anuncia pago', !puerta.anunciaPago(f)); });

titulo('4b · molesto, grosero o pidiendo persona (spec §5)');
[
  'no me entiendes', 'NO ME ENTIENDES NADA', 'ya te dije que vamos a vallarta', 'eres un bot?', 'esto es un bot',
  'quiero hablar con una persona', 'pásame con alguien', 'comunícame con el encargado', 'quiero hablar con un humano',
  'no sirves para nada', 'es la tercera vez que te lo digo', 'no mames', 'que pendejo', 'esto es una basura',
  'QUE NO ENTIENDES!!!', '¿¿¿ES EN SERIO???', 'otra vez lo mismo',
  /* 18-sep-2026: el saludo dice «escribe agente»; a secas también vale. */
  'agente', 'Agente', 'un agente', 'asesor', 'una persona', 'humano por favor', 'con un asesor porfa'
].forEach(function (f) { ok('«' + f + '» pasa a persona', puerta.pareceMolesto(f)); });
[
  'hola', 'vamos a vallarta', 'somos 12', 'no', 'no vamos a mazatlán', 'gracias', 'me interesa',
  'no entiendo bien el precio, ¿me lo explicas?', 'una persona más', 'somos 20 personas', 'ok', '14 al 17 de octubre',
  'es para una boda', 'mándame fotos', 'no sé la fecha todavía'
].forEach(function (f) { ok('«' + f + '» NO pasa a persona', !puerta.pareceMolesto(f)); });

titulo('4b-bis · pide a un vendedor POR SU NOMBRE (19-sep-2026)');
{
  /* Caso real: el lead 26861216 escribió «Agente Carmen cortina por favor»
     DOS veces y el bot le contestó «aquí no tenemos agente Carmen» y le
     siguió cotizando. El candado solo reconocía «agente» a secas; con un
     nombre detrás dejaba de valer. Quien pide a alguien por su nombre
     quiere a esa persona, no al bot. */
  [
    'Agente Carmen cortina por favor', 'agente carmen', 'asesor Lupita',
    'vendedora Lupita', 'con la señorita Lupita por favor', 'lic Carmen',
    'me comunico con Carmen cortina', 'Buenas tardes me comunico con Carmen cortina',
    'quiero hablar con Lupita', 'busco a Lupita Cortina', 'me pasas con Carmen',
    'pásame con Lupita', 'comunícame con Carmen'
  ].forEach(function (f) { ok('«' + f + '» pasa a persona', puerta.pareceMolesto(f)); });
  /* Y lo que NO es pedir a nadie por su nombre: si esto se rompe, el bot
     se apaga solo a media cotización. */
  [
    'me comunico con ustedes', 'quiero hablar con eurotravel', 'agente de viajes',
    'busco a mi grupo', 'hablar con el chofer', 'somos 20 personas',
    'me comunico con la empresa', 'esta bien', 'esta semana', 'busco una sprinter',
    'quiero cotizar con ustedes', 'hablar con alguien de precios'
  ].forEach(function (f) { ok('«' + f + '» NO se toma como un nombre', !puerta.pideAAlguienPorSuNombre(f)); });
}

titulo('4c · varias unidades, cotización anterior a mano y cancelación (tanda y, 17-sep)');
['necesito dos sprinters para 34 personas', 'serían 2 autobuses', 'tres camionetas para el 20', 'y otra sprinter aparte para los niños']
  .forEach(function (f) { ok('«' + f + '» pide varias unidades', puerta.pideVariasUnidades(f)); });
['una sprinter para 12', 'somos 2 personas', 'a las 2 de la tarde', 'dos días allá', 'el 3 de octubre']
  .forEach(function (f) { ok('«' + f + '» NO pide varias unidades', !puerta.pideVariasUnidades(f)); });
['quiero retomar mi cotización de la semana pasada', 'mi cotización anterior', 'ya me habían cotizado a vallarta', 'me cotizaron hace un mes y quiero apartar']
  .forEach(function (f) { ok('«' + f + '» quiere retomar una cotización', puerta.pideCotizacionAnterior(f)); });
['quiero una cotización', 'cotízame a vallarta', 'nueva cotización', 'cuánto sale']
  .forEach(function (f) { ok('«' + f + '» NO es retomar', !puerta.pideCotizacionAnterior(f)); });
['saben qué, ya no, gracias', 'ya no', 'cancelamos', 'mejor no', 'olvídalo', 'no gracias', 'ya no queremos']
  .forEach(function (f) { ok('«' + f + '» cancela', puerta.cancela(f)); });
['ya no sé si el 4 o el 5', 'no, somos 30', 'ya no el 14, el 15', 'no gracias, sin baño está bien pero quiero el precio', '¿ya no hay lugar?', 'no']
  .forEach(function (f) { ok('«' + f + '» NO cancela', !puerta.cancela(f)); });

titulo('5 · la decisión');
{
  const d1 = puerta.decide({ mensaje: '' });
  ok('sin texto (foto/PDF/audio) → comprobante, acuse neutro y nota', d1.modo === 'comprobante' && d1.texto === TEXTOS.archivoRecibido && d1.nota === TEXTOS.notaComprobante);
  const d2 = puerta.decide({ mensaje: 'te mando el comprobante' });
  ok('anuncia pago → «pago»: sin texto, con nota al vendedor (17-sep: el bot no atiende pagos)', d2.modo === 'pago' && d2.texto === '' && d2.nota === TEXTOS.notaPago);
  const d3 = puerta.decide({ mensaje: 'muchas gracias!' });
  ok('gracias → denada', d3.modo === 'denada' && d3.texto === TEXTOS.deNada);
  const d4 = puerta.decide({ mensaje: 'hola, quiero cotizar' });
  ok('otra cosa → saludo, sin texto (los botones los pone Kommo)', d4.modo === 'saludo' && d4.texto === '');
  const d5 = puerta.decide({ mensaje: 'gracias, ¿y mi contrato?' });
  ok('una pregunta con gracias → saludo', d5.modo === 'saludo');
  const d6 = puerta.decide({ mensaje: 'gracias te mando el comprobante' });
  ok('gracias + anuncia pago → pago (manda primero)', d6.modo === 'pago');
}

(async function () {
  titulo('6 · el camino entero por los tramos kommo-puerta y kommo-trabajo-puerta');
  process.env.SITIO_URL = 'https://eurotravel-web.vercel.app';
  process.env.WHATSAPP_RUTA_SECRETA = 'a'.repeat(48);
  process.env.KOMMO_SECRETO = 'secreto-widget';
  process.env.KOMMO_SUBDOMINIO = 'eurotravel';
  process.env.KOMMO_TOKEN = 'token-de-mentiras';
  process.env.BOT_HASTA_COTIZACION = '1';
  delete process.env.ANTHROPIC_API_KEY;
  delete process.env.WHATSAPP_TOKEN;
  delete process.env.WHATSAPP_PHONE_ID;
  delete process.env.ALMACEN_URL;

  const continuaciones = [], reenvios = [], notas = [];
  const fetchDeAntes = global.fetch;
  global.fetch = async function (url, init) {
    const u = String(url);
    if (/\/continue\//.test(u)) {
      continuaciones.push({ url: u, body: JSON.parse(init.body) });
      return { ok: true, status: 200, text: async function () { return ''; }, json: async function () { return {}; } };
    }
    if (/\/kommo-trabajo(-puerta)?$/.test(u)) {
      reenvios.push({ url: u, tipo: init.headers['Content-Type'], body: init.body });
      return { ok: true, status: 200, text: async function () { return ''; }, json: async function () { return {}; } };
    }
    if (/\/leads\/\d+\/notes$/.test(u)) {
      notas.push({ url: u, body: JSON.parse(init.body) });
      return { ok: true, status: 200, text: async function () { return ''; }, json: async function () { return { _embedded: { notes: [{ id: 1 }] } }; } };
    }
    throw new Error('la prueba no debía llamar a ' + u);
  };
  const mod = await import('file://' + path.join(RAIZ, 'api/whatsapp.mjs').replace(/\\/g, '/') + '?puerta=' + Date.now());
  const atiende = mod.default;
  const aviso = function (texto) {
    return {
      token: jwt({ iss: 'kommo', exp: Math.floor(Date.now() / 1000) + 300 }, 'secreto-widget'),
      data: { message: texto, lead_id: '26818280', contact_name: 'Tacho', contact_phone: '{{contact.phone}}', from: 'kommo' },
      return_url: 'https://eurotravel.kommo.com/api/v4/salesbot/84562/continue/abc'
    };
  };
  const porLaPuerta = async function (texto) {
    const res = respuesta();
    await atiende(peticion(aviso(texto), { 'x-interno': process.env.WHATSAPP_RUTA_SECRETA }, 'kommo-trabajo-puerta'), res);
    return { res: res, c: continuaciones[continuaciones.length - 1] && continuaciones[continuaciones.length - 1].body };
  };

  /* La primera puerta reenvía al tramo de la puerta, no al del cerebro. */
  let res = respuesta();
  await atiende(peticion(aviso('hola'), {}, 'kommo-puerta'), res);
  ok('kommo-puerta contesta 200 ok y reenvía a kommo-trabajo-puerta',
    res.codigo === 200 && res.cuerpo && res.cuerpo.ok === true && reenvios.length === 1 && /\/kommo-trabajo-puerta$/.test(reenvios[0].url) && /^text\/plain/.test(reenvios[0].tipo));

  let r = await porLaPuerta('hola, quiero cotizar');
  ok('«hola, quiero cotizar» → modo saludo, sin texto, sigue, con el goto al paso 1',
    r.res.cuerpo && r.res.cuerpo.ok === true && r.c && r.c.data.modo === 'saludo' && r.c.data.texto === '' && r.c.data.status === 'sigue' &&
    r.c.execute_handlers.length === 1 && r.c.execute_handlers[0].handler === 'goto' && r.c.execute_handlers[0].params.step === 1);
  ok('  y no se pegó ninguna nota', notas.length === 0);

  r = await porLaPuerta('');
  ok('foto/PDF → modo comprobante con el acuse fijo', r.c && r.c.data.modo === 'comprobante' && r.c.data.texto === TEXTOS.archivoRecibido);
  ok('  y una nota en el lead 26818280 con el aviso al vendedor',
    notas.length === 1 && /\/leads\/26818280\/notes$/.test(notas[0].url) && notas[0].body[0].params.text === TEXTOS.notaComprobante);

  r = await porLaPuerta('te mando el comprobante del contrato 123');
  ok('«te mando el comprobante» → el bot se calla y se apaga (callado, fin), y deja nota al vendedor',
    r.c && r.c.data.modo === '' && r.c.data.texto === '' && r.c.data.callado === 'si' && r.c.data.status === 'fin' &&
    notas.length === 2 && notas[1].body[0].params.text === TEXTOS.notaPago);

  r = await porLaPuerta('muchas gracias 🙏');
  ok('«muchas gracias» → modo denada con «De nada…»', r.c && r.c.data.modo === 'denada' && r.c.data.texto === TEXTOS.deNada);

  r = await porLaPuerta('gracias, ¿y mi contrato?');
  ok('una pregunta → saludo (la resuelve el botón de agente)', r.c && r.c.data.modo === 'saludo');

  /* ------------------------------------------------------------
     EMPEZAR DE NUEVO (spec §3): visto en el teléfono del dueño el 17-sep
     00:39. La ficha traía un viaje esperando precio (Vallarta 19–22 sep,
     PB, 46) y «Nueva cotización» + «vamos a vta» contestó con ese resumen.
     Ahora el saludo de la puerta archiva el viaje y vacía la plática.
     ------------------------------------------------------------ */
  const tickets = require(path.join(RAIZ, 'api/_tickets.js'));
  const webhook = require(path.join(RAIZ, 'api/_whatsapp-webhook.js'));
  const numeroDelLead = '529926818280';
  tickets.anotaEtapa(numeroDelLead, 'pidio_precio', { porConfirmar: { total: 40000, anticipo: 5000, cotiza: null,
    resumen: { origen: 'Guadalajara', destino: 'Puerto Vallarta', salida: '2026-09-19', regreso: '2026-09-22', gente: 46, unidadNombre: 'Irizar PB' } } });
  webhook.guardaCharla(numeroDelLead, { destino: 'Puerto Vallarta', salida: '2026-09-19' });
  r = await porLaPuerta('hola');
  const fichaNueva = tickets.fichaDe(numeroDelLead);
  ok('con un viaje esperando precio, el saludo de la puerta lo archiva y deja la ficha limpia',
    r.c && r.c.data.modo === 'saludo' && fichaNueva && !fichaNueva.porConfirmar && !fichaNueva.viajeDatos && fichaNueva.etapa === 'escribio' &&
    Array.isArray(fichaNueva.viajes) && fichaNueva.viajes.length === 1 && fichaNueva.viajes[0].destino === 'Puerto Vallarta');
  ok('  y la plática queda vacía', !webhook.charlaDe(numeroDelLead));
  /* Y el cerebro, a «vamos a vta», ya no contesta con el viaje viejo. */
  res = respuesta();
  await atiende(peticion(aviso('vamos a vta'), { 'x-interno': process.env.WHATSAPP_RUTA_SECRETA }, 'kommo-trabajo'), res);
  const despues = continuaciones[continuaciones.length - 1].body;
  ok('  y «vamos a vta» después del saludo NO trae el resumen del viaje anterior',
    despues && despues.data.status === 'sigue' && !/ya tengo todo tu viaje|19 de septiembre|Irizar PB|46/.test(despues.data.texto));
  console.log('   → ' + String(despues && despues.data.texto).replace(/\n/g, ' ').slice(0, 120));

  /* Los candados de siempre siguen en la puerta. */
  const antes = continuaciones.length;
  res = respuesta();
  const malo = aviso('hola'); malo.token = jwt({ iss: 'x' }, 'otro-secreto');
  await atiende(peticion(malo, { 'x-interno': process.env.WHATSAPP_RUTA_SECRETA }, 'kommo-trabajo-puerta'), res);
  ok('token mal firmado: no se contesta', res.cuerpo && res.cuerpo.ok === false && continuaciones.length === antes);
  res = respuesta();
  await atiende(peticion(aviso('hola'), { 'x-interno': 'otra-llave' }, 'kommo-trabajo-puerta'), res);
  ok('sin el tramo interno: 404', res.codigo === 404);
  res = respuesta();
  const ajeno = aviso('hola'); ajeno.return_url = 'https://otra.kommo.com/api/v4/salesbot/1/continue/z';
  await atiende(peticion(ajeno, { 'x-interno': process.env.WHATSAPP_RUTA_SECRETA }, 'kommo-trabajo-puerta'), res);
  ok('return_url ajeno: no se contesta', res.cuerpo && res.cuerpo.ok === false && continuaciones.length === antes);

  /* El tramo viejo sigue cotizando, sin modo. */
  res = respuesta();
  await atiende(peticion(aviso('hola, quiero cotizar un viaje'), { 'x-interno': process.env.WHATSAPP_RUTA_SECRETA }, 'kommo-trabajo'), res);
  const viejo = continuaciones[continuaciones.length - 1].body;
  ok('kommo-trabajo (sin puerta) sigue contestando como cerebro: texto y sin modo',
    viejo && viejo.data.modo === undefined && typeof viejo.data.texto === 'string' && viejo.data.texto.length > 0);

  global.fetch = fetchDeAntes;
  console.log('\n' + buenas + ' buenas, ' + malas + ' malas');
  process.exit(malas ? 1 : 0);
})().catch(function (e) { console.error(e); process.exit(1); });
