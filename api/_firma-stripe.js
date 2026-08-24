/* ============================================================
   La firma de los webhooks de Stripe
   ------------------------------------------------------------
   Sin esto, /api/webhook-stripe seria una puerta abierta: quien
   sea podria mandarle un «ya pago» inventado y hacer que se
   registre un contrato sin que haya entrado un peso. La firma es
   lo unico que distingue a Stripe de cualquier otro.

   Vive aparte del endpoint a proposito: asi se prueba a secas,
   sin red y sin servidor (pruebas/probar-firma-stripe.cjs).

   COMO FIRMA STRIPE
   -----------------
   Manda una cabecera asi:

       Stripe-Signature: t=1614556800,v1=5257a8...,v0=...

   `t` es el momento en que firmo. `v1` es
   HMAC-SHA256( secreto , "<t>.<cuerpo crudo>" ) en hexadecimal.

   DOS COSAS QUE NO SE PUEDEN AFLOJAR
   ----------------------------------
   1. El CUERPO CRUDO. Si el cuerpo se parsea a objeto y se vuelve
      a serializar, los bytes cambian —espacios, orden— y la firma
      deja de cuadrar. Por eso el endpoint lee el flujo a mano.

   2. La COMPARACION EN TIEMPO CONSTANTE. Comparar con === filtra
      informacion por cuanto tarda en fallar, y con eso se puede
      adivinar la firma byte por byte. Va con timingSafeEqual.

   Y la ventana de tiempo: una firma vieja legitima, capturada,
   se podria reenviar mil veces. Fuera de la tolerancia, no vale.
   ============================================================ */

const crypto = require('crypto');

/* Cinco minutos, que es la tolerancia que Stripe recomienda. */
const TOLERANCIA_S = 300;

function partes(cabecera) {
  const out = { t: null, v1: [] };
  String(cabecera || '').split(',').forEach(function (trozo) {
    const i = trozo.indexOf('=');
    if (i < 0) return;
    const k = trozo.slice(0, i).trim();
    const v = trozo.slice(i + 1).trim();
    if (k === 't') out.t = v;
    else if (k === 'v1') out.v1.push(v);   // puede venir mas de una: cuentan todas
  });
  return out;
}

function igualesEnTiempoConstante(a, b) {
  const A = Buffer.from(String(a), 'utf8');
  const B = Buffer.from(String(b), 'utf8');
  // timingSafeEqual truena si miden distinto; la diferencia de largo no es
  // secreta, así que se resuelve antes y sin filtrar nada más.
  if (A.length !== B.length) return false;
  return crypto.timingSafeEqual(A, B);
}

/* Devuelve { ok: true } o { ok: false, motivo }. El motivo es para el registro
   del servidor, nunca para la respuesta: a quien toca la puerta no se le
   explica por que no abrio. */
function verifica(cuerpoCrudo, cabecera, secreto, ahoraS) {
  if (!secreto) return { ok: false, motivo: 'sin secreto configurado' };
  if (!cabecera) return { ok: false, motivo: 'sin cabecera de firma' };
  if (!Buffer.isBuffer(cuerpoCrudo) && typeof cuerpoCrudo !== 'string') {
    return { ok: false, motivo: 'el cuerpo no llego crudo' };
  }

  const p = partes(cabecera);
  if (!p.t || !/^\d+$/.test(p.t)) return { ok: false, motivo: 'sin marca de tiempo' };
  if (!p.v1.length) return { ok: false, motivo: 'sin firma v1' };

  const ahora = typeof ahoraS === 'number' ? ahoraS : Math.floor(Date.now() / 1000);
  const edad = Math.abs(ahora - Number(p.t));
  if (edad > TOLERANCIA_S) return { ok: false, motivo: 'firma vencida (' + edad + 's)' };

  const cuerpo = Buffer.isBuffer(cuerpoCrudo) ? cuerpoCrudo : Buffer.from(cuerpoCrudo, 'utf8');
  const esperada = crypto
    .createHmac('sha256', secreto)
    .update(Buffer.concat([Buffer.from(p.t + '.', 'utf8'), cuerpo]))
    .digest('hex');

  const cuadra = p.v1.some(function (f) { return igualesEnTiempoConstante(f, esperada); });
  return cuadra ? { ok: true } : { ok: false, motivo: 'la firma no cuadra' };
}

/* Firma un cuerpo como lo haria Stripe. Solo lo usan las pruebas: aqui no se
   firma nada de verdad, se verifica. */
function firmaDePrueba(cuerpoCrudo, secreto, tS) {
  const t = String(tS || Math.floor(Date.now() / 1000));
  const cuerpo = Buffer.isBuffer(cuerpoCrudo) ? cuerpoCrudo : Buffer.from(String(cuerpoCrudo), 'utf8');
  const v1 = crypto.createHmac('sha256', secreto)
    .update(Buffer.concat([Buffer.from(t + '.', 'utf8'), cuerpo]))
    .digest('hex');
  return 't=' + t + ',v1=' + v1;
}

module.exports = { verifica, firmaDePrueba, TOLERANCIA_S };
