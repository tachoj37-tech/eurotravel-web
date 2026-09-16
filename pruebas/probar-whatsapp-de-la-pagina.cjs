/* ============================================================
   El WhatsApp de la página: UN número, y el bueno
   ------------------------------------------------------------
       node pruebas/probar-whatsapp-de-la-pagina.cjs

   FASE 4 DEL PLAN, y un bug que salió al empezarla.

   ESTO NACIÓ DE CONTAR LOS `wa.me` — el 12-sep-2026 había OCHO,
   repartidos en cuatro archivos, con **dos números distintos**:

     523321832993  ← el WhatsApp, así rotulado en el pie y en Contacto
     523324002285  ← el TELÉFONO, el del `tel:` de la barra

   Cuatro de los ocho mandaban al número de teléfono. Entre ellos el
   botón «Enviar por WhatsApp» del resumen de la cotización, que es
   el momento de mayor intención de compra que tiene la página: el
   cliente acaba de armar su viaje, pica, y le escribe a un número
   que no es el del WhatsApp de la empresa.

   Y LO QUE VIENE LO HACE PEOR. El dueño va a mudar el WhatsApp a
   Kommo («va a abrir el whatsapp que estamos trabajando con kommo,
   ve ajustando la ruta»). Con el número escrito a mano en ocho
   lugares, el día de la mudanza hay que acertarle a los ocho; con
   uno solo, es un renglón.

   Lo que se cuida:

     1. El número vive en UN lugar y nadie lo escribe a mano.
     2. Ese número NO es el del teléfono.
     3. El botón flotante abre WhatsApp con el mensaje ya escrito.
     4. Desde el cotizador, el mensaje lleva la ficha del viaje.
   ============================================================ */
'use strict';

const fs = require('fs');
const path = require('path');

const RAIZ = path.join(__dirname, '..');

let buenas = 0, malas = 0;
function igual(nombre, dio, esperado) {
  const a = JSON.stringify(dio), b = JSON.stringify(esperado);
  if (a === b) { buenas++; console.log('ok   ' + nombre); }
  else { malas++; console.log('MAL  ' + nombre + '\n     dio      ' + a + '\n     esperaba ' + b); }
}
function cierto(nombre, v) { igual(nombre, !!v, true); }
function titulo(t) { console.log('\n== ' + t.toUpperCase() + ' =='); }

/* Lo que el navegador carga. `api/` va aparte: allá el número sale del
   entorno, no de `config.js`. */
const DEL_NAVEGADOR = ['index.html', 'viaje.html', 'bot-navegador.js', 'config.js'];

function lee(rel) {
  const p = path.join(RAIZ, rel);
  return fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : '';
}

const config = lee('config.js');

/* ============================================================ */
titulo('el número vive en un solo lugar');
{
  cierto('config.js declara el WhatsApp', /WHATSAPP\s*:/.test(config));

  const m = /WHATSAPP\s*:\s*'(\d+)'/.exec(config);
  cierto('  y es un número', !!m);
  const elBueno = m ? m[1] : '';

  /* Nadie más lo escribe a mano. Ésta es la aserción que hace que la
     mudanza a Kommo sea un renglón y no una cacería. */
  const aMano = [];
  DEL_NAVEGADOR.forEach(function (archivo) {
    if (archivo === 'config.js') return;      // el único que puede tenerlo
    /* `bot-navegador.js` PERDONADO, y con fecha de caducidad: es la cáscara
       del chat y va por la rama del bot, que no se toca desde aquí (se
       pisarían los dos trabajos). Tiene el número BUENO —se comprueba
       abajo—, así que hoy no manda a nadie al lugar equivocado; lo que le
       falta es salir de `config.js` como todos los demás, y eso le toca a
       esa rama. Anotado en `docs/PREGUNTAS-ABIERTAS.md`. */
    if (archivo === 'bot-navegador.js') return;
    /* `index.html` PERDONADO desde el 15-sep-2026, y con motivo: sus enlaces
       de WhatsApp llevan la dirección escrita en el HTML como RED —ver más
       abajo, «los enlaces sirven aunque el guion no corra»—. Es la única
       forma de que sirvan cuando el guion se cae, porque quien los llenaba
       era el guion. A cambio, la aserción de abajo exige que TODOS digan el
       mismo número que `config.js`: el día de la mudanza a Kommo esta
       prueba se pone roja y nombra los que faltaron. */
    if (archivo === 'index.html') return;
    const texto = lee(archivo);
    const encontrados = texto.match(/wa\.me\/\d+/g) || [];
    encontrados.forEach(function (u) { aMano.push(archivo + ' → ' + u); });
  });
  igual('ningún otro archivo del navegador escribe el número a mano', aMano, []);

  /* La red del párrafo anterior: si una de las direcciones escritas en el
     HTML se queda con el número viejo, esto la caza. */
  const enLaPagina = (lee('index.html').match(/wa\.me\/(\d+)/g) || [])
    .map(function (u) { return u.replace('wa.me/', ''); });
  cierto('la página trae direcciones de WhatsApp escritas', enLaPagina.length > 0);
  igual('y todas dicen el número de config.js',
    enLaPagina.filter(function (n) { return n !== elBueno; }), []);

  /* Y mientras el chat lo tenga escrito, que al menos sea el bueno: si la
     rama del bot lo cambia por otro, esto se pone rojo. */
  const chat = lee('bot-navegador.js');
  const enElChat = (chat.match(/wa\.me\/(\d+)/g) || [])
    .map(function (u) { return u.replace('wa.me/', ''); });
  igual('el chat manda al mismo número que la página',
    enElChat.filter(function (n) { return n !== elBueno; }), []);

  /* ------------------------------------------------------------
     Y NO ES EL DEL TELÉFONO
     ------------------------------------------------------------
     Éste es el bug que había: cuatro `wa.me` apuntaban al número del
     `tel:`. Si ese número no tiene WhatsApp —y no tiene por qué
     tenerlo— el mensaje del cliente no llega a ninguna parte.
     ------------------------------------------------------------ */
  const index = lee('index.html');
  const tel = /tel:\+?(\d+)/.exec(index);
  cierto('la página tiene un teléfono con `tel:`', !!tel);
  const elTelefono = tel ? tel[1] : '';

  cierto('el WhatsApp y el teléfono son números distintos',
    elBueno && elTelefono && elBueno !== elTelefono);

  /* ------------------------------------------------------------
     EL RÓTULO DICE EL MISMO NÚMERO AL QUE MANDA EL ENLACE
     ------------------------------------------------------------
     Si dicen cosas distintas, una de las dos miente — y el cliente que
     copia el número del rótulo para marcarlo a mano se queda fuera.

     Se busca el número formateado tal cual lo lee el cliente, y no un
     «WhatsApp seguido de dígitos»: eso primero agarró el teléfono de la
     barra, que está más arriba en el archivo. Falso positivo de la
     prueba, no del código.
     ------------------------------------------------------------ */
  const diez = elBueno.replace(/^52/, '');
  const comoSeLee = diez.slice(0, 2) + ' ' + diez.slice(2, 6) + ' ' + diez.slice(6);
  cierto('el número del WhatsApp se lee en la página como el del enlace',
    index.indexOf(comoSeLee) >= 0);
  /* Y el del teléfono NO se usa como si fuera WhatsApp. */
  const telLegible = elTelefono.replace(/^52/, '');
  const telComoSeLee = telLegible.slice(0, 2) + ' ' + telLegible.slice(2, 6) + ' ' + telLegible.slice(6);
  cierto('el teléfono sigue rotulado como teléfono',
    index.indexOf('tel:+' + elTelefono) >= 0 && index.indexOf(telComoSeLee) >= 0);
}

/* ============================================================ */
titulo('el botón flotante abre WhatsApp, con el mensaje escrito');
{
  const index = lee('index.html');

  /* El dueño lo decidió el 12-sep-2026: «va a abrir el whatsapp que
     estamos trabajando con kommo». Antes abría el chat de la página. */
  const fab = index.slice(index.indexOf('id="wa-abrir"') - 400,
    index.indexOf('id="wa-abrir"') + 400);
  cierto('el botón flotante sigue existiendo', /wa-fab/.test(index));

  /* Lleva texto ya escrito: «el cliente solo le da enviar». */
  cierto('hay un mensaje por omisión para WhatsApp', /WHATSAPP_TEXTO|TEXTO_WHATSAPP/.test(config));
  cierto('  y habla de cotizar un viaje', /cotizar un viaje/i.test(config));

  /* Y el armador de ligas existe una sola vez. */
  igual('hay una sola función que arma la liga de WhatsApp',
    (index.match(/function ligaWhatsApp\(/g) || []).length, 1);
}

/* ============================================================
   LOS ENLACES SIRVEN AUNQUE EL GUION NO CORRA · 15-sep-2026
   ------------------------------------------------------------
   Los cinco enlaces de WhatsApp de la página NACÍAN SIN DIRECCIÓN y
   se las ponía el guion. Con el guion caído —y este archivo ya
   documenta un `null.href` que tumbaba la mitad de la página al
   arrancar— quedaban cinco enlaces que no hacen nada: el cliente
   pica, no pasa nada, y se va.

   Ahora nacen con su `wa.me` escrito en el HTML y el guion lo que
   hace es MEJORARLO con la ficha del viaje. Lo que se pierde si el
   guion falla es la ficha, no la conversación.
   ============================================================ */
titulo('los enlaces de whatsapp sirven aunque el guion no corra');
{
  const index = lee('index.html');

  /* La etiqueta `<a …>` completa de cada uno, tal como sale en el archivo. */
  function etiquetaDe(busca) {
    const i = index.indexOf(busca);
    if (i < 0) return '';
    const abre = index.lastIndexOf('<a', i);
    const cierra = index.indexOf('>', i);
    return abre >= 0 && cierra > abre ? index.slice(abre, cierra + 1) : '';
  }

  const ANCLAS = [
    ['id="wa-flotante"', 'el botón flotante'],
    ['id="send-wa"', 'el «Enviar por WhatsApp» del resumen'],
    ['id="captura-whats"', 'el «Mándanos tu viaje» del acuse']
  ];
  ANCLAS.forEach(function (a) {
    const et = etiquetaDe(a[0]);
    cierto(a[1] + ' nace con su dirección', /href="https:\/\/wa\.me\/\d+/.test(et));
    cierto('  ' + a[1] + ' abre en otra pestaña', /target="_blank"/.test(et));
    cierto('  ' + a[1] + ' lleva rel="noopener"', /rel="noopener"/.test(et));
  });

  /* Los dos fijos —el pie y Contacto— se marcan con `data-wa` y son los que
     el guion rellenaba en bloque. */
  const fijos = index.match(/<a[^>]*\bdata-wa\b[^>]*>/g) || [];
  igual('los dos enlaces fijos siguen ahí', fijos.length, 2);
  igual('  y los dos nacen con su dirección',
    fijos.filter(function (e) { return !/href="https:\/\/wa\.me\/\d+/.test(e); }), []);
  /* El del pie no las tenía: un enlace a WhatsApp que se lleva la pestaña de
     la página es un cliente que pierde su cotización a medio armar. */
  igual('  y los dos abren en otra pestaña, sin prestarle la ventana a nadie',
    fijos.filter(function (e) {
      return !(/target="_blank"/.test(e) && /rel="noopener"/.test(e));
    }), []);

  /* Y el texto por omisión viaja con ellos: «el cliente solo le da enviar». */
  igual('los cinco llevan un mensaje ya escrito',
    (index.match(/href="https:\/\/wa\.me\/\d+\?text=[^"]+"/g) || []).length, 5);
}

/* ============================================================ */
titulo('desde el cotizador, el mensaje lleva la ficha del viaje');
{
  const index = lee('index.html');

  /* Ya existía para el botón «Enviar por WhatsApp» del resumen, y es lo
     que el plan pide también para el flotante: «si viene desde el
     cotizador, el mensaje ya trae la ficha del viaje». */
  cierto('el resumen arma su mensaje con los datos del viaje',
    /send-wa/.test(index) && /encodeURIComponent/.test(index));

  /* El texto se escapa antes de meterlo en la dirección: un destino con
     `&` partiría la liga en dos y el mensaje llegaría cortado. */
  const armador = index.slice(index.indexOf('function ligaWhatsApp('),
    index.indexOf('function ligaWhatsApp(') + 600);
  cierto('la liga escapa el texto', /encodeURIComponent/.test(armador));
}

/* ============================================================
   LA FICHA QUE MANDA EL CLIENTE VA COMPLETA · 15-sep-2026
   ------------------------------------------------------------
   El botón «Mándanos tu viaje por WhatsApp» del acuse y el correo
   que le llega al vendedor son la MISMA ficha vista desde dos
   lados. Llevaban datos distintos —el mensaje se quedaba en ruta,
   fechas, unidad y pasajeros— y es el que abre la conversación:
   es lo primero que el vendedor lee.

   Se comprueba sobre el texto del armador, que es donde vive la
   decisión. `probar-solicitud.cjs` cuida la otra mitad, la del
   servidor, con datos de verdad.
   ============================================================ */
titulo('el mensaje del acuse lleva lo mismo que la ficha del vendedor');
{
  const index = lee('index.html');
  const desde = index.indexOf('function fichaParaWhatsApp(');
  const armador = desde >= 0 ? index.slice(desde, index.indexOf('\n    }', desde)) : '';
  cierto('el armador existe', !!armador);

  [['la ruta', /LOC\.origen\.place\[0\]/],
    ['las fechas', /VIAJE\.salida/],
    ['si es solo ida', /solo ida/],
    ['la unidad', /VIAJE\.unidad\.name/],
    ['cuántos van', /VIAJE\.pasajeros/],
    ['de dónde se recoge · la calle', /LOC\.origen\.calle/],
    ['  la colonia', /LOC\.origen\.col\b/],
    ['  y la referencia', /LOC\.origen\.ref\b/],
    ['si se mueven allá', /MOV\.incluye/],
    ['  y a dónde van esos días', /MOV\.notas/],
    ['su nombre', /f-nombre/],
    ['sus comentarios', /f-notas/]
  ].forEach(function (p) {
    cierto('el mensaje lleva ' + p[0], p[1].test(armador));
  });

  /* Y la otra mitad: que la solicitud que sale al servidor mande esos
     mismos datos. Si solo viajaran en el mensaje de WhatsApp, el vendedor
     que lee el correo seguiría a ciegas. */
  const abre = index.indexOf("accion: 'solicitud'");
  /* Hasta el cierre del cuerpo, no un puñado de caracteres a ojo: los
     comentarios de en medio crecen y una ventana fija se queda corta sin
     avisar —así se puso roja esta prueba cuando ya estaba bien—. */
  const envio = index.slice(abre, index.indexOf('}).then(', abre));
  ['redondo', 'calle', 'colonia', 'referencia', 'movimientos',
    'notasMovimientos', 'notas', 'pasajeros', 'nombre'
  ].forEach(function (campo) {
    cierto('la solicitud al servidor manda `' + campo + '`',
      new RegExp('\\n\\s*' + campo + ':').test(envio));
  });
}

/* ============================================================ */
titulo('el servidor manda al mismo número');
{
  /* `api/_correo.js` mete la liga en el correo del contrato, y también
     tenía el número del teléfono. Allá no hay `config.js`: sale del
     entorno, con el mismo valor por omisión. */
  const correo = lee('api/_correo.js');
  igual('el correo no escribe el número a mano',
    (correo.match(/wa\.me\/\d+/g) || []), []);
  cierto('lo saca del entorno', /WHATSAPP_PUBLICO|process\.env\.WHATSAPP/.test(correo));
}

console.log('\n' + buenas + ' buenas, ' + malas + ' malas');
process.exit(malas ? 1 : 0);
