/* ============================================================
   Cotizador — función serverless de Vercel
   ------------------------------------------------------------
   Calcula los kilómetros con la Routes API de Google y devuelve
   el precio ya armado. El navegador NUNCA ve la clave ni la
   tarifa: pide a este endpoint y aquí se hace todo.

   Que la tarifa viva aquí y no en el navegador importa: cuando
   la fase 4 genere el contrato, va a volver a calcular con este
   mismo archivo, y no hay forma de que el cliente mande un
   precio inventado.

   Reglas de negocio (confirmadas por el dueño):
     · $36 por kilómetro, IVA YA INCLUIDO
     · Mínimo $3,000 POR DÍA de servicio
     · Ida y vuelta se miden por separado y se suman
     · No se cobra la estadía ni el traslado desde la base

   Defensas: mismas que /api/places. Si cambias la lista de
   orígenes permitidos, cámbiala en los dos archivos.
   ============================================================ */

const GOOGLE = 'https://routes.googleapis.com/directions/v2:computeRoutes';

const PERMITIDOS = [
  'https://eurotravel-web.vercel.app',
  'http://localhost:5175'
];

// La Routes API cuesta más que el autocompletado, así que los topes son más bajos
const LIMITE_POR_VISITANTE = 30;      // llamadas por minuto
const LIMITE_DIARIO = 500;            // llamadas al día por instancia

// ---------- tarifa ----------
const TARIFA_KM = 36;                 // pesos por kilómetro, IVA incluido
const MINIMO_POR_DIA = 3000;          // piso por día de servicio, IVA incluido
const TASA_IVA = 0.16;

const visitantes = new Map();
let contadorDia = { fecha: '', total: 0 };

// Caché por par de puntos: si dos personas cotizan la misma ruta, Google se paga una vez.
// Vive solo mientras la instancia siga caliente; es un ahorro, no una garantía.
const CACHE_VIDA = 24 * 60 * 60 * 1000;
const rutas = new Map();

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

/* Días de servicio, contados inclusive: salir el 20 y regresar el 22 son 3 días.
   Se compara solo la fecha en UTC para que no se cuele la zona horaria. */
function diasDeServicio(salida, regreso) {
  function aDia(iso) {
    const p = String(iso || '').slice(0, 10).split('-');
    if (p.length !== 3) return NaN;
    return Date.UTC(Number(p[0]), Number(p[1]) - 1, Number(p[2]));
  }
  const a = aDia(salida);
  if (!isFinite(a)) return 1;
  const b = aDia(regreso);
  if (!isFinite(b)) return 1;
  return Math.max(1, Math.round((b - a) / 86400000) + 1);
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

module.exports = async function handler(req, res) {
  if (req.method === 'OPTIONS') { res.status(204).end(); return; }
  if (req.method !== 'POST') { res.status(405).json({ error: 'Método no permitido' }); return; }

  if (!origenValido(req)) { res.status(403).json({ error: 'Origen no autorizado' }); return; }

  const clave = process.env.GOOGLE_ROUTES_KEY;
  if (!clave) {
    // Sin clave el sitio no se rompe: el viaje sigue y se cotiza a mano
    res.status(503).json({ error: 'Cotizador en línea no configurado' });
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

  const origen = formasDe(cuerpo.origen);
  const destino = formasDe(cuerpo.destino);
  if (!origen.length || !destino.length) {
    res.status(400).json({ error: 'Falta el origen o el destino' });
    return;
  }

  const redondo = cuerpo.redondo !== false && !!cuerpo.regreso;
  const dias = diasDeServicio(cuerpo.salida, cuerpo.regreso);

  try {
    const ida = await mideTramo(origen, destino, clave);
    if (!ida) {
      res.status(422).json({
        error: 'sin ruta de ida',
        aviso: 'No encontramos una ruta por carretera entre esos dos puntos.'
      });
      return;
    }

    // La vuelta se mide aparte: por sentidos únicos y entronques rara vez da igual que la ida
    let vuelta = null;
    if (redondo) {
      vuelta = await mideTramo(destino, origen, clave);
      if (!vuelta) {
        res.status(422).json({
          error: 'sin ruta de vuelta',
          aviso: 'No encontramos la ruta de regreso entre esos dos puntos.'
        });
        return;
      }
    }

    const kmIda = ida.metros / 1000;
    const kmVuelta = vuelta ? vuelta.metros / 1000 : 0;
    const kmTotal = kmIda + kmVuelta;

    const porKilometro = kmTotal * TARIFA_KM;
    const minimo = dias * MINIMO_POR_DIA;
    const aplicoMinimo = minimo > porKilometro;
    const total = Math.round(aplicoMinimo ? minimo : porKilometro);

    // El precio ya trae IVA; se desglosa para el contrato de la fase 4
    const subtotal = Math.round((total / (1 + TASA_IVA)) * 100) / 100;

    res.status(200).json({
      km: {
        ida: Math.round(kmIda * 10) / 10,
        vuelta: Math.round(kmVuelta * 10) / 10,
        total: Math.round(kmTotal * 10) / 10
      },
      minutos: {
        ida: Math.round(ida.segundos / 60),
        vuelta: vuelta ? Math.round(vuelta.segundos / 60) : 0
      },
      redondo: redondo,
      dias: dias,
      tarifaKm: TARIFA_KM,
      minimoPorDia: MINIMO_POR_DIA,
      porKilometro: Math.round(porKilometro),
      minimo: minimo,
      aplicoMinimo: aplicoMinimo,
      total: total,
      ivaIncluido: true,
      subtotal: subtotal,
      iva: Math.round((total - subtotal) * 100) / 100
    });
  } catch (e) {
    res.status(502).json({ error: 'No se pudo calcular la distancia' });
  }
};
