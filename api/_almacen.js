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

/* La dirección se queda SOLO con el dominio. El dueño pegó una vez una
   llave en vez de la dirección, y otra vez la dirección con `/rest/v1` de
   más (6-sep-2026): cada lectura tronaba con «Invalid path». Aquí se
   normaliza: `https://xxxx.supabase.co`, y lo que sobre se descarta. Si
   lo que hay no es una dirección https, se avisa una vez y no hay almacén. */
let avisoDeDireccion = false;
function config() {
  const url = process.env.ALMACEN_URL;
  const clave = process.env.ALMACEN_CLAVE;
  if (!url || !clave) return null;
  let origen;
  try {
    const u = new URL(String(url).trim());
    if (u.protocol !== 'https:') throw new Error('sin https');
    origen = u.origin;
  } catch (e) {
    if (!avisoDeDireccion) {
      avisoDeDireccion = true;
      console.error('[almacen] ALMACEN_URL no es una dirección https válida (¿se pegó una llave?): sin almacén');
    }
    return null;
  }
  return { url: origen, clave: String(clave).trim() };
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
/* El último error que contestó la base, para que quien llamó pueda
   distinguir «no hay columna» de «no hay red» sin que `pide` deje de
   ser una sola puerta. */
let ultimoError = null;

async function pide(camino, opciones) {
  const c = config();
  if (!c) return null;
  const o = opciones || {};
  ultimoError = null;
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
      ultimoError = { status: r.status, detalle: detalle };
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
  /* La columna va SOLO cuando hay algo que guardar. Si la base aún no
     tiene la columna (el SQL del 5-sep-2026 corre a mano), una llave
     desconocida haría fallar el UPSERT entero y se perdería la ficha de
     todos los clientes, no solo el precio pendiente de uno. */
  if (ficha.porConfirmar) fila.por_confirmar = ficha.porConfirmar;
  if (ficha.viajeDatos) fila.viaje_datos = ficha.viajeDatos;
  if (ficha.contratoSubido) fila.contrato_subido = ficha.contratoSubido;
  /* El seguimiento (6-sep-2026): cuándo recibió el precio, cuántos
     toques van y cuándo escribió él por última vez. Van solo cuando hay
     algo, por la misma razón de arriba. */
  const conSeguimiento = columnasDeSeguimiento && !!(ficha.precioEn || ficha.clienteEn);
  if (conSeguimiento) {
    if (ficha.precioEn) {
      fila.precio_en = new Date(ficha.precioEn).toISOString();
      fila.toques = Number(ficha.toques) || 0;
    }
    if (ficha.clienteEn) fila.cliente_en = new Date(ficha.clienteEn).toISOString();
  }
  const upsert = {
    metodo: 'POST',
    cabeceras: { 'Prefer': 'resolution=merge-duplicates,return=minimal' },
    cuerpo: fila,
    sinRespuesta: true
  };
  /* `merge-duplicates` es un UPSERT: si ya existe esa llave, la
     actualiza. Sin esto, el segundo mensaje de un cliente reventaría
     por llave repetida y su ficha se quedaría en el primer mensaje. */
  if (await pide('fichas?on_conflict=numero', upsert)) return true;

  /* Si la base todavía no tiene las columnas del seguimiento (el bloque
     del 6-sep-2026 de docs/ALMACEN.sql corre a mano), PostgREST contesta
     PGRST204 «Could not find the column». Se avisa una vez y se vuelve a
     guardar SIN ellas: perder el seguimiento es barato; perder la ficha
     de todos los clientes, no. */
  if (conSeguimiento && ultimoError && /PGRST204/.test(ultimoError.detalle || '')) {
    columnasDeSeguimiento = false;
    console.error('[almacen] la tabla fichas no tiene las columnas del seguimiento ' +
      '(precio_en, toques, cliente_en): corre el bloque del 6-sep-2026 de docs/ALMACEN.sql. ' +
      'Mientras, se guarda sin ellas y NO hay seguimiento.');
    delete fila.precio_en; delete fila.toques; delete fila.cliente_en;
    return !!(await pide('fichas?on_conflict=numero', upsert));
  }
  return false;
}
let columnasDeSeguimiento = true;

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
    porConfirmar: f.por_confirmar || null,
    viajeDatos: f.viaje_datos || null,
    contratoSubido: f.contrato_subido || null,
    precioEn: f.precio_en ? Date.parse(f.precio_en) : null,
    toques: Number(f.toques) || 0,
    clienteEn: f.cliente_en ? Date.parse(f.cliente_en) : null,
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

/* Para el cron del seguimiento: las que tienen precio, siguen en
   «con precio» y les faltan toques. Filtrado en la base, no aquí; si
   las columnas no existen, la base contesta 400 y se ve en el registro. */
async function fichasDeSeguimiento() {
  const filas = await pide('fichas?select=*&etapa=eq.con_precio&precio_en=not.is.null' +
    '&toques=lt.3&order=precio_en.asc&limit=200');
  if (!filas) return null;
  return filas.map(deLaFila);
}

/* ============================================================
   LAS CHARLAS · lo que el bot lleva entendido de cada quien
   ------------------------------------------------------------
   Es el estado de la máquina de conversación. Vivía seis horas
   —retomar «a media pregunta» confundía—. Desde el 6-sep-2026 vive
   siete días: el dueño pidió que el bot se acuerde «un día después»,
   y con el agente leyendo la plática, retomarla ya no confunde.
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

const VIDA_CHARLA_MS = 7 * 24 * 60 * 60 * 1000;

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
  await pide('tickets?creado=lt.' + corte, { metodo: 'DELETE', sinRespuesta: true })
    .catch(function () { return null; });
  return true;
}

/* ------------------------------------------------------------
   LOS TICKETS · qué cliente hay detrás de cada mensaje al dueño
   ------------------------------------------------------------
   El dueño contesta CITANDO el ticket, y WhatsApp manda el id del
   citado. En memoria ya se recordaba (`recuerdaTicket`), pero la
   memoria muere con la instancia, y entre el ticket y el «va»
   pueden pasar horas. Aquí queda para siempre —bueno, un mes—.

   Si la tabla aún no existe, se falla en silencio: la memoria
   sigue funcionando dentro de la instancia, que es lo que había.
   ------------------------------------------------------------ */
async function guardaTicket(id, cliente) {
  if (!id || !cliente) return false;
  const r = await pide('tickets?on_conflict=id', {
    metodo: 'POST',
    cabeceras: { 'Prefer': 'resolution=merge-duplicates,return=minimal' },
    cuerpo: { id: String(id), cliente: String(cliente) },
    sinRespuesta: true
  }).catch(function () { return null; });
  return !!r;
}

async function leeTicket(id) {
  if (!id) return null;
  const filas = await pide('tickets?id=eq.' + encodeURIComponent(String(id)) +
    '&select=cliente&limit=1').catch(function () { return null; });
  return (filas && filas[0] && filas[0].cliente) || null;
}

/* ------------------------------------------------------------
   LOS PRECIOS QUE EL DUEÑO YA DIO
   ------------------------------------------------------------
   Un renglón por cada «va» o número suyo (`_precios-aprendidos.js`
   arma el renglón). Se leen los últimos del mismo viaje para el
   ticket del siguiente cliente. Si la tabla no existe, se falla en
   silencio: el ticket sale sin historial, que es lo que había.
   ------------------------------------------------------------ */
async function guardaPrecio(renglon) {
  if (!renglon || !renglon.clave || !(renglon.total > 0)) return false;
  const r = await pide('precios', {
    metodo: 'POST',
    cabeceras: { 'Prefer': 'return=minimal' },
    cuerpo: renglon,
    sinRespuesta: true
  }).catch(function () { return null; });
  return !!r;
}

async function preciosParecidos(clave, cuantos) {
  if (!clave) return [];
  const filas = await pide('precios?clave=eq.' + encodeURIComponent(clave) +
    '&select=total,anticipo,pasajeros,salida,fijado,cuando&order=cuando.desc&limit=' +
    (cuantos || 3)).catch(function () { return null; });
  return Array.isArray(filas) ? filas : [];
}

module.exports = {
  hayAlmacen, llave,
  guardaFicha, leeFicha, fichasDelTablero, fichasDeSeguimiento,
  guardaCharla, leeCharla,
  anotaMensaje, mensajesDe, tiraLoViejo,
  guardaTicket, leeTicket,
  guardaPrecio, preciosParecidos,
  VIDA_DIAS, VIDA_CHARLA_MS
};
