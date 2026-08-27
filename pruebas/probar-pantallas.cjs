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
    'cta-p-dentro', 'cta-d-quien', 'cta-d-salir', 'cta-d-cotizar',
    'cta-g', 'cta-g-boton', 'cta-g2', 'cta-g2-boton'
  ];
  igual('la cuenta desde la barra está completa',
    DE_LA_BARRA.filter(function (id) { return html.indexOf('id="' + id + '"') < 0; }), []);

  /* seis casillas en las DOS pantallas del código, ni cinco ni siete */
  function cuentaCasillas(id) {
    const bloque = html.slice(html.indexOf('id="' + id + '"'));
    return (bloque.slice(0, bloque.indexOf('</div>')).match(/<input/g) || []).length;
  }
  igual('el código de la pantalla de pago tiene sus seis casillas',
    cuentaCasillas('cod-casillas'), 6);
  igual('y el de la barra también', cuentaCasillas('cta-c-casillas'), 6);

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
}

console.log('\n' + buenas + ' buenas, ' + malas + ' malas');
process.exit(malas ? 1 : 0);
