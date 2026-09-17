/* ============================================================
   LOS PRECIOS QUE EL VENDEDOR PONE EN KOMMO SE APRENDEN (16-sep-2026)
   ============================================================
   Dictado del dueño: «los precios futuros anótalos». El cron del
   seguimiento lee los leads tocados hace poco; si un lead trae «Venta»
   y su contacto tiene ficha del bot con viaje, ese precio se guarda en el
   almacén como fijado por una persona. Kommo y el almacén aquí son de
   mentiras; lo que se prueba es el cruce y los cuidados.
   ============================================================ */
'use strict';

const path = require('path');
const RAIZ = path.join(__dirname, '..');
process.env.KOMMO_SUBDOMINIO = 'eurotravel';
process.env.KOMMO_TOKEN = 'token-de-mentiras';
delete process.env.KOMMO_CAMPO_PRECIO;
const kommo = require(path.join(RAIZ, 'api', '_kommo.js'));
const aprendidos = require(path.join(RAIZ, 'api', '_precios-aprendidos.js'));
const { aprendeDeKommo } = require(path.join(RAIZ, 'api', '_kommo-aprende.js'));

let buenas = 0, malas = 0;
function ok(que, condicion) {
  if (condicion) { buenas++; console.log('ok   ' + que); }
  else { malas++; console.log('FALLA ' + que); }
}
function titulo(t) { console.log('\n== ' + t.toUpperCase() + ' =='); }

const AHORA = Date.parse('2026-09-17T18:00:00Z');
const respuesta = function (json) { return { ok: true, status: 200, json: async function () { return json; }, text: async function () { return ''; } }; };

/* Kommo de mentiras: dos leads con venta, uno sin, uno de un contacto sin ficha. */
const llamadas = [];
const leads = {
  _embedded: { leads: [
    { id: 26818280, name: 'Prueba', price: 9500, updated_at: 1789660000, pipeline_id: 14471195, _embedded: { contacts: [{ id: 34531020, is_main: true }] } },
    { id: 26818281, name: 'Sin venta', price: 0, updated_at: 1789660000, _embedded: { contacts: [{ id: 1 }] } },
    { id: 26818282, name: 'Ajeno', price: 40000, updated_at: 1789660000, _embedded: { contacts: [{ id: 2 }] } },
    { id: 26818283, name: 'Sin contacto', price: 7000, updated_at: 1789660000, _embedded: { contacts: [] } }
  ] }
};
const contactos = {
  '34531020': { id: 34531020, custom_fields_values: [{ field_code: 'PHONE', values: [{ value: '+52 1 33 1915 3931' }] }] },
  '2': { id: 2, custom_fields_values: [{ field_code: 'PHONE', values: [{ value: '+52 33 0000 0000' }] }] }
};
const pide = async function (url, init) {
  const u = String(url);
  llamadas.push({ url: u, metodo: (init && init.method) || 'GET' });
  if (/\/leads\?/.test(u)) return respuesta(leads);
  const c = u.match(/\/contacts\/(\d+)$/);
  if (c) return contactos[c[1]] ? respuesta(contactos[c[1]]) : { ok: false, status: 404, text: async function () { return 'no'; } };
  throw new Error('la prueba no debía llamar a ' + u);
};

/* Almacén de mentiras: una ficha con viaje para el número de prueba. */
const guardados = [];
let parecidos = [];
const almacen = {
  hayAlmacen: function () { return true; },
  leeFicha: async function (numero) {
    if (numero === '5213319153931') {
      return { cliente: '5213319153931', porConfirmar: { total: 9000, resumen: { origen: 'Guadalajara', destino: 'Chapala', salida: '2026-10-20', regreso: '2026-10-22', gente: 12, unidad: 'sprinter' } } };
    }
    return null;
  },
  preciosParecidos: async function () { return parecidos; },
  guardaPrecio: async function (r) { guardados.push(r); return true; }
};

(async function () {
  titulo('1 · el lead con venta y ficha se anota; los demás no');
  const c = await aprendeDeKommo({ kommo: kommo, almacen: almacen, aprendidos: aprendidos }, { ahora: AHORA, pide: pide });
  ok('se pidieron los leads de las últimas 24 h, con contactos, con el token de la cuenta',
    llamadas[0] && /\/leads\?limit=50&with=contacts&order\[updated_at\]=desc&filter\[updated_at\]\[from\]=\d+$/.test(llamadas[0].url) &&
    Number(llamadas[0].url.match(/from\]=(\d+)/)[1]) === Math.floor((AHORA - 24 * 3600 * 1000) / 1000));
  ok('solo lectura: ninguna llamada a Kommo fue POST/PATCH', llamadas.every(function (l) { return l.metodo === 'GET'; }));
  ok('cuenta: 3 leads con venta, 1 anotado, 1 sin ficha, 1 sin teléfono',
    c.leads === 3 && c.anotados === 1 && c.sinFicha === 1 && c.sinTelefono === 1 && c.fallas === 0);
  const g = guardados[0];
  ok('el renglón guardado es el viaje de la ficha con el precio del lead, fijado y con el calculado',
    g && g.total === 9500 && g.fijado === true && g.destino === 'Chapala' && g.unidad === 'sprinter' && g.dias === 3 &&
    /* El origen entra por ZONA («zmg»), como todos los precios aprendidos. */
    g.calculado === 9000 && g.clave === 'zmg|chapala|sprinter|3' && g.cliente === '3319153931');

  titulo('2 · sin repetir: el cron ve el mismo lead otra vez');
  parecidos = [{ total: 9500, fijado: true, cuando: '2026-09-17T18:01:00Z' }];
  guardados.length = 0;
  const c2 = await aprendeDeKommo({ kommo: kommo, almacen: almacen, aprendidos: aprendidos }, { ahora: AHORA, pide: pide });
  ok('mismo total ya fijado: se cuenta como repetido y no se guarda', c2.repetidos === 1 && c2.anotados === 0 && guardados.length === 0);
  parecidos = [{ total: 9000, fijado: false }, { total: 8800, fijado: true }];
  const c3 = await aprendeDeKommo({ kommo: kommo, almacen: almacen, aprendidos: aprendidos }, { ahora: AHORA, pide: pide });
  ok('un total distinto (corrección) sí se anota', c3.anotados === 1 && guardados.length === 1 && guardados[0].total === 9500);

  titulo('3 · apagado sin Kommo o sin almacén, y nunca truena');
  const sinAlmacen = await aprendeDeKommo({ kommo: kommo, almacen: Object.assign({}, almacen, { hayAlmacen: function () { return false; } }), aprendidos: aprendidos }, { ahora: AHORA, pide: pide });
  ok('sin almacén no lee nada', sinAlmacen.leads === 0);
  const rota = await aprendeDeKommo({ kommo: kommo, almacen: almacen, aprendidos: aprendidos },
    { ahora: AHORA, pide: async function () { throw new Error('kommo caído'); } });
  ok('con Kommo caído contesta con la cuenta en cero, sin excepción', rota && rota.leads === 0);
  const guardaRoto = Object.assign({}, almacen, { guardaPrecio: async function () { return false; } });
  parecidos = [];
  const c4 = await aprendeDeKommo({ kommo: kommo, almacen: guardaRoto, aprendidos: aprendidos }, { ahora: AHORA, pide: pide });
  ok('si el almacén no guarda, se cuenta como falla y sigue', c4.fallas === 1 && c4.anotados === 0);

  titulo('4 · el campo «Precio cotizado» también vale cuando no hay venta');
  process.env.KOMMO_CAMPO_PRECIO = '777';
  leads._embedded.leads[1].custom_fields_values = [{ field_id: 777, values: [{ value: '12000' }] }];
  const lista = await kommo.leadsConVentaReciente(1, { pide: pide });
  ok('el lead sin venta pero con el campo entra con ese total', lista.some(function (l) { return l.id === 26818281 && l.total === 12000; }));
  delete process.env.KOMMO_CAMPO_PRECIO;

  console.log('\n' + buenas + ' buenas, ' + malas + ' malas');
  process.exit(malas ? 1 : 0);
})().catch(function (e) { console.error(e); process.exit(1); });
