/* ============================================================
   EL AVISO INSTANTÁNEO — «avisar al instante», en un solo dueño
   ------------------------------------------------------------
   Pedido del dueño, 15-sep-2026:

     «necesito una notificación a un número cuando se genere un
      contrato, tiene que llegar a 2 números de whatsapp…
      necesito que sea instantáneo… justamente cuando Stripe
      genera el pago, el contrato, registrar el abono en el
      EuroSystem y manda mensaje.»

   Así que esto cuelga de LA MISMA CADENA que le contesta a
   Stripe, en `_webhook-logica.js`, después de que EuroSystem
   registró el contrato y anotó el abono. No es una tarea que
   corre después ni un cron cada cinco minutos: es el mismo hilo,
   porque «instantáneo» era el requisito.

   ------------------------------------------------------------
   LA REGLA QUE MANDA SOBRE TODAS LAS DEMÁS
   ------------------------------------------------------------
   ESTE MÓDULO NO PUEDE ROMPER UN COBRO. Nunca.

   El dinero ya entró cuando esto corre. Un token vencido, un
   número mal escrito o un Meta que no contesta valen un renglón
   del registro y NADA MÁS: ni una excepción que suba, ni un
   `await` que se quede colgado, ni un 500 hacia Stripe. Por eso:

     · `avisa()` atrapa TODO y siempre devuelve un resumen
     · cada envío lleva tope de tiempo propio (4 s), y el tope
       vive aquí dentro además de en la señal del fetch: quien no
       contesta tampoco atiende un abort
     · los envíos van con `Promise.allSettled`, así que un
       número malo no se lleva al otro ni al otro canal

   ------------------------------------------------------------
   DOS CANALES, CADA UNO CON SU INTERRUPTOR
   ------------------------------------------------------------
     1. WHATSAPP, por plantilla aprobada. Un mensaje que ABRE la
        conversación (nadie le escribió al bot primero) Meta solo
        lo deja pasar como plantilla: en texto libre contesta
        131047. La plantilla y sus siete variables están en
        `docs/AVISO-INSTANTANEO.md`.

     2. TELEGRAM, mientras Meta aprueba la plantilla —y de red de
        respaldo después—. Es gratis, instantáneo y se da de alta
        en tres minutos sin aprobación de nadie.

   Los dos vienen APAGADOS. Sin variables, esto no manda nada y
   lo dice UNA vez en el registro: en local y en las pruebas es
   el estado normal, y un módulo que gritara en cada cobro
   enseñaría a ignorar el registro.

   ------------------------------------------------------------
   LO QUE NO SE ESCRIBE EN EL REGISTRO
   ------------------------------------------------------------
   Ni el token ni el número completo de nadie. De cada
   destinatario salen sus ÚLTIMOS CUATRO dígitos, que alcanzan
   para saber cuál de los dos falló y no alcanzan para nada más.
   ============================================================ */
'use strict';

/* Cuatro segundos, como el resto de las llamadas hacia afuera de este
   repo. Es el tope de UN envío; los envíos corren en paralelo, así que
   es también lo más que este módulo puede retrasar la respuesta a Stripe. */
const ESPERA_MS = 4000;

/* A dónde se manda la plantilla. Por omisión Meta directo.

   `AVISO_WA_API_BASE` existe aparte de la del bot a propósito: el bot
   puede estar viviendo en Dualhook con una llave `dh_live_…` mientras el
   aviso sale del número de pruebas de Meta, o al revés. Si no se pone,
   se hereda la del bot —que es lo que quiere quien tiene los dos en el
   mismo número— y si tampoco, Meta. */
function base() {
  return String(process.env.AVISO_WA_API_BASE || process.env.WHATSAPP_API_BASE ||
    'https://graph.facebook.com/v21.0').replace(/\/+$/, '');
}

function lista(v) {
  return String(v == null ? '' : v).split(',')
    .map(function (x) { return x.trim(); })
    .filter(function (x) { return x; });
}

/* El mismo criterio que usa el bot para hablarle a Meta (`numeroParaMeta`
   en `api/whatsapp.mjs`): México manda 521… en los avisos entrantes y Meta
   espera 52… en los salientes. Un número con el 1 de más no falla: llega
   a otra cuenta o a ninguna. */
function numeroParaMeta(n) {
  const d = String(n == null ? '' : n).replace(/\D+/g, '');
  if (d.length === 13 && d.indexOf('521') === 0) return '52' + d.slice(3);
  return d;
}

/* Lo único de un número que se escribe en el registro. */
function ultimos4(n) {
  const d = String(n == null ? '' : n).replace(/\D+/g, '');
  return d.length <= 4 ? d : '…' + d.slice(-4);
}

/* ------------------------------------------------------------
   UN PARÁMETRO DE PLANTILLA, COMO META LO EXIGE
   ------------------------------------------------------------
   Meta RECHAZA el mensaje entero —familia de errores 132000— si
   una variable trae un salto de línea, un tabulador o cuatro
   espacios seguidos. El dueño no vería un error: simplemente no
   le llegaría el aviso de una venta.

   Y uno vacío también lo rechaza, así que un dato que no
   tenemos viaja como raya, no como nada.
   ------------------------------------------------------------ */
const LARGO = 60;
function parametro(v) {
  const t = String(v == null ? '' : v).replace(/\s+/g, ' ').trim();
  if (!t) return '—';
  return t.length <= LARGO ? t : t.slice(0, LARGO - 1).trim() + '…';
}

function pesos(v) {
  const n = Number(v);
  if (!isFinite(n) || !n) return '';
  return '$' + n.toLocaleString('es-MX');
}

/* `2026-09-03T08:00` → `03/09/2026 08:00`. Sin `new Date()` y sin zonas: es
   texto que ya viene en hora de México y aquí solo se acomoda para que se
   lea de un vistazo en la pantalla del teléfono. Lo que no tenga esa forma
   pasa tal cual: más vale un dato feo que un dato perdido. */
function fechaLegible(v) {
  const t = String(v == null ? '' : v).trim();
  const m = t.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2}))?/);
  if (!m) return t;
  return m[3] + '/' + m[2] + '/' + m[1] + (m[4] ? ' ' + m[4] + ':' + m[5] : '');
}

/* ------------------------------------------------------------
   QUÉ DINERO ENTRÓ, SIN QUE EL DUEÑO TENGA QUE ADIVINAR
   ------------------------------------------------------------
   Por este aviso pasan dos cosas distintas que valen lo mismo:
   una VENTA nueva de la página —contrato recién creado, con su
   anticipo— y un ABONO posterior de un cliente que ya tiene
   contrato. La séptima variable de la plantilla dice cuál es,
   con todas sus letras.
   ------------------------------------------------------------ */
function esAbono(datos) {
  return String((datos && datos.clase) || '').toLowerCase() === 'abono';
}

/* Las siete variables del cuerpo, EN ESTE ORDEN Y NO EN OTRO: es el orden
   con el que se aprobó la plantilla en Meta, y cambiarlo aquí sin cambiarlo
   allá le mandaría al dueño el destino donde va el nombre. */
function variables(datos) {
  const d = datos || {};
  const cuanto = pesos(d.anticipo);
  return [
    parametro(d.folio),
    parametro(d.cliente),
    parametro(d.destino),
    parametro(fechaLegible(d.salida)),
    parametro(d.unidad),
    parametro(pesos(d.total)),
    parametro((esAbono(d) ? 'Abono' : 'Anticipo') + (cuanto ? ' ' + cuanto : ''))
  ];
}

/* El mismo contenido, para ojos humanos y sin las ataduras de Meta: aquí
   sí caben renglones. */
function texto(datos) {
  const d = datos || {};
  const v = variables(d);
  return [
    esAbono(d) ? '💰 ABONO de un cliente' : '💰 VENTA NUEVA en la página',
    '',
    'Folio:    ' + v[0],
    'Cliente:  ' + v[1],
    'Destino:  ' + v[2],
    'Salida:   ' + v[3],
    'Unidad:   ' + v[4],
    'Total:    ' + v[5],
    (esAbono(d) ? 'Abono:    ' : 'Anticipo: ') + (pesos(d.anticipo) || '—')
  ].join('\n');
}

/* ------------------------------------------------------------
   EL TOPE DE TIEMPO, POR DENTRO
   ------------------------------------------------------------
   `AbortSignal.timeout` va además en cada fetch, pero no basta:
   depende de que quien contesta respete el abort. Esto no
   depende de nadie —gana el que llegue primero— y es lo que
   garantiza que la respuesta a Stripe salga.
   ------------------------------------------------------------ */
function conTope(promesa, ms) {
  let reloj = null;
  const tope = new Promise(function (_, falla) {
    reloj = setTimeout(function () { falla(new Error('no contestó en ' + ms + ' ms')); }, ms);
    /* AQUÍ NO VA `unref()`. Se puso, y la primera corrida lo cobró: con el
       reloj suelto, un envío colgado deja a Node sin nada pendiente y el
       proceso SE MUERE en silencio a media cadena —en las pruebas se vio
       como una batería que terminaba sin imprimir su resumen; en Vercel
       sería un cobro sin respuesta—. El reloj se limpia al resolverse, que
       es lo que de verdad evita dejar basura. */
  });
  return Promise.race([promesa, tope]).then(
    function (v) { clearTimeout(reloj); return v; },
    function (e) { clearTimeout(reloj); throw e; }
  );
}

function elFetch(opciones) {
  const o = opciones || {};
  if (typeof o.traer === 'function') return o.traer;
  return typeof fetch === 'function' ? fetch : null;
}

/* ---- WHATSAPP -------------------------------------------------------- */

/* Un canal a medias no es un canal: sin token, sin número de origen, sin
   destinatarios o sin plantilla no hay forma de mandar nada, y hacer el
   intento sería un error en el registro por cada cobro. Se apaga entero. */
function canalWhats() {
  const token = String(process.env.AVISO_WA_TOKEN || '').trim();
  const numero = String(process.env.AVISO_WA_PHONE_ID || '').trim();
  const a = lista(process.env.AVISO_WA_A).map(numeroParaMeta).filter(function (n) { return n; });
  const plantilla = String(process.env.AVISO_WA_PLANTILLA || '').trim();
  if (!token || !numero || !a.length || !plantilla) return null;
  return { token: token, numero: numero, a: a, plantilla: plantilla,
    idioma: String(process.env.AVISO_WA_IDIOMA || '').trim() || 'es_MX' };
}

async function mandaWhats(canal, params, para, opciones) {
  const traer = elFetch(opciones);
  if (!traer) throw new Error('el entorno no tiene fetch');
  const espera = (opciones && opciones.esperaMs) || ESPERA_MS;

  const r = await conTope(traer(base() + '/' + canal.numero + '/messages', {
    method: 'POST',
    signal: AbortSignal.timeout(espera),
    headers: {
      'Authorization': 'Bearer ' + canal.token,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to: para,
      type: 'template',
      template: {
        name: canal.plantilla,
        language: { code: canal.idioma },
        components: [{
          type: 'body',
          parameters: params.map(function (p) { return { type: 'text', text: p }; })
        }]
      }
    })
  }), espera);

  if (!r || !r.ok) {
    /* El cuerpo del error de Meta dice QUÉ salió mal —plantilla no
       aprobada, número no registrado, token vencido—. Sin esto, dar con
       el motivo es adivinar. */
    const detalle = r && r.text ? await r.text().catch(function () { return ''; }) : '';
    throw new Error('Meta contestó ' + (r && r.status) + ': ' +
      String(detalle).replace(/\s+/g, ' ').slice(0, 300));
  }
  return true;
}

/* ---- TELEGRAM -------------------------------------------------------- */

function canalTelegram() {
  const token = String(process.env.AVISO_TELEGRAM_TOKEN || '').trim();
  const chats = lista(process.env.AVISO_TELEGRAM_CHAT);
  if (!token || !chats.length) return null;
  return { token: token, chats: chats };
}

async function mandaTelegram(canal, cuerpoTexto, chat, opciones) {
  const traer = elFetch(opciones);
  if (!traer) throw new Error('el entorno no tiene fetch');
  const espera = (opciones && opciones.esperaMs) || ESPERA_MS;

  const r = await conTope(traer('https://api.telegram.org/bot' + canal.token + '/sendMessage', {
    method: 'POST',
    signal: AbortSignal.timeout(espera),
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chat, text: cuerpoTexto, disable_web_page_preview: true })
  }), espera);

  if (!r || !r.ok) {
    const detalle = r && r.text ? await r.text().catch(function () { return ''; }) : '';
    throw new Error('Telegram contestó ' + (r && r.status) + ': ' +
      String(detalle).replace(/\s+/g, ' ').slice(0, 300));
  }
  return true;
}

/* ---- LA PUERTA ------------------------------------------------------- */

/* Que el «está apagado» se diga una vez y no en cada cobro. Es un aviso de
   configuración, no un incidente: repetirlo en cada venta enseñaría a
   pasar los ojos por encima del registro justo donde no hay que hacerlo. */
let yaSeDijoQueEstaApagado = false;

async function avisa(datos, opciones) {
  try {
    const wa = canalWhats();
    const tg = canalTelegram();

    if (!wa && !tg) {
      if (!yaSeDijoQueEstaApagado) {
        yaSeDijoQueEstaApagado = true;
        console.log('[aviso] apagado: sin AVISO_WA_* ni AVISO_TELEGRAM_* no se manda ninguna ' +
          'notificación al instante. El cobro sigue su camino igual. ' +
          'Cómo prenderlo: docs/AVISO-INSTANTANEO.md');
      }
      return { mandados: 0, fallidos: 0, apagado: true };
    }

    const params = variables(datos);
    const cuerpoTexto = texto(datos);
    const tareas = [];

    if (wa) {
      for (const para of wa.a) {
        tareas.push({ canal: 'whatsapp', quien: ultimos4(para),
          promesa: mandaWhats(wa, params, para, opciones) });
      }
    }
    if (tg) {
      for (const chat of tg.chats) {
        tareas.push({ canal: 'telegram', quien: ultimos4(chat),
          promesa: mandaTelegram(tg, cuerpoTexto, chat, opciones) });
      }
    }

    /* `allSettled` y no `all`: un destinatario roto no puede cancelar a los
       demás, que es justo la razón de que sean dos teléfonos. */
    const resultados = await Promise.allSettled(tareas.map(function (t) { return t.promesa; }));

    let mandados = 0, fallidos = 0;
    resultados.forEach(function (r, i) {
      const t = tareas[i];
      if (r.status === 'fulfilled') {
        mandados++;
        console.log('[aviso] ' + t.canal + ' → ' + t.quien + ' ok');
      } else {
        fallidos++;
        console.error('[aviso] ' + t.canal + ' → ' + t.quien + ' NO SALIÓ: ' +
          ((r.reason && r.reason.message) || r.reason));
      }
    });

    return { mandados: mandados, fallidos: fallidos, apagado: false };
  } catch (e) {
    /* La última red. Si se llega aquí es que falló algo que ni siquiera es
       un envío —armar el cuerpo, leer una variable—, y ni eso puede tumbar
       un cobro que ya se hizo. */
    console.error('[aviso] no se pudo avisar: ' + (e && e.message) +
      '. El cobro NO se toca: sigue su camino.');
    return { mandados: 0, fallidos: 1, apagado: false };
  }
}

module.exports = { avisa, variables, texto, parametro, fechaLegible, ESPERA_MS };
