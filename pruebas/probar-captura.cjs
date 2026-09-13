/* ============================================================
   La puerta de la solicitud, y la caja que la pide
   ------------------------------------------------------------
       node pruebas/probar-captura.cjs

   Hermana de `probar-solicitud.cjs`: aquélla cuida el motor —qué
   se acepta y qué se manda—, ésta cuida **la puerta y la
   pantalla**.

   LO QUE SE CUIDA, en orden de gravedad:

     1. LA PUERTA NO ES UN ARCHIVO NUEVO. El plan Hobby de Vercel
        publica DOCE funciones y hay doce exactas: un archivo más
        en `api/` tumba el despliegue entero, y ya pasó el
        26-ago-2026. Por eso la solicitud vive dentro de
        `api/cotizar.js`, como una acción.
     2. SU FRENO ES SUYO Y ES MÁS APRETADO. Cotizar cuesta
        llamadas a Google; mandar una solicitud SACA CORREOS de
        nuestro dominio, y eso se abusa distinto.
     3. LA CAJA SALE EN LOS TRES CAMINOS SIN PRECIO, no solo en
        uno. El más transitado es el de los camiones: nada más la
        Sprinter cotiza sola.
     4. EL ACUSE ESTÁ EN LA PANTALLA. «No un mensaje que quizá no
        llega», dice el plan.
     5. La caja se rearma entera al reabrirse. Al mandar se
        esconde el campo para que nadie mande dos veces; sin
        rearmarla, cambiar una fecha dejaba una caja sin dónde
        escribir.
   ============================================================ */
'use strict';

const fs = require('fs');
const path = require('path');

const RAIZ = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(RAIZ, 'index.html'), 'utf8');
const puerta = fs.readFileSync(path.join(RAIZ, 'api', 'cotizar.js'), 'utf8');

let buenas = 0, malas = 0;
function igual(nombre, dio, esperado) {
  const a = JSON.stringify(dio), b = JSON.stringify(esperado);
  if (a === b) { buenas++; console.log('ok   ' + nombre); }
  else { malas++; console.log('MAL  ' + nombre + '\n     dio      ' + a + '\n     esperaba ' + b); }
}
function cierto(nombre, v) { igual(nombre, !!v, true); }
function titulo(t) { console.log('\n== ' + t.toUpperCase() + ' =='); }

/* ============================================================ */
titulo('la puerta no gasta una función de Vercel');
{
  /* `probar-despliegue.cjs` cuenta las doce. Esto cuida la otra mitad: que
     la solicitud haya entrado por donde no cuesta una. */
  const enApi = fs.readdirSync(path.join(RAIZ, 'api'));
  igual('no hay un api/solicitud.js suelto', enApi.indexOf('solicitud.js'), -1);
  cierto('el motor vive como módulo interno', enApi.indexOf('_solicitud.js') >= 0);

  cierto('la puerta la atiende cotizar.js', /accion === 'solicitud'/.test(puerta));
  cierto('  y carga el motor', /require\('\.\/_solicitud'\)/.test(puerta));
}

/* ============================================================ */
titulo('su freno es suyo, y más apretado que el de cotizar');
{
  cierto('tiene un freno aparte', /frenoSolicitud/.test(puerta));

  const topes = puerta.match(/creaFreno\(\{ porMinuto: (\d+), porDia: (\d+) \}\)/g) || [];
  igual('hay dos frenos declarados', topes.length, 2);

  const num = topes.map(function (t) {
    const m = /porMinuto: (\d+), porDia: (\d+)/.exec(t);
    return { min: Number(m[1]), dia: Number(m[2]) };
  });
  cierto('el de la solicitud es más apretado por minuto', num[1].min < num[0].min);
  cierto('  y por día', num[1].dia < num[0].dia);
  /* Cinco por minuto es de sobra para una persona. Si alguien lo sube a
     treinta, esto se pone rojo y hay que decir por qué. */
  igual('y es de cinco por minuto', num[1].min, 5);

  /* Se cobra ANTES de revisar nada: si se cobrara después, una petición
     mal formada saldría gratis y el freno no frenaría nada. */
  const cobro = puerta.indexOf('frenoSolicitud(req)');
  const revision = puerta.indexOf('solicitud.revisa(');
  cierto('el freno se cobra antes de revisar', cobro > 0 && cobro < revision);
}

/* ============================================================ */
titulo('la puerta contesta bien');
{
  /* Un contacto ilegible es 422 —«te entendí, pero eso no sirve»— y no 400
     ni 500: el cliente no rompió nada. */
  cierto('el contacto ilegible contesta 422', /status\(422\)/.test(puerta));

  /* Y una solicitud recibida contesta 200 AUNQUE el aviso haya fallado. Un
     cliente que dejó sus datos no puede ver un error por algo que no es
     suyo; el fallo se grita en el registro, dentro de `avisa`. */
  /* Se mira SOLO hasta donde acaba esta rama: más abajo vive el cotizador
     normal, con su 502 legítimo cuando Google no contesta. */
  const trasAvisar = puerta.slice(puerta.indexOf('solicitud.avisa('),
    puerta.indexOf('const frenado = freno(req)'));
  cierto('la solicitud recibida contesta 200', /status\(200\)/.test(trasAvisar));
  cierto('  diciendo que se recibió', /recibida: true/.test(trasAvisar));
  igual('  y el fallo del aviso NO se le pasa al cliente',
    /status\(50\d\)/.test(trasAvisar), false);

  /* AQUÍ NO SALE NINGÚN PRECIO. Esta rama existe para los viajes que no lo
     tienen: si algún día devolviera una cifra, sería una que no salió del
     criterio — justo lo que la fase 1 vino a cerrar. */
  const rama = puerta.slice(puerta.indexOf("accion === 'solicitud'"),
    puerta.indexOf('const frenado = freno(req)'));
  igual('la rama de la solicitud no devuelve totales', /total|anticipo|saldo/.test(rama), false);
}

/* ============================================================ */
titulo('la caja sale en LOS TRES caminos sin precio');
{
  /* Éste es el corazón de la fase 2. Un solo camino cubierto deja los otros
     dos perdiendo clientes igual que antes. */
  const veces = (html.match(/abreCaptura\(\);/g) || []).length;
  igual('se abre en tres lugares', veces, 3);

  /* 1 · La unidad que no cotiza en línea: camiones y Suburban. Es el más
     transitado de todos — nada más la Sprinter cotiza sola. */
  const sinAutomatico = html.slice(html.indexOf('if (!maquina.cotizaEnAutomatico())'));
  cierto('  en la unidad que no cotiza en línea',
    /abreCaptura\(\);/.test(sinAutomatico.slice(0, 900)));

  /* 2 · El destino que no salió del criterio (fase 1). */
  const asesor = html.indexOf('Este viaje lo cotiza un vendedor');
  cierto('  en el destino fuera del criterio',
    /abreCaptura\(\);/.test(html.slice(asesor, asesor + 700)));

  /* 3 · Y cuando la medición falla o el servidor se cae: el cliente no tiene
     la culpa y tampoco se puede ir sin dejar rastro. */
  const fallo = html.indexOf('precioNoDisponible(v.aviso)');
  cierto('  y cuando la cotización falla',
    /abreCaptura\(\);/.test(html.slice(fallo, fallo + 500)));

  /* Con precio en pantalla la caja estorba: ese cliente aparta, no espera. */
  cierto('y se cierra cuando SÍ hay precio', /cierraCaptura\(\);/.test(html));
}

/* ============================================================ */
titulo('un solo campo, y el acuse en la misma pantalla');
{
  /* «Cada campo de más es gente que se va»: uno, no dos. */
  const caja = html.slice(html.indexOf('<div class="captura" id="captura"'),
    html.indexOf('id="captura-listo"'));
  igual('la caja tiene UN campo', (caja.match(/<input/g) || []).length, 1);

  cierto('y un botón para cambiar de canal', /id="captura-cambia"/.test(html));
  cierto('que ofrece el correo', /Mejor mándamelo por correo/.test(html));
  cierto('  y de vuelta el WhatsApp', /Mejor mándamelo por WhatsApp/.test(html));

  /* El acuse va en la pantalla, no en un mensaje que quizá no llega. */
  cierto('el acuse tiene su lugar en la pantalla', /id="captura-listo"/.test(html));
  cierto('  y se enseña al recibir el 200', /captura-listo'\)\.style\.display = ''/.test(html));

  /* Y al mandar se esconde el campo: un formulario que sigue ahí invita a
     mandarlo dos veces. */
  cierto('al mandar se esconde el campo',
    /captura-fila-caja'\)\.style\.display = 'none'/.test(html));

  /* PERO SE REARMA AL REABRIRSE. Sin esto, cambiar una fecha después de
     mandar dejaba una caja sin dónde escribir: un callejón sin salida. */
  const abre = html.slice(html.indexOf('function abreCaptura()'),
    html.indexOf('function cierraCaptura()'));
  cierto('y al reabrirse vuelve el campo', /captura-fila-caja'\)\.style\.display = ''/.test(abre));
  cierto('  y su botón de cambiar canal', /captura-cambia'\)\.style\.display = ''/.test(abre));
  cierto('  y el título de antes', /captura-titulo'\)\.textContent = 'Para este viaje/.test(abre));
  /* Lo que NO se borra es lo que ya tecleó: cambiar de fecha no es motivo
     para hacerle escribir su número otra vez. */
  igual('  pero no se le borra lo que escribió',
    /captura-dato'\)\.value = ''/.test(abre), false);
}

/* ============================================================ */
titulo('la pantalla revisa antes de mandar, y el servidor otra vez');
{
  const manda = html.slice(html.indexOf('function mandaSolicitud()'),
    html.indexOf("byId('captura-ir').addEventListener"));

  /* El navegador no es una defensa, es una cortesía: le ahorra un viaje de
     ida y vuelta a quien se equivocó de tecla. La defensa está en el
     servidor, y `probar-solicitud.cjs` la cuida. */
  cierto('avisa del campo vacío', /Escribe tu WhatsApp/.test(manda));

  /* ------------------------------------------------------------
     CAMBIÓ DE LADO EL 12-sep-2026, Y PARA BIEN

     Aquí se miraba la regla ESCRITA DENTRO de `mandaSolicitud()`: la
     cuenta de diez dígitos y la expresión del correo, con todo y sus
     caracteres. Ya no están ahí, y es el arreglo lo que las movió.

     El formulario de «Tus datos» —el que lleva a apartar— seguía dejando
     pasar «12» por teléfono, y al cerrarlo las dos pantallas quedaron con
     UNA sola regla: `telefonoBueno` y `correoBueno`. Dos reglas separadas
     se separan más, y entonces un teléfono que pasa en una pantalla se
     rechaza en la otra.

     Así que lo que se cuida aquí ya no es que la regla esté escrita, sino
     que esta pantalla USE la compartida. Que exista una sola y que los dos
     formularios la usen lo cuida `probar-recorrido.cjs`.
     ------------------------------------------------------------ */
  cierto('usa la regla compartida del teléfono', /telefonoBueno\(/.test(manda));
  cierto('y la compartida del correo', /correoBueno\(/.test(manda));

  /* Y ninguna de esas revisiones manda la petición. */
  const antesDeFetch = manda.slice(0, manda.indexOf('fetch('));
  igual('las tres cortan antes del fetch',
    (antesDeFetch.match(/return;/g) || []).length >= 3, true);

  /* El destino viaja como TEXTO: esta puerta no cotiza, escribe una ficha
     que va a leer una persona. */
  cierto('manda la acción', /accion: 'solicitud'/.test(manda));
  igual('y NO manda los días: los cuenta el servidor', /dias:/.test(manda), false);
}

/* ============================================================ */
titulo('el acuse no promete un vendedor que no se enteró');
{
  /* ------------------------------------------------------------
     12-sep-2026, y salió de R47.

     El aviso al vendedor sale POR CORREO, y puede fallar: Resend
     caído, la llave mal, `AVISOS_A` apuntando a nadie. Cuando falla,
     `avisa()` lo grita en el registro y ya — y la pantalla decía
     igual «Ya quedó: tu solicitud está con un vendedor».

     Hasta ayer eso tocaba a los 36 destinos que no cotizaban. Con R47
     la página no da NINGÚN precio, así que por ese correo pasan TODAS
     las cotizaciones: mal configurado, se pierden todas — y cada
     cliente se va convencido de que lo van a llamar.

     Es el mismo defecto que esta página ya pagó dos veces: el «te
     mandamos otro código» que se escribía antes de mandarlo, y los
     dos «Entrar» que contestaban sin preguntar. La regla que salió de
     aquéllos: NO SE PROMETE LO QUE TODAVÍA NO SE SABE.

     El arreglo no es enseñarle un error al cliente —él no tiene la
     culpa y sus datos sí se recibieron—: es que el acuse deje de
     AFIRMAR lo que no pasó, y empuje el botón de WhatsApp, que no
     depende de Resend y le llega al vendedor de inmediato.
     ------------------------------------------------------------ */
  const manda = html.slice(html.indexOf('function mandaSolicitud()'),
    html.indexOf("byId('captura-ir').addEventListener"));

  cierto('el servidor dice si el vendedor se enteró',
    /conVendedor:\s*!!salio\.alVendedor/.test(puerta));
  cierto('la pantalla lo lee', manda.indexOf('conVendedor') !== -1);

  /* Lo que no puede pasar: escribir «ya quedó» sin mirar si quedó. */
  const mira = manda.indexOf('conVendedor');
  const quedo = manda.indexOf('Ya quedó');
  cierto('y lo mira ANTES de escribir «ya quedó»',
    mira !== -1 && quedo !== -1 && mira < quedo);

  /* Y cuando no quedó, que haya salida: el botón de WhatsApp se
     enciende igual, porque es el camino que no depende del correo. */
  cierto('el botón de WhatsApp se enciende pase lo que pase',
    /captura-whats/.test(manda));
}

console.log('\n' + buenas + ' buenas, ' + malas + ' malas');
process.exit(malas ? 1 : 0);
