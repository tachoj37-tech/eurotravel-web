/* ------------------------------------------------------------
   LAS NOTAS DE VOZ
   ------------------------------------------------------------
   En WhatsApp mexicano mucha gente manda audio antes que
   escribir. Sin esto, el bot pierde al cliente en el primer
   mensaje.

   Lo que se vigila aquí, en orden de qué tan caro sale si falla:

   1 · Que un audio LARGO no se transcriba. El dueño lo dictó:
       «que la IA no escuche audios arriba del minuto, eso que lo
       escuche la persona vendedor». Y es también el que cuesta.
   2 · Que un audio transcrito entre al bot COMO SI LO HUBIERAN
       ESCRITO — o sea que el bot entero siga funcionando igual.
   3 · Que sin claves no truene nada.
   4 · Que ninguna respuesta anuncie que pasa con alguien.

   Nada de aquí llama a Groq ni a Meta de verdad: el `fetch` se
   inyecta. Estas pruebas no cuestan un centavo.
   ------------------------------------------------------------ */

const hook = require('../api/_whatsapp-webhook.js');
const tr = require('../api/_transcribe.js');
const crypto = require('crypto');

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
function okQue(que, condicion) { ok(que, !!condicion, true); }
function titulo(t) { console.log('\n== ' + t.toUpperCase() + ' =='); }

const pendientes = [];
const SECRETO = 'secreto-de-prueba';
const ENV = { WHATSAPP_APP_SECRET: SECRETO };

function firma(cuerpo) {
  return 'sha256=' + crypto.createHmac('sha256', SECRETO)
    .update(Buffer.from(cuerpo, 'utf8')).digest('hex');
}

/* Un aviso de Meta con una nota de voz. */
function avisoConAudio(idAudio, idMensaje) {
  return JSON.stringify({
    entry: [{ changes: [{ value: {
      metadata: { phone_number_id: '111' },
      messages: [{
        id: idMensaje || 'msg-' + idAudio,
        from: '5213300000000',
        type: 'audio',
        audio: { id: idAudio, mime_type: 'audio/ogg', voice: true }
      }]
    } }] }]
  });
}

function corre(cuerpo, audios) {
  return hook.procesa(Buffer.from(cuerpo, 'utf8'), firma(cuerpo),
    Object.assign({}, ENV, { audios: audios || {} }));
}

/* ============================================================ */
titulo('los ids de audio se sacan del aviso');

ok('encuentra el audio', hook.idsDeAudio(JSON.parse(avisoConAudio('aud1'))), ['aud1']);
ok('un aviso sin audios da lista vacía',
  hook.idsDeAudio({ entry: [{ changes: [{ value: { messages: [
    { id: 'm1', type: 'text', text: { body: 'hola' } }] } }] }] }), []);
ok('el mismo audio repetido se transcribe UNA vez, no dos',
  hook.idsDeAudio({ entry: [{ changes: [{ value: { messages: [
    { id: 'm1', type: 'audio', audio: { id: 'aud9' } },
    { id: 'm2', type: 'audio', audio: { id: 'aud9' } }] } }] }] }), ['aud9']);
ok('un aviso vacío no truena', hook.idsDeAudio(null), []);

/* ============================================================ */
titulo('un audio transcrito entra como si lo hubieran escrito');

hook.olvidaTodo();
{
  const r = corre(avisoConAudio('aud-corto', 'm-corto'),
    { 'aud-corto': { texto: 'somos 16 vamos a tequila' } });
  okQue('contesta algo', r.envios.length === 1);
  /* LA PRUEBA QUE IMPORTA: el bot reconoció que son 16 y les
     recomendó Sprinter. O sea que el audio recorrió TODO el bot
     igual que un mensaje escrito, sin tocarle una línea. */
  okQue('y el bot lo trató como texto normal: recomendó la Sprinter',
    /Sprinter/i.test(r.envios[0].texto));
  okQue('no pide que lo escriba', !/pones en un mensaje/i.test(r.envios[0].texto));
  okQue('y NO se marca para el vendedor: se resolvió solo',
    r.envios[0].pasaAPersona !== true);
}

/* ============================================================ */
titulo('arriba del minuto lo oye el vendedor, no la IA');

hook.olvidaTodo();
{
  const r = corre(avisoConAudio('aud-largo', 'm-largo'),
    { 'aud-largo': { muyLargo: true, bytes: 400000 } });
  okQue('contesta', r.envios.length === 1);
  okQue('dice que lo va a escuchar, no que no puede',
    /ahorita lo escucho/i.test(r.envios[0].texto));
  /* Y sigue vendiendo mientras tanto: no se despide. */
  okQue('y sostiene la conversación pidiendo lo que falta',
    /a dónde van y cuántos son/i.test(r.envios[0].texto));
  okQue('SÍ se marca para el vendedor', r.envios[0].pasaAPersona === true);
}

titulo('y ningún caso de audio anuncia que pasa con alguien');

/* El bot vive DENTRO del chat del vendedor: no hay a quién pasar. */
const DELATA = /te paso con|paso con (?:una persona|alguien)|un (?:vendedor|asesor) te|te contactar[aá]|m[aá]rcale al/i;
[['largo', { 'a1': { muyLargo: true } }],
 ['no se pudo transcribir', {}],
 ['transcrito', { 'a1': { texto: 'hola que tal' } }]
].forEach(function (c) {
  hook.olvidaTodo();
  const r = corre(avisoConAudio('a1', 'm-' + c[0]), c[1]);
  okQue('el caso «' + c[0] + '» no delata', !DELATA.test(r.envios[0].texto));
});

/* ============================================================ */
titulo('sin claves no truena, solo no transcribe');

pendientes.push((async function () {
  ok('sin claves devuelve null', await tr.transcribe('aud1', {}), null);
  ok('sin id tampoco truena',
    await tr.transcribe('', { tokenMeta: 'x', claveGroq: 'y', pide: function () {} }), null);
})());

/* ============================================================ */
titulo('el tope del minuto se mide por peso, y se revisa DOS veces');

/* El aviso de Meta NO trae la duración del audio: trae el tamaño.
   El minuto se estima con eso —Opus a ~16 kbps son ~2 KB/segundo—
   y por eso el tope está en 160 KB. */
ok('el tope es de 160 KB', tr.TOPE_BYTES, 160 * 1024);

pendientes.push((async function () {
  /* 1 · Meta dice que pesa de más: NI SE BAJA. Ese es el ahorro. */
  let bajadas = 0;
  const grande = await tr.transcribe('aud1', {
    tokenMeta: 'tok', claveGroq: 'gr',
    pide: function (url) {
      if (String(url).indexOf('graph.facebook.com') !== -1) {
        return Promise.resolve({ ok: true, json: function () {
          return Promise.resolve({ url: 'https://media/x', file_size: 900000 });
        } });
      }
      bajadas++;
      return Promise.resolve({ ok: true });
    }
  });
  ok('un audio grande se marca como muy largo', grande && grande.muyLargo, true);
  ok('y NO se descarga: ahí está el ahorro', bajadas, 0);

  /* 2 · Meta MIENTE sobre el tamaño —o no lo manda— y el archivo
     real viene enorme. El tope tiene que atraparlo igual: un tope
     que solo confía en lo que le dicen no es un tope. */
  const mentiroso = await tr.transcribe('aud2', {
    tokenMeta: 'tok', claveGroq: 'gr',
    pide: function (url) {
      if (String(url).indexOf('graph.facebook.com') !== -1) {
        return Promise.resolve({ ok: true, json: function () {
          return Promise.resolve({ url: 'https://media/x' });   // sin file_size
        } });
      }
      return Promise.resolve({ ok: true, arrayBuffer: function () {
        return Promise.resolve(new ArrayBuffer(900000));
      } });
    }
  });
  ok('si Meta no dice el tamaño, se revisa el archivo de verdad',
    mentiroso && mentiroso.muyLargo, true);

  /* 3 · Uno normal sí se transcribe. */
  const bueno = await tr.transcribe('aud3', {
    tokenMeta: 'tok', claveGroq: 'gr',
    pide: function (url) {
      if (String(url).indexOf('graph.facebook.com') !== -1) {
        return Promise.resolve({ ok: true, json: function () {
          return Promise.resolve({ url: 'https://media/x', file_size: 40000 });
        } });
      }
      if (String(url).indexOf('groq.com') !== -1) {
        return Promise.resolve({ ok: true, json: function () {
          return Promise.resolve({ text: '  somos 16 a tequila el 12  ' });
        } });
      }
      return Promise.resolve({ ok: true, arrayBuffer: function () {
        return Promise.resolve(new ArrayBuffer(40000));
      } });
    }
  });
  ok('un audio normal se transcribe y viene limpio',
    bueno && bueno.texto, 'somos 16 a tequila el 12');

  /* 4 · Puro ruido: cadena vacía o dos letras. Mandarle eso al bot
     solo lo haría contestar que no entendió. */
  const ruido = await tr.transcribe('aud4', {
    tokenMeta: 'tok', claveGroq: 'gr',
    pide: function (url) {
      if (String(url).indexOf('graph.facebook.com') !== -1) {
        return Promise.resolve({ ok: true, json: function () {
          return Promise.resolve({ url: 'https://media/x', file_size: 3000 });
        } });
      }
      if (String(url).indexOf('groq.com') !== -1) {
        return Promise.resolve({ ok: true, json: function () {
          return Promise.resolve({ text: 'eh' });
        } });
      }
      return Promise.resolve({ ok: true, arrayBuffer: function () {
        return Promise.resolve(new ArrayBuffer(3000));
      } });
    }
  });
  ok('un audio de puro ruido no se manda al bot', ruido, null);

  /* 5 · Si Groq falla, no truena: simplemente no hay transcripción. */
  const falla = await tr.transcribe('aud5', {
    tokenMeta: 'tok', claveGroq: 'gr',
    pide: function (url) {
      if (String(url).indexOf('graph.facebook.com') !== -1) {
        return Promise.resolve({ ok: true, json: function () {
          return Promise.resolve({ url: 'https://media/x', file_size: 3000 });
        } });
      }
      if (String(url).indexOf('groq.com') !== -1) {
        return Promise.resolve({ ok: false, status: 500 });
      }
      return Promise.resolve({ ok: true, arrayBuffer: function () {
        return Promise.resolve(new ArrayBuffer(3000));
      } });
    }
  });
  ok('si Groq falla, devuelve null en vez de tronar', falla, null);
})());

/* ============================================================ */
titulo('no se le cree a una transcripcion dudosa');

/* Lo mas importante de todo esto, mas que el modelo: Whisper SIEMPRE
   devuelve algo. Con audio malo no dice «no entendi» — se inventa
   palabras que suenan parecido. Y una palabra inventada aqui no es un
   detalle: es otro destino, y otro destino es otro precio.

   Es R45 aplicada al oido: si no se sabe al 100 %, no se actua. */
ok('la mitad o mas de segmentos flojos es dudosa',
  tr.esDudosa({ segments: [
    { avg_logprob: -1.5 }, { avg_logprob: -1.2 },
    { avg_logprob: -0.2 }, { no_speech_prob: 0.9 }] }), true);
ok('un segmento flojo entre varios NO lo es (una tos, un claxon)',
  tr.esDudosa({ segments: [
    { avg_logprob: -1.5 }, { avg_logprob: -0.2 },
    { avg_logprob: -0.1 }, { avg_logprob: -0.3 }] }), false);
ok('sin segmentos no se juzga', tr.esDudosa({ text: 'hola' }), false);
ok('sin nada tampoco truena', tr.esDudosa(null), false);

/* Y el vocabulario sale del catalogo de VERDAD: si el dueño da de alta
   un destino, entra solo. Sin esto «Ocotlan» sale «ocotlan» y
   «Sprinter» sale «printer» — justo las palabras de las que depende el
   precio. */
const voz = tr.vocabulario();
okQue('el vocabulario trae las unidades', /Sprinter/.test(voz));
okQue('y destinos del catalogo real', /Chapala|Tequila|Vallarta/.test(voz));
okQue('y no se pasa del tope del prompt', voz.length <= 850);

titulo('un audio dudoso lo oye el vendedor, no el bot');

hook.olvidaTodo();
{
  const r = corre(avisoConAudio('aud-dudoso', 'm-dudoso'),
    { 'aud-dudoso': { dudosa: true, texto: 'vamos a ocosingo el trece' } });
  /* Se entendio ALGO, pero no se le cree: el bot NO cotiza con eso. */
  /* Lo que NO puede pasar es que arranque a cotizar con lo que oyo mal:
     ni recomendar unidad, ni repetirle un destino que quiza no dijo.
     (Ojo: la palabra «precio» SI aparece, en «te voy armando el
     precio» — buscarla a secas hacia fallar esta prueba sin razon.) */
  okQue('no recomienda unidad con lo que oyo mal',
    !/Sprinter|Suburban|autob[uú]s/i.test(r.envios[0].texto));
  okQue('ni le repite un destino que quiza no dijo',
    !/ocosingo/i.test(r.envios[0].texto));
  okQue('dice que lo va a escuchar', /ahorita lo escucho/i.test(r.envios[0].texto));
  okQue('y se marca para el vendedor', r.envios[0].pasaAPersona === true);
}

/* ============================================================ */
Promise.all(pendientes).then(function () {
  console.log('\n' + buenas + ' buenas, ' + malas + ' malas');
  process.exit(malas ? 1 : 0);
});
