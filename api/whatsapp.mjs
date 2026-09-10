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
import tarifa from './_tarifa.js';
import logica from './_webhook-logica.js';
import aprendidos from './_precios-aprendidos.js';
import agente from './_agente.js';
import seguimiento from './_seguimiento.js';
import recordatorios from './_recordatorios.js';
import crypto from 'crypto';
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
/* El dominio definitivo de EuroSystem (dictado del dueño, 5-sep-2026). La
   dirección vieja de Vercel redirige, pero una redirección entre dominios
   tira cabeceras: se va directo. */
const EUROSYSTEM = process.env.EUROSYSTEM_URL || 'https://eurosystem.site';
const ESPERA_CALENDARIO_MS = 4000;

/* La fecha de mentiras de las pruebas. En producción se ignora aunque
   alguien la deje puesta (auditoría 7-sep-2026). */
function hoyDePrueba() {
  return process.env.VERCEL_ENV === 'production' ? '' : (process.env.HOY_DE_PRUEBA || '');
}

/* EuroSystem cuenta por CATEGORÍA (SPRINTER, SUBURBAN, AUTOBUS). Aquí
   llega a veces la categoría y a veces el nombre del camión que el
   cliente escogió («Neobus», «Irizar i6S»): con el nombre EuroSystem
   contestaba 422 y el ticket iba sin calendario (visto en producción el
   7-sep-2026). */
function categoriaDeUnidad(tipo) {
  const t = String(tipo || '').toLowerCase();
  if (/sprinter/.test(t)) return 'SPRINTER';
  if (/suburban/.test(t)) return 'SUBURBAN';
  return 'AUTOBUS';
}

async function disponibilidadDe(tipo, salida, regreso) {
  /* Llave APARTE de la de contratos, solo de lectura (dictado del dueño,
     5-sep-2026: «la que tenga más seguridad»). Sin ella no se llama, y por
     eso tampoco se promete. */
  const llave = (process.env.DISPONIBILIDAD_API_KEY || '').trim();
  if (!llave || !tipo || !salida) return null;
  const t = categoriaDeUnidad(tipo);
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

/* ------------------------------------------------------------
   LA COMPUERTA · el dueño confirma antes de que el cliente vea precio
   ------------------------------------------------------------
   Regla del dueño (5-sep-2026): «de momento necesitarás mi
   confirmación para dar precios, disponibilidad y hacer contrato;
   la disponibilidad solo al principio, después serás libre».

   Dos interruptores, en Vercel, sin redeploy:
     CONFIRMAR_PRECIOS=1          el precio pasa por él (hoy: sí)
     CONFIRMAR_DISPONIBILIDAD=1   el calendario se revisa SIEMPRE y
                                  lo que diga va en el ticket (hoy: sí);
                                  en 0, solo en temporada alta o con
                                  30 días o menos, como estaba.
   Se apagan poniendo 0. Sin la variable, encendidos: lo seguro.

   Con la compuerta cerrada el bot calcula igual —para que el ticket
   traiga el número— pero NO lo manda: le llega a él, y su respuesta
   (`_confirmacion.js`) decide qué recibe el cliente.
   ------------------------------------------------------------ */
function encendido(nombre) {
  const v = process.env[nombre];
  return v === undefined || v === '' ? true : !/^(0|no|false|off)$/i.test(String(v).trim());
}
/* Dictado del dueño (7-sep-2026): «que el mensaje diga que en breve se le
   va a pasar su cotización y la disponibilidad de su viaje». Un solo texto
   para las dos situaciones: con fecha cercana o sin ella, lo que el
   cliente recibe después es lo mismo (el precio ya confirmado). */
const TEXTO_ESPERA_PRECIO =
  'Va. En breve te paso tu cotización y la disponibilidad de tu viaje 🙌';
const TEXTO_ESPERA_CON_CALENDARIO = TEXTO_ESPERA_PRECIO;
/* «sprinter» → «Sprinter»; un nombre de camión («Neobus», «Irizar i6S») se
   queda como está; «autobus» a secas no se nombra (todavía no escogió). */
/* La primera foto de la unidad que le tocaría, por su dirección pública.
   «sprinter»/«suburban» directo; un camión por su nombre («Neobus»); si no
   se sabe cuál (autobús sin escoger) no hay foto. */
function fotoParaLaEspera(u) {
  const sitio = String(process.env.SITIO_URL || '').replace(/\/+$/, '');
  if (!sitio) return null;
  const t = String(u || '').trim();
  let id = null;
  if (/^sprinter$/i.test(t)) id = 'sprinter';
  else if (/^suburban$/i.test(t)) id = 'suburban';
  else if (t && !/^autob[uú]s$/i.test(t)) {
    const n = t.toLowerCase();
    const unidad = (conversacion.UNIDADES || []).find(function (x) {
      return x.id === t || String(x.name || '').toLowerCase() === n;
    });
    id = unidad ? unidad.id : null;
  }
  if (!id) return null;
  const medios = conversacion.mediosDe(id);
  const foto = medios && medios.fotos && medios.fotos[0];
  return foto ? sitio + '/' + foto : null;
}

function nombreBonitoDeUnidad(u) {
  const t = String(u || '').trim();
  if (!t) return null;
  if (/^sprinter$/i.test(t)) return 'Sprinter';
  if (/^suburban$/i.test(t)) return 'Suburban';
  if (/^autob[uú]s$/i.test(t)) return null;
  return t;
}

/* Días de servicio contando salida y regreso (ida y vuelta el mismo día = 1). */
function diasDeViaje(salida, regreso) {
  const a = Date.parse(String(salida || '') + 'T12:00:00Z');
  const b = Date.parse(String(regreso || salida || '') + 'T12:00:00Z');
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  return Math.max(1, Math.round((b - a) / 86400000) + 1);
}

/* Con un total fijado por el dueño, el anticipo se recalcula con la misma
   regla del motor (20 % al múltiplo de $500 hacia arriba). Los demás
   campos del precio —desglose, noches— se quedan como los calculó el
   bot: el cliente solo ve el total y el anticipo. */
function conTotalFijado(precio, total, resumen) {
  const base = precio || {};
  const multiplo = tarifa.ANTICIPO_MULTIPLO || 500;
  const anticipo = Math.ceil(total * tarifa.ANTICIPO / multiplo) * multiplo;
  /* Sin cotizador (autobús, Suburban) el precio no trae días: se sacan
     de las fechas para que el texto no diga «undefined días» (C3). */
  const r = resumen || {};
  const dias = typeof base.dias === 'number' ? base.dias : diasDeViaje(r.salida, r.regreso);
  return Object.assign({}, base, {
    dias: dias,
    total: total,
    anticipo: Math.min(anticipo, total),
    saldo: total - Math.min(anticipo, total),
    requiereAsesor: false
  });
}

function ticketDePrecio(res, precio, cal, cliente, unidad, historial) {
  const lineas = ['💰 *Precio por confirmar*', ''];
  const pax = res.gente || res.pasajeros;
  if (res.destino) lineas.push('📍 ' + (res.origen ? res.origen + ' → ' : '') + res.destino);
  if (res.salida) {
    lineas.push('📅 ' + tickets.comoSeDice(res.salida) +
      (res.regreso ? ' al ' + tickets.comoSeDice(res.regreso) : ''));
  }
  /* El NOMBRE del catálogo, no la categoría: el ticket decía «🚌 sprinter»
     en minúscula mientras el de autobús decía «Irizar i6S» (9-sep-2026). */
  const comoSeLlama = unidad || res.unidadNombre || res.unidad;
  const delCatalogo = unidadDelCatalogo(comoSeLlama);
  if (comoSeLlama) {
    lineas.push('🚌 ' + ((delCatalogo && delCatalogo.name) || comoSeLlama) + (pax ? ' · ' + pax + ' pax' : ''));
  }
  lineas.push('');
  if (precio && typeof precio.total === 'number') {
    lineas.push('Calculado: *$' + precio.total.toLocaleString('es-MX') + '*' +
      (typeof precio.anticipo === 'number' ? ' (anticipo $' + precio.anticipo.toLocaleString('es-MX') + ')' : ''));
  } else {
    lineas.push('No pude calcularlo: escríbeme el precio.');
  }
  /* Lo que él mismo dio antes para este viaje, y lo que se le sugiere. */
  aprendidos.lineasDeHistorial(historial).forEach(function (l) { lineas.push(l); });
  if (cal) lineas.push('Calendario: ' + cal.libres + ' de ' + cal.total + ' libres');
  else if (cal === null) lineas.push('Calendario: EuroSystem no contestó');
  lineas.push('');
  lineas.push('Contéstame *este mensaje*: *va* y se lo mando tal cual, un *número* y va con ese precio, o escríbeme y se lo paso.');
  lineas.push('_cliente: ' + cliente + '_');
  return lineas.join('\n');
}

async function precioDe(envio, opciones) {
  const confirmado = !!(opciones && opciones.confirmado);
  const totalFijado = (opciones && typeof opciones.totalFijado === 'number') ? opciones.totalFijado : null;
  const res = envio.resumen || {};
  const hoy = hoyDePrueba() || conversacion.hoyISO();

  /* ---- la compuerta: todo pasa por el dueño ---- */
  if (!confirmado && encendido('CONFIRMAR_PRECIOS')) {
    /* La Sprinter se calcula; autobús y Suburban no tienen cotizador
       automático (el precio lo pone el dueño): el ticket va sin número y
       le pide el precio. Dictado del dueño (6-sep-2026): por WhatsApp NADIE
       se manda a otro número; todo pasa por su ticket. */
    let precio = null;
    if (envio.cotiza) {
      try {
        const r = await nucleo.cotiza(envio.cotiza, process.env.GOOGLE_ROUTES_KEY);
        if (r.ok) precio = r.precio;
        else console.error('[whatsapp] no se pudo cotizar: ' + r.error);
      } catch (e) {
        console.error('[whatsapp] cotizador tronado: ' + e.message);
      }
    }
    const unidad = (envio.cotiza && envio.cotiza.unidad) || res.unidad || 'sprinter';
    const revisa = encendido('CONFIRMAR_DISPONIBILIDAD') ||
      conversacion.hayQueRevisarDisponibilidad(res.salida, hoy);
    const [cal, historial] = await Promise.all([
      (revisa && res.salida) ? disponibilidadDe(unidad, res.salida, res.regreso) : Promise.resolve(undefined),
      almacen.hayAlmacen() ? almacen.preciosParecidos(aprendidos.claveDe(res, unidad)) : Promise.resolve([])
    ]);

    tickets.anotaEtapa(envio.para, 'pidio_precio', {
      porConfirmar: {
        cotiza: envio.cotiza || null,
        resumen: res,
        total: precio && typeof precio.total === 'number' ? precio.total : null,
        anticipo: precio && typeof precio.anticipo === 'number' ? precio.anticipo : null,
        calendario: cal === undefined ? null : cal,
        desde: Date.now()
      }
    });
    /* Y queda como pendiente de precio para el recordatorio de las 15 h al
       dueño: antes solo lo anotaba el camino del guion, y con el agente
       (el de casi todas las cotizaciones) nadie volvía a mover un ticket
       sin contestar (auditoría general del 8-sep, hallazgo 6). */
    tickets.anotaPendiente(envio.para, tickets.armaTicket({
      cliente: envio.para, origen: res.origen, destino: res.destino,
      salida: res.salida, regreso: res.regreso, dias: res.dias,
      unidad: res.unidadNombre || res.unidad || unidad, gente: res.gente, movimientos: res.recorridos
    }), Date.now());
    /* Fecha cercana o temporada alta: se le dice al cliente que se checa
       disponibilidad, sin prometer nada (dictado del dueño, 6-sep-2026).
       Y se le dice EN QUÉ lo llevan: «no me pidió unidad, el cliente no
       sabe en qué lo llevan» (dictado del dueño, 7-sep-2026). */
    const cerca = conversacion.hayQueRevisarDisponibilidad(res.salida, hoy);
    const nombreUnidad = nombreBonitoDeUnidad(res.unidadNombre || res.unidad || unidad);
    const conUnidad = nombreUnidad
      ? 'Va. Serían en ' + nombreUnidad + (res.gente ? ' para ' + res.gente : '') +
        '. En breve te paso tu cotización y la disponibilidad de tu viaje 🙌'
      : null;
    const mios = [{
      numeroDeOrigen: envio.numeroDeOrigen,
      para: envio.para,
      texto: conUnidad || (cerca ? TEXTO_ESPERA_CON_CALENDARIO : TEXTO_ESPERA_PRECIO),
      pasaAPersona: true,
      escribio: '[precio por confirmar]'
    }];
    /* Y la foto de la unidad que le tocaría, mientras espera el precio:
       efecto dotación («ésta es la que les tocaría») y reciprocidad —se le
       da algo antes de pedirle nada—. Auditoría de psicología del
       7-sep-2026. Solo si se sabe cuál unidad es; un autobús sin escoger
       no se enseña, para no enseñarle uno que no será. */
    /* La foto va CON EL PRECIO, no con la espera (dictado del dueño,
       8-sep-2026, reparación Falla 6: «unidad + precio total + foto +
       apartado + CLABE» en el mismo turno). La foto con la espera queda
       apagada por bandera (`FOTO_CON_LA_ESPERA=1` la reactiva), no borrada. */
    const fotoDeLaUnidad = process.env.FOTO_CON_LA_ESPERA === '1'
      ? fotoParaLaEspera(res.unidadNombre || res.unidad || unidad) : null;
    /* Sin pie, y no si ya pidió fotos de esa unidad en esta plática
       (`sinFoto`): dictado del dueño, 8-sep-2026. */
    if (fotoDeLaUnidad && !envio.sinFoto) {
      mios.push({
        numeroDeOrigen: envio.numeroDeOrigen,
        para: envio.para,
        ligaDeFoto: fotoDeLaUnidad,
        texto: '',
        pasaAPersona: false,
        escribio: '[precio por confirmar · foto]'
      });
    }
    /* La ficha recuerda que ya vio la foto de esta unidad (`res` es el
       resumen que se guarda en `porConfirmar` y luego en `viajeDatos`):
       con el precio no se manda la misma otra vez (auditoría general del
       8-sep, hallazgo 18). */
    if (fotoDeLaUnidad || envio.sinFoto) res.fotoMandada = true;
    const dueno = tickets.numeroDelDueno(process.env);
    if (!dueno) {
      /* Compuerta cerrada y nadie a quién preguntarle: el cliente se
         quedaría esperando para siempre (A11). Ruidoso en el registro. */
      console.error('[precio] CONFIRMAR_PRECIOS está encendido pero DUENO_WHATSAPP está vacío: ' +
        'el cliente ' + envio.para + ' recibió la espera y NADIE recibió el ticket.');
    }
    if (dueno) {
      mios.push({
        numeroDeOrigen: envio.numeroDeOrigen,
        para: dueno,
        esTicket: true,
        sobreCliente: envio.para,
        /* El viaje de ESTE ticket viaja con él: así el «va» a este
           mensaje confirma este viaje aunque el cliente cotice otro
           después (7-sep-2026). Misma forma que `porConfirmar`. */
        carga: {
          cotiza: envio.cotiza || null,
          resumen: res,
          total: precio && typeof precio.total === 'number' ? precio.total : null,
          anticipo: precio && typeof precio.anticipo === 'number' ? precio.anticipo : null,
          calendario: cal === undefined ? null : cal,
          desde: Date.now()
        },
        texto: ticketDePrecio(res, precio, cal, envio.para, unidad, historial),
        pasaAPersona: false,
        escribio: '[ticket precio]'
      });
    }
    return mios;
  }

  /* ---- primero el calendario, si toca (con la compuerta apagada) ---- */
  if (!confirmado && conversacion.hayQueRevisarDisponibilidad(res.salida, hoy)) {
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
  if (envio.cotiza) {
    try {
      const r = await nucleo.cotiza(envio.cotiza, process.env.GOOGLE_ROUTES_KEY);
      if (r.ok) precio = r.precio;
      else console.error('[whatsapp] no se pudo cotizar: ' + r.error);
    } catch (e) {
      console.error('[whatsapp] cotizador tronado: ' + e.message);
    }
  }
  /* El dueño contestó con un número: ése es el precio, calcule lo que
     calcule el motor. Regla de la casa: los precios los pone él. */
  if (totalFijado !== null) precio = conTotalFijado(precio, totalFijado, res);
  /* La unidad con la que se busca y se guarda el precio aprendido es LA
     MISMA (C12): antes se buscaba con «sprinter» por omisión y se guardaba
     con «sin unidad», y lo aprendido no volvía a encontrarse. */
  const unidadDelViaje = (envio.cotiza && envio.cotiza.unidad) || res.unidadNombre || res.unidad || 'sprinter';

  /* Autobús o Suburban con «va» a secas: no hay número que mandar. Se le
     pide al dueño, y al cliente no le llega nada a medias. */
  if (confirmado && !precio) {
    const dueno = tickets.numeroDelDueno(process.env);
    return [{
      numeroDeOrigen: envio.numeroDeOrigen,
      para: dueno || envio.numeroDeOrigen,
      esTicket: true, sobreCliente: envio.para,
      texto: 'Para este viaje el precio lo pones tú: contéstame *este mensaje* con el número (por ejemplo *52,000*) y se lo mando.\n_cliente: ' + envio.para + '_',
      pasaAPersona: false,
      escribio: '[precio · falta el número]'
    }];
  }

  const salida = conversacion.textoDeCotizacion(precio, envio.resumen);

  /* El total y el anticipo se saben AQUI y en ningun otro lado: el
     webhook es sincrono y no cotiza. Se apuntan en la ficha para que,
     cuando llegue el comprobante, el aviso pueda decir de que viaje
     era y cuanto tenia que traer — sin que nadie vaya a buscarlo.

     Y se apuntan DESPUÉS de que WhatsApp acepte el mensaje (`alMandar`,
     auditoría 7-sep-2026, C9): si Meta lo rechaza, la ficha no puede
     decir «ya tiene precio» ni el seguimiento preguntarle «¿te llegó?» a
     quien nunca lo recibió. Lo mismo el precio aprendido, que se guarda
     sin esperar (a Meta hay que contestarle rápido). */
  const marcaQueYaTienePrecio = function () {
    if (confirmado && precio && precio.total > 0 && almacen.hayAlmacen()) {
      almacen.guardaPrecio(aprendidos.renglonDe(res, unidadDelViaje, precio,
        { fijado: totalFijado !== null, cliente: envio.para })).catch(function () {});
    }
    if (!(precio && typeof precio.total === 'number')) return;
    const r = envio.resumen || {};
    tickets.anotaEtapa(envio.para, 'con_precio', {
      total: precio.total,
      anticipo: precio.anticipo,
      porConfirmar: null, // ya se mandó: no queda nada esperando
      viajeDatos: r,      // en datos, para el contrato de después
      /* Arranca el seguimiento (6-sep-2026): desde AHORA cuentan las 4,
         24 y 72 horas de `_seguimiento.js`, y un precio nuevo reinicia
         los toques. Aquí y no antes: este es el momento en que el
         cliente RECIBE el precio, después del «va» del dueño. */
      precioEn: Date.now(),
      toques: 0,

      viaje: r.destino
        ? '📍 ' + (r.origen ? r.origen + ' → ' : '') + r.destino +
          (r.salida ? '\n📅 ' + tickets.comoSeDice(r.salida) +
            (r.regreso ? ' al ' + tickets.comoSeDice(r.regreso) : '') : '')
        : null
    });
  };

  /* El bloque de apartado va PEGADO al precio (dictado del dueño, 8-sep-2026,
     reparación Falla 6): monto de apartado + CLABE, escritos por el código,
     nunca por el modelo. Si no hay CLABE configurada, el precio sale sin él
     y queda en el registro. */
  const apartado = bloqueApartado(precio);
  if (!apartado) console.error('[apartado] sin CLABE en Vercel: el precio salió sin los datos de depósito');
  const mios = [{
    numeroDeOrigen: envio.numeroDeOrigen,
    para: envio.para,
    texto: salida.texto + (apartado ? '\n\n' + apartado : ''),
    pasaAPersona: !!salida.pasa,
    alMandar: marcaQueYaTienePrecio,
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
  /* Sin pie (dictado del dueño, 8-sep-2026: «nomás mándale la foto»), y
     no se manda si ya la vio en esta plática (`sinFoto`). */
  if (sitio && foto && precio && typeof precio.total === 'number' && !envio.sinFoto && !res.fotoMandada) {
    mios.push({
      numeroDeOrigen: envio.numeroDeOrigen,
      para: envio.para,
      ligaDeFoto: sitio + '/' + foto,
      texto: '',
      pasaAPersona: false,
      escribio: '[foto de la unidad]'
    });
  }
  /* Y la CLABE y el número de cuenta, pelones, cada uno en su mensaje, para
     copiarlos con un toque largo. Van después de la foto, al final. */
  if (apartado) mensajesParaCopiar(envio.numeroDeOrigen, envio.para).forEach(function (m) { mios.push(m); });

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
  /* Hoy en hora de Guadalajara, no UTC: a las 6 de la tarde ya es «mañana»
     en Vercel y «pasado mañana» salía un día corrido (8-sep-2026). */
  const hoy = hoyDePrueba() || conversacion.hoyISO();
  if (!process.env.ANTHROPIC_API_KEY) return null;
  if (!hayCupoDeIA(hoy)) {
    console.error('[whatsapp] tope diario de IA alcanzado, sigue el guion');
    return null;
  }

  /* La IA lee con la plática a la vista: qué pregunta está contestando el
     cliente y qué se sabe ya del viaje. Sin esto, «pasado» y «vta» eran
     ruido; con esto son «pasado mañana» y «Puerto Vallarta». */
  const estadoParaContexto = envio.estadoDelCliente || null;
  let contexto = null;
  if (estadoParaContexto && estadoParaContexto.paso) {
    let preguntaTexto = '';
    try { preguntaTexto = (conversacion.pregunta(estadoParaContexto) || {}).texto || ''; } catch (e) { /* sin pregunta */ }
    contexto = {
      pregunta: preguntaTexto.replace(/\s+/g, ' ').trim(),
      sabido: {
        destino: estadoParaContexto.destino, origen: estadoParaContexto.origen,
        salida: estadoParaContexto.salida, regreso: estadoParaContexto.regreso,
        gente: estadoParaContexto.gente, unidad: estadoParaContexto.unidadNombre || estadoParaContexto.unidad
      }
    };
  }

  let leido;
  try {
    leido = await entendedor.entiende(envio.crudoDelCliente, { hoy: hoy, cliente: envio.para, contexto: contexto });
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
    /* ------------------------------------------------------------
       CON SIEMPRE_IA, EL GUION YA ENTENDIÓ Y LA IA LEYÓ DE MÁS
       ------------------------------------------------------------
       La IA leyó el mensaje aunque el guion no se atoró. Lo que haya
       leído se PEGA al estado que va (solo huecos vacíos, nunca se
       pisa nada) y no se arranca de cero jamás: `aplicaEntendido`
       aquí tiraría una cotización buena por la mitad.

         · Si con lo pegado el siguiente hueco es otro (la IA leyó
           «salimos de Guadalajara» y eso ahorra una pregunta), se
           contesta con la pregunta nueva en vez de la del guion.
         · Si no cambia nada, se guarda lo pegado en silencio y la
           respuesta del guion se queda como estaba.
       ------------------------------------------------------------ */
    if (envio.guionEntendio) {
      if (!(estadoQueIba && estadoQueIba.paso)) return null;
      mejor = conversacion.continuaCon(estadoQueIba, leido, hoy);
      if (!mejor) return null;
      const pasoQueIba = estadoQueIba.paso;
      const pasoNuevo = mejor.estado && mejor.estado.paso;
      if (Object.prototype.hasOwnProperty.call(mejor, 'estado') && mejor.estado) {
        webhook.guardaCharla(envio.para, mejor.estado);
      }
      if (!pasoNuevo || pasoNuevo === pasoQueIba) return null;
    } else {
      if (estadoQueIba && estadoQueIba.paso) {
        mejor = conversacion.continuaCon(estadoQueIba, leido, hoy);
      }
      if (!mejor) mejor = conversacion.aplicaEntendido(leido, hoy);
    }
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
/* ¿Ya le pedí los datos del contrato en esta plática? Se miran los tres
   últimos mensajes míos, no solo el último: en cuanto sale la versión
   corta («¿me pasas…?») la larga ya no debe volver. */
function yaLePediDatos(cliente) {
  return agente.historialDe(cliente)
    .filter(function (t) { return t.de === 'bot'; })
    .slice(-3)
    .some(function (t) {
      /* «Son 4 datos: …» es el acuse del comprobante, que ya pidió los
         datos: enseguida no se le repite la lista de cinco puntos. */
      return /Me falta|me faltan estos datos|Me pasas|Son 4 datos|vamos armando tu contrato/i.test(t.texto || '');
    });
}

/* Un campo del contrato, pedido como lo pediría una persona y no como una
   casilla: «El *nombre completo* de quien firma el contrato» → «el nombre
   completo de quien firma el contrato». */
function unDato(campo) {
  const t = String((campo && campo.pide) || '').replace(/\*/g, '').trim();
  return t.charAt(0).toLowerCase() + t.slice(1);
}

async function datosDelContrato(envio) {
  const hoy = hoyDePrueba() || conversacion.hoyISO();
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
  const trajoAlgo = contrato.CAMPOS.some(function (c) { return nuevos[c.id] != null && nuevos[c.id] !== ''; });

  /* ------------------------------------------------------------
     JUNTAR DATOS NO ES UN CALLEJÓN
     ------------------------------------------------------------
     Corrida real del 9-sep-2026 (escenario d): un cliente que YA depositó
     escribió «¿cómo va lo mío?», «¿mi contrato ya está?», «vamos a cambiar
     la fecha al 21 de noviembre» y «ok gracias», y recibió CUATRO VECES la
     misma lista de datos que faltan. El cambio de fecha —que es dinero— no
     llegó al dueño.

     Si el mensaje no trae ningún dato del contrato, aquí se decide qué es:
     un cambio (va al dueño), una pregunta de estado (se contesta con la
     verdad) o un cierre (se acusa y ya). La lista solo vuelve a salir si
     de verdad ayuda.
     ------------------------------------------------------------ */
  if (!trajoAlgo) {
    const t = conversacion.normaliza(envio.crudoDelCliente);
    const cambia = /\b(cambiar|cambiamos|cambio|mover|movemos|recorrer|adelantar|posponer|aplazar)\b[^.?!]{0,30}\b(fecha|dia|viaje|salida|horario)\b|\bcancelar\b|\bcancelamos\b|\bya no vamos\b|\bya no va\b|\bsomos mas\b|\bsomos menos\b|\bya no van\b/.test(t);
    const pregunta = /\bcomo va\b|\bque onda con\b|\bya esta\b|\bya quedo\b|\bmi contrato\b|\bel contrato\b|\bya lo revisaron\b|\bconfirmaron\b|\bllego mi (pago|deposito|comprobante)\b|\bcuando me (mandan|llega)\b|\bnovedades\b/.test(t);
    const dueno = tickets.numeroDelDueno(process.env);
    if (cambia) {
      const salidaCambio = [{
        numeroDeOrigen: envio.numeroDeOrigen, para: envio.para,
        texto: 'Va, lo checo 🙌 Eso lo confirma una persona del equipo y en breve te dicen por aquí.',
        pasaAPersona: false, escribio: '[datos del contrato · cambio al dueño]'
      }];
      if (dueno) {
        salidaCambio.push({
          numeroDeOrigen: envio.numeroDeOrigen, para: dueno, esTicket: true, sobreCliente: envio.para, pasaAPersona: false,
          texto: '⚠️ *Quiere cambiar algo de un viaje YA APARTADO*\n\n«' + String(envio.crudoDelCliente).slice(0, 300) + '»\n\n' +
            'Ya depositó y se le estaban juntando los datos del contrato. Contéstame *este mensaje* y le llega tal cual.\n_cliente: ' + envio.para + '_',
          escribio: '[ticket · cambio después de apartar]'
        });
      }
      return salidaCambio;
    }
    if (pregunta || !completo) {
      const f = tickets.fichaDe(envio.para) || {};
      const estado = f.contratoSubido
        ? 'Tu contrato ya está armado, folio *' + f.contratoSubido.folio + '* 📄'
        : 'Tu comprobante ya lo tiene el equipo; en cuanto lo confirmen te llega tu contrato 🙌';
      const faltan = contrato.faltantes(juntos);
      /* La lista de cinco puntos se manda UNA vez. Si el cliente vuelve a
         escribir sin traer datos, se le pide UNO solo, como lo pediría una
         persona: la lista repetida es lo que hacía sentir formulario
         (corrida real del 9-sep-2026). */
      const yaLaVio = yaLePediDatos(envio.para);
      const unoSolo = faltan.length ? '\n\n¿Me pasas ' + unDato(faltan[0]) + '?' : '';
      const listaCompleta = faltan.length ? '\n\nMientras, me faltan estos datos:\n\n' + faltan.map(function (c) { return '· ' + c.pide; }).join('\n') : '';
      const texto = pregunta
        ? estado + (yaLaVio ? unoSolo : listaCompleta)
        : (yaLaVio
          ? 'Va 🙌' + (unoSolo || ' En cuanto se confirme tu pago te mando tu contrato.')
          : contrato.pideLoQueFalta(juntos, nuevos));
      return [{
        numeroDeOrigen: envio.numeroDeOrigen, para: envio.para, texto: texto,
        pasaAPersona: false, escribio: '[datos del contrato · estado]'
      }];
    }
  }

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
    const f = tickets.fichaDe(envio.para) || {};
    salida.push({
      numeroDeOrigen: envio.numeroDeOrigen,
      para: dueno,
      texto: contrato.fichaParaElDueno(juntos, envio.para) +
        '\n\nContéstame *este mensaje* con *va* para autorizar estos datos.',
      esTicket: true,
      sobreCliente: envio.para,
      /* La carga dice QUÉ ticket es: su «va» aquí autoriza los datos, no
         el pago ni un precio (dictado del dueño, 9-sep-2026). */
      carga: { tipo: 'contrato' },
      pasaAPersona: false,
      escribio: '[ficha del contrato]'
    });
    /* ------------------------------------------------------------
       Y EL SEGUNDO: VERIFICAR LA TRANSFERENCIA
       ------------------------------------------------------------
       Dictado del dueño (9-sep-2026): «cuando los mande me manda otro
       mensaje, 1 para verificar datos de contrato y otro para verificar
       transferencia; una vez autorizados los dos se genera el contrato».
       Si ya aprobó el pago antes, este segundo no hace falta.
       ------------------------------------------------------------ */
    if (!f.pagoAprobado) {
      salida.push({
        numeroDeOrigen: envio.numeroDeOrigen,
        para: dueno,
        texto: '💵 *Falta verificar la transferencia*\n\n' +
          'De ' + envio.para + (typeof f.anticipo === 'number' ? ' · anticipo $' + f.anticipo.toLocaleString('en-US') : '') +
          '\nSu comprobante te llegó arriba.\n\n' +
          'Contéstame *este mensaje* con *va* cuando la veas en el banco.\n' +
          'Con esa y la de los datos, el contrato se genera solo.\n_cliente: ' + envio.para + '_',
        esTicket: true,
        sobreCliente: envio.para,
        carga: { tipo: 'pago' },
        pasaAPersona: false,
        escribio: '[verificar la transferencia]'
      });
    }
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

/* ------------------------------------------------------------
   EL DUEÑO CONFIRMÓ UN PRECIO
   ------------------------------------------------------------
   El webhook decidió que su respuesta era «va» o un número; aquí
   se rearma el precio con lo que quedó guardado en la ficha y se
   manda al cliente por el camino de siempre (texto, fotos, etapa).

   Si la ficha ya no trae nada —la instancia se recicló y la base
   aún no tiene la columna, o ya se había mandado— se le dice al
   dueño en vez de callarse: un «va» que no llega a nadie es una
   venta perdida en silencio.
   ------------------------------------------------------------ */
async function precioConfirmado(envio) {
  let ficha = tickets.fichaDe(envio.para);
  if (!(ficha && ficha.porConfirmar) && almacen.hayAlmacen()) {
    const deLaBase = await almacen.leeFicha(envio.para).catch(function () { return null; });
    if (deLaBase) { tickets.siembraFicha(deLaBase); ficha = tickets.fichaDe(envio.para) || deLaBase; }
  }
  /* Primero lo que trae el ticket citado (su propio viaje); si es un
     ticket viejo sin carga, lo que la ficha tenga pendiente. */
  const pc = envio.cargaDelTicket || (ficha && ficha.porConfirmar);
  const dueno = tickets.numeroDelDueno(process.env);
  if (!pc || !(pc.cotiza || pc.resumen)) {
    return [{
      numeroDeOrigen: envio.numeroDeOrigen,
      para: dueno || envio.numeroDeOrigen,
      texto: 'Ya no tengo el precio de ese cliente guardado 🙈 (o ya se lo mandé). ' +
        'Escríbeselo tú respondiendo su ticket, o pídele que me vuelva a preguntar.',
      esTicket: true,
      sobreCliente: envio.para,
      pasaAPersona: false,
      escribio: '[precio · sin nada que confirmar]'
    }];
  }
  return precioDe({
    numeroDeOrigen: envio.numeroDeOrigen,
    para: envio.para,
    cotiza: pc.cotiza,
    resumen: pc.resumen || {}
  }, { confirmado: true, totalFijado: envio.totalFijado });
}

/* ------------------------------------------------------------
   EL DUEÑO AUTORIZÓ EL CONTRATO: SE REGISTRA EN EUROSYSTEM
   ------------------------------------------------------------
   Por la misma puerta que usa la página (CONTRATOS-API.md), con el
   mismo armado (`contratoDesde`). EuroSystem lo crea siempre como
   BORRADOR, que es lo que el dueño pidió, y no duplica si la misma
   referencia llega dos veces: la referencia es el número del cliente
   más su fecha de salida, estable entre reintentos.

   Al dueño le llega el folio y la liga del PDF, o el error con sus
   palabras. Nunca en silencio: un contrato que no se registró y
   nadie lo supo es un camión que no sale.
   ------------------------------------------------------------ */
const ESPERA_CONTRATO_MS = 8000;

function armaContrato(ficha, cliente) {
  const d = ficha.contrato || {};
  const v = ficha.viajeDatos || {};
  const hora = (h) => (h && /^\d{1,2}:\d{2}$/.test(h)) ? h.padStart(5, '0') : null;
  const salida = v.salida ? v.salida + (hora(d.horaSalida) ? 'T' + hora(d.horaSalida) : '') : '';
  const regreso = (v.regreso || v.salida)
    ? (v.regreso || v.salida) + (hora(d.horaRegreso) ? 'T' + hora(d.horaRegreso) : '')
    : '';
  const m = {
    nombre: d.nombre || '',
    telefono: d.telefono || String(cliente || ''),
    salida: salida,
    regreso: regreso,
    origen: v.origen || '',
    destino: v.destino || '',
    puntoSalida: d.direccionSalida || '',
    unidad: v.unidad || '',
    total: ficha.total || 0,
    anticipo: ficha.anticipo || 0
  };
  /* Los últimos 10 dígitos, como `_tickets.llave`: por cita el cliente
     llega como 52133…, por número escrito como 33…; con dos referencias
     distintas EuroSystem no deduplica y sale un contrato gemelo (C8). */
  const referencia = ('WA-' + String(cliente || '').replace(/\D+/g, '').slice(-10) + '-' + (v.salida || '')).slice(0, 80);
  const cuerpo = logica.contratoDesde(m, { id: referencia });
  cuerpo.referenciaExterna = referencia;
  /* PASAJEROS: el bot NO se los pregunta al cliente a propósito (dictado
     del dueño, 8-sep-2026: «lo que importa es la renta del camión, no las
     personas»). Cuando no salieron solos en la plática, la puerta exige un
     número y se manda 1 — que es el valor por omisión, no un dato. Sin
     esta línea el contrato dice «1 pasajero» para un autobús de 50 y la
     oficina se lo cree. */
  const pax = Number(v.pasajeros || v.gente) || 0;
  cuerpo.servicio.pasajeros = pax > 0 ? Math.min(pax, 90) : 1;
  cuerpo.observaciones = 'Vendido por WhatsApp (Eurobot), autorizado por el dueño. ' +
    'Anticipo por transferencia; confirmar que entró antes de dar por apartado.' +
    (pax > 0 ? '' : ' PASAJEROS: no se le preguntaron al cliente, confirmar con él.') +
    (d.direccionDestino ? ' Llegada: ' + d.direccionDestino + '.' : '');
  cuerpo.servicio.itinerario = d.direccionDestino
    ? 'Llegada: ' + d.direccionDestino + (d.horaRegreso ? '. Regresan a las ' + d.horaRegreso : '')
    : undefined;
  cuerpo.cobro.formaPago = 'TRANSFERENCIA';
  cuerpo.cobro.condicionesPago = 'Anticipo por transferencia. Saldo por cubrir antes de la salida.';
  return cuerpo;
}

async function subeContrato(envio) {
  let ficha = tickets.fichaDe(envio.para);
  if (!(ficha && ficha.contrato) && almacen.hayAlmacen()) {
    const deLaBase = await almacen.leeFicha(envio.para).catch(function () { return null; });
    if (deLaBase) { tickets.siembraFicha(deLaBase); ficha = tickets.fichaDe(envio.para) || deLaBase; }
  }
  const dueno = tickets.numeroDelDueno(process.env) || envio.numeroDeOrigen;
  const alDueno = function (texto, escribio) {
    return [{
      numeroDeOrigen: envio.numeroDeOrigen, para: dueno, texto: texto,
      esTicket: true, sobreCliente: envio.para, pasaAPersona: false, escribio: escribio
    }];
  };

  if (!ficha || !ficha.contrato || !contrato.estaCompleto(ficha.contrato)) {
    return alDueno('No tengo la ficha completa de ese cliente 🙈. Pídele los datos que falten o captúralo tú.', '[contrato · sin ficha]');
  }
  if (ficha.contratoSubido && ficha.contratoSubido.folio) {
    return alDueno('Ese contrato ya está registrado: folio *' + ficha.contratoSubido.folio + '*.' +
      (ficha.contratoSubido.urlPdf ? '\n' + ficha.contratoSubido.urlPdf : ''), '[contrato · ya subido]');
  }
  const llave = (process.env.CONTRATOS_API_KEY || '').trim();
  if (!llave) {
    return alDueno('No tengo la llave para registrar contratos en EuroSystem (CONTRATOS_API_KEY). Captúralo tú por ahora.', '[contrato · sin llave]');
  }
  if (!ficha.viajeDatos || !ficha.viajeDatos.salida) {
    return alDueno('No tengo las fechas de ese viaje en datos (el precio se dio antes de esta versión). Captúralo tú por ahora.', '[contrato · sin viaje]');
  }

  const cuerpo = armaContrato(ficha, envio.para);
  const corta = new AbortController();
  const reloj = setTimeout(function () { corta.abort(); }, ESPERA_CONTRATO_MS);
  let r, datos;
  try {
    r = await fetch(EUROSYSTEM.replace(/\/+$/, '') + '/api/contratos/externo', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': llave },
      body: JSON.stringify(cuerpo),
      signal: corta.signal
    });
    datos = await r.json().catch(function () { return {}; });
  } catch (e) {
    clearTimeout(reloj);
    console.error('[contrato] EuroSystem no contestó: ' + e.message);
    return alDueno('EuroSystem no contestó al registrar el contrato. Vuelve a decirme *va* en un momento, o captúralo tú.', '[contrato · sin respuesta]');
  }
  clearTimeout(reloj);

  if (!r.ok || !datos || !datos.folio) {
    const detalle = datos && datos.detalle && Array.isArray(datos.detalle)
      ? datos.detalle.map(function (x) { return (x.campo ? x.campo + ': ' : '') + x.mensaje; }).join('; ')
      : '';
    console.error('[contrato] EuroSystem dijo ' + r.status + ': ' + ((datos && datos.error) || '') + ' ' + detalle);
    return alDueno('❌ EuroSystem no registró el contrato: ' + ((datos && datos.error) || ('HTTP ' + r.status)) +
      (detalle ? '\n' + detalle : '') + '\n\nCorrige y dime *va* otra vez, o captúralo tú.', '[contrato · rechazado]');
  }

  tickets.anotaEtapa(envio.para, 'contrato_listo', {
    contratoSubido: { folio: datos.folio, urlPdf: datos.urlPdf || null, contratoId: datos.contratoId || null, cuando: Date.now() }
  });
  console.log('[contrato] registrado folio ' + datos.folio + (datos.repetido ? ' (ya existía)' : ''));
  /* ------------------------------------------------------------
     EL ORDEN QUE DICTÓ EL DUEÑO (9-sep-2026)

       1. el PDF al cliente
       2. el mismo PDF a él
       3. el contrato subido al sistema — que es lo que acaba de pasar
          arriba, porque el PDF sale justamente de ahí

     Antes de esto los dos recibían la LIGA en texto. La liga vence a los
     30 días; el archivo entregado por WhatsApp se queda en la plática
     para siempre. Y el dueño pidió recibirlo «por si falla subirlo yo»:
     por eso, además del archivo, se le manda el aviso con la liga, que
     sobrevive aunque Meta no haya podido bajar el PDF.
     ------------------------------------------------------------ */
  const nombreDelArchivo = 'Contrato-' + datos.folio + '.pdf';
  const salida = [];
  /* 1) Al cliente, y solo la primera vez: si el contrato ya existía, ya lo
        tiene desde entonces. */
  if (datos.urlPdf && !datos.repetido) {
    salida.push({
      numeroDeOrigen: envio.numeroDeOrigen,
      para: envio.para,
      ligaDeDocumento: datos.urlPdf,
      nombreDeArchivo: nombreDelArchivo,
      texto: TEXTO_CONTRATO_AL_CLIENTE(datos.folio),
      textoDeRespaldo: TEXTO_CONTRATO_AL_CLIENTE(datos.folio, datos.urlPdf),
      pasaAPersona: false,
      escribio: '[contrato · pdf al cliente]'
    });
  }
  /* 2) El mismo archivo al dueño. */
  if (datos.urlPdf) {
    salida.push({
      numeroDeOrigen: envio.numeroDeOrigen,
      para: dueno,
      ligaDeDocumento: datos.urlPdf,
      nombreDeArchivo: nombreDelArchivo,
      texto: '📄 Contrato *' + datos.folio + '* de ' + envio.para +
        (datos.repetido ? ' (ya existía)' : ''),
      pasaAPersona: false,
      escribio: '[contrato · pdf al dueño]'
    });
  }
  /* 3) Y el aviso con la liga, que le sirve aunque el archivo no haya
        salido: de ahí lo baja y lo sube él. */
  salida.push(alDueno('📄 Contrato registrado en EuroSystem como *BORRADOR*, folio *' + datos.folio + '*' +
    (datos.repetido ? ' (ya existía)' : '') + '.' +
    (datos.urlPdf ? '\n' + datos.urlPdf : '') +
    '\n\nLo confirmas en el panel cuando entre el anticipo.', '[contrato · registrado]')[0]);
  return salida;
}

/* T-125 · Lo que recibe el cliente cuando su contrato ya quedó registrado.
   Sin `liga` es el pie del PDF; con `liga` es el respaldo en texto para
   cuando Meta no pudo bajar el archivo. */
function TEXTO_CONTRATO_AL_CLIENTE(folio, liga) {
  return 'Listo, ya quedó tu contrato con el folio *' + folio + '* 🎉\n' +
    (liga ? 'Aquí lo puedes ver y guardar:\n' + liga + '\n\n' : 'Aquí te va en PDF para que lo guardes.\n\n') +
    'En cuanto se vea reflejado tu anticipo te confirmo la fecha.';
}

/* ------------------------------------------------------------
   EL AGENTE HABLA (dictado del dueño, 5-sep-2026)
   ------------------------------------------------------------
   El webhook ya corrió el guion (respaldo) y marcó el envío con el
   estado de ANTES. Aquí se le da la palabra a la IA:

     · Si contesta, lo del guion se descarta: el estado vuelve al de
       antes y se le pega SOLO lo que la IA leyó (`pegaDatos`), y el
       cliente recibe lo que la IA dijo.
     · Si pide una ACCIÓN (fotos, persona, apartar, cotizar) o ya
       está todo para cotizar, no se reinventa nada: se reinyecta al
       guion un mensaje canónico —firmado por nosotros mismos— y
       todo sale por el único camino probado: fotos, tickets, ficha
       bancaria, precio con la compuerta del dueño.
     · Si la IA no contesta o dice algo que no puede salir, se
       devuelve `false` y el envío del guion sigue como siempre.
   ------------------------------------------------------------ */
const CANONICO = {
  fotos: 'tienes fotos',
  persona: 'quiero hablar con una persona',
  apartar: 'quiero apartar',
  cotizar: 'sí está bien'
};

async function reinyectaAlGuion(envio, textoCanonico) {
  const waba = process.env.WHATSAPP_WABA_ID || '0';
  const cuerpo = JSON.stringify({
    object: 'whatsapp_business_account',
    entry: [{ id: waba, changes: [{ value: {
      metadata: { phone_number_id: envio.numeroDeOrigen || process.env.WHATSAPP_PHONE_ID },
      messages: [{ id: 'wamid.agente.' + Date.now() + '.' + Math.random().toString(36).slice(2, 8),
        from: envio.para, type: 'text', text: { body: textoCanonico } }]
    } }] }]
  });
  const crudo = Buffer.from(cuerpo, 'utf8');
  const secreto = process.env.WHATSAPP_APP_SECRET;
  const firma = secreto
    ? 'sha256=' + crypto.createHmac('sha256', secreto).update(crudo).digest('hex')
    : null;
  /* Sin el agente ni la IA lectora en esta vuelta: esto es el motor
     ejecutando una orden, no otra conversación. */
  const entorno = Object.assign({}, process.env, {
    AGENTE_IA: '0', SIEMPRE_IA: '0',
    RUTA_SECRETA_OK: secreto ? '' : '1'
  });
  const r = webhook.procesa(crudo, firma, entorno);
  if (r.status !== 200) {
    console.error('[agente] el motor no aceptó la orden «' + textoCanonico + '»: ' + r.status);
    return false;
  }
  for (const e of r.envios) await reparte(e);
  return true;
}

/* La pregunta que el GUION le haría al cliente en el paso en que va la
   plática. Es texto para el cliente; `loQueFalta` es texto para la IA y
   no se le puede mandar a nadie. Si el guion no tiene pregunta para ese
   paso, una neutra. */
function preguntaParaElCliente(estado) {
  try {
    /* Si lo que falta es escoger autobús, la lista es la del dueño
       (nombre — línea — asientos), no la ficha larga del guion viejo. */
    const falta = String(conversacion.loQueFalta(estado) || '');
    if (/cu[aá]l autob[uú]s/.test(falta)) return conversacion.mensajeDeTodosLosAutobuses(estado && estado.gente);
    const p = conversacion.pregunta ? conversacion.pregunta(estado) : null;
    const t = p && p.texto ? String(p.texto).trim() : '';
    if (t && !esTextoInterno(t)) return t;
  } catch (e) { /* sin pregunta: la neutra */ }
  return '¿Me dices lo que falta y te lo armo?';
}

/* Cuando la IA no tiene nada que decir y el cliente YA tiene un precio
   pedido o dado, no se le suelta al guion viejo: en la corrida real del
   8-sep (escenario b) «sí, ese mismo día regresamos» después del precio
   se leyó como destino «a Regresamos» y el siguiente «ok» mandó un segundo
   ticket. Se contesta algo neutro y cierto. */
function esperaNeutraConPrecio(cliente, estado) {
  const v = viajeConPrecio(tickets.fichaDe(cliente));
  if (!v || !v.estado) return null;
  if (v.estado === 'pedido') return 'Va 🙌 En cuanto tenga tu precio te lo paso por aquí.';
  /* Con el precio dado pero el viaje cambiado (creció el grupo, ya no cabe
     la unidad), «¿te la aparto?» ofrece un precio que ya no es el suyo
     (corrida real del 9-sep-2026, escenario k): se pregunta lo que falta. */
  if (estado && conversacion.loQueFalta(estado)) return preguntaParaElCliente(estado);
  return 'Va 🙌 ¿Te la aparto?';
}

/* El mismo viaje que ya está pedido: destino, fechas y (gente o unidad)
   iguales. Un segundo viaje distinto (Mazamitla con Vallarta pendiente) sí
   manda su propio ticket. */
function mismoViaje(a, b) {
  if (!a || !b) return false;
  const n = function (x) { return conversacion.normaliza(String(x || '')); };
  if (n(a.destino) !== n(b.destino)) return false;
  if (String(a.salida || '') !== String(b.salida || '')) return false;
  if (String(a.regreso || '') !== String(b.regreso || '')) return false;
  if (a.gente && b.gente && Number(a.gente) !== Number(b.gente)) return false;
  const ua = n(a.unidadNombre || a.unidad), ub = n(b.unidadNombre || b.unidad);
  if (ua && ub && ua !== ub && ua !== 'autobus' && ub !== 'autobus') return false;
  return true;
}

/* «Te paso el precio en un momento» con datos que faltan es un callejón:
   nadie pregunta lo que falta y el ticket nunca sale (corrida real del
   8-sep, escenario c: 30 a Mazatlán, tres veces «te paso el precio», cero
   tickets). Si promete el precio y falta algo, sale la pregunta del guion. */
const PROMETE_PRECIO = /te (paso|mando|doy|saco) (el|tu|la) (precio|cotizaci[oó]n)|en un momento te (paso|mando)|te lo (paso|mando|cotizo) en un momento|ahorita te (paso|mando|cotizo)/i;

/* ------------------------------------------------------------
   NADA INTERNO LE LLEGA A UN CLIENTE
   ------------------------------------------------------------
   Instrucciones para la IA, nombres de campos, plantillas sin llenar.
   El 7-sep-2026 un cliente recibió «Pregunta EXACTAMENTE eso… datos.origen
   = "Guadalajara"». Este candado está en `manda`, la única puerta de
   salida, para que no dependa de quién armó el texto.
   ------------------------------------------------------------ */
/* Las marcas y los fragmentos del prompt viven en _agente.js
   (`esTextoInterno`), para que la entrada (`sanea`) y la salida (`manda`)
   frenen exactamente lo mismo. Aquí solo se suman las frases del guion. */

/* Y, además de las marcas, las FRASES MISMAS que `loQueFalta` le dice a la
   IA, sacadas del guion en vivo (no copiadas a mano): si mañana alguien
   cambia esas frases, el candado cambia solo. Se piden con estados de
   mentiras, uno por paso. */
const FRASES_PARA_LA_IA = (function () {
  const frases = [];
  const estados = [
    {},
    { destino: 'Puerto Vallarta' },
    { destino: 'Puerto Vallarta', salida: '2026-10-10' },
    { destino: 'Tequila', salida: '2026-10-10' },
    { destino: 'Puerto Vallarta', salida: '2026-10-10', regreso: '2026-10-12' },
    { destino: 'Puerto Vallarta', salida: '2026-10-10', regreso: '2026-10-12', gente: 45, unidad: 'autobus' },
    { destino: 'Puerto Vallarta', salida: '2026-10-10', regreso: '2026-10-12', gente: 12 },
    { destino: 'Puerto Vallarta', salida: '2026-10-10', regreso: '2026-10-12', gente: 12, origen: 'Guadalajara' }
  ];
  estados.forEach(function (e) {
    try {
      const t = conversacion.loQueFalta(e);
      if (typeof t === 'string' && t.trim().length >= 20) frases.push(t.trim().toLowerCase().slice(0, 60));
    } catch (err) { /* sin frase para ese estado */ }
  });
  return frases;
})();

function esTextoInterno(texto) {
  const t = String(texto || '');
  if (!t) return false;
  if (agente.esTextoInterno(t)) return true;
  const bajo = t.toLowerCase();
  return FRASES_PARA_LA_IA.some(function (f) { return bajo.indexOf(f) >= 0; });
}

/* Si la IA nombró un autobús con menos asientos que el grupo, su respuesta
   se cambia por la lista del guion con los que SÍ caben. Solo cuando ya se
   sabe cuántos son, son más de 20 y todavía no escogieron camión. */
function sinAutobusesQueNoCaben(respuesta, estado) {
  const gente = Number(estado && estado.gente) || 0;
  if (!respuesta || (estado && estado.unidadNombre)) return respuesta;
  const texto = String(respuesta).toLowerCase();
  const nombraUnAutobus = (conversacion.UNIDADES || []).some(function (u) {
    return u.cat === 'autobus' && u.name && texto.indexOf(String(u.name).toLowerCase()) >= 0;
  });
  if (!nombraUnAutobus) return respuesta;
  /* En el paso de escoger autobús, la lista es la del dueño (6-sep-2026:
     «no le digas de baño, puerta ni nada; solo qué calidad es y cuántos
     asientos»; 7-sep: primero los que caben). En la corrida real del 8-sep
     (escenario c) la IA recomendó dos con «baño, dos puertas, reclinables».
     Si toca escoger y la IA nombró camiones a su manera, sale la lista. */
  const toca = /cu[aá]l autob[uú]s/.test(String(conversacion.loQueFalta(estado) || ''));
  if (toca && !/se ajustan a la capacidad|Estos son los autobuses que tenemos/.test(String(respuesta))) {
    return preguntaParaElCliente(estado);
  }
  if (gente <= 20) return respuesta;
  /* Dictado del dueño, 7-sep-2026: primero los que caben («se ajustan a la
     capacidad»), y hasta el final los que no, como otras opciones. Si la IA
     nombró autobuses en el paso de elegir, sale el mensaje del guion, con
     el orden y las frases exactas, y no la versión de la IA. */
  const grupos = conversacion.autobusesPara(gente);
  if (!grupos.caben.length) return conversacion.mensajeDeAutobuses(gente);
  const bienOrdenado = grupos.noCaben.every(function (renglon) {
    /* «Irizar i6» es prefijo de «Irizar i6S»: se busca el nombre completo,
       sin letra ni número pegados después. */
    const nombre = renglon.split(' — ')[0].toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const donde = texto.search(new RegExp(nombre + '(?![a-z0-9])'));
    return donde < 0 || (texto.indexOf('no caben') >= 0 && donde > texto.indexOf('no caben'));
  });
  return bienOrdenado ? respuesta : conversacion.mensajeDeAutobuses(gente);
}

/* ------------------------------------------------------------
   «QUIERO UN CAMIÓN» / «¿QUÉ CAMIONES TIENEN?» · SE ENSEÑAN LAS OPCIONES
   ------------------------------------------------------------
   Prueba del dueño (8-sep-2026, 6:22 p.m.): «salimos pasado y quiero un
   camión» → «¿cuántos van?»; «camion» → «¿cuántos van?»; «que camiones
   tiene?» → «depende de cuántos van». Tres veces pidió ver autobuses y
   tres veces se le negó por no decir cuántos son. Dictado: «si el
   cliente quiere camiones ofrécele opciones, no hay problema».

   Si el cliente pidió autobuses y la IA no nombró ninguno, sale la
   lista del catálogo (todos, o los que le caben si ya se sabe cuántos
   son). Lo decide el código: el prompt también lo dice, pero la IA ya
   demostró que se aferra a la pregunta.
   ------------------------------------------------------------ */
/* Se compara SIN acentos y con dedazos: la primera versión buscaba
   «camion» y el dueño escribió «camión» (6:36 p.m.) y «que camines
   tiene?» (6:22): ninguno entró. `normaliza` quita tildes y baja a
   minúsculas; `camion\w*` cubre camiones/camioncito, `camines` el dedazo. */
const PIDE_AUTOBUSES = /\b(camion\w*|camines|camio\b|autobus\w*|bus(es)?|que unidades|unidades tienen|opciones de (camion|autobus))\b/;
function pideAutobuses(textoDelCliente) {
  return PIDE_AUTOBUSES.test(conversacion.normaliza(textoDelCliente));
}
function conLosAutobusesQuePidio(respuesta, textoDelCliente, estado) {
  if (!pideAutobuses(textoDelCliente)) return respuesta;
  if (estado && estado.unidadNombre) return respuesta;
  const texto = String(respuesta || '').toLowerCase();
  const nombraUnAutobus = (conversacion.UNIDADES || []).some(function (u) {
    return u.cat === 'autobus' && u.name && texto.indexOf(String(u.name).toLowerCase()) >= 0;
  });
  if (nombraUnAutobus) return respuesta;
  return conversacion.mensajeDeTodosLosAutobuses(estado && estado.gente);
}

/* Qué viaje de la ficha ya está en precio: pedido (espera el «va» del
   dueño) o dado. En una línea, sin cifras: la IA no debe repetir montos. */
/* ------------------------------------------------------------
   «¿Y ENTRE 20?» · EL REPARTO POR PERSONA LO HACE EL MOTOR
   ------------------------------------------------------------
   Con el precio ya dado, el cliente pregunta cuánto sale entre otro
   número de personas. El total no cambia (se cobra por unidad, no por
   cabeza); cambia la cuenta. Si el grupo nuevo ya no cabe en la unidad,
   no es una cuenta: es otra cotización, y se le ofrece.

   Solo mensajes cortos con un número y una palabra de grupo; una fecha
   («para el 20») no es gente. Y solo si NO va otro viaje en la plática.
   ------------------------------------------------------------ */
const PIDE_REPARTO = /\b(?:entre|si\s+somos|si\s+fu[eé]ramos|si\s+vamos|somos|para|con|de)\s+(\d{1,3})\b|\b(\d{1,3})\s+(?:personas|pax|gentes?|pasajeros)\b/i;
const ETAPAS_CON_PRECIO = ['con_precio', 'va_a_apartar', 'mando_comprobante', 'datos_del_contrato', 'contrato_listo'];

function unidadDelCatalogo(x) {
  const clave = String(x || '').trim().toLowerCase();
  if (!clave) return null;
  return (conversacion.UNIDADES || []).find(function (u) {
    return String(u.id).toLowerCase() === clave || String(u.name || '').toLowerCase() === clave;
  }) || null;
}

function repartoPorPersona(texto, cliente, ficha, antes) {
  const t = String(texto || '').trim();
  if (!ficha || !ficha.viajeDatos || typeof ficha.total !== 'number' || ficha.total <= 0) return null;
  if (ETAPAS_CON_PRECIO.indexOf(ficha.etapa) < 0) return null;
  if (antes && (antes.destino || antes.salida)) return null;
  if (t.length > 70) return null;
  const m = t.match(PIDE_REPARTO);
  /* «¿Y cuánto sale por persona?» sin número: la misma respuesta, con la
     gente del viaje (Falla 3: el motor contesta, la IA no divide). */
  const pideCabeza = /por (persona|cabeza)|cada (uno|quien)|c\/u/i.test(t);
  if (!m && !pideCabeza) return null;
  const n = m ? Number(m[1] || m[2]) : Number(ficha.viajeDatos.gente) || 2;
  if (!n || n < 2 || n > 120) return null;
  /* Solo si habla de gente: «para 3 días» o «con 2 paradas» no son personas
     (auditoría general del 8-sep, hallazgo 13). */
  const hablaDeGente = /persona|pax|gente|pasajero|somos|entre|fu[eé]ramos|cabeza|cada (uno|quien)|c\/u/i.test(t);
  if (!hablaDeGente) return null;
  /* ------------------------------------------------------------
     «YA SOMOS 22» NO ES UNA PREGUNTA POR PERSONA: ES UN CAMBIO
     ------------------------------------------------------------
     Corrida real del 9-sep-2026 (escenario k): el cliente creció el grupo y
     el motor lo contestó como si preguntara cuánto sale entre 22, dejando
     el viaje —y el precio— como estaban. Un cambio lo toma el agente, que
     sí actualiza el viaje y marca el precio como vencido. Una pregunta
     hipotética («¿y entre 30?», «¿si fuéramos 25?») sigue aquí.
     ------------------------------------------------------------ */
  const dicho = conversacion.normaliza(t);
  const esCambio = /\b(ya|ahora|al final|finalmente)\s+(somos|vamos a ser|seremos)\b|\bseremos\b|\bvamos a ser\b/.test(dicho);
  const pregunta = /\?|cuanto|cuánto|precio|sale|cuesta|queda|seria|ser[ií]a/.test(dicho);
  if (esCambio && !pregunta) return null;
  if (/\b\d{1,3}\s*(d[ií]as?|paradas?|horas?|noches?|de\s+[a-záéíóú])\b/i.test(t)) return null;
  const v = ficha.viajeDatos;
  const unidad = unidadDelCatalogo(v.unidad);
  const max = unidad ? Number(unidad.max) : 0;
  const nombre = unidad ? unidad.name : String(v.unidad || 'la unidad');
  const pesos = function (x) { return '$' + Math.round(x).toLocaleString('en-US'); };
  if (max && n > max) {
    return {
      texto: 'Para ' + n + ' ya no caben en ' + nombre + ' (es hasta ' + max + '). Para ese grupo va autobús y es ' +
        'otra cotización; ¿te la saco para ' + n + '?',
      /* La plática arranca con el viaje ya sabido y la gente nueva: al «sí»
         solo falta escoger autobús. */
      estado: { destino: v.destino, origen: v.origen, salida: v.salida, regreso: v.regreso, gente: n }
    };
  }
  /* Una pregunta hipotética NO cambia el viaje: la ficha (y el contrato que
     se sube a EuroSystem) se quedan con la gente original (auditoría general
     del 8-sep, hallazgo 4). Y SIN dividir (dictado del dueño, 8-sep-2026,
     reparación Falla 3): el precio es total, por unidad; cómo lo repartan
     entre ellos es cosa suya. */
  return {
    texto: 'El precio es por la unidad, no por persona: el total es *' + pesos(ficha.total) + '* para todo el grupo' +
      (max ? ' (' + nombre + ' es hasta ' + max + ')' : '') + '. Cómo lo repartan entre ustedes es cosa suya. ¿Te la aparto?',
    estado: null
  };
}

/* ------------------------------------------------------------
   FILTRO DE SALIDA (reparación del 8-sep-2026, Falla 4)
   ------------------------------------------------------------
   Devuelve el motivo si el texto NO debe salir hacia un cliente, o ''.
   Forma de código o JSON (```, llaves, <>), rastros de herramientas o
   del prompt, errores del programa, rutas de archivo, o un largo fuera
   de lo humano: la IA ya viene recortada a 480; los textos del motor
   (precio con apartado, lista de autobuses) llegan a ~700, así que el
   tope general es 1200 y para lo que escribió la IA, 600.
   ------------------------------------------------------------ */
const FORMA_DE_CODIGO = /```|[{}<>]|\btool_(use|result)\b|\bfunction\b|\bsystem prompt\b|\bprompt\b|\binstrucciones del (agente|sistema)\b|\bException\b|\bundefined\b|\bnull\b|\bNaN\b|\/api\/|\.(m?js|json|ts)\b|\bError:|\bTypeError\b|\bReferenceError\b|\bstack\b/i;
function filtrarSalida(texto, escribio) {
  const t = String(texto || '');
  const m = t.match(FORMA_DE_CODIGO);
  if (m) return 'forma de código o error: «' + m[0] + '»';
  const deLaIA = /agente/.test(String(escribio || ''));
  if (deLaIA && t.length > 600) return 'texto de la IA demasiado largo (' + t.length + ')';
  if (t.length > 1200) return 'texto demasiado largo (' + t.length + ')';
  return '';
}

/* ------------------------------------------------------------
   LOS DATOS DE DEPÓSITO LOS ESCRIBE EL CÓDIGO (reparación 8-sep, Falla 6)
   ------------------------------------------------------------
   La CLABE, el banco y el beneficiario viven en UN lugar: las variables
   `CLABE` y `DATOS_BANCARIOS` de Vercel (la imagen de la ficha bancaria
   sigue en img/ficha-bancaria.png). El modelo nunca la ve ni la escribe:
   el código arma el bloque y lo pega al precio y a cualquier respuesta
   donde el cliente quiera apartar. El apartado es el anticipo que ya
   calculó el motor (20 % a múltiplos de $500, como está estipulado).
   ------------------------------------------------------------ */
function clabeConfigurada() {
  const c = String(process.env.CLABE || '').replace(/\D+/g, '');
  return c.length === 18 ? c : '';
}
function cuentaConfigurada() {
  return String(process.env.CUENTA || '').replace(/\D+/g, '');
}
/* El texto del apartado NO lleva la CLABE adentro: la CLABE y el número de
   cuenta van cada uno en su propio mensaje, pelones, para copiarlos con un
   toque largo (dictado del dueño, 8-sep-2026). */
function bloqueApartado(precio) {
  const clabe = clabeConfigurada();
  if (!clabe || !precio || typeof precio.anticipo !== 'number' || precio.anticipo <= 0) return '';
  const datos = String(process.env.DATOS_BANCARIOS || '').replace(/\s+/g, ' ').trim();
  return 'Si gustas apartar, son *$' + precio.anticipo.toLocaleString('en-US') + '* de apartado' +
    (datos ? ' (' + datos + ')' : '') + '. Abajo te van los datos para depositar.\n' +
    'Cuando deposites, mándame tu comprobante por aquí.';
}
/* Lo que sigue al bloque: la imagen de la ficha (dictado del dueño,
   8-sep-2026: «esa imagen bonita» primero) y después la CLABE y la cuenta,
   pelonas, cada una en su mensaje, para copiarlas con un toque largo. */
function mensajesParaCopiar(numeroDeOrigen, para) {
  const lista = [];
  const sitio = String(process.env.SITIO_URL || '').replace(/\/+$/, '');
  if (sitio && process.env.FICHA_COMO_IMAGEN !== '0') {
    lista.push({ numeroDeOrigen: numeroDeOrigen, para: para, ligaDeFoto: sitio + '/img/ficha-bancaria.png',
      texto: 'Aquí están los datos 👆 Abajo te van la CLABE' + (cuentaConfigurada() ? ' y la cuenta' : '') +
        ', cada una en su mensaje: déjala apretada para copiarla.',
      pasaAPersona: false, escribio: '[ficha bancaria]' });
  }
  if (clabeConfigurada()) lista.push({ numeroDeOrigen: numeroDeOrigen, para: para, texto: clabeConfigurada(), pasaAPersona: false, escribio: '[clabe para copiar]' });
  if (cuentaConfigurada()) lista.push({ numeroDeOrigen: numeroDeOrigen, para: para, texto: cuentaConfigurada(), pasaAPersona: false, escribio: '[cuenta para copiar]' });
  return lista;
}

/* ------------------------------------------------------------
   LOS DATOS DE DEPÓSITO VAN UNA VEZ POR VUELTA
   ------------------------------------------------------------
   El 8-sep-2026 la IA contestó «te paso los datos» Y pidió la acción de
   apartar: cada camino mandó su juego de ficha + CLABE + cuenta, y el
   cliente los recibió dos veces seguidas. Se anota a quién ya se le
   mandaron en ESTE aviso y no se repiten.
   ------------------------------------------------------------ */
const depositoMandadoAhora = new Set();
const MARCAS_DE_DEPOSITO = /\[(ficha bancaria|clabe para copiar|cuenta para copiar|datos de depósito)\]/;

/* Nota del 9-sep-2026, para no volver a «arreglarlo»: en la corrida real,
   el cliente recibió la ficha + CLABE + cuenta pegadas al precio y al
   contestar «apártamelo» le llegaron otra vez, cuatro mensajes seguidos.
   Se probó frenarlo y rompió diez pruebas: el dueño dictó el 8-sep que los
   datos se repiten CADA VEZ que el cliente pida apartar o pregunte por la
   cuenta. La regla manda; queda anotado por si él quiere cambiarla. */

/* ------------------------------------------------------------
   «LO QUE YA HICE» · las acciones del bot, para que el modelo las vea
   ------------------------------------------------------------
   El modelo no recuerda lo que mandó; solo sabe lo que está en el
   contexto de este turno (reparación del 8-sep-2026, Fallas 1 y 2).
   ------------------------------------------------------------ */
const ETAPAS_DESPUES_DEL_PRECIO = ['con_precio', 'va_a_apartar', 'mando_comprobante', 'datos_del_contrato', 'contrato_listo'];
function loQueYaHice(ficha, antes) {
  const h = [];
  const vistas = ((antes && Array.isArray(antes.fotosVistas)) ? antes.fotosVistas : [])
    .concat((ficha && Array.isArray(ficha.fotos)) ? ficha.fotos : [])
    .filter(function (id, i, lista) { return lista.indexOf(id) === i; });
  vistas.forEach(function (id) {
    const u = unidadDelCatalogo(id);
    h.push('mandé fotos de ' + ((u && u.name) || id) + ' (no las vuelvas a mandar)');
  });
  if (ficha && ficha.viajeDatos && ficha.viajeDatos.fotoMandada && !vistas.length) h.push('mandé la foto de la unidad');
  const e = ficha && ficha.etapa;
  if (e === 'pidio_precio') h.push('pedí el precio al vendedor; el cliente ya recibió «en breve te paso tu cotización»');
  if (ETAPAS_DESPUES_DEL_PRECIO.indexOf(e) >= 0) h.push('entregué el precio total con el monto de apartado y la CLABE (el sistema los anexa; tú no escribas cuentas)');
  if (['va_a_apartar', 'mando_comprobante', 'datos_del_contrato', 'contrato_listo'].indexOf(e) >= 0) h.push('el cliente ya pidió apartar: le mandé otra vez el apartado y la CLABE');
  if (['mando_comprobante', 'datos_del_contrato', 'contrato_listo'].indexOf(e) >= 0) h.push('recibí su comprobante; se están juntando los datos del contrato');
  if (e === 'contrato_listo') h.push('el contrato está completo; falta confirmar el pago');
  return h;
}

/* En qué va el depósito, en palabras para la IA (bloque «Depósito»). */
function estadoDelDeposito(ficha) {
  const e = ficha && ficha.etapa;
  if (!e || ['escribio', 'cotizando', 'pidio_precio'].indexOf(e) >= 0) return null;
  if (e === 'con_precio') return 'no ha llegado el comprobante (si quiere apartar, acción "apartar")';
  if (e === 'va_a_apartar') return 'dijo que aparta, pero NO ha llegado el comprobante (si vuelve a pedir la cuenta, acción "apartar")';
  if (e === 'mando_comprobante' || e === 'datos_del_contrato') return 'ya mandó su comprobante (lo revisa una persona); se están juntando los datos del contrato';
  if (e === 'contrato_listo') return 'comprobante recibido y datos del contrato completos; falta confirmar el pago';
  return null;
}

/* Parecido entre dos textos (0 a 1): coeficiente de Dice sobre palabras,
   sin acentos ni signos. «Perfecto. ¿Qué día salen?» contra «Perfecto, ¿qué
   día salen?» da 1; dos preguntas distintas dan menos de 0.5. */
function parecido(a, b) {
  const bolsa = function (t) {
    return String(t || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9ñ\s]/g, ' ').split(/\s+/).filter(function (w) { return w.length > 1; });
  };
  const x = bolsa(a), y = bolsa(b);
  if (!x.length || !y.length) return 0;
  const cuenta = new Map();
  x.forEach(function (w) { cuenta.set(w, (cuenta.get(w) || 0) + 1); });
  let comunes = 0;
  y.forEach(function (w) { const n = cuenta.get(w) || 0; if (n > 0) { comunes++; cuenta.set(w, n - 1); } });
  return (2 * comunes) / (x.length + y.length);
}

/* ¿La respuesta pregunta un dato que YA está en el estado? Devuelve el
   campo, o null. */
const PREGUNTA_DE = {
  destino: /a d[oó]nde (van|va el plan|se van|quieren ir)|qu[eé] destino|para d[oó]nde/i,
  salida: /qu[eé] d[ií]a salen|cu[aá]ndo salen|fecha de salida|qu[eé] fecha (salen|ser[ií]a)|para qu[eé] d[ií]a/i,
  regreso: /cu[aá]ndo (regresan|vuelven)|qu[eé] d[ií]a (regresan|vuelven)|ida y vuelta el mismo d[ií]a/i,
  gente: /cu[aá]ntos (van|son|ser[ií]an|viajan|crees|creen|calculas|piensas|m[aá]s o menos)|cu[aá]ntas personas|n[uú]mero (aproximado )?de (gente|personas|pasajeros)|el n[uú]mero de gente|cuando tengas (el|m[aá]s o menos el) n[uú]mero/i,
  origen: /de d[oó]nde salen|salen de la zona metropolitana/i,
  nombre: /c[oó]mo te llamas|cu[aá]l es tu nombre|me dices tu nombre/i
};
function preguntaRepetida(respuesta, estado) {
  const t = String(respuesta || '');
  const e = estado || {};
  return Object.keys(PREGUNTA_DE).find(function (k) {
    return e[k] !== undefined && e[k] !== null && e[k] !== '' && PREGUNTA_DE[k].test(t);
  }) || null;
}

/* Un «sí» a secas, con sus variantes tapatías, sin un «no» ni un dato al
   lado: «si», «sí», «simón», «claro», «así es», «el mismo día». */
function esUnSiSeco(texto) {
  const t = conversacion.normaliza(texto).replace(/[!.,;:¡¿?]/g, ' ').trim();
  if (!t || /\bno\b/.test(t) || t.length > 40) return false;
  return /^(si|sip|simon|claro( que si)?|asi es|exacto|correcto|ese mismo( dia)?|el mismo dia|mismo dia|ida y vuelta( el mismo dia)?|si el mismo dia|si mismo dia|si es ida y vuelta)$/.test(t);
}
/* Lo dice él solo: «ida y vuelta el mismo día», «regresamos ese mismo
   día», «salimos y nos venimos el mismo día». No entra si trae otra fecha
   («ida y vuelta, regresamos el 13») ni si lo niega. */
const DICE_MISMO_DIA = /\b(ida y vuelta el mismo dia|el mismo dia (de |nos )?(regresamos|venimos|volvemos|regreso)|regresamos (ese |el )?mismo dia|nos venimos (ese |el )?mismo dia|volvemos (ese |el )?mismo dia|(salimos|vamos) y (regresamos|nos venimos|volvemos) el mismo dia|ida y vuelta( el)? mismo dia|es el mismo dia)\b/;

/* «Sí, de guadalajara»: un sí con cola (corrida real del 8-sep-2026,
   escenario f). Cuenta como sí mientras no traiga un «no» ni una fecha ni
   hable del regreso: «sí, pero regresamos el 13» no es el mismo día. */
function empiezaConSi(texto, hoy) {
  const t = conversacion.normaliza(texto).replace(/[!.,;:¡¿?]/g, ' ').trim();
  if (!t || /\bno\b/.test(t) || /regres|vuelv|nos quedamos|otro dia/.test(t)) return false;
  if (!/^(si|sip|simon|claro|asi es|exacto)\b/.test(t)) return false;
  try { if (conversacion.fechaDe(texto, hoy)) return false; } catch (e) { /* sin fecha */ }
  return true;
}

/* Dos «Perfecto.» seguidos suenan a máquina (regla del prompt que la IA
   no siempre cumple; prueba del dueño 8-sep-2026, 6:58 p.m.). Si la
   respuesta abre con la misma muletilla que el último mensaje del bot, se
   le quita la muletilla. */
const MULETILLA = /^(perfecto|va|claro|dale|listo|sale|genial|excelente|ok|okey|entendido|de acuerdo)\s*[.,!:]\s*/i;
function sinMuletillaRepetida(respuesta, ultimoTextoDelBot) {
  const r = String(respuesta || '');
  const a = r.match(MULETILLA);
  const b = String(ultimoTextoDelBot || '').match(MULETILLA);
  if (!a || !b || a[1].toLowerCase() !== b[1].toLowerCase()) return r;
  const resto = r.slice(a[0].length).trim();
  if (!resto) return r;
  return resto.charAt(0).toUpperCase() + resto.slice(1);
}

/* Con un autobús ya escogido, «¿cuántos van?» sobra (dictado del dueño,
   8-sep-2026: «puedo rentar un i6 sin que responda cuántos somos»). La IA
   lo preguntó igual después de «i6»; se trata como pregunta repetida: se
   regenera una vez y, si insiste, contesta el guion con lo que falta. */
function preguntaQueSobra(respuesta, estado, ficha) {
  const e = estado || {};
  const busEscogido = e.unidad === 'autobus' && e.unidadNombre;
  if ((busEscogido || e.sinCuenta) && !e.gente && PREGUNTA_DE.gente.test(String(respuesta || ''))) return 'gente';
  /* Antes del depósito no se pregunta hora, dirección ni nombre: eso son
     datos del contrato y se piden con el comprobante en mano (dictado del
     dueño, 8-sep-2026). En la corrida real del 9-sep la IA preguntó «¿a qué
     hora les viene bien salir?» con el precio apenas pedido. */
  const sinComprobante = !ficha || ['mando_comprobante', 'datos_del_contrato', 'contrato_listo'].indexOf(ficha.etapa) < 0;
  if (sinComprobante && ANTES_DEL_DEPOSITO.test(String(respuesta || ''))) return 'datos del contrato';
  return null;
}
/* «¿Y para el sábado de mayo que viene tienen?» con un viaje ya cotizado no
   es ese viaje: es otra fecha, otro viaje. En la corrida real del 9-sep-2026
   se leyó como el mismo y el cliente recibió «¿Te saco el precio?». Se pide
   una palabra de disponibilidad Y una fecha en el mismo mensaje. */
const DIA_O_MES = '(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|setiembre|octubre|noviembre|diciembre|lunes|martes|miercoles|jueves|viernes|sabado|domingo|\\d{1,2}\\s*(de|\\/|-))';
const HAY_LUGAR = '(tienen|tendrian|tendran|hay|queda|quedan|alcanza|alcanzan|disponib\\w*|libre|libres)';
const OTRA_FECHA_DISPONIBLE = new RegExp(
  '\\b' + HAY_LUGAR + '\\b[^?]{0,40}\\b' + DIA_O_MES + '|\\b' + DIA_O_MES + '[^?]{0,40}\\b' + HAY_LUGAR + '\\b');

/* Lo que NO se pregunta antes del comprobante. Se busca la PREGUNTA, no la
   palabra: «salen a las 7» dicho por el cliente no es esto. */
const ANTES_DEL_DEPOSITO = /¿[^?]*\b(a qu[eé] hora|qu[eé] hora|hora (les|te|de) (viene|acomoda|conviene|salida)|de d[oó]nde los recog|direcci[oó]n exacta|en qu[eé] direcci[oó]n|c[oó]mo te llamas|cu[aá]l es tu nombre|nombre completo)\b[^?]*\?/i;

/* «Todavía no sé cuántos vamos», «apenas estoy juntando gente»: es un dato,
   no una evasiva. Se marca en la plática y no se le vuelve a pedir
   (corrida real del 8-sep-2026, escenario g). */
const NO_SABE_CUANTOS = /\b(no s[eé]|no sabemos|no tengo|todav[ií]a no|a[uú]n no|ni idea)\b[^.?!]{0,30}\b(cu[aá]nt[oa]s|el n[uú]mero|la cantidad|cu[aá]nta gente)|\bapenas (estoy|estamos|ando|andamos) (juntando|armando|organizando|viendo)|\bno s[eé] cu[aá]ntos\b/;
function diceQueNoSabeCuantos(texto) {
  return NO_SABE_CUANTOS.test(conversacion.normaliza(texto));
}
const NO_SE_MUEVEN = /\b(solo|nomas|nada mas|unicamente|puro) (nos |que nos )?(lleven|llevan|llevar|traigan|traen|dejen|dejan)\b|\bllevar y traer\b|\bnos llevan y (nos )?traen\b|\bnos dejan y (nos )?recogen\b|\bno (nos vamos a|vamos a|nos) mover\b|\bsin recorridos\b|\bno ocupamos (la unidad|el camion|la camioneta) alla\b|\bida y vuelta nada mas\b/;
function diceQueNoSeMueven(texto) {
  return NO_SE_MUEVEN.test(conversacion.normaliza(texto));
}

/* «Ese», «ése», «el mismo», «el que dices» después de que el bot nombró UN
   solo autobús (corrida real, escenario g: «el más nuevo cuál es?» → «el
   Marcopolo G8…» → «y ese cuánto sale?»). Eso es escogerlo. */
function unicoAutobusEnTexto(texto) {
  /* Por alias («el G8», «i6S», «Neobus»), no por nombre completo: en la
     corrida real el bot dijo «El G8, modelo 2026» y con el nombre completo
     no enganchaba. */
  const ids = agente.unidadesEnTexto ? agente.unidadesEnTexto(texto) : [];
  const buses = ids.map(function (id) {
    return (conversacion.UNIDADES || []).find(function (u) { return u.id === id && u.cat === 'autobus'; });
  }).filter(Boolean);
  return buses.length === 1 ? buses[0] : null;
}
const SENALA_ESE = /\b(ese|esa|[eé]se|[eé]sa|este|esta|el mismo|la misma|el que dices|el que me dices|el que mencionas)\b/;

/* El viaje que ya está en precio (pedido o dado), como estado de plática:
   para sembrarlo cuando el cliente cambia UNA cosa después del precio. */
function viajeBaseDeLaFicha(ficha) {
  if (!ficha) return null;
  const v = (ficha.porConfirmar && ficha.porConfirmar.resumen) || ficha.viajeDatos;
  if (!v || !v.destino) return null;
  const base = { destino: v.destino, origen: v.origen || null, salida: v.salida || null, regreso: v.regreso || null,
    gente: v.gente || null, ocasion: v.ocasion || null };
  if (typeof v.recorridos === 'number') base.recorridos = v.recorridos;
  if (v.nombre) base.nombre = v.nombre;
  const u = unidadDelCatalogo(v.unidadNombre || v.unidad);
  if (u) { base.unidad = u.cat; base.unidadNombre = u.name; if (u.cat === 'autobus') base.unidadId = u.id; }
  else if (v.unidad) base.unidad = String(v.unidad).toLowerCase();
  Object.keys(base).forEach(function (k) { if (base[k] === null) delete base[k]; });
  return base;
}

/* Un cambio de fecha (salida o regreso) sobre un viaje que YA tiene precio
   dado, dicho en una plática sin otro viaje a medias. */
function cambioDeFechaConPrecio(ficha, datos, antes, otroViaje) {
  if (!ficha || !ficha.viajeDatos || typeof ficha.total !== 'number' || ficha.total <= 0) return null;
  if (ETAPAS_CON_PRECIO.indexOf(ficha.etapa) < 0) return null;
  if (antes && (antes.destino || antes.salida)) return null;
  const d = datos || {};
  const v = ficha.viajeDatos;
  /* ------------------------------------------------------------
     UN VIAJE NUEVO NO ES UN CAMBIO DE FECHA
     ------------------------------------------------------------
     Corrida real del 9-sep-2026 (escenario q): con el viaje a Tequila ya
     cotizado, «y aparte quiero cotizar otro a San Juan de los Lagos el 24»
     se leyó como que quería mover la fecha del de Tequila, y el cliente
     recibió «déjame checar ese cambio». El segundo viaje se perdió.
     Si lo dijo como otro viaje, o si el destino que trae es OTRO, no es
     un cambio: es una cotización nueva.
     ------------------------------------------------------------ */
  if (otroViaje) return null;
  if (d.destino && v.destino &&
      conversacion.normaliza(d.destino) !== conversacion.normaliza(v.destino)) return null;
  const pide = [];
  if (d.salida && v.salida && d.salida !== v.salida) pide.push('salida ' + tickets.comoSeDice(d.salida));
  if (d.regreso && v.regreso && d.regreso !== v.regreso) pide.push('regreso ' + tickets.comoSeDice(d.regreso));
  if (!pide.length) return null;
  const resumen = (v.origen ? v.origen + ' → ' : '') + (v.destino || '') + ' · ' + (v.salida || '') +
    (v.regreso ? ' al ' + v.regreso : '') + (v.gente ? ' · ' + v.gente + ' personas' : '') + (v.unidad ? ' · ' + v.unidad : '');
  return { resumen: resumen, pide: pide.join(', ') };
}

function viajeConPrecio(ficha) {
  if (!ficha) return null;
  const pedido = ficha.porConfirmar && ficha.porConfirmar.resumen;
  const dado = !pedido && ficha.viajeDatos &&
    ['con_precio', 'va_a_apartar', 'mando_comprobante', 'datos_del_contrato', 'contrato_listo']
      .indexOf(ficha.etapa) >= 0;
  const r = pedido || (dado ? ficha.viajeDatos : null);
  const enLinea = function (v) {
    const partes = [];
    if (v.destino) partes.push((v.origen ? v.origen + ' → ' : '') + v.destino);
    if (v.salida) partes.push(v.salida + (v.regreso ? ' al ' + v.regreso : ''));
    if (v.gente) partes.push(v.gente + ' personas');
    if (v.unidad) partes.push(String(v.unidad));
    return partes.join(' · ');
  };
  /* Los anteriores, sin cifras: la IA no repite montos. */
  const anteriores = (ficha.viajes || []).map(function (v) {
    return enLinea(v) + (v.estado ? ' (' + v.estado + ')' : '');
  });
  if (!r) return anteriores.length ? { estado: null, resumen: null, anteriores: anteriores } : null;
  return { estado: pedido ? 'pedido' : 'dado', resumen: enLinea(r), anteriores: anteriores };
}

async function loQueDiceElAgente(envio) {
  if (!process.env.ANTHROPIC_API_KEY) return false;
  const hoy = hoyDePrueba() || conversacion.hoyISO();
  if (!hayCupoDeIA(hoy)) return false;
  const cliente = envio.para;
  const texto = envio.crudoDelCliente;

  /* La memoria corta: del almacén si esta instancia no la tiene. */
  if (!agente.historialDe(cliente).length && almacen.hayAlmacen()) {
    const filas = await almacen.mensajesDe(cliente, 10).catch(function () { return null; });
    if (Array.isArray(filas)) {
      agente.siembraHistorial(cliente, filas.slice().reverse().map(function (f) {
        return { de: f.de === 'cliente' ? 'cliente' : 'bot', texto: f.texto };
      }));
    }
  }

  let antes = envio.estadoAntes && typeof envio.estadoAntes === 'object' ? envio.estadoAntes : {};
  /* El viaje que ya tiene precio pedido o dado vive en la ficha, no en la
     plática (que se cierra al pedirlo). Se le cuenta a la IA para que no
     vuelva a preguntar «¿a dónde van?» después de «ok», y para que si el
     cliente quiere OTRO viaje, lo tome de cero. */
  const viajeDeLaFicha = viajeConPrecio(tickets.fichaDe(cliente));
  /* Una plática que quedó en «confirmar» con el precio ya pedido es un
     residuo del defecto del 7-sep-2026 (las guardadas antes del arreglo
     viven hasta siete días en el almacén). Se descarta: si no, ese cliente
     recibiría una espera y un ticket más. */
  if (viajeDeLaFicha && antes.paso === 'confirmar') antes = {};
  /* ------------------------------------------------------------
     «¿…EL MISMO DÍA…?» → «SÍ» ES REGRESO = SALIDA
     ------------------------------------------------------------
     Prueba del dueño (8-sep-2026, 6:58 p.m.): «¿el 11 salen y regresan el
     mismo día, o se quedan?» → «si» → «¿Qué día regresan de Sayulita?».
     La IA no aplicó su propia regla. Se aplica aquí, ANTES de que hable:
     si el último mensaje del bot preguntó por el mismo día y el cliente
     dice que sí, el regreso es la salida y la IA ya lo ve en LO QUE YA SÉ.
     ------------------------------------------------------------ */
  {
    const ultimoAntesDeHablar = agente.historialDe(cliente).filter(function (t) { return t.de === 'bot'; }).pop();
    const ultimoTexto = (ultimoAntesDeHablar && ultimoAntesDeHablar.texto) || '';
    let cambio = false;
    /* Con el viaje ya sabido y la fecha vacía —lo que queda después de un
       «no hay»—, cualquier fecha que traiga el mensaje ES la salida. El
       modelo la trataba como pregunta («¿también para el 31 o cambias la
       del 24?») y el viaje se quedaba sin fecha (corrida real del
       9-sep-2026). */
    if (antes.destino && !antes.salida) {
      let laFecha = null;
      try { laFecha = conversacion.fechaDe(texto, hoy); } catch (e) { laFecha = null; }
      if (laFecha) {
        console.error('[agente] viaje conocido sin fecha: «' + String(texto).slice(0, 40) + '» fija la salida en ' + laFecha);
        antes = Object.assign({}, antes, { salida: laFecha }); cambio = true;
      }
    }
    /* «Ida y vuelta el mismo día» dicho por su cuenta, sin que nadie se lo
       preguntara: es un dato, no la respuesta a una pregunta. En la corrida
       real del 9-sep-2026 el cliente lo dijo y el bot le contestó «¿y qué
       día regresan?». */
    if (antes.salida && !antes.regreso && DICE_MISMO_DIA.test(conversacion.normaliza(texto))) {
      console.error('[agente] dijo «ida y vuelta el mismo día»: regreso = salida (' + antes.salida + ')');
      antes = Object.assign({}, antes, { regreso: antes.salida }); cambio = true;
    }
    else if (antes.salida && !antes.regreso && /mismo d[ií]a/i.test(ultimoTexto) && (esUnSiSeco(texto) || empiezaConSi(texto, hoy))) {
      console.error('[agente] «sí» al mismo día: regreso = salida (' + antes.salida + ')');
      antes = Object.assign({}, antes, { regreso: antes.salida }); cambio = true;
    }
    /* «Solo nos llevan y traen» es recorridos = 0, lo diga en el mensaje
       que lo diga: en la corrida real del 8-sep (escenario c) la IA no lo
       apuntó y el guion acabó preguntando «¿cuántos días quieren usar la
       unidad?» a quien ya lo había dicho. */
    if (typeof antes.recorridos !== 'number' && diceQueNoSeMueven(texto)) {
      console.error('[agente] «solo nos llevan y traen»: recorridos = 0');
      antes = Object.assign({}, antes, { recorridos: 0 }); cambio = true;
    }
    /* «Todavía no sé cuántos vamos» es un dato: no se le vuelve a pedir. */
    if (!antes.gente && !antes.sinCuenta && diceQueNoSabeCuantos(texto)) {
      console.error('[agente] no sabe cuántos son: se deja de pedir');
      antes = Object.assign({}, antes, { sinCuenta: true }); cambio = true;
    }
    /* «Ese» / «el G8» con quiero/precio/reservar = lo escogió. */
    if (!antes.unidadNombre) {
      const t = conversacion.normaliza(texto);
      const nombrado = agente.unidadPorTexto ? agente.unidadPorTexto(texto) : null;
      const busNombrado = nombrado && (conversacion.UNIDADES || []).find(function (u) { return u.id === nombrado && u.cat === 'autobus'; });
      const busSenalado = (!busNombrado && SENALA_ESE.test(t)) ? unicoAutobusEnTexto(ultimoTexto) : null;
      const quiere = /\b(quiero|me late|me gusta|reserv|apart|cotiza|cuanto|precio|ese|esa|ese mismo|el mismo)\b/.test(t);
      const bus = busNombrado || busSenalado;
      if (bus && quiere) {
        console.error('[agente] escogió el ' + bus.name + ' (' + (busNombrado ? 'por nombre' : 'por «ese»') + ')');
        antes = conversacion.pegaDatos(antes, { autobus: bus.id }); cambio = true;
      }
    }
    if (cambio) webhook.guardaCharla(cliente, antes);
  }
  const hayViaje = !!(antes.destino || antes.salida || antes.gente || antes.origen);
  const opcionesDeLaIA = {
    hoy: hoy, cliente: cliente, estado: antes,
    viaje: viajeDeLaFicha,
    /* «LO QUE YA HICE»: fotos, precio, datos de depósito, comprobante
       (reparación del 8-sep-2026, Fallas 1 y 2). */
    hechos: loQueYaHice(tickets.fichaDe(cliente), antes),
    /* El sistema sabe si el comprobante llegó; la IA nunca lo pregunta. */
    deposito: estadoDelDeposito(tickets.fichaDe(cliente)),
    falta: hayViaje ? conversacion.loQueFalta(antes) : (viajeDeLaFicha ? null : 'a dónde van'),
    historial: agente.historialDe(cliente),
    voz: { usted: /^(1|si|sí|usted)$/i.test(String(process.env.AGENTE_DE_USTED || '')) }
  };
  const dicho = await agente.conversa(texto, opcionesDeLaIA);
  if (!dicho) {
    /* La IA no contestó (o contestó algo inválido). Con un precio pedido o
       dado NO se le suelta al guion viejo, que leería el mensaje como un
       viaje nuevo (escenario b real, 8-sep-2026). */
    const neutra = esperaNeutraConPrecio(cliente);
    if (!neutra) return false;
    console.error('[agente] la IA no contestó y hay precio en la ficha: contesta neutro, no el guion');
    await manda({ numeroDeOrigen: envio.numeroDeOrigen, para: cliente, texto: neutra, pasaAPersona: false, escribio: '[agente · neutra con precio]' });
    agente.recuerda(cliente, 'cliente', texto);
    agente.recuerda(cliente, 'bot', neutra);
    /* Y la plática vuelve a como estaba ANTES de que el guion leyera el
       mensaje: sin eso quedaba «a Regresamos» como destino. */
    webhook.guardaCharla(cliente, (envio.estadoAntes && typeof envio.estadoAntes === 'object') ? envio.estadoAntes : null);
    return true;
  }
  if (dicho.turno && almacen.hayAlmacen()) almacen.anotaTurno(dicho.turno).catch(function () {});

  /* ¿Lo dijo como OTRO viaje? Se decide antes de todo lo demás: de ahí
     depende que un segundo viaje no se lea como un cambio del primero. */
  const esOtroViaje = /\botro viaje\b|\botra cotizaci|\bun viaje m[aá]s\b|\baparte\b|\btambi[eé]n quiero\b|\badem[aá]s\b/i.test(String(texto || '')) ||
    OTRA_FECHA_DISPONIBLE.test(conversacion.normaliza(texto));

  /* Lo que la IA leyó se pega al estado de ANTES; lo que el guion había
     decidido de este mensaje se descarta. */
  /* Con el precio ya dado, un cambio de fecha no se «checa» ni se confirma:
     lo ve el dueño. Antes la fecha nueva se pegaba a la plática, la ficha
     seguía con la vieja y el contrato se subía con la vieja (auditoría
     general del 8-sep, hallazgo 9). */
  const cambio = cambioDeFechaConPrecio(tickets.fichaDe(cliente), dicho.datos, antes, esOtroViaje);
  if (cambio) {
    const alCliente = 'Va, déjame checar ese cambio y en breve te confirmo 🙌';
    await manda({ numeroDeOrigen: envio.numeroDeOrigen, para: cliente, texto: alCliente, pasaAPersona: false, escribio: '[cambio de fecha]' });
    agente.recuerda(cliente, 'cliente', texto);
    agente.recuerda(cliente, 'bot', alCliente);
    const dueno = tickets.numeroDelDueno(process.env);
    if (dueno) {
      await manda({
        numeroDeOrigen: envio.numeroDeOrigen, para: dueno, esTicket: true, sobreCliente: cliente, pasaAPersona: false,
        texto: '📅 *Quiere cambiar la fecha*\n\n' + cambio.resumen + '\nPide: ' + cambio.pide + '.\n\n«' +
          String(texto).slice(0, 300) + '»\n\nContéstame *este mensaje* y le llega tal cual.\n_cliente: ' + cliente + '_',
        escribio: '[ticket · cambio de fecha]'
      });
    }
    return true;
  }
  /* ------------------------------------------------------------
     UN CAMBIO DESPUÉS DEL PRECIO NO ARRANCA DE CERO (reparación 8-sep, Falla 5)
     ------------------------------------------------------------
     «Mejor Mazatlán», «seremos 16», «mejor el 21» cuando el viaje ya está
     en precio (pedido o dado): la plática está cerrada y el cambio caía
     en una plática vacía que volvía a preguntar fechas y gente. Ahora el
     viaje conocido se siembra y solo se cambia lo que cambió. Un «otro
     viaje» explícito sí arranca de cero (ése es otro viaje, no un cambio).
     ------------------------------------------------------------ */
  const cambiaAlgo = !!(dicho.datos && (dicho.datos.destino || dicho.datos.gente || dicho.datos.salida || dicho.datos.regreso || dicho.datos.unidad || dicho.datos.autobus));
  /* Una plática «débil» con el viaje ya en precio (un destino suelto sin
     fecha ni gente, como el «Ernesto Jiménez» que el guion viejo guardó
     como destino el 7-sep) es basura, no otro viaje: manda el viaje de la
     ficha. */
  const platicaDebil = hayViaje && !(antes.salida || antes.gente) && !antes.otroViaje;
  /* Con la plática VACÍA se siembra siempre, no solo cuando el mensaje trae
     un dato nuevo: el guion borra la plática al contestar cosas como
     «apartar» o una objeción, y el siguiente mensaje sin datos la dejaba en
     `{}`. Así se perdió que el grupo había crecido a 22 y el bot volvió a
     ofrecer el anticipo del viaje de 15 (corrida real del 9-sep-2026,
     escenario k). Un viaje NUEVO sigue protegido por `esOtroViaje`. */
  if (viajeDeLaFicha && viajeDeLaFicha.estado && (!hayViaje || platicaDebil) && (cambiaAlgo || platicaDebil || !hayViaje) && !esOtroViaje) {
    const base = viajeBaseDeLaFicha(tickets.fichaDe(cliente));
    if (base) {
      antes = Object.assign({}, base, antes.nombre ? { nombre: antes.nombre } : {});
      console.log('[agente] ' + (platicaDebil ? 'plática débil con viaje en precio: manda el viaje de la ficha' :
        'cambio sobre un viaje con precio: se siembra el viaje conocido y se cambia solo lo nuevo'));
    }
  }
  /* El nombre que dio en el chat sobrevive al cierre de la plática: vive en
     el viaje de la ficha. */
  if ((!antes.nombre || antes.nombre === (envio.nombreDelPerfil || antes.nombre)) && viajeDeLaFicha) {
    const base = viajeBaseDeLaFicha(tickets.fichaDe(cliente));
    if (base && base.nombre) antes = Object.assign({}, antes, { nombre: base.nombre });
  }
  const nuevo = conversacion.pegaDatos(antes, dicho.datos);
  /* «Otro viaje» explícito queda marcado en la plática: los mensajes que
     sigan son de ese viaje nuevo, no basura que haya que reemplazar. */
  if (esOtroViaje && viajeDeLaFicha) nuevo.otroViaje = true;
  webhook.guardaCharla(cliente, nuevo);
  agente.recuerda(cliente, 'cliente', texto);
  /* «Ya dijiste eso con esas palabras» (8-sep-2026, «que deje de sonar a
     guion»): si la respuesta se parece más del 80 % al último mensaje del
     bot en esta plática, se regenera UNA vez con esa instrucción. */
  if (dicho.accion === 'seguir' && dicho.respuesta) {
    const ultimoDelBot = agente.historialDe(cliente).filter(function (t) { return t.de === 'bot'; }).slice(-1)[0];
    if (ultimoDelBot && parecido(dicho.respuesta, ultimoDelBot.texto) > 0.8) {
      console.error('[agente] repitió casi lo mismo que su último mensaje; se regenera');
      const otra = await agente.conversa(texto, Object.assign({}, opcionesDeLaIA, { estado: nuevo,
        aviso: 'Ya dijiste eso con esas palabras («' + String(ultimoDelBot.texto).slice(0, 120) + '»); dilo distinto o no lo digas.' }));
      if (otra && otra.accion === 'seguir' && otra.respuesta) dicho.respuesta = otra.respuesta;
    }
  }
  /* Validación ANTES de mandar (Falla 1): si la IA pregunta un dato que ya
     está en el estado, se regenera UNA vez diciéndoselo; si insiste, contesta
     el guion con lo que de verdad falta. Nunca sale la pregunta repetida. */
  if (dicho.accion === 'seguir' && dicho.respuesta) {
    const repetida = preguntaRepetida(dicho.respuesta, nuevo);
    const sobra = repetida ? null : preguntaQueSobra(dicho.respuesta, nuevo, tickets.fichaDe(cliente));
    if (repetida || sobra) {
      console.error(repetida
        ? '[agente] volvió a preguntar «' + repetida + '» (ya se sabe: ' + nuevo[repetida] + '); se regenera'
        : '[agente] preguntó «' + sobra + '» cuando no tocaba; se regenera');
      const aviso = repetida
        ? 'Ese dato ya lo tienes: ' + repetida + ' = ' + nuevo[repetida] + '. No lo preguntes; sigue con lo que falta.'
        : (sobra === 'gente'
          ? 'Ya escogió el ' + nuevo.unidadNombre + '. NO preguntes cuántos son: para rentar un autobús no hace falta. Sigue con lo que falta o pásale el precio.'
          : 'NO preguntes hora, dirección ni nombre: eso son datos del contrato y se piden hasta que mande el comprobante. Sigue con lo que falta o con el precio.');
      const otra = await agente.conversa(texto, Object.assign({}, opcionesDeLaIA, {
        estado: nuevo, falta: conversacion.loQueFalta(nuevo) || null, aviso: aviso
      }));
      const bien = function (r) {
        const despues = conversacion.pegaDatos(nuevo, r.datos);
        return !preguntaRepetida(r.respuesta, despues) && !preguntaQueSobra(r.respuesta, despues, tickets.fichaDe(cliente));
      };
      if (otra && otra.accion === 'seguir' && otra.respuesta && bien(otra)) {
        dicho.respuesta = otra.respuesta;
      } else {
        console.error('[agente] insistió; contesta el guion con lo que falta');
        dicho.respuesta = conversacion.loQueFalta(nuevo) ? preguntaParaElCliente(nuevo)
          : (viajeDeLaFicha && viajeDeLaFicha.estado === 'dado' ? '¿Te la aparto?' : '¿Te saco el precio?');
      }
    }
  }

  /* ------------------------------------------------------------
     «¿TE MANDO FOTOS DE ALGUNO?» → «i6» ES UN SÍ CON NOMBRE
     ------------------------------------------------------------
     Prueba del dueño (8-sep-2026, 6:46 p.m.): la lista de autobuses
     cierra ofreciendo fotos; contestó «i6» y la IA, en vez de mandarlas,
     describió la unidad. Si el último mensaje del bot ofreció fotos y el
     cliente nombra una unidad, eso ES pedir sus fotos: la acción se vuelve
     «fotos» de esa unidad y, si es autobús, queda escogido. Lo decide el
     código, no el modelo.
     ------------------------------------------------------------ */
  const ultimoDelBot = agente.historialDe(cliente).filter(function (t) { return t.de === 'bot'; }).pop();
  const ofrecioFotos = !!(ultimoDelBot && /te mando fotos|quieres fotos|te paso fotos/i.test(ultimoDelBot.texto || ''));
  const unidadNombrada = agente.unidadPorTexto ? agente.unidadPorTexto(texto) : null;
  if (ofrecioFotos && unidadNombrada && dicho.accion !== 'video' && !/\bno\b/i.test(String(texto || '').slice(0, 4))) {
    console.error('[agente] ofreció fotos y el cliente nombró ' + unidadNombrada + ': se mandan sus fotos');
    dicho.accion = 'fotos';
    dicho.unidadPedida = unidadNombrada;
    const esBus = (conversacion.UNIDADES || []).some(function (u) { return u.id === unidadNombrada && u.cat === 'autobus'; });
    if (esBus && !nuevo.unidadNombre) {
      const con = conversacion.pegaDatos(nuevo, { autobus: unidadNombrada });
      Object.keys(con).forEach(function (k) { nuevo[k] = con[k]; });
    }
  }

  /* ------------------------------------------------------------
     UN DESTINO DEL EXTRANJERO NO SE COTIZA
     ------------------------------------------------------------
     Corrida real del 9-sep-2026: «un viaje a bta» (dedazo de «vta») lo
     leyó el modelo como Bogotá y el bot armó una Sprinter a Colombia.
     Eurotravel no hace viajes al extranjero: el destino se descarta, el
     cliente recibe una pregunta honesta y el dueño se entera.
     ------------------------------------------------------------ */
  if (nuevo.destino && conversacion.esDelExtranjero(nuevo.destino)) {
    console.error('[agente] destino del extranjero («' + nuevo.destino + '»): no se cotiza');
    const fuera = nuevo.destino;
    delete nuevo.destino; delete nuevo.salida; delete nuevo.regreso;
    nuevo.paso = 'destino';
    webhook.guardaCharla(cliente, nuevo);
    dicho.accion = 'seguir';
    dicho.respuesta = 'Uy, hasta ' + fuera + ' no llegamos: los viajes son por carretera aquí en México 🚐 ' +
      '¿A qué lugar de la República van?';
    const duenoFuera = tickets.numeroDelDueno(process.env);
    if (duenoFuera) {
      await manda({ numeroDeOrigen: envio.numeroDeOrigen, para: duenoFuera, esTicket: true, sobreCliente: cliente, pasaAPersona: false,
        texto: '🌎 *Te pidieron un viaje al extranjero*\n\n«' + String(texto).slice(0, 200) + '»\n\n' +
          'Le dije que solo viajamos dentro de México y le pregunté a dónde van. Si sí lo quieres tomar, contéstame este mensaje.\n_cliente: ' + cliente + '_',
        escribio: '[ticket · destino del extranjero]' });
    }
  }

  /* ------------------------------------------------------------
     NO SE VENDEN BOLETOS, Y UN DESCUENTO LO DECIDE EL DUEÑO
     ------------------------------------------------------------
     Corrida real del 9-sep-2026 (escenario h): «¿y venden boletos a
     Monterrey?» → «Sí, claro. ¿Cuándo pensabas ir?». Eurotravel renta
     unidades completas: prometer boletos es prometer un servicio que no
     existe. Y «¿no me puedes hacer un descuento?» recibió un «No, los
     precios son los que son»: el dueño es quien da descuentos, así que
     la pregunta le llega a él en vez de morir en un no seco.
     ------------------------------------------------------------ */
  {
    const t = conversacion.normaliza(texto);
    const pideBoletos = /\b(boletos?|pasajes?|corridas?|asientos? sueltos?|lugares? sueltos?|un lugar|dos lugares)\b/.test(t) &&
      !/\bboleto de avi[oó]n\b/.test(t);
    const pideDescuento = /\b(descuento|rebaja|precio especial|promocion|me lo dejas en|me lo deja en|hacer un precio|mejor precio|mas barato)\b/.test(t);
    if (pideBoletos) {
      console.error('[agente] preguntó por boletos sueltos: se aclara que se renta la unidad completa');
      dicho.accion = 'seguir';
      dicho.respuesta = 'Boletos sueltos no manejamos 🙌 Lo que hacemos es rentarte la unidad completa con chofer ' +
        'para tu grupo, del punto que nos digas y de regreso. ¿Para cuántos sería y a dónde van?';
    } else if (pideDescuento && dicho.accion === 'seguir') {
      console.error('[agente] pidió descuento: lo decide el dueño');
      dicho.accion = 'dueno';
      dicho.respuesta = 'El precio ya va cerrado con operador, combustible, casetas y seguro de viajero, ' +
        'sin cobros después 🙌 Déjame consultarlo con el equipo y en breve te dicen por aquí.';
    }
  }

  const yaEstaTodo = !conversacion.loQueFalta(nuevo);
  /* El viaje que ya tiene precio (pedido o dado) no se vuelve a cotizar solo
     porque la plática esté completa: desde que la plática se siembra de la
     ficha, un simple «ok» dejaba todo completo y pedía otro precio del mismo
     viaje (9-sep-2026). Si el cliente cambia algo, `mismoViaje` da false y
     sí se cotiza de nuevo. */
  const yaTienePrecioEseViaje = !!(viajeDeLaFicha && viajeDeLaFicha.estado &&
    mismoViaje(nuevo, viajeBaseDeLaFicha(tickets.fichaDe(cliente))));
  /* Si la IA leyó un cambio que deja el viaje distinto del que tiene precio,
     ese precio se marca vencido en la ficha: ni se aparta con él ni se
     ofrece (9-sep-2026, escenario k). */
  /* Y no si es OTRO viaje: pedir una segunda cotización no vence el precio
     del primero (corrida real del 9-sep-2026, escenario q). */
  if (viajeDeLaFicha && viajeDeLaFicha.estado === 'dado' && !yaTienePrecioEseViaje && cambiaAlgo &&
      !esOtroViaje && !nuevo.otroViaje) {
    const f = tickets.fichaDe(cliente);
    if (f && !f.precioVencido) {
      console.error('[agente] el viaje cambió después del precio: queda marcado como vencido');
      tickets.anotaEtapa(cliente, f.etapa, { precioVencido: true }, Date.now());
    }
  }
  let accion = dicho.accion;
  if (accion === 'seguir' && yaEstaTodo && !yaTienePrecioEseViaje) accion = 'cotizar';
  if (accion === 'cotizar' && !yaEstaTodo) accion = 'seguir';   // le falta algo: que lo pida
  if (accion === 'seguir' && !yaEstaTodo && dicho.respuesta && PROMETE_PRECIO.test(dicho.respuesta) &&
      !(viajeDeLaFicha && viajeDeLaFicha.estado)) {
    console.error('[agente] prometió el precio con datos que faltan (' + String(conversacion.loQueFalta(nuevo)).slice(0, 40) + '); pregunta el guion');
    dicho.respuesta = preguntaParaElCliente(nuevo);
  }
  /* «Quiero apartar» sin precio dado (A7): antes se reinyectaba al guion
     con la plática limpia y salía la CLABE sin viaje ni monto. Sin precio
     no hay qué apartar: se le dice, y si ya dio todo, se pide el precio. */
  if (accion === 'apartar') {
    const f = tickets.fichaDe(cliente);
    const conPrecio = !!(f && typeof f.total === 'number' && f.total > 0 &&
      ['con_precio', 'va_a_apartar', 'mando_comprobante', 'datos_del_contrato', 'contrato_listo'].indexOf(f.etapa) >= 0);
    if (!conPrecio) {
      if (yaEstaTodo) { accion = 'cotizar'; }
      else {
        accion = 'seguir';
        dicho.respuesta = dicho.respuesta ||
          'Va, con gusto 🙌 Primero te confirmo el precio y en cuanto lo tengas te paso cómo apartar.';
      }
    }
  }

  /* Fotos y video: de la unidad que pidió («fotos del i6», «video de la
     Sprinter») o de la que le tocaría. Sin reinyectar al guion: por
     WhatsApp el guion solo mandaba el texto, y siempre de la Sprinter. */
  if (accion === 'fotos' || accion === 'video') {
    const sitio = String(process.env.SITIO_URL || '').replace(/\/+$/, '');
    const id = dicho.unidadPedida || (nuevo.unidad === 'autobus' ? (nuevo.unidadId || 'irizar-i6s') : (nuevo.unidad || 'sprinter'));
    const medios = conversacion.mediosDe(id);
    const nombre = (medios && medios.unidad) ? medios.unidad : id;
    if (!medios || !sitio) {
      const aviso = 'De ésa te paso las fotos en un momento. Mientras, ¿como cuántos van?';
      await manda({ numeroDeOrigen: envio.numeroDeOrigen, para: cliente, texto: aviso, pasaAPersona: false, escribio: '[agente · sin medios]' });
      agente.recuerda(cliente, 'bot', aviso);
      return true;
    }
    if (accion === 'video') {
      const texto = medios.video
        ? 'Aquí va el video por dentro 👇\n' + medios.video
        : 'De ésa no tengo video, pero mira las fotos 👇';
      await manda({ numeroDeOrigen: envio.numeroDeOrigen, para: cliente, texto: texto, pasaAPersona: false, escribio: '[agente · video]' });
      agente.recuerda(cliente, 'bot', texto);
      if (medios.video) return true;
    }
    const u = (conversacion.UNIDADES || []).find(function (x) { return x.id === nombre; });
    const nombreBonito = (u && u.name) || nombre;
    const pie = 'Ésta es la *' + nombreBonito + '*' + (u && u.cap ? ' — ' + u.cap : '') + ' 📸';
    /* ------------------------------------------------------------
       NO SE MANDA DOS VECES LA MISMA FOTO (reparación del 8-sep, Falla 2)
       ------------------------------------------------------------
       Si esta plática ya llevó fotos de esa unidad, no se repiten: se le
       dice que van arriba y se sigue. Solo si el cliente pide que se las
       manden OTRA VEZ («no me llegaron», «de nuevo») se vuelven a mandar.
       ------------------------------------------------------------ */
    const fichaFotos = tickets.fichaDe(cliente);
    const vistasAntes = (Array.isArray(nuevo.fotosVistas) ? nuevo.fotosVistas : [])
      .concat((fichaFotos && Array.isArray(fichaFotos.fotos)) ? fichaFotos.fotos : []);
    const pideDeNuevo = /otra vez|de nuevo|no (me )?(llegaron|llegó|llego)|no las (vi|veo)|reenv[ií]a|m[aá]ndalas otra/i.test(String(texto || ''));
    if (accion === 'fotos' && vistasAntes.indexOf(nombre) >= 0 && !pideDeNuevo) {
      console.error('[agente] ya mandó fotos de ' + nombre + ' en esta plática; no se repiten');
      const conPrecioYa = viajeConPrecio(tickets.fichaDe(cliente));
      const sigue = conPrecioYa && conPrecioYa.estado === 'dado' ? '¿Te la aparto?'
        : conPrecioYa && conPrecioYa.estado === 'pedido' ? 'En cuanto tenga tu precio te lo paso por aquí 🙌'
          : (conversacion.loQueFalta(nuevo) ? preguntaParaElCliente(nuevo) : '¿Te saco el precio?');
      const yaLas = 'Las fotos de la ' + nombreBonito + ' van arriba 👆 ' + sigue;
      await manda({ numeroDeOrigen: envio.numeroDeOrigen, para: cliente, texto: yaLas, pasaAPersona: false, escribio: '[agente · fotos ya mandadas]' });
      agente.recuerda(cliente, 'bot', yaLas);
      return true;
    }
    let primera = true;
    let mandadas = 0;
    for (const foto of medios.fotos.slice(0, 3)) {
      if (await manda({ numeroDeOrigen: envio.numeroDeOrigen, para: cliente,
        ligaDeFoto: sitio + '/' + foto, texto: primera ? pie : '', pasaAPersona: false, escribio: '[agente · foto]' })) mandadas++;
      primera = false;
    }
    /* La acción queda en la memoria corta del agente, como turno propio:
       en el siguiente turno el modelo la ve en «ÚLTIMOS MENSAJES». */
    if (mandadas) agente.recuerda(cliente, 'bot', '[Acción: envié ' + mandadas + ' fotos de ' + nombreBonito + ']');
    if (accion === 'fotos' && medios.video) {
      const v = 'Y el video por dentro 👇\n' + medios.video;
      await manda({ numeroDeOrigen: envio.numeroDeOrigen, para: cliente, texto: v, pasaAPersona: false, escribio: '[agente · video]' });
    }
    /* El remate después de las fotos es la PREGUNTA DEL GUION para el paso
       que sigue, nunca `loQueFalta`: ése es un texto de instrucciones para
       la IA («Pregunta EXACTAMENTE eso… datos.origen = "Guadalajara"») y
       el 7-sep-2026 le llegó tal cual a un cliente. */
    const siguiente = conversacion.loQueFalta(nuevo)
      ? preguntaParaElCliente(nuevo) : null;
    /* Con precio ya dado o pedido, el remate no es de captura: a quien ya
       tiene precio no se le pregunta «¿a dónde van?» (auditoría general del
       8-sep, hallazgo 8). */
    const conPrecio = viajeConPrecio(tickets.fichaDe(cliente));
    /* MODO_GUION (8-sep-2026, «que deje de sonar a guion»): apagado por
       omisión, tras las fotos NO sale una pregunta enlatada; sale lo que la
       IA haya dicho, o nada (el cliente ya tiene qué mirar). Con
       MODO_GUION=1 vuelve el remate fijo de antes. */
  const modoGuion = process.env.MODO_GUION === '1' || process.env.MODO_GUION === 'true';
    const remate = dicho.respuesta || (!modoGuion ? '' : (
      (conPrecio && conPrecio.estado === 'dado') ? '¿Te la aparto?'
        : (conPrecio && conPrecio.estado === 'pedido') ? 'En cuanto tenga tu precio te lo paso por aquí 🙌'
          : (siguiente ? '¿Te saco el precio? ' + siguiente : '¿Te saco el precio?')));
    if (remate) await manda({ numeroDeOrigen: envio.numeroDeOrigen, para: cliente, texto: remate, pasaAPersona: false, escribio: '[agente]' });
    agente.recuerda(cliente, 'bot', pie + (remate ? ' ' + remate : ''));
    /* La plática recuerda de qué unidad ya vio fotos: con el precio no se
       le vuelve a mandar la misma (dictado del dueño, 8-sep-2026). */
    const vistas = Array.isArray(nuevo.fotosVistas) ? nuevo.fotosVistas.slice() : [];
    if (vistas.indexOf(nombre) < 0) vistas.push(nombre);
    nuevo.fotosVistas = vistas;
    webhook.guardaCharla(cliente, nuevo);
    /* Y en la ficha, que sobrevive al cierre de la plática. */
    const fichaTras = tickets.fichaDe(cliente);
    const enFicha = (fichaTras && Array.isArray(fichaTras.fotos)) ? fichaTras.fotos.slice() : [];
    if (enFicha.indexOf(nombre) < 0) {
      enFicha.push(nombre);
      tickets.anotaEtapa(cliente, fichaTras ? fichaTras.etapa : 'escribio', { fotos: enFicha }, Date.now());
    }
    return true;
  }

  if (accion !== 'seguir') {
    /* «apartar» lo contesta el motor entero (anticipo, ficha, CLABE,
       cuenta): el texto de la IA («te paso los datos, un momento») sobra y
       el 8-sep-2026 duplicó los datos. */
    if (dicho.respuesta && accion !== 'cotizar' && accion !== 'apartar') {
      await manda({ numeroDeOrigen: envio.numeroDeOrigen, para: cliente, texto: dicho.respuesta,
        pasaAPersona: false, escribio: '[agente]' });
      agente.recuerda(cliente, 'bot', dicho.respuesta);
    }
    /* ------------------------------------------------------------
       COTIZAR: DIRECTO A LA COMPUERTA DEL DUEÑO
       ------------------------------------------------------------
       Sprinter: el motor calcula y el ticket trae el número. Autobús y
       Suburban: no hay cotizador automático; el ticket va sin número y
       el dueño lo pone. En los dos casos el cliente recibe la espera y
       NUNCA se le manda a otro número (el «Mándale esto por WhatsApp
       al 33…» era el camino de la página, no de WhatsApp; dictado del
       dueño, 6-sep-2026).
       ------------------------------------------------------------ */
    if (accion === 'cotizar') {
      /* Con el precio YA PEDIDO y sin cambiar nada del viaje, no se vuelve a
         pedir: al dueño le llegaba un segundo ticket idéntico (corrida real
         del 8-sep, escenario b). Se le dice al cliente que va en camino. */
      if (viajeDeLaFicha && viajeDeLaFicha.estado === 'pedido' && !esOtroViaje &&
          mismoViaje(nuevo, viajeBaseDeLaFicha(tickets.fichaDe(cliente)))) {
        console.error('[agente] precio ya pedido y nada cambió: no se repite el ticket');
        /* Con sus palabras si las tiene: el candado es para no repetir el
           ticket, no para quitarle la voz a la IA. */
        const espera = sinMuletillaRepetida(
          dicho.respuesta || 'Va 🙌 En cuanto tenga tu precio te lo paso por aquí.',
          ultimoDelBot && ultimoDelBot.texto);
        await manda({ numeroDeOrigen: envio.numeroDeOrigen, para: cliente, texto: espera, pasaAPersona: false, escribio: '[agente · precio en camino]' });
        agente.recuerda(cliente, 'bot', espera);
        webhook.guardaCharla(cliente, null);
        return true;
      }
      /* Si el cliente preguntó algo en el mismo mensaje en que completó
         el viaje («…de Guadalajara, ¿traen aire?»), la respuesta de la IA
         sale ANTES de la espera; antes se tiraba (auditoría 7-sep-2026,
         A12). Una respuesta que solo repite «te paso el precio» no. */
      if (dicho.respuesta && !/precio|cotizaci/i.test(dicho.respuesta)) {
        await manda({ numeroDeOrigen: envio.numeroDeOrigen, para: cliente, texto: dicho.respuesta,
          pasaAPersona: false, escribio: '[agente · antes del precio]' });
        agente.recuerda(cliente, 'bot', dicho.respuesta);
      }
      const confirmar = Object.assign({}, nuevo, { paso: 'confirmar' });
      let r = null;
      try { r = conversacion.respuestaA('sí está bien', confirmar, hoy); } catch (e) { r = null; }
      const resumen = (r && (r.resumen || r.solicitud)) || {
        destino: nuevo.destino, origen: nuevo.origen, salida: nuevo.salida, regreso: nuevo.regreso,
        gente: nuevo.gente, unidad: nuevo.unidadNombre || nuevo.unidad,
        /* El nombre del camión también aquí: el precio lo encabeza con
           `unidadNombre` (8-sep-2026: un i6 salía como «Sprinter»). */
        unidadNombre: nuevo.unidadNombre || null, nombre: nuevo.nombre || null
      };
      /* El nombre de la unidad («Neobus»), no la categoría («autobus»): es lo
         que lee el dueño en el ticket y la llave del precio aprendido. */
      if (nuevo.unidadNombre) resumen.unidad = nuevo.unidadNombre;
      else if (!resumen.unidad) resumen.unidad = nuevo.unidad;
      if (!resumen.gente && nuevo.gente) resumen.gente = nuevo.gente;
      /* La plática se CIERRA al pedir el precio, igual que en el camino
         del guion (que devuelve `estado: null`). Aquí se guardaba
         `confirmar` con todos los datos, y con eso cada mensaje siguiente
         —«ok», y al día siguiente «quiero cotizar otro viaje»— volvía a
         verse como «ya está todo → cotizar»: otra espera y otro ticket,
         sin fin (visto en producción el 7-sep-2026). El viaje no se
         pierde: queda en la ficha (`porConfirmar`, `viajeDatos`) y de ahí
         se le cuenta a la IA como contexto. */
      webhook.guardaCharla(cliente, (r && r.estado) ? r.estado : null);
      /* Si ya pidió fotos de esa unidad en esta plática, con el precio no
         se le repite la foto (dictado del dueño, 8-sep-2026). */
      const unidadCotizada = unidadDelCatalogo(nuevo.unidadId || nuevo.unidadNombre || resumen.unidad || nuevo.unidad);
      const fichaAlCotizar = tickets.fichaDe(cliente);
      const vistasAlCotizar = (Array.isArray(nuevo.fotosVistas) ? nuevo.fotosVistas : [])
        .concat((fichaAlCotizar && Array.isArray(fichaAlCotizar.fotos)) ? fichaAlCotizar.fotos : []);
      const yaVioFotos = !!unidadCotizada && vistasAlCotizar.indexOf(unidadCotizada.id) >= 0;
      const salidas = await precioDe({
        numeroDeOrigen: envio.numeroDeOrigen, para: cliente,
        cotiza: (r && r.cotiza) || null, resumen: resumen, sinFoto: yaVioFotos
      });
      for (const s of salidas) await manda(s);
      const alCliente = salidas.find(function (s) { return s.para === cliente; });
      if (alCliente) agente.recuerda(cliente, 'bot', alCliente.texto);
      return true;
    }
    /* ------------------------------------------------------------
       «PREGÚNTAME A MÍ»: RFC, razón social, datos fiscales, documentos
       ------------------------------------------------------------
       Dictado del dueño (7-sep-2026): «cuando pidan RFC o razón social,
       pregúntame a mí». El bot no los sabe y no los inventa: el cliente
       recibe «en breve te paso ese dato» y al dueño le llega la pregunta
       tal cual como ticket; lo que él conteste citándolo le llega al
       cliente literal (el camino de siempre de una respuesta suya).
       ------------------------------------------------------------ */
    if (accion === 'dueno' || accion === 'persona') {
      /* «Persona» ya no se reinyecta al guion: ahí contestaba «márcame al
         33 2400 2285» (A6). Igual que un dato del dueño: el cliente se queda
         aquí y al dueño le llega lo que pidió. */
      const esPersona = accion === 'persona';
      /* Si la IA trajo texto, ya salió arriba (el bloque general de
         `accion !== 'seguir'`); mandarlo otra vez lo duplicaba (corrida
         real del 8-sep, escenario c: «Eso lo ve el dueño…» dos veces). */
      if (!dicho.respuesta) {
        const alCliente = esPersona
          ? 'Va, en breve te contestan por aquí mismo 🙌'
          : 'Va, en breve te paso ese dato 🙌';
        await manda({ numeroDeOrigen: envio.numeroDeOrigen, para: cliente, texto: alCliente,
          pasaAPersona: false, escribio: '[agente · dato del dueño]' });
        agente.recuerda(cliente, 'bot', alCliente);
      }
      const dueno = tickets.numeroDelDueno(process.env);
      if (dueno) {
        await manda({
          numeroDeOrigen: envio.numeroDeOrigen, para: dueno,
          esTicket: true, sobreCliente: cliente, pasaAPersona: false,
          texto: (esPersona ? '🙋 *Quiere hablar contigo*' : '🙋 *Un cliente pregunta*') +
            '\n\n«' + String(texto).slice(0, 400) + '»\n\n' +
            'Contéstame *este mensaje* y le llega tal cual.\n_cliente: ' + cliente + '_',
          escribio: '[ticket · pregunta al dueño]'
        });
      }
      return true;
    }
    /* «Persona» y «apartar» a media cotización el guion los toma como
       destino (misma familia que «bien y tú?»): se le reinyectan con la
       plática LIMPIA —ahí sí tiene sus caminos: teléfono, ficha bancaria,
       CLABE— y después se restaura el viaje que iba. */
    const conPlaticaLimpia = accion === 'persona' || accion === 'apartar';
    if (conPlaticaLimpia) webhook.guardaCharla(cliente, null);
    const hecho = await reinyectaAlGuion(envio, CANONICO[accion]);
    if (conPlaticaLimpia) webhook.guardaCharla(cliente, nuevo);
    if (hecho) return true;
    /* El motor no pudo: que al menos salga lo que dijo la IA, o el guion. */
    if (dicho.respuesta) return true;
    const neutra = esperaNeutraConPrecio(cliente, nuevo);
    if (neutra) {
      await manda({ numeroDeOrigen: envio.numeroDeOrigen, para: cliente, texto: neutra, pasaAPersona: false, escribio: '[agente · neutra con precio]' });
      agente.recuerda(cliente, 'bot', neutra);
      return true;
    }
    return false;
  }

  /* Sin respuesta no hay qué mandar: antes salía un texto vacío, Meta lo
     rechazaba y el cliente se quedaba sin nada (auditoría 7-sep-2026, A1:
     «¿cuánto sale?» antes de tener todos los datos). Se devuelve `false`
     y contesta el guion con lo que falta… salvo con un precio pedido o
     dado: ahí el guion viejo no debe leer el mensaje como viaje nuevo. */
  if (!dicho.respuesta) {
    const neutra = esperaNeutraConPrecio(cliente, nuevo);
    if (!neutra) return false;
    console.error('[agente] sin respuesta con precio en la ficha: contesta neutro, no el guion');
    await manda({ numeroDeOrigen: envio.numeroDeOrigen, para: cliente, texto: neutra, pasaAPersona: false, escribio: '[agente · neutra con precio]' });
    agente.recuerda(cliente, 'bot', neutra);
    return true;
  }
  /* Al elegir autobús, primero los que caben y hasta el final los que no
     (dictado del dueño, 7-sep-2026). Si la IA los mezcló, sale el mensaje
     del guion, y punto. Lo decide el código, no el prompt. */
  /* Y si pidió ver camiones y la IA no le enseñó ninguno, la lista
     (dictado del dueño, 8-sep-2026). */
  const respuestaFinal = sinMuletillaRepetida(
    conLosAutobusesQuePidio(sinAutobusesQueNoCaben(dicho.respuesta, nuevo), texto, nuevo),
    ultimoDelBot && ultimoDelBot.texto);
  await manda({ numeroDeOrigen: envio.numeroDeOrigen, para: cliente, texto: respuestaFinal,
    pasaAPersona: false, escribio: respuestaFinal === dicho.respuesta ? '[agente]' : '[agente · lista corregida]' });
  agente.recuerda(cliente, 'bot', respuestaFinal);
  return true;
}

/* Clientes a los que el agente contestó en esta vuelta (se vacía en cada
   aviso): para callar el «te están escribiendo» que el guion pidió. */
const atendidosPorElAgenteAhora = new Set();

/* ------------------------------------------------------------
   LA RÁFAGA SE UNE EN UN TURNO (reparación del 8-sep-2026, Falla 2)
   ------------------------------------------------------------
   «a vallarta» / «el 20» / «somos 18» en tres mensajes seguidos del
   mismo cliente dentro de un aviso se vuelven UN mensaje («a vallarta
   \nel 20\nsomos 18») con el id del primero. Así la IA lee todo junto y
   contesta una vez. Solo texto, solo mensajes consecutivos del mismo
   número. Si no hay nada que unir, el cuerpo y la firma salen intactos.
   ------------------------------------------------------------ */
function uneLaRafaga(crudo, firma) {
  let aviso;
  try { aviso = JSON.parse(crudo.toString('utf8')); } catch (e) { return { crudo: crudo, firma: firma }; }
  let unio = false;
  for (const e of (aviso && aviso.entry) || []) {
    for (const c of (e && e.changes) || []) {
      const valor = c && c.value;
      if (!valor || !Array.isArray(valor.messages) || valor.messages.length < 2) continue;
      const salida = [];
      for (const m of valor.messages) {
        const ultimo = salida[salida.length - 1];
        if (ultimo && m && m.type === 'text' && ultimo.type === 'text' && m.from && m.from === ultimo.from &&
            m.text && ultimo.text && typeof m.text.body === 'string') {
          ultimo.text.body = String(ultimo.text.body) + '\n' + m.text.body;
          if (m.timestamp) ultimo.timestamp = m.timestamp;
          unio = true;
        } else {
          salida.push(m && m.type === 'text' && m.text ? Object.assign({}, m, { text: Object.assign({}, m.text) }) : m);
        }
      }
      valor.messages = salida;
    }
  }
  if (!unio) return { crudo: crudo, firma: firma };
  const nuevo = Buffer.from(JSON.stringify(aviso), 'utf8');
  const secreto = process.env.WHATSAPP_APP_SECRET;
  const nuevaFirma = secreto ? 'sha256=' + crypto.createHmac('sha256', secreto).update(nuevo).digest('hex') : firma;
  console.log('[whatsapp] ráfaga unida en un turno');
  return { crudo: nuevo, firma: nuevaFirma };
}

async function reparte(envio) {
  /* «¿Y entre 20 cuánto sería?» después del precio: el reparto por persona
     lo hace el MOTOR, con o sin IA. La IA no puede decir cifras (DINERO) y
     el 8-sep-2026 leyó esa pregunta como «quiero apartar». Mismo total,
     otra cuenta; si ya no caben en la unidad, es otra cotización. */
  if (envio.textoDelCliente && envio.para) {
    const reparto = repartoPorPersona(envio.textoDelCliente, envio.para, tickets.fichaDe(envio.para), envio.estadoAntes);
    if (reparto) {
      await manda({ numeroDeOrigen: envio.numeroDeOrigen, para: envio.para, texto: reparto.texto,
        pasaAPersona: false, escribio: '[reparto por persona]' });
      agente.recuerda(envio.para, 'cliente', envio.textoDelCliente);
      agente.recuerda(envio.para, 'bot', reparto.texto);
      /* Lo que el guion haya decidido de este mensaje se descarta: la
         plática queda como la deja el reparto (nada, o el viaje nuevo). */
      webhook.guardaCharla(envio.para, reparto.estado || null);
      return;
    }
  }
  /* «💬 Te están escribiendo» sobra cuando el agente ya contestó ese mismo
     mensaje: el guion no lo entendió (la plática se cierra al cotizar) e
     izó `pasa`, pero la IA sí (auditoría general del 8-sep, hallazgo 16). */
  if (envio.avisoDeEscritura && envio.sobreCliente && atendidosPorElAgenteAhora.has(almacen.llave(envio.sobreCliente))) return;
  if (envio.agente && envio.crudoDelCliente) {
    if (await loQueDiceElAgente(envio)) { atendidosPorElAgenteAhora.add(almacen.llave(envio.para)); return; }
  }

  if (envio.subeContrato) {
    for (const p of await subeContrato(envio)) await manda(p);
    return;
  }

  if (envio.confirmaPrecio) {
    for (const p of await precioConfirmado(envio)) await manda(p);
    /* El ticket ya dio su precio: se marca consumido también en el
       almacén, para que un segundo «va» desde otra instancia tampoco lo
       vuelva a mandar. */
    if (envio.ticketConsumido && almacen.hayAlmacen()) {
      almacen.guardaTicket(envio.ticketConsumido, envio.para, { consumido: true }).catch(function () {});
    }
    return;
  }

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
    if (hecho) {
      /* Lo que se le dice aquí también entra a la memoria corta: así el
         siguiente mensaje sabe qué ya se le pidió y no repite la lista
         (corrida real del 9-sep-2026). */
      agente.recuerda(envio.para, 'cliente', envio.crudoDelCliente);
      for (const e of hecho) {
        await manda(e);
        if (e.para === envio.para && e.texto) agente.recuerda(envio.para, 'bot', e.texto);
      }
      return;
    }
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

  /* ------------------------------------------------------------
     SI EL DUEÑO CITÓ UN TICKET QUE ESTA INSTANCIA NO RECUERDA
     ------------------------------------------------------------
     La memoria de tickets muere con la instancia; el almacén no.
     Se busca ahí el id citado y se siembra en memoria, y de paso
     se carga la ficha de ESE cliente —el aviso solo trae el número
     del dueño— para que el webhook vea su precio por confirmar.
     ------------------------------------------------------------ */
  const dueno = tickets.numeroDelDueno(process.env);
  if (dueno) {
    for (const e of (aviso.entry || [])) {
      for (const c of (e.changes || [])) {
        for (const m of (((c && c.value) || {}).messages || [])) {
          if (!m || !tickets.mismoNumero(m.from, dueno)) continue;
          /* Si tecleó el número del cliente («3312345678 …»), la ficha de
             ESE cliente también se carga: sin esto, en una instancia fría
             el webhook no veía su precio por confirmar ni sabía si el
             número existe (auditoría 7-sep-2026, hallazgo 6). */
          const tecleado = tickets.clienteDeLaRespuesta(m, tickets.tickets);
          if (tecleado && tecleado.via === 'numero' && numeros.indexOf(tecleado.cliente) < 0) numeros.push(tecleado.cliente);
          const citado = m.context && m.context.id;
          if (!citado || tickets.tickets.get(citado)) continue;
          const t = await almacen.leeTicket(citado).catch(function () { return null; });
          if (t && t.cliente) {
            tickets.recuerdaTicket(citado, t.cliente, t.carga || null);
            if (numeros.indexOf(t.cliente) < 0) numeros.push(t.cliente);
          }
        }
      }
    }
  }

  await Promise.all(numeros.map(async function (n) {
    const [ficha, charla] = await Promise.all([
      almacen.leeFicha(n).catch(function () { return null; }),
      almacen.leeCharla(n).catch(function () { return undefined; })
    ]);
    if (ficha) tickets.siembraFicha(ficha);
    if (charla) webhook.siembraCharla(n, charla);
    /* `undefined` = la lectura falló. Se recuerda para que al guardar no
       se borre una charla que sí existe (auditoría 7-sep-2026, B10). Y se
       le avisa al webhook: con el almacén caído, el candado del «número
       desconocido» no debe frenar al dueño (auditoría general del 8-sep,
       hallazgo 11). */
    charlasQueNoSePudieronLeer[tickets.llave ? tickets.llave(n) : almacen.llave(n)] = (charla === undefined);
    if (charla === undefined) webhook.marcaLecturaFallida(n);
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
/* Qué números no pudieron leer su charla en esta vuelta (llave → true). */
const charlasQueNoSePudieronLeer = {};

async function guardaLoQueQuedo(numeros, soloFicha) {
  if (!almacen.hayAlmacen()) return;
  const conCharla = numeros || [];
  const sinCharla = soloFicha || [];
  if (!conCharla.length && !sinCharla.length) return;
  await Promise.all(conCharla.map(async function (n) {
    const ficha = tickets.fichaViva(n);
    if (ficha) await almacen.guardaFicha(ficha).catch(function () {});
    const charla = webhook.charlaDe(n);
    const k = almacen.llave(n);
    const noSePudoLeer = !!charlasQueNoSePudieronLeer[k];
    delete charlasQueNoSePudieronLeer[k];
    /* Un fallo de LECTURA no produce un BORRADO: si no hay charla en
       memoria y tampoco se pudo leer, no se guarda nada (B10). */
    if (!charla && noSePudoLeer) return;
    await almacen.guardaCharla(n, charla).catch(function () {});
  }).concat(sinCharla.map(async function (n) {
    const ficha = tickets.fichaViva(n);
    if (ficha) await almacen.guardaFicha(ficha).catch(function () {});
  })));
}

const TIPO_JSON = { 'content-type': 'application/json; charset=utf-8' };
const TIPO_TEXTO = { 'content-type': 'text/plain; charset=utf-8' };

/* La versión va fija: si Meta saca una nueva y cambiara sola, el bot se
   rompería un martes sin que nadie tocara nada. */
/* A dónde se manda. Meta directo por omisión; con Dualhook (5-sep-2026)
   se pone WHATSAPP_API_BASE=https://api.dualhook.com/v25.0 y el token es
   su llave `dh_live_…`. El resto del cuerpo es idéntico: su API es
   compatible con la de Meta. */
const GRAFO = String(process.env.WHATSAPP_API_BASE || 'https://graph.facebook.com/v21.0').replace(/\/+$/, '');

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
const ESPERA_ENVIO_MS = 8000;

async function manda(envio) {
  const token = process.env.WHATSAPP_TOKEN;
  const numero = envio.numeroDeOrigen || process.env.WHATSAPP_PHONE_ID;
  if (!token || !numero) {
    console.error('[whatsapp] falta WHATSAPP_TOKEN o el numero de origen');
    return false;
  }
  /* Candado de salida: a un CLIENTE no le llega texto interno. Al dueño
     sí (los tickets traen nombres de campos a propósito). */
  const dueno = tickets.numeroDelDueno(process.env);
  const esParaElDueno = dueno && tickets.mismoNumero(envio.para, dueno);
  /* Una plantilla no manda `texto`: ese campo es solo la marca para el log
     (`[plantilla …]`), y la marca misma es texto interno. */
  if (!esParaElDueno && !envio.esTicket && !envio.plantilla && esTextoInterno(envio.texto)) {
    console.error('[fuga] se frenó un texto interno que iba a un cliente (' +
      (envio.escribio || 'sin marca') + '): ' + String(envio.texto).slice(0, 120).replace(/\n/g, ' '));
    /* Reparación del 8-sep-2026 (Falla 4): el cliente no se queda en
       silencio; recibe el texto neutro y el dueño el aviso. */
    if (dueno) {
      await manda({ numeroDeOrigen: envio.numeroDeOrigen, para: dueno, esTicket: true, sobreCliente: envio.para, pasaAPersona: false,
        texto: '⚠️ *Frené un mensaje con texto interno* para el cliente ' + envio.para +
          '. Le dije «dame un momento». Revisa el registro ([fuga]) y contéstale citando este mensaje.',
        escribio: '[incidente · fuga]' });
    }
    envio = Object.assign({}, envio, { texto: 'Dame un momento, te confirmo enseguida 🙌', opciones: [], escribio: (envio.escribio || '') + ' · filtrado' });
  }
  /* Y a un cliente que YA está en WhatsApp nunca se le manda a otro número
     (dictado del dueño, 6-sep-2026). Este candado estaba en un solo
     llamador; la auditoría del 7-sep encontró dos caminos que lo brincaban
     (el respaldo de la IA y el precio con «requiere asesor»). Aquí, en la
     única puerta de salida, ya no depende de quién armó el texto: el
     cliente recibe una espera honesta y el dueño el aviso. */
  /* FILTRO DE SALIDA (reparación del 8-sep-2026, Falla 4): nada con forma de
     código, JSON, error o instrucción le llega a un cliente. Si se frena,
     el cliente recibe un texto neutro, el incidente queda completo en el
     registro y el dueño recibe el aviso. Es aparte del candado de texto
     interno: éste ataca la FORMA, aquél el contenido del prompt. */
  if (!esParaElDueno && !envio.esTicket && !envio.plantilla && envio.texto) {
    const motivo = filtrarSalida(envio.texto, envio.escribio);
    if (motivo) {
      console.error('[filtro-salida] INCIDENTE (' + motivo + ', ' + (envio.escribio || 'sin marca') + '): ' +
        String(envio.texto).slice(0, 400).replace(/\n/g, '⏎'));
      if (dueno) {
        await manda({ numeroDeOrigen: envio.numeroDeOrigen, para: dueno, esTicket: true, sobreCliente: envio.para, pasaAPersona: false,
          texto: '⚠️ *Frené un mensaje con forma de código o error* para el cliente ' + envio.para + ' (' + motivo +
            '). Le dije «dame un momento». Revisa el registro ([filtro-salida]) y contéstale citando este mensaje.',
          escribio: '[incidente · filtro de salida]' });
      }
      envio = Object.assign({}, envio, { texto: 'Dame un momento, te confirmo enseguida 🙌', opciones: [], escribio: (envio.escribio || '') + ' · filtrado' });
    }
  }
  /* Una CLABE que no sea la configurada es un desastre (reparación Falla 6):
     cualquier número de 18 dígitos hacia un cliente que no coincida con
     `CLABE` se frena, queda como incidente crítico y se avisa al dueño. Y si
     el texto le dice al cliente que deposite y no trae la CLABE, se le anexa
     el bloque de apartado (el código, no el modelo). */
  if (!esParaElDueno && !envio.esTicket && !envio.plantilla && envio.texto) {
    const dieciocho = String(envio.texto).match(/\b\d{18}\b/g) || [];
    const clabeBuena = clabeConfigurada();
    const ajena = dieciocho.find(function (n) { return n !== clabeBuena; });
    if (ajena) {
      console.error('[CLABE-AJENA] INCIDENTE CRÍTICO: se frenó un texto con un número de 18 dígitos que no es la CLABE (' +
        (envio.escribio || 'sin marca') + '): ' + String(envio.texto).slice(0, 160).replace(/\n/g, ' '));
      if (dueno) {
        await manda({ numeroDeOrigen: envio.numeroDeOrigen, para: dueno, esTicket: true, sobreCliente: envio.para, pasaAPersona: false,
          texto: '🚨 *Frené un mensaje con una CLABE que no es la nuestra* para el cliente ' + envio.para +
            '. No le llegó nada. Revisa el registro ([CLABE-AJENA]).', escribio: '[incidente · clabe ajena]' });
      }
      return false;
    }
    const fichaDelPara = tickets.fichaDe(envio.para);
    const conPrecioYAnticipo = !!(fichaDelPara && typeof fichaDelPara.total === 'number' && fichaDelPara.total > 0 &&
      typeof fichaDelPara.anticipo === 'number' && fichaDelPara.anticipo > 0);
    const pideDepositar = /\b(deposita|transfi[eé]re|haz (el|tu) dep[oó]sito|te paso (la cuenta|los datos)|datos (de|para) (dep[oó]sito|transferencia|el dep[oó]sito))\b/i.test(String(envio.texto));
    if (conPrecioYAnticipo && pideDepositar && clabeBuena && !envio.conDatosParaCopiar &&
        !depositoMandadoAhora.has(almacen.llave(envio.para))) {
      envio = Object.assign({}, envio, { texto: String(envio.texto) + '\n\n' + bloqueApartado({ anticipo: fichaDelPara.anticipo }), conDatosParaCopiar: true });
      console.log('[apartado] se anexó el bloque de depósito a un texto que pedía depositar sin la CLABE');
      const salio = await manda(envio);
      if (salio) for (const m of mensajesParaCopiar(envio.numeroDeOrigen, envio.para)) await manda(m);
      return salio;
    }
    /* Ficha, CLABE o cuenta: una sola vez por vuelta para cada cliente. */
    if (MARCAS_DE_DEPOSITO.test(String(envio.escribio || ''))) {
      const k = almacen.llave(envio.para) + '|' + (String(envio.escribio).match(MARCAS_DE_DEPOSITO) || [])[1];
      if (depositoMandadoAhora.has(k)) { console.log('[apartado] ' + envio.escribio + ' ya se mandó en esta vuelta; no se repite'); return true; }
      depositoMandadoAhora.add(k);
      depositoMandadoAhora.add(almacen.llave(envio.para));
    }
  }
  /* Nada de «por persona» con dinero hacia un cliente (dictado del dueño,
     8-sep-2026, reparación Falla 3): el precio es total, tal cual lo puso
     el vendedor. Un texto así se frena y queda en el registro. */
  if (!esParaElDueno && !envio.esTicket && !envio.plantilla &&
      /\$\s?[\d.,]+\s*(por (persona|cabeza)|c\/u|cada (uno|quien))/i.test(String(envio.texto || ''))) {
    console.error('[por-persona] se frenó un texto con precio por persona que iba a un cliente (' +
      (envio.escribio || 'sin marca') + '): ' + String(envio.texto).slice(0, 120).replace(/\n/g, ' '));
    return false;
  }
  if (!esParaElDueno && !envio.esTicket && !envio.plantilla && !envio.reenviaMedio &&
      webhook.OTRO_NUMERO.test(String(envio.texto || ''))) {
    console.error('[otro-numero] se cambió un texto que mandaba al cliente a otro número (' +
      (envio.escribio || 'sin marca') + ')');
    envio = Object.assign({}, envio, {
      texto: 'Va, en breve te contestan por aquí mismo 🙌', opciones: [], pasaAPersona: false,
      escribio: (envio.escribio || '') + ' · sin otro número'
    });
    if (dueno) {
      await manda({
        numeroDeOrigen: envio.numeroDeOrigen, para: dueno, esTicket: true, sobreCliente: envio.para,
        pasaAPersona: false, escribio: '[ticket · quiere hablar contigo]',
        texto: '🙋 *Quiere hablar contigo*\n\nEl guion quiso mandarlo al teléfono; le dije que en breve ' +
          'se le contesta por aquí. Contéstame *este mensaje* y le llega tal cual.\n_cliente: ' + envio.para + '_'
      });
    }
  }
  try {
    const r = await fetch(GRAFO + '/' + numero + '/messages', {
      method: 'POST',
      /* Tope de tiempo: Meta reintenta el aviso a los ~30 s, y un envío
         colgado es la forma más fácil de que el cliente reciba todo dos
         veces (auditoría 7-sep-2026). */
      signal: AbortSignal.timeout(ESPERA_ENVIO_MS),
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
          ? (function () {
              /* Foto y PDF llevan pie; audio y video no lo admiten. */
              const tipo = ['image', 'document', 'audio', 'video'].indexOf(envio.tipoMedio) >= 0
                ? envio.tipoMedio : 'image';
              const medio = { id: envio.reenviaMedio };
              if ((tipo === 'image' || tipo === 'document' || tipo === 'video') && envio.texto) medio.caption = envio.texto;
              const cuerpo = { type: tipo };
              cuerpo[tipo] = medio;
              return cuerpo;
            })()
          /* Una PLANTILLA aprobada por Meta, para escribirle a quien
             lleva más de 24 h sin contestar: fuera de esa ventana Meta
             rechaza el texto libre (código 131047). Sin variables: el
             texto completo vive en la plantilla (docs/SEGUIMIENTO.md). */
          : envio.plantilla
          ? {
              type: 'template',
              template: Object.assign({
                name: envio.plantilla.nombre,
                language: { code: envio.plantilla.idioma || 'es_MX' }
              }, (envio.plantilla.parametros && envio.plantilla.parametros.length)
                /* Las variables del cuerpo ({{1}}, {{2}}…), en orden. Con el
                   destino del cliente el mensaje deja de sonar a plantilla
                   (investigación del 7-sep-2026, docs/SEGUIMIENTO.md). */
                ? { components: [{ type: 'body', parameters: envio.plantilla.parametros.map(function (p) {
                    return { type: 'text', text: String(p) };
                  }) }] }
                : {})
            }
          /* Una foto NUESTRA, por su direccion publica. Meta la baja
             sola: no hay que subirla ni guardar su id. Asi es como se
             le enseña al cliente la unidad que le tocaria, junto con
             el precio. */
          : envio.ligaDeFoto
          ? {
              type: 'image',
              image: Object.assign({ link: envio.ligaDeFoto }, envio.texto ? { caption: envio.texto } : {})
            }
          /* Un ARCHIVO nuestro por su dirección firmada: el PDF del contrato
             que devuelve EuroSystem. Meta lo baja y lo entrega como
             documento dentro de la plática, así que al cliente le queda el
             archivo guardado aunque la liga venza a los 30 días (dictado
             del dueño, 9-sep-2026: «mandas el PDF al cliente, me lo mandas
             a mí, y lo subes al sistema»). Si Meta no lo puede bajar, más
             abajo se manda `textoDeRespaldo` con la liga: nadie se queda
             sin el contrato. */
          : envio.ligaDeDocumento
          ? {
              type: 'document',
              document: Object.assign({ link: envio.ligaDeDocumento },
                envio.nombreDeArchivo ? { filename: envio.nombreDeArchivo } : {},
                envio.texto ? { caption: envio.texto } : {})
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
      /* El contrato no se pierde porque Meta no haya podido bajar el PDF
         (liga caída, archivo muy grande, tipo que no le gustó): va la liga
         en texto, que es lo que se mandaba antes de que hubiera archivo. */
      if (envio.ligaDeDocumento && envio.textoDeRespaldo) {
        console.error('[whatsapp] el PDF no salió; se manda la liga en texto');
        return await manda(Object.assign({}, envio, {
          ligaDeDocumento: null, nombreDeArchivo: null,
          texto: envio.textoDeRespaldo, textoDeRespaldo: null,
          escribio: (envio.escribio || '') + ' · liga en texto'
        }));
      }
      return false;
    }
    /* Lo que solo debe pasar si WhatsApp aceptó el mensaje (la etapa
       «ya tiene precio», el precio aprendido). Auditoría 7-sep-2026, C9. */
    if (typeof envio.alMandar === 'function') {
      try { envio.alMandar(); } catch (e) { console.error('[whatsapp] alMandar tronó: ' + e.message); }
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
        if (id) {
          tickets.recuerdaTicket(id, envio.sobreCliente, envio.carga || null);
          /* Y al almacén, para cuando esta instancia ya no exista. Sin
             esperar: a Meta hay que contestarle rápido. */
          if (almacen.hayAlmacen()) almacen.guardaTicket(id, envio.sobreCliente, envio.carga || null).catch(function () {});
        }
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
    /* Una plantilla NO se anota aquí: su `texto` es la marca «[plantilla …]»
       y `mandaSeguimientos` ya anota el texto real (auditoría general del
       8-sep, hallazgo 14). */
    if (!envio.esTicket && envio.para && envio.ligaDeFoto) {
      /* Una foto queda como ACCIÓN en la conversación guardada, con su
         pie si lo lleva: así el historial que se le siembra al modelo
         dice qué mandó (reparación del 8-sep, Falla 2). */
      almacen.anotaMensaje(envio.para, 'bot',
        '[Acción: envié foto' + (envio.texto ? ' — ' + String(envio.texto).slice(0, 80) : '') + ']', 'foto')
        .catch(function () {});
    } else if (!envio.esTicket && envio.para && envio.texto && !envio.plantilla) {
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

/* ------------------------------------------------------------
   LAS DOS PUERTAS, EN UNA SOLA FUNCIÓN
   ------------------------------------------------------------
   `/api/whatsapp` es la de siempre: Meta firma con NUESTRO secreto.
   `/api/whatsapp/<tramo secreto>` es la de Dualhook (5-sep-2026): la
   firma viene con el secreto de ellos, que no comparten, así que la
   puerta es el tramo secreto de la URL y el webhook comprueba que el
   aviso sea de nuestro WABA y nuestro número.

   Las dos viven en ESTE archivo: Vercel reescribe `/api/whatsapp/X`
   a `/api/whatsapp?llave=X` (vercel.json). Una función aparte habría
   sido la número 13 y el plan permite 12 —lo cazó `probar-despliegue`—.
   Con `llave` presente y equivocada: 404 a secas, sin pista. Con
   `llave` buena, `RUTA_SECRETA_OK` en el entorno le dice a `procesa`
   por cuál puerta entró.
   ------------------------------------------------------------ */
const NO_HAY = 'No encontrado';

function llaveDeLaUrl(a, esWeb) {
  if (esWeb) return new URL(a.url).searchParams.get('llave');
  const q = (a && a.query) || {};
  return q.llave === undefined ? null : String(q.llave);
}

/* ------------------------------------------------------------
   EL SEGUIMIENTO · cada 15 minutos, a quien no contestó
   ------------------------------------------------------------
   Vercel llama GET /api/whatsapp/seguimiento (el cron de vercel.json)
   con `Authorization: Bearer <CRON_SECRET>`, que Vercel mismo pone
   cuando esa variable existe. Sin la variable no corre nada (503, y
   se ve en el registro); con una llave que no es, 404 como cualquier
   tramo equivocado. Se compara sin cortocircuito, como todo secreto.

   La decisión de a quién y cuál está en `_seguimiento.js`; los
   textos en `_recordatorios.js`. Aquí solo se lee la base, se marca
   y se manda.

   Se marca ANTES de mandar: si se marcara después y el envío tronara
   a medias, el cliente recibiría el mismo toque cada 15 minutos.
   Perder un toque es barato; repetirlo, no.
   ------------------------------------------------------------ */
async function mandaSeguimientos(ahora) {
  const t = ahora || Date.now();
  const cuenta = { revisadas: 0, mandados: 0, cerradas: 0, esperan: 0, sinPlantilla: 0, alDueno: 0 };
  if (!almacen.hayAlmacen()) {
    console.error('[seguimiento] sin almacén: no hay fichas que seguir');
    return cuenta;
  }
  const fichas = await almacen.fichasDeSeguimiento().catch(function () { return null; });
  if (!fichas) return cuenta;
  /* Los que le tocan al dueño se juntan en UN mensaje al final. */
  const paraElDueno = [];

  for (const f of fichas) {
    cuenta.revisadas++;
    const d = seguimiento.decide(f, t);
    const hechos = Number(f.toques) || 0;
    if (d.cerrar) {
      await almacen.marcaToque(f.cliente, hechos, seguimiento.HORAS.length).catch(function () {});
      cuenta.cerradas++;
      continue;
    }
    if (!d.toque) { cuenta.esperan++; continue; }

    /* Primero se arma el envío. Desde el 8-sep-2026 («quitamos lo de
       Meta») siempre hay algo que hacer: texto libre si la ventana está
       abierta, plantilla si la hay, y si no, el toque se lo lleva el dueño
       (`alDueno`). Solo queda sin envío si no hay texto para ese toque. */
    const envio = envioDelToque(f, d);
    if (!envio) { cuenta.sinPlantilla++; continue; }

    /* La marca es condicional (B9/C13): solo gana la corrida que vio
       `toques` en el valor leído. Sin marca no se manda. */
    const marcada = await almacen.marcaToque(f.cliente, hechos, d.toque).catch(function () { return false; });
    if (!marcada) { cuenta.enOtraCorrida = (cuenta.enOtraCorrida || 0) + 1; continue; }

    if (envio.alDueno) {
      /* Fuera de la ventana y sin plantilla: le toca al dueño, desde su
         teléfono. Se marca el toque (no se repite) y se junta en el
         resumen. */
      const v = f.viajeDatos || {};
      paraElDueno.push('• ' + f.cliente + ' · ' + (v.destino || 'viaje') + (v.salida ? ' ' + tickets.comoSeDice(v.salida) : '') +
        (v.gente ? ' · ' + v.gente + ' pax' : '') + (typeof f.total === 'number' ? ' · $' + f.total.toLocaleString('en-US') : '') +
        ' · ' + (d.toque === 2 ? 'día 3' : d.toque === 3 ? 'día 7' : 'día 1'));
      cuenta.alDueno++;
      continue;
    }

    if (await manda(envio)) {
      cuenta.mandados++;
      /* A la memoria va lo que el cliente LEYÓ, nunca la marca
         `[plantilla …]`: esa marca se sembraba luego en el historial del
         agente como turno suyo, y es justo lo que la IA copia
         (auditoría 7-sep-2026, hallazgo 5). */
      almacen.anotaMensaje(f.cliente, 'bot', envio.textoParaLaMemoria || envio.texto, 'texto').catch(function () {});
    }
  }
  const dueno = tickets.numeroDelDueno(process.env);
  if (paraElDueno.length && !dueno) {
    console.error('[seguimiento] ' + paraElDueno.length + ' toque(s) le tocan al dueño pero falta DUENO_WHATSAPP; quedaron marcados sin avisar');
  }
  if (paraElDueno.length && dueno) {
    await manda({
      numeroDeOrigen: process.env.WHATSAPP_PHONE_ID, para: dueno, esTicket: true, pasaAPersona: false,
      texto: '📋 *Seguimiento: escríbeles tú desde tu teléfono*\n\nNo contestaron después del precio y ya pasó la ventana ' +
        'de 24 h de WhatsApp (para no pagar plantillas). Un mensaje corto tuyo los despierta:\n\n' + paraElDueno.join('\n') +
        '\n\nIdeas: «¿cómo va lo del viaje? si cambió algo te lo ajusto» (día 3) · «te escribo por última vez; si sigue en pie ' +
        'dime y te digo cómo apartar» (día 7).',
      escribio: '[seguimiento · al dueño]'
    });
  }
  console.log('[seguimiento] ' + JSON.stringify(cuenta));
  return cuenta;
}

/* Texto libre si la ventana de 24 h de Meta sigue abierta (el toque de
   las 22 h cae ahí a propósito); si no, la plantilla aprobada cuyo nombre
   está en WHATSAPP_PLANTILLA_TOQUE1/2/3; y sin plantilla, `{ alDueno }`:
   el dueño le escribe desde su teléfono. */
function envioDelToque(f, d) {
  const base = { numeroDeOrigen: process.env.WHATSAPP_PHONE_ID, para: f.cliente };
  if (d.ventanaAbierta) {
    const v = f.viajeDatos || {};
    const texto = recordatorios.recordatorio(d.toque, {
      cliente: f.cliente,
      /* Con el instante del precio: si el mismo cliente cotiza otro
         viaje el mes que entra, le toca otra variante. */
      vuelta: Math.floor((f.precioEn || 0) / 1000),
      fecha: v.salida ? tickets.comoSeDice(v.salida) : null,
      /* Nadie comprobó el calendario aquí: va el juego que NO afirma
         que la fecha está libre. */
      fechaLibre: false
    });
    return texto ? Object.assign(base, { texto: texto }) : null;
  }
  const nombre = process.env['WHATSAPP_PLANTILLA_TOQUE' + d.toque];
  if (!nombre) {
    /* Sin plantilla (lo normal desde el 8-sep-2026: «quitamos lo de Meta»):
       el toque no se le manda al cliente; se le avisa al dueño para que le
       escriba él desde su teléfono, que no paga ventana. */
    return { alDueno: true };
  }
  /* {{1}} = «tu viaje a Puerto Vallarta» (o «tu viaje» si no se sabe el
     destino): la única variable de las tres plantillas. Nunca vacía, nunca
     con signos raros (regla de Meta). */
  const v = f.viajeDatos || {};
  const destino = String(v.destino || '').replace(/[#$%{}]/g, '').trim();
  const viaje = destino ? 'tu viaje a ' + destino : 'tu viaje';
  /* Lo que se guarda en la memoria del cliente es el texto libre del mismo
     toque (el que dice lo mismo que la plantilla), no la marca. */
  const textoLibre = recordatorios.recordatorio(d.toque, {
    cliente: f.cliente, vuelta: Math.floor((f.precioEn || 0) / 1000),
    fecha: v.salida ? tickets.comoSeDice(v.salida) : null, fechaLibre: false
  });
  return Object.assign(base, {
    plantilla: { nombre: nombre, idioma: process.env.WHATSAPP_PLANTILLA_IDIOMA || 'es_MX', parametros: [viaje] },
    texto: '[plantilla ' + nombre + ' · ' + viaje + ']',
    textoParaLaMemoria: textoLibre || ('Te escribí para retomar ' + viaje + ' 🙌')
  });
}

function llaveDelCronValida(cabecera, secreto) {
  if (!secreto || String(secreto).length < 16) return false;
  const a = Buffer.from(String(cabecera || ''));
  const b = Buffer.from('Bearer ' + String(secreto));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

async function atiendeSeguimiento(a, b, esWeb) {
  const cabecera = esWeb
    ? a.headers.get('authorization')
    : (a.headers && (a.headers.authorization || a.headers.Authorization));
  const contesta = function (status, cuerpo, texto) {
    if (!esWeb) {
      if (texto) b.status(status).send(texto); else b.status(status).json(cuerpo);
      return;
    }
    return texto
      ? new Response(texto, { status: status, headers: TIPO_TEXTO })
      : new Response(JSON.stringify(cuerpo), { status: status, headers: TIPO_JSON });
  };
  const secreto = process.env.CRON_SECRET;
  if (!secreto || String(secreto).length < 16) {
    /* Hacia afuera, lo mismo que cualquier tramo equivocado: un 404 que no
       cuenta que existe el seguimiento ni que está sin configurar
       (auditoría 7-sep-2026). El detalle, solo al registro. */
    console.error('[seguimiento] falta CRON_SECRET en Vercel (16+ caracteres): el cron no corre');
    return contesta(404, null, NO_HAY);
  }
  if (!llaveDelCronValida(cabecera, secreto)) return contesta(404, null, NO_HAY);
  if (a.method !== 'GET') return contesta(405, { error: 'Método no permitido' });
  avisaEstadoDelAlmacen();
  /* El mismo reloj de mentiras que usa el webhook en las pruebas, y que
     en producción se ignora. */
  const reloj = webhook.relojDe(process.env);
  /* La purga de 45 días (`tiraLoViejo`) no la llamaba nadie (auditoría
     7-sep-2026, B8): va aquí, en la corrida de las 4 de la mañana de
     Guadalajara, una vez por día por instancia. Es idempotente: si dos
     instancias la corren, no pasa nada. */
  const dia = new Date(reloj).toISOString().slice(0, 10);
  if (seguimiento.horaEnGuadalajara(reloj) === 4 && ultimaPurga !== dia && almacen.hayAlmacen()) {
    ultimaPurga = dia;
    almacen.tiraLoViejo().then(function () { console.log('[almacen] purga de ' + almacen.VIDA_DIAS + ' días hecha'); })
      .catch(function (e) { console.error('[almacen] la purga falló: ' + (e && e.message)); });
  }
  return contesta(200, await mandaSeguimientos(reloj));
}
let ultimaPurga = '';

async function atiende(a) {
  const b = arguments[1];
  const esWeb = a && typeof a.arrayBuffer === 'function' &&
    a.headers && typeof a.headers.get === 'function';
  const llave = llaveDeLaUrl(a, esWeb);
  if (llave === null) return atiendeInterno(a, b, {});
  /* La puerta del cron va ANTES del tramo secreto: «seguimiento» no es
     un tramo, es un nombre fijo, y su llave es otra (CRON_SECRET). */
  if (llave === 'seguimiento') return atiendeSeguimiento(a, b, esWeb);
  if (!webhook.rutaSecretaValida(llave, process.env.WHATSAPP_RUTA_SECRETA)) {
    if (!esWeb) { b.status(404).send(NO_HAY); return; }
    return new Response(NO_HAY, { status: 404, headers: TIPO_TEXTO });
  }
  return atiendeInterno(a, b, { rutaSecreta: true });
}

/* Una vez por instancia: si el almacén no está, la memoria del bot muere con
   la instancia y el agente «olvida» la plática. Que se lea en el registro sin
   adivinar. Sin secretos: solo sí o no. */
let avisoDeAlmacenDado = false;
function avisaEstadoDelAlmacen() {
  if (avisoDeAlmacenDado) return;
  avisoDeAlmacenDado = true;
  console.log(almacen.hayAlmacen()
    ? '[almacen] conectado: la memoria sobrevive a la instancia'
    : '[almacen] SIN CONFIGURAR (faltan ALMACEN_URL o ALMACEN_CLAVE): la memoria vive solo en esta instancia');
}

async function atiendeInterno(a, b, opciones) {
  avisaEstadoDelAlmacen();
  const marcaDePuerta = { RUTA_SECRETA_OK: (opciones && opciones.rutaSecreta) ? '1' : '' };
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

    const r = await atiendeElAviso(crudo, a.headers.get('x-hub-signature-256'), marcaDePuerta);
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

  const r = await atiendeElAviso(crudo, req.headers['x-hub-signature-256'], marcaDePuerta);
  res.status(r.status).json(r.cuerpo);
}

/* ------------------------------------------------------------
   UN SOLO CAMINO PARA LAS DOS FIRMAS (Web y Node)
   ------------------------------------------------------------
   Antes eran dos copias; una decía `manda` donde la otra decía `reparte`
   y el defecto durmió hasta que se notó. Y el orden importa (auditoría
   del 7-sep-2026):
     1 · LA PUERTA PRIMERO. Firma o tramo secreto + WABA, y cuerpo
         legible, ANTES de bajar audios, leer el almacén o escribir en
         él. Hasta hoy `cargaLoQueSeSabe` escribía los mensajes de
         cualquiera y `POST /api/whatsapp` sin llave es público.
     2 · Cada envío va en su propio try/catch: un tropiezo en uno no
         tumba el webhook (500 → Meta reintenta → el id ya estaba
         marcado → el mensaje se perdía para siempre).
     3 · Lo que quedó se guarda solo si el aviso fue bueno (200).
   OJO CON EL ENTORNO · `procesa` usa lo que le llegue EN LUGAR de
   `process.env`, no además. Por eso va el entorno completo con los
   audios y la marca de la puerta.
   ------------------------------------------------------------ */
async function atiendeElAviso(crudo, firma, marcaDePuerta) {
  const entorno = Object.assign({}, process.env, marcaDePuerta);
  const puerta = webhook.revisaLaPuerta(crudo, firma, entorno);
  if (puerta.rechazo) return puerta.rechazo;

  const [audios, numeros] = await Promise.all([
    transcribeLosAudios(crudo),
    cargaLoQueSeSabe(crudo)
  ]);
  atendidosPorElAgenteAhora.clear();
  depositoMandadoAhora.clear();
  /* Los ids que el almacén ya vio desde otra instancia: no se contestan dos
     veces (hallazgo 10 de la auditoría general del 8-sep). */
  const repetidos = await almacen.marcaVistos(webhook.idsDelAviso(crudo)).catch(function () { return new Set(); });
  /* Tres mensajes seguidos del mismo cliente en un aviso son UN turno: se
     unen en uno solo antes de procesar (reparación del 8-sep, Falla 2,
     prueba R5). El cuerpo se vuelve a firmar con el secreto de Meta. */
  const unido = uneLaRafaga(crudo, firma);
  const r = webhook.procesa(unido.crudo, unido.firma, Object.assign({}, entorno, { audios, repetidos }));
  /* Una ráfaga: dos mensajes del mismo cliente en un aviso. `procesa` es
     síncrona y el agente corre después, así que el segundo traía como
     «estado de antes» lo que el GUION entendió del primero, no lo que
     leyó la IA (auditoría 7-sep-2026, A8). Del segundo en adelante, el
     estado de antes es la plática que el agente acaba de guardar. */
  const yaAtendidosPorElAgente = [];
  for (const envio of r.envios) {
    try {
      if (envio && envio.agente && envio.crudoDelCliente && envio.para) {
        const repetido = yaAtendidosPorElAgente.some(function (n) { return tickets.mismoNumero(n, envio.para); });
        if (repetido) envio.estadoAntes = webhook.charlaDe(envio.para);
        else yaAtendidosPorElAgente.push(envio.para);
      }
      await reparte(envio);
    } catch (e) {
      console.error('[whatsapp] un envío tronó y se siguió con los demás (' +
        (envio && envio.escribio ? envio.escribio : 'sin marca') + '): ' + (e && e.message));
    }
  }
  /* Los clientes TOCADOS en esta vuelta también se guardan, no solo los
     que escribieron (B2/C1): el «va» del dueño llega en un aviso que solo
     trae su número, y lo que `precioDe` anotó en la ficha del cliente se
     moría con la instancia. De esos solo se guarda la ficha, no la
     charla: su charla no se cargó y guardarla vacía la borraría. */
  const dueno = tickets.numeroDelDueno(process.env);
  const tocados = [];
  for (const envio of r.envios) {
    [envio && envio.para, envio && envio.sobreCliente].forEach(function (n) {
      if (!n || (dueno && tickets.mismoNumero(n, dueno))) return;
      if (numeros.some(function (x) { return tickets.mismoNumero(x, n); })) return;
      if (!tocados.some(function (x) { return tickets.mismoNumero(x, n); })) tocados.push(n);
    });
  }
  if (r.status === 200) {
    try { await guardaLoQueQuedo(numeros, tocados); } catch (e) {
      console.error('[whatsapp] no se pudo guardar lo que quedó: ' + (e && e.message));
    }
  }
  return r;
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
/* Solo para probar el candado de salida sin pasar por todo el webhook. */
export { manda };
