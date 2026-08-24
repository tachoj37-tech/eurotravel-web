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

const defensas = require('./_defensas');   // origen, freno e IP viven ahi

const GOOGLE = 'https://places.googleapis.com/v1';

// El autocompletado es barato, así que aguanta más que cotizar o pagar.
const freno = defensas.creaFreno({ porMinuto: 60, porDia: 2000 });

module.exports = async function handler(req, res) {
  if (defensas.puerta(req, res)) return;   // OPTIONS, POST y origen, en un lugar

  const clave = process.env.GOOGLE_PLACES_KEY;
  if (!clave) {
    // Sin clave configurada el sitio sigue funcionando: se escribe la dirección a mano
    res.status(503).json({ error: 'Autocompletado no configurado' });
    return;
  }

  const frenado = freno(req);
  if (frenado) { res.status(frenado.status).json({ error: frenado.error }); return; }

  const cuerpo = defensas.cuerpoJSON(req);

  const accion = cuerpo.accion;
  const sesion = typeof cuerpo.sessionToken === 'string' ? cuerpo.sessionToken.slice(0, 60) : '';

  try {
    if (accion === 'autocomplete') {
      const texto = String(cuerpo.input || '').slice(0, 200);
      if (texto.trim().length < 3) { res.status(200).json({ suggestions: [] }); return; }

      /* Acotar la búsqueda al destino elegido. Sin esto, quien busca una
         dirección en Puerto Vallarta recibe coincidencias de todo el país. */
      const peticion = {
        input: texto,
        includedRegionCodes: [String(cuerpo.pais || 'mx').slice(0, 2)],
        languageCode: String(cuerpo.idioma || 'es').slice(0, 5),
        sessionToken: sesion
      };

      const cLat = Number(cuerpo.centroLat), cLng = Number(cuerpo.centroLng);
      if (isFinite(cLat) && isFinite(cLng) && Math.abs(cLat) <= 90 && Math.abs(cLng) <= 180) {
        // radio en metros, entre 5 y 200 km
        const radio = Math.min(200000, Math.max(5000, Number(cuerpo.radio) || 60000));
        peticion.locationRestriction = {
          circle: { center: { latitude: cLat, longitude: cLng }, radius: radio }
        };
      }

      const r = await fetch(GOOGLE + '/places:autocomplete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Goog-Api-Key': clave },
        body: JSON.stringify(peticion)
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
