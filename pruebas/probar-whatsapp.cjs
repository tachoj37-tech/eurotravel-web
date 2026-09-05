/* Que el bot de WhatsApp conteste bien y, sobre todo, que NO diga
   cosas que no debe. Corre sin red y sin Meta. */

const crypto = require('crypto');
const conv = require('../bot');
const hook = require('../api/_whatsapp-webhook');
const ia = require('../api/_entender');

/* El dia se fija a proposito: si se preguntara al reloj, las pruebas de
   fechas cambiarian de resultado en año nuevo. */
const HOY = '2026-08-31';

/* Las comprobaciones de la IA son asincronas. Se juntan aqui y se
   esperan ANTES de contar: sin esto el archivo terminaria antes de que
   corrieran, y saldrian en verde sin haber probado nada. */
const pendientes = [];

const SECRETO = 'secreto-de-prueba';
const TOKEN = 'token-de-alta';
const ENV = { WHATSAPP_APP_SECRET: SECRETO, WHATSAPP_VERIFY_TOKEN: TOKEN };

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

function firma(cuerpo) {
  return 'sha256=' + crypto.createHmac('sha256', SECRETO)
    .update(Buffer.from(cuerpo, 'utf8')).digest('hex');
}

/* Un aviso de Meta como los de verdad. */
let n = 0;
function aviso(texto, opciones) {
  const o = opciones || {};
  n++;
  return JSON.stringify({
    object: 'whatsapp_business_account',
    entry: [{
      id: '123',
      changes: [{
        field: 'messages',
        value: {
          messaging_product: 'whatsapp',
          metadata: { display_phone_number: '523321832993', phone_number_id: 'PID1' },
          messages: [{
            from: o.de || '5213311112222',
            id: o.id || ('wamid.' + n),
            timestamp: '1',
            type: o.tipo || 'text',
            text: o.tipo && o.tipo !== 'text' ? undefined : { body: texto }
          }]
        }
      }]
    }]
  });
}

function corre(texto, opciones) {
  const cuerpo = aviso(texto, opciones);
  return hook.procesa(cuerpo, firma(cuerpo), ENV);
}

console.log('\n== EL ALTA DEL WEBHOOK (GET) ==');
{
  const r = hook.verificaSuscripcion(
    { 'hub.mode': 'subscribe', 'hub.verify_token': TOKEN, 'hub.challenge': 'abc123' }, ENV);
  ok('con el token bueno devuelve el challenge tal cual', [r.status, r.cuerpo], [200, 'abc123']);
}
{
  const r = hook.verificaSuscripcion(
    { 'hub.mode': 'subscribe', 'hub.verify_token': 'otro', 'hub.challenge': 'abc' }, ENV);
  ok('con token malo, 403', r.status, 403);
}
{
  const r = hook.verificaSuscripcion(
    { 'hub.mode': 'subscribe', 'hub.verify_token': TOKEN, 'hub.challenge': 'a' }, {});
  ok('SIN la variable configurada falla CERRADA, no abierta', r.status, 503);
}

console.log('\n== LA FIRMA ==');
{
  const cuerpo = aviso('hola');
  ok('firma buena pasa', hook.procesa(cuerpo, firma(cuerpo), ENV).status, 200);
}
{
  const cuerpo = aviso('hola');
  ok('firma de otro secreto NO pasa',
    hook.procesa(cuerpo, 'sha256=' + crypto.createHmac('sha256', 'malo')
      .update(cuerpo).digest('hex'), ENV).status, 401);
}
{
  const cuerpo = aviso('hola');
  ok('sin cabecera de firma NO pasa', hook.procesa(cuerpo, null, ENV).status, 401);
}
{
  const cuerpo = aviso('hola');
  ok('un cuerpo cambiado invalida la firma',
    hook.procesa(cuerpo.replace('hola', 'holx'), firma(cuerpo), ENV).status, 401);
}
{
  const cuerpo = aviso('hola');
  ok('sin secreto configurado falla CERRADA', hook.procesa(cuerpo, firma(cuerpo), {}).status, 503);
}
{
  const cuerpo = aviso('hola');
  ok('firma buena pero sin contestar nada cuando el cuerpo no es JSON',
    hook.procesa('no soy json', 'sha256=' + crypto.createHmac('sha256', SECRETO)
      .update('no soy json').digest('hex'), ENV).envios.length, 0);
}

console.log('\n== NO CONTESTAR DOS VECES ==');
hook.olvidaTodo();
{
  const cuerpo = aviso('hola', { id: 'wamid.repetido' });
  const a = hook.procesa(cuerpo, firma(cuerpo), ENV);
  const b = hook.procesa(cuerpo, firma(cuerpo), ENV);
  ok('el primer aviso contesta', a.envios.length, 1);
  ok('el reintento de Meta NO vuelve a contestar', b.envios.length, 0);
}

console.log('\n== LOS ACUSES NO SON MENSAJES ==');
hook.olvidaTodo();
{
  const cuerpo = JSON.stringify({
    entry: [{ changes: [{ value: { statuses: [{ id: 'x', status: 'delivered' }] } }] }]
  });
  const r = hook.procesa(cuerpo, firma(cuerpo), ENV);
  ok('un acuse de «entregado» no provoca respuesta', [r.status, r.envios.length], [200, 0]);
}

console.log('\n== EL FRENO ==');
hook.olvidaTodo();
{
  let contestados = 0;
  for (let i = 0; i < 20; i++) {
    if (corre('hola', { id: 'w' + i, de: '5213300000000' }).envios.length) contestados++;
  }
  ok('un mismo numero no puede disparar sin fin', contestados, hook.TOPE_POR_MINUTO);
}
hook.olvidaTodo();
{
  /* Que a uno lo frenen no puede dejar mudo al de al lado. */
  for (let i = 0; i < 20; i++) corre('hola', { id: 'a' + i, de: '5213300000001' });
  const otro = corre('hola', { id: 'zz', de: '5213399999999' });
  okQue('frenar a uno NO silencia a los demas', otro.envios.length === 1);
}

console.log('\n== LO QUE CONTESTA ==');
hook.olvidaTodo();
okQue('saluda con el menu', /Eurotravel/.test(conv.respuestaA('hola').texto));
okQue('lista las unidades', /Sprinter/.test(conv.respuestaA('que unidades tienen').texto));
okQue('reconoce una unidad por su nombre',
  /Suburban/.test(conv.respuestaA('me interesa la suburban').texto));
okQue('con 45 personas propone un autobus, no la Sprinter',
  !/Sprinter/.test(conv.respuestaA('somos 45 personas').texto));
okQue('con 8 personas NO propone la Suburban de 6',
  !/Suburban/.test(conv.respuestaA('somos 8 personas').texto));
okQue('con mas gente que la unidad mas grande, avisa que son varias',
  /mas de una unidad/i.test(conv.normaliza(conv.respuestaA('somos 200 personas').texto)));

console.log('\n== EL PRECIO: LO MAS DELICADO ==');
{
  /* CAMBIO DE LADO — 31-ago-2026.
     Antes esto exigia que el bot mandara la liga /#/cotizar. Ya no:
     el dueño pidio que el bot COTICE la Sprinter el mismo, sin sacar
     al cliente de la conversacion. Mandarlo a otra pantalla era
     perder al que ya estaba escribiendo.
     Lo que se revisa ahora es que ARRANQUE el paso a paso, y sigue
     revisandose que no necesite persona: la Sprinter se cotiza sola. */
  const r = conv.respuestaA('cuanto cuesta para 15 personas');
  ok('con 15 personas (Sprinter) arranca la cotizacion aqui mismo',
    r.estado && r.estado.paso, 'destino');
  ok('  y NO necesita persona', r.pasa, false);
}
{
  /* CAMBIO DE LADO — 31-ago-2026.
     Antes con 45 personas el bot mandaba con una persona de inmediato.
     El dueño pidio lo contrario: que le junte TODOS los datos primero,
     «para que el empleado nomas vea y saque el precio en chinga».
     Asi que ahora NO pasa de golpe (pasa: false): arranca a preguntar,
     y pasa al final, ya con la solicitud armada. Eso se revisa abajo,
     en la seccion de la solicitud. */
  const r = conv.respuestaA('cuanto cuesta para 45 personas', null, HOY);
  okQue('con 45 personas NO cotiza en linea', !r.cotiza);
  ok('  y en vez de despacharlo, empieza a juntar los datos',
    r.estado && r.estado.unidad, 'autobus');
}
{
  const r = conv.respuestaA('quiero hablar con una persona, cuanto cuesta');
  ok('pedir persona gana sobre preguntar precio', r.pasa, true);
}
{
  const r = conv.respuestaA('asdkjhasd kjahsd');
  ok('lo que no entiende NO lo adivina: pasa con persona', r.pasa, true);
}

console.log('\n== LAS FECHAS, COMO LAS ESCRIBE LA GENTE ==');
{
  /* El dia se fija a proposito: si se preguntara al reloj, estas
     pruebas cambiarian de resultado en año nuevo. */
  const HOY = '2026-08-31';
  const casos = [
    ['10 de septiembre', '2026-09-10'], ['10 sept', '2026-09-10'],
    ['10/9', '2026-09-10'], ['10-09-2026', '2026-09-10'],
    ['hoy', '2026-08-31'], ['manana', '2026-09-01'],
    ['el 15', '2026-09-15'],
    /* Sin año, una fecha ya pasada se entiende del año que viene:
       nadie cotiza un viaje para atras. */
    ['1 de enero', '2027-01-01'],
    /* 2026 no es bisiesto, asi que esa fecha no existe. */
    ['29 de febrero', null],
    ['32/13', null], ['el jueves ese', null], ['', null]
  ];
  const mal = casos.filter(function (c) { return conv.fechaDe(c[0], HOY) !== c[1]; })
    .map(function (c) { return c[0] + ' -> ' + conv.fechaDe(c[0], HOY) + ' (esperaba ' + c[1] + ')'; });
  ok('lee la fecha escrita de 12 formas distintas', mal, []);
}

/* Corre una conversacion entera y devuelve el ultimo turno mas todo lo
   que se dijo, para poder revisar el camino y no solo el final. */
function conversa(guion) {
  let e = null, r = null;
  const turnos = [];
  guion.forEach(function (m) {
    r = conv.respuestaA(m, e, HOY);
    e = r.estado;
    turnos.push(r);
  });
  return { ultimo: r, turnos: turnos };
}

console.log('\n== «QUIERO UNA SPRINTER» TIENE QUE COTIZAR ==');
{
  /* Esto lo reporto el dueño: decia «quiero una Sprinter» y el bot le
     contestaba QUE INCLUYE, sin ofrecerle precio. Quien nombra la
     unidad que quiere ya decidio; lo que sigue es el precio. */
  const r = conv.respuestaA('quiero una sprinter', null, HOY);
  ok('nombrar la Sprinter arranca la cotizacion', r.estado && r.estado.paso, 'destino');
  okQue('  y pregunta a donde van', /a donde van/i.test(conv.normaliza(r.texto)));
}
{
  const r = conv.respuestaA('quiero cotizar', null, HOY);
  /* ORDEN NUEVO (2-sep-2026): contesta con el destino, no con cuantos son. */
  okQue('«quiero cotizar» no se queda callado',
    /a donde va el plan/i.test(conv.normaliza(r.texto)));
}

console.log('\n== COTIZAR LA SPRINTER, PASO A PASO ==');
{
  const c = conversa(['quiero una sprinter', 'Chapala',
    /* ORDEN NUEVO (2-sep-2026, §2 del guion): destino, fechas, y hasta
       despues «de donde salen». Antes el origen iba en tercer lugar. */
    '10 de septiembre', '13 de septiembre', 'Guadalajara',
    /* «Por la zona» se agregó el 1-sep-2026: desde R40 se pregunta por cada
       recorrido si pasa de los 80 km, y ese paso va antes de las horas. */
    '2 dias', 'Por la zona',
    'Hasta 10 horas', 'si']);
  const r = c.ultimo;

  ok('al final pide cotizar', !!r.cotiza, true);
  ok('  con la unidad correcta', r.cotiza && r.cotiza.unidad, 'sprinter');
  ok('  con las fechas en aaaa-mm-dd',
    r.cotiza && [r.cotiza.salida, r.cotiza.regreso], ['2026-09-10', '2026-09-13']);
  ok('  con origen y destino como los escribio el cliente',
    r.cotiza && [r.cotiza.origen.direccion, r.cotiza.destino.direccion],
    ['Guadalajara', 'Chapala']);
  ok('  con los DOS dias de recorrido que pidio', r.cotiza && r.cotiza.movimientos.length, 2);
  ok('  y con las horas que escogio (10 h = termina a las 18:00)',
    r.cotiza && r.cotiza.movimientos[0].horaFin, '18:00');
  ok('  y NINGUN precio en todo el camino: eso lo dice /api/cotizar',
    c.turnos.some(function (d) { return /\$\s*[\d,]+/.test(d.texto); }), false);
}
{
  /* Antes de cotizar tiene que enseñar QUE entendio. */
  const c = conversa(['sprinter', 'Chapala', '10/9', '13/9', 'Guadalajara', 'ninguno']);
  const t = c.ultimo.texto;
  okQue('confirma antes de cotizar', /confirmar/i.test(t));
  okQue('  repitiendo el destino', /Chapala/.test(t));
  okQue('  y las fechas', /septiembre/.test(t));
  ok('  con boton de si y de cambiar', c.ultimo.opciones, ['Sí, cotizar', 'Cambiar algo']);
}

console.log('\n== R22: EL VIAJE DE UN DIA NO PAGA MOVIMIENTOS ==');
{
  const c = conversa(['sprinter', 'Tequila', '10 de septiembre', '10 de septiembre',
    'Guadalajara']);
  okQue('con salida y regreso el mismo dia NO pregunta recorridos',
    /confirmar/i.test(c.ultimo.texto));
  const fin = conversa(['sprinter', 'Tequila', '10 de septiembre', '10 de septiembre',
    'Guadalajara', 'si']).ultimo;
  ok('  y cotiza sin movimientos', fin.cotiza && fin.cotiza.movimientos.length, 0);
}

console.log('\n== NO SE DEJA LLEVAR A UN IMPOSIBLE ==');
{
  const r = conv.respuestaA('5 de septiembre',
    { paso: 'regreso', destino: 'Chapala', origen: 'GDL', salida: '2026-09-10' }, HOY);
  okQue('no deja regresar antes de salir', !r.cotiza && /antes de la salida/.test(r.texto));
}
{
  const r = conv.respuestaA('el jueves ese', { paso: 'salida' }, HOY);
  /* CAMBIÓ EL 5-SEP-2026: ya no se busca «no la entendí» —el bot dejó
     de confesar—. Lo que se vigila es lo mismo de siempre: que NO
     invente la fecha (sin `cotiza`, sin `salida`), que vuelva a pedirla,
     y —nuevo— que le pase la bola a la IA con `noEntendio`. */
  okQue('una fecha que no entiende la vuelve a pedir, no la inventa',
    !r.cotiza && !(r.estado && r.estado.salida) && /fecha|d[ií]a/i.test(r.texto));
  okQue('  y avisa que la IA puede intentarlo', r.noEntendio === true);
}
{
  const r = conv.respuestaA('9 dias',
    { paso: 'recorridos', destino: 'X', origen: 'Y', salida: '2026-09-10', regreso: '2026-09-12' }, HOY);
  okQue('no acepta mas dias de recorrido que dias de viaje',
    !r.estado.recorridos && /no pueden ser mas/i.test(conv.normaliza(r.texto)));
}

console.log('\n== SE PUEDE CORREGIR SIN EMPEZAR DE CERO ==');
{
  const c = conversa(['sprinter', 'Chapala', '10/9', '13/9', 'Guadalajara', 'ninguno',
    'cambiar algo', 'el destino', 'Mazamitla', 'si']);
  ok('cambiar el destino conserva las fechas',
    c.ultimo.cotiza && [c.ultimo.cotiza.destino.direccion, c.ultimo.cotiza.salida],
    ['Mazamitla', '2026-09-10']);
}
{
  const r = conv.respuestaA('cancelar', { paso: 'destino' }, HOY);
  ok('se puede cancelar a media cotizacion', r.estado, null);
}
{
  /* A media cotizacion, «Chapala» es el destino — no un saludo fallido. */
  const r = conv.respuestaA('Chapala', { paso: 'destino' }, HOY);
  ok('a media cotizacion, lo que escribe es la RESPUESTA, no un tema nuevo',
    r.estado && r.estado.destino, 'Chapala');
}

console.log('\n== LO QUE PREGUNTA TIENE QUE CABER EN WHATSAPP ==');
{
  /* WhatsApp permite 3 botones de 20 caracteres, o una lista de 10
     filas de 24. Si una pregunta no cabe ahi, funciona en la pagina y
     se rompe el dia que se conecte con Meta — y eso no se notaria
     hasta tener un cliente enfrente. */
  const estados = [
    { paso: 'destino' }, { paso: 'origen' }, { paso: 'origenLibre' },
    { paso: 'salida' }, { paso: 'regreso' },
    { paso: 'recorridos', salida: '2026-09-10', regreso: '2026-09-20' },
    { paso: 'horas' },
    { paso: 'confirmar', destino: 'Chapala', origen: 'Guadalajara',
      salida: '2026-09-10', regreso: '2026-09-13', recorridos: 2, banda: 1 },
    { paso: 'cambiar' }
  ];
  const culpables = [];
  estados.forEach(function (e) {
    const p = conv.pregunta(e);
    if (!p) { culpables.push(e.paso + ': no contesta nada'); return; }
    const ops = p.opciones || [];
    if (ops.length > 10) culpables.push(e.paso + ': ' + ops.length + ' opciones, el tope es 10');
    const limite = ops.length <= 3 ? 20 : 24;
    ops.forEach(function (o) {
      if (o.length > limite) {
        culpables.push(e.paso + ': «' + o + '» mide ' + o.length + ', el tope es ' + limite);
      }
    });
  });
  ok('ninguna opcion se pasa de los topes de WhatsApp', culpables, []);
}
{
  /* La lista de recorridos crece con los dias del viaje. Que no se
     pase de 10 filas en un viaje largo. */
  const p = conv.pregunta({ paso: 'recorridos', salida: '2026-09-01', regreso: '2026-12-01' });
  okQue('en un viaje larguisimo la lista sigue cabiendo', p.opciones.length <= 10);
}
{
  const dias = [['2026-09-10', '2026-09-10', 1], ['2026-09-12', '2026-09-12', 1],
    ['2026-09-10', '2026-09-12', 3], ['2026-12-30', '2027-01-02', 4]];
  const mal = dias.filter(function (d) { return conv.diasEntre(d[0], d[1]) !== d[2]; });
  ok('los dias se cuentan con los dos extremos, y cruzando el año', mal, []);
}

console.log('\n== QUE UNIDAD LE OFRECE A CADA GRUPO ==');
{
  /* Pedido por el dueño el 31-ago-2026 despues de probarlo: con 21
     personas el bot le saltaba a un autobus sin preguntarle nada. */
  const r = conv.respuestaA('somos 21 personas', null, HOY);
  okQue('con 21 NO salta al autobus: pregunta si se acomodan en 20',
    /poquito arriba/i.test(conv.normaliza(r.texto)));
  ok('  con boton para cada respuesta', r.opciones, ['Sí, somos 20', 'Somos 21']);
}
{
  const r = conv.respuestaA('somos 21 personas', null, HOY);
  const si = conv.respuestaA('Sí, somos 20', r.estado, HOY);
  ok('si aceptan ser 20, cotiza la Sprinter', si.estado && si.estado.unidad, 'sprinter');
  const no = conv.respuestaA('Somos 21', r.estado, HOY);
  ok('si insisten en 21, se va por autobus', no.estado && no.estado.unidad, 'autobus');
}
{
  /* Tambien pedido: con grupo chico hay DOS unidades, no una. */
  const r = conv.respuestaA('somos 4 personas', null, HOY);
  okQue('con 4 ofrece la Sprinter Y la Suburban',
    /Sprinter/.test(r.texto) && /Suburban/.test(r.texto));
  okQue('  y dice que la Suburban es la premium',
    /premium|ejecutivo/i.test(conv.normaliza(r.texto)));
  ok('  con boton para cada una', r.opciones, ['La Sprinter', 'La Suburban']);
}
{
  const r = conv.respuestaA('somos 4 personas', null, HOY);
  const sub = conv.respuestaA('La Suburban', r.estado, HOY);
  ok('escoger la Suburban NO cotiza en linea', sub.estado && sub.estado.unidad, 'suburban');
  const spr = conv.respuestaA('La Sprinter', r.estado, HOY);
  ok('escoger la Sprinter si', spr.estado && spr.estado.unidad, 'sprinter');
}
{
  const mal = [];
  [[3, 'elegirChica'], [6, 'elegirChica'], [7, 'destino'], [18, 'destino'],
   [20, 'destino'], [21, 'ajustar'], [24, 'ajustar'], [25, 'destino'], [60, 'destino']]
    .forEach(function (c) {
      const r = conv.respuestaA('somos ' + c[0] + ' personas', null, HOY);
      const paso = r.estado && r.estado.paso;
      if (paso !== c[1]) mal.push(c[0] + ' personas -> ' + paso + ' (esperaba ' + c[1] + ')');
    });
  ok('cada tamaño de grupo va por donde debe', mal, []);
}

console.log('\n== «MAS DE 20» NO ES UN NUMERO ==');
{
  /* Lo reporto el dueño: tocaba «Somos más de 20» y el bot le contestaba
     como si fueran 21 —«andan por poquito arriba»—, que a un grupo de 60
     le suena absurdo. No es un numero, es la AUSENCIA de uno. */
  const r = conv.respuestaA('Somos más de 20', null, HOY);
  ok('pregunta cuantos son en vez de suponer', r.estado && r.estado.paso, 'cuantos');
  okQue('  y NO le habla de estar por poquito arriba',
    !/poquito arriba/i.test(conv.normaliza(r.texto)));
}
{
  const mal = ['somos mas de 20', 'somos mas de 40', 'arriba de 30', '50 o mas',
    'somos muchos', 'somos bastantes']
    .filter(function (m) {
      const r = conv.respuestaA(m, null, HOY);
      return !r.estado || r.estado.paso !== 'cuantos';
    });
  ok('seis formas de decir «muchos» acaban preguntando el numero', mal, []);
}
{
  const r = conv.respuestaA('Somos más de 20', null, HOY);
  const con38 = conv.respuestaA('somos 38', r.estado, HOY);
  ok('y al dar el numero, recomienda con ese numero',
    con38.estado && con38.estado.gente, 38);
  okQue('  el autobus, no la Sprinter', /autobus/i.test(conv.normaliza(con38.texto)));
}
{
  /* Que no se atore si vuelve a contestar vago. */
  const r = conv.respuestaA('Somos más de 20', null, HOY);
  const vago = conv.respuestaA('pues varios', r.estado, HOY);
  ok('si vuelve a contestar vago sigue en la misma casilla',
    vago.estado && vago.estado.paso, 'cuantos');
  okQue('  pero lo pregunta DISTINTO, no repite palabra por palabra',
    vago.texto !== r.texto);
  const bien = conv.respuestaA('40', vago.estado, HOY);
  ok('  y con el numero ya avanza', bien.estado && bien.estado.gente, 40);
}

console.log('\n== ACUSA RECIBO ANTES DE PREGUNTAR LO SIGUIENTE ==');
{
  /* En una conversacion de verdad uno repite lo que oyo antes de seguir.
     Sin eso el bot se siente un formulario que no escucha — y ademas el
     cliente no se entera de que entendio mal hasta el final. */
  const pares = [
    [{ paso: 'destino', unidad: 'sprinter' }, 'Mazamitla', /mazamitla/],
    [{ paso: 'origen', unidad: 'sprinter', destino: 'X' }, 'Zapopan', /zapopan/],
    [{ paso: 'salida', unidad: 'sprinter', destino: 'X', origen: 'Y' }, '15 de octubre', /15 de octubre/],
    [{ paso: 'regreso', unidad: 'sprinter', destino: 'X', origen: 'Y', salida: '2026-10-15' },
      '18 de octubre', /4 dias/],
    [{ paso: 'recorridos', unidad: 'sprinter', destino: 'X', origen: 'Y',
      salida: '2026-10-15', regreso: '2026-10-18' }, '2 dias', /2 dias de paseo/]
  ];
  const mudos = pares.filter(function (p) {
    return !p[2].test(conv.normaliza(conv.respuestaA(p[1], p[0], HOY).texto));
  }).map(function (p) { return p[0].paso; });
  ok('cada respuesta se repite antes de seguir', mudos, []);
}

console.log('\n== LA SOLICITUD PARA QUIEN PONE EL PRECIO ==');
{
  /* «Sacame toda la info para que el empleado nomas vea y saque el
     precio en chinga» — el dueño, 31-ago-2026. */
  /* «Irizar i6S» es un paso NUEVO, del 3-sep-2026. Antes el viaje se iba
     hasta el final como «autobús» a secas, y el dueño lo cachó:

       «no me dijo ni cuál unidad es, necesita seleccionar una unidad,
        no se puede quedar como autobús 50 personas»

     Hay cuatro autobuses y no son el mismo —el i6S lleva 51 y el i6
     lleva 47—, así que «autobús» ni siquiera dice si caben. Ahora el
     cliente escoge, y por eso la conversación trae un paso más. */
  const c = conversa(['somos 45 personas', 'Puerto Vallarta',
    '12 de diciembre', '16 de diciembre', 'Irizar i6S', 'Guadalajara',
    '2 dias', 'Por la zona', 'Todo el día', 'si']);
  const r = c.ultimo;
  ok('al final entrega una solicitud armada', !!r.solicitud, true);
  ok('  y AHI si pasa con una persona', r.pasa, true);
  const falta = ['45', 'Puerto Vallarta', 'Guadalajara', 'diciembre', '5 días', '2 días']
    .filter(function (d) { return r.texto.indexOf(d) === -1; });
  ok('  con TODO lo que necesita quien cotiza', falta, []);
  okQue('  y sin ningun precio: eso lo pone la persona (R12)',
    !/\$\s*[\d,]+/.test(r.texto));
  ok('  el resumen guarda la unidad', r.solicitud.unidad, 'autobus');
  /* Y CUÁL autobús. Sin esto, quien recibe la solicitud tiene que
     volver a preguntárselo al cliente — que es justo lo que esta
     solicitud existe para evitar. */
  okQue('  y dice CUÁL, no solo «autobús»', /Irizar i6S/.test(r.texto));
}
{
  /* Nombrar una unidad que no se cotiza sola tampoco puede acabar en
     la ficha y ya: hay que juntarle los datos igual. */
  const r = conv.respuestaA('quiero una suburban', null, HOY);
  ok('nombrar la Suburban tambien junta los datos',
    r.estado && [r.estado.paso, r.estado.unidad], ['destino', 'suburban']);
}

console.log('\n== EL IVA NO SE NOMBRA, PERO SE COBRA IGUAL ==');
{
  /* Este es de dinero, asi que se revisa con varios numeros y no con
     uno. Si algun dia alguien vuelve a «quitarle el IVA», esto lo caza:
     el precio del chat tiene que ser IDENTICO al de la pagina. */
  const casos = [9000, 20500, 12400, 66000, 3500];
  const mal = [];
  casos.forEach(function (total) {
    const t = conv.textoDeCotizacion(
      { total: total, anticipo: Math.round(total * 0.2), saldo: total - Math.round(total * 0.2),
        dias: 3, porcentajeAnticipo: 20 }, {}).texto;
    if (t.indexOf('$' + total.toLocaleString('es-MX')) === -1) {
      mal.push(total + ': no enseña el precio del motor');
    }
    const bajado = Math.round(total / 1.16);
    if (t.indexOf('$' + bajado.toLocaleString('es-MX')) !== -1) {
      mal.push(total + ': lo bajo a ' + bajado + ', que seria cobrar de menos');
    }
    if (/iva/i.test(conv.normaliza(t))) mal.push(total + ': menciona el IVA');
  });
  ok('el precio del chat es el MISMO que el de la pagina, en 5 montos', mal, []);
}
{
  const t = conv.textoDeCotizacion(
    { total: 9000, anticipo: 1800, saldo: 7200, dias: 3, porcentajeAnticipo: 20 }, {}).texto;
  okQue('el anticipo y el saldo suman el total', (function () {
    const n = t.match(/\$([\d,]+)/g).map(function (s) { return Number(s.replace(/[$,]/g, '')); });
    return n[0] === n[1] + n[2];
  })());
}

console.log('\n== ESCRIBIR MAL NO PUEDE COSTAR UNA VENTA ==');
{
  /* La gente escribe desde el celular con el pulgar. Esto NO usa IA:
     es fonetica (kiero=quiero), abreviatura (spter=sprinter) y
     distancia. El ejemplo del dueño era «lla kiero uan spter». */
  /* Se busca sobre el texto NORMALIZADO —sin acentos y en minusculas—
     asi que los patrones van tambien en minusculas. Buscar «Sprinter»
     con mayuscula aqui no casa nunca, y esa fue la primera version de
     esta prueba: fallaba por la prueba, no por el bot. */
  const casos = [
    ['lla kiero uan spter', /sprinter/],
    ['kiero una sprnter', /sprinter/],
    ['me interesa la suburvan', /suburban/],
    /* ORDEN NUEVO (2-sep-2026): preguntar el precio ya no se contesta con
       «¿cuantas personas?» sino con «¿a donde va el plan?». El destino es
       lo unico que el cliente ya tiene decidido, y es lo que revela la
       ocasion. Lo que esta prueba cuida sigue igual: que lo entienda
       aunque venga mal escrito. */
    ['cuanto kuesta', /a donde va el plan/],
    ['presio', /a donde va el plan/],
    ['ke unidades tienen', /unidades/],
    ['ke incluye', /incluyen/],
    /* El texto cambio el 2-sep-2026: el bot ya no ANUNCIA que pasa con
       alguien —decision del dueño, el cliente no tiene por que enterarse—.
       Lo que se prueba sigue siendo lo mismo: que entienda la peticion
       aunque venga mal escrita. Por eso se busca el telefono, que es lo
       que de verdad se le da. */
    ['ablar con una persona', /marcame o escribeme/],
    ['kiero cotisar', /cuantas personas/]
  ];
  const mal = casos.filter(function (c) {
    return !c[1].test(conv.normaliza(conv.respuestaA(c[0], null, HOY).texto));
  }).map(function (c) { return c[0]; });
  ok('entiende 9 formas de escribirlo mal', mal, []);
}
{
  const fechas = [['4 sep', '2026-09-04'], ['10 setiembre', '2026-09-10'],
    ['10 de septienbre', '2026-09-10'], ['15 disiembre', '2026-12-15'],
    ['3 de nobiembre', '2026-11-03'],
    /* Un mes que no existe NO se adivina: mejor volver a preguntar
       que mandar al cliente en la fecha equivocada. */
    ['10 de xyz', null], ['10 de zzzzz', null]];
  const mal = fechas.filter(function (f) { return conv.fechaDe(f[0], HOY) !== f[1]; })
    .map(function (f) { return f[0] + ' -> ' + conv.fechaDe(f[0], HOY); });
  ok('lee la fecha aunque el mes venga mal escrito', mal, []);
}
{
  /* EL RIESGO DE TOLERAR FALTAS: pasarse de listo.
     «somos 15 personaz» acababa en «te paso con una persona», porque
     «personaz» esta a un cambio de «persona». Es la MISMA confusion
     que ya se habia arreglado con limites de palabra, y la tolerancia
     la revivio. Por eso hay palabras que se comparan exactas. */
  const r = conv.respuestaA('somos 15 personaz', null, HOY);
  ok('«personaz» sigue siendo cuantas personas son, no pedir una persona',
    r.pasa, false);
  okQue('  y recomienda unidad', /Sprinter/.test(r.texto));
}
{
  /* Y que el candado no haya matado lo que si debe pasar con alguien. */
  const mal = ['quiero hablar con una persona', 'ablar con alguien', 'kiero un asesor']
    .filter(function (m) { return !conv.respuestaA(m, null, HOY).pasa; });
  ok('pedir una persona sigue funcionando, bien y mal escrito', mal, []);
}

console.log('\n== LA IA: SOLO CUANDO EL BOT SE RINDIO ==');
{
  /* Lo caro de un bot con IA es llamarla de mas. Aqui se revisa lo
     contrario de lo normal: que la MAYORIA de los mensajes NO la
     necesiten. */
  const gratis = ['hola', 'cuanto cuesta', 'somos 15', 'lla kiero uan spter 4 sep ida',
    'que unidades tienen', 'ke incluye', 'quiero hablar con alguien',
    'q onda, para 12 chavos a tequila', 'gracias'];
  const caros = gratis.filter(function (m) {
    return conv.respuestaA(m, null, HOY).noEntendio;
  });
  ok('lo que ya sabe contestar NO gasta una llamada', caros, []);
  okQue('y lo que de plano no entiende SI la pide',
    conv.respuestaA('xq no me contestan', null, HOY).noEntendio === true);
}
{
  /* Que la IA falte o falle NO puede tumbar el bot. */
  const sinClave = ia.entiende('lo que sea', { clave: '', hoy: HOY });
  pendientes.push(sinClave.then(function (r) {
    ok('sin clave configurada devuelve null, no truena', r, null); }));
}
{
  const rota = ia.entiende('hola', {
    clave: 'x', hoy: HOY,
    pide: function () { return Promise.resolve({ ok: false, status: 500 }); }
  });
  pendientes.push(rota.then(function (r) {
    ok('si la IA contesta error, devuelve null', r, null); }));
  const tronada = ia.entiende('hola', {
    clave: 'x', hoy: HOY,
    pide: function () { return Promise.reject(new Error('sin red')); }
  });
  pendientes.push(tronada.then(function (r) {
    ok('si la IA se cae, devuelve null', r, null); }));
}
{
  /* El modelo a veces envuelve el JSON. */
  ok('saca el JSON aunque venga envuelto',
    ia.sacaJSON('Claro:\n```json\n{"intencion":"cotizar"}\n```'), { intencion: 'cotizar' });
  ok('y devuelve null si no hay JSON', ia.sacaJSON('no se'), null);
}
{
  /* NADA de lo que devuelva la IA se cree sin revisar. */
  const sucio = ia.limpia({
    intencion: 'borrar_la_base', gente: 999999, unidad: 'helicoptero',
    destino: 'x', origen: '   ', salida: 'el jueves', regreso: '2020-01-01',
    soloIda: 'quiza'
  });
  ok('una intencion inventada se vuelve «otro»', sucio.intencion, 'otro');
  ok('un numero absurdo de gente se tira', sucio.gente, null);
  ok('una unidad que no existe se tira', sucio.unidad, null);
  ok('una fecha que no es fecha se tira', sucio.salida, null);
  ok('un texto de una letra se tira', sucio.destino, null);
  ok('soloIda solo es true si es exactamente true', sucio.soloIda, false);
}
{
  const alReves = ia.limpia({ salida: '2026-09-10', regreso: '2026-09-05' });
  ok('un regreso anterior a la salida se tira: preguntar es barato', alReves.regreso, null);
}
{
  /* Con una IA de mentiras se comprueba el camino completo. */
  const falsa = function (respuesta) {
    return function () {
      return Promise.resolve({
        ok: true, status: 200,
        json: function () {
          return Promise.resolve({ content: [{ type: 'text', text: JSON.stringify(respuesta) }] });
        }
      });
    };
  };
  pendientes.push(ia.entiende('lla kiero uan spter 4 sep ida', {
    clave: 'x', hoy: HOY,
    pide: falsa({ intencion: 'cotizar', unidad: 'sprinter', salida: '2026-09-04', soloIda: true })
  }).then(function (d) {
    ok('lee el mensaje enredado', [d.unidad, d.salida, d.soloIda],
      ['sprinter', '2026-09-04', true]);
    const r = conv.aplicaEntendido(d, HOY);
    okQue('  y el bot sigue desde ahi', r && r.estado && r.estado.unidad === 'sprinter');
    okQue('  repitiendo lo que entendio, para poder corregirlo',
      /creo que entendi/i.test(conv.normaliza(r.texto)));
    okQue('  sin soltar ningun precio', !/\$\s*[\d,]+/.test(r.texto));
    ok('  y solo ida se cotiza como salir y volver el mismo dia',
      r.estado.regreso, '2026-09-04');
  }));
}
{
  /* Las intenciones que ya tienen respuesta escrita NO se improvisan. */
  /* Mismo cambio del 2-sep-2026: la respuesta de «persona» ya no dice que
     pasa con nadie, pero sigue siendo LA MISMA para esa intencion, que es
     lo que esta prueba cuida. */
  const mal = [['persona', /marcame o escribeme/], ['unidades', /unidades/],
    ['incluye', /incluyen/],
    /* El saludo dejo de ser un menu con «bienvenido» y paso a una sola
       pregunta abierta (§2 del guion). El 3-sep-2026 cambio otra vez
       —el dueño: «el saludo esta de la chingada»— y ahora dice quien es
       y que renta antes de preguntar. Lo que esta prueba cuida no
       cambia: que la intencion «saludo» use LA MISMA respuesta escrita
       y no una improvisada por la IA. */
    ['saludo', /a donde van/]]
    .filter(function (c) {
      const r = conv.aplicaEntendido({ intencion: c[0] }, HOY);
      return !r || !c[1].test(conv.normaliza(r.texto));
    }).map(function (c) { return c[0]; });
  ok('una intencion conocida usa la respuesta de siempre, no una nueva', mal, []);
}
{
  ok('si la IA no saco nada util, el bot se queda como estaba',
    conv.aplicaEntendido({ intencion: 'otro' }, HOY), null);
  ok('  y con null tampoco truena', conv.aplicaEntendido(null, HOY), null);
}

console.log('\n== LOS PASEOS CON NOMBRE ==');
{
  /* El bot tiene su propia tabla de paseos porque el navegador no puede
     leer `api/`. Un espejo se despega solo: si allá se agrega uno y aquí
     no, el bot deja de ofrecerlo y NADIE SE ENTERA. Esto lo caza. */
  const tarifa = require('../api/_tarifa');
  const enElMotor = {
    'Ciudad de México': Object.keys(tarifa.PASEOS_CDMX || {}),
    'Huasteca Potosina': ['el meco', 'el naranjo']
  };
  const mal = [];
  Object.keys(enElMotor).forEach(function (destino) {
    const ofrece = (conv.respuestaA('x', { paso: 'paseo', destino: destino }, HOY).opciones || [])
      .filter(function (o) { return o !== 'Ninguno'; })
      .map(function (o) { return conv.normaliza(o); });
    enElMotor[destino].forEach(function (p) {
      if (ofrece.indexOf(conv.normaliza(p)) === -1) {
        mal.push(destino + ': el motor cobra «' + p + '» y el bot no lo ofrece');
      }
    });
    ofrece.forEach(function (o) {
      if (enElMotor[destino].map(function (p) { return conv.normaliza(p); }).indexOf(o) === -1) {
        mal.push(destino + ': el bot ofrece «' + o + '» y el motor no lo cobra');
      }
    });
  });
  ok('las dos tablas de paseos coinciden', mal, []);
}
{
  const r = conv.respuestaA('x', { paso: 'recorridos', destino: 'Ciudad de México',
    origen: 'GDL', salida: '2026-10-10', regreso: '2026-10-13' }, HOY);
  ok('en un destino SIN paseos no se pregunta por ellos',
    conv.respuestaA('2 dias', { paso: 'recorridos', destino: 'Chapala', origen: 'GDL',
      salida: '2026-10-10', regreso: '2026-10-13' }, HOY).estado.paso, 'lejos');
  ok('  y en CDMX sí',
    conv.respuestaA('2 dias', { paso: 'recorridos', destino: 'Ciudad de México',
      origen: 'GDL', salida: '2026-10-10', regreso: '2026-10-13' }, HOY).estado.paso, 'paseo');
}
{
  const c = conversa(['sprinter', 'Ciudad de México', '10 de octubre', '13 de octubre',
    'Guadalajara', '3 dias', 'Taxco', 'Nos vamos lejos', 'Hasta 8 horas', 'si']);
  const m = c.ultimo.cotiza.movimientos;
  ok('el paseo va en UN día, el primero', m.filter(function (x) { return x.paseo; }).length, 1);
  ok('  y es el que escogió', m[0].paseo, 'Taxco');
  ok('los km solo se mandan si dijo que se van lejos',
    m.every(function (x) { return x.km === 120; }), true);
}
{
  const c = conversa(['sprinter', 'Ciudad de México', '10 de octubre', '13 de octubre',
    'Guadalajara', '3 dias', 'ninguno', 'Por la zona', 'Hasta 8 horas', 'si']);
  const m = c.ultimo.cotiza.movimientos;
  ok('sin paseo no se manda ninguno', m.some(function (x) { return x.paseo; }), false);
  /* Si no dijo que se van lejos NO se inventa un kilometraje: sin `km` el
     motor cobra la banda de horas de siempre. */
  ok('  y sin «lejos» no se inventan km', m.some(function (x) { return x.km; }), false);
}
{
  /* El paseo se enseña ANTES de cotizar: es lo que más mueve el precio. */
  const r = conv.respuestaA('Hasta 8 horas', { paso: 'horas', destino: 'Ciudad de México',
    origen: 'GDL', salida: '2026-10-10', regreso: '2026-10-13', recorridos: 3,
    paseo: 'Taxco' }, HOY);
  okQue('el resumen de confirmación dice el paseo', /taxco/i.test(r.texto));
}

console.log('\n== EL BOT ENTIENDE SUS PROPIOS BOTONES ==');
{
  /* Ofrecer un boton que el bot no sabe leer es la peor forma de
     romperlo: el cliente toca lo que le ofreciste y el bot le repite
     la misma pregunta, para siempre. Ya paso al probar con Playwright
     con las opciones de cuantas personas son.

     Aqui se le devuelve CADA opcion que ofrece y se exige que avance. */
  const base = { destino: 'Chapala', origen: 'Guadalajara',
    salida: '2026-09-10', regreso: '2026-09-15' };
  const estados = [
    { paso: 'origen' },
    Object.assign({ paso: 'recorridos' }, base),
    Object.assign({ paso: 'horas', recorridos: 2 }, base),
    Object.assign({ paso: 'confirmar', recorridos: 2, banda: 0 }, base),
    Object.assign({ paso: 'cambiar', recorridos: 2, banda: 0 }, base)
  ];
  const atorados = [];
  estados.forEach(function (e) {
    (conv.pregunta(e).opciones || []).forEach(function (o) {
      const r = conv.respuestaA(o, e, HOY);
      const avanzo = !!r.cotiza || (r.estado && r.estado.paso !== e.paso);
      if (!avanzo) atorados.push(e.paso + ' + «' + o + '» se queda atorado');
    });
  });
  ok('toda opcion que ofrece, la sabe leer', atorados, []);
}
{
  /* Las de «cuantas personas» no vienen de `pregunta`, pero es donde
     se atoro de verdad. */
  const r = conv.respuestaA('quiero cotizar', null, HOY);
  const atorados = (r.opciones || []).filter(function (o) {
    const s = conv.respuestaA(o, null, HOY);
    /* Tiene que reconocer el tamaño del grupo: o arranca la cotizacion
       (Sprinter) o pasa con una persona (autobus). Repetir la misma
       pregunta seria quedarse atorado. */
    return !s.estado && !s.pasa;
  });
  ok('tambien lee los botones de «cuantas personas»', atorados, []);
}

console.log('\n== EL PRECIO QUE DEVUELVE /api/cotizar ==');
{
  const resumen = { destino: 'Chapala', origen: 'Guadalajara',
    salida: '2026-09-10', regreso: '2026-09-12' };
  /* El IVA NO se menciona, pero SI se cobra. Aclarado por el dueño el
     31-ago-2026: «no quiero que no lo cobres, solo no lo menciones».
     Estuvo mal un rato —se le quitaba el 16%, o sea $1,241 menos por
     viaje en este ejemplo— y por eso queda vigilado por los dos lados:
     que el monto sea el del motor, y que la palabra no aparezca. */
  const r = conv.textoDeCotizacion(
    { total: 9000, anticipo: 1800, saldo: 7200, dias: 3, porcentajeAnticipo: 20,
      requiereAsesor: false }, resumen);
  okQue('enseña el total TAL CUAL vino del motor', /\$9,000/.test(r.texto));
  okQue('  con su anticipo y su saldo', /\$1,800/.test(r.texto) && /\$7,200/.test(r.texto));
  okQue('  y NO lo baja quitandole el IVA', !/\$7,759/.test(r.texto));
  okQue('  pero la palabra IVA no aparece', !/iva/i.test(conv.normaliza(r.texto)));
  okQue('  ni se habla de factura', !/factura/i.test(r.texto));
  okQue('  repite QUE se cotizo', /Chapala/.test(r.texto) && /septiembre/.test(r.texto));
  ok('  sin necesitar persona', r.pasa, false);
}
{
  const r = conv.textoDeCotizacion(null, {});
  ok('si /api/cotizar falla NO se inventa un precio: pasa con persona', r.pasa, true);
  okQue('  y no suelta ninguna cifra', !/\$\s*[\d,]+/.test(r.texto));
}
{
  const r = conv.textoDeCotizacion({ total: 90000, requiereAsesor: true }, {});
  ok('si el motor pide asesor, se respeta', r.pasa, true);
  okQue('  y NO se enseña ese total', !/\$\s*90/.test(r.texto));
}

console.log('\n== NUNCA DICE UN PRECIO (R12) ==');
{
  /* Se le tira de todo y se revisa que en NINGUNA respuesta salga una
     cifra de dinero. El bot no cotiza: manda a cotizar o pasa contigo. */
  const aVer = [
    'cuanto cuesta', 'precio de un camion a vallarta', 'cotizacion para 50 a cancun',
    'cuanto me sale la sprinter 3 dias', 'que tarifa manejan', 'presupuesto para 20',
    'cuanto vale ir a chapala', 'cuanto cobran por dia', 'dame precio',
    'somos 45 vamos a morelia cuanto', 'hola', 'que unidades tienen',
    'que incluye', 'gracias', 'necesito un autobus', 'somos 200 personas'
  ];
  const dinero = /\$\s*[\d,]+|\d[\d,]{2,}\s*(pesos|mxn)|\b\d{1,3},\d{3}\b/i;
  const culpables = [];
  aVer.forEach(function (p) {
    const t = conv.respuestaA(p).texto;
    if (dinero.test(t)) culpables.push(p + ' -> ' + t.slice(0, 80));
  });
  ok('en 16 formas de preguntar el precio, el bot no suelta NI UNA cifra',
    culpables, []);
}
{
  /* Y que el telefono, que SI lleva numeros, no se confunda con dinero. */
  okQue('el telefono si aparece cuando pasa con persona',
    conv.respuestaA('quiero hablar con alguien').texto.indexOf(conv.TELEFONO) !== -1);
}

console.log('\n== NO INVENTA DATOS ==');
{
  /* Las capacidades tienen que salir del catalogo, no de la cabeza. */
  const t = conv.respuestaA('que unidades tienen').texto;
  const faltan = conv.UNIDADES.filter(function (u) { return t.indexOf(u.name) === -1; });
  ok('las 6 unidades del catalogo aparecen', faltan.map(function (u) { return u.name; }), []);
  const malCap = conv.UNIDADES.filter(function (u) { return t.indexOf(u.cap) === -1; });
  ok('  con la capacidad EXACTA que dice el catalogo',
    malCap.map(function (u) { return u.name; }), []);
}

console.log('\n== MENSAJES QUE NO SON TEXTO ==');
hook.olvidaTodo();
{
  const r = corre('', { tipo: 'image', id: 'img1' });
  okQue('una foto no truena y se contesta con honestidad', r.envios.length === 1);
  okQue('  y esa si pasa con persona', r.envios[0].pasaAPersona === true);
}

console.log('\n== A META SIEMPRE 200 CUANDO LA FIRMA ES BUENA ==');
hook.olvidaTodo();
{
  const cuerpo = JSON.stringify({ entry: [] });
  ok('un aviso vacio se acepta (si no, Meta reintenta y apaga el webhook)',
    hook.procesa(cuerpo, firma(cuerpo), ENV).status, 200);
}

/* Se esperan las de la IA antes de contar. Sin esto el archivo
   terminaria antes de que corrieran y saldria en verde de mentiras. */

/* ============================================================
   EL CACHÉ DEL PROMPT Y EL COSTO POR LLAMADA · 5-sep-2026
   ------------------------------------------------------------
   Autorizado por el dueño como única excepción técnica. Lo que se
   vigila, en orden de qué tan caro sale si falla:

   1 · Que el bloque estático NO traiga la fecha ni nada del cliente.
       Una fecha adentro rompe el caché a medianoche para todos, y se
       paga escritura de caché (1.25×) cada día en vez de lectura (0.1×).
   2 · Que `cache_control` vaya SOLO en el bloque estático, y que el
       del día vaya después, fuera.
   3 · Que el catálogo que se le da a la IA no traiga kilómetros ni
       precios (R12: lo que no está en el contexto no se puede filtrar).
   4 · Que la cuenta de dinero cuadre con las tarifas oficiales.
   ============================================================ */
console.log('\n== EL CACHE DEL PROMPT Y EL COSTO ==');
{
  const capturadas = [];
  const conUso = function (respuesta, usage) {
    return function (url, opciones) {
      capturadas.push(JSON.parse(opciones.body));
      return Promise.resolve({
        ok: true, status: 200,
        json: function () {
          return Promise.resolve({
            content: [{ type: 'text', text: JSON.stringify(respuesta) }],
            usage: usage
          });
        }
      });
    };
  };
  const leido = { intencion: 'cotizar', destino: 'Chapala' };

  pendientes.push(ia.entiende('a chapala pues', {
    clave: 'x', hoy: HOY, cliente: '5213377778888',
    pide: conUso(leido, { input_tokens: 60, cache_creation_input_tokens: 1380,
      cache_read_input_tokens: 0, output_tokens: 90 })
  }).then(function () {
    const b = capturadas[0];
    okQue('el system va en bloques, no en un solo texto', Array.isArray(b.system) && b.system.length === 2);
    ok('el primer bloque lleva cache_control', b.system[0].cache_control, { type: 'ephemeral' });
    okQue('  y el segundo NO', !b.system[1].cache_control);
    okQue('la fecha NO va en el bloque cacheado', !/Hoy es/.test(b.system[0].text));
    okQue('  va en el del dia, despues', new RegExp('Hoy es ' + HOY).test(b.system[1].text));
    okQue('los ejemplos usan un año neutro (AAAA), no el de hoy',
      /AAAA-09-04/.test(b.system[0].text) && !new RegExp(HOY.slice(0, 4) + '-09-04').test(b.system[0].text));
    okQue('el catalogo de unidades va adentro', /UNIDADES QUE EXISTEN/.test(b.system[0].text));
    okQue('  y los nombres de destinos tambien', /DESTINOS DE LISTA/.test(b.system[0].text));
    const catalogo = b.system[0].text.split('UNIDADES QUE EXISTEN')[1] || '';
    okQue('  pero SIN kilometros ni precios', !/\bkm\b|\$|precio/i.test(catalogo));
    ok('el modelo sigue siendo Haiku 4.5', b.model, 'claude-haiku-4-5-20251001');
  }));

  /* Segunda llamada del mismo cliente: el costo se acumula por cliente. */
  pendientes.push(ia.entiende('y el 12 de octubre', {
    clave: 'x', hoy: HOY, cliente: '5213377778888',
    pide: conUso(leido, { input_tokens: 40, cache_creation_input_tokens: 0,
      cache_read_input_tokens: 1380, output_tokens: 80 })
  }).then(function () {
    const t = ia.costoDe('5213377778888');
    okQue('el costo se acumula por cliente', t && t.llamadas === 2);
    okQue('  y se ve cuanto se leyo de cache', t && t.lectura === 1380);
  }));

  /* La cuenta, con las tarifas oficiales: $1 entrada · $1.25 escritura ·
     $0.10 lectura · $5 salida, por millon. */
  const usd = ia.costoDeUso({ input_tokens: 60, cache_creation_input_tokens: 1380,
    cache_read_input_tokens: 0, output_tokens: 90 });
  ok('la primera llamada (escribe cache) cuesta lo que dice la tarifa',
    Number(usd.toFixed(6)), Number(((60 * 1 + 1380 * 1.25 + 90 * 5) / 1e6).toFixed(6)));
  const usd2 = ia.costoDeUso({ input_tokens: 40, cache_read_input_tokens: 1380, output_tokens: 80 });
  okQue('la segunda (lee cache) sale mas barata', usd2 < usd);

  /* Las instrucciones del contrato llegan como texto: un solo bloque, cacheado. */
  const c = ia.bloquesDelSistema('instrucciones del contrato', HOY);
  okQue('instrucciones ajenas en texto = un solo bloque con cache', c.length === 1 && !!c[0].cache_control);
}

Promise.all(pendientes).then(function () {
  console.log('\n' + buenas + ' buenas, ' + malas + ' malas  (' +
    pendientes.length + ' de ellas esperaron a la IA de mentiras)');
  process.exit(malas === 0 ? 0 : 1);
});
