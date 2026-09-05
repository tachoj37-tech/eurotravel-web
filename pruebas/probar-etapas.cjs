/* ============================================================
   EN QUÉ VA CADA CLIENTE
   ------------------------------------------------------------
   El dueño lo pidió como etiquetas de WhatsApp Business: «ya
   preguntó precio», «ya se lo di», «ya mandó transferencia». No
   se pueden poner por API —la referencia de Meta para un número
   tiene un solo endpoint, `/messages`—, así que la etapa la
   lleva el bot, que de todos modos ya la sabía.

   Lo que se vigila aquí, en orden de qué tan caro sale si falla:

   1 · Que un cliente NUNCA aparezca en la ficha de otro. Es la
       misma regla que el dueño pidió que no pudiera romperse
       «ni por posibilidad».
   2 · Que la etapa no RETROCEDA. El que ya mandó dinero no
       puede volver a la lista de «apenas escribió» por saludar:
       ése es justo el que no se puede perder.
   3 · Que el aviso del comprobante traiga el viaje y el
       anticipo. «Cuando te mando la transferencia, ¿qué vas a
       hacer? No sabes todavía, entonces te vamos a buscar.»
   ============================================================ */

const crypto = require('crypto');
const etapas = require('../api/_etapas.js');
const tk = require('../api/_tickets.js');
const hook = require('../api/_whatsapp-webhook.js');

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
const ENV = {
  WHATSAPP_APP_SECRET: SECRETO,
  DUENO_WHATSAPP: DUENO,
  HOY_DE_PRUEBA: '2026-09-03'
};

let cuantos = 0;
function manda(de, msg) {
  cuantos++;
  const cuerpo = JSON.stringify({
    entry: [{ changes: [{ value: {
      metadata: { phone_number_id: '111' },
      messages: [Object.assign({ id: 'e' + cuantos, from: de }, msg)]
    } }] }]
  });
  const firma = 'sha256=' + crypto.createHmac('sha256', SECRETO)
    .update(Buffer.from(cuerpo, 'utf8')).digest('hex');
  return hook.procesa(Buffer.from(cuerpo, 'utf8'), firma, ENV);
}
function texto(de, t) { return manda(de, { type: 'text', text: { body: t } }); }

/* ============================================================ */
titulo('las etapas van en orden y solo avanzan');

/* Eran seis. Se volvieron ocho el 3-sep-2026, cuando el dueño pidió que
   el cliente no se quedara esperando en silencio mientras alguien revisa
   su depósito: las dos nuevas son juntar los datos del contrato y
   tenerlos completos. En el tablero piden cosas distintas de quien lo
   lee, así que son etapas y no un detalle de otra. */
ok('son ocho', etapas.ETAPAS.length, 8);
ok('y sus números van del 0 al 7',
  etapas.ETAPAS.map(function (e) { return e.n; }), [0, 1, 2, 3, 4, 5, 6, 7]);
ok('la última es el contrato listo',
  etapas.ETAPAS[etapas.ETAPAS.length - 1].id, 'contrato_listo');

ok('de «escribió» se avanza a «con precio»',
  etapas.avanza('escribio', 'con_precio'), 'con_precio');

/* ESTA ES LA IMPORTANTE. El que ya depositó y luego escribe «gracias»
   sigue siendo el que ya depositó. Sin esto, el tablero lo tiraría al
   fondo de la lista justo cuando más hay que atenderlo. */
ok('pero de «mandó comprobante» NO se retrocede',
  etapas.avanza('mando_comprobante', 'escribio'), 'mando_comprobante');
ok('ni a «armando el viaje»',
  etapas.avanza('mando_comprobante', 'cotizando'), 'mando_comprobante');

/* Y una etapa que ya no exista —porque alguien le cambió el nombre—
   no puede ganarle a una de verdad. */
ok('una etapa desconocida no le gana a ninguna',
  etapas.avanza('con_precio', 'inventada'), 'con_precio');
ok('y sin nada previo, se queda en la primera',
  etapas.avanza(null, 'inventada'), 'escribio');

/* ============================================================ */
titulo('la etapa se lee de lo que el bot decidió');

/* A propósito NO se vuelve a interpretar el texto del cliente: el bot
   es una máquina de estados y su estado es la verdad. Dos lecturas del
   mismo mensaje es una que un día no coincide con la otra. */
ok('una foto es un comprobante',
  etapas.deLaRespuesta({ texto: 'x' }, { type: 'image' }), 'mando_comprobante');
ok('un documento también',
  etapas.deLaRespuesta({ texto: 'x' }, { type: 'document' }), 'mando_comprobante');
ok('pedir precio es `cotiza`',
  etapas.deLaRespuesta({ texto: 'x', cotiza: {} }, { type: 'text' }), 'pidio_precio');
ok('un autobús —que no se cotiza solo— también falta de precio',
  etapas.deLaRespuesta({ texto: 'x', solicitud: {} }, { type: 'text' }), 'pidio_precio');
ok('un total es que ya tiene precio',
  etapas.deLaRespuesta({ texto: 'algo\n*Total: $9,500*\nmás' }, { type: 'text' }), 'con_precio');
/* Se lee de la BANDERA, no de la frase. Antes se buscaba «datos para el
   depósito» dentro del texto, y se rompió el día que esa frase se movió
   al webhook —los datos de la cuenta no pueden vivir en un archivo que
   corre en el navegador, donde cualquiera los lee—. La etapa dejó de
   detectarse y nada más se quejó. */
ok('y el cierre es que dijo que sí',
  etapas.deLaRespuesta({ texto: 'Va, te la aparto 🙌', pideDatosBancarios: true },
    { type: 'text' }), 'va_a_apartar');
/* Y no al revés: un texto que hable de depósitos sin la bandera NO es
   un cierre. Si lo fuera, cualquier mención movería la etapa. */
ok('  pero no cualquier mención de un depósito',
  etapas.deLaRespuesta({ texto: 'te paso los datos para el depósito' },
    { type: 'text' }), 'escribio');

/* ============================================================ */
titulo('la conversación entera, por el webhook');

hook.olvidaTodo(); tk.olvidaTodo();
{
  const C = '5213399995555';
  const pasos = [
    ['a chapala el 12 de septiembre somos 12, salimos de guadalajara', 'cotizando'],
    ['regresamos el 14', 'cotizando'],
    ['no vamos a pasear', 'cotizando'],
    ['sí está bien', 'pidio_precio'],
    ['sí apártamela', 'va_a_apartar']
  ];
  pasos.forEach(function (p) {
    texto(C, p[0]);
    ok('«' + p[0].slice(0, 34) + '» → ' + p[1], tk.fichaDe(C).etapa, p[1]);
  });

  manda(C, { type: 'image', image: { id: 'comp-1' } });
  ok('el comprobante lo pone hasta arriba', tk.fichaDe(C).etapa, 'mando_comprobante');

  texto(C, 'gracias');
  ok('y saludar después NO lo regresa', tk.fichaDe(C).etapa, 'mando_comprobante');

  okQue('la ficha guarda su viaje', /Chapala/.test(tk.fichaDe(C).viaje || ''));
}

/* ============================================================ */
titulo('el comprobante llega con el viaje, no suelto');

/* «Cuando te mando la transferencia, ¿qué vas a hacer? No sabes
   todavía, entonces te vamos a buscar.» Antes llegaba una foto y un
   número: había que ir a buscar de qué viaje era y cuánto tenía que
   traer. Ahora viene con las dos cosas. */
hook.olvidaTodo(); tk.olvidaTodo();
{
  const C = '5213399994444';
  tk.anotaEtapa(C, 'con_precio', {
    total: 9500, anticipo: 2000,
    viaje: '📍 Guadalajara → Tequila\n📅 5 de octubre de 2026'
  });

  const r = manda(C, { type: 'image', image: { id: 'comp-9' } });
  const alDueno = r.envios.filter(function (e) { return e.para === DUENO; });

  ok('llega UNA cosa, no dos', alDueno.length, 1);
  ok('  con la foto de verdad', alDueno[0].reenviaMedio, 'comp-9');
  okQue('  diciendo que es un comprobante', /comprobante/i.test(alDueno[0].texto));
  okQue('  de qué viaje era', /Tequila/.test(alDueno[0].texto));
  okQue('  cuánto tenía que traer', /\$2,000/.test(alDueno[0].texto));
  okQue('  y de qué número', alDueno[0].texto.indexOf(C) !== -1);

  /* Lo que NO puede decir: que el pago está bueno. Eso se coteja con
     el banco, y lo hace una persona. */
  const alCliente = r.envios.filter(function (e) { return e.para === C; });
  okQue('al cliente se le acusa recibo', alCliente.length === 1);
  okQue('  sin dar el pago por bueno',
    !/pago confirmado|recibí tu pago|ya quedó pagado/i.test(alCliente[0].texto));
}

/* ============================================================ */
titulo('qué se le contesta al que manda una foto');

/* Es el minuto de más nervios de toda la conversación: acaba de
   transferirle dinero a alguien que no conoce, por un viaje que
   todavía no existe. */
hook.olvidaTodo(); tk.olvidaTodo();
{
  const C = '5213377770001';
  tk.anotaEtapa(C, 'con_precio', { total: 9500, anticipo: 2000, viaje: '📍 GDL → Tequila' });
  const r = manda(C, { type: 'image', image: { id: 'c1' } });
  const t = r.envios.filter(function (e) { return e.para === C; })[0].texto;

  okQue('se le acusa recibo', /me lleg[oó]/i.test(t));

  /* CAMBIÓ EL 3-SEP-2026. Antes esta prueba exigía «lo verifico con el
     banco». El dueño corrigió el fondo:

       «mientras su pago se confirma, esto puede tardar algunas horas en
        lo que el equipo lo ve, preguntas los datos del contrato»

     O sea: no basta con decir que se está revisando. Hay que decir que
     TARDA —para que el cliente no escriba a los veinte minutos— y
     ponerle algo que hacer mientras, que además hace falta. */
  okQue('  se le avisa que TARDA, en vez de dejarlo esperando',
    /horas/i.test(t) && /revise|revisar|confirma/i.test(t));
  okQue('  y se le pone a hacer algo: su contrato', /contrato/i.test(t));
  okQue('  con un número de datos, no una lista sin fin', /son \d+ datos/i.test(t));

  /* LO QUE NO PUEDE DECIR NUNCA. Decirle «listo, pagado» y que el
     depósito no haya entrado es la peor mentira de este bot. */
  okQue('pero NO da el pago por bueno',
    !/pago (recibido|confirmado|acreditado)|ya qued[oó] pagado|listo,? pagado|tu pago entr/i.test(t));
  /* Ni pone una hora: eso la tiene que cumplir alguien más. */
  okQue('ni promete una hora',
    !/en \d+ minutos?|en \d+ horas?|en un momento te confirmo el pago/i.test(t));
}

/* CAMBIÓ EL 3-SEP-2026. Aquí se comprobaba que al que venía de
   `va_a_apartar` NO se le volviera a pedir el nombre, porque el bot ya
   se lo había preguntado en el cierre.

   Cambió de bando por un motivo real: el bot preguntaba «¿a qué nombre
   la aparto?» pero NUNCA GUARDABA la respuesta — la pregunta era del
   cierre y de ahí se pasaba a una persona. O sea que el dato no
   existía en ningún lado, y no volver a pedirlo significaba no tenerlo
   nunca.

   Ahora la lista del contrato es la que sí lo captura, y por eso lo
   pide siempre. Lo que se vigila en su lugar es que la pregunta valga
   para las dos cosas —el dueño lo cortó así: «1 y 3 es lo mismo»—: el
   contrato va a nombre de quien lo firma, no son dos datos. */
hook.olvidaTodo(); tk.olvidaTodo();
{
  const C = '5213377770002';
  tk.anotaEtapa(C, 'va_a_apartar', { total: 9500, anticipo: 2000 });
  const t = manda(C, { type: 'image', image: { id: 'c2' } })
    .envios.filter(function (e) { return e.para === C; })[0].texto;
  okQue('se le pide el nombre, que es el dato que nadie tenía', /nombre/i.test(t));
  okQue('  y en la misma pregunta, quién firma', /firma/i.test(t));
  okQue('  NO en dos preguntas distintas',
    (t.match(/nombre completo/gi) || []).length === 1);
}

/* El teléfono no se pide: está escribiendo desde él. Solo se pregunta
   si el bueno es otro — «dime si tu número es otro», dictado del
   dueño. Pedirle un dato que ya está en la pantalla es de las cosas
   que más rápido delatan que del otro lado no hay nadie. */
hook.olvidaTodo(); tk.olvidaTodo();
{
  const C = '5213377770004';
  tk.anotaEtapa(C, 'con_precio', { total: 9500 });
  const t = manda(C, { type: 'image', image: { id: 'c4' } })
    .envios.filter(function (e) { return e.para === C; })[0].texto;
  okQue('no se le exige un teléfono', /si el bueno es otro|si es otro/i.test(t));
}

/* Y a una agencia sí se le dice «el real, no mostrador» — que a una
   familia no le significa nada. */
hook.olvidaTodo(); tk.olvidaTodo();
{
  const C = '5213377770005';
  tk.anotaEtapa(C, 'con_precio', { total: 9500, agencia: true });
  const t = manda(C, { type: 'image', image: { id: 'c5' } })
    .envios.filter(function (e) { return e.para === C; })[0].texto;
  okQue('a la agencia se le dice «el real, no mostrador»', /mostrador/i.test(t));

  tk.olvidaTodo(); hook.olvidaTodo();
  const D = '5213377770006';
  tk.anotaEtapa(D, 'con_precio', { total: 9500 });
  const t2 = manda(D, { type: 'image', image: { id: 'c6' } })
    .envios.filter(function (e) { return e.para === D; })[0].texto;
  okQue('y a una familia NO', !/mostrador/i.test(t2));
}

/* Y una foto de alguien a quien nunca se le dio precio NO es un
   comprobante. Contestarle «lo verifico con el banco» es absurdo. */
hook.olvidaTodo(); tk.olvidaTodo();
{
  const C = '5213377770003';
  const t = manda(C, { type: 'image', image: { id: 'c3' } })
    .envios.filter(function (e) { return e.para === C; })[0].texto;
  okQue('a quien nunca preguntó nada NO se le habla del banco',
    !/banco|reserva|contrato/i.test(t));
  okQue('  pero tampoco se le ignora', t.length > 10);
  /* Y sobre todo: no se le pregunta desde cero a alguien que acaba de
     mandarte algo. Ese fue el defecto original. */
  okQue('  ni se le pregunta desde cero', !/a d[oó]nde van/i.test(t));
}

/* ============================================================ */
titulo('el nombre del cliente, que viene gratis');

/* Meta manda el nombre del perfil en cada aviso, en
   `contacts[].profile.name`. Estaba ahí desde el principio y no lo
   miraba nadie — y de toda la investigación de ventas del dueño, usar
   el nombre es lo más barato y lo que más cambia el tono.

   Lo importante es que NO se le pregunta: pedir un dato que ya tienes
   es de las cosas que delatan a un bot. */
function conNombre(de, nombre, cuerpoTexto) {
  cuantos++;
  const cuerpo = JSON.stringify({
    entry: [{ changes: [{ value: {
      metadata: { phone_number_id: '111' },
      contacts: [{ wa_id: de, profile: { name: nombre } }],
      messages: [{ id: 'n' + cuantos, from: de, type: 'text',
        text: { body: cuerpoTexto } }]
    } }] }]
  });
  const firma = 'sha256=' + crypto.createHmac('sha256', SECRETO)
    .update(Buffer.from(cuerpo, 'utf8')).digest('hex');
  return hook.procesa(Buffer.from(cuerpo, 'utf8'), firma, ENV);
}

hook.olvidaTodo(); tk.olvidaTodo();
{
  const C = '5213355550001';
  /* Llega el nombre en el primer mensaje y se usa hasta el cierre. */
  conNombre(C, 'Marisol Ortega',
    'a chapala el 12 de septiembre somos 12, salimos de guadalajara');
  const r = texto(C, 'regresamos el 14');
  const cot = texto(C, 'no vamos a pasear');
  const fin = texto(C, 'sí está bien');

  const pide = fin.envios.filter(function (e) { return e.para === C && e.cotiza; })[0];
  okQue('la petición de precio lleva su nombre',
    !!(pide && pide.resumen && pide.resumen.nombre === 'Marisol'));

  /* SOLO EL PRIMER NOMBRE. «Marisol Ortega» en un cierre suena a que
     le están leyendo su credencial. */
  okQue('  y es solo el primero, no el completo',
    pide.resumen.nombre.indexOf('Ortega') === -1);
}

/* Lo que NO es un nombre no se usa. Mucha gente pone su negocio, un
   emoji o puras mayúsculas en el perfil, y «Va, 🌵TACOS EL PRIMO🌵» es
   peor que no decir nada. */
hook.olvidaTodo(); tk.olvidaTodo();
{
  const feos = [
    ['5213355550002', '🌵TACOS EL PRIMO🌵'],
    ['5213355550003', 'FLETES Y MUDANZAS'],
    ['5213355550004', '.'],
    ['5213355550005', '12345'],
    ['5213355550006', '']
  ];
  const colados = feos.filter(function (f) {
    conNombre(f[0], f[1], 'a chapala el 12 de septiembre somos 12, de guadalajara');
    texto(f[0], 'regresamos el 14');
    texto(f[0], 'no vamos a pasear');
    const fin = texto(f[0], 'sí');
    const pide = fin.envios.filter(function (e) { return e.cotiza; })[0];
    return pide && pide.resumen && pide.resumen.nombre;
  }).map(function (f) { return f[1]; });
  ok('un perfil que no es nombre NO se usa', colados, []);
}

/* Y sin `contacts` —que es como llegan los avisos de prueba y algunos
   reenvíos— el bot funciona igual, sin nombre. */
hook.olvidaTodo(); tk.olvidaTodo();
{
  const C = '5213355550007';
  const r = texto(C, 'a chapala el 12 de septiembre somos 12, salimos de guadalajara');
  okQue('sin nombre en el aviso, el bot contesta igual',
    /Chapala/.test(r.envios[0].texto));
}

/* ============================================================ */
titulo('los datos para depositar');

/* WhatsApp NO tiene un botón de «copiar» en una conversación abierta:
   su `copy_code` vive solo en plantillas aprobadas por Meta. Pero SÍ
   copia un mensaje completo si lo dejas apretado.

   De ahí el diseño: la ficha va como imagen, y la CLABE va SOLA en su
   propio mensaje. Un toque largo y está en el portapapeles. */
hook.olvidaTodo(); tk.olvidaTodo();
{
  const CON = Object.assign({}, ENV, {
    SITIO_URL: 'https://eurotravel-web.vercel.app',
    CLABE: '012320001927217407'
  });
  const C = '5213366669999';
  const cuerpo = JSON.stringify({
    entry: [{ changes: [{ value: {
      metadata: { phone_number_id: '111' },
      messages: [{ id: 'pago1', from: C, type: 'text',
        text: { body: 'a qué cuenta deposito' } }]
    } }] }]
  });
  const firma = 'sha256=' + crypto.createHmac('sha256', SECRETO)
    .update(Buffer.from(cuerpo, 'utf8')).digest('hex');
  const r = hook.procesa(Buffer.from(cuerpo, 'utf8'), firma, CON);
  const suyos = r.envios.filter(function (e) { return e.para === C; });

  ok('salen tres mensajes: acuse, ficha y CLABE', suyos.length, 3);
  okQue('  el primero le contesta y le pide el nombre',
    /te la aparto/i.test(suyos[0].texto) && /nombre/i.test(suyos[0].texto));
  okQue('  el segundo es la ficha, por su liga',
    /\/img\/ficha-bancaria\.png$/.test(suyos[1].ligaDeFoto || ''));

  /* LO MÁS IMPORTANTE DE ESTE ARCHIVO. Si al mensaje de la CLABE se le
     pega cualquier cosa —un emoji, un punto, una palabra— el toque
     largo la copia también, y el cliente pega basura en el campo de la
     CLABE de su banco. El dinero se va a otro lado o rebota. */
  ok('  y el tercero son los 18 dígitos PELONES', suyos[2].texto, '012320001927217407');
  okQue('    sin una sola letra ni emoji', /^\d{18}$/.test(suyos[2].texto));

  /* Y el aviso de cómo copiarla va en la FICHA, no en el mensaje de la
     CLABE — justo por lo mismo. */
  okQue('  la instrucción va en la ficha, no en la CLABE',
    /apretada/i.test(suyos[1].texto));
}

/* Sin sitio configurado no se manda una liga rota: se cae al texto de
   siempre, que funciona igual aunque se copie peor. */
hook.olvidaTodo(); tk.olvidaTodo();
{
  const SIN = Object.assign({}, ENV, {
    CLABE: '012320001927217407',
    DATOS_BANCARIOS: 'TURISMO ET, S.A. DE C.V.\nCLABE: 012320001927217407'
  });
  const C = '5213366669998';
  const cuerpo = JSON.stringify({
    entry: [{ changes: [{ value: {
      metadata: { phone_number_id: '111' },
      messages: [{ id: 'pago2', from: C, type: 'text', text: { body: 'cómo te pago' } }]
    } }] }]
  });
  const firma = 'sha256=' + crypto.createHmac('sha256', SECRETO)
    .update(Buffer.from(cuerpo, 'utf8')).digest('hex');
  const suyos = hook.procesa(Buffer.from(cuerpo, 'utf8'), firma, SIN)
    .envios.filter(function (e) { return e.para === C; });

  ok('sin SITIO_URL, un solo mensaje', suyos.length, 1);
  okQue('  con los datos dentro', /CLABE/.test(suyos[0].texto));
  const conLiga = suyos.filter(function (e) { return e.ligaDeFoto; });
  ok('  y ninguna liga rota', conLiga, []);
}

/* ============================================================ */
titulo('el tablero');

hook.olvidaTodo(); tk.olvidaTodo();
{
  tk.anotaEtapa('5213300000001', 'escribio', {});
  tk.anotaEtapa('5213300000002', 'con_precio', { total: 9500, viaje: '📍 GDL → Chapala' });
  tk.anotaEtapa('5213300000003', 'mando_comprobante', { total: 12000, viaje: '📍 GDL → Tequila' });

  const r = texto(DUENO, 'tablero');
  ok('el dueño recibe una respuesta', r.envios.length, 1);
  const t = r.envios[0].texto;

  /* El que ya mandó dinero va PRIMERO. Ese es el punto del orden. */
  okQue('y el que ya mandó dinero va hasta arriba',
    t.indexOf('5213300000003') < t.indexOf('5213300000002'));
  okQue('  antes que el que apenas escribió',
    t.indexOf('5213300000002') < t.indexOf('5213300000001'));

  okQue('trae los números completos, para poder abrir el chat',
    /5213300000003/.test(t) && /5213300000001/.test(t));
  okQue('y el viaje de cada quien', /Tequila/.test(t) && /Chapala/.test(t));

  /* No es un mensaje al cliente: es para el dueño y no pasa a nadie. */
  ok('va dirigido al dueño', r.envios[0].para, DUENO);
  ok('y no escala nada', r.envios[0].pasaAPersona, false);
}

/* Y el tablero NO se confunde con una respuesta a un cliente: si el
   dueño escribe «tablero», no está contestándole a nadie. */
hook.olvidaTodo(); tk.olvidaTodo();
{
  const r = texto(DUENO, 'tablero');
  const aClientes = r.envios.filter(function (e) { return e.para !== DUENO; });
  ok('«tablero» no se le reenvía a ningún cliente', aClientes, []);
  okQue('y sin nadie en la lista, lo dice en vez de mandar un mensaje vacío',
    /no hay nadie/i.test(r.envios[0].texto));
}

/* Con muchos clientes se recorta: un mensaje de 300 renglones ni Meta
   lo acepta, y un tablero que nadie lee no sirve de nada. */
hook.olvidaTodo(); tk.olvidaTodo();
{
  for (let i = 0; i < 40; i++) {
    tk.anotaEtapa('52133000' + (10000 + i), 'cotizando', {});
  }
  const t = texto(DUENO, 'tablero').envios[0].texto;
  const renglones = t.split('\n').filter(function (l) { return l.indexOf('· 52133') === 0; });
  okQue('no se enseñan más de 25', renglones.length <= 25);
  okQue('  y se dice cuántos quedaron fuera', /y \d+ más/.test(t));
}

/* ============================================================ */
titulo('y dos clientes JAMÁS se cruzan');

/* Lo que el dueño pidió que no pudiera pasar «ni por posibilidad».
   Se prueba entreverando conversaciones, que es como pasa de verdad:
   nadie escribe por turnos. */
hook.olvidaTodo(); tk.olvidaTodo();
{
  const gente = [];
  for (let i = 0; i < 20; i++) gente.push('52133' + (20000000 + i * 137));

  /* Cada quien va a un destino distinto, entreverados. */
  const destinos = ['Chapala', 'Tequila', 'Mazamitla', 'Ajijic'];
  gente.forEach(function (n, i) {
    tk.anotaEtapa(n, 'con_precio', { total: 1000 + i, viaje: '📍 ' + destinos[i % 4] });
  });
  gente.forEach(function (n) { texto(n, 'hola'); });
  gente.forEach(function (n, i) {
    if (i % 3 === 0) manda(n, { type: 'image', image: { id: 'c' + i } });
  });

  let cruzados = 0;
  gente.forEach(function (n, i) {
    const f = tk.fichaDe(n);
    if (!f) { cruzados++; return; }
    if (f.cliente !== n) cruzados++;
    if (f.total !== 1000 + i) cruzados++;
    if (f.viaje !== '📍 ' + destinos[i % 4]) cruzados++;
  });
  ok('20 conversaciones entreveradas, 0 cruces', cruzados, 0);

  /* Y el aviso de cada comprobante habla del viaje de SU dueño. */
  const r = manda(gente[3], { type: 'image', image: { id: 'ultimo' } });
  const aviso = r.envios.filter(function (e) { return e.para === DUENO; })[0];
  okQue('y el aviso trae el viaje del cliente correcto',
    aviso && aviso.texto.indexOf(destinos[3 % 4]) !== -1);
  okQue('  y su número, no el de otro',
    aviso && aviso.texto.indexOf(gente[3]) !== -1);
}

/* ============================================================ */
console.log('\n' + buenas + ' buenas, ' + malas + ' malas');
process.exit(malas ? 1 : 0);
