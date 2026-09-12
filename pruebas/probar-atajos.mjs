/* ============================================================
   LOS ATAJOS DEL VENDEDOR (11-sep-2026)
   ============================================================
   Dictado del dueño: «igual quiero que tenga más botones que un botón,
   quiero que haya atajos… no sé si hay algo incómodo para poner fotos».

   Lo incómodo eran las fotos: salían solo cuando el CLIENTE las pedía,
   así que el vendedor que quería enseñarlas tenía que buscarlas en la
   galería de su teléfono — ocho carpetas de unidades.

   Se agregan dos atajos:

     fotos            las de la unidad del viaje que ya trae la ficha
     fotos i6s        o las de la que él diga
     atajos           la lista de todo, porque un atajo que nadie sabe
                      que existe no sirve de nada

   Y lo que esta batería cuida por encima de todo: que un atajo NUNCA
   escoja por él cuando lo que escribió le queda a dos unidades. Con dos
   Irizar i6 en el catálogo, «fotos i6» es ambiguo de verdad — y mandarle
   al cliente la foto del camión equivocado es peor que no mandarle nada.
   ============================================================ */
import crypto from 'crypto';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.join(AQUI, '..');

const SECRETO = 'secreto-de-prueba';
process.env.WHATSAPP_APP_SECRET = SECRETO;
process.env.WHATSAPP_TOKEN = 'tok';
process.env.WHATSAPP_PHONE_ID = '111';
process.env.DUENO_WHATSAPP = '5213311112222';
process.env.SITIO_URL = 'https://eurotravel-web.vercel.app';
process.env.ANTHROPIC_API_KEY = '';
process.env.AGENTE_IA = '0';
process.env.CONFIRMAR_PRECIOS = '1';
process.env.BOT_HASTA_COTIZACION = '1';
delete process.env.ALMACEN_URL; delete process.env.ALMACEN_CLAVE;

let buenas = 0, malas = 0;
function ok(que, condicion) {
  if (condicion) { buenas++; console.log('ok   ' + que); }
  else { malas++; console.log('FALLA ' + que); }
}
function titulo(t) { console.log('\n== ' + t.toUpperCase() + ' =='); }

let mandados = [];
globalThis.fetch = async function (url, opciones) {
  const c = opciones && opciones.body ? JSON.parse(opciones.body) : {};
  if (String(url).indexOf('graph.facebook.com') !== -1) {
    mandados.push(c);
    return { ok: true, status: 200, json: async () => ({ messages: [{ id: 'w' + mandados.length }] }), text: async () => '{}' };
  }
  return { ok: false, status: 500, json: async () => ({}), text: async () => '' };
};

const atiende = (await import(pathToFileURL(path.join(RAIZ, 'api', 'whatsapp.mjs')).href)).default;
const tk = (await import(pathToFileURL(path.join(RAIZ, 'api', '_tickets.js')).href)).default;

const DUENO = '5213311112222';
const C = '5213366677777';
let n = 0;
const firma = (c) => 'sha256=' + crypto.createHmac('sha256', SECRETO).update(c).digest('hex');
const mismo = (a, b) => String(a || '').replace(/\D/g, '').slice(-10) === String(b || '').replace(/\D/g, '').slice(-10);

async function escribe(texto) {
  n++;
  mandados = [];
  const c = JSON.stringify({ entry: [{ changes: [{ value: { metadata: { phone_number_id: '111' },
    messages: [{ id: 'wamid.at' + n, from: DUENO, type: 'text', text: { body: texto } }] } }] }] });
  await atiende(new Request('https://x/api/whatsapp', { method: 'POST', body: c, headers: { 'x-hub-signature-256': firma(c) } }));
  return {
    alCliente: mandados.filter((m) => mismo(m.to, C)),
    aMi: mandados.filter((m) => mismo(m.to, DUENO)).map((m) => (m.text && m.text.body) || '')
  };
}
const textoDe = (ms) => ms.map((m) => (m.text && m.text.body) || '').join('\n');
const fotosDe = (ms) => ms.filter((m) => m.image && m.image.link).map((m) => m.image.link);

/* Un cliente con su viaje ya armado y un Irizar i6S escogido. */
tk.anotaEtapa(C, 'con_precio', { total: 19000, anticipo: 4000,
  viajeDatos: { origen: 'Guadalajara', destino: 'Puerto Vallarta', salida: '2026-11-20',
    regreso: '2026-11-22', gente: 45, unidad: 'Irizar i6S', unidadNombre: 'Irizar i6S' } }, Date.now());

titulo('«atajos» le enseña todo lo que puede escribir');
{
  const r = await escribe('atajos');
  const lista = r.aMi.join('\n');
  ok('le llega la lista', /Lo que puedes escribirme/.test(lista));
  for (const atajo of ['cuenta', 'contrato', 'recibido', 'fotos', 'total', 'yo', 'bot', 'pendientes', 'ver']) {
    ok('  menciona *' + atajo + '*', new RegExp('\\*' + atajo).test(lista));
  }
  ok('  y no le llega nada al cliente', r.alCliente.length === 0);
  /* La lista pasa el filtro de salida al dueño. Sin esto se quedaba
     callada: la marca `[atajos]` no estaba en la lista blanca y el
     mensaje moría en silencio — cazado al probarlo. */
  ok('  o sea que la lista blanca la deja pasar', r.aMi.length === 1);
}

titulo('«fotos» usa la unidad del viaje que ya tiene');
{
  const r = await escribe('3366677777 fotos');
  ok('le manda la del i6S, que es la de su viaje', /Irizar i6S/.test(textoDe(r.alCliente)));
  ok('  con la foto de verdad', fotosDe(r.alCliente).some((f) => /irizar-i6s/.test(f)));
  ok('  UNA sola foto, que tres seguidas es spam', fotosDe(r.alCliente).length === 1);
  ok('  y por URL pública del sitio', fotosDe(r.alCliente).every((f) => /^https:\/\//.test(f)));
  ok('  y a mí me acusa recibo', /Le mandé fotos/.test(r.aMi.join('\n')));
}

titulo('«fotos <unidad>» manda la que él diga');
{
  const r = await escribe('3366677777 fotos marcopolo');
  ok('«marcopolo» manda el G8', /Marcopolo Paradiso G8/.test(textoDe(r.alCliente)));
  ok('  con su foto', fotosDe(r.alCliente).some((f) => /\/g8\//.test(f)));

  const s = await escribe('3366677777 fotos sprinter');
  ok('«sprinter» manda la Sprinter', /Sprinter/.test(textoDe(s.alCliente)));
}

titulo('lo que le queda a DOS no se adivina: se pregunta');
{
  /* Hay dos Irizar i6 —el de 47 y el de 51— así que «fotos i6» no dice
     cuál. Mandar la del camión equivocado es peor que no mandar nada. */
  const r = await escribe('3366677777 fotos i6');
  ok('no le manda nada al cliente', r.alCliente.length === 0);
  const p = r.aMi.join('\n');
  ok('  me pregunta cuál de las dos', /Cu[áa]l de las dos/.test(p));
  ok('  nombrando las dos con sus asientos',
    /fotos Irizar i6\* — 47 pasajeros/.test(p) && /fotos Irizar i6 51\* — 51 pasajeros/.test(p));

  /* Y con el nombre completo sí sale. */
  const s = await escribe('3366677777 fotos i6 51');
  ok('«fotos i6 51» sí manda', s.alCliente.length > 0);
  ok('  y avisa que las fotos son prestadas', /no tengo fotos/i.test(textoDe(s.alCliente)));
  ok('  nombrando de quién son', /otro \*Irizar i6\*/.test(textoDe(s.alCliente)));
  ok('  y a mí me lo dice también', /prestadas/.test(s.aMi.join('\n')));
}

titulo('los casos en que no se puede, se dicen');
{
  const r = await escribe('3366677777 fotos nave espacial');
  ok('una unidad que no existe: no manda nada', r.alCliente.length === 0);
  ok('  y me da la lista de las que sí', /Prueba con/.test(r.aMi.join('\n')));

  const s = await escribe('fotos');
  ok('sin decir de qué cliente: no manda nada', s.alCliente.length === 0);
  ok('  y me pregunta a quién', /A qui[eé]n le mando/.test(s.aMi.join('\n')));
}

titulo('los atajos de siempre siguen funcionando');
{
  const r = await escribe('3366677777 cuenta');
  ok('«cuenta» sigue mandando la CLABE', /012320001927217407|anticipo/i.test(textoDe(r.alCliente)) || r.alCliente.length > 0);

  const s = await escribe('3366677777 contrato');
  ok('«contrato» sigue pidiendo los datos', s.alCliente.length > 0);

  const t = await escribe('3366677777 recibido');
  ok('«recibido» sigue confirmando el pago', /confirmado/i.test(textoDe(t.alCliente)));
}

console.log('\n' + buenas + ' buenas, ' + malas + ' malas');
process.exit(malas ? 1 : 0);
