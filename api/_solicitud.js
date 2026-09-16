/* ============================================================
   La solicitud de cotización que entra por la página
   ------------------------------------------------------------
   FASES 2 Y 3 DEL PLAN (`docs/PLAN-DE-LA-PAGINA.md`)

   Desde la fase 1, un destino que no está en el criterio no lleva
   precio: la página dice «te lo cotiza un vendedor». Hasta ahí,
   el cliente que no escribía por su cuenta **se perdía sin dejar
   rastro**.

   Esto es lo que va en su lugar, en palabras del dueño:

     «Preferiblemente que ponga el número de teléfono o correo…
      para que aquí el número de teléfono sea el que le vaya a
      mandar mensaje a él. Le va a mandar justamente la ficha de
      su viaje… y ahí es donde el vendedor va a ver ese mensaje y
      le va a lanzar la cotización con el botón de fotos de
      unidad.»

   ------------------------------------------------------------
   UNO DE LOS DOS BASTA, NO LOS DOS
   ------------------------------------------------------------
   WhatsApp **o** correo. El plan lo dice con todas sus letras —
   «cada campo de más es gente que se va»— y por eso aquí se
   valida así: falta el contacto solo si faltan LOS DOS.

   ------------------------------------------------------------
   AQUÍ NO VIVE NINGÚN PRECIO
   ------------------------------------------------------------
   Esta puerta existe justamente para los viajes que NO tienen
   precio. No calcula, no cotiza y no devuelve cifras: junta lo
   que el cliente ya escribió, se lo manda al vendedor y le
   contesta al cliente que va en camino.

   ------------------------------------------------------------
   POR QUÉ EL AVISO AL VENDEDOR SALE POR CORREO Y NO POR WHATSAPP
   ------------------------------------------------------------
   La ficha se arma con `_tickets.armaTicket`, el MISMO que usa el
   bot, para que el vendedor la lea igual que las de WhatsApp y no
   tenga que aprender nada nuevo.

   Pero mandarla POR WhatsApp no se hace desde aquí, y es a
   propósito. La única puerta de salida a WhatsApp está en
   `api/whatsapp.mjs` y lleva encima tres candados que costaron
   caro: el filtro de salida —nada con forma de código o error le
   llega a un cliente—, el freno de la CLABE ajena, y la lista
   blanca de lo que puede llegarle al teléfono del dueño. Abrir
   una segunda salida sin esos candados sería un hueco, y una
   copia de ellos se desincronizaría con la primera.

   Así que el correo es el canal de hoy —funciona, no depende del
   bot y llega igual— y el WhatsApp queda anotado como pendiente
   de la rama del bot, que es donde vive esa puerta. La ficha ya
   sale armada y lista para mandarse: `paraWhatsApp()` la entrega
   hecha.
   ============================================================ */

'use strict';

const tickets = require('./_tickets');
const correo = require('./_correo');
const tarifa = require('./_tarifa');

/* ------------------------------------------------------------
   LO QUE LLEGA SE RECORTA ANTES DE MIRARLO
   ------------------------------------------------------------
   Todo esto lo escribe el navegador, así que nada se usa tal cual
   y nada se guarda sin tope. Los largos son generosos para lo que
   una persona escribe de verdad y ridículos para quien quiera
   meter un texto largo por aquí.
   ------------------------------------------------------------ */
function texto(v, largo) {
  return String(v == null ? '' : v).replace(/\s+/g, ' ').trim().slice(0, largo);
}

/* Un correo se ve como correo o no se manda. No se intenta validar de más
   —las reglas de verdad de una dirección son un pantano— pero sí lo
   suficiente para no mandarle un correo a «no-es-correo», que es lo que
   pasaba en el paso de datos y quedó anotado en la fase 0. */
const CORREO = /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/;

function correoLimpio(v) {
  const t = texto(v, 120).toLowerCase();
  return CORREO.test(t) ? t : '';
}

/* ------------------------------------------------------------
   UN TELÉFONO DE MÉXICO SON DIEZ DÍGITOS
   ------------------------------------------------------------
   Se aceptan los adornos con los que la gente los escribe —
   espacios, guiones, paréntesis, el +52 de adelante— y se guarda
   nada más el número. Diez dígitos, o doce con el 52.

   Un teléfono mal escrito no es un detalle de forma: es el único
   hilo que queda con este cliente. En la fase 0 se vio que el
   formulario aceptaba «12» como teléfono y lo dejaba pasar hasta
   el resumen.
   ------------------------------------------------------------ */
function telefonoLimpio(v) {
  let d = String(v == null ? '' : v).replace(/\D/g, '');
  if (d.length === 13 && d.slice(0, 3) === '521') d = d.slice(3);   // +52 1, el viejo de WhatsApp
  if (d.length === 12 && d.slice(0, 2) === '52') d = d.slice(2);
  if (d.length === 11 && d[0] === '1') d = d.slice(1);
  return d.length === 10 ? d : '';
}

/* ------------------------------------------------------------
   LA SOLICITUD, LIMPIA
   ------------------------------------------------------------
   Devuelve `{ ok: true, solicitud }` o `{ ok: false, error, aviso }`.
   `aviso` es lo que se le puede enseñar al cliente; `error`, lo que
   va al registro.
   ------------------------------------------------------------ */
function revisa(cuerpo) {
  const c = cuerpo || {};

  const telefono = telefonoLimpio(c.telefono);
  const email = correoLimpio(c.correo);

  /* Uno de los dos basta. Si mandó los dos y uno está mal escrito, se usa
     el que sí sirve en vez de rechazarle la solicitud entera: el cliente
     quería que le escribieran, no aprobar un examen de formato. */
  if (!telefono && !email) {
    /* Se distingue «no puso nada» de «lo puso mal», porque son dos cosas
       distintas para quien está del otro lado de la pantalla. */
    const intento = texto(c.telefono, 40) || texto(c.correo, 120);
    return {
      ok: false,
      error: intento ? 'contacto ilegible' : 'sin contacto',
      aviso: intento
        ? 'Ese dato no se entiende. El WhatsApp va a diez dígitos y el correo lleva arroba.'
        : 'Déjanos tu WhatsApp o tu correo y te mandamos el precio.'
    };
  }

  const destino = texto(c.destino, 160);
  if (!destino) {
    return { ok: false, error: 'sin destino', aviso: 'Falta a dónde van.' };
  }

  const salida = texto(c.salida, 25);
  const regreso = texto(c.regreso, 25);

  const solicitud = {
    nombre: texto(c.nombre, 80),
    telefono: telefono,
    correo: email,
    origen: texto(c.origen, 160),
    destino: destino,
    salida: salida,
    regreso: regreso,
    /* LOS DÍAS LOS CUENTA EL SERVIDOR, con el mismo contador que usa el
       cotizador y el cobro. La pantalla no los manda, y es a propósito: un
       segundo contador en el navegador es una segunda cuenta que se puede
       separar de la primera, y el vendedor cotiza con este número. */
    dias: salida ? tarifa.diasDeServicio(salida, regreso) : 0,
    unidad: texto(c.unidad, 60),
    /* La pantalla los manda como `pasajeros` desde el 15-sep-2026 (el mismo
       nombre que en /api/pagar); `gente` se queda por quien ya lo mandaba.
       Aquí NO se rechaza por capacidad: es una solicitud, no un cobro, y un
       grupo de 60 que escogió un camión de 51 es justo lo que el vendedor
       tiene que leer para ofrecerle dos. */
    gente: Math.max(0, Math.min(200, Math.floor(Number(c.pasajeros != null && c.pasajeros !== '' ? c.pasajeros : c.gente) || 0))),
    notas: texto(c.notas, 400),

    /* ------------------------------------------------------------
       LO QUE EL CLIENTE YA HABÍA ESCRITO Y NO LLEGABA · 15-sep-2026
       ------------------------------------------------------------
       Lo pidió el dueño: los camiones y la Suburban los cotiza una
       persona, y esa persona cotiza CON LO QUE TENGA. Media docena
       de datos que el cliente ya había tecleado en la pantalla se
       quedaban en el navegador, así que el vendedor tenía que
       volver a preguntarlos por WhatsApp —o cotizar a ojo—.

       Nada de esto se inventa: cada campo sale de un campo que la
       pantalla YA tiene. Los que no existen en ninguna pantalla no
       se agregaron.
       ------------------------------------------------------------ */

    /* Solo ida o redondo. Cambia el precio entero y no se deduce del
       regreso vacío: un regreso sin llenar puede ser un redondo a medio
       capturar. Se manda explícito. `redondo` llega como booleano; si no
       llega, se cae del lado de lo normal —redondo— y la ficha se calla. */
    redondo: c.redondo === false ? false : true,

    /* De dónde se recoge al grupo. El vendedor arma el servicio con esto:
       una ciudad no le dice a qué hora tiene que salir la unidad. */
    calle: texto(c.calle, 160),
    colonia: texto(c.colonia, 80),
    referencia: texto(c.referencia, 160),

    /* Si se mueven allá, y a dónde. Son días de servicio que se cobran, y
       el cliente ya los capturó en el paso de datos. */
    movimientos: Math.max(0, Math.min(60, Math.floor(Number(c.movimientos) || 0))),
    notasMovimientos: texto(c.notasMovimientos, 400)
  };

  return { ok: true, solicitud: solicitud };
}

/* ------------------------------------------------------------
   CÓMO SE LEE UNA FECHA
   ------------------------------------------------------------
   `2026-09-20T08:00` → «20 sep 2026, 08:00». Se arma a mano y no
   con `Date`: un `new Date('2026-09-20')` se interpreta en UTC y
   en México sale el día 19. Es el mismo cuidado que hay en el
   resto del proyecto.
   ------------------------------------------------------------ */
const MES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun',
  'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

function comoSeLee(iso) {
  const t = String(iso || '');
  const m = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2}))?/.exec(t);
  if (!m) return t;
  const dia = Number(m[3]), mes = MES[Number(m[2]) - 1] || '?', ano = m[1];
  const hora = m[4] ? ', ' + m[4] + ':' + m[5] : '';
  return dia + ' ' + mes + ' ' + ano + hora;
}

/* ------------------------------------------------------------
   LA FICHA DEL VIAJE, PARA EL VENDEDOR
   ------------------------------------------------------------
   Se arma con `_tickets.armaTicket`, el mismo del bot: el vendedor
   ve el mismo formato que lleva leyendo desde que existe el bot, y
   sus botones de siempre —incluido el de mandar fotos de la unidad—
   siguen sirviendo porque el ticket es el de siempre.

   Lo único que se le agrega es de dónde vino, porque un viaje que
   entró por la página no se contesta igual que uno de WhatsApp: a
   éste hay que escribirle primero.
   ------------------------------------------------------------ */
function fichaParaElVendedor(s) {
  /* `armaTicket` espera las fechas como `aaaa-mm-dd` pelón —así se las manda
     el bot— y la página las trae con hora pegada (`…T08:00`). Sin recortar,
     el ticket salía con la fecha cruda, que es justo lo que el vendedor no
     tiene por qué leer. La hora no se pierde: va abajo, en la ficha del
     cliente, donde sí cabe. */
  const soloDia = function (iso) { return String(iso || '').slice(0, 10); };

  const base = tickets.armaTicket({
    origen: s.origen || '?',
    destino: s.destino,
    salida: soloDia(s.salida),
    regreso: soloDia(s.regreso),
    dias: s.dias || '?',
    unidadNombre: s.unidad,
    gente: s.gente,
    /* Los días con movimiento ya venían con su renglón en el ticket del bot
       —«🔁 2 días con movimiento»— y aquí se mandaba un cero fijo, así que
       el vendedor leía «Sin movimientos» de un grupo que sí se mueve. */
    movimientos: s.movimientos || 0,
    cliente: s.telefono || s.correo
  });

  const cola = ['', '🌐 *Entró por la página*, no por WhatsApp.'];

  /* ------------------------------------------------------------
     LA COLA DE LA FICHA · lo que solo tiene un viaje de la página
     ------------------------------------------------------------
     La lee UNA PERSONA EN UN TELÉFONO, a lo mejor entre dos
     llamadas. Un renglón por dato, y ninguno si no hay nada que
     decir: seis renglones vacíos se leen peor que una ficha corta.
     ------------------------------------------------------------ */

  /* Solo ida va con aviso propio porque cambia el precio entero y el ticket
     de arriba, con un regreso vacío, se lee igual que un redondo a medias.
     El redondo no se dice: es lo normal, y sus dos fechas ya salen. */
  if (s.redondo === false) cola.push('➡️ *Solo ida*, no hay regreso.');
  /* La hora sí importa para armar el servicio, y en el ticket de arriba no
     cabe: va aquí, con el resto de lo que solo tiene un viaje de la página. */
  if (/T\d{2}:\d{2}/.test(String(s.salida))) {
    cola.push('🕗 Sale ' + comoSeLee(s.salida) +
      (s.regreso ? ' · regresa ' + comoSeLee(s.regreso) : ''));
  }
  /* Dónde se recoge al grupo, en un solo renglón: son tres campos cortos y
     tres renglones para una dirección es desarmarla para volverla a armar. */
  const donde = [s.calle, s.colonia ? 'Col. ' + s.colonia : '', s.referencia ? 'Ref: ' + s.referencia : '']
    .filter(function (t) { return t; });
  if (donde.length) cola.push('📌 Recoger en: ' + donde.join(' · '));

  /* A dónde van los días que se mueven. El «cuántos días» ya salió arriba,
     en el renglón de siempre del ticket. */
  if (s.notasMovimientos) cola.push('🗺️ En el destino: ' + s.notasMovimientos);

  cola.push(s.nombre ? '🙋 ' + s.nombre : '🙋 No dejó nombre');
  if (s.telefono) cola.push('📱 WhatsApp: ' + s.telefono);
  if (s.correo) cola.push('✉️ Correo: ' + s.correo);
  if (s.notas) cola.push('📝 ' + s.notas);
  cola.push('');
  cola.push(s.telefono
    ? 'Escríbele tú: este cliente todavía no tiene conversación abierta.'
    : 'Contéstale por correo: no dejó WhatsApp.');

  return base + '\n' + cola.join('\n');
}

/* ------------------------------------------------------------
   EL MENSAJE QUE LE LLEGA AL CLIENTE
   ------------------------------------------------------------
   Corto, con su viaje adentro para que reconozca de qué se trata,
   y sin prometer una hora exacta. Es el del plan, palabra por
   palabra:

     Recibimos tu solicitud 🚐
     Guadalajara → San Miguel de Allende
     20 al 23 de diciembre · 40 personas · autobús
     Te mandamos tu cotización en breve.
   ------------------------------------------------------------ */
function acuseParaElCliente(s) {
  const l = [];
  l.push('Recibimos tu solicitud 🚐');
  l.push('');
  l.push((s.origen || '?') + ' → ' + s.destino);

  const cuando = [comoSeLee(s.salida)];
  if (s.regreso) cuando.push('al ' + comoSeLee(s.regreso));
  const detalle = [cuando.join(' ')];
  if (s.gente) detalle.push(s.gente + (s.gente === 1 ? ' persona' : ' personas'));
  if (s.unidad) detalle.push(s.unidad);
  l.push(detalle.join(' · '));

  l.push('');
  l.push('Te mandamos tu cotización en breve.');
  return l.join('\n');
}

/* Lo mismo, listo para mandarse por WhatsApp el día que la rama del bot
   abra ese camino. Se deja hecho aquí —y no allá— para que el texto que
   lee el cliente sea uno solo, venga por donde venga. */
function paraWhatsApp(s) {
  return {
    alCliente: s.telefono ? { para: s.telefono, texto: acuseParaElCliente(s) } : null,
    alVendedor: { texto: fichaParaElVendedor(s), esTicket: true }
  };
}

/* ------------------------------------------------------------
   MANDAR LOS DOS AVISOS
   ------------------------------------------------------------
   Devuelve qué salió y qué no. NUNCA lanza: una solicitud que se
   recibió bien y no se pudo avisar sigue siendo una solicitud
   recibida, y lo que no puede pasar es que el cliente vea un error
   después de haber dejado sus datos.

   El del vendedor es el que importa: si ése falla, el viaje se
   perdió de verdad. Por eso se manda primero y su fallo se grita
   en el registro.
   ------------------------------------------------------------ */
async function avisa(s) {
  const salida = { alVendedor: false, alCliente: false, porQue: '' };

  try {
    const r = await correo.mandaALaOficina(
      'Cotización por la página · ' + (s.origen || '?') + ' → ' + s.destino,
      fichaParaElVendedor(s));
    salida.alVendedor = !!(r && r.ok);
    if (!salida.alVendedor) {
      salida.porQue = (r && r.motivo) || 'sin detalle';
      console.error('[solicitud] NO SE PUDO AVISAR AL VENDEDOR (' + salida.porQue +
        '). La solicitud se pierde si nadie mira el registro: ' +
        (s.telefono || s.correo) + ' · ' + (s.origen || '?') + ' → ' + s.destino);
    }
  } catch (e) {
    salida.porQue = 'excepción al mandar el aviso';
    console.error('[solicitud] NO SE PUDO AVISAR AL VENDEDOR (excepción): ' + e.message);
  }

  /* Al cliente solo por correo, y solo si dejó uno. El WhatsApp sale por la
     rama del bot; mientras tanto el acuse que sí ve es el de la pantalla,
     que es el que el plan pidió que nunca faltara. */
  if (s.correo) {
    try {
      const r = await correo.manda({
        from: correo.DE,
        to: [s.correo],
        subject: 'Recibimos tu solicitud · ' + (s.origen || '?') + ' → ' + s.destino,
        text: acuseParaElCliente(s)
      });
      salida.alCliente = !!(r && r.ok);
    } catch (e) {
      console.error('[solicitud] no se le pudo escribir al cliente: ' + e.message);
    }
  }

  return salida;
}

module.exports = {
  revisa, avisa,
  fichaParaElVendedor, acuseParaElCliente, paraWhatsApp,
  telefonoLimpio, correoLimpio, comoSeLee
};
