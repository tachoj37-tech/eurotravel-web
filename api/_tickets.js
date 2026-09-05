/* ============================================================
   Los tickets al dueño, y sus respuestas de vuelta
   ------------------------------------------------------------
   Cómo quiso el dueño que funcione (2-sep-2026):

     · Los mensajes de los clientes NO le llegan. Con el API de
       WhatsApp eso sale solo: el número no vive en ninguna app,
       los mensajes van al webhook.
     · Lo que sí le llega es un mensaje del BOT, a su número
       personal, con el viaje armado.
     · Él contesta ESE mensaje, y el bot le pasa sus palabras al
       cliente. Desde ahí la IA se calla en esa conversación.

     «la IA bot vive dentro del chat del vendedor, yo puedo
      contestar también, no tienes que pasar a nadie»

   ------------------------------------------------------------
   POR QUÉ EL DUEÑO NO PUEDE ABRIR EL CHAT DEL CLIENTE
   ------------------------------------------------------------
   Un número dado de alta en el API de WhatsApp **no se puede
   abrir en la app**. No es que el bot lo tenga ocupado: ese chat
   no existe en ningún celular. Por eso el dueño contesta a
   través del bot. No es un rodeo — es la única forma con este
   API.

   ------------------------------------------------------------
   LO QUE ESTE ARCHIVO NO PUEDE HACER SOLO
   ------------------------------------------------------------
   Saber a qué cliente le está contestando el dueño necesita
   MEMORIA, y en serverless cada instancia tiene la suya. El mapa
   de aquí abajo funciona mientras la misma instancia siga
   caliente —que cubre la mayoría de las respuestas, porque pasan
   en minutos— y se pierde cuando Vercel la recicla.

   Por eso hay DOS caminos, y el segundo no depende de memoria:

     1 · El dueño RESPONDE al ticket. WhatsApp manda el id del
         mensaje citado y de ahí sale el cliente.
     2 · El ticket trae el número del cliente escrito. Si el
         dueño empieza su mensaje con ese número, funciona
         aunque la instancia se haya reciclado.

   El camino bueno de verdad —guardarlo en EuroSystem— es la
   etapa 3 del plan. Esto es lo que se puede hacer sin base de
   datos, y está escrito para que se note.
   ============================================================ */

'use strict';

/* ------------------------------------------------------------
   QUIÉN ES EL DUEÑO
   ------------------------------------------------------------
   Su número, en `DUENO_WHATSAPP`. NO es un secreto —es un
   teléfono— pero va en el entorno igual, porque cambia según
   quién esté atendiendo y no tiene por qué vivir en el código.

   Si no está configurado, no hay tickets: el bot sigue
   contestando solo, como hasta hoy. Nada truena.
   ------------------------------------------------------------ */
function numeroDelDueno(entorno) {
  const env = entorno || process.env;
  return soloDigitos(env.DUENO_WHATSAPP || '');
}

function soloDigitos(s) {
  return String(s == null ? '' : s).replace(/\D/g, '');
}

/* Dos números de WhatsApp son el mismo si terminan igual en sus
   últimos 10 dígitos. México los manda a veces con el 52, a veces
   con 521, y comparar cadenas completas falla por eso. */
function mismoNumero(a, b) {
  const x = soloDigitos(a), y = soloDigitos(b);
  if (!x || !y) return false;
  return x.slice(-10) === y.slice(-10);
}

function esDelDueno(numero, entorno) {
  const d = numeroDelDueno(entorno);
  return !!d && mismoNumero(numero, d);
}

/* ------------------------------------------------------------
   EL TICKET
   ------------------------------------------------------------
   Lo que el dueño pidió, en este orden:
     cuántos días · a dónde · de dónde · movimientos · unidad

   Le agrego cuántos van, porque sin eso no puede escoger unidad
   ni repartir el precio, y el teléfono del cliente, que es lo
   que hace que la respuesta funcione aunque se pierda la memoria.

   NO lleva precio, y no es un olvido: el precio lo pone él. Ese
   es el punto entero del ticket.
   ------------------------------------------------------------ */
/* El ticket lo lee una PERSONA, a lo mejor a las once de la noche.
   `2026-09-10` es formato de máquina; se escribe como se dice. */
const MESES_DEL = ['', 'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

function comoSeDice(iso) {
  const s = String(iso || '');
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return s || '?';
  return Number(m[3]) + ' de ' + MESES_DEL[Number(m[2])];
}

const NOMBRE_UNIDAD = {
  sprinter: 'Sprinter',
  suburban: 'Suburban',
  autobus: 'Autobús'
};

function armaTicket(datos) {
  const d = datos || {};
  const dias = d.dias || '?';
  const lineas = [];

  lineas.push('🎫 *Viaje para cotizar*');
  lineas.push('');
  lineas.push('📍 ' + (d.origen || '?') + ' → ' + (d.destino || '?'));
  lineas.push('📅 ' + comoSeDice(d.salida) + (d.regreso ? ' al ' + comoSeDice(d.regreso) : ''));
  lineas.push('🗓️ ' + dias + (dias === 1 ? ' día' : ' días'));
  lineas.push('🚐 ' + (NOMBRE_UNIDAD[d.unidad] || d.unidad || '?') +
    (d.gente ? ' · ' + d.gente + ' pasajeros' : ''));
  lineas.push('🔁 ' + (d.movimientos
    ? d.movimientos + (d.movimientos === 1 ? ' día con movimiento' : ' días con movimiento')
    : 'Sin movimientos'));

  if (d.paseo) lineas.push('⭐ ' + d.paseo);
  if (d.agencia) lineas.push('🏢 *Es agencia*');

  lineas.push('');
  lineas.push('Contéstame *este mensaje* con el precio y yo se lo paso.');
  /* El número va escrito para que la respuesta funcione aunque la
     instancia se haya reciclado y el mapa de memoria esté vacío. */
  lineas.push('_cliente: ' + (d.cliente || '?') + '_');

  return lineas.join('\n');
}

/* ------------------------------------------------------------
   DE QUÉ CLIENTE HABLA LA RESPUESTA DEL DUEÑO
   ------------------------------------------------------------
   Se prueban los dos caminos, en orden de qué tan confiables son.
   ------------------------------------------------------------ */
function clienteDeLaRespuesta(mensaje, recordados) {
  const m = mensaje || {};

  /* 1 · Respondió al ticket: WhatsApp manda el id del citado. */
  const citado = m.context && m.context.id;
  if (citado && recordados && recordados.get) {
    const quien = recordados.get(citado);
    if (quien) return { cliente: quien, texto: textoDe(m), via: 'cita' };
  }

  /* 2 · Empezó su mensaje con el número del cliente. Funciona sin
     memoria, que es de lo que se trata. */
  const texto = textoDe(m);
  const conNumero = texto.match(/^\s*\+?(\d[\d\s()-]{9,17})\s*[:\-,]?\s*([\s\S]+)$/);
  if (conNumero) {
    const numero = soloDigitos(conNumero[1]);
    if (numero.length >= 10) {
      return { cliente: numero, texto: conNumero[2].trim(), via: 'numero' };
    }
  }

  return null;
}

function textoDe(m) {
  return ((m && m.text && m.text.body) || '').trim();
}

/* ------------------------------------------------------------
   MEMORIA DE TICKETS · con tope, como manda la casa
   ------------------------------------------------------------
   La clave la elige Meta (el id del mensaje), así que sin tope
   esto crecería sin fin. Misma regla que `yaContestado`.
   ------------------------------------------------------------ */
const TOPE_TICKETS = 300;
const tickets = new Map();

function recuerdaTicket(idMensaje, cliente) {
  if (!idMensaje || !cliente) return;
  tickets.set(idMensaje, cliente);
  while (tickets.size > TOPE_TICKETS) {
    tickets.delete(tickets.keys().next().value);
  }
}

/* ------------------------------------------------------------
   CUÁNDO SE CALLA LA IA
   ------------------------------------------------------------
   En cuanto el dueño le contesta a un cliente, el bot deja de
   contestarle a ESE cliente. Si siguiera, el cliente vería dos
   voces distintas en la misma conversación — y ahí se acaba la
   ilusión de que habla con una persona.

   Se calla por un rato, no para siempre: si el dueño contestó y
   se fue, alguien tiene que seguir atendiendo. Dos horas es lo
   que dura una conversación de venta.
   ------------------------------------------------------------ */
const CALLADO_MS = 2 * 60 * 60 * 1000;
const TOPE_CALLADOS = 500;
const callados = new Map();

function callaLaIA(cliente, ahora) {
  if (!cliente) return;
  callados.set(soloDigitos(cliente).slice(-10), ahora || Date.now());
  while (callados.size > TOPE_CALLADOS) {
    callados.delete(callados.keys().next().value);
  }
}

function iaCallada(cliente, ahora) {
  const k = soloDigitos(cliente).slice(-10);
  const desde = callados.get(k);
  if (!desde) return false;
  if ((ahora || Date.now()) - desde > CALLADO_MS) {
    callados.delete(k);
    return false;
  }
  return true;
}

/* ------------------------------------------------------------
   EL RECORDATORIO A LAS 15 HORAS
   ------------------------------------------------------------
   «si pasan más de 15 horas, ella me vuelve a escribir a mí»
   — el dueño, 2-sep-2026.

   Quince y no más, y eso está bien pensado aunque quizá sin
   querer: **la ventana de Meta son 24 horas.** Pasadas ésas, el
   negocio ya no le puede escribir libre a nadie — necesita una
   plantilla aprobada. A las 15 todavía cabe.

   ------------------------------------------------------------
   POR QUÉ VA COLGADO DEL TRÁFICO Y NO DE UN RELOJ
   ------------------------------------------------------------
   En serverless no hay temporizadores: nadie despierta a las 15
   horas. Las opciones eran dos:

     · Un cron de Vercel — otra función, y no queda ninguna.
     · Revisar en cada aviso que llega. Gratis.

   Se hace lo segundo: cada vez que ENTRA cualquier mensaje, se
   mira si hay tickets vencidos y se recuerdan.

   Lo que eso NO cubre, dicho de frente: si en 15 horas no
   escribe absolutamente nadie, el recordatorio no sale hasta que
   alguien escriba. En un negocio con movimiento eso no pasa; en
   una madrugada muerta, sí. Con base de datos y un cron se
   arregla — etapa 3.
   ------------------------------------------------------------ */
const RECUERDA_A_LAS_MS = 15 * 60 * 60 * 1000;
const TOPE_PENDIENTES = 200;
const pendientes = new Map();

function anotaPendiente(cliente, resumen, ahora) {
  if (!cliente) return;
  pendientes.set(soloDigitos(cliente).slice(-10), {
    cliente: cliente, resumen: resumen || '', cuando: ahora || Date.now(),
    recordado: false
  });
  while (pendientes.size > TOPE_PENDIENTES) {
    pendientes.delete(pendientes.keys().next().value);
  }
}

/* En cuanto el dueño contesta, ese ticket deja de estar pendiente. */
function yaLoContesto(cliente) {
  pendientes.delete(soloDigitos(cliente).slice(-10));
}

/* Devuelve los recordatorios que toca mandar, y los marca. Se marca
   ANTES de mandarlos: si se marcara después y el envío fallara, el
   dueño recibiría el mismo recordatorio en cada mensaje que entre. */
function recordatoriosPendientes(ahora) {
  const t = ahora || Date.now();
  const salida = [];
  pendientes.forEach(function (p) {
    if (p.recordado) return;
    if (t - p.cuando < RECUERDA_A_LAS_MS) return;
    p.recordado = true;
    const horas = Math.floor((t - p.cuando) / 3600000);
    salida.push({
      cliente: p.cliente,
      texto: '⏰ Llevas *' + horas + ' horas* sin ponerle precio a este:\n\n' +
        p.resumen + '\n\n_Contéstame este mensaje con el precio._'
    });
  });
  return salida;
}

/* ============================================================
   LA CARTERA · EN QUÉ VA CADA CLIENTE
   ------------------------------------------------------------
   Pedido del dueño: ver de un vistazo quién apenas preguntó, a
   quién ya se le dio precio, y quién ya mandó su transferencia.
   Lo pidió como etiquetas de WhatsApp; no se puede por API —está
   explicado en `_etapas.js`—, así que la etapa la lleva el bot,
   que de todos modos ya la sabía.

   Guarda LO MÍNIMO para reconocer al cliente cuando vuelva:
   su etapa, su viaje en una línea y su total. Nada más. Aquí no
   se acumula la conversación.

   ------------------------------------------------------------
   ESTO VIVE EN MEMORIA, Y SE PIERDE
   ------------------------------------------------------------
   Como todo lo demás de este archivo: si Vercel recicla la
   instancia, se va. En la etapa 3 se muda a Neon —que es donde
   el dueño pidió que las conversaciones duren al menos un mes—
   y esta función se queda con la misma firma para que nada de
   arriba tenga que cambiar.

   Y una regla que NO se muda con los datos: la llave es el
   número del cliente, siempre sus últimos 10 dígitos. Es lo que
   impide que dos clientes se crucen — que fue justo lo que el
   dueño pidió que no pudiera pasar «ni por posibilidad».
   ============================================================ */
const etapas = require('./_etapas');

const TOPE_CARTERA = 500;
const cartera = new Map();

function llave(cliente) { return soloDigitos(cliente).slice(-10); }

/* Apunta en qué va este cliente. La etapa SOLO AVANZA: quien ya
   mandó comprobante no vuelve a «apenas escribió» por saludar. */
function anotaEtapa(cliente, etapa, extra, ahora) {
  if (!cliente) return null;
  const k = llave(cliente);
  const antes = cartera.get(k);
  const ficha = {
    cliente: cliente,
    etapa: etapas.avanza(antes && antes.etapa, etapa),
    viaje: (extra && extra.viaje) || (antes && antes.viaje) || null,
    total: (extra && typeof extra.total === 'number') ? extra.total
      : (antes && antes.total) || null,
    anticipo: (extra && typeof extra.anticipo === 'number') ? extra.anticipo
      : (antes && antes.anticipo) || null,
    /* Los datos del contrato se acumulan a lo largo de varios mensajes,
       así que aquí NO se reemplazan: quien los junta es
       `_datos-contrato.js`, que ya sabe que un dato nuevo vacío no
       borra uno viejo bueno. Este archivo solo los guarda. */
    contrato: (extra && extra.contrato) || (antes && antes.contrato) || null,
    /* Se pega en cuanto se sabe y ya no se suelta: quien habló como
       agencia en el primer mensaje sigue siendo agencia después, y de
       eso depende cómo se le piden los datos del contrato. */
    agencia: !!((extra && extra.agencia) || (antes && antes.agencia)),
    /* Que la ficha del contrato ya se le mandó al dueño. Sin esto le
       llegaría la misma ficha en cada mensaje que el cliente escriba
       después de completarla. */
    contratoAvisado: !!((extra && extra.contratoAvisado) || (antes && antes.contratoAvisado)),
    desde: (antes && antes.desde) || (ahora || Date.now()),
    visto: ahora || Date.now()
  };
  cartera.set(k, ficha);
  while (cartera.size > TOPE_CARTERA) {
    cartera.delete(cartera.keys().next().value);
  }
  return ficha;
}

function fichaDe(cliente) {
  return cartera.get(llave(cliente)) || null;
}

/* ------------------------------------------------------------
   LO QUE VINO DE LA BASE, ANTES DE EMPEZAR
   ------------------------------------------------------------
   `procesa` es síncrona y leer de la base no lo es. Igual que con
   los audios: la lectura se hace ANTES, en `whatsapp.mjs`, y aquí
   llega hecha.

   Se siembra sin tocar la etapa —`cartera.set` directo y no
   `anotaEtapa`— porque lo que viene de la base ya es el estado
   bueno: pasarlo por `avanza` no cambiaría nada y sí escondería
   un error el día que la base tuviera algo raro.
   ------------------------------------------------------------ */
function siembraFicha(ficha) {
  if (!ficha || !ficha.cliente) return;
  const k = llave(ficha.cliente);
  /* Lo que ya está en memoria gana: es de este mismo instante y la
     base puede venir de hace un minuto. */
  if (cartera.has(k)) return;
  cartera.set(k, ficha);
}

/* Cuáles cambiaron, para escribir solo esas. Escribir las 500 en cada
   mensaje sería pagar una base de datos para hacerle daño. */
function fichaViva(cliente) { return cartera.get(llave(cliente)) || null; }

/* Todas, de la etapa más avanzada a la más nueva: el que ya mandó
   dinero va hasta arriba. Dentro de la misma etapa, el más viejo
   primero — ése es el que lleva más tiempo esperando. */
function carteraOrdenada() {
  const salida = [];
  cartera.forEach(function (f) { salida.push(f); });
  salida.sort(function (a, b) {
    const d = etapas.nivel(b.etapa) - etapas.nivel(a.etapa);
    return d !== 0 ? d : a.visto - b.visto;
  });
  return salida;
}

/* Solo para las pruebas. */
function olvidaTodo() {
  tickets.clear(); callados.clear(); pendientes.clear(); cartera.clear();
}

module.exports = {
  numeroDelDueno, esDelDueno, mismoNumero, soloDigitos,
  armaTicket, clienteDeLaRespuesta, comoSeDice,
  recuerdaTicket, tickets,
  callaLaIA, iaCallada, olvidaTodo,
  anotaPendiente, yaLoContesto, recordatoriosPendientes,
  anotaEtapa, fichaDe, carteraOrdenada, siembraFicha, fichaViva,
  CALLADO_MS, TOPE_TICKETS, RECUERDA_A_LAS_MS, TOPE_CARTERA
};
