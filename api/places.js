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

/* Un número de verdad, o NaN. `Number()` a secas convierte `null`, `''` y
   `false` en 0, y cero es una coordenada válida —en el Golfo de Guinea—. */
function numeroDe(v) {
  if (v === null || v === undefined || v === '' || typeof v === 'boolean') return NaN;
  const n = Number(v);
  return Number.isFinite(n) ? n : NaN;
}

/* ------------------------------------------------------------
   SOLO LUGARES DE MEXICO
   ------------------------------------------------------------
   Eurotravel no hace viajes al extranjero, así que una sugerencia
   de fuera solo sirve para que alguien elija un destino que no se
   puede cotizar.

   Se decide AQUI y no solo con el parámetro de Google. Dos razones:

     · con cerco no se puede mandar ese parámetro (arriba está por
       qué), así que en ese camino esto es la única defensa
     · y en el otro camino es la segunda: si Google algún día deja
       de honrar `includedRegionCodes`, aquí no pasa nada

   Se mira el texto COMPLETO de la sugerencia, que con
   `languageCode: es` termina en «México» para todo lo de aquí:
   «Chapala, Jal., México». Los estados abreviados están porque en
   una búsqueda con cerco Google a veces omite el país —el cerco ya
   lo implica— y sin ellos se caería la lista entera.
   ------------------------------------------------------------ */
const ESTADOS = ['ags', 'bc', 'bcs', 'camp', 'chih', 'chis', 'coah', 'col', 'cdmx',
  'dgo', 'gro', 'gto', 'hgo', 'jal', 'mex', 'mich', 'mor', 'nay', 'nl', 'oax',
  'pue', 'qro', 'q roo', 'sin', 'slp', 'son', 'tab', 'tamps', 'tlax', 'ver',
  'yuc', 'zac'];

/* Los vecinos, escritos como los escribe Google en español. Se revisan
   PRIMERO: «Vancouver, BC, Canadá» trae una abreviatura que también es la de
   Baja California, y sin esto pasaría. */
const DE_FUERA = /\b(ee\.? ?uu|estados unidos|usa|united states|canada|guatemala|belice|belize|honduras|el salvador|cuba|espana|colombia|argentina)\b/;

/* Los acentos se quitan con la clase escapada, no con los caracteres
   combinantes escritos tal cual: esos son invisibles en el editor y ya se han
   perdido antes al copiar un archivo de un lado a otro. */
function sinAcentos(t) {
  return String(t || '').toLowerCase().normalize('NFD').replace(new RegExp('[\\u0300-\\u036f]', 'g'), '');
}

function esDeMexico(s) {
  const t = sinAcentos(s._completo || (s.principal + ', ' + s.secundario));
  if (DE_FUERA.test(t)) return false;
  if (/\bmexico\b/.test(t)) return true;
  /* «..., Jal.» o «..., N.L.»: son abreviaturas de estado, y esas solo las
     usa Google en direcciones mexicanas.

     Los puntos se quitan ANTES de comparar: Google escribe unas con punto y
     otras sin él —«Jal.» pero «Q Roo», «N.L.» pero «CDMX»— y con los puntos
     dentro, «N.L.» no empataba con `nl` y Monterrey se caía de la lista. */
  const sinPuntos = t.replace(/\./g, '');
  for (let i = 0; i < ESTADOS.length; i++) {
    if (new RegExp('(^|[,\\s])' + ESTADOS[i] + '(\\s|,|$)').test(sinPuntos)) return true;
  }
  return false;
}

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
        languageCode: String(cuerpo.idioma || 'es').slice(0, 5),
        sessionToken: sesion
      };

      const cLat = numeroDe(cuerpo.centroLat), cLng = numeroDe(cuerpo.centroLng);
      const conCerco = Number.isFinite(cLat) && Number.isFinite(cLng) &&
        Math.abs(cLat) <= 90 && Math.abs(cLng) <= 180 && !(cLat === 0 && cLng === 0);

      peticion.includedRegionCodes = [String(cuerpo.pais || 'mx').slice(0, 2)];

      if (conCerco) {
        /* --------------------------------------------------------------
           EL RADIO DEL CERCO TOPA EN 50 KM, Y SE MANDABAN 60

           Google RECHAZA la petición entera cuando el círculo pasa de
           50,000 metros. No la recorta: la rechaza. O sea que el buscador
           de dirección exacta —el que sale después de elegir la ciudad,
           para marcar el hotel o el domicilio del cliente— no devolvía
           NADA. Nunca. El cliente veía una lista vacía y tenía que
           escribir su dirección completa a ciegas.

           Y le pegaba justo a los destinos más vendidos: la tabla de
           `index.html` usaba 60 km para «ciudad», 70 para «playa» y 110
           para «región». Guadalajara, Puerto Vallarta, la CDMX y Mazatlán
           estaban todos rotos; solo funcionaban los aeropuertos (35 km) y
           los pueblos mágicos (45 km).

           No se vio antes porque falla EN SILENCIO: `pideAlProxy` recibe el
           error y solo cierra la lista, que se ve igual que «no hay
           coincidencias».

           Medido contra producción, un radio a la vez:
               49,999 m -> cinco sugerencias
               50,000 m -> cinco sugerencias
               50,001 m -> «Google rechazó la solicitud»

           Se recorta AQUI y no solo en la tabla del navegador porque este
           es el lado que no se puede saltar.
           -------------------------------------------------------------- */
        const radio = Math.min(50000, Math.max(5000, Number(cuerpo.radio) || 45000));
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
          secundario: (f.secondaryText && f.secondaryText.text) || '',
          /* el texto completo, solo para decidir si el lugar es de México */
          _completo: (p.text && p.text.text) || ''
        };
      }).filter(function (s) { return s.id; })
        .filter(esDeMexico)
        .map(function (s) { delete s._completo; return s; });

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
