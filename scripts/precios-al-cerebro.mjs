/* ============================================================
   LO QUE EL DUEÑO YA COTIZÓ, VOLCADO AL CEREBRO (10-sep-2026)
   ============================================================
   Dictado suyo, al preguntarle dónde quería ver los precios aprendidos:
   «no puedes guardarlo en el cerebro de criterio». Sí se puede, y aquí
   está — pero con un paso a mano, y conviene entender por qué.

   El bot corre en Vercel. Su disco es de SOLO LECTURA y no puede hacer
   commits, así que el bot no puede escribir un archivo del repositorio
   aunque quiera. Lo que sí hace, y ya hacía, es guardar cada precio que
   él confirma en la tabla `precios` de Supabase (`api/_almacen.js`).

   Este script cierra el círculo: lee esa tabla y escribe dos archivos.

     cerebro/precios-que-he-dado.md   el resumen, con sus enlaces
     docs/PRECIOS-QUE-HE-DADO.md     la tabla completa

   Dos y no uno porque el cerebro es MAPA, no copia: eso ya está dicho en
   `cerebro/MAPA.md` y se respeta.

   Se corre a mano cuando haya algo nuevo que leer:

     npm run precios:cerebro

   Necesita `ALMACEN_URL` y `ALMACEN_CLAVE` (las mismas de Vercel). Las
   busca en el entorno y, si no están, en `.env.local` — que está en el
   .gitignore, así que la llave nunca sube al repositorio.
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

/* ------------------------------------------------------------
   TRAER LOS PRECIOS
   ------------------------------------------------------------ */
async function traeTodos() {
  const filas = [];
  const DE_A = 1000;
  for (let desde = 0; ; desde += DE_A) {
    const r = await fetch(URL_BASE + '/rest/v1/precios?select=*&order=cuando.desc' +
      '&offset=' + desde + '&limit=' + DE_A, {
      headers: { apikey: CLAVE, Authorization: 'Bearer ' + CLAVE }
    });
    if (!r.ok) {
      const cuerpo = await r.text().catch(function () { return ''; });
      console.error('El almacén contestó ' + r.status + ': ' + cuerpo.slice(0, 300));
      if (r.status === 404) {
        console.error('\nLa tabla `precios` no existe. Está en docs/ALMACEN.sql y se pega');
        console.error('en el editor SQL de Supabase — es el bloque del 5-sep-2026.');
      }
      process.exit(3);
    }
    const lote = await r.json();
    filas.push.apply(filas, lote);
    if (lote.length < DE_A) break;
  }
  return filas;
}

/* ------------------------------------------------------------
   ARMAR LOS TEXTOS
   ------------------------------------------------------------ */
const pesos = (n) => '$' + Number(n || 0).toLocaleString('en-US');

/* Los de prueba no son criterio: se apartan. El bot los guarda igual
   —no sabe cuáles son— y aquí se reconocen por su número. */
const DE_PRUEBA = /^(52)?1?33(6667|1111)/;

function agrupa(filas) {
  const por = new Map();
  for (const f of filas) {
    if (!f || !(f.total > 0)) continue;
    if (DE_PRUEBA.test(String(f.cliente || ''))) continue;
    const llave = f.clave || '(sin clave)';
    if (!por.has(llave)) por.set(llave, []);
    por.get(llave).push(f);
  }
  /* Dentro de cada viaje, el más reciente primero. */
  for (const lista of por.values()) {
    lista.sort(function (a, b) { return String(b.cuando || '').localeCompare(String(a.cuando || '')); });
  }
  return por;
}

/* El que se sugeriría hoy: el último que él FIJÓ a mano; si nunca fijó
   ninguno, el más reciente. Es la misma regla que usa el ticket
   (`api/_precios-aprendidos.js`), y tiene que seguir siéndolo. */
function elQueMandaHoy(lista) {
  return lista.filter(function (f) { return f.fijado; })[0] || lista[0];
}

function laPaginaDelCerebro(por) {
  const unidades = new Map();
  for (const lista of por.values()) {
    const u = (lista[0].unidad || 'sin unidad').trim();
    if (!unidades.has(u)) unidades.set(u, []);
    unidades.get(u).push(lista);
  }

  const l = [];
  l.push('# Los precios que ya di');
  l.push('');
  l.push('Cada precio que confirmo por WhatsApp queda guardado, y la próxima vez');
  l.push('que alguien pida **ese mismo viaje** el ticket me lo recuerda y me lo');
  l.push('sugiere. Esta página es el resumen; la tabla completa, con fechas y');
  l.push('clientes, está en `docs/PRECIOS-QUE-HE-DADO.md`.');
  l.push('');
  l.push('> Se llena sola desde el almacén con `npm run precios:cerebro`. Si');
  l.push('> corrijo un número aquí a mano, la siguiente corrida me lo pisa: lo');
  l.push('> que manda es lo que contesté por WhatsApp.');
  l.push('');
  l.push('«El mismo viaje» son cuatro cosas: **zona de salida, destino, unidad y');
  l.push('días de servicio**. Los pasajeros no lo cambian — doce o catorce en la');
  l.push('misma Sprinter a Chapala es el mismo viaje.');
  l.push('');
  l.push('✍️ = lo escribí yo · sin marca = dije «va» al que calculó el sistema');
  l.push('');

  if (!unidades.size) {
    l.push('---');
    l.push('');
    l.push('**Todavía no hay ninguno.** En cuanto conteste el primer ticket con un');
    l.push('precio, aparece aquí.');
    l.push('');
  }

  for (const u of Array.from(unidades.keys()).sort()) {
    l.push('---');
    l.push('');
    l.push('## ' + u);
    l.push('');
    l.push('| desde | a dónde | días | lo que cobré | veces |');
    l.push('|---|---|---:|---:|---:|');
    const viajes = unidades.get(u).slice().sort(function (a, b) {
      return String(a[0].destino || '').localeCompare(String(b[0].destino || ''));
    });
    for (const lista of viajes) {
      const manda = elQueMandaHoy(lista);
      l.push('| ' + (lista[0].origen || '?') + ' | ' + (lista[0].destino || '?') +
        ' | ' + (lista[0].dias || '?') + ' | **' + pesos(manda.total) + '**' +
        (manda.fijado ? ' ✍️' : '') + ' | ' + lista.length + ' |');
    }
    l.push('');

    /* Los que él cambió de opinión: el mismo viaje con dos números
       distintos. Es donde se ve un criterio moviéndose, así que se
       señala en vez de esconderlo en el promedio. */
    const cambiaron = viajes.filter(function (lista) {
      return new Set(lista.map(function (f) { return f.total; })).size > 1;
    });
    if (cambiaron.length) {
      l.push('**Estos los he dado a más de un precio:**');
      l.push('');
      for (const lista of cambiaron) {
        l.push('- ' + (lista[0].destino || '?') + ', ' + (lista[0].dias || '?') + ' días — ' +
          lista.map(function (f) { return pesos(f.total) + (f.fijado ? ' ✍️' : ''); }).join(' · ') +
          '  _(el más reciente primero)_');
      }
      l.push('');
    }
  }

  l.push('---');
  l.push('');
  l.push('Relacionado: [[precio-de-lista]] · [[como-se-arma-un-precio]] ·');
  l.push('[[de-donde-salen]] · [[quien-manda]] · [[MAPA]]');
  l.push('');
  l.push('Dónde vive el código: `api/_precios-aprendidos.js` decide qué es «el');
  l.push('mismo viaje»; `api/_almacen.js` lo guarda y lo lee.');
  return l.join('\n') + '\n';
}

function laTablaLarga(filas, por) {
  const l = [];
  l.push('# Los precios que el dueño ya dio — tabla completa');
  l.push('');
  l.push('Volcado del almacén con `npm run precios:cerebro`. **Este archivo se');
  l.push('reescribe entero cada vez**: no se edita a mano.');
  l.push('');
  l.push('El resumen legible está en `cerebro/precios-que-he-dado.md`.');
  l.push('');
  l.push('- Renglones guardados: **' + filas.length + '**');
  l.push('- Viajes distintos: **' + por.size + '**');
  l.push('- Generado: ' + new Date().toISOString().slice(0, 10));
  l.push('');
  l.push('«fijado» quiere decir que el dueño escribió el número; si va vacío, dijo');
  l.push('«va» al que había calculado el sistema.');
  l.push('');
  l.push('| cuándo | desde | a dónde | unidad | días | pax | total | anticipo | fijado | cliente |');
  l.push('|---|---|---|---|---:|---:|---:|---:|:---:|---|');
  const orden = filas.slice().sort(function (a, b) {
    return String(b.cuando || '').localeCompare(String(a.cuando || ''));
  });
  for (const f of orden) {
    l.push('| ' + String(f.cuando || '').slice(0, 10) +
      ' | ' + (f.origen || '') + ' | ' + (f.destino || '') + ' | ' + (f.unidad || '') +
      ' | ' + (f.dias == null ? '' : f.dias) + ' | ' + (f.pasajeros == null ? '' : f.pasajeros) +
      ' | ' + pesos(f.total) + ' | ' + (f.anticipo ? pesos(f.anticipo) : '') +
      ' | ' + (f.fijado ? '✍️' : '') + ' | ' + (f.cliente || '') + ' |');
  }
  return l.join('\n') + '\n';
}

/* ------------------------------------------------------------
   Se exportan para poder probar el FORMATO sin tocar la red ni el
   almacén: `pruebas/probar-precios-al-cerebro.mjs` les da renglones de
   mentiras y comprueba lo que sale. Y por eso el script solo CORRE
   cuando se le llama directo, no cuando se le importa.
   ------------------------------------------------------------ */
export { agrupa, elQueMandaHoy, laPaginaDelCerebro, laTablaLarga, DE_PRUEBA };

const meLlamaronDirecto = process.argv[1] &&
  path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));

if (meLlamaronDirecto) {
  if (!URL_BASE || !CLAVE) {
    console.error('Faltan ALMACEN_URL y ALMACEN_CLAVE (en el entorno o en .env.local).');
    console.error('Son las mismas que están en Vercel.');
    process.exit(2);
  }
  const filas = await traeTodos();
  const por = agrupa(filas);

  const dondeCerebro = path.join(RAIZ, 'cerebro', 'precios-que-he-dado.md');
  const dondeDocs = path.join(RAIZ, 'docs', 'PRECIOS-QUE-HE-DADO.md');
  fs.writeFileSync(dondeCerebro, laPaginaDelCerebro(por), 'utf8');
  fs.writeFileSync(dondeDocs, laTablaLarga(filas, por), 'utf8');

  console.log('Leídos ' + filas.length + ' renglones del almacén.');
  console.log(por.size + ' viajes distintos, de ' +
    new Set(Array.from(por.values()).map(function (x) { return x[0].unidad; })).size + ' unidades.');
  console.log('');
  console.log('  ' + path.relative(RAIZ, dondeCerebro));
  console.log('  ' + path.relative(RAIZ, dondeDocs));
  console.log('');
  console.log('Revísalos y súbelos con git si te cuadran.');
}
