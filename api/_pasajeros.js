/* ============================================================
   Cuántos van, y si caben — del lado del servidor (15-sep-2026)
   ------------------------------------------------------------
   El cotizador no preguntaba pasajeros y el webhook mandaba `1` a
   EuroSystem en todos los contratos. Ahora la pantalla los pide,
   pero la pantalla no es la puerta: `/api/pagar` los vuelve a
   revisar aquí contra la capacidad de la unidad antes de abrir un
   cobro.

   LA CAPACIDAD SALE DE `unidades.js`, la fuente única del sitio, con
   la misma maña que ya usa `bot.js`: es un archivo de navegador
   (`window.UNIDADES = [...]`), así que se le presta un `window`
   antes de pedirlo. Una copia de las capacidades aquí se
   desactualizaría el día que se dé de alta una unidad.

   Empieza con guion bajo: Vercel NO lo publica como función (tope
   de doce).
   ============================================================ */

global.window = global.window || {};
require('../unidades');
const UNIDADES = global.window.UNIDADES || [];

/* El tope de la puerta de EuroSystem (CONTRATOS-API.md §2: `pasajeros`
   entero 1–90). Ninguna unidad del catálogo llega ahí. */
const TOPE_EUROSYSTEM = 90;

function normaliza(t) {
  return String(t || '')
    .split('·')[0]
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(new RegExp('[\\u0300-\\u036f]', 'g'), '');
}

/* Lo que manda el navegador es el NOMBRE de pantalla —«Sprinter»,
   «Irizar i6S · 51 pasajeros»—. Devuelve la capacidad, o 0 si la unidad
   no está en el catálogo. */
function capacidadDe(nombreUnidad) {
  const buscado = normaliza(nombreUnidad);
  if (!buscado) return 0;
  for (let i = 0; i < UNIDADES.length; i++) {
    const u = UNIDADES[i] || {};
    if (normaliza(u.name) === buscado || normaliza(u.id) === buscado) {
      return Math.max(0, Math.floor(Number(u.max) || 0));
    }
  }
  return 0;
}

/* Un entero de verdad: «12» sí; «3.5», «muchos», «12 personas» no. */
function entero(v) {
  if (typeof v === 'number') return Number.isInteger(v) ? v : NaN;
  const t = String(v == null ? '' : v).trim();
  return /^\d{1,4}$/.test(t) ? Number(t) : NaN;
}

/* `{ ok: true, pasajeros }` o `{ ok: false, error, aviso }`. Los pasajeros
   son OBLIGATORIOS: sin ellos no se aparta. Si la unidad no está en el
   catálogo se usa el tope de EuroSystem; quien llama ya rechaza por su
   cuenta las unidades que no se cobran en línea. */
function revisa(valor, nombreUnidad) {
  const cap = capacidadDe(nombreUnidad) || TOPE_EUROSYSTEM;
  const n = entero(valor);
  if (!isFinite(n) || n < 1) {
    return { ok: false, error: 'sin pasajeros', aviso: 'Dinos cuántos pasajeros van.' };
  }
  if (n > cap) {
    return {
      ok: false, error: 'no caben',
      aviso: 'En esta unidad caben hasta ' + cap + ' pasajeros. Si van más, escríbenos y te armamos el viaje.'
    };
  }
  return { ok: true, pasajeros: n };
}

module.exports = { capacidadDe, revisa, TOPE_EUROSYSTEM };
