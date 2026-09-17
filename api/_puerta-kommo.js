/* ============================================================
   LA PUERTA: EL CEREBRO DECIDE ANTES DEL SALUDO (16-sep-2026)
   ============================================================
   Spec: docs/ESPEC-UN-NUMERO-CUATRO-FUNCIONES.md, §2. Cada conversación
   nueva en Kommo pasa primero por aquí, callada. Con el primer mensaje
   se decide UNA de cuatro salidas y Kommo hace el resto con bloques:

     comprobante · llegó una foto, un PDF (o un audio: Kommo no dice cuál)
                   → acuse fijo y parar. Sea quien sea (§4.4).
     espera      · el texto anuncia un pago («te mando el comprobante»)
                   → «Va, mándamelo por aquí» y esperar la foto (§4.4).
     denada      · el mensaje es SOLO un agradecimiento
                   → «De nada, quedo a tus órdenes» y parar (§4.3, opción A).
     saludo      · cualquier otra cosa → el saludo con tres botones (§3).

   Sin IA: son reglas cerradas, y por eso se prueban con frases reales.
   Una pregunta nunca cae en «espera» ni en «denada»: quien pregunta
   quiere respuesta, y esa la da el saludo (botón «Hablar con un agente»)
   o el cerebro de la cotización.
   ============================================================ */
'use strict';

const TEXTOS = require('./_textos-fijos.js');

function limpia(texto) {
  return String(texto || '')
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}\u{200D}]/gu, ' ')
    .replace(/[^a-z0-9ñ¿?¡!\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function esPregunta(texto) {
  const t = limpia(texto);
  return /[?¿]/.test(String(texto || '')) ||
    /\b(como|donde|cuando|cuanto|cuantos|cuanta|cuantas|que|cual|cuales|quien|puedo|puedes|pueden|podria|podrian|hay|tienen|tiene|me (?:dices|dicen|pasas|pasan|mandas|mandan|puedes))\b/.test(t);
}

/* ------------------------------------------------------------
   SOLO UN AGRADECIMIENTO
   ------------------------------------------------------------
   Lista sacada de cómo escribe la gente (pláticas reales del almacén y
   del número de prueba), no de mi cabeza. Cuenta como «solo gracias» un
   mensaje corto hecho nada más de estas palabras, con o sin emojis y
   signos. En cuanto trae otra cosa —una pregunta, un dato, un «pero»—
   ya no lo es.
   ------------------------------------------------------------ */
const PALABRAS_DE_GRACIAS = new Set([
  'gracias', 'grax', 'grac', 'gracia', 'thanks', 'muchas', 'muchisimas', 'mil',
  'ok', 'okey', 'okay', 'oki', 'va', 'vale', 'sale', 'listo', 'lista', 'perfecto', 'perfect',
  'excelente', 'genial', 'super', 'buenisimo', 'bien', 'muy', 'amable', 'gentil',
  'de', 'acuerdo', 'entendido', 'enterado', 'recibido', 'anotado', 'claro', 'si', 'sii', 'siii',
  'por', 'la', 'el', 'lo', 'info', 'informacion', 'respuesta', 'atencion', 'ayuda', 'todo', 'tu', 'su',
  'quedo', 'pendiente', 'al', 'estamos', 'en', 'contacto', 'saludos', 'buen', 'buenas', 'dia', 'tarde', 'noche', 'noches', 'tardes', 'dias',
  'igualmente', 'bendiciones', 'que', 'este', 'esten', 'les', 'te', 'a', 'ti', 'usted', 'ustedes', 'y', 'un', 'una', 'buena'
]);
const NUCLEO_DE_GRACIAS = /\b(gracias|grax|thanks|ok|okey|okay|oki|va|vale|sale|listo|lista|perfecto|excelente|genial|super|entendido|enterado|recibido|anotado|de acuerdo)\b/;

function soloAgradecimiento(texto) {
  const crudo = String(texto || '');
  if (!crudo.trim()) return false;
  if (esPregunta(crudo)) return false;
  const t = limpia(crudo).replace(/[¿?¡!]/g, ' ').replace(/\s+/g, ' ').trim();
  /* Solo emojis (👍 🙏 ❤️): también es un «gracias». */
  if (!t) return /[\u{1F44D}\u{1F64F}\u{2764}\u{1F60A}\u{1F642}\u{1F44C}\u{1F91D}\u{2705}]/u.test(crudo);
  const palabras = t.split(' ');
  if (palabras.length > 8) return false;
  if (!NUCLEO_DE_GRACIAS.test(t)) return false;
  return palabras.every(function (p) { return PALABRAS_DE_GRACIAS.has(p); });
}

/* ------------------------------------------------------------
   ANUNCIA UN PAGO
   ------------------------------------------------------------
   «te mando el comprobante», «ahí va la ficha», «ya hice la
   transferencia», «adjunto el depósito», «le mando el pago». Hace falta
   un verbo de mandar/hacer Y una palabra de pago, o un verbo de pagar
   conjugado. Una pregunta («¿cómo hago el pago?») no entra.
   ------------------------------------------------------------ */
const PALABRA_DE_PAGO = /\b(comprobante|ficha|transferencia|deposito|pago|abono|voucher|captura|recibo|ticket|anticipo|apartado)\b/;
const VERBO_DE_MANDAR = /\b(te|le|les)?\s?(mando|envio|enviamos|mandamos|paso|pasamos|comparto|adjunto|dejo|anexo|ahi va|ahi te va|aqui va|aqui te va|ahi esta|aqui esta|ahi le va|aqui le va)\b/;
const YA_PAGUE = /\b(ya|acabo de|acabamos de|recien)\s+(hice|hicimos|realice|realizamos|deposite|depositamos|transferi|transferimos|pague|pagamos|mande|mandamos|envie|enviamos|abone|abonamos|depositar|transferir|pagar|abonar|hacer(?:la|lo)?(?: la| el)?(?: transferencia| deposito| pago)?)\b|\b(deposite|transferi|pague|abone|depositamos|transferimos|pagamos|abonamos)\b/;

function anunciaPago(texto) {
  const crudo = String(texto || '');
  if (!crudo.trim() || esPregunta(crudo)) return false;
  const t = limpia(crudo);
  if (YA_PAGUE.test(t)) return true;
  return VERBO_DE_MANDAR.test(t) && PALABRA_DE_PAGO.test(t);
}

/* ------------------------------------------------------------
   LA DECISIÓN
   ------------------------------------------------------------
   `aviso` es lo que ya leyó `leeAvisoDeWidget`: `mensaje` (texto o
   vacío). Kommo manda el mensaje vacío cuando llega un archivo.
   ------------------------------------------------------------ */
function decide(aviso) {
  const texto = String((aviso && aviso.mensaje) || '');
  if (!texto.trim()) return { modo: 'comprobante', texto: TEXTOS.archivoRecibido, nota: TEXTOS.notaComprobante };
  if (anunciaPago(texto)) return { modo: 'espera', texto: TEXTOS.mandamelo, nota: '' };
  if (soloAgradecimiento(texto)) return { modo: 'denada', texto: TEXTOS.deNada, nota: '' };
  return { modo: 'saludo', texto: '', nota: '' };
}

module.exports = { decide, soloAgradecimiento, anunciaPago, esPregunta, limpia };
