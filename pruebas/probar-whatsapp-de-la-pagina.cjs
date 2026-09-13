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
    const texto = lee(archivo);
    const encontrados = texto.match(/wa\.me\/\d+/g) || [];
    encontrados.forEach(function (u) { aMano.push(archivo + ' → ' + u); });
  });
  igual('ningún archivo del navegador escribe el número a mano', aMano, []);

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
