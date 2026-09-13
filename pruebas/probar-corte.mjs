/* ============================================================
   El corte de quincena, probado sin tocar el almacén
   ------------------------------------------------------------
       node pruebas/probar-corte.mjs

   `scripts/corte-al-cerebro.mjs` junta lo que dejó la quincena.
   Aquí se le dan renglones de mentiras y se comprueba lo que saca,
   igual que `probar-precios-al-cerebro.mjs` hace con los precios.

   QUÉ CUIDA, en orden de gravedad:

     1. QUE EL RESUMEN QUE SUBE A GIT NO LLEVE DATOS DE NADIE. Es lo
        único de aquí que es irreversible: un teléfono que se cuela a
        un commit se queda en el historial para siempre.
     2. Que las cuentas cuadren —y sobre todo «sin contestar», que es
        la que le dice al dueño cuánta venta se está quedando parada—.
     3. QUE DOS CORTES DE LA MISMA QUINCENA NO SE PISEN EL ARCHIVO.
        Ése es el que NO está en Git: lo que se pierda ahí no se
        recupera de ningún lado.
     4. Que se avise cuando pasó tanto tiempo que el almacén ya purgó.
     5. Que los números de prueba no ensucien el criterio.
   ============================================================ */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  porConversacion, cuentasDelMes, laPaginaDelMes, lasConversaciones, quienHablo,
  avisaDelAtraso, DE_PRUEBA
} from '../scripts/corte-al-cerebro.mjs';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.join(AQUI, '..');

let buenas = 0, malas = 0;
function cierto(nombre, v) {
  if (v) { buenas++; console.log('ok   ' + nombre); }
  else { malas++; console.log('MAL  ' + nombre); }
}
function igual(nombre, dio, esperado) {
  const a = JSON.stringify(dio), b = JSON.stringify(esperado);
  if (a === b) { buenas++; console.log('ok   ' + nombre); }
  else { malas++; console.log('MAL  ' + nombre + '\n     dio      ' + a + '\n     esperaba ' + b); }
}

/* ------------------------------------------------------------
   UN MES DE MENTIRAS, CON LOS CUATRO CASOS QUE IMPORTAN
   ------------------------------------------------------------
   · 3312223344 · el bot contesta y entra el vendedor, y cierra él
   · 3355667788 · solo el bot, y el CLIENTE habla al último  ← se perdió
   · 3399887766 · solo el bot, y el bot habla al último
   · 3366671234 · número de PRUEBA, no debe contar para nada
   ------------------------------------------------------------ */
const MENSAJES = [
  { numero: '3312223344', de: 'cliente', texto: 'Hola, quiero una Sprinter a Vallarta', cuando: '2026-09-02T10:00:00Z', tipo: 'texto' },
  { numero: '3312223344', de: 'bot', texto: '¿Para qué fechas?', cuando: '2026-09-02T10:00:30Z', tipo: 'texto' },
  { numero: '3312223344', de: 'cliente', texto: 'Del 20 al 23, somos 14. Soy Ana Ruiz, Av. Vallarta 1200', cuando: '2026-09-02T10:01:00Z', tipo: 'texto' },
  { numero: '3312223344', de: 'dueno', texto: 'Le salen en 22,000 con todo incluido', cuando: '2026-09-02T10:30:00Z', tipo: 'texto' },
  { numero: '3312223344', de: 'cliente', texto: 'Va, me interesa', cuando: '2026-09-02T10:35:00Z', tipo: 'texto' },
  { numero: '3312223344', de: 'dueno', texto: 'Perfecto, le mando el contrato', cuando: '2026-09-02T10:40:00Z', tipo: 'texto' },

  { numero: '3355667788', de: 'cliente', texto: 'buenas, autobus a mazatlan?', cuando: '2026-09-05T09:00:00Z', tipo: 'texto' },
  { numero: '3355667788', de: 'bot', texto: 'Con gusto, ¿qué fechas?', cuando: '2026-09-05T09:00:20Z', tipo: 'texto' },
  { numero: '3355667788', de: 'cliente', texto: 'para el 10 de diciembre', cuando: '2026-09-05T09:02:00Z', tipo: 'texto' },

  { numero: '3399887766', de: 'cliente', texto: 'precio suburban', cuando: '2026-09-07T08:00:00Z', tipo: 'texto' },
  { numero: '3399887766', de: 'bot', texto: 'Le paso el precio a la medida, ¿a dónde va?', cuando: '2026-09-07T08:00:10Z', tipo: 'texto' },

  { numero: '3366671234', de: 'cliente', texto: 'prueba prueba', cuando: '2026-09-08T08:00:00Z', tipo: 'texto' }
];

const PRECIOS = [
  { clave: 'zmg|puerto vallarta|sprinter|4', destino: 'Puerto Vallarta', unidad: 'Sprinter', total: 22000, fijado: true, cliente: '3312223344', cuando: '2026-09-02T10:30:00Z' },
  { clave: 'zmg|puerto vallarta|sprinter|2', destino: 'Puerto Vallarta', unidad: 'Sprinter', total: 16000, fijado: false, cliente: '3312223344', cuando: '2026-09-03T10:30:00Z' },
  { clave: 'zmg|chapala|sprinter|1', destino: 'Chapala', unidad: 'Sprinter', total: 6500, fijado: false, cliente: '3355667788', cuando: '2026-09-04T10:30:00Z' },
  /* De prueba: no es criterio. */
  { clave: 'zmg|x|sprinter|1', destino: 'Inventado', unidad: 'Sprinter', total: 999, fijado: true, cliente: '3366671234', cuando: '2026-09-08T10:30:00Z' },
  /* Sin total: tampoco cuenta. */
  { clave: 'zmg|y|sprinter|1', destino: 'Otro', unidad: 'Sprinter', total: 0, fijado: false, cliente: '3399887766', cuando: '2026-09-09T10:30:00Z' }
];

const por = porConversacion(MENSAJES);
const c = cuentasDelMes(por, PRECIOS);

console.log('--- agrupar ---');

igual('tres conversaciones, sin la de prueba', por.size, 3);
cierto('el número de prueba NO aparece', !por.has('3366671234'));
igual('cada conversación trae sus mensajes',
  Array.from(por.values()).map((l) => l.length), [6, 3, 2]);
igual('y en orden, del primero al último',
  por.get('3312223344').map((m) => m.de),
  ['cliente', 'bot', 'cliente', 'dueno', 'cliente', 'dueno']);

/* Llegan desordenados más seguido de lo que parece: el almacén los pide
   por fecha, pero dos mensajes del mismo segundo pueden venir al revés. */
const revueltos = porConversacion([MENSAJES[3], MENSAJES[0], MENSAJES[1]]);
igual('si llegan revueltos, se ordenan',
  revueltos.get('3312223344').map((m) => m.cuando.slice(11, 19)),
  ['10:00:00', '10:00:30', '10:30:00']);

console.log('\n--- las cuentas ---');

igual('conversaciones', c.conversaciones, 3);
igual('mensajes en total', c.mensajes, 11);
/* Contados a mano sobre MENSAJES, sin el de prueba:
     cliente  1,3,5 · 7,9 · 10  = 6
     bot      2 · 8 · 11        = 3
     vendedor 4,6               = 2
   Y los tres tienen que sumar los 11 de arriba: si una cuenta se
   desvía, la suma lo dice sin tener que volver a contar. */
igual('del cliente', c.delCliente, 6);
igual('del bot', c.delBot, 3);
igual('del vendedor', c.delVendedor, 2);
igual('y los tres suman el total',
  c.delCliente + c.delBot + c.delVendedor, c.mensajes);
igual('en una entró una persona', c.conVendedor, 1);
igual('las otras dos fueron solo del bot', c.soloBot, 2);

/* LA QUE MÁS IMPORTA. Es la única cuenta que le dice al dueño cuánta
   venta se quedó parada: el cliente preguntó y nadie le volvió a
   escribir. Si esta cuenta se rompe, el reporte se ve igual de bonito
   y deja de servir para lo único que sirve. */
igual('una se quedó con el cliente hablando al último', c.sinContestar, 1);

igual('precios nuevos, sin los de prueba ni los de cero', c.preciosNuevos, 3);
igual('de ésos, uno lo fijó él a mano', c.preciosFijados, 1);
igual('Vallarta se pidió dos veces', c.destinos.get('Puerto Vallarta'), 2);
cierto('el destino de prueba NO entró', !c.destinos.has('Inventado'));

console.log('\n--- el resumen que SÍ sube a Git ---');

const pagina = laPaginaDelMes(c, '2026-08-12 a 2026-09-12');

/* ------------------------------------------------------------
   ESTO ES LO IRREVERSIBLE
   ------------------------------------------------------------
   Un teléfono o un nombre que se cuele aquí entra a un commit, y de un
   commit ya no sale: aunque se borre el archivo, sigue en el historial
   y lo ve todo el que clone. Por eso se busca dato por dato, y no «que
   se vea bien».
   ------------------------------------------------------------ */
cierto('no lleva ningún teléfono completo', !/\d{10}/.test(pagina));
cierto('ni los últimos cuatro dígitos de nadie', pagina.indexOf('3344') === -1);
cierto('ni el nombre que escribió el cliente', pagina.indexOf('Ana Ruiz') === -1);
cierto('ni su domicilio', pagina.indexOf('Vallarta 1200') === -1);

/* NI UNA SOLA FRASE, Y SE COMPRUEBAN TODAS.
   La primera versión de esto miraba dos frases escogidas a dedo, y al
   romper el script a propósito —metiéndole el primer mensaje de cada
   conversación al resumen— el teléfono sí se cazó y LA FRASE NO. Una
   fuga que la prueba deja pasar es peor que no tener prueba, porque se
   firma el commit creyendo que está revisado. Ahora se recorren los
   mensajes del mes: ninguno puede aparecer en lo que sube a Git. */
const seColo = MENSAJES.filter((m) => pagina.indexOf(m.texto) !== -1);
igual('ni una sola frase de la conversación, de las ' + MENSAJES.length + ' del mes',
  seColo.map((m) => m.texto), []);

cierto('sí lleva las cuentas', pagina.indexOf('Conversaciones') !== -1);
cierto('y la de los que se quedaron esperando', /\*\*1\*\*\s*conversaciones/.test(pagina));
cierto('y los destinos más pedidos', pagina.indexOf('Puerto Vallarta') !== -1);
cierto('dice de dónde sale y que se pisa sola', pagina.indexOf('npm run corte') !== -1);
cierto('y avisa que las conversaciones NO están aquí',
  pagina.indexOf('conversaciones/') !== -1);

/* Un corte vacío no puede salir con una tabla de ceros que parezca un
   error: tiene que decir qué revisar. */
const vacia = laPaginaDelMes(cuentasDelMes(new Map(), []), 'un corte sin nada');
cierto('un corte vacío lo dice con todas sus letras',
  vacia.indexOf('no hubo ninguna conversación') !== -1);
cierto('y manda al almacén, que es lo que suele faltar',
  vacia.indexOf('EL-CORTE') !== -1);

console.log('\n--- las conversaciones, que NO suben ---');

const crudo = lasConversaciones(por, '2026-08-12 a 2026-09-12');

cierto('traen lo que se dijo, que es de lo que se aprende',
  crudo.indexOf('Le salen en 22,000') !== -1);
cierto('dicen quién habló', crudo.indexOf('VENDEDOR') !== -1 && crudo.indexOf('CLIENTE') !== -1);
cierto('marcan en cuál entró una persona', crudo.indexOf('entró un vendedor') !== -1);
cierto('y en cuál no', crudo.indexOf('solo el bot') !== -1);
cierto('avisan en la primera pantalla que no van a Git',
  crudo.slice(0, 400).indexOf('NO está en Git') !== -1);

/* El teléfono completo no se escribe ni aquí: para distinguir dos
   conversaciones alcanza con la cola. */
cierto('ni aquí se escribe el teléfono completo', !/\b\d{10}\b/.test(crudo));
cierto('pero sí la cola, para poder distinguirlas', crudo.indexOf('…3344') !== -1);

igual('quienHablo traduce los tres',
  ['cliente', 'bot', 'dueno', 'otra cosa'].map(quienHablo),
  ['CLIENTE', 'BOT', 'VENDEDOR', 'BOT']);

console.log('\n--- dos cortes en la misma quincena ---');

/* ------------------------------------------------------------
   EL DEFECTO QUE DESTAPÓ LA QUINCENA
   ------------------------------------------------------------
   La primera versión nombraba el archivo `AAAA-MM.md`, porque el
   corte iba a ser mensual. Al pasar a quince días —«entonces cada 15
   días almacenamos todo»— el segundo corte del mes le pasaba encima
   al primero, y se perdía la primera quincena ENTERA.

   Y en silencio, y del archivo que NO está en Git: no habría de dónde
   recuperarlo. Por eso el nombre lleva el día.
   ------------------------------------------------------------ */
const FUENTE = fs.readFileSync(path.join(RAIZ, 'scripts', 'corte-al-cerebro.mjs'), 'utf8');
const IGNORE = fs.readFileSync(path.join(RAIZ, '.gitignore'), 'utf8');
const ALMACEN = fs.readFileSync(path.join(RAIZ, 'api', '_almacen.js'), 'utf8');

cierto('el archivo se nombra con el DÍA, no solo con el mes',
  /carpeta,\s*hoy\s*\+\s*'\.md'/.test(FUENTE));
cierto('y ya no se nombra por mes (slice(0, 7))',
  FUENTE.indexOf("slice(0, 7)") === -1);

console.log('\n--- el aviso de atraso ---');

igual('sin cortes previos, es el primero',
  avisaDelAtraso([], '2026-09-12', 45).primero, true);
igual('y no regaña a nadie', avisaDelAtraso([], '2026-09-12', 45).aviso, '');

igual('a los 15 días, todo en orden',
  avisaDelAtraso(['2026-08-28.md'], '2026-09-12', 45).aviso, '');

const tarde = avisaDelAtraso(['2026-08-20.md'], '2026-09-12', 45);
igual('a los 23, avisa sin alarmar', [tarde.pasaron, tarde.perdido], [23, false]);
cierto('y dice cuál fue el corte pasado', tarde.aviso.indexOf('2026-08-20') !== -1);

/* LA QUE IMPORTA: pasado el tope del almacén, hubo conversaciones que
   se borraron sin que nadie las leyera. Eso no se deshace. */
const perdio = avisaDelAtraso(['2026-07-01.md'], '2026-09-12', 45);
igual('pasados los 45, dice que SE PERDIÓ', perdio.perdido, true);
cierto('y lo dice sin rodeos', /no se recupera/.test(perdio.aviso));

igual('toma el corte MÁS RECIENTE, no el primero de la lista',
  avisaDelAtraso(['2026-07-01.md', '2026-09-05.md', '2026-08-20.md'], '2026-09-12', 45).ultimo,
  '2026-09-05');
igual('y no se confunde con otros archivos de la carpeta',
  avisaDelAtraso(['LEEME.md', 'notas.txt', '2026-09-05.md'], '2026-09-12', 45).ultimo,
  '2026-09-05');

console.log('\n--- los candados del script ---');

/* Sin este renglón, el primer corte sube las conversaciones de los
   clientes al repositorio, y de ahí ya no salen. */
cierto('.gitignore aparta la carpeta de conversaciones',
  /^conversaciones\/$/m.test(IGNORE));

/* El almacén purga a los 45 días y el script trae su propia copia del
   número. Si allá se sube a 90 y aquí no, este script seguiría pidiendo
   de menos —y el aviso de atraso regañaría de más— sin que nadie lo
   note. */
const vida = (ALMACEN.match(/VIDA_DIAS\s*=\s*(\d+)/) || [])[1];
const vidaAqui = (FUENTE.match(/const VIDA_DIAS = (\d+);/) || [])[1];
igual('el script y el almacén dicen los mismos días', vidaAqui, vida);
cierto('y el script nunca pide más de lo que hay guardado',
  FUENTE.indexOf('Math.min(VIDA_DIAS') !== -1);

/* El trato son quince días, con uno de traslape para que un corte hecho
   tarde no deje hueco. */
cierto('por omisión junta dieciséis días', /Math\.max\(16,/.test(FUENTE));

/* Los números de prueba están escritos en los dos scripts del corte.
   Si se agrega uno y se olvida el otro, ese cliente de mentiras se
   cuela a la mitad del criterio. */
const PRECIOS_SCRIPT = fs.readFileSync(path.join(RAIZ, 'scripts', 'precios-al-cerebro.mjs'), 'utf8');
const aqui = (FUENTE.match(/const DE_PRUEBA = (\/.*\/);/) || [])[1];
const alla = (PRECIOS_SCRIPT.match(/const DE_PRUEBA = (\/.*\/);/) || [])[1];
igual('los dos scripts del corte apartan los mismos números de prueba', aqui, alla);
cierto('y son los que de verdad usa el código', String(DE_PRUEBA) === alla);

console.log('\n' + buenas + ' buenas, ' + malas + ' malas');
process.exit(malas ? 1 : 0);
