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
  const r = conv.respuestaA('cuanto cuesta para 15 personas');
  okQue('con 15 personas (Sprinter) manda al cotizador en linea', /\/#\/cotizar/.test(r.texto));
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
