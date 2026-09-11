/* ============================================================
   EL RENGLÓN DEL EXCEL PARA CADA CAMIÓN (10-sep-2026)
   ============================================================
   Dictado del dueño: «hagas toda una fórmula para que vayas aprendiendo
   de precios y registrándolos… de esa manera, desde el cotizador en
   línea, puedo registrar todo: Irizars, camiones, todo tipo de camiones».

   Lo primero que apareció al buscarlo fue que **los precios de camión ya
   estaban escritos y nadie los leía**. `api/_destinos.js` guarda las
   siete columnas del Excel por destino, pero `claveDeUnidad`
   (`api/_tarifa.js`) conoce una sola unidad —la Sprinter— y las dos
   llamadas a `precioDeLista` acaban en `|| 'sprinter'`. Chapala en
   Century de 47 ($10,500) y Vallarta en Marcopolo ($38,000) llevaban
   meses guardados y muertos: el ticket del dueño decía «No pude
   calcularlo».

   Esta batería compara, columna por columna, lo que el sistema enseña
   contra `docs/LO-QUE-TENGO-GUARDADO.md`, que es la copia de su Excel.

   Y vigila los dos candados que el dueño puso ese día:

     · «solo en tu ticket, por ahora» — la página pública NO se abrió:
       `/api/cotizar` y `/api/pagar` siguen rechazando camiones.
     · la Sprinter no cambia ni un peso.
   ============================================================ */
'use strict';

const path = require('path');
const RAIZ = path.join(__dirname, '..');
const destinos = require(path.join(RAIZ, 'api', '_destinos.js'));
const tarifa = require(path.join(RAIZ, 'api', '_tarifa.js'));

let buenas = 0, malas = 0;
function ok(que, condicion) {
  if (condicion) { buenas++; console.log('ok   ' + que); }
  else { malas++; console.log('FALLA ' + que); }
}
function titulo(t) { console.log('\n== ' + t.toUpperCase() + ' =='); }

/* Lo que dice el Excel, copiado de docs/LO-QUE-TENGO-GUARDADO.md.
   Orden: NC47 · 48/49 · Neobus i6 · PB i6 · Marcopolo · Irizar.
   `null` = esa celda viene vacía en su tabla. */
const EXCEL = {
  'Chapala, Jal.':            [10500, 12000, 13000, 12000, 15000, 14000],
  'Tequila, Jal.':            [12000, 13000, 15000, 14000, 17000, 16000],
  'Tapalpa, Jal.':            [24000, 25000, 27000, 26000, 29000, 28000],
  'Mazamitla, Jal.':          [24000, 25000, 27000, 26000, 29000, 28000],
  'Rincón de Guayabitos':     [29000, 30000, 32000, 32000, 36000, 34000],
  'Chacala, Nay.':            [28000, 29000, 31000, 30000, 35000, 33000],
  'Manzanillo, Col.':         [30000, 31000, 33000, 32000, 37000, 35000],
  'Puerto Vallarta, Jal.':    [32000, 33000, 34000, 34000, 38000, 36000],
  'Punta Perula, Jal.':       [34000, 35000, 37000, 36000, 41000, 39000],
  /* Parciales: su Excel solo trae la primera columna, o las dos primeras. */
  'San Juan de los Lagos, Jal.': [24000, null, null, null, null, null],
  'Camécuaro, Mich.':         [26000, null, null, null, null, null],
  'El Manto, Jal.':           [22000, null, null, null, null, null],
  'Morelia, Mich.':           [30000, null, null, null, null, null],
  'Talpa de Allende, Jal.':   [26000, 27000, null, null, null, null],
  'Guanajuato, Gto.':         [30000, 31000, null, null, null, null]
};

/* De la columna del Excel al `id` de la unidad, según la correspondencia
   que dictó el dueño el 10-sep-2026 y la que se dedujo por nombre. */
const COLUMNAS = [
  { i: 0, columna: 'NC47',      unidad: 'irizar',     nota: 'Century de 47' },
  { i: 1, columna: '48/49',     unidad: 'irizar',     nota: 'Century de 49' },
  { i: 2, columna: 'Neobus i6', unidad: 'neobus',     nota: 'Neobus' },
  { i: 3, columna: 'PB i6',     unidad: 'irizar-pb',  nota: 'Irizar PB' },
  { i: 4, columna: 'Marcopolo', unidad: 'g8',         nota: 'Marcopolo Paradiso G8' },
  { i: 5, columna: 'Irizar',    unidad: 'irizar-i6s', nota: 'Irizar i6 / i6S' }
];

titulo('cada número que se enseña es el de su Excel');
{
  for (const destino of Object.keys(EXCEL)) {
    const suExcel = EXCEL[destino];
    for (const c of COLUMNAS) {
      const esperado = suExcel[c.i];
      const dio = destinos.preciosDeListaDeUnidad(destino, c.unidad)
        .filter(function (p) { return p.comoSeLlama === c.columna; })[0];
      if (esperado === null) {
        ok(destino + ' · ' + c.columna + ': su Excel no lo trae, no se inventa', !dio);
      } else {
        ok(destino + ' · ' + c.columna + ' = $' + esperado.toLocaleString('en-US'),
          !!dio && dio.total === esperado);
      }
    }
  }
}

titulo('el Century enseña sus DOS columnas, porque el Excel tiene dos');
{
  /* El catálogo tiene UNA unidad («Irizar Century, 47 a 49 pasajeros») y el
     Excel tiene dos columnas. No se escoge por el dueño. */
  const dos = destinos.preciosDeListaDeUnidad('Puerto Vallarta, Jal.', 'irizar');
  ok('salen las dos', dos.length === 2);
  ok('  la de 47 en $32,000', dos[0] && dos[0].total === 32000 && dos[0].comoSeLlama === 'NC47');
  ok('  la de 49 en $33,000', dos[1] && dos[1].total === 33000 && dos[1].comoSeLlama === '48/49');
}

titulo('lo que NO tiene columna sigue pidiendo el precio');
{
  /* Destinos cuya fila del Excel no trae ningún camión. */
  for (const d of ['Tepic, Nay.', 'León, Gto.', 'Monterrey, N.L.']) {
    ok(d + ': ningún camión', destinos.preciosDeListaDeUnidad(d, 'g8').length === 0);
  }
  /* Destino que no está en la lista: va por fórmula, y la fórmula no sabe
     de camiones. Nunca debe salir un número. */
  ok('Sahuayo (fuera de la lista): ningún número',
    destinos.preciosDeListaDeUnidad('Sahuayo, Mich.', 'g8').length === 0);
  /* La Suburban no tiene columna en su Excel. */
  ok('Suburban: no tiene columna en el Excel',
    destinos.preciosDeListaDeUnidad('Chapala, Jal.', 'suburban').length === 0);
  /* Y una unidad que no existe no truena ni inventa. */
  ok('una unidad inventada no truena',
    destinos.preciosDeListaDeUnidad('Chapala, Jal.', 'autobus-espacial').length === 0);
  ok('sin unidad tampoco', destinos.preciosDeListaDeUnidad('Chapala, Jal.', '').length === 0);
  ok('sin destino tampoco', destinos.preciosDeListaDeUnidad('', 'g8').length === 0);
}

titulo('el destino se reconoce igual escrito de las dos formas');
{
  /* Por WhatsApp llega una cadena pelona; del cotizador llega el objeto de
     Google. Pasarle la cadena devolvía null en silencio y TODO salía «sin
     columna» — se cazó al probarlo. */
  const cadena = destinos.preciosDeListaDeUnidad('Chapala, Jal.', 'g8');
  const objeto = destinos.preciosDeListaDeUnidad({ direccion: 'Chapala, Jal.' }, 'g8');
  ok('la cadena y el objeto dan lo mismo',
    cadena.length === 1 && objeto.length === 1 && cadena[0].total === objeto[0].total);
}

titulo('la página pública NO se abrió: los camiones se siguen rechazando');
{
  /* Éste es el candado que el dueño pidió expresamente («solo en tu
     ticket, por ahora»). Si alguna vez se rompe, el cotizador empezaría a
     cobrar camiones con la fórmula de la van, que es lo que ya pasó una
     vez y costó $17,000 en un solo viaje. */
  for (const u of ['Marcopolo Paradiso G8', 'Irizar i6S', 'Neobus', 'Irizar PB', 'Suburban']) {
    ok('«' + u + '» sigue sin cotizador automático', !tarifa.seSabeCotizar(u));
  }
  ok('y la Sprinter sí', tarifa.seSabeCotizar('Sprinter'));
}

titulo('el renglón del Excel es SOLO para lo que el motor no sabe cotizar');
{
  /* ------------------------------------------------------------
     Esta es la condición exacta que decide si el ticket enseña el
     renglón del Excel (`api/whatsapp.mjs`, dentro de `ticketDePrecio`):
     se enseña cuando el motor NO sabe cotizar esa unidad.

     Por qué importa: si la unidad sí tiene cotizador —hoy solo la
     Sprinter— y aun así no salió número, eso es una FALLA, no un hueco.
     La columna del Excel es el precio BASE del destino: no trae los
     días, ni el recargo de salida, ni los movimientos. Enseñarla ahí
     sería cobrar de menos sin que se note.

     Se cazó en la corrida real del 10-sep-2026, escenario u: el cliente
     cambió la fecha, la segunda cotización se quedó sin `cotiza` y el
     ticket pasó de «Calculado: $7,000» a «Del Excel: $7,000». En
     Tequila a un día daba lo mismo; en uno de cinco, no.

     Vuelto a correr con el modelo de verdad después del arreglo, el
     mismo escenario dice «No pude calcularlo: escríbeme el precio»,
     que es la respuesta honesta.
     ------------------------------------------------------------ */
  const ensenaElExcel = (u) => !tarifa.seSabeCotizar(u) &&
    destinos.preciosDeListaDeUnidad('Puerto Vallarta, Jal.', {
      'Sprinter': 'sprinter', 'Marcopolo Paradiso G8': 'g8', 'Neobus': 'neobus',
      'Irizar PB': 'irizar-pb', 'Suburban': 'suburban'
    }[u]).length > 0;

  ok('la Sprinter NO lo enseña (su precio lo calcula el motor)', !ensenaElExcel('Sprinter'));
  ok('el Marcopolo sí', ensenaElExcel('Marcopolo Paradiso G8'));
  ok('el Neobus sí', ensenaElExcel('Neobus'));
  ok('el PB sí', ensenaElExcel('Irizar PB'));
  ok('la Suburban no, porque no tiene columna', !ensenaElExcel('Suburban'));
}

titulo('la Sprinter no cambió ni un peso');
{
  /* Barrido de todos los destinos del catálogo: el precio de lista de la
     Sprinter tiene que ser exactamente el mismo que antes de este cambio,
     que es el que devuelve `precioDeLista`, la función de siempre. */
  let distintos = 0, revisados = 0;
  for (const d of destinos.DESTINOS) {
    const viejo = destinos.precioDeLista({ direccion: d.nombre }, 'sprinter');
    const nuevo = destinos.preciosDeListaDeUnidad(d.nombre, 'sprinter')[0];
    if (!viejo) continue;
    revisados++;
    if (!nuevo || nuevo.total !== viejo.precio) distintos++;
  }
  ok('los ' + revisados + ' destinos con Sprinter dan el mismo número', distintos === 0);
}

console.log('\n' + buenas + ' buenas, ' + malas + ' malas');
process.exit(malas ? 1 : 0);
