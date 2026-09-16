/* ============================================================
   Que las pantallas estén sanas
   ------------------------------------------------------------
       node pruebas/probar-pantallas.cjs

   ESTO NACIO DE UN ID REPETIDO, el 26-ago-2026.

   Al meter la bifurcación «invitado o cuenta» le puse `id="caminos"`
   al bloque nuevo. Ya había una sección con ese id en la portada
   —«Tres caminos, la misma respuesta el mismo día»— y dos ids
   iguales NO son un detalle de estilo: `getElementById` devuelve el
   PRIMERO que encuentra. Cualquier guion que buscara el bloque de
   la cuenta habría terminado hablándole a una banda de la portada.

   Lo cazó una medición en el navegador, de casualidad, porque el
   bloque medía cero. Con otro id habría pasado desapercibido hasta
   que un cliente reportara que el botón no hace nada.

   Estas pruebas leen el HTML como texto: no hacen falta navegador
   ni dependencias, y corren en la misma batería que todo lo demás.
   ============================================================ */
'use strict';
const fs = require('fs');
const path = require('path');

let buenas = 0, malas = 0;
function igual(nombre, dio, esperado) {
  const a = JSON.stringify(dio), b = JSON.stringify(esperado);
  if (a === b) { buenas++; console.log('ok   ' + nombre); }
  else { malas++; console.log('MAL  ' + nombre + '\n     dio      ' + a + '\n     esperaba ' + b); }
}
function cierto(nombre, v) { igual(nombre, !!v, true); }

const PAGINAS = ['index.html', 'viaje.html', 'prueba-cotizador.html'];

/* Un `byId` puede apuntar a algo que ya no existe SIN ser un error, cuando el
   código lo espera y se protege. Cada excepción va aquí con su motivo, para
   que la lista se lea y no se acumule sola. Un huérfano NUEVO sí falla: ése
   suele ser un id mal escrito, y ésos no truenan al cargar sino cuando el
   cliente le pica. */
const HUERFANOS_A_PROPOSITO = {
  'index.html': {
    slides: 'el inicio nuevo no trae carrusel; el código lo comprueba antes de usarlo',
    dots: 'lo mismo que slides'
  }
};

/* Los comentarios NO cuentan como texto de la página. La primera versión de
   esta prueba se puso roja por los comentarios que explicaban justamente que
   ese texto ya se había quitado. */
function sinComentarios(html) {
  return html.replace(/<!--[\s\S]*?-->/g, ' ');
}

PAGINAS.forEach(function (nombre) {
  const ruta = path.join(__dirname, '..', nombre);
  if (!fs.existsSync(ruta)) return;      // prueba-cotizador se borra al lanzar
  const html = fs.readFileSync(ruta, 'utf8');

  /* --- ningún id repetido --- */
  const cuenta = {};
  let m; const re = /\bid="([^"]+)"/g;
  while ((m = re.exec(html))) cuenta[m[1]] = (cuenta[m[1]] || 0) + 1;
  const repetidos = Object.keys(cuenta).filter(function (k) { return cuenta[k] > 1; });
  igual(nombre + ': ningún id repetido', repetidos, []);

  /* --- que cada `byId('algo')` del guion apunte a un id que existe ---
     Un id mal escrito no truena al cargar: truena cuando el cliente le pica,
     que es el peor momento para enterarse. */
  const usados = {};
  let u; const reUso = /byId\(\s*'([^']+)'\s*\)/g;
  while ((u = reUso.exec(html))) usados[u[1]] = true;
  const perdonados = HUERFANOS_A_PROPOSITO[nombre] || {};
  const huerfanos = Object.keys(usados).filter(function (id) {
    return !cuenta[id] && !perdonados[id];
  });
  igual(nombre + ': todo byId() apunta a un id que existe', huerfanos, []);
});

/* --- y que la bifurcación de cuenta siga completa ---
   Si alguien borra una caja sin querer, el flujo se rompe en silencio: el
   botón queda pero no abre nada. */
{
  const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  const necesarios = [
    'cuenta-caminos', 'camino-invitado', 'camino-cuenta', 'caminos-dentro',
    'caja-alta', 'cta-clave', 'cta-crear', 'caja-entrar', 'ent-correo',
    'ent-clave', 'ent-entrar', 'caja-codigo', 'cod-casillas', 'cod-confirmar',
    'cod-otro', 'camino-salir',
    /* Google. Las cajas tienen que existir aunque nazcan escondidas: si
       alguien las borra, el botón no se dibuja y nadie se entera hasta que
       un cliente pregunte por qué no ve Google. */
    'g-alta', 'g-alta-boton', 'g-entrar', 'g-entrar-boton'
  ];
  const faltan = necesarios.filter(function (id) {
    return html.indexOf('id="' + id + '"') < 0;
  });
  igual('la bifurcación de cuenta está completa', faltan, []);

  /* --- la cuenta desde la barra, pedida el 27-ago-2026 ---
     «Que alguien pueda crear cuenta sin la necesidad de comprar, o iniciar
     sesión si ya tiene un viaje». Si se cae una pieza, el botón de la barra
     abre un modal a medias y no truena: se ve mal y ya, que es peor. */
  const DE_LA_BARRA = [
    'nav-cuenta', 'nav-cuenta-txt', 'cuentamodal', 'cta-titulo', 'cta-bajada',
    'cta-p-entrar', 'cta-e-correo', 'cta-e-clave', 'cta-e-entrar', 'cta-ir-alta',
    'cta-p-alta', 'cta-a-nombre', 'cta-a-correo', 'cta-a-tel', 'cta-a-clave',
    'cta-a-crear', 'cta-ir-entrar',
    'cta-p-codigo', 'cta-c-casillas', 'cta-c-confirmar', 'cta-c-otro', 'cta-c-texto',
    /* `cta-d-salir` estaba aquí y se fue: cerrar sesión pasó al menú de la
       barra el 27-ago-2026, a pedido del dueño. En el aviso de «ya quedó» no
       tiene nada que hacer —ahí se acaba de crear la cuenta, salirse es lo
       último que quiere quien está viendo esa pantalla—. */
    'cta-p-dentro', 'cta-d-titulo', 'cta-d-quien', 'cta-d-nota', 'cta-d-viajes', 'cta-d-cotizar',
    'cta-p-viajes', 'cta-v-estado', 'cta-v-lista', 'cta-v-error',
    'cta-p-config', 'cta-s-nombre', 'cta-s-correo', 'cta-s-actual', 'cta-s-actual-caja',
    'cta-s-nueva', 'cta-s-guardar', 'cta-s-error', 'cta-s-listo',
    /* olvidé mi contraseña: sus dos pantallas y las dos puertas que llevan */
    'cta-ir-olvide', 'ent-olvide',
    'cta-p-olvide', 'cta-o-correo', 'cta-o-mandar', 'cta-o-error', 'cta-o-volver',
    'cta-p-clave', 'cta-n-texto', 'cta-n-casillas', 'cta-n-nueva', 'cta-n-guardar',
    'cta-n-otro', 'cta-n-error',
    'cta-g', 'cta-g-boton', 'cta-g2', 'cta-g2-boton',
    /* el menú de la barra */
    'menu-cuenta', 'menu-nombre', 'menu-correo', 'menu-viajes', 'menu-config', 'menu-salir'
  ];
  igual('la cuenta desde la barra está completa',
    DE_LA_BARRA.filter(function (id) { return html.indexOf('id="' + id + '"') < 0; }), []);

  /* «Mis viajes» va HASTA ARRIBA del menú: lo pidió el dueño, y es lo que la
     gente viene a buscar cuando abre ahí. Si alguien reordena sin querer, esto
     lo caza — el orden en el HTML es el orden en la pantalla. */
  const orden = ['menu-viajes', 'menu-config', 'menu-salir']
    .map(function (id) { return html.indexOf('id="' + id + '"'); });
  igual('en el menú, «Mis viajes» va primero y «Cerrar sesión» al final',
    orden[0] < orden[1] && orden[1] < orden[2], true);

  /* seis casillas en las DOS pantallas del código, ni cinco ni siete */
  function cuentaCasillas(id) {
    const bloque = html.slice(html.indexOf('id="' + id + '"'));
    return (bloque.slice(0, bloque.indexOf('</div>')).match(/<input/g) || []).length;
  }
  igual('el código de la pantalla de pago tiene sus seis casillas',
    cuentaCasillas('cod-casillas'), 6);
  igual('y el de la barra también', cuentaCasillas('cta-c-casillas'), 6);
  igual('y el de recuperar la contraseña también', cuentaCasillas('cta-n-casillas'), 6);

  /* Y que la página ya NO prometa que no hay cuentas: ese texto se escribió
     cuando la liga era el único camino, y ahora sería mentira. Se mira lo que
     LEE EL CLIENTE, sin comentarios. */
  const visible = sinComentarios(html);
  igual('la página ya no dice «no hay que abrir cuenta»',
    /no hay que abrir cuenta/i.test(visible), false);
  igual('ni «No necesitas crear cuenta»',
    /No necesitas crear cuenta/i.test(visible), false);
  /* pero sí sigue diciendo que se puede comprar sin ella: el camino de
     invitado no se tocó y el cliente tiene que saberlo */
  igual('y sigue ofreciendo comprar como invitado',
    /invitado/i.test(visible), true);

  /* ============================================================
     NADA QUE PROMETA LO QUE NO EXISTE · 15-sep-2026
     ------------------------------------------------------------
     Repaso del lanzamiento. Cada una de éstas es una promesa que la
     página hacía y que nadie del otro lado puede cumplir; y una
     promesa rota se paga con la llamada del cliente enojado, no con
     un error en la consola.
     ============================================================ */

  /* 1 · «Con ese folio entras … sin abrir cuenta». Con el folio no se entra
     a ningún lado: se entra con la liga del correo más su código, o con el
     número de contrato y el apellido en `viaje.html`. */
  igual('la página ya no dice que con el folio se entra «sin abrir cuenta»',
    /sin abrir cuenta/i.test(visible), false);
  cierto('y sí nombra las dos puertas que existen de verdad',
    /n[úu]mero de contrato/i.test(visible) && /apellido/i.test(visible));

  /* 2 · «Dónde viene la unidad el día de la salida». No existe: no hay rastreo
     del cliente en ninguna pantalla. */
  igual('no promete enseñar dónde viene la unidad',
    /d[óo]nde viene la unidad/i.test(visible), false);
}

/* ============================================================
   UNA LIGA VENCIDA NO SE REPONE · 15-sep-2026
   ------------------------------------------------------------
   El servidor le decía al cliente «escríbenos y te mandamos una
   nueva». Nadie puede: no hay ninguna puerta que vuelva a emitir
   una liga, ni en la página ni en el sistema. El cliente escribía
   por WhatsApp a pedir algo que no se le puede dar.

   Lo que SÍ existe desde el 15-sep-2026 es la consulta con número
   de contrato y apellido, que es a donde hay que mandarlo.
   ============================================================ */
{
  ['api/viaje.js', 'api/pedir-codigo.js'].forEach(function (rel) {
    const ruta = path.join(__dirname, '..', rel);
    if (!fs.existsSync(ruta)) return;
    const txt = fs.readFileSync(ruta, 'utf8');
    igual(rel + ' ya no promete una liga nueva',
      /te mandamos una nueva/i.test(txt), false);
    cierto(rel + ' manda a la consulta con contrato y apellido',
      /n[úu]mero de contrato/i.test(txt) && /apellido/i.test(txt));
  });
}

/* ============================================================
   LA CUENTA SE GUARDA PARA DESPUÉS · 15-sep-2026
   ------------------------------------------------------------
   Decisión del dueño para el lanzamiento: las cuentas NO se
   enseñan hoy y se integran después. No se borra nada —el día que
   se enciendan tiene que estar completo, y por eso las pruebas de
   arriba siguen exigiendo que las piezas existan—: se apaga con
   `CONFIG.CUENTAS`.

   Lo que esta parte cuida es que apagar el interruptor apague DE
   VERDAD todas las puertas, y que no se lleve entre las patas el
   pago como invitado, que es con lo que se va a lanzar.

   Se lee el HTML como texto, igual que el resto de esta batería:
   se tapan los comentarios y los guiones —sin moverlos de lugar,
   para que las posiciones sigan valiendo— y lo que queda es lo que
   el cliente ve.
   ============================================================ */
{
  const crudo = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

  /* Se tapa con espacios y no se borra: así cada posición del texto tapado
     sigue siendo la misma que en el archivo, y se puede preguntar «¿esto
     cae dentro de esa caja?». */
  function tapa(texto, re) {
    return texto.replace(re, function (t) { return ' '.repeat(t.length); });
  }
  const soloMarcado = tapa(tapa(tapa(crudo, /<!--[\s\S]*?-->/g),
    /<script\b[\s\S]*?<\/script>/g), /<style\b[\s\S]*?<\/style>/g);

  /* De `id="x"` hasta la etiqueta que lo cierra. Se cuentan aperturas y
     cierres de `div` y `section`, que son las únicas que anidan en estos
     bloques. */
  function bloqueDe(id) {
    const marca = soloMarcado.indexOf('id="' + id + '"');
    if (marca < 0) return null;
    const abre = soloMarcado.lastIndexOf('<', marca);
    const re = /<(\/?)(div|section)\b/g;
    re.lastIndex = abre;
    let nivel = 0, m;
    while ((m = re.exec(soloMarcado))) {
      nivel += m[1] ? -1 : 1;
      if (nivel === 0) return [abre, re.lastIndex];
    }
    return null;
  }

  /* Las cuatro puertas del cliente a las cuentas. El modal va en la lista
     aunque hoy solo lo abra el botón de la barra: una puerta que se apaga
     «porque nadie la toca» es la que se queda encendida. */
  const CAJAS = ['nav-cuenta-caja', 'celular', 'cuenta-caminos', 'cuentamodal'];

  const rangos = {};
  CAJAS.forEach(function (id) {
    const r = bloqueDe(id);
    igual('la caja «' + id + '» existe y se puede delimitar', !!r, true);
    if (r) rangos[id] = r;
  });

  function cajaQueLoContiene(pos) {
    return CAJAS.filter(function (id) {
      const r = rangos[id];
      return r && pos >= r[0] && pos < r[1];
    })[0] || '';
  }

  /* --- ninguna puerta se queda fuera de una caja --- */
  const PUERTAS = [
    ['nav-cuenta', 'el botón «Iniciar sesión» de la barra'],
    ['menu-cuenta', 'su menú'],
    ['menu-viajes', '«Mis viajes»'],
    ['menu-config', '«Configuración»'],
    ['menu-salir', '«Cerrar sesión»'],
    ['camino-invitado', 'la disyuntiva del cuadro de pago'],
    ['camino-cuenta', '«Crear cuenta» del cuadro de pago'],
    ['caminos-pregunta', 'su pregunta']
  ];
  PUERTAS.forEach(function (p) {
    const pos = soloMarcado.indexOf('id="' + p[0] + '"');
    igual('con el interruptor apagado se esconde ' + p[1],
      pos >= 0 && !!cajaQueLoContiene(pos), true);
  });

  /* --- y ningún texto de cuentas queda a la vista --- */
  const TEXTOS = ['Iniciar sesión', 'Mis viajes', 'Cerrar sesión',
    'Continuar como invitado', 'Crear cuenta', 'Tus viajes, en tu celular'];
  TEXTOS.forEach(function (t) {
    const sueltos = [];
    let i = soloMarcado.indexOf(t);
    while (i >= 0) {
      if (!cajaQueLoContiene(i)) sueltos.push(i);
      i = soloMarcado.indexOf(t, i + 1);
    }
    igual('«' + t + '» no se lee fuera de las cajas apagadas', sueltos, []);
  });

  /* --- Y EL PAGO COMO INVITADO SIGUE ENTERO ---
     Es con lo que se lanza. Si el cuadro del pago cayera dentro de la caja
     que se apaga, apagar las cuentas apagaría la venta. */
  [['pago-ir', 'el botón de pagar'],
    ['pago-titulo', 'el título del cuadro de pago'],
    ['pago-total', 'el total'],
    ['pago-anticipo', 'el anticipo'],
    ['pago-saldo', 'el saldo'],
    ['pago-canal-texto', 'el aviso de a dónde llega el folio']
  ].forEach(function (p) {
    const pos = soloMarcado.indexOf('id="' + p[0] + '"');
    igual(p[1] + ' queda fuera de lo que se apaga',
      pos >= 0 && cajaQueLoContiene(pos), '');
  });

  /* --- el interruptor existe y es el que manda --- */
  const config = fs.readFileSync(path.join(__dirname, '..', 'config.js'), 'utf8');
  cierto('config.js declara el interruptor de las cuentas', /CUENTAS\s*:/.test(config));
  igual('y hoy está apagado', /CUENTAS\s*:\s*false/.test(config), true);

  cierto('index.html lee el interruptor', /CONFIG\s*\|\|\s*\{\}\)\.CUENTAS|CONFIG\.CUENTAS/.test(crudo));

  /* La lista de lo que se esconde vive en UN lugar del guion, y son
     exactamente estas cuatro cajas: si alguien agrega una puerta nueva y no
     la mete a la lista, esto no lo caza, pero si alguien quita una de la
     lista, sí. */
  const lista = /var CAJAS_DE_CUENTA = \[([^\]]*)\]/.exec(crudo);
  cierto('el guion tiene su lista de cajas que apagar', !!lista);
  igual('  y son las cuatro',
    lista ? (lista[1].match(/'([^']+)'/g) || []).map(function (s) { return s.replace(/'/g, ''); }).sort() : [],
    CAJAS.slice().sort());

  /* Apagado, el modal de la cuenta no se abre: el botón que lo abría está
     escondido, pero su atendedor también se frena. Un modal que se abre
     encima de una página que no tiene cuentas es peor que el botón. */
  cierto('con el interruptor apagado no se llama al modal de la cuenta',
    /if \(!CUENTAS_ENCENDIDAS\) return;/.test(crudo));
}

console.log('\n' + buenas + ' buenas, ' + malas + ' malas');
process.exit(malas ? 1 : 0);
