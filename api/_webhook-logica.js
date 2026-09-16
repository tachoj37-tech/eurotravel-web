/* ============================================================
   Webhook de Stripe — función serverless de Vercel
   ------------------------------------------------------------
   Stripe avisa aqui cuando un pago se concreta, y aqui se
   registra el contrato en EuroSystem.

   POR QUE HACE FALTA
   ------------------
   Antes, la unica forma de enterarse de un pago era que el
   cliente regresara a la pagina. Si cerraba la pestaña, o si
   pagaba el voucher de OXXO tres dias despues en la tienda, el
   dinero entraba y NADIE se enteraba salvo que alguien mirara el
   panel de Stripe a mano.

   LOS DOS EVENTOS
   ---------------
   checkout.session.completed              tarjeta: paga al momento
   checkout.session.async_payment_succeeded  OXXO: paga dias despues

   El primero tambien llega con OXXO, pero con payment_status
   `unpaid` —el voucher se genero, el dinero no ha entrado—. Por
   eso no basta con el nombre del evento: se revisa el estado del
   pago antes de registrar nada.

   QUE CONTESTA, Y POR QUE IMPORTA
   -------------------------------
   Stripe reintenta hasta tres dias mientras la respuesta no sea
   2xx. Eso se aprovecha:

     · 200  el contrato EXISTE en EuroSystem —recien creado o
            «ya existia»— y el cliente tiene su correo. Tambien
            para lo que no nos toca: un evento que se ignora, una
            sesion ajena, un OXXO sin pagar todavia.
     · 500  el cobro esta hecho y el contrato NO existe, sea cual
            sea la razon: falta una llave, EuroSystem no contesto,
            o rechazo los datos. Que Stripe insista le da tres dias
            a la oficina para acomodarlo y que el contrato se cree
            solo. Insistir es gratis: la puerta es idempotente por
            `referenciaExterna` (§5) y jamas hace un gemelo.
     · 400  la firma no cuadra. No es Stripe.

   LA REGLA, EN UNA LINEA: nunca 200 sobre un cobro cuyo contrato
   no existe. Un 200 es Stripe dando el aviso por entregado y no
   volviendo nunca; despues de eso, del cobro solo queda un renglon
   en el registro que nadie va a ir a leer.

   LA LLAVE DE EUROSYSTEM ES DE SERVIDOR A SERVIDOR
   ------------------------------------------------
   `CONTRATOS_API_KEY` vive solo en las variables de Vercel y
   jamas sale de aqui. Quien la vea puede registrar contratos a
   nombre de la empresa.
   ============================================================ */

const firma = require('./_firma-stripe');

// El dominio definitivo de EuroSystem (dictado del dueño, 5-sep-2026); la dirección vieja redirige.
const EUROSYSTEM = process.env.EUROSYSTEM_URL || 'https://eurosystem.site';
const PUERTA = '/api/contratos/externo';
/* La puerta de reversas, la de verdad: CONTRATOS-API.md §13.
   Estuvo apuntando a `/api/contratos/reversa-externa`, que NO EXISTE ni
   existió nunca — era el nombre que se le puso de memoria a una puerta que
   todavía se estaba pidiendo. El 404 constante se leía como «aún no está» y
   el correo a la oficina tapaba el hueco, así que ninguna reversa se registró
   jamás en EuroSystem y nadie lo notaba. */
const PUERTA_REVERSA = '/api/contratos/abono-externo/revertir';

/* El centro de Mexico. Fijo, no calculado: Mexico dejo el horario de verano en
   2022, asi que -06:00 vale todo el año. La puerta de EuroSystem RECHAZA una
   fecha sin zona horaria, y con razon: sin ella cada servidor la lee en la
   suya y el camion sale seis horas antes. */
const ZONA = '-06:00';

function conZona(fecha) {
  const t = String(fecha || '').trim();
  if (!t) return '';
  if (/(Z|[+-]\d{2}:?\d{2})$/.test(t)) return t;          // ya la trae
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(t)) return t + ':00' + ZONA;
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/.test(t)) return t + ZONA;
  if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return t + 'T00:00:00' + ZONA;
  return '';
}

/* ------------------------------------------------------------
   EL SOLO IDA (15-sep-2026)
   ------------------------------------------------------------
   La página manda `regreso: ''` cuando el viaje es solo ida, y
   `/api/pagar` lo cobra como tal: `redondo` es falso justamente
   cuando no hay regreso. Aquí ese vacío se volvía una fecha vacía,
   la revisión de «fechas ilegibles» contestaba 200 y el pago se
   quedaba COBRADO sin contrato y sin correo.

   La puerta de EuroSystem exige `fechaRegreso` con zona y POSTERIOR
   a la salida (CONTRATOS-API.md §2, `tipos.ts`). Así que el solo ida
   se registra como SENCILLO con el regreso al cierre del mismo día,
   igual que resolvió el bot los viajes de un día el 10-sep-2026. Las
   observaciones dicen que esa hora no es un acuerdo.

   Se reconoce por `viaje: 'SENCILLO'` —lo escribe `pagar.js` desde
   hoy— o por el regreso vacío, que es como vienen las sesiones
   pagadas antes de este arreglo (un OXXO se paga días después).
   ------------------------------------------------------------ */
function esSoloIda(m) {
  if (String(m.viaje || '').toUpperCase() === 'SENCILLO') return true;
  if (String(m.viaje || '').toUpperCase() === 'REDONDO') return false;
  return !String(m.regreso || '').trim() && !!String(m.salida || '').trim();
}

/* El cierre del día de la salida, con zona. Si la salida ya es a esa hora
   o después, el regreso pasa al primer minuto del día siguiente: un regreso
   IGUAL a la salida también lo rechaza EuroSystem. Las fechas se arman con
   Date.UTC sobre los números sueltos, sin leer texto como fecha local. */
function regresoDelSoloIda(salida) {
  const conz = conZona(salida);
  const p = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})/.exec(conz);
  if (!p) return '';
  const cierre = p[1] + '-' + p[2] + '-' + p[3] + 'T23:59:59' + ZONA;
  if (Date.parse(cierre) > Date.parse(conz)) return cierre;
  const siguiente = new Date(Date.UTC(Number(p[1]), Number(p[2]) - 1, Number(p[3]) + 1));
  const dd = function (n) { return String(n).padStart(2, '0'); };
  return siguiente.getUTCFullYear() + '-' + dd(siguiente.getUTCMonth() + 1) + '-' +
    dd(siguiente.getUTCDate()) + 'T00:59:00' + ZONA;
}

/* La liga del cliente vence 90 días después de su regreso. El solo ida no
   tiene regreso, y sin fecha la liga vencía a los 30 días de HOY: un viaje a
   seis meses se quedaba sin liga antes de salir. Se cuenta desde la salida. */
function ultimoDiaDelViaje(m) {
  return String(m.regreso || '').trim() || String(m.salida || '').trim();
}

/* AUTOBUS | SPRINTER | SUBURBAN, a partir de como se vende la unidad. */
function claseDeUnidad(nombre) {
  const n = String(nombre || '').toLowerCase();
  if (n.indexOf('sprinter') >= 0) return 'SPRINTER';
  if (n.indexOf('suburban') >= 0) return 'SUBURBAN';
  if (n.indexOf('irizar') >= 0 || n.indexOf('neobus') >= 0 || n.indexOf('autob') >= 0) return 'AUTOBUS';
  return null;
}

/* Arma el cuerpo que pide CONTRATOS-API.md a partir de la metadata que
   pagar.js guardo en la sesion de Stripe. */
function contratoDesde(m, sesion) {
  const nombre = String(m.nombre || '').trim();
  const partes = nombre.split(/\s+/);

  /* ------------------------------------------------------------
     LO QUE SE COBRO DE MAS, DICHO EN PALABRAS

     La oficina tiene que poder cuadrar el total con el cliente sin abrir
     Stripe. Y durante un tiempo no pudo: esta frase solo sabía hablar de
     `nochesExtra`, que es la cuenta del PAQUETE —3 noches incluidas, mil
     por cada una de más—.

     Cuando el viaje trae movimientos la estadía se cobra de otra forma:
     día por día, mil pesos cada día, y entonces `nochesExtra` vale CERO y
     el importe vive en `importeNoches`. Con la frase vieja, ese dinero no
     se mencionaba: un viaje de cuatro días con movimientos dejaba $4,000
     del total sin explicar, y uno de ocho, $8,000.

     Se decide por `movDias`, que es el mismo dato que decide la regla en
     `_tarifa.js`. Hay prueba que suma las cantidades que esta frase
     menciona y exige que den todo lo que pasa del traslado.
     ------------------------------------------------------------ */
  const movDias = Number(m.movDias) || 0;
  const nochesExtra = Number(m.nochesExtra) || 0;
  const importeNoches = Number(m.importeNoches) || 0;
  const diasDeViaje = Number(m.dias) || 0;
  const extras = [];
  if (movDias && importeNoches) {
    /* con movimientos: la estadía es día por día, y no hay noches incluidas */
    extras.push((diasDeViaje || Math.round(importeNoches / 1000)) +
      (diasDeViaje === 1 ? ' día de estadía' : ' días de estadía') +
      ' ($' + importeNoches.toLocaleString('es-MX') + ')');
  } else if (nochesExtra) {
    extras.push(nochesExtra + (nochesExtra === 1 ? ' noche extra' : ' noches extra') +
      ' ($' + importeNoches.toLocaleString('es-MX') + ')');
  }
  if (movDias) {
    extras.push(movDias + (movDias === 1 ? ' día' : ' días') + ' con movimientos en destino ' +
      '($' + (Number(m.movImporte) || 0).toLocaleString('es-MX') + ')');
  }
  /* Hay destinos donde el día de movimientos cuesta lo mismo sin importar las
     horas. Si la oficina no lo lee aquí, va a creer que el precio salió mal. */
  const regla = String(m.reglaDestino || '').trim();
  const extrasTexto = extras.length
    ? ' El total incluye ' + extras.join(' y ') + '.' +
      (movDias
        ? (regla
            ? ' En ' + regla + ' el día con movimientos es tarifa fija, sin importar las horas.'
            : ' Cada día con movimientos cubre 8 horas dentro de la zona metropolitana ' +
              'del destino, o 40 km a la redonda del centro.')
        : '')
    : '';

  /* Los pasajeros que anotó `pagar.js`, ya revisados contra la unidad. Se
     vuelven a acotar al rango de la puerta (1–90): un número fuera de ahí
     haría que EuroSystem rechazara el contrato ENTERO con un 422. */
  const paxCrudo = String(m.pasajeros == null ? '' : m.pasajeros).trim();
  const paxNum = /^\d{1,3}$/.test(paxCrudo) ? Number(paxCrudo) : 0;
  const pasajerosDados = (paxNum >= 1 && paxNum <= 90) ? paxNum : 0;

  const soloIda = esSoloIda(m);
  const notaSoloIda = soloIda
    ? ' VIAJE SENCILLO (solo ida): el regreso de las 23:59 del contrato no es una hora ' +
      'acordada, es el cierre del día que pide el sistema.'
    : '';

  return {
    /* La misma reserva nunca genera dos contratos, y los folios de EuroSystem
       son consecutivos: un gemelo deja un hueco que ya no se cierra. El id de
       la sesion de Stripe es unico y estable entre reintentos, asi que es la
       referencia perfecta. */
    referenciaExterna: 'WEB-' + String(sesion.id || '').slice(0, 70),
    observaciones: 'Reservado en línea. Folio de la página: ' + (m.folio || '—') +
      '. Anticipo pagado con Stripe' +
      (sesion.payment_method_types && sesion.payment_method_types.length
        ? ' (' + sesion.payment_method_types.join(', ') + ')' : '') + '. ' +
      /* Desde el 15-sep-2026 el cotizador SÍ pregunta cuántos van y
         `/api/pagar` los revisa contra la capacidad de la unidad. Las
         sesiones pagadas antes no los traen: ahí el «1» de abajo es el valor
         por omisión de la puerta, no un dato del cliente, y hay que decirlo o
         la oficina se lo cree. */
      (pasajerosDados
        ? 'Pasajeros: ' + pasajerosDados + ', los capturó el cliente en línea.'
        : 'PASAJEROS: no se capturaron en línea, confirmar con el cliente.') +
      notaSoloIda +
      extrasTexto,
    cliente: {
      nombre: partes[0] || nombre || 'Sin nombre',
      apellidos: partes.slice(1).join(' ') || undefined,
      telefono: String(m.telefono || '').trim(),
      email: String(m.correo || (sesion.customer_details && sesion.customer_details.email) || '').trim() || undefined
    },
    servicio: {
      fechaSalida: conZona(m.salida),
      fechaRegreso: soloIda ? regresoDelSoloIda(m.salida) : conZona(m.regreso),
      origen: String(m.origen || '').trim() || 'Por confirmar',
      destino: String(m.destino || '').trim() || 'Por confirmar',
      /* El punto exacto donde se recoge al grupo, con referencias. Es un campo
         aparte del origen a propósito: «Guadalajara» no le sirve al operador
         a las seis de la mañana, «afuera del Tec, puerta 3» sí. */
      direccionSalida: String(m.puntoSalida || '').trim() || undefined,
      /* Antes iba fijo en 'REDONDO', también para el solo ida. */
      tipoViaje: soloIda ? 'SENCILLO' : 'REDONDO',
      /* Las paradas y los días con movimiento, que es exactamente para lo que
         existe este campo: «paradas, horarios, lo que se acordó». Van juntos
         porque el contrato tiene un solo itinerario, y separados por renglón
         para que se lean como dos cosas distintas. */
      itinerario: [
        String(m.paradas || '').trim() ? 'Paradas o escalas: ' + String(m.paradas).trim() : '',
        String(m.movDetalle || '').trim() ? 'Movimientos: ' + String(m.movDetalle).trim() : ''
      ].filter(Boolean).join('\n') || undefined,
      /* `conMovimientos` NO se manda, ni siquiera cuando el cliente contestó
         que no habrá. En EuroSystem, `false` libera la unidad para otro
         servicio los días de en medio, y esa decisión no la puede tomar un
         formulario de internet: el cliente que dice "sin movimientos" muchas
         veces igual espera el camión estacionado en el hotel. Sin el campo,
         EuroSystem se queda en `true`, que es el lado seguro, y la oficina lo
         cambia si está segura. Lo que sí viaja es el dato completo: cuántos
         días con movimiento se pagaron y qué se capturó en cada uno. */
      tipoUnidad: claseDeUnidad(m.unidad) || undefined,
      tipoUnidadDetalle: String(m.unidad || '').trim() || undefined,
      pasajeros: pasajerosDados || 1
    },
    cobro: {
      montoTotal: Number(m.total) || 0,
      anticipo: Number(m.anticipo) || 0,
      formaPago: 'TARJETA',
      condicionesPago: 'Anticipo pagado en línea. Saldo por cubrir antes de la salida.',
      incluyeCombustible: true,
      incluyeCasetas: true
    }
  };
}

/* Preguntarle a Stripe como esta de verdad una sesion es la fuente de verdad
   de todo esto: lo que llega en el aviso solo sirve para saber POR CUAL
   preguntar. Vive en `_stripe.js`, junto con la regla de si esta pagada —que
   antes estaba escrita aqui y otra vez en confirmar.js—. */
const stripe = require('./_stripe');
const correo = require('./_correo');   // el correo al cliente, en un solo dueño
const ligas = require('./_ligas');         // y su liga propia, firmada
const reversas = require('./_reversas');   // cuando el dinero se regresa
const defensas = require('./_defensas');
const saldos = require('./_saldo');        // quién es un abono, en un solo dueño

/* `crudo` puede ser el cuerpo tal cual (Buffer/texto) o el objeto ya
   parseado, segun lo que deje pasar el entorno. */
/* ============================================================
   ATENDER UNA REVERSA
   ------------------------------------------------------------
   El dinero YA salió de la cuenta cuando esto llega. No hay nada
   que impedir: lo único que se puede hacer es que el sistema y
   una persona se enteren.

   EL ORDEN DE LO QUE IMPORTA

     1. que alguien se entere ............ el correo a la oficina
     2. que el sistema lo registre ....... EuroSystem, §13
     3. que Stripe no lo reintente ....... el 200

   El 200 pide las DOS primeras. Si el correo no salió, 500. Si
   EuroSystem no la registró, 500 también —lo exige §13 para el
   404, y vale igual para cualquier otro «no»—: vale más que Stripe
   siga tocando la puerta tres días a que el dinero se pierda en
   silencio.

   EL AVISO SE MANDA SIEMPRE, aunque EuroSystem conteste bien, y
   antes de decidir qué se contesta. Una reversa no es un
   movimiento de rutina: es una llamada que alguien tiene que
   hacerle al cliente antes del día del viaje.
   ============================================================ */
async function atiendeReversa(tipo, objeto, firmado) {
  const pago = reversas.pagoDelAviso(objeto);
  const motivo = reversas.motivoDe(tipo);
  const loQueDiceElAviso = reversas.montoRevertido(tipo, objeto);

  if (!pago) {
    console.error('[reversa] ' + tipo + ' sin pago que buscar. NO SE PUDO ATENDER.');
    return { status: 200, cuerpo: { recibido: true, error: 'aviso sin pago' } };
  }

  /* ---- PRIMERO: ¿de verdad se fue ese dinero? ----------------------------
     Antes se le creía al aviso. No se puede: se comprobó contra el sitio
     publicado que mandando `Content-Type: application/json` la firma ni se
     revisa, así que ese aviso lo puede escribir cualquiera. Y una reversa
     inventada de un ANTICIPO le quema el folio a un viaje que sí está pagado.

     Va ANTES de buscar la sesión a propósito: a un aviso inventado se le
     gasta una sola consulta, no dos.
     ---------------------------------------------------------------------- */
  const cobro = await stripe.cargoDelPago(pago);
  if (cobro.error) {
    if (cobro.reintentar) {
      console.error('[reversa] no se pudo preguntarle a Stripe por ' + pago + '; reintentará.');
      return { status: 500, cuerpo: { error: cobro.error } };
    }
    console.log('[reversa] ' + motivo + ' de ' + pago + ': ' + cobro.error + ', no aplica.');
    return { status: 200, cuerpo: { recibido: true, ajeno: true } };
  }

  const veredicto = reversas.loQueDiceStripe(motivo, cobro.cargo);
  if (!veredicto.confirmada) {
    /* Dos causas distintas, y se contestan distinto.

       CON firma buena viene de Stripe de verdad, así que esto es una carrera
       —el aviso llegó antes de que el cobro reflejara el cambio—. Se pide
       reintento: perderlo sería justo el defecto que se acaba de tapar.

       SIN firma no hay a quién reintentarle: es un desconocido inventando.
       Se contesta 200 para no dejarle un botón con el que hacernos girar, y
       no se manda ningún correo. */
    if (firmado) {
      console.error('[reversa] aviso FIRMADO que Stripe todavía no confirma (' +
        veredicto.porque + ') — pago ' + pago + '. Se pide reintento.');
      return { status: 500, cuerpo: { error: 'la reversa no cuadra con Stripe' } };
    }
    console.error('[reversa] AVISO SIN FIRMA E INVENTADO: ' + tipo + ' de ' + pago +
      ' — ' + veredicto.porque + '. Se ignora y NO se avisa a nadie.');
    return { status: 200, cuerpo: { recibido: true, ignorado: 'Stripe no lo confirma' } };
  }

  /* El monto sale de Stripe, nunca del aviso. Si no coinciden, queda escrito:
     un aviso inventado se delata justo aquí. */
  const monto = veredicto.monto;
  if (loQueDiceElAviso && Math.abs(loQueDiceElAviso - monto) > 0.005) {
    console.error('[reversa] el aviso decía $' + loQueDiceElAviso + ' y Stripe dice $' +
      monto + ' — pago ' + pago + '. Manda Stripe.');
  }

  /* ---- ¿de qué viaje era este cobro? ---- */
  const hallada = await stripe.sesionPorPago(pago);
  if (hallada.error) {
    if (hallada.reintentar) {
      console.error('[reversa] no se pudo preguntar a Stripe por ' + pago + '; reintentará.');
      return { status: 500, cuerpo: { error: hallada.error } };
    }
    /* Un cobro que no salió de esta página —capturado a mano en el panel de
       Stripe, por ejemplo— no tiene contrato que revertir aquí. */
    console.log('[reversa] ' + motivo + ' de ' + pago + ': ' + hallada.error + ', no aplica.');
    return { status: 200, cuerpo: { recibido: true, ajeno: true } };
  }

  const sesion = hallada.sesion;
  const m = sesion.metadata || {};
  const clase = reversas.claseDePago(m);

  const datos = {
    clase: clase, motivo: motivo, monto: monto, pago: pago,
    referenciaExterna: 'WEB-' + String(sesion.id || '').slice(0, 70),
    folio: m.folio || '', contrato: m.contrato || '',
    nombre: m.nombre || '', correo: m.correo || '', telefono: m.telefono || '',
    ruta: m.ruta || '', salida: m.salida || ''
  };

  console.error('[reversa] ' + motivo + ' de ' + clase + ' — folio ' + (datos.folio || '?') +
    ', ' + monto + ' — pago ' + pago +
    (clase === 'ANTICIPO' ? ' — HAY QUE QUEMAR EL FOLIO' : ''));

  /* ---- 1. que EuroSystem lo registre ---- */
  const llave = (process.env.CONTRATOS_API_KEY || '').trim();
  let registrada = false, porQueNo = 'sin CONTRATOS_API_KEY';
  if (llave) {
    try {
      const r = await fetch(EUROSYSTEM + PUERTA_REVERSA, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': llave },
        body: JSON.stringify(reversas.cuerpoParaEuroSystem(datos))
      });
      /* §13: el 200 es `{revertido:true}` o `{yaEstaba:true}`. Los dos son
         éxito — el segundo es el reintento que ya no tiene nada que hacer—,
         así que basta con que la respuesta sea buena. */
      registrada = r.ok;
      if (!r.ok) {
        porQueNo = r.status === 404
          ? 'EuroSystem no tiene registrado todavía ese cobro (' + pago + ')'
          : 'EuroSystem contestó ' + r.status;
      }
    } catch (e) {
      porQueNo = 'no se pudo hablar con EuroSystem';
    }
  }
  datos.eurosystem = registrada;
  datos.eurosystemMotivo = porQueNo;

  if (!registrada) {
    console.error('[reversa] EuroSystem NO la registró: ' + porQueNo + '. Va por correo.');
  }

  /* ---- 2. que una persona se entere. ESTO es lo que no puede fallar ----
     Va SIEMPRE, y va antes de decidir qué se le contesta a Stripe: el dinero
     ya salió de la cuenta y eso no espera tres días de reintentos. */
  const aviso = reversas.avisoDeReversa(datos);
  const envio = await correo.mandaALaOficina(aviso.asunto, aviso.texto);

  if (!envio.ok) {
    /* Ni EuroSystem ni el correo. Se le pide a Stripe que insista: es la
       última red que queda para que esto no se pierda en silencio. */
    console.error('[reversa] EL AVISO NO SALIO (' + envio.motivo + '). ' +
      'Folio ' + (datos.folio || '?') + ', pago ' + pago + '. Stripe reintentará.');
    return { status: 500, cuerpo: { error: 'no se pudo avisar de la reversa' } };
  }

  /* ---- 3. y solo ahora, qué se le contesta a Stripe ----------------------
     Lo manda CONTRATOS-API.md §13 con todas sus letras: «Si contesta 404 (esa
     referencia aún no está registrada), quien llama DEBE contestarle a Stripe
     con un error (no 2xx) para que Stripe reintente el aviso. Contestar 200
     pierde la reversa».

     No es un tecnicismo: un reembolso puede llegar ANTES de que su cobro
     alcanzara a registrarse, y en ese caso el reintento de dentro de un rato
     sí encuentra el abono y lo revierte solo. Contestar 200 sería cerrar esa
     puerta para siempre y dejar a EuroSystem diciendo que el viaje está
     pagado cuando el dinero ya se fue.

     Lo mismo para cualquier otro «no» —401, 422, 429, 500, o ni contestó—:
     ninguno significa que la reversa quedó registrada, y todos se pueden
     arreglar dentro de los tres días que Stripe insiste. La oficina ya fue
     avisada arriba, así que un reintento de más no cuesta nada.
     ---------------------------------------------------------------------- */
  if (!registrada) {
    console.error('[reversa] ' + motivo + ' de ' + pago + ' AVISADA pero NO registrada en ' +
      'EuroSystem (' + porQueNo + '). Stripe reintentará hasta tres días.');
    return { status: 500, cuerpo: { error: 'reversa no registrada en EuroSystem', avisada: true } };
  }

  return {
    status: 200,
    cuerpo: {
      recibido: true, reversa: true, clase: clase, motivo: motivo,
      folio: datos.folio, registrada: registrada, avisada: true
    }
  };
}

/* ============================================================
   UN ABONO DEL CLIENTE, QUE NO ES UNA COMPRA NUEVA
   ------------------------------------------------------------
   Sale de «Abona a tu viaje»: el cliente acertó su número de
   contrato y su apellido, y pagó una parte de lo que debe. Para
   Stripe es un cobro más; para nosotros NO es una reserva.

   LO QUE HABIA ANTES: SE PERDIA.

   Un cobro con `tipo: 'abono'` caía en la rama de los contratos.
   Se armaba un contrato con la metadata de un abono —sin nombre,
   sin fechas—, la revisión de «fechas ilegibles» contestaba 200 y
   ahí moría: el cliente pagaba, Stripe cobraba, y en EuroSystem no
   aparecía nada. Ni un correo.

   EL ORDEN, Y POR QUE ES ESE

     1. EuroSystem lo registra ......... §13, con el `pi_…`
     2. y SOLO ENTONCES, el correo al cliente

   Al revés no: si el registro falla se contesta 500 para que
   Stripe insista tres días, y con el correo antes el cliente
   recibiría un comprobante por cada reintento. Registrar es
   idempotente por la referencia —el mismo `pi_…` nunca se anota
   dos veces— así que insistir no duplica ningún peso.

   LA REFERENCIA ES EL `pi_…`, Y NO ES UN DETALLE

   Es el MISMO que manda `_reversas.js` cuando ese dinero se
   devuelve. Si aquí se mandara otra cosa, la reversa buscaría un
   abono que no existe, EuroSystem contestaría 404 y el saldo del
   cliente se quedaría bajo con un dinero que ya salió.
   ============================================================ */
const PUERTA_ABONO = '/api/contratos/abono-externo';

/* El número de contrato de EuroSystem, tal como viaja en la metadata del
   cobro. Solo un entero: lo demás no nombra ningún contrato. */
function contratoDeLaMetadata(m) {
  const t = String((m || {}).contrato || '').trim();
  return /^\d{1,8}$/.test(t) && Number(t) > 0 ? Number(t) : 0;
}

/* Lo que de verdad se cobró, en pesos. Manda Stripe —`amount_total`, en
   centavos— y no la metadata: la metadata la escribió la página al abrir el
   cobro y Stripe la copia sin revisarla. Si Stripe no lo dice, se cae a lo
   que decía la metadata antes que quedarse sin monto. */
function pesosCobrados(sesion) {
  const centavos = Number((sesion || {}).amount_total);
  if (isFinite(centavos) && centavos > 0) return Math.round(centavos) / 100;
  const dicho = Number(((sesion || {}).metadata || {}).monto);
  return isFinite(dicho) && dicho > 0 ? Math.round(dicho) : 0;
}

/* El momento en que entró el dinero, con zona. Es AHORA a propósito: este
   aviso llega de Stripe en cuanto el cobro se completa —también el de OXXO,
   que es `async_payment_succeeded`—, así que la hora de ahora es la del pago.
   `created` de la sesión sería la del voucher, que en un OXXO puede ser de
   tres días antes. */
function ahoraConZona(cuando) {
  const d = cuando instanceof Date ? cuando : new Date();
  const dd = function (n) { return String(n).padStart(2, '0'); };
  /* -06:00 es fijo (México dejó el horario de verano en 2022), así que la
     hora local del centro se saca restándole seis a la UTC. */
  const local = new Date(d.getTime() - 6 * 3600000);
  return local.getUTCFullYear() + '-' + dd(local.getUTCMonth() + 1) + '-' +
    dd(local.getUTCDate()) + 'T' + dd(local.getUTCHours()) + ':' +
    dd(local.getUTCMinutes()) + ':' + dd(local.getUTCSeconds()) + ZONA;
}

/* A dónde se le escribe al cliente. En el portal no hay metadata con su
   correo —§12 no lo devuelve, y con razón—: el correo es el que él mismo
   tecleó en la pantalla de Stripe. */
function correoDelCobro(sesion) {
  const s = sesion || {};
  return String((s.metadata || {}).correo ||
    (s.customer_details && s.customer_details.email) || '').trim();
}

function avisoDeAbono(datos) {
  const renglones = [
    datos.registrado
      ? 'Un cliente abonó en línea. EuroSystem ya lo tiene anotado, SIN APROBAR.'
      : 'Un cliente abonó en línea y NO SE PUDO REGISTRAR EN EUROSYSTEM. ' +
        'HAY QUE CAPTURARLO A MANO.',
    '',
    'Contrato:         ' + (datos.contrato || '—'),
    'Monto:            $' + Number(datos.monto || 0).toLocaleString('es-MX'),
    'Cuándo:           ' + datos.fecha,
    'Correo:           ' + (datos.correo || '—'),
    'Pago de Stripe:   ' + (datos.pago || '—'),
    '',
    datos.registrado
      ? 'QUÉ HAY QUE HACER\n  Aprobarlo en el contrato para que le baje el saldo al cliente.'
      : 'QUÉ HAY QUE HACER\n  Capturar el abono en el contrato. El dinero YA está cobrado.\n' +
        '  Motivo: ' + (datos.porQueNo || 'sin detalle'),
    '',
    'Verlo en Stripe: https://dashboard.stripe.com/payments/' + (datos.pago || '')
  ];
  return {
    asunto: (datos.registrado ? 'Abono en línea' : 'ABONO EN LÍNEA SIN REGISTRAR') +
      ' · contrato ' + (datos.contrato || '—') +
      ' · $' + Number(datos.monto || 0).toLocaleString('es-MX'),
    texto: renglones.join('\n')
  };
}

async function atiendeAbono(sesion) {
  const m = sesion.metadata || {};
  const contrato = contratoDeLaMetadata(m);
  const monto = pesosCobrados(sesion);
  const pago = typeof sesion.payment_intent === 'string' ? sesion.payment_intent
             : (sesion.payment_intent && sesion.payment_intent.id) || '';
  const fecha = ahoraConZona();
  const correoDelCliente = correoDelCobro(sesion);

  const datos = { contrato: contrato, monto: monto, fecha: fecha, pago: pago,
    correo: correoDelCliente, registrado: false };

  /* ---- un abono de prueba no toca EuroSystem ----
     Misma polaridad que el anticipo: solo se salta cuando Stripe dice
     EXPRESAMENTE que el pago no es real. */
  if (sesion.livemode === false) {
    console.log('[abono] PAGO DE PRUEBA (' + sesion.id + '): no se registra en EuroSystem.');
    if (correoDelCliente) await correo.mandaAbono(datos);
    return { status: 200, cuerpo: { recibido: true, abono: true, prueba: true } };
  }

  /* ---- sin número de contrato no hay dónde anotarlo ----
     Son los abonos que salen de la pantalla del viaje, con liga: esa pantalla
     conoce el folio de la página (`ET-…`) y NO el número de EuroSystem, que
     lo asigna EuroSystem al crear el contrato.

     Aquí no se contesta 500. Reintentar tres días no le va a agregar a esa
     sesión una metadata que ya está escrita; lo único que arregla esto es una
     persona. Así que se le avisa a la oficina —que es lo que sí puede actuar—
     y se acusa recibo. */
  if (!contrato) {
    console.error('[abono] cobro ' + (sesion.id || '') + ' SIN número de contrato en la ' +
      'metadata: no hay dónde registrarlo. Va por correo a la oficina.');
    datos.porQueNo = 'el cobro no traía el número de contrato de EuroSystem';
    const aviso = avisoDeAbono(datos);
    const alaOficina = await correo.mandaALaOficina(aviso.asunto, aviso.texto);
    if (correoDelCliente) await correo.mandaAbono(datos);
    if (!alaOficina.ok) {
      console.error('[abono] Y EL AVISO NO SALIÓ (' + alaOficina.motivo + '). ' +
        'Stripe reintentará: es la última red que queda.');
      return { status: 500, cuerpo: { error: 'no se pudo avisar del abono' } };
    }
    return { status: 200, cuerpo: { recibido: true, abono: true, registrado: false } };
  }

  const llave = (process.env.CONTRATOS_API_KEY || '').trim();
  if (!llave) {
    console.error('[abono] falta CONTRATOS_API_KEY: el abono de ' + monto + ' al contrato ' +
      contrato + ' NO se registró. Stripe reintentará.');
    return { status: 500, cuerpo: { error: 'sin llave de EuroSystem' } };
  }

  if (!pago || !monto) {
    /* Sin referencia no hay idempotencia y sin monto no hay abono. Los dos
       salen de Stripe, así que esto no debería pasar nunca; si pasa, que
       insista —puede ser una respuesta a medias— y que quede escrito. */
    console.error('[abono] cobro ' + (sesion.id || '') + ' sin pago (' + pago +
      ') o sin monto (' + monto + '). No se registra. Stripe reintentará.');
    return { status: 500, cuerpo: { error: 'abono sin referencia o sin monto' } };
  }

  /* ---- 1. que EuroSystem lo registre (§13) ---- */
  let respuesta = null, porQueNo = '';
  try {
    const r = await fetch(EUROSYSTEM + PUERTA_ABONO, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': llave },
      body: JSON.stringify({ folio: contrato, monto: monto, referencia: pago, fecha: fecha })
    });
    const d = await r.json().catch(function () { return {}; });
    /* §13: 201 `{registrado:true}` y 200 `{repetido:true}` son los dos éxito.
       El segundo es el reintento que ya no tiene nada que hacer. */
    if (r.ok) respuesta = d;
    else porQueNo = 'EuroSystem contestó ' + r.status + ': ' + JSON.stringify(d).slice(0, 200);
  } catch (e) {
    porQueNo = 'no se pudo hablar con EuroSystem: ' + (e && e.message);
  }

  if (!respuesta) {
    /* EL DINERO YA SE COBRO. Cualquier «no» se reintenta, igual que con el
       contrato: tres días de insistencia salen gratis —la puerta es
       idempotente por la referencia— y son tres días para que alguien
       arregle la llave o confirme el contrato sin que nadie tenga que
       enterarse a tiempo. */
    console.error('[abono] NO SE REGISTRÓ el abono de $' + monto + ' al contrato ' +
      contrato + ' (' + porQueNo + '). Pago ' + pago + '. Stripe reintentará tres días.');
    return { status: 500, cuerpo: { error: 'EuroSystem no registró el abono' } };
  }

  datos.registrado = true;
  console.log('[abono] $' + monto + ' al contrato ' + contrato +
    (respuesta.repetido ? ' (ya estaba registrado)' : ' registrado') + ' — pago ' + pago);

  /* ---- 2. y ahora sí, el comprobante del cliente y el aviso de la oficina ----
     El aviso a la oficina va SIEMPRE: el abono entra sin aprobar y alguien
     tiene que aprobarlo para que le baje el saldo al cliente. */
  const aviso = avisoDeAbono(datos);
  await correo.mandaALaOficina(aviso.asunto, aviso.texto);

  if (!correoDelCliente) {
    console.error('[abono] el cobro ' + (sesion.id || '') + ' no trae correo del cliente: ' +
      'queda registrado pero sin comprobante.');
    return { status: 200, cuerpo: { recibido: true, abono: true, registrado: true,
      repetido: !!respuesta.repetido, correo: false } };
  }

  const envio = await correo.mandaAbono(datos);
  if (!envio.ok) {
    console.error('[abono] abono registrado pero EL COMPROBANTE NO SALIÓ: ' + envio.motivo +
      (envio.reintentar ? ' — Stripe reintentará.' : ' — NO se reintenta. MANDARLO A MANO.'));
    /* Si el fallo es pasajero, que Stripe insista: registrar otra vez no
       duplica nada y el comprobante tiene tres días más de oportunidades. */
    if (envio.reintentar) {
      return { status: 500, cuerpo: { error: 'comprobante no enviado', contrato: contrato } };
    }
  }

  return {
    status: 200,
    cuerpo: {
      recibido: true, abono: true, registrado: true,
      repetido: !!respuesta.repetido, contrato: contrato, correo: !!envio.ok
    }
  };
}

async function procesa(crudo, cabeceraFirma) {

  /* Ojo: aqui NO va el guardia de origen de _defensas. Stripe llama de
     servidor a servidor y no manda cabecera Origin ni Referer; exigirla
     cerraria la puerta justo a quien tiene que entrar. */

  /* ============================================================
     SIN EL SECRETO NO SE LE CREE A NADIE. VA PRIMERO.
     ------------------------------------------------------------
     `.env.example` lo prometía desde siempre —«Sin él,
     /api/webhook-stripe contesta 500 y Stripe reintenta hasta tres
     días»— y el código hacía otra cosa: se saltaba la verificación y
     seguía adelante consultando a Stripe. O sea que una variable sin
     poner APAGABA el primer candado en silencio, y el único rastro
     era un renglón del registro que nadie lee.

     Hay que distinguir dos cosas que no se parecen:

       · «el entorno me parseó el cuerpo y ya no hay bytes que
         firmar» — eso le pasa a TODO el tráfico bueno de Stripe en
         Vercel, y por eso se sigue adelante apoyándose en la consulta
         a Stripe, que es más fuerte;

       · «nadie configuró el secreto» — eso es una puerta sin
         cerradura, y no es un caso a manejar: es algo que hay que
         arreglar. Se contesta 500 y Stripe insiste tres días: el
         cobro no se pierde, se queda esperando a que alguien ponga
         la variable.
     ============================================================ */
  const secreto = (process.env.STRIPE_WEBHOOK_SECRET || '').trim();
  if (!secreto) {
    console.error('[webhook] FALTA STRIPE_WEBHOOK_SECRET: no hay con qué comprobar ' +
      'ninguna firma, así que NO se procesa nada — ni un pago ni una reversa. ' +
      'Stripe reintentará hasta tres días. Ponla en las variables de Vercel ' +
      '(la da Stripe al dar de alta el endpoint; empieza con whsec_).');
    return { status: 500, cuerpo: { error: 'sin STRIPE_WEBHOOK_SECRET' } };
  }

  let evento;
  const traeBytes = Buffer.isBuffer(crudo) || typeof crudo === 'string';
  if (traeBytes) {
    try { evento = JSON.parse(crudo.toString('utf8')); }
    catch (e) { return { status: 400, cuerpo: { error: 'cuerpo ilegible' } }; }
  } else if (crudo && typeof crudo === 'object') {
    evento = crudo;
  } else {
    return { status: 400, cuerpo: { error: 'cuerpo ilegible' } };
  }

  /* LA FIRMA, cuando se puede — Y LA TRAMPA QUE TIENE
     -------------------------------------------------
     Solo cuadra si llegaron los BYTES exactos. Si el entorno parseó el
     cuerpo, no queda nada que comprobar.

     Aqui estaba el hueco, y era de verdad: QUIEN LLAMA ELIGE si el cuerpo
     se parsea, nada mas escogiendo el Content-Type. Comprobado contra el
     sitio publicado, la misma peticion con la misma firma inventada:

         Content-Type: text/plain          -> 400 firma inválida
         Content-Type: application/json    -> 200, y entró

     O sea que la firma no era una puerta: era una puerta que el visitante
     podia decidir no tocar. Es el caso 3 del skill del proyecto —nada que
     mande el cliente decide seguridad—.

     No se puede cerrar contestando 400 sin mas: Stripe manda justamente
     `application/json`, asi que eso dejaria fuera a los avisos buenos. Lo
     que se hace es CARGAR EL DATO: abajo, todo lo que valga dinero exige
     ademas que Stripe lo confirme, y `firmado` decide como se trata lo que
     no cuadra. */
  let firmado = false;
  if (traeBytes) {
    const v = firma.verifica(crudo, cabeceraFirma, secreto);
    if (!v.ok) {
      // El motivo se queda en el registro. A quien toco la puerta no se le
      // explica por que no abrio.
      console.error('[webhook] firma rechazada: ' + v.motivo);
      return { status: 400, cuerpo: { error: 'firma inválida' } };
    }
    firmado = true;
  } else {
    console.error('[webhook] el cuerpo no llegó crudo: no se pudo verificar la firma; ' +
      'se procede consultando a Stripe, que es la fuente de verdad');
  }

  const tipo = evento.type;

  /* ---------------------------------------------------------------------
     EL DINERO QUE SE REGRESA

     Va ANTES de lo demás porque es lo más caro de perder. Hasta hoy un
     `charge.refunded` caía en el «ignorado» de abajo: se contestaba 200,
     Stripe lo daba por entregado y NUNCA reintentaba. Nadie se enteraba,
     y el sistema seguía diciendo que ese viaje estaba pagado.
     --------------------------------------------------------------------- */
  if (reversas.esReversa(tipo)) {
    return await atiendeReversa(tipo, (evento.data && evento.data.object) || {}, firmado);
  }

  const NOS_IMPORTAN = ['checkout.session.completed', 'checkout.session.async_payment_succeeded'];
  if (NOS_IMPORTAN.indexOf(tipo) < 0) {
    return { status: 200, cuerpo: { recibido: true, ignorado: tipo } };
  }

  /* ---------------------------------------------------------------------
     AQUI ESTA LA SEGURIDAD DE VERDAD
     ---------------------------------------------------------------------
     Del aviso solo se toma el ID. Todo lo demas —si se pago, cuanto, de
     quien— se le pregunta a Stripe con nuestra clave secreta. Asi, un aviso
     inventado no sirve de nada: Stripe contesta que esa sesion no existe, o
     que no esta pagada, y no se registra nada.

     Es mas fuerte que creerle a un aviso firmado, porque ni siquiera un
     aviso legitimo pero viejo puede afirmar algo que ya cambio. */
  const idAviso = (evento.data && evento.data.object && evento.data.object.id) || '';
  const consulta = await stripe.traeSesion(idAviso);
  if (consulta.error) {
    console.error('[webhook] ' + consulta.error + ' (' + idAviso + ')');
    // Si Stripe no contesto, que se reintente. Si no reconoce la sesion, no.
    return consulta.reintentar
      ? { status: 500, cuerpo: { error: consulta.error } }
      : { status: 200, cuerpo: { recibido: true, error: consulta.error } };
  }
  const sesion = consulta.sesion;

  /* No basta el nombre del evento: `completed` tambien llega con OXXO, con el
     voucher generado y el dinero SIN entrar. Se registra contrato solo cuando
     el pago de verdad esta hecho. */
  const pagado = consulta.estado === 'pagado';
  if (!pagado) {
    console.log('[webhook] ' + tipo + ' sin pago aún (' + sesion.payment_status + '), no se registra');
    return { status: 200, cuerpo: { recibido: true, pendiente: true } };
  }

  /* ---------------------------------------------------------------------
     ¿ES UN ABONO O UNA COMPRA?

     Lo dice la metadata que se escribió al abrir el cobro, no el monto ni
     la forma: adivinar aquí terminaría creando un contrato por cada abono.

     Va antes de todo lo del contrato —incluido el pago de prueba, que
     manda el correo del CONTRATO y aquí no toca—.
     --------------------------------------------------------------------- */
  if (String((sesion.metadata || {}).tipo || '') === saldos.TIPO_ABONO) {
    return await atiendeAbono(sesion);
  }


  /* ------------------------------------------------------------
     UN PAGO DE PRUEBA NO SE REGISTRA COMO CONTRATO
     ------------------------------------------------------------
     El dueño necesita poder recorrer la compra completa —pagar, ver
     su correo, ver su viaje en «Mis viajes»— ANTES de lanzar. Hasta
     hoy eso le costaba caro sin avisarle: una tarjeta de prueba de
     Stripe creaba un contrato DE VERDAD en EuroSystem y le quemaba
     un folio del consecutivo. Y no es una vez: es cada vez que
     quiera probar.

     Se puede separar limpio porque EL FOLIO QUE VE EL CLIENTE LO
     GENERA LA PAGINA, no EuroSystem. Así que en una prueba sigue
     pasando casi todo: el correo sale con su folio y con su liga, y
     el viaje aparece en «Mis viajes». Lo único que falta es el PDF
     del contrato, que sí lo hace EuroSystem.

     LA POLARIDAD IMPORTA MAS QUE LA REGLA. Solo se salta cuando
     Stripe dice, EXPRESAMENTE, que el pago no es real. Si el campo
     no viene, o viene raro, se registra como siempre: equivocarse
     hacia «registrar» cuesta un contrato de más que se borra;
     equivocarse hacia «saltar» pierde una venta en silencio.

     Y el dato sale de la sesión que se le PREGUNTO a Stripe, no del
     aviso: un aviso inventado no puede decir «esto era una prueba»
     para que no se registre un cobro real.

     Al poner la clave `sk_live_`, `livemode` es cierto y esto no
     vuelve a entrar.
     ------------------------------------------------------------ */
  if (sesion.livemode === false) {
    const liga = ligas.ligaDelViaje(defensas.PERMITIDOS[0], sesion.id,
      ultimoDiaDelViaje(sesion.metadata || {}));
    const envio = await correo.mandaContrato(sesion.metadata || {}, null, liga);

    console.log('[webhook] PAGO DE PRUEBA (' + sesion.id + '): no se registra en ' +
      'EuroSystem y no se quema folio. Correo ' + (envio.ok ? 'enviado' : 'NO enviado'));

    await correo.mandaALaOficina(
      'Pago de PRUEBA en la página — no se registró contrato',
      [
        'Alguien completó una compra con una tarjeta de prueba de Stripe.',
        '',
        'NO se registró contrato en EuroSystem y NO se quemó folio: el pago no',
        'es real. Esto es lo normal mientras la página siga con la clave de',
        'pruebas.',
        '',
        'Folio de la página: ' + String((sesion.metadata || {}).folio || 'sin folio'),
        'Sesión de Stripe:   ' + String(sesion.id || ''),
        'Correo del cliente: ' + String((sesion.metadata || {}).correo || ''),
        '',
        'Si esto llega DESPUES del lanzamiento, algo está mal: quiere decir que',
        'la página sigue cobrando con la clave de pruebas y NADIE está pagando.'
      ].join('\n')
    );

    return { status: 200, cuerpo: { recibido: true, prueba: true, correo: !!envio.ok } };
  }
  const llave = (process.env.CONTRATOS_API_KEY || '').trim();
  if (!llave) {
    /* 500 a proposito: Stripe reintenta hasta tres dias, y eso le da a la
       oficina tiempo de configurar la llave sin perder el pago. */
    console.error('[webhook] falta CONTRATOS_API_KEY: el pago ' + (sesion.id || '') +
      ' NO se registró. Stripe reintentará.');
    return { status: 500, cuerpo: { error: 'sin llave de EuroSystem' } };
  }

  const cuerpo = contratoDesde(sesion.metadata || {}, sesion);

  if (!cuerpo.servicio.fechaSalida || !cuerpo.servicio.fechaRegreso) {
    console.error('[webhook] fechas ilegibles en la sesión ' + (sesion.id || '') +
      ': salida="' + (sesion.metadata || {}).salida + '" regreso="' + (sesion.metadata || {}).regreso +
      '". Registrar a mano.');
    return { status: 200, cuerpo: { recibido: true, error: 'fechas ilegibles' } };
  }

  try {
    const r = await fetch(EUROSYSTEM + PUERTA, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': llave },
      /* `incluirPdf` para que la respuesta traiga el contrato y se pueda
         ADJUNTAR al correo. Su `urlPdf` vence a los 30 días; el adjunto no.
         El cliente tiene que poder abrir su contrato en marzo. */
      body: JSON.stringify(Object.assign({ incluirPdf: true }, cuerpo))
    });
    const d = await r.json().catch(function () { return {}; });

    if (r.ok) {
      console.log('[webhook] contrato ' + d.folio + (d.repetido ? ' (ya existía)' : ' creado') +
        ' para la sesión ' + sesion.id);

      /* ------------------------------------------------------------
         Y AHORA SI, EL CORREO

         Hasta hoy esto no existía: el contrato se creaba en EuroSystem y
         ahí se quedaba. La pantalla le decía al cliente «te mandamos el
         folio y las instrucciones» y no se le mandaba nada.

         Va DESPUÉS de crear el contrato y con su folio en la mano, porque
         el folio es lo que el cliente necesita para cualquier aclaración.
         ------------------------------------------------------------ */
      /* ------------------------------------------------------------
         UN SOLO FOLIO PARA EL CLIENTE, Y ES EL DE LA PAGINA

         Aquí se sobreescribía el folio con el de EuroSystem, y eso le daba
         al cliente DOS números para el mismo viaje: el correo decía «folio
         51001» y su pantalla decía «ET-Q7TW-K3R». Peor todavía: el `ET-`
         es el que ya vio en la pantalla de pago, antes de cualquier correo.

         Manda el de la página, que es el que el cliente conoce y el que
         EuroSystem ya trae anotado en las observaciones del contrato. El
         número de contrato va aparte, porque ése sí aparece en el PDF
         adjunto y hay que poder reconocerlo.
         ------------------------------------------------------------ */
      const paraElCorreo = Object.assign({}, sesion.metadata || {}, { contrato: d.folio });

      /* La liga propia del cliente. Se firma con el identificador de SU
         sesión de Stripe, así que solo abre su viaje.

         El sitio sale de `_defensas.PERMITIDOS`, no de una cabecera: aquí
         quien llama es Stripe, de servidor a servidor, y no manda `Origin`.
         Poner el dominio a mano evitaría que la liga se pudiera desviar,
         pero también lo dejaría desactualizado el día que cambie. */
      const liga = ligas.ligaDelViaje(defensas.PERMITIDOS[0], sesion.id,
        ultimoDiaDelViaje(sesion.metadata || {}));
      if (!liga) {
        console.error('[webhook] sin LIGAS_SECRETO: el correo sale SIN liga al viaje. ' +
          'El cliente recibe folio y contrato, pero no puede entrar en línea.');
      }

      const envio = await correo.mandaContrato(paraElCorreo, d.pdfBase64, liga);

      if (envio.ok) {
        console.log('[webhook] correo enviado a la sesión ' + sesion.id +
          (d.pdfBase64 ? ' con contrato adjunto' : ' SIN adjunto: EuroSystem no mandó el PDF'));
        return { status: 200, cuerpo: { recibido: true, folio: d.folio, repetido: !!d.repetido, correo: true } };
      }

      /* El contrato YA existe; lo que falló es el correo. Crear el contrato
         es idempotente —EuroSystem contesta «ya existía»—, así que pedirle a
         Stripe que reintente no duplica nada y le da al correo más
         oportunidades durante tres días.

         Pero solo cuando el fallo es pasajero. Si falta la clave o el
         dominio no está verificado, reintentar tres días es tener a Stripe
         golpeando una puerta que no va a abrir: se acusa recibo y se grita
         en el registro para que alguien lo mande a mano. */
      console.error('[webhook] contrato ' + d.folio + ' creado pero EL CORREO NO SALIÓ: ' +
        envio.motivo + (envio.reintentar ? ' — Stripe reintentará.'
                                         : ' — NO se reintenta. MANDARLO A MANO.'));
      return envio.reintentar
        ? { status: 500, cuerpo: { error: 'correo no enviado', folio: d.folio } }
        : { status: 200, cuerpo: { recibido: true, folio: d.folio, correo: false } };
    }

    /* ------------------------------------------------------------
       CUALQUIER «NO» DE EUROSYSTEM SE REINTENTA. EL DINERO YA SE COBRO.
       ------------------------------------------------------------
       Aquí vivía el defecto más caro de este archivo, y estaba escrito
       como si fuera criterio: un 401, un 422 o un 400 se contestaban
       200 «para que Stripe deje de insistir», con un `console.error`
       que decía REGISTRAR A MANO.

       Suena razonable y es falso donde importa. Con un 200, Stripe da
       el aviso por entregado y NO VUELVE NUNCA. El cliente ya pagó, el
       contrato no existe, no le llega correo, y lo único que queda del
       cobro es un renglón del registro que hay que ir a buscar. Nadie
       va a buscarlo.

       Con un 500, Stripe insiste hasta tres días. Eso no arregla solo
       un dato mal escrito, pero le da a la oficina tres días para
       arreglar la llave o el dato y que el contrato se cree SOLO, sin
       que nadie tenga que enterarse a tiempo.

       Insistir es gratis porque la puerta es idempotente por
       `referenciaExterna` (CONTRATOS-API.md §5): el reintento que sí
       entra devuelve el MISMO folio con `repetido: true`, y de ahí
       sigue el camino de arriba —correo al cliente y 200—. No hay
       forma de que esto genere un contrato gemelo.

       Y el «ya existía» nunca llega por aquí: es un 200 (§4), o sea
       que entra por el `r.ok` de arriba. Todo lo que cae en esta rama
       es un contrato que NO SE CREO.
       ------------------------------------------------------------ */
    console.error('[webhook] EuroSystem NO registró el contrato (' + r.status + '): ' +
      JSON.stringify(d).slice(0, 400) + ' — sesión ' + sesion.id +
      '. EL COBRO YA ESTA HECHO Y NO HAY CONTRATO. Stripe reintentará tres días; ' +
      'si no se arregla en ese plazo, hay que capturarlo A MANO.');
    return { status: 500, cuerpo: { error: 'EuroSystem no registró el contrato', euro: r.status } };
  } catch (e) {
    console.error('[webhook] no se pudo hablar con EuroSystem: ' + e.message + '; Stripe reintentará.');
    return { status: 500, cuerpo: { error: 'EuroSystem inalcanzable' } };
  }
}

module.exports = { procesa, contratoDesde, conZona, claseDeUnidad };
