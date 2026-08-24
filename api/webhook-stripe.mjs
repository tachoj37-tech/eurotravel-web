/* ============================================================
   Webhook de Stripe — la cáscara
   ------------------------------------------------------------
   Aqui NO hay reglas de negocio: todas viven en _webhook-logica.js,
   que recibe el cuerpo crudo y devuelve la respuesta, y por eso se
   prueba sin servidor. Esto resuelve UNA sola cosa, que es puro
   capricho del entorno: conseguir el cuerpo CRUDO.

   POR QUE ESTO COSTO DOS INTENTOS
   -------------------------------
   La firma de Stripe se calcula sobre los bytes exactos del cuerpo.
   Si el entorno lo parsea a objeto y se vuelve a serializar, los
   bytes cambian y la firma nunca cuadra.

   Intento 1: `module.exports.config = { api: { bodyParser: false } }`.
   Vercel ni lo vio — busca ese config leyendo el archivo, no
   ejecutandolo.

   Intento 2: `export const config = …` en un .mjs. Tampoco: ese
   mecanismo es de Next.js, no de las funciones sueltas de Vercel.

   Los dos se comprobaron contra el sitio publicado y los dos
   contestaron «cuerpo ilegible» — el fallo ruidoso hizo su trabajo:
   nunca se dio por buena una firma que no se pudo comprobar.

   Intento 3, el bueno: la FIRMA WEB. Cuando el handler recibe un
   `Request` estandar, el cuerpo se pide con `.text()` y llega tal
   cual, sin que nadie lo haya tocado.

   Se exporta de las dos formas —default y POST— y se atienden las
   dos firmas, la Web y la de Node, porque cual de ellas usa Vercel
   depende de como resuelva el archivo. La logica es la misma; lo
   unico que cambia es de donde sale el cuerpo.
   ============================================================ */

import logica from './_webhook-logica.js';

const TIPO_JSON = { 'content-type': 'application/json; charset=utf-8' };

async function atiende(a, b) {
  /* ---- firma Web: (Request) -> Response ---- */
  if (a && typeof a.arrayBuffer === 'function' && a.headers && typeof a.headers.get === 'function') {
    if (a.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Método no permitido' }), { status: 405, headers: TIPO_JSON });
    }
    let crudo;
    try {
      crudo = Buffer.from(await a.arrayBuffer());
    } catch (e) {
      console.error('[webhook] no se pudo leer el cuerpo crudo: ' + e.message);
      return new Response(JSON.stringify({ error: 'cuerpo ilegible' }), { status: 500, headers: TIPO_JSON });
    }
    const r = await logica.procesa(crudo, a.headers.get('stripe-signature'));
    return new Response(JSON.stringify(r.cuerpo), { status: r.status, headers: TIPO_JSON });
  }

  /* ---- firma de Node: (req, res) ---- */
  const req = a, res = b;
  if (req.method !== 'POST') { res.status(405).json({ error: 'Método no permitido' }); return; }

  let crudo;
  try {
    crudo = await crudoDeNode(req);
  } catch (e) {
    console.error('[webhook] no se pudo leer el cuerpo crudo: ' + e.message);
    res.status(500).json({ error: 'cuerpo ilegible' });
    return;
  }
  const r = await logica.procesa(crudo, req.headers['stripe-signature']);
  res.status(r.status).json(r.cuerpo);
}

/* Se intenta por orden, del mas confiable al menos. Si al final solo queda un
   objeto ya parseado, se falla RUIDOSAMENTE: mas vale que el pago espere un
   reintento a que se de por buena una firma que no se pudo comprobar. */
async function crudoDeNode(req) {
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

export default atiende;
export const POST = atiende;
