/* ============================================================
   UNA CALLE NO ES UN DESTINO (10-sep-2026)
   ============================================================
   Los `busca` de `api/_destinos.js` son subcadenas, y en Guadalajara
   hay calles que se llaman como medio país. Salidas reales de la
   auditoría del 10-sep-2026, con el precio que cobraban:

     «La Barranca de Huentitán, Guadalajara» -> Barrancas del Cobre
        $57,000 por un paseo de 24 km dentro de la ciudad
     «Una cancha en Zapopan»                 -> Cancún      $81,000
     «Av. Vallarta 1234, Guadalajara»        -> Puerto Vallarta $19,000
     «Calle Puebla 55, Guadalajara»          -> Puebla      $36,500
     «Av. Morelia 200, Guadalajara»          -> Morelia     $19,000

   Los cinco son cobros de MÁS, y de los que se ven en el primer
   mensaje: el cliente lee el precio y se va. Ninguna prueba los
   cazaba porque TODAS usan nombres de ciudad —que es como se escribe
   un destino— y no direcciones. Y el cliente que afina su dirección
   en Google es justo el que va en serio.

   Al revés también se pagaba: «León, Gto.» —como lo escribe Google—
   no empataba con `/le[oó]n, guanajuato/` y se iba por fórmula, o sea
   $1,300 MENOS que el precio que el dueño corrigió a mano (R46).
   ============================================================ */
'use strict';

const path = require('path');
const RAIZ = path.join(__dirname, '..');
const destinos = require(path.join(RAIZ, 'api', '_destinos.js'));

let buenas = 0, malas = 0;
function ok(que, condicion) {
  if (condicion) { buenas++; console.log('ok   ' + que); }
  else { malas++; console.log('FALLA ' + que); }
}
function titulo(t) { console.log('\n== ' + t.toUpperCase() + ' =='); }

function cual(direccion) {
  const r = destinos.buscaDestino({ direccion: direccion });
  return r ? r.nombre : null;
}

titulo('una dirección de Guadalajara no es un viaje al otro lado del país');
{
  /* Cada renglón: la dirección, y el destino que cobraba antes. */
  const calles = [
    ['La Barranca de Huentitán, Guadalajara, Jal.', 'Barrancas del Cobre'],
    ['Mirador de la Barranca, Guadalajara', 'Barrancas del Cobre'],
    ['Una cancha en Zapopan', 'Cancún'],
    ['Av. Vallarta 1234, Guadalajara', 'Puerto Vallarta y alrededores'],
    ['Calle Puebla 55, Guadalajara', 'Puebla'],
    ['Av. Morelia 200, Guadalajara', 'Morelia'],
    ['Plaza Vallarta, Zapopan', 'Puerto Vallarta y alrededores'],
    ['Colonia Morelia, Guadalajara', 'Morelia'],
    ['Privada Tequila 12, Tlaquepaque', 'Tequila / Guachimontones'],
    ['Calzada Independencia, Guadalajara', null]
  ];
  for (const [direccion, cobrabaAntes] of calles) {
    const hoy = cual(direccion);
    ok('«' + direccion + '» va por fórmula' +
      (cobrabaAntes ? ' (cobraba ' + cobrabaAntes + ')' : ''), hoy === null);
  }
}

titulo('y los destinos de verdad siguen en su renglón');
{
  const ciudades = [
    ['Barrancas del Cobre, Chih.', 'Barrancas del Cobre'],
    ['Creel, Chihuahua', 'Barrancas del Cobre'],
    ['Cancún, Q.R.', 'Cancún'],
    ['Cancún, Quintana Roo', 'Cancún'],
    ['Riviera Maya', 'Cancún'],
    ['Playa del Carmen', 'Cancún'],
    ['Tulum, Q.R.', 'Cancún'],
    ['Puerto Vallarta, Jal.', 'Puerto Vallarta y alrededores'],
    ['Nuevo Vallarta, Nay.', 'Puerto Vallarta y alrededores'],
    ['Puebla, Pue.', 'Puebla'],
    ['Morelia, Mich.', 'Morelia'],
    ['Chapala, Jal.', 'Chapala'],
    ['Tequila, Jal.', 'Tequila / Guachimontones'],
    ['Mazatlán, Sin.', 'Mazatlán'],
    ['Ciudad de México, CDMX', 'Ciudad de México'],
    /* Los tres del bloque PRIMERO: el nombre del grande viene dentro
       de la dirección del chico y tienen que ganar ellos. */
    ['Zacatlán, Puebla', 'Puebla con Zacatlán'],
    ['Mismaloya, Puerto Vallarta', 'Mismaloya'],
    ['San Miguel de Allende, Gto.', 'San Miguel de Allende']
  ];
  for (const [direccion, esperado] of ciudades) {
    ok('«' + direccion + '» sigue siendo ' + esperado, cual(direccion) === esperado);
  }

  /* «Carretera a X» y «camino a X» SÍ nombran el destino: por eso no
     entran en la lista de palabras de calle. */
  ok('«Carretera a Chapala km 20» sigue siendo Chapala',
    cual('Carretera a Chapala km 20') === 'Chapala');
}

titulo('León con la dirección exacta de Google');
{
  ok('la dirección completa vuelve a la lista',
    cual('Blvd. Adolfo López Mateos 1927, San Miguel, 37380 León, Gto., México') === 'León');
  ok('«León, Guanajuato» escrito completo también', cual('León, Guanajuato') === 'León');
  ok('«León» a secas también', cual('León') === 'León');
  /* Y no se confunde con Nuevo León: ahí el estado es «N.L.». */
  ok('«Monterrey, Nuevo León» sigue siendo Monterrey', cual('Monterrey, Nuevo León') === 'Monterrey');
  ok('«San Pedro Garza García, Nuevo León» también', cual('San Pedro Garza García, Nuevo León') === 'Monterrey');
}

console.log('\n' + buenas + ' buenas, ' + malas + ' malas');
process.exit(malas ? 1 : 0);
