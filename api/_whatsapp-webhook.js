/* ============================================================
   Webhook de WhatsApp — las reglas, sin red
   ------------------------------------------------------------
   Igual que `_webhook-logica.js` con Stripe: aquí entra el cuerpo
   crudo y sale qué contestar. No hay `fetch` ni Meta, y por eso
   se prueba entero sin conectar nada.

   POR QUÉ ESTE NO LLEVA `defensas.puerta`

   Todas las demás puertas del sitio exigen que la petición venga
   de nuestro propio dominio. Meta NO viene de ahí: viene de sus
   servidores, sin cabecera de origen que nos sirva. Ponerle
   `puerta` dejaría a Meta fuera y el bot no contestaría nunca.

   El candado aquí es OTRO, y es más fuerte: la firma. Meta firma
   cada aviso con el secreto de la aplicación, que solo tenemos
   nosotros y ellos. Sin firma buena, no se contesta.

   Es exactamente el mismo trato que con Stripe.
   ============================================================ */

const crypto = require('crypto');
/* Vive en la RAÍZ, no en `api/`, y a propósito: la pantalla de prueba
   lo carga desde el navegador, y Vercel no sirve nada de `api/` como
   archivo. Es el mismo lugar donde ya viven `unidades.js` y
   `cotizacion.js`, por la misma razón. */
const conversacion = require('../bot');
/* Los tickets al dueño y el reenvío de sus respuestas. Vive aparte
   porque no tiene nada que ver con la firma ni con Meta: es la
   mecánica de quién le habla a quién. */
const tickets = require('./_tickets.js');
const etapas = require('./_etapas.js');
const contrato = require('./_datos-contrato.js');
const confirmacion = require('./_confirmacion.js');
const tarifa = require('./_tarifa.js');

/* ------------------------------------------------------------
   POR WHATSAPP NADIE SE MANDA A OTRO NÚMERO
   ------------------------------------------------------------
   El guion de bot.js también vive en la página, y ahí «márcame al
   33 2400 2285» tiene sentido. Aquí el cliente YA está en WhatsApp:
   mandarlo a otro número es perderlo (dictado del dueño, 6-sep-2026;
   auditoría 7-sep, A6 y C6). Si el guion contestó eso, se cambia por
   una espera honesta y se le avisa al dueño (`pasa`).
   ------------------------------------------------------------ */
const OTRO_NUMERO = /33\s?2400\s?2285|m[aá]ndale esto por whatsapp|m[aá]rcame o escr[ií]beme al/i;
function sinMandarAOtroNumero(r) {
  if (!r || !OTRO_NUMERO.test(String(r.texto || ''))) return r;
  r.texto = r.solicitud
    ? 'Va. En breve te paso tu cotización y la disponibilidad de tu viaje 🙌'
    : 'Va, en breve te contestan por aquí mismo 🙌';
  r.pasa = true;
  r.opciones = [];
  return r;
}

/* ------------------------------------------------------------
   COMPARAR SIN FILTRAR EL TIEMPO
   ------------------------------------------------------------
   Un `===` sobre cadenas se corta en la primera letra distinta, y
   ese tiempo se mide para adivinar el secreto letra por letra.
   `timingSafeEqual` tarda lo mismo acierte o no, pero truena si
   los dos búferes miden distinto — así que primero se resumen los
   dos con SHA-256, que siempre da el mismo largo.
   ------------------------------------------------------------ */
function igualesEnTiempoConstante(a, b) {
  const A = crypto.createHash('sha256').update(String(a == null ? '' : a)).digest();
  const B = crypto.createHash('sha256').update(String(b == null ? '' : b)).digest();
  return crypto.timingSafeEqual(A, B);
}

/* ------------------------------------------------------------
   EL SALUDO DE ALTA (GET)
   ------------------------------------------------------------
   Al dar de alta el webhook, Meta llama UNA vez con un token que
   nosotros escribimos en su panel, y espera que le devolvamos su
   `challenge` tal cual. Si no cuadra, no da de alta nada.
   ------------------------------------------------------------ */
function verificaSuscripcion(params, entorno) {
  const env = entorno || process.env;
  const esperado = env.WHATSAPP_VERIFY_TOKEN;

  /* Falla CERRADA. Una variable que se olvidó de configurar no puede
     volverse una puerta abierta. */
  if (!esperado) {
    return { status: 503, cuerpo: 'Falta WHATSAPP_VERIFY_TOKEN en Vercel.' };
  }
  const p = params || {};
  if (p['hub.mode'] !== 'subscribe') {
    return { status: 400, cuerpo: 'modo no esperado' };
  }
  if (!igualesEnTiempoConstante(p['hub.verify_token'], esperado)) {
    return { status: 403, cuerpo: 'token incorrecto' };
  }
  /* Meta espera SU challenge en texto plano, sin comillas ni JSON. */
  return { status: 200, cuerpo: String(p['hub.challenge'] == null ? '' : p['hub.challenge']) };
}

/* ------------------------------------------------------------
   LA FIRMA (POST)
   ------------------------------------------------------------
   Meta manda `x-hub-signature-256: sha256=<hex>`, que es el HMAC
   del cuerpo CRUDO con el secreto de la aplicación. Sobre los
   bytes exactos: si alguien los parsea y los vuelve a serializar,
   la firma ya no cuadra aunque el contenido sea el mismo.
   ------------------------------------------------------------ */
function firmaValida(crudo, cabecera, secreto) {
  if (!secreto) return false;
  const texto = String(cabecera || '');
  if (texto.indexOf('sha256=') !== 0) return false;
  const dieron = texto.slice(7);
  const nuestra = crypto.createHmac('sha256', secreto)
    .update(Buffer.isBuffer(crudo) ? crudo : Buffer.from(String(crudo), 'utf8'))
    .digest('hex');
  return igualesEnTiempoConstante(dieron, nuestra);
}

/* ------------------------------------------------------------
   NO CONTESTAR DOS VECES LO MISMO
   ------------------------------------------------------------
   Meta reintenta cuando tarda la respuesta, y el reintento trae
   el MISMO id de mensaje. Sin esto, el cliente recibiría la misma
   contestación dos y tres veces.

   El mapa tiene tope duro y desaloja lo más viejo: la clave la
   elige quien manda, así que sin tope crecería sin fin. Esa es la
   regla 5 de `antes-de-escribir`, que ya se pagó una vez.
   ------------------------------------------------------------ */
const TOPE_VISTOS = 500;
const vistos = new Map();

function yaContestado(id) {
  if (!id) return false;
  if (vistos.has(id)) return true;
  vistos.set(id, Date.now());
  while (vistos.size > TOPE_VISTOS) {
    vistos.delete(vistos.keys().next().value);   // el más viejo primero
  }
  return false;
}

/* ------------------------------------------------------------
   FRENO POR QUIEN ESCRIBE
   ------------------------------------------------------------
   La clave es el número que manda, o sea QUIEN ATACA — no a quién
   se ataca. Un contador por destinatario dejaría que cualquiera
   silenciara al bot para los demás.
   ------------------------------------------------------------ */
const TOPE_POR_MINUTO = 12;
const TOPE_REMITENTES = 2000;
const remitentes = new Map();

function pasaElFreno(numero, ahora) {
  const t = ahora || Date.now();
  const reg = remitentes.get(numero) || { desde: t, n: 0 };
  if (t - reg.desde > 60000) { reg.desde = t; reg.n = 0; }
  reg.n += 1;
  remitentes.set(numero, reg);
  while (remitentes.size > TOPE_REMITENTES) {
    remitentes.delete(remitentes.keys().next().value);
  }
  return reg.n <= TOPE_POR_MINUTO;
}

/* ------------------------------------------------------------
   LA CONVERSACIÓN DE CADA QUIEN
   ------------------------------------------------------------
   ESTO FALTABA, Y ERA GRANDE. El webhook llamaba
   `conversacion.respuestaA(texto)` — sin estado. O sea que por
   WhatsApp el bot **nunca pudo sostener una conversación**: cada
   mensaje lo trataba como el primero, y preguntaba otra vez lo
   que el cliente ya había contestado.

   En la página no se notaba porque ahí el estado vive en el
   navegador. Aquí no hay navegador: hay que guardarlo.

   Se destapó el 2-sep-2026 armando los tickets: el ticket salía
   vacío porque `respuestaA` sin estado nunca llega a juntar el
   viaje.

   ------------------------------------------------------------
   Y DE UNA VEZ, LO QUE ESTO NO ES
   ------------------------------------------------------------
   Es memoria de instancia. Vercel recicla, y con eso se pierden
   las conversaciones a medias — el cliente tendría que volver a
   decir a dónde va.

   Cubre bien el caso normal, que es una conversación de unos
   minutos seguidos. Lo que NO cubre es al que contesta al día
   siguiente. Guardarlo de verdad es la etapa 3 del plan, en
   EuroSystem, junto con la cartera de contactos.

   Eran seis horas de vida, porque el guion retomaba «a media
   pregunta» y eso confundía. Desde el 6-sep-2026 son siete días: el
   dueño pidió que «si le mando mensaje un día después para mi
   cotización se acuerde», y con el agente retomar una plática de
   ayer ya no confunde: la lee y sigue. (La misma cifra vive en
   `_almacen.js`, que es donde de verdad sobrevive.)
   ------------------------------------------------------------ */
const VIDA_CHARLA_MS = 7 * 24 * 60 * 60 * 1000;
const TOPE_CHARLAS = 500;
const charlas = new Map();

function charlaDe(numero, ahora) {
  const c = charlas.get(numero);
  if (!c) return null;
  if ((ahora || Date.now()) - c.cuando > VIDA_CHARLA_MS) {
    charlas.delete(numero);
    return null;
  }
  return c.estado;
}

/* ------------------------------------------------------------
   LA CHARLA QUE VINO DE LA BASE
   ------------------------------------------------------------
   `procesa` es síncrona y leer de la base no lo es, así que la
   lectura se hace ANTES en `whatsapp.mjs` y aquí llega hecha —
   igual que los audios transcritos.

   Sin esto, cada vez que Vercel recicla la instancia el cliente
   volvía a empezar de cero: le habías dicho a dónde ibas y el
   bot preguntaba «¿a dónde va el plan?».

   Lo de memoria gana sobre lo de la base: es de este instante.
   ------------------------------------------------------------ */
function siembraCharla(numero, estado, ahora) {
  if (!numero || !estado) return;
  if (charlas.has(numero)) return;
  charlas.set(numero, { estado: estado, cuando: ahora || Date.now() });
}

function guardaCharla(numero, estado, ahora) {
  if (!numero) return;
  /* `estado` en null es una conversación que terminó: se borra en vez
     de guardar un nulo, para no ocupar lugar del tope con nada. */
  if (!estado) { charlas.delete(numero); return; }
  charlas.set(numero, { estado: estado, cuando: ahora || Date.now() });
  while (charlas.size > TOPE_CHARLAS) {
    charlas.delete(charlas.keys().next().value);
  }
}

/* Solo para las pruebas: deja empezar de cero. */
/* ------------------------------------------------------------
   UN AVISO POR CLIENTE, NO UNO POR MENSAJE
   ------------------------------------------------------------
   El aviso «te están escribiendo» sale cada vez que el bot no
   puede solo y todavía no hay viaje. Quien escribe tres veces
   seguidas —«hola», «hola?», «buenas»— mandaría tres avisos, y
   tres avisos por una persona vuelven a entrenar al dueño a
   ignorarlos, que es justo lo que se acababa de arreglar.

   Media hora es el plazo: lo bastante para no repetir dentro de
   la misma conversación, y lo bastante corto para que quien
   vuelve a la tarde sí levante la mano otra vez.
   ------------------------------------------------------------ */
const VIDA_AVISO_MS = 30 * 60 * 1000;
const avisados = new Map();

/* ------------------------------------------------------------
   CÓMO SE LLAMA CADA QUIEN
   ------------------------------------------------------------
   Lo manda Meta en cada aviso y vive aparte de la conversación,
   que se vence a las seis horas. El nombre no caduca: si vuelve
   mañana, sigue siendo la misma persona.

   Se guarda SOLO EL PRIMER NOMBRE. «María Fernanda Ortiz Lugo»
   en un saludo suena a que le están leyendo su credencial; un
   vendedor dice «Marisol». El nombre completo se le pide después,
   para el contrato, que es donde sí hace falta.

   Y se descartan los que no son nombres: mucha gente pone su
   negocio, un emoji o un apodo raro en el perfil de WhatsApp, y
   «Va, 🌵TACOS EL PRIMO🌵» es peor que no decir nada.
   ------------------------------------------------------------ */
const TOPE_NOMBRES = 500;
const nombres = new Map();

function recuerdaNombre(numero, crudo) {
  const primero = String(crudo || '').trim().split(/\s+/)[0] || '';
  /* Letras, y de largo razonable. Nada de emojis, cifras ni MAYÚSCULAS
     de negocio. */
  if (!/^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]{3,15}$/.test(primero)) return;
  if (primero === primero.toUpperCase() && primero.length > 4) return;
  const bonito = primero.charAt(0).toUpperCase() + primero.slice(1).toLowerCase();
  nombres.set(String(numero).replace(/\D+/g, '').slice(-10), bonito);
  while (nombres.size > TOPE_NOMBRES) {
    nombres.delete(nombres.keys().next().value);
  }
}

function nombreDe(numero) {
  return nombres.get(String(numero || '').replace(/\D+/g, '').slice(-10)) || null;
}

function yaSeAviso(numero, ahora) {
  const t = avisados.get(numero);
  const cuando = ahora || Date.now();
  if (t && cuando - t < VIDA_AVISO_MS) return true;
  avisados.set(numero, cuando);
  while (avisados.size > TOPE_CHARLAS) {
    avisados.delete(avisados.keys().next().value);
  }
  return false;
}

function olvidaTodo() {
  vistos.clear(); remitentes.clear(); charlas.clear(); avisados.clear();
  nombres.clear();
}

/* ------------------------------------------------------------
   QUÉ SE LE CONTESTA AL QUE MANDA UNA FOTO
   ------------------------------------------------------------
   Desde que el cobro pasó a transferencia (3-sep-2026), la foto
   que manda un cliente es, casi siempre, el comprobante de su
   depósito. O sea: es el pago.

   Y ese es el minuto de más nervios de toda la conversación.
   Acaba de transferirle dinero a alguien que no conoce, por un
   viaje que todavía no existe. Lo que reciba en los siguientes
   diez segundos decide si se queda tranquilo o si empieza a
   dudar. Antes recibía «Ya lo recibí 🙌 Déjame revisarlo y te
   confirmo», que no dice de qué, ni cuándo, ni qué sigue.

   ------------------------------------------------------------
   LAS DOS COSAS QUE NO SE PUEDEN HACER
   ------------------------------------------------------------
   1 · DAR EL PAGO POR BUENO. Un comprobante se ve, se cotejan
       los últimos dígitos y se revisa el banco. Eso lo hace una
       persona. El bot acusa recibo y dice la verdad: que lo van
       a revisar. Decirle «listo, pagado» y que el depósito no
       haya entrado es la peor mentira que puede decir este bot.

   2 · PONER UNA HORA. «En 10 minutos» es una promesa que la
       tiene que cumplir alguien más. Se dice el ORDEN de lo que
       va a pasar, que tranquiliza igual y no compromete a nadie
       a un reloj.

   ------------------------------------------------------------
   POR QUÉ SON DOS RESPUESTAS Y NO UNA
   ------------------------------------------------------------
   Una foto de alguien a quien YA se le dio precio es su
   comprobante. Una foto de alguien que nunca preguntó nada es
   otra cosa —el logo de su empresa, una captura, el grupo—.
   Contestarle a ése «lo verifico con el banco» es absurdo y lo
   confunde.

   La ficha ya sabe cuál es cuál, así que se usa.

   Y al que ya dio su nombre no se le vuelve a pedir: repetir
   una pregunta que el cliente ya contestó es la forma más rápida
   de que sienta que del otro lado no hay nadie leyendo.
   ------------------------------------------------------------ */
function acuseDeFoto(ficha) {
  const etapa = ficha && ficha.etapa;
  const esperabamosDeposito =
    etapa === 'con_precio' || etapa === 'va_a_apartar' || etapa === 'mando_comprobante';

  if (!esperabamosDeposito) {
    /* No le habíamos dado precio: esa foto no es un comprobante. */
    return 'Ya lo vi 🙌 Déjame revisarlo y te digo.';
  }

  /* Se le dice la verdad del plazo —«puede tardar algunas horas»— y
     enseguida se le pone algo que hacer: los datos de su contrato.
     Dictado del dueño el 3-sep-2026. Esas horas de espera son el hueco
     donde el cliente se arrepiente; llenarlo con algo que además hace
     falta lo resuelve por los dos lados.

     El texto vive en `_datos-contrato.js`, con los demás de esa etapa,
     para que se lea todo junto el día que haya que cambiarlo. */
  return 'Ya me llegó, gracias 🙌\n\n' +
    contrato.pideLosDatos(!!(ficha && ficha.agencia));
}

/* ------------------------------------------------------------
   EL TABLERO, ESCRITO
   ------------------------------------------------------------
   Un renglón por cliente, agrupado por etapa, del que ya mandó
   dinero al que apenas escribió. En WhatsApp un renglón se lee
   de un vistazo y un párrafo no se lee: por eso va así de corto
   aunque quepa más.

   El número va COMPLETO, no recortado: es lo que el dueño toca
   para abrir la conversación.

   Y va con tope. Con 300 clientes esto sería un mensaje que Meta
   ni siquiera acepta, y un tablero que nadie lee no sirve. Se
   enseñan los 25 más urgentes y se dice cuántos quedaron fuera,
   en vez de fingir que no hay más.
   ------------------------------------------------------------ */
const TOPE_TABLERO = 25;

function armaTablero(fichas) {
  if (!fichas.length) {
    return '📋 *Tablero*\n\nNo hay nadie en la lista todavía.';
  }

  const lineas = ['📋 *Tablero*', ''];
  let etapaAnterior = null;

  fichas.slice(0, TOPE_TABLERO).forEach(function (f) {
    if (f.etapa !== etapaAnterior) {
      if (etapaAnterior !== null) lineas.push('');
      lineas.push('*' + etapas.renglon(f.etapa) + '*');
      etapaAnterior = f.etapa;
    }
    /* El viaje va en una sola línea aquí: la ficha lo guarda en dos
       —destino y fechas— porque el aviso del comprobante lo enseña
       completo, pero en una lista de 25 eso son 50 renglones. */
    const viaje = f.viaje ? ' · ' + String(f.viaje).split('\n')[0].replace(/^📍 /, '') : '';
    const dinero = typeof f.total === 'number'
      ? ' · $' + f.total.toLocaleString('es-MX') : '';
    /* ✋ = ese chat lo tiene el dueño (relevo). */
    lineas.push((f.enManosDe === 'dueno' ? '✋ ' : '· ') + f.cliente + viaje + dinero);
  });

  if (fichas.length > TOPE_TABLERO) {
    lineas.push('');
    lineas.push('_y ' + (fichas.length - TOPE_TABLERO) + ' más._');
  }

  return lineas.join('\n');
}

/* ------------------------------------------------------------
   LA CONVERSACIÓN, ESCRITA
   ------------------------------------------------------------
   El dueño escribe «ver 33...» y se le pinta la plática entera con
   ese cliente: quién dijo qué, en orden, con la hora.

   Nació de un miedo con nombre, el 4-sep-2026: «que los mensajes
   queden en el vacío me asusta muchísimo». Estaba fundado a medias.
   Nada se perdía —todo se guarda en el almacén desde el primer
   día— pero no había forma de LEERLO. El ticket trae el viaje
   armado, no las palabras: si el cliente sonaba molesto, si dijo
   que es para una boda, si soltó un presupuesto, eso no salía por
   ningún lado. Y el caso peor no avisaba nada: cuando el bot
   entiende mal pero CON CONFIANZA, `r.pasa` es falso y no se
   dispara ni ticket ni aviso. Sin esta pantalla, ese mensaje sí se
   iba de largo.

   Va del más viejo al más nuevo, como se lee un chat, aunque la
   base los entregue al revés: se piden los últimos N con `desc` y
   aquí se voltean.
   ------------------------------------------------------------ */

/* Meta corta en 4096. Se deja aire para el encabezado y el pie. */
const TOPE_CONVERSACION = 3900;

/* Un mensaje solo no se puede comer la pantalla entera. El bot
   manda párrafos de mil caracteres; el dueño necesita el hilo, no
   releer la cotización completa. */
const TOPE_UN_MENSAJE = 400;

const QUIEN_DIJO = { cliente: '👤', bot: '🤖', dueno: '🧑' };

/* México dejó el horario de verano en 2022: el centro del país es
   UTC-6 todo el año. Misma zona que usa `_webhook-logica.js`. */
const HORAS_UTC = -6;

function laHora(iso) {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return '';
  const d = new Date(t + HORAS_UTC * 3600 * 1000);
  return d.getUTCDate() + '/' + (d.getUTCMonth() + 1) + ' ' +
    String(d.getUTCHours()).padStart(2, '0') + ':' +
    String(d.getUTCMinutes()).padStart(2, '0');
}

function armaConversacion(numero, filas) {
  const cabeza = '💬 *Conversación con ' + numero + '*';

  if (!filas || !filas.length) {
    return cabeza + '\n\nNo hay nada guardado de este número.\n\n' +
      '_O nunca escribió, o su plática ya se borró por vieja._';
  }

  /* La base los entrega del más nuevo al más viejo, porque así se
     piden los últimos N. Un chat se lee al revés. */
  const enOrden = filas.slice().sort(function (a, b) {
    return String(a.cuando || '') < String(b.cuando || '') ? -1 : 1;
  });

  const lineas = enOrden.map(function (f) {
    const quien = QUIEN_DIJO[f.de] || '·';
    let dice = String(f.texto == null ? '' : f.texto).trim();
    if (dice.length > TOPE_UN_MENSAJE) {
      dice = dice.slice(0, TOPE_UN_MENSAJE) + '…';
    }
    /* Los saltos de línea de un mensaje largo del bot romperían la
       lectura de la lista: cada renglón dejaría de ser un mensaje.
       Se aplanan con una marca visible en vez de borrarse. */
    dice = dice.replace(/\s*\n+\s*/g, ' ⏎ ');
    return quien + ' _' + laHora(f.cuando) + '_ · ' + dice;
  });

  /* Si no cabe, se tiran los MÁS VIEJOS. Lo último que dijo el
     cliente es lo que el dueño necesita para contestar; lo de
     antier ya no cambia su respuesta. */
  let recortados = 0;
  while (lineas.length > 1 &&
      cabeza.length + lineas.join('\n').length > TOPE_CONVERSACION) {
    lineas.shift();
    recortados++;
  }

  const aviso = recortados
    ? '_… ' + recortados + (recortados === 1
        ? ' mensaje más viejo no cupo.' : ' mensajes más viejos no cupieron.') +
      '_\n\n'
    : '';

  return cabeza + '\n\n' + aviso + lineas.join('\n') +
    '\n\n_Contéstame este mensaje y se lo paso._';
}

/* ------------------------------------------------------------
   LOS COMANDOS DEL DUEÑO, EN UN SOLO LUGAR
   ------------------------------------------------------------
   Estaban escritos en línea donde se usaban, y eso alcanzaba
   mientras solo existiera «tablero», que nadie escribe respondiendo
   un ticket.

   «ver» rompió eso. La forma recomendada de usarlo es RESPONDER el
   ticket del cliente, y `clienteDeLaRespuesta` —que corre también
   en `apunta`, del otro lado— resolvía esa cita y guardaba la
   palabra «ver» dentro de la conversación de ese cliente, como si
   el dueño se la hubiera dicho. Ensuciaba justo lo que se quería
   leer, y con el tiempo el historial se llenaría de «ver» sueltos.

   Así que la pregunta «¿esto es un comando?» se responde en un solo
   lugar y la contestan los dos lados. Comando nuevo del dueño:
   agrégalo AQUÍ, no en línea.
   ------------------------------------------------------------ */
const PIDE_TABLERO =
  /^\s*(tablero|pendientes|en que van|en qué van|estatus|status|cartera)\s*[?¿!]*\s*$/i;

const PIDE_VER =
  /^\s*(?:ver|conversaci[oó]n|historial|chat|plática|platica)\s*(\+?[\d\s()-]{10,20})?\s*[?¿!]*\s*$/i;

/* ------------------------------------------------------------
   EL RELEVO (dictado del dueño, 7-sep-2026)
   ------------------------------------------------------------
   «Poder activar la IA en un chat o manejarlo yo.» Citando cualquier
   mensaje del cliente (un ticket, un reenvío) o escribiendo su número:
     · «yo» / «tomo» / «lo tomo» / «me lo quedo»  → el chat es suyo: el
       bot se calla y le REENVÍA lo que el cliente escriba; él contesta
       citando el reenvío, como cualquier ticket.
     · «bot» / «ia» / «suelta» / «libera»         → el chat vuelve a la IA.
   Queda en la ficha (`enManosDe`) y en el almacén.
   ------------------------------------------------------------ */
const PIDE_TOMO = /^\s*(yo|tomo|lo tomo|me lo quedo|lo atiendo yo)\s*[.!]*\s*$/i;
const PIDE_SUELTA = /^\s*(bot|ia|suelta|su[eé]ltalo|libera|lib[eé]ralo|retoma)\s*[.!]*\s*$/i;

/* «total 48000» y «3312345678 yo» también son comandos: no se le dijeron
   a ningún cliente y no deben quedar en su plática (auditoría 7-sep-2026,
   hallazgo 9). El número al frente se quita antes de comparar. */
const PIDE_TOTAL = /^\s*total\s+\$?\s*[\d.,\s]+\s*(mil|k)?\s*$/i;

/* El «ya no» del cliente, en sus palabras (dictado del dueño, 8-sep-2026:
   nada de pedirle «stop»). Mensaje completo y corto; con un arranque de
   cortesía opcional («gracias», «hola», «muchas gracias») y un remate
   opcional («gracias», «saludos», «de todos modos», «por ahora»). */
const YA_NO_QUIERE = new RegExp(
  '^\\s*(?:(?:hola|buen[oa]s?(?: d[ií]as| tardes| noches)?|muchas gracias|mil gracias|gracias|ok|okey|va)[,.! ]*)*' +
  '(?:' + [
    'stop', 'alto', 'basta',
    'no m[aá]s mensajes', 'no me escribas?(?: m[aá]s)?', 'ya no me escribas?', 'ya no me mandes?(?: nada| mensajes)?',
    'ya no(?: gracias)?', 'ya no,? gracias', 'no,? gracias', 'no gracias',
    'no me interesa', 'ya no me interesa', 'ya no nos interesa', 'no nos interesa',
    'ya no (?:lo |la )?(?:vamos a |voy a |lo vamos a |la vamos a )?(?:necesito|necesitamos|necesitar|ocupo|ocupamos|ocupar|queremos|quiero|querer|hacer)',
    'ya no (?:vamos|iremos|vamos a ir|va a haber viaje|hay viaje|se hizo|se hace|se va a hacer|se arm[oó]|se armó el viaje|se junt[oó] el grupo)',
    'ya no (?:lo |la )?vamos a hacer', 'ya no (?:sale|sali[oó]) el viaje', 'se (?:cancel[oó]|suspendi[oó]) el viaje', 'se cancel[oó]',
    'ya contrat(?:amos|é|e) (?:con )?otr[oa]', 'ya (?:lo |la )?resolvimos', 'ya (?:lo |la )?resolv[ií]', 'ya conseguimos (?:otro|camión|transporte)',
    'd[ée]jalo(?: as[ií])?', 'olv[ií]dalo', 'ya (?:no|nada)', 'nada,? gracias', 'as[ií] d[ée]jalo'
  ].join('|') + ')' +
  '(?:[,.! ]*(?:gracias|muchas gracias|mil gracias|saludos|de todos modos|de todas formas|por ahora|por el momento|igual gracias))*\\s*[.!]*\\s*$', 'i');
function esComandoDelDueno(mensaje) {
  const t = String((mensaje && mensaje.text && mensaje.text.body) || '');
  const sinNumero = t.replace(/^\s*\+?\d[\d\s()-]{9,17}\s*[:\-,]?\s*/, '');
  return PIDE_TABLERO.test(t) || PIDE_VER.test(t) || PIDE_TOTAL.test(t) ||
    PIDE_TOMO.test(t) || PIDE_SUELTA.test(t) || PIDE_TOMO.test(sinNumero) || PIDE_SUELTA.test(sinNumero);
}

/* ¿Este número ya habló con el bot? Vale la ficha (sembrada del almacén)
   o una charla en memoria. Se compara por los últimos 10 dígitos porque
   el dueño teclea «3312345678» y Meta manda «5213312345678». */
function conoceAlCliente(numero) {
  if (tickets.fichaDe(numero)) return true;
  const cola = String(numero || '').replace(/\D/g, '').slice(-10);
  if (!cola) return false;
  for (const k of charlas.keys()) {
    if (String(k).replace(/\D/g, '').slice(-10) === cola) return true;
  }
  return false;
}

/* ------------------------------------------------------------
   PROCESA UN AVISO DE META
   ------------------------------------------------------------
   Devuelve { status, cuerpo, envios }. `envios` es la lista de
   mensajes a mandar; quien llama es el que tiene la red. Así esto
   se prueba sin conectar nada.

   A Meta SIEMPRE se le contesta 200 cuando la firma es buena,
   aunque no hayamos sabido qué hacer con el aviso. Si se le
   contesta error, reintenta, y si insiste, apaga el webhook.
   ------------------------------------------------------------ */
/* ------------------------------------------------------------
   EL TRAMO SECRETO DE LA URL (modo Dualhook, 5-sep-2026)
   ------------------------------------------------------------
   Con Dualhook los mensajes llegan directo de Meta, pero firmados
   con el secreto de la app de Dualhook, que no comparten: nuestra
   firma HMAC no puede coincidir. Su recomendación —y la de Meta
   para este caso— es que la URL del webhook lleve un tramo
   secreto de alta entropía (`/api/whatsapp/<48 hex>`) y que cada
   aviso se compruebe contra el WABA y el número propios. Quien no
   sepa la URL no puede ni tocar la puerta (404, sin pista).

   La comparación es en tiempo constante, como la de la firma.
   ------------------------------------------------------------ */
/* ¿La IA es la que habla (el agente)? Encendido salvo AGENTE_IA=0. */
function agenteIA(env) {
  const v = (env || process.env).AGENTE_IA;
  return v === undefined || v === '' ? true : !/^(0|no|false|off)$/i.test(String(v).trim());
}

/* ¿La IA lee todos los mensajes? Encendido salvo SIEMPRE_IA=0. */
function siempreIA(env) {
  const v = (env || process.env).SIEMPRE_IA;
  return v === undefined || v === '' ? true : !/^(0|no|false|off)$/i.test(String(v).trim());
}

function rutaSecretaValida(dada, esperada) {
  const a = String(dada || '');
  const b = String(esperada || '');
  if (!a || !b || b.length < 32) return false;
  return igualesEnTiempoConstante(a, b);
}

/* En modo Dualhook, ¿este aviso es de NUESTRA cuenta? Todo `entry.id`
   tiene que ser nuestro WABA y todo `metadata.phone_number_id` nuestro
   número. Un aviso de otra cuenta no se procesa y se contesta 403. */
function avisoEsNuestro(aviso, env) {
  if (!aviso || aviso.object !== 'whatsapp_business_account') return false;
  const entradas = Array.isArray(aviso.entry) ? aviso.entry : [];
  if (!entradas.length) return false;
  /* Al menos UN cambio con nuestro número: un `entry` sin `changes` pasaba
     solo con el WABA (auditoría 7-sep-2026, B14). */
  let conNuestroNumero = 0;
  for (const e of entradas) {
    if (!e || String(e.id || '') !== String(env.WHATSAPP_WABA_ID || '')) return false;
    for (const c of (e.changes || [])) {
      const meta = ((c && c.value) || {}).metadata || {};
      if (String(meta.phone_number_id || '') !== String(env.WHATSAPP_PHONE_ID || '')) return false;
      conNuestroNumero++;
    }
  }
  return conNuestroNumero > 0;
}

/* ------------------------------------------------------------
   LA PUERTA, SEPARADA
   ------------------------------------------------------------
   Firma (Meta directo) o tramo secreto + WABA + número (Dualhook), y el
   cuerpo legible. Vive aparte de `procesa` porque `whatsapp.mjs` la
   necesita ANTES de tocar red o almacén: hasta la auditoría del
   7-sep-2026, los audios se bajaban y los mensajes se escribían en el
   almacén antes de saber si el aviso era nuestro, y `POST /api/whatsapp`
   sin llave es público. Devuelve `{ rechazo }` con el status y cuerpo que
   toca contestar, o `{ aviso }` ya parseado si todo está bien.
   ------------------------------------------------------------ */
function revisaLaPuerta(crudo, firma, entorno) {
  const env = entorno || process.env;
  const porRutaSecreta = env.RUTA_SECRETA_OK === '1';

  if (porRutaSecreta) {
    /* Modo Dualhook: sin firma posible; la puerta ya comprobó el tramo
       secreto. Aquí se exige saber quiénes somos: sin WABA o número
       configurados, cerrado a fallos. */
    if (!env.WHATSAPP_WABA_ID || !env.WHATSAPP_PHONE_ID) {
      return { rechazo: { status: 503, cuerpo: { error: 'sin WABA o numero configurados' }, envios: [] } };
    }
  } else {
    if (!env.WHATSAPP_APP_SECRET) {
      return { rechazo: { status: 503, cuerpo: { error: 'sin secreto' }, envios: [] } };
    }
    if (!firmaValida(crudo, firma, env.WHATSAPP_APP_SECRET)) {
      return { rechazo: { status: 401, cuerpo: { error: 'firma invalida' }, envios: [] } };
    }
  }

  let aviso;
  try {
    aviso = JSON.parse(Buffer.isBuffer(crudo) ? crudo.toString('utf8') : String(crudo));
  } catch (e) {
    if (porRutaSecreta) {
      /* Sin firma, un cuerpo ilegible no se puede atribuir a nadie: no se acepta. */
      return { rechazo: { status: 400, cuerpo: { error: 'cuerpo ilegible' }, envios: [] } };
    }
    /* Firma buena pero cuerpo ilegible: es cosa nuestra, no de un
       atacante. Se acepta para que Meta no reintente en balde. */
    return { rechazo: { status: 200, cuerpo: { ok: true, aviso: 'cuerpo ilegible' }, envios: [] } };
  }

  if (porRutaSecreta && !avisoEsNuestro(aviso, env)) {
    return { rechazo: { status: 403, cuerpo: { error: 'aviso de otra cuenta' }, envios: [] } };
  }
  return { aviso: aviso };
}

/* El reloj de la petición. `AHORA_DE_PRUEBA` es para las pruebas; en
   producción se ignora aunque alguien la deje puesta (auditoría del
   7-sep-2026: congelaría el freno, los vencimientos y el seguimiento sin
   que nada avisara). */
function relojDe(env) {
  const e = env || process.env;
  if (e.VERCEL_ENV === 'production') return Date.now();
  return Number(e.AHORA_DE_PRUEBA) || Date.now();
}

function procesa(crudo, firma, entorno) {
  const env = entorno || process.env;
  const puerta = revisaLaPuerta(crudo, firma, env);
  if (puerta.rechazo) return puerta.rechazo;
  const aviso = puerta.aviso;

  const envios = [];
  const entradas = (aviso && aviso.entry) || [];
  const ahora = relojDe(env);

  /* ------------------------------------------------------------
     LOS RECORDATORIOS, COLGADOS DEL TRÁFICO
     ------------------------------------------------------------
     En serverless no hay temporizadores: nadie despierta a las 15
     horas. Así que cada vez que ENTRA cualquier aviso se mira si
     hay tickets vencidos, y si los hay se recuerdan.

     Va antes de atender el mensaje para que el recordatorio salga
     aunque ese mensaje resulte ser basura o venga frenado.
     ------------------------------------------------------------ */
  const dueno = tickets.numeroDelDueno(env);
  if (dueno) {
    tickets.recordatoriosPendientes(ahora).forEach(function (rec) {
      envios.push({
        numeroDeOrigen: (((entradas[0] || {}).changes || [{}])[0].value || {})
          .metadata && (((entradas[0] || {}).changes || [{}])[0].value || {}).metadata.phone_number_id,
        para: dueno,
        texto: rec.texto,
        esTicket: true,
        sobreCliente: rec.cliente,
        pasaAPersona: false,
        escribio: '[recordatorio]'
      });
    });
  }

  for (let i = 0; i < entradas.length; i++) {
    const cambios = entradas[i].changes || [];
    for (let j = 0; j < cambios.length; j++) {
      const valor = (cambios[j] && cambios[j].value) || {};
      /* Para saber si Dualhook nos avisa de lo que el DUEÑO escribe desde
         el teléfono del negocio (los «ecos»): si llega un campo que no
         sea `messages`, o llaves que no conocemos, se apunta sin
         contenido. Con eso se decide si el relevo puede ser automático
         (7-sep-2026). */
      const campo = cambios[j] && cambios[j].field;
      const llavesRaras = Object.keys(valor).filter(function (k) {
        return ['messaging_product', 'metadata', 'contacts', 'messages', 'statuses', 'errors'].indexOf(k) < 0;
      });
      if ((campo && campo !== 'messages') || llavesRaras.length) {
        console.log('[aviso] campo=' + (campo || '?') + ' llaves=' + Object.keys(valor).join(','));
      }

      /* Los acuses de entrega («entregado», «leído») llegan por aquí
         mismo y NO son mensajes. Contestarlos sería escribirle al
         cliente cada vez que abre la conversación. */
      if (!valor.messages) continue;

      const deQuien = (valor.metadata && valor.metadata.phone_number_id) || '';

      /* ------------------------------------------------------------
         EL NOMBRE DEL CLIENTE VIENE GRATIS
         ------------------------------------------------------------
         Meta manda el nombre del perfil de WhatsApp en cada aviso,
         en `contacts[].profile.name`. Estaba ahí desde el principio y
         no lo miraba nadie.

         Importa más de lo que parece. De toda la investigación de
         ventas que trajo el dueño, usar el nombre es lo más barato
         que hay y lo que más cambia el tono: «Va, Marisol» no se lee
         igual que «Va». Y no hay que pedírselo — pedir un dato que ya
         tienes es de las cosas que delatan a un bot.

         Se guarda por número, no en el estado de la conversación: el
         nombre no se pierde cuando la charla se vence a las 6 horas.
         ------------------------------------------------------------ */
      (valor.contacts || []).forEach(function (c) {
        const suNombre = c && c.profile && c.profile.name;
        if (c && c.wa_id && suNombre) recuerdaNombre(c.wa_id, suNombre);
      });

      for (let k = 0; k < valor.messages.length; k++) {
        const m = valor.messages[k] || {};
        /* Una reacción (👍 a un mensaje) o un sticker no son una pregunta:
           no se contestan, no despiertan al dueño y no reinician nada.
           Antes caían en «Lo recibí 👍 Cuéntame: ¿a dónde van…?» y le
           mandaban al dueño «te están escribiendo» (auditoría 7-sep-2026). */
        if (m.type === 'reaction' || m.type === 'sticker') continue;
        /* El freno NO aplica al dueño: contestando una tanda de tickets
           pasaba de 12 por minuto y sus «va» se perdían. Y el freno va
           ANTES de marcar el id como visto: lo frenado no queda «contestado»
           y el reintento de Meta sí entra. Con el reloj de la petición
           (`AHORA_DE_PRUEBA` en pruebas), para poder «esperar un minuto». */
        const loEscribeElDueno = tickets.esDelDueno(m.from, env);
        if (!loEscribeElDueno && !pasaElFreno(m.from || 'desconocido', ahora)) continue;
        if (yaContestado(m.id)) continue;
        /* El cliente dice que ya no, con sus palabras: «ya no», «no gracias»,
           «ya no vamos a ir», «ya contratamos otro»… Dictado del dueño
           (8-sep-2026): las plantillas NO ofrecen «stop» porque espanta; el
           bot detecta el «ya no» y se despide, sin insistir. Sin IA, sin
           ticket al dueño. El seguimiento se cierra solo, porque con esto
           el cliente «contestó después del precio». «Stop» sigue valiendo
           por si alguien lo escribe. Solo mensajes cortos y completos: un
           «ya no, mejor a Chapala» no es un adiós y sigue a la IA. */
        if (!loEscribeElDueno && m.type === 'text' && YA_NO_QUIERE.test(String((m.text && m.text.body) || ''))) {
          tickets.anotaEtapa(m.from, tickets.fichaDe(m.from) ? tickets.fichaDe(m.from).etapa : 'escribio',
            { clienteEn: ahora }, ahora);
          envios.push({
            numeroDeOrigen: (((valor || {}).metadata || {}).phone_number_id) || env.WHATSAPP_PHONE_ID,
            para: m.from,
            texto: 'Va, entendido 🙌 Cualquier cosa que se te ofrezca más adelante, aquí ando.',
            pasaAPersona: false,
            escribio: '[ya no quiere]'
          });
          continue;
        }

        /* ------------------------------------------------------------
           ¿ESTO LO ESCRIBIÓ EL DUEÑO?
           ------------------------------------------------------------
           Si sí, NO es un cliente al que haya que contestarle: es una
           respuesta para reenviar. Va antes que todo lo demás — el bot
           contestándole al dueño sería absurdo.
           ------------------------------------------------------------ */
        if (tickets.esDelDueno(m.from, env)) {
          /* ------------------------------------------------------------
             EL TABLERO
             ------------------------------------------------------------
             El dueño escribe «tablero» y recibe en qué va cada cliente.

             Nació de un pedido que era otro: quería las ETIQUETAS de
             WhatsApp Business —«ya preguntó precio», «ya se lo di», «ya
             mandó transferencia»—. No se pueden poner por API: la
             referencia de Meta para un número tiene un solo endpoint, y
             es `/messages`. Está explicado en `_etapas.js` para que no
             se vuelva a intentar.

             Pero lo que quería no eran las etiquetas: era saber en qué
             va cada quien sin ir a buscarlo. Eso el bot ya lo sabe, y
             aquí lo dice. Sale ordenado por etapa, así que el que ya
             mandó dinero va hasta arriba.

             Va ANTES de buscar a quién responderle: si el dueño escribe
             «tablero» no está contestándole a un cliente.
             ------------------------------------------------------------ */
          /* Se lee de `m` y no de `texto`: `texto` se arma más abajo,
             después de este bloque, porque incluye la transcripción de
             los audios y esa no se necesita aquí. */
          if (PIDE_TABLERO.test(String((m.text && m.text.body) || ''))) {
            envios.push({
              numeroDeOrigen: deQuien,
              para: m.from,
              /* Lo de memoria va como respaldo, no como respuesta. El
                 tablero de verdad sale de la base y se arma en
                 `whatsapp.mjs`: aquí no hay red.

                 Se cazó reciclando la instancia a propósito en
                 `probar-almacen`: la base tenía las doce fichas y el
                 tablero salía vacío, porque leía la memoria que Vercel
                 acababa de tirar. */
              texto: armaTablero(tickets.carteraOrdenada()),
              pideTablero: true,
              pasaAPersona: false,
              escribio: '[tablero]'
            });
            continue;
          }

          /* ------------------------------------------------------------
             VER LA CONVERSACIÓN
             ------------------------------------------------------------
             El tablero dice EN QUÉ VA cada cliente. Esto dice QUÉ DIJO.
             Son dos preguntas distintas y hacían falta las dos.

             Dos formas de pedirla, por la misma razón que los tickets
             tienen dos caminos: la memoria de Vercel se recicla.

               1 · «ver 3312345678» — el número escrito. Funciona
                   siempre, aunque la instancia esté fría.
               2 · Responder un ticket con solo «ver» — sale del id
                   citado, mientras la instancia siga caliente.

             VA ANTES DEL REENVÍO, y eso no es un detalle de orden: si
             cayera después, `clienteDeLaRespuesta` resolvería «ver»
             como un mensaje del dueño para el cliente y le mandaría la
             palabra «ver» a la cara. Cualquier comando nuevo del dueño
             va arriba de esta línea, no abajo.
             ------------------------------------------------------------ */
          const pidioVer = String((m.text && m.text.body) || '').match(PIDE_VER);
          if (pidioVer) {
            /* El número escrito manda sobre la cita: si el dueño se
               tomó la molestia de teclearlo, es el que quiere ver. */
            let aQuien = tickets.soloDigitos(pidioVer[1] || '');
            if (aQuien.length < 10) {
              const citado = tickets.clienteDeLaRespuesta(m, tickets.tickets);
              aQuien = citado ? citado.cliente : '';
            }

            if (!aQuien) {
              envios.push({
                numeroDeOrigen: deQuien,
                para: m.from,
                texto: '¿De quién? 🙈\n\nEscríbeme *ver* y el número ' +
                  '—por ejemplo *ver 3312345678*— o responde el ticket ' +
                  'de ese cliente con la palabra *ver*.',
                pasaAPersona: false,
                escribio: '[ver · sin destinatario]'
              });
              continue;
            }

            envios.push({
              numeroDeOrigen: deQuien,
              para: m.from,
              /* Lo de aquí es el respaldo honesto, no la respuesta: en
                 este archivo no hay red. La conversación de verdad sale
                 de la base y se arma en `whatsapp.mjs`, igual que el
                 tablero. Si el almacén no contesta, el dueño ve ESTO y
                 sabe que no fue que el cliente no escribiera. */
              texto: '💬 *Conversación con ' + aQuien + '*\n\n' +
                'No pude leer el almacén ahorita. Vuelve a intentar en un ' +
                'momento.',
              pideConversacion: aQuien,
              /* `esTicket` con `sobreCliente` es lo que hace que
                 responder ESTE mensaje le llegue al cliente: así se
                 lee el hilo y se contesta sin teclear el número. */
              esTicket: true,
              sobreCliente: aQuien,
              pasaAPersona: false,
              escribio: '[ver]'
            });
            continue;
          }

          const dirigido = tickets.clienteDeLaRespuesta(m, tickets.tickets);

          /* ---- el relevo: «yo» / «bot» ---- */
          const textoDelDueno = (dirigido && dirigido.texto) || String((m.text && m.text.body) || '');
          const orden = PIDE_TOMO.test(textoDelDueno) ? 'tomo' : (PIDE_SUELTA.test(textoDelDueno) ? 'suelta' : null);
          if (orden) {
            const aQuien = dirigido && dirigido.cliente;
            if (!aQuien) {
              envios.push({
                numeroDeOrigen: deQuien, para: m.from,
                texto: '¿De quién? Responde un mensaje de ese cliente con «' + (orden === 'tomo' ? 'yo' : 'bot') +
                  '», o escríbeme su número y luego la palabra: «33 1234 5678 ' + (orden === 'tomo' ? 'yo' : 'bot') + '».',
                pasaAPersona: false, escribio: '[relevo · sin cliente]'
              });
              continue;
            }
            const f = tickets.fichaDe(aQuien);
            tickets.anotaEtapa(aQuien, f ? f.etapa : 'escribio', { enManosDe: orden === 'tomo' ? 'dueno' : null }, ahora);
            if (orden === 'tomo') tickets.callaLaIA(aQuien, ahora); else tickets.liberaLaIA(aQuien);
            envios.push({
              numeroDeOrigen: deQuien, para: m.from,
              esTicket: true, sobreCliente: aQuien,
              texto: orden === 'tomo'
                ? '✋ Tomaste el chat de *' + aQuien + '*. El bot no le contesta: te reenvío lo que escriba y tú ' +
                  'le respondes citando el reenvío. Para devolvérselo a la IA, responde cualquier mensaje suyo con «bot».'
                : '🤖 El bot retoma el chat de *' + aQuien + '*.',
              pasaAPersona: false, escribio: '[relevo · ' + orden + ']'
            });
            continue;
          }

          /* ------------------------------------------------------------
             ¿ESTÁ CONTESTANDO UN PRECIO POR CONFIRMAR?
             ------------------------------------------------------------
             Regla del dueño (5-sep-2026): el bot no da precio sin su
             «va». Si ese cliente tiene un precio esperando, «va» lo
             manda tal cual, un número lo manda con ese total, y
             cualquier otra cosa sigue el camino de siempre: sus
             palabras, literales, y el bot se calla con ese cliente.

             Aquí solo se DECIDE; el precio se rearma y se manda en
             `whatsapp.mjs`, que es donde hay red y cotizador. Y el bot
             NO se calla al confirmar: el cliente sigue hablando con la
             misma voz, que es de lo que se trata.
             ------------------------------------------------------------ */
          const fichaDelCliente = dirigido && tickets.fichaDe(dirigido.cliente);
          /* El ticket citado trae su propio viaje (`carga`) desde el
             7-sep-2026: con dos cotizaciones en el aire, el «va» a cada
             ticket confirma el suyo, aunque la ficha ya tenga otro
             pendiente. Un ticket ya consumido (su precio ya se mandó) no
             confirma nada: el segundo «va» llega literal. Un ticket viejo
             sin carga, o el número escrito a mano, usan la ficha. */
          const citado = m.context && m.context.id;
          const cargaCitada = (dirigido && dirigido.via === 'cita') ? dirigido.carga : null;
          let pendiente = null;
          if (cargaCitada) pendiente = cargaCitada.consumido ? null : cargaCitada;
          /* SOLO el ticket del precio confirma precio (auditoría 7-sep-2026,
             C2). Antes, un «15000» contestando el ticket del comprobante
             —para anotar el depósito— le mandaba al cliente una cotización
             nueva de $15,000. Por número escrito a mano sí vale la ficha:
             ahí el dueño está nombrando al cliente a propósito. */
          else if (dirigido && dirigido.via === 'numero' &&
                   fichaDelCliente && fichaDelCliente.porConfirmar) pendiente = fichaDelCliente.porConfirmar;

          /* ------------------------------------------------------------
             «TOTAL 48000»: EL DUEÑO CAMBIA EL TOTAL DE UN VIAJE YA COTIZADO
             ------------------------------------------------------------
             Si renegoció por texto libre («te lo dejo en 48,000»), la ficha
             seguía con el total viejo y el BORRADOR salía mal (C14). Con
             «total N» citando cualquier ticket del cliente, la ficha se
             actualiza —total y anticipo— sin mandarle nada al cliente.
             ------------------------------------------------------------ */
          const cambioDeTotal = dirigido && dirigido.texto.match(/^total\s+\$?\s*([\d.,\s]+)\s*(mil|k)?\s*$/i);
          if (cambioDeTotal && fichaDelCliente && typeof fichaDelCliente.total === 'number') {
            const leido = confirmacion.interpreta(cambioDeTotal[1] + (cambioDeTotal[2] ? ' ' + cambioDeTotal[2] : ''));
            if (leido.tipo === 'precio') {
              const multiplo = tarifa.ANTICIPO_MULTIPLO || 500;
              const anticipo = Math.min(leido.total, Math.ceil(leido.total * tarifa.ANTICIPO / multiplo) * multiplo);
              tickets.anotaEtapa(dirigido.cliente, fichaDelCliente.etapa, { total: leido.total, anticipo: anticipo }, ahora);
              envios.push({
                numeroDeOrigen: deQuien, para: m.from,
                texto: '✅ Total de ' + dirigido.cliente + ' actualizado a *$' + leido.total.toLocaleString('en-US') +
                  '* (anticipo *$' + anticipo.toLocaleString('en-US') + '*). Al cliente no le mandé nada.',
                pasaAPersona: false, escribio: '[total actualizado]'
              });
              continue;
            }
          }
          if (pendiente) {
            const dicho = confirmacion.interpreta(dirigido.texto);
            if (dicho.tipo !== 'texto') {
              if (cargaCitada) tickets.consumeTicket(citado);
              envios.push({
                numeroDeOrigen: deQuien,
                para: dirigido.cliente,
                texto: '',
                confirmaPrecio: true,
                cargaDelTicket: pendiente,
                ticketConsumido: cargaCitada ? citado : null,
                totalFijado: dicho.tipo === 'precio' ? dicho.total : null,
                pasaAPersona: false,
                escribio: '[precio · ' + (dicho.tipo === 'va' ? 'confirmado' : 'fijado en ' + dicho.total) + ']'
              });
              tickets.yaLoContesto(dirigido.cliente);
              continue;
            }
          }

          /* ------------------------------------------------------------
             ¿ESTÁ DANDO EL «VA» A LA FICHA DEL CONTRATO?
             ------------------------------------------------------------
             Regla del dueño (5-sep-2026): «cuando confirme y autorice un
             contrato lo puedes subir a EuroSystem; entra como BORRADOR».
             Si la ficha de ese cliente ya está completa, no se ha subido,
             y él contesta «va», se registra el contrato. Un número o
             cualquier otro texto no cuentan aquí: eso es para el precio o
             para el cliente. La subida —que tiene red— vive en
             `whatsapp.mjs`.
             ------------------------------------------------------------ */
          if (fichaDelCliente && fichaDelCliente.contrato &&
              contrato.estaCompleto(fichaDelCliente.contrato) &&
              !fichaDelCliente.contratoSubido &&
              confirmacion.interpreta(dirigido.texto).tipo === 'va') {
            envios.push({
              numeroDeOrigen: deQuien,
              para: dirigido.cliente,
              texto: '',
              subeContrato: true,
              pasaAPersona: false,
              escribio: '[contrato · autorizado]'
            });
            tickets.yaLoContesto(dirigido.cliente);
            continue;
          }

          /* Un «va» o un número a un ticket que NO es el del precio (el
             «ver», el del comprobante, la pregunta de RFC, uno ya
             contestado): no se manda nada al cliente y se le dice al
             dueño cuál ticket es (C2). */
          if (dirigido && dirigido.via === 'cita' && !pendiente &&
              confirmacion.interpreta(dirigido.texto).tipo !== 'texto') {
            envios.push({
              numeroDeOrigen: deQuien, para: m.from,
              texto: 'Ese no es el ticket del precio 🙈 Contesta el que dice *💰 Precio por confirmar* ' +
                '(el más reciente de ese cliente), o escríbeme «' + dirigido.cliente + ' 52,000» con su número y el precio.',
              pasaAPersona: false, escribio: '[precio · ticket equivocado]'
            });
            continue;
          }
          if (dirigido && dirigido.texto && dirigido.via === 'numero' && !conoceAlCliente(dirigido.cliente)) {
            /* Un dedazo en el número mandaba el viaje y el precio de un
               cliente a un desconocido (auditoría 7-sep-2026, hallazgo 6).
               A un número que nunca ha hablado con el bot no se le manda
               nada: se le avisa al dueño y él revisa. */
            envios.push({
              numeroDeOrigen: deQuien, para: m.from,
              texto: '🙈 No conozco el número *' + dirigido.cliente + '*: nadie con ese número ha escrito al bot. ' +
                'No le mandé nada. Revisa el número, o contesta citando un mensaje de ese cliente.',
              pasaAPersona: false, escribio: '[del dueño · número desconocido]'
            });
            continue;
          }
          if (dirigido && dirigido.texto) {
            /* Sus palabras van TAL CUAL. No se adornan ni se corrigen:
               si el dueño escribió eso, eso es lo que quiso decir. */
            envios.push({
              numeroDeOrigen: deQuien,
              para: dirigido.cliente,
              texto: dirigido.texto,
              pasaAPersona: false,
              escribio: '[del dueño · ' + dirigido.via + ']'
            });
            /* Y desde aquí el bot se calla con ese cliente. */
            tickets.callaLaIA(dirigido.cliente);
            tickets.yaLoContesto(dirigido.cliente);
          } else if (dirigido && dirigido.via === 'cita' &&
                     (m.type === 'image' || m.type === 'document' || m.type === 'audio' || m.type === 'video') &&
                     m[m.type] && m[m.type].id) {
            /* Una foto, un PDF o una nota de voz citando el ticket: se
               reenvía al cliente tal cual (auditoría 7-sep-2026, A13). Antes
               caía en «No supe para quién es» aunque SÍ había citado. */
            envios.push({
              numeroDeOrigen: deQuien,
              para: dirigido.cliente,
              texto: (m[m.type].caption || ''),
              reenviaMedio: m[m.type].id,
              tipoMedio: m.type,
              pasaAPersona: false,
              escribio: '[del dueño · ' + m.type + ']'
            });
            tickets.callaLaIA(dirigido.cliente);
            tickets.yaLoContesto(dirigido.cliente);
          } else {
            /* No se supo a quién. Se le dice, en vez de tragárselo:
               un mensaje del dueño que no llega a nadie y nadie avisa
               es una venta perdida en silencio. */
            envios.push({
              numeroDeOrigen: deQuien,
              para: m.from,
              texto: 'No supe para quién es 🙈\n\nRespóndeme el ticket, o ' +
                'empieza tu mensaje con el número del cliente.',
              pasaAPersona: false,
              escribio: '[del dueño · sin destinatario]'
            });
          }
          continue;
        }

        /* ------------------------------------------------------------
           EL CHAT ES DEL DUEÑO (relevo, 7-sep-2026)
           ------------------------------------------------------------
           Si tomó este chat con «yo», el bot no contesta: le reenvía al
           dueño lo que el cliente escribió (texto, foto, PDF o audio) como
           ticket, para que conteste citándolo. Sigue así hasta que diga
           «bot». La ficha sí anota que el cliente escribió (para el
           seguimiento y el tablero).
           ------------------------------------------------------------ */
        const fichaDeAhora = tickets.fichaDe(m.from);
        if (fichaDeAhora && fichaDeAhora.enManosDe === 'dueno') {
          tickets.anotaEtapa(m.from, fichaDeAhora.etapa, { clienteEn: ahora }, ahora);
          const dueno = tickets.numeroDelDueno(env);
          if (dueno) {
            const medio = (m.image || m.document || m.audio || m.video) || null;
            const dijo = m.type === 'text' ? String((m.text && m.text.body) || '') : '';
            envios.push({
              numeroDeOrigen: deQuien, para: dueno,
              esTicket: true, sobreCliente: m.from,
              texto: '✋ *' + m.from + '* (en tus manos)' + (dijo ? ':\n«' + dijo.slice(0, 900) + '»' : ' te mandó ' + (m.type === 'audio' ? 'un audio' : m.type === 'image' ? 'una foto' : 'un archivo')) +
                '\n\nContéstame *este mensaje* y le llega tal cual. Responde «bot» para que la IA retome.',
              reenviaMedio: medio && medio.id ? medio.id : null,
              tipoMedio: medio && medio.id ? m.type : null,
              pasaAPersona: false, escribio: '[relevo · reenvío]'
            });
          }
          continue;
        }

        /* Si el dueño ya entró a esta conversación, el bot no habla.
           Dos voces distintas en el mismo chat acaban con la ilusión
           de que hay una sola persona atendiendo. */
        if (tickets.iaCallada(m.from)) continue;

        let texto;
        let audioLargo = false;
        if (m.type === 'text') {
          texto = (m.text && m.text.body) || '';
        } else if (m.type === 'audio') {
          /* ------------------------------------------------------------
             LA NOTA DE VOZ, YA TRANSCRITA
             ------------------------------------------------------------
             `procesa` es SÍNCRONA y transcribir no lo es. En vez de
             volverla asíncrona —y arrastrar con eso todas sus pruebas y
             el orden en que contesta— la transcripción se hace ANTES, en
             `whatsapp.mjs`, y aquí llega hecha en `entorno.audios`.

             Ventaja de hacerlo así: este archivo, que es el que guarda
             las reglas, no sabe nada de Groq ni de Meta. Se puede probar
             entero pasándole audios de mentiras.

             `null` o ausente = no se pudo transcribir. Se trata igual
             que cualquier otro mensaje que no es texto.
             ------------------------------------------------------------ */
          const dicho = (entorno.audios || {})[(m.audio && m.audio.id) || ''];
          if (dicho && dicho.dudosa) {
            /* Se entendio ALGO, pero Whisper no estaba segura. No se le
               cree: un destino mal oido es otro precio. Lo oye el
               vendedor. Es R45 aplicada al oido — si no se sabe al
               100 %, no se actua. */
            texto = null;
            audioLargo = true;
          } else if (dicho && dicho.muyLargo) {
            /* Arriba del minuto lo oye el vendedor, no la IA (dictado del
               dueño, 2-sep-2026). Ni se bajó ni se pagó. */
            texto = null;
            audioLargo = true;
          } else if (dicho && dicho.texto) {
            texto = dicho.texto;
          } else {
            texto = null;
          }
        } else {
          /* ------------------------------------------------------------
             UN AUDIO, UNA FOTO O UNA UBICACIÓN
             ------------------------------------------------------------
             Hoy no se traducen a texto, y en WhatsApp mexicano eso duele:
             mucha gente manda nota de voz antes que escribir.

             POR QUÉ NO SE PUEDE HOY, con nombre y apellido: la IA que ya
             tiene este proyecto —Claude, en `api/_entender.js`— NO oye.
             Su API recibe texto, imágenes y PDF; audio no. Transcribir
             pide OTRO servicio aparte (Whisper, Deepgram o similar), con
             su propia clave y su propio costo.

             El camino, cuando se decida, es corto y no toca al bot:
               1 · del aviso sale el `id` del audio
               2 · se le pide a Meta la URL de ese medio
               3 · se baja con el token de WhatsApp
               4 · se manda a transcribir
               5 · el texto entra por `respuestaA` como si lo hubieran
                   escrito — el bot entero funciona igual, sin cambiarle
                   una línea
             Y con tope de duración: un audio de veinte minutos se
             contesta pidiendo que lo escriba, no se transcribe.
             ------------------------------------------------------------ */
          texto = null;
        }

        const r = texto === null
          ? {
              /* Sin anunciar traspasos: el bot vive DENTRO del chat del
                 vendedor (decisión del 2-sep-2026). Y sin disculparse de
                 más — se pide lo que hace falta y se sigue vendiendo. */
              /* El audio LARGO no se disculpa ni pide que lo escriban: se
                 marca para el vendedor y se sostiene la conversación
                 mientras tanto. Es lo que el dueño pidió — que ése lo oiga
                 una persona— y de paso no delata nada. */
              /* ------------------------------------------------------------
                 UNA FOTO CASI SIEMPRE ES UN COMPROBANTE
                 ------------------------------------------------------------
                 Desde que el cobro pasó a transferencia (3-sep-2026), la
                 foto que manda un cliente es, casi siempre, **el
                 comprobante de su depósito**. O sea: es el pago.

                 Antes esto contestaba «Lo recibí 👍 ¿a dónde van, qué día
                 y cuántos son?» — o sea, le preguntaba desde cero a alguien
                 que acababa de pagarle. Y la foto no llegaba a nadie.

                 Lo que el bot NO puede hacer es dar por bueno el pago. Un
                 comprobante se ve, se cotejan los últimos dígitos y se
                 revisa el banco: eso lo hace una persona. Aquí se acusa
                 recibo y se dice la verdad — «lo reviso» — sin confirmar
                 nada que no se haya visto.
                 ------------------------------------------------------------ */
              texto: audioLargo
                ? 'Va, ahorita lo escucho con calma 🙏\n\nMientras, ¿me dices ' +
                  'a dónde van y cuántos son? Así te voy armando el precio.'
                : m.type === 'audio'
                  ? 'Ahorita no puedo escucharlo bien 🙏 ¿Me lo pones en un ' +
                    'mensaje? Con el destino, la fecha y cuántos van te armo el precio.'
                  : (m.type === 'image' || m.type === 'document')
                    ? acuseDeFoto(tickets.fichaDe(m.from))
                    : 'Lo recibí 👍 Cuéntame por aquí: ¿a dónde van, qué día y ' +
                      'cuántos son?',
              pasa: true
            }
          /* ------------------------------------------------------------
             SI YA ESTÁ DANDO LOS DATOS DEL CONTRATO, EL GUION NO OPINA
             ------------------------------------------------------------
             Dictado del dueño el 3-sep-2026:

               «cuando el cliente manda datos siempre entra la IA, ya que
                muchas veces mandan toda la info en párrafo y no hay
                guion que lo lea»

             Y es cierto. Lo que llega aquí es un solo mensaje con el
             nombre, dos direcciones y dos horas, en desorden. No hay
             expresión regular que sobreviva a eso.

             Es LA ÚNICA parte del bot donde la IA entra sin que el guion
             se haya rendido primero. En todo lo demás es el último
             recurso; aquí es la herramienta correcta, y el costo está
             acotado solo: a esta etapa solo llega quien ya depositó, y
             dura tres o cuatro mensajes.

             Aquí no se resuelve —hay que llamar a Anthropic y `procesa`
             es síncrona—: se marca y lo hace `whatsapp.mjs`. Mientras,
             se deja lista la respuesta del guion por si la IA falla, que
             es lo que sostiene la conversación cuando no hay red.
             ------------------------------------------------------------ */
          : (function () {
              const f = tickets.fichaDe(m.from);
              const juntandoDatos = f && (f.etapa === 'mando_comprobante' ||
                f.etapa === 'datos_del_contrato');
              if (!juntandoDatos) {
                /* CON el estado de esta persona, y con la fecha de hoy.
                   Sin las dos cosas el bot no puede sostener una
                   conversación ni entender «el 12».

                   Y con su nombre, que Meta manda en cada aviso. Se le
                   pega al estado en vez de pasarlo como otro parámetro:
                   así viaja solo por toda la conversación y `bot.js`
                   —que también corre en la página, donde no hay
                   nombre— no tiene que saber de dónde salió. */
                const suNombre = nombreDe(m.from);
                /* Si NO hay nombre se pasa lo de siempre —incluido el
                   `null` de una conversación nueva—. Mandar un `{}` en
                   su lugar sería un estado vacío pero VERDADERO, y hay
                   código que distingue las dos cosas. Un cambio así se
                   ve inofensivo y no lo es. */
                const suEstado = suNombre
                  ? Object.assign(charlaDe(m.from) || {}, { nombre: suNombre })
                  : charlaDe(m.from);
                /* ------------------------------------------------------------
                   EL AGENTE (dictado del dueño, 5-sep-2026): «no quiero
                   hablar con un bot, quiero una IA agente vendedor». Aquí
                   el guion contesta igual —es el RESPALDO y quien lleva
                   el estado— pero se guarda el estado de ANTES y se marca
                   el envío: `whatsapp.mjs` le da la palabra al agente y,
                   si el agente contesta, lo que el guion haya decidido de
                   este mensaje se descarta (un «bien y tú?» no es un
                   destino). Sin red aquí, así que la decisión es allá.
                   La única casilla que se queda con el guion es escoger
                   autobús: ahí el guion tiene los botones y los nombres.
                   ------------------------------------------------------------ */
                const estadoAntes = suEstado ? Object.assign({}, suEstado) : null;
                /* Escoger autobús también es del agente (6-sep-2026): el
                   guion preguntaba «¿cuál te late?» y repetía la lista; el
                   agente RECOMIENDA uno con una razón, como manda la casa. */
                const conAgente = agenteIA(env) && !!texto;
                const respuesta = conversacion.respuestaA(texto, suEstado,
                  env.VERCEL_ENV === 'production' ? undefined : env.HOY_DE_PRUEBA);
                if (conAgente && respuesta && typeof respuesta === 'object') {
                  respuesta.agente = true;
                  respuesta.estadoAntes = estadoAntes;
                }
                return respuesta;
              }
              return {
                /* Si la IA no contesta, esto es lo que se manda: se le
                   vuelve a pedir lo que falte, con lo que ya se tenía.
                   Nunca un silencio. */
                texto: contrato.pideLoQueFalta(f.contrato, null),
                pasa: false,
                datosDelContrato: true,
                contratoQueVa: f.contrato || null,
                esAgencia: !!f.agencia
              };
            })();

        /* Lo que el bot recuerde queda guardado para el siguiente
           mensaje de esta misma persona. Si la respuesta no trae
           estado, la conversación terminó y se borra. */
        if (texto !== null) {
          guardaCharla(m.from,
            Object.prototype.hasOwnProperty.call(r, 'estado') ? r.estado : charlaDe(m.from));
        }

        /* ------------------------------------------------------------
           EN QUÉ VA ESTE CLIENTE
           ------------------------------------------------------------
           La etapa se saca de lo que el bot YA decidió —`_etapas.js`
           lee la respuesta, no vuelve a interpretar el texto del
           cliente—. Dos lecturas del mismo mensaje es una que un día
           no coincide con la otra.

           Se anota SIEMPRE, también en las fotos y los audios: el que
           manda su comprobante es justo el que no se puede perder.

           El viaje y el total se guardan cuando el bot los tiene, para
           que después la ficha pueda decir de qué era ese depósito sin
           que nadie tenga que ir a buscarlo.
           ------------------------------------------------------------ */
        const s = r.solicitud || r.resumen || null;
        tickets.anotaEtapa(m.from, etapas.deLaRespuesta(r, m), {
          /* Para el seguimiento: escribió AHORA. Si es después del
             precio, ya no se le manda ningún toque. */
          clienteEn: ahora,
          agencia: !!((s && s.agencia) ||
            (r.estado && r.estado.agencia) ||
            (charlaDe(m.from) || {}).agencia),
          viaje: s && s.destino
            ? '📍 ' + (s.origen ? s.origen + ' → ' : '') + s.destino +
              (s.salida ? '\n📅 ' + tickets.comoSeDice(s.salida) +
                (s.regreso ? ' al ' + tickets.comoSeDice(s.regreso) : '') : '')
            : null
        }, ahora);

        /* ------------------------------------------------------------
           LOS DATOS DE LA CUENTA, SI EL BOT LOS PIDIÓ
           ------------------------------------------------------------
           `bot.js` iza la bandera y no trae el dato: corre también en
           el navegador, donde cualquiera lee el código. El dato vive
           aquí, en una variable de entorno, y solo se pega del lado
           del servidor.

           Va en el MISMO mensaje y no en uno aparte: el que acaba de
           decir que sí quiere depositar ya, y partirlo en dos lo hace
           esperar por nada.

           Si `DATOS_BANCARIOS` no está puesta, el mensaje sale sin
           ellos — y como `pasa` va en true, al dueño le llega el aviso
           y se los manda él. El cliente nunca se queda esperando.
           ------------------------------------------------------------ */
        /* ------------------------------------------------------------
           LA FICHA COMO IMAGEN, Y LA CLABE SOLA
           ------------------------------------------------------------
           WhatsApp NO tiene un botón de «copiar» en una conversación
           normal. Su `copy_code` existe solo en PLANTILLAS —de
           autenticación y de cupón—, que hay que darlas de alta y que
           Meta las apruebe, y son para mensajes que uno inicia. En una
           charla abierta solo hay botones de respuesta y listas.

           Pero WhatsApp SÍ copia un mensaje completo si lo dejas
           apretado. Así que la CLABE se manda SOLA, en su propio
           mensaje, sin una palabra más: un toque largo y está en el
           portapapeles, lista para pegar en la app del banco.

           Por eso son dos envíos y no uno:
             1 · la ficha como imagen, con el acuse en el pie
             2 · los 18 dígitos, pelones

           Si se le pegara cualquier texto al segundo, el toque largo
           copiaría ese texto también y el cliente pegaría basura en el
           campo de la CLABE. Ese mensaje se queda pelón a propósito.
           ------------------------------------------------------------ */
        sinMandarAOtroNumero(r);
        const cuenta = String(env.DATOS_BANCARIOS || '').trim();
        const clabe = String(env.CLABE || '').replace(/\D+/g, '');
        const sitio = String(env.SITIO_URL || '').replace(/\/+$/, '');
        const mandaFicha = !!(r.pideDatosBancarios && sitio && clabe);

        const texto2 = (r.pideDatosBancarios && !mandaFicha && cuenta)
          ? r.texto + '\n\nY aquí están los datos para el depósito 👇\n\n' + cuenta
          : r.texto;

        envios.push({
          numeroDeOrigen: deQuien,
          para: m.from,
          texto: texto2,
          pasaAPersona: r.pasa,
          /* ------------------------------------------------------------
             EL PRECIO SE PIDE AFUERA
             ------------------------------------------------------------
             Cuando el bot ya juntó los cuatro datos NO cotiza: devuelve
             `cotiza` —qué hay que preguntarle al motor de cobro— y
             `resumen` —qué se le va a repetir al cliente—.

             Aquí no se puede resolver: `procesa` es SÍNCRONA a propósito
             y medir kilómetros es una llamada a Google. Se pasa hacia
             arriba, igual que se hizo con los audios, y lo resuelve
             `whatsapp.mjs`, que sí tiene red.

             ESTO FALTABA POR COMPLETO. En la página el navegador veía
             `cotiza` y pedía el precio; en WhatsApp nadie lo miraba, así
             que el bot decía «Va, déjame sacar el precio…» y el cliente
             no volvía a saber nada. Una conversación entera de venta se
             terminaba justo en el mensaje que importa.
             ------------------------------------------------------------ */
          cotiza: r.cotiza || null,
          resumen: r.resumen || null,
          /* ------------------------------------------------------------
             Y LO MISMO CON LA IA DE RESPALDO
             ------------------------------------------------------------
             `noEntendio` es la señal de que aquí —y solo aquí— vale la
             pena gastar una llamada a la IA. En la página el navegador
             la miraba y llamaba a `/api/entender`. En WhatsApp NO LA
             MIRABA NADIE: la mitad barata del diseño —«el guion con IA
             de respaldo»— funcionaba en la pantalla de prueba y no en
             WhatsApp, que es donde están los clientes.

             Se pasa hacia arriba y la resuelve `whatsapp.mjs`, con el
             estado de esta persona para que lo que la IA entienda se
             pegue a la conversación que ya iba y no arranque otra.
             ------------------------------------------------------------ */
          /* ------------------------------------------------------------
             SIEMPRE_IA (dictado del dueño, 5-sep-2026): «se use
             básicamente siempre la IA». La IA lee TODOS los mensajes de
             texto del cliente, no solo los que el guion no entendió.
             `guionEntendio` le dice a `whatsapp.mjs` qué hacer con lo
             que la IA lea: si el guion se atoró, contestar con eso; si
             el guion sí entendió, guardar en silencio lo que la IA leyó
             de más y dejar la respuesta del guion. Sin la variable,
             encendido. Se apaga con SIEMPRE_IA=0.
             ------------------------------------------------------------ */
          noEntendio: !!r.noEntendio || (siempreIA(env) && !!texto),
          guionEntendio: !r.noEntendio,
          estadoDelCliente: (r.noEntendio || siempreIA(env)) ? charlaDe(m.from) : null,
          /* El agente: la IA habla; el guion es respaldo. */
          agente: !!r.agente,
          estadoAntes: r.estadoAntes || null,
          /* El texto ENTERO, no el recortado de `escribio`: la IA tiene
             que leer lo mismo que escribió el cliente. */
          crudoDelCliente: (r.noEntendio || r.datosDelContrato || siempreIA(env) || r.agente) ? texto : null,
          /* Y la otra puerta a la IA: los datos del contrato, donde entra
             SIEMPRE. Va con lo que ya se tenía, para que lo nuevo se
             junte con lo viejo en vez de reemplazarlo. */
          datosDelContrato: !!r.datosDelContrato,
          contratoQueVa: r.contratoQueVa || null,
          esAgencia: !!r.esAgencia,
          /* Se guarda lo que escribió para poder revisarlo después. Va
             recortado: un mensaje larguísimo no tiene por qué caber
             entero en un registro. */
          escribio: texto === null ? '[' + (m.type || 'no-texto') + ']' : String(texto).slice(0, 500)
        });

        /* La ficha y la CLABE, en ese orden y separadas. Ver la nota
           de arriba: el mensaje de la CLABE va pelón porque el toque
           largo de WhatsApp copia el mensaje ENTERO. */
        if (mandaFicha) {
          envios.push({
            numeroDeOrigen: deQuien,
            para: m.from,
            ligaDeFoto: sitio + '/img/ficha-bancaria.png',
            texto: 'Aquí están los datos 👆\n\nTe mando la CLABE sola abajo: ' +
              'déjala apretada para copiarla.',
            pasaAPersona: false,
            escribio: '[ficha bancaria]'
          });
          envios.push({
            numeroDeOrigen: deQuien,
            para: m.from,
            /* PELÓN. Ni un emoji, ni un punto. */
            texto: clabe,
            pasaAPersona: false,
            escribio: '[clabe para copiar]'
          });
        }

        /* ------------------------------------------------------------
           EL TICKET AL DUEÑO
           ------------------------------------------------------------
           Se manda cuando el bot ya no puede solo —`pasa`—: un
           autobús, un viaje arriba de los 1,400 km, un audio largo o
           algo que no entendió.

           Va con el viaje armado para que el dueño solo escriba el
           precio. NO lleva precio: ese es el punto.

           Si no hay número de dueño configurado, no se manda nada y
           el bot sigue como siempre. Es una mejora, no un requisito.
           ------------------------------------------------------------ */
        /* ------------------------------------------------------------
           LA FOTO SE LE REENVIA AL DUEÑO
           ------------------------------------------------------------
           Con transferencia, el comprobante ES el pago. Si esa foto se
           queda en el webhook, el dinero entra y nadie se entera —
           exactamente lo que el webhook de Stripe existía para evitar.

           Se manda el `id` del medio, no la imagen: Meta deja reenviar
           un medio suyo por su id dentro de la misma cuenta, y así no
           hay que bajarlo ni volverlo a subir.
           ------------------------------------------------------------ */
        if ((m.type === 'image' || m.type === 'document') &&
            tickets.numeroDelDueno(env)) {
          const medio = (m.image || m.document || {});
          /* ------------------------------------------------------------
             LA FOTO NO VA SOLA: VA CON EL VIAJE
             ------------------------------------------------------------
             «Cuando te mando la transferencia, ¿qué vas a hacer? No sabes
             todavía, entonces te vamos a buscar» — el dueño, 3-sep-2026.
             Tenía razón: llegaba una foto y un número, y había que ir a
             buscar de qué viaje era y cuánto tenía que traer.

             La ficha del cliente ya lo sabe. Se le pega aquí: el viaje en
             una línea y el anticipo que se esperaba, para poder cotejar
             el comprobante sin abrir nada.
             ------------------------------------------------------------ */
          const f = tickets.fichaDe(m.from);
          const conQue = f && f.viaje
            ? '\n' + f.viaje +
              (typeof f.anticipo === 'number'
                ? '\nEsperabas *$' + f.anticipo.toLocaleString('es-MX') + '* de anticipo'
                : '') + '\n'
            : '';
          envios.push({
            numeroDeOrigen: deQuien,
            para: tickets.numeroDelDueno(env),
            texto: '💸 *Te mandaron un comprobante*\n' + conQue +
              '\n_cliente: ' + m.from + '_',
            reenviaMedio: medio.id || null,
            tipoMedio: m.type,
            esTicket: true,
            sobreCliente: m.from,
            pasaAPersona: false,
            escribio: '[reenvio de ' + m.type + ']'
          });
        }

        /* ------------------------------------------------------------
           EL TICKET SOLO SI HAY VIAJE QUE COTIZAR
           ------------------------------------------------------------
           Antes se mandaba con cualquier `pasa`, incluso cuando no
           habia nada que cotizar: llegaba un ticket con «? → ?» y
           «? dias». Eso es ruido, y el ruido entrena al dueño a
           ignorar los tickets — que es peor que no mandarlos.
           ------------------------------------------------------------ */
        const hayViaje = !!(r.solicitud && (r.solicitud.destino || r.solicitud.gente));
        if (r.pasa && hayViaje && tickets.numeroDelDueno(env)) {
          const s = r.solicitud || {};
          envios.push({
            numeroDeOrigen: deQuien,
            para: tickets.numeroDelDueno(env),
            esTicket: true,
            /* Para poder amarrar la respuesta del dueño con el cliente
               en cuanto Meta nos diga el id del mensaje. */
            sobreCliente: m.from,
            texto: tickets.armaTicket({
              cliente: m.from,
              origen: s.origen, destino: s.destino,
              salida: s.salida, regreso: s.regreso,
              dias: s.dias, unidad: s.unidad, gente: s.gente,
              movimientos: s.recorridos, paseo: s.paseo,
              agencia: s.agencia
            }),
            /* Este ticket también pasa por la compuerta (C6): con su
               viaje a cuestas, el número que conteste el dueño le llega
               al cliente como cotización completa —con anticipo y
               viaje—, no como «52,000» pelón, y se aprende. */
            carga: {
              cotiza: null,
              resumen: {
                origen: s.origen, destino: s.destino, salida: s.salida, regreso: s.regreso,
                gente: s.gente, unidad: s.unidad, recorridos: s.recorridos, paseo: s.paseo, agencia: !!s.agencia
              },
              total: null, anticipo: null, calendario: null, desde: ahora
            },
            pasaAPersona: false,
            escribio: '[ticket]'
          });
          /* Queda anotado como pendiente de precio, para el recordatorio
             de las 15 horas. */
          tickets.anotaPendiente(m.from, tickets.armaTicket({
            cliente: m.from, origen: s.origen, destino: s.destino,
            salida: s.salida, regreso: s.regreso, dias: s.dias,
            unidad: s.unidad, gente: s.gente, movimientos: s.recorridos
          }), ahora);
        /* La foto y el documento NO llevan aviso: ya se reenvían enteros
           unas líneas más arriba, y el dueño no necesita que le digan
           «te están escribiendo» encima de la cosa que le acaba de
           llegar. Dos mensajes por un comprobante es ruido. */
        } else if (r.pasa && tickets.numeroDelDueno(env) &&
            m.type !== 'image' && m.type !== 'document' &&
            !yaSeAviso(m.from, ahora)) {
          /* ------------------------------------------------------------
             SIN VIAJE TAMBIÉN SE AVISA — PERO NO CON UN TICKET VACÍO
             ------------------------------------------------------------
             Aquí cae el que escribe «quiero hablar con alguien» antes de
             decir a dónde va. Es la señal de compra más clara que hay, y
             al quitar el ticket hueco se había quedado sin avisar a
             nadie: el cliente pedía una persona y del otro lado, nada.

             Así que se avisa, pero con dos renglones en vez del formato
             de viaje con seis huecos en «?». Lo que el dueño necesita
             saber es quién y qué escribió; lo demás no existe todavía.

             No se anota como pendiente de precio: no hay precio que
             deber. Ese recordatorio es para el viaje que ya está armado.
             ------------------------------------------------------------ */
          envios.push({
            numeroDeOrigen: deQuien,
            para: tickets.numeroDelDueno(env),
            esTicket: true,
            sobreCliente: m.from,
            texto: '💬 *Te están escribiendo*\n\n' +
              '_' + (texto === null ? '[' + (m.type || 'no-texto') + ']'
                : String(texto).slice(0, 300)) + '_\n\n' +
              'Contéstame *este mensaje* y yo se lo paso.\n' +
              '_cliente: ' + m.from + '_',
            pasaAPersona: false,
            escribio: '[aviso]'
          });
        }
      }
    }
  }

  return { status: 200, cuerpo: { ok: true }, envios: envios };
}

/* ------------------------------------------------------------
   LOS AUDIOS QUE TRAE UN AVISO
   ------------------------------------------------------------
   Para que `whatsapp.mjs` sepa qué transcribir ANTES de llamar a
   `procesa`, sin tener que volver a entender la forma del aviso
   de Meta. Si mañana Meta cambia esa forma, se cambia aquí y en
   un solo lugar.

   Recibe el aviso YA parseado. La firma se sigue verificando
   sobre el cuerpo crudo, en `procesa`, como siempre.
   ------------------------------------------------------------ */
function idsDeAudio(aviso) {
  const ids = [];
  const entradas = (aviso && aviso.entry) || [];
  for (let i = 0; i < entradas.length; i++) {
    const cambios = entradas[i].changes || [];
    for (let j = 0; j < cambios.length; j++) {
      const mensajes = ((cambios[j] && cambios[j].value) || {}).messages || [];
      for (let k = 0; k < mensajes.length; k++) {
        const m = mensajes[k] || {};
        if (m.type === 'audio' && m.audio && m.audio.id) ids.push(m.audio.id);
      }
    }
  }
  /* Sin repetidos: el mismo audio reenviado dos veces se transcribe
     una, y se paga una. */
  return ids.filter(function (id, i) { return ids.indexOf(id) === i; });
}

/* ------------------------------------------------------------
   DE QUIÉNES VIENE ESTE AVISO
   ------------------------------------------------------------
   Para poder cargar SUS fichas y SUS charlas de la base antes de
   procesarlo — y solo las suyas, no las 500. Un aviso trae uno o
   dos mensajes; leer la cartera entera en cada uno sería pagar
   una base de datos para hacerle daño.

   Vive aquí, con `idsDeAudio`, porque la forma del aviso de Meta
   se conoce en este archivo y no en la cáscara.
   ------------------------------------------------------------ */
function numerosDelAviso(aviso) {
  const nums = [];
  const entradas = (aviso && aviso.entry) || [];
  for (let i = 0; i < entradas.length; i++) {
    const cambios = entradas[i].changes || [];
    for (let j = 0; j < cambios.length; j++) {
      const mensajes = ((cambios[j] && cambios[j].value) || {}).messages || [];
      for (let k = 0; k < mensajes.length; k++) {
        if (mensajes[k] && mensajes[k].from) nums.push(mensajes[k].from);
      }
    }
  }
  return nums.filter(function (n, i) { return nums.indexOf(n) === i; });
}

module.exports = {
  verificaSuscripcion,
  procesa,
  revisaLaPuerta,
  relojDe,
  sinMandarAOtroNumero,
  OTRO_NUMERO,
  conoceAlCliente,
  idsDeAudio,
  firmaValida,
  rutaSecretaValida,
  avisoEsNuestro,
  igualesEnTiempoConstante,
  olvidaTodo,
  /* Para que `whatsapp.mjs` pueda dejar guardado lo que la IA entendió.
     Sin esto, la IA rescataba el mensaje y la conversación seguía con
     el estado viejo: el siguiente mensaje volvía a no entenderse. */
  guardaCharla,
  charlaDe,
  siembraCharla,
  /* Para que la cáscara pueda rearmar el tablero con lo que traiga de
     la base, con el mismo formato. */
  armaTablero,
  /* Igual que el tablero: aquí se decide cómo se ve, allá se lee la
     base. Se exporta también para poder probar el formato sin red. */
  armaConversacion,
  /* Para que `apunta` no guarde los comandos del dueño dentro de la
     conversación del cliente. Una sola definición, dos lectores. */
  esComandoDelDueno,
  /* Los números que vienen en un aviso, para poder cargar SUS fichas
     antes de procesarlo. Se saca aquí y no en la cáscara porque la
     forma del aviso de Meta se conoce en este archivo, no allá. */
  numerosDelAviso,
  TOPE_POR_MINUTO
};
