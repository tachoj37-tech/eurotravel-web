/* ============================================================
   LO QUE ENCONTRÓ EL CLIENTE DIFÍCIL (11-sep-2026)
   ============================================================
   Dictado del dueño: «encuentra preguntas repetidas, encuentra
   olvidadas, se le olvidan las cosas, encuentra que se clave en el
   número de personas… ponte en modo tonto cuando le hables al chatbot».

   Se escribieron doce conversaciones nuevas en `scripts/conversar.mjs`
   —el que se contradice, el que contesta con preguntas, el que dice que
   sí a todo, el que escribe una palabra por mensaje— y se corrieron con
   el modelo de verdad. Salieron tres defectos, y los tres son de los que
   no truenan: el bot sigue hablando como si nada.

   Esta batería los fija. Cada bloque dice de qué conversación salió.
   ============================================================ */
'use strict';

const path = require('path');
const RAIZ = path.join(__dirname, '..');
const conv = require(path.join(RAIZ, 'bot.js'));

let buenas = 0, malas = 0;
function ok(que, condicion) {
  if (condicion) { buenas++; console.log('ok   ' + que); }
  else { malas++; console.log('FALLA ' + que); }
}
function titulo(t) { console.log('\n== ' + t.toUpperCase() + ' =='); }

const HOY = '2026-09-11';
function corre(msgs) {
  let e = null, r = null;
  for (const m of msgs) { r = conv.respuestaA(m, e, HOY); e = r.estado; }
  return { ultimo: r, estado: e };
}

titulo('el mes y el día en dos mensajes (escenario bk)');
{
  /* El cliente escribió «diciembre» y en el mensaje siguiente «20». El
     «20» se leía SOLO, sin el mes, y se resolvía al 20 más cercano desde
     hoy: 20 de SEPTIEMBRE. Tres meses de diferencia.

     Y el modelo, que sí tenía la plática, le contestaba «Listo, 20 de
     diciembre». O sea: el bot decía diciembre y el sistema guardaba
     septiembre. De ahí salen el precio, el calendario y el contrato — no
     se ve hasta que el camión no llega el día que era. */
  const r = corre(['hola', 'vallarta', '45', 'diciembre', '20', '22']);
  ok('«diciembre» + «20» es el 20 de DICIEMBRE', r.estado.salida === '2026-12-20');
  ok('  y el regreso se ancla al mismo mes', r.estado.regreso === '2026-12-22');

  ok('«en enero» + «5» es el 5 de enero', corre(['a chapala', 'somos 12', 'en enero', '5']).estado.salida === '2027-01-05');
  ok('«para octubre» + «el 8» es el 8 de octubre',
    corre(['a chapala', 'somos 12', 'para octubre', 'el 8']).estado.salida === '2026-10-08');

  /* Y lo de siempre no se movió. */
  ok('«20 de diciembre» de un jalón sigue igual',
    corre(['hola', 'vallarta', '45', '20 de diciembre']).estado.salida === '2026-12-20');
  ok('«20/12» con diagonal también', corre(['a chapala', 'somos 12', '20/12']).estado.salida === '2026-12-20');
  ok('«mañana» sigue siendo mañana', corre(['a chapala', 'somos 12', 'mañana']).estado.salida === '2026-09-12');
  ok('un día suelto SIN mes dicho se lee como siempre',
    corre(['a chapala', 'somos 12', '20']).estado.salida === '2026-09-20');

  /* El mes solo no se traga en silencio: se pregunta el día. */
  const soloMes = corre(['a chapala', 'somos 12', 'diciembre']);
  ok('un mes sin día pregunta QUÉ día', /qu[ée] d[ií]a de diciembre/i.test(soloMes.ultimo.texto));
  ok('  y no inventa una fecha', !soloMes.estado.salida);
}

titulo('una dirección no es una ciudad (escenario bh)');
{
  /* «Nos recogen en hidalgo 45 a las 6 de la mañana» dejaba el viaje con
     el origen en «Hidalgo 45». El resumen decía «📍 Hidalgo 45 →
     Tequila», el bot ya no preguntaba de qué ciudad salían, y esa cadena
     habría viajado al contrato.

     Y cuesta dinero: el origen decide el recargo de salida. Una
     dirección no empata con ninguna zona, así que un grupo de Ocotlán
     que da su calle se cotiza como si saliera de Guadalajara. */
  function hastaOrigen(m) {
    return corre(['a tequila somos 12', '20 de octubre', '22 de octubre', m]);
  }
  for (const d of ['hidalgo 45', 'av vallarta 1234', 'calle morelos 200', 'colonia centro']) {
    const r = hastaOrigen(d);
    ok('«' + d + '» no se guarda como ciudad', !r.estado.origen);
    ok('  y se le pide la ciudad', /de qu[ée] \*?ciudad\*? salen/i.test(r.ultimo.texto));
  }
  for (const c of ['guadalajara', 'ocotlan', 'zapopan', 'san juan de los lagos']) {
    ok('«' + c + '» sí es ciudad', !!hastaOrigen(c).estado.origen);
  }

  /* Y por el camino de la IA, que es por donde entró de verdad. */
  const porLaIA = (o) => (conv.pegaDatos({ paso: 'origen', destino: 'Tequila', gente: 12 }, { origen: o }) || {}).origen;
  ok('la IA tampoco puede meter una dirección', !porLaIA('Hidalgo 45'));
  ok('  ni una avenida con número', !porLaIA('Av. Vallarta 1234'));
  ok('  pero una ciudad sí pasa', porLaIA('Ocotlán') === 'Ocotlán');
  ok('  y la zona metropolitana se sigue normalizando', porLaIA('Zapopan') === 'Guadalajara');
}

titulo('el catálogo se manda completo (escenario az)');
{
  /* El motor le pasó al modelo la lista de los siete autobuses que le
     caben a un grupo de 45, con la instrucción de mandarla «TAL CUAL».
     El modelo la reescribió con sus palabras y se comió el Irizar i6 51
     — el que se acababa de dar de alta, o sea el que nadie iba a echar
     de menos. Un camión que no aparece es un camión que no se vende.

     Aquí se comprueba lo que el MOTOR manda, que es la fuente. El
     guardia que caza al modelo vive en `api/whatsapp.mjs` y tiene su
     prueba en la corrida con el modelo real. */
  const lista = conv.mensajeDeAutobuses(45);
  const buses = (conv.UNIDADES || []).filter(function (u) { return u.cat === 'autobus'; });
  const faltan = buses.filter(function (u) { return lista.indexOf(u.name) === -1; })
    .map(function (u) { return u.name; });
  ok('la lista para 45 trae los ' + buses.length + ' autobuses', faltan.length === 0);
  if (faltan.length) console.log('     faltaron: ' + faltan.join(', '));

  const todos = conv.mensajeDeTodosLosAutobuses();
  const faltan2 = buses.filter(function (u) { return todos.indexOf(u.name) === -1; })
    .map(function (u) { return u.name; });
  ok('y la lista completa también', faltan2.length === 0);

  /* El Century dice su rango de verdad, no un número redondeado. */
  ok('el Century dice «47 a 49», no «47»', /47 a 49/.test(lista));
}

titulo('se contradice con el número de personas (escenario az)');
{
  /* Dijo 45, luego 15, luego 45 otra vez. Manda el último. */
  const r = corre(['hola quiero cotizar a vallarta', 'somos 45', 'no perdón somos 15', 'ah no, al final sí somos 45']);
  ok('se queda con el último número que dijo', r.estado.gente === 45);

  /* Y la corrección a media cotización, que es la que se clavaba: esto
     solo llenaba el hueco si estaba VACÍO, así que «somos 40» y luego
     «perdón somos 12» dejaba el viaje en 40 sin decir nada. Es el defecto
     que el dueño ha reportado más veces con sus palabras: «se clava con
     el número de personas». */
  const s = corre(['a chapala', 'somos 40', 'perdón somos 12']);
  ok('corrige el número a media cotización', s.estado.gente === 12);
  ok('  y lo acusa, no se lo traga', /Son \*12\*/.test(s.ultimo.texto));

  /* Y si con el número nuevo ya no cabe la unidad que había, se suelta:
     un autobús para doce personas es tan malo como una van para cuarenta. */
  const t = corre(['a vallarta somos 45', '20 de octubre', 'perdón somos 12']);
  ok('el autobús se suelta cuando bajan a 12', !t.estado.unidad);
  const u = corre(['a vallarta somos 12', '20 de octubre', 'perdón somos 45']);
  ok('y la Sprinter se suelta cuando suben a 45', u.estado.unidad !== 'sprinter');
}

console.log('\n' + buenas + ' buenas, ' + malas + ' malas');
process.exit(malas ? 1 : 0);
