/* ============================================================
   LOS DATOS DEL CONTRATO
   ------------------------------------------------------------
   Lo que pasa después de que el cliente manda su comprobante.
   Dictado del dueño el 3-sep-2026:

     «mientras su pago se confirma, esto puede tardar algunas
      horas en lo que el equipo lo ve, preguntas los datos del
      contrato y después... cuando el cliente manda datos siempre
      entra la IA, ya que muchas veces mandan toda la info en
      párrafo y no hay guion que lo lea»

   Este archivo prueba la parte que NO necesita red: leer, juntar
   y perseguir. La llamada a la IA se prueba en
   `probar-whatsapp-contrato.mjs`, con un `fetch` de mentiras.

   Lo que se vigila, en orden de qué tan caro sale si falla:

   1 · Que un dato nuevo VACÍO no borre uno viejo bueno. Si cada
       mensaje borrara el anterior, el cliente tendría que
       repetirlo todo — y ya pagó.
   2 · Que NUNCA se invente un dato. Uno inventado en un contrato
       es peor que uno que falta: el operador llega a la
       dirección equivocada y nadie se entera hasta ese día.
   3 · Que la IA no escriba dinero. R12, otra vez.
   ============================================================ */

const c = require('../api/_datos-contrato.js');

let buenas = 0, malas = 0;
function ok(que, dio, esperaba) {
  const bien = JSON.stringify(dio) === JSON.stringify(esperaba);
  if (bien) { buenas++; console.log('ok   ' + que); }
  else {
    malas++;
    console.log('MAL  ' + que);
    console.log('     dio      ' + JSON.stringify(dio));
    console.log('     esperaba ' + JSON.stringify(esperaba));
  }
}
function okQue(que, condicion) { ok(que, !!condicion, true); }
function titulo(t) { console.log('\n== ' + t.toUpperCase() + ' =='); }

/* ============================================================ */
titulo('son cuatro datos, no cinco');

/* Empezaron siendo cinco. El dueño cortó uno: «1 y 3 es lo mismo» —el
   contrato va a nombre de quien lo firma— y el teléfono lo bajó a
   opcional, porque el cliente está escribiendo desde él. */
/* Cuidado con el número: al cliente se le piden CUATRO cosas, pero son
   CINCO campos. La dirección y la hora van juntas en una sola pregunta
   —«de dónde los recogemos: dirección exacta y hora»— porque así lo
   diría una persona, y porque contarle cinco al cliente cuando puede
   contestarlas en cuatro renglones es alargar el trámite de gratis.

   Adentro sí son cinco, porque el contrato los necesita por separado. */
ok('cinco campos obligatorios adentro', c.OBLIGATORIOS.length, 5);
okQue('pero al cliente se le piden cuatro', /son 4 datos/i.test(c.pideLosDatos(false)));
okQue('y el teléfono NO es uno de ellos',
  c.OBLIGATORIOS.every(function (x) { return x.id !== 'telefono'; }));
okQue('nombre y quién firma son un solo campo',
  c.CAMPOS.every(function (x) { return x.id !== 'quienFirma'; }));

/* ============================================================ */
titulo('el mensaje que se le manda');

{
  const t = c.pideLosDatos(false);
  okQue('dice que TARDA, para que no escriba a los 20 minutos', /horas/i.test(t));
  okQue('dice el número de datos', /son 4 datos/i.test(t));
  okQue('y para qué sirven', /a tu nombre|operador/i.test(t));
  okQue('baja la barrera para contestar', /como te acomode/i.test(t));

  /* Lo que NO puede decir: que el pago está bueno. */
  okQue('NO da el pago por bueno',
    !/pago (confirmado|recibido|acreditado)|ya qued[oó] pagado/i.test(t));
  /* Ni una hora exacta: la tiene que cumplir alguien más. */
  okQue('ni promete una hora exacta', !/en \d+ minutos?|en \d+ horas?\b/i.test(t));

  const a = c.pideLosDatos(true);
  okQue('a la agencia se le dice «el real, no mostrador»', /mostrador/i.test(a));
  okQue('y a una familia no', !/mostrador/i.test(t));
}

/* ============================================================ */
titulo('lo que contesta la IA se limpia antes de guardarse');

/* Nada de lo que devuelve un modelo entra sin pasar por aquí. Lo que
   sale de un modelo es una sugerencia, no un dato. */
{
  const d = c.limpia({
    nombre: '  María   Fernanda  Ortiz  ',
    telefono: '+52 1 33 1234 5678',
    direccionSalida: 'Av. Vallarta 1234, col. Americana',
    horaSalida: '6:00',
    direccionDestino: 'Hotel Riu',
    horaRegreso: '16:30'
  });
  ok('el nombre queda sin espacios de más', d.nombre, 'María Fernanda Ortiz');
  /* Lo que identifica un teléfono en México son los últimos diez: la
     gente escribe «+52 1 33...», «044 33...», «33-1234-5678». */
  ok('del teléfono se guardan los últimos 10', d.telefono, '3312345678');
  ok('la hora se normaliza a dos dígitos', d.horaSalida, '06:00');
  ok('y la dirección se copia TAL CUAL',
    d.direccionSalida, 'Av. Vallarta 1234, col. Americana');
}

/* Una hora imposible no se guarda a medias: se tira. */
ok('«25:00» no es una hora', c.limpiaHora('25:00'), null);
ok('«6 de la mañana» tampoco —eso lo traduce la IA—', c.limpiaHora('6 de la mañana'), null);
ok('un teléfono de 4 dígitos no es un teléfono', c.limpiaTelefono('1234'), null);
ok('y «null» de texto es null de verdad', c.limpiaTexto('null'), null);

/* R12 · LA IA NO ESCRIBE DINERO. Y no se confía en que la instrucción
   se haya respetado: si aparece una cifra en un campo de texto, se tira
   el campo entero. */
ok('una cifra de dinero tira el campo',
  c.limpia({ nombre: 'Juan Pérez $4,500' }).nombre, null);
ok('y «3000 pesos» también',
  c.limpia({ direccionDestino: 'Hotel Riu 3000 pesos' }).direccionDestino, null);
/* Pero un número de calle NO es dinero. Sin esto, «Av. Vallarta 1234»
   se perdería y el operador no sabría a dónde ir. */
ok('pero un número de calle sí pasa',
  c.limpia({ direccionSalida: 'Av. Vallarta 1234' }).direccionSalida, 'Av. Vallarta 1234');

/* ============================================================ */
titulo('un dato nuevo vacío NO borra uno viejo bueno');

/* LA IMPORTANTE. El cliente manda su nombre y su dirección en el primer
   mensaje, y en el segundo solo la hora. Si el segundo borrara al
   primero, tendría que repetirlo todo — y ya pagó. */
{
  const primero = c.limpia({
    nombre: 'María Ortiz',
    direccionSalida: 'Av. Vallarta 1234'
  });
  const segundo = c.limpia({ horaSalida: '06:00' });
  const juntos = c.junta(primero, segundo);

  ok('el nombre del primer mensaje sigue ahí', juntos.nombre, 'María Ortiz');
  ok('la dirección también', juntos.direccionSalida, 'Av. Vallarta 1234');
  ok('y la hora nueva se agregó', juntos.horaSalida, '06:00');
}

/* Pero si se corrige, lo nuevo GANA: «no, mejor a las 7» tiene que
   pisar el «6» de antes. */
{
  const juntos = c.junta(
    c.limpia({ horaSalida: '06:00' }),
    c.limpia({ horaSalida: '07:00' })
  );
  ok('una corrección sí pisa lo anterior', juntos.horaSalida, '07:00');
}

/* ============================================================ */
titulo('se persigue solo lo que falta');

/* Volver a mandar la lista completa al que ya dio tres datos es
   decirle que no le leyeron nada. */
{
  const tiene = c.limpia({
    nombre: 'María Ortiz',
    direccionSalida: 'Av. Vallarta 1234',
    horaSalida: '06:00'
  });
  const faltan = c.faltantes(tiene).map(function (x) { return x.id; });
  ok('sabe exactamente qué falta', faltan, ['direccionDestino', 'horaRegreso']);

  const t = c.pideLoQueFalta(tiene, c.limpia({ horaSalida: '06:00' }));
  okQue('acusa lo que sí dio', /anotado/i.test(t));
  okQue('  y pide la dirección de llegada', /direcci[oó]n/i.test(t));
  okQue('  y la hora de regreso', /regreso/i.test(t));
  /* Lo que NO puede hacer: volver a pedir lo que ya tiene. */
  okQue('  sin volver a pedir el nombre', !/nombre completo/i.test(t));
}

/* Si el mensaje no trajo nada, no se dice «anotado»: sería mentira, y
   el cliente lo nota. */
{
  const t = c.pideLoQueFalta(c.limpia({}), c.limpia({}));
  okQue('sin nada nuevo, no dice «anotado»', !/anotado/i.test(t));
  okQue('  pero sí pide lo que falta', /nombre/i.test(t));
}

/* Y cuando ya está todo, se cierra — sin dar el pago por bueno. */
{
  const todo = c.limpia({
    nombre: 'María Ortiz',
    direccionSalida: 'Av. Vallarta 1234', horaSalida: '06:00',
    direccionDestino: 'Hotel Riu', horaRegreso: '16:00'
  });
  okQue('con los cuatro, está completo', c.estaCompleto(todo));

  const t = c.pideLoQueFalta(todo, todo);
  okQue('se cierra', /tengo todo/i.test(t));
  okQue('  diciendo que el contrato va cuando se confirme el pago',
    /se confirme tu pago/i.test(t));
  okQue('  y NO dando el pago por bueno',
    !/pago (confirmado|recibido)|ya qued[oó] pagado/i.test(t));
}

/* El teléfono es opcional: no contestarlo ya es una respuesta —quiere
   decir que es el mismo desde el que escribe—. Perseguirlo sería
   insistir por algo que el cliente ya dio por sabido. */
{
  const sinTel = c.limpia({
    nombre: 'María Ortiz',
    direccionSalida: 'Av. Vallarta 1234', horaSalida: '06:00',
    direccionDestino: 'Hotel Riu', horaRegreso: '16:00'
  });
  okQue('sin teléfono aparte, igual está completo', c.estaCompleto(sinTel));
}

/* ============================================================ */
titulo('la ficha que le llega al dueño');

{
  const t = c.fichaParaElDueno(c.limpia({
    nombre: 'María Ortiz',
    direccionSalida: 'Av. Vallarta 1234', horaSalida: '06:00',
    direccionDestino: 'Hotel Riu', horaRegreso: '16:00'
  }), '5213399998888');

  okQue('trae quién firma', /María Ortiz/.test(t));
  okQue('las dos direcciones', /Vallarta/.test(t) && /Riu/.test(t));
  okQue('las dos horas', /06:00/.test(t) && /16:00/.test(t));
  /* Sin teléfono aparte, se dice que el bueno es su WhatsApp — no se
     deja el renglón vacío, que se leería como un dato que falta. */
  okQue('y el teléfono, aunque sea el suyo de WhatsApp',
    /5213399998888/.test(t) && /WhatsApp/i.test(t));
  okQue('con el número del cliente, para poder contestarle',
    t.indexOf('5213399998888') !== -1);
}

/* ============================================================ */
console.log('\n' + buenas + ' buenas, ' + malas + ' malas');
process.exit(malas ? 1 : 0);
