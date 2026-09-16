/* ============================================================
   KOMMO · LA PUERTA AL CRM (12-sep-2026)
   ============================================================
   El bot va a mudarse de Dualhook a Kommo. Esto es lo que sabe hablar
   con su API: mover un lead de etapa, guardarle el precio, y leer lo que
   los vendedores han cotizado.

   ------------------------------------------------------------
   APAGADO MIENTRAS NO HAYA LLAVES
   ------------------------------------------------------------
   Igual que `_almacen.js`: sin `KOMMO_SUBDOMINIO` y `KOMMO_TOKEN` esto
   no intenta nada y `hayKommo()` contesta que no. Así el archivo puede
   vivir en producción desde hoy sin tocar el bot que está atendiendo
   clientes por Dualhook.

   ------------------------------------------------------------
   NO ESTÁ COMPROBADO CONTRA UNA CUENTA DE VERDAD
   ------------------------------------------------------------
   Los caminos salen de la documentación de Kommo, no de haberlos visto
   funcionar: el dueño todavía no da de alta la integración. Está escrito
   para que se note —cada función dice de dónde salió su forma— y la
   batería lo prueba con una puerta de mentiras.

   El día que haya token, lo primero es `pruebaDeVida()`: una lectura
   inofensiva que dice si la cuenta contesta y si el token sirve. Antes
   de eso, nada de escribir.

   ------------------------------------------------------------
   POR QUÉ NO ES UN ARCHIVO DE `api/` A SECAS
   ------------------------------------------------------------
   El plan Hobby de Vercel publica DOCE funciones y hoy hay doce. Un
   `api/kommo.js` sería la trece y el despliegue entero dejaría de subir.
   Los archivos que empiezan con guion bajo son módulos internos y no
   cuentan: lo vigila `pruebas/probar-despliegue.cjs`.
   ============================================================ */
'use strict';

/* Tope de tiempo: un CRM colgado no puede colgar al bot. Misma regla que
   el almacén, y por la misma razón — Meta y Kommo reintentan. */
const ESPERA_MS = 8000;

function config() {
  const sub = String(process.env.KOMMO_SUBDOMINIO || '').trim()
    .replace(/^https?:\/\//, '').replace(/\.kommo\.com.*$/, '').replace(/\/+$/, '');
  const token = String(process.env.KOMMO_TOKEN || '').trim();
  if (!sub || !token) return null;
  return { base: 'https://' + sub + '.kommo.com/api/v4', token: token };
}

function hayKommo() { return !!config(); }

/* ------------------------------------------------------------
   UNA SOLA PUERTA PARA TODAS LAS LLAMADAS
   ------------------------------------------------------------
   Devuelve el JSON, o `null` si algo salió mal — y ESCRIBE POR QUÉ. La
   lección del almacén, que se pagó con meses de precios perdidos: un
   fallo que no deja rastro es un fallo que nadie arregla.
   ------------------------------------------------------------ */
async function pide(camino, opciones) {
  const c = config();
  if (!c) return null;
  const o = opciones || {};
  const traer = o.pide || (typeof fetch === 'function' ? fetch : null);
  if (!traer) return null;
  try {
    const r = await traer(c.base + camino, {
      method: o.metodo || 'GET',
      signal: AbortSignal.timeout(ESPERA_MS),
      headers: {
        'Authorization': 'Bearer ' + c.token,
        'Content-Type': 'application/json'
      },
      body: o.cuerpo ? JSON.stringify(o.cuerpo) : undefined
    });
    if (!r || !r.ok) {
      const detalle = r && r.text ? await r.text().catch(function () { return ''; }) : '';
      console.error('[kommo] ' + (r && r.status) + ' en ' + camino +
        (detalle ? ': ' + String(detalle).replace(/\s+/g, ' ').slice(0, 300) : ''));
      return null;
    }
    if (o.sinRespuesta) return true;
    return await r.json();
  } catch (e) {
    console.error('[kommo] no se pudo ' + camino + ': ' + (e && e.message));
    return null;
  }
}

/* ------------------------------------------------------------
   ¿CONTESTA LA CUENTA? — lo primero que se corre con el token
   ------------------------------------------------------------
   `GET /account` es la lectura más barata e inofensiva que hay: no
   cambia nada y dice si el token sirve. Antes de escribir un solo lead,
   esto tiene que contestar.
   ------------------------------------------------------------ */
async function pruebaDeVida(opciones) {
  const r = await pide('/account', opciones);
  if (!r) return { vive: false, porQue: 'no contestó o el token no sirve' };
  return { vive: true, cuenta: r.name || r.subdomain || null, id: r.id || null };
}

/* ------------------------------------------------------------
   MOVER UN LEAD DE ETAPA, Y GUARDARLE EL PRECIO
   ------------------------------------------------------------
   `PATCH /api/v4/leads/{id}` con `status_id` y `custom_fields_values`
   (documentación de Kommo, verificada el 12-sep-2026).

   El `status_id` es un NÚMERO que Kommo asigna a cada etapa del embudo,
   no el nombre. Por eso `etapas` entra como un mapa de nombre a número:
   los nombres los puso el dueño —`escribio`, `cotizando`, `con_precio`…—
   y los números salen de su cuenta. Sin ese mapa no se mueve nada, y es
   correcto que así sea: adivinar un id de etapa es mover leads a donde
   no van.
   ------------------------------------------------------------ */
function mapaDeEtapas() {
  const crudo = String(process.env.KOMMO_ETAPAS || '').trim();
  if (!crudo) return null;
  try {
    const m = JSON.parse(crudo);
    return (m && typeof m === 'object') ? m : null;
  } catch (e) {
    console.error('[kommo] KOMMO_ETAPAS no es un JSON válido; no se moverán etapas');
    return null;
  }
}

async function mueveDeEtapa(idDelLead, etapa, opciones) {
  if (!idDelLead || !etapa) return false;
  const mapa = mapaDeEtapas();
  const status = mapa && mapa[etapa];
  if (!status) {
    console.error('[kommo] no hay id para la etapa «' + etapa + '»: no se mueve');
    return false;
  }
  const r = await pide('/leads/' + encodeURIComponent(idDelLead),
    Object.assign({ metodo: 'PATCH', cuerpo: { status_id: Number(status) } }, opciones || {}));
  return !!r;
}

/* El precio que dictó el vendedor, al campo del lead. `KOMMO_CAMPO_PRECIO`
   es el id numérico del campo «Precio cotizado» —Kommo los identifica por
   número, no por nombre—. Sin ese id no se escribe nada: un id equivocado
   escribiría el precio en otro campo. */
async function guardaPrecio(idDelLead, total, opciones) {
  const campo = Number(String(process.env.KOMMO_CAMPO_PRECIO || '').trim());
  if (!idDelLead || !(total > 0)) return false;
  if (!campo) {
    console.error('[kommo] falta KOMMO_CAMPO_PRECIO: el precio no se guarda en el lead');
    return false;
  }
  const r = await pide('/leads/' + encodeURIComponent(idDelLead), Object.assign({
    metodo: 'PATCH',
    cuerpo: {
      custom_fields_values: [
        { field_id: campo, values: [{ value: Number(total) }] }
      ]
    }
  }, opciones || {}));
  if (!r) console.error('[precio-perdido] kommo · lead ' + idDelLead + ' · ' + total);
  return !!r;
}

/* ------------------------------------------------------------
   LOS PRECIOS QUE YA SE COTIZARON, PARA EL CEREBRO
   ------------------------------------------------------------
   Lo que hace que Kommo resuelva el agujero de la memoria: los leads con
   precio se leen de vuelta y de ahí sale `precios-que-he-dado.md`.

   Se pide por páginas porque Kommo las devuelve así, y con un tope: una
   cuenta con miles de leads no se trae entera sin querer.
   ------------------------------------------------------------ */
async function leadsConPrecio(opciones) {
  const o = opciones || {};
  const campo = Number(String(process.env.KOMMO_CAMPO_PRECIO || '').trim());
  if (!campo) return [];
  const porPagina = Math.min(Number(o.porPagina) || 250, 250);
  const topePaginas = Math.min(Number(o.topePaginas) || 4, 20);
  const salida = [];
  for (let pagina = 1; pagina <= topePaginas; pagina++) {
    const r = await pide('/leads?limit=' + porPagina + '&page=' + pagina +
      '&with=contacts', o);
    const lista = r && r._embedded && Array.isArray(r._embedded.leads) ? r._embedded.leads : [];
    if (!lista.length) break;
    for (const l of lista) {
      const campos = Array.isArray(l.custom_fields_values) ? l.custom_fields_values : [];
      const suyo = campos.find(function (c) { return Number(c.field_id) === campo; });
      const valor = suyo && Array.isArray(suyo.values) && suyo.values[0] ? suyo.values[0].value : null;
      if (valor) salida.push({ id: l.id, nombre: l.name || null, total: Number(valor) || null,
        cuando: l.updated_at ? new Date(l.updated_at * 1000).toISOString() : null });
    }
    if (lista.length < porPagina) break;
  }
  return salida;
}

/* ============================================================
   EL PASO «EUROBOT» DEL SALESBOT — el cerebro dentro de Kommo (16-sep-2026)
   ============================================================
   Dictado del dueño: «volver a los inicios pero hasta el ticket». El bot
   de bloques era un menú; lo que le gustó fue el cerebro (la IA con el
   guion). Kommo tiene un paso oficial para eso, `widget_request`: el
   Salesbot le manda a nuestro servidor cada mensaje del cliente y sigue
   por la salida que le digamos.

   Lo que manda Kommo (developers.kommo.com/docs/private-chatbot-integration):
     { token: <JWT firmado con la llave secreta de la integración>,
       data: { message, lead_id, contact_name, contact_phone, from: 'kommo' },
       return_url: 'https://<cuenta>.kommo.com/api/v4/salesbot/<bot>/continue/<id>' }

   Lo que le contestamos DESPUÉS del 200 (a `return_url`):
     { data: { status: 'sigue' | 'fin' },
       execute_handlers: [ { handler: 'show', params: { type: 'text', value } }, … ] }

   El widget (pendiente/kommo-widget) convierte `status` en la salida del
   paso: «sigue» → esperar el siguiente mensaje y volver; «fin» → parar.
   ============================================================ */
const crypto = require('crypto');

/* Las fotos de las unidades ya viven en el drive de Kommo (subidas el
   15-sep-2026, uuids en docs/kommo-fotos.json). De la liga pública de la
   foto al uuid de Kommo, para mandarla como adjunto de verdad. */
let FOTOS_KOMMO = null;
function uuidDeFoto(liga) {
  const nombre = String(liga || '').split('?')[0].split('/').pop();
  if (!nombre) return null;
  if (!FOTOS_KOMMO) {
    try { FOTOS_KOMMO = require('./_kommo-fotos.json'); } catch (e) { FOTOS_KOMMO = {}; }
  }
  for (const carpeta of Object.keys(FOTOS_KOMMO)) {
    if (FOTOS_KOMMO[carpeta] && FOTOS_KOMMO[carpeta][nombre]) return FOTOS_KOMMO[carpeta][nombre];
  }
  return null;
}

function base64url(buf) {
  return Buffer.from(buf).toString('base64').replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
}

/* El JWT que Kommo firma con la llave secreta de la integración (HS256).
   Sin llave configurada no se puede comprobar: se contesta `null` para que
   quien llame decida — y lo deje en el registro. */
function verificaTokenDeWidget(token, secreto) {
  if (!secreto) return null;
  const partes = String(token || '').split('.');
  if (partes.length !== 3) return false;
  try {
    const cabecera = JSON.parse(Buffer.from(partes[0].replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8'));
    if (!cabecera || String(cabecera.alg).toUpperCase() !== 'HS256') return false;
    const firma = base64url(crypto.createHmac('sha256', String(secreto)).update(partes[0] + '.' + partes[1]).digest());
    const A = crypto.createHash('sha256').update(firma).digest();
    const B = crypto.createHash('sha256').update(String(partes[2])).digest();
    if (!crypto.timingSafeEqual(A, B)) return false;
    const cuerpo = JSON.parse(Buffer.from(partes[1].replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8'));
    if (cuerpo && cuerpo.exp && Number(cuerpo.exp) * 1000 < Date.now()) return false;
    return true;
  } catch (e) {
    return false;
  }
}

/* Lo que viene en el aviso, ya limpio, o `{ error }` si no es un aviso del
   widget. El `return_url` TIENE que ser de la cuenta configurada: es a
   donde se le va a contestar al cliente, y un aviso ajeno no puede
   apuntarnos a otro lado. */
function leeAvisoDeWidget(crudo, opciones) {
  const o = opciones || {};
  const c = config();
  const sub = o.subdominio || (c ? c.base.replace(/^https:\/\//, '').split('.')[0] : '');
  let aviso;
  try {
    aviso = JSON.parse(Buffer.isBuffer(crudo) ? crudo.toString('utf8') : String(crudo || ''));
  } catch (e) {
    return { error: 'cuerpo ilegible' };
  }
  if (!aviso || typeof aviso !== 'object') return { error: 'cuerpo vacío' };
  const datos = (aviso.data && typeof aviso.data === 'object') ? aviso.data : {};
  const retorno = String(aviso.return_url || '');
  let host = '';
  try { host = new URL(retorno).host; } catch (e) { host = ''; }
  if (!sub || host !== sub + '.kommo.com') return { error: 'return_url no es de esta cuenta' };
  /* Un marcador que Kommo no llenó llega tal cual («{{contact.phone}}»):
     se trata como vacío. */
  const limpio = function (v) {
    const s = String(v == null ? '' : v).trim();
    return /\{\{.*\}\}/.test(s) ? '' : s;
  };
  const leadId = limpio(datos.lead_id).replace(/\D/g, '');
  if (!leadId) return { error: 'sin lead_id' };
  const telefono = limpio(datos.contact_phone).replace(/\D/g, '');
  return {
    token: String(aviso.token || ''),
    returnUrl: retorno,
    leadId: leadId,
    mensaje: limpio(datos.message),
    nombre: limpio(datos.contact_name),
    /* El «número» con el que el cerebro guarda la plática: el teléfono si
       Kommo lo dio; si no, uno inventado a partir del lead, que no choca
       con ningún número real (empieza en 5299). */
    numero: (telefono.length >= 10 && telefono.length <= 15) ? telefono : ('5299' + leadId),
    talkId: limpio(datos.talk_id)
  };
}

/* ------------------------------------------------------------
   DE LO QUE EL CEREBRO QUISO MANDAR A LO QUE KOMMO SABE MANDAR
   ------------------------------------------------------------
   `manda()` en whatsapp.mjs deja cada envío en el colector en vez de
   llamar a Meta, y aquí se traducen. Kommo (paso de widget) sabe:
     · texto             → show { type: 'text' }
     · texto + botones   → show { type: 'buttons' } (3 botones, 20 letras)
     · foto              → send_message con el adjunto del drive de Kommo
                           (si la foto no está en el drive, la liga en texto)
   El PDF del contrato no pasa por aquí: el bot llega hasta el ticket.
   ------------------------------------------------------------ */
function handlersDeEnvios(envios, opciones) {
  const o = opciones || {};
  const salida = [];
  for (const e of (Array.isArray(envios) ? envios : [])) {
    if (!e) continue;
    const texto = String(e.texto || '').trim();
    if (e.ligaDeFoto) {
      const uuid = o.sinAdjuntos ? null : uuidDeFoto(e.ligaDeFoto);
      if (uuid) {
        salida.push({ handler: 'send_message', params: {
          tag: '', text: texto, type: 'external', on_error: null,
          recipient: { type: 'all_contacts', way_of_communication: 'over_all' },
          attachments: [{ type: 'picture', value: uuid, is_external: true }],
          send_to_all_chat_sources: false,
          chat_sources: o.canal ? [{ id: Number(o.canal) }] : [],
          is_in_starting_block: false
        } });
      } else {
        salida.push({ handler: 'show', params: { type: 'text', value: (texto ? texto + '\n' : '') + String(e.ligaDeFoto) } });
      }
      continue;
    }
    if (e.ligaDeDocumento) {
      salida.push({ handler: 'show', params: { type: 'text', value: (texto ? texto + '\n' : '') + String(e.ligaDeDocumento) } });
      continue;
    }
    if (!texto) continue;
    const ops = (Array.isArray(e.opciones) ? e.opciones : [])
      .map(function (x) { return String(x || '').trim(); })
      .filter(function (x) { return x && x.length <= 20; })
      .slice(0, 3);
    if (ops.length) salida.push({ handler: 'show', params: { type: 'buttons', value: texto, buttons: ops } });
    else salida.push({ handler: 'show', params: { type: 'text', value: texto } });
  }
  return salida;
}

/* La segunda mitad del paso: Kommo ya recibió su 200 y ahora se le dice
   qué mandar y por qué salida seguir. Va con el token de la cuenta. */
async function continuaSalesbot(returnUrl, cuerpo, opciones) {
  const c = config();
  const o = opciones || {};
  const traer = o.pide || (typeof fetch === 'function' ? fetch : null);
  if (!c || !traer || !returnUrl) return false;
  try {
    const r = await traer(returnUrl, {
      method: 'POST',
      signal: AbortSignal.timeout(ESPERA_MS),
      headers: { 'Authorization': 'Bearer ' + c.token, 'Content-Type': 'application/json' },
      body: JSON.stringify(cuerpo)
    });
    if (!r || !r.ok) {
      const detalle = r && r.text ? await r.text().catch(function () { return ''; }) : '';
      console.error('[kommo] continue contestó ' + (r && r.status) + ': ' + String(detalle).replace(/\s+/g, ' ').slice(0, 300));
      return false;
    }
    return true;
  } catch (e) {
    console.error('[kommo] no se pudo continuar el Salesbot: ' + (e && e.message));
    return false;
  }
}

module.exports = {
  hayKommo, pruebaDeVida, mueveDeEtapa, guardaPrecio, leadsConPrecio,
  /* El paso EuroBot. */
  leeAvisoDeWidget, verificaTokenDeWidget, handlersDeEnvios, continuaSalesbot, uuidDeFoto,
  /* Para las pruebas y para el día del alta. */
  config, mapaDeEtapas, pide
};
