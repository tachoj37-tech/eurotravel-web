/* ============================================================
   Bot de WhatsApp — la cáscara
   ------------------------------------------------------------
   Aquí NO hay reglas: viven en `_whatsapp-webhook.js` (la firma y
   el reparto) y en `_whatsapp-logica.js` (qué se contesta). Esto
   resuelve dos caprichos del entorno: conseguir el cuerpo CRUDO y
   hablarle a Meta.

   ES .mjs A PROPÓSITO, Y CON UN SOLO PARÁMETRO

   La firma de Meta se calcula sobre los bytes exactos del cuerpo.
   Si el entorno lo parsea y lo vuelve a serializar, la firma no
   cuadra nunca. Con `webhook-stripe.mjs` eso costó TRES intentos,
   y están escritos ahí para no repetirlos: ni `module.exports.
   config`, ni `export const config` funcionan en las funciones
   sueltas de Vercel.

   Lo que sí: cuando el handler declara UN parámetro, Vercel lo
   trata como firma Web y el cuerpo llega crudo con `.text()`.
   El segundo argumento, cuando lo hay, se recoge de `arguments`.

   No se volvió a averiguar: se copió lo que ya se pagó.
   ============================================================ */

/* Ojo: mientras este archivo viva en `pendiente/`, la ruta sube un nivel.
   Al moverlo a `api/` hay que dejarla en './_whatsapp-webhook.js'. */
import webhook from './_whatsapp-webhook.js';
import transcriptor from './_transcribe.js';
import tickets from './_tickets.js';
import nucleo from './_cotiza-nucleo.js';
import entendedor from './_entender.js';
import contrato from './_datos-contrato.js';
import almacen from './_almacen.js';
import etapas from './_etapas.js';
import conversacion from '../bot.js';

/* ------------------------------------------------------------
   LAS NOTAS DE VOZ SE TRANSCRIBEN AQUI, NO ALLA
   ------------------------------------------------------------
   `webhook.procesa` es SINCRONA a proposito y transcribir no lo
   es. En vez de volverla asincrona —y arrastrar sus pruebas y el
   orden en que contesta— el audio se transcribe ANTES y se le
   entrega hecho.

   Asi tambien queda mas limpio: el archivo de las reglas no sabe
   nada de Groq ni de Meta, y se puede probar entero con audios
   de mentiras.

   Si no hay claves, o falla, o el audio pasa del minuto, el mapa
   viene vacio en esa entrada y el webhook contesta como siempre.
   Nunca truena por esto.
   ------------------------------------------------------------ */
async function transcribeLosAudios(crudo) {
  let aviso;
  try { aviso = JSON.parse(crudo.toString('utf8')); } catch (e) { return {}; }

  const ids = webhook.idsDeAudio(aviso);
  if (!ids.length) return {};

  /* Todas a la vez: la funcion tiene ~10 segundos y en serie se
     acabarian con dos audios. */
  const salidas = await Promise.all(ids.map(function (id) {
    return transcriptor.transcribe(id).catch(function () { return null; });
  }));

  const mapa = {};
  ids.forEach(function (id, i) { if (salidas[i]) mapa[id] = salidas[i]; });
  return mapa;
}

/* ------------------------------------------------------------
   EL PRECIO, QUE SE PIDE AQUI Y NO ALLA
   ------------------------------------------------------------
   `webhook.procesa` es sincrona y cotizar puede costar dos
   llamadas a Google. Igual que con los audios: alla se decide
   QUE hay que cotizar, aqui se cotiza y se manda.

   Sale como un SEGUNDO mensaje, despues del «va, dejame sacar el
   precio…». Asi se ve como escribe una persona —primero avisa,
   luego contesta— y si el motor falla, el cliente ya recibio algo
   en vez de un silencio.

   `textoDeCotizacion` es la MISMA funcion que usa la pagina: el
   numero no se toca aqui, ni se redondea, ni se arma un mensaje
   distinto. Un precio por WhatsApp y otro en pantalla seria peor
   que no tener WhatsApp.

   Si truena, se contesta con `null`, que es como esa funcion dice
   «no salio»: le da el telefono y pasa a una persona. Nunca se
   queda callado, porque el silencio despues de «ahorita te paso
   el precio» es una venta perdida sin rastro.
   ------------------------------------------------------------ */
/* ------------------------------------------------------------
   EL CALENDARIO DE EUROSYSTEM — 5-sep-2026
   ------------------------------------------------------------
   Antes de prometer una fecha en temporada alta o con 30 dias o
   menos, se le pregunta a EuroSystem cuantas unidades de ese tipo
   quedan libres entre esas fechas (`GET /api/disponibilidad`, misma
   llave servidor-a-servidor que el alta de contratos).

   Falla CERRADA: si el endpoint no contesta, contesta raro o dice
   cero, el bot NO promete. Dice que revisa y se le avisa a una
   persona. Es mejor un «dejame revisar» de mas que una unidad
   prometida que ya esta comprometida — el dueño lo dicto asi.

   Los numeros que devuelve EuroSystem se quedan aqui. Al cliente
   jamas se le dice «quedan 2»: eso es escasez que el dueño no
   autorizo a nombrar, y ademas cambia por minuto.
   ------------------------------------------------------------ */
const EUROSYSTEM = process.env.EUROSYSTEM_URL || 'https://eurosystem-smoky.vercel.app';
const ESPERA_CALENDARIO_MS = 4000;

async function disponibilidadDe(tipo, salida, regreso) {
  const llave = (process.env.CONTRATOS_API_KEY || '').trim();
  if (!llave || !tipo || !salida) return null;
  const t = String(tipo).toUpperCase();
  const u = EUROSYSTEM.replace(/\/+$/, '') + '/api/disponibilidad?tipo=' +
    encodeURIComponent(t) + '&salida=' + encodeURIComponent(salida) +
    '&regreso=' + encodeURIComponent(regreso || salida);
  const corta = new AbortController();
  const reloj = setTimeout(function () { corta.abort(); }, ESPERA_CALENDARIO_MS);
  try {
    const r = await fetch(u, { headers: { 'x-api-key': llave }, signal: corta.signal });
    if (!r || !r.ok) {
      console.error('[calendario] EuroSystem contesto ' + (r && r.status));
      return null;
    }
    const c = await r.json();
    const d = c && (c.datos || c.data || c);
    if (!d || typeof d.libres !== 'number') return null;
    return { libres: d.libres, total: d.total };
  } catch (e) {
    console.error('[calendario] no se pudo: ' + e.message);
    return null;
  } finally {
    clearTimeout(reloj);
  }
}

/* Lo que se le dice al cliente cuando no se puede confirmar la fecha.
   Es TEXTO y por eso vive en un solo lugar: el dueño lo aprueba o lo
   cambia con su «va». Sin escasez inventada, sin cifras. */
const TEXTO_REVISO_DISPONIBILIDAD =
  'Déjame revisar disponibilidad para esa fecha y te confirmo en un momento.';

async function precioDe(envio) {
  /* ---- primero el calendario, si toca ---- */
  const res = envio.resumen || {};
  const hoy = process.env.HOY_DE_PRUEBA || new Date().toISOString().slice(0, 10);
  if (conversacion.hayQueRevisarDisponibilidad(res.salida, hoy)) {
    const cal = await disponibilidadDe(
      (envio.cotiza && envio.cotiza.unidad) || res.unidad || 'sprinter',
      res.salida, res.regreso);
    if (!cal || cal.libres <= 0) {
      console.error('[calendario] sin confirmar para ' + res.salida +
        (cal ? ' (libres=' + cal.libres + ')' : ' (sin respuesta)'));
      tickets.anotaEtapa(envio.para, 'pidio_precio', {});
      const mios = [{
        numeroDeOrigen: envio.numeroDeOrigen,
        para: envio.para,
        texto: TEXTO_REVISO_DISPONIBILIDAD,
        pasaAPersona: true,
        escribio: '[calendario sin confirmar]'
      }];
      const dueno = tickets.numeroDelDueno(process.env);
      if (dueno) {
        mios.push({
          numeroDeOrigen: envio.numeroDeOrigen,
          para: dueno,
          esTicket: true,
          sobreCliente: envio.para,
          texto: '📅 *Revisar disponibilidad*\n\n' +
            (res.destino ? '📍 ' + res.destino + '\n' : '') +
            '📅 ' + tickets.comoSeDice(res.salida) +
            (res.regreso ? ' al ' + tickets.comoSeDice(res.regreso) : '') + '\n' +
            (cal ? 'EuroSystem dice: ' + cal.libres + ' de ' + cal.total + ' libres'
              : 'EuroSystem no contestó') + '\n\n' +
            'Contéstame *este mensaje* y yo se lo paso.\n_cliente: ' + envio.para + '_',
          pasaAPersona: false,
          escribio: '[ticket calendario]'
        });
      }
      return mios;
    }
  }

  let precio = null;
  try {
    const r = await nucleo.cotiza(envio.cotiza, process.env.GOOGLE_ROUTES_KEY);
    if (r.ok) precio = r.precio;
    else console.error('[whatsapp] no se pudo cotizar: ' + r.error);
  } catch (e) {
    console.error('[whatsapp] cotizador tronado: ' + e.message);
  }

  const salida = conversacion.textoDeCotizacion(precio, envio.resumen);

  /* El total y el anticipo se saben AQUI y en ningun otro lado: el
     webhook es sincrono y no cotiza. Se apuntan en la ficha para que,
     cuando llegue el comprobante, el aviso pueda decir de que viaje
     era y cuanto tenia que traer — sin que nadie vaya a buscarlo. */
  if (precio && typeof precio.total === 'number') {
    const r = envio.resumen || {};
    tickets.anotaEtapa(envio.para, 'con_precio', {
      total: precio.total,
      anticipo: precio.anticipo,
      viaje: r.destino
        ? '📍 ' + (r.origen ? r.origen + ' → ' : '') + r.destino +
          (r.salida ? '\n📅 ' + tickets.comoSeDice(r.salida) +
            (r.regreso ? ' al ' + tickets.comoSeDice(r.regreso) : '') : '')
        : null
    });
  }

  const mios = [{
    numeroDeOrigen: envio.numeroDeOrigen,
    para: envio.para,
    texto: salida.texto,
    pasaAPersona: !!salida.pasa,
    escribio: '[precio]'
  }];

  /* ------------------------------------------------------------
     Y SU FOTO · «esta es la que les tocaria»
     ------------------------------------------------------------
     Efecto dotacion: lo que el cliente siente suyo cuesta mas
     trabajo soltarlo. El bot tenia 58 fotos y solo las enseñaba si
     se las pedian.

     Va DESPUES del precio, nunca antes: fotos a quien todavia no
     sabe cuanto cuesta es un catalogo, no una venta.

     UNA sola. Tres fotos seguidas en WhatsApp es spam, y la primera
     es la del exterior — la que se reenvia al grupo.

     Se manda por URL publica, que Meta acepta y ahorra subir el
     archivo. Si no hay `SITIO_URL` no se manda nada: una liga rota
     en el mensaje del precio es peor que no mandar foto.
     ------------------------------------------------------------ */
  const sitio = String(process.env.SITIO_URL || '').replace(/\/+$/, '');
  const foto = salida.medios && salida.medios.fotos && salida.medios.fotos[0];
  if (sitio && foto && precio && typeof precio.total === 'number') {
    mios.push({
      numeroDeOrigen: envio.numeroDeOrigen,
      para: envio.para,
      ligaDeFoto: sitio + '/' + foto,
      texto: 'Ésta es la que les tocaría 👆',
      pasaAPersona: false,
      escribio: '[foto de la unidad]'
    });
  }

  /* ------------------------------------------------------------
     Y SI EL PRECIO NO SALIO, AL DUENO LE LLEGA EL VIAJE
     ------------------------------------------------------------
     `pasa` aqui significa una de dos: el motor no contesto, o R45
     —«si no sabes un precio al 100 % no se lo compartas»—. En los
     dos casos al cliente ya se le prometio el precio *hoy mismo*.

     Sin este ticket esa promesa no la ve nadie: el cliente espera
     y del otro lado no hay ni aviso. Va con el viaje armado, para
     que quien conteste solo escriba el numero.
     ------------------------------------------------------------ */
  const r = envio.resumen || {};
  const dueno = tickets.numeroDelDueno(process.env);
  if (salida.pasa && dueno && r.destino) {
    mios.push({
      numeroDeOrigen: envio.numeroDeOrigen,
      para: dueno,
      texto: tickets.armaTicket({
        origen: r.origen, destino: r.destino, salida: r.salida, regreso: r.regreso,
        dias: r.dias, unidad: 'sprinter', gente: r.gente,
        movimientos: r.recorridos, paseo: r.paseo, agencia: r.agencia,
        cliente: envio.para
      }),
      esTicket: true,
      sobreCliente: envio.para,
      pasaAPersona: false,
      escribio: '[precio que no salio]'
    });
  }

  return mios;
}

/* ------------------------------------------------------------
   LA IA DE RESPALDO, QUE EN WHATSAPP NO ESTABA ENCHUFADA
   ------------------------------------------------------------
   El diseño es «guion con IA de respaldo»: el guion contesta
   gratis lo que sabe, y cuando no sabe —`noEntendio`— se gasta
   UNA llamada a la IA para traducir lo que quiso decir.

   La pagina lo hacia. WhatsApp no miraba esa bandera, asi que
   ahi la IA no existia: «a chapala», a secas, terminaba en
   «dejame checarte eso bien tantito». Es el mensaje con el que
   arranca media la gente.

   TRES FRENOS, porque esto es lo unico que cuesta dinero:

     1 · Solo cuando el guion se rindio. Nunca antes.
     2 · Un tope por dia en toda la cuenta. Si se pasa, el bot
         sigue contestando con el guion, sin gastar.
     3 · Lo que la IA devuelve pasa por `aplicaEntendido`, que
         es codigo nuestro. La IA no escribe precios ni fechas:
         entrega datos y el guion arma la frase. R12 y R45.

   Si no hay clave, si falla, o si la IA no entendio tampoco, se
   deja la respuesta del guion. Nunca truena por esto.
   ------------------------------------------------------------ */
const TOPE_IA_POR_DIA = 300;
let gastadasHoy = 0;
let diaDelConteo = '';

function hayCupoDeIA(hoy) {
  if (diaDelConteo !== hoy) { diaDelConteo = hoy; gastadasHoy = 0; }
  if (gastadasHoy >= TOPE_IA_POR_DIA) return false;
  gastadasHoy++;
  return true;
}

async function loQueLaIAEntendio(envio) {
  const hoy = process.env.HOY_DE_PRUEBA ||
    new Date().toISOString().slice(0, 10);
  if (!process.env.ANTHROPIC_API_KEY) return null;
  if (!hayCupoDeIA(hoy)) {
    console.error('[whatsapp] tope diario de IA alcanzado, sigue el guion');
    return null;
  }

  let leido;
  try {
    leido = await entendedor.entiende(envio.crudoDelCliente, { hoy: hoy, cliente: envio.para });
  } catch (e) {
    console.error('[whatsapp] la IA no se pudo: ' + e.message);
    return null;
  }
  if (!leido) return null;

  /* La IA entrega datos; las palabras y los numeros los pone el guion.
     R12 y R45.

     DOS CAMINOS, segun si ya habia conversacion (5-sep-2026):

       · A media cotizacion —el paso de fecha, regreso o destino no
         leyo lo que escribio— lo que la IA saco se PEGA al estado que
         iba con `continuaCon`, sin pisar destino, gente ni unidad. Si
         se arrancara de cero con `aplicaEntendido`, leer solo una
         fecha tiraria todo lo demas y el cliente volveria a oir «¿a
         donde van?». Antes de hoy la IA nunca entraba a media platica,
         asi que este caso no existia.
       · Sin conversacion previa, `aplicaEntendido` arma una nueva,
         igual que en la pagina.

     Si `continuaCon` no pudo pegar nada, se intenta el camino de cero:
     a lo mejor la IA leyo una intencion (persona, fotos) y no un dato. */
  const estadoQueIba = envio.estadoDelCliente;
  let mejor = null;
  try {
    if (estadoQueIba && estadoQueIba.paso) {
      mejor = conversacion.continuaCon(estadoQueIba, leido, hoy);
    }
    if (!mejor) mejor = conversacion.aplicaEntendido(leido, hoy);
  } catch (e) {
    console.error('[whatsapp] aplicaEntendido tronó: ' + e.message);
    return null;
  }
  if (!mejor || !mejor.texto) return null;

  /* Lo que la IA destrabó queda guardado. Sin esto la conversación
     seguía con el estado viejo y el siguiente mensaje se volvía a no
     entender — se pagaría la IA otra vez, por lo mismo. */
  if (Object.prototype.hasOwnProperty.call(mejor, 'estado')) {
    webhook.guardaCharla(envio.para, mejor.estado);
  }

  return {
    numeroDeOrigen: envio.numeroDeOrigen,
    para: envio.para,
    texto: mejor.texto,
    pasaAPersona: !!mejor.pasa,
    cotiza: mejor.cotiza || null,
    resumen: mejor.resumen || null,
    escribio: '[la IA lo destrabó]'
  };
}

/* ------------------------------------------------------------
   MANDA UN ENVÍO Y LO QUE SE DESPRENDA DE ÉL
   ------------------------------------------------------------
   Un envío del webhook puede necesitar dos cosas más, y las dos
   necesitan red —por eso no se resuelven allá—:

     · Si el guion no entendió, se intenta con la IA. Si la IA sí
       entendió, se manda ESA respuesta y NO la del guion: mandar
       las dos sería contestarle dos veces, una de ellas mal.
     · Si hay que cotizar, el precio va DESPUÉS del «déjame
       sacarlo», nunca antes.

   Y lo que la IA destrabó puede a su vez pedir precio, así que
   ese camino también pasa por aquí.
   ------------------------------------------------------------ */
/* ------------------------------------------------------------
   LOS DATOS DEL CONTRATO
   ------------------------------------------------------------
   Aqui la IA entra SIEMPRE, no como respaldo. Dictado del dueno
   el 3-sep-2026: la gente manda el nombre, dos direcciones y dos
   horas en un solo parrafo, y no hay guion que lea eso.

   La IA solo EXTRAE. Las preguntas, los acuses y el orden de lo
   que se pide estan escritos en `_datos-contrato.js`; de aqui no
   sale una palabra que no haya revisado alguien. Es R12 aplicada
   a otra cosa: la IA entrega campos, el guion pone las palabras.

   Si falla, se manda lo que el webhook ya habia preparado —volver
   a pedir lo que falta— y el cliente no se queda en silencio.
   ------------------------------------------------------------ */
async function datosDelContrato(envio) {
  const hoy = process.env.HOY_DE_PRUEBA ||
    new Date().toISOString().slice(0, 10);
  if (!process.env.ANTHROPIC_API_KEY) return null;
  if (!hayCupoDeIA(hoy)) {
    console.error('[whatsapp] tope diario de IA alcanzado, sin extraer datos');
    return null;
  }

  let leido;
  try {
    leido = await entendedor.entiende(envio.crudoDelCliente, {
      hoy: hoy,
      cliente: envio.para,
      /* Instrucciones DISTINTAS a las de siempre: aquellas leen viajes
         —destino, fechas, cuantos van— y estas leen datos de contrato.
         Con un solo prompt, un «vamos a Vallarta» se leeria como la
         direccion de destino y una calle con numero como el numero de
         pasajeros. */
      instrucciones: contrato.instrucciones(),
      /* Y sin limpiar con el limpiador de viajes, que tiraria todos
         estos campos por no conocerlos. */
      crudo: true
    });
  } catch (e) {
    console.error('[whatsapp] no se pudieron leer los datos: ' + e.message);
    return null;
  }
  if (!leido) return null;

  const nuevos = contrato.limpia(leido);
  const juntos = contrato.junta(envio.contratoQueVa, nuevos);
  const completo = contrato.estaCompleto(juntos);

  /* Queda guardado ANTES de contestar: si el envio falla, el dato ya
     no se pierde y el cliente no tiene que repetirlo. */
  tickets.anotaEtapa(envio.para,
    completo ? 'contrato_listo' : 'datos_del_contrato',
    { contrato: juntos });

  const salida = [{
    numeroDeOrigen: envio.numeroDeOrigen,
    para: envio.para,
    texto: contrato.pideLoQueFalta(juntos, nuevos),
    pasaAPersona: false,
    escribio: '[datos del contrato]'
  }];

  /* Completo: al dueno le llega la ficha armada, para pasarla al
     contrato sin teclear nada. Va UNA sola vez —cuando se completa—
     y no en cada mensaje. */
  const dueno = tickets.numeroDelDueno(process.env);
  const yaEstaba = (tickets.fichaDe(envio.para) || {}).contratoAvisado;
  if (completo && dueno && !yaEstaba) {
    salida.push({
      numeroDeOrigen: envio.numeroDeOrigen,
      para: dueno,
      texto: contrato.fichaParaElDueno(juntos, envio.para),
      esTicket: true,
      sobreCliente: envio.para,
      pasaAPersona: false,
      escribio: '[ficha del contrato]'
    });
    tickets.anotaEtapa(envio.para, 'contrato_listo', { contratoAvisado: true });
  }

  return salida;
}

/* ------------------------------------------------------------
   EL TABLERO, CON LO QUE HAYA EN LA BASE
   ------------------------------------------------------------
   El webhook lo arma con lo que tiene en memoria, que despues de
   un reciclaje de Vercel es NADA. La base sí lo tiene, pero
   leerla es asincrono y `procesa` no lo es.

   Asi que se rearma aqui. Si la base no contesta, se manda el de
   memoria — un tablero corto es mejor que ninguno.

   El orden lo pone `_etapas.js`, igual que en memoria: el que ya
   mando dinero hasta arriba.
   ------------------------------------------------------------ */
async function tableroDeVerdad(envio) {
  if (!almacen.hayAlmacen()) return null;
  let fichas;
  try {
    fichas = await almacen.fichasDelTablero(60);
  } catch (e) {
    console.error('[whatsapp] no se pudo leer el tablero: ' + e.message);
    return null;
  }
  if (!fichas || !fichas.length) return null;

  fichas.sort(function (a, b) {
    const d = etapas.nivel(b.etapa) - etapas.nivel(a.etapa);
    return d !== 0 ? d : a.visto - b.visto;
  });

  return Object.assign({}, envio, { texto: webhook.armaTablero(fichas) });
}

/* ------------------------------------------------------------
   LA CONVERSACION DE VERDAD
   ------------------------------------------------------------
   El webhook decidio A QUIEN quiere ver el dueno; aqui se traen sus
   mensajes de la base y se pintan. Mismo reparto de trabajo que el
   tablero, por la misma razon: alla no hay red.

   Si la base no contesta se manda el respaldo que trae el envio,
   que dice justamente eso. Callarse seria peor: el dueno pidio ver
   una conversacion, y el silencio se lee como «este cliente nunca
   escribio».
   ------------------------------------------------------------ */
const TOPE_VER = 40;

async function conversacionDeVerdad(envio) {
  if (!almacen.hayAlmacen()) return null;
  let filas;
  try {
    filas = await almacen.mensajesDe(envio.pideConversacion, TOPE_VER);
  } catch (e) {
    console.error('[whatsapp] no se pudo leer la conversacion: ' + e.message);
    return null;
  }
  /* `null` es «la base fallo» y va al respaldo. Un arreglo vacio es
     «no hay nada de este numero», que es una respuesta legitima y la
     pinta `armaConversacion`. */
  if (!filas) return null;

  return Object.assign({}, envio, {
    texto: webhook.armaConversacion(envio.pideConversacion, filas)
  });
}

async function reparte(envio) {
  if (envio.pideTablero) {
    const mejor = await tableroDeVerdad(envio);
    await manda(mejor || envio);
    return;
  }

  if (envio.pideConversacion) {
    const mejor = await conversacionDeVerdad(envio);
    await manda(mejor || envio);
    return;
  }

  /* Los datos del contrato van PRIMERO: quien ya deposito y esta
     dictando su direccion no puede caer en el camino de siempre. */
  if (envio.datosDelContrato && envio.crudoDelCliente) {
    const hecho = await datosDelContrato(envio);
    if (hecho) { for (const e of hecho) await manda(e); return; }
  }

  if (envio.noEntendio && envio.crudoDelCliente) {
    const rescate = await loQueLaIAEntendio(envio);
    if (rescate) {
      await manda(rescate);
      if (rescate.cotiza) for (const p of await precioDe(rescate)) await manda(p);
      return;
    }
  }

  await manda(envio);
  if (envio.cotiza) for (const p of await precioDe(envio)) await manda(p);
}

/* ------------------------------------------------------------
   LO QUE SE RECUERDA DE ESTE CLIENTE, ANTES DE CONTESTARLE
   ------------------------------------------------------------
   `webhook.procesa` es sincrona y leer de la base no lo es. Es el
   mismo patron que los audios y el precio: se lee ANTES, aqui, y
   se le entrega hecho.

   Sin esto, cada vez que Vercel recicla la instancia el cliente
   empieza de cero. Le habias dicho a donde ibas, cuantos son y
   ya habias depositado, y el bot preguntaba «¿a donde va el
   plan?». Eso, con un comprobante de por medio, es perder al
   cliente.

   Se cargan SOLO los numeros de este aviso. Traer la cartera
   entera en cada mensaje seria pagar una base de datos para
   hacerle daño.

   Si no hay base configurada, esto no hace nada y el bot corre
   en memoria como corria antes.
   ------------------------------------------------------------ */
async function cargaLoQueSeSabe(crudo) {
  if (!almacen.hayAlmacen()) return [];

  let aviso;
  try { aviso = JSON.parse(crudo.toString('utf8')); } catch (e) { return []; }

  const numeros = webhook.numerosDelAviso(aviso);
  if (!numeros.length) return [];

  await Promise.all(numeros.map(async function (n) {
    const [ficha, charla] = await Promise.all([
      almacen.leeFicha(n).catch(function () { return null; }),
      almacen.leeCharla(n).catch(function () { return null; })
    ]);
    if (ficha) tickets.siembraFicha(ficha);
    if (charla) webhook.siembraCharla(n, charla);
  }));

  /* ------------------------------------------------------------
     Y SE APUNTA LO QUE ESCRIBIÓ
     ------------------------------------------------------------
     Aquí, y no más abajo, porque aquí ya está el aviso parseado y
     se sabe QUIÉN habló. Un mensaje de entrada se apunta UNA vez
     aunque el bot conteste tres cosas.

     Esto es lo que va a leer la bandeja compartida el día que se
     haga: sin el historial, esa pantalla abriría en blanco. Y es
     lo que el dueño pidió que durara «al menos un mes».

     Del dueño también se apunta: sus respuestas son parte de la
     conversación, y sin ellas la pantalla contaría media historia.
     ------------------------------------------------------------ */
  apunta(aviso).catch(function () {});

  return numeros;
}

/* Qué se escribió, en una línea, para el registro. Un audio o una foto
   no traen texto: se apunta QUÉ fue, que es lo que después explica un
   hueco en la conversación. */
function loQueDijo(m) {
  if (m.type === 'text') return (m.text && m.text.body) || '';
  if (m.type === 'image') return '[foto]';
  if (m.type === 'document') return '[documento]';
  if (m.type === 'audio') return '[nota de voz]';
  return '[' + (m.type || 'otro') + ']';
}

async function apunta(aviso) {
  const dueno = tickets.numeroDelDueno(process.env);
  const entradas = (aviso && aviso.entry) || [];
  const tareas = [];
  for (const e of entradas) {
    for (const c of (e.changes || [])) {
      for (const m of (((c && c.value) || {}).messages || [])) {
        if (!m || !m.from) continue;
        /* Lo del dueño va bajo el número del CLIENTE al que le
           contesta, no bajo el suyo: si se guardara bajo el del dueño,
           su bandeja sería una sola conversación gigante con él mismo
           y ninguna con los clientes. */
        const esDelDueno = dueno && tickets.mismoNumero(m.from, dueno);
        if (esDelDueno) {
          /* Un comando —«tablero», «ver»— no es algo que le haya dicho
             a nadie. Si se guardara, y «ver» se usa RESPONDIENDO el
             ticket, la palabra «ver» acabaria dentro de la platica del
             cliente: se ensucia justo lo que se queria leer. */
          if (webhook.esComandoDelDueno(m)) continue;
          const a = tickets.clienteDeLaRespuesta(m, tickets.tickets);
          if (a && a.cliente) {
            tareas.push(almacen.anotaMensaje(a.cliente, 'dueno', a.texto, 'texto'));
          }
          continue;
        }
        tareas.push(almacen.anotaMensaje(m.from, 'cliente', loQueDijo(m), m.type || 'texto'));
      }
    }
  }
  await Promise.all(tareas.map(function (p) {
    return p.catch(function () { return null; });
  }));
}

/* ------------------------------------------------------------
   Y LO QUE QUEDO DESPUES
   ------------------------------------------------------------
   Se guarda DESPUES de mandar, no antes: si algo truena a medio
   camino, lo que se guarda es lo que de verdad paso.

   Solo los numeros de este aviso, otra vez. Y sin `await` que
   detenga la respuesta a Meta: a Meta hay que contestarle rapido
   o reintenta, y si reintenta acaba apagando el webhook.
   ------------------------------------------------------------ */
async function guardaLoQueQuedo(numeros) {
  if (!almacen.hayAlmacen() || !numeros.length) return;
  await Promise.all(numeros.map(async function (n) {
    const ficha = tickets.fichaViva(n);
    if (ficha) await almacen.guardaFicha(ficha).catch(function () {});
    await almacen.guardaCharla(n, webhook.charlaDe(n)).catch(function () {});
  }));
}

const TIPO_JSON = { 'content-type': 'application/json; charset=utf-8' };
const TIPO_TEXTO = { 'content-type': 'text/plain; charset=utf-8' };

/* La versión va fija: si Meta saca una nueva y cambiara sola, el bot se
   rompería un martes sin que nadie tocara nada. */
const GRAFO = 'https://graph.facebook.com/v21.0';

/* ------------------------------------------------------------
   EL MODO ESPIA
   ------------------------------------------------------------
   Con `ESPIAR` encendido, cada mensaje que sale hacia un cliente
   se le copia al dueño a su WhatsApp personal, junto con lo que
   el cliente acababa de escribir. Ve la platica correr en vivo.

   Para que sirvio (4-sep-2026): «lo unico que quiero es ver los
   mensajes que manda el bot con clientes y ver como se va
   comportando, poder revisar y accionar si algo sale mal».

   Es para VIGILAR mientras se estrena, no para operar. Con
   clientes de verdad son cientos de mensajes al dia y en dos
   dias se dejan de leer; para eso estan `tablero` y `ver`, que
   enseñan lo que importa en vez de todo. Por eso viene APAGADO
   y se prende a mano.

   ------------------------------------------------------------
   POR QUE VIVE AQUI Y NO EN EL WEBHOOK
   ------------------------------------------------------------
   Alla se decide QUE mandar; aqui se manda de verdad. Y entre
   una cosa y otra el texto cambia: le entra el precio, lo
   rescata la IA, el tablero se rearma con la base. Un espejo
   puesto en el webhook enseñaria lo que se penso mandar, no lo
   que el cliente recibio — que es justo lo que se quiere
   vigilar.
   ------------------------------------------------------------ */
const ESPIA_TOPE = 600;

function espiando() {
  const v = String(process.env.ESPIAR || '').trim().toLowerCase();
  return v === '1' || v === 'si' || v === 'true';
}

function recortaEspejo(t) {
  const s = String(t == null ? '' : t).trim();
  return s.length > ESPIA_TOPE ? s.slice(0, ESPIA_TOPE) + '…' : s;
}

/* Copia UN intercambio al dueño. Falla en silencio a proposito: el
   espejo es para mirar, y si se cae no puede llevarse la respuesta
   del cliente por delante. */
async function espeja(envio) {
  const dueno = tickets.numeroDelDueno(process.env);
  if (!dueno) return;
  /* Lo que ya va para el dueño no se copia a si mismo. */
  if (tickets.mismoNumero(envio.para, dueno)) return;

  const lineas = ['👁 *' + envio.para + '*', ''];

  /* `escribio` trae lo que el cliente puso, salvo cuando el envio no
     nacio de un mensaje suyo —la ficha bancaria, un recordatorio—, y
     ahi viene una marca entre corchetes que no se enseña como si la
     hubiera escrito el. */
  const dijo = String(envio.escribio || '');
  if (dijo && !/^\[[^\]]*\]$/.test(dijo)) lineas.push('👤 ' + recortaEspejo(dijo));

  lineas.push('🤖 ' + recortaEspejo(envio.texto));
  lineas.push('');
  lineas.push('_Contéstame esto y se lo paso._');

  await manda({
    numeroDeOrigen: envio.numeroDeOrigen,
    para: dueno,
    texto: lineas.join('\n'),
    /* `esTicket` con `sobreCliente` hace dos cosas: corta la
       recursion —un ticket no se espeja— y deja que responder el
       espejo le llegue al cliente, con la IA callandose sola. */
    esTicket: true,
    sobreCliente: envio.para,
    pasaAPersona: false,
    escribio: '[espia]'
  });
}

/* ------------------------------------------------------------
   EL NUMERO COMO LO QUIERE META
   ------------------------------------------------------------
   Mexico tiene un «1» viejo para celulares: WhatsApp reporta al
   cliente como 521 + 10 digitos en el webhook, pero Meta pide
   mandar a 52 + 10, y la lista de destinatarios de prueba los
   guarda asi. Contestando al 521 crudo, Meta buscaba el numero en
   su lista, no lo encontraba, y rechazaba con #131030 «no esta en
   la lista de autorizados» — aunque si estuviera.

   Se cazo el 5-sep-2026 en el primer «hola» de verdad: todo el
   camino funciono —firma, proceso, respuesta— y se cayo en el
   ultimo metro por ese digito. `_tickets.js` ya sabia que el 52 y
   el 521 son la misma persona, pero solo para COMPARAR; aqui es
   para MANDAR, que es donde Meta es estricto.

   Va en un solo lugar, a la salida, para que ninguna otra parte
   del bot tenga que saber de esto.
   ------------------------------------------------------------ */
function numeroParaMeta(n) {
  const d = String(n == null ? '' : n).replace(/\D+/g, '');
  if (d.length === 13 && d.indexOf('521') === 0) return '52' + d.slice(3);
  return d;
}

/* ------------------------------------------------------------
   MANDAR LA RESPUESTA
   ------------------------------------------------------------
   Si falla, se registra y se sigue: a Meta hay que contestarle
   200 de todas formas. Un error al responderle a UN cliente no
   puede tumbar el webhook para todos los demás.
   ------------------------------------------------------------ */
async function manda(envio) {
  const token = process.env.WHATSAPP_TOKEN;
  const numero = envio.numeroDeOrigen || process.env.WHATSAPP_PHONE_ID;
  if (!token || !numero) {
    console.error('[whatsapp] falta WHATSAPP_TOKEN o el numero de origen');
    return false;
  }
  try {
    const r = await fetch(GRAFO + '/' + numero + '/messages', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + token,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: numeroParaMeta(envio.para),
        /* ------------------------------------------------------------
           REENVIAR UN MEDIO POR SU ID
           ------------------------------------------------------------
           Cuando el cliente manda su comprobante de transferencia, esa
           foto tiene que llegarle al dueño. Meta deja reenviar un medio
           SUYO por su `id` dentro de la misma cuenta, así que no hay que
           bajarlo, guardarlo ni volverlo a subir.

           El texto va como pie de foto, que es lo que lleva el número
           del cliente — sin él, el dueño vería una foto sin saber de
           quién es.
           ------------------------------------------------------------ */
        ...(envio.reenviaMedio
          ? {
              type: envio.tipoMedio === 'document' ? 'document' : 'image',
              [envio.tipoMedio === 'document' ? 'document' : 'image']: {
                id: envio.reenviaMedio,
                caption: envio.texto
              }
            }
          /* Una foto NUESTRA, por su direccion publica. Meta la baja
             sola: no hay que subirla ni guardar su id. Asi es como se
             le enseña al cliente la unidad que le tocaria, junto con
             el precio. */
          : envio.ligaDeFoto
          ? {
              type: 'image',
              image: { link: envio.ligaDeFoto, caption: envio.texto }
            }
          : {
              type: 'text',
              text: { preview_url: false, body: envio.texto }
            })
      })
    });
    if (!r.ok) {
      /* El cuerpo del error de Meta dice QUÉ salió mal (token vencido,
         número no registrado, plantilla requerida). Sin esto, depurar
         es adivinar. */
      const detalle = await r.text().catch(function () { return ''; });
      console.error('[whatsapp] Meta contesto ' + r.status + ': ' + detalle.slice(0, 500));
      return false;
    }
    /* Meta devuelve el id del mensaje que acaba de mandar. Para un
       TICKET ese id es la unica forma de saber, cuando el dueno lo
       responda, de que cliente estaba hablando. Se guarda aqui y no
       en `_whatsapp-webhook.js` porque alla no hay red: alla se decide
       QUE mandar, aqui se manda y se ve el resultado. */
    if (envio.esTicket && envio.sobreCliente) {
      try {
        const cuerpo = await r.json();
        const id = cuerpo && cuerpo.messages && cuerpo.messages[0] && cuerpo.messages[0].id;
        if (id) tickets.recuerdaTicket(id, envio.sobreCliente);
      } catch (e) { /* sin id: queda el camino del numero escrito */ }
    }

    /* ------------------------------------------------------------
       Y SE APUNTA LO QUE EL BOT CONTESTO
       ------------------------------------------------------------
       Solo lo que va al CLIENTE. Los tickets y avisos al dueño son
       del bot hacia adentro, no parte de la conversacion: meterlos
       llenaria la bandeja de ruido que el cliente nunca vio.

       Va DESPUES de mandar y no antes: se apunta lo que de verdad
       salio, no lo que se pensaba mandar.
       ------------------------------------------------------------ */
    if (!envio.esTicket && envio.para && envio.texto) {
      almacen.anotaMensaje(envio.para, 'bot', envio.texto, 'texto')
        .catch(function () {});
      /* Y el espejo, si esta prendido. Va DESPUES de mandar y sin
         esperarlo: copiarle al dueño no puede retrasar ni tumbar la
         respuesta del cliente. */
      if (espiando()) espeja(envio).catch(function (e) {
        console.error('[whatsapp] el espejo no salio: ' + e.message);
      });
    }
    return true;
  } catch (e) {
    console.error('[whatsapp] no se pudo mandar: ' + e.message);
    return false;
  }
}

async function atiende(a) {
  const b = arguments[1];
  const esWeb = a && typeof a.arrayBuffer === 'function' &&
    a.headers && typeof a.headers.get === 'function';

  /* ================= firma Web: (Request) -> Response ================= */
  if (esWeb) {
    /* ---- alta del webhook ---- */
    if (a.method === 'GET') {
      const u = new URL(a.url);
      const params = {};
      u.searchParams.forEach(function (v, k) { params[k] = v; });
      const r = webhook.verificaSuscripcion(params);
      return new Response(r.cuerpo, { status: r.status, headers: TIPO_TEXTO });
    }
    if (a.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Método no permitido' }),
        { status: 405, headers: TIPO_JSON });
    }

    let crudo;
    try {
      crudo = Buffer.from(await a.arrayBuffer());
    } catch (e) {
      console.error('[whatsapp] no se pudo leer el cuerpo crudo: ' + e.message);
      return new Response(JSON.stringify({ error: 'cuerpo ilegible' }),
        { status: 500, headers: TIPO_JSON });
    }

    const [audios, numeros] = await Promise.all([
      transcribeLosAudios(crudo),
      cargaLoQueSeSabe(crudo)
    ]);
    /* OJO CON EL TERCER ARGUMENTO · `procesa` usa lo que le llegue ahi EN
       LUGAR de `process.env`, no ademas. Pasarle `{ audios }` a secas le
       borraba `WHATSAPP_APP_SECRET` y contestaba 503 a todo. Lo cazo
       `probar-whatsapp-cascara`. Por eso va el entorno completo. */
    const r = webhook.procesa(crudo, a.headers.get('x-hub-signature-256'),
      Object.assign({}, process.env, { audios }));
    for (const envio of r.envios) await reparte(envio);
    await guardaLoQueQuedo(numeros);
    return new Response(JSON.stringify(r.cuerpo), { status: r.status, headers: TIPO_JSON });
  }

  /* ================= firma de Node: (req, res) ================= */
  const req = a, res = b;

  if (req.method === 'GET') {
    const u = new URL(req.url, 'http://x');
    const params = {};
    u.searchParams.forEach(function (v, k) { params[k] = v; });
    const r = webhook.verificaSuscripcion(params);
    res.status(r.status).send(r.cuerpo);
    return;
  }
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Método no permitido' });
    return;
  }

  let crudo;
  try {
    crudo = await crudoDeNode(req);
  } catch (e) {
    console.error('[whatsapp] no se pudo leer el cuerpo: ' + e.message);
    res.status(500).json({ error: 'cuerpo ilegible' });
    return;
  }

  const [audios, numeros] = await Promise.all([
    transcribeLosAudios(crudo),
    cargaLoQueSeSabe(crudo)
  ]);
  /* Mismo cuidado que arriba: el entorno completo, no solo los audios. */
  const r = webhook.procesa(crudo, req.headers['x-hub-signature-256'],
    Object.assign({}, process.env, { audios }));
  /* `reparte`, NO `manda`. Aqui decia `manda` y con eso este camino se
     quedaba sin el precio, sin la IA de respaldo y sin los datos del
     contrato: las tres cosas se resuelven en `reparte`. Vercel usa hoy
     la firma Web, asi que no se notaba — hasta el dia que cambiara. Dos
     caminos que hacen cosas distintas es un defecto dormido. */
  for (const envio of r.envios) await reparte(envio);
  await guardaLoQueQuedo(numeros);
  res.status(r.status).json(r.cuerpo);
}

/* Del más confiable al menos. A diferencia del de Stripe, aquí NO se acepta
   un objeto ya parseado: la firma es el único candado que tiene esta puerta
   —no hay una segunda consulta a Meta que la respalde—, así que sin bytes no
   hay nada que comprobar y se prefiere fallar ruidoso. */
async function crudoDeNode(req) {
  if (Buffer.isBuffer(req.rawBody)) return req.rawBody;
  if (typeof req.rawBody === 'string') return Buffer.from(req.rawBody, 'utf8');
  if (Buffer.isBuffer(req.body)) return req.body;
  if (typeof req.body === 'string') return Buffer.from(req.body, 'utf8');

  const trozos = [];
  let total = 0;
  for await (const t of req) {
    total += t.length;
    if (total > 1048576) throw new Error('cuerpo demasiado grande');
    trozos.push(t);
  }
  if (!trozos.length && req.body && typeof req.body === 'object') {
    throw new Error('el entorno ya parseo el cuerpo y no quedan bytes que firmar');
  }
  return Buffer.concat(trozos);
}

export default atiende;
export const GET = atiende;
export const POST = atiende;
