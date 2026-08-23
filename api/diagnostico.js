/* ============================================================
   Diagnóstico de claves — función serverless
   ------------------------------------------------------------
   Comprueba que las dos claves estén configuradas y que Google
   las acepte. NUNCA devuelve el valor de una clave: solo si
   existe, cuántos caracteres mide y qué contestó Google.

   Uso: POST /api/diagnostico desde el propio dominio.
   ============================================================ */

const PERMITIDOS = [
  'https://eurotravel-web.vercel.app',
  'http://localhost:5175'
];

function origenValido(req) {
  const origen = req.headers.origin || '';
  const referer = req.headers.referer || '';
  return PERMITIDOS.some(function (p) {
    return origen === p || referer.indexOf(p) === 0;
  });
}

async function pruebaPlaces(clave) {
  try {
    const r = await fetch('https://places.googleapis.com/v1/places:autocomplete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Goog-Api-Key': clave },
      body: JSON.stringify({ input: 'Guadalajara', includedRegionCodes: ['mx'], languageCode: 'es' })
    });
    const d = await r.json();
    if (d.error) return { ok: false, motivo: d.error.status || d.error.message };
    return { ok: true, sugerencias: (d.suggestions || []).length };
  } catch (e) {
    return { ok: false, motivo: 'sin conexión con Google' };
  }
}

async function pruebaRoutes(clave) {
  try {
    const r = await fetch('https://routes.googleapis.com/directions/v2:computeRoutes', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': clave,
        'X-Goog-FieldMask': 'routes.distanceMeters,routes.duration'
      },
      body: JSON.stringify({
        origin: { location: { latLng: { latitude: 20.6597, longitude: -103.3496 } } },
        destination: { location: { latLng: { latitude: 20.6534, longitude: -105.2253 } } },
        travelMode: 'DRIVE'
      })
    });
    const d = await r.json();
    if (d.error) return { ok: false, motivo: d.error.status || d.error.message };
    const ruta = (d.routes || [])[0];
    if (!ruta) return { ok: false, motivo: 'sin ruta en la respuesta' };
    return { ok: true, km: Math.round(ruta.distanceMeters / 1000), duracion: ruta.duration };
  } catch (e) {
    return { ok: false, motivo: 'sin conexión con Google' };
  }
}

module.exports = async function handler(req, res) {
  if (!origenValido(req)) { res.status(403).json({ error: 'Origen no autorizado' }); return; }

  const places = process.env.GOOGLE_PLACES_KEY || '';
  const routes = process.env.GOOGLE_ROUTES_KEY || '';
  const stripe = process.env.STRIPE_SECRET_KEY || '';

  const salida = {
    GOOGLE_PLACES_KEY: { configurada: !!places, largo: places.length },
    GOOGLE_ROUTES_KEY: { configurada: !!routes, largo: routes.length },
    STRIPE_SECRET_KEY: {
      configurada: !!stripe,
      largo: stripe.length,
      // saber si es de prueba o de verdad importa: con una de produccion,
      // cualquiera que entre al sitio puede cobrarse dinero real
      modo: !stripe ? 'sin clave'
          : stripe.indexOf('sk_test_') === 0 ? 'PRUEBA'
          : stripe.indexOf('sk_live_') === 0 ? 'PRODUCCION — cobra dinero real'
          : 'no reconocido'
    }
  };

  if (places) salida.GOOGLE_PLACES_KEY.prueba = await pruebaPlaces(places);
  if (routes) salida.GOOGLE_ROUTES_KEY.prueba = await pruebaRoutes(routes);

  res.status(200).json(salida);
};
