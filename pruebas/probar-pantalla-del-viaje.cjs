/* ============================================================
   La pantalla de la liga, por dentro
   ------------------------------------------------------------
       node pruebas/probar-pantalla-del-viaje.cjs

   `viaje.html` es la pantalla que abre el cliente con la liga de
   su correo. El motor que la protege está probado a fondo
   —`probar-ligas.cjs`, `probar-acceso.cjs`, `probar-viaje.cjs`—
   pero lo que se PINTA no lo miraba nadie, y ahí es donde vive lo
   que el cliente lee.

   ESTO NACIÓ DE UNA AUDITORÍA, el 12-sep-2026, cuando el dueño
   pidió: «eso quiero que lo pulas y veas qué tal si encuentras
   bugs en los links o en el inicio de sesión».

   Lo que se cuida:

     1. El reenvío NO dice «te mandamos otro» antes de saber si
        salió. Decía eso, y si el servidor contestaba 429 o 503 el
        texto se quedaba puesto: el cliente esperando un correo
        que nunca se mandó.
     2. El código no se manda incompleto. Aquí YA estaba bien
        —es index.html el que estaba mal, y de aquí salió cómo
        arreglarlo— así que esto cuida que no se caiga.
     3. El token viaja en el CUERPO de la petición, no en la
        dirección: una dirección se guarda en registros de
        servidores ajenos, un cuerpo POST no.
     4. Nada de lo que llega del servidor se pinta como HTML sin
        escapar.
   ============================================================ */
'use strict';

const fs = require('fs');
const path = require('path');

const RAIZ = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(RAIZ, 'viaje.html'), 'utf8');

let buenas = 0, malas = 0;
function igual(nombre, dio, esperado) {
  const a = JSON.stringify(dio), b = JSON.stringify(esperado);
  if (a === b) { buenas++; console.log('ok   ' + nombre); }
  else { malas++; console.log('MAL  ' + nombre + '\n     dio      ' + a + '\n     esperaba ' + b); }
}
function cierto(nombre, v) { igual(nombre, !!v, true); }
function titulo(t) { console.log('\n== ' + t.toUpperCase() + ' =='); }

/* El bloque del botón de reenviar, desde su manejador hasta el final. */
function bloqueDe(desdeTexto, hastaTexto) {
  const a = html.indexOf(desdeTexto);
  if (a < 0) return '';
  const b = hastaTexto ? html.indexOf(hastaTexto, a) : -1;
  return b > a ? html.slice(a, b) : html.slice(a);
}

/* ============================================================ */
titulo('el reenvío no promete un correo que no salió');
{
  const reenvio = bloqueDe("getElementById('otro')", 'function pideCodigo');
  cierto('el botón de reenviar se encuentra', !!reenvio);

  /* Decía `err.textContent = 'Te mandamos otro código.'` ANTES del `fetch`, y
     `pideCodigo(true)` es «callado»: si fallaba, no corregía nada. El cliente
     se quedaba leyendo que le mandamos un correo que nunca salió. */
  igual('no da el correo por mandado antes de mandarlo',
    /Te mandamos otro código[^]*pideCodigo/.test(reenvio), false);

  /* Lo que sí tiene que hacer: avisar que va en camino, y decir la verdad
     cuando el servidor conteste. */
  cierto('avisa que está mandando', /Mandando…|Mandando\.\.\./.test(reenvio));
  cierto('y contesta según lo que diga el servidor',
    /then\(/.test(reenvio) && /catch\(/.test(reenvio));

  /* Y no se puede picar sin parar: cada clic es un correo que cuesta dinero
     y un renglón en el freno del servidor. */
  cierto('el botón se frena mientras va en camino', /disabled\s*=\s*true/.test(reenvio));
}

/* ============================================================ */
titulo('el código no se manda a medias');
{
  const manda = bloqueDe('function manda()', "getElementById('entrar')");
  cierto('la función de mandar se encuentra', !!manda);

  /* El servidor aguanta cinco intentos y después cierra (`probar-acceso`).
     Mandar tres dígitos gastaría uno sin que el cliente se equivocara de
     código. Esto YA estaba bien aquí; se cuida que siga. */
  cierto('cuenta los seis dígitos antes de mandar', /length < 6/.test(manda));
  cierto('y avisa qué falta', /Faltan dígitos/.test(manda));

  /* Guarda contra el doble envío: sin ella, dos clics rápidos gastan dos
     intentos de los cinco. */
  cierto('no se manda dos veces a la vez', /if \(mandando\) return;/.test(manda));
}

/* ============================================================ */
titulo('el token no se va en la dirección de la petición');
{
  /* La liga viene en la dirección del navegador —ahí no hay de otra— pero
     hacia el servidor viaja en el CUERPO. Una dirección con el token se
     guarda en los registros de cualquier intermediario; un POST no. */
  const peticiones = html.match(/fetch\('\/api\/[^']*'/g) || [];
  igual('ninguna petición lleva el token en la dirección',
    peticiones.filter(function (p) { return /\?/.test(p); }), []);

  cierto('el token se lee de la dirección del navegador',
    /URLSearchParams\(location\.search\)\.get\('t'\)/.test(html));
  cierto('y se manda en el cuerpo', /body: JSON\.stringify\(\{ t: t/.test(html));

  /* Y la pantalla pide que no se indexe: una liga en un buscador sería una
     liga pública. */
  cierto('la pantalla pide no ser indexada', /noindex/.test(html));
}

/* ============================================================ */
titulo('lo que manda el servidor no se pinta como HTML');
{
  /* La metadata de Stripe la escribimos nosotros, pero pasa por el nombre y
     el punto de salida que TECLEÓ el cliente. Si eso se pintara crudo, el
     cliente podría guardarse un `<script>` en su propio viaje — y esa
     pantalla la abre también quien le reenvíe la liga. */
  cierto('hay un escapador', /function esc\(/.test(html));
  cierto('  que cubre las cinco', /&amp;|&lt;|&gt;|&quot;|&#39;/.test(html));

  /* ------------------------------------------------------------
     SE MIRAN LOS TRES SITIOS POR DONDE ENTRA UN DATO, NO TODOS LOS
     `innerHTML`
     ------------------------------------------------------------
     Se intentó al revés —barrer cada `innerHTML` y exigirle un `esc()`— en
     dos versiones, y las dos dieron falsos positivos: las asignaciones
     largas parten la línea, y `partes.join('')` arma HTML que ya venía
     escapado de antes. Afinar la heurística iba a costar más que lo que
     valía, y una prueba que grita donde no hay nada se acaba ignorando.

     Lo que sí es verificable sin adivinar: por esta pantalla los datos
     entran por TRES funciones —`r()` pinta un renglón, `tarjeta()` una
     caja, `pintaError()` un aviso—. Si esas tres escapan, lo demás es HTML
     que escribimos nosotros.
     ------------------------------------------------------------ */
  [
    ['r', 'el renglón de cada dato'],
    ['tarjeta', 'la caja del viaje'],
    ['pintaError', 'el aviso de error']
  ].forEach(function (par) {
    const f = bloqueDe('function ' + par[0] + '(', '\n  function ');
    cierto(par[1] + ' escapa lo que pinta', /esc\(/.test(f));
  });
}

/* ============================================================ */
titulo('«abona a tu viaje» · la pantalla sin liga');
{
  /* Antes, `viaje.html` sin liga era un callejón: «Falta tu liga». El
     cliente que apartó por teléfono y firmó en la oficina NUNCA tuvo liga,
     así que para él esa pantalla no servía de nada.

     Ahora es su entrada: número de contrato y apellido. */
  cierto('sin liga se pinta la consulta, no un error',
    /function pintaConsulta\(/.test(html));
  cierto('el formulario pide el número de contrato',
    /id="portal-folio"/.test(html));
  cierto('  y un apellido', /id="portal-apellido"/.test(html));

  /* DE DONDE SALE ESE NUMERO. Sin esta frase, el cliente teclea el folio
     `ET-…` de la página —que EuroSystem no conoce— y no encuentra nada. */
  cierto('se dice que el número viene impreso en su contrato en PDF',
    /impreso[^<]*contrato|contrato[^<]*en PDF|viene en tu contrato/i.test(html));

  const consulta = bloqueDe("accion: 'consulta'", 'function pintaPortal');
  cierto('la consulta va por POST al servidor', !!consulta);
  cierto('  y manda folio y apellido', /folio:/.test(consulta) && /apellido:/.test(consulta));

  /* NO SE PROMETE LO QUE NO SE PUEDE CUMPLIR. La página no manda SMS ni
     WhatsApp cuando entra un abono: decirlo sería mentira. */
  const pantalla = bloqueDe('function pintaConsulta(', 'function pideCodigo');
  igual('no se promete un SMS ni un WhatsApp de aviso',
    /te avisamos por (sms|whats)|te mandamos un (sms|whats)/i.test(pantalla), false);
}

/* ============================================================ */
titulo('lo que ve el cliente de su contrato');
{
  const pinta = bloqueDe('function pintaPortal(', 'function pintaPuerta');
  cierto('se pinta el resultado del portal', !!pinta);

  ['destino', 'salida', 'regreso', 'unidad', 'total', 'abonado', 'saldo', 'enRevision']
    .forEach(function (campo) {
      cierto('sale ' + campo, new RegExp('\\b' + campo + '\\b').test(pinta));
    });
  cierto('y la lista de abonos, con fecha, monto y forma',
    /abonos/.test(pinta) && /\.forma/.test(pinta) && /\.monto/.test(pinta));

  /* EL PDF ES UNA LIGA AL PORTADOR (§12): se abre, no se guarda, y solo
     se sigue si de verdad es https. */
  cierto('hay un botón para abrir su contrato en PDF', /\.pdf/.test(pinta));
  cierto('  y esa liga pasa por el filtro antes de pintarse',
    /ligaSegura\(d\.pdf\)/.test(pinta));
  {
    const filtro = bloqueDe('function ligaSegura(', 'function avisoDelAbonoSinLiga');
    cierto('  el filtro exige https', /https:/.test(filtro) && /protocol/.test(filtro));
    cierto('  y no deja pasar lo que ni siquiera es una dirección',
      /catch/.test(filtro) && /return ''/.test(filtro));
  }
  /* Abrir un PDF ajeno en otra pestaña sin `noopener` le da a esa página el
     control de la nuestra. */
  cierto('  y se abre sin darle control a la otra pestaña',
    /rel="noopener noreferrer"/.test(pinta));

  /* Lo que llega del servidor no se pinta crudo. */
  cierto('lo que llega del servidor se escapa', /esc\(/.test(pinta));
}

/* ============================================================ */
titulo('abonar desde el portal va con el pase, no con la liga');
{
  const engancha = bloqueDe('function enganchaAbono(', 'function pinta(');
  cierto('el mismo enganche sirve para las dos pantallas', !!engancha);
  cierto('  y cuando hay pase, es el pase lo que viaja', /pase: /.test(engancha));

  /* El tope de lo que se teclea sale del saldo y del mínimo que dijo el
     servidor, igual que en la pantalla de la liga. Es cortesía: quien
     decide sigue siendo `api/_saldo.js`. */
  cierto('el monto se compara contra el saldo', /monto > d\.saldo/.test(engancha));
  cierto('  y contra el mínimo', /monto < d\.abonoMinimo/.test(engancha));
}

/* ============================================================ */
titulo('la vuelta de un abono del portal no promete nada');
{
  /* Sin liga no hay a quién preguntarle si el cobro entró —el pase no abre
     pantallas—, así que la vuelta de Stripe NO puede decir «recibido». Lo
     que sí puede es no mentir. */
  const vuelta = bloqueDe('function avisoDelAbonoSinLiga(', 'function pintaConsulta');
  cierto('hay un aviso propio para la vuelta sin liga', !!vuelta);
  igual('y NO afirma que el pago se recibió',
    /(recibido con éxito|tu pago fue recibido)/i.test(vuelta), false);
  cierto('  sino que le dice cómo comprobarlo',
    /consult|comprobante|correo/i.test(vuelta));
}

console.log('\n' + buenas + ' buenas, ' + malas + ' malas');
process.exit(malas ? 1 : 0);
