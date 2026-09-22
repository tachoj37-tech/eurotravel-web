/* ============================================================
   EL SALESBOT «EuroBot v2» DE KOMMO, PARA IMPORTAR (17-sep-2026)
   ============================================================
   Spec: docs/ESPEC-UN-NUMERO-CUATRO-FUNCIONES.md §2, §3, §4.
   Produce el archivo que Kommo importa en Ajustes → Herramientas de
   comunicación → «Crear o importar un nuevo bot» (input oculto
   `.js-import-bot-input`). Formato copiado de un bot exportado (16-sep):
   `{type_functionality:0, model:{text, name, positions, type:2}}`.

   El flujo:

     inicio → [PUERTA widget …/kommo-puerta]
                ├ saludo ─────→ [Saludo: 3 botones]
                │                 ├ Nueva cotización → [puente] → (pausa) → [CEREBRO widget …/kommo]
                │                 │       success → [{{json.texto}}] → (pausa) ↺
                │                 │       fail    → [{{json.texto}}] → parar
                │                 │       silencio→ parar
                │                 ├ Mi cotización anterior → [¿misma fecha o nueva?: 2 botones]
                │                 │       Misma fecha → [agente se comunica] → parar
                │                 │       Fecha nueva → [¿para qué fecha?] → (pausa) → [anotado, agente] → parar
                │                 └ Hablar con un agente → [ahorita te contesta una persona] → parar
                ├ comprobante → [{{json.texto}}] → parar
                ├ espera ─────→ [{{json.texto}}] → (pausa) → PUERTA otra vez
                └ denada ─────→ [{{json.texto}}] → parar

   Los dos bloques de widget usan el MISMO widget (EuroBot, id 1282319,
   código «eurobot», 1.0.8) con distinta URL. Después de importar hay que
   registrar el `widget_source` de cada bloque (ver docs/ARRANQUE §10,
   punto 18) con los `widget_instance_id` que imprime este script.

   Se corre: node scripts/arma-bot-kommo-v2.mjs pendiente/kommo-bot/EuroBot-v2.json
   ============================================================ */
import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import TEXTOS from '../api/_textos-fijos.js';

const SITIO = 'https://eurotravel-web.vercel.app';
/* LISTA=1 → «EuroBot v3» con cuatro opciones; sin ella, el v2 de siempre. */
const LISTA = process.env.LISTA === '1';
/* Los canales por los que el bot PUEDE escribir. En pruebas, solo el de
   pruebas; al lanzar (18-sep-2026) se agrega el número real. Si un bloque
   no lleva la lista, Kommo manda por cualquier canal: ese fue el hueco por
   el que el bot le escribió a una clienta real. */
const CANALES = String(process.env.CANALES || process.env.CANAL_PRUEBAS || 60452)
  .split(',').map(function (x) { return Number(String(x).trim()); }).filter(Boolean);
const CANAL_PRUEBAS = CANALES[0];
const WIDGET_ID = '1282319';
const WIDGET_CODE = 'eurobot';
const EVENTO_MENSAJE = { action: 'received', source: 'message' };

/* ---- los bloques, con id fijo (id de posición) ---- */
const B = [];
const msg = (id, col, fila, texto, extra = {}) => B.push({ id, tipo: 'msg', col, fila, texto, ...extra });
const pausa = (id, col, fila, sig) => B.push({ id, tipo: 'pausa', col, fila, sig });
const parar = (id, col, fila) => B.push({ id, tipo: 'parar', col, fila });
const widget = (id, col, fila, nombre, url, salidas) => B.push({ id, tipo: 'widget', col, fila, nombre, url, salidas, uuidWidget: randomUUID() });

/* Columna 0: la puerta. */
widget(1, 0, 1, 'Puerta (decide antes del saludo)', SITIO + '/api/whatsapp/kommo-puerta', {
  saludo: 10, comprobante: 20, espera: 30, denada: 40,
  /* Si el servidor no contestó (fail/silencio) o algo raro: al saludo. */
  success: 10, fail: 10,
  /* silencio = la puerta dijo «callado» (anuncio de pago, 18-sep-2026):
     el bot se apaga sin decir nada. Antes iba al saludo y lo repetía. */
  silencio: LISTA ? 90 : 10
});
if (LISTA) parar(90, 1, 9);

/* Columna 1: las cuatro salidas de la puerta. */
msg(10, 1, 0, LISTA ? TEXTOS.saludoConAgente : TEXTOS.saludo, {
  /* «Mi cotización anterior» pasa del tope de 20 letras de WhatsApp. */
  /* v3 (17-sep-2026, decisión final del dueño): Kommo no manda listas y con
     4 botones duplica el saludo (3 + 1). Quedan 3 botones —Nueva
     cotización · Cotización anterior · Abonar contrato— y «agente» por
     texto (respuesta oculta, sin botón) en el mismo mensaje. */
  botones: LISTA
    ? [['Nueva cotización', 50], ['Cotización anterior', 60], ['Abonar contrato', 80]]
    : [['Nueva cotización', 50], ['Cotización anterior', 60], ['Hablar con un agente', 70]],
  /* Respuestas por texto que no se pintan como botón: [valor, bloque, sinónimos]. */
  ocultos: LISTA ? [['agente', 70, ['persona', 'humano', 'asesor', 'alguien', 'hablar con un agente']]] : [],
  /* Escribió otra cosa. En v3 va DIRECTO al cerebro con ese texto: el
     servidor decide («agente» → persona y se apaga; lo demás, cotización).
     Kommo no casaba «agente» con la respuesta oculta (18-sep-2026: fue a
     cotizar). En v2 se tomaba como cotización nueva. */
  sino: LISTA ? 52 : 50
});
msg(20, 1, 2, '{{json.texto}}', { sig: 21 }); parar(21, 2, 2);
msg(30, 1, 3, '{{json.texto}}', { sig: 31 }); pausa(31, 2, 3, 1);
msg(40, 1, 4, '{{json.texto}}', { sig: 41 }); parar(41, 2, 4);

/* Columna 2–4: cotización nueva (el cerebro de siempre). */
msg(50, 2, 0, 'Va 🚐 Cuéntame: ¿a dónde van, para cuándo y cuántas personas?', { sig: 51 });
pausa(51, 3, 0, 52);
widget(52, 4, 0, 'EuroBot (cerebro)', SITIO + '/api/whatsapp/kommo', { success: 53, fail: 55, silencio: 57 });
msg(53, 5, 0, '{{json.texto}}', { sig: 51 });
msg(55, 5, 1, '{{json.texto}}', { sig: 56 }); parar(56, 6, 1);
parar(57, 5, 2);

/* Columna 2–4: mi cotización anterior (sin IA). */
msg(60, 2, 5, TEXTOS.cotizacionAnterior, { botones: [['Misma fecha', 61], ['Fecha nueva', 63]], sino: 65 });
msg(61, 3, 5, TEXTOS.mismaFecha, { sig: 62 }); parar(62, 4, 5);
msg(63, 3, 6, TEXTOS.fechaNuevaPregunta, { sig: 64 }); pausa(64, 4, 6, 65);
msg(65, 5, 6, TEXTOS.fechaNuevaAnotado, { sig: 66 }); parar(66, 6, 6);

/* Hablar con un agente. */
msg(70, 2, 7, TEXTOS.agente, { sig: 71 }); parar(71, 3, 7);
/* Abonar contrato (v3): 100 % persona. */
if (LISTA) { msg(80, 2, 8, TEXTOS.abonar, { sig: 81 }); parar(81, 3, 8); }

/* ---- comprobaciones ---- */
const porId = new Map(B.map(b => [b.id, b]));
for (const b of B) {
  const refs = [b.sig, b.sino, ...(b.botones || []).map(x => x[1]), ...Object.values(b.salidas || {})];
  for (const ref of refs) if (ref != null && !porId.has(ref)) throw new Error(`bloque ${b.id} apunta a ${ref} que no existe`);
}
for (const b of B) if (b.tipo === 'msg' && b.botones) {
  if (b.botones.length > (LISTA ? 10 : 3)) throw new Error(`bloque ${b.id}: demasiados botones`);
  for (const [t] of b.botones) if (t.length > 20) throw new Error(`bloque ${b.id}: botón «${t}» pasa de 20`);
}

/* ---- text (pasos) y positions (bloques) ---- */
const step = new Map(B.map((b, i) => [b.id, i]));
const recipient = { type: 'all_contacts', way_of_communication: 'over_all' };
/* 22-sep-2026: con la lista explícita de canales Kommo NO entregaba por
   Facebook (el filtro por id no reconoce la fuente de Messenger); con
   `send_to_all_chat_sources:true` sí («Entregado», lead 26921946). Desde
   hoy los bloques van en `true` y el candado de por dónde escribe el bot
   es el DISPARADOR (solo los canales que el dueño pidió). Con
   `SOLO_CANALES_LISTADOS=1` se genera como antes (false + lista), para
   pruebas en un solo canal. */
const TODOS_LOS_CANALES = process.env.SOLO_CANALES_LISTADOS !== '1';
const sm = (b, primero) => {
  const p = { tag: '', text: b.texto, type: 'external', on_error: null, recipient,
    is_in_starting_block: primero, send_to_all_chat_sources: TODOS_LOS_CANALES, chat_sources: CANALES.map(function (id) { return { id: id }; }) };
  if (b.botones && !b.numerado) p.buttons = b.botones.map(([t]) => ({ text: t, type: 'inline' }));
  return p;
};
const goto = id => ({ params: { step: step.get(id), type: porId.get(id).tipo === 'parar' ? 'finish' : 'question' }, handler: 'goto' });
const ref = id => ({ step: step.get(id), type: porId.get(id).tipo === 'parar' ? 'finish' : 'question' });

const text = {};
const positions = [
  { x: 0, y: 0, z: 1, id: 0, goto: { block: 1 }, step: -1, type: 'start', width: 170, height: 38,
    actions: [{ id: -3, sort: 0, links: [], params: { params: [], handler: '_start' } }], deletable: true },
  { x: -350, y: 0, z: 2, id: -1, code: 'trigger', step: -1, type: 'static', width: 260, height: 0, actions: [], deletable: true }
];
let z = 3, accion = 100;
const X = col => 235 + col * 470, Y = fila => 65 + fila * 330;
const instancias = [];

for (const b of B) {
  const s = step.get(b.id);
  const uuid = randomUUID();
  const primero = b.id === 1;
  if (b.tipo === 'msg') {
    const q = [{ params: sm(b, primero), handler: 'send_message' }];
    const entrada = { question: q, block_uuid: uuid };
    if (b.botones) {
      entrada.answer = [{ params: [
        ...b.botones.map(([t, id], i) => ({ value: t, params: [goto(id)], synonyms: b.numerado ? [String(i + 1)] : [] })),
        ...(b.ocultos || []).map(([t, id, sin]) => ({ value: t, params: [goto(id)], synonyms: sin || [] })),
        { type: 'else', params: [goto(b.sino)] }
      ], handler: 'buttons' }];
    } else {
      q.push(goto(b.sig));
    }
    text[s] = entrada;
    const alto = 150 + (b.texto.split('\n').length - 1) * 18 + (b.botones ? 30 * b.botones.length + 60 : 0);
    positions.push({ x: X(b.col), y: Y(b.fila), z: z++, id: b.id, goto: { block: b.botones ? b.sino : b.sig },
      name: 'Mensaje', step: s, type: 'question', width: 400, height: alto,
      actions: [{ id: accion++, sort: 0,
        links: (b.botones || []).map(([t, id], i) => ({ data: { regex: `/${b.numerado ? '^\\s*' + (i + 1) + '\\b|' : ''}${t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}/iu` }, block: id }))
          .concat((b.ocultos || []).map(([t, id, sin]) => ({ data: { regex: `/${[t].concat(sin || []).join('|')}/iu` }, block: id }))),
        params: { params: sm(b, primero), handler: 'send_message' },
        ...(b.botones ? { synonyms: b.botones.map((_, i) => b.numerado ? [String(i + 1)] : []).concat((b.ocultos || []).map(([, , sin]) => sin || [])) } : {}) }],
      on_error: null, deletable: true, block_uuid: uuid });
  } else if (b.tipo === 'pausa') {
    text[s] = { question: [{ params: { logic: 'or', conditions: [{ event: EVENTO_MENSAJE, action: ref(b.sig) }] }, handler: 'waits' }], block_uuid: uuid };
    positions.push({ x: X(b.col), y: Y(b.fila), z: z++, id: b.id, name: 'Pausa', step: s, type: 'question', width: 400, height: 104,
      actions: [{ id: accion++, sort: 0, links: [{ block: b.sig }], params: { params: { event: EVENTO_MENSAJE }, handler: 'wait' } }],
      deletable: true, block_uuid: uuid });
  } else if (b.tipo === 'parar') {
    text[s] = { question: [{ params: [], handler: 'stop' }], block_uuid: uuid };
    positions.push({ x: X(b.col), y: Y(b.fila), z: z++, id: b.id, step: s, type: 'finish', width: 374, height: 63,
      actions: [{ id: accion++, sort: 0, links: [], params: { params: [], handler: '_stop' } }], deletable: true });
  } else if (b.tipo === 'widget') {
    const exits = {}; for (const [code, id] of Object.entries(b.salidas)) exits[code] = ref(id);
    const paramsWidget = { params: { url: b.url }, widget_id: WIDGET_ID, widget_instance_id: b.uuidWidget, widget_source_code: WIDGET_CODE };
    text[s] = { question: [{ params: Object.assign({ exits }, paramsWidget), handler: 'widget' }], block_uuid: uuid };
    positions.push({ x: X(b.col), y: Y(b.fila), z: z++, id: b.id, name: b.nombre, step: s, type: 'question', width: 400, height: 288 + 24 * (Object.keys(b.salidas).length - 3),
      actions: [{ id: accion++, sort: 0, links: Object.entries(b.salidas).map(([code, id]) => ({ code, block: id })),
        params: { params: paramsWidget, handler: 'widget' } }],
      deletable: true, block_uuid: uuid });
    instancias.push({ bloque: b.id, paso: s, url: b.url, widget_instance_id: b.uuidWidget });
  }
}
text.conversation = false;

const salida = { type_functionality: 0, model: { text: JSON.stringify(text), name: LISTA ? 'EuroBot v3 final' : 'EuroBot v2', positions: JSON.stringify(positions), type: 2 } };
const destino = process.argv[2] || 'pendiente/kommo-bot/EuroBot-v2.json';
fs.mkdirSync(path.dirname(destino), { recursive: true });
fs.writeFileSync(destino, JSON.stringify(salida));
fs.writeFileSync(destino.replace(/\.json$/, '.instancias.json'), JSON.stringify(instancias, null, 2));
console.log('bot: ' + destino + ' · ' + B.length + ' bloques · ' + JSON.stringify(salida).length + ' bytes');
console.log('widgets a registrar: ' + JSON.stringify(instancias));
