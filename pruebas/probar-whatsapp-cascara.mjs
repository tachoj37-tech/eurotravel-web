/* La CÁSCARA del webhook de WhatsApp, ejecutada de verdad.
   ------------------------------------------------------------------
   `probar-whatsapp.cjs` prueba la lógica; esto prueba el archivo que
   Vercel ejecuta. La diferencia importa: la lógica estaba en verde
   mientras la cáscara nunca se había corrido ni una vez.

   Es .mjs porque el archivo que prueba lo es, y lo es a propósito:
   solo así llega el cuerpo CRUDO que la firma necesita.

   Busca el archivo en los DOS lugares donde puede estar. Hoy vive en
   `pendiente/` porque no cabe en el plan de Vercel; el día que se le
   haga lugar se mueve a `api/` y esta prueba lo sigue encontrando en
   vez de ponerse en rojo por una mudanza. */

import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.join(AQUI, '..');

const CANDIDATOS = [
  path.join(RAIZ, 'api', 'whatsapp.mjs'),        // ya publicado
  path.join(RAIZ, 'pendiente', 'whatsapp.mjs')   // todavía esperando lugar
];
const DONDE = CANDIDATOS.find(function (p) { return fs.existsSync(p); });

if (!DONDE) {
  console.log('MAL  no se encontro whatsapp.mjs ni en api/ ni en pendiente/');
  process.exit(1);
}

const SECRETO = 'secreto-de-prueba';
process.env.WHATSAPP_APP_SECRET = SECRETO;
process.env.WHATSAPP_VERIFY_TOKEN = 'token-de-alta';
/* WHATSAPP_TOKEN se deja SIN poner a propósito: así se comprueba que,
   aunque no se pueda contestarle al cliente, a Meta se le sigue
   devolviendo 200. Si se le devolviera error, Meta reintenta y acaba
   apagando el webhook — o sea que un fallo al responder UN mensaje
   dejaría el bot muerto para todos. */

const atiende = (await import(pathToFileURL(DONDE).href)).default;

let buenas = 0, malas = 0;
function ok(que, dio, esperaba) {
  const bien = JSON.stringify(dio) === JSON.stringify(esperaba);
  if (bien) { buenas++; console.log('ok   ' + que); }
  else {
    malas++;
    console.log('MAL  ' + que);
    console.log('     dio      ' + JSON.stringify(dio));
    console.log('     esperaba ' + JSON.stringify(esperaba));
  }
}

/* Un `res` como el que pasa Vercel en firma de Node. */
function resFalso() {
  const r = { codigo: null, cuerpo: null };
  r.status = function (c) { r.codigo = c; return r; };
  r.json = function (b) { r.cuerpo = b; return r; };
  r.send = function (b) { r.cuerpo = b; return r; };
  return r;
}

function firma(cuerpo) {
  return 'sha256=' + crypto.createHmac('sha256', SECRETO)
    .update(Buffer.from(cuerpo, 'utf8')).digest('hex');
}

function mensaje(texto, id) {
  return JSON.stringify({
    entry: [{ changes: [{ value: {
      metadata: { phone_number_id: 'PID1' },
      messages: [{ from: '5213311112222', id: id || 'wamid.x', type: 'text',
        text: { body: texto } }]
    } }] }]
  });
}

console.log('(probando ' + path.relative(RAIZ, DONDE).replace(/\\/g, '/') + ')');

console.log('\n== EL ALTA DEL WEBHOOK, POR LA CASCARA ==');
{
  const res = resFalso();
  await atiende({ method: 'GET', headers: {},
    url: '/api/whatsapp?hub.mode=subscribe&hub.verify_token=token-de-alta&hub.challenge=RETO99'
  }, res);
  ok('devuelve el challenge tal cual, sin comillas ni JSON',
    [res.codigo, res.cuerpo], [200, 'RETO99']);
}
{
  const res = resFalso();
  await atiende({ method: 'GET', headers: {},
    url: '/api/whatsapp?hub.mode=subscribe&hub.verify_token=MALO&hub.challenge=X' }, res);
  ok('con token malo, 403', res.codigo, 403);
}

console.log('\n== UN MENSAJE DE VERDAD ==');
{
  const cuerpo = mensaje('hola', 'wamid.cascara1');
  const res = resFalso();
  await atiende({ method: 'POST', url: '/api/whatsapp',
    headers: { 'x-hub-signature-256': firma(cuerpo) },
    rawBody: Buffer.from(cuerpo, 'utf8') }, res);
  ok('con firma buena, 200 a Meta AUNQUE no se le pueda responder al cliente',
    res.codigo, 200);
}
{
  const cuerpo = mensaje('hola', 'wamid.cascara2');
  const res = resFalso();
  await atiende({ method: 'POST', url: '/api/whatsapp',
    headers: { 'x-hub-signature-256': 'sha256=0000' },
    rawBody: Buffer.from(cuerpo, 'utf8') }, res);
  ok('con firma mala, 401', res.codigo, 401);
}
{
  const res = resFalso();
  await atiende({ method: 'DELETE', url: '/api/whatsapp', headers: {} }, res);
  ok('un metodo que no es GET ni POST, 405', res.codigo, 405);
}

console.log('\n== LA FIRMA WEB, QUE ES LA QUE USA VERCEL ==');
{
  const r = await atiende(new Request(
    'https://x/api/whatsapp?hub.mode=subscribe&hub.verify_token=token-de-alta&hub.challenge=WEB7',
    { method: 'GET' }));
  ok('el alta funciona igual por firma Web', [r.status, await r.text()], [200, 'WEB7']);
}
{
  const cuerpo = mensaje('hola', 'wamid.cascara3');
  const r = await atiende(new Request('https://x/api/whatsapp', {
    method: 'POST', body: cuerpo,
    headers: { 'x-hub-signature-256': firma(cuerpo) }
  }));
  ok('y un mensaje firmado tambien', r.status, 200);
}
{
  const cuerpo = mensaje('hola', 'wamid.cascara4');
  const r = await atiende(new Request('https://x/api/whatsapp', {
    method: 'POST', body: cuerpo,
    headers: { 'x-hub-signature-256': 'sha256=beef' }
  }));
  ok('con firma mala por firma Web, 401', r.status, 401);
}

console.log('\n' + buenas + ' buenas, ' + malas + ' malas');
process.exit(malas === 0 ? 0 : 1);
