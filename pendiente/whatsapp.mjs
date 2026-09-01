/* ============================================================
   Bot de WhatsApp — la cáscara
   ------------------------------------------------------------
   Aquí NO hay reglas: viven en `_whatsapp-webhook.js` (la firma y
   el reparto) y en `_whatsapp-logica.js` (qué se contesta). Esto
   resuelve dos caprichos del entorno: conseguir el cuerpo CRUDO y
   hablarle a Meta.

   ES .mjs A PROPÓSITO, Y CON UN SOLO PARÁMETRO

   La firma de Meta se calcula sobre los bytes exactos del cuerpo.
   Si el entorno lo parsea y lo vuelve a serializar, la firma no
   cuadra nunca. Con `webhook-stripe.mjs` eso costó TRES intentos,
   y están escritos ahí para no repetirlos: ni `module.exports.
   config`, ni `export const config` funcionan en las funciones
   sueltas de Vercel.

   Lo que sí: cuando el handler declara UN parámetro, Vercel lo
   trata como firma Web y el cuerpo llega crudo con `.text()`.
   El segundo argumento, cuando lo hay, se recoge de `arguments`.

   No se volvió a averiguar: se copió lo que ya se pagó.
   ============================================================ */

/* Ojo: mientras este archivo viva en `pendiente/`, la ruta sube un nivel.
   Al moverlo a `api/` hay que dejarla en './_whatsapp-webhook.js'. */
import webhook from '../api/_whatsapp-webhook.js';

const TIPO_JSON = { 'content-type': 'application/json; charset=utf-8' };
const TIPO_TEXTO = { 'content-type': 'text/plain; charset=utf-8' };

/* La versión va fija: si Meta saca una nueva y cambiara sola, el bot se
   rompería un martes sin que nadie tocara nada. */
const GRAFO = 'https://graph.facebook.com/v21.0';

/* ------------------------------------------------------------
   MANDAR LA RESPUESTA
   ------------------------------------------------------------
   Si falla, se registra y se sigue: a Meta hay que contestarle
   200 de todas formas. Un error al responderle a UN cliente no
   puede tumbar el webhook para todos los demás.
   ------------------------------------------------------------ */
async function manda(envio) {
  const token = process.env.WHATSAPP_TOKEN;
  const numero = envio.numeroDeOrigen || process.env.WHATSAPP_PHONE_ID;
  if (!token || !numero) {
    console.error('[whatsapp] falta WHATSAPP_TOKEN o el numero de origen');
    return false;
  }
  try {
    const r = await fetch(GRAFO + '/' + numero + '/messages', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + token,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: envio.para,
        type: 'text',
        text: { preview_url: false, body: envio.texto }
      })
    });
    if (!r.ok) {
      /* El cuerpo del error de Meta dice QUÉ salió mal (token vencido,
         número no registrado, plantilla requerida). Sin esto, depurar
         es adivinar. */
      const detalle = await r.text().catch(function () { return ''; });
      console.error('[whatsapp] Meta contesto ' + r.status + ': ' + detalle.slice(0, 500));
      return false;
    }
    return true;
  } catch (e) {
    console.error('[whatsapp] no se pudo mandar: ' + e.message);
    return false;
  }
}

async function atiende(a) {
  const b = arguments[1];
  const esWeb = a && typeof a.arrayBuffer === 'function' &&
    a.headers && typeof a.headers.get === 'function';

  /* ================= firma Web: (Request) -> Response ================= */
  if (esWeb) {
    /* ---- alta del webhook ---- */
    if (a.method === 'GET') {
      const u = new URL(a.url);
      const params = {};
      u.searchParams.forEach(function (v, k) { params[k] = v; });
      const r = webhook.verificaSuscripcion(params);
      return new Response(r.cuerpo, { status: r.status, headers: TIPO_TEXTO });
    }
    if (a.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Método no permitido' }),
        { status: 405, headers: TIPO_JSON });
    }

    let crudo;
    try {
      crudo = Buffer.from(await a.arrayBuffer());
    } catch (e) {
      console.error('[whatsapp] no se pudo leer el cuerpo crudo: ' + e.message);
      return new Response(JSON.stringify({ error: 'cuerpo ilegible' }),
        { status: 500, headers: TIPO_JSON });
    }

    const r = webhook.procesa(crudo, a.headers.get('x-hub-signature-256'));
    for (const envio of r.envios) await manda(envio);
    return new Response(JSON.stringify(r.cuerpo), { status: r.status, headers: TIPO_JSON });
  }

  /* ================= firma de Node: (req, res) ================= */
  const req = a, res = b;

  if (req.method === 'GET') {
    const u = new URL(req.url, 'http://x');
    const params = {};
    u.searchParams.forEach(function (v, k) { params[k] = v; });
    const r = webhook.verificaSuscripcion(params);
    res.status(r.status).send(r.cuerpo);
    return;
  }
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Método no permitido' });
    return;
  }

  let crudo;
  try {
    crudo = await crudoDeNode(req);
  } catch (e) {
    console.error('[whatsapp] no se pudo leer el cuerpo: ' + e.message);
    res.status(500).json({ error: 'cuerpo ilegible' });
    return;
  }

  const r = webhook.procesa(crudo, req.headers['x-hub-signature-256']);
  for (const envio of r.envios) await manda(envio);
  res.status(r.status).json(r.cuerpo);
}

/* Del más confiable al menos. A diferencia del de Stripe, aquí NO se acepta
   un objeto ya parseado: la firma es el único candado que tiene esta puerta
   —no hay una segunda consulta a Meta que la respalde—, así que sin bytes no
   hay nada que comprobar y se prefiere fallar ruidoso. */
async function crudoDeNode(req) {
  if (Buffer.isBuffer(req.rawBody)) return req.rawBody;
  if (typeof req.rawBody === 'string') return Buffer.from(req.rawBody, 'utf8');
  if (Buffer.isBuffer(req.body)) return req.body;
  if (typeof req.body === 'string') return Buffer.from(req.body, 'utf8');

  const trozos = [];
  let total = 0;
  for await (const t of req) {
    total += t.length;
    if (total > 1048576) throw new Error('cuerpo demasiado grande');
    trozos.push(t);
  }
  if (!trozos.length && req.body && typeof req.body === 'object') {
    throw new Error('el entorno ya parseo el cuerpo y no quedan bytes que firmar');
  }
  return Buffer.concat(trozos);
}

export default atiende;
export const GET = atiende;
export const POST = atiende;
