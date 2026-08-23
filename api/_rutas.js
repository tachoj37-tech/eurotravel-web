/* ============================================================
   Medir tramos por carretera con la Routes API de Google
   ------------------------------------------------------------
   Lo usan /api/cotizar y /api/pagar. Compartirlo importa: el
   kilometraje con el que se cobra tiene que salir del mismo
   camino que el que se cotizo, y el cache se aprovecha entre
   los dos.

   El guion bajo del nombre evita que Vercel lo publique como
   una direccion mas del sitio.
   ============================================================ */

const GOOGLE = 'https://routes.googleapis.com/directions/v2:computeRoutes';

// Cache por par de puntos: si dos personas cotizan la misma ruta, Google se
// paga una vez. Vive mientras la instancia siga caliente; es un ahorro, no
// una garantia.
const CACHE_VIDA = 24 * 60 * 60 * 1000;
const rutas = new Map();

/* Un punto puede venir como place_id de Google o como coordenadas sueltas
   (cuando el visitante escribió la dirección a mano o pegó un link del mapa).

   Se devuelven TODAS las formas que sirvan, no solo la mejor: si Google no
   reconoce el place_id se reintenta con las coordenadas y el visitante ni se
   entera. La página casi siempre manda las dos. */
function formasDe(p) {
  if (!p || typeof p !== 'object') return [];
  const formas = [];

  const id = typeof p.placeId === 'string' ? p.placeId.slice(0, 200) : '';
  if (id && /^[A-Za-z0-9_-]+$/.test(id)) formas.push({ placeId: id });

  const lat = Number(p.lat), lng = Number(p.lng);
  if (isFinite(lat) && isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180) {
    formas.push({ location: { latLng: { latitude: lat, longitude: lng } } });
  }

  // Último recurso, y el más importante: la lista de destinos que trae la página
  // no guarda coordenadas, solo el nombre. Google sabe geocodificarlo.
  const dir = typeof p.direccion === 'string' ? p.direccion.trim().slice(0, 300) : '';
  if (dir.length >= 3) formas.push({ address: dir });

  return formas;
}

/* Mide un tramo probando las formas en orden hasta que una dé ruta */
async function mideTramo(desde, hacia, clave) {
  for (let i = 0; i < Math.max(desde.length, hacia.length); i++) {
    const a = desde[Math.min(i, desde.length - 1)];
    const b = hacia[Math.min(i, hacia.length - 1)];
    const r = await midePierna(a, b, clave);
    if (r) return r;
  }
  return null;
}

function clavePunto(p) {
  if (p.placeId) return 'p:' + p.placeId;
  if (p.address) return 'd:' + p.address.toLowerCase();
  const c = p.location.latLng;
  return 'c:' + c.latitude.toFixed(5) + ',' + c.longitude.toFixed(5);
}


async function midePierna(desde, hacia, clave) {
  const llave = clavePunto(desde) + '>' + clavePunto(hacia);
  const guardado = rutas.get(llave);
  if (guardado && Date.now() - guardado.cuando < CACHE_VIDA) return guardado.dato;

  const r = await fetch(GOOGLE, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': clave,
      'X-Goog-FieldMask': 'routes.distanceMeters,routes.duration'
    },
    body: JSON.stringify({
      origin: desde,
      destination: hacia,
      travelMode: 'DRIVE',
      routingPreference: 'TRAFFIC_UNAWARE',   // el más barato y estable entre consultas
      units: 'METRIC',
      languageCode: 'es-MX',
      regionCode: 'MX'
    })
  });

  const d = await r.json();
  if (d.error || !d.routes || !d.routes.length) return null;

  const ruta = d.routes[0];
  const dato = {
    metros: Number(ruta.distanceMeters) || 0,
    segundos: parseInt(String(ruta.duration || '0').replace('s', ''), 10) || 0
  };
  if (!dato.metros) return null;

  if (rutas.size > 800) rutas.clear();
  rutas.set(llave, { cuando: Date.now(), dato: dato });
  return dato;
}

module.exports = { formasDe, mideTramo };
