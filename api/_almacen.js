/* ============================================================
   DONDE VIVE LO QUE EL BOT RECUERDA
   ------------------------------------------------------------
   Hasta hoy todo estaba en memoria: las conversaciones, en qué
   va cada cliente, los datos de su contrato. Funciona mientras
   la instancia de Vercel siga viva, y deja de funcionar sin
   avisar cuando se recicla — que pasa tras unos minutos sin
   tráfico.

   Con dinero de por medio eso no se puede sostener. El cliente
   te dicta su dirección, Vercel recicla, y a la siguiente
   pregunta el bot ya no sabe quién es.

   ------------------------------------------------------------
   POR QUÉ ASÍ Y NO CON UN PAQUETE
   ------------------------------------------------------------
   Este proyecto no tiene dependencias ni build a propósito, y
   eso no se rompe por una base de datos. Se le habla por HTTP
   con `fetch`, que es lo que ya se usa para Meta, Groq y
   Anthropic.

   Se buscó Neon primero, que era el plan. Su acceso por HTTP
   existe pero NO está documentado: es interno de su paquete, y
   pueden cambiarlo sin avisar. Construir un lanzamiento sobre
   eso es firmar una falla futura que nadie va a saber de dónde
   vino.

   Supabase sí publica el suyo —PostgREST, con `apikey` y
   `Authorization`— y por eso es el que está escrito aquí. Pero
   TODO lo de afuera habla con las funciones de abajo, no con
   Supabase: cambiar de almacén es cambiar este archivo, no el
   bot.

   ------------------------------------------------------------
   SI NO ESTÁ CONFIGURADO, EL BOT SIGUE
   ------------------------------------------------------------
   Sin las variables de entorno esto contesta `null` a todo y el
   bot funciona como funcionaba: en memoria. Es la misma regla
   que la IA, los audios y los tickets — cada pieza es una
   mejora, no un requisito. Un bot que no arranca porque le
   falta una variable es un bot que un martes deja de vender.

   ------------------------------------------------------------
   Y NO SE MEZCLA CON NADA
   ------------------------------------------------------------
   Esta base es SOLO del bot de la página. No es la de
   EuroSystem y no la toca: la única puerta entre los dos
   proyectos sigue siendo `POST /api/contratos/externo`.

   Pedido del dueño, textual: *«me gustaría que esa base de
   datos sea independiente, no me gustaría que luego se esté
   mezclando información que no se debería estar mezclando»*.
   ============================================================ */

'use strict';

/* Cuánto se guarda una conversación. El dueño pidió «al menos un
   mes»; se limpia por fecha al leer, no con un cron que hoy no
   existe. */
const VIDA_DIAS = 45;

function config() {
  const url = process.env.ALMACEN_URL;
  const clave = process.env.ALMACEN_CLAVE;
  if (!url || !clave) return null;
  return { url: String(url).replace(/\/+$/, ''), clave: clave };
}

function hayAlmacen() { return !!config(); }

/* ------------------------------------------------------------
   UNA SOLA PUERTA HACIA AFUERA
   ------------------------------------------------------------
   Todo pasa por aquí para que el manejo de errores sea uno solo.
   Nada de esto puede tumbar al bot: si la base no contesta, se
   registra y se sigue con lo que haya en memoria. Perder el
   tablero es malo; dejar de contestarle a un cliente que ya
   pagó es peor.
   ------------------------------------------------------------ */
async function pide(camino, opciones) {
  const c = config();
  if (!c) return null;
  const o = opciones || {};
  try {
    const r = await fetch(c.url + '/rest/v1/' + camino, {
      method: o.metodo || 'GET',
      headers: Object.assign({
        'apikey': c.clave,
        'Authorization': 'Bearer ' + c.clave,
        'Content-Type': 'application/json'
      }, o.cabeceras || {}),
      body: o.cuerpo ? JSON.stringify(o.cuerpo) : undefined
    });
    if (!r.ok) {
      const detalle = await r.text().catch(function () { return ''; });
      console.error('[almacen] ' + r.status + ' en ' + camino + ': ' + detalle.slice(0, 300));
      return null;
    }
    if (o.sinRespuesta) return true;
    return await r.json();
  } catch (e) {
    console.error('[almacen] no se pudo: ' + e.message);
    return null;
  }
}

/* Los últimos 10 dígitos, igual que en `_tickets.js`. Es la llave de
   TODO, y es la que impide que dos clientes se crucen. Escrita aquí
   otra vez a propósito: este archivo no puede depender de aquél, que
   es el que va a leer de aquí. */
function llave(numero) {
  return String(numero || '').replace(/\D+/g, '').slice(-10);
}

/* ============================================================
   LAS FICHAS · en qué va cada cliente
   ============================================================ */

async function guardaFicha(ficha) {
  if (!ficha || !ficha.cliente) return false;
  const fila = {
    numero: llave(ficha.cliente),
    cliente: ficha.cliente,
    etapa: ficha.etapa || 'escribio',
    viaje: ficha.viaje || null,
    total: typeof ficha.total === 'number' ? ficha.total : null,
    anticipo: typeof ficha.anticipo === 'number' ? ficha.anticipo : null,
    agencia: !!ficha.agencia,
    contrato: ficha.contrato || null,
    contrato_avisado: !!ficha.contratoAvisado,
    visto: new Date(ficha.visto || Date.now()).toISOString()
  };
  /* `merge-duplicates` es un UPSERT: si ya existe esa llave, la
     actualiza. Sin esto, el segundo mensaje de un cliente reventaría
     por llave repetida y su ficha se quedaría en el primer mensaje. */
  const r = await pide('fichas?on_conflict=numero', {
    metodo: 'POST',
    cabeceras: { 'Prefer': 'resolution=merge-duplicates,return=minimal' },
    cuerpo: fila,
    sinRespuesta: true
  });
  return !!r;
}

function deLaFila(f) {
  if (!f) return null;
  return {
    cliente: f.cliente,
    etapa: f.etapa,
    viaje: f.viaje,
    total: f.total,
    anticipo: f.anticipo,
    agencia: !!f.agencia,
    contrato: f.contrato,
    contratoAvisado: !!f.contrato_avisado,
    desde: f.desde ? Date.parse(f.desde) : Date.now(),
    visto: f.visto ? Date.parse(f.visto) : Date.now()
  };
}

async function leeFicha(numero) {
  const k = llave(numero);
  if (!k) return null;
  const filas = await pide('fichas?numero=eq.' + k + '&select=*&limit=1');
  return (filas && filas[0]) ? deLaFila(filas[0]) : null;
}

/* Para el tablero. Ordenado en la base y no aquí: traer 500 fichas
   para ordenar 25 sería pagar el viaje completo por la primera
   cuadra. */
async function fichasDelTablero(cuantas) {
  const filas = await pide('fichas?select=*&order=visto.desc&limit=' + (cuantas || 60));
  if (!filas) return null;
  return filas.map(deLaFila);
}

/* ============================================================
   LAS CHARLAS · lo que el bot lleva entendido de cada quien
   ------------------------------------------------------------
   Es el estado de la máquina de conversación. Vive poco —seis
   horas— porque una conversación de ayer ya no es la misma:
   retomarla a media pregunta confundiría más de lo que ayuda.
   ============================================================ */

async function guardaCharla(numero, estado) {
  const k = llave(numero);
  if (!k) return false;
  /* Estado nulo = la conversación terminó. Se borra en vez de guardar
     un nulo, para no tener que distinguir después entre «no hay» y
     «hay, pero vacío». */
  if (!estado) {
    return !!(await pide('charlas?numero=eq.' + k, {
      metodo: 'DELETE', sinRespuesta: true
    }));
  }
  return !!(await pide('charlas?on_conflict=numero', {
    metodo: 'POST',
    cabeceras: { 'Prefer': 'resolution=merge-duplicates,return=minimal' },
    cuerpo: { numero: k, estado: estado, cuando: new Date().toISOString() },
    sinRespuesta: true
  }));
}

const VIDA_CHARLA_MS = 6 * 60 * 60 * 1000;

async function leeCharla(numero) {
  const k = llave(numero);
  if (!k) return null;
  const filas = await pide('charlas?numero=eq.' + k + '&select=*&limit=1');
  const f = filas && filas[0];
  if (!f) return null;
  /* Se vence al LEER y no con un cron: una charla vieja que nadie
     vuelve a leer no le hace daño a nadie, y un cron es una pieza más
     que se puede romper en silencio. */
  if (Date.now() - Date.parse(f.cuando) > VIDA_CHARLA_MS) return null;
  return f.estado || null;
}

/* ============================================================
   LOS MENSAJES · la conversación, para poder verla después
   ------------------------------------------------------------
   El dueño pidió que las conversaciones duraran «al menos un
   mes». Aquí es donde va a leer el CRM que se haga después: la
   pantalla no necesita nada más que esto y las fichas.

   Se guarda QUIÉN lo dijo —cliente, bot o dueño— porque sin eso
   la conversación no se puede volver a pintar.
   ============================================================ */

async function anotaMensaje(numero, de, texto, tipo) {
  const k = llave(numero);
  if (!k || !texto) return false;
  return !!(await pide('mensajes', {
    metodo: 'POST',
    cabeceras: { 'Prefer': 'return=minimal' },
    cuerpo: {
      numero: k,
      de: de,
      texto: String(texto).slice(0, 4000),
      tipo: tipo || 'texto',
      cuando: new Date().toISOString()
    },
    sinRespuesta: true
  }));
}

async function mensajesDe(numero, cuantos) {
  const k = llave(numero);
  if (!k) return null;
  return await pide('mensajes?numero=eq.' + k +
    '&select=*&order=cuando.desc&limit=' + (cuantos || 50));
}

/* Lo viejo se tira. Se llama de vez en cuando desde el webhook, no
   con un cron: una tarea programada más es una pieza más que se
   puede caer sin que nadie lo note. */
async function tiraLoViejo() {
  const corte = new Date(Date.now() - VIDA_DIAS * 24 * 3600 * 1000).toISOString();
  await pide('mensajes?cuando=lt.' + corte, { metodo: 'DELETE', sinRespuesta: true });
  await pide('charlas?cuando=lt.' + corte, { metodo: 'DELETE', sinRespuesta: true });
  return true;
}

module.exports = {
  hayAlmacen, llave,
  guardaFicha, leeFicha, fichasDelTablero,
  guardaCharla, leeCharla,
  anotaMensaje, mensajesDe, tiraLoViejo,
  VIDA_DIAS, VIDA_CHARLA_MS
};
