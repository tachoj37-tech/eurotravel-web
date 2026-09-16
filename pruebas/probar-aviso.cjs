/* ============================================================
   Pruebas del aviso instantáneo — sin red
   ------------------------------------------------------------
       node pruebas/probar-aviso.cjs

   Lo que se juega aquí NO es que el aviso llegue: es que el
   aviso NUNCA rompa un cobro. `_aviso.js` cuelga del mismo hilo
   que le contesta a Stripe, así que un número mal escrito, un
   token vencido o un Meta que no contesta tienen que terminar
   en un renglón del registro y en nada más.

   Y lo segundo: que no se filtre nada. En el registro van los
   ÚLTIMOS CUATRO dígitos de cada número y jamás el token.
   ============================================================ */
'use strict';
const aviso = require('../api/_aviso.js');

let buenas = 0, malas = 0;
function igual(nombre, dio, esperado) {
  const a = JSON.stringify(dio), b = JSON.stringify(esperado);
  if (a === b) { buenas++; console.log('ok   ' + nombre); }
  else { malas++; console.log('MAL  ' + nombre + '\n     dio      ' + a + '\n     esperaba ' + b); }
}
function cierto(nombre, v) { igual(nombre, !!v, true); }
function falso(nombre, v) { igual(nombre, !!v, false); }

const VARIABLES = ['AVISO_WA_TOKEN', 'AVISO_WA_PHONE_ID', 'AVISO_WA_A', 'AVISO_WA_PLANTILLA',
  'AVISO_WA_IDIOMA', 'AVISO_WA_API_BASE', 'AVISO_TELEGRAM_TOKEN', 'AVISO_TELEGRAM_CHAT'];

function apagaTodo() {
  for (const v of VARIABLES) delete process.env[v];
  delete process.env.WHATSAPP_API_BASE;
}

const TOKEN_WA = 'EAAG_token_de_mentiras_que_no_debe_salir_en_el_registro';
const TOKEN_TG = '7777777:TG_token_de_mentiras';

function prendeWhats() {
  process.env.AVISO_WA_TOKEN = TOKEN_WA;
  process.env.AVISO_WA_PHONE_ID = '123456789012345';
  process.env.AVISO_WA_A = '5213312345678, 5213319876543';
  process.env.AVISO_WA_PLANTILLA = 'venta_en_la_pagina';
}

function prendeTelegram() {
  process.env.AVISO_TELEGRAM_TOKEN = TOKEN_TG;
  process.env.AVISO_TELEGRAM_CHAT = '11111111,22222222';
}

const VENTA = {
  clase: 'venta',
  folio: 'ET-K3M9-4Q2 · contrato 52001',
  cliente: 'Juana Pérez López',
  destino: 'Puerto Vallarta, Jalisco',
  salida: '2026-09-03T08:00',
  unidad: 'Sprinter',
  total: 21700,
  anticipo: 4340
};

/* Un `fetch` de mentiras que apunta todo lo que sale y contesta lo que se
   le diga, por destino. Nada de red: si una prueba tocara la red de verdad,
   dejaría de ser una prueba. */
let LLAMADAS = [];
function fingeRed(reglas) {
  LLAMADAS = [];
  const r = reglas || {};
  global.fetch = function (url, opc) {
    const u = String(url);
    const llamada = { url: u, opciones: opc, cuerpo: JSON.parse((opc && opc.body) || '{}') };
    LLAMADAS.push(llamada);
    const decide = u.indexOf('api.telegram.org') >= 0 ? r.telegram : r.whatsapp;
    const d = (typeof decide === 'function' ? decide(llamada) : decide) || { status: 200, cuerpo: {} };
    if (d.cuelga) return new Promise(function () {});          // nunca contesta
    if (d.truena) return Promise.reject(new Error(d.truena));
    return Promise.resolve({
      ok: d.status >= 200 && d.status < 300,
      status: d.status,
      text: function () { return Promise.resolve(JSON.stringify(d.cuerpo || {})); },
      json: function () { return Promise.resolve(d.cuerpo || {}); }
    });
  };
}

function lasDeWhats() {
  return LLAMADAS.filter(function (l) { return l.url.indexOf('/messages') > 0; });
}
function lasDeTelegram() {
  return LLAMADAS.filter(function (l) { return l.url.indexOf('api.telegram.org') >= 0; });
}

/* El registro, capturado. Lo que se escribe ahí es tan parte del trato como
   lo que se manda: es lo único que queda cuando algo falla. */
let REGISTRO = [];
function escucha() {
  REGISTRO = [];
  const log = console.log, err = console.error;
  console.log = function () { REGISTRO.push(Array.prototype.join.call(arguments, ' ')); };
  console.error = function () { REGISTRO.push(Array.prototype.join.call(arguments, ' ')); };
  return function () { console.log = log; console.error = err; };
}

(async function () {

  /* ============================================================
     APAGADO: NO MANDA NADA Y NO TRUENA
     ------------------------------------------------------------
     Es el estado de hoy —ninguna variable puesta— y el estado de
     siempre en local. Un módulo apagado que tronara sería un
     cobro roto por una variable que falta.
     ============================================================ */
  apagaTodo();
  fingeRed({});
  {
    const calla = escucha();
    const uno = await aviso.avisa(VENTA);
    const dos = await aviso.avisa(VENTA);
    calla();

    igual('apagado: no manda nada', LLAMADAS.length, 0);
    igual('apagado: lo dice en el resumen', [uno.apagado, uno.mandados, uno.fallidos], [true, 0, 0]);
    igual('apagado: lo dice UNA vez en el registro, no en cada cobro',
      REGISTRO.filter(function (l) { return /apagado/i.test(l); }).length, 1);
    cierto('apagado: y el segundo aviso tampoco truena', dos && dos.apagado);
  }

  /* ============================================================
     WHATSAPP: LA PLANTILLA, TAL COMO LA PIDE META
     ============================================================ */
  apagaTodo();
  prendeWhats();
  fingeRed({ whatsapp: { status: 200, cuerpo: { messages: [{ id: 'wamid.1' }] } } });
  {
    const calla = escucha();
    const res = await aviso.avisa(VENTA);
    calla();

    igual('whatsapp: un envío por destinatario, ni uno más', lasDeWhats().length, 2);
    igual('whatsapp: la dirección es la de Meta con el id del número',
      lasDeWhats()[0].url, 'https://graph.facebook.com/v21.0/123456789012345/messages');
    igual('whatsapp: el token va en la cabecera',
      lasDeWhats()[0].opciones.headers.Authorization, 'Bearer ' + TOKEN_WA);
    igual('whatsapp: y el tipo de contenido',
      lasDeWhats()[0].opciones.headers['Content-Type'], 'application/json');
    igual('whatsapp: es POST', lasDeWhats()[0].opciones.method, 'POST');

    const c = lasDeWhats()[0].cuerpo;
    igual('whatsapp: el cuerpo es el de una plantilla',
      [c.messaging_product, c.type, c.template.name, c.template.language.code],
      ['whatsapp', 'template', 'venta_en_la_pagina', 'es_MX']);
    igual('whatsapp: el 521 de México se normaliza igual que en el bot', c.to, '523312345678');
    igual('whatsapp: el segundo destinatario es el otro número',
      lasDeWhats()[1].cuerpo.to, '523319876543');

    const p = c.template.components[0].parameters;
    igual('whatsapp: un solo componente, el cuerpo',
      [c.template.components.length, c.template.components[0].type], [1, 'body']);
    igual('whatsapp: siete parámetros, todos de texto',
      [p.length, p.every(function (x) { return x.type === 'text'; })], [7, true]);
    igual('whatsapp: el orden es folio · cliente · destino · salida · unidad · total · anticipo',
      p.map(function (x) { return x.text; }),
      ['ET-K3M9-4Q2 · contrato 52001', 'Juana Pérez López', 'Puerto Vallarta, Jalisco',
       '03/09/2026 08:00', 'Sprinter', '$21,700', 'Anticipo $4,340']);

    igual('whatsapp: el resumen cuenta los dos',
      [res.mandados, res.fallidos, res.apagado], [2, 0, false]);

    const registro = REGISTRO.join('\n');
    cierto('registro: nombra los últimos cuatro del primer número', /5678/.test(registro));
    cierto('registro: y los del segundo', /6543/.test(registro));
    falso('registro: NUNCA el número completo', /5213312345678/.test(registro));
    falso('registro: NUNCA el token', registro.indexOf(TOKEN_WA) >= 0);
  }

  /* ============================================================
     LOS PARÁMETROS SE SANEAN O META LOS RECHAZA
     ------------------------------------------------------------
     Un salto de línea, un tabulador o cuatro espacios seguidos
     dentro de un parámetro y Meta tira el mensaje entero con un
     error de la familia 132000. Nadie se entera: el dueño
     simplemente no recibe el aviso de una venta.
     ============================================================ */
  apagaTodo();
  prendeWhats();
  process.env.AVISO_WA_A = '5213312345678';
  fingeRed({ whatsapp: { status: 200, cuerpo: {} } });
  {
    const calla = escucha();
    await aviso.avisa(Object.assign({}, VENTA, {
      cliente: '  Juana\n\tPérez    López  ',
      destino: 'Un destino con un nombre absurdamente largo que nadie escribiría jamás en la vida real',
      unidad: ''
    }));
    calla();

    const p = lasDeWhats()[0].cuerpo.template.components[0].parameters.map(function (x) { return x.text; });
    igual('saneado: sin saltos, sin tabuladores, sin espacios de sobra', p[1], 'Juana Pérez López');
    cierto('saneado: ningún parámetro pasa de 60', p.every(function (t) { return t.length <= 60; }));
    cierto('saneado: ninguno trae \\n ni \\t', p.every(function (t) { return !/[\n\t]/.test(t); }));
    cierto('saneado: ninguno trae cuatro espacios seguidos', p.every(function (t) { return !/ {4}/.test(t); }));
    igual('saneado: un dato vacío no viaja vacío —Meta lo rechaza—', p[4], '—');
  }

  /* ============================================================
     TELEGRAM: TEXTO PLANO, GRATIS E INSTANTÁNEO
     ============================================================ */
  apagaTodo();
  prendeTelegram();
  fingeRed({ telegram: { status: 200, cuerpo: { ok: true } } });
  {
    const res = await aviso.avisa(VENTA);

    igual('telegram: un envío por chat', lasDeTelegram().length, 2);
    igual('telegram: la dirección lleva el token y sendMessage',
      lasDeTelegram()[0].url, 'https://api.telegram.org/bot' + TOKEN_TG + '/sendMessage');
    igual('telegram: a cada chat el suyo',
      lasDeTelegram().map(function (l) { return String(l.cuerpo.chat_id); }), ['11111111', '22222222']);

    const t = String(lasDeTelegram()[0].cuerpo.text);
    cierto('telegram: el texto trae el folio', t.indexOf('ET-K3M9-4Q2') >= 0);
    cierto('telegram: el destino', t.indexOf('Puerto Vallarta') >= 0);
    cierto('telegram: la fecha de salida', t.indexOf('03/09/2026') >= 0);
    cierto('telegram: el total', t.indexOf('$21,700') >= 0);
    cierto('telegram: el anticipo', t.indexOf('$4,340') >= 0);
    cierto('telegram: y aquí sí se permiten renglones', t.indexOf('\n') > 0);
    igual('telegram: el resumen cuenta los dos', [res.mandados, res.fallidos], [2, 0]);
  }

  /* ============================================================
     DE QUÉ DINERO SE TRATA, SIN ADIVINAR
     ------------------------------------------------------------
     Una venta nueva y un abono de un cliente entran por el mismo
     aviso. Si el dueño no puede distinguirlos de un vistazo, el
     aviso le sirve para la mitad.
     ============================================================ */
  apagaTodo();
  prendeWhats();
  prendeTelegram();
  process.env.AVISO_WA_A = '5213312345678';
  process.env.AVISO_TELEGRAM_CHAT = '11111111';
  fingeRed({});
  {
    await aviso.avisa({ clase: 'abono', folio: 'contrato 43773', cliente: 'Juana Pérez López',
      destino: '', salida: '', unidad: '', total: '', anticipo: 5000 });

    const p = lasDeWhats()[0].cuerpo.template.components[0].parameters.map(function (x) { return x.text; });
    igual('abono: el séptimo parámetro dice que es un abono, no un anticipo', p[6], 'Abono $5,000');
    const t = String(lasDeTelegram()[0].cuerpo.text);
    cierto('abono: y el texto de Telegram lo grita', /ABONO/i.test(t));
    falso('abono: sin confundirlo con una venta nueva', /VENTA NUEVA/i.test(t));
  }

  apagaTodo();
  prendeTelegram();
  process.env.AVISO_TELEGRAM_CHAT = '11111111';
  fingeRed({});
  {
    await aviso.avisa(VENTA);
    cierto('venta: el texto de Telegram la nombra',
      /VENTA NUEVA/i.test(String(lasDeTelegram()[0].cuerpo.text)));
  }

  /* ============================================================
     UN NÚMERO MALO NO SE LLEVA AL OTRO
     ------------------------------------------------------------
     Son dos teléfonos justamente para que haya dos. Si el
     primero falla y el segundo no sale, no había dos.
     ============================================================ */
  apagaTodo();
  prendeWhats();
  prendeTelegram();
  fingeRed({
    whatsapp: function (l) {
      return l.cuerpo.to === '523312345678'
        ? { status: 400, cuerpo: { error: { code: 131026, message: 'Receiver is incapable' } } }
        : { status: 200, cuerpo: {} };
    },
    telegram: { status: 200, cuerpo: { ok: true } }
  });
  {
    const calla = escucha();
    const res = await aviso.avisa(VENTA);
    calla();

    igual('un número malo: al otro se le manda igual', lasDeWhats().length, 2);
    igual('un número malo: y Telegram no se entera', lasDeTelegram().length, 2);
    igual('un número malo: el resumen lo cuenta aparte',
      [res.mandados, res.fallidos], [3, 1]);
    cierto('un número malo: queda escrito con sus últimos cuatro',
      REGISTRO.join('\n').indexOf('5678') >= 0);
    falso('un número malo: y sin el número entero',
      REGISTRO.join('\n').indexOf('5213312345678') >= 0);
  }

  /* -------- y si truena la llamada entera (sin red), igual -------- */
  apagaTodo();
  prendeWhats();
  fingeRed({
    whatsapp: function (l) {
      return l.cuerpo.to === '523312345678' ? { truena: 'sin red' } : { status: 200, cuerpo: {} };
    }
  });
  {
    const calla = escucha();
    const res = await aviso.avisa(VENTA);
    calla();
    igual('sin red en un envío: el otro sale', [res.mandados, res.fallidos], [1, 1]);
  }

  /* ============================================================
     UN ENVÍO COLGADO NO CUELGA EL COBRO
     ------------------------------------------------------------
     Es el caso que más caro sale: Meta no contesta, el `await`
     se queda esperando, Stripe se cansa y da el aviso por
     fallido. El tope vive DENTRO del módulo —no solo en la
     señal del fetch— porque quien no contesta tampoco atiende
     un abort.
     ============================================================ */
  apagaTodo();
  prendeWhats();
  process.env.AVISO_WA_A = '5213312345678';
  fingeRed({ whatsapp: { cuelga: true } });
  {
    const calla = escucha();
    const arranque = Date.now();
    const res = await aviso.avisa(VENTA, { esperaMs: 40 });
    const tardo = Date.now() - arranque;
    calla();

    igual('colgado: el tope salta y el aviso termina', [res.mandados, res.fallidos], [0, 1]);
    cierto('colgado: y termina rápido, no cuando Meta quiera', tardo < 3000);
    cierto('colgado: queda escrito', /aviso/i.test(REGISTRO.join('\n')));
  }

  igual('el tope de siempre son 4 segundos, como el resto de las llamadas de fuera',
    aviso.ESPERA_MS, 4000);

  /* ============================================================
     PASE LO QUE PASE, `avisa` NO TRUENA
     ------------------------------------------------------------
     El cobro cuelga de este renglón. Si `avisa` pudiera lanzar,
     una venta cobrada terminaría en un 500 por culpa de un
     mensaje de cortesía.
     ============================================================ */
  apagaTodo();
  prendeWhats();
  {
    global.fetch = function () { throw new Error('un fetch que ni promesa devuelve'); };
    const calla = escucha();
    const res = await aviso.avisa(VENTA);
    calla();
    cierto('un fetch que truena en seco: devuelve resumen y no lanza', res && res.fallidos >= 1);
  }
  {
    global.fetch = undefined;
    const calla = escucha();
    const res = await aviso.avisa(VENTA);
    calla();
    cierto('sin fetch en el entorno: devuelve resumen y no lanza', !!res);
  }
  {
    fingeRed({});
    const calla = escucha();
    const res = await aviso.avisa(null);
    calla();
    cierto('sin datos: tampoco lanza', !!res);
  }

  /* ============================================================
     MEDIO CANAL ES CANAL APAGADO
     ------------------------------------------------------------
     Un token sin destinatarios, o destinatarios sin plantilla,
     no es «casi listo»: es un canal que no puede mandar. Se
     apaga entero en vez de intentar y fallar en cada cobro.
     ============================================================ */
  for (const falta of ['AVISO_WA_TOKEN', 'AVISO_WA_PHONE_ID', 'AVISO_WA_A', 'AVISO_WA_PLANTILLA']) {
    apagaTodo();
    prendeWhats();
    delete process.env[falta];
    fingeRed({});
    const calla = escucha();
    const res = await aviso.avisa(VENTA);
    calla();
    igual('sin ' + falta + ': whatsapp apagado, nada sale', [lasDeWhats().length, res.apagado], [0, true]);
  }

  apagaTodo();
  process.env.AVISO_TELEGRAM_TOKEN = TOKEN_TG;
  fingeRed({});
  {
    const calla = escucha();
    const res = await aviso.avisa(VENTA);
    calla();
    igual('telegram con token y sin chat: apagado', [lasDeTelegram().length, res.apagado], [0, true]);
  }

  /* -------- el idioma de la plantilla se puede cambiar sin tocar código -------- */
  apagaTodo();
  prendeWhats();
  process.env.AVISO_WA_A = '5213312345678';
  process.env.AVISO_WA_IDIOMA = 'es';
  fingeRed({});
  {
    await aviso.avisa(VENTA);
    igual('el idioma sale de la variable', lasDeWhats()[0].cuerpo.template.language.code, 'es');
  }

  /* -------- y a dónde se manda, también (Dualhook, día que toque) -------- */
  apagaTodo();
  prendeWhats();
  process.env.AVISO_WA_A = '5213312345678';
  process.env.AVISO_WA_API_BASE = 'https://api.dualhook.com/v25.0/';
  fingeRed({});
  {
    await aviso.avisa(VENTA);
    igual('la base se puede cambiar y se le quita la barra de sobra',
      lasDeWhats()[0].url, 'https://api.dualhook.com/v25.0/123456789012345/messages');
  }

  apagaTodo();
  console.log('\n' + buenas + ' buenas, ' + malas + ' malas');
  process.exit(malas ? 1 : 0);
})();
