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
  const TEXTOS_FIJOS = require(path.join(RAIZ, 'api/_textos-fijos.js'));
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
  /* 21-sep-2026: el teléfono ya no manda. Una sola llave por lead, siempre,
     para que dos chats no puedan caer en la misma memoria. */
  ok('con teléfono, el número SIGUE saliendo del lead (una sola llave por chat)', kommo.leeAvisoDeWidget(JSON.stringify(Object.assign({}, bueno, { data: Object.assign({}, bueno.data, { contact_phone: '+52 1 344 102 9307' }) }))).numero === '529926818280');
  ok('un return_url de otra cuenta se rechaza', !!kommo.leeAvisoDeWidget(JSON.stringify(Object.assign({}, bueno, { return_url: 'https://otra.kommo.com/x' }))).error);
  ok('un return_url que no es kommo se rechaza', !!kommo.leeAvisoDeWidget(JSON.stringify(Object.assign({}, bueno, { return_url: 'https://eurotravel.kommo.com.evil.com/x' }))).error);
  ok('sin lead no hay aviso', !!kommo.leeAvisoDeWidget(JSON.stringify(Object.assign({}, bueno, { data: { message: 'hola' } }))).error);
  ok('un cuerpo ilegible no truena', kommo.leeAvisoDeWidget('{no').error === 'cuerpo ilegible');
  /* Kommo mandó el aviso como formulario en producción (16-sep-2026). */
  const formulario = 'token=x.y.z&data%5Bfrom%5D=kommo&data%5Bmessage%5D=hola+que+tal&data%5Blead_id%5D=26818280' +
    '&data%5Bcontact_phone%5D=%2B52+1+344+102+9307&return_url=' + encodeURIComponent(bueno.return_url);
  const f = kommo.leeAvisoDeWidget(formulario);
  ok('un cuerpo de formulario (data[message]=…) se lee igual', f.leadId === '26818280' && f.mensaje === 'hola que tal' && f.numero === '529926818280' && f.token === 'x.y.z');
  /* semgrep, 21-sep-2026: una llave `data[__proto__][x]` en el formulario
     escribiría en el prototipo de TODOS los objetos. Se ignora. */
  kommo.leeAvisoDeWidget('token=x.y.z&data%5B__proto__%5D%5Bcontaminado%5D=1&data%5Blead_id%5D=26818280&return_url=' + encodeURIComponent(bueno.return_url));
  ok('una llave __proto__ en el formulario no contamina los objetos', ({}).contaminado === undefined);
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
    /* 1.0.8 (spec §2): el mismo widget, apuntado a …/kommo-puerta, decide
       antes del saludo por cuatro salidas más. */
    ok('declara las salidas success, fail, silencio y las cuatro de la puerta',
      salidas.join(',') === 'success,fail,silencio,saludo,comprobante,espera,denada');
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
    ok('primero las cuatro salidas de la puerta, por {{json.modo}}, en orden saludo/comprobante/espera/denada',
      ['saludo', 'comprobante', 'espera', 'denada'].every(function (m, i) {
        const c = salidasPaso[i];
        return c.handler === 'conditions' && c.params.conditions[0].term1 === '{{json.modo}}' &&
          c.params.conditions[0].term2 === m && c.params.result[0].params.value === m;
      }));
    ok('«callado = si» sale por silencio antes de mirar el status',
      salidasPaso[4].params.conditions[0].term1 === '{{json.callado}}' && salidasPaso[4].params.result[0].params.value === 'silencio' &&
      salidasPaso[5].params.conditions[0].term1 === '{{json.status}}' && salidasPaso[5].params.conditions[0].term2 === 'sigue' &&
      salidasPaso[5].params.result[0].params.value === 'success');
    /* 1.0.9 (22-sep-2026): `fail` solo con un «fin» de verdad. Sin respuesta
       del servidor, el cerebro pide perdón con texto fijo y para por
       «silencio»; nunca un «Mensaje {{json.texto}}» sin dato. */
    ok('«fin» sale por fail, y sin respuesta: perdón fijo + silencio (nunca {{json.texto}})',
      salidasPaso[6].params.conditions[0].term1 === '{{json.status}}' && salidasPaso[6].params.conditions[0].term2 === 'fin' &&
      salidasPaso[6].params.result[0].params.value === 'fail' &&
      salidasPaso[7].handler === 'send_message' && /se me trabó/.test(salidasPaso[7].params.text) && !/\{\{/.test(salidasPaso[7].params.text) &&
      salidasPaso[7].params.send_to_all_chat_sources === true && !salidasPaso[7].params.attachments &&
      salidasPaso[8].handler === 'exits' && salidasPaso[8].params.value === 'silencio' && salidasPaso.length === 9);
    const flujoPuerta = JSON.parse(w.callbacks.onSalesbotDesignerSave('eurobot', { url: 'https://x/api/whatsapp/kommo-puerta' }));
    const salidasPuerta = flujoPuerta[2].question;
    ok('la puerta conserva su fallback a fail (→ saludo): sin servidor, el saludo con botones',
      salidasPuerta.length === 8 && salidasPuerta[7].handler === 'exits' && salidasPuerta[7].params.value === 'fail' &&
      !salidasPuerta.some(function (h) { return h.handler === 'send_message'; }));
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
  const notasAntes = notas.length;
  await atiende(peticion(aviso(''), { 'x-interno': process.env.WHATSAPP_RUTA_SECRETA }), res);
  const c2 = continuaciones[1] && continuaciones[1].body;
  /* 17-sep-2026 (spec §4.4): un archivo a media plática es un comprobante:
     acuse neutro, nota en el lead y el bot se apaga. Antes pedía «¿me lo
     escribes?» y seguía. */
  ok('sin texto (foto/PDF/audio) a media plática: acuse de comprobante y el bot para',
    c2 && c2.data.status === 'fin' && c2.data.texto === TEXTOS_FIJOS.archivoRecibido);
  ok('  y una nota de comprobante en el lead', notas.length === notasAntes + 1 && notas[notas.length - 1].body[0].params.text === TEXTOS_FIJOS.notaComprobante);

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
  /* Como en producción (17-sep-2026, prueba del dueño a las 20:34 UTC): con
     DUENO_WHATSAPP puesta y AVISOS_AL_DUENO apagado, el ticket se apagaba en
     `manda` y la nota nunca llegó al lead. Por Kommo esas compuertas no
     aplican: el ticket ES la nota. */
  process.env.DUENO_WHATSAPP = '5213312345678';
  delete process.env.AVISOS_AL_DUENO;
  /* Corta (dictado del dueño): el viaje en un renglón, el precio y las
     advertencias; fuera encabezado, calendario, almacén y el «va». */
  {
    const n = kommo.notaDeTicket('💰 *Precio por confirmar*\n\n📍 Guadalajara → Puerto Vallarta\n📅 20 de octubre al 22 de octubre\n🚌 Sprinter · 12 pax\n🚏 Salen de la *ZMG* (sin recargo)\n\nCalculado: *$9,000* (anticipo $3,000)\nAntes lo diste a: $8,500 (20 oct · 12 pax) ✍️\nSugerido: *$8,500*\nCalendario: 4 de 5 libres\n\n⚠️ *Este precio no se va a guardar*: el almacén está apagado y no estoy aprendiendo nada.\n\nContéstame *este mensaje*: *va* y se lo mando tal cual.\n_cliente: 5213319153931_');
    const r = n.split('\n');
    ok('la nota es corta: encabezado, viaje en un renglón, precio y lo que él dio antes',
      r.length === 5 && r[0] === '🤖 EuroBot · precio sugerido' &&
      r[1] === '📍 Guadalajara → Puerto Vallarta · 📅 20 de octubre al 22 de octubre · 🚌 Sprinter · 12 pax' &&
      r[2] === 'Calculado: *$9,000* (anticipo $3,000)' && /^Antes lo diste a/.test(r[3]) && r[4] === 'Sugerido: *$8,500*');
    ok('  sin «va», sin número del cliente, sin calendario, sin zona «sin recargo», sin aviso del almacén',
      !/Contéstame|_cliente:|Calendario|ZMG|almacén|Precio por confirmar/.test(n));
    const conRecargo = kommo.notaDeTicket('💰 *Precio por confirmar*\n📍 Ocotlán → Chapala\n🚏 Salen de *Ocotlán* (recargo $4,500)\nCalculado: *$6,500*\n⚠️ *Ese calculado NO trae el recargo de Ocotlán*: súmaselo tú.\nContéstame *este mensaje*: *va*');
    ok('  la zona sí se queda cuando trae recargo, con su advertencia',
      /🚏 Salen de \*Ocotlán\* \(recargo \$4,500\)/.test(conRecargo) && /⚠️ \*Ese calculado NO trae el recargo/.test(conRecargo) && !/Contéstame/.test(conRecargo));
    const camion = kommo.notaDeTicket('💰 *Precio por confirmar*\n🚌 Irizar i6 · 47 pax\nDel Excel: *$32,000*  (columna «NC47», cubre 4 días)\n⚠️ Tu viaje es de *6 días* y ese precio cubre *4*: ajústalo tú.\n_Ese número sale de tu lista, no del cotizador. Contéstame con el bueno._');
    ok('  para autobús queda el renglón del Excel con su columna y la advertencia de días',
      /Del Excel: \*\$32,000\*  \(columna «NC47», cubre 4 días\)/.test(camion) && /ajústalo tú/.test(camion) && !/Contéstame con el bueno/.test(camion));
  }
  ok('sin id numérico de lead no se pega nada', (await kommo.anotaEnLead('{{lead.id}}', 'x')) === false && notas.length === notasAntes + 1);
  const notasBase = notas.length;
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
  for (let paso = 0; paso < 10 && notas.length === notasBase; paso++) {
    const t = contesta(pregunta);
    res = respuesta();
    await atiende(peticion(aviso(t), { 'x-interno': process.env.WHATSAPP_RUTA_SECRETA }), res);
    const c = continuaciones[continuaciones.length - 1] && continuaciones[continuaciones.length - 1].body;
    pregunta = String(c && c.data.texto);
    console.log('   «' + t + '» → ' + pregunta.replace(/\n/g, ' ').slice(0, 110));
  }
  ok('el cerebro siguió contestando por Kommo mientras tanto', continuaciones.length > antesDeLaNota);
  ok('se pegó UNA nota en el lead 26818280 con el token de la cuenta',
    notas.length === notasBase + 1 && /\/leads\/26818280\/notes$/.test(notas[notasBase].url) && notas[notasBase].metodo === 'POST' && notas[notasBase].auth === 'Bearer token-de-mentiras');
  const nota = notas[notasBase] && notas[notasBase].body[0];
  ok('es una nota común con el ticket del precio, sin el «va» ni el número del cliente',
    nota && nota.note_type === 'common' && /^🤖 EuroBot · precio sugerido\n📍 /.test(nota.params.text) &&
    /Calculado:|Del Excel:|No pude calcularlo/.test(nota.params.text) && nota.params.text.split('\n').length <= 6 &&
    !/Contéstame/.test(nota.params.text) && !/_cliente:/.test(nota.params.text));
  if (nota) console.log('   nota → ' + nota.params.text.replace(/\n/g, ' | ').slice(0, 300));
  /* 17-sep-2026: la nota dice de dónde salió el número, en palabras del
     criterio (Excel del destino, noches incluidas, extras, movimientos). */
  ok('  y trae el renglón «Criterio:» con el Excel de Vallarta y sus 3 noches incluidas',
    !!nota && /\nCriterio: Excel Puerto Vallarta[^\n]* \$[\d,]+ \(3 noches incl\.\)/.test(nota.params.text) &&
    !/noches? extra|con movimiento/.test(nota.params.text));
  const ultima = continuaciones[continuaciones.length - 1].body;
  /* 18-sep-2026: con fotos, el resumen va como PIE de la primera foto
     (para que Kommo no lo meta entre los adjuntos), no en `texto`. */
  const alCliente = ultima.data.texto || ultima.data.pie || '';
  ok('al cliente le llegó el resumen con lo que incluye, y NADA del ticket',
    /Incluye:/.test(alCliente) && !/Precio por confirmar|Calculado/.test(alCliente));
  /* 22-sep-2026: con el resumen como pie, `texto` va vacío. Kommo pinta el
     bloque «Mensaje {{json.texto}}» con llaves y todo si el texto viene
     vacío (12 clientes lo recibieron), así que ese «sigue» sin texto sale
     por «espera», que en el cerebro va directo a la pausa. */
  ok('si el texto fue como pie, el widget sale por «espera» (directo a la pausa), no por un mensaje vacío',
    ultima.data.texto ? ultima.data.modo === '' : (ultima.data.status === 'sigue' && ultima.data.modo === 'espera'));

  titulo('22-sep: un «ok» después del resumen sale por «espera», nunca como mensaje vacío');
  /* Como en producción: con la IA encendida (aquí de mentiras, contesta
     lo que la regla del acuse no deja salir). Sin llave, la cáscara ni
     entra al agente y el guion viejo contesta; eso no es producción. */
  {
    const agenteOk = require(path.join(RAIZ, 'api/_agente.js'));
    const conversaAntesOk = agenteOk.conversa;
    agenteOk.conversa = async function () { return { respuesta: 'Perfecto 🙌', datos: {}, accion: 'seguir' }; };
    process.env.ANTHROPIC_API_KEY = 'clave-de-mentiras';
    res = respuesta();
    await atiende(peticion(aviso('ok'), { 'x-interno': process.env.WHATSAPP_RUTA_SECRETA }), res);
    delete process.env.ANTHROPIC_API_KEY; agenteOk.conversa = conversaAntesOk;
  }
  const cOk = continuaciones[continuaciones.length - 1].body;
  ok('el acuse no se contesta, el bot sigue vivo y el widget va directo a la pausa (modo «espera»)',
    cOk && cOk.data.status === 'sigue' && !cOk.data.texto && cOk.data.modo === 'espera' && cOk.data.callado !== 'si');

  titulo('x9 (17-sep): «ya deposité, ahí les mando el comprobante» a media plática');
  res = respuesta();
  await atiende(peticion(aviso('ya deposité, ahí les mando el comprobante'), { 'x-interno': process.env.WHATSAPP_RUTA_SECRETA }), res);
  const cx9 = continuaciones[continuaciones.length - 1].body;
  ok('contesta «mándamelo por aquí» y el bot SIGUE vivo para recibir la foto',
    cx9 && cx9.data.status === 'fin' && cx9.data.callado === 'si' && !cx9.data.texto);

  titulo('19-sep: el agradecimiento de un abono NO abre una cotización');
  /* Tres clientas reales el mismo día contestaron «Muchas gracias» al
     aviso de su abono, sin apretar ningún botón, y el cerebro les abrió
     una cotización («¿A dónde va el plan?»). La puerta sabía qué hacer,
     pero la puerta solo corre con el primer mensaje. */
  const avisoDe = function (lead, texto) {
    const a = aviso(texto);
    a.data.lead_id = String(lead);
    a.data.contact_name = 'Adriana';
    return a;
  };
  res = respuesta();
  await atiende(peticion(avisoDe(26892582, 'Muchas gracias'), { 'x-interno': process.env.WHATSAPP_RUTA_SECRETA }), res);
  const cGracias = continuaciones[continuaciones.length - 1].body;
  ok('«Muchas gracias» → «de nada» y el bot se apaga, sin preguntar a dónde van',
    cGracias && cGracias.data.status === 'fin' && cGracias.data.texto === TEXTOS_FIJOS.deNada);
  ok('  y NO le pregunta por el viaje',
    cGracias && !/d[oó]nde|plan|viaje|cotiz/i.test(String(cGracias.data.texto)));

  res = respuesta();
  const notasAntesDelPago = notas.length;
  await atiende(peticion(avisoDe(26816888, 'Ya quedo el pago completo'), { 'x-interno': process.env.WHATSAPP_RUTA_SECRETA }), res);
  const cPagado = continuaciones[continuaciones.length - 1].body;
  ok('«Ya quedo el pago completo» → el bot se calla y se apaga, no cotiza',
    cPagado && cPagado.data.status === 'fin' && cPagado.data.callado === 'si' && !cPagado.data.texto);
  ok('  y le queda la nota al vendedor en su lead',
    notas.length === notasAntesDelPago + 1 && /\/leads\/26816888\/notes$/.test(notas[notasAntesDelPago].url));

  /* El candado no puede tragarse un «va» que contesta una pregunta del
     bot: el lead 26818280 ya trae plática, así que sigue su camino. */
  res = respuesta();
  await atiende(peticion(aviso('va'), { 'x-interno': process.env.WHATSAPP_RUTA_SECRETA }), res);
  const cVa = continuaciones[continuaciones.length - 1].body;
  ok('un «va» a media plática NO se convierte en «de nada»',
    cVa && cVa.data.texto !== TEXTOS_FIJOS.deNada);

  titulo('19-sep: sin apretar botón y sin pedir cotización, el bot NO cotiza');
  /* El hueco de fondo, dictado del dueño: «si no le picaron a ningún
     botón y hablaron, el bot empieza a cotizar». El saludo manda al
     cerebro TODO lo que no sea un botón, y el cerebro solo sabe cotizar.
     La primera vez que el cerebro abre la boca en una conversación, el
     mensaje tiene que pedir un viaje; si no, lo atiende una persona. */
  const alCerebro = async function (lead, texto) {
    const r = respuesta();
    await atiende(peticion(avisoDe(lead, texto), { 'x-interno': process.env.WHATSAPP_RUTA_SECRETA }), r);
    return continuaciones[continuaciones.length - 1].body;
  };
  /* Lo mismo, escogiendo la mitad: la puerta o el cerebro. */
  const conSesion = async function (lead, texto, llave) {
    const r = respuesta();
    await atiende(peticion(avisoDe(lead, texto), { 'x-interno': process.env.WHATSAPP_RUTA_SECRETA }, llave), r);
    return continuaciones[continuaciones.length - 1].body.data;
  };

  /* 21-sep-2026: estos cuatro antes pasaban a una persona. Cambió de lado
     por un caso real: el dueño apretó «Nueva cotización» en su chat de
     pruebas, escribió «buenas trades» y le contestaron «ahorita te atiende
     una persona». El botón lo contesta Kommo con su mensaje fijo y NO
     llega al servidor, así que el primer mensaje del cerebro puede ser de
     alguien que sí eligió cotizar. Ahora se le pregunta una vez, sin
     cotizar, y el bot sigue vivo. Lo que habla de un contrato sí va con
     una persona, como antes. */
  for (const t of ['Buenas tardes', 'Hola qué tal', 'Sigo esperando', 'Quién habla']) {
    const c = await alCerebro(26900000 + t.length, t);
    ok('«' + t + '» no cotiza: pregunta UNA vez si quiere cotizar y el bot sigue',
      c && c.data.status === 'sigue' && c.data.texto === TEXTOS_FIJOS.preguntaSiCotiza);
  }
  {
    const c = await alCerebro(26900050, 'Es sobre mi contrato');
    ok('«Es sobre mi contrato» no cotiza: pasa a una persona y el bot se apaga',
      c && c.data.status === 'fin' && c.data.texto === TEXTOS_FIJOS.agente);
  }

  titulo('21-sep: el flujo REAL — el botón no llega, el primer mensaje sí');
  {
    /* Como en el teléfono del dueño: la puerta saluda, el cliente aprieta
       «Nueva cotización» (eso lo contesta Kommo, no llega aquí) y escribe
       «buenas trades». Se le pregunta una vez; lo siguiente ya es del
       cerebro, que cotiza. */
    await conSesion(26900800, 'hola', 'kommo-trabajo-puerta');
    const primero = await conSesion(26900800, 'buenas trades', 'kommo-trabajo');
    ok('«buenas trades» tras apretar el botón: pregunta si quiere cotizar, NO lo manda con una persona',
      primero.status === 'sigue' && primero.texto === TEXTOS_FIJOS.preguntaSiCotiza);
    const luego = await conSesion(26900800, 'a vallarta el 5 de diciembre, somos 40', 'kommo-trabajo');
    ok('  y lo que contesta después lo atiende el cerebro, sin volver a preguntar',
      luego.status === 'sigue' && luego.texto && luego.texto !== TEXTOS_FIJOS.preguntaSiCotiza);
  }

  titulo('21-sep: con Sonnet la IA contesta todo, sin textos fijos de por medio');
  {
    /* Dictado del dueño: «la IA debe estar en todo, cada respuesta debe
       razonar». En su chat de pruebas (lead 26838770, en Sonnet) ni el
       «de nada» fijo ni la pregunta fija interceptan: va todo al cerebro. */
    const saludo = await conSesion(26838770, 'buenas trades', 'kommo-trabajo');
    ok('en Sonnet, «buenas trades» va al cerebro: ni la pregunta fija ni una persona',
      saludo.status === 'sigue' && saludo.texto !== TEXTOS_FIJOS.preguntaSiCotiza && saludo.texto !== TEXTOS_FIJOS.agente);
  }

  /* Y lo que SÍ tiene que seguir trabajando solo, que es el negocio. */
  const siCotizan = [
    ['Nueva cotización', 26900101],
    ['quiero cotizar un viaje a Mazatlán', 26900102],
    ['ocupo transporte para 40 personas', 26900103],
    ['cuánto sale una sprinter a Chapala', 26900104],
    ['Vallarta', 26900105]
  ];
  for (const par of siCotizan) {
    const c = await alCerebro(par[1], par[0]);
    ok('«' + par[0] + '» sí entra al cerebro',
      c && c.data.status === 'sigue' && String(c.data.texto || '').length > 0);
  }

  /* Y una vez adentro, el candado no vuelve a morder: un «todavía no sé»
     en el segundo turno lo atiende el cerebro, no una persona. */
  await alCerebro(26900200, 'Nueva cotización');
  const cDespues = await alCerebro(26900200, 'todavía no sé a dónde');
  ok('ya dentro de la cotización, un «todavía no sé» sigue con el cerebro',
    cDespues && cDespues.data.status === 'sigue');

  /* Y si Vercel recicla la instancia a media cotización, la plática se lee
     del almacén ANTES de decidir: al cliente no se le corta por eso. */
  const hubo = almacen.hayAlmacen;
  const leeCharlaAntes = almacen.leeCharla, leeFichaAntes = almacen.leeFicha;
  almacen.hayAlmacen = function () { return true; };
  almacen.leeCharla = async function (n) { return n === '529926900300' ? { destino: 'Mazatlán', salida: '2026-10-10' } : null; };
  almacen.leeFicha = async function () { return null; };
  const cReciclada = await alCerebro(26900300, 'todavía no sé cuántos vamos');
  almacen.hayAlmacen = hubo; almacen.leeCharla = leeCharlaAntes; almacen.leeFicha = leeFichaAntes;
  ok('con la instancia reciclada, la plática del almacén salva la cotización',
    cReciclada && cReciclada.data.status === 'sigue');

  /* 22-sep-2026: «quita los asteriscos de una vez». Lo que la IA diga con
     negritas de WhatsApp sale al cliente sin asteriscos, en cualquier
     canal (en Facebook e Instagram se veían tal cual). */
  {
    const agenteN = require(path.join(RAIZ, 'api/_agente.js'));
    const conversaAntes = agenteN.conversa;
    agenteN.conversa = async function () { return { respuesta: 'Va, con la *Irizar i6S* 🙌 ¿Qué fecha salen? Te recomiendo la *Sprinter* para 12', datos: {}, accion: 'seguir' }; };
    process.env.ANTHROPIC_API_KEY = 'clave-de-mentiras';
    agenteN.olvida('529926900302');
    const cN = await alCerebro(26900302, 'vamos a vallarta');
    delete process.env.ANTHROPIC_API_KEY; agenteN.conversa = conversaAntes;
    const textoN = String((cN && cN.data && cN.data.texto) || '');
    ok('lo que sale al cliente no lleva asteriscos de negrita: ' + textoN.slice(0, 50), textoN.length > 0 && textoN.indexOf('*') < 0 && /Irizar i6S/.test(textoN));
    ok('  y el texto sin asteriscos es el mismo', /Sprinter para 12/.test(textoN));
  }

  /* 21-sep-2026 (noche), lead real 26919490: en una instancia fría la
     puerta pública ya había escrito el mensaje entrante al almacén; el
     cerebro sembró el historial desde ahí (con ese mismo mensaje) y luego
     lo volvió a apuntar. La IA vio «Buenas tardes…» dos veces. Con el
     almacén devolviendo el mensaje de ESTE turno como fila más nueva, el
     historial lo tiene una sola vez. */
  const agente = require(path.join(RAIZ, 'api/_agente.js'));
  const mensajesDeAntes = almacen.mensajesDe;
  almacen.hayAlmacen = function () { return true; };
  almacen.leeCharla = async function () { return null; };
  almacen.leeFicha = async function () { return null; };
  almacen.mensajesDe = async function (n) {
    return n === '529926900301'
      ? [{ de: 'cliente', texto: 'buenas tardes, quiero cotizar a Toluca', cuando: '2026-09-21T01:50:32Z' }]
      : null;
  };
  /* Con IA (de mentiras): la siembra vive en el camino del agente. */
  const conversaAntes = agente.conversa;
  agente.conversa = async function () { return { respuesta: '¿Cuántos son los que viajan?', datos: { destino: 'Toluca' }, accion: 'seguir' }; };
  process.env.ANTHROPIC_API_KEY = 'clave-de-mentiras';
  agente.olvida('529926900301');
  await alCerebro(26900301, 'buenas tardes, quiero cotizar a Toluca');
  delete process.env.ANTHROPIC_API_KEY; agente.conversa = conversaAntes;
  almacen.hayAlmacen = hubo; almacen.leeCharla = leeCharlaAntes; almacen.leeFicha = leeFichaAntes; almacen.mensajesDe = mensajesDeAntes;
  const vecesCliente = agente.historialDe('529926900301')
    .filter(function (t) { return t.de === 'cliente' && /Toluca/.test(t.texto); }).length;
  ok('el mensaje de este turno, ya guardado en el almacén, queda UNA vez en el historial (no dos): ' + vecesCliente,
    vecesCliente === 1);

  titulo('19-sep: dos sesiones del bot contestando el MISMO mensaje');
  /* Caso real, lead 26878860 (Lucina). El 18-sep le salió el saludo y su
     sesión quedó estacionada esperando que apretara un botón. Contestó 25
     horas después: esa sesión vieja despertó y se fue al cerebro, Y el
     disparador —que tiene una pausa de un día— lanzó otra corrida que
     entró por la puerta. Le llegaron DOS respuestas al mismo segundo.

     El bot de Kommo estaciona sin caducidad y el disparador revive al
     día siguiente: cualquiera que tarde más de un día en contestar cae
     en esto. El candado de aquí es del servidor: el mismo mensaje del
     mismo lead se contesta UNA vez; la segunda sesión se calla y para. */
  const dosSesiones = async function (lead, texto) {
    const antes = continuaciones.length;
    const r1 = respuesta(), r2 = respuesta();
    await atiende(peticion(avisoDe(lead, texto), { 'x-interno': process.env.WHATSAPP_RUTA_SECRETA }, 'kommo-trabajo-puerta'), r1);
    await atiende(peticion(avisoDe(lead, texto), { 'x-interno': process.env.WHATSAPP_RUTA_SECRETA }, 'kommo-trabajo'), r2);
    return continuaciones.slice(antes).map(function (c) { return c.body.data; });
  };
  const dos = await dosSesiones(26900400, 'Muchas gracias');
  ok('las dos sesiones siguen, pero solo UNA le habla al cliente',
    dos.length === 2 && dos.filter(function (d) { return String(d.texto || '') || String(d.pie || ''); }).length === 1);
  ok('  y la segunda se calla y para, sin mensaje vacío',
    dos.length === 2 && dos[1].callado === 'si' && dos[1].status === 'fin');

  /* Y el candado no puede tragarse un mensaje de verdad: el mismo texto
     en OTRO lead se contesta. */
  const deOtro = await dosSesiones(26900401, 'Muchas gracias');
  ok('el mismo texto en otro lead sí se contesta',
    deOtro.length === 2 && deOtro.filter(function (d) { return String(d.texto || ''); }).length === 1);

  titulo('21-sep: con una sesión vieja y una nueva, gana la NUEVA');
  /* Caso real, lead 26818280 (el chat de pruebas del dueño). Su sesión del
     bot estaba estacionada desde el viernes; el lunes escribió «Hola».
     Kommo ya había cerrado esa conversación y abrió otra: la sesión vieja
     despertó y contestó (Sonnet dijo «¡Hola Tacho! ¿Cómo te ayudo…?»),
     pero ese mensaje se perdió en la conversación cerrada. La sesión
     nueva, la del disparador, llegó un segundo después y el candado de
     arriba la CALLÓ. Resultado: silencio total.

     La regla: si el último mensaje del cliente fue hace más de un día, la
     sesión del cerebro es vieja (el disparador, con su pausa de un día,
     está abriendo una nueva por la puerta en ese mismo momento). La vieja
     se calla SIN apartar el mensaje, y la nueva contesta. */
  const tickets = require(path.join(RAIZ, 'api/_tickets.js'));
  const hace25h = Date.now() - 25 * 3600 * 1000;

  tickets.anotaEtapa('529926900600', 'escribio', { clienteEn: hace25h });
  const vieja = await conSesion(26900600, 'Hola', 'kommo-trabajo');
  ok('la sesión vieja (último mensaje hace 25 h) se calla y para',
    vieja.callado === 'si' && vieja.status === 'fin' && !vieja.texto);
  const nueva = await conSesion(26900600, 'Hola', 'kommo-trabajo-puerta');
  ok('  y la nueva, la del disparador, SÍ contesta: saluda',
    nueva.modo === 'saludo' && nueva.callado !== 'si');

  /* Lo que no se puede romper: después del saludo el cliente aprieta
     «Nueva cotización» segundos después. La puerta tiene que apuntar la
     hora de su mensaje; si no, el cerebro seguiría viendo la de hace 25 h
     y se callaría a media cotización. */
  tickets.anotaEtapa('529926900601', 'escribio', { clienteEn: hace25h });
  await conSesion(26900601, 'hola', 'kommo-trabajo-puerta');
  const trasSaludo = await conSesion(26900601, 'Nueva cotización', 'kommo-trabajo');
  ok('tras el saludo, «Nueva cotización» la contesta el cerebro (no se cree vieja)',
    trasSaludo.status === 'sigue' && String(trasSaludo.texto || '').length > 0);

  /* Y si el cerebro llega primero SIN ser vieja, la puerta no se calla: más
     vale una respuesta doble que ninguna. */
  const cerebroPrimero = await conSesion(26900602, 'buenas tardes', 'kommo-trabajo');
  const puertaDespues = await conSesion(26900602, 'buenas tardes', 'kommo-trabajo-puerta');
  ok('cerebro primero y puerta después: la puerta NO se calla',
    cerebroPrimero && puertaDespues.callado !== 'si' && puertaDespues.modo === 'saludo');

  /* El primer intento de este candado fue «mismo lead y mismo texto», y se
     llevó por delante una conversación entera: el cliente contesta «sí» a
     dos preguntas seguidas y el segundo «sí» se perdía. Dos turnos del
     CEREBRO con el mismo texto son normales y los dos trabajan. */
  const antesDelSi = continuaciones.length;
  await alCerebro(26900500, 'quiero cotizar a Mazatlán');
  await alCerebro(26900500, 'sí');
  await alCerebro(26900500, 'sí');
  const tresTurnos = continuaciones.slice(antesDelSi).map(function (c) { return c.body.data; });
  ok('dos «sí» seguidos en la misma cotización se contestan los dos',
    tresTurnos.length === 3 && tresTurnos.every(function (d) { return d.callado !== 'si'; }));

  titulo('21-sep: dos clientes entrelazados, y ninguno ve al otro');
  {
    /* Dictado del dueño: «no mezcles chats, me importa mucho eso». Dos
       leads escriben alternados por el camino real completo (puerta,
       cerebro, ficha, plática, nota en el lead). Cada uno da un dato que
       el otro no puede tener: el destino, la gente y un nombre. */
    const A = 26900910, B = 26900911;
    const deA = function (t) { return conSesion(A, t, 'kommo-trabajo'); };
    const deB = function (t) { return conSesion(B, t, 'kommo-trabajo'); };
    await conSesion(A, 'hola', 'kommo-trabajo-puerta');
    await conSesion(B, 'hola', 'kommo-trabajo-puerta');
    await deA('Nueva cotización'); await deB('Nueva cotización');
    /* El nombre va en su propio mensaje: aquí contesta el guion (sin IA) y
       «soy Lucía Acme, a chapala…» se lo lee como destino «Acme». Eso es
       del guion de respaldo, no de la separación entre chats. */
    /* Un dato por mensaje, como escribe un cliente, y siempre alternando:
       cada mensaje de A cae entre dos de B. */
    const pasosA = ['me llamo Ramiro Pérez', 'a mazatlán', 'del 1 al 3 de noviembre', '45', 'el i6s', 'de guadalajara', 'solo nos llevan y traen'];
    const pasosB = ['me llamo Lucía Acme', 'a chapala', 'el 4 de octubre', 'mismo día', '12', 'de guadalajara', 'solo ida y vuelta'];
    const dichoA = [], dichoB = [];
    for (let i = 0; i < pasosA.length; i++) {
      dichoA.push(await deA(pasosA[i]));
      dichoB.push(await deB(pasosB[i]));
    }
    const junta = function (lista) { return lista.map(function (d) { return String((d && (d.texto || d.pie)) || ''); }).join('\n'); };
    const textoA = junta(dichoA), textoB = junta(dichoB);
    ok('el resumen de A trae Mazatlán y sus 45', /Mazatl[aá]n/.test(textoA) && /45/.test(textoA));
    ok('  y NADA de B: ni Chapala, ni 12 personas, ni Acme', !/Chapala|Acme|12 personas/.test(textoA));
    ok('el resumen de B trae Chapala y sus 12', /Chapala/.test(textoB) && /12/.test(textoB));
    ok('  y NADA de A: ni Mazatlán, ni 45, ni Pérez, ni el i6S', !/Mazatl[aá]n|P[eé]rez|45|i6S/.test(textoB));
    const fichaA = tickets.fichaDe('5299' + A), fichaB = tickets.fichaDe('5299' + B);
    ok('las fichas son distintas y cada una guarda solo su viaje',
      fichaA && fichaB && fichaA !== fichaB &&
      JSON.stringify(fichaA).indexOf('Chapala') < 0 && JSON.stringify(fichaB).indexOf('Mazatl') < 0);
    const notasA = notas.filter(function (n) { return /\/leads\/26900910\//.test(n.url); });
    const notasB = notas.filter(function (n) { return /\/leads\/26900911\//.test(n.url); });
    /* Las notas en el lead (si las hubo en este camino) también van cada
       una al suyo y solo hablan de su viaje. */
    ok('ninguna nota de un lead menciona el viaje del otro',
      notasA.every(function (n) { return !/Chapala|Acme/.test(n.body[0].params.text); }) &&
      notasB.every(function (n) { return !/Mazatl|P[eé]rez|i6S/.test(n.body[0].params.text); }));
  }

  titulo('21-sep: una foto a media plática llega como «imagen» y es un comprobante');
  {
    /* El dueño mandó una foto y el bot (Sonnet) contestó «me llegó la imagen
       pero no la puedo ver bien, ¿qué es?». Criterio del dueño: las fotos
       son abonos. Aunque la IA esté encendida, esto no es para la IA. */
    const notasAntes = notas.length;
    const foto = await conSesion(26838770, 'imagen', 'kommo-trabajo');
    ok('«imagen» → acuse de pago y el bot para', foto.status === 'fin' && foto.texto === TEXTOS_FIJOS.comprobanteRecibido);
    ok('  con nota de comprobante en SU lead', notas.length === notasAntes + 1 && /\/leads\/26838770\/notes$/.test(notas[notasAntes].url));
    const audio = await conSesion(26838770, 'audio', 'kommo-trabajo');
    ok('«audio» → pide que lo escriba por texto, y para', audio.status === 'fin' && audio.texto === TEXTOS_FIJOS.audioRecibido);
    ok('  sin nota de comprobante', notas.length === notasAntes + 1);
  }

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
