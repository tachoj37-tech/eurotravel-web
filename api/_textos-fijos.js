/* ============================================================
   LOS MENSAJES FIJOS DEL NÚMERO (16-sep-2026)
   ============================================================
   Spec: docs/ESPEC-UN-NUMERO-CUATRO-FUNCIONES.md, §8: «todo mensaje fijo
   sale de un solo archivo de textos, para que el dueño los cambie sin
   tocar la lógica». Aquí viven. Los que manda el servidor por la puerta
   de Kommo se usan tal cual; los que viven en bloques del Salesbot
   (saludo, «Mi cotización anterior») están aquí como referencia y como
   lo que las pruebas comparan.

   Sin IA en ninguno: son frases cerradas, dictadas por el dueño.
   ============================================================ */
'use strict';

const TEXTOS = {
  /* Los que manda el servidor (puerta de Kommo, antes del saludo). */
  comprobanteRecibido: 'Recibido 🙌 En un momento lo revisamos y te confirmamos tu pago por aquí.',
  /* Cuando no se sabe si lo que llegó es foto, PDF o audio (Kommo no lo
     dice): el acuse es neutro. */
  archivoRecibido: 'Recibido 🙌 Si es tu comprobante, en un momento lo revisamos y te confirmamos tu pago por aquí. Si es otra cosa, escríbemela por texto.',
  mandamelo: 'Va, mándamelo por aquí 🙌',
  deNada: 'De nada 🙌 Quedo a tus órdenes para cualquier duda.',

  /* Los que viven en bloques del Salesbot de Kommo (referencia). */
  saludo: '¡Qué tal! Estás con *Eurotravel* 🚐\nRenta de autobuses y Sprinter para tu grupo.\n¿Qué necesitas?',
  /* «Mi cotización anterior» pasa del tope de 20 letras por botón de
     WhatsApp; queda «Cotización anterior». */
  botones: ['Nueva cotización', 'Cotización anterior', 'Hablar con un agente'],
  cotizacionAnterior: 'Va 🙌 ¿La quieres con la misma fecha o con una fecha nueva?',
  botonesFecha: ['Misma fecha', 'Fecha nueva'],
  mismaFecha: 'Perfecto. Un agente se comunica contigo por aquí para revisar tu cotización anterior y seguir con el pago 🙌',
  fechaNuevaPregunta: '¿Para qué fecha sería?',
  fechaNuevaAnotado: 'Anotado 🙌 Un agente se comunica contigo por aquí para revisar tu cotización con la fecha nueva y seguir con el pago.',
  agente: 'Va 🙌 Ahorita te contesta una persona por aquí mismo.',
  /* Botón «Abonar contrato» del saludo en lista (17-sep-2026): 100 % persona. */
  abonar: 'Va 🙌 Manda tu comprobante por aquí; el equipo lo revisa y te confirma el abono.',

  /* Salida fácil a una persona, en la cotización nueva (spec §5). */
  ofrecerPersona: 'Perdón, no te estoy entendiendo bien 🙏 ¿Quieres que te atienda una persona? Contéstame *sí* y en un momento te atiende alguien del equipo; o sigue por aquí y lo intento de nuevo.',
  pasoAPersona: 'Va, en un momento te atiende alguien del equipo 🙌',

  /* Nota interna en el lead cuando llega un comprobante. */
  notaComprobante: '📎 Comprobante recibido por WhatsApp. Regístralo en EuroSystem; al aprobarlo, avísale al cliente.'
};

module.exports = TEXTOS;
