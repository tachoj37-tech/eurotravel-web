/* ============================================================
   EN QUÉ VA CADA CLIENTE
   ------------------------------------------------------------
   Pedido del dueño el 3-sep-2026: poder ver, de un vistazo,
   quién apenas preguntó, a quién ya se le dio precio, y quién
   ya mandó su transferencia.

   ------------------------------------------------------------
   POR QUÉ NO SON LAS ETIQUETAS DE WHATSAPP
   ------------------------------------------------------------
   Lo primero que se pidió fueron las etiquetas de WhatsApp
   Business. NO SE PUEDE, y conviene que quede escrito para que
   nadie lo vuelva a intentar:

     · La referencia de Meta para un número de WhatsApp Business
       tiene UN endpoint, `POST /{phone-number-id}/messages`. No
       hay borde de `labels`. Las etiquetas son de la APLICACIÓN,
       no de la API.
     · Con Coexistence el dueño conserva su app y sus etiquetas
       en el mismo número donde corre el bot — pero las pone a
       mano, una por una.
     · Lo que varios revendedores anuncian como «Label API» son
       etiquetas de su propio panel, no de WhatsApp.

   Así que la etapa vive aquí. Y sale mejor: la etiqueta habría
   que ponerla; esto el bot ya lo sabe.

   ------------------------------------------------------------
   LAS ETAPAS, EN EL ORDEN EN QUE PASAN
   ------------------------------------------------------------
   Van numeradas porque el orden importa: una conversación solo
   avanza. Si alguien que ya mandó su comprobante escribe otra
   vez «hola», no se regresa a `escribio` — ya pagó.

   La única que puede ir para atrás es cuando pide recotizar, y
   eso lo decide quien llama, no este archivo.
   ============================================================ */

'use strict';

const ETAPAS = [
  { id: 'escribio', n: 0, marca: '💬', dice: 'Escribió' },
  { id: 'cotizando', n: 1, marca: '📝', dice: 'Armando el viaje' },
  { id: 'pidio_precio', n: 2, marca: '⏳', dice: 'Falta darle precio' },
  { id: 'con_precio', n: 3, marca: '💲', dice: 'Ya tiene precio' },
  { id: 'va_a_apartar', n: 4, marca: '🤝', dice: 'Dijo que sí' },
  { id: 'mando_comprobante', n: 5, marca: '💸', dice: 'Mandó comprobante' },
  /* Después del comprobante el cliente sigue ocupado dando los datos de
     su contrato, mientras una persona revisa el depósito contra el
     banco. Es una etapa aparte y no un detalle: en el tablero, «ya
     mandó comprobante» y «ya está completo su contrato» piden cosas
     distintas de quien lo lee. */
  { id: 'datos_del_contrato', n: 6, marca: '📄', dice: 'Dando datos del contrato' },
  { id: 'contrato_listo', n: 7, marca: '✅', dice: 'Datos completos · falta confirmar pago' }
];

const POR_ID = {};
ETAPAS.forEach(function (e) { POR_ID[e.id] = e; });

function etapa(id) { return POR_ID[id] || POR_ID.escribio; }

/* El número de la etapa, para comparar. Una etapa desconocida vale
   -1 y así cualquiera le gana: es lo que queremos si un día alguien
   guarda un nombre que ya no existe. */
function nivel(id) {
  const e = POR_ID[id];
  return e ? e.n : -1;
}

/* ------------------------------------------------------------
   SOLO SE AVANZA
   ------------------------------------------------------------
   El que ya mandó su comprobante y luego escribe «gracias» sigue
   siendo el que ya pagó. Sin esta regla, el tablero se llenaría
   de gente «que apenas escribió» que en realidad ya depositó —y
   ése es exactamente el cliente que no se puede perder.
   ------------------------------------------------------------ */
function avanza(actual, nueva) {
  return nivel(nueva) > nivel(actual) ? nueva : (actual || 'escribio');
}

/* ------------------------------------------------------------
   QUÉ ETAPA LE TOCA A LO QUE ACABA DE PASAR
   ------------------------------------------------------------
   Se lee de lo que el bot YA decidió, no de adivinar sobre el
   texto del cliente. Eso importa: el bot es una máquina de
   estados y su estado es la verdad. Leer el texto otra vez, por
   separado, sería una segunda opinión que un día no coincide.
   ------------------------------------------------------------ */
function deLaRespuesta(r, mensaje) {
  const m = mensaje || {};

  /* Una foto o un documento, con transferencia, es casi siempre el
     comprobante. Es lo más alto que hay: aunque no se pueda dar el
     pago por bueno —eso lo revisa una persona—, lo que NO se puede
     es tratarlo como a cualquiera. */
  if (m.type === 'image' || m.type === 'document') return 'mando_comprobante';

  const r2 = r || {};

  /* `cotiza` es la petición de precio: el viaje ya está completo. */
  if (r2.cotiza) return 'pidio_precio';

  /* `solicitud` es el viaje armado que no se cotiza solo —autobús,
     Suburban—: también le falta precio, y de una persona. */
  if (r2.solicitud) return 'pidio_precio';

  const t = String(r2.texto || '');

  /* ------------------------------------------------------------
     EL CLIENTE DIJO QUE SÍ
     ------------------------------------------------------------
     Se lee de la BANDERA que iza el bot, no de sus palabras.

     Antes se buscaba la frase «datos para el depósito» dentro del
     texto, y se rompió el día que esa frase se movió de lugar —los
     datos de la cuenta pasaron a pegarse en el webhook, porque no
     pueden vivir en un archivo que corre en el navegador—. La etapa
     dejó de detectarse sin que nada más se quejara.

     Es exactamente lo que el encabezado de este archivo advierte:
     el bot es una máquina de estados y su estado es la verdad.
     Buscar frases es una segunda opinión que un día no coincide.
     ------------------------------------------------------------ */
  if (r2.pideDatosBancarios) return 'va_a_apartar';

  /* Y si trae un total, es que ya se le dio el precio. */
  if (/\*Total: \$/.test(t)) return 'con_precio';

  /* A media captura. */
  if (r2.estado && r2.estado.paso) return 'cotizando';

  return 'escribio';
}

/* ------------------------------------------------------------
   EL RENGLÓN QUE VE EL DUEÑO
   ------------------------------------------------------------
   Corto a propósito: en WhatsApp, un renglón por cliente se lee
   de un vistazo y un párrafo no se lee.
   ------------------------------------------------------------ */
function renglon(id) {
  const e = etapa(id);
  return e.marca + ' ' + e.dice;
}

module.exports = { ETAPAS, etapa, nivel, avanza, deLaRespuesta, renglon };
