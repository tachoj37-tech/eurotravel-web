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
/* ------------------------------------------------------------
   SIN ESTE NÚMERO, NADIE SE ENTERA DE NADA
   ------------------------------------------------------------
   `DUENO_WHATSAPP` es la variable de la que cuelgan TODOS los tickets: el
   precio por confirmar, el comprobante, la ficha del contrato, las dudas.
   Cada uno de esos bloques está detrás de un `if (numeroDelDueno(env))`,
   así que con la variable vacía el bot le dice al cliente «en breve te
   paso tu cotización» y no le avisa a nadie. No truena, no deja rastro:
   simplemente no pasa nada.

   Eso ocurrió el 10-sep-2026: una cotización real de autobús para 51
   personas del 22 al 25 de septiembre a Puerto Vallarta llegó completa
   hasta el momento del ticket y ahí murió, sin una sola línea en el
   registro. Por eso ahora, cuando falta, se grita —una vez por
   instancia, para no llenar el log—. */
let yaAviseDelDueno = false;
function numeroDelDueno(entorno) {
  const env = entorno || process.env;
  const n = soloDigitos(env.DUENO_WHATSAPP || '');
  if (!n && !yaAviseDelDueno) {
    yaAviseDelDueno = true;
    console.error('[SIN-DUEÑO] CRÍTICO: DUENO_WHATSAPP está vacía. ' +
      'Ningún ticket sale: ni el precio por confirmar, ni el comprobante, ni la ficha del ' +
      'contrato, ni las dudas. Los clientes reciben «en breve te paso tu cotización» y nadie ' +
      'se entera. Ponla en Vercel (Settings → Environment Variables) y vuelve a desplegar.');
  }
  return n;
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

/* Un número mexicano con su lada completa: «521…» (13 dígitos, como lo
   manda Meta) y «52…» (12) son el mismo, y 10 dígitos pelones se toman
   como de México. Un número de otro país se queda como está. */
function conLadaCompleta(numero) {
  const n = soloDigitos(numero);
  if (n.length === 10) return '52' + n;
  if (n.length === 13 && n.slice(0, 3) === '521') return '52' + n.slice(3);
  return n;
}

/* Ser el dueño se decide con el número COMPLETO, no con los últimos 10:
   con los últimos 10 un número de otro país que terminara igual entraba
   por su rama y podía pedir «tablero» —la cartera entera— o «ver»
   cualquier conversación (auditoría 7-sep-2026, hallazgo 7). Los últimos
   10 siguen sirviendo para AGRUPAR mensajes (`mismoNumero`), no para
   autorizar. */
function esDelDueno(numero, entorno) {
  const d = numeroDelDueno(entorno);
  if (!d) return false;
  return conLadaCompleta(numero) === conLadaCompleta(d);
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
  /* El nombre del camión que escogió, no la categoría: decía «Autobús» a
     secas y con eso el dueño no sabía si armar el i6S de 51 o el Century
     de 47 (10-sep-2026). Si no escogió ninguno, la categoría de siempre. */
  lineas.push('🚐 ' + (d.unidadNombre || NOMBRE_UNIDAD[d.unidad] || d.unidad || '?') +
    (d.gente ? ' · ' + d.gente + ' pasajeros' : ''));
  lineas.push('🔁 ' + (d.movimientos
    ? d.movimientos + (d.movimientos === 1 ? ' día con movimiento' : ' días con movimiento')
    : 'Sin movimientos'));

  if (d.paseo) lineas.push('⭐ ' + d.paseo);
  if (d.agencia) lineas.push('🏢 *Es agencia*');

  /* ------------------------------------------------------------
     EL RENGLÓN DEL EXCEL PARA ESE CAMIÓN — 10-sep-2026
     ------------------------------------------------------------
     Este ticket es el que el dueño ve cuando alguien pide un camión, y
     hasta hoy llegaba pelón: «contéstame con el precio», sin un número.
     Pero el número estaba escrito en `api/_destinos.js` desde siempre —
     las siete columnas del Excel por destino— y nadie lo leía, porque
     el motor de tarifas solo sabe de Sprinter.

     Aquí se le enseña. Se dice «Del Excel» y NO «calculado», y se
     nombra la columna: si la correspondencia entre una columna y un
     camión estuviera mal, se ve al primer viaje en vez de cobrarse
     callado. El Century enseña sus dos columnas (47 y 49) porque el
     catálogo tiene una unidad para las dos del Excel.

     Las líneas se calculan afuera y llegan hechas: este archivo decide
     cómo se ve un ticket, no cuánto cuesta un viaje.
     ------------------------------------------------------------ */
  if (Array.isArray(d.delExcel) && d.delExcel.length) {
    lineas.push('');
    d.delExcel.forEach(function (p) {
      lineas.push('💵 Del Excel: *$' + Number(p.total).toLocaleString('es-MX') + '*  (columna «' +
        p.comoSeLlama + '»' + (p.diasIncluidos ? ', cubre ' + p.diasIncluidos + ' días' : '') + ')');
    });
    const cubre = d.delExcel[0].diasIncluidos;
    if (dias && cubre && dias !== cubre) {
      lineas.push('⚠️ Este viaje es de *' + dias + ' días* y ese precio cubre *' + cubre + '*.');
    }
  }

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
    /* Desde el 7-sep-2026 el ticket recuerda también SU viaje (`carga`):
       si el cliente cotizó dos, el «va» a cada ticket confirma el suyo. Un
       ticket viejo guardado como texto sigue valiendo. */
    const cliente = typeof quien === 'string' ? quien : (quien && quien.cliente);
    if (cliente) {
      return { cliente: cliente, texto: textoDe(m), via: 'cita',
        carga: (quien && typeof quien === 'object' && quien.carga) || null };
    }
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

/* Un ticket cuyo precio ya se mandó queda «consumido»: un segundo «va» al
   mismo ticket no vuelve a mandar el precio ni toma el de otro viaje. */
function consumeTicket(idMensaje) {
  const t = tickets.get(idMensaje);
  if (t && typeof t === 'object') t.carga = { consumido: true };
}
function recuerdaTicket(idMensaje, cliente, carga) {
  if (!idMensaje || !cliente) return;
  tickets.set(idMensaje, { cliente: cliente, carga: carga || null });
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

/* El dueño devuelve el chat a la IA («bot»): se le quita el silencio de
   dos horas, si lo había. */
function liberaLaIA(cliente) {
  if (!cliente) return;
  callados.delete(soloDigitos(cliente).slice(-10));
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
/* Los viajes que ya pasaron por precio, del más nuevo al más viejo, para
   que al cotizar otro no se olvide el anterior (pedido del dueño,
   7-sep-2026). Se archiva el que sale cuando entra uno distinto. */
const TOPE_VIAJES = 5;
function archivaViaje(lista, viaje, total, estado, anticipo) {
  if (!viaje || !viaje.destino) return lista;
  const clave = String(viaje.destino) + '|' + String(viaje.salida || '');
  const sinEse = (lista || []).filter(function (v) {
    return String(v.destino) + '|' + String(v.salida || '') !== clave;
  });
  sinEse.unshift({
    destino: viaje.destino, origen: viaje.origen || null,
    salida: viaje.salida || null, regreso: viaje.regreso || null,
    gente: viaje.gente || null, unidad: viaje.unidadNombre || viaje.unidad || null,
    total: typeof total === 'number' ? total : null,
    /* ------------------------------------------------------------
       EL ANTICIPO Y LOS MOVIMIENTOS TAMBIÉN SE GUARDAN
       ------------------------------------------------------------
       Dictado del dueño (10-sep-2026): «si le sacas una cotización y
       después quiere volver a la anterior y comprarla, si falla pierdes
       al cliente». Para volver a ella no basta el total: hace falta el
       anticipo con el que se aparta y los movimientos, que son parte del
       viaje. Sin esto, «mejor el de Tapalpa, apártamelo» no tenía monto
       que cobrar.
       ------------------------------------------------------------ */
    anticipo: typeof anticipo === 'number' ? anticipo : null,
    recorridos: typeof viaje.recorridos === 'number' ? viaje.recorridos : null,
    paseo: viaje.paseo || null,
    soloIda: !!viaje.soloIda,
    estado: estado
  });
  return sinEse.slice(0, TOPE_VIAJES);
}
function mismoViaje(a, b) {
  if (!a || !b) return false;
  return String(a.destino || '') === String(b.destino || '') &&
    String(a.salida || '') === String(b.salida || '');
}

function anotaEtapa(cliente, etapa, extra, ahora) {
  if (!cliente) return null;
  const k = llave(cliente);
  const antes = cartera.get(k);
  /* El número completo (52 1 33…) se conserva aunque la orden del dueño
     venga con solo los 10 dígitos («3312345678 yo»): es el que WhatsApp
     necesita para mandar. */
  if (antes && antes.cliente && soloDigitos(cliente).length < soloDigitos(antes.cliente).length) {
    cliente = antes.cliente;
  }
  /* Si entra un precio por confirmar de OTRO viaje, el que estaba
     esperando se archiva; si entra un viaje con precio dado distinto del
     anterior, el anterior también. */
  let viajes = (antes && antes.viajes) || [];
  const nuevoPendiente = extra && extra.porConfirmar && extra.porConfirmar.resumen;
  const viejoPendiente = antes && antes.porConfirmar && antes.porConfirmar.resumen;
  if (nuevoPendiente && viejoPendiente && !mismoViaje(nuevoPendiente, viejoPendiente)) {
    viajes = archivaViaje(viajes, viejoPendiente, antes.porConfirmar.total, 'precio pedido',
      antes.porConfirmar.anticipo);
  }
  if (extra && extra.viajeDatos && antes && antes.viajeDatos && !mismoViaje(extra.viajeDatos, antes.viajeDatos)) {
    viajes = archivaViaje(viajes, antes.viajeDatos, antes.total, 'precio dado', antes.anticipo);
  }
  const ficha = {
    viajes: viajes,
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
    /* Que el cliente ya mandó una foto o un PDF por el chat. Va aparte de
       la etapa porque una foto puede llegar ANTES de que haya precio, y
       entonces la etapa no se mueve: en la corrida del 9-sep-2026
       (escenario x) el cliente mandó su comprobante sin cotización y un
       turno después el bot le contestó «no me llegó nada por aquí». */
    fotoDelClienteEn: (extra && extra.fotoDelClienteEn) || (antes && antes.fotoDelClienteEn) || null,
    /* Cuándo se le mandaron la CLABE y la cuenta. Dictado del dueño
       (9-sep-2026): «que la clave no se repita; si dice apártamelo,
       respóndele que necesito el depósito primero». Antes la regla era la
       contraria —se repetía cada vez— y por eso esto tiene que sobrevivir
       a que la plática se vacíe: vive en la ficha, no en la charla. */
    cuentaMandadaEn: (extra && extra.cuentaMandadaEn) || (antes && antes.cuentaMandadaEn) || null,
    /* Que al dueño ya se le avisó que este número escribió por primera vez
       (dictado del 9-sep-2026). Una vez por número, nunca dos. */
    avisadoDelPrimero: !!((extra && extra.avisadoDelPrimero) || (antes && antes.avisadoDelPrimero)),
    /* Cuántas veces se le ha dicho «primero el depósito» sin que llegue.
       Sirve para no contestarle tres veces con la misma frase palabra por
       palabra, que es lo que hace sonar a máquina. */
    vecesQuePidioApartar: (extra && typeof extra.vecesQuePidioApartar === 'number')
      ? extra.vecesQuePidioApartar
      : ((antes && antes.vecesQuePidioApartar) || 0),
    /* El precio que el bot calculó y que espera el «va» del dueño. Se
       reemplaza si viene uno nuevo, se borra si viene `null` explícito
       (ya se mandó), y si no viene nada se conserva el que había. */
    porConfirmar: (extra && Object.prototype.hasOwnProperty.call(extra, 'porConfirmar'))
      ? (extra.porConfirmar || null)
      : ((antes && antes.porConfirmar) || null),
    /* El viaje en datos (origen, destino, fechas, pasajeros, unidad), que
       queda desde que se dio el precio: es lo que va al contrato cuando el
       dueño dice «va» a la ficha. `viaje` de arriba es solo texto. */
    viajeDatos: (extra && extra.viajeDatos) || (antes && antes.viajeDatos) || null,
    /* Las unidades de las que ya se mandaron fotos (ids del catálogo).
       Vive en la ficha y no solo en la plática porque la plática se cierra
       al cotizar y al apartar, y las fotos no se repiten (reparación del
       8-sep-2026, Falla 2). */
    fotos: (extra && Array.isArray(extra.fotos)) ? extra.fotos.slice(0, 12) : ((antes && antes.fotos) || []),
    /* Folio y liga del contrato ya registrado en EuroSystem. Con esto, un
       segundo «va» no vuelve a subirlo. */
    contratoSubido: (extra && extra.contratoSubido) || (antes && antes.contratoSubido) || null,
    /* El seguimiento (6-sep-2026): cuándo RECIBIÓ el precio, cuántos
       toques van (0-3) y cuándo escribió él por última vez. Un precio
       nuevo trae `precioEn` y `toques: 0` juntos, y reinicia la cuenta.
       `clienteEn` lo pone el webhook con cada mensaje suyo; con él
       `_seguimiento.js` sabe si contestó después del precio (y entonces
       ya no se le escribe) y si la ventana de 24 h de Meta sigue abierta. */
    /* El relevo (7-sep-2026): 'dueno' cuando el dueño tomó el chat con
       «yo»; se quita con «bot». Nulo explícito lo borra; si no viene, se
       conserva. Vive en el almacén para sobrevivir a la instancia. */
    enManosDe: (extra && Object.prototype.hasOwnProperty.call(extra, 'enManosDe'))
      ? (extra.enManosDe || null)
      : ((antes && antes.enManosDe) || null),
    precioEn: (extra && extra.precioEn) || (antes && antes.precioEn) || null,
    toques: (extra && typeof extra.toques === 'number') ? extra.toques
      : ((antes && antes.toques) || 0),
    clienteEn: (extra && extra.clienteEn) || (antes && antes.clienteEn) || null,
    /* El precio que hay ya NO es el suyo: cambió el grupo, la fecha o la
       unidad después de dárselo. Vive en la ficha y no en la plática porque
       la plática se borra al contestar «apartar» y con ella se perdía el
       cambio: el cliente pasó de 15 a 22 y el bot le ofreció el anticipo del
       viaje de 15 (corrida real del 9-sep-2026). Se limpia solo cuando se
       da un precio nuevo (`viajeDatos` nuevo). */
    /* El dueño ya revisó la transferencia y la autorizó (9-sep-2026). Con
       esto el cliente sabe que su fecha está apartada de verdad, y el «va»
       siguiente del dueño ya es para el contrato, no para el pago. */
    pagoAprobado: (extra && Object.prototype.hasOwnProperty.call(extra, 'pagoAprobado'))
      ? !!extra.pagoAprobado
      : !!(antes && antes.pagoAprobado),
    /* Y el visto bueno a los datos del contrato. Son DOS autorizaciones
       distintas (dictado del dueño, 9-sep-2026: «1 para verificar datos de
       contrato y otro para verificar transferencia; una vez autorizados los
       dos, se genera el contrato»). Se pueden dar en cualquier orden. */
    contratoAutorizado: (extra && Object.prototype.hasOwnProperty.call(extra, 'contratoAutorizado'))
      ? !!extra.contratoAutorizado
      : !!(antes && antes.contratoAutorizado),
    precioVencido: (extra && extra.viajeDatos)
      ? !!(extra && extra.precioVencido)
      : ((extra && Object.prototype.hasOwnProperty.call(extra, 'precioVencido'))
        ? !!extra.precioVencido
        : !!(antes && antes.precioVencido)),
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
     base puede venir de hace un minuto. Con UNA excepción: los toques
     del seguimiento los escribe el cron desde otra instancia, así que
     ahí la base sabe más. Sin esto, un «va» del dueño escribiría de
     vuelta la ficha vieja con `toques: 0` y el cliente recibiría el
     mismo toque dos veces. */
  if (cartera.has(k)) {
    const enMemoria = cartera.get(k);
    /* Si la base es MÁS NUEVA que la memoria (otra instancia avanzó al
       cliente), gana la base entera: una instancia con la ficha de hace
       dos horas pisaba en la base lo que otra acababa de escribir y la
       etapa retrocedía (auditoría 7-sep-2026, B5). */
    if ((Number(ficha.visto) || 0) > (Number(enMemoria.visto) || 0)) {
      cartera.set(k, ficha);
      return;
    }
    if ((Number(ficha.toques) || 0) > (Number(enMemoria.toques) || 0)) {
      enMemoria.toques = Number(ficha.toques);
    }
    return;
  }
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
  recuerdaTicket, consumeTicket, tickets,
  callaLaIA, liberaLaIA, iaCallada, olvidaTodo,
  anotaPendiente, yaLoContesto, recordatoriosPendientes,
  anotaEtapa, fichaDe, carteraOrdenada, siembraFicha, fichaViva,
  CALLADO_MS, TOPE_TICKETS, RECUERDA_A_LAS_MS, TOPE_CARTERA
};
