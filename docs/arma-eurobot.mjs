// Arma el archivo de importación de Kommo (bloques visuales estándar:
// Mensaje, Pausa, Parar) para el Salesbot «EuroBot». Sale con `positions`,
// así que Kommo lo pinta como bloques editables, no como código.
import fs from 'node:fs';
import { randomUUID } from 'node:crypto';

const FOTOS = JSON.parse(fs.readFileSync(
  'C:/Users/tacho/OneDrive/Documentos/EUROAPP/eurotravel-web/docs/kommo-fotos.json', 'utf8'));
const f = (carpeta, n) => FOTOS[carpeta][`${carpeta}-${String(n).padStart(2, '0')}.jpg`];

// Evento de la Pausa «mensaje recibido» (se confirma contra el editor).
// Canal por el que sale TODO: solo el WhatsApp de pruebas (fuente 60452). Nunca el real.
const CANAL_PRUEBAS = Number(process.env.CANAL_PRUEBAS || 60452);
const EVENTO_MENSAJE = JSON.parse(process.env.EVENTO_MENSAJE || '{"source":"message","action":"received"}');

// ---------- definición del flujo ----------
// Cada bloque: { id, tipo, col, fila, texto?, foto?, botones?: [[texto, id]], sig?, sino? }
const B = [];
const msg = (id, col, fila, texto, extra = {}) => B.push({ id, tipo: 'msg', col, fila, texto, ...extra });
const pausa = (id, col, fila, sig) => B.push({ id, tipo: 'pausa', col, fila, sig });
const parar = (id, col, fila) => B.push({ id, tipo: 'parar', col, fila });

// Saludo
msg(1, 0, 0,
  '¡Qué tal! Estás con *Eurotravel* 🚐\nCamionetas y autobuses con chofer para tu grupo.\n\n¿Qué necesitas?\nSi ya cotizaste, quieres abonar o tienes otra duda, pícale al segundo botón.',
  { botones: [['Nueva cotización', 2], ['Hablar con un agente', 90]], sino: 2 });

// Destino
msg(2, 1, 0, 'Con gusto 🚐 ¿A dónde van?', { sig: 3 });
pausa(3, 2, 0, 4);
// Fechas
msg(4, 3, 0, 'Va 📍 ¿Qué día salen y qué día regresan?\n\nEscríbelo como quieras: *15 al 20 de octubre*, *el sábado y el domingo*, *ida y vuelta el 25*.', { sig: 5 });
pausa(5, 4, 0, 6);
// Unidad
msg(6, 5, 0, '¿En qué los llevamos?', { botones: [['Autobús', 10], ['Sprinter', 20], ['Somos varios', 25]], sino: 25 });

// Sprinter
msg(20, 6, 6, 'Va, la *Sprinter* — hasta 20 pasajeros 📸', { foto: f('sprinter', 1), sig: 21 });
msg(21, 7, 6, '', { foto: f('sprinter', 3), sig: 30 });

// Somos varios
msg(25, 6, 8, '¿Cuántos van, más o menos?', { sig: 26 });
pausa(26, 7, 8, 27);
msg(27, 8, 8, 'Perfecto 🙌 Hasta 20 personas va la *Sprinter*; de 36 en adelante, un *autobús*. Con tu número te recomiendo la unidad junto con el precio.\n\n¿Quieres ver fotos de los autobuses?', { botones: [['Ver autobuses', 10], ['Seguir sin ver', 30]], sino: 30 });

// Páginas de autobuses (3 botones máximo por mensaje en WhatsApp)
msg(10, 6, 1, 'Estos son los autobuses 🚌\n\n· *Irizar i6S* — 51 pasajeros\n· *Marcopolo Paradiso G8* — 51 pasajeros\n\nPícale a uno y te mando sus fotos.',
  { botones: [['Irizar i6S', 100], ['Marcopolo G8', 110], ['Ver más', 11]], sino: 11 });
msg(11, 6, 2, '· *Irizar i6 51* — 51 pasajeros\n· *Neobus* — 50 pasajeros',
  { botones: [['Irizar i6 51', 120], ['Neobus', 130], ['Ver más', 12]], sino: 12 });
msg(12, 6, 3, '· *Irizar Century 49* — 49 pasajeros\n· *Irizar i6* — 47 pasajeros',
  { botones: [['Irizar Century 49', 140], ['Irizar i6', 150], ['Ver más', 13]], sino: 13 });
msg(13, 6, 4, '· *Irizar PB* — 47 pasajeros\n· *Irizar Century* — 47 pasajeros',
  { botones: [['Irizar PB', 160], ['Irizar Century', 170], ['Ver los primeros', 10]], sino: 10 });

// Fotos por unidad: 3 fotos (exterior, interior, detalle) y botones
const UNIDADES = [
  [100, 'Irizar i6S', 51, 'irizar-i6s', [1, 3, 4], ''],
  [110, 'Marcopolo Paradiso G8', 51, 'g8', [1, 2, 3], ''],
  [120, 'Irizar i6 51', 51, 'irizar-i6', [1, 3, 4], '\n\nLas fotos son del i6 de 47: es el mismo camión, con cuatro asientos más. Del de 51 todavía no tengo fotos propias.'],
  [130, 'Neobus', 50, 'neobus', [1, 3, 4], ''],
  [140, 'Irizar Century 49', 49, 'irizar', [1, 3, 4], '\n\nLas fotos son del Century de 47: es el mismo camión, con dos asientos más. Del de 49 todavía no tengo fotos propias.'],
  [150, 'Irizar i6', 47, 'irizar-i6', [1, 3, 4], ''],
  [160, 'Irizar PB', 47, 'irizar-pb', [1, 3, 4], ''],
  [170, 'Irizar Century', 47, 'irizar', [1, 3, 4], ''],
];
UNIDADES.forEach(([id, nombre, pax, carpeta, fotos, nota], i) => {
  const fila = 10 + i * 2;
  msg(id, 7, fila, `Éste es el *${nombre}* — ${pax} pasajeros 📸${nota}`, { foto: f(carpeta, fotos[0]), sig: id + 1 });
  msg(id + 1, 8, fila, '', { foto: f(carpeta, fotos[1]), sig: id + 2 });
  msg(id + 2, 9, fila, '¿Te late éste o quieres ver otro?', { foto: f(carpeta, fotos[2]), botones: [['Éste me late', 30], ['Ver otro', 10]], sino: 30 });
});

// Origen
msg(30, 10, 0, '¿De dónde salen?', { botones: [['Guadalajara y ZMG', 40], ['Otra ciudad', 31]], sino: 31 });
msg(31, 11, 1, '¿De qué ciudad salen?', { sig: 32 });
pausa(32, 12, 1, 40);
// Movimientos
msg(40, 13, 0, 'Allá, ¿se van a mover con la unidad o solo los llevamos y los traemos?',
  { botones: [['Solo llevar y traer', 50], ['1 día', 50], ['2 días o más', 50]], sino: 50 });
// Ticket
msg(50, 14, 0, 'Perfecto, ya tengo todo tu viaje 📋 destino, fechas, unidad, de dónde salen y los movimientos allá.\n\nEn un momento te paso tu precio y la disponibilidad 🙌\n\n¿Todo bien? Si algo está mal, dímelo y lo corregimos.', { sig: 51 });
parar(51, 15, 0);
// Hablar con un agente
msg(90, 1, 2, 'Va 🙌 Ahorita te contesta una persona por aquí mismo.', { sig: 91 });
parar(91, 2, 2);

// ---------- armado ----------
const porId = new Map(B.map(b => [b.id, b]));
for (const b of B) for (const ref of [b.sig, b.sino, ...(b.botones || []).map(x => x[1])]) {
  if (ref != null && !porId.has(ref)) throw new Error(`bloque ${b.id} apunta a ${ref} que no existe`);
}
for (const b of B) if (b.tipo === 'msg' && b.botones) {
  if (b.botones.length > 3) throw new Error(`bloque ${b.id}: más de 3 botones`);
  for (const [t] of b.botones) if (t.length > 20) throw new Error(`bloque ${b.id}: botón «${t}» pasa de 20`);
}

// step = índice consecutivo en el orden de B; id de posición = id del flujo
const step = new Map(B.map((b, i) => [b.id, i]));
const recipient = { type: 'all_contacts', way_of_communication: 'over_all' };
const sm = (b, primero) => {
  const p = { tag: '', text: b.texto, type: 'external', on_error: null, recipient,
    is_in_starting_block: primero, send_to_all_chat_sources: false, channels: [{ id: CANAL_PRUEBAS }], chat_sources: [{ id: CANAL_PRUEBAS }] };
  if (b.botones) p.buttons = b.botones.map(([t]) => ({ text: t, type: 'inline' }));
  if (b.foto) p.attachments = [{ type: 'picture', value: b.foto, is_external: true }];
  return p;
};
const goto = id => ({ params: { step: step.get(id), type: 'question' }, handler: 'goto' });

const text = {};
const positions = [
  { x: 0, y: 0, z: 1, id: 0, goto: { block: 1 }, step: -1, type: 'start', width: 170, height: 38,
    actions: [{ id: -3, sort: 0, links: [], params: { params: [], handler: '_start' } }], deletable: true },
  { x: -350, y: 0, z: 2, id: -1, code: 'trigger', step: -1, type: 'static', width: 260, height: 0, actions: [], deletable: true },
];
let z = 3, accion = 100;
const X = col => 215 + col * 470, Y = fila => 65 + fila * 330;

for (const b of B) {
  const s = step.get(b.id);
  const uuid = randomUUID();
  const primero = b.id === 1;
  if (b.tipo === 'msg') {
    const q = [{ params: sm(b, primero), handler: 'send_message' }];
    const entrada = { question: q, block_uuid: uuid };
    if (b.botones) {
      entrada.answer = [{ params: [
        ...b.botones.map(([t, id]) => ({ value: t, params: [goto(id)], synonyms: [] })),
        { type: 'else', params: [goto(b.sino)] },
      ], handler: 'buttons' }];
    } else {
      q.push(goto(b.sig));
    }
    text[s] = entrada;
    const alto = 150 + (b.texto.split('\n').length - 1) * 18 + (b.botones ? 30 * b.botones.length + 60 : 0) + (b.foto ? 120 : 0);
    const pos = { x: X(b.col), y: Y(b.fila), z: z++, id: b.id, goto: { block: b.botones ? b.sino : b.sig },
      name: 'Mensaje', step: s, type: 'question', width: 400, height: alto,
      actions: [{ id: accion++, sort: 0,
        links: (b.botones || []).map(([t, id]) => ({ data: { regex: `/${t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}/iu` }, block: id })),
        params: { params: sm(b, primero), handler: 'send_message' },
        ...(b.botones ? { synonyms: b.botones.map(() => []) } : {}) }],
      on_error: null, deletable: true, block_uuid: uuid };
    positions.push(pos);
  } else if (b.tipo === 'pausa') {
    text[s] = { question: [{ params: { logic: 'or', conditions: [{ event: EVENTO_MENSAJE, action: { step: step.get(b.sig), type: 'question' } }] }, handler: 'waits' }], block_uuid: uuid };
    positions.push({ x: X(b.col), y: Y(b.fila), z: z++, id: b.id, name: 'Pausa', step: s, type: 'question', width: 400, height: 81,
      actions: [{ id: accion++, sort: 0, links: [{ block: b.sig }], params: { params: { event: EVENTO_MENSAJE }, handler: 'wait' } }],
      deletable: true, block_uuid: uuid });
  } else if (b.tipo === 'parar') {
    text[s] = { question: [{ params: [], handler: 'stop' }], block_uuid: uuid };
    positions.push({ x: X(b.col), y: Y(b.fila), z: z++, id: b.id, step: s, type: 'finish', width: 374, height: 63,
      actions: [{ id: accion++, sort: 0, links: [], params: { params: [], handler: '_stop' } }], deletable: true });
  }
}
// El flujo de un «finish» en los bots exportados: goto {type:'finish', step}. Ajusto los goto que apuntan a un Parar.
for (const s of Object.keys(text)) {
  const fix = g => { if (g && g.handler === 'goto') { const b = B[g.params.step]; if (b.tipo === 'parar') g.params.type = 'finish'; } };
  for (const q of text[s].question || []) fix(q);
  for (const a of text[s].answer || []) for (const p of a.params) for (const g of p.params) fix(g);
}
text.conversation = false;

const salida = { type_functionality: 0, model: { text: JSON.stringify(text), name: 'EuroBot', positions: JSON.stringify(positions), type: 2 } };
const destino = process.argv[2] || 'C:/Users/tacho/AppData/Local/Temp/claude/C--Users-tacho-OneDrive-Documentos-EUROAPP/bf9e1c43-9e24-48c2-ae00-6fcd1916a2b1/scratchpad/EuroBot.json';
fs.writeFileSync(destino, JSON.stringify(salida));
console.log('bloques:', B.length, '→', destino);
