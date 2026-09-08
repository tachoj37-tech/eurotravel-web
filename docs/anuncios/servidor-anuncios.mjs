// Servidor estático mínimo para renderizar los anuncios con Playwright.
// Sirve el scratchpad en / y las fotos reales del sitio en /img/.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const AQUI = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
const IMG = 'C:/Users/tacho/OneDrive/Documentos/EUROAPP/eurotravel-web/img';
const TIPOS = { '.html': 'text/html; charset=utf-8', '.jpg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.css': 'text/css' };

http.createServer((req, res) => {
  const ruta = decodeURIComponent((req.url || '/').split('?')[0]);
  const archivo = ruta.startsWith('/img/') ? path.join(IMG, ruta.slice(5)) : path.join(AQUI, ruta === '/' ? 'anuncio-instagram.html' : ruta);
  fs.readFile(archivo, (err, datos) => {
    if (err) { res.writeHead(404); res.end('no'); return; }
    res.writeHead(200, { 'Content-Type': TIPOS[path.extname(archivo)] || 'application/octet-stream' });
    res.end(datos);
  });
}).listen(4177, () => console.log('anuncios en http://localhost:4177'));
