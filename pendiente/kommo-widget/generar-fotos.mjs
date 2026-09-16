/* ============================================================
   LA TABLA DE FOTOS DEL WIDGET (16-sep-2026)
   ============================================================
   El widget adjunta las fotos de las unidades desde el drive de Kommo.
   Los uuids viven en `api/_kommo-fotos.json` (una carpeta por unidad,
   como en img/unidades). Este script copia esa tabla —las tres primeras
   fotos de cada carpeta, en orden— dentro de `script.js`, entre las
   marcas FOTOS:INICIO y FOTOS:FIN, para que el widget no dependa de
   nada más que de sí mismo.

     node pendiente/kommo-widget/generar-fotos.mjs
   ============================================================ */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.resolve(AQUI, '..', '..');
const tabla = JSON.parse(fs.readFileSync(path.join(RAIZ, 'api', '_kommo-fotos.json'), 'utf8'));

const fotos = {};
for (const carpeta of Object.keys(tabla)) {
  const nombres = Object.keys(tabla[carpeta]).sort();
  fotos[carpeta] = nombres.slice(0, 3).map(function (n) { return tabla[carpeta][n]; });
}

const archivo = path.join(AQUI, 'script.js');
const fuente = fs.readFileSync(archivo, 'utf8');
const inicio = fuente.indexOf('/* FOTOS:INICIO */');
const fin = fuente.indexOf('/* FOTOS:FIN */');
if (inicio < 0 || fin < 0) { console.error('script.js no tiene las marcas FOTOS:INICIO / FOTOS:FIN'); process.exit(1); }
const nuevo = fuente.slice(0, inicio) + '/* FOTOS:INICIO */ ' + JSON.stringify(fotos, null, 2).replace(/\n/g, '\n    ') + ' ' + fuente.slice(fin);
fs.writeFileSync(archivo, nuevo);
console.log('Tabla de fotos escrita: ' + Object.keys(fotos).map(function (k) { return k + '(' + fotos[k].length + ')'; }).join(' '));
