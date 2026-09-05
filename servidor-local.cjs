/* ============================================================
   Servidor local, para probar sin publicar
   ------------------------------------------------------------
       node servidor-local.cjs        (o `npm start`)
       -> http://localhost:3000

   Este proyecto no tenía forma de correrse en la computadora: se
   probaba publicando en Vercel y mirando. Eso está bien para lo
   de siempre, pero para ir puliendo el bot mensaje por mensaje es
   carísimo — cada prueba es un despliegue.

   Esto imita lo que hace Vercel, y nada más:

     · sirve los archivos sueltos de la carpeta
     · `/api/loquesea` -> corre `api/loquesea.js`
     · les presta a los `res` los métodos que Vercel les pone
       (`status`, `json`, `send`), que Node por su cuenta no trae

   NO es Vercel y no pretende serlo. Lo que aquí funcione todavía
   hay que verlo publicado; lo que aquí truene, ya truena.

   ------------------------------------------------------------
   LO QUE NO VA A FUNCIONAR EN LOCAL, Y ESTÁ BIEN
   ------------------------------------------------------------
   · Cotizar un destino que NO esté en la lista necesita medir con
     Google, y para eso hace falta `GOOGLE_ROUTES_KEY`. Los de la
     lista —Chapala, Tequila, Vallarta…— cotizan sin llave, porque
     su precio es cerrado. Para probar el bot sobra.
   · Cobrar necesita Stripe. Ni se intente.
   · Las llaves NO se ponen aquí. Si hiciera falta una, se pasa por
     el entorno al arrancar y no se escribe en ningún archivo.
   ============================================================ */

'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

const RAIZ = __dirname;

/* ------------------------------------------------------------
   EL PUERTO ES 5175, Y NO ES CAPRICHO
   ------------------------------------------------------------
   `api/_defensas.js` solo deja entrar peticiones que vengan de un
   origen de su lista, y el único de desarrollo que trae es
   `http://localhost:5175`. En cualquier otro puerto, `/api/cotizar`
   contesta 403 y el bot dice «no pude sacar el precio».

   Se comprobó en carne propia: arrancado en el 3000, la
   conversación entera funcionaba y el precio moría en 403.

   Se cambia el puerto AQUÍ y no la lista de allá. Esa lista es una
   defensa: aflojarla para que un servidor de pruebas sea cómodo es
   exactamente cómo se abren los huecos.
   ------------------------------------------------------------ */
const PUERTO = Number(process.env.PORT) || 5175;

/* Lo que Vercel no publica —está en `.vercelignore`— tampoco se
   sirve aquí. Si en local se pudiera abrir `cerebro/`, se probaría
   una página que en producción no existe. */
/* `pendiente/` SI se sirve en local, y es la unica que se aparta de la
   regla de imitar a Vercel. Ahi vive codigo terminado que todavia no
   sale al aire —el webhook de WhatsApp, la prueba del cotizador— y
   poder abrirlo aqui es justamente para lo que se guardo. `cerebro/` y
   `docs/` no: esos son texto, no paginas. */
const PROHIBIDAS = ['pruebas', 'cerebro', 'docs', 'node_modules', '.git'];

const TIPOS = {
  '.html': 'text/html; charset=utf-8',
  '.js':   'text/javascript; charset=utf-8',
  '.cjs':  'text/javascript; charset=utf-8',
  '.css':  'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.jpg':  'image/jpeg',  '.jpeg': 'image/jpeg',
  '.png':  'image/png',   '.webp': 'image/webp',
  '.svg':  'image/svg+xml',
  '.ico':  'image/x-icon',
  '.woff2': 'font/woff2'
};

/* ------------------------------------------------------------
   LOS MÉTODOS QUE VERCEL LE PRESTA AL `res`
   ------------------------------------------------------------
   Las funciones de `api/` están escritas contra el `res` de
   Vercel, que trae `status().json()` encadenables. El `res` pelón
   de Node no los tiene, así que se los ponemos.
   ------------------------------------------------------------ */
function vistiendo(res) {
  res.status = function (codigo) { res.statusCode = codigo; return res; };
  res.json = function (dato) {
    if (!res.getHeader('Content-Type')) res.setHeader('Content-Type', TIPOS['.json']);
    res.end(JSON.stringify(dato));
    return res;
  };
  res.send = function (cuerpo) {
    if (cuerpo && typeof cuerpo === 'object') return res.json(cuerpo);
    res.end(cuerpo == null ? '' : String(cuerpo));
    return res;
  };
  res.redirect = function (codigo, destino) {
    if (typeof codigo === 'string') { destino = codigo; codigo = 302; }
    res.statusCode = codigo;
    res.setHeader('Location', destino);
    res.end();
    return res;
  };
  return res;
}

/* El cuerpo se junta entero antes de llamar a la función, porque
   Vercel se lo entrega ya leído en `req.body`. Se corta a 1 MB: en
   local nadie sube archivos, y sin tope un `curl` distraído deja
   el servidor comiendo memoria. */
function leeCuerpo(req) {
  return new Promise(function (resuelve, rechaza) {
    let crudo = '';
    let tamano = 0;
    req.on('data', function (t) {
      tamano += t.length;
      if (tamano > 1048576) { rechaza(new Error('cuerpo demasiado grande')); req.destroy(); return; }
      crudo += t;
    });
    req.on('end', function () {
      if (!crudo) return resuelve(undefined);
      const tipo = String(req.headers['content-type'] || '');
      if (tipo.includes('application/json')) {
        try { return resuelve(JSON.parse(crudo)); }
        catch (e) { return resuelve(crudo); }   // que la función decida qué hacer con basura
      }
      resuelve(crudo);
    });
    req.on('error', rechaza);
  });
}

/* ------------------------------------------------------------
   QUE NO SE PUEDA SALIR DE LA CARPETA
   ------------------------------------------------------------
   Antes esto revisaba que ninguna parte de la ruta fuera `..`.
   Eso enumera trucos, y enumerar trucos siempre se queda corto:
   en Windows `path.join` normaliza también las diagonales
   invertidas, así que `\..\..\` podía colarse por un filtro que
   solo miraba `/`.

   Lo cazó una revisión de seguridad el 2-sep-2026, y en vez de
   taparle ese agujero se cambió el planteamiento: **se resuelve
   la ruta final y se comprueba que siga estando dentro.** Ya no
   importa con qué encoding, con qué diagonal ni con cuántos
   niveles lo intenten — si el archivo no está bajo la carpeta,
   no se sirve.

   Es un servidor de pruebas, sí. Pero corre en la máquina del
   dueño, sirviendo su disco, y una página abierta en otra pestaña
   puede llamarle.
   ------------------------------------------------------------ */
function rutaSegura(rel) {
  if (rel.includes('\0')) return null;

  const destino = path.resolve(RAIZ, '.' + (rel.startsWith('/') ? rel : '/' + rel));
  const raiz = path.resolve(RAIZ);

  /* `path.relative` dice cómo llegar de la raíz al destino. Si empieza
     con `..`, es que quedó FUERA. Y se compara con el separador del
     sistema, no a mano. */
  const desdeLaRaiz = path.relative(raiz, destino);
  if (desdeLaRaiz.startsWith('..') || path.isAbsolute(desdeLaRaiz)) return null;

  /* Y ya adentro, las carpetas que Vercel tampoco publica. */
  const primera = desdeLaRaiz.split(path.sep)[0];
  if (PROHIBIDAS.includes(primera)) return null;

  return destino;
}

const servidor = http.createServer(async function (req, res) {
  vistiendo(res);
  const pedido = url.parse(req.url, true);
  let rel = decodeURIComponent(pedido.pathname);

  /* ------------------------------------------------------------
     GUARDAR UNA IMAGEN HECHA EN EL NAVEGADOR
     ------------------------------------------------------------
     Existe por una necesidad concreta: la ficha bancaria se diseña
     en HTML y hay que convertirla a PNG para que el bot la mande.
     El dibujo lo hace el navegador —no hay ImageMagick en esta
     máquina— y el archivo tiene que aterrizar en `img/`.

     SOLO ESCRIBE DENTRO DE `img/` Y SOLO SI EL SERVIDOR CORRE EN
     LOCAL. Las dos cosas son candados a propósito:

       · El nombre se limpia a letras, números y guiones, y se le
         pega la extensión aquí. Sin eso, un nombre con `..` podría
         escribir donde se le antoje — ya se pagó esa lección en
         este mismo archivo con la lectura de rutas.
       · Este servidor es de PRUEBAS y `.vercelignore` no lo sube,
         pero aun así se comprueba: una puerta que escribe archivos
         no puede depender de que alguien recuerde no publicarla.
     ------------------------------------------------------------ */
  if (req.method === 'POST' && rel === '/guardar-imagen') {
    const local = /^(127\.0\.0\.1|::1|::ffff:127\.0\.0\.1)$/.test(req.socket.remoteAddress || '');
    if (!local) { res.statusCode = 403; return res.end('solo en local'); }

    let crudo = '';
    req.on('data', function (t) {
      crudo += t;
      if (crudo.length > 12 * 1024 * 1024) { req.destroy(); }
    });
    req.on('end', function () {
      try {
        const cuerpo = JSON.parse(crudo);
        const limpio = String(cuerpo.nombre || '').replace(/[^a-z0-9-]/gi, '');
        if (!limpio) { res.statusCode = 400; return res.end('nombre invalido'); }
        const destino = path.join(RAIZ, 'img', limpio + '.png');
        fs.writeFileSync(destino, Buffer.from(String(cuerpo.png || ''), 'base64'));
        console.log('  guardada img/' + limpio + '.png (' +
          Math.round(fs.statSync(destino).size / 1024) + ' KB)');
        res.statusCode = 200;
        res.end(JSON.stringify({ ok: true, archivo: 'img/' + limpio + '.png' }));
      } catch (e) {
        res.statusCode = 400;
        res.end('no se pudo: ' + e.message);
      }
    });
    return;
  }

  /* ---- las funciones ---- */
  if (rel.startsWith('/api/')) {
    const nombre = rel.slice(5).replace(/\/+$/, '');
    /* Los que empiezan con guion bajo son ayudantes compartidos, no
       funciones: Vercel tampoco los publica. */
    if (!/^[a-z0-9-]+$/i.test(nombre) || nombre.startsWith('_')) {
      return res.status(404).json({ error: 'no existe' });
    }
    const archivo = path.join(RAIZ, 'api', nombre + '.js');
    if (!fs.existsSync(archivo)) return res.status(404).json({ error: 'no existe' });

    try {
      /* Se recarga en cada petición para no tener que reiniciar el
         servidor cada vez que se toca un archivo. */
      delete require.cache[require.resolve(archivo)];
      Object.keys(require.cache).forEach(function (k) {
        if (k.includes(path.join(RAIZ, 'api'))) delete require.cache[k];
      });
      const fn = require(archivo);
      req.query = pedido.query || {};
      req.body = await leeCuerpo(req);
      await (fn.default || fn)(req, res);
    } catch (e) {
      console.error('  ✗ /api/' + nombre + ' tronó:', e.message);
      if (!res.headersSent) res.status(500).json({ error: e.message });
    }
    console.log('  ' + req.method + ' ' + rel + ' -> ' + res.statusCode);
    return;
  }

  /* ---- los archivos ---- */
  if (rel === '/') rel = '/index.html';

  let archivo = rutaSegura(rel);
  if (!archivo) return res.status(403).send('no');

  if (!fs.existsSync(archivo) && fs.existsSync(archivo + '.html')) archivo += '.html';
  if (!fs.existsSync(archivo) || fs.statSync(archivo).isDirectory()) {
    /* La ruta pedida se escribe en la CONSOLA, no en la respuesta.
       Devolverla al navegador era reflejar lo que mandó quien llama —
       o sea, dejarle meter etiquetas en una página de este servidor.
       Lo marcó la revisión de seguridad del 2-sep-2026. */
    console.log('  404 ' + rel);
    return res.status(404).send('No existe');
  }

  res.setHeader('Content-Type', TIPOS[path.extname(archivo).toLowerCase()] || 'application/octet-stream');
  fs.createReadStream(archivo).pipe(res);
});

servidor.listen(PUERTO, function () {
  console.log('');
  console.log('  Eurotravel, en local');
  console.log('  ---------------------------------------------');
  console.log('  La página      http://localhost:' + PUERTO + '/');
  console.log('  Probar el bot  http://localhost:' + PUERTO + '/prueba-bot.html');
  console.log('');
  if (!process.env.GOOGLE_ROUTES_KEY) {
    console.log('  Sin GOOGLE_ROUTES_KEY: solo cotizan los destinos de la lista.');
    console.log('  Para el bot sobra — Chapala, Tequila, Vallarta y los demás.');
    console.log('');
  }
});
