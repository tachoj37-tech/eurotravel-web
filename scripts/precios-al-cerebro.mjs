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
   LA LISTA PARA AUTORIZAR (13-sep-2026)
   ------------------------------------------------------------
   Lo que decidió el dueño, y está explicado en
   `api/_precios-autorizados.js`: se propone un viaje cuando lo pidieron
   TRES clientes distintos, con el precio MÁS RECIENTE, y autorizarlo no
   lo publica — todavía no sale al cliente.

   OJO, NO ES LA MISMA REGLA QUE EL TICKET. El ticket sugiere el último
   que él FIJÓ a mano (`elQueMandaHoy`); para autorizar, él escogió el
   más reciente. Casi siempre coinciden. Cuando no, la lista enseña los
   anteriores para que se vea.

   Clientes DISTINTOS y no renglones: tres cotizaciones del mismo cliente
   son una sola opinión del precio. Un renglón sin cliente cuenta como
   uno, porque no se sabe quién fue pero sí que alguien pidió.
   ------------------------------------------------------------ */
const MINIMO_PARA_PROPONER = 3;

function clientesDistintos(lista) {
  const vistos = new Set();
  let sinNombre = 0;
  for (const f of lista) {
    if (f.cliente) vistos.add(String(f.cliente).slice(-10));
    else sinNombre++;
  }
  return vistos.size + sinNombre;
}

function porAutorizar(por, autorizados) {
  const yaDichos = new Map((autorizados || []).map(function (a) { return [a.clave, a]; }));
  const r = { listos: [], cerca: [], cambiaron: [], autorizados: 0 };

  for (const [clave, lista] of por) {
    const reciente = lista[0];   // `agrupa` ya los dejó del más nuevo al más viejo
    const viaje = {
      clave: clave,
      origen: reciente.origen || '?',
      destino: reciente.destino || '?',
      unidad: reciente.unidad || 'sin unidad',
      dias: reciente.dias,
      veces: clientesDistintos(lista),
      propuesto: reciente.total,
      anteriores: lista.slice(1).map(function (f) { return f.total; }),
      /* Nulo si el motor no supo; ver `renglonDe` en _precios-aprendidos.js. */
      motor: Number(reciente.calculado) > 0 ? Number(reciente.calculado) : null
    };

    const dicho = yaDichos.get(clave);
    if (dicho) {
      if (dicho.total === viaje.propuesto) { r.autorizados++; continue; }
      /* Lo autorizó a un precio y después cobró otro: se le avisa, no se
         calla ni se le vuelve a proponer como si fuera nuevo. */
      r.cambiaron.push(Object.assign(viaje, { autorizado: dicho.total, fecha: dicho.fecha }));
      continue;
    }

    if (viaje.veces >= MINIMO_PARA_PROPONER) r.listos.push(viaje);
    else r.cerca.push(viaje);
  }

  const orden = function (a, b) {
    return b.veces - a.veces || String(a.destino).localeCompare(String(b.destino));
  };
  r.listos.sort(orden); r.cerca.sort(orden); r.cambiaron.sort(orden);
  return r;
}

/* La clave lleva «|», que en una tabla parte la celda aunque vaya entre
   comillas de código. Se escapa. */
function celdaDeClave(clave) {
  return '`' + String(clave).replace(/\|/g, '\\|') + '`';
}

function laListaParaAutorizar(r) {
  const l = [];
  l.push('# Precios por autorizar');
  l.push('');
  l.push('Los viajes que ya pidieron **' + MINIMO_PARA_PROPONER + ' clientes distintos**, con el');
  l.push('precio **más reciente** que se les dio.');
  l.push('');
  l.push('> **Autorizar uno todavía no sale al cliente.** Queda apuntado con su');
  l.push('> fecha en `api/_precios-autorizados.js`, y ya no se vuelve a proponer.');
  l.push('> Que salga al público es otra decisión, aparte.');
  l.push('');
  l.push('**Cómo se autoriza:** dile a Claude *«autoriza Chapala Sprinter 1 día»*');
  l.push('(o el número del renglón), y queda apuntado y subido.');
  l.push('');
  l.push('> Se llena sola con `npm run precios:cerebro`. Si corrijo algo aquí a');
  l.push('> mano, la siguiente corrida me la pisa.');
  l.push('');

  const motor = function (v) {
    if (v.motor === null) return 'no supo';
    const dif = v.propuesto - v.motor;
    return pesos(v.motor) + (dif === 0 ? ' ✓' : ' (' + (dif > 0 ? '+' : '−') + pesos(Math.abs(dif)) + ')');
  };

  if (!r.listos.length && !r.cambiaron.length) {
    l.push('---');
    l.push('');
    l.push('**Todavía no hay ninguno listo.**' +
      (r.cerca.length ? ' Hay ' + r.cerca.length + ' viaje(s) a los que les falta poco, abajo.' : ''));
    l.push('');
  }

  if (r.listos.length) {
    l.push('---');
    l.push('');
    l.push('## Listos para autorizar');
    l.push('');
    l.push('| # | desde | a dónde | unidad | días | clientes | propuesto | antes | el motor decía | clave |');
    l.push('|---:|---|---|---|---:|---:|---:|---|---|---|');
    r.listos.forEach(function (v, i) {
      l.push('| ' + (i + 1) + ' | ' + v.origen + ' | ' + v.destino + ' | ' + v.unidad + ' | ' +
        (v.dias == null ? '?' : v.dias) + ' | ' + v.veces + ' | **' + pesos(v.propuesto) + '** | ' +
        (v.anteriores.length ? v.anteriores.map(pesos).join(' · ') : '—') + ' | ' + motor(v) +
        ' | ' + celdaDeClave(v.clave) + ' |');
    });
    l.push('');
  }

  if (r.cambiaron.length) {
    l.push('## ⚠️ Los autorizaste, y después se cobró otra cosa');
    l.push('');
    l.push('| a dónde | unidad | días | autorizado | lo más reciente | clave |');
    l.push('|---|---|---:|---:|---:|---|');
    for (const v of r.cambiaron) {
      l.push('| ' + v.destino + ' | ' + v.unidad + ' | ' + (v.dias == null ? '?' : v.dias) + ' | ' +
        pesos(v.autorizado) + ' (' + v.fecha + ') | **' + pesos(v.propuesto) + '** | ' + celdaDeClave(v.clave) + ' |');
    }
    l.push('');
  }

  if (r.cerca.length) {
    l.push('## Les falta poco');
    l.push('');
    l.push('| a dónde | unidad | días | clientes | lo más reciente |');
    l.push('|---|---|---:|---:|---:|');
    for (const v of r.cerca) {
      l.push('| ' + v.destino + ' | ' + v.unidad + ' | ' + (v.dias == null ? '?' : v.dias) + ' | ' +
        v.veces + ' de ' + MINIMO_PARA_PROPONER + ' | ' + pesos(v.propuesto) + ' |');
    }
    l.push('');
  }

  l.push('---');
  l.push('');
  l.push('Ya autorizados y sin cambios: **' + r.autorizados + '**.');
  l.push('');
  return l.join('\n') + '\n';
}

/* ------------------------------------------------------------
   Se exportan para poder probar el FORMATO sin tocar la red ni el
   almacén: `pruebas/probar-precios-al-cerebro.mjs` les da renglones de
   mentiras y comprueba lo que sale. Y por eso el script solo CORRE
   cuando se le llama directo, no cuando se le importa.
   ------------------------------------------------------------ */
export {
  agrupa, elQueMandaHoy, laPaginaDelCerebro, laTablaLarga, DE_PRUEBA,
  porAutorizar, laListaParaAutorizar, MINIMO_PARA_PROPONER
};

const meLlamaronDirecto = process.argv[1] &&
  path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));

if (meLlamaronDirecto) {
  if (!URL_BASE || !CLAVE) {
    console.error('Faltan ALMACEN_URL y ALMACEN_CLAVE (en el entorno o en .env.local).');
    console.error('Son las mismas que están en Vercel.');
    process.exit(2);
  }
  /* Antes de leer nada: el registro tiene que estar bien escrito. Una
     clave repetida o un total con centavos es justo lo que no se nota
     hasta que ya estorbó. */
  const registro = (await import('../api/_precios-autorizados.js')).default;
  const problemas = registro.revisa(registro.AUTORIZADOS);
  if (problemas.length) {
    console.error('api/_precios-autorizados.js tiene errores:');
    for (const p of problemas) console.error('  · ' + p);
    process.exit(4);
  }

  const filas = await traeTodos();
  const por = agrupa(filas);
  const lista = porAutorizar(por, registro.AUTORIZADOS);

  const dondeCerebro = path.join(RAIZ, 'cerebro', 'precios-que-he-dado.md');
  const dondeDocs = path.join(RAIZ, 'docs', 'PRECIOS-QUE-HE-DADO.md');
  const dondeLista = path.join(RAIZ, 'docs', 'PRECIOS-POR-AUTORIZAR.md');
  fs.writeFileSync(dondeCerebro, laPaginaDelCerebro(por), 'utf8');
  fs.writeFileSync(dondeDocs, laTablaLarga(filas, por), 'utf8');
  fs.writeFileSync(dondeLista, laListaParaAutorizar(lista), 'utf8');

  console.log('Leídos ' + filas.length + ' renglones del almacén.');
  console.log(por.size + ' viajes distintos, de ' +
    new Set(Array.from(por.values()).map(function (x) { return x[0].unidad; })).size + ' unidades.');
  console.log('');
  console.log('  ' + path.relative(RAIZ, dondeCerebro));
  console.log('  ' + path.relative(RAIZ, dondeDocs));
  console.log('  ' + path.relative(RAIZ, dondeLista) + '   ← ' + lista.listos.length +
    ' por autorizar' + (lista.cambiaron.length ? ', ' + lista.cambiaron.length + ' cambiaron' : ''));
  console.log('');
  console.log('Revísalos y súbelos con git si te cuadran.');
}
