/* ============================================================
   EL CIERRE DEL MES (12-sep-2026)
   ============================================================
   Dictado del dueño:

     «Lo que quiero es que cada mes se suba toda la info que se
      generó a lo largo de conversaciones, cotizaciones, etc.»

     «Quiero que la IA aprenda de todas las conversaciones entre
      vendedores y clientes, que se vaya curtiendo y mejorando
      criterio.»

   Esto lo junta todo de una corrida:

     npm run mes

   ------------------------------------------------------------
   POR QUÉ HAY DOS SALIDAS, Y NO UNA
   ------------------------------------------------------------
   Lo que se junta son dos cosas distintas y NO pueden ir al mismo
   lugar:

   1. EL RESUMEN, que sí va al repositorio. Cuántas conversaciones
      hubo, cuántas llegaron a precio, cuántas se quedaron sin
      contestar, qué destinos pidieron. **No lleva un solo dato de
      una persona**: son cuentas.

        cerebro/el-mes.md        el resumen, dentro del criterio

   2. LAS CONVERSACIONES ENTERAS, que NO van al repositorio. Es el
      material del que se aprende a vender, y trae lo que la gente
      escribió: sus nombres, sus domicilios, sus teléfonos, a veces
      de qué es la fiesta. Eso en un repositorio de Git se queda
      para siempre y lo ve todo el que lo clone.

        conversaciones/AAAA-MM.md     fuera de Git (.gitignore)

      De ahí se leen en una sesión, y lo que se aprenda se escribe
      en el criterio con sus propias palabras. **Lo que sube al
      repositorio es la lección, no la conversación.**

   Si el dueño quiere que las conversaciones también se versionen,
   es cambiar el .gitignore — pero que sea porque él lo decidió,
   no porque un script lo hizo sin preguntar.

   ------------------------------------------------------------
   OJO CON LA FECHA: EL ALMACÉN TIRA LO VIEJO A LOS 45 DÍAS
   ------------------------------------------------------------
   `api/_almacen.js` purga `mensajes` y `charlas` a los
   `VIDA_DIAS` = 45. O sea que **«cada mes» no es una costumbre
   cómoda, es el mínimo**: si se salta un mes, ese mes de
   conversaciones ya no existe en ningún lado.

   Los `precios` NO se purgan, así que ésos no se pierden.

   ------------------------------------------------------------
   Necesita `ALMACEN_URL` y `ALMACEN_CLAVE`, las mismas de Vercel.
   Las busca en el entorno y luego en `.env.local`, que está en el
   .gitignore para que la llave nunca suba.
   ============================================================ */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.join(AQUI, '..');

/* Las llaves pueden vivir en `.env.local`, igual que la de Anthropic. */
if (!process.env.ALMACEN_URL || !process.env.ALMACEN_CLAVE) {
  try {
    const local = fs.readFileSync(path.join(RAIZ, '.env.local'), 'utf8');
    for (const nombre of ['ALMACEN_URL', 'ALMACEN_CLAVE']) {
      if (process.env[nombre]) continue;
      const m = local.match(new RegExp('^\\s*' + nombre + '\\s*=\\s*["\']?([^"\'\\r\\n]+)["\']?\\s*$', 'm'));
      if (m) process.env[nombre] = m[1].trim();
    }
  } catch (e) { /* sin archivo: se avisa abajo */ }
}

const URL_BASE = String(process.env.ALMACEN_URL || '').replace(/\/+$/, '');
const CLAVE = String(process.env.ALMACEN_CLAVE || '');

/* Los mismos números de prueba que aparta `precios-al-cerebro.mjs`. Van
   aquí por copia y no por importación a propósito: importar el otro
   script correría su lectura del entorno dos veces. Si se agrega un
   número de prueba hay que tocarlo en los dos, y
   `pruebas/probar-mes-al-cerebro.mjs` exige que digan lo mismo. */
const DE_PRUEBA = /^(52)?1?33(6667|1111)/;

/* ------------------------------------------------------------
   TRAER DEL ALMACÉN
   ------------------------------------------------------------ */
async function trae(tabla, filtro) {
  const filas = [];
  const DE_A = 1000;
  for (let desde = 0; ; desde += DE_A) {
    const r = await fetch(URL_BASE + '/rest/v1/' + tabla + '?select=*' + (filtro || '') +
      '&offset=' + desde + '&limit=' + DE_A, {
      headers: { apikey: CLAVE, Authorization: 'Bearer ' + CLAVE }
    });
    if (!r.ok) {
      const cuerpo = await r.text().catch(() => '');
      console.error('El almacén contestó ' + r.status + ' por `' + tabla + '`: ' + cuerpo.slice(0, 300));
      if (r.status === 404) {
        console.error('\nEsa tabla no existe. El esquema completo está en docs/ALMACEN.sql');
        console.error('y se pega en el editor SQL de Supabase.');
      }
      process.exit(3);
    }
    const lote = await r.json();
    filas.push(...lote);
    if (lote.length < DE_A) break;
  }
  return filas;
}

/* ------------------------------------------------------------
   AGRUPAR
   ------------------------------------------------------------
   Una conversación es todo lo de UN número, en orden. La llave ya
   viene normalizada a diez dígitos desde `_almacen.js`, que es lo
   que impide que «521 33…», «+52 1 33…» y «33…» sean tres personas.
   ------------------------------------------------------------ */
function porConversacion(mensajes) {
  const por = new Map();
  for (const m of mensajes || []) {
    if (!m || !m.numero) continue;
    if (DE_PRUEBA.test(String(m.numero))) continue;
    if (!por.has(m.numero)) por.set(m.numero, []);
    por.get(m.numero).push(m);
  }
  for (const lista of por.values()) {
    lista.sort((a, b) => String(a.cuando || '').localeCompare(String(b.cuando || '')));
  }
  return por;
}

/* ------------------------------------------------------------
   LAS CUENTAS DEL MES
   ------------------------------------------------------------
   Todo lo de aquí son NÚMEROS. Ni un nombre, ni un teléfono, ni una
   frase de nadie: esto es lo que sí sube al repositorio.
   ------------------------------------------------------------ */
function cuentasDelMes(por, precios) {
  const c = {
    conversaciones: por.size,
    mensajes: 0,
    delCliente: 0,
    delBot: 0,
    delVendedor: 0,
    conVendedor: 0,          // en cuántas entró una persona
    soloBot: 0,
    sinContestar: 0,         // el cliente escribió y nadie le respondió
    preciosNuevos: 0,
    preciosFijados: 0,       // los que él escribió a mano
    destinos: new Map()
  };

  for (const lista of por.values()) {
    let cliente = 0, bot = 0, vendedor = 0;
    for (const m of lista) {
      c.mensajes++;
      if (m.de === 'cliente') { cliente++; c.delCliente++; }
      else if (m.de === 'dueno') { vendedor++; c.delVendedor++; }
      else { bot++; c.delBot++; }
    }
    if (vendedor > 0) c.conVendedor++; else c.soloBot++;
    /* «Sin contestar» es que el último que habló fue el cliente: eso es
       una venta esperando, y es el número que más conviene mirar. */
    if (lista.length && lista[lista.length - 1].de === 'cliente') c.sinContestar++;
  }

  for (const p of precios || []) {
    if (!p || !(p.total > 0)) continue;
    if (DE_PRUEBA.test(String(p.cliente || ''))) continue;
    c.preciosNuevos++;
    if (p.fijado) c.preciosFijados++;
    const d = String(p.destino || '').trim();
    if (d) c.destinos.set(d, (c.destinos.get(d) || 0) + 1);
  }

  return c;
}

function laPaginaDelMes(c, periodo) {
  const l = [];
  l.push('# El mes, en números');
  l.push('');
  l.push('Lo que dejaron las conversaciones de **' + periodo + '**.');
  l.push('');
  l.push('> Se llena sola con `npm run mes`. Si corrijo algo aquí a mano, la');
  l.push('> siguiente corrida me lo pisa.');
  l.push('');
  l.push('**Aquí no hay datos de nadie, a propósito: son cuentas.** Las');
  l.push('conversaciones enteras quedan fuera del repositorio, en la carpeta');
  l.push('`conversaciones/`, y de ahí se lee para mejorar el criterio.');
  l.push('');

  if (!c.conversaciones) {
    l.push('---');
    l.push('');
    l.push('**Este mes no hubo ninguna conversación guardada.** Si el bot sí');
    l.push('estuvo contestando, lo que falta es el almacén: ver');
    l.push('`docs/EL-CIERRE-DEL-MES.md`.');
    l.push('');
    return l.join('\n') + '\n';
  }

  l.push('---');
  l.push('');
  l.push('## Cuánta gente escribió');
  l.push('');
  l.push('| | |');
  l.push('|---|---:|');
  l.push('| Conversaciones | **' + c.conversaciones + '** |');
  l.push('| Mensajes en total | ' + c.mensajes + '|');
  l.push('| …que escribió el cliente | ' + c.delCliente + ' |');
  l.push('| …que contestó el bot | ' + c.delBot + ' |');
  l.push('| …que contestó una persona | ' + c.delVendedor + ' |');
  l.push('');
  l.push('## En cuántas entró un vendedor');
  l.push('');
  l.push('| | |');
  l.push('|---|---:|');
  l.push('| Con una persona de por medio | **' + c.conVendedor + '** |');
  l.push('| Solo con el bot | ' + c.soloBot + ' |');
  l.push('');
  l.push('## La que duele');
  l.push('');
  l.push('**' + c.sinContestar + '** conversaciones se quedaron con el cliente');
  l.push('hablando al último. Cada una es alguien que preguntó y no volvió a');
  l.push('saber de nosotros.');
  l.push('');
  l.push('## Precios que se aprendieron');
  l.push('');
  l.push('**' + c.preciosNuevos + '** precios nuevos, de los cuales **' +
    c.preciosFijados + '** los escribí yo a mano y el resto fueron un «va» al');
  l.push('que calculó el sistema. La tabla está en [[precios-que-he-dado]].');
  l.push('');

  if (c.destinos.size) {
    const top = Array.from(c.destinos.entries())
      .sort((a, b) => b[1] - a[1] || String(a[0]).localeCompare(String(b[0])))
      .slice(0, 15);
    l.push('## Lo que más pidieron');
    l.push('');
    l.push('| Destino | Veces |');
    l.push('|---|---:|');
    for (const [d, n] of top) l.push('| ' + d + ' | ' + n + ' |');
    l.push('');
    l.push('Un destino que se repite y no está en el Excel es un renglón que');
    l.push('vale la pena agregarle: ahí es donde se va soltando el cotizador.');
    l.push('');
  }

  return l.join('\n') + '\n';
}

/* ------------------------------------------------------------
   LAS CONVERSACIONES ENTERAS
   ------------------------------------------------------------
   Esto NO sube a Git. Va tal cual porque el criterio de venta está en
   cómo se dijeron las cosas, y un resumen se lo come. El número se
   recorta a los últimos cuatro dígitos: alcanza para distinguir dos
   conversaciones sin escribir el teléfono completo en un archivo.
   ------------------------------------------------------------ */
function quienHablo(de) {
  if (de === 'cliente') return 'CLIENTE';
  if (de === 'dueno') return 'VENDEDOR';
  return 'BOT';
}

function lasConversaciones(por, periodo) {
  const l = [];
  l.push('# Conversaciones de ' + periodo);
  l.push('');
  l.push('**Este archivo NO está en Git** (ver `.gitignore`). Trae lo que la');
  l.push('gente escribió: nombres, domicilios, teléfonos. Se lee para sacar');
  l.push('criterio de venta, y lo que se aprenda se escribe en `cerebro/` con');
  l.push('palabras propias — la lección sube, la conversación no.');
  l.push('');
  l.push('Generado con `npm run mes`.');
  l.push('');

  let n = 0;
  for (const [numero, lista] of por) {
    n++;
    const cola = String(numero).slice(-4);
    const entroPersona = lista.some((m) => m.de === 'dueno');
    l.push('---');
    l.push('');
    l.push('## ' + n + ' · …' + cola + (entroPersona ? '  · entró un vendedor' : '  · solo el bot'));
    l.push('');
    for (const m of lista) {
      const cuando = String(m.cuando || '').slice(0, 16).replace('T', ' ');
      const texto = String(m.texto || '').replace(/\r?\n/g, '\n> ');
      l.push('**' + quienHablo(m.de) + '** · ' + cuando +
        (m.tipo && m.tipo !== 'texto' ? ' · (' + m.tipo + ')' : ''));
      l.push('');
      l.push('> ' + texto);
      l.push('');
    }
  }

  if (!n) {
    l.push('---');
    l.push('');
    l.push('No hubo conversaciones guardadas en este periodo.');
    l.push('');
  }

  return l.join('\n') + '\n';
}

/* ------------------------------------------------------------
   Se exportan para probar el FORMATO sin red ni almacén, igual que
   en `precios-al-cerebro.mjs`. Y por eso el script solo corre cuando
   se le llama directo, no cuando se le importa.
   ------------------------------------------------------------ */
export { porConversacion, cuentasDelMes, laPaginaDelMes, lasConversaciones, quienHablo, DE_PRUEBA };

const meLlamaronDirecto = process.argv[1] &&
  path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));

if (meLlamaronDirecto) {
  if (!URL_BASE || !CLAVE) {
    console.error('Faltan ALMACEN_URL y ALMACEN_CLAVE (en el entorno o en .env.local).');
    console.error('');
    console.error('Si todavía no existe el almacén, ése es el primer paso y no');
    console.error('es de código: crear el proyecto de Supabase y correr');
    console.error('docs/ALMACEN.sql. Mientras no exista, NADA se está guardando');
    console.error('—ni conversaciones ni precios— y este comando no tiene qué leer.');
    process.exit(2);
  }

  /* Cuántos días se juntan. Por omisión 31, y nunca más de 45, que es lo
     que el almacén guarda antes de purgar (`_almacen.js`, VIDA_DIAS).
     Pedir más daría un archivo con un hueco al principio y parecería que
     ese mes hubo poco movimiento. */
  const DIAS = Math.min(45, Math.max(1, Number(process.argv[2]) || 31));
  const desde = new Date(Date.now() - DIAS * 24 * 3600 * 1000);
  const corte = desde.toISOString();
  const periodo = corte.slice(0, 10) + ' a ' + new Date().toISOString().slice(0, 10);

  const mensajes = await trae('mensajes', '&cuando=gte.' + corte + '&order=cuando.asc');
  const precios = await trae('precios', '&cuando=gte.' + corte + '&order=cuando.desc');

  const por = porConversacion(mensajes);
  const c = cuentasDelMes(por, precios);

  const dondeCerebro = path.join(RAIZ, 'cerebro', 'el-mes.md');
  fs.writeFileSync(dondeCerebro, laPaginaDelMes(c, periodo), 'utf8');

  const carpeta = path.join(RAIZ, 'conversaciones');
  fs.mkdirSync(carpeta, { recursive: true });
  const dondeCrudo = path.join(carpeta, new Date().toISOString().slice(0, 7) + '.md');
  fs.writeFileSync(dondeCrudo, lasConversaciones(por, periodo), 'utf8');

  console.log('Últimos ' + DIAS + ' días · ' + periodo);
  console.log('');
  console.log('  ' + c.conversaciones + ' conversaciones, ' + c.mensajes + ' mensajes');
  console.log('  ' + c.conVendedor + ' con un vendedor de por medio');
  console.log('  ' + c.sinContestar + ' se quedaron con el cliente hablando al último');
  console.log('  ' + c.preciosNuevos + ' precios nuevos');
  console.log('');
  console.log('  ' + path.relative(RAIZ, dondeCerebro) + '   ← sube a Git');
  console.log('  ' + path.relative(RAIZ, dondeCrudo) + '   ← NO sube (datos de clientes)');
  console.log('');
  console.log('Falta el otro medio del cierre, que son los precios:');
  console.log('  npm run precios:cerebro');
}
