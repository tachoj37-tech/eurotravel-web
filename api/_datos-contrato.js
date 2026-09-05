/* ============================================================
   LOS DATOS DEL CONTRATO
   ------------------------------------------------------------
   Cuando el cliente manda su comprobante, su pago NO queda
   confirmado: alguien tiene que revisarlo contra el banco, y eso
   tarda. El dueño lo dijo así el 3-sep-2026:

     «mientras su pago se confirma, esto puede tardar algunas
      horas en lo que el equipo lo ve, preguntas los datos del
      contrato»

   Esas horas son el hueco más peligroso de toda la venta. El
   cliente ya mandó dinero, todavía no tiene nada en la mano, y
   del otro lado hay silencio. Ahí es donde se arrepiente.

   Así que ese hueco se llena con algo que además hace falta: los
   datos de su contrato. El cliente siente que avanza, y cuando
   una persona por fin revisa el depósito, el contrato ya está
   armado.

   ------------------------------------------------------------
   AQUÍ LA IA ENTRA SIEMPRE, Y ES A PROPÓSITO
   ------------------------------------------------------------
   En todo el resto del bot la IA es el último recurso: solo
   cuando el guion se rinde. Aquí es al revés, y lo dictó el
   dueño:

     «cuando el cliente manda datos siempre entra la IA, ya que
      muchas veces mandan toda la info en párrafo y no hay guion
      que lo lea»

   Tiene razón, y no es opinable. Esto llega en un solo mensaje:

     «Va a nombre de María Fernanda Ortiz Lugo, mi cel es el
      3312345678 pero mi whats es el 3319876543, firma mi esposo
      Raúl, nos recogen en Av. Vallarta 1234 col. Americana a
      las 6 de la mañana y vamos al Hotel Riu de Vallarta,
      regresamos el domingo como a las 4»

   Ocho datos, en desorden, con dos teléfonos y dos horas. No hay
   expresión regular que sobreviva a eso, y escribirla sería
   pelearse con el idioma para ahorrarse una llamada de centavos
   en la ÚNICA conversación que ya pagó.

   El costo está acotado solo: esta etapa dura tres o cuatro
   mensajes por venta, y solo la alcanza quien ya depositó.

   ------------------------------------------------------------
   LO QUE LA IA NO HACE
   ------------------------------------------------------------
   Extraer, y nada más. No confirma pagos, no escribe cifras de
   dinero, no redacta las preguntas —las preguntas están aquí
   abajo, escritas y revisadas—. Devuelve campos; las palabras
   las pone este archivo. Es la misma regla de R12 y R45.
   ============================================================ */

'use strict';

/* ------------------------------------------------------------
   LOS CAMPOS
   ------------------------------------------------------------
   `pide` es cómo se le nombra al cliente cuando falta. Está
   escrito para que se lea como lo diría una persona, no como el
   nombre de una columna.

   `opcional` es solo el WhatsApp: se pregunta «dime si tu
   WhatsApp es otro», así que no contestarlo ES una respuesta —
   quiere decir que es el mismo—. Perseguirlo sería insistir por
   un dato que el cliente ya dio por sabido.
   ------------------------------------------------------------ */
const CAMPOS = [
  /* ------------------------------------------------------------
     NOMBRE Y QUIÉN FIRMA SON UN SOLO DATO
     ------------------------------------------------------------
     Empezaron siendo dos —«nombre completo» y «quién firma»— y el
     dueño lo cortó: *«1 y 3 es lo mismo»*. Tiene razón: el
     contrato va a nombre de quien lo firma. Preguntarlo dos veces
     es hacerle repetir lo mismo al que acaba de pagar, que es la
     forma más rápida de que sienta que nadie está leyendo.

     La palabra «firma» se queda dentro de la pregunta porque es la
     que aclara de quién se trata cuando el que escribe no es el
     que viaja — la agencia, la secretaria, el hijo.
     ------------------------------------------------------------ */
  { id: 'nombre', pide: 'El *nombre completo* de quien firma el contrato' },
  /* ------------------------------------------------------------
     EL TELÉFONO YA LO TENEMOS
     ------------------------------------------------------------
     Está escribiendo desde él. Pedírselo es pedirle un dato que
     ya está en la pantalla.

     Dictado del dueño: *«dime si tu número es otro, si te dice que
     no usa el del WhatsApp»*. Así que se pre-llena con el número
     desde el que escribe y solo se pregunta si el bueno es otro.
     Por eso NO es obligatorio: no contestarlo ya es una respuesta
     —quiere decir que es el mismo— y perseguirlo sería insistir
     por algo que el cliente ya dio por sabido.
     ------------------------------------------------------------ */
  { id: 'telefono', pide: 'Un *teléfono* de contacto', opcional: true },
  { id: 'direccionSalida', pide: 'La *dirección exacta* de dónde los recogemos' },
  { id: 'horaSalida', pide: 'La *hora* a la que pasamos por ustedes' },
  { id: 'direccionDestino', pide: 'La *dirección* a la que llegan' },
  { id: 'horaRegreso', pide: 'La *hora* a la que quieren salir de regreso' }
];

const OBLIGATORIOS = CAMPOS.filter(function (c) { return !c.opcional; });

/* ------------------------------------------------------------
   LAS INSTRUCCIONES DE LA IA
   ------------------------------------------------------------
   Separadas de las de `_entender.js` a propósito: aquella lee
   VIAJES —destino, fechas, cuántos van— y ésta lee DATOS DE
   CONTRATO. Meterlas en el mismo prompt haría que cada una
   contaminara a la otra: un «vamos a Vallarta» se leería como
   dirección de destino, y una calle con número se leería como
   cuántas personas van.
   ------------------------------------------------------------ */
function instrucciones() {
  return [
    'Extraes datos de contrato de un mensaje de WhatsApp en español de México.',
    'Contestas SOLO un objeto JSON, sin explicar nada, sin markdown.',
    '',
    'Campos (todos opcionales — pon null lo que no venga en el mensaje):',
    '  nombre            — nombre completo, o empresa, de quien firma el contrato',
    '  telefono          — 10 dígitos, SOLO si da un teléfono distinto al suyo',
    '  direccionSalida   — dirección exacta de dónde los recogen (calle y número, colonia)',
    '  horaSalida        — hora de la recogida, formato 24h "HH:MM"',
    '  direccionDestino  — dirección o lugar exacto al que llegan',
    '  horaRegreso       — hora a la que salen de regreso, formato 24h "HH:MM"',
    '',
    'Reglas:',
    '· "6 de la mañana" es "06:00". "4 de la tarde" es "16:00".',
    '· Si dice que su número es el mismo desde el que escribe, telefono va null.',
    '· NO inventes. Lo que no esté escrito va en null. Un dato inventado',
    '  en un contrato es peor que un dato que falta.',
    '· NO escribas cantidades de dinero, precios ni anticipos. Nunca.',
    '· Copia las direcciones tal como las escribió, sin corregirlas ni',
    '  completarlas: la que él escribió es a la que va a llegar el operador.',
    '',
    'Ejemplo:',
    'Mensaje: "va a nombre de Maria Ortiz, nos recogen en Av Vallarta 1234',
    'col Americana a las 6 de la manana y vamos al Hotel Riu"',
    'Contestas: {"nombre":"Maria Ortiz","telefono":null,',
    '"direccionSalida":"Av Vallarta 1234 col Americana","horaSalida":"06:00",',
    '"direccionDestino":"Hotel Riu","horaRegreso":null}'
  ].join('\n');
}

/* ------------------------------------------------------------
   LIMPIA LO QUE CONTESTÓ LA IA
   ------------------------------------------------------------
   Nada de lo que devuelve entra sin pasar por aquí. Es lo mismo
   que hace `_entender.js` y por la misma razón: lo que sale de
   un modelo es una sugerencia, no un dato.
   ------------------------------------------------------------ */
function soloDigitos(s) { return String(s || '').replace(/\D+/g, ''); }

function limpiaTelefono(v) {
  const d = soloDigitos(v);
  if (!d) return null;
  /* Se guardan los últimos 10: la gente escribe «+52 1 33...», «044
     33...», «33-1234-5678». Lo que identifica al teléfono en México
     son los últimos diez. */
  const diez = d.slice(-10);
  return diez.length === 10 ? diez : null;
}

function limpiaHora(v) {
  const t = String(v || '').trim();
  const m = t.match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  const h = Number(m[1]), min = Number(m[2]);
  if (!(h >= 0 && h <= 23) || !(min >= 0 && min <= 59)) return null;
  return (h < 10 ? '0' : '') + h + ':' + m[2];
}

function limpiaTexto(v, tope) {
  const t = String(v == null ? '' : v).replace(/\s+/g, ' ').trim();
  if (!t || t.toLowerCase() === 'null') return null;
  /* Una cifra de dinero en un campo de texto es la IA saliéndose de su
     trabajo. Se tira el campo entero en vez de guardar medio dato:
     R12 dice que el dinero no lo escribe la IA, y aquí se hace valer
     en vez de confiar en que la instrucción se respetó. */
  if (/\$\s*\d|\b\d{3,}\s*(pesos|mxn)\b/i.test(t)) return null;
  return t.slice(0, tope || 160);
}

function limpia(crudo) {
  const d = crudo && typeof crudo === 'object' ? crudo : {};
  return {
    nombre: limpiaTexto(d.nombre, 120),
    telefono: limpiaTelefono(d.telefono),
    direccionSalida: limpiaTexto(d.direccionSalida, 200),
    horaSalida: limpiaHora(d.horaSalida),
    direccionDestino: limpiaTexto(d.direccionDestino, 200),
    horaRegreso: limpiaHora(d.horaRegreso)
  };
}

/* ------------------------------------------------------------
   JUNTA LO NUEVO CON LO QUE YA HABÍA
   ------------------------------------------------------------
   Lo nuevo gana, pero SOLO si trae algo. Un null de la IA no
   borra un dato que el cliente ya había dado: si en el segundo
   mensaje solo dijo la hora, su nombre sigue ahí.

   Sin esta regla, cada mensaje borraría el anterior y el cliente
   tendría que repetirlo todo — que es exactamente la sensación
   de que del otro lado no hay nadie leyendo.
   ------------------------------------------------------------ */
function junta(tenia, nuevo) {
  const a = tenia || {};
  const b = nuevo || {};
  const salida = {};
  CAMPOS.forEach(function (c) {
    salida[c.id] = (b[c.id] != null && b[c.id] !== '') ? b[c.id] : (a[c.id] || null);
  });
  return salida;
}

function faltantes(datos) {
  const d = datos || {};
  return OBLIGATORIOS.filter(function (c) { return !d[c.id]; });
}

function estaCompleto(datos) { return faltantes(datos).length === 0; }

/* ------------------------------------------------------------
   LA PRIMERA PREGUNTA
   ------------------------------------------------------------
   Va pegada al acuse del comprobante, porque el momento importa:
   el cliente acaba de mandar dinero y todavía no tiene nada.

   Se le dice la verdad de una vez —«puede tardar algunas horas»—
   en lugar de dejarlo esperando una confirmación que no va a
   llegar en cinco minutos. Un cliente al que le avisaron espera;
   uno al que no le avisaron, escribe a los veinte minutos
   preguntando si le llegó, y a la hora ya está nervioso.

   «Son 5 datos» es un número, y el número importa: sin él, el
   cliente no sabe si le vienen cinco preguntas o veinte, y ahí
   es donde deja de contestar.

   Y el 1 cambia si es agencia. «El real, no mostrador» es de
   quien vende mostrador; a una familia no le dice nada.
   ------------------------------------------------------------ */
function pideLosDatos(esAgencia) {
  return 'Tu pago se confirma en cuanto el equipo lo revise — puede tardar ' +
    'algunas horas 🙌\n\n' +
    'Mientras, vamos armando tu contrato 📄 Así queda a tu nombre y el ' +
    'operador sabe exactamente dónde y a qué hora recogerlos.\n\n' +
    'Son 4 datos:\n\n' +
    (esAgencia
      ? '1️⃣ *Nombre completo del titular* que firma — el real, no «mostrador»\n'
      : '1️⃣ *Nombre completo* de quien firma el contrato\n') +
    '2️⃣ *Teléfono* — si el bueno es otro, dímelo; si no, uso éste\n' +
    '3️⃣ *De dónde los recogemos* — dirección exacta y hora\n' +
    '4️⃣ *A qué dirección llegan* — y a qué hora quieren salir de regreso\n\n' +
    'Mándamelos como te acomode, todos juntos o de uno en uno.';
}

/* ------------------------------------------------------------
   Y LA PERSECUCIÓN DE LO QUE FALTE
   ------------------------------------------------------------
   Nadie contesta las cinco a la primera. Lo que NO se puede es
   volver a mandar la lista completa: el cliente que ya dio tres
   datos y los vuelve a ver todos pedidos siente que no le
   leyeron nada.

   Se le acusa lo que sí dio —por nombre, para que se note que se
   leyó— y se le pide solo lo que falta.
   ------------------------------------------------------------ */
function pideLoQueFalta(datos, nuevos) {
  const faltan = faltantes(datos);

  if (!faltan.length) {
    return 'Listo, con eso tengo todo ✅\n\nEn cuanto se confirme tu pago ' +
      'te mando tu contrato.';
  }

  /* Qué se acaba de recibir, para que sepa que se leyó. Solo si trajo
     algo: si el mensaje no aportó nada, decir «anoté» sería mentira. */
  const trajo = nuevos ? CAMPOS.filter(function (c) {
    return nuevos[c.id] != null && nuevos[c.id] !== '';
  }).length : 0;

  const cabeza = trajo
    ? 'Anotado 🙌\n\nNomás me falta:'
    : 'Va 🙌 Me falta:';

  return cabeza + '\n\n' +
    faltan.map(function (c) { return '· ' + c.pide; }).join('\n') +
    '\n\nCon eso queda tu contrato.';
}

/* ------------------------------------------------------------
   LO QUE VE EL DUEÑO
   ------------------------------------------------------------
   Cuando ya está completo, le llega armado para pasarlo al
   contrato sin teclear nada.
   ------------------------------------------------------------ */
function fichaParaElDueno(datos, cliente) {
  const d = datos || {};
  const l = ['📄 *Datos para el contrato*', ''];
  l.push('✍️ Firma: ' + (d.nombre || '?'));
  /* Sin teléfono aparte, el bueno es el del WhatsApp desde el que
     escribió. Se dice así —y no se deja el renglón en blanco— para que
     nadie lo lea como un dato que falta. */
  l.push('📞 ' + (d.telefono || (cliente ? cliente + ' (su WhatsApp)' : '?')));
  l.push('');
  l.push('🚐 Salida: ' + (d.direccionSalida || '?') +
    (d.horaSalida ? '\n   a las ' + d.horaSalida : ''));
  l.push('🏁 Llegada: ' + (d.direccionDestino || '?') +
    (d.horaRegreso ? '\n   regresan a las ' + d.horaRegreso : ''));
  l.push('');
  l.push('_cliente: ' + (cliente || '?') + '_');
  return l.join('\n');
}

module.exports = {
  CAMPOS, OBLIGATORIOS,
  instrucciones, limpia, junta, faltantes, estaCompleto,
  pideLosDatos, pideLoQueFalta, fichaParaElDueno,
  limpiaTelefono, limpiaHora, limpiaTexto
};
