/* Que el bot de WhatsApp conteste bien y, sobre todo, que NO diga
   cosas que no debe. Corre sin red y sin Meta. */

const crypto = require('crypto');
const conv = require('../bot');
const hook = require('../api/_whatsapp-webhook');

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
  const r = conv.respuestaA('cuanto cuesta para 45 personas');
  okQue('con 45 personas NO manda al cotizador', !/\/#\/cotizar/.test(r.texto));
  ok('  y SI pasa con una persona', r.pasa, true);
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

console.log('\n== COTIZAR LA SPRINTER, PASO A PASO ==');
{
  const HOY = '2026-08-31';
  let e = null, r;
  const dichos = [];
  ['somos 15 personas', 'Chapala', 'Guadalajara', '10 de septiembre', '12 de septiembre']
    .forEach(function (m) { r = conv.respuestaA(m, e, HOY); e = r.estado; dichos.push(r); });

  ok('al final pide cotizar', !!r.cotiza, true);
  ok('  con la unidad correcta', r.cotiza && r.cotiza.unidad, 'sprinter');
  ok('  con las fechas en aaaa-mm-dd',
    r.cotiza && [r.cotiza.salida, r.cotiza.regreso], ['2026-09-10', '2026-09-12']);
  ok('  con origen y destino como los escribio el cliente',
    r.cotiza && [r.cotiza.origen.direccion, r.cotiza.destino.direccion],
    ['Guadalajara', 'Chapala']);
  ok('  y NINGUN precio: eso lo dice /api/cotizar, no el bot',
    dichos.some(function (d) { return /\$\s*[\d,]+/.test(d.texto); }), false);
}
{
  const HOY = '2026-08-31';
  let e = { paso: 'regreso', destino: 'Chapala', origen: 'GDL', salida: '2026-09-10' };
  const r = conv.respuestaA('5 de septiembre', e, HOY);
  okQue('no deja regresar antes de salir', !r.cotiza && /antes de la salida/.test(r.texto));
}
{
  const r = conv.respuestaA('el jueves ese', { paso: 'salida' }, '2026-08-31');
  okQue('una fecha que no entiende la vuelve a pedir, no la inventa',
    !r.cotiza && /no entendi la fecha/i.test(conv.normaliza(r.texto)));
}
{
  const r = conv.respuestaA('cancelar', { paso: 'destino' }, '2026-08-31');
  ok('se puede cancelar a media cotizacion', r.estado, null);
}
{
  /* A media cotizacion, «Chapala» es el destino — no un saludo fallido. */
  const r = conv.respuestaA('Chapala', { paso: 'destino' }, '2026-08-31');
  ok('a media cotizacion, lo que escribe es la RESPUESTA, no un tema nuevo',
    r.estado && r.estado.destino, 'Chapala');
}

console.log('\n== EL PRECIO QUE DEVUELVE /api/cotizar ==');
{
  const resumen = { destino: 'Chapala', origen: 'Guadalajara',
    salida: '2026-09-10', regreso: '2026-09-12' };
  const r = conv.textoDeCotizacion(
    { total: 9000, anticipo: 1800, saldo: 7200, dias: 3, requiereAsesor: false }, resumen);
  okQue('enseña el total tal cual vino', /\$9,000/.test(r.texto));
  okQue('  y el anticipo', /\$1,800/.test(r.texto));
  okQue('  y repite QUE se cotizo', /Chapala/.test(r.texto) && /septiembre/.test(r.texto));
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
