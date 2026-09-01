/* Que el bot de WhatsApp conteste bien y, sobre todo, que NO diga
   cosas que no debe. Corre sin red y sin Meta. */

const crypto = require('crypto');
const conv = require('../bot');
const hook = require('../api/_whatsapp-webhook');

/* El dia se fija a proposito: si se preguntara al reloj, las pruebas de
   fechas cambiarian de resultado en año nuevo. */
const HOY = '2026-08-31';

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
  okQue('«quiero cotizar» no se queda callado',
    /cuantas personas/i.test(conv.normaliza(r.texto)));
}

console.log('\n== COTIZAR LA SPRINTER, PASO A PASO ==');
{
  const c = conversa(['quiero una sprinter', 'Chapala', 'Guadalajara',
    '10 de septiembre', '13 de septiembre', '2 dias', 'Hasta 10 horas', 'si']);
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
  const c = conversa(['sprinter', 'Chapala', 'Guadalajara', '10/9', '13/9', 'ninguno']);
  const t = c.ultimo.texto;
  okQue('confirma antes de cotizar', /confirmar/i.test(t));
  okQue('  repitiendo el destino', /Chapala/.test(t));
  okQue('  y las fechas', /septiembre/.test(t));
  ok('  con boton de si y de cambiar', c.ultimo.opciones, ['Sí, cotizar', 'Cambiar algo']);
}

console.log('\n== R22: EL VIAJE DE UN DIA NO PAGA MOVIMIENTOS ==');
{
  const c = conversa(['sprinter', 'Tequila', 'Guadalajara',
    '10 de septiembre', '10 de septiembre']);
  okQue('con salida y regreso el mismo dia NO pregunta recorridos',
    /confirmar/i.test(c.ultimo.texto));
  const fin = conversa(['sprinter', 'Tequila', 'Guadalajara',
    '10 de septiembre', '10 de septiembre', 'si']).ultimo;
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
  okQue('una fecha que no entiende la vuelve a pedir, no la inventa',
    !r.cotiza && /no la entendi/i.test(conv.normaliza(r.texto)));
}
{
  const r = conv.respuestaA('9 dias',
    { paso: 'recorridos', destino: 'X', origen: 'Y', salida: '2026-09-10', regreso: '2026-09-12' }, HOY);
  okQue('no acepta mas dias de recorrido que dias de viaje',
    !r.estado.recorridos && /no pueden ser mas/i.test(conv.normaliza(r.texto)));
}

console.log('\n== SE PUEDE CORREGIR SIN EMPEZAR DE CERO ==');
{
  const c = conversa(['sprinter', 'Chapala', 'Guadalajara', '10/9', '13/9', 'ninguno',
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

console.log('\n== LA SOLICITUD PARA QUIEN PONE EL PRECIO ==');
{
  /* «Sacame toda la info para que el empleado nomas vea y saque el
     precio en chinga» — el dueño, 31-ago-2026. */
  const c = conversa(['somos 45 personas', 'Puerto Vallarta', 'Guadalajara',
    '12 de diciembre', '16 de diciembre', '2 dias', 'Todo el día', 'si']);
  const r = c.ultimo;
  ok('al final entrega una solicitud armada', !!r.solicitud, true);
  ok('  y AHI si pasa con una persona', r.pasa, true);
  const falta = ['45', 'Puerto Vallarta', 'Guadalajara', 'diciembre', '5 días', '2 días']
    .filter(function (d) { return r.texto.indexOf(d) === -1; });
  ok('  con TODO lo que necesita quien cotiza', falta, []);
  okQue('  y sin ningun precio: eso lo pone la persona (R12)',
    !/\$\s*[\d,]+/.test(r.texto));
  ok('  el resumen guarda la unidad', r.solicitud.unidad, 'autobus');
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
    ['cuanto kuesta', /cuantas personas/],
    ['presio', /cuantas personas/],
    ['ke unidades tienen', /unidades/],
    ['ke incluye', /incluyen/],
    ['ablar con una persona', /paso con una persona/],
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

console.log('\n' + buenas + ' buenas, ' + malas + ' malas');
process.exit(malas === 0 ? 0 : 1);
