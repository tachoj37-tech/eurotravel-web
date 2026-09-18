/* ============================================================
   El recorrido de la página, hecho batería
   ------------------------------------------------------------
       node pruebas/probar-recorrido.cjs

   ESTO NACIÓ DE RECORRER LA PÁGINA A MANO, el 12-sep-2026.

   La fase 0 del plan (`docs/PLAN-DE-LA-PAGINA.md`) pedía abrir la
   página entera con el navegador —las cinco pestañas, todos los
   botones, las fotos, el inicio de sesión con su código y su
   reenvío, el calendario, y en celular además de computadora— y
   «dejarlo escrito como batería, para que no haya que volver a
   recorrerla a mano».

   Esto es esa batería. Cuida lo que el recorrido encontró roto y
   lo que encontró sano, para que ninguna de las dos cosas se
   caiga sin que nadie se entere:

     · Toda unidad que la página enseña tiene una foto QUE EXISTE.
       Dos no la tenían —el G8 y el Century— y salían con el
       ícono de imagen rota en tres lugares distintos.
     · Todo `src="img/…"` y todo `url(img/…)` apuntan a un archivo
       que está en la carpeta.
     · Las cinco pestañas existen y cada una lleva a su vista.
     · El botón «Cotizar esta unidad» dice CUÁL unidad. Los tres
       del inicio no lo decían y abrían el cotizador vacío.
     · Entrar con los campos vacíos no le echa la culpa al cliente
       de un correo que nunca escribió.

   Se lee todo como texto —HTML y JS—: no hacen falta navegador ni
   dependencias, y corre en la misma batería que todo lo demás.
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

const html = fs.readFileSync(path.join(RAIZ, 'index.html'), 'utf8');

/* Los comentarios NO son la página. Si algo se comprueba sobre el texto
   visible, se mira sin ellos: un comentario que explica por qué se quitó
   una frase no puede hacer fallar la prueba que cuida que esté quitada. */
function sinComentarios(s) {
  return s.replace(/<!--[\s\S]*?-->/g, ' ');
}

/* `unidades.js` y `medios-unidades.js` escriben en `window` y no exportan
   —los carga la página con un `<script>`—, así que aquí se les presta uno
   y se les quita al terminar. */
function cargaEnWindow(archivo, llave) {
  const antes = global.window;
  global.window = global.window || {};
  delete require.cache[require.resolve(path.join(RAIZ, archivo))];
  require(path.join(RAIZ, archivo));
  const valor = global.window[llave];
  global.window = antes;
  return valor;
}

const UNIDADES = cargaEnWindow('unidades.js', 'UNIDADES') || [];
const MEDIOS = cargaEnWindow('medios-unidades.js', 'MEDIOS_UNIDADES') || {};

/* `window.IMGS` vive dentro del HTML, en un `<script>` suelto. Se saca de
   ahí en vez de repetir la lista aquí: una copia se desincroniza sola.

   Los comentarios del bloque se quitan antes de leerlo: ahí se explica por
   qué está cada renglón —el del G8 y el del Century cuestan un párrafo— y
   `JSON.parse` no los aguanta. */
function leeIMGS() {
  const m = html.match(/window\.IMGS\s*=\s*(\{[\s\S]*?\n\});/);
  if (!m) return null;
  return JSON.parse(m[1].replace(/\/\*[\s\S]*?\*\//g, ''));
}
const IMGS = leeIMGS();

function existe(rel) {
  return fs.existsSync(path.join(RAIZ, rel));
}

/* ------------------------------------------------------------
   1 · LAS FOTOS DE LAS UNIDADES
   ------------------------------------------------------------
   El recorrido las encontró rotas: `g8` e `irizar` traían un `img`
   que NO estaba en `window.IMGS`, y el HTML se arma con
   `I[u.img] || ''`. Un `src=""` no es una foto que falta: es el
   ícono de imagen rota, y encima el navegador vuelve a pedir la
   página entera creyendo que es una imagen.

   Salían rotas en TRES lugares —la tarjeta de la galería, la
   ficha que abre al picarla, y la tarjeta del resultado del
   cotizador—, o sea en todos los que la enseñan.
   ------------------------------------------------------------ */
igual('window.IMGS se puede leer del HTML', IMGS !== null, true);

/* Dos banderas, dos listas. `soloBot` saca a una unidad de la página entera;
   `soloCotizador` solo de la galería —las variantes de capacidad, como el i6
   de 51, que comparten tarjeta y fotos con su modelo—. La foto propia se le
   exige a la galería, que es la que enseña fotos. El reparto entero lo cuida
   `probar-capacidades.cjs`. */
const EN_LA_PAGINA = UNIDADES.filter(function (u) { return !u.soloBot; });
const QUE_SE_VEN = EN_LA_PAGINA.filter(function (u) { return !u.soloCotizador; });

igual('la galería enseña las unidades que se esperan',
  QUE_SE_VEN.map(function (u) { return u.id; }),
  ['g8', 'irizar-i6s', 'irizar-i6', 'irizar-pb', 'neobus', 'irizar', 'sprinter', 'suburban']);

/* Y el cotizador ofrece además las que comparten tarjeta con su modelo: el
   i6 de 51 y el Century de 49. Son unidades aparte, con su propio precio en
   el Excel, y un grupo de 49 o de 51 tiene que poder pedirlas aunque no
   tengan tarjeta propia. */
igual('y el cotizador ofrece además las de la otra capacidad',
  EN_LA_PAGINA.map(function (u) { return u.id; }),
  ['g8', 'irizar-i6s', 'irizar-i6', 'irizar-i6-51', 'irizar-pb', 'neobus', 'irizar',
    'irizar-49', 'sprinter', 'suburban']);

igual('cada unidad que se enseña tiene su foto en window.IMGS',
  QUE_SE_VEN.filter(function (u) { return !IMGS[u.img]; }).map(function (u) { return u.id; }),
  []);

/* `full` y `seat` son opcionales —la foto grande de la ficha y el mapa de
   asientos—, pero la que se declara tiene que existir. Una clave inventada
   se ve igual de rota que ninguna. */
const CLAVES_SUELTAS = [];
UNIDADES.forEach(function (u) {
  ['full', 'seat'].forEach(function (campo) {
    if (u[campo] && !IMGS[u[campo]]) CLAVES_SUELTAS.push(u.id + '.' + campo + '=' + u[campo]);
  });
});
igual('las fotos grandes y los mapas de asientos apuntan a claves que existen', CLAVES_SUELTAS, []);

igual('cada ruta de window.IMGS existe en la carpeta',
  Object.keys(IMGS || {}).filter(function (k) { return !existe(IMGS[k]); }),
  []);

/* ------------------------------------------------------------
   2 · LAS DEMÁS FOTOS DE LA PÁGINA
   ------------------------------------------------------------
   Las del HTML y las de las hojas de estilo. El recorrido las
   encontró todas sanas —30 peticiones, 30 en 200— y así debe
   seguir: una foto rota en la portada se ve antes que cualquier
   otra cosa.
   ------------------------------------------------------------ */
{
  const visible = sinComentarios(html);

  const enSrc = [];
  let m; const reSrc = /src="(img\/[^"]+)"/g;
  while ((m = reSrc.exec(visible))) enSrc.push(m[1]);
  igual('todo src="img/…" del HTML existe',
    enSrc.filter(function (r) { return !existe(r); }), []);

  const enCss = [];
  let c; const reCss = /url\((img\/[^)]+)\)/g;
  while ((c = reCss.exec(visible))) enCss.push(c[1]);
  igual('todo url(img/…) de los estilos existe',
    enCss.filter(function (r) { return !existe(r); }), []);

  /* Y que sigan estando: si alguien cambia las rutas de golpe, las dos
     pruebas de arriba quedarían verdes sobre una lista vacía. Son pocas
     porque casi todas las fotos se ponen desde `window.IMGS` con JS —ésas
     las cuida el bloque 1—; aquí quedan el fondo de cada banda y la única
     `<img>` escrita a mano. */
  igual('las fotos escritas en el HTML y en los estilos siguen ahí',
    enSrc.length + enCss.length >= 15, true);
}

/* ------------------------------------------------------------
   3 · LAS FOTOS DE LA FICHA DE CADA UNIDAD
   ------------------------------------------------------------
   `medios-unidades.js` dice cuántas tiene cada una. El bot las
   manda por WhatsApp y el chat de la página las enseña: si el
   número no cuadra con lo que hay en la carpeta, se manda una
   foto que no existe.
   ------------------------------------------------------------ */
{
  const faltan = [];
  Object.keys(MEDIOS).forEach(function (id) {
    const cuantas = MEDIOS[id].fotos || 0;
    for (let i = 1; i <= cuantas; i++) {
      const nombre = 'img/unidades/' + id + '/' + id + '-' + String(i).padStart(2, '0') + '.jpg';
      if (!existe(nombre)) faltan.push(nombre);
    }
  });
  igual('las fotos que promete medios-unidades.js están en la carpeta', faltan, []);

  /* La que no tiene fotos propias tiene que decir de quién las presta. Sin
     esto, el bot enseñaría un camión y entregaría otro. */
  igual('el i6 de 51 sigue sin fotos propias y con las prestadas dichas',
    MEDIOS['irizar-i6-51'], { fotos: 0, video: null, prestadas: 'irizar-i6' });
}

/* ------------------------------------------------------------
   4 · LAS CINCO PESTAÑAS
   ------------------------------------------------------------
   Cada pestaña lleva un `data-go="x"` y enseña la sección
   `id="v-x"`. Un `data-go` mal escrito no truena: la pestaña
   simplemente no hace nada, que es lo que menos se nota y peor
   se ve.
   ------------------------------------------------------------ */
{
  const vistas = {};
  let v; const reVista = /<section class="view[^"]*" id="v-([a-z]+)"/g;
  while ((v = reVista.exec(html))) vistas[v[1]] = true;

  igual('las cinco vistas están', Object.keys(vistas).sort(),
    ['contacto', 'cotizar', 'inicio', 'nosotros', 'unidades']);

  const destinos = {};
  let g; const reGo = /data-go="([a-z]+)"/g;
  while ((g = reGo.exec(html))) destinos[g[1]] = true;

  igual('todo data-go apunta a una vista que existe',
    Object.keys(destinos).filter(function (d) { return !vistas[d]; }), []);

  /* Las pestañas están dos veces: la barra de la computadora (`tabs nav-mid`)
     y la del celular (`tabs-mobile`), que se desliza. Las dos tienen que
     llevar las cinco, o en el teléfono se pierde una vista entera. En el
     recorrido se vio que en 375 px «Contacto» queda fuera del borde y hay
     que deslizar la barra para alcanzarla: existe, pero apenas. */
  function pestanasDe(clase) {
    const desde = html.indexOf('class="' + clase + '"');
    if (desde < 0) return -1;
    const hasta = html.indexOf('</div>', desde);
    return (html.slice(desde, hasta).match(/class="tab( on)?"/g) || []).length;
  }
  igual('la barra de la computadora lleva las cinco pestañas', pestanasDe('tabs nav-mid'), 5);
  /* En el celular son cuatro internas: la quinta ranura la ocupa «Abonar»,
     que es liga a viaje.html (17-sep-2026). «Nosotros» sigue en escritorio. */
  igual('y la del celular, cuatro más la de Abonar', pestanasDe('tabs-mobile'), 4);
}

/* ------------------------------------------------------------
   5 · «COTIZAR ESTA UNIDAD» DICE CUÁL UNIDAD
   ------------------------------------------------------------
   El recorrido encontró los tres botones del inicio —autobuses,
   Sprinter y Suburban— abriendo el cotizador CON EL SELECTOR
   VACÍO. El botón promete «esta unidad» y no la llevaba; el de la
   ficha de la galería sí, así que el cliente ve dos comportamientos
   distintos con el mismo texto.
   ------------------------------------------------------------ */
{
  const botones = html.match(/<button[^>]*class="linea-cta"[^>]*>/g) || [];
  igual('siguen siendo tres bandas de unidad en el inicio', botones.length, 3);

  const sinUnidad = botones.filter(function (b) { return !/data-unidad="/.test(b); });
  igual('cada «Cotizar esta unidad» del inicio dice cuál unidad', sinUnidad, []);

  const ids = UNIDADES.map(function (u) { return u.id; });
  const inventadas = botones
    .map(function (b) { const m = b.match(/data-unidad="([^"]+)"/); return m && m[1]; })
    .filter(function (id) { return id && ids.indexOf(id) < 0; });
  igual('y esa unidad existe en el catálogo', inventadas, []);
}

/* ------------------------------------------------------------
   6 · ENTRAR NO LE ECHA LA CULPA AL CLIENTE
   ------------------------------------------------------------
   Con los DOS campos vacíos, «Entrar» mandaba la petición y
   contestaba «Ese correo o esa contraseña no son». No escribió
   ninguno de los dos: el mensaje era falso, y de paso gastaba una
   petición del freno por IP.

   Crear cuenta y «olvidé mi contraseña» ya lo hacían bien —avisan
   y no mandan nada—. Esto cuida que los tres sigan igual.
   ------------------------------------------------------------ */
{
  function bloqueDe(boton, accion) {
    const desde = html.indexOf("byId('" + boton + "').addEventListener");
    if (desde < 0) return null;
    const hasta = html.indexOf("pideCuenta('" + accion + "'", desde);
    if (hasta < 0) return null;
    return html.slice(desde, hasta);
  }

  /* Son DOS «Entrar»: el del modal de la barra y el de la pantalla de pago.
     Los dos tenían el mismo defecto, así que los dos se cuidan. */
  [['cta-e-entrar', 'el del modal de la barra'], ['ent-entrar', 'el de la pantalla de pago']]
    .forEach(function (par) {
      const bloque = bloqueDe(par[0], 'entrar');
      igual('«Entrar» ' + par[1] + ': el manejador se encuentra', bloque !== null, true);
      igual('«Entrar» ' + par[1] + ': avisa del correo vacío antes de mandar nada',
        /Escribe tu correo/.test(bloque || ''), true);
      igual('«Entrar» ' + par[1] + ': y también de la contraseña vacía',
        /Escribe tu contraseña/.test(bloque || ''), true);
    });

  const crear = bloqueDe('cta-a-crear', 'crear');
  igual('«Crear mi cuenta» sigue avisando antes de mandar',
    /Escribe tu nombre/.test(crear || '') && /Escribe tu correo/.test(crear || ''), true);

  const olvide = bloqueDe('cta-o-mandar', 'olvide');
  igual('«Olvidé mi contraseña» sigue avisando antes de mandar',
    /Escribe tu correo/.test(olvide || ''), true);
}

/* ------------------------------------------------------------
   7 · EL CÓDIGO DEL CORREO
   ------------------------------------------------------------
   Seis casillas en las tres pantallas que piden código —ya lo
   cuida `probar-pantallas.cjs`—, y el botón de confirmar no manda
   un código a medias: el servidor solo aguanta cinco intentos
   (`probar-acceso.cjs`), y uno gastado por tres dígitos tecleados
   es un intento que el cliente pierde sin haberse equivocado.
   ------------------------------------------------------------ */
{
  /* Las tres pantallas que piden código: la de pago, la del modal de la
     barra, y la de la contraseña nueva. */
  const PANTALLAS = [
    ['cod-confirmar', 'confirmar'],
    ['cta-c-confirmar', 'confirmar'],
    ['cta-n-guardar', 'clave-nueva']
  ];
  PANTALLAS.forEach(function (par) {
    const desde = html.indexOf("byId('" + par[0] + "').addEventListener");
    const hasta = html.indexOf("pideCuenta('" + par[1] + "'", desde);
    const bloque = desde < 0 || hasta < 0 ? null : html.slice(desde, hasta);
    igual(par[0] + ': el manejador se encuentra', bloque !== null, true);
    igual(par[0] + ': no manda el código incompleto',
      /length\s*!==?\s*6|length\s*<\s*6/.test(bloque || ''), true);
  });
}

/* ------------------------------------------------------------
   8 · UN TELÉFONO QUE NO ES UN TELÉFONO NO PASA
   ------------------------------------------------------------
   La fase 0 lo encontró y lo dejó anotado: en el paso de «Tus datos» se
   podía escribir **12** como teléfono y **no-es-correo** como correo, y el
   formulario pasaba al resumen tan contento. `validaDatos()` solo miraba
   que el campo no estuviera vacío.

   Se dijo entonces que se arreglaba en la fase 2, y se arregló A MEDIAS:
   la caja de captura nueva —la del viaje sin precio— sí valida, pero este
   formulario, que es el que lleva a APARTAR CON DINERO, se quedó igual.
   Ése es el camino que trae pago, así que es el que menos podía quedarse.

   Y no es un detalle de forma: el teléfono es por donde le escribe el
   vendedor. Mal escrito, es un cliente perdido con el viaje ya armado.

   LAS DOS REGLAS SON UNA SOLA, a propósito: `telefonoBueno` y
   `correoBueno` los usan los DOS formularios. Dos reglas separadas se
   separan más, y entonces un teléfono que pasa en una pantalla se rechaza
   en la otra.
   ------------------------------------------------------------ */
{
  /* Los ayudantes existen y son de verdad compartidos. */
  igual('hay una sola regla para el teléfono',
    (html.match(/function telefonoBueno\(/g) || []).length, 1);
  igual('y una sola para el correo',
    (html.match(/function correoBueno\(/g) || []).length, 1);

  /* Cortar entre dos marcas que quizá no existen devuelve basura o revienta,
     y entonces el rojo no se puede leer entero — que es justo para lo que
     sirve un rojo. Si falta cualquiera de las dos, se devuelve vacío y cada
     aserción falla por su cuenta, diciendo lo suyo. */
  function entre(desde, hasta) {
    const a = html.indexOf(desde);
    if (a < 0) return '';
    const b = html.indexOf(hasta, a);
    return b > a ? html.slice(a, b) : '';
  }

  /* El de diez dígitos, que es lo que es un teléfono en México. */
  const tel = entre('function telefonoBueno(', 'function correoBueno(');
  cierto('el teléfono se cuenta a diez dígitos', /length === 10/.test(tel));
  /* Y se aceptan los adornos con los que la gente los escribe. */
  cierto('  quitando lo que no es dígito', /replace\(\/\\D\/g/.test(tel));

  /* El formulario que lleva al pago los usa. */
  const valida = entre('function validaDatos()', '#paso-datos .field[data-req] input');
  cierto('el manejador de «Tus datos» se encuentra', !!valida);
  cierto('«Tus datos» revisa el teléfono, no solo que esté lleno',
    /telefonoBueno\(/.test(valida));
  cierto('  y el correo por la regla de siempre', /motivoDelCorreo\(/.test(valida));

  /* La forma del correo se sigue revisando, solo que desde su ayudante: un
     correo con dedazo es peor que ninguno, porque el vendedor cree que tiene
     por dónde escribir y nadie se entera de que no llegó. */
  const motivoCorreo = entre('function motivoDelCorreo()', 'function validaDatos()');
  cierto('el ayudante del correo se encuentra', !!motivoCorreo);
  cierto('  y usa la regla compartida de la forma', /correoBueno\(/.test(motivoCorreo));

  /* ------------------------------------------------------------
     Y CUANDO EL VIAJE SE PAGA EN LÍNEA, EL CORREO SÍ ES OBLIGATORIO
     ------------------------------------------------------------
     16-sep-2026, recorriendo producción: Sprinter, Guadalajara →
     Chapala, 12 pasajeros, precio en pantalla. El formulario pedía el
     correo como opcional —sin asterisco y sin `required`—, «Ver
     resumen» lo dejó pasar vacío, y dos pantallas después «Pagar
     anticipo» contestó un «Revisa tu correo.» pegado al botón: lejos
     del campo y sin decir por qué.

     No era manía del servidor: por ese correo van el folio, el
     contrato y el recibo del pago, y Stripe lo pide para el suyo. Lo
     que estaba mal era la pantalla, que lo pedía como si diera igual.

     Por el camino del asesor —camiones y Suburban— sigue siendo
     opcional: ahí basta con el WhatsApp, y así lo pidió el dueño.
     ------------------------------------------------------------ */
  const MOTIVO =
    'Necesitamos tu correo: ahí te llegan el folio, el contrato y el recibo del pago.';
  igual('el motivo del correo se escribe una sola vez',
    html.split(MOTIVO).length - 1, 1);

  igual('hay una sola regla de cuándo el correo es obligatorio',
    (html.match(/function correoObligatorio\(/g) || []).length, 1);
  cierto('  y sale de la misma que decide si se cotiza en línea',
    /function correoObligatorio\(\)[^]{0,600}cotizaEnAutomatico\(\)/.test(html));
  cierto('  el ayudante del correo la consulta antes de dejar pasar el vacío',
    /correoObligatorio\(\)/.test(motivoCorreo));

  /* El asterisco y el `required` los pone el guion, porque el mismo
     formulario sirve a los dos caminos. Nace sin ellos: si el guion no
     corriera, pedir de más deja fuera a quien sí podía pasar. */
  cierto('el formulario no marca el correo obligatorio de nacimiento',
    !/data-req[^]*f-mail/.test(html.slice(
      html.indexOf('id="f-mail"') - 200, html.indexOf('id="f-mail"'))));
  const marca = entre('function marcaCorreo()', 'function motivoDelCorreo()');
  cierto('el marcador del correo se encuentra', !!marca);
  cierto('  pone el asterisco en la etiqueta', /Correo electrónico' \+ \(obliga/.test(marca));
  cierto('  y el `required` en el campo', /setAttribute\('required'/.test(marca));
  cierto('  y lo quita por el camino del asesor', /removeAttribute\('required'/.test(marca));
  cierto('  y se marca al entrar a «Tus datos»',
    /marcaCorreo\(\);[^]{0,400}verPantalla\('paso-datos'\)/.test(html));

  /* Y el botón de pagar no vuelve a mandar un correo vacío para que el
     servidor conteste por él. El 400 de /api/pagar sigue ahí —es la última
     raya—, pero quien lo dice primero es la pantalla, en el campo. */
  const pagar = entre("byId('pago-ir').addEventListener", "fetch('/api/pagar'");
  cierto('el botón de pagar se encuentra', !!pagar);
  cierto('  y revisa el correo antes de mandar nada', /motivoDelCorreo\(/.test(pagar));
  cierto('  avisando con el motivo, no con un «Revisa tu correo.» pelón',
    /pideElCorreo\(/.test(pagar));
  const pide = entre('function pideElCorreo(', 'function marcaCorreo()');
  cierto('el aviso del correo se encuentra', !!pide);
  cierto('  regresa a la pantalla donde está el campo',
    /verPantalla\('paso-datos'\)/.test(pide));
  cierto('  y le pone el cursor encima', /\.focus\(\)/.test(pide));

  /* Y la caja de captura de la fase 2 usa los MISMOS, no una copia. */
  const captura = entre('function mandaSolicitud()', "byId('captura-ir').addEventListener");
  cierto('la caja de captura usa la misma regla del teléfono',
    /telefonoBueno\(/.test(captura));
  cierto('  y la misma del correo', /correoBueno\(/.test(captura));

  /* Que no queden reglas sueltas: la cuenta de diez dígitos y la forma del
     correo se escriben UNA vez cada una, dentro de su ayudante. */
  igual('la cuenta de diez dígitos no está repetida por ahí',
    (html.match(/length === 10|length !== 10/g) || []).length, 1);

  /* ------------------------------------------------------------
     Y EL MENSAJE DE «ESTÁ VACÍO» NO SE PIERDE
     ------------------------------------------------------------
     Cazado probando la pantalla, y lo había metido este mismo cambio:
     al escribir un teléfono mal y luego BORRARLO, el renglón se quedaba
     diciendo «ese teléfono no se entiende» sobre un campo vacío — que no
     es lo que le pasa a esa persona—. El mensaje del HTML se pisaba y ya
     no volvía.

     Se guarda el original la primera vez que se toca.
     ------------------------------------------------------------ */
  cierto('el mensaje original del campo se guarda antes de pisarlo',
    /dataset\.original/.test(valida));
  cierto('  y se usa cuando el campo está vacío',
    /texto \|\| msg\.dataset\.original/.test(valida));
}

/* ============================================================
   EL DÍA DEL CALENDARIO, EN CELULAR, SE PUEDE TOCAR
   ------------------------------------------------------------
   13-sep-2026. Salió de recorrer la página en celular de verdad:
   el calendario abre bien y cabe —345 px de 375— pero cada día
   medía **36 × 34 px**. La guía de Apple y la de Google coinciden
   en **44 × 44** para algo que se toca con el dedo.

   No rompía nada, y por eso ninguna prueba lo veía. Pero la fecha
   es paso obligado del cotizador y es **el dato que más cuesta
   corregir después**: un dedazo elige el día de junto, el cliente
   no lo nota, y el viaje se arma con la fecha equivocada.

   Con un ratón 36 px sobran, así que el tamaño grande va SOLO en
   el corte de celular —donde además ya se esconde el segundo mes
   y sobra ancho: 7 × 44 = 308 px dentro de los 345 del globo—.
   ============================================================ */
{
  const css = html.slice(html.indexOf('.cal-mes {'), html.indexOf('.cal-dia:not(.apagado):hover'));

  /* El bloque de celular que trae los TAMAÑOS. Se busca por su contenido y
     no por «el último @media», porque ya son dos bloques de este corte.
     Y sin pegar saltos de línea al patrón: este archivo va con CRLF. */
  const iTam = (html.match(/@media \(max-width: 680px\)\s*\{\s*\.cal-mes \{ grid-template-columns/) || {}).index;
  const enCelular = iTam === undefined ? '' : html.slice(iTam, iTam + 700);

  /* En computadora se queda como estaba. */
  cierto('en computadora el día sigue midiendo lo de siempre',
    /grid-template-columns: repeat\(7, 36px\)/.test(css));

  const columnas = Number((enCelular.match(/\.cal-mes\s*\{[^}]*repeat\(7,\s*(\d+)px\)/) || [])[1]);
  const alto = Number((enCelular.match(/\.cal-dia\s*\{[^}]*height:\s*(\d+)px/) || [])[1]);

  cierto('en celular la columna llega a los 44 px del dedo', columnas >= 44);
  cierto('  y el alto también', alto >= 44);

  /* Y que no se pase: siete columnas tienen que seguir cabiendo en el
     globo, que en un teléfono de 375 mide 345. */
  cierto('  sin que las siete dejen de caber', columnas * 7 <= 345);

  /* ------------------------------------------------------------
     Y EL BOTÓN FLOTANTE NO SE COME UN DÍA
     ------------------------------------------------------------
     Salió de medirlo con el calendario abierto en el teléfono: el
     flotante de WhatsApp es `fixed` abajo a la derecha, el
     calendario scrollea por debajo, y en cierta posición quedaban
     encima. Se comprobó con `elementFromPoint` sobre el centro del
     día 6: quien recibía el toque era `SPAN.wa-fab-icono`.

     O sea que el cliente tocaba un domingo y le abría WhatsApp —y
     los domingos son justo los viajes de fin de semana—. No es del
     tamaño del día: con 36 px pasaba igual, solo que más abajo.

     Un botón flotante no compite con un diálogo abierto. Mientras
     el calendario esté abierto, el flotante se quita.
     ------------------------------------------------------------ */
  cierto('el flotante se esconde con el calendario abierto',
    /:has\(\.cal\.on\)[^{]*\{[^}]*display:\s*none/.test(html) ||
    /cal-abierto/.test(html));

  /* ------------------------------------------------------------
     Y LA BANDA DEL RANGO SIGUE CUADRANDO CON EL CÍRCULO
     ------------------------------------------------------------
     Esto lo METIÓ el cambio de tamaño y se vio midiendo un rango de
     verdad en el teléfono: la banda rosa de los días intermedios se
     dibuja con `::before` pegado a la celda —`top` y `bottom` de 1 px—
     así que creció con la celda, a 42. El círculo del día se quedó en
     38, y la banda sobresalía 4 px arriba y abajo.

     Antes cuadraban exactos —celda 34, banda 32, círculo 32— y esa es
     la invariante que hay que sostener: BANDA = CÍRCULO. Si no, el
     rango se ve como una cinta mal recortada detrás de los días.
     ------------------------------------------------------------ */
  const circulo = Number((enCelular.match(/\.cal-dia span\s*\{[^}]*height:\s*(\d+)px/) || [])[1]);

  /* El ajuste de la banda vive en SU PROPIO bloque de celular, y dónde está
     importa: ver abajo. */
  const mBanda = html.match(/@media \(max-width: 680px\)\s*\{\s*\.cal-dia\.dentro::before[\s\S]{0,200}?top:\s*(\d+)px/);
  const iBanda = mBanda ? mBanda.index : -1;
  const margen = mBanda ? Number(mBanda[1]) : NaN;

  cierto('en celular el círculo del día crece con la celda', circulo >= 40);
  cierto('  y la banda del rango mide lo mismo que el círculo',
    Number.isFinite(margen) && (alto - margen * 2) === circulo);

  /* ------------------------------------------------------------
     Y EL AJUSTE DE LA BANDA VA DESPUÉS DE LA REGLA QUE CORRIGE
     ------------------------------------------------------------
     Esto no es manía de orden: la primera versión puso el ajuste dentro
     del bloque de tamaños, ARRIBA de la regla base. Misma especificidad,
     y las medias consultas NO suman especificidad — así que ganaba la de
     abajo y la banda seguía saliéndose.

     Y la prueba de texto pasaba igual, porque la declaración sí existía.
     Lo cazó medirlo en el navegador. Por eso aquí se exige el orden: es
     lo único que un archivo puede comprobar de esto.
     ------------------------------------------------------------ */
  const iBase = html.indexOf('/* la franja que une las dos fechas */');
  cierto('  y el ajuste va DESPUÉS de la regla base, o no surte efecto',
    iBase !== -1 && iBanda !== -1 && iBanda > iBase);
}

console.log('\n' + buenas + ' buenas, ' + malas + ' malas');
process.exit(malas ? 1 : 0);
