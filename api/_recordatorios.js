/* ============================================================
   Los recordatorios al cliente que no contestó
   ------------------------------------------------------------
   Investigado el 2-sep-2026. Cuatro hallazgos, y los cuatro
   cambian lo que se escribe:

   1 · TRES TOQUES, Y SE ACABA. Un estudio comparó secuencias de
       tres contra una sola: $24.9 millones contra $3.8. Pero
       después del tercero se para — el cuarto ya molesta y
       quema al cliente para siempre.

   2 · NADA DE DESCUENTO. Y no solo porque el dueño no lo
       autoriza: ofrecer descuento temprano **entrena al cliente
       a no contestar la primera vez**, a ver si le bajan. Se
       arruina el siguiente viaje y el siguiente.

       «no hay ningún descuento jamás. Esos descuentos por tu
        propia cuenta los ofrezco yo, pero tú no» — el dueño.

   3 · LA AVERSIÓN A LA PÉRDIDA, UNA SOLA VEZ. Repetida deja de
       creerse. Por eso solo el tercero la usa.

   4 · LA ESCASEZ TIENE QUE SER CIERTA. Y aquí Eurotravel tiene
       ventaja sobre cualquier tienda: una fecha tiene unidad o
       no la tiene. No hay que inventar nada.

   ------------------------------------------------------------
   POR QUÉ DIEZ VARIANTES DE CADA UNO
   ------------------------------------------------------------
   Pedido del dueño: *«que el cliente no diga: está mandando lo
   mismo, ya me la sé»*.

   Y no es solo por el que recibe dos: es por el vendedor que ve
   pasar cien conversaciones. Un texto repetido cien veces se
   vuelve ruido para todos, y deja de sonar a persona.

   La variante se escoge por el número del cliente, así que la
   misma persona no recibe dos veces la misma, y dos personas
   distintas casi nunca reciben la misma el mismo día.
   ============================================================ */

'use strict';

/* ------------------------------------------------------------
   PRIMER TOQUE · UNA HORA
   ------------------------------------------------------------
   La mayoría no decidió irse: se distrajo. Iba manejando, le
   hablaron, se le acabó la pila. Este mensaje NO vende — nada
   más vuelve a poner el tema enfrente.

   Corto, sin presión, y sin repetir el precio: repetirlo lo
   vuelve una insistencia de cobro.
   ------------------------------------------------------------ */
const UNA_HORA = [
  'Oye, ¿te llegó bien la cotización? Cualquier duda me dices 🙌',
  '¿Alcanzaste a verla? Si tienes alguna pregunta aquí ando.',
  'Nomás para checar que sí te haya llegado 🙂 ¿Alguna duda?',
  '¿Qué te pareció? Si algo no te cuadra, dime y lo vemos.',
  'Ahí te dejé la cotización. ¿Te sirve así o le movemos algo?',
  '¿La pudiste ver? Cualquier cosa que necesites, aquí estoy.',
  'Oye, ¿todo bien con la cotización? Me dices si le falta algo.',
  '¿Le echaste un ojo? Si quieres le cambiamos días o fechas, sin problema.',
  'Aquí sigo por si tienes dudas del viaje 🙌',
  '¿Cómo ves? Si necesitas que le ajuste algo, nomás dime.'
];

/* ------------------------------------------------------------
   SEGUNDO TOQUE · VEINTICUATRO HORAS
   ------------------------------------------------------------
   Ya ignoró uno. Eso significa que HUBO UNA RAZÓN, no un
   descuido — y casi siempre la razón es miedo: nunca ha
   rentado, no sabe cómo funciona, no sabe si es seguro.

   Así que este quita barreras. No baja el precio: baja el
   riesgo. Y termina abriendo la puerta a que pregunte, porque
   el que pregunta compra.

   Lo único que se afirma de la empresa es el seguro de viajero,
   que está en su propio sitio oficial. Nada más.
   ------------------------------------------------------------ */
const VEINTICUATRO_HORAS = [
  'Por si ayuda: todas las unidades traen seguro de viajero, y apartas ' +
    'tu fecha con el anticipo. El resto lo liquidas antes de salir.',
  'Te cuento cómo funciona, por si nunca has rentado: apartas la fecha, ' +
    'te llega tu contrato, y el resto se paga antes del viaje.',
  'Una cosa que a veces no queda clara: el precio ya incluye operador, ' +
    'combustible y casetas. No se le suma nada después.',
  '¿Te quedó alguna duda de cómo funciona? Te la resuelvo en un minuto.',
  'Nomás por si sirve: todas nuestras unidades llevan seguro de viajero.',
  'Si lo que te frena es no saber cómo es el trámite, es sencillo: ' +
    'apartas, te mando tu contrato, y ya.',
  'Cualquier cosa que te haga ruido del viaje, pregúntame sin pena 🙌',
  'Por si lo estás comparando: checa que el otro precio incluya casetas, ' +
    'operador y seguro. Ahí suele estar la diferencia.',
  '¿Hay algo que te gustaría que te aclare antes de decidir?',
  'Si necesitas verlo distinto —otros días, otra unidad— dime y te lo armo.'
];

/* ------------------------------------------------------------
   TERCER TOQUE · SETENTA Y DOS HORAS
   ------------------------------------------------------------
   El último. Aquí, y SOLO aquí, va la aversión a la pérdida.

   ------------------------------------------------------------
   Y AQUÍ ESTÁ LA PARTE DELICADA
   ------------------------------------------------------------
   El dueño lo cachó antes de que se escribiera:

     «sí tiene que estar comprobable, porque ¿qué tal si después
      de las 72 horas ya se llenó?»

   Tiene razón. Decirle «tu fecha sigue libre» sin haberlo
   revisado es inventar — y es la peor clase de invento, porque
   si se llenó, el cliente se entera cuando ya confió.

   Por eso hay DOS juegos:

   · `SIN_CALENDARIO` · lo que se puede decir hoy. Cierra
     preguntando, sin afirmar nada de disponibilidad.
   · `CON_CALENDARIO` · se desbloquea SOLO cuando la puerta del
     calendario de EuroSystem esté conectada y haya contestado
     que sí. Hasta entonces no se usan, y no por olvido.

   Se escoge con una bandera, no con un comentario que alguien
   pueda ignorar.
   ------------------------------------------------------------ */
const SETENTA_Y_DOS_SIN_CALENDARIO = [
  'Oye, ¿seguimos con lo del viaje? Si ya no va, dime sin pena y ' +
    'te dejo de dar lata 🙂',
  '¿Cómo quedaron con el grupo? Nomás para saber si le sigo apartando ' +
    'un lugar en la agenda.',
  'Te escribo por última vez para no incomodarte: ¿le seguimos o lo ' +
    'dejamos para después?',
  '¿Todavía va el plan? Si cambiaron algo, me dices y lo recotizo.',
  'No quiero estarte insistiendo. Nada más dime si sigue en pie y ' +
    'quedo pendiente.',
  '¿Se animaron o lo mueven para otra fecha? Cualquiera de las dos me sirve.',
  'Última por hoy 🙌 ¿Le entramos, o te escribo más adelante?',
  'Si el plan sigue, apartamos. Si no, dime y lo dejo por la paz.',
  '¿Quedó en veremos? Dime y te busco cuando se acerque la fecha.',
  'Cierro tu cotización o la dejo abierta, ¿cómo la ves?'
];

/* ESTOS AFIRMAN DISPONIBILIDAD. No se usan hasta que el calendario
   conteste. Cada uno es verdad solo si alguien la comprobó. */
const SETENTA_Y_DOS_CON_CALENDARIO = [
  'Te aviso nomás: el [fecha] todavía lo tengo libre. Si se aparta ' +
    'otro grupo te digo.',
  'Sigue disponible tu fecha. En cuanto deje de estarlo te lo digo, ' +
    'para que no te agarre de sorpresa.',
  'El [fecha] sigue abierto. ¿Lo apartamos o lo suelto?',
  'Todavía tengo unidad para el [fecha]. Nomás no te confíes mucho 🙂',
  'Buenas noticias: tu fecha sigue libre. ¿Le entramos?',
  'Ahorita el [fecha] está disponible. Si quieres lo bloqueo hoy mismo.',
  'Te tengo apartada la fecha hasta que me digas. ¿Seguimos?',
  'El [fecha] sigue en pie. En cuanto se ocupe te aviso.',
  'Sigo con tu fecha disponible. ¿La cierro a tu nombre?',
  'Todavía alcanzas el [fecha]. ¿Lo dejamos amarrado?'
];

/* ------------------------------------------------------------
   CUÁL LE TOCA A CADA QUIEN
   ------------------------------------------------------------
   Se escoge con el número del cliente, no al azar: así la misma
   persona recibe siempre la misma variante en su secuencia —no
   se contradice a media conversación— y dos personas distintas
   casi nunca reciben la misma el mismo día.

   `vuelta` cambia si el mismo cliente vuelve semanas después
   por otro viaje: entonces le toca otra, y no siente que le
   mandan la grabación de siempre.
   ------------------------------------------------------------ */
function revuelve(texto) {
  let h = 0;
  const s = String(texto || '');
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

function variante(lista, cliente, vuelta) {
  if (!lista || !lista.length) return null;
  const n = revuelve(String(cliente || '') + '|' + (vuelta || 0));
  return lista[n % lista.length];
}

/* ------------------------------------------------------------
   EL RECORDATORIO QUE TOCA
   ------------------------------------------------------------
   `toque` es 1, 2 o 3. No hay 4: tres y silencio.

   `fechaLibre` solo puede venir en true cuando el calendario lo
   confirmó. Si viene en true SIN fecha, se usa el juego sin
   calendario igual — porque un mensaje que dice «el [fecha]»
   con el hueco vacío es peor que no mandar nada.
   ------------------------------------------------------------ */
function recordatorio(toque, opciones) {
  const o = opciones || {};
  const cliente = o.cliente || '';
  const vuelta = o.vuelta || 0;

  if (toque === 1) return variante(UNA_HORA, cliente, vuelta);
  if (toque === 2) return variante(VEINTICUATRO_HORAS, cliente, vuelta);

  if (toque === 3) {
    const puedeAfirmar = o.fechaLibre === true && !!o.fecha;
    if (!puedeAfirmar) return variante(SETENTA_Y_DOS_SIN_CALENDARIO, cliente, vuelta);
    return variante(SETENTA_Y_DOS_CON_CALENDARIO, cliente, vuelta)
      .replace(/\[fecha\]/g, o.fecha);
  }

  /* No hay cuarto toque, y devolver null es la forma de que no lo
     haya: quien llame no tiene nada que mandar. */
  return null;
}

/* Los tiempos, en horas. Salieron de la investigación, no de un
   gusto: la primera dentro de la hora porque la intención todavía
   está alta; la última a las 72 porque después ya es acoso. */
const A_LAS_HORAS = [1, 24, 72];

module.exports = {
  recordatorio, variante, revuelve, A_LAS_HORAS,
  UNA_HORA, VEINTICUATRO_HORAS,
  SETENTA_Y_DOS_SIN_CALENDARIO, SETENTA_Y_DOS_CON_CALENDARIO
};
