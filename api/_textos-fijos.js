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
  /* Un audio (21-sep-2026): por Kommo llega solo la palabra «audio». Aún
     no se transcribe; se pide por texto y una persona lo escucha. */
  audioRecibido: 'Recibí tu audio 🙌 Por aquí solo leo texto: ¿me lo escribes? Si prefieres, en un momento lo escucha alguien del equipo.',
  /* Anuncio de pago (17-sep-2026, dictado: «yo recomendaría que no uses
     bot»): el bot se calla y se apaga; esta nota es para el vendedor. */
  notaPago: '💳 El cliente anuncia un pago o comprobante por WhatsApp. Lo atiende una persona: regístralo en EuroSystem y confírmale.',
  deNada: 'De nada 🙌 Quedo a tus órdenes para cualquier duda.',

  /* Los que viven en bloques del Salesbot de Kommo (referencia). */
  saludo: '¡Qué tal! Estás con Eurotravel 🚐\nRenta de autobuses y Sprinter para tu grupo.\n¿Qué necesitas?',
  /* Menú numerado (17-sep-2026): Kommo no manda listas de WhatsApp y con
     4 botones parte el saludo en 3 + 1. El cliente contesta con el número
     o con la palabra. */
  saludoNumerado: '¡Qué tal! Estás con Eurotravel 🚐\nRenta de autobuses y Sprinter para tu grupo.\nResponde con un número:\n1 Nueva cotización\n2 Cotización anterior\n3 Abonar contrato\n4 Hablar con un agente',
  /* 17-sep-2026, decisión final: 3 botones (Nueva cotización · Cotización
     anterior · Abonar contrato) y el agente por texto, en el mismo
     mensaje, para no duplicar el saludo. */
  /* 21-sep-2026, dictado del dueño: «de momento quita la opción de hablar
     con un agente en el mensaje de saludo». Escribir «agente» sigue
     pasando con una persona (candado del cerebro); solo no se anuncia. El
     nombre se conserva para no tocar el generador. */
  saludoConAgente: '¡Qué tal! Estás con Eurotravel 🚐\nRenta de autobuses y Sprinter para tu grupo.\n¿Qué necesitas?',
  /* «Mi cotización anterior» pasa del tope de 20 letras por botón de
     WhatsApp; queda «Cotización anterior». */
  botones: ['Nueva cotización', 'Cotización anterior', 'Hablar con un agente'],
  cotizacionAnterior: 'Va 🙌 ¿La quieres con la misma fecha o con una fecha nueva?',
  botonesFecha: ['Misma fecha', 'Fecha nueva'],
  mismaFecha: 'Perfecto. Un agente se comunica contigo por aquí para revisar tu cotización anterior y seguir con el pago 🙌',
  fechaNuevaPregunta: '¿Para qué fecha sería?',
  fechaNuevaAnotado: 'Anotado 🙌 Un agente se comunica contigo por aquí para revisar tu cotización con la fecha nueva y seguir con el pago.',
  agente: 'Va 🙌 Ahorita te contesta una persona por aquí mismo.',
  /* La regla del apartado (R51 del criterio): 20 % del total, redondeado
     hacia arriba a los $500. Después del resumen el bot no sabe el total
     (lo da el vendedor), así que dice la regla sin cifras (25-sep-2026). */
  reglaDelApartado: 'Para apartar es el 20 % del total, redondeado hacia arriba a los 500 pesos, por transferencia 🙌 El resto se cubre antes de la salida o al abordar.',
  /* Botón «Abonar contrato» del saludo en lista (17-sep-2026): 100 % persona. */
  abonar: 'Va 🙌 Manda tu comprobante por aquí; el equipo lo revisa y te confirma el abono.',

  /* Salida fácil a una persona, en la cotización nueva (spec §5). */
  ofrecerPersona: 'Perdón, no te estoy entendiendo bien 🙏 ¿Quieres que te atienda una persona? Contéstame sí y en un momento te atiende alguien del equipo; o sigue por aquí y lo intento de nuevo.',
  pasoAPersona: 'Va, en un momento te atiende alguien del equipo 🙌',

  /* Nota interna en el lead cuando llega un comprobante. */
  notaComprobante: '📎 Comprobante recibido por WhatsApp. Regístralo en EuroSystem; al aprobarlo, avísale al cliente.',

  /* 19-sep-2026: el cliente escribió en vez de elegir del menú y lo que
     escribió no pide cotizar. El bot no adivina: lo atiende una persona. */
  notaSinMenu: '💬 El cliente escribió sin elegir del menú y no pidió cotizar. Lo atiende una persona.',
  /* 21-sep-2026: el primer mensaje que recibe el cerebro no pide un viaje
     (un «buenas tardes»). Puede venir de alguien que SÍ apretó «Nueva
     cotización» —ese botón lo contesta Kommo y no llega aquí—, así que no
     se manda con una persona: se pregunta una vez. */
  preguntaSiCotiza: '¿Te ayudo a cotizar un viaje? 🚐 Dime a dónde van, cuándo y cuántos son. Si es por un contrato o un pago, escribe agente.'
};

module.exports = TEXTOS;
