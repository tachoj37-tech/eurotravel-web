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
  igual('y la del celular también', pestanasDe('tabs-mobile'), 5);
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

console.log('\n' + buenas + ' buenas, ' + malas + ' malas');
process.exit(malas ? 1 : 0);
