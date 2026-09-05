/* ============================================================
   LA CONVERSACIÓN COMPLETA, DE PRINCIPIO A FIN
   ------------------------------------------------------------
   POR QUÉ HACÍA FALTA ESTE ARCHIVO

   Había 2,253 pruebas verdes y el bot no podía sostener una
   conversación. Ninguna se dio cuenta, y la razón es la misma en
   todas: **armaban el estado a mano**.

       bot.respuestaA('6 de septiembre',
         { paso: 'regreso', salida: DOMINGO, unidad: 'autobus', ... })

   Así se prueba un paso, que está bien y hay que seguir
   haciéndolo. Pero el estado que entra ahí lo escribió alguien
   que ya sabía la respuesta correcta. El que le llega al bot en
   la vida real lo escribió el bot mismo, en el turno anterior.

   Chateando con él salieron tres defectos en la misma charla:

     · «regresamos el 14» no se entendía —«el 14» solo se leía si
       era el mensaje ENTERO—.
     · «el mismo día» tampoco.
     · Y al no entender, contestaba **exactamente lo mismo, para
       siempre**, con `pasa` en false: al dueño no le llegaba nada
       y el cliente se iba sin que nadie se enterara.

   Este archivo hace lo único que ninguna prueba hacía: pasar
   `r.estado` de un turno al siguiente, como lo hace el webhook.
   ============================================================ */

const bot = require('../bot.js');

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

const HOY = '2026-09-03';

/* ------------------------------------------------------------
   Habla como habla el webhook: arrastrando el estado.
   Devuelve todos los turnos para poder mirarlos completos.
   ------------------------------------------------------------ */
function charla(mensajes) {
  let estado = null;
  const turnos = [];
  mensajes.forEach(function (m) {
    const r = bot.respuestaA(m, estado, HOY);
    if (Object.prototype.hasOwnProperty.call(r, 'estado')) estado = r.estado;
    turnos.push({ dijo: m, r: r });
  });
  return turnos;
}

/* ============================================================ */
titulo('de «hola» al precio, sin ayuda');

{
  const t = charla([
    'a chapala el 12 de septiembre somos 12, salimos de guadalajara',
    'regresamos el 14',
    'no vamos a pasear',
    'sí está bien'
  ]);

  /* Ninguno se puede quedar sin respuesta: un turno vacío en WhatsApp
     es el bot callado, y el cliente no sabe si le llegó. */
  const mudos = t.filter(function (x) { return !x.r.texto; });
  ok('el bot contesta en los cuatro turnos', mudos, []);

  /* Y ninguno puede ser un «no entendí»: son las cuatro respuestas
     más normales que existen a sus propias preguntas. */
  const perdidos = t.filter(function (x) { return /no la entend|no lo entend/i.test(x.r.texto); });
  ok('y no se pierde en ninguno',
    perdidos.map(function (x) { return x.dijo; }), []);

  /* Al final tiene que salir la PETICIÓN de precio. El bot no cotiza:
     entrega `cotiza` y quien llama lo resuelve —el navegador en la
     página, `whatsapp.mjs` en WhatsApp—. Sin esto la conversación
     termina en «déjame sacar el precio…» y ahí se queda. */
  const ultimo = t[t.length - 1].r;
  okQue('al final pide el precio', !!ultimo.cotiza);
  okQue('  y dice qué se cotizó, para poder repetírselo', !!ultimo.resumen);
  ok('  con el destino que dijo', ultimo.cotiza && ultimo.cotiza.destino.direccion, 'Chapala');
  ok('  el origen que dijo', ultimo.cotiza && ultimo.cotiza.origen.direccion, 'guadalajara');
  ok('  y las dos fechas', [ultimo.cotiza.salida, ultimo.cotiza.regreso],
    ['2026-09-12', '2026-09-14']);
}

/* ============================================================ */
titulo('«el 14» dentro de una frase');

/* `fechaDe` solo leía un día suelto cuando era el mensaje entero:
   `/^(?:el\s*)?(\d{1,2})$/`. Nadie contesta así. */
{
  const base = {
    paso: 'regreso', salida: '2026-09-12', unidad: 'sprinter', gente: 12,
    destino: 'Chapala', origen: 'Guadalajara'
  };
  function regreso(m) {
    return bot.respuestaA(m, Object.assign({}, base), HOY);
  }
  const dicen = ['14', 'el 14', 'regresamos el 14', 'nos regresamos el 14',
    'el 14 de septiembre', 'regresamos el sábado 14', 'el día 14'];
  dicen.forEach(function (m) {
    okQue('entiende «' + m + '»', !/no la entend/i.test(regreso(m).texto));
  });

  /* Y el candado: un número suelto en medio de una frase NO es una
     fecha. Sin el «el» delante, «somos 12» sería el día 12 y el viaje
     saldría con la fecha de otro mes. */
  okQue('pero «somos 14» NO es el día 14',
    /no la entend/i.test(regreso('somos 14 personas').texto));
}

/* ============================================================ */
titulo('«el mismo día»');

{
  const base = {
    paso: 'regreso', salida: '2026-09-12', unidad: 'sprinter', gente: 12,
    destino: 'Chapala', origen: 'Guadalajara'
  };
  ['el mismo día', 'nos regresamos ese día', 'es ida y vuelta',
    'vamos y nos venimos', 'solo un día'].forEach(function (m) {
    const r = bot.respuestaA(m, Object.assign({}, base), HOY);
    okQue('entiende «' + m + '»', !/no la entend/i.test(r.texto));
    ok('  y el regreso queda el mismo día', r.estado && r.estado.regreso, '2026-09-12');
  });
}

/* R52 NO se puede brincar por esta puerta. Se pensó atajar «el mismo
   día» derecho a `confirmar`, y eso hubiera vendido un autobús en
   domingo — que no existe. */
{
  const domingo = {
    paso: 'regreso', salida: '2026-09-06', unidad: 'autobus', gente: 45,
    destino: 'Chapala', origen: 'Guadalajara'
  };
  const r = bot.respuestaA('el mismo día', domingo, HOY);
  okQue('«el mismo día» en autobús y en domingo SIGUE frenando (R52)',
    /no manejamos ida y vuelta/i.test(r.texto));
  okQue('  y ofrece salidas, no un «no» a secas', r.opciones.length >= 2);
}

/* ============================================================ */
titulo('y no se queda repitiendo lo mismo');

/* Lo que hacía antes: la misma frase, con `pasa` en false, hasta que
   el cliente se aburría. Y del otro lado, ni un aviso. */
{
  let estado = {
    paso: 'regreso', salida: '2026-09-12', unidad: 'sprinter', gente: 12,
    destino: 'Chapala', origen: 'Guadalajara'
  };
  const salieron = [];
  ['aaaa', 'bbbb', 'cccc', 'dddd'].forEach(function (m) {
    const r = bot.respuestaA(m, estado, HOY);
    if (Object.prototype.hasOwnProperty.call(r, 'estado')) estado = r.estado;
    salieron.push(r);
  });

  okQue('a la tercera ya no repite', salieron[2].texto !== salieron[1].texto);
  okQue('  y entrega a una persona', salieron[2].pasa === true);
  /* Sin anunciarlo: «el chiste es que el cliente no sepa que está
     hablando con una IA». */
  okQue('  sin decir que lo pasa con alguien',
    !/te paso con|un vendedor|asesor|una persona/i.test(salieron[2].texto));

  /* Y después de entregarlo no se queda entregando en cada mensaje:
     el contador se limpia para que la conversación pueda seguir. */
  okQue('y el cuarto ya no vuelve a entregar', salieron[3].pasa !== true);
}

/* Lo que SÍ avanza no cuenta como repetición, aunque el cliente tarde
   varios turnos. Si contara, una conversación normal se entregaría
   sola a la mitad. */
{
  const t = charla([
    'quiero cotizar',
    'a tequila',
    'el 20 de septiembre',
    'el mismo día',
    'somos 14'
  ]);
  const entregados = t.filter(function (x) { return x.r.pasa === true; });
  ok('una conversación que avanza no se entrega sola',
    entregados.map(function (x) { return x.dijo; }), []);
}

/* ============================================================ */
titulo('la psicología de venta que pidió el dueño');

/* Del documento de investigación que trajo el 3-sep-2026. Se tomó lo
   que aplica al GUION —que es quien escribe cada palabra— y no al
   prompt: la IA aquí extrae datos, no conversa. Meter su prompt de
   ventas al modelo habría puesto a la IA a escribir precios, que es
   justo lo que R12 y R45 prohíben. */

const PRECIO = { total: 12800, anticipo: 3000, saldo: 9800, dias: 2 };
function cotiza(extra) {
  return bot.textoDeCotizacion(PRECIO, Object.assign({
    destino: 'Tequila', origen: 'Guadalajara',
    salida: '2026-09-12', regreso: '2026-09-13',
    gente: 16, ocasion: 'fiesta', recorridos: 0, horas: 'Hasta 8 horas',
    unidad: 'sprinter'
  }, extra || {}));
}

/* ---- el nombre ---- */
{
  /* Lo más barato de toda la investigación y lo que más cambia el
     tono. Y no hay que pedirlo: Meta lo manda en cada aviso. */
  const con = cotiza({ nombre: 'Marisol' });
  okQue('con nombre, el cierre lo usa', /¿Te la aparto, Marisol\?/.test(con.texto));

  const sin = cotiza({});
  okQue('sin nombre, sigue cerrando igual de bien',
    /¿A qué nombre la aparto\?/.test(sin.texto));
  okQue('  y no deja un hueco vacío', !/undefined|null|,\s*\?/.test(sin.texto));

  /* «No en cada mensaje» — regla del propio documento. Un nombre
     repetido en cada renglón deja de sonar a cercanía y suena a
     telemarketing. */
  const cuantas = (con.texto.match(/Marisol/g) || []).length;
  ok('y aparece UNA sola vez, no en cada renglón', cuantas, 1);
}

/* ---- efecto dotación ---- */
{
  /* Lo que el cliente siente suyo cuesta más trabajo soltarlo. El bot
     tenía 58 fotos y solo las enseñaba si se las pedían. */
  const r = cotiza({});
  okQue('el precio viene con la foto de su unidad', !!(r.medios && r.medios.fotos.length));
  okQue('  y es la de la Sprinter', /sprinter/.test(r.medios.fotos[0]));

  /* La del autobús que ESCOGIÓ, no la de otro. */
  const bus = cotiza({ unidad: 'autobus', unidadNombre: 'Irizar i6S' });
  okQue('quien escogió el i6S ve el i6S', /irizar-i6s/.test(bus.medios.fotos[0]));
  okQue('  y el encabezado dice su unidad, no «Sprinter»',
    /Irizar i6S/.test(bus.texto) && !/\*Sprinter/.test(bus.texto));

  /* A la agencia NO. Quien revende ya sabe cómo se ven las unidades y
     lo que quiere es el número; llenarle el chat es hacerle perder el
     tiempo. */
  const agencia = cotiza({ agencia: true });
  ok('a la agencia no se le mandan fotos', agencia.medios, null);
}

/* ---- argumento de dos caras ---- */
{
  /* Lo más contraintuitivo del documento: admitir una limitación
     convence más que sonar perfecto. Compra el derecho a que se crea
     lo que sigue. */
  const r = bot.respuestaA('otro me lo da más barato', null, HOY);
  okQue('concede algo antes de defenderse',
    /no siempre somos los más baratos/i.test(r.texto));
  okQue('  y enseguida dice contra qué comparar',
    /seguro de viajero/i.test(r.texto));
  /* UNA vez. Un vendedor que se desprecia dos veces deja de sonar
     honesto y suena inseguro. */
  const veces = (r.texto.match(/no somos|no siempre somos/gi) || []).length;
  ok('  pero una sola vez', veces, 1);
  /* Y sin descuento: «esos los ofrezco yo, tú no». */
  okQue('  y sin ofrecer descuento',
    !/descuent|rebaj|te lo dejo en|promoci/i.test(r.texto));
}

/* ---- etiquetar la emoción ---- */
{
  /* Nombrar lo que el otro siente baja su resistencia: deja de tener
     que defenderlo. El miedo del que nunca ha rentado no es el precio,
     es no saber cómo funciona. */
  const r = bot.respuestaA('nunca he rentado un camión', null, HOY);
  okQue('le nombra el sentimiento antes de explicar',
    /se siente raro/i.test(r.texto));
  okQue('  y luego sí le dice los pasos',
    /apartas|contrato|liquidas/i.test(r.texto));
}

/* ---- y nada de esto rompió las reglas de siempre ---- */
{
  const r = cotiza({ nombre: 'Marisol' });
  okQue('el precio sigue sin enseñar kilómetros ni tarifa',
    !/\bkm\b|kil[oó]metro|tarifa|por km/i.test(r.texto));
  okQue('  sigue anclando por persona', /por persona/i.test(r.texto));
  okQue('  sigue diciendo qué incluye ANTES del cierre',
    r.texto.indexOf('Incluye') < r.texto.indexOf('te bloqueo'));
  okQue('  y sigue sin escasez inventada',
    !/quedan \d|[uú]ltimo lugar|se agota/i.test(r.texto));
}

/* ---- el «no» fácil ---- */
{
  /* Un «no» cuesta menos que un «sí». «¿Te la aparto?» obliga al
     cliente a comprometerse por un grupo que todavía no le contesta;
     «¿sería mala idea?» se responde con un «no, órale» que no le
     cuesta nada — y la fecha queda bloqueada igual. */
  const r = bot.respuestaA('déjame preguntarle al grupo', null, HOY);
  okQue('el cierre se ofrece al revés, para que el «no» sea fácil',
    /¿Sería mala idea/i.test(r.texto));
  /* Y NO se pelea con el grupo: primero se le facilita lo que pidió. */
  okQue('  pero primero le facilita el reenvío', /reenviar/i.test(r.texto));
  okQue('  y el reenvío va ANTES que la pregunta',
    r.texto.indexOf('reenviar') < r.texto.indexOf('mala idea'));
  /* Una sola pregunta, como manda la regla de forma. */
  ok('  con una sola pregunta', (r.texto.match(/\?/g) || []).length, 1);
}

/* ---- «somos de aquí» ---- */
{
  /* El principio de unidad: compartir identidad pesa más que caer
     bien. Y aquí es CIERTO —Eurotravel está en Tlaquepaque—, que es lo
     único que lo hace usable. */
  function desde(lugar) {
    return bot.respuestaA(lugar, {
      paso: 'origen', destino: 'Chapala', salida: '2026-09-15',
      regreso: '2026-09-17', gente: 12, unidad: 'sprinter'
    }, HOY).texto;
  }
  okQue('a un tapatío se le dice que somos paisanos',
    /somos de por acá/i.test(desde('Guadalajara')));
  okQue('  y a uno de Tlaquepaque también',
    /somos de por acá/i.test(desde('Tlaquepaque')));

  /* LO IMPORTANTE: a quien NO es de aquí, no. Decirle «también somos
     de aquí» a alguien de Monterrey es una mentira que se cacha sola,
     y de las que cuestan la venta entera. */
  okQue('pero a uno de Monterrey NO', !/somos de por acá/i.test(desde('Monterrey')));
  okQue('  ni a uno de Ocotlán', !/somos de por acá/i.test(desde('Ocotlán')));
}

/* ---- pedir consejo, no opinión ---- */
{
  /* Pedir CONSEJO acerca; pedir opinión aleja. Quien opina te evalúa,
     quien aconseja se pone de tu lado. */
  const base = {
    paso: 'horas', destino: 'Chapala', salida: '2026-09-15',
    regreso: '2026-09-17', gente: 12, unidad: 'sprinter',
    origen: 'Guadalajara', recorridos: 1
  };
  const primera = bot.respuestaA('', Object.assign({}, base), HOY);
  okQue('las horas se preguntan pidiendo consejo',
    /tú qué dices/i.test(primera.texto));

  /* Y si no se entiende la respuesta, se vuelve a preguntar IGUAL —
     no con el tono seco del formulario que se enojó. */
  const otra = bot.respuestaA('pues no sé', Object.assign({}, base), HOY);
  okQue('  y al repetir, con las mismas palabras',
    /tú qué dices/i.test(otra.texto));
}

/* ---- nada se vende por barato ---- */
{
  /* Dictado del dueño el 4-sep-2026, hablando del Century —la unidad de
     entrada—: *«no te refieras a ella como la más barata, sino que más
     se alinea a un presupuesto corto»*.

     La diferencia no es de cortesía. «La más barata» le dice al cliente
     que va a viajar peor, y el que la renta la renta apenado. «La que
     mejor se ajusta a un presupuesto corto» dice lo mismo del precio
     sin decir nada malo de la unidad.

     Vale para TODAS, no solo para el Century: en cuanto una unidad se
     nombre por barata, la de junto queda de cara y todo el catálogo se
     lee como una escalera de calidad que el dueño no quiere vender así.

     Se revisa el catálogo entero, así que también cubre al Century el
     día que se dé de alta.

     `unidades.js` escribe en `window` y no exporta —lo carga la página
     con un `<script>`—, así que aquí se le presta uno y se le quita al
     terminar. */
  const antes = global.window;
  global.window = {};
  delete require.cache[require.resolve('../unidades.js')];
  require('../unidades.js');
  const catalogo = global.window.UNIDADES || [];
  global.window = antes;

  const PALABRA_PROHIBIDA = /barat|econ[oó]mic|de menor precio|la m[aá]s accesible/i;
  const senaladas = catalogo.filter(function (u) {
    return PALABRA_PROHIBIDA.test(String(u.tag) + ' ' + String(u.desc) + ' ' +
      (u.amen || []).join(' '));
  }).map(function (u) { return u.name; });
  ok('ninguna unidad se vende por barata', senaladas, []);

  /* Y el otro lado de la misma regla: las etiquetas dicen QUÉ es la
     unidad, no cuánto cuesta. */
  const conPrecio = catalogo.filter(function (u) {
    return /\$|precio|costo/i.test(String(u.tag));
  }).map(function (u) { return u.name; });
  ok('ni trae precios en la etiqueta', conPrecio, []);

  /* Los i6 son los dos premium: «utiliza todo lo i6, que es premium,
     ya sea sin S o con S». */
  const i6 = catalogo.filter(function (u) { return /^Irizar i6/.test(u.name); });
  ok('los dos i6 son premium', i6.length, 2);
  ok('  y los dos lo dicen',
    i6.filter(function (u) { return /Premium/i.test(u.tag); }).length, 2);

  /* Y el PB dejó de ser «larga distancia», que no es una categoría del
     negocio. */
  const pb = catalogo.filter(function (u) { return u.name === 'Irizar PB'; })[0];
  okQue('el PB ya no dice «larga distancia»', pb && !/larga distancia/i.test(pb.tag));

  /* ---- el Century, dado de alta el 4-sep-2026 ----
     Llevaba meses existiendo sin estar en el catálogo: estaba en el
     sitio oficial, tenía sus fotos bajadas y hasta su renglón en el
     Excel de precios. Lo único que no tenía era estar aquí, y por eso
     el bot no lo podía ofrecer. */
  const century = catalogo.filter(function (u) { return /Century/i.test(u.name); })[0];
  okQue('el Century está en el catálogo', !!century);
  ok('  con 47 pasajeros', century && century.max, 47);
  /* Su forma de venderse es la regla más delicada del catálogo, y ya
     la cubre la prueba de arriba — pero se comprueba aquí también,
     nombrándola, porque es la unidad por la que se escribió. */
  okQue('  y sin decirle barata',
    century && !/barat|econ[oó]mic/i.test(century.desc + ' ' + century.tag));
  okQue('  diciendo para quién es', century && /presupuesto/i.test(century.desc));

  /* Las capacidades, confirmadas contra el sitio oficial el 4-sep-2026.
     Se cuidan porque un número de más son personas paradas el día del
     viaje — y ésa no se corrige después. */
  const capacidades = { 'Irizar i6S': 51, 'Irizar i6': 47, 'Irizar PB': 47,
    'Neobus': 50, 'Irizar Century': 47, 'Marcopolo Paradiso G8': 51 };
  const malas = Object.keys(capacidades).filter(function (n) {
    const u = catalogo.filter(function (x) { return x.name === n; })[0];
    return !u || Number(u.max) !== capacidades[n];
  });
  ok('las capacidades son las del sitio oficial', malas, []);

  /* Y todas las unidades tienen fotos que existen de verdad. Una
     unidad sin fotos es una que el bot ofrece y no puede enseñar —
     y el bot enseña la foto JUNTO CON EL PRECIO, que es el momento en
     que el cliente está decidiendo.

     La excepción se declara en el catálogo con `sinFotos`, no se
     descubre en producción. Hoy la trae el G8, que el dueño dio de
     alta antes de conseguir las suyas. */
  const fs = require('fs');
  const path = require('path');
  const faltan = catalogo.filter(function (u) {
    return !u.sinFotos &&
      !fs.existsSync(path.join(__dirname, '..', 'img', 'unidades', u.id));
  }).map(function (u) { return u.name; });
  ok('toda unidad tiene fotos, o dice que le faltan', faltan, []);

  /* Y la que dice que le faltan NO promete una: `mediosDe` le contesta
     null a quien pregunte. Sin esto, el bot ofrecería enseñar algo que
     no existe. */
  const pendientes = catalogo.filter(function (u) { return u.sinFotos; });
  const prometen = pendientes.filter(function (u) { return !!bot.mediosDe(u.id); })
    .map(function (u) { return u.name; });
  ok('  y la que no las tiene, no las promete', prometen, []);

  /* ---- el G8, dado de alta el 4-sep-2026 ---- */
  const g8 = catalogo.filter(function (u) { return /g8/i.test(u.name); })[0];
  okQue('el G8 está en el catálogo', !!g8);
  ok('  con 51 pasajeros', g8 && g8.max, 51);
  ok('  y modelo 2026', g8 && g8.modelo, 2026);
  okQue('  premium', g8 && /Premium/i.test(g8.tag));

  /* Los escalones, como los dictó el dueño:
       Century → PB → Neobus → premium (i6, i6S, G8)
     Se cuida el ORDEN, no las palabras: si alguien reacomoda las
     etiquetas, esto se pone en rojo. */
  const escalon = { 'Clásico': 1, 'Turismo': 2, 'Gran Turismo': 3, 'Premium': 4 };
  function nivelDe(n) {
    const u = catalogo.filter(function (x) { return x.name === n; })[0];
    return u ? escalon[String(u.tag).replace(/^Autobús · /, '')] : 0;
  }
  okQue('el PB va arriba del Century',
    nivelDe('Irizar PB') > nivelDe('Irizar Century'));
  okQue('el Neobus va arriba del PB',
    nivelDe('Neobus') > nivelDe('Irizar PB'));
  okQue('y los premium hasta arriba',
    nivelDe('Irizar i6S') > nivelDe('Neobus') &&
    nivelDe('Marcopolo Paradiso G8') > nivelDe('Neobus'));
}

/* ---- las reglas de forma ---- */
{
  /* Del documento: «Máximo 3 líneas por mensaje. Una sola pregunta por
     mensaje. Nunca dos.» La razón es real: en WhatsApp un mensaje largo
     se salta, y si trae dos preguntas se contesta una y se pierde la
     otra.

     Se aplica a los mensajes de CONVERSACIÓN. Las dos listas —las
     unidades y lo que incluye— se dejaron largas a propósito: son
     catálogos, y ahí cada renglón es una razón para comprar. */
  const conversacionales = ['hola', 'a chapala', 'somos 16', 'somos 45',
    'tienes fotos', 'está caro', 'otro me lo da más barato',
    'nunca he rentado', 'lo checo con el grupo', 'cancelaciones',
    'a qué cuenta deposito', 'sí apártamela', 'gracias'];

  const conDos = conversacionales.filter(function (m) {
    return (bot.respuestaA(m, null, HOY).texto.match(/\?/g) || []).length > 1;
  });
  ok('ni un mensaje con dos preguntas', conDos, []);

  const largos = conversacionales.filter(function (m) {
    return bot.respuestaA(m, null, HOY).texto
      .split('\n').filter(function (l) { return l.trim(); }).length > 3;
  });
  ok('ni uno de más de tres líneas', largos, []);
}

/* Y el paso de los recorridos, que traía dos preguntas y ni siquiera
   eran dos: los botones contestaban las dos de un golpe. */
{
  const e = {
    paso: 'recorridos', salida: '2026-09-15', regreso: '2026-09-17',
    destino: 'Chapala', origen: 'Guadalajara', gente: 50,
    unidad: 'autobus', unidadNombre: 'Irizar i6S'
  };
  const r = bot.respuestaA('x', e, HOY);
  ok('el paso de recorridos hace UNA pregunta', (r.texto.match(/\?/g) || []).length, 1);
  /* Y dice el beneficio ANTES de preguntar, que es la otra regla: el
     cliente no sabe que el operador se queda con ellos, y ése es el
     dato que hace que quiera los recorridos. */
  okQue('  y dice el beneficio antes de preguntar',
    /operador se queda/i.test(r.texto));
}

/* ============================================================ */
titulo('todos los botones sin estado');

/* Ya existía una prueba que le da de comer al bot cada opción que
   ofrece, pero le pasaba el ESTADO del paso que la ofrecía. Los
   botones de las objeciones no traen estado —esas respuestas se dan
   sin él— y por ahí se colaron cinco:

     · «Apartar en línea» no tenía manejador. El cliente decía que sí
       y el bot le contestaba «déjame checarte eso bien tantito».
       (Y el nombre estaba mal desde que el bot dejó de cobrar con
       Stripe: por WhatsApp solo se recibe transferencia.)
     · «Sí, desglósamelo» — el bot preguntaba «¿te lo desgloso?» y
       no entendía el sí.
     · «Esta semana», «Sí, márcame», «Márcame», «Sí, vamos», igual.

   Ofrecer un botón y no entenderlo es peor que no ofrecerlo: el
   cliente hizo justo lo que se le pidió y aun así se topó con pared.

   Esta prueba lee los botones DEL PROPIO ARCHIVO, así que cubre
   también los que se escriban mañana. Solo se exigen los que se
   pueden contestar sin contexto: los de los pasos de la cotización
   ya los cubre `probar-venta`, con su estado. */
{
  const fs = require('fs');
  const path = require('path');
  const fuente = fs.readFileSync(path.join(__dirname, '..', 'bot.js'), 'utf8');

  /* Se leen TODAS las listas de textos entre corchetes, no solo las que
     empiezan con `opciones:`. Ahí se cayó al primer intento: los botones
     del precio salen de un ternario —`opciones: paraAgencia ? [...] :
     [...]`— y buscando por `opciones:` se perdían justo los dos del
     cierre, que son los que más importan.

     Recoge de más —también listas que no son botones— y no importa: lo
     que se comprueba abajo es que los de la lista estén, no que todo lo
     recogido sea un botón. */
  const todos = new Set();
  const re = /\[([^[\]]*)\]/g;
  let m;
  while ((m = re.exec(fuente))) {
    (m[1].match(/'[^']+'/g) || []).forEach(function (x) { todos.add(x.slice(1, -1)); });
  }
  okQue('se encontraron los botones en el archivo', todos.size >= 20);

  /* Los que SÍ o SÍ tienen que entenderse solos: son respuestas a
     preguntas que el bot hace fuera de la cotización. */
  const SIN_CONTEXTO = ['Sí, apártamela', 'Sí, desglósamelo', 'Esta semana',
    'Sí, márcame', 'Márcame', 'Sí, vamos', 'Hablar con alguien',
    'Cotizar mi viaje', 'Ver fotos', 'Qué unidades tienen', 'Está caro',
    'Lo checo con el grupo', 'Cotizar otro'];

  /* Primero: que sigan existiendo. Si alguien renombra un botón y no
     toca esta lista, la prueba tiene que avisar en vez de callarse. */
  const desaparecidos = SIN_CONTEXTO.filter(function (b) { return !todos.has(b); });
  ok('los botones de la lista siguen existiendo en bot.js', desaparecidos, []);

  const perdidos = SIN_CONTEXTO.filter(function (b) {
    return /checarte eso bien tantito/.test(bot.respuestaA(b, null, HOY).texto);
  });
  ok('y el bot entiende todos los suyos, sin estado', perdidos, []);
}

/* ============================================================ */
console.log('\n' + buenas + ' buenas, ' + malas + ' malas');
process.exit(malas ? 1 : 0);
