/* ============================================================
   LOS BOTONES, DE VERDAD (12-sep-2026)
   ============================================================
   El bot lleva MESES devolviendo `opciones` en cada respuesta —«¿Cuál de
   esos te late?» con los siete autobuses, «Es la salida / Es el regreso»,
   «Sí, apártamela»— y ninguna había salido nunca por WhatsApp. Se
   descartaban antes del envío, y solo las pintaba la página.

   O sea: el cliente de WhatsApp leía la pregunta y no veía ni un botón.

   Se descubrió al poner los dos del saludo: el mensaje quedó en «¿Qué
   necesitas?» a secas, que sin botones es peor que la versión anterior.

   Ahora salen como `interactive` de tipo `button`, que Meta manda gratis
   dentro de la ventana de 24 h.

   LO QUE ESTA BATERÍA CUIDA, y por qué no es cosmético: Meta RECHAZA EL
   MENSAJE ENTERO si un límite se pasa. No lo recorta, no avisa: el
   cliente no recibe nada. Así que lo importante no es que los botones
   salgan bonitos — es que **cuando no quepan, el mensaje se mande igual
   como texto de siempre**.
   ============================================================ */
'use strict';

const path = require('path');
const RAIZ = path.join(__dirname, '..');

let buenas = 0, malas = 0;
function ok(que, condicion) {
  if (condicion) { buenas++; console.log('ok   ' + que); }
  else { malas++; console.log('FALLA ' + que); }
}
function titulo(t) { console.log('\n== ' + t.toUpperCase() + ' =='); }

/* Se arma el cuerpo igual que `whatsapp.mjs`, leyéndolo del archivo para
   que esto no sea una copia que se despegue. La regla vive allá; aquí se
   comprueba. */
const fs = require('fs');
const codigo = fs.readFileSync(path.join(RAIZ, 'api/whatsapp.mjs'), 'utf8');

titulo('la regla está escrita y con sus tres topes');
{
  ok('se manda como interactive', /type:\s*'interactive'/.test(codigo));
  ok('  de tipo button', /type:\s*'button'/.test(codigo));
  ok('  con reply por cada uno', /type:\s*'reply'/.test(codigo));
  ok('el tope de 3 botones está puesto', /ops\.length\s*<=\s*3/.test(codigo));
  ok('el tope de 20 caracteres por botón está puesto', /o\.length\s*<=\s*20/.test(codigo));
  ok('el tope de 1024 del cuerpo está puesto', /length\s*<=\s*1024/.test(codigo));
}

/* La misma decisión, aparte, para probarla con datos. Si esto y el
   archivo se despegan, la prueba de arriba lo caza. */
function comoSeManda(texto, opciones) {
  const ops = Array.isArray(opciones) ? opciones
    .map(function (o) { return String(o || '').trim(); })
    .filter(function (o) { return o && o.length <= 20; }) : [];
  const cabe = ops.length >= 1 && ops.length <= 3 && String(texto || '').length <= 1024;
  return cabe ? 'interactive' : 'text';
}

titulo('cuándo salen botones y cuándo no');
{
  ok('con dos opciones, botones',
    comoSeManda('¿Qué necesitas?', ['Cotizar un viaje', 'Hablar con alguien']) === 'interactive');
  ok('con tres, botones',
    comoSeManda('¿Cuál te late?', ['Uno', 'Dos', 'Tres']) === 'interactive');
  ok('con una, botones',
    comoSeManda('¿Va?', ['Sí, apártamela']) === 'interactive');

  ok('sin opciones, texto de siempre', comoSeManda('Hola', []) === 'text');
  ok('con opciones nulas, texto', comoSeManda('Hola', null) === 'text');
}

titulo('lo que Meta rechazaría, se manda como texto');
{
  /* ÉSTE es el que importa. Meta no recorta: tira el mensaje entero y el
     cliente no recibe NADA. Más vale un mensaje sin botones que ningún
     mensaje. */
  ok('cuatro opciones → texto, no un mensaje perdido',
    comoSeManda('¿Cuál te late?', ['Uno', 'Dos', 'Tres', 'Cuatro']) === 'text');

  ok('siete autobuses → texto',
    comoSeManda('¿Cuál de esos te late? 🚌',
      ['Marcopolo Paradiso G8', 'Irizar i6S', 'Irizar i6', 'Irizar PB',
        'Neobus', 'Irizar Century', 'Sprinter']) === 'text');

  ok('un botón de más de 20 caracteres se descarta y queda texto',
    comoSeManda('¿Va?', ['Hablar con una persona por favor']) === 'text');

  const largo = 'x'.repeat(1100);
  ok('un cuerpo de más de 1024 → texto', comoSeManda(largo, ['Sí', 'No']) === 'text');
}

titulo('los botones que el bot ofrece de verdad sí caben');
{
  const conv = require(path.join(RAIZ, 'bot.js'));
  const saludo = conv.respuestaA('hola', null, '2026-09-12');
  ok('el saludo sale con botones',
    comoSeManda(saludo.texto, saludo.opciones) === 'interactive');

  /* Y un barrido: ninguna opción del bot debe pasarse de 20, porque si se
     pasa, ese mensaje pierde sus botones sin que nadie se entere. */
  const largas = (fs.readFileSync(path.join(RAIZ, 'bot.js'), 'utf8')
    .match(/opciones: \[[^\]]*\]/g) || [])
    .flatMap(function (bloque) { return bloque.match(/'[^']{21,}'/g) || []; })
    /* Las que se arman con variables no se pueden medir así. */
    .filter(function (s) { return s.indexOf('+') < 0; });
  ok('ninguna opción escrita a mano se pasa de 20 caracteres · ' +
    (largas.length ? largas.join(' ') : ''), largas.length === 0);
}

titulo('el envío lleva las opciones hasta el final');
{
  /* El eslabón que faltaba: el webhook las tenía y no las copiaba al
     envío. Si alguien lo quita, los botones desaparecen otra vez y nada
     truena. */
  const hook = fs.readFileSync(path.join(RAIZ, 'api/_whatsapp-webhook.js'), 'utf8');
  ok('el envío al cliente copia las opciones de la respuesta',
    /opciones:\s*Array\.isArray\(r\.opciones\)/.test(hook));
}

console.log('\n' + buenas + ' buenas, ' + malas + ' malas');
process.exit(malas ? 1 : 0);
