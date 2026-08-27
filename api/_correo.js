/* ============================================================
   El correo al cliente, en un solo dueño
   ------------------------------------------------------------
   Hasta hoy el cliente pagaba su anticipo y NO recibía nada. La
   pantalla le decía «te mandamos el folio y las instrucciones» y
   era mentira: no había una sola línea que mandara correo.

   Esto lo cierra.

   POR QUE RESEND POR SU API, CON `fetch`

   Sin instalar nada y sin paso de compilación, como el resto de
   la página. Esta carpeta no tiene dependencias y no las va a
   tener por un correo.

   LA REGLA DEL KILOMETRO TAMBIEN VALE AQUI

   La metadata de Stripe TRAE `km`. Este archivo arma el mensaje a
   partir de esa metadata, así que es un camino nuevo por donde el
   kilometraje se puede escapar —y esta vez a un correo, que se
   guarda, se reenvía y se imprime—. Por eso el mensaje se arma
   por LISTA BLANCA: se nombra campo por campo lo que entra, y lo
   que no está nombrado no sale. Hay prueba que lo vigila.

   El nombre empieza con guion bajo para que Vercel no lo publique
   como una dirección más del sitio.
   ============================================================ */

const RESEND = 'https://api.resend.com/emails';

/* De quién sale. Se puede cambiar sin tocar código, pero el valor por
   omisión es el bueno para Eurotravel.

   OJO CON EL DOMINIO: mientras `eurotravel.com.mx` no esté verificado en
   Resend, Resend solo entrega al dueño de la cuenta y RECHAZA cualquier otro
   destinatario. El envío muere con un 4xx y parece que el código está roto.
   Está dicho en el diagnóstico y en el README. */
const DE = process.env.RESEND_DE || 'Eurotravel <ventas@eurotravel.com.mx>';

function clave() { return (process.env.RESEND_API_KEY || '').trim(); }
function hayClave() { return clave().length > 0; }

/* Para el diagnóstico y para los registros: por qué no se puede mandar. */
function porQueNoSePuede() {
  if (!hayClave()) return 'Falta RESEND_API_KEY en Vercel.';
  return '';
}

/* ------------------------------------------------------------
   POR QUE NO SALIO, EN CASTELLANO Y CON LO QUE HAY QUE HACER
   ------------------------------------------------------------
   Resend contesta en inglés y con el detalle enterrado en un JSON.
   Quien configura esto no es programador: necesita leer qué pasó y
   qué botón tocar, no un código de estado.

   Son las fallas que de verdad ocurren al configurar. La primera es
   la que más confunde, porque el correo parece bien puesto y aun
   así rebota: el remitente de prueba de Resend SOLO entrega a la
   dirección de la cuenta, y a nadie más.
   ------------------------------------------------------------ */
function pistaDelFallo(motivo) {
  const m = String(motivo || '');

  if (/Falta RESEND_API_KEY/i.test(m)) {
    return 'Falta la variable RESEND_API_KEY en Vercel.';
  }
  if (/only send testing emails/i.test(m)) {
    return 'Estás usando el remitente de prueba de Resend (resend.dev), que SOLO entrega ' +
      'al correo de tu propia cuenta de Resend. Pon AVISOS_A exactamente igual a ese ' +
      'correo, o verifica el dominio para poder mandarle a cualquiera.';
  }
  if (/not verified|domain/i.test(m)) {
    return 'El dominio de RESEND_DE no está verificado en Resend. Mientras tanto usa ' +
      'RESEND_DE=Eurotravel <onboarding@resend.dev>, que funciona sin verificar nada ' +
      'pero solo te escribe a ti.';
  }
  /* El 422 va ANTES que el de la llave: Resend lo describe como «Invalid
     `from` field», y una rama que buscara «invalid» se lo tragaba y mandaba a
     cambiar una llave que estaba perfecta. */
  if (/\b422\b/.test(m)) {
    return 'RESEND_DE está mal escrito. Tiene que ser así: Eurotravel <algo@dominio.mx>.';
  }
  if (/\b401\b|\b403\b|API key|restricted/i.test(m)) {
    return 'La RESEND_API_KEY no sirve o no tiene permiso de enviar. Genera otra en ' +
      'Resend y ponla en Vercel.';
  }
  if (/sin conexión con Resend/i.test(m)) {
    return 'No se pudo hablar con Resend. Puede ser pasajero: vuelve a intentarlo.';
  }
  return '';
}

const pesos = new Intl.NumberFormat('es-MX', {
  style: 'currency', currency: 'MXN', maximumFractionDigits: 0
});

/* Escapa lo que va dentro del HTML. TODO lo que viene de la metadata lo
   escribió una persona en un formulario: un nombre con `<` no puede romper el
   mensaje ni meter etiquetas. */
function esc(t) {
  return String(t == null ? '' : t).replace(/[&<>"']/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
  });
}

/* «2026-09-03T08:00» -> «3 de septiembre de 2026, 08:00».
   Se parte el texto a mano en vez de construir un Date: `new Date('2026-09-03')`
   es medianoche UTC, o sea las 18:00 del día anterior en Tlaquepaque, y el
   correo diría un día antes. Es la regla 7 de `antes-de-escribir`. */
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

function fechaLarga(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2}))?/.exec(String(iso || ''));
  if (!m) return '';
  const dia = Number(m[3]), mes = MESES[Number(m[2]) - 1], anio = m[1];
  if (!mes) return '';
  return dia + ' de ' + mes + ' de ' + anio + (m[4] ? ', ' + m[4] + ':' + m[5] : '');
}

/* ------------------------------------------------------------
   QUE ENTRA AL MENSAJE
   ------------------------------------------------------------
   Lista blanca, no lista negra. La metadata de Stripe trae `km`,
   `nochesExtra`, `importeNoches` y más: nada de eso está aquí, y
   nada de eso puede entrar por descuido porque este objeto se
   arma nombrando campo por campo.

   Agregar un renglón aquí es una decisión. Antes de hacerlo, la
   misma pregunta de `_publico.js`: ¿con esto y el total en la
   mano, se puede deducir una tarifa?
   ------------------------------------------------------------ */
function datosDelCorreo(m) {
  const d = m || {};
  return {
    folio: String(d.folio || '').slice(0, 20),
    /* El número de contrato de EuroSystem. Va aparte del folio y en chico:
       el folio es el que el cliente ya vio en pantalla al pagar y el que va a
       dictar por teléfono; el contrato es el que aparece en el PDF adjunto y
       tiene que poder reconocerlo cuando lo abra. */
    contrato: String(d.contrato || '').slice(0, 20),
    nombre: String(d.nombre || '').slice(0, 80),
    correo: String(d.correo || '').trim().toLowerCase().slice(0, 160),
    ruta: String(d.ruta || '').slice(0, 90),
    origen: String(d.origen || '').slice(0, 160),
    destino: String(d.destino || '').slice(0, 160),
    unidad: String(d.unidad || '').slice(0, 60),
    salida: String(d.salida || '').slice(0, 25),
    regreso: String(d.regreso || '').slice(0, 25),
    dias: String(d.dias || '').slice(0, 4),
    puntoSalida: String(d.puntoSalida || '').slice(0, 200),
    total: Number(d.total) || 0,
    anticipo: Number(d.anticipo) || 0,
    saldo: Number(d.saldo) || 0
  };
}

/* ------------------------------------------------------------
   EL MENSAJE
   ------------------------------------------------------------
   Se arma aparte de mandarlo para poder probarlo sin red. Devuelve
   lo que Resend espera, ya listo.
   ------------------------------------------------------------ */
function mensajeDeContrato(metadata, pdfBase64, liga) {
  const d = datosDelCorreo(metadata);
  const salida = fechaLarga(d.salida);
  const regreso = fechaLarga(d.regreso);

  const renglon = function (etiqueta, valor) {
    if (!valor) return '';
    return '<tr><td style="padding:7px 0;color:#6e6e6a;font-size:14px;white-space:nowrap;' +
      'vertical-align:top">' + esc(etiqueta) + '</td>' +
      '<td style="padding:7px 0 7px 18px;font-size:14px;color:#1d1d1b">' + esc(valor) + '</td></tr>';
  };

  const html =
    '<div style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;' +
    'max-width:560px;margin:0 auto;color:#1d1d1b;line-height:1.55">' +

      '<p style="font-size:15px;margin:0 0 18px">' +
        (d.nombre ? 'Hola ' + esc(d.nombre.split(/\s+/)[0]) + ',' : 'Hola,') +
      '</p>' +
      '<p style="font-size:15px;margin:0 0 24px">Recibimos tu anticipo. ' +
        '<b>Tu viaje ya está apartado.</b></p>' +

      /* El folio, grande: es lo que le van a pedir cuando llame */
      '<div style="border:2px solid #1d1d1b;border-radius:12px;padding:18px 20px;margin:0 0 24px">' +
        '<div style="font-size:11px;letter-spacing:.12em;text-transform:uppercase;' +
          'color:#db0d0d;font-weight:700">Tu folio</div>' +
        '<div style="font-size:27px;font-weight:700;letter-spacing:.04em;margin-top:4px">' +
          esc(d.folio || '—') + '</div>' +
        '<div style="font-size:12.5px;color:#6e6e6a;margin-top:6px">' +
          'Ténlo a la mano para cualquier aclaración.' +
          (d.contrato ? ' Contrato ' + esc(d.contrato) + '.' : '') + '</div>' +
      '</div>' +

      '<table style="width:100%;border-collapse:collapse;margin:0 0 8px">' +
        renglon('Pagaste hoy', pesos.format(d.anticipo)) +
        renglon('Queda por abonar', pesos.format(d.saldo)) +
        '<tr><td colspan="2" style="border-top:1px solid #e6e6e3;padding-top:10px"></td></tr>' +
        renglon('Total del viaje', pesos.format(d.total) + ' · IVA incluido') +
      '</table>' +

      '<h2 style="font-size:12px;letter-spacing:.1em;text-transform:uppercase;color:#6e6e6a;' +
        'margin:28px 0 6px">Tu viaje</h2>' +
      '<table style="width:100%;border-collapse:collapse">' +
        renglon('Sale de', d.origen) +
        renglon('Va a', d.destino) +
        renglon('Salida', salida) +
        renglon('Regreso', regreso) +
        renglon('Días de servicio', d.dias) +
        renglon('Unidad', d.unidad) +
        renglon('Dónde los recogemos', d.puntoSalida) +
      '</table>' +

      (pdfBase64
        ? '<p style="font-size:14px;color:#6e6e6a;margin:26px 0 0">' +
            'Tu contrato va adjunto en este correo, en PDF. Guárdalo.</p>'
        : '') +

      /* La liga propia del cliente. Si no hay `LIGAS_SECRETO` configurado no
         se puede firmar y el botón simplemente no va: vale más un correo con
         el folio que ningún correo. */
      (liga
        ? '<p style="margin:26px 0 0"><a href="' + esc(liga) + '" ' +
            'style="display:inline-block;background:#db0d0d;color:#fff;text-decoration:none;' +
            'font-weight:600;font-size:15px;padding:13px 26px;border-radius:8px">' +
            'Ver mi viaje</a></p>' +
          '<p style="font-size:12.5px;color:#6e6e6a;margin:9px 0 0">' +
            'Esta liga es tuya: desde ahí ves cómo va tu viaje y descargas tu contrato ' +
            'cuando quieras. No la compartas.</p>'
        : '') +

      '<p style="font-size:14px;margin:26px 0 0">Para abonar el resto o cambiar algo, ' +
        'contéstanos este correo o escríbenos por WhatsApp al ' +
        '<a href="https://wa.me/523324002285" style="color:#db0d0d">33 2400 2285</a>.</p>' +

      '<p style="font-size:12.5px;color:#6e6e6a;margin:28px 0 0;padding-top:16px;' +
        'border-top:1px solid #e6e6e3">Eurotravel · San Pedro Tlaquepaque, Jalisco<br>' +
        'Recibiste este correo porque apartaste un viaje con nosotros.</p>' +
    '</div>';

  /* Versión en texto: algunos clientes de correo no pintan HTML, y sin esto
     verían un mensaje vacío. */
  /* Los renglones que dependen de un dato van como `null` cuando ese dato no
     existe, y `null` es lo que se cae. Las cadenas vacías se QUEDAN: son los
     renglones en blanco que separan los bloques. La primera versión filtraba
     `''` y el mensaje salía como un muro de texto sin respirar. */
  const texto = [
    (d.nombre ? 'Hola ' + d.nombre.split(/\s+/)[0] + ',' : 'Hola,'),
    '',
    'Recibimos tu anticipo. Tu viaje ya está apartado.',
    '',
    'TU FOLIO: ' + (d.folio || '—'),
    'Ténlo a la mano para cualquier aclaración.' +
      (d.contrato ? ' Contrato ' + d.contrato + '.' : ''),
    '',
    'Pagaste hoy:      ' + pesos.format(d.anticipo),
    'Queda por abonar: ' + pesos.format(d.saldo),
    'Total del viaje:  ' + pesos.format(d.total) + ' (IVA incluido)',
    '',
    'TU VIAJE',
    d.origen ? 'Sale de:             ' + d.origen : null,
    d.destino ? 'Va a:                ' + d.destino : null,
    salida ? 'Salida:              ' + salida : null,
    regreso ? 'Regreso:             ' + regreso : null,
    d.dias ? 'Días de servicio:    ' + d.dias : null,
    d.unidad ? 'Unidad:              ' + d.unidad : null,
    d.puntoSalida ? 'Dónde los recogemos: ' + d.puntoSalida : null,
    '',
    pdfBase64 ? 'Tu contrato va adjunto en este correo, en PDF. Guárdalo.' : null,
    pdfBase64 ? '' : null,
    liga ? 'VER TU VIAJE — esta liga es tuya, no la compartas:' : null,
    liga ? liga : null,
    liga ? '' : null,
    'Para abonar el resto o cambiar algo, contesta este correo o escríbenos',
    'por WhatsApp al 33 2400 2285.',
    '',
    '—',
    'Eurotravel · San Pedro Tlaquepaque, Jalisco',
    'Recibiste este correo porque apartaste un viaje con nosotros.'
  ].filter(function (l) { return l !== null; }).join('\n');

  const mensaje = {
    from: DE,
    to: [d.correo],
    subject: 'Tu viaje está apartado · folio ' + (d.folio || ''),
    html: html,
    text: texto
  };

  if (pdfBase64) {
    mensaje.attachments = [{
      filename: 'contrato-' + (d.folio || 'eurotravel') + '.pdf',
      content: pdfBase64
    }];
  }
  return mensaje;
}

/* ------------------------------------------------------------
   MANDARLO
   ------------------------------------------------------------
   Devuelve `{ ok: true }`, o `{ ok:false, motivo, reintentar }`.

   `reintentar` es la parte que importa, y separa dos mundos:

     · un 4xx de Resend NO se arregla reintentando —dominio sin
       verificar, clave mala, destinatario rechazado—. Reintentar
       tres días sería tener a Stripe golpeando una puerta que no
       va a abrir.
     · un 5xx o un fallo de red SI: es pasajero.

   Quien llama usa eso para decidir si le pide a Stripe que
   vuelva a avisar.
   ------------------------------------------------------------ */
async function manda(mensaje) {
  if (!hayClave()) return { ok: false, motivo: porQueNoSePuede(), reintentar: false };
  if (!mensaje || !mensaje.to || !mensaje.to[0]) {
    return { ok: false, motivo: 'sin destinatario', reintentar: false };
  }

  let r;
  try {
    r = await fetch(RESEND, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + clave() },
      body: JSON.stringify(mensaje)
    });
  } catch (e) {
    return { ok: false, motivo: 'sin conexión con Resend', reintentar: true };
  }

  if (r.ok) {
    const d = await r.json().catch(function () { return {}; });
    return { ok: true, id: d.id || '' };
  }

  const d = await r.json().catch(function () { return {}; });
  const motivo = 'Resend contestó ' + r.status + ': ' +
    String((d && (d.message || d.name)) || 'sin detalle').slice(0, 200);
  return { ok: false, motivo: motivo, reintentar: r.status >= 500 };
}

/* ------------------------------------------------------------
   EL CODIGO PARA ENTRAR A SU VIAJE
   ------------------------------------------------------------
   Corto a propósito. Este correo se lee en la pantalla de
   notificaciones del teléfono, con el navegador abierto en la
   otra mano: lo único que importa es que el número se vea sin
   tener que abrirlo.

   Por eso el código va TAMBIEN en el asunto.
   ------------------------------------------------------------ */
function mensajeDeCodigo(aDonde, codigo, nombre, folio) {
  const quien = String(nombre || '').trim().split(/\s+/)[0];
  const c = String(codigo || '');

  const html =
    '<div style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;' +
    'max-width:440px;margin:0 auto;color:#1d1d1b;line-height:1.55">' +
      '<p style="font-size:15px;margin:0 0 20px">' +
        (quien ? 'Hola ' + esc(quien) + ',' : 'Hola,') + '</p>' +
      '<p style="font-size:15px;margin:0 0 22px">Este es tu código para entrar a tu viaje' +
        (folio ? ' <b>' + esc(folio) + '</b>' : '') + ':</p>' +
      '<div style="border:2px solid #1d1d1b;border-radius:12px;padding:20px;text-align:center">' +
        '<div style="font-size:38px;font-weight:700;letter-spacing:.22em;' +
          'font-variant-numeric:tabular-nums">' + esc(c) + '</div>' +
      '</div>' +
      '<p style="font-size:13.5px;color:#6e6e6a;margin:20px 0 0">' +
        'Vence en 10 minutos y sirve una sola vez. ' +
        '<b>Si no lo pediste tú, no lo compartas con nadie</b> — alguien tiene tu liga.</p>' +
      '<p style="font-size:12.5px;color:#6e6e6a;margin:26px 0 0;padding-top:16px;' +
        'border-top:1px solid #e6e6e3">Eurotravel · San Pedro Tlaquepaque, Jalisco</p>' +
    '</div>';

  const texto = [
    (quien ? 'Hola ' + quien + ',' : 'Hola,'),
    '',
    'Tu código para entrar a tu viaje' + (folio ? ' ' + folio : '') + ':',
    '',
    '    ' + c,
    '',
    'Vence en 10 minutos y sirve una sola vez.',
    'Si no lo pediste tú, no lo compartas con nadie: alguien tiene tu liga.',
    '',
    'Eurotravel · San Pedro Tlaquepaque, Jalisco'
  ].join('\n');

  return {
    from: DE,
    to: [String(aDonde || '').trim().toLowerCase()],
    /* El código en el asunto: se lee desde la notificación, sin abrir nada. */
    subject: c + ' es tu código para entrar a tu viaje',
    html: html,
    text: texto
  };
}

/* ------------------------------------------------------------
   EL CODIGO PARA CONFIRMAR UNA CUENTA NUEVA
   ------------------------------------------------------------
   Se parece al de arriba pero NO es el mismo, y la diferencia es
   el aviso del final. Aquel dice «si no lo pediste tú, alguien
   tiene tu liga», que ahí es cierto y da miedo con razón. Aquí no:
   quien recibe esto puede ser alguien que ni sabe que existimos,
   porque otro escribió su correo al registrarse. A ése hay que
   decirle que no haga nada y ya.

   Una alarma que asusta a quien no corre peligro se vuelve ruido, y
   el día que importe nadie la lee.
   ------------------------------------------------------------ */
function mensajeDeCuenta(aDonde, codigo, nombre) {
  const quien = String(nombre || '').trim().split(/\s+/)[0];
  const c = String(codigo || '');

  const html =
    '<div style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;' +
    'max-width:440px;margin:0 auto;color:#1d1d1b;line-height:1.55">' +
      '<p style="font-size:15px;margin:0 0 20px">' +
        (quien ? 'Hola ' + esc(quien) + ',' : 'Hola,') + '</p>' +
      '<p style="font-size:15px;margin:0 0 22px">Confirma tu correo con este código ' +
        'y tu cuenta de Eurotravel queda lista:</p>' +
      '<div style="border:2px solid #1d1d1b;border-radius:12px;padding:20px;text-align:center">' +
        '<div style="font-size:38px;font-weight:700;letter-spacing:.22em;' +
          'font-variant-numeric:tabular-nums">' + esc(c) + '</div>' +
      '</div>' +
      '<p style="font-size:13.5px;color:#6e6e6a;margin:20px 0 0">' +
        'Vence en 10 minutos. Si no fuiste tú quien se registró, ' +
        'no tienes que hacer nada: sin este código la cuenta no se abre.</p>' +
      '<p style="font-size:12.5px;color:#6e6e6a;margin:26px 0 0;padding-top:16px;' +
        'border-top:1px solid #e6e6e3">Eurotravel · San Pedro Tlaquepaque, Jalisco</p>' +
    '</div>';

  const texto = [
    (quien ? 'Hola ' + quien + ',' : 'Hola,'),
    '',
    'Confirma tu correo con este código y tu cuenta de Eurotravel queda lista:',
    '',
    '    ' + c,
    '',
    'Vence en 10 minutos.',
    'Si no fuiste tú quien se registró, no tienes que hacer nada:',
    'sin este código la cuenta no se abre.',
    '',
    'Eurotravel · San Pedro Tlaquepaque, Jalisco'
  ].join('\n');

  return {
    from: DE,
    to: [String(aDonde || '').trim().toLowerCase()],
    subject: c + ' es tu código para confirmar tu cuenta',
    html: html,
    text: texto
  };
}

/* ------------------------------------------------------------
   EL CODIGO PARA RECUPERAR LA CONTRASEÑA
   ------------------------------------------------------------
   Tercer correo con código, y otra vez el aviso del final es lo
   que cambia. Los otros dos van a alguien que puede no tener
   cuenta; éste va SIEMPRE al dueño de una cuenta que existe.

   Por eso aquí sí se avisa con firmeza: si él no lo pidió,
   alguien está intentando entrar a su cuenta. No es alarma de
   más, es lo único que le va a llegar de ese intento.

   Y se le dice lo que de verdad importa: que su contraseña NO
   cambió. Sin esa línea, quien recibe esto sin haberlo pedido
   asume lo peor y llama asustado.
   ------------------------------------------------------------ */
function mensajeDeClaveNueva(aDonde, codigo, nombre) {
  const quien = String(nombre || '').trim().split(/\s+/)[0];
  const c = String(codigo || '');

  const html =
    '<div style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;' +
    'max-width:440px;margin:0 auto;color:#1d1d1b;line-height:1.55">' +
      '<p style="font-size:15px;margin:0 0 20px">' +
        (quien ? 'Hola ' + esc(quien) + ',' : 'Hola,') + '</p>' +
      '<p style="font-size:15px;margin:0 0 22px">Con este código puedes poner ' +
        'una contraseña nueva en tu cuenta de Eurotravel:</p>' +
      '<div style="border:2px solid #1d1d1b;border-radius:12px;padding:20px;text-align:center">' +
        '<div style="font-size:38px;font-weight:700;letter-spacing:.22em;' +
          'font-variant-numeric:tabular-nums">' + esc(c) + '</div>' +
      '</div>' +
      '<p style="font-size:13.5px;color:#6e6e6a;margin:20px 0 0">Vence en 10 minutos.</p>' +
      '<p style="font-size:13.5px;color:#6e6e6a;margin:12px 0 0">' +
        '<b>Si no lo pediste tú, alguien está intentando entrar a tu cuenta.</b> ' +
        'Tu contraseña NO cambió y sigue sirviendo: sin este código nadie puede ' +
        'cambiarla. Si te preocupa, escríbenos.</p>' +
      '<p style="font-size:12.5px;color:#6e6e6a;margin:26px 0 0;padding-top:16px;' +
        'border-top:1px solid #e6e6e3">Eurotravel · San Pedro Tlaquepaque, Jalisco</p>' +
    '</div>';

  const texto = [
    (quien ? 'Hola ' + quien + ',' : 'Hola,'),
    '',
    'Con este código puedes poner una contraseña nueva en tu cuenta de Eurotravel:',
    '',
    '    ' + c,
    '',
    'Vence en 10 minutos.',
    '',
    'Si no lo pediste tú, alguien está intentando entrar a tu cuenta.',
    'Tu contraseña NO cambió y sigue sirviendo: sin este código nadie',
    'puede cambiarla. Si te preocupa, escríbenos.',
    '',
    'Eurotravel · San Pedro Tlaquepaque, Jalisco'
  ].join('\n');

  return {
    from: DE,
    to: [String(aDonde || '').trim().toLowerCase()],
    subject: c + ' es tu código para cambiar tu contraseña',
    html: html,
    text: texto
  };
}

async function mandaCodigoDeClave(aDonde, codigo, nombre) {
  return manda(mensajeDeClaveNueva(aDonde, codigo, nombre));
}

async function mandaCodigoDeCuenta(aDonde, codigo, nombre) {
  return manda(mensajeDeCuenta(aDonde, codigo, nombre));
}

/* ------------------------------------------------------------
   EL AVISO A LA OFICINA
   ------------------------------------------------------------
   Para lo que una persona tiene que atender hoy mismo: un
   reembolso, un contracargo, un contrato que se cayó.

   Va en texto plano y sin adornos: se lee en el celular, de
   madrugada, y lo único que importa es que se entienda completo
   sin abrir Stripe ni EuroSystem.

   A DONDE LLEGA. A `AVISOS_A`, y si no está configurada, al mismo
   remitente —que es una cuenta de la empresa—. Nunca se queda sin
   destinatario: un aviso de reversa que no se manda es dinero que
   se pierde en silencio, que es justo lo que esto existe para
   impedir.
   ------------------------------------------------------------ */
function aDondeAvisar() {
  const puesto = String(process.env.AVISOS_A || '').trim();
  if (puesto) return puesto.split(',').map(function (c) { return c.trim().toLowerCase(); })
    .filter(Boolean);
  /* Del remitente se saca el correo de adentro de «Eurotravel <x@y.mx>». */
  const m = /<([^>]+)>/.exec(DE);
  return [String(m ? m[1] : DE).trim().toLowerCase()];
}

async function mandaALaOficina(asunto, texto) {
  return manda({
    from: DE,
    to: aDondeAvisar(),
    subject: String(asunto || 'Aviso de Eurotravel').slice(0, 200),
    text: String(texto || ''),
    /* En HTML va el mismo texto, monoespaciado: las columnas alineadas del
       aviso se leen mucho mejor así, y no hace falta otra plantilla. */
    html: '<pre style="font:13px/1.6 ui-monospace,Menlo,Consolas,monospace;' +
      'white-space:pre-wrap;color:#1d1d1b">' + esc(texto) + '</pre>'
  });
}

/* La puerta que usa el webhook: arma y manda, en un solo paso. */
async function mandaContrato(metadata, pdfBase64, liga) {
  return manda(mensajeDeContrato(metadata, pdfBase64, liga));
}

module.exports = {
  DE, hayClave, porQueNoSePuede, pistaDelFallo,
  fechaLarga, datosDelCorreo, mensajeDeContrato, mensajeDeCodigo,
  mensajeDeCuenta, mandaCodigoDeCuenta,
  mensajeDeClaveNueva, mandaCodigoDeClave,
  aDondeAvisar, mandaALaOficina,
  manda, mandaContrato
};
