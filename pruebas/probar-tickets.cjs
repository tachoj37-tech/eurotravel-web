/* ------------------------------------------------------------
   LOS TICKETS AL DUEÑO Y SUS RESPUESTAS
   ------------------------------------------------------------
   Etapa 2 del plan de WhatsApp. Cómo lo quiso el dueño:

     · A él NO le llegan los mensajes de los clientes.
     · Le llega un mensaje del BOT con el viaje armado.
     · Él lo contesta y el bot le pasa sus palabras al cliente.
     · Desde ahí la IA se calla en esa conversación.

   Lo que se vigila aquí, en orden de qué tan caro sale si falla:

   1 · Que un mensaje del DUEÑO nunca se conteste como si fuera un
       cliente. Sería el bot discutiendo con su jefe.
   2 · Que sus palabras lleguen TAL CUAL, sin adornar.
   3 · Que un mensaje suyo que no se supo entregar se le AVISE. Un
       mensaje perdido en silencio es una venta perdida en
       silencio.
   4 · Que el ticket no traiga precio. El precio lo pone él; ése
       es el punto entero.

   Nada de aquí toca la red.
   ------------------------------------------------------------ */

const crypto = require('crypto');
const hook = require('../api/_whatsapp-webhook.js');
const tk = require('../api/_tickets.js');

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

const SECRETO = 'secreto-de-prueba';
const DUENO = '5213311112222';
/* Desde el 9-sep-2026 el dueño recibe un aviso la primera vez que un
   número escribe. Estas pruebas cuentan los mensajes que le llegan POR EL
   VIAJE, así que ese saludo se descuenta; que llegue una sola vez y con lo
   que debe traer se prueba aparte, en R47. */
function esElPrimero(e) { return String(e.escribio || '') === '[ticket · primer mensaje]'; }
const CLIENTE = '5213399998888';
/* ------------------------------------------------------------
   EL DÍA SE FIJA, NO SE HEREDA DEL RELOJ — 11-sep-2026
   ------------------------------------------------------------
   Esta batería arma viajes con fechas escritas a mano —«10 de
   septiembre», «13 de septiembre»— y sin fijar el día valían lo que
   valieran HOY. El 10 de septiembre pasaron; el 11, «10 de septiembre»
   ya es pasado y el viaje deja de armarse: el ticket no sale y la
   prueba truena por una fecha, no por el código.

   Se descubrió de la peor manera posible: la suite quedó verde a las
   11 de la noche y en rojo a la mañana siguiente, sin que nadie tocara
   nada. Una prueba que depende del reloj miente en las dos direcciones.
   ------------------------------------------------------------ */
const ENV = { WHATSAPP_APP_SECRET: SECRETO, DUENO_WHATSAPP: DUENO, HOY_DE_PRUEBA: '2026-09-05' };

function firma(cuerpo) {
  return 'sha256=' + crypto.createHmac('sha256', SECRETO)
    .update(Buffer.from(cuerpo, 'utf8')).digest('hex');
}

function aviso(de, texto, extra) {
  return JSON.stringify({
    entry: [{ changes: [{ value: {
      metadata: { phone_number_id: '111' },
      messages: [Object.assign({
        id: 'm-' + Math.random().toString(36).slice(2),
        from: de, type: 'text', text: { body: texto }
      }, extra || {})]
    } }] }]
  });
}

function corre(cuerpo, env) {
  return hook.procesa(Buffer.from(cuerpo, 'utf8'), firma(cuerpo),
    Object.assign({}, ENV, env || {}));
}

/* ============================================================ */
titulo('quién es el dueño');

okQue('lo reconoce por su número', tk.esDelDueno(DUENO, ENV));
/* México manda el número a veces con 52 y a veces con 521. Comparar
   cadenas completas fallaría justo con el dueño. */
okQue('y aunque venga con otro prefijo',
  tk.esDelDueno('5213311112222', { DUENO_WHATSAPP: '523311112222' }));
okQue('un cliente NO es el dueño', !tk.esDelDueno(CLIENTE, ENV));
okQue('sin número configurado, nadie es el dueño',
  !tk.esDelDueno(DUENO, { DUENO_WHATSAPP: '' }));
/* Auditoría 7-sep-2026, hallazgo 7: ser el dueño se decide con el número
   COMPLETO. Un número de otro país que termine en los mismos 10 dígitos
   NO es el dueño (antes entraba y podía pedir «tablero»). */
okQue('otro país con los mismos 10 dígitos al final NO es el dueño',
  !tk.esDelDueno('13311112222', ENV) && !tk.esDelDueno('343311112222', ENV));
okQue('  y con 10 dígitos pelones en la variable, sí lo es',
  tk.esDelDueno('5213311112222', { DUENO_WHATSAPP: '3311112222' }));
okQue('  «mismoNumero» sigue agrupando por los últimos 10 (no autoriza)',
  tk.mismoNumero('13311112222', DUENO));

/* ============================================================ */
titulo('el ticket');

const ticket = tk.armaTicket({
  cliente: CLIENTE, origen: 'Guadalajara', destino: 'Puerto Vallarta',
  salida: '2026-09-10', regreso: '2026-09-13', dias: 4,
  unidad: 'autobus', gente: 45, movimientos: 2
});

okQue('trae a dónde va', /Guadalajara → Puerto Vallarta/.test(ticket));
okQue('trae los días', /4 días/.test(ticket));
okQue('trae la unidad con nombre de gente, no de código',
  /Autobús/.test(ticket) && !/autobus/.test(ticket));
okQue('trae cuántos van', /45 pasajeros/.test(ticket));
okQue('dice si hay movimientos', /2 días con movimiento/.test(ticket));
okQue('y las fechas como se dicen, no como las guarda la máquina',
  /10 de septiembre al 13 de septiembre/.test(ticket) && !/2026-09/.test(ticket));

/* LA MÁS IMPORTANTE: el ticket NO trae precio. El precio lo pone el
   dueño — es la razón de que exista el ticket. */
okQue('NO trae precio', !/\$/.test(ticket));
okQue('trae el número del cliente, para poder contestarle sin memoria',
  ticket.indexOf(CLIENTE) !== -1);

const deAgencia = tk.armaTicket({ cliente: CLIENTE, agencia: true, dias: 2 });
okQue('y avisa cuando es agencia', /Es agencia/.test(deAgencia));

/* ============================================================ */
titulo('al dueño NUNCA se le contesta como cliente');

hook.olvidaTodo(); tk.olvidaTodo();
{
  /* Sin saber a quién le habla, el bot NO puede quedarse callado: se
     lo dice. Un mensaje del dueño que no llega a nadie, y nadie avisa,
     es una venta perdida en silencio. */
  const r = corre(aviso(DUENO, 'hola'));
  okQue('contesta una sola cosa', r.envios.length === 1);
  okQue('y es para el dueño', r.envios[0].para === DUENO);
  okQue('diciéndole que no supo para quién',
    /No supe para quién es/.test(r.envios[0].texto));
  /* Lo que NO puede pasar: que el bot le salude como a un cliente. */
  okQue('y NO le contesta el saludo de cliente',
    !/a dónde va el plan/i.test(r.envios[0].texto));
}

/* ============================================================ */
titulo('su respuesta llega al cliente, tal cual');

hook.olvidaTodo(); tk.olvidaTodo();
{
  /* Camino 1: respondió el ticket. Meta manda el id del citado. */
  tk.recuerdaTicket('ticket-1', CLIENTE);
  const r = corre(aviso(DUENO, 'Te sale en 46,500 el viaje redondo',
    { context: { id: 'ticket-1' } }));
  okQue('se manda un mensaje', r.envios.length === 1);
  ok('  al CLIENTE, no al dueño', r.envios[0].para, CLIENTE);
  /* TAL CUAL. Si el dueño escribió eso, eso quiso decir. */
  ok('  con sus palabras sin adornar', r.envios[0].texto,
    'Te sale en 46,500 el viaje redondo');
}

hook.olvidaTodo(); tk.olvidaTodo();
{
  /* Camino 2: sin ticket en memoria. Empieza su mensaje con el número,
     que el ticket le dejó escrito. Esto es lo que funciona aunque Vercel
     haya reciclado la instancia: la ficha del cliente la siembra el
     almacén (cargaLoQueSeSabe carga la del número tecleado). Aquí se
     siembra a mano, como lo haría el almacén. */
  tk.anotaEtapa(CLIENTE, 'visto', {}, Date.now());
  const r = corre(aviso(DUENO, CLIENTE + ': quedamos en 46,500'));
  ok('sin ticket en memoria, el número del mensaje basta', r.envios[0].para, CLIENTE);
  ok('  y el número no se le reenvía al cliente', r.envios[0].texto,
    'quedamos en 46,500');
}

hook.olvidaTodo(); tk.olvidaTodo();
{
  /* Auditoría general del 8-sep, hallazgo 7: un «total N» que no cuadra se
     le devuelve al dueño; nunca le llega literal al cliente. */
  tk.anotaEtapa(CLIENTE, 'visto', {}, Date.now());
  const r = corre(aviso(DUENO, CLIENTE + ' total 48000'));
  ok('«total 48000» sin precio dado: el aviso va al dueño', r.envios[0].para, DUENO);
  okQue('  diciendo que no lo pudo aplicar', /No pude actualizar el total/.test(r.envios[0].texto));
  okQue('  y al cliente no le llegó «total 48000»', !r.envios.some(function (e) { return e.para === CLIENTE; }));
  tk.anotaEtapa(CLIENTE, 'con_precio', { total: 40000, anticipo: 8000 }, Date.now());
  const r2 = corre(aviso(DUENO, CLIENTE + ' total 999'));
  okQue('«total 999» (bajo el mínimo): al dueño, no al cliente', r2.envios[0].para === DUENO && !r2.envios.some(function (e) { return e.para === CLIENTE; }));
}

hook.olvidaTodo(); tk.olvidaTodo();
{
  /* Auditoría general del 8-sep, hallazgo 11: con el almacén caído, el
     candado del número desconocido no frena al dueño; se manda y se avisa. */
  hook.marcaLecturaFallida('5213399998889');
  const r = corre(aviso(DUENO, '5213399998889: te confirmo tu fecha'));
  okQue('con la lectura del almacén fallida, el mensaje SÍ se manda al cliente',
    r.envios.some(function (e) { return e.para === '5213399998889' && e.texto === 'te confirmo tu fecha'; }));
  okQue('  y al dueño se le dice que no se pudo comprobar', r.envios.some(function (e) { return e.para === DUENO && /No pude comprobar/.test(e.texto); }));
}

hook.olvidaTodo(); tk.olvidaTodo();
{
  /* Auditoría general del 8-sep, hallazgo 10: un aviso que el almacén ya
     vio desde otra instancia no se contesta. */
  const r = corre(aviso(CLIENTE, 'hola', { id: 'wamid.repetido-1' }), { repetidos: new Set(['wamid.repetido-1']) });
  ok('un id ya visto en el almacén no produce ningún envío', r.envios.length, 0);
  const r2 = corre(aviso(CLIENTE, 'hola', { id: 'wamid.nuevo-1' }), { repetidos: new Set(['wamid.repetido-1']) });
  okQue('  y uno nuevo sí se contesta', r2.envios.length >= 1);
}

hook.olvidaTodo(); tk.olvidaTodo();
{
  /* Auditoría 7-sep-2026, hallazgo 6: un dedazo en el número mandaba el
     viaje y el precio de un cliente a un desconocido. A un número que
     nunca ha hablado con el bot (ni ficha ni charla) no se le manda nada:
     se le avisa al dueño. Esta aserción cambió de lado a propósito:
     antes «sin memoria, el número basta»; ahora el número basta si el
     cliente existe. */
  const r = corre(aviso(DUENO, '5213399998889: quedamos en 46,500'));
  ok('a un número desconocido NO se le manda nada: el aviso va al dueño', r.envios[0].para, DUENO);
  okQue('  diciéndole que no conoce ese número', /No conozco el número/.test(r.envios[0].texto));
  okQue('  y sin que el texto llegue a nadie más', r.envios.length === 1);
}

/* ============================================================ */
titulo('y desde ahí la IA se calla con ese cliente');

hook.olvidaTodo(); tk.olvidaTodo();
{
  tk.recuerdaTicket('ticket-2', CLIENTE);
  corre(aviso(DUENO, 'son 46,500', { context: { id: 'ticket-2' } }));

  /* El cliente escribe otra vez. El bot NO contesta: si contestara,
     el cliente vería dos voces distintas en el mismo chat y ahí se
     acaba la ilusión de que habla con una persona. */
  const r = corre(aviso(CLIENTE, 'va, cómo le hago para pagar'));
  ok('el bot ya no le contesta a ese cliente', r.envios.length, 0);

  /* Pero a OTRO cliente sí, obviamente. */
  /* Le contesta a él, y aparte le avisa al dueño que es un número nuevo
     (9-sep-2026): dos envíos, uno para cada quien. */
  const otro = corre(aviso('5213377776666', 'hola'));
  okQue('a otro cliente sí le sigue contestando',
    otro.envios.filter(function (e) { return e.para !== DUENO; }).length === 1);
}

titulo('el silencio se acaba solo');

/* Se calla por un rato, no para siempre: si el dueño contestó y se fue,
   alguien tiene que seguir atendiendo. */
tk.olvidaTodo();
tk.callaLaIA(CLIENTE, Date.now() - (tk.CALLADO_MS + 1000));
okQue('pasadas las dos horas, la IA vuelve a hablar', !tk.iaCallada(CLIENTE));
tk.callaLaIA(CLIENTE, Date.now());
okQue('pero antes de eso, no', tk.iaCallada(CLIENTE));

/* ============================================================ */
titulo('el ticket SE MANDA de verdad, en una conversación completa');

/* Las pruebas de arriba comprueban que `armaTicket` arma bien. Ésta
   comprueba lo otro, que es lo que de verdad importa: que en una
   conversación de verdad, con un autobús —que el bot no puede cotizar
   solo— el ticket SALGA hacia el dueño.

   Sin esto, todo lo anterior podría estar perfecto y no mandarse nunca. */
hook.olvidaTodo(); tk.olvidaTodo();
{
  /* «Irizar i6S» es un paso NUEVO, del 3-sep-2026: ahora el cliente
     escoge CUÁL autobús. Antes el viaje llegaba hasta el ticket como
     «autobús» a secas y quien lo recibía no sabía si armar el de 51 o
     el de 47 — tenía que volver a preguntárselo al cliente, que es
     justo lo que el ticket existe para evitar. */
  const pasos = ['somos 45', 'Puerto Vallarta', '10 de septiembre',
    '13 de septiembre', 'Irizar i6S', 'Guadalajara', '2 dias',
    'Por la zona', 'Todo el día', 'si'];
  let ultimos = [];
  pasos.forEach(function (m) {
    ultimos = corre(aviso(CLIENTE, m)).envios;
  });

  const alCliente = ultimos.filter(function (e) { return e.para === CLIENTE; });
  const alDueno = ultimos.filter(function (e) { return e.para === DUENO && !esElPrimero(e); });

  okQue('al cliente le llega su respuesta', alCliente.length === 1);
  okQue('y al dueño le llega SU ticket', alDueno.length === 1);

  const t = alDueno[0];
  okQue('  marcado como ticket', t.esTicket === true);
  okQue('  sabiendo de qué cliente es', t.sobreCliente === CLIENTE);
  okQue('  con el destino', /Puerto Vallarta/.test(t.texto));
  okQue('  con los 45', /45 pasajeros/.test(t.texto));
  okQue('  con los movimientos', /2 días con movimiento/.test(t.texto));
  /* CAMBIÓ DE LADO EL 10-sep-2026. Decía «y SIN precio» —`!/\$/`— y con eso
     daba por bueno que el ticket de un camión llegara pelón. Lo que esa
     aserción cuidaba de verdad era que el bot NO se inventara un número, y
     eso sigue igual de cuidado: lo que ahora aparece sale de la lista del
     dueño (`api/_destinos.js`, las siete columnas de su Excel), se anuncia
     como «Del Excel» y nombra la columna. Un precio calculado por el motor
     ahí seguiría estando mal, y por eso se comprueba que no lo haya.

     Dictado del dueño ese día: «que reconozca... para que el usuario pueda
     determinar el precio él». El número es una referencia suya, no una
     cotización del bot. */
  okQue('  sin precio calculado por el motor', !/Calculado:/.test(t.texto));
  okQue('  y si trae un número, es del Excel y con su columna',
    !/\$/.test(t.texto) || (/Del Excel/.test(t.texto) && /columna «/.test(t.texto)));

  /* Y al cliente NO se le dice que se mandó ningún ticket: por dentro
     se avisa al equipo, por fuera se lee como si el mismo vendedor
     siguiera escribiendo. */
  /* «te paso con Fulano» sigue prohibido; «en breve te paso tu cotización»
     es el texto que dictó el dueño el 7-sep-2026 y sí vale. */
  okQue('al cliente no se le anuncia nada',
    !/ticket|vendedor|te paso con|33\s?2400/i.test(alCliente[0].texto));
}

/* ============================================================ */
titulo('el comprobante de transferencia');

/* Desde el 3-sep-2026 el cobro es por TRANSFERENCIA, no por Stripe. Eso
   cambia qué es una foto: casi siempre es **el comprobante del depósito**,
   o sea el pago.

   Antes de esto pasaban dos cosas, y las dos mal:
     · Al cliente que acababa de pagarle se le contestaba «¿a dónde van,
       qué día y cuántos son?», como si empezara de cero.
     · La foto no le llegaba a nadie. El dinero entraba y nadie se
       enteraba — justo lo que el webhook de Stripe existía para evitar. */
hook.olvidaTodo(); tk.olvidaTodo();
{
  const cuerpo = JSON.stringify({
    entry: [{ changes: [{ value: {
      metadata: { phone_number_id: '111' },
      messages: [{ id: 'foto1', from: CLIENTE, type: 'image',
        image: { id: 'img-777', mime_type: 'image/jpeg' } }]
    } }] }]
  });
  const r = corre(cuerpo);
  const alCliente = r.envios.filter(function (e) { return e.para === CLIENTE; });
  const alDueno = r.envios.filter(function (e) { return e.para === DUENO && !esElPrimero(e); });

  okQue('al cliente se le acusa recibo', alCliente.length === 1);
  okQue('  sin volver a preguntarle desde cero',
    !/a dónde van/i.test(alCliente[0].texto));

  /* Y LO QUE NO PUEDE PASAR NUNCA: dar el pago por bueno. Un comprobante
     se ve, se cotejan los dígitos y se revisa el banco. Eso lo hace una
     persona, no el bot. */
  okQue('  y SIN dar el pago por bueno',
    !/recibido tu pago|pago confirmado|ya quedó pagado|listo, pagado/i.test(alCliente[0].texto));
  okQue('  se dice la verdad: que se va a revisar',
    /revisarlo|revisar/i.test(alCliente[0].texto));

  okQue('al dueño le llega el reenvío', alDueno.length === 1);
  ok('  con la foto de verdad, por su id', alDueno[0].reenviaMedio, 'img-777');
  okQue('  y sabiendo de quién es', alDueno[0].texto.indexOf(CLIENTE) !== -1);
}

titulo('el que pide una persona antes de decir a dónde va');

/* Aquí se pagó dos veces el mismo error, en direcciones opuestas.

   Primero salía un ticket con «? → ?» y «? días»: ruido, y el ruido
   entrena al dueño a ignorar los tickets.

   Al quitarlo se fue de largo y se dejó de avisar **también** de éste
   — el que escribe «quiero hablar con alguien» antes de decir nada—,
   que es la señal de compra más clara que hay. El cliente pedía una
   persona y del otro lado no se enteraba nadie.

   Lo correcto es avisar, pero con dos renglones en vez del formato de
   viaje relleno de interrogaciones. */
hook.olvidaTodo(); tk.olvidaTodo();
{
  const r = corre(aviso(CLIENTE, 'quiero hablar con alguien'));
  const alDueno = r.envios.filter(function (e) { return e.para === DUENO && !esElPrimero(e); });

  ok('al dueño sí le llega el aviso', alDueno.length, 1);
  okQue('  diciéndole qué escribió el cliente',
    /quiero hablar con alguien/.test(alDueno[0].texto));
  okQue('  y de qué número', alDueno[0].texto.indexOf(CLIENTE) !== -1);
  okQue('  pero SIN el formato de viaje vacío',
    !/\? → \?|\? días/.test(alDueno[0].texto));
  /* Tiene que poder contestarlo, igual que un ticket: si no, el dueño
     ve el aviso y no tiene por dónde responderle al cliente. */
  okQue('  y se puede contestar', alDueno[0].esTicket === true);
  ok('  sobre el cliente correcto', alDueno[0].sobreCliente, CLIENTE);
}

titulo('pero un aviso por persona, no uno por mensaje');

/* Quien escribe «hola», «hola?», «buenas» mandaría tres avisos, y tres
   avisos por una sola persona vuelven a entrenar al dueño a ignorarlos
   — que es exactamente lo que se acababa de arreglar. */
hook.olvidaTodo(); tk.olvidaTodo();
{
  let cuantos = 0;
  for (let i = 0; i < 5; i++) {
    const r = corre(aviso(CLIENTE, 'quiero hablar con alguien'));
    cuantos += r.envios.filter(function (e) { return e.para === DUENO && !esElPrimero(e); }).length;
  }
  ok('cinco mensajes iguales, un solo aviso', cuantos, 1);
}

/* Y la foto NO lleva aviso encima: ya se reenvía entera. Dos mensajes
   por un comprobante es ruido otra vez. */
hook.olvidaTodo(); tk.olvidaTodo();
{
  const cuerpo = JSON.stringify({
    entry: [{ changes: [{ value: {
      metadata: { phone_number_id: '111' },
      messages: [{ id: 'foto2', from: CLIENTE, type: 'image', image: { id: 'img-9' } }]
    } }] }]
  });
  const alDueno = corre(cuerpo).envios.filter(function (e) { return e.para === DUENO && !esElPrimero(e); });
  ok('por una foto le llega UNA cosa, no dos', alDueno.length, 1);
  ok('  y es la foto', alDueno[0].reenviaMedio, 'img-9');
}

titulo('y ya no se mandan tickets vacíos');

/* Antes el ticket salía con cualquier `pasa`, aunque no hubiera nada que
   cotizar: llegaba con «? → ?» y «? días». Eso es ruido, y el ruido
   entrena al dueño a ignorar los tickets — que es peor que no mandarlos. */
hook.olvidaTodo(); tk.olvidaTodo();
{
  const r = corre(aviso(CLIENTE, 'holaaaa xyzq'));
  const alDueno = r.envios.filter(function (e) { return e.para === DUENO && !esElPrimero(e); });
  ok('sin viaje que cotizar, no hay ticket', alDueno.length, 0);
  /* Y ninguno de los que sí salen puede traer huecos. */
  const conHuecos = r.envios.filter(function (e) { return /\? → \?|\? días/.test(e.texto); });
  ok('ni un solo hueco en lo que sale', conHuecos, []);
}

/* ============================================================ */
titulo('el recordatorio a las 15 horas');

/* «si pasan más de 15 horas, ella me vuelve a escribir a mí».
   Quince y no más está bien elegido: la ventana de Meta son 24, y
   pasadas ésas ya no se le puede escribir sin plantilla aprobada. */
ok('el plazo es de 15 horas', tk.RECUERDA_A_LAS_MS, 15 * 60 * 60 * 1000);

tk.olvidaTodo();
{
  const ahora = Date.now();
  tk.anotaPendiente(CLIENTE, '🎫 Vallarta, 4 días', ahora);

  ok('recién puesto NO se recuerda', tk.recordatoriosPendientes(ahora).length, 0);
  ok('a las 14 horas tampoco',
    tk.recordatoriosPendientes(ahora + 14 * 3600000).length, 0);

  const r = tk.recordatoriosPendientes(ahora + 16 * 3600000);
  ok('a las 16 sí', r.length, 1);
  okQue('  y dice cuántas horas lleva', /16 horas/.test(r[0].texto));
  okQue('  repitiendo el viaje, para no hacerlo buscar',
    /Vallarta/.test(r[0].texto));

  /* Y SOLO UNA VEZ. Si se recordara en cada mensaje que entra, el
     dueño recibiría el mismo aviso veinte veces en una tarde. */
  ok('no se repite en la siguiente vuelta',
    tk.recordatoriosPendientes(ahora + 17 * 3600000).length, 0);
}

tk.olvidaTodo();
{
  /* Y si ya lo contestó, deja de estar pendiente aunque pasen las horas. */
  const ahora = Date.now();
  tk.anotaPendiente(CLIENTE, 'algo', ahora);
  tk.yaLoContesto(CLIENTE);
  ok('lo que ya contestó no se recuerda',
    tk.recordatoriosPendientes(ahora + 20 * 3600000).length, 0);
}

titulo('y el recordatorio sale de verdad por el webhook');

hook.olvidaTodo(); tk.olvidaTodo();
{
  /* Se anota un pendiente viejo y entra CUALQUIER mensaje. El
     recordatorio va colgado del tráfico porque en serverless nadie
     despierta a las 15 horas. */
  tk.anotaPendiente(CLIENTE, '🎫 Vallarta, 4 días', Date.now() - 16 * 3600000);
  const r = corre(aviso('5213377776666', 'hola'));
  const alDueno = r.envios.filter(function (e) { return e.para === DUENO && !esElPrimero(e); });
  okQue('al dueño le llega el recordatorio', alDueno.length === 1);
  okQue('  y se le nota que es recordatorio', /Llevas \*16 horas\*/.test(alDueno[0].texto));
}

/* ============================================================ */
titulo('sin dueño configurado, todo sigue como antes');

hook.olvidaTodo(); tk.olvidaTodo();
{
  const r = corre(aviso(CLIENTE, 'somos 45 a vallarta'), { DUENO_WHATSAPP: '' });
  okQue('el bot le contesta al cliente igual', r.envios.length >= 1);
  okQue('y no se manda ningún ticket',
    r.envios.every(function (e) { return !e.esTicket; }));
}

/* ============================================================ */
console.log('\n' + buenas + ' buenas, ' + malas + ' malas');
process.exit(malas ? 1 : 0);
