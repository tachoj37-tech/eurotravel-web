/* ============================================================
   R47 · La página no da NINGÚN precio
   ------------------------------------------------------------
       node pruebas/probar-sin-precio.cjs

   EL DICTADO DEL DUEÑO, 12-sep-2026, en sus palabras:

     «exacto, ningún precio para nadie, lo que hace el bot es
      mandar el mensaje con el ticket de la cotización para que el
      vendedor vaya a esa misma conversación y de precio y continúe
      la conversación»

     «cuando se usa el cotizador de la página y el cliente selecciona
      confirmar, se le manda un mensaje con el ticket como te
      mencioné, de momento no hay precio»

   QUÉ CAMBIA RESPECTO DE R46. R46 apagó la FÓRMULA por kilómetros:
   lo que no salía del Excel dejaba de darse. R47 apaga TAMBIÉN los
   precios del Excel, que son los que sí se daban: hasta hoy la
   Sprinter cotizaba sola a 43 destinos y enseñaba «aparta con
   $4,000».

   R47 NO BORRA NADA. El criterio, la fórmula y el cálculo entero
   siguen vivos y probados —los necesitan el bot, la pantalla del
   dueño y el aprendizaje de precios—. Lo que se apagó son las dos
   puertas públicas, con UN interruptor: `tarifa.PAGINA_DA_PRECIOS`.

   QUÉ CUIDA ESTA PRUEBA, en orden de gravedad:

     1. Por las dos puertas públicas NO sale un número, ni siquiera
        para los destinos que sí están en el criterio.
     2. El cliente NO lo puede encender mandándolo en el cuerpo.
     3. La máquina de precios NO se rompió: sin la opción sigue
        dando exactamente lo mismo que antes.
     4. La página ni siquiera pregunta —cero llamadas de pago a
        Google por un precio que no se va a enseñar—.
     5. El interruptor del servidor y el de la página son el mismo
        valor. Dos copias se desincronizan; eso se caza aquí.
     6. El acuse ofrece mandar la ficha por WhatsApp, que es por
        donde el vendedor contesta y por donde se aprende el precio.
   ============================================================ */
'use strict';

const fs = require('fs');
const path = require('path');
const tarifa = require('../api/_tarifa.js');
const nucleo = require('../api/_cotiza-nucleo.js');
const COTIZACION = require('../cotizacion.js');

const RAIZ = path.join(__dirname, '..');
const INDEX = fs.readFileSync(path.join(RAIZ, 'index.html'), 'utf8');
const COTIZAR = fs.readFileSync(path.join(RAIZ, 'api', 'cotizar.js'), 'utf8');
const PAGAR = fs.readFileSync(path.join(RAIZ, 'api', 'pagar.js'), 'utf8');
const NUCLEO = fs.readFileSync(path.join(RAIZ, 'api', '_cotiza-nucleo.js'), 'utf8');

let buenas = 0, malas = 0;
function cierto(nombre, v) {
  if (v) { buenas++; console.log('ok   ' + nombre); }
  else { malas++; console.log('MAL  ' + nombre); }
}
function igual(nombre, dio, esperado) {
  const a = JSON.stringify(dio), b = JSON.stringify(esperado);
  if (a === b) { buenas++; console.log('ok   ' + nombre); }
  else { malas++; console.log('MAL  ' + nombre + '\n     dio      ' + a + '\n     esperaba ' + b); }
}

/* El mismo viaje de `probar-solo-del-criterio.cjs`: lunes, saliendo de
   Guadalajara, sin movimientos. Lo que se mide aquí es el destino. */
function precioDe(texto, dias, opciones) {
  const p = tarifa.calcula(0, dias, Object.assign({
    noches: Math.max(0, dias - 1),
    destino: { texto: texto },
    origen: 'Guadalajara, Jalisco',
    redondo: true,
    salida: '2026-09-21T08:00'
  }, opciones || {}));
  return p.requiereAsesor ? 'ASESOR' : p.total;
}

(async function () {

  /* ------------------------------------------------------------
     1 · EL INTERRUPTOR, Y QUE SEA UNO SOLO
     ------------------------------------------------------------ */
  console.log('\n--- el interruptor ---');

  cierto('el servidor tiene el interruptor',
    typeof tarifa.PAGINA_DA_PRECIOS === 'boolean');
  cierto('la página tiene el suyo',
    typeof COTIZACION.PAGINA_DA_PRECIOS === 'boolean');

  /* Esto es lo que de verdad importa: dos copias del mismo sí/no se
     desincronizan. El día que él encienda el cotizador, tiene que
     encenderse en los dos lados —o la página pide un precio que el
     servidor le niega, o peor, al revés—. */
  igual('el de la página y el del servidor dicen lo mismo',
    COTIZACION.PAGINA_DA_PRECIOS, tarifa.PAGINA_DA_PRECIOS);

  /* CAMBIÓ DE LADO EL 15-sep-2026. Decía «HOY está apagado (dictado del
     12-sep-2026)». Decisión del dueño del 15-sep-2026: la Sprinter vuelve a
     cotizar en línea y se aparta con anticipo; camiones y Suburban siguen
     con asesor. Lo que protege a los camiones no es este interruptor sino
     `cotizadorAutomatico` en la página y `UNIDADES_QUE_COTIZAN` en el
     servidor, y eso se exige abajo con el interruptor encendido. */
  cierto('HOY está encendido (decisión del 15-sep-2026)',
    tarifa.PAGINA_DA_PRECIOS === true);

  /* ------------------------------------------------------------
     2 · NO SALE NÚMERO, NI PARA LOS DEL CRITERIO
     ------------------------------------------------------------
     Éstos son justo los que sí cotizaban: están en el Excel y la
     Sprinter los daba en línea. Son los que R46 dejaba pasar. */
  console.log('\n--- con la opción no sale número ---');

  ['Puerto Vallarta', 'Chapala', 'Tequila', 'Mazatlán', 'Tepic', 'Manzanillo'].forEach(function (d) {
    igual(d + ' no da precio', precioDe(d, 3, { sinPrecio: true }), 'ASESOR');
  });

  const p = tarifa.calcula(0, 3, {
    noches: 2, destino: { texto: 'Puerto Vallarta' }, origen: 'Guadalajara, Jalisco',
    redondo: true, salida: '2026-09-21T08:00', sinPrecio: true
  });
  igual('el total es cero, no un número chico', p.total, 0);
  igual('el anticipo también', p.anticipo, 0);
  igual('y el saldo', p.saldo, 0);
  cierto('y lo dice: requiereAsesor', p.requiereAsesor === true);

  /* Un viaje de un día en domingo es otro producto (R43) y tiene su
     propio renglón en el Excel. Tampoco se cotiza. */
  igual('el dominical tampoco',
    precioDe('Chapala', 1, { sinPrecio: true, salida: '2026-09-20T08:00' }), 'ASESOR');

  /* ------------------------------------------------------------
     3 · LA MÁQUINA NO SE ROMPIÓ
     ------------------------------------------------------------
     Sin la opción, todo sigue igual. Es lo que sostiene al bot, a la
     pantalla del dueño y al aprendizaje de precios: si R47 hubiera
     tocado el cálculo en vez de la puerta, se apagaría todo eso. */
  console.log('\n--- sin la opción, todo sigue igual ---');

  cierto('Vallarta 3 días sigue dando un número, no ASESOR',
    typeof precioDe('Puerto Vallarta', 3) === 'number' && precioDe('Puerto Vallarta', 3) > 0);
  cierto('Chapala 1 día también',
    typeof precioDe('Chapala', 1) === 'number' && precioDe('Chapala', 1) > 0);
  cierto('y Tequila',
    typeof precioDe('Tequila', 2) === 'number' && precioDe('Tequila', 2) > 0);

  /* ------------------------------------------------------------
     4 · CERO LLAMADAS DE PAGO POR UN PRECIO QUE NO SE ENSEÑA
     ------------------------------------------------------------
     Medir son DOS llamadas a Google por cotización. Sin esto, la
     página seguiría midiendo kilómetros para tirar el resultado. */
  console.log('\n--- no se mide lo que no se va a enseñar ---');

  cierto('un destino de fuera NO se mide con sinPrecio',
    tarifa.necesitaMedirse({ texto: 'Cuernavaca' }, 'Sprinter', { sinPrecio: true }) === false);
  cierto('uno del criterio tampoco',
    tarifa.necesitaMedirse({ texto: 'Puerto Vallarta' }, 'Sprinter', { sinPrecio: true }) === false);
  cierto('pero sin la opción, el de fuera SÍ se mide (el bot lo necesita)',
    tarifa.necesitaMedirse({ texto: 'Cuernavaca' }, 'Sprinter', {}) === true);

  /* ------------------------------------------------------------
     5 · EL CLIENTE NO LO PUEDE ENCENDER
     ------------------------------------------------------------
     La lección de R46, otra vez: el cuerpo de la petición lo escribe
     el navegador, y el navegador es del cliente. */
  console.log('\n--- el cuerpo no manda ---');

  /* Los puntos van con la forma que manda la página —`COTIZACION.puntoDe`—,
     que es un objeto con dirección: `_rutas.formasDe` no acepta texto pelado.
     Y la llave de Google va en `null` A PROPÓSITO: si el código intentara
     medir, esto contestaría 503 y la prueba lo cazaría. */
  const conMentira = await nucleo.cotiza(
    {
      origen: { placeId: '', lat: null, lng: null, direccion: 'Guadalajara, Jalisco, México' },
      destino: { placeId: '', lat: null, lng: null, direccion: 'Puerto Vallarta, Jalisco, México' },
      salida: '2026-09-21T08:00', regreso: '2026-09-24T18:00',
      unidad: 'Sprinter', sinPrecio: false, PAGINA_DA_PRECIOS: true
    },
    null, { soloDelCriterio: true, sinPrecio: true });
  cierto('mandar sinPrecio:false en el cuerpo no enciende nada',
    conMentira.ok === true && conMentira.precio.requiereAsesor === true);
  igual('y el total sigue en cero', conMentira.precio.total, 0);

  cierto('el núcleo lo lee de las opciones, no del cuerpo',
    /opciones\s*&&\s*opciones\.sinPrecio/.test(NUCLEO) && !/\bc\.sinPrecio\b/.test(NUCLEO));

  /* ------------------------------------------------------------
     6 · LAS DOS PUERTAS PÚBLICAS LO PIDEN
     ------------------------------------------------------------
     Cerrar una sola no sirve de nada: `/api/cotizar` enseña y
     `/api/pagar` cobra. Es la misma lección que dejó escrita R46.
     Y las dos leen el MISMO interruptor, no un `true` a mano. */
  console.log('\n--- las dos puertas ---');

  cierto('/api/cotizar pide sinPrecio del interruptor',
    /sinPrecio:\s*!tarifa\.PAGINA_DA_PRECIOS/.test(COTIZAR));
  cierto('/api/pagar tambien',
    /sinPrecio:\s*!tarifa\.PAGINA_DA_PRECIOS/.test(PAGAR));

  /* ------------------------------------------------------------
     7 · LA PÁGINA NI SIQUIERA PREGUNTA
     ------------------------------------------------------------ */
  console.log('\n--- la pantalla ---');

  const SPRINTER = { id: 'sprinter', name: 'Sprinter', cotizadorAutomatico: true };
  const AUTOBUS = { id: 'irizar-i6s', name: 'Irizar i6S', cotizadorAutomatico: false };

  /* CAMBIÓ DE LADO EL 15-sep-2026: la Sprinter vuelve a cotizar en línea.
     Los camiones y la Suburban NO, y eso es lo que más importa aquí: con el
     interruptor encendido, lo único que los separa del precio de la van es
     `cotizadorAutomatico` (página) y `UNIDADES_QUE_COTIZAN` (servidor). */
  const SUBURBAN = { id: 'suburban', name: 'Suburban', cotizadorAutomatico: false };

  cierto('la Sprinter cotiza en línea (15-sep-2026)',
    COTIZACION.cotizaEnLinea(SPRINTER) === true);
  cierto('el autobús NO (nunca lo hizo)',
    COTIZACION.cotizaEnLinea(AUTOBUS) === false);
  cierto('la Suburban tampoco',
    COTIZACION.cotizaEnLinea(SUBURBAN) === false);
  cierto('sin unidad, tampoco truena',
    COTIZACION.cotizaEnLinea(null) === false);

  /* Y en el catálogo de verdad: SOLO la Sprinter tiene cotizador automático.
     Si alguien le pusiera `true` a un camión, con el interruptor encendido
     la pantalla le enseñaría precio y botón de pagar. */
  global.window = global.window || {};
  require('../unidades.js');
  const conAutomatico = (global.window.UNIDADES || [])
    .filter(function (u) { return u.cotizadorAutomatico; })
    .map(function (u) { return u.id; });
  igual('en unidades.js solo la Sprinter cotiza sola', conAutomatico, ['sprinter']);

  const pideContando = function () {
    pedidas++;
    return Promise.resolve({ ok: true, json: function () { return Promise.resolve({}); } });
  };
  const viajeDePrueba = {
    origen: { place: ['Guadalajara', 'Jalisco', 'ciudad'], coords: '20.6597, -103.3496' },
    destino: { place: ['Puerto Vallarta', 'Jalisco', 'playa'], coords: '20.6534, -105.2253' },
    salida: '2026-09-21T08:00', regreso: '2026-09-24T18:00', redondo: true, pasajeros: 12
  };

  let pedidas = 0;
  const maquina = COTIZACION.crea({ pide: pideContando });
  maquina.pon(Object.assign({}, viajeDePrueba, { unidad: SPRINTER }));
  cierto('con la Sprinter, cotizaEnAutomatico dice que sí',
    maquina.cotizaEnAutomatico() === true);
  const v = await maquina.cotiza();
  igual('y cotizar pide el precio', v.tipo, 'listo');
  igual('con una petición', pedidas, 1);

  for (const unidad of [AUTOBUS, SUBURBAN]) {
    pedidas = 0;
    const m = COTIZACION.crea({ pide: pideContando });
    m.pon(Object.assign({}, viajeDePrueba, { unidad: unidad, pasajeros: 5 }));
    const vv = await m.cotiza();
    igual(unidad.name + ': cotizar contesta "manual"', vv.tipo, 'manual');
    igual(unidad.name + ': sin mandar una sola petición', pedidas, 0);
  }

  /* Y la puerta, que es la que defiende: con el interruptor ENCENDIDO, el
     núcleo de /api/cotizar rechaza un camión o una Suburban aunque la
     petición venga armada a mano. Y la llave de Google va en null a
     propósito: la unidad se rechaza antes de medir nada. */
  for (const nombre of ['Irizar i6S', 'Marcopolo Paradiso G8', 'Suburban']) {
    const r = await nucleo.cotiza({
      origen: { placeId: '', lat: null, lng: null, direccion: 'Guadalajara, Jalisco, México' },
      destino: { placeId: '', lat: null, lng: null, direccion: 'Puerto Vallarta, Jalisco, México' },
      salida: '2026-09-21T08:00', regreso: '2026-09-24T18:00', unidad: nombre
    }, null, { soloDelCriterio: true, sinPrecio: !tarifa.PAGINA_DA_PRECIOS });
    igual('encendido, «' + nombre + '» NO sale con precio por /api/cotizar',
      [r.ok, r.error, r.precio && r.precio.total], [false, 'unidad no cotizable', undefined]);
  }

  /* Las dos tarjetas de la pantalla leen la MISMA regla. Antes cada
     una miraba `u.cotizadorAutomatico` por su cuenta: con el
     interruptor apagado, una diría «cotización en línea disponible»
     encima de una caja que le pide el teléfono. */
  cierto('el botón de buscar usa la regla compartida',
    INDEX.indexOf('COTIZACION.cotizaEnLinea(u)') !== -1);
  igual('y nadie mira cotizadorAutomatico por su cuenta en la pantalla',
    (INDEX.match(/u\.cotizadorAutomatico/g) || []).length, 0);

  /* ------------------------------------------------------------
     8 · LA FICHA SALE POR WHATSAPP
     ------------------------------------------------------------
     Es la pieza que cierra el círculo: el cliente abre la
     conversación, el bot arma el ticket, el vendedor contesta el
     precio AHÍ, y de ahí se aprende. Ver docs/SIN-PRECIOS.md. */
  console.log('\n--- la ficha por WhatsApp ---');

  cierto('el acuse ofrece abrir WhatsApp',
    INDEX.indexOf('captura-whats') !== -1);
  cierto('y arma el enlace con el ayudante de siempre',
    /captura-whats[\s\S]{0,3000}?ligaWhatsApp\(/.test(INDEX));
  cierto('la ficha para WhatsApp existe',
    INDEX.indexOf('function fichaParaWhatsApp') !== -1);

  /* ------------------------------------------------------------
     9 · LO QUE LA PANTALLA LE PROMETE AL CLIENTE
     ------------------------------------------------------------
     Estos tres NO los cazó ninguna prueba: se cazaron abriendo la
     página y caminando el cotizador completo, y los tres hablaban de
     un precio que ya no existe.

       · «el precio todavía se puede mover… la tarifa queda firme»
       · «Cada día con movimientos se cobra aparte y se suma a tu total»
       · «Ya está sumado al total de arriba» (dos veces)

     Los tres viven dentro de plantillas armadas a pedazos, así que
     una prueba de pantallas no los iba a ver. Ésta los caza por lo
     que dicen y no por dónde están: si alguien vuelve a prometer un
     total mientras el cotizador está apagado, se entera aquí.

     Va atado al interruptor A PROPÓSITO: el día que él encienda el
     cotizador, estas frases vuelven a ser ciertas y esta prueba deja
     de exigir que no estén. Una prueba que hay que borrar para
     encender una función es una prueba que se borra sin leerla. */
  console.log('\n--- lo que se le promete al cliente ---');

  const PROMESAS_DE_TOTAL = [
    'se suma a tu total',
    'Ya está sumado al total',
    'el precio todavía se puede mover',
    'la tarifa queda firme'
  ];
  /* Éstas salieron de caminar las cinco pestañas con la página abierta.
     Son las que MÁS se ven y las que nadie mira al cambiar código: la
     `meta description` es lo que sale en Google, y `og:description` es lo
     que se previsualiza cuando alguien pega el link en WhatsApp —que es
     como se comparte esta página—.

     15-sep-2026 · Pasaron a prohibirse SIEMPRE, encendido o apagado: con
     la Sprinter cotizando, «cotiza tu viaje en línea» a secas le promete
     precio también al que busca un autobús, y ése va con asesor. */
  const PROMESAS_PARA_TODOS = [
    'Cotiza en línea',
    'Cotiza tu viaje en línea'
  ];

  /* SE MIRA SIN LOS COMENTARIOS, y no es un detalle: la primera versión
     de esta prueba salió en rojo por los comentarios que explican POR QUÉ
     se quitaron esas frases —que las citan textuales—. Una prueba que
     obliga a escribir el comentario con rodeos para no dispararla es una
     prueba que acaba con comentarios peores. Lo que se juzga es lo que
     llega a la pantalla. */
  function soloLoQueSeVe(html) {
    return html
      .replace(/<!--[\s\S]*?-->/g, ' ')
      .replace(/\/\*[\s\S]*?\*\//g, ' ');
  }
  const VISIBLE = soloLoQueSeVe(INDEX);

  /* Y que el quitar comentarios no se haya llevado media pantalla por
     delante: si un `/*` dentro de un texto abriera un comentario falso,
     lo de abajo pasaría por vacío y la prueba diría que todo está bien. */
  cierto('quitar los comentarios deja la pantalla entera',
    VISIBLE.length > INDEX.length * 0.5 &&
    VISIBLE.indexOf('Para este viaje te paso el precio a la medida') !== -1 &&
    VISIBLE.indexOf('Mándanos tu viaje por WhatsApp') !== -1);

  if (tarifa.PAGINA_DA_PRECIOS) {
    cierto('(el cotizador está encendido: estas frases vuelven a valer)', true);
  } else {
    PROMESAS_DE_TOTAL.forEach(function (frase) {
      cierto('apagado, la pantalla NO dice «' + frase + '»',
        VISIBLE.indexOf(frase) === -1);
    });
  }

  PROMESAS_PARA_TODOS.forEach(function (frase) {
    cierto('la pantalla NO promete a todos «' + frase + '»', VISIBLE.indexOf(frase) === -1);
  });

  /* Y lo que SÍ tiene que decir, desde el 15-sep-2026, en los tres lugares
     que resumen la oferta: que la Sprinter tiene precio en línea y que lo
     demás lo cotiza un asesor. */
  function metaDe(atributo) {
    const m = new RegExp('<meta\\s+' + atributo + '\\s+content="([^"]*)"').exec(INDEX);
    return m ? m[1] : '';
  }
  const cbox = (/<div class="cbox">([\s\S]*?)<\/div>/.exec(VISIBLE) || [])[1] || '';
  [['meta description', metaDe('name="description"')],
   ['og:description', metaDe('property="og:description"')],
   ['la caja de contacto', cbox]].forEach(function (par) {
    if (tarifa.PAGINA_DA_PRECIOS) {
      cierto(par[0] + ' dice que la Sprinter tiene precio en línea',
        /Sprinter[^.]*precio en línea/.test(par[1]));
      cierto(par[0] + ' dice que lo demás lo cotiza un asesor', /asesor/.test(par[1]));
    }
  });

  /* Los camiones no llegan al botón de pagar: la caja de pago solo se
     enciende con una cotización que traiga anticipo, y los camiones nunca
     la tienen (`cotiza` contesta «manual», probado arriba). */
  cierto('la caja de pago solo sale con anticipo cotizado',
    /window\.pintaPago = function \(\) \{\s*var c = VIAJE\.cotizacion;\s*if \(!c \|\| !c\.anticipo\)/.test(INDEX));

  console.log('\n' + buenas + ' buenas, ' + malas + ' malas');
  if (malas) process.exit(1);
})();
