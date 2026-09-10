/* ============================================================
   DE QUÉ ZONA SALEN (10-sep-2026)
   ============================================================
   Dictado del dueño, palabra por palabra:

     «Lo único que quiero que reconozca el chatbot es si sale de la ZMG
      de Guadalajara o de Ocotlán, Yurécuaro, etc., para que el usuario
      pueda determinar el precio él, sin IA. Tu trabajo es aprender de
      precios y guardarlos.»

   O sea: el bot NO cobra el recargo, el bot lo SEÑALA. Por eso esto es
   una función aparte de `buscaOrigen`, que es la que decide dinero y que
   sigue exigiendo el estado escrito —hay otro Ocotlán en Oaxaca—.

   Aquí la ambigüedad no cuesta: el dueño lee el ticket y decide. Lo que
   sí costaba era callarla: por WhatsApp el cliente teclea «Ocotlán» a
   secas y hasta hoy se veía idéntico a uno de Guadalajara.
   ============================================================ */
'use strict';

const path = require('path');
const RAIZ = path.join(__dirname, '..');
const origenes = require(path.join(RAIZ, 'api', '_origenes.js'));
const aprendidos = require(path.join(RAIZ, 'api', '_precios-aprendidos.js'));

let buenas = 0, malas = 0;
function ok(que, condicion) {
  if (condicion) { buenas++; console.log('ok   ' + que); }
  else { malas++; console.log('FALLA ' + que); }
}
function titulo(t) { console.log('\n== ' + t.toUpperCase() + ' =='); }

titulo('la ZMG, escrita como la escriba el cliente');
{
  for (const t of ['Guadalajara', 'guadalajara', 'gdl', 'GDL', 'zmg', 'Zapopan', 'Tlaquepaque',
    'Tonalá', 'Tonala', 'Tlajomulco', 'El Salto', 'Zapotlanejo', 'de Guadalajara',
    'Guadalajara, Jalisco, México']) {
    const z = origenes.zonaDeSalida(t);
    ok('«' + t + '» es ZMG', z && z.tipo === 'zmg');
  }
}

titulo('las zonas con recargo, sin exigirle el estado al cliente');
{
  /* Ocotlán, fila 11 del Excel. */
  for (const t of ['Ocotlán', 'ocotlan', 'OCOTLAN', 'Ocotlán, Jalisco', 'Jamay',
    'Poncitlán', 'Tototlán', 'La Barca']) {
    const z = origenes.zonaDeSalida(t);
    ok('«' + t + '» es zona Ocotlán', z && z.tipo === 'recargo' && z.nombre === 'Ocotlán' && z.fila === 11);
  }
  /* Yurécuaro, fila 22. */
  for (const t of ['Yurécuaro', 'yurecuaro', 'Tanhuato', 'Degollado', 'Vista Hermosa']) {
    const z = origenes.zonaDeSalida(t);
    ok('«' + t + '» es zona Yurécuaro', z && z.tipo === 'recargo' && z.nombre === 'Yurécuaro' && z.fila === 22);
  }
}

titulo('no se adivina a lo tonto');
{
  /* El pueblo del mismo nombre en otro estado NO es éste. */
  const oax = origenes.zonaDeSalida('Ocotlán, Oaxaca');
  ok('«Ocotlán, Oaxaca» no se toma como el de Jalisco', oax && oax.tipo !== 'recargo');
  /* Y una ciudad cualquiera queda marcada para que él la revise. */
  for (const t of ['Colima', 'Aguascalientes', 'Puerto Vallarta', 'León']) {
    const z = origenes.zonaDeSalida(t);
    ok('«' + t + '» queda como «otra», para revisar', z && z.tipo === 'otra');
  }
  ok('sin origen no inventa nada', origenes.zonaDeSalida('') === null);
  ok('null tampoco', origenes.zonaDeSalida(null) === null);
}

titulo('cómo se lo dice el ticket al dueño');
{
  ok('la ZMG se dice sin recargo', /ZMG.*sin recargo/.test(origenes.comoSeDiceLaZona('Zapopan')));
  const oco = origenes.comoSeDiceLaZona('ocotlan');
  ok('Ocotlán dice que LLEVA RECARGO', /LLEVA RECARGO/.test(oco));
  ok('  y de qué fila del Excel sale', /fila 11 del Excel/.test(oco));
  const tan = origenes.comoSeDiceLaZona('Tanhuato');
  ok('un pueblo dice su nombre Y su zona', /Tanhuato/.test(tan) && /Yur[eé]cuaro/.test(tan));
  ok('lo desconocido pide revisión', /rev[ií]salo/.test(origenes.comoSeDiceLaZona('Colima')));
}

titulo('lo aprendido se junta por zona, que es de lo que sirve');
{
  const base = { destino: 'Chapala', salida: '2026-11-20', regreso: '2026-11-22' };
  const clave = (o) => aprendidos.claveDe(Object.assign({ origen: o }, base), 'Sprinter');

  /* Antes esto eran cinco viajes distintos y el precio que el dueño dio
     una vez no se le volvía a sugerir nunca. */
  const zmg = ['Guadalajara', 'gdl', 'Zapopan', 'Tlaquepaque', 'de Guadalajara'].map(clave);
  ok('toda la ZMG comparte una sola llave', new Set(zmg).size === 1);

  const ocotlan = ['Ocotlán', 'ocotlan', 'Jamay', 'La Barca'].map(clave);
  ok('la zona de Ocotlán comparte la suya', new Set(ocotlan).size === 1);

  ok('  y no se mezcla con la ZMG', ocotlan[0] !== zmg[0]);
  ok('Yurécuaro va aparte de las dos',
    new Set([zmg[0], ocotlan[0], clave('Tanhuato')]).size === 3);

  /* Lo que NO debe juntar: dos destinos distintos desde la misma zona. */
  ok('el destino sigue separando viajes',
    clave('Guadalajara') !== aprendidos.claveDe({ origen: 'Guadalajara', destino: 'Tequila',
      salida: '2026-11-20', regreso: '2026-11-22' }, 'Sprinter'));
}

console.log('\n' + buenas + ' buenas, ' + malas + ' malas');
process.exit(malas ? 1 : 0);
