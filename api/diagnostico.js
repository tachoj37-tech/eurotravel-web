/* ============================================================
   Diagnóstico de claves — función serverless
   ------------------------------------------------------------
   Comprueba que las dos claves estén configuradas y que Google
   las acepte. NUNCA devuelve el valor de una clave: solo si
   existe, cuántos caracteres mide y qué contestó Google.

   Uso: POST /api/diagnostico desde el propio dominio.
   ============================================================ */

const defensas = require('./_defensas');   // origen y freno, en un lugar

/* Este endpoint prueba las claves contra Google, así que cada llamada gasta
   cuota real. El freno es apretado a propósito: es una herramienta de
   revisión, no algo que se llame en bucle. */
const freno = defensas.creaFreno({ porMinuto: 6, porDia: 60 });

/* La prueba de correo tiene su propio freno, mucho más apretado: manda un
   correo DE VERDAD, y seis por minuto a la oficina es una molestia que nadie
   pidió. */
const frenoCorreo = defensas.creaFreno({ porMinuto: 1, porDia: 8 });

async function pruebaPlaces(clave) {
  try {
    const r = await fetch('https://places.googleapis.com/v1/places:autocomplete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Goog-Api-Key': clave },
      body: JSON.stringify({ input: 'Guadalajara', includedRegionCodes: ['mx'], languageCode: 'es' })
    });
    const d = await r.json();
    if (d.error) return { ok: false, motivo: d.error.status || d.error.message };
    return { ok: true, sugerencias: (d.suggestions || []).length };
  } catch (e) {
    return { ok: false, motivo: 'sin conexión con Google' };
  }
}

async function pruebaRoutes(clave) {
  try {
    const r = await fetch('https://routes.googleapis.com/directions/v2:computeRoutes', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': clave,
        'X-Goog-FieldMask': 'routes.distanceMeters,routes.duration'
      },
      body: JSON.stringify({
        origin: { location: { latLng: { latitude: 20.6597, longitude: -103.3496 } } },
        destination: { location: { latLng: { latitude: 20.6534, longitude: -105.2253 } } },
        travelMode: 'DRIVE'
      })
    });
    const d = await r.json();
    if (d.error) return { ok: false, motivo: d.error.status || d.error.message };
    const ruta = (d.routes || [])[0];
    if (!ruta) return { ok: false, motivo: 'sin ruta en la respuesta' };
    return { ok: true, km: Math.round(ruta.distanceMeters / 1000), duracion: ruta.duration };
  } catch (e) {
    return { ok: false, motivo: 'sin conexión con Google' };
  }
}

module.exports = async function handler(req, res) {
  // Acepta POST y GET: es cómodo abrirlo en el navegador para revisar. La
  // puerta resuelve OPTIONS, el método y el origen en un lugar.
  /* Solo POST. Antes aceptaba GET «porque es cómodo abrirlo en el navegador»,
     y esa comodidad salía cara: un GET lo dispara cualquier etiqueta suelta
     —<img src="…/api/diagnostico">— desde una página ajena, sin que el
     navegador pida permiso primero. Y cada llamada de aquí gasta una consulta
     de Places y una de Routes, que se pagan.
     Para revisarlo hay el guion de pruebas; abrirlo en la barra ya no. */
  if (defensas.puerta(req, res)) return;

  const frenado = freno(req);
  if (frenado) { res.status(frenado.status).json({ error: frenado.error }); return; }

  const places = process.env.GOOGLE_PLACES_KEY || '';
  const routes = process.env.GOOGLE_ROUTES_KEY || '';
  const stripeCrudo = process.env.STRIPE_SECRET_KEY || '';
  const stripe = stripeCrudo.trim();

  const salida = {
    GOOGLE_PLACES_KEY: { configurada: !!places, largo: places.length },
    GOOGLE_ROUTES_KEY: { configurada: !!routes, largo: routes.length },
    STRIPE_SECRET_KEY: {
      configurada: !!stripe,
      largo: stripe.length,
      // saber si es de prueba o de verdad importa: con una de produccion,
      // cualquiera que entre al sitio puede cobrarse dinero real
      teniaEspacios: stripeCrudo !== stripe,
      // el prefijo no es secreto: es el formato publico de Stripe
      modo: !stripe ? 'sin clave'
          : stripe.indexOf('sk_test_') === 0 ? 'PRUEBA — correcta'
          : stripe.indexOf('sk_live_') === 0 ? 'PRODUCCION — cobra dinero real'
          : stripe.indexOf('rk_test_') === 0 ? 'restringida de prueba — puede que le falten permisos'
          : stripe.indexOf('rk_live_') === 0 ? 'restringida de produccion — puede que le falten permisos'
          : stripe.indexOf('pk_') === 0 ? 'ES LA PUBLICABLE, no la secreta — hay que cambiarla'
          : 'no reconocido'
    }
  };

  /* El correo. Por omisión NO se prueba contra Resend: solo se dice si está
     configurada y de dónde saldría. Con `probarCorreo: true` sí se manda uno
     de verdad — ver abajo. */
  const correo = require('./_correo');
  salida.RESEND_API_KEY = {
    configurada: correo.hayClave(),
    sale_de: correo.DE,
    /* El aviso que de verdad importa: sin dominio verificado, Resend solo
       entrega al dueño de la cuenta y rechaza a cualquier otro. */
    ojo: correo.hayClave()
      ? 'Verifica el dominio en Resend antes del primer cliente real: sin eso solo llega a tu propio correo.'
      : 'Sin esta clave el contrato se registra igual, pero al cliente NO le llega nada.'
  };

  /* La llave que firma las ligas y las sesiones. NUNCA su valor: solo si
     está y si mide lo suficiente. Una llave corta se puede adivinar a
     fuerza bruta, y con ella se fabrican ligas y sesiones de cualquiera. */
  const ligas = (process.env.LIGAS_SECRETO || '').trim();
  salida.LIGAS_SECRETO = {
    configurada: !!ligas,
    largo: ligas.length,
    ojo: !ligas
      ? 'Sin esta llave el correo sale sin botón y nadie puede entrar a ver su viaje.'
      : ligas.length < 32
        ? 'CORTA. Genera una de 32 caracteres o más: con randomBytes(32).toString("base64url").'
        : 'Bien. Cambiarla invalida TODAS las ligas ya mandadas.'
  };

  if (places) salida.GOOGLE_PLACES_KEY.prueba = await pruebaPlaces(places);
  if (routes) salida.GOOGLE_ROUTES_KEY.prueba = await pruebaRoutes(routes);

  /* ---------------------------------------------------------------------
     LA PRUEBA DE CORREO — solo si se pide, y solo a nuestra propia dirección

     Decir «la clave está configurada» no sirve de nada: la clave puede estar
     y el correo rebotar igual, porque el remitente no está verificado o
     porque el destinatario no es el de la cuenta de Resend. La única forma
     de saber si llega es mandarlo.

     EL DESTINATARIO NO SE PUEDE PEDIR. Va a `aDondeAvisar()`, que es la
     misma dirección de las alarmas. Un diagnóstico que le manda correo a
     quien le digan es un cañón de spam con el remitente de la empresa —y la
     puerta de origen no lo impide, porque quien llama desde fuera del
     navegador escribe la cabecera que quiera.
     --------------------------------------------------------------------- */
  if (req.body && req.body.probarCorreo === true) {
    const parado = frenoCorreo(req);
    if (parado) {
      salida.RESEND_API_KEY.prueba = { ok: false, motivo: 'demasiadas pruebas seguidas; espera un minuto' };
    } else {
      const aDonde = correo.aDondeAvisar();
      const r = await correo.mandaALaOficina(
        'PRUEBA de Eurotravel — si lees esto, el correo ya funciona',
        [ 'Esto es una prueba de configuración. No pasó nada, no se cobró nada',
          'y no hay ningún contrato involucrado.',
          '',
          'Sale de:  ' + correo.DE,
          'Llega a:  ' + aDonde.join(', '),
          '',
          'Si este correo llegó, la alarma de reembolsos y contracargos también',
          'va a llegar, que es lo que importa.' ].join('\n'));

      salida.RESEND_API_KEY.prueba = r.ok
        ? { ok: true, llego_a: aDonde, id: r.id || '' }
        : { ok: false, motivo: r.motivo, queHacer: correo.pistaDelFallo(r.motivo) };
    }
  }

  res.status(200).json(salida);
};
