/* ============================================================
   Webhook de WhatsApp — las reglas, sin red
   ------------------------------------------------------------
   Igual que `_webhook-logica.js` con Stripe: aquí entra el cuerpo
   crudo y sale qué contestar. No hay `fetch` ni Meta, y por eso
   se prueba entero sin conectar nada.

   POR QUÉ ESTE NO LLEVA `defensas.puerta`

   Todas las demás puertas del sitio exigen que la petición venga
   de nuestro propio dominio. Meta NO viene de ahí: viene de sus
   servidores, sin cabecera de origen que nos sirva. Ponerle
   `puerta` dejaría a Meta fuera y el bot no contestaría nunca.

   El candado aquí es OTRO, y es más fuerte: la firma. Meta firma
   cada aviso con el secreto de la aplicación, que solo tenemos
   nosotros y ellos. Sin firma buena, no se contesta.

   Es exactamente el mismo trato que con Stripe.
   ============================================================ */

const crypto = require('crypto');
/* Vive en la RAÍZ, no en `api/`, y a propósito: la pantalla de prueba
   lo carga desde el navegador, y Vercel no sirve nada de `api/` como
   archivo. Es el mismo lugar donde ya viven `unidades.js` y
   `cotizacion.js`, por la misma razón. */
const conversacion = require('../bot');

/* ------------------------------------------------------------
   COMPARAR SIN FILTRAR EL TIEMPO
   ------------------------------------------------------------
   Un `===` sobre cadenas se corta en la primera letra distinta, y
   ese tiempo se mide para adivinar el secreto letra por letra.
   `timingSafeEqual` tarda lo mismo acierte o no, pero truena si
   los dos búferes miden distinto — así que primero se resumen los
   dos con SHA-256, que siempre da el mismo largo.
   ------------------------------------------------------------ */
function igualesEnTiempoConstante(a, b) {
  const A = crypto.createHash('sha256').update(String(a == null ? '' : a)).digest();
  const B = crypto.createHash('sha256').update(String(b == null ? '' : b)).digest();
  return crypto.timingSafeEqual(A, B);
}

/* ------------------------------------------------------------
   EL SALUDO DE ALTA (GET)
   ------------------------------------------------------------
   Al dar de alta el webhook, Meta llama UNA vez con un token que
   nosotros escribimos en su panel, y espera que le devolvamos su
   `challenge` tal cual. Si no cuadra, no da de alta nada.
   ------------------------------------------------------------ */
function verificaSuscripcion(params, entorno) {
  const env = entorno || process.env;
  const esperado = env.WHATSAPP_VERIFY_TOKEN;

  /* Falla CERRADA. Una variable que se olvidó de configurar no puede
     volverse una puerta abierta. */
  if (!esperado) {
    return { status: 503, cuerpo: 'Falta WHATSAPP_VERIFY_TOKEN en Vercel.' };
  }
  const p = params || {};
  if (p['hub.mode'] !== 'subscribe') {
    return { status: 400, cuerpo: 'modo no esperado' };
  }
  if (!igualesEnTiempoConstante(p['hub.verify_token'], esperado)) {
    return { status: 403, cuerpo: 'token incorrecto' };
  }
  /* Meta espera SU challenge en texto plano, sin comillas ni JSON. */
  return { status: 200, cuerpo: String(p['hub.challenge'] == null ? '' : p['hub.challenge']) };
}

/* ------------------------------------------------------------
   LA FIRMA (POST)
   ------------------------------------------------------------
   Meta manda `x-hub-signature-256: sha256=<hex>`, que es el HMAC
   del cuerpo CRUDO con el secreto de la aplicación. Sobre los
   bytes exactos: si alguien los parsea y los vuelve a serializar,
   la firma ya no cuadra aunque el contenido sea el mismo.
   ------------------------------------------------------------ */
function firmaValida(crudo, cabecera, secreto) {
  if (!secreto) return false;
  const texto = String(cabecera || '');
  if (texto.indexOf('sha256=') !== 0) return false;
  const dieron = texto.slice(7);
  const nuestra = crypto.createHmac('sha256', secreto)
    .update(Buffer.isBuffer(crudo) ? crudo : Buffer.from(String(crudo), 'utf8'))
    .digest('hex');
  return igualesEnTiempoConstante(dieron, nuestra);
}

/* ------------------------------------------------------------
   NO CONTESTAR DOS VECES LO MISMO
   ------------------------------------------------------------
   Meta reintenta cuando tarda la respuesta, y el reintento trae
   el MISMO id de mensaje. Sin esto, el cliente recibiría la misma
   contestación dos y tres veces.

   El mapa tiene tope duro y desaloja lo más viejo: la clave la
   elige quien manda, así que sin tope crecería sin fin. Esa es la
   regla 5 de `antes-de-escribir`, que ya se pagó una vez.
   ------------------------------------------------------------ */
const TOPE_VISTOS = 500;
const vistos = new Map();

function yaContestado(id) {
  if (!id) return false;
  if (vistos.has(id)) return true;
  vistos.set(id, Date.now());
  while (vistos.size > TOPE_VISTOS) {
    vistos.delete(vistos.keys().next().value);   // el más viejo primero
  }
  return false;
}

/* ------------------------------------------------------------
   FRENO POR QUIEN ESCRIBE
   ------------------------------------------------------------
   La clave es el número que manda, o sea QUIEN ATACA — no a quién
   se ataca. Un contador por destinatario dejaría que cualquiera
   silenciara al bot para los demás.
   ------------------------------------------------------------ */
const TOPE_POR_MINUTO = 12;
const TOPE_REMITENTES = 2000;
const remitentes = new Map();

function pasaElFreno(numero, ahora) {
  const t = ahora || Date.now();
  const reg = remitentes.get(numero) || { desde: t, n: 0 };
  if (t - reg.desde > 60000) { reg.desde = t; reg.n = 0; }
  reg.n += 1;
  remitentes.set(numero, reg);
  while (remitentes.size > TOPE_REMITENTES) {
    remitentes.delete(remitentes.keys().next().value);
  }
  return reg.n <= TOPE_POR_MINUTO;
}

/* Solo para las pruebas: deja empezar de cero. */
function olvidaTodo() { vistos.clear(); remitentes.clear(); }

/* ------------------------------------------------------------
   PROCESA UN AVISO DE META
   ------------------------------------------------------------
   Devuelve { status, cuerpo, envios }. `envios` es la lista de
   mensajes a mandar; quien llama es el que tiene la red. Así esto
   se prueba sin conectar nada.

   A Meta SIEMPRE se le contesta 200 cuando la firma es buena,
   aunque no hayamos sabido qué hacer con el aviso. Si se le
   contesta error, reintenta, y si insiste, apaga el webhook.
   ------------------------------------------------------------ */
function procesa(crudo, firma, entorno) {
  const env = entorno || process.env;

  if (!env.WHATSAPP_APP_SECRET) {
    return { status: 503, cuerpo: { error: 'sin secreto' }, envios: [] };
  }
  if (!firmaValida(crudo, firma, env.WHATSAPP_APP_SECRET)) {
    return { status: 401, cuerpo: { error: 'firma invalida' }, envios: [] };
  }

  let aviso;
  try {
    aviso = JSON.parse(Buffer.isBuffer(crudo) ? crudo.toString('utf8') : String(crudo));
  } catch (e) {
    /* Firma buena pero cuerpo ilegible: es cosa nuestra, no de un
       atacante. Se acepta para que Meta no reintente en balde. */
    return { status: 200, cuerpo: { ok: true, aviso: 'cuerpo ilegible' }, envios: [] };
  }

  const envios = [];
  const entradas = (aviso && aviso.entry) || [];

  for (let i = 0; i < entradas.length; i++) {
    const cambios = entradas[i].changes || [];
    for (let j = 0; j < cambios.length; j++) {
      const valor = (cambios[j] && cambios[j].value) || {};

      /* Los acuses de entrega («entregado», «leído») llegan por aquí
         mismo y NO son mensajes. Contestarlos sería escribirle al
         cliente cada vez que abre la conversación. */
      if (!valor.messages) continue;

      const deQuien = (valor.metadata && valor.metadata.phone_number_id) || '';

      for (let k = 0; k < valor.messages.length; k++) {
        const m = valor.messages[k] || {};
        if (yaContestado(m.id)) continue;
        if (!pasaElFreno(m.from || 'desconocido')) continue;

        let texto;
        if (m.type === 'text') {
          texto = (m.text && m.text.body) || '';
        } else {
          /* Una foto, un audio o una ubicación. No se traducen a texto
             —eso pediría IA— y adivinar sale peor que decir la verdad. */
          texto = null;
        }

        const r = texto === null
          ? {
              texto: 'Recibí tu ' + (m.type || 'mensaje') + ', pero por aquí solo ' +
                'leo texto 🙏\n\nEscríbeme qué necesitas, o márcale al *' +
                conversacion.TELEFONO + '*.',
              pasa: true
            }
          : conversacion.respuestaA(texto);

        envios.push({
          numeroDeOrigen: deQuien,
          para: m.from,
          texto: r.texto,
          pasaAPersona: r.pasa,
          /* Se guarda lo que escribió para poder revisarlo después. Va
             recortado: un mensaje larguísimo no tiene por qué caber
             entero en un registro. */
          escribio: texto === null ? '[' + (m.type || 'no-texto') + ']' : String(texto).slice(0, 500)
        });
      }
    }
  }

  return { status: 200, cuerpo: { ok: true }, envios: envios };
}

module.exports = {
  verificaSuscripcion,
  procesa,
  firmaValida,
  igualesEnTiempoConstante,
  olvidaTodo,
  TOPE_POR_MINUTO
};
