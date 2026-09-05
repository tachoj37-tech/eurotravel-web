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

   Seis horas de vida: más que eso y el cliente ya no se acuerda
   ni él de lo que estaba pidiendo.
   ------------------------------------------------------------ */
const VIDA_CHARLA_MS = 6 * 60 * 60 * 1000;
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
    lineas.push('· ' + f.cliente + viaje + dinero);
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

function esComandoDelDueno(mensaje) {
  const t = String((mensaje && mensaje.text && mensaje.text.body) || '');
  return PIDE_TABLERO.test(t) || PIDE_VER.test(t);
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
function procesa(crudo, firma, entorno) {
  const env = entorno || process.env;

  if (!env.WHATSAPP_APP_SECRET) {
    return { status: 503, cuerpo: { error: 'sin secreto' }, envios: [] };
  }
  if (!firmaValida(crudo, firma, env.WHATSAPP_APP_SECRET)) {
    return { status: 401, cuerpo: { error: 'firma invalida' }, envios: [] };
  }

  let aviso;
  try {
    aviso = JSON.parse(Buffer.isBuffer(crudo) ? crudo.toString('utf8') : String(crudo));
  } catch (e) {
    /* Firma buena pero cuerpo ilegible: es cosa nuestra, no de un
       atacante. Se acepta para que Meta no reintente en balde. */
    return { status: 200, cuerpo: { ok: true, aviso: 'cuerpo ilegible' }, envios: [] };
  }

  const envios = [];
  const entradas = (aviso && aviso.entry) || [];
  const ahora = Number(env.AHORA_DE_PRUEBA) || Date.now();

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
        if (yaContestado(m.id)) continue;
        if (!pasaElFreno(m.from || 'desconocido')) continue;

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
                return conversacion.respuestaA(texto, suEstado, env.HOY_DE_PRUEBA);
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
          noEntendio: !!r.noEntendio,
          estadoDelCliente: r.noEntendio ? charlaDe(m.from) : null,
          /* El texto ENTERO, no el recortado de `escribio`: la IA tiene
             que leer lo mismo que escribió el cliente. */
          crudoDelCliente: (r.noEntendio || r.datosDelContrato) ? texto : null,
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
  idsDeAudio,
  firmaValida,
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
