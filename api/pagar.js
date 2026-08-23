/* ============================================================
   Cobro del anticipo con Stripe — función serverless de Vercel
   ------------------------------------------------------------
   Crea la sesión de pago del 20% y devuelve la dirección a donde
   mandar al cliente. El resto del viaje se abona después.

   Dos cosas que importan:

   1. El precio se vuelve a calcular AQUÍ, midiendo la ruta otra
      vez. Nunca se cobra el monto que mande el navegador: si se
      confiara en él, cualquiera podría pagar $1 por un viaje de
      veinte mil.

   2. Se compra como invitado. No se pide crear cuenta: basta el
      correo y el teléfono, y con eso se le manda a dónde seguir
      abonando.

   Se habla con Stripe por su API de siempre, sin instalar
   librerías: este sitio no tiene paso de compilación y así sigue.

   Necesita la variable STRIPE_SECRET_KEY en Vercel. Sin ella el
   sitio no se rompe: la pantalla avisa y el viaje se cierra por
   teléfono, como hoy.
   ============================================================ */

const tarifa = require('./_tarifa');
const rutas = require('./_rutas');

const STRIPE = 'https://api.stripe.com/v1';

const PERMITIDOS = [
  'https://eurotravel-web.vercel.app',
  'http://localhost:5175'
];

/* Seguro contra cobrar de verdad antes de tiempo.
   Mientras esto sea false, una clave sk_live_ no cobra nada: la pantalla avisa
   y el viaje se cierra por telefono. Se pone en true cuando el recorrido ya se
   probo completo con la clave de prueba y el dueño da el visto bueno. */
const PERMITIR_COBRO_REAL = false;

/* OXXO no recibe cualquier cantidad: el voucher tiene tope. Si se le pide a
   Stripe un pago en efectivo por encima del limite, rechaza la sesion entera
   y el cliente se queda sin poder pagar ni con tarjeta. Asi que arriba de este
   monto solo se ofrece tarjeta. El numero es conservador a proposito. */
const TOPE_OXXO = 9000;

const LIMITE_POR_VISITANTE = 12;      // sesiones de pago por minuto
const LIMITE_DIARIO = 300;

const visitantes = new Map();
let contadorDia = { fecha: '', total: 0 };

function permiteVisitante(ip) {
  const ahora = Date.now();
  const reg = visitantes.get(ip) || { desde: ahora, n: 0 };
  if (ahora - reg.desde > 60000) { reg.desde = ahora; reg.n = 0; }
  reg.n += 1;
  visitantes.set(ip, reg);
  if (visitantes.size > 5000) visitantes.clear();
  return reg.n <= LIMITE_POR_VISITANTE;
}

function permiteDia() {
  const hoy = new Date().toISOString().slice(0, 10);
  if (contadorDia.fecha !== hoy) contadorDia = { fecha: hoy, total: 0 };
  contadorDia.total += 1;
  return contadorDia.total <= LIMITE_DIARIO;
}

function origenValido(req) {
  const origen = req.headers.origin || '';
  const referer = req.headers.referer || '';
  return PERMITIDOS.some(function (p) {
    return origen === p || referer.indexOf(p) === 0;
  });
}

function sitioDe(req) {
  const origen = req.headers.origin || '';
  if (PERMITIDOS.indexOf(origen) >= 0) return origen;
  const referer = req.headers.referer || '';
  for (let i = 0; i < PERMITIDOS.length; i++) {
    if (referer.indexOf(PERMITIDOS[i]) === 0) return PERMITIDOS[i];
  }
  return PERMITIDOS[0];
}

/* Folio corto y legible, del estilo ET-K3M9-4Q2. Sirve para que el cliente
   y quien conteste el teléfono hablen del mismo viaje. */
function nuevoFolio() {
  const abc = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';   // sin I, O, 0, 1: se confunden al dictar
  let s = '';
  for (let i = 0; i < 7; i++) {
    if (i === 4) s += '-';
    s += abc.charAt(Math.floor(Math.random() * abc.length));
  }
  return 'ET-' + s;
}

function limpia(v, largo) {
  return String(v == null ? '' : v).replace(/[\r\n\t]+/g, ' ').trim().slice(0, largo || 120);
}

function correoValido(c) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(c);
}

/* Stripe recibe formularios, no JSON. Los objetos anidados van como
   metadata[folio], line_items[0][price_data][currency], y así. */
function aFormulario(obj, prefijo, salida) {
  salida = salida || [];
  Object.keys(obj).forEach(function (k) {
    const v = obj[k];
    if (v === undefined || v === null) return;
    const llave = prefijo ? prefijo + '[' + k + ']' : k;
    if (typeof v === 'object' && !Array.isArray(v)) {
      aFormulario(v, llave, salida);
    } else if (Array.isArray(v)) {
      v.forEach(function (item, i) {
        if (typeof item === 'object') aFormulario(item, llave + '[' + i + ']', salida);
        else salida.push(encodeURIComponent(llave + '[' + i + ']') + '=' + encodeURIComponent(item));
      });
    } else {
      salida.push(encodeURIComponent(llave) + '=' + encodeURIComponent(v));
    }
  });
  return salida;
}

async function aStripe(ruta, cuerpo, clave) {
  const r = await fetch(STRIPE + ruta, {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer ' + clave,
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: aFormulario(cuerpo).join('&')
  });
  return { ok: r.ok, datos: await r.json() };
}

module.exports = async function handler(req, res) {
  if (req.method === 'OPTIONS') { res.status(204).end(); return; }
  if (req.method !== 'POST') { res.status(405).json({ error: 'Método no permitido' }); return; }
  if (!origenValido(req)) { res.status(403).json({ error: 'Origen no autorizado' }); return; }

  // se recorta: al copiar del panel es facil que se cuele un espacio o un salto
  // de linea, y con eso hasta la cabecera de autorizacion sale mal
  const claveStripe = (process.env.STRIPE_SECRET_KEY || '').trim();
  const claveRutas = process.env.GOOGLE_ROUTES_KEY;

  if (!claveStripe) {
    res.status(503).json({
      error: 'stripe sin configurar',
      aviso: 'El pago en línea todavía no está activo.'
    });
    return;
  }

  if (claveStripe.indexOf('sk_live_') === 0 && !PERMITIR_COBRO_REAL) {
    res.status(503).json({
      error: 'clave de produccion con el cobro real todavia cerrado',
      aviso: 'El pago en línea todavía no está activo.'
    });
    return;
  }
  if (!claveRutas) {
    res.status(503).json({
      error: 'routes sin configurar',
      aviso: 'No pudimos confirmar el precio en este momento.'
    });
    return;
  }

  const ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'sin-ip';
  if (!permiteVisitante(ip)) { res.status(429).json({ error: 'Demasiadas solicitudes' }); return; }
  if (!permiteDia()) { res.status(429).json({ error: 'Límite diario alcanzado' }); return; }

  let cuerpo = req.body;
  if (typeof cuerpo === 'string') {
    try { cuerpo = JSON.parse(cuerpo); } catch (e) { cuerpo = {}; }
  }
  cuerpo = cuerpo || {};

  const correo = limpia(cuerpo.correo, 120).toLowerCase();
  const telefono = limpia(cuerpo.telefono, 30);
  const nombre = limpia(cuerpo.nombre, 90);
  const canal = cuerpo.canal === 'whatsapp' ? 'whatsapp' : 'correo';

  if (!correoValido(correo)) { res.status(400).json({ error: 'correo inválido', aviso: 'Revisa tu correo.' }); return; }
  if (telefono.replace(/\D/g, '').length < 10) {
    res.status(400).json({ error: 'teléfono inválido', aviso: 'Revisa tu teléfono a diez dígitos.' });
    return;
  }

  const origen = rutas.formasDe(cuerpo.origen);
  const destino = rutas.formasDe(cuerpo.destino);
  if (!origen.length || !destino.length) {
    res.status(400).json({ error: 'faltan puntos', aviso: 'Falta el origen o el destino del viaje.' });
    return;
  }

  const redondo = cuerpo.redondo !== false && !!cuerpo.regreso;
  const dias = tarifa.diasDeServicio(cuerpo.salida, cuerpo.regreso);

  try {
    /* --- el precio se vuelve a sacar aquí, no se cree lo que llegó --- */
    const ida = await rutas.mideTramo(origen, destino, claveRutas);
    if (!ida) {
      res.status(422).json({ error: 'sin ruta', aviso: 'No encontramos la ruta de ese viaje.' });
      return;
    }
    let vuelta = null;
    if (redondo) {
      vuelta = await rutas.mideTramo(destino, origen, claveRutas);
      if (!vuelta) {
        res.status(422).json({ error: 'sin ruta de vuelta', aviso: 'No encontramos la ruta de regreso.' });
        return;
      }
    }

    const kmTotal = (ida.metros + (vuelta ? vuelta.metros : 0)) / 1000;
    const p = tarifa.calcula(kmTotal, dias);

    const folio = nuevoFolio();
    const sitio = sitioDe(req);
    const ruta = limpia(cuerpo.rutaTexto, 90) || 'Servicio de transporte';
    const unidad = limpia(cuerpo.unidad, 60);

    const sesion = await aStripe('/checkout/sessions', {
      mode: 'payment',
      locale: 'es',
      customer_email: correo,
      customer_creation: 'always',        // deja rastro para los abonos que siguen
      success_url: sitio + '/?pago=listo&folio=' + folio + '&sesion={CHECKOUT_SESSION_ID}#/cotizar',
      cancel_url: sitio + '/?pago=cancelado#/cotizar',
      line_items: [{
        quantity: 1,
        price_data: {
          currency: 'mxn',
          unit_amount: p.anticipo * 100,     // Stripe cuenta en centavos
          product_data: {
            name: 'Anticipo ' + p.porcentajeAnticipo + '% · ' + ruta,
            description: unidad + ' · ' + dias + (dias === 1 ? ' día' : ' días') +
              ' · Total del viaje $' + p.total.toLocaleString('es-MX') + ' MXN, IVA incluido'
          }
        }
      }],
      payment_method_types: p.anticipo <= TOPE_OXXO ? ['card', 'oxxo'] : ['card'],
      metadata: {
        folio: folio,
        nombre: nombre,
        telefono: telefono,
        canal: canal,
        ruta: ruta,
        unidad: unidad,
        salida: limpia(cuerpo.salida, 20),
        regreso: limpia(cuerpo.regreso, 20),
        dias: String(dias),
        km: String(Math.round(kmTotal * 10) / 10),
        total: String(p.total),
        anticipo: String(p.anticipo),
        saldo: String(p.saldo)
      }
    }, claveStripe);

    if (!sesion.ok || !sesion.datos.url) {
      res.status(502).json({
        error: 'stripe: ' + ((sesion.datos.error && sesion.datos.error.message) || 'sin url'),
        aviso: 'No pudimos abrir el pago en este momento.'
      });
      return;
    }

    res.status(200).json({
      url: sesion.datos.url,
      folio: folio,
      total: p.total,
      anticipo: p.anticipo,
      saldo: p.saldo,
      porcentajeAnticipo: p.porcentajeAnticipo
    });
  } catch (e) {
    res.status(502).json({ error: String(e && e.message), aviso: 'No pudimos abrir el pago en este momento.' });
  }
};
