/* ============================================================
   Todo lo que este sitio le pide a Stripe, en un solo lugar
   ------------------------------------------------------------
   POR QUE EXISTE

   Antes, tres archivos le hablaban a Stripe y cada uno se armaba
   su propio cliente: `pagar.js` con su codificador de formularios,
   `confirmar.js` con un fetch suelto, y `_webhook-logica.js` con
   otro. Tres formas de hacer lo mismo.

   Pero el problema de verdad no era la plomeria repetida. Era
   esto: la pregunta mas importante del sistema —¿DE VERDAD ENTRO
   EL DINERO?— estaba contestada DOS VECES, con la misma frase
   copiada en dos archivos:

       _webhook-logica.js:  payment_status === 'paid' || … 'no_payment_required'
       confirmar.js:        payment_status === 'paid' || … 'no_payment_required'

   El dia que alguien tocara una y no la otra, la pantalla le
   diria al cliente «tu viaje esta apartado» y el contrato nunca
   se crearia. O al reves. Y nadie se enteraria hasta la llamada.

   Es exactamente el defecto que este proyecto ya pago dos veces
   —con `kmDe` y con `calcula`— y que se arreglo las dos veces
   igual: dejando la respuesta en UN SOLO LUGAR.

   Aqui vive esa respuesta. Y de paso, el seguro del cobro real,
   para que ningun cobro nuevo pueda nacer sin el.

   NO GUARDA NADA. Stripe es la fuente de verdad; esto es la
   puerta por la que se le pregunta.
   ============================================================ */

const STRIPE = 'https://api.stripe.com/v1';

/* ------------------------------------------------------------
   EL SEGURO CONTRA COBRAR DE VERDAD ANTES DE TIEMPO
   ------------------------------------------------------------
   Mientras esto sea false, una clave sk_live_ no cobra nada: la
   pantalla avisa y el viaje se cierra por telefono. Se pone en
   true cuando el recorrido ya se probo completo con la clave de
   prueba y el dueño da el visto bueno.

   Vive AQUI y no en `pagar.js` a proposito: cualquier cobro que
   se agregue mañana pasa por este archivo, asi que no puede
   nacer sin el candado por olvido.
   ------------------------------------------------------------ */
const PERMITIR_COBRO_REAL = false;

/* La clave se recorta: al copiarla del panel es facil que se cuele un espacio
   o un salto de linea, y con eso hasta la cabecera de autorizacion sale mal. */
function clave() {
  return (process.env.STRIPE_SECRET_KEY || '').trim();
}

/* ¿Se puede cobrar? Devuelve null si si, o el motivo si no.
   Los motivos son los mismos textos de antes, para no cambiar lo que ve nadie. */
function porQueNoSePuedeCobrar() {
  const k = clave();
  if (!k) return 'stripe sin configurar';
  if (k.indexOf('sk_live_') === 0 && !PERMITIR_COBRO_REAL) {
    return 'clave de produccion con el cobro real todavia cerrado';
  }
  return null;
}

function hayClave() { return !!clave(); }

/* ------------------------------------------------------------
   ¿ESTA PAGADA ESTA SESION?
   ------------------------------------------------------------
   LA pregunta. Un solo lugar, para siempre.

     pagado    — el dinero ya entro
     pendiente — tipico de OXXO: el voucher se genero y Stripe
                 regresa al cliente a la pantalla de exito, pero
                 AUN NO PAGA. Decirle «tu viaje esta apartado»
                 aqui seria mentirle al reves.
     sinPagar  — cualquier otra cosa
   ------------------------------------------------------------ */
function estadoDePago(sesion) {
  const s = sesion || {};
  if (s.payment_status === 'paid' || s.payment_status === 'no_payment_required') {
    return 'pagado';
  }
  if (s.status === 'complete' || s.status === 'open') return 'pendiente';
  return 'sinPagar';
}

/* Los ids de sesion son `cs_test_…` / `cs_live_…`. Se valida la forma antes de
   pegarla a una URL: nunca se mete en la direccion algo que vino del navegador
   sin revisar. */
function idDeSesionValido(s) {
  return typeof s === 'string' && s.length <= 100 && /^cs_[A-Za-z0-9_]+$/.test(s);
}

/* ------------------------------------------------------------
   TRAER UNA SESION
   ------------------------------------------------------------
   Devuelve siempre un veredicto, nunca revienta:

     { sesion, estado }                      salio bien
     { error }                               Stripe dijo que no
     { error, reintentar: true }             no se pudo ni preguntar

   `reintentar` distingue «Stripe contesto que esa sesion no existe»
   de «no hubo forma de preguntarle». Quien llama decide que hacer:
   el webhook pide reintento, la pantalla dice otra cosa.
   ------------------------------------------------------------ */
async function traeSesion(id) {
  const k = clave();
  if (!k) return { error: 'sin clave de Stripe' };
  if (!idDeSesionValido(id)) return { error: 'id de sesión con mala forma' };

  try {
    const r = await fetch(STRIPE + '/checkout/sessions/' + encodeURIComponent(id), {
      headers: { 'Authorization': 'Bearer ' + k }
    });
    const d = await r.json();
    if (!r.ok || d.error) return { error: 'Stripe no reconoce la sesión' };
    return { sesion: d, estado: estadoDePago(d) };
  } catch (e) {
    return { error: 'no se pudo consultar a Stripe', reintentar: true };
  }
}

/* ------------------------------------------------------------
   ABRIR UN COBRO
   ------------------------------------------------------------
   Stripe recibe formularios, no JSON. Los objetos anidados van como
   metadata[folio], line_items[0][price_data][currency], y asi.
   ------------------------------------------------------------ */
function aFormulario(obj, prefijo, salida) {
  salida = salida || [];
  Object.keys(obj).forEach(function (k) {
    const v = obj[k];
    if (v === undefined || v === null) return;
    const llave = prefijo ? prefijo + '[' + k + ']' : k;
    if (typeof v === 'object' && !Array.isArray(v)) {
      aFormulario(v, llave, salida);
    } else if (Array.isArray(v)) {
      v.forEach(function (item, i) {
        if (typeof item === 'object') aFormulario(item, llave + '[' + i + ']', salida);
        else salida.push(encodeURIComponent(llave + '[' + i + ']') + '=' + encodeURIComponent(item));
      });
    } else {
      salida.push(encodeURIComponent(llave) + '=' + encodeURIComponent(v));
    }
  });
  return salida;
}

/* Stripe cambia por "?" lo que se sale del latino basico. Los acentos y el
   punto medio pasan bien; la flecha no, y en la pantalla de cobro se veia
   "Guadalajara ? Puerto Vallarta". */
function paraStripe(t) {
  return String(t == null ? '' : t)
    .replace(/[→➡➔]/g, 'a')
    .replace(/[‐-―]/g, '-')
    .replace(/[“”‘’]/g, "'")
    .replace(/[^\x00-ÿ]/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

/* ------------------------------------------------------------
   DE UN COBRO REVERTIDO, DE VUELTA A SU VIAJE
   ------------------------------------------------------------
   Cuando llega un reembolso o un contracargo, Stripe avisa del
   COBRO (`ch_…`), no de la sesion. Y en el cobro no vive la
   metadata del viaje: vive en la sesion.

   Se busca por FILTRO DE LISTA, no por la busqueda de Stripe. La
   busqueda tarda hasta un minuto en reflejar lo recien escrito y
   la documentacion de Stripe dice expresamente que no se use para
   leer justo despues de escribir. Los filtros no tienen retraso.

   Devuelve { sesion } o { error, reintentar }. Que no se
   encuentre NO es un error pasajero: es un cobro que no salio de
   esta pagina —una venta por telefono capturada a mano en el
   panel de Stripe, por ejemplo— y no hay nada que revertir aqui.
   ------------------------------------------------------------ */
async function sesionPorPago(idPago) {
  const k = clave();
  if (!k) return { error: 'sin clave de Stripe' };
  const pi = String(idPago || '').trim();
  if (!/^pi_[A-Za-z0-9]{4,}$/.test(pi)) return { error: 'id de pago con mala forma' };

  try {
    const r = await fetch(STRIPE + '/checkout/sessions?payment_intent=' +
      encodeURIComponent(pi) + '&limit=1', {
      headers: { 'Authorization': 'Bearer ' + k }
    });
    const d = await r.json();
    if (!r.ok || d.error) return { error: 'Stripe rechazó la consulta', reintentar: true };
    const lista = (d && d.data) || [];
    if (!lista.length) return { error: 'ese cobro no salió de la página' };
    return { sesion: lista[0] };
  } catch (e) {
    return { error: 'no se pudo consultar a Stripe', reintentar: true };
  }
}

/* ------------------------------------------------------------
   ¿DE VERDAD SE REGRESO ESE DINERO?
   ------------------------------------------------------------
   El aviso que llega dice «se reembolso tanto». Esa frase la
   escribe quien manda el aviso, y —comprobado contra el sitio
   publicado— la firma de Stripe se puede saltar eligiendo el
   Content-Type. O sea que esa frase la puede escribir cualquiera.

   Un desconocido que sepa un `pi_…` no puede inventar un reembolso
   si antes de mover un peso se le pregunta a Stripe. Aqui se
   pregunta.

   Se pide el cobro junto con el pago —`expand[]=latest_charge`—
   porque es el cobro el que sabe si se devolvio (`amount_refunded`)
   y si esta disputado (`disputed`). Una sola llamada.

   404 NO es pasajero: ese pago no existe, y no hay nada que
   revertir. Un fallo de red si lo es, y pide reintento.
   ------------------------------------------------------------ */
async function cargoDelPago(idPago) {
  const k = clave();
  if (!k) return { error: 'sin clave de Stripe' };
  const pi = String(idPago || '').trim();
  if (!/^pi_[A-Za-z0-9]{4,}$/.test(pi)) return { error: 'id de pago con mala forma' };

  try {
    const r = await fetch(STRIPE + '/payment_intents/' + encodeURIComponent(pi) +
      '?expand[]=latest_charge', { headers: { 'Authorization': 'Bearer ' + k } });
    const d = await r.json();
    if (r.status === 404) return { error: 'ese pago no existe en Stripe' };
    if (!r.ok || (d && d.error)) return { error: 'Stripe rechazó la consulta', reintentar: true };
    const cargo = d && d.latest_charge;
    if (!cargo || typeof cargo !== 'object') return { error: 'ese pago no llegó a cobrarse' };
    return { cargo: cargo };
  } catch (e) {
    return { error: 'no se pudo consultar a Stripe', reintentar: true };
  }
}

/* ------------------------------------------------------------
   LA FICHA DEL CLIENTE
   ------------------------------------------------------------
   Ahi vive el codigo de verificacion mientras dura: es el objeto
   al que pertenece y ya existe, asi que no hace falta inventar
   un almacen nuevo para algo que vive diez minutos.

   En funciones serverless la memoria NO sirve para esto: cada
   llamada puede caer en otra maquina, y el codigo guardado en una
   no existe en la siguiente.
   ------------------------------------------------------------ */
function idDeClienteValido(s) {
  return typeof s === 'string' && /^cus_[A-Za-z0-9]{4,}$/.test(s);
}

async function traeCliente(id) {
  const k = clave();
  if (!k) return { error: 'sin clave de Stripe' };
  if (!idDeClienteValido(id)) return { error: 'id de cliente con mala forma' };
  try {
    const r = await fetch(STRIPE + '/customers/' + encodeURIComponent(id), {
      headers: { 'Authorization': 'Bearer ' + k }
    });
    const d = await r.json();
    if (!r.ok || d.error) return { error: 'Stripe no reconoce al cliente' };
    return { cliente: d };
  } catch (e) {
    return { error: 'no se pudo consultar a Stripe', reintentar: true };
  }
}

/* Escribe campos de metadata en la ficha del cliente. Un valor `null` o ''
   BORRA ese campo: asi se limpia el codigo cuando ya se uso. */
async function guardaEnCliente(id, metadata) {
  const k = clave();
  if (!k) return { error: 'sin clave de Stripe' };
  if (!idDeClienteValido(id)) return { error: 'id de cliente con mala forma' };
  try {
    /* Stripe borra un campo de metadata cuando se le manda vacio, asi que
       los `null` se mandan como cadena vacia y no se saltan. */
    const campos = [];
    Object.keys(metadata || {}).forEach(function (campo) {
      const v = metadata[campo];
      campos.push(encodeURIComponent('metadata[' + campo + ']') + '=' +
        encodeURIComponent(v === null || v === undefined ? '' : String(v)));
    });
    const r = await fetch(STRIPE + '/customers/' + encodeURIComponent(id), {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + k,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: campos.join('&')
    });
    const d = await r.json();
    if (!r.ok || d.error) return { error: 'Stripe rechazó la escritura' };
    return { cliente: d };
  } catch (e) {
    return { error: 'no se pudo escribir en Stripe', reintentar: true };
  }
}

/* Crea la sesion de cobro. Devuelve { ok, datos } tal cual contesto Stripe:
   quien llama arma su propio mensaje de error, que es cosa suya. */
async function creaSesionDeCobro(cuerpo) {
  const r = await fetch(STRIPE + '/checkout/sessions', {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer ' + clave(),
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: aFormulario(cuerpo).join('&')
  });
  return { ok: r.ok, datos: await r.json() };
}

module.exports = {
  PERMITIR_COBRO_REAL,
  hayClave,
  porQueNoSePuedeCobrar,
  estadoDePago,
  idDeSesionValido,
  idDeClienteValido,
  traeSesion,
  sesionPorPago,
  cargoDelPago,
  traeCliente,
  guardaEnCliente,
  creaSesionDeCobro,
  paraStripe,
  aFormulario
};
