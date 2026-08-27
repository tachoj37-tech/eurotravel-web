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
    'cod-otro', 'camino-salir'
  ];
  const faltan = necesarios.filter(function (id) {
    return html.indexOf('id="' + id + '"') < 0;
  });
  igual('la bifurcación de cuenta está completa', faltan, []);

  /* seis casillas, ni cinco ni siete */
  const bloque = html.slice(html.indexOf('id="cod-casillas"'));
  const cierre = bloque.indexOf('</div>');
  const casillas = (bloque.slice(0, cierre).match(/<input/g) || []).length;
  igual('el código tiene sus seis casillas', casillas, 6);

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
