/* ============================================================
   Proxy de Places API — función serverless de Vercel
   ------------------------------------------------------------
   El navegador NUNCA habla con Google ni ve la clave: le pide a
   este endpoint, y este endpoint es quien llama a Google usando
   GOOGLE_PLACES_KEY, que vive solo en las variables de entorno
   de Vercel y jamás se envía al cliente.

   Defensas:
     · Solo acepta peticiones desde nuestro propio dominio
     · Solo dos acciones permitidas, nada de rutas libres
     · Límite de llamadas por visitante y tope global diario
     · Recorta los campos que devuelve
   ============================================================ */

const GOOGLE = 'https://places.googleapis.com/v1';

// Orígenes autorizados a usar este proxy
const PERMITIDOS = [
  'https://eurotravel-web.vercel.app',
  'http://localhost:5175'
];

// Topes: protegen la cuota aunque alguien intente abusar
const LIMITE_POR_VISITANTE = 60;      // llamadas por minuto
const LIMITE_DIARIO = 2000;           // llamadas al día por instancia

const visitantes = new Map();
let contadorDia = { fecha: '', total: 0 };

function permiteVisitante(ip) {
  const ahora = Date.now();
  const reg = visitantes.get(ip) || { desde: ahora, n: 0 };
  if (ahora - reg.desde > 60000) { reg.desde = ahora; reg.n = 0; }
  reg.n += 1;
  visitantes.set(ip, reg);
  if (visitantes.size > 5000) visitantes.clear(); // evita crecer sin fin
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

module.exports = async function handler(req, res) {
  if (req.method === 'OPTIONS') { res.status(204).end(); return; }
  if (req.method !== 'POST') { res.status(405).json({ error: 'Método no permitido' }); return; }

  if (!origenValido(req)) {
    res.status(403).json({ error: 'Origen no autorizado' });
    return;
  }

  const clave = process.env.GOOGLE_PLACES_KEY;
  if (!clave) {
    // Sin clave configurada el sitio sigue funcionando: se escribe la dirección a mano
    res.status(503).json({ error: 'Autocompletado no configurado' });
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

  const accion = cuerpo.accion;
  const sesion = typeof cuerpo.sessionToken === 'string' ? cuerpo.sessionToken.slice(0, 60) : '';

  try {
    if (accion === 'autocomplete') {
      const texto = String(cuerpo.input || '').slice(0, 200);
      if (texto.trim().length < 3) { res.status(200).json({ suggestions: [] }); return; }

      const r = await fetch(GOOGLE + '/places:autocomplete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Goog-Api-Key': clave },
        body: JSON.stringify({
          input: texto,
          includedRegionCodes: [String(cuerpo.pais || 'mx').slice(0, 2)],
          languageCode: String(cuerpo.idioma || 'es').slice(0, 5),
          sessionToken: sesion
        })
      });

      const d = await r.json();
      if (d.error) { res.status(502).json({ error: 'Google rechazó la solicitud' }); return; }

      // Solo lo que la página necesita pintar
      const lista = (d.suggestions || []).map(function (s) {
        const p = s.placePrediction || {};
        const f = p.structuredFormat || {};
        return {
          id: p.placeId,
          principal: (f.mainText && f.mainText.text) || (p.text && p.text.text) || '',
          secundario: (f.secondaryText && f.secondaryText.text) || ''
        };
      }).filter(function (s) { return s.id; });

      res.status(200).json({ suggestions: lista });
      return;
    }

    if (accion === 'detalle') {
      const placeId = String(cuerpo.placeId || '').slice(0, 200);
      if (!/^[A-Za-z0-9_-]+$/.test(placeId)) { res.status(400).json({ error: 'placeId inválido' }); return; }

      const url = GOOGLE + '/places/' + encodeURIComponent(placeId) +
        '?languageCode=' + encodeURIComponent(String(cuerpo.idioma || 'es').slice(0, 5)) +
        (sesion ? '&sessionToken=' + encodeURIComponent(sesion) : '');

      const r = await fetch(url, {
        headers: {
          'X-Goog-Api-Key': clave,
          'X-Goog-FieldMask': 'id,formattedAddress,location,addressComponents,displayName'
        }
      });

      const d = await r.json();
      if (d.error) { res.status(502).json({ error: 'Google rechazó la solicitud' }); return; }

      const comp = d.addressComponents || [];
      function busca() {
        const tipos = Array.prototype.slice.call(arguments);
        for (let i = 0; i < comp.length; i++) {
          for (let j = 0; j < tipos.length; j++) {
            if ((comp[i].types || []).indexOf(tipos[j]) >= 0) {
              return comp[i].longText || comp[i].shortText || '';
            }
          }
        }
        return '';
      }

      const calle = busca('route');
      const numero = busca('street_number');

      res.status(200).json({
        id: d.id || placeId,
        calle: calle ? calle + (numero ? ' ' + numero : '') : ((d.displayName && d.displayName.text) || ''),
        colonia: busca('sublocality_level_1', 'sublocality', 'neighborhood'),
        cp: busca('postal_code'),
        direccion: d.formattedAddress || '',
        lat: d.location ? d.location.latitude : null,
        lng: d.location ? d.location.longitude : null
      });
      return;
    }

    res.status(400).json({ error: 'Acción no reconocida' });
  } catch (e) {
    res.status(502).json({ error: 'No se pudo consultar el servicio' });
  }
};
