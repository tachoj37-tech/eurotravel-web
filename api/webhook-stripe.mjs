/* ============================================================
   Webhook de Stripe — la cáscara
   ------------------------------------------------------------
   Aqui NO hay reglas de negocio: todas viven en _webhook-logica.js,
   que recibe el cuerpo crudo y devuelve la respuesta, y por eso se
   puede probar sin servidor. Esto de aqui resuelve UNA sola cosa,
   que es puro capricho del entorno: conseguir el cuerpo CRUDO.

   POR QUE ESTE ARCHIVO ES .mjs
   ----------------------------
   La firma de Stripe se calcula sobre los bytes exactos del cuerpo.
   Si Vercel lo parsea a objeto y se vuelve a serializar, los bytes
   cambian y la firma nunca cuadra.

   Para que Vercel NO lo parsee hay que exportar `config`, y Vercel
   lo busca leyendo el archivo, no ejecutandolo: tiene que ser un
   `export const config` de verdad. La primera version de esto era
   CommonJS con `module.exports.config = …` y Vercel ni lo vio —
   comprobado contra el sitio publicado: contestaba «cuerpo
   ilegible» porque el cuerpo llegaba ya parseado—. De ahi el .mjs.

   El proyecto es CommonJS (package.json), asi que este es el unico
   archivo ESM; importa la logica con la interoperabilidad normal
   de Node.
   ============================================================ */

import logica from './_webhook-logica.js';

export const config = { api: { bodyParser: false } };

/* Se intenta por orden, del mas confiable al menos. Si al final solo hay un
   objeto ya parseado, se falla RUIDOSAMENTE: mas vale que el pago se quede
   esperando un reintento a dar por buena una firma que no se pudo comprobar. */
async function crudoDe(req) {
  if (Buffer.isBuffer(req.rawBody)) return req.rawBody;
  if (typeof req.rawBody === 'string') return Buffer.from(req.rawBody, 'utf8');
  if (Buffer.isBuffer(req.body)) return req.body;
  if (typeof req.body === 'string') return Buffer.from(req.body, 'utf8');

  if (req.body && typeof req.body === 'object') {
    throw new Error('el cuerpo llegó parseado: los bytes originales se perdieron');
  }

  const trozos = [];
  let total = 0;
  for await (const t of req) {
    total += t.length;
    if (total > 1048576) throw new Error('cuerpo demasiado grande');
    trozos.push(t);
  }
  return Buffer.concat(trozos);
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Método no permitido' });
    return;
  }

  let crudo;
  try {
    crudo = await crudoDe(req);
  } catch (e) {
    console.error('[webhook] no se pudo leer el cuerpo crudo: ' + e.message);
    res.status(500).json({ error: 'cuerpo ilegible' });
    return;
  }

  const r = await logica.procesa(crudo, req.headers['stripe-signature']);
  res.status(r.status).json(r.cuerpo);
}
