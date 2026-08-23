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

const tarifa = require('./_tarifa');   // las reglas del dinero viven ahi, no aqui
const rutas  = require('./_rutas');    // y medir kilometros, alla

const PERMITIDOS = [
  'https://eurotravel-web.vercel.app',
  'http://localhost:5175'
];

// La Routes API cuesta más que el autocompletado, así que los topes son más bajos
const LIMITE_POR_VISITANTE = 30;      // llamadas por minuto
const LIMITE_DIARIO = 500;            // llamadas al día por instancia


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

  const origen = rutas.formasDe(cuerpo.origen);
  const destino = rutas.formasDe(cuerpo.destino);
  if (!origen.length || !destino.length) {
    res.status(400).json({ error: 'Falta el origen o el destino' });
    return;
  }

  const redondo = cuerpo.redondo !== false && !!cuerpo.regreso;
  const dias = tarifa.diasDeServicio(cuerpo.salida, cuerpo.regreso);

  try {
    const ida = await rutas.mideTramo(origen, destino, clave);
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
      vuelta = await rutas.mideTramo(destino, origen, clave);
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

    const p = tarifa.calcula(kmTotal, dias);

    /* Se enumera a mano lo que sale, en vez de mandar el objeto completo.
       Los kilometros NO salen: con el total, la tarifa por kilometro se saca
       dividiendo, y el dueño pidio que el cliente nunca la vea. Lo demas
       —tarifa, minimo, calculo sin redondear— se queda en el servidor. */
    res.status(200).json({
      dias: dias,
      redondo: redondo,
      total: p.total,
      ivaIncluido: p.ivaIncluido,
      porcentajeAnticipo: p.porcentajeAnticipo,
      anticipo: p.anticipo,
      saldo: p.saldo
    });
  } catch (e) {
    res.status(502).json({ error: 'No se pudo calcular la distancia' });
  }
};
