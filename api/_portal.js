/* ============================================================
   «Abona a tu viaje» — preguntarle a EuroSystem por UN viaje
   ------------------------------------------------------------
   CONTRATOS-API.md §12. El cliente teclea el número de contrato
   que viene impreso en su PDF y un apellido, y ve cuánto lleva
   abonado y cuánto le falta.

   ES LA ÚNICA PANTALLA QUE ENSEÑA UN CONTRATO SIN LIGA Y SIN
   CÓDIGO. Todo lo demás de este archivo sale de ahí.

   LA LLAVE NO SALE DE AQUÍ
   ------------------------
   `PORTAL_API_KEY` es de servidor a servidor, distinta de
   `CONTRATOS_API_KEY` y de `DISPONIBILIDAD_API_KEY`. Vive en las
   variables de Vercel y nunca viaja al navegador —ni ella ni la
   dirección de EuroSystem—: quien las vea puede preguntar por
   cualquier folio hasta dar con uno.

   LISTA BLANCA, NO LISTA NEGRA
   ----------------------------
   Lo que EuroSystem contesta NO se reenvía tal cual. Se copia
   campo por campo, nombrándolos. Es la misma disciplina de
   `_publico.js` y existe por lo mismo: el día que EuroSystem
   agregue un campo con el teléfono del cliente, o el nombre del
   operador, de aquí no pasa sin que alguien lo decida.

   Y §12 lo deja claro: EuroSystem promete no mandar esos datos.
   Esto no desconfía de EuroSystem, desconfía del futuro.

   UNA SOLA FRASE PARA TRES «NO»
   -----------------------------
   EuroSystem contesta el mismo 404 —con el mismo texto— para el
   folio que no existe, para el apellido que no cuadra y para el
   contrato que todavía no está confirmado. La página repite esa
   frase sin adornarla: distinguirlos le enseñaría a quien adivina
   cuáles folios existen, que es exactamente lo que el freno de la
   pantalla está tratando de impedir.

   El nombre empieza con guion bajo para que Vercel no lo publique
   como una dirección más del sitio —y para no gastar una de las
   doce funciones que permite el plan—.
   ============================================================ */

'use strict';

const EUROSYSTEM = process.env.EUROSYSTEM_URL || 'https://eurosystem.site';
const PUERTA = '/api/portal/viaje';

/* Las palabras exactas de §12. Se dicen igual en los tres casos. */
const NO_ENCONTRADO = 'No encontramos un viaje con ese folio y apellido.';

/* Lo que se le dice al cliente cuando el problema es nuestro. Nunca nombra a
   EuroSystem ni a ninguna variable: eso va al registro, que es donde lo lee
   un programador. */
const NO_AHORA = 'No pudimos consultar tu viaje ahora mismo. Inténtalo en un momento.';

function llave() { return String(process.env.PORTAL_API_KEY || '').trim(); }
function hayLlave() { return llave().length > 0; }

/* ------------------------------------------------------------
   LO QUE SE TECLEA, REVISADO ANTES DE GASTAR UNA LLAMADA
   ------------------------------------------------------------
   El número de contrato es un ENTERO (§12: «un entero, por ejemplo
   43773»). No es el folio `ET-XXXX-YYY` de la página: ése lo genera
   la página y EuroSystem no lo conoce. La pantalla lo dice con todas
   sus letras; aquí se fija.
   ------------------------------------------------------------ */
function folioDeContrato(v) {
  const t = String(v == null ? '' : v).trim();
  if (!/^\d{1,8}$/.test(t)) return 0;
  const n = Number(t);
  return n > 0 ? n : 0;
}

/* Un apellido: dos letras o más, y no más de ochenta. §12 dice que vale
   cualquier apellido del cliente, sin acentos ni mayúsculas —eso lo compara
   EuroSystem—, así que aquí no se toca el texto más que para recortarlo. */
function apellidoLimpio(v) {
  const t = String(v == null ? '' : v).replace(/\s+/g, ' ').trim();
  if (t.length < 2) return '';
  return t.slice(0, 80);
}

/* ------------------------------------------------------------
   LA LISTA BLANCA
   ------------------------------------------------------------
   Agregar un renglón aquí es una decisión, no un descuido.
   ------------------------------------------------------------ */
function numero(v) {
  const n = Number(v);
  return Number.isFinite(n) ? Math.round(n) : 0;
}

function texto(v, largo) {
  return String(v == null ? '' : v).slice(0, largo || 120);
}

/* La liga del PDF es al portador (§12): quien la tenga abre el contrato con
   los datos del cliente. Se le pasa solo a quien ya acertó folio y apellido,
   y solo si de verdad es una dirección cifrada. Una liga que no lo sea no es
   la de EuroSystem, y antes de mandar al cliente a saber dónde, mejor nada. */
function ligaDelPdf(v) {
  const t = String(v == null ? '' : v).trim();
  if (!/^https:\/\/[^\s"'<>]+$/i.test(t)) return '';
  return t.slice(0, 600);
}

function abonoLimpio(a) {
  const d = a || {};
  return {
    fecha: texto(d.fecha, 40),
    monto: numero(d.monto),
    /* TRANSFERENCIA, TARJETA, EFECTIVO… lo que EuroSystem tenga anotado. Se
       acepta solo como texto: un objeto aquí terminaría pintado como
       «[object Object]» en la pantalla del cliente. */
    forma: typeof d.forma === 'string' ? d.forma.slice(0, 40) : ''
  };
}

function paraElCliente(d) {
  const v = d || {};
  return {
    folio: numero(v.folio),
    destino: texto(v.destino, 160),
    salida: texto(v.salida, 40),
    regreso: texto(v.regreso, 40),
    unidad: texto(v.unidad, 80),
    unidades: numero(v.unidades),
    total: numero(v.total),
    abonado: numero(v.abonado),
    descuento: numero(v.descuento),
    /* Lo capturado y todavía sin aprobar. Sale porque el cliente que depositó
       ayer tiene que ver su depósito reflejado en algún lado, aunque la
       oficina no lo haya aprobado: si no lo ve, vuelve a pagar. */
    enRevision: numero(v.enRevision),
    saldo: numero(v.saldo),
    abonos: Array.isArray(v.abonos) ? v.abonos.slice(0, 50).map(abonoLimpio) : [],
    pdf: ligaDelPdf(v.pdf)
  };
}

/* ------------------------------------------------------------
   LA CONSULTA
   ------------------------------------------------------------
   Devuelve `{ ok:true, viaje }` o `{ ok:false, status, aviso }`.

   `status` es lo que le toca contestar a la pantalla; `aviso` es lo
   único que ve el cliente. El porqué de verdad se queda en el
   registro del servidor.
   ------------------------------------------------------------ */
async function consulta(folio, apellido) {
  const n = folioDeContrato(folio);
  const a = apellidoLimpio(apellido);

  /* Antes de gastar una llamada —y antes de darle a nadie una forma de
     hacernos tocar la puerta de EuroSystem con basura—. */
  if (!n || !a) {
    return { ok: false, status: 422,
      aviso: 'Escribe el número de contrato y un apellido para buscarlo.' };
  }

  const k = llave();
  if (!k) {
    console.error('[portal] FALTA PORTAL_API_KEY: la consulta de «Abona a tu viaje» ' +
      'está cerrada. Ponla en las variables de Vercel (la da quien administra ' +
      'EuroSystem; es distinta de CONTRATOS_API_KEY).');
    return { ok: false, status: 503, aviso: NO_AHORA };
  }

  let r;
  try {
    r = await fetch(EUROSYSTEM + PUERTA, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': k },
      body: JSON.stringify({ folio: n, apellido: a })
    });
  } catch (e) {
    console.error('[portal] no se pudo hablar con EuroSystem: ' + (e && e.message));
    return { ok: false, status: 503, aviso: NO_AHORA };
  }

  const d = await r.json().catch(function () { return {}; });

  if (r.status === 404) {
    return { ok: false, status: 404, aviso: NO_ENCONTRADO };
  }

  if (!r.ok) {
    /* El código y el detalle van al registro. Al cliente no se le cuenta que
       existe EuroSystem, ni qué llave falló: no es asunto suyo y le enseñaría
       de más a quien esté probando. */
    console.error('[portal] EuroSystem contestó ' + r.status + ' a la consulta del folio ' +
      n + ': ' + JSON.stringify(d).slice(0, 300));
    return {
      ok: false,
      status: r.status === 429 ? 429 : 503,
      aviso: r.status === 429
        ? 'Demasiadas consultas seguidas. Espera un momento y vuelve a intentar.'
        : NO_AHORA
    };
  }

  return { ok: true, viaje: paraElCliente(d) };
}

module.exports = {
  PUERTA, NO_ENCONTRADO, NO_AHORA,
  hayLlave, folioDeContrato, apellidoLimpio, paraElCliente, consulta
};
