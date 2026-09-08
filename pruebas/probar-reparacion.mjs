/* ============================================================
   LA SUITE R1–R9 DE LA REPARACIÓN DIRIGIDA (8-sep-2026)
   ============================================================
   El dueño dictó seis fallas de arquitectura y una prueba por cada una.
   Aquí viven todas, en un solo comando: `npm run reparacion`. Corre con
   los módulos REALES del bot; solo Meta y la IA son de mentiras (la IA
   contesta lo que cada prueba le dicta, incluidos sus errores).

   R1 · memoria: cuatro datos en cuatro turnos y luego en uno; cero
        preguntas repetidas (Falla 1).
   ============================================================ */
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import { createHmac } from 'crypto';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.join(AQUI, '..');

process.env.WHATSAPP_APP_SECRET = 'secreto';
process.env.WHATSAPP_TOKEN = 'tok';
process.env.WHATSAPP_PHONE_ID = '111';
process.env.WHATSAPP_VERIFY_TOKEN = 'v';
process.env.ANTHROPIC_API_KEY = 'k';
process.env.DUENO_WHATSAPP = '5213311112222';
process.env.CONFIRMAR_PRECIOS = '1';
process.env.AGENTE_IA = '1';
process.env.SITIO_URL = 'https://eurotravel-web.vercel.app';
delete process.env.ALMACEN_URL; delete process.env.ALMACEN_CLAVE;

let buenas = 0, malas = 0;
function ok(que, dio, esperaba) {
  const bien = JSON.stringify(dio) === JSON.stringify(esperaba);
  if (bien) { buenas++; console.log('ok   ' + que); }
  else { malas++; console.log('MAL  ' + que + '\n     dio      ' + JSON.stringify(dio) + '\n     esperaba ' + JSON.stringify(esperaba)); }
}
function okQue(que, condicion) { ok(que, !!condicion, true); }
function titulo(t) { console.log('\n== ' + t.toUpperCase() + ' =='); }

/* ---- Meta y la IA de mentiras ---- */
let mandados = [];
let payloads = [];
let llamadasALaIA = 0;
let laIA = function () { return null; };   // (textoDelCliente, payload) -> JSON o null (=500)
globalThis.fetch = async function (url, opciones) {
  const u = String(url);
  const cuerpo = opciones && opciones.body ? JSON.parse(opciones.body) : {};
  if (u.indexOf('graph.facebook.com') !== -1) {
    mandados.push(cuerpo);
    return { ok: true, status: 200, json: async () => ({ messages: [{ id: 'wamid.s' + mandados.length }] }), text: async () => '{}' };
  }
  if (u.indexOf('api.anthropic.com') !== -1) {
    llamadasALaIA++;
    const ultimo = String(cuerpo.messages[cuerpo.messages.length - 1].content);
    const dinamico = (cuerpo.system || []).filter((b) => !b.cache_control).map((b) => b.text).join('\n');
    payloads.push({ mensaje: ultimo, dinamico: dinamico, cacheado: (cuerpo.system || []).filter((b) => b.cache_control).length });
    const json = laIA(ultimo, dinamico);
    if (!json) return { ok: false, status: 500, json: async () => ({}), text: async () => 'error' };
    return { ok: true, status: 200, json: async () => ({ content: [{ type: 'text', text: JSON.stringify(json) }], usage: { input_tokens: 100, cache_read_input_tokens: 9000, output_tokens: 50 } }), text: async () => '' };
  }
  return { ok: false, status: 500, json: async () => ({}), text: async () => 'sin red' };
};

const atiende = (await import(pathToFileURL(path.join(RAIZ, 'api', 'whatsapp.mjs')).href)).default;
const webhook = (await import(pathToFileURL(path.join(RAIZ, 'api', '_whatsapp-webhook.js')).href)).default;
const agente = (await import(pathToFileURL(path.join(RAIZ, 'api', '_agente.js')).href)).default;
const tk = (await import(pathToFileURL(path.join(RAIZ, 'api', '_tickets.js')).href)).default;

const DUENO = process.env.DUENO_WHATSAPP;
let contador = 0;
function firma(cuerpo) { return 'sha256=' + createHmac('sha256', 'secreto').update(cuerpo).digest('hex'); }
async function dice(texto, de) {
  contador++;
  const cuerpo = JSON.stringify({ entry: [{ changes: [{ value: { metadata: { phone_number_id: '111' },
    contacts: [{ wa_id: de, profile: { name: 'Prueba' } }],
    messages: [{ id: 'wamid.rep' + contador, from: de, type: 'text', text: { body: texto } }] } }] }] });
  const r = await atiende(new Request('https://x/api/whatsapp', { method: 'POST', body: cuerpo, headers: { 'x-hub-signature-256': firma(cuerpo) } }));
  if (!r || r.status !== 200) console.log('     ¡el webhook contestó ' + (r && r.status) + ' a «' + texto + '»!');
}
function mismo(a, b) { return String(a || '').replace(/\D/g, '').slice(-10) === String(b || '').replace(/\D/g, '').slice(-10); }
function textos(para) { return mandados.filter((m) => mismo(m.to, para)).map((m) => (m.text && m.text.body) || ''); }
function limpia() { webhook.olvidaTodo(); agente.olvidaTodo(); tk.olvidaTodo(); mandados = []; payloads = []; llamadasALaIA = 0; }

/* ============================================================ */
titulo('R1 · cuatro datos en cuatro turnos: cero preguntas repetidas');
{
  limpia();
  const C = '5213366670401';
  /* La IA de mentiras extrae bien los datos… y en el 5º turno se equivoca y
     vuelve a preguntar a dónde van. La validación tiene que atraparla. */
  laIA = function (t) {
    if (/^hola$/i.test(t)) return { respuesta: '¡Qué tal! Bienvenido a Eurotravel 🚐 ¿A dónde va el plan?', datos: {}, accion: 'seguir' };
    if (/mariana/i.test(t)) return { respuesta: 'Mucho gusto, Mariana. ¿A dónde van?', datos: { nombre: 'Mariana' }, accion: 'seguir' };
    if (/vallarta/i.test(t)) return { respuesta: 'Vallarta, va. ¿Qué día salen?', datos: { destino: 'Puerto Vallarta' }, accion: 'seguir' };
    if (/somos 18/i.test(t)) return { respuesta: 'Para 18 la unidad es la Sprinter. ¿Qué día salen?', datos: { gente: 18 }, accion: 'seguir' };
    if (/20 de octubre/i.test(t)) return { respuesta: 'Perfecto. ¿A dónde van?', datos: { salida: '2026-10-20' }, accion: 'seguir' };   // ¡repite!
    return { respuesta: 'Va.', datos: {}, accion: 'seguir' };
  };
  for (const t of ['hola', 'soy Mariana', 'a Vallarta', 'somos 18']) await dice(t, C);
  const cuarto = payloads[3];
  okQue('el 4º turno lleva el bloque «LO QUE YA SÉ» PRIMERO', /^══ LO QUE YA SÉ/.test(cuarto.dinamico));
  okQue('  con el nombre dicho en el chat', /Nombre: Mariana/.test(cuarto.dinamico));
  okQue('  y el destino', /Destino: Puerto Vallarta/.test(cuarto.dinamico));
  okQue('  y «LO QUE FALTA»', /══ LO QUE FALTA ══/.test(cuarto.dinamico));
  okQue('  el bloque cacheado sigue siendo uno y fijo', cuarto.cacheado === 1);
  const antes = textos(C).length;
  await dice('el 20 de octubre', C);
  const quinto = payloads[4];
  okQue('el 5º turno ya sabe los 18 pasajeros', /Pasajeros: 18/.test(quinto.dinamico));
  const ultimo = textos(C).slice(antes).join('\n');
  okQue('la IA volvió a preguntar «¿a dónde van?» y NO le llegó al cliente', !/d[oó]nde van/i.test(ultimo));
  okQue('  se regeneró UNA vez con el aviso «ese dato ya lo tienes»', payloads.length === 6 && /Ese dato ya lo tienes: destino/.test(payloads[5].dinamico));
  okQue('  y el cliente recibió la pregunta que sí falta (el regreso)', /regres|mismo d[ií]a|vuelven/i.test(ultimo));
  okQue('  la plática guarda el nombre y no lo pisa el del perfil', (webhook.charlaDe(C) || {}).nombre === 'Mariana');
}

/* ============================================================ */
titulo('R1b · los cuatro datos en un solo mensaje: al siguiente turno, nada repetido');
{
  limpia();
  const C = '5213366670402';
  laIA = function (t) {
    if (/todo junto/i.test(t)) return { respuesta: 'Va, Mariana: Vallarta del 20 al 22 con 18. ¿Salen de la zona metropolitana de Guadalajara?', datos: { nombre: 'Mariana', destino: 'Puerto Vallarta', salida: '2026-10-20', regreso: '2026-10-22', gente: 18 }, accion: 'seguir' };
    if (/^s[ií]$/i.test(t)) return { respuesta: 'Perfecto. ¿Cuántos van?', datos: { origen: 'Guadalajara' }, accion: 'seguir' };   // ¡repite gente!
    return { respuesta: 'Va.', datos: {}, accion: 'seguir' };
  };
  await dice('soy Mariana, todo junto: a Vallarta del 20 al 22 de octubre, somos 18', C);
  const antes = textos(C).length;
  await dice('sí', C);
  const ultimo = textos(C).slice(antes).join('\n');
  okQue('«¿cuántos van?» con 18 ya sabidos NO llega al cliente', !/cu[aá]ntos van/i.test(ultimo));
  okQue('  y llega la pregunta que sí falta (recorridos) o la espera del precio: «' + ultimo.replace(/\n/g, ' ').slice(0, 90) + '»',
    /mueven|mover|recorrid|d[ií]as quieren usar|llev(an|amos) y tra(en|emos)|precio|cotizaci/i.test(ultimo));
  const p = payloads[payloads.length - 1];
  okQue('  el bloque de estado del último turno trae los cuatro datos', /Nombre: Mariana/.test(p.dinamico) && /Destino: Puerto Vallarta/.test(p.dinamico) && /Salida: 2026-10-20/.test(p.dinamico) && /Pasajeros: 18/.test(p.dinamico));
}

/* ============================================================ */
titulo('R2 · pedir foto, recibirla, «apártamelo»: cero fotos repetidas (Falla 2)');
{
  limpia();
  const C = '5213366670403';
  tk.anotaEtapa(C, 'con_precio', { total: 7000, anticipo: 1500,
    viajeDatos: { origen: 'Guadalajara', destino: 'Tequila', salida: '2026-09-20', regreso: '2026-09-20', gente: 15, unidad: 'Sprinter' } }, Date.now());
  process.env.CLABE = '012345678901234567';
  laIA = function (t) {
    if (/fotos/i.test(t)) return { respuesta: null, datos: {}, accion: 'fotos', unidadPedida: 'sprinter' };
    return { respuesta: 'Va 🙌', datos: {}, accion: 'seguir' };
  };
  const fotosA = (desde) => mandados.slice(desde).filter((m) => mismo(m.to, C) && m.image && m.image.link).length;
  await dice('mándame fotos de la sprinter', C);
  okQue('al pedir fotos llegan (hasta 3)', fotosA(0) >= 1 && fotosA(0) <= 3);
  const antes1 = mandados.length;
  await dice('apártamela', C);
  ok('con «apártamela» NO va ninguna foto de la unidad', mandados.slice(antes1).filter((m) => mismo(m.to, C) && m.image && /sprinter/i.test(m.image.link || '')).length, 0);
  okQue('  y sí van el anticipo y la CLABE', /de anticipo/.test(textos(C).slice(antes1).join('\n')) && textos(C).indexOf('012345678901234567') >= 0);
  const antes2 = mandados.length;
  await dice('mándame las fotos', C);
  ok('si vuelve a pedir las mismas fotos, no se repiten', fotosA(antes2), 0);
  okQue('  se le dice que van arriba', /van arriba/.test(textos(C).slice(-1)[0] || ''));
  const antes3 = mandados.length;
  await dice('no me llegaron las fotos, mándamelas otra vez', C);
  okQue('  pero si dice que no le llegaron, sí se mandan de nuevo', fotosA(antes3) >= 1);
  okQue('el historial del agente registra la acción', agente.historialDe(C).some((t) => /\[Acción: envié \d fotos/.test(t.texto)));
  delete process.env.CLABE;
}

/* ============================================================ */
titulo('R3 · el vendedor pone $23,000 para 30: el cliente recibe $23,000 y ningún otro número de dinero (Falla 3)');
{
  limpia();
  const C = '5213366670406';
  process.env.CLABE = '012345678901234567';
  /* Autobús de 30 (va sin cotizador; el precio lo pone el vendedor). */
  laIA = function (t) {
    if (/mazatl/i.test(t)) return { respuesta: 'Mazatlán, va. ¿Qué día salen?', datos: { destino: 'Mazatlán' }, accion: 'seguir' };
    if (/10 de octubre/i.test(t)) return { respuesta: '¿Y regresan?', datos: { salida: '2026-10-10' }, accion: 'seguir' };
    if (/el 12/i.test(t)) return { respuesta: 'Del 10 al 12. ¿Cuántos van?', datos: { regreso: '2026-10-12' }, accion: 'seguir' };
    if (/somos 30/i.test(t)) return { respuesta: 'Para 30 les caben estos:\nMarcopolo Paradiso G8 — Premium — 51 asientos\nIrizar i6S — Premium — 51 asientos\nNeobus — Gran Turismo — 50 asientos\n¿Cuál te late?', datos: { gente: 30 }, accion: 'seguir' };
    if (/neobus/i.test(t)) return { respuesta: 'Neobus, va. ¿Salen de la zona metropolitana de Guadalajara?', datos: { autobus: 'neobus' }, accion: 'seguir' };
    if (/^s[ií]$/i.test(t)) return { respuesta: 'Perfecto. Allá, ¿se mueven con el camión o solo los llevamos y traemos?', datos: { origen: 'Guadalajara' }, accion: 'seguir' };
    if (/solo nos llevan/i.test(t)) return { respuesta: null, datos: { recorridos: 0 }, accion: 'cotizar' };
    if (/por persona|por cabeza/i.test(t)) return { respuesta: 'El total es el que te pasé; cómo lo repartan entre ustedes ya es cosa suya 🙌 ¿Te la aparto?', datos: {}, accion: 'seguir' };
    return { respuesta: 'Va 🙌', datos: {}, accion: 'seguir' };
  };
  for (const t of ['vamos a mazatlán', 'el 10 de octubre', 'regresamos el 12', 'somos 30', 'el neobus', 'sí', 'solo nos llevan y traen']) await dice(t, C);
  /* El vendedor contesta el ticket con el total. */
  let idx = -1; mandados.forEach((m, i) => { if (mismo(m.to, DUENO) && /Precio por confirmar|precio/i.test((m.text && m.text.body) || '')) idx = i; });
  const ticket = 'wamid.s' + (idx + 1);
  const antes = mandados.length;
  const va = JSON.stringify({ entry: [{ changes: [{ value: { metadata: { phone_number_id: '111' },
    messages: [{ id: 'wamid.r3-va', from: DUENO, type: 'text', text: { body: '23,000' }, context: { id: ticket } }] } }] }] });
  await atiende(new Request('https://x/api/whatsapp', { method: 'POST', body: va, headers: { 'x-hub-signature-256': firma(va) } }));
  const precio = textos(C).slice(mandados.slice(0, antes).filter((m) => mismo(m.to, C)).length).join('\n');
  okQue('el cliente recibe el total de $23,000', /\*Total: \$23,000\*/.test(precio));
  const montos = (precio.match(/\$[\d,]+/g) || []).map((m) => m.replace(/[^\d]/g, ''));
  const distintos = montos.filter((m, i) => montos.indexOf(m) === i);
  okQue('  y los únicos montos son el total y el apartado (' + distintos.join(', ') + ')', distintos.length <= 2 && distintos.indexOf('23000') >= 0);
  okQue('  sin «por persona»', !/por persona/.test(precio));
  const antes2 = textos(C).length;
  await dice('y cuánto sale por persona?', C);
  const rep = textos(C).slice(antes2).join('\n');
  okQue('«¿cuánto por persona?» → el total para todo el grupo, sin dividir', /para todo el grupo/.test(rep) && !/\$[\d,]+ por persona/.test(rep));
  okQue('  con un solo monto: los $23,000', (rep.match(/\$[\d,]+/g) || []).length === 1 && /23,000/.test(rep));
  delete process.env.CLABE;
}

/* ============================================================ */
titulo('R9 · el precio lleva unidad + total + foto + apartado + CLABE; y la CLABE se repite cada vez que la pida (Falla 6)');
{
  limpia();
  const C = '5213366670407';
  const CLABE = '012345678901234567';
  process.env.CLABE = CLABE;
  process.env.DATOS_BANCARIOS = 'BBVA · a nombre de Eurotravel SA de CV';
  laIA = function (t) {
    if (/tequila/i.test(t)) return { respuesta: 'Tequila, va. ¿Qué día salen?', datos: { destino: 'Tequila' }, accion: 'seguir' };
    if (/20 de septiembre/i.test(t)) return { respuesta: '¿Es ida y vuelta el mismo día?', datos: { salida: '2026-09-20' }, accion: 'seguir' };
    if (/^s[ií], mismo/i.test(t)) return { respuesta: 'Listo. ¿Cuántos van?', datos: { regreso: '2026-09-20' }, accion: 'seguir' };
    if (/somos 15/i.test(t)) return { respuesta: 'Para 15 la unidad es la Sprinter. ¿Salen de la zona metropolitana de Guadalajara?', datos: { gente: 15 }, accion: 'seguir' };
    if (/^s[ií]$/i.test(t)) return { respuesta: null, datos: { origen: 'Guadalajara' }, accion: 'cotizar' };
    if (/quiero apartar|cuenta/i.test(t)) return { respuesta: null, datos: {}, accion: 'apartar' };
    return { respuesta: 'Va 🙌', datos: {}, accion: 'seguir' };
  };
  for (const t of ['vamos a tequila', 'el 20 de septiembre', 'sí, mismo día', 'somos 15', 'sí']) await dice(t, C);
  let idx = -1; mandados.forEach((m, i) => { if (mismo(m.to, DUENO) && /Precio por confirmar/.test((m.text && m.text.body) || '')) idx = i; });
  const ticket = 'wamid.s' + (idx + 1);
  const antes = mandados.length;
  const va = JSON.stringify({ entry: [{ changes: [{ value: { metadata: { phone_number_id: '111' },
    messages: [{ id: 'wamid.r9-va', from: DUENO, type: 'text', text: { body: 'va' }, context: { id: ticket } }] } }] }] });
  await atiende(new Request('https://x/api/whatsapp', { method: 'POST', body: va, headers: { 'x-hub-signature-256': firma(va) } }));
  const tras = mandados.slice(antes).filter((m) => mismo(m.to, C));
  const textoPrecio = tras.map((m) => (m.text && m.text.body) || (m.image && m.image.caption) || '').join('\n');
  okQue('con el «va» del vendedor el cliente recibe la unidad y el total', /Sprinter/.test(textoPrecio) && /\*Total: \$/.test(textoPrecio));
  okQue('  la foto de la unidad', tras.some((m) => m.image && /sprinter/i.test(m.image.link || '')));
  okQue('  el monto de apartado', /son \*\$[\d,]+\* de apartado/.test(textoPrecio));
  okQue('  y la CLABE, idéntica a la configurada, con banco y beneficiario', new RegExp('CLABE: ' + CLABE + ' · BBVA').test(textoPrecio));
  okQue('  más la CLABE pelona para copiar', tras.some((m) => m.text && m.text.body === CLABE));
  okQue('  y «mándame tu comprobante»', /comprobante/.test(textoPrecio));
  const antes2 = mandados.length;
  await dice('ok, quiero apartar', C);
  const t2 = textos(C).slice(mandados.slice(0, antes2).filter((m) => mismo(m.to, C)).length).join('\n');
  okQue('«ok, quiero apartar»: recibe de nuevo el apartado y la CLABE', /de anticipo|de apartado/.test(t2) && t2.indexOf(CLABE) >= 0);
  const antes3 = mandados.length;
  await dice('pásame la cuenta otra vez', C);
  const t3 = textos(C).slice(mandados.slice(0, antes3).filter((m) => mismo(m.to, C)).length).join('\n');
  okQue('«pásame la cuenta otra vez»: la recibe otra vez', t3.indexOf(CLABE) >= 0);
  okQue('  ninguna otra secuencia de 18 dígitos salió nunca', !textos(C).join('\n').replace(new RegExp(CLABE, 'g'), '').match(/\b\d{18}\b/));
  /* Una CLABE inventada por el modelo se frena y se avisa. */
  const antes4 = mandados.length;
  const { manda } = await import(pathToFileURL(path.join(RAIZ, 'api', 'whatsapp.mjs')).href);
  const salio = await manda({ numeroDeOrigen: '111', para: C, pasaAPersona: false, escribio: '[prueba]', texto: 'Deposita a la CLABE 999999999999999999 por favor' });
  okQue('un texto con OTRA CLABE se frena (no sale)', salio === false && !textos(C).slice(mandados.slice(0, antes4).filter((m) => mismo(m.to, C)).length).join('').includes('999999999999999999'));
  okQue('  y al dueño le llega el incidente', /Frené un mensaje con una CLABE/.test(textos(DUENO).join('\n')));
  /* Un texto que dice «deposita» sin la CLABE recibe el bloque anexado. */
  const antes5 = mandados.length;
  await manda({ numeroDeOrigen: '111', para: C, pasaAPersona: false, escribio: '[prueba]', texto: 'Va, deposita cuando puedas y me mandas el comprobante 🙌' });
  const t5 = textos(C).slice(mandados.slice(0, antes5).filter((m) => mismo(m.to, C)).length).join('\n');
  okQue('«deposita cuando puedas» sin CLABE sale CON el bloque anexado', t5.indexOf(CLABE) >= 0 && /de apartado/.test(t5));
  delete process.env.CLABE; delete process.env.DATOS_BANCARIOS;
}

/* ============================================================ */
titulo('R4 · el mismo webhook tres veces: una sola respuesta (Falla 2)');
{
  limpia();
  const C = '5213366670404';
  laIA = () => ({ respuesta: '¡Qué tal! ¿A dónde va el plan?', datos: {}, accion: 'seguir' });
  const cuerpo = JSON.stringify({ entry: [{ changes: [{ value: { metadata: { phone_number_id: '111' },
    messages: [{ id: 'wamid.repetido-r4', from: C, type: 'text', text: { body: 'hola' } }] } }] }] });
  for (let i = 0; i < 3; i++) {
    await atiende(new Request('https://x/api/whatsapp', { method: 'POST', body: cuerpo, headers: { 'x-hub-signature-256': firma(cuerpo) } }));
  }
  ok('tres entregas del mismo wamid → una sola respuesta al cliente', textos(C).length, 1);
  ok('  y una sola llamada a la IA', llamadasALaIA, 1);
}

/* ============================================================ */
titulo('R5 · tres mensajes seguidos en un aviso: un solo turno (Falla 2)');
{
  limpia();
  const C = '5213366670405';
  laIA = (t) => ({ respuesta: 'Vallarta del 20 con 18, va. ¿Regresan el mismo día?', datos: { destino: 'Puerto Vallarta', salida: '2026-10-20', gente: 18 }, accion: 'seguir' });
  const cuerpo = JSON.stringify({ entry: [{ changes: [{ value: { metadata: { phone_number_id: '111' },
    messages: [
      { id: 'wamid.r5-1', from: C, type: 'text', text: { body: 'a vallarta' } },
      { id: 'wamid.r5-2', from: C, type: 'text', text: { body: 'el 20 de octubre' } },
      { id: 'wamid.r5-3', from: C, type: 'text', text: { body: 'somos 18' } }
    ] } }] }] });
  await atiende(new Request('https://x/api/whatsapp', { method: 'POST', body: cuerpo, headers: { 'x-hub-signature-256': firma(cuerpo) } }));
  ok('una ráfaga de tres en un aviso → una sola llamada a la IA', llamadasALaIA, 1);
  okQue('  y el cliente recibe una respuesta, no tres', textos(C).length >= 1 && textos(C).length <= 2);
}

console.log('\n' + buenas + ' buenas, ' + malas + ' malas');
process.exit(malas ? 1 : 0);
