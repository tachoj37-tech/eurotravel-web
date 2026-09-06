/* ============================================================
   EL SEGUIMIENTO · a quién le toca un toque, y cuál
   ------------------------------------------------------------
   Dictado del dueño el 6-sep-2026: «una vez que se mandó la
   cotización, si el cliente no contestó: a las 4 horas, a las 24 y
   a las 72. Si el cliente contesta, ya no quiero mensajes
   automáticos.» (El de una hora, dijo, era muy pronto.)

   Este archivo solo DECIDE. No manda, no lee la base, no toca la
   red: recibe una ficha y la hora, y contesta qué toque toca (o por
   qué ninguno). Así se prueba con un reloj de mentiras y sin
   WhatsApp. Quien manda es `whatsapp.mjs`, cada 15 minutos, cuando
   el cron de `vercel.json` lo despierta por `/api/whatsapp/seguimiento`.

   Lo que no venía en el dictado, y por qué está:

   · DE NOCHE NO. Entre las 9 de la noche y las 9 de la mañana (hora
     de Guadalajara) el toque espera a la mañana. Un «¿te llegó la
     cotización?» a las 3 a.m. no vende: molesta, y en WhatsApp se
     contesta con un bloqueo.
   · SI SE PASARON DOS, SE MANDA UNO. Si el cron estuvo caído o la
     noche se comió el de las 4 horas y ya son 26, se manda SOLO el
     que toca ahora (el de las 24). Un «¿te llegó bien?» un día
     después suena a máquina.
   · A LAS 96 HORAS SE CIERRA. Tres toques y silencio —la
     investigación de `_recordatorios.js`: el cuarto quema al
     cliente—, y un tercero que llegara al quinto día también.
   · LA VENTANA DE 24 HORAS. Meta solo deja mandar texto libre en las
     24 horas siguientes al ÚLTIMO mensaje del cliente. Fuera de
     ella solo pasan plantillas aprobadas. Aquí se dice si la
     ventana está abierta; quien manda escoge texto o plantilla.
     Se cierra media hora antes, por si el reloj de Meta y el
     nuestro no coinciden.
   ============================================================ */

'use strict';

const HORA_MS = 60 * 60 * 1000;

/* A cuántas horas del precio va cada toque. */
const HORAS = [4, 24, 72];
/* Después de esto ya no se manda nada, aunque falte un toque. */
const TOPE_MS = 96 * HORA_MS;
/* La ventana de Meta, con media hora de margen. */
const VENTANA_MS = 23.5 * HORA_MS;

const DESDE_LAS = 9;   // 9:00 a.m.
const HASTA_LAS = 21;  // 9:00 p.m. (a las 9 en punto ya no)

/* La hora del día en Guadalajara, 0-23. Vercel corre en UTC; sin esto
   «las 9 de la mañana» serían las 3 de la mañana. */
function horaEnGuadalajara(ms) {
  const partes = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Mexico_City', hour: 'numeric', hourCycle: 'h23'
  }).formatToParts(new Date(ms));
  const h = partes.find(function (p) { return p.type === 'hour'; });
  return h ? Number(h.value) : new Date(ms).getUTCHours();
}

function esHoraDeEscribir(ms) {
  const h = horaEnGuadalajara(ms);
  return h >= DESDE_LAS && h < HASTA_LAS;
}

/* Qué toque le toca a esta ficha ahora.

   Devuelve { toque, motivo, cerrar, ventanaAbierta }:
   · toque 1, 2 o 3 = mándalo; 0 = nada por ahora.
   · cerrar = true: ya no hay que volver a mirarla (contestó, avanzó,
     o es tarde). Quien llama la marca como terminada.
   · ventanaAbierta: si se puede mandar texto libre o hace falta
     plantilla. */
function decide(ficha, ahora) {
  const t = ahora || Date.now();
  if (!ficha || !ficha.precioEn) return { toque: 0, motivo: 'sin precio' };
  if (ficha.etapa !== 'con_precio') return { toque: 0, motivo: 'ya avanzó', cerrar: true };
  if (ficha.contratoSubido) return { toque: 0, motivo: 'ya tiene contrato', cerrar: true };

  const hechos = Number(ficha.toques) || 0;
  if (hechos >= HORAS.length) return { toque: 0, motivo: 'completo' };

  /* Contestó después del precio: se acabó el seguimiento. Es la regla
     más importante del dictado. */
  if (ficha.clienteEn && ficha.clienteEn > ficha.precioEn) {
    return { toque: 0, motivo: 'contestó', cerrar: true };
  }

  const pasado = t - ficha.precioEn;
  if (pasado > TOPE_MS) return { toque: 0, motivo: 'tarde', cerrar: true };

  let debido = 0;
  HORAS.forEach(function (h, i) { if (pasado >= h * HORA_MS) debido = i + 1; });
  if (debido <= hechos) return { toque: 0, motivo: 'aún no' };

  if (!esHoraDeEscribir(t)) return { toque: 0, motivo: 'de noche' };

  const ventanaAbierta = !!ficha.clienteEn && (t - ficha.clienteEn) < VENTANA_MS;
  return { toque: debido, motivo: 'toca', ventanaAbierta: ventanaAbierta };
}

module.exports = {
  decide, horaEnGuadalajara, esHoraDeEscribir,
  HORAS, TOPE_MS, VENTANA_MS, DESDE_LAS, HASTA_LAS
};
