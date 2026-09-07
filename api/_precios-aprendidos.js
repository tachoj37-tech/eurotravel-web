/* ------------------------------------------------------------
   LOS PRECIOS QUE EL DUEÑO YA DIO, PARA PROPONERLOS LA PRÓXIMA VEZ
   ------------------------------------------------------------
   Dictado del dueño (5-sep-2026): «yo te pongo el precio y te
   aprendes el viaje; si alguien va a hacer el mismo viaje me vas a
   recomendar ese precio; irás generando un criterio de los precios
   que te vaya diciendo».

   Aquí solo se decide QUÉ es «el mismo viaje» y CÓMO se le enseña
   al dueño lo que ya dio. Guardar y leer vive en `_almacen.js`; el
   criterio, cuando haya suficientes, se resume a mano en
   docs/CRITERIO-DE-PRECIOS.md (el dueño manda; esto solo recuerda).

   «El mismo viaje» = mismo origen, mismo destino, misma unidad y
   mismos días de servicio. Los pasajeros y la fecha se guardan
   —importan para leerlo— pero no separan viajes: doce o catorce
   personas en la misma Sprinter a Chapala son el mismo viaje.
   ------------------------------------------------------------ */
'use strict';

function limpia(texto) {
  return String(texto || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function diasEntre(a, b) {
  const x = Date.parse(String(a || '') + 'T12:00:00Z');
  const y = Date.parse(String(b || a || '') + 'T12:00:00Z');
  if (!Number.isFinite(x) || !Number.isFinite(y)) return 1;
  return Math.max(1, Math.round((y - x) / 86400000) + 1);
}

/* La llave del viaje. `unidad` es como se vende («Sprinter», «Irizar i6»). */
function claveDe(resumen, unidad) {
  const r = resumen || {};
  const u = limpia(unidad || r.unidad || '');
  const clave = [limpia(r.origen), limpia(r.destino), u || 'sin unidad', String(diasEntre(r.salida, r.regreso))].join('|');
  /* Un precio neto de agencia (5 % abajo) no se le sugiere a un
     particular ni al revés (auditoría 7-sep-2026, C11). El particular
     conserva la clave de siempre. */
  return r.agencia ? clave + '|agencia' : clave;
}

/* Lo que se guarda cuando el dueño confirma. */
function renglonDe(resumen, unidad, precio, extra) {
  const r = resumen || {};
  const e = extra || {};
  return {
    clave: claveDe(r, unidad),
    origen: String(r.origen || '').slice(0, 120),
    destino: String(r.destino || '').slice(0, 120),
    unidad: String(unidad || r.unidad || '').slice(0, 60),
    dias: diasEntre(r.salida, r.regreso),
    pasajeros: Number(r.gente || r.pasajeros) || null,
    total: Math.round(Number(precio && precio.total) || 0),
    anticipo: Math.round(Number(precio && precio.anticipo) || 0),
    fijado: !!e.fijado,
    cliente: e.cliente ? String(e.cliente).slice(-10) : null,
    salida: r.salida || null
  };
}

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
function fechaCorta(iso) {
  const m = String(iso || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return '';
  return Number(m[3]) + ' ' + MESES[Number(m[2]) - 1];
}
function pesos(n) { return '$' + Math.round(Number(n) || 0).toLocaleString('es-MX'); }

/* Las líneas del ticket: qué dio antes, y qué se le sugiere (lo más
   reciente que él mismo fijó; si nunca fijó, lo más reciente que
   confirmó). Vacío si no hay historial: no se inventa. */
function lineasDeHistorial(lista) {
  const l = (lista || []).filter(function (p) { return p && p.total > 0; });
  if (!l.length) return [];
  const partes = l.slice(0, 3).map(function (p) {
    return pesos(p.total) +
      ((p.salida || p.pasajeros)
        ? ' (' + [fechaCorta(p.salida), p.pasajeros ? p.pasajeros + ' pax' : ''].filter(Boolean).join(' · ') + ')'
        : '') +
      (p.fijado ? ' ✍️' : '');
  });
  const fijados = l.filter(function (p) { return p.fijado; });
  const sugerido = (fijados[0] || l[0]).total;
  return [
    'Antes lo diste a: ' + partes.join(' · '),
    'Sugerido: *' + pesos(sugerido) + '*'
  ];
}

module.exports = { claveDe, renglonDe, lineasDeHistorial, limpia, diasEntre };
