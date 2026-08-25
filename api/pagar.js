/* ============================================================
   Cobro del anticipo con Stripe — función serverless de Vercel
   ------------------------------------------------------------
   Crea la sesión de pago del 20% y devuelve la dirección a donde
   mandar al cliente. El resto del viaje se abona después.

   Dos cosas que importan:

   1. El precio se vuelve a calcular AQUÍ, midiendo la ruta otra
      vez. Nunca se cobra el monto que mande el navegador: si se
      confiara en él, cualquiera podría pagar $1 por un viaje de
      veinte mil.

   2. Se compra como invitado. No se pide crear cuenta: basta el
      correo y el teléfono, y con eso se le manda a dónde seguir
      abonando.

   Se habla con Stripe por su API de siempre, sin instalar
   librerías: este sitio no tiene paso de compilación y así sigue.

   Necesita la variable STRIPE_SECRET_KEY en Vercel. Sin ella el
   sitio no se rompe: la pantalla avisa y el viaje se cierra por
   teléfono, como hoy.
   ============================================================ */

const tarifa = require('./_tarifa');
const rutas = require('./_rutas');
const defensas = require('./_defensas');   // origen, freno, sitio e IP, en un lugar
const stripe = require('./_stripe');       // y todo lo de Stripe, en otro

/* El seguro contra cobrar de verdad antes de tiempo —PERMITIR_COBRO_REAL—
   ya no vive aqui: se mudo a `_stripe.js`. Asi cualquier cobro que se agregue
   mañana pasa por el candado sin que nadie tenga que acordarse de ponerlo. */

/* OXXO no recibe cualquier cantidad: el voucher tiene tope. Si se le pide a
   Stripe un pago en efectivo por encima del limite, rechaza la sesion entera
   y el cliente se queda sin poder pagar ni con tarjeta. Asi que arriba de este
   monto solo se ofrece tarjeta. El numero es conservador a proposito. */
const TOPE_OXXO = 9000;

// Pagar es lo más caro: los topes más bajos de todos.
const freno = defensas.creaFreno({ porMinuto: 12, porDia: 300 });

/* Folio corto y legible, del estilo ET-K3M9-4Q2. Sirve para que el cliente
   y quien conteste el teléfono hablen del mismo viaje. */
function nuevoFolio() {
  const abc = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';   // sin I, O, 0, 1: se confunden al dictar
  let s = '';
  for (let i = 0; i < 7; i++) {
    if (i === 4) s += '-';
    s += abc.charAt(Math.floor(Math.random() * abc.length));
  }
  return 'ET-' + s;
}

function limpia(v, largo) {
  return String(v == null ? '' : v).replace(/[\r\n\t]+/g, ' ').trim().slice(0, largo || 120);
}

/* `paraStripe` —el saneado del texto que Stripe imprime en la pantalla de
   cobro— se mudo a `_stripe.js`: es cosa de Stripe, no de este endpoint. */
const paraStripe = stripe.paraStripe;

function correoValido(c) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(c);
}

/* Los movimientos, en un renglón por día, para que la oficina lea en el
   contrato lo mismo que el cliente capturó. El precio NO sale de aquí —de eso
   se encarga _tarifa—; esto es la descripción del servicio.

   Se arma con los días que _tarifa dejó pasar, no con los que llegaron: si la
   lista traía más días que noches, los de sobra no se cobran y tampoco tienen
   por qué imprimirse. */
function detalleMovimientos(lista, cuantosCuentan) {
  if (!Array.isArray(lista) || !cuantosCuentan) return '';
  const filas = [];
  for (let i = 0; i < lista.length && filas.length < cuantosCuentan; i++) {
    const d = lista[i] || {};
    const partes = [];
    if (d.horaInicio && d.horaFin) partes.push(limpia(d.horaInicio, 5) + ' a ' + limpia(d.horaFin, 5));
    if (d.recorridos) partes.push(limpia(d.recorridos, 4) + ' recorridos');
    if (d.partida && d.partida.texto) partes.push('sale de ' + limpia(d.partida.texto, 60));
    const visitas = (Array.isArray(d.visitas) ? d.visitas : [])
      .map(function (v) { return limpia(v && v.texto, 60); })
      .filter(Boolean);
    if (visitas.length) partes.push('visita ' + visitas.join(' / '));
    filas.push(limpia(d.fecha, 10) + ': ' + partes.join(', '));
  }
  /* La metadata de Stripe no acepta más de 500 caracteres por valor, y lo que
     se pase se rechaza la sesión entera. Se corta antes, con margen. */
  return filas.join(' | ').slice(0, 450);
}

/* La codificacion de formularios que pide Stripe y la llamada en si tambien se
   mudaron a `_stripe.js`: son de Stripe, no de este endpoint. Aqui quedo lo
   que si es de aqui —el folio, el correo, los montos, la metadata—. */

module.exports = async function handler(req, res) {
  if (defensas.puerta(req, res)) return;

  const claveRutas = process.env.GOOGLE_ROUTES_KEY;

  /* Dos motivos para no poder cobrar —sin clave, o clave de produccion con el
     candado cerrado— y los dos los decide `_stripe.js`. El mensaje que ve el
     cliente es el mismo en los dos casos: no tiene por que enterarse de cual. */
  const noSePuede = stripe.porQueNoSePuedeCobrar();
  if (noSePuede) {
    res.status(503).json({
      error: noSePuede,
      aviso: 'El pago en línea todavía no está activo.'
    });
    return;
  }

  if (!claveRutas) {
    res.status(503).json({
      error: 'routes sin configurar',
      aviso: 'No pudimos confirmar el precio en este momento.'
    });
    return;
  }

  const frenado = freno(req);
  if (frenado) { res.status(frenado.status).json({ error: frenado.error }); return; }

  const cuerpo = defensas.cuerpoJSON(req);

  const correo = limpia(cuerpo.correo, 120).toLowerCase();
  const telefono = limpia(cuerpo.telefono, 30);
  const nombre = limpia(cuerpo.nombre, 90);
  const canal = cuerpo.canal === 'whatsapp' ? 'whatsapp' : 'correo';

  if (!correoValido(correo)) { res.status(400).json({ error: 'correo inválido', aviso: 'Revisa tu correo.' }); return; }
  if (telefono.replace(/\D/g, '').length < 10) {
    res.status(400).json({ error: 'teléfono inválido', aviso: 'Revisa tu teléfono a diez dígitos.' });
    return;
  }

  const origen = rutas.formasDe(cuerpo.origen);
  const destino = rutas.formasDe(cuerpo.destino);
  if (!origen.length || !destino.length) {
    res.status(400).json({ error: 'faltan puntos', aviso: 'Falta el origen o el destino del viaje.' });
    return;
  }

  const redondo = cuerpo.redondo !== false && !!cuerpo.regreso;
  const dias = tarifa.diasDeServicio(cuerpo.salida, cuerpo.regreso);
  const noches = tarifa.nochesDe(cuerpo.salida, cuerpo.regreso);

  try {
    /* --- el precio se vuelve a sacar aquí, no se cree lo que llegó --- */
    const ida = await rutas.mideTramo(origen, destino, claveRutas);
    if (!ida) {
      res.status(422).json({ error: 'sin ruta', aviso: 'No encontramos la ruta de ese viaje.' });
      return;
    }
    let vuelta = null;
    if (redondo) {
      vuelta = await rutas.mideTramo(destino, origen, claveRutas);
      if (!vuelta) {
        res.status(422).json({ error: 'sin ruta de vuelta', aviso: 'No encontramos la ruta de regreso.' });
        return;
      }
    }

    /* Misma función que usa /api/cotizar: es lo que garantiza que aquí no
       salga un número distinto del que se le enseñó al cliente. */
    const kmTotal = tarifa.kmDe(ida.metros, vuelta ? vuelta.metros : 0);
    /* Las mismas dos líneas que /api/cotizar, con la misma lista cruda. Es lo
       único que garantiza que el número de la pantalla de cobro sea el que se
       le enseñó al cliente. */
    const p = tarifa.calcula(kmTotal, dias, {
      noches: noches,
      movimientos: cuerpo.movimientos,
      destino: cuerpo.destino
    });

    const folio = nuevoFolio();
    const sitio = defensas.sitioDe(req);
    const ruta = limpia(cuerpo.rutaTexto, 90) || 'Servicio de transporte';
    const unidad = limpia(cuerpo.unidad, 60);

    const sesion = await stripe.creaSesionDeCobro({
      mode: 'payment',
      locale: 'es-419',   // español de America: los montos salen $4,420.00 y no 4420,00
      customer_email: correo,
      customer_creation: 'always',        // deja rastro para los abonos que siguen
      success_url: sitio + '/?pago=listo&folio=' + folio + '&sesion={CHECKOUT_SESSION_ID}#/cotizar',
      cancel_url: sitio + '/?pago=cancelado#/cotizar',
      line_items: [{
        quantity: 1,
        price_data: {
          currency: 'mxn',
          unit_amount: p.anticipo * 100,     // Stripe cuenta en centavos
          product_data: {
            name: paraStripe('Anticipo ' + p.porcentajeAnticipo + '% · ' + ruta),
            description: paraStripe(unidad + ' · ' + dias + (dias === 1 ? ' día' : ' días') +
              (p.desglose.diasMovimiento
                ? ' · ' + p.desglose.diasMovimiento +
                  (p.desglose.diasMovimiento === 1 ? ' día con movimientos' : ' días con movimientos')
                : '') +
              ' · Total del viaje $' + p.total.toLocaleString('es-MX') + ' MXN, IVA incluido')
          }
        }
      }],
      payment_method_types: p.anticipo <= TOPE_OXXO ? ['card', 'oxxo'] : ['card'],
      metadata: {
        folio: folio,
        nombre: nombre,
        telefono: telefono,
        canal: canal,
        ruta: ruta,
        /* Origen y destino por separado, ademas de `ruta`. El webhook los
           necesita asi para registrar el contrato en EuroSystem, y partir
           «Guadalajara a Puerto Vallarta» por el « a » es fragil: hay destinos
           que llevan «a» en el nombre. */
        origen: limpia(cuerpo.origen && cuerpo.origen.direccion, 250),
        destino: limpia(cuerpo.destino && cuerpo.destino.direccion, 250),
        correo: correo,
        unidad: unidad,
        salida: limpia(cuerpo.salida, 20),
        regreso: limpia(cuerpo.regreso, 20),
        dias: String(dias),
        km: String(Math.round(kmTotal * 10) / 10),
        /* Dónde se recoge al grupo, con referencias. El contrato lo imprime. */
        puntoSalida: limpia(cuerpo.puntoSalida, 300),
        paradas: limpia(cuerpo.paradas, 300),
        /* Lo que se cobró de más, partido en sus dos motivos. El webhook lo
           necesita para que el contrato diga POR QUÉ el total es ese; si solo
           viajara la suma, la oficina no podría cuadrarlo con el cliente.

           Sale de `interno`, no de `desglose`: al cliente el desglose le junta
           traslado y noches para no delatar la tarifa por noche, pero la
           oficina sí las necesita separadas. */
        nochesExtra: String(p.interno.nochesExtra),
        importeNoches: String(p.interno.importeNoches),
        reglaDestino: p.interno.reglaDestino || '',
        movDias: String(p.desglose.diasMovimiento),
        movImporte: String(p.desglose.importeMovimientos),
        movDetalle: detalleMovimientos(cuerpo.movimientos, p.desglose.diasMovimiento),
        total: String(p.total),
        anticipo: String(p.anticipo),
        saldo: String(p.saldo)
      }
    });

    if (!sesion.ok || !sesion.datos.url) {
      res.status(502).json({
        error: 'stripe: ' + ((sesion.datos.error && sesion.datos.error.message) || 'sin url'),
        aviso: 'No pudimos abrir el pago en este momento.'
      });
      return;
    }

    res.status(200).json({
      url: sesion.datos.url,
      folio: folio,
      total: p.total,
      anticipo: p.anticipo,
      saldo: p.saldo,
      porcentajeAnticipo: p.porcentajeAnticipo,
      desglose: p.desglose
    });
  } catch (e) {
    res.status(502).json({ error: String(e && e.message), aviso: 'No pudimos abrir el pago en este momento.' });
  }
};
