/* ============================================================
   La cáscara del webhook: que Vercel le entregue los BYTES
   ------------------------------------------------------------
       node pruebas/probar-webhook-cascara.cjs

   Comprobado en producción el 16-sep-2026, con la misma firma
   inventada y el mismo cuerpo:

       Content-Type: text/plain        → 400 firma inválida
       Content-Type: application/json  → 200, y entró

   Stripe manda application/json. O sea que con la firma de Node
   (req, res) Vercel parsea el cuerpo, los bytes se pierden y la
   firma NO SE COMPRUEBA para el tráfico real: se seguía adelante
   fiándose de que Stripe confirme. Un candado que el visitante
   decide si toca.

   La documentación de Vercel es clara: con la firma Web —exportar
   `POST(request)` y NADA por default— el handler recibe un Request
   y `arrayBuffer()` da los bytes exactos. Exportando las dos cosas,
   Vercel escogía la de Node. Aquí se exige que solo quede la Web.
   ============================================================ */
'use strict';
const fs = require('fs');
const path = require('path');

let buenas = 0, malas = 0;
function ok(que, cond) {
  if (cond) { buenas++; console.log('ok   ' + que); }
  else { malas++; console.log('MAL  ' + que); }
}

(async function () {
  const ruta = path.join(__dirname, '..', 'api', 'webhook-stripe.mjs');
  const texto = fs.readFileSync(ruta, 'utf8');
  const sinComentarios = texto.replace(/\/\*[\s\S]*?\*\//g, '');

  console.log('\n== solo la firma Web, para que Vercel entregue los bytes ==');
  ok('no exporta default (con default Vercel escoge la firma de Node)',
    !/export\s+default/.test(sinComentarios));
  ok('exporta POST', /export\s+const\s+POST\s*=|export\s+(async\s+)?function\s+POST/.test(sinComentarios));

  console.log('\n== con un Request de verdad, la firma se comprueba ==');
  process.env.STRIPE_WEBHOOK_SECRET = 'whsec_de_prueba';
  const mod = await import(require('url').pathToFileURL(ruta).href);
  const cuerpo = '{"type":"checkout.session.completed","data":{"object":{"id":"cs_test_x"}}}';
  const pide = (cabeceras) => mod.POST(new Request('https://x/api/webhook-stripe', {
    method: 'POST', headers: cabeceras, body: cuerpo
  }));

  let r = await pide({ 'content-type': 'application/json', 'stripe-signature': 't=1,v1=deadbeef' });
  ok('application/json con firma falsa → 400', r.status === 400);
  r = await pide({ 'content-type': 'application/json' });
  ok('application/json sin firma → 400', r.status === 400);
  r = await mod.POST(new Request('https://x/api/webhook-stripe', { method: 'GET' }));
  ok('GET → 405', r.status === 405);

  console.log('\n' + buenas + ' buenas, ' + malas + ' malas');
  process.exit(malas ? 1 : 0);
})();
