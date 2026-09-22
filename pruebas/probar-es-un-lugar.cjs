/* ============================================================
   LA ÚNICA PUERTA: ¿ESTO NOMBRA UN LUGAR? (11-sep-2026 · fase 1)
   ============================================================
   Hasta hoy TRECE sitios distintos de `bot.js` decidían si un texto era
   un destino o una ciudad de origen, cada uno con su propia mezcla de
   seis comprobaciones. Por eso el mismo hueco se tapó CUATRO veces en un
   día: se arreglaba donde salió y seguía abierto en los otros doce.

   Todo lo que se coló en dos días, y por dónde entró:

     «Hoy Mismo»                    fecha, por el paso del destino
     «El Sabado»                    fecha, por el mismo
     «Un Fin de Semana»             temporada, por el mismo
     «a Dónde Todavía»              la pregunta, por el primer mensaje
     «Donde Me Recomiendas»         la pregunta, por el primer mensaje
     «Tequila Entonces»             muletilla pegada
     «Pues Todavia No Se, Que…»     la frase entera
     «Hidalgo 45»                   dirección como ciudad, por la IA
     «si esta bien»                 asentimiento como ciudad
     «ida y vuelta»                 como ciudad
     «gdl»                          sin normalizar a Guadalajara

   Ahora hay DOS funciones —`comoDestino` y `comoOrigen`— y los nueve
   sitios que guardan uno u otro pasan por ellas. Esta batería es el
   contrato de esas dos puertas: agregar una regla se hace UNA vez, y se
   comprueba UNA vez, aquí.
   ============================================================ */
'use strict';

const path = require('path');
const RAIZ = path.join(__dirname, '..');
const conv = require(path.join(RAIZ, 'bot.js'));

let buenas = 0, malas = 0;
function ok(que, condicion) {
  if (condicion) { buenas++; console.log('ok   ' + que); }
  else { malas++; console.log('FALLA ' + que); }
}
function titulo(t) { console.log('\n== ' + t.toUpperCase() + ' =='); }

titulo('comoDestino · lo que NO es un lugar');
{
  /* Cada renglón es algo que de verdad se guardó como destino. */
  const colados = [
    ['hoy mismo', 'una fecha'],
    ['el sabado', 'una fecha'],
    ['mañana', 'una fecha'],
    ['un fin de semana', 'una temporada'],
    ['para un fin de semana', 'una temporada'],
    ['un puente', 'una temporada'],
    ['en semana santa', 'una temporada'],
    ['a donde todavia', 'la pregunta'],
    ['a donde me recomiendas', 'la pregunta'],
    ['no se a donde', 'un «no sé»'],
    ['todavia no se', 'un «no sé»'],
    ['ida y vuelta', 'no es lugar'],
    ['de regreso', 'no es lugar'],
    ['si', 'un asentimiento'],
    /* 17-sep-2026: sin la IA (Anthropic caído), el guion guardó «hola,
       quiero cotizar» como el destino *Hola, Quiero Cotizar* y de ahí
       salió un ticket sin precio. Un saludo o una intención sin lugar no
       es un destino: se vuelve a preguntar. */
    ['hola, quiero cotizar', 'un saludo con intención'],
    ['hola', 'un saludo'],
    ['buenas tardes', 'un saludo'],
    ['buen día, necesito una cotización', 'una intención sin lugar'],
    ['quiero cotizar un viaje', 'una intención sin lugar'],
    ['me interesa rentar una sprinter', 'una unidad, no un lugar'],
    ['informacion de precios porfa', 'una intención sin lugar'],
    /* 21-sep-2026, conversaciones al azar: «me llamo Ramiro Pérez» quedó
       como destino *Me Llamo Ramiro Pérez* en el guion de respaldo. */
    ['me llamo ramiro pérez', 'un nombre'],
    ['soy mariana', 'un nombre'],
    ['mi nombre es toño', 'un nombre'],
    ['', 'nada']
  ];
  for (const [t, porque] of colados) {
    ok('«' + t + '» no es destino (' + porque + ')', conv.comoDestino(t) === null);
  }
}

titulo('comoOrigen · una petición no es una ciudad (18-sep-2026)');
{
  /* Simulación w2: «mándame fotos del neobus» contestando «¿salen de la
     ZMG?» se guardó como origen y salió en el resumen y en el ticket. */
  [['mandame fotos del neobus', 'pide fotos'], ['fotos del i6s', 'pide fotos'],
   ['mándame el video', 'pide video'], ['quiero cotizar', 'una intención'],
   ['el neobus', 'una unidad'], ['hola buenas', 'un saludo']]
    .forEach(function (par) { ok('«' + par[0] + '» no es origen (' + par[1] + ')', conv.comoOrigen(par[0]) === null); });
  [['de guadalajara', 'Guadalajara'], ['zapopan', 'Zapopan'], ['de gdl', 'Guadalajara'], ['tlaquepaque', 'Tlaquepaque']]
    .forEach(function (par) { ok('«' + par[0] + '» → ' + par[1], conv.comoOrigen(par[0]) === par[1]); });
}

titulo('comoDestino · lo que SÍ, y con qué nombre queda');
{
  const buenos = [
    ['a chapala', 'Chapala'],
    ['chapala', 'Chapala'],
    ['a tequila entonces', 'Tequila'],
    ['a vallarta porfa', 'Puerto Vallarta'],
    ['playa del carmen', 'Playa del Carmen'],
    ['a barrancas del cobre', 'Barrancas del Cobre'],
    ['san juan de los lagos', 'San Juan de los Lagos'],
    ['barra de navidad', 'Barra de Navidad'],
    ['el manto', 'El Manto'],
    ['valle de bravo', 'Valle de Bravo'],
    /* Las abreviaturas ganan al tope de letras: «pv» son dos. */
    ['pv', 'Puerto Vallarta'],
    ['vta', 'Puerto Vallarta'],
    ['a pv', 'Puerto Vallarta'],
    ['cdmx', 'Ciudad de México']
  ];
  for (const [dice, espera] of buenos) {
    ok('«' + dice + '» → ' + espera, conv.comoDestino(dice) === espera);
  }
  /* Una DIRECCIÓN sí vale como destino: Google manda direcciones enteras
     y el catálogo las reconoce. Lo que no vale es como origen. */
  ok('una dirección de Google sí es destino',
    !!conv.comoDestino('Blvd. Adolfo López Mateos 1927, León, Gto., México'));
}

titulo('comoOrigen · lo que NO es una ciudad');
{
  const colados = [
    ['hidalgo 45', 'una dirección'],
    ['av vallarta 1234', 'una avenida'],
    ['calle morelos 200', 'una calle'],
    ['colonia centro', 'una colonia'],
    ['si esta bien', 'un asentimiento'],
    ['si', 'un asentimiento'],
    ['ok', 'un asentimiento'],
    ['gracias', 'cortesía'],
    ['de ida y vuelta', 'no es lugar'],
    ['de regreso', 'no es lugar'],
    ['no se', 'un «no sé»'],
    ['mañana', 'una fecha'],
    ['', 'nada']
  ];
  for (const [t, porque] of colados) {
    ok('«' + t + '» no es origen (' + porque + ')', conv.comoOrigen(t) === null);
  }
}

titulo('comoOrigen · lo que SÍ, ya como ciudad');
{
  /* Lo importante aquí no es solo que pase: es que quede NORMALIZADO.
     Ese texto viaja al ticket, al contrato y a la llave con la que se
     guardan los precios aprendidos. «gdl» y «Guadalajara» tienen que ser
     el mismo viaje. */
  const buenos = [
    ['de gdl', 'Guadalajara'],
    ['gdl', 'Guadalajara'],
    ['guadalajara', 'Guadalajara'],
    ['de guadalajara', 'Guadalajara'],
    ['zapopan', 'Zapopan'],
    ['desde ocotlan', 'Ocotlan'],
    ['tlaquepaque', 'Tlaquepaque']
  ];
  for (const [dice, espera] of buenos) {
    ok('«' + dice + '» → ' + espera, conv.comoOrigen(dice) === espera);
  }
}

titulo('las dos puertas no se contradicen');
{
  /* Lo que no es lugar no lo es para ninguna de las dos. */
  for (const t of ['hoy mismo', 'un fin de semana', 'no se a donde', 'ida y vuelta', 'si']) {
    ok('«' + t + '» lo rechazan las dos',
      conv.comoDestino(t) === null && conv.comoOrigen(t) === null);
  }
  /* Y una ciudad de verdad la aceptan las dos. */
  for (const t of ['chapala', 'guadalajara', 'ocotlan']) {
    ok('«' + t + '» lo aceptan las dos', !!conv.comoDestino(t) && !!conv.comoOrigen(t));
  }
}

titulo('nadie guarda un destino ni un origen por su cuenta');
{
  /* El contrato de la fase 1: si alguien vuelve a escribir su propia
     regla en vez de llamar a la puerta, esto lo caza. Se cuentan las
     asignaciones directas a `e.destino` y `e.origen` que NO vienen de
     `comoDestino`/`comoOrigen`.

     Las que se permiten, y por qué:
     · el paso del origen usa `comoCiudad` tras sus propias preguntas
     · `pegaDatos` normaliza la zona metropolitana a «Guadalajara»
     · los borrados (`= null`) al cambiar de viaje */
  const fs = require('fs');
  const codigo = fs.readFileSync(path.join(RAIZ, 'bot.js'), 'utf8');
  const sospechosas = codigo.split('\n')
    .map(function (l, i) { return { n: i + 1, t: l }; })
    .filter(function (l) { return /\be\.(destino|origen)\s*=\s*/.test(l.t); })
    .filter(function (l) { return !/comoDestino|comoOrigen|suDestino|suyo|=\s*null|=\s*''/.test(l.t); })
    .filter(function (l) { return !/^\s*\*/.test(l.t); });
  ok('ninguna asignación se salta la puerta', sospechosas.length === 0);
  sospechosas.forEach(function (l) { console.log('     bot.js:' + l.n + ' → ' + l.t.trim().slice(0, 90)); });
}

/* 22-sep-2026, corrida con el modelo caído (guion de respaldo): una pregunta
   quedó como destino y una intención completa también. */
{
  ok('«van niños, cobran igual?» no es un lugar', conv.comoDestino('van niños, cobran igual?') === null);
  ok('«tienen wifi y tele las unidades?» no es un lugar', conv.comoDestino('tienen wifi y tele las unidades?') === null);
  ok('«quería cotizar un viaje a vta» es Puerto Vallarta', conv.comoDestino('quería cotizar un viaje a vta') === 'Puerto Vallarta');
  /* «necesito un camión a mazatlán» NO entra aquí a propósito: nombrar una
     unidad ya lo descarta como lugar (13-sep-2026) y esa regla se queda. */
  ok('«quisiera cotizar un viaje a mazatlán» es Mazatlán', conv.comoDestino('quisiera cotizar un viaje a mazatlán') === 'Mazatlán');
  ok('«me interesa ir a chapala» es Chapala', conv.comoDestino('me interesa ir a chapala') === 'Chapala');
  ok('«a vta» sigue siendo Puerto Vallarta', conv.comoDestino('a vta') === 'Puerto Vallarta');
  ok('«Nueva cotización» (el botón escrito) no es un lugar', conv.comoDestino('Nueva cotización') === null);
  ok('«Cotización anterior» no es un lugar', conv.comoDestino('Cotización anterior') === null);
}

console.log('\n' + buenas + ' buenas, ' + malas + ' malas');
process.exit(malas ? 1 : 0);
