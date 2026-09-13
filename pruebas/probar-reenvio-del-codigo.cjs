/* ============================================================
   «No me llegó — mándame otro»
   ------------------------------------------------------------
       node pruebas/probar-reenvio-del-codigo.cjs

   La portada tiene TRES botones de reenviar un código: el de la
   pantalla de pago, el del modal de la barra y el de recuperar la
   contraseña. La pantalla del viaje tiene un cuarto, y ése se
   arregló el 12-sep-2026 auditando las ligas.

   Los tres de la portada se quedaron con lo mismo que aquél, y con
   algo peor en uno:

     1. `cta-n-otro` —el de la contraseña nueva— dice «Listo, va
        otro código en camino» SIN MIRAR SI SALIÓ. Si el servidor
        contesta 429 —el freno son cuatro por minuto— o 503, el
        cliente se queda esperando un correo que nunca se mandó.
     2. Los tres pintan la buena noticia en el renglón de ERRORES,
        que es rojo. «Listo, va otro código» en rojo se lee como un
        problema.
     3. Ninguno frena el doble clic. Cada pica es un correo que
        cuesta dinero y un renglón del freno del servidor.

   Lo que se cuida aquí es que los cuatro —los tres de la portada y
   el de la pantalla del viaje— se comporten igual. Un mismo botón
   que hace cuatro cosas distintas según dónde esté es de lo que
   más cuesta mantener.
   ============================================================ */
'use strict';

const fs = require('fs');
const path = require('path');

const RAIZ = path.join(__dirname, '..');
const index = fs.readFileSync(path.join(RAIZ, 'index.html'), 'utf8');
const viaje = fs.readFileSync(path.join(RAIZ, 'viaje.html'), 'utf8');

let buenas = 0, malas = 0;
function igual(nombre, dio, esperado) {
  const a = JSON.stringify(dio), b = JSON.stringify(esperado);
  if (a === b) { buenas++; console.log('ok   ' + nombre); }
  else { malas++; console.log('MAL  ' + nombre + '\n     dio      ' + a + '\n     esperaba ' + b); }
}
function cierto(nombre, v) { igual(nombre, !!v, true); }
function titulo(t) { console.log('\n== ' + t.toUpperCase() + ' =='); }

/* Cortar entre dos marcas que quizá no existen revienta la corrida y
   entonces el rojo no se lee entero. Si falta cualquiera, vacío. */
function entre(texto, desde, hasta) {
  const a = texto.indexOf(desde);
  if (a < 0) return '';
  const b = texto.indexOf(hasta, a);
  return b > a ? texto.slice(a, b) : texto.slice(a);
}

/* Los tres de la portada, con su manejador y hasta dónde llega. */
const REENVIOS = [
  ['cod-otro', "byId('camino-salir')", 'la pantalla de pago'],
  ['cta-c-otro', "byId('cta-ir-olvide')", 'el modal de la barra'],
  ['cta-n-otro', "byId('cta-g')", 'la contraseña nueva']
];

/* ============================================================ */
titulo('los tres pasan por la misma función');
{
  /* ------------------------------------------------------------
     SE MIRA LA FUNCIÓN COMPARTIDA, NO CADA MANEJADOR

     La primera versión de esta prueba buscaba «Mandando…», el status y
     el freno DENTRO de cada uno de los tres botones — y así estaban
     antes: tres copias, y la de la contraseña nueva con un defecto que
     las otras dos no tenían.

     El arreglo los pasó por una sola función. Lo que se cuida ahora es
     que los tres la usen, y que ella haga lo que debe. Es la misma
     lección de `probar-captura.cjs`: cuando la regla se muda a un lugar
     común, la prueba se muda con ella.
     ------------------------------------------------------------ */
  REENVIOS.forEach(function (r) {
    const bloque = entre(index, "byId('" + r[0] + "').addEventListener", r[1]);
    cierto(r[0] + ' (' + r[2] + '): el manejador se encuentra', !!bloque);
    cierto(r[0] + ': pasa por `reenvia`', /reenvia\(/.test(bloque));

    /* Y ninguno se quedó con su copia vieja: si alguien vuelve a escribir
       el mensaje a mano en su manejador, esto lo caza. */
    igual(r[0] + ': no promete el correo por su cuenta',
      /Listo, va otro/.test(bloque), false);
  });
}

/* ============================================================ */
titulo('y esa función dice la verdad');
{
  const f = entre(index, 'function reenvia(', 'function verCaja(');
  cierto('la función se encuentra', !!f);

  cierto('avisa que está mandando', /Mandando…/.test(f));
  cierto('mira lo que contestó el servidor', /status === 200/.test(f));
  cierto('y tiene salida si no hubo conexión', /catch\(/.test(f));

  /* El mensaje bueno tiene que estar DETRÁS de la comprobación del
     status. El de la contraseña nueva lo decía siempre, pasara lo que
     pasara: `then(function () {…})`, sin mirar la respuesta. */
  const antesDelStatus = f.slice(0, f.indexOf('status === 200'));
  igual('no da el correo por mandado antes de saberlo',
    /Listo, va otro/.test(antesDelStatus), false);

  /* La buena noticia no se pinta de rojo: el renglón es `.caminos-error`
     y el aviso bueno necesita su propia clase. */
  cierto('hay un estilo para el aviso bueno', /\.caminos-bien\b/.test(index));
  cierto('marca el renglón como bueno cuando salió', /caminos-bien/.test(f));
  /* Y se quita al volver a fallar: un renglón verde con un mensaje de
     error es peor que uno rojo con una buena noticia. */
  cierto('y lo quita cuando no', /remove\('caminos-bien'\)|toggle\('caminos-bien'/.test(f));

  /* Cada clic es un correo que cuesta dinero y un renglón del freno del
     servidor —cuatro por minuto en «olvidé»—. */
  cierto('se frena mientras va en camino', /disabled = true/.test(f));
  cierto('y se suelta al volver', /disabled = false/.test(f));
  cierto('y el segundo clic no hace nada mientras tanto',
    /if \(boton\.disabled\) return;/.test(f));
}

/* ============================================================ */
titulo('la pantalla del viaje sigue igual de bien');
{
  /* Éste se arregló primero y es el modelo. Si alguna vez se cae, los
     tres de arriba se quedarían sin referencia. */
  const bloque = entre(viaje, "getElementById('otro')", 'function pideCodigo');
  cierto('el de viaje.html avisa que está mandando', /Mandando…/.test(bloque));
  cierto('  se frena mientras va', /disabled = true/.test(bloque));
  cierto('  y dice la verdad al volver',
    /No pudimos mandarlo ahora mismo/.test(bloque));
}

/* ============================================================ */
titulo('crear cuenta revisa que el correo sirva');
{
  /* Miraba solo que no estuviera vacío, así que «no-es-correo» pasaba y
     el servidor lo rechazaba después. Ahora `correoBueno` ya existe —se
     escribió el 12-sep-2026 para el formulario que lleva al pago— así
     que es usarla. */
  const crear = entre(index, "byId('cta-a-crear').addEventListener", "pideCuenta('crear'");
  cierto('el manejador de crear cuenta se encuentra', !!crear);
  cierto('avisa si falta el nombre', /Escribe tu nombre/.test(crear));
  cierto('y si falta el correo', /Escribe tu correo/.test(crear));
  cierto('y si el correo no se entiende', /correoBueno\(/.test(crear));
}

console.log('\n' + buenas + ' buenas, ' + malas + ' malas');
process.exit(malas ? 1 : 0);
